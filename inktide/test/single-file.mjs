// The double-click build (dist/INKTIDE.html from tools/build-single.mjs) opened straight from disk
// (file://, no server): boots to the title, reaches a story stage through the menus with a gamepad
// (story mode, not the sandbox fallback), and starts a Turf Clash match — with no errors.
//   node tools/build-single.mjs && node test/single-file.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { CHROME, root, report } from './harness.mjs';

const file = path.join(root, 'dist/INKTIDE.html');
if (!fs.existsSync(file)) { console.log('dist/INKTIDE.html missing: run node tools/build-single.mjs first'); process.exit(1); }
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /unavailable|fallback/i.test(m.text()))) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()}`));

let ok = true;
await page.goto('file://' + file + '?q=low');
await page.waitForFunction(() => window.__game && window.__game.frames > 5, null, { timeout: 120000 });
const r = await page.evaluate(async () => {
  const g = __game;
  const pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  g.input._injectPad(pad);
  const frames = (n) => new Promise((res) => { const f0 = g.frames; const f = () => (g.frames - f0 >= n ? res() : setTimeout(f, 4)); f(); });
  const until = async (fn, ms, what) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) throw new Error('timeout: ' + what + ' (top=' + (g.ui.top?.constructor?.name) + ')'); await frames(1); } };
  const set = (b, v) => { pad.buttons[b].pressed = v; pad.buttons[b].value = v ? 1 : 0; };
  const press = async (b) => { set(b, true); await frames(3); set(b, false); await frames(3); };
  const top = () => g.ui.top?.constructor?.name || null;
  const out = { fonts: [...document.fonts].filter((f) => f.status === 'loaded').length };
  await until(() => top() === 'TitleScreen', 60000, 'title');
  await frames(30); await press(0);
  await until(() => top() === 'MainMenuScreen', 10000, 'menu'); await frames(20); await press(0);
  await until(() => top() === 'StoryMapScreen', 10000, 'map'); await frames(20); await press(0);
  await until(() => top() === 'KitPickerScreen' || g.session, 10000, 'kits'); await frames(20);
  if (top() === 'KitPickerScreen') await press(0);
  await until(() => top() === 'ComicScreen' || g.session?.started, 90000, 'prologue/session');
  if (top() === 'ComicScreen') { set(1, true); await until(() => top() !== 'ComicScreen', 15000, 'skip'); set(1, false); }
  await until(() => g.session?.started, 90000, 'story session');
  out.story = { stage: g.session.opts.stageId, mode: g.session.mode?.constructor?.name };
  // wait out the intro, then pause -> QUIT TO MAP (D-pad down to it, confirm) -> B -> main menu
  const t1 = performance.now();
  while (g.session.mode?.currentObjective === undefined) {          // tap B through the intro chatter
    if (performance.now() - t1 > 60000) throw new Error('intro never finished');
    if (g.session.mode?.inCutscene) await press(1); else await frames(2);
  }
  await frames(20);
  // (a tutorial conversation may start right away and hold the pause: advance it like a player)
  const t2 = performance.now();
  while (top() !== 'PauseScreen') {
    if (performance.now() - t2 > 60000) throw new Error('pause never opened (busy=' + g.session.mode?.busy + ')');
    await press(g.session.mode?.busy ? (g.session.mode.inCutscene ? 1 : 0) : 9);
    await frames(4);
  }
  await frames(20);
  for (let k = 0; k < 8 && !g.ui.top.el.querySelector('.rail-item.focused[data-id="quit"]'); k++) await press(13);
  await press(0); await until(() => top() === 'ConfirmScreen', 5000, 'confirm'); await frames(10);
  for (let k = 0; k < 3 && !g.ui.top.el.querySelector('.btn-yes.focused'); k++) await press(14);
  await press(0); await until(() => top() === 'StoryMapScreen' && !g.session, 15000, 'map after quit');
  await frames(10); await press(1); await until(() => top() === 'MainMenuScreen', 5000, 'main menu');
  out.fontsAfter = [...document.fonts].filter((f) => f.status === 'loaded').length;
  return out;
}).catch((e) => ({ error: e.message }));
console.log(JSON.stringify(r));
ok &= report('single file boots from disk and reaches a story stage via the pad', !r.error && r.story?.stage === 'w1-1' && r.story?.mode === 'StoryMode', JSON.stringify(r.story || r.error));
ok &= report('embedded fonts load', (r.fontsAfter || r.fonts || 0) >= 4, `${r.fontsAfter ?? r.fonts} faces`);
const t = await page.evaluate(async () => {
  const g = __game;
  const frames = (n) => new Promise((res) => { const f0 = g.frames; const f = () => (g.frames - f0 >= n ? res() : setTimeout(f, 4)); f(); });
  const btn = document.querySelector('.rail-item[data-id="turf"]');
  if (!btn) return { error: 'no turf entry on the main menu (top=' + g.ui.top?.constructor?.name + ')' };
  btn.click(); await frames(30);
  const start = g.ui.top?.el?.querySelector('.btn-start');
  if (!start) return { error: 'no start button (top=' + g.ui.top?.constructor?.name + ')' };
  start.click();
  const t0 = performance.now();
  while (!g.session?.started) { if (performance.now() - t0 > 90000) return { error: 'turf did not start (top=' + g.ui.top?.constructor?.name + ')' }; await frames(2); }
  await frames(60);
  return { stage: g.session.opts.stageId, mode: g.session.mode?.constructor?.name, bots: g.session.actors.filter((a) => a.isBot).length };
}).catch((e) => ({ error: e.message }));
console.log(JSON.stringify(t));
ok &= report('turf clash starts with its bots', !t.error && t.mode === 'TurfMode' && t.bots >= 7, JSON.stringify(t));
ok &= report('no errors, no failed requests, no module fallbacks', !errors.length, errors.slice(0, 5).join(' | '));
await browser.close();
process.exit(ok ? 0 : 1);
