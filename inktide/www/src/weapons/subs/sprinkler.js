// Sprinkler: thrown like a bomb, sticks to whatever it touches (floor, wall, ceiling, moving
// platform) and sprays small ink blobs around itself in pulses for ~10 s — fast at first, then
// slower. One active per wielder: throwing another pops the old one.
import * as THREE from 'three';
import { SubWeapon, registerSub, muzzleOf } from '../base.js';
import { Entity } from '../../entities/base.js';
import { makeSprinklerModel } from '../models.js';
import { sfx, UP } from '../mains/shared.js';
import { disposeTree } from '../../engine/dispose.js';

const _m = new THREE.Vector3();
const _v = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Mark every mesh of a procedural model so the entity frees it on removal. */
export function ownModel(entity, root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isSprite) return;
    if (o.isMesh) o.userData.ownGeometry = true;
    if (o.material) entity.own(o.material);
  });
}

export class SprinklerDevice extends Entity {
  constructor(session, owner, pos, normal, s, dyn = null) {
    super(session, { type: 'sprinkler-device', pos: [pos.x, pos.y, pos.z] });
    this.owner = owner;
    this.team = owner.team;
    this.s = s;
    this.normal = normal.clone().normalize();
    this.group.quaternion.setFromUnitVectors(UP, this.normal);
    this.model = makeSprinklerModel(session.ink.color(this.team));
    this.group.add(this.model);
    ownModel(this, this.model);
    this.t = 0;
    this.pulseT = 0.25;
    this.headA = Math.random() * 6.28;
    this.spinV = 0;
    this.popIn = 0;
    // frame on the surface for spray directions
    if (Math.abs(this.normal.y) < 0.9) this.t1 = new THREE.Vector3(0, 1, 0).cross(this.normal).normalize();
    else this.t1 = new THREE.Vector3(1, 0, 0).cross(this.normal).normalize();
    this.t2 = new THREE.Vector3().crossVectors(this.normal, this.t1);
    // ride moving platforms
    this.dyn = dyn;
    if (dyn) {
      dyn.mesh.updateMatrixWorld();
      this.localPos = dyn.mesh.worldToLocal(pos.clone());
      this.localN = this.normal.clone().transformDirection(new THREE.Matrix4().copy(dyn.mesh.matrixWorld).invert());
    }
  }

  step(dt) {
    const S = this.session, s = this.s;
    this.t += dt;
    if (this.dyn) {
      if (!S.level.dynamic.includes(this.dyn) || !this.dyn.enabled) { this.pop(); return; }
      this.dyn.mesh.updateMatrixWorld();
      this.group.position.copy(this.localPos).applyMatrix4(this.dyn.mesh.matrixWorld);
      this.normal.copy(this.localN).transformDirection(this.dyn.mesh.matrixWorld);
      this.group.quaternion.setFromUnitVectors(UP, this.normal);
    }
    if (this.t >= s.life) { this.pop(); return; }
    const fast = this.t < s.fastTime;
    this.pulseT -= dt;
    if (this.pulseT <= 0) {
      this.pulseT += fast ? s.fastInterval : s.slowInterval;
      this.spray(fast);
    }
  }

  spray(fast) {
    const S = this.session, s = this.s;
    const color = S.ink.color(this.team);
    _m.copy(this.group.position).addScaledVector(this.normal, 0.25);
    const n = fast ? 3 : 2;
    this.headA += 0.9;
    for (let i = 0; i < n; i++) {
      const a = this.headA + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const out = 0.75 + Math.random() * 0.2;
      _v.copy(this.t1).multiplyScalar(Math.cos(a) * out).addScaledVector(this.t2, Math.sin(a) * out).addScaledVector(this.normal, 0.55 + Math.random() * 0.3);
      _v.normalize().multiplyScalar(s.speed * (0.8 + Math.random() * 0.4));
      S.projectiles.spawn({
        pos: _m, vel: _v, team: this.team, owner: this.owner, damage: s.damage, size: 0.085, radius: 0.12,
        gravity: 20, life: 2, paint: { radius: s.paintRadius * (0.85 + Math.random() * 0.3) },
      });
      S.fx.spray(_m, _v.clone().multiplyScalar(0.5), color, 1, 1, { size: 0.035, life: 0.25 });
    }
    this.spinV = 1;
    if (this.owner.isPlayer || this.group.position.distanceToSquared(S.player?.position || _p) < 400) {
      S.audio?.sfx('sprinkler_spray', { pos: this.group.position, volume: 0.35, pitch: fast ? 1.1 : 0.9, throttle: 0.05 });
    }
  }

