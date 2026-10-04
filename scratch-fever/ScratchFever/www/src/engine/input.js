/* =========================================================
   Unified input: keyboard + mouse + gamepad

   Edges (pressed / released) are queued by the DOM events and
   published once per frame at the top of update(), so a tap that
   happens between two frames is never lost and is readable for
   exactly one whole frame. See PITFALLS 8.
   ========================================================= */

const KEY_ACTIONS = {
  // navigation / cursor
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  // ui / commands
  Enter: 'confirm', NumpadEnter: 'confirm',
  Space: 'scratch',
  KeyE: 'scratch',
  Escape: 'cancel', Backspace: 'cancel',
  KeyP: 'pause',
  KeyX: 'reveal',
  KeyF: 'reveal',
  KeyB: 'shop',
  KeyQ: 'tabL',
  KeyR: 'tabR',
  Tab: 'stats',
  KeyM: 'mute',
};

const PAD_BUTTON_ACTIONS = {
  0: 'confirm',   // A
  1: 'cancel',    // B
  2: 'reveal',    // X
  3: 'shop',      // Y
  4: 'tabL',      // LB
  5: 'tabR',      // RB
  8: 'stats',     // View
  9: 'pause',     // Menu
  12: 'up', 13: 'down', 14: 'left', 15: 'right',
};

/** Human-readable glyphs for prompts, keyed by action. */
export const PROMPTS = {
  keyboard: {
    confirm: 'Enter', cancel: 'Esc', scratch: 'Space', reveal: 'X', shop: 'B',
    tabL: 'Q', tabR: 'R', stats: 'Tab', pause: 'Esc', move: 'WASD',
  },
  gamepad: {
    confirm: 'A', cancel: 'B', scratch: 'RT', reveal: 'X', shop: 'Y',
    tabL: 'LB', tabR: 'RB', stats: 'View', pause: 'Menu', move: 'LS',
  },
};

const NAV_ACTIONS = new Set(['up', 'down', 'left', 'right']);
const REPEAT_DELAY = 0.38;
const REPEAT_RATE = 0.105;
const STICK_DEAD = 0.22;
const TRIGGER_DEAD = 0.35;

class InputSystem {
  constructor() {
    /** digital intent from keys / d-pad / left stick, normalised: x right, y down */
    this.move = { x: 0, y: 0 };
    /** raw analogue left stick after deadzone (0 when no pad) */
    this.stick = { x: 0, y: 0 };
    /** right stick */
    this.stick2 = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0, inside: false, down: false, moved: false };
    this.mouseMovedRecently = 0;
    this.usingGamepad = false;
    this.lastDevice = 'keyboard';
    this.padIndex = -1;
    this.padConnectedOnce = false;
    this.onPadConnect = null;
    this.onDeviceChange = null;

