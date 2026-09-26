// Procedural illustrated map of Tidehaven (1600×1000 SVG). Colours come from CSS classes (.m-*)
// so the whole map follows the theme tokens. Regions are grouped per world so the story map can
// dim the worlds that are not selected.

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const MAP_W = 1600;
export const MAP_H = 1000;

/** Stage node positions on the map. */
export const NODE_POS = {
  'w1-1': [190, 660], 'w1-2': [340, 700], 'w1-3': [470, 600], 'w1-boss': [590, 735],
  'w2-1': [640, 520], 'w2-2': [480, 390], 'w2-3': [320, 270], 'w2-boss': [560, 170],
  'w3-1': [840, 650], 'w3-2': [1010, 720], 'w3-3': [1180, 790], 'w3-boss': [1190, 590],
  'w4-1': [1060, 420], 'w4-2': [1250, 330], 'w4-boss': [1420, 170],
};

/** Where the camera centres for each world, and how far it zooms. */
export const WORLD_VIEW = {
  1: { cx: 400, cy: 660, zoom: 1.5 },
  2: { cx: 480, cy: 350, zoom: 1.45 },
  3: { cx: 1010, cy: 690, zoom: 1.45 },
  4: { cx: 1240, cy: 300, zoom: 1.45 },
};

const COAST = 'M0 0H1600V1000H1270C1230 940 1170 905 1100 890C1020 872 990 800 905 780C830 762 770 800 700 782C620 762 580 700 540 655C492 602 420 612 350 585C268 555 180 590 100 548C60 528 26 500 0 500Z';

