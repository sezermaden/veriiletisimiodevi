/* Menu screens. Each builder returns { el, onNav?, preferred?, onClose? } for UI.push/show. */
import { h, focusable } from './focus.js';
import { optionRow, button, promptBar } from './widgets.js';
import { settings, saveSettings, resetSettings, progress, resetProgress, DIFFICULTY } from '../core/settings.js';
import { ACTION_LABELS, keyName, PAD_NAMES } from '../core/controls.js';
import { CHAPTERS, SANDBOX_MAPS, VERSION } from '../story/meta.js';
import { Audio } from '../core/audio.js';
import { music } from '../core/music.js';

const IN_SHELL = (window.GAME_HOST || {}).shell === 'uwp';
const IS_XBOX = (window.GAME_HOST || {}).deviceFamily === 'Windows.Xbox';

function prompts(game, extra = []) {
  const pad = game.input.lastDevice === 'gamepad';
  const ok = pad ? '<span class="glyph pad-a">A</span>' : '<span class="glyph">ENTER</span>';
  const back = pad ? '<span class="glyph pad-b">B</span>' : '<span class="glyph">ESC</span>';
  return promptBar([[ok, 'Select'], [back, 'Back'], ...extra.map(([p, k, l]) => [pad ? `<span class="glyph">${p}</span>` : `<span class="glyph">${k}</span>`, l])]);
}

/* ================================================================== main menu */
export function mainMenu(game) {
  const hasRun = !!progress.current;
  const list = h('div.menu-list',
    {},
    hasRun ? item('Continue', `${CHAPTERS.find((c) => c.id === progress.current.chapter)?.title || ''}`, () => game.continueStory(), true) : null,
    item('New Story', 'Chapters 1–5', () => game.ui.push(storyMenu(game)), !hasRun),
    item('Sandbox', 'Build anything', () => game.ui.push(sandboxMenu(game))),
    item('Options', '', () => game.ui.push(optionsMenu(game))),
    item('Controls', '', () => game.ui.push(controlsMenu(game))),
    item('Credits', '', () => game.ui.push(creditsScreen(game))),
    IN_SHELL && !IS_XBOX ? item('Quit', '', () => { try { window.chrome?.webview?.postMessage('quit'); } catch { /* */ } }) : null,
  );
  const el = h('div.screen.shade.main-menu', {},
    h('div', {}, h('div.logo', {}, h('span.logo-a', { text: 'PROP' }), h('span.logo-b', { text: 'WORKS' })), h('div.tagline', { text: 'a physics sandbox story' }), h('span.sr-only', { text: 'Propworks main menu' })),
    list,
    h('div.version', { html: `v${VERSION}<br>${progress.finishedStory ? 'Story complete ✓' : `Chapters unlocked: ${progress.chapter + 1}/5`}` }),
  );
  return { el, onResume: () => music.setMood('menu') };
}

function item(text, hint, fn, autofocus = false) {
  const el = h('div.item', {}, h('span', { text }), hint ? h('span.hint', { text: hint }) : null);
  focusable(el, () => { Audio.play('ui_select'); fn(); }, { autofocus });
  return el;
}

/* ================================================================== story */
export function storyMenu(game) {
  let diff = settings.difficulty;
  const segEl = h('div.seg');
  const drawSeg = () => {
    segEl.innerHTML = '';
    for (const [k, d] of Object.entries(DIFFICULTY)) {
      const b = h('div.btn' + (k === diff ? '.on' : ''), { text: d.label });
      focusable(b, () => { diff = k; settings.difficulty = k; saveSettings(); drawSeg(); game.ui.focus.refresh(); Audio.play('ui_select'); });
      segEl.append(b);
    }
  };
  drawSeg();
  const cards = h('div.cards', {}, ...CHAPTERS.map((c, i) => {
    const locked = i > progress.chapter;
    const card = h('div.card' + (locked ? '.locked' : ''), { style: { background: `linear-gradient(160deg, ${c.tint}55, #0b0d12 70%), repeating-linear-gradient(45deg, #ffffff08 0 12px, transparent 12px 24px)` } },
      h('div.num', { text: c.num }), h('div.title', { text: c.title }), h('div.desc', { text: locked ? 'Locked — finish the previous chapter' : c.desc }),
      progress.completed.includes(c.id) ? h('div.desc', { text: '✓ Completed' }) : null);
    focusable(card, () => {
      if (locked) { Audio.play('ui_error'); return; }
      Audio.play('ui_select');
      game.startChapter(c.id);
    }, { autofocus: i === Math.min(progress.chapter, 4) });
    return card;
  }));
  const el = h('div.screen.dim', {},
    h('h1', { text: 'New Story' }),
    h('div.row', {}, h('h2', { text: 'Difficulty', style: { margin: 0 } }), segEl),
    h('div', { style: { height: '3vh' } }),
    cards,
    h('div.grow'),
    h('div.footer', {}, prompts(game), button('Back', () => game.ui.pop())),
  );
  return { el };
}

