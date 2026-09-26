// Procedural NPC models: Commodore Brine (mantis shrimp), Pix (jellyfish DJ), Shelly (hermit crab),
// Otto & Tilly (sea-otter judges), Baron Murkwell (anglerfish tycoon), Foreman Dredge (Murk
// foreman) and Squidkin kids (Kai / random kids via SquidkinModel).
//
//   const m = makeNpcModel('brine', { session });   // root: feet at the origin, facing +Z
//   scene.add(m.root);
//   per frame: m.update(dt, { talking })            // idle bob, blink, talk gestures, emotes
//   m.emote('wave' | 'cheer' | 'laugh' | 'angry' | 'sad' | 'nod' | 'bow', secs)
//   m.setMood('angry')      // Murkwell's lure blazes; others react
//   m.lookAt(vec3 | null)   // head turns toward a world point
//   m.dispose()
//
// Also used by story cutscenes and boss agents (Dredge in The Grinder, Murkwell in the Mech).
import * as THREE from 'three';
import { charMat } from '../../actors/materials.js';
import { SquidkinModel } from '../../actors/squidkin-model.js';

// ---- shared geometry (never disposed) --------------------------------------------------------
const GEO = new Map();
function geo(key, make) { let g = GEO.get(key); if (!g) { g = make(); GEO.set(key, g); } return g; }
const G = {
  sphere: (r, w = 22, h = 16) => geo(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h)),
  dome: (r, frac = 0.5, w = 26) => geo(`d${r}|${frac}|${w}`, () => new THREE.SphereGeometry(r, w, 12, 0, Math.PI * 2, 0, Math.PI * frac)),
  capsule: (r, len) => geo(`c${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14)),
  capsuleDown: (r, len) => geo(`cd${r}|${len}`, () => { const g = new THREE.CapsuleGeometry(r, len, 6, 14); g.translate(0, -len / 2, 0); return g; }),
  cyl: (rt, rb, h, seg = 20, open = false, ts = 0, tl = Math.PI * 2) => geo(`y${rt}|${rb}|${h}|${seg}|${open}|${ts}|${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl)),
  cone: (r, h, seg = 12) => geo(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  torus: (R, r, arc = Math.PI * 2, ts = 28) => geo(`t${R}|${r}|${arc}|${ts}`, () => new THREE.TorusGeometry(R, r, 10, ts, arc)),
  box: (w, h, d) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)),
  plane: (w, h) => geo(`p${w}|${h}`, () => new THREE.PlaneGeometry(w, h)),
};

function mesh(g, m, parent, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const o = new THREE.Mesh(g, m);
  o.position.fromArray(p);
  o.rotation.set(r[0], r[1], r[2]);
  if (typeof s === 'number') o.scale.setScalar(s); else o.scale.fromArray(s);
  o.castShadow = true;
  parent.add(o);
  return o;
}

function group(parent, p = [0, 0, 0], r = [0, 0, 0]) {
  const g = new THREE.Group();
  g.position.fromArray(p);
  g.rotation.set(r[0], r[1], r[2]);
  parent.add(g);
  return g;
}

let GLOW_TEX = null;
function glowTexture() {
  if (GLOW_TEX) return GLOW_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  GLOW_TEX = new THREE.CanvasTexture(c);
  GLOW_TEX.colorSpace = THREE.SRGBColorSpace;
  return GLOW_TEX;
}

const STRIPES = {};
function stripeTexture(a = '#f4f4f4', b = '#16141f', n = 14) {
  const k = a + b + n;
  if (STRIPES[k]) return STRIPES[k];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 8;
  const x = c.getContext('2d');
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * 256) / n, 0, 256 / n + 1, 8); }
  const t = STRIPES[k] = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------
class NpcBase {
  constructor(who, o = {}) {
    this.who = who;
    this.o = o;
    this.root = new THREE.Group();
    this.root.name = 'npc-' + who;
    this.rig = group(this.root);
    this.t = Math.random() * 10;
    this.talkAmt = 0;
    this.talking = false;
    this.blinkT = 1 + Math.random() * 3;
    this.eyes = [];
    this.emoteName = null;
    this.emoteT = 0;
    this.emoteDur = 1;
    this.mood = 'neutral';
    this.mats = [];
    this.own = [];
    this.lookTarget = null;
    this.headYaw = 0;
    this.headPitch = 0;
    this.walking = false;
    this.height = 1.5;
  }

