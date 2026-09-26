// Story map: the illustrated Tidehaven map with four worlds and their stage nodes, an info panel
// for the focused stage, LB/RB to switch worlds, PLAY → kit picker → startStage.
import { UiScreen, promptBar, pearlChip, heading, esc, fmtTime } from './widgets.js';
import { audio } from '../engine/audio.js';
import { save } from '../engine/save.js';
import { lockIcon, checkIcon, skullIcon, clockIcon, pearlIcon, postcardIcon, trophyIcon } from './icons.js';
import { mapSVG, routeSVG, NODE_POS, WORLD_VIEW, MAP_W, MAP_H } from './map-art.js';
import {
  WORLDS, STAGE_ORDER, stageMeta, stageNum, stageState, stageSave, isBoss, worldOf, isCleared, isUnlocked,
  worldUnlocked, clearedCount, nextStage, loadStageMeta,
} from './stage-data.js';
import { KitPickerScreen } from './kit-picker.js';
import { startStage } from './flow.js';

export class StoryMapScreen extends UiScreen {
  constructor(app, focusStageId = null) {
    super(app, { className: 'story-map', blocksGame: false });
    let f = STAGE_ORDER.includes(focusStageId) ? focusStageId : nextStage();
    // coming back from a freshly cleared stage: point at the one it just unlocked
    const after = STAGE_ORDER[STAGE_ORDER.indexOf(f) + 1];
    if (focusStageId && isCleared(f) && after && isUnlocked(after) && !isCleared(after)) f = after;
    this.focusId = f;
    this.world = worldOf(this.focusId)?.n || 1;
    this.sel = this.focusId;
    this._laid = null;
  }

  build() {
    this.el.innerHTML = `
      <div class="sm">
        <header class="sm-head">
          ${heading('STORY MODE', { seed: 12 })}
          <div class="sm-worlds tabs" role="tablist">
            <span class="tab-key" data-prompt="ui_prev" data-act="ui_prev"></span>
            ${WORLDS.map((w) => `<div class="tab world-tab" data-world="${w.n}"><b>${w.n}</b><span>${esc(w.name)}</span></div>`).join('')}
            <span class="tab-key" data-prompt="ui_next" data-act="ui_next"></span>
          </div>
        </header>
        <div class="sm-map card">
          <div class="sm-canvas" style="width:${MAP_W}px;height:${MAP_H}px">
            ${mapSVG()}
            <div class="sm-nodes">
              ${STAGE_ORDER.map((id) => {
                const [x, y] = NODE_POS[id];
                return `<div class="node${isBoss(id) ? ' boss' : ''}" data-id="${id}" data-world="${worldOf(id).n}" style="left:${x}px;top:${y}px">
                  <div class="node-ring"></div><div class="node-in"></div><div class="node-tag"></div><span class="node-rank"></span></div>`;
              }).join('')}
            </div>
          </div>
          <div class="sm-world-banner"><span class="swb-n"></span><span class="swb-name"></span><span class="swb-set"></span></div>
        </div>
        <aside class="sm-panel card sticker">
          <div class="sp-head"><span class="sp-num"></span><div class="sp-names"><div class="sp-world"></div><h2 class="sp-title"></h2></div></div>
          <div class="sp-tag"></div>
          <p class="sp-blurb"></p>
          <div class="sp-goal"><b>GOAL</b><span class="sp-goal-t"></span></div>
          <div class="sp-stats">
            <div class="sp-stat">${clockIcon()}<span class="k">Best time</span><span class="v st-time"></span></div>
            <div class="sp-stat">${pearlIcon()}<span class="k">Pearls</span><span class="v st-pearls"></span></div>
            <div class="sp-stat">${postcardIcon()}<span class="k">Postcard</span><span class="v st-card"></span></div>
            <div class="sp-stat">${trophyIcon()}<span class="k">Rank</span><span class="v st-rank"></span></div>
          </div>
          <div class="sp-lock">${lockIcon()}<span class="sp-lock-t"></span></div>
          <div class="btn btn-play"><span class="play-tri"></span><span class="play-t">PLAY</span></div>
        </aside>
        <footer class="sm-foot">${promptBar([['ui_accept', 'Play'], ['ui_prev,ui_next', 'World'], ['ui_back', 'Back']])}
          <div class="sm-chips"><div class="chip prog-chip">${checkIcon()}<span class="pg-n"></span></div>${pearlChip()}</div></footer>
      </div>`;

    for (const n of this.$$('.node')) {
      this.button(n, () => this.play(n.dataset.id), { silent: true, autofocus: n.dataset.id === this.focusId });
    }
    this.button(this.$('.btn-play'), () => this.play(this.sel), { silent: true });
    for (const t of this.$$('.world-tab')) t.addEventListener('click', () => this.setWorld(Number(t.dataset.world)));
    this.$('.m-routes').innerHTML = routeSVG(STAGE_ORDER, isCleared);
    this.renderNodes();
    this.setWorld(this.world, { silent: true, keepFocus: true });
    loadStageMeta().then(() => { this.renderNodes(); this.showStage(this.sel); });
  }

