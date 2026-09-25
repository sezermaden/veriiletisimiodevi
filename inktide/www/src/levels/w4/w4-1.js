// 4-1 The Ascent — one storm-lashed lap up the outside of Murkwell Tower. The core is dark
// unpaintable cladding and tinted glass; only the concrete ledges, terrace walls and pillars take ink.
//   South: LOBBY PLAZA (y 20, spawn) → paint & climb the 6 m terrace wall → TERRACE (26, CP1)
//   East:  WIND LEDGE 26 → ramp → 29 with a 3 m break; gusts shove you outward (w4-1.storm)
//   North: NE corner (CP2) → window-washer GONDOLA up to 37 under a Snipe Eel → (CP3, w4-1.halfway)
//          and a second gust ledge
//   West:  ledge crew (w4-1.pa) → INK RAIL spiralling up round the SW corner to 44
//          (drop off the rail early for the secret balcony + postcard)
//   South: SPONGE GAP at 44 in the gusts (CP4) → East: CREW LEDGE (barrier 'crew')
//   → stairs to the SERVICE DOOR at 48 where Dredge waits (w4-1.dredge) → Prism Capsule.
// A fall-guard splats any fall of 9 m+ below the active checkpoint. killY 8.
import { block, box, ramp, stairs, cyl, ent, murk } from '../kit.js';
import { facade, ledge, pillar, D } from './tower-kit.js';
import '../w3/refinery-kit.js';          // sludge-pool (used as the dark harbour sheet far below)

const PI = Math.PI;
const PZ = 20;            // plaza
const T1 = 26;            // terrace / east lower
const C2 = 29;            // east upper + north lower
const N2 = 37;            // north upper + west
const S2 = 44;            // south + east upper
const SV = 48;            // service platform

const conc = (c = '#c9c3dc', o = {}) => ({ mat: 'concrete', color: c, ...o });
const hazard = (x0, z0, x1, z1, y) => box(x0, y, z0, x1, y + 0.05, z1, { mat: 'metal', color: '#f2c230', paint: false });

/** Neighbouring skyscraper (scenery): dark skin, lit window bands, a crown. */
const tower = (cx, cz, w, d, h, c) => [
  ...facade(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, -2, h, { color: c, floor: 5, first: 3, glass: '#8fb0ff' }).map((b) => ({ ...b, paint: false })),
  block(cx, cz, w * 0.7, d * 0.7, h, 4, { mat: 'metal', color: '#2e2a3d', paint: false }),
];

