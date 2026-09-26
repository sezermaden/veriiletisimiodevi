// Shared helpers for the weapon modules (mains, subs, specials): movement intent, body-space
// transforms, damage/area helpers, a keep-alive synth loop for sustained sounds, and every weapon
// SFX recipe (registered with engine/audio.js registerSfx).
import * as THREE from 'three';
import { registerSfx } from '../../engine/audio.js';
import { inkExplosion } from '../base.js';
import { TEAM_NONE } from '../../ink/ink-system.js';

const _hc = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);

// ---------------------------------------------------------------------------------------------
// wielder helpers

/** World-space movement intent (x/z, length ≤ 1): player input relative to the camera, or a
 *  bot's `botMove` ({x, z} world direction). */
export function wishDir(w, out) {
  out.set(0, 0, 0);
  if (w.isPlayer && w.session.input) {
    const m = w.session.input.move;
    const yaw = w.session.camRig?.yaw ?? (w.yaw + Math.PI);
    out.set(-Math.sin(yaw) * m.y + Math.cos(yaw) * m.x, 0, -Math.cos(yaw) * m.y - Math.sin(yaw) * m.x);
  } else if (w.botMove) {
    out.set(w.botMove.x || 0, 0, w.botMove.z || 0);
  }
  const l = out.length();
  if (l > 1) out.divideScalar(l);
  return out;
}

/** Body-space point (model faces +Z at yaw 0) → world. */
export function toWorld(w, x, y, z, out) {
  const c = Math.cos(w.yaw), s = Math.sin(w.yaw);
  return out.set(w.position.x + x * c + z * s, w.position.y + y, w.position.z - x * s + z * c);
}

/** Horizontal aim direction (unit) and yaw of the wielder's aim. */
export function aimYaw(w) {
  const d = w.aim.dir;
  if (Math.abs(d.x) + Math.abs(d.z) < 1e-4) return w.yaw;
  return Math.atan2(d.x, d.z);
}

/** Enemy-ish actors a weapon may damage or lock on to (not props like crates / switches). */
export function isCombatant(a, team) {
  return a.alive && !a.untargetable && a.team !== team && a.team !== TEAM_NONE && !a.prop;
}

/** Damage one actor and emit the 'hit' event (HUD hit marker, stats) — only when the hit landed
 *  (damage() returns false for invulnerable / shielded / frozen targets). Returns whether it did. */
export function hitActor(S, a, amount, info) {
  if (!a.alive || amount <= 0) return false;
  const applied = a.damage(amount, info);
  if (applied === false) return false;
  S.events.emit('hit', { target: a, source: info.source, damage: amount, point: (info.point || a.hitCenter(_hc)).clone() });
  return true;
}

/**
 * Run fn() with the wielder's special gauge locked, so ink laid down by a special weapon (storm
 * rain, missile blasts) still counts as the wielder's turf but does not recharge the gauge. The
 * Player only charges while `kit.special.active` is false; the flag is held for this synchronous
 * call only, so the special itself can end right away (sub weapons, wall climbing and the bots'
 * state machine all key off `special.active`).
 */
export function noCharge(w, fn) {
  const sp = w?.kit?.special;
  if (!sp || sp.active) return fn();
  sp.active = true;
  try { return fn(); } finally { sp.active = false; }
}

/**
 * Explosive ink blast: paint + FX via inkExplosion, then area damage with line of sight,
 * full damage in the inner 35 % falling to 40 % at the edge. `skip` = actor that already took a
 * direct hit.
 */
export function blast(S, pos, normal, team, o = {}) {
  inkExplosion(S, pos, normal || UP, team, { paintRadius: o.paintRadius ?? 2, damage: 0, owner: o.owner, sound: o.sound || 'boom' });
  const R = o.radius ?? 2.2;
  const dmg = o.damage ?? 0;
  if (dmg <= 0) return;
  const n = normal || UP;
  _p.copy(pos).addScaledVector(n, 0.3);
  for (const a of S.actors.slice()) {
    if (!a.alive || a.team === team || a === o.skip) continue;
    a.hitCenter(_hc);
    const dist = Math.max(0, _hc.distanceTo(pos) - a.hitRadius * 0.6);
    if (dist > R) continue;
    if (!S.level.lineOfSight(_p, _hc)) continue;
    const f = dist < R * 0.35 ? 1 : 1 - ((dist - R * 0.35) / (R * 0.65)) * 0.6;
    hitActor(S, a, dmg * f, { source: o.owner, team, point: _hc.clone(), dir: _d.subVectors(_hc, pos).normalize().clone(), kind: o.kind || 'explosion' });
  }
}

