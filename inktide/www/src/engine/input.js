/**
 * input.js — keyboard + mouse + gamepad in one place, with the three bugs that keep
 * showing up designed out rather than commented about.
 *
 * The bugs and why they happen:
 *
 *  1. "The camera keeps drifting down on its own."
 *     Two independent causes, both handled here:
 *     (a) Gamepad sticks never read exactly 0. A worn stick sits at 0.02–0.08 and every frame
 *         adds that to pitch. Fixed by a RADIAL deadzone plus a calibration pass that samples
 *         the resting position at startup and subtracts it.
 *     (b) Pointer-lock deltas accumulated in a variable that the frame loop reads but never
 *         zeroes. Fixed by consuming the buffer in update(): read then reset, always.
 *
 *  2. "Forward/back/left/right are inverted."
 *     three.js cameras look down their local -Z. Hand-written forward vectors get the sign
 *     wrong, and the right vector flips with the cross-product order. This module never asks
 *     you to write those: `move` is a normalized intent (x = strafe right, y = forward) and
 *     CameraRig turns it into world space with a single, tested implementation.
 *
 *  3. "Look speed is different on a 144 Hz monitor."
 *     Mouse deltas are ALREADY per-frame movement — multiplying them by dt makes sensitivity
 *     frame-rate dependent, which is the opposite of the intent. Gamepad axes are positions,
 *     so those DO need dt. This module keeps the two apart; you never multiply by dt yourself.
 *
 * Usage:
 *   const input = new Input(renderer.domElement);
 *   input.enablePointerLock();          // call from a click handler
 *   // frame loop:
 *   input.update(dt);
 *   rig.update(input, dt);
 */

export const DEFAULT_BINDINGS = {
  forward: { keys: ['KeyW', 'ArrowUp'], pad: [12] },        // 12 = dpad up
  back: { keys: ['KeyS', 'ArrowDown'], pad: [13] },
  left: { keys: ['KeyA', 'ArrowLeft'], pad: [14] },
  right: { keys: ['KeyD', 'ArrowRight'], pad: [15] },
  jump: { keys: ['Space'], pad: [0] },                      // A
  action: { keys: ['KeyE', 'Enter'], pad: [0] },
  cancel: { keys: ['Escape', 'Backspace'], pad: [1] },      // B
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], pad: [10] }, // L3
  pause: { keys: ['KeyP'], pad: [9] },                      // menu
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** A resting stick never sits this far out; anything beyond it is the player holding it. */
const CALIBRATION_MAX = 0.25;

/** Radial deadzone: treats the stick as a disc, not two independent axes. */
function deadzone2(x, y, dz) {
  const len = Math.hypot(x, y);
  if (len <= dz) return [0, 0];
  const scaled = (len - dz) / (1 - dz);          // rescale so motion starts smoothly at the edge
  return [(x / len) * scaled, (y / len) * scaled];
}

