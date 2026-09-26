// The kit's 16-assertion input/camera contract, run against the game's own engine/input.js + camera-rig.js.
import { launch } from './harness.mjs';

const h = await launch({ width: 200, height: 200 });
await h.page.goto(h.base + '/__input-test.html');
await h.page.waitForFunction('window.__done', null, { timeout: 60000 });
const out = await h.page.evaluate('window.__done');
console.log(out);
await h.close();
const failed = /HATA|FAIL/.test(out) || h.errors.length;
if (h.errors.length) console.log(h.errors.join('\n'));
process.exit(failed ? 1 : 0);
