// WebAudio engine: synthesised SFX (no audio files), simple 3D panning/attenuation, gibberish
// "voice blips" for dialogue, and buses for music / sfx / voice. Music tracks are sequenced by
// audio/music.js and theme ambience beds by audio/ambience.js through the same context.
//
// Public API: init(), sfx(name, {pos, volume, pitch, throttle, bus, ...}), blip(voice),
// playMusic(id, opts), stopMusic(fade), setMusicIntensity(v), duck(amount, time),
// ambience(themeId|null), setListener(pos, yaw); registerSfx(name, fn); Sound.play(name).
import { settings } from './settings.js';

const RECIPES = {};
/** Register a synth recipe: fn(A, out, t0, opts) where out is a GainNode already routed. */
export function registerSfx(name, fn) { RECIPES[name] = fn; }
/** Names of every registered recipe (tests / debug menus). */
export function sfxNames() { return Object.keys(RECIPES); }

const rnd = (a, b) => a + Math.random() * (b - a);
const semi = (s) => 2 ** (s / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
    this._last = new Map();
    this.music = null;
    this.amb = null;
    this._pendingMusic = null;
    this._pendingIntensity = null;
    this._ambId = null;
    this._duck = null;             // { amount, until } of the active music duck
    settings.onChange((p) => { if (p.startsWith('audio') || p === '*') this.applyVolumes(); });
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 12; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    // transparent safety limiter after the glue compressor: linear below 0.7, never reaches 1.0
    this.limitIn = ctx.createGain(); this.limitIn.gain.value = 0.5;
    this.limiter = ctx.createWaveShaper(); this.limiter.curve = limiterCurve();
    this.master.connect(this.comp).connect(this.limitIn).connect(this.limiter).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.voiceBus = ctx.createGain(); this.voiceBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.sfxBus);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // shared SFX room (explosions, roars, stingers send a little into it)
    this.verbIn = ctx.createGain();
    this.verb = ctx.createConvolver();
    this.verb.buffer = roomImpulse(ctx, 1.6, 3.4);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.7;
    this.verbIn.connect(this.verb).connect(verbOut).connect(this.sfxBus);
    this.applyVolumes();
    this.ready = true;
    import('../audio/music.js').then((m) => {
      this.music = new m.MusicPlayer(this);
      if (this._pendingMusic) { this.music.play(...this._pendingMusic); this._pendingMusic = null; }
      if (this._pendingIntensity != null) { this.music.setIntensity(this._pendingIntensity); this._pendingIntensity = null; }
    }).catch((e) => console.warn('music module unavailable', e));
    import('../audio/ambience.js').then((m) => {
      this.amb = new m.Ambience(this);
      if (this._ambId) this.amb.set(this._ambId, 1.5);
    }).catch((e) => console.warn('ambience module unavailable', e));
  }

  applyVolumes() {
    if (!this.ctx) return;
    const a = settings.get('audio');
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(a.sfx, t, 0.02);
    this._musicGain(t);
    this.voiceBus.gain.setTargetAtTime(a.voice, t, 0.02);
  }

  /** Music bus = volume setting × active duck (so changing the slider while paused keeps the duck). */
  _musicGain(t) {
    const base = settings.get('audio.music') * 0.55;
    const P = this.musicBus.gain;
    const d = this._duck;
    P.cancelScheduledValues(t);
    if (d && t < d.until) {
      P.setTargetAtTime(base * d.amount, t, 0.05);
      P.setTargetAtTime(base, d.until, 0.3);
    } else P.setTargetAtTime(base, t, 0.02);
  }

  setListener(pos, yaw) {
    this.listener.x = pos.x; this.listener.y = pos.y; this.listener.z = pos.z;
    this.listener.rx = Math.cos(yaw); this.listener.rz = -Math.sin(yaw);
  }

  /**
   * Play a synthesised effect.
   * @param {string} name recipe id
   * @param {object} o  pos (Vector3, optional → 3D), volume, pitch, throttle (min seconds between plays)
   */
  sfx(name, o = {}) {
    if (!this.ready) return;
    const fn = RECIPES[name];
    if (!fn) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const thr = o.throttle ?? 0.025;
    const last = this._last.get(name) ?? -1e9;
    if (now - last < thr) return;
    this._last.set(name, now);
    let vol = o.volume ?? 1;
    let pan = 0;
    let dist = 0;
    if (o.pos) {
      const L = this.listener;
      const dx = o.pos.x - L.x, dy = o.pos.y - L.y, dz = o.pos.z - L.z;
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 55) return;
      vol *= 1 / (1 + dist * dist * 0.012);
      if (dist > 0.5) pan = Math.max(-1, Math.min(1, (dx * L.rx + dz * L.rz) / dist)) * 0.8;
    }
    if (vol < 0.01) return;
    const out = ctx.createGain();
    out.gain.value = vol;
    let node = out;
    const extra = [];
    // air absorption: distant sounds lose their top end
    if (dist > 9) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.max(2200, 18000 / (1 + (dist - 9) * 0.09));
      node.connect(lp); node = lp; extra.push(lp);
    }
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      node = p; extra.push(p);
    }
    node.connect(o.bus === 'voice' ? this.voiceBus : this.sfxBus);
    this._extra = extra;                       // wet() sends register here so they are freed too
    try { fn(this, out, now, o); } catch (e) { console.warn('sfx', name, e); }
    this._extra = null;
    setTimeout(() => { try { out.disconnect(); for (const n of extra) n.disconnect(); } catch { /* gone */ } }, 4000);
  }

  // ---- helpers used by recipes ----
  osc(type, f0, f1, t0, dur, out, gain = 1, curve = 'exp') {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      else o.frequency.linearRampToValueAtTime(f1, t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), t0 + Math.min(0.01, dur * 0.2));   // exp ramp to 0 throws
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.01);
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return { o, g };
  }

  noiseBurst(t0, dur, out, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 1, attack = 0.004 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const rate = src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain), t0 + attack);   // exp ramp to 0 throws
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.01);
    src.connect(f).connect(g).connect(out);
    const span = this.noise.duration, need = (dur + 0.05) * rate;
    if (need > span - 0.1) { src.loop = true; src.start(t0, Math.random() * span); }   // long bursts wrap instead of going silent mid-envelope
    else src.start(t0, Math.random() * (span - need - 0.05));
    src.stop(t0 + dur + 0.05);
    return { src, f, g };
  }

  /** Random number in [a, b). */
  rnd(a, b) { return rnd(a, b); }

  /** Send part of a recipe's output to the shared SFX room. */
  wet(out, amount = 0.25) {
    if (!this.verbIn) return;
    const s = this.ctx.createGain();
    s.gain.value = amount;
    out.connect(s).connect(this.verbIn);
    this._extra?.push(s);
  }

  /** A single water droplet: short sine whose pitch rises (the "bloop" of a drop). */
  drop(t, f, out, gain = 0.12, dur = 0.045) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.005);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.01);
  }

  /** A scatter of droplets after a splash. */
  droplets(t, n, out, { spread = 0.3, f0 = 900, f1 = 2800, gain = 0.1, delay = 0.03 } = {}) {
    for (let i = 0; i < n; i++) this.drop(t + delay + Math.random() * spread, rnd(f0, f1), out, gain * rnd(0.4, 1), rnd(0.03, 0.06));
  }

  /** Sub thump (sine pitch drop). */
  sub(t, f0, f1, dur, out, gain = 0.8) { return this.osc('sine', f0, f1, t, dur, out, gain); }

  /** Debris ticks after an explosion. */
  debris(t, n, out, { spread = 0.7, gain = 0.18, delay = 0.08 } = {}) {
    for (let i = 0; i < n; i++) {
      const ti = t + delay + Math.random() * spread;
      this.noiseBurst(ti, rnd(0.02, 0.07), out, { type: 'bandpass', f0: rnd(900, 4200), q: rnd(3, 9), gain: gain * rnd(0.3, 1) });
      if (Math.random() < 0.3) this.osc('sine', rnd(150, 300), rnd(60, 100), ti, 0.07, out, gain * 0.6);
    }
  }

  /** FM clang / bell partial. */
  fm(t, fc, ratio, index, dur, out, gain = 0.3) {
    const ctx = this.ctx;
    const car = ctx.createOscillator(); car.frequency.value = fc;
    const mod = ctx.createOscillator(); mod.frequency.value = fc * ratio;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(fc * index, t);
    mg.gain.exponentialRampToValueAtTime(fc * index * 0.05 + 0.01, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.005);
    car.connect(g).connect(out);
    car.start(t); mod.start(t); car.stop(t + dur + 0.02); mod.stop(t + dur + 0.02);
  }

  /** Vowel-ish formant blip (cute voices, groans, roars). */
  formant(t, f0, f1, dur, out, { vowel = [700, 1200], q = 6, gain = 0.3, wave = 'sawtooth', vib = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = wave;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib) {
      const l = ctx.createOscillator(); l.frequency.value = 7;
      const lg = ctx.createGain(); lg.gain.value = vib;
      l.connect(lg).connect(o.detune); l.start(t); l.stop(t + dur + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur * 0.2));
    g.gain.setValueAtTime(gain, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.005);
    for (const [i, f] of vowel.entries()) {
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q + i * 2;
      const bg = ctx.createGain(); bg.gain.value = i ? 0.6 : 1;
      o.connect(b).connect(bg).connect(g);
    }
    g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** Dialogue gibberish: one syllable in a speaker's voice. */
  blip(voice = {}) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.22 * (voice.volume ?? 1);
    out.connect(this.voiceBus);
    const base = (voice.pitch ?? 260) * (0.9 + Math.random() * 0.25);
    const vowels = [[800, 1150], [400, 1600], [350, 2300], [450, 800], [325, 700], [600, 1000]];
    const [f1, f2] = vowels[Math.floor(Math.random() * vowels.length)];
    const o = ctx.createOscillator();
    o.type = voice.wave || 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (0.9 + Math.random() * 0.3), t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = f1 * (voice.formant ?? 1); b1.Q.value = 6;
    const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = f2 * (voice.formant ?? 1); b2.Q.value = 8;
    o.connect(g);
    g.connect(b1).connect(out);
    g.connect(b2).connect(out);
    o.start(t); o.stop(t + 0.1);
    setTimeout(() => { try { out.disconnect(); } catch { /* */ } }, 400);
  }

  /** Start (or keep) a music track: see audio/music.js. opts: fadeIn, fadeOut, intensity, restart. */
  playMusic(id, opts = {}) {
    if (this.music) this.music.play(id, opts);
    else { this._pendingMusic = [id, opts]; this._pendingIntensity = null; }   // a new track starts at its own intensity, as after load
  }

  stopMusic(fade = 1) { this.music?.stop(fade); this._pendingMusic = null; }

  /** 0..1 — adds music layers (Turf Clash last minute etc.). */
  setMusicIntensity(v) {
    if (this.music) this.music.setIntensity(v);
    else this._pendingIntensity = v;
  }

  /** Looping theme ambience: docks | heights | refinery | tower | arena | plaza; null/'menu' = off. */
  ambience(themeId) {
    this._ambId = themeId || null;
    if (this.amb) this.amb.set(this._ambId);
  }

  /** Duck music under stingers / dialogue. */
  duck(amount = 0.4, time = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._duck = { amount, until: t + time };
    this._musicGain(t);
  }
}

