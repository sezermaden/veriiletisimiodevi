// ============================================================
// Dog Quest - synthesized audio (WebAudio sfx + procedural music)
// ============================================================
'use strict';

const Sound = {
  ctx: null, master: null, musicBus: null, sfxBus: null,
  settings: { music: 0.5, sfx: 0.7 },
  track: null, nextNoteTime: 0, step: 0, timer: null, noiseBuf: null,
  pendingTrack: null,

  init() {
    try {
      const s = JSON.parse(localStorage.getItem('dogquest_settings') || '{}');
      if (typeof s.music === 'number') this.settings.music = s.music;
      if (typeof s.sfx === 'number') this.settings.sfx = s.sfx;
    } catch (e) { /* ignore */ }
  },

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    this.applyVolumes();
    const len = this.ctx.sampleRate * 1;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this._schedule(), 25);
    if (this.pendingTrack) { const t = this.pendingTrack; this.pendingTrack = null; this.play(t); }
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.value = this.settings.music * 0.55;
    this.sfxBus.gain.value = this.settings.sfx;
  },
  saveSettings() {
    try {
      const cur = JSON.parse(localStorage.getItem('dogquest_settings') || '{}');
      localStorage.setItem('dogquest_settings', JSON.stringify(Object.assign(cur, this.settings)));
    } catch (e) { /* ignore */ }
    this.applyVolumes();
  },

  // ---------- low level voices ----------
  _tone(freq, t, dur, type = 'square', vol = 0.2, slideTo = null, bus = null, attack = 0.005) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  },
  _noise(t, dur, vol = 0.2, filterFreq = 2000, type = 'lowpass', bus = null, sweepTo = null) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },

  // ---------- sound effects ----------
  sfx(name, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.005;
    const p = opt.pitch || 1;
    switch (name) {
      case 'swing': this._noise(t, 0.12, 0.25, 900 * p, 'bandpass', null, 3500 * p); break;
      case 'swingHeavy': this._noise(t, 0.2, 0.3, 500, 'bandpass', null, 2200); break;
      case 'hit':
        this._noise(t, 0.08, 0.35, 1800, 'lowpass');
        this._tone(180 * p, t, 0.09, 'square', 0.15, 90);
        break;
      case 'crit':
        this._noise(t, 0.15, 0.45, 3000, 'lowpass');
        this._tone(420, t, 0.18, 'sawtooth', 0.15, 120);
        this._tone(880, t + 0.02, 0.12, 'square', 0.08, 1400);
        break;
      case 'hurt':
        this._tone(300, t, 0.18, 'sawtooth', 0.18, 110);
        this._noise(t, 0.1, 0.2, 1200);
        break;
      case 'bark':
        this._tone(520 * p, t, 0.09, 'sawtooth', 0.22, 300 * p);
        this._noise(t, 0.06, 0.18, 2500, 'bandpass');
        this._tone(480 * p, t + 0.11, 0.08, 'sawtooth', 0.18, 280 * p);
        break;
      case 'meow': {
        const o = this._tone(500 * p, t, 0.35, 'triangle', 0.16, null);
        o.frequency.setValueAtTime(480 * p, t);
        o.frequency.linearRampToValueAtTime(820 * p, t + 0.12);
        o.frequency.linearRampToValueAtTime(420 * p, t + 0.35);
        this._tone(1000 * p, t, 0.3, 'sine', 0.05, 700 * p);
        break;
      }
      case 'hiss': this._noise(t, 0.35, 0.22, 4000, 'highpass'); break;
      case 'catDie': {
        const o = this._tone(700 * p, t, 0.45, 'triangle', 0.18);
        o.frequency.setValueAtTime(700 * p, t);
        o.frequency.linearRampToValueAtTime(950 * p, t + 0.1);
        o.frequency.exponentialRampToValueAtTime(200 * p, t + 0.45);
        this._noise(t, 0.2, 0.12, 1500, 'bandpass');
        break;
      }
      case 'roll': this._noise(t, 0.2, 0.18, 400, 'bandpass', null, 1400); break;
      case 'coin':
        this._tone(1320, t, 0.06, 'square', 0.1);
        this._tone(1760, t + 0.05, 0.12, 'square', 0.1);
        break;
      case 'pickup':
        this._tone(660, t, 0.08, 'triangle', 0.2);
        this._tone(990, t + 0.07, 0.14, 'triangle', 0.2);
        break;
      case 'levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone(f, t + i * 0.08, 0.35, 'square', 0.12));
        this._tone(1568, t + 0.42, 0.6, 'triangle', 0.18);
        break;
      case 'chest':
        this._noise(t, 0.2, 0.2, 600);
        [392, 523, 659, 784, 1046].forEach((f, i) => this._tone(f, t + 0.1 + i * 0.07, 0.4, 'triangle', 0.18));
        break;
      case 'locked':
        this._tone(160, t, 0.12, 'square', 0.18, 120);
        this._tone(140, t + 0.14, 0.16, 'square', 0.18, 100);
        break;
      case 'menu': this._tone(880, t, 0.05, 'square', 0.07); break;
      case 'select': this._tone(660, t, 0.06, 'square', 0.1); this._tone(990, t + 0.05, 0.1, 'square', 0.1); break;
      case 'back': this._tone(440, t, 0.08, 'square', 0.09, 300); break;
      case 'buy':
        this._tone(1046, t, 0.08, 'square', 0.1); this._tone(1318, t + 0.07, 0.08, 'square', 0.1); this._tone(1568, t + 0.14, 0.2, 'square', 0.1);
        break;
      case 'error': this._tone(220, t, 0.2, 'sawtooth', 0.12, 180); break;
      case 'fire':
        this._noise(t, 0.35, 0.3, 700, 'lowpass', null, 200);
        this._tone(220, t, 0.3, 'sawtooth', 0.1, 80);
        break;
      case 'explode':
        this._noise(t, 0.6, 0.5, 1200, 'lowpass', null, 80);
        this._tone(120, t, 0.5, 'sine', 0.35, 30);
        break;
      case 'ice':
        [1800, 2400, 2100, 2800].forEach((f, i) => this._tone(f, t + i * 0.03, 0.15, 'triangle', 0.07));
        this._noise(t, 0.25, 0.15, 5000, 'highpass');
        break;
      case 'thunder':
        this._noise(t, 0.08, 0.5, 6000, 'highpass');
        this._noise(t + 0.05, 0.7, 0.45, 900, 'lowpass', null, 60);
        this._tone(80, t, 0.6, 'sawtooth', 0.2, 30);
        break;
      case 'heal':
        [523, 659, 784, 1046].forEach((f, i) => this._tone(f, t + i * 0.06, 0.4, 'sine', 0.14));
        break;
      case 'shield':
        this._tone(300, t, 0.4, 'sine', 0.2, 600);
        this._tone(450, t, 0.4, 'triangle', 0.1, 900);
        break;
      case 'quake':
        this._noise(t, 0.7, 0.55, 300, 'lowpass', null, 40);
        this._tone(60, t, 0.6, 'sine', 0.4, 30);
        break;
      case 'spirit':
        this._tone(600, t, 0.5, 'sine', 0.14, 1200);
        this._tone(900, t + 0.05, 0.5, 'sine', 0.1, 1800);
        break;
      case 'meteor':
        this._noise(t, 0.9, 0.3, 3000, 'lowpass', null, 200);
        break;
      case 'telegraph': this._tone(300, t, 0.1, 'sine', 0.05, 350); break;
      case 'arrow': this._noise(t, 0.12, 0.2, 3000, 'bandpass', null, 6000); break;
      case 'magic': this._tone(700, t, 0.25, 'sine', 0.12, 1400); this._tone(350, t, 0.25, 'triangle', 0.08, 700); break;
      case 'dash': this._noise(t, 0.25, 0.25, 800, 'bandpass', null, 3000); break;
      case 'roar':
        this._noise(t, 1.2, 0.5, 500, 'lowpass', null, 120);
        this._tone(90, t, 1.1, 'sawtooth', 0.3, 55);
        this._tone(135, t, 1.1, 'sawtooth', 0.15, 70);
        break;
      case 'portal':
        [300, 450, 600, 900].forEach((f, i) => this._tone(f, t + i * 0.06, 0.5, 'sine', 0.12, f * 1.5));
        break;
      case 'door': this._noise(t, 0.4, 0.3, 300, 'lowpass'); this._tone(90, t, 0.35, 'square', 0.12, 60); break;
      case 'quest':
        [659, 784, 988, 1318].forEach((f, i) => this._tone(f, t + i * 0.1, 0.4, 'triangle', 0.16));
        break;
      case 'talk': this._tone(500 + Math.random() * 200, t, 0.04, 'square', 0.04); break;
      case 'step': this._noise(t, 0.04, 0.05, 500); break;
      case 'splash': this._noise(t, 0.3, 0.2, 1500, 'bandpass'); break;
      case 'victory':
        [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => this._tone(f, t + i * 0.12, 0.35, 'square', 0.1));
        break;
      case 'gameover':
        [440, 392, 349, 262].forEach((f, i) => this._tone(f, t + i * 0.3, 0.5, 'triangle', 0.18));
        break;
      default: break;
    }
  },

  // ---------- music ----------
  play(name) {
    if (!this.ctx) { this.pendingTrack = name; return; }
    if (this.track && this.track.name === name) return;
    const def = MUSIC[name];
    if (!def) { this.track = null; return; }
    this.track = { name, def, bars: buildSong(def) };
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
  },
  stop() { this.track = null; },

  _schedule() {
    if (!this.ctx || !this.track || this.ctx.state !== 'running') return;
    const tr = this.track, def = tr.def;
    const stepDur = 60 / def.bpm / 4; // 16th notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      const total = tr.bars.length * 16;
      const s = this.step % total;
      const bar = tr.bars[Math.floor(s / 16)];
      const i = s % 16;
      const t = this.nextNoteTime;
      const bus = this.musicBus;
      // melody
      const n = bar.mel[i];
      if (n != null) this._tone(midi(n), t, stepDur * (bar.melLen[i] || 2) * 0.95, def.lead || 'square', 0.07, null, bus, 0.01);
      // harmony pad (on bar start)
      if (i === 0 && def.pad) for (const c of bar.chord) this._tone(midi(c + 12), t, stepDur * 16, def.pad, 0.025, null, bus, 0.25);
      // bass
      if (bar.bass[i] != null) this._tone(midi(bar.bass[i]), t, stepDur * 1.8, def.bassType || 'triangle', 0.16, null, bus, 0.01);
      // drums
      if (def.drums) {
        const k = def.drums.kick[i], sn = def.drums.snare[i], hh = def.drums.hat[i];
        if (k) { this._tone(140, t, 0.12, 'sine', 0.35, 45, bus); }
        if (sn) this._noise(t, 0.12, 0.16, 2500, 'bandpass', bus);
        if (hh) this._noise(t, 0.03, 0.05, 8000, 'highpass', bus);
      }
      this.nextNoteTime += stepDur;
      this.step++;
    }
  },
};

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

