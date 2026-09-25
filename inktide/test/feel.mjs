// Feel contract (game-build Phase 5) with negative controls.
//  1. Jump acceptance: frames alternate 16.30 / 17.04 ms (a 60 Hz display with sub-ms jitter).
//     Every press must jump. legacyEdges=true reproduces the old bug (edges read inside the fixed
//     step, no SNAP) and must lose presses — otherwise the test proves nothing.
//  2. Camera stability: camera→player distance sampled every frame while running, strafing,
//     jumping and looking around obstacles. legacy=true (ray from the feet, unsmoothed boom) must
//     fail the same thresholds.
import { launch, report } from './harness.mjs';

const h = await launch({ width: 320, height: 180 });
await h.open('/?stage=sandbox&q=low', 10);

const jumpTest = (legacy) => h.page.evaluate(async (legacy) => {
  const g = __game, s = g.session, p = s.player;
  g.halted = true;
  s.legacyEdges = legacy;
  s._acc = 0;
  p.position.set(0, 0, 8); p.velocity.set(0, 0, 0);
  const DTS = [0.0163, 0.01704];
  let f = 0;
  const tick = () => g.tick(DTS[f++ % 2]);
  for (let i = 0; i < 40; i++) tick();
  let jumps = 0;
  for (let k = 0; k < 12; k++) {
    for (let i = 0; i < 3 + (k % 2); i++) tick();          // presses land on both frame phases
    const y0 = p.position.y;
    g.input._injectKey('Space', true); tick(); g.input._injectKey('Space', false);
    let maxY = p.position.y;
    for (let i = 0; i < 120; i++) { tick(); maxY = Math.max(maxY, p.position.y); if (i > 8 && p.grounded) break; }
    if (maxY - y0 > 0.4) jumps++;
  }
  s.legacyEdges = false;
  g.halted = false;
  return jumps;
}, legacy);

const camTest = (legacy) => h.page.evaluate(async (legacy) => {
  const g = __game, s = g.session, p = s.player, cam = s.camera;
  g.halted = true;
  s.camRig.legacy = legacy;
  p.position.set(0, 0, 8); p.velocity.set(0, 0, 0); s.camRig.snap(p);
  const d = [];
  let prev = null, maxStep = 0;
  const seq = [['KeyW', 140], ['KeyA', 60], ['KeyS', 160], ['KeyD', 80], ['KeyW', 120]];
  let t = 0;
  for (const [key, n] of seq) {
    g.input._injectKey(key, true);
    for (let i = 0; i < n; i++, t++) {
      if (t % 45 === 0) g.input._injectKey('Space', true);
      if (t % 45 === 1) g.input._injectKey('Space', false);
      g.input._injectMouse(Math.sin(t * 0.05) * 14, Math.cos(t * 0.031) * 4);
      g.tick(1 / 60);
      const dist = cam.position.distanceTo(p.position);
      d.push(dist);
      if (prev != null) maxStep = Math.max(maxStep, Math.abs(dist - prev));
      prev = dist;
    }
    g.input._injectKey(key, false);
  }
  // back the player up against the brick wall so the boom must pull in (occlusion path)
  p.position.set(0, 0, -11.4); p.velocity.set(0, 0, 0);
  s.camRig.yaw = Math.PI; s.camRig.pitch = -0.1; s.camRig.snap(p); s.camRig.yaw = Math.PI;
  for (let i = 0; i < 3; i++) g.tick(1 / 60);
  prev = cam.position.distanceTo(p.position);
  const seq2 = [['KeyS', 50], ['KeyA', 70], ['KeyD', 120], ['KeyW', 40], ['KeyS', 60]];
  for (const [key, n] of seq2) {
    g.input._injectKey(key, true);
    for (let i = 0; i < n; i++, t++) {
      if (t % 50 === 0) g.input._injectKey('Space', true);
      if (t % 50 === 1) g.input._injectKey('Space', false);
      g.input._injectMouse(Math.sin(t * 0.07) * 10, Math.sin(t * 0.043) * 6);
      g.tick(1 / 60);
      const dist = cam.position.distanceTo(p.position);
      d.push(dist);
      maxStep = Math.max(maxStep, Math.abs(dist - prev));
      prev = dist;
    }
    g.input._injectKey(key, false);
  }
  s.camRig.legacy = false;
  g.halted = false;
  return { min: Math.min(...d), max: Math.max(...d), maxStep };
}, legacy);

let ok = true;
const fixedJ = await jumpTest(false);
const legacyJ = await jumpTest(true);
ok &= report('jump acceptance (fixed code)', fixedJ === 12, `${fixedJ}/12`);
ok &= report('negative control: legacy edge handling loses presses', legacyJ < 12, `${legacyJ}/12`);

const cf = await camTest(false);
const cl = await camTest(true);
// STEP_MAX comes from measurement: fixed rig max step 0.175 m, legacy rig 3.06 m (wall-backing
// run included). The threshold sits between the two so the test is known to go red on the old rig.
const STEP_MAX = 0.7;
const camOk = (c) => c.min > 1.8 && c.max < 16 && c.maxStep < STEP_MAX;
ok &= report('camera stability (fixed rig)', camOk(cf), `min ${cf.min.toFixed(2)} m, max ${cf.max.toFixed(2)} m, max step ${cf.maxStep.toFixed(3)} m`);
ok &= report('negative control: legacy rig fails', !camOk(cl), `min ${cl.min.toFixed(2)} m, max ${cl.max.toFixed(2)} m, max step ${cl.maxStep.toFixed(3)} m`);

if (h.errors.length) { console.log(h.errors.join('\n')); ok = false; }
await h.close();
process.exit(ok ? 0 : 1);
