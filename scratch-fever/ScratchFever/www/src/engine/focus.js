/* =========================================================
   Focus manager — makes every screen fully navigable with a
   gamepad or the keyboard, while keeping the mouse working.

   Scrolling is instant on purpose. With behavior:'smooth' a
   d-pad press reaches the next item before the scroll settles,
   the geometric picker then measures moving rectangles and can
   strand entries in a long list — an unreachable option on Xbox.
   ========================================================= */
import { Sound } from './audio.js';

export class FocusManager {
  constructor() {
    this.root = null;
    this.items = [];
    this.current = null;
    this.enabled = true;
    this.onChange = null;
  }

  setRoot(el) {
    this.root = el;
    this.refresh(true);
  }

  refresh(pickFirst = false) {
    if (!this.root) { this.items = []; this.current = null; return; }
    this.items = Array.from(this.root.querySelectorAll('.focusable'))
      .filter(el => !el.classList.contains('disabled') && el.offsetParent !== null);
    for (const el of this.items) {
      if (el.dataset.focusBound) continue;
      el.dataset.focusBound = '1';
      el.addEventListener('mouseenter', () => { if (this.enabled) this.focus(el, true); });
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        this.focus(el, true);
        this._activate(el);
      });
    }
    if (this.current && !this.items.includes(this.current)) this.current = null;
    if (!this.current && (pickFirst || this.items.length)) {
      const preferred = this.items.find(el => el.dataset.autofocus === '1');
      this.focus(preferred || this.items[0], true);
    }
  }

  focus(el, silentIfSame = false) {
    if (!el) return;
    if (el === this.current) return;
    if (this.current) this.current.classList.remove('focused');
    this.current = el;
    el.classList.add('focused');
    if (typeof el.scrollIntoView === 'function') {
      const r = el.getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight - 60) {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
    el.dispatchEvent(new CustomEvent('focus-hover'));
    if (this.onChange) this.onChange(el);
  }

  clear() {
    if (this.current) this.current.classList.remove('focused');
    this.current = null;
    this.items = [];
    this.root = null;
  }

  _activate(el) {
    const handler = el.__onActivate;
    if (handler) handler(el);
  }

  activate() {
    if (!this.current) return false;
    if (this.current.classList.contains('disabled')) { Sound.play('error'); return false; }
    this._activate(this.current);
    return true;
  }

  /** Left/right on a focused element that owns an adjust handler (sliders, choices). */
  adjust(dir) {
    if (!this.current) return false;
    const h = this.current.__onAdjust;
    if (!h) return false;
    h(dir, this.current);
    return true;
  }

  /** Geometric nearest neighbour in a direction. Returns the element it would pick, or null. */
  peek(dir, from = this.current) {
    if (!this.items.length) return null;
    if (!from) return this.items[0];
    const a = rect(from);
    let best = null, bestScore = Infinity;
    for (const el of this.items) {
      if (el === from) continue;
      const b = rect(el);
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      let primary, cross;
      if (dir === 'left') { if (dx > -4) continue; primary = -dx; cross = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 4) continue; primary = dx; cross = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -4) continue; primary = -dy; cross = Math.abs(dx); }
      else { if (dy < 4) continue; primary = dy; cross = Math.abs(dx); }
      const score = primary + cross * 2.4;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best) {
      // wrap around on the same axis
      const sorted = this.items.slice().sort((p, q) => {
        const rp = rect(p), rq = rect(q);
        return (dir === 'left' || dir === 'right') ? rp.cx - rq.cx : rp.cy - rq.cy;
      });
      best = (dir === 'left' || dir === 'up') ? sorted[sorted.length - 1] : sorted[0];
      if (best === from) return null;
    }
    return best;
  }

  move(dir) {
    if (!this.items.length) return false;
    if (!this.current) { this.focus(this.items[0]); return true; }
    // a focused slider eats left/right
    if ((dir === 'left' || dir === 'right') && this.current.__onAdjust) {
      this.adjust(dir === 'left' ? -1 : 1);
      return true;
    }
    const best = this.peek(dir);
    if (!best) return false;
    this.focus(best);
    Sound.play('ui_move');
    return true;
  }
}

function rect(el) {
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
}

/** Helper for building focusable elements with an action. */
export function focusable(el, onActivate, onAdjust = null) {
  el.classList.add('focusable');
  el.tabIndex = -1;
  el.__onActivate = onActivate;
  if (onAdjust) el.__onAdjust = onAdjust;
  return el;
}
