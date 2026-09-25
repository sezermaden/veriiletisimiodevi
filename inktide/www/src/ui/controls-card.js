// Controls reference card: current bindings for keyboard+mouse and gamepad, side by side.
import { UiScreen, promptBar, heading, esc } from './widgets.js';
import { keyName, padName, ACTION_LABELS } from '../engine/game-input.js';
import { audio } from '../engine/audio.js';
import { menuIcon } from './icons.js';

const ROWS = [
  ['move', 'Move'], ['look', 'Look / aim'], ['fire', ACTION_LABELS.fire], ['swim', ACTION_LABELS.swim], ['jump', ACTION_LABELS.jump],
  ['sub', ACTION_LABELS.sub], ['special', ACTION_LABELS.special], ['interact', ACTION_LABELS.interact], ['map', ACTION_LABELS.map],
  ['recenter', ACTION_LABELS.recenter], ['pause', 'Pause'],
];

function padChip(i) {
  const n = padName(i);
  const cls = { A: 'a', B: 'b', X: 'x', Y: 'y' }[n] || 'shoulder';
  return `<span class="kbd pad ${cls}">${esc(n)}</span>`;
}
const keyChip = (c) => `<span class="kbd">${esc(keyName(c))}</span>`;

export class ControlsCardScreen extends UiScreen {
  constructor(app) { super(app, { className: 'controls-card' + (app.session ? ' in-game' : ''), blocksGame: true }); }

  build() {
    this.el.innerHTML = `
      <div class="cc">
        <header class="cc-head">${heading('CONTROLS', { seed: 44 })}</header>
        <div class="cc-body card" data-scroll>
          <div class="cc-cols"><span></span><span class="cc-col">${menuIcon('armory')}KEYBOARD &amp; MOUSE</span><span class="cc-col">${menuIcon('controls')}GAMEPAD</span></div>
          <div class="cc-rows"></div>
        </div>
        <div class="cc-actions"><div class="btn cc-back">Back</div><div class="btn cc-rebind">Rebind controls…</div></div>
        <footer class="cc-foot">${promptBar([['ui_accept', 'Select'], ['ui_up,ui_down', 'Scroll'], ['ui_back', 'Back']])}</footer>
      </div>`;
    this.body = this.$('.cc-body');
    this.scrollHint = this.$('.cc-foot .pb-item[data-act="ui_up"]');
    this.body.addEventListener('scroll', () => this.updateScroll(), { passive: true });
    this.renderRows();
    this.button(this.$('.cc-back'), () => this.onBack(), { autofocus: true, silent: true });
    this.button(this.$('.cc-rebind'), async () => {
      const { OptionsScreen } = await import('./options.js');
      this.app.ui.push(new OptionsScreen(this.app, { tab: 1, inGame: !!this.app.session }));
    });
  }

  onEnter() { requestAnimationFrame(() => this.updateScroll()); }
  onResume() { this.renderRows(); this.updateScroll(); }

  /** The two buttons sit side by side, so up/down (d-pad, arrows, left stick) scroll the card:
   *  on a 720p screen the last rows are below the fold and a pad user has no other way to them. */
  handleInput(input) {
    const d = input.navPressed();
    if (d !== 'up' && d !== 'down') return false;
    const b = this.body;
    if (b.scrollHeight - b.clientHeight > 2) {
      b.scrollBy({ top: (d === 'down' ? 1 : -1) * Math.max(60, b.clientHeight * 0.45), behavior: 'smooth' });
      audio.sfx('ui_move', { volume: 0.3 });
    }
    return true;
  }

  update(dt) {
    super.update(dt);
    // right stick: smooth continuous scroll
    const ry = this.input.stick?.ry || 0;
    if (Math.abs(ry) > 0.3) this.body.scrollTop += ry * 900 * Math.min(dt, 0.05);
  }

  updateScroll() {
    const b = this.body;
    if (!b) return;
    const max = b.scrollHeight - b.clientHeight;
    b.classList.toggle('more', max > 2 && b.scrollTop < max - 2);
    if (this.scrollHint) this.scrollHint.hidden = max <= 2;
  }

  renderRows() {
    const b = this.input.bindings;
    const keysOf = (a) => (b[a]?.keys || []).map(keyChip).join('<span class="or">/</span>') || '<span class="none">—</span>';
    const padOf = (a) => (b[a]?.pad || []).map(padChip).join('<span class="or">/</span>') || '<span class="none">—</span>';
    this.$('.cc-rows').innerHTML = ROWS.map(([a, label]) => {
      let k, p;
      if (a === 'move') { k = ['forward', 'left', 'back', 'right'].map((x) => keyChip(b[x]?.keys?.[0])).join(''); p = '<span class="kbd pad shoulder">L-Stick</span>'; }
      else if (a === 'look') { k = '<span class="kbd">Mouse</span>'; p = '<span class="kbd pad shoulder">R-Stick</span>'; }
      else { k = keysOf(a); p = padOf(a); }
      return `<div class="cc-row"><span class="cc-label">${esc(label)}</span><span class="cc-k">${k}</span><span class="cc-p">${p}</span></div>`;
    }).join('');
  }

  onBack() {
    audio.sfx('ui_back', { volume: 0.5 });
    this.app.ui.pop();
  }
}
