/* Emberfield Valley: shared namespace, constants and small helpers. */
var EF = {};

EF.C = {
  W: 640,                    // logical canvas width (CSS scales it up)
  H: 360,                    // logical canvas height
  TILE: 16,                  // tile size in logical pixels
  SAVE_KEY: 'emberfield-valley-save-v1',
  SECONDS_PER_MINUTE: 0.45,  // real seconds per in-game minute
  DAY_START: 6 * 60,         // 06:00
  PASS_OUT_AT: 26 * 60,      // 02:00 next morning: you collapse
  MAX_ENERGY: 270,
  MAX_HEALTH: 100,
  DAYS_PER_SEASON: 28,
  SEASONS: ['Spring', 'Summer', 'Autumn', 'Winter'],
  INV_SIZE: 30,
  HOTBAR: 10,
  MAX_STACK: 99,
  POINTS_PER_HEART: 250,
  MAX_HEARTS: 10,
  WALK_SPEED: 3.4,           // tiles per second
  START_GOLD: 500
};

EF.util = {
  clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
  key: function (x, y) { return x + ',' + y; },
  parseKey: function (k) { var p = k.split(','); return { x: +p[0], y: +p[1] }; },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  // Deterministic PRNG (mulberry32): generated mine floors stay identical on every visit.
  seeded: function (seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), s | 1);
      t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // Stable per-cell noise in [0, 1) used for tile decoration.
  hash2: function (x, y) {
    var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  formatTime: function (min) {
    var m = Math.floor(min) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + (h >= 12 ? ' PM' : ' AM');
  },

  // Word-wrap text for a canvas context whose font is already set.
  wrap: function (ctx, text, maxWidth) {
    var words = String(text).split(' ');
    var lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
};
