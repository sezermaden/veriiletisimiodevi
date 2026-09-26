// Invisible trigger volume. When the player enters: dialogue, objective, hint, event, checkpoint,
// and optional ambush spawns. Fires once unless once:false (then again after leaving).
//   { type: 'trigger', pos, yaw?, size:[w,h,d], once?: true, dialogue?: 'id' | [{who,text}],
//     objective?: 'text', hint?: 'text', event?: 'name' | ['a','b'], checkpoint?: true, spawn?: [defs], delay? }
// pos = centre of the volume's floor.
import * as THREE from 'three';
import { Entity, registerEntity, spawnEntity } from '../base.js';

const _p = new THREE.Vector3();
const SPEAKERS = {
  brine: 'Commodore Brine', pix: 'Pix', kai: 'Kai', murkwell: 'Baron Murkwell', dredge: 'Foreman Dredge',
  shelly: 'Shelly', otto: 'Otto', tilly: 'Tilly',
};

class Trigger extends Entity {
  constructor(session, def) {
    super(session, def);
    const [w, h, d] = def.size || [4, 3, 4];
    this.half = new THREE.Vector3(w / 2, h, d / 2);
    this.once = def.once !== false;
    this.inside = false;
    this.fired = false;
    this.delayT = -1;
    this.cooldown = 0;
    this.group.visible = false;
    if (def.debug) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), new THREE.MeshBasicMaterial({ color: '#00ffaa', wireframe: true }));
      m.userData.ownGeometry = true;
      this.own(m.material);
      this.group.add(m);
      this.group.visible = true;
    }
  }

  contains(p) {
    _p.copy(p).sub(this.position);
    if (this.group.rotation.y) _p.applyAxisAngle(THREE.Object3D.DEFAULT_UP, -this.group.rotation.y);
    return Math.abs(_p.x) <= this.half.x && Math.abs(_p.z) <= this.half.z && _p.y >= -0.3 && _p.y <= this.half.y;
  }

  step(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.delayT >= 0) {
      this.delayT -= dt;
      if (this.delayT < 0) this.fire();
      return;
    }
    if (this.fired && this.once) return;
    const pl = this.session.player;
    const inNow = pl.alive && this.contains(pl.position);
    if (inNow && !this.inside && this.cooldown <= 0) {
      if (this.def.delay) this.delayT = this.def.delay; else this.fire();
    }
    this.inside = inNow;
  }

  fire() {
    const S = this.session, d = this.def;
    this.fired = true;
    this.cooldown = d.cooldown ?? 1;
    if (d.dialogue) {
      if (S.mode?.dialogue) S.mode.dialogue(d.dialogue);
      else if (Array.isArray(d.dialogue) && d.dialogue.length) {
        const l = d.dialogue[0];
        const who = SPEAKERS[l.who] || l.who || '';
        S.hud?.toast?.(who ? `${who}: ${l.text}` : l.text);
      }
    }
    if (d.objective) {
      if (S.mode?.objective) S.mode.objective(d.objective);
      else S.hud?.setObjective?.(d.objective);
    }
    if (d.hint) S.hud?.hint?.(d.hint, d.hintTime ?? 5);
    if (d.checkpoint) {
      const pos = this.position.clone();
      const yaw = d.yaw ?? this.group.rotation.y ?? 0;
      S.setCheckpoint(pos, yaw);
      S.mode?.checkpoint?.(pos, yaw);
    }
    for (const e of d.spawn || []) spawnEntity(S, e);
    const evs = Array.isArray(d.event) ? d.event : d.event ? [d.event] : [];
    for (const name of evs) S.events.emit(name, { id: this.id, trigger: this });
    S.events.emit('trigger', { id: this.id });
    if (this.once) this.remove();
  }
}

registerEntity('trigger', (s, d) => new Trigger(s, d));
