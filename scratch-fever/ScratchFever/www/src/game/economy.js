/* =========================================================
   Scratch Fever — the economy. Pure logic, no DOM, no three.js,
   so it runs under node for simulation and tests.

   A ticket is a grid of symbols. Matching `match` or more of a
   symbol pays its multiplier times the ticket price; extra copies
   escalate the tier. Special cells: WILD joins the best symbol,
   MULT multiplies the ticket total, BONUS pays instantly, JACKPOT
   (3+) pays the progressive pool.
   ========================================================= */

export const SAVE_KEY = 'scratchfever.save.v1';
export const SAVE_VERSION = 1;

/* ---------------------------------------------------------
   Symbols. `pay` is a multiple of the ticket price for a bare
   match; `rank` orders rarity for the luck upgrade.
   --------------------------------------------------------- */
export const SYMBOLS = {
  cherry:    { name: 'Cherry',    pay: 1.2,  rank: 0, color: '#ff4d6d' },
  lemon:     { name: 'Lemon',     pay: 1.6,  rank: 1, color: '#ffe14d' },
  clover:    { name: 'Clover',    pay: 2.2,  rank: 2, color: '#5ee87a' },
  bell:      { name: 'Bell',      pay: 3,    rank: 3, color: '#ffc14d' },
  horseshoe: { name: 'Horseshoe', pay: 4,    rank: 4, color: '#c9d1ff' },
  star:      { name: 'Star',      pay: 6,    rank: 5, color: '#ffd95a' },
  diamond:   { name: 'Diamond',   pay: 9,    rank: 6, color: '#7ae7ff' },
  seven:     { name: 'Seven',     pay: 14,   rank: 7, color: '#ff5fc9' },
  crown:     { name: 'Crown',     pay: 22,   rank: 8, color: '#ffe28a' },
  rocket:    { name: 'Rocket',    pay: 35,   rank: 9, color: '#9ad0ff' },
  moon:      { name: 'Moon',      pay: 55,   rank: 10, color: '#d9c8ff' },
  skull:     { name: 'Skull',     pay: 0,    rank: -1, color: '#9aa6a0', dud: true },
  wild:      { name: 'Wild',      pay: 0,    rank: 11, color: '#ffffff', special: 'wild' },
  mult2:     { name: 'x2',        pay: 0,    rank: 11, color: '#ff9f43', special: 'mult', mult: 2 },
  mult3:     { name: 'x3',        pay: 0,    rank: 12, color: '#ff7a3d', special: 'mult', mult: 3 },
  mult5:     { name: 'x5',        pay: 0,    rank: 13, color: '#ff5a5a', special: 'mult', mult: 5 },
  mult10:    { name: 'x10',       pay: 0,    rank: 14, color: '#ff4fd8', special: 'mult', mult: 10 },
  bonus:     { name: 'Bonus',     pay: 0,    rank: 11, color: '#7ef0a0', special: 'bonus', value: 4 },
  jackpot:   { name: 'Jackpot',   pay: 0,    rank: 15, color: '#ff4fd8', special: 'jackpot' },
};

/* a winner that turns up one extra copy pays this much more */
const DOUBLE_MULT = 2.5;

/* Outcome odds at luck 0. Tickets are generated outcome-first (like real
   scratch cards): the prize is drawn, then a grid is laid out that shows
   exactly that prize. evaluate() re-derives the prize from the grid, so a
   test can prove the two agree. */
export const ODDS = { small: 0.18, medium: 0.06, big: 0.018, huge: 0.004, jackpot: 0.0011 };
export const DOUBLE_CHANCE = 0.12;

/* ---------------------------------------------------------
   Ticket catalogue. `match` is how many copies pay; the grid
   grows with the price so late tickets take longer to scratch.
   --------------------------------------------------------- */
