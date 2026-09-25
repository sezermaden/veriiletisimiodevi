// 1-1 First Splash — the tutorial. A sunny run down Brinewater's harbour front toward the end of
// the pier, one new trick per beat (every beat is a DIALOGUE id from story/script.js):
//
//   A  Boardwalk (spawn)     move: walk, look, hop the pallet wall ............ 'w1-1.move'
//   B  Market plaza          shoot: pop three Murk balloons → gate opens ...... 'w1-1.shoot'
//   C  Swim lane             swim along a pre-inked lane, tank refills ........ 'w1-1.swim' / 'w1-1.refill'
//   D  Warehouse yard        checkpoint 1, paint + climb the warehouse wall ... 'w1-1.checkpoint' / 'w1-1.climb'
//   E  Rooftops              squid leap across the alley gap .................. 'w1-1.jump'
//   F  Roof 2 + fire stairs  Murk ink to repaint ................................ 'w1-1.enemy-ink'
//   G  Loading bay           checkpoint 2, first 3 Gloopers → Murk barrier ....... 'w1-1.gloopers'
//   H  Gantry court          Gloopers behind a parapet: Burst Bomb → gate ........ 'w1-1.sub'
//   I  Pier's end            checkpoint 3, 5 Gloopers + Tidal Slam → barrier ...... 'w1-1.special'
//   J  Capsule platform      Prism Capsule ..................................... 'w1-1.capsule'
//
// Hidden: a fishing jetty behind the low container on the bay's west wall (postcard + pearls);
// a side float off the swim lane (pearls). Path runs toward -Z (the lighthouse is ahead-left).
import { block, box, cyl, stairs, rampC, ent, murk, heroInk } from '../kit.js';
import { PI, D, SCENERY, pier, quay, bollards, containerStack, warehouse, fishingBoat, cargoShip, farWarehouses, pearlRing } from './docks-kit.js';

const R1 = 4.52;            // warehouse roof top
const R2 = 6.02;            // office roof top (1.5 m above R1: too high for a kid jump)
const T = (x, y, z, o) => ent('trigger', x, y, z, o);

