// Turf Clash arena: SKATE CANYON (heights). A walled skatepark at dusk: a sunken centre bowl you can
// cross (down one wall, up the other) or skirt along the flank strips, a raised deck with a
// quarter-pipe ramp on each side (high ground; its other faces are climbable), funboxes, a
// kicker, grind rails, a wall-ride along the canyon wall, a storm-drain grate (can't be inked) and
// neon everywhere. Point-symmetric.
import { block, box, ramp } from '../kit.js';
import { turfArena, D } from '../../turf/arena-kit.js';

const PI = Math.PI;
const conc = (o = {}) => ({ mat: 'concrete', color: '#f4f0f6', ...o });
const WALL = { mat: 'plaster', color: '#f3c9e4', paint: false };
const SCENERY = (o) => ({ collide: false, paint: false, castShadow: false, ...o });
/** The tower block the rooftop park sits on (visual only). */
const skyline = [
  box(-37, -40, -24, 37, -3.1, 24, SCENERY({ mat: 'brick', color: '#c795b4' })),
];

/** Grind rail: a thin bar on two posts (jump over it or duck behind it). */
function rail(x0, z0, x1, z1, h = 0.55) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  const along = maxX - minX > maxZ - minZ;
  const o = { mat: 'metal', color: '#ffd23f' };
  return [
    along ? box(minX, h - 0.08, (z0 + z1) / 2 - 0.07, maxX, h + 0.06, (z0 + z1) / 2 + 0.07, o) : box((x0 + x1) / 2 - 0.07, h - 0.08, minZ, (x0 + x1) / 2 + 0.07, h + 0.06, maxZ, o),
    block(x0, z0, 0.14, 0.14, 0, h - 0.08, { mat: 'metal', color: '#2b2f3e' }),
    block(x1, z1, 0.14, 0.14, 0, h - 0.08, { mat: 'metal', color: '#2b2f3e' }),
  ];
}

/** Funbox: ramp up, flat top, ramp down (along x). */
function funbox(cx, cz, w, h = 1, top = 3, runup = 2.2) {
  const o = conc({ color: '#ffe08a' });
  return [
    ramp(cx - top / 2 - runup, 0, cz - w / 2, cx - top / 2, h, cz + w / 2, '+x', o),
    block(cx, cz, top, w, 0, h, o),
    ramp(cx + top / 2, 0, cz - w / 2, cx + top / 2 + runup, h, cz + w / 2, '-x', o),
  ];
}

export default turfArena({
  id: 'turf-skate',
  name: 'Skate Canyon',
  theme: 'heights',
  themeOverride: { hemiIntensity: 1.05, sunIntensity: 1.8, exposure: 1.1 },
  water: false,
  waterY: -8,
  killY: -6,
  blurb: 'Bowls, funboxes and a raised deck on each side. Fast lanes reward swimmers.',
  base: { x: -31.5, z: 0, y0: 0, h: 1, w: 7, d: 12, rampLen: 4, rampW: 6, mat: 'rubber', color: '#d6d0e6', floorY: -1 },
  judge: { pos: [0, 6, 24.2], yaw: PI },
  center: [
    block(0, 0, 18, 12, -2.5, 1, { mat: 'tiles', color: '#9fd0ff' }),        // bowl floor (top -1.5)
    block(0, 0, 3, 1.6, -1.5, 0.45, conc({ color: '#ffe08a' })),               // bowl hump
    ...skyline,
  ],
  half: [
    // ground (split around the base pad and the bowl)
    block(-18.5, 0, 19, 44, -1, 1, conc()),                                    // x -28..-9
    block(-31.5, -14, 7, 16, -1, 1, conc()),                                   // behind the pad
    block(-31.5, 14, 7, 16, -1, 1, conc()),
    box(-9, -1, -18.5, 9, 0, -6, conc({ color: '#eee8f2' })),                   // south strip x ±9
    box(-9, -1, -22, 2, 0, -18.5, conc({ color: '#eee8f2' })),
    box(2, -1, -22, 9, 0, -18.5, { mat: 'grate', color: '#c9d2dc' }),         // storm-drain grate (no ink)
    // bowl walls (quarter pipes down to the bowl floor)
    ramp(-9, -1.5, -6, -5.5, 0, 6, '-x', conc({ color: '#b8dcff' })),
    ramp(-9, -1.5, -6, 9, 0, -2.6, '-z', conc({ color: '#b8dcff' })),
    // raised deck with a quarter-pipe ramp toward mid (Alpha high ground)
    block(-20.5, 12, 7, 8, 0, 2.4, { mat: 'tiles', color: '#8fe6d8' }),
    ramp(-17, 0, 9, -12, 2.4, 15, '-x', conc({ color: '#ffd6a0' })),
    // manual pad (jump up), kicker, rails, funbox
    block(-21, -9.5, 6, 3, 0, 0.6, conc({ color: '#ffb4c8' })),
    ramp(-16.5, 0, -17, -13, 1.0, -14, '+x', conc({ color: '#ffd6a0' })),
    ...rail(-26, 5.5, -19, 5.5),
    ...rail(-12, -3.5, -12, -9.5),
    ...funbox(-3.5, -15, 3, 1),
    // wall-ride quarter pipe along the canyon wall
    ramp(-27, 0, -22, -11, 1.2, -19.4, '-z', conc({ color: '#c8b8ff' })),
    // cover blocks (climbable)
    block(-13, 3.8, 2, 2, 0, 1.3, { mat: 'plaster', color: '#ff9fb2' }),
    block(-24.5, -7, 1.2, 3.2, 0, 1.2, { mat: 'plaster', color: '#8fd3ff' }),
    block(5, -10.5, 1.6, 1.6, 0, 1.25, { mat: 'plaster', color: '#ffd23f' }),
    // canyon walls (not paintable: they bound the arena)
    box(-36, -1, -23, 36, 6, -22, WALL),
    box(-36, -1, -23, -35, 6, 23, WALL),
  ],
  decorCenter: [],
  decor: [
    D('neon-sign', -20, 2.8, -21.9, { text: 'SKATE', color: '#ff4fd8' }),
    D('neon-sign', 6, 3, -21.9, { text: 'CANYON', color: '#2fe0ff' }),
    D('graffiti', -8, 1.6, -21.9, { size: [6, 3], style: 'squid' }),
    D('graffiti', 18, 1.6, -21.9, { size: [5, 2.6], style: 'tag' }),
    D('billboard', -35.2, 6, 0, { yaw: PI / 2, text: 'SKATE CANYON' }),
    D('speaker-tower', -34, 0, -20.8, { yaw: PI / 4 }),
    D('palm', -34, 0, 20.5), D('palm', -26, 0, 21), D('bush', -30, 0, 21.2),
    D('lamp', -17.5, 2.4, 15.2), D('lamp', -9.8, 0, -21.2),
    D('bench', -28, 0, -21, { yaw: 0 }), D('cone', -12.5, 0, -12.5), D('cone', -11.5, 0, -12),
    D('antenna', -22, 2.4, 15.2, { height: 2.5 }),
  ],
});
