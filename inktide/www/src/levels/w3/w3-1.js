// 3-1 Sludge Lines — the Murk Refinery's night shift. The route runs north (−Z) over a violet
// sludge lake on steel caissons, catwalks and conveyor belts:
//   Dock (spawn) → grate bridge → INTAKE YARD (teaches Murk Pods; barrier 'yard')
//   → CP1 → LINE 1 HALL: a forward belt under fire from two sorting decks, a cross belt that
//     drifts you toward the sludge, and a reversed belt shut down from the Line 1 control post
//     (switch 'sw-line1') → CONTROL DECK (barrier 'line1') → CP2
//   → STEAM GALLERY: three timed vent chokes (teaches vents) → CP3
//   → MAIN LINE: floor conveyors loop around the control tower; clear group 'main' to drop the
//     barrier, climb the tower and shoot 'sw-main' to stop the line and open the capsule gate
//   → PRISM CAPSULE.
// Deck height 0, sludge (water) at −2.2, killY −3.4.
import { block, box, ramp, stairs, cyl, ent, murk } from '../kit.js';
import { island, catwalk, beltBed, tank, vatRing, lake, D } from './refinery-kit.js';

const PI = Math.PI;
const SL = -2.2;

const brick = (o = {}) => ({ mat: 'brick', color: '#8a6a5e', ...o });
const steel = (c = '#6f7a8c', o = {}) => ({ mat: 'metal', color: c, ...o });
const conc = (c = '#d2d4da', o = {}) => ({ mat: 'concrete', color: c, ...o });

/** Background refinery block (unpaintable scenery) with tanks and a stack on top. */
function scenery(cx, cz, w, d, h, c) {
  return [
    block(cx, cz, w, d, -2.8, h + 2.8, { mat: 'metal', color: c, paint: false }),
    block(cx, cz, w + 0.4, d + 0.4, h, 0.4, { mat: 'concrete', color: '#8c93a0', paint: false }),
    cyl(cx - w * 0.25, h + 0.4, cz, Math.min(w, d) * 0.22, h * 0.6, { mat: 'metal', color: '#b9c2cf', paint: false, sides: 16 }),
  ];
}

