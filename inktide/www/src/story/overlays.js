// Story overlays drawn in the story layer: the stage title card (ink-splash intro), objective
// flash and the pearl chip bounce. Timing is driven by the caller (StoryMode) on the frame clock.
import { splatPath } from './portraits.js';
import { storyRoot } from './dialogue.js';

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/**
 * Stage title card: ink splash in the hero colour, world name, stage number, title, tagline.
 * @returns {{ el, close(): Promise }}
 */
export function showTitleCard(o = {}) {
  const root = o.parent || storyRoot();
  const el = document.createElement('div');
  el.className = 'story-title' + (o.boss ? ' boss' : '');
  el.style.setProperty('--st-ink', o.ink || 'var(--accent)');
  el.style.setProperty('--st-world', o.worldColor || 'var(--accent-2)');
  const drips = [0.18, 0.31, 0.47, 0.6, 0.74, 0.86].map((x, i) => `<i style="left:${x * 100}%;--d:${(i % 3) * 90 + 60}ms;--h:${[46, 70, 38, 88, 52, 64][i]}px"></i>`).join('');
  el.innerHTML = `
    <div class="st-card">
      <svg class="st-splat" viewBox="0 0 800 360" preserveAspectRatio="none" aria-hidden="true">
        <path d="${splatPath(400, 180, 170, 3, 16)}" transform="translate(400 180) scale(2.25 1) translate(-400 -180)"/>
        <circle cx="70" cy="70" r="22"/><circle cx="742" cy="296" r="16"/><circle cx="730" cy="58" r="10"/><circle cx="96" cy="310" r="12"/>
      </svg>
      <div class="st-drips">${drips}</div>
      <div class="st-world">${esc(o.world || '')}</div>
      <div class="st-num">${esc(o.boss ? 'BOSS' : o.num || '')}</div>
      <div class="st-title">${esc(o.title || '')}</div>
      ${o.subtitle ? `<div class="st-sub">${esc(o.subtitle)}</div>` : ''}
    </div>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  let closed = false;
  return {
    el,
    close() {
      if (closed) return Promise.resolve();
      closed = true;
      el.classList.add('out');
      return new Promise((r) => setTimeout(() => { el.remove(); r(); }, 520));
    },
  };
}

/** Flash the HUD objective panel when it changes. */
export function flashObjective(hud) {
  const el = hud?.root?.querySelector?.('.hud-objective');
  if (!el) return;
  el.classList.remove('story-flash');
  void el.offsetWidth;
  el.classList.add('story-flash');
}

/** Bounce the HUD pearl chip. */
export function bouncePearls(hud) {
  const el = hud?.root?.querySelector?.('.hud-chip.pearls');
  if (!el) return;
  el.classList.remove('story-bump');
  void el.offsetWidth;
  el.classList.add('story-bump');
}

/** Short banner under the objective (e.g. "CHECKPOINT!"). */
export function banner(text, kind = '') {
  const root = storyRoot();
  const el = document.createElement('div');
  el.className = 'story-banner ' + kind;
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2200);
  return el;
}
