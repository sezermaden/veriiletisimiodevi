// Boss framework shared by the four INKTIDE boss fights.
//
//   class Grinder extends Boss { think(dt) {...}  animate(dt) {...}  barFrac() {...} }
//
// A Boss is an Entity (not an Actor): its body never takes damage. Everything hittable is a
// BossPart hit proxy living in session.actors:
//   kind 'weak'  — glowing weak point; only damageable while `part.open` (else untargetable)
//   kind 'armor' — soaks shots with a metallic ping (so ink doesn't sail through the model)
// Solid bodies additionally register invisible box colliders with level.addDynamic() so the
// player can't walk through them and projectiles that hit them ping via onInkHit().
//
// The base class owns: fixed-step state timer, delayed actions (later), telegraph ground rings,
// lobbed Murk blobs, player damage with per-attack cooldowns + knockback, adds, radio banter,
// the boss bar, hit feedback (flash, sparks, sfx, shake) and the whole defeat sequence
// (slow-mo, hero-ink explosions, collapse hook, 'bossDefeated').
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Entity, spawnEntity } from '../base.js';
import { TEAM_HERO, TEAM_MURK } from '../../ink/ink-system.js';
import { charMat } from '../../actors/materials.js';
import { inkExplosion } from '../../weapons/base.js';
import { disposeTree } from '../../engine/dispose.js';
import { softSprite } from '../../world/textures.js';
import './sfx.js';