/* ================================================================== sandbox */
export function sandboxMenu(game) {
  const cards = h('div.cards', { style: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } }, ...SANDBOX_MAPS.map((m, i) => {
    const locked = m.unlock && !progress.completed.includes(m.unlock);
    const card = h('div.card' + (locked ? '.locked' : ''), { style: { background: `linear-gradient(160deg, ${['#d9772b', '#4f9e33', '#c4a46a', '#a64dff'][i]}66, #0b0d12 75%), repeating-linear-gradient(0deg, #ffffff0a 0 2px, transparent 2px 40px), repeating-linear-gradient(90deg, #ffffff0a 0 2px, transparent 2px 40px)` } },
      h('div.num', { text: 'SANDBOX' }), h('div.title', { text: m.name }), h('div.desc', { text: locked ? `Unlocked by finishing ${m.unlock.replace('ch', 'Chapter ')}` : m.desc }));
    focusable(card, () => { if (locked) { Audio.play('ui_error'); return; } Audio.play('ui_select'); game.startSandbox(m.id); }, { autofocus: i === 0 });
    return card;
  }));
  const el = h('div.screen.dim', {},
    h('h1', { text: 'Sandbox' }),
    h('h2', { text: 'Choose a map — everything is unlocked in sandbox mode' }),
    cards,
    h('div.grow'),
    h('div.footer', {}, prompts(game), button('Back', () => game.ui.pop())),
  );
  return { el };
}