const brushes = [
  // ---------------- Dock (spawn) ----------------
  ...island(0, 4, 18, 14, 0, { color: '#5f6b7c', cap: 'concrete', capColor: '#c9ccd4' }),
  block(-3.6, -2.4, 1.2, 1.2, 0, 5.2, steel('#4a5163')),
  block(3.6, -2.4, 1.2, 1.2, 0, 5.2, steel('#4a5163')),
  block(0, -2.4, 8.6, 1.3, 5.2, 0.9, steel('#f2b134')),
  block(6.6, 1.8, 4.6, 4.2, 0, 1.1, { mat: 'container', color: '#3a8f7a' }),          // loading bay (jump up)
  ...tank(-6.2, 8.4, 1.7, 0, 5.4, { color: '#b9c2cf' }),
  ...tank(6.4, 8.6, 1.4, 0, 4.2, { color: '#c7a14a' }),
  block(-7.6, 1.5, 2.6, 2.6, 0, 1.0, conc('#b8bec9')),
  // ---------------- bridge ----------------
  ...catwalk(-1.6, -12.2, 1.6, -3.0, 0, { every: 4.5 }),
  // ---------------- Intake Yard ----------------
  ...island(0, -24, 24, 24, 0, { color: '#6f7a8c', capColor: '#c3c8d2' }),
  block(-11, -24, 2, 18, 0, 3.2, steel('#7d8a96')),                                    // wall-walk (climb)
  ...tank(9.4, -16.8, 1.8, 0, 4.6, { color: '#b9c2cf' }),
  ...tank(9.4, -22.6, 1.8, 0, 4.6, { color: '#4f9a6a' }),
  block(-4, -20, 3.2, 1, 0, 1.1, conc('#d6d0c6')),
  block(4.6, -29, 1, 3.2, 0, 1.1, conc('#d6d0c6')),
  block(-6.5, -29.5, 1, 2.6, 0, 1.1, conc('#d6d0c6')),
  // intake building façade with the barrier doorway
  // (unpaintable, like every wall framing a Murk barrier: no climbing over the fight)
  block(-7.5, -35, 9, 2, 0, 5.6, brick({ paint: false })),
  block(7.5, -35, 9, 2, 0, 5.6, brick({ paint: false })),
  block(0, -35, 6, 2, 4.3, 1.3, brick({ paint: false })),
  block(0, -35.3, 24.6, 2.6, 5.6, 0.45, conc('#9aa0aa', { paint: false })),
  // ---------------- landing (CP1) ----------------
  ...island(0, -41.5, 10, 11, 0, { color: '#5f6b7c', cap: 'tiles', capColor: '#cfd3dc' }),
  // ---------------- Line 1 hall ----------------
  ...beltBed(0, -57, 3, 20.4, 0, 'z'),                                                  // B1 forward
  ...island(-9, -57, 5, 8, 1.0, { color: '#6f7a8c', capColor: '#b9bfca' }),             // sorting deck W
  ...island(9, -60, 5, 8, 1.0, { color: '#6f7a8c', capColor: '#b9bfca' }),              // sorting deck E
  ...island(0, -72.25, 10, 10.5, 0, { color: '#5f6b7c', capColor: '#c3c8d2' }),         // J1
  ...beltBed(0, -80.5, 6.9, 18, 0, 'x'),                                                // B2 cross (+x)
  ...island(0, -89, 14, 11, 0, { color: '#5f6b7c', capColor: '#c3c8d2' }),              // J2
  block(-4.5, -91.5, 3, 3, 0, 3.6, steel('#5f6b7c')),                                   // Line 1 control post
  block(-4.5, -91.5, 3, 3, 3.6, 0.2, steel('#f2b134')),
  ...beltBed(0, -107, 3.5, 25.2, 0, 'z'),                                               // B3 reversed (+z)
  // ---------------- control deck (CP2) ----------------
  ...island(0, -125, 16, 11, 0, { color: '#6f7a8c', cap: 'tiles', capColor: '#d6dae2' }),
  block(3.6, -121.8, 2.4, 1, 0, 1.1, conc('#d6d0c6')),
  block(-3.8, -122.6, 1, 2.4, 0, 1.1, conc('#d6d0c6')),
  block(-6.4, -128.2, 2.4, 2.4, 0, 2.2, steel('#4a5163')),                              // control cabinet
  // gallery gate frame
  block(-5.5, -130.6, 5, 1.2, 0, 5.4, brick({ paint: false })),
  block(5.5, -130.6, 5, 1.2, 0, 5.4, brick({ paint: false })),
  block(0, -130.6, 6, 1.2, 4.3, 1.1, brick({ paint: false })),
  // ---------------- steam gallery ----------------
  ...island(0, -143.2, 10, 25, 0, { color: '#5f6b7c', cap: 'asphalt', capColor: '#a9aeb8' }),
  block(-5.8, -143.2, 1.6, 24, -2.8, 7.8, brick({ color: '#806257' })),                      // gallery walls (climb)
  block(5.8, -143.2, 1.6, 24, -2.8, 7.8, brick({ color: '#806257' })),
  box(-2, 0, -137.6, 5, 4, -136.4, { mat: 'container', color: '#c7a14a' }),                                   // choke 1 (open west)
  box(-5, 0, -143.6, 2, 4, -142.4, { mat: 'container', color: '#3a8f7a' }),                                   // choke 2 (open east)
  box(-5, 0, -149.6, -1.5, 4, -148.4, { mat: 'container', color: '#c83a5a' }),                                // choke 3 (open centre)
  box(1.5, 0, -149.6, 5, 4, -148.4, { mat: 'container', color: '#c83a5a' }),
  ...catwalk(-2, -159.3, 2, -155.4, 0, { every: 4 }),
  // ---------------- Main Line arena (CP3) ----------------
  ...island(0, -172, 30, 26, 0, { color: '#6f7a8c', capColor: '#c3c8d2' }),
  block(0, -172, 6, 6, 0, 5, steel('#5f6b7c')),                                          // control tower (climb)
  block(0, -172, 6, 6, 5, 0.25, steel('#f2b134')),
  block(-5, -161.5, 3, 3, 0, 1.5, { mat: 'container', color: '#c83a5a' }),              // bomblob perch
  block(11, -181, 6, 6, 0, 1.4, conc('#b8bec9')),                                       // NE deck (turret)
  ramp(11, 0, -178, 14, 1.4, -175, '-z', steel('#8894a0')),
  block(-11.5, -167, 5, 7, 0, 1.4, conc('#b8bec9')),                                    // W deck
  ramp(-9, 0, -167, -6.5, 1.4, -164, '-x', steel('#8894a0')),
  block(9.5, -164.5, 1, 3, 0, 1.1, conc('#d6d0c6')),
  block(-9, -178, 3, 1, 0, 1.1, conc('#d6d0c6')),
  // north wall with the barrier doorway
  block(-9, -185.5, 12, 1.2, -2.8, 7.3, brick({ paint: false })),
  block(9, -185.5, 12, 1.2, -2.8, 7.3, brick({ paint: false })),
  block(0, -185.5, 6, 1.2, 4.3, 0.2, brick({ paint: false })),
  // passage + gate, capsule platform
  ...island(0, -189, 8, 7, 0, { color: '#5f6b7c', cap: 'tiles', capColor: '#d6dae2' }),
  block(-3.6, -189, 0.8, 6.4, 0, 4.2, brick({ color: '#7a5e54', paint: false })),   // no climbing round the capsule gate
  block(3.6, -189, 0.8, 6.4, 0, 4.2, brick({ color: '#7a5e54', paint: false })),
  ...island(0, -199, 18, 13, 0, { color: '#5f6b7c', cap: 'tiles', capColor: '#e2e5ec' }),
  cyl(0, 0, -200, 3, 0.4, { mat: 'tiles', color: '#ffc53a', sides: 24 }),
  ...tank(-6.5, -202.5, 1.6, 0, 5, { color: '#b9c2cf' }),
  ...tank(6.5, -202.5, 1.6, 0, 5, { color: '#b9c2cf' }),
  // ---------------- scenery (unpaintable) ----------------
  ...scenery(-30, -40, 14, 18, 9, '#4a5163'),
  ...scenery(32, -70, 16, 14, 12, '#51596b'),
  ...scenery(-34, -120, 18, 16, 14, '#4a5163'),
  ...scenery(34, -150, 14, 20, 10, '#565e70'),
  ...scenery(-30, -196, 16, 14, 11, '#4a5163'),
  ...scenery(30, -214, 18, 12, 13, '#51596b'),
  ...vatRing(-18, -95, 5, 0.5, -2.8, 2.4, { color: '#8d93a6', paint: false }),
  ...vatRing(20, -112, 4.2, 0.5, -2.8, 3, { color: '#7d8799', paint: false }),
];