/**
 * Nearest actor of another team crossed by a ray (actors are treated as vertical capsules).
 * Returns { actor, dist } or null. `pad` widens the test (thin beams ≈ 0.1).
 */
export function rayActor(S, team, from, dir, maxDist, pad = 0.1, skip = null) {
  let best = null, bestD = maxDist;
  for (const a of S.actors) {
    if (!a.alive || a.team === team || a.untargetable || (skip && skip.has(a))) continue;
    a.hitCenter(_hc);
    const t = (_hc.x - from.x) * dir.x + (_hc.y - from.y) * dir.y + (_hc.z - from.z) * dir.z;
    if (t < 0 || t > bestD + 1) continue;
    _p.copy(from).addScaledVector(dir, t);
    const hh = (a.hitHeight ?? 1.2) * 0.35;
    const cy = THREE.MathUtils.clamp(_p.y, _hc.y - hh, _hc.y + hh);
    const dx = _p.x - _hc.x, dy = _p.y - cy, dz = _p.z - _hc.z;
    const perp = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const r = (a.hitRadius ?? 0.5) + pad;
    if (perp > r) continue;
    const d = Math.max(0, t - Math.sqrt(r * r - perp * perp));
    if (d < bestD) { bestD = d; best = a; }
  }
  return best ? { actor: best, dist: bestD } : null;
}

/** Paint the floor below a point (within `far`), returns the ground hit or null. */
export function paintBelow(S, pos, r, team, owner, far = 3) {
  const g = S.level.raycast(_p.set(pos.x, pos.y + 0.4, pos.z), DOWN, far + 0.4, { staticOnly: true });
  if (g && g.normal.y > 0.35) S.ink.paint(g.point, r, team, g.normal, { source: owner });
  return g;
}

/** Play a weapon sound: centred for the player, positional for anyone else. */
export function sfx(w, name, o = {}) {
  const A = w.session.audio;
  if (!A) return;
  if (w.isPlayer) A.sfx(name, o);
  else A.sfx(name, { ...o, pos: o.pos || w.position, volume: (o.volume ?? 1) * 0.8 });
}

// ---------------------------------------------------------------------------------------------
const BEAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0);
const _Y = new THREE.Vector3(0, 1, 0);
/** A glowing additive line segment (laser sights, shot tracers). */
export class Beam {
  constructor(scene, color, radius = 0.02, opacity = 0.8, additive = true) {
    this.scene = scene;
    this.radius = radius;
    // additive reads as light on dark backgrounds; normal blending keeps team colour on bright ones
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.Mesh(BEAM_GEO, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }
  set(from, to, radius = this.radius) {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 1e-3) { this.mesh.visible = false; return; }
    this.mesh.position.copy(from);
    this.mesh.quaternion.setFromUnitVectors(_Y, _d.divideScalar(len));
    this.mesh.scale.set(radius, len, radius);
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
  dispose() { this.scene.remove(this.mesh); this.mat.dispose(); }
}

// ---------------------------------------------------------------------------------------------
/**
 * Sustained synth voice kept alive by calling keep() every fixed step. If keep() stops arriving
 * (weapon cancelled, game paused, wielder removed) the voice fades by itself within ~0.15 s and
 * its nodes are released shortly after — nothing can get stuck droning.
 *   kind: 'charge' (rising whine), 'spin' (gatling whirr), 'jet' (engine rumble)
 */
export class LoopSound {
  constructor(audio, kind) { this.audio = audio; this.kind = kind; this.n = null; this.last = 0; this.timer = 0; }