function limiterCurve() {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;          // input range ±2 (fed at half gain)
    const a = Math.abs(x);
    c[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.29 * Math.tanh((a - 0.7) / 0.29));
  }
  return c;
}

function roomImpulse(ctx, secs, decay) {
  const rate = ctx.sampleRate, len = Math.floor(rate * secs);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const x = i / len;
      y += (0.75 * (1 - x) + 0.08) * ((Math.random() * 2 - 1) - y);
      d[i] = y * Math.exp(-decay * x * 2.3);
    }
  }
  return buf;
}

export const audio = new AudioEngine();

/** Compatibility shim for the kit's focus manager. */
export const Sound = { play: (name) => audio.sfx(name, { volume: 0.5 }) };

// =============================================================================================
// Recipes. (A = engine, out = routed gain, t = start time, o = options: pitch, level, value, …)
// Shots and splats randomise pitch/filter a little on every play so rapid fire never machine-guns.

// ---------------------------------------------------------------- ink weapons
registerSfx('shoot', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.noiseBurst(t, 0.07, out, { f0: 2600 * p * rnd(0.9, 1.1), f1: 800 * p, q: 1.6, gain: 0.6 });
  A.osc('sine', 880 * p, 260 * p, t, 0.06, out, 0.45);
  A.osc('triangle', 300 * p, 120 * p, t + 0.01, 0.06, out, 0.25);       // wet body
  A.noiseBurst(t + 0.015, 0.08, out, { type: 'lowpass', f0: 1800 * p, f1: 400, q: 5, gain: 0.25 });
});
registerSfx('enemy_shoot', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.94, 1.06);
  A.noiseBurst(t, 0.09, out, { f0: 1500 * p, f1: 500 * p, q: 1.4, gain: 0.55 });
  A.osc('triangle', 540 * p, 180 * p, t, 0.08, out, 0.4);
  A.noiseBurst(t + 0.02, 0.09, out, { type: 'lowpass', f0: 1200 * p, f1: 300, q: 6, gain: 0.25 });
});
registerSfx('charger_fire', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.97, 1.03);
  A.noiseBurst(t, 0.05, out, { type: 'highpass', f0: 3500, q: 0.7, gain: 0.6 });          // crack
  A.osc('sawtooth', 2600 * p, 380 * p, t, 0.22, out, 0.2);                                  // zap
  A.osc('square', 1300 * p, 190 * p, t, 0.16, out, 0.12);
  A.sub(t, 160, 50, 0.18, out, 0.4);
  A.noiseBurst(t + 0.02, 0.35, out, { f0: 3000, f1: 700, q: 1.2, gain: 0.3, attack: 0.02 });  // trail
  A.wet(out, 0.3);
});
registerSfx('blaster_fire', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.sub(t, 200 * p, 60, 0.16, out, 0.55);
  A.noiseBurst(t, 0.1, out, { type: 'lowpass', f0: 3000 * p, f1: 600, q: 2, gain: 0.55 });
  A.osc('square', 420 * p, 140 * p, t, 0.08, out, 0.18);
  A.wet(out, 0.12);
});
registerSfx('roller', (A, out, t, o) => {            // grain, re-trigger ~every 0.2 s while rolling
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.noiseBurst(t, 0.26, out, { type: 'lowpass', f0: 900 * p, f1: 500 * p, q: 3, gain: 0.45, attack: 0.05 });
  A.noiseBurst(t, 0.24, out, { type: 'bandpass', f0: 2400 * p, q: 2, gain: 0.12, attack: 0.05 });
  A.osc('sine', 80 * p, 70 * p, t, 0.25, out, 0.25);
});
registerSfx('brush', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.9, 1.1);
  A.noiseBurst(t, 0.12, out, { type: 'bandpass', f0: 1800 * p, f1: 4200 * p, q: 1.4, gain: 0.85, attack: 0.012 });
  A.noiseBurst(t + 0.02, 0.1, out, { type: 'lowpass', f0: 1500 * p, f1: 400, q: 5, gain: 0.45 });
  A.droplets(t, 2, out, { spread: 0.1, gain: 0.05 });
});
registerSfx('slosh', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.93, 1.07);
  A.noiseBurst(t, 0.2, out, { type: 'lowpass', f0: 400 * p, f1: 1800 * p, q: 7, gain: 0.55, attack: 0.05 });
  A.noiseBurst(t + 0.16, 0.22, out, { type: 'lowpass', f0: 1600 * p, f1: 300, q: 6, gain: 0.45 });
  A.osc('sine', 180 * p, 360 * p, t, 0.18, out, 0.25);
  A.droplets(t + 0.15, 4, out, { spread: 0.2, gain: 0.07 });
});
registerSfx('spin_up', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  const d = o.duration ?? 0.8;
  A.osc('sawtooth', 160 * p, 1300 * p, t, d, out, 0.2, 'lin');
  A.osc('square', 80 * p, 650 * p, t, d, out, 0.1, 'lin');
  A.noiseBurst(t, d, out, { f0: 600, f1: 5000, q: 2, gain: 0.32, attack: d * 0.5 });
  for (let i = 0; i < 8; i++) A.osc('square', 2200, 2000, t + (i / 8) ** 0.7 * d, 0.015, out, 0.08);
});
registerSfx('sprinkler', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  for (let i = 0; i < 3; i++) {
    A.noiseBurst(t + i * 0.06, 0.05, out, { f0: 2400 * p * (1 + i * 0.1), f1: 1200 * p, q: 1.5, gain: 0.6 });
    A.osc('sine', 700 * p, 400 * p, t + i * 0.06, 0.04, out, 0.22);
  }
  A.droplets(t, 3, out, { spread: 0.18, gain: 0.05 });
});
registerSfx('mine_arm', (A, out, t) => {
  A.osc('square', 1400, 1400, t, 0.05, out, 0.14);
  A.osc('square', 1900, 1900, t + 0.08, 0.05, out, 0.14);
  A.noiseBurst(t + 0.16, 0.03, out, { type: 'highpass', f0: 3000, gain: 0.3 });
  A.osc('sine', 400, 250, t + 0.16, 0.05, out, 0.25);
});
registerSfx('lock_on', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('square', 1760 * p, 1760 * p, t, 0.04, out, 0.12);
  A.osc('square', 2349 * p, 2349 * p, t + 0.06, 0.06, out, 0.12);
  A.osc('sine', 3520 * p, 3520 * p, t + 0.06, 0.08, out, 0.08);
});
registerSfx('missile', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.sub(t, 140, 60, 0.12, out, 0.5);
  A.noiseBurst(t, 0.08, out, { type: 'lowpass', f0: 3000, f1: 800, gain: 0.5 });         // ignition pop
  A.noiseBurst(t + 0.03, 0.6, out, { f0: 700 * p, f1: 2600 * p, q: 1.6, gain: 0.35, attack: 0.08 });
  A.osc('sawtooth', 500 * p, 1400 * p, t + 0.03, 0.55, out, 0.06, 'lin');                // whistle
});
registerSfx('jet_loop', (A, out, t, o) => {          // ~0.4 s burner grain, re-trigger every ~0.3 s
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.42, out, { type: 'lowpass', f0: 500 * p, q: 1, gain: 0.5, attack: 0.1 });
  A.noiseBurst(t, 0.42, out, { f0: 3200 * p, q: 1.4, gain: 0.14, attack: 0.1 });
  A.osc('sawtooth', 55 * p, 58 * p, t, 0.42, out, 0.08, 'lin');
});
registerSfx('storm_rain', (A, out, t, o) => {        // ~0.8 s ink-rain grain for the Ink Storm cloud
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.8, out, { type: 'highpass', f0: 1800 * p, q: 0.5, gain: 0.22, attack: 0.25 });
  A.noiseBurst(t, 0.8, out, { type: 'lowpass', f0: 700, q: 0.7, gain: 0.25, attack: 0.25 });
  A.droplets(t, 10, out, { spread: 0.7, f0: 1200, f1: 3600, gain: 0.05 });
});

