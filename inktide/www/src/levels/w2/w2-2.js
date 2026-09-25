// 2-2 Skatepark Sprawl — the Coral Heights Skatepark on top of the Coral Mall parking deck, locked
// down by Murk balloon gates. Beats (DIALOGUE ids, in order):
//
//   S1  Entry plaza          pop 4 balloons → gate 1 ................................. 'w2-2.balloons'
//   S2  Street course        checkpoint 1; bounce pads (skate-shop roof, judges' tower) .. 'w2-2.spring'
//                            Bomblob on the judges' tower + Gloopers; balloons → gate 2 .. 'w2-2.bomblob'
//   S3  The Halfpipe         checkpoint 2; drop in, Rollerbrute in the flat, Bomblobs on
//                            the far deck; balloons over the pipe → gate 3 ............. 'w2-2.halfpipe'
//   S4  The Big Bowl         checkpoint 3; final squad → Murk barrier → bounce pad up to
//                            the neon stage → Prism Capsule
//
// Hidden: "Pix's corner" — a crate-sealed alcove at the west end of the halfpipe's flat (postcard).
// The park sits on a roof over the street canyon (street y -30, killY -12).
import { block, box, ramp, rampC, cyl, stairs, ent, murk } from '../kit.js';
import { PI, D, SCENERY, building, parapet, waterTower, street, planter, skyline } from './heights-kit.js';

const T = (x, y, z, o) => ent('trigger', x, y, z, o);
const GLASS = { mat: 'glass', color: '#d9f0ff' };
const conc = (color = '#efe7f2', o = {}) => ({ mat: 'concrete', color, ...o });
const PIPE = -3.5;           // halfpipe flat
const DECK = 0.5;            // halfpipe far deck + Big Bowl rim
const BOWL = -2;             // bowl floor
const STAGE = 6;             // capsule stage top

/** Funbox along x: kicker up, flat top, kicker down. */
function funbox(cx, cz, w, h = 1, top = 3, run = 2.2, color = '#ffe08a') {
  const o = conc(color);
  return [
    ramp(cx - top / 2 - run, 0, cz - w / 2, cx - top / 2, h, cz + w / 2, '+x', o),
    block(cx, cz, top, w, 0, h, o),
    ramp(cx + top / 2, 0, cz - w / 2, cx + top / 2 + run, h, cz + w / 2, '-x', o),
  ];
}

/** Grind rail on two posts (low: hop it; paintable yellow bar). */
function grindRail(x0, z0, x1, z1, y = 0, h = 0.55) {
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const o = { mat: 'metal', color: '#ffd23f' };
  return [
    along ? box(Math.min(x0, x1), y + h - 0.08, z0 - 0.07, Math.max(x0, x1), y + h + 0.06, z0 + 0.07, o)
      : box(x0 - 0.07, y + h - 0.08, Math.min(z0, z1), x0 + 0.07, y + h + 0.06, Math.max(z0, z1), o),
    block(x0, z0, 0.14, 0.14, y, h - 0.08, { mat: 'metal', color: '#2b2f3e', paint: false }),
    block(x1, z1, 0.14, 0.14, y, h - 0.08, { mat: 'metal', color: '#2b2f3e', paint: false }),
  ];
}

/** Acrylic rink fence: glass panels on a paintable curb, split around gaps along x at z. */
function rinkFence(x0, x1, z, y, gaps = [], h = 3.6) {
  const out = [];
  let cur = x0;
  for (const [a, b] of gaps) { if (a > cur) out.push(box(cur, y, z - 0.2, a, y + 0.45, z + 0.2, conc('#ff9fc8')), box(cur, y + 0.45, z - 0.06, a, y + h, z + 0.06, GLASS)); cur = b; }
  if (cur < x1) out.push(box(cur, y, z - 0.2, x1, y + 0.45, z + 0.2, conc('#ff9fc8')), box(cur, y + 0.45, z - 0.06, x1, y + h, z + 0.06, GLASS));
  return out;
}

