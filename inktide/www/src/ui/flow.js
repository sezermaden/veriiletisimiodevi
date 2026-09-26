// Navigation flow between the menus and gameplay: which mode runs a stage, starting/quitting
// sessions, and the menu backdrop. Re-exported by ui/boot-ui.js (the public entry point).
import { save } from '../engine/save.js';
import { settings } from '../engine/settings.js';
import { loadStage } from '../levels/index.js';
import { SandboxMode } from '../game/modes/sandbox.js';
import { MenuScene } from './menu-scene.js';
import { notify, setHome } from './widgets.js';
import { stageMeta } from './stage-data.js';
import { MainMenuScreen } from './main-menu.js';
import { StoryMapScreen } from './story-map.js';
import { PauseScreen } from './pause.js';

const modCache = new Map();
/** Import an optional module once; resolves null when it does not exist (yet). */
function tryImport(path) {
  if (!modCache.has(path)) {
    modCache.set(path, import(path).catch((e) => { console.warn(`[ui] optional module ${path} unavailable (${e?.message || e}); using a fallback`); return null; }));
  }
  return modCache.get(path);
}

/**
 * Subtitle size classes + the --ink-hero / --ink-murk tokens for the menus. During play the HUD
 * drives those tokens from the session's real team colours (Turf Clash uses its own pairs), and
 * they stay behind after the session ends — so every return to the menus re-applies the palette.
 */
function applyUiSettings() {
  const size = settings.get('gameplay.subtitleSize') || 'medium';
  document.body.classList.toggle('subs-small', size === 'small');
  document.body.classList.toggle('subs-large', size === 'large');
  // "Motion effects" off: looping menu animations play once (the menu camera stops drifting too)
  document.body.classList.toggle('reduce-motion', settings.get('video.motionFx') === false);
  const c = settings.inkColors();
  const root = document.documentElement.style;
  root.setProperty('--ink-hero', c.hero);
  root.setProperty('--ink-murk', c.murk);
}

let installed = false;
/** One-time wiring of the UI layer into the app. Safe to call repeatedly. */
export function install(app) {
  if (installed) return;
  installed = true;
  app.onPause = () => app.ui.push(new PauseScreen(app));
  setHome((a) => showMainMenu(a));
  applyUiSettings();
  settings.onChange((p) => { if (p.startsWith('gameplay') || p === 'video.motionFx' || p === '*') applyUiSettings(); });
}

/** The mode object for a stage: story (w*), turf (turf-*), else sandbox. Missing modules fall back. */
export async function modeFor(app, stageId, opts = {}) {
  install(app);
  if (/^w\d/.test(stageId)) {
    const m = await tryImport('../game/modes/story.js');
    if (m?.StoryMode) {
      try { return new m.StoryMode(app, stageId, opts); } catch (e) { console.warn('[ui] StoryMode failed, using sandbox', e); }
    }
  } else if (/^turf-/.test(stageId)) {
    const m = await tryImport('../game/modes/turf.js');
    if (m?.TurfMode) {
      try { return new m.TurfMode(app, stageId, opts); } catch (e) { console.warn('[ui] TurfMode failed, using sandbox', e); }
    }
  }
  return new SandboxMode(app, stageId, opts);
}

/** Pointer lock that never throws or leaves an unhandled rejection (headless, no gesture, …). */
export function safePointerLock(app) {
  if (app.input.lastDevice === 'gamepad') return;
  const el = app.canvas;
  try {
    const p = el.requestPointerLock?.({ unadjustedMovement: true });
    p?.catch?.(() => { try { el.requestPointerLock?.()?.catch?.(() => {}); } catch { /* ignore */ } });
  } catch { /* ignore */ }
}

let starting = false;
/**
 * Load and start a stage with the right mode. Returns the Session, or null (e.g. a stage that is
 * not built yet — the player gets a friendly notice instead of a dead screen).
 */
export async function startStage(app, stageId, opts = {}) {
  install(app);
  if (starting || app._busy) return null;
  starting = true;
  try {
    let levelDef;
    try {
      levelDef = await loadStage(stageId);
    } catch (e) {
      console.warn(`[ui] stage "${stageId}" is not available: ${e?.message || e}`);
      notify({ kind: 'warn', kicker: 'COMING SOON', title: stageMeta(stageId).title, text: 'This stage is still under construction.' });
      return null;
    }
    const mode = await modeFor(app, stageId, opts);
    const s = await app.startSession({ stageId, levelDef, mode, kit: opts.kit || save.data.kit, lockPointer: false, ...(opts.session || {}) });
    if (!s) {
      ensureMenuScene(app);
      notify({ kind: 'warn', title: 'Could not start the stage', text: 'Something went wrong while loading. Please try again.' });
      return null;
    }
    safePointerLock(app);
    return s;
  } finally {
    starting = false;
  }
}

export function ensureMenuScene(app) {
  if (!app.menuScene) new MenuScene(app);   // registers itself as app.menuScene
  else if (!app.session) app.menuScene.show();
  if (!app.session) applyUiSettings();       // take the menu tokens back from the last session's HUD
  return app.menuScene;
}

export function showMainMenu(app) {
  install(app);
  ensureMenuScene(app);
  app.ui.clear();
  return app.ui.push(new MainMenuScreen(app));
}

export function showStoryMap(app, focusStageId = null) {
  install(app);
  ensureMenuScene(app);
  app.ui.clear();
  app.ui.push(new MainMenuScreen(app));
  return app.ui.push(new StoryMapScreen(app, focusStageId));
}

/** End the running session and return to the story map (story stages) or the main menu. */
export async function quitToMenu(app, stageId = app.session?.opts?.stageId) {
  await app.fade(true, 320);
  app.ui.clear();
  app.endSession();
  if (stageId && /^w\d/.test(stageId)) showStoryMap(app, stageId);
  else showMainMenu(app);
  await app.fade(false, 380);
}
