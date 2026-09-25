// 2-3 Neon Gardens — Coral Heights' rooftop gardens as night falls. Murk has drained the glow out
// of the flower beds; switches, Murk barriers and turrets guard the way. Beats (DIALOGUE ids):
//
//   G1  Fountain court (y 0)    shoot the Murk-logo switch → gate 1 ......................... 'w2-3.switch'
//   G2  Lantern Walk (y 0)      checkpoint 1; squad (one on the gazebo roof) powers barrier 1 ... 'w2-3.barrier'
//   G3  Turret Terrace (y 3)    checkpoint 2; Murk Turret on the rose bed, hedge maze to flank it,
//                               switch 2 on the bed opens gate 2 on the west bridge .............. 'w2-3.turret'
//   G4  Greenhouse Grove (y 3)  checkpoint 3; big squad around the greenhouse → final barrier;
//                               optional timed switch opens the orchid house (pearls) ............ 'w2-3.pa'
//       Moon Gate dais (y 4.2)  Prism Capsule
//
// Hidden: the maze's south-west dead end (postcard, glowing flowers). Street canyon below, killY -12.
import { block, box, cyl, prism, stairs, ent, murk } from '../kit.js';
import { PI, D, SCENERY, building, parapet, street, planter, skyline } from './heights-kit.js';

const T = (x, y, z, o) => ent('trigger', x, y, z, o);
const GLASS = { mat: 'glass', color: '#d9f0ff' };
const TER = 3;          // terrace level (G3, G4)
const DAIS = 4.2;

/** Hedge: a planter box topped with a grass hedge (paintable, 1.4 m: too tall to hop). */
function hedge(x0, z0, x1, z1, y, h = 1.4) {
  return [
    box(Math.min(x0, x1), y, Math.min(z0, z1), Math.max(x0, x1), y + 0.5, Math.max(z0, z1), { mat: 'wood', color: '#8a5a3a' }),
    box(Math.min(x0, x1) + 0.08, y + 0.5, Math.min(z0, z1) + 0.08, Math.max(x0, x1) - 0.08, y + h, Math.max(z0, z1) - 0.08, { mat: 'grass', color: '#4fae5a' }),
  ];
}

/** Garden fence along x at z: flower-bed curb + glass pane, with gaps. */
function gardenFence(x0, x1, z, y, gaps = [], h = 3.2) {
  const out = [];
  const seg = (a, b) => out.push(
    box(a, y, z - 0.3, b, y + 0.55, z + 0.3, { mat: 'wood', color: '#8a5a3a' }),
    box(a, y + 0.55, z - 0.06, b, y + h, z + 0.06, GLASS),
  );
  let cur = x0;
  for (const [a, b] of gaps) { if (a > cur) seg(cur, a); cur = b; }
  if (cur < x1) seg(cur, x1);
  return out;
}

/** Hexagonal gazebo with a walkable roof (posts are thin, unpaintable). */
function gazebo(cx, cz, r, y, h = 2.6) {
  const hex = (rr) => Array.from({ length: 6 }, (_, i) => [cx + Math.cos(i * PI / 3) * rr, cz + Math.sin(i * PI / 3) * rr]);
  const out = [prism(hex(r), y, y + 0.25, { mat: 'wood', color: '#c9955e' })];
  for (const [x, z] of hex(r - 0.25)) out.push(cyl(x, y + 0.25, z, 0.12, h - 0.25, { mat: 'metal', color: '#2b2f3e', paint: false, sides: 8 }));
  out.push(prism(hex(r + 0.35), y + h, y + h + 0.3, { mat: 'tiles', color: '#ff8fb2' }));
  return out;
}

