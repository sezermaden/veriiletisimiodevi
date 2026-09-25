// 4-2 Gray Heart — inside the Graytide Engine at the top of Murkwell Tower: a 92 m drum open to
// the storm, its floor a pit of raw violet Murk energy (touch = splat). Dredge's back door lets
// Kai in at the south; the route spirals clockwise and inward, one mechanic after another:
//   BACK DOOR (spawn) → INTAKE (w4-2.engine: a Murk-powered barrier drops when group 'shield'
//     falls — Pod + Gloopers)
//   → PRESSURE DECK (CP1): conveyors sweeping toward the pit, steam vents, a Bomblob on a boiler
//   → PISTON HALL: ink & climb a steam main, ride the pistons up 6 m (CP2), shoot the switch
//     high on the boiler stack to open the shutter, puff up the sponge bridge
//   → COOLANT LOOP (CP3): drones + a Snipe Eel; ink rail sweeps round the drum (secret pad to the
//     crayon-drawing postcard pylon)
//   → WEST GALLERY (CP4, w4-2.heart, spring stash) → HEART BRIDGE (w4-2.pa): a reversed belt, a
//     Rollerbrute, turret pylons; barrier 'heart' → the TIDE CORE (prism-core) in the Heart.
// Engine floor EY = 80, upper halls EY+6, Heart EY+10. Energy pit EY−6, killY EY−8.
import { block, box, cyl, prism, ent, murk } from '../kit.js';
import { hpipe, tank } from '../w3/refinery-kit.js';
import { D } from './tower-kit.js';

const PI = Math.PI;
const EY = 80;
const UP = EY + 6;
const HY = EY + 10;

const steel = (c = '#5e5a72', o = {}) => ({ mat: 'metal', color: c, ...o });
const conc = (c = '#b8b4c8', o = {}) => ({ mat: 'concrete', color: c, ...o });
/** Platform: body rising from the pit + tiled cap. */
const deck = (cx, cz, w, d, top, o = {}) => [
  block(cx, cz, w, d, EY - 7, top - 0.3 - (EY - 7), steel(o.color || '#4a4560')),
  block(cx, cz, w + 0.3, d + 0.3, top - 0.3, 0.3, { mat: o.cap || 'tiles', color: o.capColor || '#c9c3dc' }),
];

/** Drum wall: n quad segments of radius R, thickness t, skipping those centred within `gap` rad of `gapAt`. */
function ringWall(R, t, y0, y1, n, gapAt, gap) {
  const out = [];
  const off = gapAt - PI / n;              // one segment centred on the doorway
  for (let i = 0; i < n; i++) {
    const a0 = off + (i / n) * PI * 2, a1 = off + ((i + 1) / n) * PI * 2, am = (a0 + a1) / 2;
    const da = Math.abs(((am - gapAt + PI * 3) % (PI * 2)) - PI);
    if (da < gap) continue;
    const ri = R - t;
    out.push(prism([[Math.cos(a0) * R, Math.sin(a0) * R], [Math.cos(a1) * R, Math.sin(a1) * R], [Math.cos(a1) * ri, Math.sin(a1) * ri], [Math.cos(a0) * ri, Math.sin(a0) * ri]],
      y0, y1, { mat: 'metal', color: i % 2 ? '#3b3650' : '#34304a', paint: false }));
  }
  return out;
}

