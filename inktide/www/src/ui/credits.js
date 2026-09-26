// Scrolling credits over the plaza. Hold down / stick to fast-forward, B (or Skip) to leave.
import { UiScreen, promptBar, esc } from './widgets.js';
import { logoHTML } from './logo.js';
import { splatPath } from './icons.js';
import { audio } from '../engine/audio.js';

const TEAM = 'The INKTIDE Team';
const SECTIONS = [
  ['Game direction', [TEAM]],
  ['Story & writing', [TEAM]],
  ['Engine & ink technology', [TEAM]],
  ['Gameplay programming', [TEAM]],
  ['Level design', [TEAM]],
  ['Characters & creatures', [TEAM]],
  ['Procedural art & shaders', [TEAM]],
  ['Music & sound synthesis', [TEAM]],
  ['User interface', [TEAM]],
  ['Quality assurance', [TEAM, 'Every Squidkin who ever painted a wall']],
];
const TECH = [
  ['Built with', ['three.js r186 — MIT License', 'three-mesh-bvh — MIT License']],
  ['Fonts', ['Bungee · Lilita One · Baloo 2 · Rubik Wet Paint', 'SIL Open Font License 1.1']],
  ['Art, music & sound', ['Every model, texture, song and sound effect', 'is generated procedurally, in code']],
];

export class CreditsScreen extends UiScreen {
  constructor(app) {
    super(app, { className: 'credits', blocksGame: true });
    this.y = 0;
    this.endT = 0;
  }

  build() {
    const block = ([title, names], i) => `<div class="cr-block" style="--r:${(i % 2 ? 1 : -1) * 1.5}deg">
      <div class="cr-role">${esc(title)}</div>${names.map((n) => `<div class="cr-name">${esc(n)}</div>`).join('')}</div>`;
    this.el.innerHTML = `
      <div class="cr-shade"></div>
      <div class="cr-view">
        <div class="cr-roll">
          <div class="cr-logo">${logoHTML({ size: 'md', animate: false })}</div>
          <div class="cr-lead">A single-player ink adventure</div>
          ${SECTIONS.map(block).join('')}
          <div class="cr-sep"><svg viewBox="-170 -170 340 340" aria-hidden="true"><path d="${splatPath(4, 90)}"/></svg></div>
          ${TECH.map(block).join('')}
          <div class="cr-sep"><svg viewBox="-170 -170 340 340" aria-hidden="true"><path d="${splatPath(15, 90)}"/></svg></div>
          <div class="cr-thanks">THANKS FOR PLAYING!</div>
          <div class="cr-sub">Stay fresh, Tidehaven.</div>
        </div>
      </div>
      <div class="cr-skip btn">Skip</div>
      <footer class="cr-foot">${promptBar([['ui_down', 'Hold to speed up'], ['ui_back', 'Back']])}</footer>`;
    this.button(this.$('.cr-skip'), () => this.onBack(), { autofocus: true, silent: true });
  }

  onEnter() {
    this.app.menuScene?.setShot('title');
    try { audio.playMusic('credits'); } catch { /* optional */ }
    this.y = innerHeight * 0.92;
  }

  onExit() {
    this.app.menuScene?.setShot('menu');
    try { audio.playMusic('menu'); } catch { /* optional */ }
  }

  handleInput(input) {
    // up/down drive the scroll instead of moving focus
    const d = input.navPressed();
    return d === 'up' || d === 'down';
  }

  update(dt) {
    super.update(dt);
    const fast = this.input.isDown('ui_down') || this.input.stick.ly > 0.5;
    const back = this.input.isDown('ui_up') || this.input.stick.ly < -0.5;
    const speed = (innerHeight / 12) * (fast ? 5 : back ? -3 : 1);
    this.y -= speed * Math.min(dt, 0.1);
    const roll = this.$('.cr-roll');
    const h = roll.offsetHeight;
    this.y = Math.min(innerHeight, this.y);
    if (this.y < -h) {
      this.endT += dt;
      if (this.endT > 1.2 && this.app.ui.top === this) this.onBack();
    }
    roll.style.transform = `translateY(${this.y.toFixed(1)}px)`;
  }
}
