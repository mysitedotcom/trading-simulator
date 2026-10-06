// ============================================================
// Coach Signal Overlay: simulation
// All values are randomly generated for demonstration only.
// ============================================================

const canvas = document.getElementById('wave');
const ctx = canvas.getContext('2d');
const codeTrack = document.getElementById('codeTrack');

const COLORS = {
  line: '#e8f1ff',
  glow: 'rgba(58, 168, 245, 0.55)',
  trend: '#2ecc71',
  up: '#ff4d4d',
  down: '#3aa8f5',
  grid: 'rgba(120, 160, 255, 0.08)'
};

let STEP = 10;            // px between data points (smaller on phones)
const SPEED = 70;         // px per second the lines scroll
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let W = 0, H = 0, dpr = 1;
let pts = [];             // { y, marker: null | 'up' | 'down', born }
let offset = 0;
let y = 0.5, vel = 0;
let volatility = 1;       // boosted briefly by the space bar
let last = performance.now();

function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  STEP = W < 600 ? 7 : 10;
  // Make sure the line always spans the full width after a resize or rotation
  const needed = Math.ceil(W / STEP) + 4;
  while (pts.length && pts.length < needed) pts.unshift({ y: pts[0].y, marker: null, born: 0 });
}

function nextValue() {
  vel += (Math.random() - 0.5) * 0.07 * volatility;
  vel *= 0.88;
  vel += (0.5 - y) * 0.012;
  y = Math.min(0.88, Math.max(0.12, y + vel));
  return y;
}

function pushPoint(now) {
  pts.push({ y: nextValue(), marker: null, born: now });
  const maxPts = Math.ceil(W / STEP) + 4;
  while (pts.length > maxPts) pts.shift();

  // Detect a local peak/dip a few points back
  const n = pts.length;
  if (n > 8) {
    const c = pts[n - 4];
    const around = [pts[n - 8], pts[n - 6], pts[n - 2], pts[n - 1]].map(p => p.y);
    const isPeak = around.every(v => c.y < v - 0.03);   // smaller y = higher on screen
    const isDip  = around.every(v => c.y > v + 0.03);
    const recent = pts.slice(n - 14, n - 4).some(p => p.marker);
    if (!c.marker && !recent) {
      if (isPeak) { c.marker = 'up';   c.born = now; }
      if (isDip)  { c.marker = 'down'; c.born = now; }
    }
  }
}

function xAt(i, n) { return W - (n - 1 - i) * STEP - offset; }
function yAt(v) { return 18 + v * (H - 36); }

function drawGrid() {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const gy = (H / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }
}

function tracePath(values, n) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = xAt(i, n), py = yAt(values[i]);
    if (i === 0) { ctx.moveTo(x, py); continue; }
    const px = xAt(i - 1, n), ppy = yAt(values[i - 1]);
    const mx = (px + x) / 2;
    ctx.quadraticCurveTo(px, ppy, mx, (ppy + py) / 2);
  }
}

function drawMarker(p, x, py, now) {
  const age = Math.min(1, (now - p.born) / 500);
  const pop = 1 + (1 - age) * 0.8;
  const color = p.marker === 'up' ? COLORS.up : COLORS.down;
  const dir = p.marker === 'up' ? -1 : 1;

  ctx.save();
  ctx.translate(x, py);
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 6 * pop, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // arrow tip above (peak) or below (dip)
  ctx.beginPath();
  ctx.moveTo(0, dir * 12 * pop);
  ctx.lineTo(-5 * pop, dir * 20 * pop);
  ctx.lineTo(5 * pop, dir * 20 * pop);
  ctx.closePath();
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  const n = pts.length;
  if (n < 3) return;

  const values = pts.map(p => p.y);

  // Fill under main line
  tracePath(values, n);
  ctx.lineTo(xAt(n - 1, n), H);
  ctx.lineTo(xAt(0, n), H);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, 'rgba(58, 168, 245, 0.22)');
  fill.addColorStop(1, 'rgba(58, 168, 245, 0)');
  ctx.fillStyle = fill;
  ctx.fill();

  // Trend line (moving average)
  const avg = values.map((_, i) => {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - 7); k <= Math.min(n - 1, i + 0); k++) { s += values[k]; c++; }
    return s / c;
  });
  tracePath(avg, n);
  ctx.strokeStyle = COLORS.trend;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(46, 204, 113, 0.8)';
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Main line
  tracePath(values, n);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = COLORS.glow;
  ctx.shadowBlur = 14;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Markers
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (!p.marker) continue;
    const x = xAt(i, n);
    if (x < -20) continue;
    drawMarker(p, x, yAt(p.y), now);
  }

  // Live head dot
  const hx = xAt(n - 1, n), hy = yAt(values[n - 1]);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  offset += SPEED * dt;
  while (offset >= STEP) { offset -= STEP; pushPoint(now); }
  draw(now);
  requestAnimationFrame(frame);
}

// ---------- Code strip ----------
function buildCodeStrip() {
  const frag = document.createDocumentFragment();
  const digits = Array.from({ length: 32 }, () => Math.floor(Math.random() * 10));
  // Two copies so the CSS scroll loops seamlessly
  for (let copy = 0; copy < 2; copy++) {
    digits.forEach((d, i) => {
      const el = document.createElement('div');
      el.className = 'code' + (((i * 7 + 3) % 10) > 6 ? ' code--alt' : '');
      el.textContent = d;
      frag.appendChild(el);
    });
  }
  codeTrack.appendChild(frag);
}

// ---------- Space bar: brief volatility burst for the recording ----------
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  volatility = 3.2;
  setTimeout(() => { volatility = 1; }, 2500);
});

// ---------- Start ----------
window.addEventListener('resize', resize);
resize();
for (let i = 0; i < Math.ceil(W / STEP) + 4; i++) pushPoint(performance.now() - 5000);
buildCodeStrip();

if (reduceMotion) {
  draw(performance.now());
} else {
  requestAnimationFrame(frame);
}
