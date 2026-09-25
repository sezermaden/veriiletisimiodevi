// The INKTIDE wordmark, built in CSS: one word stacked five times (hard offset shadow, dark keyline,
// accent glow, gradient face) over an ink-splat + squid-mantle brand mark, with animated drips and
// the "RISE OF THE MURK" tagline. The real text lives in an .sr-only label for screen readers.
import { splatPath } from './icons.js';

const WORD = 'INKTIDE';

/** Squid mantle silhouette (tip up, two fins, scalloped hem), 200×200 box. */
const MANTLE = 'M100 8C86 26 70 52 62 78L22 96C34 104 50 108 60 110 58 130 58 150 60 168 70 176 80 168 88 176 96 184 104 184 112 176 120 168 130 176 140 168 142 150 142 130 140 110 150 108 166 104 178 96L138 78C130 52 114 26 100 8Z';

/**
 * @param {object} o
 * @param {'xl'|'md'|'sm'} o.size
 * @param {boolean} o.tagline
 * @param {boolean} o.animate  entrance + idle motion
 */
export function logoHTML({ size = 'xl', tagline = true, animate = true } = {}) {
  const drips = [
    { x: 16.5, d: 0.0, h: 0.42 },
    { x: 44.5, d: 1.6, h: 0.3 },
    { x: 60.5, d: 0.8, h: 0.5 },
    { x: 93, d: 2.3, h: 0.36 },
  ];
  return `
  <div class="logo logo--${size}${animate ? ' logo--anim' : ''}">
    <span class="sr-only">INKTIDE — Rise of the Murk</span>
    <div class="logo-art" aria-hidden="true">
      <div class="logo-mark">
        <svg class="logo-splat" viewBox="-170 -170 340 340"><path d="${splatPath(7, 110, { arms: 8, drops: 7, lump: 0.1 })}"/></svg>
        <svg class="logo-mantle" viewBox="0 0 200 200"><path d="${MANTLE}"/><path class="logo-mantle-hl" d="M100 26C92 38 84 54 79 70" fill="none"/></svg>
      </div>
      <div class="logo-word">
        <span class="lw lw-shadow">${WORD}</span>
        <span class="lw lw-keyline">${WORD}</span>
        ${drips.map((d) => `<span class="lw-drip" style="--x:${d.x}%;--delay:${d.d}s;--len:${d.h}em"><i></i></span>`).join('')}
        <span class="lw lw-glow">${WORD}</span>
        <span class="lw lw-face">${WORD}</span>
      </div>
      ${tagline ? '<div class="logo-tag"><i></i><span>RISE OF THE MURK</span><i></i></div>' : ''}
    </div>
  </div>`;
}
