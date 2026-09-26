// Registers every stage entity module (imported by entities/index.js).
import './sfx.js';
import './checkpoint.js';
import './prism-core.js';
import './pickups.js';
import './launchpad.js';
import './sponge.js';
import './ink-rail.js';
import './switch-gate.js';
import './mover.js';
import './murk-barrier.js';
import './crate.js';
import './balloon.js';
import './trigger.js';
import './spring.js';
import './decor.js';

export { spawnPearls, addPearls } from './pickups.js';
export { DECOR_KINDS, decorStats } from './decor.js';
