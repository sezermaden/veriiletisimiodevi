// The INKTIDE wordmark, built in CSS: one word stacked four times (hard offset shadow, dark keyline,
// accent glow, gradient face) over an ink-splat brand mark with a squid peeking over the letters,
// animated drips running off the letters, and the "RISE OF THE MURK" tagline between thin rules.
// The real text lives in an .sr-only label for screen readers.
import { splatPath } from './icons.js';

const WORD = 'INKTIDE';

/** Letter index → drip (x = % of that letter's width, delay s, extra length em). */
const DRIPS = { 1: { x: 20, d: 0, h: 0.2 }, 3: { x: 50, d: 1.7, h: 0.12 }, 4: { x: 50, d: 0.8, h: 0.24 }, 6: { x: 24, d: 2.6, h: 0.16 } };

/** Squid peeking over the word: swept fins, rounded dome, big eyes; the skirt hides behind the letters.
 *  (Also the app icon mark: tools/make-icons.mjs.) */
export const SQUID = `
  <path class="sq-body" d="M100 6C82 24 70 48 66 74 48 80 30 92 14 108 34 116 52 118 66 114 64 134 64 152 66 172H134C136 152 136 134 134 114 148 118 166 116 186 108 170 92 152 80 134 74 130 48 118 24 100 6Z"/>
  <path class="sq-skirt" d="M64 166H136V206C136 218 126 222 120 212 114 226 104 228 100 214 96 228 86 226 80 212 74 222 64 218 64 206Z"/>
  <path class="sq-hl" d="M94 28C86 38 80 52 77 68"/>
  <ellipse class="sq-eye" cx="82" cy="134" rx="13" ry="17"/><ellipse class="sq-eye" cx="118" cy="134" rx="13" ry="17"/>
  <ellipse class="sq-pupil" cx="85" cy="139" rx="7" ry="9"/><ellipse class="sq-pupil" cx="121" cy="139" rx="7" ry="9"/>
  <circle class="sq-glint" cx="88" cy="134" r="3"/><circle class="sq-glint" cx="124" cy="134" r="3"/>`;

/**
 * @param {object} o
 * @param {'xl'|'md'|'sm'} o.size
 * @param {boolean} o.tagline
 * @param {boolean} o.animate  entrance + idle motion
 */
export function logoHTML({ size = 'xl', tagline = true, animate = true } = {}) {
  const keyline = [...WORD].map((c, i) => {
    const d = DRIPS[i];
    return `<span class="ch">${c}${d ? `<span class="lw-drip" style="--x:${d.x}%;--delay:${d.d}s;--len:${d.h}em"><i></i></span>` : ''}</span>`;
  }).join('');
  return `
  <div class="logo logo--${size}${animate ? ' logo--anim' : ''}">
    <span class="sr-only">INKTIDE — Rise of the Murk</span>
    <div class="logo-art" aria-hidden="true">
      <div class="logo-word">
        <svg class="logo-splat" viewBox="-170 -170 340 340" preserveAspectRatio="none"><path d="${splatPath(7, 110, { arms: 8, drops: 7, lump: 0.1 })}"/></svg>
        <svg class="logo-squid" viewBox="0 0 200 240">${SQUID}</svg>
        <span class="lw lw-shadow">${WORD}</span>
        <span class="lw lw-keyline">${keyline}</span>
        <span class="lw lw-glow">${WORD}</span>
        <span class="lw lw-face">${WORD}</span>
      </div>
      ${tagline ? '<div class="logo-tag"><i></i><span>RISE OF THE MURK</span><i></i></div>' : ''}
    </div>
  </div>`;
}