  _build() {
    const A = this.audio, ctx = A.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(A.sfxBus);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 2;
    lp.connect(g);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g1 = ctx.createGain(), g2 = ctx.createGain();
    o1.connect(g1).connect(lp); o2.connect(g2).connect(lp);
    let src = null, nf = null, ng = null;
    if (this.kind === 'jet' || this.kind === 'spin') {
      src = ctx.createBufferSource();
      src.buffer = A.noise; src.loop = true;
      nf = ctx.createBiquadFilter();
      nf.type = this.kind === 'jet' ? 'lowpass' : 'bandpass';
      nf.frequency.value = this.kind === 'jet' ? 520 : 2400; nf.Q.value = this.kind === 'jet' ? 0.8 : 1.4;
      ng = ctx.createGain(); ng.gain.value = this.kind === 'jet' ? 0.9 : 0.35;
      src.connect(nf).connect(ng).connect(g);
      src.start();
    }
    if (this.kind === 'charge') { o1.type = 'sawtooth'; o2.type = 'sine'; g1.gain.value = 0.5; g2.gain.value = 0.6; }
    else if (this.kind === 'spin') { o1.type = 'square'; o2.type = 'sawtooth'; g1.gain.value = 0.18; g2.gain.value = 0.25; }
    else { o1.type = 'sawtooth'; o2.type = 'triangle'; g1.gain.value = 0.2; g2.gain.value = 0.25; }
    o1.start(); o2.start();
    this.n = { g, lp, o1, o2, src, nf };
  }

  /** level 0..1 drives pitch/brightness; vol 0..1. */
  keep(level = 1, vol = 1) {
    const A = this.audio;
    if (!A?.ready || !A.ctx) return;
    if (!this.n) this._build();
    const n = this.n, t = A.ctx.currentTime;
    const set = (param, v, tc = 0.03) => param.setTargetAtTime(v, t, tc);
    let gain = 0.1;
    if (this.kind === 'charge') {
      set(n.o1.frequency, 170 + level * 560);
      set(n.o2.frequency, 340 + level * 1120 + (level >= 1 ? Math.sin(t * 40) * 30 : 0));
      set(n.lp.frequency, 700 + level * 3200);
      gain = 0.05 + level * 0.07;
    } else if (this.kind === 'spin') {
      set(n.o1.frequency, 60 + level * 260);
      set(n.o2.frequency, 180 + level * 900);
      set(n.lp.frequency, 900 + level * 3500);
      set(n.nf.frequency, 900 + level * 3000);
      gain = 0.04 + level * 0.1;
    } else {
      set(n.o1.frequency, 70 + level * 40);
      set(n.o2.frequency, 140 + level * 90);
      set(n.lp.frequency, 500 + level * 500);
      set(n.nf.frequency, 380 + level * 400 + Math.random() * 60);
      gain = 0.16 + level * 0.1;
    }
    const gp = n.g.gain;
    if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(t); else gp.cancelScheduledValues(t);
    gp.setTargetAtTime(gain * vol, t, 0.03);
    gp.setTargetAtTime(0.0001, t + 0.12, 0.05);        // dead-man fade if keep() stops coming
    this.last = performance.now();
    if (!this.timer) this.timer = setInterval(() => { if (performance.now() - this.last > 800) this.stop(); }, 400);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = 0; }
    const n = this.n;
    if (!n) return;
    this.n = null;
    try {
      const t = this.audio.ctx.currentTime;
      n.g.gain.cancelScheduledValues(t);
      n.g.gain.setTargetAtTime(0.0001, t, 0.03);
      n.o1.stop(t + 0.2); n.o2.stop(t + 0.2); n.src?.stop(t + 0.2);
      setTimeout(() => { try { n.g.disconnect(); } catch { /* gone */ } }, 400);
    } catch { /* context gone */ }
  }
}

