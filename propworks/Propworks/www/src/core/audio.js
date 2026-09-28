/* Procedural audio: every sound in the game is synthesised with Web Audio at runtime.
   No sample files ship, so the package stays small and nothing can go missing.

   Buses:  sfx ─┐
           ui  ─┼─> master ─> compressor ─> destination
           music┤        └─> reverb send (shared convolver)
           voice┘
   Positional sounds go through an equal-power PannerNode fed from the camera. */
import { settings } from './settings.js';

const rand = (a, b) => a + Math.random() * (b - a);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this._voices = new Map();       // name -> active count, to cap floods (impacts)
    this._loops = new Set();
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.music = null;
    this.reverbAmount = 0.25;
  }

  /** Must be called from a user gesture (browsers block autoplay). Safe to call repeatedly. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.18;
    this.master = c.createGain();
    this.master.connect(this.comp).connect(c.destination);
    this.bus = {};
    for (const n of ['sfx', 'ui', 'music', 'voice']) { this.bus[n] = c.createGain(); this.bus[n].connect(this.master); }
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.2);
    this.reverbSend = c.createGain();
    this.reverbSend.gain.value = this.reverbAmount;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this._noise = this._makeNoise(2);
    this.applyVolumes();
    this.ready = true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.master, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(settings.sfx, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(settings.sfx * 0.8, t, 0.05);
    this.bus.music.gain.setTargetAtTime(settings.music * 0.6, t, 0.05);
    this.bus.voice.gain.setTargetAtTime(settings.voice, t, 0.05);
  }

  setReverb(amount) {
    this.reverbAmount = amount;
    if (this.reverbSend) this.reverbSend.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.3);
  }

  setListener(pos, forward, up) {
    this.listenerPos = pos;
    if (!this.ctx) return;
    const l = this.ctx.listener, t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t); l.positionY.setValueAtTime(pos.y, t); l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(forward.x, t); l.forwardY.setValueAtTime(forward.y, t); l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(up.x, t); l.upY.setValueAtTime(up.y, t); l.upZ.setValueAtTime(up.z, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /* ----------------------------------------------------------- building blocks */
  _makeNoise(seconds) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _impulse(seconds, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Output node for a sound: optional 3D panner, bus routing, reverb send. */
  _out(bus, opts = {}) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = opts.volume ?? 1;
    let head = g;
    if (opts.pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = opts.ref ?? 3;
      p.maxDistance = 400;
      p.rolloffFactor = opts.rolloff ?? 1.1;
      if (p.positionX) { p.positionX.value = opts.pos.x; p.positionY.value = opts.pos.y; p.positionZ.value = opts.pos.z; }
      else p.setPosition(opts.pos.x, opts.pos.y, opts.pos.z);
      g.connect(p);
      p.connect(this.bus[bus]);
      if (opts.reverb !== 0) { const s = c.createGain(); s.gain.value = opts.reverb ?? 0.5; p.connect(s).connect(this.reverbSend); }
      head.panner = p;
    } else {
      g.connect(this.bus[bus]);
      if (opts.reverb) { const s = c.createGain(); s.gain.value = opts.reverb; g.connect(s).connect(this.reverbSend); }
    }
    return g;
  }

  _env(param, t, a, peak, d, sustain = 0.0001) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, a));
    param.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  }

  _osc(type, freq, t, dur, out, { gain = 0.3, a = 0.005, slide = null, detune = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
    const g = c.createGain();
    this._env(g.gain, t, a, gain, dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }

  _noiseBurst(t, dur, out, { gain = 0.4, type = 'bandpass', freq = 1000, q = 1, a = 0.002, sweep = null } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this._noise;
    s.loop = true;
    const off = Math.random() * 1.5;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t + dur);
    const g = c.createGain();
    this._env(g.gain, t, a, gain, dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, off); s.stop(t + a + dur + 0.05);
    return s;
  }

  /** Metallic clang: inharmonic partials with individual decays. */
  _clang(t, base, dur, out, gain = 0.25) {
    const ratios = [1, 2.76, 5.4, 8.93, 13.3];
    ratios.forEach((r, i) => this._osc('sine', base * r * rand(0.98, 1.02), t, dur / (1 + i * 0.6), out, { gain: gain / (1 + i * 0.7), a: 0.001 }));
  }

  /* ----------------------------------------------------------- public API */
  play(name, opts = {}) {
    if (!this.ready) return;
    const def = SOUNDS[name];
    if (!def) return;
    const cap = def.cap ?? 8;
    const n = this._voices.get(name) || 0;
    if (n >= cap) return;
    if (opts.pos) {
      const dx = opts.pos.x - this.listenerPos.x, dy = opts.pos.y - this.listenerPos.y, dz = opts.pos.z - this.listenerPos.z;
      if (dx * dx + dy * dy + dz * dz > 160 * 160) return;
    }
    this._voices.set(name, n + 1);
    const t = this.ctx.currentTime + 0.005;
    const out = this._out(def.bus || 'sfx', opts);
    const dur = def.fn(this, t, out, opts) || 0.5;
    setTimeout(() => {
      this._voices.set(name, Math.max(0, (this._voices.get(name) || 1) - 1));
      try { out.disconnect(); out.panner?.disconnect(); } catch { /* already gone */ }
    }, (dur + 0.4) * 1000);
  }

  /** Continuous sound. Returns a handle with set(level 0..1, pitch) / move(pos) / stop(). */
  loop(name, opts = {}) {
    if (!this.ready) return NULL_LOOP;
    const def = LOOPS[name];
    if (!def) return NULL_LOOP;
    const out = this._out(def.bus || 'sfx', { ...opts, volume: 0 });
    const inner = def.fn(this, out, opts);
    const c = this.ctx;
    const h = {
      out, level: 0,
      set: (level, pitch = 1) => {
        h.level = level;
        out.gain.setTargetAtTime(level * (opts.volume ?? 1), c.currentTime, 0.06);
        inner.pitch?.(pitch);
      },
      move: (pos) => {
        const p = out.panner;
        if (!p) return;
        if (p.positionX) { p.positionX.setTargetAtTime(pos.x, c.currentTime, 0.02); p.positionY.setTargetAtTime(pos.y, c.currentTime, 0.02); p.positionZ.setTargetAtTime(pos.z, c.currentTime, 0.02); }
        else p.setPosition(pos.x, pos.y, pos.z);
      },
      stop: () => {
        out.gain.setTargetAtTime(0, c.currentTime, 0.05);
        setTimeout(() => { inner.stop?.(); try { out.disconnect(); out.panner?.disconnect(); } catch { /* */ } }, 400);
        this._loops.delete(h);
      },
    };
    this._loops.add(h);
    return h;
  }

  stopAllLoops() { for (const l of [...this._loops]) l.stop(); }

  /** Pause/resume all game audio (pause menu). Music keeps its own state. */
  suspendSfx(on) {
    if (!this.ready) return;
    this.bus.sfx.gain.setTargetAtTime(on ? 0 : settings.sfx, this.ctx.currentTime, 0.05);
  }

  /** Impact sound picked by surface material and intensity 0..1. */
  impact(material, intensity, pos) {
    const v = Math.min(1, intensity);
    if (v < 0.04) return;
    const name = { metal: 'impact_metal', wood: 'impact_wood', glass: 'impact_glass', plastic: 'impact_plastic', flesh: 'impact_flesh', rubber: 'impact_plastic', concrete: 'impact_concrete' }[material] || 'impact_concrete';
    this.play(name, { pos, volume: 0.25 + v * 0.9, intensity: v });
  }
}

