/* Input contract, run in the real page under SwiftShader.
   Edges queued between frames are published for exactly one frame; sticks have a
   radial deadzone; held directions repeat; a tap during a frame that ran no game
   step is still seen (the bug that eats half the presses). */
import { loadPlaywright, serve, launch, openGame, step, reporter, installFakePad } from './_lib.mjs';

const pw = await loadPlaywright();
const srv = await serve(8892);
const b = await launch(pw);
const { ok, done } = reporter('input');
const { page, errors } = await openGame(b, 8892);
await installFakePad(page);

// 1. keyboard edge queued between frames survives exactly one update()
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    I._pendingDown.add('confirm'); I._pendingUp.add('confirm');
    I.update(1 / 60);
    const a = { down: I.pressed('confirm'), up: I.released('confirm') };
    I.update(1 / 60);
    const b = { down: I.pressed('confirm'), up: I.released('confirm') };
    return { a, b };
  });
  ok(r.a.down && r.a.up, 'press+release inside one frame reports both edges');
  ok(!r.b.down && !r.b.up, 'edges are cleared on the next frame');
}

// 2. the frame-timing trap: a tap must register even when the frame ran zero fixed steps.
//    The game reads edges once per frame (not inside a step loop), so 12 taps → 12 registrations.
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    let seen = 0;
    for (let i = 0; i < 12; i++) {
      I._pendingDown.add('scratch');
      I.update(0.0163);            // just under 1/60 — an accumulator would skip this frame
      if (I.pressed('scratch')) seen++;
      I._pendingUp.add('scratch');
      I.update(0.0163);
    }
    return seen;
  });
  ok(r === 12, `12 taps at dt=0.0163 → ${r} registered (must be 12)`);
}

// 3. gamepad buttons: edge on press, held while down, edge on release
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    window.__padPress(0);
    I.update(1 / 60);
    const a = { down: I.pressed('confirm'), held: I.held('confirm') };
    I.update(1 / 60);
    const b = { down: I.pressed('confirm'), held: I.held('confirm') };
    window.__padRelease(0);
    I.update(1 / 60);
    const c = { up: I.released('confirm'), held: I.held('confirm') };
    return { a, b, c };
  });
  ok(r.a.down && r.a.held, 'A press: edge + held on the first frame');
  ok(!r.b.down && r.b.held, 'A still down: no new edge, still held');
  ok(r.c.up && !r.c.held, 'A release: release edge, no longer held');
}

// 4. radial deadzone: a worn stick resting at 0.12 produces zero movement; full tilt gives 1
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    window.__padAxes([0.12, -0.1, 0, 0]);
    I.update(1 / 60);
    const rest = { x: I.stick.x, y: I.stick.y, mx: I.move.x, my: I.move.y };
    window.__padAxes([1, 0, 0, 0]);
    I.update(1 / 60);
    const full = { x: I.stick.x, y: I.stick.y };
    window.__padAxes([0.7, 0.7, 0, 0]);
    I.update(1 / 60);
    const diag = Math.hypot(I.move.x, I.move.y);
    window.__padAxes([0, 0, 0, 0]);
    I.update(1 / 60);
    return { rest, full, diag };
  });
  ok(r.rest.x === 0 && r.rest.y === 0 && r.rest.mx === 0, 'stick at rest offset 0.12 → zero intent');
  ok(Math.abs(r.full.x - 1) < 1e-6, 'full tilt → 1.0');
  ok(r.diag <= 1.0001, `diagonal is not faster than straight (${r.diag.toFixed(3)})`);
}

// 5. held direction repeats: first edge immediately, next after the delay, then at the rate
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    window.__padPress(13);           // d-pad down
    let edges = 0;
    for (let i = 0; i < 60; i++) { I.update(1 / 60); if (I.pressed('down')) edges++; }   // 1.0 s held
    window.__padRelease(13);
    I.update(1 / 60);
    return edges;
  });
  ok(r >= 6 && r <= 8, `held d-pad for 1s fires ${r} edges (1 + repeats at ~0.105s after 0.38s)`);
}

// 6. trigger: RT is the scratch action, with hysteresis at 0.35
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    window.__padPress(7, 0.2); I.update(1 / 60);
    const low = I.held('scratch');
    window.__padPress(7, 0.9); I.update(1 / 60);
    const high = { down: I.pressed('scratch'), held: I.held('scratch') };
    window.__padRelease(7); I.update(1 / 60);
    const rel = I.released('scratch');
    return { low, high, rel };
  });
  ok(!r.low, 'RT at 0.2 does not scratch');
  ok(r.high.down && r.high.held, 'RT at 0.9 scratches (edge + held)');
  ok(r.rel, 'RT release reports the release edge');
}

// 7. device switching drives the prompt glyphs
{
  await page.evaluate(() => { window.__padPress(0); window.__game.input.update(1 / 60); window.__padRelease(0); window.__game.input.update(1 / 60); });
  const padGlyph = await page.evaluate(() => document.querySelector('#screens kbd[data-action="confirm"]')?.textContent);
  await page.keyboard.press('ShiftLeft');
  await step(page, 2);
  const kbGlyph = await page.evaluate(() => document.querySelector('#screens kbd[data-action="confirm"]')?.textContent);
  ok(padGlyph === 'A', `gamepad press switches prompts to Xbox glyphs (${padGlyph})`);
  ok(kbGlyph === 'Enter', `key press switches prompts back to keyboard (${kbGlyph})`);
}

// 8. blur releases everything
{
  const r = await page.evaluate(() => {
    const I = window.__game.input;
    I._keys.add('Space'); I._held.add('scratch');
    I.releaseAll();
    I.update(1 / 60);
    return { held: I.held('scratch'), up: I.released('scratch') };
  });
  ok(!r.held && r.up, 'releaseAll (window blur) releases held actions with a release edge');
}

ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);
await b.close(); srv.close();
process.exit(done() ? 1 : 0);
