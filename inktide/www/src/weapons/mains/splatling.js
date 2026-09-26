// Gatling Spinner splatling. Hold Fire to spin the barrels up (whine + visible spin, charge ring
// on the crosshair), release to unleash a long rapid stream whose length is proportional to the
// charge. Press Fire again mid-burst to start a new spin-up.
import * as THREE from 'three';
import { MainWeapon, registerMain, aimDir } from '../base.js';
import { makeSplatlingModel, addPoseHook, holdTwoHanded, rootMatrix } from '../models.js';
import { sfx, LoopSound, toWorld } from './shared.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _mat = new THREE.Matrix4();

export class Splatling extends MainWeapon {
  static defaults = {
    chargeTime: 1.0,
    chargeMoveMul: 0.55,
    moveMul: 0.62,
    fireRate: 12,
    maxShots: 24,          // full charge → 2 s stream
    inkPerShot: 1.1,
    speed: 34,
    straight: 0.24,
    gravity: 26,
    spread: 3.2,
    jumpSpread: 9,
    damage: 30,
    paintRadius: 0.52,
    trailEvery: 1.2,
    trailRadius: 0.36,
    range: 13,
  };

  constructor(w, stats) {
    super(w, stats);
    this.chg = 0;
    this.charging = false;
    this.shotsLeft = 0;
    this.spinV = 0;         // barrel spin speed (visual, 0..1)
    this.spinA = 0;
    this.readyPlayed = false;
    this.loop = new LoopSound(w.session.audio, 'spin');
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  buildModel() { return makeSplatlingModel(this.w.session.ink.color(this.w.team)); }

  get charge() { return this.charging ? Math.max(0.001, this.chg) : 0; }
  get moveMul() { return this.charging ? this.s.chargeMoveMul : this.shotsLeft > 0 ? this.s.moveMul : 1; }

  update(dt, ctrl) {
    const w = this.w, s = this.s;
    this.recoil = Math.max(0, this.recoil - dt * 10);
    if (ctrl.fire) {
      if (!this.charging) {
        if (ctrl.firePressed || this.shotsLeft <= 0) {
          if (w.ink < s.inkPerShot * 2) { if (ctrl.firePressed) w.onOutOfInk?.(); }
          else { this.charging = true; this.chg = 0; this.shotsLeft = 0; this.readyPlayed = false; }
        }
      }
      if (this.charging) {
        this.chg = Math.min(1, this.chg + (dt / s.chargeTime) * (w.grounded ? 1 : 0.7));
        if (this.chg >= 1 && !this.readyPlayed) { this.readyPlayed = true; sfx(w, 'splatling_ready', { volume: 0.5 }); }
      }
    } else if (this.charging) {
      this.charging = false;
      this.shotsLeft = Math.max(3, Math.round(s.maxShots * this.chg));
      this.cool = 0;
    }

    if (this.shotsLeft > 0 && !this.charging) {
      this.cool -= dt;
      while (this.cool <= 0 && this.shotsLeft > 0) {
        this.cool += 1 / s.fireRate;
        if (!w.useInk(s.inkPerShot)) { w.onOutOfInk?.(); this.shotsLeft = 0; break; }
        this.shotsLeft--;
        this.shoot();
      }
    }
    this.firing = this.charging || this.shotsLeft > 0;
    const target = this.charging ? this.chg : this.shotsLeft > 0 ? 1 : 0;
    this.spinV += (target - this.spinV) * Math.min(1, dt * (target > this.spinV ? 8 : 2.5));
    this.spinA += this.spinV * dt * 38;
    if (w.isPlayer && this.spinV > 0.02) this.loop.keep(this.spinV, 0.9);
  }

  muzzle(out) {
    const mz = this.model?.userData.muzzle;
    if (mz && this.w.model?.kid?.visible) return mz.getWorldPosition(out);
    return toWorld(this.w, -0.18, 0.95, 0.8, out);
  }

  shoot() {
    const w = this.w, s = this.s, S = w.session;
    this.muzzle(_m);
    aimDir(w, _m, w.grounded ? s.spread : s.jumpSpread, _d);
    S.projectiles.spawn({
      pos: _m, vel: _d.clone().multiplyScalar(s.speed * (0.97 + Math.random() * 0.06)), team: w.team, owner: w,
      damage: s.damage, size: 0.1, radius: 0.15, gravity: s.gravity, gravityDelay: s.straight, life: 2.5,
      paint: { radius: s.paintRadius }, trail: { every: s.trailEvery, radius: s.trailRadius },
      falloff: { start: 10, end: 16, min: 0.5 },
    });
    const color = S.ink.color(w.team);
    S.fx.spray(_m, _d.clone().multiplyScalar(5), color, 2, 1.6, { size: 0.035, life: 0.2 });
    this.recoil = 0.6;
    if (w.isPlayer) S.audio?.sfx('splatling_fire', { volume: 0.4, pitch: 0.95 + Math.random() * 0.12, throttle: 0.02 });
    else S.audio?.sfx('splatling_fire', { pos: _m, volume: 0.3, throttle: 0.02 });
  }

  cancel() {
    this.firing = false;
    this.charging = false;
    this.chg = 0;
    this.shotsLeft = 0;
  }

  /** Hip-held: the gatling points along the aim; both hands on its grips. */
  pose(dt, st, m) {
    if (!this.model || st.hidden || !m.kid.visible) return;
    const sp = this.w.kit?.special;
    if (sp?.active && sp.hidesMain) return;
    const pitch = st.aiming ? THREE.MathUtils.clamp(st.aimPitch || 0, -0.9, 0.9) : -0.25;
    const shake = this.shotsLeft > 0 ? (Math.random() - 0.5) * 0.012 : 0;
    rootMatrix(_mat, -0.17 + shake, 0.8 + shake - this.recoil * 0.01, 0.2 - this.recoil * 0.02, -pitch, 0.06);
    holdTwoHanded(this.model, m, _mat, this.model.userData.grips, 0.4);
    this.model.userData.spin.rotation.z = this.spinA;
  }

  dispose() { this.unhook?.(); this.loop.stop(); super.dispose(); }
}

registerMain('splatling', Splatling);
