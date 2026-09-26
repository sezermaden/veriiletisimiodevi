// Murk Corps shared framework: the MurkEnemy base class (perception, state machine, ground
// physics, hit feedback, death pop, pearl drops, alert pop-ups), cached procedural geometry and
// the "trooper" body used by gloopers, shield gloopers, rollerbrutes and bomblobs.
//
// States: idle | patrol → alert ('!' pop-up, reaction delay) → attack → search ('?') → return.
// Subclasses implement behave(dt) (fixed step: set this.wish / this.faceYaw, fire) and
// animate(dt) (per rendered frame).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Actor, spawnEntity, entityTypes } from '../base.js';
import { TEAM_HERO, TEAM_MURK, TEAM_NONE } from '../../ink/ink-system.js';
import { makeContacts } from '../../world/level.js';
import { charMat } from '../../actors/materials.js';
import { inkExplosion } from '../../weapons/base.js';
import { softSprite } from '../../world/textures.js';
import './sfx.js';

export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);
const WHITE = new THREE.Color(1, 1, 1);
const DEG = Math.PI / 180;
const GRAVITY = 24;
/** Speed multiplier for Murk troops wading through hero ink. */
export const HERO_INK_SLOW = 0.45;
const POP_TIME = 0.13;

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _mv = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _tc = new THREE.Vector3();
const _r = new THREE.Vector3();
const _sv = new THREE.Vector3();
const _gp = new THREE.Vector3();
const _gn = new THREE.Vector3();
const _hd = new THREE.Vector3();
const COLLIDER_MAT = new THREE.MeshBasicMaterial({ visible: false });

// ---------------------------------------------------------------------------------------------
// Geometry cache (module-level, shared by every enemy, never disposed)
const GEO = new Map();
export function geo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
}

/** Re-weld + smooth normals (extrusions come out faceted otherwise). */
function smooth(g) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g.clearGroups();
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  g.dispose();
  return m;
}

export const G = {
  sphere: (r, w = 20, h = 14) => geo(`s:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h)),
  hemi: (r, w = 24, h = 10) => geo(`h:${r}:${w}:${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
  capsule: (r, len, cs = 5, rs = 12) => geo(`c:${r}:${len}:${cs}:${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs)),
  /** Capsule lying along +Z (from z=0 forward). */
  capsuleZ: (r, len) => geo(`cz:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 5, 12).rotateX(Math.PI / 2).translate(0, 0, len / 2 + r)),
  cyl: (rt, rb, h, seg = 16, open = false) => geo(`y:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)),
  /** Cylinder lying along +Z, centred. */
  cylZ: (rt, rb, h, seg = 16) => geo(`yz:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg).rotateX(Math.PI / 2)),
  /** Cylinder lying along X, centred. */
  cylX: (r, h, seg = 24) => geo(`yx:${r}:${h}:${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(Math.PI / 2)),
  box: (w, h, d) => geo(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
  torus: (R, r, rs = 8, ts = 24, arc = Math.PI * 2) => geo(`t:${R}:${r}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc)),
  cone: (r, h, seg = 10) => geo(`k:${r}:${h}:${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  /** Rounded box centred on the origin (w along X, h along Y, d along Z). */
  rbox: (w, h, d, r = 0.03) => geo(`rb:${w}:${h}:${d}:${r}`, () => {
    const b = Math.min(r, d * 0.45, w * 0.45, h * 0.45);
    const sw = w - 2 * b, sh = h - 2 * b;
    const rr = Math.max(0.002, Math.min(r, sw * 0.49, sh * 0.49));
    const s = new THREE.Shape();
    const x = -sw / 2, y = -sh / 2;
    s.moveTo(x + rr, y);
    s.lineTo(x + sw - rr, y); s.quadraticCurveTo(x + sw, y, x + sw, y + rr);
    s.lineTo(x + sw, y + sh - rr); s.quadraticCurveTo(x + sw, y + sh, x + sw - rr, y + sh);
    s.lineTo(x + rr, y + sh); s.quadraticCurveTo(x, y + sh, x, y + sh - rr);
    s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
    const depth = Math.max(0.001, d - 2 * b);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5 });
    g.translate(0, 0, -depth / 2);
    return smooth(g);
  }),
  /** Lathe from [[radius, y], ...]. */
  lathe: (key, pts, seg = 28) => geo(`l:${key}:${seg}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)),
  /** Tube through points. */
  tube: (key, pts, r, segs = 20, rs = 8) => geo(`tb:${key}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), segs, r, rs, false)),
  /**
   * Tube through points whose radius tapers from r0 to r1; flatY squashes the cross-section
   * vertically (roots lying on the ground).
   */
  taperTube: (key, pts, r0, r1, segs = 20, rs = 10, flatY = 1) => geo(`tt:${key}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, segs, 1, rs, false);
    const pos = g.attributes.position;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, c);
      const r = r0 + (r1 - r0) * t;
      for (let j = 0; j <= rs; j++) {
        const k = i * (rs + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r);
        v.y *= flatY;
        pos.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
      }
    }
    g.computeVertexNormals();
    return g;
  }),
  /** Merge several (geometry, matrix) pairs into one cached geometry. */
  merged: (key, build) => geo(`m:${key}`, () => {
    // normalise every part to non-indexed position+normal so mergeGeometries accepts them
    const gs = build().map(([g, m]) => {
      const c = g.index ? g.toNonIndexed() : g.clone();
      for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal') c.deleteAttribute(k);
      c.clearGroups();
      if (m) c.applyMatrix4(m);
      return c;
    });
    const out = mergeGeometries(gs, false);
    gs.forEach((g) => g.dispose());
    return out;
  }),
};

/** Matrix helper for merged parts: position, euler rotation, scale. */
export function M(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}

export function mesh(g, m, parent = null, cast = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  if (parent) parent.add(o);
  return o;
}

// ---------------------------------------------------------------------------------------------
/** Session-aware palette: the tar and trims follow the Murk ink colour (colour-blind palettes). */
export function murkPalette(session) {
  const ink = session.ink.color(TEAM_MURK).clone();
  const tar = new THREE.Color('#0e0718').lerp(ink, 0.1);
  return {
    ink,
    inkBright: ink.clone().lerp(WHITE, 0.3),
    tar,
    tarLight: tar.clone().lerp(ink, 0.45),
    rim: ink.clone().lerp(WHITE, 0.55),
    steel: new THREE.Color('#6a7184'),
    steelDark: new THREE.Color('#2b2f3b'),
    rubber: new THREE.Color('#1c1d24'),
    hat: new THREE.Color('#d8a72e'),
    hazard: new THREE.Color('#ffc53a'),
    glow: new THREE.Color('#c8ff3a'),
    angry: new THREE.Color('#ff3b2a'),
    wary: new THREE.Color('#ffae2a'),
    dark: new THREE.Color('#0d0714'),
  };
}

// Alert / search pop-up textures (shared).
const POP_TEX = {};
function popupTexture(ch) {
  if (POP_TEX[ch]) return POP_TEX[ch];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const fill = ch === '!' ? '#ffd23a' : '#8fe6ff';
  const ink = '#1a0f2e';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(36, 12); g.lineTo(92, 12); g.quadraticCurveTo(116, 12, 116, 36);
  g.lineTo(116, 70); g.quadraticCurveTo(116, 94, 92, 94);
  g.lineTo(76, 94); g.lineTo(62, 118); g.lineTo(56, 94);
  g.lineTo(36, 94); g.quadraticCurveTo(12, 94, 12, 70);
  g.lineTo(12, 36); g.quadraticCurveTo(12, 12, 36, 12);
  g.closePath();
  g.lineWidth = 14; g.strokeStyle = ink; g.stroke();
  g.fillStyle = fill; g.fill();
  // glossy highlight
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath(); g.ellipse(44, 30, 18, 8, -0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink;
  g.font = '900 76px "Bungee", "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 64, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  POP_TEX[ch] = t;
  return t;
}

function turnToward(a, b, maxStep) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}
export function angleDiff(a, b) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export function applySpread(v, deg) {
  if (deg <= 0) return v;
  const s = deg * DEG;
  _r.crossVectors(v, UP);
  if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
  _r.normalize();
  return v.applyAxisAngle(UP, (Math.random() * 2 - 1) * s).applyAxisAngle(_r, (Math.random() * 2 - 1) * s * 0.5).normalize();
}

