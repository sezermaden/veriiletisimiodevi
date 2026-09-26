// Procedural SVG portraits for every speaker (dialogue box, comic panels, results screen).
//
//   portraitSVG(who, { mood, ink, uid }) → '<svg …>' string (viewBox 0 0 200 200)
//
// Structure hooks for CSS animation (story.css): .pt-body (breathing), .pt-eyes (blink),
// .pt-mc / .pt-mo (closed / open mouth — toggled while talking), .pt-lure (Murkwell's lure),
// .pt-glow (Pix's bioluminescence), .pt-blink (radio antenna LED).
// Moods: neutral, happy, laugh, angry, sad, shock, smug, worried, determined.

let UID = 0;

// ---- colour helpers --------------------------------------------------------------------------
function hexToRgb(h) {
  h = String(h || '#ffffff').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
export function shade(hex, amt) {
  // amt > 0 → toward white, amt < 0 → toward black
  const c = hexToRgb(hex);
  return rgbToHex(c.map((v) => (amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
}

// ---- shared features -------------------------------------------------------------------------
const INK_DARK = '#1b1530';

/** Background: soft radial glow + ink splat in the speaker colour. */
function backdrop(id, color) {
  return `<defs><radialGradient id="${id}-bg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${shade(color, 0.25)}" stop-opacity=".55"/><stop offset=".6" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>
  <rect width="200" height="200" fill="url(#${id}-bg)"/>
  <path d="${splatPath(100, 96, 74, 7, 11)}" fill="${color}" opacity=".16"/>`;
}

/** Deterministic ink-splat outline. */
export function splatPath(cx, cy, r, seed = 1, n = 12) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.78 + rnd() * 0.3) * (i % 3 === 0 ? 1.12 : 1);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[(i + 1) % n], q = pts[i];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const ox = (mx - cx) * 0.18, oy = (my - cy) * 0.18;
    d += ` Q${(mx + ox).toFixed(1)},${(my + oy).toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }
  return d + 'Z';
}

/**
 * A pair of cartoon eyes with mood lids.
 * @param {string} id unique prefix for clip paths
 * @param {Array} pos [[cx, cy], [cx, cy]]
 */
function eyes(id, pos, o) {
  const { r = 12, mood = 'neutral', iris = '#2b1d14', lid = '#f4c29b', white = '#ffffff', stroke = INK_DARK, look = [1.5, 1], sw = 2.4 } = o;
  let s = '<g class="pt-eyes">';
  pos.forEach(([cx, cy], i) => {
    const side = i === 0 ? -1 : 1;
    if (mood === 'happy' || mood === 'laugh') {
      s += `<path d="M${cx - r},${cy + 3} Q${cx},${cy - r * 1.05} ${cx + r},${cy + 3}" fill="none" stroke="${stroke}" stroke-width="${sw * 1.5}" stroke-linecap="round"/>`;
      return;
    }
    const rx = r * (mood === 'shock' ? 0.95 : 0.84), ry = r * (mood === 'shock' ? 1.25 : 1.1);
    const ir = r * (mood === 'shock' ? 0.36 : 0.6);
    const lx = mood === 'shock' ? 0 : look[0], ly = mood === 'sad' ? 3 : look[1];
    s += `<clipPath id="${id}-e${i}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${white}" stroke="${stroke}" stroke-width="${sw}"/>`;
    s += `<g clip-path="url(#${id}-e${i})">`;
    s += `<circle cx="${cx + lx}" cy="${cy + ly}" r="${ir}" fill="${iris}"/>`;
    s += `<circle cx="${cx + lx}" cy="${cy + ly}" r="${ir * 0.52}" fill="#08060f"/>`;
    s += `<circle cx="${cx + lx - ir * 0.38}" cy="${cy + ly - ir * 0.42}" r="${ir * 0.3}" fill="#fff"/>`;
    s += `<circle cx="${cx + lx + ir * 0.35}" cy="${cy + ly + ir * 0.3}" r="${ir * 0.14}" fill="#fff" opacity=".8"/>`;
    // lids
    const top = cy - ry - 2, w = rx + 3;
    let lidPath = null;
    if (mood === 'smug') lidPath = `M${cx - w},${top} L${cx + w},${top} L${cx + w},${cy - ry * 0.05} L${cx - w},${cy - ry * 0.05}Z`;
    else if (mood === 'angry') lidPath = `M${cx - w},${top} L${cx + w},${top} L${cx + w},${cy - ry * (side < 0 ? 0.55 : -0.05)} L${cx - w},${cy - ry * (side < 0 ? -0.05 : 0.55)}Z`;
    else if (mood === 'sad' || mood === 'worried') lidPath = `M${cx - w},${top} L${cx + w},${top} L${cx + w},${cy - ry * (side < 0 ? 0.2 : 0.75)} L${cx - w},${cy - ry * (side < 0 ? 0.75 : 0.2)}Z`;
    else if (mood === 'determined') lidPath = `M${cx - w},${top} L${cx + w},${top} L${cx + w},${cy - ry * 0.45} L${cx - w},${cy - ry * 0.45}Z`;
    if (lidPath) s += `<path d="${lidPath}" fill="${lid}"/><path d="${lidPath}" fill="none" stroke="${stroke}" stroke-width="0"/>`;
    s += '</g>';
    if (lidPath) {
      // lid edge line
      const m = lidPath.match(/L([\d.-]+),([\d.-]+) L([\d.-]+),([\d.-]+)Z$/);
      if (m) s += `<path d="M${m[3]},${m[4]} L${m[1]},${m[2]}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" clip-path="url(#${id}-e${i})"/>`;
    }
  });
  return s + '</g>';
}

/** Brows above eye positions. */
function brows(pos, o) {
  const { mood = 'neutral', w = 13, dy = -17, color = INK_DARK, sw = 4.5 } = o;
  let s = '';
  pos.forEach(([cx, cy], i) => {
    const side = i === 0 ? -1 : 1;
    const y = cy + dy + (mood === 'shock' ? -6 : mood === 'happy' || mood === 'laugh' ? -3 : 0);
    let inner = 0, outer = 0;
    if (mood === 'angry' || mood === 'determined') { inner = mood === 'angry' ? 7 : 3; outer = -3; }
    else if (mood === 'sad' || mood === 'worried') { inner = -6; outer = 3; }
    else if (mood === 'smug') { inner = side < 0 ? 2 : -4; outer = side < 0 ? 0 : -6; }
    const xi = cx - side * w * 0.9, xo = cx + side * w;
    s += `<path d="M${xo},${y + outer} Q${cx},${y - 4 + (inner + outer) / 2} ${xi},${y + inner}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  });
  return s;
}

/** Mouth: returns closed + open shapes (CSS toggles .pt-mo while talking). */
function mouth(cx, cy, w, o = {}) {
  const { mood = 'neutral', stroke = INK_DARK, inside = '#5a1f2e', tongue = '#ff7a8c', sw = 3.2, teeth = false } = o;
  const h = w * 0.5;
  let closed;
  switch (mood) {
    case 'happy': closed = `<path d="M${cx - w / 2},${cy - 2} Q${cx},${cy + h} ${cx + w / 2},${cy - 2}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`; break;
    case 'laugh': closed = `<path d="M${cx - w / 2},${cy - 3} Q${cx},${cy + h * 1.5} ${cx + w / 2},${cy - 3}Z" fill="${inside}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/><path d="M${cx - w * 0.22},${cy + h * 0.55} Q${cx},${cy + h * 0.2} ${cx + w * 0.22},${cy + h * 0.55}" fill="${tongue}"/>`; break;
    case 'sad': closed = `<path d="M${cx - w / 2},${cy + 5} Q${cx},${cy - h * 0.6} ${cx + w / 2},${cy + 5}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`; break;
    case 'angry': closed = teeth
      ? `<rect x="${cx - w / 2}" y="${cy - 5}" width="${w}" height="11" rx="4" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/><path d="M${cx - w / 2},${cy + 0.5} H${cx + w / 2} M${cx - w / 6},${cy - 5} V${cy + 6} M${cx + w / 6},${cy - 5} V${cy + 6}" stroke="${stroke}" stroke-width="1.6"/>`
      : `<path d="M${cx - w / 2},${cy + 4} Q${cx},${cy - h * 0.45} ${cx + w / 2},${cy + 4}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`; break;
    case 'shock': closed = `<ellipse cx="${cx}" cy="${cy + 2}" rx="${w * 0.18}" ry="${w * 0.24}" fill="${inside}" stroke="${stroke}" stroke-width="${sw * 0.8}"/>`; break;
    case 'smug': closed = `<path d="M${cx - w / 2},${cy + 1} Q${cx},${cy + h * 0.45} ${cx + w / 2},${cy - 5}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`; break;
    case 'worried': closed = `<path d="M${cx - w / 2},${cy + 2} q${w / 6},-5 ${w / 3},0 t${w / 3},0 t${w / 3},0" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`; break;
    case 'determined': closed = `<path d="M${cx - w / 2},${cy} Q${cx},${cy + h * 0.25} ${cx + w / 2},${cy - 2}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`; break;
    default: closed = `<path d="M${cx - w / 2.4},${cy} Q${cx},${cy + h * 0.5} ${cx + w / 2.4},${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  const oh = mood === 'shock' ? w * 0.75 : mood === 'angry' ? w * 0.55 : w * 0.62;
  const ow = mood === 'shock' ? w * 0.55 : w;
  const open = `<path d="M${cx - ow / 2},${cy - 3} Q${cx},${cy - 6} ${cx + ow / 2},${cy - 3} Q${cx + ow / 2},${cy + oh} ${cx},${cy + oh} Q${cx - ow / 2},${cy + oh} ${cx - ow / 2},${cy - 3}Z" fill="${inside}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M${cx - ow * 0.26},${cy + oh * 0.8} Q${cx},${cy + oh * 0.35} ${cx + ow * 0.26},${cy + oh * 0.8} Q${cx},${cy + oh * 0.98} ${cx - ow * 0.26},${cy + oh * 0.8}Z" fill="${tongue}"/>
    ${teeth ? `<path d="M${cx - ow * 0.4},${cy - 2.5} H${cx + ow * 0.4} V${cy + 3} H${cx - ow * 0.4}Z" fill="#fff"/>` : ''}`;
  return `<g class="pt-mc">${closed}</g><g class="pt-mo">${open}</g>`;
}

function blush(pos, r = 9, color = '#ff7f9a', op = 0.45) {
  return pos.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="${color}" opacity="${op}"/>`).join('');
}

// ---- characters ------------------------------------------------------------------------------
function kai(id, mood, ink, look = {}) {
  const I = ink, IL = shade(ink, 0.35), ID = shade(ink, -0.3);
  const skin = look.skin || '#f4c29b', top = look.top || '#27325e';
  const eyePos = [[80, 118], [120, 118]];
  return `
  <g class="pt-body">
    <path d="M28,200 C30,172 58,160 100,160 C142,160 170,172 172,200Z" fill="${top}" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M78,162 Q100,178 122,162" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <rect x="89" y="146" width="22" height="20" rx="8" fill="${shade(skin, -0.12)}"/>
    <!-- side tentacle hair -->
    <path d="M52,104 C38,128 40,160 52,184 C60,188 68,184 66,176 C58,156 58,132 66,112Z" fill="${I}" stroke="${ID}" stroke-width="3"/>
    <path d="M148,104 C162,128 160,160 148,184 C140,188 132,184 134,176 C142,156 142,132 134,112Z" fill="${I}" stroke="${ID}" stroke-width="3"/>
    ${[132, 148, 164].map((y) => `<circle cx="${57 + (y - 132) * 0.05}" cy="${y}" r="3.2" fill="${IL}"/><circle cx="${143 - (y - 132) * 0.05}" cy="${y}" r="3.2" fill="${IL}"/>`).join('')}
    <!-- face -->
    <ellipse cx="100" cy="116" rx="47" ry="45" fill="${skin}" stroke="${INK_DARK}" stroke-width="3"/>
    <ellipse cx="54" cy="120" rx="6" ry="9" fill="${skin}" stroke="${INK_DARK}" stroke-width="2.5"/>
    <ellipse cx="146" cy="120" rx="6" ry="9" fill="${skin}" stroke="${INK_DARK}" stroke-width="2.5"/>
    ${eyes(id, eyePos, { r: 13, mood, iris: look.eye || '#3a2616', lid: skin })}
    ${blush([[70, 136], [130, 136]])}
    ${mouth(100, 140, 22, { mood })}
    <!-- mantle cap -->
    <path d="M50,108 C46,58 76,34 100,34 C124,34 154,58 150,108 C140,96 128,92 116,98 C108,92 92,92 84,98 C72,92 60,96 50,108Z" fill="${I}" stroke="${ID}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M86,40 L100,6 L114,40Z" fill="${I}" stroke="${ID}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M60,62 C44,48 30,52 22,40 C40,34 58,40 70,52Z" fill="${I}" stroke="${ID}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M140,62 C156,48 170,52 178,40 C160,34 142,40 130,52Z" fill="${I}" stroke="${ID}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="84" cy="54" rx="16" ry="7" fill="#fff" opacity=".35" transform="rotate(-25 84 54)"/>
    ${brows(eyePos, { mood, dy: -19, color: ID, sw: 4 })}
  </g>`;
}

function brine(id, mood) {
  const shell = '#35b9a4', shellD = '#1b7f73', shellL = '#8fe8d4', club = '#ff7a3d', clubD = '#c24a1c';
  const eyePos = [[62, 70], [138, 70]];
  const raise = mood === 'angry' || mood === 'determined' ? -18 : mood === 'happy' || mood === 'laugh' ? -8 : 0;
  const clubArm = (x, side) => `
    <path d="M${100 + side * 30},178 C${100 + side * 50},176 ${x - side * 4},${172 + raise} ${x},${158 + raise}" fill="none" stroke="${clubD}" stroke-width="15" stroke-linecap="round"/>
    <path d="M${100 + side * 30},178 C${100 + side * 50},176 ${x - side * 4},${172 + raise} ${x},${158 + raise}" fill="none" stroke="${club}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="${x}" cy="${148 + raise}" rx="17" ry="21" fill="${club}" stroke="${INK_DARK}" stroke-width="3" transform="rotate(${side * -14} ${x} ${148 + raise})"/>
    <path d="M${x - 13},${146 + raise} Q${x},${152 + raise} ${x + 13},${146 + raise}" fill="none" stroke="${clubD}" stroke-width="3"/>
    <ellipse cx="${x - side * 5}" cy="${140 + raise}" rx="5" ry="7" fill="#fff" opacity=".35"/>`;
  return `
  <g class="pt-body">
    <!-- segmented thorax -->
    ${[0, 1, 2].map((i) => `<path d="M${52 - i * 8},${200 - i * 0} C${50 - i * 6},${176 - i * 14} ${150 + i * 6},${176 - i * 14} ${148 + i * 8},200Z" fill="${i % 2 ? shell : shellD}" stroke="${INK_DARK}" stroke-width="3" transform="translate(0 ${-i * 12})"/>`).reverse().join('')}
    <!-- antennae -->
    <path d="M88,86 C70,40 40,26 16,30" fill="none" stroke="${clubD}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M112,86 C130,40 160,26 184,30" fill="none" stroke="${clubD}" stroke-width="3.5" stroke-linecap="round"/>
    <!-- eye stalks -->
    <path d="M84,100 C76,90 70,84 64,78" stroke="${shellD}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <path d="M116,100 C124,90 130,84 136,78" stroke="${shellD}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <!-- head carapace -->
    <path d="M52,112 C50,86 70,78 100,78 C130,78 150,86 148,112 C146,142 128,152 100,152 C72,152 54,142 52,112Z" fill="${shell}" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M100,80 L100,100" stroke="${shellD}" stroke-width="3"/>
    <path d="M64,98 Q100,88 136,98" fill="none" stroke="${shellD}" stroke-width="3"/>
    <ellipse cx="76" cy="96" rx="12" ry="5" fill="${shellL}" opacity=".5" transform="rotate(-15 76 96)"/>
    <!-- scar -->
    <path d="M122,98 L130,106 L125,110 L134,120 L128,123 L136,132" fill="none" stroke="#e9fff8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <!-- mustache + mouth -->
    ${mouth(100, 136, 18, { mood, inside: '#3a0f1e' })}
    <path d="M100,124 C88,114 66,114 58,128 C66,126 70,134 80,132 C88,131 94,128 100,126 C106,128 112,131 120,132 C130,134 134,126 142,128 C134,114 112,114 100,124Z" fill="#f6f4ee" stroke="${INK_DARK}" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- captain's hat -->
    <g transform="rotate(-6 100 60)">
      <path d="M62,76 C60,50 76,36 100,36 C124,36 140,50 138,76Z" fill="#1d2554" stroke="${INK_DARK}" stroke-width="3"/>
      <rect x="62" y="64" width="76" height="11" fill="#f5c542" stroke="${INK_DARK}" stroke-width="2.5"/>
      <path d="M56,80 Q100,68 144,80 Q146,90 132,88 Q100,82 68,88 Q54,90 56,80Z" fill="#10132b" stroke="${INK_DARK}" stroke-width="2.5"/>
      <circle cx="100" cy="52" r="9" fill="#f5c542" stroke="${INK_DARK}" stroke-width="2"/>
      <path d="M100,46 V58 M95,50 H105 M94,55 Q100,61 106,55" stroke="#1d2554" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="84" cy="46" rx="10" ry="4" fill="#fff" opacity=".2"/>
    </g>
    <!-- stalk eyes (banded) -->
    ${eyes(id, eyePos, { r: 15, mood, iris: '#3f7d2c', lid: shell, white: '#f5ffd8', look: [0, 1] })}
    ${eyePos.map(([x, y]) => `<path d="M${x - 12},${y + 7} Q${x},${y + 10} ${x + 12},${y + 7}" stroke="${shellD}" stroke-width="2" fill="none" opacity=".6"/>`).join('')}
    ${clubArm(44, -1)}${clubArm(156, 1)}
  </g>`;
}

function pix(id, mood) {
  const eyePos = [[80, 100], [120, 100]];
  const glow = mood === 'angry' ? '#ff5f7a' : mood === 'shock' ? '#fff27a' : '#ff8ae6';
  const tent = (x, k) => `<path d="M${x},122 C${x + 10 * k},140 ${x - 12 * k},158 ${x + 6 * k},176 S${x - 8 * k},196 ${x + 2 * k},206" fill="none" stroke="url(#${id}-tg)" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
  return `
  <defs>
    <radialGradient id="${id}-bell" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2fd"/><stop offset=".35" stop-color="${glow}"/><stop offset=".8" stop-color="#8b5cff"/><stop offset="1" stop-color="#4b2fbf"/></radialGradient>
    <linearGradient id="${id}-tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ff0"/><stop offset="1" stop-color="#59e3ff" stop-opacity=".2"/></linearGradient>
    <radialGradient id="${id}-halo"><stop offset="0" stop-color="${glow}" stop-opacity=".7"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="pt-body">
    <circle class="pt-glow" cx="100" cy="95" r="88" fill="url(#${id}-halo)"/>
    ${tent(64, 1)}${tent(82, -1)}${tent(100, 1)}${tent(118, -1)}${tent(136, 1)}
    <path d="M86,122 C80,146 98,158 90,184 M114,122 C120,146 102,158 110,184" fill="none" stroke="#ffd1f7" stroke-width="9" stroke-linecap="round" opacity=".55"/>
    <!-- bell -->
    <path d="M40,120 C36,62 70,40 100,40 C130,40 164,62 160,120 Q150,130 140,122 Q130,132 120,122 Q110,132 100,122 Q90,132 80,122 Q70,132 60,122 Q50,130 40,120Z" fill="url(#${id}-bell)" stroke="#fff" stroke-opacity=".7" stroke-width="3" opacity=".96"/>
    <ellipse cx="78" cy="62" rx="18" ry="9" fill="#fff" opacity=".45" transform="rotate(-22 78 62)"/>
    ${[[60, 84], [140, 86], [70, 112], [130, 112], [100, 60]].map(([x, y]) => `<circle class="pt-glow" cx="${x}" cy="${y}" r="3" fill="#fff" opacity=".8"/>`).join('')}
    ${eyes(id, eyePos, { r: 13, mood, iris: '#3b1a78', lid: '#ff9fe8', look: [1.5, 1] })}
    ${blush([[66, 114], [134, 114]], 8, '#ff3fa8', 0.5)}
    ${mouth(100, 116, 18, { mood, inside: '#4a1250' })}
    ${brows(eyePos, { mood, dy: -18, color: '#5a2bb0', sw: 3.5 })}
    <!-- headphones -->
    <path d="M36,100 C34,34 166,34 164,100" fill="none" stroke="#231c3c" stroke-width="10" stroke-linecap="round"/>
    <path d="M36,100 C34,34 166,34 164,100" fill="none" stroke="#59e3ff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
    <line x1="126" y1="40" x2="140" y2="14" stroke="#231c3c" stroke-width="3.5"/>
    <circle class="pt-blink" cx="140" cy="13" r="5" fill="#ff3b4f"/>
    <rect x="22" y="84" width="22" height="36" rx="10" fill="#231c3c" stroke="#59e3ff" stroke-width="3"/>
    <rect x="156" y="84" width="22" height="36" rx="10" fill="#231c3c" stroke="#59e3ff" stroke-width="3"/>
    <path d="M34,116 C38,138 56,142 72,134" fill="none" stroke="#231c3c" stroke-width="4" stroke-linecap="round"/>
    <circle cx="74" cy="133" r="6" fill="#231c3c" stroke="#59e3ff" stroke-width="2"/>
  </g>`;
}

function murkwell(id, mood) {
  const skin = '#4b3f6e', skinD = '#2c2447', skinL = '#6e5f9a';
  const angry = mood === 'angry';
  const lure = angry ? '#ff5a2a' : mood === 'smug' || mood === 'laugh' ? '#ffe98a' : '#cfd6a8';
  const lureGlow = angry ? 0.95 : mood === 'smug' ? 0.45 : 0.2;
  const eyePos = [[76, 92], [124, 90]];
  const jawDrop = mood === 'shock' || mood === 'laugh' ? 8 : 0;
  const teethTop = [58, 72, 86, 114, 128, 142].map((x) => `<path d="M${x - 5},${122} L${x},${134} L${x + 5},${122}Z" fill="#f4efe0" stroke="${INK_DARK}" stroke-width="1.5" stroke-linejoin="round"/>`).join('');
  const teethBot = [50, 66, 82, 100, 118, 134, 150].map((x) => `<path d="M${x - 6},${150 + jawDrop} L${x},${134 + jawDrop} L${x + 6},${150 + jawDrop}Z" fill="#fffaf0" stroke="${INK_DARK}" stroke-width="1.5" stroke-linejoin="round"/>`).join('');
  return `
  <defs><radialGradient id="${id}-lg"><stop offset="0" stop-color="${lure}" stop-opacity="1"/><stop offset=".35" stop-color="${lure}" stop-opacity=".6"/><stop offset="1" stop-color="${lure}" stop-opacity="0"/></radialGradient></defs>
  <g class="pt-body">
    <!-- suit -->
    <path d="M20,200 C26,172 60,164 100,164 C140,164 174,172 180,200Z" fill="#26223a" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M78,166 L100,200 L122,166Z" fill="#f2efe8"/>
    <path d="M94,172 L106,172 L110,200 L90,200Z" fill="#7b3be0"/>
    <path d="M60,168 L84,200 L70,200 L50,172Z M140,168 L116,200 L130,200 L150,172Z" fill="#383252"/>
    <circle cx="140" cy="186" r="4" fill="#c8ff3a"/>
    <!-- head -->
    <ellipse cx="100" cy="116" rx="74" ry="56" fill="${skin}" stroke="${INK_DARK}" stroke-width="3"/>
    ${[[60, 84], [140, 80], [150, 110], [52, 110], [84, 70], [120, 68]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${skinL}" opacity=".7"/>`).join('')}
    <!-- mouth -->
    <path d="M36,122 Q100,112 164,122 Q160,${160 + jawDrop} 100,${164 + jawDrop} Q40,${160 + jawDrop} 36,122Z" fill="#1c0f24" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M50,130 Q100,${168 + jawDrop} 150,130" fill="#471a3a"/>
    ${teethTop}
    <g class="pt-jaw">${teethBot}
    <path d="M36,122 Q100,${170 + jawDrop} 164,122 Q166,${176 + jawDrop} 100,${180 + jawDrop} Q34,${176 + jawDrop} 36,122Z" fill="${skinD}" stroke="${INK_DARK}" stroke-width="3"/></g>
    <!-- eyes + monocle -->
    ${eyes(id, eyePos, { r: 11, mood, iris: '#e8c22a', lid: skin, white: '#fff8d8', look: [1, 0] })}
    ${brows(eyePos, { mood, dy: -14, color: skinD, sw: 5 })}
    <circle cx="124" cy="90" r="15" fill="none" stroke="#f5c542" stroke-width="3.5"/>
    <path d="M138,96 C150,110 150,130 142,148" fill="none" stroke="#f5c542" stroke-width="1.8"/>
    <!-- top hat -->
    <g transform="rotate(8 100 50)">
      <rect x="66" y="8" width="68" height="50" rx="4" fill="#15121f" stroke="${INK_DARK}" stroke-width="3"/>
      <rect x="66" y="42" width="68" height="10" fill="#7b3be0"/>
      <path d="M50,60 Q100,50 150,60 Q152,68 140,68 Q100,62 60,68 Q48,68 50,60Z" fill="#15121f" stroke="${INK_DARK}" stroke-width="3"/>
      <rect x="72" y="12" width="10" height="28" rx="3" fill="#fff" opacity=".12"/>
    </g>
    <!-- lure -->
    <path d="M112,12 C120,-6 170,-2 172,34" fill="none" stroke="${skinD}" stroke-width="5" stroke-linecap="round"/>
    <g class="pt-lure ${angry ? 'hot' : ''}">
      <circle cx="172" cy="40" r="${angry ? 30 : 22}" fill="url(#${id}-lg)" opacity="${lureGlow}"/>
      <circle cx="172" cy="40" r="9" fill="${lure}" stroke="${INK_DARK}" stroke-width="2.5"/>
      <circle cx="169" cy="37" r="3" fill="#fff" opacity=".85"/>
    </g>
  </g>`;
}

function dredge(id, mood) {
  const tar = '#1e1630', tarL = '#3d2f5c';
  const eyePos = [[78, 110], [122, 110]];
  return `
  <g class="pt-body">
    <!-- hi-vis vest -->
    <path d="M14,200 C18,170 56,158 100,158 C144,158 182,170 186,200Z" fill="${tar}" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M30,200 C34,178 52,166 76,162 L86,200Z M170,200 C166,178 148,166 124,162 L114,200Z" fill="#ff7a1a" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M40,186 L84,184 M160,186 L116,184" stroke="#e8f0ff" stroke-width="6"/>
    <!-- head -->
    <path d="M36,128 C30,80 60,66 100,66 C140,66 170,80 164,128 C160,158 136,168 100,168 C64,168 40,158 36,128Z" fill="${tar}" stroke="${INK_DARK}" stroke-width="3"/>
    <ellipse cx="68" cy="92" rx="16" ry="7" fill="${tarL}" opacity=".8" transform="rotate(-20 68 92)"/>
    ${eyes(id, eyePos, { r: 12, mood, iris: '#9ee02a', lid: tar, white: '#e9ffb8', look: [0, 1], stroke: '#0b0714' })}
    ${brows(eyePos, { mood, dy: -16, color: tarL, sw: 7 })}
    ${mouth(100, 140, 34, { mood, stroke: '#0b0714', inside: '#3a0f2a', teeth: true })}
    <path d="M78,137 L82,131 L86,137 M114,137 L118,131 L122,137" fill="#fffaf0" stroke="#0b0714" stroke-width="1.5"/>
    <!-- hardhat -->
    <path d="M40,80 C40,40 68,26 100,26 C132,26 160,40 160,80Z" fill="#ffc53a" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M100,28 V78 M76,32 C72,46 70,62 70,78 M124,32 C128,46 130,62 130,78" stroke="#d99a16" stroke-width="3" fill="none"/>
    <path d="M28,82 Q100,68 172,82 Q174,92 160,90 Q100,82 40,90 Q26,92 28,82Z" fill="#f2b21e" stroke="${INK_DARK}" stroke-width="3"/>
    <circle cx="100" cy="50" r="10" fill="#fffbe0" stroke="${INK_DARK}" stroke-width="2.5"/>
    <circle cx="100" cy="50" r="5" fill="#fff" />
    <circle cx="136" cy="60" r="7" fill="#7b3be0"/><circle cx="136" cy="60" r="2.5" fill="#c8ff3a"/>
    <ellipse cx="72" cy="44" rx="12" ry="5" fill="#fff" opacity=".35" transform="rotate(-25 72 44)"/>
  </g>`;
}

function shelly(id, mood) {
  const crab = '#ff6b4a', crabD = '#c43e25';
  const eyePos = [[72, 94], [114, 90]];
  const wave = mood === 'happy' || mood === 'laugh' ? -16 : mood === 'angry' ? 10 : 0;
  return `
  <g class="pt-body">
    <!-- decorated shell -->
    <circle cx="132" cy="96" r="60" fill="#ffa6c4" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M132,96 m0,-10 a10,10 0 1,1 -10,10 a21,21 0 1,1 21,21 a32,32 0 1,1 -32,-32 a45,45 0 1,1 45,45" fill="none" stroke="#e0628f" stroke-width="5" stroke-linecap="round"/>
    <path d="M166,44 l5,12 13,1 -10,8 4,13 -12,-7 -12,7 4,-13 -10,-8 13,-1Z" fill="#ffe14d" stroke="${INK_DARK}" stroke-width="2"/>
    <path d="M182,116 c0,-8 12,-8 12,0 c0,8 -12,14 -12,14 c0,0 -12,-6 -12,-14 c0,-8 12,-8 12,0Z" fill="#ff3b5c" stroke="${INK_DARK}" stroke-width="2" transform="translate(-6 0)"/>
    <path d="M158,134 l10,-16 -4,12 10,-2 -14,18 4,-12Z" fill="#59e3ff" stroke="${INK_DARK}" stroke-width="2"/>
    <circle cx="112" cy="40" r="10" fill="#8ede6a" stroke="${INK_DARK}" stroke-width="2"/><path d="M108,38 h1 M116,38 h1 M108,43 q4,4 8,0" stroke="${INK_DARK}" stroke-width="2" stroke-linecap="round"/>
    <!-- crab body peeking out -->
    <path d="M34,200 C30,158 52,126 92,124 C132,124 150,156 148,200Z" fill="${crab}" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M40,168 C64,178 120,178 144,168" fill="none" stroke="${crabD}" stroke-width="3"/>
    <ellipse cx="66" cy="140" rx="14" ry="6" fill="#fff" opacity=".3" transform="rotate(-20 66 140)"/>
    <path d="M78,128 L74,106 M106,126 L112,102" stroke="${crabD}" stroke-width="8" stroke-linecap="round"/>
    ${eyes(id, eyePos, { r: 13, mood, iris: '#2b1d14', lid: crab, look: [1, 1] })}
    ${brows(eyePos, { mood, dy: -19, color: crabD, sw: 4 })}
    ${blush([[66, 156], [120, 156]], 9)}
    ${mouth(93, 154, 22, { mood, inside: '#5a1422' })}
    <!-- big claw holding a wrench -->
    <g transform="rotate(${wave} 44 186)">
      <rect x="30" y="96" width="11" height="50" rx="4" fill="#aab3c8" stroke="${INK_DARK}" stroke-width="2.5" transform="rotate(-14 35 120)"/>
      <path d="M22,98 a12,12 0 1,1 20,-4 l-5,6 -7,-3Z" fill="#aab3c8" stroke="${INK_DARK}" stroke-width="2.5"/>
      <path d="M24,190 C6,172 12,142 38,142 C58,142 64,166 52,188Z" fill="${crab}" stroke="${INK_DARK}" stroke-width="3"/>
      <path d="M30,156 C40,150 52,154 56,164" fill="none" stroke="${crabD}" stroke-width="3"/>
    </g>
  </g>`;
}

function otter(id, mood, o) {
  const fur = o.fur, furD = shade(fur, -0.3), face = o.face;
  const eyePos = [[80, 104], [120, 104]];
  const stripes = [];
  for (let x = 20; x < 190; x += 18) stripes.push(`<rect x="${x}" y="160" width="9" height="44" fill="${INK_DARK}"/>`);
  return `
  <defs><clipPath id="${id}-shirt"><path d="M20,200 C24,174 56,162 100,162 C144,162 176,174 180,200Z"/></clipPath></defs>
  <g class="pt-body">
    <path d="M20,200 C24,174 56,162 100,162 C144,162 176,174 180,200Z" fill="#f4f4f4" stroke="${INK_DARK}" stroke-width="3"/>
    <g clip-path="url(#${id}-shirt)">${stripes.join('')}</g>
    <path d="M78,164 L100,182 L122,164" fill="${INK_DARK}"/>
    <path d="M70,166 C76,184 92,194 104,194" fill="none" stroke="${o.cord}" stroke-width="3"/>
    <rect x="98" y="188" width="20" height="10" rx="4" fill="#c9d2e0" stroke="${INK_DARK}" stroke-width="2"/>
    <!-- head -->
    <circle cx="52" cy="72" r="15" fill="${fur}" stroke="${INK_DARK}" stroke-width="3"/><circle cx="52" cy="72" r="7" fill="#e89a8a"/>
    <circle cx="148" cy="72" r="15" fill="${fur}" stroke="${INK_DARK}" stroke-width="3"/><circle cx="148" cy="72" r="7" fill="#e89a8a"/>
    <path d="M40,110 C36,68 64,52 100,52 C136,52 164,68 160,110 C158,146 134,164 100,164 C66,164 42,146 40,110Z" fill="${fur}" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M58,112 C56,88 76,82 100,86 C124,82 144,88 142,112 C142,140 124,156 100,156 C76,156 58,140 58,112Z" fill="${face}"/>
    ${eyes(id, eyePos, { r: 11, mood, iris: '#1c120a', lid: face, look: [1, 1] })}
    ${o.glasses ? eyePos.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="${INK_DARK}" stroke-width="3.5"/>`).join('') + `<path d="M95,104 H105" stroke="${INK_DARK}" stroke-width="3"/>` : ''}
    ${brows(eyePos, { mood, dy: o.glasses ? -22 : -17, color: furD, sw: o.bushy ? 7 : 4 })}
    <path d="M90,122 Q100,116 110,122 Q108,132 100,133 Q92,132 90,122Z" fill="#1a1010"/>
    <ellipse cx="96" cy="122" rx="3" ry="1.5" fill="#fff" opacity=".6"/>
    ${[-1, 1].map((s) => `<path d="M${100 + s * 14},132 l${s * 28},-6 M${100 + s * 14},136 l${s * 28},2 M${100 + s * 14},140 l${s * 24},9" stroke="${furD}" stroke-width="1.8" stroke-linecap="round"/>`).join('')}
    ${mouth(100, 144, 16, { mood, inside: '#4a1414' })}
    ${blush([[70, 132], [130, 132]], 7)}
    ${o.hat}
  </g>`;
}

function ottoP(id, mood) {
  return otter(id, mood, {
    fur: '#8a5a3c', face: '#ecd2ad', cord: '#e0453a', bushy: true,
    hat: `<path d="M56,66 C56,40 76,30 100,30 C124,30 144,40 144,66Z" fill="#1b1830" stroke="${INK_DARK}" stroke-width="3"/>
      <path d="M100,32 V64" stroke="#3a3558" stroke-width="3"/>
      <path d="M96,64 Q130,58 164,72 Q160,80 146,76 Q120,68 96,72Z" fill="#f4f4f4" stroke="${INK_DARK}" stroke-width="2.5"/>`,
  });
}

function tillyP(id, mood) {
  return otter(id, mood, {
    fur: '#b07c52', face: '#f3dfbf', cord: '#2fae62', glasses: true,
    hat: `<path d="M54,70 Q100,52 146,70 L150,78 Q100,62 50,78Z" fill="#2fae62" stroke="${INK_DARK}" stroke-width="2.5"/>
      <path d="M50,76 Q100,60 150,76 Q166,84 150,88 Q100,74 50,88 Q36,84 50,76Z" fill="#2fae62" stroke="${INK_DARK}" stroke-width="2.5"/>
      <rect x="146" y="50" width="30" height="7" rx="3" fill="#ffd23f" stroke="${INK_DARK}" stroke-width="2" transform="rotate(-35 160 54)"/>
      <path d="M150,70 l-6,4" stroke="#ff9f9f" stroke-width="4" stroke-linecap="round"/>`,
  });
}

function paP(id, mood) {
  const shake = mood === 'angry' || mood === 'shock';
  return `
  <g class="pt-body">
    <rect x="94" y="120" width="12" height="80" fill="#4a4660" stroke="${INK_DARK}" stroke-width="3"/>
    <path d="M40,70 L120,40 L120,130 L40,100Z" fill="#8f8aa8" stroke="${INK_DARK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M120,40 C150,40 170,60 170,85 C170,110 150,130 120,130Z" fill="#6c6788" stroke="${INK_DARK}" stroke-width="3"/>
    <rect x="22" y="68" width="22" height="34" rx="6" fill="#4a4660" stroke="${INK_DARK}" stroke-width="3"/>
    <circle cx="146" cy="85" r="18" fill="#26223a"/>
    <path d="M132,85 Q146,70 160,85 Q146,100 132,85Z" fill="#c8ff3a"/><circle cx="146" cy="85" r="5" fill="#26223a"/>
    <g class="pt-mo">${[0, 1, 2].map((i) => `<path d="M${176 + i * 8},${60 - i * 6} Q${188 + i * 8},85 ${176 + i * 8},${110 + i * 6}" fill="none" stroke="#c8ff3a" stroke-width="3" stroke-linecap="round" opacity="${0.8 - i * 0.2}"/>`).join('')}</g>
    <g class="pt-mc"></g>
    ${shake ? '<path d="M60,40 l6,-10 M80,32 l2,-12" stroke="#ff5a2a" stroke-width="4" stroke-linecap="round"/>' : ''}
  </g>`;
}

const DRAW = {
  kai: (id, mood, ink) => kai(id, mood, ink),
  kid: (id, mood) => kai(id, mood, '#2fd0ff', { skin: '#c98a5e', top: '#e0453a', eye: '#1a3a5a' }),
  brine, pix, murkwell, dredge, shelly, otto: ottoP, tilly: tillyP, pa: paP,
};

export const PORTRAIT_COLORS = {
  kai: '#ff8a1f', kid: '#2fd0ff', brine: '#3fd6bd', pix: '#ff5fd2', murkwell: '#a77bff', dredge: '#ffb52e',
  shelly: '#ff8fae', otto: '#ffd23f', tilly: '#7ee08f', pa: '#b4addb',
};

/**
 * @param {string} who
 * @param {object} o  mood, ink (hex for Kai's mantle), bg (default true), uid
 */
export function portraitSVG(who, o = {}) {
  const draw = DRAW[who];
  if (!draw) return '';
  const id = o.uid || `pt${++UID}`;
  const mood = o.mood || 'neutral';
  const ink = o.ink || '#ff8a1f';
  const color = who === 'kai' ? ink : PORTRAIT_COLORS[who] || '#ffffff';
  const bg = o.bg === false ? '' : backdrop(id, color);
  return `<svg class="pt pt-${who} mood-${mood}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bg}${draw(id, mood, ink)}</svg>`;
}

export const PORTRAIT_IDS = Object.keys(DRAW);
