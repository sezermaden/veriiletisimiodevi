// Shared: walk every menu screen reachable from the main menu (depth 2) and run a callback on each.
export async function walkScreens(page, onScreen, { maxDepth = 2 } = {}) {
  const seen = new Set();
  // title → main menu
  await page.evaluate(async () => {
    const wait = (n) => new Promise((r) => { const t = __game.frames + n; const f = () => (__game.frames >= t ? r() : requestAnimationFrame(f)); f(); });
    while (!__game.ui.top) await wait(2);
    __game.input._injectKey('Enter', true); await wait(2); __game.input._injectKey('Enter', false); await wait(20);
  });
  const screenName = () => page.evaluate(() => __game.ui.top ? (__game.ui.top.constructor.name + ':' + (__game.ui.top.el.className || '')) : null);
  const focusables = () => page.evaluate(() => (__game.ui.top?.focus?.items || []).map((el, i) => ({ i, text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40) })));
  async function visit(depth) {
    const name = await screenName();
    if (!name) return;
    await onScreen(name, depth);
    seen.add(name);
    if (depth >= maxDepth) return;
    const items = await focusables();
    for (const it of items) {
      if (/quit|exit|reset|delete|restart|start|play|begin|confirm|yes|rematch|buy|equip/i.test(it.text)) continue;   // don't trigger destructive/stage actions
      const before = await page.evaluate(() => __game.ui.stack.length);
      await page.evaluate(async (i) => {
        const wait = (n) => new Promise((r) => { const t = __game.frames + n; const f = () => (__game.frames >= t ? r() : requestAnimationFrame(f)); f(); });
        const f = __game.ui.top.focus;
        f.focus(f.items[i]); f.activate(); await wait(18);
      }, it.i);
      const after = await page.evaluate(() => __game.ui.stack.length);
      if (after > before) {
        const nm = await screenName();
        if (!seen.has(nm)) await visit(depth + 1);
        await page.evaluate(async () => {
          const wait = (n) => new Promise((r) => { const t = __game.frames + n; const f = () => (__game.frames >= t ? r() : requestAnimationFrame(f)); f(); });
          __game.ui.top.onBack(); await wait(18);
        });
      }
    }
  }
  await visit(0);
  return [...seen];
}