let pearlWarned = false;

/** Numeric difficulty multiplier (0.6..1.6); accepts a number or 'easy' | 'normal' | 'hard'. */
const DIFF_NAMES = { easy: 0.8, normal: 1, hard: 1.25 };
function difficultyOf(session) {
  const d = session.difficulty ?? session.mode?.difficulty;
  const n = typeof d === 'number' ? d : DIFF_NAMES[d] ?? 1;
  return Number.isFinite(n) ? clamp(n, 0.6, 1.6) : 1;
}

// ---------------------------------------------------------------------------------------------
export class MurkEnemy extends Actor {
  /**
   * @param {object} o  hp, hitRadius, hitHeight, aggro, walker, radius, height, speed, accel,
   *   turnRate, knockMul, pearls [min,max], deathPaint, popupH, eyeH, loseTime, searchTime
   */
  constructor(session, def, o = {}) {
    const diff = difficultyOf(session);
    super(session, def, {
      team: TEAM_MURK,
      hp: Math.round((o.hp ?? 80) * (0.85 + 0.15 * diff)),
      hitRadius: o.hitRadius ?? 0.5,
      hitHeight: o.hitHeight ?? 1.1,
    });
    this.diff = diff;
    this.groupName = def.group ?? null;
    this.aggro = def.aggro ?? o.aggro ?? 16;
    this.cullDist = def.cullDist ?? Math.max(90, this.aggro * 2.5);   // session distance cull (hidden, still simulated)
    this.pal = murkPalette(session);
    this.yaw = def.yaw ?? 0;
    this.faceYaw = this.yaw;
    this.home = this.position.clone();
    this.homeYaw = this.yaw;
    this.patrol = Array.isArray(def.patrol) && def.patrol.length ? def.patrol.map((p) => new THREE.Vector3().fromArray(p)) : null;
    this.patrolIdx = 0;
    this.waitT = 0;
    this.state = this.patrol ? 'patrol' : 'idle';
    this.stateT = 0;
    this.target = null;
    this.canSee = false;
    this.sinceSeen = 99;
    this.losT = Math.random() * 0.15;
    this.lastSeen = new THREE.Vector3();
    this.lastSeenVel = new THREE.Vector3();
    this.searchPoint = new THREE.Vector3();
    this.searchYaw = 0;
    this.reaction = 0;
    this.alertIn = -1;
    this.lookT = 1 + Math.random() * 2;
    this.loseTime = o.loseTime ?? 2.6;
    this.searchTime = o.searchTime ?? 6;
    this.eyeH = o.eyeH ?? (this.hitHeight * 0.7);
    this.usesPopup = o.popup !== false;
    this.turnsGroup = o.turnsGroup !== false;   // false: subclass applies this.yaw to a sub-part

    // physics
    this.walker = o.walker !== false;
    this.radius = o.radius ?? 0.42;
    this.height = o.height ?? 1.1;
    this.speed = o.speed ?? 2.6;
    this.accel = o.accel ?? 9;
    this.turnRate = o.turnRate ?? 7;
    this.knockMul = o.knockMul ?? 1;
    this.maxDrop = o.maxDrop ?? 0.9;
    this.contacts = makeContacts();
    this.grounded = true;
    this.groundFace = -1;
    this.groundDyn = null;
    this.groundInk = TEAM_NONE;
    this.inkSlowed = false;
    this.wish = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.atLedge = false;
    this.hitWall = false;
    this.blockedT = 0;
    this.stuckT = 0;
    this.detour = 0;
    this.detourDir = 1;
    this._sleepT = 0;
    this.strafeT = 0;
    this.strafeDir = 1;

    // feedback / animation
    this.t = Math.random() * 10;
    this.squash = 0;
    this.squashV = 0;
    this.hurtT = 0;
    this.walkPhase = Math.random() * 6;
    // level/spawner override: pearls: n | [min, max] (pod spawn drop less so a pod can't be farmed)
    this.pearlRange = typeof def.pearls === 'number' ? [def.pearls, def.pearls]
      : Array.isArray(def.pearls) && def.pearls.length === 2 ? def.pearls : (o.pearls ?? [1, 2]);
    this.deathPaint = o.deathPaint ?? 1.8;
    this.popupH = o.popupH ?? (this.hitHeight + 0.6);
    this.dyingT = -1;
    this.deathInfo = null;
    this._flash = [];
    this._flashK = -1;
    this._popup = null;
    this._popT = 0;
    this._popLife = 1;
    this._smokeT = 0;

    this.root = new THREE.Group();
    this.group.add(this.root);
    this.group.rotation.y = this.turnsGroup ? this.yaw : 0;

    this.groundY = this.position.y;              // last grounded height (air ledge guard)
    this._launched = false;                      // spat out by a pod: fly free until touchdown
    if (def.launch) { this.velocity.fromArray(def.launch); this.grounded = false; this._launched = true; }
    this._pendingAlert = !!def.alerted;
    this.dyn = null;                             // optional solid collider (static enemies)
  }

  // ---- materials ----------------------------------------------------------------------------
  /** Per-instance character material that takes part in the white hit flash. */
  mat(color, opts = {}, flash = true) {
    const m = charMat(color, { rim: 0.4, rimColor: this.pal.rim, ...opts });
    this.own(m);
    if (flash) this._flash.push({ m, e: m.emissive.clone(), i: m.emissiveIntensity });
    return m;
  }

  /** Tag a material so static parts using it can be merged into one vertex-coloured mesh. */
  cls(m, bakeClass) { m.userData.bakeClass = bakeClass; return m; }
  metal(color, opts = {}) { return this.cls(this.mat(color, { roughness: 0.34, metalness: 0.55, rim: 0.35, ...opts }), 'metal'); }
  matte(color, opts = {}) { return this.cls(this.mat(color, { roughness: 0.5, rim: 0.32, ...opts }), 'matte'); }

  _classMat(c) {
    this._clsMats = this._clsMats || {};
    if (!this._clsMats[c]) {
      const m = c === 'metal' ? this.mat('#ffffff', { roughness: 0.34, metalness: 0.55, rim: 0.35 }) : this.mat('#ffffff', { roughness: 0.5, rim: 0.32 });
      m.vertexColors = true;
      this._clsMats[c] = m;
    }
    return this._clsMats[c];
  }

  /** Register a rigid sub-assembly: its static direct mesh children get merged on first render. */
  rigid(group, key) { (this._rigid || (this._rigid = [])).push([group, key]); return group; }

  /**
   * Merge the direct, childless, non-`keep` mesh children of `group` that share a material (or a
   * bake class) into one mesh. Merged geometry is cached per enemy type, so every instance of a
   * type shares it; draw calls drop by ~40%.
   */
  _bake(group, key) {
    const buckets = new Map();
    for (const c of group.children) {
      if (!c.isMesh || c.userData.keep || c.children.length || !c.visible) continue;
      const k = c.material.userData.bakeClass || c.material;
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(c);
    }
    let idx = 0;
    for (const [k, list] of buckets) {
      const i = idx++;
      if (list.length < 2) continue;
      const g = geo(`bake:${this.type}:${key}:${i}`, () => {
        const parts = list.map((c) => {
          c.updateMatrix();
          const src = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
          for (const a of Object.keys(src.attributes)) if (a !== 'position' && a !== 'normal') src.deleteAttribute(a);
          src.clearGroups();
          src.applyMatrix4(c.matrix);
          const n = src.attributes.position.count, col = new Float32Array(n * 3), cc = c.material.color;
          for (let j = 0; j < n; j++) { col[j * 3] = cc.r; col[j * 3 + 1] = cc.g; col[j * 3 + 2] = cc.b; }
          src.setAttribute('color', new THREE.BufferAttribute(col, 3));
          return src;
        });
        const out = mergeGeometries(parts, false);
        parts.forEach((p) => p.dispose());
        out.computeBoundingSphere();
        return out;
      });
      const m = new THREE.Mesh(g, typeof k === 'string' ? this._classMat(k) : k);
      m.castShadow = list.some((c) => c.castShadow);
      for (const c of list) group.remove(c);
      group.add(m);
    }
  }

