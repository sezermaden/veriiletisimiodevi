// 1-3 Crane Climb — sunset over the crane berths. Three harbour cranes, each taller than the last;
// the Prism Capsule hangs from the tip of the highest jib, 28 m above the water. Beats (DIALOGUE
// ids, in order):
//
//   A  Base quay (y 0)       warm-up squad, climb the launch plinth, first squid launch pad ...... 'w1-3.launchpad'
//   B  Crane A deck (y 12)   checkpoint 1, deck squad, walk the jib; moving platform over the gap .. 'w1-3.mover'
//   C  Crane B (y 12 → 22)   Snipe Eel on the tower; cover crates; climb the Murk-stained house ... 'w1-3.sniper'
//   D  Crane B roof (y 22)   checkpoint 2, upper jib, second launch pad ............................ 'w1-3.halfway'
//   E  Crane C deck (y 24)   Shield squad; ink-powered elevator or climb the machine house ........ 'w1-3.pa'
//   F  Crane C roof (y 30)   checkpoint 3; Murk barrier on the top jib; drop onto the hanging platform
//
// Hidden: Crane A's counter-jib (east, over the water): climb the counterweight for the postcard.
// Everything past the base quay stands over water, so a fall is a splat back to the last flag.
import { block, box, container, ent, murk } from '../kit.js';
import { PI, D, SCENERY, quay, bollards, containerStack, warehouse, fishingBoat, cargoShip, farWarehouses } from './docks-kit.js';

const A = 12, B = 22, C = 24, TOP = 30, HANG = 26;
const T = (x, y, z, o) => ent('trigger', x, y, z, o);
const YEL = '#f2c230', ORG = '#e0612b', STEEL = '#b9bcc8';

/** Crane legs + a lattice feel: four legs (from under the water) and two ring beams. */
function craneLegs(x0, x1, z0, z1, top, color) {
  const out = [];
  for (const x of [x0, x1]) for (const z of [z0, z1]) out.push(block(x, z, 1.2, 1.2, -3, top + 3, { mat: 'metal', color, paint: false }));
  for (const y of [top * 0.33, top * 0.66]) {
    out.push(box(x0 - 0.3, y, z0 - 0.3, x1 + 0.3, y + 0.5, z0 + 0.3, SCENERY({ mat: 'metal', color })));
    out.push(box(x0 - 0.3, y, z1 - 0.3, x1 + 0.3, y + 0.5, z1 + 0.3, SCENERY({ mat: 'metal', color })));
    out.push(box(x0 - 0.3, y, Math.min(z0, z1), x0 + 0.3, y + 0.5, Math.max(z0, z1), SCENERY({ mat: 'metal', color })));
    out.push(box(x1 - 0.3, y, Math.min(z0, z1), x1 + 0.3, y + 0.5, Math.max(z0, z1), SCENERY({ mat: 'metal', color })));
  }
  return out;
}

/** Jib walkway along -z at height y (3.2 m wide girder, darker truss underneath). */
function jib(z0, z1, y, color = YEL) {
  return [
    box(-1.6, y - 0.6, Math.min(z0, z1), 1.6, y, Math.max(z0, z1), { mat: 'metal', color }),
    box(-1.2, y - 1.6, Math.min(z0, z1) + 0.5, 1.2, y - 0.6, Math.max(z0, z1) - 0.5, SCENERY({ mat: 'metal', color: '#3b4052' })),
  ];
}

