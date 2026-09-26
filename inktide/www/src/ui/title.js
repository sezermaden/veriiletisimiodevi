// Title screen: the animated INKTIDE wordmark over the live plaza, "Press any button".
import { UiScreen, inkWipe } from './widgets.js';
import { logoHTML } from './logo.js';
import { audio } from '../engine/audio.js';
import { MainMenuScreen } from './main-menu.js';

export const VERSION = '1.0.0';

export class TitleScreen extends UiScreen {
  constructor(app) {
    super(app, { className: 'title-screen', blocksGame: false });
    this.leaving = false;
    this.armed = 0.35;      // ignore input for a moment so a held key from boot doesn't skip it
  }

  build() {
    this.el.innerHTML = `
      <div class="title-shade"></div>
      <div class="title-center">
        ${logoHTML({ size: 'xl' })}
        <div class="press"><span class="press-dot"></span><span class="press-text">PRESS ANY BUTTON</span><span class="press-dot"></span></div>
      </div>
      <div class="title-foot">
        <span class="title-copy">© 2026 The INKTIDE Team</span>
        <span class="title-ver">v${VERSION}</span>
      </div>`;
    this.button(this.$('.press'), () => this.go(), { silent: true, autofocus: true });
    this.el.addEventListener('pointerdown', () => this.go());
  }

  onEnter() {
    this.app.menuScene?.setShot('title');
    try { audio.playMusic('title'); } catch { /* music layer optional */ }
  }

  update(dt) {
    super.update(dt);
    this.armed = Math.max(0, this.armed - dt);
  }

  handleInput(input) {
    if (this.leaving) return true;
    if (this.armed > 0) return true;
    const keys = input._pressedThisFrame?.size > 0;
    let pad = false;
    if (input._padPressed) for (const i of input._padPressed) if (!input._padPrev?.has(i)) { pad = true; break; }
    if (keys || pad) { this.go(); return true; }
    return false;
  }

  go() {
    if (this.leaving || this.armed > 0) return;
    this.leaving = true;
    audio.init();
    audio.sfx('ui_splat', { volume: 0.8 });
    this.el.classList.add('leaving');
    inkWipe(() => { this.app.ui.replace(new MainMenuScreen(this.app)); }, { seed: 9 });
  }

  onBack() { this.go(); }
}
