// Per-stage performance budget report (headless SwiftShader: draw calls / triangles / scene
// counts are GPU-independent; JS step time is measured with rendering off).
//   node tools/perf.mjs [stageId …]      default: every story stage + turf arenas + menu
// Budgets (mid-range desktop, 1080p): < 700 draw calls, < 1.5 M triangles, JS step < 3 ms (story)
// / < 5 ms (turf, 8 players).
import { launch } from '../test/harness.mjs';

const want = process.argv.slice(2);
const h = await launch({ width: 480, height: 270 });   // counts do not depend on resolution
await h.open('/?q=high', 5);
const ids = want.length ? want : await h.page.evaluate(async () => Object.keys((await import('/src/levels/index.js')).STAGE_LOADERS).filter((k) => /^(w\d|turf-)/.test(k)));

const rows = [];
for (const id of ['menu', ...ids]) {
  const r = await h.page.evaluate(async (id) => {
    const g = __game, R = g.renderer, gl = R.gl;
    const frames = (n) => new Promise((res) => { const f0 = g.frames; const f = () => (g.frames - f0 >= n ? res() : requestAnimationFrame(f)); f(); });
    g.save.setFlag('seenPrologue');
    const ui = await import('/src/ui/boot-ui.js');
    if (id === 'menu') { g.ui.clear(); g.endSession?.(); await ui.showMainMenu(g); }
    else {
      g.ui.clear();
      const s = await ui.startStage(g, id, { skipIntro: true });
      if (!s) return { id, error: 'no session' };
      // run past the title card so the gameplay camera is in place
      g.halted = true;
      const m = s.mode;
      for (let i = 0; i < 600 && m?.currentObjective === undefined; i++) {
        if (i % 4 === 0) g.input._injectKey('Escape', true); else if (i % 4 === 2) g.input._injectKey('Escape', false);
        g.tick(1 / 60);
      }
      g.input._injectKey('Escape', false);
      for (let i = 0; i < 60; i++) g.tick(1 / 60);
      g.halted = false;
    }
    await frames(3);
    const scene = R.scene;
    let meshes = 0, inst = 0, casters = 0, visible = 0, lights = 0, shadowLights = 0;
    scene.traverse((o) => {
      if (o.isLight) { lights++; if (o.castShadow) shadowLights++; }
      if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
      meshes++;
      if (o.isInstancedMesh) inst++;
      if (o.castShadow) casters++;
      let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; }
      if (v) visible++;
    });
    // one full composed frame, counted across every pass
    gl.info.autoReset = false; gl.info.reset();
    R.render();
    const calls = gl.info.render.calls, tris = gl.info.render.triangles;
    gl.info.autoReset = true;
    // JS cost of a fixed step + frame update with rendering off
    let stepMs = null;
    if (g.session) {
      const was = R.enabled; R.enabled = false; g.halted = true;
      for (let i = 0; i < 30; i++) g.tick(1 / 60);
      const t0 = performance.now();
      for (let i = 0; i < 300; i++) g.tick(1 / 60);
      stepMs = (performance.now() - t0) / 300;
      g.halted = false; R.enabled = was;
    }
    return { id, calls, tris, meshes, inst, casters, visible, lights, shadowLights, geos: gl.info.memory.geometries, tex: gl.info.memory.textures, stepMs: stepMs && +stepMs.toFixed(2), actors: g.session?.actors?.length ?? 0 };
  }, id).catch((e) => ({ id, error: e.message }));
  rows.push(r);
  console.log(JSON.stringify(r));
}
await h.close();

const bad = rows.filter((r) => r.error || r.calls > 700 || r.tris > 1.5e6 || (r.stepMs != null && r.stepMs > (/^turf/.test(r.id) ? 5 : 3)));
console.log('\nstage            calls    tris  meshes inst casters lights  stepMs');
for (const r of rows) {
  if (r.error) { console.log(`${r.id.padEnd(15)} ERROR ${r.error}`); continue; }
  console.log(`${r.id.padEnd(15)} ${String(r.calls).padStart(6)} ${String(Math.round(r.tris / 1000) + 'k').padStart(7)} ${String(r.meshes).padStart(6)} ${String(r.inst).padStart(4)} ${String(r.casters).padStart(7)} ${String(r.lights).padStart(6)} ${String(r.stepMs ?? '-').padStart(7)}`);
}
console.log(bad.length ? `\nOVER BUDGET: ${bad.map((r) => r.id).join(', ')}` : '\nall within budget');
process.exit(bad.length ? 1 : 0);