// ---------------------------------------------------------------- impacts & splats
registerSfx('splat', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.9, 1.1);
  A.noiseBurst(t, rnd(0.13, 0.18), out, { type: 'lowpass', f0: 2800 * p * rnd(0.85, 1.15), f1: 280, q: rnd(3, 6), gain: 0.6 });
  A.osc('sine', 260 * p, 70, t, 0.1, out, 0.35);
  A.droplets(t, Math.floor(rnd(1, 4)), out, { spread: 0.15, gain: 0.06 });
});
registerSfx('hit', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.97, 1.03);
  A.osc('square', 1150 * p, 520 * p, t, 0.05, out, 0.22);
  A.noiseBurst(t, 0.06, out, { type: 'highpass', f0: 3000, q: 0.7, gain: 0.4 });
  A.osc('sine', 1760 * p, 1760 * p, t + 0.02, 0.07, out, 0.16);
  A.noiseBurst(t, 0.1, out, { type: 'lowpass', f0: 2000, f1: 400, q: 4, gain: 0.2 });
});
registerSfx('boom', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.93, 1.07);
  A.sub(t, 120 * p, 34, 0.5, out, 0.6);
  A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 1600 * p, f1: 90, q: 1.2, gain: 0.62 });
  A.noiseBurst(t + 0.02, 0.3, out, { type: 'bandpass', f0: 800, f1: 300, q: 2, gain: 0.25 });
  A.noiseBurst(t, 0.2, out, { type: 'lowpass', f0: 3000, f1: 500, q: 6, gain: 0.2 });       // wet splash on top
  A.debris(t, 4, out, { spread: 0.4, gain: 0.1 });
  A.droplets(t + 0.1, 4, out, { spread: 0.4, gain: 0.05 });
  A.wet(out, 0.22);
});
registerSfx('bigboom', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.sub(t, 95 * p, 26, 1.0, out, 0.44);
  A.osc('triangle', 190 * p, 55, t, 0.4, out, 0.24);
  A.noiseBurst(t, 1.1, out, { type: 'lowpass', f0: 2400 * p, f1: 70, q: 1, gain: 0.42 });
  A.noiseBurst(t, 0.3, out, { type: 'lowpass', f0: 3500, f1: 600, q: 5, gain: 0.22 });
  for (let i = 0; i < 3; i++) A.noiseBurst(t + 0.25 + i * rnd(0.15, 0.3), 0.5, out, { type: 'lowpass', f0: 300, f1: 80, gain: 0.3 });
  A.debris(t, 10, out, { spread: 0.9, gain: 0.1 });
  A.droplets(t + 0.25, 8, out, { spread: 0.8, gain: 0.05 });
  A.wet(out, 0.35);
});
registerSfx('pop', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.osc('sine', 280 * p, 950 * p, t, 0.07, out, 0.6);
  A.noiseBurst(t + 0.02, 0.28, out, { type: 'lowpass', f0: 2400 * p, f1: 200, q: 3, gain: 0.6 });
  A.osc('sine', 120 * p, 50, t + 0.02, 0.25, out, 0.42);
  A.droplets(t + 0.05, 4, out, { spread: 0.25, gain: 0.06 });
  A.wet(out, 0.12);
});
registerSfx('splash_big', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.sub(t, 110 * p, 40, 0.4, out, 0.7);
  A.noiseBurst(t, 0.9, out, { type: 'lowpass', f0: 600, f1: 3800 * p, q: 2, gain: 0.7, attack: 0.05 });
  A.noiseBurst(t + 0.25, 0.9, out, { f0: 2500, f1: 700, q: 1, gain: 0.45 });
  A.droplets(t + 0.2, 16, out, { spread: 1.2, f0: 700, f1: 3200, gain: 0.07 });
  A.wet(out, 0.3);
});
registerSfx('splat_death', (A, out, t) => {
  A.noiseBurst(t, 0.65, out, { type: 'lowpass', f0: 3200, f1: 140, q: 5, gain: 0.48 });
  A.osc('sawtooth', 620, 70, t, 0.55, out, 0.18);
  A.formant(t, 700, 180, 0.45, out, { vowel: [600, 1000], gain: 0.3 });
  A.sub(t, 150, 38, 0.55, out, 0.42);
  A.droplets(t + 0.15, 10, out, { spread: 0.7, gain: 0.07 });
  A.wet(out, 0.3);
});
registerSfx('enemy_die', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.94, 1.06);
  A.osc('sine', 600 * p, 1400 * p, t, 0.06, out, 0.3);
  A.noiseBurst(t + 0.03, 0.38, out, { type: 'lowpass', f0: 2800 * p, f1: 200, q: 5, gain: 0.5 });
  A.sub(t + 0.03, 210 * p, 55, 0.3, out, 0.36);
  A.droplets(t + 0.1, 6, out, { spread: 0.4, gain: 0.06 });
  A.wet(out, 0.15);
});
registerSfx('shield_block', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.96, 1.04);
  A.noiseBurst(t, 0.04, out, { type: 'highpass', f0: 3500, q: 0.8, gain: 0.55 });
  A.fm(t, 880 * p, 2.76, 1.4, 0.35, out, 0.2);
  A.fm(t, 1320 * p, 1.41, 0.8, 0.22, out, 0.1);
});
registerSfx('break', (A, out, t) => {
  A.noiseBurst(t, 0.3, out, { type: 'highpass', f0: 2500, q: 0.8, gain: 0.6 });
  A.osc('square', 400, 120, t, 0.2, out, 0.2);
  A.debris(t, 5, out, { spread: 0.35, gain: 0.14, delay: 0.03 });
});
registerSfx('squeak', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.9, 1.1);
  A.formant(t, 900 * p, 1350 * p, 0.14, out, { vowel: [1000, 2400], q: 4, gain: 0.35, wave: 'square', vib: 60 });
});
registerSfx('balloon_pop', (A, out, t) => {
  A.noiseBurst(t, 0.09, out, { type: 'highpass', f0: 1200, q: 0.7, gain: 0.8, attack: 0.001 });
  A.sub(t, 240, 70, 0.1, out, 0.5);
  A.osc('square', 1600, 400, t, 0.04, out, 0.1);
  A.droplets(t + 0.02, 5, out, { spread: 0.3, gain: 0.06 });
});

