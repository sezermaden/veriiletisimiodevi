// Synth recipes for stage objects (registered with the shared audio engine).
import { registerSfx } from '../../engine/audio.js';

const semi = (s) => 2 ** (s / 12);

// bright bell for switches
registerSfx('ding', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 1568 * p, 1568 * p, t, 0.9, out, 0.35);
  A.osc('sine', 2349 * p, 2349 * p, t, 0.6, out, 0.18);
  A.osc('triangle', 3136 * p, 3136 * p, t, 0.25, out, 0.08);
});
registerSfx('switch_on', (A, out, t) => {
  [0, 7, 12].forEach((s, i) => A.osc('triangle', 784 * semi(s), 784 * semi(s), t + 0.05 + i * 0.06, 0.22, out, 0.18));
  A.noiseBurst(t, 0.08, out, { type: 'highpass', f0: 3000, q: 0.8, gain: 0.3 });
});
registerSfx('switch_off', (A, out, t) => {
  [12, 7, 0].forEach((s, i) => A.osc('triangle', 784 * semi(s), 784 * semi(s), t + i * 0.07, 0.2, out, 0.14));
});
// glass hits / cracks / shatter for the Prism Core capsule
registerSfx('core_hit', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 2600 * p, 2400 * p, t, 0.28, out, 0.22);
  A.osc('sine', 3900 * p, 3700 * p, t, 0.18, out, 0.12);
  A.noiseBurst(t, 0.05, out, { type: 'highpass', f0: 4000, q: 0.7, gain: 0.35 });
  A.osc('sine', 220, 120, t, 0.12, out, 0.25);
});
registerSfx('core_crack', (A, out, t) => {
  A.noiseBurst(t, 0.16, out, { type: 'highpass', f0: 2200, q: 0.9, gain: 0.7 });
  A.noiseBurst(t + 0.03, 0.12, out, { type: 'bandpass', f0: 5200, q: 3, gain: 0.35 });
  A.osc('square', 180, 70, t, 0.14, out, 0.2);
});
registerSfx('core_shatter', (A, out, t) => {
  A.noiseBurst(t, 0.9, out, { type: 'highpass', f0: 1800, f1: 5000, q: 0.7, gain: 0.8 });
  for (let i = 0; i < 14; i++) {
    const f = 2400 + Math.random() * 4200;
    A.osc('sine', f, f * 0.95, t + Math.random() * 0.6, 0.12 + Math.random() * 0.2, out, 0.1);
  }
  A.osc('sine', 90, 30, t, 0.7, out, 0.9);
  A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 900, f1: 90, q: 1, gain: 0.9 });
});
registerSfx('core_rise', (A, out, t) => {
  [0, 4, 7, 11, 14, 19, 23].forEach((s, i) => A.osc('sine', 523 * semi(s), 523 * semi(s), t + i * 0.09, 0.5, out, 0.13));
  A.noiseBurst(t, 1.4, out, { type: 'bandpass', f0: 1200, f1: 6000, q: 2, gain: 0.18, attack: 0.5 });
});
// pearls: the classic pickup with a pitch that climbs over a chain
registerSfx('pearl', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 1760 * p, 1760 * p, t, 0.08, out, 0.3);
  A.osc('sine', 2637 * p, 2637 * p, t + 0.05, 0.16, out, 0.24);
  A.osc('triangle', 5274 * p, 5274 * p, t + 0.05, 0.06, out, 0.05);
});
registerSfx('postcard', (A, out, t) => {
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => A.osc('triangle', 659 * semi(s), 659 * semi(s), t + i * 0.07, 0.35, out, 0.16));
  A.noiseBurst(t, 0.8, out, { type: 'bandpass', f0: 3000, f1: 8000, q: 3, gain: 0.12, attack: 0.2 });
});
registerSfx('spring', (A, out, t) => {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(380, t + 0.35);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 26;
  const lg = ctx.createGain(); lg.gain.value = 40;
  lfo.connect(lg).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 0.45); lfo.start(t); lfo.stop(t + 0.45);
  A.noiseBurst(t, 0.06, out, { type: 'lowpass', f0: 900, f1: 300, gain: 0.35 });
});
registerSfx('sponge_grow', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.22, out, { type: 'lowpass', f0: 500 * p, f1: 1400 * p, q: 6, gain: 0.55 });
  A.osc('sine', 180 * p, 360 * p, t, 0.18, out, 0.3);
});
registerSfx('sponge_shrink', (A, out, t) => {
  A.noiseBurst(t, 0.25, out, { type: 'lowpass', f0: 1400, f1: 400, q: 6, gain: 0.5 });
  A.osc('sine', 360, 150, t, 0.2, out, 0.28);
});
registerSfx('rail_on', (A, out, t) => {
  A.osc('sawtooth', 110, 880, t, 0.5, out, 0.16);
  A.osc('square', 220, 1760, t + 0.05, 0.45, out, 0.06);
  A.noiseBurst(t, 0.5, out, { type: 'bandpass', f0: 800, f1: 5000, q: 3, gain: 0.25, attack: 0.05 });
  A.osc('sine', 1318, 1318, t + 0.45, 0.3, out, 0.2);
});
registerSfx('rail_ride', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.3, out, { type: 'bandpass', f0: 1400 * p, f1: 1900 * p, q: 5, gain: 0.3, attack: 0.03 });
  A.osc('sawtooth', 140 * p, 150 * p, t, 0.28, out, 0.05);
});
registerSfx('rail_hit', (A, out, t) => { A.osc('square', 900, 1400, t, 0.06, out, 0.15); A.osc('sine', 600, 600, t + 0.02, 0.1, out, 0.15); });
registerSfx('barrier_down', (A, out, t) => {
  A.osc('sawtooth', 520, 60, t, 0.9, out, 0.18);
  A.osc('square', 260, 40, t, 0.9, out, 0.08);
  A.noiseBurst(t, 1.0, out, { type: 'bandpass', f0: 3000, f1: 200, q: 2, gain: 0.4 });
});
registerSfx('barrier_hum', (A, out, t) => { A.osc('sawtooth', 60, 62, t, 0.4, out, 0.07); A.osc('sine', 120, 118, t, 0.4, out, 0.1); });
registerSfx('barrier_hit', (A, out, t) => { A.osc('sine', 900, 300, t, 0.12, out, 0.18); A.noiseBurst(t, 0.1, out, { type: 'bandpass', f0: 2500, q: 4, gain: 0.25 }); });
registerSfx('crate_hit', (A, out, t) => {
  A.osc('triangle', 240, 150, t, 0.08, out, 0.4);
  A.noiseBurst(t, 0.07, out, { type: 'bandpass', f0: 900, q: 2.5, gain: 0.45 });
});
registerSfx('crate_break', (A, out, t) => {
  for (let i = 0; i < 4; i++) A.noiseBurst(t + i * 0.035, 0.12, out, { type: 'bandpass', f0: 700 + Math.random() * 900, q: 2.2, gain: 0.55 });
  A.osc('triangle', 200, 70, t, 0.25, out, 0.45);
  A.noiseBurst(t, 0.35, out, { type: 'lowpass', f0: 1200, f1: 200, q: 1, gain: 0.4 });
});
registerSfx('balloon_pop', (A, out, t) => {
  A.noiseBurst(t, 0.09, out, { type: 'highpass', f0: 1200, q: 0.6, gain: 0.9, attack: 0.001 });
  A.osc('sine', 700, 180, t, 0.08, out, 0.35);
  A.noiseBurst(t + 0.02, 0.2, out, { type: 'lowpass', f0: 2600, f1: 300, q: 2, gain: 0.35 });
});
registerSfx('gate_clank', (A, out, t) => {
  A.osc('square', 140, 90, t, 0.18, out, 0.25);
  A.noiseBurst(t, 0.2, out, { type: 'bandpass', f0: 1800, q: 5, gain: 0.35 });
  A.osc('sine', 1900, 1850, t, 0.3, out, 0.08);
});
registerSfx('pad_charge', (A, out, t, o) => {
  const l = o.level ?? 0;
  A.osc('sine', 300 + l * 500, 340 + l * 560, t, 0.1, out, 0.15);
});
