// Shared menu building blocks: a Screen base with device-aware prompts, the prompt bar, setting
// rows (slider / toggle / choice), tab bars, the confirm dialog, unlock notifications and the ink
// wipe transition. Everything is keyboard/mouse/gamepad reachable through the focus manager.
import { Screen } from './screens.js';
import { promptHTML } from '../engine/game-input.js';
import { audio } from '../engine/audio.js';
import { save } from '../engine/save.js';
import { splatPath, pearlIcon, lockIcon } from './icons.js';
import './ui-sfx.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** m:ss.cc */
export function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), c = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// "home" = where B goes when a screen is the root of the stack (set by boot-ui)
let homeFn = null;
export function setHome(fn) { homeFn = fn; }

/** Keep a focused element inside its scroll container (panels scroll, the page never does). */
export function ensureVisible(el) {
  const box = el.closest('[data-scroll]');
  if (!box) return;
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  const pad = 18;
  if (r.top < b.top + pad) box.scrollTop -= (b.top + pad) - r.top;
  else if (r.bottom > b.bottom - pad) box.scrollTop += r.bottom - (b.bottom - pad);
}

export class UiScreen extends Screen {
  constructor(app, opts = {}) {
    super(app, opts);
    this.el.classList.add('ui');
    this._dev = null;
    // focus-hover does not bubble, but capture still reaches the screen root
    this.el.addEventListener('focus-hover', (e) => { ensureVisible(e.target); this.onFocus?.(e.target); }, true);
    this.el.addEventListener('click', (e) => {
      const p = e.target.closest?.('[data-act]');
      if (p && this.el.contains(p)) { e.preventDefault(); this.onPromptClick(p.dataset.act); }
    });
    this._patchFocusWrap();
  }

  /**
   * The stock geometric focus wraps to the far end of the whole screen when nothing lies in the
   * pressed direction (so "right" on a vertical rail jumped to its last item). Here a wrap only
   * happens along a line of items that share the column (up/down) or row (left/right).
   */
  _patchFocusWrap() {
    const fm = this.focus;
    const base = fm.move.bind(fm);
    const R = (el) => el.getBoundingClientRect();
    fm.move = (dir) => {
      if (!fm.items.length || !fm.current) return base(dir);
      const a = R(fm.current);
      const acx = (a.left + a.right) / 2, acy = (a.top + a.bottom) / 2;
      const horiz = dir === 'left' || dir === 'right';
      const ahead = fm.items.some((el) => {
        if (el === fm.current) return false;
        const b = R(el), dx = (b.left + b.right) / 2 - acx, dy = (b.top + b.bottom) / 2 - acy;
        return dir === 'left' ? dx < -4 : dir === 'right' ? dx > 4 : dir === 'up' ? dy < -4 : dy > 4;
      });
      if (ahead) return base(dir);
      const line = fm.items.filter((el) => {
        const b = R(el);
        return horiz ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 8 : Math.min(a.right, b.right) - Math.max(a.left, b.left) > 8;
      });
      if (line.length < 2) return false;
      const key = (el) => { const b = R(el); return horiz ? (b.left + b.right) / 2 : (b.top + b.bottom) / 2; };
      line.sort((p, q) => key(p) - key(q));
      const target = dir === 'left' || dir === 'up' ? line[line.length - 1] : line[0];
      if (target === fm.current) return false;
      fm.focus(target);
      audio.sfx('ui_move', { volume: 0.5 });
      return true;
    };
  }

  get input() { return this.app.input; }
  $(s) { return this.el.querySelector(s); }
  $$(s) { return [...this.el.querySelectorAll(s)]; }

  update(dt) { void dt; this.refreshPrompts(); }

  /** Re-render every [data-prompt="action[,action]"] when the input device changes. */
  refreshPrompts(force = false) {
    const dev = this.input.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
    if (!force && dev === this._dev) return;
    this._dev = dev;
    this.el.classList.toggle('dev-pad', dev === 'gamepad');
    for (const el of this.el.querySelectorAll('[data-prompt]')) {
      el.innerHTML = el.dataset.prompt.split(',').map((a) => promptHTML(this.input, a)).join('');
    }
  }

