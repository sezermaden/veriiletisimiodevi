/* Layout + gamepad reachability at five screen shapes.

   Per screen: something is focused; every focus target >= --hit-min tall; nothing focusable
   outside the 5% safe area (items inside scroll containers are checked after scrolling);
   no focusable text under 16 px; nothing clipped by overflow:hidden; the page does not scroll.
   Reachability is a graph: from every focusable try all four directions, record neighbours,
   BFS from the initially focused node — every node must be reachable. */
import { launch } from './_browser.mjs';

const SHAPES = [[1920, 1080], [2560, 1440], [3840, 2160], [1920, 1200], [2560, 1080]];
const SCREENS = ['main', 'story', 'sandbox', 'options', 'controls', 'credits', 'pause', 'spawnmenu', 'death'];
const log = (...a) => console.log(...a);
let fail = false;

const { page, errors, close } = await launch({ width: 1920, height: 1080 });
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 180000 });

async function open(name) {
  await page.evaluate(async (name) => {
    const g = window.__game;
    const S = await import('./src/ui/screens.js');
    g.spawnmenu.toggle(false);
    if (['pause', 'spawnmenu', 'death'].includes(name) && g.mode !== 'sandbox') {
      await g.startSandbox('flatland');
    }
    if (name === 'main') { if (g.mode !== 'menu') await g.toMainMenu(); g.ui.show(S.mainMenu(g)); }
    else if (name === 'story') g.ui.show(S.storyMenu(g));
    else if (name === 'sandbox') g.ui.show(S.sandboxMenu(g));
    else if (name === 'options') g.ui.show(S.optionsMenu(g));
    else if (name === 'controls') g.ui.show(S.controlsMenu(g));
    else if (name === 'credits') g.ui.show(S.creditsScreen(g));
    else if (name === 'pause') { g.state = 'playing'; g.pause(); }
    else if (name === 'death') { g.ui.show(S.deathScreen(g, 'Test')); }
    else if (name === 'spawnmenu') { g.ui.clear(); g.state = 'playing'; g.spawnmenu.toggle(true); }
  }, name);
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__game.ui.focus.refresh());
}

function audit() {
  return page.evaluate(() => {
    const g = window.__game;
    const fm = g.ui.focus;
    const root = fm.root;
    const W = innerWidth, H = innerHeight;
    const hitMin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit-min')) || 56;
    const hitPx = (() => { const d = document.createElement('div'); d.style.height = 'var(--hit-min)'; document.body.append(d); const v = d.getBoundingClientRect().height; d.remove(); return v; })();
    const safeX = W * 0.05, safeY = H * 0.05;
    const problems = [];
    const items = fm.items;
    if (!fm.current) problems.push('nothing focused');
    const scroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return p; } return null; };
    for (const el of items) {
      const sc = scroller(el);
      if (sc) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      const r = el.getBoundingClientRect();
      const label = (el.textContent || el.className).trim().slice(0, 30);
      if (r.height + 0.5 < Math.min(hitPx, 128) * 0.99) problems.push(`small target ${r.height.toFixed(0)}px < ${hitPx.toFixed(0)}px: "${label}"`);
      if (r.left < safeX - 1 || r.top < safeY - 1 || r.right > W - safeX + 1 || r.bottom > H - safeY + 1) {
        if (!(sc && r.bottom <= sc.getBoundingClientRect().bottom + 1 && r.top >= sc.getBoundingClientRect().top - 1)) problems.push(`outside safe area: "${label}" [${r.left.toFixed(0)},${r.top.toFixed(0)},${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`);
      }
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16 && el.textContent.trim()) problems.push(`tiny text ${fs}px: "${label}"`);
      // clipped by an overflow:hidden ancestor
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflow === 'hidden' && !p.classList.contains('sr-only')) {
          const pr = p.getBoundingClientRect();
          if (r.right > pr.right + 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.top < pr.top - 1) { problems.push(`clipped: "${label}"`); break; }
        }
      }
    }
    if (document.scrollingElement.scrollHeight > H + 2 || document.scrollingElement.scrollWidth > W + 2) problems.push('page scrolls');
    // reachability graph
    const start = fm.current;
    const edges = new Map();
    for (const el of items) {
      const out = [];
      for (const d of ['up', 'down', 'left', 'right']) { fm.current = el; fm.move(d); if (fm.current && fm.current !== el) out.push(fm.current); }
      edges.set(el, out);
    }
    const seen = new Set([start]);
    const q = [start];
    while (q.length) { const x = q.shift(); for (const n of edges.get(x) || []) if (!seen.has(n)) { seen.add(n); q.push(n); } }
    const unreachable = items.filter((el) => !seen.has(el)).map((el) => (el.textContent || el.className).trim().slice(0, 24));
    if (start) fm.focus(start, true);
    if (unreachable.length) problems.push(`unreachable by gamepad: ${unreachable.slice(0, 6).join(' | ')}${unreachable.length > 6 ? ` (+${unreachable.length - 6})` : ''}`);
    return { n: items.length, problems };
  });
}

for (const [w, h] of SHAPES) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(300);
  for (const s of SCREENS) {
    await open(s);
    const r = await audit();
    const ok = r.problems.length === 0;
    if (!ok) fail = true;
    log(`${ok ? 'PASS' : 'FAIL'}  ${w}x${h}  ${s.padEnd(10)} ${r.n} focusables${ok ? '' : '\n        - ' + r.problems.slice(0, 8).join('\n        - ')}`);
    if (w === 1920 && h === 1080 && process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/ui-${s}.png` });
  }
}
const errs = errors.filter((e) => !/favicon|404|Pointer Lock/i.test(e));
if (errs.length) { fail = true; log(errs.join('\n')); }
await close();
process.exit(fail ? 1 : 0);