  /** One-time model pass: merge rigid parts, keep shadows to silhouette-sized pieces. */
  _finalize() {
    this._final = true;
    for (const [g, k] of this._rigid || []) this._bake(g, k);
    this.group.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const s = Math.max(o.scale.x, o.scale.y, o.scale.z);
      if (o.geometry.boundingSphere.radius * s < 0.13) o.castShadow = false;
    });
  }

  /** Small bits hidden when the enemy is far from the camera. */
  detail(...objs) { (this.details || (this.details = [])).push(...objs); return objs[0]; }

  /** Glowing (emissive) material: eyes, lures, canisters. Not flashed. */
  glowMat(color, intensity = 1.4) {
    const m = charMat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.25, rim: 0.2, rimColor: '#ffffff' });
    this.own(m);
    return m;
  }

  /** Additive glow halo sprite. */
  halo(color, size, parent, opacity = 0.7) {
    const m = new THREE.SpriteMaterial({ map: softSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    this.own(m);
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    if (parent) parent.add(s);
    return s;
  }

  /**
   * Solid, invisible collider (a tapered cylinder) so the player and troops can't walk through a
   * static enemy. Shots that strike it instead of the hit sphere are forwarded by onInkHit.
   */
  solidCollider(rTop, rBottom, height, y0 = 0) {
    const g = this.own(new THREE.CylinderGeometry(rTop, rBottom, height, 12, 1));
    g.translate(0, y0 + height / 2, 0);
    const m = new THREE.Mesh(g, COLLIDER_MAT);
    m.visible = false;
    this.group.add(m);
    this.group.updateMatrixWorld(true);
    this.dyn = this.session.level.addDynamic(m, { owner: this, tag: 'enemy' });
    return m;
  }

  _dropCollider() {
    if (this.dyn) { this.session.level.removeDynamic(this.dyn); this.dyn = null; }
  }

  /** A projectile hit our collider (world hit) rather than the hit sphere: count it as a shot. */
  onInkHit(p, hit) {
    if (!this.alive || p.team === this.team || p.team === TEAM_NONE) return;
    const S = this.session;
    let dmg = S.projectiles._damageFor ? S.projectiles._damageFor(p) : p.damage;
    // the projectile's splash (applied by the core just before this call) already reached us
    if (p.splash) {
      const d = this.hitCenter(_v).distanceTo(hit.point);
      if (d < p.splash.radius) dmg -= p.splash.damage * (1 - (d / p.splash.radius) * 0.6);
    }
    if (!(dmg > 0)) return;
    _hd.copy(p.vel);
    if (_hd.lengthSq() > 1e-8) _hd.normalize(); else _hd.set(0, 0, 1);
    const applied = this.damage(dmg, { source: p.owner, team: p.team, point: hit.point, dir: _hd, kind: 'shot' });
    if (applied !== false) S.events.emit('hit', { target: this, source: p.owner, damage: dmg, point: hit.point.clone() });
  }

  dispose() {
    this._dropCollider();
    super.dispose();
  }

  get aware() { return this.state === 'alert' || this.state === 'attack'; }

  hitCenter(out) { return out.copy(this.position).setY(this.position.y + this.hitHeight * 0.5); }

  eyePos(out) { return out.copy(this.position).setY(this.position.y + this.eyeH); }

  // ---- perception ---------------------------------------------------------------------------
  perceive(dt) {
    const S = this.session, p = S.player;
    this.losT -= dt;
    if (!p || !p.alive || p.untargetable || p.frozen) { this.canSee = false; return false; }
    if (this.losT > 0) return this.canSee;
    this.losT = 0.12 + Math.random() * 0.06;
    const eye = this.eyePos(_eye);
    p.hitCenter(_tc);
    const dist = eye.distanceTo(_tc);
    const alerted = this.aware || this.state === 'search';
    let range = alerted ? this.aggro * 1.4 : this.aggro;
    if (p.submerged) {
      const moving = Math.hypot(p.velocity.x, p.velocity.z) > 1.2 || Math.abs(p.velocity.y) > 1.5;
      range = Math.min(range, moving ? 7 : 3);
    }
    let ok = dist <= range;
    // unaware troops only see in front of them (sneaking up from behind works), but always
    // notice something bumping into them
    if (ok && !alerted && dist > 4.5 && this.visionCone < 1) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const dx = _tc.x - eye.x, dz = _tc.z - eye.z;
      const l = Math.hypot(dx, dz) || 1;
      if ((dx * fx + dz * fz) / l < this.visionCone) ok = false;
    }
    if (ok) ok = S.level.lineOfSight(eye, _tc);
    this.canSee = ok;
    if (ok) {
      this.target = p;
      this.lastSeen.copy(p.position);
      this.lastSeenVel.copy(p.velocity);
    }
    return ok;
  }

  /** cos of the half-angle of the unaware vision cone (-1 = all round). */
  get visionCone() { return -0.2; }

  setState(s) {
    const prev = this.state;
    this.state = s;
    this.stateT = 0;
    if (s === 'search') {
      this.searchPoint.copy(this.lastSeen).addScaledVector(this.lastSeenVel.setY(0), 0.6);
      this.searchYaw = this.yaw;
    }
    this.onState?.(s, prev);
  }

  becomeAlert(quick = false) {
    if (this.aware || !this.alive) return;
    const S = this.session;
    this.setState('alert');
    this.reaction = (quick ? 0.22 : 0.5 + Math.random() * 0.3) / Math.max(0.5, this.diff);
    if (this.usesPopup) this.popup('!');
    S.audio?.sfx('alert', { pos: this.position, volume: 0.75 });
    if (this.walker && this.grounded) { this.velocity.y = 3.6; this.grounded = false; }
    this.squashV -= 5;
    if (this.target) this.faceYaw = Math.atan2(this.lastSeen.x - this.position.x, this.lastSeen.z - this.position.z);
    // rally nearby squadmates
    for (const e of S.entities) {
      if (e === this || !(e instanceof MurkEnemy) || !e.alive || e.aware || e.alertIn >= 0) continue;
      if (e.position.distanceToSquared(this.position) > 110) continue;
      e.alertIn = 0.35 + Math.random() * 0.45;
      e.target = this.target;
      e.lastSeen.copy(this.lastSeen);
    }
  }

  // ---- fixed step ---------------------------------------------------------------------------
  step(dt) {
    const S = this.session;
    if (!this.alive) { this._stepDying(dt); return; }
    if (this._pendingAlert) {
      this._pendingAlert = false;
      if (S.player) { this.target = S.player; this.lastSeen.copy(S.player.position); this.becomeAlert(true); }
    }
    this.t += dt;
    this.stateT += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    const sees = this.perceive(dt);
    this.sinceSeen = sees ? 0 : this.sinceSeen + dt;
    if (this.alertIn >= 0) {
      this.alertIn -= dt;
      if (this.alertIn < 0 && !this.aware && S.player?.alive) this.becomeAlert(true);
    }
    switch (this.state) {
      case 'idle': case 'patrol': case 'return':
        if (sees) this.becomeAlert();
        break;
      case 'search':
        if (sees) this.becomeAlert(true);
        else if (this.stateT > this.searchTime) this.setState('return');
        break;
      case 'alert':
        if (this.stateT >= this.reaction) this.setState('attack');
        break;
      case 'attack':
        if (!S.player?.alive) { if (this.sinceSeen > 1) this.setState('return'); }
        else if (this.sinceSeen > this.loseTime) {
          this.setState('search');
          if (this.usesPopup) this.popup('?');
          S.audio?.sfx('murk_huh', { pos: this.position, volume: 0.5 });
        }
        break;
    }

    this.wish.set(0, 0, 0);
    this.behave(dt);
    if (this.walker) { this._separate(); this._physics(dt); }
    this.yaw = turnToward(this.yaw, this.faceYaw, this.turnRate * dt * (this.hurtT > 0 ? 0.5 : 1));
    if (this.turnsGroup) this.group.rotation.y = this.yaw;

    if (this.position.y < S.level.killY) this.die({ kind: 'fall', team: TEAM_HERO, silent: true });
  }

  /** Override: per-state behaviour. Default: wander when calm, face the target otherwise. */
  behave(dt) {
    if (this.state === 'attack' || this.state === 'alert') this.faceTarget();
    else this.wander(dt);
  }

  faceTarget() {
    const T = this.canSee && this.target ? this.target.position : this.lastSeen;
    const dx = T.x - this.position.x, dz = T.z - this.position.z;
    if (dx * dx + dz * dz > 1e-4) this.faceYaw = Math.atan2(dx, dz);
  }

  /** Horizontal distance to a point. */
  distXZ(p) { return Math.hypot(p.x - this.position.x, p.z - this.position.z); }

  /** Set wish velocity toward a point; returns the horizontal distance. */
  steerTo(point, speed, face = true) {
    _d.set(point.x - this.position.x, 0, point.z - this.position.z);
    const d = _d.length();
    if (d > 0.08) {
      _d.divideScalar(d);
      if (this.detour > 0) _d.applyAxisAngle(UP, this.detourDir * 1.15);
      this.wish.set(_d.x * speed, 0, _d.z * speed);
      if (face) this.faceYaw = Math.atan2(_d.x, _d.z);
    }
    return d;
  }

  /** Calm behaviour shared by ground troops: idle look-around, patrol, search, return. */
  wander(dt) {
    switch (this.state) {
      case 'idle': {
        this.lookT -= dt;
        if (this.lookT <= 0) {
          this.lookT = 2.2 + Math.random() * 2.8;
          this.faceYaw = this.homeYaw + (Math.random() - 0.5) * 1.5;
        }
        if (this.walker && this.distXZ(this.home) > 0.8) {
          this.steerTo(this.home, this.speed * 0.5);
          // home unreachable (knocked off its deck, walled in): settle where it stands
          if (this.blockedT > 2.5) { this.home.copy(this.position); this.blockedT = 0; }
        }
        break;
      }
      case 'patrol': {
        if (this.waitT > 0) {
          this.waitT -= dt;
          this.lookT -= dt;
          if (this.lookT <= 0) { this.lookT = 0.9 + Math.random(); this.faceYaw = this.yaw + (Math.random() - 0.5) * 2; }
          break;
        }
        const tgt = this.patrol[this.patrolIdx];
        const d = this.steerTo(tgt, this.speed * 0.55);
        if (d < 0.45 || this.blockedT > 1.4) {
          this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
          this.waitT = 0.8 + Math.random() * 1.2;
          this.blockedT = 0;
        }
        break;
      }
      case 'search': {
        const d = this.steerTo(this.searchPoint, this.speed * 0.75);
        if (d < 0.9 || this.blockedT > 1 || this.stateT > 3.5) {
          this.wish.set(0, 0, 0);
          this.faceYaw = this.searchYaw + Math.sin(this.stateT * 1.7) * 1.2;
        } else this.searchYaw = this.faceYaw;
        break;
      }
      case 'return': {
        const tgt = this.patrol ? this.patrol[this.patrolIdx] : this.home;
        const d = this.steerTo(tgt, this.speed * 0.6);
        if (d < 0.5 || this.stateT > 14 || !this.walker) {
          this.setState(this.patrol ? 'patrol' : 'idle');
          this.faceYaw = this.homeYaw;
          this.blockedT = 0;
        }
        break;
      }
    }
  }

  /**
   * Combat footwork: keep between minD and maxD of the target, strafe sideways, pursue the last
   * known position when the target is out of sight.
   */
  combatMove(dt, minD, maxD, strafeSpeed, approachSpeed = this.speed) {
    const T = this.target;
    if (!T) return;
    const aim = this.canSee ? T.position : this.lastSeen;
    _d.set(aim.x - this.position.x, 0, aim.z - this.position.z);
    const dist = _d.length() || 1;
    _d.divideScalar(dist);
    this.faceYaw = Math.atan2(_d.x, _d.z);
    if (!this.canSee) {
      if (dist > 1.2) this.steerTo(aim, approachSpeed * 0.85, false);
      return;
    }
    this.strafeT -= dt;
    if (this.strafeT <= 0 || ((this.atLedge || this.hitWall) && this.strafeT < 0.9)) {
      this.strafeT = 1.1 + Math.random() * 1.5;
      const r = Math.random();
      this.strafeDir = r < 0.25 ? 0 : (this.atLedge || this.hitWall) ? -this.strafeDir || 1 : r < 0.62 ? -1 : 1;
    }
    let fwd = 0;
    if (dist > maxD) fwd = 1; else if (dist < minD) fwd = -0.75;
    const sx = -_d.z, sz = _d.x;
    let wx = _d.x * fwd * approachSpeed + sx * this.strafeDir * strafeSpeed;
    let wz = _d.z * fwd * approachSpeed + sz * this.strafeDir * strafeSpeed;
    const l = Math.hypot(wx, wz), cap = Math.max(approachSpeed, strafeSpeed);
    if (l > cap) { wx *= cap / l; wz *= cap / l; }
    this.wish.set(wx, 0, wz);
  }

  // ---- physics ------------------------------------------------------------------------------
  _groundAhead(vx, vz, sp) {
    // cached for a few steps while heading the same way (the probe looks far enough ahead)
    const dx = vx / sp, dz = vz / sp;
    if (this._gaT > 0 && dx * this._gaX + dz * this._gaZ > 0.94) { this._gaT--; return this._gaOk; }
    this._gaT = 2; this._gaX = dx; this._gaZ = dz;
    this._gaOk = this._probeAhead(vx, vz, sp);
    return this._gaOk;
  }

  _probeAhead(vx, vz, sp) {
    const look = this.radius + 0.22 + Math.min(0.55, sp * 0.12);
    const p = this.position;
    _c.set(p.x + (vx / sp) * look, p.y + 0.6, p.z + (vz / sp) * look);
    const h = this.session.level.raycast(_c, DOWN, 0.6 + this.maxDrop);
    if (!h) return false;
    if (h.normal.y < -0.3) return true;       // probe started inside a wall: let collision handle it
    return h.normal.y > 0.5;
  }

  /** Airborne variant: is there floor ahead no lower than the ledge we left (minus maxDrop)? */
  _airGroundAhead(vx, vz, sp) {
    const p = this.position, look = this.radius + 0.2;
    const top = Math.max(p.y, this.groundY) + 0.6;
    _c.set(p.x + (vx / sp) * look, top, p.z + (vz / sp) * look);
    const h = this.session.level.raycast(_c, DOWN, top - this.groundY + this.maxDrop + 0.05);
    if (!h) return false;
    return h.normal.y > 0.5 || h.normal.y < -0.3;
  }

  _physics(dt) {
    const S = this.session, level = S.level, v = this.velocity, p = this.position;
    let mul = 1;
    if (this.grounded && this.groundFace >= 0) {
      this.groundInk = S.ink.inkAt(this.groundFace, p);
      if (this.groundInk === TEAM_HERO) mul = HERO_INK_SLOW;
    } else this.groundInk = TEAM_NONE;
    this.inkSlowed = mul < 1;

    const k = Math.min(1, this.accel * dt * (this.grounded ? 1 : 0.12));
    v.x += (this.wish.x * mul - v.x) * k;
    v.z += (this.wish.z * mul - v.z) * k;
    if (this.knock.x || this.knock.z) {
      v.x += this.knock.x; v.z += this.knock.z;
      this.knock.set(0, 0, 0);
      this._sleepT = 0;
    }
    // never walk (or get pushed) off a ledge
    const hs2 = v.x * v.x + v.z * v.z;
    this.atLedge = false;
    if (hs2 > 0.01) {
      if (this.grounded) {
        if (!this._groundAhead(v.x, v.z, Math.sqrt(hs2))) {
          v.x = 0; v.z = 0;
          this.atLedge = true;
          this.blockedT += dt;
        }
      } else if (!this._launched && !this._airGroundAhead(v.x, v.z, Math.sqrt(hs2))) {
        // the alert hop and knockback taken mid-air must not carry a troop off its ledge either
        v.x = 0; v.z = 0;
      }
    }
    if (!this.grounded) v.y = Math.max(-30, v.y - GRAVITY * dt);

    // asleep: standing still on static ground → skip collision work (re-check twice a second)
    if (this.grounded && !this.groundDyn && hs2 < 1e-4 && Math.abs(v.y) < 1e-4) {
      this._sleepT -= dt;
      if (this._sleepT > 0) return;
    }
    this._sleepT = 0.5;

    const r = this.radius, top = Math.max(r + 0.01, this.height - r);
    _mv.copy(v).multiplyScalar(dt);
    const steps = Math.max(1, Math.ceil(_mv.length() / (r * 0.6)));
    _mv.divideScalar(steps);
    const x0 = p.x, z0 = p.z;
    let ground = false, wall = false;
    for (let i = 0; i < steps; i++) {
      p.add(_mv);
      _a.set(p.x, p.y + r, p.z);
      _b.set(p.x, p.y + top, p.z);
      const c = level.collideCapsule(_a, _b, r, this.contacts);
      p.set(_a.x, _a.y - r, _a.z);
      ground = ground || c.ground;
      wall = wall || c.wall;
      if (c.ceiling && v.y > 0) v.y = 0;
    }
    this.hitWall = wall;
    if (wall) {
      const n = this.contacts.wallNormal;
      const vn = v.x * n.x + v.z * n.z;
      if (vn < 0) { v.x -= n.x * vn; v.z -= n.z * vn; }
    }
    let gh = null;
    if (v.y <= 0.5) {
      const snap = this.grounded ? 0.4 : 0.06;
      gh = level.raycast(_a.set(p.x, p.y + 0.45, p.z), DOWN, 0.45 + snap);
      if (gh && gh.normal.y > 0.6) {
        // on a slope the capsule's bottom sphere rests r·(1/cosθ − 1) above the surface under
        // its centre; snapping the feet onto the surface sank it into the slope and the push-out
        // shoved wide troops back downhill every step (rollerbrutes couldn't climb ramps)
        p.y = gh.point.y + (gh.normal.y < 0.999 ? r * (1 / gh.normal.y - 1) : 0);
        ground = true;
      } else gh = null;
    }
    const was = this.grounded;
    if (ground && v.y <= 0.5) {
      this.grounded = true;
      this.groundY = p.y;
      if (gh) { this.groundFace = gh.faceId; this.groundDyn = gh.dynamic; } else { this.groundFace = this.contacts.groundFace; this.groundDyn = this.contacts.dynamic; }
      if (!was && v.y < -3) this.onLand(-v.y);
      if (!was && this._launched) {
        // spat out by a pod: this landing spot is home now (not the pod's centre)
        this._launched = false;
        this.home.copy(p);
        this.homeYaw = this.yaw;
      }
      if (v.y < 0) v.y = 0;
    } else {
      this.grounded = false;
      this.groundFace = -1;
      this.groundDyn = null;
    }
    if (this.grounded && this.groundDyn?.owner?.lastDelta) p.add(this.groundDyn.owner.lastDelta);

    // stuck against something → take a short detour
    const want = Math.hypot(this.wish.x, this.wish.z);
    if (want > 0.5 && this.grounded) {
      const moved = Math.hypot(p.x - x0, p.z - z0);
      if (moved < want * mul * dt * 0.3) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > 0.45) {
        this.stuckT = 0;
        this.detour = 0.9;
        this.detourDir = Math.random() < 0.5 ? -1 : 1;
        this.blockedT += 0.45;
      }
    } else this.blockedT = Math.max(0, this.blockedT - dt * 0.5);
    this.detour = Math.max(0, this.detour - dt);
  }

  /** Keep squadmates from overlapping (cheap pairwise push on the wish velocity). */
  _separate() {
    const p = this.position;
    for (const e of this.session.entities) {
      if (e === this || !e.walker || !e.alive || !(e instanceof MurkEnemy)) continue;
      const dx = p.x - e.position.x, dz = p.z - e.position.z;
      const min = this.radius + e.radius + 0.15;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || Math.abs(p.y - e.position.y) > 1.2) continue;
      const d = Math.sqrt(d2) || 0.01;
      const push = (min - d) / min * 3.5;
      this.wish.x += (dx / d) * push;
      this.wish.z += (dz / d) * push;
    }
  }

  onLand(speed) {
    this.squashV += Math.min(7, speed * 0.7);
    if (speed > 6) this.session.audio?.sfx('land', { pos: this.position, volume: 0.35 });
  }

  // ---- combat helpers -----------------------------------------------------------------------
  /**
   * Direction from `from` to the (predicted) target centre: leads a moving target and aims
   * above it to compensate for projectile drop. o: gravity, gravityDelay, lead, spread (deg).
   */
  aimAt(from, speed, o, out) {
    const T = this.target || this.session.player;
    if (this.canSee) T.hitCenter(_tc); else _tc.copy(this.lastSeen).setY(this.lastSeen.y + 0.6);
    const dist = from.distanceTo(_tc);
    const t = dist / speed;
    const lead = (o.lead ?? 0.65) * Math.min(1.25, this.diff);
    if (this.canSee) { _tc.x += T.velocity.x * t * lead; _tc.z += T.velocity.z * t * lead; }
    const g = o.gravity ?? 0;
    const tf = Math.max(0, t - (o.gravityDelay ?? 0));
    _tc.y += 0.5 * g * tf * tf;
    out.subVectors(_tc, from).normalize();
    return applySpread(out, (o.spread ?? 0) / Math.max(0.6, Math.sqrt(this.diff)));
  }

  /** Fire one Murk ink shot. o: speed, damage, size, radius, gravity, gravityDelay, paint, trail… */
  shoot(from, dir, o = {}) {
    const S = this.session;
    const speed = o.speed ?? 19;
    S.projectiles.spawn({
      pos: from, vel: _sv.copy(dir).multiplyScalar(speed), team: this.team, owner: this,
      damage: (o.damage ?? 18) * this.diff, size: o.size ?? 0.12, radius: o.radius ?? 0.15,
      gravity: o.gravity ?? 20, gravityDelay: o.gravityDelay ?? 0.18, life: o.life ?? 2.5,
      paint: { radius: o.paint ?? 0.55 },
      trail: o.trail === false ? null : { every: o.trailEvery ?? 1.25, radius: o.trailRadius ?? 0.32 },
      falloff: o.falloff ?? null, pierce: !!o.pierce, onHit: o.onHit, color: o.color,
    });
    S.fx.spray(from, _sv.copy(dir).multiplyScalar(3.5), this.pal.ink, 3, 1.4, { size: 0.04, life: 0.25 });
    S.audio?.sfx(o.sfx ?? 'murk_blast', { pos: from, volume: o.volume ?? 0.5, pitch: (o.pitch ?? 1) * (0.92 + Math.random() * 0.16) });
  }

  /** World position of a local point on a sub-object (updates that object's world matrix). */
  worldOf(obj, local, out) {
    obj.updateWorldMatrix(true, false);
    return out.copy(local).applyMatrix4(obj.matrixWorld);
  }

  // ---- damage & death -----------------------------------------------------------------------
  onDamaged(amount, info) {
    const S = this.session;
    this.hurtT = 0.22;
    this.squashV += Math.min(8, 2.5 + amount * 0.1);
    const c = this.hitCenter(_v);
    if (info.dir && this.knockMul > 0) {
      _d.set(info.dir.x, 0, info.dir.z);
      const l = _d.length();
      if (l > 1e-3) this.knock.addScaledVector(_d, (this.knockMul * Math.min(3.2, 0.7 + amount * 0.035)) / l);
    }
    const n = info.dir ? _gn.copy(info.dir).negate() : UP;
    S.fx.burst(info.point || c, n, this.pal.tarLight, 4, 3.5, { size: 0.05 });
    S.audio?.sfx('murk_hurt', { pos: c, volume: 0.35, pitch: 0.9 + Math.random() * 0.3, throttle: 0.08 });
    this.provoked(info.source);
  }

  /** Shot from the dark (or at the shield) → turn and fight whoever did it. */
  provoked(src) {
    if (!src || src === this || !src.position || src.team === this.team) return;
    // sources that aren't actors (a bomb, a sprinkler) point the troop at the player instead
    const T = src.velocity && src.hitCenter ? src : this.session.player;
    this.lastSeen.copy(src.position);
    if (!this.aware && T) { this.target = T; this.becomeAlert(true); }
  }

  onDeath(info) {
    this.deathInfo = info;
    this.dyingT = 0;
    this.canSee = false;
    this._dropCollider();
    if (this._popup) this._popup.visible = false;
    if (info.silent) {
      this.session.fx.burst(this.position, UP, this.pal.ink, 12, 5);
      this.remove();
      return;
    }
    this.session.audio?.sfx('murk_hurt', { pos: this.position, volume: 0.5, pitch: 1.5, throttle: 0 });
  }

  _stepDying(dt) {
    if (this.dead || this.dyingT < 0) return;
    this.dyingT += dt;
    if (this.dyingT >= POP_TIME) { this._pop(); this.remove(); }
  }

  /** The death pop: burst in the attacker's ink colour + a harmless splat of it on the ground. */
  _pop() {
    const S = this.session, info = this.deathInfo || {};
    const team = info.team && info.team !== this.team ? info.team : TEAM_HERO;
    const col = S.ink.color(team);
    const c = this.hitCenter(_c);
    const g = S.level.raycast(_a.copy(c), DOWN, 12, { staticOnly: true });
    if (g) { _gp.copy(g.point); _gn.copy(g.normal); } else { _gp.copy(this.position); _gn.copy(UP); }
    inkExplosion(S, _gp, _gn, team, { paintRadius: this.deathPaint, damage: 0, owner: info.source, sound: 'enemy_die' });
    S.fx.explosion(c, UP, col, 0.9 + this.hitRadius);
    S.fx.burst(c, UP, this.pal.tar, 12, 7, { size: 0.09, spread: 1.4 });
    S.fx.burst(c, UP, this.pal.ink, 6, 5, { size: 0.06, spread: 1.2 });
    S.fx.puff(c, col, 1.2 + this.hitRadius, 0.45, null, 2.2, 0.55);
    this.onPop?.(c, col, team);
    this._dropPearls(_gp);
  }

  _dropPearls(at) {
    const [a, b] = this.pearlRange;
    const n = a + Math.floor(Math.random() * (b - a + 1));
    if (n <= 0) return;
    if (!entityTypes().includes('pearl')) {
      if (!pearlWarned) { pearlWarned = true; console.warn('Murk Corps: "pearl" entity not registered — no pearl drops'); }
      return;
    }
    const x = this.position.x, z = this.position.z;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.7;
      const r = n > 1 ? 0.45 + Math.random() * 0.35 : 0;
      spawnEntity(this.session, { type: 'pearl', pos: [x + Math.cos(ang) * r, at.y + 0.5, z + Math.sin(ang) * r], drop: true });
    }
  }

  // ---- per-frame ----------------------------------------------------------------------------
  popup(ch) {
    if (!this._popup) {
      const m = new THREE.SpriteMaterial({ map: popupTexture('!'), transparent: true, depthWrite: false });
      this.own(m);
      this._popup = new THREE.Sprite(m);
      this._popup.renderOrder = 6;
      this.group.add(this._popup);
    }
    this._popup.material.map = popupTexture(ch);
    this._popup.visible = true;
    this._popT = 0;
    this._popLife = ch === '!' ? 1.1 : 1.5;
  }

  _renderPopup(dt) {
    const sp = this._popup;
    if (!sp || !sp.visible) return;
    this._popT += dt;
    const t = this._popT, L = this._popLife;
    if (t > L || !this.alive) { sp.visible = false; return; }
    const k = Math.min(1, t / 0.22);
    const back = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);   // easeOutBack
    const out = t > L - 0.18 ? Math.max(0, (L - t) / 0.18) : 1;
    const s = 0.62 * back * out;
    sp.scale.set(s, s, s);
    sp.position.set(0, this.popupH + Math.min(t, 0.3) * 0.5, 0);
    sp.material.opacity = out;
  }

  render(dt) {
    if (this.dead) return;
    if (!this._final) this._finalize();
    dt = Math.min(dt, 0.05);
    // distance LOD for tiny details (checked a few times a second)
    if (this.details && (this._lodT = (this._lodT || 0) - dt) <= 0) {
      this._lodT = 0.25 + Math.random() * 0.1;
      const far = this.session.camera.position.distanceToSquared(this.position) > 26 * 26;
      if (far !== this._far) { this._far = far; for (const o of this.details) o.visible = !far; }
    }
    if (this.turnsGroup) this.group.rotation.y = this.yaw;
    // squash & stretch spring
    this.squashV += (-this.squash * 190 - this.squashV * 13) * dt;
    this.squash += this.squashV * dt;
    const s = clamp(this.squash, -0.3, 0.38);
    this.root.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
    if (!this.alive) this.root.scale.multiplyScalar(1 + Math.min(1, this.dyingT / POP_TIME) * 0.35);
    // white hit flash
    const fk = !this.alive ? 1 : Math.min(1, this.flashT / 0.12);
    if (fk !== this._flashK) {
      this._flashK = fk;
      for (const f of this._flash) {
        f.m.emissive.copy(f.e).lerp(WHITE, fk);
        f.m.emissiveIntensity = f.i + (1.1 - f.i) * fk;
      }
    }
    this._renderPopup(dt);
    // wading through hero ink: sticky drips at the feet
    if (this.inkSlowed && this.alive && Math.random() < dt * 7 && (this.velocity.x || this.velocity.z)) {
      _v.copy(this.position).setY(this.position.y + 0.08);
      this.session.fx.burst(_v, UP, this.session.ink.color(TEAM_HERO), 2, 1.8, { size: 0.045, life: 0.35 });
    }
    // damage state: dark smoke from badly hurt troops
    if (this.alive && this.hp < this.maxHp * 0.5) {
      this._smokeT -= dt;
      if (this._smokeT <= 0) {
        this._smokeT = this.hp < this.maxHp * 0.25 ? 0.22 : 0.45;
        _v.copy(this.position).setY(this.position.y + this.hitHeight * 0.95);
        _v.x += (Math.random() - 0.5) * 0.3; _v.z += (Math.random() - 0.5) * 0.3;
        this.session.fx.puff(_v, '#3a3148', 0.35, 0.7, _d.set(0, 1.3, 0), 1.9, 0.45);
      }
    }
    this.animate(dt);
  }

  animate(dt) { void dt; }
}

