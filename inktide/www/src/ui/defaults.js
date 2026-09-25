// Pristine copy of the settings defaults, taken when the UI layer loads.
// engine/settings.js builds settings.data with a shallow merge, so on a fresh profile its section
// objects ARE the DEFAULTS objects and every settings.set() also rewrites DEFAULTS — which makes
// settings.reset() restore the modified values. The Options screen resets from this snapshot instead.
import { DEFAULTS } from '../engine/settings.js';

export const PRISTINE_SETTINGS = structuredClone(DEFAULTS);
