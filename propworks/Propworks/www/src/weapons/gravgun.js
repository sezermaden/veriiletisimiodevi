/* The Gravity Gun ("Manipulator"): a short-range tool for combat.
   PRIMARY punts whatever is in front (or launches what you hold).
   SECONDARY pulls a light object to you and holds it; press again to drop. */
import * as THREE from 'three';
import { Weapon } from './weapons.js';
import { gravgunModel } from './viewmodels.js';
import { Audio } from '../core/audio.js';

const _a = new THREE.Vector3(), _q = new THREE.Quaternion();
const MAX_HOLD_MASS = 260;

export class GravGun extends Weapon {
  constructor(game) {
    super(game, { id: 'gravgun', name: 'Gravity Gun', slot: 1, model: gravgunModel, base: [0.2, -0.22, -0.34] });
    this.held = null;
    this.claw = 0;
    this.loop = null;
    game.prePhysics.push(() => this._servo());
  }

  update(input, dt) {
    super.update(input, dt);
    const { o, d } = this.eyeRay();
    const excl = { excludeBody: this.game.player.body };
    if (this.held && this.held.e.removed) this._drop();

    if (input.justPressed('primary') && this.cooldown <= 0) {
      this.cooldown = 0.5;
      this.kick = 1;
      this.claw = 1;
      if (this.held) {
        const e = this.held.e;
        this._drop();
        e.body?.applyImpulse({ x: d.x * e.mass * 32, y: d.y * e.mass * 32, z: d.z * e.mass * 32 }, true);
        this.game.fx.sparks(e.curr.p, d, 10, new THREE.Color(3, 2, 0.6));
        Audio.play('grav_punt');
        e.thrownBy = 'player'; e.thrownT = 1.5;
      } else {
        const hit = this.game.physics.raycast(o, d, 7, excl);
        Audio.play('grav_punt', { volume: hit ? 1 : 0.5 });
        if (hit?.entity) {
          const e = hit.entity;
          if (e.kind === 'npc') {
            e.npc?.hurt(12, { type: 'punt', dir: d, force: 14 });
          } else if (e.body) {
            if (e.frozen && e.owner !== 'player') { /* frozen map props resist */ } else if (e.frozen) e.setFrozen(false, false);
            const m = Math.min(e.mass, 400);
            e.body.applyImpulseAtPoint({ x: d.x * m * 22, y: d.y * m * 22 + m * 2, z: d.z * m * 22 }, hit.point, true);
            e.thrownBy = 'player'; e.thrownT = 1.5;
            e.damage?.(8, { type: 'punt' });
          }
          this.game.fx.beamHit(new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z), hit.normal, new THREE.Color(3, 2, 0.6));
        }
        this.game.renderer.addShake(0.1);
      }
    }

    if (input.justPressed('secondary')) {
      if (this.held) this._drop();
      else {
        const hit = this.game.physics.raycast(o, d, 14, excl);
        const e = hit?.entity;
        if (e && e.body && e.kind !== 'npc' && e.kind !== 'world' && !e.frozen && e.mass <= MAX_HOLD_MASS) {
          this.held = { e, rot: _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.game.player.rig.yaw).multiply(e.curr.q).clone() };
          e.held = true;
          Audio.play('grav_pickup');
          this.loop = this.loop || Audio.loop('gravgun', { volume: 0.4 });
          this.loop.set(1);
        } else Audio.play('dryfire');
      }
    }
    this.claw = Math.max(this.held ? 0.7 : 0, this.claw - dt * 3);
    for (const c of this.parts.claws || []) {
      const s = 0.06 + this.claw * 0.025;
      c.position.x = Math.cos(c.userData.a) * s;
      c.position.y = 0.01 + Math.sin(c.userData.a) * s;
    }
    if (this.parts.coreMat) this.parts.coreMat.emissiveIntensity = 2 + this.claw * 4;
  }

  _servo() {
    const h = this.held;
    if (!h || !h.e.body || h.e.removed) return;
    const cam = this.game.renderer.camera;
    const size = h.e.halfHeight || 0.5;
    const target = cam.getWorldDirection(_a).multiplyScalar(1.4 + size).add(cam.position);
    const t = h.e.body.translation();
    h.e.body.setLinvel({ x: (target.x - t.x) * 18, y: (target.y - t.y) * 18, z: (target.z - t.z) * 18 }, true);
    const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.game.player.rig.yaw).multiply(h.rot);
    const r = h.e.body.rotation();
    const dq = want.multiply(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert());
    if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
    const ang = 2 * Math.acos(Math.min(1, dq.w)), s = Math.sqrt(1 - dq.w * dq.w);
    if (s > 1e-4) h.e.body.setAngvel({ x: (dq.x / s) * ang * 10, y: (dq.y / s) * ang * 10, z: (dq.z / s) * ang * 10 }, true);
  }

  _drop() {
    if (!this.held) return;
    this.held.e.held = false;
    this.held = null;
    this.loop?.set(0);
    Audio.play('physgun_drop', { volume: 0.5 });
  }

  holster() { this._drop(); }
  dispose() { this.loop?.stop(); }
  onEntityRemoved(e) { if (this.held?.e === e) this._drop(); }
  hudInfo() { return null; }
}
