// Procedural motion-comic panels (SVG, 1600×900, sliced to fill the screen). Each art id returns
// layered SVG; comic.js moves the layers at different depths (parallax) under a Ken Burns zoom.
//
//   panelArt(id, { ink }) → { svg, kb: { x, y, zoom } }   (kb = Ken Burns direction)
import { portraitSVG, splatPath, shade } from './portraits.js';

const W = 1600, H = 900;
let UID = 0;

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const f = (n) => Math.round(n * 10) / 10;

function lin(id, stops, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
}
function rad(id, stops, cx = '50%', cy = '50%', r = '50%') {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
}

function skyline(r, { y, h, color, win = null, winP = 0.3, x0 = -120, x1 = W + 120, minW = 44, maxW = 120, roof = true }) {
  let s = '', x = x0;
  while (x < x1) {
    const w = minW + r() * (maxW - minW), bh = h * (0.35 + r() * 0.65);
    s += `<rect x="${f(x)}" y="${f(y - bh)}" width="${f(w)}" height="${f(bh + 600)}" fill="${color}"/>`;
    if (roof && r() < 0.3) s += `<rect x="${f(x + w * 0.3)}" y="${f(y - bh - 26)}" width="4" height="26" fill="${color}"/>`;
    if (roof && r() < 0.18) s += `<rect x="${f(x + w * 0.55)}" y="${f(y - bh - 22)}" width="${f(w * 0.28)}" height="22" rx="6" fill="${color}"/>`;
    if (win) {
      for (let wy = y - bh + 14; wy < y - 10; wy += 22) for (let wx = x + 8; wx < x + w - 12; wx += 18) {
        if (r() < winP) s += `<rect x="${f(wx)}" y="${f(wy)}" width="8" height="11" fill="${Array.isArray(win) ? win[Math.floor(r() * win.length)] : win}"/>`;
      }
    }
    x += w + r() * 10;
  }
  return s;
}

function lighthouse(x, y, s = 1, o = {}) {
  const k = (v) => f(v * s);
  const beam = o.beam !== false;
  return `<g transform="translate(${x} ${y})">
    ${beam ? `<path d="M0 ${k(-330)} L${k(-900)} ${k(-470)} L${k(-900)} ${k(-190)}Z" fill="${o.beamColor || '#fff6a8'}" opacity=".28"/><path d="M0 ${k(-330)} L${k(700)} ${k(-420)} L${k(700)} ${k(-250)}Z" fill="${o.beamColor || '#fff6a8'}" opacity=".16"/>` : ''}
    <path d="M${k(-70)} 0 L${k(-44)} ${k(-300)} L${k(44)} ${k(-300)} L${k(70)} 0Z" fill="${o.body || '#f7f3ea'}"/>
    ${[0, 1, 2].map((i) => `<path d="M${k(-66 + i * 8)} ${k(-40 - i * 88)} L${k(66 - i * 8)} ${k(-40 - i * 88)} L${k(62 - i * 8)} ${k(-80 - i * 88)} L${k(-62 + i * 8)} ${k(-80 - i * 88)}Z" fill="${o.band || '#e8432f'}"/>`).join('')}
    <rect x="${k(-60)}" y="${k(-312)}" width="${k(120)}" height="${k(14)}" fill="${o.dark || '#2b2350'}"/>
    <rect x="${k(-36)}" y="${k(-366)}" width="${k(72)}" height="${k(56)}" fill="${o.dark || '#2b2350'}"/>
    <rect x="${k(-26)}" y="${k(-358)}" width="${k(52)}" height="${k(40)}" fill="${o.lamp || '#fff6a8'}"/>
    <path d="M${k(-44)} ${k(-366)} Q0 ${k(-420)} ${k(44)} ${k(-366)}Z" fill="${o.dark || '#2b2350'}"/>
    <rect x="${k(-3)}" y="${k(-436)}" width="${k(6)}" height="${k(28)}" fill="${o.dark || '#2b2350'}"/>
  </g>`;
}

function core(x, y, r, color, id, o = {}) {
  const hex = [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return `${f(x + Math.cos(a) * r * 0.78)},${f(y + Math.sin(a) * r)}`; }).join(' ');
  return `<g>${rad(id, [[0, color, 0.85], [0.4, color, 0.35], [1, color, 0]])}
    <circle cx="${x}" cy="${y}" r="${f(r * (o.glow || 2.6))}" fill="url(#${id})"/>
    <polygon points="${hex}" fill="${shade(color, 0.25)}" stroke="#fff" stroke-width="${f(r * 0.08)}" stroke-linejoin="round"/>
    <polygon points="${f(x)},${f(y - r)} ${f(x + r * 0.78)},${f(y - r * 0.5)} ${f(x)},${f(y)} ${f(x - r * 0.78)},${f(y - r * 0.5)}" fill="#fff" opacity=".45"/>
    <polygon points="${f(x)},${f(y)} ${f(x + r * 0.78)},${f(y + r * 0.5)} ${f(x)},${f(y + r)}" fill="${shade(color, -0.25)}" opacity=".6"/>
  </g>`;
}