// ---------------------------------------------------------------- movement
registerSfx('throw', (A, out, t) => { A.noiseBurst(t, 0.18, out, { f0: 400 * rnd(0.9, 1.1), f1: 2200, q: 1.4, gain: 1.2, attack: 0.03 }); A.osc('sine', 300, 520, t, 0.1, out, 0.08); });
registerSfx('clack', (A, out, t) => { A.osc('square', 1300, 900, t, 0.03, out, 0.25); A.osc('sine', 500, 300, t, 0.04, out, 0.2); });
registerSfx('whoosh', (A, out, t) => A.noiseBurst(t, 0.45, out, { f0: 300, f1: 3200 * rnd(0.9, 1.1), q: 1.2, gain: 1.3, attack: 0.12 }));
registerSfx('dive', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  A.osc('sine', 700 * p, 170 * p, t, 0.16, out, 0.45);
  A.noiseBurst(t, 0.2, out, { type: 'lowpass', f0: 1900, f1: 280, q: 6, gain: 0.5 });
  A.droplets(t + 0.05, 2, out, { spread: 0.1, f0: 500, f1: 1400, gain: 0.06 });
});
registerSfx('squish', (A, out, t) => {
  A.osc('sine', 420 * rnd(0.95, 1.05), 230, t, 0.1, out, 0.35);
  A.noiseBurst(t, 0.08, out, { type: 'lowpass', f0: 900, f1: 300, q: 8, gain: 0.2 });
});
registerSfx('emerge', (A, out, t) => {
  A.osc('sine', 220, 660, t, 0.12, out, 0.4);
  A.noiseBurst(t, 0.12, out, { type: 'lowpass', f0: 600, f1: 2400, q: 5, gain: 0.35 });
  A.droplets(t + 0.06, 3, out, { spread: 0.15, gain: 0.06 });
});
registerSfx('splash', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.93, 1.07);
  A.noiseBurst(t, 0.3, out, { f0: 1700 * p, f1: 480, q: 1.2, gain: 0.65 });
  A.noiseBurst(t, 0.18, out, { type: 'lowpass', f0: 2600 * p, f1: 300, q: 4, gain: 0.3 });
  A.droplets(t, 5, out, { spread: 0.25, gain: 0.09 });
});
registerSfx('swim', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.92, 1.08);
  A.noiseBurst(t, 0.12, out, { type: 'lowpass', f0: 1000 * p, f1: 380, q: rnd(6, 10), gain: 0.5 });
  if (Math.random() < 0.35) A.drop(t + rnd(0.02, 0.08), rnd(700, 1400), out, 0.05);
});
registerSfx('jump', (A, out, t, o) => A.osc('sine', 300 * (o.pitch ?? 1), 580 * (o.pitch ?? 1), t, 0.08, out, 0.35));
registerSfx('land', (A, out, t) => { A.osc('sine', 130, 55, t, 0.09, out, 0.6); A.noiseBurst(t, 0.07, out, { type: 'lowpass', f0: 700, f1: 200, gain: 0.4 }); });
registerSfx('spring', (A, out, t) => {
  const ctx = A.ctx;
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.18);
  const l = ctx.createOscillator(); l.frequency.value = 22;
  const lg = ctx.createGain(); lg.gain.setValueAtTime(90, t); lg.gain.exponentialRampToValueAtTime(5, t + 0.45);
  l.connect(lg).connect(o.frequency);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.51);
  o.connect(g).connect(out); o.start(t); l.start(t); o.stop(t + 0.52); l.stop(t + 0.52);
  A.osc('sine', 90, 60, t, 0.1, out, 0.4);
});
registerSfx('rail_ride', (A, out, t, o) => {         // grain, re-trigger while grinding
  const p = o.pitch ?? 1;
  A.osc('sawtooth', 180 * p, 185 * p, t, 0.28, out, 0.07, 'lin');
  A.osc('sine', 360 * p, 362 * p, t, 0.28, out, 0.1, 'lin');
  A.noiseBurst(t, 0.28, out, { f0: 3800 * p, q: 3, gain: 0.1, attack: 0.06 });
});
registerSfx('launch', (A, out, t) => { A.osc('sawtooth', 200, 1200, t, 0.35, out, 0.25); A.noiseBurst(t, 0.5, out, { f0: 400, f1: 3000, q: 1, gain: 0.5 }); A.droplets(t, 4, out, { spread: 0.2, gain: 0.06 }); });
registerSfx('superjump', (A, out, t) => { A.osc('sine', 300, 1600, t, 0.6, out, 0.3); A.noiseBurst(t, 0.7, out, { f0: 300, f1: 2500, q: 2, gain: 0.35, attack: 0.2 }); A.wet(out, 0.2); });
registerSfx('drone_buzz', (A, out, t, o) => {        // ~0.3 s rotor grain
  const p = (o.pitch ?? 1) * rnd(0.98, 1.02);
  const ctx = A.ctx;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 * p; bp.Q.value = 1.4;
  const am = ctx.createGain(); am.gain.value = 0.5;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 38 * p;
  const lg = ctx.createGain(); lg.gain.value = 0.45;
  lfo.connect(lg).connect(am.gain);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.06); g.gain.setValueAtTime(0.35, t + 0.24); g.gain.linearRampToValueAtTime(0, t + 0.32);
  for (const f of [118, 121.5]) { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f * p; s.connect(bp); s.start(t); s.stop(t + 0.34); }
  bp.connect(am).connect(g).connect(out);
  lfo.start(t); lfo.stop(t + 0.34);
});
registerSfx('gate_open', (A, out, t) => {
  A.osc('sawtooth', 70, 110, t, 0.9, out, 0.12, 'lin');
  A.noiseBurst(t, 0.9, out, { type: 'bandpass', f0: 500, f1: 900, q: 3, gain: 0.25, attack: 0.1 });
  A.noiseBurst(t + 0.85, 0.3, out, { type: 'lowpass', f0: 600, f1: 150, q: 2, gain: 0.6 });
  A.fm(t + 0.85, 180, 2.76, 1.2, 0.5, out, 0.25);
  A.noiseBurst(t + 0.9, 0.5, out, { type: 'highpass', f0: 3000, q: 0.7, gain: 0.12, attack: 0.05 });   // air hiss
  A.wet(out, 0.2);
});
registerSfx('door', (A, out, t) => { A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 500, f1: 150, q: 2, gain: 0.6 }); A.osc('sawtooth', 70, 50, t, 0.6, out, 0.2); A.fm(t + 0.5, 140, 2.2, 1, 0.4, out, 0.18); });

