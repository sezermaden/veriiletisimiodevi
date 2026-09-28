/* Spawn menu (Q / gamepad View). Left: tabs of spawnable things with rendered icons.
   Right: the Tool Gun's tool list and the selected tool's option panel. */
import * as THREE from 'three';
import { h, focusable } from './focus.js';
import { optionRow, button } from './widgets.js';
import { PROPS, PROP_CATEGORIES } from '../world/props.js';
import { NPC_TYPES } from '../world/npc.js';
import { PICKUPS } from '../world/pickups.js';
import { TOOL_ORDER, COLORS } from '../weapons/toolgun.js';
import { propIcon, objectIcon } from './icons.js';
import { Audio } from '../core/audio.js';
import { cyl } from '../world/geometry.js';

const TABS = ['Props', 'Entities', 'Weapons', 'NPCs', 'Vehicles'];
const WEAPONS = [['physgun', 'Physics Gun', '✦'], ['toolgun', 'Tool Gun', '⚙'], ['gravgun', 'Gravity Gun', '⊛'], ['crowbar', 'Crowbar', '⟋'], ['pistol', '9mm Pistol', '⌐'], ['smg', 'SMG', '☰'], ['shotgun', 'Shotgun', '═'], ['grenade', 'Frag Grenade', '●']];
const ENTITIES = [['health', 'Health Kit'], ['healthvial', 'Health Vial'], ['battery', 'Suit Battery'], ['ammo_pistol', 'Pistol Ammo'], ['ammo_smg', 'SMG Ammo'], ['ammo_buckshot', 'Buckshot'], ['ammo_grenade', 'Grenade']];

