// 2-1 Rooftop Rush — Coral Heights at dusk, "upgraded to Tasteful Beige". Five rooftops over the
// street canyon, linked by three ink rails and one big squid leap. Beats (DIALOGUE ids, in order):
//
//   R1  Start roof (y 0)       shoot the rail node, ride rail 1 over the cross street ....... 'w2-1.rail'
//   R2  Garden terrace (y -3)  checkpoint 1; first Buzzdrones + Gloopers → barrier .......... 'w2-1.drones'
//       Jump pen               squid-leap the 5 m alley gap up to R3 ....................... 'w2-1.gap'
//   R3  Penthouse block (y -2) checkpoint 2; climb the penthouse (y 4) under fire, rail 2 curves right
//   R4  Sign-shop roof (y -2)  checkpoint 3; final squad → barrier → rail 3 climbs to R5 ...... 'w2-1.pa'
//   R5  Capsule roof (y 10)    Prism Capsule
//
// Hidden: Grandma Peb's tomato terrace, a squid leap off R2's east parapet (postcard + pearls).
// Void below: the street is at y -30; killY -12.
import { block, box, cyl, ent, murk, heroInk } from '../kit.js';
import { PI, D, SCENERY, building, parapet, acUnit, waterTower, street, planter, skyline } from './heights-kit.js';

const T = (x, y, z, o) => ent('trigger', x, y, z, o);
const GLASS = { mat: 'glass', color: '#d9f0ff' };
const R1 = 0, R2 = -3, R3 = -1.5, PH = 4, R4 = -2, R5 = 10, TOM = R2 + 1.5;

