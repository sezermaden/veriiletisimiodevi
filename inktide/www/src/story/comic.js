// Motion-comic player (prologue, ending, post-credits tease) and the ending credits roll.
//
//   await playComic(app, panels, { overFade, ink })   → { skipped }
//   await playPrologue(app) / playEnding(app) / playPostCredits(app) / playCredits(app)
//
// Panels come from story/script.js ([{ art, lines, hold? }]); art is drawn by story/comic-art.js
// with parallax layers under a Ken Burns zoom, and panels change with an ink-splat wipe. Captions
// use the dialogue box ('advance' continues). Holding 'skip' (Esc / Menu / B) or the on-screen
// button skips the whole comic. Works with or without a running session (it is a blocking Screen).
//
// overFade: the caller has the app fade (black) on — the comic lifts it to play and puts it back
// before resolving (used while a stage loads and between ending → credits).
import { Screen } from '../ui/screens.js';
import { Dialogue } from './dialogue.js';
import { panelArt } from './comic-art.js';
import { PROLOGUE, ENDING, POST_CREDITS, SPEAKERS } from './script.js';
import { promptHTML } from '../engine/game-input.js';
import { settings } from '../engine/settings.js';
import { splatPath } from './portraits.js';
import './sfx.js';

const SKIP_HOLD = 0.8;
const heroInk = () => settings.inkColors?.().hero || '#ff8a1f';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class ClockScreen extends Screen {
  constructor(app, opts) {
    super(app, opts);
    this.clock = 0;
    this.waits = [];
    this.finished = false;
    this.skipHold = 0;
    this.skipDown = false;
    this.pointerSkip = false;
    this.done = new Promise((r) => { this._resolve = r; });
  }

  /** Hold-to-skip only counts once the skip input has been released inside this screen, so a hold
   *  that skipped the previous comic can't carry over into the next one. */
  _readSkip(input) {
    const down = input.isDown('skip');
    if (!this.skipArmed) { if (!down) this.skipArmed = true; this.skipDown = false; return; }
    this.skipDown = down;
  }

  wait(s) {
    if (this.finished) return Promise.resolve();
    return new Promise((r) => this.waits.push({ t: this.clock + s, r }));
  }

  _tickClock(dt) {
    this.clock += dt;
    if (this.waits.length) {
      const due = this.waits.filter((w) => w.t <= this.clock);
      if (due.length) { this.waits = this.waits.filter((w) => w.t > this.clock); for (const w of due) w.r(); }
    }
    // hold-to-skip
    if (this.skipDown || this.pointerSkip) this.skipHold += dt; else this.skipHold = Math.max(0, this.skipHold - dt * 2);
    if (this.ring) this.ring.style.strokeDashoffset = String(94.25 * (1 - Math.min(1, this.skipHold / SKIP_HOLD)));
    this.el.classList.toggle('skipping', this.skipHold > 0.05);
    if (this.skipHold >= SKIP_HOLD) this.finish(true);
  }

  _skipUI() {
    const el = document.createElement('div');
    el.className = 'cm-skip';
    el.innerHTML = `<span class="cm-skip-key">${promptHTML(this.app.input, 'skip')}</span><span>Hold to skip</span><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15"/></svg>`;
    this.el.appendChild(el);
    this.ring = el.querySelector('.fg');
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.pointerSkip = true; });
    this._pu = () => { this.pointerSkip = false; };
    addEventListener('pointerup', this._pu);
  }

  finish(skipped = false) {
    if (this.finished) return;
    this.finished = true;
    for (const w of this.waits) w.r();
    this.waits = [];
    this.onFinish?.();
    (async () => {
      const fadeEl = this.app.fadeEl;
      if (this.opts.overFade && fadeEl) {
        fadeEl.style.transitionDuration = '350ms';
        fadeEl.classList.add('on');
        await sleep(380);
      } else {
        this.el.classList.add('closing');
        await sleep(420);
      }
      if (this._pu) removeEventListener('pointerup', this._pu);
      const st = this.app.ui.stack, i = st.indexOf(this);
      if (i === st.length - 1) this.app.ui.pop();
      else if (i >= 0) { st.splice(i, 1); this.el.remove(); }
      this._resolve({ skipped });
    })();
  }

  onEnter() {
    if (this.opts.overFade && this.app.fadeEl) {
      requestAnimationFrame(() => { this.app.fadeEl.style.transitionDuration = '450ms'; this.app.fadeEl.classList.remove('on'); });
    }
    // score: a track id, or false for silence (the post-credits tease)
    const mu = this.opts.music;
    if (mu === false) this.app.audio?.stopMusic?.(1.5);
    else if (mu) this.app.audio?.playMusic?.(mu, { fadeIn: 1.5 });
  }

  onBack() { /* skipping needs a hold */ }
}

