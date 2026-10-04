/* =========================================================
   Visual effects: GPU point particles, shockwave rings,
   additive flashes, tracer beams, ground decals,
   floating damage numbers.  Everything is pooled.
   ========================================================= */
import * as THREE from 'three';

const TMP = new THREE.Vector3();

/* ---------------------------------------------------------
   Particle field
   --------------------------------------------------------- */
const PARTICLE_VS = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * (340.0 / max(0.001, -mv.z)), 1.0, 220.0);
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FS = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  float a = smoothstep(0.25, 0.02, d2);
  float core = smoothstep(0.06, 0.0, d2);
  gl_FragColor = vec4(vColor + core * 0.55, vAlpha * a);
}`;

class ParticleField {
  constructor(scene, max = 4200) {
    this.max = max;
    this.count = 0;

    // simulation arrays
    this.px = new Float32Array(max); this.py = new Float32Array(max); this.pz = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.cr = new Float32Array(max); this.cg = new Float32Array(max); this.cb = new Float32Array(max);
    this.cr2 = new Float32Array(max); this.cg2 = new Float32Array(max); this.cb2 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.bounce = new Uint8Array(max);
    this.a0 = new Float32Array(max);

    // render buffers
    const geo = new THREE.BufferGeometry();
    this.bPos = new Float32Array(max * 3);
    this.bCol = new Float32Array(max * 3);
    this.bSize = new Float32Array(max);
    this.bAlpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.bPos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.bCol, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.bSize, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.bAlpha, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
    scene.add(this.points);
    this.geo = geo;
  }

  spawn(o) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z;
    this.vx[i] = o.vx; this.vy[i] = o.vy; this.vz[i] = o.vz;
    this.maxLife[i] = o.life; this.life[i] = o.life;
    this.s0[i] = o.size0; this.s1[i] = o.size1 ?? o.size0 * 0.2;
    this.cr[i] = o.r; this.cg[i] = o.g; this.cb[i] = o.b;
    this.cr2[i] = o.r2 ?? o.r; this.cg2[i] = o.g2 ?? o.g; this.cb2[i] = o.b2 ?? o.b;
    this.grav[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0.9;
    this.bounce[i] = o.bounce ? 1 : 0;
    this.a0[i] = o.alpha ?? 1;
  }

  update(dt) {
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --n;
        if (j !== i) this._copy(j, i);
        i--;
        continue;
      }
      const d = Math.pow(this.drag[i], dt * 60);
      this.vx[i] *= d; this.vz[i] *= d;
      this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.bounce[i] && this.py[i] < 0.06) {
        this.py[i] = 0.06;
        this.vy[i] = Math.abs(this.vy[i]) * 0.34;
        this.vx[i] *= 0.7; this.vz[i] *= 0.7;
      }
    }
    this.count = n;

    for (let i = 0; i < n; i++) {
      const t = 1 - this.life[i] / this.maxLife[i];   // 0 -> 1
      const i3 = i * 3;
      this.bPos[i3] = this.px[i]; this.bPos[i3 + 1] = this.py[i]; this.bPos[i3 + 2] = this.pz[i];
      this.bCol[i3] = this.cr[i] + (this.cr2[i] - this.cr[i]) * t;
      this.bCol[i3 + 1] = this.cg[i] + (this.cg2[i] - this.cg[i]) * t;
      this.bCol[i3 + 2] = this.cb[i] + (this.cb2[i] - this.cb[i]) * t;
      this.bSize[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      const fade = t < 0.12 ? t / 0.12 : (1 - (t - 0.12) / 0.88);
      this.bAlpha[i] = this.a0[i] * Math.max(0, fade);
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  _copy(from, to) {
    const A = ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'maxLife', 's0', 's1',
      'cr', 'cg', 'cb', 'cr2', 'cg2', 'cb2', 'grav', 'drag', 'bounce', 'a0'];
    for (const k of A) this[k][to] = this[k][from];
  }

  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}

/* ---------------------------------------------------------
   Shockwave rings
   --------------------------------------------------------- */
class RingPool {
  constructor(scene, size = 40) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.72, 1.0, 40);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false; m.renderOrder = 10; m.frustumCulled = false;
      scene.add(m);
      this.items.push({ mesh: m, t: 0, dur: 0, r0: 0, r1: 1, a0: 1, tilt: 0 });
    }
  }
  spawn(x, y, z, { color = 0xffffff, r0 = 0.2, r1 = 3, dur = 0.4, alpha = 0.9, vertical = false } = {}) {
    let it = this.items.find(i => !i.mesh.visible);
    if (!it) it = this.items[0];
    it.mesh.visible = true;
    it.mesh.position.set(x, y, z);
    it.mesh.rotation.set(vertical ? Math.PI / 2 : 0, 0, 0);
    it.mesh.material.color.setHex(color);
    it.t = 0; it.dur = dur; it.r0 = r0; it.r1 = r1; it.a0 = alpha;
    it.mesh.scale.setScalar(r0);
    it.mesh.material.opacity = alpha;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const p = it.t / it.dur;
      if (p >= 1) { it.mesh.visible = false; continue; }
      const e = 1 - Math.pow(1 - p, 3);
      it.mesh.scale.setScalar(it.r0 + (it.r1 - it.r0) * e);
      it.mesh.material.opacity = it.a0 * (1 - p) * (1 - p);
    }
  }
  clear() { for (const it of this.items) it.mesh.visible = false; }
}

/* ---------------------------------------------------------
   Additive billboard flashes (muzzle, glow pops)
   --------------------------------------------------------- */
function makeGlowTexture() {
  const s = 128;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class FlashPool {
  constructor(scene, size = 60) {
    this.tex = makeGlowTexture();
    this.items = [];
    for (let i = 0; i < size; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex, color: 0xffffff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false; s.renderOrder = 14; s.frustumCulled = false;
      scene.add(s);
      this.items.push({ sprite: s, t: 0, dur: 0.14, s0: 1, s1: 2, a0: 1 });
    }
  }
  spawn(x, y, z, { color = 0xffffff, size = 1.2, grow = 1.6, dur = 0.14, alpha = 1 } = {}) {
    let it = this.items.find(i => !i.sprite.visible);
    if (!it) it = this.items[0];
    it.sprite.visible = true;
    it.sprite.position.set(x, y, z);
    it.sprite.material.color.setHex(color);
    it.t = 0; it.dur = dur; it.s0 = size; it.s1 = size * grow; it.a0 = alpha;
    it.sprite.scale.setScalar(size);
    it.sprite.material.opacity = alpha;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.sprite.visible) continue;
      it.t += dt;
      const p = it.t / it.dur;
      if (p >= 1) { it.sprite.visible = false; continue; }
      it.sprite.scale.setScalar(it.s0 + (it.s1 - it.s0) * p);
      it.sprite.material.opacity = it.a0 * (1 - p);
    }
  }
  clear() { for (const it of this.items) it.sprite.visible = false; }
}

/* ---------------------------------------------------------
   Tracer beams
   --------------------------------------------------------- */
class BeamPool {
  constructor(scene, size = 24) {
    this.items = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0.5, 0, 0);
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false; m.renderOrder = 11; m.frustumCulled = false;
      scene.add(m);
      this.items.push({ mesh: m, t: 0, dur: 0.1, a0: 1, w: 0.2 });
    }
  }
  spawn(x0, y, z0, x1, z1, { color = 0xffffff, width = 0.2, dur = 0.1, alpha = 0.9 } = {}) {
    let it = this.items.find(i => !i.mesh.visible);
    if (!it) it = this.items[0];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    it.mesh.visible = true;
    it.mesh.position.set(x0, y, z0);
    it.mesh.rotation.y = -Math.atan2(dz, dx);
    it.mesh.scale.set(len, 1, width);
    it.mesh.material.color.setHex(color);
    it.t = 0; it.dur = dur; it.a0 = alpha; it.w = width;
    it.mesh.material.opacity = alpha;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const p = it.t / it.dur;
      if (p >= 1) { it.mesh.visible = false; continue; }
      it.mesh.material.opacity = it.a0 * (1 - p);
      it.mesh.scale.z = it.w * (1 - p * 0.6);
    }
  }
  clear() { for (const it of this.items) it.mesh.visible = false; }
}

/* ---------------------------------------------------------
   Ground decals (scorch / splat)
   --------------------------------------------------------- */
function makeSplatTexture(seed = 1) {
  const s = 128;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  let rnd = seed * 9301;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  g.clearRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * s * 0.32;
    const r = s * (0.06 + rand() * 0.14);
    const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class DecalPool {
  constructor(scene, size = 46) {
    this.textures = [makeSplatTexture(3), makeSplatTexture(11), makeSplatTexture(29)];
    this.items = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures[i % 3], color: 0xffffff, transparent: true,
        opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false; m.renderOrder = 2; m.frustumCulled = false;
      scene.add(m);
      this.items.push({ mesh: m, t: 0, dur: 8, a0: 0.5 });
    }
    this.next = 0;
  }
  spawn(x, z, { color = 0x3a1020, size = 1.4, dur = 9, alpha = 0.55 } = {}) {
    const it = this.items[this.next % this.items.length];
    this.next++;
    it.mesh.visible = true;
    it.mesh.position.set(x, 0.035, z);
    it.mesh.rotation.y = Math.random() * Math.PI * 2;
    it.mesh.scale.set(size, 1, size);
    it.mesh.material.color.setHex(color);
    it.mesh.material.map = this.textures[(Math.random() * 3) | 0];
    it.t = 0; it.dur = dur; it.a0 = alpha;
    it.mesh.material.opacity = alpha;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.t += dt;
      const p = it.t / it.dur;
      if (p >= 1) { it.mesh.visible = false; continue; }
      it.mesh.material.opacity = it.a0 * Math.min(1, (1 - p) * 3);
    }
  }
  clear() { for (const it of this.items) it.mesh.visible = false; }
}

/* ---------------------------------------------------------
   Floating damage numbers
   --------------------------------------------------------- */
const numberTexCache = new Map();

function numberTexture(text, style) {
  const key = text + '|' + style;
  const hit = numberTexCache.get(key);
  if (hit) return hit;

  const big = style === 'crit' || style === 'player';
  const fs = big ? 84 : 62;
  const pad = 22;
  const c = document.createElement('canvas');
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `900 ${fs}px "Segoe UI", sans-serif`;
  const w = Math.ceil(measure.measureText(text).width) + pad * 2;
  c.width = Math.max(64, w); c.height = fs + pad * 2;
  const g = c.getContext('2d');
  g.font = `900 ${fs}px "Segoe UI", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';

  const fills = {
    normal: ['#ffffff', '#c9c2d6'],
    crit: ['#ffe680', '#f2a03d'],
    player: ['#ff8a9a', '#c62c47'],
    heal: ['#c8ffa6', '#5aa53f'],
    poison: ['#c8ff5a', '#6fae1f'],
    elemental: ['#a8e9ff', '#3ba9d6'],
    material: ['#ffd772', '#c98a1c'],
  };
  const [c1, c2] = fills[style] || fills.normal;
  const grad = g.createLinearGradient(0, pad, 0, c.height - pad);
  grad.addColorStop(0, c1); grad.addColorStop(1, c2);

  g.lineWidth = big ? 11 : 9;
  g.strokeStyle = 'rgba(0,0,0,0.92)';
  g.lineJoin = 'round';
  g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = grad;
  g.fillText(text, c.width / 2, c.height / 2);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.aspect = c.width / c.height;
  if (numberTexCache.size > 320) {
    const first = numberTexCache.keys().next().value;
    const old = numberTexCache.get(first);
    old.dispose();
    numberTexCache.delete(first);
  }
  numberTexCache.set(key, t);
  return t;
}