export const TICKETS = [
  {
    id: 'penny', name: 'Lucky Penny', tagline: 'Where every fortune starts.',
    cost: 1, unlockAt: 0, cols: 3, rows: 3, match: 3, oddsScale: 1.4,
    theme: { a: '#2f8f5b', b: '#153a26', foil: '#b9c0c7', ink: '#f6ffe8' },
    symbols: ['cherry', 'lemon', 'clover', 'bell', 'star', 'diamond', 'skull'],
  },
  {
    id: 'fruit', name: 'Fruit Fiesta', tagline: 'Three of a kind, juicy payouts.',
    cost: 8, unlockAt: 40, cols: 4, rows: 3, match: 3, oddsScale: 1.15, bonusChance: 0.05,
    theme: { a: '#ff7a3d', b: '#7a2a0e', foil: '#c7b89a', ink: '#fff2dc' },
    symbols: ['cherry', 'lemon', 'clover', 'bell', 'horseshoe', 'star', 'diamond', 'skull'],
  },
  {
    id: 'bell', name: 'Silver Bells', tagline: 'Hidden multipliers ring twice.',
    cost: 50, unlockAt: 400, cols: 4, rows: 4, match: 4, oddsScale: 1.05, multChance: 0.18, multTable: [['mult2', 3], ['mult3', 1]],
    theme: { a: '#5ad7e6', b: '#0f3d4a', foil: '#cfd6dd', ink: '#eaffff' },
    symbols: ['lemon', 'clover', 'bell', 'horseshoe', 'star', 'diamond', 'seven', 'skull'],
  },
  {
    id: 'vault', name: 'Gem Vault', tagline: 'Crack the vault, keep the gems.',
    cost: 300, unlockAt: 3000, cols: 4, rows: 4, match: 4, oddsScale: 1.05, bonusChance: 0.06,
    theme: { a: '#7ae7ff', b: '#1a1f5c', foil: '#aab4c8', ink: '#f0f6ff' },
    symbols: ['clover', 'bell', 'horseshoe', 'star', 'diamond', 'seven', 'crown', 'skull'],
  },
  {
    id: 'madness', name: 'Multiplier Madness', tagline: 'Stack the x cells, lose your mind.',
    cost: 1800, unlockAt: 20000, cols: 5, rows: 4, match: 4, oddsScale: 1.0, multChance: 0.3, multTable: [['mult2', 5], ['mult3', 3], ['mult5', 1.2], ['mult10', 0.25]],
    theme: { a: '#ff5a5a', b: '#4a0f2a', foil: '#d2b8c2', ink: '#fff0f4' },
    symbols: ['bell', 'horseshoe', 'star', 'diamond', 'seven', 'crown', 'rocket', 'skull'],
  },
  {
    id: 'golden', name: 'Golden Jackpot', tagline: 'Three crowns take the pool.',
    cost: 12000, unlockAt: 150000, cols: 5, rows: 5, match: 5, oddsScale: 1.05, jackpot: true, bonusChance: 0.04,
    theme: { a: '#f4c542', b: '#4a3300', foil: '#d9c28a', ink: '#fff8dc' },
    symbols: ['horseshoe', 'star', 'diamond', 'seven', 'crown', 'rocket', 'moon', 'skull'],
  },
  {
    id: 'cosmic', name: 'Cosmic Scratch', tagline: 'Rockets, moons and a nova or two.',
    cost: 90000, unlockAt: 1.2e6, cols: 5, rows: 5, match: 5, oddsScale: 1.05, bonusChance: 0.06, multChance: 0.2, multTable: [['mult2', 4], ['mult3', 2], ['mult5', 0.6]],
    theme: { a: '#9ad0ff', b: '#120a3a', foil: '#b8b8d8', ink: '#f2f0ff' },
    symbols: ['star', 'diamond', 'seven', 'crown', 'rocket', 'moon', 'skull'],
  },
  {
    id: 'mega', name: "Jack's Mega Ticket", tagline: 'The one the kiosk whispers about.',
    cost: 750000, unlockAt: 1.5e7, cols: 6, rows: 6, match: 6, oddsScale: 1.1, jackpot: true, bonusChance: 0.05, multChance: 0.25, multTable: [['mult2', 5], ['mult3', 3], ['mult5', 1.2], ['mult10', 0.3]],
    theme: { a: '#ff4fd8', b: '#2a0a3a', foil: '#e0c8ff', ink: '#fff0ff' },
    symbols: ['diamond', 'seven', 'crown', 'rocket', 'moon', 'skull'],
  },
];

