// Pristine copy of the settings defaults, taken when the UI layer loads.
// The Options screen resets a section by settings.set()-ing every key from this snapshot, so each
// change applies live exactly like a manual edit. (settings.reset(section) now also notifies per
// key; the snapshot is kept as the single source the Options screen reads its defaults from.)
import { DEFAULTS } from '../engine/settings.js';

export const PRISTINE_SETTINGS = structuredClone(DEFAULTS);