const brushes = [
  // ---------------- the tower ----------------
  ...facade(-11, -11, 11, 11, -2, 52, { first: 22.5 }),
  block(0, 0, 23, 23, 52, 0.8, { mat: 'metal', color: '#2e2a3d', paint: false }),
  ...facade(-7, -7, 7, 7, 52.8, 70.8, { first: 0.5, floor: 4.4 }),
  block(0, 0, 9, 9, 70.8, 10, { mat: 'metal', color: '#4a4466', paint: false }),
  // ---------------- lobby plaza (south) ----------------
  block(0, 25.75, 36, 22.5, -2, PZ - 0.4, { mat: 'metal', color: '#4a4560', paint: false }),
  block(0, 25.75, 36.6, 23.1, PZ - 0.4, 0.4, { mat: 'tiles', color: '#cfc9de' }),
  block(-12, 30, 3, 3, PZ, 1.0, conc('#8c87a0')), block(12, 30, 3, 3, PZ, 1.0, conc('#8c87a0')),      // planters
  block(-12, 21, 3, 3, PZ, 1.0, conc('#8c87a0')), block(12, 21, 3, 3, PZ, 1.0, conc('#8c87a0')),
  block(0, 27.5, 5, 1, PZ, 1.1, conc('#b0aac4')),
  block(-5, 20.5, 1, 3, PZ, 1.1, conc('#b0aac4')), block(5.5, 19.5, 1, 3, PZ, 1.1, conc('#b0aac4')),
  // terrace (climb wall faces the plaza)
  box(-14.5, PZ, 11, 14.5, T1, 14.5, conc('#d6d0e4')),
  hazard(-14.5, 14.2, 14.5, 14.5, T1),
  // ---------------- east lower (wind) ----------------
  ...ledge(11, 4, 14.5, 11, T1),
  ramp(11, T1, -2, 14.5, C2, 4, '-z', conc('#b8b4c8')),
  box(11, T1 - 0.6, -2, 14.5, T1, 4, conc('#8c87a0', { paint: false })),
  ...ledge(11, -5, 14.5, -2, C2),
  ...ledge(11, -14.5, 14.5, -8, C2),
  hazard(14.2, -14.5, 14.5, 11, C2 + 0.01),
  // ---------------- north (gondola) ----------------
  ...ledge(4, -14.5, 14.5, -11, C2),
  ...ledge(-14.5, -14.5, -1, -11, N2),
  box(-1.4, C2 - 0.5, -11.4, 3.4, N2 + 4, -11, { mat: 'metal', color: '#2e2a3d', paint: false }),       // gondola track
  // ---------------- west (rail) ----------------
  ...ledge(-14.5, -11, -11, -3, N2),
  ...ledge(-14.5, 2, -11, 7, 33),                                                                      // secret balcony
  // ---------------- south upper (sponges) ----------------
  ...ledge(-14.5, 11, -2, 14.5, S2),
  ...ledge(6, 11, 14.5, 14.5, S2),
  block(0.2, 12.75, 0.5, 0.7, S2 - 3.2, 0.6, { mat: 'metal', color: '#2e2a3d', paint: false }),         // sponge brackets (hidden under the sponge)
  block(3.8, 12.75, 0.5, 0.7, S2 - 3.2, 0.6, { mat: 'metal', color: '#2e2a3d', paint: false }),
  // ---------------- east upper (crew) + service platform ----------------
  ...ledge(11, -4.4, 14.5, 11, S2),
  stairs(11, S2, -8.6, 14.5, SV, -4.4, '-z', conc('#b8b4c8')),
  block(13.75, -12.3, 5.5, 7.4, SV - 0.6, 0.6, { mat: 'tiles', color: '#d6d0e4' }),
  box(15.25, SV, -10.6, 16.5, SV + 3.4, -10.2, { mat: 'glass', color: '#b7a8ff' }),
  box(11, SV, -16.4, 16.5, SV + 3.6, -16, conc('#8c87a0')),
  box(16.1, SV, -16, 16.5, SV + 3.6, -10.6, conc('#8c87a0')),
  cyl(13.6, SV - 0.05, -13.4, 1.8, 0.3, { mat: 'tiles', color: '#3fb6ff', sides: 20 }),
  // ---------------- neighbouring towers (scenery) ----------------
  ...tower(-46, 30, 16, 16, 34, '#4a4466'), ...tower(48, 22, 14, 18, 46, '#3f3a56'),
  ...tower(-52, -30, 18, 14, 58, '#3b3650'), ...tower(44, -44, 16, 16, 38, '#4a4466'),
  ...tower(4, -64, 20, 12, 30, '#3f3a56'), ...tower(-20, 64, 18, 12, 24, '#3b3650'), ...tower(28, 66, 12, 14, 28, '#4a4466'),
];

