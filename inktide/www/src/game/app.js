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
      // browser Esc releases the lock without a keydown reaching us → pause like the game would
      if (!locked && this.session && !this.session.paused && !this.ui.blocking && this.session.allowPause !== false) this.openPause();
    });
    addEventListener('blur', () => { if (this.session && !this.ui.blocking && this.session.allowPause !== false) this.openPause(); });
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