// ---------------------------------------------------------------------------------------------
// SFX recipes
registerSfx('roller_flick', (A, out, t) => {
  A.noiseBurst(t, 0.2, out, { f0: 420, f1: 2600, q: 1.3, gain: 0.45, attack: 0.06 });
  A.noiseBurst(t + 0.09, 0.26, out, { type: 'lowpass', f0: 2600, f1: 260, q: 2.5, gain: 0.85 });
  A.osc('sine', 190, 55, t + 0.09, 0.18, out, 0.55);
});
registerSfx('roller_roll', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.13, out, { type: 'lowpass', f0: 760 * p, f1: 240, q: 5, gain: 0.4 });
  A.osc('sine', 85 * p, 60, t, 0.12, out, 0.16);
});
registerSfx('roller_hit', (A, out, t) => {
  A.osc('sine', 150, 42, t, 0.28, out, 0.95);
  A.noiseBurst(t, 0.22, out, { type: 'lowpass', f0: 2000, f1: 180, q: 1.5, gain: 0.8 });
  A.osc('square', 320, 110, t, 0.09, out, 0.16);
  A.osc('sine', 1400, 900, t + 0.03, 0.08, out, 0.15);
});
registerSfx('charger_fire', (A, out, t, o) => {
  const lv = o.level ?? 1;
  A.noiseBurst(t, 0.07, out, { type: 'highpass', f0: 3400, q: 0.7, gain: 0.7 });
  A.osc('sawtooth', 2600, 260, t, 0.16 + lv * 0.08, out, 0.2 + lv * 0.1);
  A.osc('sine', 700, 120, t, 0.12, out, 0.5);
  if (lv >= 1) {
    A.osc('sine', 130, 38, t, 0.32, out, 0.75);
    A.noiseBurst(t + 0.02, 0.35, out, { type: 'bandpass', f0: 2600, f1: 500, q: 1.2, gain: 0.35 });
  }
});
registerSfx('charger_full', (A, out, t) => {
  A.osc('sine', 1568, 1568, t, 0.32, out, 0.32);
  A.osc('triangle', 2349, 2349, t + 0.04, 0.28, out, 0.18);
  A.osc('sine', 3136, 3136, t + 0.08, 0.2, out, 0.08);
});
registerSfx('blaster_fire', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 230 * p, 85 * p, t, 0.15, out, 0.85);
  A.noiseBurst(t, 0.13, out, { f0: 1000 * p, f1: 380, q: 2, gain: 0.55 });
  A.osc('square', 460 * p, 170, t, 0.06, out, 0.12);
});
registerSfx('blaster_boom', (A, out, t) => {
  A.osc('sine', 700, 1300, t, 0.04, out, 0.3);
  A.noiseBurst(t, 0.42, out, { type: 'lowpass', f0: 2800, f1: 170, q: 1.2, gain: 0.95 });
  A.osc('sine', 170, 44, t, 0.36, out, 0.85);
  A.noiseBurst(t + 0.03, 0.2, out, { f0: 1600, f1: 500, q: 2.5, gain: 0.3 });
});
registerSfx('slosh', (A, out, t) => {
  A.noiseBurst(t, 0.28, out, { f0: 280, f1: 1500, q: 3, gain: 0.6, attack: 0.05 });
  A.osc('sine', 240, 560, t, 0.14, out, 0.28);
  A.osc('sine', 520, 210, t + 0.13, 0.14, out, 0.22);
  A.noiseBurst(t + 0.12, 0.2, out, { type: 'lowpass', f0: 1800, f1: 300, q: 3, gain: 0.45 });
});
registerSfx('splatling_fire', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.05, out, { f0: 3000 * p, f1: 1200, q: 1.4, gain: 0.5 });
  A.osc('square', 720 * p, 330, t, 0.035, out, 0.13);
  A.osc('sine', 300 * p, 140, t, 0.05, out, 0.3);
});
registerSfx('splatling_ready', (A, out, t) => {
  A.osc('square', 1180, 1180, t, 0.04, out, 0.16);
  A.osc('square', 1770, 1770, t + 0.05, 0.06, out, 0.16);
});
registerSfx('brush_flick', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.1, out, { f0: 1300 * p, f1: 4200 * p, q: 1.5, gain: 0.45, attack: 0.02 });
  A.noiseBurst(t + 0.05, 0.12, out, { type: 'lowpass', f0: 2000, f1: 400, q: 2, gain: 0.4 });
});
registerSfx('brush_run', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.09, out, { type: 'lowpass', f0: 1000 * p, f1: 300, q: 3.5, gain: 0.28 });
});
registerSfx('dualie_fire', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.06, out, { f0: 2800 * p, f1: 1000, q: 1.3, gain: 0.55 });
  A.osc('sine', 920 * p, 360 * p, t, 0.05, out, 0.42);
});
registerSfx('dodge_roll', (A, out, t) => {
  A.noiseBurst(t, 0.26, out, { f0: 380, f1: 2300, q: 1.2, gain: 0.6, attack: 0.03 });
  A.osc('sine', 210, 520, t, 0.12, out, 0.28);
  A.noiseBurst(t + 0.2, 0.18, out, { type: 'lowpass', f0: 1800, f1: 300, q: 2.5, gain: 0.55 });
});
registerSfx('sprinkler_stick', (A, out, t) => {
  A.osc('square', 1500, 900, t, 0.03, out, 0.25);
  A.noiseBurst(t, 0.16, out, { type: 'lowpass', f0: 2400, f1: 400, q: 2, gain: 0.55 });
  A.osc('sine', 600, 900, t + 0.08, 0.08, out, 0.2);
});
registerSfx('sprinkler_spray', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.09, out, { type: 'highpass', f0: 2300 * p, q: 0.8, gain: 0.25 });
  A.osc('sine', 500 * p, 380 * p, t, 0.05, out, 0.1);
});
registerSfx('mine_place', (A, out, t) => {
  A.osc('sine', 660, 660, t, 0.06, out, 0.3);
  A.osc('sine', 990, 990, t + 0.07, 0.09, out, 0.3);
  A.noiseBurst(t, 0.1, out, { type: 'lowpass', f0: 1200, f1: 300, q: 2, gain: 0.3 });
});
registerSfx('mine_beep', (A, out, t) => {
  A.osc('square', 1560, 1560, t, 0.05, out, 0.26);
  A.osc('square', 1560, 1560, t + 0.1, 0.05, out, 0.26);
});
registerSfx('storm_throw', (A, out, t) => {
  A.noiseBurst(t, 0.3, out, { f0: 300, f1: 2400, q: 1.6, gain: 0.5, attack: 0.05 });
  A.osc('sine', 330, 660, t, 0.2, out, 0.25);
});
registerSfx('storm_spawn', (A, out, t) => {
  A.noiseBurst(t, 1.4, out, { type: 'lowpass', f0: 520, f1: 70, q: 0.9, gain: 0.95, attack: 0.02 });
  A.osc('sine', 70, 38, t, 1.1, out, 0.5);
  for (let i = 0; i < 5; i++) A.noiseBurst(t + 0.05 + i * 0.07, 0.1, out, { type: 'highpass', f0: 2500 + Math.random() * 2000, q: 1, gain: 0.25 });
});
registerSfx('rain', (A, out, t) => {
  A.noiseBurst(t, 0.16, out, { f0: 2600 + Math.random() * 1500, q: 0.9, gain: 0.28 });
  A.noiseBurst(t + 0.05, 0.08, out, { type: 'lowpass', f0: 1200, f1: 300, q: 3, gain: 0.18 });
});
registerSfx('lock_start', (A, out, t) => {
  A.osc('sine', 520, 1500, t, 0.32, out, 0.28);
  A.osc('triangle', 780, 2200, t + 0.05, 0.3, out, 0.12);
});
registerSfx('lock_on', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('square', 1320 * p, 1320 * p, t, 0.05, out, 0.18);
  A.osc('sine', 1980 * p, 1980 * p, t + 0.055, 0.08, out, 0.24);
});
registerSfx('missile_launch', (A, out, t) => {
  A.noiseBurst(t, 0.42, out, { f0: 500, f1: 2600, q: 1.1, gain: 0.55, attack: 0.02 });
  A.osc('sawtooth', 140, 520, t, 0.32, out, 0.1);
});
registerSfx('jet_start', (A, out, t) => {
  A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 300, f1: 2400, q: 1, gain: 0.85, attack: 0.05 });
  A.osc('sawtooth', 80, 320, t, 0.5, out, 0.18);
  A.osc('sine', 400, 1600, t + 0.1, 0.4, out, 0.18);
});
registerSfx('jet_land', (A, out, t) => {
  A.noiseBurst(t, 0.4, out, { type: 'lowpass', f0: 2400, f1: 200, q: 2, gain: 0.85 });
  A.osc('sine', 160, 50, t, 0.3, out, 0.7);
});
registerSfx('special_end', (A, out, t) => {
  A.osc('sine', 880, 440, t, 0.2, out, 0.2);
  A.osc('triangle', 660, 330, t + 0.06, 0.22, out, 0.14);
});