const brushes = [
  // ---------------- R1: start roof ----------------
  ...building(-10, 14, 10, -10, R1, { color: '#f3c9e4', roofColor: '#cdbfd8' }),
  ...parapet(-10, 14, 10, -10, R1, ['+z', '-x', '+x', '-z'], { gaps: { '-z': [[-2.2, 2.2]] } }),
  block(0, 2, 3, 23, R1, 0.04, { mat: 'tiles', color: '#f6e7d8', collide: false }),
  ...waterTower(6, 8.5, R1),
  ...acUnit(-6, 5, R1), ...acUnit(6, -4.5, R1, 1),
  block(-5.5, -5, 3, 3, R1, 0.4, GLASS),                                   // skylight
  block(-8.2, 11.5, 3, 4, R1, 2.6, { mat: 'brick', color: '#d98a8a' }),    // stair bulkhead
  block(-8.2, 11.5, 3.4, 4.4, R1 + 2.6, 0.2, { mat: 'metal', color: '#6d7384' }),

  // ---------------- R2: garden terrace ----------------
  ...building(-14, -34, 14, -66, R2, { color: '#c9b8f0', roofMat: 'tiles', roofColor: '#eadcca' }),
  ...parapet(-14, -34, 14, -66, R2, ['+z', '-x', '+x'], { gaps: { '+z': [[-3.5, 3.5]], '+x': [[-51, -41]] } }),
  box(-14, R2, -66, -4.4, R2 + 2.2, -65.7, GLASS), box(4.4, R2, -66, 14, R2 + 2.2, -65.7, GLASS),   // edge rail (2.2 m: no squid leap round the barrier)
  box(-4.4, R2, -66, -4.1, R2 + 2.2, -63, GLASS), box(4.1, R2, -66, 4.4, R2 + 2.2, -63, GLASS),     // jump pen
  ...planter(-9, -42, 6, 2, R2), ...planter(9, -51, 2, 7, R2), ...planter(-3, -56, 5, 2, R2), ...planter(-11, -58, 2, 5, R2),
  block(6, -41.5, 4, 3, R2, 2.2, { ...GLASS, color: '#c8ffe0' }),        // greenhouse (glass: cover, no climbing)
  block(6, -41.5, 4.3, 3.3, R2 + 2.2, 0.15, { mat: 'wood', color: '#b8845a' }),
  ...acUnit(-9.5, -50, R2, 1),
  // pergola (scenery beams)
  ...[-6.5, -1.5].map((x) => block(x, -47, 0.25, 0.25, R2, 2.6, { mat: 'wood', color: '#b8845a', paint: false })),
  ...[-6.5, -1.5].map((x) => block(x, -52, 0.25, 0.25, R2, 2.6, { mat: 'wood', color: '#b8845a', paint: false })),
  box(-7, R2 + 2.6, -52.4, -1, R2 + 2.8, -46.6, SCENERY({ mat: 'wood', color: '#c9955e' })),

  // hidden tomato terrace (east of R2)
  ...building(16, -40, 24, -52, TOM, { color: '#a8d8b9', roofMat: 'wood', roofColor: '#c49a6c', windows: 'x' }),
  ...planter(20.5, -43, 5, 1.6, TOM, 0.6, '#b8845a'), ...planter(20.5, -49, 5, 1.6, TOM, 0.6, '#b8845a'),

  // ---------------- R3 + penthouse ----------------
  ...building(-9, -68.3, 9, -100, R3, { color: '#9ec5f0', roofColor: '#c7c0d6' }),
  ...parapet(-9, -68.3, 9, -86, R3, ['-x', '+x']),
  block(0, -93, 18, 14, R3, PH - R3 - 0.25, { mat: 'plaster', color: '#ffd6e8' }),     // penthouse (climb its front face)
  block(0, -93, 18, 14, PH - 0.25, 0.25, { mat: 'concrete', color: '#e2d6ea' }),        // flush: a lip over the climb face stops the squid
  block(-6, -86.02, 3, 0.1, R3 + 0.6, 2.4, { mat: 'glass', color: '#ffd9a8' }),         // lit windows (not climbable)
  block(6, -86.02, 3, 0.1, R3 + 0.6, 2.4, { mat: 'glass', color: '#ffd9a8' }),
  ...acUnit(-5, -76.5, R3), ...acUnit(6.2, -81, R3, 1),
  ...waterTower(-5.5, -96.5, PH, { color: '#8fb8d8' }),

  // ---------------- R4: sign-shop roof ----------------
  ...building(6, -140, 30, -172, R4, { color: '#f7d08a', roofColor: '#cdbfd8' }),
  ...parapet(6, -140, 30, -172, R4, ['+z', '-x', '+x'], { gaps: { '+z': [[15, 22]] } }),
  box(6, R4, -172, 14.8, R4 + 1.4, -171.7, GLASS), box(21.2, R4, -172, 30, R4 + 1.4, -171.7, GLASS),
  box(14.8, R4, -172, 15.1, R4 + 2.2, -168, GLASS), box(20.9, R4, -172, 21.2, R4 + 2.2, -168, GLASS),
  ...acUnit(11, -150, R4), ...acUnit(25.5, -158, R4, 1), ...acUnit(13, -163, R4, 1),
  block(21, -151, 4, 3, R4, 1.1, { mat: 'wood', color: '#b8845a' }),
  ...waterTower(26.5, -145, R4, { color: '#d98a8a' }),

  // ---------------- R5: capsule roof ----------------
  ...building(10, -191, 26, -206, R5, { color: '#e8c7ff', roofMat: 'tiles', roofColor: '#f4ecf8' }),
  ...parapet(10, -191, 26, -206, R5, ['-z', '-x', '+x']),
  cyl(18, R5, -199, 3.2, 0.05, { mat: 'tiles', color: '#ff9fc8', sides: 24, collide: false }),

  // ---------------- the city around and below ----------------
  box(-70, -31.5, -240, 70, -30.5, 30, SCENERY({ mat: 'asphalt', color: '#3f3a4c' })),
  ...street(-60, -12, 60, -32, { along: 'x' }),
  ...street(-60, -101, 60, -139, { along: 'x' }),
  ...street(-24, 30, -16, -240, { along: 'z' }),
  ...skyline([
    [-30, 2, 14, 22, 12], [30, 0, 16, 18, 16], [-32, -44, 16, 18, 6], [34, -58, 14, 20, 10], [-28, -84, 14, 20, 16],
    [-34, -128, 16, 20, 20], [0, -122, 18, 12, -7], [-10, -160, 16, 18, 8], [44, -150, 14, 22, 18], [-16, -222, 20, 16, 22],
    [50, -216, 16, 18, 26], [18, -254, 26, 14, 34], [-40, -190, 16, 20, 14], [0, 34, 26, 12, 10],
  ]),
];

