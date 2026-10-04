/* =========================================================
   Screens. Every screen is DOM built from theme tokens, pushed
   onto a stack; only the top screen owns the focus root, the
   ones beneath stay visible but inert (dimmed by CSS).
   ========================================================= */
import { FocusManager, focusable } from '../engine/focus.js';
import { Sound } from '../engine/audio.js';
import { TICKETS, UPGRADES, PERKS, PRESTIGE_MIN, SYMBOLS, tiersOf, payFor } from '../game/economy.js';
import { money, fmt, fmtTime } from '../game/format.js';
import { drawSymbol } from '../game/symbols.js';
import { PROMPTS } from '../engine/input.js';

export const VERSION = '1.0.0';

export const el = (tag, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** A prompt chip: <kbd>A</kbd> Label — the glyph swaps with the device. */
export function prompt(action, label) {
  const p = el('span', 'prompt');
  const k = el('kbd', '', '');
  k.dataset.action = action;
  p.append(k, el('span', 'prompt-label', label));
  return p;
}

export function applyPrompts(root, device) {
  const table = device === 'gamepad' ? PROMPTS.gamepad : PROMPTS.keyboard;
  root.querySelectorAll('kbd[data-action]').forEach((k) => {
    const a = k.dataset.action;
    k.textContent = table[a] || a;
    k.classList.toggle('pad', device === 'gamepad');
  });
}

function symbolIcon(id, size = 40) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  drawSymbol(c.getContext('2d'), id, size, size, size * 1.7);
  c.className = 'sym-icon';
  c.style.width = c.style.height = size + 'px';
  return c;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.host = document.getElementById('screens');
    this.focus = new FocusManager();
    this.stack = [];
    this.device = 'keyboard';
    this.focus.onChange = () => { /* hook for sounds if needed */ };
  }

  get top() { return this.stack[this.stack.length - 1] || null; }
  get name() { return this.top ? this.top.name : null; }

  /** Builds and pushes a screen. */
  open(name, params = {}) {
    const builder = SCREENS[name];
    if (!builder) throw new Error('unknown screen ' + name);
    const screen = builder(this, params);
    screen.name = name;
    screen.root.classList.add('screen', 'screen-' + name);
    screen.root.dataset.screen = name;
    if (this.top) { this.top.root.classList.add('beneath'); this.top.lastFocus = this.focus.current; }
    this.host.appendChild(screen.root);
    this.stack.push(screen);
    this.host.classList.add('interactive');
    document.body.classList.add('screen-open');
    this.focus.setRoot(screen.root);
    applyPrompts(screen.root, this.device);
    if (screen.onOpen) screen.onOpen();
    return screen;
  }

  /** Pops the top screen. */
  close() {
    const s = this.stack.pop();
    if (!s) return;
    if (s.onClose) s.onClose();
    s.root.remove();
    if (this.top) {
      this.top.root.classList.remove('beneath');
      this.focus.setRoot(this.top.root);
      // coming back from a child screen lands on the item that opened it
      if (this.top.lastFocus && this.top.lastFocus.isConnected) this.focus.focus(this.top.lastFocus, true);
      if (this.top.onResume) this.top.onResume();
    } else {
      this.focus.clear();
      this.host.classList.remove('interactive');
      document.body.classList.remove('screen-open');
    }
  }

  closeAll() { while (this.stack.length) this.close(); }

  /** Replaces the whole stack with one screen. */
  replace(name, params) { this.closeAll(); return this.open(name, params); }

  back() {
    const s = this.top;
    if (!s) return false;
    if (s.onBack) { const handled = s.onBack(); if (handled === false) return false; Sound.play('ui_back'); return true; }
    Sound.play('ui_back');
    this.close();
    return true;
  }

  tab(dir) {
    const s = this.top;
    if (s && s.onTab) { s.onTab(dir); return true; }
    return false;
  }

  setDevice(d) {
    const dev = d === 'gamepad' ? 'gamepad' : 'keyboard';
    this.device = dev;
    document.body.classList.toggle('using-pad', dev === 'gamepad');
    for (const s of this.stack) applyPrompts(s.root, dev);
    applyPrompts(document.getElementById('hud'), dev);
  }

  refresh() { if (this.top && this.top.refresh) this.top.refresh(); }
}

