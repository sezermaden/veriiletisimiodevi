// 1-2 Container Crossing — Murk's container terminal: three quay islands joined by a sponge
// bridge and two gangways, on a gray, overcast morning. Beats (DIALOGUE ids, in order):
//
//   A  Ferry pier (spawn)
//   B  Gate yard      corner ambush (2 Gloopers); a grate loading-dock wall: ink the sponge ... 'w1-2.sponge'
//   C  Dock 4 (y 3.4) checkpoint 1; Shield Glooper squad → gate ........................... 'w1-2.shield'
//   D  Crate yard     breakable crates (pearls), 3 Gloopers; hidden "duck container" ........ 'w1-2.crates'
//   E  Canal 1        checkpoint 2; two sponges on pontoons = the bridge (Murk shrinks them)
//   F  The Alley      Rollerbrute lane between container walls + squad → Murk barrier ....... 'w1-2.rollerbrute'
//   G  Yard C         checkpoint 3; big mixed squad under the gantry crane → barrier ......... 'w1-2.pa'
//   H  Capsule barge  Prism Capsule
//
// Islands: 1 = z -4..-92, 2 = z -106..-150, 3 = z -162..-200; barge z -211..-229. Path runs -Z.
import { block, box, cyl, ramp, prism, container, ent, murk } from '../kit.js';
import { PI, D, SCENERY, pier, quay, bollards, containerStack, fishingBoat, cargoShip, farWarehouses } from './docks-kit.js';

const DOCK = 2.7;            // two sponge steps (1.0 → 1.9) → a kid jump onto the dock
const T = (x, y, z, o) => ent('trigger', x, y, z, o);
const GRATE = { mat: 'grate', color: '#ffffff' };

/** Open-ended container shell (rotY 1: long along Z), open toward -z. */
function openContainer(cx, y0, cz, color) {
  const x0 = cx - 1.25, x1 = cx + 1.25, z0 = cz - 4, z1 = cz + 4, o = { mat: 'container', color };
  return [
    box(x0, y0 + 2.4, z0, x1, y0 + 2.6, z1, o),
    box(x0, y0, z0, x0 + 0.18, y0 + 2.4, z1, o),
    box(x1 - 0.18, y0, z0, x1, y0 + 2.4, z1, o),
    box(x0, y0, z1 - 0.18, x1, y0 + 2.4, z1, o),
    box(x0 + 0.18, y0, z0 + 0.4, x1 - 0.18, y0 + 0.04, z1, { mat: 'wood', color: '#9c6c44' }),
  ];
}

/** Container gantry crane (set piece): two portal frames, a girder, trolley and a hanging box. */
function gantryCrane(x0, x1, z0, z1, H, color = '#f2c230') {
  const leg = { mat: 'metal', color, paint: false, castShadow: true };
  const out = [];
  for (const x of [x0, x1]) for (const z of [z0, z1]) out.push(block(x, z, 1.2, 1.2, 0, H, leg));
  for (const x of [x0, x1]) out.push(box(x - 0.8, H, z1 - 0.6, x + 0.8, H + 1.4, z0 + 0.6, SCENERY({ mat: 'metal', color })));
  for (const z of [z0, z1]) out.push(box(x0 - 0.8, H + 1.4, z - 0.9, x1 + 0.8, H + 2.6, z + 0.9, SCENERY({ mat: 'metal', color })));
  for (const x of [x0, x1]) for (const z of [z0, z1]) out.push(block(x, z, 2.2, 1.6, 0, 0.8, { mat: 'metal', color: '#2b3144', paint: false }));
  const tx = x0 + (x1 - x0) * 0.35;
  out.push(block(tx, (z0 + z1) / 2, 3.2, Math.abs(z1 - z0) + 2.4, H + 2.6, 1.2, SCENERY({ mat: 'metal', color: '#2b3144' })));
  out.push(block(tx, (z0 + z1) / 2, 0.08, 0.08, H - 4.5, 7.1, SCENERY({ mat: 'metal', color: '#1b1f2e' })));
  out.push(block(tx, (z0 + z1) / 2, 8.2, 2.7, H - 7.4, 2.6, SCENERY({ mat: 'container', color: '#2fb6c8' })));
  return out;
}