const NULL_LOOP = { set() {}, move() {}, stop() {}, level: 0 };

/* ======================================================================= one-shots */
const SOUNDS = {
  ui_move: { bus: 'ui', fn: (a, t, o) => { a._osc('sine', 1200, t, 0.05, o, { gain: 0.12, slide: 1500 }); return 0.1; } },
  ui_select: { bus: 'ui', fn: (a, t, o) => { a._osc('triangle', 660, t, 0.08, o, { gain: 0.2 }); a._osc('triangle', 990, t + 0.06, 0.12, o, { gain: 0.18 }); return 0.25; } },
  ui_back: { bus: 'ui', fn: (a, t, o) => { a._osc('triangle', 700, t, 0.08, o, { gain: 0.18, slide: 420 }); return 0.15; } },
  ui_error: { bus: 'ui', fn: (a, t, o) => { a._osc('square', 140, t, 0.16, o, { gain: 0.12 }); a._osc('square', 110, t + 0.08, 0.18, o, { gain: 0.1 }); return 0.3; } },
  hint: { bus: 'ui', fn: (a, t, o) => { a._osc('sine', 880, t, 0.1, o, { gain: 0.14 }); a._osc('sine', 1320, t + 0.08, 0.2, o, { gain: 0.12 }); return 0.35; } },
  notify: { bus: 'ui', fn: (a, t, o) => { a._osc('sine', 520, t, 0.06, o, { gain: 0.15 }); a._osc('sine', 780, t + 0.05, 0.1, o, { gain: 0.12 }); return 0.2; } },
  undo: { bus: 'ui', fn: (a, t, o) => { a._osc('sine', 900, t, 0.12, o, { gain: 0.14, slide: 450 }); a._noiseBurst(t, 0.1, o, { gain: 0.05, freq: 3000 }); return 0.2; } },
  objective: { bus: 'ui', fn: (a, t, o) => { [523, 659, 784, 1046].forEach((f, i) => a._osc('triangle', f, t + i * 0.07, 0.35, o, { gain: 0.12 })); return 0.7; } },
  checkpoint: { bus: 'ui', fn: (a, t, o) => { a._osc('sine', 440, t, 0.3, o, { gain: 0.15 }); a._osc('sine', 660, t + 0.1, 0.4, o, { gain: 0.12 }); return 0.6; } },
  terminal: { bus: 'ui', fn: (a, t, o) => { for (let i = 0; i < 6; i++) a._osc('square', rand(900, 2200), t + i * 0.04, 0.03, o, { gain: 0.05 }); return 0.4; } },

  step: { cap: 4, fn: (a, t, o, p) => {
    const m = p.surface || 'concrete';
    if (m === 'grass') a._noiseBurst(t, 0.09, o, { gain: 0.16, type: 'highpass', freq: 1800, q: 0.5 });
    else if (m === 'metal') { a._noiseBurst(t, 0.05, o, { gain: 0.15, freq: 2500, q: 2 }); a._clang(t, rand(380, 460), 0.18, o, 0.035); }
    else if (m === 'wood') { a._noiseBurst(t, 0.05, o, { gain: 0.14, freq: 700, q: 1.5 }); a._osc('sine', rand(140, 170), t, 0.07, o, { gain: 0.12 }); }
    else if (m === 'water') a._noiseBurst(t, 0.18, o, { gain: 0.2, type: 'lowpass', freq: 1400, sweep: 400 });
    else { a._noiseBurst(t, 0.045, o, { gain: 0.18, freq: rand(1100, 1500), q: 1.2 }); a._osc('sine', 90, t, 0.05, o, { gain: 0.12 }); }
    return 0.25; } },
  jump: { fn: (a, t, o) => { a._noiseBurst(t, 0.06, o, { gain: 0.1, freq: 900 }); return 0.1; } },
  land: { fn: (a, t, o, p) => { const v = p.intensity ?? 0.5; a._noiseBurst(t, 0.12, o, { gain: 0.15 + v * 0.3, type: 'lowpass', freq: 900 }); a._osc('sine', 70, t, 0.14, o, { gain: 0.2 + v * 0.3, slide: 45 }); return 0.2; } },
  hurt: { fn: (a, t, o) => { a._osc('sawtooth', 220, t, 0.18, o, { gain: 0.14, slide: 120 }); a._noiseBurst(t, 0.12, o, { gain: 0.2, type: 'lowpass', freq: 600 }); return 0.3; } },
  flatline: { fn: (a, t, o) => { a._osc('sine', 1000, t, 2.2, o, { gain: 0.15, a: 0.01 }); return 2.4; } },
  heal: { fn: (a, t, o) => { [440, 554, 659].forEach((f, i) => a._osc('sine', f, t + i * 0.06, 0.3, o, { gain: 0.12 })); return 0.5; } },
  armor: { fn: (a, t, o) => { a._osc('sawtooth', 300, t, 0.35, o, { gain: 0.08, slide: 900 }); a._osc('sine', 600, t, 0.35, o, { gain: 0.1, slide: 1500 }); return 0.4; } },
  pickup: { fn: (a, t, o) => { a._osc('triangle', 880, t, 0.05, o, { gain: 0.12 }); a._osc('triangle', 1320, t + 0.05, 0.1, o, { gain: 0.1 }); return 0.2; } },
  ammo: { fn: (a, t, o) => { a._noiseBurst(t, 0.03, o, { gain: 0.2, freq: 3200, q: 3 }); a._noiseBurst(t + 0.07, 0.03, o, { gain: 0.2, freq: 2600, q: 3 }); return 0.15; } },

  impact_concrete: { cap: 6, fn: (a, t, o, p) => { const v = p.intensity ?? 0.5; a._noiseBurst(t, 0.06 + v * 0.1, o, { gain: 0.3, freq: 500 + v * 900, q: 0.9 }); a._osc('sine', rand(60, 90), t, 0.08 + v * 0.1, o, { gain: 0.25 * v }); return 0.3; } },
  impact_wood: { cap: 6, fn: (a, t, o, p) => { const v = p.intensity ?? 0.5; const f = rand(180, 260); a._osc('triangle', f, t, 0.12 + v * 0.08, o, { gain: 0.3, slide: f * 0.8 }); a._osc('sine', f * 2.3, t, 0.07, o, { gain: 0.12 }); a._noiseBurst(t, 0.05, o, { gain: 0.18 * v + 0.05, freq: 900, q: 1.4 }); return 0.3; } },
  impact_metal: { cap: 6, fn: (a, t, o, p) => { const v = p.intensity ?? 0.5; a._clang(t, rand(220, 520) * (v > 0.6 ? 0.7 : 1), 0.35 + v * 0.8, o, 0.12 + v * 0.12); a._noiseBurst(t, 0.03, o, { gain: 0.2, freq: 4000, q: 1 }); return 1.2; } },
  impact_plastic: { cap: 6, fn: (a, t, o) => { a._osc('square', rand(380, 520), t, 0.05, o, { gain: 0.08 }); a._noiseBurst(t, 0.04, o, { gain: 0.15, freq: 2000, q: 2 }); return 0.15; } },
  impact_glass: { cap: 5, fn: (a, t, o) => { for (let i = 0; i < 3; i++) a._osc('sine', rand(2400, 4800), t + i * 0.01, 0.25, o, { gain: 0.05 }); a._noiseBurst(t, 0.04, o, { gain: 0.12, type: 'highpass', freq: 4000 }); return 0.35; } },
  impact_flesh: { cap: 5, fn: (a, t, o) => { a._noiseBurst(t, 0.09, o, { gain: 0.35, type: 'lowpass', freq: 500 }); a._osc('sine', 80, t, 0.1, o, { gain: 0.3, slide: 50 }); return 0.2; } },
  glass_break: { cap: 4, fn: (a, t, o) => { for (let i = 0; i < 14; i++) a._osc('sine', rand(1800, 6000), t + rand(0, 0.35), rand(0.08, 0.4), o, { gain: 0.05 }); a._noiseBurst(t, 0.5, o, { gain: 0.3, type: 'highpass', freq: 2500, sweep: 6000 }); return 0.9; } },
  bullet_impact: { cap: 8, fn: (a, t, o) => { a._noiseBurst(t, 0.05, o, { gain: 0.25, freq: rand(1800, 3000), q: 1.5 }); if (Math.random() < 0.3) a._osc('sine', rand(2500, 4500), t, 0.12, o, { gain: 0.04, slide: rand(1500, 2500) }); return 0.2; } },

  spawn: { fn: (a, t, o) => { a._osc('sine', 300, t, 0.18, o, { gain: 0.12, slide: 900 }); a._noiseBurst(t, 0.15, o, { gain: 0.06, freq: 5000, sweep: 1500 }); return 0.25; } },
  physgun_grab: { fn: (a, t, o) => { a._osc('sawtooth', 110, t, 0.12, o, { gain: 0.12, slide: 220 }); a._osc('sine', 880, t, 0.15, o, { gain: 0.08, slide: 440 }); return 0.2; } },
  physgun_drop: { fn: (a, t, o) => { a._osc('sine', 500, t, 0.14, o, { gain: 0.1, slide: 160 }); return 0.2; } },
  physgun_freeze: { fn: (a, t, o) => { a._osc('sine', 1600, t, 0.4, o, { gain: 0.1, slide: 700 }); a._noiseBurst(t, 0.3, o, { gain: 0.08, type: 'highpass', freq: 5000 }); a._osc('triangle', 2400, t + 0.05, 0.25, o, { gain: 0.05 }); return 0.5; } },
  physgun_unfreeze: { fn: (a, t, o) => { a._osc('sine', 700, t, 0.3, o, { gain: 0.1, slide: 1500 }); return 0.4; } },
  toolgun_fire: { fn: (a, t, o) => {
    // The sandbox "zap": a bright downward chirp over a short noise crack.
    a._osc('sawtooth', 2400, t, 0.09, o, { gain: 0.14, slide: 300 });
    a._osc('square', 1200, t, 0.06, o, { gain: 0.06, slide: 200 });
    a._noiseBurst(t, 0.07, o, { gain: 0.14, type: 'highpass', freq: 3000 });
    return 0.2; } },
  toolgun_error: { fn: (a, t, o) => { a._osc('square', 180, t, 0.1, o, { gain: 0.1 }); return 0.15; } },
  remove: { fn: (a, t, o) => { a._osc('sawtooth', 1800, t, 0.6, o, { gain: 0.07, slide: 80 }); a._noiseBurst(t, 0.6, o, { gain: 0.12, freq: 3000, q: 4, sweep: 300 }); return 0.8; } },
  weld: { fn: (a, t, o) => { a._noiseBurst(t, 0.18, o, { gain: 0.18, freq: 5000, q: 3 }); a._clang(t, 900, 0.2, o, 0.05); return 0.3; } },
  rope: { fn: (a, t, o) => { a._noiseBurst(t, 0.2, o, { gain: 0.15, freq: 400, q: 3, sweep: 900 }); return 0.3; } },
  balloon_inflate: { fn: (a, t, o) => { a._noiseBurst(t, 0.3, o, { gain: 0.12, freq: 1200, q: 2, sweep: 3000 }); a._osc('sine', 300, t, 0.3, o, { gain: 0.05, slide: 700 }); return 0.4; } },
  balloon_pop: { fn: (a, t, o) => { a._noiseBurst(t, 0.08, o, { gain: 0.5, type: 'highpass', freq: 800 }); a._osc('sine', 120, t, 0.05, o, { gain: 0.3 }); return 0.2; } },

  pistol: { fn: (a, t, o) => { a._noiseBurst(t, 0.12, o, { gain: 0.6, type: 'lowpass', freq: 3500, sweep: 400 }); a._osc('square', 180, t, 0.06, o, { gain: 0.25, slide: 60 }); a._noiseBurst(t + 0.01, 0.35, o, { gain: 0.08, type: 'lowpass', freq: 800 }); return 0.5; } },
  smg: { cap: 6, fn: (a, t, o) => { a._noiseBurst(t, 0.08, o, { gain: 0.45, freq: 2200, q: 0.6, sweep: 500 }); a._osc('square', 150, t, 0.04, o, { gain: 0.2, slide: 70 }); return 0.2; } },
  shotgun: { fn: (a, t, o) => { a._noiseBurst(t, 0.35, o, { gain: 0.8, type: 'lowpass', freq: 2500, sweep: 200 }); a._osc('sine', 70, t, 0.2, o, { gain: 0.5, slide: 35 }); return 0.6; } },
  pump: { fn: (a, t, o) => { a._noiseBurst(t, 0.05, o, { gain: 0.25, freq: 1500, q: 2 }); a._noiseBurst(t + 0.18, 0.06, o, { gain: 0.3, freq: 1100, q: 2 }); return 0.35; } },
  reload: { fn: (a, t, o) => { a._noiseBurst(t, 0.04, o, { gain: 0.2, freq: 2800, q: 3 }); a._noiseBurst(t + 0.35, 0.05, o, { gain: 0.25, freq: 1800, q: 3 }); a._clang(t + 0.36, 1400, 0.1, o, 0.03); return 0.5; } },
  dryfire: { fn: (a, t, o) => { a._noiseBurst(t, 0.02, o, { gain: 0.2, freq: 3500, q: 5 }); return 0.1; } },
  swing: { fn: (a, t, o) => { a._noiseBurst(t, 0.18, o, { gain: 0.2, freq: 600, q: 1, sweep: 1800 }); return 0.25; } },
  grav_punt: { fn: (a, t, o) => { a._osc('sawtooth', 90, t, 0.25, o, { gain: 0.3, slide: 40 }); a._noiseBurst(t, 0.2, o, { gain: 0.35, freq: 900, sweep: 150 }); a._osc('sine', 1400, t, 0.15, o, { gain: 0.08, slide: 300 }); return 0.35; } },
  grav_pickup: { fn: (a, t, o) => { a._osc('sine', 200, t, 0.2, o, { gain: 0.15, slide: 500 }); return 0.25; } },
  grenade_bounce: { cap: 4, fn: (a, t, o) => { a._clang(t, 1200, 0.1, o, 0.06); return 0.2; } },
  pin: { fn: (a, t, o) => { a._clang(t, 2600, 0.12, o, 0.05); return 0.2; } },
  explosion: { cap: 4, fn: (a, t, o, p) => {
    const big = p.big ? 1.4 : 1;
    a._noiseBurst(t, 1.4 * big, o, { gain: 0.9, type: 'lowpass', freq: 1800, sweep: 60, a: 0.004 });
    a._osc('sine', 60, t, 0.9 * big, o, { gain: 0.9, slide: 22 });
    a._noiseBurst(t, 0.12, o, { gain: 0.6, type: 'highpass', freq: 1500 });
    for (let i = 0; i < 5; i++) a._noiseBurst(t + rand(0.2, 0.9), 0.08, o, { gain: 0.08, freq: rand(1500, 4000), q: 2 });
    return 2; } },
  fire_ignite: { fn: (a, t, o) => { a._noiseBurst(t, 0.5, o, { gain: 0.3, type: 'lowpass', freq: 400, sweep: 1600 }); return 0.6; } },

  null_growl: { cap: 3, fn: (a, t, o) => { const f = rand(70, 110); a._osc('sawtooth', f, t, 0.7, o, { gain: 0.12, slide: f * 0.7, a: 0.05 }); for (let i = 0; i < 8; i++) a._osc('square', rand(200, 2000), t + i * 0.06, 0.03, o, { gain: 0.04 }); return 0.9; } },
  null_attack: { cap: 3, fn: (a, t, o) => { a._osc('sawtooth', 160, t, 0.25, o, { gain: 0.15, slide: 60 }); a._noiseBurst(t, 0.2, o, { gain: 0.2, freq: 2000, q: 3, sweep: 300 }); return 0.3; } },
  null_die: { cap: 3, fn: (a, t, o) => { for (let i = 0; i < 14; i++) a._osc('square', rand(100, 3000), t + i * 0.035, 0.03, o, { gain: 0.07 }); a._osc('sawtooth', 300, t, 0.6, o, { gain: 0.1, slide: 30 }); return 0.8; } },
  glitch: { cap: 2, fn: (a, t, o) => { for (let i = 0; i < 10; i++) a._osc(Math.random() < 0.5 ? 'square' : 'sawtooth', rand(60, 4000), t + i * 0.025, 0.02, o, { gain: 0.06 }); return 0.35; } },
  zap: { cap: 3, fn: (a, t, o) => { a._noiseBurst(t, 0.2, o, { gain: 0.3, freq: 3000, q: 6, sweep: 800 }); a._osc('sawtooth', 110, t, 0.2, o, { gain: 0.1 }); return 0.3; } },
  drone_shot: { cap: 4, fn: (a, t, o) => { a._osc('square', 900, t, 0.15, o, { gain: 0.08, slide: 200 }); return 0.2; } },
  boss_roar: { fn: (a, t, o) => { a._osc('sawtooth', 55, t, 2.2, o, { gain: 0.3, slide: 38, a: 0.2 }); a._osc('sawtooth', 82, t, 2.0, o, { gain: 0.15, slide: 50, a: 0.2 }); a._noiseBurst(t, 2, o, { gain: 0.2, freq: 400, q: 2, a: 0.2 }); for (let i = 0; i < 20; i++) a._osc('square', rand(100, 3000), t + i * 0.08, 0.04, o, { gain: 0.05 }); return 2.4; } },
  boss_slam: { fn: (a, t, o) => { a._osc('sine', 45, t, 1.2, o, { gain: 0.9, slide: 25 }); a._noiseBurst(t, 0.8, o, { gain: 0.6, type: 'lowpass', freq: 700, sweep: 80 }); return 1.4; } },
  pylon_break: { fn: (a, t, o) => { a._clang(t, 160, 2, o, 0.2); a._noiseBurst(t, 1.2, o, { gain: 0.5, type: 'lowpass', freq: 2500, sweep: 100 }); a._osc('sawtooth', 400, t, 1.4, o, { gain: 0.1, slide: 40 }); return 2.2; } },
  shield_hit: { cap: 3, fn: (a, t, o) => { a._osc('sine', 1800, t, 0.25, o, { gain: 0.1, slide: 900 }); a._noiseBurst(t, 0.1, o, { gain: 0.1, type: 'highpass', freq: 5000 }); return 0.3; } },

  door_open: { fn: (a, t, o) => { a._noiseBurst(t, 0.9, o, { gain: 0.15, freq: 300, q: 3, sweep: 600 }); a._osc('sawtooth', 60, t, 0.9, o, { gain: 0.06 }); a._clang(t + 0.85, 200, 0.4, o, 0.1); return 1.3; } },
  button: { fn: (a, t, o) => { a._noiseBurst(t, 0.03, o, { gain: 0.3, freq: 2500, q: 3 }); a._osc('sine', 1000, t + 0.03, 0.08, o, { gain: 0.1 }); return 0.15; } },
  denied: { fn: (a, t, o) => { a._osc('square', 220, t, 0.15, o, { gain: 0.1 }); a._osc('square', 180, t + 0.18, 0.2, o, { gain: 0.1 }); return 0.45; } },
  power_up: { fn: (a, t, o) => { a._osc('sawtooth', 80, t, 1.2, o, { gain: 0.15, slide: 400, a: 0.05 }); a._osc('sine', 160, t, 1.2, o, { gain: 0.15, slide: 800, a: 0.05 }); return 1.4; } },
  power_down: { fn: (a, t, o) => { a._osc('sawtooth', 400, t, 1.4, o, { gain: 0.15, slide: 50 }); return 1.5; } },
  alarm: { fn: (a, t, o) => { for (let i = 0; i < 3; i++) { a._osc('square', 660, t + i * 0.5, 0.22, o, { gain: 0.08 }); a._osc('square', 520, t + i * 0.5 + 0.25, 0.22, o, { gain: 0.08 }); } return 1.6; } },
  splash: { cap: 3, fn: (a, t, o, p) => { const v = p.intensity ?? 0.6; a._noiseBurst(t, 0.5, o, { gain: 0.3 * v + 0.1, type: 'lowpass', freq: 2500, sweep: 300 }); a._noiseBurst(t + 0.05, 0.3, o, { gain: 0.1, type: 'highpass', freq: 3000 }); return 0.6; } },
  thud: { cap: 3, fn: (a, t, o) => { a._osc('sine', 55, t, 0.4, o, { gain: 0.5, slide: 35 }); return 0.5; } },
  teleport: { fn: (a, t, o) => { a._osc('sine', 200, t, 0.6, o, { gain: 0.15, slide: 2000 }); a._noiseBurst(t, 0.6, o, { gain: 0.1, freq: 2000, q: 5, sweep: 8000 }); return 0.7; } },
};

