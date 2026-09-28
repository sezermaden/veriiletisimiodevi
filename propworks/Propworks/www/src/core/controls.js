/* Game bindings on top of the kit's Input (engine/input.js).

   The kit class keeps its guarantees (radial deadzone, stick calibration, consumed mouse
   deltas, frame-rate independent mouse look). This subclass adds what a sandbox needs:
   mouse buttons as bindable "keys", a consumed wheel accumulator, analog triggers, a
   long-press detector for the gamepad View button, and a rebindable keyboard table. */
import { Input } from '../../engine/input.js';

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

/** Default bindings. `keys` are KeyboardEvent.code values or Mouse0/1/2; `pad` are standard-mapping button indices. */
export const GAME_BINDINGS = {
  forward: { keys: ['KeyW', 'ArrowUp'], pad: [] },
  back: { keys: ['KeyS', 'ArrowDown'], pad: [] },
  left: { keys: ['KeyA', 'ArrowLeft'], pad: [] },
  right: { keys: ['KeyD', 'ArrowRight'], pad: [] },
  jump: { keys: ['Space'], pad: [PAD.A] },
  crouch: { keys: ['ControlLeft', 'ControlRight'], pad: [PAD.B] },
  use: { keys: ['KeyE'], pad: [PAD.Y] },
  reload: { keys: ['KeyR'], pad: [PAD.X] },
  primary: { keys: ['Mouse0'], pad: [PAD.RT] },
  secondary: { keys: ['Mouse2'], pad: [PAD.LT] },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], pad: [PAD.L3] },
  walk: { keys: ['AltLeft'], pad: [] },
  noclip: { keys: ['KeyV'], pad: [] },
  flashlight: { keys: ['KeyF'], pad: [] },
  spawnmenu: { keys: ['KeyQ'], pad: [] },          // pad View is handled as tap/hold below
  context: { keys: ['KeyC'], pad: [PAD.R3] },
  undo: { keys: ['KeyZ'], pad: [] },
  pause: { keys: ['Escape', 'KeyP'], pad: [PAD.MENU] },
  nextWeapon: { keys: [], pad: [PAD.RB] },
  prevWeapon: { keys: [], pad: [PAD.LB] },
  slot1: { keys: ['Digit1'], pad: [] },
  slot2: { keys: ['Digit2'], pad: [] },
  slot3: { keys: ['Digit3'], pad: [] },
  slot4: { keys: ['Digit4'], pad: [] },
  slot5: { keys: ['Digit5'], pad: [] },
  slot6: { keys: ['Digit6'], pad: [] },
  ch1: { keys: ['Numpad8', 'KeyI'], pad: [PAD.UP] },
  ch2: { keys: ['Numpad2', 'KeyK'], pad: [PAD.DOWN] },
  ch3: { keys: ['Numpad4', 'KeyJ'], pad: [PAD.LEFT] },
  ch4: { keys: ['Numpad6', 'KeyL'], pad: [PAD.RIGHT] },
  ch5: { keys: ['Numpad5', 'KeyU'], pad: [] },
  ch6: { keys: ['Numpad0', 'KeyO'], pad: [] },
  scoreboard: { keys: ['Tab'], pad: [] },
};

/** Human names for the rebind screen, in display order. */
export const ACTION_LABELS = [
  ['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Strafe left'], ['right', 'Strafe right'],
  ['jump', 'Jump'], ['crouch', 'Crouch'], ['sprint', 'Sprint'], ['walk', 'Walk slowly'],
  ['use', 'Use / rotate held object'], ['reload', 'Reload / unfreeze'], ['primary', 'Primary fire'],
  ['secondary', 'Secondary fire'], ['spawnmenu', 'Spawn menu'], ['context', 'Context menu'],
  ['undo', 'Undo'], ['noclip', 'Noclip'], ['flashlight', 'Flashlight'],
  ['ch1', 'Contraption: channel 1 (forward)'], ['ch2', 'Contraption: channel 2 (back)'],
  ['ch3', 'Contraption: channel 3 (left)'], ['ch4', 'Contraption: channel 4 (right)'],
  ['ch5', 'Contraption: channel 5'], ['ch6', 'Contraption: channel 6'], ['pause', 'Pause'],
];

const VIEW_HOLD = 0.45;   // seconds: View held this long = Undo, released sooner = spawn menu

export class Controls extends Input {
  constructor(el, opts = {}) {
    super(el, { ...opts, bindings: cloneBindings(GAME_BINDINGS) });
    this.wheel = 0;               // wheel notches this frame, + = away from the user (push)
    this._wheelAcc = 0;
    this.triggerThreshold = 0.35;
    this._viewDown = 0;
    this._viewFired = false;
    this.viewTap = false;          // true for one frame when View was tapped
    this.viewHold = false;         // true for one frame when the hold threshold was crossed
    this.enabled = true;           // gameplay input on/off (menus turn it off)

    this._onMouseDown = (e) => {
      const code = 'Mouse' + e.button;
      this.keys.add(code);
      this._pressedThisFrame.add(code);
      this.lastDevice = 'mouse';
    };
    this._onMouseUp = (e) => this.keys.delete('Mouse' + e.button);
    this._onWheel = (e) => {
      // Normalise pixel/line/page deltas into notches.
      const d = e.deltaMode === 1 ? e.deltaY / 3 : e.deltaMode === 2 ? e.deltaY * 3 : e.deltaY / 100;
      this._wheelAcc += -Math.sign(d) * Math.max(1, Math.round(Math.abs(d)));
      this.lastDevice = 'mouse';
    };
    this._onContext = (e) => { if (this.pointerLocked) e.preventDefault(); };
    addEventListener('mousedown', this._onMouseDown);
    addEventListener('mouseup', this._onMouseUp);
    addEventListener('wheel', this._onWheel, { passive: true });
    addEventListener('contextmenu', this._onContext);
    this._onKeyGuard = (e) => {
      // Keep the browser from eating game keys (Tab focus, Alt menu, Space scroll, Ctrl shortcuts).
      if (!this.pointerLocked) return;
      if (['Tab', 'AltLeft', 'Space', 'KeyQ', 'F1'].includes(e.code) || e.ctrlKey) e.preventDefault();
    };
    addEventListener('keydown', this._onKeyGuard, true);
  }

