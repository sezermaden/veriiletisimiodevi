// Gamepad reachability as a graph (not a walk): from every focusable try all four directions,
// record the neighbour, then BFS from the initially focused element. Every item must be reachable.
import { launch, report } from './harness.mjs';
import { walkScreens } from './ui-walk.mjs';

const h = await launch({ width: 1920, height: 1080 });
await h.open('/?q=low', 20);
const bad = [];
const screens = await walkScreens(h.page, async (name) => {
  const r = await h.page.evaluate(() => {
    const f = __game.ui.top.focus;
    const items = f.items.slice();
    const start = f.current;
    const idx = new Map(items.map((el, i) => [el, i]));
    const edges = items.map(() => new Set());
    const silent = f.move.bind(f);
    for (const el of items) {
      for (const dir of ['up', 'down', 'left', 'right']) {
        f.focus(el, true);
        silent(dir);
        const to = f.current;
        if (to && to !== el && idx.has(to)) edges[idx.get(el)].add(idx.get(to));
      }
    }
    f.focus(start, true);
    const seen = new Set([idx.get(start)]);
    const q = [idx.get(start)];
    while (q.length) { const n = q.shift(); for (const m of edges[n]) if (!seen.has(m)) { seen.add(m); q.push(m); } }
    const unreachable = items.filter((_, i) => !seen.has(i)).map((el) => (el.innerText || el.className).trim().slice(0, 30));
    return { total: items.length, reachable: seen.size, unreachable };
  });
  if (r.unreachable.length) bad.push(`${name}: unreachable ${r.unreachable.join(', ')}`);
  console.log(`  ${name.split(':')[0]}: ${r.reachable}/${r.total} reachable`);
});
let ok = report(`gamepad graph over ${screens.length} screens`, bad.length === 0 && screens.length >= 4, bad.join(' | '));
if (h.errors.length) { console.log(h.errors.join('\n')); ok = false; }
await h.close();
process.exit(ok ? 0 : 1);
