// In-game HUD (DOM). Crosshair, ink tank, special gauge, weapon slots, damage ink on the screen
// edges, pearls, objective, toasts, hints, boss bar and the Turf Clash scoreboard.
import { settings } from '../engine/settings.js';
import { promptHTML } from '../engine/game-input.js';
import { SUB_INFO, SPECIAL_INFO } from '../weapons/base.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export class Hud {
  constructor(session) {
    this.session = session;
    const root = this.root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <canvas class="hud-screenink"></canvas>
      <div class="hud-crosshair"><div class="ring"></div><div class="dot"></div></div>
      <div class="hud-hitmarker"></div>
      <div class="hud-inktank"><div class="fill"></div></div>
      <div class="hud-lowink">LOW INK!</div>
      <div class="hud-topleft">
        <div class="hud-chip pearls"><span class="pearl"></span><span class="n">0</span></div>
        <div class="hud-objective"></div>
      </div>
      <div class="hud-special">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="rgba(11,10,38,.72)" stroke="rgba(255,255,255,.25)" stroke-width="10"/>
          <circle class="arc" cx="60" cy="60" r="50" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset="314.16"/></svg>
        <div class="label"><b>0%</b><span class="sname">SPECIAL</span></div>
      </div>
      <div class="hud-weapon">
        <div class="slot sub"><svg class="ico" viewBox="0 0 44 44"></svg><div class="name"></div><div class="key"></div></div>
        <div class="slot sp"><svg class="ico" viewBox="0 0 44 44"></svg><div class="name"></div><div class="key"></div></div>
      </div>
      <div class="hud-boss hidden"><div class="name"></div><div class="bar"><div class="fill"></div></div></div>
      <div class="hud-turf hidden"><div class="team a"></div><div class="timer">3:00</div><div class="team b"></div></div>
      <div class="hud-toast-wrap"></div>
      <div class="hud-hint hidden"></div>
      <div class="hud-fps"></div>
    `;
    document.getElementById('hud-root').appendChild(root);
    const q = (s) => root.querySelector(s);
    this.el = {
      cross: q('.hud-crosshair'), hitmarker: q('.hud-hitmarker'), tank: q('.hud-inktank'), tankFill: q('.hud-inktank .fill'),
      lowink: q('.hud-lowink'), pearls: q('.pearls .n'), objective: q('.hud-objective'), special: q('.hud-special'),
      arc: q('.hud-special .arc'), specialPct: q('.hud-special b'), specialName: q('.hud-special .sname'),
      subName: q('.slot.sub .name'), subKey: q('.slot.sub .key'), subSlot: q('.slot.sub'), subIco: q('.slot.sub .ico'),
      spName: q('.slot.sp .name'), spKey: q('.slot.sp .key'), spSlot: q('.slot.sp'), spIco: q('.slot.sp .ico'),
      boss: q('.hud-boss'), bossName: q('.hud-boss .name'), bossFill: q('.hud-boss .fill'),
      turf: q('.hud-turf'), turfTimer: q('.hud-turf .timer'), turfA: q('.hud-turf .team.a'), turfB: q('.hud-turf .team.b'),
      toasts: q('.hud-toast-wrap'), hint: q('.hud-hint'), fps: q('.hud-fps'), ink: q('.hud-screenink'),
    };
    this.inkCtx = this.el.ink.getContext('2d');
    this._resizeInk();
    this._onResize = () => this._resizeInk();
    addEventListener('resize', this._onResize);
    this.inkAlpha = 0;
    this.hintT = 0;
    this._fpsAcc = 0; this._fpsN = 0;
    this.visible = true;
    this._lastDevice = null;
    this.refreshKit();
    this.setScale(settings.get('gameplay.hudScale') || 1);
  }

  setScale(s) { this.root.style.setProperty('--hud-scale', s); }

  _resizeInk() {
    this.el.ink.width = Math.max(1, Math.round(innerWidth / 2));
    this.el.ink.height = Math.max(1, Math.round(innerHeight / 2));
  }

  show(v) { this.visible = v; this.root.classList.toggle('hidden', !v); }

  refreshKit() {
    const p = this.session.player;
    if (!p) return;
    const def = p.kit.def;
    const input = this.session.input;
    this.el.subName.textContent = SUB_INFO[def.sub]?.name || '';
    this.el.spName.textContent = SPECIAL_INFO[def.special]?.name || '';
    this.el.specialName.textContent = (SPECIAL_INFO[def.special]?.name || 'Special').toUpperCase();
    this.el.subKey.innerHTML = promptHTML(input, 'sub');
    this.el.spKey.innerHTML = promptHTML(input, 'special');
    this.el.subIco.innerHTML = subIcon(def.sub);
    this.el.spIco.innerHTML = specialIcon(def.special);
    this._lastDevice = input?.lastDevice;
  }

  toast(text, kind = 'normal') {
    const d = document.createElement('div');
    d.className = 'hud-toast' + (kind === 'big' ? ' big' : '');
    d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 2500);
  }

  /** Contextual control hint. html may contain {fire} {swim} {jump} {sub} {special} {interact} tokens. */
  hint(html, seconds = 4) {
    if (!settings.get('gameplay.hints')) return;
    const input = this.session.input;
    this._hintSrc = html;
    this.el.hint.innerHTML = html.replace(/\{(\w+)\}/g, (_, a) => promptHTML(input, a));
    this.el.hint.classList.remove('hidden');
    this.hintT = seconds;
  }

  setObjective(text) { this.el.objective.textContent = text || ''; }

  hitMarker() {
    const h = this.el.hitmarker;
    h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
    this.el.cross.classList.add('hit');
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => this.el.cross.classList.remove('hit'), 120);
  }

  /** Splash enemy ink onto the screen edges. */
  damageFlash(amount, dir) {
    const ctx = this.inkCtx, W = this.el.ink.width, H = this.el.ink.height;
    const color = this.session.ink.color(this.session.player.enemyTeam);
    const css = `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
    const n = 2 + Math.round(amount * 5);
    for (let i = 0; i < n; i++) {
      const side = Math.floor(Math.random() * 4);
      const x = side === 0 ? Math.random() * W * 0.18 : side === 1 ? W - Math.random() * W * 0.18 : Math.random() * W;
      const y = side === 2 ? Math.random() * H * 0.2 : side === 3 ? H - Math.random() * H * 0.2 : Math.random() * H;
      blob(ctx, x, y, (30 + Math.random() * 70) * (0.6 + amount), css);
    }
    void dir;
    this.inkAlpha = 1;
    this._inkDirty = true;
  }

  clearScreenInk() {
    this.inkCtx.clearRect(0, 0, this.el.ink.width, this.el.ink.height);
    this.inkAlpha = 0;
  }

  bossBar(name, frac) {
    if (name == null) { this.el.boss.classList.add('hidden'); return; }
    this.el.boss.classList.remove('hidden');
    this.el.bossName.textContent = name;
    this.el.bossFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }

  /** Turf Clash scoreboard: time left (s) and team rosters [{alive, color}] */
  turf(timeLeft, teamA, teamB) {
    if (timeLeft == null) { this.el.turf.classList.add('hidden'); return; }
    this.el.turf.classList.remove('hidden');
    const m = Math.floor(Math.max(0, timeLeft) / 60), s = Math.floor(Math.max(0, timeLeft) % 60);
    this.el.turfTimer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    const draw = (el, team) => {
      if (el.childElementCount !== team.length) el.innerHTML = team.map(() => '<div class="squid"></div>').join('');
      team.forEach((t, i) => { const d = el.children[i]; d.style.background = t.color; d.classList.toggle('down', !t.alive); });
    };
    draw(this.el.turfA, teamA);
    draw(this.el.turfB, teamB);
  }

  update(dt) {
    const S = this.session, p = S.player;
    if (!p) return;
    const input = S.input;
    if (input && input.lastDevice !== this._lastDevice) { this.refreshKit(); if (this.hintT > 0 && this._hintSrc) this.hint(this._hintSrc, this.hintT); }
    // team colours → CSS tokens, only when they change (no per-frame string churn / style recalc)
    const color = S.ink.color(p.team), enemy = S.ink.color(p.enemyTeam);
    const key = color.getHex() * 16777216 + enemy.getHex();
    if (key !== this._colorKey) {
      this._colorKey = key;
      this._css = `#${color.getHexString()}`;
      this.root.style.setProperty('--ink-hero', this._css);
      document.documentElement.style.setProperty('--ink-hero', this._css);
      document.documentElement.style.setProperty('--ink-murk', `#${enemy.getHexString()}`);
    }
    const css = this._css;

    // ink tank: shown while firing, low or swimming (DOM writes only when a value changes)
    const W = this._w || (this._w = {});
    const set = (k, v, fn) => { if (W[k] !== v) { W[k] = v; fn(v); } };
    const frac = p.ink / p.inkMax;
    set('tank', Math.round(frac * 200), (v) => { this.el.tankFill.style.height = `${v / 2}%`; });
    set('tankShow', p.alive && (p.kit.main.firing || frac < 0.99 || p.form === 'squid'), (v) => this.el.tank.classList.toggle('show', v));
    set('low', p.lowInkT > 0 && p.alive, (v) => this.el.lowink.classList.toggle('show', v));
    set('crossHidden', !p.alive || p.form === 'squid' || p.frozen, (v) => this.el.cross.classList.toggle('hidden', v));
    const ch = p.kit.main.charge;
    set('charging', ch > 0, (v) => this.el.cross.classList.toggle('charging', v));
    set('chargeScale', Math.round(ch * 50), (v) => { (this._ring || (this._ring = this.el.cross.querySelector('.ring'))).style.transform = v > 0 ? `scale(${1.3 - (v / 50) * 0.35})` : ''; });

    // special gauge
    const sp = p.special;
    set('arcColor', css, (v) => this.el.arc.setAttribute('stroke', v));
    set('arc', Math.round(sp * 4), (v) => this.el.arc.setAttribute('stroke-dashoffset', String(314.16 * (1 - v / 400))));
    set('spText', sp >= 100 ? 'READY' : `${Math.floor(sp)}%`, (v) => { this.el.specialPct.textContent = v; });
    set('spReady', sp >= 100, (v) => { this.el.special.classList.toggle('ready', v); this.el.spSlot.classList.toggle('blocked', !v); });
    set('subBlocked', !!p.kit.sub && p.ink < p.kit.sub.cost, (v) => this.el.subSlot.classList.toggle('blocked', v));
    set('pearls', S.pearls ?? 0, (v) => { this.el.pearls.textContent = String(v); });

    // screen ink fades as health regenerates
    const hpFrac = p.alive ? p.hp / p.maxHp : 1;
    const target = p.alive ? Math.min(1, (1 - hpFrac) * 1.4) : 0;
    this.inkAlpha += (target - this.inkAlpha) * Math.min(1, dt * 3);
    set('inkAlpha', Math.round(this.inkAlpha * 100), (v) => { this.el.ink.style.opacity = String(v / 100); });
    if (this.inkAlpha < 0.02 && hpFrac >= 1 && this._inkDirty !== false) { this.clearScreenInk(); this._inkDirty = false; }

    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.el.hint.classList.add('hidden'); }

    if (settings.get('video.showFps')) {
      this._fpsAcc += dt; this._fpsN++;
      if (this._fpsAcc > 0.5) { this.el.fps.textContent = `${Math.round(this._fpsN / this._fpsAcc)} fps`; this._fpsAcc = 0; this._fpsN = 0; }
    } else this.el.fps.textContent = '';
  }

  dispose() {
    removeEventListener('resize', this._onResize);
    this.root.remove();
  }
}