/* ---------------------------------------------------------
   Building blocks
   --------------------------------------------------------- */
function frame(title, sub = '') {
  const root = el('div');
  const head = el('div', 'screen-head');
  head.append(el('div', 'screen-title', title));
  if (sub) head.append(el('div', 'screen-sub', sub));
  const body = el('div', 'screen-body');
  const foot = el('div', 'screen-foot');
  root.append(head, body, foot);
  return { root, head, body, foot };
}

function hints(foot, list) {
  const row = el('div', 'hint-row');
  for (const [a, l] of list) row.append(prompt(a, l));
  foot.append(row);
  return row;
}

function menuButton(label, onActivate, cls = '') {
  const b = focusable(el('button', 'btn menu-btn ' + cls), onActivate);
  b.type = 'button';
  const t = el('span', 'btn-label', label);
  b.append(t);
  return b;
}

/* ---------------------------------------------------------
   Screens
   --------------------------------------------------------- */
const SCREENS = {
  /* ---------- title ---------- */
  title(ui) {
    const root = el('div', 'title-root');
    const logo = el('div', 'logo');
    logo.innerHTML = '<span class="logo-word">SCRATCH</span><span class="logo-word accent">FEVER</span>';
    const tag = el('div', 'logo-tag', 'LUCK IS YOUR WEAPON');
    const press = el('div', 'press-start');
    press.append(prompt('confirm', 'PRESS TO START'));
    const ver = el('div', 'version', 'v' + VERSION);
    root.append(logo, tag, press, ver);
    const start = focusable(press, () => ui.game.toMenu());
    start.dataset.key = 'start';
    return { root, onBack: () => false };
  },

  /* ---------- main menu ---------- */
  menu(ui) {
    const g = ui.game;
    const root = el('div', 'menu-root');
    const side = el('div', 'menu-side');
    const logo = el('div', 'logo small');
    logo.innerHTML = '<span class="logo-word">SCRATCH</span><span class="logo-word accent">FEVER</span>';
    side.append(logo);
    const list = el('div', 'menu-list');
    const hasSave = g.hasSave();
    if (hasSave) {
      const c = menuButton('CONTINUE', () => g.continueGame(), 'primary');
      c.dataset.key = 'continue'; c.dataset.autofocus = '1';
      list.append(c);
    }
    const n = menuButton('NEW GAME', () => {
      if (hasSave) ui.open('confirm', { title: 'Start over?', text: 'Your current save, upgrades and Jack Points will be erased.', yes: 'ERASE & START', onYes: () => { ui.close(); g.newGame(); } });
      else g.newGame();
    }, hasSave ? '' : 'primary');
    n.dataset.key = 'new'; if (!hasSave) n.dataset.autofocus = '1';
    list.append(n);
    const o = menuButton('OPTIONS', () => ui.open('options')); o.dataset.key = 'options';
    const s = menuButton('STATS', () => ui.open('stats')); s.dataset.key = 'stats';
    const h = menuButton('HOW TO PLAY', () => ui.open('help')); h.dataset.key = 'help';
    const c = menuButton('CREDITS', () => ui.open('credits')); c.dataset.key = 'credits';
    list.append(o, s, h, c);
    if (g.canQuit) { const q = menuButton('QUIT', () => g.quit(), 'danger'); q.dataset.key = 'quit'; list.append(q); }
    side.append(list);
    const foot = el('div', 'menu-foot');
    hints(foot, [['confirm', 'Select'], ['move', 'Navigate']]);
    foot.append(el('div', 'version', 'v' + VERSION));
    side.append(foot);
    root.append(side);
    // save summary card on the right
    if (hasSave) {
      const sv = g.peekSave();
      if (sv) {
        const card = el('div', 'save-card');
        card.append(el('div', 'save-title', 'LAST SESSION'));
        const rows = [['Cash', money(sv.cash)], ['Jack Points', fmt(sv.jp)], ['Lifetime', money(sv.lifetimeEarned)], ['Tickets', fmt(sv.stats?.tickets || 0)], ['Played', fmtTime(sv.stats?.playTime || 0)]];
        for (const [k, v] of rows) { const r = el('div', 'save-row'); r.append(el('span', '', k), el('b', '', v)); card.append(r); }
        root.append(card);
      }
    }
    return { root, onBack: () => false };
  },

  /* ---------- pause ---------- */
  pause(ui) {
    const g = ui.game;
    const f = frame('PAUSED', 'The kiosk waits.');
    f.root.classList.add('dim');
    const list = el('div', 'menu-list center');
    const r = menuButton('RESUME', () => g.resume(), 'primary'); r.dataset.key = 'resume'; r.dataset.autofocus = '1';
    const sh = menuButton('SHOP', () => { ui.close(); ui.open('shop'); }); sh.dataset.key = 'shop';
    const o = menuButton('OPTIONS', () => ui.open('options')); o.dataset.key = 'options';
    const st = menuButton('STATS', () => ui.open('stats')); st.dataset.key = 'stats';
    const h = menuButton('HOW TO PLAY', () => ui.open('help')); h.dataset.key = 'help';
    const m = menuButton('SAVE & MAIN MENU', () => g.toMenuFromGame(), 'danger'); m.dataset.key = 'mainmenu';
    list.append(r, sh, o, st, h, m);
    f.body.append(list);
    hints(f.foot, [['confirm', 'Select'], ['cancel', 'Resume']]);
    return { root: f.root, onBack: () => { g.resume(); return true; } };
  },

  /* ---------- options ---------- */
  options(ui) {
    const g = ui.game;
    const f = frame('OPTIONS', 'Left / right to adjust.');
    f.root.classList.add('dim');
    const list = el('div', 'option-list');
    const S = g.settings;
    const rows = [];
    const row = (key, label, kind, opts) => {
      const r = focusable(el('div', 'option-row'), () => { if (kind === 'toggle' || kind === 'choice') step(1); else if (kind === 'action') opts.run(); }, (dir) => step(dir));
      r.dataset.key = key;
      const name = el('div', 'option-name', label);
      const val = el('div', 'option-value');
      r.append(name, val);
      const step = (dir) => {
        if (kind === 'slider') { S[key] = Math.round(Math.max(opts.min, Math.min(opts.max, S[key] + dir * opts.step)) * 100) / 100; }
        else if (kind === 'toggle') { S[key] = !S[key]; }
        else if (kind === 'choice') { const i = opts.values.indexOf(S[key]); S[key] = opts.values[(i + dir + opts.values.length) % opts.values.length]; }
        else return;
        Sound.play('ui_move');
        g.applySettings();
        render();
      };
      const render = () => {
        val.innerHTML = '';
        if (kind === 'slider') {
          const bar = el('div', 'slider');
          const fill = el('div', 'slider-fill');
          fill.style.width = ((S[key] - opts.min) / (opts.max - opts.min) * 100) + '%';
          bar.append(fill);
          val.append(bar, el('span', 'slider-num', opts.fmt ? opts.fmt(S[key]) : Math.round(S[key] * 100) + '%'));
        } else if (kind === 'toggle') {
          val.append(el('span', 'choice ' + (S[key] ? 'on' : 'off'), S[key] ? 'ON' : 'OFF'));
        } else if (kind === 'choice') {
          val.append(el('span', 'choice', opts.labels[opts.values.indexOf(S[key])]));
        } else if (kind === 'action') {
          val.append(el('span', 'choice', opts.label));
        }
      };
      render();
      rows.push(r);
      list.append(r);
      return r;
    };
    const sect = (t) => list.append(el('div', 'option-section', t));
    sect('AUDIO');
    row('master', 'Master volume', 'slider', { min: 0, max: 1, step: 0.1 });
    row('music', 'Music volume', 'slider', { min: 0, max: 1, step: 0.1 });
    row('sfx', 'Effects volume', 'slider', { min: 0, max: 1, step: 0.1 });
    sect('VIDEO');
    row('renderScale', 'Render scale', 'choice', { values: [0.5, 0.75, 1], labels: ['50%', '75%', '100%'] });
    row('bloom', 'Glow (bloom)', 'toggle');
    row('shake', 'Screen shake', 'toggle');
    row('flashes', 'Win flashes', 'toggle');
    if (g.inShell && !g.isXbox) row('fullscreen', 'Fullscreen', 'action', { label: 'Toggle', run: () => g.toggleFullscreen() });
    sect('CONTROLS');
    row('cursorSpeed', 'Brush speed (stick / keys)', 'slider', { min: 0.5, max: 2, step: 0.25, fmt: (v) => v.toFixed(2) + '×' });
    row('rumble', 'Controller rumble', 'toggle');
    sect('DATA');
    row('reset', 'Erase save data', 'action', { label: 'Erase…', run: () => ui.open('confirm', { title: 'Erase everything?', text: 'Save, upgrades, Jack Points and stats will be deleted. This cannot be undone.', yes: 'ERASE', onYes: () => { ui.close(); g.eraseSave(); ui.close(); } }) });
    rows[0].dataset.autofocus = '1';
    f.body.append(list);
    hints(f.foot, [['move', 'Adjust'], ['cancel', 'Back']]);
    return { root: f.root };
  },

  /* ---------- stats ---------- */
  stats(ui) {
    const g = ui.game;
    const f = frame('STATS', 'Numbers never lie. Tickets sometimes do.');
    f.root.classList.add('dim');
    const s = g.eco.s, st = s.stats;
    const grid = el('div', 'stat-grid');
    const rows = [
      ['Cash', money(s.cash)], ['Jack Points', fmt(s.jp)], ['Payout multiplier', '×' + g.eco.payoutMult.toFixed(2)],
      ['Lifetime earned', money(s.lifetimeEarned)], ['This run', money(s.runEarned)], ['Jackpot pool', money(s.jackpotPool)],
      ['Tickets scratched', fmt(st.tickets)], ['Winning tickets', fmt(st.wins)], ['Win rate', st.tickets ? Math.round(st.wins / st.tickets * 100) + '%' : '—'],
      ['Biggest win', money(st.biggestWin) + (st.bestTicket ? ' · ' + st.bestTicket : '')], ['Jackpots hit', fmt(st.jackpots)], ['Bot tickets', fmt(st.botTickets)],
      ['Cells scratched', fmt(st.cellsScratched)], ['Prestiges', fmt(st.prestiges)], ['Time played', fmtTime(st.playTime)],
    ];
    for (const [k, v] of rows) { const r = el('div', 'stat'); r.append(el('div', 'stat-k', k), el('div', 'stat-v', v)); grid.append(r); }
    f.body.append(grid);
    const back = menuButton('BACK', () => ui.back()); back.dataset.key = 'back'; back.dataset.autofocus = '1';
    f.foot.append(back);
    hints(f.foot, [['cancel', 'Back']]);
    return { root: f.root };
  },

  /* ---------- help ---------- */
  help(ui) {
    const f = frame('HOW TO PLAY', 'Scratch, win, upgrade, prestige.');
    f.root.classList.add('dim');
    const box = el('div', 'help-box');
    const items = [
      ['Scratch', 'Move the coin over the foil and hold to scratch. Mouse drag works too. Reveal every cell to settle the ticket.'],
      ['Match', 'A ticket pays when enough copies of one symbol turn up — the MATCH number is printed on the card. One extra copy pays ×2.5.'],
      ['Specials', 'WILD joins your best line. ×2–×10 cells multiply the whole ticket. BONUS pays on its own. Three JACKPOT symbols take the pool.'],
      ['Shop', 'Spend cash on better tickets and upgrades. Quick Reveal clears a card with one press; Scratch Bot does the work for you.'],
      ['Prestige', 'Once a run has earned $20K you can cash it in for Jack Points: +10% payouts each, forever, plus perks.'],
    ];
    for (const [k, v] of items) { const r = el('div', 'help-row'); r.append(el('b', '', k), el('span', '', v)); box.append(r); }
    const ctl = el('div', 'help-controls');
    const pairs = [['move', 'Move brush'], ['scratch', 'Scratch'], ['reveal', 'Quick reveal'], ['shop', 'Shop'], ['tabL', 'Prev ticket'], ['tabR', 'Next ticket'], ['stats', 'Stats'], ['pause', 'Pause']];
    for (const [a, l] of pairs) ctl.append(prompt(a, l));
    box.append(ctl);
    f.body.append(box);
    const back = menuButton('BACK', () => ui.back()); back.dataset.key = 'back'; back.dataset.autofocus = '1';
    f.foot.append(back);
    hints(f.foot, [['cancel', 'Back']]);
    return { root: f.root };
  },

  /* ---------- credits ---------- */
  credits(ui) {
    const f = frame('CREDITS', '');
    f.root.classList.add('dim');
    const box = el('div', 'help-box credits-box');
    const lines = [
      ['Scratch Fever', 'A scratch-card incremental for PC and Xbox.'],
      ['Design & code', 'Sezer Maden, with Claude Code'],
      ['Engine', 'three.js r169 (MIT) · Web Audio · WebView2'],
      ['Art', 'Every symbol, texture, model and sound is generated in code. No asset packs.'],
      ['Inspired by', 'The scratch-card incremental genre.'],
    ];
    for (const [k, v] of lines) { const r = el('div', 'help-row'); r.append(el('b', '', k), el('span', '', v)); box.append(r); }
    f.body.append(box);
    const back = menuButton('BACK', () => ui.back()); back.dataset.key = 'back'; back.dataset.autofocus = '1';
    f.foot.append(back);
    hints(f.foot, [['cancel', 'Back']]);
    return { root: f.root };
  },

  /* ---------- confirm ---------- */
  confirm(ui, p) {
    const root = el('div', 'confirm-root dim');
    const box = el('div', 'confirm-box');
    box.append(el('div', 'confirm-title', p.title || 'Are you sure?'), el('div', 'confirm-text', p.text || ''));
    const row = el('div', 'confirm-row');
    const no = menuButton(p.no || 'CANCEL', () => ui.back()); no.dataset.key = 'no'; no.dataset.autofocus = '1';
    const yes = menuButton(p.yes || 'YES', () => { Sound.play('ui_confirm'); p.onYes(); }, p.danger === false ? 'primary' : 'danger'); yes.dataset.key = 'yes';
    row.append(no, yes);
    box.append(row);
    root.append(box);
    return { root };
  },

  /* ---------- welcome back ---------- */
  offline(ui, p) {
    const root = el('div', 'confirm-root dim');
    const box = el('div', 'confirm-box');
    box.append(el('div', 'confirm-title', 'WELCOME BACK'));
    box.append(el('div', 'confirm-text', `Scratch Bot kept working for ${fmtTime(p.seconds)} and scratched ${fmt(p.tickets)} tickets.`));
    box.append(el('div', 'offline-amount', '+' + money(p.amount)));
    const row = el('div', 'confirm-row');
    const ok = menuButton('COLLECT', () => { Sound.play('coin'); p.onYes(); }, 'primary'); ok.dataset.key = 'collect'; ok.dataset.autofocus = '1';
    row.append(ok);
    box.append(row);
    root.append(box);
    return { root, onBack: () => { p.onYes(); return true; } };
  },

  /* ---------- shop ---------- */
  shop(ui, p) {
    const g = ui.game;
    const eco = g.eco;
    const f = frame('SHOP', '');
    f.root.classList.add('dim');
    const tabs = ['tickets', 'upgrades', 'prestige'];
    let tab = p.tab || 'tickets';
    const tabBar = el('div', 'tab-bar');
    const tabEls = {};
    for (const t of tabs) {
      const b = focusable(el('button', 'tab'), () => setTab(t));
      b.type = 'button'; b.dataset.key = 'tab-' + t;
      b.textContent = t.toUpperCase();
      tabEls[t] = b;
      tabBar.append(b);
    }
    const tl = prompt('tabL', ''), tr = prompt('tabR', '');
    tabBar.prepend(tl); tabBar.append(tr);
    f.head.append(tabBar);
    const wallet = el('div', 'wallet');
    f.head.append(wallet);
    const list = el('div', 'shop-list');
    const detail = el('div', 'shop-detail');
    f.body.append(list, detail);
    hints(f.foot, [['confirm', 'Buy / Select'], ['tabL', 'Prev tab'], ['tabR', 'Next tab'], ['cancel', 'Close']]);

    const renderWallet = () => {
      wallet.innerHTML = '';
      wallet.append(el('span', 'wallet-cash', money(eco.s.cash)));
      wallet.append(el('span', 'wallet-jp', fmt(eco.s.jp) + ' JP'));
    };

    const rowsById = new Map();
    const makeRow = (key) => {
      const r = focusable(el('div', 'shop-row'), () => activate(key));
      r.dataset.key = key;
      r.addEventListener('focus-hover', () => showDetail(key));
      rowsById.set(key, r);
      return r;
    };

    const renderTicketRow = (r, t) => {
      r.innerHTML = '';
      const unlocked = eco.isUnlocked(t.id);
      const selected = eco.s.selected === t.id;
      r.classList.toggle('locked', !unlocked);
      r.classList.toggle('selected', selected);
      const sw = el('div', 'swatch');
      sw.style.background = `linear-gradient(135deg, ${t.theme.a}, ${t.theme.b})`;
      sw.append(el('span', '', `${t.cols}×${t.rows}`));
      const txt = el('div', 'row-text');
      txt.append(el('div', 'row-name', unlocked ? t.name : '???'), el('div', 'row-desc', unlocked ? t.tagline : 'Earn ' + money(t.unlockAt) + ' lifetime to unlock'));
      const right = el('div', 'row-right');
      if (unlocked) {
        right.append(el('div', 'row-cost', money(eco.price(t))));
        right.append(el('div', 'row-state ' + (selected ? 'on' : ''), selected ? 'SELECTED' : 'SELECT'));
      } else right.append(el('div', 'row-state', 'LOCKED'));
      r.append(sw, txt, right);
    };
    const renderUpgradeRow = (r, u) => {
      r.innerHTML = '';
      const lvl = eco.lvl(u.id);
      const cost = eco.upgradeCost(u.id);
      const maxed = lvl >= u.max;
      const gated = u.requires && !eco.lvl(u.requires);
      const can = eco.canUpgrade(u.id);
      r.classList.toggle('locked', gated);
      r.classList.toggle('maxed', maxed);
      r.classList.toggle('cant', !maxed && !gated && !can);
      const sw = el('div', 'swatch upg');
      sw.append(el('span', '', u.max > 1 ? `${lvl}/${u.max}` : (lvl ? '✓' : '')));
      const txt = el('div', 'row-text');
      txt.append(el('div', 'row-name', u.name), el('div', 'row-desc', gated ? 'Requires Scratch Bot' : u.desc));
      const right = el('div', 'row-right');
      right.append(el('div', 'row-cost', maxed ? 'MAX' : money(cost)));
      right.append(el('div', 'row-state ' + (lvl ? 'on' : ''), u.fmt(lvl) || (can ? 'BUY' : '')));
      r.append(sw, txt, right);
    };
    const renderPerkRow = (r, pk) => {
      r.innerHTML = '';
      const lvl = eco.perk(pk.id);
      const cost = eco.perkCost(pk.id);
      const maxed = lvl >= pk.max;
      const can = eco.canBuyPerk(pk.id);
      r.classList.toggle('maxed', maxed);
      r.classList.toggle('cant', !maxed && !can);
      const sw = el('div', 'swatch perk');
      sw.append(el('span', '', pk.max > 1 ? `${lvl}/${pk.max}` : (lvl ? '✓' : '')));
      const txt = el('div', 'row-text');
      txt.append(el('div', 'row-name', pk.name), el('div', 'row-desc', pk.desc));
      const right = el('div', 'row-right');
      right.append(el('div', 'row-cost', maxed ? 'MAX' : fmt(cost) + ' JP'));
      right.append(el('div', 'row-state ' + (lvl ? 'on' : ''), maxed ? 'OWNED' : (can ? 'BUY' : '')));
      r.append(sw, txt, right);
    };
    const renderPrestigeRow = (r) => {
      r.innerHTML = '';
      const gain = eco.prestigeGain();
      r.classList.toggle('cant', gain < 1);
      r.classList.add('prestige-row');
      const sw = el('div', 'swatch prestige'); sw.append(el('span', '', '★'));
      const txt = el('div', 'row-text');
      txt.append(el('div', 'row-name', 'PRESTIGE NOW'), el('div', 'row-desc', gain >= 1
        ? `Reset cash, tickets and upgrades for +${gain} Jack Point${gain > 1 ? 's' : ''}.`
        : `Earn ${money(PRESTIGE_MIN)} in one run to prestige (${money(eco.s.runEarned)} so far).`));
      const right = el('div', 'row-right');
      right.append(el('div', 'row-cost', '+' + gain + ' JP'));
      r.append(sw, txt, right);
    };

    const rebuild = () => {
      list.innerHTML = '';
      rowsById.clear();
      for (const t of tabs) tabEls[t].classList.toggle('active', t === tab);
      if (tab === 'tickets') for (const t of TICKETS) { const r = makeRow('t-' + t.id); renderTicketRow(r, t); list.append(r); }
      if (tab === 'upgrades') for (const u of UPGRADES) { const r = makeRow('u-' + u.id); renderUpgradeRow(r, u); list.append(r); }
      if (tab === 'prestige') {
        const pr = makeRow('prestige'); renderPrestigeRow(pr); list.append(pr);
        for (const pk of PERKS) { const r = makeRow('p-' + pk.id); renderPerkRow(r, pk); list.append(r); }
      }
      renderWallet();
      const first = list.querySelector('.focusable');
      if (first) first.dataset.autofocus = '1';
      ui.focus.setRoot(f.root);
      ui.focus.focus(first || tabEls[tab], true);
      if (first) showDetail(first.dataset.key);
    };
    const refreshRows = () => {
      for (const [key, r] of rowsById) {
        if (key.startsWith('t-')) renderTicketRow(r, TICKETS.find((t) => t.id === key.slice(2)));
        else if (key.startsWith('u-')) renderUpgradeRow(r, UPGRADES.find((u) => u.id === key.slice(2)));
        else if (key.startsWith('p-')) renderPerkRow(r, PERKS.find((u) => u.id === key.slice(2)));
        else if (key === 'prestige') renderPrestigeRow(r);
      }
      renderWallet();
      ui.focus.refresh();
      if (ui.focus.current) showDetail(ui.focus.current.dataset.key);
    };
    const setTab = (t) => { if (t === tab) return; tab = t; Sound.play('ui_move'); rebuild(); };

    const showDetail = (key) => {
      detail.innerHTML = '';
      if (!key) return;
      if (key.startsWith('t-')) {
        const t = TICKETS.find((x) => x.id === key.slice(2));
        const unlocked = eco.isUnlocked(t.id);
        const card = el('div', 'detail-card');
        card.style.background = `linear-gradient(160deg, ${t.theme.a}, ${t.theme.b})`;
        card.append(el('div', 'detail-name', unlocked ? t.name : 'LOCKED TICKET'));
        card.append(el('div', 'detail-sub', unlocked ? t.tagline : 'Keep scratching to find out.'));
        const meta = el('div', 'detail-meta');
        meta.append(el('span', '', `${t.cols}×${t.rows} grid`), el('span', '', `Match ${t.match}`), el('span', '', money(eco.price(t))));
        if (t.jackpot) meta.append(el('span', 'jp', 'Progressive jackpot'));
        if (t.multChance) meta.append(el('span', '', 'Multiplier cells'));
        if (t.bonusChance) meta.append(el('span', '', 'Bonus cells'));
        card.append(meta);
        if (unlocked) {
          const pay = el('div', 'detail-pay');
          const tiers = tiersOf(t);
          const paying = [...new Set([...tiers.small, ...tiers.medium, ...tiers.big, ...tiers.huge])];
          for (const id of paying) { const c = el('div', 'pay-cell'); c.append(symbolIcon(id, 44), el('span', '', '×' + payFor(t, id))); pay.append(c); }
          card.append(pay);
          const o = eco.odds(t);
          const hit = Math.round((1 - o.lose) * 100);
          card.append(el('div', 'detail-odds', `Win chance ${hit}% · Big win ${(o.big + o.huge + o.jackpot) * 100 >= 1 ? ((o.big + o.huge + o.jackpot) * 100).toFixed(1) : ((o.big + o.huge + o.jackpot) * 100).toFixed(2)}%`));
          if (t.jackpot) card.append(el('div', 'detail-odds', `Jackpot pool ${money(eco.s.jackpotPool + eco.price(t) * 120)}`));
        }
        detail.append(card);
      } else if (key.startsWith('u-')) {
        const u = UPGRADES.find((x) => x.id === key.slice(2));
        const card = el('div', 'detail-card upg');
        card.append(el('div', 'detail-name', u.name), el('div', 'detail-sub', u.desc));
        const lvl = eco.lvl(u.id);
        const meta = el('div', 'detail-meta');
        meta.append(el('span', '', `Level ${lvl} / ${u.max}`));
        if (lvl < u.max) meta.append(el('span', '', 'Next: ' + money(eco.upgradeCost(u.id))));
        card.append(meta);
        const eff = {
          luck: `Luck ${eco.luck}: big-win odds ×${(1 + eco.luck * 0.03).toFixed(2)}`,
          payout: `Payout multiplier ×${eco.payoutMult.toFixed(2)}`,
          brush: `Brush radius ${(0.08 + eco.brush * 0.012).toFixed(3)}`,
          discount: `Tickets cost ${Math.round(eco.discount * 100)}%`,
          botspeed: `Bot clears ${eco.botRate.toFixed(1)} cells / second`,
          wildcard: `${Math.round(eco.wildChance * 100)}% of losing tickets become wins`,
          bonushunter: `BONUS cells pay ×${(4 * eco.bonusMult).toFixed(1)} price`,
        }[u.id];
        if (eff) card.append(el('div', 'detail-odds', eff));
        detail.append(card);
      } else if (key.startsWith('p-')) {
        const pk = PERKS.find((x) => x.id === key.slice(2));
        const card = el('div', 'detail-card perk');
        card.append(el('div', 'detail-name', pk.name), el('div', 'detail-sub', pk.desc));
        const meta = el('div', 'detail-meta');
        meta.append(el('span', '', `Level ${eco.perk(pk.id)} / ${pk.max}`));
        if (eco.perk(pk.id) < pk.max) meta.append(el('span', '', 'Cost ' + fmt(eco.perkCost(pk.id)) + ' JP'));
        card.append(meta);
        detail.append(card);
      } else if (key === 'prestige') {
        const card = el('div', 'detail-card prestige');
        card.append(el('div', 'detail-name', 'JACK POINTS'), el('div', 'detail-sub', 'Permanent. Each one adds +10% to every payout. Perks never reset.'));
        const meta = el('div', 'detail-meta');
        meta.append(el('span', '', `You have ${fmt(eco.s.jp)} JP`), el('span', '', `Multiplier ×${eco.jpMult.toFixed(2)}`), el('span', '', `Run earnings ${money(eco.s.runEarned)}`));
        card.append(meta);
        detail.append(card);
      }
    };

    const activate = (key) => {
      if (key.startsWith('t-')) {
        const id = key.slice(2);
        if (!eco.isUnlocked(id)) { Sound.play('error'); return; }
        if (eco.select(id)) { Sound.play('ui_confirm'); refreshRows(); }
      } else if (key.startsWith('u-')) {
        if (eco.buyUpgrade(key.slice(2))) { Sound.play('upgrade'); g.onUpgradeBought(key.slice(2)); refreshRows(); }
        else Sound.play('error');
      } else if (key.startsWith('p-')) {
        if (eco.buyPerk(key.slice(2))) { Sound.play('upgrade'); refreshRows(); }
        else Sound.play('error');
      } else if (key === 'prestige') {
        const gain = eco.prestigeGain();
        if (gain < 1) { Sound.play('error'); return; }
        ui.open('confirm', {
          title: `Prestige for +${gain} JP?`, text: 'Cash, upgrades and ticket progress reset. Jack Points and perks stay.',
          yes: 'PRESTIGE', danger: false,
          onYes: () => { ui.close(); g.doPrestige(); rebuild(); },
        });
      }
    };

    rebuild();
    return {
      root: f.root,
      onTab: (dir) => setTab(tabs[(tabs.indexOf(tab) + dir + tabs.length) % tabs.length]),
      refresh: refreshRows,
      onResume: refreshRows,
    };
  },
};

export { SCREENS, symbolIcon, SYMBOLS };