/* ======================================================================= loops */
function droneLoop(a, out, { type = 'sawtooth', freq = 100, filter = 800, q = 1, noise = 0, lfo = 0, lfoDepth = 0 }) {
  const c = a.ctx;
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = q;
  const g = c.createGain(); g.gain.value = 0.25;
  o.connect(f).connect(g).connect(out);
  let n = null, lf = null;
  if (noise) {
    n = c.createBufferSource(); n.buffer = a._noise; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = filter; nf.Q.value = 0.7;
    const ng = c.createGain(); ng.gain.value = noise;
    n.connect(nf).connect(ng).connect(out); n.start();
  }
  if (lfo) {
    lf = c.createOscillator(); lf.frequency.value = lfo;
    const lg = c.createGain(); lg.gain.value = lfoDepth;
    lf.connect(lg).connect(o.frequency); lf.start();
  }
  o.start();
  return {
    pitch: (p) => { o.frequency.setTargetAtTime(freq * p, c.currentTime, 0.05); f.frequency.setTargetAtTime(filter * p, c.currentTime, 0.05); },
    stop: () => { try { o.stop(); n?.stop(); lf?.stop(); } catch { /* */ } },
  };
}

const LOOPS = {
  physgun: { fn: (a, out) => droneLoop(a, out, { type: 'sawtooth', freq: 62, filter: 520, q: 6, noise: 0.05, lfo: 5.5, lfoDepth: 4 }) },
  gravgun: { fn: (a, out) => droneLoop(a, out, { type: 'triangle', freq: 48, filter: 400, q: 3, noise: 0.08, lfo: 9, lfoDepth: 3 }) },
  thruster: { fn: (a, out) => droneLoop(a, out, { type: 'sawtooth', freq: 40, filter: 900, q: 0.5, noise: 0.6 }) },
  wheel: { fn: (a, out) => droneLoop(a, out, { type: 'square', freq: 70, filter: 500, q: 2, noise: 0.05 }) },
  hover: { fn: (a, out) => droneLoop(a, out, { type: 'sine', freq: 180, filter: 1200, q: 1, lfo: 3, lfoDepth: 10 }) },
  engine: { fn: (a, out) => droneLoop(a, out, { type: 'sawtooth', freq: 38, filter: 600, q: 2, noise: 0.08, lfo: 22, lfoDepth: 6 }) },
  fire: { fn: (a, out) => droneLoop(a, out, { type: 'sine', freq: 30, filter: 700, q: 0.4, noise: 0.5 }) },
  wind: { bus: 'music', fn: (a, out) => droneLoop(a, out, { type: 'sine', freq: 20, filter: 500, q: 0.3, noise: 0.35 }) },
  hum: { fn: (a, out) => droneLoop(a, out, { type: 'sine', freq: 60, filter: 300, q: 1, noise: 0.02 }) },
  elevator: { fn: (a, out) => droneLoop(a, out, { type: 'sawtooth', freq: 45, filter: 350, q: 2, noise: 0.1, lfo: 0.6, lfoDepth: 2 }) },
  pylon: { fn: (a, out) => droneLoop(a, out, { type: 'sawtooth', freq: 110, filter: 800, q: 8, lfo: 7, lfoDepth: 8 }) },
  water: { fn: (a, out) => droneLoop(a, out, { type: 'sine', freq: 25, filter: 900, q: 0.5, noise: 0.25 }) },
};

export const Audio = new AudioEngine();
