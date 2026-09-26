// INKTIDE entry point: load fonts, build the app, route to the title screen (or a dev stage).
import './weapons/index.js';
import './entities/index.js';
import { App } from './game/app.js';

// Host detection: the UWP shell injects window.GAME_HOST before any script runs. On Xbox the UI
// switches to the 10-foot layout (body.tv) and Quit is hidden (the guide button owns app exit).
const host = window.GAME_HOST || {};
export const IS_XBOX = host.deviceFamily === 'Windows.Xbox';
export const IN_SHELL = host.shell === 'uwp';
export const CAN_QUIT = IN_SHELL && !IS_XBOX;
if (IS_XBOX) document.body.classList.add('tv');

const bootFill = document.getElementById('boot-fill');
const bootEl = document.getElementById('boot');
const tips = [
  'Mixing the ink…',
  'Tip: hold Swim in your own ink to refill your tank fast.',
  'Tip: paint a wall, then swim straight up it.',
  'Tip: enemy ink slows you down — paint over it!',
  'Tip: inking turf charges your special.',
];
document.getElementById('boot-tip').textContent = tips[Math.floor(Math.random() * tips.length)];

function progress(p) { bootFill.style.width = `${Math.round(p * 100)}%`; }

async function boot() {
  progress(0.1);
  // fonts must be ready before any screen bakes text into the DOM
  await Promise.race([
    Promise.all(['Bungee', 'Lilita One', 'Baloo 2', 'Rubik Wet Paint'].map((f) => document.fonts.load(`32px "${f}"`))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  progress(0.4);
  const params0 = new URLSearchParams(location.search);
  // test/dev: force a quality preset without saving it (?q=low)
  if (params0.get('q')) { const { settings } = await import('./engine/settings.js'); settings.data.video.quality = params0.get('q'); }
  const app = new App();
  app.host = { IS_XBOX, IN_SHELL, CAN_QUIT };
  if (params0.get('render') === '0') app.renderer.enabled = false;
  progress(0.6);
  const params = new URLSearchParams(location.search);
  let ui = null;
  try { ui = await import('./ui/boot-ui.js'); } catch (e) { console.warn('UI layer unavailable', e); }
  progress(0.9);
  app.start();
  const stage = params.get('stage');
  if (stage) {
    await app.startSession({ stageId: stage, mode: ui?.modeFor ? await ui.modeFor(app, stage) : null, kit: params.get('kit') || undefined, lockPointer: false });
    if (params.get('god')) app.session.godMode = true;
  } else if (ui?.showTitle) {
    await ui.showTitle(app);
  }
  progress(1);
  bootEl.classList.add('done');
  setTimeout(() => bootEl.remove(), 600);
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('boot-tip').textContent = 'Failed to start: ' + e.message;
});
