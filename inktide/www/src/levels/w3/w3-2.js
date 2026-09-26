// 3-2 Pipe Dream — the refinery pipe works, "designed by a very angry octopus". North (−Z):
//   Spawn deck → PIPE YARD: three full-width pipes of rising size (1.9 / 3.0 / 3.7 m) that must be
//     inked and climbed (teaches w3-2.pipes), a Bomblob lobbing over them
//   → PIPE BRIDGE: walk the top of a 4 m trunk main over the sludge, drones overhead → TANK 1 (CP1)
//   → RAIL EXPRESS: a 60 m ink rail weaving through a forest of risers (teaches w3-2.rail);
//     a side launch pad reaches the secret valve island (postcard) and pads you back
//   → JUNCTION (CP2) → THE MAZE: a three-row serpentine of unclimbable grate walls, climbable pipes
//     across the rows, a pod, a turret and a Snipe Eel; pearl trails show the way (w3-2.lost);
//     barrier 'maze' at the exit → TANK 9 PLAZA (CP3)
//   → TANK 9: climb 7 m to a ring ledge, 6 m more to the roof (CP4), clear group 'top' to open the
//     balcony, then launch to the capsule platform.
// Base deck 0, maze deck 3, Tank 9 roof 16, capsule 14. Sludge (water) −2.2, killY −3.4.
import { block, box, cyl, ent, murk } from '../kit.js';
import { island, hpipe, catwalk, tank, vatRing, lake, D } from './refinery-kit.js';

const PI = Math.PI;
const SL = -2.2;
const MY = 3;             // maze deck
const TOP = 16;           // Tank 9 roof

const steel = (c = '#6f7a8c', o = {}) => ({ mat: 'metal', color: c, ...o });
const conc = (c = '#d2d4da', o = {}) => ({ mat: 'concrete', color: c, ...o });
const grate = (o = {}) => ({ mat: 'grate', color: '#b9c3cf', ...o });

/** Unclimbable grate wall panel between (x0,z0)-(x1,z1), height h on deck y, with a steel top rail. */
function grateWall(x0, z0, x1, z1, y, h = 4.2) {
  return [
    box(x0, y, z0, x1, y + h, z1, grate()),
    box(x0 - 0.05, y + h, z0 - 0.05, x1 + 0.05, y + h + 0.16, z1 + 0.05, steel('#f2b134', { paint: false })),
  ];
}

/** Vertical riser pipe (scenery around the rail). */
const riser = (x, z, r, h, c) => [
  cyl(x, -2.8, z, r, h + 2.8, { mat: 'metal', color: c, sides: 16, paint: false }),
  cyl(x, h - 0.6, z, r + 0.14, 0.35, { mat: 'metal', color: '#2b3142', sides: 16, paint: false }),
  cyl(x, 1.2, z, r + 0.14, 0.35, { mat: 'metal', color: '#2b3142', sides: 16, paint: false }),
];

