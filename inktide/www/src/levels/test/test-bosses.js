// Boss test room (?stage=test-bosses).
//   ?stage=test-bosses               gallery: all four bosses, dormant (idle animation, no AI)
//   ?stage=test-bosses&boss=grinder  one live boss in a big flat walled arena
//                    (grinder | bucketeer | serpent | murkwell)
import { block, box, cyl, ent } from '../kit.js';

const PI = Math.PI;

function params() {
  try { return new URLSearchParams(globalThis.location?.search || ''); } catch { return new URLSearchParams(''); }
}

export default function testBosses() {
  const which = params().get('boss');
  const brushes = [
    block(0, 0, 90, 90, -1, 1, { mat: 'tiles', color: '#d9dde6' }),
    box(-45, 0, -45, 45, 2, -44, { mat: 'brick' }),
    box(-45, 0, 44, 45, 2, 45, { mat: 'brick' }),
    box(-45, 0, -44, -44, 2, 44, { mat: 'brick' }),
    box(44, 0, -44, 45, 2, 44, { mat: 'brick' }),
  ];
  const def = {
    id: 'test-bosses',
    name: 'Boss Test Room',
    theme: 'arena',
    music: 'boss',
    waterY: -2,
    killY: -8,
    spawn: { pos: [0, 0, 20], yaw: PI },
    objective: which ? `Test: ${which}` : 'Boss gallery',
    brushes,
    entities: [],
  };
  if (!which) {
    // gallery: four dormant bosses in a row, facing the camera at the spawn
    def.spawn = { pos: [0, 0, 26], yaw: PI };
    def.entities.push(
      ent('boss-grinder', -24, 0, 0, { yaw: 0.5, dormant: true }),
      ent('boss-bucketeer', -8, 0, -2, { yaw: 0.2, dormant: true }),
      ent('boss-serpent', 8, 0, -2, { yaw: -0.2, dormant: true }),
      ent('boss-murkwell', 25, 0, -4, { yaw: -0.4, dormant: true }),
    );
    return def;
  }
  if (which === 'grinder') {
    // a 38 m walled yard like 1-B, with two pillars to ram
    brushes.push(
      box(-20, 0, -20, 20, 3, -19, { mat: 'metal' }), box(-20, 0, 19, 20, 3, 20, { mat: 'metal' }),
      box(-20, 0, -19, -19, 3, 19, { mat: 'metal' }), box(19, 0, -19, 20, 3, 19, { mat: 'metal' }),
      cyl(-10, 0, -7, 1.25, 5), cyl(10, 0, 7, 1.25, 5),
    );
    def.spawn = { pos: [0, 0, 14], yaw: PI };
    def.entities.push(ent('boss-grinder', 0, 0, -8, { yaw: 0, arena: { center: [0, 0, 0], half: [19, 19] } }));
  } else if (which === 'bucketeer') {
    brushes.push(block(0, 0, 5, 5, 0, 5.5, { mat: 'brick' }));
    def.entities.push(ent('boss-bucketeer', 0, 0, 0, { yaw: 0, arena: { center: [0, 0, 0], radius: 12 }, tower: [0, 5.5, 0] }));
  } else if (which === 'serpent') {
    for (const [x, z] of [[0, -19], [19, 0], [0, 19], [-19, 0]]) brushes.push(cyl(x, 0, z, 4, 3.4, { mat: 'metal', paint: false }));
    def.entities.push(ent('boss-serpent', 0, 0, 0, { vats: [[0, 0, -19], [19, 0, 0], [0, 0, 19], [-19, 0, 0]], vatR: 4, sludgeY: 3.0, seaY: -1.5, ring: 13 }));
  } else if (which === 'murkwell') {
    def.entities.push(ent('boss-murkwell', 0, 0, -16, { yaw: 0, arena: { center: [0, 0, -2], half: [20, 18] } }));
  }
  return def;
}
