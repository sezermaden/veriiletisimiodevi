// Synthesised instruments for the procedural soundtrack. Every voice is built from native
// WebAudio nodes, is enveloped from 0 to 0 (no clicks) and stops its sources when done.
// All methods: (dest, t, …) where dest is an AudioNode and t an AudioContext time.
import { mtof } from './theory.js';

// vowel formants (F1, F2, F3 in Hz) for the vocal chop
const VOWELS = {
  a: [820, 1200, 2800], e: [500, 1850, 2600], i: [320, 2250, 3000], o: [520, 880, 2600], u: [350, 720, 2450],
};
// syllable = consonant flavour + vowel glide
const SYLLABLES = {
  ya: ['', 'i', 'a'], yo: ['', 'i', 'o'], ye: ['', 'i', 'e'], wa: ['', 'u', 'a'], wo: ['', 'u', 'o'], wee: ['', 'u', 'i'],
  ay: ['', 'a', 'i'], oh: ['', 'o', 'o'], ah: ['', 'a', 'a'], ee: ['', 'i', 'i'], oo: ['', 'u', 'u'], oi: ['', 'o', 'i'],
  la: ['l', 'e', 'a'], na: ['n', 'e', 'a'], da: ['d', 'e', 'a'], do: ['d', 'o', 'u'], di: ['d', 'e', 'i'],
  ta: ['t', 'e', 'a'], ti: ['t', 'i', 'i'], ka: ['k', 'e', 'a'], ha: ['h', 'a', 'a'], hey: ['h', 'e', 'i'],
  hoo: ['h', 'u', 'u'], sha: ['s', 'e', 'a'], shoo: ['s', 'u', 'u'], yeah: ['', 'i', 'e'], wow: ['', 'u', 'o'],
};
export const DEFAULT_SYLLABLES = ['ya', 'oh', 'ee', 'wa', 'la', 'yo', 'ay', 'oo'];

export class Instruments {
  /** @param {BaseAudioContext} ctx  @param {AudioBuffer} noise mono white noise (≥1 s) */
  constructor(ctx, noise) {
    this.ctx = ctx;
    this.noise = noise || makeNoise(ctx);
    this._curves = new Map();
    this.active = 0;          // voices currently sounding (for the scheduler's voice cap)
    this.peakActive = 0;
  }

  // ------------------------------------------------------------------ helpers
  /** Per-voice output node; free() detaches it from the graph when the voice's last source ends,
   *  so finished voices stop costing audio-thread time even before garbage collection runs. */
  voice(dest) { const v = this.ctx.createGain(); v.connect(dest); this.active++; this.peakActive = Math.max(this.peakActive, this.active); return v; }

  free(src, v) {
    src.onended = () => this.release(v);
  }

  /** Detach a voice now (also used for voices that ended up with no source). */
  release(v) {
    if (v._freed) return;
    v._freed = true;
    this.active = Math.max(0, this.active - 1);
    try { v.disconnect(); } catch { /* already gone */ }
  }

  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  filter(type, f, q = 0.707) {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }

