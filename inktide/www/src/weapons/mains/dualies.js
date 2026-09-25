// Twin Dualies. Two quick pistols that fire alternately. While firing, press Jump with a direction
// to dodge-roll (up to two in a row); after a roll you plant your feet for a moment and fire
// tighter, faster "turret" shots.
//
// The roll needs the Jump edge BEFORE the wielder's own jump code consumes it, so it is polled from
// the `drivesMovement` getter (the Player reads it right before its movement/jump branch). While
// rolling the weapon owns the horizontal velocity and the Player only applies gravity.
import * as THREE from 'three';
import { MainWeapon, registerMain, muzzleOf, aimDir } from '../base.js';
import { makeDualieModel, addPoseHook } from '../models.js';
import { wishDir, sfx, UP } from './shared.js';
import { disposeTree } from '../../engine/dispose.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pv = new THREE.Vector3(0, 0.55, 0);
const _tmp = new THREE.Vector3();

export class Dualies extends MainWeapon {
  static defaults = {
    fireRate: 10,
    turretRate: 12,
    inkPerShot: 0.8,
    speed: 26,
    straight: 0.14,
    gravity: 28,
    spread: 5,
    turretSpread: 1.6,
    jumpSpread: 10,
    damage: 28,
    paintRadius: 0.5,
    trailEvery: 1.1,
    trailRadius: 0.34,
    moveMul: 0.8,
    rollSpeed: 12.5,
    rollTime: 0.24,
    turretTime: 0.42,
    rollInk: 7,
    maxRolls: 2,
    range: 8.5,
  };