// ---------------------------------------------------------------------------------------------
// Murk ink bomb pieces (shared by buzzdrones and bomblobs). Materials are cached per colour so
// bombs in flight never outlive their materials.
const BOMB_MATS = new Map();
export function bombMaterials(color) {
  const key = '#' + color.getHexString();
  let m = BOMB_MATS.get(key);
  if (!m) {
    m = {
      shell: charMat(color, { ink: true, rim: 0.55, rimColor: color.clone().lerp(WHITE, 0.5), emissiveIntensity: 0.3 }),
      cap: charMat('#2b2f3b', { roughness: 0.45, metalness: 0.5, rim: 0.3 }),
      light: new THREE.MeshBasicMaterial({ color: '#ff5a3a' }),
      band: charMat('#ffc53a', { roughness: 0.5, rim: 0.2 }),
    };
    BOMB_MATS.set(key, m);
  }
  return m;
}

/** A chunky Murk bomb: ink sphere, steel cap, hazard band, blinking light. */
export function bombModel(color, size = 0.2) {
  const m = bombMaterials(color);
  const g = new THREE.Group();
  mesh(G.sphere(size, 16, 12), m.shell, g);
  const band = mesh(G.torus(size * 0.98, size * 0.12, 6, 20), m.band, g);
  band.rotation.x = Math.PI / 2;
  const cap = mesh(G.cyl(size * 0.36, size * 0.44, size * 0.35, 12), m.cap, g);
  cap.position.y = size * 0.95;
  const light = mesh(G.sphere(size * 0.2, 10, 8), m.light, g, false);
  light.position.y = size * 1.2;
  g.userData.light = light;
  return g;
}

