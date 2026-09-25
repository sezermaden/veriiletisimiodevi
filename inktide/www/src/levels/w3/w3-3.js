// 3-3 Vat Valley — a canyon of refinery blocks whose floor is one open vat after another, each
// brimming with liquid Murk (touching it = splat). North (−Z):
//   Spawn deck → VAT A: a grate catwalk straight over the sludge under a Buzzdrone (w3-3.vats)
//   → deck F1 → VAT B: three sponge stepping stones that must be inked big (w3-3.sponge) while
//     Gloopers and a Bomblob on the far deck try to wring them small → deck F2 (CP1)
//   → VAT C: an ink-powered platform crossing a 24 m vat under drones and a Snipe Eel → F3 (CP2)
//   → VAT D: climb 7 m to its rim walkway, clear the rim crew (barrier 'rim') and launch
//   → SERPENT TERRACE (CP3, w3-3.pa): the final crew guards the Prism Capsule on a pier over the
//     sleeping Serpent's colossal vat (barrier 'final').
// Decks 0, vat catwalks 1.35, Vat D rim 7.12, terrace 4. Lake −2.6, killY −3.6.
import { block, box, cyl, stairs, ent, murk } from '../kit.js';
import { island, catwalk, tank, vatRing, lake, D } from './refinery-kit.js';

const PI = Math.PI;
const SL = -2.6;
const CW = 1.35;          // catwalk / pier height over the vats
const RIM = 7.12;         // Vat D rim walkway
const TY = 4;             // serpent terrace

const steel = (c = '#6f7a8c', o = {}) => ({ mat: 'metal', color: c, ...o });
const conc = (c = '#d2d4da', o = {}) => ({ mat: 'concrete', color: c, ...o });
const pier = (cz, d, o = {}) => block(0, cz, o.w ?? 4, d, -3, CW + 3, steel(o.color || '#5f6b7c'));

/** Valley wall block (unpaintable scenery). */
const wall = (cx, cz, w, d, h, c) => [
  block(cx, cz, w, d, -3, h + 3, { mat: 'metal', color: c, paint: false }),
  block(cx, cz, w + 0.6, d + 0.6, h, 0.5, { mat: 'concrete', color: '#7d8492', paint: false }),
];

/** A decorative vat full of sludge (ring + pool entity). */
function sideVat(cx, cz, r, rim, pools) {
  pools.push({ type: 'sludge-pool', pos: [cx, rim - 0.5, cz], radius: r - 0.55, color: '#5a2fb0', glow: '#a77bff' });
  return vatRing(cx, cz, r, 0.6, -3, rim, { color: '#8d93a6', paint: false, rimColor: '#c7a14a' });
}
const sidePools = [];

