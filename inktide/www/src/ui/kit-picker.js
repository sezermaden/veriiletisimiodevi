// Quick kit picker shown before a stage: the unlocked kits as sticker cards; A starts the stage.
import { UiScreen, promptBar, esc } from './widgets.js';
import { KITS, SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';
import { save } from '../engine/save.js';
import { audio } from '../engine/audio.js';
import { kitIcon, subIcon, specialIcon } from './icons.js';
import { kitUnlocked } from './stage-data.js';

export class KitPickerScreen extends UiScreen {
  /** o: { title, onPick(kitId) } */
  constructor(app, o) {
    super(app, { className: 'kit-picker', transparent: true, blocksGame: false });
    this.o = o;
    this.picked = false;
  }

  build() {
    const ids = Object.keys(KITS).filter(kitUnlocked);
    const cur = ids.includes(save.data.kit) ? save.data.kit : ids[0];
    this.el.innerHTML = `
      <div class="dialog-scrim"></div>
      <div class="kp card">
        <div class="kp-head"><div class="kp-kicker">CHOOSE YOUR KIT</div><h2 class="kp-title">${esc(this.o.title || '')}</h2></div>
        <div class="kp-grid" style="--n:${Math.min(4, ids.length)}">
          ${ids.map((id, i) => {
            const k = KITS[id];
            return `<div class="kit-card" data-kit="${id}" style="--tilt:${(i % 2 ? 1 : -1) * 1.2}deg">
              <div class="kc-art">${kitIcon(k.main)}</div>
              <div class="kc-name">${esc(k.name)}</div>
              <div class="kc-subs"><span>${subIcon(k.sub)}${esc(SUB_INFO[k.sub]?.name || '')}</span><span>${specialIcon(k.special)}${esc(SPECIAL_INFO[k.special]?.name || '')}</span></div>
              ${id === save.data.kit ? '<span class="kc-badge">EQUIPPED</span>' : ''}
            </div>`;
          }).join('')}
        </div>
        <p class="kp-desc"></p>
        ${promptBar([['ui_accept', 'Go!'], ['ui_back', 'Back']])}
      </div>`;
    for (const c of this.$$('.kit-card')) this.button(c, () => this.pick(c.dataset.kit), { silent: true, autofocus: c.dataset.kit === cur });
  }

  onEnter() { audio.sfx('ui_open', { volume: 0.4 }); }

  onFocus(el) {
    const k = KITS[el.dataset.kit];
    if (k) this.$('.kp-desc').textContent = k.desc;
  }

  pick(id) {
    if (this.picked) return;
    this.picked = true;
    audio.sfx('ui_start', { volume: 0.7 });
    const card = this.el.querySelector(`.kit-card[data-kit="${id}"]`);
    card?.classList.add('chosen');
    // onPick may return a promise of the started session; a failed start re-arms the picker
    Promise.resolve(this.o.onPick?.(id)).then((s) => {
      if (s) return;
      this.picked = false;
      card?.classList.remove('chosen');
    });
  }
}