  /** Pointer lock without unhandled rejections (it needs a user gesture in browsers). */
  enablePointerLock() {
    try {
      const p = this.el.requestPointerLock?.({ unadjustedMovement: true });
      if (p?.catch) p.catch(() => { try { const q = this.el.requestPointerLock(); q?.catch?.(() => {}); } catch { /* no gesture */ } });
    } catch { /* no gesture yet */ }
  }

  update(dt) {
    super.update(dt);
    this.wheel = this._wheelAcc;
    this._wheelAcc = 0;

    // Analog triggers: the standard mapping reports them as buttons with a value.
    const pad = [...this._gamepads()].find((g) => g && g.connected);
    this.pad = pad || null;
    if (pad) {
      for (const i of [PAD.LT, PAD.RT]) {
        const b = pad.buttons?.[i];
        if (b && (b.value ?? (b.pressed ? 1 : 0)) > this.triggerThreshold) this._padPressed.add(i);
        else this._padPressed.delete(i);
      }
    }

    // View button: tap vs hold.
    this.viewTap = false;
    this.viewHold = false;
    const viewNow = this._padPressed.has(PAD.VIEW);
    if (viewNow) {
      this._viewDown += dt;
      if (!this._viewFired && this._viewDown >= VIEW_HOLD) { this._viewFired = true; this.viewHold = true; }
    } else {
      if (this._viewDown > 0 && !this._viewFired) this.viewTap = true;
      this._viewDown = 0;
      this._viewFired = false;
    }
  }

  /** Raw stick position for things that want analog values (vehicle throttle, rotate). */
  stick(which) {
    const p = this.pad;
    if (!p) return { x: 0, y: 0 };
    const i = which === 'right' ? 2 : 0;
    const c = this._padCalib || [0, 0, 0, 0];
    let x = (p.axes[i] || 0) - c[i], y = (p.axes[i + 1] || 0) - c[i + 1];
    const len = Math.hypot(x, y);
    if (len < this.deadzone) return { x: 0, y: 0 };
    const s = (len - this.deadzone) / (1 - this.deadzone) / len;
    return { x: x * s, y: y * s };
  }

  trigger(which) {
    const b = this.pad?.buttons?.[which === 'left' ? PAD.LT : PAD.RT];
    return b ? (b.value ?? (b.pressed ? 1 : 0)) : 0;
  }

  padDown(i) { return this._padPressed.has(i); }
  padPressed(i) { return this._padPressed.has(i) && !this._padPrev.has(i); }

  keyPressed(code) { return this._pressedThisFrame.has(code); }

  /** Clear held state — called when a menu opens so nothing stays "stuck down". */
  releaseAll() {
    this.keys.clear();
    this._pressedThisFrame.clear();
    this._wheelAcc = 0;
    this._mouseDX = this._mouseDY = 0;
  }

  rebind(action, index, code) {
    const b = this.bindings[action];
    if (!b) return;
    // A key may only do one thing: steal it from any other action first.
    for (const other of Object.values(this.bindings)) {
      const k = other.keys.indexOf(code);
      if (k >= 0) other.keys.splice(k, 1);
    }
    b.keys[index] = code;
    b.keys = b.keys.filter(Boolean);
  }

  resetBindings() { this.bindings = cloneBindings(GAME_BINDINGS); }

  exportBindings() {
    const out = {};
    for (const [a, b] of Object.entries(this.bindings)) out[a] = [...b.keys];
    return out;
  }

  importBindings(data) {
    if (!data) return;
    for (const [a, keys] of Object.entries(data)) if (this.bindings[a] && Array.isArray(keys)) this.bindings[a].keys = [...keys];
  }

  dispose() {
    super.dispose();
    removeEventListener('mousedown', this._onMouseDown);
    removeEventListener('mouseup', this._onMouseUp);
    removeEventListener('wheel', this._onWheel);
    removeEventListener('contextmenu', this._onContext);
    removeEventListener('keydown', this._onKeyGuard, true);
  }
}

function cloneBindings(b) {
  const out = {};
  for (const [k, v] of Object.entries(b)) out[k] = { keys: [...v.keys], pad: [...v.pad] };
  return out;
}

/** Display name for a key code, for prompts and the rebind screen. */
export function keyName(code) {
  if (!code) return '—';
  const map = {
    Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT',
    ControlLeft: 'CTRL', ControlRight: 'R-CTRL', AltLeft: 'ALT', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'BKSP',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code;
}

export const PAD_NAMES = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'VIEW', 9: 'MENU', 10: 'L3', 11: 'R3', 12: 'D-UP', 13: 'D-DOWN', 14: 'D-LEFT', 15: 'D-RIGHT' };