const brushes = [
  // ---------------- spawn deck ----------------
  ...island(0, 3, 16, 16, 0, { color: '#5f6b7c', capColor: '#c9ccd4' }),
  ...tank(-5.6, 8.6, 1.5, 0, 4, { color: '#c7a14a' }),
  block(5.6, 8, 3, 3, 0, 1.1, { mat: 'container', color: '#3a8f7a' }),
  stairs(-1.5, 0, -6.2, 1.5, CW, -3.2, '-z', steel('#8894a0')),
  // ---------------- Vat A ----------------
  ...vatRing(0, -14, 8, 0.8, -3, 1.2, { color: '#9aa4b4' }),
  ...catwalk(-1.4, -22.3, 1.4, -6.1, CW, { base: -3, every: 4 }),
  stairs(-1.5, 0, -25.3, 1.5, CW, -22.2, '+z', steel('#8894a0')),
  // ---------------- deck F1 ----------------
  ...island(0, -29, 18, 8, 0, { color: '#6f7a8c', capColor: '#c3c8d2' }),
  block(-6.5, -27.5, 1, 2.6, 0, 1.1, conc('#d6d0c6')),
  stairs(-2, 0, -33.2, 2, CW, -30.6, '-z', steel('#8894a0')),
  // ---------------- Vat B (sponges) ----------------
  ...vatRing(0, -42, 9, 0.8, -3, 1.2, { color: '#8d93a6' }),
  pier(-34.7, 3.4),
  pier(-49.9, 2.2),
  ...[-38.8, -42.6, -46.4].map((z) => cyl(0, -3, z, 0.6, 2.7, { mat: 'metal', color: '#2b3142', paint: false, sides: 10 })),
  stairs(-2, 0, -53.6, 2, CW, -51, '+z', steel('#8894a0')),
  // ---------------- deck F2 ----------------
  ...island(0, -58, 20, 9, 0, { color: '#5f6b7c', capColor: '#c3c8d2' }),
  block(-6, -56, 2.6, 1, 0, 1.1, conc('#d6d0c6')),
  block(6.2, -60.6, 1, 2.6, 0, 1.1, conc('#d6d0c6')),
  stairs(-2, 0, -65.4, 2, CW, -62.6, '-z', steel('#8894a0')),
  // ---------------- Vat C (ink mover) ----------------
  ...vatRing(0, -76, 12, 1, -3, 1.2, { color: '#9aa4b4' }),
  pier(-66.5, 2.2),
  pier(-85.5, 2.2),
  stairs(-2, 0, -89.6, 2, CW, -86.6, '+z', steel('#8894a0')),
  // ---------------- deck F3 ----------------
  ...island(0, -94, 20, 9, 0, { color: '#6f7a8c', capColor: '#c3c8d2' }),
  ...island(0, -100.3, 12, 4, 0, { color: '#6f7a8c', capColor: '#c3c8d2' }),
  block(6.5, -95, 3, 3, 0, 3, steel('#4a5163')),                       // sniper tower
  block(-4.5, -96.5, 1, 2.6, 0, 1.1, conc('#d6d0c6')),
  // ---------------- Vat D (climb + rim walk) ----------------
  ...vatRing(0, -110, 8, 2.4, -3, 7, { color: '#b9c2cf', sides: 24, rim: false }),
  ...vatRing(0, -110, 8, 2.48, 7, RIM, { color: '#ffc53a', sides: 24, rim: false }),   // flush rim cap: an overhanging lip would stop the climb
  cyl(0, 2.2, -110, 8.08, 0.35, { mat: 'metal', color: '#2b3142', paint: false, sides: 24, collide: false }),   // visual band only (climb face)
  block(-9.2, -110, 2.4, 4, -3, 6.5, steel('#51596b')),                 // maintenance ledge (postcard)
  block(0, -119, 3, 2.4, RIM - 0.4, 0.4, steel('#f2b134')),             // launch balcony
  // ---------------- Serpent terrace ----------------
  ...island(0, -132, 24, 12, TY, { color: '#5f6b7c', cap: 'tiles', capColor: '#d6dae2' }),
  ...tank(-9.4, -128.6, 1.6, TY, 4.2, { color: '#b9c2cf' }),
  ...tank(9.4, -128.4, 1.6, TY, 5, { color: '#4f9a6a' }),
  block(-4, -131.5, 2.8, 1, TY, 1.1, conc('#d6d0c6')),
  block(4.5, -133.6, 1, 2.8, TY, 1.1, conc('#d6d0c6')),
  ...vatRing(0, -160, 22, 1.2, -3, TY, { color: '#8d93a6', sides: 36, rimColor: '#ffc53a' }),
  block(0, -141, 6, 6, -3, TY + 3, steel('#51596b')),                   // capsule pier
  box(-3.3, TY, -144, -3, TY + 2.6, -138.3, { mat: 'glass', color: '#bfe8ff' }),
  box(3, TY, -144, 3.3, TY + 2.6, -138.3, { mat: 'glass', color: '#bfe8ff' }),
  cyl(0, TY, -142.2, 2.2, 0.3, { mat: 'tiles', color: '#8be04a', sides: 24 }),
  // ---------------- valley walls + gantries (scenery) ----------------
  ...wall(-34, -10, 10, 36, 14, '#4a5163'), ...wall(34, -14, 10, 40, 18, '#51596b'),
  ...wall(-34, -52, 10, 40, 20, '#565e70'), ...wall(34, -60, 10, 44, 13, '#4a5163'),
  ...wall(-34, -100, 10, 48, 16, '#4a5163'), ...wall(34, -104, 10, 40, 22, '#565e70'),
  ...wall(-36, -150, 12, 44, 24, '#51596b'), ...wall(36, -150, 12, 44, 19, '#4a5163'),
  box(-29, 15, -61.5, 29, 15.4, -58.5, { mat: 'grate', color: '#9aa4b4' }),
  box(-29, 12, -121.5, 29, 12.4, -118.5, { mat: 'grate', color: '#9aa4b4' }),
  ...sideVat(-19, -20, 6, 2.4, sidePools), ...sideVat(20, -40, 5, 1.6, sidePools),
  ...sideVat(-20, -76, 5.5, 3, sidePools), ...sideVat(21, -90, 6.5, 2.2, sidePools),
  ...sideVat(-21, -122, 5, 1.8, sidePools), ...sideVat(19, -118, 4.5, 3.4, sidePools),
];

