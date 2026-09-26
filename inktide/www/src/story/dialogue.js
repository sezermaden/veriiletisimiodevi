// Dialogue box UI + conversation controller.
//
//   const dlg = new Dialogue({ parent, audio, input, ink: () => '#ff8a1f' });
//   await dlg.play([{ who: 'brine', text: 'Chin up, fins out!', mood: 'happy' }]);         // conversation
//   dlg.play(lines, { radio: true });   // non-blocking radio chatter: auto-advances, takes no input
//   per frame (outside fixed steps):  dlg.latch(input)  then  dlg.update(dt)
//
// Conversations wait for the 'advance' action (A / Enter / Space / LMB / E): the first press
// completes the typewriter, the next one moves on. 'skip' (Esc / Menu / B) ends the whole
// conversation. Speakers, colours and voices come from story/script.js; portraits from
// story/portraits.js. The `.dialogue` base styles live in main.css, refinements in story.css.
//
// Convenience for code that has a session but no StoryMode (tests, other modes):
//   import { showDialogue } from './dialogue.js'; await showDialogue(session, 'w1-1.swim');
import { speaker, resolveLines } from './script.js';
import { portraitSVG, PORTRAIT_IDS } from './portraits.js';
import { promptHTML } from '../engine/game-input.js';
import { settings } from '../engine/settings.js';
import './sfx.js';

const PUNCT_PAUSE = { '.': 7, '!': 7, '?': 7, ',': 3.5, ';': 4, ':': 4, '…': 9 };

/** The shared overlay layer for story UI (letterbox, title cards, dialogue, NPC prompts). */
export function storyRoot() {
  let el = document.getElementById('story-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'story-root';
    el.className = 'story-root';
    el.innerHTML = '<div class="story-lb top"></div><div class="story-lb bot"></div>';
    // before #ui-root so pause menus / results paint above story overlays; after #hud-root
    const ui = document.getElementById('ui-root');
    document.body.insertBefore(el, ui || null);
  }
  return el;
}

function escapeHTML(c) {
  return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : c;
}

/** Split text into per-character spans (tokens and *emphasis* supported). Returns span list. */
function buildText(el, text, input) {
  const frag = document.createDocumentFragment();
  const chars = [];
  let em = false;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '*') { em = !em; continue; }
    const span = document.createElement('span');
    span.className = 'ch' + (em ? ' em' : '');
    if (c === '{') {
      const j = s.indexOf('}', i);
      if (j > i) {
        const action = s.slice(i + 1, j);
        span.className += ' tok';
        span.innerHTML = promptHTML(input, action);
        span.dataset.c = ' ';
        frag.appendChild(span);
        chars.push(span);
        i = j;
        continue;
      }
    }
    span.innerHTML = escapeHTML(c);
    span.dataset.c = c;
    frag.appendChild(span);
    chars.push(span);
  }
  el.innerHTML = '';
  el.appendChild(frag);
  return chars;
}

// ---------------------------------------------------------------------------------------------
/** DOM view: portrait + name + typewriter text. */
export class DialogueBox {
  constructor(parent, o = {}) {
    const el = this.el = document.createElement('div');
    el.className = 'dialogue story-dialogue hidden' + (o.className ? ' ' + o.className : '');
    el.setAttribute('role', 'dialog');
    el.innerHTML = `
      <div class="portrait"><div class="pt-wrap"></div></div>
      <div class="box">
        <div class="speaker"><span class="name"></span><span class="onair"><i></i>ON AIR</span></div>
        <div class="text" aria-live="polite"></div>
        <div class="next"></div>
        <div class="skiphint"></div>
      </div>`;
    parent.appendChild(el);
    const q = (s) => el.querySelector(s);
    this.portrait = q('.portrait');
    this.ptWrap = q('.pt-wrap');
    this.nameEl = q('.name');
    this.textEl = q('.text');
    this.nextEl = q('.next');
    this.skipEl = q('.skiphint');
    this.chars = [];
    this._ptKey = '';
  }

