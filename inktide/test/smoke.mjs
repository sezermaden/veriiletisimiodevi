// Scripted playtest (game-build Phase 5 #5): ~30 s of synthetic play — move, look, jump, fire,
// sub, special, swim, pause, resume, die, respawn — then assert the game is healthy.
import { launch, report } from './harness.mjs';

const h = await launch({ width: 480, height: 270 });
await h.open('/?stage=sandbox&q=low', 5);
const r = await h.page.evaluate(async () => {
  const g = __game, s = g.session, p = s.player;
  g.halted = true;
  const T = (n, fn) => { for (let i = 0; i < n; i++) { fn?.(i); g.tick(1 / 60); } };
  const key = (c, d) => g.input._injectKey(c, d);
  const camD = [];
  const sample = () => camD.push(s.camera.position.distanceTo(p.position));
  // run + look + jump + fire
  key('KeyW', true); key('Mouse0', true);
  T(240, (i) => { g.input._injectMouse(Math.sin(i * 0.05) * 12, 0); if (i % 50 === 0) key('Space', true); if (i % 50 === 2) key('Space', false); sample(); });
  key('Mouse0', false);
  // swim through own ink
  key('ShiftLeft', true); T(120, sample); key('ShiftLeft', false);
  key('KeyW', false);
  // sub weapon + special
  key('Mouse2', true); T(2); key('Mouse2', false); T(60, sample);
  p.special = 100; key('KeyQ', true); T(2); key('KeyQ', false); T(150, sample);
  // pause / resume
  g.openPause(); const pausedTop = g.ui.top?.constructor?.name || null; const wasPaused = g.ui.blocking;
  T(10); if (g.ui.top) g.ui.top.onBack?.(); T(10);
  const resumed = !g.ui.blocking;
  // die and respawn
  p.damage(500, { team: 2 });
  const died = !p.alive;
  T(60 * 4, sample);
  const respawned = p.alive;
  // frame timing with real rendering for a few frames
  g.halted = false;
  const t0 = performance.now(); const f0 = g.frames;
  await new Promise((res) => { const f = () => (g.frames - f0 >= 20 ? res() : requestAnimationFrame(f)); f(); });
  const msPerFrame = (performance.now() - t0) / 20;
  return {
    pausedTop, wasPaused, resumed, died, respawned, errors: g.errors.length,
    camMin: Math.min(...camD), camMax: Math.max(...camD),
    inkA: s.ink.coverage().a, pos: p.position.toArray().map((v) => +v.toFixed(2)), msPerFrame,
    actors: s.actors.length, projectiles: s.projectiles.list.length,
  };
});
console.log(JSON.stringify(r));
let ok = true;
ok &= report('no runtime errors during play', r.errors === 0);
ok &= report('pause opens a blocking screen and resumes', r.wasPaused && r.resumed, `top=${r.pausedTop}`);
ok &= report('player dies and respawns', r.died && r.respawned);
ok &= report('camera stays in bounds', r.camMin > 1.2 && r.camMax < 16, `${r.camMin.toFixed(2)}..${r.camMax.toFixed(2)} m`);
ok &= report('ink was painted', r.inkA > 20, `${r.inkA.toFixed(1)} m²`);
ok &= report('player stayed in the world', r.pos[1] > -5, `pos ${r.pos}`);
if (h.errors.length) { console.log(h.errors.join('\n')); ok = false; }
await h.close();
process.exit(ok ? 0 : 1);
