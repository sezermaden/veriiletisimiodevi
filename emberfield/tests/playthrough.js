// Full playthrough in the browser: a bot plays the whole game to the festival ending.
//
// The bot runs the game's own code for everything it does: chopping and mining (tool tiers, hits,
// drops, pack limits), smelting, tool upgrades, sword combat, every project donation, the mine
// gates and the ending. It only (a) grants starting gold and festival herbs/berries, which in a
// real game come from farming and foraging over many days, and (b) moves the player with
// teleport between tiles, the same tile the keys would reach. Two gate checks use real key presses.
//
// Run with: node tests/playthrough.js
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Helper library injected into the page once. Each function runs synchronously in the page,
// so no animation frames run in between and the mobs stay where the bot puts them.
const BOT_LIB = () => {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D = EF.D;
  const st = () => EF.game.state;
  const cnt = (id) => EF.game.countItem(id);
  const fill = () => { st().energy = 270; st().health = 100; st().minutes = 480; };

  const sel = (kind) => {
    const i = st().inv.findIndex((x) => x && D.items[x.id].kind === kind);
    if (i < 0 || i > 9) throw new Error('no ' + kind + ' on the hotbar');
    st().sel = i;
  };
  const tier = (kind) => {
    const x = st().inv.find((y) => y && D.items[y.id].kind === kind);
    return x ? D.items[x.id].tier : -1;
  };
  const slotOf = (kind) => st().inv.findIndex((x) => x && D.items[x.id].kind === kind);

  // Tiles the player can walk to from (sx, sy), treating solid tiles and unmined ore as walls.
  function reach(area, sx, sy) {
    const g = EF.game.grid(area), seen = new Set([sx + ',' + sy]), q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (ny < 0 || nx < 0 || ny >= g.length || nx >= g[0].length) continue;
        if (EF.world.isSolid(g[ny][nx])) continue;
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  // Break tiles of the given types with the given tool until `goal` ({item, qty}) is met,
  // or every reachable tile the tool can break is gone when goal is null.
  function breakUntil(area, start, chars, kind, goal) {
    let broke = 0, guard = 0;
    while (!(goal && cnt(goal.item) >= goal.qty)) {
      if (++guard > 3000) throw new Error('loop guard in ' + area);
      const g = EF.game.grid(area), R = reach(area, start[0], start[1]);
      let target = null;
      search: for (let y = 1; y < g.length - 1; y++) {
        for (let x = 1; x < g[0].length - 1; x++) {
          const ch = g[y][x];
          if (!chars.includes(ch)) continue;
          const spec = D.breakable[ch];
          if (!spec || spec.tool !== kind || tier(kind) < spec.tier) continue;
          for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (R.has(nx + ',' + ny)) {
              target = { x, y, ch, nx, ny, fx: -dx, fy: -dy };
              break search;
            }
          }
        }
      }
      if (!target) break;
      sel(kind);
      EF.game.teleport(area, target.nx + 0.5, target.ny + 0.5, target.fx, target.fy);
      let tries = 0;
      while (EF.game.grid(area)[target.y][target.x] === target.ch && tries++ < 60) {
        fill();
        EF.game.api.use();
      }
      if (EF.game.grid(area)[target.y][target.x] === target.ch) {
        throw new Error('could not break ' + target.ch + ' at ' + area + ' ' + target.x + ',' + target.y);
      }
      broke++;
    }
    return broke;
  }

  // Swing the sword at every golem in an area until each one is dead.
  function killGolems(area) {
    let killed = 0;
    for (const m of EF.game.mobsOf(area)) {
      if (m.type !== 'golem' || m.dead) continue;
      let guard = 0;
      while (!m.dead && guard++ < 400) {
        fill();
        sel('sword');
        EF.game.teleport(area, m.x - 0.9, m.y, 1, 0);
        EF.game.api.use();
      }
      if (m.dead) killed++;
    }
    return killed;
  }

  function smelt(bar, n) {
    const r = D.smelt.find((x) => x.out === bar);
    for (let i = 0; i < n; i++) {
      if (cnt(r.from) < r.qty) throw new Error('need ' + r.qty + ' ' + r.from + ' to smelt ' + bar);
      if (st().gold < r.gold) throw new Error('need gold to smelt ' + bar);
      EF.game.api.smelt(r);
    }
  }

  function upgrade(kind, costIndex) {
    const i = slotOf(kind), cost = D.upgradeCost[costIndex];
    if (cnt(cost.bar) < cost.qty || st().gold < cost.gold) throw new Error('cannot afford ' + kind + ' upgrade');
    EF.game.api.upgradeTool(i, cost);
    EF.ui.clear();
    return st().inv[i].id;
  }

  function donate(id) {
    const p = D.projects.find((x) => x.id === id);
    EF.game.api.donate(p);
    EF.ui.clear();
    if (!st().projects[id]) throw new Error('donation failed: ' + id);
    return id;
  }

  function mineCount(area, ch) {
    return EF.game.grid(area).reduce((n, row) => n + row.filter((c) => c === ch).length, 0);
  }

  window.BOT = {
    breakUntil, killGolems, smelt, upgrade, donate, fill, cnt, st, sel, tier, slotOf, mineCount,
    lock: (a) => EF.game.api.lockMessage(a)
  };
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const press = async (key, ms = 90) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await sleep(70);
  };
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await sleep(ms);
    await page.keyboard.up(key);
    await sleep(120);
  };
  const say = (label, value) => console.log('  ' + label + (value === undefined ? '' : ': ' + JSON.stringify(value)));
  const where = () => page.evaluate(() => {
    const s = EF.game.state;
    return { area: s.p.area, x: s.p.x, y: s.p.y };
  });

  console.log('Emberfield full playthrough');

  // ---- start ----
  await page.goto(URL);
  await page.waitForFunction(() => window.EF && EF.ui && EF.ui.blocking());
  await page.evaluate(BOT_LIB);
  await press('Enter');                     // New Game
  await sleep(150);
  for (let i = 0; i < 12; i++) {
    const busy = await page.evaluate(() => EF.ui.blocking());
    if (!busy) break;
    await press('KeyZ', 60);
  }
  await page.evaluate(() => { EF.game.state.gold = 4000; });  // bootstrap: stands in for days of farming sales
  say('new game started, bootstrap gold granted');

  // ---- wood and stone ----
  say('chopped wood', await page.evaluate(() => BOT.breakUntil('farm', [17, 9], ['T'], 'axe', { item: 'wood', qty: 35 })) + ' trees');
  say('wood in pack', await page.evaluate(() => EF.game.countItem('wood')));
  say('mined stone', await page.evaluate(() => BOT.breakUntil('mine1', [5, 5], ['R'], 'pick', { item: 'stone', qty: 30 })) + ' rocks');

  // ---- copper ----
  say('mined copper ore on floors 1-3', await page.evaluate(() => {
    BOT.breakUntil('mine1', [5, 5], ['O'], 'pick', null);
    BOT.breakUntil('mine2', [5, 5], ['O'], 'pick', null);
    BOT.breakUntil('mine3', [5, 5], ['O'], 'pick', null);
    return BOT.cnt('copper_ore');
  }));
  await page.evaluate(() => BOT.smelt('copper_bar', 11));
  say('smelted 11 copper bars');
  say('copper pick', await page.evaluate(() => BOT.upgrade('pick', 0)));

  // ---- iron on floors 2-3, two bars for the lift ----
  say('mined iron on floors 2-3', await page.evaluate(() => {
    BOT.breakUntil('mine2', [5, 5], ['I'], 'pick', null);
    BOT.breakUntil('mine3', [5, 5], ['I'], 'pick', null);
    return BOT.cnt('iron_ore');
  }));
  await page.evaluate(() => BOT.smelt('iron_bar', 2));
  say('smelted 2 iron bars');

  // ---- projects that do not need the lift ----
  say('donated', await page.evaluate(() => BOT.donate('well')));
  say('donated', await page.evaluate(() => BOT.donate('oven')));
  say('donated', await page.evaluate(() => BOT.donate('bridge')));

  // ---- gate check with real keys: the lift is still broken ----
  const gate = await page.evaluate(() => {
    const g = EF.game.grid('mine3');
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] === 'S') return { x, y };
    return null;
  });
  assert.ok(gate, 'mine3 has stairs down');
  await page.evaluate(([x, y]) => EF.game.teleport('mine3', x + 0.5, y + 1.5, 0, -1), [gate.x, gate.y]);
  await hold('ArrowUp', 800);
  assert.equal((await where()).area, 'mine3', 'walking into the locked stairs keeps you on floor 3');
  say('real keys: the broken lift stops you on floor 3');

  // ---- lift, then the same stairs with real keys ----
  say('donated', await page.evaluate(() => BOT.donate('lift')));
  await hold('ArrowUp', 900);
  assert.equal((await where()).area, 'mine4', 'after the lift, the same stairs lead to floor 4');
  say('real keys: the repaired lift opens floor 4');

  // ---- floors 4-6: iron, golems, iron pick, deep shafts ----
  say('mined iron on floors 4-6', await page.evaluate(() => {
    for (const f of ['mine4', 'mine5', 'mine6']) BOT.breakUntil(f, [5, 5], ['I'], 'pick', null);
    return BOT.cnt('iron_ore');
  }));
  await page.evaluate(() => BOT.smelt('iron_bar', 7));
  say('smelted 7 iron bars');
  say('iron pick', await page.evaluate(() => BOT.upgrade('pick', 1)));
  say('golems slain on floors 4-6', await page.evaluate(() => {
    let n = 0;
    for (const f of ['mine4', 'mine5', 'mine6']) n += BOT.killGolems(f);
    return { slain: n, cores: BOT.cnt('golem_core') };
  }));
  say('donated', await page.evaluate(() => BOT.donate('deep')));
  say('mined gleam shards', await page.evaluate(() => {
    BOT.breakUntil('mine5', [5, 5], ['Y'], 'pick', { item: 'gleam_shard', qty: 5 });
    if (BOT.cnt('gleam_shard') < 5) BOT.breakUntil('mine6', [5, 5], ['Y'], 'pick', { item: 'gleam_shard', qty: 5 });
    return BOT.cnt('gleam_shard');
  }));
  say('donated', await page.evaluate(() => BOT.donate('lamps')));

  // ---- floors 7-8 (open after the deep shafts): gold and iron for the clocktower ----
  say('mined gold on floors 6-8', await page.evaluate(() => {
    for (const f of ['mine6', 'mine7', 'mine8']) BOT.breakUntil(f, [5, 5], ['G'], 'pick', { item: 'gold_ore', qty: 10 });
    return BOT.cnt('gold_ore');
  }));
  say('mined iron on floors 7-8', await page.evaluate(() => {
    for (const f of ['mine7', 'mine8']) BOT.breakUntil(f, [5, 5], ['I'], 'pick', null);
    return BOT.cnt('iron_ore');
  }));
  say('smelted gold and iron for the clocktower', await page.evaluate(() => {
    BOT.smelt('gold_bar', 2);
    BOT.smelt('iron_bar', 4);
    return { gold: BOT.cnt('gold_bar'), iron: BOT.cnt('iron_bar') };
  }));
  say('donated', await page.evaluate(() => BOT.donate('clock')));

  // ---- the festival ----
  await page.evaluate(() => { EF.game.addItem('herb', 15); EF.game.addItem('berry', 15); });  // foraged over many days
  say('donated', await page.evaluate(() => BOT.donate('festival')));

  // ---- verify ----
  const end = await page.evaluate(() => {
    const s = EF.game.state;
    return { projects: Object.keys(s.projects).filter((k) => s.projects[k]).length, ended: s.ended, gold: s.gold };
  });
  assert.equal(end.projects, 8, 'all eight projects restored');
  assert.equal(end.ended, true, 'the festival ending is reached');
  say('all ' + end.projects + ' projects restored, ending reached, gold left', end.gold);

  await browser.close();
  if (errors.length) {
    console.log('Runtime errors:\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log('Playthrough complete: no runtime errors.');
}

main().catch((err) => {
  console.error('FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