  /** Show a line. Returns the character spans for the typewriter. */
  show(line, o = {}) {
    const sp = speaker(line.who);
    const narrator = line.who === 'narrator' || !line.who;
    const color = line.who === 'kai' || sp.color == null ? (o.ink || '#ff8a1f') : sp.color;
    const el = this.el;
    el.style.setProperty('--speaker', color);
    el.classList.toggle('narrator', narrator);
    el.classList.toggle('radio', !!(sp.radio || line.radio));
    el.classList.toggle('chatter', !!o.chatter);
    el.classList.toggle('no-portrait', narrator || !PORTRAIT_IDS.includes(line.who));
    this.nameEl.textContent = narrator ? '' : (line.name || sp.name);
    // portrait (re-rendered only when speaker / mood / ink change)
    const mood = line.mood || 'neutral';
    const key = `${line.who}|${mood}|${line.who === 'kai' ? o.ink : ''}`;
    if (!narrator && key !== this._ptKey) {
      this._ptKey = key;
      this.ptWrap.innerHTML = portraitSVG(line.who, { mood, ink: o.ink });
    }
    this.portrait.className = `portrait who-${line.who} mood-${mood}`;
    void this.portrait.offsetWidth;                  // restart the reaction animation
    this.portrait.classList.add('react');
    el.classList.remove('shake');
    if (mood === 'angry' || mood === 'shock') { void el.offsetWidth; el.classList.add('shake'); }
    // subtitle size
    const size = settings.get('gameplay.subtitleSize') || 'medium';
    document.body.classList.toggle('subs-small', size === 'small');
    document.body.classList.toggle('subs-large', size === 'large');
    // {kitName} {subName} {specialName}: the equipped kit, so tutorial lines stay true on replays
    // with another kit (button tokens like {sub} / {special} are left for buildText)
    const vars = o.vars || null;
    const text = vars ? String(line.text ?? '').replace(/\{(kitName|subName|specialName)\}/g, (m, k) => vars[k] ?? m) : line.text;
    this.chars = buildText(this.textEl, text, o.input);
    this.setNext(false);
    this.skipEl.innerHTML = o.chatter || o.noSkip ? '' : `${promptHTML(o.input, 'skip')}<span>Skip</span>`;
    el.classList.remove('hidden');
    return this.chars;
  }

  reveal(n) {
    const c = this.chars;
    for (let i = this._revealed || 0; i < Math.min(n, c.length); i++) c[i].classList.add('on');
    this._revealed = Math.min(n, c.length);
  }

  resetReveal() { this._revealed = 0; }

  setNext(on, input) {
    this.el.classList.toggle('ready', !!on);
    if (on) this.nextEl.innerHTML = `${promptHTML(input, 'advance')}<b>▼</b>`;
  }

  setTalking(on) { this.portrait.classList.toggle('talking', !!on); }

  hide() { this.el.classList.add('hidden'); this.setTalking(false); }

  dispose() { this.el.remove(); }
}

// ---------------------------------------------------------------------------------------------
/** Conversation controller: queue, typewriter, voice blips, advance / skip. */
export class Dialogue {
  /**
   * @param {object} o parent (element), audio, input, ink () → hex, className, cps (chars/sec),
   *                   onLine(line), onEnd(job)
   */
  constructor(o = {}) {
    this.o = o;
    this.audio = o.audio;
    this.input = o.input;
    this.box = new DialogueBox(o.parent || storyRoot(), { className: o.className });
    this.queue = [];
    this.cur = null;
    this.typing = false;
    this.shown = 0;
    this.acc = 0;
    this.lineT = 0;
    this.holdT = 0;
    this.blipN = 0;
    this.blipEvery = 2;
    this.lastBlip = 0;
    this.endedAt = -1e9;
  }

  get active() { return !!this.cur; }
  /** True while a conversation (not radio chatter) is on screen. */
  get blocking() { return !!this.cur && !this.cur.radio; }
  get line() { return this.cur ? this.cur.lines[this.cur.i] || null : null; }
  get currentWho() { return this.line?.who || null; }

  /**
   * Play lines (or a DIALOGUE id). Resolves { skipped } when the conversation ends.
   * @param {object} opts radio (non-blocking chatter), noSkip, auto (seconds per line)
   */
  play(linesOrId, opts = {}) {
    const res = resolveLines(linesOrId);
    const lines = (res.lines || []).filter((l) => l && l.text != null);
    const radio = opts.radio ?? res.radio;
    return new Promise((resolve) => {
      if (!lines.length) { resolve({ skipped: false, empty: true }); return; }
      const job = { lines, i: -1, radio: !!radio, opts, resolve, skipped: false };
      if (!this.cur) this._start(job);
      else if (!job.radio && this.cur.radio) {
        // a conversation interrupts radio chatter (the chatter is dropped)
        this._finish(true);
        this._start(job);
      } else if (job.radio && this.queue.filter((j) => j.radio).length >= 2) {
        resolve({ skipped: true, dropped: true });       // don't pile up stale chatter
      } else {
        // conversations jump ahead of queued chatter
        if (!job.radio) { const k = this.queue.findIndex((j) => j.radio); if (k >= 0) { this.queue.splice(k, 0, job); return; } }
        this.queue.push(job);
      }
    });
  }

  _start(job) {
    this.cur = job;
    this._next();
  }