const brushes = [
  // ---------------- G1: fountain court ----------------
  ...building(-12, 14, 12, -14, 0, { color: '#c9b8f0', roofMat: 'tiles', roofColor: '#e6dcf0' }),
  ...parapet(-12, 14, 12, -14, 0, ['+z', '-x', '+x'], { color: '#e8d6ff' }),
  ...gardenFence(-12, 12, -14, 0, [[-3, 3]]),
  cyl(0, 0, -1, 2.6, 0.6, { mat: 'tiles', color: '#9fd0ff', sides: 20 }),
  cyl(0, 0.6, -1, 0.4, 1.3, { mat: 'plaster', color: '#f4f1ea', sides: 12 }),
  cyl(0, 1.9, -1, 1.1, 0.25, { mat: 'tiles', color: '#9fd0ff', sides: 16 }),
  ...planter(-9.5, 4, 3, 8, 0, 0.6, '#8a5a3a'), ...planter(9.5, 4, 3, 8, 0, 0.6, '#8a5a3a'),
  ...planter(-8, -10, 6, 2, 0, 0.6, '#8a5a3a'),
  box(-5.6, 0, -14.4, -5, 6.2, -13.6, SCENERY({ mat: 'metal', color: '#8a5bff' })), box(5, 0, -14.4, 5.6, 6.2, -13.6, SCENERY({ mat: 'metal', color: '#8a5bff' })),
  box(-6, 6.2, -14.5, 6, 6.8, -13.5, SCENERY({ mat: 'metal', color: '#8a5bff' })),

  // ---------------- G2: lantern walk ----------------
  ...building(-8, -14, 8, -60, 0, { color: '#9ec5f0', roofMat: 'tiles', roofColor: '#dcd4ec' }),
  box(-8, 0, -60, -7.7, 1.2, -14, GLASS), box(7.7, 0, -60, 8, 1.2, -14, GLASS),
  ...gazebo(-4, -28, 2.2, 0),
  ...hedge(1.5, -22, 3.2, -29, 0), ...hedge(-8, -36, -2.5, -37.4, 0), ...hedge(2.5, -38, 7.7, -39.4, 0),
  ...planter(5.5, -50, 3, 5, 0, 0.6, '#8a5a3a'), ...planter(-5.5, -52, 3, 5, 0, 0.6, '#8a5a3a'),
  stairs(-3, 0, -60, 3, TER, -53, '-z', { mat: 'tiles', color: '#f2e6f0' }),

  // ---------------- G3: turret terrace ----------------
  ...building(-26, -60, 8, -98, TER, { color: '#f4a6a6', roofMat: 'grass', roofColor: '#8fd47a', band: 3.9 }),
  box(-26, TER, -98, -25.7, TER + 1.2, -80.5, GLASS), box(-26, TER, -75.5, -25.7, TER + 1.2, -60, GLASS),   // west rail (gate gap)
  box(7.7, TER, -98, 8, TER + 1.2, -60, GLASS), box(-26, TER, -98, 8, TER + 1.2, -97.7, GLASS),
  box(-26, TER, -60.3, -3, TER + 1.2, -60, GLASS), box(3, TER, -60.3, 8, TER + 1.2, -60, GLASS),
  cyl(-9, TER, -80, 3.2, 1.6, { mat: 'brick', color: '#d98a8a', sides: 20 }),                // rose bed (turret perch)
  cyl(-9, TER + 1.6, -80, 3.35, 0.1, { mat: 'grass', color: '#5fbf5f', sides: 20, collide: false }),
  // hedge maze (west half)
  ...hedge(-22, -64, -12, -65.4, TER),                                       // north wall
  ...hedge(-15.4, -69, -14, -86, TER),                                       // corridor's east wall
  ...hedge(-24, -88, -15.4, -89.4, TER), ...hedge(-15.4, -89.4, -14, -97.7, TER),   // hidden pocket (enter at the far west)
  ...hedge(-21, -73, -18.5, -74.4, TER), ...hedge(-21, -82, -18.5, -83.4, TER),     // corridor cover
  ...hedge(1, -70, 6, -71.4, TER), ...hedge(-3, -86, 2, -87.4, TER),
  block(4.5, -92, 3, 3, TER, 1.1, { mat: 'wood', color: '#b8845a' }),

  // ---------------- G4: greenhouse grove ----------------
  box(-34, TER - 0.8, -80, -26, TER, -76, { mat: 'wood', color: '#c9955e' }),                   // bridge
  box(-34, TER, -80.3, -26, TER + 1.2, -80, GLASS), box(-34, TER, -76, -26, TER + 1.2, -75.7, GLASS),
  box(-33, -30, -79.5, -27, TER - 0.8, -76.5, SCENERY({ mat: 'plaster', color: '#8f7fa6' })),
  ...building(-58, -62, -34, -116, TER, { color: '#a8d8b9', roofMat: 'tiles', roofColor: '#e4f0e6' }),
  box(-34.3, TER, -116, -34, TER + 1.2, -80.3, GLASS), box(-34.3, TER, -75.7, -34, TER + 1.2, -62, GLASS),
  box(-58, TER, -116, -57.7, TER + 1.2, -62, GLASS), box(-58, TER, -62.3, -34, TER + 1.2, -62, GLASS),
  box(-58, TER, -116, -34, TER + 1.2, -115.7, GLASS),
  // the greenhouse: glass walls with doors north/south, glass roof
  box(-54, TER, -84.2, -50.5, TER + 3.8, -84, GLASS), box(-47.5, TER, -84.2, -44, TER + 3.8, -84, GLASS),
  box(-54, TER, -98.2, -50.5, TER + 3.8, -98, GLASS), box(-47.5, TER, -98.2, -44, TER + 3.8, -98, GLASS),
  box(-54.2, TER, -98.2, -54, TER + 3.8, -84, GLASS), box(-44, TER, -98.2, -43.8, TER + 3.8, -84, GLASS),
  prism([[-54.4, -83.8], [-43.6, -83.8], [-43.6, -98.4], [-54.4, -98.4]], TER + 3.8, TER + 4.0, { mat: 'glass', color: '#c8ffe0' }),
  block(-49, -84.1, 3, 0.3, TER + 3.1, 0.7, SCENERY({ mat: 'metal', color: '#2b2f3e' })),
  ...planter(-52, -91, 2, 5, TER, 0.7, '#8a5a3a'), ...planter(-46, -91, 2, 5, TER, 0.7, '#8a5a3a'),
  // orchid house (optional, timed switch) in the north-west corner
  box(-57.7, TER, -72.3, -51.5, TER + 3, -72, GLASS), box(-57.7, TER, -64.3, -51.5, TER + 3, -64, GLASS),
  box(-51.8, TER, -72.3, -51.5, TER + 3, -69.6, GLASS), box(-51.8, TER, -66.4, -51.5, TER + 3, -64, GLASS),
  box(-57.7, TER + 3, -72.3, -51.5, TER + 3.2, -64, GLASS),
  // cover + the moon-gate dais
  block(-38.5, -88, 2.6, 1.2, TER, 1.0, { mat: 'concrete', color: '#e8e2f0' }),
  block(-40, -100, 1.2, 2.6, TER, 1.0, { mat: 'concrete', color: '#ffd6e8' }),
  block(-53, -104, 2.4, 2.4, TER, 1.3, { mat: 'wood', color: '#b8845a' }),
  block(-46, -112.5, 14, 6, TER, DAIS - TER, { mat: 'tiles', color: '#f4ecf8' }),
  stairs(-49, TER, -109.5, -43, DAIS, -107.5, '-z', { mat: 'tiles', color: '#ffd6e8' }),
  block(-51.6, -114.6, 0.7, 0.7, DAIS, 5.2, SCENERY({ mat: 'metal', color: '#ff5fa8' })), block(-40.4, -114.6, 0.7, 0.7, DAIS, 5.2, SCENERY({ mat: 'metal', color: '#ff5fa8' })),
  box(-53, DAIS + 5.2, -115, -39, DAIS + 5.8, -114.2, SCENERY({ mat: 'metal', color: '#ff5fa8' })),
  box(-52.2, DAIS + 4.2, -114.9, -39.8, DAIS + 4.5, -114.3, SCENERY({ mat: 'metal', color: '#2b2f3e' })),

  // ---------------- the city ----------------
  box(-100, -31.5, -200, 60, -30.5, 40, SCENERY({ mat: 'asphalt', color: '#35304a' })),
  ...street(-100, -44, 40, -56, { along: 'x' }), ...street(18, 40, 26, -200, { along: 'z' }),
  ...skyline([
    [-30, 4, 18, 20, 14], [30, 6, 16, 18, 20], [-26, -36, 16, 22, 8], [26, -40, 18, 20, 12], [30, -84, 16, 22, 18],
    [-70, -60, 18, 20, 22], [-78, -104, 18, 22, 12], [-46, -140, 26, 16, 26], [0, -130, 20, 20, 16], [-16, -118, 10, 14, -8],
    [30, -130, 16, 18, 10], [0, 36, 28, 12, 12],
  ]),
];