const E = [lake(SL, 0, -90), ...sidePools];
const add = (...xs) => E.push(...xs);
add(
  // spawn + Vat A
  ent('pearl-trail', 0, 0, 6, { to: [0, 0, -1.5], count: 4 }),
  ent('trigger', 0, 0, -1.5, { size: [14, 3, 3], dialogue: 'w3-3.vats' }),
  ent('sludge-pool', 0, 0.3, -14, { radius: 7.15 }),
  ent('pearl-trail', 0, CW, -8.5, { to: [0, CW, -19.5], count: 5 }),
  ent('buzzdrone', 0, CW, -14, { alt: 4.6, group: 'a', patrol: [[-4, CW, -12], [4, CW, -16]] }),
  ent('glooper', -4.5, 0, -30, { group: 'a' }),
  ent('glooper', 5, 0, -30.5, { group: 'a' }),
  ent('crate', 7.4, 0, -27, { pearls: 2 }),
  ent('crate', -7.6, 0, -31.4, { size: 1, pearls: 2 }),
  // Vat B
  ent('trigger', 0, 0, -27, { size: [18, 3, 3], dialogue: 'w3-3.sponge', hint: 'Ink the sponges to puff them up, then hop across. Murk ink shrinks them!', hintTime: 6 }),
  ent('sludge-pool', 0, 0, -42, { radius: 8.15 }),
  ...[-38.8, -42.6, -46.4].map((z, i) => ent('sponge', 0, -0.3, z, { size: [2.3, 2.3, 2.3], id: 'spB' + i })),
  ent('pearl', 0, 2.0, -38.8), ent('pearl', 0, 2.0, -42.6), ent('pearl', 0, 2.0, -46.4),
  ent('glooper', -4.5, 0, -57, { group: 'b', aggro: 20 }),
  ent('glooper', 4, 0, -58.5, { group: 'b', aggro: 20 }),
  ent('bomblob', 0, 0, -61, { group: 'b', aggro: 22 }),
  ent('checkpoint', 1.4, 0, -55.2, { yaw: PI, id: 'cp1', radius: 2.4 }),
  ent('pearl-trail', -8.4, 0, -55, { to: [-8.4, 0, -61], count: 3 }),
  // Vat C
  ent('trigger', 0, 0, -61.5, { size: [8, 3, 2], hint: 'The ink-powered platform runs while you ride it. Hop on and hold still!', hintTime: 5 }),
  ent('sludge-pool', 0, 0.3, -76, { radius: 10.9 }),
  ent('mover', 0, CW, -69.4, { size: [3, 0.5, 3], path: [[0, CW, -69.4], [0, CW, -82.6]], speed: 2.4, activate: 'ink', return: true, mat: 'metal', id: 'moverC' }),
  ent('pearl-trail', 0, CW, -71.5, { to: [0, CW, -80.5], count: 5 }),
  ent('buzzdrone', -4, CW, -74, { alt: 5, group: 'c', patrol: [[-5, CW, -72], [-2, CW, -80]] }),
  ent('buzzdrone', 4, CW, -79, { alt: 5.6, group: 'c', patrol: [[5, CW, -80], [2, CW, -72]] }),
  ent('snipe-eel', 6.5, 3, -95, { group: 'c', aggro: 32 }),
  // F3 + Vat D
  ent('checkpoint', -1.4, 0, -91.2, { yaw: PI, id: 'cp2', radius: 2.4 }),
  ent('trigger', 0, 0, -97.5, { size: [12, 3, 3], objective: 'Climb the vat and clear its rim', hint: 'Paint the vat wall, then swim up it with {swim}.', hintTime: 5 }),
  ent('crate', 8.2, 0, -91.2, { pearls: 3 }),
  ent('sludge-pool', 0, 6.3, -110, { radius: 5.5 }),
  ent('shield-glooper', 0, RIM, -116.6, { group: 'rim' }),
  ent('glooper', -6.8, RIM, -110, { group: 'rim' }),
  ent('glooper', 6.8, RIM, -110, { group: 'rim' }),
  ent('murk-pod', -4.8, RIM, -114.8, { group: 'rim', max: 2, interval: 5 }),
  ent('murk-barrier', 0, RIM, -117.9, { size: [3, 3, 0.4], group: 'rim', id: 'bar-rim' }),
  // energy fence along the terrace's front: a squid leap off the rim would otherwise skip the rim crew
  ent('murk-barrier', 0, TY, -126.05, { size: [24.3, 4, 0.4], group: 'rim', id: 'bar-terrace' }),
  ent('pearl', 4.8, RIM, -105.2), ent('pearl', 6.8, RIM, -107), ent('pearl', 4.8, RIM, -114.8), ent('pearl', -4.8, RIM, -105.2),
  ent('launchpad', 0, RIM, -119.2, { id: 'pad-terrace', target: [0, TY, -128.6] }),
  // maintenance ledge (hidden, behind Vat D)
  ent('postcard', -9.2, 3.5, -111.4, { id: 'w3-3-postcard', title: 'Employee of the Month', text: 'Congratulations, Dredge! Twelve years without a single colour incident. Your prize: this postcard.' }),
  ent('pearl-trail', -9.2, 3.5, -108.4, { to: [-9.2, 3.5, -110], count: 3 }),
  ent('pearl-trail', -8, 0, -90.4, { to: [-8, 0, -97], count: 3 }),
  ent('pearl', 6.5, 3, -94.2), ent('pearl', 6.5, 3, -95.8),
  ent('pearl', -5.6, 4.5, 8.6),
  // Serpent terrace
  ent('trigger', 0, TY, -128.5, { size: [22, 3, 4], dialogue: 'w3-3.pa', objective: 'Clear the terrace and crack the Prism Capsule' }),
  ent('checkpoint', 2.0, TY, -129.6, { yaw: PI, id: 'cp3', radius: 2.4 }),
  ent('murk-pod', -8, TY, -134.4, { group: 'final', max: 2, interval: 5 }),
  ent('murk-pod', 8, TY, -135.6, { group: 'final', max: 2, interval: 5.5 }),
  ent('shield-glooper', -2.5, TY, -135.4, { group: 'final' }),
  ent('bomblob', 2, TY, -136.8, { group: 'final' }),
  ent('glooper', 5.5, TY, -131, { group: 'final' }),
  ent('rollerbrute', -8.5, TY, -130.4, { group: 'final', aggro: 16 }),
  ent('murk-barrier', 0, TY, -138.3, { size: [6, 4, 0.4], group: 'final', id: 'bar-final' }),
  ent('pearl-trail', -10.6, TY, -136.8, { to: [-6.6, TY, -136.8], count: 3 }),
  ent('pearl', -9.4, TY + 4.7, -128.6), ent('pearl', 9.4, TY + 5.5, -128.4),
  ent('pearl-trail', 10.6, TY, -130, { to: [10.6, TY, -136], count: 3 }),
  ent('prism-core', 0, TY + 0.3, -142.4, { id: 'core' }),
);
add(
  // spawn
  D('neon-sign', -5.4, 0, -4.2, { text: 'VAT VALLEY', color: '#b58cff', height: 3.4, pole: true, yaw: 0.25 }),
  D('lamp', -7.2, 0, -4.2, { yaw: PI / 4 }), D('lamp', 7.2, 0, -4.2, { yaw: -PI / 4 }),
  D('barrel', 3.2, 0, 10.3, { variant: 'toxic' }), D('barrel', 2.4, 0, 10.5, { variant: 'toxic' }), D('crate-stack', 5.6, 1.1, 8, { count: 2, yaw: 0.4 }),
  D('bench', -1.6, 0, 10.4, { yaw: PI, color: '#7d8a96' }), D('vending', 7.2, 0, 3, { yaw: -PI / 2, color: '#6a2bd9' }),
  D('speaker-tower', -7.2, 0, 2.4, { height: 2.8, color: '#b58cff', yaw: PI / 2 }),
  D('railing', -1.55, CW, -14, { yaw: PI / 2, length: 15.6, color: '#f2b134' }), D('railing', 1.55, CW, -14, { yaw: -PI / 2, length: 15.6, color: '#f2b134' }),
  // F1
  D('lamp', -8.4, 0, -25.8, { yaw: PI * 0.75, light: '#c8ffb0' }), D('lamp', 8.4, 0, -32.2, { yaw: -PI / 4, light: '#c8ffb0' }),
  D('barrel', -8.2, 0, -30, { variant: 'toxic' }), D('crate-stack', 7.8, 0, -31.6, { count: 2, yaw: -0.3 }),
  D('flag', -3.2, 0, -32.6, { color: '#6a2bd9' }), D('flag', 3.2, 0, -32.6, { color: '#6a2bd9' }),
  D('graffiti', -6.5, 0, -26.95, { text: 'KEEP IT PUFFY', size: 2.6, height: 0.6, color: '#ffd23f', color2: '#2fd6ff' }),
  // F2
  D('lamp', -9.4, 0, -54, { yaw: PI * 0.75 }), D('lamp', 9.4, 0, -62, { yaw: -PI / 4 }),
  D('barrel', -9.2, 0, -61.6, { variant: 'toxic' }), D('barrel', -8.5, 0, -62, { variant: 'toxic' }), D('crate-stack', 8.6, 0, -58.4, { count: 3, yaw: 1.1 }),
  D('neon-sign', 6.4, 0, -61.6, { text: 'VAT C', color: '#8be04a', height: 3.4, pole: true, yaw: -0.35 }),
  D('railing', 2.15, CW, -66.5, { yaw: -PI / 2, length: 2, color: '#f2b134' }), D('railing', -2.15, CW, -66.5, { yaw: PI / 2, length: 2, color: '#f2b134' }),
  // F3 + Vat D
  D('lamp', -9.4, 0, -90, { yaw: PI * 0.75 }), D('lamp', 9.4, 0, -97.8, { yaw: -PI / 4, light: '#c8ffb0' }),
  D('neon-sign', -8.2, 0, -98.2, { text: 'NO SQUIDS', color: '#ff5a3a', height: 2.6, pole: true, yaw: 0.3 }),
  D('barrel', 8.8, 0, -97.4), D('barrel', 9.2, 0, -96.4, { variant: 'toxic' }), D('crate-stack', -8.6, 0, -97.2, { count: 2 }),
  D('neon-sign', -4.6, 0, -99.2, { text: 'VAT D', color: '#ffc53a', height: 3.4, pole: true, yaw: 0.25 }),
  D('graffiti', 3.6, 0, -102.62, { style: 'arrow', size: 2, height: 1.4, color: '#8be04a', color2: '#ffffff', yaw: 0.46 }),
  D('antenna', 6.64, RIM, -113.98, { height: 2.4 }), D('lamp', -7.2, RIM, -106.6, { yaw: -PI / 4 }), D('lamp', 7.2, RIM, -106.6, { yaw: PI / 4 }),
  D('railing', 0, RIM, -120.1, { length: 3, color: '#f2b134' }),
  D('pipe', -9.2, 3.5, -112, { length: 2.2, radius: 0.28, height: 0.5, color: '#ff7ab8' }), D('lamp', -8.6, 3.5, -108.4, { yaw: -PI / 2, light: '#ffb3e6' }),
  // terrace
  D('neon-sign', -6.2, TY, -137.2, { text: 'DO NOT DISTURB', color: '#ff3fa4', height: 3, pole: true, yaw: 0.15 }),
  D('lamp', -11.4, TY, -126.6, { yaw: PI * 0.75 }), D('lamp', 11.4, TY, -137.4, { yaw: -PI / 4 }),
  D('speaker-tower', 11, TY, -132, { height: 3, color: '#b58cff', yaw: -PI / 2 }), D('speaker-tower', -11, TY, -132.6, { height: 3, color: '#b58cff', yaw: PI / 2 }),
  D('barrel', 6.8, TY, -127, { variant: 'toxic' }), D('barrel', 7.5, TY, -126.8), D('crate-stack', -6.8, TY, -127.2, { count: 3, yaw: 0.5 }),
  D('flag', -3.6, TY, -138, { color: '#6a2bd9', height: 5 }), D('flag', 3.6, TY, -138, { color: '#6a2bd9', height: 5 }),
  D('lamp', -2.6, TY, -143.6, { yaw: PI / 4, light: '#c8ffb0' }), D('lamp', 2.6, TY, -143.6, { yaw: -PI / 4, light: '#c8ffb0' }),
  D('billboard', 0, -3, -186, { text: 'The Sludge Serpent' }),
  // valley dressing
  D('billboard', -28.6, 14, -10, { yaw: PI / 2, text: 'Murk Industries' }), D('billboard', 28.6, 18, -24, { yaw: -PI / 2, text: 'ColorPlus' }),
  D('billboard', -28.6, 20, -60, { yaw: PI / 2, text: 'Grayer is Better' }), D('billboard', 28.6, 13, -80, { yaw: -PI / 2, text: 'Kelp Krunch' }),
  D('neon-sign', -28.9, 0, -40, { text: 'REFINERY 3', color: '#8be04a', height: 9, yaw: PI / 2 }),
  D('neon-sign', 28.9, 0, -120, { text: 'MURK', color: '#b58cff', height: 11, yaw: -PI / 2 }),
  D('lamp', -20, 15.4, -60, { yaw: PI }), D('lamp', 20, 15.4, -60, { yaw: PI }), D('lamp', 0, 15.4, -60, { yaw: 0 }),
  D('lamp', -12, 12.4, -120, { yaw: 0 }), D('lamp', 12, 12.4, -120, { yaw: 0 }),
  D('chimney', -34, 14, 2, { scale: 2.2 }), D('chimney', 34, 18, -2, { scale: 2 }), D('chimney', -34, 20, -44, { scale: 2.4 }),
  D('chimney', 36, 19, -140, { scale: 2.4 }), D('chimney', -36, 24, -160, { scale: 2.2 }),
  D('crane', 42, SL, -92, { yaw: -PI / 2, color: '#8a6ad8' }),
  D('vat', 12, SL, -4, { radius: 2.2, height: 5, glow: '#8be04a', scale: 1.4 }), D('vat', -13, SL, -50, { radius: 2, height: 6, glow: '#b58cff', scale: 1.3 }),
  D('vat', 13, SL, -106, { radius: 2.2, height: 6, glow: '#8be04a', scale: 1.4 }),
  D('buoy', 10, SL, -24, { color: '#8be04a' }), D('buoy', -12, SL, -66, { color: '#6a2bd9', light: '#ffcc33' }), D('buoy', 14, SL, -140, { color: '#8be04a' }),
);

