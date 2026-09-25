// Turf Clash results: the two turf bars fill with ink, the winner banner drops in, per-player stats
// (turf inked, splats, deaths, specials), the pearl reward and Rematch / Change Loadout / Main Menu.
import { Screen } from '../ui/screens.js';
import { promptHTML } from '../engine/game-input.js';
import { KITS } from '../weapons/base.js';
import { audio } from '../engine/audio.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

const WAVE = `<svg class="tr-wave" viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 0 H22 Q34 8 26 18 T30 38 Q40 50 28 60 T31 82 Q36 94 24 100 H0Z"/></svg>`;

export class TurfResultsScreen extends Screen {
  /**
   * @param {App} app
   * @param {object} r  arenaName, stageId, colors {a,b}, pctA, pctB, win, draw, pearls, players[], record, opts
   */
  constructor(app, r) {
    super(app, { className: 'turf-results', blocksGame: true });
    this.r = r;
    this.t = 0;
    this.shown = false;
    this.busy = false;
  }

  build() {
    const r = this.r;
    const row = (p) => `
      <div class="tr-row${p.isPlayer ? ' me' : ''}">
        <span class="tr-dot"></span>
        <span class="tr-name">${esc(p.name)}${p.isPlayer ? ' <em>YOU</em>' : ''}</span>
        <span class="tr-kit">${esc(KITS[p.kit]?.name || '')}</span>
        <span class="tr-num" title="Turf inked">${Math.round(p.inked)}<small>m²</small></span>
        <span class="tr-num" title="Splats">${p.splats}<small>splat${p.splats === 1 ? '' : 's'}</small></span>
        <span class="tr-num" title="Deaths">${p.deaths}<small>down</small></span>
        <span class="tr-num" title="Specials">${p.specials}<small>sp</small></span>
      </div>`;
    const A = r.players.filter((p) => p.team === 1), B = r.players.filter((p) => p.team === 2);
    const winTeam = r.win ? 'a' : 'b';
    this.el.style.setProperty('--turf-a', r.colors.a);
    this.el.style.setProperty('--turf-b', r.colors.b);
    this.el.innerHTML = `
      <div class="tr-scrim"></div>
      <div class="tr">
        <header class="tr-head">
          <div class="tr-kicker">TURF CLASH · ${esc(r.arenaName)}</div>
          <div class="tr-banner ${winTeam}"><span>${r.win ? 'VICTORY!' : 'DEFEAT'}</span></div>
          <div class="tr-sub">${r.win ? 'Your team inked the most turf.' : 'The rivals inked more turf this time.'}</div>
        </header>
        <section class="tr-bars">
          <div class="tr-bar a"><div class="tr-track"><div class="tr-fill">${WAVE}</div></div><span class="tr-team">ALPHA</span><span class="tr-pct">0.0%</span></div>
          <div class="tr-bar b"><div class="tr-track"><div class="tr-fill">${WAVE}</div></div><span class="tr-team">BRAVO</span><span class="tr-pct">0.0%</span></div>
        </section>
        <section class="tr-teams">
          <div class="tr-col a"><div class="tr-col-h">ALPHA</div>${A.map(row).join('')}</div>
          <div class="tr-col b"><div class="tr-col-h">BRAVO</div>${B.map(row).join('')}</div>
        </section>
        <div class="tr-bottom">
          <div class="tr-reward"><span class="tr-pearl"></span><span>+${r.pearls}</span><span class="tr-rec">${r.record.wins} W · ${r.record.losses} L</span></div>
          <nav class="tr-btns">
            <div class="btn tr-btn" data-act="rematch">REMATCH</div>
            <div class="btn tr-btn" data-act="loadout">CHANGE LOADOUT</div>
            <div class="btn tr-btn" data-act="menu">MAIN MENU</div>
          </nav>
          <div class="tr-foot"><span class="tr-prompt"></span> Select</div>
        </div>
      </div>`;
    this.bars = [this.el.querySelector('.tr-bar.a'), this.el.querySelector('.tr-bar.b')];
    for (const b of this.el.querySelectorAll('.tr-btn')) this.button(b, () => this.act(b.dataset.act), { autofocus: b.dataset.act === 'rematch' });
    this.refreshPrompt();
  }

  refreshPrompt() {
    const p = this.el.querySelector('.tr-prompt');
    if (p) p.innerHTML = promptHTML(this.app.input, 'ui_accept');
  }

  onEnter() {
    this.app.input.exitPointerLock?.();
    this.el.classList.add('anim');
  }

  onBack() { /* results are a destination: pick a button */ }

  update(dt) {
    this.t += dt;
    const r = this.r;
    const k = ease((this.t - 0.35) / 1.9);
    const vals = [r.pctA * k, r.pctB * k];
    for (let i = 0; i < 2; i++) {
      const b = this.bars[i];
      b.querySelector('.tr-fill').style.width = `${vals[i].toFixed(2)}%`;
      b.querySelector('.tr-pct').textContent = `${vals[i].toFixed(1)}%`;
    }
    if (!this.shown && this.t > 2.35) {
      this.shown = true;
      this.el.classList.add('revealed');
      this.bars[r.win ? 0 : 1].classList.add('won');
      audio.sfx(r.win ? 'victory' : 'defeat', { volume: 0.8 });
      if (r.win) audio.sfx('crowd_cheer', { volume: 0.5 });
    }
    if (this.app.input.lastDevice !== this._dev) { this._dev = this.app.input.lastDevice; this.refreshPrompt(); }
  }

  async act(what) {
    if (this.busy) return;
    this.busy = true;
    const app = this.app, r = this.r;
    let ui = null;
    try { ui = await import('../ui/boot-ui.js'); } catch { ui = null; }
    try {
      if (what === 'rematch') {
        let s = null;
        if (ui?.startStage) s = await ui.startStage(app, r.stageId, { ...r.opts });
        else {
          const { TurfMode } = await import('../game/modes/turf.js');
          s = await app.startSession({ stageId: r.stageId, mode: new TurfMode(app, r.stageId, r.opts), kit: r.opts.kit, lockPointer: false });
        }
        if (!s) this.busy = false;
        return;
      }
      if (what === 'menu' && ui?.quitToMenu) { await ui.quitToMenu(app, r.stageId); return; }
      // change loadout (or main menu without the UI helpers): leave the match, open the setup screen
      await app.fade(true, 320);
      app.ui.clear();
      app.endSession();
      if (what === 'loadout' && ui?.showTurfSetup) ui.showTurfSetup(app);
      else if (ui?.showMainMenu) {
        ui.showMainMenu(app);
        if (what === 'loadout') {
          try {
            const m = await import('../ui/turf-setup.js');
            if (m.TurfSetupScreen) app.ui.push(new m.TurfSetupScreen(app));
          } catch { /* setup screen unavailable: stay on the main menu */ }
        }
      }
      await app.fade(false, 380);
    } catch (e) {
      console.error('[turf] results action failed', e);
      this.busy = false;
    }
  }
}