// ---------------------------------------------------------------------------------------------
// Trooper body (gloopers & friends)
const TROOPER_PROFILE = [[0.001, 0], [0.22, 0.012], [0.35, 0.06], [0.42, 0.15], [0.445, 0.27], [0.432, 0.4], [0.385, 0.53], [0.305, 0.64], [0.195, 0.73], [0.085, 0.785], [0.001, 0.795]];

function trooperDrips() {
  // glossy tar runs down the upper body (kept above the belly so they never read as legs)
  return G.merged('trooper-drips3', () => {
    const parts = [];
    for (const [a, len, y] of [[0.6, 0.12, 0.5], [1.2, 0.08, 0.44], [2.1, 0.14, 0.52], [2.9, 0.09, 0.46], [3.6, 0.13, 0.5], [4.3, 0.07, 0.42], [5.2, 0.12, 0.5], [5.8, 0.08, 0.45]]) {
      const yc = y - len * 0.5, yt = y - len - 0.012;
      const rAt = (yy) => (yy > 0.4 ? 0.432 - (yy - 0.4) * 0.36 : 0.445 - (0.4 - yy) * 0.1) - 0.012;
      const r1 = rAt(yc), r2 = rAt(yt);
      parts.push([G.capsule(0.028, len, 4, 8), M(Math.sin(a) * r1, yc, Math.cos(a) * r1, 0, 0, 0)]);
      parts.push([G.sphere(0.04, 10, 8), M(Math.sin(a) * (r2 + 0.012), yt, Math.cos(a) * (r2 + 0.012), 0, 0, 0, 1, 1.15, 1)]);
    }
    return parts;
  });
}

