// Boss-only synth recipes. boss_roar / boss_hit / boss_die live in engine/audio.js; these add the
// telegraph and attack sounds the four boss fights need. Helpers beyond osc/noiseBurst are called
// defensively so the recipes survive an older audio engine.
import { registerSfx } from '../../engine/audio.js';

const r = (a, b) => a + Math.random() * (b - a);
const wet = (A, out, k) => A.wet?.(out, k);
const sub = (A, t, f0, f1, d, out, g) => (A.sub ? A.sub(t, f0, f1, d, out, g) : A.osc('sine', f0, f1, t, d, out, g));

// engine revving up before a charge (~1.1 s)
registerSfx('boss_rev', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  const d = o.dur ?? 1.1;
  A.osc('sawtooth', 48 * p, 150 * p, t, d, out, 0.28, 'lin');
  A.osc('square', 96 * p, 300 * p, t, d, out, 0.08, 'lin');
  for (let i = 0; i < 7; i++) A.noiseBurst(t + i * d / 7, d / 7, out, { type: 'lowpass', f0: 300 + i * 120, f1: 180, q: 3, gain: 0.35 });
  sub(A, t, 60, 110, d, out, 0.35);
});

// warning siren (two-tone, three cycles)
registerSfx('boss_alarm', (A, out, t) => {
  for (let i = 0; i < 3; i++) {
    A.osc('square', 880, 880, t + i * 0.26, 0.12, out, 0.16);
    A.osc('square', 660, 660, t + i * 0.26 + 0.13, 0.12, out, 0.16);
  }
});

// heavy metal-on-concrete impact
registerSfx('boss_slam', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  sub(A, t, 110 * p, 28, 0.7, out, 1);
  A.noiseBurst(t, 0.6, out, { type: 'lowpass', f0: 2200, f1: 90, q: 1, gain: 0.95 });
  A.noiseBurst(t, 0.18, out, { type: 'bandpass', f0: 3200, f1: 900, q: 3, gain: 0.35 });
  A.osc('square', 190 * p, 70, t, 0.25, out, 0.18);
  A.debris?.(t + 0.05, 8, out, { spread: 0.6, gain: 0.12 });
  wet(A, out, 0.35);
});

// mortar / cannon thump
registerSfx('boss_mortar', (A, out, t, o) => {
  const p = (o.pitch ?? 1) * r(0.92, 1.08);
  sub(A, t, 190 * p, 55, 0.3, out, 0.9);
  A.noiseBurst(t, 0.25, out, { type: 'lowpass', f0: 1600, f1: 200, q: 2, gain: 0.6 });
  A.noiseBurst(t + 0.05, 0.4, out, { type: 'bandpass', f0: 500, f1: 1800, q: 1.5, gain: 0.18, attack: 0.08 });
});

// beam charging up (~0.9 s)
registerSfx('boss_charge', (A, out, t, o) => {
  const d = o.dur ?? 0.9;
  A.osc('sawtooth', 160, 1300, t, d, out, 0.14, 'lin');
  A.osc('sine', 320, 2600, t, d, out, 0.1, 'lin');
  A.noiseBurst(t, d, out, { type: 'bandpass', f0: 400, f1: 3000, q: 4, gain: 0.25, attack: d * 0.8 });
});

// gritty sludge jet (~0.8 s)
registerSfx('boss_beam', (A, out, t, o) => {
  const d = o.dur ?? 0.8;
  A.noiseBurst(t, d, out, { type: 'bandpass', f0: 900, f1: 500, q: 1.2, gain: 0.8, attack: 0.02 });
  A.noiseBurst(t, d, out, { type: 'lowpass', f0: 500, f1: 200, q: 2, gain: 0.6, attack: 0.02 });
  A.osc('sawtooth', 70, 55, t, d, out, 0.22, 'lin');
  A.droplets?.(t + 0.1, 10, out, { spread: d, gain: 0.07 });
});

// engine coughing and dying
registerSfx('boss_sputter', (A, out, t) => {
  for (let i = 0; i < 6; i++) {
    const ti = t + i * r(0.14, 0.24);
    A.noiseBurst(ti, 0.12, out, { type: 'lowpass', f0: r(500, 900), f1: 120, q: 3, gain: 0.7 });
    A.osc('square', r(55, 80), 40, ti, 0.1, out, 0.2);
  }
  A.osc('sawtooth', 320, 60, t, 1.4, out, 0.1);
});

// rotors / jets spooling up (~1.2 s)
registerSfx('boss_whir', (A, out, t, o) => {
  const d = o.dur ?? 1.2;
  A.noiseBurst(t, d, out, { type: 'bandpass', f0: 200, f1: 1400, q: 1.5, gain: 0.45, attack: d * 0.5 });
  A.osc('sawtooth', 40, 120, t, d, out, 0.12, 'lin');
});

// huge liquid eruption (serpent surfacing / flood)
registerSfx('boss_splash', (A, out, t) => {
  A.noiseBurst(t, 0.9, out, { type: 'lowpass', f0: 2600, f1: 200, q: 1.2, gain: 0.9 });
  sub(A, t, 120, 40, 0.6, out, 0.7);
  A.droplets?.(t + 0.15, 16, out, { spread: 0.9, gain: 0.08 });
  wet(A, out, 0.4);
});

// valve / weak point bursting
registerSfx('boss_burst', (A, out, t) => {
  A.osc('sine', 700, 1600, t, 0.08, out, 0.35);
  A.noiseBurst(t + 0.03, 0.5, out, { type: 'lowpass', f0: 3200, f1: 300, q: 3, gain: 0.9 });
  sub(A, t + 0.03, 160, 45, 0.4, out, 0.7);
  A.fm?.(t, 520, 1.41, 2, 0.4, out, 0.12);
  A.droplets?.(t + 0.1, 12, out, { spread: 0.6, gain: 0.09 });
});

// lock-on beep for missile target rings
registerSfx('boss_lock', (A, out, t) => {
  A.osc('square', 1480, 1480, t, 0.05, out, 0.14);
  A.osc('square', 1980, 1980, t + 0.07, 0.07, out, 0.14);
});

// armour ping (shots bouncing off plating)
registerSfx('boss_ping', (A, out, t) => {
  A.fm ? A.fm(t, r(900, 1300), 2.76, 1.5, 0.18, out, 0.12) : A.osc('triangle', 1200, 900, t, 0.1, out, 0.12);
  A.noiseBurst(t, 0.05, out, { type: 'highpass', f0: 3500, q: 0.8, gain: 0.15 });
});

// stomp / footstep of a giant mech
registerSfx('boss_step', (A, out, t) => {
  sub(A, t, 80, 30, 0.35, out, 0.8);
  A.noiseBurst(t, 0.2, out, { type: 'lowpass', f0: 600, f1: 120, q: 1, gain: 0.5 });
  A.osc('square', 140, 90, t, 0.06, out, 0.08);
});
