// Song compiler: turns the compact song notation in tracks.js into per-step event lists the
// MusicPlayer schedules. Pure JS (no WebAudio) so it can be linted/tested in Node.
//
// A song:
//   { bpm, swing (0..0.35, 16th swing), shuffle (0..0.35, 8th swing), loop (form index | null),
//     inst: { bass:{…}, lead:{…}, … } synth params, mix: { channel: gain }, sends: { channel: [rev, dly] },
//     delay: beats, layers: true|false (auto intensity layers), sections: { name: {…} }, form: [names] }
// A section:
//   bars, bpm?, chords: 'C G Am F' (one token per bar, 'C_G' splits a bar, '%' repeats, cycles),
//   drums: preset | {k,s,cp,h,oh,t,p} | [preset, overrides] | null,  fill: preset | false,
//   crash: bool, riser: bars, impact: bool,
//   bass: 16-char pattern per bar (R 3 5 7 O 2 4 6 L b ^ v r x - .),  bassLine: melody string,
//   pad: true | {v}, stab: rhythm ('x X o - .'), arp: {p,r,o,g,v} | index string,
//   lead / chop / bell / counter / pluck: melody strings ('E5:2 G5:4> r:2 | …'),
//   hi: { …same channel keys… } content that only plays at intensity ≥ 0.4, mute: [channels]
import { noteToMidi, parseChord, voiceChord, bassRoot, bassInterval, pcAtOrAbove } from './theory.js';

export const STEPS_PER_BAR = 16;

