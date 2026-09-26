// Stage registry. Each stage module default-exports a level definition (or a function returning one).
export const STAGE_LOADERS = {
  sandbox: () => import('./sandbox.js'),
  // story — world 1 Brinewater Docks
  'w1-1': () => import('./w1/w1-1.js'),
  'w1-2': () => import('./w1/w1-2.js'),
  'w1-3': () => import('./w1/w1-3.js'),
  'w1-boss': () => import('./w1/w1-boss.js'),
  // world 2 Coral Heights
  'w2-1': () => import('./w2/w2-1.js'),
  'w2-2': () => import('./w2/w2-2.js'),
  'w2-3': () => import('./w2/w2-3.js'),
  'w2-boss': () => import('./w2/w2-boss.js'),
  // world 3 Murk Refinery
  'w3-1': () => import('./w3/w3-1.js'),
  'w3-2': () => import('./w3/w3-2.js'),
  'w3-3': () => import('./w3/w3-3.js'),
  'w3-boss': () => import('./w3/w3-boss.js'),
  // world 4 Murkwell Tower
  'w4-1': () => import('./w4/w4-1.js'),
  'w4-2': () => import('./w4/w4-2.js'),
  'w4-boss': () => import('./w4/w4-boss.js'),
  // Turf Clash arenas
  'turf-pier': () => import('./turf/turf-pier.js'),
  'turf-skate': () => import('./turf/turf-skate.js'),
  'turf-refinery': () => import('./turf/turf-refinery.js'),
  // developer test rooms
  'test-enemies': () => import('./test/test-enemies.js'),
  'test-mechanics': () => import('./test/test-mechanics.js'),
  'test-weapons': () => import('./test/test-weapons.js'),
  'test-bosses': () => import('./test/test-bosses.js'),
};

/** Register more stages (story worlds, turf arenas). */
export function registerStages(map) { Object.assign(STAGE_LOADERS, map); }

export async function loadStage(id) {
  const loader = STAGE_LOADERS[id];
  if (!loader) throw new Error(`Unknown stage "${id}"`);
  const m = await loader();
  const def = typeof m.default === 'function' ? m.default() : m.default;
  return def;
}