  onEnter() {
    this.app.menuScene?.setShot('map');
    this.app.menuScene?.setCovered?.(true);
    try { audio.playMusic('map'); } catch { /* optional */ }
  }
  onExit() { this.app.menuScene?.setCovered?.(false); }
  onResume() {
    this.app.menuScene?.setShot('map');
    this.renderNodes();
    this.$('.m-routes').innerHTML = routeSVG(STAGE_ORDER, isCleared);
    this.$('.pc-n').textContent = String(save.data.pearls || 0);
  }

  renderNodes() {
    for (const n of this.$$('.node')) {
      const id = n.dataset.id;
      const st = stageState(id);
      n.classList.remove('locked', 'open', 'cleared');
      n.classList.add(st);
      n.querySelector('.node-in').innerHTML = st === 'locked' ? lockIcon() : isBoss(id) ? skullIcon() : `<span class="node-num">${stageNum(id)}</span>`;
      n.querySelector('.node-tag').textContent = stageMeta(id).title;
      const r = stageSave(id)?.rank;
      const rank = n.querySelector('.node-rank');
      rank.textContent = st === 'cleared' ? (r || '✓') : '';
      rank.className = `node-rank${r ? ' rank-' + r : ''}`;
      n.setAttribute('aria-label', `${stageNum(id)} ${stageMeta(id).title} — ${st}`);
    }
    this.$('.pg-n').textContent = `${clearedCount()} / ${STAGE_ORDER.length}`;
  }

  setWorld(n, { silent = false, keepFocus = false } = {}) {
    n = Math.max(1, Math.min(WORLDS.length, n));
    const changed = n !== this.world;
    this.world = n;
    const W = WORLDS[n - 1];
    for (const t of this.$$('.world-tab')) {
      const on = Number(t.dataset.world) === n;
      t.classList.toggle('on', on);
      t.classList.toggle('locked', !worldUnlocked(WORLDS[Number(t.dataset.world) - 1]));
    }
    for (const g of this.$$('.region')) g.classList.toggle('dim', Number(g.dataset.world) !== n);
    for (const node of this.$$('.node')) {
      const mine = Number(node.dataset.world) === n;
      node.classList.toggle('off', !mine);
      node.classList.toggle('focusable', mine);
    }
    const b = this.$('.sm-world-banner');
    b.querySelector('.swb-n').textContent = `WORLD ${n}`;
    b.querySelector('.swb-name').textContent = W.name;
    b.querySelector('.swb-set').textContent = worldUnlocked(W) ? W.setting : `Locked — clear World ${n - 1} first`;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    this.layoutMap(true);
    if (!silent && changed) audio.sfx('ui_tab', { volume: 0.5 });
    const cur = this.focus.current;
    if (cur && cur.classList.contains('node') && Number(cur.dataset.world) !== n) {
      cur.classList.remove('focused');
      this.focus.current = null;
    }
    if (!keepFocus || !W.stages.includes(this.sel)) {
      const pick = W.stages.find((id) => isUnlocked(id) && !isCleared(id)) || [...W.stages].reverse().find(isUnlocked) || W.stages[0];
      this.focus.refresh(false);
      const el = this.$(`.node[data-id="${pick}"]`);
      if (el) this.focus.focus(el);
      this.showStage(pick);
    } else {
      this.focus.refresh(false);
      this.showStage(this.sel);
    }
  }

