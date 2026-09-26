// Procedural music engine. A look-ahead scheduler (25 ms timer, ~0.2 s horizon on
// ctx.currentTime) walks the compiled songs from tracks.js step by step and plays synthesised
// instruments (instruments.js) through per-track mix/reverb/delay into audio.musicBus.
//
// Tracks: title, menu, map, docks, heights, refinery, tower, boss, final-boss, turf, turf-final,
// story, results, victory (one-shot), defeat (one-shot), credits. Aliases: hub→map, plaza→menu,
// arena→turf, turf-last→turf-final, cutscene→story, finale/final→final-boss, ending→credits,
// clear→results (tracks.js ALIASES). Unknown ids fall back to 'menu' (warned once per id).
//
//   const mp = new MusicPlayer(audio);   // audio = { ctx, musicBus, noise? }
//   mp.play('docks', { fadeIn: 1.2, intensity: 0 });
//   mp.setIntensity(1);                   // adds layers (shaker drive, octave lead, arps, rolls)
//   mp.stop(1.5);                         // fade out
//   mp.current                            // id last passed to play() (null when stopped / one-shot done)
//
// Tracks crossfade (the new one starts on the outgoing track's next beat), loop seamlessly at
// their loop point, and one-shots ('victory', 'defeat') end by themselves.
import { Instruments, makeImpulse, makeNoise } from './instruments.js';
import { compileSong } from './compose.js';
import { TRACKS, ALIASES, resolveTrack } from './tracks.js';

const LOOKAHEAD = 0.2;              // rides out ~170 ms main-thread stalls (stage loads, shader compiles, GC)
const LOOKAHEAD_HIDDEN = 1.2;       // background tabs throttle timers to ~1 Hz
const TICK_MS = 25;

// channel mix levels (before the song's own `mix` overrides)
const MIX = {
  kick: 0.42, snare: 0.7, clap: 0.6, hat: 0.32, ohat: 0.26, tom: 0.5, crash: 0.2, perc: 0.34, shaker: 0.32,
  bass: 0.27, lead: 0.26, lead2: 0.18, counter: 0.2, pad: 0.26, stab: 0.24, arp: 0.15, arp2: 0.13,
  bell: 0.36, chop: 0.58, pluck: 0.2, riser: 0.16, impact: 0.3,
};
// [reverb send, delay send]
const SENDS = {
  kick: [0.02, 0], snare: [0.16, 0], clap: [0.2, 0.04], hat: [0.03, 0], ohat: [0.05, 0], tom: [0.2, 0],
  crash: [0.18, 0], perc: [0.12, 0.05], shaker: [0.05, 0], bass: [0, 0], lead: [0.2, 0.18], lead2: [0.24, 0.2],
  counter: [0.24, 0.14], pad: [0.38, 0.04], stab: [0.14, 0.08], arp: [0.18, 0.28], arp2: [0.2, 0.3],
  bell: [0.34, 0.22], chop: [0.26, 0.22], pluck: [0.2, 0.25], riser: [0.35, 0], impact: [0.3, 0],
};
// synth used for a channel unless the song's inst[channel].type says otherwise
const TYPE = {
  lead: 'lead', lead2: 'lead', counter: 'lead', chop: 'chop', bell: 'bell', pluck: 'pluck', arp: 'pluck', arp2: 'pluck',
};
const PUMPED = new Set(['pad', 'stab', 'arp', 'arp2', 'pluck']);
// voice cap: above this many sounding voices, low-priority notes are skipped
const MAX_VOICES = 110;
const LOW_PRIORITY = new Set(['shaker', 'hat', 'perc', 'arp2', 'lead2', 'arp', 'ohat']);
// channels that exist only as intensity layers (their gain fades in/out with intensity)
const LAYER_OF = { shaker: 1, lead2: 1, arp2: 2 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const TRIM = 0.8;

let _limCurve = null;
function limiterCurve() {
  if (_limCurve) return _limCurve;
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;          // input range ±2
    const a = Math.abs(x);
    const y = a < 0.7 ? a : 0.7 + 0.29 * Math.tanh((a - 0.7) / 0.29);
    c[i] = Math.sign(x) * y;
  }
  return (_limCurve = c);
}