const brushes = [
  // ---------------- S1: entry plaza ----------------
  ...building(-14, 16, 14, -18, 0, { color: '#f3c9e4', roofMat: 'tiles', roofColor: '#f2e6f0' }),
  ...parapet(-14, 16, 14, -18, 0, ['+z', '-x', '+x'], { color: '#ffd6e8' }),
  ...rinkFence(-14, 14, -18, 0, [[-3.5, 3.5]]),
  block(-10, -6, 4, 2, 0, 0.5, conc('#8fe6d8')),                                   // manual pad
  ramp(6, 0, -3, 10, 1.0, 0, '+z', conc('#ffd6a0')),                               // kicker
  ...planter(-11.5, 8, 2, 6, 0), ...planter(11.5, 8, 2, 6, 0),
  block(-9, 12.6, 5, 2.4, 0, 2.6, { mat: 'wood', color: '#ff8fb2' }),               // ticket kiosk
  block(-9, 12.6, 5.6, 3, 2.6, 0.2, { mat: 'metal', color: '#2b2f3e' }),
  // entry arch (scenery) over gate 1
  block(-5.2, -18, 0.6, 0.6, 0, 7, SCENERY({ mat: 'metal', color: '#ff5fa8' })), block(5.2, -18, 0.6, 0.6, 0, 7, SCENERY({ mat: 'metal', color: '#ff5fa8' })),
  box(-5.6, 7, -18.4, 5.6, 7.6, -17.6, SCENERY({ mat: 'metal', color: '#ff5fa8' })),

  // ---------------- S2: street course ----------------
  ...building(-18, -18, 18, -62, 0, { color: '#c9b8f0', roofMat: 'concrete', roofColor: '#ece4f0' }),
  ...parapet(-18, -18, 18, -62, 0, ['-x', '+x'], { color: '#ffd6e8' }),
  block(15, -24, 6, 8, 0, 4.2, { mat: 'plaster', color: '#8fe6d8' }),               // skate shop (spring up)
  block(15, -24, 6.4, 8.4, 4.2, 0.25, { mat: 'metal', color: '#2b2f3e' }),
  box(11.95, 0.3, -27.5, 12.05, 3, -20.5, { mat: 'glass', color: '#ffd9a8' }),       // shop window (front)
  block(0, -46, 6, 6, 0, 5, { mat: 'metal', color: '#ff8fb2' }),                    // judges' tower
  block(0, -46, 6.6, 6.6, 5, 0.2, { mat: 'metal', color: '#2b2f3e' }),
  ...funbox(-9, -30, 3.2, 1, 3, 2.2, '#ffe08a'),
  block(10, -36, 4, 2, 0, 0.5, conc('#8fe6d8')),
  ...grindRail(-15, -38, -5, -38), ...grindRail(6, -54, 14, -54),
  // side stage with stairs + handrail (west)
  block(-14, -54, 8, 8, 0, 1.5, conc('#ffd6a0')),
  stairs(-10, 0, -57, -7.5, 1.5, -51, '-x', conc('#f2e6f0')),
  ...grindRail(-8.8, -51.2, -8.8, -56.8, 0.75, 0.9),
  rampC(15.5, -49, 5, 8, 0, 1.6, '+x', conc('#b8dcff')),                             // quarter pipe (east wall)
  ...rinkFence(-18, 18, -62, 0, [[-3.5, 3.5]]),

  // ---------------- S3: the halfpipe ----------------
  block(0, -65, 40, 6, -30, 29.2, { mat: 'plaster', color: '#9ec5f0', paint: false }), // body under the near deck
  box(-20, -0.8, -68, 20, 0, -62, conc('#ece4f0')),                                   // near deck (y 0)
  ramp(-20, PIPE, -72, 20, 0, -68, '+z', conc('#b8dcff')),                             // drop-in wall
  box(-20, PIPE - 0.8, -86, 20, PIPE, -72, { mat: 'wood', color: '#e0b88a' }),        // the flat (plywood)
  ramp(-20, PIPE, -89, 20, DECK - 1.5, -86, '-z', conc('#b8dcff')),                    // transition...
  box(-20, PIPE, -89.6, 20, DECK, -89, conc('#ffd6e8')),                               // ...and the vert wall (climb / squid leap)
  box(-20, DECK - 0.1, -89.9, 20, DECK + 0.12, -89.3, { mat: 'metal', color: '#ffd23f' }), // coping
  box(-20, PIPE - 0.8, -100, 20, DECK, -89.6, conc('#ece4f0')),                       // far deck
  box(-20, -30, -100, 20, PIPE - 0.8, -62, { mat: 'plaster', color: '#9ec5f0', paint: false }), // body under the pipe
  box(-20.4, PIPE, -89.6, -20, 1.2, -82, GLASS), box(-20.4, PIPE, -76, -20, 1.2, -68, GLASS), box(20, PIPE, -89.6, 20.4, 1.2, -68, GLASS),  // side glass
  box(-20, 0, -68, -19.65, 0.7, -62, conc('#ffd6e8')), box(19.65, 0, -68, 20, 0.7, -62, conc('#ffd6e8')),
  box(-20, DECK, -100, -19.65, DECK + 0.7, -89.6, conc('#ffd6e8')), box(19.65, DECK, -100, 20, DECK + 0.7, -89.6, conc('#ffd6e8')),
  ...rinkFence(-20, 20, -100, DECK, [[-3.5, 3.5]]),
  ...waterTower(-16, -95.5, DECK, { color: '#d98a8a' }),
  // Pix's corner: crate-sealed alcove west of the flat
  box(-26, PIPE - 0.8, -82, -20, PIPE, -76, { mat: 'wood', color: '#c9955e' }),
  box(-26, PIPE, -82.3, -20, 0, -82, conc('#ffd6e8')), box(-26, PIPE, -76, -20, 0, -75.7, conc('#ffd6e8')),
  box(-26.3, PIPE, -82.3, -26, 0, -75.7, conc('#ffd6e8')), box(-26.3, 0, -82.3, -20, 0.3, -75.7, conc('#ece4f0')),

  // ---------------- S4: the Big Bowl ----------------
  box(-22, -30, -150, 22, BOWL - 0.8, -100, { mat: 'plaster', color: '#f7d08a', paint: false }),
  box(-22, BOWL - 0.8, -110, 22, DECK, -100, conc('#e8f0f4')),                          // rim around the bowl
  box(-22, BOWL - 0.8, -150, 22, DECK, -130, conc('#e8f0f4')),
  box(-22, BOWL - 0.8, -130, -10, DECK, -110, conc('#e8f0f4')),
  box(10, BOWL - 0.8, -130, 22, DECK, -110, conc('#e8f0f4')),
  box(-7.5, BOWL - 0.8, -127.5, 7.5, BOWL, -112.5, { mat: 'tiles', color: '#9fd0ff' }),  // bowl floor
  ramp(-10, BOWL, -112.5, 10, DECK, -110, '+z', conc('#b8dcff')),
  ramp(-10, BOWL, -130, 10, DECK, -127.5, '-z', conc('#b8dcff')),
  ramp(-10, BOWL, -127.5, -7.5, DECK, -112.5, '-x', conc('#c8b8ff')),
  ramp(7.5, BOWL, -127.5, 10, DECK, -112.5, '+x', conc('#c8b8ff')),
  block(0, -120, 3, 1.6, BOWL, 0.45, conc('#ffe08a')),                                   // bowl hump
  ...parapet(-22, -100, 22, -150, DECK, ['-x', '+x', '-z'], { color: '#ffd6e8' }),
  block(-17, -118, 6, 10, DECK, 2.2, { mat: 'wood', color: '#b8845a' }),                // side ledges (Bomblob perches)
  block(17, -122, 6, 10, DECK, 2.2, { mat: 'wood', color: '#b8845a' }),
  // spring pen + neon stage
  box(-3.3, DECK, -142, -3, DECK + 3.6, -134, GLASS), box(3, DECK, -142, 3.3, DECK + 3.6, -134, GLASS),
  block(0, -145.5, 12, 7, DECK, STAGE - DECK, { mat: 'grate', color: '#ffffff' }),
  block(0, -145.5, 12.4, 7.4, STAGE, 0.18, { mat: 'tiles', color: '#f4ecf8' }),
  box(-6.2, DECK + 0.4, -142.05, 6.2, DECK + 0.6, -141.95, SCENERY({ mat: 'metal', color: '#ff5fa8' })),
  box(-6.2, STAGE - 0.3, -142.05, 6.2, STAGE - 0.1, -141.95, SCENERY({ mat: 'metal', color: '#2fd6ff' })),

  // ---------------- the city ----------------
  box(-80, -31.5, -220, 80, -30.5, 40, SCENERY({ mat: 'asphalt', color: '#3f3a4c' })),
  ...street(-34, 40, -26, -220, { along: 'z' }), ...street(26, 40, 34, -220, { along: 'z' }),
  ...skyline([
    [-44, 0, 18, 22, 16], [46, -6, 18, 20, 12], [-46, -52, 18, 24, 22], [48, -58, 16, 22, 8], [-44, -104, 18, 22, 10],
    [46, -112, 18, 20, 18], [-44, -150, 18, 22, 26], [46, -160, 20, 22, 14], [0, -178, 30, 16, 20], [-26, -196, 16, 16, 30],
    [28, -198, 18, 16, 24], [0, 36, 30, 12, 8],
  ]),
];