const E = [{ type: 'sludge-pool', pos: [0, -2, 0], size: [900, 900], lake: true, color: '#1d2036', glow: '#2c3566' }];
const add = (...xs) => E.push(...xs);
add(
  ent('fall-guard', 0, PZ, 30, { drop: 9 }),
  // plaza
  ent('pearl-trail', 0, PZ, 33, { to: [0, PZ, 29], count: 4 }),
  ent('pearl', -12, PZ + 1, 30), ent('pearl', 12, PZ + 1, 21), ent('pearl', 12, PZ + 1, 30), ent('pearl', -12, PZ + 1, 21),
  ent('pearl-trail', -16.6, PZ, 31, { to: [-16.6, PZ, 20], count: 4 }),
  ent('trigger', 0, PZ, 17.5, { size: [28, 3, 3], hint: 'The lobby is locked. Ink the terrace wall and swim up it!', hintTime: 5 }),
  ent('glooper', -6.5, PZ, 23.5, { group: 'plaza' }),
  ent('glooper', 7, PZ, 24.5, { group: 'plaza' }),
  ent('shield-glooper', 0, PZ, 17.2, { group: 'plaza' }),
  ent('murk-turret', 0, T1, 12.6, { group: 'plaza', aggro: 20 }),
  ent('gate', 0, PZ, 14.75, { id: 'lobby', size: [4, 3.4, 0.4] }),
  // terrace
  ent('checkpoint', 8, T1, 12.4, { yaw: PI / 2, id: 'cp1' }),
  ent('pearl-trail', -10, T1, 12.75, { to: [-3, T1, 12.75], count: 4 }),
  ent('crate', 12.6, T1, 13, { pearls: 2 }),
  // east lower (wind)
  ent('trigger', 12.75, T1, 9.5, { size: [3.5, 3, 3], dialogue: 'w4-1.storm', objective: 'Climb the tower. Mind the gusts!' }),
  ent('wind-gust', 14.05, T1, 0, { size: [3.9, 8, 29], dir: [1, 0], strength: 3.6, period: 5.6, gust: 1.6, warn: 1.1 }),
  ent('pearl-trail', 11.6, T1, 9, { to: [11.6, T1, 5], count: 3 }),
  ent('pearl', 12.2, C2, -3.2), ent('pearl', 12.2, C2, -9.4),
  ent('buzzdrone', 12.75, C2, -9, { alt: 4.2, group: 'east', patrol: [[12.75, C2, -12], [12.75, C2, -4]] }),
  ent('glooper', 12.4, C2, -12, { group: 'east' }),
  // north (gondola)
  ent('checkpoint', 12.2, C2, -12.6, { yaw: -PI / 2, id: 'cp2' }),
  ent('pearl-trail', 9.5, C2, -12, { to: [5, C2, -12], count: 3 }),
  ent('mover', 1, C2, -12.75, { size: [3, 0.4, 2.5], path: [[1, C2, -12.75], [1, N2, -12.75]], speed: 2.2, wait: 1.6, mat: 'metal', id: 'gondola' }),
  ent('snipe-eel', -13, N2, -12.8, { yaw: PI / 2, group: 'north', aggro: 30 }),
  ent('buzzdrone', -7, N2, -12.8, { alt: 3.8, group: 'north' }),
  ent('trigger', -3, N2, -12.75, { size: [4, 3, 3.5], dialogue: 'w4-1.halfway' }),
  ent('checkpoint', -4.4, N2, -12.4, { yaw: -PI / 2, id: 'cp3' }),
  ent('wind-gust', -7.75, N2, -14.05, { size: [13.5, 6, 3.9], dir: [0, -1], strength: 3.4, period: 5.2, gust: 1.5, warn: 1.1, offset: 2 }),
  ent('pearl-trail', -6, N2, -12, { to: [-11, N2, -12], count: 3 }),
  // west (rail)
  ent('trigger', -12.75, N2, -8, { size: [3.5, 3, 5], dialogue: 'w4-1.pa' }),
  ent('glooper', -12.4, N2, -6, { group: 'west' }),
  ent('glooper', -13.2, N2, -4.2, { group: 'west' }),
  ent('ink-rail', -12.75, N2 + 0.65, -4.2, { id: 'rail-west', points: [[-12.75, N2 + 0.65, -4.2], [-13.3, N2 + 1.6, 1], [-13.5, N2 + 3.4, 6], [-13, N2 + 5.4, 10.4], [-10.4, S2 + 0.8, 13.1], [-6.5, S2 + 0.5, 13.1]] }),
  ent('pearl-trail', -13.5, N2 + 2.3, 2.6, { to: [-13.4, N2 + 4.9, 8.6], count: 4 }),
  // secret balcony (drop off the rail or jump from the ledge end)
  ent('postcard', -12.8, 33, 6.2, { id: 'w4-1-postcard', title: 'Murkwell Tower Grand Opening', text: 'The tallest building in Tidehaven! Beautifully gray! Please remember to wipe your fins.' }),
  ent('pearl-trail', -12.8, 33, 2.6, { to: [-12.8, 33, 4.8], count: 3 }),
  ent('launchpad', -12.2, 33, 4, { id: 'pad-balcony', target: [-12.75, N2, -6] }),
  // south upper (sponges)
  ent('trigger', -4, S2, 12.75, { size: [3, 3, 3.5], hint: 'Puff up the sponges with ink. Cross between gusts!', hintTime: 5 }),
  ent('sponge', 0.2, S2 - 2.6, 12.75, { size: [2.6, 2.6, 2.6], id: 'spA' }),
  ent('sponge', 3.8, S2 - 2.6, 12.75, { size: [2.6, 2.6, 2.6], id: 'spB' }),
  ent('wind-gust', 2, S2, 14.05, { size: [10, 6, 3.9], dir: [0, 1], strength: 3.2, period: 5, gust: 1.4, warn: 1.1, offset: 1 }),
  ent('shield-glooper', 9, S2, 12.8, { yaw: -PI / 2, group: 'south' }),
  ent('glooper', 12.6, S2, 13.2, { yaw: -PI / 2, group: 'south' }),
  ent('checkpoint', 8.6, S2, 12.3, { yaw: PI / 2, id: 'cp4' }),
  ent('pearl', 0.2, S2 + 0.1, 12.75), ent('pearl', 3.8, S2 + 0.1, 12.75),
  // east upper (crew) → service door
  ent('trigger', 12.75, S2, 10.5, { size: [3.5, 3, 2], objective: 'Break through the crew to the service door' }),
  ent('wind-gust', 14.05, S2, 3.3, { size: [3.9, 6, 15], dir: [1, 0], strength: 3.6, period: 5.4, gust: 1.6, warn: 1.1, offset: 3 }),
  ent('murk-pod', 12.75, S2, 7.8, { group: 'crew', max: 2, interval: 5 }),
  ent('shield-glooper', 12.75, S2, 2.6, { group: 'crew' }),
  ent('glooper', 13.5, S2, -0.8, { group: 'crew' }),
  ent('glooper', 12.2, S2, -2.8, { group: 'crew' }),
  ent('buzzdrone', 13, S2, 4.5, { alt: 4.4, group: 'crew' }),
  ent('murk-barrier', 12.75, S2, -3.9, { size: [3.5, 3.4, 0.4], group: 'crew', id: 'bar-crew' }),
  ent('pearl-trail', 11.6, S2, 11, { to: [11.6, S2, 8.6], count: 2 }),
  ent('trigger', 12.75, SV, -9.3, { size: [3.5, 3, 1.4], dialogue: 'w4-1.dredge', event: 'dredge-door', objective: 'Crack the Prism Capsule!' }),
  ent('npc', 15.8, SV, -9.3, { who: 'dredge', yaw: -PI / 2 - 0.4, dialogue: 'w4-1.dredge', idle: 'wave' }),
  ent('gate', 12.75, SV, -10.4, { id: 'service-door', size: [3.5, 3.4, 0.4], openOn: 'event:dredge-door' }),
  ent('prism-core', 13.6, SV + 0.25, -13.4, { id: 'core' }),
);
add(
  // plaza dressing
  D('neon-sign', 0, T1, 14.62, { text: 'MURKWELL TOWER', color: '#a77bff', height: 1.2 }),
  D('neon-sign', 0, PZ, 14.9, { text: 'LOBBY CLOSED', color: '#ff5a5a', height: 4.1 }),
  D('graffiti', -8.5, PZ, 14.53, { text: 'COLOUR IS FREE', size: 4.6, color: '#ff8a1f', color2: '#2fd6ff' }),
  D('graffiti', 9, PZ, 14.53, { style: 'squid', size: 3.2, height: 2, color: '#ffd23f', color2: '#ff3fa4' }),
  D('lamp', -16.5, PZ, 34, { yaw: PI * 0.75 }), D('lamp', 16.5, PZ, 34, { yaw: -PI * 0.75 }),
  D('lamp', -16.5, PZ, 17, { yaw: PI / 4 }), D('lamp', 16.5, PZ, 17, { yaw: -PI / 4 }),
  D('lamp', -7, PZ, 36.2, { yaw: PI }), D('lamp', 7, PZ, 36.2, { yaw: PI }),
  D('bench', -6, PZ, 33.5, { yaw: PI, color: '#6d6784' }), D('bench', 6, PZ, 33.5, { yaw: PI, color: '#6d6784' }),
  D('bench', -16.4, PZ, 25.5, { yaw: PI / 2, color: '#6d6784' }), D('bench', 16.4, PZ, 25.5, { yaw: -PI / 2, color: '#6d6784' }),
  D('bush', -12, PZ + 1, 30, { color: '#6f7a6f', flowers: false }), D('bush', 12, PZ + 1, 30, { color: '#6f7a6f', flowers: false }),
  D('bush', -12, PZ + 1, 21, { color: '#6f7a6f', flowers: false }), D('bush', 12, PZ + 1, 21, { color: '#6f7a6f', flowers: false }),
  D('flag', -17.4, PZ, 36.4, { color: '#6a2bd9', height: 7 }), D('flag', 17.4, PZ, 36.4, { color: '#6a2bd9', height: 7 }),
  D('flag', -14, T1, 14, { color: '#6a2bd9', height: 5 }), D('flag', 14, T1, 14, { color: '#6a2bd9', height: 5 }),
  D('vending', -17.4, PZ, 30, { yaw: PI / 2, color: '#6a2bd9' }), D('vending', 17.4, PZ, 21.5, { yaw: -PI / 2, color: '#6a2bd9' }),
  D('speaker-tower', -3.8, T1, 13.6, { height: 2.2, color: '#a77bff' }), D('speaker-tower', 3.8, T1, 13.6, { height: 2.2, color: '#a77bff' }),
  D('billboard', 0, PZ, 37.4, { yaw: PI, text: 'Murk Industries' }),
  D('railing', 0, PZ, 37.2, { yaw: PI, length: 8, color: '#b8b4c8' }),
  D('railing', -18.2, PZ, 25.8, { yaw: PI / 2, length: 22, color: '#b8b4c8' }), D('railing', 18.2, PZ, 25.8, { yaw: -PI / 2, length: 22, color: '#b8b4c8' }),
  D('cone', -2.6, PZ, 16.2), D('cone', 2.6, PZ, 16.2), D('hydrant', 15, PZ, 33.6, { color: '#8a6bff' }),
  // ledges
  D('satellite', 13.4, T1, 6, { yaw: -PI / 2 }), D('antenna', 13.6, C2, -13.6, { height: 3.2, variant: 'radar' }),
  D('crate-stack', 12.2, T1, 8.4, { count: 2, yaw: 0.2 }), D('barrel', 11.8, C2, -3.2), D('barrel', 12.4, C2, -3.8, { variant: 'toxic' }),
  D('lamp', 11.6, C2, -14, { yaw: -PI / 2, light: '#d9ccff' }), D('lamp', -1.4, N2, -11.6, { yaw: PI, light: '#d9ccff' }),
  D('neon-sign', 1, C2 + 4.2, -11.05, { text: 'SERVICE LIFT', color: '#ffc53a', height: 0.2, yaw: PI }),
  D('crate-stack', -9, N2, -11.8, { count: 2, yaw: 0.3 }), D('satellite', -13.6, N2, -13.8, { yaw: PI * 0.75 }),
  D('barrel', -12, N2, -3.6, { variant: 'toxic' }), D('lamp', -14, N2, -10.4, { yaw: PI / 2, light: '#d9ccff' }),
  D('pipe', -12.2, 33, 2.4, { yaw: PI / 2, length: 1.6, radius: 0.22, height: 0.4, color: '#ff7ab8' }),
  D('lamp', -13.8, 33, 6.6, { yaw: PI / 2, light: '#ffb3e6' }),
  D('antenna', -13.6, S2, 13.8, { height: 2.6 }), D('crate-stack', -8, S2, 13.2, { count: 2, yaw: -0.4 }),
  D('neon-sign', 2, S2 + 1.2, 11.05, { text: 'MIND THE GAP', color: '#ff5a5a', height: 1.3 }),
  D('lamp', 14, S2, 11.4, { yaw: -PI / 2, light: '#d9ccff' }), D('barrel', 11.7, S2, 5.4), D('barrel', 11.8, S2, -1.6, { variant: 'toxic' }),
  D('satellite', 13.8, S2, 9.8, { yaw: -PI / 2 }),
  // service platform
  D('neon-sign', 12.75, SV, -10.2, { text: 'STAFF ONLY', color: '#3fb6ff', height: 3.9 }),
  D('lamp', 15.8, SV, -15.4, { yaw: -PI * 0.75, light: '#9fd8ff' }), D('crate-stack', 11.8, SV, -15.2, { count: 2 }),
  D('flag', 16.2, SV, -8.8, { color: '#3fb6ff', height: 3.4 }),
  // tower top + skyline
  D('antenna', 0, 80.8, 0, { height: 8, variant: 'radar' }), D('satellite', 5, 70.8, 5, { yaw: PI / 4 }),
  D('neon-sign', 0, 52.8, 7.05, { text: 'MURK', color: '#a77bff', height: 9, scale: 2.2 }),
  D('neon-sign', 7.05, 52.8, 0, { text: 'MURK', color: '#a77bff', height: 9, scale: 2.2, yaw: PI / 2 }),
  D('billboard', -11.2, 44, 0, { yaw: -PI / 2, text: 'Grayer is Better', scale: 1 }),
  D('billboard', -44, 50, 30, { yaw: PI / 3, text: 'ColorPlus' }), D('billboard', 45, 46, -30, { yaw: -PI / 2.5, text: 'Murk Industries' }),
  D('antenna', 48, 50, 22, { height: 6 }), D('antenna', -52, 62, -30, { height: 7, variant: 'radar' }),
  D('flag', -46, 38, 30, { color: '#6a2bd9', height: 6 }), D('satellite', 44, 42, -44, { yaw: PI }),
);

