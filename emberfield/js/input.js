/* Unified keyboard + gamepad input: held / pressed edges, key-repeat for menus, and consume(). */
(function () {
  var DIGIT_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

  var BIND = {
    up:        { keys: ['ArrowUp', 'KeyW'], pad: [12], axis: [1, -1] },
    down:      { keys: ['ArrowDown', 'KeyS'], pad: [13], axis: [1, 1] },
    left:      { keys: ['ArrowLeft', 'KeyA'], pad: [14], axis: [0, -1] },
    right:     { keys: ['ArrowRight', 'KeyD'], pad: [15], axis: [0, 1] },
    confirm:   { keys: ['KeyZ', 'Enter', 'Space'], pad: [0] },          // A: talk, harvest, OK
    cancel:    { keys: ['KeyB', 'Backspace', 'Escape'], pad: [1] },     // B: back, close
    use:       { keys: ['KeyX'], pad: [2] },                             // X: use the selected tool or item
    inventory: { keys: ['KeyI'], pad: [3] },                             // Y: inventory
    prev:      { keys: ['KeyQ'], pad: [4] },                             // LB: previous hotbar slot
    next:      { keys: ['KeyE'], pad: [5] },                             // RB: next hotbar slot
    menu:      { keys: ['Escape', 'Tab'], pad: [9] },                    // Start: pause menu
    mute:      { keys: ['KeyM'], pad: [8] }                              // Select: toggle music
  };
  for (var i = 0; i < 10; i++) {
    BIND['slot' + i] = { keys: [DIGIT_CODES[i]], pad: [] };
  }
  var NAMES = Object.keys(BIND);
  var PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
  var AXIS_DEAD = 0.45;

  var down = {};
  var held = {}, prevHeld = {}, pressed = {}, repeatFire = {}, repeatT = {};

  window.addEventListener('keydown', function (e) {
    if (PREVENT.indexOf(e.code) >= 0) e.preventDefault();
    down[e.code] = true;
  });
  window.addEventListener('keyup', function (e) { delete down[e.code]; });
  window.addEventListener('blur', function () { down = {}; });

  function readPad() {
    var list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].connected !== false) return list[i];
    }
    return null;
  }

  function isHeld(name, pad) {
    var b = BIND[name];
    for (var k = 0; k < b.keys.length; k++) {
      if (down[b.keys[k]]) return true;
    }
    if (pad) {
      for (var p = 0; p < b.pad.length; p++) {
        var btn = pad.buttons[b.pad[p]];
        if (btn && btn.pressed) return true;
      }
      if (b.axis) {
        var v = pad.axes[b.axis[0]] || 0;
        if (b.axis[1] * v > AXIS_DEAD) return true;
      }
    }
    return false;
  }

  var EF_INPUT = EF.input = {
    update: function (dt) {
      var pad = readPad();
      for (var n = 0; n < NAMES.length; n++) {
        var name = NAMES[n];
        var h = isHeld(name, pad);
        held[name] = h;
        pressed[name] = h && !prevHeld[name];
        if (h) {
          if (pressed[name]) {
            repeatT[name] = 0.38;
            repeatFire[name] = true;
          } else {
            repeatT[name] -= dt;
            repeatFire[name] = false;
            if (repeatT[name] <= 0) {
              repeatFire[name] = true;
              repeatT[name] += 0.11;
            }
          }
        } else {
          repeatT[name] = 0;
          repeatFire[name] = false;
        }
        prevHeld[name] = h;
      }
    },
    held: function (name) { return !!held[name]; },
    pressed: function (name) { return !!pressed[name]; },
    // True on the first press and again while held (menus scroll with this).
    repeat: function (name) { return !!repeatFire[name]; },
    // Mark an action as handled this frame so no other layer reacts to it.
    consume: function (name) {
      pressed[name] = false;
      repeatFire[name] = false;
    },
    anyPressed: function () {
      for (var n = 0; n < NAMES.length; n++) {
        if (pressed[NAMES[n]]) return true;
      }
      return false;
    }
  };
})();