  onPromptClick(act) {
    if (act === 'ui_back') this.onBack();
    else if (act === 'ui_accept') this.focus.activate();
    else if (act === 'ui_prev') this.onTab?.(-1);
    else if (act === 'ui_next') this.onTab?.(1);
  }

  /** B / Esc: pop, or go home when this is the root screen. */
  onBack() {
    audio.sfx('ui_back', { volume: 0.5 });
    if (this.app.ui.stack.length <= 1 && homeFn) homeFn(this.app);
    else this.app.ui.pop();
  }

  /** Focus a specific element (or the first focusable matching a selector). */
  focusOn(elOrSel) {
    const el = typeof elOrSel === 'string' ? this.$(elOrSel) : elOrSel;
    this.focus.refresh(false);
    if (el && this.focus.items.includes(el)) this.focus.focus(el);
  }

  /** Shake an element (denied action). */
  shake(el) {
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 450);
  }
}

// ---- prompt bar ------------------------------------------------------------------------------
/** items: [[action(s), label], …]; each item is clickable (fires the same action). */
export function promptBar(items, cls = '') {
  return `<div class="prompt-bar ${cls}">${items.map(([a, label]) =>
    `<div class="pb-item" role="button" data-act="${a.split(',')[0]}"><span class="pb-keys" data-prompt="${a}"></span><span class="pb-label">${esc(label)}</span></div>`).join('')}</div>`;
}

export function pearlChip(n = save.data.pearls || 0, cls = '') {
  return `<div class="chip pearl-chip ${cls}">${pearlIcon()}<span class="pc-n">${n}</span><span class="sr-only"> pearls</span></div>`;
}

/** Big section heading with an ink splat behind it. */
export function heading(text, { seed = 3, sub = '' } = {}) {
  return `<div class="heading"><svg class="heading-splat" viewBox="-170 -170 340 340" aria-hidden="true"><path d="${splatPath(seed, 100, { arms: 6, drops: 5 })}"/></svg>
    <h1 class="heading-text">${esc(text)}</h1>${sub ? `<div class="heading-sub">${esc(sub)}</div>` : ''}</div>`;
}

/** Tab bar with LB/RB prompts; tabs are clickable (data-tab). */
export function tabBar(names, active = 0) {
  return `<div class="tabs" role="tablist"><span class="tab-key" data-prompt="ui_prev" data-act="ui_prev"></span>${names.map((n, i) =>
    `<div class="tab${i === active ? ' on' : ''}" role="tab" data-tab="${i}">${esc(n)}</div>`).join('')}<span class="tab-key" data-prompt="ui_next" data-act="ui_next"></span></div>`;
}

// ---- setting rows ----------------------------------------------------------------------------
/**
 * Build a focusable settings row.
 * kind: 'slider' {min,max,step,format} | 'toggle' {labels?} | 'choice' {options:[{value,label,swatch?}]} | 'button'
 * get() → value, set(v). onActivate for buttons. help: one-line description.
 */