const brushes = [
  // ---------------- A: boardwalk + fish market ----------------
  ...pier(-7, 13, 7, -16, 0, { edges: 'x' }),
  ...pier(-17, 10, -7, -4, 0, { edges: 'z', color: '#bf8d62' }),
  block(0, -5, 14, 1.3, 0, 0.8, { mat: 'wood', color: '#9c6c44' }),                 // pallet wall (hop it)
  block(0, -5, 14.2, 1.5, 0.8, 0.08, { mat: 'metal', color: '#f2c230', collide: false }),
  block(-12.5, 3, 8, 11, 0, 4.2, { mat: 'plaster', color: '#f3e0c4' }),             // fish market shed
  block(-12.5, 3, 8.6, 11.6, 4.2, 0.3, { mat: 'metal', color: '#2f7fd8' }),
  block(-8.45, 3, 0.12, 6, 0.9, 2, { mat: 'glass', color: '#bfe8ff' }),             // shop window
  block(-7.6, 1.2, 1.2, 4.5, 0, 0.9, { mat: 'wood', color: '#e0612b' }),            // fish counter
  ...bollards(6.6, 11, 6.6, -14, 6),
  ...fishingBoat(11.5, 1, { hull: '#f4f1ea', stripe: '#2f7fd8' }),

  // ---------------- B: market plaza ----------------
  ...quay(-11, -16, 11, -40.6, 0, { mat: 'tiles', color: '#efe1cc', stripeSides: '-x+x' }),
  cyl(0, 0, -27, 2.5, 0.7, { mat: 'tiles', color: '#8fd3e8', sides: 20 }),            // fountain basin
  cyl(0, 0.7, -27, 0.45, 1.5, { mat: 'plaster', color: '#f4f1ea', sides: 12 }),
  cyl(0, 2.2, -27, 1.2, 0.28, { mat: 'tiles', color: '#8fd3e8', sides: 16 }),
  cyl(0, 2.48, -27, 0.2, 0.6, { mat: 'metal', color: '#f2c230', sides: 8 }),
  block(-9.6, -22, 2.2, 6, 0, 0.55, { mat: 'wood', color: '#b8845a' }),              // planters
  block(9.6, -33, 2.2, 6, 0, 0.55, { mat: 'wood', color: '#b8845a' }),
  // gate walls are unpaintable (paint: false): climbing them would skip the gate
  box(-11, 0, -40.6, -3, 4.4, -39.4, { mat: 'brick', color: '#e3a07a', paint: false }),            // gate wall
  box(3, 0, -40.6, 11, 4.4, -39.4, { mat: 'brick', color: '#e3a07a', paint: false }),
  box(-11.2, 4.4, -40.8, -3, 4.7, -39.2, { mat: 'concrete', color: '#f4f1ea', paint: false }),
  box(3, 4.4, -40.8, 11.2, 4.7, -39.2, { mat: 'concrete', color: '#f4f1ea', paint: false }),

  // ---------------- C: swim lane + side float ----------------
  ...pier(-3, -40.6, 3, -80, 0, { edges: 'x', color: '#b88a5e' }),
  ...pier(5.6, -64, 9.6, -71, 0, { edges: 'all', color: '#c49a6c', step: 3 }),
  ...fishingBoat(-9, -58, { hull: '#2f7fd8', stripe: '#f4f1ea', cabin: '#ffd23f', flip: true }),

  // ---------------- D: warehouse yard ----------------
  ...quay(-13, -80, 13, -100, 0, { mat: 'concrete', color: '#d9d1c4', stripeSides: '+z' }),
  ...warehouse(0, -111, 20, 22, R1 - 0.12, { color: '#c65a3e', roofColor: '#b8b0a6' }),
  ...containerStack(-11.75, -85.5, 2, 0, 1),
  ...containerStack(-11.75, -94, 1, 3, 1),
  ...containerStack(11.75, -85.5, 1, 5, 1),
  ...containerStack(11.75, -94, 2, 7, 1),
  block(-5.5, -91, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#f2c230' }),        // jersey barriers
  block(6, -88, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),

  // ---------------- E: rooftop 1, alley, office block ----------------
  block(-5, -106, 2.6, 2, R1, 1.4, { mat: 'metal', color: '#d6d9e2' }),             // AC units
  block(5.5, -113, 2, 2.6, R1, 1.4, { mat: 'metal', color: '#d6d9e2' }),
  block(-4, -116, 3, 3, R1, 0.35, { mat: 'glass', color: '#bfe8ff' }),              // skylights
  block(3, -105, 3, 3, R1, 0.35, { mat: 'glass', color: '#bfe8ff' }),
  box(-10, -0.5, -124.4, 10, 0, -122, { mat: 'asphalt', color: '#9c968e' }),        // alley floor (2.2 m wide)
  box(-10, -3.5, -124.4, 10, -0.5, -122, { mat: 'concrete', color: '#8e887f', paint: false }),
  block(-10.6, -123.2, 1.2, 2.4, -0.5, 3.5, { mat: 'brick', color: '#b44a36' }),    // alley end walls
  block(10.6, -123.2, 1.2, 2.4, -0.5, 3.5, { mat: 'brick', color: '#b44a36' }),
  block(0, -134.4, 20, 20.3, 0, R2 - 0.12, { mat: 'plaster', color: '#8fc6d8' }),    // office block (z -124.25..-144.55)
  block(0, -134.4, 20, 20.3, R2 - 0.12, 0.12, { mat: 'concrete', color: '#c9c2d0' }),
  box(-10, 0, -124.4, 10, R2 - 0.12, -124.2, { mat: 'glass', color: '#9fdcff' }),       // glass front: no shortcut climb
  cyl(4.5, R2, -140, 1.7, 0.2, { mat: 'metal', color: '#6d7384', sides: 14 }),        // water tank on stilts
  ...[[3.3, -138.8], [5.7, -138.8], [3.3, -141.2], [5.7, -141.2]].map(([x, z]) => block(x, z, 0.25, 0.25, R2, 1.6, { mat: 'metal', color: '#4a5063' })),
  cyl(4.5, R2 + 1.6, -140, 1.6, 2.4, { mat: 'wood', color: '#a8744a', sides: 16 }),
  cyl(4.5, R2 + 4.0, -140, 1.8, 0.9, { mat: 'metal', color: '#6d7384', sides: 16, rTop: 0.2 }),

  // ---------------- F/G: fire stairs + loading bay ----------------
  stairs(-2.5, 0, -158.5, 2.5, R2, -144.55, '+z', { mat: 'metal', color: '#6d7384' }),
  ...quay(-15, -144.55, 22, -190.6, 0, { mat: 'concrete', color: '#cfc8bd', stripeSides: '+x' }),
  ...containerStack(-13.75, -150, 2, 1, 1),
  ...containerStack(-13.75, -158.5, 2, 4, 1),
  ...containerStack(-13.75, -167, 2, 6, 1),
  ...containerStack(-13.75, -175.5, 1, 8, 1),          // the low one: climb over to the jetty
  ...containerStack(-13.75, -184, 2, 2, 1),
  ...containerStack(-8.5, -171, 1, 9, 1),              // cover
  block(5.5, -170, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#f2c230' }),
  block(-3, -179, 1.2, 2.6, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  block(8, -183, 2.4, 2.4, 0, 1.3, { mat: 'wood', color: '#b8845a' }),              // pallet stack
  ...bollards(21.6, -150, 21.6, -188, 8),
  box(-15, 0, -190.6, -3.7, 4.6, -189.4, { mat: 'plaster', color: '#e8e2d6', paint: false }),      // bay exit wall (unpaintable: no climbing round the barrier)
  box(3.7, 0, -190.6, 22, 4.6, -189.4, { mat: 'plaster', color: '#e8e2d6', paint: false }),
  // hidden fishing jetty
  ...pier(-26, -171.5, -15, -179.5, 0, { edges: 'all', color: '#c49a6c', step: 3 }),

  // ---------------- H: gantry court ----------------
  ...quay(-12, -190.6, 12, -216.6, 0, { mat: 'concrete', color: '#cfc7bb', stripe: false }),
  block(-7.5, -206, 9, 6, 0, 2.8, { mat: 'metal', color: '#d2d6de' }),              // gantry (x -12..-3, z -203..-209)
  box(-12, 2.8, -203.2, -3, 3.35, -203, { mat: 'metal', color: '#f2c230' }),         // parapet (front, low: they peek over)
  box(-3.2, 2.8, -209, -3, 3.35, -205.2, { mat: 'metal', color: '#f2c230' }),         // parapet (east, leaves the stair gap)
  stairs(-3, 0, -205, 0.2, 2.8, -203.2, '-x', { mat: 'metal', color: '#f2c230' }),   // flank stairs up
  box(-12, 0, -216.6, 1.2, 4.6, -215.4, { mat: 'brick', color: '#c65a3e', paint: false }),         // exit wall with gate (x 1.25..6.75), unpaintable
  box(6.8, 0, -216.6, 12, 4.6, -215.4, { mat: 'brick', color: '#c65a3e', paint: false }),
  block(7.5, -198, 2.4, 1.2, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),

  // ---------------- I: pier's end plaza ----------------
  ...pier(-12, -216.6, 12, -250, 0, { edges: 'x', color: '#c49366' }),
  block(-6.5, -230, 2.6, 1.2, 0, 1.0, { mat: 'concrete', color: '#f2c230' }),
  block(6.5, -236, 1.2, 2.6, 0, 1.0, { mat: 'concrete', color: '#e8e2d6' }),
  block(0, -241, 3, 1.4, 0, 1.2, { mat: 'wood', color: '#9c6c44' }),
  block(-8, -245, 2.2, 2.2, 0, 1.3, { mat: 'wood', color: '#b8845a' }),

  // ---------------- J: capsule platform ----------------
  ...pier(-3, -250, 3, -256, 0, { edges: 'x', color: '#b88a5e' }),
  cyl(0, -0.6, -264, 8.5, 0.6, { mat: 'tiles', color: '#f4f1ea', sides: 28 }),
  cyl(0, -3.5, -264, 8.3, 2.9, SCENERY({ mat: 'concrete', color: '#a9a39a', sides: 28 })),
  cyl(0, 0, -264, 3.4, 0.05, { mat: 'tiles', color: '#ffb35a', sides: 28, collide: false }),

  // ---------------- scenery: ship, far quay, breakwater ----------------
  ...cargoShip(33, -176, { length: 84, seed: 2 }),
  ...farWarehouses(-10, -66, 14, { dir: -1 }).map((b) => ({ ...b, min: [b.min[2], b.min[1], b.min[0]], max: [b.max[2], b.max[1], b.max[0]] })),
  block(-46, -150, 8, 190, -3, 3.2, SCENERY({ mat: 'concrete', color: '#b9b3ab' })),   // far breakwater
];

const entities = [
  // ---------------- A ----------------
  T(0, 0, 7, { size: [14, 4, 10], dialogue: 'w1-1.move', delay: 0.4, objective: 'Head down the boardwalk' }),
  T(0, 0, -2, { size: [14, 3, 2.5], hint: 'Press {jump} to hop over the pallets', hintTime: 4 }),
  ent('npc', 3.6, 0, 4.2, { who: 'brine', yaw: -PI / 4, idle: 'wave' }),
  ent('pearl-trail', -4.5, 0, -9, { to: [4.5, 0, -13], count: 5 }),
  D('lamp', -6.4, 0, 9, { yaw: PI / 2 }), D('lamp', 6.4, 0, 3, { yaw: -PI / 2 }), D('lamp', -6.4, 0, -12, { yaw: PI / 2 }), D('lamp', 6.4, 0, -12, { yaw: -PI / 2 }),
  D('bench', 5.8, 0, 8.5, { yaw: -PI / 2 }), D('barrel', -6.2, 0, 1.5), D('barrel', -5.6, 0, 0.8, { variant: 'toxic' }),
  D('crate-stack', 5.2, 0, -1.2, { count: 3, yaw: 0.3 }), D('tire-stack', -6, 0, -8, { count: 3 }),
  D('awning', -8.5, 0, 3, { yaw: PI / 2, length: 6, color: '#2f7fd8', height: 2.8 }),
  D('neon-sign', -8.5, 0, 3, { yaw: PI / 2, text: 'FRESH FISH', color: '#2fd6ff', height: 3.6 }),
  D('flowerpot', -8.2, 0, -1.6), D('flowerpot', -8.2, 0, 7.4, { color: '#ffd23f' }),
  D('chimney', -14.5, 4.5, 6), D('satellite', -11, 4.5, -0.6, { yaw: PI / 3 }),
  D('flag', -16.2, 0, -3.2, { color: '#ff8a1f', height: 5.5 }), D('flag', -16.2, 0, 9.2, { color: '#2fd6ff', height: 5.5 }),
  D('buoy', 9, -1.6, 10), D('buoy', -10, -1.6, -12, { color: '#2fb35a', light: '#ff3030' }), D('buoy', 16, -1.6, -8),
  D('billboard', 10.5, 0, -11, { yaw: -PI / 2 + 0.35, text: 'Squidberry Soda' }),

  // ---------------- B ----------------
  T(0, 0, -17.5, { size: [22, 3, 3], dialogue: 'w1-1.shoot', objective: 'Pop the Murk balloons', hint: 'Hold {fire} to shoot. Pop the balloons!' }),
  ent('balloon', -5, 2.8, -33, { group: 'intro', pearls: 2 }),
  ent('balloon', 0, 2.95, -35.5, { group: 'intro', pearls: 2, move: [0, 0.8, 0], period: 3 }),
  ent('balloon', 5, 2.6, -32, { group: 'intro', pearls: 2 }),
  ent('gate', 0, 0, -40, { id: 'gate-plaza', size: [5, 3.4, 0.6], openOn: 'event:balloons:intro' }),
  ent('npc', -6.5, 0, -21.5, { who: 'kid', yaw: PI / 2 + 0.4, idle: 'cheer' }),
  ...pearlRing(0, 0.7, -27, 1.6, 4),
  D('palm', -10, 0, -17.5), D('palm', 10, 0, -17.5), D('palm', -10, 0, -38), D('palm', 10, 0, -38),
  D('bush', -9.6, 0.55, -21), D('bush', -9.6, 0.55, -23.4, { flowerColor: '#ffd23f' }), D('bush', 9.6, 0.55, -32), D('bush', 9.6, 0.55, -34.4, { flowerColor: '#ff7ab8' }),
  D('bench', -3.6, 0, -23, { yaw: PI * 0.75 }), D('bench', 3.6, 0, -31, { yaw: -PI / 4 }),
  D('awning', 10.8, 0, -24, { yaw: -PI / 2, length: 4, color: '#ff8a1f' }), D('vending', 10.3, 0, -26.8, { yaw: -PI / 2, color: '#ff3fa4', collide: true }),
  D('awning', -10.8, 0, -31, { yaw: PI / 2, length: 4, color: '#35b56a' }), D('vending', -10.3, 0, -28.4, { yaw: PI / 2, color: '#2fb6ff', collide: true }),
  D('graffiti', -7, 0.4, -39.37, { text: 'SPLASH!', size: 5, color: '#ff8a1f', color2: '#ffd23f' }),
  D('graffiti', 7, 0.4, -39.37, { style: 'squid', size: 3.6, color: '#2fd6ff', color2: '#ff5fa8' }),
  D('neon-sign', 0, 4.7, -39.6, { text: 'PIX FM 88.1', color: '#ff5fd2', height: 0.8 }),
  D('lamp', -3.8, 0, -38.9, { yaw: PI }), D('lamp', 3.8, 0, -38.9, { yaw: PI }),
  
  // ---------------- C ----------------
  T(0, 0, -43, { size: [6, 3, 3], dialogue: 'w1-1.swim', objective: 'Swim down the pier', hint: 'Hold {swim} to dive into your ink and swim!' }),
  T(0, 0, -62, { size: [6, 3, 3], dialogue: 'w1-1.refill' }),
  ent('pearl-trail', 0, 0, -47, { to: [0, 0, -75], count: 8 }),
  ent('pearl-trail', 6.4, 0, -67.5, { to: [8.8, 0, -67.5], count: 3 }),
  D('lamp', -2.7, 0, -48, { yaw: PI / 2 }), D('lamp', 2.7, 0, -60, { yaw: -PI / 2 }), D('lamp', -2.7, 0, -72, { yaw: PI / 2 }),
  D('crate-stack', 8.4, 0, -70, { count: 2, yaw: 0.4 }), D('flag', 9.2, 0, -64.6, { color: '#ffd23f', height: 4 }),
  D('buoy', 6, -1.6, -50), D('buoy', -6, -1.6, -70, { color: '#f2c230' }), D('buoy', 7, -1.6, -78, { color: '#2fb35a', light: '#ff3030' }),

  // ---------------- D ----------------
  T(0, 0, -76, { size: [6, 3, 2], dialogue: 'w1-1.checkpoint' }),
  ent('checkpoint', 1.4, 0, -81.8, { id: 'cp1', yaw: PI, radius: 4.5 }),          // spans the whole pier exit
  T(0, 0, -93, { size: [24, 3, 5], dialogue: 'w1-1.climb', objective: 'Climb onto the warehouse roof', hint: 'Paint the wall with {fire}, then hold {swim} to swim up it' }),
  ent('pearl-trail', 0, 0.8, -99.5, { to: [0, 3.8, -99.5], count: 3 }),
  D('graffiti', -5.5, 0.6, -99.95, { text: 'CLIMB!', size: 4.5, color: '#ffd23f', color2: '#ff8a1f' }),
  D('graffiti', 6, 0.5, -99.95, { style: 'squid', size: 3, color: '#ff8a1f', color2: '#2fd6ff' }),
  D('neon-sign', 0, R1, -100.2, { text: 'BRINE & CO. 1962', color: '#ffc53a', height: 0.9 }),
  D('lamp', -9.5, 0, -98.8, { yaw: 0.3 }), D('lamp', 9.5, 0, -98.8, { yaw: -0.3 }),
  D('barrel', 8.8, 0, -97.5), D('barrel', 9.6, 0, -96.9, { variant: 'toxic' }), D('barrel', -9.4, 0, -97.2),
  D('crate-stack', -8.5, 0, -82.5, { count: 4, yaw: -0.2 }), D('cone', -3, 0, -86), D('cone', -2.2, 0, -86.8), D('tire-stack', 9.2, 0, -91, { count: 4 }),
  
  // ---------------- E ----------------
  T(0, R1, -116.5, { size: [20, 3, 5], dialogue: 'w1-1.jump', objective: 'Squid-leap to the next roof' }),
  ent('pearl-trail', -7, R1, -104, { to: [-7, R1, -118], count: 4 }),
  ent('pearl-trail', 0, R1 + 1.2, -122.4, { to: [0, R2 + 0.6, -124.8], count: 3 }),
  D('chimney', 8, R1, -120), D('antenna', -8.5, R1, -120.5, { height: 3.4 }), D('satellite', 8, R1, -102.5, { yaw: PI * 0.8 }),
  D('pipe', -9.3, R1, -110, { yaw: PI / 2, length: 8, radius: 0.2, height: 0.5 }),
  D('graffiti', 0, 0, -122.03, { yaw: PI, text: 'LEAP!', size: 4, color: '#ff5fa8', color2: '#ffd23f' }),
  D('graffiti', -4.5, 0.4, -124.42, { text: 'MURK GO HOME', size: 5, color: '#8fe3ff', color2: '#ffffff' }),
  D('barrel', 8.5, 0, -124.3), D('barrel', -8.8, 0, -123.4, { variant: 'toxic' }), D('crate-stack', 6, 0, -123.5, { count: 2 }),

  // ---------------- F ----------------
  T(0, R2, -128.4, { size: [18, 3, 3], dialogue: 'w1-1.enemy-ink', objective: 'Paint over the Murk and take the fire stairs' }),
  D('billboard', -4.5, R2, -143.4, { text: 'Murk Industries' }),
  D('antenna', -7.8, R2, -129.6, { variant: 'radar', height: 2.4 }), D('chimney', 7.5, R2, -130.5),
  D('railing', -2.75, 0, -151.5, { yaw: PI / 2, length: 14 }), D('railing', 2.75, 0, -151.5, { yaw: PI / 2, length: 14 }),
  ent('pearl-trail', -6, R2, -132, { to: [-6, R2, -140], count: 4 }),

  // ---------------- G ----------------
  ent('checkpoint', 1.6, 0, -160.6, { id: 'cp2', yaw: PI, radius: 4 }),           // foot of the fire stairs
  T(0, 0, -160.5, { size: [30, 3, 4], dialogue: 'w1-1.gloopers', objective: 'Splat the Gloopers' }),
  ent('glooper', -6, 0, -175, { group: 'bay', yaw: 0 }),
  ent('glooper', 6, 0, -178, { group: 'bay', yaw: 0.3, patrol: [[6, 0, -178], [10, 0, -168], [3, 0, -172]] }),
  ent('glooper', 0, 0, -185, { group: 'bay', yaw: 0 }),
  ent('murk-barrier', 0, 0, -190, { id: 'bar-bay', size: [7, 4, 0.4], group: 'bay' }),
  ent('pearl-trail', 12, 0, -154, { to: [12, 0, -184], count: 5 }),
  ent('pearl', -13.75, 2.6, -173.5), ent('pearl', -13.75, 2.6, -175.5), ent('pearl', -13.75, 2.6, -177.5),   // hint: over the low box
  D('crane', 18.5, 0, -160, { yaw: -PI / 2, collide: true }), D('crane', 18.5, 0, -182, { yaw: -PI / 2, color: '#e0612b', collide: true }),
  D('lamp', -11.8, 0, -162, { yaw: PI / 2 }), D('lamp', 14.4, 0, -175, { yaw: -PI / 2 }),
  D('barrel', 13.2, 0, -153.5), D('barrel', 13.8, 0, -154.3), D('barrel', 13, 0, -155.3, { variant: 'toxic' }),
  D('crate-stack', 10.5, 0, -187.5, { count: 3, yaw: 0.2 }), D('tire-stack', -11.4, 0, -188.2, { count: 5 }),
  D('cone', 2.5, 0, -165), D('cone', -2.5, 0, -165),
  D('graffiti', -10, 0.4, -189.37, { text: 'YARD B', size: 4, color: '#ffd23f', color2: '#ff5fa8' }),
  D('flag', 16, 0, -148, { color: '#6a2bd9', height: 5 }),
  D('neon-sign', 0, 4.6, -189.5, { text: 'MURK ZONE', color: '#b77dff', height: 0.9 }),
  // hidden jetty
  ent('postcard', -23.4, 0, -175.5, { id: 'w1-1-postcard', title: 'Greetings from Brinewater!', from: 'Juno', text: 'Wish you were here! The sunsets turn the whole harbour tangerine. Grandpa says the colour comes up from under the old lighthouse. I think he\'s pulling my tentacle.' }),
  ent('pearl-trail', -16.5, 0, -175.5, { to: [-21.5, 0, -175.5], count: 4 }),
  D('bench', -20, 0, -178.6, { yaw: 0 }), D('lamp', -25.4, 0, -172.2, { yaw: PI * 0.75 }), D('crate-stack', -17, 0, -172.4, { count: 2 }),
  D('buoy', -29, -1.6, -170), D('flowerpot', -25.2, 0, -178.8, { color: '#ff5fa2' }),

  // ---------------- H ----------------
  T(0, 0, -192.5, { size: [8, 3, 3], dialogue: 'w1-1.sub', objective: 'Clear the gantry', hint: 'Press {sub} to lob a Burst Bomb over their cover' }),
  ent('glooper', -9.5, 2.8, -205, { group: 'gantry', yaw: 0.4 }),
  ent('glooper', -5.2, 2.8, -206.5, { group: 'gantry', yaw: 0 }),
  ent('gate', 4, 0, -216, { id: 'gate-court', size: [5, 3.4, 0.6], openOn: 'group:gantry' }),
  ent('pearl-trail', -11, 2.8, -207.8, { to: [-4, 2.8, -207.8], count: 4 }),
  D('lamp', 11.4, 0, -195, { yaw: -PI / 2 }), D('lamp', -11.4, 0, -195, { yaw: PI / 2 }),
  D('speaker-tower', -11, 2.8, -208.2, { height: 2.2, color: '#b77dff' }),
  D('barrel', 10.8, 0, -212.5), D('barrel', 11.2, 0, -213.4, { variant: 'toxic' }), D('crate-stack', 10, 0, -204, { count: 3 }),
  D('graffiti', 9.4, 0.4, -215.37, { style: 'arrow', size: 3.4, color: '#ff8a1f', color2: '#ffd23f' }),
  D('neon-sign', 4, 4.6, -215.3, { text: 'PIER 9', color: '#2fd6ff', height: 0.9 }),
  
  // ---------------- I ----------------
  T(4, 0, -218.6, { size: [8, 3, 3], dialogue: 'w1-1.special', objective: 'Clear the pier', hint: 'Paint turf to charge your special, then press {special}' }),
  ent('checkpoint', 4.9, 0, -220.2, { id: 'cp3', yaw: PI, radius: 3.8 }),        // just through the court gate (circle stays clear of it)
  ent('glooper', -6, 0, -228, { group: 'pier', yaw: 0 }),
  ent('glooper', 5, 0, -231, { group: 'pier', yaw: 0, patrol: [[5, 0, -231], [9, 0, -240], [2, 0, -238]] }),
  ent('glooper', 0, 0, -238, { group: 'pier', yaw: 0 }),
  ent('glooper', -9, 0, -242, { group: 'pier', yaw: 0.3 }),
  ent('glooper', 9, 0, -246, { group: 'pier', yaw: -0.3 }),
  ent('murk-barrier', 0, 0, -250, { id: 'bar-final', size: [8.5, 4, 0.4], group: 'pier' }),   // wider than the 6 m pier: no jumping round its ends
  ent('pearl-trail', -10.5, 0, -223, { to: [-10.5, 0, -235], count: 4 }),
  D('lamp', -11.4, 0, -226, { yaw: PI / 2 }), D('lamp', 11.4, 0, -234, { yaw: -PI / 2 }), D('lamp', -11.4, 0, -244, { yaw: PI / 2 }),
  D('barrel', 10.8, 0, -225), D('barrel', 11.2, 0, -224.2), D('crate-stack', 10.4, 0, -247.5, { count: 3, yaw: -0.3 }),
  D('flag', -11.3, 0, -249.5, { color: '#6a2bd9' }), D('flag', 11.3, 0, -249.5, { color: '#6a2bd9' }),
  D('buoy', -16, -1.6, -240, { color: '#2fb35a', light: '#ff3030' }),

  // ---------------- J ----------------
  T(0, 0, -253.5, { size: [6, 3, 3], dialogue: 'w1-1.capsule', objective: 'Crack open the Prism Capsule' }),
  ent('prism-core', 0, 0, -265, { id: 'core' }),
  ent('pearl-trail', 0, 0, -251, { to: [0, 0, -257], count: 3 }),
  D('speaker-tower', -6, 0, -269, { height: 3, color: '#ff8a1f' }), D('speaker-tower', 6, 0, -269, { height: 3, color: '#2fd6ff' }),
  D('flag', -7.6, 0, -261, { color: '#ff8a1f' }), D('flag', 7.6, 0, -261, { color: '#2fd6ff' }),
  D('lamp', -4.4, 0, -258.2, { yaw: PI * 0.75 }), D('lamp', 4.4, 0, -258.2, { yaw: -PI * 0.75 }),
  D('billboard', 0, 0, -271.6, { text: 'Murk Industries' }),
  D('buoy', -12, -1.6, -262), D('buoy', 12, -1.6, -266, { color: '#f2c230' }), D('buoy', 0, -1.6, -280, { color: '#2fb35a', light: '#ff3030' }),
];

export default {
  id: 'w1-1',
  name: 'First Splash',
  world: 1,
  theme: 'docks',
  music: 'docks',
  waterY: -1.6,
  killY: -3.2,
  spawn: { pos: [0, 0, 8], yaw: PI },
  objective: 'Crack open the Prism Capsule at the end of the pier',
  brushes,
  preInk: [
    // swim lane "ink road"
    // (blobs 2.3 m apart so the squid never surfaces between them)
    ...Array.from({ length: 15 }, (_, i) => heroInk(i % 2 ? 0.4 : -0.4, 0, -44.5 - i * 2.3, 1.7)),
    // a tempting ink runway to the roof edge
    heroInk(0, R1, -119.2, 1.5), heroInk(0, R1, -121.2, 1.3),
    // Murk on roof 2 and the fire stairs
    murk(-3, R2, -132, 2.3), murk(3.5, R2, -135, 2.4), murk(0, R2, -139.5, 2.6), murk(-5, R2, -141, 2), murk(0, R2, -143.8, 2.2),
    murk(0, 4.2, -148, 2.2), murk(0, 2.6, -152.5, 2.2), murk(0, 1.0, -156.5, 2.2),
    // Murk around the bay and the pier's end
    murk(-6, 0, -175, 2.6), murk(6, 0, -178, 2.4), murk(0, 0, -185, 2.8), murk(-2, 0, -168, 1.8), murk(8, 0, -165, 1.6),
    murk(-7.5, 2.8, -206, 2.4), murk(0, 0, -210, 2), murk(4, 0, -214, 1.8),
    murk(-6, 0, -228, 2.4), murk(5, 0, -233, 2.4), murk(0, 0, -238, 2.8), murk(-9, 0, -243, 2.2), murk(9, 0, -246, 2.2), murk(0, 0, -249, 2),
    murk(0, 0, -264, 3.2),
  ],
  entities,
  route: [
    [0, 0, 8], [0, 0, -3], [0, 0, -8], [0, 0, -20], [-4.2, 0, -27], [0, 0, -38.5], [0, 0, -44], [0, 0, -78], [0, 0, -97],
    [0, R1, -102, 'climb'], [0, R1, -120.5], [0, R2, -126.5, 'squidjump'], [0, R2, -143.5], [0, 0, -160], [0, 0, -188.5],
    [2, 0, -195], [4, 0, -214.5], [4, 0, -220], [3.5, 0, -236], [0, 0, -248.5], [0, 0, -256], [0, 0, -262],
  ],
};