export class SpawnMenu {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.tab = 'Props';
    this.cat = PROP_CATEGORIES[0];
    this.el = null;
  }

  toggle(force = !this.open) {
    if (force === this.open) return;
    this.open = force;
    const g = this.game;
    if (force) {
      g.input.releaseAll();
      g.input.exitPointerLock();
      document.body.classList.add('cursor-on');
      this.build();
      g.ui.pushOverlay(this.el, this.focusFirst, (a) => this.onNav(a));
      Audio.play('ui_select');
    } else {
      g.ui.popOverlay(this.el);
      this.el?.remove();
      this.el = null;
      document.body.classList.remove('cursor-on');
      if (g.state === 'playing') g.requestLock();
    }
  }

  onNav(a) {
    if (a === 'back' || a === 'view' || a === 'menu') { this.toggle(false); return true; }
    if (a === 'tabL' || a === 'tabR') {
      const i = TABS.indexOf(this.tab);
      this.tab = TABS[(i + (a === 'tabR' ? 1 : -1) + TABS.length) % TABS.length];
      this.rebuildLeft(true);
      return true;
    }
    if (a === 'aux') { this.game.undo.undo(); return true; }
    return false;
  }

  build() {
    const g = this.game;
    const top = h('div.sm-top', {},
      button('Undo', () => g.undo.undo(), { sub: 'Z' }),
      button('Clean up', () => { g.cleanup(); this.updateCount(); }),
      g.mode === 'sandbox' ? button(g.player.noclip ? 'Noclip: ON' : 'Noclip: OFF', (b) => { g.player.setNoclip(!g.player.noclip); b.firstChild.textContent = g.player.noclip ? 'Noclip: ON' : 'Noclip: OFF'; }) : null,
      g.mode === 'sandbox' ? button(g.player.godMode ? 'God mode: ON' : 'God mode: OFF', (b) => { g.player.godMode = !g.player.godMode; b.firstChild.textContent = g.player.godMode ? 'God mode: ON' : 'God mode: OFF'; }) : null,
      g.mode === 'sandbox' ? button(g.aiEnabled ? 'NPC AI: ON' : 'NPC AI: OFF', (b) => { g.aiEnabled = !g.aiEnabled; b.firstChild.textContent = g.aiEnabled ? 'NPC AI: ON' : 'NPC AI: OFF'; }) : null,
      h('div.spacer'),
      this.countEl = h('span.count'),
      button('Close', () => this.toggle(false), { sub: 'Q' }),
    );
    this.left = h('div.sm-left');
    this.right = h('div.sm-right');
    this.el = h('div.spawnmenu', {}, top, this.left, this.right);
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.rebuildLeft(false);
    this.rebuildRight();
    this.updateCount();
  }

  updateCount() { if (this.countEl) this.countEl.textContent = `${this.game.entities.count('player')} / ${this.game.entities.limit} props`; }

  rebuildLeft(refocus) {
    const g = this.game;
    this.left.innerHTML = '';
    const tabs = h('div.sm-tabs', {}, ...TABS.map((t) => {
      const b = h('div.btn' + (t === this.tab ? '.on' : ''), { text: t });
      focusable(b, () => { this.tab = t; this.rebuildLeft(true); });
      return b;
    }));
    const body = h('div.sm-body');
    const cats = h('div.sm-cats');
    const grid = h('div.sm-grid');
    const items = [];
    if (this.tab === 'Props') {
      for (const c of PROP_CATEGORIES) {
        const b = h('div.btn' + (c === this.cat ? '.on' : ''), { text: c });
        focusable(b, () => { this.cat = c; this.rebuildLeft(true); });
        cats.append(b);
      }
      for (const [key, def] of Object.entries(PROPS)) if (def.cat === this.cat) items.push({ id: key, name: def.name, icon: () => propIcon(g.renderer.renderer, key), spawn: () => g.spawnFromMenu('prop', key), locked: !g.canSpawn('prop', key) });
    } else if (this.tab === 'Entities') {
      cats.append(h('div.btn.on', { text: 'Pickups' }));
      for (const [id, name] of ENTITIES) items.push({ id, name, icon: () => entityIcon(g, id), spawn: () => g.spawnFromMenu('pickup', id), locked: !g.canSpawn('pickup', id) });
      items.push({ id: 'balloon', name: 'Balloon', glyph: '🎈', spawn: () => g.spawnFromMenu('balloon'), locked: !g.canSpawn('balloon') });
    } else if (this.tab === 'Weapons') {
      cats.append(h('div.btn.on', { text: 'Weapons' }));
      for (const [id, name, glyph] of WEAPONS) items.push({ id, name, glyph, spawn: () => g.spawnFromMenu('weapon', id), locked: !g.canSpawn('weapon', id) });
    } else if (this.tab === 'NPCs') {
      cats.append(h('div.btn.on', { text: 'Characters' }));
      for (const [id, d] of Object.entries(NPC_TYPES)) items.push({ id, name: d.name, glyph: d.hostile ? '☠' : id === 'mannequin' ? '♙' : '☺', spawn: () => g.spawnFromMenu('npc', id), locked: !g.canSpawn('npc', id) });
    } else {
      cats.append(h('div.btn.on', { text: 'Vehicles' }));
      items.push({ id: 'rover', name: 'Rover', glyph: '🚙', spawn: () => g.spawnFromMenu('vehicle', 'rover'), locked: !g.canSpawn('vehicle', 'rover') });
    }
    for (const it of items) {
      const el = h('div.icon' + (it.locked ? '.locked' : ''), { title: it.name });
      if (it.icon) { const img = h('img', { alt: '' }); el.append(img); requestAnimationFrame(() => { try { img.src = it.icon(); } catch { /* icon failed */ } }); }
      else el.append(h('div.glyphbig', { text: it.glyph || '?' }));
      el.append(h('div.nm', { text: it.name }));
      focusable(el, () => {
        if (it.locked) { Audio.play('ui_error'); g.hud.notify('Not available yet', 'error'); return; }
        it.spawn();
        this.updateCount();
      });
      if (it.locked) el.classList.add('disabled');
      grid.append(el);
    }
    body.append(cats, grid);
    this.left.append(tabs, body);
    if (refocus) this.game.ui.focus.refresh(grid.firstChild);
  }

  rebuildRight() {
    const g = this.game;
    const tg = g.toolgun;
    this.right.innerHTML = '';
    const list = h('div.sm-tools');
    let lastCat = null;
    const tools = tg ? tg.tools : null;
    for (const id of TOOL_ORDER) {
      const t = tools?.[id];
      if (!t) continue;
      if (t.cat !== lastCat) { list.append(h('div.cat', { text: t.cat })); lastCat = t.cat; }
      const b = h('div.btn' + (tg?.current === id ? '.on' : ''), { text: t.name });
      const locked = !g.canUseTool(id);
      if (locked) b.classList.add('disabled');
      focusable(b, () => {
        if (locked) { Audio.play('ui_error'); return; }
        tg.setTool(id);
        if (!g.weapons.has('toolgun') && g.canSpawn('weapon', 'toolgun')) g.weapons.give('toolgun');
        g.weapons.select('toolgun', true);
        Audio.play('ui_select');
        for (const x of list.querySelectorAll('.btn')) x.classList.remove('on');
        b.classList.add('on');
        this.buildCPanel();
      });
      list.append(b);
    }
    if (!tools) list.append(h('div.cat', { text: 'Tool Gun not acquired' }));
    this.cpanel = h('div.sm-cpanel');
    this.right.append(list, this.cpanel);
    this.buildCPanel();
  }

  buildCPanel() {
    const tg = this.game.toolgun;
    const cp = this.cpanel;
    if (!cp) return;
    cp.innerHTML = '';
    if (!tg) return;
    const t = tg.tool;
    cp.append(h('div.cp-title', { text: t.name }), h('div.cp-help', { html: t.help.map((x) => `<div>${x}</div>`).join('') }));
    for (const o of t.options) {
      const spec = { type: o.type, min: o.min, max: o.max, step: o.step, choices: o.choices, palette: COLORS, get: () => t.o[o.key], set: (v) => { t.o[o.key] = v; } };
      cp.append(optionRow(o.label, spec));
    }
    if (!t.options.length) cp.append(h('div.cp-help', { text: 'This tool has no options.' }));
  }

  refreshTool() { if (this.open) this.buildCPanel(); }

  focusFirst = () => this.left?.querySelector('.sm-grid .icon');
}

function entityIcon(g, id) {
  return objectIcon(g.renderer.renderer, 'pickup_' + id, () => {
    const { g: grp } = PICKUPS[id].build();
    return grp;
  });
}

export { THREE, cyl };