function blob(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.7 + Math.random() * 0.45);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(x + Math.cos(a - 0.2) * rr * 1.15, y + Math.sin(a - 0.2) * rr * 1.15, px, py);
  }
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (1.1 + Math.random() * 0.9);
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.06 + Math.random() * 0.14), 0, 7); ctx.fill();
  }
  // drip
  ctx.fillRect(x - r * 0.08, y, r * 0.16, r * (0.6 + Math.random() * 0.9));
}

function subIcon(id) {
  const c = 'var(--ink-hero)';
  switch (id) {
    case 'splash-bomb': return `<circle cx="22" cy="25" r="13" fill="${c}"/><rect x="18" y="7" width="8" height="7" rx="2" fill="#fff"/>`;
    case 'burst-bomb': return `<circle cx="22" cy="24" r="10" fill="${c}"/><path d="M22 6 L25 13 L19 13Z" fill="#fff"/>`;
    case 'sprinkler': return `<rect x="12" y="20" width="20" height="14" rx="4" fill="${c}"/><path d="M22 20 V10 M14 12 L22 10 L30 12" stroke="#fff" stroke-width="3" fill="none"/>`;
    case 'ink-mine': return `<ellipse cx="22" cy="28" rx="15" ry="7" fill="${c}"/><circle cx="22" cy="24" r="4" fill="#fff"/>`;
    default: return `<circle cx="22" cy="22" r="12" fill="${c}"/>`;
  }
}
function specialIcon(id) {
  const c = 'var(--ink-hero)';
  switch (id) {
    case 'tidal-slam': return `<path d="M22 4 L30 18 H25 V30 H19 V18 H14Z" fill="${c}"/><path d="M6 38 Q22 28 38 38" stroke="#fff" stroke-width="4" fill="none"/>`;
    case 'ink-storm': return `<ellipse cx="22" cy="16" rx="15" ry="9" fill="${c}"/><path d="M12 28 l-2 8 M22 28 l-2 8 M32 28 l-2 8" stroke="#fff" stroke-width="3"/>`;
    case 'missile-barrage': return `<path d="M10 34 L22 8 L34 34 L22 28Z" fill="${c}"/><circle cx="22" cy="20" r="3" fill="#fff"/>`;
    case 'ink-jet': return `<rect x="14" y="8" width="16" height="22" rx="6" fill="${c}"/><path d="M17 30 L15 40 M27 30 L29 40" stroke="#fff" stroke-width="4"/>`;
    default: return `<circle cx="22" cy="22" r="12" fill="${c}"/>`;
  }
}

void SVGNS;
