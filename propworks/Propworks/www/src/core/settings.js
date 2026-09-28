/* Persistent settings and story progress. Everything goes through safeStore so a
   blocked or full localStorage degrades to "not remembered", never to a crash. */

const KEY_SETTINGS = 'propworks.settings.v1';
const KEY_SAVE = 'propworks.save.v1';

export const safeStore = {
  get(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};

export const DEFAULT_SETTINGS = {
  // video
  quality: 'high',          // low | medium | high | ultra
  renderScale: 1,
  fov: 80,
  shadows: true,
  bloom: true,
  ao: false,
  motionBlurViewmodel: true,
  viewBob: true,
  // audio
  master: 0.8,
  sfx: 0.9,
  music: 0.55,
  voice: 0.9,
  tts: true,
  // controls
  mouseSensitivity: 1.0,
  padSensitivity: 1.0,
  invertY: false,
  deadzone: 0.18,
  toggleCrouch: false,
  vibration: true,
  bindings: null,
  // gameplay
  difficulty: 'normal',     // easy | normal | hard
  subtitles: true,
  hints: true,
  crosshair: true,
  hud: true,
  showFps: false,
};

export const settings = { ...DEFAULT_SETTINGS, ...(safeStore.get(KEY_SETTINGS) || {}) };

export function saveSettings() { safeStore.set(KEY_SETTINGS, settings); }

export function resetSettings() {
  const keepBindings = settings.bindings;
  Object.assign(settings, DEFAULT_SETTINGS, { bindings: keepBindings });
  saveSettings();
}

/* ---------------------------------------------------------------- progress */
export const DEFAULT_SAVE = {
  chapter: 0,              // highest chapter unlocked (0-based)
  current: null,           // { chapter, checkpoint } of the run in progress
  completed: [],           // chapter ids finished
  finishedStory: false,
  logsFound: [],           // lore terminal ids
  stats: { propsSpawned: 0, welds: 0, kills: 0, deaths: 0, playSeconds: 0 },
};

export const progress = { ...structuredClone(DEFAULT_SAVE), ...(safeStore.get(KEY_SAVE) || {}) };
progress.stats = { ...DEFAULT_SAVE.stats, ...(progress.stats || {}) };

export function saveProgress() { safeStore.set(KEY_SAVE, progress); }

export function resetProgress() {
  Object.assign(progress, structuredClone(DEFAULT_SAVE));
  saveProgress();
}

export const DIFFICULTY = {
  easy: { damageTaken: 0.5, enemyHealth: 0.75, label: 'Easy' },
  normal: { damageTaken: 1, enemyHealth: 1, label: 'Normal' },
  hard: { damageTaken: 1.6, enemyHealth: 1.35, label: 'Hard' },
};
