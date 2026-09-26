// Shooter: automatic mid-range blaster (Splash Blaster).
import * as THREE from 'three';
import { MainWeapon, registerMain, muzzleOf, aimDir } from '../base.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Shooter extends MainWeapon {
  static defaults = {
    fireRate: 7.5,          // shots per second
    inkPerShot: 0.92,
    speed: 27,
    straight: 0.17,         // seconds of straight flight before gravity
    gravity: 28,
    spread: 4,
    jumpSpread: 11,
    damage: 35,
    paintRadius: 0.62,
    trailEvery: 1.05,
    trailRadius: 0.38,
    size: 0.11,
    moveMul: 0.72,
    range: 9,
  };

  update(dt, ctrl) {
    this.cool -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.firing = ctrl.fire;
    if (!ctrl.fire) return;
    const s = this.s;
    while (this.cool <= 0) {
      this.cool += 1 / s.fireRate;
      if (!this.w.useInk(s.inkPerShot)) { this.w.onOutOfInk?.(); this.cool = Math.max(this.cool, 0.12); return; }
      this.shoot();
    }
  }

  shoot() {
    const w = this.w, s = this.s, S = w.session;
    muzzleOf(w, _m);
    aimDir(w, _m, w.grounded ? s.spread : s.jumpSpread, _d);
    S.projectiles.spawn({
      pos: _m, vel: _d.clone().multiplyScalar(s.speed), team: w.team, owner: w,
      damage: s.damage, size: s.size, radius: 0.16, gravity: s.gravity, gravityDelay: s.straight, life: 2.5,
      paint: { radius: s.paintRadius }, trail: { every: s.trailEvery, radius: s.trailRadius },
      falloff: { start: 7, end: 13, min: 0.5 },
    });
    S.fx.spray(_m, _d.clone().multiplyScalar(4), S.ink.color(w.team), 2, 1.5, { size: 0.035, life: 0.25 });
    this.recoil = 1;
    if (w.isPlayer) S.audio?.sfx('shoot', { volume: 0.45, pitch: 0.95 + Math.random() * 0.1 });
    else S.audio?.sfx('shoot', { pos: _m, volume: 0.3, pitch: 1.05 });
  }
}

registerMain('shooter', Shooter);
