// Cutscene helper ("cs") handed to mode.cutscene(async (cs) => { … }).
//
//   await cs.camera([x,y,z], [tx,ty,tz], 2, 'inOut');   // glide the camera (Vector3 or arrays)
//   cs.cut(pos, target);                                 // instant camera
//   await cs.orbit(center, { radius, height, from, to, secs });
//   await cs.say([{ who: 'brine', text: '…' }]);          // conversation lines (or a DIALOGUE id)
//   await cs.wait(0.5); await cs.fade(true); cs.letterbox(false);
//   const b = cs.spawn('brine', [2, 0, 4], Math.PI);    // NPC model (entities/npc/models.js)
//   await cs.move(b, [2, 0, 1], 1.2); cs.face(b, cs.playerPos()); cs.emote(b, 'wave');
//   cs.shake(0.6); cs.flash('#fff'); cs.sfx('boom'); cs.music('boss');
//
// While a cutscene runs the player is frozen, the HUD hidden, pausing blocked (Esc skips) and the
// letterbox is down. 'skip' fast-forwards the rest of the scene: every await resolves at once.
// end() restores everything (optionally gliding the camera back to the gameplay view first).
import * as THREE from 'three';
import { EASE } from './director.js';
import { makeNpcModel } from '../entities/npc/models.js';

let CS_ID = 0;
const v3 = (a, out = new THREE.Vector3()) => (a?.isVector3 ? out.copy(a) : Array.isArray(a) ? out.fromArray(a) : out.set(0, 0, 0));

export class Cutscene {
  /**
   * @param {Director} director
   * @param {object} o letterbox (true), skippable (true), freezeWorld (false), blendBack (0.7 s)
   */
  constructor(director, o = {}) {
    this.d = director;
    this.session = director.session;
    this.o = o;
    this.key = `cs${++CS_ID}`;
    this.skipping = false;
    this.skippable = o.skippable !== false;
    this.models = [];
    this.ended = false;
    this._sk = () => this.skipping;
  }

  begin() {
    const kinds = ['freeze', 'hud', 'pause'];
    if (this.o.freezeWorld) kinds.push('time');
    if (this.o.letterbox !== false) kinds.push('letterbox');
    this.d.hold(this.key, kinds);
    this.prevCutscene = this.d.cutscene;
    this.d.cutscene = this;
    return this;
  }

  async end() {
    if (this.ended) return;
    this.ended = true;
    const blend = this.o.blendBack ?? 0.7;
    if (this.d.cam.active && blend > 0 && !this.skipping) await this.returnCamera(blend);
    if (this.d.cutscene === this) {
      // scenes can end out of order: never hand control back to one that has already ended
      let prev = this.prevCutscene;
      while (prev && prev.ended) prev = prev.prevCutscene;
      this.d.cutscene = prev || null;
    }
    if (!this.d.cutscene) this.d.releaseCam();
    for (const m of this.models) if (!m.keep) this.despawn(m);
    this.d.release(this.key);
  }

  skip() {
    if (!this.skippable || this.skipping) return;
    this.skipping = true;
    this.d.dialogue.skip();
    this.d.finishTweens();
  }

  // ---- camera --------------------------------------------------------------------------------
  /** Glide from the current view to (pos, target). */
  camera(pos, target, secs = 1.5, ease = 'inOut') {
    const d = this.d;
    const p0 = new THREE.Vector3(), t0 = new THREE.Vector3();
    d.camPose(p0, t0);
    const p1 = v3(pos), t1 = v3(target);
    const P = new THREE.Vector3(), T = new THREE.Vector3();
    return d.tween(secs, (k) => {
      P.lerpVectors(p0, p1, k); T.lerpVectors(t0, t1, k);
      d.setCam(P, T);
    }, { ease: EASE[ease] || ease, skip: this._sk });
  }

  cut(pos, target) { this.d.setCam(v3(pos), v3(target)); }

