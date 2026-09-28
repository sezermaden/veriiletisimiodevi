/* In-game HUD: health / suit / ammo boxes, crosshair, tool info panel, notices, hints,
   pickups, objective, subtitles, chapter cards, weapon selector, damage direction,
   boss bar, use prompt and timers. Button prompts follow the last used device. */
import * as THREE from 'three';
import { h } from './focus.js';
import { settings } from '../core/settings.js';
import { keyName, PAD_NAMES } from '../core/controls.js';
import { Audio } from '../core/audio.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.root.innerHTML = '';
    const R = this.root;
    this.hurt = R.appendChild(h('div.hurt'));
    const left = R.appendChild(h('div.hud-left'));
    this.health = left.appendChild(h('div.hud-box#hud-health', {}, h('span.lbl', { text: 'HEALTH' }), h('span.num', { text: '100' })));
    this.armor = left.appendChild(h('div.hud-box#hud-armor', {}, h('span.lbl', { text: 'SUIT' }), h('span.num', { text: '0' })));
    this.ammo = R.appendChild(h('div.hud-box#hud-ammo', {}, h('span.wname'), h('span.num'), h('span.num.small')));
    this.cross = R.appendChild(h('div.crosshair', {}, h('i.d'), h('i.l'), h('i.r'), h('i.t'), h('i.b')));
    this.use = R.appendChild(h('div.use-prompt.hidden'));
    this.tool = R.appendChild(h('div.tool-info.hidden', {}, h('div.tname'), h('div.thelp'), h('div.tstatus')));
    this.notices = R.appendChild(h('div.notices'));
    this.hints = R.appendChild(h('div.hints'));
    this.pickupsEl = R.appendChild(h('div.pickups'));
    this.objective = R.appendChild(h('div.objective.hidden', {}, h('div.ol', { text: 'OBJECTIVE' }), h('div.ot')));
    this.subtitle = R.appendChild(h('div.subtitle.hidden'));
    this.wsel = R.appendChild(h('div.weapon-select.hidden'));
    this.boss = R.appendChild(h('div.boss.hidden', {}, h('div.bn'), h('div.bb', {}, h('i')), h('div.bs')));
    this.timer = R.appendChild(h('div.timer.hidden'));
    this.fps = R.appendChild(h('div.fps.hidden'));
    this.fadeEl = R.appendChild(h('div.fade'));
    this.arcs = [];
    this._subQ = [];
    this._subT = 0;
    this._hintSeen = new Set();
    this._toolStatus = null;
    this._lastVals = {};
    this._fpsAcc = 0; this._fpsN = 0;
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  /* ------------------------------------------------ prompts */
  /** "[E]" or "(Y)" depending on the last device, for an action name. */
  key(action) {
    const c = this.game.input;
    if (c.lastDevice === 'gamepad') {
      const special = { spawnmenu: 'VIEW', undo: 'hold VIEW', noclip: 'R3 menu', flashlight: 'R3 menu' };
      if (special[action]) return `<span class="glyph">${special[action]}</span>`;
      const p = c.bindings[action]?.pad?.[0];
      if (p === undefined) return '<span class="glyph">—</span>';
      const n = PAD_NAMES[p];
      const cls = { A: 'pad-a', B: 'pad-b', X: 'pad-x', Y: 'pad-y' }[n] || '';
      return `<span class="glyph ${cls}">${n}</span>`;
    }
    return `<span class="glyph">${keyName(c.bindings[action]?.keys?.[0])}</span>`;
  }

  /* ------------------------------------------------ notices, hints, pickups */
  notify(text, kind = '') {
    const n = h('div.notice', {}, text);
    if (kind) n.classList.add(kind);
    this.notices.prepend(n);
    while (this.notices.children.length > 6) this.notices.lastChild.remove();
    setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 400); }, 3200);
  }

  hint(html, seconds = 7, id = null) {
    if (!settings.hints) return;
    if (id) { if (this._hintSeen.has(id)) return; this._hintSeen.add(id); }
    const n = h('div.hintbox', {}, h('span.ico', { text: '💡' }), h('span', { html }));
    this.hints.append(n);
    Audio.play('hint');
    while (this.hints.children.length > 3) this.hints.firstChild.remove();
    setTimeout(() => { n.classList.add('notice', 'out'); setTimeout(() => n.remove(), 400); }, seconds * 1000);
  }

  clearHints() { this.hints.innerHTML = ''; this._hintSeen.clear(); }

  pickup(name) {
    const n = h('div', { text: '+ ' + name });
    this.pickupsEl.append(n);
    setTimeout(() => n.remove(), 2600);
    while (this.pickupsEl.children.length > 5) this.pickupsEl.firstChild.remove();
  }

  setObjective(text) {
    if (!text) { this.objective.classList.add('hidden'); return; }
    this.objective.classList.remove('hidden');
    this.objective.querySelector('.ot').textContent = text;
    this.objective.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 400 });
  }

  /** Queue a subtitle line. speaker class: '' | 'sys' | 'null'. */
  say(speaker, text, seconds = null, cls = '') {
    const dur = seconds ?? Math.max(2.4, text.length * 0.058);
    this._subQ.push({ speaker, text, dur, cls });
    return dur;
  }

  clearSubtitles() { this._subQ = []; this._subT = 0; this.subtitle.classList.add('hidden'); }

  chapterCard(num, title) {
    const c = h('div.chapter-card', {}, h('div.n', { text: num }), h('div.t', { text: title }));
    this.root.append(c);
    setTimeout(() => c.remove(), 5600);
  }

  centerMessage(text) {
    const c = h('div.center-msg', { text });
    this.root.append(c);
    setTimeout(() => c.remove(), 2700);
  }

  toolStatus(text) { this._toolStatus = text; }

  damageFrom(from) {
    if (!from) return;
    const a = h('div.dmg-arc');
    this.root.append(a);
    this.arcs.push({ el: a, from: from.clone ? from.clone() : new THREE.Vector3(from.x, from.y, from.z), t: 1.2 });
  }

  setBoss(name, frac, status = '') {
    if (name === null) { this.boss.classList.add('hidden'); return; }
    this.boss.classList.remove('hidden');
    this.boss.querySelector('.bn').textContent = name;
    this.boss.querySelector('.bb i').style.width = Math.max(0, frac * 100) + '%';
    this.boss.querySelector('.bs').textContent = status;
  }

  setTimer(seconds) {
    if (seconds === null) { this.timer.classList.add('hidden'); return; }
    this.timer.classList.remove('hidden');
    const s = Math.max(0, Math.ceil(seconds));
    this.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  fade(to, white = false, ms = 800) {
    this.fadeEl.classList.toggle('white', white);
    this.fadeEl.style.transition = `opacity ${ms}ms`;
    this.fadeEl.style.opacity = to;
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ------------------------------------------------ per frame */
  update(dt) {
    const g = this.game, p = g.player;
    if (!p) return;
    const set = (el, sel, v) => { const k = el.id + sel; if (this._lastVals[k] !== v) { this._lastVals[k] = v; el.querySelector(sel).textContent = v; } };
    const hp = Math.ceil(p.health);
    set(this.health, '.num', String(hp));
    this.health.classList.toggle('low', hp <= 25);
    set(this.armor, '.num', String(Math.ceil(p.armor)));
    this.armor.classList.toggle('hidden', p.armor <= 0 && !g.weapons.has('pistol'));
    const wi = g.weapons.hudInfo();
    if (wi && wi.clip !== undefined) {
      this.ammo.classList.remove('hidden');
      set(this.ammo, '.wname', wi.name.toUpperCase());
      set(this.ammo, '.num', String(wi.clip));
      set(this.ammo, '.num.small', wi.reserve === null || wi.reserve === undefined ? '' : String(wi.reserve));
      this.ammo.classList.toggle('low', wi.clip === 0);
    } else this.ammo.classList.add('hidden');
    this.hurt.style.opacity = Math.min(1, p.hurtFlash * 0.9 + (p.health < 25 ? 0.25 + Math.sin(performance.now() / 300) * 0.1 : 0));
    this.cross.classList.toggle('hidden', !settings.crosshair || !!p.vehicle);
    this.cross.classList.toggle('grab', !!g.physgun?.held);

    // tool panel (GMod shows the active tool top-left)
    const cur = g.weapons.current;
    if (cur?.id === 'toolgun') {
      const t = cur.tool;
      this.tool.classList.remove('hidden');
      set(this.tool, '.tname', t.name);
      const help = t.help.join('\n');
      if (this._lastHelp !== help) { this._lastHelp = help; this.tool.querySelector('.thelp').innerHTML = t.help.map((x) => `<div>${x}</div>`).join(''); }
      set(this.tool, '.tstatus', this._toolStatus || '');
    } else if (cur?.id === 'physgun' && g.physgun.held) {
      this.tool.classList.remove('hidden');
      set(this.tool, '.tname', 'Physics Gun');
      const help = `${this.key('secondary')} freeze · ${this.key('use')} + look: rotate · ${g.input.lastDevice === 'gamepad' ? '<span class="glyph">D-UP/DOWN</span>' : '<span class="glyph">WHEEL</span>'} push/pull`;
      if (this._lastHelp !== help) { this._lastHelp = help; this.tool.querySelector('.thelp').innerHTML = help; }
      set(this.tool, '.tstatus', g.physgun.held.e.name + ' · ' + Math.round(g.physgun.held.e.mass) + ' kg');
    } else this.tool.classList.add('hidden');

    // use prompt
    const u = g.useTarget;
    if (u && !p.vehicle) {
      this.use.classList.remove('hidden');
      const html = `${this.key('use')} ${u.prompt}`;
      if (this.use.innerHTML !== html) this.use.innerHTML = html;
    } else if (p.vehicle) {
      this.use.classList.remove('hidden');
      const html = `${this.key('use')} Exit vehicle`;
      if (this.use.innerHTML !== html) this.use.innerHTML = html;
    } else this.use.classList.add('hidden');

    // subtitles
    if (this._subT > 0) {
      this._subT -= dt;
      if (this._subT <= 0) this.subtitle.classList.add('hidden');
    }
    if (this._subT <= 0 && this._subQ.length) {
      const s = this._subQ.shift();
      this._subT = s.dur;
      if (settings.subtitles) {
        this.subtitle.className = 'subtitle ' + s.cls;
        this.subtitle.innerHTML = '';
        if (s.speaker) this.subtitle.append(h('b', { text: s.speaker + ':' }));
        this.subtitle.append(s.text);
      }
    }

    // weapon selector
    if (g.weapons.selectorT > 0) {
      this.wsel.classList.remove('hidden');
      const sel = g.weapons.pending || g.weapons.current;
      const key = g.weapons.list().map((w) => w.id).join(',') + '|' + sel?.id;
      if (this._wkey !== key) {
        this._wkey = key;
        this.wsel.innerHTML = '';
        for (let s = 1; s <= 6; s++) {
          const ws = g.weapons.list().filter((w) => w.slot === s);
          if (!ws.length) continue;
          const col = h('div.wslot', {}, h('div.sn', { text: String(s) }));
          for (const w of ws) col.append(h('div.w' + (w === sel ? '.on' : ''), { text: w.name }));
          this.wsel.append(col);
        }
      }
      this.wsel.style.opacity = Math.min(1, g.weapons.selectorT * 2);
    } else this.wsel.classList.add('hidden');

    // damage arcs
    const cam = g.renderer.camera;
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.t -= dt;
      if (a.t <= 0) { a.el.remove(); this.arcs.splice(i, 1); continue; }
      const d = a.from.clone().sub(cam.position);
      const yaw = Math.atan2(d.x, d.z);
      const camYaw = p.rig.yaw + Math.PI;
      const ang = -(yaw - camYaw);
      a.el.style.transform = `rotate(${ang}rad)`;
      a.el.style.opacity = Math.min(1, a.t);
    }

    // fps
    if (settings.showFps) {
      this._fpsAcc += dt; this._fpsN++;
      if (this._fpsAcc > 0.5) { this.fps.textContent = Math.round(this._fpsN / this._fpsAcc) + ' fps'; this._fpsAcc = 0; this._fpsN = 0; }
      this.fps.classList.remove('hidden');
    } else this.fps.classList.add('hidden');

    const hudOn = settings.hud;
    for (const el of [this.health, this.armor, this.ammo]) el.style.visibility = hudOn ? '' : 'hidden';
  }

  reset() {
    this.clearSubtitles();
    this.setObjective(null);
    this.setBoss(null);
    this.setTimer(null);
    this.notices.innerHTML = '';
    this.hints.innerHTML = '';
    this.pickupsEl.innerHTML = '';
    for (const a of this.arcs) a.el.remove();
    this.arcs = [];
    this._toolStatus = null;
    this.fadeEl.style.opacity = 0;
  }
}