const brushes = [
  // ---------------- A: ferry pier ----------------
  ...pier(-6, 14, 6, -4, 0, { edges: 'x' }),
  ...quay(7, 6, 14, -4, 0, { mat: 'concrete', color: '#d8d2c8' }),
  block(10.5, 1.5, 4.4, 4.4, 0, 3, { mat: 'plaster', color: '#f2c230' }),              // gatehouse
  block(10.5, 1.5, 5, 5, 3, 0.3, { mat: 'metal', color: '#2b3144' }),
  block(8.24, 1.5, 0.1, 2.8, 1.1, 1.3, { mat: 'glass', color: '#bfe8ff' }),
  ...fishingBoat(-11, 4, { length: 15, width: 4.6, hull: '#f4f1ea', stripe: '#e0612b', cabin: '#8fc6d8' }),
  ...bollards(-5.6, 12, -5.6, -2, 4),

  // ---------------- B: gate yard (island 1) ----------------
  ...quay(-16, -4, 16, -34.5, 0, { mat: 'concrete', color: '#cfc8bd', stripe: false }),
  ...containerStack(-14.75, -8.5, 2, 0, 1), ...containerStack(-14.75, -17, 2, 2, 1), ...containerStack(-14.75, -25.5, 1, 4, 1),
  ...containerStack(14.75, -8.5, 2, 6, 1), ...containerStack(14.75, -17, 2, 8, 1), ...containerStack(14.75, -25.5, 1, 1, 1),
  container(-6, 0, -12, '#e0a02b'),                                    // ambush corner 1
  ...containerStack(7, -20, 2, 3, 0),                                  // ambush corner 2
  container(-7, 0, -25, '#2fb6c8', 1),
  block(3, -9, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#f2c230' }),
  box(-16, 0, -34.5, 16, DOCK, -33.9, GRATE),                          // loading-dock wall (grate: no climbing)
  ...[-14, -9.5, -5, 5, 9.5, 14].map((x) => block(x, -33.78, 0.36, 0.24, 0, DOCK, SCENERY({ mat: 'metal', color: '#f2c230' }))),
  box(-16, DOCK - 0.32, -33.9, 16, DOCK, -33.66, SCENERY({ mat: 'metal', color: '#f2c230' })),
  box(-1.9, -0.02, -33.9, 1.9, 0.02, -27.4, { mat: 'concrete', color: '#f2c230', collide: false }),   // sponge pad marking

  // ---------------- C: Dock 4 ----------------
  block(0, -43.25, 32, 17.5, 0, DOCK, { mat: 'concrete', color: '#d6cfc4' }),
  box(-16, DOCK, -52, -4.5, DOCK + 2.4, -51.8, GRATE),                 // rear security fence
  box(4.5, DOCK, -52, 16, DOCK + 2.4, -51.8, GRATE),
  ...[-16, -10, 10, 16].map((x) => block(x, -51.9, 0.3, 0.3, DOCK, 2.5, SCENERY({ mat: 'metal', color: '#f2c230' }))),
  container(-9, DOCK, -41, '#35b56a'),
  container(9.5, DOCK, -45.5, '#d9482b'),
  block(2.5, -40.5, 2.4, 1, DOCK, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  block(-3, -46, 1, 2.4, DOCK, 1.0, { mat: 'concrete', color: '#f2c230' }),

  // ---------------- D: crate yard ----------------
  ...quay(-16, -52, 16, -92, 0, { mat: 'concrete', color: '#d6cec2', stripeSides: '-z' }),
  ramp(-4, 0, -61, 4, DOCK, -52, '+z', { mat: 'concrete', color: '#e0d9cf' }),
  ...containerStack(-8, -72, 2, 5, 0),
  ...containerStack(8.75, -76, 1, 7, 1),
  container(0, 0, -82, '#8a4bd8'),
  ...containerStack(12.5, -60, 2, 9, 1),
  container(-12.75, 0, -86, '#4a6fd8', 1),                             // base of the duck container
  ...openContainer(-12.75, 2.6, -86, '#f2c230'),

  // ---------------- E: canal 1 (sponge bridge) ----------------
  cyl(0, -3.2, -96.2, 1.3, 2.9, { mat: 'concrete', color: '#b9b3ab', paint: false, sides: 12 }),
  cyl(0, -3.2, -101.4, 1.3, 2.9, { mat: 'concrete', color: '#b9b3ab', paint: false, sides: 12 }),
  cyl(-8, -3.2, -99, 0.35, 3.6, SCENERY({ mat: 'wood', color: '#7a5a3e', sides: 8 })),
  cyl(8, -3.2, -99, 0.35, 3.6, SCENERY({ mat: 'wood', color: '#7a5a3e', sides: 8 })),

  // ---------------- F: the alley (island 2) ----------------
  ...quay(-16, -106, 16, -150, 0, { mat: 'asphalt', color: '#c4bdb3', stripeSides: '+z-z' }),
  ...containerStack(-7.25, -112, 2, 1, 1), ...containerStack(-7.25, -122.5, 2, 3, 1), ...containerStack(-7.25, -133, 2, 5, 1),
  ...containerStack(7.25, -112, 2, 7, 1), ...containerStack(7.25, -122.5, 2, 9, 1), ...containerStack(7.25, -133, 2, 2, 1),
  block(12.5, -143, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#f2c230' }),
  block(-12, -145, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  ...pier(-2.5, -150, 2.5, -162, 0, { edges: 'x', color: '#b88a5e' }),

  // ---------------- G: Yard C (island 3) ----------------
  ...quay(-22, -162, 22, -200, 0, { mat: 'concrete', color: '#d2cbc1', stripeSides: '+z-z' }),
  ...containerStack(-12, -172, 2, 4, 0),
  container(12, 0, -178, '#e0612b'),
  container(-4.5, 0, -184, '#2f7fd8', 1),
  ...containerStack(15, -190, 2, 6, 1),
  block(5, -170, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#f2c230' }),
  block(4, -189, 1.2, 2.6, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  block(-15, -191, 2.4, 2.4, 0, 1.3, { mat: 'wood', color: '#b8845a' }),
  ...gantryCrane(-19, 19, -168, -192, 15),
  ...pier(-2.5, -200, 2.5, -211, 0, { edges: 'x', color: '#b88a5e' }),

  // ---------------- H: capsule barge ----------------
  box(-9, -0.4, -229, 9, 0, -211, { mat: 'metal', color: '#c3cad6' }),
  prism([[-9.4, -210.6], [9.4, -210.6], [9.4, -226], [4, -231], [-4, -231], [-9.4, -226]], -2.4, -0.4, SCENERY({ mat: 'metal', color: '#2f4f8a' })),
  prism([[-9.5, -210.5], [9.5, -210.5], [9.5, -226], [4.05, -231.1], [-4.05, -231.1], [-9.5, -226]], -1.6, -1.2, SCENERY({ mat: 'metal', color: '#f4f1ea' })),
  ...bollards(-8.5, -212, -8.5, -228, 4), ...bollards(8.5, -212, 8.5, -228, 4),

  // ---------------- scenery ----------------
  ...cargoShip(46, -150, { length: 96, width: 18, seed: 5, hull: '#8a2b3a' }),
  ...farWarehouses(20, -70, 9, { dir: -1 }).map((b) => ({ ...b, min: [b.min[2], b.min[1], b.min[0]], max: [b.max[2], b.max[1], b.max[0]] })),
  ...containerStack(-24, -130, 3, 2, 1, 0, { brush: SCENERY() }), ...containerStack(-26.6, -130, 2, 5, 1, 0, { brush: SCENERY() }),
  box(-30, -3.5, -140, -21, 0, -118, SCENERY({ mat: 'concrete', color: '#b9b3ab' })),
];

const entities = [
  // ---------------- A ----------------
  ent('pearl-trail', 0, 0, 4, { to: [0, 0, -2], count: 4 }),
  D('lamp', -5.5, 0, 6, { yaw: PI / 2 }), D('lamp', 5.5, 0, -1, { yaw: -PI / 2 }),
  D('railing', 3.4, 0, -3.6, { length: 5, color: '#e0442a' }),
  D('neon-sign', 10.5, 3.3, 3.8, { text: 'YARD C', color: '#ffc53a', height: 0.9 }),
  D('bench', -5.2, 0, 1, { yaw: PI / 2 }), D('vending', 12.6, 0, -2, { yaw: PI, color: '#2fb6ff' }),
  D('flag', 13.4, 0, 5.4, { color: '#6a2bd9', height: 5.5 }), D('cone', 2, 0, -3.2), D('cone', 4.6, 0, -3.2),
  D('buoy', 8, -1.6, 14), D('buoy', -18, -1.6, -6, { color: '#2fb35a', light: '#ff3030' }),
  D('billboard', 12, 0, -8, { yaw: -PI / 2 + 0.25, text: 'Murk Industries' }),

  // ---------------- B ----------------
  T(0, 0, -6, { size: [12, 3, 3], objective: 'Cross the gate yard', hint: 'Watch the corners!' }),
  ent('glooper', -6, 0, -15.6, { group: 'amb', yaw: 0 }),
  ent('glooper', 8.5, 0, -23.2, { group: 'amb', yaw: 0.3 }),
  ent('pearl-trail', -12, 0, -10, { to: [-12, 0, -22], count: 5 }),
  T(0, 0, -24.5, { size: [26, 3, 3], dialogue: 'w1-2.sponge', objective: 'Puff up the sponges and climb onto the dock', hint: 'Shoot both sponges to puff them up, then hop up them like stairs' }),
  // two sponge steps: full tops at 1.0 and 1.9, dock at 2.7 (every rise is a kid jump, and a
  // player who falls back off the dock can always climb again)
  ent('sponge', 0, 0, -29, { id: 'sponge-step', size: [2.6, 1.0, 2.6] }),
  ent('sponge', 0, 0, -32.3, { id: 'sponge-dock', size: [3, 1.9, 3] }),
  ent('pearl', 0, DOCK, -35.3), ent('pearl', -1, DOCK, -35.3), ent('pearl', 1, DOCK, -35.3),
  D('graffiti', -9, 0.5, -33.85, { text: 'DOCK 4', size: 4.5, color: '#ffd23f', color2: '#ff8a1f' }),
  D('graffiti', 9, 0.4, -33.85, { style: 'squid', size: 3, color: '#2fd6ff', color2: '#ff5fa8' }),
  D('lamp', -3.5, 0, -33.2, { yaw: 0 }), D('lamp', 3.5, 0, -33.2, { yaw: 0 }),
  D('crate-stack', -11.5, 0, -30.5, { count: 3, yaw: 0.2 }), D('barrel', 12.5, 0, -30.5), D('barrel', 11.8, 0, -31.2, { variant: 'toxic' }),
  D('tire-stack', 1.5, 0, -14, { count: 4 }), D('cone', -1.2, 0, -21), D('hydrant', 12.8, 0, -4.8),

  // ---------------- C ----------------
  ent('checkpoint', 5.5, DOCK, -37, { id: 'cp1', yaw: PI }),
  T(0, DOCK, -38.8, { size: [32, 3, 2], dialogue: 'w1-2.shield', objective: 'Splat the Shield Glooper squad' }),
  ent('shield-glooper', 0, DOCK, -47.8, { group: 'dock', yaw: 0 }),
  ent('glooper', -8.5, DOCK, -46.5, { group: 'dock', yaw: 0.3 }),
  ent('glooper', 9.5, DOCK + 2.6, -45.5, { group: 'dock', yaw: -0.2 }),
  ent('gate', 0, DOCK, -51.9, { id: 'gate-dock', size: [8, 3.2, 0.5], openOn: 'group:dock' }),
  ent('pearl-trail', -13.5, DOCK, -38, { to: [-13.5, DOCK, -49], count: 4 }),
  D('crane', -21, 0, -44, { yaw: PI / 2 }),
  D('lamp', 15.4, DOCK, -40, { yaw: -PI / 2 }), D('lamp', -15.4, DOCK, -48, { yaw: PI / 2 }),
  D('barrel', 14.6, DOCK, -50.5), D('barrel', 15.2, DOCK, -49.6), D('crate-stack', -13, DOCK, -44, { count: 2, yaw: 0.5 }),
  D('neon-sign', 0, DOCK + 3.9, -51.7, { text: 'AUTHORIZED GRAY ONLY', color: '#b77dff', height: 0.5 }),
  D('speaker-tower', 14.5, DOCK, -36, { height: 2.2, color: '#b77dff' }),

  // ---------------- D ----------------
  T(0, 0, -62.5, { size: [8, 3, 2], dialogue: 'w1-2.crates' }),
  ent('crate', -5.6, 0, -64.5, { pearls: 2 }), ent('crate', -6.9, 0, -65.6, { pearls: 2 }), ent('crate', -5.9, 1.2, -65.2, { pearls: 2, size: 1 }),
  ent('crate', 6, 0, -66, { pearls: 2 }), ent('crate', 5.2, 0, -67.4, { pearls: 3, size: 1.5 }),
  ent('crate', -2.5, 0, -76, { pearls: 2 }), ent('crate', 14, 0, -84, { pearls: 2 }), ent('crate', 14.4, 0, -82.6, { pearls: 2 }),
  ent('crate', -14.4, 0, -66, { pearls: 3, size: 1.5 }),
  ent('glooper', -10, 0, -79.5, { group: 'yard', yaw: 0.3 }),
  ent('glooper', 9.5, 0, -86, { group: 'yard', yaw: -0.2 }),
  ent('glooper', 0, 2.6, -82, { group: 'yard', yaw: 0 }),
  ent('pearl-trail', 3.5, 0, -63, { to: [3.5, 0, -74], count: 4 }),
  // the duck container (hidden)
  ent('postcard', -12.75, 2.64, -84.6, { id: 'w1-2-postcard', title: 'Container Yard C', from: 'A dockworker', text: 'Found a crate full of rubber ducks. Did not report it. The ducks are mine now. All 400 of them.' }),
  ent('pearl-trail', -12.75, 2.64, -89.2, { to: [-12.75, 2.64, -86.4], count: 3 }),
  D('crate-stack', -12.75, 2.64, -83.1, { count: 2, yaw: PI / 2, color: '#ffe066' }),
  D('lamp', 15.4, 0, -70, { yaw: -PI / 2 }), D('lamp', -15.4, 0, -60, { yaw: PI / 2 }),
  D('tire-stack', 10.5, 0, -56, { count: 3 }), D('barrel', -15, 0, -74), D('barrel', -14.4, 0, -74.8, { variant: 'toxic' }),
  D('cone', -1.5, 0, -88), D('cone', 1.5, 0, -88),
  D('graffiti', -3.95, 0.3, -72, { yaw: PI / 2, text: 'CRATE ESCAPE', size: 3.4, color: '#ff8a1f', color2: '#ffd23f' }),

  // ---------------- E ----------------
  ent('checkpoint', 6.5, 0, -88.8, { id: 'cp2', yaw: PI }),
  T(0, 0, -89.8, { size: [32, 3, 3], objective: 'Build a sponge bridge across the canal', hint: 'Ink both sponges to puff them up. Murk ink shrinks them!' }),
  ent('sponge', 0, -0.3, -96.2, { id: 'sponge-a', size: [4, 0.8, 4] }),
  ent('sponge', 0, -0.3, -101.4, { id: 'sponge-b', size: [4, 0.8, 4] }),
  ent('glooper', -10, 0, -108.8, { group: 'canal', yaw: 0.3 }),
  ent('glooper', 10, 0, -108.8, { group: 'canal', yaw: -0.3 }),
  D('buoy', -12, -1.6, -99, { color: '#f2c230' }), D('buoy', 13, -1.6, -99, { color: '#2fb35a', light: '#ff3030' }),
  D('lamp', -3.4, 0, -91.4, { yaw: 0 }), D('lamp', 3.4, 0, -91.4, { yaw: 0 }),

  // ---------------- F ----------------
  T(0, 0, -109.5, { size: [12, 3, 3], dialogue: 'w1-2.rollerbrute', objective: 'Get past the Rollerbrute' }),
  ent('rollerbrute', 0, 0, -143, { group: 'alley', yaw: 0, aggro: 24 }),
  ent('glooper', -7.25, 5.2, -131, { group: 'alley', yaw: 0.4 }),
  ent('glooper', 12, 0, -133, { group: 'alley', yaw: 0 }),
  ent('shield-glooper', 3.5, 0, -147, { group: 'alley', yaw: 0 }),
  ent('murk-barrier', 0, 0, -150.2, { id: 'bar-alley', size: [5, 4, 0.4], group: 'alley' }),
  ent('crate', 12, 0, -117.2, { pearls: 2 }), ent('crate', -12.5, 0, -127.8, { pearls: 2 }), ent('crate', -13.2, 0, -129.2, { pearls: 2 }),
  ent('pearl-trail', 12, 0, -110, { to: [12, 0, -128], count: 5 }),
  ent('pearl-trail', 7.25, 5.2, -109, { to: [7.25, 5.2, -136], count: 4 }),
  D('barrel', -12, 0, -112), D('barrel', -12.8, 0, -112.6, { variant: 'toxic' }), D('barrel', 13.4, 0, -140),
  D('crate-stack', -13.5, 0, -118, { count: 3 }), D('tire-stack', 14.5, 0, -121.5, { count: 4 }),
  D('lamp', -15.4, 0, -138, { yaw: PI / 2 }), D('lamp', 15.4, 0, -126, { yaw: -PI / 2 }),
  D('graffiti', -5.95, 0.4, -122.5, { yaw: PI / 2, text: 'DUCK!', size: 3.4, color: '#ff5fa8', color2: '#ffd23f' }),
  D('graffiti', 5.95, 0.4, -112, { yaw: -PI / 2, style: 'arrow', size: 3, color: '#2fd6ff', color2: '#ffffff' }),
  D('crane', 21, 0, -128, { yaw: -PI / 2, color: '#e0612b' }),
  D('flag', -2.3, 0, -150.9, { color: '#6a2bd9', height: 4 }), D('flag', 2.3, 0, -150.9, { color: '#6a2bd9', height: 4 }),

  // ---------------- G ----------------
  T(0, 0, -163.5, { size: [8, 3, 3], dialogue: 'w1-2.pa', objective: 'Clear Yard C' }),
  ent('checkpoint', 4.5, 0, -165, { id: 'cp3', yaw: PI }),
  ent('shield-glooper', 0, 0, -193, { group: 'yardc', yaw: 0 }),
  ent('glooper', -12, 0, -179.5, { group: 'yardc', yaw: 0.2 }),
  ent('glooper', 12, 2.6, -178, { group: 'yardc', yaw: -0.2 }),
  ent('rollerbrute', -8, 0, -194, { group: 'yardc', yaw: 0.5, aggro: 20 }),
  ent('glooper', 8, 0, -195.5, { group: 'yardc', yaw: -0.3, patrol: [[8, 0, -195.5], [9, 0, -184], [2, 0, -181]] }),
  ent('murk-barrier', 0, 0, -200.2, { id: 'bar-final', size: [5, 4, 0.4], group: 'yardc' }),
  ent('pearl-trail', -19, 0, -166, { to: [-19, 0, -186], count: 5 }),
  ent('pearl-trail', -12, 5.2, -170.6, { to: [-12, 5.2, -173.4], count: 2 }),
  ent('crate', 16.8, 0, -171.5, { pearls: 2 }), ent('crate', 17.6, 0, -172.9, { pearls: 2 }),
  D('lamp', -21.4, 0, -176, { yaw: PI / 2 }), D('lamp', 21.4, 0, -184, { yaw: -PI / 2 }), D('lamp', -3.4, 0, -199, { yaw: PI }), D('lamp', 3.4, 0, -199, { yaw: PI }),
  D('barrel', 20.5, 0, -196), D('barrel', 21, 0, -195.1), D('barrel', 20.2, 0, -194.3, { variant: 'toxic' }),
  D('crate-stack', -20, 0, -196.5, { count: 4, yaw: 0.3 }), D('tire-stack', 9, 0, -165, { count: 3 }),
  D('speaker-tower', -20.5, 0, -164, { height: 3, color: '#b77dff' }), D('speaker-tower', 20.5, 0, -164, { height: 3, color: '#b77dff' }),
  D('billboard', 0, 0, -202.8, { yaw: PI, text: 'Grayer is Better' }),
  D('neon-sign', -4.5, 2.6, -180.02, { text: 'YARD C', color: '#ffc53a', height: 1.1 }),

  // ---------------- H ----------------
  ent('prism-core', 0, 0, -222, { id: 'core' }),
  ent('pearl-trail', 0, 0, -203, { to: [0, 0, -210], count: 3 }),
  D('flag', -8, 0, -228, { color: '#ff8a1f' }), D('flag', 8, 0, -228, { color: '#2fd6ff' }),
  D('speaker-tower', -6.5, 0, -226, { height: 2.4, color: '#ff8a1f' }), D('speaker-tower', 6.5, 0, -226, { height: 2.4, color: '#2fd6ff' }),
  D('lamp', -8.3, 0, -214, { yaw: PI * 0.75 }), D('lamp', 8.3, 0, -214, { yaw: -PI * 0.75 }),
  D('buoy', -14, -1.6, -216), D('buoy', 14, -1.6, -224, { color: '#f2c230' }), D('buoy', 0, -1.6, -240, { color: '#2fb35a', light: '#ff3030' }),
];

export default {
  id: 'w1-2',
  name: 'Container Crossing',
  world: 1,
  theme: 'docks',
  music: 'docks',
  // "a gray and gloomy day... that's Murk Industries": an overcast, slightly desaturated morning
  themeOverride: {
    skyTop: '#6f8ec4', skyHorizon: '#e6d6c8', skyBottom: '#c9b7a8', sunColor: '#fff4e2', sunIntensity: 1.7,
    sunDir: [0.45, 0.7, -0.35], hemiSky: '#d6e2f2', hemiGround: '#a89a8c', fog: '#d9d2cc', fogNear: 70, fogFar: 330, clouds: 0.9,
  },
  waterY: -1.6,
  killY: -3.2,
  spawn: { pos: [0, 0, 9], yaw: PI },
  objective: 'Cross the container yard and reach the Prism Capsule',
  brushes,
  preInk: [
    murk(-6, 0, -15, 2), murk(8.5, 0, -23, 2.2), murk(-2, 0, -29, 1.8),
    murk(0, DOCK, -47, 2.6), murk(-8, DOCK, -46, 2), murk(6, DOCK, -40, 1.6),
    murk(-9, 0, -80, 2.4), murk(9, 0, -86, 2.2), murk(0, 0, -70, 2), murk(0, 2.6, -82, 1.6),
    murk(0, 0, -112, 2.6), murk(0, 0, -121, 2.6), murk(0, 0, -130, 2.8), murk(0, 0, -139, 2.8), murk(0, 0, -146, 2.4),
    murk(0, 0, -178, 2.6), murk(-8, 0, -190, 2.6), murk(8, 0, -190, 2.4), murk(12, 0, -172, 2), murk(0, 0, -196, 2.2),
    murk(0, 0, -222, 3),
  ],
  entities,
  route: [
    [0, 0, 9], [0, 0, -4], [1.5, 0, -16], [-2, 0, -26], [0, 0, -27.2], [0, DOCK, -36, 'mover'],                     // 'mover' = sponge-assisted
    [0, DOCK, -50], [0, DOCK, -53], [0, 0, -62], [3.5, 0, -78], [5.5, 0, -86], [0, 0, -91.5], [0, 0, -107, 'mover'],
    [0, 0, -148], [0, 0, -161], [0, 0, -175], [2, 0, -186], [0, 0, -199], [0, 0, -210], [0, 0, -219],
  ],
};