export class Input {
  /**
   * @param {HTMLElement} el              element that takes pointer lock (usually the canvas)
   * @param {object}      opts
   * @param {number}      opts.deadzone   stick deadzone, 0..1 (default 0.18)
   * @param {number}      opts.mouseSensitivity  radians per pixel (default 0.0022)
   * @param {number}      opts.padSensitivity    radians per second at full stick (default 2.8)
   * @param {boolean}     opts.invertY    invert vertical look (default false)
   */
  constructor(el, opts = {}) {
    this.el = el;
    this.deadzone = opts.deadzone ?? 0.18;
    this.mouseSensitivity = opts.mouseSensitivity ?? 0.0022;
    this.padSensitivity = opts.padSensitivity ?? 2.8;
    this.invertY = !!opts.invertY;
    this.bindings = { ...DEFAULT_BINDINGS, ...(opts.bindings || {}) };

    this.keys = new Set();
    this._pressedThisFrame = new Set();
    this._padPressed = new Set();
    this._padPrev = new Set();

    // accumulated pointer-lock movement, CONSUMED and zeroed every update()
    this._mouseDX = 0;
    this._mouseDY = 0;
    this.pointerLocked = false;

    // resting stick offsets, measured at first poll (worn sticks do not rest at 0)
    this._padCalib = null;

    /** normalized movement intent: x = strafe (+right), y = forward (+forward) */
    this.move = { x: 0, y: 0 };
    /** look delta for THIS frame in radians: x = yaw (+right), y = pitch (+up before invert) */
    this.look = { x: 0, y: 0 };
    /** which device produced the most recent input — for swapping key prompts on screen */
    this.lastDevice = 'keyboard';

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressedThisFrame.add(e.code);
      this.lastDevice = 'keyboard';
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this._mouseDX += e.movementX || 0;
      this._mouseDY += e.movementY || 0;
      this.lastDevice = 'mouse';
    };
    this._onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.el;
      // Leaving pointer lock leaves a half-applied delta behind; drop it or the camera jumps.
      this._mouseDX = this._mouseDY = 0;
    };
    this._onBlur = () => { this.keys.clear(); this._mouseDX = this._mouseDY = 0; };

    addEventListener('keydown', this._onKeyDown);
    addEventListener('keyup', this._onKeyUp);
    addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onLockChange);
    addEventListener('blur', this._onBlur);
  }

  enablePointerLock() {
    // unadjustedMovement bypasses OS mouse acceleration — steadier aim, and Chrome on Xbox
    // ignores it gracefully when unsupported
    const p = this.el.requestPointerLock?.({ unadjustedMovement: true });
    if (p?.catch) p.catch(() => this.el.requestPointerLock());
  }

  exitPointerLock() { document.exitPointerLock?.(); }

  /** Which gamepad to read. Overridable in tests. */
  _gamepads() { return navigator.getGamepads ? navigator.getGamepads() : []; }

  /**
   * Call once per frame BEFORE reading move/look.
   * @param {number} dt seconds since last frame
   */
  update(dt) {
    // ---- keyboard movement intent -------------------------------------------------
    let mx = 0, my = 0;
    if (this._anyKey('right')) mx += 1;
    if (this._anyKey('left')) mx -= 1;
    if (this._anyKey('forward')) my += 1;
    if (this._anyKey('back')) my -= 1;

    // ---- mouse look ---------------------------------------------------------------
    // NOT scaled by dt: these are already this frame's movement in pixels.
    let lx = this._mouseDX * this.mouseSensitivity;
    let ly = -this._mouseDY * this.mouseSensitivity;   // screen Y grows downward, pitch grows up
    this._mouseDX = 0;                                 // <- the fix for "keeps drifting"
    this._mouseDY = 0;

    // ---- gamepad ------------------------------------------------------------------
    this._padPrev = this._padPressed;
    this._padPressed = new Set();
    const pad = [...this._gamepads()].find((g) => g && g.connected);
    if (pad) {
      const ax = pad.axes || [];
      if (!this._padCalib && ax.length >= 4) {
        // Resting offsets — a stick sitting at 0.05 is hardware, not intent.
        // Only calibrate from a stick that is plausibly AT REST: if the player is holding it
        // when the game starts, treating that as zero bakes in a permanent offset and produces
        // exactly the drift this is meant to remove. Large readings just wait for the next frame.
        const plausible = ax.slice(0, 4).every((v) => Math.abs(v || 0) < CALIBRATION_MAX);
        if (plausible) this._padCalib = [ax[0] || 0, ax[1] || 0, ax[2] || 0, ax[3] || 0];
      }
      const c = this._padCalib || [0, 0, 0, 0];
      const [lsx, lsy] = deadzone2((ax[0] || 0) - c[0], (ax[1] || 0) - c[1], this.deadzone);
      const [rsx, rsy] = deadzone2((ax[2] || 0) - c[2], (ax[3] || 0) - c[3], this.deadzone);

      if (lsx || lsy) {
        mx += lsx;
        my += -lsy;                                    // stick Y is +down
        this.lastDevice = 'gamepad';
      }
      if (rsx || rsy) {
        // Sticks are POSITIONS, so this one IS scaled by dt.
        lx += rsx * this.padSensitivity * dt;
        ly += -rsy * this.padSensitivity * dt;
        this.lastDevice = 'gamepad';
      }
      for (let i = 0; i < (pad.buttons || []).length; i++) {
        if (pad.buttons[i]?.pressed) { this._padPressed.add(i); this.lastDevice = 'gamepad'; }
      }
    }

    // ---- finalize -----------------------------------------------------------------
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }             // diagonal must not be faster
    this.move.x = mx;
    this.move.y = my;
    this.look.x = lx;
    this.look.y = this.invertY ? -ly : ly;
  }

  /** Called at the END of the frame so justPressed() covers exactly one frame. */
  endFrame() { this._pressedThisFrame.clear(); }

  _anyKey(action) {
    const b = this.bindings[action];
    if (!b) return false;
    if (b.keys?.some((k) => this.keys.has(k))) return true;
    return !!b.pad?.some((i) => this._padPressed.has(i));
  }

  isDown(action) { return this._anyKey(action); }

  justPressed(action) {
    const b = this.bindings[action];
    if (!b) return false;
    if (b.keys?.some((k) => this._pressedThisFrame.has(k))) return true;
    return !!b.pad?.some((i) => this._padPressed.has(i) && !this._padPrev.has(i));
  }

  /** Re-sample the stick rest position — call it if a controller is swapped mid-session. */
  recalibrate() { this._padCalib = null; }

  dispose() {
    removeEventListener('keydown', this._onKeyDown);
    removeEventListener('keyup', this._onKeyUp);
    removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    removeEventListener('blur', this._onBlur);
  }

  // --- test hooks: let a harness drive the module without a real mouse or pad -------
  _injectMouse(dx, dy) { this._mouseDX += dx; this._mouseDY += dy; this.pointerLocked = true; }
  _injectPad(gamepad) { this._gamepads = () => [gamepad]; }
  _injectKey(code, down = true) { down ? (this.keys.add(code), this._pressedThisFrame.add(code)) : this.keys.delete(code); }
}