function trooperTeeth() {
  return G.merged('trooper-teeth', () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const x = -0.075 + i * 0.05;
      parts.push([G.cone(0.02, 0.045, 6), M(x, -0.012, 0.012, Math.PI, 0, 0)]);
    }
    return parts;
  });
}

function lureStalk() {
  return G.tube('lure', [[0, 0, 0], [0, 0.11, -0.03], [0, 0.22, 0.04], [0, 0.23, 0.15], [0, 0.17, 0.21]], 0.014, 18, 6);
}

/**
 * Build the Murk trooper body into e.root. Options: scale, width, tall, hat (bool), gun (bool),
 * leftArm ('nub' | 'forward').
 * Returns parts used by animateTrooper.
 */
export function buildTrooper(e, o = {}) {
  const P = e.pal;
  const w = o.width ?? 1, h = o.tall ?? 1, sc = o.scale ?? 1;
  const tar = e.mat(P.tar, { ink: true, rim: 0.6, emissiveIntensity: 0.1 });
  const tarDark = e.mat(P.tar.clone().multiplyScalar(0.7), { ink: true, rim: 0.5, emissiveIntensity: 0.06 });
  const rubber = e.matte(P.rubber, { roughness: 0.65, rim: 0.3 });
  const steel = e.metal(P.steel, { roughness: 0.32, metalness: 0.6, rim: 0.35 });
  const steelDark = e.metal(P.steelDark, { roughness: 0.4, metalness: 0.5, rim: 0.3 });
  const inkM = e.mat(P.ink, { ink: true, rim: 0.5, emissiveIntensity: 0.25 });
  const hatM = e.matte(P.hat, { roughness: 0.38, rim: 0.35 });
  const eyeM = e.glowMat(P.glow, 1.5);
  const lureM = e.glowMat(P.glow, 1.8);
  const pupilM = e.mat(P.dark, { roughness: 0.2, rim: 0.1 });
  const mouthM = e.mat(P.dark, { roughness: 0.5, rim: 0 });
  const toothM = e.matte('#f3ecdf', { roughness: 0.4, rim: 0.1 });

  const toeM = e.matte(P.steel.clone().lerp(WHITE, 0.15), { roughness: 0.4 });
  const rig = new THREE.Group();
  rig.scale.setScalar(sc);
  e.root.add(rig);

  // legs — hip pivots so they can swing
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.19 * w, 0.29, 0);
    rig.add(hip);
    const leg = mesh(G.capsule(0.08, 0.12, 4, 10), tar, hip);
    leg.position.y = -0.09;
    const boot = mesh(G.sphere(0.125, 16, 10), rubber, hip);
    boot.scale.set(1, 0.6, 1.32);
    boot.position.set(0, -0.215, 0.035);
    const toe = mesh(G.sphere(0.07, 12, 8), toeM, hip);
    toe.scale.set(1.1, 0.7, 0.9);
    toe.position.set(0, -0.2, 0.13);
    legs.push(hip);
  }

  // body
  const bodyY = 0.2;
  const body = new THREE.Group();
  body.position.y = bodyY;
  rig.add(body);
  const blob = mesh(G.lathe('trooper', TROOPER_PROFILE, 32), tar, body);
  blob.scale.set(w, h, w * 0.96);
  blob.userData.keep = true;
  const drips = mesh(trooperDrips(), tar, body);
  drips.scale.set(w, h, w);

  // visor eye
  const eye = new THREE.Group();
  eye.position.set(0, 0.4 * h, 0.405 * w);
  body.add(eye);
  const socket = mesh(G.torus(0.158, 0.042, 10, 28), steel, eye);
  socket.scale.set(1, 1, 1.2);
  const lens = mesh(G.sphere(0.155, 24, 16), eyeM, eye, false);
  lens.scale.set(1, 1, 0.5);
  const pupil = mesh(G.sphere(0.06, 14, 10), pupilM, eye, false);
  pupil.scale.set(0.62, 1.45, 0.35);
  pupil.position.z = 0.074;
  const shine = mesh(G.sphere(0.024, 8, 6), toothM, eye, false);
  shine.position.set(-0.055, 0.06, 0.075);
  e.detail(shine);
  const brows = [];
  for (const side of [-1, 1]) {
    const b = mesh(G.rbox(0.19, 0.065, 0.1, 0.028), steelDark, eye);
    b.position.set(side * 0.09, 0.2, 0.02);
    brows.push(b);
  }

  // anglerfish grin
  const mouth = new THREE.Group();
  mouth.position.set(0, 0.17 * h, 0.415 * w);
  body.add(mouth);
  const slot = mesh(G.sphere(0.1, 16, 8), mouthM, mouth, false);
  slot.scale.set(1.1, 0.32, 0.3);
  e.detail(mesh(trooperTeeth(), toothM, mouth, false)).position.y = 0.022;

  // hardhat with the Murk lure
  const hat = new THREE.Group();
  hat.position.set(0, 0.615 * h, -0.01);
  body.add(hat);
  const hw = Math.max(1, w * 0.92);
  hat.scale.set(hw, 1, hw);
  const dome = mesh(G.hemi(0.285, 26, 10), hatM, hat);
  dome.scale.set(1, 0.84, 1.06);
  const brim = mesh(G.cyl(0.32, 0.325, 0.03, 28), hatM, hat);
  brim.scale.set(1, 1, 1.14);
  brim.position.set(0, 0.005, 0.04);
  const ridge = mesh(G.torus(0.262, 0.03, 6, 18, Math.PI), hatM, hat);
  ridge.rotation.y = Math.PI / 2;
  ridge.scale.set(1, 0.84, 1.06);
  const stripe = mesh(G.torus(0.284, 0.02, 6, 30), inkM, hat);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.035;
  const badge = mesh(G.cylZ(0.058, 0.058, 0.025, 18), steelDark, hat);
  badge.position.set(0, 0.12, 0.262);
  badge.rotation.x = -0.45;
  const dot = mesh(G.sphere(0.025, 10, 8), lureM, badge, false);
  dot.position.set(0, 0.012, 0.014);
  e.detail(badge);
  const lure = new THREE.Group();
  lure.position.set(0, 0.225, 0.07);
  hat.add(lure);
  mesh(lureStalk(), steelDark, lure);
  const bulb = mesh(G.sphere(0.05, 14, 10), lureM, lure, false);
  bulb.position.set(0, 0.165, 0.215);
  e.detail(e.halo(P.glow, 0.32, bulb, 0.55));
  e.rigid(hat, 'hat');
  for (const hip of legs) e.rigid(hip, 'hip');

  // arms
  const armR = new THREE.Group();
  armR.position.set(0.39 * w, 0.28 * h, 0.06);
  body.add(armR);
  const upperR = mesh(G.capsuleZ(0.07, 0.1), tar, armR);
  upperR.rotation.set(0.25, 0.1, 0);
  const handR = mesh(G.sphere(0.08, 12, 10), tar, armR);
  handR.position.set(0.02, -0.06, 0.2);
  const armL = new THREE.Group();
  armL.position.set(-0.39 * w, 0.28 * h, 0.06);
  body.add(armL);
  const upperL = mesh(G.capsuleZ(0.07, o.leftArm === 'forward' ? 0.16 : 0.05), tar, armL);
  upperL.rotation.set(o.leftArm === 'forward' ? 0.15 : 0.9, -0.1, 0);
  const handL = mesh(G.sphere(0.08, 12, 10), tar, armL);
  handL.position.set(-0.02, o.leftArm === 'forward' ? -0.04 : -0.14, o.leftArm === 'forward' ? 0.27 : 0.1);

  let gun = null;
  if (o.gun !== false) {
    gun = buildBlaster(e, { steel, steelDark, rubber, inkM });
    gun.position.set(0.02, -0.02, 0.17);
    armR.add(gun);
    e.rigid(gun, 'gun');
  }
  e.rigid(armR, 'armR');
  e.rigid(armL, 'armL');

  return {
    rig, legs, body, bodyY, blob, blobSY: h, eye, lens, pupil, brows, hat, lure, bulb, armR, armL, handR, handL,
    gun, mats: { tar, tarDark, rubber, steel, steelDark, inkM, hatM, eyeM, lureM },
    lureS: { x: 0, vx: 0, z: 0, vz: 0 }, eyeCol: P.glow.clone(), recoil: 0, gunZ: gun ? gun.position.z : 0,
  };
}