  _next() {
    const job = this.cur;
    if (!job) return;
    job.i++;
    if (job.i >= job.lines.length) { this._finish(false); return; }
    const line = job.lines[job.i];
    const prev = job.lines[job.i - 1];
    this.box.resetReveal();
    this.box.show(line, { ink: this.o.ink?.(), vars: this.o.vars?.() || null, input: this.input, chatter: job.radio, noSkip: job.opts.noSkip });
    this.shown = 0;
    this.acc = 0;
    this.lineT = 0;
    this.holdT = 0;
    this.blipN = 0;
    this.typing = true;
    const sp = speaker(line.who);
    if ((sp.radio || line.radio) && (!prev || prev.who !== line.who)) this.audio?.sfx?.('story_radio', { volume: 0.5, bus: 'voice' });
    this.audio?.duck?.(0.45, 1.2);
    this.o.onLine?.(line, job);
  }

  _finish(skipped) {
    const job = this.cur;
    if (!job) return;
    job.skipped = job.skipped || skipped;
    this.cur = null;
    this.typing = false;
    this.box.hide();
    this.endedAt = performance.now();
    this.o.onEnd?.(job);
    job.resolve({ skipped: job.skipped });
    if (this.queue.length) this._start(this.queue.shift());
  }

  /** Complete the typewriter, or go to the next line. */
  advance() {
    if (!this.cur || this.cur.radio) return;
    if (this.lineT < 0.1) return;                 // swallow the press that opened the line
    if (this.typing) { this.shown = this.box.chars.length; this.box.reveal(this.shown); this._doneTyping(); return; }
    this.audio?.sfx?.('story_next', { volume: 0.35 });
    this._next();
  }

  /** End the whole current conversation. */
  skip() {
    if (!this.cur || this.cur.radio || this.cur.opts.noSkip) return;
    this.audio?.sfx?.('ui_back', { volume: 0.35 });
    this._finish(true);
  }

  /** Drop everything (stage end, dispose). */
  clear() {
    const q = this.queue;
    this.queue = [];
    for (const j of q) j.resolve({ skipped: true });
    if (this.cur) this._finish(true);
  }

  /** Recently finished (debounces the press that closed a conversation). */
  recentlyEnded(ms = 300) { return performance.now() - this.endedAt < ms; }

  /** Once per frame, outside fixed steps. Returns true if the input was used. */
  latch(input) {
    if (!this.blocking) return false;
    if (input.justPressed('skip')) { this.skip(); return true; }
    if (input.justPressed('advance')) { this.advance(); return true; }
    return false;
  }

  _doneTyping() {
    this.typing = false;
    this.box.setTalking(false);
    if (!this.cur?.radio) this.box.setNext(true, this.input);
  }

  update(dt) {
    const job = this.cur;
    if (!job) return;
    this.lineT += dt;
    const line = job.lines[job.i];
    if (this.typing) {
      const cps = (this.o.cps || 46) * (line.speed || 1);
      this.acc += dt * cps;
      const chars = this.box.chars;
      const voice = speaker(line.who).voice;
      while (this.acc >= 1 && this.shown < chars.length) {
        const c = chars[this.shown].dataset.c;
        this.shown++;
        this.acc -= 1;
        if (PUNCT_PAUSE[c] && this.shown < chars.length && chars[this.shown].dataset.c === ' ') this.acc -= PUNCT_PAUSE[c];
        if (voice && c !== ' ' && !PUNCT_PAUSE[c]) {
          if (++this.blipN >= this.blipEvery) {
            this.blipN = 0;
            this.blipEvery = this.blipEvery === 2 ? 3 : 2;
            const now = performance.now();
            if (now - this.lastBlip > 45) { this.lastBlip = now; this.audio?.blip?.(voice); }
          }
        }
      }
      this.box.reveal(this.shown);
      this.box.setTalking(this.acc > -2);        // mouth rests during punctuation pauses
      if (this.shown >= chars.length) this._doneTyping();
      return;
    }
    // finished typing: chatter and timed lines move on by themselves
    const auto = job.radio ? 1.3 + this.box.chars.length * 0.035 : (line.auto ?? job.opts.auto ?? null);
    if (auto != null) {
      this.holdT += dt;
      if (this.holdT >= auto) this._next();
    }
  }

  dispose() {
    this.clear();
    this.box.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
/**
 * Show a conversation in a running session, with or without a StoryMode. Uses the mode's
 * director when there is one, else a self-driving director (see story/director.js).
 */
export async function showDialogue(session, linesOrId, opts = {}) {
  const { directorFor } = await import('./director.js');
  return directorFor(session).say(linesOrId, opts);
}