  constructor(w, stats) {
    super(w, stats);
    this.shots = 0;
    this.recoil2 = 0;
    this.rollT = 0;
    this.turretT = 0;
    this.rolls = 0;
    this.idleT = 0;
    this.rollDir = new THREE.Vector3(0, 0, 1);
    this.rollVis = false;
    // off-hand pistol in the other hand
    this.offModel = null;
    const m = w.model;
    if (m?.arms) {
      const offArm = m.arms[m.arms[0] === m.gunArm ? 1 : 0];
      this.offSocket = new THREE.Group();
      this.offSocket.position.copy(m.weaponSocket.position);
      offArm.hand.add(this.offSocket);
      this.offModel = makeDualieModel(w.session.ink.color(w.team), true);
      this.offSocket.add(this.offModel);
      this.offModel.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
    this.unhook = addPoseHook(w.model, (dt, s, mm) => this.pose(dt, s, mm));
  }

  buildModel() { return makeDualieModel(this.w.session.ink.color(this.w.team), false); }

  get moveMul() { return this.firing ? this.s.moveMul : 1; }

  setColor(c) {
    super.setColor(c);
    this.offModel?.traverse((o) => { if (o.userData.inkPart) { o.material.color.set(c); o.material.emissive?.set(c); } });
  }

  get drivesMovement() {
    this.pollRoll();
    return this.rollT > 0 || this.turretT > 0;
  }

  /** Start a dodge roll if Jump was just pressed while firing with a direction held. */
  pollRoll() {
    const w = this.w, s = this.s;
    if (!(w.jumpBuffer > 0) || this.rollT > 0 || this.rolls >= s.maxRolls) return;
    if (!this.firing || !w.grounded || w.alive === false) return;
    wishDir(w, _wish);
    if (_wish.length() < 0.3) return;
    if (w.ink < s.rollInk) { w.onOutOfInk?.(); return; }
    w.useInk(s.rollInk);
    w.jumpBuffer = 0;
    this.rolls++;
    this.idleT = 0;
    this.rollT = s.rollTime;
    this.turretT = 0;
    this.rollDir.copy(_wish).normalize();
    w.velocity.x = this.rollDir.x * s.rollSpeed;
    w.velocity.z = this.rollDir.z * s.rollSpeed;
    const S = w.session, color = S.ink.color(w.team);
    S.ink.paint(w.position, 0.9, w.team, UP, { source: w });
    S.fx.burst(w.position, UP, color, 12, 4, { size: 0.06 });
    S.fx.ring(w.position, UP, color, 1.1, 0.35);
    sfx(w, 'dodge_roll', { volume: 0.7 });
  }

  update(dt, ctrl) {
    const w = this.w, s = this.s, S = w.session;
    this.cool -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.recoil2 = Math.max(0, this.recoil2 - dt * 9);

    if (this.rollT > 0) {
      this.rollT -= dt;
      const k = 1 - Math.max(0, this.rollT) / s.rollTime;
      const sp = s.rollSpeed * (1 - k * 0.45);
      w.velocity.x = this.rollDir.x * sp;
      w.velocity.z = this.rollDir.z * sp;
      if (Math.random() < 0.6) S.fx.spray(w.position, _d.set(-this.rollDir.x * 2, 1.5, -this.rollDir.z * 2), S.ink.color(w.team), 1, 1.2, { size: 0.05, life: 0.3 });
      if (this.rollT <= 0) {
        this.rollT = 0;
        this.turretT = s.turretTime;
        w.velocity.x *= 0.2; w.velocity.z *= 0.2;
        S.ink.paint(w.position, 1.05, w.team, UP, { source: w });
        S.fx.burst(w.position, UP, S.ink.color(w.team), 10, 3.5, { size: 0.06 });
        S.fx.ring(w.position, UP, S.ink.color(w.team), 1.3, 0.35);
      }
    } else if (this.turretT > 0) {
      this.turretT -= dt;
      w.velocity.x *= 0.6; w.velocity.z *= 0.6;
      if (!ctrl.fire) this.turretT = Math.min(this.turretT, 0.12);
      if (this.turretT <= 0) this.turretT = 0;
    }
    if (!ctrl.fire && this.rollT <= 0 && this.turretT <= 0) {
      this.idleT += dt;
      if (this.idleT > 0.3) this.rolls = 0;
    } else if (this.rollT <= 0 && this.turretT <= 0) {
      this.idleT += dt;
      if (this.idleT > 1.2) this.rolls = 0;
    }

    this.firing = ctrl.fire;
    if (!ctrl.fire || this.rollT > 0) { if (this.cool < 0) this.cool = 0; return; }
    const rate = this.turretT > 0 ? s.turretRate : s.fireRate;
    while (this.cool <= 0) {
      this.cool += 1 / rate;
      if (!w.useInk(s.inkPerShot)) { w.onOutOfInk?.(); this.cool = Math.max(this.cool, 0.12); return; }
      this.shoot();
    }
  }

  shoot() {
    const w = this.w, s = this.s, S = w.session;
    const left = (this.shots++ & 1) === 1;
    const src = left ? this.offModel : this.model;
    const mz = src?.userData.muzzle;
    if (mz && w.model?.kid?.visible && this.rollT <= 0) mz.getWorldPosition(_m);
    else muzzleOf(w, _m, 0.45, left ? -0.22 : 0.22, 1.02);
    const spread = !w.grounded ? s.jumpSpread : this.turretT > 0 ? s.turretSpread : s.spread;
    aimDir(w, _m, spread, _d);
    S.projectiles.spawn({
      pos: _m, vel: _d.clone().multiplyScalar(s.speed), team: w.team, owner: w,
      damage: s.damage, size: 0.1, radius: 0.15, gravity: s.gravity, gravityDelay: s.straight, life: 2.2,
      paint: { radius: s.paintRadius }, trail: { every: s.trailEvery, radius: s.trailRadius },
      falloff: { start: 6.5, end: 11, min: 0.5 },
    });
    S.fx.spray(_m, _d.clone().multiplyScalar(4), S.ink.color(w.team), 2, 1.4, { size: 0.032, life: 0.22 });
    if (left) this.recoil2 = 1; else this.recoil = 1;
    sfx(w, 'dualie_fire', { volume: 0.42, pitch: left ? 1.08 : 0.96, throttle: 0.02 });
  }

  cancel() {
    this.firing = false;
    this.turretT = 0;
    if (this.rollT > 0) { this.rollT = 0; }
  }

  pose(dt, st, m) {
    const sp = this.w.kit?.special;
    const hidden = !!(sp?.active && sp.hidesMain);
    if (this.offModel) this.offModel.visible = !hidden;
    if (st.hidden || !m.kid.visible || hidden) { this.resetRoll(m); return; }
    const off = m.arms[m.arms[0] === m.gunArm ? 1 : 0];
    const pitch = st.aimPitch || 0;
    if (st.aiming) {
      off.sh.rotation.set(-Math.PI / 2 - pitch + this.recoil2 * 0.3, 0, -0.1);
      off.elbow.rotation.set(-0.15, 0, 0);
    }
    // dodge roll: tumble the kid around the axis perpendicular to the roll
    if (this.rollT > 0) {
      const k = 1 - this.rollT / this.s.rollTime;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      _axis.crossVectors(UP, this.rollDir).normalize();
      _axis.applyAxisAngle(UP, -this.w.yaw);
      _q.setFromAxisAngle(_axis, e * Math.PI * 2);
      m.kid.quaternion.copy(_q);
      _tmp.copy(_pv).applyQuaternion(_q);
      m.kid.position.copy(_pv).sub(_tmp);
      m.kid.position.y += Math.sin(k * Math.PI) * 0.12 - 0.08;
      this.rollVis = true;
      for (const A of m.arms) { A.sh.rotation.set(-2.2, 0, A.side * 0.5); A.elbow.rotation.set(-1.2, 0, 0); }
      for (const L of m.legs) { L.thigh.rotation.x = -1.3; L.knee.rotation.x = 1.9; }
    } else {
      this.resetRoll(m);
      if (this.turretT > 0) {
        // planted crouch after a roll
        const c = Math.min(1, this.turretT / 0.1);
        m.hips.position.y -= 0.12 * c;
        for (const L of m.legs) { L.thigh.rotation.x = -0.75 * c + (L.side > 0 ? -0.2 : 0.35) * c; L.knee.rotation.x = 1.15 * c; }
      }
    }
  }

  resetRoll(m) {
    if (!this.rollVis) return;
    this.rollVis = false;
    m.kid.quaternion.identity();
    m.kid.position.set(0, 0, 0);
  }

  dispose() {
    this.unhook?.();
    if (this.w.model) this.resetRoll(this.w.model);
    this.offSocket?.parent?.remove(this.offSocket);
    disposeTree(this.offModel);          // the off-hand pistol is not this.model: free it too
    this.offModel = null;
    super.dispose();
  }
}

registerMain('dualies', Dualies);
