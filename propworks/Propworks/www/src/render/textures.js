/* Procedural textures. Every surface in the game is painted here at boot from seeded noise,
   so the look is deterministic and nothing depends on external image files.

   Each generator returns { map, normal?, rough? } of CanvasTextures. Height fields become
   normal maps with a Sobel pass, which is what gives the flat boxes their Source-era relief. */
import * as THREE from 'three';

let anisotropy = 8;
export function setAnisotropy(a) { anisotropy = a; }

/* ------------------------------------------------------------------ noise */
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

class ValueNoise {
  constructor(seed = 1, size = 256) {
    const r = mulberry(seed);
    this.size = size;
    this.v = new Float32Array(size * size);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
  }
  /** tileable 2D value noise; x,y in cells, period = size */
  at(x, y) {
    const s = this.size;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % s) + s) % s, y0 = ((yi % s) + s) % s, x1 = (x0 + 1) % s, y1 = (y0 + 1) % s;
    const a = this.v[y0 * s + x0], b = this.v[y0 * s + x1], c = this.v[y1 * s + x0], d = this.v[y1 * s + x1];
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  /** fractal sum, tileable over `period` cells at octave 0 */
  fbm(x, y, oct = 4, period = 8) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      const p = period * f;
      sum += amp * this.at((x * p) % this.size, (y * p) % this.size);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
}

/* ------------------------------------------------------------------ helpers */
function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Height field (Float32 0..1, w*h) -> tangent-space normal map canvas. */
function normalFromHeight(height, w, h, strength = 2) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Paint per-pixel with fn(x,y,u,v) -> [r,g,b,height]. */
function paint(w, fn, h = w) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, hh = 0.5] = fn(x, y, x / w, y / h);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      height[y * w + x] = hh;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx, height };
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/* ------------------------------------------------------------------ generators */

/** Source-style developer "measure" texture: flat colour, quarter grid, bold border, size label. */
function devTexture(base, line, label, size = 512) {
  const c = canvas(size), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const n = new ValueNoise(7);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const p = i / 4, x = p % size, y = Math.floor(p / size);
    const k = (n.fbm(x / size, y / size, 3, 16) - 0.5) * 14;
    d[i] = clamp255(d[i] + k); d[i + 1] = clamp255(d[i + 1] + k); d[i + 2] = clamp255(d[i + 2] + k);
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = line; g.globalAlpha = 0.55; g.lineWidth = size / 256;
  for (let i = 1; i < 8; i++) {
    const p = (i * size) / 8;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, size); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(size, p); g.stroke();
  }
  g.globalAlpha = 0.9; g.lineWidth = size / 64;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, size - g.lineWidth, size - g.lineWidth);
  g.lineWidth = size / 128;
  g.beginPath(); g.moveTo(size / 2, 0); g.lineTo(size / 2, size); g.moveTo(0, size / 2); g.lineTo(size, size / 2); g.stroke();
  g.globalAlpha = 0.75; g.fillStyle = line;
  g.font = `bold ${size / 11}px Tahoma, Verdana, sans-serif`;
  g.fillText(label, size * 0.06, size * 0.14);
  g.globalAlpha = 1;
  return c;
}

function concrete(seed, tint = [150, 150, 146], size = 512, stains = 0.3) {
  const n = new ValueNoise(seed), m = new ValueNoise(seed + 9);
  return paint(size, (x, y, u, v) => {
    const f = n.fbm(u, v, 5, 8);
    const s = m.fbm(u, v, 3, 3);
    const pits = n.at(u * 180, v * 180) > 0.93 ? -28 : 0;
    const k = (f - 0.5) * 40 + pits - Math.max(0, s - 0.55) * 120 * stains;
    return [clamp255(tint[0] + k), clamp255(tint[1] + k), clamp255(tint[2] + k * 0.95), f * 0.6 + (pits ? -0.2 : 0)];
  });
}

