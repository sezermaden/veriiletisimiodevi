// Weapon framework: base classes, registry, kits and shared helpers (muzzle, aim spread, models,
// ink explosions). Concrete weapons live in weapons/mains/*, weapons/subs/*, weapons/specials/*.
//
// A "wielder" (player, turf bot) must provide:
//   session, team, position (feet, Vector3), velocity, yaw, grounded,
//   aim: { dir: Vector3 (unit), point: Vector3 },
//   useInk(amount) -> bool, ink, inkMax, model (SquidkinModel, optional),
//   addSpecial(points), isPlayer (bool)
import * as THREE from 'three';
import { charMat, inkMat } from '../actors/materials.js';
import { disposeTree } from '../engine/dispose.js';

export const MAINS = {};
export const SUBS = {};
export const SPECIALS = {};
export const registerMain = (id, cls) => (MAINS[id] = cls);
export const registerSub = (id, cls) => (SUBS[id] = cls);
export const registerSpecial = (id, cls) => (SPECIALS[id] = cls);

/** The eight kits (original names). `unlock` = story stage that unlocks it. */
export const KITS = {
  'splash-blaster': { name: 'Splash Blaster', main: 'shooter', sub: 'burst-bomb', special: 'tidal-slam', unlock: null,
    desc: 'A reliable all-rounder. Rapid mid-range shots and a quick-popping bomb.', stats: {} },
  'wave-roller': { name: 'Wave Roller', main: 'roller', sub: 'splash-bomb', special: 'ink-storm', unlock: 'w1-2',
    desc: 'Roll out a wide lane of ink, or flick a crashing wave at close range.', stats: {} },
  'longshot': { name: 'Longshot', main: 'charger', sub: 'ink-mine', special: 'missile-barrage', unlock: 'w1-3',
    desc: 'Charge up and splat from across the map. Hold still, aim true.', stats: {} },
  'burst-popper': { name: 'Burst Popper', main: 'blaster', sub: 'sprinkler', special: 'tidal-slam', unlock: 'w2-1',
    desc: 'Slow explosive shots that splash around corners.', stats: {} },
  'slosh-bucket': { name: 'Slosh Bucket', main: 'slosher', sub: 'splash-bomb', special: 'ink-jet', unlock: 'w2-2',
    desc: 'Lob heavy arcs of ink over walls and down onto ledges.', stats: {} },
  'gatling-spinner': { name: 'Gatling Spinner', main: 'splatling', sub: 'sprinkler', special: 'missile-barrage', unlock: 'w3-1',
    desc: 'Spin it up, then unleash a long, relentless stream.', stats: {} },
  'swift-brush': { name: 'Swift Brush', main: 'brush', sub: 'burst-bomb', special: 'ink-jet', unlock: 'w3-2',
    desc: 'Dash while painting a trail. Flick fast bristle-splashes up close.', stats: {} },
  'twin-dualies': { name: 'Twin Dualies', main: 'dualies', sub: 'ink-mine', special: 'ink-storm', unlock: 'w3-3',
    desc: 'Two quick blasters and an evasive dodge roll.', stats: {} },
};

export const SUB_INFO = {
  'burst-bomb': { name: 'Burst Bomb', cost: 40, desc: 'Bursts on impact.' },
  'splash-bomb': { name: 'Splash Bomb', cost: 70, desc: 'Big splat after a short fuse.' },
  'sprinkler': { name: 'Sprinkler', cost: 60, desc: 'Sticks to surfaces and sprays ink.' },
  'ink-mine': { name: 'Ink Mine', cost: 60, desc: 'Hidden trap that blows when enemies step close.' },
};

export const SPECIAL_INFO = {
  'tidal-slam': { name: 'Tidal Slam', desc: 'Leap and slam down for a huge splash.' },
  'ink-storm': { name: 'Ink Storm', desc: 'Throw a raincloud that inks everything below.' },
  'missile-barrage': { name: 'Missile Barrage', desc: 'Lock on and launch a volley of ink missiles.' },
  'ink-jet': { name: 'Ink Jet', desc: 'Take to the air with a jetpack and explosive shots.' },
};

