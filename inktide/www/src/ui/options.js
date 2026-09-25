// Options: Audio / Controls (incl. full rebinding) / Video / Gameplay. LB/RB (Q/E) switch tabs,
// left/right adjust the focused row, every change applies live through settings.set().
import { UiScreen, promptBar, heading, tabBar, settingRow, handleRowInput, confirmDialog, esc } from './widgets.js';
import { settings, INK_PALETTES } from '../engine/settings.js';
import { REBINDABLE, ACTION_LABELS, keyName, padName } from '../engine/game-input.js';
import { audio } from '../engine/audio.js';
import { PRISTINE_SETTINGS } from './defaults.js';

const TABS = ['AUDIO', 'CONTROLS', 'VIDEO', 'GAMEPLAY'];
const SECTION = ['audio', 'controls', 'video', 'gameplay'];
const pct = (v) => `${Math.round(v * 100)}%`;
const RESERVED_KEYS = ['Escape', 'KeyP'];
const RESERVED_PAD = [9];

function S(path) { return { get: () => settings.get(path), set: (v) => settings.set(path, v) }; }

export class OptionsScreen extends UiScreen {
  constructor(app, o = {}) {
    super(app, { className: 'options' + (o.inGame ? ' in-game' : ''), blocksGame: true });
    this.tab = o.tab || 0;
    this.capturing = null;
  }

  build() {
    this.el.innerHTML = `
      <div class="opt">
        <header class="opt-head">${heading('OPTIONS', { seed: 57 })}${tabBar(TABS, this.tab)}</header>
        <div class="opt-body card">
          <div class="opt-rows" data-scroll></div>
        </div>
        <div class="opt-help"></div>
        <footer class="opt-foot">${promptBar([['ui_accept', 'Change'], ['ui_left,ui_right', 'Adjust'], ['ui_prev,ui_next', 'Tab'], ['ui_back', 'Back']])}</footer>
      </div>
      <div class="capture" hidden>
        <div class="capture-card card">
          <div class="capture-kicker">PRESS A KEY, MOUSE BUTTON OR PAD BUTTON</div>
          <div class="capture-action"></div>
          <div class="capture-hint">Esc (keyboard) or Menu (gamepad) cancels</div>
        </div>
      </div>`;
    for (const t of this.$$('.tab')) t.addEventListener('click', () => this.setTab(Number(t.dataset.tab)));
    this.$('.capture').addEventListener('mousedown', (e) => {
      if (!this.capturing) return;
      e.preventDefault(); e.stopPropagation();
      const code = ['Mouse0', 'Mouse1', 'Mouse2', 'Mouse3', 'Mouse4'][e.button];
      if (code) this.bindKey(code);
    });
    this.renderTab();
  }

  onEnter() { this.app.menuScene?.setShot('wide'); }
  onResume() { this.app.menuScene?.setShot('wide'); }

  setTab(i) {
    const n = TABS.length;
    i = ((i % n) + n) % n;
    if (i === this.tab) return;
    this.tab = i;
    audio.sfx('ui_tab', { volume: 0.5 });
    for (const t of this.$$('.tab')) t.classList.toggle('on', Number(t.dataset.tab) === i);
    this.renderTab();
    this.focus.current?.classList.remove('focused');
    this.focus.current = null;
    this.focus.refresh(true);
  }

  onTab(d) { this.setTab(this.tab + d); }

