// Looping procedural ambience beds per stage theme. Continuous layers are looped noise buffers
// through filters (native, cheap); one-off details (gulls, clanks, thunder, car pass-bys…) are
// scheduled ~0.6 s ahead by a 250 ms timer. Driven by audio.ambience(themeId|null).
//
//   docks     waves + surf bed, gulls, buoy bell, distant ship horn
//   heights   city hum, wind, car pass-bys, distant honks, rooftop birds
//   refinery  machine hum + rumble, steam hiss, metal clanks, press thumps, bubbling vats
//   tower     rain (stereo), roof roar, drips, wind gusts, distant thunder
//   arena     crowd murmur, cheers, whistles, light breeze
//   plaza     softer murmur, breeze, fountain, birds
//   menu      none

const rnd = (a, b) => a + Math.random() * (b - a);
const TICK_MS = 250;
const AHEAD = 0.6;

export class Ambience {
  /** @param {{ctx: AudioContext, sfxBus: AudioNode, verbIn?: AudioNode}} audio */
  constructor(audio) {
    this.audio = audio;
    this.ctx = audio.ctx;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.55;
    this.out.connect(audio.ambBus || audio.sfxBus);
    this.scene = null;
    this.id = null;
    this.old = [];
    this._timer = null;
    this._bufs = null;
  }

  get current() { return this.id; }

  /** Switch to a theme's bed (null / 'menu' / unknown = silence). */
  set(id, fade = 2.2) {
    const key = id && SCENES[id] ? id : null;
    if (key === this.id) return;
    this.id = key;
    if (this.scene) { this.scene.stop(fade * 0.8); this.old.push(this.scene); this.scene = null; }
    if (key) {
      this._buffers();
      this.scene = new Scene(this, key, fade);
    }
    if (!this._timer) this._timer = setInterval(() => this._tick(), TICK_MS);
    this._tick();
  }

  _tick() {
    const now = this.ctx.currentTime;
    if (this.scene) this.scene.tick(now, now + AHEAD);
    for (let i = this.old.length - 1; i >= 0; i--) if (now > this.old[i].deadAt) { this.old[i].dispose(); this.old.splice(i, 1); }
    if (!this.scene && !this.old.length && this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _buffers() {
    if (this._bufs) return this._bufs;
    const ctx = this.ctx, sr = ctx.sampleRate;
    const len = Math.floor(sr * 4);
    // decorrelated stereo white noise
    const white = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) { const d = white.getChannelData(c); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; }
    // brown noise, made loop-seamless and DC-free
    const brown = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = brown.getChannelData(c);
      let y = 0;
      for (let i = 0; i < len; i++) { y = (y + 0.02 * (Math.random() * 2 - 1)) * 0.998; d[i] = y; }
      const drift = d[len - 1] - d[0];
      let mean = 0;
      for (let i = 0; i < len; i++) { d[i] -= drift * (i / len); mean += d[i]; }
      mean /= len;
      let peak = 0;
      for (let i = 0; i < len; i++) { d[i] -= mean; peak = Math.max(peak, Math.abs(d[i])); }
      for (let i = 0; i < len; i++) d[i] /= peak || 1;
    }
    this._bufs = { white, brown };
    return this._bufs;
  }

  dispose() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this.scene?.dispose();
    for (const s of this.old) s.dispose();
    this.old.length = 0;
    this.scene = null;
    this.id = null;
    try { this.out.disconnect(); } catch { /* */ }
  }
}