function splats(r, n, colors, box, size = [30, 120]) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]);
    const rr = size[0] + r() * (size[1] - size[0]);
    const c = colors[Math.floor(r() * colors.length)];
    s += `<path d="${splatPath(x, y, rr, Math.floor(r() * 99) + 1, 11)}" fill="${c}"/>`;
    for (let j = 0; j < 3; j++) s += `<circle cx="${f(x + (r() - 0.5) * rr * 3)}" cy="${f(y + (r() - 0.5) * rr * 2)}" r="${f(rr * (0.06 + r() * 0.1))}" fill="${c}"/>`;
  }
  return s;
}

function waves(y, color, n = 7, gap = 26, op = 0.45) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const yy = y + i * gap, off = (i * 37) % 80;
    let d = `M${-off} ${yy}`;
    for (let x = -off; x < W + 80; x += 80) d += ` q20 -9 40 0 t40 0`;
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="${3 + i * 0.4}"/>`;
  }
  return s;
}

function stars(r, n, y1, color = '#fff') {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * y1)}" r="${f(0.8 + r() * 2.2)}" fill="${color}" opacity="${f(0.3 + r() * 0.7)}"/>`;
  return s;
}

function rays(cx, cy, n, color, op = 0.2, len = 1400, width = 0.09) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, b = a + width;
    s += `<path d="M${cx} ${cy} L${f(cx + Math.cos(a) * len)} ${f(cy + Math.sin(a) * len)} L${f(cx + Math.cos(b) * len)} ${f(cy + Math.sin(b) * len)}Z" fill="${color}" opacity="${op}"/>`;
  }
  return s;
}

function cloud(x, y, s, color, op = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}" fill="${color}"><circle cx="0" cy="0" r="60"/><circle cx="70" cy="-24" r="74"/><circle cx="150" cy="-4" r="56"/><circle cx="96" cy="28" r="54"/><circle cx="30" cy="30" r="46"/></g>`;
}

function portrait(who, x, y, size, mood, ink) {
  const svg = portraitSVG(who, { mood, ink, bg: false });
  return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);
}

function title(text, x, y, size, color, o = {}) {
  return `<text x="${x}" y="${y}" font-family="Bungee, 'Lilita One', sans-serif" font-size="${size}" fill="${color}" stroke="${o.stroke || '#1b1530'}" stroke-width="${o.sw || size * 0.12}" paint-order="stroke" text-anchor="${o.anchor || 'start'}" ${o.rot ? `transform="rotate(${o.rot} ${x} ${y})"` : ''}>${text}</text>`;
}

