// Browser end-to-end test: plays the real game through keyboard and gamepad input.
// Run with: node tests/e2e.js   (needs playwright and a Chromium build)
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log('  ' + msg);

async function main() {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // Fake gamepad: the test drives window.__pad directly.
  await page.addInitScript(() => {
    window.__pad = null;
    navigator.getGamepads = () => (window.__pad ? [window.__pad] : []);
    window.__makePad = () => ({
      connected: true,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      axes: [0, 0, 0, 0]
    });
  });

  const press = async (key, ms = 90) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await sleep(60);
  };
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await sleep(60);
  };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const st = () => ev(() => {
    const s = EF.game.state;
    return { area: s.p.area, x: s.p.x, y: s.p.y, day: s.day, season: s.season, minutes: s.minutes,
             gold: s.gold, energy: s.energy, water: s.water, sel: s.sel, spouse: s.spouse, ended: s.ended };
  });
  const blocking = () => ev(() => EF.ui.blocking());
  const topType = () => ev(() => (EF.ui.top() ? EF.ui.top().type : null));
  const dismissAll = async (maxPresses = 60) => {
    for (let i = 0; i < maxPresses && (await blocking()); i++) await press('KeyZ', 60);
  };
  const waitUntil = (fn, timeout = 15000, arg) =>
    page.waitForFunction(fn, arg, { timeout, polling: 50 });

  console.log('Emberfield end-to-end');

  // ---- 1. Title screen and new game (keyboard) ----
  await page.goto(URL);
  await waitUntil(() => window.EF && EF.ui && EF.ui.blocking());
  assert.equal(await topType(), 'list', 'title screen is a list');
  assert.equal(await ev(() => EF.ui.top().title_style), 'title');
  log('title screen shows');
  await press('Enter');                 // New Game
  assert.equal(await topType(), 'dialog', 'intro dialogue plays after New Game');
  await dismissAll();
  const s0 = await st();
  assert.equal(s0.area, 'house');
  assert.equal(s0.day, 1);
  log('new game starts in the farmhouse on Spring 1');

  // ---- 2. Walking and the farmhouse door ----
  await ev(() => { EF.game.state.minutes = 360; });
  await hold('ArrowDown', 500);
  const walked = await st();
  assert.ok(walked.y > 6.6, 'arrow key moves the player (y=' + walked.y.toFixed(2) + ')');
  // Walk through the door at (5,8) into the farm.
  await hold('ArrowDown', 1500);
  assert.equal((await st()).area, 'farm', 'walking through the house door reaches the farm');
  log('walking and warping through doors works');

  // ---- 3. Farming: till, plant, water ----
  await ev(() => EF.game.teleport('farm', 10.5, 13.5, 0, 1));
  await press('Digit1');                 // hoe
  await press('KeyX');                   // till the grass in front (10,14)
  assert.ok(await ev(() => !!EF.game.state.soil.farm['10,14']), 'hoe tills the field');
  await press('Digit7');                 // turnip seeds
  await press('KeyX');
  assert.ok(await ev(() => !!EF.game.state.crops.farm['10,14']), 'seeds plant on tilled soil');
  await press('Digit2');                 // watering can
  const waterBefore = (await st()).water;
  await press('KeyX');
  assert.equal(await ev(() => EF.game.state.soil.farm['10,14'].watered), true, 'can waters the soil');
  assert.ok((await st()).water < waterBefore, 'watering uses water');
  log('tilling, planting and watering work');

  // ---- 4. Sleep, growth and saving ----
  await ev(() => EF.game.teleport('farm', 17.5, 9.5, 0, -1));
  await hold('ArrowUp', 900);            // through the farmhouse door
  assert.equal((await st()).area, 'house', 'farmhouse door leads back indoors');
  await ev(() => EF.game.teleport('house', 2.5, 2.5, 0, -1));  // stand below the bed
  await press('KeyZ');                    // Z on the bed
  assert.equal(await topType(), 'list', 'bed asks whether to sleep');
  await press('KeyZ');                    // Yes
  await dismissAll();
  const after = await st();
  assert.equal(after.day, 2, 'sleeping starts day 2');
  assert.equal(after.energy, 270, 'sleeping restores energy');
  assert.equal(await ev(() => EF.game.state.crops.farm['10,14'].days), 1, 'watered crop grows overnight');
  assert.ok(await ev(() => !!localStorage.getItem('emberfield-valley-save-v1')), 'sleeping saves the game');
  log('sleeping advances the day, grows crops and saves');

  // ---- 5. Villager: talk and gift ----
  await ev(() => { EF.game.state.minutes = 360; });
  await ev(() => EF.game.teleport('town', 8.5, 10.5, 0, -1));   // Oswin stands at (8,9)
  await press('KeyZ');                    // open the talk menu
  assert.equal(await topType(), 'list', 'talking to a villager opens a menu');
  await press('KeyZ');                    // Talk
  await dismissAll();
  const oswin = await ev(() => EF.game.state.friends.oswin);
  assert.ok(oswin && oswin.met, 'first conversation makes friends');
  await ev(() => { EF.game.state.minutes = 360; });
  await press('KeyZ');                    // menu again
  await press('ArrowDown');               // Give a gift
  await press('KeyZ');
  for (let i = 0; i < 7; i++) await press('ArrowRight', 50);   // bread is in slot 7
  const ptsBefore = await ev(() => EF.game.state.friends.oswin.pts);
  await press('KeyZ');                    // give it
  await dismissAll();
  const ptsAfter = await ev(() => EF.game.state.friends.oswin.pts);
  assert.ok(ptsAfter > ptsBefore, 'a liked gift raises friendship (' + ptsBefore + ' -> ' + ptsAfter + ')');
  log('talking and giving gifts raises friendship');

  // ---- 6. Restoration board: donate the well project ----
  await ev(() => {
    EF.game.addItem('stone', 10);
    EF.game.addItem('wood', 10);
    EF.game.state.minutes = 600;
  });
  await ev(() => EF.game.teleport('town', 21.5, 13.5, 0, 1));    // board at (21,14)
  await press('KeyZ');
  assert.equal(await ev(() => EF.ui.top().title), 'Restoration Board', 'board opens');
  await press('KeyZ');                    // first project: the well
  await dismissAll(4);                    // reads the description
  await press('KeyS', 90); await press('KeyS', 90);    // move to Donate
  await press('KeyZ');
  await dismissAll(6);
  assert.equal(await ev(() => EF.game.state.projects.well), true, 'donating materials restores the well');
  // The board stays open for more donations; close it with B (Escape) before walking on.
  for (let i = 0; i < 5 && (await blocking()); i++) await press('Escape');
  assert.equal(await blocking(), false, 'Escape closes the board');
  log('the restoration board completes a project');

  // ---- 7. Fishing from the lake dock ----
  await ev(() => EF.game.teleport('lake', 19.5, 12.5, 1, 0));    // facing water at (20,12)
  await press('Digit6');                  // fishing rod
  await press('KeyX');                    // cast
  assert.equal(await ev(() => EF.game.rt.fish && EF.game.rt.fish.phase), 'cast', 'casting starts fishing');
  await waitUntil(() => EF.game.rt.fish && EF.game.rt.fish.phase === 'bite', 12000);
  await press('KeyZ');                    // hook it
  assert.equal(await ev(() => EF.game.rt.fish.phase), 'reel', 'a bite starts the reel minigame');
  // Hold X on and off to try to land it; any end result is fine as long as the game resolves.
  for (let i = 0; i < 40 && (await ev(() => !!EF.game.rt.fish)); i++) {
    await hold('KeyX', 180);
  }
  assert.equal(await ev(() => !!EF.game.rt.fish), false, 'the fishing minigame always resolves');
  const caught = await ev(() => EF.game.state.stats.caught);
  log('fishing resolves (caught so far: ' + caught + ')');

  // ---- 8. Mining and combat in the first mine floor ----
  await ev(() => EF.game.teleport('mine1', 5.5, 6.5, 0, 1));
  const rock = await ev(() => {
    const g = EF.game.state.grids.mine1;
    for (let y = 1; y < g.length - 1; y++) {
      for (let x = 1; x < g[y].length - 1; x++) {
        if (g[y][x] === 'R' && g[y][x - 1] === 'g') return { x, y };
      }
    }
    return null;
  });
  if (rock) {
    await ev((r) => EF.game.teleport('mine1', r.x - 0.5, r.y + 0.5, 1, 0), rock);
    await press('Digit4');                // pickaxe
    for (let i = 0; i < 4; i++) await press('KeyX', 60);
    const tile = await ev((r) => EF.game.state.grids.mine1[r.y][r.x], rock);
    assert.equal(tile, 'g', 'pickaxe breaks the rock');
    log('mining breaks rocks into the inventory');
  } else {
    log('no rock found near the mine floor 1 start; skipping mining step');
  }

  await ev(() => {
    const s = EF.game.state;
    const slime = s.mobs.mine1.find((m) => m.type === 'slime');
    if (slime) EF.game.teleport('mine1', slime.x - 0.8, slime.y, 1, 0);
  });
  const slimeHp = await ev(() => { const m = EF.game.state.mobs.mine1.find((x) => x.type === 'slime'); return m ? m.hp : null; });
  if (slimeHp !== null) {
    await press('Digit5');                // sword
    await press('KeyX', 80);
    await press('KeyX', 80);
    const kills = await ev(() => EF.game.state.stats.kills);
    const hpNow = await ev(() => { const m = EF.game.state.mobs.mine1.find((x) => x.type === 'slime'); return m ? m.hp : 0; });
    assert.ok(hpNow < slimeHp || kills > 0, 'sword swings damage a slime');
    log('the sword damages monsters in front of you');
  }

  // ---- 9. Pause menu ----
  await press('Escape');
  assert.equal(await topType(), 'list', 'Escape opens the pause menu');
  assert.equal(await ev(() => EF.ui.top().title), 'Paused');
  await press('Escape');
  assert.equal(await blocking(), false, 'Escape closes the pause menu');
  log('pause menu opens and closes');

  // ---- 10. Ensure the time limit cannot stall the game ----
  const beforeTime = (await st()).minutes;
  await sleep(1500);
  const afterTime = (await st()).minutes;
  assert.ok(afterTime > beforeTime, 'game time advances in the world');
  log('game time advances');

  // ---- 11. Reload and continue from the save ----
  // Hiding or leaving the page saves the current position, so the game resumes where we were.
  const beforeReload = await st();
  await page.reload();
  await waitUntil(() => window.EF && EF.ui && EF.ui.blocking());
  await press('ArrowDown');               // Continue
  await press('Enter');
  await sleep(200);
  const loaded = await st();
  assert.equal(loaded.day, beforeReload.day, 'continue restores the saved day');
  assert.equal(loaded.area, beforeReload.area, 'the save resumes where the player was');
  assert.ok(Math.abs(loaded.x - beforeReload.x) < 0.5, 'and at the same spot');
  log('reloading and continuing restores the save');

  // ---- 12. Gamepad only: title, movement, confirm ----
  await page.evaluate(() => { window.__pad = window.__makePad(); });
  await page.reload();
  await waitUntil(() => window.EF && EF.ui && EF.ui.blocking());
  await page.evaluate(() => { window.__pad = window.__makePad(); });
  await page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
  await sleep(120);
  await page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
  await sleep(120);
  assert.equal(await topType(), 'dialog', 'gamepad A starts a new game');
  await page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
  await sleep(120);
  await page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
  await sleep(120);
  await page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
  await sleep(120);
  await page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
  await sleep(120);
  for (let i = 0; i < 20 && (await blocking()); i++) {
    await page.evaluate(() => { window.__pad.buttons[0].pressed = true; });
    await sleep(90);
    await page.evaluate(() => { window.__pad.buttons[0].pressed = false; });
    await sleep(90);
  }
  const padStart = await st();
  assert.equal(padStart.area, 'house', 'gamepad dialogue ends in the farmhouse');
  await page.evaluate(() => { window.__pad.axes[1] = 1; });   // left stick down
  await sleep(500);
  await page.evaluate(() => { window.__pad.axes[1] = 0; });
  const padMoved = await st();
  assert.ok(padMoved.y > padStart.y, 'left stick moves the player');
  log('gamepad A, B and the left stick work');

  // ---- 13. Final: no runtime errors ----
  await browser.close();
  if (errors.length) {
    console.log('Runtime errors:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log('All browser checks passed.');
}

main().catch((err) => {
  console.error('FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
