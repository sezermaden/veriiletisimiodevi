/* Story runner: executes a chapter script (async function) with helpers for dialogue,
   objectives, waiting on world events, unlocks and checkpoints.

   Checkpoints: a script is a list of sections. Resuming at checkpoint X runs every earlier
   section's `restore` (open its doors, grant its items) instead of its body, puts the player
   at X's spawn point, and continues from X. */
import * as THREE from 'three';
import { speak, stopSpeech } from '../core/voice.js';
import { Audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { CHAPTERS } from './meta.js';
import { SCRIPTS } from './chapters.js';

const STOP = Symbol('story-stopped');

export class StoryRunner {
  constructor(game, id, checkpoint) {
    this.game = game;
    this.id = id;
    this.checkpoint = checkpoint;
    this.stopped = false;
    this.waiters = [];        // { test(), resolve }
    this.listeners = [];      // { event, filter, resolve }
    this.timers = [];         // { t, resolve }
    this.weapons = new Set();
    this.tools = new Set();
    this.spawn = new Set();   // 'prop:*', 'prop:crate', 'npc:*', …
    this.noPhysgun = new Set();
    this.allowNoclip = false;
    this.t = 0;
    this.chapter = CHAPTERS.find((c) => c.id === id);
    this.h = game.env.handles || {};
    this.data = {};
  }

  get player() { return this.game.player; }
  get hud() { return this.game.hud; }

  /* ------------------------------------------------------------------ lifecycle */
  start() {
    const script = SCRIPTS[this.id];
    if (!script) return;
    this.promise = script(this).catch((e) => { if (e !== STOP) { console.error('story error', e); } });
  }

  stop() {
    this.stopped = true;
    stopSpeech();
    for (const w of this.waiters) w.reject?.(STOP);
    this.waiters = []; this.listeners = []; this.timers = [];
  }

  update(dt) {
    if (this.stopped) return;
    dt *= this.game.storySpeed || 1;       // test hook: fast-forward dialogue waits
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.resolve(); }
    }
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i];
      let ok = false;
      try { ok = w.test(dt); } catch (e) { console.error(e); }
      if (ok) { this.waiters.splice(i, 1); w.resolve(ok); }
      else if (w.timeout !== undefined) { w.timeout -= dt; if (w.timeout <= 0) { this.waiters.splice(i, 1); w.resolve(false); } }
    }
    this.onUpdate?.(dt);
  }

  emit(event, data) {
    if (this.stopped) return;
    for (let i = this.listeners.length - 1; i >= 0; i--) {
      const l = this.listeners[i];
      if (l.event !== event) continue;
      let ok = true;
      try { ok = !l.filter || l.filter(data); } catch { ok = false; }
      if (ok) { this.listeners.splice(i, 1); l.resolve(data); }
    }
    this.onEvent?.(event, data);
  }

  _guard() { if (this.stopped) throw STOP; }

  /* ------------------------------------------------------------------ waiting */
  wait(seconds) {
    this._guard();
    return new Promise((resolve, reject) => this.timers.push({ t: seconds, resolve: () => (this.stopped ? reject(STOP) : resolve()) })).then((v) => { this._guard(); return v; });
  }

  until(test, timeout) {
    this._guard();
    return new Promise((resolve, reject) => this.waiters.push({ test, resolve, reject, timeout })).then((v) => { this._guard(); return v; });
  }

  on(event, filter = null) {
    this._guard();
    return new Promise((resolve) => this.listeners.push({ event, filter, resolve })).then((v) => { this._guard(); return v; });
  }

  /** Resolves when the player enters the box. */
  reach(min, max) {
    const a = new THREE.Vector3(...min), b = new THREE.Vector3(...max);
    return this.until(() => { const p = this.player.pos; return p.x > a.x && p.x < b.x && p.y > a.y - 0.5 && p.y < b.y && p.z > a.z && p.z < b.z; });
  }

  /* ------------------------------------------------------------------ dialogue */
  /** WREN (or another speaker) says a line; resolves when the subtitle has had time. */
  async say(text, { speaker = 'WREN', cls = '', wait = true, voice = true } = {}) {
    this._guard();
    const dur = this.hud.say(speaker, text, null, cls);
    if (voice && speaker === 'WREN') speak(text);
    else if (voice && cls === 'null') { Audio.play('glitch'); speak(text, { speaker: 'NULL' }); }
    else Audio.play('terminal');
    if (wait) await this.wait(dur + 0.25);
  }

  sys(text, wait = true) { return this.say(text, { speaker: 'SYSTEM', cls: 'sys', wait, voice: false }); }

  objective(text) {
    this.hud.setObjective(text);
    if (text) Audio.play('objective');
  }

  hint(html, seconds = 8, id = null) { this.hud.hint(html, seconds, id); }
  key(action) { return this.hud.key(action); }

  card() { this.hud.chapterCard(this.chapter.num, this.chapter.title); }
  mood(m) { this.game.musicMood = m; music.setMood(m); }

  /* ------------------------------------------------------------------ unlocks */
  give(id, select = true) { this.weapons.add(id); if (!this.game.weapons.has(id)) this.game.weapons.give(id, { select }); }
  tool(...ids) { for (const id of ids) this.tools.add(id); }
  allow(...keys) { for (const k of keys) this.spawn.add(k); }

  canSpawn(kind, id) { return this.spawn.has(kind + ':*') || this.spawn.has(kind + ':' + id) || (kind === 'weapon' && this.weapons.has(id)); }
  canUseTool(id) { return this.tools.has(id); }
  canPhysgun(e) { return !this.noPhysgun.has(e) && !e.flags.noPhysgun; }

  /* ------------------------------------------------------------------ sections */
  /**
   * Run sections in order. Each: { name, run: async () => {}, restore?: () => {}, spawn?: [x,y,z,yaw] }.
   * Sections before the saved checkpoint are restored, not replayed.
   */
  async sections(list) {
    let startAt = 0;
    if (this.checkpoint) {
      const i = list.findIndex((s) => s.name === this.checkpoint);
      if (i >= 0) startAt = i;
    }
    for (let i = 0; i < startAt; i++) list[i].restore?.();
    if (startAt > 0 && list[startAt].spawn) {
      const [x, y, z, yaw = 0] = list[startAt].spawn;
      this.player.spawn(new THREE.Vector3(x, y, z), yaw);
    }
    for (let i = startAt; i < list.length; i++) {
      this._guard();
      if (i > 0) this.game.checkpoint(list[i].name);
      this.current = list[i].name;
      await list[i].run();
      list[i].restore?.();
    }
  }

  /** Finish the chapter: fade, save, then the next chapter or the ending. */
  async complete() {
    this._guard();
    this.objective(null);
    await this.hud.fade(1, false, 1500);
    this._guard();
    this.game.completeChapter(this.id);
    const i = CHAPTERS.findIndex((c) => c.id === this.id);
    if (i < CHAPTERS.length - 1) this.game.startChapter(CHAPTERS[i + 1].id);
    else this.game.showEnding();
  }

  /* ------------------------------------------------------------------ helpers */
  /** Total mass of player-movable entities inside a box (pressure plates). */
  massIn(min, max) {
    let m = 0;
    for (const e of this.game.entities.list) {
      const p = e.curr.p;
      if (p.x > min[0] && p.x < max[0] && p.y > min[1] && p.y < max[1] && p.z > min[2] && p.z < max[2] && e.body) m += e.body.isDynamic() ? e.mass : 0;
    }
    return m;
  }

  entityIn(min, max, pred) {
    return this.game.entities.list.find((e) => { const p = e.curr.p; return p.x > min[0] && p.x < max[0] && p.y > min[1] && p.y < max[1] && p.z > min[2] && p.z < max[2] && pred(e); }) || null;
  }

  prop(key, x, y, z, opts = {}) {
    const e = this.game.entities.spawnProp(key, new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, opts.yaw || 0, 0)), { effect: false, ...opts });
    if (opts.noPhysgun) e.flags.noPhysgun = true;
    if (opts.noRemove) e.flags.noRemove = true;
    if (opts.name) e.name = opts.name;
    if (opts.mass) e.setMass(opts.mass);
    return e;
  }

  npc(type, x, y, z, yaw = 0, opts = {}) { return this.game.npcs.spawn(type, new THREE.Vector3(x, y, z), yaw, opts); }
}

export { STOP };
