// 3-B Sludge Serpent — an octagonal refinery platform over a sea of sludge. Four brimming sludge
// vats sit on the diagonals (the Serpent dives between them); four islands on the axes are joined
// to the platform by grate ramps (the Serpent's circling path in phase 3 crosses them) and by
// squid launch pads in both directions.
//   Platform: octagon r 9.5 at y 0. Islands: 8×8 at distance 20, y 1.5. Vat sludge y 3.2.
import { block, cyl, ramp, prism, ent } from '../kit.js';

const PI = Math.PI;
const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });
const V = 13.4;           // vat offset on each axis (distance ≈ 19)
const VR = 4.3;
const SLUDGE = 3.2;
const IS = 20;            // island centre distance
const IY = 1.5;

function octagon(r) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = PI / 8 + (i * PI) / 4; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return pts;
}

function vat(x, z) {
  return [
    cyl(x, -3, z, VR, SLUDGE - 0.2 + 3, { mat: 'metal', color: '#8d93a6', paint: false, sides: 24 }),
    cyl(x, SLUDGE - 0.45, z, VR + 0.25, 0.45, { mat: 'metal', color: '#ffc53a', paint: false, sides: 24 }),
    cyl(x, 0.6, z, VR + 0.08, 0.35, { mat: 'metal', color: '#3b3450', paint: false, sides: 24 }),
    cyl(x, -1.6, z, VR + 0.08, 0.35, { mat: 'metal', color: '#3b3450', paint: false, sides: 24 }),
  ];
}

function island(cx, cz) {
  return [
    block(cx, cz, 8, 8, -3, 3 + IY, { mat: 'concrete', color: '#9ea6b3' }),
    block(cx, cz, 8.4, 8.4, IY - 0.12, 0.12, { mat: 'metal', color: '#6f7a8c' }),
  ];
}

