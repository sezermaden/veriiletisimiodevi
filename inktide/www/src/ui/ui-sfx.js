// Synth recipes for the menu layer. Registered once on import; played with audio.sfx(name).
import { registerSfx } from '../engine/audio.js';

const semi = (n) => 2 ** (n / 12);

// tab switch: a short swish with a bright click on top
registerSfx('ui_tab', (A, out, t) => {
  A.noiseBurst(t, 0.12, out, { f0: 900, f1: 4200, q: 2.2, gain: 0.28, attack: 0.01 });
  A.osc('triangle', 1480, 1480, t + 0.03, 0.06, out, 0.22);
});

// slider tick, pitched by value (o.pitch 0.5..2)
registerSfx('ui_slide', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 700 * p, 760 * p, t, 0.05, out, 0.28);
  A.osc('square', 1400 * p, 1400 * p, t, 0.02, out, 0.05);
});

// toggle: rising pop for ON, falling for OFF
registerSfx('ui_toggle', (A, out, t, o) => {
  const on = o.on !== false;
  A.osc('sine', on ? 420 : 900, on ? 980 : 380, t, 0.09, out, 0.35);
  A.noiseBurst(t, 0.05, out, { type: 'bandpass', f0: on ? 2600 : 1400, q: 5, gain: 0.18 });
});

// title press: a juicy ink splat followed by a rising major arpeggio
registerSfx('ui_splat', (A, out, t) => {
  A.noiseBurst(t, 0.32, out, { type: 'lowpass', f0: 3400, f1: 260, q: 5, gain: 0.9 });
  A.osc('sine', 300, 70, t, 0.22, out, 0.7);
  for (let i = 0; i < 5; i++) A.osc('sine', 1100 + Math.random() * 1800, 700, t + 0.04 + Math.random() * 0.12, 0.05, out, 0.1);
  [0, 4, 7, 12, 16].forEach((s, i) => A.osc('triangle', 523 * semi(s), 523 * semi(s), t + 0.12 + i * 0.055, 0.22, out, 0.16));
});

// screen open: soft whoosh
registerSfx('ui_open', (A, out, t) => {
  A.noiseBurst(t, 0.26, out, { f0: 500, f1: 2600, q: 1.6, gain: 0.26, attack: 0.06 });
  A.osc('sine', 660, 990, t + 0.04, 0.12, out, 0.12);
});

// equip: metallic clack + two-note chime
registerSfx('ui_equip', (A, out, t) => {
  A.osc('square', 1600, 900, t, 0.03, out, 0.2);
  A.noiseBurst(t, 0.06, out, { type: 'highpass', f0: 3200, q: 0.8, gain: 0.3 });
  A.osc('triangle', 784, 784, t + 0.06, 0.16, out, 0.26);
  A.osc('triangle', 1175, 1175, t + 0.13, 0.26, out, 0.24);
});

// buy upgrade: cascading coins
registerSfx('ui_buy', (A, out, t) => {
  [0, 7, 12, 19, 24].forEach((s, i) => A.osc('square', 988 * semi(s) / 2, 988 * semi(s) / 2, t + i * 0.045, 0.09, out, 0.1));
  A.osc('sine', 1976, 1976, t + 0.24, 0.3, out, 0.16);
  A.noiseBurst(t + 0.02, 0.2, out, { type: 'highpass', f0: 5000, q: 0.7, gain: 0.12 });
});

// unlock notification: sparkly arpeggio with shimmer
registerSfx('ui_unlock', (A, out, t) => {
  [0, 4, 7, 11, 14, 19].forEach((s, i) => A.osc('sine', 659 * semi(s), 659 * semi(s), t + i * 0.06, 0.3, out, 0.16));
  A.noiseBurst(t, 0.6, out, { type: 'highpass', f0: 6000, f1: 9000, q: 0.5, gain: 0.08, attack: 0.1 });
});

// denied (not enough pearls / locked): low double buzz
registerSfx('ui_denied', (A, out, t) => {
  A.osc('square', 190, 150, t, 0.09, out, 0.18);
  A.osc('square', 170, 120, t + 0.11, 0.12, out, 0.18);
});

// start a stage: big whoosh into a bright chord
registerSfx('ui_start', (A, out, t) => {
  A.noiseBurst(t, 0.55, out, { f0: 300, f1: 5200, q: 1.3, gain: 0.45, attack: 0.18 });
  A.osc('sawtooth', 220, 880, t, 0.4, out, 0.08);
  [0, 4, 7, 12].forEach((s) => A.osc('triangle', 392 * semi(s), 392 * semi(s), t + 0.34, 0.45, out, 0.14));
});

// pause / resume
registerSfx('ui_pause', (A, out, t) => {
  A.osc('sine', 880, 440, t, 0.14, out, 0.28);
  A.osc('triangle', 660, 330, t + 0.06, 0.16, out, 0.16);
});
registerSfx('ui_resume', (A, out, t) => {
  A.osc('sine', 440, 880, t, 0.12, out, 0.28);
  A.osc('triangle', 660, 1320, t + 0.05, 0.14, out, 0.14);
});

// rebind capture armed / captured
registerSfx('ui_listen', (A, out, t) => {
  A.osc('sine', 1200, 1200, t, 0.05, out, 0.2);
  A.osc('sine', 1200, 1200, t + 0.12, 0.05, out, 0.2);
});
registerSfx('ui_bound', (A, out, t) => {
  A.osc('triangle', 988, 988, t, 0.07, out, 0.24);
  A.osc('triangle', 1480, 1480, t + 0.07, 0.16, out, 0.24);
});