const entities = [
  // ---------------- R1 ----------------
  T(0, R1, 7, { size: [20, 3, 12], objective: 'Race across the rooftops' }),
  T(0, R1, -4.5, { size: [20, 3, 5], dialogue: 'w2-1.rail', objective: 'Charge the ink rail and ride it', hint: 'Shoot the glowing node to charge the rail, then touch it in squid form ({swim})' }),
  ent('ink-rail', 0, R1, -9.2, { id: 'rail-1', points: [[0, 0.45, -9.2], [0, 0.35, -14], [0, -0.8, -24], [0, -2.1, -32.5], [0, -2.45, -37]], speed: 15 }),
  ent('pearl-trail', 0, R1, 5, { to: [0, R1, -3], count: 4 }),
  ent('pearl-trail', 0, 0.1, -16, { to: [0, -1.7, -29], count: 5 }),
  D('neon-sign', 0, R1 + 2.2, 13.7, { yaw: PI, text: 'CORAL HEIGHTS', color: '#ff5fa8', height: 1.2, pole: false }),
  D('satellite', 8.3, R1, -8, { yaw: PI * 0.8 }), D('antenna', -8.3, R1 + 2.8, 12.5, { height: 3.2 }),
  D('chimney', 8.4, R1, 2), D('flowerpot', -9.2, R1, -1), D('flowerpot', -9.2, R1, 0.2, { color: '#b98cff' }), D('bush', 8.7, R1, -1, { flowerColor: '#ff7ab8' }),
  D('bench', -8.8, R1, 4.5, { yaw: PI / 2 }), D('vending', 9.2, R1, 11.8, { yaw: -PI / 2, color: '#ff5fa8' }),
  D('lamp', -3, R1, -9.4, { yaw: PI }), D('lamp', 3, R1, -9.4, { yaw: PI }),
  D('graffiti', -8.2, R1 + 0.2, 9.48, { yaw: PI / 2, text: 'BEIGE?! NO!', size: 3, color: '#ff5fa8', color2: '#2fd6ff' }),
  D('billboard', -13, R1, -2, { yaw: PI / 2, text: 'Pix FM 88.1' }),

  // ---------------- R2 ----------------
  ent('checkpoint', 1.8, R2, -38, { id: 'cp1', yaw: PI, radius: 3 }),              // end of rail 1
  T(0, R2, -39.5, { size: [28, 3, 3], dialogue: 'w2-1.drones', objective: 'Clear the garden terrace' }),
  ent('buzzdrone', -6, R2, -50, { group: 'garden', alt: 4, patrol: [[-6, R2, -50], [6, R2, -54], [0, R2, -60]] }),
  ent('buzzdrone', 7, R2, -58, { group: 'garden', alt: 4.5 }),
  ent('glooper', -9, R2, -61.5, { group: 'garden', yaw: 0.3 }),
  ent('glooper', 9.5, R2, -45.5, { group: 'garden', yaw: -0.3 }),
  ent('murk-barrier', 0, R2, -63, { id: 'bar-garden', size: [8.2, 3.5, 0.4], group: 'garden' }),
  T(0, R2, -64.5, { size: [8, 3, 2.6], dialogue: 'w2-1.gap', objective: 'Squid-leap to the next roof' }),
  ent('pearl-trail', -12.5, R2, -38, { to: [-12.5, R2, -54], count: 5 }),
  D('palm', -12.6, R2, -64), D('palm', 12.6, R2, -36), D('palm', 12.6, R2, -64),
  D('bush', -9, R2 + 0.6, -42, { flowerColor: '#ffd23f' }), D('bush', 9, R2 + 0.6, -49, { flowerColor: '#ff7ab8' }), D('bush', 9, R2 + 0.6, -53.4),
  D('bush', -3, R2 + 0.6, -56, { flowerColor: '#ffffff' }), D('bush', -11, R2 + 0.6, -58, { flowerColor: '#ff5f5f' }),
  D('bench', -4, R2, -44.5, { yaw: 0 }), D('bench', -4, R2, -54.5, { yaw: PI }), D('flowerpot', 3.2, R2, -39), D('flowerpot', 4.3, R2, -39, { color: '#ffd23f' }),
  D('lamp', -13.3, R2, -46, { yaw: PI / 2 }), D('lamp', 13.3, R2, -58, { yaw: -PI / 2 }),
  D('neon-sign', 0, R2 + 0.7, -34.2, { yaw: PI, text: 'GARDEN CLUB', color: '#7ee08f', height: 1.4 }),
  // tomato terrace
  ent('postcard', 22.4, TOM, -46, { id: 'w2-1-postcard', title: 'Rooftop Garden', from: 'Grandma Peb', text: 'Planted tomatoes on the roof. The seagulls are winning. I have a plan. The plan is a bigger hat.' }),
  ent('pearl-trail', 17.5, TOM, -41.5, { to: [17.5, TOM, -50.5], count: 4 }),
  D('bush', 20.5, TOM + 0.6, -43, { flowerColor: '#ff3030', color: '#3a8f3f' }), D('bush', 20.5, TOM + 0.6, -49, { flowerColor: '#ff3030', color: '#3a8f3f' }),
  D('flag', 23.3, TOM, -51.3, { color: '#ff3030', height: 3 }), D('flowerpot', 23.2, TOM, -41, { color: '#ff3030' }),

  // ---------------- R3 ----------------
  ent('checkpoint', 0.8, R3, -73.5, { id: 'cp2', yaw: PI, radius: 4.8 }),           // the whole landing strip
  T(0, R3, -76, { size: [18, 3, 3], objective: 'Climb the penthouse', hint: 'Paint the pink wall and swim up it' }),
  ent('glooper', -6, R3, -81, { group: 'r3', yaw: 0.3 }),
  ent('shield-glooper', 2.5, R3, -83.5, { group: 'r3', yaw: 0 }),
  ent('glooper', 5, PH, -90.5, { group: 'r3', yaw: 0 }),
  ent('buzzdrone', -3, PH, -95, { group: 'r3', alt: 3 }),
  ent('pearl-trail', -7.5, R3, -73, { to: [-7.5, R3, -84], count: 4 }),
  ent('ink-rail', 0, PH, -99, { id: 'rail-2', points: [[0, PH + 0.45, -99.4], [0, PH + 0.2, -104], [3, PH - 1.2, -113], [9, PH - 2.8, -121], [15, PH - 4, -128], [18, PH - 5.2, -136], [18.5, R4 + 0.45, -143]], speed: 15 }),
  ent('pearl-trail', 1.5, PH - 0.6, -108.5, { to: [12, PH - 3.4, -124.5], count: 6 }),
  D('billboard', 5, PH, -99.2, { text: 'Squidberry Soda' }),
  D('satellite', -7.8, PH, -88, { yaw: PI / 3 }), D('antenna', 7.8, PH, -98.8, { variant: 'radar', height: 2.6 }),
  D('chimney', -8, R3, -84.5), D('flowerpot', 8.2, R3, -72), D('bush', -8.2, R3, -72.2, { flowerColor: '#ffd23f' }),
  D('graffiti', 0, R3 + 0.4, -85.97, { text: 'TASTEFUL?', size: 5, color: '#ff5fa8', color2: '#ffd23f' }),
  D('neon-sign', 9.05, PH - 2.2, -93, { yaw: PI / 2, text: 'PENTHOUSE', color: '#2fd6ff', height: 0 }),
  D('lamp', -3, PH, -99.3, { yaw: PI }),

  // ---------------- R4 ----------------
  T(18.5, R4, -145, { size: [12, 3, 4], dialogue: 'w2-1.pa', objective: 'Clear the sign-shop roof' }),
  ent('checkpoint', 20, R4, -144, { id: 'cp3', yaw: PI, radius: 3 }),               // end of rail 2
  ent('buzzdrone', 12, R4, -158, { group: 'final', alt: 4 }),
  ent('buzzdrone', 24, R4, -163, { group: 'final', alt: 5, patrol: [[24, R4, -163], [16, R4, -156]] }),
  ent('glooper', 9.5, R4, -166.5, { group: 'final', yaw: 0.3 }),
  ent('glooper', 27, R4, -152, { group: 'final', yaw: -0.4 }),
  ent('shield-glooper', 18, R4, -164.5, { group: 'final', yaw: 0 }),
  ent('murk-barrier', 18, R4, -168, { id: 'bar-final', size: [5.8, 3.5, 0.4], group: 'final' }),
  ent('ink-rail', 18, R4, -170.5, { id: 'rail-3', points: [[18, R4 + 0.45, -170.4], [18, R4 + 0.7, -174], [18, 2, -180], [18, 6.4, -186], [18, 9.4, -190], [18, R5 + 0.45, -193.5]], speed: 14 }),
  ent('pearl-trail', 8.5, R4, -143, { to: [8.5, R4, -160], count: 5 }),
  ent('pearl-trail', 18, 3, -182, { to: [18, 8.4, -188.5], count: 4 }),
  D('neon-sign', 18, R4 + 0.7, -140.2, { yaw: PI, text: 'SIGNS & SONS', color: '#ffd23f', height: 1.4 }),
  D('billboard', 29, R4, -160, { yaw: -PI / 2, text: 'Kelp Krunch' }),
  D('crate-stack', 7.8, R4, -152, { count: 3 }), D('barrel', 28.6, R4, -168), D('barrel', 28, R4, -169),
  D('lamp', 15.4, R4, -171.2, { yaw: PI }), D('lamp', 20.6, R4, -171.2, { yaw: PI }),
  D('speaker-tower', 7.6, R4, -170.3, { height: 2.4, color: '#b77dff' }),

  // ---------------- R5 ----------------
  ent('prism-core', 18, R5, -200, { id: 'core' }),
  ent('pearl-trail', 12, R5, -193, { to: [24, R5, -193], count: 3 }),
  D('speaker-tower', 11.8, R5, -204.3, { height: 2.8, color: '#ff5fa8' }), D('speaker-tower', 24.2, R5, -204.3, { height: 2.8, color: '#2fd6ff' }),
  D('flag', 10.8, R5, -192, { color: '#ff5fa8', height: 4 }), D('flag', 25.2, R5, -192, { color: '#2fd6ff', height: 4 }),
  D('neon-sign', 18, R5 + 0.7, -205.8, { text: 'COLOUR IS FREE', color: '#ff5fa8', height: 4.2, pole: true }),
  D('satellite', 24.6, R5, -198, { yaw: -PI / 2 }), D('antenna', 11.4, R5, -198, { height: 3 }),
];