const brushes = [
  // ---------------- spawn deck ----------------
  ...island(0, 6, 14, 10, 0, { color: '#5f6b7c', capColor: '#c9ccd4' }),
  ...tank(-4.8, 9, 1.4, 0, 3.6, { color: '#c7a14a' }),
  block(5, 9.2, 3, 2, 0, 1.1, { mat: 'container', color: '#3a8f7a' }),
  ...catwalk(-1.8, -3.2, 1.8, 1.1, 0, { every: 4 }),
  // ---------------- pipe yard ----------------
  ...island(0, -19, 24, 32, 0, { color: '#6f7a8c', capColor: '#c3c8d2' }),
  ...hpipe('x', -12.2, 12.2, -9, 0, 1.0, { color: '#3aa0a8' }),
  ...hpipe('x', -12.2, 12.2, -18, 0, 1.6, { color: '#c77d3a' }),
  ...hpipe('x', -12.2, 12.2, -27.5, 0, 2.0, { color: '#7a5bd0' }),
  block(-8, -13.2, 2.4, 1, 0, 1.1, conc('#d6d0c6')),
  block(7.5, -22.6, 1, 2.4, 0, 1.1, conc('#d6d0c6')),
  // ---------------- pipe bridge (trunk main) ----------------
  ...hpipe('z', -31.5, -72, 0, -1.2, 2.0, { color: '#4f9a6a', every: 5 }),
  ...[-38, -45, -52, -59, -66].map((z) => block(0, z, 2.6, 1, -2.8, 1.6, steel('#2b3142', { paint: false }))),
  // ---------------- Tank 1 ----------------
  cyl(0, -2.8, -77, 5.5, 5.3, { mat: 'metal', color: '#9aa4b4', sides: 28 }),
  cyl(0, 1.6, -77, 5.66, 0.4, { mat: 'metal', color: '#2b3142', sides: 28, paint: false }),
  cyl(0, 2.5, -77, 4.2, 0.06, { mat: 'tiles', color: '#d6dae2', sides: 28 }),
  // secret valve island (launch pad target)
  ...island(18, -94, 6, 6, 6, { color: '#51596b', capColor: '#b9bfca' }),
  // rail riser forest
  ...riser(-7, -89, 1.2, 11, '#3aa0a8'), ...riser(-15, -99, 1.6, 13, '#c77d3a'), ...riser(-30, -104, 1.4, 10, '#7a5bd0'),
  ...riser(-19, -113, 1.1, 12, '#4f9a6a'), ...riser(-29, -121, 1.8, 14, '#3aa0a8'), ...riser(-5, -112, 1.3, 9, '#c77d3a'),
  ...riser(8, -104, 1.5, 12, '#7a5bd0'), ...riser(-24, -90, 1.0, 9, '#c7a14a'),
  // ---------------- junction C ----------------
  ...island(-10, -130, 12, 10, MY, { color: '#5f6b7c', capColor: '#c3c8d2' }),
  // ---------------- the maze (deck MY) ----------------
  ...island(-10, -150.5, 36, 31, MY, { color: '#6f7a8c', cap: 'asphalt', capColor: '#a9aeb8' }),
  ...grateWall(-28.3, -166, -28, -135, MY),
  ...grateWall(8, -166, 8.3, -135, MY),
  ...grateWall(-28, -135.3, -16, -135, MY),
  ...grateWall(-4, -135.3, 8, -135, MY),
  ...grateWall(-28, -143.15, 2, -142.85, MY),          // divider 1 (gap east)
  ...grateWall(-22, -152.15, 8, -151.85, MY),          // divider 2 (gap west)
  ...grateWall(-28, -166.3, -2, -166, MY),
  ...grateWall(4, -166.3, 8, -166, MY),
  ...hpipe('z', -135.1, -142.85, -1, MY, 1.1, { color: '#c77d3a', every: 3.5 }),   // row 1 blocker
  ...hpipe('z', -143.15, -151.85, -6, MY, 1.3, { color: '#3aa0a8', every: 3.5 }),   // row 2 blockers
  ...hpipe('z', -143.15, -151.85, -17, MY, 0.9, { color: '#7a5bd0', every: 3.5 }),
  ...hpipe('x', -20, -12, -157, MY, 0.55, { color: '#4f9a6a', every: 3 }),           // row 3 low cover
  ...hpipe('x', -9, -3, -162, MY, 0.55, { color: '#c77d3a', every: 3 }),
  cyl(5, MY, -160, 1.8, 4.5, { mat: 'metal', color: '#b9c2cf', sides: 18, paint: false }),   // Snipe Eel perch (unpaintable: a leap off it would clear the exit wall)
  cyl(5, MY + 4.5, -160, 1.95, 0.2, { mat: 'metal', color: '#ffc53a', sides: 18, paint: false }),
  block(-24, -139, 3, 3, MY, 1.1, { mat: 'container', color: '#c83a5a' }),            // dead-end stash
  block(-25.6, -145.4, 2, 2, MY, 1.0, steel('#4a5163')),                            // turret plinth
  // ---------------- Tank 9 plaza ----------------
  ...catwalk(-1, -172.2, 3, -165.8, MY, { every: 3 }),
  ...island(1, -180, 16, 16, MY, { color: '#5f6b7c', capColor: '#c3c8d2' }),
  cyl(1, -2.8, -194, 7, 10 + 2.8, { mat: 'metal', color: '#b9c2cf', sides: 28 }),     // lower tank → 2.5 m ledge at 10 (wide enough to paint the upper tank to its rim)
  cyl(1, 10, -194, 4.5, TOP - 10, { mat: 'metal', color: '#8d93a6', sides: 24 }),     // upper tank → roof at 16
  cyl(1, 6.2, -194, 7.12, 0.3, { mat: 'metal', color: '#2b3142', sides: 28, paint: false, collide: false }),   // visual band only: a solid lip would stop the climb
  cyl(1, TOP, -194, 3.2, 0.05, { mat: 'tiles', color: '#ffc53a', sides: 24 }),
  block(1, -199.8, 3, 2.6, TOP - 0.4, 0.4, steel('#f2b134')),                        // launch balcony
  // ---------------- capsule platform ----------------
  ...island(1, -218, 12, 10, 14, { color: '#51596b', cap: 'tiles', capColor: '#e2e5ec' }),
  cyl(1, 14, -219.5, 2.6, 0.35, { mat: 'tiles', color: '#8be04a', sides: 24 }),
  // ---------------- scenery ----------------
  ...vatRing(24, -30, 6, 0.5, -2.8, 3.4, { color: '#8d93a6', paint: false }),
  ...vatRing(-26, -60, 5, 0.5, -2.8, 2.6, { color: '#7d8799', paint: false }),
  ...vatRing(26, -150, 7, 0.6, -2.8, 4, { color: '#8d93a6', paint: false }),
  ...riser(-40, -180, 2.2, 22, '#51596b'), ...riser(30, -200, 2.6, 26, '#4a5163'), ...riser(-18, -228, 2, 20, '#51596b'),
  ...riser(26, -60, 1.8, 16, '#4a5163'), ...riser(-34, -20, 2.4, 18, '#51596b'),
];

