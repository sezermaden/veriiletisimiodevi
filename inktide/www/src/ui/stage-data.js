// Story structure for the menus: worlds, stage order, unlock rules and display metadata.
// Titles come from story/script.js STAGE_META when that module exists (loaded lazily, once);
// otherwise from the resolved spec (docs/spec-resolved.md).
import { save } from '../engine/save.js';
import { KITS } from '../weapons/base.js';

export const WORLDS = [
  { n: 1, id: 'w1', name: 'Brinewater Docks', setting: 'Piers, containers and cranes at sunset', stages: ['w1-1', 'w1-2', 'w1-3', 'w1-boss'], tone: 'docks' },
  { n: 2, id: 'w2', name: 'Coral Heights', setting: 'Rooftops, skateparks and neon gardens at dusk', stages: ['w2-1', 'w2-2', 'w2-3', 'w2-boss'], tone: 'heights' },
  { n: 3, id: 'w3', name: 'Murk Refinery', setting: 'Pipes, vats and conveyors in the toxic night', stages: ['w3-1', 'w3-2', 'w3-3', 'w3-boss'], tone: 'refinery' },
  { n: 4, id: 'w4', name: 'Murkwell Tower', setting: "The Baron's spire, deep in the storm", stages: ['w4-1', 'w4-2', 'w4-boss'], tone: 'tower' },
];

export const STAGE_ORDER = WORLDS.flatMap((w) => w.stages);

const FALLBACK = {
  'w1-1': { title: 'First Splash', blurb: 'Learn to ink, swim and climb as the Murk seeps onto the docks.' },
  'w1-2': { title: 'Container Crossing', blurb: 'Hop a maze of stacked containers while Gloopers patrol below.' },
  'w1-3': { title: 'Crane Climb', blurb: 'Paint your way up the giant harbour cranes to reach the core.' },
  'w1-boss': { title: 'The Grinder', blurb: 'A roller tank is flattening the docks. Stop it cold.' },
  'w2-1': { title: 'Rooftop Rush', blurb: 'Race across the Coral Heights rooftops as the sun goes down.' },
  'w2-2': { title: 'Skatepark Sprawl', blurb: 'Bounce, bowl and half-pipe through a skatepark overrun by Murk Corps.' },
  'w2-3': { title: 'Neon Gardens', blurb: 'Sponges, launch pads and glowing hedges under the neon signs.' },
  'w2-boss': { title: 'The Bucketeer', blurb: 'A flying bucket mech is sloshing Murk all over the Heights.' },
  'w3-1': { title: 'Sludge Lines', blurb: 'Ride the refinery conveyors without dropping into the sludge.' },
  'w3-2': { title: 'Pipe Dream', blurb: 'Climb the pipe forest and shut down the Murk valves.' },
  'w3-3': { title: 'Vat Valley', blurb: 'Cross the bubbling vats to reach the refinery core.' },
  'w3-boss': { title: 'Sludge Serpent', blurb: 'An eel mech coils through the vats. Paint it back to colour.' },
  'w4-1': { title: 'The Ascent', blurb: 'Scale Murkwell Tower in the teeth of the storm.' },
  'w4-2': { title: 'Gray Heart', blurb: 'Break into the Graytide Engine at the heart of the spire.' },
  'w4-boss': { title: 'Baron Murkwell', blurb: 'The Baron himself, at the helm of the Graytide Mech. Win back the last core!' },
};

export const TURF_ARENAS = [
  { id: 'turf-pier', name: 'Pier Nine', blurb: 'Long wooden piers over open water, stacked container cover and a raised centre deck. Watch the flanks.' },
  { id: 'turf-skate', name: 'Skate Canyon', blurb: 'Bowls, funboxes and raised decks. Fast lanes reward swimmers.' },
  { id: 'turf-refinery', name: 'Refinery Row', blurb: 'Tight pipe corridors around a raised central vat. Great for bombs.' },
];

let metaPromise = null;
let META = null;
/** Load story/script.js STAGE_META once (optional module written by the story layer). */
export function loadStageMeta() {
  if (!metaPromise) {
    metaPromise = import('../story/script.js')
      .then((m) => { META = m.STAGE_META || m.default?.STAGE_META || null; return META; })
      .catch(() => { META = null; return null; });
  }
  return metaPromise;
}

export function stageNum(id) {
  const m = /^w(\d)-(\w+)$/.exec(id);
  if (!m) return id;
  return m[2] === 'boss' ? `${m[1]}-B` : `${m[1]}-${m[2]}`;
}

export function worldOf(id) { return WORLDS.find((w) => w.stages.includes(id)) || null; }

export function isBoss(id) { return /-boss$/.test(id); }

/** {title, blurb, pearls?} merged from STAGE_META (if loaded) over the fallback. */
export function stageMeta(id) {
  const f = FALLBACK[id] || { title: id, blurb: '' };
  const turf = TURF_ARENAS.find((a) => a.id === id);
  if (turf) return { title: turf.name, blurb: turf.blurb };
  const m = META?.[id];
  if (!m || typeof m !== 'object') return f;
  return {
    ...f,
    title: m.bossName && !m.title ? m.bossName : (m.title || m.name || f.title),
    blurb: m.blurb || m.desc || m.description || m.summary || f.blurb,
    subtitle: typeof m.subtitle === 'string' ? m.subtitle : '',
    objective: typeof m.objective === 'string' ? m.objective : '',
    par: m.par ?? null,
    pearls: m.pearls ?? m.totalPearls ?? null,
  };
}

export function stageSave(id) { return save.data.stages?.[id] || null; }
export function isCleared(id) { return !!stageSave(id)?.done; }

/** A stage is open when it is the first one, or the previous stage in story order is done. */
export function isUnlocked(id) {
  const i = STAGE_ORDER.indexOf(id);
  if (i <= 0) return true;
  return isCleared(STAGE_ORDER[i - 1]) || isCleared(id);
}

export function stageState(id) { return isCleared(id) ? 'cleared' : isUnlocked(id) ? 'open' : 'locked'; }

export function worldUnlocked(w) { return isUnlocked(w.stages[0]); }

export function clearedCount() { return STAGE_ORDER.filter(isCleared).length; }

/** First open-but-not-cleared stage (the "continue" target). */
export function nextStage() { return STAGE_ORDER.find((id) => isUnlocked(id) && !isCleared(id)) || STAGE_ORDER[STAGE_ORDER.length - 1]; }

export function unlockText(kitId) {
  const u = KITS[kitId]?.unlock;
  if (!u) return '';
  return `Clear ${stageNum(u)} ${stageMeta(u).title}`;
}

export function kitUnlocked(kitId) {
  const u = KITS[kitId]?.unlock;
  return !u || (save.data.unlockedKits || []).includes(kitId) || isCleared(u);
}