  osc(type, f, t) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }

  noiseSrc(t, dur, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    const span = this.noise.duration;
    if (dur * rate > span - 0.1) { s.loop = true; s.start(t, Math.random() * span); }
    else s.start(t, Math.random() * (span - dur * rate - 0.05));
    s.stop(t + dur + 0.03);
    return s;
  }

  /** Soft-clip curve (cached): tanh(k·x)/tanh(k). */
  shaper(drive = 2) {
    const k = Math.round(drive * 10) / 10;
    let c = this._curves.get(k);
    if (!c) {
      c = new Float32Array(1024);
      const n = Math.tanh(k);
      for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(k * x) / n; }
      this._curves.set(k, c);
    }
    const w = this.ctx.createWaveShaper();
    w.curve = c;
    w.oversample = 'none';
    return w;
  }

  /** ADSR from 0 back to exactly 0. Returns the time the voice is silent. */
  adsr(P, t, dur, a, d, s, r, peak) {
    P.setValueAtTime(0, t);
    const relT = t + Math.max(0.004, dur);
    let relV;
    if (dur <= a) {
      relV = peak * Math.max(0.05, dur / a);
      P.linearRampToValueAtTime(relV, relT);
    } else {
      P.linearRampToValueAtTime(peak, t + a);
      const sus = Math.max(1e-4, peak * s);
      if (dur < a + d) {
        relV = peak * Math.pow(sus / peak, (dur - a) / d);
        P.exponentialRampToValueAtTime(Math.max(1e-4, relV), relT);
      } else {
        P.exponentialRampToValueAtTime(sus, t + a + d);
        relV = sus;
        P.setValueAtTime(sus, relT);
      }
    }
    const end = relT + Math.max(0.01, r);
    if (relV > 2e-4) P.exponentialRampToValueAtTime(1e-4, end);
    else P.linearRampToValueAtTime(1e-4, end);
    P.linearRampToValueAtTime(0, end + 0.004);
    return end + 0.006;
  }

  /** Percussive two-stage decay (holds body, then tails off). */
  hit(P, t, a, dec, peak, body = 0.35) {
    P.setValueAtTime(0, t);
    P.linearRampToValueAtTime(peak, t + a);
    P.exponentialRampToValueAtTime(Math.max(1e-4, peak * body), t + a + dec * 0.35);
    P.exponentialRampToValueAtTime(1e-4, t + a + dec);
    P.linearRampToValueAtTime(0, t + a + dec + 0.004);
    return t + a + dec + 0.006;
  }

  // ------------------------------------------------------------------ drums
  kick(dest, t, v, o = {}) {
    dest = this.voice(dest);
    const f0 = o.f0 ?? 150, f1 = o.f1 ?? 47, pd = o.pd ?? 0.07, dec = o.dec ?? 0.36;
    const osc = this.osc('sine', f0 * 2.2, t);
    osc.frequency.exponentialRampToValueAtTime(f0, t + 0.01);
    osc.frequency.exponentialRampToValueAtTime(f1, t + 0.01 + pd);
    const g = this.gain(0);
    const end = this.hit(g.gain, t, 0.0015, dec, v * (o.vol ?? 1), 0.45);
    osc.connect(g);
    if (o.drive) g.connect(this.shaper(o.drive)).connect(dest); else g.connect(dest);
    osc.start(t); osc.stop(end);
    this.free(osc, dest);
    const click = o.click ?? 0.3;
    if (click > 0) {
      const n = this.noiseSrc(t, 0.02);
      const hp = this.filter('highpass', 1600);
      const ng = this.gain(0);
      this.hit(ng.gain, t, 0.0005, 0.012, v * click, 0.3);
      n.connect(hp).connect(ng).connect(dest);
    }
  }

  snare(dest, t, v, o = {}) {
    dest = this.voice(dest);
    const body = this.osc('triangle', (o.tune ?? 1) * 230, t);
    body.frequency.exponentialRampToValueAtTime((o.tune ?? 1) * 165, t + 0.05);
    const bg = this.gain(0);
    const e1 = this.hit(bg.gain, t, 0.001, 0.1, v * 0.6, 0.4);
    body.connect(bg).connect(dest);
    body.start(t); body.stop(e1);
    const dec = o.dec ?? 0.19;
    const n = this.noiseSrc(t, dec + 0.02);
    const hp = this.filter('highpass', o.hp ?? 1100);
    const lp = this.filter('lowpass', o.lp ?? 8000);
    const ng = this.gain(0);
    this.hit(ng.gain, t, 0.001, dec, v * 0.75 * (o.vol ?? 1), 0.3);
    n.connect(hp).connect(lp).connect(ng).connect(dest);
    this.free(n, dest);
  }

  clap(dest, t, v, o = {}) {
    dest = this.voice(dest);
    const n = this.noiseSrc(t, 0.3);
    const bp = this.filter('bandpass', o.f ?? 1150, 1.1);
    const hp = this.filter('highpass', 500);
    const g = this.gain(0);
    const P = g.gain;
    P.setValueAtTime(0, t);
    for (let i = 0; i < 3; i++) {
      const ti = t + i * 0.0105;
      P.linearRampToValueAtTime(v * 0.9, ti + 0.0008);
      P.exponentialRampToValueAtTime(v * 0.12, ti + 0.0095);
    }
    const t3 = t + 0.0315;
    P.linearRampToValueAtTime(v, t3 + 0.001);
    const dec = o.dec ?? 0.17;
    P.exponentialRampToValueAtTime(1e-4, t3 + dec);
    P.linearRampToValueAtTime(0, t3 + dec + 0.004);
    n.connect(hp).connect(bp).connect(g).connect(dest);
    this.free(n, dest);
  }

  /** Closed or open hat. Open hats return a choke function. */
  hat(dest, t, v, open = false, o = {}) {
    dest = this.voice(dest);
    const dec = open ? (o.openDec ?? 0.34) : (o.dec ?? 0.045) + v * 0.02;
    const n = this.noiseSrc(t, dec + 0.02);
    const hp = this.filter('highpass', o.hp ?? 7000, 0.9);
    const pk = this.filter('peaking', 10500, 1.2); pk.gain.value = 6;
    const g = this.gain(0);
    this.hit(g.gain, t, open ? 0.003 : 0.0008, dec, v * (open ? 0.42 : 0.5), open ? 0.45 : 0.3);
    n.connect(hp).connect(pk).connect(g);
    this.free(n, dest);
    if (!open) { g.connect(dest); return null; }
    const choke = this.gain(1);
    g.connect(choke).connect(dest);
    return (tc) => {
      if (tc >= t + dec) return;
      choke.gain.setValueAtTime(1, tc);
      choke.gain.linearRampToValueAtTime(0, tc + 0.025);
    };
  }

  tom(dest, t, v, k = 'b', o = {}) {
    dest = this.voice(dest);
    const f = (k === 'a' ? 210 : k === 'b' ? 155 : 112) * (o.tune ?? 1);
    const osc = this.osc('sine', f * 1.35, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.02);
    osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.3);
    const g = this.gain(0);
    const end = this.hit(g.gain, t, 0.002, 0.34, v * 0.85, 0.5);
    osc.connect(g).connect(dest);
    osc.start(t); osc.stop(end);
    this.free(osc, dest);
    const n = this.noiseSrc(t, 0.06);
    const bp = this.filter('bandpass', f * 6, 1.5);
    const ng = this.gain(0);
    this.hit(ng.gain, t, 0.001, 0.05, v * 0.3);
    n.connect(bp).connect(ng).connect(dest);
  }

  crash(dest, t, v, o = {}) {
    dest = this.voice(dest);
    const dec = o.dec ?? 1.7;
    const n = this.noiseSrc(t, dec + 0.05);
    const hp = this.filter('highpass', 3800, 0.7);
    const pk = this.filter('peaking', 7200, 2); pk.gain.value = 5;
    const g = this.gain(0);
    this.hit(g.gain, t, 0.004, dec, v * 0.5, 0.35);
    n.connect(hp).connect(pk).connect(g).connect(dest);
    this.free(n, dest);
  }

  perc(dest, t, v, k = 's') {
    dest = this.voice(dest);
    switch (k) {
      case 's': case 't': {             // shaker / tambourine
        const dec = k === 's' ? 0.06 : 0.14;
        const n = this.noiseSrc(t, dec + 0.02);
        const f = this.filter(k === 's' ? 'bandpass' : 'highpass', k === 's' ? 7800 : 6500, k === 's' ? 1.4 : 0.8);
        const g = this.gain(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(v * (k === 's' ? 0.6 : 0.5), t + (k === 's' ? 0.012 : 0.002));
        g.gain.exponentialRampToValueAtTime(1e-4, t + dec);
        g.gain.linearRampToValueAtTime(0, t + dec + 0.004);
        n.connect(f).connect(g).connect(dest);
        this.free(n, dest);
        if (k === 't') {
          const r = this.filter('bandpass', 9400, 6);
          const rg = this.gain(0);
          this.hit(rg.gain, t, 0.002, 0.18, v * 0.8);
          n.connect(r).connect(rg).connect(dest);
        }
        break;
      }
      case 'c': {                        // cowbell
        const bp = this.filter('bandpass', 900, 2.2);
        const g = this.gain(0);
        const end = this.hit(g.gain, t, 0.001, 0.26, v * 0.35, 0.25);
        for (const f of [562, 845]) { const o = this.osc('square', f, t); o.connect(bp); o.start(t); o.stop(end); this.free(o, dest); }
        bp.connect(g).connect(dest);
        break;
      }
      case 'h': case 'l': {              // congas
        const f = k === 'h' ? 330 : 220;
        const o = this.osc('sine', f * 1.12, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        const g = this.gain(0);
        const end = this.hit(g.gain, t, 0.002, 0.2, v * 0.6, 0.5);
        o.connect(g).connect(dest);
        o.start(t); o.stop(end);
        this.free(o, dest);
        break;
      }
      case 'r': case 'k': {              // rim / block
        const fs = k === 'r' ? [455, 1667] : [1850, 2710];
        const g = this.gain(0);
        const end = this.hit(g.gain, t, 0.0005, k === 'r' ? 0.035 : 0.05, v * 0.4, 0.3);
        const hp = this.filter('highpass', k === 'r' ? 300 : 900);
        for (const f of fs) { const o = this.osc(k === 'r' ? 'triangle' : 'sine', f, t); o.connect(hp); o.start(t); o.stop(end); this.free(o, dest); }
        hp.connect(g).connect(dest);
        break;
      }
      default: this.release(dest); break;   // unknown perc letter: no source, give the voice back
    }
  }

  // ------------------------------------------------------------------ tonal
  bass(dest, t, n, dur, v, o = {}, slideFrom = null, dead = false) {
    dest = this.voice(dest);
    const f = mtof(n);
    if (dead) dur = Math.min(dur, 0.05);
    const g = this.gain(0);
    const end = this.adsr(g.gain, t, dur, o.a ?? 0.004, o.d ?? 0.22, o.s ?? 0.6, o.r ?? 0.05, v * (o.vol ?? 0.9));
    const lp = this.filter('lowpass', o.cut ?? 380, o.res ?? 5);
    const base = dead ? 220 : (o.cut ?? 380);
    const peak = base + (dead ? 300 : (o.env ?? 1700)) * v;
    lp.frequency.setValueAtTime(peak, t);
    lp.frequency.exponentialRampToValueAtTime(base, t + (o.fdec ?? 0.16));
    const glide = o.glide ?? 0.06;
    const mk = (type, mult, det) => {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.detune.value = det;
      if (slideFrom != null) {
        osc.frequency.setValueAtTime(mtof(slideFrom) * mult, t);
        osc.frequency.exponentialRampToValueAtTime(f * mult, t + glide);
      } else osc.frequency.setValueAtTime(f * mult, t);
      osc.start(t); osc.stop(end);
      return osc;
    };
    const main = mk(o.wave ?? 'sawtooth', 1, 0);
    main.connect(lp);
    this.free(main, dest);
    if (o.detune) mk(o.wave2 ?? o.wave ?? 'sawtooth', 1, o.detune).connect(lp);
    let tail = lp;
    if (o.drive) tail = lp.connect(this.shaper(o.drive));
    tail.connect(g);
    const sub = o.sub ?? 0.45;
    if (sub > 0) {
      const sg = this.gain(sub);
      mk('sine', o.subOct === -1 ? 0.5 : 1, 0).connect(sg).connect(g);
    }
    g.connect(dest);
  }

  lead(dest, t, n, dur, v, o = {}, slideFrom = null) {
    dest = this.voice(dest);
    const f = mtof(n);
    const g = this.gain(0);
    const end = this.adsr(g.gain, t, dur, o.a ?? 0.006, o.d ?? 0.2, o.s ?? 0.72, o.r ?? 0.12, v * (o.vol ?? 1));
    const lp = this.filter('lowpass', o.cut ?? 3200, o.q ?? 1.2);
    const cut = o.cut ?? 3200;
    lp.frequency.setValueAtTime(cut * (1 + (o.fenv ?? 1.2) * v), t);
    lp.frequency.exponentialRampToValueAtTime(cut, t + (o.fdec ?? 0.22));
    const lfo = this.osc('sine', o.vibRate ?? 5.6, t);
    const lg = this.gain(0);
    lg.gain.setValueAtTime(0, t);
    lg.gain.setValueAtTime(0, t + Math.min(dur, o.vibDelay ?? 0.16));
    lg.gain.linearRampToValueAtTime(o.vib ?? 16, t + Math.min(dur, o.vibDelay ?? 0.16) + 0.25);
    lfo.connect(lg);
    lfo.start(t); lfo.stop(end);
    const det = o.detune ?? 7;
    const waves = [o.wave ?? 'square', o.wave2 ?? 'sawtooth'];
    waves.forEach((w, i) => {
      if (!w) return;
      const osc = this.ctx.createOscillator();
      osc.type = w;
      osc.detune.value = i ? det : -det;
      const mult = i && o.oct2 ? 2 ** o.oct2 : 1;
      if (slideFrom != null) {
        osc.frequency.setValueAtTime(mtof(slideFrom) * mult, t);
        osc.frequency.exponentialRampToValueAtTime(f * mult, t + (o.glide ?? 0.07));
      } else osc.frequency.setValueAtTime(f * mult, t);
      lg.connect(osc.detune);
      const og = this.gain(i ? (o.mix2 ?? 0.6) : 1);
      osc.connect(og).connect(lp);
      osc.start(t); osc.stop(end);
      this.free(osc, dest);
    });
    let tail = lp;
    if (o.drive) tail = lp.connect(this.shaper(o.drive));
    tail.connect(g).connect(dest);
  }

  pluck(dest, t, n, dur, v, o = {}) {
    dest = this.voice(dest);
    const f = mtof(n);
    const g = this.gain(0);
    const end = this.adsr(g.gain, t, dur, 0.002, o.d ?? 0.16, o.s ?? 0.12, o.r ?? 0.07, v * (o.vol ?? 1));
    const lp = this.filter('lowpass', o.cut ?? 900, o.q ?? 3);
    const cut = o.cut ?? 900;
    lp.frequency.setValueAtTime(cut + (o.env ?? 3800) * v, t);
    lp.frequency.exponentialRampToValueAtTime(cut, t + (o.fdec ?? 0.12));
    const osc = this.osc(o.wave ?? 'sawtooth', f, t);
    osc.connect(lp);
    osc.start(t); osc.stop(end);
    this.free(osc, dest);
    if (o.detune) {
      const o2 = this.osc(o.wave2 ?? o.wave ?? 'sawtooth', f, t);
      o2.detune.value = o.detune;
      o2.connect(lp); o2.start(t); o2.stop(end);
    }
    lp.connect(g).connect(dest);
  }

  pad(dest, t, ns, dur, v, o = {}) {
    dest = this.voice(dest);
    const g = this.gain(0);
    const voices = ns.length * 2;
    const end = this.adsr(g.gain, t, dur, o.a ?? 0.35, o.d ?? 0.6, o.s ?? 0.85, o.r ?? 0.9, v * (o.vol ?? 1) / Math.sqrt(voices));
    const cut = o.cut ?? 1500;
    const lp = this.filter('lowpass', cut, o.q ?? 0.9);
    lp.frequency.setValueAtTime(cut * 0.45, t);
    lp.frequency.linearRampToValueAtTime(cut, t + Math.min(dur, (o.a ?? 0.35) * 2 + 0.2));
    const det = o.detune ?? 10;
    for (const n of ns) {
      const f = mtof(n);
      for (const s of [-1, 1]) {
        const osc = this.osc(o.wave ?? 'sawtooth', f, t);
        osc.detune.value = s * det + (Math.random() - 0.5) * 3;
        osc.connect(lp);
        osc.start(t); osc.stop(end);
        this.free(osc, dest);
      }
    }
    lp.connect(g).connect(dest);
  }

  stab(dest, t, ns, dur, v, o = {}) {
    dest = this.voice(dest);
    const g = this.gain(0);
    const end = this.adsr(g.gain, t, dur, 0.003, o.d ?? 0.11, o.s ?? 0.3, o.r ?? 0.05, v * (o.vol ?? 1) / Math.sqrt(ns.length));
    let head;
    if (o.kind === 'skank') {
      head = this.filter('highpass', 520, 0.8);
      const lp = this.filter('lowpass', 3200, 1.4);
      head.connect(lp).connect(g);
    } else {
      head = this.filter('lowpass', o.cut ?? 2200, o.q ?? 2);
      head.frequency.setValueAtTime((o.cut ?? 2200) * 2.2, t);
      head.frequency.exponentialRampToValueAtTime(o.cut ?? 2200, t + 0.08);
      head.connect(g);
    }
    for (const n of ns) {
      const osc = this.osc(o.wave ?? 'square', mtof(n), t);
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(head); osc.start(t); osc.stop(end);
      this.free(osc, dest);
    }
    g.connect(dest);
  }

  /** FM bell / mallet / electric piano / glockenspiel. */
  bell(dest, t, n, dur, v, o = {}) {
    dest = this.voice(dest);
    const kind = o.kind ?? 'bell';
    const P = {
      bell: { ratio: 3.5, index: 2.6, idec: 0.5, dec: 1.5 },
      glock: { ratio: 5.19, index: 1.2, idec: 0.2, dec: 1.0 },
      mallet: { ratio: 4.0, index: 1.6, idec: 0.06, dec: 0.5 },
      ep: { ratio: 1.0, index: 1.7, idec: 0.45, dec: 1.4 },
    }[kind] || { ratio: 3.5, index: 2.6, idec: 0.5, dec: 1.5 };
    const f = mtof(n);
    const car = this.osc('sine', f, t);
    const mod = this.osc('sine', f * P.ratio, t);
    const mg = this.gain(0);
    const idx = f * (o.index ?? P.index) * (0.5 + v * 0.6);
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(idx * 0.08 + 0.01, t + P.idec);
    mod.connect(mg).connect(car.frequency);
    const g = this.gain(0);
    let end;
    if (kind === 'ep') end = this.adsr(g.gain, t, Math.min(dur, 1.6), 0.003, 0.8, 0.35, 0.3, v * (o.vol ?? 1));
    else end = this.hit(g.gain, t, 0.002, o.dec ?? P.dec, v * (o.vol ?? 1), 0.3);
    car.connect(g).connect(dest);
    car.start(t); mod.start(t); car.stop(end); mod.stop(end);
    this.free(car, dest);
  }

  /** The 'squid vocal chop': a formant-filtered saw syllable with a scoop / slide. */
  chop(dest, t, n, dur, v, o = {}, slideFrom = null, syl = null) {
    dest = this.voice(dest);
    const f = mtof(n);
    const [cons, v1, v2] = SYLLABLES[syl] || SYLLABLES.ya;
    const shift = o.shift ?? 1.22;
    const amp = this.gain(0);
    const end = this.adsr(amp.gain, t, dur, o.a ?? 0.012, o.d ?? 0.12, o.s ?? 0.78, o.r ?? 0.08, v * (o.vol ?? 1));
    const src = this.ctx.createOscillator();
    src.type = 'sawtooth';
    if (slideFrom != null) {
      src.frequency.setValueAtTime(mtof(slideFrom), t);
      src.frequency.exponentialRampToValueAtTime(f, t + (o.glide ?? 0.09));
    } else {
      src.frequency.setValueAtTime(f * 2 ** (-(o.scoop ?? 1.6) / 12), t);
      src.frequency.exponentialRampToValueAtTime(f, t + 0.055);
    }
    if (o.fall && dur > 0.18) {
      src.frequency.setValueAtTime(f, t + dur - 0.02);
      src.frequency.exponentialRampToValueAtTime(f * 2 ** (-o.fall / 12), t + dur + (o.r ?? 0.08));
    }
    // vibrato on long notes
    if (dur > 0.25) {
      const lfo = this.osc('sine', o.vibRate ?? 6.2, t);
      const lg = this.gain(0);
      lg.gain.setValueAtTime(0, t + 0.15);
      lg.gain.linearRampToValueAtTime(o.vib ?? 28, t + 0.4);
      lfo.connect(lg).connect(src.detune);
      lfo.start(t); lfo.stop(end);
    }
    src.start(t); src.stop(end);
    this.free(src, dest);
    const A = VOWELS[v1], B = VOWELS[v2];
    const glideT = t + Math.min(dur * 0.6, 0.16);
    const qs = [6.5, 9, 11], lv = [1, 0.78, 0.42];
    for (let k = 0; k < 3; k++) {
      const bp = this.filter('bandpass', A[k] * shift, qs[k]);
      bp.frequency.setValueAtTime(A[k] * shift, t + 0.02);
      bp.frequency.linearRampToValueAtTime(B[k] * shift, glideT);
      const fg = this.gain(lv[k] * (o.bright && k ? o.bright : 1));
      src.connect(bp).connect(fg).connect(amp);
    }
    // a little direct body so it is not all nasal
    const body = this.filter('lowpass', f * 2.5, 0.7);
    const bg = this.gain(0.09);
    src.connect(body).connect(bg).connect(amp);
    amp.connect(dest);
    // consonant
    if (cons) {
      const ns = this.noiseSrc(t, 0.06);
      const hp = this.filter(cons === 'h' ? 'bandpass' : 'highpass', cons === 'h' ? 1800 : cons === 's' ? 5000 : 3200, cons === 'h' ? 0.6 : 0.8);
      const cg = this.gain(0);
      const cl = cons === 'h' ? 0.04 : cons === 's' ? 0.05 : 0.012;
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(v * (cons === 's' ? 0.12 : 0.18) * (o.vol ?? 1) * 0.35, t + 0.002);
      cg.gain.exponentialRampToValueAtTime(1e-4, t + cl);
      cg.gain.linearRampToValueAtTime(0, t + cl + 0.004);
      ns.connect(hp).connect(cg).connect(dest);
    }
  }

  /** Noise riser across `dur` seconds (into a drop). */
  riser(dest, t, dur, v) {
    dest = this.voice(dest);
    const n = this.noiseSrc(t, dur + 0.05);
    const bp = this.filter('bandpass', 350, 1.6);
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(7500, t + dur);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * 0.02, t + 0.05);
    g.gain.exponentialRampToValueAtTime(v * 0.5, t + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    n.connect(bp).connect(g).connect(dest);
    this.free(n, dest);
  }

  impact(dest, t, v) {
    dest = this.voice(dest);
    const o = this.osc('sine', 110, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.7);
    const g = this.gain(0);
    const end = this.hit(g.gain, t, 0.002, 1.1, v * 0.9, 0.5);
    o.connect(g).connect(dest);
    o.start(t); o.stop(end);
    this.free(o, dest);
    const n = this.noiseSrc(t, 0.9);
    const lp = this.filter('lowpass', 1400, 0.8);
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + 0.8);
    const ng = this.gain(0);
    this.hit(ng.gain, t, 0.002, 0.85, v * 0.45);
    n.connect(lp).connect(ng).connect(dest);
  }
}

export function makeNoise(ctx, secs = 2) {
  const len = Math.floor(ctx.sampleRate * secs);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Procedural stereo room impulse: early reflections + a darkening exponential tail. */
export function makeImpulse(ctx, secs = 2.2, decay = 3.2, bright = 0.8) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * secs);
  const buf = ctx.createBuffer(2, len, rate);
  const pre = Math.floor(rate * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const x = (i - pre) / (len - pre);
      const a = bright * (1 - x) * 0.9 + 0.06;          // one-pole LPF coefficient: darker over time
      y += a * ((Math.random() * 2 - 1) - y);
      d[i] = y * Math.exp(-decay * x * 2.3);
    }
    for (let k = 0; k < 10; k++) {
      const i = pre + Math.floor(rate * (0.004 + Math.random() * 0.06));
      if (i < len) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.7 - k * 0.05);
    }
  }
  return buf;
}
