/* World: hand-built valley maps, procedurally generated mine floors, tile rules and warps. */
(function () {
  var U = EF.util, W = EF.world = {};

  // char -> tile rules. solid tiles block movement; the rest are walkable.
  W.TILES = {
    '.': { name: 'Grass', solid: false },
    ',': { name: 'Tall grass', solid: false },
    'x': { name: 'Wildflowers', solid: false },
    'p': { name: 'Path', solid: false },
    'b': { name: 'Boardwalk', solid: false },
    's': { name: 'Sand', solid: false },
    'w': { name: 'Water', solid: true, water: true },
    'T': { name: 'Tree', solid: true },
    'R': { name: 'Rock', solid: true },
    'O': { name: 'Copper ore', solid: true },
    'I': { name: 'Iron ore', solid: true },
    'G': { name: 'Gold ore', solid: true },
    'Y': { name: 'Gleam crystal', solid: true },
    'Q': { name: 'Broken bridge', solid: true, broken: true },
    'H': { name: 'Wall', solid: true },
    'r': { name: 'Roof', solid: true },
    'D': { name: 'Door', solid: false },
    'f': { name: 'Wood floor', solid: false },
    'B': { name: 'Bed', solid: true, bed: true },
    'E': { name: 'Table', solid: true },
    'C': { name: 'Crate', solid: true },
    'W': { name: 'Well', solid: true, well: true },
    'N': { name: 'Notice board', solid: true, board: true },
    'J': { name: 'Signpost', solid: true, sign: true },
    'L': { name: 'Lamp post', solid: true, lamp: true },
    'M': { name: 'Cave wall', solid: true },
    'g': { name: 'Cave floor', solid: false },
    'S': { name: 'Stairs down', solid: false },
    'U': { name: 'Stairs up', solid: false }
  };

  W.SIGNS = {
    town: 'HOLLOWMERE. Pop: 212 (before the Tremor). Town hall to the north, bakery to the east.',
    farm: 'Vale Farm. Fields to the south. Please close the gates behind you.',
    forest: 'OLD FOREST. Keep to the path. The mine entrance lies to the north.',
    lake: 'LAKESIDE. Fishing is free for residents. Corrin keeps the boats.'
  };

  W.AREA_IDS = ['farm', 'house', 'town', 'forest', 'lake', 'mine1', 'mine2', 'mine3', 'mine4', 'mine5', 'mine6', 'mine7', 'mine8'];

  // ---------- grid helpers ----------
  function grid(w, h, ch) {
    var g = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push(ch);
      g.push(row);
    }
    return g;
  }
  function fill(g, x, y, w, h, ch) {
    for (var j = y; j < y + h; j++) {
      for (var i = x; i < x + w; i++) {
        if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
      }
    }
  }
  function put(g, x, y, ch) {
    if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
  }
  function toRows(g) {
    return g.map(function (r) { return r.join(''); });
  }
  function border(g) {
    var h = g.length, w = g[0].length;
    fill(g, 0, 0, w, 1, 'T');
    fill(g, 0, h - 1, w, 1, 'T');
    fill(g, 0, 0, 1, h, 'T');
    fill(g, w - 1, 0, 1, h, 'T');
  }
  // A solid block with a roof on one end and its door on the opposite end.
  function building(g, x, y, w, h, door, roofAt) {
    fill(g, x, y, w, h, 'H');
    fill(g, x, roofAt === 'bottom' ? y + h - 1 : y, w, 1, 'r');
    put(g, door.x, door.y, 'D');
  }

  // ---------- outdoor and indoor maps ----------
  function buildFarm() {
    var w = 40, h = 24, g = grid(w, h, '.');
    border(g);
    put(g, 20, 0, 'p');        // north exit to the forest
    put(g, 39, 12, 'p');       // east exit to town
    building(g, 14, 3, 8, 6, { x: 17, y: 8 }, 'top');
    fill(g, 20, 1, 1, 2, 'p'); // path from north gate
    fill(g, 20, 2, 5, 1, 'p');
    fill(g, 24, 2, 1, 10, 'p');
    fill(g, 17, 9, 7, 1, 'p'); // path from the farmhouse door
    fill(g, 24, 12, 15, 1, 'p');
    [[2, 2], [3, 4], [5, 2], [4, 6], [2, 8], [8, 3], [33, 2], [35, 3], [36, 6], [34, 8], [37, 14],
     [2, 19], [3, 22], [37, 20], [36, 22], [12, 2], [30, 2], [22, 20]].forEach(function (p) { put(g, p[0], p[1], 'T'); });
    [[10, 4], [11, 5], [27, 5], [29, 9], [37, 11], [8, 21]].forEach(function (p) { put(g, p[0], p[1], 'R'); });
    fill(g, 35, 14, 3, 3, 'w');  // pond
    return {
      id: 'farm', name: 'Your Farm', w: w, h: h, rows: toRows(g), outdoor: true, music: 'farm',
      forage: true, farmRect: { x: 4, y: 11, w: 30, h: 11 }, fishable: false,
      warps: {
        '20,0': { area: 'forest', x: 20, y: 28 },
        '39,12': { area: 'town', x: 1, y: 12 },
        '17,8': { area: 'house', x: 5, y: 7 }
      }
    };
  }

  function buildHouse() {
    var w = 12, h = 9, g = grid(w, h, 'f');
    fill(g, 0, 0, w, 1, 'H');
    fill(g, 0, h - 1, w, 1, 'H');
    fill(g, 0, 0, 1, h, 'H');
    fill(g, w - 1, 0, 1, h, 'H');
    put(g, 5, 8, 'D');
    put(g, 2, 1, 'B');
    fill(g, 8, 2, 2, 1, 'E');
    put(g, 9, 6, 'C');
    return {
      id: 'house', name: 'Farmhouse', w: w, h: h, rows: toRows(g), outdoor: false, music: 'house',
      forage: false, fishable: false,
      warps: { '5,8': { area: 'farm', x: 17, y: 9 } }
    };
  }

  function buildTown() {
    var w = 50, h = 30, g = grid(w, h, '.');
    border(g);
    fill(g, 1, 12, 48, 1, 'p');                // main road
    put(g, 0, 12, 'p');                        // west exit to the farm
    put(g, 49, 12, 'p');                       // east exit to the lake
    fill(g, 23, 1, 3, 28, 'p');                // cross street
    fill(g, 44, 0, 3, 30, 'w');                // river
    fill(g, 44, 12, 3, 1, 'Q');                // broken bridge over the river
    building(g, 5, 3, 8, 6, { x: 8, y: 8 }, 'top');      // town hall
    building(g, 14, 3, 7, 6, { x: 17, y: 8 }, 'top');    // gleam lab
    building(g, 30, 3, 8, 6, { x: 33, y: 8 }, 'top');    // bakery
    building(g, 5, 17, 8, 6, { x: 8, y: 17 }, 'bottom'); // smithy
    building(g, 14, 17, 6, 6, { x: 16, y: 17 }, 'bottom'); // ilse's cottage
    building(g, 28, 17, 8, 6, { x: 31, y: 17 }, 'bottom'); // general store
    building(g, 37, 17, 6, 6, { x: 39, y: 17 }, 'bottom'); // florist
    fill(g, 8, 9, 1, 3, 'p');   // hall front
    fill(g, 17, 9, 1, 3, 'p');  // lab front
    fill(g, 33, 9, 1, 3, 'p');  // bakery front
    fill(g, 8, 13, 1, 4, 'p');  // smithy front
    fill(g, 16, 13, 1, 4, 'p'); // ilse front
    fill(g, 31, 13, 1, 4, 'p'); // store front
    fill(g, 39, 13, 1, 4, 'p'); // florist front
    put(g, 27, 14, 'W');        // well
    put(g, 21, 14, 'N');        // restoration board
    put(g, 21, 11, 'J');        // signpost
    [[22, 9], [26, 9], [22, 16], [26, 16]].forEach(function (p) { put(g, p[0], p[1], 'L'); });
    [[19, 13], [19, 15], [29, 11], [29, 9], [41, 10], [13, 11], [13, 13], [35, 13]].forEach(function (p) { put(g, p[0], p[1], 'x'); });
    [[3, 3], [2, 7], [15, 2], [10, 26], [3, 26], [20, 26], [27, 26], [33, 26], [40, 26], [47, 20], [47, 6], [41, 2], [29, 2]]
      .forEach(function (p) { put(g, p[0], p[1], 'T'); });
    [[27, 20], [26, 22]].forEach(function (p) { put(g, p[0], p[1], 'C'); });
    return {
      id: 'town', name: 'Hollowmere', w: w, h: h, rows: toRows(g), outdoor: true, music: 'town',
      forage: false, fishable: false,
      warps: {
        '0,12': { area: 'farm', x: 38, y: 12 },
        '49,12': { area: 'lake', x: 1, y: 12 }
      }
    };
  }

  function buildForest() {
    var w = 50, h = 30, g = grid(w, h, '.');
    border(g);
    var rnd = U.seeded(4242);
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var r = rnd();
        if (r < 0.2) g[y][x] = 'T';
        else if (r < 0.23) g[y][x] = 'R';
        else if (r < 0.28) g[y][x] = 'x';
      }
    }
    fill(g, 37, 17, 4, 3, 'w');     // pond
    fill(g, 21, 1, 9, 4, '.');      // clear space around the cave mouth
    put(g, 20, 29, 'p');            // south exit to the farm
    fill(g, 20, 12, 1, 17, 'p');    // path up from the farm
    fill(g, 20, 12, 6, 1, 'p');
    fill(g, 25, 3, 1, 10, 'p');     // path to the cave
    put(g, 25, 2, 'S');             // cave mouth: stairs to mine floor 1
    return {
      id: 'forest', name: 'Old Forest', w: w, h: h, rows: toRows(g), outdoor: true, music: 'forest',
      forage: true, fishable: false,
      warps: {
        '20,29': { area: 'farm', x: 20, y: 1 },
        '25,2': { area: 'mine1', x: 5, y: 5 }
      }
    };
  }

  function buildLake() {
    var w = 50, h = 30, g = grid(w, h, '.');
    border(g);
    put(g, 0, 12, 'p');             // west exit to town
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var dx = (x - 28) / 12, dy = (y - 14) / 8, d = dx * dx + dy * dy;
        if (d <= 0.85) g[y][x] = 'w';
        else if (d <= 1.12) g[y][x] = 's';
      }
    }
    fill(g, 1, 12, 11, 1, 'p');     // road from the town
    building(g, 3, 5, 6, 5, { x: 6, y: 9 }, 'top');  // Corrin's cabin
    fill(g, 6, 10, 1, 2, 'p');
    fill(g, 12, 12, 8, 1, 'b');     // dock reaching into the water
    [[5, 2], [10, 3], [40, 3], [45, 6], [44, 22], [8, 25], [25, 27], [38, 26], [3, 25], [48, 14]]
      .forEach(function (p) { put(g, p[0], p[1], 'T'); });
    [[2, 20], [3, 21], [46, 18]].forEach(function (p) { put(g, p[0], p[1], 'R'); });
    var rnd = U.seeded(777);
    for (var j = 1; j < h - 1; j++) {
      for (var i = 1; i < w - 1; i++) {
        if (g[j][i] === '.' && rnd() < 0.05) g[j][i] = 'x';
      }
    }
    return {
      id: 'lake', name: 'Lakeside', w: w, h: h, rows: toRows(g), outdoor: true, music: 'lake',
      forage: false, fishable: true,
      warps: { '0,12': { area: 'town', x: 48, y: 12 } }
    };
  }

  // ---------- mine floors (generated, deterministic per floor) ----------
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var MINE_W = 36, MINE_H = 24;
  var genCache = {};

  function genMine(n) {
    if (genCache[n]) return genCache[n];
    var rnd = U.seeded(7919 * n + 17);
    var g = grid(MINE_W, MINE_H, 'M');
    function carve(x, y) {
      if (x >= 1 && y >= 1 && x <= MINE_W - 2 && y <= MINE_H - 2) g[y][x] = 'g';
    }
    fill(g, 3, 3, 5, 5, 'g');     // arrival room
    put(g, 5, 4, 'U');            // stairs up
    var x = 6, y = 6, dir = DIRS[0];
    for (var i = 0; i < 900; i++) {
      var brush = rnd() < 0.6 ? 1 : 0;
      for (var dy = -brush; dy <= brush; dy++) {
        for (var dx = -brush; dx <= brush; dx++) carve(x + dx, y + dy);
      }
      if (rnd() < 0.15) dir = DIRS[Math.floor(rnd() * 4)];
      var nx = x + dir[0], ny = y + dir[1];
      if (nx < 3 || nx > MINE_W - 4 || ny < 3 || ny > MINE_H - 4) {
        dir = [-dir[0], -dir[1]];
        nx = x + dir[0];
        ny = y + dir[1];
      }
      x = U.clamp(nx, 3, MINE_W - 4);
      y = U.clamp(ny, 3, MINE_H - 4);
    }
    put(g, 5, 4, 'U');            // the random walk may have carved over the stairs

    // BFS from the arrival room: the farthest reachable cell holds the stairs down.
    var dist = { '5,5': 0 }, parent = {}, q = [[5, 5]];
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], ck = U.key(c[0], c[1]);
      for (var di = 0; di < 4; di++) {
        var nx2 = c[0] + DIRS[di][0], ny2 = c[1] + DIRS[di][1], k = U.key(nx2, ny2);
        if (nx2 < 0 || ny2 < 0 || nx2 >= MINE_W || ny2 >= MINE_H) continue;
        if (g[ny2][nx2] === 'M' || dist[k] !== undefined) continue;
        dist[k] = dist[ck] + 1;
        parent[k] = ck;
        q.push([nx2, ny2]);
      }
    }
    var far = q[q.length - 1];
    var farKey = U.key(far[0], far[1]);
    var onPath = {};
    for (var cur = farKey; cur; cur = parent[cur]) onPath[cur] = true;

    if (n < 8) {
      g[far[1]][far[0]] = 'S';
      carve(far[0], far[1] + 1);  // arrival tile when coming up from below
    }

    // Ore and rocks never sit on the route to the stairs, so the floor is always passable.
    var spawnable = [];
    for (y = 1; y < MINE_H - 1; y++) {
      for (x = 1; x < MINE_W - 1; x++) {
        if (g[y][x] !== 'g' || onPath[U.key(x, y)]) continue;
        if (Math.abs(x - 5) + Math.abs(y - 5) <= 3) continue;
        if (Math.abs(x - far[0]) + Math.abs(y - far[1]) <= 1) continue;
        var r = rnd();
        if (r < 0.05) g[y][x] = 'R';
        else if (r < 0.085) g[y][x] = 'O';
        else if (n >= 2 && r < 0.11) g[y][x] = 'I';
        else if (n >= 5 && r < 0.125) g[y][x] = 'Y';
        else if (n >= 6 && r < 0.14) g[y][x] = 'G';
        if (g[y][x] === 'g' && Math.abs(x - 5) + Math.abs(y - 5) > 8) spawnable.push([x, y]);
      }
    }

    var kinds = [];
    for (i = 0; i < 3 + n; i++) kinds.push('slime');
    for (i = 0; i < 2 + Math.floor(n / 2); i++) kinds.push('bat');
    if (n >= 4) for (i = 0; i < 1 + (n >= 6 ? 1 : 0); i++) kinds.push('golem');
    var spawns = [];
    kinds.forEach(function (type) {
      if (!spawnable.length) return;
      var idx = Math.floor(rnd() * spawnable.length);
      var cell = spawnable.splice(idx, 1)[0];
      spawns.push({ type: type, x: cell[0] + 0.5, y: cell[1] + 0.5 });
    });

    genCache[n] = {
      rows: toRows(g),
      down: n < 8 ? { x: far[0], y: far[1] } : null,
      spawns: spawns
    };
    return genCache[n];
  }

  function buildMine(n) {
    var gen = genMine(n);
    var warps = {};
    if (n === 1) warps['5,4'] = { area: 'forest', x: 25, y: 3 };
    else {
      var above = genMine(n - 1).down;
      warps['5,4'] = { area: 'mine' + (n - 1), x: above.x, y: above.y + 1 };
    }
    if (gen.down) warps[U.key(gen.down.x, gen.down.y)] = { area: 'mine' + (n + 1), x: 5, y: 5 };
    return {
      id: 'mine' + n, name: 'Hollow Mines, floor ' + n, w: MINE_W, h: MINE_H, rows: gen.rows,
      outdoor: false, music: 'mine', forage: false, fishable: false, warps: warps, spawns: gen.spawns
    };
  }

  // ---------- public API ----------
  var cache = {};
  W.area = function (id) {
    if (cache[id]) return cache[id];
    var t;
    if (id === 'farm') t = buildFarm();
    else if (id === 'house') t = buildHouse();
    else if (id === 'town') t = buildTown();
    else if (id === 'forest') t = buildForest();
    else if (id === 'lake') t = buildLake();
    else if (/^mine[1-8]$/.test(id)) t = buildMine(+id.slice(4));
    else throw new Error('Unknown area ' + id);
    cache[id] = t;
    return t;
  };

  // Mine floors 4-6 need the lift repaired; floors 7-8 need the deep shafts reinforced.
  W.lockMessage = function (areaId, projects) {
    var m = /^mine([1-8])$/.exec(areaId);
    if (!m) return null;
    var n = +m[1];
    if (n >= 4 && !projects.lift) return 'The mine lift is jammed. Repair it on the Restoration Board first.';
    if (n >= 7 && !projects.deep) return 'The deep shafts are unstable. Reinforce them on the Restoration Board first.';
    return null;
  };

  W.isSolid = function (ch) {
    var t = W.TILES[ch];
    return !t || t.solid;
  };
  W.describe = function (ch) {
    return (W.TILES[ch] || {}).name || 'Unknown';
  };
})();
