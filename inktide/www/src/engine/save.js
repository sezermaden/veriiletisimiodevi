// Player progress (one profile), autosaved to localStorage.

const KEY = 'inktide.save.v1';

export const DEFAULT_SAVE = {
  version: 1,
  pearls: 0,
  stages: {},               // stageId -> { done, bestTime, postcard, pearlsFound, rank }
  unlockedKits: ['splash-blaster'],
  kit: 'splash-blaster',
  upgrades: { tank: 0, swim: 0, armor: 0, special: 0 },
  flags: {},                // story flags: seenIntro, world2Unlocked, ...
  turf: { played: 0, wins: 0, losses: 0, bestPct: 0 },
  stats: { inkedM2: 0, splats: 0, splatted: 0, playSeconds: 0 },
  lastStage: null,
};

class SaveData {
  constructor() { this.data = structuredClone(DEFAULT_SAVE); this.load(); }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...structuredClone(DEFAULT_SAVE), ...JSON.parse(raw) };
    } catch { /* keep defaults */ }
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ } }

  reset() { this.data = structuredClone(DEFAULT_SAVE); this.save(); }

  get hasProgress() { return Object.keys(this.data.stages).length > 0 || !!this.data.flags.seenIntro; }

  stage(id) { return this.data.stages[id] || null; }

  completeStage(id, result) {
    const prev = this.data.stages[id] || {};
    this.data.stages[id] = {
      done: true,
      bestTime: prev.bestTime ? Math.min(prev.bestTime, result.time) : result.time,
      postcard: prev.postcard || !!result.postcard,
      pearlsFound: Math.max(prev.pearlsFound || 0, result.pearlsFound || 0),
      rank: bestRank(prev.rank, result.rank),
    };
    this.data.lastStage = id;
    this.save();
  }

  addPearls(n) { this.data.pearls = Math.max(0, (this.data.pearls || 0) + n); this.save(); }

  unlockKit(id) {
    if (!this.data.unlockedKits.includes(id)) { this.data.unlockedKits.push(id); this.save(); return true; }
    return false;
  }

  setFlag(k, v = true) { this.data.flags[k] = v; this.save(); }
  flag(k) { return !!this.data.flags[k]; }
}

const RANKS = ['C', 'B', 'A', 'S'];
function bestRank(a, b) {
  if (!a) return b;
  if (!b) return a;
  return RANKS.indexOf(a) >= RANKS.indexOf(b) ? a : b;
}

export const save = new SaveData();