// ---------------------------------------------------------------------------------------------
// Drum grooves (16 steps). X accent, x normal, o ghost. Toms: a high, b mid, c low (upper = accent).
// Perc: s shaker, t tambourine, c cowbell, h/l conga hi/lo, r rim, k block (upper = accent).
export const GROOVES = {
  rock:   { k: 'X.......x.x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  rock2:  { k: 'X.....x.x.x.....', s: '....X.......X..o', h: 'x.x.x.x.x.x.x.x.' },
  punk:   { k: 'X...x...X...x...', s: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' },
  drive:  { k: 'X.x...x.X.x...x.', s: '....X.......X...', h: 'xxxxxxxxxxxxxxxx' },
  four:   { k: 'X...x...X...x...', cp: '....X.......X...', oh: '..x...x...x...x.' },
  house:  { k: 'X...x...X...x...', cp: '....X.......X...', h: 'o...o...o...o..o', oh: '..x...x...x...x.' },
  funk:   { k: 'X.....x..x......', s: '....X..o.o..X..o', h: 'xoxoxoxoxoxoxoxo' },
  funk2:  { k: 'X..x..x...x.....', s: '....X..o....X.o.', h: 'xoxoxoxoxoxoxoxo', oh: '..............x.' },
  half:   { k: 'X.........x.....', s: '........X.......', h: 'x.x.x.x.x.x.x.x.' },
  ska:    { k: 'X.......X.......', s: '....X.......X...', h: '..x...x...x...x.', p: 'r.......r.......' },
  dnb:    { k: 'X.........x.....', s: '....X.......X...', h: 'x.xxx.xxx.xxx.xx' },
  break:  { k: 'X.........x..x..', s: '....X..o.o..X...', h: 'x.x.x.x.x.x.x.x.' },
  bounce: { k: 'X...x...X...x...', s: '....X.......X...', h: 'x.xxx.xxx.xxx.xx' },
  lofi:   { k: 'X......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  trap:   { k: 'X.....x...x.....', cp: '........X.......', h: 'x.x.x.x.x.xxx.x.' },
  blast:  { k: 'X.x.x.x.X.x.x.x.', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  march:  { k: 'X.......X.......', s: '....X..o....X.oo', h: 'x...x...x...x...' },
  pulse:  { k: 'X...............', h: '....x.......x...' },
  none:   {},
};

export const FILLS = {
  snare: { s: '........x.x.xxXX', k: 'X.......x.......' },
  roll:  { s: 'o.o.x.x.xxxxXXXX', k: 'X...X...X...X...' },
  toms:  { t: '........AAbbBcCc', s: '....X...........', k: 'X.......x.......' },
  toms2: { t: 'A.a.B.b.C.c.CcCc', k: 'X...............', s: '' },
  stop:  { k: 'X.x.............', s: '....X...........', h: 'x.x.x...........', cp: '' },
  claps: { cp: '....X...x.x.XXXX', k: 'X.......X.......' },
  kicks: { k: 'X...X...X.X.XXXX', s: '............X.X.' },
};

// ---------------------------------------------------------------------------------------------
function clean(s) { return (s || '').replace(/[\s|]/g, ''); }

/** Deterministic PRNG so humanisation and random arps are identical every loop. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/**
 * Melody string → [{at, n|null, d, acc, slide, stac, syl}] in 16th steps.
 * Tokens: 'C5:4', 'Bb4', 'r:2', flags after the duration: '>' slide in, '!' accent, '.' staccato,
 * '@ya' vocal-chop syllable. Duration defaults to the previous token's. '|' bar lines are checked.
 */
export function parseMelody(str, warn = () => {}, label = '') {
  const out = [];
  let at = 0, dur = 2;
  for (const tok of String(str).trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') { if (at % 16) warn(`${label}: bar line at step ${at} (not a bar boundary)`); continue; }
    const m = /^(r|[A-G][#b]?-?\d)(?::(\d+))?([>!.]*)(?:@([a-z]+))?$/.exec(tok);
    if (!m) { warn(`${label}: bad token "${tok}"`); continue; }
    if (m[2]) dur = Number(m[2]);
    const n = m[1] === 'r' ? null : noteToMidi(m[1]);
    const f = m[3] || '';
    out.push({ at, n, d: dur, acc: f.includes('!'), slide: f.includes('>'), stac: f.includes('.'), syl: m[4] || null });
    at += dur;
  }
  out.total = at;
  return out;
}

function chordTimeline(spec, bars) {
  const toks = String(spec || 'C').trim().split(/\s+/);
  const perBar = [];
  let prev = toks[0];
  for (let b = 0; b < bars; b++) {
    let tok = toks[b % toks.length];
    if (tok === '%') tok = prev;
    prev = tok;
    perBar.push(tok.split('_').map(parseChord));
  }
  const at = new Array(bars * STEPS_PER_BAR);
  for (let b = 0; b < bars; b++) {
    const parts = perBar[b];
    const len = STEPS_PER_BAR / parts.length;
    for (let i = 0; i < STEPS_PER_BAR; i++) at[b * STEPS_PER_BAR + i] = parts[Math.min(parts.length - 1, Math.floor(i / len))];
  }
  return at;
}

function resolveDrums(d) {
  if (!d) return {};
  if (typeof d === 'string') return { ...(GROOVES[d] || GROOVES.rock) };
  if (Array.isArray(d)) return { ...(GROOVES[d[0]] || {}), ...d[1] };
  return { ...d };
}

const velOf = (ch) => (ch === 'X' ? 1 : ch === 'x' ? 0.78 : ch === 'o' ? 0.4 : ch >= 'A' && ch <= 'Z' ? 1 : 0.72);

/**
 * Compile one section.
 * @returns {{name, bars, bpm, steps: Array<Array<object>|undefined>, warnings: string[]}}
 */
export function compileSection(song, name, sec, warn) {
  const bars = sec.bars || 4;
  const N = bars * STEPS_PER_BAR;
  const steps = new Array(N);
  const push = (i, ev) => { if (i < 0 || i >= N) return; (steps[i] ||= []).push(ev); };
  const R = rng(hash(song.id + ':' + name));
  const hv = (v, amt = 0.08) => Math.max(0.05, Math.min(1, v * (1 - amt / 2 + R() * amt)));
  const chords = chordTimeline(sec.chords || song.chords, bars);
  const mute = new Set(sec.mute || []);
  const inst = song.inst || {};

  // ---- drums ----
  const dr = resolveDrums(sec.drums === undefined ? song.drums : sec.drums);
  const fill = sec.fill ? FILLS[sec.fill] || FILLS.snare : null;
  const lanes = { k: 'kick', s: 'snare', cp: 'clap', h: 'hat', oh: 'ohat', t: 'tom', p: 'perc' };
  for (const [lane, ch] of Object.entries(lanes)) {
    if (mute.has(ch)) continue;
    const pat = clean(dr[lane]);
    for (let b = 0; b < bars; b++) {
      let p = pat, off = pat.length ? (b * 16) % pat.length : 0;
      if (fill && b === bars - 1 && fill[lane] !== undefined) { p = clean(fill[lane]); off = 0; }
      if (!p) continue;
      for (let i = 0; i < 16; i++) {
        const c = p[off + i];
        if (!c || c === '.' || c === '-') continue;
        const at = b * 16 + i;
        if (ch === 'tom') push(at, { c: 'tom', v: hv(c === c.toUpperCase() ? 1 : 0.7), k: c.toLowerCase() });
        else if (ch === 'perc') push(at, { c: 'perc', v: hv(c === c.toUpperCase() ? 1 : 0.7), k: c.toLowerCase() });
        else push(at, { c: ch, v: hv(velOf(c)) });
      }
    }
  }
  if (sec.crash ?? (name !== 'intro' && Object.keys(dr).length > 0)) push(0, { c: 'crash', v: 0.9 });
  if (sec.impact) push(0, { c: 'impact', v: 1 });
  if (sec.riser) { const rb = sec.riser === true ? 1 : sec.riser; push(N - rb * 16, { c: 'riser', d: rb * 16, v: 1 }); }

  // ---- harmony: pad / stab / arp (voice-led) ----
  const changes = [];
  for (let i = 0; i < N; i++) if (i === 0 || chords[i].sym !== chords[i - 1].sym) changes.push(i);
  let prevV = null;
  const voicing = new Map();
  const padCenter = inst.pad?.center ?? 62;
  for (const i of changes) { prevV = voiceChord(chords[i], prevV, { center: padCenter, max: inst.pad?.voices ?? 4 }); voicing.set(i, prevV); }
  const voiceAt = (i) => { let k = i; while (!voicing.has(k)) k--; return voicing.get(k); };

  if (sec.pad && !mute.has('pad')) {
    const pv = typeof sec.pad === 'object' ? sec.pad.v ?? 0.8 : 0.8;
    changes.forEach((i, k) => {
      const end = changes[k + 1] ?? N;
      push(i, { c: 'pad', ns: voicing.get(i), d: end - i, v: pv });
    });
  }
  if (sec.stab && !mute.has('stab')) {
    const pat = clean(sec.stab);
    const so = (inst.stab?.oct ?? 0) * 12;
    for (let i = 0; i < N; i++) {
      const c = pat[i % pat.length];
      if (!c || c === '.' || c === '-') continue;
      let d = 1; while (pat[(i + d) % pat.length] === '-' && i + d < N) d++;
      push(i, { c: 'stab', ns: voiceAt(i).map((n) => n + so), d, v: hv(velOf(c)) });
    }
  }
  if (sec.arp && !mute.has('arp')) compileArp(sec.arp, 'arp', 0, N, chords, voiceAt, push, R, hv, inst.arp);

  // ---- bass ----
  const bLo = inst.bass?.lo ?? 33;
  if (sec.bass && !mute.has('bass')) {
    const pat = clean(sec.bass);
    let cur = null;
    for (let i = 0; i < N; i++) {
      const c = pat[i % pat.length];
      if (c === '-' && cur) { cur.d++; continue; }
      cur = null;
      if (!c || c === '.') continue;
      const ch = chords[i];
      let n;
      if (c === '^' || c === 'v') {
        let j = i + 1; while (j < N && chords[j].sym === ch.sym) j++;
        const nxt = chords[Math.min(N - 1, j)] || ch;
        n = bassRoot(nxt, bLo) + (c === '^' ? -1 : 1);
      } else if (c === 'R' || c === 'r' || c === 'x') n = bassRoot(ch, bLo);
      else if (c === 'O' || c === '8') n = bassRoot(ch, bLo) + 12;
      else {
        const iv = bassInterval(ch, c);
        if (iv == null) { warn(`${song.id}/${name}: bad bass char "${c}"`); continue; }
        n = pcAtOrAbove(ch.root, bLo) + iv;
      }
      cur = { c: 'bass', n, d: 1, v: hv(c === 'r' ? 0.55 : c === 'x' ? 0.35 : 0.85), dead: c === 'x' };
      push(i, cur);
    }
  }

  // ---- melodic lines ----
  const melodic = ['bassLine', 'lead', 'chop', 'bell', 'counter', 'pluck'];
  const SYL = song.syllables || ['ya', 'oh', 'ee', 'wa', 'la', 'yo', 'ay', 'oo'];
  let sylK = 0;
  const addLine = (key, str, layer) => {
    const chName = key === 'bassLine' ? 'bass' : key;
    if (mute.has(chName)) return;
    const notes = parseMelody(str, warn, `${song.id}/${name}/${key}`);
    if (!notes.total) return;
    if (notes.total > N) warn(`${song.id}/${name}/${key}: ${notes.total} steps > section ${N}`);
    else if (N % notes.total) warn(`${song.id}/${name}/${key}: ${notes.total} steps does not divide section ${N}`);
    let prev = null;
    for (let base = 0; base < N; base += notes.total) {
      for (const m of notes) {
        const at = base + m.at;
        if (at >= N) break;
        if (m.n == null) { prev = null; continue; }
        const d = Math.min(m.d, N - at);
        const syl = m.syl || (chName === 'chop' ? SYL[(sylK++) % SYL.length] : null);
        const ev = { c: chName, n: m.n, d, v: hv(m.acc ? 1 : 0.8), gate: m.stac ? 0.45 : 0.92, slide: m.slide && prev != null ? prev : null, syl };
        if (layer) ev.L = layer;
        push(at, ev);
        prev = m.n;
      }
    }
  };
  for (const key of melodic) if (sec[key]) addLine(key, sec[key], 0);

  // ---- explicit intensity content ----
  if (sec.hi) {
    const h = sec.hi;
    for (const key of melodic) if (h[key]) addLine(key, h[key], 1);
    if (h.drums) {
      const hd = resolveDrums(h.drums);
      for (const [lane, ch] of Object.entries(lanes)) {
        const pat = clean(hd[lane]);
        if (!pat) continue;
        for (let i = 0; i < N; i++) {
          const c = pat[i % pat.length];
          if (!c || c === '.' || c === '-') continue;
          const ev = ch === 'tom' || ch === 'perc' ? { c: ch, v: hv(c === c.toUpperCase() ? 1 : 0.7), k: c.toLowerCase() } : { c: ch, v: hv(velOf(c)) };
          ev.L = 1;
          push(i, ev);
        }
      }
    }
    if (h.arp) compileArp(h.arp, 'arp', 1, N, chords, voiceAt, push, R, hv, inst.arp);
  }

  // ---- automatic intensity layers (turf last minute etc.) ----
  if (song.layers !== false && Object.keys(dr).length) {
    for (let i = 0; i < N; i++) {
      // L1: 16th shaker drive + lead doubled an octave up
      push(i, { c: 'shaker', v: hv(i % 4 === 0 ? 0.75 : i % 2 === 0 ? 0.5 : 0.32), L: 1 });
      if (i % 16 === 4 || i % 16 === 12) push(i, { c: 'perc', k: 't', v: hv(0.8), L: 1 });
      // L2: driving 16th hats
      push(i, { c: 'hat', v: hv(i % 2 === 0 ? 0.5 : 0.3), L: 2 });
      // L2: snare roll into every 4-bar phrase, crash on phrase starts
      if (i % 64 === 0 && i > 0) push(i, { c: 'crash', v: 0.75, L: 2 });
      if (i % 64 >= 60) push(i, { c: 'snare', v: 0.45 + (i % 64 - 60) * 0.12, L: 2 });
    }
    const src = sec.lead ? 'lead' : sec.chop ? 'chop' : null;
    if (src) for (const evs of steps) if (evs) for (const e of evs.slice()) if (e.c === src && !e.L) evs.push({ ...e, c: 'lead2', t: 'lead', n: e.n + 12, v: e.v * 0.55, slide: e.slide != null ? e.slide + 12 : null, L: 1 });
    if (!sec.arp) compileArp({ p: 'updown', r: 1, o: 2, g: 0.5, v: 0.5, oct: 12 }, 'arp2', 2, N, chords, voiceAt, push, R, hv, inst.arp);
  }

  return { name, bars, bpm: sec.bpm || song.bpm, steps };
}

function compileArp(spec, ch, layer, N, chords, voiceAt, push, R, hv, instArp) {
  const s = typeof spec === 'string' ? { seq: spec } : spec;
  const rate = s.r ?? 1, oct = s.o ?? 2, gate = s.g ?? 0.6, vel = s.v ?? 0.7;
  const shift = (s.oct ?? instArp?.oct ?? 0);
  let k = 0;
  for (let i = 0; i < N; i += rate) {
    const base = voiceAt(i).map((n) => n + shift);
    const tones = [];
    for (let o = 0; o < oct; o++) for (const n of base) tones.push(n + 12 * o);
    let idx;
    if (s.seq) {
      const c = s.seq[(i / rate) % s.seq.length];
      if (c === '.' || c === undefined) { k++; continue; }
      idx = parseInt(c, 36);
    } else if (s.p === 'down') idx = tones.length - 1 - (k % tones.length);
    else if (s.p === 'updown') { const L = Math.max(1, tones.length * 2 - 2); const q = k % L; idx = q < tones.length ? q : L - q; }
    else if (s.p === 'random') idx = Math.floor(R() * tones.length);
    else idx = k % tones.length;
    const n = tones[Math.min(tones.length - 1, idx)];
    const ev = { c: ch, n, d: rate * gate, v: hv(vel * (i % 4 === 0 ? 1 : 0.78)) };
    if (layer) ev.L = layer;
    push(i, ev);
    k++;
    void chords;
  }
}

/** Compile a whole song. Result is cached on the def. */
export function compileSong(id, def, warn = (m) => console.warn(m)) {
  if (def._compiled) return def._compiled;
  const song = { ...def, id };
  const secs = {};
  for (const [name, sec] of Object.entries(def.sections)) secs[name] = compileSection(song, name, sec, warn);
  const form = def.form.map((n) => { if (!secs[n]) throw new Error(`${id}: unknown section ${n}`); return secs[n]; });
  const out = { id, def, sections: secs, form, loop: def.loop === undefined ? 0 : def.loop, bpm: def.bpm };
  def._compiled = out;
  return out;
}

/** Length in seconds of one pass through the form (intro included). */
export function songLength(c) {
  let t = 0;
  for (const s of c.form) t += s.bars * 4 * 60 / s.bpm;
  return t;
}
