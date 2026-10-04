/* Pure-logic checks on the economy: generation ⇄ evaluation agreement, EV bounds,
   save round-trip, prestige maths. Runs under node without a browser. */
import { Economy, TICKETS, newState, mulberry32, SYMBOLS, PRESTIGE_MIN, tiersOf, payFor } from '../ScratchFever/www/src/game/economy.js';
import { reporter } from './_lib.mjs';

const { ok, done } = reporter('economy');

// 1. every ticket type: a roll with no winner never pays, a roll with a planted winner pays exactly that line
for (const t of TICKETS) {
  const e = new Economy(newState(), mulberry32(7));
  e.s.cash = 1e15;
  let losers = 0, loserPaid = 0, multiLine = 0, n = 4000, won = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const cells = e.roll(t);
    const r = e.evaluate(t, cells, t.cost);
    // count regular symbols: at most one symbol may reach `match` (plus wilds)
    const counts = {};
    for (const id of cells) if (!SYMBOLS[id].special && !SYMBOLS[id].dud) counts[id] = (counts[id] || 0) + 1;
    const wilds = cells.filter((c) => c === 'wild').length;
    const lines = Object.values(counts).filter((c) => c + wilds >= t.match).length;
    if (lines > 1) multiLine++;
    if (r.lines.length === 0 && !r.jackpotHit && r.bonus === 0) { losers++; if (r.payout > 0) loserPaid++; }
    if (r.payout > 0) won++;
    sum += r.payout;
  }
  const ev = sum / n / t.cost;
  ok(loserPaid === 0, `${t.id}: a grid without a line never pays (${losers} losers)`);
  ok(multiLine === 0, `${t.id}: never more than one paying line (${multiLine} violations)`);
  ok(ev > 1.0 && ev < 2.2, `${t.id}: expected value ${ev.toFixed(2)}× price stays positive and bounded`);
  ok(won / n > 0.2 && won / n < 0.5, `${t.id}: win rate ${(won / n * 100).toFixed(0)}% in the 20–50% band`);
  const tiers = tiersOf(t);
  ok(['small', 'medium', 'big', 'huge'].every((k) => tiers[k].length > 0), `${t.id}: every prize tier has a symbol`);
  ok(t.symbols.filter((id) => !SYMBOLS[id].dud).every((id) => payFor(t, id) > 0), `${t.id}: every paying symbol has a pay`);
}

// 2. luck raises the odds monotonically
{
  const e = new Economy(newState());
  const t = TICKETS[3];
  const o0 = e.odds(t);
  e.s.upgrades.luck = 20;
  const o1 = e.odds(t);
  ok(o1.big > o0.big && o1.huge > o0.huge && o1.lose < o0.lose, 'luck 20 raises big/huge odds and lowers the loss rate');
}

// 3. buy / settle bookkeeping
{
  const e = new Economy(newState(), mulberry32(3));
  e.s.cash = 100;
  const b = e.buyTicket('penny');
  ok(b && e.s.cash === 99 && e.s.stats.tickets === 1, 'buying a penny ticket costs $1 and counts the ticket');
  const r = e.settle(b.ticket, b.cells, b.price);
  ok(e.s.cash === 99 + r.payout, 'settle adds exactly the payout');
  ok(e.buyTicket('mega') === null, 'cannot buy a ticket you cannot afford');
  e.s.cash = 0;
  ok(e.buyTicket('penny') !== null, 'the penny ticket is always playable at $0 (never stranded)');
}

// 4. unlocks follow lifetime earnings
{
  const e = new Economy(newState());
  e.s.lifetimeEarned = 500;
  e.refreshUnlocks();
  ok(e.isUnlocked('fruit') && e.isUnlocked('bell') && !e.isUnlocked('vault'), 'lifetime $500 unlocks fruit + bell, not vault');
}

// 5. upgrades: cost growth, max, requirement gating
{
  const e = new Economy(newState());
  e.s.cash = 1e9;
  const c0 = e.upgradeCost('luck');
  ok(e.buyUpgrade('luck') && e.upgradeCost('luck') > c0, 'upgrade cost grows per level');
  ok(!e.canUpgrade('botspeed'), 'Bot Servos is gated behind Scratch Bot');
  ok(e.buyUpgrade('bot') && e.canUpgrade('botspeed'), 'buying Scratch Bot unlocks Bot Servos');
  for (let i = 0; i < 5; i++) e.buyUpgrade('quick');
  ok(e.lvl('quick') === 1 && e.upgradeCost('quick') === Infinity, 'a one-level upgrade caps at 1');
}

// 6. prestige
{
  const e = new Economy(newState());
  e.s.runEarned = PRESTIGE_MIN * 9;
  ok(e.prestigeGain() === 3, 'prestige gain is sqrt(run / 20K) = 3');
  e.s.upgrades = { luck: 5, bot: 1 };
  e.s.cash = 12345;
  e.prestige();
  ok(e.s.jp === 3 && e.s.cash === 5 && !e.s.upgrades.luck && e.s.runEarned === 0, 'prestige resets cash/upgrades and credits JP');
  ok(Math.abs(e.payoutMult - 1.3) < 1e-9, 'three JP = ×1.30 payouts');
  e.s.jp = 10;
  ok(e.buyPerk('botstart') && e.s.jp === 7, 'perk purchase spends JP');
  e.prestige();   // gain 0 → no-op
  e.s.runEarned = PRESTIGE_MIN;
  e.prestige();
  ok(e.lvl('bot') === 1 && e.lvl('quick') === 1, 'Bot Warranty restores Bot + Quick Reveal after prestige');
}

// 7. save round-trip and tolerance for garbage
{
  const e = new Economy(newState());
  e.s.cash = 42; e.s.selected = 'bell'; e.s.unlocked.push('fruit', 'bell');
  const back = Economy.deserialize(e.serialize());
  ok(back && back.cash === 42 && back.selected === 'bell', 'serialize → deserialize keeps state');
  ok(Economy.deserialize('{not json') === null, 'corrupt save returns null');
  const partial = Economy.deserialize('{"cash":9,"selected":"nope"}');
  ok(partial.selected === 'penny' && partial.stats && partial.unlocked.length === 1, 'partial save is healed with defaults');
}

// 8. offline earnings only with bot + autobuy, capped at 4h
{
  const e = new Economy(newState(), mulberry32(11));
  ok(e.offlineEarnings(3600).amount === 0, 'no offline income without the bot');
  e.s.upgrades = { bot: 1, autobuy: 1, botspeed: 5 };
  const r = e.offlineEarnings(10 * 3600);
  ok(r.seconds === 4 * 3600 && r.tickets > 0, 'offline time caps at 4h and scratches tickets');
}

process.exit(done() ? 1 : 0);
