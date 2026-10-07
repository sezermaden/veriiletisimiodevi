/* Game state and systems: time, movement, farming, fishing, mining, combat, villagers, shops, projects, saving. */
(function () {
  var C = EF.C, U = EF.util, D = EF.D, W = EF.world, IN = EF.input, UI = EF.ui, AU = EF.audio, R = EF.render;
  var G = EF.game = { state: null, rt: {} };

  var PLAYER_LOOK = { hair: '#5a3a22', shirt: '#3f7fd9', pants: '#2d3a52', skin: '#f2c6a0' };
  var MOB = {
    slime: { hp: 12, dmg: 5, speed: 1.1, r: 0.3, drop: 'slime_gel', chance: 0.6 },
    bat:   { hp: 8,  dmg: 4, speed: 2.1, r: 0.25, drop: 'bat_wing', chance: 0.4 },
    golem: { hp: 40, dmg: 10, speed: 0.75, r: 0.4, drop: 'golem_core', chance: 0.6 }
  };

  function freshRT() {
    return { tpl: null, cam: { x: 0, y: 0 }, fish: null, texts: [], swing: 0, invuln: 0, fade: 0,
             banner: null, walkT: 0, walkFrame: 0, moving: false };
  }
  G.rt = freshRT();

  function freshState() {
    var s = {
      v: 1, day: 1, season: 0, year: 1, minutes: C.DAY_START, weather: 'sunny',
      gold: C.START_GOLD, energy: C.MAX_ENERGY, health: C.MAX_HEALTH, water: D.CAN_CAPACITY[0],
      sel: 0, inv: [],
      p: { area: 'house', x: 5.5, y: 6.5, fx: 0, fy: -1 },
      grids: {}, soil: {}, crops: {}, forage: {}, mobs: {}, hits: {},
      friends: {}, spouse: null, projects: {},
      stats: { caught: 0, harvested: 0, mined: 0, kills: 0, shipped: 0 },
      ended: false
    };
    for (var i = 0; i < C.INV_SIZE; i++) s.inv.push(null);
    s.inv[0] = { id: 'hoe_0', qty: 1 };
    s.inv[1] = { id: 'can_0', qty: 1 };
    s.inv[2] = { id: 'axe_0', qty: 1 };
    s.inv[3] = { id: 'pick_0', qty: 1 };
    s.inv[4] = { id: 'sword_0', qty: 1 };
    s.inv[5] = { id: 'rod_0', qty: 1 };
    s.inv[6] = { id: 'seed_turnip', qty: 12 };
    s.inv[7] = { id: 'bread', qty: 2 };
    return s;
  }

  function st() { return G.state; }

  // ---------- areas and tiles ----------
  function ensureArea(id) {
    var s = st(), tpl = W.area(id);
    if (!s.grids[id]) s.grids[id] = tpl.rows.map(function (r) { return r.split(''); });
    if (!s.soil[id]) s.soil[id] = {};
    if (!s.crops[id]) s.crops[id] = {};
    if (!s.forage[id]) s.forage[id] = {};
    if (!s.hits[id]) s.hits[id] = {};
    if (!s.mobs[id]) {
      var floor = /^mine(\d)$/.exec(id);
      s.mobs[id] = (tpl.spawns || []).map(function (sp) { return makeMob(sp, floor ? +floor[1] : 1); });
    }
    return tpl;
  }

  function makeMob(sp, floor) {
    var base = MOB[sp.type], scale = 1 + (floor - 1) * 0.1;
    var hp = Math.round(base.hp * scale);
    return { type: sp.type, x: sp.x, y: sp.y, hp: hp, maxHp: hp, dmg: Math.round(base.dmg * scale),
             speed: base.speed, r: base.r, t: 0, vx: 0, vy: 0, hit: 0, dead: false };
  }

  G.grid = function (id) { ensureArea(id); return st().grids[id]; };
  G.soil = function (id) { ensureArea(id); return st().soil[id]; };
  G.crops = function (id) { ensureArea(id); return st().crops[id]; };
  G.forage = function (id) { ensureArea(id); return st().forage[id]; };
  G.mobsOf = function (id) { ensureArea(id); return st().mobs[id]; };
  G.playerLook = function () { return PLAYER_LOOK; };

  function tileAt(areaId, x, y) {
    var g = G.grid(areaId);
    if (y < 0 || x < 0 || y >= g.length || x >= g[0].length) return 'T';
    return g[y][x];
  }
  function setTile(areaId, x, y, ch) { G.grid(areaId)[y][x] = ch; }
  function inRect(r, x, y) { return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h; }

  function enterRuntimeArea(id) {
    G.rt.tpl = ensureArea(id);
    AU.music(G.rt.tpl.music);
  }

  // ---------- NPCs ----------
  function npcLocation(npc) {
    var s = st();
    var h = Math.floor(s.minutes / 60);
    if (s.spouse === npc.id) {
      return (h >= 6 && h < 18) ? { area: 'farm', x: 20, y: 14 } : { area: 'house', x: 3, y: 6 };
    }
    for (var i = 0; i < npc.sched.length; i++) {
      var e = npc.sched[i];
      if (h >= e.from && h < e.to) return e;
    }
    return npc.home;
  }

  G.npcsIn = function (areaId) {
    var s = st(), out = [];
    D.npcs.forEach(function (npc) {
      var loc = npcLocation(npc);
      if (loc.area !== areaId) return;
      var dx = s.p.x - (loc.x + 0.5), dy = s.p.y - (loc.y + 0.5);
      var face = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
      out.push({ npc: npc, x: loc.x + 0.5, y: loc.y + 0.5, cx: loc.x, cy: loc.y, face: face });
    });
    return out;
  };

  function npcAt(areaId, cx, cy) {
    var list = G.npcsIn(areaId);
    for (var i = 0; i < list.length; i++) {
      if (list[i].cx === cx && list[i].cy === cy) return list[i].npc;
    }
    return null;
  }

  function friend(id) {
    var s = st();
    if (!s.friends[id]) s.friends[id] = { pts: 0, met: false, talked: false, gifted: false };
    return s.friends[id];
  }
  function hearts(id) { return Math.floor(friend(id).pts / C.POINTS_PER_HEART); }
  function addPts(id, n) {
    var f = friend(id), before = hearts(id);
    f.pts = U.clamp(f.pts + n, 0, C.POINTS_PER_HEART * C.MAX_HEARTS);
    if (hearts(id) > before) {
      AU.sfx('heart');
      UI.toast('Friendship grew: ' + hearts(id) + ' hearts!');
    }
  }

  // ---------- inventory ----------
  G.addItem = function (id, qty) {
    var s = st(), def = D.items[id];
    qty = qty || 1;
    if (def.type !== 'tool') {
      for (var i = 0; i < s.inv.length && qty > 0; i++) {
        var slot = s.inv[i];
        if (slot && slot.id === id && slot.qty < C.MAX_STACK) {
          var add = Math.min(C.MAX_STACK - slot.qty, qty);
          slot.qty += add;
          qty -= add;
        }
      }
    }
    for (var j = 0; j < s.inv.length && qty > 0; j++) {
      if (!s.inv[j]) {
        if (def.type === 'tool') {
          s.inv[j] = { id: id, qty: 1 };
          qty -= 1;
        } else {
          var put = Math.min(C.MAX_STACK, qty);
          s.inv[j] = { id: id, qty: put };
          qty -= put;
        }
      }
    }
    return qty;
  };
  G.countItem = function (id) {
    return st().inv.reduce(function (n, slot) { return n + (slot && slot.id === id ? slot.qty : 0); }, 0);
  };
  G.removeItem = function (id, qty) {
    var s = st();
    for (var i = 0; i < s.inv.length && qty > 0; i++) {
      var slot = s.inv[i];
      if (slot && slot.id === id) {
        var take = Math.min(slot.qty, qty);
        slot.qty -= take;
        qty -= take;
        if (slot.qty <= 0) s.inv[i] = null;
      }
    }
  };
  function removeSlot(i, qty) {
    var s = st(), slot = s.inv[i];
    if (!slot) return;
    slot.qty -= qty || 1;
    if (slot.qty <= 0) s.inv[i] = null;
  }

  function floatText(text, cx, cy, color) {
    G.rt.texts.push({ text: text, x: cx + 0.5, y: cy + 0.3, t: 1.2, color: color });
  }

  function spend(cost) {
    var s = st();
    if (s.energy < cost) {
      UI.toast('You are too tired. Sleep to recover energy.');
      AU.sfx('error');
      return false;
    }
    s.energy -= cost;
    return true;
  }

  // ---------- movement and warps ----------
  function solidAt(areaId, cx, cy) {
    return W.isSolid(tileAt(areaId, cx, cy));
  }

  function blockedBox(areaId, x, y, r, isPlayer) {
    var pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]];
    for (var i = 0; i < pts.length; i++) {
      var cx = Math.floor(pts[i][0]), cy = Math.floor(pts[i][1]);
      if (solidAt(areaId, cx, cy)) return true;
      if (isPlayer && npcAt(areaId, cx, cy)) return true;
    }
    return false;
  }

  // Moves an entity axis by axis so it slides along walls. Returns true if it moved.
  function moveBody(areaId, ent, dx, dy, isPlayer) {
    var moved = false;
    if (dx && !blockedBox(areaId, ent.x + dx, ent.y, ent.r || 0.3, isPlayer)) { ent.x += dx; moved = true; }
    if (dy && !blockedBox(areaId, ent.x, ent.y + dy, ent.r || 0.3, isPlayer)) { ent.y += dy; moved = true; }
    return moved;
  }

  function travel(to) {
    var s = st();
    var lock = W.lockMessage(to.area, s.projects);
    if (lock) return lock;
    s.p.area = to.area;
    s.p.x = to.x + 0.5;
    s.p.y = to.y + 0.5;
    enterRuntimeArea(to.area);
    G.rt.fade = 0.35;
    return null;
  }

  function travelHome() {
    var s = st();
    s.p.area = 'house';
    s.p.x = 5.5;
    s.p.y = 6.5;
    s.p.fx = 0;
    s.p.fy = -1;
    enterRuntimeArea('house');
    G.rt.fade = 0.5;
  }

  function checkWarp() {
    var s = st();
    var cx = Math.floor(s.p.x), cy = Math.floor(s.p.y);
    var to = G.rt.tpl.warps[U.key(cx, cy)];
    if (!to) return;
    var lock = travel(to);
    if (lock) {
      UI.toast(lock);
      AU.sfx('error');
      s.p.x -= s.p.fx * 1.05;
      s.p.y -= s.p.fy * 1.05;
    }
  }

  function updatePlayer(dt) {
    var s = st(), dx = 0, dy = 0;
    if (IN.held('left')) dx -= 1;
    if (IN.held('right')) dx += 1;
    if (IN.held('up')) dy -= 1;
    if (IN.held('down')) dy += 1;
    G.rt.moving = false;
    if (!dx && !dy) return;
    if (Math.abs(dx) >= Math.abs(dy)) { s.p.fx = dx > 0 ? 1 : -1; s.p.fy = 0; }
    else { s.p.fx = 0; s.p.fy = dy > 0 ? 1 : -1; }
    var len = Math.hypot(dx, dy), sp = C.WALK_SPEED * dt / len;
    var moved = moveBody(s.p.area, s.p, dx * sp, dy * sp, true);
    G.rt.moving = moved;
    if (moved) {
      G.rt.walkT += dt;
      G.rt.walkFrame = (Math.floor(G.rt.walkT * 7) % 2) + 1;
      var key = U.key(Math.floor(s.p.x), Math.floor(s.p.y));
      var fg = s.forage[s.p.area] && s.forage[s.p.area][key];
      if (fg) {
        delete s.forage[s.p.area][key];
        var left = G.addItem(fg, 1);
        if (!left) floatText('+1 ' + D.items[fg].name, Math.floor(s.p.x), Math.floor(s.p.y), '#c8ffb0');
        else UI.toast('Your pack is full.');
      }
      checkWarp();
    }
  }

  function facingCell() {
    var s = st();
    return { x: Math.floor(s.p.x) + s.p.fx, y: Math.floor(s.p.y) + s.p.fy };
  }

  // ---------- interactions (Z / confirm) ----------
  function interact() {
    var s = st(), f = facingCell(), area = s.p.area, ch = tileAt(area, f.x, f.y), k = U.key(f.x, f.y);
    var npc = npcAt(area, f.x, f.y);
    if (npc) return talkTo(npc);
    if (ch === 'B') return sleepPrompt();
    var crop = s.crops[area][k];
    if (crop) {
      if (crop.days >= D.crops[crop.id].days) return harvest(area, k, crop);
      return UI.toast(D.crops[crop.id].name + ' is still growing.');
    }
    if (ch === 'N') return openBoard();
    if (ch === 'J') return UI.say(W.SIGNS[area] || 'A weathered sign.');
    if (ch === 'W') {
      s.water = canCapacity();
      AU.sfx('water');
      return UI.toast('You fill up at the well.');
    }
    if (ch === 'Q') return UI.toast('The bridge is broken. Restore it on the Restoration Board.');
    if (ch === 'w') return UI.toast('Equip a Fishing Rod and press X while facing water.');
    if (ch === 'E') return UI.toast('A cluttered table with a half-finished letter.');
    if (ch === 'C') return UI.toast('Crates of old supplies.');
  }

  function harvest(area, k, crop) {
    var s = st(), def = D.crops[crop.id];
    var got = Math.random() < 0.2 ? 2 : 1;
    G.addItem(crop.id, got);
    delete s.crops[area][k];
    s.stats.harvested++;
    AU.sfx('harvest');
    UI.toast('Harvested ' + def.name + ' x' + got + '.');
  }

  // ---------- item use (X) ----------
  function selItem() { return st().inv[st().sel]; }

  function useItem() {
    var s = st(), slot = selItem();
    if (!slot) return UI.toast('Nothing selected.');
    var def = D.items[slot.id];
    if (def.type === 'tool') return useTool(def);
    if (def.type === 'seed') return plant(def);
    if (def.type === 'food') return eatSlot(s.sel);
    UI.toast(def.name + ' is for villagers. Talk to someone (Z) to give it.');
  }

  function useTool(def) {
    var s = st(), f = facingCell(), area = s.p.area, ch = tileAt(area, f.x, f.y), k = U.key(f.x, f.y);
    var cost = Math.max(1, D.TOOLS[def.kind].energy - def.tier);
    if (def.kind === 'sword') {
      if (!spend(cost)) return;
      return swing(def);
    }
    if (def.kind === 'rod') {
      if (ch !== 'w' || !G.rt.tpl.fishable) return UI.toast('Face the lake water to fish.');
      if (!spend(cost)) return;
      return startFishing(f, def);
    }
    if (def.kind === 'can') {
      if (ch === 'w' || ch === 'W') {
        s.water = D.CAN_CAPACITY[def.tier];
        AU.sfx('water');
        return UI.toast('Watering can refilled.');
      }
      var sl = s.soil[area][k];
      if (!sl) return UI.toast('Water the tilled soil.');
      if (s.water <= 0) return UI.toast('The watering can is empty. Refill it at water.');
      if (!spend(cost)) return;
      s.water--;
      sl.watered = true;
      AU.sfx('water');
      return floatText('~', f.x, f.y, '#9fd8ff');
    }
    if (def.kind === 'hoe') {
      var tpl = G.rt.tpl;
      if (!tpl.farmRect || !inRect(tpl.farmRect, f.x, f.y) || ch !== '.' || s.soil[area][k] || s.crops[area][k]) {
        return UI.toast('Till open grass inside the fields.');
      }
      if (!spend(cost)) return;
      s.soil[area][k] = { watered: false };
      AU.sfx('till');
      return;
    }
    if (def.kind === 'axe' || def.kind === 'pick') {
      var spec = D.breakable[ch];
      if (!spec || spec.tool !== def.kind) return UI.toast(def.kind === 'axe' ? 'Only trees can be chopped with an axe.' : 'Your pickaxe cannot break that.');
      if (def.tier < spec.tier) return UI.toast('You need a stronger pickaxe for this ore.');
      if (!spend(cost)) return;
      return hitBreakable(area, f, ch, spec, def);
    }
  }

  function hitBreakable(area, f, ch, spec, def) {
    var s = st(), k = U.key(f.x, f.y);
    var hits = (s.hits[area][k] || 0) + 1;
    var need = Math.max(1, spec.hits - def.tier);
    AU.sfx(def.kind === 'axe' ? 'chop' : 'pick');
    if (hits < need) {
      s.hits[area][k] = hits;
      return floatText('*', f.x, f.y, '#ffffff');
    }
    delete s.hits[area][k];
    var mine = area.indexOf('mine') === 0;
    setTile(area, f.x, f.y, mine ? 'g' : '.');
    var qty = U.randInt(spec.min, spec.max);
    var left = G.addItem(spec.drop, qty);
    if (def.kind === 'pick') s.stats.mined++;
    floatText('+' + (qty - left) + ' ' + D.items[spec.drop].name, f.x, f.y, '#fff3d0');
    if (left) UI.toast('Your pack is full.');
  }

  function plant(def) {
    var s = st(), f = facingCell(), area = s.p.area, k = U.key(f.x, f.y);
    if (!s.soil[area] || !s.soil[area][k]) return UI.toast('Plant seeds in tilled soil.');
    if (s.crops[area][k]) return UI.toast('Something is already growing here.');
    var cdef = D.crops[def.crop];
    if (cdef.season !== s.season) return UI.toast(cdef.name + ' only grows in ' + C.SEASONS[cdef.season] + '.');
    s.crops[area][k] = { id: def.crop, days: 0 };
    removeSlot(s.sel, 1);
    AU.sfx('select');
  }

  function eatSlot(i) {
    var s = st(), slot = s.inv[i];
    if (!slot) return;
    var def = D.items[slot.id];
    if (def.type !== 'food') return UI.toast('You cannot eat that.');
    s.energy = Math.min(C.MAX_ENERGY, s.energy + (def.energy || 0));
    s.health = Math.min(C.MAX_HEALTH, s.health + (def.health || 0));
    removeSlot(i, 1);
    AU.sfx('harvest');
    UI.toast('Mmm, ' + def.name.toLowerCase() + '. Energy restored.');
  }

  // ---------- combat ----------
  function swing(def) {
    var s = st(), rt = G.rt, area = s.p.area;
    rt.swing = 0.22;
    AU.sfx('slash');
    var dmg = D.SWORD_DAMAGE[def.tier];
    var list = G.mobsOf(area) || [];
    var hitAny = false;
    list.forEach(function (m) {
      if (m.dead) return;
      var dx = m.x - s.p.x, dy = m.y - s.p.y, d = Math.hypot(dx, dy) || 0.001;
      if (d > 1.6) return;
      if ((dx / d) * s.p.fx + (dy / d) * s.p.fy < 0.4) return;
      hitAny = true;
      m.hp -= dmg;
      m.hit = 0.2;
      moveBody(area, m, s.p.fx * 0.35, s.p.fy * 0.35, false);
      floatText(String(dmg), m.x - 0.5, m.y - 0.8, '#ffb3a8');
      if (m.hp <= 0) killMob(m);
      else AU.sfx('hit');
    });
    if (!hitAny) AU.sfx('select');
  }

  function killMob(m) {
    var s = st(), info = MOB[m.type];
    m.dead = true;
    s.stats.kills++;
    AU.sfx('coin');
    if (Math.random() < info.chance) {
      G.addItem(info.drop, 1);
      floatText('+1 ' + D.items[info.drop].name, m.x, m.y, '#c8ffb0');
    }
  }

  function damagePlayer(amount) {
    var s = st();
    G.rt.invuln = 1.0;
    s.health = Math.max(0, s.health - amount);
    AU.sfx('hurt');
    floatText('-' + amount, s.p.x, s.p.y - 0.6, '#ff8a80');
    if (s.health <= 0) passOut('Your strength gave out in the mines.');
  }

  function updateMobs(dt) {
    var s = st(), area = s.p.area, list = G.mobsOf(area);
    if (!list || !list.length) return;
    list.forEach(function (m) {
      if (m.dead) return;
      m.hit = Math.max(0, m.hit - dt);
      var dx = s.p.x - m.x, dy = s.p.y - m.y, d = Math.hypot(dx, dy) || 0.001;
      var ux = dx / d, uy = dy / d;
      if (m.type === 'bat') {
        m.t -= dt;
        if (m.t <= 0) {
          m.t = U.rand(0.5, 1.1);
          var ang = U.rand(0, Math.PI * 2);
          m.vx = Math.cos(ang);
          m.vy = Math.sin(ang);
        }
        if (d < 4.5) { m.vx = ux; m.vy = uy; }
        moveBody(area, m, m.vx * m.speed * dt, m.vy * m.speed * dt, false);
      } else if (m.type === 'slime') {
        if (d < 5) {
          moveBody(area, m, ux * m.speed * dt, uy * m.speed * dt, false);
        } else {
          m.t -= dt;
          if (m.t <= 0) {
            m.t = U.rand(1, 2.5);
            m.vx = U.rand(-1, 1);
            m.vy = U.rand(-1, 1);
          }
          moveBody(area, m, m.vx * 0.4 * dt, m.vy * 0.4 * dt, false);
        }
      } else if (d < 6) {
        moveBody(area, m, ux * m.speed * dt, uy * m.speed * dt, false);
      }
      if (d < 0.75 && G.rt.invuln <= 0) damagePlayer(m.dmg);
    });
    s.mobs[area] = list.filter(function (m) { return !m.dead; });
  }

  // ---------- fishing ----------
  function startFishing(cell, rod) {
    G.rt.fish = {
      phase: 'cast', t: 0, wait: U.rand(2, 5) * D.ROD_BITE[rod.tier], cx: cell.x, cy: cell.y,
      marker: 0.5, zc: 0.35, zw: D.ROD_ZONE[rod.tier], prog: 0.35, speed: 1, ph: 0, fish: null
    };
    AU.sfx('cast');
  }

  function pickFish() {
    var s = st();
    var pool = D.fish.filter(function (f) { return f.seasons.indexOf(s.season) >= 0; });
    if (!pool.length) return D.fish[1];
    var total = pool.reduce(function (n, f) { return n + f.weight; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function updateFishing(dt) {
    var f = G.rt.fish;
    if (IN.pressed('cancel') || IN.pressed('menu')) {
      IN.consume('cancel');
      IN.consume('menu');
      G.rt.fish = null;
      UI.toast('You reel in your line.');
      return;
    }
    if (f.phase === 'cast') {
      f.t += dt;
      if (f.t >= f.wait) {
        f.phase = 'bite';
        f.t = 0;
        AU.sfx('bite');
      }
    } else if (f.phase === 'bite') {
      f.t += dt;
      if (IN.pressed('use') || IN.pressed('confirm')) {
        IN.consume('use');
        IN.consume('confirm');
        f.phase = 'reel';
        f.t = 0;
        f.fish = pickFish();
        f.speed = f.fish.speed;
        f.ph = Math.random() * 6;
        f.prog = 0.35;
        f.zc = 0.35;
        AU.sfx('splash');
      } else if (f.t > 1.4) {
        G.rt.fish = null;
        AU.sfx('lost');
        UI.toast('Nothing took the bait.');
      }
    } else if (f.phase === 'reel') {
      f.t += dt;
      var holding = IN.held('use') || IN.held('confirm');
      f.zc = U.clamp(f.zc + (holding ? 0.9 : -0.7) * dt, 0, 1 - f.zw);
      f.marker = U.clamp(0.5 + 0.45 * Math.sin(f.t * f.speed * 2.2 + f.ph) + 0.1 * Math.sin(f.t * f.speed * 5.3), 0, 1);
      var inZone = f.marker >= f.zc && f.marker <= f.zc + f.zw;
      f.prog = U.clamp(f.prog + (inZone ? 0.42 : -0.26) * dt, 0, 1);
      if (f.prog >= 1) {
        catchFish(f.fish);
        G.rt.fish = null;
      } else if (f.prog <= 0 || f.t > 25) {
        AU.sfx('lost');
        UI.toast('The ' + f.fish.name + ' got away.');
        G.rt.fish = null;
      }
    }
  }

  function catchFish(fish) {
    var s = st();
    var left = G.addItem(fish.id, 1);
    s.stats.caught++;
    AU.sfx('catch');
    UI.toast(left ? 'Your pack is full. The ' + fish.name + ' slipped away.' : 'You caught a ' + fish.name + '!');
  }

  // ---------- villagers ----------
  function talkTo(npc) {
    var s = st(), items = [];
    items.push({ label: 'Talk', fn: function () { UI.pop(); talkLines(npc); } });
    items.push({ label: 'Give a gift', fn: function () { UI.pop(); openGift(npc); } });
    if (npc.shop) items.push({ label: shopLabel(npc), fn: function () { UI.pop(); openShop(npc); } });
    if (npc.romance && hearts(npc.id) >= 10 && !s.spouse && G.countItem('bouquet') > 0) {
      items.push({ label: 'Propose (bouquet)', fn: function () { UI.pop(); propose(npc); } });
    }
    items.push({ label: 'Goodbye', fn: function () { UI.pop(); } });
    UI.list({ title: npc.name, width: 230, items: items, footer: 'Z: choose   B: back' });
  }

  function shopLabel(npc) {
    return { general: 'Browse the store', bakery: 'Browse the bakery', florist: 'Browse the flowers',
             smithy: 'Upgrades and smelting', fish: 'Sell your fish' }[npc.shop];
  }

  function talkLines(npc) {
    var s = st(), f = friend(npc.id);
    if (!f.met) {
      f.met = true;
      addPts(npc.id, 20);
      return UI.say(npc.intro, { speaker: npc.name });
    }
    if (s.spouse === npc.id) return UI.say([U.pick(D.spouseTalk)], { speaker: npc.name });
    if (!f.talked) {
      f.talked = true;
      addPts(npc.id, 20);
    }
    UI.say([pickTalk(npc)], { speaker: npc.name });
  }

  function pickTalk(npc) {
    var h = hearts(npc.id), tier = h < 4 ? 'low' : (h < 8 ? 'mid' : 'high');
    if (npc.story && Math.random() < 0.5) {
      var done = projectCount(), line = null;
      npc.story.forEach(function (x) { if (done >= x.at) line = x.text; });
      if (line) return line;
    }
    return U.pick(npc.talk[tier]);
  }

  function openGift(npc) {
    UI.inventory({
      title: 'Give to ' + npc.name, mode: 'pick', hint: 'Z: give   B: back',
      slots: function () { return st().inv; },
      onPick: function (i) { giveGift(npc, i); }
    });
  }

  function reaction(npc, id) {
    if (npc.loves.indexOf(id) >= 0) return 'loved';
    if (npc.likes.indexOf(id) >= 0) return 'liked';
    if (npc.hates.indexOf(id) >= 0) return 'hated';
    return 'neutral';
  }

  function giveGift(npc, i) {
    var s = st(), slot = s.inv[i];
    if (!slot) return;
    var f = friend(npc.id);
    if (f.gifted) return UI.say(['You already gave me something today. That is plenty.'], { speaker: npc.name });
    var kind = reaction(npc, slot.id);
    var gain = { loved: 80, liked: 45, neutral: 20, hated: -40 }[kind];
    removeSlot(i, 1);
    f.gifted = true;
    if (kind === 'hated') AU.sfx('hurt');
    addPts(npc.id, gain);
    UI.say([D.reactions[kind]], { speaker: npc.name });
  }

  function propose(npc) {
    UI.say(['Will you marry me?'], {
      speaker: npc.name,
      onDone: function () {
        UI.choose(npc.name, [
          { label: 'Yes', fn: function () { UI.pop(); marry(npc); } },
          { label: 'Not yet', fn: function () { UI.pop(); UI.say(['Then I will wait. Take your time.'], { speaker: npc.name }); } }
        ], { width: 200, noCancel: true });
      }
    });
  }

  function marry(npc) {
    var s = st();
    removeSlot(s.inv.findIndex(function (x) { return x && x.id === 'bouquet'; }), 1);
    s.spouse = npc.id;
    AU.sfx('fanfare');
    UI.say([
      'Yes! Yes, I will!',
      npc.name + ' moves into the farmhouse. Hollowmere cheers as the bells ring out.',
      'Your spouse will chat with you each morning and help water the fields.'
    ], { speaker: npc.name });
  }

  // ---------- shops ----------
  function sellPrice(def, npc) {
    var base = def.price || 0;
    if (npc && npc.shop === 'fish') return def.type === 'fish' ? Math.round(base * D.shops.fish.buyBonus) : 0;
    return base;
  }

  function buyPrice(price, npc) {
    if (npc.shop === 'bakery' && st().projects.oven) return Math.round(price * 0.85);
    return price;
  }

  function openShop(npc) {
    if (npc.shop === 'smithy') return openSmithy(npc);
    UI.choose(npc.name, [
      { label: 'Buy', fn: function () { UI.pop(); openBuyList(npc); } },
      { label: 'Sell', fn: function () { UI.pop(); openSellList(npc); } },
      { label: 'Leave', fn: function () { UI.pop(); } }
    ], { width: 180 });
  }

  function stockFor(npc) {
    var s = st();
    if (npc.shop === 'general') {
      return Object.keys(D.crops).filter(function (k) { return D.crops[k].season === s.season; })
        .map(function (k) { return { id: 'seed_' + k, price: D.crops[k].seedPrice }; });
    }
    var shop = D.shops[npc.shop];
    return shop && shop.stock ? shop.stock : [];
  }

  function openBuyList(npc) {
    UI.list({
      title: 'Buy', width: 300, footer: 'Z: buy one   B: back',
      build: function () {
        return stockFor(npc).map(function (it) {
          var price = buyPrice(it.price, npc), def = D.items[it.id];
          return { label: def.name, sub: price + 'g', fn: function () {
            var s = st();
            if (s.gold < price) return UI.toast('Not enough gold.');
            if (G.addItem(it.id, 1)) return UI.toast('Your pack is full.');
            s.gold -= price;
            AU.sfx('coin');
          } };
        });
      }
    });
  }

  function openSellList(npc) {
    UI.list({
      title: 'Sell', width: 320, footer: 'Z: sell one   X: sell all   B: back',
      build: function () {
        var out = [];
        st().inv.forEach(function (slot, i) {
          if (!slot) return;
          var def = D.items[slot.id], price = sellPrice(def, npc);
          if (!price) return;
          out.push({
            label: def.name + (slot.qty > 1 ? ' x' + slot.qty : ''), sub: price + 'g',
            fn: function () { sellSlot(i, 1, price); },
            alt: function () { sellSlot(i, st().inv[i] ? st().inv[i].qty : 0, price); }
          });
        });
        return out;
      }
    });
  }

  function sellSlot(i, qty, price) {
    var s = st(), slot = s.inv[i];
    if (!slot || qty <= 0) return;
    qty = Math.min(qty, slot.qty);
    removeSlot(i, qty);
    s.gold += price * qty;
    s.stats.shipped += qty;
    AU.sfx('coin');
  }

  function openSmithy(npc) {
    UI.choose(npc.name, [
      { label: 'Upgrade a tool', fn: function () { UI.pop(); openUpgrades(); } },
      { label: 'Smelt ore into bars', fn: function () { UI.pop(); openSmelting(); } },
      { label: 'Leave', fn: function () { UI.pop(); } }
    ], { width: 200 });
  }

  function openUpgrades() {
    UI.list({
      title: 'Upgrades', width: 340, footer: 'Z: upgrade   B: back',
      build: function () {
        var s = st(), out = [];
        s.inv.forEach(function (slot, i) {
          if (!slot) return;
          var def = D.items[slot.id];
          if (def.type !== 'tool' || def.tier >= 2) return;
          var cost = D.upgradeCost[def.tier];
          var have = G.countItem(cost.bar), ok = have >= cost.qty && s.gold >= cost.gold;
          out.push({
            label: def.name, sub: cost.qty + ' ' + D.items[cost.bar].name + ' + ' + cost.gold + 'g',
            disabled: !ok,
            fn: function () { upgradeTool(i, cost); }
          });
        });
        if (!out.length) out.push({ label: 'Nothing to upgrade yet.', disabled: true });
        return out;
      }
    });
  }

  function upgradeTool(i, cost) {
    var s = st(), slot = s.inv[i], def = D.items[slot.id];
    G.removeItem(cost.bar, cost.qty);
    s.gold -= cost.gold;
    slot.id = def.kind + '_' + (def.tier + 1);
    AU.sfx('craft');
    UI.toast(D.items[slot.id].name + ' is ready!');
  }

  function openSmelting() {
    UI.list({
      title: 'Smelting', width: 340, footer: 'Z: smelt   B: back',
      build: function () {
        var s = st();
        return D.smelt.map(function (r) {
          var ok = G.countItem(r.from) >= r.qty && s.gold >= r.gold;
          return {
            label: r.qty + ' ' + D.items[r.from].name, sub: '-> ' + D.items[r.out].name + ' (' + r.gold + 'g)',
            disabled: !ok,
            fn: function () {
              G.removeItem(r.from, r.qty);
              s.gold -= r.gold;
              G.addItem(r.out, 1);
              AU.sfx('craft');
              UI.toast('Smelted a ' + D.items[r.out].name + '.');
            }
          };
        });
      }
    });
  }

  // ---------- restoration board and projects ----------
  function projectCount() {
    var s = st();
    return Object.keys(s.projects).filter(function (k) { return s.projects[k]; }).length;
  }

  function canDonate(p) {
    var s = st();
    return p.reqs.every(function (r) {
      return r.gold ? s.gold >= r.gold : G.countItem(r.item) >= r.qty;
    });
  }

  function openBoard() {
    UI.list({
      title: 'Restoration Board', subtitle: projectCount() + ' of ' + D.projects.length + ' restored',
      width: 340, footer: 'Z: details   B: close',
      build: function () {
        var s = st();
        return D.projects.map(function (p) {
          var status = s.projects[p.id] ? 'Done' : (canDonate(p) ? 'Ready!' : 'Needs items');
          return { label: p.title, sub: status, fn: function () { openProject(p); } };
        });
      }
    });
  }

  function openProject(p) {
    UI.say(p.desc, { speaker: 'Board', onDone: function () {
      UI.list({
        title: p.title, width: 340, footer: 'Z: donate   B: back',
        build: function () {
          var s = st(), items = p.reqs.map(function (r) {
            if (r.gold) return { label: 'Gold', sub: s.gold + ' / ' + r.gold, disabled: true, fn: function () {} };
            var name = D.items[r.item].name;
            return { label: name, sub: Math.min(G.countItem(r.item), r.qty) + ' / ' + r.qty, disabled: true, fn: function () {} };
          });
          if (s.projects[p.id]) items.push({ label: 'Already restored', disabled: true, fn: function () {} });
          else items.push({ label: 'Donate', disabled: !canDonate(p), fn: function () { UI.pop(); donate(p); } });
          return items;
        }
      });
    } });
  }

  function donate(p) {
    var s = st();
    if (s.projects[p.id]) return;
    if (!canDonate(p)) {
      AU.sfx('error');
      return UI.toast('You do not have everything yet.');
    }
    p.reqs.forEach(function (r) {
      if (r.gold) s.gold -= r.gold;
      else G.removeItem(r.item, r.qty);
    });
    s.projects[p.id] = true;
    AU.sfx('fanfare');
    applyProject(p.id);
    UI.say(p.done, { speaker: 'Hollowmere', onDone: p.id === 'festival' ? showEnding : null });
  }

  function applyProject(id) {
    var s = st();
    if (id === 'bridge') {
      ensureArea('town');
      var g = s.grids.town;
      for (var y = 0; y < g.length; y++) {
        for (var x = 0; x < g[y].length; x++) {
          if (g[y][x] === 'Q') g[y][x] = 'b';
        }
      }
    }
    if (id === 'festival') s.ended = true;
  }

  function showEnding() {
    UI.credits([
      'EMBERFIELD VALLEY',
      '',
      'Hollowmere is whole again.',
      '',
      'The lanterns float over the valley,',
      'the lake is open, and the mines are safe.',
      '',
      'Thank you for restoring the valley.',
      'You may keep farming, fishing and exploring.',
      '',
      'Press Z to continue.'
    ]);
  }

  // ---------- journal and menus ----------
  function openJournal() {
    UI.choose('Journal', [
      { label: 'Friendships', fn: function () {
        UI.list({ title: 'Friendships', width: 340, footer: 'B: back', build: function () {
          return D.npcs.map(function (n) {
            var tag = st().spouse === n.id ? ' (spouse)' : '';
            return { label: n.name, sub: hearts(n.id) + '/' + C.MAX_HEARTS + ' hearts' + tag, fn: function () {} };
          });
        } });
      } },
      { label: 'Restoration', fn: function () {
        UI.list({ title: 'Restoration', width: 340, footer: 'B: back', build: function () {
          return D.projects.map(function (p) {
            return { label: p.title, sub: st().projects[p.id] ? 'Done' : 'Open', fn: function () {} };
          });
        } });
      } }
    ], { width: 220 });
  }

  function openInventory() {
    UI.inventory({
      title: 'Inventory', hint: 'Z: options   B: back',
      slots: function () { return st().inv; },
      actions: function (i) {
        var slot = st().inv[i], def = D.items[slot.id], out = [];
        if (def.type === 'food') out.push({ label: 'Eat', fn: function () { UI.pop(); eatSlot(i); } });
        if (def.type !== 'tool') out.push({ label: 'Discard one', fn: function () { UI.pop(); removeSlot(i, 1); UI.toast('Discarded.'); } });
        out.push({ label: 'Back', fn: function () { UI.pop(); } });
        return out;
      }
    });
  }

  function openOptions() {
    UI.list({
      title: 'Options', width: 240, footer: 'Z: toggle   B: back',
      build: function () {
        return [
          { label: 'Music', sub: AU.isOn('music') ? 'On' : 'Off', fn: function () { AU.toggle('music'); } },
          { label: 'Sound effects', sub: AU.isOn('sfx') ? 'On' : 'Off', fn: function () { AU.toggle('sfx'); } },
          { label: 'Controls', fn: showControls }
        ];
      }
    });
  }

  function showControls() {
    UI.say([
      'Move: arrow keys / WASD / left stick.   Talk, harvest, confirm: Z / Enter / A.',
      'Use the selected tool or item: X / X button.   Inventory: I / Y.   Hotbar: 1-0, Q/E or LB/RB.',
      'Pause menu: Esc / Tab / Start.   Back: B / Backspace.   Music toggle: M / Select.'
    ], { speaker: 'Controls' });
  }

  G.openPause = function () {
    UI.list({
      title: 'Paused', width: 200, footer: 'Z: select   B: resume',
      items: [
        { label: 'Resume', fn: function () { UI.pop(); } },
        { label: 'Inventory', fn: function () { UI.pop(); openInventory(); } },
        { label: 'Journal', fn: function () { UI.pop(); openJournal(); } },
        { label: 'Options', fn: function () { UI.pop(); openOptions(); } },
        { label: 'Save game', fn: function () { UI.toast(G.save() ? 'Game saved.' : 'Could not save.'); UI.pop(); } },
        { label: 'Title screen', fn: function () { G.save(); UI.clear(); G.openTitle(); } }
      ]
    });
  };

  G.openTitle = function () {
    AU.music('town');
    UI.list({
      style: 'title', width: 240, noCancel: true, footer: 'Z: select   Esc: pause in game',
      items: [
        { label: 'New Game', fn: function () { UI.clear(); G.newGame(); } },
        { label: 'Continue', disabled: !G.hasSave(), fn: function () {
          UI.clear();
          if (G.load()) { G.rt.banner = { text: 'Welcome back!', t: 2.5 }; }
          else { G.openTitle(); UI.toast('No save found.'); }
        } },
        { label: 'Controls', fn: showControls }
      ]
    });
  };

  // ---------- day cycle ----------
  function sleepPrompt() {
    UI.choose('Go to sleep?', [
      { label: 'Yes', fn: function () { UI.pop(); sleepNow(); } },
      { label: 'No', fn: function () { UI.pop(); } }
    ], { width: 180 });
  }

  function sleepNow() {
    AU.sfx('sleep');
    endDay(false);
    UI.say(['You sleep soundly. Morning light fills the room.'], { speaker: '' });
  }

  function passOut(reason) {
    var s = st();
    var lost = Math.floor(s.gold * 0.1);
    s.gold -= lost;
    endDay(true);
    travelHome();
    UI.say([reason, lost ? 'You woke up in bed, but lost ' + lost + 'g on the way home.' : 'You woke up in bed.'], { speaker: '' });
  }

  function rollWeather() {
    var s = st(), rain = [0.25, 0.15, 0.2, 0][s.season], r = Math.random();
    if (r < rain) return 'rain';
    if (r < rain + 0.2) return 'cloudy';
    return 'sunny';
  }

  function endDay(collapsed) {
    var s = st();
    // Watered crops grow; everything else waits.
    Object.keys(s.crops).forEach(function (area) {
      Object.keys(s.crops[area]).forEach(function (k) {
        var c = s.crops[area][k], sl = s.soil[area] && s.soil[area][k];
        if (sl && sl.watered && c.days < D.crops[c.id].days) c.days++;
      });
    });
    Object.keys(s.soil).forEach(function (area) {
      Object.keys(s.soil[area]).forEach(function (k) { s.soil[area][k].watered = false; });
    });

    s.day++;
    if (s.day > C.DAYS_PER_SEASON) {
      s.day = 1;
      s.season++;
      if (s.season >= C.SEASONS.length) {
        s.season = 0;
        s.year++;
      }
      seasonChanged();
    }
    s.minutes = C.DAY_START;
    s.energy = collapsed ? Math.round(C.MAX_ENERGY * 0.5) : C.MAX_ENERGY;
    s.health = C.MAX_HEALTH;
    s.water = canCapacity();

    D.npcs.forEach(function (n) {
      var f = friend(n.id);
      f.talked = false;
      f.gifted = false;
    });

    s.weather = rollWeather();
    if (s.weather === 'rain') {
      Object.keys(s.soil).forEach(function (area) {
        if (!W.area(area).outdoor) return;
        Object.keys(s.soil[area]).forEach(function (k) { s.soil[area][k].watered = true; });
      });
    }
    if (s.spouse) helpWater(3);

    spawnForageAll();
    G.save();
    G.rt.banner = { text: dayLabel(), t: 3 };
  }

  // Capacity of the best watering can the player owns.
  function canCapacity() {
    var best = 0;
    st().inv.forEach(function (slot) {
      if (slot && D.items[slot.id].kind === 'can') best = Math.max(best, D.items[slot.id].tier);
    });
    return D.CAN_CAPACITY[best];
  }

  function dayLabel() {
    var s = st();
    return C.SEASONS[s.season] + ' ' + s.day + ', Year ' + s.year;
  }

  function seasonChanged() {
    var s = st(), withered = 0;
    Object.keys(s.crops).forEach(function (area) {
      Object.keys(s.crops[area]).forEach(function (k) {
        if (D.crops[s.crops[area][k].id].season !== s.season) {
          delete s.crops[area][k];
          withered++;
        }
      });
    });
    if (withered) UI.toast(withered + ' crop' + (withered > 1 ? 's' : '') + ' withered with the change of season.');
  }

  function helpWater(n) {
    var s = st(), cells = [];
    Object.keys(s.soil.farm || {}).forEach(function (k) { cells.push(k); });
    for (var i = 0; i < n && cells.length; i++) {
      var k = cells.splice(Math.floor(Math.random() * cells.length), 1)[0];
      s.soil.farm[k].watered = true;
    }
  }

  function spawnForageAll() {
    var s = st();
    ['farm', 'forest'].forEach(function (area) {
      var tpl = ensureArea(area), g = s.grids[area], out = {};
      var target = area === 'forest' ? 12 : 4, list = D.forage[s.season];
      for (var tries = 0; tries < 600 && Object.keys(out).length < target; tries++) {
        var x = U.randInt(1, tpl.w - 2), y = U.randInt(1, tpl.h - 2), k = U.key(x, y);
        if (g[y][x] !== '.') continue;
        if (tpl.farmRect && inRect(tpl.farmRect, x, y)) continue;
        if (s.soil[area][k] || s.crops[area][k] || out[k]) continue;
        out[k] = U.pick(list);
      }
      s.forage[area] = out;
    });
  }

  // ---------- new game, save and load ----------
  G.newGame = function () {
    G.state = freshState();
    G.rt = freshRT();
    enterRuntimeArea('house');
    spawnForageAll();
    G.rt.banner = { text: dayLabel(), t: 3 };
    UI.say(D.intro, { speaker: '' });
  };

  G.hasSave = function () {
    try { return !!localStorage.getItem(C.SAVE_KEY); } catch (e) { return false; }
  };

  G.save = function () {
    try {
      var copy = JSON.parse(JSON.stringify(G.state));
      Object.keys(copy.grids).forEach(function (k) {
        copy.grids[k] = copy.grids[k].map(function (r) { return r.join(''); });
      });
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(copy));
      return true;
    } catch (e) {
      return false;
    }
  };

  G.load = function () {
    try {
      var raw = localStorage.getItem(C.SAVE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (data.v !== 1) return false;
      Object.keys(data.grids).forEach(function (k) {
        data.grids[k] = data.grids[k].map(function (r) { return r.split(''); });
      });
      G.state = data;
      G.rt = freshRT();
      enterRuntimeArea(data.p.area);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Jump to any area and exact position. Used by the browser tests and for debugging.
  G.teleport = function (area, x, y, fx, fy) {
    var s = st();
    travel({ area: area, x: Math.floor(x), y: Math.floor(y) });
    s.p.x = x;
    s.p.y = y;
    if (fx != null) {
      s.p.fx = fx;
      s.p.fy = fy;
    }
  };

  // ---------- main update / draw ----------
  G.update = function (dt) {
    var s = G.state, rt = G.rt;
    if (!s || UI.blocking()) return;

    rt.swing = Math.max(0, rt.swing - dt);
    rt.invuln = Math.max(0, rt.invuln - dt);
    rt.fade = Math.max(0, rt.fade - dt);
    if (rt.banner) {
      rt.banner.t -= dt;
      if (rt.banner.t <= 0) rt.banner = null;
    }
    rt.texts.forEach(function (t) { t.t -= dt; });
    rt.texts = rt.texts.filter(function (t) { return t.t > 0; });

    if (IN.pressed('mute')) {
      IN.consume('mute');
      UI.toast('Music ' + (AU.toggle('music') ? 'on' : 'off') + '.');
    }
    if (IN.pressed('menu') && !rt.fish) {
      IN.consume('menu');
      return G.openPause();
    }
    if (IN.pressed('inventory') && !rt.fish) {
      IN.consume('inventory');
      return openInventory();
    }

    if (s.energy <= 0) return passOut('You ran out of energy and collapsed.');
    s.minutes += dt / C.SECONDS_PER_MINUTE;
    if (s.minutes >= C.PASS_OUT_AT) return passOut('You stayed out past 2 AM and collapsed from exhaustion.');

    for (var i = 0; i < C.HOTBAR; i++) {
      if (IN.pressed('slot' + i)) s.sel = i;
    }
    if (IN.pressed('prev')) s.sel = (s.sel + C.HOTBAR - 1) % C.HOTBAR;
    if (IN.pressed('next')) s.sel = (s.sel + 1) % C.HOTBAR;

    if (rt.fish) {
      updateFishing(dt);
    } else {
      updatePlayer(dt);
      if (IN.pressed('confirm')) {
        IN.consume('confirm');
        interact();
      } else if (IN.pressed('use')) {
        IN.consume('use');
        useItem();
      }
    }
    updateMobs(dt);
  };

  G.draw = function (ctx, t) {
    ctx.imageSmoothingEnabled = false;
    if (!G.state || !G.rt.tpl) {
      drawTitleBackdrop(ctx, t);
      UI.draw(ctx);
      return;
    }
    R.drawWorld(ctx, G, t);
    R.drawHUD(ctx, G, t);
    UI.draw(ctx);
  };

  function drawTitleBackdrop(ctx, t) {
    var g = ctx.createLinearGradient(0, 0, 0, C.H);
    g.addColorStop(0, '#2b2a6b');
    g.addColorStop(0.6, '#a86bb0');
    g.addColorStop(1, '#f2a25e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.W, C.H);
    ctx.fillStyle = '#4f7d3e';
    for (var x = 0; x < C.W; x += 4) {
      var h = 90 + Math.sin(x * 0.02 + t * 0.2) * 12 + Math.sin(x * 0.07) * 6;
      ctx.fillRect(x, C.H - h, 4, h);
    }
    ctx.fillStyle = '#3a5f2e';
    for (var y = 0; y < 3; y++) ctx.fillRect(0, C.H - 40 + y * 6, C.W, 2);
  }
})();
