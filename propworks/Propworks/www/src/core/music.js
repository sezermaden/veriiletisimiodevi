/* Generative score. Each mood is a chord progression plus a few voices (pad, bass,
   arpeggio, pulse, percussion) scheduled a beat ahead of the audio clock. Moods
   cross-fade, so the game can call setMood() freely on every state change. */
import { Audio } from './audio.js';

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MOODS = {
  menu: { bpm: 72, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [55, 59, 62, 67]], pad: 0.16, arp: 0.05, bass: 0.12, arpPattern: [0, 2, 1, 3, 2, 1], wave: 'triangle' },
  calm: { bpm: 80, prog: [[50, 57, 60, 64], [48, 55, 59, 64], [45, 52, 57, 60], [47, 54, 57, 62]], pad: 0.13, arp: 0.045, bass: 0.1, arpPattern: [0, 1, 2, 3, 2, 1, 0, 2], wave: 'sine' },
  build: { bpm: 96, prog: [[52, 59, 62, 66], [50, 57, 61, 64], [47, 54, 57, 62], [49, 56, 59, 64]], pad: 0.1, arp: 0.06, bass: 0.13, pulse: 0.05, arpPattern: [0, 2, 3, 1, 2, 3, 0, 3], wave: 'triangle' },
  tension: { bpm: 84, prog: [[45, 48, 52, 55], [46, 49, 53, 56], [45, 48, 52, 55], [44, 47, 51, 55]], pad: 0.14, arp: 0.035, bass: 0.15, pulse: 0.06, arpPattern: [0, 3, 1, 3], wave: 'sawtooth', dark: true },
  combat: { bpm: 132, prog: [[45, 52, 57, 60], [43, 50, 55, 58], [41, 48, 53, 57], [43, 50, 55, 59]], pad: 0.09, arp: 0.06, bass: 0.18, pulse: 0.07, drums: 0.5, arpPattern: [0, 1, 2, 3, 2, 1, 2, 3], wave: 'sawtooth' },
  boss: { bpm: 140, prog: [[40, 47, 52, 55], [41, 48, 53, 56], [38, 45, 50, 53], [39, 46, 51, 55]], pad: 0.11, arp: 0.065, bass: 0.22, pulse: 0.08, drums: 0.7, arpPattern: [0, 3, 1, 3, 2, 3, 1, 3], wave: 'sawtooth', dark: true },
  ending: { bpm: 66, prog: [[48, 55, 60, 64, 67], [53, 57, 60, 65], [45, 52, 57, 60, 64], [55, 59, 62, 67]], pad: 0.17, arp: 0.05, bass: 0.1, arpPattern: [0, 2, 4, 3, 1, 2], wave: 'sine' },
};

class Music {
  constructor() { this.mood = null; this._timer = null; this._beat = 0; this._next = 0; this._gain = null; }

  setMood(name) {
    if (!Audio.ready || name === this.mood) return;
    const c = Audio.ctx;
    const old = this._gain;
    if (old) { old.gain.setTargetAtTime(0, c.currentTime, 0.8); setTimeout(() => old.disconnect(), 4000); }
    this.mood = name;
    if (!name || !MOODS[name]) { this._gain = null; this._stopTimer(); return; }
    this._gain = c.createGain();
    this._gain.gain.value = 0;
    this._gain.gain.setTargetAtTime(1, c.currentTime, 1.2);
    this._gain.connect(Audio.bus.music);
    const send = c.createGain(); send.gain.value = 0.6;
    this._gain.connect(send).connect(Audio.reverbSend);
    this._beat = 0;
    this._next = c.currentTime + 0.1;
    if (!this._timer) this._timer = setInterval(() => this._schedule(), 50);
  }

  _stopTimer() { clearInterval(this._timer); this._timer = null; }

  _schedule() {
    if (!this.mood || !this._gain) return;
    const m = MOODS[this.mood], c = Audio.ctx, out = this._gain;
    const spb = 60 / m.bpm / 2;   // eighth notes
    while (this._next < c.currentTime + 0.25) {
      const t = this._next, b = this._beat;
      const bar = Math.floor(b / 8) % m.prog.length;
      const chord = m.prog[bar];
      if (b % 8 === 0) {
        // pad: detuned pair per chord tone, long attack
        for (const n of chord) for (const d of [-7, 7]) this._tone(m.dark ? 'sawtooth' : 'triangle', N(n), t, spb * 8.2, out, m.pad / chord.length, 0.6, d, m.dark ? 900 : 1600);
        this._tone('sine', N(chord[0] - 12), t, spb * 7.8, out, m.bass, 0.05, 0, 400);
      }
      if (m.arp) {
        const idx = m.arpPattern[b % m.arpPattern.length] % chord.length;
        const oct = (b % 16) >= 8 ? 12 : 24;
        this._tone(m.wave, N(chord[idx] + oct), t, spb * 0.9, out, m.arp, 0.005, 0, 2600);
      }
      if (m.pulse && b % 2 === 0) this._tone('square', N(chord[0] - 12), t, spb * 0.5, out, m.pulse, 0.003, 0, 700);
      if (m.drums) {
        if (b % 4 === 0) this._kick(t, out, m.drums);
        if (b % 4 === 2) this._snare(t, out, m.drums * 0.6);
        this._hat(t, out, m.drums * (b % 2 ? 0.12 : 0.2));
      }
      this._next += spb;
      this._beat++;
    }
  }

  _tone(type, f, t, dur, out, gain, attack, detune, cutoff) {
    const c = Audio.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.setTargetAtTime(0.0001, t + Math.max(attack, dur * 0.6), dur * 0.25);
    o.connect(fl).connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.6);
  }

  _kick(t, out, v) {
    const c = Audio.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
  }

  _snare(t, out, v) { Audio._noiseBurst(t, 0.14, out, { gain: v * 0.4, type: 'highpass', freq: 1500 }); }
  _hat(t, out, v) { Audio._noiseBurst(t, 0.03, out, { gain: v * 0.3, type: 'highpass', freq: 7000 }); }
}

export const music = new Music();
