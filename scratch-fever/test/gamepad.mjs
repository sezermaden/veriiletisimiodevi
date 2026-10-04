/* Gamepad-only walkthrough with a fake Xbox pad, plus reachability as a GRAPH:
   from every focusable, try all four directions, record the neighbour, then BFS
   from the initially focused node. Every focusable on every screen must be reachable. */
import { loadPlaywright, serve, launch, openGame, step, state, reporter, installFakePad, padTap, PAD } from './_lib.mjs';

const pw = await loadPlaywright();
const srv = await serve(8894);
const b = await launch(pw);
const { ok, done } = reporter('gamepad');
const { page, errors } = await openGame(b, 8894, { xbox: true });
await installFakePad(page);

const expect = async (label, want) => {
  const s = await state(page);
  const good = Object.entries(want).every(([k, v]) => s[k] === v);
  ok(good, `${label}  ${good ? '' : JSON.stringify(s)}`);
  return s;
};

/** Reachability graph of the current screen's focusables. */
const graph = () => page.evaluate(() => {
  const f = window.__game.ui.focus;
  const items = f.items.slice();
  const start = f.current;
  const idx = (el) => items.indexOf(el);
  const adj = items.map((el) => ['up', 'down', 'left', 'right'].map((d) => idx(f.peek(d, el))).filter((i) => i >= 0));
  const seen = new Set([idx(start)]);
  const q = [idx(start)];
  while (q.length) { const i = q.shift(); for (const j of adj[i]) if (!seen.has(j)) { seen.add(j); q.push(j); } }
  const missing = items.filter((_, i) => !seen.has(i)).map((el) => el.dataset.key || el.textContent.trim().slice(0, 20));
  return { total: items.length, reached: seen.size, missing, focused: !!start };
});
const checkGraph = async (label) => {
  const g = await graph();
  ok(g.focused, `${label}: something is focused`);
  ok(g.reached === g.total, `${label}: all ${g.total} focusables reachable by d-pad${g.missing.length ? ' — missing ' + g.missing.join(', ') : ''}`);
};

const padGo = async (key) => {
  for (let i = 0; i < 12 && (await state(page)).focus !== key; i++) await padTap(page, PAD.DOWN, 2);
  for (let i = 0; i < 12 && (await state(page)).focus !== key; i++) await padTap(page, PAD.UP, 2);
};

console.log('--- Xbox shell layer ---');
const tv = await page.evaluate(() => ({ tv: document.body.classList.contains('tv'), cursor: getComputedStyle(document.body).cursor, quit: !!window.__game.canQuit }));
ok(tv.tv, 'Windows.Xbox host → body.tv');
ok(tv.cursor === 'none', 'cursor hidden on TV');
ok(!tv.quit, 'no Quit button on Xbox');

console.log('--- title → menu with A ---');
await padTap(page, PAD.A, 4);
await expect('A on title → menu', { state: 'menu', ui: 'menu', focus: 'new' });
const glyph = await page.evaluate(() => document.querySelector('#screens kbd[data-action="confirm"]')?.textContent);
ok(glyph === 'A', `prompts show Xbox glyphs (${glyph})`);
await checkGraph('main menu');

console.log('--- every menu screen by pad ---');
for (const [key, name] of [['options', 'options'], ['stats', 'stats'], ['help', 'help'], ['credits', 'credits']]) {
  await padGo(key); await padTap(page, PAD.A, 4);
  await expect(`A on ${key.toUpperCase()} → ${name}`, { ui: name });
  await checkGraph(name);
  if (name === 'options') {
    await padTap(page, PAD.RIGHT, 2);
    const v = await page.evaluate(() => window.__game.settings.master);
    ok(Math.abs(v - 0.9) < 1e-9, 'd-pad right adjusts a slider');
    await padTap(page, PAD.LEFT, 2);
    // left stick also navigates
    await page.evaluate(() => window.__padAxes([0, 1, 0, 0])); await step(page, 3);
    await page.evaluate(() => window.__padAxes([0, 0, 0, 0])); await step(page, 2);
    await expect('left stick down moves focus', { focus: 'music' });
  }
  await padTap(page, PAD.B, 4);
  await expect(`B closes ${name}`, { ui: 'menu', focus: key });
}

