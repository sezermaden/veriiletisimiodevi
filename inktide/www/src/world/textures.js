// Procedural surface textures (canvas) + matching normal maps. All tileable.
import * as THREE from 'three';
import { mulberry } from '../ink/ink-system.js';

const SIZE = 512;
const cache = new Map();

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function noiseFill(ctx, size, rnd, base, amount, cell = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
    const n = (rnd() - 0.5) * amount;
    for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++) {
      const i = ((y + yy) * size + (x + xx)) * 4;
      d[i] = clamp(d[i] + n); d[i + 1] = clamp(d[i + 1] + n); d[i + 2] = clamp(d[i + 2] + n);
    }
  }
  ctx.putImageData(img, 0, 0);
  void base;
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Soft blotches for grime/variation, tileable by wrapping draws. */
function blotches(ctx, size, rnd, count, color, rMin, rMax, alpha) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = rMin + rnd() * (rMax - rMin);
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, color.replace('A', String(alpha)));
      g.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}

/** Height canvas → tangent-space normal map canvas. */
function normalFromHeight(hc, strength = 2.5) {
  const size = hc.width;
  const src = hc.getContext('2d').getImageData(0, 0, size, size).data;
  const out = canvas(size);
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  const h = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
    const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
    const i = (y * size + x) * 4;
    img.data[i] = (-dx * nz * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy * nz * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Painters: each draws albedo into `c` and height into `h` (grey, 128 = flat).

const PAINTERS = {
  concrete(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#b3aea6'; x.fillRect(0, 0, SIZE, SIZE);
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 40, 'rgba(90,85,80,A)', 20, 90, 0.12);
    blotches(x, SIZE, rnd, 30, 'rgba(255,255,255,A)', 10, 60, 0.10);
    noiseFill(x, SIZE, rnd, 0, 18, 2);
    // expansion joints every half tile
    x.fillStyle = 'rgba(60,58,55,.55)'; y.fillStyle = '#3a3a3a';
    for (const p of [0, SIZE / 2]) { x.fillRect(p, 0, 3, SIZE); x.fillRect(0, p, SIZE, 3); y.fillRect(p, 0, 4, SIZE); y.fillRect(0, p, SIZE, 4); }
    noiseFill(y, SIZE, rnd, 0, 22, 2);
  },
  tiles(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    y.fillStyle = '#909090'; y.fillRect(0, 0, SIZE, SIZE);
    const n = 4, s = SIZE / n;
    const cols = ['#cfc4b0', '#c2b7a2', '#d6ccb9', '#bcae98'];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      x.fillStyle = cols[Math.floor(rnd() * cols.length)];
      x.fillRect(i * s, j * s, s, s);
    }
    noiseFill(x, SIZE, rnd, 0, 10, 2);
    x.fillStyle = '#a79d8c'; y.fillStyle = '#404040';
    for (let i = 0; i <= n; i++) { x.fillRect(i * s - 3, 0, 6, SIZE); x.fillRect(0, i * s - 3, SIZE, 6); y.fillRect(i * s - 4, 0, 8, SIZE); y.fillRect(0, i * s - 4, SIZE, 8); }
  },
  asphalt(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#4a4a50'; x.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 30, 'rgba(20,20,25,A)', 20, 80, 0.2);
    noiseFill(x, SIZE, rnd, 0, 34, 1);
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    noiseFill(y, SIZE, rnd, 0, 60, 1);
  },
  wood(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    const planks = 6, ph = SIZE / planks;
    for (let i = 0; i < planks; i++) {
      const base = [150 + rnd() * 30, 105 + rnd() * 20, 70 + rnd() * 15];
      x.fillStyle = `rgb(${base.map(Math.round).join(',')})`;
      x.fillRect(0, i * ph, SIZE, ph);
      for (let k = 0; k < 40; k++) {
        x.strokeStyle = `rgba(80,50,30,${0.05 + rnd() * 0.12})`;
        x.lineWidth = 1 + rnd() * 2;
        x.beginPath();
        const yy = i * ph + rnd() * ph;
        x.moveTo(0, yy);
        for (let xx = 0; xx <= SIZE; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.02 + k) * 2);
        x.stroke();
      }
      const off = rnd() * SIZE;
      y.fillStyle = '#8a8a8a'; y.fillRect(0, i * ph, SIZE, ph);
      y.fillStyle = '#2a2a2a'; y.fillRect(0, i * ph, SIZE, 4); y.fillRect(off, i * ph, 4, ph);
      x.fillStyle = 'rgba(40,25,15,.8)'; x.fillRect(0, i * ph, SIZE, 3); x.fillRect(off, i * ph, 3, ph);
      x.fillStyle = 'rgba(60,60,60,.9)';
      for (const nx of [off + 14, off - 14]) { x.beginPath(); x.arc((nx + SIZE) % SIZE, i * ph + ph * 0.3, 3, 0, 7); x.arc((nx + SIZE) % SIZE, i * ph + ph * 0.7, 3, 0, 7); x.fill(); }
    }
    noiseFill(x, SIZE, rnd, 0, 10, 2);
  },
  metal(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#9aa3ad'; x.fillRect(0, 0, SIZE, SIZE);
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 25, 'rgba(60,70,80,A)', 20, 70, 0.15);
    noiseFill(x, SIZE, rnd, 0, 12, 1);
    const s = SIZE / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      y.fillStyle = '#9a9a9a'; y.fillRect(i * s + 6, j * s + 6, s - 12, s - 12);
      x.strokeStyle = 'rgba(40,45,50,.6)'; x.lineWidth = 4; x.strokeRect(i * s + 2, j * s + 2, s - 4, s - 4);
      for (const [rx, ry] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14]]) {
        x.fillStyle = '#c4ccd4'; x.beginPath(); x.arc(i * s + rx, j * s + ry, 5, 0, 7); x.fill();
        y.fillStyle = '#f0f0f0'; y.beginPath(); y.arc(i * s + rx, j * s + ry, 5, 0, 7); y.fill();
      }
    }
  },
  container(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, SIZE, SIZE);
    const n = 16, w = SIZE / n;
    for (let i = 0; i < n; i++) {
      const g = x.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      g.addColorStop(0, '#d8d8d8'); g.addColorStop(0.3, '#ffffff'); g.addColorStop(0.7, '#f0f0f0'); g.addColorStop(1, '#bdbdbd');
      x.fillStyle = g; x.fillRect(i * w, 0, w, SIZE);
      const gh = y.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      gh.addColorStop(0, '#404040'); gh.addColorStop(0.5, '#c0c0c0'); gh.addColorStop(1, '#404040');
      y.fillStyle = gh; y.fillRect(i * w, 0, w, SIZE);
    }
    blotches(x, SIZE, rnd, 30, 'rgba(120,80,50,A)', 10, 50, 0.12);
    noiseFill(x, SIZE, rnd, 0, 8, 2);
  },
  brick(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#b8b0a4'; x.fillRect(0, 0, SIZE, SIZE);
    y.fillStyle = '#303030'; y.fillRect(0, 0, SIZE, SIZE);
    const rows = 8, bh = SIZE / rows, bw = SIZE / 4;
    for (let r = 0; r < rows; r++) for (let i = -1; i < 5; i++) {
      const ox = (r % 2) * bw / 2;
      const t = rnd();
      x.fillStyle = `rgb(${Math.round(190 + t * 40)},${Math.round(90 + t * 30)},${Math.round(70 + t * 20)})`;
      x.fillRect(i * bw + ox + 3, r * bh + 3, bw - 6, bh - 6);
      y.fillStyle = '#b0b0b0'; y.fillRect(i * bw + ox + 4, r * bh + 4, bw - 8, bh - 8);
    }
    noiseFill(x, SIZE, rnd, 0, 16, 2);
  },
  plaster(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#f1ece4'; x.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 40, 'rgba(180,170,150,A)', 30, 100, 0.12);
    noiseFill(x, SIZE, rnd, 0, 10, 1);
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    noiseFill(y, SIZE, rnd, 0, 40, 2);
  },
  grate(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#2b2f36'; x.fillRect(0, 0, SIZE, SIZE);
    y.fillStyle = '#202020'; y.fillRect(0, 0, SIZE, SIZE);
    const n = 16, s = SIZE / n;
    for (let i = 0; i <= n; i++) {
      x.fillStyle = '#6d7682'; x.fillRect(i * s - 4, 0, 8, SIZE); x.fillRect(0, i * s - 4, SIZE, 8);
      y.fillStyle = '#e0e0e0'; y.fillRect(i * s - 4, 0, 8, SIZE); y.fillRect(0, i * s - 4, SIZE, 8);
    }
    noiseFill(x, SIZE, rnd, 0, 10, 2);
  },
  rubber(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#6fb7a8'; x.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 1800; i++) {
      x.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.25)' : 'rgba(0,40,40,.2)';
      x.fillRect(rnd() * SIZE, rnd() * SIZE, 3, 3);
    }
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    noiseFill(y, SIZE, rnd, 0, 50, 2);
  },
  sand(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#e8d3a2'; x.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 40, 'rgba(190,160,110,A)', 20, 80, 0.2);
    noiseFill(x, SIZE, rnd, 0, 20, 1);
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    noiseFill(y, SIZE, rnd, 0, 50, 1);
  },
  grass(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#5fb24a'; x.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 50, 'rgba(40,110,40,A)', 20, 70, 0.25);
    blotches(x, SIZE, rnd, 30, 'rgba(180,230,90,A)', 10, 50, 0.2);
    for (let i = 0; i < 4000; i++) {
      x.strokeStyle = rnd() > 0.5 ? 'rgba(30,90,30,.35)' : 'rgba(170,230,110,.35)';
      const px = rnd() * SIZE, py = rnd() * SIZE;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 4, py - 6 - rnd() * 6); x.stroke();
    }
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    noiseFill(y, SIZE, rnd, 0, 60, 1);
  },
  murk(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#4d4a5c'; x.fillRect(0, 0, SIZE, SIZE);
    blotches(x, SIZE, rnd, 40, 'rgba(30,20,50,A)', 20, 90, 0.25);
    noiseFill(x, SIZE, rnd, 0, 14, 1);
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    const s = SIZE / 4;
    x.strokeStyle = 'rgba(20,15,30,.6)'; x.lineWidth = 4;
    y.fillStyle = '#404040';
    for (let i = 0; i < 4; i++) { x.strokeRect(0, i * s, SIZE, s); y.fillRect(0, i * s, SIZE, 4); }
    // hazard stripes band
    x.save(); x.beginPath(); x.rect(0, SIZE - 40, SIZE, 40); x.clip();
    for (let i = -2; i < 20; i++) { x.fillStyle = i % 2 ? '#1c1a22' : '#e0b400'; x.beginPath(); x.moveTo(i * 40, SIZE); x.lineTo(i * 40 + 40, SIZE - 40); x.lineTo(i * 40 + 80, SIZE - 40); x.lineTo(i * 40 + 40, SIZE); x.fill(); }
    x.restore();
  },
  glass(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    const g = x.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, '#9fd8ff'); g.addColorStop(1, '#4d8fd1');
    x.fillStyle = g; x.fillRect(0, 0, SIZE, SIZE);
    x.fillStyle = '#2c3440';
    for (let i = 0; i <= 4; i++) { x.fillRect(i * SIZE / 4 - 6, 0, 12, SIZE); x.fillRect(0, i * SIZE / 4 - 6, SIZE, 12); }
    y.fillStyle = '#808080'; y.fillRect(0, 0, SIZE, SIZE);
    void rnd;
  },
  sponge(c, h, rnd) {
    const x = c.getContext('2d'), y = h.getContext('2d');
    x.fillStyle = '#f2e27a'; x.fillRect(0, 0, SIZE, SIZE);
    y.fillStyle = '#c0c0c0'; y.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 260; i++) {
      const px = rnd() * SIZE, py = rnd() * SIZE, r = 4 + rnd() * 14;
      x.fillStyle = 'rgba(170,140,40,.55)'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      y.fillStyle = '#303030'; y.beginPath(); y.arc(px, py, r, 0, 7); y.fill();
    }
  },
};

