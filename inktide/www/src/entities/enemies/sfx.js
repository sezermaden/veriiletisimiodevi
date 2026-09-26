// Murk Corps synth sound recipes (registered with the shared audio engine on import).
// Every recipe: (A = AudioEngine, out = routed GainNode, t = start time, o = sfx options).
import { registerSfx } from '../../engine/audio.js';

// Glooper blaster: a wet, low "blorp" so enemy fire reads differently from the hero's crisp shot.
registerSfx('murk_blast', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('sine', 380 * p, 150 * p, t, 0.09, out, 0.55);
  A.noiseBurst(t, 0.09, out, { type: 'lowpass', f0: 2200 * p, f1: 500, q: 5, gain: 0.55 });
});

// Riot shield blocks a shot: bright metallic clank with inharmonic ring.
registerSfx('shield_clank', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.noiseBurst(t, 0.05, out, { type: 'highpass', f0: 3000, q: 0.7, gain: 0.6 });
  A.osc('square', 1180 * p, 1100 * p, t, 0.06, out, 0.18);
  [1, 2.76, 5.4].forEach((k, i) => A.osc('sine', 620 * k * p, 600 * k * p, t, 0.35 - i * 0.08, out, 0.22 / (i + 1)));
});

// Rollerbrute revving before a charge.
registerSfx('roller_rev', (A, out, t) => {
  A.osc('sawtooth', 60, 190, t, 0.7, out, 0.22, 'lin');
  A.osc('square', 45, 120, t, 0.7, out, 0.12, 'lin');
  A.noiseBurst(t, 0.7, out, { type: 'lowpass', f0: 300, f1: 1400, q: 3, gain: 0.35, attack: 0.25 });
});

// Roller rumble while charging (called repeatedly, throttled).
registerSfx('roller_roll', (A, out, t) => {
  A.noiseBurst(t, 0.22, out, { type: 'lowpass', f0: 420, f1: 260, q: 2, gain: 0.55 });
  A.osc('sine', 70, 55, t, 0.2, out, 0.35);
});

// Heavy thing hits a wall.
registerSfx('bonk', (A, out, t) => {
  A.osc('sine', 160, 45, t, 0.28, out, 0.8);
  A.noiseBurst(t, 0.18, out, { type: 'lowpass', f0: 1200, f1: 150, q: 1, gain: 0.7 });
  A.osc('square', 520, 480, t + 0.02, 0.09, out, 0.12);
});

// Buzzdrone rotor buzz (short grain, repeated while hovering).
registerSfx('rotor', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  const b = A.osc('sawtooth', 118 * p, 124 * p, t, 0.32, out, 0.16, 'lin');
  // amplitude flutter so four props read as a buzz
  const lfo = A.ctx.createOscillator();
  const lg = A.ctx.createGain();
  lfo.frequency.value = 38 * p; lg.gain.value = 0.1;
  lfo.connect(lg).connect(b.g.gain);
  lfo.start(t); lfo.stop(t + 0.34);
  A.noiseBurst(t, 0.3, out, { f0: 900 * p, q: 3, gain: 0.08, attack: 0.05 });
});

// Falling bomb whistle.
registerSfx('bomb_whistle', (A, out, t, o) => {
  const d = o.dur ?? 0.6;
  A.osc('sine', 1700, 600, t, d, out, 0.18);
});

// Fuse / arming beeps.
registerSfx('fuse_beep', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('square', 1560 * p, 1560 * p, t, 0.05, out, 0.18);
});

// Snipe eel charge-up (duration in o.dur).
registerSfx('snipe_charge', (A, out, t, o) => {
  const d = o.dur ?? 1.4;
  A.osc('sine', 260, 1500, t, d, out, 0.16, 'lin');
  A.osc('triangle', 130, 750, t, d, out, 0.08, 'lin');
});

// Snipe eel full-charge glint ping.
registerSfx('snipe_ping', (A, out, t) => {
  A.osc('sine', 2600, 2600, t, 0.25, out, 0.2);
  A.osc('sine', 3900, 3900, t + 0.02, 0.2, out, 0.1);
});

// Snipe eel shot: sharp crack + zap tail.
registerSfx('snipe_shot', (A, out, t) => {
  A.noiseBurst(t, 0.12, out, { type: 'highpass', f0: 1800, q: 0.8, gain: 0.8 });
  A.osc('sawtooth', 2400, 300, t, 0.22, out, 0.22);
  A.osc('sine', 140, 50, t, 0.25, out, 0.6);
});

// Turret spin-up whine before a burst.
registerSfx('turret_whine', (A, out, t) => {
  A.osc('sawtooth', 300, 1100, t, 0.4, out, 0.1, 'lin');
  A.osc('sine', 600, 2200, t, 0.4, out, 0.1, 'lin');
});

// Turret shot: punchy mechanical thump.
registerSfx('turret_shot', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('square', 240 * p, 90 * p, t, 0.06, out, 0.25);
  A.noiseBurst(t, 0.07, out, { f0: 1600 * p, f1: 500, q: 1.3, gain: 0.55 });
});

// Pod heartbeat.
registerSfx('pod_pulse', (A, out, t) => {
  A.osc('sine', 90, 50, t, 0.18, out, 0.5);
  A.osc('sine', 80, 45, t + 0.2, 0.2, out, 0.35);
  A.noiseBurst(t, 0.15, out, { type: 'lowpass', f0: 500, f1: 200, q: 6, gain: 0.2 });
});

// Pod spits out a glooper.
registerSfx('pod_spawn', (A, out, t) => {
  A.osc('sine', 140, 520, t, 0.14, out, 0.55);
  A.noiseBurst(t, 0.3, out, { type: 'lowpass', f0: 1800, f1: 300, q: 6, gain: 0.5 });
  A.osc('sine', 520, 260, t + 0.12, 0.16, out, 0.3);
});

// Enemy grunt when hurt (goopy squeak).
registerSfx('murk_hurt', (A, out, t, o) => {
  const p = o.pitch ?? 1;
  A.osc('triangle', 520 * p, 300 * p, t, 0.09, out, 0.25);
});

// Search "huh?" two-note.
registerSfx('murk_huh', (A, out, t) => {
  A.osc('triangle', 420, 380, t, 0.08, out, 0.2);
  A.osc('triangle', 380, 560, t + 0.1, 0.12, out, 0.2);
});

// Eel mech stomp.
registerSfx('mech_step', (A, out, t) => {
  A.osc('sine', 110, 60, t, 0.1, out, 0.35);
  A.noiseBurst(t, 0.06, out, { type: 'bandpass', f0: 2600, q: 4, gain: 0.12 });
});