  layoutMap(force = false) {
    const box = this.$('.sm-map');
    const w = box.clientWidth, h = box.clientHeight;
    const L = this._laid || (this._laid = { w: 0, h: 0, world: 0 });   // runs every frame: no garbage
    if (!force && L.w === w && L.h === h && L.world === this.world) return;
    if (!w || !h) return;
    L.w = w; L.h = h; L.world = this.world;
    const V = WORLD_VIEW[this.world];
    // cover the box, zoomed toward the world; on ultra-wide boxes the width alone already zooms in
    const s = Math.max(w / MAP_W, (h / MAP_H) * V.zoom);
    let tx = w / 2 - V.cx * s, ty = h / 2 - V.cy * s;
    tx = Math.min(0, Math.max(w - MAP_W * s, tx));
    ty = Math.min(0, Math.max(h - MAP_H * s, ty));
    const c = this.$('.sm-canvas');
    c.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    c.style.setProperty('--inv', (1 / s).toFixed(4));
  }

  update(dt) {
    super.update(dt);
    this.layoutMap(false);
  }

  handleInput(input) {
    if (input.justPressed('ui_prev')) { this.onTab(-1); return true; }
    if (input.justPressed('ui_next')) { this.onTab(1); return true; }
    return false;
  }

  onTab(d) {
    const n = this.world + d;
    if (n < 1 || n > WORLDS.length) { audio.sfx('ui_denied', { volume: 0.3 }); return; }
    this.setWorld(n);
  }

  onFocus(el) {
    if (el.classList.contains('node')) {
      this.showStage(el.dataset.id);
      for (const n of this.$$('.node')) n.classList.toggle('sel', n === el);
    }
  }

  showStage(id) {
    this.sel = id;
    const m = stageMeta(id);
    const st = stageState(id);
    const sv = stageSave(id) || {};
    const W = worldOf(id);
    const p = this.$('.sm-panel');
    p.dataset.state = st;
    p.querySelector('.sp-num').textContent = stageNum(id);
    p.querySelector('.sp-world').textContent = `WORLD ${W.n} · ${W.name.toUpperCase()}${isBoss(id) ? ' · BOSS' : ''}`;
    p.querySelector('.sp-title').textContent = m.title;
    p.querySelector('.sp-tag').textContent = st === 'locked' ? '' : (m.subtitle || '');
    p.querySelector('.sp-blurb').textContent = st === 'locked' ? 'The Murk still has this part of town. Clear the previous stage to push through.' : m.blurb;
    p.querySelector('.sp-goal-t').textContent = m.objective || '';
    p.querySelector('.st-time').textContent = sv.bestTime ? fmtTime(sv.bestTime) : '—';
    p.querySelector('.st-pearls').textContent = sv.pearlsFound != null ? (m.pearls ? `${sv.pearlsFound} / ${m.pearls}` : String(sv.pearlsFound)) : '—';
    p.querySelector('.st-card').textContent = sv.postcard ? 'Found' : (sv.done ? 'Missing' : '—');
    const rk = p.querySelector('.st-rank');
    rk.textContent = sv.rank || '—';
    rk.className = `v st-rank${sv.rank ? ' rank rank-' + sv.rank : ''}`;
    const prev = STAGE_ORDER[STAGE_ORDER.indexOf(id) - 1];
    p.querySelector('.sp-lock-t').textContent = st === 'locked' && prev ? `Clear ${stageNum(prev)} ${stageMeta(prev).title} to unlock` : '';
    p.querySelector('.play-t').textContent = st === 'locked' ? 'LOCKED' : st === 'cleared' ? 'REPLAY' : 'PLAY';
    this.$('.btn-play').classList.toggle('is-locked', st === 'locked');
    p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop');
  }

  play(id) {
    if (!id) return;
    if (stageState(id) === 'locked') {
      audio.sfx('ui_denied', { volume: 0.5 });
      this.shake(this.$(`.node[data-id="${id}"]`));
      this.shake(this.$('.sp-lock'));
      return;
    }
    audio.sfx('ui_select', { volume: 0.5 });
    this.app.ui.push(new KitPickerScreen(this.app, {
      title: `${stageNum(id)} ${stageMeta(id).title}`,
      onPick: (kit) => {
        save.data.kit = kit;
        save.save();
        return startStage(this.app, id, { kit });
      },
    }));
  }
}