class Scene {
  constructor(amb, id, fade) {
    this.amb = amb;
    this.ctx = amb.ctx;
    this.id = id;
    this.nodes = [];
    this.sources = [];
    this.events = [];
    this.deadAt = Infinity;
    const t = this.ctx.currentTime;
    this.out = this.ctx.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + fade);
    this.out.connect(amb.out);
    this.nodes.push(this.out);
    SCENES[id](this);
  }

  // ---------------------------------------------------------------- building blocks
  g(v = 1) { const n = this.ctx.createGain(); n.gain.value = v; this.nodes.push(n); return n; }
  f(type, freq, q = 0.707) { const n = this.ctx.createBiquadFilter(); n.type = type; n.frequency.value = freq; n.Q.value = q; this.nodes.push(n); return n; }
  pan(v) { const p = this.ctx.createStereoPanner(); p.pan.value = v; this.nodes.push(p); return p; }

  /** Looping noise bed. kind 'white' | 'brown'. */
  loop(kind, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.amb._bufs[kind];
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(this.ctx.currentTime, Math.random() * 3.5);
    this.sources.push(s);
    return s;
  }

  lfo(freq, depth, param, type = 'sine') {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const d = this.g(depth);
    o.connect(d).connect(param);
    o.start();
    this.sources.push(o);
    return o;
  }

  tone(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    o.start();
    this.sources.push(o);
    return o;
  }

  /** Recurring random event: fn(t) every [min,max] seconds (first after `first`). */
  every(min, max, fn, first = null) {
    this.events.push({ next: this.ctx.currentTime + (first ?? rnd(min * 0.3, max)), min, max, fn });
  }

  tick(now, until) {
    for (const e of this.events) {
      let guard = 0;
      if (e.next < now - 1) e.next = now + rnd(0, e.min);
      while (e.next < until && guard++ < 64) {
        try { e.fn(Math.max(now, e.next)); } catch (err) { console.warn('ambience', err); }
        e.next += rnd(e.min, e.max);
      }
    }
  }

  // one-shot helpers (nodes are disposable; they end by themselves)
  shot(t, dur, build, pan = null) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    let p = null;
    if (pan != null && ctx.createStereoPanner) { p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p).connect(this.out); } else out.connect(this.out);
    build(out, ctx);
    setTimeout(() => { try { out.disconnect(); p?.disconnect(); } catch { /* */ } }, (t - ctx.currentTime + dur + 0.5) * 1000);
  }

  noiseShot(out, t, dur, kind = 'white') {
    const s = this.ctx.createBufferSource();
    s.buffer = this.amb._bufs[kind];
    const span = s.buffer.duration;
    if (dur + 0.1 > span - 0.3) { s.loop = true; s.start(t, Math.random() * span); }   // long shots wrap instead of running off the end
    else s.start(t, Math.random() * (span - dur - 0.1));
    s.stop(t + dur + 0.05);
    return s;
  }

  env(param, t, a, hold, r, peak) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) param.setValueAtTime(peak, t + a + hold);
    param.exponentialRampToValueAtTime(Math.max(1e-4, peak * 0.001), t + a + hold + r);
    param.linearRampToValueAtTime(0, t + a + hold + r + 0.01);
    return t + a + hold + r + 0.02;
  }

  stop(fade) {
    const t = this.ctx.currentTime;
    const P = this.out.gain;
    P.cancelScheduledValues(t);
    P.setValueAtTime(P.value, t);
    P.linearRampToValueAtTime(0, t + fade);
    this.events.length = 0;
    this.deadAt = t + fade + 0.2;
  }

  dispose() {
    for (const s of this.sources) { try { s.stop(); } catch { /* */ } try { s.disconnect(); } catch { /* */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* */ } }
    this.sources.length = 0;
    this.nodes.length = 0;
  }
}

// ------------------------------------------------------------------------------------------------
// Detail sounds shared by several scenes
function gull(S, t) {
  S.shot(t, 1.2, (out, ctx) => {
    const calls = Math.random() < 0.5 ? 1 : Math.floor(rnd(2, 4));
    const base = rnd(1150, 1500), vol = rnd(0.025, 0.06);
    for (let i = 0; i < calls; i++) {
      const t0 = t + i * rnd(0.22, 0.32);
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(base * 1.25, t0);
      o.frequency.linearRampToValueAtTime(base * 1.6, t0 + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.8, t0 + 0.22);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 1.4; bp.Q.value = 1.8;
      const g = ctx.createGain();
      S.env(g.gain, t0, 0.02, 0.06, 0.14, vol);
      o.connect(bp).connect(g).connect(out);
      o.start(t0); o.stop(t0 + 0.3);
    }
  }, rnd(-0.8, 0.8));
}

function bird(S, t) {
  S.shot(t, 1, (out, ctx) => {
    const n = Math.floor(rnd(2, 5)), f = rnd(2800, 4200), vol = rnd(0.012, 0.03);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * rnd(0.09, 0.14);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f * rnd(0.9, 1.1), t0);
      o.frequency.exponentialRampToValueAtTime(f * rnd(1.2, 1.5), t0 + 0.06);
      const g = ctx.createGain();
      S.env(g.gain, t0, 0.008, 0.02, 0.05, vol);
      o.connect(g).connect(out);
      o.start(t0); o.stop(t0 + 0.1);
    }
  }, rnd(-0.9, 0.9));
}