export function settingRow(screen, def) {
  const row = document.createElement('div');
  row.className = `row row-${def.kind}`;
  row.dataset.help = def.help || '';
  const label = `<div class="row-label">${esc(def.label)}</div>`;
  if (def.kind === 'slider') {
    row.innerHTML = `${label}<div class="row-ctl"><span class="arrow l" data-dir="-1">◀</span><div class="slider"><div class="slider-fill"></div><div class="slider-knob"></div></div><span class="arrow r" data-dir="1">▶</span><div class="row-val"></div></div>`;
  } else if (def.kind === 'toggle') {
    row.innerHTML = `${label}<div class="row-ctl"><div class="toggle"><span class="toggle-knob"></span></div><div class="row-val"></div></div>`;
  } else if (def.kind === 'choice') {
    row.innerHTML = `${label}<div class="row-ctl"><span class="arrow l" data-dir="-1">◀</span><div class="row-val choice-val"></div><span class="arrow r" data-dir="1">▶</span></div>`;
  } else {
    row.innerHTML = `${label}<div class="row-ctl"><div class="row-val">${esc(def.value || '')}</div></div>`;
  }

  const render = () => {
    const v = def.get?.();
    if (def.kind === 'slider') {
      const f = (v - def.min) / (def.max - def.min);
      row.style.setProperty('--f', Math.max(0, Math.min(1, f)).toFixed(4));
      row.querySelector('.row-val').textContent = def.format ? def.format(v) : String(v);
    } else if (def.kind === 'toggle') {
      row.classList.toggle('on', !!v);
      row.querySelector('.row-val').textContent = v ? (def.labels?.[1] || 'On') : (def.labels?.[0] || 'Off');
    } else if (def.kind === 'choice') {
      const o = def.options.find((x) => x.value === v) || def.options[0];
      row.querySelector('.row-val').innerHTML = (o.swatch ? `<span class="swatch">${o.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>` : '') + esc(o.label);
    }
  };

  const adjust = (dir) => {
    if (def.kind === 'slider') {
      const v = def.get();
      const nv = Math.round(Math.max(def.min, Math.min(def.max, v + dir * def.step)) / def.step) * def.step;
      const clean = +nv.toFixed(4);
      if (clean === v) { audio.sfx('ui_denied', { volume: 0.25 }); return; }
      def.set(clean);
      audio.sfx('ui_slide', { volume: 0.45, pitch: 0.7 + ((clean - def.min) / (def.max - def.min)) * 0.9 });
    } else if (def.kind === 'toggle') {
      def.set(!def.get());
      audio.sfx('ui_toggle', { volume: 0.5, on: !!def.get() });
    } else if (def.kind === 'choice') {
      const i = def.options.findIndex((x) => x.value === def.get());
      const n = def.options.length;
      def.set(def.options[((i < 0 ? 0 : i) + dir + n) % n].value);
      audio.sfx('ui_slide', { volume: 0.45, pitch: 1.1 });
    }
    render();
    row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
    def.onChange?.();
  };

  row.__adjust = def.kind === 'button' ? null : adjust;
  row.__render = render;
  screen.button(row, () => {
    if (def.kind === 'button') def.onActivate?.();
    else if (def.kind === 'slider') audio.sfx('ui_move', { volume: 0.3 });
    else adjust(1);
  }, { silent: def.kind !== 'button' });
  // mouse: arrows and slider track
  for (const a of row.querySelectorAll('.arrow')) {
    a.addEventListener('click', (e) => { e.stopPropagation(); screen.focus.focus(row); adjust(Number(a.dataset.dir)); });
  }
  const track = row.querySelector('.slider');
  if (track) {
    track.addEventListener('click', (e) => {
      e.stopPropagation();
      screen.focus.focus(row);
      const r = track.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const v = Math.round((def.min + f * (def.max - def.min)) / def.step) * def.step;
      def.set(+v.toFixed(4)); render(); def.onChange?.();
      audio.sfx('ui_slide', { volume: 0.45, pitch: 0.7 + f * 0.9 });
    });
  }
  render();
  return row;
}

/** Left/right on a focused row adjusts it. Returns true when consumed. */
export function handleRowInput(screen, input) {
  const dir = input.navPressed();
  const cur = screen.focus.current;
  if ((dir === 'left' || dir === 'right') && cur?.__adjust) { cur.__adjust(dir === 'left' ? -1 : 1); return true; }
  return false;
}