function tiles(seed, a = [226, 228, 230], grout = [150, 152, 150], count = 4, size = 512) {
  const n = new ValueNoise(seed);
  return paint(size, (x, y, u, v) => {
    const gx = (u * count) % 1, gy = (v * count) % 1;
    const edge = Math.min(gx, gy, 1 - gx, 1 - gy);
    const cell = Math.floor(u * count) + Math.floor(v * count) * 7;
    const tn = (n.at(cell * 3.1, 1.7) - 0.5) * 16;
    const f = (n.fbm(u, v, 4, 16) - 0.5) * 10;
    if (edge < 0.025) return [grout[0] + f, grout[1] + f, grout[2] + f, 0.1];
    const bevel = Math.min(1, edge / 0.06);
    return [clamp255(a[0] + tn + f), clamp255(a[1] + tn + f), clamp255(a[2] + tn + f), 0.5 + bevel * 0.4];
  });
}

function bricks(seed, size = 512) {
  const n = new ValueNoise(seed);
  const rows = 8, cols = 4;
  return paint(size, (x, y, u, v) => {
    const row = Math.floor(v * rows);
    const off = row % 2 ? 0.5 / cols : 0;
    const bu = ((u + off) * cols) % 1, bv = (v * rows) % 1;
    const id = Math.floor((u + off) * cols) + row * 13;
    const edge = Math.min(bu * 2.2, bv, 1 - bu * 1.0 * 1, 1 - bv);
    const f = (n.fbm(u, v, 4, 16) - 0.5) * 30;
    if (bu < 0.03 || bv < 0.08) return [120 + f * 0.5, 116 + f * 0.5, 108 + f * 0.5, 0.05];
    const tone = (n.at(id * 1.3, 4.2) - 0.5) * 40;
    return [clamp255(146 + tone + f), clamp255(70 + tone * 0.5 + f * 0.6), clamp255(52 + tone * 0.3 + f * 0.5), 0.55 + Math.min(edge, 0.1) * 3];
  });
}

function metalPanel(seed, tint = [120, 126, 132], size = 512, rivets = true) {
  const n = new ValueNoise(seed);
  return paint(size, (x, y, u, v) => {
    const f = (n.fbm(u, v, 5, 6) - 0.5) * 22;
    const brushed = (n.at(u * 2, v * 220) - 0.5) * 10;
    const pu = (u * 2) % 1, pv = (v * 2) % 1;
    const seam = Math.min(pu, pv, 1 - pu, 1 - pv) < 0.008;
    let h = 0.5, k = f + brushed;
    if (seam) { k -= 45; h = 0.1; }
    if (rivets) {
      for (const [ru, rv] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95], [0.5, 0.05], [0.5, 0.95], [0.05, 0.5], [0.95, 0.5]]) {
        const dd = Math.hypot(pu - ru, pv - rv);
        if (dd < 0.022) { k += 30 * (1 - dd / 0.022); h = 0.5 + 0.5 * (1 - dd / 0.022); }
      }
    }
    return [clamp255(tint[0] + k), clamp255(tint[1] + k), clamp255(tint[2] + k), h];
  });
}

function diamondPlate(seed, size = 512) {
  const n = new ValueNoise(seed);
  return paint(size, (x, y, u, v) => {
    const f = (n.fbm(u, v, 4, 8) - 0.5) * 26;
    const cu = (u * 16) % 1, cv = (v * 16) % 1;
    const alt = (Math.floor(u * 16) + Math.floor(v * 16)) % 2;
    const a = alt ? (cu - 0.5) + (cv - 0.5) : (cu - 0.5) - (cv - 0.5);
    const b = alt ? (cu - 0.5) - (cv - 0.5) : (cu - 0.5) + (cv - 0.5);
    const ridge = Math.abs(a) < 0.1 && Math.abs(b) < 0.36;
    const h = ridge ? 0.9 - Math.abs(a) * 3 : 0.3;
    const k = f + (ridge ? 24 : 0);
    return [clamp255(140 + k), clamp255(144 + k), clamp255(148 + k), h];
  });
}

