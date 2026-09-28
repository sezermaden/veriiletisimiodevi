/* Store screenshots at 1920x1080 from real gameplay. Waits on frames, not time.
     node tools/shots.mjs [--only menu,sandbox,...]  -> Propworks/StoreArt/Screenshots/ */
import { launch, frames } from '../test/_browser.mjs';
import { mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../Propworks/StoreArt/Screenshots');
await mkdir(OUT, { recursive: true });
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();
const want = (n) => !only || only.includes(n);

const { page, close } = await launch({ width: 1920, height: 1080 });
await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 180000 });
await page.evaluate(() => { window.__game.storySpeed = 20; });
const shot = async (name) => { await page.screenshot({ path: resolve(OUT, name + '.png') }); console.log(name); };
const ev = (f, a) => page.evaluate(f, a);

if (want('menu')) { await frames(page, 40); await shot('01-main-menu'); }

if (want('sandbox')) {
  await ev(() => window.__game.startSandbox('foundry'));
  await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 180000 });
  await ev(() => {
    const g = window.__game;
    const V = (x, y, z) => ({ x, y, z });
    g.player.spawn(V(-24, 0.05, 6), -2.2);
    g.player.rig.pitch = -0.08;
    const Q = g.renderer.camera.quaternion.constructor;
    const put = (k, x, y, z, fr = true) => { const e = g.entities.spawnProp(k, V(x, y, z), new Q(), { owner: 'player', effect: false, frozen: fr }); return e; };
    // a little contraption: a plate car with wheels and a thruster, plus a floating tower
    const base = put('plate_2x4', -16, 0.9, 6);
    for (const [x, z] of [[-17.05, 4.7], [-14.95, 4.7], [-17.05, 7.3], [-14.95, 7.3]]) g.toolgun || g.weapons.give('toolgun');
    const tg = g.toolgun;
    for (const [x, z, nx] of [[-17.02, 5, -1], [-14.98, 5, 1], [-17.02, 7, -1], [-14.98, 7, 1]]) tg.tools.wheel.left.call(tg.tools.wheel, { point: V(x, 0.9, z), normal: V(nx, 0, 0), entity: base });
    put('block_05', -16, 1.2, 5.5); put('barrel_red', -16, 1.4, 7);
    for (let i = 0; i < 5; i++) put(i % 2 ? 'crate' : 'block_1', -12 + (i % 2) * 0.3, 0.5 + i * 1.0, 1.5);
    put('plate_2', -12, 6, 1.5);
    put('melon', -20, 2.6, 2, true); put('duck', -19, 3.4, 2.5, true); put('beachball', -21, 4.2, 1, true);
    const bl = ['#ff3030', '#2fb8ff', '#ffd21f'];
    for (let i = 0; i < 3; i++) g.spawnFromMenu('balloon');
    g.npcs.spawn('mannequin', V(-20, 0.05, 9), 0);
    g.weapons.select('physgun', true);
    void bl;
  });
  await frames(page, 60);
  // hold something with the physgun for the beam
  await ev(() => { const g = window.__game; const V = (x, y, z) => ({ x, y, z }); const Q = g.renderer.camera.quaternion.constructor; g.entities.spawnProp('crate', V(-20.5, 1.8, 3.6), new Q(), { owner: 'player', effect: false }); });
  await frames(page, 30);
  await ev(() => { const g = window.__game; g.player.rig.pitch = -0.02; g.input._injectKey('Mouse0', true); });
  await frames(page, 25);
  await ev(() => { const g = window.__game; g.weapons.selectorT = 0; });
  await frames(page, 5);
  await shot('02-sandbox-physgun');
  await ev(() => { const g = window.__game; g.input._injectKey('Mouse0', false); g.spawnmenu.toggle(true); });
  await frames(page, 30);
  await shot('03-spawn-menu');
  await ev(() => window.__game.spawnmenu.toggle(false));
}

async function chapter(id, section, setup, name) {
  await ev((id) => window.__game.startChapter(id, null), id);
  await page.waitForFunction((id) => window.__game.chapterId === id && window.__game.state === 'playing' && window.__game.story, id, { timeout: 180000 });
  if (section) await ev((s) => { window.__game.startChapter(window.__game.chapterId, s); }, section);
  await page.waitForFunction((s) => !s || window.__game.story?.current === s, section, { timeout: 180000 });
  await frames(page, 10);
  await ev(setup);
  await frames(page, 70);
  await ev(() => { window.__game.hud.clearHints(); });
  await shot(name);
}

if (want('cargo')) await chapter('ch2', 'cargo', () => {
  const g = window.__game; const H = g.env.handles;
  g.player.spawn({ x: -7, y: 0.05, z: 66 }, -2.5); g.player.rig.pitch = 0.32;
  const b = g.toolgun.tools.balloon; b.o.force = 5;
  for (const [x, z] of [[-1.2, -2.5], [1.2, -2.5], [-1.2, 2.5], [1.2, 2.5], [0, 0]]) b.left.call(b, { point: { x: H.pod.curr.p.x + x, y: 2.6, z: H.pod.curr.p.z + z }, normal: { x: 0, y: 1, z: 0 }, entity: H.pod });
  g.weapons.select('toolgun', true);
}, '04-balloon-cargo');

if (want('proving')) await chapter('ch3', 'gate1', () => {
  const g = window.__game;
  g.player.spawn({ x: 6, y: 0.1, z: 95 }, 2.5); g.player.rig.pitch = -0.05;
}, '05-proving-grounds');

if (want('combat')) await chapter('ch4', 'storage', () => {
  const g = window.__game;
  g.player.godMode = true;
  g.player.spawn({ x: 0, y: 0.05, z: 80 }, Math.PI); g.player.rig.pitch = 0;
  g.weapons.give('shotgun', { select: true });
  g.player.toggleFlashlight();
}, '06-archive-combat');

if (want('boss')) await chapter('ch5', 'boss', () => {
  const g = window.__game;
  g.player.godMode = true;
  g.player.spawn({ x: 5, y: 0.05, z: 24 }, Math.PI * 0.95); g.player.rig.pitch = 0.18;
  g.weapons.select('gravgun', true);
}, '07-boss');

await close();