// ---------------------------------------------------------------- player state
registerSfx('special', (A, out, t) => {
  [0, 4, 7, 12, 16].forEach((s, i) => A.osc('sawtooth', 330 * semi(s), 330 * semi(s), t + i * 0.05, 0.16, out, 0.18));
  A.noiseBurst(t, 0.5, out, { f0: 500, f1: 4000, q: 1.5, gain: 0.35 });
  A.sub(t, 60, 120, 0.4, out, 0.4);
  A.wet(out, 0.25);
});
registerSfx('ready', (A, out, t) => {
  A.osc('sine', 880, 880, t, 0.18, out, 0.4); A.osc('sine', 1320, 1320, t + 0.09, 0.3, out, 0.4); A.osc('triangle', 1760, 1760, t + 0.18, 0.35, out, 0.25);
  A.fm(t + 0.18, 2637, 3.5, 0.6, 0.6, out, 0.08);
  A.wet(out, 0.2);
});
registerSfx('empty', (A, out, t) => { A.osc('square', 180, 120, t, 0.05, out, 0.3); A.osc('square', 180, 120, t + 0.09, 0.05, out, 0.3); });
registerSfx('hurt', (A, out, t) => {
  A.formant(t, 520 * rnd(0.95, 1.05), 300, 0.16, out, { vowel: [700, 1150], gain: 0.85 });
  A.noiseBurst(t, 0.12, out, { type: 'lowpass', f0: 1500, f1: 300, gain: 0.5 });
});
registerSfx('charge', (A, out, t, o) => A.osc('sawtooth', 200 + (o.level ?? 0) * 600, 220 + (o.level ?? 0) * 700, t, 0.08, out, 0.12));
registerSfx('laser', (A, out, t) => { A.osc('sawtooth', 1800, 1200, t, 0.2, out, 0.16); A.osc('square', 3600, 2400, t, 0.12, out, 0.05); });

