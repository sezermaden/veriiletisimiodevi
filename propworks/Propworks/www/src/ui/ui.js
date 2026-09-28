/* Screen stack + overlays + menu navigation dispatch. One FocusManager serves whatever is
   on top: a screen (main menu, options…) or an overlay (spawn menu, context menu). */
import { FocusManager, MenuInput } from './focus.js';
import { Audio } from '../core/audio.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('screens');
    this.overlayRoot = document.getElementById('overlay');
    this.focus = new FocusManager();
    this.input = new MenuInput();
    this.stack = [];       // screens: { el, onNav, preferred, onClose }
    this.overlays = [];    // { el, onNav, preferred }
  }

  get top() { return this.overlays[this.overlays.length - 1] || this.stack[this.stack.length - 1] || null; }
  get active() { return !!this.top; }

  _refocus() {
    const t = this.top;
    if (!t) { this.focus.clear(); return; }
    this.focus.setRoot(t.el, typeof t.preferred === 'function' ? t.preferred() : t.preferred);
  }

  /** Replace the whole stack with one screen. */
  show(screen) {
    for (const s of this.stack) { s.onClose?.(); s.el.remove(); }
    this.stack = [];
    this.push(screen);
  }

  push(screen) {
    for (const s of this.stack) s.el.classList.add('hidden');
    this.stack.push(screen);
    this.root.append(screen.el);
    this.input.clear();
    this._refocus();
  }

  pop() {
    const s = this.stack.pop();
    if (s) { s.onClose?.(); s.el.remove(); }
    const t = this.stack[this.stack.length - 1];
    if (t) { t.el.classList.remove('hidden'); t.onResume?.(); }
    this._refocus();
    Audio.play('ui_back');
    return s;
  }

  clear() {
    for (const s of this.stack) { s.onClose?.(); s.el.remove(); }
    this.stack = [];
    this._refocus();
  }

  pushOverlay(el, preferred, onNav) {
    const o = { el, preferred, onNav };
    this.overlays.push(o);
    this.overlayRoot.append(el);
    this.input.clear();
    this._refocus();
    return o;
  }

  popOverlay(el) {
    const i = this.overlays.findIndex((o) => o.el === el);
    if (i >= 0) this.overlays.splice(i, 1);
    el.remove();
    this._refocus();
  }

  update(dt) {
    const acts = this.input.poll(dt);
    const t = this.top;
    if (!t) return acts;
    for (const { a } of acts) {
      if (t.onNav?.(a)) continue;
      if (a === 'up' || a === 'down') this.focus.move(a);
      else if (a === 'left' || a === 'right') { if (!this.focus.adjust(a === 'left' ? -1 : 1)) this.focus.move(a); }
      else if (a === 'ok') this.focus.activate();
      else if (a === 'back') { if (this.stack.length > 1 && !this.overlays.length) this.pop(); }
    }
    return acts;
  }
}