// ---- entities ----
const E = [lake(SL, 0, -100)];
const add = (...xs) => E.push(...xs);

// Dock
add(
  ent('pearl-trail', 0, 0, 4, { to: [0, 0, -1], count: 5 }),
  ent('pearl', 6.6, 1.1, 1), ent('pearl', 6.6, 1.1, 2.6),
  ent('pearl-trail', 0, 0, -4.5, { to: [0, 0, -10.5], count: 4 }),
);
// Intake Yard
add(
  ent('trigger', 0, 0, -14, { size: [10, 3, 3], dialogue: 'w3-1.pods', hint: 'Pop the <b>Murk Pod</b> first, it keeps spawning Gloopers!' }),
  ent('murk-pod', 0, 0, -27.5, { group: 'yard', max: 2, interval: 4.5, aggro: 18 }),
  ent('glooper', -6.5, 0, -32, { group: 'yard' }),
  ent('glooper', 6.5, 0, -24, { group: 'yard', patrol: [[6.5, 0, -24], [6.5, 0, -31]] }),
  ent('murk-barrier', 0, 0, -35, { size: [6, 4.3, 0.4], group: 'yard', id: 'bar-yard' }),
  ent('crate', 7.6, 0, -30.8, { pearls: 3 }),
  ent('crate', 7.9, 0, -32.4, { size: 1, pearls: 2 }),
  ent('crate', -8.2, 0, -14.3, { pearls: 2 }),
  ent('pearl-trail', -11, 3.2, -31, { to: [-11, 3.2, -17], count: 6 }),
);
// Landing + Line 1 hall
add(
  ent('checkpoint', 1.4, 0, -40, { yaw: PI, id: 'cp1', radius: 2.4 }),
  ent('trigger', 0, 0, -44.5, { size: [10, 3, 2.5], dialogue: 'w3-1.conveyor', objective: 'Ride Line 1 and shut it down' }),
  ent('conveyor', 0, 0, -57, { dir: '-z', size: [3, 20], speed: 3.2, id: 'b1' }),
  ent('pearl-trail', 0, 0.2, -50, { to: [0, 0.2, -64], count: 6 }),
  ent('glooper', -9, 1, -57, { group: 'hall', aggro: 20 }),
  ent('glooper', 9, 1, -60, { group: 'hall', aggro: 20 }),
  ent('pearl', -10.2, 1, -54.2), ent('pearl', -10.2, 1, -59.8), ent('pearl', 10.2, 1, -63.2),
  ent('crate', 10, 1, -57, { pearls: 2 }),
  ent('conveyor', 0, 0, -80.5, { dir: '+x', size: [6, 18], speed: 3.4, cargo: 4, id: 'b2' }),
  ent('buzzdrone', 0, 0, -81, { alt: 5.5, group: 'hall', patrol: [[-4, 0, -81], [4, 0, -81]] }),
  ent('pearl', 3.6, 0.3, -79.2), ent('pearl', 5.4, 0.3, -80.5), ent('pearl', 7.2, 0.3, -81.8),
  // J2: the Line 1 control post
  ent('trigger', 0, 0, -86, { size: [14, 3, 3], hint: 'Line 1 runs backwards! Climb the control post and shoot the <b>switch</b> to stop it.', hintTime: 6 }),
  ent('switch', -4.5, 3.8, -92.2, { id: 'sw-line1', yaw: 0 }),
  ent('pearl-trail', -5.5, 3.8, -90.6, { to: [-3.5, 3.8, -90.6], count: 3 }),
  ent('conveyor', 0, 0, -107, { dir: '+z', size: [3.5, 25], speed: 5.2, cargo: 3, id: 'b3', stopOn: 'switch:sw-line1' }),
  // Control deck
  ent('trigger', 0, 0, -120.8, { size: [16, 3, 2], objective: 'Clear the control deck crew to open the Steam Works' }),
  ent('shield-glooper', 0, 0, -122.5, { group: 'line1', aggro: 26 }),
  ent('glooper', -4.5, 0, -127, { group: 'line1', aggro: 24 }),
  ent('glooper', 5, 0, -126.5, { group: 'line1', aggro: 24 }),
  ent('checkpoint', -1.5, 0, -121.2, { yaw: PI, id: 'cp2', radius: 2.4 }),
  ent('murk-barrier', 0, 0, -130.6, { size: [6, 4.3, 0.4], group: 'line1', id: 'bar-line1' }),
  ent('pearl', -6.4, 2.2, -128.2), ent('pearl', 6.8, 0, -128.8),
);
// Steam gallery
add(
  ent('trigger', 0, 0, -132.6, { size: [9, 3, 2], dialogue: 'w3-1.vent', objective: 'Dash through the Steam Gallery', hint: 'Wait for the steam to stop, then dash through!' }),
  ent('steam-vent', -3.5, 0, -137, { radius: 1.25, period: 3.2, on: 1.3, warn: 0.7, offset: 0 }),
  ent('steam-vent', 3.5, 0, -143, { radius: 1.25, period: 3.2, on: 1.3, warn: 0.7, offset: 1.05 }),
  ent('steam-vent', 0, 0, -149, { radius: 1.25, period: 3.2, on: 1.3, warn: 0.7, offset: 2.1 }),
  ent('pearl-trail', 3.4, 0, -134, { to: [3.4, 0, -135.4], count: 2 }),
  ent('pearl-trail', -3.8, 0, -139.6, { to: [-3.8, 0, -141.2], count: 2 }),
  ent('glooper', -2.5, 0, -146, { group: 'gal', aggro: 14 }),
  ent('glooper', 3, 0, -152.5, { group: 'gal', aggro: 14 }),
  ent('crate', 3.8, 0, -146.2, { size: 1, pearls: 2 }),
  ent('pearl-trail', 5.8, 5, -134, { to: [5.8, 5, -152], count: 5 }),
  ent('postcard', -5.8, 5, -153.6, { id: 'w3-1-postcard', title: 'Welcome, New Intern!', text: 'Your first assignment: write a catchy jingle about the colour gray. Enthusiasm is mandatory. Snacks are not provided.' }),
);
// Main Line arena
const ring = [
  { pos: [0, 0, -166], dir: '+x', size: [2.5, 8] },
  { pos: [5.5, 0, -172], dir: '-z', size: [2.5, 8] },
  { pos: [0, 0, -178], dir: '-x', size: [2.5, 8] },
  { pos: [-5.5, 0, -172], dir: '+z', size: [2.5, 8] },
];
ring.forEach((b, i) => add(ent('conveyor', ...b.pos, { dir: b.dir, size: b.size, speed: 2.4, cargo: 2, stopOn: 'switch:sw-main', id: 'main' + i })));
add(
  ent('checkpoint', 1.4, 0, -161, { yaw: PI, id: 'cp3', radius: 2.4 }),
  ent('trigger', 0, 0, -161, { size: [8, 3, 3], objective: 'Clear the Main Line crew, then stop the line from the tower' }),
  ent('bomblob', -5, 1.5, -161.5, { group: 'main', aggro: 20 }),
  ent('murk-pod', -11.5, 1.4, -168, { group: 'main', max: 2, interval: 5, aggro: 18 }),
  ent('murk-pod', 10.5, 0, -170, { group: 'main', max: 2, interval: 5, aggro: 18 }),
  ent('rollerbrute', -9, 0, -181, { group: 'main', aggro: 18 }),
  ent('murk-turret', 11, 1.4, -182, { group: 'main', aggro: 20 }),
  ent('glooper', 4, 0, -182, { group: 'main' }),
  ent('glooper', -3, 0, -182.5, { group: 'main' }),
  ent('murk-barrier', 0, 0, -185.5, { size: [6, 4.3, 0.4], group: 'main', id: 'bar-main' }),
  ent('switch', 0, 5.25, -173.2, { id: 'sw-main', yaw: 0, targets: ['g-core'] }),
  ent('pearl-trail', -2, 5.25, -170.2, { to: [2, 5.25, -170.2], count: 4 }),
  ent('pearl', -13, 1.4, -165), ent('pearl', -13, 1.4, -169), ent('pearl', 12.5, 1.4, -179.5), ent('pearl', 9.5, 1.4, -179.5),
  ent('crate', -13, 0, -175, { pearls: 3 }),
  ent('gate', 0, 0, -188.2, { id: 'g-core', size: [5.4, 3.8, 0.5] }),
  ent('trigger', 0, 0, -186.8, { size: [6, 3, 1.5], objective: 'Crack the Prism Capsule!' }),
  ent('prism-core', 0, 0.4, -200.4, { id: 'core' }),
);

