// Pause menu over the dimmed, frozen frame. Esc / Menu / B resume.
import { UiScreen, promptBar, heading, confirmDialog, esc, fmtTime } from './widgets.js';
import { menuIcon, kitIcon, subIcon, specialIcon, pearlIcon, clockIcon } from './icons.js';
import { audio } from '../engine/audio.js';
import { KITS, SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';
import { stageMeta, stageNum } from './stage-data.js';
import { ControlsCardScreen } from './controls-card.js';
import { OptionsScreen } from './options.js';
import { quitToMenu, safePointerLock } from './flow.js';

export class PauseScreen extends UiScreen {
  constructor(app) {
    super(app, { className: 'pause', blocksGame: true });
    this.openFrame = app.frames;
    this.closing = false;
  }

  get stageId() { return this.app.session?.opts?.stageId || this.app.session?.opts?.levelDef?.id || ''; }
  get isStory() { return /^w\d/.test(this.stageId); }

  build() {
    const s = this.app.session;
    const id = this.stageId;
    const story = this.isStory;
    const turf = /^turf-/.test(id);
    const meta = story || turf ? stageMeta(id) : { title: s?.opts?.levelDef?.name || 'Free Play' };
    const kit = KITS[s?.player?.kitId] || KITS['splash-blaster'];
    const items = [
      ['resume', 'RESUME', 'resume'],
      ['restart', turf ? 'RESPAWN AT BASE' : 'RESTART FROM CHECKPOINT', 'restart'],
      ['controls', 'CONTROLS', 'controls'],
      ['options', 'OPTIONS', 'options'],
      ['quit', story ? 'QUIT TO MAP' : 'QUIT TO MENU', 'quit'],
    ];
    this.el.innerHTML = `
      <div class="pause-scrim"></div>
      <div class="pz">
        <div class="pz-rail">
          ${heading('PAUSED', { seed: 31 })}
          <nav class="pz-items">${items.map(([id, label, ico], i) => `<div class="rail-item" data-id="${id}" style="--i:${i}"><span class="ri-bar"></span>${menuIcon(ico)}<span class="ri-label">${label}</span></div>`).join('')}</nav>
        </div>
        <aside class="pz-card card sticker">
          <div class="pc-kicker">${story ? 'STORY · STAGE ' + esc(stageNum(id)) : turf ? 'TURF CLASH' : 'FREE PLAY'}</div>
          <h2 class="pc-title">${esc(meta.title)}</h2>
          <div class="pc-obj"></div>
          <div class="pc-stats">
            <div class="pc-stat">${clockIcon()}<span class="k">Time</span><span class="v pc-time"></span></div>
            <div class="pc-stat">${pearlIcon()}<span class="k">Pearls</span><span class="v pc-pearls"></span></div>
          </div>
          <div class="pc-kit">
            <div class="pk-art">${kitIcon(kit.main)}</div>
            <div class="pk-body"><div class="pk-name">${esc(kit.name)}</div>
              <div class="pk-subs"><span>${subIcon(kit.sub)}${esc(SUB_INFO[kit.sub]?.name || '')}</span><span>${specialIcon(kit.special)}${esc(SPECIAL_INFO[kit.special]?.name || '')}</span></div></div>
          </div>
        </aside>
      </div>
      <footer class="pz-foot">${promptBar([['ui_accept', 'Select'], ['ui_back', 'Resume']])}</footer>`;
    for (const el of this.$$('.rail-item')) this.button(el, () => this.pick(el.dataset.id), { autofocus: el.dataset.id === 'resume' });
    this.refreshCard();
  }

  refreshCard() {
    const s = this.app.session;
    if (!s) return;
    const obj = s.hud?.el?.objective?.textContent || '';
    this.$('.pc-obj').textContent = obj;
    this.$('.pc-obj').hidden = !obj;
    // Turf Clash counts down: show the match clock rather than the time played
    const left = s.mode?.kind === 'turf' || /^turf-/.test(this.stageId) ? s.mode?.timeLeft : null;
    this.$('.pc-time').textContent = fmtTime(left != null ? Math.max(0, left) : (s.time || 0));
    this.$('.pc-time').previousElementSibling.textContent = left != null ? 'Time left' : 'Time';
    this.$('.pc-pearls').textContent = String(s.pearls || 0);
  }

  onEnter() {
    audio.sfx('ui_pause', { volume: 0.6 });
    audio.duck(0.35, 3600);
    this.app.session?.player?.kit?.main?.cancel?.();
  }

  onExit() { audio.duck(1, 0); }

  onResume() { this.refreshCard(); }

  handleInput(input) {
    // the press that opened the menu must not also close it
    if (this.app.frames === this.openFrame) return true;
    if (input.justPressed('pause')) { this.resume(); return true; }
    return false;
  }

  onBack() { this.resume(); }

  resume() {
    if (this.closing || this.app.ui.top !== this) return;
    this.closing = true;
    audio.sfx('ui_resume', { volume: 0.6 });
    this.app.ui.pop();
    safePointerLock(this.app);
  }

  async pick(id) {
    const app = this.app;
    if (id === 'resume') this.resume();
    else if (id === 'restart') {
      const ok = await confirmDialog(app, { title: 'Restart from checkpoint?', text: 'You will respawn at the last checkpoint you reached.', yes: 'Restart', no: 'Cancel' });
      if (!ok || !app.session) return;
      this.resume();
      const S = app.session, P = S.player;
      // a splatted player is already on the respawn timer, a frozen one is in a cutscene/dialogue,
      // and a super-jumping one belongs to the jump system: respawning now would fight those
      if (P?.alive && !P.frozen && !S.mode?.jumps?.isJumping?.(P)) S.respawnPlayer();
    } else if (id === 'controls') app.ui.push(new ControlsCardScreen(app));
    else if (id === 'options') app.ui.push(new OptionsScreen(app, { inGame: true }));
    else if (id === 'quit') {
      const story = this.isStory;
      const ok = await confirmDialog(app, {
        title: story ? 'Quit to the map?' : 'Quit to the main menu?',
        text: 'Progress in this stage since your last clear will be lost.', yes: 'Quit', no: 'Keep playing', danger: true,
      });
      if (!ok) return;
      this.closing = true;
      quitToMenu(app, this.stageId);
    }
  }
}
