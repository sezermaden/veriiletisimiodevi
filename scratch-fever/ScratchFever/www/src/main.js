/* =========================================================
   Scratch Fever — entry point and game state machine.

   States: title → menu → playing ⇄ paused (any screen open).
   Everything the tests need hangs off window.__game.
   ========================================================= */
import { Input } from './engine/input.js';
import { View } from './engine/view.js';
import { Sound } from './engine/audio.js';
import { FX } from './engine/fx.js';
import { Economy, newState, SAVE_KEY, TICKETS, SYMBOLS } from './game/economy.js';
import { TicketScene } from './game/ticket3d.js';
import { UI, el, prompt, applyPrompts, VERSION } from './ui/ui.js';
import { money, fmt } from './game/format.js';

/* ---------------------------------------------------------
   Host detection. The UWP shell injects window.GAME_HOST before
   any page script runs; on Xbox body.tv switches to the 10-foot
   layout (TV-safe insets, bigger text, no cursor).
   --------------------------------------------------------- */
const host = window.GAME_HOST || {};
export const IS_XBOX = host.deviceFamily === 'Windows.Xbox';
export const IN_SHELL = host.shell === 'uwp';
if (IS_XBOX) document.body.classList.add('tv');
export const CAN_QUIT = IN_SHELL && !IS_XBOX;

const SETTINGS_KEY = 'scratchfever.settings.v1';
const DEFAULT_SETTINGS = {
  master: 0.8, music: 0.4, sfx: 0.85,
  renderScale: 1, bloom: true, shake: true, flashes: true,
  cursorSpeed: 1, rumble: true,
};

const boot = document.getElementById('boot');
const bootFill = document.getElementById('boot-fill');
const bootStatus = document.getElementById('boot-status');
const progress = (pct, text) => {
  if (bootFill) bootFill.style.width = pct + '%';
  if (bootStatus && text) bootStatus.textContent = text;
};

