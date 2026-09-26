// Synth recipes for the story layer (title cards, comics, results, dialogue). Registered on import.
import { registerSfx } from '../engine/audio.js';

const note = (semi, base = 440) => base * 2 ** (semi / 12);

// title card: ink whoosh + bright major chord stab
registerSfx('story_sting', (A, out, t) => {
  A.noiseBurst(t, 0.5, out, { f0: 300, f1: 3600, q: 1.4, gain: 0.45, attack: 0.12 });
  A.noiseBurst(t + 0.28, 0.35, out, { type: 'lowpass', f0: 2600, f1: 300, q: 3, gain: 0.6 });
  [0, 4, 7, 12].forEach((s) => A.osc('sawtooth', note(s, 392), note(s, 392), t + 0.3, 0.7, out, 0.07));
  [0, 7].forEach((s) => A.osc('square', note(s, 196), note(s, 196), t + 0.3, 0.45, out, 0.06));
});
// comic page turn
registerSfx('story_page', (A, out, t) => {
  A.noiseBurst(t, 0.28, out, { type: 'bandpass', f0: 900, f1: 3200, q: 0.9, gain: 0.35, attack: 0.05 });
  A.noiseBurst(t + 0.12, 0.2, out, { type: 'lowpass', f0: 1800, f1: 400, q: 2, gain: 0.35 });
});
// rank stamp thump
registerSfx('story_stamp', (A, out, t) => {
  A.osc('sine', 150, 45, t, 0.35, out, 0.9);
  A.noiseBurst(t, 0.25, out, { type: 'lowpass', f0: 2200, f1: 160, q: 2, gain: 0.8 });
  A.osc('triangle', note(12, 523), note(12, 523), t + 0.05, 0.4, out, 0.12);
});
// new kit fanfare
registerSfx('story_unlock', (A, out, t) => {
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => A.osc('square', note(s, 523), note(s, 523), t + i * 0.06, 0.22, out, 0.09));
  A.osc('sawtooth', note(24, 523), note(24, 523), t + 0.45, 0.8, out, 0.06);
  A.noiseBurst(t + 0.4, 0.9, out, { type: 'highpass', f0: 5000, q: 0.6, gain: 0.18, attack: 0.05 });
});
// result count-up tick
registerSfx('story_tick', (A, out, t, o) => A.osc('square', 1500 * (o.pitch ?? 1), 1500 * (o.pitch ?? 1), t, 0.025, out, 0.12));
// dialogue advance
registerSfx('story_next', (A, out, t) => { A.osc('sine', 980, 1310, t, 0.05, out, 0.2); });
// pirate-radio static burst for Pix / PA lines
registerSfx('story_radio', (A, out, t) => {
  A.noiseBurst(t, 0.16, out, { type: 'bandpass', f0: 2400, f1: 1600, q: 1.5, gain: 0.25 });
  A.osc('square', 2600, 2200, t, 0.05, out, 0.05);
});
// postcard reveal chime
registerSfx('story_postcard', (A, out, t) => {
  [0, 7, 12, 16].forEach((s, i) => A.osc('triangle', note(s, 659), note(s, 659), t + i * 0.09, 0.5, out, 0.12));
});
// ink splash wipe (comic transitions, title card)
registerSfx('story_splash', (A, out, t) => {
  A.noiseBurst(t, 0.32, out, { type: 'lowpass', f0: 3200, f1: 260, q: 3, gain: 0.55 });
  A.osc('sine', 260, 90, t, 0.22, out, 0.4);
});
// pearl chip bounce
registerSfx('story_pearl', (A, out, t) => A.osc('sine', 2093, 2637, t, 0.06, out, 0.12));
