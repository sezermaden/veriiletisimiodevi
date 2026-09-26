// Turf Clash setup: arena, kit and bot difficulty selectors with a big arena preview, then START.
import { UiScreen, promptBar, heading, pearlChip, settingRow, handleRowInput, esc } from './widgets.js';
import { KITS, SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';
import { save } from '../engine/save.js';
import { audio } from '../engine/audio.js';
import { kitIcon, subIcon, specialIcon, trophyIcon } from './icons.js';
import { TURF_ARENAS, kitUnlocked } from './stage-data.js';
import { startStage } from './flow.js';

const DIFFS = [
  { value: 'easy', label: 'Easy', desc: 'Relaxed bots that paint more than they fight.' },
  { value: 'normal', label: 'Normal', desc: 'A fair fight. Bots push lanes and use their subs.' },
  { value: 'hard', label: 'Hard', desc: 'Sharp, aggressive bots that flank and use specials.' },
];

/** Stylised top-down arena thumbnails (1000×600). */
function arenaArt(id) {
  const lanes = {
    'turf-pier': `<rect class="a-water" width="1000" height="600"/><rect class="a-wood" x="80" y="120" width="840" height="360" rx="30"/>
      <rect class="a-wood2" x="40" y="250" width="120" height="100" rx="14"/><rect class="a-wood2" x="840" y="250" width="120" height="100" rx="14"/>
      <rect class="a-box c1" x="300" y="150" width="90" height="46" rx="6"/><rect class="a-box c2" x="610" y="404" width="90" height="46" rx="6"/>
      <rect class="a-box c3" x="420" y="260" width="160" height="80" rx="8"/><rect class="a-box c4" x="250" y="380" width="60" height="60" rx="6"/><rect class="a-box c1" x="690" y="160" width="60" height="60" rx="6"/>
      <path class="a-crane" d="M500 300l170-150" /><circle class="a-crane-c" cx="500" cy="300" r="24"/>`,
    'turf-skate': `<rect class="a-ground" width="1000" height="600"/><rect class="a-concrete" x="60" y="60" width="880" height="480" rx="60"/>
      <ellipse class="a-bowl" cx="500" cy="300" rx="170" ry="110"/><ellipse class="a-bowl-in" cx="500" cy="300" rx="110" ry="64"/>
      <rect class="a-ramp" x="120" y="110" width="140" height="80" rx="10"/><rect class="a-ramp" x="740" y="410" width="140" height="80" rx="10"/>
      <path class="a-rail" d="M200 460L420 420M580 180L800 140"/><rect class="a-box c2" x="760" y="120" width="70" height="70" rx="10"/><rect class="a-box c4" x="170" y="410" width="70" height="70" rx="10"/>`,
    'turf-refinery': `<rect class="a-ground dark" width="1000" height="600"/><rect class="a-metal" x="60" y="80" width="880" height="440" rx="24"/>
      <circle class="a-vat" cx="500" cy="300" r="110"/><circle class="a-vat-in" cx="500" cy="300" r="70"/>
      <path class="a-pipe" d="M60 200H340M660 400H940M300 80V200M700 400V520"/><circle class="a-tank" cx="200" cy="420" r="60"/><circle class="a-tank" cx="800" cy="180" r="60"/>
      <rect class="a-box c3" x="380" y="110" width="60" height="60" rx="8"/><rect class="a-box c1" x="560" y="430" width="60" height="60" rx="8"/>`,
  };
  return `<svg class="arena-art" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${lanes[id] || lanes['turf-pier']}
    <circle class="a-base a" cx="${id === 'turf-skate' ? 130 : 110}" cy="300" r="44"/><circle class="a-base b" cx="${id === 'turf-skate' ? 870 : 890}" cy="300" r="44"/>
    <path class="a-splat a" d="M150 250q60-40 120 10t40 90q-50 40-110 10t-50-110z"/><path class="a-splat b" d="M850 350q-60 40-120-10t-40-90q50-40 110-10t50 110z"/></svg>`;
}

export class TurfSetupScreen extends UiScreen {
  constructor(app) {
    super(app, { className: 'turf-setup', blocksGame: true });
    const prev = save.data.flags?.turfSetup || {};
    this.arena = TURF_ARENAS.some((a) => a.id === prev.arena) ? prev.arena : TURF_ARENAS[0].id;
    this.diff = DIFFS.some((d) => d.value === prev.diff) ? prev.diff : 'normal';
    const kits = Object.keys(KITS).filter(kitUnlocked);
    this.kit = kits.includes(save.data.kit) ? save.data.kit : kits[0];
  }

  build() {
    const t = save.data.turf || {};
    this.el.innerHTML = `
      <div class="ts">
        <header class="ts-head">${heading('TURF CLASH', { seed: 88 })}
          <div class="chip rec-chip">${trophyIcon()}<span>${t.played ? `${t.wins} W · ${t.losses} L` : 'No matches yet'}</span></div>${pearlChip()}</header>
        <div class="ts-left">
          <div class="ts-rows"></div>
          <div class="btn btn-start"><span class="play-tri"></span>START CLASH</div>
        </div>
        <aside class="ts-preview card sticker">
          <div class="tp-art"></div>
          <div class="tp-body">
            <div class="tp-kicker">4 VS 4 · 3:00 · INK THE MOST TURF</div>
            <h2 class="tp-name"></h2>
            <p class="tp-blurb"></p>
            <div class="tp-kit"><div class="tpk-art"></div><div><div class="tpk-name"></div><div class="tpk-subs"></div></div></div>
          </div>
        </aside>
        <footer class="ts-foot">${promptBar([['ui_accept', 'Start'], ['ui_left,ui_right', 'Change'], ['ui_back', 'Back']])}</footer>
      </div>`;
    const rows = this.$('.ts-rows');
    const kits = Object.keys(KITS).filter(kitUnlocked);
    rows.append(
      settingRow(this, { kind: 'choice', label: 'Arena', options: TURF_ARENAS.map((a) => ({ value: a.id, label: a.name })), get: () => this.arena, set: (v) => { this.arena = v; }, onChange: () => this.preview() }),
      settingRow(this, { kind: 'choice', label: 'Kit', options: kits.map((k) => ({ value: k, label: KITS[k].name })), get: () => this.kit, set: (v) => { this.kit = v; }, onChange: () => this.preview() }),
      settingRow(this, { kind: 'choice', label: 'Bots', options: DIFFS, get: () => this.diff, set: (v) => { this.diff = v; }, onChange: () => this.preview() }),
    );
    rows.firstChild.dataset.autofocus = '1';
    this.button(this.$('.btn-start'), () => this.start(), { silent: true });
    this.preview();
  }

  onEnter() { this.app.menuScene?.setShot('wide'); }
  onResume() { this.app.menuScene?.setShot('wide'); }

  handleInput(input) { return handleRowInput(this, input); }

  preview() {
    const a = TURF_ARENAS.find((x) => x.id === this.arena);
    const k = KITS[this.kit];
    const d = DIFFS.find((x) => x.value === this.diff);
    const p = this.$('.ts-preview');
    p.querySelector('.tp-art').innerHTML = arenaArt(a.id);
    p.querySelector('.tp-name').textContent = a.name;
    p.querySelector('.tp-blurb').textContent = `${a.blurb} Bots: ${d.label} — ${d.desc}`;
    p.querySelector('.tpk-art').innerHTML = kitIcon(k.main);
    p.querySelector('.tpk-name').textContent = k.name;
    p.querySelector('.tpk-subs').innerHTML = `<span>${subIcon(k.sub)}${esc(SUB_INFO[k.sub]?.name || '')}</span><span>${specialIcon(k.special)}${esc(SPECIAL_INFO[k.special]?.name || '')}</span>`;
    p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop');
  }

  async start() {
    if (this.starting) return;
    this.starting = true;
    audio.sfx('ui_start', { volume: 0.7 });
    save.data.kit = this.kit;
    save.data.flags = save.data.flags || {};
    save.data.flags.turfSetup = { arena: this.arena, diff: this.diff };
    save.save();
    const s = await startStage(this.app, this.arena, { difficulty: this.diff, kit: this.kit });
    if (!s) this.starting = false;
  }
}