  /**
   * Circle around `center` from angle `from` to `to` (radians, 0 = +Z side).
   * o: radius (number | k → number), height, lookHeight, secs, ease, lookSide (metres the subject is
   * pushed toward the right of frame by the end), collide (default true: pull in before level walls).
   */
  orbit(center, o = {}) {
    const d = this.d, level = this.session.level;
    const c = v3(center);
    const { radius = 4, height = 1.6, from = 0, to = Math.PI / 2, secs = 3, lookHeight = 1, ease = 'sine', lookSide = 0 } = o;
    const P = new THREE.Vector3(), T = new THREE.Vector3(), eye = new THREE.Vector3(), dir = new THREE.Vector3();
    const rOf = typeof radius === 'function' ? radius : () => radius;
    return d.tween(secs, (k) => {
      const a = from + (to - from) * k;
      let r = rOf(k);
      eye.set(c.x, c.y + lookHeight, c.z);
      dir.set(Math.sin(a) * r, height - lookHeight, Math.cos(a) * r);
      const len = dir.length();
      dir.divideScalar(len);
      if (o.collide !== false && level?.raycast) {
        const hit = level.raycast(eye, dir, len + 0.3, { staticOnly: true });
        if (hit) r *= Math.max(0.25, (hit.distance - 0.3) / len);
      }
      P.set(c.x + Math.sin(a) * r, c.y + lookHeight + (height - lookHeight) * (r / Math.max(1e-3, rOf(k))), c.z + Math.cos(a) * r);
      T.set(c.x + (o.offset?.x || 0), c.y + lookHeight, c.z + (o.offset?.z || 0));
      if (lookSide) {
        // shift the aim point to the camera's left → the subject sits right of centre
        const fx = T.x - P.x, fz = T.z - P.z, fl = Math.hypot(fx, fz) || 1;
        T.x -= (-fz / fl) * lookSide * k;
        T.z -= (fx / fl) * lookSide * k;
      }
      d.setCam(P, T);
    }, { ease: EASE[ease] || ease, skip: this._sk });
  }

  /** Glide back to where the gameplay camera will be, so releasing the override is seamless. */
  returnCamera(secs = 0.7) {
    const p = new THREE.Vector3(), t = new THREE.Vector3();
    this.d.gameplayPose(p, t);
    return this.camera(p, t, secs, 'inOut');
  }

  // ---- presentation --------------------------------------------------------------------------
  letterbox(on) { if (on) this.d.hold(this.key, ['letterbox']); else this.d.releaseNow(this.key, ['letterbox']); }

  say(lines, opts = {}) {
    if (this.skipping) return Promise.resolve({ skipped: true });
    return this.d.say(lines, { ...opts, radio: opts.radio ?? false });
  }

  wait(secs) { return this.d.wait(secs, { skip: this._sk }); }

  fade(on, ms = 400) {
    const app = this.session.app;
    if (!app?.fade) return Promise.resolve();
    if (this.skipping) { app.fadeEl?.classList.toggle('on', on); return Promise.resolve(); }
    return app.fade(on, ms);
  }

  shake(amount = 0.5, secs = 0.5) { this.d.shake(amount, secs); this.session.input?.rumble?.(0.4 * amount, 0.6 * amount, secs * 1000); }
  flash(color = '#ffffff', amount = 0.8) { this.session.flash?.(color, amount); }
  sfx(name, o = {}) { this.session.audio?.sfx?.(name, o); }
  music(id, o) { this.session.audio?.playMusic?.(id, o); }

  // ---- actors --------------------------------------------------------------------------------
  playerPos(h = 0) { return this.session.player.position.clone().setY(this.session.player.position.y + h); }

  /** Spawn an NPC model for the scene (removed at end() unless { keep: true }). */
  spawn(who, pos, yaw = 0, o = {}) {
    const m = makeNpcModel(who, { session: this.session, ...o });
    m.root.position.copy(v3(pos));
    m.root.rotation.y = yaw;
    m.keep = !!o.keep;
    this.session.scene.add(m.root);
    this.d.track(m);
    this.models.push(m);
    return m;
  }

  despawn(m) {
    this.d.untrack(m);
    m.root.parent?.remove(m.root);
    m.dispose?.();
  }

  /** Walk / float a model to a point. */
  move(model, to, secs = 1, ease = 'inOut') {
    const a = model.root.position.clone(), b = v3(to);
    const dir = b.clone().sub(a);
    if (dir.lengthSq() > 1e-4) model.root.rotation.y = Math.atan2(dir.x, dir.z);
    model.walking = true;
    return this.d.tween(secs, (k) => { model.root.position.lerpVectors(a, b, k); if (k >= 1) model.walking = false; }, { ease: EASE[ease] || ease, skip: this._sk });
  }

  face(model, target) {
    const t = v3(target);
    const p = model.root.position;
    model.root.rotation.y = Math.atan2(t.x - p.x, t.z - p.z);
  }

  emote(model, name, secs = 2.5) {
    if (model === 'kai' || model === this.session.player) this.session.player.model.emote(name, secs);
    else model?.emote?.(name, secs);
  }
}