// ---- confirm dialog --------------------------------------------------------------------------
class ConfirmScreen extends UiScreen {
  constructor(app, o, resolve) {
    super(app, { className: 'confirm', transparent: true, blocksGame: true });
    this.o = o; this.resolve = resolve; this.done = false;
  }
  build() {
    const o = this.o;
    this.el.innerHTML = `<div class="dialog-scrim"></div>
      <div class="dialog card ${o.danger ? 'danger' : ''}" role="dialog" aria-modal="true">
        <svg class="dialog-splat" viewBox="-170 -170 340 340" aria-hidden="true"><path d="${splatPath(21, 100)}"/></svg>
        <h2 class="dialog-title">${esc(o.title)}</h2>
        ${o.text ? `<p class="dialog-text">${esc(o.text)}</p>` : ''}
        <div class="dialog-btns">
          <div class="btn btn-yes">${esc(o.yes || 'Yes')}</div>
          <div class="btn btn-no">${esc(o.no || 'Cancel')}</div>
        </div>
        ${promptBar([['ui_accept', 'Choose'], ['ui_back', 'Cancel']], 'mini')}
      </div>`;
    const yes = this.button(this.$('.btn-yes'), () => this.finish(true), { autofocus: !o.danger });
    const no = this.button(this.$('.btn-no'), () => this.finish(false), { autofocus: !!o.danger });
    void yes; void no;
  }
  onEnter() { audio.sfx('ui_open', { volume: 0.4 }); }
  finish(v) {
    if (this.done) return;
    this.done = true;
    this.app.ui.pop();
    this.resolve(v);
  }
  onBack() { audio.sfx('ui_back', { volume: 0.5 }); this.finish(false); }
}

/** Promise<boolean>. o: {title, text, yes, no, danger} */
export function confirmDialog(app, o) {
  return new Promise((resolve) => app.ui.push(new ConfirmScreen(app, o, resolve)));
}

// ---- notifications (unlocks, rewards) --------------------------------------------------------
let notifyRoot = null;
/**
 * Slide-in notification card, top-right inside the safe area. Survives screen changes.
 * @param {object} o  title, text, icon (html string, optional), kind ('unlock'|'info'|'warn'), sound
 */
export function notify(o = {}) {
  if (!notifyRoot || !notifyRoot.isConnected) {
    notifyRoot = document.createElement('div');
    notifyRoot.className = 'notify-root';
    notifyRoot.setAttribute('aria-live', 'polite');
    document.body.appendChild(notifyRoot);
  }
  const kind = o.kind || 'unlock';
  const card = document.createElement('div');
  card.className = `notify notify-${kind}`;
  card.innerHTML = `<div class="notify-ico">${o.icon || (kind === 'unlock' ? lockIcon('open') : pearlIcon())}</div>
    <div class="notify-body"><div class="notify-kicker">${esc(o.kicker || (kind === 'unlock' ? 'UNLOCKED!' : kind === 'warn' ? 'HEADS UP' : 'NEW'))}</div>
    <div class="notify-title">${esc(o.title || '')}</div>${o.text ? `<div class="notify-text">${esc(o.text)}</div>` : ''}</div>
    <svg class="notify-splat" viewBox="-170 -170 340 340" aria-hidden="true"><path d="${splatPath(Math.floor(Math.random() * 99), 90)}"/></svg>`;
  notifyRoot.appendChild(card);
  while (notifyRoot.children.length > 3) notifyRoot.firstChild.remove();
  if (o.sound !== false) audio.sfx(o.sound || (kind === 'warn' ? 'ui_denied' : 'ui_unlock'), { volume: 0.6 });
  requestAnimationFrame(() => card.classList.add('in'));
  const life = o.time ?? 3800;
  setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 400); }, life);
  return card;
}

// ---- ink wipe transition ----------------------------------------------------------------------
/** Splash a screen-filling ink blot, run `mid` while covered, then clear. */
export async function inkWipe(mid, { seed = 5 } = {}) {
  const w = document.createElement('div');
  w.className = 'ink-wipe';
  w.innerHTML = `<svg viewBox="-170 -170 340 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path class="iw-a" d="${splatPath(seed, 96, { arms: 9, drops: 8 })}"/><path class="iw-b" d="${splatPath(seed + 3, 70, { arms: 7, drops: 0 })}"/></svg>`;
  document.body.appendChild(w);
  await new Promise((r) => requestAnimationFrame(() => { w.classList.add('cover'); r(); }));
  await new Promise((r) => setTimeout(r, 340));
  try { await mid?.(); } catch (e) { console.error(e); }
  w.classList.add('reveal');
  setTimeout(() => w.remove(), 520);
}