  mat(color, o = {}) { const m = charMat(color, o); this.mats.push(m); return m; }
  basic(color, o = {}) { const m = new THREE.MeshBasicMaterial({ color, ...o }); this.mats.push(m); return m; }
  glow(color, k = 2.2, o = {}) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false, ...o });
    this.mats.push(m);
    return m;
  }
  halo(parent, color, size, opacity = 0.6) {
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mats.push(m);
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    parent.add(s);
    return s;
  }
  tube(points, r, mat, parent, segs = 24) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3().fromArray(p)));
    const g = new THREE.TubeGeometry(curve, segs, r, 8, false);
    this.own.push(g);
    return mesh(g, mat, parent);
  }

  /** Cartoon eye: white + iris + pupil + shine, facing +Z of `parent`. Blinks via scale.y. */
  eye(parent, p, r, o = {}) {
    const e = group(parent, p, o.rot || [0, 0, 0]);
    const white = o.white || this._white || (this._white = this.mat('#ffffff', { roughness: 0.25, rim: 0.05 }));
    mesh(G.sphere(r, 18, 14), white, e, [0, 0, 0], [0, 0, 0], [1, o.tall ?? 1.15, o.flat ?? 0.6]);
    const irisM = o.irisMat || this.mat(o.iris || '#2b1d14', { roughness: 0.2, rim: 0 });
    mesh(G.sphere(r * 0.62, 16, 12), irisM, e, [0, 0, r * 0.38], [0, 0, 0], [1, 1.1, 0.5]);
    const pup = this._pupil || (this._pupil = this.mat('#07050d', { roughness: 0.1, rim: 0 }));
    mesh(G.sphere(r * 0.32, 12, 10), pup, e, [0, 0, r * 0.52], [0, 0, 0], [1, 1.1, 0.5]);
    const shine = this._shine || (this._shine = this.basic('#ffffff'));
    mesh(G.sphere(r * 0.16, 8, 6), shine, e, [-r * 0.22, r * 0.3, r * 0.6]);
    e.userData.sy = 1;
    this.eyes.push(e);
    return e;
  }

  /** 0..1 envelope for the named emote (0 when another / none is playing). */
  ek(name) {
    if (this.emoteName !== name) return 0;
    return Math.max(0, Math.min(1, this.emoteT * 4, (this.emoteDur - this.emoteT) * 5));
  }

  emote(name, secs = 2.5) { this.emoteName = name; this.emoteT = secs; this.emoteDur = secs; }
  setMood(m) { this.mood = m || 'neutral'; }
  lookAt(p) { this.lookTarget = p ? (p.isVector3 ? p.clone() : new THREE.Vector3().fromArray(p)) : null; }

  update(dt, s = {}) {
    this.t += dt;
    const talking = !!(s.talking ?? this.talking);
    this.talkAmt += ((talking ? 1 : 0) - this.talkAmt) * Math.min(1, dt * 10);
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 1.8 + Math.random() * 3.4;
    const b = this.blinkT < 0.11 ? 0.1 : 1;
    for (const e of this.eyes) e.scale.y = b * e.userData.sy;
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emoteName = null; }
    // head look (local yaw relative to the root)
    let yaw = 0, pitch = 0;
    if (this.lookTarget && this.head) {
      this.root.updateMatrixWorld();
      this.head.getWorldPosition(_v);
      const dx = this.lookTarget.x - _v.x, dz = this.lookTarget.z - _v.z, dy = this.lookTarget.y - _v.y;
      const ry = this.root.getWorldQuaternion(_q);
      const worldYaw = Math.atan2(dx, dz);
      const rootYaw = _e.setFromQuaternion(ry, 'YXZ').y;
      yaw = Math.atan2(Math.sin(worldYaw - rootYaw), Math.cos(worldYaw - rootYaw));
      yaw = Math.max(-0.9, Math.min(0.9, yaw));
      pitch = Math.max(-0.4, Math.min(0.4, -Math.atan2(dy, Math.hypot(dx, dz)) * 0.6));
    }
    this.headYaw = lerp(this.headYaw, yaw, Math.min(1, dt * 6));
    this.headPitch = lerp(this.headPitch, pitch, Math.min(1, dt * 6));
    this.animate(dt);
  }

  /** mouth opening 0..1 while talking */
  get mouthOpen() { return this.talkAmt * (0.35 + 0.65 * Math.abs(Math.sin(this.t * 15.5) * Math.sin(this.t * 7.3 + 1))); }

  animate(dt) { void dt; }

  dispose() {
    for (const m of this.mats) m.dispose();
    for (const g of this.own) g.dispose();
    this.mats.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Commodore Brine — mantis shrimp, retired Splashguard captain.
class BrineModel extends NpcBase {
  constructor(o) {
    super('brine', o);
    this.height = 1.78;
    const shell = this.mat('#35b9a4', { roughness: 0.35, rim: 0.4, rimColor: '#c9fff4' });
    const shellD = this.mat('#1f8a7c', { roughness: 0.4, rim: 0.3 });
    const orange = this.mat('#ff7a3d', { roughness: 0.4, rim: 0.35 });
    const blue = this.mat('#3f7dff', { roughness: 0.35, rim: 0.3 });
    const R = this.rig;

    // tail fan on the ground behind
    const fan = group(R, [0, 0.06, -0.26]);
    [-0.7, 0, 0.7].forEach((a, i) => mesh(G.sphere(0.13, 16, 10), i === 1 ? shellD : orange, fan, [Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14], [0, a, 0], [0.8, 0.22, 1.5]));
    [-1.2, 1.2].forEach((a) => mesh(G.sphere(0.1, 14, 8), blue, fan, [Math.sin(a) * 0.16, 0.01, -Math.cos(a) * 0.1], [0, a, 0], [0.7, 0.2, 1.3]));
    // little walking legs
    this.legs = [];
    for (const [x, z] of [[-0.12, 0.08], [0.12, 0.08], [-0.15, -0.08], [0.15, -0.08]]) {
      const hip = group(R, [x, 0.36, z], [0, 0, Math.sign(x) * 0.25]);
      mesh(G.capsuleDown(0.035, 0.26), orange, hip);
      mesh(G.sphere(0.045, 10, 8), orange, hip, [0, -0.33, 0.02], [0, 0, 0], [1, 0.6, 1.4]);
      this.legs.push(hip);
    }
    // abdomen: overlapping armour segments, widening toward the chest
    this.body = group(R, [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const r = 0.19 + i * 0.02;
      mesh(G.sphere(r, 24, 14), i % 2 ? shellD : shell, this.body, [0, 0.4 + i * 0.12, 0.012 * i], [0.06, 0, 0], [1, 0.66, 0.86]);
    }
    // thorax + chest plate
    mesh(G.sphere(0.3, 26, 18), shell, this.body, [0, 0.92, 0.04], [0, 0, 0], [1.05, 0.72, 0.92]);
    mesh(G.sphere(0.2, 20, 12), this.mat('#8fe8d4', { roughness: 0.3, rim: 0.4 }), this.body, [0, 0.9, 0.2], [0, 0, 0], [1, 0.7, 0.45]);
    // head (chibi-sized)
    this.head = group(this.body, [0, 1.06, 0.05]);
    this.head.scale.setScalar(1.28);
    const H = this.headBob = group(this.head);
    mesh(G.sphere(0.24, 26, 18), shell, H, [0, 0.08, 0.02], [0, 0, 0], [1.12, 0.84, 1.0]);
    mesh(G.box(0.02, 0.1, 0.2), shellD, H, [0, 0.2, 0.06], [0.3, 0, 0]);
    mesh(G.cone(0.05, 0.12, 8), shellD, H, [0, 0.02, 0.28], [Math.PI / 2 + 0.4, 0, 0]);
    // scar
    const scarM = this.mat('#e8fff8', { roughness: 0.6, rim: 0.1 });
    [[0.14, 0.14, 0.2, 0.5], [0.16, 0.08, 0.21, -0.4], [0.15, 0.02, 0.22, 0.5]].forEach(([x, y, z, rz]) => mesh(G.box(0.012, 0.07, 0.012), scarM, H, [x, y, z], [0, 0.5, rz]));
    // mustache + mouth
    const stache = this.mat('#f6f4ee', { roughness: 0.9, rim: 0.3 });
    this.stache = [];
    for (const s of [-1, 1]) this.stache.push(mesh(G.capsule(0.035, 0.12), stache, H, [s * 0.075, 0.0, 0.25], [0, 0, s * 1.2], [1, 1, 0.8]));
    this.mouth = mesh(G.sphere(0.04, 12, 8), this.mat('#3a0f1e', { rim: 0 }), H, [0, -0.06, 0.225], [0, 0, 0], [1.2, 0.3, 0.6]);
    // eye stalks + banded eyes
    this.stalks = [];
    for (const s of [-1, 1]) {
      const st = group(H, [s * 0.12, 0.16, 0.14], [-0.25, 0, -s * 0.45]);
      mesh(G.capsuleDown(0.032, 0.12), shellD, st, [0, 0.16, 0], [Math.PI, 0, 0]);
      const eyeG = group(st, [0, 0.2, 0.02], [0.25, s * -0.2, s * 0.45]);
      this.eye(eyeG, [0, 0, 0], 0.075, { iris: '#3f7d2c', white: this.mat('#f2ffd2', { roughness: 0.2, rim: 0.1 }), tall: 1.3, flat: 0.9 });
      mesh(G.torus(0.069, 0.011, Math.PI * 2, 24), shellD, eyeG, [0, -0.012, 0], [Math.PI / 2, 0, 0], [1, 0.9, 1]);
      this.stalks.push(st);
    }
    // captain's hat
    const hat = group(H, [0, 0.25, -0.03], [-0.12, 0, 0.05]);
    hat.scale.setScalar(1.3);
    const navy = this.mat('#1d2554', { roughness: 0.6, rim: 0.3 });
    const gold = this.mat('#f5c542', { roughness: 0.3, metalness: 0.5, rim: 0.3 });
    mesh(G.cyl(0.17, 0.15, 0.1, 24), navy, hat, [0, 0.05, 0]);
    mesh(G.cyl(0.2, 0.18, 0.05, 24), this.mat('#f4f2ea', { roughness: 0.5, rim: 0.2 }), hat, [0, 0.12, -0.01], [-0.08, 0, 0], [1, 1, 1.05]);
    mesh(G.cyl(0.155, 0.155, 0.03, 24), gold, hat, [0, 0.02, 0]);
    mesh(G.cyl(0.19, 0.19, 0.012, 24, false, -Math.PI / 2 - 0.9, 1.8), this.mat('#10132b', { roughness: 0.2, rim: 0.3 }), hat, [0, 0.0, 0.02], [0.15, Math.PI, 0]);
    mesh(G.cyl(0.035, 0.035, 0.01, 12), gold, hat, [0, 0.07, 0.16], [Math.PI / 2 - 0.15, 0, 0]);
    // antennae
    this.antennae = [];
    for (const s of [-1, 1]) {
      const a = group(H, [s * 0.05, 0.06, 0.24]);
      this.tube([[0, 0, 0], [s * 0.08, 0.22, 0.06], [s * 0.2, 0.46, -0.06], [s * 0.34, 0.56, -0.28]], 0.009, orange, a, 20);
      this.antennae.push(a);
    }
    // raptorial "club" arms in a boxer's guard
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = group(this.body, [s * 0.28, 0.9, 0.14], [-0.5, 0, s * 0.25]);
      mesh(G.capsuleDown(0.05, 0.2), orange, sh);
      const el = group(sh, [0, -0.26, 0], [-2.1, 0, 0]);
      mesh(G.capsuleDown(0.045, 0.16), orange, el);
      const club = group(el, [0, -0.24, 0]);
      mesh(G.sphere(0.085, 18, 14), orange, club, [0, 0, 0], [0, 0, 0], [0.95, 1.15, 1]);
      mesh(G.torus(0.08, 0.012, Math.PI * 2, 20), this.mat('#c24a1c', { rim: 0.2 }), club, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
      this.arms.push({ sh, el, club, s });
    }
  }

  animate(dt) {
    const t = this.t, talk = this.talkAmt;
    const breathe = Math.sin(t * 1.8);
    this.body.position.y = breathe * 0.01;
    this.head.rotation.y = this.headYaw;
    this.head.rotation.x = this.headPitch + Math.sin(t * 9) * 0.03 * talk;
    this.headBob.position.y = Math.abs(Math.sin(t * 8)) * 0.015 * talk;
    this.mouth.scale.y = 0.3 + this.mouthOpen * 1.4;
    for (const [i, st] of this.stache.entries()) st.rotation.z = (i ? 1 : -1) * (1.2 + this.mouthOpen * 0.15);
    this.stalks.forEach((st, i) => { st.rotation.z = (i ? -1 : 1) * (0.45 + Math.sin(t * 1.3 + i * 2) * 0.06); });
    this.antennae.forEach((a, i) => { a.rotation.x = Math.sin(t * 2.1 + i) * 0.12; a.rotation.z = Math.sin(t * 1.7 + i * 3) * 0.1; });
    const cheer = this.ek('cheer'), wave = this.ek('wave'), angry = Math.max(this.ek('angry'), this.mood === 'angry' ? 1 : 0);
    const laugh = this.ek('laugh');
    for (const A of this.arms) {
      const jab = talk * Math.max(0, Math.sin(t * 5 + (A.s > 0 ? 0 : 2))) * 0.35;
      let shx = -0.5 - jab - angry * 0.5, elx = -2.1 + jab * 0.8;
      if (cheer) { shx = lerp(shx, -2.7 + Math.sin(t * 10 + A.s) * 0.2, cheer); elx = lerp(elx, -0.4, cheer); }
      if (wave && A.s > 0) { shx = lerp(shx, -2.5, wave); elx = lerp(elx, -0.6 + Math.sin(t * 10) * 0.5, wave); }
      A.sh.rotation.x = shx;
      A.el.rotation.x = elx;
      A.club.rotation.z = angry ? Math.sin(t * 30) * 0.2 * angry : 0;
    }
    this.rig.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * (cheer + laugh);
    if (this.walking) this.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 14 + i * 1.6) * 0.5; });
    else this.legs.forEach((l) => { l.rotation.x *= 0.9; });
    void dt;
  }
}

