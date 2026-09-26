// Turf Clash arena: REFINERY ROW (refinery). Night shift at a Murk plant: a raised centre platform
// around a climbable vat, tall pipe walls that split each side into a centre lane and a flank
// corridor, a grate catwalk (ramp up from the base side) over one flank (grates can't be inked), a grate lane in the
// other, storage vats for cover and sludge on both long sides behind guard rails. Point-symmetric.
import { block, box, ramp, cyl } from '../kit.js';
import { turfArena, D } from '../../turf/arena-kit.js';

const PI = Math.PI;
const metal = (o = {}) => ({ mat: 'metal', color: '#9aa6b2', ...o });
const floor = (x0, z0, x1, z1, o = {}) => box(x0, -1, z0, x1, 0, z1, { mat: 'concrete', color: '#d6dae2', ...o });
const GRATE = { mat: 'grate', color: '#c9d2dc' };

export default turfArena({
  id: 'turf-refinery',
  name: 'Refinery Row',
  theme: 'refinery',
  themeOverride: { hemiIntensity: 1.05, sunIntensity: 1.45, exposure: 1.18 },
  waterY: -1.4,
  killY: -4,
  blurb: 'Tight pipe corridors around a raised central vat. Great for bombs.',
  base: { x: -31.5, z: 0, y0: 0, h: 1, w: 7, d: 12, rampLen: 4, rampW: 6, mat: 'rubber', color: '#c6ccd8', floorY: -1 },
  judge: { pos: [0, 3.2, 22.6], yaw: PI },
  center: [
    block(0, 0, 12, 12, -1.6, 3.8, metal({ color: '#7d8a96' })),                   // centre platform (top 2.2)
    cyl(0, 2.2, 0, 2.6, 3.2, { mat: 'metal', color: '#5f6b78', sides: 20 }),        // the vat (top 5.4)
  ],
  half: [
    // floors (split around the base pad, the centre platform and the grate lane)
    floor(-35, -19, -28, -6), floor(-35, 6, -28, 19),                                // behind the pad
    floor(-28, -19, -6, -12),
    floor(-28, -12, -20, -9), floor(-10, -12, -6, -9),
    box(-20, -1, -12, -10, 0, -9, GRATE),                                            // grate lane (no ink)
    floor(-28, -9, -6, 19),
    floor(-6, -19, 6, -6, { color: '#cdd1da' }),                                     // south strip beside the platform
    // ramp up the centre platform
    ramp(-11, 0, -2, -6, 2.2, 2, '+x', metal({ color: '#c9ced8' })),
    // pipe walls (climbable, walkable tops)
    block(-15, -7, 12, 1, 0, 2.8, metal({ color: '#6f7d8c' })),
    block(-18, 7.5, 8, 1, 0, 2.8, metal({ color: '#6f7d8c' })),
    // grate catwalk over the north flank with stairs from the base side
    box(-24, 2.2, 13, -9, 2.4, 15.4, GRATE),
    ramp(-29.5, 0, 13, -24, 2.4, 15.4, '+x', metal({ color: '#8894a0' })),
    ...[-21, -16, -11].flatMap((x) => [block(x, 13.3, 0.25, 0.25, 0, 2.2, metal({ color: '#2b2f3e' })), block(x, 15.1, 0.25, 0.25, 0, 2.2, metal({ color: '#2b2f3e' }))]),
    // storage vats (cover; climb them for a look-out)
    cyl(-13.5, 0, 4.4, 1.7, 3.2, { mat: 'metal', color: '#c7a14a', sides: 16 }),
    cyl(-23.5, 0, -15.5, 1.9, 3.6, { mat: 'metal', color: '#4f9a6a', sides: 16 }),
    cyl(-3, 0, -15, 1.4, 2.4, { mat: 'metal', color: '#a95f5f', sides: 14 }),
    // crates / low cover
    block(-20.5, 2, 1.2, 1.2, 0, 1.0, { mat: 'wood', color: '#b98a52' }),
    block(-8.5, -15.5, 1.2, 2.6, 0, 1.0, metal({ color: '#dfe4ea' })),
    block(-25, 9.5, 2.4, 1, 0, 1.1, metal({ color: '#dfe4ea' })),
    // guard rails over the sludge (full south edge; the rotation covers the north edge)
    box(-35, -1.4, -19.35, -3, 0.9, -19, metal({ color: '#f2b134', paint: false })),
    box(3, -1.4, -19.35, 35, 0.9, -19, metal({ color: '#f2b134', paint: false })),
    box(-35.4, -1.4, -19.35, -35, 0.9, 19.35, metal({ color: '#f2b134', paint: false })),
  ],
  decorCenter: [
    D('antenna', 0, 5.4, 0, { height: 2.2, variant: 'radar' }),
    D('chimney', 12, -1.4, 24), D('chimney', -12, -1.4, -24),
  ],
  decor: [
    D('pipe', -15, 2.8, -7.1, { length: 11.4, radius: 0.32, height: 0.42, color: '#3aa0a8' }),
    D('pipe', -18, 2.8, 7.4, { length: 7.4, radius: 0.32, height: 0.42, color: '#c77d3a' }),
    D('pipe', -26, 0, 18.9, { length: 6, radius: 0.28, height: 0.9, color: '#8a6ad8' }),
    D('barrel', -34, 0, -17.5, { variant: 'toxic' }), D('barrel', -33.2, 0, -18, { variant: 'toxic' }), D('barrel', -34.2, 0, 17.8),
    D('lamp', -27.8, 0, -18.6), D('lamp', -6.3, 0, 18.5), D('lamp', -9, 2.4, 15.2),
    D('satellite', -31.5, 0, 17.5, { yaw: PI / 3 }), D('antenna', -34, 0, -12, { height: 5, variant: 'radar' }),
    D('billboard', -37, 0, 0, { yaw: PI / 2, text: 'REFINERY ROW' }),
    D('speaker-tower', -28.5, 0, 18.3, { yaw: -PI / 2 }),
    D('buoy', -20, -1.4, -23), D('buoy', 14, -1.4, -22.5),
  ],
});