export { TEAM_HERO, TEAM_MURK };
export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);
export const WHITE = new THREE.Color(1, 1, 1);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t) => { t = clamp(t, 0, 1); return t * t * t; };
export function angleDiff(a, b) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _hc = new THREE.Vector3();
const _vel = new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// Shared geometry (module cache, flagged cached so disposeTree keeps it)
const GEO = new Map();
export function geo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); g.userData.cached = true; GEO.set(key, g); }
  return g;
}
export const G = {
  box: (w, h, d) => geo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r = 0.1) => geo(`rb:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w * 0.49, h * 0.49, d * 0.49))),
  cyl: (rt, rb, h, seg = 20, open = false) => geo(`c:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  /** Cylinder lying along X. */
  cylX: (r, h, seg = 24) => geo(`cx:${r}:${h}:${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(Math.PI / 2)),
  /** Cylinder lying along Z. */
  cylZ: (rt, rb, h, seg = 20) => geo(`cz:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg).rotateX(Math.PI / 2)),
  sphere: (r, w = 24, h = 16) => geo(`s:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h)),
  hemi: (r, w = 24, h = 10) => geo(`h:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
  hemiDown: (r, w = 24, h = 10) => geo(`hd:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
  torus: (R, r, rs = 10, ts = 32, arc = Math.PI * 2) => geo(`t:${R}:${r}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc)),
  cone: (r, h, seg = 16) => geo(`k:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  capsule: (r, len, cs = 6, rs = 16) => geo(`cp:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, cs, rs)),
  /** Capsule lying along X. */
  capsuleX: (r, len) => geo(`cpx:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 18).rotateZ(Math.PI / 2)),
  /** Flat ring on the XZ plane. */
  ring: (r0, r1, seg = 48) => geo(`r:${r0}:${r1}:${seg}`, () => new THREE.RingGeometry(r0, r1, seg).rotateX(-Math.PI / 2)),
  /** Flat disc on the XZ plane. */
  disc: (r, seg = 40) => geo(`d:${r}:${seg}`, () => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2)),
  /** Flat quad on the XZ plane (1×1, centred). */
  quad: () => geo('quad', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  /** Vertical plane facing +Z. */
  plane: (w, h) => geo(`pl:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
  lathe: (key, pts, seg = 32) => geo(`la:${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg)),
  /** Open beam tube along +Y from 0..1 (scaled at runtime). */
  beam: () => geo('beam', () => new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0)),
};

// ---------------------------------------------------------------------------------------------
// Shared canvas textures
const TEX = new Map();
export function canvasTex(key, w, h, draw, o = {}) {
  let t = TEX.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.userData.cached = true;
  TEX.set(key, t);
  return t;
}

/** Murk Industries logo: a gray "M" on a violet drop. */
export function emblemTexture() {
  return canvasTex('boss-emblem', 256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.translate(w / 2, h / 2);
    x.fillStyle = '#1a1030';
    x.beginPath(); x.arc(0, 8, 104, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#6a2bd9';
    x.beginPath(); x.arc(0, 8, 92, 0, Math.PI * 2); x.fill();
    // drip
    x.beginPath(); x.moveTo(-26, 90); x.quadraticCurveTo(0, 150, 26, 90); x.fill();
    x.fillStyle = '#d9d6e6';
    x.strokeStyle = '#1a1030'; x.lineWidth = 10; x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(-58, 52); x.lineTo(-58, -46); x.lineTo(-30, -46); x.lineTo(0, -4); x.lineTo(30, -46); x.lineTo(58, -46);
    x.lineTo(58, 52); x.lineTo(32, 52); x.lineTo(32, -6); x.lineTo(0, 36); x.lineTo(-32, -6); x.lineTo(-32, 52); x.closePath();
    x.stroke(); x.fill();
  });
}

/** Yellow/black hazard stripes (repeat). */
export function hazardTexture() {
  return canvasTex('boss-hazard', 128, 128, (x, w, h) => {
    x.fillStyle = '#ffc53a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#16121e';
    for (let i = -2; i < 4; i++) {
      x.beginPath();
      x.moveTo(i * 64, 0); x.lineTo(i * 64 + 32, 0); x.lineTo(i * 64 + 32 + h, h); x.lineTo(i * 64 + h, h); x.closePath(); x.fill();
    }
  }, { repeat: true });
}

/** Chevron strip for charge lanes (repeat along V). */
export function chevronTexture() {
  return canvasTex('boss-chevron', 128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.28)'; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h);
    x.strokeStyle = '#ffffff'; x.lineWidth = 18; x.lineJoin = 'miter';
    x.beginPath(); x.moveTo(22, 96); x.lineTo(64, 40); x.lineTo(106, 96); x.stroke();
  }, { repeat: true });
}

/** Session-aware palette (Murk trims follow the Murk ink colour → colour-blind palettes). */
export function bossPalette(session) {
  const ink = session.ink.color(TEAM_MURK).clone();
  const hero = session.ink.color(TEAM_HERO).clone();
  const tar = new THREE.Color('#150c24').lerp(ink, 0.12);
  return {
    ink, hero,
    inkBright: ink.clone().lerp(WHITE, 0.3),
    tar,
    tarLight: tar.clone().lerp(ink, 0.4),
    rim: ink.clone().lerp(WHITE, 0.55),
    steel: new THREE.Color('#6c7388'),
    steelLight: new THREE.Color('#9aa1b6'),
    steelDark: new THREE.Color('#2b2f3b'),
    rubber: new THREE.Color('#1a1b22'),
    hazard: new THREE.Color('#ffc53a'),
    gold: new THREE.Color('#e0b64e'),
    glow: new THREE.Color('#c8ff3a'),
    red: new THREE.Color('#ff3b2a'),
    glass: new THREE.Color('#9fd8ff'),
  };
}

// ---------------------------------------------------------------------------------------------
/**
 * Hit sphere for a boss part. Follows `anchor` (+ local `offset`) every rendered frame.
 * Weak parts are untargetable until opened, so shots pass through to the armour behind them.
 */
export class BossPart {
  constructor(boss, o = {}) {
    this.boss = boss;
    this.session = boss.session;
    this.kind = o.kind || 'weak';
    this.name = o.name || this.kind;
    this.team = TEAM_MURK;
    this.alive = true;
    this.prop = true;
    this.isBossPart = true;
    this.hitRadius = o.radius ?? 0.6;
    this.hitHeight = o.height ?? 0.4;
    this.anchor = o.anchor || boss.group;
    this.offset = new THREE.Vector3().fromArray(o.offset || [0, 0, 0]);
    this.center = new THREE.Vector3();
    this.position = this.center;
    this.velocity = new THREE.Vector3();
    this.invulnerable = 0;
    this.maxHp = o.hp ?? 100;
    this.hp = this.maxHp;
    this.broken = false;
    this.flash = 0;
    this.mats = o.mats || [];       // emissive materials that pulse/flash with this part
    this.glow = o.glow || null;     // optional glow sprite
    this.glowSize = o.glowSize ?? 1;
    this.baseGlow = o.baseGlow ?? 2.3;
    this.dimGlow = o.dimGlow ?? 0.35;
    this.color = new THREE.Color(o.color || boss.coreColor);
    this.untargetable = this.kind === 'weak';
    this.open = false;
    session_push(this);
  }
  setOpen(v) {
    if (this.kind !== 'weak') { this.untargetable = !v; return; }
    this.open = !!v && !this.broken;
    this.untargetable = !this.open;
  }
  restore(frac = 1) { this.broken = false; this.hp = this.maxHp * frac; this.setOpen(false); }
  hitCenter(out) { return out.copy(this.center); }
  track() { this.anchor.localToWorld(this.center.copy(this.offset)); }
  damage(amount, info = {}) {
    if (!this.alive || this.untargetable) return;
    this.boss.onPartHit(this, amount, info);
  }
  dispose() {
    this.alive = false;
    const a = this.session.actors;
    const i = a.indexOf(this);
    if (i >= 0) a.splice(i, 1);
  }
}
function session_push(p) { p.session.actors.push(p); }

// ---------------------------------------------------------------------------------------------
/** Pool of pulsing ground warning rings (telegraph where an attack will land). */
export class WarnRings {
  constructor(boss, n = 18) {
    this.boss = boss;
    this.items = [];
    for (let i = 0; i < n; i++) {
      const ringMat = boss.own(new THREE.MeshBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, fog: false }));
      const fillMat = boss.own(new THREE.MeshBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, fog: false }));
      const g = new THREE.Group();
      const ring = new THREE.Mesh(G.ring(0.84, 1, 48), ringMat);
      const fill = new THREE.Mesh(G.disc(1, 40), fillMat);
      const cross = new THREE.Mesh(G.ring(0.08, 0.2, 16), ringMat);
      ring.renderOrder = 4; fill.renderOrder = 3; cross.renderOrder = 4;
      g.add(ring, fill, cross);
      g.visible = false;
      g.matrixAutoUpdate = true;
      boss.session.scene.add(g);
      this.items.push({ g, ring, fill, ringMat, fillMat, t: 0, time: 1, r: 1, on: false });
    }
    this.cursor = 0;
  }
  /** Show a ring at pos (snapped to the ground below) for `time` seconds. */
  show(pos, radius, time, color = '#ff3b2a') {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    const level = this.boss.session.level;
    const hit = level.raycast(_v.copy(pos).setY(pos.y + 2.5), DOWN, 12, { staticOnly: true });
    if (hit) { it.g.position.copy(hit.point); it.g.quaternion.setFromUnitVectors(UP, hit.normal); }
    else { it.g.position.copy(pos); it.g.quaternion.identity(); }
    it.g.position.y += 0.03;
    it.ringMat.color.set(color); it.fillMat.color.set(color);
    it.t = 0; it.time = Math.max(0.05, time); it.r = radius; it.on = true;
    it.g.visible = true;
    return it;
  }
  step(dt) {
    for (const it of this.items) {
      if (!it.on) continue;
      it.t += dt;
      if (it.t >= it.time) { it.on = false; it.g.visible = false; }
    }
  }
  render(time) {
    for (const it of this.items) {
      if (!it.on) continue;
      const k = clamp(it.t / it.time, 0, 1);
      it.ring.scale.setScalar(it.r * (1.25 - 0.25 * easeOut(Math.min(1, k * 4))));
      it.fill.scale.setScalar(Math.max(0.01, it.r * k));
      const pulse = 0.5 + 0.5 * Math.sin(time * (10 + k * 18));
      it.ringMat.opacity = 0.55 + 0.4 * pulse;
      it.fillMat.opacity = 0.18 + 0.22 * k;
    }
  }
  clear() { for (const it of this.items) { it.on = false; it.g.visible = false; } }
  dispose() { for (const it of this.items) it.g.parent?.remove(it.g); }
}

// ---------------------------------------------------------------------------------------------
/** A sludge beam (glowing tube from a muzzle to an impact point) + thin aiming laser. */
export class Beam {
  constructor(boss, color, width = 0.45) {
    this.boss = boss;
    this.width = width;
    this.core = boss.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(WHITE, 0.35), transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
    this.outer = boss.own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.laserMat = boss.own(new THREE.MeshBasicMaterial({ color: '#ff3b2a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.root = new THREE.Group();
    this.beam = new THREE.Mesh(G.beam(), this.core);
    this.glow = new THREE.Mesh(G.beam(), this.outer);
    this.laser = new THREE.Mesh(G.beam(), this.laserMat);
    this.root.add(this.beam, this.glow, this.laser);
    this.beam.visible = this.glow.visible = this.laser.visible = false;
    this.beam.frustumCulled = this.glow.frustumCulled = this.laser.frustumCulled = false;
    boss.session.scene.add(this.root);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.mode = 'off';
  }
  _place(m, from, to, w) {
    _v.subVectors(to, from);
    const len = Math.max(0.01, _v.length());
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(UP, _v.divideScalar(len));
    m.scale.set(w, len, w);
  }
  aim(from, to) {
    this.mode = 'aim';
    this.from.copy(from); this.to.copy(to);
    this.laser.visible = true; this.beam.visible = false; this.glow.visible = false;
    this._place(this.laser, from, to, 0.035);
  }
  fire(from, to, t = 0) {
    this.mode = 'fire';
    this.from.copy(from); this.to.copy(to);
    this.laser.visible = false; this.beam.visible = true; this.glow.visible = true;
    const w = this.width * (0.9 + 0.12 * Math.sin(t * 60));
    this._place(this.beam, from, to, w * 0.55);
    this._place(this.glow, from, to, w);
  }
  hide() { this.mode = 'off'; this.beam.visible = this.glow.visible = this.laser.visible = false; }
  /** Distance from p to the beam segment. */
  distanceTo(p) {
    _v.subVectors(this.to, this.from);
    const l2 = _v.lengthSq();
    const t = l2 > 0 ? clamp(_w.subVectors(p, this.from).dot(_v) / l2, 0, 1) : 0;
    return _w.copy(this.from).addScaledVector(_v, t).distanceTo(p);
  }
  dispose() { this.root.parent?.remove(this.root); }
}

// ---------------------------------------------------------------------------------------------
const SPEAKER_NAME = { dredge: 'Foreman Dredge', murkwell: 'Baron Murkwell', pix: 'Pix', brine: 'Commodore Brine', kai: 'Kai', pa: 'Murk P.A.' };

export class Boss extends Entity {
  /**
   * @param {object} o  name, coreColor, phases
   */
  constructor(session, def, o = {}) {
    super(session, def);
    this.S = session;
    this.bossName = def.name || o.name || 'Boss';
    this.team = TEAM_MURK;
    this.alive = true;
    this.defeated = false;
    this.done = false;
    this.phase = 1;
    this.phases = o.phases ?? 3;
    this.state = 'wait';
    this.stateT = 0;
    this.t = 0;
    this.rt = 0;                      // real (render) time
    this.diff = session.difficulty ?? 1;
    this.hpMul = 0.85 + 0.15 * this.diff;
    this.dormant = !!def.dormant;
    this.pal = bossPalette(session);
    this.coreColor = new THREE.Color(o.coreColor || '#ff5fa8');
    this.floorY = def.pos ? def.pos[1] : 0;
    this.home = this.position.clone();
    this.arena = def.arena || null;   // { center:[x,y,z], radius } or { min:[x,z], max:[x,z] }
    this.parts = [];
    this.dyns = [];
    this.adds = [];
    this.timers = [];
    this.mats = new Map();
    this._hurtCd = {};
    this.grace = 0;
    this.started = false;
    this._armorPings = 0;
    this._armorHinted = false;
    this._slow = 0;
    this._slowOn = false;
    this._lastHitSfx = -1;
    this.anchors = [];                // Object3Ds the defeat explosions pop from
    this.warnRings = new WarnRings(this);
    this._offs = [
      session.events.on('playerRespawned', () => { this.grace = 2.4; }),
      session.events.on('playerSplatted', () => { this.grace = 3; }),
    ];
    this.model = new THREE.Group();
    this.group.add(this.model);
  }

  get player() { return this.S.player; }

  // ---- building helpers ---------------------------------------------------------------------
  /** Per-boss stylised material, cached by key. */
  mat(key, color, opts = {}) {
    let m = this.mats.get(key);
    if (!m) {
      m = charMat(color, { rim: 0.3, rimColor: this.pal.rim, roughness: 0.5, ...opts });
      this.own(m);
      this.mats.set(key, m);
    }
    return m;
  }
  /** Emissive glow material (bloom-friendly). */
  glowMat(key, color, intensity = 2, opts = {}) {
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0, ...opts });
      this.own(m);
      this.mats.set(key, m);
    }
    return m;
  }
  mesh(g, m, parent = this.model, pos = null, rot = null, scl = null) {
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    if (pos) o.position.set(pos[0], pos[1], pos[2]);
    if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    if (scl) { if (typeof scl === 'number') o.scale.setScalar(scl); else o.scale.set(scl[0], scl[1], scl[2]); }
    parent.add(o);
    return o;
  }
  node(parent = this.model, pos = null, rot = null) {
    const g = new THREE.Group();
    if (pos) g.position.set(pos[0], pos[1], pos[2]);
    if (rot) g.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(g);
    return g;
  }
  sprite(color, size = 1, opacity = 0.8, parent = this.model, pos = null) {
    const m = this.own(new THREE.SpriteMaterial({ map: softSprite(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    if (pos) s.position.set(pos[0], pos[1], pos[2]);
    parent.add(s);
    return s;
  }
  /** Register a hittable part. */
  part(o) {
    const p = new BossPart(this, o);
    this.parts.push(p);
    return p;
  }
  /** Invisible solid box collider following `parent`; shots that hit it ping off the armour. */
  collider(w, h, d, parent = this.model, x = 0, y = 0, z = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    this.own(g);
    const m = new THREE.Mesh(g, INVISIBLE);
    m.visible = false;
    m.position.set(x, y, z);
    parent.add(m);
    this.group.updateMatrixWorld(true);
    const dyn = this.S.level.addDynamic(m, { owner: this, tag: 'boss' });
    this.dyns.push(dyn);
    return dyn;
  }
  removeColliders() {
    for (const d of this.dyns) this.S.level.removeDynamic(d);
    this.dyns.length = 0;
  }

  // ---- flow -----------------------------------------------------------------------------------
  setState(s) { this.state = s; this.stateT = 0; this._enter = true; }
  /** True exactly once: on the first think() after setState(). */
  entered() { const e = !!this._enter; this._enter = false; return e; }
  later(delay, fn) { this.timers.push({ at: this.t + delay, fn }); }
  clearTimers() { this.timers.length = 0; }

  /** Non-blocking radio chatter; falls back to HUD toasts. */
  say(lines) {
    if (!lines?.length || this.dormant) return;
    const m = this.S.mode;
    if (typeof m?.radio === 'function') {
      try { m.radio(lines); return; } catch (e) { console.warn('boss radio', e); }
    }
    if (m?.kind === 'story' && typeof m.dialogue === 'function') {
      try { m.dialogue(lines, { radio: true }); return; } catch (e) { console.warn('boss radio', e); }
    }
    lines.forEach((l, i) => this.later(i * 2.4, () => {
      const who = SPEAKER_NAME[l.who] || '';
      this.S.hud?.toast(`${who ? who + ': ' : ''}${String(l.text).replace(/[*{}]/g, '')}`);
    }));
  }
  /** Control/tactics hint (skipped in story mode, where the radio chatter says the same). */
  hint(text, secs = 3.5) {
    if (this.S.mode?.kind === 'story') return;
    try { this.S.hud?.hint?.(text, secs); } catch { /* hints optional */ }
  }

  /**
   * A new phase began: emit 'bossPhase' (the story mode plays its scripted radio line for
   * '<stage>.phase<n>'); other modes get the fallback lines as radio/toasts.
   */
  phaseBanter(fallback) {
    const S = this.S;
    S.events.emit('bossPhase', { phase: this.phase, id: this.type, boss: this });
    if (S.mode?.kind === 'story') return;
    this.say(fallback);
  }

  /** Focus point (story intro camera, aim helpers). */
  hitCenter(out) { return out.copy(this.position).setY(this.position.y + 2); }

  updateBar() {
    if (this.dormant || this.defeated) return;
    this.S.hud?.bossBar(this.bossName, clamp(this.barFrac(), 0, 1));
  }
  barFrac() { return 1; }

  shakeAt(pos, amount) { this.S.shake(pos, amount); }

  // ---- attacks --------------------------------------------------------------------------------
  warn(pos, radius, time, color) { return this.warnRings.show(pos, radius, time, color); }

  /**
   * Lob a Murk blob so it lands on `to` after `T` seconds.
   * o: gravity, damage (direct), splash {radius, damage}, paint, size, onLand(point)
   */
  lob(from, to, T, o = {}) {
    const g = o.gravity ?? 20;
    _vel.set((to.x - from.x) / T, (to.y - from.y + 0.5 * g * T * T) / T, (to.z - from.z) / T);
    return this.S.projectiles.spawn({
      pos: from, vel: _vel, team: TEAM_MURK, owner: this,
      damage: o.damage ?? 28, size: o.size ?? 0.34, radius: o.radius ?? 0.32, gravity: g, life: T + 3,
      paint: { radius: o.paint ?? 1.7 }, splash: o.splash === null ? null : (o.splash || { radius: 1.9, damage: 34 }),
      onHit: o.onLand ? (p, hit) => o.onLand(hit.point, hit.normal) : null,
    });
  }

  /**
   * Damage the player (with a per-key cooldown) and optionally knock them away from `from`.
   * Returns true if the hit landed.
   */
  hurt(key, amount, from, knock = 0, up = 0, cd = 0.9) {
    const P = this.player;
    if (!P || !P.alive || P.frozen || P.invulnerable > 0) return false;
    if ((this._hurtCd[key] || -1) > this.t) return false;
    this._hurtCd[key] = this.t + cd;
    _v.subVectors(P.position, from).setY(0);
    if (_v.lengthSq() < 1e-4) _v.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    _v.normalize();
    P.damage(amount, { source: this, team: TEAM_MURK, dir: _v.clone(), point: P.hitCenter(new THREE.Vector3()), kind: 'boss' });
    if (knock > 0 && P.alive) {
      P.velocity.x = _v.x * knock; P.velocity.z = _v.z * knock;
      P.velocity.y = Math.max(P.velocity.y, up);
      if (up > 0) P.grounded = false;
    }
    return true;
  }

  /** Spawn an add (enemy) and track it. Returns the entity or null. */
  spawnAdd(type, pos, extra = {}) {
    const e = spawnEntity(this.S, { type, pos: [pos.x, pos.y, pos.z], alerted: true, group: 'boss-adds', ...extra });
    if (e) this.adds.push(e);
    return e;
  }
  addsAlive() {
    let n = 0;
    for (const a of this.adds) if (!a.dead && a.alive !== false) n++;
    return n;
  }

  /** Ground point below p (static geometry), or p itself. */
  ground(p, out = new THREE.Vector3()) {
    const hit = this.S.level.raycast(_w.copy(p).setY(p.y + 1.5), DOWN, 40, { staticOnly: true });
    return hit ? out.copy(hit.point) : out.copy(p);
  }

  // ---- damage / feedback ----------------------------------------------------------------------
  onPartHit(part, amount, info = {}) {
    if (this.defeated) return;
    const S = this.S;
    if (part.kind === 'armor') { this.armorPing(info.point || part.center); return; }
    const dmg = Math.min(part.hp, amount);
    part.hp -= dmg;
    part.flash = 1;
    const pt = info.point || part.center;
    S.fx.burst(pt, UP, this.pal.hero, 9, 5.5, { size: 0.07, spread: 1.3 });
    S.fx.burst(pt, UP, part.color, 4, 7, { size: 0.05, spread: 1.6, life: 0.35 });
    if (this.rt - this._lastHitSfx > 0.07) {
      this._lastHitSfx = this.rt;
      S.audio?.sfx('boss_hit', { pos: pt, volume: 0.75, pitch: 0.9 + (1 - part.hp / part.maxHp) * 0.35 });
    }
    S.shake(pt, 0.05);
    this.onWeakHit?.(part, dmg, info);
    this.updateBar();
    if (part.hp <= 0.001 && !part.broken) {
      part.hp = 0;
      part.broken = true;
      part.setOpen(false);
      S.fx.explosion(pt, UP, this.pal.hero, 2.2);
      S.fx.burst(pt, UP, part.color, 24, 9, { size: 0.09, spread: 1.4 });
      S.audio?.sfx('boss_burst', { pos: pt, volume: 1 });
      S.shake(pt, 0.45);
      S.flash('#ffffff', 0.35);
      this.onWeakBroken(part, info);
      this.updateBar();
    }
  }
  onWeakBroken(part, info) { void part; void info; }

  armorPing(point) {
    const S = this.S;
    this._armorPings++;
    if (this.rt - (this._pingT || -1) > 0.1) {
      this._pingT = this.rt;
      S.audio?.sfx('boss_ping', { pos: point, volume: 0.35 });
      S.fx.burst(point, UP, '#fff3c4', 4, 4, { size: 0.035, life: 0.25, gravity: 10 });
    }
    if (!this._armorHinted && this._armorPings > 14) {
      this._armorHinted = true;
      this.hint(this.armorHint || 'Armour plating! Aim for the glowing weak spot.', 4);
    }
  }
  /** Projectiles that hit a solid boss collider. */
  onInkHit(p, hit) {
    if (this.defeated || p.team === TEAM_MURK) return;
    this.armorPing(hit.point);
  }

  // ---- fixed step -----------------------------------------------------------------------------
  step(dt) {
    this.t += dt;
    if (this.timers.length) {
      for (let i = 0; i < this.timers.length; i++) {
        const tm = this.timers[i];
        if (tm.at <= this.t) { this.timers.splice(i--, 1); try { tm.fn(); } catch (e) { console.error('boss timer', e); } }
      }
    }
    this.warnRings.step(dt);
    if (this.dormant) { this.idle?.(dt); this.stateT += dt; this.group.updateMatrixWorld(true); return; }
    if (!this.started) { this.started = true; this.onStart?.(); this.updateBar(); }
    this.grace = Math.max(0, this.grace - dt);
    if (this.adds.length > 8) this.adds = this.adds.filter((a) => !a.dead);
    if (this.defeated) {
      this.defeatT += dt;
      this._defeatStep(dt);
    } else {
      this.think(dt);
    }
    this.stateT += dt;
    this.group.updateMatrixWorld(true);
  }
  think(dt) { void dt; }

  // ---- per frame ------------------------------------------------------------------------------
  render(dt) {
    this.rt += dt;
    // slow-motion lasts ~1.2 s of REAL time; never fight the story director's time-stop (0)
    if (this._slowOn) {
      this._slow -= dt;
      if (this._slow <= 0 && this.S.timeScale !== 0) { if (this.S.timeScale < 1) this.S.timeScale = 1; this._slowOn = false; }
    }
    this.animate(dt);
    this.group.updateMatrixWorld(true);
    const pulse = 0.5 + 0.5 * Math.sin(this.rt * 9);
    for (const p of this.parts) {
      p.track();
      if (p.kind !== 'weak') continue;
      p.flash = Math.max(0, p.flash - dt * 7);
      const on = (p.open || this.dormant) && !p.broken;
      const k = p.broken ? 0.08 : on ? p.baseGlow + pulse * 1.6 : p.dimGlow;
      for (const m of p.mats) {
        m.emissive.copy(p.broken ? this.pal.steelDark : p.color).lerp(WHITE, p.flash);
        m.emissiveIntensity = k + p.flash * 3;
        if (m.userData.baseColor) m.color.copy(p.broken ? this.pal.steelDark : m.userData.baseColor);
      }
      if (p.glow) {
        p.glow.visible = !p.broken;
        p.glow.material.opacity = on ? 0.45 + 0.4 * pulse + p.flash * 0.4 : 0.12;
        p.glow.scale.setScalar(p.glowSize * (on ? 1 + 0.25 * pulse + p.flash * 0.5 : 0.7));
      }
    }
    this.warnRings.render(this.rt);
  }
  animate(dt) { void dt; }

  // ---- defeat ---------------------------------------------------------------------------------
  startDefeat() {
    if (this.defeated) return;
    const S = this.S;
    this.defeated = true;
    this.alive = false;
    this.defeatT = 0;
    this._boomT = 0.2;
    this.clearTimers();
    this.warnRings.clear();
    for (const p of this.parts) { p.setOpen(false); p.dispose(); }
    S.hud?.bossBar(null);
    S.audio?.sfx('boss_die', { volume: 1 });
    S.audio?.sfx('boss_roar', { volume: 0.9, pitch: 0.75 });
    S.flash('#ffffff', 1);
    S.camRig?.addTrauma?.(0.9);
    // slow-mo ~1.2 s real time
    if (S.timeScale == null || S.timeScale >= 1) { S.timeScale = 0.3; this._slow = 1.2; this._slowOn = true; }
    // the adds flee the scene
    for (const a of this.adds) {
      if (a.dead || a.alive === false) continue;
      try { a.damage?.(99999, { source: this.player, team: TEAM_HERO, kind: 'special', point: a.position?.clone?.() }); } catch { /* ignore */ }
    }
    this.onDefeatStart?.();
  }

  _defeatStep(dt) {
    const S = this.S;
    const until = this.defeatBooms ?? 3.2;
    if (this.defeatT < until) {
      this._boomT -= dt;
      if (this._boomT <= 0 && this.anchors.length) {
        this._boomT = 0.16 + Math.random() * 0.16;
        const a = this.anchors[Math.floor(Math.random() * this.anchors.length)];
        a.getWorldPosition(_v);
        _v.x += (Math.random() - 0.5) * 1.2; _v.y += (Math.random() - 0.5) * 1.2; _v.z += (Math.random() - 0.5) * 1.2;
        S.fx.explosion(_v, UP, this.pal.hero, 1.6 + Math.random() * 1.2);
        S.fx.burst(_v, UP, '#ffffff', 6, 8, { size: 0.05, life: 0.4 });
        S.audio?.sfx(Math.random() < 0.5 ? 'boom' : 'bigboom', { pos: _v, volume: 0.8 });
        S.shake(_v, 0.3);
        // splash hero ink on the floor below
        const g = S.level.raycast(_w.copy(_v).setY(_v.y + 0.5), DOWN, 30, { staticOnly: true });
        if (g) S.ink.paint(g.point, 1.8 + Math.random() * 1.4, TEAM_HERO, g.normal, { source: this.player });
      }
    }
    this.defeatStep?.(dt, this.defeatT);
    if (!this.done && this.defeatT >= (this.defeatDuration ?? 4.2)) this.finishDefeat();
  }

  finishDefeat() {
    if (this.done) return;
    this.done = true;
    const S = this.S;
    this.removeColliders();
    const c = this.finalBlastAt ? this.finalBlastAt(_v) : this.group.getWorldPosition(_v);
    const g = S.level.raycast(_w.copy(c).setY(c.y + 1), DOWN, 60, { staticOnly: true });
    const at = g ? g.point : c;
    inkExplosion(S, at, g ? g.normal : UP, TEAM_HERO, { paintRadius: 7, damage: 0, owner: this.player, sound: 'bigboom' });
    S.fx.explosion(c, UP, this.pal.hero, 4.5);
    S.flash(`#${this.pal.hero.getHexString()}`, 0.5);
    S.shake(c, 1);
    this.onFinalBlast?.();
    S.events.emit('bossDefeated', { id: this.type, name: this.bossName, boss: this });
    const m = S.mode;
    if (!m?.complete || m.kind === 'sandbox') S.hud?.toast(`${this.bossName} defeated!`, 'big');
  }

  // ---- teardown -------------------------------------------------------------------------------
  dispose() {
    for (const off of this._offs) off();
    for (const p of this.parts) p.dispose();
    this.removeColliders();
    this.warnRings.dispose();
    this.beams?.forEach((b) => b.dispose());
    if (this._slowOn && this.S.timeScale > 0 && this.S.timeScale < 1) this.S.timeScale = 1;
    if (!this.dormant && !this.defeated) this.S.hud?.bossBar(null);
    this.onDispose?.();
    super.dispose();
    disposeTree(this.group);
  }
}

export const INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });
INVISIBLE.userData.cached = true;

/** Deterministic 0..1 hash. */
export function hash01(a, b = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