class DamageNumbers {
  constructor(scene, size = 72) {
    this.enabled = true;
    this.items = [];
    for (let i = 0; i < size; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.visible = false; s.renderOrder = 30; s.frustumCulled = false;
      scene.add(s);
      this.items.push({ sprite: s, t: 0, dur: 0.9, vx: 0, vy: 0, vz: 0, scale: 1 });
    }
    this.next = 0;
  }
  spawn(x, y, z, text, style = 'normal', scale = 1) {
    if (!this.enabled) return;
    const it = this.items[this.next % this.items.length];
    this.next++;
    const tex = numberTexture(String(text), style);
    it.sprite.material.map = tex;
    it.sprite.material.needsUpdate = true;
    it.sprite.visible = true;
    it.sprite.position.set(x + (Math.random() - 0.5) * 0.5, y, z + (Math.random() - 0.5) * 0.5);
    const s = (style === 'crit' ? 0.78 : 0.56) * scale;
    it.scale = s;
    it.sprite.scale.set(s * 1.1 * (tex.aspect || 1.6), s * 1.1, 1);
    it.t = 0;
    it.dur = style === 'crit' ? 1.05 : 0.82;
    it.vx = (Math.random() - 0.5) * 1.6;
    it.vy = 3.0 + Math.random() * 1.0;
    it.vz = (Math.random() - 0.5) * 1.6;
    it.sprite.material.opacity = 1;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.sprite.visible) continue;
      it.t += dt;
      const p = it.t / it.dur;
      if (p >= 1) { it.sprite.visible = false; continue; }
      it.vy -= 8.5 * dt;
      it.sprite.position.x += it.vx * dt;
      it.sprite.position.y += it.vy * dt;
      it.sprite.position.z += it.vz * dt;
      const pop = p < 0.14 ? 1 + (0.14 - p) * 2.4 : 1;
      const tex = it.sprite.material.map;
      it.sprite.scale.set(it.scale * 1.1 * pop * (tex?.aspect || 1.6), it.scale * 1.1 * pop, 1);
      it.sprite.material.opacity = p > 0.62 ? (1 - p) / 0.38 : 1;
    }
  }
  clear() { for (const it of this.items) it.sprite.visible = false; }
}

