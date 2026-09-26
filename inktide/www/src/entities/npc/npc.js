// Talkable NPC entity.
//   { type: 'npc', pos, yaw?, who: 'brine'|'pix'|'shelly'|'otto'|'tilly'|'murkwell'|'dredge'|'kid'|'kai',
//     dialogue?: 'id' | [{who,text,mood}] | ['id1','id2',…] (cycles each talk; default 'npc.<who>'),
//     idle?: 'wave'|'cheer'|'laugh', radius? (2.5), mood?, solid? (true), prompt? ('Talk') }
// Within `radius` a floating "{interact} Talk" prompt appears; Interact plays the conversation via
// the session's story director (StoryMode's, or a self-driving one). Edge input is read in
// render() (per frame), never in step().
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import { makeNpcModel } from './models.js';
import { promptHTML } from '../../engine/game-input.js';
import { directorFor } from '../../story/director.js';
import { Cutscene } from '../../story/cutscene.js';
import { storyRoot } from '../../story/dialogue.js';

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();

class Npc extends Entity {
  constructor(session, def) {
    super(session, def);
    this.who = def.who || 'kid';
    this.model = makeNpcModel(this.who, { session, look: def.look, ink: def.ink, seed: def.seed });
    this.group.add(this.model.root);
    if (def.mood) this.model.setMood?.(def.mood);
    if (def.scale) this.model.root.scale.setScalar(def.scale);
    this.baseYaw = def.yaw || 0;
    this.radius = def.radius ?? 2.5;
    this.bodyR = def.bodyRadius ?? (this.who === 'murkwell' || this.who === 'dredge' ? 0.7 : 0.45);
    this.solid = def.solid !== false;
    this.near = false;
    this.talkingNow = false;
    this.talks = 0;
    this.idleT = 3 + Math.random() * 4;
    this.facing = 0;          // local yaw offset toward the player
    this.promptEl = null;
    this._dev = null;
  }

  _lines() {
    const d = this.def.dialogue;
    if (Array.isArray(d) && d.length && typeof d[0] === 'string') return d[this.talks % d.length];
    return d || `npc.${this.who}`;
  }

  step(dt) {
    void dt;
    const pl = this.session.player;
    if (!pl?.alive) { this.near = false; return; }
    const dx = pl.position.x - this.position.x, dz = pl.position.z - this.position.z;
    const dy = pl.position.y - this.position.y;
    const d2 = dx * dx + dz * dz;
    this.near = d2 < this.radius * this.radius && Math.abs(dy) < 2.2;
    // soft body collision so the player can't walk through the character
    if (this.solid && Math.abs(dy) < (this.model.height || 1.5) && d2 < this.bodyR * this.bodyR && d2 > 1e-6) {
      const d = Math.sqrt(d2), push = this.bodyR - d;
      pl.position.x += (dx / d) * push;
      pl.position.z += (dz / d) * push;
    }
  }

  async talk() {
    const S = this.session;
    const dir = directorFor(S);
    this.talkingNow = true;
    this.model.emote?.('wave', 1.2);
    S.audio?.sfx?.('ui_select', { volume: 0.35 });
    // over-the-shoulder conversation camera (skippable like any cutscene)
    const cs = this.def.camera === false ? null : new Cutscene(dir, { letterbox: false, freezeWorld: this.def.freezeWorld ?? true, blendBack: 0.45 }).begin();
    try {
      if (cs) {
        const pp = S.player.position, np = this.position;
        const away = _v.set(pp.x - np.x, 0, pp.z - np.z);
        if (away.lengthSq() < 1e-4) away.set(0, 0, 1);
        away.normalize();
        const side = new THREE.Vector3(away.z, 0, -away.x);
        const h = this.model.height || 1.5;
        const cam = pp.clone().addScaledVector(away, 1.5).addScaledVector(side, 1.45).setY(pp.y + Math.max(1.65, h * 1.05));
        const tgt = np.clone().lerp(pp, 0.28).setY(np.y + Math.max(0.8, h * 0.62));
        await cs.camera(cam, tgt, 0.55, 'out');
        await cs.say(this._lines());
      } else {
        await dir.say(this._lines(), { freezeWorld: this.def.freezeWorld ?? true });
      }
    } finally {
      if (cs) await cs.end();
      this.talkingNow = false;
      this.talks++;
      this.idleT = 4;
    }
  }

  render(dt) {
    const S = this.session, pl = S.player;
    const dir = S.mode?.director || S.__storyDirector || null;
    const busy = dir?.busy || false;
    // talk on Interact (edge read per frame)
    if (this.near && !this.talkingNow && !busy && pl.alive && !pl.frozen && S.input.justPressed('interact') && !(dir?.dialogue?.recentlyEnded?.())) {
      this.talk().catch((e) => { console.error('npc talk', e); this.talkingNow = false; });
    }
    // turn toward the player while near / talking
    let want = 0;
    if ((this.near || this.talkingNow) && pl) {
      const worldYaw = Math.atan2(pl.position.x - this.position.x, pl.position.z - this.position.z);
      want = Math.atan2(Math.sin(worldYaw - this.baseYaw), Math.cos(worldYaw - this.baseYaw));
    }
    this.facing += (want - this.facing) * Math.min(1, dt * 5);
    this.group.rotation.y = this.baseYaw + this.facing;
    this.model.lookAt?.(this.near || this.talkingNow ? _v.copy(pl.position).setY(pl.position.y + 1.2) : null);
    // idle emote now and then
    this.idleT -= dt;
    if (this.idleT <= 0) {
      this.idleT = 6 + Math.random() * 6;
      if (this.def.idle && !this.talkingNow) this.model.emote?.(this.def.idle, 1.8);
    }
    const speaking = dir?.dialogue?.typing && dir.dialogue.currentWho === this.who && (this.talkingNow || dir.busy);
    this.model.update(dt, { talking: !!speaking });
    this._updatePrompt(this.near && !this.talkingNow && !busy && pl.alive);
  }

  _updatePrompt(show) {
    if (!show) { if (this.promptEl) this.promptEl.classList.remove('show'); return; }
    const S = this.session;
    if (!this.promptEl) {
      this.promptEl = document.createElement('div');
      this.promptEl.className = 'npc-prompt';
      storyRoot().appendChild(this.promptEl);
    }
    const dev = S.input.lastDevice === 'gamepad' ? 'pad' : 'kb';
    if (dev !== this._dev) {
      this._dev = dev;
      this.promptEl.innerHTML = `${promptHTML(S.input, 'interact')}<span>${this.def.prompt || 'Talk'}</span>`;
    }
    _p.copy(this.position).setY(this.position.y + (this.model.height || 1.5) + 0.35).project(S.camera);
    const visible = _p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
    this.promptEl.classList.toggle('show', visible);
    if (visible) {
      const x = (_p.x + 1) * 0.5 * innerWidth, y = (1 - _p.y) * 0.5 * innerHeight;
      this.promptEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  dispose() {
    this.promptEl?.remove();
    this.model.dispose?.();
    super.dispose();
  }
}

registerEntity('npc', (s, d) => new Npc(s, d));

export { Npc };
