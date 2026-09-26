// Ink Mine: placed at your feet, nearly invisible (a faint ring in the ink). Arms after half a
// second; when an enemy of another team comes within 2.5 m it chirps and blows (120 at the
// centre). One mine per wielder — placing a new one fizzles the old one.
import * as THREE from 'three';
import { SubWeapon, registerSub, inkExplosion } from '../base.js';
import { Entity } from '../../entities/base.js';
import { makeMineModel } from '../models.js';
import { isCombatant, sfx, UP, DOWN } from '../mains/shared.js';
import { ownModel } from './sprinkler.js';

const _p = new THREE.Vector3();
const _hc = new THREE.Vector3();

export class MineDevice extends Entity {
  constructor(session, owner, pos, normal, s) {
    super(session, { type: 'ink-mine-device', pos: [pos.x, pos.y, pos.z] });
    this.owner = owner;
    this.team = owner.team;
    this.s = s;
    this.normal = normal.clone();
    this.group.quaternion.setFromUnitVectors(UP, this.normal);
    this.model = makeMineModel(session.ink.color(this.team));
    this.group.add(this.model);
    ownModel(this, this.model);
    this.t = 0;
    this.trigT = -1;
    this.popIn = 0;
  }

  step(dt) {
    const S = this.session, s = this.s;
    this.t += dt;
    if (this.trigT >= 0) {
      this.trigT += dt;
      if (this.trigT >= s.fuse) this.explode();
      return;
    }
    if (this.t < s.armTime) return;
    const c = this.group.position;
    for (const a of S.actors) {
      if (!isCombatant(a, this.team)) continue;
      a.hitCenter(_hc);
      const dy = _hc.y - c.y;
      if (dy < -1.5 || dy > 2.2) continue;
      if (Math.hypot(_hc.x - c.x, _hc.z - c.z) > s.trigger + (a.hitRadius ?? 0.5) * 0.5) continue;
      this.trigger();
      break;
    }
  }

  trigger() {
    this.trigT = 0;
    this.session.audio?.sfx('mine_beep', { pos: this.group.position, volume: 0.8, throttle: 0 });
  }

  explode() {
    if (this.dead) return;
    const S = this.session, s = this.s;
    _p.copy(this.group.position).addScaledVector(this.normal, 0.15);
    inkExplosion(S, _p, this.normal, this.team, { paintRadius: s.paintRadius, damage: s.damage, dmgRadius: s.dmgRadius, owner: this.owner, sound: 'boom' });
    this.remove();
  }

  fizzle() {
    if (this.dead) return;
    const S = this.session;
    S.fx.burst(this.group.position, this.normal, S.ink.color(this.team), 6, 2, { size: 0.04 });
    S.fx.puff(this.group.position, '#ffffff', 0.3, 0.3, null, 1.6, 0.4);
    this.remove();
  }

  render(dt) {
    this.popIn = Math.min(1, this.popIn + dt * 4);
    const ud = this.model.userData;
    const armed = this.t >= this.s.armTime;
    if (this.trigT >= 0) {
      // triggered: hop up and flash fast
      const k = this.trigT / this.s.fuse;
      this.model.position.y = Math.sin(Math.min(1, k) * Math.PI * 0.5) * 0.35;
      this.model.scale.setScalar(1 + k * 0.5);
      ud.light.visible = Math.sin(this.trigT * 70) > 0;
      ud.ring.material.opacity = 0.9;
      ud.ring.scale.setScalar(1 + k * 5);
    } else {
      const e = this.popIn;
      this.model.scale.setScalar(e < 1 ? e * (1 + Math.sin(e * Math.PI) * 0.3) : 1);
      const pulse = 0.5 + 0.5 * Math.sin(this.t * (armed ? 3.2 : 12));
      ud.ring.material.opacity = armed ? 0.12 + pulse * 0.22 : 0.4 * pulse;
      ud.ring.scale.setScalar(1 + pulse * 0.08);
      ud.light.visible = armed ? pulse > 0.8 : pulse > 0.5;
    }
  }
}

export class InkMine extends SubWeapon {
  static defaults = { cost: 60, armTime: 0.5, trigger: 2.5, fuse: 0.32, damage: 120, dmgRadius: 3, paintRadius: 2.6 };

  constructor(w, stats) { super(w, stats); this.device = null; }

  use() {
    const w = this.w, S = w.session, s = this.s;
    const g = S.level.raycast(_p.copy(w.position).setY(w.position.y + 0.4), DOWN, 2.2, { staticOnly: true });
    if (!g || g.normal.y < 0.5) { sfx(w, 'empty', { volume: 0.4 }); return false; }   // mid-air / on a wall: no ink spent
    if (this.device && !this.device.dead) this.device.fizzle();
    this.device = S.addEntity(new MineDevice(S, w, g.point.clone().addScaledVector(g.normal, 0.01), g.normal, s));
    S.ink.paint(g.point, 0.95, w.team, g.normal, { source: w });
    S.fx.ring(g.point, g.normal, S.ink.color(w.team), 1.2, 0.4);
    S.fx.burst(g.point, g.normal, S.ink.color(w.team), 6, 2, { size: 0.05 });
    sfx(w, 'mine_place', { volume: 0.6 });
    return true;
  }

  dispose() { if (this.device && !this.device.dead) this.device.remove(); }
}

registerSub('ink-mine', InkMine);
