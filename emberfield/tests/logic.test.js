// Content and map integrity checks. Run with: node --test emberfield/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS_DIR = path.join(__dirname, '..', 'js');

// Load the browser scripts into one shared sandbox, exactly as index.html does.
function loadGame(files) {
  const sandbox = {
    window: { addEventListener() {} },
    navigator: {},
    document: { getElementById: () => ({ getContext: () => ({}) }), addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    console
  };
  vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(JS_DIR, f), 'utf8'), sandbox, { filename: f });
  }
  return sandbox;
}

const game = loadGame(['config.js', 'data.js', 'world.js']);
const EF = game.EF;
const W = EF.world;
const D = EF.D;

function solid(ch) {
  return W.isSolid(ch);
}
function charAt(tpl, x, y) {
  if (y < 0 || y >= tpl.rows.length || x < 0 || x >= tpl.w) return 'T';
  return tpl.rows[y][x];
}

test('every JS file parses', () => {
  for (const f of fs.readdirSync(JS_DIR)) {
    if (!f.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
    assert.doesNotThrow(() => new vm.Script(src, { filename: f }), f);
  }
});

test('all hand-built and generated areas have the declared size', () => {
  for (const id of W.AREA_IDS) {
    const t = W.area(id);
    assert.equal(t.rows.length, t.h, id + ' height');
    t.rows.forEach((r, y) => assert.equal(r.length, t.w, id + ' row ' + y + ' width'));
  }
});

test('every character on every map is a known tile', () => {
  for (const id of W.AREA_IDS) {
    const t = W.area(id);
    t.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        assert.ok(W.TILES[r[x]], id + ' unknown tile ' + JSON.stringify(r[x]) + ' at ' + x + ',' + y);
      }
    });
  }
});

test('warps start on walkable tiles and arrive on walkable, non-warp tiles', () => {
  for (const id of W.AREA_IDS) {
    const t = W.area(id);
    for (const key of Object.keys(t.warps)) {
      const [x, y] = key.split(',').map(Number);
      const from = charAt(t, x, y);
      assert.ok(!solid(from), id + ' warp ' + key + ' sits on solid ' + from);
      const to = t.warps[key];
      const target = W.area(to.area);
      assert.ok(target, id + ' warp targets missing area ' + to.area);
      const arrive = charAt(target, to.x, to.y);
      assert.ok(!solid(arrive), id + ' -> ' + to.area + ' arrival ' + to.x + ',' + to.y + ' is solid (' + arrive + ')');
      assert.equal(target.warps[U(to.x, to.y)], undefined, id + ' -> ' + to.area + ' arrival is itself a warp');
    }
  }
  function U(x, y) { return x + ',' + y; }
});

test('the farm field lies inside the map and has tillable grass', () => {
  const farm = W.area('farm');
  const r = farm.farmRect;
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= farm.w && r.y + r.h <= farm.h);
  let grass = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) if (farm.rows[y][x] === '.') grass++;
  }
  assert.ok(grass > 150, 'field has only ' + grass + ' grass tiles');
});

test('every villager home and schedule point is a walkable tile in its area', () => {
  for (const npc of D.npcs) {
    const spots = [npc.home].concat(npc.sched);
    for (const s of spots) {
      const area = W.area(s.area);
      assert.ok(!solid(charAt(area, s.x, s.y)), npc.name + ' stands on solid tile at ' + s.area + ' ' + s.x + ',' + s.y);
    }
  }
});

test('the restoration board, well and bridge tiles exist in town', () => {
  const town = W.area('town');
  const flat = town.rows.join('');
  assert.ok(flat.includes('N'), 'notice board');
  assert.ok(flat.includes('W'), 'well');
  assert.ok(flat.includes('Q'), 'broken bridge');
  // The bridge must span the river: Q tiles must be contiguous on row 12.
  assert.equal(town.rows[12].slice(44, 47), 'QQQ');
});

