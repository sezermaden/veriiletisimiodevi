/* Tiny WebAudio synth: sound effects and looping chiptune tracks. No external files. */
(function () {
  var A = EF.audio = {};
  var ctx = null, master = null, musicBus = null, sfxBus = null;
  var musicOn = true, sfxOn = true;
  var trackName = null, step = 0, nextTime = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.3;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.5;
      sfxBus.connect(master);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function tone(type, f0, f1, t0, dur, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function noise(t0, dur, vol, dest) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    src.connect(g);
    g.connect(dest);
    src.start(t0);
  }

  var SFX = {
    till:     function (t, d) { noise(t, 0.08, 0.25, d); tone('triangle', 180, 120, t, 0.08, 0.2, d); },
    water:    function (t, d) { tone('sine', 600, 1000, t, 0.25, 0.15, d); tone('sine', 900, 700, t + 0.1, 0.2, 0.08, d); },
    hit:      function (t, d) { noise(t, 0.07, 0.3, d); tone('square', 220, 140, t, 0.07, 0.08, d); },
    chop:     function (t, d) { noise(t, 0.12, 0.35, d); tone('square', 160, 90, t, 0.12, 0.1, d); },
    pick:     function (t, d) { tone('square', 900, 700, t, 0.05, 0.08, d); noise(t + 0.01, 0.05, 0.2, d); },
    harvest:  function (t, d) { tone('triangle', 660, 660, t, 0.08, 0.2, d); tone('triangle', 880, 880, t + 0.08, 0.08, 0.2, d); tone('triangle', 1100, 1100, t + 0.16, 0.12, 0.2, d); },
    coin:     function (t, d) { tone('square', 1200, 1200, t, 0.06, 0.06, d); tone('square', 1600, 1600, t + 0.06, 0.1, 0.06, d); },
    select:   function (t, d) { tone('square', 600, 600, t, 0.04, 0.05, d); },
    confirm:  function (t, d) { tone('square', 700, 900, t, 0.06, 0.06, d); },
    cancel:   function (t, d) { tone('square', 320, 220, t, 0.07, 0.06, d); },
    error:    function (t, d) { tone('square', 150, 120, t, 0.18, 0.08, d); },
    cast:     function (t, d) { tone('sine', 400, 1200, t, 0.3, 0.12, d); },
    bite:     function (t, d) { tone('triangle', 900, 700, t, 0.1, 0.18, d); tone('triangle', 900, 700, t + 0.15, 0.1, 0.18, d); },
    splash:   function (t, d) { noise(t, 0.2, 0.2, d); },
    catch:    function (t, d) { [523, 659, 784, 1046].forEach(function (f, i) { tone('triangle', f, f, t + i * 0.09, 0.14, 0.18, d); }); },
    lost:     function (t, d) { tone('triangle', 330, 200, t, 0.3, 0.14, d); },
    hurt:     function (t, d) { tone('square', 300, 80, t, 0.2, 0.1, d); },
    slash:    function (t, d) { noise(t, 0.07, 0.2, d); tone('sawtooth', 800, 300, t, 0.07, 0.04, d); },
    heart:    function (t, d) { tone('triangle', 880, 880, t, 0.1, 0.15, d); tone('triangle', 1175, 1175, t + 0.1, 0.15, 0.15, d); },
    sleep:    function (t, d) { tone('triangle', 440, 330, t, 0.3, 0.15, d); tone('triangle', 330, 262, t + 0.3, 0.4, 0.15, d); },
    fanfare:  function (t, d) { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone('square', f, f, t + i * 0.12, 0.2, 0.1, d); }); },
    craft:    function (t, d) { tone('square', 440, 660, t, 0.1, 0.08, d); tone('square', 660, 880, t + 0.1, 0.1, 0.08, d); },
    step:     function (t, d) { noise(t, 0.03, 0.05, d); }
  };

  // Each track: 16 sixteenth-note steps per bar. 0 means rest.
  var TRACKS = {
    town:   { bpm: 112, lead: [523, 0, 659, 0, 784, 0, 659, 0, 698, 0, 880, 0, 659, 0, 523, 0], bass: [131, 0, 0, 0, 0, 0, 0, 0, 175, 0, 0, 0, 0, 0, 0, 0], wave: 'triangle' },
    farm:   { bpm: 96,  lead: [392, 0, 494, 0, 587, 0, 494, 0, 440, 0, 523, 0, 659, 0, 523, 0], bass: [98, 0, 0, 0, 0, 0, 0, 0, 110, 0, 0, 0, 0, 0, 0, 0], wave: 'triangle' },
    forest: { bpm: 88,  lead: [294, 0, 349, 0, 440, 0, 349, 0, 262, 0, 330, 0, 392, 0, 330, 0], bass: [73, 0, 0, 0, 0, 0, 0, 0, 65, 0, 0, 0, 0, 0, 0, 0], wave: 'triangle' },
    lake:   { bpm: 80,  lead: [330, 0, 392, 0, 494, 0, 392, 0, 294, 0, 349, 0, 440, 0, 349, 0], bass: [82, 0, 0, 0, 0, 0, 0, 0, 98, 0, 0, 0, 0, 0, 0, 0], wave: 'sine' },
    house:  { bpm: 76,  lead: [262, 0, 330, 0, 392, 0, 330, 0, 349, 0, 440, 0, 523, 0, 440, 0], bass: [131, 0, 0, 0, 0, 0, 0, 0, 175, 0, 0, 0, 0, 0, 0, 0], wave: 'sine' },
    mine:   { bpm: 66,  lead: [220, 0, 262, 0, 330, 0, 262, 0, 208, 0, 247, 0, 311, 0, 247, 0], bass: [110, 0, 0, 0, 0, 0, 0, 0, 104, 0, 0, 0, 0, 0, 0, 0], wave: 'sawtooth' }
  };

  A.unlock = function () { ensure(); };

  A.sfx = function (name) {
    if (!sfxOn || !ensure() || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.01, sfxBus);
  };

  A.music = function (name) {
    if (name === trackName) return;
    trackName = name || null;
    step = 0;
    if (ctx) nextTime = ctx.currentTime + 0.05;
  };

  A.toggle = function (kind) {
    if (kind === 'music') musicOn = !musicOn;
    else sfxOn = !sfxOn;
    return kind === 'music' ? musicOn : sfxOn;
  };
  A.isOn = function (kind) { return kind === 'music' ? musicOn : sfxOn; };

  A.update = function () {
    if (!ctx || !trackName || !musicOn || ctx.state !== 'running') return;
    var track = TRACKS[trackName];
    if (!track) return;
    var stepDur = 60 / track.bpm / 4;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.02;
    while (nextTime < ctx.currentTime + 0.15) {
      var lead = track.lead[step], bass = track.bass[step];
      if (lead) tone(track.wave, lead, lead, nextTime, stepDur * 0.9, 0.035, musicBus);
      if (bass) tone('sine', bass, bass, nextTime, stepDur * 3.5, 0.06, musicBus);
      step = (step + 1) % 16;
      nextTime += stepDur;
    }
  };
})();