export function mapSVG() {
  const R = rng(1906);
  const f = (n) => n.toFixed(0);
  let s = '';

  // ---- sea, waves, land ----
  s += `<rect class="m-sea" width="1600" height="1000"/>`;
  let waves = '';
  for (let i = 0; i < 70; i++) {
    const x = R() * 1500, y = 480 + R() * 520;
    if (y < 520 + x * 0.1 && x > 200) continue;
    waves += `M${f(x)} ${f(y)}q14 -9 28 0t28 0`;
  }
  s += `<path class="m-wave" d="${waves}"/>`;
  s += `<path class="m-beach" d="${COAST}"/><path class="m-land" d="${COAST}"/>`;

  // ---- roads ----
  s += `<path class="m-road" d="M120 470C260 430 380 470 470 420S640 300 720 330 900 470 1000 450 1180 380 1300 330M600 560C700 600 800 560 880 600S1050 660 1120 700M700 240C820 260 900 210 1010 250S1180 300 1250 270"/>`;
  s += `<path class="m-road-dash" d="M120 470C260 430 380 470 470 420S640 300 720 330 900 470 1000 450 1180 380 1300 330"/>`;

  // ---- world 1: Brinewater Docks ----
  let w1 = '';
  const piers = [[150, 555, 70, 185], [300, 590, 80, 170], [430, 620, 60, 120], [540, 660, 130, 120]];
  for (const [x, y, w, h] of piers) w1 += `<rect class="m-wood" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><path class="m-plank" d="M${x + 6} ${y + 12}H${x + w - 6}M${x + 6} ${y + h - 14}H${x + w - 6}"/>`;
  const boxCls = ['m-c1', 'm-c2', 'm-c3', 'm-c4'];
  for (let i = 0; i < 26; i++) {
    const p = piers[i % piers.length];
    const x = p[0] + 8 + R() * (p[2] - 34), y = p[1] + 24 + R() * (p[3] - 60);
    w1 += `<rect class="${boxCls[i % 4]}" x="${f(x)}" y="${f(y)}" width="22" height="12" rx="2"/>`;
  }
  // cranes
  for (const [x, y, a] of [[250, 520, -30], [420, 540, 20], [600, 620, -12]]) {
    w1 += `<g transform="translate(${x} ${y}) rotate(${a})"><rect class="m-crane" x="-6" y="-60" width="12" height="70" rx="3"/><rect class="m-crane" x="-6" y="-66" width="96" height="10" rx="3"/><path class="m-cable" d="M76 -56V-18"/><rect class="m-c2" x="68" y="-18" width="16" height="10" rx="2"/></g>`;
  }
  w1 += `<text class="m-label" x="160" y="838">BRINEWATER DOCKS</text>`;

  // ---- world 2: Coral Heights ----
  let w2 = '';
  for (const [x, y, rx, ry] of [[470, 330, 260, 170], [300, 230, 170, 110], [620, 170, 200, 120]]) w2 += `<ellipse class="m-hill" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;
  for (let i = 0; i < 38; i++) {
    const x = 230 + R() * 520, y = 110 + R() * 380;
    if (Math.hypot(x - 480, y - 390) < 50 || Math.hypot(x - 320, y - 270) < 46) continue;
    const w = 22 + R() * 26, h = 18 + R() * 20;
    w2 += `<rect class="m-bldg" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="4"/><rect class="m-roof" x="${f(x + 3)}" y="${f(y + 3)}" width="${f(w - 6)}" height="${f(h * 0.35)}" rx="2"/>`;
    if (R() < 0.25) w2 += `<rect class="m-neon" x="${f(x + w * 0.3)}" y="${f(y + h * 0.6)}" width="${f(w * 0.4)}" height="4" rx="2"/>`;
  }
  w2 += `<ellipse class="m-bowl" cx="480" cy="440" rx="44" ry="26"/><ellipse class="m-bowl-in" cx="480" cy="440" rx="26" ry="14"/>`;
  for (let i = 0; i < 22; i++) w2 += `<circle class="m-tree" cx="${f(250 + R() * 520)}" cy="${f(120 + R() * 360)}" r="${f(7 + R() * 7)}"/>`;
  // right of the world banner (top-left of the map box), which otherwise covers it in the World 2 view
  w2 += `<text class="m-label" x="560" y="74">CORAL HEIGHTS</text>`;

  // ---- world 3: Murk Refinery ----
  let w3 = '';
  w3 += `<path class="m-murkland" d="M800 560C900 520 1060 520 1200 540S1330 640 1300 760 1180 900 1060 860 900 820 830 760 740 610 800 560Z"/>`;
  for (let i = 0; i < 7; i++) {
    const x = 860 + R() * 380, y = 560 + R() * 250;
    w3 += `<path class="m-murkpool" d="M${f(x)} ${f(y)}c18 -12 44 -8 50 6s-8 28 -30 26 -38 -20 -20 -32z"/>`;
  }
  for (const [x, y, r] of [[930, 610, 34], [1100, 640, 42], [1260, 700, 30], [960, 790, 28], [1130, 820, 24]]) {
    w3 += `<circle class="m-tank" cx="${x}" cy="${y}" r="${r}"/><circle class="m-tank-top" cx="${x}" cy="${y}" r="${r * 0.62}"/>`;
  }
  w3 += `<path class="m-pipe" d="M880 700H990C1010 700 1020 690 1020 670V600M1060 760H1200C1230 760 1240 740 1240 720V620M900 560V520M1140 560C1160 540 1190 540 1210 560"/>`;
  for (const [x, y] of [[1300, 600], [1320, 820], [860, 850]]) w3 += `<rect class="m-chimney" x="${x - 11}" y="${y - 50}" width="22" height="60" rx="4"/><circle class="m-smoke" cx="${x + 6}" cy="${y - 64}" r="16"/><circle class="m-smoke" cx="${x + 24}" cy="${y - 82}" r="12"/>`;
  w3 += `<text class="m-label" x="960" y="960">MURK REFINERY</text>`;

  // ---- world 4: Murkwell Tower ----
  let w4 = '';
  w4 += `<path class="m-rock" d="M980 450C1040 360 1120 360 1180 330S1300 200 1400 110 1580 60 1600 60V470C1500 470 1420 430 1330 440S1100 520 980 450Z"/>`;
  for (let i = 0; i < 16; i++) w4 += `<path class="m-crag" d="M${f(1020 + R() * 540)} ${f(150 + R() * 300)}l14 -22 14 22z"/>`;
  w4 += `<g class="m-tower"><path class="m-spire-shadow" d="M1420 240l120 30-110 18z"/><path class="m-spire" d="M1392 250L1420 40 1448 250Z"/><path class="m-spire-hl" d="M1420 40 1432 250H1448Z"/><rect class="m-spire-base" x="1380" y="240" width="80" height="26" rx="6"/><circle class="m-spire-eye" cx="1420" cy="110" r="9"/></g>`;
  for (const [x, y, rx] of [[1320, 90, 90], [1480, 60, 110], [1230, 150, 70], [1560, 150, 60]]) w4 += `<ellipse class="m-cloud" cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.4}"/>`;
  w4 += `<path class="m-bolt" d="M1300 110l-18 40h16l-14 36 34-48h-16l14-28z"/><path class="m-bolt" d="M1510 90l-12 28h12l-10 26 26-36h-12l10-18z"/>`;
  w4 += `<text class="m-label" x="1170" y="462">MURKWELL TOWER</text>`;

  // ---- lighthouse islet (the Prism Wellspring) ----
  let lh = `<ellipse class="m-beach" cx="770" cy="900" rx="70" ry="34"/><ellipse class="m-land" cx="770" cy="896" rx="58" ry="26"/>`;
  lh += `<path class="m-beam" d="M770 870L560 800 580 760Z"/><path class="m-beam" d="M770 870L980 960 990 920Z"/>`;
  lh += `<rect class="m-lh" x="760" y="836" width="20" height="50" rx="4"/><rect class="m-lh-band" x="760" y="852" width="20" height="10"/><circle class="m-lh-lamp" cx="770" cy="834" r="10"/>`;

  // ---- compass + cartouche ----
  const compass = `<g transform="translate(70 925)"><circle class="m-compass" r="46"/><path class="m-compass-n" d="M0 -40L10 0H-10Z"/><path class="m-compass-s" d="M0 40L10 0H-10Z"/><text class="m-compass-t" y="-50">N</text></g>`;
  const cart = `<g transform="translate(150 985)"><text class="m-title" x="0" y="0">TIDEHAVEN</text></g>`;

  return `<svg class="map-svg" viewBox="0 0 1600 1000" width="1600" height="1000" aria-hidden="true" focusable="false">
    ${s}
    <g class="region" data-world="2">${w2}</g>
    <g class="region" data-world="4">${w4}</g>
    <g class="region" data-world="3">${w3}</g>
    <g class="region" data-world="1">${w1}</g>
    ${lh}${compass}${cart}
    <g class="m-routes"></g>
  </svg>`;
}

/** Route polyline between consecutive stages (cleared legs drawn solid). */
export function routeSVG(order, isCleared) {
  let out = '';
  for (let i = 0; i < order.length - 1; i++) {
    const a = NODE_POS[order[i]], b = NODE_POS[order[i + 1]];
    if (!a || !b) continue;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 30;
    out += `<path class="m-route${isCleared(order[i]) ? ' done' : ''}" d="M${a[0]} ${a[1]}Q${mx} ${my} ${b[0]} ${b[1]}"/>`;
  }
  return out;
}
