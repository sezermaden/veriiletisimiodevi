// Director: the per-session story runtime shared by StoryMode, cutscenes and NPCs.
//
//  - owns the in-game Dialogue (story/dialogue.js) and ticks it
//  - frame-clock tweens / waits (pause-aware: they only advance while the session updates)
//  - reference-counted "holds": freeze the player, hide the HUD, block pausing, stop world time,
//    letterbox — released one frame late so the press that closed a dialogue never reaches the
//    player (no accidental jump/shot)
//  - cinematic camera via session.camRig.override (+ its own shake, since the rig ignores trauma
//    while overridden)
//  - ticks NPC models spawned by cutscenes (talk animation follows the current speaker)
//
// StoryMode drives it from latchInput()/update(). Sessions without a StoryMode get a self-driving
// director from directorFor(session) (a transparent, non-blocking screen feeds it input).
import * as THREE from 'three';
import { Dialogue, storyRoot } from './dialogue.js';
import { Screen } from '../ui/screens.js';
import { TEAM_HERO } from '../ink/ink-system.js';
import { SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c = 1.6; t -= 1; return 1 + t * t * ((c + 1) * t + c); },
  sine: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
};

const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const KINDS = ['freeze', 'hud', 'pause', 'time', 'letterbox'];

export function heroInkHex(session) {
  try { return '#' + session.ink.color(session.player?.team ?? TEAM_HERO).getHexString(); } catch { return '#ff8a1f'; }
}

/** Names of the equipped kit for {kitName} / {subName} / {specialName} in dialogue text. */
export function kitVars(session) {
  const def = session.player?.kit?.def;
  if (!def) return null;
  return { kitName: def.name, subName: SUB_INFO[def.sub]?.name, specialName: SPECIAL_INFO[def.special]?.name };
}

