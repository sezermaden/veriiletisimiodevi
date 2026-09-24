// ============================================================
// Dog Quest - input (keyboard + gamepads, per-player devices)
// Device ids:
//   'any'  : single player - full keyboard + every gamepad
//   'kb'   : full keyboard (one keyboard player in co-op)
//   'kbA'  : left half of keyboard (two keyboard players)
//   'kbB'  : right half of keyboard (two keyboard players)
//   'pad0'..'pad3' : gamepads
// ============================================================
'use strict';

const KEYMAP = {
  kbA: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    attack: ['Space', 'KeyF'], roll: ['ShiftLeft', 'KeyG'], interact: ['KeyE'],
    spell: [['Digit1'], ['Digit2'], ['Digit3'], ['Digit4']],
    pause: ['Escape'], map: ['KeyM', 'Tab'],
  },
  kbB: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    attack: ['KeyJ', 'Numpad1', 'Numpad0'], roll: ['KeyK', 'Numpad2', 'ShiftRight'], interact: ['KeyL', 'Numpad3', 'Enter', 'NumpadEnter'],
    spell: [['KeyU', 'Numpad4'], ['KeyI', 'Numpad5'], ['KeyO', 'Numpad6'], ['KeyP', 'Numpad7']],
    pause: ['Backspace'], map: ['NumpadAdd'],
  },
};
KEYMAP.kb = {};
for (const k of Object.keys(KEYMAP.kbA)) {
  if (k === 'spell') KEYMAP.kb.spell = KEYMAP.kbA.spell.map((s, i) => s.concat(KEYMAP.kbB.spell[i]));
  else KEYMAP.kb[k] = KEYMAP.kbA[k].concat(KEYMAP.kbB[k]);
}
const LEFT_JOIN_KEYS = ['Space', 'KeyF', 'KeyE', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Digit1'];
const RIGHT_JOIN_KEYS = ['Enter', 'NumpadEnter', 'KeyJ', 'KeyK', 'KeyL', 'Numpad0', 'Numpad1', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Enter', 'ShiftLeft', 'ShiftRight']);

// gamepad button indices (standard mapping)
const PB = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const Input = {
  down: new Set(),
  pressed: new Set(),
  pads: [null, null, null, null],
  padBtn: [[], [], [], []],
  padPrev: [[], [], [], []],
  padAxes: [[0, 0], [0, 0], [0, 0], [0, 0]],
  padPrevDir: [{}, {}, {}, {}],
  lastType: 'kb',       // 'kb' or 'pad' - for prompt labels
  anyPressedFlag: false,
  menu: null,
  _repeat: { up: 0, down: 0, left: 0, right: 0 },
  _held: { up: false, down: false, left: false, right: false },
  onGesture: null,

  init() {
    window.addEventListener('keydown', e => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      this.lastType = 'kb';
      this.anyPressedFlag = true;
      if (this.onGesture) this.onGesture();
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); });
    window.addEventListener('mousedown', () => { this.anyPressedFlag = true; if (this.onGesture) this.onGesture(); });
    window.addEventListener('touchstart', () => { this.anyPressedFlag = true; if (this.onGesture) this.onGesture(); }, { passive: true });
    window.addEventListener('gamepadconnected', e => {
      if (typeof Game !== 'undefined' && Game.toast) Game.toast(`Gamepad ${e.gamepad.index + 1} connected`, '#7fd1ff');
    });
    window.addEventListener('gamepaddisconnected', e => {
      if (typeof Game !== 'undefined' && Game.toast) Game.toast(`Gamepad ${e.gamepad.index + 1} disconnected`, '#ff9b7f');
    });
  },

  update(dt) {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i++) {
      const gp = gps[i];
      this.pads[i] = gp && gp.connected ? gp : null;
      const cur = this.padBtn[i];
      if (!this.pads[i]) { cur.length = 0; this.padAxes[i] = [0, 0]; continue; }
      for (let b = 0; b < gp.buttons.length; b++) {
        const btn = gp.buttons[b];
        cur[b] = !!(btn && (btn.pressed || btn.value > 0.5));
        if (cur[b] && !this.padPrev[i][b]) { this.lastType = 'pad'; this.anyPressedFlag = true; }
      }
      let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      const mag = Math.hypot(ax, ay);
      if (mag < 0.25) { ax = 0; ay = 0; } else { const m = Math.min(1, (mag - 0.25) / 0.7) / mag; ax *= m; ay *= m; }
      if (ax || ay) this.lastType = 'pad';
      this.padAxes[i] = [ax, ay];
    }
    this.menu = this._buildMenu(dt);
  },

  endFrame() {
    this.pressed.clear();
    for (let i = 0; i < 4; i++) this.padPrev[i] = this.padBtn[i].slice();
    this.anyPressedFlag = false;
  },

  // clear all "pressed this frame" state (used when switching screens)
  consume() {
    this.pressed.clear();
    for (let i = 0; i < 4; i++) this.padPrev[i] = this.padBtn[i].slice();
    this.menu = this._emptyMenu();
  },

  kd(codes) { for (const c of codes) if (this.down.has(c)) return true; return false; },
  kp(codes) { for (const c of codes) if (this.pressed.has(c)) return true; return false; },
  pd(i, b) { return !!this.padBtn[i][b]; },
  pp(i, b) { return !!this.padBtn[i][b] && !this.padPrev[i][b]; },

  // ---- per player device state ----
  state(dev) {
    if (dev === 'any') {
      const s = this._kbState('kb');
      for (let i = 0; i < 4; i++) if (this.pads[i]) this._mergeState(s, this._padState(i));
      return this._finish(s);
    }
    if (dev && dev.startsWith('pad')) return this._finish(this._padState(+dev[3]));
    return this._finish(this._kbState(dev || 'kb'));
  },

  _blank() {
    return { mx: 0, my: 0, attack: false, attackHeld: false, roll: false, interact: false, spell: [false, false, false, false], pause: false, map: false };
  },
  _kbState(dev) {
    const m = KEYMAP[dev] || KEYMAP.kb;
    const s = this._blank();
    s.mx = (this.kd(m.right) ? 1 : 0) - (this.kd(m.left) ? 1 : 0);
    s.my = (this.kd(m.down) ? 1 : 0) - (this.kd(m.up) ? 1 : 0);
    s.attack = this.kp(m.attack); s.attackHeld = this.kd(m.attack);
    s.roll = this.kp(m.roll); s.interact = this.kp(m.interact);
    s.spell = m.spell.map(k => this.kp(k));
    s.pause = this.kp(m.pause); s.map = this.kp(m.map);
    return s;
  },
  _padState(i) {
    const s = this._blank();
    if (!this.pads[i]) return s;
    let [ax, ay] = this.padAxes[i];
    if (this.pd(i, PB.LEFT)) ax = -1; if (this.pd(i, PB.RIGHT)) ax = 1;
    if (this.pd(i, PB.UP)) ay = -1; if (this.pd(i, PB.DOWN)) ay = 1;
    s.mx = ax; s.my = ay;
    s.attack = this.pp(i, PB.A); s.attackHeld = this.pd(i, PB.A);
    s.roll = this.pp(i, PB.B); s.interact = this.pp(i, PB.X);
    s.spell = [this.pp(i, PB.LB), this.pp(i, PB.RB), this.pp(i, PB.LT), this.pp(i, PB.RT)];
    s.pause = this.pp(i, PB.START); s.map = this.pp(i, PB.BACK) || this.pp(i, PB.Y);
    return s;
  },
  _mergeState(a, b) {
    if (Math.abs(b.mx) > Math.abs(a.mx)) a.mx = b.mx;
    if (Math.abs(b.my) > Math.abs(a.my)) a.my = b.my;
    for (const k of ['attack', 'attackHeld', 'roll', 'interact', 'pause', 'map']) a[k] = a[k] || b[k];
    for (let i = 0; i < 4; i++) a.spell[i] = a.spell[i] || b.spell[i];
  },
  _finish(s) {
    const m = Math.hypot(s.mx, s.my);
    if (m > 1) { s.mx /= m; s.my /= m; }
    return s;
  },

  // ---- menu navigation (merged across every device) ----
  _emptyMenu() {
    return { up: false, down: false, left: false, right: false, confirm: false, back: false, tabL: false, tabR: false, pause: false, any: false };
  },
  _buildMenu(dt) {
    const m = this._emptyMenu();
    const held = {
      up: this.kd(['KeyW', 'ArrowUp']), down: this.kd(['KeyS', 'ArrowDown']),
      left: this.kd(['KeyA', 'ArrowLeft']), right: this.kd(['KeyD', 'ArrowRight']),
    };
    m.confirm = this.kp(['Enter', 'NumpadEnter', 'Space', 'KeyJ', 'KeyF']);
    m.back = this.kp(['Escape', 'Backspace', 'KeyK']);
    m.tabL = this.kp(['KeyQ', 'PageUp']);
    m.tabR = this.kp(['KeyE', 'PageDown']);
    m.pause = this.kp(['Escape']);
    for (let i = 0; i < 4; i++) {
      if (!this.pads[i]) continue;
      const [ax, ay] = this.padAxes[i];
      held.up = held.up || this.pd(i, PB.UP) || ay < -0.5;
      held.down = held.down || this.pd(i, PB.DOWN) || ay > 0.5;
      held.left = held.left || this.pd(i, PB.LEFT) || ax < -0.5;
      held.right = held.right || this.pd(i, PB.RIGHT) || ax > 0.5;
      m.confirm = m.confirm || this.pp(i, PB.A);
      m.back = m.back || this.pp(i, PB.B);
      m.tabL = m.tabL || this.pp(i, PB.LB);
      m.tabR = m.tabR || this.pp(i, PB.RB);
      m.pause = m.pause || this.pp(i, PB.START);
    }
    for (const d of ['up', 'down', 'left', 'right']) {
      if (held[d]) {
        if (!this._held[d]) { m[d] = true; this._repeat[d] = 0.38; this._held[d] = true; }
        else { this._repeat[d] -= dt; if (this._repeat[d] <= 0) { m[d] = true; this._repeat[d] = 0.11; } }
      } else this._held[d] = false;
    }
    m.any = m.confirm || m.back || this.anyPressedFlag;
    return m;
  },

  // Which devices pressed a "join" button this frame. Returns list of device ids.
  joinPresses() {
    const out = [];
    if (this.kp(LEFT_JOIN_KEYS)) out.push('kbA');
    if (this.kp(RIGHT_JOIN_KEYS)) out.push('kbB');
    for (let i = 0; i < 4; i++) if (this.pads[i] && (this.pp(i, PB.A) || this.pp(i, PB.START))) out.push('pad' + i);
    return out;
  },
  connectedPads() { return this.pads.filter(Boolean).length; },

  // Label for a player action (for on-screen prompts)
  label(dev, action) {
    let type = dev;
    if (dev === 'any') type = this.lastType === 'pad' ? 'pad' : 'kb';
    if (type && type.startsWith('pad')) {
      return { attack: 'A', roll: 'B', interact: 'X', spell0: 'LB', spell1: 'RB', spell2: 'LT', spell3: 'RT', pause: 'START', map: 'Y' }[action] || '?';
    }
    const L = {
      kb: { attack: 'J', roll: 'K', interact: 'E', spell0: '1', spell1: '2', spell2: '3', spell3: '4', pause: 'ESC', map: 'M' },
      kbA: { attack: 'SPACE', roll: 'SHIFT', interact: 'E', spell0: '1', spell1: '2', spell2: '3', spell3: '4', pause: 'ESC', map: 'M' },
      kbB: { attack: 'J', roll: 'K', interact: 'L', spell0: 'U', spell1: 'I', spell2: 'O', spell3: 'P', pause: 'ESC', map: 'NUM+' },
    };
    return (L[type] || L.kb)[action] || '?';
  },
  menuLabel(action) {
    if (this.lastType === 'pad') return { confirm: 'A', back: 'B', tabs: 'LB/RB' }[action];
    return { confirm: 'ENTER', back: 'ESC', tabs: 'Q/E' }[action];
  },
};
