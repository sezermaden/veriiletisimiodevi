// 4-B Graytide Mech — the storm-lashed roof of Murkwell Tower, 60 m above the city. The mech holds
// the north end; the south half is dotted with steel pontoon platforms (kid-jumpable gaps, a ramp
// and stairs up, paintable sides) that become islands when the roof floods with Murk in phase 3.
//   Roof: x,z ∈ [-24, 24] at y 60. Platforms: tops 61.6 … 63.2.
import { block, box, rampC, stairs, cyl, ent } from '../kit.js';

const PI = Math.PI;
const Y = 60;
const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });

/** Steel pontoon: body + yellow rim. */
function pontoon(cx, cz, w, d, h) {
  return [
    block(cx, cz, w, d, Y, h - 0.18, { mat: 'metal', color: '#b4bbcc' }),
    block(cx, cz, w + 0.2, d + 0.2, Y + h - 0.18, 0.18, { mat: 'tiles', color: '#ffd46a' }),
  ];
}

const PLAT = [
  [0, 11, 5, 4, 1.6], [-6, 7, 4, 4, 1.9], [6, 7, 4, 4, 1.9], [-11, 2, 4, 4, 2.2], [11, 2, 4, 4, 2.2],
  [-6, -2, 4.5, 4.5, 2.2], [6, -2, 4.5, 4.5, 2.2], [0, 2, 4, 4, 2.6],
];

