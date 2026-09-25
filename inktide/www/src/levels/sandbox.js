// Test plaza: every movement feature in one place (used by tests and ?stage=sandbox).
import { block, box, ramp, rampC, cyl, stairs, container, murk, prism } from './kit.js';

export default {
  id: 'sandbox',
  name: 'Test Plaza',
  theme: 'plaza',
  music: 'hub',
  waterY: -1.5,
  killY: -6,
  spawn: { pos: [0, 0, 8], yaw: Math.PI },
  brushes: [
    // main floor (tiles) + border
    block(0, 0, 44, 44, -1, 1, { mat: 'tiles' }),
    // climbing wall and a raised deck behind it
    block(0, -14, 16, 2, 0, 5, { mat: 'brick' }),
    block(0, -19, 16, 8, 0, 5, { mat: 'concrete' }),
    // ramp up to a side ledge
    ramp(10, 0, -4, 16, 2.5, 6, '-z', { mat: 'concrete' }),
    block(13, -8, 6, 8, 0, 2.5, { mat: 'concrete' }),
    // stairs on the left
    stairs(-16, 0, -2, -10, 2, 4, '-z', { mat: 'wood' }),
    block(-13, -6, 6, 8, 0, 2, { mat: 'wood' }),
    // pillars
    cyl(-6, 0, 2, 0.9, 3.5, { mat: 'plaster', color: '#f5e9d8' }),
    cyl(6, 0, 2, 0.9, 3.5, { mat: 'plaster', color: '#f5e9d8' }),
    // containers
    container(-12, 0, 12, '#2f7fd8'),
    container(12, 0, 13, '#e0612b'),
    container(12, 2.6, 13, '#35b56a'),
    // low cover
    block(0, 4, 4, 1, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    block(-5, 10, 1, 4, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    block(5, 10, 1, 4, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    // unpaintable grate walkway
    box(-20, -0.2, -20, -16, 0.05, 20, { mat: 'grate' }),
    // floating hex platform
    prism([[0, -2], [1.7, -1], [1.7, 1], [0, 2], [-1.7, 1], [-1.7, -1]].map(([x, z]) => [x - 14, z + 14]), 2.2, 2.8, { mat: 'metal' }),
    // gentle slope
    rampC(0, 17, 8, 6, 0, 1.2, '+z', { mat: 'asphalt' }),
    block(0, 21, 8, 2, 0, 1.2, { mat: 'asphalt' }),
  ],
  preInk: [murk(6, 0, -6, 2.5), murk(-8, 0, 6, 1.8), murk(0, 0, 18, 2)],
  entities: [],
};