/** Kai as a full-body silhouette-ish figure (for action panels). */
function kaiFigure(x, y, s, ink, pose = 'stand') {
  const D = '#1b1530', skin = '#f4c29b';
  const leap = pose === 'leap';
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="${leap ? 'M-10 60 L-50 110 M10 60 L40 120' : 'M-14 60 L-20 130 M14 60 L20 130'}" stroke="${D}" stroke-width="22" stroke-linecap="round"/>
    <path d="${leap ? 'M-10 60 L-50 110 M10 60 L40 120' : 'M-14 60 L-20 130 M14 60 L20 130'}" stroke="#2a2a38" stroke-width="15" stroke-linecap="round"/>
    <rect x="-34" y="-10" width="68" height="80" rx="26" fill="#27325e" stroke="${D}" stroke-width="6"/>
    <path d="${leap ? 'M26 10 L80 -30' : 'M26 10 L60 40'}" stroke="${D}" stroke-width="20" stroke-linecap="round"/>
    <path d="${leap ? 'M26 10 L80 -30' : 'M26 10 L60 40'}" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>
    <g transform="${leap ? 'translate(78 -34) rotate(-38)' : 'translate(62 40) rotate(10)'}"><rect x="-8" y="-16" width="64" height="24" rx="8" fill="${ink}" stroke="${D}" stroke-width="5"/></g>
    <path d="M-26 10 L${leap ? '-70 -20' : '-54 40'}" stroke="${D}" stroke-width="20" stroke-linecap="round"/>
    <path d="M-26 10 L${leap ? '-70 -20' : '-54 40'}" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>
    <circle cx="0" cy="-50" r="44" fill="${skin}" stroke="${D}" stroke-width="6"/>
    <path d="M-46 -46 C-50 -96 -20 -110 0 -110 C20 -110 50 -96 46 -46 C34 -60 14 -62 0 -56 C-14 -62 -34 -60 -46 -46Z" fill="${ink}" stroke="${D}" stroke-width="6"/>
    <path d="M-12 -104 L0 -140 L12 -104Z" fill="${ink}" stroke="${D}" stroke-width="5"/>
    <path d="M-40 -60 C-70 -40 -70 0 -56 20 M40 -60 C70 -40 70 0 56 20" stroke="${ink}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="-16" cy="-48" r="7" fill="${D}"/><circle cx="16" cy="-48" r="7" fill="${D}"/>
    <path d="M-10 -26 Q0 -18 10 -26" stroke="${D}" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`;
}

// ---------------------------------------------------------------------------------------------
const ARTS = {
  lighthouse(o) {
    const r = rng(11), id = o.id;
    return {
      kb: { x: -2, y: 1, zoom: 0.1 },
      defs: lin(`${id}sky`, [[0, '#3b2a7a'], [0.45, '#ff6f91'], [0.75, '#ffb35c'], [1, '#ffe08a']]) + lin(`${id}sea`, [[0, '#2a9fd8'], [1, '#0f2f6a']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>${stars(r, 40, 220)}<circle cx="520" cy="520" r="120" fill="#fff1b8"/><circle cx="520" cy="520" r="180" fill="#fff1b8" opacity=".25"/>${cloud(140, 170, 1.1, '#ffd0e0', 0.55)}${cloud(1100, 120, 0.8, '#ffd0e0', 0.45)}`],
        [0.2, `${skyline(r, { y: 600, h: 260, color: '#5a3f8f', win: '#ffe8a0', winP: 0.18 })}<path d="M180 600 L180 330 L330 330 L330 344 L200 344 L200 600Z M300 344 L300 420" fill="#5a3f8f" stroke="#5a3f8f" stroke-width="6"/>`],
        [0.35, `${skyline(r, { y: 630, h: 170, color: '#3a2a66', win: ['#ffd36b', '#8fe3ff', '#ff9fd0'], winP: 0.25, minW: 60, maxW: 150 })}`],
        [0.5, `<rect y="620" width="${W}" height="300" fill="url(#${id}sea)"/>${waves(650, '#ffffff', 9, 28, 0.35)}<ellipse cx="1260" cy="640" rx="260" ry="56" fill="#2b2350"/>${lighthouse(1250, 636, 1.05)}`],
        [0.9, `<path d="M-40 780 L1000 760 L1040 900 L-40 900Z" fill="#8a5a3c"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<rect x="${i * 104 - 20}" y="${768 - i * 2}" width="96" height="140" fill="${i % 2 ? '#7a4d31' : '#946342'}"/>`).join('')}${splats(r, 6, ['#ff8a1f', '#2fd0ff', '#ff2fa0', '#9dff2e'], [40, 780, 900, 880], [26, 60])}
          <path d="M860 250 q12 -10 24 0 q12 -10 24 0 M960 300 q9 -8 18 0 q9 -8 18 0 M780 330 q8 -7 16 0 q8 -7 16 0" stroke="#2b2350" stroke-width="5" fill="none" stroke-linecap="round"/>
          ${title('TIDEHAVEN', 90, 170, 110, '#fff4d6')}`],
      ],
    };
  },

  wellspring(o) {
    const r = rng(23), id = o.id;
    const cores = [['#ff7a2e', 520, 330], ['#ff5fa8', 660, 250], ['#5fe08a', 800, 220], ['#3fb6ff', 940, 250], ['#ffd23f', 1080, 330]];
    return {
      kb: { x: 0, y: -2, zoom: 0.12 },
      defs: lin(`${id}bg`, [[0, '#07142e'], [1, '#12275a']]) + rad(`${id}pool`, [[0, '#ffffff'], [0.3, '#8fe3ff'], [0.6, '#ff9fe8', 0.8], [1, '#6a4bff', 0]]) + lin(`${id}col`, [[0, '#ffffff', 0], [0.6, '#bff4ff', 0.35], [1, '#ffffff', 0.7]]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>${stars(r, 60, H, '#8fe3ff')}`],
        [0.25, `<path d="M0 0 L420 0 L360 180 L420 420 L300 700 L360 900 L0 900Z" fill="#0b1a3a"/><path d="M1600 0 L1180 0 L1250 200 L1170 460 L1300 700 L1240 900 L1600 900Z" fill="#0b1a3a"/><rect x="740" y="0" width="120" height="330" fill="url(#${id}col)"/>`],
        [0.45, `<ellipse cx="800" cy="720" rx="420" ry="120" fill="url(#${id}pool)"/>${rays(800, 720, 22, '#bff4ff', 0.07, 900, 0.07)}${cores.map(([c, x, y], i) => core(x, y, 44, c, `${id}c${i}`)).join('')}`],
        [0.8, `<path d="M0 900 L0 760 Q200 720 340 780 L520 900Z M1600 900 L1600 740 Q1400 720 1260 790 L1080 900Z" fill="#050d22"/>${[...Array(24)].map(() => `<circle cx="${f(300 + r() * 1000)}" cy="${f(300 + r() * 500)}" r="${f(2 + r() * 4)}" fill="#fff" opacity="${f(0.3 + r() * 0.6)}"/>`).join('')}`],
      ],
    };
  },

  murkwell(o) {
    const r = rng(37), id = o.id;
    return {
      kb: { x: 1.5, y: 0, zoom: 0.14 },
      defs: lin(`${id}bg`, [[0, '#120a26'], [1, '#2a1650']]) + rad(`${id}lure`, [[0, '#fff6b0'], [0.3, '#ffe98a', 0.6], [1, '#ffe98a', 0]]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>`],
        [0.15, `<rect x="120" y="90" width="1360" height="600" rx="10" fill="#1d1540"/>${skyline(r, { y: 690, h: 380, color: '#2c2060', win: ['#ffd36b', '#8fe3ff'], winP: 0.22, x0: 120, x1: 1480 })}<path d="M120 90 H1480 V690 H120Z M800 90 V690 M120 390 H1480" fill="none" stroke="#0c0820" stroke-width="22"/>`],
        [0.4, `<rect x="160" y="700" width="1280" height="220" fill="#0c0820"/><rect x="1040" y="140" width="330" height="190" rx="12" fill="#7b3be0"/>${title('ColorPlus™', 1205, 230, 44, '#fff', { anchor: 'middle', stroke: '#3a1680' })}<text x="1205" y="290" font-family="'Baloo 2', sans-serif" font-size="30" font-weight="800" fill="#e0ccff" text-anchor="middle">Colour, by subscription.</text>`],
        [0.75, `<g transform="translate(560 190)">
            <ellipse cx="240" cy="470" rx="330" ry="300" fill="#07040f"/>
            <rect x="120" y="0" width="200" height="190" rx="10" fill="#07040f"/><path d="M40 196 Q240 170 440 196 L440 214 Q240 196 40 214Z" fill="#07040f"/>
            <path d="M230 10 C250 -90 420 -80 440 30" fill="none" stroke="#07040f" stroke-width="16" stroke-linecap="round"/>
            <circle cx="444" cy="60" r="120" fill="url(#${id}lure)"/><circle cx="444" cy="60" r="26" fill="#fff6b0"/>
            <circle cx="300" cy="360" r="30" fill="none" stroke="#f5c542" stroke-width="6"/><circle cx="300" cy="360" r="8" fill="#ffe14d"/>
            <circle cx="170" cy="370" r="7" fill="#ffe14d"/>
            <path d="M80 480 Q240 540 420 470" stroke="#fffaf0" stroke-width="10" stroke-dasharray="18 14" fill="none"/>
          </g>`],
      ],
    };
  },

  heist(o) {
    const r = rng(41), id = o.id;
    let rain = '';
    for (let i = 0; i < 90; i++) { const x = r() * (W + 300), y = r() * H; rain += `<path d="M${f(x)} ${f(y)} l-30 70" stroke="#b9c6ff" stroke-opacity=".35" stroke-width="3"/>`; }
    return {
      kb: { x: -1.5, y: 0.5, zoom: 0.12 },
      defs: lin(`${id}bg`, [[0, '#0d0a24'], [1, '#2b2350']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>${cloud(-60, 120, 1.8, '#1b1640')}${cloud(520, 80, 1.6, '#231c4c')}${cloud(1080, 140, 1.9, '#1b1640')}<path d="M980 0 L930 150 L990 150 L900 330 L1010 170 L950 170 L1030 0Z" fill="#fff6b0"/>`],
        [0.3, `${lighthouse(1180, 640, 0.95, { beam: false, lamp: '#7a7496', band: '#6a5f86', body: '#b8b2c8' })}<rect y="630" width="${W}" height="300" fill="#141038"/>${waves(660, '#8fa0ff', 8, 30, 0.2)}`],
        [0.55, `<g><path d="M300 640 L380 240 L420 240 L500 640Z" fill="#3a2f66" stroke="#140f2a" stroke-width="8"/><rect x="340" y="200" width="120" height="60" fill="#6a2bd9"/><path d="M400 260 L400 380" stroke="#140f2a" stroke-width="10"/><path d="M380 380 L420 380 L400 460Z" fill="#aab3c8" stroke="#140f2a" stroke-width="6"/>${title('MURK', 400, 245, 34, '#c8ff3a', { anchor: 'middle', stroke: '#140f2a' })}
          <path d="M420 300 Q700 200 900 330" stroke="#140f2a" stroke-width="12" fill="none"/>
          <g transform="translate(900 360)"><path d="M-70 -30 L70 -30 L50 60 L-50 60Z" fill="#231c3c" stroke="#140f2a" stroke-width="6"/>${core(-30, 10, 22, '#ff7a2e', `${id}c1`, { glow: 2 })}${core(20, 0, 22, '#3fb6ff', `${id}c2`, { glow: 2 })}${core(0, 36, 20, '#ffd23f', `${id}c3`, { glow: 2 })}</g></g>`],
        [0.85, `${[0, 1, 2].map((i) => `<g transform="translate(${620 + i * 170} ${690 + (i % 2) * 20})"><ellipse cx="0" cy="40" rx="54" ry="60" fill="#0c0718"/><path d="M-40 -6 Q0 -40 40 -6Z" fill="#d8a72e"/><circle cx="-14" cy="26" r="9" fill="#c8ff3a"/><circle cx="14" cy="26" r="9" fill="#c8ff3a"/>${core(0, -60, 18, ['#ff5fa8', '#5fe08a', '#ff7a2e'][i], `${id}g${i}`, { glow: 1.8 })}</g>`).join('')}${rain}`],
      ],
    };
  },

  engine(o) {
    const r = rng(53), id = o.id;
    const cores = ['#ff7a2e', '#ff5fa8', '#5fe08a', '#3fb6ff', '#ffd23f'];
    return {
      kb: { x: 0, y: 2, zoom: 0.1 },
      defs: lin(`${id}bg`, [[0, '#2a2438'], [0.6, '#5a5470'], [1, '#8a84a0']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>`],
        [0.2, `${cloud(-100, 160, 2.2, '#6e6884', 0.9)}${cloud(900, 120, 2.4, '#6e6884', 0.85)}${cloud(400, 260, 1.8, '#7c7692', 0.8)}`],
        [0.4, `${skyline(r, { y: 900, h: 260, color: '#4a4560', win: '#6a6480', winP: 0.2 })}`],
        [0.6, `<path d="M700 900 L740 300 L860 300 L900 900Z" fill="#231e33"/><path d="M620 330 L980 330 L940 200 L660 200Z" fill="#2e2742" stroke="#16121f" stroke-width="10"/>
          ${[0, 1, 2].map((i) => `<rect x="${690 + i * 90}" y="80" width="46" height="130" fill="#2e2742" stroke="#16121f" stroke-width="8"/>`).join('')}
          ${[0, 1, 2].map((i) => cloud(640 + i * 90, 40 - i * 30, 0.7 + i * 0.1, '#9a94b0', 0.9)).join('')}
          <circle cx="800" cy="265" r="60" fill="none" stroke="#6a2bd9" stroke-width="16" stroke-dasharray="20 12"/>
          ${cores.map((c, i) => core(672 + i * 64, 265, 20, c, `${id}k${i}`, { glow: 1.6 })).join('')}
          ${title('GRAYTIDE ENGINE', 800, 395, 40, '#c8c2dc', { anchor: 'middle', stroke: '#16121f' })}`],
        [0.9, `<path d="M0 900 L0 820 Q400 760 800 820 T1600 800 L1600 900Z" fill="#8f89a3" opacity=".9"/>${cloud(-80, 820, 1.6, '#aaa4be', 0.9)}${cloud(1200, 830, 1.5, '#aaa4be', 0.9)}`],
      ],
    };
  },

  kai(o) {
    const r = rng(61), id = o.id;
    return {
      kb: { x: -1, y: -1, zoom: 0.12 },
      defs: lin(`${id}sky`, [[0, '#8a849e'], [0.5, '#b7a7c0'], [1, '#ffb35c']]) + lin(`${id}sea`, [[0, '#4a86b8'], [1, '#1f3e6a']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>${cloud(-100, 120, 2.4, '#77718c', 0.95)}${cloud(700, 60, 2.6, '#6e6884', 0.95)}${cloud(1300, 180, 1.8, '#77718c', 0.9)}`],
        [0.3, `${skyline(r, { y: 640, h: 200, color: '#6a5f86', win: '#ffe8a0', winP: 0.12 })}<rect y="630" width="${W}" height="300" fill="url(#${id}sea)"/>${waves(660, '#fff', 8, 28, 0.3)}`],
        [0.6, `<path d="M-40 700 L1640 660 L1640 900 L-40 900Z" fill="#946342"/>${splats(r, 9, [o.ink, o.ink, '#ffffff'], [80, 700, 1500, 880], [30, 80])}`],
        [0.85, `${portrait('kai', 470, 170, 700, 'worried', o.ink)}<text x="1240" y="300" font-family="Bungee" font-size="140" fill="#fff" stroke="#1b1530" stroke-width="16" paint-order="stroke" text-anchor="middle">?!</text>`],
      ],
    };
  },

  brine(o) {
    const r = rng(71), id = o.id;
    let planks = '';
    for (let i = 0; i < 16; i++) planks += `<rect x="${i * 104}" y="0" width="100" height="${H}" fill="${i % 2 ? '#6b4428' : '#7a5033'}"/>`;
    return {
      kb: { x: 1, y: 0, zoom: 0.1 },
      defs: '',
      layers: [
        [0, `${planks}<rect width="${W}" height="${H}" fill="#1b1530" opacity=".25"/>`],
        [0.25, `<circle cx="260" cy="260" r="110" fill="none" stroke="#f4f4f4" stroke-width="44"/><circle cx="260" cy="260" r="110" fill="none" stroke="#e8432f" stroke-width="44" stroke-dasharray="86 86"/>
          <g transform="translate(1180 150) rotate(4)"><rect width="300" height="400" fill="#f3e6c8"/><rect x="20" y="20" width="260" height="250" fill="#2b5fa8"/>${core(150, 140, 60, '#ffd23f', `${id}p`)}${title('SPLASHGUARD', 150, 320, 30, '#2b2350', { anchor: 'middle', stroke: '#f3e6c8', sw: 0 })}<text x="150" y="366" font-family="'Baloo 2'" font-weight="800" font-size="26" fill="#2b2350" text-anchor="middle">Protect the colour!</text></g>`],
        [0.7, `${rays(800, 520, 18, '#ffe14d', 0.08, 1200, 0.1)}${portrait('brine', 400, 60, 820, o.mood || 'smug')}`],
      ],
    };
  },

  pix(o) {
    const r = rng(83), id = o.id;
    return {
      kb: { x: -1, y: 1, zoom: 0.12 },
      defs: lin(`${id}bg`, [[0, '#1a0f3a'], [1, '#3a1a6a']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>${stars(r, 90, 600)}`],
        [0.2, `${[0, 1, 2, 3, 4].map((i) => `<circle cx="1180" cy="200" r="${120 + i * 110}" fill="none" stroke="#59e3ff" stroke-width="6" opacity="${0.5 - i * 0.09}"/>`).join('')}<path d="M1180 520 L1160 200 L1200 200Z" fill="#231c3c" stroke="#59e3ff" stroke-width="4"/><circle cx="1180" cy="190" r="14" fill="#ff3b4f"/>`],
        [0.45, `<rect y="660" width="${W}" height="300" fill="#140c34"/>${waves(680, '#59e3ff', 8, 26, 0.25)}<g transform="translate(1180 600)"><path d="M-200 60 Q0 140 200 60 L160 -60 L-160 -60Z" fill="#e8432f" stroke="#1b1530" stroke-width="8"/><rect x="-150" y="-200" width="300" height="150" rx="14" fill="#2a2150" stroke="#1b1530" stroke-width="8"/><rect x="-110" y="-170" width="220" height="70" rx="14" fill="#ff3b6b"/>${title('ON AIR', 0, -118, 44, '#fff', { anchor: 'middle', stroke: '#9a1238' })}</g>`],
        [0.8, `${portrait('pix', 240, 110, 760, o.mood || 'happy')}${[0, 1, 2].map((i) => `<path d="M${520 + i * 34} 420 q30 -40 0 -80" stroke="#ff9ff0" stroke-width="8" fill="none" opacity="${0.8 - i * 0.2}" stroke-linecap="round"/>`).join('')}${title('PIX FM', 1180, 820, 70, '#ff9ff0', { anchor: 'middle' })}`],
      ],
    };
  },

  cores(o) {
    const r = rng(97), id = o.id;
    const cs = [['#ff7a2e', 300, 300], ['#ff5fa8', 500, 200], ['#5fe08a', 720, 260], ['#3fb6ff', 520, 420], ['#ffd23f', 760, 430]];
    return {
      kb: { x: 1.5, y: 1, zoom: 0.12 },
      defs: lin(`${id}sky`, [[0, '#2a3a8a'], [0.55, '#ff8fb0'], [1, '#ffd08a']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>${stars(r, 30, 250)}`],
        [0.3, `${skyline(r, { y: 700, h: 200, color: '#5a4a9a', win: '#ffe8a0', winP: 0.15 })}<rect y="690" width="${W}" height="240" fill="#1f4e8a"/>${waves(710, '#fff', 7, 26, 0.3)}${lighthouse(1250, 700, 1.1, { beamColor: '#fff' })}`],
        [0.7, `${cs.map(([c, x, y], i) => `<path d="M${x} ${y} Q${(x + 1250) / 2} ${y - 260} 1250 330" stroke="${c}" stroke-width="16" fill="none" stroke-linecap="round" opacity=".55" stroke-dasharray="4 26"/>${core(x, y, 40, c, `${id}q${i}`)}`).join('')}`],
      ],
    };
  },

  finale(o) {
    const r = rng(101), id = o.id;
    return {
      kb: { x: 0, y: 0, zoom: 0.16 },
      defs: rad(`${id}boom`, [[0, '#ffffff'], [0.25, o.ink], [0.7, o.ink, 0.5], [1, o.ink, 0]]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="#1b1036"/>${rays(800, 420, 26, o.ink, 0.22)}`],
        [0.3, `<g transform="translate(800 470)"><path d="M-260 300 L-200 -60 L-60 -160 L80 -150 L220 -40 L280 300Z" fill="#4a4560" stroke="#16121f" stroke-width="14"/><circle cx="0" cy="-40" r="70" fill="#6a2bd9"/><path d="M-320 -20 L-460 -120 M320 -20 L480 -140" stroke="#4a4560" stroke-width="60" stroke-linecap="round"/>${core(0, -40, 46, '#ffd23f', `${id}sun`)}</g>`],
        [0.55, `<circle cx="800" cy="420" r="520" fill="url(#${id}boom)"/>${splats(r, 16, [o.ink, '#ffffff', shade(o.ink, 0.3)], [200, 80, 1400, 820], [40, 130])}`],
        [0.95, `${kaiFigure(1180, 420, 1.9, o.ink, 'leap')}${title('SPLAT!', 250, 230, 150, '#fff4d6', { rot: -8 })}`],
      ],
    };
  },

  rainbow(o) {
    const r = rng(113), id = o.id;
    const bright = ['#ff8a1f', '#ff2fa0', '#2fd0ff', '#9dff2e', '#ffd23f', '#8a5bff'];
    let fireworks = '';
    for (let i = 0; i < 5; i++) { const x = 200 + r() * 1200, y = 100 + r() * 220, c = bright[i % bright.length]; fireworks += rays(x, y, 14, c, 0.9, 60 + r() * 40, 0.05) + `<circle cx="${f(x)}" cy="${f(y)}" r="10" fill="#fff"/>`; }
    return {
      kb: { x: -1, y: 1.5, zoom: 0.1 },
      defs: lin(`${id}sky`, [[0, '#2fb6ff'], [0.7, '#9fe8ff'], [1, '#fff4d6']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>${bright.map((c, i) => `<path d="M${-100 + i * 26} 820 A ${900 - i * 26} ${760 - i * 26} 0 0 1 ${1700 - i * 26} 820" fill="none" stroke="${c}" stroke-width="26" opacity=".85"/>`).join('')}${fireworks}`],
        [0.35, `${skyline(r, { y: 760, h: 300, color: '#ff8fb0', win: ['#fff', '#ffe14d'], winP: 0.25, minW: 60, maxW: 130 })}`],
        [0.6, `${skyline(r, { y: 820, h: 200, color: '#7b5bff', win: ['#9dff2e', '#fff'], winP: 0.3, minW: 70, maxW: 160 })}${splats(r, 18, bright, [0, 500, W, 800], [30, 90])}`],
        [0.9, `<rect y="820" width="${W}" height="100" fill="#ffd23f"/>${splats(r, 10, bright, [0, 820, W, 900], [30, 70])}${[...Array(40)].map(() => `<rect x="${f(r() * W)}" y="${f(r() * 700)}" width="12" height="20" fill="${bright[Math.floor(r() * bright.length)]}" transform="rotate(${f(r() * 90)} ${f(r() * W)} ${f(r() * 700)})"/>`).join('')}`],
      ],
    };
  },

  'murkwell-defeat'(o) {
    const r = rng(127), id = o.id;
    return {
      kb: { x: 1, y: 0, zoom: 0.1 },
      defs: '',
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="#9fe8ff"/><rect y="0" width="${W}" height="620" fill="#9d98ae"/>${[...Array(14)].map((_, i) => `<path d="M${i * 120} 0 V620" stroke="#8a859c" stroke-width="4"/>`).join('')}<path d="M0 0 H700 C660 120 720 240 660 360 C720 460 640 560 700 620 H0Z" fill="${o.ink}"/>${splats(r, 5, [o.ink, '#2fd0ff', '#ff2fa0'], [60, 60, 600, 560], [40, 80])}`],
        [0.4, `<rect y="620" width="${W}" height="300" fill="#e8d8b8"/><g transform="translate(1180 540)"><rect x="-60" y="0" width="120" height="100" fill="#8a5c2e"/><ellipse cx="0" cy="0" rx="60" ry="16" fill="${o.ink}"/></g>`],
        [0.75, `${portrait('murkwell', 560, 150, 620, 'sad')}${portrait('dredge', 1040, 250, 500, 'happy')}<g transform="translate(900 640) rotate(-30)"><rect x="-6" y="-120" width="12" height="130" fill="#c9a06a"/><rect x="-12" y="-150" width="24" height="36" rx="6" fill="${o.ink}"/></g>`],
      ],
    };
  },

  team(o) {
    const r = rng(139), id = o.id;
    const bright = ['#ff8a1f', '#ff2fa0', '#2fd0ff', '#9dff2e', '#ffd23f'];
    return {
      kb: { x: 0, y: 1, zoom: 0.09 },
      defs: lin(`${id}sky`, [[0, '#ff7eb0'], [0.6, '#ffb35c'], [1, '#ffe08a']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/><circle cx="800" cy="640" r="260" fill="#fff1b8" opacity=".7"/>${rays(800, 640, 20, '#fff', 0.12)}`],
        [0.3, `<rect y="700" width="${W}" height="220" fill="#2b2350"/><path d="M0 700 H1600" stroke="#f7f3ea" stroke-width="18"/>${[...Array(21)].map((_, i) => `<rect x="${i * 80}" y="640" width="10" height="70" fill="#f7f3ea"/>`).join('')}<path d="M0 640 H1600" stroke="#f7f3ea" stroke-width="10"/>`],
        [0.6, `${portrait('shelly', 20, 360, 380, 'happy')}${portrait('otto', 1200, 380, 360, 'happy')}${portrait('tilly', 1340, 420, 330, 'happy')}${portrait('pix', 250, 180, 430, 'laugh')}`],
        [0.85, `${portrait('brine', 830, 170, 520, 'happy')}${portrait('kai', 520, 280, 470, 'happy', o.ink)}<g transform="translate(760 640)"><path d="M0 -44 L13 -14 L46 -14 L20 6 L30 40 L0 20 L-30 40 L-20 6 L-46 -14 L-13 -14Z" fill="#ffd23f" stroke="#1b1530" stroke-width="6"/></g>${[...Array(50)].map(() => { const x = r() * W, y = r() * 620; return `<rect x="${f(x)}" y="${f(y)}" width="12" height="20" fill="${bright[Math.floor(r() * bright.length)]}" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})"/>`; }).join('')}`],
      ],
    };
  },

  tease(o) {
    const r = rng(151), id = o.id;
    let bubbles = '';
    for (let i = 0; i < 40; i++) bubbles += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(2 + r() * 10)}" fill="none" stroke="#5fe0ff" stroke-opacity="${f(0.15 + r() * 0.3)}" stroke-width="2"/>`;
    return {
      kb: { x: 0, y: 0, zoom: 0.2 },
      defs: lin(`${id}bg`, [[0, '#06122a'], [1, '#000004']]) + rad(`${id}eye`, [[0, '#c8ff3a'], [0.35, '#5fe0a0', 0.8], [1, '#1a6a5a', 0]]) + rad(`${id}c6`, [[0, '#9b6bff', 0.8], [1, '#9b6bff', 0]]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}bg)"/>`],
        [0.3, bubbles],
        [0.6, `<ellipse cx="800" cy="430" rx="420" ry="190" fill="url(#${id}eye)" opacity=".85"/><ellipse cx="800" cy="430" rx="300" ry="120" fill="#0b2a22" stroke="#c8ff3a" stroke-width="6"/><ellipse cx="800" cy="430" rx="36" ry="118" fill="#000"/><circle cx="760" cy="380" r="16" fill="#fff" opacity=".7"/>`],
        [0.9, `<circle cx="800" cy="800" r="140" fill="url(#${id}c6)"/>${core(800, 800, 30, '#3a1a6a', `${id}k6`, { glow: 1.2 })}`],
      ],
    };
  },

  'city-gray'(o) {
    const r = rng(163), id = o.id;
    return {
      kb: { x: 1, y: 0, zoom: 0.08 },
      defs: lin(`${id}sky`, [[0, '#5a5470'], [1, '#9d98ae']]),
      layers: [
        [0, `<rect width="${W}" height="${H}" fill="url(#${id}sky)"/>${cloud(0, 150, 2.5, '#7c7692', 0.9)}${cloud(900, 120, 2.6, '#6e6884', 0.9)}`],
        [0.4, `${skyline(r, { y: 900, h: 420, color: '#6a6480', win: '#8a84a0', winP: 0.2 })}`],
      ],
    };
  },
};

export const ART_IDS = Object.keys(ARTS);

/**
 * Build a panel.
 * @returns {{ svg: string, kb: {x, y, zoom}, layers: number }}
 */
export function panelArt(art, o = {}) {
  const make = ARTS[art] || ARTS.lighthouse;
  const id = `cm${++UID}`;
  const p = make({ ink: o.ink || '#ff8a1f', mood: o.mood, id });
  const layers = p.layers.map(([d, s]) => `<g class="cm-layer" data-d="${d}">${s}</g>`).join('');
  const svg = `<svg class="cm-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>${p.defs || ''}<pattern id="${id}ht" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="2.2" fill="#000"/></pattern></defs>
    ${layers}
    <rect width="${W}" height="${H}" fill="url(#${id}ht)" opacity=".06"/>
  </svg>`;
  return { svg, kb: p.kb || { x: 0, y: 0, zoom: 0.1 }, layers: p.layers.length };
}