class Track {
  constructor(player, id, song, startAt, fadeIn) {
    this.player = player;
    this.id = id;
    this.song = song;
    this.def = song.def;
    const ctx = this.ctx = player.ctx;
    this.formPos = 0;
    this.step = 0;
    this.next = startAt;
    this.startAt = startAt;
    this.stopAt = Infinity;
    this.ended = false;
    this.endTime = Infinity;
    this.level = 0;
    this.intensity = 0;
    this.channels = new Map();
    this.openHat = null;
    this.pumpEnd = 0;
    this.inst = this.def.inst || {};

    this.fade = ctx.createGain();
    this.fade.gain.setValueAtTime(0, ctx.currentTime);
    this.fade.gain.setValueAtTime(fadeIn > 0.03 ? 0.0001 : 0, startAt);
    this.fade.gain.linearRampToValueAtTime(1, startAt + Math.max(0.02, fadeIn));
    this.fade.connect(player.bus);
    this.mix = ctx.createGain();
    this.mix.gain.value = this.def.gain ?? 1;
    // intensity brightens the whole track a little (+0..3 dB above 2.5 kHz)
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'highshelf'; this.tone.frequency.value = 2500; this.tone.gain.value = 0;
    this.mix.connect(this.tone).connect(this.fade);
    // reverb
    this.revIn = ctx.createGain();
    this.revIn.gain.value = this.def.reverb ?? 1;
    this.rev = ctx.createConvolver();
    this.rev.buffer = player.ir;
    this.revIn.connect(this.rev).connect(this.mix);
    // tempo-synced feedback delay (dotted eighth by default)
    this.dlyIn = ctx.createGain();
    this.dlyIn.gain.value = this.def.delayMix ?? 1;
    this.dly = ctx.createDelay(2);
    this.dly.delayTime.value = Math.min(1.9, (this.def.delay ?? 0.75) * 60 / song.bpm);
    const fb = ctx.createGain(); fb.gain.value = this.def.feedback ?? 0.34;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const dhp = ctx.createBiquadFilter(); dhp.type = 'highpass'; dhp.frequency.value = 280;
    this.dlyIn.connect(this.dly);
    this.dly.connect(dlp).connect(dhp).connect(fb).connect(this.dly);
    const dOut = ctx.createGain(); dOut.gain.value = 0.8;
    dhp.connect(dOut).connect(this.mix);
    dOut.connect(this.revIn);
    this._fx = [this.revIn, this.rev, this.dlyIn, this.dly, fb, dlp, dhp, dOut];
    // sidechain-style pump on pads / stabs / arps
    this.pump = ctx.createGain();
    this.pump.connect(this.mix);
    this.pumpAmt = this.def.pump ?? 0;
  }

  channel(name) {
    let c = this.channels.get(name);
    if (c) return c;
    const ctx = this.ctx;
    const g = ctx.createGain();
    const base = (this.def.mix?.[name] ?? MIX[name] ?? 0.3);
    const lay = LAYER_OF[name];
    g.gain.value = lay ? base * this._layerGain(lay, this.intensity) : base;
    g.connect(PUMPED.has(name) && this.pumpAmt ? this.pump : this.mix);
    const [r, d] = this.def.sends?.[name] ?? SENDS[name] ?? [0.1, 0];
    if (r > 0) { const s = ctx.createGain(); s.gain.value = r; g.connect(s).connect(this.revIn); }
    if (d > 0) { const s = ctx.createGain(); s.gain.value = d; g.connect(s).connect(this.dlyIn); }
    c = { g, base, lay };
    this.channels.set(name, c);
    return c;
  }

  _layerGain(layer, I) { return layer === 1 ? clamp01((I - 0.3) / 0.2) : clamp01((I - 0.65) / 0.2); }

