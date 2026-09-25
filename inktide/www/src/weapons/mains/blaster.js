// Burst Popper blaster. Slow, heavy shots that detonate on impact or at the end of their range
// with an ink explosion. A direct hit splats a standard enemy (125); the blast catches anyone
// hiding near a wall or just around a corner.
import * as THREE from 'three';
import { MainWeapon, registerMain, aimDir } from '../base.js';
import { makeBlasterModel, addPoseHook, reachArm } from '../models.js';
import { blast, sfx } from './shared.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class Blaster extends MainWeapon {
  static defaults = {
    fireRate: 1.25,
    inkPerShot: 9,
    speed: 16.5,
    rangeM: 7.6,
    directDamage: 125,
    splashDamage: 70,
    splashRadius: 2.3,
    paintRadius: 1.6,
    spread: 1.5,
    jumpSpread: 6,
    moveMul: 0.66,
    range: 7.5,
  };

  constructor(w, stats) {
    super(w, stats);
    this.kick = 0;
    this.unhook = addPoseHook(w.model, (dt, s, m) => this.pose(dt, s, m));
  }

  buildModel() { return makeBlasterModel(this.w.session.ink.color(this.w.team)); }

  update(dt, ctrl) {
    this.cool -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 4);
    this.firing = ctrl.fire || this.cool > 0.35;
    if (ctrl.fire && this.cool <= 0) {
      if (!this.w.useInk(this.s.inkPerShot)) { this.w.onOutOfInk?.(); this.cool = 0.2; return; }
      this.cool = 1 / this.s.fireRate;
      this.shoot();
    }
    if (this.cool < 0) this.cool = 0;
  }

  muzzle(out) {
    const mz = this.model?.userData.muzzle;
    if (mz && this.w.model?.kid?.visible) return mz.getWorldPosition(out);
    const w = this.w;
    _d.set(w.aim.dir.x, 0, w.aim.dir.z).normalize();
    return out.copy(w.position).addScaledVector(_d, 0.55).add(_p.set(-_d.z, 0, _d.x).multiplyScalar(-0.22)).setY(w.position.y + 1.05);
  }

  shoot() {
    const w = this.w, s = this.s, S = w.session;
    const color = S.ink.color(w.team);
    this.muzzle(_m);
    aimDir(w, _m, w.grounded ? s.spread : s.jumpSpread, _d);
    const life = s.rangeM / s.speed;
    let done = false;
    const detonate = (pos, normal, skip) => {
      if (done) return;
      done = true;
      blast(S, pos, normal, w.team, { owner: w, damage: s.splashDamage, radius: s.splashRadius, paintRadius: s.paintRadius, skip, sound: 'blaster_boom' });
    };
    S.projectiles.spawn({
      pos: _m, vel: _d.clone().multiplyScalar(s.speed), team: w.team, owner: w,
      damage: s.directDamage, size: 0.2, radius: 0.24, gravity: 3, gravityDelay: life * 0.7, life,
      trail: { every: 1.3, radius: 0.34 }, fx: false,
      onHit: (p, hit) => detonate(hit.point.clone(), hit.actor ? _up : hit.normal, hit.actor || null),
      onExpire: (p) => detonate(p.pos.clone(), null, null),
      onStep: (p) => {
        // wobble + dribble so the slow shot reads as a heavy glob
        if (Math.random() < 0.5) S.fx.spray(p.pos, _p.copy(p.vel).multiplyScalar(0.15), color, 1, 0.8, { size: 0.05, life: 0.25 });
      },
    });
    S.fx.burst(_m, _d, color, 10, 4, { size: 0.06 });
    S.fx.ring(_m, _d, color, 0.45, 0.22);
    S.fx.puff(_m, '#ffffff', 0.35, 0.3, _p.copy(_d).multiplyScalar(1.2), 1.8, 0.4);
    sfx(w, 'blaster_fire', { volume: 0.8, pitch: 0.95 + Math.random() * 0.1 });
    S.shake?.(w.position, 0.08);
    this.recoil = 1.4;
    this.kick = 1;
  }

  cancel() { this.firing = false; }

  pose(dt, st, m) {
    if (!this.model || st.hidden || !m.kid.visible) return;
    const sp = this.w.kit?.special;
    if (sp?.active && sp.hidesMain) return;
    this.kick = Math.max(0, this.kick - dt * 6);
    // chunky recoil: the whole gun bucks up and back along the arm
    const inner = this.model.userData.inner;
    inner.position.set(0, 0, -this.kick * 0.06);
    inner.rotation.x = -this.kick * 0.25;
    if (st.aiming) {
      m.root.updateMatrixWorld(true);
      reachArm(m.arms[m.arms[0] === m.gunArm ? 1 : 0], this.model.userData.foregrip.getWorldPosition(_p), 0.4);
    }
  }

  dispose() { this.unhook?.(); super.dispose(); }
}

registerMain('blaster', Blaster);