// ---- dressing ----
add(
  // dock
  D('neon-sign', 0, 0, -1.7, { text: 'SLUDGE LINES', color: '#8be04a', height: 5.65 }),
  D('lamp', -8.2, 0, 10.2, { yaw: PI * 0.75 }), D('lamp', 8.2, 0, 10.4, { yaw: -PI * 0.75 }),
  D('lamp', -8.4, 0, -2.2, { yaw: PI / 4, light: '#c8ffb0' }), D('lamp', 8.4, 0, -2.2, { yaw: -PI / 4, light: '#c8ffb0' }),
  D('barrel', -4.2, 0, 9.8, { variant: 'toxic' }), D('barrel', -3.4, 0, 10.3, { variant: 'toxic' }), D('barrel', -3.9, 0, 9.0),
  D('crate-stack', 6.2, 1.1, 2.8, { count: 3, yaw: 0.2 }), D('crate-stack', -7.6, 1.0, 1.5, { count: 2, yaw: -0.4 }),
  D('vending', 2.6, 0, 10.4, { yaw: PI, color: '#6a2bd9' }), D('bench', -1.4, 0, 10.5, { yaw: PI, color: '#7d8a96' }),
  D('speaker-tower', 8.1, 0, 6.2, { height: 3.2, color: '#8be04a', yaw: -PI / 2 }),
  D('billboard', -12.5, -2.2, 4, { yaw: PI / 2, text: 'Murk Industries' }),
  D('pipe', -9.3, 0, 4.5, { yaw: PI / 2, length: 10, radius: 0.3, height: 0.5, color: '#3aa0a8' }),
  D('flag', -5, 5.2, -2.4, { color: '#6a2bd9', height: 2.4 }), D('flag', 5, 5.2, -2.4, { color: '#6a2bd9', height: 2.4 }),
  D('cone', -1.6, 0, -2.6), D('cone', 1.6, 0, -2.6),
  D('railing', -1.75, 0, -7.6, { yaw: PI / 2, length: 8.8, color: '#f2b134' }), D('railing', 1.75, 0, -7.6, { yaw: -PI / 2, length: 8.8, color: '#f2b134' }),
  D('buoy', -12, SL, -8, { color: '#8be04a', light: '#ffcc33' }), D('buoy', 13, SL, -12, { color: '#6a2bd9' }),
  D('chimney', -26, SL, 14, { scale: 3 }), D('chimney', 28, SL, 4, { scale: 2.6 }),
  D('crane', 26, SL, -30, { yaw: -PI / 2, color: '#8a6ad8' }),
  // yard
  D('railing', -10.05, 3.2, -24, { yaw: -PI / 2, length: 17.4, color: '#f2b134' }),
  D('lamp', -11.2, 3.2, -16, { yaw: -PI / 2 }), D('lamp', -11.2, 3.2, -31, { yaw: -PI / 2 }),
  D('lamp', 11.2, 0, -28, { yaw: -PI / 2, light: '#c8ffb0' }),
  D('barrel', -1.6, 0, -24.6, { variant: 'toxic' }), D('barrel', 1.9, 0, -25.2, { variant: 'toxic' }), D('barrel', 1.2, 0, -30.4, { variant: 'toxic' }),
  D('barrel', 10.8, 0, -26.6),
  D('crate-stack', -8.6, 0, -33, { count: 3, yaw: 0.3 }),
  D('pipe', -7.5, 0, -33.85, { length: 8, radius: 0.35, height: 3.4, color: '#c77d3a' }),
  D('pipe', 7.5, 0, -33.85, { length: 8, radius: 0.35, height: 2.6, color: '#3aa0a8' }),
  D('neon-sign', 0, 0, -33.95, { text: 'INTAKE', color: '#b58cff', height: 4.95 }),
  D('graffiti', -7.5, 0, -33.97, { text: 'MURK OUT', size: 4.2, color: '#ff8a1f', color2: '#2fd6ff' }),
  D('graffiti', 7.8, 0, -33.97, { style: 'squid', size: 3, height: 1.6, color: '#2fd6ff', color2: '#ffd23f' }),
  D('billboard', 0, 6.05, -36.2, { text: 'Grayer is Better' }),
  D('antenna', -10, 6.05, -35.5, { height: 3, variant: 'radar' }), D('satellite', 10.5, 6.05, -35.6, { yaw: PI * 0.8 }),
  D('cone', -3.4, 0, -14.8), D('cone', 3.6, 0, -13.6),
  // landing + hall
  D('lamp', -4.4, 0, -37.2, { yaw: PI / 4 }), D('lamp', 4.4, 0, -46.2, { yaw: -PI * 0.75 }),
  D('neon-sign', -4.2, 0, -46.7, { text: 'LINE 1', color: '#ffc53a', height: 2.2, pole: true, yaw: PI / 2 }),
  D('barrel', -10.4, 1, -60.4, { variant: 'toxic' }), D('barrel', -9.6, 1, -60.8), D('crate-stack', -9.5, 1, -54.2, { count: 2 }),
  D('lamp', -11.2, 1, -53.4, { yaw: -PI / 2 }), D('lamp', 11.2, 1, -63.6, { yaw: PI / 2 }),
  D('barrel', 10.5, 1, -56.5, { variant: 'toxic' }), D('crate-stack', 9.2, 1, -63, { count: 3, yaw: 1.2 }),
  D('speaker-tower', -4.2, 0, -68.2, { height: 2.8, color: '#b58cff' }),
  D('cone', 4.2, 0, -76.6), D('lamp', 4.4, 0, -67.8, { yaw: -PI / 2, light: '#c8ffb0' }),
  D('neon-sign', -2.95, 0, -91.5, { yaw: PI / 2, text: 'LINE 1 CTRL', color: '#ffc53a', height: 4.6, scale: 0.55 }),
  D('railing', -4.5, 3.8, -92.9, { length: 3, color: '#f2b134' }),
  D('lamp', 6.4, 0, -84.4, { yaw: -PI * 0.75 }), D('barrel', 6.2, 0, -93.6), D('barrel', 5.4, 0, -93.8, { variant: 'toxic' }),
  D('buoy', -8, SL, -66, { color: '#8be04a' }), D('buoy', 8.5, SL, -95, { color: '#6a2bd9', light: '#ff3030' }), D('buoy', -7, SL, -112),
  D('vat', 16, SL, -52, { radius: 2.4, height: 5, glow: '#8be04a', scale: 1.3 }), D('vat', -17, SL, -76, { radius: 2.2, height: 6, glow: '#b58cff', scale: 1.3 }),
  D('chimney', 30, SL, -96, { scale: 3.2 }), D('chimney', -30, SL, -64, { scale: 2.8 }),
  D('pipe', 4.1, SL, -107, { yaw: PI / 2, length: 24, radius: 0.35, height: 2.4, color: '#c77d3a' }),
  D('pipe', -4.1, SL, -107, { yaw: PI / 2, length: 24, radius: 0.28, height: 2.0, color: '#3aa0a8' }),
  // control deck
  D('neon-sign', 0, 0, -129.95, { text: 'STEAM WORKS', color: '#ff7a3a', height: 5.3 }),
  D('lamp', -7.6, 0, -120.2, { yaw: PI * 0.75 }), D('lamp', 7.6, 0, -129.8, { yaw: -PI / 4 }),
  D('crate-stack', 6.2, 0, -128.6, { count: 2, yaw: -0.2 }), D('barrel', -7.4, 0, -124.6),
  D('flag', -7.5, 0, -130, { color: '#6a2bd9' }), D('flag', 7.5, 0, -130, { color: '#6a2bd9' }),
  D('vending', -3.2, 0, -129.5, { color: '#8be04a' }),
  // gallery
  D('pipe', -6.3, 5, -143, { yaw: PI / 2, length: 22, radius: 0.35, height: 0.4, color: '#c77d3a' }),
  D('pipe', 6.3, 5, -143, { yaw: PI / 2, length: 22, radius: 0.3, height: 0.35, color: '#3aa0a8' }),
  D('graffiti', -4.98, 0, -140, { yaw: PI / 2, text: 'HOT!', size: 2.4, color: '#ff5a3a', color2: '#ffd23f' }),
  D('graffiti', 4.98, 0, -146.5, { yaw: -PI / 2, style: 'arrow', size: 2.4, color: '#8be04a', color2: '#2fd6ff' }),
  D('barrel', -4.4, 0, -145.6, { variant: 'toxic' }), D('barrel', 4.4, 0, -139.4, { variant: 'toxic' }), D('barrel', -4.3, 0, -151.3),
  D('lamp', 4.4, 0, -154.6, { yaw: -PI * 0.75, light: '#ffb070' }), D('lamp', -4.4, 0, -134, { yaw: PI / 4, light: '#ffb070' }),
  D('speaker-tower', -4.2, 0, -154.6, { height: 2.4, color: '#ff7a3a' }),
  // main line
  D('neon-sign', -3.05, 0, -172, { yaw: -PI / 2, text: 'MAIN LINE', color: '#8be04a', height: 3.4 }),
  D('antenna', -2, 5.25, -174.2, { height: 2.6 }), D('satellite', 2.2, 5.25, -174.6, { yaw: PI }),
  D('lamp', -14.2, 0, -160.2, { yaw: PI * 0.75 }), D('lamp', 14.2, 0, -160.2, { yaw: -PI * 0.75 }),
  D('lamp', -14.2, 0, -184.2, { yaw: PI / 4 }), D('lamp', 14.2, 0, -168, { yaw: -PI / 2 }),
  D('barrel', 13.6, 0, -162.4, { variant: 'toxic' }), D('barrel', 12.8, 0, -162.2), D('barrel', -13.8, 0, -178.4, { variant: 'toxic' }),
  D('crate-stack', 12.4, 1.4, -183.2, { count: 2 }), D('crate-stack', -12.6, 0, -181.8, { count: 3, yaw: 0.5 }),
  D('billboard', 17.5, -2.2, -172, { yaw: -PI / 2, text: 'ColorPlus' }),
  D('graffiti', -9, 0, -184.88, { text: 'SPLAT MURK', size: 4.6, color: '#ff3fa4', color2: '#ffd23f' }),
  D('neon-sign', 9, 0, -184.88, { text: 'PRISM STORAGE', color: '#2fd6ff', height: 5.6 }),
  D('flag', -3.7, 0, -184.4, { color: '#6a2bd9', height: 5.6 }), D('flag', 3.7, 0, -184.4, { color: '#6a2bd9', height: 5.6 }),
  D('speaker-tower', -13.8, 1.4, -165, { height: 2.2, color: '#8be04a', yaw: PI / 2 }),
  // capsule platform
  D('lamp', -8.2, 0, -193.4, { yaw: PI * 0.75 }), D('lamp', 8.2, 0, -193.4, { yaw: -PI * 0.75 }),
  D('flag', -4, 0, -196, { color: '#8be04a' }), D('flag', 4, 0, -196, { color: '#8be04a' }),
  D('vat', -7.4, 0, -197.4, { radius: 1.2, height: 2.6, glow: '#8be04a' }), D('vat', 7.4, 0, -197.4, { radius: 1.2, height: 2.6, glow: '#2fd6ff' }),
  D('barrel', 3.4, 0, -204.5, { variant: 'toxic' }), D('barrel', -3.4, 0, -204.5, { variant: 'toxic' }),
  D('chimney', -24, SL, -226, { scale: 3.4 }), D('chimney', 18, SL, -232, { scale: 3 }), D('chimney', 40, SL, -190, { scale: 2.6 }),
  D('buoy', -14, SL, -150, { color: '#6a2bd9', light: '#ffcc33' }),
);

