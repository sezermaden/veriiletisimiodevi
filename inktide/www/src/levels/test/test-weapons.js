// Developer weapon range: a flat, walled range with target dummies at 5 / 10 / 20 m straight ahead,
// a dummy behind a low wall (sloshers, blasters, bombs), a sliding dummy (tracking, lock-on), tall
// walls for sprinklers and climbing, and a sniper deck. ?stage=test-weapons&kit=<kitId>
import { block, box, rampC, cyl, container, murk, ent } from '../kit.js';

export default {
  id: 'test-weapons',
  name: 'Weapon Test Range',
  theme: 'plaza',
  music: 'hub',
  waterY: -1.5,
  killY: -6,
  spawn: { pos: [0, 0, 16], yaw: Math.PI },
  objective: 'Weapon range: test every kit on the dummies',
  brushes: [
    // floor + perimeter
    block(0, 0, 60, 60, -1, 1, { mat: 'tiles' }),
    box(-30, 0, -30, 30, 3.5, -29, { mat: 'brick' }),
    box(-30, 0, 29, 30, 3.5, 30, { mat: 'brick' }),
    box(-30, 0, -29, -29, 3.5, 29, { mat: 'brick' }),
    box(29, 0, -29, 30, 3.5, 29, { mat: 'brick' }),
    // lane markers (low curbs) either side of the centre lane
    block(-2.6, 3, 0.3, 22, 0, 0.12, { mat: 'concrete', color: '#e9e2d4' }),
    block(2.6, 3, 0.3, 22, 0, 0.12, { mat: 'concrete', color: '#e9e2d4' }),
    // low wall with a dummy hiding behind it (left lane)
    block(-6, 8.2, 4, 0.6, 0, 1.1, { mat: 'concrete', color: '#dcd6cc' }),
    // tall paint walls (left) for sprinklers / wall climbing
    block(-13, 4, 1, 10, 0, 4.5, { mat: 'plaster', color: '#f3ead9' }),
    block(-13, -10, 1, 6, 0, 3, { mat: 'brick' }),
    // pillars (right)
    cyl(8, 0, 10, 0.8, 3.2, { mat: 'plaster', color: '#f5e9d8' }),
    cyl(11, 0, -2, 0.8, 3.2, { mat: 'plaster', color: '#f5e9d8' }),
    // sniper deck with a ramp (back right)
    block(16, -16, 8, 6, 0, 2.4, { mat: 'metal' }),
    rampC(16, -10, 4, 6, 0, 2.4, '-z', { mat: 'concrete' }),
    // containers for cover at the far end
    container(-8, 0, -20, '#2f7fd8'),
    container(6, 0, -22, '#e0612b'),
  ],
  preInk: [murk(0, 0, 3, 2.2), murk(-8, 0, -4, 2.5), murk(10, 0, 6, 1.6)],
  entities: [
    // centre lane: 5 / 10 / 20 m
    ent('target-dummy', 0, 0, 11, { yaw: 0 }),
    ent('target-dummy', 0, 0, 6, { yaw: 0 }),
    ent('target-dummy', 0, 0, -4, { yaw: 0 }),
    // behind the low wall
    ent('target-dummy', -6, 0, 6.8, { yaw: 0 }),
    // sliding target (right)
    ent('target-dummy', 7, 0, 3, { yaw: 0, slide: { axis: [1, 0, 0], amp: 3, speed: 0.9 } }),
    // tanky dummy at the far right for splash/special tests
    ent('target-dummy', 12, 0, -8, { yaw: -0.5, hp: 300 }),
    // on the sniper deck
    ent('target-dummy', 16, 2.4, -17, { yaw: -0.6 }),
  ],
};