// ---------------------------------------------------------------------------------------------
// Pix — glowing jellyfish pirate-radio DJ with headphones.
class PixModel extends NpcBase {
  constructor(o) {
    super('pix', o);
    this.height = 1.7;
    const R = this.rig;
    this.float = group(R, [0, 1.15, 0]);
    const bellM = this.bellM = this.mat('#ff7ae0', { roughness: 0.18, rim: 0.9, rimColor: '#ffffff', emissive: '#ff4fd0', emissiveIntensity: 0.5, transparent: true, opacity: 0.84, side: THREE.DoubleSide });
    bellM.depthWrite = false;
    this.bell = group(this.float, [0, 0.12, 0]);
    mesh(G.dome(0.42, 0.56, 30), bellM, this.bell, [0, 0, 0], [0, 0, 0], [1, 0.95, 1]);
    this.core = mesh(G.sphere(0.2, 18, 12), this.glow('#ffc4f2', 1.1, { transparent: true, opacity: 0.55, depthWrite: false }), this.bell, [0, 0.12, 0], [0, 0, 0], [1, 0.8, 1]);
    mesh(G.torus(0.37, 0.035, Math.PI * 2, 36), this.mat('#ffc1f3', { rim: 0.6, emissive: '#ff8ae6', emissiveIntensity: 0.4 }), this.bell, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
    // spots of light
    this.spots = [];
    const spotM = this.glow('#ffffff', 1.4);
    for (const [a, h] of [[0.6, 0.22], [2.2, 0.28], [3.6, 0.18], [4.9, 0.3], [5.7, 0.12], [1.4, 0.34]]) {
      const r = Math.sqrt(Math.max(0, 0.42 * 0.42 - h * h)) * 0.98;
      this.spots.push(mesh(G.sphere(0.014, 8, 6), spotM, this.bell, [Math.sin(a) * r, h * 0.95, Math.cos(a) * r]));
    }
    // face
    this.head = this.bell;
    for (const s of [-1, 1]) this.eye(this.bell, [s * 0.13, 0.2, 0.34], 0.07, { iris: '#3b1a78', rot: [-0.25, s * 0.3, 0] });
    this.mouth = mesh(G.sphere(0.035, 12, 8), this.mat('#4a1250', { rim: 0 }), this.bell, [0, 0.07, 0.395], [0, 0, 0], [1.3, 0.35, 0.5]);
    const blushM = this.mat('#ff3fa8', { rim: 0, transparent: true, opacity: 0.6 });
    for (const s of [-1, 1]) mesh(G.sphere(0.04, 10, 8), blushM, this.bell, [s * 0.25, 0.1, 0.31], [0, s * 0.6, 0], [1, 0.5, 0.3]);
    // headphones
    const dark = this.mat('#231c3c', { roughness: 0.35, rim: 0.4, rimColor: '#59e3ff' });
    const cyan = this.glow('#59e3ff', 1.6);
    mesh(G.torus(0.47, 0.028, Math.PI, 36), dark, this.bell, [0, 0.08, -0.02]);
    for (const s of [-1, 1]) {
      mesh(G.cyl(0.095, 0.095, 0.09, 20), dark, this.bell, [s * 0.47, 0.08, -0.02], [0, 0, Math.PI / 2]);
      mesh(G.torus(0.075, 0.012, Math.PI * 2, 24), cyan, this.bell, [s * 0.52, 0.08, -0.02], [0, Math.PI / 2, 0]);
    }
    this.tube([[-0.46, 0.02, 0.04], [-0.42, -0.08, 0.2], [-0.28, -0.1, 0.34], [-0.16, -0.02, 0.38]], 0.011, dark, this.bell, 16);
    mesh(G.sphere(0.035, 12, 10), dark, this.bell, [-0.15, -0.01, 0.39]);
    mesh(G.cyl(0.008, 0.008, 0.22, 6), dark, this.bell, [0.2, 0.62, -0.02], [0, 0, -0.4]);
    this.led = mesh(G.sphere(0.03, 10, 8), this.glow('#ff3b4f', 2.4), this.bell, [0.245, 0.72, -0.02]);
    // tentacles + oral arms
    const tentM = this.mat('#ffa6ef', { roughness: 0.3, rim: 0.8, emissive: '#ff5fd2', emissiveIntensity: 0.35, transparent: true, opacity: 0.7 });
    tentM.depthWrite = false;
    const armM = this.mat('#ffd1f7', { roughness: 0.3, rim: 0.6, emissive: '#ff8ae6', emissiveIntensity: 0.3, transparent: true, opacity: 0.75 });
    armM.depthWrite = false;
    this.strands = [];
    const nT = 9;
    for (let i = 0; i < nT; i++) {
      const a = (i / nT) * Math.PI * 2;
      this.strands.push(this._strand([Math.sin(a) * 0.33, 0.04, Math.cos(a) * 0.33], 7, 0.1, 0.018, 0.007, tentM, i * 0.9));
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      this.strands.push(this._strand([Math.sin(a) * 0.08, 0.04, Math.cos(a) * 0.08], 5, 0.11, 0.045, 0.02, armM, i * 1.7 + 0.3, [1.4, 1, 0.55]));
    }
    this.aura = this.halo(this.float, '#ff6fe0', 2.0, 0.45);
    this.aura.position.y = 0.15;
  }

  _strand(p, n, len, r0, r1, m, phase, scale = [1, 1, 1]) {
    const joints = [];
    let parent = group(this.bell, p);
    for (let i = 0; i < n; i++) {
      const r = r0 + (r1 - r0) * (i / (n - 1));
      const j = group(parent, i === 0 ? [0, 0, 0] : [0, -len, 0]);
      mesh(G.capsuleDown(Math.round(r * 1000) / 1000, len), m, j, [0, 0, 0], [0, 0, 0], scale);
      joints.push(j);
      parent = j;
    }
    return { joints, phase };
  }

  setMood(m) {
    super.setMood(m);
    const c = m === 'angry' ? '#ff4f6a' : m === 'shock' ? '#fff27a' : '#ff4fd0';
    this.bellM.emissive.set(c);
  }

  animate() {
    const t = this.t, talk = this.talkAmt;
    const cheer = this.ek('cheer') + this.ek('laugh');
    this.float.position.y = 1.15 + Math.sin(t * 1.6) * 0.07 + Math.abs(Math.sin(t * 7)) * 0.08 * cheer;
    const pulse = Math.sin(t * 3.2);
    this.bell.scale.set(1 - pulse * 0.03, 1 + pulse * 0.05, 1 - pulse * 0.03);
    this.bell.rotation.y = this.headYaw;
    this.bell.rotation.x = this.headPitch * 0.5 + Math.sin(t * 8) * 0.04 * talk;
    this.bell.rotation.z = Math.sin(t * 1.1) * 0.05 + Math.sin(t * 12) * 0.03 * cheer;
    this.mouth.scale.y = 0.35 + this.mouthOpen * 1.5;
    this.bellM.emissiveIntensity = 0.45 + talk * (0.25 + Math.sin(t * 20) * 0.15) + cheer * 0.3;
    this.core.material.opacity = 0.45 + Math.sin(t * 2.4) * 0.12 + talk * 0.2;
    this.led.visible = Math.sin(t * 5) > -0.3;
    this.aura.material.opacity = 0.35 + talk * 0.2 + Math.sin(t * 2) * 0.05;
    for (const st of this.strands) {
      st.joints.forEach((j, i) => {
        j.rotation.x = Math.sin(t * 2.2 - i * 0.7 + st.phase) * 0.16 + (i === 0 ? pulse * 0.08 : 0);
        j.rotation.z = Math.cos(t * 1.7 - i * 0.6 + st.phase * 1.3) * 0.12;
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Shelly — hermit crab armory keeper in a sticker-covered shell.
function spiralShellGeometry() {
  return geo('shelly-shell', () => {
    const turns = 2.6, N = 90, M = 16, H = 0.62, R0 = 0.17;
    const pos = [], col = [], idx = [];
    const cA = new THREE.Color('#ffa6c4'), cB = new THREE.Color('#e0628f'), cC = new THREE.Color('#fff0f6');
    const center = (u) => {
      const th = u * turns * Math.PI * 2;
      const R = R0 * Math.pow(1 - u, 1.1);
      return new THREE.Vector3(Math.cos(th) * R, u * H, Math.sin(th) * R);
    };
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const c = center(u), c2 = center(Math.min(1, u + 0.002));
      const tan = c2.sub(c).normalize();
      const th = u * turns * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
      const bin = new THREE.Vector3().crossVectors(tan, radial).normalize();
      const nor = new THREE.Vector3().crossVectors(bin, tan).normalize();
      const rho = 0.25 * Math.pow(1 - u, 1.15) + 0.012;
      const band = Math.sin(u * turns * 6 * Math.PI) > 0.55 ? cB : (Math.sin(u * 40) > 0.9 ? cC : cA);
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * Math.PI * 2;
        const p = c.clone().addScaledVector(nor, Math.cos(a) * rho).addScaledVector(bin, Math.sin(a) * rho);
        pos.push(p.x, p.y, p.z);
        col.push(band.r, band.g, band.b);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

class ShellyModel extends NpcBase {
  constructor(o) {
    super('shelly', o);
    this.height = 1.15;
    const crab = this.mat('#ff6b4a', { roughness: 0.35, rim: 0.45, rimColor: '#ffe0d8' });
    const crabD = this.mat('#c43e25', { roughness: 0.4, rim: 0.3 });
    const R = this.rig;
    // shell
    const shellM = this.mat('#ffffff', { roughness: 0.3, rim: 0.5, rimColor: '#ffe0ee' });
    shellM.vertexColors = true;
    this.shell = group(R, [0, 0.42, -0.12], [-1.1, 0, 0.1]);
    mesh(spiralShellGeometry(), shellM, this.shell, [0, 0, 0], [0, 0.5, 0], [1.35, 1.3, 1.35]);
    const stickers = [['#ffe14d', 0.7, 0.28], ['#59e3ff', 2.4, 0.18], ['#8ede6a', 4.1, 0.36], ['#ff3b5c', 5.4, 0.12], ['#ffffff', 3.2, 0.46]];
    for (const [c, a, h] of stickers) {
      const r = 0.3 * (1 - h) + 0.05;
      mesh(G.cyl(0.05, 0.05, 0.012, 14), this.mat(c, { roughness: 0.4, rim: 0.2 }), this.shell, [Math.cos(a) * r, h * 0.8, Math.sin(a) * r], [Math.PI / 2, 0, -a + Math.PI / 2]);
    }
    // little pennant on top
    mesh(G.cyl(0.006, 0.006, 0.3, 6), crabD, this.shell, [0.02, 0.95, 0]);
    this.flag = mesh(G.plane(0.14, 0.09), this.mat('#59e3ff', { side: THREE.DoubleSide, rim: 0.2 }), this.shell, [0.09, 1.04, 0]);
    // legs
    this.legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const hip = group(R, [s * 0.15, 0.3, 0.1 - i * 0.1], [0, s * (0.3 - i * 0.3), s * 1.0]);
      mesh(G.capsuleDown(0.025, 0.14), crab, hip);
      const knee = group(hip, [0, -0.18, 0], [0, 0, -s * 1.3]);
      mesh(G.capsuleDown(0.02, 0.2), crabD, knee);
      this.legs.push({ hip, knee, s, i });
    }
    // body
    this.body = group(R, [0, 0.4, 0.05]);
    mesh(G.sphere(0.2, 22, 16), crab, this.body, [0, 0, 0], [0, 0, 0], [1.15, 0.85, 0.95]);
    this.head = group(this.body, [0, 0.08, 0.1]);
    // eye stalks
    for (const s of [-1, 1]) {
      const st = group(this.head, [s * 0.07, 0.06, 0.04], [-0.1, 0, -s * 0.18]);
      mesh(G.capsuleDown(0.022, 0.16), crabD, st, [0, 0.2, 0], [Math.PI, 0, 0]);
      this.eye(st, [0, 0.24, 0.02], 0.05, { tall: 1.2, flat: 0.9 });
    }
    this.mouth = mesh(G.sphere(0.03, 12, 8), this.mat('#5a1422', { rim: 0 }), this.head, [0, -0.07, 0.13], [0, 0, 0], [1.4, 0.35, 0.6]);
    const blushM = this.mat('#ff9fb0', { rim: 0, transparent: true, opacity: 0.7 });
    for (const s of [-1, 1]) mesh(G.sphere(0.03, 8, 6), blushM, this.head, [s * 0.12, -0.04, 0.1], [0, s * 0.8, 0], [1, 0.55, 0.3]);
    // claws
    this.claws = [];
    for (const s of [-1, 1]) {
      const big = s > 0;
      const k = big ? 1.35 : 0.8;
      const sh = group(this.body, [s * 0.2, 0.02, 0.08], [-0.6, s * -0.3, s * 0.5]);
      mesh(G.capsuleDown(0.03 * k, 0.12 * k), crab, sh);
      const el = group(sh, [0, -0.16 * k, 0], [-1.4, 0, 0]);
      mesh(G.capsuleDown(0.03 * k, 0.08 * k), crab, el);
      const hand = group(el, [0, -0.13 * k, 0]);
      mesh(G.sphere(0.06 * k, 16, 12), crab, hand, [0, 0, 0], [0, 0, 0], [1, 1.2, 0.8]);
      const upper = group(hand, [0, -0.05 * k, 0.01]);
      mesh(G.sphere(0.045 * k, 12, 10), crabD, upper, [0, -0.05 * k, 0], [0, 0, 0], [0.6, 1.4, 0.55]);
      const lower = group(hand, [0, -0.05 * k, -0.01]);
      mesh(G.sphere(0.04 * k, 12, 10), crab, lower, [0, -0.04 * k, 0], [0, 0, 0], [0.55, 1.2, 0.5]);
      if (big) {
        // wrench
        const w = group(hand, [0.02, -0.02, 0.06], [0.2, 0, 0.4]);
        const steel = this.mat('#aab3c8', { roughness: 0.3, metalness: 0.6, rim: 0.3 });
        mesh(G.box(0.03, 0.26, 0.015), steel, w, [0, 0.12, 0]);
        mesh(G.torus(0.035, 0.012, Math.PI * 1.5, 16), steel, w, [0, 0.27, 0], [0, 0, -Math.PI * 0.25]);
      }
      this.claws.push({ sh, el, upper, lower, s, big });
    }
  }

  animate() {
    const t = this.t, talk = this.talkAmt;
    const cheer = this.ek('cheer') + this.ek('laugh'), wave = this.ek('wave');
    this.body.position.y = 0.4 + Math.sin(t * 2.2) * 0.012 + Math.abs(Math.sin(t * 9)) * 0.05 * cheer;
    this.shell.rotation.z = 0.1 + Math.sin(t * 1.3) * 0.03;
    this.head.rotation.y = this.headYaw;
    this.head.rotation.x = this.headPitch + Math.sin(t * 9) * 0.04 * talk;
    this.mouth.scale.y = 0.35 + this.mouthOpen * 1.5;
    this.flag.rotation.y = Math.sin(t * 4) * 0.4;
    for (const C of this.claws) {
      const snip = Math.max(0, Math.sin(t * (C.big ? 7 : 9) + (C.big ? 0 : 1.5))) * (0.3 + talk * 0.6);
      C.upper.rotation.x = -snip * 0.6;
      C.lower.rotation.x = snip * 0.4;
      let shx = -0.6 - talk * Math.max(0, Math.sin(t * 4 + C.s)) * 0.5;
      if (cheer) shx = lerp(shx, -2.6 + Math.sin(t * 10 + C.s) * 0.2, Math.min(1, cheer));
      if (wave && C.big) shx = lerp(shx, -2.4 + Math.sin(t * 9) * 0.3, wave);
      C.sh.rotation.x = shx;
    }
    for (const L of this.legs) L.hip.rotation.x = this.walking ? Math.sin(t * 16 + L.i * 2 + (L.s > 0 ? 1 : 0)) * 0.4 : 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Otto & Tilly — sea-otter Turf Clash judges in referee stripes.
class OtterModel extends NpcBase {
  constructor(who, o) {
    super(who, o);
    const tilly = who === 'tilly';
    this.height = tilly ? 1.12 : 1.2;
    const fur = this.mat(tilly ? '#b07c52' : '#8a5a3c', { roughness: 0.85, rim: 0.4, rimColor: '#ffe6c8' });
    const furD = this.mat(tilly ? '#8a5c38' : '#6a412a', { roughness: 0.9, rim: 0.3 });
    const cream = this.mat(tilly ? '#f3dfbf' : '#ecd2ad', { roughness: 0.85, rim: 0.3 });
    const shirt = this.mat('#ffffff', { roughness: 0.8, rim: 0.25 });
    shirt.map = stripeTexture('#f4f4f4', '#16141f', 16);
    const black = this.mat('#16141f', { roughness: 0.5, rim: 0.3 });
    const R = this.rig;
    const k = tilly ? 0.93 : 1;
    this.rig.scale.setScalar(k);
    // legs + feet
    for (const s of [-1, 1]) {
      mesh(G.capsule(0.07, 0.1), furD, R, [s * 0.1, 0.13, 0]);
      mesh(G.sphere(0.075, 12, 10), furD, R, [s * 0.11, 0.035, 0.06], [0, 0, 0], [1, 0.45, 1.5]);
    }
    // tail
    this.tail = group(R, [0, 0.22, -0.16], [0.9, 0, 0]);
    mesh(G.capsuleDown(0.07, 0.26), furD, this.tail, [0, 0, 0], [0, 0, 0], [1.3, 1, 0.5]);
    // torso in referee shirt
    this.body = group(R, [0, 0, 0]);
    mesh(G.capsule(0.2, 0.28), shirt, this.body, [0, 0.52, 0], [0, 0, 0], [1, 1, 0.88]);
    mesh(G.torus(0.1, 0.025, Math.PI * 2, 20), black, this.body, [0, 0.83, 0.01], [Math.PI / 2, 0, 0]);
    // whistle
    const cord = this.mat(tilly ? '#2fae62' : '#e0453a', { rim: 0.2 });
    mesh(G.torus(0.12, 0.008, Math.PI, 20), cord, this.body, [0, 0.78, 0.1], [Math.PI * 1.35, 0, 0]);
    this.whistle = group(this.body, [0, 0.66, 0.19]);
    mesh(G.cyl(0.022, 0.022, 0.07, 12), this.mat('#c9d2e0', { metalness: 0.7, roughness: 0.25, rim: 0.3 }), this.whistle, [0, 0, 0], [0, 0, Math.PI / 2]);
    // head
    this.head = group(this.body, [0, 0.96, 0]);
    mesh(G.sphere(0.24, 26, 18), fur, this.head, [0, 0, 0], [0, 0, 0], [1.06, 0.95, 0.95]);
    mesh(G.sphere(0.19, 22, 16), cream, this.head, [0, -0.04, 0.09], [0, 0, 0], [1.05, 0.85, 0.8]);
    mesh(G.sphere(0.09, 16, 12), cream, this.head, [0, -0.08, 0.19], [0, 0, 0], [1.35, 0.8, 0.9]);
    mesh(G.sphere(0.036, 12, 10), this.mat('#140c0c', { roughness: 0.15, rim: 0.2 }), this.head, [0, -0.04, 0.27], [0, 0, 0], [1.35, 0.85, 0.85]);
    this.mouth = mesh(G.sphere(0.028, 10, 8), this.mat('#4a1414', { rim: 0 }), this.head, [0, -0.115, 0.255], [0, 0, 0], [1.3, 0.3, 0.6]);
    for (const s of [-1, 1]) {
      mesh(G.sphere(0.055, 12, 10), fur, this.head, [s * 0.19, 0.14, -0.02], [0, 0, 0], [1, 1, 0.6]);
      this.eye(this.head, [s * 0.085, 0.04, 0.2], 0.042, { iris: '#1c120a', tall: 1.1, flat: 0.7, rot: [0, s * 0.3, 0] });
      for (let w = 0; w < 3; w++) mesh(G.cyl(0.003, 0.003, 0.16, 4), furD, this.head, [s * 0.14, -0.07 - w * 0.02, 0.2], [0, 0, Math.PI / 2 + s * (w - 1) * 0.18]);
    }
    if (tilly) {
      // glasses + green visor + pencil
      for (const s of [-1, 1]) mesh(G.torus(0.055, 0.009, Math.PI * 2, 20), black, this.head, [s * 0.085, 0.04, 0.245]);
      mesh(G.box(0.05, 0.012, 0.012), black, this.head, [0, 0.05, 0.25]);
      const visor = this.mat('#2fae62', { roughness: 0.4, rim: 0.3 });
      mesh(G.torus(0.235, 0.022, Math.PI * 2, 28), visor, this.head, [0, 0.12, 0], [Math.PI / 2 + 0.12, 0, 0]);
      mesh(G.cyl(0.24, 0.24, 0.012, 24, false, -0.9, 1.8), visor, this.head, [0, 0.1, 0.05], [0.25, 0, 0]);
      mesh(G.cyl(0.01, 0.01, 0.2, 6), this.mat('#ffd23f', { rim: 0.2 }), this.head, [0.2, 0.2, 0.02], [0, 0, 0.8]);
    } else {
      // black referee cap
      mesh(G.dome(0.24, 0.5, 24), black, this.head, [0, 0.07, -0.01], [0, 0, 0], [1.02, 0.7, 1.02]);
      mesh(G.cyl(0.14, 0.14, 0.012, 20, false, -0.9, 1.8), this.mat('#f4f4f4', { rim: 0.2 }), this.head, [0, 0.08, 0.2], [0.12, 0, 0], [1, 1, 1.2]);
      // bushy brows
      for (const s of [-1, 1]) mesh(G.capsule(0.018, 0.06), furD, this.head, [s * 0.085, 0.12, 0.21], [0, 0, Math.PI / 2 + s * 0.2]);
    }
    // arms + prop
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = group(this.body, [s * 0.2, 0.72, 0.02], [0, 0, s * 0.35]);
      mesh(G.capsuleDown(0.055, 0.2), fur, sh);
      const paw = mesh(G.sphere(0.06, 12, 10), furD, sh, [0, -0.29, 0]);
      this.arms.push({ sh, paw, s });
    }
    const hand = this.arms[1].sh;
    if (tilly) {
      const cb = group(hand, [0, -0.3, 0.06], [0.3, 0, 0]);
      mesh(G.box(0.2, 0.26, 0.015), this.mat('#8a5c2e', { rim: 0.2 }), cb);
      mesh(G.box(0.17, 0.2, 0.004), this.mat('#fbf6ea', { rim: 0.1 }), cb, [0, -0.01, 0.01]);
      mesh(G.box(0.07, 0.03, 0.02), this.mat('#c9d2e0', { metalness: 0.6, rim: 0.2 }), cb, [0, 0.12, 0.01]);
    } else {
      const fl = group(hand, [0, -0.3, 0.02]);
      mesh(G.cyl(0.012, 0.012, 0.5, 6), this.mat('#e8e2d6', { rim: 0.2 }), fl, [0, 0.12, 0]);
      this.flag = mesh(G.plane(0.24, 0.16), this.mat('#e0453a', { side: THREE.DoubleSide, rim: 0.2 }), fl, [0.12, 0.3, 0]);
    }
  }

  animate() {
    const t = this.t, talk = this.talkAmt;
    const cheer = this.ek('cheer') + this.ek('laugh'), wave = this.ek('wave'), whistle = this.ek('whistle');
    this.body.position.y = Math.sin(t * 2) * 0.01 + Math.abs(Math.sin(t * 8.5)) * 0.07 * cheer;
    this.head.rotation.y = this.headYaw;
    this.head.rotation.x = this.headPitch + Math.sin(t * 8) * 0.05 * talk;
    this.head.rotation.z = Math.sin(t * 1.2) * 0.04;
    this.mouth.scale.y = 0.3 + this.mouthOpen * 1.6;
    this.tail.rotation.z = Math.sin(t * 2.5) * 0.25;
    for (const A of this.arms) {
      let x = -0.1 - talk * Math.max(0, Math.sin(t * 5 + A.s * 1.7)) * 0.9;
      let z = A.s * 0.35;
      if (cheer) { x = lerp(x, -2.8 + Math.sin(t * 11 + A.s) * 0.2, Math.min(1, cheer)); z = lerp(z, A.s * 0.2, Math.min(1, cheer)); }
      if (wave && A.s > 0) { x = lerp(x, -2.6, wave); z = lerp(z, 0.4 + Math.sin(t * 10) * 0.35, wave); }
      if (whistle && A.s < 0) { x = lerp(x, -2.3, whistle); z = lerp(z, 0.35, whistle); }
      A.sh.rotation.x = x;
      A.sh.rotation.z = z;
    }
    if (this.flag) this.flag.rotation.y = Math.sin(t * 5) * 0.3;
  }
}

// ---------------------------------------------------------------------------------------------
// Baron Murkwell — anglerfish tycoon: suit, top hat, monocle, glowing lure.
class MurkwellModel extends NpcBase {
  constructor(o) {
    super('murkwell', o);
    this.height = 2.3;
    const skin = this.mat('#4b3f6e', { roughness: 0.45, rim: 0.5, rimColor: '#b9a6ff' });
    const skinD = this.mat('#2c2447', { roughness: 0.5, rim: 0.35 });
    const suit = this.mat('#26223a', { roughness: 0.7, rim: 0.3 });
    const suitL = this.mat('#383252', { roughness: 0.6, rim: 0.3 });
    const white = this.mat('#f2efe8', { roughness: 0.6, rim: 0.2 });
    const purple = this.mat('#7b3be0', { roughness: 0.4, rim: 0.3 });
    const shoe = this.mat('#0e0c16', { roughness: 0.15, rim: 0.4 });
    const tooth = this.mat('#f7f2e2', { roughness: 0.3, rim: 0.1 });
    const R = this.rig;
    // legs + shoes
    for (const s of [-1, 1]) {
      mesh(G.capsule(0.08, 0.3), suit, R, [s * 0.14, 0.26, 0]);
      mesh(G.sphere(0.09, 14, 10), shoe, R, [s * 0.15, 0.05, 0.06], [0, 0, 0], [1, 0.5, 1.7]);
    }
    this.body = group(R);
    // suit body + tails
    mesh(G.cyl(0.3, 0.36, 0.5, 24), suit, this.body, [0, 0.7, 0]);
    mesh(G.box(0.2, 0.36, 0.02), white, this.body, [0, 0.78, 0.33], [-0.08, 0, 0]);
    mesh(G.box(0.07, 0.26, 0.02), purple, this.body, [0, 0.74, 0.35], [-0.08, 0, 0]);
    mesh(G.sphere(0.04, 10, 8), purple, this.body, [0, 0.88, 0.35]);
    for (const s of [-1, 1]) {
      mesh(G.box(0.1, 0.4, 0.02), suitL, this.body, [s * 0.14, 0.78, 0.335], [-0.08, 0, s * 0.35]);
      const tl = group(this.body, [s * 0.12, 0.5, -0.28], [0.15, 0, 0]);
      mesh(G.box(0.16, 0.42, 0.03), suit, tl, [0, -0.2, 0]);
    }
    mesh(G.sphere(0.035, 10, 8), this.glow('#c8ff3a', 1.5), this.body, [0.2, 0.86, 0.3]);   // Murk pin
    // head
    this.head = group(this.body, [0, 1.36, 0]);
    const H = group(this.head);
    this.skull = mesh(G.sphere(0.55, 32, 22), skin, H, [0, 0.05, 0], [0, 0, 0], [1.05, 0.88, 0.98]);
    for (const [x, y, z] of [[-0.3, 0.3, 0.3], [0.32, 0.26, 0.32], [0.45, 0.05, 0.2], [-0.46, 0.0, 0.2], [0.05, 0.42, 0.2]]) mesh(G.sphere(0.03, 8, 6), this.mat('#6e5f9a', { rim: 0.2 }), H, [x, y, z]);
    // mouth interior + upper teeth
    mesh(G.sphere(0.48, 24, 12), this.mat('#1c0f24', { rim: 0 }), H, [0, -0.2, 0.1], [0, 0, 0], [1.02, 0.32, 0.95]);
    const arcTeeth = (parent, y, zOff, up, n, r) => {
      for (let i = 0; i < n; i++) {
        const a = -1.1 + (i / (n - 1)) * 2.2;
        mesh(G.cone(0.035, 0.11, 6), tooth, parent, [Math.sin(a) * r, y, Math.cos(a) * r + zOff], [up ? 0 : Math.PI, 0, 0]);
      }
    };
    arcTeeth(H, -0.17, 0.02, false, 7, 0.5);
    // jaw (underbite) hinged at the back
    this.jaw = group(H, [0, -0.18, -0.25]);
    mesh(G.sphere(0.5, 28, 16, 0), skinD, this.jaw, [0, -0.1, 0.33], [0, 0, 0], [1.08, 0.5, 1.02]);
    arcTeeth(this.jaw, 0.04, 0.3, true, 8, 0.52);
    // eyes, brows, monocle
    this.brows = [];
    for (const s of [-1, 1]) {
      this.eye(H, [s * 0.2, 0.2, 0.45], 0.06, { iris: '#e8c22a', white: this.mat('#fff8d8', { roughness: 0.2 }), rot: [0, s * 0.35, 0], flat: 0.8 });
      this.brows.push(mesh(G.capsule(0.03, 0.12), skinD, H, [s * 0.2, 0.3, 0.46], [0, s * 0.35, Math.PI / 2]));
    }
    const gold = this.mat('#f5c542', { roughness: 0.25, metalness: 0.7, rim: 0.3 });
    mesh(G.torus(0.08, 0.011, Math.PI * 2, 24), gold, H, [0.21, 0.2, 0.5], [0, 0.35, 0]);
    this.tube([[0.28, 0.14, 0.5], [0.34, -0.05, 0.46], [0.33, -0.3, 0.38], [0.24, -0.5, 0.36]], 0.005, gold, H, 14);
    // top hat
    const hat = group(H, [0.02, 0.5, -0.04], [-0.1, 0, 0.12]);
    const hatM = this.mat('#15121f', { roughness: 0.3, rim: 0.35 });
    mesh(G.cyl(0.24, 0.23, 0.46, 26), hatM, hat, [0, 0.24, 0]);
    mesh(G.cyl(0.245, 0.24, 0.08, 26), purple, hat, [0, 0.06, 0]);
    mesh(G.cyl(0.4, 0.4, 0.025, 28), hatM, hat, [0, 0.01, 0], [0, 0, 0], [1, 1, 0.9]);
    // lure: stalk out of the hat top, bulb in front
    this.lure = group(hat, [0, 0.46, 0.05]);
    this.tube([[0, 0, 0], [0, 0.25, 0.12], [0, 0.34, 0.45], [0, 0.18, 0.72]], 0.018, skinD, this.lure, 24);
    this.bulbM = this.glow('#cfd6a8', 1.2);
    this.bulb = mesh(G.sphere(0.075, 18, 14), this.bulbM, this.lure, [0, 0.12, 0.76]);
    this.bulbHalo = this.halo(this.lure, '#ffe98a', 0.6, 0.35);
    this.bulbHalo.position.set(0, 0.12, 0.76);
    // arms: sleeves + fin hands
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = group(this.body, [s * 0.36, 0.92, 0], [0.1, 0, s * 0.25]);
      mesh(G.capsuleDown(0.075, 0.3), suit, sh);
      mesh(G.cyl(0.08, 0.08, 0.05, 14), white, sh, [0, -0.4, 0]);
      const fin = group(sh, [0, -0.46, 0]);
      mesh(G.sphere(0.1, 14, 10), skin, fin, [0, -0.06, 0], [0, 0, 0], [0.45, 1, 0.8]);
      this.arms.push({ sh, fin, s });
    }
    this.setMood('smug');
  }

  setMood(m) {
    super.setMood(m);
    const angry = m === 'angry';
    const c = angry ? '#ff5a2a' : m === 'smug' || m === 'laugh' || m === 'happy' ? '#ffe98a' : '#cfd6a8';
    this.bulbM.color.set(c).multiplyScalar(angry ? 3.2 : m === 'smug' ? 1.8 : 1.2);
    this.bulbHalo.material.color.set(c);
    this.bulbHalo.material.opacity = angry ? 0.95 : m === 'smug' ? 0.5 : 0.25;
    this.bulbHalo.scale.setScalar(angry ? 1.4 : 0.7);
  }

  animate() {
    const t = this.t, talk = this.talkAmt;
    const angry = this.mood === 'angry' ? 1 : this.ek('angry');
    const laugh = this.ek('laugh') + this.ek('cheer');
    this.body.position.y = Math.sin(t * 1.4) * 0.012 + Math.abs(Math.sin(t * 10)) * 0.03 * laugh;
    this.body.rotation.z = Math.sin(t * 0.9) * 0.02 + Math.sin(t * 35) * 0.012 * angry;
    this.head.rotation.y = this.headYaw * 0.7;
    this.head.rotation.x = this.headPitch * 0.5 - 0.05 * laugh;
    this.jaw.rotation.x = 0.05 + this.mouthOpen * 0.28 + laugh * Math.abs(Math.sin(t * 12)) * 0.25;
    this.lure.rotation.x = Math.sin(t * 1.6) * 0.1 + Math.sin(t * 9) * 0.05 * talk;
    this.lure.rotation.z = Math.sin(t * 1.1) * 0.12;
    const pulse = angry ? 0.7 + Math.abs(Math.sin(t * 9)) * 0.6 : 0.9 + Math.sin(t * 2) * 0.1;
    this.bulb.scale.setScalar(pulse);
    this.bulbHalo.scale.setScalar((angry ? 1.5 : 0.7) * pulse);
    this.brows.forEach((b, i) => { const s = i ? 1 : -1; b.rotation.z = Math.PI / 2 + s * (angry ? 0.5 : this.mood === 'smug' ? -0.15 : 0.1); b.position.y = 0.3 - angry * 0.03; });
    for (const A of this.arms) {
      let x = 0.1, z = A.s * 0.25;
      if (A.s > 0) { x -= talk * (0.8 + Math.sin(t * 4) * 0.4); z += talk * 0.2; }
      if (angry) { x = lerp(x, -2.2 + Math.sin(t * 22 + A.s) * 0.25, angry); z = lerp(z, A.s * 0.5, angry); }
      A.sh.rotation.x = x;
      A.sh.rotation.z = z;
      A.fin.rotation.z = Math.sin(t * 3 + A.s) * 0.2;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Foreman Dredge — bulky Murk Corps foreman: tar body, hardhat, hi-vis vest, clipboard.
class DredgeModel extends NpcBase {
  constructor(o) {
    super('dredge', o);
    this.height = 2.15;
    const tar = this.mat('#1e1630', { ink: true, rim: 0.6, rimColor: '#9b7bff' });
    const tarL = this.mat('#3d2f5c', { roughness: 0.3, rim: 0.4 });
    const vest = this.mat('#ff7a1a', { roughness: 0.6, rim: 0.3, side: THREE.DoubleSide });
    const reflect = this.mat('#e8f0ff', { roughness: 0.2, metalness: 0.4, rim: 0.4, emissive: '#8090a8', emissiveIntensity: 0.3, side: THREE.DoubleSide });
    const hatM = this.mat('#ffc53a', { roughness: 0.35, rim: 0.35 });
    const glove = this.mat('#ffb52e', { roughness: 0.6, rim: 0.3 });
    const boot = this.mat('#2b2f3b', { roughness: 0.5, rim: 0.3 });
    const R = this.rig;
    for (const s of [-1, 1]) {
      mesh(G.capsule(0.12, 0.18), tar, R, [s * 0.22, 0.28, 0]);
      mesh(G.sphere(0.15, 14, 10), boot, R, [s * 0.23, 0.08, 0.06], [0, 0, 0], [1, 0.55, 1.4]);
      mesh(G.sphere(0.08, 12, 8), this.mat('#6a7184', { metalness: 0.6, roughness: 0.3, rim: 0.3 }), R, [s * 0.23, 0.08, 0.22], [0, 0, 0], [1.1, 0.7, 0.8]);
    }
    this.body = group(R);
    mesh(G.sphere(0.62, 32, 22), tar, this.body, [0, 1.05, 0], [0, 0, 0], [1.05, 1.0, 0.85]);
    // vest (open at the front) + reflective bands
    mesh(G.cyl(0.6, 0.68, 0.5, 30, true, Math.PI / 2 + 0.45, Math.PI * 2 - 0.9), vest, this.body, [0, 0.82, 0], [0, 0, 0], [1.02, 1, 0.9]);
    for (const y of [0.72, 0.92]) mesh(G.cyl(0.66 - (y - 0.72) * 0.25, 0.67 - (y - 0.72) * 0.25, 0.05, 30, true, Math.PI / 2 + 0.45, Math.PI * 2 - 0.9), reflect, this.body, [0, y, 0], [0, 0, 0], [1.03, 1, 0.91]);
    // face
    this.head = group(this.body, [0, 1.05, 0]);
    const eyeGlow = this.mat('#e9ffb8', { emissive: '#c8ff3a', emissiveIntensity: 0.9, rim: 0.2 });
    this.brows = [];
    for (const s of [-1, 1]) {
      this.eye(this.head, [s * 0.2, 0.27, 0.46], 0.1, { white: eyeGlow, iris: '#0b0714', rot: [0, s * 0.35, 0], flat: 0.7 });
      this.brows.push(mesh(G.capsule(0.05, 0.14), tarL, this.head, [s * 0.2, 0.42, 0.46], [0, s * 0.3, Math.PI / 2]));
    }
    this.mouth = mesh(G.sphere(0.2, 20, 12), this.mat('#3a0f2a', { rim: 0 }), this.head, [0, -0.02, 0.44], [0, 0, 0], [1.2, 0.25, 0.5]);
    for (const s of [-1, 1]) mesh(G.cone(0.035, 0.09, 6), this.mat('#fffaf0', { rim: 0.1 }), this.head, [s * 0.13, -0.02, 0.5]);
    // hardhat
    const hat = group(this.body, [0, 1.52, 0.02], [-0.08, 0, 0]);
    mesh(G.dome(0.44, 0.5, 30), hatM, hat, [0, 0, 0], [0, 0, 0], [1.05, 0.72, 1.05]);
    mesh(G.cyl(0.56, 0.56, 0.035, 30), hatM, hat, [0, 0.01, 0.03], [0, 0, 0], [1, 1, 1.05]);
    mesh(G.box(0.06, 0.08, 0.72), this.mat('#e0a21a', { rim: 0.2 }), hat, [0, 0.29, 0], [0, 0, 0]);
    mesh(G.cyl(0.07, 0.07, 0.06, 16), boot, hat, [0, 0.16, 0.42], [Math.PI / 2 - 0.3, 0, 0]);
    this.lamp = mesh(G.cyl(0.055, 0.055, 0.01, 16), this.glow('#fffbe0', 2), hat, [0, 0.17, 0.455], [Math.PI / 2 - 0.3, 0, 0]);
    mesh(G.cyl(0.07, 0.07, 0.01, 16), this.mat('#7b3be0', { rim: 0.2 }), hat, [0.3, 0.16, 0.28], [0.9, 0.7, 0]);
    // arms + gloves + clipboard
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = group(this.body, [s * 0.6, 1.12, 0], [0, 0, s * 0.3]);
      mesh(G.capsuleDown(0.11, 0.38), tar, sh);
      mesh(G.sphere(0.15, 16, 12), glove, sh, [0, -0.55, 0.02], [0, 0, 0], [1, 1.1, 1]);
      this.arms.push({ sh, s });
    }
    const cb = group(this.arms[0].sh, [0.02, -0.58, 0.14], [0.2, 0.3, 0]);
    mesh(G.box(0.26, 0.34, 0.02), this.mat('#8a5c2e', { rim: 0.2 }), cb);
    mesh(G.box(0.22, 0.26, 0.005), this.mat('#fbf6ea', { rim: 0.1 }), cb, [0, -0.02, 0.013]);
  }

  animate() {
    const t = this.t, talk = this.talkAmt;
    const sad = this.mood === 'sad' || this.ek('sad') > 0 ? 1 : 0;
    const angry = this.mood === 'angry' ? 1 : this.ek('angry');
    const cheer = this.ek('cheer') + this.ek('laugh'), wave = this.ek('wave');
    this.body.position.y = Math.sin(t * 1.5) * 0.02 - sad * 0.05 + Math.abs(Math.sin(t * 7)) * 0.08 * cheer;
    this.body.rotation.z = Math.sin(t * 0.8) * 0.03;
    this.body.rotation.x = sad * 0.12;
    this.head.rotation.y = this.headYaw * 0.4;
    this.mouth.scale.y = 0.25 + this.mouthOpen * 1.2;
    this.brows.forEach((b, i) => { const s = i ? 1 : -1; b.rotation.z = Math.PI / 2 + s * (angry ? 0.45 : sad ? -0.4 : 0.05); });
    this.lamp.material.color.setScalar(1.6 + Math.sin(t * 3) * 0.3);
    for (const A of this.arms) {
      let x = -talk * Math.max(0, Math.sin(t * 3.6 + A.s)) * 0.7 - (A.s < 0 ? 0.5 : 0);
      let z = A.s * (0.3 + sad * -0.15);
      if (angry) { x = lerp(x, -2.6 + Math.sin(t * 18 + A.s) * 0.3, angry); z = lerp(z, A.s * 0.4, angry); }
      if (cheer) { x = lerp(x, -2.8, Math.min(1, cheer)); }
      if (wave && A.s > 0) { x = lerp(x, -2.6, wave); z = lerp(z, 0.5 + Math.sin(t * 9) * 0.35, wave); }
      A.sh.rotation.x = x;
      A.sh.rotation.z = z;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Squidkin kids (Kai stand-in for cutscenes, random plaza kids).
const KID_LOOKS = [
  { skin: '#f4c29b', top: '#e0453a', bottom: '#2a2a38', hair: 'bob', eye: '#1a3a5a' },
  { skin: '#c98a5e', top: '#2fae62', bottom: '#27325e', hair: 'spikes', eye: '#2b1d14' },
  { skin: '#8d5a3b', top: '#ffd23f', bottom: '#2a2a38', hair: 'tails', eye: '#3a2616', shoeAccent: '#2fd0ff' },
  { skin: '#f8d6b8', top: '#7b3be0', bottom: '#1c1d24', hair: 'bob', eye: '#2f5a2a' },
];
const KID_INKS = ['#2fd0ff', '#ff2fa0', '#9dff2e', '#ffd400', '#ff8a1f', '#b6ff2e'];

class SquidkinNpc {
  constructor(who, o = {}) {
    this.who = who;
    const seed = o.seed ?? Math.floor(Math.random() * 1000);
    const ink = o.ink || (who === 'kai' && o.session ? '#' + o.session.ink.color(1).getHexString() : KID_INKS[seed % KID_INKS.length]);
    const look = o.look || (who === 'kai' ? undefined : KID_LOOKS[seed % KID_LOOKS.length]);
    this.m = new SquidkinModel({ inkColor: ink, look });
    this.root = this.m.root;
    this.height = 1.45;
    this.head = this.m.head;
    this.t = 0;
    this.walking = false;
    this.talking = false;
    this.lookTarget = null;
  }
  update(dt, s = {}) {
    this.t += dt;
    this.m.update(dt, { speed: this.walking ? 3 : 0, grounded: true, vy: 0, inkLevel: 1 });
    if ((s.talking ?? this.talking) && this.m.head) this.m.head.rotation.x = Math.sin(this.t * 13) * 0.06;
  }
  emote(name, secs = 2.5) { this.m.emote(name === 'laugh' || name === 'happy' ? 'cheer' : name === 'angry' ? 'sad' : name, secs); }
  setMood() {}
  lookAt(p) { this.lookTarget = p; }
  dispose() { this.m.dispose(); }
}

// ---------------------------------------------------------------------------------------------
const MAKERS = {
  brine: (o) => new BrineModel(o),
  pix: (o) => new PixModel(o),
  shelly: (o) => new ShellyModel(o),
  otto: (o) => new OtterModel('otto', o),
  tilly: (o) => new OtterModel('tilly', o),
  murkwell: (o) => new MurkwellModel(o),
  dredge: (o) => new DredgeModel(o),
  kid: (o) => new SquidkinNpc('kid', o),
  kai: (o) => new SquidkinNpc('kai', o),
};

export const NPC_IDS = Object.keys(MAKERS);

/**
 * Build a character model. Unknown ids fall back to a Squidkin kid.
 * @param {string} who brine | pix | shelly | otto | tilly | murkwell | dredge | kid | kai
 * @param {object} o session (Kai's ink colour), look / ink / seed (kids)
 */
export function makeNpcModel(who, o = {}) {
  const make = MAKERS[who] || MAKERS.kid;
  const m = make(o);
  m.root.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = false; } });
  return m;
}
