// Inline SVG icon set for the menus. Every fill/stroke comes from CSS classes (styles/screens.css:
// .i-ink .i-body .i-dark .i-acc .i-acc2 .i-warm .i-bg .i-line …) so colours stay theme tokens.

const svg = (vb, body, cls = '') => `<svg class="ico ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

// ---- procedural shapes -----------------------------------------------------------------------
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Ink splat outline centred on (0,0): a lumpy blob with splash arms plus loose droplets.
 * Returns an SVG path "d" (droplets included as separate sub-paths).
 */
export function splatPath(seed = 1, r = 80, { arms = 7, drops = 6, lump = 0.14 } = {}) {
  const R = rng(seed);
  const n = 30;
  const armAt = new Set();
  while (armAt.size < arms) armAt.add(Math.floor(R() * n));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let rr = r * (1 - lump + R() * lump * 2);
    if (armAt.has(i)) rr = r * (1.25 + R() * 0.35);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  // closed smooth curve through midpoints
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = '';
  const m0 = mid(pts[n - 1], pts[0]);
  d += `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % n]);
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  d += 'Z';
  for (let i = 0; i < drops; i++) {
    const a = R() * Math.PI * 2, dist = r * (1.45 + R() * 0.5), s = r * (0.05 + R() * 0.09);
    const x = Math.cos(a) * dist, y = Math.sin(a) * dist;
    d += `M${(x - s).toFixed(1)} ${y.toFixed(1)}a${s.toFixed(1)} ${s.toFixed(1)} 0 1 0 ${(2 * s).toFixed(1)} 0a${s.toFixed(1)} ${s.toFixed(1)} 0 1 0 ${(-2 * s).toFixed(1)} 0Z`;
  }
  return d;
}

/** A standalone splat <svg>, sized by CSS. */
export function splatSVG(seed = 1, cls = '') {
  return `<svg class="splat ${cls}" viewBox="-160 -160 320 320" aria-hidden="true" focusable="false"><path d="${splatPath(seed, 92)}"/></svg>`;
}

function gearPath(cx, cy, r, teeth = 8) {
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.78 : r;
    const p0 = [cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr], p1 = [cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr];
    d += (i ? 'L' : 'M') + p0.map((v) => v.toFixed(1)).join(' ') + 'L' + p1.map((v) => v.toFixed(1)).join(' ');
  }
  return d + 'Z';
}

function starPath(cx, cy, r, n = 5, inner = 0.45) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * inner : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
  }
  return d + 'Z';
}

