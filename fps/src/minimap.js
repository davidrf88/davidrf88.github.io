import { WORLD_SIZE, heightAt } from './terrain.js';
import { REGIONS, GRID, regionAt, gridRef } from './regions.js';

const HALF = WORLD_SIZE / 2;
const BASE_PX = 1024;            // resolution of the baked map image
const MINI_RANGE = 55;           // meters from the player to the minimap edge
const TOAST_MS = 2600;

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Bakes the whole world once: hillshaded terrain, tree canopies, rocks, region borders. */
function bakeMap({ trees, rocks }) {
  const n = BASE_PX;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  const m = WORLD_SIZE / n;
  const regionIdx = new Uint8Array(n * n);
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      const x = px * m - HALF, z = py * m - HALF;
      regionIdx[py * n + px] = REGIONS.indexOf(regionAt(x, z));
      const h = heightAt(x, z);
      // Light from the north-west.
      const dx = heightAt(x + m, z) - heightAt(x - m, z);
      const dz = heightAt(x, z + m) - heightAt(x, z - m);
      const shade = Math.min(1.25, Math.max(0.55, 1 + (dx + dz) / (2 * m) * 0.55));
      const hi = smoothstep(-6, 30, h);
      let r = 92 + hi * 70, g = 128 + hi * 22, b = 64 + hi * 34;
      const steep = smoothstep(0.5, 1.2, Math.hypot(dx, dz) / (2 * m));
      r += (128 - r) * steep; g += (108 - g) * steep; b += (84 - b) * steep;
      const i = (py * n + px) * 4;
      img.data[i] = r * shade;
      img.data[i + 1] = g * shade;
      img.data[i + 2] = b * shade;
      img.data[i + 3] = 255;
    }
  }
  // Region borders: darken pixels whose neighbor belongs to another region.
  for (let py = 1; py < n; py++) {
    for (let px = 1; px < n; px++) {
      const k = py * n + px;
      if (regionIdx[k] === regionIdx[k - 1] && regionIdx[k] === regionIdx[k - n]) continue;
      for (let c = 0; c < 3; c++) img.data[k * 4 + c] *= 0.45;
    }
  }
  ctx.putImageData(img, 0, 0);

  const s = n / WORLD_SIZE;
  const toPx = (v) => (v + HALF) * s;
  ctx.fillStyle = 'rgba(28, 58, 26, 0.55)';
  for (const t of trees) {
    ctx.beginPath();
    ctx.arc(toPx(t.x), toPx(t.z), Math.max(1.5, t.r * s * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(160, 160, 150, 0.75)';
  for (const r of rocks) {
    ctx.beginPath();
    ctx.arc(toPx(r.x), toPx(r.z), Math.max(1.2, r.r * s * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function sizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return dpr;
}

function label(ctx, text, x, y, size) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.28;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

/**
 * Blue zone on a map: everything outside the blue wall is tinted, the wall edge is blue, the next
 * safe zone is a white ring, and a dashed line points the shortest way into it.
 * `toScreen(x, z)` maps world → canvas, `s` is canvas px per meter.
 */
function drawZone(ctx, zone, pos, toScreen, s, w, dpr) {
  if (!zone) return;
  const [bx, by] = toScreen(zone.x, zone.z);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, w);
  ctx.arc(bx, by, Math.max(0, zone.r * s), 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(40, 80, 210, 0.35)';
  ctx.fill('evenodd');
  ctx.beginPath();
  ctx.arc(bx, by, Math.max(0, zone.r * s), 0, Math.PI * 2);
  ctx.strokeStyle = '#4f86ff';
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  const next = zone.next;
  if (next) {
    const [wx, wy] = toScreen(next.x, next.z);
    ctx.beginPath();
    ctx.arc(wx, wy, Math.max(1, next.r * s), 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
  }
  // Run line from the player to the nearest edge of the safe zone.
  const target = next ?? zone;
  const dx = target.x - pos.x, dz = target.z - pos.z, d = Math.hypot(dx, dz);
  if (d > target.r + 1) {
    const k = (d - target.r) / d;
    const [px, py] = toScreen(pos.x, pos.z);
    const [ex, ey] = toScreen(pos.x + dx * k, pos.z + dz * k);
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
  }
  ctx.restore();
}

/** Arrow pointing "up" at angle 0, rotated clockwise by `angle`. */
function arrow(ctx, x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, size * 0.75);
  ctx.lineTo(0, size * 0.35);
  ctx.lineTo(-size * 0.7, size * 0.75);
  ctx.closePath();
  ctx.fillStyle = '#ffd27a';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = size * 0.22;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/**
 * North-up minimap around the player, a full map on M, and the current region name
 * (with an "entering" toast when it changes).
 */
export class Minimap {
  constructor(markers) {
    this.base = bakeMap(markers);
    this.mini = document.getElementById('minimap-canvas');
    this.big = document.getElementById('bigmap-canvas');
    this.bigWrap = document.getElementById('bigmap');
    this.regionEl = document.getElementById('region-name');
    this.toastEl = document.getElementById('region-toast');
    this.region = null;
    this.toastTimer = 0;
    document.getElementById('minimap').hidden = false;
  }

  get bigOpen() { return !this.bigWrap.hidden; }
  toggleBig(open = !this.bigOpen) { this.bigWrap.hidden = !open; }

  /**
   * @param {{x:number, z:number}} pos  who the map follows (you, or the player you spectate)
   * @param {number} angle  heading as a clockwise angle from north
   * @param {object|null} zone  blue zone state (zone.js zoneAt) during a match
   */
  update(pos, angle, zone = null) {
    const r = regionAt(pos.x, pos.z);
    this.regionEl.textContent = `${r.name} · ${gridRef(pos.x, pos.z)}`;
    if (r !== this.region) {
      if (this.region) this.#toast(r.name);
      this.region = r;
    }
    this.#drawMini(pos, angle, zone);
    if (this.bigOpen) this.#drawBig(pos, angle, zone);
  }

  #toast(name) {
    this.toastEl.textContent = name;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('on'), TOAST_MS);
  }

  #drawMini(pos, angle, zone) {
    const c = this.mini;
    const dpr = sizeCanvas(c);
    const ctx = c.getContext('2d');
    const w = c.width;
    const pxPerM = w / (MINI_RANGE * 2);
    const bs = BASE_PX / WORLD_SIZE;
    ctx.fillStyle = '#2c3a28';
    ctx.fillRect(0, 0, w, w);
    ctx.drawImage(this.base,
      (pos.x - MINI_RANGE + HALF) * bs, (pos.z - MINI_RANGE + HALF) * bs, MINI_RANGE * 2 * bs, MINI_RANGE * 2 * bs,
      0, 0, w, w);
    const toScreen = (x, z) => [(x - pos.x) * pxPerM + w / 2, (z - pos.z) * pxPerM + w / 2];
    drawZone(ctx, zone, pos, toScreen, pxPerM, w, dpr);
    for (const reg of REGIONS) {
      const [sx, sy] = toScreen(reg.x, reg.z);
      const m = 34 * dpr; // skip labels that would be cut off at the edge
      if (sx < m || sx > w - m || sy < m * 0.5 || sy > w - m * 0.5) continue;
      label(ctx, reg.name, sx, sy, 11 * dpr);
    }
    label(ctx, 'N', w / 2, 9 * dpr, 11 * dpr);
    arrow(ctx, w / 2, w / 2, angle, 7 * dpr);
  }

  #drawBig(pos, angle, zone) {
    const c = this.big;
    const dpr = sizeCanvas(c);
    const ctx = c.getContext('2d');
    const w = c.width;
    const s = w / WORLD_SIZE;
    ctx.drawImage(this.base, 0, 0, w, w);
    drawZone(ctx, zone, pos, (x, z) => [(x + HALF) * s, (z + HALF) * s], s, w, dpr);
    // Grid with A–E / 1–5 callouts.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = dpr;
    const cell = w / GRID;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, w);
      ctx.moveTo(0, i * cell); ctx.lineTo(w, i * cell);
      ctx.stroke();
    }
    for (let i = 0; i < GRID; i++) {
      label(ctx, 'ABCDE'[i], (i + 0.5) * cell, 12 * dpr, 13 * dpr);
      label(ctx, String(i + 1), 12 * dpr, (i + 0.5) * cell, 13 * dpr);
    }
    for (const reg of REGIONS) label(ctx, reg.name, (reg.x + HALF) * s, (reg.z + HALF) * s, 16 * dpr);
    arrow(ctx, (pos.x + HALF) * s, (pos.z + HALF) * s, angle, 9 * dpr);
  }
}