  setIntensity(I, instant = false) {
    this.intensity = I;
    this.level = I >= 0.75 ? 2 : I >= 0.4 ? 1 : 0;
    const t = this.ctx.currentTime;
    const tg = this.tone.gain;
    tg.cancelScheduledValues(t);
    if (instant) tg.setValueAtTime(3 * I, t); else { tg.setValueAtTime(tg.value, t); tg.linearRampToValueAtTime(3 * I, t + 1.5); }
    for (const c of this.channels.values()) {
      if (!c.lay) continue;
      const target = c.base * this._layerGain(c.lay, I);
      c.g.gain.cancelScheduledValues(t);
      if (instant) c.g.gain.setValueAtTime(target, t);
      else { c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(target, t + 1.5); }
    }
  }

  /** Time of the next beat at or after t (for musically aligned crossfades). */
  nextBeat(t) {
    const sd = this._sd();
    let b = this.next + ((4 - (this.step % 4)) % 4) * sd;
    while (b < t - 1e-6) b += 4 * sd;
    return b;
  }

  fadeOut(from, dur) {
    const P = this.fade.gain;
    const now = this.ctx.currentTime;
    const at = Math.max(now, from);
    P.cancelScheduledValues(now);
    P.setValueAtTime(P.value, now);
    P.setValueAtTime(P.value, at);
    P.linearRampToValueAtTime(0, at + Math.max(0.03, dur));
    this.stopAt = at + Math.max(0.03, dur);
    this.stopping = true;
  }

  /** Schedule every step that starts before `horizon`. */
  schedule(horizon) {
    const now = this.ctx.currentTime;
    // fell far behind (tab was asleep): jump forward in song position without playing
    let guard = 0;
    while (!this.ended && this.next < now - 0.08 && guard++ < 100000) this._advance(this._sd());
    guard = 0;
    while (!this.ended && this.next < horizon && this.next < this.stopAt && guard++ < 4096) {
      const sec = this.song.form[this.formPos];
      const sd = this._sd();
      const evs = sec.steps[this.step];
      if (evs) {
        const t = this.next + this._swing(this.step, sd);
        const solo = this.player.solo;
        const crowded = this.player.kit.active > MAX_VOICES;
        for (const ev of evs) {
          if (ev.L && ev.L > this.level) continue;
          if (solo && !solo.includes(ev.c)) continue;
          if (crowded && LOW_PRIORITY.has(ev.c)) { this.player.dropped++; continue; }
          try { this._play(ev, t, sd); } catch (e) { this.player._err(e); }
        }
      }
      this._advance(sd);
    }
  }

  _sd() { const sec = this.song.form[this.formPos]; return 60 / (sec.bpm || this.song.bpm) / 4; }

  _swing(step, sd) {
    const d = this.def;
    let o = 0;
    if (d.swing && step % 2 === 1) o += d.swing * sd;
    if (d.shuffle && step % 4 === 2) o += d.shuffle * 2 * sd;
    if (d.shuffle && step % 4 === 3) o += d.shuffle * sd;
    return o;
  }

  _advance(sd) {
    this.next += sd;
    this.step++;
    const sec = this.song.form[this.formPos];
    if (this.step >= sec.steps.length) {
      this.step = 0;
      this.formPos++;
      if (this.formPos >= this.song.form.length) {
        if (this.song.loop == null || this.song.loop === false) { this.ended = true; this.endTime = this.next; this.formPos = this.song.form.length - 1; }
        else this.formPos = this.song.loop;
      }
    }
  }

  _pump(t, sd) {
    if (!this.pumpAmt || t < this.pumpEnd) return;
    const P = this.pump.gain;
    const rel = sd * 4 * 0.55;
    P.setValueAtTime(1, t);
    P.linearRampToValueAtTime(1 - this.pumpAmt, t + 0.012);
    P.linearRampToValueAtTime(1, t + rel);
    this.pumpEnd = t + rel;
  }

