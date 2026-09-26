// 1-B The Grinder — a square dock yard walled in by stacked containers. A raised steel walkway
// rings the yard (ramps in two corners, paintable walls everywhere), four thick pillars and two
// container piles give the player something to hide behind so the Grinder rams them.
//   Floor: x,z ∈ [-19, 19] at y 0. Walkway deck: 3 m wide ring at y 2.6.
import { block, box, ramp, cyl, container, ent } from '../kit.js';

const PI = Math.PI;
const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });
const DECK = 2.6;
const COLORS = ['#d9482b', '#2f7fd8', '#35b56a', '#e0a02b', '#8a4bd8', '#e0612b', '#2fb6c8', '#c83a5a'];

function containerWall() {
  const out = [];
  let k = 0;
  // north + south rows (long axis along X), two high, outside the deck
  for (const z of [-23.35, 23.35]) {
    for (let x = -20; x <= 20; x += 8.1) {
      out.push(container(x, 0, z, COLORS[k++ % COLORS.length]));
      out.push(container(x + (k % 2 ? 0.4 : -0.4), 2.6, z, COLORS[(k + 3) % COLORS.length]));
    }
  }
  // east + west rows (long axis along Z)
  for (const x of [-23.35, 23.35]) {
    for (let z = -16.2; z <= 16.2; z += 8.1) {
      out.push(container(x, 0, z, COLORS[k++ % COLORS.length], 1));
      out.push(container(x, 2.6, z + (k % 2 ? 0.4 : -0.4), COLORS[(k + 5) % COLORS.length], 1));
    }
  }
  return out;
}

