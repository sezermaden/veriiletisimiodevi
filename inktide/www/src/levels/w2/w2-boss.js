// 2-B The Bucketeer — a Coral Heights rooftop at dusk. The Bucketeer circles above; the old water
// tower in the middle (stairs to a landing, then a pre-inked wall to climb) is the vantage point
// for hitting the core when the bucket sputters down beside it. Corner decks give extra height
// for sniping the valves; AC units and planters are cover from the pour runs.
//   Roof: x,z ∈ [-22.4, 22.4] at y 0. Tower top y 5.5. Corner decks y 2.4.
import { block, box, rampC, stairs, cyl, ent } from '../kit.js';

const PI = Math.PI;
const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });
const TOP = 5.5;
const hero = (x, y, z, r, n) => ({ at: [x, y, z], r, team: 'hero', n });

export default {
  id: 'w2-boss',
  name: 'The Bucketeer',
  world: 2,
  theme: 'heights',
  music: 'boss',
  waterY: -40,
  water: false,
  killY: -8,
  spawn: { pos: [0, 0, 17], yaw: PI },
  objective: 'Defeat The Bucketeer',
  brushes: [
    // roof slab and the building below it
    block(0, 0, 46, 46, -1.5, 1.5, { mat: 'rubber', color: '#cfc5d6' }),
    block(0, 0, 45, 45, -40, 38.5, { mat: 'plaster', color: '#8f7fa6', paint: false }),
    // tiled walkways crossing the roof
    block(0, 11, 4, 18, 0, 0.06, { mat: 'tiles', color: '#f2e6ee' }),
    block(0, -11.5, 4, 17, 0, 0.06, { mat: 'tiles', color: '#f2e6ee' }),
    block(11.5, 0, 17, 4, 0, 0.06, { mat: 'tiles', color: '#f2e6ee' }),
    block(-11.5, 0, 17, 4, 0, 0.06, { mat: 'tiles', color: '#f2e6ee' }),
    // parapet
    box(-23, 0, -23, 23, 1.1, -22.4, { mat: 'plaster', color: '#f0d3e0' }),
    box(-23, 0, 22.4, 23, 1.1, 23, { mat: 'plaster', color: '#f0d3e0' }),
    box(-23, 0, -22.4, -22.4, 1.1, 22.4, { mat: 'plaster', color: '#f0d3e0' }),
    box(22.4, 0, -22.4, 23, 1.1, 22.4, { mat: 'plaster', color: '#f0d3e0' }),
    // the water tower: brick block, landing + stairs on the south side
    block(0, 0, 5, 5, 0, TOP, { mat: 'brick', color: '#e8b8a8' }),
    block(0, 0, 5.4, 5.4, TOP - 0.25, 0.25, { mat: 'metal', color: '#ffc53a' }),
    block(0, 3.25, 5, 1.5, 0, 2.75, { mat: 'concrete', color: '#e4dcea' }),
    stairs(-1.5, 0, 4, 1.5, 2.75, 8.5, '-z', { mat: 'wood', color: '#d9a878' }),
    // corner decks (NE + SW with ramps, NW + SE climb only)
    block(17, -17, 6, 6, 0, 2.4, { mat: 'metal', color: '#b7b1c9' }),
    block(-17, 17, 6, 6, 0, 2.4, { mat: 'metal', color: '#b7b1c9' }),
    block(-17, -17, 6, 6, 0, 2.4, { mat: 'plaster', color: '#f3c7d9' }),
    block(17, 17, 6, 6, 0, 2.4, { mat: 'plaster', color: '#f3c7d9' }),
    rampC(17, -10.5, 3, 7, 0, 2.4, '-z', { mat: 'concrete', color: '#ddd5e6' }),
    rampC(-17, 10.5, 3, 7, 0, 2.4, '+z', { mat: 'concrete', color: '#ddd5e6' }),
    // AC units (cover)
    block(8, -6, 2.6, 1.8, 0, 1.5, { mat: 'metal', color: '#d6d9e2' }),
    block(-9, 5.5, 1.8, 2.6, 0, 1.5, { mat: 'metal', color: '#d6d9e2' }),
    block(7, 10, 2.6, 1.8, 0, 1.5, { mat: 'metal', color: '#d6d9e2' }),
    block(-7.5, -10.5, 2.6, 1.8, 0, 1.5, { mat: 'metal', color: '#d6d9e2' }),
    // skylights (glass: unpaintable) and planters
    block(-12, 13, 3.2, 3.2, 0, 0.55, { mat: 'glass', color: '#bfe8ff' }),
    block(13, -1.5, 3.2, 3.2, 0, 0.55, { mat: 'glass', color: '#bfe8ff' }),
    block(12.5, 13, 2.2, 2.2, 0, 0.7, { mat: 'wood', color: '#b8845a' }),
    block(-13, -3, 2.2, 2.2, 0, 0.7, { mat: 'wood', color: '#b8845a' }),
    // pipes along the parapet (low cover, paintable)
    cyl(-20.5, 0, 0, 0.45, 0.9, { mat: 'metal', color: '#9fa6b8', sides: 12 }),
    cyl(20.5, 0, 4, 0.45, 0.9, { mat: 'metal', color: '#9fa6b8', sides: 12 }),
  ],
  preInk: [
    // the tower walls above the landing are pre-inked: "climb here"
    hero(0, 3.4, 2.52, 1.7, [0, 0, 1]), hero(0, 4.8, 2.52, 1.6, [0, 0, 1]),
    hero(-1.6, 4.2, 2.52, 1.2, [0, 0, 1]), hero(1.6, 4.2, 2.52, 1.2, [0, 0, 1]),
    hero(2.52, 2.2, 0, 1.6, [1, 0, 0]), hero(2.52, 4.2, 0, 1.6, [1, 0, 0]),
    hero(-2.52, 2.2, 0, 1.6, [-1, 0, 0]), hero(-2.52, 4.2, 0, 1.6, [-1, 0, 0]),
    hero(0, 2.2, -2.52, 1.6, [0, 0, -1]), hero(0, 4.2, -2.52, 1.6, [0, 0, -1]),
    hero(0, 0, 13, 2.2, [0, 1, 0]),
  ],
  entities: [
    ent('boss-bucketeer', 0, 0, -12, { yaw: 0, arena: { center: [0, 0, 0], radius: 11 }, tower: [0, TOP, 0] }),
    ent('pearl-trail', 0, 0.2, 12.5, { to: [0, 2.95, 4.2], count: 6 }),
    ent('pearl-trail', -1.8, TOP + 0.2, -1.8, { to: [1.8, TOP + 0.2, -1.8], count: 4 }),
    ent('pearl-trail', 15, 2.6, -15, { to: [19, 2.6, -19], count: 5 }),
    ent('pearl-trail', -15, 2.6, 15, { to: [-19, 2.6, 19], count: 5 }),
    ent('postcard', -19, 2.4, -19, { id: 'w2-boss', title: 'Congratulations, Champion!', text: 'To Brine: best final we ever reffed! PS: please tell that anglerfish kid to stop sulking under the bleachers.' }),
    // --- dressing ---
    D('antenna', 2.1, TOP, -2.1, { height: 2.6 }), D('satellite', -2, TOP, -2, { yaw: PI * 0.75 }),
    D('neon-sign', 0, 1.1, -22.5, { text: 'CORAL', color: '#ff5fa8', height: 1.6 }),
    D('neon-sign', -22.5, 1.1, -8, { yaw: PI / 2, text: 'HEIGHTS', color: '#2fd6ff', height: 1.6 }),
    D('neon-sign', 22.5, 1.1, 8, { yaw: -PI / 2, text: 'SLOSH', color: '#ffd23f', height: 1.6 }),
    D('billboard', 10, 1.1, -24.5, { text: 'Squidberry Soda' }),
    D('billboard', -10, 1.1, 24.5, { yaw: PI, text: 'Murk Industries' }),
    D('speaker-tower', -17, 2.4, -17, { height: 2, color: '#ff4fd8' }), D('speaker-tower', 17, 2.4, 17, { height: 2, color: '#2fd6ff' }),
    D('satellite', 18.5, 2.4, -18.5, { yaw: -PI / 4 }), D('antenna', -18.8, 2.4, 18.8, { variant: 'radar', height: 2.2 }),
    D('palm', 12.5, 0.7, 13), D('palm', -13, 0.7, -3), D('bush', 12, 0.7, 12.2, { flowerColor: '#ff5fa8' }), D('bush', -12.5, 0.7, -2.2, { flowerColor: '#ffd23f' }),
    D('flowerpot', -20.8, 0, 12), D('flowerpot', -20.8, 0, 13.2, { color: '#b98cff' }), D('flowerpot', 20.8, 0, -13),
    D('bench', 20.6, 0, -4, { yaw: -PI / 2 }), D('bench', -20.6, 0, 4, { yaw: PI / 2 }),
    D('vending', 20.4, 0, 12, { yaw: -PI / 2, color: '#ff5fa8' }), D('vending', -20.4, 0, -12, { yaw: PI / 2, color: '#2fb6ff' }),
    D('awning', -8, 0, 22.3, { yaw: PI, length: 4, color: '#ff8fb2', height: 2.2 }),
    D('chimney', 21, 0, 21), D('chimney', -21, 0, -21),
    D('lamp', -3.5, 0, 16, { yaw: PI }), D('lamp', 3.5, 0, 16, { yaw: PI }),
    D('graffiti', -2.52, 0.2, 1.4, { yaw: -PI / 2, style: 'squid', size: 1.8, color: '#ff5fa8', color2: '#2fd6ff' }),
    D('graffiti', 0, 0, -22.38, { text: 'RISE UP', size: 3 }),
    D('flag', 19, 2.4, 15.5, { color: '#ff5fa8' }), D('flag', -19, 2.4, -15.5, { color: '#2fd6ff' }),
    D('cone', 4, 0, 6.5), D('cone', -4.2, 0, 6.8),
    D('pipe', 20.6, 0, -8, { yaw: PI / 2, length: 5 }), D('pipe', -20.6, 0, 8, { yaw: PI / 2, length: 5 }),
  ],
  route: [[0, 0, 17], [0, 0, 9], [0, 2.75, 3.4], [0, TOP, 1.8, 'climb'], [0, TOP, -1]],
};
