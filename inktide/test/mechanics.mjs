// Core ink mechanics regression: submerge in own ink, climb a painted wall, cannot climb an
// unpainted wall, enemy ink slows, swimming refills the tank.
// (This suite caught the MeshBVH triangle-reordering bug: before the fix the ground probe
//  returned the wrong ink face and the player could never submerge or climb.)
import { launch, report } from './harness.mjs';

const h = await launch({ width: 320, height: 180 });
await h.open('/?stage=sandbox&q=low', 5);
const r = await h.page.evaluate(async () => {
  const g = __game, s = g.session, p = s.player;
  g.halted = true;
  const V = p.position.constructor;
  const up = new V(0, 1, 0);
  const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60); };
  const reset = (x, z) => { p.position.set(x, 0, z); p.velocity.set(0, 0, 0); p.form = 'kid'; p.model.setForm('kid', true); p.ink = p.inkMax; tick(3); };
  const out = {};
  // 1. submerge
  reset(0, 6);
  s.ink.paint(new V(0, 0, 6), 2, 1, up);
  g.input._injectKey('ShiftLeft', true); tick(6);
  out.submerged = p.submerged;
  // 2. refill while submerged
  p.ink = 10; tick(60);
  out.refillPerSec = p.ink - 10;
  g.input._injectKey('ShiftLeft', false); tick(6);
  // 3. climb a painted wall (brick wall face at z = -13, x in [-8, 8])
  reset(-4, -11.5);
  for (let y = 0.3; y < 5; y += 0.8) s.ink.paint(new V(-4, y, -13), 1.4, 1, new V(0, 0, 1));
  s.ink.paint(new V(-4, 0, -11.5), 1.6, 1, up);
  s.camRig.yaw = 0; tick(2);
  g.input._injectKey('ShiftLeft', true); g.input._injectKey('KeyW', true);
  let maxY = 0, climbed = false;
  for (let i = 0; i < 150; i++) { tick(1); maxY = Math.max(maxY, p.position.y); climbed ||= p.climbing; }
  g.input._injectKey('ShiftLeft', false); g.input._injectKey('KeyW', false); tick(30);
  out.climbed = climbed; out.climbMaxY = maxY; out.endY = p.position.y;
  // 4. unpainted wall: no climbing
  reset(6, -11.5);
  s.ink.paint(new V(6, 0, -11.5), 1.6, 1, up);
  g.input._injectKey('ShiftLeft', true); g.input._injectKey('KeyW', true);
  let climbedBare = false, maxBare = 0;
  for (let i = 0; i < 90; i++) { tick(1); climbedBare ||= p.climbing; maxBare = Math.max(maxBare, p.position.y); }
  g.input._injectKey('ShiftLeft', false); g.input._injectKey('KeyW', false); tick(10);
  out.climbedBare = climbedBare; out.maxBare = maxBare;
  // 5. enemy ink slows the kid
  const speedOn = (team) => {
    reset(-6, 14);
    if (team) s.ink.paint(new V(-6, 0, 11), 4, team, up);
    s.camRig.yaw = 0; tick(2);
    const z0 = p.position.z;
    g.input._injectKey('KeyW', true); tick(40);
    g.input._injectKey('KeyW', false); tick(2);
    return Math.abs(p.position.z - z0) / (40 / 60);
  };
  out.speedClean = speedOn(0);
  s.ink.clear();
  out.speedMurk = speedOn(2);
  g.halted = false;
  return out;
});
console.log(JSON.stringify(r));
let ok = true;
ok &= report('squid submerges in own ink', r.submerged);
ok &= report('swimming refills the tank fast', r.refillPerSec > 30, `${r.refillPerSec.toFixed(1)} ink/s`);
ok &= report('climbs a wall painted with own ink', r.climbed && r.climbMaxY > 3, `max y ${r.climbMaxY.toFixed(2)} m, end y ${r.endY.toFixed(2)} m`);
ok &= report('cannot climb an unpainted wall', !r.climbedBare && r.maxBare < 0.5, `max y ${r.maxBare.toFixed(2)} m`);
ok &= report('enemy ink slows the kid', r.speedMurk < r.speedClean * 0.6, `${r.speedClean.toFixed(2)} → ${r.speedMurk.toFixed(2)} m/s`);
if (h.errors.length) console.log(h.errors.filter((e) => !e.includes('boot-ui')).join('\n'));
await h.close();
process.exit(ok ? 0 : 1);