// ---------------------------------------------------------------- pickups & progress
registerSfx('pickup', (A, out, t) => { A.osc('sine', 1760, 1760, t, 0.08, out, 0.3); A.osc('sine', 2637, 2637, t + 0.05, 0.14, out, 0.25); });
registerSfx('coin', (A, out, t) => { A.osc('square', 988, 988, t, 0.07, out, 0.15); A.osc('square', 1318, 1318, t + 0.07, 0.18, out, 0.15); });
const CHAIN = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
registerSfx('pearl_chain', (A, out, t, o) => {       // o.chain = index in a pickup streak → climbs a major scale
  const k = Math.max(0, Math.floor(o.chain ?? 0));
  const f = 1046.5 * semi(CHAIN[Math.min(k, CHAIN.length - 1)]);
  A.osc('sine', f, f, t, 0.1, out, 0.28);
  A.osc('sine', f * 1.5, f * 1.5, t + 0.04, 0.16, out, 0.18);
  A.osc('triangle', f * 4, f * 4, t + 0.04, 0.05, out, 0.04);
});
registerSfx('checkpoint', (A, out, t) => {
  [0, 4, 7, 12].forEach((s, i) => A.osc('triangle', 523 * semi(s), 523 * semi(s), t + i * 0.08, 0.3, out, 0.3));
  A.fm(t + 0.32, 2093, 3.5, 0.8, 0.8, out, 0.07);
  A.wet(out, 0.25);
});
registerSfx('postcard', (A, out, t) => {
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => A.fm(t + i * 0.07, 659 * semi(s), 3.5, 0.9, 0.6, out, 0.12));
  A.noiseBurst(t, 0.8, out, { type: 'bandpass', f0: 3000, f1: 8000, q: 3, gain: 0.12, attack: 0.2 });
  A.wet(out, 0.35);
});
registerSfx('unlock', (A, out, t) => {
  [0, 7, 12, 16, 19, 24].forEach((s, i) => A.fm(t + i * 0.06, 784 * semi(s), 3.5, 1.1, 0.7, out, 0.14));
  [0, 4, 7].forEach((s) => A.osc('sawtooth', 392 * semi(s), 392 * semi(s), t + 0.36, 0.9, out, 0.05));
  A.noiseBurst(t + 0.3, 1.0, out, { f0: 2000, f1: 9000, q: 2, gain: 0.12, attack: 0.3 });
  A.sub(t + 0.36, 98, 98, 0.7, out, 0.3);
  A.wet(out, 0.35);
});
registerSfx('core_float', (A, out, t) => {           // shimmering hover (~1.2 s)
  const ctx = A.ctx;
  [0, 7, 16, 23].forEach((s, i) => {
    const o = ctx.createOscillator(); o.frequency.value = 523 * semi(s);
    const trem = ctx.createGain(); trem.gain.value = 0.7;          // 0.7 ± 0.3 tremolo, inside the envelope
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5 + i;
    const depth = ctx.createGain(); depth.gain.value = 0.3;
    lfo.connect(depth).connect(trem.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.3); g.gain.setValueAtTime(0.07, t + 0.8); g.gain.linearRampToValueAtTime(0, t + 1.2);
    o.connect(trem).connect(g).connect(out);
    o.start(t); lfo.start(t); o.stop(t + 1.22); lfo.stop(t + 1.22);
  });
  A.noiseBurst(t, 1.1, out, { f0: 5000, f1: 9000, q: 4, gain: 0.08, attack: 0.4 });
  A.wet(out, 0.4);
});
registerSfx('core_break', (A, out, t) => {
  A.noiseBurst(t, 0.9, out, { type: 'highpass', f0: 1800, f1: 6000, q: 0.7, gain: 0.34 });
  for (let i = 0; i < 16; i++) { const f = rnd(2400, 7000); A.osc('sine', f, f * 0.96, t + Math.random() * 0.7, rnd(0.1, 0.3), out, 0.06); }
  A.sub(t, 100, 30, 0.8, out, 0.4);
  A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 1000, f1: 90, q: 1, gain: 0.36 });
  [0, 4, 7, 11, 14].forEach((s, i) => A.fm(t + 0.3 + i * 0.05, 523 * semi(s), 3.5, 1, 1.3, out, 0.08));
  A.wet(out, 0.45);
});
registerSfx('victory', (A, out, t) => [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => A.osc('square', 392 * semi(s), 392 * semi(s), t + i * 0.11, 0.2, out, 0.14)));
registerSfx('defeat', (A, out, t) => [7, 4, 0, -5].forEach((s, i) => A.osc('triangle', 392 * semi(s), 392 * semi(s), t + i * 0.18, 0.3, out, 0.25)));

