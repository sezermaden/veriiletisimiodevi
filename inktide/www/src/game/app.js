// App: owns the renderer, input, audio, screen stack and the active Session. One RAF loop.
import * as THREE from 'three';
import { Renderer } from '../engine/renderer.js';
import { GameInput } from '../engine/game-input.js';
import { audio } from '../engine/audio.js';
import { settings } from '../engine/settings.js';
import { save } from '../engine/save.js';
import { ScreenManager } from '../ui/screens.js';
import { Session } from './session.js';
import { loadStage } from '../levels/index.js';

export class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new GameInput(this.canvas);
    this.audio = audio;
    this.settings = settings;
    this.save = save;
    this.ui = new ScreenManager(this);
    this.session = null;
    this.menuScene = null;
    this.frames = 0;
    this.last = performance.now();
    this.errors = [];
    this.fadeEl = document.getElementById('fade');
    this._busy = false;
    this._pauseWanted = false;   // pause as soon as the stage allows it (window blur / pad lost meanwhile)
    this._relock = false;        // pointer lock lost in a hold or refused: pause so Resume can relock

    // audio + pointer lock need a user gesture
    const gesture = () => this.audio.init();
    addEventListener('pointerdown', gesture);
    addEventListener('keydown', gesture);
    this.canvas.addEventListener('click', () => {
      if (this.session && !this.session.paused && !this.ui.blocking) this.input.enablePointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      document.body.classList.toggle('locked', locked);
      const S = this.session;
      if (locked) this._relock = false;
      else if (S?.started && !S.paused && !this.ui.blocking && !this._busy) {
        // browser Esc releases the lock without a keydown reaching us → pause like the game would;
        // during a no-pause hold (dialogue / cutscene) pause once it ends, so Resume can relock
        if (!this._pauseNow()) this._relock = true;
      }
    });
    // focus or the only controller lost while no pause can open (stage start, a no-pause hold):
    // remember it, _frame pauses as soon as it can
    addEventListener('blur', () => { if (!this._pauseNow()) this._pauseWanted = true; });
    addEventListener('focus', () => { this._pauseWanted = false; });
    addEventListener('gamepaddisconnected', () => {
      if (!this.session || this.input.lastDevice !== 'gamepad' || [...this.input._gamepads()].some((g) => g?.connected)) return;
      if (!this._pauseNow()) this._pauseWanted = true;
    });
    addEventListener('gamepadconnected', () => this.input.recalibrate());
    this._frame = this._frame.bind(this);
    window.__game = this;
    // test/dev helpers: hold a key or mouse button for n frames
    this.dev = {
      hold: (code, frames = 30) => { this.input._injectKey(code, true); const until = this.frames + frames; const f = () => { if (this.frames >= until) this.input._injectKey(code, false); else requestAnimationFrame(f); }; requestAnimationFrame(f); },
      look: (dx, dy) => this.input._injectMouse(dx, dy),
    };
  }

  start() { requestAnimationFrame(this._frame); }

  /** Test hook: advance exactly one frame of `dt` seconds (use with app.halted = true). */
  tick(dt) {
    this.input.update(dt);
    if (this.session && this.session.started) { this.ui.update(dt, this.input); this.session.update(dt); }
    this.input.endFrame();
    this.frames++;
  }

  _frame(t) {
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    if (this.halted) { requestAnimationFrame(this._frame); return; }   // tests drive frames manually
    try {
      this.input.update(dt);
      if (this.session && this.session.started) {
        if (!this.ui.blocking && this.input.justPressed('pause') && this.session.allowPause !== false) this.openPause();
        // a pause that had to wait (see the constructor), or play running without the pointer lock
        // that mouse look needs (lost in a hold, or refused on Resume: see ui/flow.js safePointerLock)
        else if (this._pauseWanted || (this._relock && !this.input.pointerLocked && this.input.lastDevice !== 'gamepad')) {
          if (this._pauseNow()) this._pauseWanted = this._relock = false;
          // a screen already holds the game (pause, postcard, results): the player closes it
          // themselves, so a pad lost meanwhile must not re-pause the stage right after
          else if (this.ui.blocking && !this._busy) this._pauseWanted = false;
        }
        this.session.paused = this.ui.blocking;
        this.ui.update(dt, this.input);
        this.session.update(dt);
      } else {
        this.ui.update(dt, this.input);
        if (this.menuScene) this.menuScene.update(dt);
        this.renderer.render();
      }
      this.input.endFrame();
    } catch (e) {
      console.error(e);
      this.errors.push(String(e?.stack || e));
    }
    this.frames++;
    requestAnimationFrame(this._frame);
  }

  fade(on, ms = 380) {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Hook set by the UI layer: pushes the pause screen. */
  openPause() {
    if (!this.session || this.ui.blocking) return;
    this.input.exitPointerLock();
    this.onPause?.();
  }

  /** Pause now if the running stage allows it (not starting, no no-pause hold, no screen on top). */
  _pauseNow() {
    const S = this.session;
    if (!S?.started || this._busy || this.ui.blocking || S.allowPause === false) return false;
    this.openPause();
    return true;
  }

  /**
   * Start a session.
   * @param {object} o  stageId | levelDef, mode, kit, colors, team, upgrades
   */
  async startSession(o) {
    if (this._busy) return null;
    this._busy = true;
    try {
      await this.fade(true, 300);
      this.endSession(true);
      this.menuScene?.hide?.();
      const levelDef = o.levelDef || (await loadStage(o.stageId));
      const s = new Session(this, { ...o, levelDef });
      this.session = s;
      await s.start();
      this.ui.clear();
      await this.fade(false, 400);
      if (o.lockPointer !== false) this.input.enablePointerLock();
      return s;
    } catch (e) {
      console.error(e);
      this.errors.push(String(e?.stack || e));
      await this.fade(false, 200);
      return null;
    } finally {
      this._busy = false;
    }
  }

  endSession(silent = false) {
    this._relock = false;   // a lost / refused lock belongs to the session that ends
    if (!this.session) return;
    const s = this.session;
    this.session = null;
    s.dispose();
    this.input.exitPointerLock();
    if (!silent) this.menuScene?.show?.();
    if (this.menuScene) this.renderer.setScene(this.menuScene.scene, this.menuScene.camera);
    else this.renderer.setScene(new THREE.Scene(), new THREE.PerspectiveCamera());
  }
}
