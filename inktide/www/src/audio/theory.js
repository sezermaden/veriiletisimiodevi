// Tiny music-theory toolkit for the procedural soundtrack: note names, chord symbols and
// voice-leading. Pure functions (no WebAudio) so the song compiler can be unit-tested in Node.

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' → 73, 'Bb3' → 58. Returns null for rests / junk. */
export function noteToMidi(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) return null;
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** Pitch class of a note letter with optional accidental ('F#' → 6). */
export function pitchClass(s) {
  const m = /^([A-G])([#b]?)/.exec(s);
  if (!m) return null;
  return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

// chord qualities as intervals above the root (first = root)
const QUAL = {
  '': [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7],
  7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mMaj7: [0, 3, 7, 11],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
  m11: [0, 3, 7, 10, 14, 17], 11: [0, 7, 10, 14, 17], 13: [0, 4, 10, 14, 21],
  sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
  dim: [0, 3, 6], dim7: [0, 3, 6, 9], m7b5: [0, 3, 6, 10], aug: [0, 4, 8],
  5: [0, 7],
};

const chordCache = new Map();

/**
 * Parse a chord symbol: 'Am', 'F#m7', 'Bbmaj7', 'C/E', 'Gsus4', 'D5'.
 * @returns {{sym, root, bass, iv:number[], minor:boolean, third:number, fifth:number, seventh:number}}
 */
export function parseChord(sym) {
  if (chordCache.has(sym)) return chordCache.get(sym);
  const [main, slash] = sym.split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m) throw new Error(`bad chord "${sym}"`);
  const root = pitchClass(m[1]);
  const q = m[2];
  const iv = QUAL[q];
  if (!iv) throw new Error(`unknown chord quality "${q}" in "${sym}"`);
  const minor = iv.includes(3) && !iv.includes(4);
  const third = iv.includes(3) ? 3 : iv.includes(4) ? 4 : iv.includes(5) ? 5 : iv.includes(2) ? 2 : 4;
  const fifth = iv.includes(6) && !iv.includes(7) ? 6 : iv.includes(8) ? 8 : 7;
  const seventh = iv.includes(11) ? 11 : iv.includes(9) && (q === 'dim7' || q === '6' || q === 'm6') ? 9 : 10;
  const c = { sym, root, bass: slash ? pitchClass(slash) : root, iv, minor, third, fifth, seventh };
  chordCache.set(sym, c);
  return c;
}

/** Pitch classes of a chord (unique, root first). */
export function chordPcs(c) {
  const out = [];
  for (const i of c.iv) { const p = (c.root + i) % 12; if (!out.includes(p)) out.push(p); }
  return out;
}

/** Lowest midi >= lo with pitch class pc. */
export function pcAtOrAbove(pc, lo) { return lo + ((pc - lo) % 12 + 12) % 12; }

/**
 * Voice-led close voicing of a chord near `center`, moving as little as possible from `prev`.
 * At most `max` voices (drops the fifth first, then extensions above the ninth).
 */
export function voiceChord(c, prev, { center = 62, max = 4, spread = false } = {}) {
  let pcs = chordPcs(c);
  if (pcs.length > max) {
    const fifthPc = (c.root + 7) % 12;
    pcs = pcs.filter((p) => p !== fifthPc || pcs.length <= max);
    while (pcs.length > max) pcs.splice(pcs.length - 1, 1);
  }
  let best = null, bestCost = Infinity;
  for (let rot = 0; rot < pcs.length; rot++) {
    const order = pcs.slice(rot).concat(pcs.slice(0, rot));
    for (const base of [center - 10, center - 5, center]) {
      const v = [];
      let lo = base;
      for (const p of order) { const n = pcAtOrAbove(p, lo); v.push(n); lo = n + 1; }
      if (spread && v.length >= 3) v[1] += 12;          // open voicing: lift the 2nd voice an octave
      v.sort((a, b) => a - b);
      const mid = (v[0] + v[v.length - 1]) / 2;
      let cost = Math.abs(mid - center) * 0.6;
      if (prev && prev.length) {
        for (const n of v) { let d = 99; for (const q of prev) d = Math.min(d, Math.abs(n - q)); cost += d; }
      }
      if (cost < bestCost) { bestCost = cost; best = v; }
    }
  }
  return best;
}

/** Bass register for a chord: its bass note in [lo, lo+11]. */
export function bassRoot(c, lo = 33) { return pcAtOrAbove(c.bass, lo); }

/** Interval above the chord root for a bass-pattern symbol. */
export function bassInterval(c, ch) {
  switch (ch) {
    case 'R': case 'r': case 'x': return 0;
    case '3': return c.third;
    case '5': return c.fifth;
    case '7': return c.seventh;
    case 'O': case '8': return 12;
    case '2': return 2;
    case '4': return 5;
    case '6': return c.minor ? 8 : 9;
    case 'L': return c.fifth - 12;
    case 'b': return -2;          // a whole step below the root (walk-ups)
    default: return null;
  }
}