test('mine floors are connected from the arrival room to the stairs down', () => {
  for (let n = 1; n <= 8; n++) {
    const t = W.area('mine' + n);
    assert.equal(t.rows[4][5], 'U', 'floor ' + n + ' has stairs up');
    // BFS over walkable tiles ignoring ore: the route must exist without mining.
    const seen = new Set(['5,5']);
    const q = [[5, 5]];
    let stairs = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (charAt(t, x, y) === 'S') stairs = [x, y];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || solid(charAt(t, nx, ny))) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    if (n < 8) {
      assert.ok(stairs, 'floor ' + n + ' stairs down are reachable');
      const below = W.area('mine' + (n + 1));
      assert.equal(below.rows[5][5], 'g', 'floor ' + (n + 1) + ' arrival room');
      // Coming back up must arrive on walkable ground next to the stairs.
      const warp = t.warps[stairs[0] + ',' + stairs[1]];
      assert.equal(warp.area, 'mine' + (n + 1));
      assert.ok(!solid(charAt(t, stairs[0], stairs[1] + 1)), 'floor ' + n + ' tile below stairs is walkable');
    } else {
      assert.equal(stairs, null, 'floor 8 has no stairs down');
    }
    t.spawns.forEach((sp) => {
      assert.ok(!solid(charAt(t, Math.floor(sp.x), Math.floor(sp.y))), 'floor ' + n + ' monster spawns inside a wall');
    });
  }
});

test('mine floor 1 leads back to the forest cave mouth', () => {
  // Compare fields: objects built inside the vm sandbox have a different prototype.
  const warp = W.area('mine1').warps['5,4'];
  assert.equal(warp.area, 'forest');
  assert.equal(warp.x, 25);
  assert.equal(warp.y, 3);
  assert.equal(W.area('forest').rows[2][25], 'S');
  assert.equal(W.area('forest').rows[3][25], 'p');
});

test('mine gates: floors 4+ need the lift and floors 7+ need the deep shafts', () => {
  const none = { lift: false, deep: false };
  assert.equal(W.lockMessage('mine3', none), null);
  assert.ok(W.lockMessage('mine4', none));
  assert.equal(W.lockMessage('mine4', { lift: true, deep: false }), null);
  assert.ok(W.lockMessage('mine7', { lift: true, deep: false }));
  assert.equal(W.lockMessage('mine8', { lift: true, deep: true }), null);
});

test('crops, fish and forage reference real items and valid seasons', () => {
  for (const [k, c] of Object.entries(D.crops)) {
    assert.ok(D.items[k], 'crop item ' + k);
    assert.ok(D.items['seed_' + k], 'seed item for ' + k);
    assert.ok(c.season >= 0 && c.season <= 3, k + ' season');
    assert.ok(c.days > 0 && c.days <= 12, k + ' grow days');
  }
  for (const f of D.fish) {
    assert.equal(D.items[f.id].type, 'fish', f.id);
    f.seasons.forEach((s) => assert.ok(s >= 0 && s <= 3));
  }
  for (const list of Object.values(D.forage)) {
    list.forEach((id) => assert.equal(D.items[id].type, 'forage', id));
  }
});

test('every item referenced by villagers, shops, smithy and projects exists', () => {
  const need = [];
  D.npcs.forEach((n) => need.push(...n.loves, ...n.likes, ...n.hates));
  Object.values(D.shops).forEach((s) => (s.stock || []).forEach((x) => need.push(x.id)));
  D.smelt.forEach((r) => need.push(r.out, r.from));
  D.upgradeCost.forEach((c) => need.push(c.bar));
  D.projects.forEach((p) => p.reqs.forEach((r) => { if (r.item) need.push(r.item); }));
  for (const id of need) assert.ok(D.items[id], 'missing item ' + id);
});

test('every villager has a valid shop kind and a home area', () => {
  for (const n of D.npcs) {
    if (n.shop) assert.ok(D.shops[n.shop], n.name + ' shop ' + n.shop);
    assert.ok(W.area(n.home.area), n.name + ' home area');
  }
  assert.equal(D.npcs.length, new Set(D.npcs.map((n) => n.id)).size, 'unique npc ids');
});

test('projects are unique and the last one ends the game', () => {
  const ids = D.projects.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[ids.length - 1], 'festival');
  assert.equal(D.projects.length, 8);
});

test('breakable tiles are solid and map to real drops', () => {
  for (const [ch, spec] of Object.entries(D.breakable)) {
    assert.ok(solid(ch), ch + ' should be solid');
    assert.ok(D.items[spec.drop], ch + ' drops ' + spec.drop);
    assert.ok(['pick', 'axe'].includes(spec.tool));
  }
});

test('tool tiers are complete (base, copper, iron) for every tool kind', () => {
  for (const kind of Object.keys(D.TOOLS)) {
    for (let t = 0; t < 3; t++) {
      const it = D.items[kind + '_' + t];
      assert.ok(it, kind + '_' + t);
      assert.equal(it.tier, t);
    }
  }
});
