/* =========================================================
   Scratch Fever — procedural audio. Every sound and every note is
   synthesised at runtime with the Web Audio API. No asset files.
   ========================================================= */

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function freq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const semis = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

/* ---------------------------------------------------------
   Music tracks — step sequencer data (16 steps per bar)
   --------------------------------------------------------- */
const X = 1, o = 0;
const TRACKS = {
  menu: {
    bpm: 92, swing: 0.14,
    bass: ['E1', null, null, 'E1', null, 'B1', null, null, 'C2', null, null, 'C2', null, 'D2', null, null],
    lead: ['E4', null, 'G4', null, 'B4', null, 'A4', null, 'G4', null, 'E4', null, 'D4', null, null, null],
    pad:  ['E2', null, null, null, null, null, null, null, 'C2', null, null, null, null, null, null, null],
    kick: [X,o,o,o, o,o,o,o, X,o,o,o, o,o,o,o],
    hat:  [o,o,X,o, o,o,X,o, o,o,X,o, o,o,X,o],
    snare:[o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,o],
    leadWave: 'triangle', bassWave: 'sawtooth', cutoff: 900,
  },
  play: {
    bpm: 112, swing: 0.1,
    bass: ['A1','A1', null,'A1', null,'A1', 'C2',null, 'F1','F1', null,'F1', 'G1',null,'G1',null],
    lead: ['A4',null,'C5','E5', null,'D5',null,'C5', 'B4',null,'A4',null, 'G4',null,'A4',null],
    pad:  ['A2',null,null,null, null,null,null,null, 'F2',null,null,null, null,null,null,null],
    kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,X,o],
    hat:  [o,X,o,X, o,X,o,X, o,X,o,X, o,X,X,X],
    snare:[o,o,o,o, X,o,o,o, o,o,o,o, X,o,o,X],
    leadWave: 'square', bassWave: 'sawtooth', cutoff: 1400,
  },
  jackpot: {
    bpm: 128, swing: 0,
    bass: ['C2','C2','C2','C2', 'G1','G1','G1','G1', 'A1','A1','A1','A1', 'F1','F1','F1','F1'],
    lead: ['C5','E5','G5','C6', null,'B5','G5',null, 'A5','C6','E6',null, 'F5','A5','C6',null],
    pad:  ['C3',null,null,null, null,null,null,null, 'A2',null,null,null, null,null,null,null],
    kick: [X,o,o,o, X,o,o,o, X,o,o,o, X,o,o,o],
    hat:  [X,X,X,X, X,X,X,X, X,X,X,X, X,X,X,X],
    snare:[o,o,o,o, X,o,o,o, o,o,o,o, X,o,X,o],
    leadWave: 'triangle', bassWave: 'sawtooth', cutoff: 2400,
  },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this.vol = { master: 0.8, sfx: 0.85, music: 0.4 };
    this.intensity = 0;
    this.duck = 1;              // temporary music attenuation (pause menu)
    this._track = null;
    this._step = 0;
    this._nextNoteTime = 0;
    this._timer = null;
    this._lastSfx = new Map();
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol.master;

    // gentle bus compression so explosions never clip
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.vol.sfx;
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0;

    // shared reverb for music depth
    this.verb = this.ctx.createConvolver();
    this.verb.buffer = this._makeImpulse(1.9, 2.6);
    this.verbSend = this.ctx.createGain();
    this.verbSend.gain.value = 0.24;

    this.sfxBus.connect(this.comp);
    this.musicBus.connect(this.comp);
    this.musicBus.connect(this.verbSend);
    this.verbSend.connect(this.verb);
    this.verb.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(this.ctx.destination);

    this.noise = this._makeNoise(2.0);
    this.ready = true;
  }

  _makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  setVolume(kind, value) {
    this.vol[kind] = value;
    if (!this.ready) return;
    if (kind === 'master') this.master.gain.value = value;
    if (kind === 'sfx') this.sfxBus.gain.value = value;
    if (kind === 'music') this._applyMusicGain();
  }

  _applyMusicGain() {
    if (!this.ready) return;
    const target = this._track ? this.vol.music * this.duck : 0;
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  /** Dip the music without touching the player's saved volume. */
  setDuck(v) {
    this.duck = Math.max(0, Math.min(1, v));
    this._applyMusicGain();
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  /* -------------------- primitive voices -------------------- */

  _tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, gain = 0.3, attack = 0.005, curve = 'exp', bus = null, detune = 0, pan = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== null) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(20, f1), t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); node = p;
    }
    osc.connect(g);
    node.connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    return { osc, g };
  }

  _noiseBurst({ dur = 0.15, gain = 0.3, type = 'highpass', f0 = 900, f1 = null, q = 1, bus = null, pan = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    if (f1 !== null) flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); node = p;
    }
    src.connect(flt); flt.connect(g); node.connect(bus || this.sfxBus);
    src.start(t, Math.random() * 1.0);
    src.stop(t + dur + 0.02);
  }

  /* -------------------- SFX -------------------- */

  play(name, opts = {}) {
    if (!this.ready || !this.enabled) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // throttle identical rapid-fire sounds so 6 weapons don't stack into mush
    const now = this.ctx.currentTime;
    const last = this._lastSfx.get(name) || 0;
    const minGap = opts.minGap ?? 0.028;
    if (now - last < minGap) return;
    this._lastSfx.set(name, now);

    const v = (opts.gain ?? 1);
    const pan = opts.pan ?? 0;
    const r = opts.rate ?? 1;
    const S = this;

    switch (name) {
      case 'scratch':
        // short foil rasp; called repeatedly while the brush moves
        S._noiseBurst({ dur: 0.07, gain: 0.07 * v, type: 'bandpass', f0: 2600 + Math.random() * 900, q: 1.4, pan });
        break;
      case 'scratch_start':
        S._noiseBurst({ dur: 0.12, gain: 0.1 * v, type: 'highpass', f0: 1800, f1: 900, pan });
        break;
      case 'reveal':
        S._tone({ type: 'triangle', f0: 880 * r, f1: 1320 * r, dur: 0.09, gain: 0.08 * v, pan });
        break;
      case 'reveal_all':
        S._noiseBurst({ dur: 0.45, gain: 0.16 * v, type: 'bandpass', f0: 1200, f1: 4200, q: 1.1 });
        S._tone({ type: 'triangle', f0: 520, f1: 1240, dur: 0.4, gain: 0.08 * v });
        break;
      case 'coin':
        S._tone({ type: 'sine', f0: 1480 * r, f1: 1900 * r, dur: 0.07, gain: 0.07 * v, pan, minGap: 0.01 });
        S._tone({ type: 'triangle', f0: 2960 * r, dur: 0.05, gain: 0.03 * v, pan });
        break;
      case 'win_small':
        [659.25, 783.99, 1046.5].forEach((f, i) =>
          setTimeout(() => S._tone({ type: 'triangle', f0: f, dur: 0.28, gain: 0.12 * v }), i * 70));
        break;
      case 'win_big':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
          setTimeout(() => S._tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.14 * v, attack: 0.01 }), i * 95));
        S._noiseBurst({ dur: 0.5, gain: 0.08 * v, type: 'highpass', f0: 4000 });
        break;
      case 'jackpot':
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
          setTimeout(() => { S._tone({ type: 'sawtooth', f0: f, dur: 0.7, gain: 0.1 * v, attack: 0.01 });
                             S._tone({ type: 'triangle', f0: f * 2, dur: 0.5, gain: 0.05 * v }); }, i * 110));
        S._tone({ type: 'sine', f0: 90, f1: 40, dur: 0.6, gain: 0.3 * v });
        break;
      case 'lose':
        S._tone({ type: 'triangle', f0: 420, f1: 300, dur: 0.22, gain: 0.07 * v });
        break;
      case 'ticket_in':
        S._noiseBurst({ dur: 0.18, gain: 0.12 * v, type: 'bandpass', f0: 900, f1: 2600, q: 1.3 });
        S._tone({ type: 'sine', f0: 300, f1: 520, dur: 0.14, gain: 0.05 * v });
        break;
      case 'ticket_out':
        S._noiseBurst({ dur: 0.2, gain: 0.1 * v, type: 'bandpass', f0: 2400, f1: 700, q: 1.3 });
        break;
      case 'buy':
        S._tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.13, gain: 0.13 * v });
        S._tone({ type: 'sine', f0: 1320, dur: 0.16, gain: 0.07 * v });
        break;
      case 'upgrade':
        [523, 784, 1046, 1568].forEach((f, i) =>
          setTimeout(() => S._tone({ type: 'triangle', f0: f, dur: 0.3, gain: 0.11 * v }), i * 55));
        break;
      case 'prestige':
        S._tone({ type: 'sawtooth', f0: 110, f1: 440, dur: 1.4, gain: 0.14 * v, attack: 0.2 });
        [440, 554.37, 659.25, 880, 1108.7, 1318.5].forEach((f, i) =>
          setTimeout(() => S._tone({ type: 'triangle', f0: f, dur: 0.8, gain: 0.12 * v }), 300 + i * 120));
        break;
      case 'bot':
        S._tone({ type: 'square', f0: 1200 * r, f1: 900 * r, dur: 0.04, gain: 0.035 * v, pan, minGap: 0.03 });
        break;
      case 'bot_on':
        S._tone({ type: 'square', f0: 440, f1: 880, dur: 0.18, gain: 0.08 * v });
        S._tone({ type: 'square', f0: 880, f1: 1760, dur: 0.18, gain: 0.05 * v });
        break;
      case 'error':
        S._tone({ type: 'square', f0: 200, f1: 130, dur: 0.16, gain: 0.11 * v });
        break;
      case 'ui_move':
        S._tone({ type: 'sine', f0: 720, dur: 0.045, gain: 0.055 * v, minGap: 0.02 });
        break;
      case 'ui_confirm':
        S._tone({ type: 'triangle', f0: 640, f1: 960, dur: 0.1, gain: 0.1 * v });
        break;
      case 'ui_back':
        S._tone({ type: 'triangle', f0: 520, f1: 320, dur: 0.11, gain: 0.09 * v });
        break;
      case 'start':
        [392, 523.25, 659.25, 783.99].forEach((f, i) =>
          setTimeout(() => S._tone({ type: 'square', f0: f, dur: 0.32, gain: 0.09 * v }), i * 90));
        break;
      default:
        break;
    }
  }

  /* -------------------- music -------------------- */

  startMusic(trackName) {
    if (!this.ready || !this.enabled) return;
    if (this._track === trackName) { this._applyMusicGain(); return; }
    this._track = trackName;
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.08;
    this._applyMusicGain();
    if (!this._timer) this._timer = setInterval(() => this._scheduler(), 25);
  }

  stopMusic() {
    this._track = null;
    if (this.ready) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }

  _scheduler() {
    if (!this._track || !this.ready) return;
    const tr = TRACKS[this._track];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 4;
    while (this._nextNoteTime < this.ctx.currentTime + 0.16) {
      this._playStep(tr, this._step % 16, this._nextNoteTime, stepDur);
      const swing = (this._step % 2 === 1) ? stepDur * tr.swing : -stepDur * tr.swing * 0;
      this._nextNoteTime += stepDur + swing;
      this._step++;
    }
  }

  _playStep(tr, i, t, stepDur) {
    const ctx = this.ctx;
    const bus = this.musicBus;
    const inten = this.intensity;

    const mkOsc = (type, f, dur, gain, filterHz) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      if (filterHz) {
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass'; flt.frequency.value = filterHz; flt.Q.value = 0.9;
        osc.connect(flt); flt.connect(g);
      } else osc.connect(g);
      g.connect(bus);
      osc.start(t); osc.stop(t + dur + 0.03);
    };

    // bass
    const bn = tr.bass[i];
    if (bn) mkOsc(tr.bassWave, freq(bn), stepDur * 2.0, 0.20, tr.cutoff * (0.75 + inten * 0.5));

    // lead (fades in with intensity)
    const ln = tr.lead[i];
    if (ln && (inten > 0.12 || this._track === 'menu' || this._track === 'jackpot')) {
      mkOsc(tr.leadWave, freq(ln), stepDur * 1.7, 0.075 + inten * 0.045, 2600);
      mkOsc(tr.leadWave, freq(ln) * 2, stepDur * 1.1, 0.022 + inten * 0.02, 3800);
    }

    // pad
    const pn = tr.pad[i];
    if (pn) {
      [1, 1.5, 2].forEach((mul, k) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq(pn) * mul;
        osc.detune.value = (k - 1) * 7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 8);
        osc.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + stepDur * 8 + 0.05);
      });
    }

    // drums
    if (tr.kick[i]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.42, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g); g.connect(bus);
      osc.start(t); osc.stop(t + 0.24);
    }
    if (tr.hat[i] && inten > 0.05) {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const flt = ctx.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 7200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055 + inten * 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(flt); flt.connect(g); g.connect(bus);
      src.start(t, Math.random()); src.stop(t + 0.07);
    }
    if (tr.snare[i]) {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1900; flt.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(flt); flt.connect(g); g.connect(bus);
      src.start(t, Math.random()); src.stop(t + 0.2);
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(220, t);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.1, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(g2); g2.connect(bus); osc.start(t); osc.stop(t + 0.12);
    }
  }
}

export const Sound = new AudioEngine();