export default {
  id: 'w1-boss',
  name: 'The Grinder',
  world: 1,
  theme: 'docks',
  music: 'boss',
  waterY: -1.6,
  killY: -8,
  spawn: { pos: [0, 0, 15], yaw: PI },
  objective: 'Defeat The Grinder',
  brushes: [
    // yard floor + a slab under the walkway
    block(0, 0, 50, 50, -1.2, 1.2, { mat: 'asphalt', color: '#cfc7bd' }),
    // raised ring walkway (solid decks; the inner faces are paintable metal)
    box(-22, 0, -22, 22, DECK, -19, { mat: 'metal', color: '#b9bcc8' }),
    box(-22, 0, 19, 22, DECK, 22, { mat: 'metal', color: '#b9bcc8' }),
    box(-22, 0, -19, -19, DECK, 19, { mat: 'metal', color: '#b9bcc8' }),
    box(19, 0, -19, 22, DECK, 19, { mat: 'metal', color: '#b9bcc8' }),
    // deck tops: wood planks
    box(-22, DECK, -22, 22, DECK + 0.08, -19, { mat: 'wood', color: '#d8b48a' }),
    box(-22, DECK, 19, 22, DECK + 0.08, 22, { mat: 'wood', color: '#d8b48a' }),
    box(-22, DECK, -19, -19, DECK + 0.08, 19, { mat: 'wood', color: '#d8b48a' }),
    box(19, DECK, -19, 22, DECK + 0.08, 19, { mat: 'wood', color: '#d8b48a' }),
    // ramps up to the walkway (south-west, rising west; north-east, rising east)
    ramp(-19, 0, 10, -12.5, DECK, 14, '-x', { mat: 'concrete', color: '#d6d0c6' }),
    ramp(12.5, 0, -14, 19, DECK, -10, '+x', { mat: 'concrete', color: '#d6d0c6' }),
    // container walls enclosing the yard
    ...containerWall(),
    // pillars with steel caps
    cyl(-10, 0, -7, 1.25, 6.5, { mat: 'concrete', color: '#e2dbd0', sides: 16 }),
    cyl(10, 0, -7, 1.25, 6.5, { mat: 'concrete', color: '#e2dbd0', sides: 16 }),
    cyl(-10, 0, 7, 1.25, 6.5, { mat: 'concrete', color: '#e2dbd0', sides: 16 }),
    cyl(10, 0, 7, 1.25, 6.5, { mat: 'concrete', color: '#e2dbd0', sides: 16 }),
    cyl(-10, 6.5, -7, 1.5, 0.5, { mat: 'metal', color: '#ffc53a', sides: 16 }),
    cyl(10, 6.5, -7, 1.5, 0.5, { mat: 'metal', color: '#ffc53a', sides: 16 }),
    cyl(-10, 6.5, 7, 1.5, 0.5, { mat: 'metal', color: '#ffc53a', sides: 16 }),
    cyl(10, 6.5, 7, 1.5, 0.5, { mat: 'metal', color: '#ffc53a', sides: 16 }),
    // cover: a single container (south-west) and a two-high pile (north-east, a vantage point)
    container(-12, 0, 15.2, '#2f7fd8'),
    container(12, 0, -15.2, '#e0612b'),
    container(12.4, 2.6, -15.2, '#35b56a'),
    // bollards along the walkway edge (low, paintable)
    ...[-15, -5, 5, 15].map((x) => cyl(x, DECK, -19.5, 0.28, 0.7, { mat: 'metal', color: '#ffc53a', sides: 10 })),
  ],
  preInk: [],
  entities: [
    ent('boss-grinder', 0, 0, -8, { yaw: 0, arena: { center: [0, 0, 0], half: [19, 19] } }),
    // walkway pickups (no checkpoints in boss arenas)
    ent('pearl-trail', -20.5, DECK + 0.1, -14, { to: [-20.5, DECK + 0.1, 8], count: 10 }),
    ent('pearl-trail', 20.5, DECK + 0.1, 16, { to: [20.5, DECK + 0.1, -6], count: 10 }),
    ent('pearl-trail', -8, DECK + 0.1, -20.5, { to: [8, DECK + 0.1, -20.5], count: 6 }),
    ent('pearl', 12.4, 5.3, -15.2), ent('pearl', 11.2, 5.3, -15.2), ent('pearl', 13.6, 5.3, -15.2),
    ent('postcard', 20.6, DECK, 20.6, { id: 'w1-boss', title: 'Championship Tickets', text: 'Got us two seats for the Turf Clash Final! Young Brine versus that fancy anglerfish kid. My money\'s on the shrimp.' }),
    // --- dressing (decor never collides inside the yard) ---
    D('crane', -8, 0, -34, { yaw: PI }), D('crane', 30, 0, 6, { yaw: -PI / 2 }), D('crane', -32, 0, -4, { yaw: PI / 2 }),
    D('lamp', -20.5, DECK, -20.5, { yaw: PI / 4 }), D('lamp', 20.5, DECK, -20.5, { yaw: -PI / 4 }),
    D('lamp', -20.5, DECK, 20.5, { yaw: 3 * PI / 4 }), D('lamp', 20.5, DECK, 20.5, { yaw: -3 * PI / 4 }),
    D('lamp', -20.8, DECK, 0, { yaw: PI / 2 }), D('lamp', 20.8, DECK, 0, { yaw: -PI / 2 }),
    D('railing', 0, DECK, -19.1, { length: 38 }), D('railing', 0, DECK, 19.1, { yaw: PI, length: 12 }),
    D('railing', -19.1, DECK, -4, { yaw: PI / 2, length: 26 }), D('railing', 19.1, DECK, 4, { yaw: -PI / 2, length: 26 }),
    D('barrel', -21, DECK, -8), D('barrel', -21.2, DECK, -7.1, { variant: 'toxic' }), D('barrel', 21.1, DECK, 10),
    D('crate-stack', 21, DECK, -16, { count: 3, yaw: 0.4 }), D('crate-stack', -21, DECK, 16, { count: 2, yaw: -0.3 }),
    D('tire-stack', 16, DECK, 21, { count: 3 }), D('cone', 13.5, DECK, 20.6), D('cone', -13.5, DECK, 20.6),
    D('flag', -21, DECK, -21.2, { color: '#ff8a1f' }), D('flag', 21, DECK, -21.2, { color: '#6a2bd9' }),
    D('speaker-tower', -6, DECK, -21, { height: 2.2 }), D('speaker-tower', 6, DECK, -21, { height: 2.2 }),
    D('neon-sign', 0, 5.2, -21.9, { text: 'YARD C', color: '#ffc53a', height: 1.2 }),
    D('billboard', -26, 5.2, 12, { yaw: PI / 2, text: 'Murk Industries' }),
    D('billboard', 26, 5.2, -12, { yaw: -PI / 2, text: 'Grayer is Better' }),
    D('graffiti', -18.95, 0, 4, { yaw: PI / 2, style: 'squid', size: 2.4, color: '#ff8a1f', color2: '#2fd6ff' }),
    D('graffiti', 18.95, 0, -2, { yaw: -PI / 2, text: 'SPLASH!', size: 3 }),
    D('antenna', 22.2, 5.2, 22.2, { height: 3 }), D('satellite', -22.3, 5.2, -22.3, { yaw: PI / 4 }),
    D('buoy', -30, -1.6, 30), D('buoy', 32, -1.6, 28, { color: '#2fb35a', light: '#ff3030' }), D('buoy', 30, -1.6, -32),
    D('hydrant', -18.4, 0, -18.4), D('cone', 17.6, 0, 17.6), D('cone', -17.4, 0, 17.8),
  ],
  route: [[0, 0, 15], [-11, 0, 12], [-20.5, DECK, 12], [-20.5, DECK, -20.5], [20.5, DECK, -20.5], [20.5, DECK, -12], [11, 0, -12], [0, 0, -2]],
};
