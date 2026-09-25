// Game-level input on top of the kit's Input (engine/input.js is kept unmodified so its 16-assertion
// contract still holds). Adds: mouse buttons as pseudo key codes, the full INKTIDE action set,
// menu navigation with stick repeat, invert X, rumble and rebinding.
import { Input } from './input.js';
import { settings } from './settings.js';

/** Xbox standard mapping indices. */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export const GAME_BINDINGS = {
  forward: { keys: ['KeyW', 'ArrowUp'], pad: [] },
  back: { keys: ['KeyS', 'ArrowDown'], pad: [] },
  left: { keys: ['KeyA', 'ArrowLeft'], pad: [] },
  right: { keys: ['KeyD', 'ArrowRight'], pad: [] },
  fire: { keys: ['Mouse0'], pad: [PAD.RT] },
  swim: { keys: ['ShiftLeft', 'ShiftRight'], pad: [PAD.LT] },
  jump: { keys: ['Space'], pad: [PAD.A] },
  sub: { keys: ['Mouse2'], pad: [PAD.RB] },
  special: { keys: ['KeyQ'], pad: [PAD.LB, PAD.RS] },
  interact: { keys: ['KeyE'], pad: [PAD.X] },
  map: { keys: ['Tab'], pad: [PAD.VIEW] },
  recenter: { keys: ['KeyR', 'Mouse1'], pad: [PAD.Y] },
  pause: { keys: ['Escape', 'KeyP'], pad: [PAD.MENU] },
  sprint: { keys: [], pad: [] },   // kit rig reads it; INKTIDE has no sprint (squid form is the sprint)
  // menus
  ui_up: { keys: ['ArrowUp', 'KeyW'], pad: [PAD.UP] },
  ui_down: { keys: ['ArrowDown', 'KeyS'], pad: [PAD.DOWN] },
  ui_left: { keys: ['ArrowLeft', 'KeyA'], pad: [PAD.LEFT] },
  ui_right: { keys: ['ArrowRight', 'KeyD'], pad: [PAD.RIGHT] },
  ui_accept: { keys: ['Enter', 'NumpadEnter', 'Space'], pad: [PAD.A] },
  ui_back: { keys: ['Escape', 'Backspace'], pad: [PAD.B] },
  ui_prev: { keys: ['KeyQ', 'PageUp'], pad: [PAD.LB] },
  ui_next: { keys: ['KeyE', 'PageDown'], pad: [PAD.RB] },
  ui_alt: { keys: ['KeyX', 'Delete'], pad: [PAD.X] },
  advance: { keys: ['Enter', 'Space', 'Mouse0', 'KeyE'], pad: [PAD.A, PAD.X] },
  skip: { keys: ['Escape'], pad: [PAD.MENU, PAD.B] },
};

/** Actions the player may remap (menus keep fixed bindings so the player cannot lock themselves out). */
export const REBINDABLE = ['forward', 'back', 'left', 'right', 'fire', 'swim', 'jump', 'sub', 'special', 'interact', 'map', 'recenter'];

export const ACTION_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  fire: 'Fire main weapon', swim: 'Swim (squid form)', jump: 'Jump', sub: 'Sub weapon', special: 'Special weapon',
  interact: 'Interact / talk', map: 'Map / super jump', recenter: 'Recenter camera',
};

const MOUSE_CODES = ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'];

