// Pristine copy of the settings defaults, taken when the UI layer loads.
// The Options screen resets a section by settings.set()-ing every key from this snapshot instead of
// calling settings.reset(section): reset() notifies listeners with the bare section name ('video'),
// which the renderer and other per-key listeners ('video.quality', …) do not react to, while per-key
// sets apply every change live. (engine/settings.js now deep-clones DEFAULTS, so the snapshot is
// no longer needed as a guard against mutated defaults, but it is kept as the single source here.)
import { DEFAULTS } from '../engine/settings.js';

export const PRISTINE_SETTINGS = structuredClone(DEFAULTS);