/* ---------------------------------------------------------
   Facade
   --------------------------------------------------------- */
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.particles = new ParticleField(scene);
    this.rings = new RingPool(scene);
    this.flashes = new FlashPool(scene);
    this.beams = new BeamPool(scene);
    this.decals = new DecalPool(scene);
    this.numbers = new DamageNumbers(scene);
    this.shake = 0;
    this.shakeDecay = 5.4;
    this.hitStop = 0;
    this.quality = 1;      // 0.5 low, 1 normal, 1.4 high
    this.shakeEnabled = true;
  }

  update(dt) {
    this.particles.update(dt);
    this.rings.update(dt);
    this.flashes.update(dt);
    this.beams.update(dt);
    this.decals.update(dt);
    this.numbers.update(dt);
    this.shake = Math.max(0, this.shake - this.shakeDecay * dt * (1 + this.shake));
  }

  clear() {
    this.particles.clear(); this.rings.clear(); this.flashes.clear();
    this.beams.clear(); this.decals.clear(); this.numbers.clear();
    this.shake = 0; this.hitStop = 0;
  }

  addShake(v) { if (this.shakeEnabled) this.shake = Math.min(1.6, this.shake + v); }
  addHitStop(v) { this.hitStop = Math.max(this.hitStop, v); }

  /* ---- composite effects ---- */

  burst(x, y, z, opts = {}) {
    const {
      count = 12, color = 0xffffff, color2 = null, speed = 5, spread = 1,
      size = 0.34, life = 0.5, gravity = -9, drag = 0.9, upBias = 0.5, bounce = false, alpha = 1,
    } = opts;
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(color2 ?? color).multiplyScalar(0.35);
    const n = Math.max(1, Math.round(count * this.quality));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() * 0.9 + upBias * 0.6) * spread;
      const sp = speed * (0.45 + Math.random() * 0.85);
      this.particles.spawn({
        x, y, z,
        vx: Math.cos(a) * sp, vy: el * sp * 0.7, vz: Math.sin(a) * sp,
        life: life * (0.6 + Math.random() * 0.8),
        size0: size * (0.65 + Math.random() * 0.75), size1: size * 0.12,
        r: c1.r, g: c1.g, b: c1.b, r2: c2.r, g2: c2.g, b2: c2.b,
        gravity, drag, bounce, alpha,
      });
    }
  }

  spray(x, y, z, dx, dz, opts = {}) {
    const {
      count = 6, color = 0xffffff, color2 = null, speed = 8, cone = 0.5,
      size = 0.25, life = 0.34, gravity = -2, drag = 0.86,
    } = opts;
    const c1 = new THREE.Color(color);
    const c2 = new THREE.Color(color2 ?? color).multiplyScalar(0.3);
    const base = Math.atan2(dz, dx);
    const n = Math.max(1, Math.round(count * this.quality));
    for (let i = 0; i < n; i++) {
      const a = base + (Math.random() - 0.5) * cone;
      const sp = speed * (0.5 + Math.random() * 0.9);
      this.particles.spawn({
        x, y, z,
        vx: Math.cos(a) * sp, vy: (Math.random() - 0.3) * 1.6, vz: Math.sin(a) * sp,
        life: life * (0.6 + Math.random() * 0.8),
        size0: size * (0.7 + Math.random() * 0.7), size1: size * 0.1,
        r: c1.r, g: c1.g, b: c1.b, r2: c2.r, g2: c2.g, b2: c2.b,
        gravity, drag,
      });
    }
  }

  trail(x, y, z, color, size = 0.16, life = 0.22) {
    if (this.quality < 0.8 && Math.random() < 0.5) return;
    const c = new THREE.Color(color);
    this.particles.spawn({
      x, y, z,
      vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.2) * 0.7, vz: (Math.random() - 0.5) * 0.7,
      life, size0: size, size1: 0.01,
      r: c.r, g: c.g, b: c.b, r2: c.r * 0.2, g2: c.g * 0.2, b2: c.b * 0.2,
      gravity: 0.6, drag: 0.9, alpha: 0.85,
    });
  }

  hitSpark(x, y, z, color = 0xffe9a8, big = false) {
    this.burst(x, y, z, {
      count: big ? 16 : 8, color, color2: 0x552200,
      speed: big ? 9 : 6, size: big ? 0.3 : 0.22, life: 0.3, gravity: -12, upBias: 0.8,
    });
    this.flashes.spawn(x, y, z, { color, size: big ? 1.6 : 0.9, grow: 2.1, dur: big ? 0.16 : 0.1 });
  }

  explosion(x, y, z, radius, color = 0xffa53d, color2 = 0x7a1e00) {
    this.rings.spawn(x, 0.09, z, { color, r0: radius * 0.25, r1: radius * 1.15, dur: 0.38, alpha: 0.95 });
    this.rings.spawn(x, 0.09, z, { color: 0xffffff, r0: radius * 0.1, r1: radius * 0.7, dur: 0.2, alpha: 0.9 });
    this.flashes.spawn(x, y + 0.4, z, { color, size: radius * 1.3, grow: 1.9, dur: 0.2 });
    this.burst(x, y + 0.3, z, {
      count: 34, color, color2, speed: radius * 3.4, size: 0.45, life: 0.62,
      gravity: -10, upBias: 0.9, bounce: true,
    });
    this.burst(x, y + 0.2, z, {
      count: 16, color: 0x333333, color2: 0x111111, speed: radius * 1.6,
      size: 0.7, life: 0.9, gravity: 1.5, drag: 0.82, alpha: 0.55,
    });
    this.decals.spawn(x, z, { color: 0x1a0d08, size: radius * 1.5, dur: 7, alpha: 0.6 });
    this.addShake(Math.min(0.5, radius * 0.1));
  }

  spawnPuff(x, y, z, color) {
    this.burst(x, y, z, { count: 14, color, color2: 0x000000, speed: 3.2, size: 0.4, life: 0.55, gravity: 1.2, drag: 0.85, alpha: 0.7 });
    this.rings.spawn(x, 0.08, z, { color, r0: 0.2, r1: 1.5, dur: 0.35, alpha: 0.55 });
  }

  levelUpBurst(x, y, z) {
    this.rings.spawn(x, 0.1, z, { color: 0x8ee36a, r0: 0.4, r1: 5.2, dur: 0.7, alpha: 1 });
    this.rings.spawn(x, 0.1, z, { color: 0xffffff, r0: 0.2, r1: 3.2, dur: 0.45, alpha: 0.85 });
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.8;
      this.particles.spawn({
        x: x + Math.cos(a) * r, y: y - 0.4, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * 0.7, vy: 5 + Math.random() * 5, vz: Math.sin(a) * 0.7,
        life: 0.9 + Math.random() * 0.5, size0: 0.34, size1: 0.02,
        r: 0.56, g: 0.89, b: 0.42, r2: 1, g2: 1, b2: 0.7,
        gravity: -1.2, drag: 0.97,
      });
    }
  }
}

export { TMP };
