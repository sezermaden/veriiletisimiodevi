#!/usr/bin/env node
/* Drives the real game to every screen and captures Store screenshots.
     node tools/shots.mjs                 # all screens at 1920x1080
     node tools/shots.mjs --only play,shop
   Waits on FRAMES, not time (SwiftShader frames can take a second). */
import { mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPlaywright, serve, launch, openGame, step } from '../test/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../ScratchFever/StoreArt/Screenshots');
const argv = process.argv.slice(2);
const onlyArg = argv.indexOf('--only');
const only = onlyArg >= 0 ? argv[onlyArg + 1].split(',') : null;
const W = 1920, H = 1080;

const SAVE = JSON.stringify({ v: 1, cash: 48210, jp: 4, lifetimeEarned: 3.2e6, runEarned: 410000, upgrades: { bot: 1, quick: 1, luck: 9, payout: 6, brush: 3, autobuy: 1, botspeed: 4 }, perks: { startcash: 1 }, selected: 'golden', unlocked: ['penny', 'fruit', 'bell', 'vault', 'madness', 'golden', 'cosmic'], jackpotPool: 21000, stats: { tickets: 1480, wins: 512, biggestWin: 184000, jackpots: 2, prestiges: 1, playTime: 15400, cellsScratched: 21000, botTickets: 700, bestTicket: 'Golden Jackpot' }, lastSave: Date.now(), created: Date.now() });

await mkdir(OUT, { recursive: true });
const pw = await loadPlaywright();
const srv = await serve(8896);
const b = await launch(pw);
const { page, ctx } = await openGame(b, 8896, { width: W, height: H, storage: { 'scratchfever.save.v1': SAVE }, fast: false });
await page.evaluate(() => { const g = window.__game; g.eco = new g.eco.constructor(g.peekSave()); g._playedThisSession = true; });

const shot = async (name) => {
  if (only && !only.includes(name)) return;
  await step(page, 3);
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  console.log('  ' + name + '.png');
};

/** Scratch most of the current ticket so the printed symbols show. */
const partialScratch = (fraction) => page.evaluate(async (fr) => {
  const g = window.__game, sc = g.scene;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  while (!sc.ready) await frame();
  const n = sc.cellRects.length;
  const target = Math.floor(n * fr);
  for (let i = 0; i < target; i++) sc._revealCellNow(i, false);
  // leave a half-scratched cell for the camera
  const r = sc.cellRects[target];
  if (r) for (let k = 0; k < 6; k++) sc.scratchAt(r.u0 + (r.u1 - r.u0) * (0.25 + k * 0.1), r.v0 + (r.v1 - r.v0) * 0.55, 0.05);
  sc.endStroke();
  sc.setCursor(r ? r.u0 + (r.u1 - r.u0) * 0.8 : 0.5, r ? r.v0 + (r.v1 - r.v0) * 0.55 : 0.5, true, true);
  await frame();
}, fraction);

console.log('capturing →', OUT);
await shot('01-title');
await page.evaluate(() => window.__game.toMenu(true));
await shot('02-menu');
await page.evaluate(() => { const g = window.__game; g.startPlay(); g.buyNext(); });
await partialScratch(0.6);
await shot('03-play');
// a win moment
await page.evaluate(async () => {
  const g = window.__game, sc = g.scene;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  sc.discardNow(); g.phase = 'between';
  const t = g.eco.ticket('golden');
  const cells = g.eco.roll(t);
  // plant a sure win: five crowns
  let placed = 0; for (let i = 0; i < cells.length && placed < 5; i++) if (cells[i] !== 'jackpot') { cells[i] = 'crown'; placed++; }
  g.current = { ticket: t, cells, price: g.eco.price(t) };
  sc.newTicket(t, cells, { price: g.current.price });
  g.phase = 'scratching';
  while (!sc.ready) await frame();
  for (let i = 0; i < cells.length; i++) sc._revealCellNow(i, false);
  await frame(); await frame(); await frame();
});
await shot('04-win');
await page.evaluate(() => { const g = window.__game; g.phase = 'between'; g.scene.discardNow(); g.openScreen('shop', { tab: 'tickets' }); });
await shot('05-shop');
await page.evaluate(() => { window.__game.ui.replace('shop', { tab: 'upgrades' }); });
await shot('06-upgrades');
await page.evaluate(() => { window.__game.ui.replace('shop', { tab: 'prestige' }); });
await shot('07-prestige');
await page.evaluate(() => { window.__game.ui.replace('pause'); });
await shot('08-pause');
await page.evaluate(() => { window.__game.ui.replace('options'); });
await shot('09-options');
await page.evaluate(() => { window.__game.ui.replace('stats'); });
await shot('10-stats');

await ctx.close();
await b.close(); srv.close();
console.log('done');