export default {
  id: 'w4-boss',
  name: 'Graytide Mech',
  world: 4,
  theme: 'tower',
  music: 'final-boss',
  waterY: -2,
  killY: Y - 10,
  spawn: { pos: [-5, Y, 17], yaw: PI },
  objective: 'Defeat Baron Murkwell',
  brushes: [
    // roof + the tower underneath (unpaintable, it's just the building)
    block(0, 0, 50, 50, Y - 1.5, 1.5, { mat: 'concrete', color: '#c9c5d8' }),
    block(0, 0, 48, 48, -2, Y - 3.5, { mat: 'brick', color: '#4a4560', paint: false }),
    block(0, 0, 52, 52, Y - 3.5, 2, { mat: 'metal', color: '#2e2a3d', paint: false }),
    // helipad ring (tiles) under the mech's feet
    cyl(0, Y, -12, 7.5, 0.04, { mat: 'tiles', color: '#e6e1f0', sides: 28 }),
    // parapet
    box(-25, Y, -25, 25, Y + 1.2, -24.2, { mat: 'concrete', color: '#8c87a0' }),
    box(-25, Y, 24.2, 25, Y + 1.2, 25, { mat: 'concrete', color: '#8c87a0' }),
    box(-25, Y, -24.2, -24.2, Y + 1.2, 24.2, { mat: 'concrete', color: '#8c87a0' }),
    box(24.2, Y, -24.2, 25, Y + 1.2, 24.2, { mat: 'concrete', color: '#8c87a0' }),
    // pontoon platforms
    ...PLAT.flatMap(([x, z, w, d, h]) => pontoon(x, z, w, d, h)),
    // ways up: ramp to the south pontoon, stairs to the side ones
    rampC(0, 15.5, 4, 5, Y, 1.6, '-z', { mat: 'metal', color: '#c7ccd8' }),
    stairs(-17, Y, 1, -13, Y + 2.2, 3, '+x', { mat: 'metal', color: '#c7ccd8' }),
    stairs(13, Y, 1, 17, Y + 2.2, 3, '-x', { mat: 'metal', color: '#c7ccd8' }),
    // corner spires (paintable, climbable) and generator boxes
    cyl(-21.5, Y, -21.5, 0.9, 9, { mat: 'metal', color: '#6e6a84', sides: 10 }),
    cyl(21.5, Y, -21.5, 0.9, 9, { mat: 'metal', color: '#6e6a84', sides: 10 }),
    cyl(-21.5, Y, 21.5, 0.9, 6, { mat: 'metal', color: '#6e6a84', sides: 10 }),
    cyl(21.5, Y, 21.5, 0.9, 6, { mat: 'metal', color: '#6e6a84', sides: 10 }),
    block(-19, 15, 3, 2, Y, 1.6, { mat: 'metal', color: '#5e5a72' }),
    block(19, 15, 3, 2, Y, 1.6, { mat: 'metal', color: '#5e5a72' }),
  ],
  preInk: [{ at: [-5, Y, 17], r: 2.2, team: 'hero' }],
  entities: [
    ent('boss-murkwell', 0, Y, -12, { yaw: 0, arena: { center: [0, Y, 0], half: [20, 18] } }),
    ent('pearl-trail', -1.8, Y + 1.7, 11, { to: [1.8, Y + 1.7, 11], count: 4 }),
    ent('pearl-trail', -11, Y + 2.3, 1, { to: [-11, Y + 2.3, 3], count: 3 }),
    ent('pearl-trail', 11, Y + 2.3, 1, { to: [11, Y + 2.3, 3], count: 3 }),
    ent('pearl-trail', -1, Y + 2.7, 2, { to: [1, Y + 2.7, 2], count: 3 }),
    ent('pearl', -19, Y + 1.7, 15), ent('pearl', 19, Y + 1.7, 15),
    ent('postcard', -21.5, Y + 6.05, 21.5, { id: 'w4-boss', title: 'From the Lighthouse Keepers', text: 'To whoever brings the colour home: thank you. Tidehaven will remember.' }),
    // --- dressing ---
    D('antenna', -21.5, Y + 9, -21.5, { height: 4 }), D('antenna', 21.5, Y + 9, -21.5, { variant: 'radar', height: 3 }),
    D('satellite', -21.5, Y + 6, 21.5, { yaw: PI * 0.75 }), D('satellite', 21.5, Y + 6, 21.5, { yaw: -PI * 0.75 }),
    D('flag', -8, Y, -23.4, { color: '#6a2bd9' }), D('flag', 8, Y, -23.4, { color: '#6a2bd9' }),
    D('flag', -23.4, Y, 0, { color: '#6a2bd9' }), D('flag', 23.4, Y, 0, { color: '#6a2bd9' }),
    D('neon-sign', 0, Y + 1.2, -24.3, { text: 'MURKWELL', color: '#a77bff', height: 2.5 }),
    D('billboard', -14, Y + 1.2, -26.5, { text: 'Murk Industries' }),
    D('billboard', 14, Y + 1.2, -26.5, { text: 'Grayer is Better' }),
    D('speaker-tower', -12, Y, -22.5, { height: 3, color: '#a77bff' }), D('speaker-tower', 12, Y, -22.5, { height: 3, color: '#a77bff' }),
    D('lamp', -23.3, Y, -10, { yaw: PI / 2 }), D('lamp', 23.3, Y, -10, { yaw: -PI / 2 }),
    D('lamp', -23.3, Y, 10, { yaw: PI / 2 }), D('lamp', 23.3, Y, 10, { yaw: -PI / 2 }),
    D('railing', 0, Y + 1.2, 24.3, { yaw: PI, length: 40 }), D('railing', -24.3, Y + 1.2, 0, { yaw: PI / 2, length: 40 }),
    D('railing', 24.3, Y + 1.2, 0, { yaw: -PI / 2, length: 40 }),
    D('chimney', -17, Y, -20), D('chimney', 17, Y, -20),
    D('pipe', -23.2, Y, 6, { yaw: PI / 2, length: 6 }), D('pipe', 23.2, Y, -4, { yaw: PI / 2, length: 6 }),
    D('barrel', -18.5, Y, 12.5, { variant: 'toxic' }), D('barrel', 18.4, Y, 12.4, { variant: 'toxic' }), D('barrel', 19.2, Y, 11.6),
    D('crate-stack', -22, Y, 16, { count: 2, yaw: 0.2 }), D('crate-stack', 22, Y, 17, { count: 3, yaw: -0.3 }),
    D('graffiti', 0, Y, 24.18, { yaw: PI, text: 'COLOUR IS FREE', size: 5 }),
  ],
  route: [[-5, Y, 17], [0, Y, 18.5], [0, Y + 1.6, 12], [-6, Y + 1.9, 7], [-11, Y + 2.2, 2], [-6, Y + 2.2, -2], [0, Y + 2.6, 2], [6, Y + 2.2, -2], [3, Y, -6]],
};