  rowsFor(tab) {
    const R = [];
    if (tab === 0) {
      R.push({ kind: 'slider', label: 'Master volume', min: 0, max: 1, step: 0.05, format: pct, ...S('audio.master'), help: 'Overall loudness of the game.' });
      R.push({ kind: 'slider', label: 'Music', min: 0, max: 1, step: 0.05, format: pct, ...S('audio.music'), help: 'Soundtrack volume.' });
      R.push({ kind: 'slider', label: 'Sound effects', min: 0, max: 1, step: 0.05, format: pct, ...S('audio.sfx'), help: 'Weapons, ink, enemies and menus.', onChange: () => audio.sfx('splat', { volume: 0.5 }) });
      R.push({ kind: 'slider', label: 'Voices', min: 0, max: 1, step: 0.05, format: pct, ...S('audio.voice'), help: 'Dialogue voice blips.', onChange: () => audio.blip({ pitch: 330 }) });
    } else if (tab === 1) {
      R.push({ kind: 'slider', label: 'Mouse sensitivity', min: 0.2, max: 3, step: 0.1, format: (v) => v.toFixed(1), ...S('controls.mouseSens'), help: 'How far the camera turns per mouse movement.' });
      R.push({ kind: 'slider', label: 'Stick sensitivity', min: 0.2, max: 3, step: 0.1, format: (v) => v.toFixed(1), ...S('controls.padSens'), help: 'Camera turn speed with the right stick.' });
      R.push({ kind: 'toggle', label: 'Invert Y axis', ...S('controls.invertY'), help: 'Push up to look down.' });
      R.push({ kind: 'toggle', label: 'Invert X axis', ...S('controls.invertX'), help: 'Push right to look left.' });
      R.push({ kind: 'toggle', label: 'Aim assist', ...S('controls.aimAssist'), help: 'Gently pulls your aim toward targets when using a gamepad.' });
      R.push({ kind: 'choice', label: 'Swim button', options: [{ value: false, label: 'Hold' }, { value: true, label: 'Toggle' }], ...S('controls.swimToggle'), help: 'Hold to stay in squid form, or press once to switch.' });
      R.push({ kind: 'toggle', label: 'Rumble', ...S('controls.rumble'), help: 'Controller vibration.', onChange: () => this.input.rumble(0.5, 0.5, 160) });
      R.push({ kind: 'section', label: 'BUTTON MAPPING' });
      for (const a of REBINDABLE) R.push({ kind: 'bind', action: a, label: ACTION_LABELS[a] || a, help: 'Press to rebind. Keyboard keys and pad buttons are set separately.' });
      R.push({ kind: 'button', label: 'Reset controls', value: 'Defaults', danger: true, help: 'Restore sensitivity, toggles and every binding to the defaults.', onActivate: () => this.resetSection('controls', 'Reset all controls?') });
    } else if (tab === 2) {
      R.push({ kind: 'choice', label: 'Graphics quality', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }], ...S('video.quality'), help: 'Shadows, bloom, anti-aliasing and ambient occlusion.' });
      R.push({ kind: 'slider', label: 'Render scale', min: 0.5, max: 1.5, step: 0.1, format: pct, ...S('video.renderScale'), help: 'Lower for speed, higher for sharpness.' });
      R.push({ kind: 'slider', label: 'Field of view', min: 60, max: 100, step: 2, format: (v) => `${v}°`, ...S('video.fov'), help: 'How much of the world the gameplay camera shows.' });
      R.push({ kind: 'slider', label: 'Camera shake', min: 0, max: 1, step: 0.1, format: pct, ...S('video.cameraShake'), help: 'Screen shake from explosions and impacts.' });
      R.push({ kind: 'toggle', label: 'Motion effects', ...S('video.motionFx'), help: 'Extra motion flourishes like speed lines and camera sway.' });
      R.push({ kind: 'toggle', label: 'Show FPS', ...S('video.showFps'), help: 'Frame-rate counter in the corner during play.' });
      R.push({ kind: 'button', label: 'Reset video', value: 'Defaults', danger: true, help: 'Restore every video setting.', onActivate: () => this.resetSection('video', 'Reset video settings?') });
    } else {
      R.push({ kind: 'choice', label: 'Ink colours', options: Object.entries(INK_PALETTES).map(([k, p]) => ({ value: k, label: p.name, swatch: [p.hero, p.murk] })), ...S('gameplay.inkPalette'), help: 'Your ink versus the Murk. The colour-blind set keeps strong contrast for every type.' });
      R.push({ kind: 'choice', label: 'Subtitle size', options: [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }], ...S('gameplay.subtitleSize'), help: 'Text size of dialogue and radio chatter.' });
      R.push({ kind: 'toggle', label: 'Control hints', ...S('gameplay.hints'), help: 'Show button hints during play.' });
      R.push({ kind: 'slider', label: 'HUD scale', min: 0.75, max: 1.25, step: 0.05, format: pct, ...S('gameplay.hudScale'), help: 'Size of the in-game HUD.' });
      R.push({ kind: 'button', label: 'Reset gameplay', value: 'Defaults', danger: true, help: 'Restore every gameplay setting.', onActivate: () => this.resetSection('gameplay', 'Reset gameplay settings?') });
    }
    return R;
  }

  renderTab() {
    const box = this.$('.opt-rows');
    box.innerHTML = '';
    box.scrollTop = 0;
    this.el.dataset.tab = SECTION[this.tab];
    const defs = this.rowsFor(this.tab);
    defs.forEach((d, i) => {
      let row;
      if (d.kind === 'section') {
        row = document.createElement('div');
        row.className = 'row-section';
        row.textContent = d.label;
      } else if (d.kind === 'bind') row = this.bindRow(d);
      else {
        row = settingRow(this, d);
        if (d.danger) row.classList.add('row-danger');
      }
      row.style.setProperty('--i', i);
      box.appendChild(row);
    });
  }

  bindRow(d) {
    const row = document.createElement('div');
    row.className = 'row row-bind';
    row.dataset.action = d.action;
    row.dataset.help = d.help;
    row.innerHTML = `<div class="row-label">${esc(d.label)}</div><div class="row-ctl"><span class="bind bind-k"></span><span class="bind bind-p"></span></div>`;
    this.button(row, () => this.startCapture(d.action, row), { silent: true });
    this.renderBind(row);
    return row;
  }

  renderBind(row) {
    const b = this.input.bindings[row.dataset.action] || {};
    const k = b.keys?.[0], p = b.pad?.[0];
    row.querySelector('.bind-k').innerHTML = `<span class="kbd">${esc(keyName(k))}</span>`;
    const pn = padName(p);
    const cls = { A: 'a', B: 'b', X: 'x', Y: 'y' }[pn] || 'shoulder';
    row.querySelector('.bind-p').innerHTML = p == null ? '<span class="kbd pad shoulder">—</span>' : `<span class="kbd pad ${cls}">${esc(pn)}</span>`;
  }

  async resetSection(section, title) {
    const ok = await confirmDialog(this.app, { title, text: 'This cannot be undone.', yes: 'Reset', no: 'Cancel', danger: true });
    if (!ok) return;
    // per-key set from a pristine snapshot (fires every listener, persists; see ui/defaults.js)
    for (const [k, v] of Object.entries(PRISTINE_SETTINGS[section] || {})) settings.set(`${section}.${k}`, structuredClone(v));
    audio.sfx('ui_equip', { volume: 0.5 });
    const keep = this.focus.current?.querySelector('.row-label')?.textContent;
    this.renderTab();
    this.focus.current = null;
    this.focus.refresh(true);
    const again = this.$$('.row').find((r) => r.querySelector('.row-label')?.textContent === keep);
    if (again) this.focus.focus(again);
  }

  // ---- rebinding ----
  startCapture(action, row) {
    this.capturing = { action, row, frame: this.app.frames };
    this.input.lastRawCode = null;
    this.input.lastRawPad = -1;
    const c = this.$('.capture');
    c.querySelector('.capture-action').textContent = ACTION_LABELS[action] || action;
    c.hidden = false;
    row.classList.add('listening');
    audio.sfx('ui_listen', { volume: 0.5 });
  }

  endCapture() {
    const cap = this.capturing;
    if (!cap) return;
    cap.row.classList.remove('listening');
    this.$('.capture').hidden = true;
    this.capturing = null;
    for (const r of this.$$('.row-bind')) this.renderBind(r);
  }

  bindKey(code) {
    const cap = this.capturing;
    if (!cap) return;
    if (RESERVED_KEYS.includes(code)) { audio.sfx('ui_denied', { volume: 0.5 }); return; }
    this._apply(cap.action, 'keys', code);
  }

  bindPad(i) {
    const cap = this.capturing;
    if (!cap) return;
    if (RESERVED_PAD.includes(i)) { audio.sfx('ui_denied', { volume: 0.5 }); return; }
    this._apply(cap.action, 'pad', i);
  }

  _apply(action, field, value) {
    const cur = this.input.bindings;
    const all = structuredClone(settings.get('controls.bindings') || {});
    const old = cur[action]?.[field]?.[0];
    // swap: whatever action used this input gives it up (and takes our old one if left empty)
    for (const a of REBINDABLE) {
      if (a === action) continue;
      const list = cur[a]?.[field] || [];
      if (!list.includes(value)) continue;
      let next = list.filter((x) => x !== value);
      if (!next.length && old != null) next = [old];
      all[a] = { ...(all[a] || {}), [field]: next };
    }
    all[action] = { ...(all[action] || {}), [field]: [value] };
    settings.set('controls.bindings', all);
    audio.sfx('ui_bound', { volume: 0.6 });
    const row = this.capturing.row;
    this.endCapture();
    row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
  }

  handleInput(input) {
    const cap = this.capturing;
    if (cap) {
      if (this.app.frames === cap.frame) return true;
      // fresh (non-repeat) key / canvas mouse presses this frame; mouse clicks on the overlay are
      // caught by its own mousedown listener
      let code = null;
      for (const c of input._pressedThisFrame || []) { code = c; break; }
      input.lastRawCode = null;
      if (code) {
        if (code === 'Escape') { audio.sfx('ui_back', { volume: 0.5 }); this.endCapture(); return true; }
        this.bindKey(code);
        return true;
      }
      const p = input.lastRawPad;
      if (p != null && p >= 0) {
        input.lastRawPad = -1;
        if (p === 9) { audio.sfx('ui_back', { volume: 0.5 }); this.endCapture(); return true; }
        this.bindPad(p);
      }
      return true;
    }
    if (input.justPressed('ui_prev')) { this.onTab(-1); return true; }
    if (input.justPressed('ui_next')) { this.onTab(1); return true; }
    return handleRowInput(this, input);
  }

  onFocus(el) {
    this.$('.opt-help').textContent = el.dataset.help || '';
  }

  onBack() {
    if (this.capturing) { this.endCapture(); return; }
    audio.sfx('ui_back', { volume: 0.5 });
    this.app.ui.pop();
  }
}