const entities = [
  // ---------------- G1 ----------------
  T(0, 0, 3, { size: [24, 3, 4], dialogue: 'w2-3.switch', objective: 'Shoot the switch to open the gate' }),
  ent('switch', 7.5, 0, -9.5, { id: 'sw-1', yaw: -0.5, targets: ['gate-1'] }),
  ent('gate', 0, 0, -14, { id: 'gate-1', size: [5.4, 3.4, 0.6], color: '#d9c8ff' }),
  ent('pearl-trail', -4, 0, 7, { to: [4, 0, 7], count: 4 }),
  D('neon-sign', 0, 6.8, -13.9, { text: 'NEON GARDENS', color: '#7ee08f', height: 0.3 }),
  D('bush', -9.5, 0.6, 1.5, { flowerColor: '#ff5fd2' }), D('bush', -9.5, 0.6, 5.5, { flowerColor: '#2fd6ff' }), D('bush', 9.5, 0.6, 2, { flowerColor: '#ffd23f' }),
  D('bush', 9.5, 0.6, 6, { flowerColor: '#b98cff' }), D('bush', -8, 0.6, -10, { flowerColor: '#7ee08f' }),
  D('palm', -10.6, 0, 12.4), D('palm', 10.6, 0, 12.4), D('palm', 10.8, 0, -12),
  D('bench', -3.4, 0, 3.4, { yaw: PI }), D('bench', 3.4, 0, 3.4, { yaw: PI }),
  D('lamp', -11.2, 0, -4, { yaw: PI / 2, light: '#ff9ff0' }), D('lamp', 11.2, 0, -4, { yaw: -PI / 2, light: '#9ff3ff' }),
  D('flowerpot', -4, 0, -12.6, { color: '#ff5fd2' }), D('flowerpot', 4, 0, -12.6, { color: '#2fd6ff' }),
  D('vending', -11.4, 0, 9, { yaw: PI / 2, color: '#8a5bff', collide: true }),
  D('neon-sign', 12, 1.2, 4, { yaw: -PI / 2, text: 'FLOWER POWER', color: '#ff5fd2', height: 1.6 }),

  // ---------------- G2 ----------------
  ent('checkpoint', 4.8, 0, -17, { id: 'cp1', yaw: PI }),
  T(0, 0, -17.5, { size: [16, 3, 3], dialogue: 'w2-3.barrier', objective: 'Splat the grunts powering the barrier' }),
  ent('glooper', -4, 2.9, -28, { group: 'walk', yaw: 0 }),
  ent('glooper', 4.5, 0, -33, { group: 'walk', yaw: -0.2, patrol: [[4.5, 0, -33], [5.5, 0, -44], [0, 0, -40]] }),
  ent('shield-glooper', 0, 0, -43.5, { group: 'walk', yaw: 0 }),
  ent('glooper', -5, 0, -44, { group: 'walk', yaw: 0.3 }),
  ent('murk-barrier', 0, 0, -47, { id: 'bar-walk', size: [15.2, 4, 0.4], group: 'walk' }),
  ent('pearl-trail', -4, 2.9, -26.6, { to: [-4, 2.9, -29.4], count: 3 }),
  ent('pearl-trail', -6.5, 0, -18, { to: [-6.5, 0, -34], count: 5 }),
  D('lamp', -7.3, 0, -22, { yaw: PI / 2, light: '#ff9ff0' }), D('lamp', 7.3, 0, -30, { yaw: -PI / 2, light: '#9ff3ff' }),
  D('lamp', -7.3, 0, -40, { yaw: PI / 2, light: '#ffd23f' }), D('lamp', 7.3, 0, -52, { yaw: -PI / 2, light: '#ff9ff0' }),
  D('bush', 5.5, 0.6, -48.5, { flowerColor: '#ff5fd2' }), D('bush', 5.5, 0.6, -51.5, { flowerColor: '#ffd23f' }),
  D('bush', -5.5, 0.6, -50.5, { flowerColor: '#2fd6ff' }), D('bush', -5.5, 0.6, -53.5, { flowerColor: '#b98cff' }),
  D('flowerpot', 2.5, 0, -18.5, { color: '#ff5fd2' }), D('flowerpot', -2.5, 0, -18.5, { color: '#7ee08f' }),
  D('bench', 6.8, 0, -24, { yaw: -PI / 2 }),
  D('graffiti', 0, TER - 2.6, -59.96, { text: 'BLOOM', size: 4, color: '#7ee08f', color2: '#ff5fd2', height: 1.6 }),

  // ---------------- G3 ----------------
  ent('checkpoint', 5, TER, -63, { id: 'cp2', yaw: PI }),
  T(0, TER, -62.8, { size: [16, 3, 3], dialogue: 'w2-3.turret', objective: 'Flank the turret and shoot the switch on the rose bed' }),
  ent('murk-turret', -9, TER + 1.6, -81, { group: 'terrace', yaw: 0, aggro: 20 }),
  ent('switch', -9, TER + 1.6, -77.8, { id: 'sw-2', yaw: 0, targets: ['gate-2'] }),
  ent('glooper', -3.5, TER, -90, { group: 'terrace', yaw: 0.2 }),
  ent('glooper', 3.5, TER, -76, { group: 'terrace', yaw: 0, patrol: [[3.5, TER, -76], [4, TER, -86]] }),
  ent('bomblob', -19.5, TER, -74, { group: 'terrace', yaw: 0.4 }),
  ent('gate', -26, TER, -78, { id: 'gate-2', yaw: PI / 2, size: [4.4, 3.4, 0.6], color: '#d9c8ff' }),
  ent('pearl-trail', -11, TER + 1.6, -82.5, { to: [-7, TER + 1.6, -82.5], count: 3 }),
  ent('pearl-trail', -20, TER, -67.5, { to: [-20, TER, -75], count: 4 }),
  // the maze's dead end
  ent('postcard', -20, TER, -94.5, { id: 'w2-3-postcard', title: 'The Neon Gardens', from: 'Wren', text: 'Every flower glows a different colour at night. The gardener says they drink from the same spring we do.' }),
  ent('pearl-trail', -24.8, TER, -90.5, { to: [-24.8, TER, -94], count: 3 }),
  D('flowerpot', -24.6, TER, -96.6, { color: '#ff5fd2' }), D('flowerpot', -24.6, TER, -93.4, { color: '#2fd6ff' }),
  D('lamp', -25.2, TER, -92.5, { yaw: PI / 2, light: '#ffd23f' }),
  D('bush', -9, TER + 1.6, -80, { flowerColor: '#ff3f7a', color: '#2f8a3f' }),
  D('lamp', 7, TER, -70, { yaw: -PI / 2, light: '#9ff3ff' }), D('lamp', 7, TER, -90, { yaw: -PI / 2, light: '#ff9ff0' }),
  D('bench', 6.9, TER, -80, { yaw: -PI / 2 }), D('palm', 6.6, TER, -96.6), D('palm', -2, TER, -96.6),
  D('neon-sign', -9, TER, -76.7, { text: 'ROSE BED', color: '#ff3f7a', height: 2.2, pole: true }),
  D('speaker-tower', 6.8, TER, -61.4, { height: 2.4, color: '#7ee08f' }),
  D('flag', -24.8, TER, -61.2, { color: '#7ee08f', height: 4 }),

  // ---------------- G4 ----------------
  T(-36.5, TER, -78, { size: [4, 3, 4], dialogue: 'w2-3.pa', objective: 'Clear the greenhouse grove' }),
  ent('checkpoint', -37.5, TER, -73, { id: 'cp3', yaw: PI }),
  ent('buzzdrone', -48, TER, -78, { group: 'grove', alt: 4.5, patrol: [[-48, TER, -78], [-38, TER, -84]] }),
  ent('murk-turret', -40, TER, -104, { group: 'grove', yaw: 0.3, aggro: 20 }),
  ent('glooper', -49, TER, -91, { group: 'grove', yaw: 0 }),
  ent('bomblob', -37.5, TER, -94, { group: 'grove', yaw: 0 }),
  ent('shield-glooper', -47, TER, -104, { group: 'grove', yaw: 0 }),
  ent('glooper', -54, TER, -101, { group: 'grove', yaw: 0.4 }),
  ent('murk-barrier', -46, TER, -106.5, { id: 'bar-final', size: [23.2, 4.2, 0.4], group: 'grove' }),
  // orchid house (timed)
  ent('switch', -35.2, TER, -100, { id: 'sw-3', yaw: -PI / 2, targets: ['gate-orchid'], timer: 9 }),
  ent('gate', -51.65, TER, -68, { id: 'gate-orchid', yaw: PI / 2, size: [2.6, 2.6, 0.4], color: '#ffd6e8' }),
  T(-40, TER, -99, { size: [8, 3, 4], hint: 'A timed switch! Shoot it, then race to the orchid house', hintTime: 4 }),
  ent('pearl-trail', -56.5, TER, -66, { to: [-53, TER, -70.5], count: 6 }),
  ent('pearl-trail', -40, TER, -80, { to: [-40, TER, -90], count: 4 }),
  ent('prism-core', -46, DAIS, -112.5, { id: 'core' }),
  ent('pearl-trail', -50, DAIS, -111, { to: [-42, DAIS, -111], count: 3 }),
  D('neon-sign', -46, DAIS + 5.8, -114.8, { text: 'MOON GATE', color: '#ffd23f', height: 0.2 }),
  D('neon-sign', -49, TER + 4.0, -84, { text: 'GREENHOUSE', color: '#7ee08f', height: 0.5 }),
  D('bush', -52, TER + 0.7, -89, { flowerColor: '#ff5fd2' }), D('bush', -52, TER + 0.7, -93, { flowerColor: '#2fd6ff' }),
  D('bush', -46, TER + 0.7, -89, { flowerColor: '#ffd23f' }), D('bush', -46, TER + 0.7, -93, { flowerColor: '#b98cff' }),
  D('palm', -56.5, TER, -112.5), D('palm', -35.5, TER, -112.5), D('palm', -56.5, TER, -80),
  D('flowerpot', -55.5, TER, -68, { color: '#ff5fd2' }), D('flowerpot', -54, TER, -66, { color: '#b98cff' }), D('flowerpot', -56, TER, -70.5, { color: '#2fd6ff' }),
  D('lamp', -35, TER, -86, { yaw: -PI / 2, light: '#ff9ff0' }), D('lamp', -57, TER, -96, { yaw: PI / 2, light: '#9ff3ff' }),
  D('speaker-tower', -52.8, DAIS, -114, { height: 2, color: '#ff5fd2' }), D('speaker-tower', -39.2, DAIS, -114, { height: 2, color: '#7ee08f' }),
  D('flag', -54, TER, -107, { color: '#ff5fd2', height: 4 }), D('flag', -38, TER, -107, { color: '#7ee08f', height: 4 }),
  D('billboard', -62, TER - 2, -90, { yaw: PI / 2, text: 'Kelp Krunch' }),
  D('satellite', -36, TER, -64, { yaw: -PI / 3 }), D('antenna', -56.5, TER, -64.5, { variant: 'radar', height: 2.6 }),
];