function woodPlanks(seed, tint = [168, 122, 74], size = 512, planks = 4) {
  const n = new ValueNoise(seed);
  return paint(size, (x, y, u, v) => {
    const p = Math.floor(v * planks);
    const pv = (v * planks) % 1;
    const shift = n.at(p * 5.3, 2.1) * 3;
    const grain = Math.sin((u * 3 + shift) * 40 + n.fbm(u + shift, pv * 0.25, 4, 4) * 18) * 0.5 + 0.5;
    const tone = (n.at(p * 2.7, 9.1) - 0.5) * 38;
    const f = (n.fbm(u, v, 4, 16) - 0.5) * 18;
    const seam = pv < 0.03 || pv > 0.97;
    const k = tone + f - grain * 22 - (seam ? 60 : 0);
    return [clamp255(tint[0] + k), clamp255(tint[1] + k * 0.8), clamp255(tint[2] + k * 0.6), seam ? 0.1 : 0.5 + grain * 0.15];
  });
}

/** Wooden crate face: frame + diagonal brace + stencil. */
function crateFace(seed, size = 512) {
  const base = woodPlanks(seed, [176, 132, 80], size, 5);
  const g = base.ctx;
  const b = size * 0.11;
  g.fillStyle = 'rgba(120,80,44,0.95)';
  g.fillRect(0, 0, size, b); g.fillRect(0, size - b, size, b); g.fillRect(0, 0, b, size); g.fillRect(size - b, 0, b, size);
  g.save(); g.translate(size / 2, size / 2); g.rotate(Math.PI / 4);
  g.fillRect(-size * 0.7, -b / 2, size * 1.4, b); g.restore();
  g.strokeStyle = 'rgba(60,36,18,0.9)'; g.lineWidth = size / 128;
  g.strokeRect(b, b, size - 2 * b, size - 2 * b); g.strokeRect(2, 2, size - 4, size - 4);
  g.fillStyle = 'rgba(40,40,40,0.9)';
  for (const [x, y] of [[b / 2, b / 2], [size - b / 2, b / 2], [b / 2, size - b / 2], [size - b / 2, size - b / 2]]) { g.beginPath(); g.arc(x, y, size / 70, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(30,20,12,0.55)'; g.font = `bold ${size / 12}px Tahoma, sans-serif`; g.textAlign = 'center';
  g.fillText('FRAGILE', size / 2, size * 0.3);
  // rebuild height so the frame reads in relief
  const img = g.getImageData(0, 0, size, size).data;
  for (let i = 0; i < size * size; i++) base.height[i] = (img[i * 4] + img[i * 4 + 1]) / 510;
  return base;
}

function grass(seed, size = 512) {
  const n = new ValueNoise(seed), m = new ValueNoise(seed + 3);
  return paint(size, (x, y, u, v) => {
    const f = n.fbm(u, v, 5, 8);
    const blades = m.at(u * 256, v * 256);
    const patch = n.fbm(u, v, 2, 2);
    const k = (f - 0.5) * 50 + (blades - 0.5) * 36;
    const dry = Math.max(0, patch - 0.58) * 180;
    return [clamp255(74 + k + dry * 0.9), clamp255(112 + k + dry * 0.35), clamp255(44 + k * 0.5), 0.3 + blades * 0.5];
  });
}

function dirt(seed, tint = [128, 104, 76], size = 512) {
  const n = new ValueNoise(seed);
  return paint(size, (x, y, u, v) => {
    const f = n.fbm(u, v, 6, 8);
    const pebble = n.at(u * 120, v * 120) > 0.86 ? 20 : 0;
    const k = (f - 0.5) * 60 + pebble;
    return [clamp255(tint[0] + k), clamp255(tint[1] + k * 0.9), clamp255(tint[2] + k * 0.8), f + pebble / 60];
  });
}

/** Missing-texture checkerboard: the visual signature of the corruption. */
function checker(a = '#ff00dc', b = '#000000', cells = 8, size = 256) {
  const c = canvas(size), g = c.getContext('2d');
  const s = size / cells;
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) { g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * s, y * s, s, s); }
  return c;
}