// ---- weapon kits (by main class) ------------------------------------------------------------
const PISTOL = '<rect class="i-body" x="20" y="14" width="34" height="12" rx="5"/><rect class="i-dark" x="52" y="17" width="13" height="6" rx="2"/><path class="i-dark" d="M26 24h10l-3 13h-9z"/><circle class="i-ink" cx="34" cy="12" r="5"/>';
const KIT_ART = {
  shooter: '<rect class="i-ink" x="12" y="20" width="12" height="13" rx="4"/><rect class="i-body" x="21" y="17" width="48" height="18" rx="7"/><rect class="i-dark" x="67" y="21" width="20" height="9" rx="3"/><rect class="i-ink" x="85" y="19" width="6" height="13" rx="2"/><path class="i-dark" d="M30 33h15l-4 18H28z"/><circle class="i-ink" cx="40" cy="14" r="8"/><circle class="i-hl" cx="37" cy="11" r="2.5"/>',
  roller: '<rect class="i-dark" x="4" y="30" width="58" height="7" rx="3.5" transform="rotate(-24 33 33)"/><rect class="i-dark" x="6" y="44" width="12" height="8" rx="3" transform="rotate(-24 12 48)"/><rect class="i-body" x="52" y="22" width="10" height="12" rx="3"/><rect class="i-ink" x="58" y="6" width="32" height="44" rx="11"/><rect class="i-hl" x="63" y="10" width="5" height="36" rx="2.5"/>',
  charger: '<rect class="i-body" x="8" y="24" width="60" height="12" rx="5"/><rect class="i-dark" x="66" y="27" width="28" height="6" rx="3"/><rect class="i-dark" x="24" y="11" width="28" height="9" rx="4"/><circle class="i-ink" cx="54" cy="15.5" r="5"/><path class="i-dark" d="M16 34h13l-3 15H14z"/><rect class="i-ink" x="36" y="26" width="16" height="8" rx="3"/>',
  blaster: '<rect class="i-body" x="16" y="16" width="44" height="22" rx="9"/><path class="i-ink" d="M58 21 82 9v36L58 33z"/><path class="i-dark" d="M26 36h15l-4 16H24z"/><circle class="i-ink" cx="30" cy="12" r="8"/><circle class="i-hl" cx="27" cy="9" r="2.5"/>',
  slosher: '<path class="i-body" d="M24 18h42l-7 33H31z"/><rect class="i-ink" x="22" y="13" width="46" height="9" rx="4.5"/><path class="i-line" d="M27 17Q45-6 63 17" fill="none" stroke-width="4"/><path class="i-ink" d="M69 14q11-10 21 1-7 2-9 9-4-7-12-10z"/><circle class="i-ink" cx="86" cy="30" r="3.5"/><circle class="i-ink" cx="78" cy="36" r="2.5"/>',
  splatling: '<rect class="i-body" x="10" y="14" width="38" height="28" rx="11"/><rect class="i-dark" x="46" y="17" width="42" height="6" rx="3"/><rect class="i-dark" x="46" y="25" width="42" height="6" rx="3"/><rect class="i-dark" x="46" y="33" width="42" height="6" rx="3"/><circle class="i-ink" cx="29" cy="28" r="8"/><rect class="i-ink" x="86" y="14" width="7" height="28" rx="3"/><path class="i-dark" d="M18 40h12l-2 12h-11z"/>',
  brush: '<rect class="i-dark" x="2" y="26" width="56" height="8" rx="4" transform="rotate(-16 30 30)"/><rect class="i-body" x="50" y="14" width="15" height="28" rx="3"/><path class="i-ink" d="M64 8q24 4 28 20-4 16-28 20z"/><path class="i-hls" d="M68 14q12 3 15 10" stroke-width="3"/>',
  dualies: `<g transform="translate(-6 -4)">${PISTOL}</g><g transform="translate(22 16)">${PISTOL}</g>`,
};

export function kitIcon(mainClass, cls = '') {
  return svg('0 0 96 56', KIT_ART[mainClass] || KIT_ART.shooter, 'kit-ico ' + cls);
}

// ---- subs & specials -------------------------------------------------------------------------
const SUB_ART = {
  'splash-bomb': '<circle class="i-ink" cx="22" cy="25" r="13"/><rect class="i-body" x="17" y="6" width="10" height="8" rx="2"/><circle class="i-hl" cx="17" cy="21" r="3"/>',
  'burst-bomb': '<circle class="i-ink" cx="22" cy="25" r="11"/><path class="i-body" d="M22 5l4 8h-8z"/><circle class="i-hl" cx="18" cy="21" r="2.5"/>',
  'sprinkler': '<rect class="i-ink" x="11" y="21" width="22" height="15" rx="4"/><path class="i-line" d="M22 21V10M13 13l9-3 9 3" fill="none" stroke-width="3"/><circle class="i-ink" cx="8" cy="10" r="2.5"/><circle class="i-ink" cx="36" cy="10" r="2.5"/>',
  'ink-mine': '<ellipse class="i-ink" cx="22" cy="29" rx="16" ry="7"/><circle class="i-body" cx="22" cy="24" r="5"/><circle class="i-warm" cx="22" cy="24" r="2"/>',
};
const SPECIAL_ART = {
  'tidal-slam': '<path class="i-ink" d="M22 3l9 14h-6v13h-6V17h-6z"/><path class="i-line" d="M5 38q17-11 34 0" fill="none" stroke-width="4"/>',
  'ink-storm': '<ellipse class="i-ink" cx="22" cy="15" rx="16" ry="9"/><path class="i-line" d="M12 28l-2 9M22 28l-2 9M32 28l-2 9" fill="none" stroke-width="3"/>',
  'missile-barrage': '<path class="i-ink" d="M9 36 22 6l13 30-13-6z"/><circle class="i-body" cx="22" cy="20" r="3"/>',
  'ink-jet': '<rect class="i-ink" x="13" y="6" width="18" height="24" rx="7"/><path class="i-line" d="M17 31l-2 9M27 31l2 9" fill="none" stroke-width="4"/><circle class="i-hl" cx="19" cy="12" r="2.5"/>',
};
export const subIcon = (id, cls = '') => svg('0 0 44 44', SUB_ART[id] || SUB_ART['burst-bomb'], cls);
export const specialIcon = (id, cls = '') => svg('0 0 44 44', SPECIAL_ART[id] || SPECIAL_ART['tidal-slam'], cls);