export default {
  id: 'w3-boss',
  name: 'Sludge Serpent',
  world: 3,
  theme: 'refinery',
  music: 'boss',
  waterY: -1.5,
  killY: -4,
  spawn: { pos: [0, 0, 6], yaw: PI },
  objective: 'Defeat the Sludge Serpent',
  brushes: [
    // central platform
    prism(octagon(9.5), -3, 0, { mat: 'metal', color: '#aab2c0' }),
    prism(octagon(7.2), 0, 0.05, { mat: 'concrete', color: '#c8ccd4' }),
    // cover: pipe junction boxes + a central valve stack
    block(-4.2, -4.2, 2, 2, 0, 1.2, { mat: 'metal', color: '#7d8799' }),
    block(4.2, 4.2, 2, 2, 0, 1.2, { mat: 'metal', color: '#7d8799' }),
    block(4.2, -4.2, 2.4, 1.2, 0, 1.0, { mat: 'metal', color: '#7d8799' }),
    block(-4.2, 4.2, 1.2, 2.4, 0, 1.0, { mat: 'metal', color: '#7d8799' }),
    cyl(0, 0, 0, 1.1, 1.8, { mat: 'metal', color: '#e0b64e', sides: 16 }),
    // islands on the axes
    ...island(IS, 0), ...island(-IS, 0), ...island(0, IS), ...island(0, -IS),
    // grate ramps from the platform to the islands (unpaintable)
    ramp(8.7, IY - 1.5, -1.5, 16, IY, 1.5, '+x', { mat: 'grate' }),
    ramp(-16, IY - 1.5, -1.5, -8.7, IY, 1.5, '-x', { mat: 'grate' }),
    ramp(-1.5, IY - 1.5, 8.7, 1.5, IY, 16, '+z', { mat: 'grate' }),
    ramp(-1.5, IY - 1.5, -16, 1.5, IY, -8.7, '-z', { mat: 'grate' }),
    // island cover walls (paintable; climb onto them for a better angle)
    block(IS + 2.6, 0, 1, 4, IY, 1.6, { mat: 'brick', color: '#b58c7a' }),
    block(-IS - 2.6, 0, 1, 4, IY, 1.6, { mat: 'brick', color: '#b58c7a' }),
    block(0, IS + 2.6, 4, 1, IY, 1.6, { mat: 'brick', color: '#b58c7a' }),
    block(0, -IS - 2.6, 4, 1, IY, 1.6, { mat: 'brick', color: '#b58c7a' }),
    // the vats on the diagonals
    ...vat(V, -V), ...vat(V, V), ...vat(-V, V), ...vat(-V, -V),
  ],
  preInk: [
    { at: [IS, IY, 0], r: 2.4, team: 'hero' }, { at: [-IS, IY, 0], r: 2.4, team: 'hero' },
    { at: [0, IY, IS], r: 2.4, team: 'hero' }, { at: [0, IY, -IS], r: 2.4, team: 'hero' },
    { at: [0, 0, 6], r: 2.2, team: 'hero' },
  ],
  entities: [
    ent('boss-serpent', 0, 0, 0, { vats: [[V, 0, -V], [V, 0, V], [-V, 0, V], [-V, 0, -V]], vatR: VR, sludgeY: SLUDGE, seaY: -1.5, ring: 12 }),
    // launch pads: platform → islands and back
    ent('launchpad', 5.2, 0, -2.2, { target: [IS - 1, IY, 0] }),
    ent('launchpad', -5.2, 0, 2.2, { target: [-IS + 1, IY, 0] }),
    ent('launchpad', 2.2, 0, 5.2, { target: [0, IY, IS - 1] }),
    ent('launchpad', -2.2, 0, -5.2, { target: [0, IY, -IS + 1] }),
    ent('launchpad', IS + 1.5, IY, 2, { target: [4, 0, 1.5] }),
    ent('launchpad', -IS - 1.5, IY, -2, { target: [-4, 0, -1.5] }),
    ent('launchpad', -2, IY, IS + 1.5, { target: [-1.5, 0, 4] }),
    ent('launchpad', 2, IY, -IS - 1.5, { target: [1.5, 0, -4] }),
    // pickups
    ent('pearl-trail', IS - 2.5, IY + 0.1, -2.8, { to: [IS - 2.5, IY + 0.1, 2.8], count: 5 }),
    ent('pearl-trail', -IS + 2.5, IY + 0.1, -2.8, { to: [-IS + 2.5, IY + 0.1, 2.8], count: 5 }),
    ent('pearl-trail', -2.8, IY + 0.1, IS - 2.5, { to: [2.8, IY + 0.1, IS - 2.5], count: 5 }),
    ent('pearl', 0, IY + 1.8, -IS - 2.6), ent('pearl', IS + 2.6, IY + 1.8, 0),
    ent('postcard', -IS - 2.6, IY + 1.6, 0, { id: 'w3-boss', title: 'A Letter, Never Sent', text: 'Dear Brine. I\'m sorry I threw my trophy in the harbour. And your trophy. And the referee\'s whistle. You were better. There. I said it. Now I\'ll never send this.' }),
    // --- dressing ---
    D('chimney', 30, -1.5, -30, { scale: 2 }), D('chimney', -32, -1.5, 26, { scale: 2 }), D('chimney', 26, -1.5, 34, { scale: 1.6 }),
    D('vat', 34, -1.5, 4, { radius: 4, scale: 1.4 }), D('vat', -34, -1.5, -6, { radius: 4, scale: 1.4 }), D('vat', 6, -1.5, 36, { radius: 3.5, scale: 1.3 }), D('vat', -8, -1.5, -36, { radius: 3.5, scale: 1.3 }),
    D('pipe', IS + 3.8, IY, -3, { yaw: PI / 2, length: 3 }), D('pipe', -IS - 3.8, IY, 3, { yaw: PI / 2, length: 3 }),
    D('pipe', 3, IY, IS + 3.8, { length: 3 }), D('pipe', -3, IY, -IS - 3.8, { length: 3 }),
    D('lamp', IS + 3.2, IY, -3.2, { yaw: -PI / 2 }), D('lamp', -IS - 3.2, IY, 3.2, { yaw: PI / 2 }),
    D('lamp', 3.2, IY, IS + 3.2, { yaw: PI }), D('lamp', -3.2, IY, -IS - 3.2),
    D('lamp', 6.2, 0, -6.2, { yaw: -PI / 4 }), D('lamp', -6.2, 0, 6.2, { yaw: 3 * PI / 4 }),
    D('barrel', IS - 3, IY, 3, { variant: 'toxic' }), D('barrel', IS - 3.4, IY, 2.2, { variant: 'toxic' }), D('barrel', -IS + 3, IY, -3),
    D('barrel', -3, IY, IS - 3, { variant: 'toxic' }), D('barrel', 3, IY, -IS + 3),
    D('crate-stack', -IS + 3, IY, 3, { count: 2, yaw: 0.3 }), D('crate-stack', 3, IY, IS - 3, { count: 3, yaw: -0.2 }),
    D('antenna', IS + 3.5, IY, 3.5, { height: 3.5 }), D('antenna', -3.5, IY, -IS - 3.5, { variant: 'radar', height: 2.6 }),
    D('speaker-tower', -IS - 3.4, IY, -3.4, { height: 2.4, color: '#5fe08a' }), D('speaker-tower', 3.4, IY, IS + 3.4, { height: 2.4, color: '#5fe08a' }),
    D('railing', IS, IY, -3.95, { length: 7 }), D('railing', -IS, IY, 3.95, { yaw: PI, length: 7 }),
    D('railing', 3.95, IY, IS, { yaw: PI / 2, length: 7 }), D('railing', -3.95, IY, -IS, { yaw: -PI / 2, length: 7 }),
    D('neon-sign', IS + 3.1, IY + 1.6, 0, { yaw: -PI / 2, text: 'VAT 7', color: '#5fe08a', height: 0.4 }),
    D('billboard', 0, -1.5, -40, { text: 'Murk Industries' }), D('billboard', 40, -1.5, 0, { yaw: -PI / 2, text: 'Grayer is Better' }),
    D('flag', 7.6, 0, 0, { color: '#5fe08a' }), D('flag', -7.6, 0, 0, { color: '#6a2bd9' }),
  ],
  route: [[0, 0, 6], [0, 0, 8.4], [0, IY, 16.5], [0, IY, 19], [0, IY, 16.5], [0, 0, 8.4], [0, 0, 3]],
};