function hazard(size = 256) {
  const c = canvas(size), g = c.getContext('2d');
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#1c1c1c';
  for (let i = -size; i < size * 2; i += size / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + size / 8, 0); g.lineTo(i + size / 8 - size, size); g.lineTo(i - size, size); g.fill(); }
  return c;
}

/** Red explosive drum wrap. */
function barrelWrap(color = '#b3261e', label = 'FLAMMABLE', size = 512) {
  const n = new ValueNoise(31);
  const c = canvas(size), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const p = i / 4, x = p % size, y = Math.floor(p / size);
    const k = (n.fbm(x / size, y / size, 4, 8) - 0.5) * 40 - (n.at(x / 4, y / 4) > 0.9 ? 30 : 0);
    d[i] = clamp255(d[i] + k); d[i + 1] = clamp255(d[i + 1] + k * 0.6); d[i + 2] = clamp255(d[i + 2] + k * 0.6);
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (const y of [0.18, 0.5, 0.82]) g.fillRect(0, size * y - 6, size, 12);
  g.fillStyle = '#f5f0e6';
  for (const cx of [0.25, 0.75]) {
    g.save(); g.translate(size * cx, size * 0.34);
    g.beginPath(); g.moveTo(0, -48); g.lineTo(48, 0); g.lineTo(0, 48); g.lineTo(-48, 0); g.closePath(); g.fill();
    g.fillStyle = color; g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(22, 4, 0, 28); g.quadraticCurveTo(-22, 4, 0, -30); g.fill();
    g.fillStyle = '#f5f0e6'; g.font = 'bold 30px Tahoma, sans-serif'; g.textAlign = 'center'; g.fillText(label, 0, 100);
    g.restore();
  }
  return c;
}

function panelCeiling(size = 512) {
  const base = metalPanel(77, [200, 202, 204], size, false);
  return base;
}

/** Emissive light panel: white rectangle with frame. */
function lightPanel(size = 256) {
  const c = canvas(size), g = c.getContext('2d');
  g.fillStyle = '#7d8187'; g.fillRect(0, 0, size, size);
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, '#fffdf2'); grd.addColorStop(1, '#f2f6ff');
  g.fillStyle = grd; g.fillRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  g.strokeStyle = 'rgba(160,160,160,0.6)'; g.lineWidth = 3;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(size * 0.08, size * (0.08 + i * 0.14)); g.lineTo(size * 0.92, size * (0.08 + i * 0.14)); g.stroke(); }
  return c;
}

function waterNormal(size = 256) {
  const n = new ValueNoise(5, 128);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) height[y * size + x] = n.fbm(x / size, y / size, 5, 4);
  return normalFromHeight(height, size, size, 6);
}

