// Slosh Bucket. Each slosh swings the bucket and throws a heavy, arcing wave of three blobs that
// sails over low walls and drops onto ledges. The lead blob hits hardest (70).
import * as THREE from 'three';
import { MainWeapon, registerMain } from '../base.js';
import { makeSlosherModel, addPoseHook } from '../models.js';
import { aimYaw, toWorld, sfx } from './shared.js';

const _m = new THREE.Vector3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const T_RELEASE = 0.11;

export class Slosher extends MainWeapon {
  static defaults = {
    interval: 0.56,
    inkPerSlosh: 7,
    blobs: [
      { speed: 14.2, lift: 0.3, damage: 70, size: 0.22, paint: 0.95 },
      { speed: 12.4, lift: 0.36, damage: 38, size: 0.18, paint: 0.8 },
      { speed: 10.6, lift: 0.44, damage: 30, size: 0.15, paint: 0.7 },
    ],
    gravity: 21,
    moveMul: 0.7,
    range: 8,
  };

  constructor(w, stats) {
    super(w, stats);
    this.swingT = -1;          // time since the swing started (-1 = idle)
    this.released = true;
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  buildModel() { return makeSlosherModel(this.w.session.ink.color(this.w.team)); }

  update(dt, ctrl) {
    this.cool -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 4);
    if (this.swingT >= 0) {
      this.swingT += dt;
      if (!this.released && this.swingT >= T_RELEASE) this.release();
      if (this.swingT > 0.5) this.swingT = -1;
    }
    this.firing = ctrl.fire || this.swingT >= 0;
    if (ctrl.fire && this.cool <= 0 && this.swingT < 0) {
      if (this.w.ink < this.s.inkPerSlosh) { this.w.onOutOfInk?.(); this.cool = 0.2; return; }
      this.cool = this.s.interval;
      this.swingT = 0;
      this.released = false;
    }
    if (this.cool < 0) this.cool = 0;
  }

  release() {
    const w = this.w, s = this.s, S = w.session;
    this.released = true;
    if (!w.useInk(s.inkPerSlosh)) { w.onOutOfInk?.(); return; }
    const color = S.ink.color(w.team);
    toWorld(w, -0.2, 1.35, 0.35, _m);
    const yaw = aimYaw(w);
    const pitch = Math.asin(THREE.MathUtils.clamp(w.aim.dir.y, -1, 1));
    s.blobs.forEach((b, i) => {
      const pp = pitch * 0.85 + b.lift;
      const cp = Math.cos(pp);
      _v.set(Math.sin(yaw) * cp, Math.sin(pp), Math.cos(yaw) * cp).multiplyScalar(b.speed);
      _v.x += w.velocity.x * 0.5; _v.z += w.velocity.z * 0.5;
      _p.copy(_m).addScaledVector(_v, -0.004 * i);
      S.projectiles.spawn({
        pos: _p, vel: _v, team: w.team, owner: w, damage: b.damage, size: b.size, radius: b.size + 0.06,
        gravity: s.gravity, life: 3, paint: { radius: b.paint },
        trail: { every: 1.4, radius: 0.34 },
        falloff: { start: 30, end: 40, min: 1 },
        onStep: (p) => { if (Math.random() < 0.35) S.fx.spray(p.pos, _v.copy(p.vel).multiplyScalar(0.1), color, 1, 0.6, { size: b.size * 0.35, life: 0.3 }); },
      });
    });
    _v.set(Math.sin(yaw), 0.6, Math.cos(yaw));
    S.fx.spray(_m, _v.clone().multiplyScalar(6), color, 12, 3.5, { size: 0.07, life: 0.45 });
    S.fx.burst(_m, _v.normalize(), color, 6, 3, { size: 0.06 });
    sfx(w, 'slosh', { volume: 0.75 });
    this.recoil = 1;
  }

  cancel() { this.firing = false; this.swingT = -1; this.released = true; }

  /** Overhand swing: bucket back and low → up and forward at release → settle. */
  pose(dt, st, m) {
    if (!this.model || st.hidden || !m.kid.visible) return;
    const sp = this.w.kit?.special;
    if (sp?.active && sp.hidesMain) return;
    const A = m.gunArm;
    const pitch = st.aimPitch || 0;
    const bucket = this.model.userData.bucket;
    let sh, tip = 0;                 // tip 0 = hanging upright, 1 = opening along the arm
    if (this.swingT >= 0) {
      const t = this.swingT;
      if (t < T_RELEASE) { const k = t / T_RELEASE; sh = THREE.MathUtils.lerp(0.9, -2.3, k * k); tip = k; }
      else { const k = Math.min(1, (t - T_RELEASE) / 0.35); sh = THREE.MathUtils.lerp(-2.3, -1.3 - pitch * 0.5, 1 - (1 - k) * (1 - k)); tip = 1 - k; }
    } else if (st.aiming) {
      sh = -1.3 - pitch * 0.5;
    } else {
      this.sway = (this.sway || 0) + dt * (2 + (st.speed || 0) * 1.4);
      sh = -0.35 + Math.sin(this.sway) * 0.12 * Math.min(1, (st.speed || 0) / 4);
    }
    A.sh.rotation.set(sh, 0, 0.15);
    A.elbow.rotation.set(-0.15, 0, 0);
    // keep the bucket hanging under the hand, tip it toward the throw during the swing
    const upright = Math.atan2(-Math.cos(sh), -Math.sin(sh));
    bucket.rotation.x = THREE.MathUtils.lerp(upright, Math.PI / 2, tip);
    const surf = this.model.userData.surface;
    surf.position.y = 0.085 - (this.swingT >= 0 && this.swingT > T_RELEASE ? 0.05 : 0);
  }

  dispose() { this.unhook?.(); super.dispose(); }
}

registerMain('slosher', Slosher);