export default {
  id: 'w4-1',
  name: 'The Ascent',
  world: 4,
  theme: 'tower',
  music: 'tower',
  themeOverride: { hemiIntensity: 0.9, exposure: 1.08 },
  waterY: -2,
  water: false,
  killY: 8,
  spawn: { pos: [0, PZ, 31], yaw: PI },
  objective: 'Scale Murkwell Tower',
  brushes,
  preInk: [
    murk(0, PZ, 22, 3), murk(-7, PZ, 25, 2), murk(7, PZ, 20, 2),
    murk(0, T1, 12.75, 1.6), murk(12.75, C2, -10, 1.6), murk(-10, N2, -12.75, 1.5),
    murk(-12.75, N2, -6, 1.5), murk(10, S2, 12.75, 1.5), murk(12.75, S2, 6, 1.6), murk(12.75, S2, 0, 1.5),
  ],
  entities: E,
  route: [
    [0, PZ, 31], [0, PZ, 25], [-2, PZ, 16], [-2, T1, 13, 'climb'], [8, T1, 12.75], [12.75, T1, 8], [12.75, T1, 4],
    [12.75, C2, -2], [12.75, C2, -4.8], [12.75, C2, -8.4], [12.75, C2, -12.75], [5, C2, -12.75],
    [-2, N2, -12.75, 'mover'], [-12.75, N2, -12.75], [-12.75, N2, -4.4],
    [-7, S2, 12.75, 'rail'], [-2.4, S2, 12.75], [6.4, S2, 12.75, 'mover'], [12.75, S2, 12.75], [12.75, S2, -4.2],
    [12.75, SV, -8.4], [12.75, SV, -11.4], [13.2, SV + 0.25, -12.6],
  ],
};
