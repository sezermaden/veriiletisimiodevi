// Memory: build and tear down five sessions; GPU geometry/texture counts must not accumulate.
import { launch, report } from './harness.mjs';

const stage = process.argv[2] || 'sandbox';
const h = await launch({ width: 320, height: 180 });
await h.open(`/?stage=${stage}&q=low`, 5);
const counts = await h.page.evaluate(async (stage) => {
  const g = __game;
  const wait = (n) => new Promise((r) => { const t = g.frames + n; const f = () => (g.frames >= t ? r() : requestAnimationFrame(f)); f(); });
  const out = [];
  g.save.setFlag('seenPrologue');
  const ui = await import('/src/ui/boot-ui.js');
  for (let i = 0; i < 5; i++) {
    // the real mode (story / turf with 7 bots / sandbox): its HUD, bots, nav and props must go too
    const mode = await ui.modeFor(g, stage);
    await g.startSession({ stageId: stage, mode, lockPointer: false });
    await wait(i === 0 ? 4 : 30);
    const m = g.renderer.gl.info.memory;
    out.push({ geometries: m.geometries, textures: m.textures, actors: g.session.actors.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null });
  }
  return out;
}, stage);
console.log(JSON.stringify(counts));
const g0 = counts[1].geometries, g4 = counts[4].geometries;   // [0] includes first-load caches
const t0 = counts[1].textures, t4 = counts[4].textures;
let ok = report('geometries do not accumulate', g4 <= g0 + 2, `${counts.map((c) => c.geometries).join(' → ')}`);
ok &= report('textures do not accumulate', t4 <= t0 + 2, `${counts.map((c) => c.textures).join(' → ')}`);
if (h.errors.length) { console.log(h.errors.filter((e) => !e.includes('boot-ui')).join('\n')); }
await h.close();
process.exit(ok ? 0 : 1);
