// Developer test range for the Murk Corps roster: one of every enemy type in a small walled
// arena with cover, a raised sniper deck and a ledge (ledge-safety test). ?stage=test-enemies
import { block, box, rampC, cyl, container, murk, heroInk, ent } from '../kit.js';

export default {
  id: 'test-enemies',
  name: 'Murk Corps Test Range',
  theme: 'docks',
  music: 'hub',
  waterY: -1.5,
  killY: -6,
  spawn: { pos: [0, 0, 19], yaw: Math.PI },
  objective: 'Test range: splat the Murk Corps',
  brushes: [
    // floor + perimeter walls
    block(0, 0, 50, 50, -1, 1, { mat: 'tiles' }),
    box(-25, 0, -25, 25, 3, -24, { mat: 'brick' }),
    box(-25, 0, 24, 25, 3, 25, { mat: 'brick' }),
    box(-25, 0, -24, -24, 3, 24, { mat: 'brick' }),
    box(24, 0, -24, 25, 3, 24, { mat: 'brick' }),
    // low cover
    block(-4, 10, 3, 0.8, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    block(5, 11, 0.8, 3, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    block(0, -4, 4, 0.8, 0, 1.1, { mat: 'concrete', color: '#dcd6cc' }),
    cyl(-8, 0, -2, 0.8, 3, { mat: 'plaster', color: '#f5e9d8' }),
    cyl(8, 0, -3, 0.8, 3, { mat: 'plaster', color: '#f5e9d8' }),
    // sniper deck (north-west) with a ramp
    block(-14, -14, 9, 8, 0, 2.5, { mat: 'metal' }),
    rampC(-14, -7, 4, 6, 0, 2.5, '-z', { mat: 'concrete' }),
    // ledge deck (east) — the bomblob must never walk off it
    block(15, 2, 7, 7, 0, 1.6, { mat: 'wood' }),
    // containers
    container(-15, 0, 12, '#2f7fd8'),
    container(16, 0, 14, '#e0612b', 1),
  ],
  preInk: [murk(12, 0, -14, 2.2), heroInk(0, 0, 16, 2.4), murk(-14, 2.5, -14, 1.8)],
  entities: [
    ent('glooper', -5, 0, 5, { patrol: [[-5, 0, 5], [-1, 0, 6], [-3, 0, 1]], group: 'range' }),
    ent('glooper', 5, 0, 5, { group: 'range' }),
    ent('shield-glooper', 0, 0, 1, { group: 'range' }),
    ent('rollerbrute', 0, 0, -10, { group: 'range' }),
    ent('buzzdrone', 9, 0, 7, { alt: 4, group: 'range' }),
    ent('snipe-eel', -14, 2.5, -15, { group: 'range' }),
    ent('bomblob', 15, 1.6, 2, { yaw: -Math.PI / 2, group: 'range' }),
    ent('murk-turret', -13, 0, 5, { yaw: Math.PI / 4, group: 'range' }),
    ent('murk-pod', 13, 0, -15, { max: 2, interval: 5, group: 'range' }),
  ],
};
