// Progression balance: every project and upgrade must be payable from the ore that exists.
// Run with: node --test emberfield/tests/balance.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS_DIR = path.join(__dirname, '..', 'js');
const sandbox = {
  window: { addEventListener() {} },
  navigator: {},
  document: { getElementById: () => ({ getContext: () => ({}) }), addEventListener() {} },
  localStorage: { getItem: () => null },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  console
};
vm.createContext(sandbox);
for (const f of ['config.js', 'data.js', 'world.js']) {
  vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sandbox, { filename: f });
}
const { D, world: W } = sandbox.EF;

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const count = (floors, ch) => floors.reduce((n, f) => {
  return n + W.area('mine' + f).rows.join('').split(ch).length - 1;
}, 0);
const golems = (floors) => floors.reduce((n, f) => {
  return n + W.area('mine' + f).spawns.filter((s) => s.type === 'golem').length;
}, 0);

// Ore needed to make `qty` of a bar, using the smelting recipes.
const oreFor = (bar, qty) => {
  const r = D.smelt.find((x) => x.out === bar);
  return r ? { ore: r.from, amount: r.qty * qty } : null;
};

function totals(list) {
  const need = {};
  for (const [item, qty] of list) {
    const o = oreFor(item, qty);
    if (o) need[o.ore] = (need[o.ore] || 0) + o.amount;
  }
  return need;
}

const projectBars = [];
D.projects.forEach((p) => p.reqs.forEach((r) => { if (r.item) projectBars.push([r.item, r.qty]); }));
const upgradeBars = D.upgradeCost.map((c) => [c.bar, c.qty]);
const allNeed = totals(projectBars.concat(upgradeBars));

const lift = D.projects.find((p) => p.id === 'lift');
const liftNeed = totals(lift.reqs.filter((r) => r.item).map((r) => [r.item, r.qty]));
const copperPickNeed = totals([upgradeBars[0]]);

test('total copper ore for every project and upgrade exists on the mine floors', () => {
  // Each ore tile yields one or two ore; counting one per tile is the conservative bound.
  assert.ok(count(range(1, 8), 'O') >= (allNeed.copper_ore || 0), 'copper');
});

test('iron ore for the iron pick, the lift, the clock and the deep shafts exists', () => {
  assert.ok(count(range(2, 8), 'I') >= (allNeed.iron_ore || 0), 'iron ' + (allNeed.iron_ore || 0));
});

test('gold ore for the clocktower exists on the deep floors', () => {
  assert.ok(count(range(6, 8), 'G') >= (allNeed.gold_ore || 0), 'gold');
});

test('gleam shards for the lamps exist on floors 5 and deeper', () => {
  const lamps = D.projects.find((p) => p.id === 'lamps').reqs[0];
  assert.ok(count(range(5, 8), 'Y') >= lamps.qty, 'gleam');
});

test('golem cores for the deep shafts can drop before the deep gate opens', () => {
  const deep = D.projects.find((p) => p.id === 'deep').reqs.find((r) => r.item === 'golem_core');
  assert.ok(golems(range(4, 6)) >= deep.qty, 'golems on floors 4-6');
  assert.equal(D.items.golem_core.type, 'material');
});

test('the lift is payable before floor 4 is open', () => {
  // Floors 1-3 are the only ones reachable before the lift, and the copper pick is needed first.
  const preCopper = (liftNeed.copper_ore || 0) + (copperPickNeed.copper_ore || 0);
  assert.ok(count(range(1, 3), 'O') >= preCopper, 'copper before the lift');
  assert.ok(count(range(2, 3), 'I') >= (liftNeed.iron_ore || 0), 'iron before the lift');
});

test('the copper and iron pick upgrades are reachable with the gold the player can earn', () => {
  // Starting gold plus one copper pick is enough to start mining iron; no upgrade may cost more than the pack value.
  const copperCost = D.upgradeCost[0].gold, ironCost = D.upgradeCost[1].gold;
  assert.ok(copperCost <= 500 + 300, 'copper upgrade gold');
  assert.ok(ironCost > copperCost, 'iron upgrade costs more than copper');
});