// ---------------------------------------------------------------------------------------------
export class ComicScreen extends ClockScreen {
  /**
   * @param {Array} panels [{ art, lines, hold?, mood? }]
   * @param {object} o overFade, ink, className
   */
  constructor(app, panels, o = {}) {
    super(app, { blocksGame: true, className: 'story-comic' + (o.className ? ' ' + o.className : ''), overFade: !!o.overFade, music: o.music });
    this.panels = panels || [];
    this.o = o;
    this.cur = null;
  }

  build() {
    this.el.innerHTML = `
      <div class="cm-stage"><div class="cm-slot"></div><div class="cm-slot"></div></div>
      <div class="cm-frame"></div>
      <svg class="cm-wipe" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${splatPath(50, 50, 40, 9, 14)}"/></svg>
      <div class="cm-pages">${this.panels.map(() => '<i></i>').join('')}</div>`;
    this.slots = [...this.el.querySelectorAll('.cm-slot')];
    this.wipe = this.el.querySelector('.cm-wipe');
    this.wipe.style.setProperty('--wipe', this.o.ink || heroInk());
    this.pages = [...this.el.querySelectorAll('.cm-pages i')];
    this._skipUI();
    this.dialogue = new Dialogue({ parent: this.el, audio: this.app.audio, input: this.app.input, ink: () => this.o.ink || heroInk(), className: 'comic' });
    this.el.addEventListener('pointerdown', (e) => { if (e.button === 0) this.dialogue.advance(); });
  }

  onEnter() {
    super.onEnter();
    this._run();
  }

  onFinish() { this.dialogue.clear(); }

  async _run() {
    for (let i = 0; i < this.panels.length && !this.finished; i++) {
      await this._show(i);
      if (this.finished) return;
      const p = this.panels[i];
      if (p.lines?.length) await this.dialogue.play(p.lines, { noSkip: true });
      else await this.wait(p.hold ?? 3);
      if (this.finished) return;
      await this.wait(0.3);
    }
    this.finish(false);
  }

  async _show(i) {
    const p = this.panels[i];
    const ink = this.o.ink || heroInk();
    if (i > 0) {
      this.wipe.classList.remove('out');
      void this.wipe.getBoundingClientRect();
      this.wipe.classList.add('in');
      this.app.audio?.sfx?.('story_splash', { volume: 0.5 });
      await this.wait(0.36);
      if (this.finished) return;
    }
    const art = panelArt(p.art, { ink, mood: p.mood });
    const slot = this.slots[i % 2], other = this.slots[(i + 1) % 2];
    slot.innerHTML = art.svg;
    slot.classList.add('on');
    other.classList.remove('on');
    other.innerHTML = '';
    const svg = slot.querySelector('svg');
    this.cur = { svg, layers: [...slot.querySelectorAll('.cm-layer')].map((g) => ({ g, d: Number(g.dataset.d) || 0 })), kb: art.kb, t: 0 };
    this._kenBurns(0);
    this.pages.forEach((e, k) => e.classList.toggle('on', k <= i));
    this.app.audio?.sfx?.('story_page', { volume: 0.45 });
    if (i > 0) { this.wipe.classList.remove('in'); this.wipe.classList.add('out'); }
  }

  _kenBurns(dt) {
    const c = this.cur;
    if (!c) return;
    c.t += dt;
    const k = 1 - Math.exp(-c.t / 5.5);
    const z = 1.03 + c.kb.zoom * k;
    c.svg.style.transform = `scale(${z.toFixed(4)}) translate(${(c.kb.x * k).toFixed(3)}%, ${(c.kb.y * k).toFixed(3)}%)`;
    for (const L of c.layers) L.g.setAttribute('transform', `translate(${(-c.kb.x * 34 * L.d * k).toFixed(1)} ${(-c.kb.y * 22 * L.d * k).toFixed(1)})`);
  }

  update(dt) {
    this._tickClock(dt);
    this.dialogue.update(dt);
    this._kenBurns(dt);
  }

