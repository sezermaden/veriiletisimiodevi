import { launch, frames } from './_browser.mjs';
const { page, errors, close } = await launch();
try {
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', null, { timeout: 180000 });
  await frames(page, 5);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-veriiletisimiodevi/29302d3b-793b-5314-8507-30afcaade7eb/scratchpad/menu.png' });
  await page.evaluate(() => window.__game.startSandbox('foundry'));
  await page.waitForFunction(() => window.__game.state === 'playing', null, { timeout: 120000 });
  await frames(page, 10);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-veriiletisimiodevi/29302d3b-793b-5314-8507-30afcaade7eb/scratchpad/sandbox.png' });
} catch (e) { console.log('FAIL', e.message); }
console.log(errors.slice(0, 20).join('\n') || 'no errors');
await close();