export default {
  id: 'w2-3',
  name: 'Neon Gardens',
  world: 2,
  theme: 'heights',
  music: 'heights',
  // later in the evening: deeper sky, stars, stronger bloom on the neon
  themeOverride: {
    skyTop: '#1b1552', skyHorizon: '#d86aa8', skyBottom: '#8a4a8e', sunColor: '#ffb8d0', sunIntensity: 1.3,
    sunDir: [0.6, 0.26, -0.5], hemiSky: '#9a8cff', hemiGround: '#7a4a7a', hemiIntensity: 1.0,
    fog: '#7a4a88', fogNear: 70, fogFar: 320, stars: 0.75, bloom: 0.75, exposure: 1.08,
  },
  water: false,
  waterY: -40,
  killY: -12,
  spawn: { pos: [0, 0, 10], yaw: PI },
  objective: 'Flip the switches, drop the Murk barriers, reach the Prism Capsule',
  brushes,
  preInk: [
    murk(0, 0, -6, 1.8), murk(-4, 0, -30, 2.2), murk(3, 0, -36, 2.2), murk(0, 0, -44, 2.4), murk(-4, 2.9, -28, 1.4),
    murk(-9, TER + 1.6, -80, 2.2), murk(0, TER, -80, 2.4), murk(-20, TER, -74, 2), murk(-4, TER, -90, 2), murk(3, TER, -70, 1.8),
    murk(-40, TER, -92, 2.4), murk(-47, TER, -103, 2.6), murk(-49, TER, -90, 2.2), murk(-54, TER, -100, 2), murk(-40, TER, -104, 1.8),
    murk(-46, DAIS, -112.5, 2.4),
  ],
  entities,
  route: [
    [0, 0, 10], [0, 0, -8], [0, 0, -16], [-0.5, 0, -32], [0, 0, -46], [0, 0, -52], [0, TER, -61], [0, TER, -68],
    [-15, TER, -67], [-20, TER, -71], [-24.5, TER, -78], [-36, TER, -78], [-40, TER, -86], [-40, TER, -96],
    [-44, TER, -104], [-46, TER, -107.5], [-46, DAIS, -110.5], [-46, DAIS, -111.5],
  ],
};
