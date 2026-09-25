// Turf Clash arena: PIER NINE (docks). Wooden piers over the harbour, container cover, a raised
// centre stack and a gantry crane standing in the water beside the south pier. Point-symmetric (Alpha west, Bravo east).
//
//   centre pier (x ±23, z ±6.5) ─ central stack (2.4 m, ramp from each side, climbable flanks)
//   south pier (Alpha-led flank) / north pier (Bravo-led flank), 5.5 m water channels crossed by
//   a wooden footbridge and a metal-grate gangway (no ink: you can't swim across it) each. Container "C1" in front of each base has a ramp (high ground); the
//   flank container "C3" is a climb-only perch; "C2" and crates are cover.
import { block, box, ramp, container } from '../kit.js';
import { turfArena, D } from '../../turf/arena-kit.js';

const PI = Math.PI;
const wood = (o = {}) => ({ mat: 'wood', color: '#f0dcc0', ...o });
const deck = (cx, cz, w, d, o = {}) => block(cx, cz, w, d, -1.6, 1.6, wood(o));

export default turfArena({
  id: 'turf-pier',
  name: 'Pier Nine',
  theme: 'docks',
  waterY: -1.25,
  killY: -3.5,
  blurb: 'Long wooden piers, container cover and a raised stack in the middle. Watch the flanks over the water.',
  base: { x: -31.5, z: 0, y0: 0, h: 1, w: 7, d: 12, rampLen: 4, rampW: 6, mat: 'rubber', color: '#dcd8e8' },
  judge: { pos: [0, 3.2, 25.5], yaw: Math.PI },
  center: [
    deck(0, 0, 46, 13),                                                             // centre pier x ±23
    block(0, 0, 7, 7, 0, 2.4, { mat: 'container', color: '#3b6fb8' }),               // central stack
    // piles under the centre
    ...[-19, -9, 9, 19].flatMap((x) => [block(x, -6.7, 0.5, 0.5, -3, 3, { mat: 'wood', color: '#8a6a4a' }), block(x, 6.7, 0.5, 0.5, -3, 3, { mat: 'wood', color: '#8a6a4a' })]),
  ],
  half: [
    // base plaza, split around the base pad (x -35..-28, z ±6)
    deck(-25.5, 0, 5, 38),                                                          // x -28..-23
    deck(-31.5, -12.5, 7, 13),                                                      // x -35..-28, z -19..-6
    deck(-31.5, 12.5, 7, 13),                                                       //            z 6..19
    // south pier (x -23..11, z -19..-12) and its footbridges to the centre pier
    deck(-6, -15.5, 34, 7),
    deck(-12, -9.25, 3.5, 5.5, { color: '#e6cfae' }),
    block(-2, 9.25, 3.5, 5.5, -1.6, 1.6, { mat: 'grate', color: '#c9d2dc' }),     // metal gangway (can't be inked)
    // ramp up the central stack from the Alpha side
    ramp(-8.5, 0, -1.5, -3.5, 2.4, 1.5, '+x', { mat: 'metal', color: '#c9ced8' }),
    // C1: container across the centre lane with a ramp to its roof (Alpha high ground)
    container(-15, 0, 0, '#d9482b', 1),
    ramp(-21.8, 0, -1.25, -16.25, 2.6, 1.25, '+x', { mat: 'metal', color: '#c9ced8' }),
    // C2: cover on the south pier; C3: climb-only perch near mid
    container(-14, 0, -15.5, '#2f7fd8'),
    container(4, 0, -15.8, '#35b56a'),
    // crates (jumpable cover)
    block(-8.5, -4.6, 1.4, 1.4, 0, 1.0, { mat: 'wood', color: '#c08b52' }),
    block(-10.2, 4.8, 1.4, 1.4, 0, 1.0, { mat: 'wood', color: '#c08b52' }),
    block(-4.5, -17.5, 1.4, 1.4, 0, 1.0, { mat: 'wood', color: '#c08b52' }),
    block(-21, -15, 1.2, 3, 0, 1.0, { mat: 'concrete', color: '#d8d2c8' }),
    block(-24.8, 9.5, 1, 5, 0, 1.0, { mat: 'concrete', color: '#d8d2c8' }),
    // warehouse by the base with a steep ramp to its roof
    block(-31.5, 15.5, 6, 6, 0, 2.4, { mat: 'brick', color: '#e7a58c' }),
    ramp(-28.5, 0, 13.2, -23.4, 2.4, 15.8, '-x', { mat: 'metal', color: '#c9ced8' }),
    // mooring bollards on the outer pier edge (low, jumpable)
    ...[-18, -8, 2].map((x) => block(x, -18.6, 0.5, 0.5, 0, 0.6, { mat: 'metal', color: '#2b2f3e' })),
    // piles
    ...[-20, -10, 0, 10].map((x) => block(x, -19.2, 0.5, 0.5, -3, 3, { mat: 'wood', color: '#8a6a4a' })),
    box(-35.6, -3, -19, -35, 0.2, 19, { mat: 'wood', color: '#8a6a4a' }),        // back beam behind the base
  ],
  decorCenter: [
    D('crane', 0, -1.25, -24, { color: '#f2b134', yaw: Math.PI / 2 }),
    D('lamp', -3.1, 2.4, -3.1), D('lamp', 3.1, 2.4, 3.1),
    D('buoy', -12, -1.25, 23), D('buoy', 12, -1.25, -23), D('buoy', 26, -1.25, 23), D('buoy', -26, -1.25, -23),
  ],
  decor: [
    D('lamp', -22.6, 0, -6.2), D('lamp', -10, 0, 6.1), D('lamp', -22.6, 0, -18.6), D('lamp', 10.6, 0, -18.6),
    D('billboard', -37.5, 0, 0, { yaw: PI / 2, text: 'PIER NINE' }),
    D('speaker-tower', -34.4, 0, -18.3, { yaw: PI / 4 }),
    D('barrel', -34.2, 0, 7.2), D('barrel', -33.4, 0, 7.6, { variant: 'toxic' }),
    D('crate-stack', -34, 0, -8, { count: 2 }),
    D('tire-stack', -22.8, 0, 18.2), D('cone', -23.2, 0, -12.4),
    D('antenna', -31.5, 2.4, 17.5, { height: 3 }),
    D('buoy', -20, -1.25, -22), D('buoy', 16, -1.25, -10),
  ],
});