// Song definitions: chord progression (root midi notes + quality), scale for melody, tempo.
const DRUMS_BASIC = {
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
};
const DRUMS_MARCH = {
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1],
  hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};
const DRUMS_SOFT = {
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
};
const MUSIC = {
  title: { bpm: 100, seed: 11, lead: 'triangle', pad: 'sine', chords: [[60, 'M'], [57, 'm'], [53, 'M'], [55, 'M']], scale: [0, 2, 4, 7, 9], drums: DRUMS_SOFT, density: 0.45 },
  world: { bpm: 124, seed: 23, lead: 'square', pad: 'triangle', chords: [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M'], [60, 'M'], [55, 'M'], [53, 'M'], [55, 'M']], scale: [0, 2, 4, 7, 9], drums: DRUMS_BASIC, density: 0.55 },
  desert: { bpm: 112, seed: 31, lead: 'sawtooth', pad: 'sine', chords: [[57, 'm'], [58, 'M'], [57, 'm'], [55, 'm']], scale: [0, 1, 4, 5, 7, 8, 10], drums: DRUMS_BASIC, density: 0.5 },
  snow: { bpm: 96, seed: 41, lead: 'triangle', pad: 'sine', chords: [[62, 'm'], [58, 'M'], [60, 'M'], [57, 'm']], scale: [0, 2, 3, 7, 9], drums: DRUMS_SOFT, density: 0.45 },
  woods: { bpm: 108, seed: 53, lead: 'triangle', pad: 'triangle', chords: [[57, 'm'], [53, 'M'], [55, 'M'], [52, 'm']], scale: [0, 3, 5, 7, 10], drums: DRUMS_BASIC, density: 0.5 },
  ember: { bpm: 132, seed: 61, lead: 'sawtooth', pad: 'square', chords: [[52, 'm'], [48, 'M'], [50, 'M'], [47, 'M']], scale: [0, 3, 5, 6, 7, 10], drums: DRUMS_MARCH, density: 0.6 },
  pride: { bpm: 120, seed: 71, lead: 'square', pad: 'triangle', chords: [[55, 'm'], [51, 'M'], [53, 'M'], [50, 'M']], scale: [0, 2, 3, 5, 7, 8, 11], drums: DRUMS_MARCH, density: 0.55 },
  town: { bpm: 100, seed: 83, lead: 'triangle', pad: 'sine', chords: [[65, 'M'], [62, 'm'], [58, 'M'], [60, 'M']], scale: [0, 2, 4, 7, 9], drums: DRUMS_SOFT, density: 0.5 },
  dungeon: { bpm: 90, seed: 97, lead: 'triangle', pad: 'sine', chords: [[57, 'm'], [57, 'm'], [53, 'M'], [52, 'M']], scale: [0, 2, 3, 7, 8], drums: DRUMS_SOFT, density: 0.35 },
  boss: { bpm: 150, seed: 101, lead: 'sawtooth', pad: 'square', chords: [[52, 'm'], [52, 'm'], [48, 'M'], [50, 'M'], [52, 'm'], [55, 'M'], [50, 'M'], [47, 'M']], scale: [0, 2, 3, 5, 7, 8, 11], drums: DRUMS_MARCH, density: 0.7 },
  final: { bpm: 160, seed: 113, lead: 'sawtooth', pad: 'sawtooth', chords: [[50, 'm'], [46, 'M'], [48, 'M'], [45, 'M'], [50, 'm'], [53, 'M'], [55, 'm'], [45, 'M']], scale: [0, 1, 3, 5, 7, 8, 10], drums: DRUMS_MARCH, density: 0.75 },
  victory: { bpm: 110, seed: 127, lead: 'square', pad: 'triangle', chords: [[60, 'M'], [65, 'M'], [67, 'M'], [60, 'M'], [57, 'm'], [65, 'M'], [67, 'M'], [60, 'M']], scale: [0, 2, 4, 5, 7, 9, 11], drums: DRUMS_BASIC, density: 0.6 },
};

function buildSong(def) {
  const rng = new RNG(def.seed);
  const bars = [];
  const motif = []; // a repeating rhythmic motif keeps melodies catchy
  for (let i = 0; i < 16; i++) motif.push(rng.chance(def.density) || i % 4 === 0);
  const passes = 2;
  for (let p = 0; p < passes; p++) {
    for (let ci = 0; ci < def.chords.length; ci++) {
      const [root, q] = def.chords[ci];
      const third = q === 'm' ? 3 : 4;
      const chord = [root, root + third, root + 7];
      const mel = new Array(16).fill(null), melLen = new Array(16).fill(0), bass = new Array(16).fill(null);
      let lastDeg = rng.int(0, def.scale.length - 1);
      const tonic = def.chords[0][0];
      for (let i = 0; i < 16; i++) {
        const play = p === 0 ? motif[i] : (motif[i] ? rng.chance(0.85) : rng.chance(0.2));
        if (!play) continue;
        let note;
        if (i % 4 === 0 && rng.chance(0.65)) note = chord[rng.int(0, 2)] + 12;
        else {
          lastDeg = clamp(lastDeg + rng.pick([-2, -1, -1, 1, 1, 2, 0]), 0, def.scale.length * 2 - 1);
          const oct = Math.floor(lastDeg / def.scale.length);
          note = tonic + 12 + def.scale[lastDeg % def.scale.length] + oct * 12;
        }
        mel[i] = note;
        let len = 1; while (i + len < 16 && !motif[i + len] && len < 4) len++;
        melLen[i] = len;
      }
      // bass line: root on beats, fifth offbeat
      for (let i = 0; i < 16; i += 2) bass[i] = (i % 8 === 6 ? root + 7 : root) - 24;
      bars.push({ chord, mel, melLen, bass });
    }
  }
  return bars;
}