  handleInput(input) {
    this._readSkip(input);
    if (input.justPressed('advance') || input.justPressed('ui_accept')) this.dialogue.advance();
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
const CREDITS = [
  ['title', 'INKTIDE'],
  ['sub', 'Rise of the Murk'],
  ['gap'],
  ['head', 'Starring'],
  ['cast', 'Kai', 'You!'],
  ['cast', 'Commodore Brine', 'as himself, gruffly'],
  ['cast', 'Pix', 'live on PIX FM'],
  ['cast', 'Baron Murkwell', 'CEO, Murk Industries (former)'],
  ['cast', 'Foreman Dredge', 'safety first'],
  ['cast', 'Shelly', 'Shelly\'s Shell Shop'],
  ['cast', 'Otto & Tilly', 'Turf Clash judges'],
  ['cast', 'The Murk Corps', 'Gloopers, Shield Gloopers, Rollerbrutes, Buzzdrones, Snipe Eels, Bomblobs, Turrets & Pods'],
  ['gap'],
  ['head', 'Story'],
  ['line', 'The INKTIDE team'],
  ['head', 'Design, code & procedural art'],
  ['line', 'Built with Claude Code'],
  ['head', 'Engine'],
  ['line', 'three.js (MIT) · three-mesh-bvh (MIT)'],
  ['head', 'Fonts'],
  ['line', 'Bungee · Lilita One · Baloo 2 · Rubik Wet Paint (SIL Open Font License)'],
  ['head', 'Music & sound'],
  ['line', 'Synthesised live in WebAudio. No squids were harmed.'],
  ['head', 'Art'],
  ['line', 'Every model, texture, portrait and comic panel is drawn by code'],
  ['gap'],
  ['head', 'Special thanks'],
  ['line', 'Every Squidkin who ever picked up a blaster'],
  ['line', 'The Keepers of the Lighthouse'],
  ['line', 'Gary the pipe'],
  ['gap'],
  ['big', 'Thanks for playing!'],
  ['sub', 'Stay glossy, Tidehaven.'],
];

const MONTAGE = ['rainbow', 'team', 'cores', 'lighthouse', 'wellspring', 'pix', 'brine'];

export class CreditsScreen extends ClockScreen {
  constructor(app, o = {}) {
    super(app, { blocksGame: true, className: 'story-credits', overFade: !!o.overFade, music: o.music ?? 'credits' });
    this.o = o;
    this.y = 0;
    this.m = -1;
    this.mT = 0;
    this.fast = false;
  }

  build() {
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    this.el.innerHTML = `
      <div class="sc-bg"><div class="cm-slot"></div><div class="cm-slot"></div></div>
      <div class="sc-shade"></div>
      <div class="sc-roll"><div class="sc-inner">${CREDITS.map(([k, a, b]) => {
        if (k === 'gap') return '<div class="sc-gap"></div>';
        if (k === 'cast') return `<div class="sc-cast"><b>${esc(a)}</b><span>${esc(b)}</span></div>`;
        return `<div class="sc-${k}">${esc(a)}</div>`;
      }).join('')}</div></div>`;
    this.slots = [...this.el.querySelectorAll('.sc-bg .cm-slot')];
    this.inner = this.el.querySelector('.sc-inner');
    this._skipUI();
  }

  onEnter() {
    super.onEnter();
    this.y = innerHeight;
    this._montage();
  }

  _montage() {
    this.m++;
    this.mT = 0;
    const art = panelArt(MONTAGE[this.m % MONTAGE.length], { ink: this.o.ink || heroInk() });
    const slot = this.slots[this.m % 2], other = this.slots[(this.m + 1) % 2];
    slot.innerHTML = art.svg;
    slot.classList.add('on');
    other.classList.remove('on');
    this.kb = { svg: slot.querySelector('svg'), kb: art.kb, t: 0 };
  }

  update(dt) {
    this._tickClock(dt);
    if (this.finished) return;
    const speed = (this.fast ? 300 : 84) * (innerHeight / 1080);
    this.y -= speed * dt;
    this.inner.style.transform = `translateY(${this.y.toFixed(1)}px)`;
    const k = this.kb;
    if (k) {
      k.t += dt;
      const e = 1 - Math.exp(-k.t / 5);
      k.svg.style.transform = `scale(${(1.04 + k.kb.zoom * e).toFixed(4)}) translate(${(k.kb.x * e).toFixed(3)}%, ${(k.kb.y * e).toFixed(3)}%)`;
    }
    this.mT += dt;
    if (this.mT > 7) this._montage();
    const h = this.inner.offsetHeight;
    if (this.y < innerHeight * 0.42 - h && !this._ending) {
      this._ending = true;
      this.wait(2.8).then(() => this.finish(false));
    }
  }

  handleInput(input) {
    this._readSkip(input);
    this.fast = input.isDown('advance') || input.isDown('ui_accept');
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
export function playComic(app, panels, o = {}) {
  const s = new ComicScreen(app, panels, o);
  app.ui.push(s);
  return s.done;
}

export function playCredits(app, o = {}) {
  const s = new CreditsScreen(app, o);
  app.ui.push(s);
  return s.done;
}

export const playPrologue = (app, o = {}) => playComic(app, PROLOGUE, { music: 'story', ...o });
export const playEnding = (app, o = {}) => playComic(app, ENDING, { music: 'story', ...o });
export const playPostCredits = (app, o = {}) => playComic(app, POST_CREDITS, { music: false, ...o, className: 'tease' });

export { SPEAKERS };
