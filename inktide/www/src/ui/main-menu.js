// Main menu — concept variant 1: left rail over the live plaza, info sticker for the focused mode,
// pearl chip, prompt bar.
import { UiScreen, promptBar, pearlChip, esc, confirmDialog } from './widgets.js';
import { logoHTML } from './logo.js';
import { menuIcon } from './icons.js';
import { audio } from '../engine/audio.js';
import { save } from '../engine/save.js';
import { KITS } from '../weapons/base.js';
import { clearedCount, STAGE_ORDER, kitUnlocked, nextStage, stageNum, stageMeta, loadStageMeta } from './stage-data.js';
import { VERSION, TitleScreen } from './title.js';
import { StoryMapScreen } from './story-map.js';
import { TurfSetupScreen } from './turf-setup.js';
import { ArmoryScreen } from './armory.js';
import { OptionsScreen } from './options.js';
import { CreditsScreen } from './credits.js';

const ITEMS = [
  { id: 'story', label: 'STORY MODE', icon: 'story', kicker: 'Campaign' },
  { id: 'turf', label: 'TURF CLASH', icon: 'turf', kicker: '4 vs 4' },
  { id: 'armory', label: 'ARMORY', icon: 'armory', kicker: 'Kits & upgrades' },
  { id: 'options', label: 'OPTIONS', icon: 'options', kicker: 'Settings' },
  { id: 'credits', label: 'CREDITS', icon: 'credits', kicker: 'The crew' },
];

export class MainMenuScreen extends UiScreen {
  constructor(app) { super(app, { className: 'main-menu', blocksGame: false }); }

  get items() {
    // desktop UWP shell: offer Quit (on Xbox the guide button owns app exit; in a browser there is nothing to quit)
    return this.app.host?.CAN_QUIT ? [...ITEMS, { id: 'quit', label: 'QUIT GAME', icon: 'quit', kicker: 'See you soon' }] : ITEMS;
  }

  build() {
    const items = this.items;
    this.el.innerHTML = `
      <div class="mm-shade"></div>
      <div class="mm${items.length > 5 ? ' has-quit' : ''}">
        <div class="mm-rail">
          <div class="mm-logo">${logoHTML({ size: 'sm', animate: false })}</div>
          <nav class="mm-items" aria-label="Main menu">
            ${items.map((it, i) => `<div class="rail-item" data-id="${it.id}" style="--i:${i}">
              <span class="ri-bar"></span>${menuIcon(it.icon)}<span class="ri-label">${it.label}</span><span class="ri-meta"></span></div>`).join('')}
          </nav>
        </div>
        <div class="mm-top">${pearlChip()}</div>
        <div class="mm-info card sticker" aria-live="polite">
          <div class="mi-kicker"></div>
          <div class="mi-title"></div>
          <div class="mi-text"></div>
          <div class="mi-stat"></div>
        </div>
        <div class="mm-foot">${promptBar([['ui_accept', 'Select'], ['ui_back', 'Title']])}<span class="mm-ver">v${VERSION}</span></div>
      </div>`;
    for (const el of this.$$('.rail-item')) this.button(el, () => this.open(el.dataset.id), { autofocus: el.dataset.id === 'story' });
    loadStageMeta().then(() => this.refresh());
  }

  onEnter() {
    this.app.menuScene?.setShot('menu');
    try { audio.playMusic('menu'); } catch { /* optional */ }
    this.refresh();
  }

  onResume() {
    this.app.menuScene?.setShot('menu');
    try { audio.playMusic('menu'); } catch { /* optional */ }
    this.refresh();
  }

  refresh() {
    const kits = Object.keys(KITS);
    const metas = {
      story: `${clearedCount()}/${STAGE_ORDER.length}`,
      turf: save.data.turf?.played ? `${save.data.turf.wins}W` : 'NEW',
      armory: `${kits.filter(kitUnlocked).length}/${kits.length}`,
      options: '', credits: '',
    };
    for (const el of this.$$('.rail-item')) el.querySelector('.ri-meta').textContent = metas[el.dataset.id] || '';
    const chip = this.$('.pc-n');
    if (chip) chip.textContent = String(save.data.pearls || 0);
    if (this.focus.current) this.onFocus(this.focus.current);
  }

  onFocus(el) {
    const id = el?.dataset?.id;
    const it = this.items.find((x) => x.id === id);
    if (!it) return;
    const info = this.$('.mm-info');
    const kits = Object.keys(KITS);
    let title = it.label, text = '', stat = '';
    if (id === 'story') {
      const n = nextStage();
      text = 'Take Tidehaven back from Baron Murkwell, one Prism Core at a time. Four worlds, fifteen stages.';
      stat = clearedCount() ? `Next up: <b>${esc(stageNum(n))} ${esc(stageMeta(n).title)}</b>` : 'Start your adventure at <b>1-1 First Splash</b>';
    } else if (id === 'turf') {
      const t = save.data.turf || {};
      text = 'Four-on-four turf war against bots. Ink the most ground in three minutes to win.';
      stat = t.played ? `Record <b>${t.wins} W · ${t.losses} L</b>` : 'Three arenas, three difficulties';
    } else if (id === 'armory') {
      text = 'Equip one of eight weapon kits and trade pearls for upgrades with Shelly.';
      stat = `Kits unlocked <b>${kits.filter(kitUnlocked).length} / ${kits.length}</b>`;
    } else if (id === 'options') {
      text = 'Audio, controls and full remapping, video quality, colour-blind ink and more.';
    } else if (id === 'credits') {
      text = 'The crew and the open-source tools behind INKTIDE.';
    } else if (id === 'quit') {
      text = 'Close INKTIDE. Your progress is saved automatically after every stage.';
    }
    info.querySelector('.mi-kicker').textContent = it.kicker.toUpperCase();
    info.querySelector('.mi-title').textContent = title;
    info.querySelector('.mi-text').textContent = text;
    info.querySelector('.mi-stat').innerHTML = stat;
    info.classList.remove('pop'); void info.offsetWidth; info.classList.add('pop');
  }

  open(id) {
    const app = this.app;
    audio.sfx('ui_open', { volume: 0.4 });
    if (id === 'story') app.ui.push(new StoryMapScreen(app));
    else if (id === 'turf') app.ui.push(new TurfSetupScreen(app));
    else if (id === 'armory') app.ui.push(new ArmoryScreen(app));
    else if (id === 'options') app.ui.push(new OptionsScreen(app));
    else if (id === 'credits') app.ui.push(new CreditsScreen(app));
    else if (id === 'quit') this.quit();
  }

  async quit() {
    const ok = await confirmDialog(this.app, { title: 'Quit INKTIDE?', text: 'Your progress is saved.', yes: 'Quit', no: 'Stay', danger: true });
    if (!ok) return;
    const host = window.GAME_HOST;
    try { if (typeof host?.exit === 'function') host.exit(); else if (typeof host?.quit === 'function') host.quit(); else window.close(); } catch { window.close(); }
  }

  onBack() {
    audio.sfx('ui_back', { volume: 0.5 });
    this.app.ui.replace(new TitleScreen(this.app));
  }
}