class Game {
  constructor() {
    this.canvas = document.getElementById('viewport');
    this.view = new View(this.canvas);
    this.input = Input;
    this.input.attach(window);
    this.fx = new FX(this.view.scene);
    this.fx.numbers.enabled = true;
    this.scene = new TicketScene(this.view, this.fx);
    this.ui = new UI(this);
    this.focus = this.ui.focus;
    this.isXbox = IS_XBOX;
    this.inShell = IN_SHELL;
    this.canQuit = CAN_QUIT;

    this.state = 'boot';
    this.frames = 0;
    this._last = performance.now();
    this._saveTimer = 0;
    this._musicWanted = null;

    this.settings = this.loadSettings();
    this.eco = new Economy(newState());

    // play-state
    this.cursor = { u: 0.5, v: 0.5 };
    this.cursorVisible = false;
    this.scratching = false;
    this.current = null;          // { ticket, cells, price }
    this.lastResult = null;
    this.phase = 'idle';          // idle | scratching | settled | between
    this.phaseT = 0;
    this.botActive = false;
    this.streak = 0;
    this.pendingPrompt = '';

    this.hud = document.getElementById('hud');
    this.hudEls = {
      cash: document.getElementById('hud-cash'),
      jp: document.getElementById('hud-jp'),
      ticket: document.getElementById('hud-ticket'),
      price: document.getElementById('hud-price'),
      pool: document.getElementById('hud-pool'),
      bot: document.getElementById('hud-bot'),
      lastwin: document.getElementById('hud-lastwin'),
      banner: document.getElementById('win-banner'),
      prompts: document.getElementById('hud-prompts'),
      toast: document.getElementById('toast-host'),
      flash: document.getElementById('win-flash'),
      streak: document.getElementById('hud-streak'),
    };

    this.input.onDeviceChange = (d) => this.ui.setDevice(d);
    this.input.onPadConnect = () => this.toast('Controller connected', 'good');
    addEventListener('resize', () => this.view.resize());
    addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });

    this.scene.onCellRevealed = (cells, byBot) => this.onCellsRevealed(cells, byBot);
    this.scene.onAllRevealed = (byBot) => this.onTicketDone(byBot);
  }

  /* ---------------- boot ---------------- */
  async init() {
    progress(20, 'Polishing the counter…');
    this.applySettings();
    await new Promise((r) => setTimeout(r, 30));
    progress(55, 'Printing tickets…');
    Sound.init();
    await new Promise((r) => setTimeout(r, 30));
    progress(85, 'Warming up the foil…');
    this.ui.setDevice(this.input.lastDevice);
    this.state = 'title';
    this.ui.replace('title');
    progress(100, 'Ready');
    boot?.classList.add('fade-out');
    setTimeout(() => boot?.classList.add('hidden'), 500);
    requestAnimationFrame(this.tick);
  }

  /* ---------------- settings ---------------- */
  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* storage unavailable */ }
    return { ...DEFAULT_SETTINGS };
  }
  applySettings() {
    const S = this.settings;
    Sound.setVolume('master', S.master);
    Sound.setVolume('music', S.music);
    Sound.setVolume('sfx', S.sfx);
    this.view.setRenderScale(S.renderScale);
    this.view.setBloom(S.bloom);
    this.fx.shakeEnabled = S.shake;
    this.scene.flakesEnabled = true;
    this.input.rumbleEnabled = S.rumble;
    document.body.classList.toggle('no-flash', !S.flashes);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch { /* ignore */ }
  }
  toggleFullscreen() {
    if (IN_SHELL && window.chrome?.webview) window.chrome.webview.postMessage('fullscreen');
    else if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  quit() {
    this.save();
    if (IN_SHELL && window.chrome?.webview) window.chrome.webview.postMessage('quit');
  }

  /* ---------------- save ---------------- */
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  peekSave() { try { return Economy.deserialize(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
  save() {
    if (this.state === 'title' || this.state === 'menu' && !this._playedThisSession) return;
    try { localStorage.setItem(SAVE_KEY, this.eco.serialize()); } catch { /* ignore */ }
  }
  eraseSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.eco = new Economy(newState());
    this._playedThisSession = false;
    this.toast('Save erased', 'bad');
    if (this.state !== 'menu') this.toMenu(true);
    else this.ui.replace('menu');
  }

  /* ---------------- flow ---------------- */
  toMenu(silent = false) {
    this.state = 'menu';
    this.scene.discardNow();
    this.current = null;
    this.phase = 'idle';
    this.hud.classList.add('hidden');
    this.ui.replace('menu');
    this.music('menu');
    if (!silent) Sound.play('ui_confirm');
  }
  toMenuFromGame() {
    this.save();
    this.toMenu();
  }
  newGame() {
    this.eco = new Economy(newState());
    this._playedThisSession = true;
    this.startPlay();
    this.save();
    this.toast('Welcome to the kiosk. Scratch the Lucky Penny!', 'good');
  }
  continueGame() {
    const s = this.peekSave();
    this.eco = new Economy(s || newState());
    this._playedThisSession = true;
    const away = (Date.now() - (this.eco.s.lastSave || Date.now())) / 1000;
    const off = this.eco.offlineEarnings(away);
    this.startPlay();
    if (off.amount > 0) {
      this.ui.open('offline', { ...off, onYes: () => { this.eco.applyOffline(off); this.ui.close(); this.resume(); this.refreshHud(); } });
      this.state = 'paused';
    }
  }
  startPlay() {
    this.state = 'playing';
    this.ui.closeAll();
    this.hud.classList.remove('hidden');
    this.streak = 0;
    this.lastResult = null;
    this.phase = 'between';
    this.phaseT = 0.2;
    this.cursor.u = 0.5; this.cursor.v = 0.5;
    this.music('play');
    Sound.play('start');
    this.refreshHud();
    this.ui.setDevice(this.input.lastDevice);
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.scene.endStroke();
    this.scratching = false;
    Sound.setDuck(0.35);
    this.ui.open('pause');
    this.save();
  }
  openScreen(name, params) {
    if (this.state === 'playing') { this.state = 'paused'; this.scene.endStroke(); this.scratching = false; Sound.setDuck(0.35); }
    this.ui.open(name, params);
  }
  resume() {
    this.ui.closeAll();
    this.state = 'playing';
    Sound.setDuck(1);
    this.refreshHud();
  }
  doPrestige() {
    const gain = this.eco.prestige();
    Sound.play('prestige');
    this.fx.addShake(0.6);
    this.scene.discardNow();
    this.current = null;
    this.phase = 'between'; this.phaseT = 0.6;
    this.toast(`PRESTIGE! +${gain} Jack Point${gain > 1 ? 's' : ''}`, 'good');
    this.save();
    this.refreshHud();
  }
  onUpgradeBought(id) {
    if (id === 'bot') { Sound.play('bot_on'); this.toast('Scratch Bot is online', 'good'); }
    if (id === 'brush') this.scene.brushRadius = 0.08 + this.eco.brush * 0.012;
    this.refreshHud();
  }

  music(track) {
    this._musicWanted = track;
    Sound.startMusic(track);
  }

  /* ---------------- tickets ---------------- */
  buyNext() {
    const eco = this.eco;
    let t = eco.ticket();
    if (!eco.canAfford(t)) {
      // fall back to the richest ticket the player can afford; penny is always playable
      const affordable = TICKETS.filter((x) => eco.isUnlocked(x.id) && eco.canAfford(x));
      const pick = affordable.length ? affordable[affordable.length - 1] : TICKETS[0];
      if (pick.id !== t.id) { this.toast(`Not enough cash for ${t.name} — playing ${pick.name}`, 'bad'); eco.select(pick.id); t = pick; }
    }
    const b = eco.buyTicket(t.id);
    if (!b) return false;
    this.current = b;
    this.scene.brushRadius = 0.08 + eco.brush * 0.012;
    this.scene.newTicket(b.ticket, b.cells, { price: b.price });
    this.phase = 'scratching';
    this.lastResult = null;
    Sound.play('ticket_in');
    this.refreshHud();
    return true;
  }

  onCellsRevealed(cells, byBot) {
    this.eco.s.stats.cellsScratched += cells.length;
    for (const i of cells) {
      const id = this.current.cells[i];
      const sym = SYMBOLS[id];
      Sound.play(sym.special ? 'coin' : 'reveal', { rate: 0.9 + Math.random() * 0.25 });
      if (sym.special && this.settings.flashes) {
        const r = this.scene.cellRects[i];
        const p = this.scene.uvToWorld((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
        this.fx.flashes.spawn(p.x, p.y + 0.1, p.z, { color: sym.special === 'jackpot' ? 0xff4fd8 : 0xffe28a, size: 0.8, grow: 2, dur: 0.18 });
      }
    }
    if (!byBot) this.input.rumble(0.08, 0.2, 40);
  }

  onTicketDone(byBot) {
    const c = this.current;
    if (!c) return;
    const r = this.eco.settle(c.ticket, c.cells, c.price, byBot);
    this.lastResult = r;
    this.phase = 'settled';
    this.phaseT = 0;
    this.scene.highlight(r);
    if (r.payout > 0) {
      this.streak++;
      const big = r.payout >= c.price * 8;
      const pos = this.scene.uvToWorld(0.5, 0.55);
      this.fx.numbers.spawn(pos.x, pos.y + 0.6, pos.z, '+' + money(r.payout), big ? 'crit' : 'normal', big ? 0.9 : 0.7);
      if (r.jackpotHit) { Sound.play('jackpot'); this.fx.addShake(1.2); this.input.rumble(1, 1, 600); this.banner('JACKPOT!', money(r.payout), 'jackpot'); }
      else if (big) { Sound.play('win_big'); this.fx.addShake(0.5); this.input.rumble(0.7, 0.5, 300); this.banner('BIG WIN', money(r.payout), 'big'); }
      else { Sound.play('win_small'); this.input.rumble(0.3, 0.3, 120); this.banner('WIN', money(r.payout), 'small'); }
      if (this.settings.flashes && (big || r.jackpotHit)) this.flash(r.jackpotHit ? 'jackpot' : 'big');
      if (r.golden) this.toast('GOLDEN TOUCH — payout doubled!', 'good');
      if (r.mult > 1) this.toast(`×${r.mult} multiplier!`, 'good');
    } else {
      this.streak = 0;
      Sound.play('lose');
    }
    this.scratching = false;
    this.scene.endStroke();
    this._saveTimer = 0;
    this.refreshHud();
  }

  /* ---------------- HUD ---------------- */
  refreshHud() {
    const e = this.hudEls, eco = this.eco, s = eco.s;
    e.cash.textContent = money(s.cash);
    e.jp.textContent = s.jp > 0 ? `${fmt(s.jp)} JP · ×${eco.payoutMult.toFixed(2)}` : `×${eco.payoutMult.toFixed(2)} payouts`;
    const t = eco.ticket();
    e.ticket.textContent = t.name;
    e.price.textContent = money(eco.price(t)) + ' · ' + t.cols + '×' + t.rows + ' · match ' + t.match;
    e.pool.textContent = t.jackpot ? 'Jackpot ' + money(s.jackpotPool + eco.price(t) * 120) : '';
    e.pool.classList.toggle('hidden', !t.jackpot);
    e.bot.textContent = eco.hasBot ? `BOT ${eco.botRate.toFixed(1)} cells/s` + (eco.hasAutoBuy ? ' · auto-buy' : '') : '';
    e.bot.classList.toggle('hidden', !eco.hasBot);
    e.lastwin.textContent = this.lastResult ? (this.lastResult.payout > 0 ? 'Last: +' + money(this.lastResult.payout) : 'Last: no win') : '';
    e.streak.textContent = this.streak >= 3 ? `${this.streak} win streak` : '';
    this.renderPrompts();
  }
  renderPrompts() {
    const eco = this.eco;
    const list = [];
    if (this.phase === 'scratching') {
      list.push(['scratch', 'Scratch'], ['move', 'Move']);
      if (eco.hasQuick) list.push(['reveal', 'Reveal all']);
    } else if (this.phase === 'settled' || this.phase === 'between' || this.phase === 'idle') {
      list.push(['confirm', eco.hasAutoBuy ? 'Next' : `Buy ${eco.ticket().name} (${money(eco.price())})`]);
      list.push(['tabL', 'Prev'], ['tabR', 'Next ticket']);
    }
    list.push(['shop', 'Shop'], ['pause', 'Pause']);
    const key = list.map((x) => x.join(':')).join('|');
    if (key === this._promptKey) return;
    this._promptKey = key;
    const host = this.hudEls.prompts;
    host.innerHTML = '';
    for (const [a, l] of list) host.append(prompt(a, l));
    applyPrompts(host, this.ui.device);
  }
  banner(title, amount, kind) {
    const b = this.hudEls.banner;
    b.className = 'win-banner show ' + kind;
    b.innerHTML = '';
    b.append(el('div', 'win-title', title), el('div', 'win-amount', amount));
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.remove('show'), kind === 'jackpot' ? 2600 : 1500);
  }
  flash(kind) {
    const f = this.hudEls.flash;
    f.className = 'win-flash ' + kind;
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { f.className = 'win-flash'; }, 420);
  }
  toast(text, kind = '') {
    const t = el('div', 'toast ' + kind, text);
    this.hudEls.toast.append(t);
    setTimeout(() => t.classList.add('leaving'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  /* ---------------- per-frame ---------------- */
  updatePlaying(dt) {
    const I = this.input, eco = this.eco, sc = this.scene;
    this.eco.s.stats.playTime += dt;

    // ---- global play actions
    if (I.pressed('pause') || I.pressed('cancel')) { this.pause(); return; }
    if (I.pressed('shop')) { this.openScreen('shop'); return; }
    if (I.pressed('stats')) { this.openScreen('stats'); return; }
    if (I.pressed('mute')) { Sound.enabled = !Sound.enabled; if (!Sound.enabled) Sound.stopMusic(); else this.music(this._musicWanted || 'play'); this.toast(Sound.enabled ? 'Sound on' : 'Sound off'); }

    // ---- ticket switching between cards
    if (this.phase !== 'scratching') {
      const dir = I.pressed('tabR') ? 1 : I.pressed('tabL') ? -1 : 0;
      if (dir) {
        const list = TICKETS.filter((t) => eco.isUnlocked(t.id));
        const i = list.findIndex((t) => t.id === eco.s.selected);
        const n = list[(i + dir + list.length) % list.length];
        if (n && n.id !== eco.s.selected) { eco.select(n.id); Sound.play('ui_move'); this.refreshHud(); }
        else Sound.play('error');
      }
    }

    // ---- phases
    if (this.phase === 'settled') {
      this.phaseT += dt;
      const wait = this.lastResult && this.lastResult.jackpotHit ? 2.4 : this.lastResult && this.lastResult.payout > 0 ? 1.1 : 0.55;
      const skip = I.pressed('confirm') || I.pressed('scratch') || (I.mouse.down && I.lastDevice === 'mouse' && this.phaseT > 0.3);
      if (this.phaseT >= wait || skip) {
        sc.discard();
        this.phase = 'between';
        this.phaseT = 0;
        Sound.play('ticket_out');
        this.refreshHud();
      }
    } else if (this.phase === 'between') {
      this.phaseT += dt;
      const auto = eco.hasAutoBuy && eco.hasBot ? this.phaseT > 0.45 : false;
      const press = I.pressed('confirm') || I.pressed('scratch') || (I.mouse.down && I.lastDevice === 'mouse' && this.phaseT > 0.35 && !this._mouseWasDown);
      if ((auto || press || (eco.hasAutoBuy && this.phaseT > 0.45)) && this.phaseT > 0.3 && !sc.card) {
        if (!this.buyNext()) Sound.play('error');
      }
    } else if (this.phase === 'scratching' && sc.card) {
      // ---- cursor
      const S = this.settings;
      let pressing = false;
      const padMag = Math.hypot(I.stick.x, I.stick.y);
      const keyMag = Math.hypot(I.move.x, I.move.y);
      if (I.lastDevice === 'mouse' && I.mouse.inside) {
        if (I.mouse.moved || I.mouse.down) {
          const uv = sc.screenToUVClamped(I.mouse.x, I.mouse.y);
          if (uv) { this.cursor.u = uv.u; this.cursor.v = uv.v; }
          I.mouse.moved = false;
        }
        pressing = I.mouse.down;
        this.cursorVisible = true;
      } else {
        const mag = padMag > 0 ? padMag : keyMag;
        const vx = padMag > 0 ? I.stick.x : I.move.x;
        const vy = padMag > 0 ? I.stick.y : I.move.y;
        if (mag > 0) {
          const speed = 0.75 * S.cursorSpeed * (0.35 + 0.65 * mag);
          this.cursor.u = Math.max(0, Math.min(1, this.cursor.u + vx * speed * dt));
          this.cursor.v = Math.max(0, Math.min(1, this.cursor.v - vy * speed * dt * (sc.w / sc.h)));
        }
        pressing = I.held('scratch') || I.held('confirm');
        this.cursorVisible = true;
      }
      if (sc.ready) {
        if (pressing) {
          if (!this.scratching) { this.scratching = true; Sound.play('scratch_start'); }
          const before = sc.revealedCount;
          sc.scratchAt(this.cursor.u, this.cursor.v, sc.brushRadius, false);
          const moved = Math.hypot(this.cursor.u - this._lastCU, this.cursor.v - this._lastCV);
          if (moved > 0.004) { Sound.play('scratch', { gain: 0.6 + Math.min(1, moved * 30) }); if (I.lastDevice === 'gamepad' && this.settings.rumble) I.rumble(0.05, 0.12, 30); }
          this._lastCU = this.cursor.u; this._lastCV = this.cursor.v;
          if (sc.revealedCount > before) { /* reveal sound handled in callback */ }
        } else if (this.scratching) {
          this.scratching = false;
          sc.endStroke();
        }
        if (I.pressed('reveal')) {
          if (eco.hasQuick) { if (sc.revealAll()) Sound.play('reveal_all'); }
          else { Sound.play('error'); this.toast('Quick Reveal is sold in the shop', 'bad'); }
        }
      }
      sc.setCursor(this.cursor.u, this.cursor.v, this.cursorVisible && sc.ready, pressing && sc.ready);
      // camera drift toward the brush
      this.view.updateCamera(dt, (this.cursor.u - 0.5) * 0.6, (0.5 - this.cursor.v) * 0.4, this.fx.shake);
    }
    if (this.phase !== 'scratching') {
      sc.setCursor(0.5, 0.5, false, false);
      this.view.updateCamera(dt, 0, 0, this.fx.shake);
    }

    // ---- bot
    this.botActive = this.scene.updateBot(dt, eco.botRate, eco.hasBot && this.phase === 'scratching');
    if (this.botActive && Math.random() < dt * 6) Sound.play('bot', { rate: 0.8 + Math.random() * 0.5 });

    this._mouseWasDown = I.mouse.down;

    // ---- autosave
    this._saveTimer += dt;
    if (this._saveTimer > 12) { this._saveTimer = 0; this.save(); }
    // keep cash live without rebuilding the whole HUD
    this.hudEls.cash.textContent = money(eco.s.cash);
  }

  updateMenus(dt) {
    const I = this.input;
    const f = this.focus;
    if (this.state === 'title') {
      if (I.anyKey() || I.pressed('confirm')) { Sound.init(); this.toMenu(); this.music('menu'); }
      this.view.updateCamera(dt, Math.sin(performance.now() * 0.0003) * 0.6, 0, 0);
      return;
    }
    if (I.pressed('up')) f.move('up');
    if (I.pressed('down')) f.move('down');
    if (I.pressed('left')) f.move('left');
    if (I.pressed('right')) f.move('right');
    if (I.pressed('confirm')) { if (f.activate()) Sound.play('ui_confirm'); }
    if (I.pressed('cancel') || I.pressed('pause')) {
      const name = this.ui.name;
      if (this.state === 'paused' && (name === 'pause' || this.ui.stack.length === 1 && name !== 'confirm' && name !== 'offline')) this.resume();
      else this.ui.back();
    }
    if (I.pressed('tabL')) this.ui.tab(-1);
    if (I.pressed('tabR')) this.ui.tab(1);
    if (this.state === 'paused' && I.pressed('shop') && this.ui.name === 'pause') { this.ui.close(); this.ui.open('shop'); }
    if (this.state === 'menu') this.view.updateCamera(dt, Math.sin(performance.now() * 0.0003) * 0.6, 0, 0);
    else this.view.updateCamera(dt, 0, 0, 0);
    // bot keeps hovering in the background while paused
    this.scene.updateBot(dt, 0, this.eco.hasBot && this.state === 'paused');
  }

  tick = (now) => {
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.input.update(dt);
    if (this.state === 'playing') this.updatePlaying(dt);
    else this.updateMenus(dt);
    this.scene.update(dt);
    this.fx.update(dt);
    this.view.render();
    this.frames++;
    requestAnimationFrame(this.tick);
  };
}

const game = new Game();
window.__game = game;
game.init().catch((err) => {
  console.error(err);
  document.getElementById('fatal')?.classList.remove('hidden');
  const pre = document.querySelector('#fatal pre');
  if (pre) pre.textContent = String(err && err.stack || err);
});

export { game, VERSION };