  _play(ev, t, sd) {
    const K = this.player.kit;
    const I = this.inst;
    const ch = this.channel(ev.c).g;
    switch (ev.c) {
      case 'kick': K.kick(ch, t, ev.v, I.kick); this._pump(t, sd); return;
      case 'snare': K.snare(ch, t, ev.v, I.snare); return;
      case 'clap': K.clap(ch, t, ev.v, I.clap); return;
      case 'hat':
        if (this.openHat) { this.openHat(t); this.openHat = null; }
        K.hat(ch, t, ev.v, false, I.hat); return;
      case 'ohat': this.openHat = K.hat(ch, t, ev.v, true, I.hat); return;
      case 'tom': K.tom(ch, t, ev.v, ev.k, I.tom); return;
      case 'crash': K.crash(ch, t, ev.v, I.crash); return;
      case 'perc': K.perc(ch, t, ev.v, ev.k); return;
      case 'shaker': K.perc(ch, t, ev.v, 's'); return;
      case 'riser': K.riser(ch, t, ev.d * sd, ev.v); return;
      case 'impact': K.impact(ch, t, ev.v); return;
      // pads hold into the next chord's attack so changes crossfade instead of dipping
      case 'pad': K.pad(ch, t, ev.ns, ev.d * sd + Math.min(0.6, (I.pad?.a ?? 0.35) * 0.8), ev.v, I.pad); return;
      case 'stab': K.stab(ch, t, ev.ns, ev.d * sd * 0.9, ev.v, I.stab); return;
      case 'bass': K.bass(ch, t, ev.n, ev.d * sd * (ev.gate ?? 0.92), ev.v, I.bass, ev.slide, ev.dead); return;
      default: break;
    }
    // melodic channels
    const src = ev.t || ev.c;
    const o = I[src] || I[ev.c] || {};
    const type = o.type || TYPE[src] || TYPE[ev.c] || 'lead';
    const dur = ev.d * sd * (ev.gate ?? 0.92);
    const slide = ev.slide ?? null;
    switch (type) {
      case 'chop': K.chop(ch, t, ev.n, dur, ev.v, o, slide, ev.syl || this.player.syllable(this, ev)); break;
      case 'bell': K.bell(ch, t, ev.n, dur, ev.v, o); break;
      case 'pluck': K.pluck(ch, t, ev.n, Math.max(0.04, dur), ev.v, o); break;
      case 'bass': K.bass(ch, t, ev.n, dur, ev.v, o, slide); break;
      default: K.lead(ch, t, ev.n, dur, ev.v, o, slide); break;
    }
  }

  dispose() {
    try { this.fade.disconnect(); } catch { /* */ }
    try { this.mix.disconnect(); this.tone.disconnect(); this.pump.disconnect(); } catch { /* */ }
    for (const n of this._fx) { try { n.disconnect(); } catch { /* */ } }
    for (const c of this.channels.values()) { try { c.g.disconnect(); } catch { /* */ } }
    this.channels.clear();
    this.disposed = true;
  }
}

export class MusicPlayer {
  /** @param {{ctx: BaseAudioContext, musicBus: AudioNode, noise?: AudioBuffer}} audio */
  constructor(audio) {
    this.audio = audio;
    const ctx = this.ctx = audio.ctx;
    this.kit = new Instruments(ctx, audio.noise && audio.noise.sampleRate === ctx.sampleRate ? audio.noise : makeNoise(ctx));
    this.ir = makeImpulse(ctx, 2.4, 3.0, 0.75);
    // glue compressor → music bus
    this.bus = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -10; this.comp.knee.value = 6; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.005; this.comp.release.value = 0.16;
    // trim + transparent soft limiter (linear below 0.7, saturates smoothly towards 0.99)
    this.out = ctx.createGain();
    this.out.gain.value = TRIM * 0.5;                 // the curve spans ±2 so the 0.5 is undone
    this.limiter = ctx.createWaveShaper();
    this.limiter.curve = limiterCurve();
    this.bus.connect(this.comp).connect(this.out).connect(this.limiter).connect(audio.musicBus);
    this.track = null;
    this.fading = [];
    this.intensity = 0;
    this._req = null;
    this._timer = null;
    this._sylK = 0;
    this.errors = [];
    this.solo = null;              // debug: array of channel names to hear exclusively
    this.dropped = 0;              // notes skipped by the voice cap
    this._warned = new Set();      // unknown ids already reported
  }