export default {
  id: 'w2-1',
  name: 'Rooftop Rush',
  world: 2,
  theme: 'heights',
  music: 'heights',
  themeOverride: { hemiIntensity: 1.0, sunIntensity: 1.65, exposure: 1.06 },
  water: false,
  waterY: -40,
  killY: -12,
  spawn: { pos: [0, R1, 9], yaw: PI },
  objective: 'Race across the rooftops to the Prism Capsule',
  brushes,
  preInk: [
    heroInk(0, R1, -8.2, 1.6),
    murk(0, R2, -48, 2.4), murk(-6, R2, -58, 2.2), murk(8, R2, -55, 2), murk(0, R2, -62, 1.8), murk(-9, R2, -40, 1.6),
    murk(0, R3, -78, 2.2), murk(-5, R3, -83, 2), murk(0, PH, -92, 2.2), murk(4, PH, -97, 1.8),
    { at: [2.5, R3 + 3, -85.97], r: 1.8, team: 'murk', n: [0, 0, 1] },
    murk(18, R4, -156, 2.6), murk(12, R4, -164, 2.2), murk(25, R4, -165, 2.2), murk(18, R4, -148, 1.8),
    murk(18, R5, -200, 2.6),
  ],
  entities,
  route: [
    [0, R1, 9], [0, R1, -8.5], [0, R2, -40, 'rail'], [0, R2, -62], [0, R2, -65.5], [0, R3, -71, 'squidjump'], [0, R3, -84.5],
    [-2.5, PH, -87.5, 'climb'], [-2.5, PH, -98.5], [18.5, R4, -145, 'rail'], [18, R4, -167], [18, R4, -170],
    [18, R5, -195, 'rail'], [18, R5, -198],
  ],
};