export default {
  id: 'w3-3',
  name: 'Vat Valley',
  world: 3,
  theme: 'refinery',
  music: 'refinery',
  themeOverride: { hemiIntensity: 0.98, sunIntensity: 1.32, exposure: 1.12 },
  waterY: SL,
  water: false,
  killY: -3.6,
  spawn: { pos: [0, 0, 7], yaw: PI },
  objective: 'Cross the vats and reach the Prism Capsule',
  brushes,
  preInk: [
    murk(0, 0, -29, 2.4), murk(-5, 0, -30, 1.6),
    murk(0, 0, -57, 2.6), murk(-5, 0, -60, 1.8), murk(5, 0, -56, 1.8),
    murk(0, 0, -93, 2.4), murk(5, 0, -96.5, 1.8),
    murk(0, RIM, -116.6, 1.4), murk(-6.8, RIM, -110, 1.3), murk(6.8, RIM, -110, 1.3),
    murk(0, TY, -134, 2.8), murk(-8, TY, -134.4, 2), murk(8, TY, -135.6, 2), murk(0, TY + 0.3, -142.2, 1.8),
  ],
  entities: E,
  route: [
    [0, 0, 7], [0, 0, -3], [0, CW, -6.5], [0, CW, -22], [0, 0, -25.5], [0, 0, -30], [0, CW, -33.5], [0, CW, -36],
    [0, CW, -49.5, 'mover'], [0, 0, -52], [0, 0, -62], [0, CW, -65], [0, CW, -67], [0, CW, -85, 'mover'], [0, 0, -88],
    [0, 0, -100], [0, RIM, -103, 'climb'], [5, RIM, -105], [6.8, RIM, -110], [4.8, RIM, -114.8], [0, RIM, -116.8],
    [0, RIM, -119], [0, TY, -129, 'launch'], [0, TY, -137], [0, TY + 0.3, -141.8],
  ],
};