const brushes = [
  // ---------------- A: base quay ----------------
  ...quay(-16, 14, 16, -42, 0, { mat: 'concrete', color: '#d2cbc1', stripeSides: '-z+x' }),
  ...warehouse(-21, -8, 10, 30, 7, { color: '#8fb8d8', roofColor: '#6d7384', wall: { paint: false } }),
  box(-26.4, -3.5, -23.4, -16, 0, 7.4, SCENERY({ mat: 'concrete', color: '#a9a39a' })),
  ...containerStack(12.75, 6, 2, 0, 1), ...containerStack(12.75, -4, 1, 4, 1), ...containerStack(-11, 8, 2, 6, 0),
  block(0, -20, 8, 6, 0, 2.6, { mat: 'concrete', color: '#b9b3ab' }),                // launch plinth (climb)
  block(0, -20, 8.4, 6.4, 2.6, 0.15, { mat: 'metal', color: YEL, collide: false }),
  block(-8, -28, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: YEL }),
  block(8.5, -24, 1.2, 2.6, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  container(9, 0, -34, '#2fb6c8', 1),
  ...bollards(15.6, 10, 15.6, -38, 7),

  // ---------------- B: crane A ----------------
  ...craneLegs(-6, 6, -34, -46, A - 0.8, YEL),
  box(-7.5, A - 0.8, -48, 7.5, A, -32, { mat: 'metal', color: STEEL }),
  block(0, -44, 8, 6, A, 4, { mat: 'metal', color: YEL }),                            // machine house
  block(0, -44, 8.6, 6.6, A + 4, 0.3, { mat: 'metal', color: '#3b4052' }),
  block(0, -40.95, 3, 0.1, A + 1.6, 1.3, { mat: 'glass', color: '#bfe8ff' }),
  ...jib(-48, -70, A),
  box(7.5, A - 0.6, -41.5, 20, A, -38.5, { mat: 'metal', color: YEL }),               // counter-jib (postcard)
  block(18.5, -40, 3, 3, A, 2.5, { mat: 'concrete', color: '#9aa0ad' }),               // counterweight

  // ---------------- C: crane B ----------------
  ...craneLegs(-6.5, 6.5, -86, -100, A - 0.8, ORG),
  box(-8, A - 0.8, -104, 8, A, -84, { mat: 'metal', color: STEEL }),
  block(0, -91.5, 8, 5, A, 5, { mat: 'metal', color: ORG }),                           // step house (climb 1)
  block(0, -98, 8, 8, A, B - A, { mat: 'metal', color: '#f4f1ea' }),                   // tower (climb 2)
  block(0, -98, 8.4, 8.4, B, 0.12, { mat: 'concrete', color: '#b8b0a6' }),
  block(4.05, -98, 0.1, 4, B - 3.4, 1.6, { mat: 'glass', color: '#bfe8ff' }),           // cab window (east face, off the climb)
  block(-5.5, -87.5, 2.4, 1.2, A, 1.0, { mat: 'concrete', color: YEL }),
  ...jib(-102, -126, B + 0.12, ORG),

  // ---------------- E/F: crane C ----------------
  ...craneLegs(-7, 7, -140, -156, C - 0.8, '#d9482b'),
  box(-8.5, C - 0.8, -160, 8.5, C, -136, { mat: 'metal', color: STEEL }),
  block(0, -154, 8, 8, C, TOP - C, { mat: 'metal', color: '#d9482b' }),                // machine house (climb 6 m)
  block(0, -154, 8.4, 8.4, TOP, 0.12, { mat: 'concrete', color: '#b8b0a6' }),
  block(-4.5, -143, 1.2, 2.6, C, 1.0, { mat: 'concrete', color: YEL }),
  block(3.5, -141.5, 2.4, 1.2, C, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  ...jib(-158, -172, TOP + 0.12, '#d9482b'),
  box(-5, HANG - 0.6, -183, 5, HANG, -173, { mat: 'metal', color: '#c3cad6' }),       // hanging capsule platform (drop 4 m off the jib tip)
  ...[[-4.6, -173.4], [4.6, -173.4], [-4.6, -182.6], [4.6, -182.6]].map(([x, z]) => box(x - 0.04, HANG, z - 0.04, x + 0.04, TOP + 3, z + 0.04, SCENERY({ mat: 'metal', color: '#1b1f2e' }))),
  block(0, -172, 2.2, 2.2, TOP + 1.7, 1.6, SCENERY({ mat: 'metal', color: '#d9482b' })),  // jib-tip sheave block (overhead)

  // A-frames on the crane houses (scenery silhouettes)
  block(0, -44, 0.6, 0.6, A + 4.3, 5, SCENERY({ mat: 'metal', color: YEL })),
  block(-3.4, -101.4, 0.6, 0.6, B + 0.12, 6, SCENERY({ mat: 'metal', color: ORG })),
  block(-3, -155, 0.6, 0.6, TOP + 0.12, 7, SCENERY({ mat: 'metal', color: '#d9482b' })),

  // ---------------- scenery ----------------
  ...cargoShip(-40, -110, { length: 110, width: 20, seed: 9, hull: '#2f4f8a' }),
  ...farWarehouses(40, -20, 10, { dir: -1 }).map((b) => ({ ...b, min: [b.min[2] + 70, b.min[1], b.min[0] - 60], max: [b.max[2] + 70, b.max[1], b.max[0] - 60] })),
  ...fishingBoat(22, -12, { hull: '#f4f1ea', stripe: '#2fb6c8', cabin: '#ffd23f' }),
  block(38, -120, 10, 160, -3, 3, SCENERY({ mat: 'concrete', color: '#b9b3ab' })),
];

const entities = [
  // ---------------- A ----------------
  T(0, 0, 7, { size: [16, 3, 8], objective: 'Climb the cranes to the Prism Capsule' }),
  ent('glooper', -7, 0, -26, { group: 'base', yaw: 0.3 }),
  ent('glooper', 7.5, 0, -30, { group: 'base', yaw: -0.3 }),
  T(0, 0, -15.5, { size: [10, 3, 2.5], hint: 'Paint the plinth wall and swim up it' }),
  T(0, 2.6, -18.2, { size: [8, 3, 2], dialogue: 'w1-3.launchpad', objective: 'Ride the launch pad to Crane A' }),
  ent('launchpad', 0, 2.6, -21, { id: 'pad-a', target: [0, A, -36.5] }),
  ent('pearl-trail', -12, 0, -2, { to: [-12, 0, -24], count: 5 }),
  ent('pearl', 12.75, 5.2, 4), ent('pearl', 12.75, 5.2, 6), ent('pearl', 12.75, 5.2, 8),
  D('crane', -26, 0, -52, { yaw: PI / 2 }), D('crane', 30, 0, -70, { yaw: -PI / 2, color: '#e0612b' }),
  D('lamp', -15.4, 0, 4, { yaw: PI / 2 }), D('lamp', -15.4, 0, -20, { yaw: PI / 2 }), D('lamp', 15.4, 0, -14, { yaw: -PI / 2 }),
  D('barrel', -15, 0, -30), D('barrel', -14.3, 0, -30.7, { variant: 'toxic' }), D('barrel', 14.6, 0, -24),
  D('crate-stack', -14.5, 0, -36, { count: 3, yaw: 0.4 }), D('tire-stack', 5.5, 0, 10, { count: 4 }),
  D('cone', -2.5, 0, -15.8), D('cone', 2.5, 0, -15.8), D('hydrant', -8, 0, 12),
  D('graffiti', 0, 0.35, -16.97, { text: 'UP!', size: 3, color: '#ffd23f', color2: '#ff8a1f' }),
  D('neon-sign', -15.95, 3.5, -8, { yaw: PI / 2, text: 'BERTH 12', color: '#ffc53a', height: 1.2 }),
  D('billboard', 10, 0, -40, { yaw: PI - 0.3, text: 'Tidepool Racing' }),
  D('flag', 15.4, 0, 13, { color: '#ff8a1f', height: 6 }), D('bench', -4, 0, 12.8, { yaw: PI }),

  // ---------------- B ----------------
  ent('checkpoint', 4.8, A, -35, { id: 'cp1', yaw: PI }),
  ent('glooper', -6, A, -44.5, { group: 'craneA', yaw: 0.2 }),
  ent('glooper', 6, A, -46, { group: 'craneA', yaw: -0.2 }),
  ent('pearl-trail', 0, A, -52, { to: [0, A, -66], count: 5 }),
  T(0, A, -66.5, { size: [3.2, 3, 3], dialogue: 'w1-3.mover', objective: 'Hop on the moving platform' }),
  ent('mover', 0, A, -72, { id: 'mover-ab', size: [3, 0.5, 3], path: [[0, A, -72], [0, A, -82.5]], speed: 2.4, wait: 1.4, mat: 'metal' }),
  // counter-jib secret
  ent('pearl-trail', 9, A, -40, { to: [16, A, -40], count: 4 }),
  ent('pearl-trail', -2.5, A + 4.3, -45.5, { to: [2.5, A + 4.3, -45.5], count: 4 }),     // on the machine-house roof (climb)
  ent('postcard', 18.5, A + 2.5, -40, { id: 'w1-3-postcard', title: 'View from the Crane', from: 'Kip, age 9', text: 'You can see the whole city from up here! The lighthouse! The skatepark! My house! HI MOM!' }),
  D('railing', -1.55, A, -59, { yaw: PI / 2, length: 20, collide: true }), D('railing', 1.55, A, -59, { yaw: PI / 2, length: 20, collide: true }),
  D('railing', 13.5, A, -38.6, { length: 11, color: '#e0442a' }),
  D('lamp', -7, A, -33, { yaw: PI * 0.75 }), D('lamp', 7, A, -47.5, { yaw: -PI / 4 }),
  D('barrel', -6.8, A, -39), D('crate-stack', 5.8, A, -36.8, { count: 2, yaw: 0.3 }),
  D('flag', -3.8, A + 4.3, -46.5, { color: '#ff8a1f', height: 3 }), D('antenna', 3, A + 4.3, -42, { height: 2.4 }),
  D('speaker-tower', -6.8, A, -47.2, { height: 2, color: '#b77dff' }),

  // ---------------- C ----------------
  T(0, A, -85, { size: [16, 3, 2], dialogue: 'w1-3.sniper', objective: 'Take out the Snipe Eel on the tower' }),
  ent('crate', -2.8, A, -87, { pearls: 2, size: [1.6, 1.4, 1.2] }),
  ent('crate', 3.6, A, -86.8, { pearls: 2, size: [1.6, 1.4, 1.2] }),
  ent('snipe-eel', 0, B + 0.12, -100, { group: 'craneB', yaw: 0, aggro: 32 }),
  ent('glooper', -6, A, -97, { group: 'craneB', yaw: 0.3 }),
  ent('glooper', 6.2, A, -99.5, { group: 'craneB', yaw: -0.3 }),
  ent('pearl-trail', 6.8, A, -86, { to: [6.8, A, -94], count: 3 }),
  D('lamp', 7.4, A, -85, { yaw: -PI * 0.75 }), D('lamp', -7.4, A, -103, { yaw: PI / 4 }),
  D('barrel', 7, A, -103), D('barrel', 6.2, A, -103.4, { variant: 'toxic' }), D('tire-stack', -7, A, -91, { count: 3 }),
  D('graffiti', 2.2, A + 0.4, -88.95, { text: 'CLIMB', size: 2.6, color: '#2fd6ff', color2: '#ffffff' }),

  // ---------------- D ----------------
  T(0, B + 0.12, -96.5, { size: [8, 3, 5], dialogue: 'w1-3.halfway' }),
  ent('checkpoint', 2.6, B + 0.12, -95.6, { id: 'cp2', yaw: PI }),
  ent('pearl-trail', 0, B + 0.12, -104, { to: [0, B + 0.12, -119], count: 5 }),
  ent('launchpad', 0, B + 0.12, -123.4, { id: 'pad-b', target: [0, C, -141] }),
  D('railing', -1.55, B + 0.12, -112, { yaw: PI / 2, length: 18, collide: true, color: '#e0442a' }), D('railing', 1.55, B + 0.12, -112, { yaw: PI / 2, length: 18, collide: true, color: '#e0442a' }),
  D('flag', -3.6, B + 0.12, -101.6, { color: '#2fd6ff', height: 3.4 }), D('satellite', 3.4, B + 0.12, -101.4, { yaw: PI }),

  // ---------------- E ----------------
  T(0, C, -139.5, { size: [17, 3, 3], dialogue: 'w1-3.pa', objective: 'Clear the top deck' }),
  ent('shield-glooper', 0, C, -146.5, { group: 'craneC', yaw: 0 }),
  ent('glooper', -6.2, C, -148, { group: 'craneC', yaw: 0.3 }),
  ent('glooper', 6.5, C, -146, { group: 'craneC', yaw: -0.3 }),
  ent('glooper', -2, TOP + 0.12, -156.5, { group: 'craneC', yaw: 0 }),
  ent('mover', 6, C + 0.3, -154, { id: 'lift-c', size: [3, 0.5, 3], path: [[6, C + 0.3, -154], [6, TOP + 0.3, -154]], speed: 2.2, wait: 0.6, activate: 'ink', return: true, mat: 'metal' }),
  T(6, C, -150, { size: [4, 3, 3], hint: 'Ink the lift to power it, or climb the machine house' }),
  ent('pearl-trail', -7.5, C, -138, { to: [-7.5, C, -158], count: 5 }),
  D('lamp', -8, C, -137, { yaw: PI * 0.75 }), D('lamp', 8, C, -159, { yaw: -PI / 4 }),
  D('barrel', 7.8, C, -138.5), D('crate-stack', -7.2, C, -152.5, { count: 2, yaw: 0.2 }),
  D('neon-sign', 0, C + 3.6, -149.9, { text: 'MURK CRANE CO.', color: '#b77dff', height: 0.8 }),
  D('speaker-tower', 7.6, C, -136.8, { height: 2.2, color: '#b77dff' }),

  // ---------------- F ----------------
  ent('checkpoint', 2.6, TOP + 0.12, -151.5, { id: 'cp3', yaw: PI }),
  ent('pearl-trail', -2.8, TOP + 0.12, -150.8, { to: [-2.8, TOP + 0.12, -153.2], count: 3 }),
  ent('murk-barrier', 0, TOP + 0.12, -166, { id: 'bar-top', size: [7, 4, 0.4], group: 'craneC' }),
  ent('snipe-eel', 3, HANG, -181, { group: 'top', yaw: 0.2, aggro: 30 }),
  ent('glooper', -3, HANG, -176.5, { group: 'top', yaw: 0 }),
  ent('pearl-trail', 0, TOP + 0.12, -167.5, { to: [0, TOP + 0.12, -171], count: 3 }),
  ent('pearl-trail', -4, HANG, -175, { to: [-4, HANG, -181], count: 3 }),
  ent('prism-core', 0, HANG, -178.5, { id: 'core' }),
  D('railing', -1.55, TOP + 0.12, -162, { yaw: PI / 2, length: 8, collide: true }), D('railing', 1.55, TOP + 0.12, -162, { yaw: PI / 2, length: 8, collide: true }),
  D('railing', -1.55, TOP + 0.12, -169.2, { yaw: PI / 2, length: 5, collide: true }), D('railing', 1.55, TOP + 0.12, -169.2, { yaw: PI / 2, length: 5, collide: true }),
  D('flag', -4.6, HANG, -182.6, { color: '#ff8a1f', height: 3 }), D('flag', 4.6, HANG, -182.6, { color: '#2fd6ff', height: 3 }),
  D('antenna', -3, TOP + 0.12, -151, { variant: 'radar', height: 2.4 }),
  D('lamp', -4.4, HANG, -173.6, { yaw: PI * 0.75 }),

  // ---------------- water dressing ----------------
  D('buoy', -12, -1.6, -60), D('buoy', 12, -1.6, -75, { color: '#2fb35a', light: '#ff3030' }), D('buoy', -14, -1.6, -125, { color: '#f2c230' }),
  D('buoy', 14, -1.6, -170), D('buoy', -10, -1.6, -200, { color: '#2fb35a', light: '#ff3030' }),
];

export default {
  id: 'w1-3',
  name: 'Crane Climb',
  world: 1,
  theme: 'docks',
  music: 'docks',
  // late-afternoon sunset: low warm sun ahead-left, peach haze
  themeOverride: {
    skyTop: '#3f55b8', skyHorizon: '#ffb47a', skyBottom: '#ff9f78', sunColor: '#ffd2a0', sunIntensity: 1.8,
    sunDir: [-0.5, 0.36, -0.62], hemiSky: '#c8d4ff', hemiGround: '#b8866a', fog: '#f4bf98', fogNear: 90, fogFar: 400, bloom: 0.4,
  },
  waterY: -1.6,
  killY: -3.2,
  spawn: { pos: [0, 0, 9], yaw: PI },
  objective: 'Climb the cranes to the Prism Capsule',
  brushes,
  preInk: [
    murk(-7, 0, -26, 2.2), murk(7.5, 0, -30, 2.2), murk(0, 0, -12, 1.8),
    { at: [0, 1.3, -16.95], r: 1.4, team: 'murk', n: [0, 0, 1] },                         // stain on the plinth wall
    murk(-6, A, -44, 2), murk(6, A, -46, 2), murk(0, A, -58, 1.6),
    murk(0, A, -89, 2.2), murk(-5, A, -97, 2.2), murk(5, A, -99, 2),
    { at: [0, A + 2.5, -88.95], r: 1.8, team: 'murk', n: [0, 0, 1] },                     // stained climb face (repaint!)
    { at: [0, B - 2.5, -93.95], r: 1.6, team: 'murk', n: [0, 0, 1] },
    murk(0, C, -146, 2.6), murk(-6, C, -148, 2), murk(6, C, -146, 2), murk(0, C, -152, 1.6),
    murk(0, TOP + 0.12, -170, 1.4), murk(0, HANG, -178.5, 2.6),
  ],
  entities,
  route: [
    [0, 0, 9], [0, 0, -15], [0, 2.6, -18.5, 'climb'], [0, 2.6, -21], [0, A, -36.5, 'launch'], [5.6, A, -41], [5.6, A, -47.5],
    [0, A, -49.5], [0, A, -69], [0, A, -85.5, 'mover'], [0, A, -87.8], [0, A + 5, -90, 'climb'], [0, A + 5, -93.2],
    [0, B + 0.12, -95.5, 'climb'], [0, B + 0.12, -123], [0, C, -141, 'launch'], [0, C, -148.5], [0, TOP + 0.12, -151, 'climb'],
    [0, TOP + 0.12, -157], [0, TOP + 0.12, -171.5], [0, HANG, -175], [0, HANG, -176.5],
  ],
};