export default {
  id: 'w3-1',
  name: 'Sludge Lines',
  world: 3,
  theme: 'refinery',
  music: 'refinery',
  themeOverride: { hemiIntensity: 0.98, sunIntensity: 1.32, exposure: 1.12 },
  waterY: SL,
  water: false,
  killY: -3.4,
  spawn: { pos: [0, 0, 7], yaw: PI },
  objective: 'Shut down the sludge lines and reach the Prism Capsule',
  brushes,
  preInk: [
    murk(0, 0, -27, 3.2), murk(-6, 0, -22, 2), murk(6, 0, -31, 2.2), murk(-2.5, 0, -32.5, 1.8), murk(3, 0, -18, 1.6),
    murk(-9, 1, -57, 1.8), murk(9, 1, -60, 1.8),
    murk(0, 0, -72, 2.2), murk(-3, 0, -89, 1.8), murk(3, 0, -91, 1.6),
    murk(0, 0, -125, 2.4), murk(-5, 0, -127, 1.6),
    murk(0, 0, -140, 1.8), murk(-2, 0, -146, 2), murk(1.5, 0, -153, 1.8),
    murk(-11.5, 1.4, -168, 2.2), murk(10.5, 0, -170, 2.4), murk(0, 0, -182, 2.4), murk(-9, 0, -174, 2), murk(9, 0, -176, 2),
    murk(0, 0.4, -200, 2),
  ],
  entities: E,
  route: [
    [0, 0, 7], [0, 0, -2], [0, 0, -10], [0, 0, -15], [0, 0, -33], [0, 0, -38], [0, 0, -46],
    [0, 0, -66], [0, 0, -76], [0, 0, -85], [-4.5, 0, -88.5], [-4.5, 3.6, -91.5, 'climb'], [-1, 0, -94],
    [0, 0, -118], [0, 0, -124], [0, 0, -131.5], [-3.5, 0, -135], [-3.5, 0, -139], [3.5, 0, -141], [3.5, 0, -145],
    [0, 0, -147], [0, 0, -154], [0, 0, -158], [0, 0, -164], [0, 0, -167.5], [0, 5, -171, 'climb'], [4.5, 0, -176],
    [4, 0, -183], [0, 0, -184], [0, 0, -190], [0, 0, -196], [0, 0.4, -199.2],
  ],
};