// ---------------------------------------------------------------- UI
registerSfx('ui_move', (A, out, t) => A.osc('sine', 1250, 1250, t, 0.035, out, 0.25));
registerSfx('ui_select', (A, out, t) => { A.osc('sine', 880, 880, t, 0.06, out, 0.3); A.osc('sine', 1320, 1320, t + 0.05, 0.1, out, 0.3); });
registerSfx('ui_back', (A, out, t) => { A.osc('sine', 880, 880, t, 0.06, out, 0.3); A.osc('sine', 587, 587, t + 0.05, 0.1, out, 0.3); });
registerSfx('ui_tab', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.03, out, { f0: 2500, q: 2, gain: 0.25 });
  A.osc('triangle', 660 * p, 990 * p, t, 0.07, out, 0.25);
});
registerSfx('ui_slider', (A, out, t, o) => {         // o.value 0..1 → pitch
  const v = Math.max(0, Math.min(1, o.value ?? 0.5));
  A.osc('sine', 500 + v * 900, 500 + v * 900, t, 0.03, out, 0.22);
});
registerSfx('error', (A, out, t) => A.osc('square', 150, 130, t, 0.18, out, 0.25));
registerSfx('title_hit', (A, out, t) => {
  A.sub(t, 110, 30, 1.0, out, 0.5);
  A.noiseBurst(t, 1.3, out, { type: 'highpass', f0: 3500, q: 0.7, gain: 0.25 });              // crash
  A.noiseBurst(t, 0.5, out, { type: 'lowpass', f0: 2600, f1: 120, q: 3, gain: 0.36 });          // ink splat
  [0, 7, 12, 16, 19].forEach((s) => A.osc('sawtooth', 147 * semi(s), 147 * semi(s), t, 1.1, out, 0.045));
  A.droplets(t + 0.1, 8, out, { spread: 0.6, gain: 0.06 });
  A.wet(out, 0.45);
});
registerSfx('stage_start', (A, out, t) => {
  A.noiseBurst(t, 0.5, out, { f0: 400, f1: 5000, q: 2, gain: 0.3, attack: 0.4 });
  [0, 7, 12].forEach((s, i) => A.osc('square', 440 * semi(s), 440 * semi(s), t + 0.42 + i * 0.07, 0.25, out, 0.1));
  [0, 4, 7].forEach((s) => A.osc('sawtooth', 220 * semi(s), 220 * semi(s), t + 0.63, 0.7, out, 0.07));
  A.sub(t + 0.62, 120, 45, 0.4, out, 0.45);
  A.noiseBurst(t + 0.62, 0.9, out, { type: 'highpass', f0: 4000, q: 0.7, gain: 0.25 });
  A.wet(out, 0.3);
});
registerSfx('count', (A, out, t) => A.osc('square', 880, 880, t, 0.1, out, 0.2));
registerSfx('countdown', (A, out, t, o) => {         // last-seconds tick; o.pitch rises as time runs out
  const p = o.pitch ?? 1;
  A.osc('square', 1046 * p, 1046 * p, t, 0.07, out, 0.14);
  A.osc('triangle', 2093 * p, 2093 * p, t, 0.05, out, 0.08);
  A.noiseBurst(t, 0.02, out, { type: 'highpass', f0: 5000, gain: 0.15 });
});
registerSfx('go', (A, out, t) => { A.osc('square', 1320, 1320, t, 0.35, out, 0.22); A.osc('square', 1760, 1760, t, 0.35, out, 0.12); A.sub(t, 120, 50, 0.3, out, 0.5); });
registerSfx('whistle', (A, out, t) => { A.osc('sine', 2200, 2400, t, 0.25, out, 0.25); A.osc('sine', 2400, 2000, t + 0.25, 0.45, out, 0.25); });
registerSfx('crowd_cheer', (A, out, t, o) => {
  const v = o.level ?? 1;
  for (const [f, q] of [[550, 1.6], [1200, 2], [2500, 2.5], [4200, 3]]) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rnd(0.9, 1.1); bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35 * v, t + 0.25); g.gain.linearRampToValueAtTime(0.22 * v, t + 1.4); g.gain.linearRampToValueAtTime(0, t + 2.6);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random()); src.stop(t + 2.65);
  }
  for (let i = 0; i < 5; i++) {                      // "woo!" voices
    const t0 = t + rnd(0.05, 1.2), f = rnd(350, 650);
    A.formant(t0, f, f * rnd(1.3, 1.7), rnd(0.35, 0.6), out, { vowel: [400, 900], gain: 0.07 * v });
  }
  for (let i = 0; i < 2; i++) { const t0 = t + rnd(0.2, 1); A.osc('sine', 2000, 2600, t0, 0.35, out, 0.04 * v, 'lin'); }
  A.wet(out, 0.3);
});
registerSfx('crowd_aww', (A, out, t, o) => {
  const v = o.level ?? 1;
  for (let i = 0; i < 6; i++) {
    const f = rnd(220, 420), d = rnd(1.1, 1.6);
    A.formant(t + rnd(0, 0.15), f, f * 0.72, d, out, { vowel: [650, 1050], q: 5, gain: 0.17 * v, vib: 12 });
  }
  A.noiseBurst(t, 1.4, out, { f0: 900, f1: 500, q: 1.2, gain: 0.22 * v, attack: 0.2 });
  A.wet(out, 0.3);
});

