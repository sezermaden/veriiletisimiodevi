/* Verifies the single-file build boots and plays straight from file:// */
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, '../Propworks/dist/Propworks.html');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.stack || e.message)));

await page.goto(pathToFileURL(FILE).href, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 40000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.__game;
  g.settings.quality = 'low'; g.settings.qualityLocked = true; g.applySettings();
});

console.log('file:// boot ->', JSON.stringify(await page.evaluate(
  () => ({ state: window.__game.state, ui: window.__game.ui.name }))));

// keyboard reaches the pause menu from the title screen, single-file build
const press = async (k, n = 4) => {
  const s = await page.evaluate(() => window.__game.frames);
  await page.keyboard.press(k);
  await page.waitForFunction(([a, b]) => window.__game.frames >= a + b, [s, n], { timeout: 30000 });
};
await press('Enter');                                        // PLAY
await page.evaluate(() => {                                   // jump straight into a run
  const g = window.__game;
  g.selection = { character: 'puffy', map: 'cavern', difficulty: 2 };
  g.startRun();
});
await page.waitForTimeout(600);
await press('Escape', 5);
const paused = await page.evaluate(() => ({ state: window.__game.state, ui: window.__game.ui.name }));
console.log('Escape in dist ->', JSON.stringify(paused));
await press('Escape', 5);
const resumed = await page.evaluate(() => ({ state: window.__game.state, ui: window.__game.ui.name }));
console.log('Escape again  ->', JSON.stringify(resumed));

const play = await page.evaluate(() => {
  const g = window.__game;
  const stub = { move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, aimActive: false,
    mouse: { x: 0, y: 0, inside: false, down: false }, usingGamepad: false, mouseMovedRecently: 0 };
  let t = 0;
  for (let i = 0; i < 600; i++) {
    t += 1 / 30;
    stub.move.x = Math.cos(t); stub.move.y = Math.sin(t);
    g.run.hp = g.run.stats.maxHp;
    if (g.state !== 'playing') break;
    g.world.update(1 / 30, stub);
  }
  return { state: g.state, wave: g.run.wave, kills: g.run.stat.kills };
});
console.log('play ->', JSON.stringify(play));

const ok = paused.ui === 'pause' && resumed.state === 'playing';
console.log(ok ? 'PAUSE VIA KEYBOARD OK' : 'PAUSE FAILED IN DIST');
console.log(`ERRORS (${errors.length}):`);
errors.slice(0, 12).forEach(e => console.log('  ! ' + e));
await browser.close();
process.exit(!ok || errors.length ? 1 : 0);