const E = [lake(SL, 0, -110)];
const add = (...xs) => E.push(...xs);
add(
  // spawn + yard
  ent('pearl-trail', 0, 0, 5, { to: [0, 0, 1], count: 3 }),
  ent('pearl-trail', 0, 0, -1.5, { to: [0, 0, -5.5], count: 3 }),
  ent('trigger', 0, 0, -4.5, { size: [22, 3, 3], dialogue: 'w3-2.pipes', hint: 'Ink the pipe, then hold {swim} and swim up it.', hintTime: 6 }),
  ent('glooper', -5, 0, -13.5, { group: 'yard' }),
  ent('glooper', 5.5, 0, -22.5, { group: 'yard' }),
  ent('bomblob', 3.5, 0, -31.5, { group: 'yard', aggro: 22 }),
  ent('shield-glooper', -6, 0, -23, { group: 'yard' }),
  ent('pearl-trail', -3, 1.85, -9, { to: [3, 1.85, -9], count: 3 }),
  ent('pearl-trail', -3, 2.96, -18, { to: [3, 2.96, -18], count: 3 }),
  ent('pearl', 0, 3.7, -27.5),
  ent('crate', 10.4, 0, -12.8, { pearls: 2 }),
  ent('crate', -10.6, 0, -32.8, { pearls: 3 }),
  // bridge
  ent('pearl-trail', 0, 2.5, -37, { to: [0, 2.5, -65], count: 6 }),
  ent('buzzdrone', 0, 2.5, -46, { alt: 4, group: 'bridge', patrol: [[-3, 2.5, -46], [3, 2.5, -50]] }),
  ent('buzzdrone', 0, 2.5, -61, { alt: 4.6, group: 'bridge', patrol: [[3, 2.5, -61], [-3, 2.5, -57]] }),
  // Tank 1
  ent('checkpoint', 1.3, 2.5, -74.6, { yaw: PI, id: 'cp1', radius: 2.4 }),
  ent('trigger', 0, 2.5, -76.5, { size: [10, 3, 4], dialogue: 'w3-2.rail', objective: 'Ride the rail through the pipe works' }),
  ent('ink-rail', 0, 3.15, -79.6, { id: 'rail1', points: [[0, 3.15, -79.6], [-2.5, 3.4, -85], [-8.5, 4.2, -91.5], [-16.5, 5.1, -95.5], [-24, 5.4, -102], [-26.5, 4.8, -111], [-22.5, 4.2, -117.5], [-16, 3.8, -121.6], [-12.6, 3.6, -125.6]] }),
  ent('launchpad', 3.4, 2.5, -80.2, { id: 'pad-secret', target: [18, 6, -93] }),
  ent('pearl-trail', -12, 5.8, -93.8, { to: [-22, 6.3, -99.5], count: 4, arc: 0.4 }),
  // secret valve island
  ent('postcard', 19.4, 6, -95.6, { id: 'w3-2-postcard', title: 'Lost in the Pipes', text: 'Day 3 in the pipe works. I have named all the pipes. Gary is my favourite. Gary does not talk back.' }),
  ent('pearl-trail', 16, 6, -92, { to: [20, 6, -92], count: 3 }),
  ent('launchpad', 16.6, 6, -95.8, { id: 'pad-back', target: [-7, MY, -129.5] }),
  // junction C
  ent('checkpoint', -9.4, MY, -129.4, { yaw: PI, id: 'cp2', radius: 2.4 }),
  ent('crate', -5.2, MY, -126.2, { pearls: 2 }),
  ent('trigger', -10, MY, -134, { size: [12, 3, 2.5], dialogue: 'w3-2.lost', objective: 'Find a way through the pipe maze' }),
  // maze row 1 (→ east)
  ent('pearl-trail', -8, MY, -138.5, { to: [-3.2, MY, -138.5], count: 4 }),
  ent('pearl-trail', 1.6, MY, -139, { to: [5, MY, -141.5], count: 3 }),
  ent('glooper', 4.5, MY, -137.5, { group: 'maze', aggro: 14 }),
  ent('glooper', -12, MY, -140.5, { group: 'maze', aggro: 14 }),
  ent('crate', -24, MY + 1.1, -139, { pearls: 4 }),
  ent('pearl-trail', -19, MY, -137, { to: [-26, MY, -137], count: 3 }),
  // row 2 (→ west)
  ent('pearl-trail', 5, MY, -145, { to: [5, MY, -149], count: 3 }),
  ent('pearl-trail', 1, MY, -147.5, { to: [-3.5, MY, -147.5], count: 3 }),
  ent('pearl-trail', -9, MY, -147.5, { to: [-14.5, MY, -147.5], count: 3 }),
  ent('murk-pod', -11.5, MY, -149.5, { group: 'maze', max: 2, interval: 5 }),
  ent('murk-turret', -25.6, MY + 1.0, -145.4, { group: 'maze', yaw: PI / 2, aggro: 16 }),
  ent('pearl-trail', -20, MY, -147.5, { to: [-25, MY, -150], count: 3 }),
  // row 3 (→ east)
  ent('pearl-trail', -25, MY, -154.5, { to: [-21, MY, -159.5], count: 3 }),
  ent('pearl-trail', -9, MY, -160, { to: [-1, MY, -164], count: 3 }),
  ent('shield-glooper', -13, MY, -160.5, { group: 'maze', yaw: -PI / 2, aggro: 16 }),
  ent('snipe-eel', 5, MY + 4.7, -160, { group: 'maze', yaw: -PI / 2, aggro: 32 }),
  ent('glooper', -2, MY, -159, { group: 'maze', yaw: -PI / 2 }),
  ent('murk-barrier', 1, MY, -166.15, { size: [6, 4.2, 0.4], group: 'maze', id: 'bar-maze' }),
  // Tank 9
  ent('checkpoint', 2.4, MY, -174.6, { yaw: PI, id: 'cp3', radius: 2.4 }),
  ent('trigger', 1, MY, -174, { size: [14, 3, 3], objective: 'Climb Tank 9 and launch to the Prism Capsule', hint: 'Paint the tank as high as you can, then swim up. Rest on the ledge!', hintTime: 6 }),
  ent('pearl-trail', -2.6, 10, -188.3, { to: [4.6, 10, -188.3], count: 4, arc: 0 }),
  ent('checkpoint', 2.6, TOP, -190.8, { yaw: PI, id: 'cp4', radius: 2.4 }),
  ent('murk-pod', -1.4, TOP, -195.8, { group: 'top', max: 2, interval: 5 }),
  ent('shield-glooper', 3, TOP, -196, { group: 'top' }),
  ent('buzzdrone', 1, TOP, -194, { alt: 3.4, group: 'top' }),
  ent('murk-barrier', 1, TOP, -198.7, { size: [3, 3, 0.4], group: 'top', id: 'bar-top' }),
  ent('launchpad', 1, TOP, -200.2, { id: 'pad-final', target: [1, 14, -215.5] }),
  ent('pearl-trail', -0.5, 14, -214.5, { to: [2.5, 14, -214.5], count: 2 }),
  ent('prism-core', 1, 14.35, -219.6, { id: 'core' }),
);
add(
  // spawn
  D('neon-sign', 0, 0, 1.2, { text: 'PIPE WORKS', color: '#2fd6ff', height: 3.2, pole: true }),
  D('lamp', -6.4, 0, 1.6, { yaw: PI / 4 }), D('lamp', 6.4, 0, 1.6, { yaw: -PI / 4 }),
  D('barrel', 3.6, 0, 10.2, { variant: 'toxic' }), D('barrel', 2.8, 0, 10.4), D('crate-stack', 5, 1.1, 9.2, { count: 2 }),
  D('speaker-tower', -6.2, 0, 4.6, { height: 2.8, color: '#2fd6ff', yaw: PI / 2 }),
  D('railing', -1.95, 0, -1.05, { yaw: PI / 2, length: 4, color: '#f2b134' }), D('railing', 1.95, 0, -1.05, { yaw: -PI / 2, length: 4, color: '#f2b134' }),
  D('billboard', 12, SL, 6, { yaw: -PI / 2, text: 'Murk Industries' }),
  // yard
  D('lamp', -11.4, 0, -4, { yaw: PI / 4 }), D('lamp', 11.4, 0, -4, { yaw: -PI / 4 }),
  D('lamp', -11.4, 0, -22.5, { yaw: PI / 2, light: '#c8ffb0' }), D('lamp', 11.4, 0, -13, { yaw: -PI / 2, light: '#c8ffb0' }),
  D('barrel', 9.6, 0, -11.4, { variant: 'toxic' }), D('barrel', 10.6, 0, -14.8), D('barrel', -9.8, 0, -21.4, { variant: 'toxic' }),
  D('crate-stack', 9.4, 0, -31.6, { count: 3, yaw: 0.3 }), D('crate-stack', -9, 0, -5, { count: 2, yaw: -0.2 }),
  D('cone', -3, 0, -5.2), D('cone', 2.6, 0, -5.4), D('cone', 6.8, 0, -14.4),
  D('graffiti', 0, 0, -16.45, { text: 'CLIMB!', size: 3.2, height: 1.4, color: '#ffd23f', color2: '#ff3fa4' }),
  D('graffiti', -6, 0, -25.6, { style: 'arrow', size: 2.4, height: 1.6, color: '#2fd6ff', color2: '#ffffff' }),
  D('pipe', 11.6, 0, -24, { yaw: PI / 2, length: 7, radius: 0.3, height: 0.6, color: '#c77d3a' }),
  D('pipe', -11.6, 0, -15, { yaw: PI / 2, length: 5, radius: 0.25, height: 0.5, color: '#3aa0a8' }),
  D('neon-sign', 7.2, 0, -25.6, { text: 'GARY', color: '#ff7ab8', height: 2.6 }),
  D('flag', -11.2, 0, -34.4, { color: '#6a2bd9' }), D('flag', 11.2, 0, -34.4, { color: '#6a2bd9' }),
  // bridge + tank 1
  D('buoy', -6, SL, -44, { color: '#8be04a' }), D('buoy', 7, SL, -56, { color: '#6a2bd9', light: '#ffcc33' }),
  D('vat', 12, SL, -48, { radius: 2.4, height: 5, glow: '#8be04a', scale: 1.3 }), D('vat', -13, SL, -64, { radius: 2.2, height: 6, glow: '#b58cff', scale: 1.3 }),
  D('lamp', -4.4, 2.5, -80.4, { yaw: PI * 0.6 }), D('lamp', 4.6, 2.5, -74.4, { yaw: -PI / 2 }),
  D('neon-sign', -3.4, 2.5, -73.4, { text: 'RAIL EXPRESS', color: '#ffc53a', height: 2.4, pole: true, yaw: PI / 5 }),
  D('barrel', -3.6, 2.5, -74.2, { variant: 'toxic' }), D('crate-stack', 2, 2.5, -81.2, { count: 2, yaw: 0.6 }),
  D('chimney', 30, SL, -84, { scale: 3.2 }), D('chimney', -40, SL, -120, { scale: 3 }), D('chimney', 34, SL, -128, { scale: 2.6 }),
  // secret island
  D('pipe', 18, 6, -91.6, { length: 5, radius: 0.35, height: 0.5, color: '#ff7ab8' }),
  D('lamp', 20.4, 6, -96.4, { yaw: -PI * 0.75, light: '#ffb3e6' }), D('barrel', 15.6, 6, -91.6),
  // junction
  D('lamp', -15.4, MY, -125.6, { yaw: PI * 0.75 }), D('lamp', -4.6, MY, -125.6, { yaw: -PI * 0.75 }),
  D('neon-sign', -10, MY, -135.35, { text: 'THIS WAY?', color: '#8be04a', height: 5.2 }),
  D('barrel', -15.2, MY, -131, { variant: 'toxic' }), D('crate-stack', -14.4, MY, -133.4, { count: 2 }),
  // maze
  D('graffiti', -8, MY, -142.8, { style: 'arrow', size: 2.2, height: 1.4, color: '#ffd23f', color2: '#ff3f6c', yaw: 0 }),
  D('graffiti', 4, MY, -151.8, { text: 'LEFT!', size: 2.4, height: 1.6, color: '#2fd6ff', color2: '#ffffff' }),
  D('graffiti', -15, MY, -152.2, { style: 'arrow', size: 2.2, height: 1.4, color: '#ffd23f', color2: '#ff3f6c', yaw: PI }),
  D('pipe', -13, MY + 4.4, -142.4, { length: 29, radius: 0.28, height: 0.2, color: '#3aa0a8' }),
  D('pipe', -7, MY + 4.4, -152.4, { length: 29, radius: 0.28, height: 0.2, color: '#c77d3a' }),
  D('lamp', 7.4, MY, -136, { yaw: -PI * 0.75, light: '#c8ffb0' }), D('lamp', -27.4, MY, -150.6, { yaw: PI / 2, light: '#c8ffb0' }),
  D('lamp', 7.4, MY, -165.4, { yaw: -PI / 4, light: '#c8ffb0' }), D('lamp', -27.4, MY, -136, { yaw: PI * 0.75 }),
  D('barrel', 6.6, MY, -144.2, { variant: 'toxic' }), D('barrel', 7.2, MY, -145.1), D('barrel', -27, MY, -165),
  D('barrel', -27.2, MY, -153.2, { variant: 'toxic' }), D('crate-stack', -2.6, MY, -144.6, { count: 2, yaw: 0.2 }),
  D('vat', -21, MY, -163.6, { radius: 1.1, height: 2.2, glow: '#8be04a' }), D('vat', 6.2, MY, -155, { radius: 1, height: 2, glow: '#b58cff' }),
  D('speaker-tower', -26.6, MY, -141.6, { height: 2.2, color: '#8be04a', yaw: PI / 2 }),
  // Tank 9 plaza
  D('neon-sign', -4.4, MY, -186.2, { text: 'TANK 9', color: '#ffc53a', height: 3.4, pole: true, yaw: 0.3 }),
  D('lamp', -6.4, MY, -173, { yaw: PI * 0.75 }), D('lamp', 8.4, MY, -173, { yaw: -PI * 0.75 }),
  D('lamp', -6.4, MY, -187, { yaw: PI / 4 }), D('lamp', 8.4, MY, -187, { yaw: -PI / 4 }),
  D('barrel', -5.8, MY, -178, { variant: 'toxic' }), D('barrel', -6.2, MY, -179, { variant: 'toxic' }), D('crate-stack', 7.4, MY, -181, { count: 3, yaw: 1.2 }),
  D('flag', -2.2, MY, -187.2, { color: '#6a2bd9' }), D('flag', 4.2, MY, -187.2, { color: '#6a2bd9' }),
  D('pipe', -6.6, MY, -180, { yaw: PI / 2, length: 10, radius: 0.3, height: 0.5, color: '#4f9a6a' }),
  D('antenna', -1.6, TOP, -197, { height: 2.4, variant: 'radar' }), D('satellite', 4.2, TOP, -193.4, { yaw: PI }),
  D('railing', 1, TOP, -201, { length: 3, color: '#f2b134' }),
  // capsule platform
  D('lamp', -4, 14, -214, { yaw: PI * 0.75 }), D('lamp', 6, 14, -214, { yaw: -PI * 0.75 }),
  D('flag', -3.6, 14, -221.8, { color: '#8be04a' }), D('flag', 5.6, 14, -221.8, { color: '#8be04a' }),
  D('billboard', 1, 14, -223.4, { text: 'ColorPlus' }),
  D('buoy', -12, SL, -205, { color: '#8be04a' }), D('buoy', 14, SL, -214, { color: '#6a2bd9' }),
  D('chimney', -26, SL, -240, { scale: 3.4 }), D('chimney', 22, SL, -246, { scale: 3 }),
);

