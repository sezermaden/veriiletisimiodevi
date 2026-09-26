// Armory: Shelly's shop. KITS tab (equip one of eight kits, stats + sub/special) and UPGRADES tab
// (spend pearls on Ink Tank, Swim Speed, Armor, Special Charge; five levels each).
import { UiScreen, promptBar, heading, tabBar, pearlChip, esc } from './widgets.js';
import { KITS, SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';
import { save } from '../engine/save.js';
import { audio } from '../engine/audio.js';
import { kitIcon, subIcon, specialIcon, lockIcon, shellyArt, pearlIcon } from './icons.js';
import { kitUnlocked, unlockText, stageNum } from './stage-data.js';

/** Display stats (0..10) per main-weapon class. */
const STATS = {
  shooter: { range: 5, damage: 4, rate: 8, mobility: 7 },
  roller: { range: 2, damage: 9, rate: 3, mobility: 6 },
  charger: { range: 10, damage: 9, rate: 2, mobility: 3 },
  blaster: { range: 5, damage: 8, rate: 3, mobility: 5 },
  slosher: { range: 5, damage: 6, rate: 4, mobility: 5 },
  splatling: { range: 8, damage: 5, rate: 9, mobility: 3 },
  brush: { range: 2, damage: 4, rate: 9, mobility: 10 },
  dualies: { range: 4, damage: 4, rate: 8, mobility: 9 },
};
const STAT_LABELS = [['range', 'Range'], ['damage', 'Damage'], ['rate', 'Fire rate'], ['mobility', 'Mobility']];

export const UPGRADE_COSTS = [20, 40, 70, 110, 160];
const UPGRADES = [
  { key: 'tank', name: 'Ink Tank', desc: 'Carry more ink before you need to refill.', eff: (l) => `Tank ${100 + l * 12} ink`, per: '+12 ink per level' },
  { key: 'swim', name: 'Swim Speed', desc: 'Zip through your own ink even faster.', eff: (l) => `Swim +${l * 5}%`, per: '+5% per level' },
  { key: 'armor', name: 'Armor', desc: 'Take more hits before you splat.', eff: (l) => `Health ${100 + l * 10}`, per: '+10 health per level' },
  { key: 'special', name: 'Special Charge', desc: 'Fill your special gauge faster.', eff: (l) => `Charge +${l * 12}%`, per: '+12% per level' },
];
const UP_ICON = {
  tank: '<svg class="ico" viewBox="0 0 44 44"><rect class="i-body" x="13" y="4" width="18" height="6" rx="2"/><rect class="i-dark" x="10" y="9" width="24" height="31" rx="7"/><rect class="i-ink" x="13" y="20" width="18" height="17" rx="5"/><circle class="i-hl" cx="17" cy="24" r="2.5"/></svg>',
  swim: '<svg class="ico" viewBox="0 0 44 44"><path class="i-ink" d="M22 3c-7 6-10 13-10 20h20c0-7-3-14-10-20z"/><path class="i-ink" d="M12 23l-6 6 7-1M32 23l6 6-7-1"/><path class="i-line" d="M14 29q2 7 0 12M22 29q2 7 0 12M30 29q2 7 0 12" fill="none" stroke-width="3" stroke-linecap="round"/></svg>',
  armor: '<svg class="ico" viewBox="0 0 44 44"><path class="i-ink" d="M22 4l15 6v10c0 10-7 17-15 20-8-3-15-10-15-20V10z"/><path class="i-hl" d="M22 10v24c5-2 9-7 9-14v-6z"/></svg>',
  special: '<svg class="ico" viewBox="0 0 44 44"><circle class="i-dark" cx="22" cy="22" r="18"/><path class="i-ink" d="M22 4a18 18 0 0 1 18 18H22z"/><path class="i-ink" d="M22 22h18a18 18 0 0 1-9 15.6z"/><path class="i-warm" d="M24 9l-8 15h7l-3 11 9-16h-7z"/></svg>',
};

const GREETINGS = [
  'Welcome in, sweet pea! Browse, equip, or trade those pearls for a little extra oomph.',
  'Ooh, look who swam in! Everything here is hand-polished. By claw, mostly.',
  "Fresh kits, fresh ink! Don't worry — Murkwell can't afford my prices.",
];
const BUY_LINES = [
  'Pleasure doing business, darling!',
  "That'll give the Murk something to cry about!",
  'Oh, it suits you! Truly, deeply.',
];

export class ArmoryScreen extends UiScreen {
  constructor(app, o = {}) {
    super(app, { className: 'armory', blocksGame: true });
    this.tab = o.tab || 0;
    this.sel = save.data.kit;
  }

  build() {
    const ids = Object.keys(KITS);
    this.el.innerHTML = `
      <div class="arm">
        <header class="arm-head">${heading('ARMORY', { seed: 71 })}${tabBar(['KITS', 'UPGRADES'], this.tab)}${pearlChip()}</header>
        <section class="arm-kits" data-panel="0">
          <div class="kit-grid">
            ${ids.map((id, i) => `<div class="kit-tile" data-kit="${id}" style="--tilt:${[-1.2, 0.8, -0.6, 1.1][i % 4]}deg">
              <div class="kt-art">${kitIcon(KITS[id].main)}</div><div class="kt-name">${esc(KITS[id].name)}</div>
              <div class="kt-lock">${lockIcon()}${KITS[id].unlock ? `<span class="kt-req">CLEAR ${esc(stageNum(KITS[id].unlock))}</span>` : ''}</div><span class="kt-badge">EQUIPPED</span></div>`).join('')}
          </div>
          <aside class="kit-detail card">
            <div class="kd-top"><div class="kd-art">${kitIcon('shooter')}</div><div><div class="kd-class"></div><h2 class="kd-name"></h2></div><div class="kd-state"></div></div>
            <div class="kd-lock"></div>
            <p class="kd-desc"></p>
            <div class="kd-stats">${STAT_LABELS.map(([k, l]) => `<div class="stat" data-stat="${k}"><span class="stat-l">${l}</span><span class="stat-bar">${'<i></i>'.repeat(10)}</span></div>`).join('')}</div>
            <div class="kd-subs">
              <div class="kd-sub"><div class="kd-ico sub-ico"></div><div><div class="kd-k">SUB</div><div class="kd-n sub-n"></div></div><div class="kd-d sub-d"></div></div>
              <div class="kd-sub"><div class="kd-ico sp-ico"></div><div><div class="kd-k">SPECIAL</div><div class="kd-n sp-n"></div></div><div class="kd-d sp-d"></div></div>
            </div>
          </aside>
        </section>
        <section class="arm-ups" data-panel="1">
          <div class="up-list">
            ${UPGRADES.map((u) => `<div class="up-row" data-up="${u.key}">
              <div class="up-ico">${UP_ICON[u.key]}</div>
              <div class="up-main"><div class="up-name">${esc(u.name)}</div><div class="up-desc">${esc(u.desc)}</div></div>
              <div class="up-pips">${'<i></i>'.repeat(5)}</div>
              <div class="up-eff"></div>
              <div class="up-cost"></div>
            </div>`).join('')}
          </div>
        </section>
        <footer class="arm-foot">
          <div class="arm-shelly">${shellyArt()}<div class="bubble"><b>Shelly</b><span class="bubble-t">${esc(GREETINGS[Math.floor(Math.random() * GREETINGS.length)])}</span></div></div>
          ${promptBar([['ui_accept', this.tab ? 'Buy' : 'Equip'], ['ui_prev,ui_next', 'Tab'], ['ui_back', 'Back']])}
        </footer>
      </div>`;
    for (const t of this.$$('.kit-tile')) this.button(t, () => this.equip(t.dataset.kit), { silent: true, autofocus: t.dataset.kit === this.sel });
    for (const r of this.$$('.up-row')) this.button(r, () => this.buy(r.dataset.up), { silent: true });
    for (const t of this.$$('.tab')) t.addEventListener('click', () => this.setTab(Number(t.dataset.tab)));
    this.applyTab();
    this.renderKits();
    this.renderUps();
    this.showKit(this.sel);
  }

  onEnter() { this.app.menuScene?.setShot('wide'); }
  onResume() { this.app.menuScene?.setShot('wide'); }

  applyTab() {
    for (const p of this.$$('[data-panel]')) p.hidden = Number(p.dataset.panel) !== this.tab;
    for (const t of this.$$('.tab')) t.classList.toggle('on', Number(t.dataset.tab) === this.tab);
    const pb = this.$('.arm-foot .pb-item .pb-label');
    if (pb) pb.textContent = this.tab ? 'Buy' : 'Equip';
    this.el.dataset.tab = this.tab ? 'ups' : 'kits';
  }

  setTab(i) {
    i = ((i % 2) + 2) % 2;
    if (i === this.tab) return;
    this.tab = i;
    audio.sfx('ui_tab', { volume: 0.5 });
    this.applyTab();
    this.focus.current?.classList.remove('focused');
    this.focus.current = null;
    this.focus.refresh(false);
    const first = this.tab ? this.$('.up-row') : this.$(`.kit-tile[data-kit="${save.data.kit}"]`);
    if (first) this.focus.focus(first);
    this.say(this.tab ? 'Upgrades last forever and work with every kit. Pick your favourite!' : GREETINGS[0]);
  }

  onTab(d) { this.setTab(this.tab + d); }

  handleInput(input) {
    if (input.justPressed('ui_prev')) { this.onTab(-1); return true; }
    if (input.justPressed('ui_next')) { this.onTab(1); return true; }
    return false;
  }

  say(text) {
    const b = this.$('.bubble-t');
    b.textContent = text;
    const bubble = this.$('.bubble');
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  }

  renderKits() {
    for (const t of this.$$('.kit-tile')) {
      const id = t.dataset.kit;
      t.classList.toggle('locked', !kitUnlocked(id));
      t.classList.toggle('equipped', id === save.data.kit);
    }
    this.$('.pc-n').textContent = String(save.data.pearls || 0);
  }

  showKit(id) {
    const k = KITS[id];
    if (!k) return;
    this.sel = id;
    const d = this.$('.kit-detail');
    const unlocked = kitUnlocked(id);
    d.classList.toggle('locked', !unlocked);
    d.querySelector('.kd-art').innerHTML = kitIcon(k.main);
    d.querySelector('.kd-class').textContent = k.main.toUpperCase();
    d.querySelector('.kd-name').textContent = k.name;
    d.querySelector('.kd-desc').textContent = k.desc;
    const st = STATS[k.main] || STATS.shooter;
    for (const s of d.querySelectorAll('.stat')) {
      const v = st[s.dataset.stat] || 0;
      s.querySelectorAll('.stat-bar i').forEach((pip, i) => pip.classList.toggle('on', i < v));
      s.style.setProperty('--v', v);
    }
    d.querySelector('.sub-ico').innerHTML = subIcon(k.sub);
    d.querySelector('.sub-n').textContent = SUB_INFO[k.sub]?.name || '';
    d.querySelector('.sub-d').textContent = SUB_INFO[k.sub]?.desc || '';
    d.querySelector('.sp-ico').innerHTML = specialIcon(k.special);
    d.querySelector('.sp-n').textContent = SPECIAL_INFO[k.special]?.name || '';
    d.querySelector('.sp-d').textContent = SPECIAL_INFO[k.special]?.desc || '';
    d.querySelector('.kd-lock').innerHTML = unlocked ? '' : `${lockIcon()}<span>${esc(unlockText(id))} to unlock</span>`;
    d.querySelector('.kd-state').textContent = !unlocked ? '' : id === save.data.kit ? 'EQUIPPED' : '';
    d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop');
  }

  renderUps() {
    const ups = save.data.upgrades || {};
    const pearls = save.data.pearls || 0;
    for (const r of this.$$('.up-row')) {
      const u = UPGRADES.find((x) => x.key === r.dataset.up);
      const lvl = ups[u.key] || 0;
      r.querySelectorAll('.up-pips i').forEach((p, i) => p.classList.toggle('on', i < lvl));
      r.querySelector('.up-eff').textContent = u.eff(lvl);
      const cost = UPGRADE_COSTS[lvl];
      const c = r.querySelector('.up-cost');
      if (cost == null) { c.innerHTML = '<span class="maxed">MAX</span>'; r.classList.add('maxed'); }
      else {
        c.innerHTML = `${pearlIcon()}<b>${cost}</b>`;
        r.classList.remove('maxed');
        r.classList.toggle('poor', pearls < cost);
      }
    }
    this.$('.pc-n').textContent = String(pearls);
  }

  onFocus(el) {
    if (el.classList.contains('kit-tile')) this.showKit(el.dataset.kit);
  }

  equip(id) {
    const tile = this.$(`.kit-tile[data-kit="${id}"]`);
    if (!kitUnlocked(id)) {
      audio.sfx('ui_denied', { volume: 0.5 });
      this.shake(tile);
      this.say(`That one's still in the back room, hon. ${unlockText(id)} and it's yours!`);
      return;
    }
    if (save.data.kit === id) { audio.sfx('ui_move', { volume: 0.3 }); return; }
    save.data.kit = id;
    save.save();
    if (this.app.session?.player && !this.app.session.player.kit?.special?.active) {
      // armory is menu-only today, but keep a running session in sync if it is ever opened in-game
      this.app.session.player.setKit?.(id);
      this.app.session.hud?.refreshKit?.();
    }
    audio.sfx('ui_equip', { volume: 0.6 });
    tile.classList.remove('stamp'); void tile.offsetWidth; tile.classList.add('stamp');
    this.renderKits();
    this.showKit(id);
    this.say(`The ${KITS[id].name}! Excellent taste, sweetie.`);
  }

  buy(key) {
    const u = UPGRADES.find((x) => x.key === key);
    const ups = save.data.upgrades || (save.data.upgrades = { tank: 0, swim: 0, armor: 0, special: 0 });
    const lvl = ups[key] || 0;
    const row = this.$(`.up-row[data-up="${key}"]`);
    const cost = UPGRADE_COSTS[lvl];
    if (cost == null) { audio.sfx('ui_denied', { volume: 0.4 }); this.say(`${u.name} is maxed out. You're a legend already!`); return; }
    const pearls = save.data.pearls || 0;
    if (pearls < cost) {
      audio.sfx('ui_denied', { volume: 0.5 });
      this.shake(row);
      this.say(`${u.name} is ${cost} pearls, dear. You need ${cost - pearls} more — try hunting around the stages!`);
      return;
    }
    save.data.pearls = pearls - cost;
    ups[key] = lvl + 1;
    save.save();
    audio.sfx('ui_buy', { volume: 0.7 });
    this.renderUps();
    row.classList.remove('stamp'); void row.offsetWidth; row.classList.add('stamp');
    const chip = this.$('.pearl-chip');
    chip.classList.remove('spend'); void chip.offsetWidth; chip.classList.add('spend');
    this.say(`${u.name} level ${lvl + 1}! ${BUY_LINES[Math.floor(Math.random() * BUY_LINES.length)]}`);
  }
}
