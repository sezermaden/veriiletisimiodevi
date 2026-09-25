// Persistent player settings. Read with settings.get('video.fov'), write with settings.set(...).
// Listeners fire on every change so systems (renderer, audio, input) can apply live.

const KEY = 'inktide.settings.v1';

export const INK_PALETTES = {
  tangerine: { name: 'Tangerine vs Violet', hero: '#ff8a1f', murk: '#6a2bd9' },
  magenta:   { name: 'Magenta vs Teal', hero: '#ff2fa0', murk: '#0fa39a' },
  lime:      { name: 'Lime vs Plum', hero: '#9dff2e', murk: '#8a1f8f' },
  cyan:      { name: 'Cyan vs Crimson', hero: '#22d8ff', murk: '#c21f4a' },
  // colour-blind friendly: blue/yellow separation survives protanopia, deuteranopia and tritanopia well
  colorblind: { name: 'Colour-blind (Yellow vs Blue)', hero: '#ffd400', murk: '#1f4fff' },
};

/** Team colour pairs for Turf Clash (alpha = player team). */
export const TURF_PALETTES = [
  { a: '#ff8a1f', b: '#2d6bff' },
  { a: '#ff2fa0', b: '#23d18b' },
  { a: '#ffd400', b: '#7c3aed' },
  { a: '#22d8ff', b: '#ff4d2e' },
  { a: '#b6ff2e', b: '#e02fd0' },
];

export const DEFAULTS = {
  audio: { master: 0.8, music: 0.65, sfx: 0.9, voice: 0.8 },
  controls: {
    mouseSens: 1.0,
    padSens: 1.0,
    invertY: false,
    invertX: false,
    aimAssist: true,
    swimToggle: false,
    rumble: true,
    bindings: {},        // action -> { keys:[], pad:[] } overrides
  },
  video: {
    quality: 'high',     // low | medium | high | ultra
    renderScale: 1,
    fov: 72,
    cameraShake: 1,
    showFps: false,
    motionFx: true,
  },
  gameplay: {
    inkPalette: 'tangerine',
    subtitleSize: 'medium', // small | medium | large
    hints: true,
    hudScale: 1,
  },
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!over || typeof over !== 'object') return out;
  for (const k of Object.keys(over)) {
    const b = base?.[k];
    const o = over[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && o && typeof o === 'object' && !Array.isArray(o)) out[k] = deepMerge(b, o);
    else out[k] = o;
  }
  return out;
}

class Settings {
  constructor() {
    this.data = deepMerge(DEFAULTS, {});
    this._listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = deepMerge(DEFAULTS, JSON.parse(raw));
    } catch { /* private mode or corrupted: defaults */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  get(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.data);
  }

  set(path, value) {
    const keys = path.split('.');
    let o = this.data;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] ??= {};
    o[keys[keys.length - 1]] = value;
    this.save();
    for (const fn of this._listeners) fn(path, value);
  }

  reset(section) {
    if (section) this.data[section] = deepMerge(DEFAULTS[section], {});
    else this.data = deepMerge(DEFAULTS, {});
    this.save();
    for (const fn of this._listeners) fn(section || '*', null);
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  inkColors() {
    return INK_PALETTES[this.get('gameplay.inkPalette')] || INK_PALETTES.tangerine;
  }
}

export const settings = new Settings();