  render(dt) {
    this.popIn = Math.min(1, this.popIn + dt * 5);
    const k = this.popIn;
    const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1;
    let sc = k * pop;
    const left = this.s.life - this.t;
    if (left < 1.2) sc *= 0.85 + Math.abs(Math.sin(left * 14)) * 0.15;   // flicker before it runs dry
    this.model.scale.setScalar(Math.max(0.01, sc));
    this.spinV = Math.max(0.25, this.spinV - dt * 2);
    this.model.userData.head.rotation.y += dt * (6 + this.spinV * 18);
  }

  pop() {
    const S = this.session;
    if (this.dead) return;
    S.fx.burst(this.group.position, this.normal, S.ink.color(this.team), 10, 3, { size: 0.05 });
    S.fx.puff(this.group.position.clone().addScaledVector(this.normal, 0.2), '#ffffff', 0.4, 0.35, null, 1.8, 0.5);
    S.audio?.sfx('pop', { pos: this.group.position, volume: 0.35 });
    this.remove();
  }
}

export class Sprinkler extends SubWeapon {
  static defaults = {
    cost: 60, throwSpeed: 15, lift: 0.38,
    life: 10, fastTime: 3, fastInterval: 0.22, slowInterval: 0.42,
    speed: 7.5, damage: 20, paintRadius: 0.55,
  };

  constructor(w, stats) { super(w, stats); this.device = null; this.flying = new Set(); }

  use() {
    const w = this.w, S = w.session, s = this.s;
    muzzleOf(w, _m, 0.3, 0.1, 1.25);
    const color = S.ink.color(w.team);
    const mesh = makeSprinklerModel(color);
    mesh.scale.setScalar(0.9);
    _v.copy(w.aim.dir);
    _v.y = Math.max(_v.y, -0.3) + s.lift;
    _v.normalize().multiplyScalar(s.throwSpeed);
    _v.x += w.velocity.x * 0.5; _v.z += w.velocity.z * 0.5;
    const spinAxis = new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
    const proj = S.projectiles.spawn({
      pos: _m, vel: _v, team: w.team, owner: w, damage: 0, radius: 0.16, gravity: 24, life: 4, mesh,
      ignoreActors: true, fx: false,
      onStep: (p, dt) => { mesh.rotateOnAxis(spinAxis, dt * 14); },
      onHit: (p, hit) => {
        // the flight mesh is removed from the scene by Projectiles.kill; free it here
        this.flying.delete(mesh);
        disposeTree(mesh);
        if (!hit.normal) return;
        if (this.device && !this.device.dead) this.device.pop();
        const pos = _p.copy(hit.point).addScaledVector(hit.normal, 0.01);
        this.device = S.addEntity(new SprinklerDevice(S, w, pos, hit.normal, s, hit.dynamic || null));
        S.ink.paint(hit.point, 0.7, w.team, hit.normal, { source: w });
        S.fx.burst(hit.point, hit.normal, color, 8, 3, { size: 0.05 });
        S.fx.ring(hit.point, hit.normal, color, 0.8, 0.3);
        S.audio?.sfx('sprinkler_stick', { pos: hit.point, volume: 0.55 });
      },
      onExpire: () => { this.flying.delete(mesh); disposeTree(mesh); },
    });
    if (!proj) { disposeTree(mesh); return false; }          // projectile pool full: keep the ink
    this.flying.add(mesh);
    sfx(w, 'throw', { volume: 0.6 });
    return true;
  }

  dispose() {
    if (this.device && !this.device.dead) this.device.remove();
    for (const m of this.flying) disposeTree(m);     // session ended mid-throw
    this.flying.clear();
  }
}

registerSub('sprinkler', Sprinkler);

