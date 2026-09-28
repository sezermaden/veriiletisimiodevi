import { launch, frames } from './_browser.mjs';
const SP = '/tmp/claude-0/-home-user-veriiletisimiodevi/29302d3b-793b-5314-8507-30afcaade7eb/scratchpad/';
const { page, errors, close } = await launch();
const log = (...a) => console.log(...a);
try {
  await page.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => window.__game.startSandbox('foundry'));
  await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
  await frames(page, 5);
  // spawn a crate in front
  const r1 = await page.evaluate(() => {
    const g = window.__game;
    g.player.rig.pitch = -0.35;
    g.player.updateCamera(1, 0);
    const e = g.spawnFromMenu('prop', 'crate');
    return { id: e?.id, pos: e?.curr.p.toArray(), count: g.entities.count('player') };
  });
  log('spawned', JSON.stringify(r1));
  await frames(page, 20);
  // grab with physgun: press Mouse0
  await page.evaluate(() => { const g = window.__game; g.weapons.select('physgun', true); g.input._injectKey('Mouse0', true); });
  await frames(page, 3);
  const held = await page.evaluate(() => !!window.__game.physgun.held);
  log('held after press:', held);
  // look up while holding -> object should rise
  const y0 = await page.evaluate(() => window.__game.physgun.held?.e.curr.p.y);
  await page.evaluate(() => { window.__game.player.rig.pitch = 0.2; });
  await frames(page, 30);
  const y1 = await page.evaluate(() => window.__game.physgun.held?.e.curr.p.y);
  log('held y', y0?.toFixed(2), '->', y1?.toFixed(2));
  await page.screenshot({ path: SP + 'physgun.png' });
  // freeze with Mouse2
  await page.evaluate(() => { const g = window.__game; g.input._injectKey('Mouse2', true); });
  await frames(page, 3);
  const fr = await page.evaluate(() => { const g = window.__game; g.input._injectKey('Mouse2', false); g.input._injectKey('Mouse0', false); const e = g.entities.list.find((x) => x.owner === 'player'); return { frozen: e.frozen, held: !!g.physgun.held, y: e.curr.p.y }; });
  log('after freeze', JSON.stringify(fr));
  await frames(page, 30);
  const fr2 = await page.evaluate(() => window.__game.entities.list.find((x) => x.owner === 'player').curr.p.y);
  log('frozen y after 30 frames', fr2.toFixed(2));
  // toolgun: weld crate to a new block
  const w = await page.evaluate(() => {
    const g = window.__game;
    g.player.rig.pitch = -0.4; g.player.updateCamera(1, 0);
    const b = g.spawnFromMenu('prop', 'block_05');
    g.weapons.give('toolgun'); g.weapons.select('toolgun', true);
    return !!b;
  });
  await frames(page, 30);
  // spawn menu screenshot
  await page.evaluate(() => window.__game.spawnmenu.toggle(true));
  await frames(page, 8);
  await page.screenshot({ path: SP + 'spawnmenu.png' });
  await page.evaluate(() => window.__game.spawnmenu.toggle(false));
  // shoot pistol at a barrel -> explosion chain
  const ex = await page.evaluate(() => {
    const g = window.__game;
    g.weapons.select('pistol', true);
    const THREE = null;
    const barrels = g.entities.list.filter((e) => e.key === 'barrel_red');
    return barrels.length;
  });
  log('red barrels', ex);
  await page.evaluate(() => { const g = window.__game; const b = g.entities.list.find((e) => e.key === 'barrel_red'); b.damage(100, { type: 'bullet' }); });
  await frames(page, 6);
  await page.screenshot({ path: SP + 'explosion.png' });
  const st = await page.evaluate(() => ({ barrels: window.__game.entities.list.filter((e) => e.key === 'barrel_red').length, hp: window.__game.player.health }));
  log('after explosion', JSON.stringify(st));
  // spawn npcs
  await page.evaluate(() => { const g = window.__game; g.player.rig.pitch = -0.2; g.player.updateCamera(1,0); g.spawnFromMenu('npc', 'citizen'); g.spawnFromMenu('npc', 'mannequin'); });
  await frames(page, 40);
  await page.screenshot({ path: SP + 'npcs.png' });
} catch (e) { log('FAIL', e.message); }
log(errors.filter((e) => !e.includes('favicon') && !e.includes('404')).slice(0, 20).join('\n') || 'no errors');
await close();