  /** Requested id of the playing track (aliases preserved), or null. */
  get current() { return this.track && !this.track.stopping && !this.track.ended ? this._req : null; }

  /** Resolved track id actually playing. */
  get currentTrack() { return this.current ? this.track.id : null; }

  /**
   * Start (or keep) a track.
   * @param {string} id  track id or alias; unknown ids fall back to 'menu'
   * @param {object} o   fadeIn (s), fadeOut (s), intensity (0..1), restart (bool), quantize (bool)
   */
  play(id, o = {}) {
    const rid = resolveTrack(id);
    if (id && rid === 'menu' && id !== 'menu' && !ALIASES[id] && !this._warned.has(id)) {
      this._warned.add(id);
      console.warn(`[music] unknown track id "${id}", playing 'menu'`);
    }
    const def = TRACKS[rid];
    const cur = this.track;
    if (cur && !cur.stopping && !cur.ended && cur.id === rid && !o.restart) {
      this._req = id;
      if (o.intensity != null) this.setIntensity(o.intensity);
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fadeIn = o.fadeIn ?? def.fadeIn ?? 1.2;
    let startAt = now + 0.06;
    if (cur && !cur.stopping && !cur.ended && o.quantize !== false && !def.oneShot) {
      const b = cur.nextBeat(startAt);
      if (b - startAt < 0.8) startAt = b;
    }
    if (cur) this._retire(cur, startAt - 0.02, o.fadeOut ?? (def.oneShot ? 0.35 : Math.max(0.6, fadeIn)));
    let song;
    try { song = compileSong(rid, def, (m) => this._err(m)); } catch (e) { this._err(e); return; }
    this.track = new Track(this, rid, song, startAt, fadeIn);
    this._req = id;
    this.intensity = clamp01(o.intensity ?? 0);
    this.track.setIntensity(this.intensity, true);
    this._ensureTimer();
    this._tick();
  }

  stop(fade = 1) {
    if (this.track) this._retire(this.track, this.ctx.currentTime, fade);
    this.track = null;
    this._req = null;
  }

  setIntensity(v) {
    this.intensity = clamp01(v);
    this.track?.setIntensity(this.intensity);
  }

  _retire(tr, from, dur) {
    tr.fadeOut(from, dur);
    if (!this.fading.includes(tr)) this.fading.push(tr);
    if (this.track === tr) this.track = null;
  }

  _ensureTimer() {
    if (this._timer || typeof setInterval !== 'function') return;
    this._timer = setInterval(() => this._tick(), TICK_MS);
  }

  _tick() {
    const hidden = typeof document !== 'undefined' && document.hidden;
    this.pump(this.ctx.currentTime + (hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD));
  }

  /** Schedule all active tracks up to an absolute context time (also used by offline tests). */
  pump(horizon) {
    const now = this.ctx.currentTime;
    const tr = this.track;
    if (tr) {
      tr.schedule(horizon);
      if (tr.ended && now > tr.endTime + 0.05) { this.fading.push(tr); tr.stopAt = tr.endTime; tr.stopping = true; this.track = null; this._req = null; }
    }
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      if (!f.ended) f.schedule(Math.min(horizon, f.stopAt));
      const tail = f.ended ? f.endTime + 4 : f.stopAt + 0.1;
      if (now > tail) { f.dispose(); this.fading.splice(i, 1); }
    }
    if (!this.track && !this.fading.length && this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** Fallback syllable for chop-type channels whose notes carry no '@syl' (chop lines get theirs at compile time). */
  syllable(tr, ev) {
    const list = tr.def.syllables || ['ya', 'oh', 'ee', 'wa', 'la', 'yo', 'ay', 'oo'];
    return list[(ev.n + (this._sylK++)) % list.length];
  }

  _err(e) {
    if (this.errors.length < 50) this.errors.push(String(e?.message || e));
    console.warn('[music]', e);
  }

  dispose() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this.track?.dispose();
    for (const f of this.fading) f.dispose();
    this.fading.length = 0;
    this.track = null;
    try { this.out.disconnect(); this.limiter.disconnect(); } catch { /* */ }
  }
}

export { TRACKS };