/* ================================================================== options */
export function optionsMenu(game, { inGame = false } = {}) {
  const tabs = ['Video', 'Audio', 'Controls', 'Gameplay'];
  let tab = 'Video';
  const tabsEl = h('div.tabs');
  const body = h('div.opts.grow');
  const save = () => { saveSettings(); };
  const S = (label, key, spec, after = null) => optionRow(label, { ...spec, get: () => settings[key], set: (v) => { settings[key] = v; save(); after?.(v); } });
  const draw = () => {
    tabsEl.innerHTML = '';
    for (const t of tabs) {
      const b = h('div.btn' + (t === tab ? '.on' : ''), { text: t });
      focusable(b, () => { tab = t; draw(); game.ui.focus.refresh(b); });
      tabsEl.append(b);
    }
    body.innerHTML = '';
    const R = game.renderer;
    if (tab === 'Video') {
      body.append(
        S('Quality preset', 'quality', { type: 'select', choices: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']] }, () => R.applySettings()),
        S('Render scale', 'renderScale', { type: 'slider', min: 0.5, max: 1.5, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, () => R.resize()),
        S('Field of view', 'fov', { type: 'slider', min: 60, max: 110, step: 1, format: (v) => v + '°' }, (v) => { R.camera.fov = v; R.camera.updateProjectionMatrix(); }),
        S('Shadows', 'shadows', { type: 'check' }, () => R.applySettings()),
        S('Bloom', 'bloom', { type: 'check' }, () => R.applySettings()),
        S('Ambient occlusion (Ultra)', 'ao', { type: 'check' }, () => R.applySettings()),
        S('View bob', 'viewBob', { type: 'check' }),
        S('Show FPS', 'showFps', { type: 'check' }),
      );
    } else if (tab === 'Audio') {
      const vol = { type: 'slider', min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' };
      body.append(
        S('Master volume', 'master', vol, () => Audio.applyVolumes()),
        S('Effects volume', 'sfx', vol, () => Audio.applyVolumes()),
        S('Music volume', 'music', vol, () => Audio.applyVolumes()),
        S('Voice volume', 'voice', vol, () => Audio.applyVolumes()),
        S('Spoken dialogue (text-to-speech)', 'tts', { type: 'check' }),
      );
    } else if (tab === 'Controls') {
      body.append(
        S('Mouse sensitivity', 'mouseSensitivity', { type: 'slider', min: 0.2, max: 3, step: 0.05 }),
        S('Gamepad look speed', 'padSensitivity', { type: 'slider', min: 0.3, max: 3, step: 0.05 }),
        S('Stick deadzone', 'deadzone', { type: 'slider', min: 0.05, max: 0.4, step: 0.01 }, (v) => { game.input.deadzone = v; }),
        S('Invert look (Y axis)', 'invertY', { type: 'check' }),
        S('Toggle crouch', 'toggleCrouch', { type: 'check' }),
        S('Controller vibration', 'vibration', { type: 'check' }),
        optionRow('Key bindings…', { type: 'action', run: () => game.ui.push(controlsMenu(game)), get: () => 0, valueText: () => '›' }),
      );
    } else {
      body.append(
        S('Difficulty', 'difficulty', { type: 'select', choices: Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]) }),
        S('Subtitles', 'subtitles', { type: 'check' }),
        S('Hints', 'hints', { type: 'check' }),
        S('Crosshair', 'crosshair', { type: 'check' }),
        S('HUD', 'hud', { type: 'check' }),
        optionRow('Reset all settings', { type: 'action', run: () => { resetSettings(); Audio.applyVolumes(); R.applySettings(); draw(); game.ui.focus.refresh(); }, get: () => 0, valueText: () => '↺' }),
        inGame ? null : optionRow('Erase story progress', { type: 'action', run: () => { if (confirmTwice()) { resetProgress(); game.hud?.notify?.('Progress erased'); } }, get: () => 0, valueText: () => (armed ? 'Press again to confirm' : '⚠') }),
      );
    }
    game.ui.focus.refresh();
  };
  let armed = false;
  const confirmTwice = () => { if (armed) { armed = false; return true; } armed = true; setTimeout(() => { armed = false; }, 3000); return false; };
  const el = h('div.screen.dim', {},
    h('h1', { text: 'Options' }),
    tabsEl,
    h('div.panel.col.grow', {}, body),
    h('div.footer', {}, prompts(game, [['LB/RB', 'Q/E', 'Tabs'], ['◀ ▶', '← →', 'Adjust']]), button('Back', () => game.ui.pop())),
  );
  const onNav = (a) => {
    if (a === 'tabL' || a === 'tabR') { tab = tabs[(tabs.indexOf(tab) + (a === 'tabR' ? 1 : -1) + tabs.length) % tabs.length]; draw(); return true; }
    return false;
  };
  setTimeout(draw, 0);
  return { el, onNav, onClose: () => saveSettings() };
}

/* ================================================================== controls */
export function controlsMenu(game) {
  const c = game.input;
  const grid = h('div.bindgrid.grow');
  const draw = () => {
    grid.innerHTML = '';
    grid.append(h('div.h', { text: 'Action' }), h('div.h', { text: 'Primary' }), h('div.h', { text: 'Alternate' }), h('div.h', { text: 'Gamepad' }));
    for (const [action, label] of ACTION_LABELS) {
      const b = c.bindings[action];
      grid.append(h('div.name', { text: label }));
      for (let i = 0; i < 2; i++) {
        const btn = h('div.btn', { text: keyName(b.keys[i]) });
        focusable(btn, () => {
          btn.textContent = 'Press a key…';
          const handler = (e) => {
            e.preventDefault(); e.stopPropagation();
            removeEventListener('keydown', handler, true); removeEventListener('mousedown', mh, true);
            if (e.code !== 'Escape') { c.rebind(action, i, e.code); settings.bindings = c.exportBindings(); saveSettings(); }
            draw(); game.ui.focus.refresh();
          };
          const mh = (e) => { if (e.target === btn) return; e.preventDefault(); e.stopPropagation(); removeEventListener('keydown', handler, true); removeEventListener('mousedown', mh, true); c.rebind(action, i, 'Mouse' + e.button); settings.bindings = c.exportBindings(); saveSettings(); draw(); game.ui.focus.refresh(); };
          setTimeout(() => { addEventListener('keydown', handler, true); addEventListener('mousedown', mh, true); }, 50);
        });
        grid.append(btn);
      }
      const special = { spawnmenu: 'VIEW (tap)', undo: 'VIEW (hold)', noclip: 'R3 → menu', flashlight: 'R3 → menu' };
      grid.append(h('div.padname', { text: special[action] || (b.pad.length ? b.pad.map((p) => PAD_NAMES[p]).join(' / ') : '—') }));
    }
  };
  draw();
  const el = h('div.screen.dim', {},
    h('h1', { text: 'Controls' }),
    h('h2', { text: 'Keyboard & mouse bindings can be changed. Gamepad: left stick move · right stick look · RB/LB switch weapon · MENU pause' }),
    h('div.panel.col.grow', {}, grid),
    h('div.footer', {}, prompts(game), h('div.row', {}, button('Reset to defaults', () => { c.resetBindings(); settings.bindings = null; saveSettings(); draw(); game.ui.focus.refresh(); }), button('Back', () => game.ui.pop()))),
  );
  return { el };
}

/* ================================================================== credits */
export function creditsScreen(game, { ending = false } = {}) {
  const lines = [
    ['big', 'PROPWORKS'], ['', 'a physics sandbox story'],
    ['h', 'Design, code, art & sound'], ['', 'Generated end-to-end with Claude Code'],
    ['h', 'Starring'], ['', 'You — the Builder'], ['', 'WREN — Workshop Research ENgine'], ['', 'The Unrendered'],
    ['h', 'Engine'], ['', 'three.js (MIT)'], ['', 'Rapier physics (Apache-2.0)'],
    ['h', 'Every texture, model and sound'], ['', 'procedurally generated at runtime'],
    ['h', 'Inspired by'], ['', 'a decade of people building things in sandboxes'],
    ['h', 'Thank you for playing'], ['', ending ? 'Sandbox mode now contains everything you unlocked.' : ''],
  ];
  const inner = h('div.credits-inner', {}, ...lines.map(([cls, t]) => h('div' + (cls ? '.' + cls : ''), { text: t })));
  const roll = h('div.credits-roll', {}, inner);
  let y = innerHeight * 0.7;
  let raf = 0;
  const tick = () => {
    y -= 0.9 * (innerHeight / 1080);
    inner.style.transform = `translateY(${y}px)`;
    if (y < -inner.offsetHeight) y = innerHeight * 0.7;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const back = button(ending ? 'Return to main menu' : 'Back', () => { if (ending) game.toMainMenu(); else game.ui.pop(); }, { autofocus: true });
  const el = h('div.screen.dim', {}, h('h1', { text: 'Credits' }), roll, h('div.footer', {}, prompts(game), back));
  if (ending) music.setMood('ending');
  return { el, onClose: () => cancelAnimationFrame(raf), onNav: (a) => { if (a === 'back' && ending) { game.toMainMenu(); return true; } return false; } };
}

/* ================================================================== pause */
export function pauseMenu(game) {
  const list = h('div.menu-list', {},
    item('Resume', '', () => game.resume(), true),
    game.mode === 'story' ? item('Restart from checkpoint', '', () => game.restartCheckpoint()) : item('Clean up map', '', () => { game.cleanup(); game.resume(); }),
    item('Options', '', () => game.ui.push(optionsMenu(game, { inGame: true }))),
    item('Controls', '', () => game.ui.push(controlsMenu(game))),
    item('Quit to main menu', '', () => game.toMainMenu()),
  );
  const title = game.mode === 'story' ? (CHAPTERS.find((c) => c.id === game.chapterId)?.title || '') : game.mapName;
  const el = h('div.screen.dim', {}, h('h1', { text: 'Paused' }), h('h2', { text: title }), list, h('div.grow'), h('div.footer', {}, prompts(game), h('div')));
  return { el, onNav: (a) => { if (a === 'back' || a === 'menu') { game.resume(); return true; } return false; } };
}

/* ================================================================== death */
export function deathScreen(game, cause = '') {
  const el = h('div.screen.death', {},
    h('h1', { text: 'You died' }),
    h('h2', { text: cause }),
    h('div.row.center', { style: { gap: '1vw', marginTop: '3vh' } },
      button(game.mode === 'story' ? 'Restart from checkpoint' : 'Respawn', () => game.respawn(), { cls: 'primary', autofocus: true }),
      button('Main menu', () => game.toMainMenu())),
  );
  return { el, onNav: (a) => (a === 'back' ? true : false) };
}

/* ================================================================== terminal */
export function terminalOverlay(game, title, body, onClose) {
  const close = button('Close', () => onClose(), { autofocus: true });
  const el = h('div.screen.dim', {}, h('div.term', {}, h('div.tt', { text: '> ' + title }), h('div.tb', { text: body }), close));
  return { el, onNav: (a) => { if (a === 'back' || a === 'menu') { onClose(); return true; } return false; } };
}
