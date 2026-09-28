/* Feel contract.

   1. Jump acceptance: frames of dt = 0.0163 s (just under the 1/60 fixed step) — every press
      must jump. Negative control: the legacy path (edge read inside the fixed step, no snap)
      must lose presses, proving the test can see the bug.
   2. Vehicle camera stability: sample the boom while driving past walls. The camera never
      collapses, never flies off, and never jumps more than THRESH in one sample. Negative
      control: the legacy camera (ray from the chassis floor, unsmoothed boom) must exceed it.

   Thresholds are set BETWEEN the measured good and legacy values (see numbers printed). */
import { launch, frames } from './_browser.mjs';

const { page, errors, close } = await launch({ width: 960, height: 540 });
const log = (...a) => console.log(...a);
let fail = false;
const check = (name, ok, detail) => { log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); if (!ok) fail = true; };

await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 180000 });
await page.evaluate(() => window.__game.startSandbox('flatland'));
await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 180000 });
await frames(page, 5);

/* --------------------------------------------------------------- jumps */
async function jumpTrial(legacy) {
  return page.evaluate((legacy) => {
    const g = window.__game;
    g.manual = true;
    const p = g.player;
    p.legacyEdgeInStep = legacy;
    p.spawn({ x: 30, y: 0.05, z: -40 }, 0);
    for (let i = 0; i < 60; i++) g.tick(0.0163);
    let jumps = 0;
    for (let trial = 0; trial < 12; trial++) {
      const y0 = p.pos.y;
      g.input._injectKey('Space', true);
      g.tick(0.0163);
      g.input._injectKey('Space', false);
      let peak = y0;
      for (let i = 0; i < 70; i++) { g.tick(0.0163); peak = Math.max(peak, p.pos.y); }
      if (peak - y0 > 0.4) jumps++;
      // land fully before the next press
      for (let i = 0; i < 20; i++) g.tick(0.0163);
    }
    p.legacyEdgeInStep = false;
    g.manual = false;
    return jumps;
  }, legacy);
}
const good = await jumpTrial(false);
const bad = await jumpTrial(true);
check('jump acceptance (dt=0.0163)', good === 12, `${good}/12`);
check('negative control: legacy edge-in-step loses jumps', bad < 12, `${bad}/12 (must be < 12 to prove the test sees the bug)`);

/* --------------------------------------------------------------- vehicle camera */
async function camRun(legacy) {
  return page.evaluate((legacy) => {
    const g = window.__game;
    g.manual = true;
    g.legacyCam = legacy;
    // a corridor of walls to drive past, so the boom has to react
    const THREE = g.renderer.camera.position.constructor;
    for (const v of [...g.vehicles]) v.entity.remove();
    const walls = [];
    for (let i = 0; i < 8; i++) {
      const e = g.entities.spawnProp('container_red', { x: (i % 2 ? 4.5 : -4.5), y: 1.3, z: 20 + i * 8 }, undefined, { frozen: true, effect: false });
      walls.push(e);
    }
    g.spawnFromMenu; // keep tree-shakers honest
    const Vehicle = g.vehicles.constructor; void Vehicle;
    const v = new (window.__VehicleClass)(g, new THREE(0, 1.2, 10), 0);
    v.enter(g.player);
    const dists = [];
    let prev = null, maxStep = 0;
    for (let i = 0; i < 360; i++) {
      g.input._injectKey('KeyW', i < 300);
      g.input.look.x = 0;
      // swing the camera side to side so it sweeps across the containers
      v.camYaw = Math.PI + Math.sin(i / 25) * 1.2;
      g.tick(1 / 60);
      const cam = g.renderer.camera.position;
      const focus = v.entity.object3d.position;
      const d = cam.distanceTo(focus);
      dists.push(d);
      if (prev) maxStep = Math.max(maxStep, cam.distanceTo(prev));
      prev = cam.clone();
    }
    g.input._injectKey('KeyW', false);
    v.exit();
    v.entity.remove();
    for (const w of walls) w.remove();
    g.legacyCam = false;
    g.manual = false;
    return { min: Math.min(...dists), max: Math.max(...dists), maxStep };
  }, legacy);
}
await page.evaluate(async () => { const m = await import('./src/world/vehicle.js'); window.__VehicleClass = m.Vehicle; });
const cg = await camRun(false);
const cb = await camRun(true);
// Threshold between the measured values (good ≈ printed below, legacy ≈ printed below).
const THRESH = 0.85;
check('camera never collapses', cg.min > 1.4, `min ${cg.min.toFixed(2)} m`);
check('camera never flies away', cg.max < 10, `max ${cg.max.toFixed(2)} m`);
check('camera per-frame step below threshold', cg.maxStep < THRESH, `max step ${cg.maxStep.toFixed(2)} m (threshold ${THRESH})`);
check('negative control: legacy camera exceeds it', cb.maxStep > THRESH || cb.min < 1.4, `legacy max step ${cb.maxStep.toFixed(2)} m, legacy min ${cb.min.toFixed(2)} m`);

const errs = errors.filter((e) => !/favicon|404|Pointer Lock/i.test(e));
if (errs.length) { fail = true; log(errs.join('\n')); }
await close();
process.exit(fail ? 1 : 0);
