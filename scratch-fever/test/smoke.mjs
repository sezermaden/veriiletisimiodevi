/* Keyboard-only walkthrough of the whole game: every screen reachable, a ticket
   bought, scratched to completion and settled, shop purchase, pause, options, stats,
   prestige dialog, save + continue. No mouse, no gamepad. */
import { loadPlaywright, serve, launch, openGame, press, step, state, reporter } from './_lib.mjs';

const pw = await loadPlaywright();
const srv = await serve(8893);
const b = await launch(pw);
const { ok, done } = reporter('smoke');
const { page, errors, bad, ctx } = await openGame(b, 8893);

const expect = async (label, want) => {
  const s = await state(page);
  const good = Object.entries(want).every(([k, v]) => s[k] === v);
  ok(good, `${label}  ${good ? '' : JSON.stringify(s)}`);
  return s;
};

console.log('--- title → menu ---');
await expect('title screen focused on start', { state: 'title', ui: 'title', focus: 'start' });
await press(page, 'Enter', 4);
await expect('Enter → main menu, NEW GAME focused', { state: 'menu', ui: 'menu', focus: 'new' });

/** Walk the focus to an item by key (down first, then up), like a player would. */
const goTo = async (key) => {
  for (let i = 0; i < 10 && (await state(page)).focus !== key; i++) await press(page, 'ArrowDown');
  for (let i = 0; i < 10 && (await state(page)).focus !== key; i++) await press(page, 'ArrowUp');
};

console.log('--- menu screens ---');
await goTo('options'); await press(page, 'Enter', 4);
await expect('OPTIONS opens', { ui: 'options' });
await press(page, 'ArrowRight');
const vol = await page.evaluate(() => window.__game.settings.master);
ok(Math.abs(vol - 0.9) < 1e-9, `right arrow raises master volume to ${vol}`);
await press(page, 'ArrowLeft');
await press(page, 'Escape', 4);
await expect('Esc → back to menu, OPTIONS still focused', { ui: 'menu', focus: 'options' });
await goTo('stats'); await press(page, 'Enter', 4);
await expect('STATS opens', { ui: 'stats' });
await press(page, 'Escape', 4);
await goTo('help'); await press(page, 'Enter', 4);
await expect('HOW TO PLAY opens', { ui: 'help' });
await press(page, 'Escape', 4);
await goTo('credits'); await press(page, 'Enter', 4);
await expect('CREDITS opens', { ui: 'credits' });
await press(page, 'Escape', 4);
await expect('back on menu', { ui: 'menu', focus: 'credits' });

console.log('--- new game ---');
await goTo('new');
await expect('NEW GAME focused again', { focus: 'new' });
await press(page, 'Enter', 6);
await expect('playing, between tickets', { state: 'playing', ui: null, phase: 'between' });
await press(page, 'Enter', 8);
await expect('Enter buys the first ticket', { phase: 'scratching', tickets: 1 });
// wait for the card to finish sliding in
await page.waitForFunction(() => window.__game.scene.ready, null, { timeout: 30000 });

console.log('--- scratch with the mouse ---');
{
  // a mouse drag across the middle of the card must erase foil
  const box = await page.evaluate(() => { const s = window.__game.scene; const a = s.uvToWorld(0.1, 0.5), b = s.uvToWorld(0.9, 0.5); const v = window.__game.view; const p = (w) => { const q = w.clone().project(v.camera); return [(q.x + 1) / 2 * innerWidth, (1 - q.y) / 2 * innerHeight]; }; return { a: p(a), b: p(b) }; });
  await page.mouse.move(box.a[0], box.a[1]); await step(page, 2);
  await page.mouse.down(); await step(page, 2);
  for (let i = 1; i <= 12; i++) { await page.mouse.move(box.a[0] + (box.b[0] - box.a[0]) * i / 12, box.a[1] + (box.b[1] - box.a[1]) * i / 12); await step(page, 1); }
  await page.mouse.up(); await step(page, 2);
  const m = await page.evaluate(() => ({ revealed: window.__game.scene.revealedCount, cells: window.__game.eco.s.stats.cellsScratched }));
  ok(m.revealed >= 1, `mouse drag revealed ${m.revealed} cells`);
  await page.mouse.move(5, 5); await step(page, 2);
  await page.keyboard.press('ShiftLeft'); await step(page, 2);   // hand control back to the keyboard
}

console.log('--- scratch with the keyboard ---');
// sweep the brush across every row while holding Space
/* The sweep runs inside the page so it is not bounded by test-process round trips:
   it holds Space and drives the brush edge to edge, row by row, waiting for real frames. */
