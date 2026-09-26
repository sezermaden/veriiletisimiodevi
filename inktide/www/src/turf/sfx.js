// Turf Clash synth recipes (no audio files): judges' drumroll, the flag reveal ta-da and a map
// open/close blip. Registered once on import.
import { registerSfx } from '../engine/audio.js';

registerSfx('turf_drumroll', (A, out, t, o) => {
  const dur = o.dur ?? 2.6;
  const n = Math.floor(dur * 22);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const tt = t + i / 22 + (Math.random() - 0.5) * 0.006;
    A.noiseBurst(tt, 0.06, out, { type: 'bandpass', f0: 900 + k * 500, q: 1.2, gain: 0.18 + k * 0.5, attack: 0.002 });
    A.osc('triangle', 190, 150, tt, 0.05, out, 0.08 + k * 0.14);
  }
});

registerSfx('turf_reveal', (A, out, t) => {
  // cymbal crash + bright major arpeggio
  A.noiseBurst(t, 1.4, out, { type: 'highpass', f0: 5200, f1: 3000, q: 0.6, gain: 0.55, attack: 0.003 });
  A.osc('sine', 110, 55, t, 0.35, out, 0.7);
  [0, 4, 7, 12].forEach((s, i) => A.osc('square', 523.25 * 2 ** (s / 12), 523.25 * 2 ** (s / 12), t + 0.05 + i * 0.07, 0.4, out, 0.12));
});

registerSfx('turf_map', (A, out, t, o) => {
  const up = o.open !== false;
  A.osc('sine', up ? 620 : 880, up ? 980 : 520, t, 0.09, out, 0.3);
  A.noiseBurst(t, 0.08, out, { type: 'bandpass', f0: up ? 2400 : 1600, q: 3, gain: 0.15 });
});

registerSfx('turf_select', (A, out, t) => A.osc('triangle', 1175, 1175, t, 0.06, out, 0.25));