    this._keys = new Set();
    this._down = new Set();     // edge: pressed, readable for the whole frame
    this._up = new Set();       // edge: released, readable for the whole frame
    this._held = new Set();     // continuous
    this._pendingDown = new Set();
    this._pendingUp = new Set();
    this._navRepeat = new Map();
    this._prevPadButtons = [];
    this._anyKeyFlag = false;
    this._bound = false;
    this._padHeld = new Set();
    this.triggerR = 0;
    this.triggerL = 0;
  }

  attach(target = window) {
    if (this._bound) return;
    this._bound = true;

    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const a = KEY_ACTIONS[e.code];
      if (a) {
        if (e.code === 'Tab' || e.code === 'Space' || e.code === 'Backspace' || e.code.startsWith('Arrow')) e.preventDefault();
        this._keys.add(e.code);
        if (!this._held.has(a)) { this._pendingDown.add(a); this._held.add(a); }
      }
      this._anyKeyFlag = true;
      this._setDevice('keyboard');
    });

    target.addEventListener('keyup', (e) => {
      const a = KEY_ACTIONS[e.code];
      this._keys.delete(e.code);
      if (a && !this._isKeyActionStillDown(a) && !this._padHeld.has(a)) {
        this._held.delete(a);
        this._pendingUp.add(a);
        this._navRepeat.delete(a);
      }
    });

    target.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });

    target.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; this.mouse.moved = true;
      this.mouseMovedRecently = 1.2;
      this._setDevice('mouse');
    });
    target.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; this._anyKeyFlag = true; this._setDevice('mouse'); } });
    target.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    target.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; if (!t) return;
      this.mouse.x = t.clientX; this.mouse.y = t.clientY; this.mouse.inside = true; this.mouse.down = true;
      this._anyKeyFlag = true; this._setDevice('mouse');
    }, { passive: true });
    target.addEventListener('touchmove', (e) => {
      const t = e.touches[0]; if (!t) return;
      this.mouse.x = t.clientX; this.mouse.y = t.clientY; this.mouse.moved = true;
    }, { passive: true });
    target.addEventListener('touchend', () => { this.mouse.down = false; }, { passive: true });

    window.addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this._setDevice('gamepad');
      if (!this.padConnectedOnce) { this.padConnectedOnce = true; }
      if (this.onPadConnect) this.onPadConnect(e.gamepad);
    });
    window.addEventListener('gamepaddisconnected', () => { this.padIndex = -1; });
  }

  _setDevice(d) {
    this.usingGamepad = d === 'gamepad';
    if (this.lastDevice !== d) {
      this.lastDevice = d;
      if (this.onDeviceChange) this.onDeviceChange(d);
    }
  }

  _isKeyActionStillDown(action) {
    for (const code of this._keys) if (KEY_ACTIONS[code] === action) return true;
    return false;
  }

  releaseAll() {
    this._keys.clear();
    for (const a of this._held) this._pendingUp.add(a);
    this._held.clear();
    this._padHeld.clear();
    this._navRepeat.clear();
    this.move.x = 0; this.move.y = 0;
    this.stick.x = 0; this.stick.y = 0;
    this.mouse.down = false;
    this.triggerR = 0; this.triggerL = 0;
  }

  /** Which gamepad to read. Tests override this. */
  _gamepads() { return navigator.getGamepads ? navigator.getGamepads() : []; }

  _getPad() {
    const pads = this._gamepads();
    if (!pads) return null;
    if (this.padIndex >= 0 && pads[this.padIndex]) return pads[this.padIndex];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { this.padIndex = i; return pads[i]; }
    }
    return null;
  }

  /** Called once per frame BEFORE game logic. */
  update(dt) {
    this._down.clear();
    this._up.clear();
    for (const a of this._pendingDown) this._down.add(a);
    for (const a of this._pendingUp) this._up.add(a);
    this._pendingDown.clear();
    this._pendingUp.clear();
    this.mouseMovedRecently = Math.max(0, this.mouseMovedRecently - dt);

    // ---- keyboard movement vector
    let mx = 0, my = 0;
    if (this._held.has('left')) mx -= 1;
    if (this._held.has('right')) mx += 1;
    if (this._held.has('up')) my -= 1;
    if (this._held.has('down')) my += 1;

    // ---- gamepad
    const pad = this._getPad();
    const padNav = { x: 0, y: 0 };
    this.stick.x = 0; this.stick.y = 0;
    this.stick2.x = 0; this.stick2.y = 0;

    if (pad) {
      if (!this.padConnectedOnce) {
        this.padConnectedOnce = true;
        if (this.onPadConnect) this.onPadConnect(pad);
      }
      const [ax, ay] = deadzone2(pad.axes[0] ?? 0, pad.axes[1] ?? 0, STICK_DEAD);
      const [rx, ry] = deadzone2(pad.axes[2] ?? 0, pad.axes[3] ?? 0, STICK_DEAD);
      this.stick.x = ax; this.stick.y = ay;
      this.stick2.x = rx; this.stick2.y = ry;

      if (ax || ay) { mx = ax; my = ay; this._setDevice('gamepad'); }
      if (rx || ry) this._setDevice('gamepad');

      const btns = pad.buttons || [];
      for (const key in PAD_BUTTON_ACTIONS) {
        const i = Number(key);
        const b = btns[i];
        const val = b ? (b.pressed || b.value > 0.5) : false;
        const prev = this._prevPadButtons[i] || false;
        const action = PAD_BUTTON_ACTIONS[key];
        if (val && !prev) {
          this._down.add(action);
          this._held.add(action);
          this._padHeld.add(action);
          this._anyKeyFlag = true;
          this._setDevice('gamepad');
        } else if (!val && prev) {
          this._padHeld.delete(action);
          if (!this._isKeyActionStillDown(action)) { this._held.delete(action); this._up.add(action); this._navRepeat.delete(action); }
        }
        this._prevPadButtons[i] = val;
      }
      // triggers: RT = scratch (analogue), LT also scratch
      this.triggerR = btns[7] ? (btns[7].value ?? (btns[7].pressed ? 1 : 0)) : 0;
      this.triggerL = btns[6] ? (btns[6].value ?? (btns[6].pressed ? 1 : 0)) : 0;
      const trig = Math.max(this.triggerR, this.triggerL) > TRIGGER_DEAD;
      const prevTrig = !!this._prevPadButtons[107];
      if (trig && !prevTrig) { this._down.add('scratch'); this._held.add('scratch'); this._padHeld.add('scratch'); this._setDevice('gamepad'); }
      else if (!trig && prevTrig) { this._padHeld.delete('scratch'); if (!this._isKeyActionStillDown('scratch')) { this._held.delete('scratch'); this._up.add('scratch'); } }
      this._prevPadButtons[107] = trig;

      padNav.x = ax; padNav.y = ay;
    } else {
      if (this._prevPadButtons.length) {
        for (const a of this._padHeld) { if (!this._isKeyActionStillDown(a)) { this._held.delete(a); this._up.add(a); } }
        this._padHeld.clear();
      }
      this._prevPadButtons.length = 0;
      this.triggerR = 0; this.triggerL = 0;
    }

    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;

    // ---- nav repeat (held direction re-fires)
    for (const dir of NAV_ACTIONS) {
      const active = this._held.has(dir) || this._stickDir(padNav, dir);
      if (!active) { this._navRepeat.delete(dir); continue; }
      if (!this._navRepeat.has(dir)) {
        this._navRepeat.set(dir, REPEAT_DELAY);
        if (!this._down.has(dir)) this._down.add(dir); // stick-initiated
      } else {
        let t = this._navRepeat.get(dir) - dt;
        if (t <= 0) { t = REPEAT_RATE; this._down.add(dir); }
        this._navRepeat.set(dir, t);
      }
    }
  }

  _stickDir(nav, dir) {
    const T = 0.55;
    if (dir === 'left') return nav.x < -T;
    if (dir === 'right') return nav.x > T;
    if (dir === 'up') return nav.y < -T;
    if (dir === 'down') return nav.y > T;
    return false;
  }

  pressed(action) { return this._down.has(action); }
  released(action) { return this._up.has(action); }
  held(action) { return this._held.has(action); }
  consume(action) { this._down.delete(action); }

  anyKey() {
    const v = this._anyKeyFlag || this._down.size > 0;
    this._anyKeyFlag = false;
    return v;
  }

  /** Rumble if the pad supports it. */
  rumble(strong = 0.4, weak = 0.2, ms = 120) {
    if (!this.rumbleEnabled) return;
    const pad = this._getPad();
    if (!pad) return;
    const act = pad.vibrationActuator;
    if (act && act.playEffect) {
      try {
        act.playEffect('dual-rumble', {
          startDelay: 0, duration: ms,
          strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak),
        });
      } catch (_) { /* not supported */ }
    }
  }
}
InputSystem.prototype.rumbleEnabled = true;

/** Radial deadzone: treats the stick as a disc, not two independent axes. */
function deadzone2(x, y, dz) {
  const len = Math.hypot(x, y);
  if (len <= dz) return [0, 0];
  const scaled = Math.min(1, (len - dz) / (1 - dz));
  return [(x / len) * scaled, (y / len) * scaled];
}

export const Input = new InputSystem();
export { KEY_ACTIONS, PAD_BUTTON_ACTIONS };
