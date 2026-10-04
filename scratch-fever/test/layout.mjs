/* Layout at five window shapes × every screen: something focused, hit targets at
   least --hit-min tall, nothing focusable outside the 5% safe area, no focusable text
   under 20px, nothing clipped, the page does not scroll. 21:9 is the one that catches
   a menu whose last item falls off the bottom. */
import { loadPlaywright, serve, launch, openGame, step, reporter } from './_lib.mjs';

const pw = await loadPlaywright();
const srv = await serve(8895);
const b = await launch(pw);
const { ok, done } = reporter('layout');

const SHAPES = [[1920, 1080], [2560, 1440], [3840, 2160], [1920, 1200], [2560, 1080]];
const SAVE = JSON.stringify({ v: 1, cash: 12345, jp: 3, lifetimeEarned: 2e6, runEarned: 50000, upgrades: { bot: 1, quick: 1, luck: 4 }, perks: {}, selected: 'golden', unlocked: ['penny', 'fruit', 'bell', 'vault', 'madness', 'golden', 'cosmic'], jackpotPool: 500, stats: { tickets: 120, wins: 40, biggestWin: 9000, jackpots: 1, prestiges: 1, playTime: 4000, cellsScratched: 2000, botTickets: 50, bestTicket: 'Gem Vault' }, lastSave: Date.now(), created: Date.now() });

const SCREENS = [
  { name: 'title', open: 'ui.replace("title")' },
  { name: 'menu', open: 'g.state="menu"; ui.replace("menu")' },
  { name: 'options', open: 'ui.replace("menu"); ui.open("options")' },
  { name: 'stats', open: 'ui.replace("menu"); ui.open("stats")' },
  { name: 'help', open: 'ui.replace("menu"); ui.open("help")' },
  { name: 'credits', open: 'ui.replace("menu"); ui.open("credits")' },
  { name: 'confirm', open: 'ui.replace("menu"); ui.open("confirm", { title: "Start over?", text: "Your save will be erased.", yes: "ERASE", onYes(){} })' },
  { name: 'offline', open: 'ui.replace("menu"); ui.open("offline", { seconds: 3600, tickets: 40, amount: 1234, onYes(){} })' },
  { name: 'pause', open: 'ui.replace("pause")' },
  { name: 'shop-tickets', open: 'ui.replace("shop", { tab: "tickets" })' },
  { name: 'shop-upgrades', open: 'ui.replace("shop", { tab: "upgrades" })' },
  { name: 'shop-prestige', open: 'ui.replace("shop", { tab: "prestige" })' },
];

const audit = (page) => page.evaluate(() => {
  const g = window.__game;
  const W = innerWidth, H = innerHeight;
  const safeX = W * 0.05 - 1, safeY = H * 0.05 - 1;
  const hitMin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit-min')) || 64;
  const items = g.ui.focus.items;
  const problems = [];
  const label = (el) => el.dataset.key || el.textContent.trim().slice(0, 18);
  for (const el of items) {
    // the focus manager scrolls an item into view when it lands on it; measure the same way
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    const r = el.getBoundingClientRect();
    if (r.height < hitMin - 0.5) problems.push(`${label(el)} hit ${Math.round(r.height)} < ${hitMin}`);
    if (r.left < safeX || r.top < safeY || r.right > W - safeX || r.bottom > H - safeY) problems.push(`${label(el)} outside safe area (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 20) problems.push(`${label(el)} font ${fs}px < 20`);
    // clipped by an overflow:hidden ancestor (scroll containers are fine)
    let p = el.parentElement;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
        const pr = p.getBoundingClientRect();
        if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1 || r.right > pr.right + 1 || r.left < pr.left - 1) problems.push(`${label(el)} clipped by ${p.className}`);
      }
      p = p.parentElement;
    }
  }
  // text that overflows its box inside the top screen (labels cut off)
  const top = g.ui.top?.root;
  if (top) for (const el of top.querySelectorAll('.row-name, .btn-label, .screen-title, .option-name, .stat-v')) {
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap') continue;
    if (el.scrollWidth > el.clientWidth + 2) problems.push(`${el.className} text overflows`);
  }
  return {
    focused: !!g.ui.focus.current, count: items.length, problems,
    scrolled: document.documentElement.scrollHeight > H + 1 || document.documentElement.scrollWidth > W + 1,
  };
});

for (const [w, h] of SHAPES) {
  console.log(`\n${w}x${h}`);
  const { page, errors, ctx } = await openGame(b, 8895, { width: w, height: h, storage: { 'scratchfever.save.v1': SAVE } });
  await page.evaluate(() => { const g = window.__game; g.eco = new g.eco.constructor(g.peekSave()); g._playedThisSession = true; });
  for (const sc of SCREENS) {
    await page.evaluate(`(() => { const g = window.__game, ui = g.ui; ${sc.open}; })()`);
    await step(page, 2);
    const a = await audit(page);
    const good = a.focused && a.problems.length === 0 && !a.scrolled;
    ok(good, `${sc.name.padEnd(14)} ${a.count} focusables${good ? '' : ' — ' + (a.focused ? '' : 'NOTHING FOCUSED; ') + (a.scrolled ? 'PAGE SCROLLS; ' : '') + a.problems.slice(0, 4).join('; ')}`);
  }
  // HUD in play: cash and prompts inside the safe area
  await page.evaluate(() => { const g = window.__game; g.ui.closeAll(); g.startPlay(); });
  await step(page, 3);
  const hud = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight, sx = W * 0.05 - 1, sy = H * 0.05 - 1;
    const bad = [];
    for (const id of ['hud-cash', 'hud-ticket', 'hud-prompts']) {
      const r = document.getElementById(id).getBoundingClientRect();
      if (r.left < sx || r.top < sy || r.right > W - sx || r.bottom > H - sy) bad.push(id);
    }
    return bad;
  });
  ok(hud.length === 0, `HUD inside the safe area${hud.length ? ' — ' + hud.join(', ') : ''}`);
  ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);
  await ctx.close();
}

await b.close(); srv.close();
process.exit(done() ? 1 : 0);