// ---------------------------------------------------------------- enemies & bosses
registerSfx('alert', (A, out, t) => { A.osc('square', 988, 988, t, 0.05, out, 0.2); A.osc('square', 1318, 1318, t + 0.07, 0.07, out, 0.2); });
registerSfx('enemy_alert', (A, out, t, o) => RECIPES.alert(A, out, t, o));
registerSfx('boss_roar', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.95, 1.05);
  const d = 1.5;
  const ctx = A.ctx;
  const sh = ctx.createWaveShaper();
  const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 127.5 - 1; c[i] = Math.tanh(3 * x); }
  sh.curve = c;
  const pre = ctx.createGain(); pre.gain.value = 0.9;
  pre.connect(sh).connect(out);
  for (const [f, v] of [[72, 0.5], [74.5, 0.4], [145, 0.25]]) {
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(f * p * 0.8, t);
    src.frequency.linearRampToValueAtTime(f * p * 1.15, t + d * 0.35);
    src.frequency.linearRampToValueAtTime(f * p * 0.7, t + d);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(900, t + d * 0.4); bp.frequency.linearRampToValueAtTime(300, t + d);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.15); g.gain.setValueAtTime(v, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d);
    src.connect(bp).connect(g).connect(pre);
    src.start(t); src.stop(t + d + 0.02);
  }
  A.noiseBurst(t, d, out, { type: 'bandpass', f0: 600, f1: 250, q: 1.5, gain: 0.35, attack: 0.15 });
  A.sub(t, 60, 35, d, out, 0.5);
  A.wet(out, 0.4);
  setTimeout(() => { try { pre.disconnect(); sh.disconnect(); } catch { /* */ } }, (d + 1) * 1000);
});
registerSfx('boss_hit', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * rnd(0.94, 1.06);
  A.fm(t, 160 * p, 2.76, 2.2, 0.5, out, 0.28);
  A.fm(t, 420 * p, 1.41, 1.3, 0.3, out, 0.12);
  A.sub(t, 140, 45, 0.25, out, 0.55);
  A.noiseBurst(t, 0.12, out, { type: 'highpass', f0: 2500, gain: 0.35 });
  A.noiseBurst(t, 0.2, out, { type: 'lowpass', f0: 2400, f1: 300, q: 5, gain: 0.35 });
  A.wet(out, 0.2);
});
registerSfx('boss_die', (A, out, t) => {
  for (let i = 0; i < 6; i++) {
    const ti = t + i * rnd(0.22, 0.4);
    A.sub(ti, rnd(90, 130), 30, 0.5, out, 0.42);
    A.noiseBurst(ti, 0.55, out, { type: 'lowpass', f0: rnd(1400, 2400), f1: 90, q: 1, gain: 0.42 });
  }
  A.osc('sawtooth', 900, 60, t, 2.6, out, 0.12);                // falling whine
  A.formant(t + 0.1, 160, 50, 2.2, out, { vowel: [500, 900], gain: 0.25 });
  A.sub(t + 2.1, 80, 22, 1.2, out, 0.6);
  A.noiseBurst(t + 2.1, 1.3, out, { type: 'lowpass', f0: 3000, f1: 60, q: 1, gain: 0.55 });
  A.debris(t + 2.1, 12, out, { spread: 1.0, gain: 0.16 });
  A.droplets(t + 2.3, 12, out, { spread: 1.0, gain: 0.06 });
  A.wet(out, 0.45);
});
registerSfx('rumble', (A, out, t) => { A.noiseBurst(t, 1.2, out, { type: 'lowpass', f0: 220, f1: 80, q: 1, gain: 1.5, attack: 0.2 }); A.sub(t, 55, 40, 1.1, out, 0.2); });
