/* Memory: load maps back and forth; GPU geometry/texture counts must not accumulate,
   and the physics world must be freed each time. */
import { launch, frames } from './_browser.mjs';
const { page, errors, close } = await launch({ width: 800, height: 450 });
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 180000 });
const seq = ['foundry', 'flatland', 'foundry', 'flatland', 'foundry', 'flatland'];
const counts = [];
for (const m of seq) {
  await page.evaluate((m) => window.__game.startSandbox(m), m);
  await page.waitForFunction((m) => window.__game.state === 'playing' && window.__game.mapId === m, m, { timeout: 180000 });
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 20; i++) g.spawnFromMenu('prop', 'crate'); g.spawnFromMenu('npc', 'citizen'); g.spawnFromMenu('npc', 'mannequin'); });
  await frames(page, 20);
  // exercise removal paths, then measure in a settled state (dissolves finished)
  await page.evaluate(() => { const g = window.__game; g.cleanup(); for (const n of [...g.npcs.list]) n.remove(); g.npcs.list = []; });
  await frames(page, 45);
  const c = await page.evaluate(() => { const i = window.__game.renderer.renderer.info.memory; return { geo: i.geometries, tex: i.textures, ents: window.__game.entities.list.length }; });
  counts.push({ map: m, ...c });
  console.log(m.padEnd(9), JSON.stringify(c));
}
// compare the 2nd and 3rd visit of the same map
const f = counts.filter((c) => c.map === 'foundry');
const fl = counts.filter((c) => c.map === 'flatland');
const grow = (a) => a[a.length - 1].geo - a[1].geo;
const texGrow = (a) => a[a.length - 1].tex - a[1].tex;
let fail = false;
for (const [name, arr] of [['foundry', f], ['flatland', fl]]) {
  const g = grow(arr), t = texGrow(arr);
  const ok = g <= 4 && t <= 4;
  if (!ok) fail = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: geometry growth ${g}, texture growth ${t} between repeat visits`);
}
const errs = errors.filter((e) => !/favicon|404|Pointer Lock/i.test(e));
if (errs.length) { fail = true; console.log(errs.join('\n')); }
await close();
process.exit(fail ? 1 : 0);
