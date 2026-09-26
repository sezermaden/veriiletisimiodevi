// Test course for every stage object (?stage=test-mechanics).
//   Zone A  start plaza: checkpoint, pearl trail, intro trigger, balloons → gate G1
//   Zone B  switch S1 → gate G2, crates (group 'bx'), sponge ledge + postcard, spring tower, launchpad
//   Water   regular mover + ink-powered mover across the gap, launch tower with an ink rail down
//   Zone C  checkpoint 2, Murk barrier (drops when the 'bx' crates are broken)
//   Zone D  the Prism Core
//   East    decor gallery: every decor kind in a row (x ≈ 16), plus a crane, billboard and buoys
import { block, box, ent, heroInk } from '../kit.js';

const PI = Math.PI;
const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });

export default {
  id: 'test-mechanics',
  name: 'Mechanics Test Course',
  world: 0,
  theme: 'docks',
  music: 'docks',
  waterY: -2,
  killY: -6,
  spawn: { pos: [0, 0, 6], yaw: PI },
  objective: 'Reach the Prism Core',
  brushes: [
    // Zone A plaza + the wall with gate G1
    block(0, 0, 24, 20, -1, 1, { mat: 'tiles' }),
    block(-7.25, -10, 9.5, 1, 0, 4, { mat: 'brick' }),
    block(7.25, -10, 9.5, 1, 0, 4, { mat: 'brick' }),
    // little shop (awning, neon, roof props)
    block(-9.5, 6, 5, 6, 0, 4, { mat: 'plaster', color: '#f1dcc4' }),
    // Zone B yard
    block(0, -22.25, 24, 24.5, -1, 1, { mat: 'concrete' }),
    // sponge ledge (2.5 m) and spring tower (4.5 m)
    block(-8, -29, 6, 8, 0, 2.5, { mat: 'container', color: '#2f7fd8' }),
    block(3, -29, 4, 4, 0, 4.5, { mat: 'concrete', color: '#dcd6cc' }),
    // wall with gate G2 at the water's edge
    block(-7.25, -34, 9.5, 1, 0, 4, { mat: 'metal' }),
    block(7.25, -34, 9.5, 1, 0, 4, { mat: 'metal' }),
    // launch target tower standing in the water
    block(8, -44, 6, 6, -3, 9, { mat: 'container', color: '#e0612b' }),
    // Zone C + barrier walls, Zone D
    block(0, -56, 24, 20, -1, 1, { mat: 'asphalt' }),
    block(-7.6, -60, 8.8, 1, 0, 4, { mat: 'brick' }),
    block(7.6, -60, 8.8, 1, 0, 4, { mat: 'brick' }),
    block(0, -73, 16, 14, -1, 1, { mat: 'tiles' }),
    // east gallery strip + graffiti wall, west billboard lot, crane pier
    block(17, -20, 10, 52, -1, 1, { mat: 'wood' }),
    block(21.6, -20, 0.8, 12, 0, 3.2, { mat: 'concrete', color: '#e4e0d8' }),
    block(-19, -20, 8, 12, -1, 1, { mat: 'asphalt' }),
    box(25, -3, -58, 35, 0, -38, { mat: 'concrete' }),
  ],
  preInk: [heroInk(0, 0, 6, 2.4), heroInk(-2, 0, -2, 1.6)],
  entities: [
    // ---------------- Zone A ----------------
    ent('checkpoint', 3.5, 0, 3, { yaw: PI, id: 'cp1' }),
    ent('pearl-trail', -2, 0, 2, { to: [-2, 0, -6], count: 5 }),
    ent('trigger', 0, 0, 4, {
      size: [10, 3, 3], objective: 'Pop the Murk balloons', hint: '{fire} Shoot the balloons!',
      dialogue: [{ who: 'pix', text: 'Welcome to the test course, Kai! Pop those balloons.' }],
    }),
    ent('balloon', -4, 2.4, -5, { group: 'b1' }),
    ent('balloon', 0, 3.1, -6.5, { group: 'b1', move: [0, 0.8, 0], period: 3 }),
    ent('balloon', 4, 2.4, -5, { group: 'b1', pearls: 2 }),
    ent('gate', 0, 0, -10, { id: 'g1', size: [4, 3.2, 0.5], openOn: 'event:balloons:b1' }),
    D('graffiti', -7, 0, -9.48, { text: 'INK!', size: 3.2 }),
    D('graffiti', 7.2, 0, -9.48, { style: 'squid', size: 3, color: '#2fd6ff', color2: '#8a5bff' }),
    D('neon-sign', 3.6, 0, -9.48, { text: 'GATE', color: '#2fd6ff', height: 3.5 }),
    D('awning', -6.98, 0, 6, { yaw: PI / 2, length: 4, color: '#ff8a1f' }),
    D('neon-sign', -6.98, 0, 7.6, { yaw: PI / 2, text: 'SODA', color: '#ff4fd8', height: 3.4 }),
    D('vending', -6.5, 0, 3.2, { yaw: PI / 2, collide: true }),
    D('chimney', -10.6, 4, 7.6),
    D('satellite', -8.4, 4, 4.4, { yaw: PI / 3 }),
    D('antenna', -11, 4, 4.3, { variant: 'radar', height: 2.4 }),
    D('palm', -10.5, 0, -7.5), D('palm', 10.5, 0, -7.5), D('palm', 10.5, 0, 8.5),
    D('bush', 8.5, 0, 9), D('bush', -3.5, 0, 9.2, { flowerColor: '#ffd23f' }),
    D('flowerpot', 2, 0, 9.2), D('flowerpot', 3.2, 0, 9.2, { color: '#b98cff' }),
    D('bench', 6.5, 0, 9.2, { yaw: PI }),
    D('lamp', -5, 0, -8.6), D('lamp', 5, 0, -8.6),
    D('hydrant', 9.8, 0, 2),

    // ---------------- Zone B ----------------
    ent('switch', -4, 0, -13, { id: 's1', targets: ['g2'] }),
    ent('crate', 6, 0, -15, { group: 'bx', pearls: 2 }),
    ent('crate', 7.4, 0, -16.6, { group: 'bx', pearls: 2 }),
    ent('crate', 4.6, 0, -17.8, { size: 1, pearls: 3 }),
    ent('sponge', -8, 0, -23.4, { size: [2.4, 2.5, 2.4], id: 'sponge1' }),
    ent('postcard', -8, 2.5, -30, { id: 'test-card', title: 'Harbour Lights', text: 'The lighthouse hums at night. Grandpa says the colour comes from under it.' }),
    ent('spring', 3, 0, -25.8, { id: 'spring1' }),
    ent('pearl-trail', 2, 4.5, -28, { to: [4, 4.5, -30], count: 3 }),
    ent('launchpad', 9, 0, -22, { id: 'pad1', target: [8, 6, -43.2] }),
    ent('gate', 0, 0, -34, { id: 'g2', size: [4, 3.2, 0.5] }),
    D('crate-stack', 10, 0, -12.5, { yaw: 0.3 }),
    D('barrel', 10.6, 0, -15.2), D('barrel', 9.9, 0, -16), D('barrel', 10.8, 0, -16.4, { variant: 'toxic' }),
    D('tire-stack', 5.6, 0, -24.4, { count: 3 }), D('cone', 1.2, 0, -24.3), D('cone', 4.8, 0, -26.6),
    D('lamp', -11, 0, -18, { yaw: PI / 2 }), D('lamp', 11, 0, -26, { yaw: -PI / 2 }),
    D('railing', -10.8, 2.5, -29, { yaw: PI / 2, length: 7 }),
    D('fence', -11.5, 0, -14, { yaw: PI / 2, length: 6 }),

    // ---------------- water crossing ----------------
    ent('mover', -1.2, 0, -36, { size: [2.2, 0.5, 3], path: [[-1.2, 0, -36], [-1.2, 0, -44.5]], speed: 2.6, wait: 1.2, id: 'mover1' }),
    ent('mover', 1.2, 0, -36, { size: [2.2, 0.5, 3], path: [[1.2, 0, -36], [1.2, 0, -44.5]], speed: 3, activate: 'ink', id: 'mover2' }),
    ent('pearl-trail', 7, 6, -42, { to: [9, 6, -42], count: 3 }),
    ent('ink-rail', 8, 6.75, -46.6, { id: 'rail1', points: [[8, 6.75, -46.6], [6.5, 5.9, -49.5], [2, 4.2, -52.5], [-4, 2.6, -54], [-8.5, 1.4, -56.5]] }),
    D('buoy', -9, -2, -40), D('buoy', -15, -2, -31, { color: '#2fb35a', light: '#ff3030' }), D('buoy', -14.5, -2, -42),
    D('crane', 30, 0, -44, { yaw: -PI / 2 }),

    // ---------------- Zone C / D ----------------
    ent('checkpoint', 5, 0, -50, { yaw: PI, id: 'cp2' }),
    ent('trigger', 0, 0, -49, { size: [24, 4, 4], hint: 'Break the two marked crates back in the yard to drop the barrier.', event: 'reachedC' }),
    ent('murk-barrier', 0, 0, -60, { size: [6.4, 4, 0.4], group: 'bx', id: 'barrier1' }),
    ent('prism-core', 0, 0, -73.5, { id: 'core' }),
    D('flag', -5, 0, -68, { color: '#ff8a1f' }), D('flag', 5, 0, -68, { color: '#2fd6ff' }),
    D('speaker-tower', -6.5, 0, -77, { height: 3 }), D('speaker-tower', 6.5, 0, -77, { height: 3, color: '#ff4fd8' }),
    D('vat', -9, 0, -52, { collide: true }), D('pipe', 9, 0, -54, { yaw: PI / 2, length: 6, collide: true }),
    D('lamp', -3.8, 0, -63, { yaw: 0 }), D('lamp', 3.8, 0, -63, { yaw: 0 }),

    // ---------------- decor gallery (east strip) ----------------
    D('lamp', 16, 0, 3), D('barrel', 16, 0, 0.5), D('crate-stack', 16, 0, -2.5, { count: 4 }), D('bench', 16, 0, -6, { yaw: -PI / 2 }),
    D('palm', 16.5, 0, -9.5), D('bush', 16, 0, -12.5), D('flowerpot', 16, 0, -14.5),
    D('neon-sign', 16, 0, -17, { pole: true, text: 'INKTIDE', color: '#ffd23f', yaw: -PI / 2 }),
    D('vending', 16, 0, -20, { yaw: -PI / 2, color: '#2fb6ff' }), D('hydrant', 16, 0, -22), D('cone', 16, 0, -23.3),
    D('tire-stack', 16, 0, -25), D('railing', 16, 0, -28, { yaw: PI / 2, length: 3 }), D('fence', 16, 0, -32, { yaw: PI / 2, length: 4 }),
    D('flag', 16, 0, -35.5, { color: '#ff3fa4' }), D('antenna', 16, 0, -38.5), D('satellite', 16, 0, -41), D('chimney', 16, 0, -43.5),
    D('pipe', 19, 0, -7, { yaw: PI / 2, length: 5 }), D('vat', 19.5, 0, -13), D('speaker-tower', 19.5, 0, -30),
    D('graffiti', 21.18, 0, -17, { yaw: -PI / 2, text: 'SPLASH', size: 4 }),
    D('graffiti', 21.18, 0, -22.5, { yaw: -PI / 2, style: 'arrow', size: 3, color: '#ffd23f', color2: '#ff3f6c' }),
    D('awning', 21.18, 0, -25.5, { yaw: -PI / 2, length: 2.6, color: '#2fb6ff', height: 2.5 }),
    D('billboard', -19, 0, -20, { yaw: PI / 2, text: 'Squidberry Soda' }),
    D('billboard', 30, 0, -54, { yaw: -PI / 2 + 0.3, text: 'Murk Industries' }),
  ],
};