function carPass(S, t) {
  S.shot(t, 5, (out, ctx) => {
    const dur = rnd(2.5, 4.5), dir = Math.random() < 0.5 ? -1 : 1, vol = rnd(0.05, 0.11);
    const src = S.noiseShot(out, t, dur, 'brown');
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.linearRampToValueAtTime(560, t + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(-0.9 * dir, t);
    p.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
    src.connect(bp).connect(g).connect(p).connect(out);
  });
}

function honk(S, t) {
  S.shot(t, 1, (out, ctx) => {
    const f = rnd(330, 440), vol = rnd(0.01, 0.022);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = ctx.createGain();
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const t0 = t + i * 0.28;
      for (const m of [1, 1.26]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * m; o.connect(lp); o.start(t0); o.stop(t0 + 0.22); }
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.setValueAtTime(vol, t0 + 0.18); g.gain.linearRampToValueAtTime(0, t0 + 0.22);
    }
    const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.7, 0.7);
    lp.connect(g).connect(p).connect(out);
  });
}

function clank(S, t, vol = rnd(0.03, 0.08)) {
  S.shot(t, 1.2, (out, ctx) => {
    const f = rnd(180, 520);
    const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.8, 0.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = rnd(2500, 5000);
    lp.connect(p).connect(out);
    [1, 2.76, 5.4, 8.93].forEach((k, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * k;
      const g = ctx.createGain();
      S.env(g.gain, t, 0.002, 0, rnd(0.25, 0.8) / (i + 1), vol / (i + 1));
      o.connect(g).connect(lp); o.start(t); o.stop(t + 1);
    });
    const n = S.noiseShot(out, t, 0.04);
    const ng = ctx.createGain(); S.env(ng.gain, t, 0.001, 0, 0.03, vol * 0.8);
    n.connect(ng).connect(lp);
  });
}

function steam(S, t) {
  S.shot(t, 3, (out, ctx) => {
    const dur = rnd(0.6, 1.6), vol = rnd(0.03, 0.07);
    const n = S.noiseShot(out, t, dur + 0.8);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(4500, 7000); bp.Q.value = 0.8;
    const g = ctx.createGain(); S.env(g.gain, t, 0.08, dur, 0.6, vol);
    const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.8, 0.8);
    n.connect(hp).connect(bp).connect(g).connect(p).connect(out);
  });
}

function thunder(S, t) {
  S.shot(t, 6, (out, ctx) => {
    const near = Math.random() < 0.3, vol = near ? rnd(0.3, 0.45) : rnd(0.14, 0.26);
    if (near) {
      const c = S.noiseShot(out, t, 0.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      const g = ctx.createGain(); S.env(g.gain, t, 0.003, 0.02, 0.35, vol * 0.5);
      c.connect(lp).connect(g).connect(out);
    }
    const t1 = t + (near ? 0.05 : rnd(0.2, 0.8));
    const dur = rnd(2.5, 4.5);
    const n = S.noiseShot(out, t1, dur + 0.3, 'brown');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = near ? 400 : 180; lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t1);
    let tt = t1;
    const rolls = Math.floor(rnd(3, 6));
    for (let i = 0; i < rolls; i++) {
      tt += rnd(0.15, 0.6);
      g.gain.linearRampToValueAtTime(vol * rnd(0.5, 1), tt);
      g.gain.linearRampToValueAtTime(vol * rnd(0.2, 0.45), tt + rnd(0.2, 0.5));
    }
    g.gain.linearRampToValueAtTime(0, t1 + dur);
    n.connect(lp).connect(g).connect(out);
  });
}

function drip(S, t) {
  S.shot(t, 0.4, (out, ctx) => {
    const f = rnd(1400, 3200), vol = rnd(0.008, 0.03);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.7, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.04);
    const g = ctx.createGain(); S.env(g.gain, t, 0.002, 0, 0.05, vol);
    const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.9, 0.9);
    o.connect(g).connect(p).connect(out); o.start(t); o.stop(t + 0.08);
  });
}

function crowdSwell(S, t, vol = 0.12, dur = 2) {
  S.shot(t, dur + 1, (out, ctx) => {
    for (const [f, q] of [[600, 2], [1300, 2.5], [2600, 3]]) {
      const n = S.noiseShot(out, t, dur + 0.3);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rnd(0.9, 1.1); bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.25);
      g.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.6);
      g.gain.linearRampToValueAtTime(0, t + dur);
      n.connect(bp).connect(g).connect(out);
    }
  });
}

