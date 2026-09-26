// INKTIDE soundtrack — every track is original and written in the compact notation compiled by
// compose.js (see its header). Melody tokens: 'C5:4' = C5 for four 16ths, '>' slide, '!' accent,
// '.' staccato, '@ya' vocal-chop syllable, 'r' rest, '|' bar line (checked).
//
// Leitmotif: the title anthem's chorus hook returns in the final boss "hero" section and, slowed
// down and sung by the squid vocal chops, in the credits.

const trem = (note, n) => Array(n).fill(`${note}:1`).join(' ');
const bars = (s, n) => Array(n).fill(s).join(' | ');

// ------------------------------------------------------------------------------------------------
// Shared hooks
const TITLE_HOOK_1_3 = [
  'A5:3 F#5:3 A5:2 B5:2 A5:2 F#5:2 D5:2',        // D
  'E5:3 C#5:3 E5:2 F#5:2 E5:2 C#5:2 A4:2',        // A/C#
  'D5:2 F#5:2 B5:4 A5:2 F#5:2 D5:2 F#5:2',        // Bm
];
const TITLE_HOOK = [
  ...TITLE_HOOK_1_3, 'G5:4 F#5:2 E5:2 D5:2 E5:6', // G
  ...TITLE_HOOK_1_3, 'G5:2 A5:2 B5:2 C#6:2 D6:8', // G → lift
].join(' | ');

// the same hook sung by the squid chorus
const TITLE_HOOK_CHOP = [
  'A5:3@ya F#5:3@oh A5:2@la B5:2@la A5:2@ya F#5:2@oh D5:2@wa',
  'E5:3@ya C#5:3@oh E5:2@la F#5:2@la E5:2@ya C#5:2@oh A4:2@wa',
  'D5:2@ya F#5:2@ya B5:4@oh A5:2@la F#5:2@la D5:2@ya F#5:2@oh',
  'G5:4@ah F#5:2@la E5:2@la D5:2@ya E5:6@oh',
  'A5:3@ya F#5:3@oh A5:2@la B5:2@la A5:2@ya F#5:2@oh D5:2@wa',
  'E5:3@ya C#5:3@oh E5:2@la F#5:2@la E5:2@ya C#5:2@oh A4:2@wa',
  'D5:2@ya F#5:2@ya B5:4@oh A5:2@la F#5:2@la D5:2@ya F#5:2@oh',
  'G5:2@ya A5:2@ya B5:2@ya C#6:2@ay D6:8@ah',
].join(' | ');

const TURF_HOOK = [
  'G5:2@ya G5:2@ya Bb5:2@oh G5:2@ya r:2 F5:2@wa G5:4@oh',     // Eb
  'A5:2@ya A5:2@ya C6:2@oh A5:2@ya r:2 G5:2@wa A5:4@oh',      // F
  'Bb5:2@ya Bb5:2@ya D6:2@oh Bb5:2@ya r:2 A5:2@wa Bb5:4@oh',  // Gm
  'D6:4@hey C6:4@yeah Bb5:4@oh G5:4@ah',                      // Gm
  'G5:2@ya G5:2@ya Bb5:2@oh G5:2@ya r:2 F5:2@wa G5:4@oh',     // Eb
  'A5:2@ya A5:2@ya C6:2@oh A5:2@ya r:2 G5:2@wa A5:4@oh',      // F
  'D6:2@ya D6:2@ya F6:2@oh D6:2@ya r:2 C6:2@wa D6:4@oh',      // Bb
  'F#6:4@hey E6:4@yeah D6:4@oh A5:4@ah',                      // D
].join(' | ');
const TURF_HOOK_LEAD = TURF_HOOK.replace(/@[a-z]+/g, '');

const TURF_RIFF = [
  'D5:2 G5:2 Bb5:2 A5:2 G5:2 D5:2 F5:2 G5:2',     // Gm
  'Eb5:2 G5:2 Bb5:2 C6:2 Bb5:2 G5:2 F5:2 G5:2',   // Eb
  'F5:2 Bb5:2 D6:2 C6:2 Bb5:2 F5:2 A5:2 Bb5:2',   // Bb
  'A5:4 C6:4 F6:6 r:2',                           // F
  'D5:2 G5:2 Bb5:2 A5:2 G5:2 D5:2 F5:2 G5:2',
  'Eb5:2 G5:2 Bb5:2 C6:2 Bb5:2 G5:2 F5:2 G5:2',
  'F5:2 Bb5:2 D6:2 C6:2 Bb5:2 F5:2 A5:2 Bb5:2',
  'F6:2 E6:2 C6:2 A5:2 F5:4 r:4',
].join(' | ');

const TURF_LIFT = [
  'F5:3 Bb5:3 D6:2 C6:2 Bb5:2 C6:4',              // Bb
  'C6:3 A5:3 F5:2 G5:2 A5:2 C6:4',                // F
  'D6:3 Bb5:3 G5:2 A5:2 Bb5:2 D6:4',              // Gm
  'Eb6:4 D6:4 Bb5:4 G5:4',                        // Eb
  'F5:3 Bb5:3 D6:2 C6:2 Bb5:2 C6:4',
  'C6:3 A5:3 F5:2 G5:2 A5:2 C6:4',
  'D6:3 Bb5:3 G5:2 A5:2 Bb5:2 D6:4',
  'G5:4 Bb5:4 F5:8',
].join(' | ');