export default {
  id: 'w3-2',
  name: 'Pipe Dream',
  world: 3,
  theme: 'refinery',
  music: 'refinery',
  themeOverride: { hemiIntensity: 0.98, sunIntensity: 1.32, exposure: 1.12 },
  waterY: SL,
  water: false,
  killY: -3.4,
  spawn: { pos: [0, 0, 8], yaw: PI },
  objective: 'Navigate the pipe works to the Prism Capsule',
  brushes,
  preInk: [
    murk(0, 0, -13, 2.2), murk(5, 0, -22, 2), murk(-4, 0, -23, 1.8), murk(2, 0, -31, 2),
    murk(0, 2.5, -77, 2.2), murk(-10, MY, -130, 1.6),
    murk(-2, MY, -139, 2), murk(4, MY, -147, 1.8), murk(-11.5, MY, -149.5, 2.6), murk(-24, MY, -156, 2), murk(-8, MY, -160, 2.2),
    murk(1, MY, -180, 2.4), murk(1, TOP, -194, 2.6), murk(1, 14, -219, 1.8),
  ],
  entities: E,
  route: [
    [0, 0, 8], [0, 0, 0], [0, 0, -6], [0, 1.85, -9, 'climb'], [0, 0, -12], [0, 2.96, -18, 'climb'], [0, 0, -22],
    [0, 3.7, -27.5, 'climb'], [0, 2.5, -33], [0, 2.5, -50], [0, 2.5, -70], [0, 2.5, -79],
    [-9.5, MY, -130.5, 'rail'], [-10, MY, -133], [-4, MY, -139], [-1, MY + 2.03, -139, 'climb'], [4.5, MY, -139],
    [5, MY, -147], [-3.5, MY, -147], [-6, MY + 2.4, -147, 'climb'], [-9, MY, -147], [-15, MY, -147],
    [-17, MY + 1.66, -147, 'climb'], [-20, MY, -147], [-25, MY, -148], [-25, MY, -155], [-11, MY, -155],
    [-3, MY, -159.5], [1, MY, -165], [1, MY, -170], [1, MY, -180], [1, MY, -186.5], [1, 10, -188.8, 'climb'],
    [1, TOP, -191, 'climb'], [1, TOP, -197], [1, TOP, -200], [1, 14, -215.5, 'launch'], [1, 14, -218],
  ],
};
