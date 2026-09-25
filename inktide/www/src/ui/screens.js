// Screen stack + gamepad/keyboard focus navigation for every menu.
//
//   class MyScreen extends Screen {
//     build() { this.el.innerHTML = '...'; this.button(el, () => ...); }
//     onBack() { this.app.ui.pop(); }
//   }
//   app.ui.push(new MyScreen(app));
//
// Focusable elements get the .focusable class (use this.button()). Focus is geometric (D-pad /
// stick / arrows pick the nearest element in that direction); a screen always opens with an
// element focused so a controller can never be stranded.
import { FocusManager, focusable } from '../engine/focus.js';
import { audio } from '../engine/audio.js';

/** Focus manager patched for TV: instant scroll so d-pad nav never measures moving rects. */
export class TvFocus extends FocusManager {
  focus(el, silentIfSame = false) {
    if (!el) return;
    const prev = this.current;
    if (prev === el) return;
    if (prev) prev.classList.remove('focused');
    this.current = el;
    el.classList.add('focused');
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight - 60) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    el.dispatchEvent(new CustomEvent('focus-hover'));
    void silentIfSame;
  }
}

export class Screen {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'screen ' + (opts.className || '');
    this.focus = new TvFocus();
    this.blocksGame = opts.blocksGame ?? true;     // pause gameplay while on top
    this.transparent = opts.transparent ?? false;  // lower screens stay visible
    this.acceptsInput = true;
  }

  /** Create DOM. Called once before first enter. */
  build() {}
  onEnter() {}
  onExit() {}
  /** B / Esc. Default: pop. */
  onBack() { this.app.ui.pop(); audio.sfx('ui_back', { volume: 0.5 }); }
  update(dt) { void dt; }
  /** Extra per-frame input (tabs with LB/RB, sliders with left/right). Return true if consumed nav. */
  handleInput(input) { void input; return false; }

  /** Make an element a focusable button with an action. */
  button(el, fn, opts = {}) {
    focusable(el, () => {
      if (el.classList.contains('disabled')) { audio.sfx('error', { volume: 0.4 }); return; }
      if (!opts.silent) audio.sfx('ui_select', { volume: 0.5 });
      fn(el);
    });
    el.setAttribute('role', el.getAttribute('role') || 'button');
    if (opts.autofocus) el.dataset.autofocus = '1';
    return el;
  }

  refreshFocus(pickFirst = false) { this.focus.setRoot(this.el); this.focus.refresh(pickFirst); }
}

export class ScreenManager {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui-root');
    this.stack = [];
  }

  get top() { return this.stack[this.stack.length - 1] || null; }
  get blocking() { return this.stack.some((s) => s.blocksGame); }

  push(screen) {
    const prev = this.top;
    if (prev && !screen.transparent) prev.el.classList.add('under');
    if (!screen._built) { screen.build(); screen._built = true; }
    this.root.appendChild(screen.el);
    this.stack.push(screen);
    requestAnimationFrame(() => screen.el.classList.add('in'));
    screen.onEnter();
    screen.refreshFocus(true);
    return screen;
  }

  pop() {
    const s = this.stack.pop();
    if (!s) return null;
    s.onExit();
    s.el.classList.remove('in');
    s.el.classList.add('out');
    setTimeout(() => s.el.remove(), 220);
    const top = this.top;
    if (top) { top.el.classList.remove('under'); top.refreshFocus(false); top.onResume?.(); }
    return s;
  }

  replace(screen) { this.pop(); return this.push(screen); }

  clear() { while (this.stack.length) this.pop(); }

  update(dt, input) {
    const top = this.top;
    for (const s of this.stack) s.update(dt);
    if (!top || !top.acceptsInput) return;
    if (top.handleInput(input)) return;
    const dir = input.navPressed();
    if (dir) top.focus.move(dir);
    if (input.justPressed('ui_accept')) top.focus.activate();
    else if (input.justPressed('ui_back')) top.onBack();
  }
}
