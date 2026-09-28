/* Map registry: id -> builder(level, game, opts) returning the environment config. */
import { foundry, flatland } from './sandbox.js';
import { intake, fabrication, proving, archive, core } from './story.js';

export const MAPS = { foundry, flatland, intake, fabrication, proving, archive, core };