const entities = [
  // ---------------- S1 ----------------
  T(0, 0, 4, { size: [28, 3, 5], dialogue: 'w2-2.balloons', objective: 'Pop all the balloons to open the gate' }),
  ent('balloon', -10, 2.4, 1.5, { group: 'b1', pearls: 1 }),
  ent('balloon', 10, 2.8, -8, { group: 'b1', pearls: 1, move: [0, 0, 2.5], period: 4 }),
  ent('balloon', 0, 2.9, -12.5, { group: 'b1', pearls: 1, move: [0, 0.8, 0], period: 3 }),
  ent('balloon', -3.6, 2.7, 13.4, { group: 'b1', pearls: 2 }),                            // behind you: look around! (in the open)
  ent('gate', 0, 0, -18, { id: 'gate-1', size: [6.4, 3.6, 0.6], openOn: 'event:balloons:b1', color: '#d9c8ff' }),
  ent('pearl-trail', 6.5, 1.0, -0.5, { to: [9.5, 1.0, -0.5], count: 3 }),
  D('neon-sign', 0, 7.6, -17.9, { text: 'CORAL SKATEPARK', color: '#ff5fa8', height: 0.2 }),
  D('palm', -12.6, 0, -15), D('palm', 12.6, 0, -15), D('palm', 12.6, 0, 14.5),
  D('bush', -11.5, 0.6, 8, { flowerColor: '#ff7ab8' }), D('bush', 11.5, 0.6, 6.5, { flowerColor: '#ffd23f' }), D('bush', 11.5, 0.6, 9.8),
  D('bench', -12.8, 0, -3, { yaw: PI / 2 }), D('bench', 12.8, 0, -10, { yaw: -PI / 2 }),
  D('vending', 12.9, 0, 1.5, { yaw: -PI / 2, color: '#ff5fa8', collide: true }), D('vending', 12.9, 0, 3, { yaw: -PI / 2, color: '#2fd6ff', collide: true }),
  D('awning', -9, 0, 11.3, { yaw: PI, length: 5, color: '#ff5fa8', height: 2.5 }),
  D('neon-sign', -9, 2.8, 11.25, { yaw: PI, text: 'TICKETS', color: '#ffd23f', height: 0.5 }),
  D('railing', -3, 0, 14.5, { length: 5, color: '#2fd6ff' }), D('lamp', -4, 0, -16.6, { yaw: PI }), D('lamp', 4, 0, -16.6, { yaw: PI }),
  D('graffiti', -13.6, 0.4, -9, { yaw: PI / 2, text: 'SKATE OR DYE', size: 4, color: '#ff5fa8', color2: '#2fd6ff' }),
  D('flowerpot', 2, 0, 15.2), D('flowerpot', 3.2, 0, 15.2, { color: '#b98cff' }),
  D('billboard', -18, 0, 2, { yaw: PI / 2, text: 'Tidepool Racing' }),

  // ---------------- S2 ----------------
  ent('checkpoint', 1.2, 0, -23.4, { id: 'cp1', yaw: PI, radius: 4.5 }),           // through gate 1 (circle must not reach back past the gate)
  T(0, 0, -20.8, { size: [36, 3, 3], dialogue: 'w2-2.spring', objective: 'Pop the course balloons' }),
  ent('spring', 9.6, 0, -22.2, { id: 'spring-shop', yaw: PI / 2, push: 4, power: 15.5 }),
  ent('pearl-trail', 13.5, 4.45, -21, { to: [13.5, 4.45, -27], count: 4 }),
  T(0, 0, -29.5, { size: [36, 3, 3], dialogue: 'w2-2.bomblob' }),
  ent('bomblob', 0, 5.2, -46.5, { group: 'course', yaw: 0 }),
  ent('glooper', -10, 0, -48, { group: 'course', yaw: 0.3 }),
  ent('glooper', 11, 0, -52, { group: 'course', yaw: -0.2, patrol: [[11, 0, -52], [11, 0, -40], [4, 0, -38]] }),
  ent('glooper', -14, 1.5, -55, { group: 'course', yaw: 0.6 }),
  ent('spring', -4.8, 0, -46, { id: 'spring-tw', yaw: PI / 2, push: 3, power: 18 }),
  ent('spring', 4.8, 0, -46, { id: 'spring-te', yaw: -PI / 2, push: 3, power: 18 }),
  ent('balloon', -12, 2.6, -40, { group: 'b2', pearls: 1 }),
  ent('balloon', 12, 2.8, -31, { group: 'b2', pearls: 1, move: [0, 0, -3], period: 4 }),
  ent('balloon', 0, 7.8, -46, { group: 'b2', pearls: 2, move: [0, 0.6, 0], period: 2.5 }),
  ent('balloon', 6, 2.3, -58.5, { group: 'b2', pearls: 1 }),
  ent('gate', 0, 0, -62, { id: 'gate-2', size: [6.4, 3.6, 0.6], openOn: 'event:balloons:b2', color: '#d9c8ff' }),
  ent('pearl-trail', -12, 1, -30, { to: [-6, 1, -30], count: 4 }),
  ent('pearl-trail', -1.8, 5.2, -44.2, { to: [1.8, 5.2, -44.2], count: 2 }),
  D('neon-sign', 15, 4.45, -19.8, { yaw: 0, text: 'SKATE SHOP', color: '#2fd6ff', height: 0.6 }),
  D('neon-sign', 3.02, 2.6, -46, { yaw: PI / 2, text: 'JUDGES', color: '#ffd23f', height: 0 }),
  D('speaker-tower', -2.4, 5.2, -48.4, { height: 1.4, color: '#ff5fa8' }), D('flag', 2.6, 5.2, -48.6, { color: '#8a5bff', height: 3 }),
  D('cone', -3, 0, -34), D('cone', -1, 0, -35), D('cone', 1, 0, -34), D('cone', 3, 0, -35),
  D('tire-stack', 16.8, 0, -35, { count: 5 }), D('tire-stack', -16.8, 0, -44, { count: 4, color: '#ff5fa8' }),
  D('lamp', -17.4, 0, -26, { yaw: PI / 2 }), D('lamp', 17.4, 0, -58, { yaw: -PI / 2 }), D('lamp', -17.4, 0, -46, { yaw: PI / 2 }),
  D('bench', -16.6, 1.5, -58.6, { yaw: 0 }), D('flowerpot', -11, 1.5, -50.8),
  D('graffiti', -3.02, 0.4, -46, { yaw: -PI / 2, style: 'squid', size: 2.6, color: '#ff5fa8', color2: '#ffd23f' }),
  D('graffiti', 17.6, 0.4, -40, { yaw: -PI / 2, text: 'KICKFLIP', size: 4.4, color: '#2fd6ff', color2: '#ffffff' }),

  // ---------------- S3 ----------------
  ent('checkpoint', 1.2, 0, -67, { id: 'cp2', yaw: PI, radius: 4.5 }),             // through gate 2, at the drop-in
  T(0, 0, -64, { size: [40, 3, 3], dialogue: 'w2-2.halfpipe', objective: 'Pop the balloons over the halfpipe' }),
  ent('rollerbrute', 0, PIPE, -79, { group: 'pipe', yaw: 0, aggro: 22 }),
  ent('bomblob', -8, DECK, -95, { group: 'pipe', yaw: 0 }),
  ent('bomblob', 9, DECK, -96, { group: 'pipe', yaw: 0 }),
  ent('glooper', 0, DECK, -93.5, { group: 'pipe', yaw: 0 }),
  ent('balloon', -12, -0.8, -76, { group: 'b3', pearls: 1 }),
  ent('balloon', 12, -0.8, -82, { group: 'b3', pearls: 1, move: [0, 0, 3.5], period: 4 }),
  ent('balloon', 0, -0.6, -79, { group: 'b3', pearls: 2, move: [4, 0, 0], period: 5 }),
  ent('balloon', -5, 3.3, -97, { group: 'b3', pearls: 1 }),
  ent('gate', 0, DECK, -100, { id: 'gate-3', size: [6.4, 3.6, 0.6], openOn: 'event:balloons:b3', color: '#d9c8ff' }),
  ent('pearl-trail', -16, PIPE, -79, { to: [16, PIPE, -79], count: 7 }),
  // Pix's corner
  ent('crate', -20.6, PIPE, -77, { size: [1, 1.8, 2], hits: 2, pearls: 1 }),
  ent('crate', -20.6, PIPE, -79, { size: [1, 1.8, 2], hits: 2, pearls: 1 }),
  ent('crate', -20.6, PIPE, -81, { size: [1, 1.8, 2], hits: 2, pearls: 1 }),
  ent('postcard', -24.2, PIPE, -79, { id: 'w2-2-postcard', title: 'Skatepark Opening Day', from: 'P.', text: 'Landed my first kickflip today!! Also my first faceplant. Totally worth it. Someday I\'ll have my own radio show and I\'ll talk about it forever.' }),
  ent('pearl', -22.4, PIPE, -77.2), ent('pearl', -22.4, PIPE, -80.8),
  D('neon-sign', 0, 1.5, -61.8, { yaw: 0, text: 'THE HALFPIPE', color: '#ffd23f', height: 0.6 }),
  D('graffiti', -25.9, PIPE + 0.3, -79, { yaw: PI / 2, text: 'P WAS HERE', size: 3, color: '#ff5fd2', color2: '#ffffff' }),
  D('speaker-tower', -18.6, 0, -63.4, { height: 2.6, color: '#ff5fa8' }), D('speaker-tower', 18.6, 0, -63.4, { height: 2.6, color: '#2fd6ff' }),
  D('flag', -19, DECK, -90.8, { color: '#ff5fa8', height: 4 }), D('flag', 19, DECK, -90.8, { color: '#2fd6ff', height: 4 }),
  D('bench', 12, DECK, -99, { yaw: 0 }), D('vending', 17.5, DECK, -98.6, { color: '#ffd23f', collide: true }),
  D('lamp', -8, DECK, -99.2, { yaw: PI }), D('lamp', 8, DECK, -99.2, { yaw: PI }),
  D('billboard', 26, -1, -80, { yaw: -PI / 2, text: 'Squidberry Soda' }),

  // ---------------- S4 ----------------
  ent('checkpoint', 1.2, DECK, -105.2, { id: 'cp3', yaw: PI, radius: 4.5 }),        // through gate 3, on the bowl rim
  T(0, DECK, -103.5, { size: [16, 3, 3], objective: 'Clear the Big Bowl', hint: 'Bomblobs telegraph with a red ring: sidestep, then splat back!' }),
  ent('shield-glooper', 0, BOWL, -122.4, { group: 'final', yaw: 0 }),
  ent('bomblob', -17, DECK + 2.2, -119, { group: 'final', yaw: 0.3 }),
  ent('bomblob', 17, DECK + 2.2, -121, { group: 'final', yaw: -0.3 }),
  ent('glooper', -15, DECK, -108, { group: 'final', yaw: 0.2 }),
  ent('glooper', 14, DECK, -135, { group: 'final', yaw: 0 }),
  ent('rollerbrute', -8, DECK, -137, { group: 'final', yaw: 0.4, aggro: 20 }),
  ent('murk-barrier', 0, DECK, -134, { id: 'bar-final', size: [6, 3.8, 0.4], group: 'final' }),
  ent('spring', 0, DECK, -138.8, { id: 'spring-stage', yaw: PI, push: 4, power: 18 }),
  ent('prism-core', 0, STAGE + 0.18, -146, { id: 'core' }),
  ent('pearl-trail', -20, DECK, -104, { to: [-20, DECK, -128], count: 5 }),
  ent('pearl-trail', -4, BOWL, -115, { to: [4, BOWL, -125], count: 4 }),
  ent('pearl-trail', 17, DECK + 2.2, -118, { to: [17, DECK + 2.2, -126], count: 3 }),
  D('neon-sign', 0, STAGE + 0.18, -148.9, { text: 'BIG BOWL', color: '#ff5fa8', height: 2.6 }),
  D('speaker-tower', -5.2, STAGE + 0.18, -148, { height: 2, color: '#ff5fa8' }), D('speaker-tower', 5.2, STAGE + 0.18, -148, { height: 2, color: '#2fd6ff' }),
  D('flag', -21, DECK, -148.8, { color: '#ff5fa8', height: 5 }), D('flag', 21, DECK, -148.8, { color: '#2fd6ff', height: 5 }),
  D('lamp', -21.3, DECK, -140, { yaw: PI / 2 }), D('lamp', 21.3, DECK, -112, { yaw: -PI / 2 }),
  D('palm', -20.5, DECK, -146.5), D('palm', 20.5, DECK, -146.5), D('bush', -12, DECK, -147.8, { flowerColor: '#ff5fa8' }), D('bush', 12, DECK, -147.8, { flowerColor: '#2fd6ff' }),
  D('graffiti', -10, DECK + 0.3, -149.6, { text: 'COLOUR ON', size: 5, color: '#ffd23f', color2: '#ff5fa8' }),
  D('cone', -5, DECK, -132.5), D('cone', 5, DECK, -132.5), D('tire-stack', 20.4, DECK, -132, { count: 4 }),
  D('antenna', 21, DECK, -102, { variant: 'radar', height: 3 }), D('satellite', -21, DECK, -102, { yaw: PI / 2 }),
];