export class Director {
  constructor(session) {
    this.session = session;
    this.app = session.app;
    this.root = storyRoot();
    this.frame = 0;
    this.time = 0;
    this.disposed = false;
    this.dialogue = new Dialogue({
      parent: this.root, audio: session.audio, input: session.input, ink: () => heroInkHex(session), vars: () => kitVars(session),
      onLine: (line) => { this.speaking = line.who; },
      onEnd: () => { this.speaking = null; },
    });
    this.speaking = null;
    this.tweens = [];
    this.holds = {};
    for (const k of KINDS) this.holds[k] = new Set();
    this._pending = [];           // deferred releases [{kind, key, frame}]
    this._saved = {};
    this.cutscene = null;
    this.models = new Set();
    this.cam = { active: false, pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this.shakeAmp = 0;
    this.shakeT = 0;
  }

  // ---- holds ---------------------------------------------------------------------------------
  /** Acquire holds under `key`. kinds ⊆ freeze | hud | pause | time | letterbox. */
  hold(key, kinds = ['freeze', 'hud', 'pause']) {
    for (const k of kinds) {
      this._pending = this._pending.filter((p) => !(p.kind === k && p.key === key));
      this.holds[k].add(key);
    }
    this._apply();
  }

  /** Release holds under `key` (applied on the next frame). */
  release(key, kinds = KINDS) {
    for (const k of kinds) if (this.holds[k].has(key)) this._pending.push({ kind: k, key, frame: this.frame });
  }

  /** Release immediately (stage teardown). */
  releaseNow(key, kinds = KINDS) {
    for (const k of kinds) this.holds[k].delete(key);
    this._pending = this._pending.filter((p) => p.key !== key);
    this._apply();
  }

  held(kind) { return this.holds[kind].size > 0; }

  _apply() {
    const S = this.session, p = S.player;
    const freeze = this.held('freeze');
    if (p && p.frozen !== freeze) {
      p.frozen = freeze;
      if (freeze) { p.kit?.main?.cancel?.(); p.firePressed = false; p.jumpBuffer = 0; p.subBuffer = 0; p.specialBuffer = 0; }
    }
    const hud = this.held('hud');
    if (S.hud && this._hudHidden !== hud) { this._hudHidden = hud; S.hud.show(!hud); }
    const pause = this.held('pause');
    if (this._pauseBlocked !== pause) {
      if (pause) { this._saved.allowPause = S.allowPause; S.allowPause = false; } else S.allowPause = this._saved.allowPause;
      this._pauseBlocked = pause;
    }
    const time = this.held('time');
    if (this._timeStopped !== time) {
      if (time) { this._saved.timeScale = S.timeScale; S.timeScale = 0; } else S.timeScale = this._saved.timeScale ?? 1;
      this._timeStopped = time;
    }
    const lb = this.held('letterbox');
    if (this._lb !== lb) {
      this._lb = lb;
      document.body.classList.toggle('letterbox', lb);
      this.root.classList.toggle('lb-on', lb);
    }
  }

  // ---- dialogue ------------------------------------------------------------------------------
  /**
   * Play a conversation (or radio chatter with { radio: true }). Conversations freeze the player,
   * hide the HUD, block pausing (Esc skips instead) and stop world time unless { freezeWorld: false }.
   */
  say(linesOrId, opts = {}) {
    if (this.disposed) return Promise.resolve({ skipped: true });
    if (this.cutscene?.skipping) return Promise.resolve({ skipped: true });
    const p = this.dialogue.play(linesOrId, opts);
    if (this.dialogue.cur && !this.dialogue.cur.radio && !this._talkHold) this._syncTalkHold(opts);
    return p.then((r) => { this._syncTalkHold(opts); return r; });
  }

  _syncTalkHold(opts = {}) {
    const blocking = this.dialogue.blocking;
    if (blocking && !this._talkHold) {
      this._talkHold = true;
      const kinds = ['freeze', 'hud', 'pause'];
      if (opts.freezeWorld !== false && !this.cutscene) kinds.push('time');
      this.hold('dialogue', kinds);
    } else if (!blocking && this._talkHold) {
      this._talkHold = false;
      this.release('dialogue');
    }
  }

  get talking() { return this.dialogue.blocking; }
  get busy() { return this.dialogue.blocking || !!this.cutscene; }

  // ---- tweens --------------------------------------------------------------------------------
  /** Run fn(k) every frame for `secs` (k eased 0→1). skip() → finishes instantly. */
  tween(secs, fn, o = {}) {
    return new Promise((resolve) => {
      const tw = { t: 0, secs: Math.max(0, secs), fn, ease: EASE[o.ease] || o.ease || EASE.inOut, resolve, skip: o.skip };
      if (tw.secs === 0 || tw.skip?.() || this.disposed) { fn?.(1); resolve(); return; }
      fn?.(0);
      this.tweens.push(tw);
    });
  }

  wait(secs, o = {}) { return this.tween(secs, null, { ease: EASE.linear, ...o }); }

  /** Finish every running tween (cutscene skip). */
  finishTweens() {
    const list = this.tweens;
    this.tweens = [];
    for (const tw of list) { tw.fn?.(1); tw.resolve(); }
  }

  // ---- camera --------------------------------------------------------------------------------
  /** Current view pose (override or rig). */
  camPose(outPos = new THREE.Vector3(), outTarget = new THREE.Vector3()) {
    const cam = this.session.camera;
    if (this.cam.active) { outPos.copy(this.cam.pos); outTarget.copy(this.cam.target); return { pos: outPos, target: outTarget }; }
    outPos.copy(cam.position);
    cam.getWorldDirection(_fwd);
    outTarget.copy(cam.position).addScaledVector(_fwd, 8);
    return { pos: outPos, target: outTarget };
  }

  /** Where the gameplay rig would put the camera right now. */
  gameplayPose(outPos = new THREE.Vector3(), outTarget = new THREE.Vector3()) {
    const S = this.session, rig = S.camRig, cam = S.camera;
    const savedPos = cam.position.clone();
    const savedQ = cam.quaternion.clone();
    const ov = rig.override;
    rig.override = null;
    try { rig._place?.(S.player, 1); } catch { /* rig internals changed: fall back to current */ }
    outPos.copy(cam.position);
    cam.getWorldDirection(_fwd);
    outTarget.copy(cam.position).addScaledVector(_fwd, 8);
    rig.override = ov;
    cam.position.copy(savedPos);
    cam.quaternion.copy(savedQ);
    return { pos: outPos, target: outTarget };
  }

  setCam(pos, target) {
    this.cam.pos.copy(pos);
    this.cam.target.copy(target);
    this.cam.active = true;
    const rig = this.session.camRig;
    if (!rig.override) rig.override = { position: new THREE.Vector3(), target: new THREE.Vector3() };
    this._applyCam();
  }

  releaseCam() {
    this.cam.active = false;
    this.session.camRig.override = null;
  }

  shake(amount = 0.5, secs = 0.5) { this.shakeAmp = Math.max(this.shakeAmp, amount); this.shakeT = Math.max(this.shakeT, secs); }

  _applyCam() {
    const ov = this.session.camRig.override;
    if (!ov || !this.cam.active) return;
    ov.position.copy(this.cam.pos);
    ov.target.copy(this.cam.target);
    if (this.shakeT > 0) {
      const k = this.shakeAmp * Math.min(1, this.shakeT * 3);
      const t = this.time;
      ov.position.x += (Math.sin(t * 47.3) + Math.sin(t * 91.1)) * 0.12 * k;
      ov.position.y += (Math.sin(t * 53.7) + Math.sin(t * 77.9)) * 0.12 * k;
      ov.target.x += Math.sin(t * 61.3) * 0.1 * k;
    }
  }

  // ---- models --------------------------------------------------------------------------------
  track(model) { this.models.add(model); return model; }
  untrack(model) { this.models.delete(model); }

  // ---- per frame -----------------------------------------------------------------------------
  /** Edge input, once per frame (never inside a fixed step). */
  latch(input) {
    if (this.disposed) return;
    const cs = this.cutscene;
    if (cs && cs.skippable && !cs.skipping && input.justPressed('skip') && !(this.dialogue.cur?.opts?.noSkip)) {
      cs.skip();
      return;
    }
    this.dialogue.latch(input);
  }

  update(dt) {
    if (this.disposed) return;
    this.frame++;
    this.time += dt;
    // deferred releases from earlier frames
    if (this._pending.length) {
      const keep = [];
      let changed = false;
      for (const p of this._pending) {
        if (p.frame < this.frame) { this.holds[p.kind].delete(p.key); changed = true; } else keep.push(p);
      }
      this._pending = keep;
      if (changed) this._apply();
    }
    this.dialogue.update(dt);
    // tweens
    if (this.tweens.length) {
      const list = this.tweens;
      this.tweens = [];
      for (const tw of list) {
        tw.t += dt;
        const done = tw.t >= tw.secs || tw.skip?.();
        const k = done ? 1 : tw.ease(Math.min(1, tw.t / tw.secs));
        tw.fn?.(k, dt);
        if (done) tw.resolve(); else this.tweens.push(tw);
      }
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.shakeT === 0) this.shakeAmp = 0;
    this._applyCam();
    // NPC models spawned by cutscenes
    const talking = this.dialogue.typing ? this.dialogue.currentWho : null;
    for (const m of this.models) m.update?.(dt, { talking: talking && talking === m.who });
  }

  dispose() {
    if (this.disposed) return;
    this.dialogue.clear();
    this.finishTweens();
    for (const k of KINDS) this.holds[k].clear();
    this._pending = [];
    this._apply();
    this.releaseCam();
    this.disposed = true;
    this.dialogue.dispose();
    document.body.classList.remove('letterbox');
    this.root.classList.remove('lb-on');
    for (const m of this.models) { m.root?.parent?.remove(m.root); m.dispose?.(); }
    this.models.clear();
  }
}

// ---------------------------------------------------------------------------------------------
// Self-driving director for sessions without a StoryMode.
class DirectorDriver extends Screen {
  constructor(app, director, session) {
    super(app, { blocksGame: false, transparent: true, className: 'story-driver' });
    this.director = director;
    this.session = session;
    this.el.style.pointerEvents = 'none';
  }