export class GameInput extends Input {
  constructor(el) {
    super(el, { bindings: GAME_BINDINGS });
    this.baseBindings = structuredClone(GAME_BINDINGS);
    this.applySettings();
    settings.onChange((p) => { if (p.startsWith('controls') || p === '*') this.applySettings(); });

    this._onMouseDown = (e) => {
      const code = MOUSE_CODES[e.button];
      if (!code) return;
      this.keys.add(code);
      this._pressedThisFrame.add(code);
      this.lastDevice = 'mouse';
      this.lastRawCode = code;
    };
    this._onMouseUp = (e) => { const code = MOUSE_CODES[e.button]; if (code) this.keys.delete(code); };
    this._onContext = (e) => e.preventDefault();
    this._onKeyDownRaw = (e) => {
      this.lastRawCode = e.code;
      // keep the browser from stealing game keys (Tab focus, Space scroll, Backspace nav)
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.code)) e.preventDefault();
    };
    el.addEventListener('mousedown', this._onMouseDown);
    addEventListener('mouseup', this._onMouseUp);
    addEventListener('contextmenu', this._onContext);
    addEventListener('keydown', this._onKeyDownRaw);

    // menu navigation with auto-repeat, fed by d-pad, arrows and the left stick
    this.nav = { dir: null, t: 0, repeat: 0 };
    this._navEdge = null;
    this.stick = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 };
    this._lastPadButtons = [];
    this.lastRawPad = -1;
  }

  applySettings() {
    const c = settings.get('controls');
    this.mouseSensitivity = 0.0022 * (c.mouseSens ?? 1);
    this.padSensitivity = 2.9 * (c.padSens ?? 1);
    this.invertY = !!c.invertY;
    this.invertX = !!c.invertX;
    const b = structuredClone(this.baseBindings || GAME_BINDINGS);
    for (const [action, over] of Object.entries(c.bindings || {})) {
      if (!b[action] || !over) continue;
      if (Array.isArray(over.keys)) b[action].keys = over.keys.slice();
      if (Array.isArray(over.pad)) b[action].pad = over.pad.slice();
    }
    this.bindings = b;
  }

  update(dt) {
    super.update(dt);
    if (this.invertX) this.look.x = -this.look.x;

    const pad = [...this._gamepads()].find((g) => g && g.connected);
    const s = this.stick;
    if (pad) {
      const ax = pad.axes || [];
      s.lx = ax[0] || 0; s.ly = ax[1] || 0; s.rx = ax[2] || 0; s.ry = ax[3] || 0;
      s.lt = pad.buttons?.[PAD.LT]?.value || 0;
      s.rt = pad.buttons?.[PAD.RT]?.value || 0;
      for (let i = 0; i < (pad.buttons || []).length; i++) {
        const p = !!pad.buttons[i]?.pressed;
        if (p && !this._lastPadButtons[i]) this.lastRawPad = i;
        this._lastPadButtons[i] = p;
      }
    } else {
      s.lx = s.ly = s.rx = s.ry = s.lt = s.rt = 0;
    }

    // ---- menu navigation: one edge per press, then repeat while held ----
    let dir = null;
    if (this.isDown('ui_up') || s.ly < -0.55) dir = 'up';
    else if (this.isDown('ui_down') || s.ly > 0.55) dir = 'down';
    else if (this.isDown('ui_left') || s.lx < -0.55) dir = 'left';
    else if (this.isDown('ui_right') || s.lx > 0.55) dir = 'right';
    this._navEdge = null;
    if (dir !== this.nav.dir) {
      this.nav.dir = dir; this.nav.t = 0; this.nav.repeat = 0;
      if (dir) this._navEdge = dir;
    } else if (dir) {
      this.nav.t += dt;
      const delay = this.nav.repeat === 0 ? 0.38 : 0.11;
      if (this.nav.t >= delay) { this.nav.t = 0; this.nav.repeat++; this._navEdge = dir; }
    }
  }

  /** 'up' | 'down' | 'left' | 'right' | null — the menu direction to move this frame. */
  navPressed() { return this._navEdge; }

  /** Digital-with-analog-fallback read for fire (RT value), used by weapons that care about pressure. */
  triggerValue(action) {
    if (action === 'fire') return Math.max(this.isDown('fire') ? 1 : 0, this.stick.rt);
    if (action === 'swim') return Math.max(this.isDown('swim') ? 1 : 0, this.stick.lt);
    return this.isDown(action) ? 1 : 0;
  }

  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    if (!settings.get('controls.rumble')) return;
    const pad = [...this._gamepads()].find((g) => g && g.connected);
    const act = pad?.vibrationActuator;
    if (act?.playEffect) act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch?.(() => {});
  }

  /** Human label for a binding, e.g. "LMB", "Shift", "RT". */
  labelFor(action, device = this.lastDevice) {
    const b = this.bindings[action];
    if (!b) return '?';
    if (device === 'gamepad') return padName(b.pad?.[0]);
    return keyName(b.keys?.[0]);
  }

  dispose() {
    super.dispose();
    this.el.removeEventListener('mousedown', this._onMouseDown);
    removeEventListener('mouseup', this._onMouseUp);
    removeEventListener('contextmenu', this._onContext);
    removeEventListener('keydown', this._onKeyDownRaw);
  }
}

export function padName(i) {
  return ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D-Up', 'D-Down', 'D-Left', 'D-Right'][i] ?? (i == null ? '—' : `B${i}`);
}

export function keyName(code) {
  if (!code) return '—';
  const map = { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'M4', Mouse4: 'M5', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Bksp',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Caps' };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

/** Inline HTML for a button prompt, styled by .kbd in main.css. */
export function promptHTML(input, action) {
  const dev = input?.lastDevice === 'gamepad' ? 'gamepad' : 'keyboard';
  const label = input ? input.labelFor(action, dev) : '?';
  if (dev === 'gamepad') {
    const cls = { A: 'a', B: 'b', X: 'x', Y: 'y' }[label] || 'shoulder';
    return `<span class="kbd pad ${cls}">${label}</span>`;
  }
  return `<span class="kbd">${label}</span>`;
}