export function createKit(wielder, kitId) {
  const def = KITS[kitId] || KITS['splash-blaster'];
  const Main = MAINS[def.main] || MAINS.shooter;
  const Sub = SUBS[def.sub] || SUBS['burst-bomb'];
  const Spec = SPECIALS[def.special] || SPECIALS['tidal-slam'];
  return {
    id: kitId,
    def,
    main: new Main(wielder, def.stats.main || {}),
    sub: Sub ? new Sub(wielder, def.stats.sub || {}) : null,
    special: Spec ? new Spec(wielder, def.stats.special || {}) : null,
  };
}

// ---------------------------------------------------------------------------------------------
const _v = new THREE.Vector3();
const _r = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** World position the shots leave from: right-hand side, chest height, a bit forward. */
export function muzzleOf(w, out, forward = 0.45, side = 0.22, height = 1.02) {
  const d = w.aim.dir;
  _v.set(d.x, 0, d.z);
  if (_v.lengthSq() < 1e-6) _v.set(-Math.sin(w.yaw), 0, -Math.cos(w.yaw));
  _v.normalize();
  _r.crossVectors(_v, _up).normalize();
  return out.copy(w.position).addScaledVector(_v, forward).addScaledVector(_r, side).setY(w.position.y + height);
}

/** Direction from `from` to the aim point, with random cone spread (degrees). */
export function aimDir(w, from, spreadDeg, out) {
  out.subVectors(w.aim.point, from);
  if (out.lengthSq() < 2.25) out.copy(w.aim.dir); else out.normalize();
  if (spreadDeg > 0) {
    const s = THREE.MathUtils.degToRad(spreadDeg) * (Math.random() * 2 - 1);
    const s2 = THREE.MathUtils.degToRad(spreadDeg) * 0.35 * (Math.random() * 2 - 1);
    _r.crossVectors(out, _up).normalize();
    out.applyAxisAngle(_up, s).applyAxisAngle(_r, s2).normalize();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
export class MainWeapon {
  constructor(w, stats = {}) {
    this.w = w;
    this.s = { ...this.constructor.defaults, ...stats };
    this.cool = 0;
    this.recoil = 0;
    this.firing = false;
    this.model = this.buildModel();
    if (this.model && w.model?.weaponSocket) w.model.weaponSocket.add(this.model);
  }
  static defaults = { moveMul: 0.75 };
  /** Override to build the weapon mesh (parented to the right hand). */
  buildModel() { return makeGunModel(this.w.session.ink.color(this.w.team)); }
  /** Fixed-step update. ctrl = { fire (held), firePressed, fireReleased } */
  update(dt, ctrl) { void dt; void ctrl; }
  get moveMul() { return this.firing ? this.s.moveMul : 1; }
  /** Optional hook, called each fixed step BEFORE the wielder's movement code (and before jump is consumed). */
  // preMove(dt, { firing, wish, wishLen }) {}
  /** While true the wielder skips its own movement code (the weapon drives velocity, e.g. dodge rolls). */
  get drivesMovement() { return false; }
  /** 0..1 charge for the crosshair (chargers, splatlings). */
  get charge() { return 0; }
  /** Rough effective range in metres (for bots/aim assist). */
  get range() { return this.s.range ?? 8; }
  /** Called when the wielder swims/dies; drop charges etc. */
  cancel() { this.firing = false; }
  setColor(c) { this.model?.traverse((o) => { if (o.userData.inkPart) { o.material.color.set(c); o.material.emissive?.set(c); } }); }
  dispose() { this.model?.parent?.remove(this.model); disposeTree(this.model); }
}

export class SubWeapon {
  constructor(w, stats = {}) { this.w = w; this.s = { ...this.constructor.defaults, ...stats }; }
  static defaults = { cost: 50 };
  get cost() { return this.s.cost; }
  /** Throw/use. Return true if used (ink is spent by the caller only if true). */
  use() { return false; }
  update(dt) { void dt; }
  dispose() {}
}

export class Special {
  constructor(w, stats = {}) { this.w = w; this.s = { ...this.constructor.defaults, ...stats }; this.active = false; }
  static defaults = {};
  /** Start the special (gauge already full and consumed by the caller). */
  activate() { this.active = true; }
  /** Fixed-step update while active. ctrl = { fire, firePressed, jumpPressed } */
  update(dt, ctrl) { void dt; void ctrl; }
  /** While true the main weapon cannot fire. */
  get blocksFire() { return this.active; }
  /** While true the wielder's normal movement code is skipped (special drives position). */
  get drivesMovement() { return false; }
  end() { this.active = false; }
  dispose() {}
}

// ---------------------------------------------------------------------------------------------
/** A chunky toy-like blaster: grip, body, barrel and an ink canister in the team colour. */
export function makeGunModel(color, opts = {}) {
  const g = new THREE.Group();
  const body = charMat(opts.body || '#f4f4f4', { roughness: 0.4 });
  const dark = charMat('#2c2f3a', { roughness: 0.5 });
  const ink = inkMat(color);
  const len = opts.len || 0.34;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, len), body);
  b.position.set(0, 0.02, len * 0.35);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, opts.barrel || 0.16, 12), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, len * 0.35 + len / 2 + (opts.barrel || 0.16) / 2 - 0.02);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.12, 0.06), dark);
  grip.position.set(0, -0.05, 0.02);
  grip.rotation.x = 0.25;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), ink);
  can.position.set(0, 0.1, len * 0.25);
  can.userData.inkPart = true;
  const nozzle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 14), ink);
  nozzle.position.copy(barrel.position).setZ(barrel.position.z + (opts.barrel || 0.16) / 2);
  nozzle.userData.inkPart = true;
  g.add(b, barrel, grip, can, nozzle);
  g.rotation.x = Math.PI / 2;     // hand points down its -Y; weapon forward (+Z) → along the arm
  g.rotation.set(Math.PI / 2, 0, 0);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/**
 * Ink explosion: paints an irregular blot, damages everything of other teams within dmgRadius
 * (full damage in the inner 40%, falling to 30% at the edge), FX, sound and camera shake.
 */
