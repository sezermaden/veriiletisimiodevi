// Every registered stage loads, spawns its entities without errors and renders a frame.
import { launch, report } from './harness.mjs';

const h = await launch({ width: 320, height: 180 });
await h.open('/?q=low', 5);
const ids = await h.page.evaluate(async () => Object.keys((await import('/src/levels/index.js')).STAGE_LOADERS).filter((k) => /^(w\d|turf-)/.test(k)));
let ok = true;
for (const id of ids) {
  const before = h.errors.length;
  const res = await h.page.evaluate(async (id) => {
    const g = __game;
    let mode = null;
    try { const ui = await import('/src/ui/boot-ui.js'); mode = await ui.modeFor?.(g, id); } catch { /* sandbox fallback */ }
    const s = await g.startSession({ stageId: id, mode, lockPointer: false });
    if (!s) return { ok: false, why: 'startSession returned null', errors: g.errors.slice(-3) };
    g.halted = true;
    for (let i = 0; i < 90; i++) g.tick(1 / 60);
    g.halted = false;
    await new Promise((r) => { const f0 = g.frames; const f = () => (g.frames - f0 >= 2 ? r() : requestAnimationFrame(f)); f(); });
    return { ok: true, entities: s.entities.length, actors: s.actors.length, errors: g.errors.slice(-3) };
  }, id).catch((e) => ({ ok: false, why: e.message }));
  const newErr = h.errors.slice(before);
  ok &= report(`stage ${id}`, res.ok && !res.errors?.length && !newErr.length, res.ok ? `${res.entities} entities, ${res.actors} actors ${newErr.join(' ')} ${(res.errors || []).join(' ')}` : res.why);
  await h.page.evaluate(() => { __game.errors.length = 0; __game.ui.clear(); });
}
await h.close();
process.exit(ok ? 0 : 1);
