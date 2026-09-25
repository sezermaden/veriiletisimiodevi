// Stage-clear results: time vs par, pearls, Lost Postcard, splats, rank stamp (C/B/A/S), rewards,
// a big NEW KIT UNLOCKED card, then Continue / Story Map / Retry. Saving happens in StoryMode
// before this screen is pushed; the screen only presents the result.
import { Screen } from '../ui/screens.js';
import { KITS, SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';
import { promptHTML } from '../engine/game-input.js';
import { splatPath } from './portraits.js';
import './sfx.js';

export const RANKS = ['C', 'B', 'A', 'S'];
export const RANK_BONUS = { S: 40, A: 25, B: 15, C: 8 };

/** Rank from clear time vs par and splat count. S needs par time and no splats. */
export function computeRank(time, par, deaths = 0) {
  const score = time / Math.max(1, par) + deaths * 0.2;
  if (score <= 1 && deaths === 0) return 'S';
  if (score <= 1.45) return 'A';
  if (score <= 2.1) return 'B';
  return 'C';
}

export function formatTime(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Weapon silhouettes for the kit card (viewBox 0 0 200 120, filled with the ink colour). */
export function weaponIcon(main) {
  const I = 'var(--ink-hero)', D = 'var(--bg)', W = 'var(--text)';
  const s = `stroke="${D}" stroke-width="5" stroke-linejoin="round"`;
  switch (main) {
    case 'roller': return `<rect x="26" y="20" width="96" height="44" rx="14" fill="${I}" ${s}/><rect x="34" y="28" width="80" height="10" rx="5" fill="${W}" opacity=".5"/><path d="M122 42 H150 L176 98" fill="none" stroke="${D}" stroke-width="12" stroke-linecap="round"/><path d="M122 42 H150 L176 98" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round"/>`;
    case 'charger': return `<rect x="14" y="48" width="150" height="16" rx="6" fill="${I}" ${s}/><rect x="120" y="40" width="46" height="34" rx="8" fill="${I}" ${s}/><path d="M150 74 L140 104 H160 L168 74Z" fill="${W}" ${s}/><circle cx="70" cy="40" r="10" fill="${W}" ${s}/><path d="M6 56 H14" stroke="#ff4b4b" stroke-width="4"/>`;
    case 'blaster': return `<rect x="40" y="32" width="96" height="40" rx="12" fill="${I}" ${s}/><rect x="14" y="26" width="40" height="52" rx="10" fill="${W}" ${s}/><path d="M112 72 L104 106 H128 L134 72Z" fill="${W}" ${s}/><circle cx="96" cy="52" r="8" fill="${D}"/>`;
    case 'slosher': return `<path d="M40 30 H132 L120 100 H52Z" fill="${I}" ${s}/><path d="M40 30 Q86 10 132 30" fill="none" stroke="${W}" stroke-width="7"/><ellipse cx="86" cy="32" rx="44" ry="8" fill="${W}" opacity=".45"/><path d="M132 44 Q168 50 160 88" fill="none" stroke="${D}" stroke-width="10" stroke-linecap="round"/>`;
    case 'splatling': return `<rect x="70" y="30" width="80" height="50" rx="14" fill="${I}" ${s}/>${[34, 48, 62].map((y) => `<rect x="10" y="${y}" width="66" height="10" rx="5" fill="${W}" ${s}/>`).join('')}<path d="M120 80 L112 110 H134 L140 80Z" fill="${W}" ${s}/><rect x="146" y="40" width="30" height="30" rx="10" fill="${I}" ${s}/>`;
    case 'brush': return `<path d="M20 46 Q20 20 58 22 L96 34 L96 70 L58 82 Q20 84 20 58Z" fill="${I}" ${s}/><rect x="94" y="40" width="22" height="24" rx="4" fill="${W}" ${s}/><path d="M116 52 L186 66" stroke="${D}" stroke-width="14" stroke-linecap="round"/><path d="M116 52 L186 66" stroke="${W}" stroke-width="7" stroke-linecap="round"/>`;
    case 'dualies': return `<g transform="translate(-6 -8)"><rect x="40" y="30" width="70" height="24" rx="8" fill="${I}" ${s}/><path d="M90 54 L84 80 H100 L106 54Z" fill="${W}" ${s}/></g><g transform="translate(46 34)"><rect x="40" y="30" width="70" height="24" rx="8" fill="${I}" ${s}/><path d="M90 54 L84 80 H100 L106 54Z" fill="${W}" ${s}/></g>`;
    default: return `<rect x="30" y="36" width="110" height="32" rx="10" fill="${I}" ${s}/><rect x="138" y="44" width="30" height="14" rx="5" fill="${W}" ${s}/><path d="M100 68 L90 104 H112 L120 68Z" fill="${W}" ${s}/><rect x="56" y="18" width="40" height="20" rx="8" fill="${W}" ${s}/>`;
  }
}

export class ResultsScreen extends Screen {
  /**
   * @param {object} r  stageId, meta, world, time, par, pearls, deaths, postcard, rank, prevRank,
   *                    newBest, bonus, total, kit, nextId, final
   * @param {object} actions onContinue, onMap, onRetry
   */
  constructor(app, r, actions = {}) {
    super(app, { blocksGame: true, transparent: true, className: 'story-results' });
    this.r = r;
    this.actions = actions;
    this.t = 0;
    this.revealed = false;
    this.steps = [];
    this.done = new Set();
    this.busy = false;
  }

  build() {
    const r = this.r, m = r.meta || {};
    const kit = r.kit ? KITS[r.kit] : null;
    const num = m.num || '';
    this.el.innerHTML = `
      <div class="sr-shade"></div>
      <div class="sr-wrap">
        <section class="sr-panel">
          <header class="sr-head">
            <div class="sr-clear">${r.final ? 'TIDEHAVEN SAVED!' : m.boss ? 'BOSS DEFEATED!' : 'STAGE CLEAR!'}</div>
            <div class="sr-stage"><b>${esc(num)}</b><span>${esc(m.title || r.stageId)}</span></div>
          </header>
          <div class="sr-rows">
            <div class="sr-row" data-k="time"><span class="k">Clear time</span><span class="v">0:00.0</span><span class="x">Par ${formatTime(r.par)}</span></div>
            <div class="sr-row" data-k="pearls"><span class="k"><i class="sr-pearl"></i>Pearls found</span><span class="v">0</span></div>
            <div class="sr-row" data-k="postcard"><span class="k">Lost Postcard</span><span class="v">${r.postcard ? '<em class="yes">FOUND!</em>' : '<em class="no">not found</em>'}</span><span class="x">${r.postcard ? esc(r.postcard.title || '') : ''}</span></div>
            <div class="sr-row" data-k="splats"><span class="k">Splats</span><span class="v">${r.deaths}</span><span class="x">${r.deaths === 0 ? 'Flawless!' : ''}</span></div>
          </div>
          <div class="sr-bottom">
            <div class="sr-rewards">
              <div class="rw" data-k="pearls">+${r.pearls} <small>pearls found</small></div>
              <div class="rw" data-k="bonus">+${r.bonus} <small>rank bonus</small></div>
              <div class="rw total" data-k="total"><i class="sr-pearl"></i>${r.total} <small>in your pouch</small></div>
            </div>
            <div class="sr-rank rank-${r.rank}">
              <svg viewBox="0 0 200 200" aria-hidden="true"><path d="${splatPath(100, 100, 78, 5, 13)}"/></svg>
              <b>${r.rank}</b>
              <span class="sr-rank-label">RANK</span>
              ${r.newBest && r.prevRank ? '<span class="sr-best">NEW BEST!</span>' : ''}
            </div>
          </div>
          <nav class="sr-buttons">
            <div class="sr-btn primary" data-a="continue">${r.final ? 'Finale' : r.nextId ? 'Continue' : 'Story Map'}</div>
            <div class="sr-btn" data-a="map">Story Map</div>
            <div class="sr-btn" data-a="retry">Retry</div>
          </nav>
          <div class="sr-hint"></div>
        </section>
        ${kit ? `
        <aside class="sr-kit">
          <div class="sr-kit-flag">NEW KIT UNLOCKED!</div>
          <svg class="sr-kit-art" viewBox="0 0 200 120" aria-hidden="true">${weaponIcon(kit.main)}</svg>
          <div class="sr-kit-name">${esc(kit.name)}</div>
          <div class="sr-kit-parts"><span>${esc(SUB_INFO[kit.sub]?.name || '')}</span><span>${esc(SPECIAL_INFO[kit.special]?.name || '')}</span></div>
          <p class="sr-kit-desc">${esc(kit.desc || '')}</p>
          <div class="sr-kit-foot">Equip it in the Armory</div>
        </aside>` : ''}
      </div>`;
    const q = (s) => this.el.querySelector(s);
    this.rows = [...this.el.querySelectorAll('.sr-row')];
    this.rewards = [...this.el.querySelectorAll('.rw')];
    this.rankEl = q('.sr-rank');
    this.kitEl = q('.sr-kit');
    this.timeV = q('.sr-row[data-k="time"] .v');
    this.pearlV = q('.sr-row[data-k="pearls"] .v');
    const btns = [...this.el.querySelectorAll('.sr-btn')];
    for (const b of btns) {
      const a = b.dataset.a;
      this.button(b, () => this._act(a), { autofocus: a === 'continue' });
    }
    if (!this.r.nextId && !this.r.final) q('.sr-btn[data-a="map"]').remove();
    if (this.r.final) { q('.sr-btn[data-a="map"]')?.remove(); q('.sr-btn[data-a="retry"]')?.remove(); }
    this.el.querySelector('.sr-hint').innerHTML = `${promptHTML(this.app.input, 'ui_accept')} Select`;
    // timeline
    const kitAt = 3.0;
    this.steps = [
      [0.35, () => this._row(0)], [0.75, () => this._row(1)], [1.15, () => this._row(2)], [1.5, () => this._row(3)],
      [2.05, () => this._stamp()], [2.45, () => this._reward(0)], [2.6, () => this._reward(1)], [2.75, () => this._reward(2)],
      ...(kit ? [[kitAt, () => this._kit()]] : []),
      [kit ? kitAt + 0.6 : 2.9, () => this._reveal()],
    ];
  }

  onEnter() { this.app.audio?.sfx?.('story_splash', { volume: 0.5 }); }

  _row(i) { this.rows[i]?.classList.add('in'); this.app.audio?.sfx?.('story_tick', { volume: 0.6, pitch: 0.8 + i * 0.1 }); }
  _reward(i) { this.rewards[i]?.classList.add('in'); this.app.audio?.sfx?.('coin', { volume: 0.4 }); }
  _stamp() {
    this.rankEl.classList.add('in');
    this.app.audio?.sfx?.('story_stamp', { volume: 0.9 });
    if (this.r.rank === 'S') this.app.audio?.sfx?.('ready', { volume: 0.5 });
  }
  _kit() { this.kitEl?.classList.add('in'); this.app.audio?.sfx?.('story_unlock', { volume: 0.8 }); }
  _reveal() {
    this.revealed = true;
    this.el.classList.add('ready');
    this.refreshFocus(true);
  }

  _fastForward() {
    for (let i = 0; i < this.steps.length; i++) if (!this.done.has(i)) { this.done.add(i); this.steps[i][1](); }
    this.t = 99;
  }

  async _act(a) {
    if (!this.revealed) { this._fastForward(); return; }
    if (this.busy) return;
    this.busy = true;
    try {
      if (a === 'continue') await (this.r.final || this.r.nextId ? this.actions.onContinue?.() : this.actions.onMap?.());
      else if (a === 'map') await this.actions.onMap?.();
      else if (a === 'retry') await this.actions.onRetry?.();
    } finally { this.busy = false; }
  }

  update(dt) {
    this.t += dt;
    for (let i = 0; i < this.steps.length; i++) {
      if (!this.done.has(i) && this.t >= this.steps[i][0]) { this.done.add(i); this.steps[i][1](); }
    }
    // count-ups
    const k = Math.min(1, Math.max(0, (this.t - 0.35) / 0.6));
    this.timeV.textContent = formatTime(this.r.time * (this.t >= 99 ? 1 : k));
    const kp = Math.min(1, Math.max(0, (this.t - 0.75) / 0.6));
    this.pearlV.textContent = String(Math.round(this.r.pearls * (this.t >= 99 ? 1 : kp)));
  }

  handleInput(input) {
    if (!this.revealed) {
      if (input.justPressed('ui_accept') || input.justPressed('advance')) this._fastForward();
      return true;
    }
    return false;
  }

  onBack() { /* results need an explicit choice */ }
}