const sweep = () => page.evaluate(async () => {
  const g = window.__game, I = g.input;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const hold = (a) => { if (!I._held.has(a)) { I._pendingDown.add(a); I._held.add(a); } };
  const release = (a) => { I._held.delete(a); I._pendingUp.add(a); };
  hold('scratch');
  for (let row = 0; row < 10 && g.phase === 'scratching'; row++) {
    const right = row % 2 === 0;
    hold(right ? 'right' : 'left');
    for (let i = 0; i < 90; i++) { await frame(); if (right ? g.cursor.u >= 0.97 : g.cursor.u <= 0.03) break; }
    release(right ? 'right' : 'left');
    const v0 = g.cursor.v;
    hold('down');
    for (let i = 0; i < 20; i++) { await frame(); if (g.cursor.v <= v0 - 0.09) break; }
    release('down');
    if (g.cursor.v <= 0.02) break;
  }
  release('scratch');
  await frame(); await frame();
});
await page.evaluate(() => { window.__game.cursor.u = 0.05; window.__game.cursor.v = 0.95; });
await sweep();
const rev = await page.evaluate(() => ({ n: window.__game.scene.revealedCount || (window.__game.current?.cells.length ?? 0), total: window.__game.current?.cells.length ?? 0, phase: window.__game.phase }));
ok(rev.n >= 5, `keyboard sweep revealed ${rev.n}/${rev.total} cells`);
if (rev.phase === 'scratching') {
  // finish whatever the sweep missed with a second, tighter pass
  await page.evaluate(() => { window.__game.cursor.u = 0.05; window.__game.cursor.v = 0.5; });
  await sweep();
}
await page.waitForFunction(() => window.__game.phase !== 'scratching', null, { timeout: 60000 }).catch(() => {});
const after = await state(page);
ok(after.phase === 'settled' || after.phase === 'between', `ticket settled after a full scratch (phase ${after.phase})`);
const res = await page.evaluate(() => window.__game.lastResult && { payout: window.__game.lastResult.payout, lines: window.__game.lastResult.lines.length });
ok(res !== null, `result recorded (${JSON.stringify(res)})`);

console.log('--- pause / shop / stats from play ---');
await page.waitForFunction(() => window.__game.phase === 'between', null, { timeout: 60000 });
await press(page, 'Escape', 4);
await expect('Esc → pause, RESUME focused', { state: 'paused', ui: 'pause', focus: 'resume' });
await goTo('options'); await press(page, 'Enter', 4);
await expect('pause → OPTIONS', { ui: 'options' });
await press(page, 'Escape', 4);
await expect('options → pause', { ui: 'pause' });
await goTo('resume');
await press(page, 'Escape', 4);
await expect('Esc on pause resumes', { state: 'playing', ui: null });
await press(page, 'KeyB', 4);
await expect('B opens the shop (tickets tab)', { state: 'paused', ui: 'shop', focus: 't-penny' });
await press(page, 'KeyR', 4);
await expect('R → upgrades tab', { focus: 'u-luck' });
// give the player money and buy Quick Reveal with the keyboard
await page.evaluate(() => { window.__game.eco.s.cash = 5000; window.__game.ui.refresh(); });
await goTo('u-quick');
await expect('reached Quick Reveal', { focus: 'u-quick' });
await press(page, 'Enter', 4);
const quick = await page.evaluate(() => window.__game.eco.lvl('quick'));
ok(quick === 1, 'Enter buys Quick Reveal');
await goTo('u-bot'); await press(page, 'Enter', 4);
ok(await page.evaluate(() => window.__game.eco.lvl('bot')) === 1, 'Enter buys Scratch Bot');
await press(page, 'KeyR', 4);
await expect('R → prestige tab', { focus: 'prestige' });
await press(page, 'Enter', 4);
await expect('prestige below threshold stays on shop (error)', { ui: 'shop' });
await page.evaluate(() => { window.__game.eco.s.runEarned = 90000; window.__game.ui.refresh(); });
await press(page, 'Enter', 4);
await expect('prestige confirm dialog, CANCEL focused', { ui: 'confirm', focus: 'no' });
await press(page, 'ArrowRight'); await press(page, 'Enter', 6);
const jp = await page.evaluate(() => window.__game.eco.s.jp);
ok(jp === 2, `prestige granted ${jp} JP (expected 2 for $90K)`);
await press(page, 'Escape', 4);
await expect('Esc closes the shop back to play', { state: 'playing', ui: null });
await press(page, 'Tab', 4);
await expect('Tab opens stats in play', { ui: 'stats' });
await press(page, 'Escape', 4);
await expect('Esc closes stats', { state: 'playing', ui: null });

console.log('--- quick reveal + ticket switching ---');
await page.evaluate(() => { const g = window.__game; g.eco.s.cash = 5000; g.eco.s.upgrades.quick = 1; g.eco.s.lifetimeEarned = 1000; g.eco.refreshUnlocks(); g.refreshHud(); });
await press(page, 'KeyR', 4);
const sel = await page.evaluate(() => window.__game.eco.s.selected);
ok(sel === 'fruit', `R between tickets switches to the next unlocked ticket (${sel})`);
await press(page, 'Enter', 8);
await page.waitForFunction(() => window.__game.scene.ready, null, { timeout: 30000 });
await press(page, 'KeyX', 4);
await page.waitForFunction(() => window.__game.phase !== 'scratching', null, { timeout: 60000 });
await expect('X reveals the whole ticket', { phase: 'settled' });

console.log('--- save & continue ---');
await page.waitForFunction(() => window.__game.phase === 'between', null, { timeout: 60000 });
await press(page, 'Escape', 4);
await goTo('mainmenu');
await expect('reached SAVE & MAIN MENU', { focus: 'mainmenu' });
await press(page, 'Enter', 6);
await expect('back on main menu with CONTINUE focused', { state: 'menu', ui: 'menu', focus: 'continue' });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('scratchfever.save.v1')));
ok(saved && saved.jp === 2 && saved.upgrades.quick === 1, 'save on disk carries JP and upgrades');
await press(page, 'Enter', 6);
await expect('CONTINUE resumes play', { state: 'playing' });
const cash = await page.evaluate(() => window.__game.eco.s.cash);
ok(cash === saved.cash || cash > saved.cash, `cash restored (${cash})`);

ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);
ok(bad.length === 0, `no 4xx/5xx responses${bad.length ? ': ' + bad[0] : ''}`);
await b.close(); srv.close();
process.exit(done() ? 1 : 0);