export function inkExplosion(session, pos, normal, team, o = {}) {
  const r = o.paintRadius ?? 3;
  const n = normal || _up;
  const ink = session.ink;
  ink.paint(pos, r * 0.72, team, n, { source: o.owner });
  const k = Math.round(4 + r * 1.5);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + Math.random() * 0.5;
    const d = r * (0.45 + Math.random() * 0.35);
    _v.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    if (Math.abs(n.y) < 0.7) _v.set(Math.cos(a) * d, Math.sin(a) * d, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
    const p = _r.copy(pos).add(_v);
    const g = session.level.raycast(p.clone().addScaledVector(n, 1.5), n.clone().negate(), 3.5, { staticOnly: true });
    ink.paint(g ? g.point : p, r * (0.25 + Math.random() * 0.2), team, g ? g.normal : n, { source: o.owner });
  }
  const dmgR = o.dmgRadius ?? r;
  const dmg = o.damage ?? 0;
  if (dmg > 0) {
    const hc = new THREE.Vector3();
    for (const a of session.actors) {
      if (!a.alive || a.team === team) continue;
      a.hitCenter(hc);
      const d = hc.distanceTo(pos);
      if (d > dmgR + a.hitRadius) continue;
      const f = d < dmgR * 0.4 ? 1 : 1 - ((d - dmgR * 0.4) / (dmgR * 0.6)) * 0.7;
      if (!session.level.lineOfSight(pos.clone().addScaledVector(n, 0.3), hc)) continue;
      const amount = dmg * Math.max(0.3, f);
      const applied = a.damage(amount, { source: o.owner, team, point: pos.clone(), dir: hc.clone().sub(pos).normalize(), kind: 'explosion' });
      if (applied !== false) session.events.emit('hit', { target: a, source: o.owner, damage: amount, point: hc.clone() });
    }
  }
  session.fx.explosion(pos, n, ink.color(team), r);
  session.audio?.sfx(o.sound || 'boom', { pos, volume: Math.min(1, 0.5 + r * 0.1) });
  session.shake?.(pos, 0.25 + r * 0.08);
}