/** Murk ink blaster (forward +Z). userData.muzzle = local muzzle point; userData.canister = glowing tank. */
export function buildBlaster(e, m, o = {}) {
  const P = e.pal;
  const g = new THREE.Group();
  const len = o.len ?? 0.34;
  const body = mesh(G.rbox(0.105, 0.125, len, 0.035), m.steelDark, g);
  body.position.set(0, 0.03, len * 0.3);
  const barrel = mesh(G.cylZ(0.032, 0.038, 0.2, 12), m.steel, g);
  barrel.position.set(0, 0.04, len * 0.3 + len / 2 + 0.08);
  const muzzle = mesh(G.torus(0.04, 0.015, 8, 18), m.inkM, g);
  muzzle.position.set(0, 0.04, len * 0.3 + len / 2 + 0.18);
  const canMat = e.glowMat(P.ink, 0.35);
  canMat.roughness = 0.12;
  const can = mesh(G.capsuleZ(0.05, 0.12), canMat, g);
  can.position.set(0, 0.135, -0.03);
  for (const z of [0.015, 0.17]) {
    const band = mesh(G.torus(0.053, 0.011, 6, 16), m.steel, g);
    band.position.set(0, 0.135, z);
  }
  const grip = mesh(G.rbox(0.055, 0.13, 0.065, 0.02), m.rubber, g);
  grip.position.set(0, -0.06, -0.02);
  grip.rotation.x = 0.3;
  const vent = mesh(G.box(0.11, 0.02, 0.1), m.steel, g);
  vent.position.set(0, 0.1, len * 0.45);
  g.userData.muzzle = new THREE.Vector3(0, 0.04, len * 0.3 + len / 2 + 0.2);
  g.userData.canister = canMat;
  return g;
}