  _alive() {
    if (this.app.session === this.session && !this.director.disposed) return true;
    if (!this._gone) {
      this._gone = true;
      this.director.dispose();
      queueMicrotask(() => {
        const st = this.app.ui.stack, i = st.indexOf(this);
        if (i === st.length - 1) this.app.ui.pop();
        else if (i >= 0) { st.splice(i, 1); this.el.remove(); }
      });
    }
    return false;
  }

  update(dt) {
    if (!this._alive() || this.session.paused) return;
    this.director.update(dt);
  }

  handleInput(input) {
    if (!this._alive()) return false;
    if (!this.director.busy) return false;           // let other UI behave normally
    this.director.latch(input);
    return true;
  }

  onBack() { /* never pops itself on B/Esc */ }

  /** Popped (quit to menu, ui.clear on a new session): tear the director down with it, so its
   *  dialogue box, holds and cutscene models don't outlive the session. directorFor() makes a
   *  fresh one if the same session needs it again. */
  onExit() {
    if (!this.director.disposed) this.director.dispose();
    if (this.session.__storyDirector === this.director) this.session.__storyDirector = null;
  }
}

/** The session's director: the StoryMode's, or a self-driving one created on demand. */
export function directorFor(session) {
  if (session.mode?.director && !session.mode.director.disposed) return session.mode.director;
  let d = session.__storyDirector;
  if (!d || d.disposed) d = session.__storyDirector = new Director(session);
  const ui = session.app?.ui;
  // (re)attach the driver screen — menus may have cleared the stack since
  if (ui && !(d._driver && ui.stack.includes(d._driver))) {
    d._driver = new DirectorDriver(session.app, d, session);
    ui.push(d._driver);
  }
  return d;
}