console.log('--- play by pad ---');
await padGo('new'); await padTap(page, PAD.A, 6);
await expect('NEW GAME → playing', { state: 'playing', ui: null });
await padTap(page, PAD.A, 8);
await expect('A buys a ticket', { phase: 'scratching', tickets: 1 });
await page.waitForFunction(() => window.__game.scene.ready, null, { timeout: 30000 });
// stick + RT scratching, driven in-page frame by frame
const revealed = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  window.__padPress(7, 1);                       // hold RT
  g.cursor.u = 0.05; g.cursor.v = 0.95;
  for (let row = 0; row < 10 && g.phase === 'scratching'; row++) {
    const right = row % 2 === 0;
    window.__padAxes([right ? 1 : -1, 0, 0, 0]);
    for (let i = 0; i < 90; i++) { await frame(); if (right ? g.cursor.u >= 0.97 : g.cursor.u <= 0.03) break; }
    const v0 = g.cursor.v;
    window.__padAxes([0, 1, 0, 0]);
    for (let i = 0; i < 20; i++) { await frame(); if (g.cursor.v <= v0 - 0.09) break; }
    if (g.cursor.v <= 0.02) break;
  }
  window.__padAxes([0, 0, 0, 0]);
  window.__padRelease(7);
  await frame(); await frame();
  return { n: g.scene.revealedCount || g.current?.cells.length, phase: g.phase };
});
ok(revealed.phase !== 'scratching', `stick + RT scratched the whole ticket (${JSON.stringify(revealed)})`);
await page.waitForFunction(() => window.__game.phase === 'between', null, { timeout: 60000 });

console.log('--- pause / shop by pad ---');
await padTap(page, PAD.MENU, 4);
await expect('Menu button → pause', { state: 'paused', ui: 'pause', focus: 'resume' });
await checkGraph('pause');
await padTap(page, PAD.B, 4);
await expect('B on pause → resume', { state: 'playing', ui: null });
await padTap(page, PAD.Y, 4);
await expect('Y → shop', { ui: 'shop', focus: 't-penny' });
await checkGraph('shop / tickets');
await padTap(page, PAD.RB, 4);
await expect('RB → upgrades', { focus: 'u-luck' });
await checkGraph('shop / upgrades');
await page.evaluate(() => { window.__game.eco.s.cash = 100000; window.__game.ui.refresh(); });
await padGo('u-bot'); await padTap(page, PAD.A, 4);
ok(await page.evaluate(() => window.__game.eco.lvl('bot')) === 1, 'A buys Scratch Bot');
await padGo('u-autobuy'); await padTap(page, PAD.A, 4);
ok(await page.evaluate(() => window.__game.eco.lvl('autobuy')) === 1, 'A buys Season Pass (auto-buy)');
await padTap(page, PAD.RB, 4);
await expect('RB → prestige', { focus: 'prestige' });
await checkGraph('shop / prestige');
await padTap(page, PAD.LB, 4); await padTap(page, PAD.LB, 4);
await expect('LB twice → tickets', { focus: 't-penny' });
await padTap(page, PAD.B, 4);
await expect('B closes the shop', { state: 'playing', ui: null });

console.log('--- the bot plays on its own ---');
const t0 = await page.evaluate(() => window.__game.eco.s.stats.tickets);
await page.waitForFunction((n) => window.__game.eco.s.stats.botTickets >= 2 && window.__game.eco.s.stats.tickets >= n + 2, t0, { timeout: 120000 });
const bot = await page.evaluate(() => ({ bot: window.__game.eco.s.stats.botTickets, tickets: window.__game.eco.s.stats.tickets }));
ok(bot.bot >= 2, `Scratch Bot + auto-buy finished ${bot.bot} tickets hands-free`);

console.log('--- View → stats, confirm dialogs ---');
await padTap(page, PAD.VIEW, 4);
await expect('View → stats', { ui: 'stats' });
await checkGraph('stats (in play)');
await padTap(page, PAD.B, 4);
await padTap(page, PAD.MENU, 4);
await padGo('mainmenu'); await padTap(page, PAD.A, 6);
await expect('SAVE & MAIN MENU → menu', { state: 'menu', focus: 'continue' });
await padGo('new'); await padTap(page, PAD.A, 4);
await expect('NEW GAME with a save → confirm dialog', { ui: 'confirm', focus: 'no' });
await checkGraph('confirm');
await padTap(page, PAD.B, 4);
await expect('B cancels the dialog', { ui: 'menu' });

ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);
await b.close(); srv.close();
process.exit(done() ? 1 : 0);