function whistleCall(S, t, vol = 0.03) {
  S.shot(t, 1, (out, ctx) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = rnd(1800, 2400);
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 1.25, t + 0.2);
    o.frequency.setValueAtTime(f * 1.05, t + 0.3);
    o.frequency.linearRampToValueAtTime(f * 1.3, t + 0.55);
    const g = ctx.createGain(); S.env(g.gain, t, 0.02, 0.45, 0.1, vol);
    const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.8, 0.8);
    o.connect(g).connect(p).connect(out); o.start(t); o.stop(t + 0.7);
  });
}

function murmur(S, level) {
  // babble: voice-formant bands (weighted towards 250–1000 Hz) with syllable-rate wobble
  [[260, 1.6, 3.7, 1.6], [540, 3, 4.1, 1.3], [1150, 3.5, 5.3, 0.55], [2400, 4, 6.7, 0.16]].forEach(([f, q, rate, w], i) => {
    const src = S.loop(i ? 'white' : 'brown', 1 - i * 0.03);
    const bp = S.f('bandpass', f, q);
    const g = S.g(level * w);
    S.lfo(rate, level * w * 0.35, g.gain);
    S.lfo(rate * 0.37 + 0.11, level * w * 0.2, g.gain, 'triangle');
    src.connect(bp).connect(g).connect(S.out);
  });
}

function breeze(S, level, f = 700) {
  const src = S.loop('white', 0.97);
  const bp = S.f('bandpass', f, 0.9);
  S.lfo(0.06, f * 0.35, bp.frequency);
  const g = S.g(level);
  S.lfo(0.09, level * 0.5, g.gain);
  src.connect(bp).connect(g).connect(S.out);
}