// ---- menu & status icons ---------------------------------------------------------------------
const MENU_ART = {
  story: '<path class="i-fill" d="M24 3C14 3 8 10.5 8 19c0 11 16 26 16 26s16-15 16-26C40 10.5 34 3 24 3z"/><circle class="i-cut" cx="24" cy="19" r="6.5"/>',
  turf: `<path class="i-fill" transform="translate(24 24) scale(0.19)" d="${splatPath(11, 88, { arms: 6, drops: 4 })}"/>`,
  armory: '<rect class="i-fill" x="6" y="14" width="30" height="13" rx="5"/><rect class="i-fill" x="34" y="17" width="10" height="6" rx="2"/><path class="i-fill" d="M12 25h10l-3 15h-9z"/><circle class="i-fill" cx="19" cy="10" r="5"/>',
  options: `<path class="i-fill" d="${gearPath(24, 24, 19, 8)}"/><circle class="i-cut" cx="24" cy="24" r="6.5"/>`,
  credits: `<path class="i-fill" d="${starPath(24, 25, 20, 5, 0.46)}"/>`,
  resume: '<path class="i-fill" d="M14 8l26 16-26 16z"/>',
  restart: '<path class="i-stroke" d="M36 16a14 14 0 1 0 2 12" fill="none" stroke-width="6" stroke-linecap="round"/><path class="i-fill" d="M40 4v16H24z"/>',
  controls: '<path class="i-fill" d="M14 14h20c6 0 9 4 10 10l2 10c1 5-4 8-8 4l-5-5H15l-5 5c-4 4-9 1-8-4l2-10c1-6 4-10 10-10z"/><circle class="i-cut" cx="33" cy="22" r="2.5"/><circle class="i-cut" cx="37" cy="26" r="2.5"/><rect class="i-cut" x="11" y="22" width="9" height="3" rx="1.5"/><rect class="i-cut" x="14" y="19" width="3" height="9" rx="1.5"/>',
  quit: '<path class="i-fill" d="M8 6h20v8h-5V11H13v26h10v-3h5v8H8z"/><path class="i-fill" d="M30 16l10 8-10 8v-5H20v-6h10z"/>',
  map: '<path class="i-fill" d="M4 10l12-4 16 5 12-4v31l-12 4-16-5-12 4z"/><path class="i-cut" d="M16 9v28M32 14v28" stroke-width="2" fill="none"/>',
};
export const menuIcon = (id, cls = '') => svg('0 0 48 48', MENU_ART[id] || MENU_ART.story, 'menu-ico ' + cls);

