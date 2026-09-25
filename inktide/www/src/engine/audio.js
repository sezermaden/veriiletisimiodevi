// WebAudio engine: synthesised SFX (no audio files), simple 3D panning/attenuation, gibberish
// "voice blips" for dialogue, and buses for music / sfx / voice. Music tracks are sequenced by
// audio/music.js through the same context.
import { settings } from './settings.js';

const RECIPES = {};
/** Register a synth recipe: fn(ctx, out, t0, opts) where out is a GainNode already routed. */
export function registerSfx(name, fn) { RECIPES[name] = fn; }

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
    this._last = new Map();
    this.music = null;
    this._pendingMusic = null;
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
    this.master.connect(this.comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    this.voiceBus = ctx.createGain(); this.voiceBus.connect(this.master);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.ready = true;
    import('../audio/music.js').then((m) => {
      this.music = new m.MusicPlayer(this);
      if (this._pendingMusic) { this.music.play(...this._pendingMusic); this._pendingMusic = null; }
    }).catch((e) => console.warn('music module unavailable', e));
  }

  applyVolumes() {
    if (!this.ctx) return;
    const a = settings.get('audio');
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(a.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(a.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(a.music * 0.55, t, 0.02);
    this.voiceBus.gain.setTargetAtTime(a.voice, t, 0.02);
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
    const last = this._last.get(name) || 0;
    if (now - last < thr) return;
    this._last.set(name, now);
    let vol = o.volume ?? 1;
    let pan = 0;
    if (o.pos) {
      const L = this.listener;
      const dx = o.pos.x - L.x, dy = o.pos.y - L.y, dz = o.pos.z - L.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 55) return;
      vol *= 1 / (1 + dist * dist * 0.012);
      if (dist > 0.5) pan = Math.max(-1, Math.min(1, (dx * L.rx + dz * L.rz) / dist)) * 0.8;
    }
    if (vol < 0.01) return;
    const out = ctx.createGain();
    out.gain.value = vol;
    let node = out;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      node = p;
    }
    node.connect(o.bus === 'voice' ? this.voiceBus : this.sfxBus);
    try { fn(this, out, now, o); } catch (e) { console.warn('sfx', name, e); }
    setTimeout(() => { try { node.disconnect(); out.disconnect(); } catch { /* gone */ } }, 4000);
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
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return { o, g };
  }

  noiseBurst(t0, dur, out, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 1, attack = 0.004 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
    return { src, f, g };
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

  playMusic(id, opts = {}) {
    if (this.music) this.music.play(id, opts);
    else this._pendingMusic = [id, opts];
  }

  stopMusic(fade = 1) { this.music?.stop(fade); this._pendingMusic = null; }

  /** Duck music under stingers / dialogue. */
  duck(amount = 0.4, time = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = settings.get('audio.music') * 0.55;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(base * amount, t, 0.05);
    this.musicBus.gain.setTargetAtTime(base, t + time, 0.3);
  }
}

export const audio = new AudioEngine();

/** Compatibility shim for the kit's focus manager. */
export const Sound = { play: (name) => audio.sfx(name, { volume: 0.5 }) };