// ------------------------------------------------------------------------------------------------
const SCENES = {
  docks(S) {
    // surf bed
    const surf = S.loop('brown');
    const lp = S.f('lowpass', 650, 0.6);
    const hp = S.f('highpass', 70, 0.7);
    const sg = S.g(0.32);
    S.lfo(0.085, 0.1, sg.gain);
    surf.connect(lp).connect(hp).connect(sg).connect(S.out);
    // lapping against the piers
    const lap = S.loop('white', 0.9);
    const bp = S.f('bandpass', 420, 0.8);
    const lg = S.g(0.05);
    S.lfo(0.32, 0.03, lg.gain);
    lap.connect(bp).connect(lg).connect(S.out);
    // wave crashes
    S.every(4.5, 8.5, (t) => S.shot(t, 5, (out, ctx) => {
      const dur = rnd(2.4, 3.6), vol = rnd(0.09, 0.16);
      const n = S.noiseShot(out, t, dur + 0.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
      f.frequency.setValueAtTime(300, t);
      f.frequency.linearRampToValueAtTime(rnd(1600, 2600), t + dur * 0.4);
      f.frequency.exponentialRampToValueAtTime(350, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.6, 0.6);
      n.connect(f).connect(g).connect(p).connect(out);
    }));
    S.every(5, 13, (t) => gull(S, t), 1.5);
    // buoy bell far out
    S.every(11, 22, (t) => S.shot(t, 3, (out, ctx) => {
      const f = 740, vol = 0.018;
      const p = ctx.createStereoPanner(); p.pan.value = rnd(-0.5, 0.5);
      [1, 2.4, 3.9].forEach((k, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * k;
        const g = ctx.createGain(); S.env(g.gain, t, 0.003, 0, 2.2 / (i + 1), vol / (i + 1));
        o.connect(g).connect(p); o.start(t); o.stop(t + 2.4);
      });
      p.connect(out);
    }));
    // distant ship horn
    S.every(28, 55, (t) => S.shot(t, 6, (out, ctx) => {
      const vol = 0.045, dur = rnd(1.8, 2.6);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 1.2;
      const g = ctx.createGain(); S.env(g.gain, t, 0.35, dur, 1.2, vol);
      for (const [f, d] of [[87, -6], [87, 7], [130.5, 0]]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
        o.connect(lp); o.start(t); o.stop(t + dur + 1.7);
      }
      lp.connect(g).connect(out);
      if (S.amb.audio.verbIn) { const w = ctx.createGain(); w.gain.value = 0.8; g.connect(w).connect(S.amb.audio.verbIn); setTimeout(() => { try { w.disconnect(); } catch { /* */ } }, (dur + 3) * 1000); }
    }), rnd(6, 14));
  },

  heights(S) {
    // city hum
    const hum = S.loop('brown', 0.9);
    const lp = S.f('lowpass', 190, 0.6);
    const hp = S.f('highpass', 50, 0.7);
    hum.connect(lp).connect(hp).connect(S.g(0.28)).connect(S.out);
    const mains = S.tone('sine', 60);
    mains.connect(S.g(0.006)).connect(S.out);
    breeze(S, 0.07, 650);
    S.every(3.5, 8, (t) => carPass(S, t), 1);
    S.every(14, 32, (t) => honk(S, t));
    S.every(7, 16, (t) => bird(S, t));
    // far siren
    S.every(60, 120, (t) => S.shot(t, 7, (out, ctx) => {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(700, t);
      for (let i = 0; i < 5; i++) { o.frequency.linearRampToValueAtTime(980, t + i * 1.2 + 0.6); o.frequency.linearRampToValueAtTime(700, t + i * 1.2 + 1.2); }
      const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 2); g.gain.linearRampToValueAtTime(0, t + 6);
      o.connect(lp2).connect(g).connect(out); o.start(t); o.stop(t + 6.1);
    }), 30);
  },

  refinery(S) {
    // machine hum with beating
    const lp = S.f('lowpass', 240, 1);
    const hg = S.g(0.042);
    for (const f of [55, 55.35, 110.2]) S.tone('sawtooth', f).connect(lp);
    lp.connect(hg).connect(S.out);
    S.lfo(0.21, 0.015, hg.gain);
    const rum = S.loop('brown');
    const rl = S.f('lowpass', 110, 0.7);
    rum.connect(rl).connect(S.g(0.2)).connect(S.out);
    S.every(4, 10, (t) => steam(S, t), 2);
    S.every(1.6, 5, (t) => clank(S, t));
    // big press thumps in pairs
    S.every(5, 9, (t) => S.shot(t, 2, (out, ctx) => {
      for (const dt of [0, 0.42]) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(95, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.25);
        const g = ctx.createGain(); S.env(g.gain, t + dt, 0.004, 0.02, 0.3, 0.09);
        o.connect(g).connect(out); o.start(t + dt); o.stop(t + dt + 0.4);
      }
      clank(S, t + 0.03, 0.03);
    }));
    // bubbling vats
    S.every(3, 7, (t) => S.shot(t, 1.5, (out, ctx) => {
      const n = Math.floor(rnd(3, 7));
      for (let i = 0; i < n; i++) {
        const t0 = t + rnd(0, 0.8), f = rnd(140, 320);
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 2.2, t0 + 0.07);
        const g = ctx.createGain(); S.env(g.gain, t0, 0.005, 0, 0.07, 0.03);
        o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.1);
      }
    }));
  },

  tower(S) {
    // rain: stereo hiss + roof roar
    const rain = S.loop('white');
    const hp = S.f('highpass', 900, 0.5);
    const lp = S.f('lowpass', 7000, 0.5);
    const rg = S.g(0.07);
    S.lfo(0.13, 0.015, rg.gain);
    rain.connect(hp).connect(lp).connect(rg).connect(S.out);
    const roar = S.loop('brown', 1.3);
    const rl = S.f('lowpass', 520, 0.6);
    roar.connect(rl).connect(S.g(0.16)).connect(S.out);
    // gusts
    breeze(S, 0.06, 420);
    S.every(0.12, 0.5, (t) => drip(S, t));
    S.every(12, 28, (t) => thunder(S, t), 4);
  },

  arena(S) {
    murmur(S, 0.3);
    breeze(S, 0.09, 900);
    S.every(8, 18, (t) => crowdSwell(S, t, rnd(0.12, 0.2), rnd(1.4, 2.4)));
    S.every(9, 24, (t) => whistleCall(S, t, rnd(0.02, 0.04)));
    S.every(14, 30, (t) => S.shot(t, 3, (out, ctx) => {  // a patch of clapping
      const n = Math.floor(rnd(8, 16));
      for (let i = 0; i < n; i++) {
        const t0 = t + i * rnd(0.16, 0.22) + rnd(0, 0.03);
        const src = S.noiseShot(out, t0, 0.05);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(900, 1600); bp.Q.value = 1.2;
        const g = ctx.createGain(); S.env(g.gain, t0, 0.001, 0, 0.04, 0.07);
        src.connect(bp).connect(g).connect(out);
      }
    }));
  },

  plaza(S) {
    murmur(S, 0.22);
    breeze(S, 0.08, 800);
    // fountain
    const fo = S.loop('white', 0.95);
    const fb = S.f('bandpass', 1600, 0.6);
    fo.connect(fb).connect(S.g(0.05)).connect(S.out);
    S.every(6, 14, (t) => bird(S, t));
    S.every(18, 40, (t) => whistleCall(S, t, 0.01));
  },
};

export const AMBIENCE_THEMES = Object.keys(SCENES);
