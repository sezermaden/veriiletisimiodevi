// Layout sweep (game-build Phase 5) at five shapes: 1920x1080, 2560x1440, 3840x2160, 16:10, 21:9.
// Per screen: something focused; hit targets >= --hit-min; nothing focusable outside the 5% safe
// area; no focusable text under 20 px; nothing clipped by overflow:hidden; the page does not scroll.
// .sr-only elements are excluded (visually hidden by design).
import { launch, report } from './harness.mjs';
import { walkScreens } from './ui-walk.mjs';

const ALL = [[1920, 1080], [2560, 1440], [3840, 2160], [1920, 1200], [2560, 1080]];
const only = process.argv.slice(2).map((a) => a.split('x').map(Number)).filter((a) => a.length === 2 && a[0]);
const SHAPES = only.length ? only : ALL;
let ok = true;
for (const [w, hgt] of SHAPES) {
  const h = await launch({ width: w, height: hgt });
  await h.open('/?q=low&render=0', 20);
  const problems = [];
  const screens = await walkScreens(h.page, async (name) => {
    const p = await h.page.evaluate(() => {
      const out = [];
      const top = __game.ui.top;
      const hitMin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hit-min')) || 64;
      const W = innerWidth, H = innerHeight, sx = W * 0.05 - 1, sy = H * 0.05 - 1;
      if (!top.focus.current) out.push('nothing focused');
      if (document.scrollingElement.scrollHeight > H + 2 || document.scrollingElement.scrollWidth > W + 2) out.push('page scrolls');
      const scale = H / 1080;   // hit-min is a 1080p value
      for (const el of top.focus.items) {
        if (el.closest('.sr-only')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const label = (el.innerText || '').trim().slice(0, 24) || el.className;
        if (r.height < hitMin * Math.min(1, scale) - 1) out.push(`"${label}" ${r.height.toFixed(0)}px tall < hit-min`);
        if (r.left < sx || r.top < sy || r.right > W - sx || r.bottom > H - sy) out.push(`"${label}" outside safe area (${r.left.toFixed(0)},${r.top.toFixed(0)},${r.right.toFixed(0)},${r.bottom.toFixed(0)})`);
        // smallest font among the elements that actually hold visible text inside this focusable
        let minFs = Infinity;
        for (const n of [el, ...el.querySelectorAll('*')]) {
          if (n.closest('.sr-only')) continue;
          const hasText = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
          if (!hasText) continue;
          const cs = getComputedStyle(n);
          if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
          minFs = Math.min(minFs, parseFloat(cs.fontSize));
        }
        // text scales with the viewport (clamp tokens); the rule is 20 px at 1080p
        if (minFs < 20 * Math.min(1, scale) - 0.5) out.push(`"${label}" text ${minFs}px < 20px`);
        // clipped by an overflow:hidden ancestor (scroll containers are allowed to hide items)
        let a = el.parentElement;
        while (a && a !== document.body) {
          const cs = getComputedStyle(a);
          if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') && !/auto|scroll/.test(cs.overflowY)) {
            const ar = a.getBoundingClientRect();
            if (r.right > ar.right + 1 || r.bottom > ar.bottom + 1 || r.left < ar.left - 1 || r.top < ar.top - 1) { out.push(`"${label}" clipped by ${a.className || a.tagName}`); break; }
          }
          a = a.parentElement;
        }
      }
      return out;
    });
    for (const x of p) problems.push(`${name}: ${x}`);
    if (w === 1920 && hgt === 1080) await h.page.screenshot({ path: `docs/shots/ui-${name.split(':')[0]}-1080.png` });
    if (w === 2560 && hgt === 1080) await h.page.screenshot({ path: `docs/shots/ui-${name.split(':')[0]}-21x9.png` });
  });
  ok &= report(`layout ${w}x${hgt} (${screens.length} screens)`, problems.length === 0 && screens.length >= 4, problems.slice(0, 12).join(' | '));
  if (h.errors.length) { console.log(h.errors.join('\n')); ok = false; }
  await h.close();
}
process.exit(ok ? 0 : 1);