export const TICKET_BY_ID = Object.fromEntries(TICKETS.map((t) => [t.id, t]));

/* Prize multiples (× ticket price) per tier; symbols inside a tier step up. */
const TIER_PAY = { small: [1.3, 0.4], medium: [3.5, 1.2], big: [9, 3], huge: [30, 12] };

/** What a symbol pays on this ticket, as a multiple of the price. */
export function payFor(t, id) {
  const tiers = tiersOf(t);
  for (const k in TIER_PAY) {
    const i = tiers[k].indexOf(id);
    if (i >= 0) return Math.round((TIER_PAY[k][0] + TIER_PAY[k][1] * i) * 100) / 100;
  }
  return 0;
}

const tierCache = new WeakMap();
/** Groups a ticket's symbols into prize tiers by their pay. */
export function tiersOf(t) {
  if (tierCache.has(t)) return tierCache.get(t);
  const paying = t.symbols.filter((id) => !SYMBOLS[id].dud && !SYMBOLS[id].special);
  const by = (lo, hi) => paying.filter((id) => SYMBOLS[id].pay >= lo && SYMBOLS[id].pay < hi);
  const tiers = { small: by(0, 2.5), medium: by(2.5, 7), big: by(7, 16), huge: by(16, 1000) };
  // a ticket that lacks a tier hands that tier to its neighbour so odds are never lost
  const order = ['small', 'medium', 'big', 'huge'];
  for (let i = 0; i < order.length; i++) {
    if (!tiers[order[i]].length) {
      const alt = order.slice(0, i).reverse().concat(order.slice(i + 1)).find((k) => tiers[k].length);
      tiers[order[i]] = tiers[alt];
    }
  }
  tierCache.set(t, tiers);
  return tiers;
}

/* ---------------------------------------------------------
   Upgrades (cash) and prestige perks (Jack Points)
   --------------------------------------------------------- */