const brushes = [
  // ---------------- the drum ----------------
  ...ringWall(46, 2.4, EY - 12, EY + 24, 36, PI / 2, 0.05),
  ...ringWall(46.6, 0.6, EY + 24, EY + 25, 36, PI / 2, -1),
  // ---------------- back door (spawn corridor) ----------------
  block(0, 51, 6.4, 12, EY - 2, 2, conc('#8c87a0')),
  block(-3.6, 51, 0.8, 12, EY, 6, steel('#2e2a3d', { paint: false })),
  block(3.6, 51, 0.8, 12, EY, 6, steel('#2e2a3d', { paint: false })),
  block(0, 57.2, 8, 0.6, EY, 6, steel('#2e2a3d', { paint: false })),
  block(0, 44.8, 8.6, 2.6, EY - 3, 3, steel('#4a4560')),
  block(0, 44.8, 8.8, 2.8, EY - 0.3, 0.3, { mat: 'tiles', color: '#c9c3dc' }),
  // ---------------- intake (P0) ----------------
  ...deck(0, 37, 16, 14, EY),
  block(-2.5, 39.6, 2.6, 1, EY, 1.1, conc()), block(4.5, 36.5, 1, 2.8, EY, 1.1, conc()),
  ...tank(-6, 41.2, 1.3, EY, 3.2, { color: '#7d7896', band: '#2e2a3d' }),
  block(10.5, 32, 5.4, 4, EY - 1.2, 1.2, conc('#9a95b0')),                                 // bridge → P1
  box(7.9, EY, 34, 8.3, EY + 3.6, 43.4, { mat: 'glass', color: '#b7a8ff' }),
  box(3.6, EY, 29.55, 8.3, EY + 3.6, 29.95, { mat: 'glass', color: '#b7a8ff' }),                // no squid leap round the barrier's south end
  // ---------------- pressure deck (P1) ----------------
  ...deck(21, 24, 18, 20, EY, { cap: 'metal', capColor: '#8c87a0' }),
  block(28, 16.5, 3, 3, EY, 2, steel('#6d6784')),                                         // boiler (bomblob)
  block(13.8, 16.2, 2.4, 2.4, EY, 1.1, conc()),
  block(28, 12, 4.4, 4.4, EY - 1.2, 1.2, conc('#9a95b0')),                                // bridge → P2a
  // ---------------- piston hall ----------------
  ...deck(35, 2.5, 14, 15, EY),
  ...hpipe('x', 28.2, 41.8, 3, EY, 1.3, { color: '#6a4bb0', collar: '#2e2a3d', every: 3.4 }),
  ...deck(28, -16, 24, 16, UP),
  block(34, -18, 5, 5, UP, 5, conc('#a39dbb')),                                            // boiler stack (switch on top)
  box(19.3, UP, -24.1, 27.5, UP + 3.4, -23.7, { mat: 'glass', color: '#b7a8ff' }),              // long enough that no diagonal leap reaches the loop deck
  block(22.5, -12, 1, 3, UP, 1.1, conc()), block(27, -21.5, 3, 1, UP, 1.1, conc()),
  ...[-25.4, -28.6].map((z) => cyl(17, EY - 7, z, 0.3, UP - 1.6 - (EY - 7), { mat: 'metal', color: '#2e2a3d', paint: false, sides: 10 })),
  // ---------------- coolant loop (P3) ----------------
  ...deck(7, -37, 22, 14, UP, { cap: 'metal', capColor: '#8c87a0' }),
  block(12, -41, 3, 3, UP, 1.6, steel('#6d6784')),
  block(2, -33.5, 1, 2.6, UP, 1.1, conc()),
  cyl(-11, EY - 7, -20, 2.8, HY + 2 - (EY - 7), { mat: 'concrete', color: '#a39dbb', sides: 16 }),   // secret pylon (wide enough for the return pad)
  cyl(-22, EY - 7, -14, 1.6, HY - (EY - 7), { mat: 'metal', color: '#5e5a72', sides: 14 }),        // sniper pylon
  // ---------------- west gallery (P4) + heart bridge ----------------
  ...deck(-34, 0, 12, 16, HY),
  ...deck(-34, 11.2, 5, 6.4, HY, { cap: 'metal', capColor: '#8c87a0' }),                      // balloon stash
  block(-18.25, 0, 21.5, 5, HY - 3, 3, steel('#4a4560')),
  block(-18.25, 0, 21.7, 5.2, HY - 0.3, 0.3, { mat: 'tiles', color: '#c9c3dc' }),
  block(-19, 0, 4, 11, HY - 3, 3, steel('#4a4560')),                                        // dodge bays
  block(-19, 0, 4.2, 11.2, HY - 0.3, 0.3, { mat: 'tiles', color: '#c9c3dc' }),
  cyl(-18, EY - 7, -10, 1.6, HY - (EY - 7), { mat: 'metal', color: '#5e5a72', sides: 14, paint: false }),   // turret pylons (unpaintable: no leaping round the barrier)
  cyl(-12, EY - 7, 9.5, 1.6, HY - (EY - 7), { mat: 'metal', color: '#5e5a72', sides: 14, paint: false }),
  cyl(-25, EY - 7, 9.5, 1.6, HY + 1 - (EY - 7), { mat: 'metal', color: '#5e5a72', sides: 14, paint: false }),
  // ---------------- the Heart ----------------
  cyl(0, EY - 7, 0, 8, HY - (EY - 7), { mat: 'metal', color: '#4a4560', sides: 32 }),
  cyl(0, HY - 0.05, 0, 7.4, 0.1, { mat: 'tiles', color: '#d6d0e4', sides: 32 }),
  cyl(0, HY, 0, 3, 0.45, { mat: 'tiles', color: '#3fb6ff', sides: 24 }),
  ...[0, 1, 2, 3].map((i) => cyl(Math.cos(PI / 4 + i * PI / 2) * 6.2, HY, Math.sin(PI / 4 + i * PI / 2) * 6.2, 0.6, 5, { mat: 'metal', color: '#5e5a72', sides: 12 })),
  // engine machinery around the drum (scenery)
  ...[0.6, 1.2, 2.3, 2.75, 3.6, 5.5].map((a) => cyl(Math.cos(a) * 40, EY - 7, Math.sin(a) * 40, 2.4, 20, { mat: 'metal', color: '#3f3a56', paint: false, sides: 16 })),
];