// ---------------------------------------------------------------------------------------------
// Recipes
registerSfx('shoot', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.07, out, { f0: 2400 * p, f1: 900 * p, q: 1.4, gain: 0.7 });
  A.osc('sine', 820 * p, 300 * p, t, 0.06, out, 0.5);
});
registerSfx('enemy_shoot', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.08, out, { f0: 1500 * p, f1: 600 * p, q: 1.2, gain: 0.6 });
  A.osc('triangle', 520 * p, 200 * p, t, 0.07, out, 0.45);
});
registerSfx('splat', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.14, out, { type: 'lowpass', f0: 2600 * p, f1: 350, q: 3, gain: 0.8 });
  A.osc('sine', 240 * p, 80, t, 0.1, out, 0.35);
});
registerSfx('hit', (A, out, t) => {
  A.osc('square', 1100, 520, t, 0.05, out, 0.25);
  A.noiseBurst(t, 0.06, out, { type: 'highpass', f0: 3000, q: 0.7, gain: 0.4 });
  A.osc('sine', 1600, 1600, t + 0.02, 0.05, out, 0.18);
});
registerSfx('boom', (A, out, t) => {
  A.noiseBurst(t, 0.55, out, { type: 'lowpass', f0: 1400, f1: 110, q: 1, gain: 1 });
  A.osc('sine', 110, 38, t, 0.45, out, 0.9);
  A.noiseBurst(t + 0.02, 0.3, out, { type: 'bandpass', f0: 700, f1: 300, q: 2, gain: 0.4 });
});
registerSfx('bigboom', (A, out, t) => {
  A.noiseBurst(t, 0.9, out, { type: 'lowpass', f0: 1800, f1: 80, q: 1, gain: 1 });
  A.osc('sine', 95, 28, t, 0.8, out, 1);
  A.osc('triangle', 180, 60, t, 0.35, out, 0.5);
  for (let i = 0; i < 6; i++) A.noiseBurst(t + 0.05 + i * 0.05, 0.12, out, { f0: 1500 + Math.random() * 1500, q: 4, gain: 0.25 });
});
registerSfx('pop', (A, out, t) => {
  A.osc('sine', 280, 950, t, 0.07, out, 0.6);
  A.noiseBurst(t + 0.02, 0.28, out, { type: 'lowpass', f0: 2200, f1: 200, q: 2, gain: 0.8 });
  A.osc('sine', 120, 50, t + 0.02, 0.25, out, 0.6);
});
registerSfx('throw', (A, out, t) => A.noiseBurst(t, 0.18, out, { f0: 400, f1: 2200, q: 2, gain: 0.4 }));
registerSfx('clack', (A, out, t) => { A.osc('square', 1300, 900, t, 0.03, out, 0.25); A.osc('sine', 500, 300, t, 0.04, out, 0.2); });
registerSfx('special', (A, out, t) => {
  [0, 4, 7, 12, 16].forEach((s, i) => A.osc('sawtooth', 330 * 2 ** (s / 12), 330 * 2 ** (s / 12), t + i * 0.05, 0.16, out, 0.2));
  A.noiseBurst(t, 0.5, out, { f0: 500, f1: 4000, q: 1.5, gain: 0.35 });
});
registerSfx('whoosh', (A, out, t) => A.noiseBurst(t, 0.45, out, { f0: 300, f1: 3200, q: 1.8, gain: 0.55, attack: 0.1 }));
registerSfx('ready', (A, out, t) => { A.osc('sine', 880, 880, t, 0.18, out, 0.4); A.osc('sine', 1320, 1320, t + 0.09, 0.3, out, 0.4); A.osc('triangle', 1760, 1760, t + 0.18, 0.35, out, 0.25); });
registerSfx('empty', (A, out, t) => { A.osc('square', 180, 120, t, 0.05, out, 0.3); A.osc('square', 180, 120, t + 0.09, 0.05, out, 0.3); });
registerSfx('hurt', (A, out, t) => { A.osc('square', 320, 140, t, 0.16, out, 0.3); A.noiseBurst(t, 0.12, out, { type: 'lowpass', f0: 1500, f1: 300, gain: 0.5 }); });
registerSfx('splat_death', (A, out, t) => {
  A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 3000, f1: 150, q: 4, gain: 1 });
  A.osc('sawtooth', 500, 60, t, 0.55, out, 0.4);
  A.osc('sine', 150, 40, t, 0.5, out, 0.7);
});
registerSfx('dive', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 700 * p, 180 * p, t, 0.16, out, 0.5);
  A.noiseBurst(t, 0.18, out, { type: 'lowpass', f0: 1800, f1: 300, q: 5, gain: 0.5 });
});
registerSfx('squish', (A, out, t) => A.osc('sine', 420, 240, t, 0.1, out, 0.4));
registerSfx('emerge', (A, out, t) => { A.osc('sine', 220, 640, t, 0.12, out, 0.4); A.noiseBurst(t, 0.1, out, { type: 'lowpass', f0: 600, f1: 2200, q: 4, gain: 0.35 }); });
registerSfx('splash', (A, out, t) => {
  A.noiseBurst(t, 0.3, out, { f0: 1600, f1: 500, q: 1.2, gain: 0.7 });
  for (let i = 0; i < 4; i++) A.osc('sine', 900 + Math.random() * 1500, 600, t + 0.05 + Math.random() * 0.15, 0.05, out, 0.12);
});
registerSfx('jump', (A, out, t, o) => A.osc('sine', 300 * (o.pitch ?? 1), 560 * (o.pitch ?? 1), t, 0.08, out, 0.35));
registerSfx('land', (A, out, t) => { A.osc('sine', 130, 55, t, 0.09, out, 0.6); A.noiseBurst(t, 0.07, out, { type: 'lowpass', f0: 700, f1: 200, gain: 0.4 }); });
registerSfx('swim', (A, out, t, o) => A.noiseBurst(t, 0.1, out, { type: 'lowpass', f0: 900 * (o.pitch ?? 1), f1: 400, q: 6, gain: 0.5 }));
registerSfx('ui_move', (A, out, t) => A.osc('sine', 1250, 1250, t, 0.035, out, 0.25));
registerSfx('ui_select', (A, out, t) => { A.osc('sine', 880, 880, t, 0.06, out, 0.3); A.osc('sine', 1320, 1320, t + 0.05, 0.1, out, 0.3); });
registerSfx('ui_back', (A, out, t) => { A.osc('sine', 880, 880, t, 0.06, out, 0.3); A.osc('sine', 587, 587, t + 0.05, 0.1, out, 0.3); });
registerSfx('error', (A, out, t) => A.osc('square', 150, 130, t, 0.18, out, 0.25));
registerSfx('checkpoint', (A, out, t) => [0, 4, 7, 12].forEach((s, i) => A.osc('triangle', 523 * 2 ** (s / 12), 523 * 2 ** (s / 12), t + i * 0.08, 0.25, out, 0.3)));
registerSfx('pickup', (A, out, t) => { A.osc('sine', 1760, 1760, t, 0.08, out, 0.3); A.osc('sine', 2637, 2637, t + 0.05, 0.14, out, 0.25); });
registerSfx('victory', (A, out, t) => [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => A.osc('square', 392 * 2 ** (s / 12), 392 * 2 ** (s / 12), t + i * 0.11, 0.2, out, 0.14)));
registerSfx('defeat', (A, out, t) => [7, 4, 0, -5].forEach((s, i) => A.osc('triangle', 392 * 2 ** (s / 12), 392 * 2 ** (s / 12), t + i * 0.18, 0.3, out, 0.25)));
registerSfx('enemy_die', (A, out, t) => {
  A.osc('sine', 600, 1400, t, 0.06, out, 0.3);
  A.noiseBurst(t + 0.03, 0.35, out, { type: 'lowpass', f0: 2500, f1: 200, q: 4, gain: 0.8 });
  A.osc('sine', 200, 60, t + 0.03, 0.3, out, 0.5);
});
registerSfx('alert', (A, out, t) => { A.osc('square', 988, 988, t, 0.05, out, 0.2); A.osc('square', 1318, 1318, t + 0.07, 0.07, out, 0.2); });
registerSfx('charge', (A, out, t, o) => A.osc('sawtooth', 200 + (o.level ?? 0) * 600, 220 + (o.level ?? 0) * 700, t, 0.08, out, 0.12));
registerSfx('door', (A, out, t) => { A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 500, f1: 150, q: 2, gain: 0.6 }); A.osc('sawtooth', 70, 50, t, 0.6, out, 0.2); });
registerSfx('launch', (A, out, t) => { A.osc('sawtooth', 200, 1200, t, 0.35, out, 0.25); A.noiseBurst(t, 0.5, out, { f0: 400, f1: 3000, q: 1, gain: 0.5 }); });
registerSfx('superjump', (A, out, t) => { A.osc('sine', 300, 1600, t, 0.6, out, 0.3); A.noiseBurst(t, 0.7, out, { f0: 300, f1: 2500, q: 2, gain: 0.35, attack: 0.2 }); });
registerSfx('count', (A, out, t) => A.osc('square', 880, 880, t, 0.1, out, 0.2));
registerSfx('go', (A, out, t) => { A.osc('square', 1320, 1320, t, 0.35, out, 0.22); A.osc('square', 1760, 1760, t, 0.35, out, 0.12); });
registerSfx('whistle', (A, out, t) => { A.osc('sine', 2200, 2400, t, 0.25, out, 0.25); A.osc('sine', 2400, 2000, t + 0.25, 0.45, out, 0.25); });
registerSfx('break', (A, out, t) => { A.noiseBurst(t, 0.3, out, { type: 'highpass', f0: 2500, q: 0.8, gain: 0.6 }); A.osc('square', 400, 120, t, 0.2, out, 0.2); });
registerSfx('coin', (A, out, t) => { A.osc('square', 988, 988, t, 0.07, out, 0.15); A.osc('square', 1318, 1318, t + 0.07, 0.18, out, 0.15); });
registerSfx('rumble', (A, out, t) => A.noiseBurst(t, 1.2, out, { type: 'lowpass', f0: 200, f1: 80, q: 1, gain: 0.8, attack: 0.2 }));
registerSfx('laser', (A, out, t) => A.osc('sawtooth', 1800, 1200, t, 0.2, out, 0.12));