// ------------------------------------------------------------------------------------------------
export const TRACKS = {
  // ============================================================================ TITLE (anthem)
  title: {
    bpm: 144, delay: 0.75, pump: 0.25,
    inst: {
      kick: { f0: 160, dec: 0.34, drive: 1.6 },
      bass: { wave: 'sawtooth', cut: 420, env: 1900, res: 6, drive: 2.2, sub: 0.5, d: 0.18, s: 0.7 },
      lead: { wave: 'sawtooth', wave2: 'square', cut: 3600, vib: 18, detune: 9, vol: 1 },
      chop: { shift: 1.25, vol: 1.1 },
      pad: { cut: 1800, a: 0.25, detune: 12 },
      stab: { wave: 'sawtooth', cut: 2600, d: 0.09 },
      bell: { kind: 'glock' },
      arp: { wave: 'square', cut: 1400, env: 3000, vol: 0.8 },
    },
    sections: {
      intro: {
        bars: 4, chords: 'D A/C# Bm G', pad: true, drums: { k: 'X...............' }, riser: 1,
        bell: 'F#6:4 E6:4 D6:4 A5:4 | E6:4 C#6:4 A5:8 | D6:4 C#6:4 B5:4 F#5:4 | G5:4 A5:4 B5:8',
      },
      A: {
        bars: 8, chords: 'Bm G D A', drums: 'rock2', fill: 'snare',
        bass: 'R.R.R.R.R.R.R.R.', stab: 'x..x..x...x..x..',
        chop: [
          'B4:2@ya D5:2@oh F#5:4@wa E5:2@la D5:2@la B4:4@oh',
          'G4:2@ya B4:2@oh D5:4@wa E5:2@la D5:2@la B4:4@oh',
          'A4:2@ya D5:2@oh F#5:4@wa E5:2@la F#5:2@la A5:4@oh',
          'G5:3@ay F#5:3@oh E5:6@ah r:4',
          'B4:2@ya D5:2@oh F#5:4@wa E5:2@la D5:2@la B4:4@oh',
          'G4:2@ya B4:2@oh D5:4@wa E5:2@la D5:2@la B4:4@oh',
          'A4:2@ya D5:2@oh F#5:4@wa E5:2@la F#5:2@la A5:4@oh',
          'E5:3@ay F#5:3@oh A5:6@ah r:4',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'D A/C# Bm G', drums: 'drive', fill: 'roll', pad: true,
        bass: 'R.R.R.R.R.R.O.5.', lead: TITLE_HOOK, stab: '..x...x...x...x.',
        hi: { chop: TITLE_HOOK_CHOP },
      },
      C: {
        bars: 8, chords: 'G A F#m Bm G A D D', drums: 'four', fill: 'claps',
        bass: 'R.ROR.ROR.ROR.RO', arp: { p: 'up', r: 1, o: 2, v: 0.6 },
        chop: [
          'D6:2@ya D6:2@ya B5:2@oh A5:2@wa r:2 B5:2@ya A5:4@oh',
          'C#6:2@ya C#6:2@ya A5:2@oh E5:2@wa r:2 F#5:2@ya E5:4@oh',
          'A5:2@ya A5:2@ya F#5:2@oh C#5:2@wa r:2 E5:2@ya F#5:4@oh',
          'D5:3@la E5:3@la F#5:6@oh r:4',
          'D6:2@ya D6:2@ya B5:2@oh A5:2@wa r:2 B5:2@ya A5:4@oh',
          'C#6:2@ya C#6:2@ya A5:2@oh E5:2@wa r:2 F#5:2@ya E5:4@oh',
          'F#6:2@ya F#6:2@ya D6:2@oh A5:2@wa r:2 B5:2@ya A5:4@oh',
          'D6:8@ah r:8',
        ].join(' | '),
      },
      brk: {
        bars: 4, chords: 'Bm Gmaj7 D A', drums: 'half', pad: true, riser: 1, crash: true,
        bass: 'R-------R-------',
        bell: 'B5:4 A5:4 F#5:4 D5:4 | G5:4 F#5:4 D5:4 B4:4 | A5:4 F#5:4 D5:4 A4:4 | E5:4 C#5:4 A4:8',
      },
    },
    form: ['intro', 'A', 'B', 'C', 'brk', 'B'],
    loop: 1,
  },

  // ============================================================================ MENU (chill)
  menu: {
    bpm: 90, swing: 0.2, delay: 0.75, feedback: 0.4, pump: 0,
    inst: {
      kick: { f0: 120, dec: 0.4, click: 0.15 },
      snare: { dec: 0.14, hp: 1400, vol: 0.7 },
      bass: { wave: 'triangle', cut: 700, env: 500, res: 2, sub: 0.7, d: 0.4, s: 0.6 },
      stab: { wave: 'triangle', cut: 1800, d: 0.5, s: 0.35, r: 0.3 },
      bell: { kind: 'ep', vol: 0.9 },
      chop: { shift: 1.18, vol: 1, fall: 2 },
      pad: { cut: 1100, a: 0.6, detune: 8 },
    },
    mix: { stab: 0.3, snare: 0.45, hat: 0.24, perc: 0.3 },
    sections: {
      intro: {
        bars: 4, chords: 'Bbmaj7 Am7 Gm7 C7sus4', pad: true, drums: { h: 'x.x.x.x.x.x.x.x.' },
        bell: 'D6:4 C6:4 A5:8 | C6:4 G5:4 E5:8 | Bb5:4 F5:4 D5:8 | C5:16',
      },
      A: {
        bars: 8, chords: 'Bbmaj7 Am7 Gm7 C7sus4 Bbmaj7 Am7 Gm7 C7', drums: ['lofi', { p: '....r.......r...' }],
        bass: 'R.....R.5...3.R.', stab: '..x.....x.x.....',
        chop: [
          'r:4 D5:2@la F5:2@la A5:6@oh r:2', 'G5:3@ya E5:3@oh C5:6@wa r:4',
          'r:4 Bb4:2@la D5:2@la F5:4@oh E5:2@ee D5:2@ah', 'C5:8@oo r:8',
          'r:4 D5:2@la F5:2@la A5:6@oh r:2', 'G5:3@ya E5:3@oh C5:6@wa r:4',
          'r:4 Bb4:2@la D5:2@la F5:4@oh A5:2@ee G5:2@ah', 'G5:4@yo E5:4@oh C5:8@oo',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'Dm9 Gm7 Bbmaj7 C9', drums: ['lofi', { p: '..k.....r.k.....', oh: '..............x.' }],
        bass: 'R..R..5...R.O.5.', pad: { v: 0.6 },
        bell: [
          'A5:2 C6:2 E6:4 D6:4 A5:4', 'Bb5:2 D6:2 F6:4 D6:4 Bb5:4', 'A5:2 C6:2 D6:4 F6:4 A5:4', 'G5:4 E5:4 D5:4 C5:4',
          'A5:2 C6:2 E6:4 D6:4 A5:4', 'Bb5:2 D6:2 F6:4 D6:4 Bb5:4', 'A5:2 C6:2 D6:4 F6:4 A5:4', 'G5:4 Bb5:4 E6:8',
        ].join(' | '),
        chop: 'r:64 | r:8 A5:4@ya F5:4@oh | r:8 D6:4@ya Bb5:4@oh | r:8 F5:4@ya D5:4@oh | r:8 E5:4@yo G5:4@oh',
      },
    },
    form: ['intro', 'A', 'B', 'A'],
    loop: 1,
  },

  // ============================================================================ MAP (bouncy)
  map: {
    bpm: 120, shuffle: 0.1, delay: 0.5,
    inst: {
      kick: { f0: 140, dec: 0.28 },
      bass: { wave: 'square', cut: 500, env: 1200, res: 4, sub: 0.6, d: 0.12, s: 0.4 },
      bell: { kind: 'mallet', vol: 1.1 },
      chop: { shift: 1.3, vol: 1 },
      arp: { type: 'bell', kind: 'mallet', vol: 0.7 },
      stab: { wave: 'square', cut: 1800, d: 0.07, s: 0.1 },
    },
    mix: { bell: 0.44, arp: 0.2, perc: 0.3 },
    sections: {
      intro: {
        bars: 2, chords: 'G D', drums: { k: 'X...x...X...x...', p: '..k...k...k...k.' }, crash: false,
        bass: 'R.O.R.O.R.O.5.O.',
      },
      A: {
        bars: 8, chords: 'G D Em C G D C_D G', drums: ['bounce', { p: '..k...k...k...k.' }], fill: 'snare',
        bass: 'R.O.R.O.R.O.5.O.', stab: '..x...x...x...x.',
        bell: [
          'D5:2 G5:2 B5:2 G5:2 D5:2 G5:2 B5:2 D6:2', 'D6:2 A5:2 F#5:2 A5:2 D5:4 r:4',
          'E5:2 G5:2 B5:2 E6:2 D6:2 B5:2 G5:4', 'C6:2 B5:2 A5:2 G5:2 E5:4 r:4',
          'D5:2 G5:2 B5:2 G5:2 D5:2 G5:2 B5:2 D6:2', 'F#5:2 A5:2 D6:2 F#6:2 E6:2 D6:2 A5:4',
          'E6:2 C6:2 G5:2 C6:2 F#6:2 D6:2 A5:2 D6:2', 'G6:4 D6:2 B5:2 G5:4 r:4',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'C D Bm Em Am D7 G G', drums: ['bounce', { p: 'c...c...c...c.c.' }], fill: 'toms',
        bass: 'R.O.R.O.R.O.5.O.', arp: { p: 'updown', r: 2, o: 2, v: 0.6 },
        chop: [
          'G5:2@ya E5:2@oh G5:2@ya C6:4@wa r:6', 'A5:2@ya F#5:2@oh A5:2@ya D6:4@wa r:6',
          'F#5:2@ya D5:2@oh F#5:2@ya B5:4@wa r:6', 'G5:3@la F#5:3@la E5:4@oh r:6',
          'E5:2@ya C5:2@oh E5:2@ya A5:4@wa r:6', 'F#5:2@ya D5:2@oh A5:2@ya C6:4@wa r:6',
          'B5:4@hey r:4 D6:4@hey r:4', 'G5:8@ah r:8',
        ].join(' | '),
      },
    },
    form: ['intro', 'A', 'B', 'A', 'B'],
    loop: 1,
  },

  // ============================================================================ DOCKS (surf-ska)
  docks: {
    bpm: 168, delay: 0.5, feedback: 0.25,
    inst: {
      kick: { f0: 140, dec: 0.3 },
      snare: { dec: 0.16, tune: 1.1 },
      bass: { wave: 'triangle', wave2: 'sawtooth', detune: 4, cut: 800, env: 900, res: 2, sub: 0.55, d: 0.3, s: 0.5 },
      lead: { wave: 'square', wave2: 'sawtooth', cut: 2800, vib: 30, vibRate: 6.5, vibDelay: 0.1, detune: 6, mix2: 0.4 },
      stab: { kind: 'skank', wave: 'square', d: 0.07, s: 0.05 },
      chop: { shift: 1.28, vol: 1.1 },
    },
    mix: { stab: 0.3, lead: 0.24 },
    sends: { lead: [0.42, 0.12] },
    sections: {
      intro: {
        bars: 4, chords: 'A A D E', drums: { t: '............AbBc' }, crash: false,
        lead: [trem('E5', 8) + ' ' + trem('C#5', 8), trem('E5', 8) + ' ' + trem('A5', 8), trem('F#5', 8) + ' ' + trem('A5', 8), 'B5:4 G#5:4 E5:8'].join(' | '),
      },
      A: {
        bars: 8, chords: 'A F#m D E', drums: 'ska', fill: 'snare',
        bass: 'R...3...5...6...', stab: '..x...x...x...x.',
        lead: [
          'E5:2 A5:2 C#6:4 B5:2 A5:2 E5:4', 'F#5:2 A5:2 C#6:4 B5:2 A5:2 F#5:4',
          'D5:2 F#5:2 A5:4 B5:2 A5:2 F#5:2 D5:2', 'E5:4 G#5:4 B5:6 r:2',
          'E5:2 A5:2 C#6:4 B5:2 A5:2 E5:4', 'F#5:2 A5:2 C#6:4 B5:2 A5:2 F#5:4',
          'D6:2 C#6:2 B5:2 A5:2 F#5:2 A5:2 B5:4', 'E5:1 E5:1 E5:1 E5:1 G#5:4 E5:8',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'D E C#m F#m D E A A', drums: 'punk', fill: 'toms',
        bass: 'R.R.R.R.R.R.O.5.', stab: '..x...x...x...x.',
        chop: [
          'F#5:2@ya A5:2@ya A5:2@oh F#5:2@wa A5:4@ya D6:4@oh', 'G#5:2@ya B5:2@ya B5:2@oh G#5:2@wa B5:4@ya E6:4@oh',
          'E5:2@ya G#5:2@ya G#5:2@oh E5:2@wa G#5:4@ya C#6:4@oh', 'C#6:4@ee A5:4@la F#5:8@ah',
          'F#5:2@ya A5:2@ya A5:2@oh F#5:2@wa A5:4@ya D6:4@oh', 'G#5:2@ya B5:2@ya B5:2@oh G#5:2@wa B5:4@ya E6:4@oh',
          'A5:2@ya C#6:2@ya E6:4@oh C#6:2@wa B5:2@ya A5:4@oh', 'A5:8@ah r:8',
        ].join(' | '),
        hi: { lead: bars('r:16', 7) + ' | ' + trem('A5', 8) + ' ' + trem('E6', 8) },
      },
      C: {
        bars: 8, chords: 'F#m D A E', drums: ['rock2', { t: '..............bc' }], fill: 'toms2',
        bass: 'R.R.5.R.R.R.5.O.', pad: { v: 0.5 },
        lead: [
          trem('C#6', 8) + ' ' + trem('A5', 8), trem('D6', 8) + ' ' + trem('A5', 4) + ' ' + trem('F#5', 4),
          trem('E6', 8) + ' ' + trem('C#6', 8), trem('B5', 8) + ' ' + trem('G#5', 4) + ' ' + trem('E5', 4),
          trem('C#6', 8) + ' ' + trem('A5', 8), trem('D6', 8) + ' ' + trem('A5', 4) + ' ' + trem('F#5', 4),
          trem('E6', 8) + ' ' + trem('C#6', 8), 'B5:4 G#5:4 E5:8',
        ].join(' | '),
      },
    },
    form: ['intro', 'A', 'B', 'A', 'B', 'C', 'B'],
    loop: 1,
  },

  // ============================================================================ HEIGHTS (synth-funk)
  heights: {
    bpm: 110, swing: 0.14, delay: 0.75, feedback: 0.38, pump: 0.2,
    inst: {
      kick: { f0: 130, dec: 0.32 },
      bass: { wave: 'square', cut: 300, env: 2600, res: 7, fdec: 0.09, sub: 0.6, d: 0.14, s: 0.45 },
      stab: { wave: 'square', cut: 1500, d: 0.06, s: 0.05, q: 4 },
      chop: { shift: 1.32, vol: 1.15, fall: 3 },
      lead: { wave: 'sawtooth', wave2: 'sawtooth', detune: 10, cut: 2200, fenv: 1.8, a: 0.02, vib: 12 },
      arp: { wave: 'square', cut: 1200, env: 2600, vol: 0.8 },
      bell: { kind: 'ep' },
      pad: { cut: 1300, a: 0.5 },
    },
    mix: { perc: 0.34, stab: 0.28 },
    sections: {
      intro: {
        bars: 4, chords: 'Em9 A9', drums: { h: 'xoxoxoxoxoxoxoxo', p: '......h...l.....' }, crash: false,
        arp: { p: 'up', r: 1, o: 2, v: 0.55 }, pad: { v: 0.5 }, riser: 1,
      },
      A: {
        bars: 8, chords: 'Em9 A9', drums: ['funk', { p: '......h...l..h..' }], fill: 'snare',
        bass: 'R..RO..R..R.5.7.', stab: '..x..x....x..x..',
        chop: [
          'B5:1@ya r:1 B5:1@ya r:1 G5:2@oh E5:2@wa F#5:3@ya D5:3@oh E5:2@oo', 'r:4 C#6:2@ya B5:2@oh A5:2@wa G5:2@ya E5:4@oh',
          'B5:1@ya r:1 B5:1@ya r:1 G5:2@oh E5:2@wa F#5:3@ya D5:3@oh E5:2@oo', 'r:4 E6:2@hey D6:2@yeah C#6:2@oh B5:2@la A5:4@ah',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'Cmaj7 Bm7 Am7 Bm7', drums: ['funk2', { p: '..h...l...h..l..' }], fill: 'toms', pad: { v: 0.55 },
        bass: 'R..R..O.R..R.5O.', stab: '..x..x....x..x..',
        lead: [
          'G5:3 B5:3 E6:4 D6:2 B5:2 G5:2', 'F#5:3 A5:3 D6:4 C#6:2 B5:2 A5:2', 'E5:3 G5:3 C6:4 B5:2 A5:2 G5:2', 'F#5:4 A5:4 B5:8',
          'G5:3 B5:3 E6:4 D6:2 B5:2 G5:2', 'F#5:3 A5:3 D6:4 C#6:2 B5:2 A5:2', 'E5:3 G5:3 C6:4 B5:2 A5:2 G5:2', 'D6:4 C#6:4 B5:4 F#5:4',
        ].join(' | '),
        hi: { chop: 'r:112 | r:8 B5:2@hey r:2 D6:4@hey' },
      },
      brk: {
        bars: 4, chords: 'Cmaj7 Bm7 Am7 B7', drums: 'half', pad: true, riser: 1,
        bass: 'R-------R-------',
        bell: 'E6:4 D6:4 B5:8 | D6:4 C#6:4 A5:8 | C6:4 B5:4 G5:8 | A5:4 B5:4 D#6:8',
      },
    },
    form: ['intro', 'A', 'B', 'A', 'brk', 'B'],
    loop: 1,
  },

  // ============================================================================ REFINERY (industrial)
  refinery: {
    bpm: 126, delay: 0.75, feedback: 0.42, pump: 0.45, syllables: ['hey', 'oh', 'ha', 'oh'],
    inst: {
      kick: { f0: 150, f1: 42, dec: 0.4, drive: 2.4, click: 0.4 },
      clap: { f: 1400, dec: 0.2 },
      bass: { wave: 'sawtooth', cut: 260, env: 2400, res: 11, fdec: 0.12, drive: 3, sub: 0.35, d: 0.12, s: 0.5, lo: 29 },
      lead: { wave: 'sawtooth', wave2: 'square', cut: 2400, drive: 1.8, vib: 10, detune: 12 },
      chop: { shift: 0.98, vol: 1.2, scoop: 0.5 },
      arp: { wave: 'square', cut: 700, env: 2400, q: 6, vol: 0.9 },
      pad: { cut: 850, a: 0.8, detune: 14 },
      bell: { kind: 'glock', vol: 0.7 },
    },
    mix: { perc: 0.36, clap: 0.62, bass: 0.22, kick: 0.38 },
    sections: {
      intro: {
        bars: 4, chords: 'Fm', drums: { k: 'X...X...X...X...', p: '..k..r....k..r.k' }, crash: false,
        pad: { v: 0.6 }, riser: 1,
      },
      A: {
        bars: 8, chords: 'Fm Fm Db Eb', drums: ['four', { p: '..k..r....k..r.k', h: 'x.x.x.x.x.x.x.x.' }], fill: 'kicks',
        bass: 'R.RRR.RO.RR.R.5R', arp: { p: 'random', r: 1, o: 2, v: 0.55 },
        chop: 'r:8 C5:2@hey r:2 C5:2@hey Eb5:2@oh | F5:4@oh r:12 | r:8 Db5:2@hey r:2 Db5:2@hey F5:2@oh | Eb5:4@oh r:4 G5:2@ha Bb5:2@ha r:4',
      },
      B: {
        bars: 8, chords: 'Db Eb Fm Fm Db Eb C C', drums: ['four', { p: '..k..r....k..r.k', h: 'xxxxxxxxxxxxxxxx' }], fill: 'roll',
        bass: 'R.RRR.RO.RR.R.5R', pad: { v: 0.5 },
        lead: [
          'F5:2 Ab5:2 Db6:3 Ab5:3 F5:2 Db5:4', 'G5:2 Bb5:2 Eb6:3 Bb5:3 G5:2 Eb5:4',
          'Ab5:2 C6:2 F6:3 Eb6:3 C6:2 Ab5:4', 'G5:4 Ab5:4 F5:8',
          'F5:2 Ab5:2 Db6:3 Ab5:3 F5:2 Db5:4', 'G5:2 Bb5:2 Eb6:3 Bb5:3 G5:2 Eb5:4',
          'E5:2 G5:2 C6:3 G5:3 E5:2 C5:4', 'C5:4 E5:4 G5:4 Bb5:4',
        ].join(' | '),
      },
      brk: {
        bars: 4, chords: 'Fm Fm Db C', drums: { p: '..k..r....k..r.k', h: '....x.......x...' }, riser: 2, crash: true,
        bass: 'R---------------', pad: true,
        bell: 'C6:2 r:2 Ab5:2 r:2 F5:2 r:6 | C6:2 r:2 Ab5:2 r:2 G5:2 r:6 | Db6:2 r:2 Ab5:2 r:2 F5:2 r:6 | E5:2 r:2 G5:2 r:2 C6:2 r:6',
      },
    },
    form: ['intro', 'A', 'B', 'A', 'brk', 'B'],
    loop: 1,
  },

  // ============================================================================ TOWER (tense)
  tower: {
    bpm: 148, delay: 0.5, feedback: 0.3,
    inst: {
      kick: { f0: 150, dec: 0.3, drive: 1.4 },
      bass: { wave: 'sawtooth', cut: 360, env: 1500, res: 5, drive: 1.6, sub: 0.5, d: 0.1, s: 0.55 },
      stab: { wave: 'sawtooth', cut: 1600, d: 0.08, s: 0.2 },
      lead: { wave: 'sawtooth', wave2: 'sawtooth', detune: 11, cut: 2600, vib: 20, a: 0.012 },
      chop: { shift: 1.05, vol: 1.1, scoop: 1 },
      pad: { cut: 1000, a: 0.6 },
      bell: { kind: 'bell', vol: 0.8 },
    },
    sections: {
      intro: {
        bars: 4, chords: 'Cm Cm Ab G', drums: { h: 'x.x.x.x.x.x.x.x.', t: '..............cc' }, crash: false,
        bass: 'R.R.R.R.R.R.R.R.', stab: 'x.xxx.xxx.xxx.xx', riser: 1,
      },
      A: {
        bars: 8, chords: 'Cm Cm Ab G', drums: ['drive', { t: '..............bc' }], fill: 'toms',
        bass: 'R.R.O.R.R.R.O.R.', stab: 'x.xxx.xxx.xxx.xx',
        lead: [
          'C5:2 Eb5:2 G5:4 F5:2 Eb5:2 D5:2 Eb5:2', 'G5:6 Ab5:2 G5:4 Eb5:4',
          'Ab5:2 G5:2 F5:2 Eb5:2 C5:4 Eb5:4', 'D5:4 B4:4 G4:4 B4:4',
          'C5:2 Eb5:2 G5:4 F5:2 Eb5:2 D5:2 Eb5:2', 'G5:6 Bb5:2 C6:4 G5:4',
          'C6:3 Bb5:3 Ab5:2 G5:2 F5:2 Eb5:4', 'D5:4 F5:4 B4:8',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'Fm Ab Bb Cm Fm Ab G G', drums: 'rock2', fill: 'roll', pad: { v: 0.6 },
        bass: 'R.R.R.R.R.R.O.5.', stab: 'x..x..x.x..x..x.',
        chop: [
          'F5:2@oh Ab5:2@oh C6:4@ah C6:2@ya Bb5:2@ya Ab5:4@oh', 'Eb5:2@oh Ab5:2@oh C6:4@ah Bb5:2@ya Ab5:2@ya Eb5:4@oh',
          'D5:2@oh F5:2@oh Bb5:4@ah Bb5:2@ya C6:2@ya D6:4@oh', 'Eb6:8@ah D6:4@oh C6:4@oo',
          'F5:2@oh Ab5:2@oh C6:4@ah C6:2@ya Bb5:2@ya Ab5:4@oh', 'Eb5:2@oh Ab5:2@oh C6:4@ah Bb5:2@ya Ab5:2@ya Eb5:4@oh',
          'B5:2@oh D6:2@oh F6:4@ah D6:4@ya B5:4@oh', 'G5:8@ah r:8',
        ].join(' | '),
      },
      brg: {
        bars: 4, chords: 'Ab Fm G G', drums: 'half', pad: true, riser: 1,
        bass: 'R-------R-------',
        bell: 'C6:4 Eb6:4 Ab5:8 | F5:4 Ab5:4 C6:8 | B5:4 D6:4 G5:8 | F5:4 D5:4 B4:8',
      },
    },
    form: ['intro', 'A', 'B', 'A', 'brg', 'B'],
    loop: 1,
  },

  // ============================================================================ BOSS (aggressive)
  boss: {
    bpm: 174, delay: 0.5, feedback: 0.25, syllables: ['hey', 'ha', 'oh', 'hey'],
    inst: {
      kick: { f0: 165, dec: 0.28, drive: 2 },
      snare: { dec: 0.15, tune: 1.15 },
      bass: { wave: 'sawtooth', wave2: 'square', detune: 8, cut: 420, env: 2200, res: 6, drive: 2.8, sub: 0.45, d: 0.1, s: 0.6 },
      lead: { wave: 'sawtooth', wave2: 'sawtooth', detune: 14, cut: 3000, drive: 2.2, vib: 24, vibRate: 6.4, a: 0.004 },
      chop: { shift: 1.1, vol: 1.2, scoop: 0.8 },
      stab: { wave: 'sawtooth', cut: 2200, d: 0.06, s: 0.25 },
    },
    sections: {
      intro: {
        bars: 2, chords: 'Dm A', drums: { s: 'o.o.o.o.x.x.xxXX', k: 'X.......X.......' }, riser: 2, crash: false,
        bass: 'R.R.R.R.R.R.R.R.',
      },
      A: {
        bars: 8, chords: 'Dm Bb C A', drums: 'dnb', fill: 'snare', impact: true,
        bass: 'R.RO.RR.O.R.RO5.', stab: 'x..x..x.....x...',
        lead: [
          'D6:2 D6:1 D6:1 C6:2 A5:2 F5:2 A5:2 D5:4', 'D6:2 D6:1 D6:1 C6:2 Bb5:2 F5:2 Bb5:2 D5:4',
          'E6:2 E6:1 E6:1 D6:2 C6:2 G5:2 C6:2 E5:4', 'C#6:4 E6:4 A6:4 G6:4',
          'D6:2 D6:1 D6:1 C6:2 A5:2 F5:2 A5:2 D5:4', 'D6:2 D6:1 D6:1 C6:2 Bb5:2 F5:2 Bb5:2 D5:4',
          'E6:2 E6:1 E6:1 D6:2 C6:2 G5:2 C6:2 E5:4', 'A5:4 C#6:4 E6:8',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'Gm Dm Bb A', drums: 'blast', fill: 'roll',
        bass: 'R.R.O.R.R.R.O.R.', stab: 'x.x...x.x.x...x.', pad: { v: 0.5 },
        chop: [
          'G5:2@hey r:2 Bb5:2@hey r:2 D6:4@oh C6:2@ya Bb5:2@ya', 'A5:2@hey r:2 F5:2@hey r:2 D5:4@oh E5:2@ya F5:2@ya',
          'F5:2@hey r:2 Bb5:2@hey r:2 D6:4@oh F6:2@ya D6:2@ya', 'E6:4@oh C#6:4@ah A5:8@ah',
        ].join(' | '),
        hi: { lead: 'r:112 | A5:4 C#6:4 E6:4 A6:4' },
      },
    },
    form: ['intro', 'A', 'B', 'A', 'B'],
    loop: 1,
  },

  // ============================================================================ FINAL BOSS (epic)
  'final-boss': {
    bpm: 160, delay: 0.5, feedback: 0.3, pump: 0.2,
    inst: {
      kick: { f0: 160, dec: 0.32, drive: 1.8 },
      bass: { wave: 'sawtooth', cut: 380, env: 2000, res: 6, drive: 2.4, sub: 0.5, d: 0.12, s: 0.6 },
      lead: { wave: 'sawtooth', wave2: 'square', detune: 10, cut: 3200, drive: 1.5, vib: 20 },
      chop: { shift: 1.12, vol: 1.1 },
      counter: { type: 'chop', shift: 1.0, vol: 0.9 },
      stab: { wave: 'sawtooth', cut: 2000, d: 0.08, s: 0.3 },
      pad: { cut: 1400, a: 0.9, detune: 14 },
      bell: { kind: 'bell', vol: 1 },
    },
    mix: { counter: 0.46 },
    sections: {
      omen: {
        bars: 8, bpm: 84, chords: 'Dm Bb Gm A Dm Bb Gm A7', pad: true, impact: true, crash: false,
        drums: { t: 'C...............', k: 'X...............' },
        chop: 'D5:8@ah F5:8@ah | D5:8@oh Bb4:8@oh | G4:8@ah Bb4:8@ah | A4:8@oh C#5:8@oh | D5:8@ah F5:8@ah | F5:8@oh D5:8@oh | Bb4:8@ah D5:8@ah | C#5:8@oh E5:8@oh',
        counter: 'A5:8@ah A5:8@ah | F5:8@oh F5:8@oh | D5:8@ah D5:8@ah | E5:8@oh E5:8@oh | A5:8@ah A5:8@ah | Bb5:8@oh F5:8@oh | G5:8@ah F5:8@ah | E5:8@oh G5:8@oh',
        bell: 'D4:16 | r:16 | D4:16 | A3:16 | D4:16 | r:16 | G3:16 | A3:16',
        riser: 1,
      },
      battle: {
        bars: 16, chords: 'Dm Dm Bb C Gm Gm A A Dm Dm Bb C Gm Gm Bb A', drums: 'dnb', fill: 'roll', impact: true,
        bass: 'R.RO.RR.O.R.RO5.', stab: 'x.xxx.xxx.xxx.xx',
        lead: [
          'A5:4 D6:4 F6:4 E6:2 D6:2', 'C6:4 A5:4 F5:4 A5:4', 'Bb5:4 D6:4 F6:4 D6:4', 'E6:4 G6:4 C6:4 E6:4',
          'G5:4 Bb5:4 D6:4 C6:2 Bb5:2', 'A5:4 G5:4 D5:8', 'C#6:4 E6:4 A6:4 G6:4', 'E6:8 C#6:8',
          'A5:4 D6:4 F6:4 E6:2 D6:2', 'C6:4 A5:4 F5:4 A5:4', 'Bb5:4 D6:4 F6:4 D6:4', 'E6:4 G6:4 C6:4 E6:4',
          'G5:4 Bb5:4 D6:4 C6:2 Bb5:2', 'A5:4 G5:4 D5:8', 'F6:4 D6:4 Bb5:8', 'A5:16',
        ].join(' | '),
        hi: { chop: 'r:128 | ' + bars('D5:2@hey r:6 D5:2@hey r:6', 8) },
      },
      rise: {
        bars: 4, chords: 'Bb C Dm A', drums: { s: 'x...x...x...x...', k: 'X...X...X...X...' }, fill: 'roll', riser: 2, pad: true,
        bass: 'R.R.R.R.R.R.R.R.',
        chop: 'F5:8@oh F5:8@oh | G5:8@oh G5:8@oh | A5:16@ah | A5:8@oh C#6:8@ah',
      },
      hero: {
        bars: 8, chords: 'D A/C# Bm G', drums: 'drive', fill: 'toms', pad: true, impact: true,
        bass: 'R.R.R.R.R.R.O.5.', lead: TITLE_HOOK, stab: '..x...x...x...x.',
        chop: TITLE_HOOK_CHOP,
      },
      turn: {
        bars: 4, chords: 'Em A Bb A', drums: 'rock2', fill: 'snare', riser: 1,
        bass: 'R.R.R.R.R.R.R.R.',
        lead: 'G5:4 B5:4 E6:8 | E6:4 C#6:4 A5:8 | F6:4 D6:4 Bb5:8 | C#6:4 E6:4 A6:8',
      },
    },
    form: ['omen', 'battle', 'rise', 'hero', 'turn'],
    loop: 1,
  },

  // ============================================================================ TURF (hype 3-minute loop)
  turf: {
    bpm: 140, delay: 0.75, feedback: 0.3, pump: 0.3,
    inst: {
      kick: { f0: 158, dec: 0.33, drive: 1.8 },
      clap: { dec: 0.18 },
      bass: { wave: 'sawtooth', wave2: 'square', detune: 6, cut: 400, env: 2000, res: 6, drive: 2, sub: 0.5, d: 0.14, s: 0.6 },
      lead: { wave: 'square', wave2: 'sawtooth', detune: 9, cut: 3400, vib: 16 },
      chop: { shift: 1.26, vol: 1.15 },
      stab: { wave: 'sawtooth', cut: 2400, d: 0.08, s: 0.2 },
      arp: { wave: 'square', cut: 1000, env: 3200, vol: 0.8 },
      pad: { cut: 1500 },
      bell: { kind: 'glock', vol: 0.9 },
    },
    sections: {
      intro: {
        bars: 4, chords: 'Gm Eb Bb F', drums: { k: 'X...X...X...X...', cp: '....x.......x...' }, crash: false, riser: 2,
        pad: { v: 0.6 }, arp: { p: 'up', r: 1, o: 2, v: 0.5 },
      },
      A: {
        bars: 16, chords: 'Gm Eb Bb F', drums: ['house', { s: '....X.......X...' }], fill: 'snare',
        bass: 'R.RR.RR.R.RO.R5.', stab: 'x..x..x...x..x..', lead: TURF_RIFF,
        hi: { chop: 'r:128 | ' + bars('r:12 G5:2@hey r:2', 8) },
      },
      B: {
        bars: 16, chords: 'Eb F Gm Gm Eb F Bb D', drums: 'drive', fill: 'roll', impact: true, pad: { v: 0.55 },
        bass: 'R.R.O.R.R.R.O.5.', stab: '..x...x...x...x.', chop: TURF_HOOK,
      },
      C: {
        bars: 8, chords: 'Cm Gm Eb F', drums: 'half', pad: true, riser: 2,
        bass: 'R-------R---5---',
        bell: 'G5:4 Eb5:4 C5:8 | D5:4 Bb4:4 G4:8 | Bb4:4 G4:4 Eb5:8 | C5:4 A4:4 F5:8',
        arp: { p: 'updown', r: 2, o: 2, v: 0.45 },
      },
      D: {
        bars: 16, chords: 'Bb F Gm Ebmaj7', drums: ['four', { h: 'x.x.x.x.x.x.x.x.' }], fill: 'claps',
        bass: 'R.ROR.ROR.ROR.RO', arp: { p: 'up', r: 1, o: 2, v: 0.5 }, lead: TURF_LIFT,
        hi: { chop: bars('r:16', 7) + ' | r:8 D6:2@hey r:2 D6:2@hey F6:2@oh' },
      },
      B2: {
        bars: 16, chords: 'Eb F Gm Gm Eb F Bb D', drums: ['drive', { p: 't...t...t...t...' }], fill: 'toms', impact: true, pad: { v: 0.6 },
        bass: 'R.R.O.R.R.R.O.5.', stab: '..x...x...x...x.', chop: TURF_HOOK, lead: TURF_HOOK_LEAD,
      },
      brg: {
        bars: 8, chords: 'Gm Gm Eb F', drums: ['punk', {}], fill: 'stop', riser: 2,
        bass: 'R.R.R.R.R.R.R.R.',
        chop: 'G5:2@hey r:6 G5:2@hey r:6 | Bb5:2@hey r:6 Bb5:2@hey r:6 | G5:2@hey r:6 Bb5:2@hey r:6 | C6:4@oh r:12',
      },
    },
    form: ['intro', 'A', 'B', 'C', 'D', 'B2', 'brg'],
    loop: 1,
  },

  // ============================================================================ STORY (underscore)
  story: {
    bpm: 72, delay: 0.75, feedback: 0.45, layers: false, reverb: 1.3, fadeIn: 2,
    inst: {
      pad: { cut: 1100, a: 0.9, r: 1.8, detune: 9 },
      bell: { kind: 'ep', vol: 0.8 },
      arp: { wave: 'triangle', cut: 1400, env: 800, d: 0.4, s: 0.2, vol: 0.7 },
      chop: { shift: 1.15, vol: 0.8, a: 0.05, fall: 1 },
      bass: { wave: 'sine', cut: 400, env: 200, sub: 0, d: 1, s: 0.8, r: 0.4 },
    },
    mix: { pad: 0.3, bell: 0.42, arp: 0.14, bass: 0.2, chop: 0.5 },
    sections: {
      A: {
        bars: 16, chords: 'Ebmaj7 Abmaj7 Cm7 Bbsus4 Ebmaj7 Abmaj7 Fm7 Bb7sus4', pad: { v: 0.7 }, drums: null,
        bass: 'R-------5-------', arp: { p: 'up', r: 2, o: 2, v: 0.4 },
        bell: 'G5:4 Bb5:4 D6:8 | C6:4 Eb6:4 G5:8 | Eb5:4 G5:4 Bb5:8 | Eb5:8 F5:8 | Bb5:4 G5:4 D6:8 | C6:4 Ab5:4 Eb5:8 | Ab5:4 C6:4 Eb6:8 | F5:8 Ab5:8',
        chop: 'r:128 | Bb5:16@oo | G5:16@oh | G5:8@oo Bb5:8@oo | F5:16@oh | D6:16@oo | C6:16@oh | Ab5:8@oo C6:8@oo | Bb5:16@oh',
      },
    },
    form: ['A'],
    loop: 0,
  },

  // ============================================================================ RESULTS (celebration)
  results: {
    bpm: 126, delay: 0.5, pump: 0.2,
    inst: {
      kick: { f0: 150, dec: 0.3 },
      bell: { kind: 'glock', vol: 1 },
      bass: { wave: 'square', cut: 600, env: 1400, res: 4, sub: 0.6, d: 0.12, s: 0.4 },
      stab: { wave: 'square', cut: 2000, d: 0.08, s: 0.15 },
      chop: { shift: 1.3, vol: 1.1 },
    },
    mix: { bell: 0.44 },
    sections: {
      intro: { bars: 2, chords: 'G', drums: { cp: '....x...x.x.XXXX', k: 'X.......X.......' }, riser: 2, crash: false },
      A: {
        bars: 8, chords: 'C F G C Am F G G', drums: 'house', fill: 'claps',
        bass: 'R.O.R.O.R.O.5.O.', stab: '..x...x...x...x.',
        bell: [
          'E6:2 G6:2 E6:2 C6:2 D6:2 E6:2 G6:4', 'F6:2 A6:2 F6:2 C6:2 D6:2 F6:2 A6:4', 'G6:2 B6:2 G6:2 D6:2 E6:2 D6:2 B5:4', 'C6:4 G5:4 C6:8',
          'C6:2 E6:2 C6:2 A5:2 B5:2 C6:2 E6:4', 'F6:2 A6:2 F6:2 C6:2 D6:2 E6:2 F6:4', 'G6:4 F6:4 D6:4 B5:4', 'D6:4 G5:4 B5:8',
        ].join(' | '),
        chop: 'r:48 | r:8 G5:4@yeah C6:4@ay | r:48 | r:8 B5:4@hey D6:4@yeah',
      },
    },
    form: ['intro', 'A'],
    loop: 1,
  },

  // ============================================================================ VICTORY (one-shot)
  victory: {
    bpm: 132, oneShot: true, layers: false, fadeIn: 0.02, reverb: 1.2,
    inst: {
      lead: { wave: 'sawtooth', wave2: 'square', detune: 8, cut: 2800, a: 0.015, vib: 14 },
      stab: { wave: 'sawtooth', cut: 2400, d: 0.3, s: 0.5, r: 0.4 },
      chop: { shift: 1.3, vol: 1.2 },
      bass: { wave: 'sawtooth', cut: 500, env: 1200, res: 3, sub: 0.6 },
    },
    mix: { lead: 0.3, stab: 0.26 },
    sections: {
      A: {
        bars: 3, chords: 'C F_G C', crash: true,
        drums: {
          s: 'x.x.xxxxXXXXXXXX' + '................' + '................',
          t: '................' + 'A.a.B.b.C.c.C.C.' + '................',
          k: 'X...............' + 'X.......X.......' + 'X...............',
        },
        bass: 'R...R...R...R...R.......R.......R---------------',
        stab: 'x...x...x...x...x.......x.......X---------------',
        lead: 'G5:1 G5:1 G5:1 r:1 C6:4 G5:2 C6:2 E6:4 | A5:2 C6:2 F6:4 G5:2 B5:2 D6:4 | E6:2 G6:2 C7:12',
        chop: 'r:32 | r:4 C6:12@yeah',
      },
    },
    form: ['A'],
    loop: null,
  },

  // ============================================================================ DEFEAT (one-shot)
  defeat: {
    bpm: 88, oneShot: true, layers: false, fadeIn: 0.02,
    inst: {
      chop: { shift: 1.2, vol: 1.1, fall: 3 },
      bell: { kind: 'ep', vol: 0.8 },
      pad: { cut: 900, a: 0.3, r: 1.2 },
      bass: { wave: 'triangle', cut: 500, env: 300, sub: 0.6, d: 0.6, s: 0.6 },
    },
    sections: {
      A: {
        bars: 2, chords: 'Fm_G Cm', drums: { k: 'X.......X.......X...............' }, pad: { v: 0.6 }, crash: false,
        bass: 'R-------R-------R---------------',
        chop: 'C6:4@oh Ab5:4@oh B5:4@oh G5:4@oh | Eb5:4@wa D5:4@wa C5:8@oo',
        bell: 'F5:4 C5:4 D5:4 B4:4 | G4:16',
      },
    },
    form: ['A'],
    loop: null,
  },

  // ============================================================================ CREDITS (warm finale)
  credits: {
    bpm: 100, swing: 0.1, delay: 0.75, feedback: 0.4,
    inst: {
      kick: { f0: 125, dec: 0.38, click: 0.15 },
      snare: { dec: 0.16, vol: 0.8 },
      bass: { wave: 'triangle', wave2: 'sawtooth', detune: 3, cut: 700, env: 700, res: 2, sub: 0.6, d: 0.35, s: 0.6 },
      bell: { kind: 'ep', vol: 0.9 },
      chop: { shift: 1.2, vol: 1.05, fall: 1.5 },
      lead: { wave: 'triangle', wave2: 'sawtooth', mix2: 0.3, cut: 2200, vib: 14, a: 0.02 },
      pad: { cut: 1300, a: 0.7 },
      stab: { wave: 'triangle', cut: 1800, d: 0.4, s: 0.3, r: 0.25 },
    },
    sections: {
      intro: {
        bars: 4, chords: 'Dmaj7 F#m7 Gmaj7 A7sus4', pad: true, drums: null,
        bell: 'F#5:4 A5:2 C#6:2 E6:4 C#6:4 | C#6:4 A5:2 E5:2 F#5:8 | B5:4 D6:2 F#6:2 E6:4 D6:4 | D6:8 E6:8',
      },
      A: {
        bars: 8, chords: 'Dmaj7 F#m7 Gmaj7 A7sus4 Bm7 F#m7 Gmaj7 A7', drums: 'lofi', pad: { v: 0.5 },
        bass: 'R.....R.5...R.3.', stab: '..x.....x.x.....',
        bell: [
          'F#5:4 A5:2 C#6:2 E6:4 C#6:4', 'C#6:4 A5:2 E5:2 F#5:8', 'B5:4 D6:2 F#6:2 E6:4 D6:4', 'D6:8 E6:8',
          'F#5:4 A5:2 B5:2 D6:4 C#6:4', 'E6:4 C#6:2 A5:2 C#6:8', 'B5:4 A5:2 G5:2 F#5:4 E5:4', 'C#6:4 E6:2 G6:2 A6:8',
        ].join(' | '),
      },
      B: {
        bars: 8, chords: 'D A/C# Bm G', drums: 'rock', fill: 'snare', pad: { v: 0.55 },
        bass: 'R...R.R.R...R.5.', stab: '..x...x...x...x.', chop: TITLE_HOOK_CHOP,
      },
      C: {
        bars: 8, chords: 'Em7 A7 F#m7 Bm7 Em7 A7 D D', drums: 'lofi', fill: 'toms', pad: { v: 0.6 },
        bass: 'R.....R.5...R.3.',
        lead: 'G5:4 B5:4 D6:4 E6:4 | C#6:4 E6:4 G6:4 E6:4 | A5:4 C#6:4 E6:4 C#6:4 | D6:8 B5:8 | G5:4 B5:4 E6:4 G6:4 | G6:4 E6:4 C#6:4 A5:4 | F#5:4 A5:4 D6:8 | D6:16',
      },
    },
    form: ['intro', 'A', 'B', 'C', 'B'],
    loop: 1,
  },
};

// ------------------------------------------------------------------------------------------------
// Turf Clash last minute: the same hooks, faster and denser.
TRACKS['turf-final'] = {
  ...TRACKS.turf,
  bpm: 156, pump: 0.35,
  sections: {
    intro: { bars: 2, chords: 'Gm F', drums: { s: 'x.x.x.x.xxxxXXXX', k: 'X...X...X...X...' }, riser: 2, crash: false, bass: 'R.R.R.R.R.R.R.R.' },
    B: { ...TRACKS.turf.sections.B, drums: ['blast', { h: 'xxxxxxxxxxxxxxxx', p: 't...t...t...t...' }], lead: TURF_HOOK_LEAD, arp: { p: 'up', r: 1, o: 2, v: 0.45 } },
    A: { ...TRACKS.turf.sections.A, drums: ['drive', { cp: '....X.......X...' }], chop: 'r:128 | ' + bars('r:12 G5:2@hey r:2', 8) },
    D: { ...TRACKS.turf.sections.D, drums: ['blast', { cp: '....X.......X...' }], chop: bars('r:16', 7) + ' | r:8 D6:2@hey r:2 D6:2@hey F6:2@oh' },
    brg: { ...TRACKS.turf.sections.brg, bars: 4, chop: 'G5:2@hey r:2 G5:2@hey r:2 Bb5:2@hey r:2 Bb5:2@hey r:2 | C6:2@hey r:2 C6:2@hey r:2 D6:2@hey r:2 D6:2@hey r:2 | G5:2@hey r:2 G5:2@hey r:2 Bb5:2@hey r:2 Bb5:2@hey r:2 | D6:4@oh r:12' },
  },
  form: ['intro', 'B', 'A', 'D', 'B', 'brg'],
  loop: 1,
};

// story/script.js uses 'finale' for the w4-boss stage; keep the common synonyms mapped so a
// stage never silently falls back to the chill menu loop.
export const ALIASES = {
  hub: 'map', plaza: 'menu', arena: 'turf', 'turf-last': 'turf-final', cutscene: 'story',
  finale: 'final-boss', final: 'final-boss', 'boss-final': 'final-boss', ending: 'credits', clear: 'results',
};

/** Resolve an id or alias; unknown ids fall back to 'menu'. */
export function resolveTrack(id) {
  if (id && TRACKS[id]) return id;
  if (id && ALIASES[id]) return ALIASES[id];
  return 'menu';
}