function cloudTexture(size = 1024) {
  const n = new ValueNoise(12, 256);
  const c = canvas(size, size / 2), g = c.getContext('2d');
  const img = g.createImageData(size, size / 2), d = img.data;
  for (let y = 0; y < size / 2; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / (size / 2);
      const f = n.fbm(u, v * 0.5, 6, 6);
      const cover = Math.max(0, (f - 0.48) * 3.2);
      const fade = Math.sin(v * Math.PI) ** 0.6 * (1 - v) ** 0.3;
      const a = Math.min(1, cover) * fade;
      const i = (y * size + x) * 4;
      const shade = 255 - Math.max(0, f - 0.62) * 260;
      d[i] = shade; d[i + 1] = shade; d[i + 2] = Math.min(255, shade + 6); d[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ sprites */
function radial(size, stops) {
  const c = canvas(size), g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grd.addColorStop(o, col);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return c;
}

function smokeSprite(size = 128) {
  const n = new ValueNoise(21, 64);
  const c = canvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / size - 0.5, dy = y / size - 0.5;
    const r = Math.hypot(dx, dy) * 2;
    const f = n.fbm(x / size, y / size, 4, 4);
    const a = Math.max(0, 1 - r) ** 1.5 * (0.55 + f * 0.9);
    const i = (y * size + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ registry */
export const TEX = {};

/** Build everything once. Returns a promise so the boot bar can advance between groups. */
export async function buildTextures(report = () => {}) {
  const step = async (label) => { report(label); await new Promise((r) => setTimeout(r, 0)); };
  const pack = (p, strength = 2, opts = {}) => ({ map: tex(p.c, opts), normal: tex(normalFromHeight(p.height, p.c.width, p.c.height, strength), { srgb: false }) });

  await step('Painting developer textures');
  TEX.devOrange = { map: tex(devTexture('#d9772b', '#8a4212', '128')) };
  TEX.devGrey = { map: tex(devTexture('#9da1a6', '#62666b', '128')) };
  TEX.devLight = { map: tex(devTexture('#c9ccd0', '#8b8f95', '64')) };
  TEX.devDark = { map: tex(devTexture('#55595f', '#2f3236', '256')) };
  TEX.devBlue = { map: tex(devTexture('#4f7fb5', '#2c4d73', '128')) };

  await step('Pouring concrete');
  TEX.concrete = pack(concrete(3), 2.5);
  TEX.concreteDark = pack(concrete(4, [96, 98, 100], 512, 0.5), 2.5);
  TEX.concreteWarm = pack(concrete(8, [168, 160, 146]), 2.2);
  TEX.tiles = pack(tiles(5), 3);
  TEX.floorTiles = pack(tiles(6, [120, 124, 128], [70, 72, 74], 4), 3);
  TEX.bricks = pack(bricks(9), 3);

  await step('Stamping metal');
  TEX.metal = pack(metalPanel(11), 3);
  TEX.metalDark = pack(metalPanel(12, [70, 74, 80]), 3);
  TEX.metalRust = pack(concrete(14, [120, 78, 52], 512, 0.8), 3);
  TEX.diamond = pack(diamondPlate(15), 4);
  TEX.ceiling = pack(panelCeiling(), 2);

  await step('Cutting wood');
  TEX.wood = pack(woodPlanks(17), 2);
  TEX.woodDark = pack(woodPlanks(18, [110, 74, 44]), 2);
  TEX.crate = pack(crateFace(19), 3);

  await step('Growing grass');
  TEX.grass = pack(grass(23), 2);
  TEX.dirt = pack(dirt(24), 2.5);
  TEX.sand = pack(dirt(25, [196, 170, 124]), 1.5);

  await step('Corrupting data');
  TEX.checker = { map: tex(checker()) };
  TEX.checker.map.magFilter = THREE.NearestFilter;
  TEX.checker.map.minFilter = THREE.NearestMipmapNearestFilter;
  TEX.hazard = { map: tex(hazard()) };
  TEX.barrel = { map: tex(barrelWrap()) };
  TEX.barrelBlue = { map: tex(barrelWrap('#2d5aa8', 'COOLANT')) };
  TEX.barrelGrey = { map: tex(barrelWrap('#6d7176', 'WASTE')) };
  TEX.lightPanel = { map: tex(lightPanel()) };
  TEX.water = { normal: tex(waterNormal(), { srgb: false }) };
  TEX.clouds = { map: tex(cloudTexture(), { repeat: true }) };

  TEX.spriteGlow = tex(radial(128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]), { repeat: false });
  TEX.spriteSoft = tex(radial(64, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]), { repeat: false });
  TEX.spriteSmoke = tex(smokeSprite(), { repeat: false });
}

/** Canvas texture with text, for signs, terminals and the tool gun screen. */
export function textTexture(lines, { w = 512, h = 256, bg = '#1b2a3a', fg = '#e6f2ff', font = 'bold 44px Tahoma, sans-serif', align = 'center', border = null, glow = null } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
  g.fillStyle = fg; g.font = font; g.textAlign = align; g.textBaseline = 'middle';
  if (glow) { g.shadowColor = glow; g.shadowBlur = 14; }
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = h / (arr.length + 1);
  arr.forEach((line, i) => g.fillText(line, align === 'center' ? w / 2 : 24, lh * (i + 1)));
  const t = tex(c, { repeat: false });
  t.userData = { canvas: c };
  return t;
}

export { ValueNoise, mulberry };