export const UPGRADES = [
  { id: 'luck', name: 'Lucky Charm', desc: 'Rare symbols turn up more often.', max: 30, base: 25, growth: 1.55, fmt: (l) => `Luck ${l}` },
  { id: 'payout', name: 'Fat Payouts', desc: '+8% on every win.', max: 50, base: 40, growth: 1.5, fmt: (l) => `+${l * 8}%` },
  { id: 'brush', name: 'Big Brush', desc: 'Wider, faster scratching.', max: 10, base: 15, growth: 1.9, fmt: (l) => `Brush ${l}` },
  { id: 'discount', name: 'Loyalty Card', desc: '-2% ticket price per level.', max: 20, base: 60, growth: 1.6, fmt: (l) => `-${l * 2}%` },
  { id: 'quick', name: 'Quick Reveal', desc: 'Press X to reveal a whole ticket at once.', max: 1, base: 120, growth: 1, fmt: (l) => (l ? 'Owned' : '') },
  { id: 'autobuy', name: 'Season Pass', desc: 'The next ticket is bought for you.', max: 1, base: 300, growth: 1, fmt: (l) => (l ? 'Owned' : '') },
  { id: 'bot', name: 'Scratch Bot', desc: 'A tireless mechanical friend scratches for you.', max: 1, base: 800, growth: 1, fmt: (l) => (l ? 'Online' : '') },
  { id: 'botspeed', name: 'Bot Servos', desc: 'Scratch Bot works faster.', max: 20, base: 500, growth: 1.45, fmt: (l) => `Speed ${l}`, requires: 'bot' },
  { id: 'wildcard', name: 'Wild Streak', desc: '+1% chance any cell comes up WILD.', max: 15, base: 200, growth: 1.7, fmt: (l) => `+${l}%` },
  { id: 'bonushunter', name: 'Bonus Hunter', desc: 'BONUS cells pay +50% per level.', max: 10, base: 350, growth: 1.75, fmt: (l) => `+${l * 50}%` },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const PERKS = [
  { id: 'startcash', name: 'Seed Money', desc: 'Start every run with +$500 per level.', max: 10, cost: (l) => 1 + l },
  { id: 'baseluck', name: 'Born Lucky', desc: '+2 Luck for free, every run.', max: 10, cost: (l) => 2 + l },
  { id: 'botstart', name: 'Bot Warranty', desc: 'Scratch Bot and Quick Reveal come back after prestige.', max: 1, cost: () => 3 },
  { id: 'golden', name: 'Golden Touch', desc: '+4% chance a ticket pays double.', max: 10, cost: (l) => 2 + l * 2 },
  { id: 'jackboost', name: 'Jack Multiplier', desc: 'Each Jack Point is worth +15% instead of +10%.', max: 1, cost: () => 6 },
];
export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export const PRESTIGE_MIN = 20000;
export const JACKPOT_BASE = 120;    // × ticket cost, plus the pool

/* ---------------------------------------------------------
   Deterministic RNG (tests) with a Math.random fallback.
   --------------------------------------------------------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------
   Fresh state
   --------------------------------------------------------- */
export function newState() {
  return {
    v: SAVE_VERSION,
    cash: 5,
    jp: 0,
    lifetimeEarned: 0,
    runEarned: 0,
    upgrades: {},
    perks: {},
    selected: 'penny',
    unlocked: ['penny'],
    jackpotPool: 0,
    stats: {
      tickets: 0, wins: 0, biggestWin: 0, jackpots: 0, prestiges: 0,
      playTime: 0, cellsScratched: 0, botTickets: 0, bestTicket: '',
    },
    lastSave: Date.now(),
    created: Date.now(),
  };
}

export class Economy {
  constructor(state = newState(), rng = Math.random) {
    this.s = state;
    this.rng = rng;
    this.listeners = new Set();
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, data) { for (const fn of this.listeners) fn(ev, data); }

  /* ---------------- derived values ---------------- */
  lvl(id) { return this.s.upgrades[id] || 0; }
  perk(id) { return this.s.perks[id] || 0; }
  get luck() { return this.lvl('luck') + this.perk('baseluck') * 2; }
  get jpMult() { return 1 + this.s.jp * (this.perk('jackboost') ? 0.15 : 0.10); }
  get payoutMult() { return (1 + this.lvl('payout') * 0.08) * this.jpMult; }
  get discount() { return 1 - this.lvl('discount') * 0.02; }
  get brush() { return this.lvl('brush'); }
  get hasQuick() { return this.lvl('quick') > 0; }
  get hasAutoBuy() { return this.lvl('autobuy') > 0; }
  get hasBot() { return this.lvl('bot') > 0; }
  /** cells per second the bot clears */
  get botRate() { return this.hasBot ? 2.2 * Math.pow(1.18, this.lvl('botspeed')) : 0; }
  get wildChance() { return this.lvl('wildcard') * 0.01; }
  get bonusMult() { return 1 + this.lvl('bonushunter') * 0.5; }
  get goldenChance() { return this.perk('golden') * 0.04; }

  ticket(id = this.s.selected) { return TICKET_BY_ID[id] || TICKETS[0]; }
  price(t = this.ticket()) { return Math.max(1, Math.round(t.cost * this.discount)); }
  canAfford(t = this.ticket()) { return this.s.cash >= this.price(t); }
  isUnlocked(id) { return this.s.unlocked.includes(id); }

  /** Tickets become available as lifetime earnings grow. */
  refreshUnlocks() {
    let changed = false;
    for (const t of TICKETS) {
      if (!this.isUnlocked(t.id) && this.s.lifetimeEarned >= t.unlockAt) {
        this.s.unlocked.push(t.id);
        changed = true;
        this.emit('unlock', t);
      }
    }
    return changed;
  }

  select(id) {
    if (!this.isUnlocked(id)) return false;
    this.s.selected = id;
    this.emit('select', this.ticket());
    return true;
  }

  /* ---------------- ticket generation ---------------- */
  /** Outcome odds for a ticket after luck. Returns {small, medium, big, huge, jackpot, lose}. */
  odds(t) {
    const L = this.luck;
    const boost = 1 + L * 0.03;
    const o = {
      small: ODDS.small * t.oddsScale,
      medium: ODDS.medium * t.oddsScale * boost,
      big: ODDS.big * t.oddsScale * boost,
      huge: ODDS.huge * t.oddsScale * boost,
      jackpot: t.jackpot ? ODDS.jackpot * boost : 0,
    };
    let sum = o.small + o.medium + o.big + o.huge + o.jackpot;
    if (sum > 0.85) { const k = 0.85 / sum; for (const key in o) o[key] *= k; sum = 0.85; }
    o.lose = 1 - sum;
    return o;
  }

  pick(list) {
    // list of [id, weight]
    const total = list.reduce((a, [, w]) => a + w, 0);
    let r = this.rng() * total;
    for (const [id, w] of list) { r -= w; if (r <= 0) return id; }
    return list[list.length - 1][0];
  }

  /** Draws the outcome, then lays out a grid that shows exactly that outcome. */
  roll(t) {
    const o = this.odds(t);
    let r = this.rng();
    let tier = 'lose';
    for (const k of ['jackpot', 'huge', 'big', 'medium', 'small']) { if (r < o[k]) { tier = k; break; } r -= o[k]; }
    if (tier === 'lose' && this.wildChance > 0 && this.rng() < this.wildChance) tier = 'small';
    const tiers = tiersOf(t);
    const n = t.cols * t.rows;
    const cells = new Array(n).fill(null);
    const counts = {};
    const free = () => { const idx = []; for (let i = 0; i < n; i++) if (cells[i] === null) idx.push(i); return idx; };
    const place = (id, k) => {
      const idx = free();
      for (let j = 0; j < k && idx.length; j++) {
        const at = idx.splice(Math.floor(this.rng() * idx.length), 1)[0];
        cells[at] = id;
        counts[id] = (counts[id] || 0) + 1;
      }
    };
    let winner = null;
    if (tier === 'jackpot') {
      place('jackpot', 3);
    } else if (tier !== 'lose') {
      const pool = tiers[tier];
      winner = pool[Math.floor(this.rng() * pool.length)];
      const copies = t.match + (this.rng() < DOUBLE_CHANCE ? 1 : 0);
      place(winner, copies);
      // one copy may show as a WILD for flavour (evaluate treats it as the same line)
      if (this.rng() < 0.25) { const i = cells.indexOf(winner); cells[i] = 'wild'; counts[winner]--; counts.wild = 1; }
    }
    // feature cells, independent of the outcome: a multiplier only matters on a win
    if (t.multChance && this.rng() < t.multChance) place(this.pick(t.multTable), 1);
    if (t.bonusChance && this.rng() < t.bonusChance) place('bonus', 1);
    if (tier !== 'jackpot' && t.jackpot && this.rng() < 0.08) place('jackpot', 1 + (this.rng() < 0.3 ? 1 : 0));   // tease
    // fillers: every other symbol stays below `match`
    const fillers = t.symbols.filter((id) => id !== winner);
    // a WILD on the grid would complete a filler sitting one short, so cap lower
    const cap = t.match - 1 - (counts.wild ? 1 : 0);
    for (const i of free()) {
      let tries = 0, id;
      do { id = fillers[Math.floor(this.rng() * fillers.length)]; tries++; }
      while ((counts[id] || 0) >= cap && tries < 40);
      if ((counts[id] || 0) >= cap) id = 'skull';
      cells[i] = id;
      counts[id] = (counts[id] || 0) + 1;
    }
    return cells;
  }

  /** Evaluates a revealed grid. Returns the breakdown without applying it. */
  evaluate(t, cells, price = this.price(t)) {
    const counts = {};
    let wilds = 0, mult = 1, bonus = 0, jackpots = 0;
    for (const id of cells) {
      const sym = SYMBOLS[id];
      if (!sym) continue;
      if (sym.special === 'wild') { wilds++; continue; }
      if (sym.special === 'mult') { mult *= sym.mult; continue; }
      if (sym.special === 'bonus') { bonus += price * sym.value * this.bonusMult; continue; }
      if (sym.special === 'jackpot') { jackpots++; continue; }
      if (sym.dud) continue;
      counts[id] = (counts[id] || 0) + 1;
    }
    const lines = [];
    const pay = (id, c) => payFor(t, id) * price * (c > t.match ? DOUBLE_MULT : 1);
    // wilds join whichever symbol they improve most
    let best = null, bestGain = 0;
    for (const id in counts) {
      const c = counts[id];
      const base = c >= t.match ? pay(id, c) : 0;
      const withW = (c + wilds) >= t.match ? pay(id, c + wilds) : 0;
      if (withW - base > bestGain) { bestGain = withW - base; best = id; }
    }
    let total = 0;
    for (const id in counts) {
      const c = counts[id] + (id === best ? wilds : 0);
      if (c >= t.match) {
        const amount = pay(id, c);
        lines.push({ symbol: id, count: c, amount });
        total += amount;
      }
    }
    const jackpotHit = jackpots >= 3;
    let jackpotAmount = 0;
    if (jackpotHit) jackpotAmount = (this.s.jackpotPool + price * JACKPOT_BASE) * this.jpMult;
    let golden = false;
    if (this.goldenChance > 0 && (total + bonus) > 0 && this.rng() < this.goldenChance) golden = true;
    let payout = (total * mult + bonus) * this.payoutMult * (golden ? 2 : 1) + jackpotAmount;
    payout = Math.round(payout * 100) / 100;
    return { lines, mult, bonus, wilds, jackpotHit, jackpotAmount, golden, payout, price, won: payout > 0 };
  }

  /* ---------------- transactions ---------------- */
  buyTicket(id = this.s.selected) {
    const t = this.ticket(id);
    const price = this.price(t);
    if (this.s.cash < price) {
      // never strand the player: the penny ticket is always playable
      if (t.id === 'penny') { this.s.cash = Math.max(this.s.cash, 0); }
      else return null;
    }
    this.s.cash = Math.max(0, this.s.cash - price);
    this.s.jackpotPool += price * 0.2;
    this.s.stats.tickets++;
    const cells = this.roll(t);
    this.emit('buy', { ticket: t, price });
    return { ticket: t, price, cells };
  }

  settle(t, cells, price, byBot = false) {
    const r = this.evaluate(t, cells, price);
    if (r.jackpotHit) { this.s.jackpotPool = 0; this.s.stats.jackpots++; }
    if (r.payout > 0) {
      this.s.cash += r.payout;
      this.s.lifetimeEarned += r.payout;
      this.s.runEarned += r.payout;
      this.s.stats.wins++;
      if (r.payout > this.s.stats.biggestWin) { this.s.stats.biggestWin = r.payout; this.s.stats.bestTicket = t.name; }
    }
    if (byBot) this.s.stats.botTickets++;
    this.refreshUnlocks();
    this.emit('settle', r);
    return r;
  }

  upgradeCost(id) {
    const u = UPGRADE_BY_ID[id];
    const l = this.lvl(id);
    if (l >= u.max) return Infinity;
    return Math.round(u.base * Math.pow(u.growth, l));
  }
  canUpgrade(id) {
    const u = UPGRADE_BY_ID[id];
    if (u.requires && !this.lvl(u.requires)) return false;
    return this.s.cash >= this.upgradeCost(id);
  }
  buyUpgrade(id) {
    if (!this.canUpgrade(id)) return false;
    this.s.cash -= this.upgradeCost(id);
    this.s.upgrades[id] = this.lvl(id) + 1;
    this.emit('upgrade', { id, level: this.s.upgrades[id] });
    return true;
  }

  /* ---------------- prestige ---------------- */
  prestigeGain() {
    if (this.s.runEarned < PRESTIGE_MIN) return 0;
    return Math.floor(Math.sqrt(this.s.runEarned / PRESTIGE_MIN));
  }
  canPrestige() { return this.prestigeGain() >= 1; }
  prestige() {
    const gain = this.prestigeGain();
    if (gain < 1) return 0;
    const s = this.s;
    s.jp += gain;
    s.stats.prestiges++;
    s.runEarned = 0;
    s.cash = 5 + this.perk('startcash') * 500;
    s.upgrades = {};
    if (this.perk('botstart')) { s.upgrades.bot = 1; s.upgrades.quick = 1; }
    s.selected = 'penny';
    s.jackpotPool = 0;
    this.emit('prestige', { gain, jp: s.jp });
    return gain;
  }
  perkCost(id) { const p = PERK_BY_ID[id]; const l = this.perk(id); return l >= p.max ? Infinity : p.cost(l); }
  canBuyPerk(id) { return this.s.jp >= this.perkCost(id); }
  buyPerk(id) {
    if (!this.canBuyPerk(id)) return false;
    this.s.jp -= this.perkCost(id);
    this.s.perks[id] = this.perk(id) + 1;
    this.emit('perk', { id, level: this.s.perks[id] });
    return true;
  }

  /* ---------------- offline bot ---------------- */
  /** Simulates what the bot would have earned while the game was closed. */
  offlineEarnings(seconds) {
    if (!this.hasBot || !this.hasAutoBuy) return { seconds: 0, amount: 0, tickets: 0 };
    const cap = 4 * 3600;
    const sec = Math.min(cap, Math.max(0, seconds));
    const t = this.ticket();
    const perTicket = (t.cols * t.rows) / this.botRate + 0.9;
    const tickets = Math.floor(sec / perTicket);
    if (tickets <= 0) return { seconds: sec, amount: 0, tickets: 0 };
    // sample the EV instead of rolling thousands of tickets
    const samples = Math.min(tickets, 60);
    let net = 0;
    for (let i = 0; i < samples; i++) {
      const cells = this.roll(t);
      const r = this.evaluate(t, cells, this.price(t));
      net += r.payout - this.price(t);
    }
    const avg = net / samples;
    const amount = Math.max(0, Math.round(avg * tickets * 0.5));   // offline runs at half efficiency
    return { seconds: sec, amount, tickets };
  }

  applyOffline(res) {
    if (res.amount <= 0) return;
    this.s.cash += res.amount;
    this.s.lifetimeEarned += res.amount;
    this.s.runEarned += res.amount;
    this.s.stats.botTickets += res.tickets;
    this.refreshUnlocks();
  }

  /* ---------------- persistence ---------------- */
  serialize() { this.s.lastSave = Date.now(); return JSON.stringify(this.s); }

  static deserialize(json) {
    try {
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return null;
      const base = newState();
      const s = { ...base, ...data, stats: { ...base.stats, ...(data.stats || {}) } };
      if (!Array.isArray(s.unlocked) || !s.unlocked.length) s.unlocked = ['penny'];
      if (!TICKET_BY_ID[s.selected]) s.selected = 'penny';
      s.v = SAVE_VERSION;
      return s;
    } catch { return null; }
  }
}