export default {
  id: 'w2-2',
  name: 'Skatepark Sprawl',
  world: 2,
  theme: 'heights',
  music: 'heights',
  themeOverride: { hemiIntensity: 1.02, sunIntensity: 1.7, exposure: 1.08 },
  water: false,
  waterY: -40,
  killY: -12,
  spawn: { pos: [0, 0, 11], yaw: PI },
  objective: 'Pop the balloons, open the gates, crack the Prism Capsule',
  brushes,
  preInk: [
    murk(-6, 0, -30, 2), murk(0, 0, -38, 2.4), murk(9, 0, -48, 2.2), murk(-10, 0, -50, 2), murk(0, 5, -46, 1.6),
    murk(0, PIPE, -76, 2.6), murk(-10, PIPE, -80, 2.4), murk(10, PIPE, -82, 2.4), murk(0, DECK, -95, 2.2),
    { at: [0, DECK - 1.6, -89.05], r: 1.8, team: 'murk', n: [0, 0, 1] },
    murk(0, BOWL, -120, 3), murk(-15, DECK, -110, 2), murk(12, DECK, -134, 2.2), murk(0, DECK, -137, 1.8),
    murk(0, STAGE + 0.18, -146, 2.2),
  ],
  entities,
  route: [
    [0, 0, 11], [0, 0, -12], [0, 0, -20], [0, 0, -34], [4.5, 0, -40], [4.5, 0, -58], [0, 0, -61], [0, 0, -66.5],
    [0, PIPE, -79], [0, -1.1, -88.85], [0, DECK, -91, 'climb'], [0, DECK, -99], [0, DECK, -104], [0, DECK, -108.5],
    [0, BOWL, -116], [0, BOWL, -124], [0, DECK, -131.5], [0, DECK, -138.5], [0, STAGE + 0.18, -144, 'launch'],
  ],
};