export const lockIcon = (cls = '') => svg('0 0 44 44', '<path class="i-stroke" d="M14 20v-6a8 8 0 0 1 16 0v6" fill="none" stroke-width="5"/><rect class="i-fill" x="9" y="19" width="26" height="20" rx="5"/><circle class="i-cut" cx="22" cy="28" r="3"/>', 'lock-ico ' + cls);
export const checkIcon = (cls = '') => svg('0 0 44 44', '<path class="i-stroke" d="M9 23l9 9 17-19" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>', 'check-ico ' + cls);
export const clockIcon = (cls = '') => svg('0 0 44 44', '<circle class="i-stroke" cx="22" cy="23" r="15" fill="none" stroke-width="5"/><path class="i-stroke" d="M22 15v9l6 4" fill="none" stroke-width="4" stroke-linecap="round"/>', cls);
export const postcardIcon = (cls = '') => svg('0 0 44 44', '<rect class="i-fill" x="4" y="10" width="36" height="25" rx="4"/><rect class="i-cut" x="28" y="14" width="8" height="9" rx="1.5"/><path class="i-cut" d="M9 18h14M9 24h14M9 29h10" stroke-width="3" fill="none"/>', cls);
export const trophyIcon = (cls = '') => svg('0 0 44 44', '<path class="i-fill" d="M12 6h20v10a10 10 0 0 1-20 0z"/><path class="i-stroke" d="M12 9H6c0 7 3 10 7 10M32 9h6c0 7-3 10-7 10" fill="none" stroke-width="3.5"/><rect class="i-fill" x="19" y="25" width="6" height="7"/><rect class="i-fill" x="12" y="32" width="20" height="6" rx="2"/>', cls);
export const skullIcon = (cls = '') => svg('0 0 44 44', '<path class="i-fill" d="M22 5c-9 0-15 6-15 14 0 5 2 8 5 10v6h20v-6c3-2 5-5 5-10 0-8-6-14-15-14z"/><circle class="i-cut" cx="16" cy="20" r="4"/><circle class="i-cut" cx="28" cy="20" r="4"/><path class="i-cut" d="M17 34v-4M22 34v-4M27 34v-4" stroke-width="2.5" fill="none"/>', cls);
export const pearlIcon = (cls = '') => `<span class="pearl-ico ${cls}" aria-hidden="true"></span>`;

// ---- Shelly, the hermit-crab shopkeeper -------------------------------------------------------
export function shellyArt(cls = '') {
  return `<svg class="shelly ${cls}" viewBox="0 0 200 180" aria-hidden="true" focusable="false">
    <ellipse class="sh-shadow" cx="100" cy="168" rx="78" ry="9"/>
    <g class="sh-legs"><path d="M60 142q-18 10-22 26M78 148q-6 12-6 22M122 148q6 12 6 22M140 142q18 10 22 26" fill="none" stroke-width="9" stroke-linecap="round"/></g>
    <g class="sh-shell">
      <path class="sh-shell-body" d="M52 118c-6-52 32-92 78-88 40 4 62 42 50 82-8 28-38 44-76 40-28-3-50-12-52-34z"/>
      <path class="sh-spiral" d="M126 94c-10 2-16-8-10-16 8-10 26-4 26 12 0 18-22 28-38 18-20-12-16-42 6-52 24-10 50 8 48 36" fill="none" stroke-width="7" stroke-linecap="round"/>
      <path class="sh-band" d="M66 58c26-14 70-14 96 8l-6 10c-24-18-60-18-84-6z"/>
      <circle class="sh-band-dot" cx="150" cy="58" r="8"/>
    </g>
    <g class="sh-body">
      <ellipse cx="86" cy="130" rx="44" ry="28"/>
      <path class="sh-stalk" d="M74 110q-4-24-10-36M98 108q4-24 12-36" fill="none" stroke-width="8" stroke-linecap="round"/>
    </g>
    <g class="sh-eyes">
      <circle class="sh-eye" cx="62" cy="70" r="15"/><circle class="sh-pupil" cx="65" cy="72" r="7"/><circle class="sh-glint" cx="68" cy="68" r="2.8"/>
      <circle class="sh-eye" cx="112" cy="70" r="15"/><circle class="sh-pupil" cx="115" cy="72" r="7"/><circle class="sh-glint" cx="118" cy="68" r="2.8"/>
    </g>
    <path class="sh-mouth" d="M72 134q14 12 30 0" fill="none" stroke-width="5" stroke-linecap="round"/>
    <ellipse class="sh-cheek" cx="64" cy="128" rx="8" ry="5"/><ellipse class="sh-cheek" cx="112" cy="128" rx="8" ry="5"/>
    <g class="sh-claw sh-claw-l"><path d="M42 124c-22-4-34 10-30 24 10 2 18-4 22-10-2 10 6 16 16 12 6-8 2-22-8-26z"/></g>
    <g class="sh-claw sh-claw-r"><path d="M130 136c14-6 26 2 26 12-8 4-16 0-18-6 0 8-8 12-14 8-2-6 0-12 6-14z"/></g>
  </svg>`;
}