const _lp = new THREE.Vector3();
/** Procedural trooper animation: waddle, breathing, eye mood + gaze, brows, lure spring, recoil. */
export function animateTrooper(e, P, dt, o = {}) {
  const v = e.velocity;
  const hs = Math.hypot(v.x, v.z);
  const sw = Math.min(1, hs / 1.6);
  e.walkPhase += hs * dt * (o.stride ?? 6.4);
  const ph = e.walkPhase;
  const swing = (o.legSwing ?? 0.8) * sw;
  P.legs[0].rotation.x = Math.sin(ph) * swing;
  P.legs[1].rotation.x = -Math.sin(ph) * swing;
  const air = e.walker && !e.grounded;
  if (air) { P.legs[0].rotation.x = -0.5; P.legs[1].rotation.x = 0.4; }
  const breathe = Math.sin(e.t * 2.6) * 0.022;
  P.body.position.y = P.bodyY + Math.abs(Math.sin(ph)) * 0.055 * sw;
  P.body.rotation.z = Math.sin(ph) * 0.085 * sw + (o.tiltZ ?? 0);
  const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
  const fwd = v.x * sy + v.z * cy;
  const side = v.x * cy - v.z * sy;
  P.body.rotation.x = clamp(fwd * 0.045, -0.15, 0.22) - e.hurtT * 1.4 + (o.leanX ?? 0);
  P.blob.scale.y = P.blobSY * (1 + breathe);

  // eye mood colour: calm lime → alert red → searching amber
  const want = e.aware ? e.pal.angry : e.state === 'search' ? e.pal.wary : e.pal.glow;
  P.eyeCol.lerp(want, Math.min(1, dt * 8));
  const em = P.mats.eyeM;
  em.color.copy(P.eyeCol);
  em.emissive.copy(P.eyeCol);
  const lowHp = e.hp < e.maxHp * 0.35 && e.alive;
  em.emissiveIntensity = 1.5 * (lowHp && Math.sin(e.t * 31) > 0.55 ? 0.35 : 1) * (o.eyeBoost ?? 1);

  // gaze: pupil tracks the target when fighting, wanders when calm
  let gx = Math.sin(e.t * 0.7) * 0.4, gy = Math.sin(e.t * 0.53) * 0.2;
  if ((e.aware || e.state === 'search') && e.target) {
    const T = e.canSee ? e.target.position : e.lastSeen;
    _lp.set(T.x - e.position.x, T.y + 0.7 - (e.position.y + e.eyeH), T.z - e.position.z);
    const d = _lp.length() || 1;
    gx = clamp((_lp.x * cy - _lp.z * sy) / d * 2.2, -1, 1);
    gy = clamp(_lp.y / d * 2.5, -1, 1);
  }
  P.pupil.position.x += (gx * 0.05 - P.pupil.position.x) * Math.min(1, dt * 12);
  P.pupil.position.y += (gy * 0.05 - P.pupil.position.y) * Math.min(1, dt * 12);
  // brows: calm / angry V / worried
  const ang = e.aware ? 0.38 : e.state === 'search' ? -0.2 : 0.06;
  P.brows[0].rotation.z += (-ang - P.brows[0].rotation.z) * Math.min(1, dt * 10);
  P.brows[1].rotation.z += (ang - P.brows[1].rotation.z) * Math.min(1, dt * 10);
  P.brows[0].position.y = P.brows[1].position.y = 0.2 - (e.aware ? 0.02 : 0);

  // lure spring (wobbles on steps, hits and landings)
  const L = P.lureS;
  const tx = -fwd * 0.1 + Math.sin(e.t * 2.1) * 0.08 + e.squash * 0.8;
  const tz = side * 0.1 + Math.sin(e.t * 1.7 + 1) * 0.05;
  L.vx += ((tx - L.x) * 70 - L.vx * 6) * dt;
  L.vz += ((tz - L.z) * 70 - L.vz * 6) * dt;
  L.x += L.vx * dt; L.z += L.vz * dt;
  P.lure.rotation.x = clamp(L.x, -0.9, 0.9);
  P.lure.rotation.z = clamp(L.z, -0.9, 0.9);
  P.bulb.scale.setScalar(1 + Math.sin(e.t * 5) * 0.12);

  // battered: hardhat knocked askew
  const hurt = 1 - e.hp / e.maxHp;
  P.hat.rotation.z = hurt > 0.5 ? 0.22 * (hurt - 0.5) * 2 : 0;
  P.hat.position.x = P.hat.rotation.z * -0.12;

  // recoil
  if (P.gun) {
    P.recoil = Math.max(0, P.recoil - dt * 7);
    P.gun.position.z = P.gunZ - P.recoil * 0.07;
    P.armR.rotation.x = -P.recoil * 0.25 + (o.armAim ?? 0);
  }
}
