/* Geometric focus navigation for every menu: mouse, keyboard arrows/WASD and gamepad
   D-pad/stick all move the same focus ring. Scrolling uses behavior:'auto' — a smooth
   scroll lets the d-pad outrun it and strands items in long lists (TvFocus fix). */
import { Audio } from '../core/audio.js';

export class FocusManager {
  constructor() { this.root = null; this.items = []; this.current = null; }

  setRoot(el, preferred = null) {
    this.root = el;
    this.current = null;
    this.refresh(preferred);
  }

  refresh(preferred = null) {
    if (!this.root) { this.items = []; return; }
    this.items = [...this.root.querySelectorAll('.focusable')].filter((el) => !el.classList.contains('nofocus') && el.offsetParent !== null);
    for (const el of this.items) {
      if (el.dataset.fb) continue;
      el.dataset.fb = '1';
      el.addEventListener('mouseenter', () => this.focus(el, true));
      el.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.focus(el, true); this.activate(el, ev); });
      el.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.focus(el, true); el.__onAlt?.(el); });
      el.addEventListener('wheel', (ev) => { if (el.__onWheel) { ev.preventDefault(); el.__onWheel(ev.deltaY < 0 ? 1 : -1); } }, { passive: false });
    }
    if (this.current && !this.items.includes(this.current)) this.current = null;
    if (!this.current) {
      const pick = preferred || this.items.find((el) => el.dataset.autofocus === '1') || this.items[0];
      if (pick) this.focus(pick, true);
    }
  }

  focus(el, silent = false) {
    if (!el || el === this.current) return;
    this.current?.classList.remove('focused');
    this.current = el;
    el.classList.add('focused');
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight - 60) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    if (!silent) Audio.play('ui_move');
    el.__onFocus?.(el);
  }

  activate(el = this.current, ev = null) {
    if (!el) return;
    if (el.classList.contains('disabled')) { Audio.play('ui_error'); return; }
    el.__onActivate?.(el, ev);
  }

  /** Left/right on a slider/select adjusts instead of moving focus. */
  adjust(dir) {
    const el = this.current;
    if (el?.__onAdjust) { el.__onAdjust(dir); return true; }
    return false;
  }

  move(dir) {
    if (!this.items.length) return;
    if (!this.current) { this.focus(this.items[0]); return; }
    const a = rect(this.current);
    let best = null, bestScore = Infinity;
    for (const el of this.items) {
      if (el === this.current) continue;
      const b = rect(el);
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      let primary, cross;
      if (dir === 'left') { if (dx > -4 || b.right > a.left + 4) continue; primary = -dx; cross = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 4 || b.left < a.right - 4) continue; primary = dx; cross = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -4 || b.bottom > a.top + 4) continue; primary = -dy; cross = Math.abs(dx); }
      else { if (dy < 4 || b.top < a.bottom - 4) continue; primary = dy; cross = Math.abs(dx); }
      const score = primary + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best) {
      // relaxed pass: overlapping boxes (e.g. grid rows of different heights)
      for (const el of this.items) {
        if (el === this.current) continue;
        const b = rect(el);
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        const ok = dir === 'left' ? dx < -4 : dir === 'right' ? dx > 4 : dir === 'up' ? dy < -4 : dy > 4;
        if (!ok) continue;
        const score = (dir === 'left' || dir === 'right' ? Math.abs(dx) + Math.abs(dy) * 2.2 : Math.abs(dy) + Math.abs(dx) * 2.2);
        if (score < bestScore) { bestScore = score; best = el; }
      }
    }
    if (best) this.focus(best);
  }

  clear() { this.current?.classList.remove('focused'); this.current = null; this.items = []; this.root = null; }
}

function rect(el) {
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

/** Make an element focusable with handlers. */
export function focusable(el, onActivate, { onAdjust = null, onFocus = null, onAlt = null, onWheel = null, autofocus = false } = {}) {
  el.classList.add('focusable');
  el.__onActivate = onActivate;
  if (onAdjust) el.__onAdjust = onAdjust;
  if (onFocus) el.__onFocus = onFocus;
  if (onAlt) el.__onAlt = onAlt;
  if (onWheel) el.__onWheel = onWheel;
  if (autofocus) el.dataset.autofocus = '1';
  return el;
}

/** Tiny DOM helper: h('div.cls#id', {attrs}, ...children) */
export function h(tag, attrs = {}, ...kids) {
  const [t, ...rest] = tag.split(/(?=[.#])/);
  const el = document.createElement(t || 'div');
  for (const r of rest) { if (r[0] === '.') el.classList.add(r.slice(1)); else el.id = r.slice(1); }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

/** Menu navigation input: keyboard events + polled gamepad with key-repeat. */
export class MenuInput {
  constructor() {
    this.queue = [];
    this.repeat = { dir: null, t: 0 };
    this.padPrev = new Set();
    this.onKey = (e) => {
      if (this.capture) { e.preventDefault(); this.capture(e.code); this.capture = null; return; }
      const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', KeyQ: 'tabL', KeyE: 'tabR', PageUp: 'tabL', PageDown: 'tabR', Tab: 'tabR' };
      const a = map[e.code];
      if (!a) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.queue.push({ a, code: e.code, repeat: e.repeat });
    };
    addEventListener('keydown', this.onKey);
    this.capture = null;
  }

  /** Returns actions for this frame: [{a:'up'|'down'|'left'|'right'|'ok'|'back'|'tabL'|'tabR'|'alt'|'aux'}] */
  poll(dt) {
    const out = this.queue.splice(0);
    const pad = [...(navigator.getGamepads?.() || [])].find((g) => g && g.connected);
    if (pad) {
      const now = new Set();
      pad.buttons.forEach((b, i) => { if (b?.pressed) now.add(i); });
      const edge = (i) => now.has(i) && !this.padPrev.has(i);
      if (edge(0)) out.push({ a: 'ok', pad: true });
      if (edge(1)) out.push({ a: 'back', pad: true });
      if (edge(2)) out.push({ a: 'alt', pad: true });
      if (edge(3)) out.push({ a: 'aux', pad: true });
      if (edge(4)) out.push({ a: 'tabL', pad: true });
      if (edge(5)) out.push({ a: 'tabR', pad: true });
      if (edge(9)) out.push({ a: 'menu', pad: true });
      if (edge(8)) out.push({ a: 'view', pad: true });
      let dir = null;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (now.has(12) || ay < -0.6) dir = 'up';
      else if (now.has(13) || ay > 0.6) dir = 'down';
      else if (now.has(14) || ax < -0.6) dir = 'left';
      else if (now.has(15) || ax > 0.6) dir = 'right';
      if (dir !== this.repeat.dir) { this.repeat = { dir, t: 0.38 }; if (dir) out.push({ a: dir, pad: true }); }
      else if (dir) { this.repeat.t -= dt; if (this.repeat.t <= 0) { this.repeat.t = 0.1; out.push({ a: dir, pad: true }); } }
      this.padPrev = now;
      if (this.capturePad) {
        for (const i of now) if (!this.padPrev.has(i)) { this.capturePad(i); this.capturePad = null; }
      }
    }
    return out;
  }

  clear() { this.queue.length = 0; }
}