/** Surface definitions: texture painter, metres per texture repeat and PBR values. */
export const SURFACES = {
  concrete: { painter: 'concrete', scale: 4, roughness: 0.86, metalness: 0.0, normal: 1.2 },
  tiles: { painter: 'tiles', scale: 3, roughness: 0.6, metalness: 0.0, normal: 1.0 },
  asphalt: { painter: 'asphalt', scale: 5, roughness: 0.92, metalness: 0.0, normal: 0.8 },
  wood: { painter: 'wood', scale: 3, roughness: 0.8, metalness: 0.0, normal: 1.4 },
  metal: { painter: 'metal', scale: 2.5, roughness: 0.45, metalness: 0.55, normal: 1.4 },
  container: { painter: 'container', scale: 2.4, roughness: 0.55, metalness: 0.3, normal: 2.2 },
  brick: { painter: 'brick', scale: 2, roughness: 0.85, metalness: 0.0, normal: 1.6 },
  plaster: { painter: 'plaster', scale: 4, roughness: 0.9, metalness: 0.0, normal: 0.6 },
  grate: { painter: 'grate', scale: 1.5, roughness: 0.5, metalness: 0.6, normal: 2, paint: false },
  rubber: { painter: 'rubber', scale: 3, roughness: 0.95, metalness: 0.0, normal: 0.8 },
  sand: { painter: 'sand', scale: 5, roughness: 0.95, metalness: 0.0, normal: 0.8 },
  grass: { painter: 'grass', scale: 3, roughness: 0.95, metalness: 0.0, normal: 1.0 },
  murk: { painter: 'murk', scale: 3, roughness: 0.6, metalness: 0.35, normal: 1.2 },
  glass: { painter: 'glass', scale: 4, roughness: 0.08, metalness: 0.2, normal: 0.2, paint: false },
  sponge: { painter: 'sponge', scale: 2, roughness: 0.95, metalness: 0.0, normal: 2.0 },
};

export function surfaceTextures(key) {
  if (cache.has(key)) return cache.get(key);
  const def = SURFACES[key] || SURFACES.concrete;
  const c = canvas(), h = canvas();
  const rnd = mulberry(hash(key));
  (PAINTERS[def.painter] || PAINTERS.concrete)(c, h, rnd);
  const out = { map: toTexture(c, true), normalMap: toTexture(normalFromHeight(h, 3.0), false), def };
  out.map.userData.cached = true; out.normalMap.userData.cached = true;   // shared across sessions
  cache.set(key, out);
  return out;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Radial soft sprite (for particles, glows). */
export function softSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const key = `sprite:${inner}:${outer}:${size}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.cached = true;
  cache.set(key, t);
  return t;
}