const E = [];
const add = (...xs) => E.push(...xs);
add(
  { type: 'sludge-pool', pos: [0, EY - 6, 0], radius: 44.6, color: '#2a1a5c', glow: '#9a6bff' },
  // back door + intake
  ent('npc', 2.2, EY, 52.5, { who: 'dredge', yaw: -PI / 2, idle: 'wave', dialogue: [{ who: 'dredge', text: 'Password2. Told you. Now go, before the Baron checks the cameras!', mood: 'worried' }] }),
  ent('pearl-trail', 0, EY, 50, { to: [0, EY, 45.5], count: 4 }),
  ent('trigger', 0, EY, 43.5, { size: [8, 3, 2], dialogue: 'w4-2.engine', objective: 'Reach the Tide Core in the Gray Heart' }),
  ent('murk-pod', -4, EY, 33.5, { group: 'shield', max: 2, interval: 4.5 }),
  ent('glooper', 3.5, EY, 33, { group: 'shield' }),
  ent('glooper', 5.5, EY, 39.5, { group: 'shield' }),
  ent('murk-barrier', 8.3, EY, 32, { yaw: PI / 2, size: [4, 3.6, 0.4], group: 'shield', id: 'bar-shield' }),
  ent('crate', -6.6, EY, 32.2, { pearls: 2 }),
  ent('pearl-trail', -6.6, EY, 43, { to: [-3, EY, 43], count: 3 }),
  ent('pearl', 31, EY + 3.2, -6.5), ent('pearl', 37, EY + 3.2, -6.5),
  ent('pearl-trail', 38.6, UP, -9.6, { to: [38.6, UP, -12.4], count: 2 }),
  ent('pearl-trail', 16.8, UP, -42.8, { to: [13.6, UP, -42.8], count: 3 }),
  // pressure deck
  ent('checkpoint', 15, EY, 32, { yaw: PI, id: 'cp1' }),
  ent('trigger', 16, EY, 30.5, { size: [6, 3, 3], hint: 'The belts dump into the pit. Cross them fast, and time the vents!', hintTime: 5 }),
  ent('conveyor', 21, EY, 27, { dir: '-x', size: [3, 16], speed: 3.2, cargo: 2, id: 'pd1' }),
  ent('conveyor', 21, EY, 20.5, { dir: '-x', size: [3.5, 16], speed: 3.8, cargo: 2, id: 'pd2' }),
  ent('steam-vent', 16.5, EY, 23.75, { radius: 1.1, period: 3.4, on: 1.3, offset: 0 }),
  ent('steam-vent', 25.5, EY, 23.75, { radius: 1.1, period: 3.4, on: 1.3, offset: 1.4 }),
  ent('steam-vent', 21, EY, 16.6, { radius: 1.1, period: 3.4, on: 1.3, offset: 2.4 }),
  ent('shield-glooper', 23.5, EY, 16, { group: 'deck' }),
  ent('glooper', 17, EY, 15.8, { group: 'deck' }),
  ent('glooper', 28.5, EY, 30.5, { group: 'deck' }),
  ent('bomblob', 28, EY + 2, 16.5, { group: 'deck', aggro: 22 }),
  ent('pearl-trail', 13.4, EY, 23.8, { to: [14.6, EY, 23.8], count: 2 }),
  ent('pearl', 21, EY + 0.4, 23.8), ent('pearl', 29, EY, 23.8),
  // piston hall
  ent('trigger', 30, EY, 8, { size: [8, 3, 3], hint: 'Ink the steam main and climb it, then ride a piston up!', hintTime: 5 }),
  ent('pearl-trail', 32, EY + 2.4, 3, { to: [38, EY + 2.4, 3], count: 3 }),
  ent('mover', 31, EY, -6.5, { size: [3, 0.5, 3], path: [[31, EY, -6.5], [31, UP, -6.5]], speed: 2.1, wait: 1.3, mat: 'murk', id: 'piston1' }),
  ent('mover', 37, UP, -6.5, { size: [3, 0.5, 3], path: [[37, UP, -6.5], [37, EY, -6.5]], speed: 1.7, wait: 1.1, mat: 'murk', id: 'piston2' }),
  ent('glooper', 38.5, EY, 7.5, { group: 'piston' }),
  ent('checkpoint', 32.6, UP, -10.4, { yaw: PI, id: 'cp2', radius: 2.4 }),
  ent('murk-turret', 38, UP, -22.4, { group: 'piston', aggro: 20 }),
  ent('glooper', 22, UP, -14.5, { group: 'piston' }),
  ent('glooper', 30.5, UP, -20.5, { group: 'piston' }),
  ent('rollerbrute', 20.5, UP, -10.5, { group: 'piston', aggro: 16 }),
  ent('trigger', 30, UP, -11, { size: [10, 3, 3], objective: 'Shoot the switch on the boiler stack to open the shutter', hint: 'The switch is on top of the boiler stack. Paint it and climb, or shoot it from below!', hintTime: 5 }),
  ent('switch', 34, UP + 5, -19, { id: 'sw-shutter', yaw: 0, targets: ['g-shutter'] }),
  ent('pearl-trail', 32.4, UP + 5, -16.6, { to: [35.6, UP + 5, -16.6], count: 3 }),
  ent('gate', 17, UP, -23.9, { id: 'g-shutter', size: [3.6, 3.4, 0.4] }),
  ent('sponge', 17, UP - 1.6, -25.4, { size: [2.2, 2.2, 2.2], id: 'sp1' }),   // small top 0.9 m under the deck: inkable from the doorway
  ent('sponge', 17, UP - 1.6, -28.6, { size: [2.2, 2.2, 2.2], id: 'sp2' }),
  // coolant loop
  ent('checkpoint', 14.2, UP, -32.4, { yaw: -PI / 2, id: 'cp3' }),
  ent('buzzdrone', 6, UP, -36, { alt: 4.4, group: 'loop', patrol: [[10, UP, -36], [0, UP, -38]] }),
  ent('buzzdrone', -2, UP, -40, { alt: 5, group: 'loop' }),
  ent('glooper', 9, UP, -41.4, { group: 'loop' }),
  ent('glooper', 0.5, UP, -36.6, { group: 'loop' }),
  ent('snipe-eel', -22, HY, -14, { group: 'loop', aggro: 34, yaw: PI * 0.75 }),
  ent('pearl-trail', 12, UP + 1.6, -41.8, { to: [12, UP + 1.6, -40.2], count: 2 }),
  ent('ink-rail', -3, UP + 0.7, -37, { id: 'rail-loop', points: [[-3, UP + 0.7, -37], [-14, UP + 2, -38], [-25, UP + 3.4, -31], [-32, HY + 0.4, -20], [-34.6, HY + 0.8, -9], [-34, HY + 0.7, -3.5]] }),
  ent('pearl-trail', -15, UP + 2.5, -37.2, { to: [-24, UP + 3.8, -31.8], count: 4, arc: 0.3 }),
  ent('launchpad', 3, UP, -42, { id: 'pad-pylon', target: [-10.3, HY + 2, -19.2] }),
  ent('postcard', -9.8, HY + 2, -21, { id: 'w4-2-postcard', title: 'A Crayon Drawing', text: 'This is me and my dad at the beach. The sun is orange. The sea is blue. The sand is yellow. Everything has a colour and it is my favourite.' }),
  ent('pearl-trail', -12.2, HY + 2, -19, { to: [-9.8, HY + 2, -19], count: 3 }),
  ent('launchpad', -11.5, HY + 2, -21.2, { id: 'pad-west', target: [-33.5, HY, 2.2] }),
  // west gallery + heart bridge
  ent('trigger', -34, HY, -3, { size: [12, 3, 6], dialogue: 'w4-2.heart' }),
  ent('checkpoint', -33.2, HY, 1.2, { yaw: PI / 2, id: 'cp4', radius: 2.4 }),
  ent('spring', -38, HY, 6, { power: 17 }),
  ent('pearl-trail', -38, HY + 6.5, 6, { to: [-38, HY + 8.5, 6], count: 3 }),
  ent('crate', -38.5, HY, -6.5, { pearls: 3 }),
  ent('balloon', -28.9, HY + 2.6, 6.8, { group: 'wb', pearls: 1 }),
  ent('balloon', -39.2, HY + 2.6, 7, { group: 'wb', move: [0, 0.8, 0], period: 3.5 }),
  ent('balloon', -39.2, HY + 2.6, -7.2, { group: 'wb', move: [0, 0, 1.2], period: 4 }),
  ent('gate', -34, HY, 8.25, { id: 'g-stash', size: [5, 3, 0.4], openOn: 'balloons:wb' }),
  ent('crate', -34, HY, 12.8, { pearls: 4 }),
  ent('pearl-trail', -35.4, HY, 10.2, { to: [-32.6, HY, 10.2], count: 3 }),
  ent('trigger', -27.5, HY, 0, { size: [2.5, 3, 5], dialogue: 'w4-2.pa', objective: 'Cross the Heart bridge and crack the Tide Core!' }),
  ent('steam-vent', -25.5, HY, 0, { radius: 1.3, period: 3.6, on: 1.3, offset: 0.6 }),
  ent('conveyor', -14, HY, 0, { dir: '-x', size: [4.4, 8], speed: 3.4, id: 'heart-belt' }),
  ent('rollerbrute', -10.5, HY, 0, { group: 'heart', yaw: -PI / 2, aggro: 18 }),
  ent('shield-glooper', -12.5, HY, -1.2, { group: 'heart', yaw: -PI / 2 }),
  ent('murk-pod', -19, HY, 4, { group: 'heart', max: 2, interval: 5 }),
  ent('murk-turret', -18, HY, -10, { group: 'heart', aggro: 20 }),
  ent('murk-turret', -12, HY, 9.5, { group: 'heart', aggro: 20 }),
  ent('bomblob', -25, HY + 1, 9.5, { group: 'heart', aggro: 22 }),
  ent('murk-barrier', -8.1, HY, 0, { yaw: PI / 2, size: [9.5, 4, 0.4], group: 'heart', id: 'bar-heart' }),   // wider than the bridge: a jump round its end would land on the Heart
  ent('pearl', -19, HY, -4.6), ent('pearl', -17.6, HY, -3.4),
  ent('prism-core', 0, HY + 0.45, 0, { id: 'core' }),
);
add(
  // energy dressing: core rings, pylons, conduits
  ent('glow', 0, HY + 4, 0, { shape: 'torus', radius: 5.2, tube: 0.12, color: '#3fb6ff', intensity: 2.6, spin: [0, 0.6, 0], tilt: [PI / 2 - 0.25, 0, 0], pulse: 0.2 }),
  ent('glow', 0, HY + 5.5, 0, { shape: 'torus', radius: 6.8, tube: 0.1, color: '#9a6bff', intensity: 2.4, spin: [0, -0.4, 0], tilt: [PI / 2 + 0.3, 0, 0.2], pulse: 0.25, speed: 3 }),
  ent('glow', 0, HY + 7.5, 0, { shape: 'torus', radius: 8.8, tube: 0.14, color: '#9a6bff', intensity: 2.2, spin: [0, 0.25, 0], tilt: [PI / 2, 0, 0] }),
  ...[0, 1, 2, 3].map((i) => ent('glow', Math.cos(PI / 4 + i * PI / 2) * 6.2, HY + 5.4, Math.sin(PI / 4 + i * PI / 2) * 6.2, { shape: 'sphere', radius: 0.55, color: '#3fb6ff', intensity: 3, pulse: 0.3, speed: 4 + i, halo: 3.5 })),
  ...[0.6, 1.2, 2.3, 2.75, 3.6, 5.5].map((a, i) => ent('glow', Math.cos(a) * 40, EY + 6, Math.sin(a) * 40, { shape: 'cyl', radius: 2.5, height: 1.2, color: i % 2 ? '#9a6bff' : '#3fb6ff', intensity: 2.2, pulse: 0.3, speed: 1.5 + i * 0.3 })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * PI / 4 + PI / 8; return ent('glow', Math.cos(a) * 43.5, EY + 12, Math.sin(a) * 43.5, { shape: 'box', size: [0.5, 30, 0.5], color: '#9a6bff', intensity: 1.8, pulse: 0.35, speed: 2 + i * 0.2 }); }),
  // deck edge light strips (pit side)
  ...[
    [0, EY, 29.85, 16, 'x'], [-8.15, EY, 37, 14, 'z'], [21, EY, 13.85, 18, 'x'], [11.85, EY, 22, 12, 'z'],
    [35, EY, -5.15, 14, 'x'], [27.85, EY, 2.5, 15, 'z'], [28, UP, -7.85, 24, 'x'], [15.85, UP, -16, 16, 'z'],
    [7, UP, -29.85, 22, 'x'], [-4.15, UP, -37, 14, 'z'], [-34, HY, -8.15, 12, 'x'], [-27.85, HY, -5.2, 5.6, 'z'], [-27.85, HY, 5.2, 5.6, 'z'],
  ].map(([x, y, z, L, ax]) => ent('glow', x, y - 0.18, z, { shape: 'box', size: ax === 'x' ? [L, 0.1, 0.1] : [0.1, 0.1, L], color: '#b58cff', intensity: 2.2 })),
  ent('glow', 0, EY + 24.6, 0, { shape: 'torus', radius: 45.6, tube: 0.25, color: '#9a6bff', intensity: 1.6, tilt: [PI / 2, 0, 0], segments: 96 }),
  ent('glow', -18.25, HY - 0.32, 2.62, { shape: 'box', size: [21.5, 0.08, 0.12], color: '#3fb6ff', intensity: 2.6 }),
  ent('glow', -18.25, HY - 0.32, -2.62, { shape: 'box', size: [21.5, 0.08, 0.12], color: '#3fb6ff', intensity: 2.6 }),
  ent('glow', 0, EY + 6.2, 45.2, { shape: 'box', size: [7.6, 0.25, 0.3], color: '#ffc53a', intensity: 2 }),
  // back door
  D('neon-sign', 0, EY, 57.8, { text: 'STAFF ENTRANCE', color: '#ffc53a', height: 4.2, yaw: PI }),
  D('graffiti', -3.15, EY, 51, { yaw: PI / 2, text: 'DREDGE WAS HERE', size: 3.6, color: '#ffd23f', color2: '#ff8a1f' }),
  D('lamp', 3, EY, 47.6, { yaw: -PI / 2, light: '#d9ccff' }), D('crate-stack', -2.4, EY, 55.6, { count: 2 }),
  // intake
  D('neon-sign', 0, EY, 30.3, { text: 'GRAYTIDE ENGINE', color: '#a77bff', height: 3.6, pole: true, yaw: PI }),
  D('lamp', -7.4, EY, 30.8, { yaw: PI / 4, light: '#c9b8ff' }), D('lamp', 7.4, EY, 43.2, { yaw: -PI * 0.75, light: '#c9b8ff' }),
  D('barrel', -7.2, EY, 36, { variant: 'toxic' }), D('barrel', -7.4, EY, 37, { variant: 'toxic' }),
  D('speaker-tower', 7, EY, 41.5, { height: 2.6, color: '#a77bff', yaw: -PI / 2 }),
  D('vat', 6.2, EY, 30.8, { radius: 0.9, height: 2, glow: '#9a6bff' }),
  // pressure deck
  D('neon-sign', 21, EY, 33.7, { text: 'PRESSURE DECK', color: '#ff7a3a', height: 3.2, pole: true, yaw: PI }),
  D('lamp', 29.4, EY, 33.4, { yaw: -PI * 0.75 }), D('lamp', 12.6, EY, 14.6, { yaw: PI / 4, light: '#ffb070' }),
  D('pipe', 29.6, EY, 24, { yaw: PI / 2, length: 12, radius: 0.35, height: 0.6, color: '#6a4bb0' }),
  D('barrel', 13, EY, 33, { variant: 'toxic' }), D('crate-stack', 26.6, EY, 32.8, { count: 2, yaw: 0.2 }),
  D('graffiti', 28, EY, 18.03, { text: 'HOT', size: 2, height: 1.2, color: '#ff5a3a', color2: '#ffd23f' }),
  // piston hall
  D('neon-sign', 35, EY, 9.6, { text: 'PISTON HALL', color: '#3fb6ff', height: 3, pole: true, yaw: PI }),
  D('lamp', 41.2, EY, 9.2, { yaw: -PI * 0.75 }), D('lamp', 28.8, EY, -4.2, { yaw: PI / 4 }),
  D('vat', 40.2, EY, -3.2, { radius: 1, height: 2.2, glow: '#3fb6ff' }), D('barrel', 40.4, EY, 8.2),
  D('neon-sign', 31.45, UP, -18, { yaw: -PI / 2, text: 'DANGER HIGH PRESSURE', color: '#ff5a5a', height: 5.4, scale: 0.6 }),
  D('lamp', 16.6, UP, -8.6, { yaw: PI / 4 }), D('lamp', 39.4, UP, -8.8, { yaw: -PI / 4, light: '#9fd8ff' }),
  D('crate-stack', 38.4, UP, -14, { count: 3, yaw: 0.6 }), D('barrel', 17, UP, -18, { variant: 'toxic' }), D('barrel', 17.6, UP, -19, { variant: 'toxic' }),
  D('antenna', 35.6, UP + 5, -20, { height: 2.4, variant: 'radar' }), D('speaker-tower', 24, UP, -23.3, { height: 2.6, color: '#3fb6ff' }),
  // coolant loop
  D('neon-sign', 7, UP, -30.4, { text: 'COOLANT LOOP', color: '#3fb6ff', height: 3.2, pole: true }),
  D('lamp', 17.4, UP, -43, { yaw: -PI / 4, light: '#9fd8ff' }), D('lamp', -3.4, UP, -30.6, { yaw: PI * 0.75, light: '#9fd8ff' }),
  D('vat', 16.4, UP, -35, { radius: 1.1, height: 2.4, glow: '#3fb6ff' }), D('vat', -2.2, UP, -42.6, { radius: 1, height: 2, glow: '#9a6bff' }),
  D('pipe', 7, UP, -43.4, { length: 18, radius: 0.35, height: 0.6, color: '#3fb6ff' }),
  D('lamp', -11, HY + 2, -18.2, { yaw: PI, light: '#ffb3e6' }),
  // west gallery + bridge
  D('neon-sign', -29.4, HY, -7.4, { text: 'THE HEART', color: '#3fb6ff', height: 3.4, pole: true, yaw: PI / 2 }),
  D('lamp', -39.4, HY, -7.4, { yaw: PI / 4, light: '#9fd8ff' }), D('lamp', -39.4, HY, 7.4, { yaw: PI * 0.75, light: '#9fd8ff' }),
  D('speaker-tower', -39, HY, 0, { height: 3, color: '#a77bff', yaw: PI / 2 }),
  D('crate-stack', -30, HY, -7, { count: 2, yaw: 0.3 }), D('barrel', -29.2, HY, 7.2, { variant: 'toxic' }),
  D('flag', -28.4, HY, -2.9, { color: '#6a2bd9', height: 4 }), D('flag', -28.4, HY, 2.9, { color: '#6a2bd9', height: 4 }),
  D('flag', -8.6, HY, -3, { color: '#3fb6ff', height: 4 }), D('flag', -8.6, HY, 3, { color: '#3fb6ff', height: 4 }),
  D('lamp', 21, EY, 14.2, { yaw: 0, light: '#c9b8ff' }), D('lamp', 34, EY, -4.6, { yaw: 0, light: '#c9b8ff' }),
  D('lamp', 26, UP, -8.4, { yaw: 0, light: '#c9b8ff' }), D('lamp', 6, UP, -30.4, { yaw: 0, light: '#c9b8ff' }),
  D('lamp', 16.4, UP, -12, { yaw: -PI / 2, light: '#c9b8ff' }),
  // heart
  D('lamp', 5.5, HY, 5.5, { yaw: -PI * 0.75, light: '#9fd8ff' }), D('lamp', 5.5, HY, -5.5, { yaw: -PI / 4, light: '#9fd8ff' }),
  D('satellite', 0, EY + 25, -46, { yaw: 0 }), D('antenna', 32, EY + 25, 32, { height: 5 }), D('antenna', -32, EY + 25, -32, { height: 6, variant: 'radar' }),
  D('billboard', 0, EY + 25, -46.4, { text: 'Grayer is Better' }),
);

