// Tidal Slam: leap up, hang for a beat, slam down for a huge ink explosion.
import * as THREE from 'three';
import { Special, registerSpecial, inkExplosion } from '../base.js';

const _up = new THREE.Vector3(0, 1, 0);

export class TidalSlam extends Special {
  static defaults = { rise: 10.5, hang: 0.28, slamSpeed: 34, paintRadius: 7, damage: 180, dmgRadius: 5.5 };

  activate() {
    super.activate();
    this.phase = 'rise';
    this.t = 0;
    const w = this.w;
    w.velocity.set(0, this.s.rise, 0);
    w.invulnerable = Math.max(w.invulnerable || 0, 0.2);
    w.session.audio?.sfx('special', { volume: 0.9 });
    w.session.fx.ring(w.position, _up, w.session.ink.color(w.team), 2.5, 0.5);
  }

  get drivesMovement() { return this.active; }

  update(dt) {
    const w = this.w;
    const S = w.session;
    this.t += dt;
    if (this.phase === 'rise') {
      w.velocity.y -= 26 * dt;
      w.velocity.x *= 0.9; w.velocity.z *= 0.9;
      if (w.velocity.y <= 0) { this.phase = 'hang'; this.t = 0; }
    } else if (this.phase === 'hang') {
      w.velocity.set(0, 0, 0);
      if (this.t > this.s.hang) { this.phase = 'slam'; w.velocity.set(0, -this.s.slamSpeed, 0); S.audio?.sfx('whoosh', { volume: 0.8 }); }
    } else if (this.phase === 'slam') {
      w.velocity.set(0, -this.s.slamSpeed, 0);
      if (w.grounded || this.t > 2) {
        const g = S.level.groundBelow(w.position, 3);
        const p = g ? g.point : w.position.clone();
        inkExplosion(S, p, g ? g.normal : _up, w.team, { paintRadius: this.s.paintRadius, damage: this.s.damage, dmgRadius: this.s.dmgRadius, owner: w, sound: 'bigboom' });
        S.shake?.(p, 0.9);
        w.invulnerable = Math.max(w.invulnerable || 0, 0.35);
        this.end();
      }
    }
  }
}

registerSpecial('tidal-slam', TidalSlam);