export default {
  id: 'w4-2',
  name: 'Gray Heart',
  world: 4,
  theme: 'tower',
  music: 'tower',
  themeOverride: { hemiIntensity: 1.05, exposure: 1.16, fogNear: 50, fogFar: 240 },
  waterY: -2,
  water: false,
  killY: EY - 8,
  spawn: { pos: [0, EY, 54], yaw: PI },
  objective: 'Reach the Tide Core in the Gray Heart',
  brushes,
  preInk: [
    murk(0, EY, 36, 2.8), murk(-4, EY, 33.5, 2), murk(4, EY, 40, 1.6),
    murk(24, EY, 16, 2), murk(15, EY, 30, 1.6), murk(35, EY, 6, 1.6),
    murk(28, UP, -14, 2.6), murk(22, UP, -20, 1.8), murk(34, UP, -18, 1.4),
    murk(6, UP, -37, 2.4), murk(-34, HY, 0, 2), murk(-19, HY, 0, 2.2), murk(-19, HY, 4, 1.6), murk(0, HY, 0, 2.4),
  ],
  entities: E,
  route: [
    [0, EY, 54], [0, EY, 45], [0, EY, 36], [5, EY, 32], [10.5, EY, 32], [14, EY, 32], [16, EY, 29],
    [16, EY, 18], [27.5, EY, 15], [28, EY, 12], [30, EY, 7], [30, EY + 2.4, 3, 'climb'], [30, EY, -0.5],
    [31, EY, -4.6], [31, UP, -9, 'mover'], [30, UP, -16], [17, UP, -21], [17, UP, -23.5],
    [17, UP, -30.6, 'mover'], [8, UP, -37], [-3, UP, -37], [-33.5, HY, 2.5, 'rail'], [-30, HY, 0],
    [-10, HY, 0], [-5, HY, 0], [-2, HY + 0.45, 0],
  ],
};
