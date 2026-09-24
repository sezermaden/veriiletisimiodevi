// ============================================================
// Dog Quest - overworld generation, collision and ground rendering
// ============================================================
'use strict';

const T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, ROAD: 5, SNOW: 6, DESERT: 7, DARK: 8, ASH: 9, LAVA: 10, MOUNTAIN: 11, BRIDGE: 12, TOWN: 13, SAVANNA: 14, ICE: 15 };
const TILE_INFO = [];
TILE_INFO[T.DEEP] = { solid: true, color: '#2a5a9a', pri: 0 };
TILE_INFO[T.WATER] = { solid: true, color: '#3f82c8', pri: 1 };
TILE_INFO[T.LAVA] = { solid: true, color: '#e8501a', pri: 1 };
TILE_INFO[T.ICE] = { solid: false, color: '#bfe4f4', pri: 2 };
TILE_INFO[T.SAND] = { solid: false, color: '#e6d098', pri: 3 };
TILE_INFO[T.DESERT] = { solid: false, color: '#e8c47c', pri: 4 };
TILE_INFO[T.SNOW] = { solid: false, color: '#eaf2fa', pri: 4 };
TILE_INFO[T.ASH] = { solid: false, color: '#5e4c4a', pri: 4 };
TILE_INFO[T.SAVANNA] = { solid: false, color: '#cdb45a', pri: 5 };
TILE_INFO[T.GRASS] = { solid: false, color: '#6cb04a', pri: 6 };
TILE_INFO[T.DARK] = { solid: false, color: '#3e6a4a', pri: 6 };
TILE_INFO[T.FOREST] = { solid: false, color: '#5c9c40', pri: 7 };
TILE_INFO[T.ROAD] = { solid: false, color: '#c8a878', pri: 8 };
TILE_INFO[T.TOWN] = { solid: false, color: '#b8ae9c', pri: 9 };
TILE_INFO[T.BRIDGE] = { solid: false, color: '#a07040', pri: 10 };
TILE_INFO[T.MOUNTAIN] = { solid: true, color: '#7a7a82', pri: 11 };

const REGION_GROUND = [T.GRASS, T.DESERT, T.SNOW, T.DARK, T.ASH, T.SAVANNA];
const REGION_TREE = ['oak', 'palm', 'snowpine', 'dark', 'dead', 'acacia'];
const ROAD_COLORS = ['#c8a878', '#f0d8a0', '#c8c4c0', '#8a7a5a', '#6a5a52', '#d8b870'];

// ------------------------------------------------------------
// Chunk cache: paints map chunks lazily into offscreen canvases
// ------------------------------------------------------------
class ChunkCache {
  constructor(paintFn, chunkTiles = 8, limit = 90) {
    this.paint = paintFn; this.ct = chunkTiles; this.limit = limit;
    this.map = new Map();
  }
  get(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.map.get(key);
    if (c) { this.map.delete(key); this.map.set(key, c); return c; }
    c = document.createElement('canvas');
    c.width = c.height = this.ct * TS;
    const g = c.getContext('2d');
    g.translate(-cx * this.ct * TS, -cy * this.ct * TS);
    this.paint(g, cx * this.ct, cy * this.ct, this.ct);
    this.map.set(key, c);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
    return c;
  }
  clear() { this.map.clear(); }
  draw(ctx, x0, y0, x1, y1, maxCX, maxCY) {
    const cs = this.ct * TS;
    const cx0 = Math.max(0, Math.floor(x0 / cs)), cy0 = Math.max(0, Math.floor(y0 / cs));
    const cx1 = Math.min(maxCX - 1, Math.floor(x1 / cs)), cy1 = Math.min(maxCY - 1, Math.floor(y1 / cs));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.get(cx, cy), cx * cs, cy * cs);
  }
}

// ------------------------------------------------------------
class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.w = WORLD_W; this.h = WORLD_H;
    this.tiles = new Uint8Array(this.w * this.h);
    this.region = new Uint8Array(this.w * this.h);
    this.blocked = new Uint8Array(this.w * this.h);
    this.noBuild = new Uint8Array(this.w * this.h);
    this.props = [];      // static drawable objects
    this.buildings = [];  // interactive buildings (shops etc)
    this.entrances = [];  // dungeon entrances
    this.chests = [];     // world chests
    this.npcSpots = [];
    this.gotoSpots = {};
    this.generate();
    this.cache = new ChunkCache((g, tx, ty, n) => this.paintChunk(g, tx, ty, n), 8, 96);
    this.buckets = null;
    this.buildBuckets();
    this.buildMinimap();
  }

  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : T.DEEP; }
  setTile(x, y, t) { if (this.inb(x, y)) this.tiles[y * this.w + x] = t; }
  regionAtTile(x, y) { return this.inb(x, y) ? this.region[y * this.w + x] : 0; }
  regionAt(px, py) { return this.regionAtTile(Math.floor(px / TS), Math.floor(py / TS)); }
  solidTile(x, y) {
    if (!this.inb(x, y)) return true;
    const i = y * this.w + x;
    return TILE_INFO[this.tiles[i]].solid || this.blocked[i] === 1;
  }
  isSolid(px, py) { return this.solidTile(Math.floor(px / TS), Math.floor(py / TS)); }
  walkableTile(x, y) { return !this.solidTile(x, y); }

  // ---------------- generation ----------------
  generate() {
    const { w, h, seed } = this;
    const rng = new RNG(seed);
    this.rng = rng;
    // 1) region assignment with domain warp
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wx = x + (fbm(x / 18, y / 18, seed + 200, 3) - 0.5) * 22;
      const wy = y + (fbm(x / 18, y / 18, seed + 300, 3) - 0.5) * 22;
      let best = 0, bd = 1e9;
      for (const r of REGIONS) { const d = dist2(wx, wy, r.cx, r.cy); if (d < bd) { bd = d; best = r.id; } }
      this.region[y * w + x] = best;
    }
    // 2) base terrain
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = Math.min(x, w - 1 - x, y, h - 1 - y);
      const n = fbm(x / 26, y / 26, seed, 5);
      const land = edge + (n - 0.5) * 30 > 8;
      if (!land) { this.tiles[i] = edge + (n - 0.5) * 30 > 3 ? T.WATER : T.DEEP; continue; }
      const reg = this.region[i];
      let t = REGION_GROUND[reg];
      const lake = fbm(x / 13, y / 13, seed + 50, 3);
      const forest = fbm(x / 9, y / 9, seed + 9, 3);
      const mount = 1 - Math.abs(fbm(x / 22, y / 22, seed + 77, 4) * 2 - 1);
      if (lake < 0.28 && edge > 12) {
        t = reg === 4 ? T.LAVA : reg === 2 ? T.ICE : T.WATER;
        if (reg === 1 && lake > 0.24) t = T.WATER;
      } else if (mount > 0.94 && edge > 10 && fbm(x / 7, y / 7, seed + 91, 2) > 0.45 && !this.nearTown(x, y, 15)) t = T.MOUNTAIN;
      else if (reg === 0 && forest > 0.64) t = T.FOREST;
      else if (reg === 3 && forest > 0.55) t = T.FOREST;
      else if (reg === 2 && forest > 0.68) t = T.FOREST;
      this.tiles[i] = t;
    }
    // shallow water ring & deep interior sea
    const copy = this.tiles.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = copy[y * w + x];
      if (t === T.DEEP) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const tt = this.inb(x + dx, y + dy) ? copy[(y + dy) * w + x + dx] : T.DEEP;
          if (tt !== T.DEEP && tt !== T.WATER) { this.tiles[y * w + x] = T.WATER; }
        }
      }
    }
    // beaches
    const copy2 = this.tiles.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const t = copy2[y * w + x];
      if (t === T.WATER || t === T.DEEP || t === T.LAVA || t === T.MOUNTAIN || t === T.ICE) continue;
      let nearWater = false;
      for (let dy = -1; dy <= 1 && !nearWater; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tt = copy2[(y + dy) * w + x + dx];
        if (tt === T.WATER || tt === T.DEEP) { nearWater = true; break; }
      }
      if (nearWater) {
        const reg = this.region[y * w + x];
        this.tiles[y * w + x] = reg === 2 ? T.SNOW : reg === 4 ? T.ASH : reg === 1 ? T.DESERT : T.SAND;
      }
    }

    // 3) points of interest
    const pois = [];
    for (const id of TOWN_ORDER) { const tw = TOWNS[id]; pois.push({ kind: 'town', id, tx: tw.tx, ty: tw.ty, r: 10 }); }
    for (const d of DUNGEONS) pois.push({ kind: 'dungeon', id: d.id, tx: d.tx, ty: d.ty, r: 4 });
    for (const qid in QUESTS) { const q = QUESTS[qid]; if (q.obj.type === 'goto') pois.push({ kind: 'goto', id: qid, tx: q.obj.tx, ty: q.obj.ty, r: 3 }); }
    this.pois = pois;
    for (const p of pois) {
      for (let dy = -p.r; dy <= p.r; dy++) for (let dx = -p.r; dx <= p.r; dx++) {
        if (dx * dx + dy * dy > p.r * p.r + 1) continue;
        const x = p.tx + dx, y = p.ty + dy;
        if (!this.inb(x, y)) continue;
        const i = y * w + x;
        const t = this.tiles[i];
        if (TILE_INFO[t].solid || t === T.FOREST || t === T.ICE) this.tiles[i] = REGION_GROUND[this.region[i]];
        this.noBuild[i] = 1;
      }
    }
    // towns ground
    for (const id of TOWN_ORDER) {
      const tw = TOWNS[id];
      for (let dy = -7; dy <= 7; dy++) for (let dx = -9; dx <= 9; dx++) {
        if ((dx * dx) / 90 + (dy * dy) / 56 > 1) continue;
        this.setTile(tw.tx + dx, tw.ty + dy, T.TOWN);
      }
    }

    // 4) roads
    this.roadEdges = [];
    const townPoi = id => pois.find(p => p.kind === 'town' && p.id === id);
    const link = (a, b) => this.roadEdges.push([a, b]);
    link(townPoi('pawston'), townPoi('dunebark'));
    link(townPoi('pawston'), townPoi('snowmuzzle'));
    link(townPoi('pawston'), townPoi('fortfido'));
    link(townPoi('dunebark'), townPoi('cinderpaw'));
    link(townPoi('fortfido'), townPoi('cinderpaw'));
    link(townPoi('snowmuzzle'), townPoi('fortfido'));
    const pa = pois.find(p => p.id === 'pride_arena'), lk = pois.find(p => p.id === 'lions_keep');
    link(townPoi('fortfido'), pa); link(pa, lk);
    link(townPoi('snowmuzzle'), pois.find(p => p.id === 'glacier_vault'));
    for (const p of pois) {
      if (p.kind === 'town' || p === pa || p === lk) continue;
      // connect to closest town
      let best = null, bd = 1e9;
      for (const id of TOWN_ORDER) { const tp = townPoi(id); const d = dist2(p.tx, p.ty, tp.tx, tp.ty); if (d < bd) { bd = d; best = tp; } }
      link(best, p);
    }
    for (const [a, b] of this.roadEdges) this.carveRoad(a.tx, a.ty + (a.kind === 'dungeon' ? 1 : 0), b.tx, b.ty + (b.kind === 'dungeon' ? 1 : 0));
    // re-stamp town ground over roads
    for (const id of TOWN_ORDER) {
      const tw = TOWNS[id];
      for (let dy = -7; dy <= 7; dy++) for (let dx = -9; dx <= 9; dx++) {
        if ((dx * dx) / 90 + (dy * dy) / 56 > 1) continue;
        this.setTile(tw.tx + dx, tw.ty + dy, T.TOWN);
      }
    }

    // 5) towns: buildings, npcs
    for (const id of TOWN_ORDER) this.buildTown(id);
    // 6) dungeon entrances
    for (const d of DUNGEONS) {
      const e = { dungeon: d, x: d.tx * TS + 16, y: d.ty * TS + 20, tx: d.tx, ty: d.ty };
      this.entrances.push(e);
      for (let dx = -1; dx <= 1; dx++) this.blockTile(d.tx + dx, d.ty - 1);
      this.blockTile(d.tx - 1, d.ty); this.blockTile(d.tx + 1, d.ty);
      for (let dy = 0; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) this.noBuild[this.idx(d.tx + dx, d.ty + dy)] = 1;
    }
    // goto spots
    for (const p of pois) if (p.kind === 'goto') this.gotoSpots[p.id] = { x: p.tx * TS + 16, y: p.ty * TS + 16 };

    // 7) decorations
    this.decorate(rng);
    // 8) connectivity fix
    this.ensureConnectivity();
    // 9) chests
    this.placeChests(rng);
  }

  nearTown(x, y, r) {
    for (const id of TOWN_ORDER) { const t = TOWNS[id]; if (dist2(x, y, t.tx, t.ty) < r * r) return true; }
    return false;
  }
  blockTile(x, y) { if (this.inb(x, y)) { this.blocked[this.idx(x, y)] = 1; this.noBuild[this.idx(x, y)] = 1; } }

  carveRoad(x0, y0, x1, y1) {
    const path = this.astar(x0, y0, x1, y1);
    if (!path) return;
    for (const [x, y] of path) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const xx = x + dx, yy = y + dy;
        if (!this.inb(xx, yy)) continue;
        const i = this.idx(xx, yy);
        const t = this.tiles[i];
        if (t === T.TOWN) continue;
        if (t === T.WATER || t === T.DEEP || t === T.LAVA || t === T.ICE) this.tiles[i] = T.BRIDGE;
        else if (t !== T.BRIDGE) this.tiles[i] = T.ROAD;
        this.noBuild[i] = 1;
      }
    }
  }

  astar(x0, y0, x1, y1) {
    const { w, h } = this;
    const cost = new Float32Array(w * h).fill(Infinity);
    const from = new Int32Array(w * h).fill(-1);
    const heap = new MinHeap();
    const s = y0 * w + x0, goal = y1 * w + x1;
    cost[s] = 0; heap.push(s, 0);
    const tc = t => (t === T.ROAD || t === T.BRIDGE || t === T.TOWN) ? 0.45 : t === T.WATER ? 7 : t === T.DEEP ? 40 : t === T.LAVA ? 9 : t === T.MOUNTAIN ? 6 : t === T.FOREST ? 1.8 : t === T.ICE ? 5 : 1;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let guard = 0;
    while (heap.size && guard++ < 200000) {
      const cur = heap.pop();
      if (cur === goal) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= w - 2 || ny >= h - 2) continue;
        const ni = ny * w + nx;
        const wig = hash2(nx, ny, 99) * 0.35;
        const nc = cost[cur] + tc(this.tiles[ni]) + wig;
        if (nc < cost[ni]) {
          cost[ni] = nc; from[ni] = cur;
          heap.push(ni, nc + (Math.abs(nx - x1) + Math.abs(ny - y1)) * 0.5);
        }
      }
    }
    if (from[goal] === -1 && goal !== s) return null;
    const path = [];
    let c = goal;
    while (c !== -1) { path.push([c % w, (c / w) | 0]); if (c === s) break; c = from[c]; }
    return path.reverse();
  }

  buildTown(id) {
    const tw = TOWNS[id];
    const { tx, ty } = tw;
    const b = (kind, ox, oy, extra = {}) => {
      const bx = tx + ox, by = ty + oy;
      const bd = Object.assign({ kind, town: id, tileX: bx, tileY: by, x: bx * TS + 16, y: (by + 1) * TS, roof: tw.color }, extra);
      if (kind === 'board') {
        this.blockTile(bx, by);
        bd.door = { x: bd.x, y: bd.y + 14 };
      } else if (kind === 'fountain') {
        this.blockTile(bx, by); this.blockTile(bx - 1, by); this.blockTile(bx + 1, by);
      } else {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -2; dy <= 0; dy++) this.blockTile(bx + dx, by + dy);
        bd.door = { x: bd.x, y: bd.y + 12 };
      }
      this.buildings.push(bd);
      this.props.push({ type: 'building', b: bd, x: bd.x, y: bd.y });
      return bd;
    };
    b('smith', -5, -2, { roof: '#6a6a72' });
    b('mage', 5, -2, { roof: '#6b2fb3' });
    b('inn', -5, 4, { roof: tw.color });
    b('house', 5, 4, { roof: shade(tw.color, -0.2) });
    b('board', 2, 1);
    b('fountain', -1, 1);
    for (const n of tw.npcs) this.npcSpots.push({ town: id, npc: n, x: (tx + n.pos[0]) * TS + 16, y: (ty + n.pos[1]) * TS + 24 });
  }

  decorate(rng) {
    const { w, h } = this;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (this.noBuild[i] || this.blocked[i]) continue;
      const t = this.tiles[i];
      if (TILE_INFO[t].solid || t === T.ROAD || t === T.BRIDGE || t === T.TOWN || t === T.SAND) continue;
      // keep space next to roads
      let nearRoad = false;
      for (let dy = -1; dy <= 1 && !nearRoad; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tt = this.tiles[(y + dy) * w + x + dx];
        if (tt === T.ROAD || tt === T.BRIDGE || tt === T.TOWN) { nearRoad = true; break; }
      }
      if (nearRoad) continue;
      const reg = this.region[i];
      const r = hash2(x, y, this.seed + 5);
      const px = x * TS + 16 + (hash2(x, y, 7) - 0.5) * 10, py = y * TS + 26;
      const seed = hash2(x, y, 11);
      if (t === T.FOREST) {
        if (r < 0.5) { this.addTree(x, y, px, py, reg === 2 ? 'snowpine' : REGION_TREE[reg], seed); continue; }
      } else if (r < [0.035, 0.012, 0.03, 0.08, 0.03, 0.025][reg]) {
        const kind = reg === 1 ? (hash2(x, y, 3) < 0.6 ? 'cactus' : 'palm') : reg === 2 ? (hash2(x, y, 3) < 0.7 ? 'snowpine' : 'pine') : REGION_TREE[reg];
        this.addTree(x, y, px, py, kind, seed); continue;
      } else if (r < [0.045, 0.03, 0.04, 0.09, 0.07, 0.035][reg]) {
        this.blocked[i] = 1;
        this.props.push({ type: 'rock', kind: ['grass', 'sand', 'snow', 'grass', 'ash', 'sand'][reg], x: px, y: py, seed });
        continue;
      }
      // non solid decorations
      if (reg === 0 && r > 0.9) this.props.push({ type: 'flower', x: px, y: py - 4, seed });
      else if (reg === 5 && r > 0.93) this.props.push({ type: 'flower', x: px, y: py - 4, seed });
    }
  }
  addTree(x, y, px, py, kind, seed) {
    this.blocked[this.idx(x, y)] = 1;
    this.props.push({ type: 'tree', kind, x: px, y: py, seed });
  }

  flood(sx, sy) {
    const { w, h } = this;
    const seen = new Uint8Array(w * h);
    const st = [sy * w + sx]; seen[st[0]] = 1;
    while (st.length) {
      const c = st.pop(); const x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inb(nx, ny)) continue;
        const ni = ny * w + nx;
        if (seen[ni] || this.solidTile(nx, ny)) continue;
        seen[ni] = 1; st.push(ni);
      }
    }
    return seen;
  }

  ensureConnectivity() {
    const start = TOWNS.pawston;
    for (let pass = 0; pass < 3; pass++) {
      const seen = this.flood(start.tx, start.ty + 2);
      this.reach = seen;
      let fixed = false;
      const targets = [];
      for (const d of DUNGEONS) targets.push([d.tx, d.ty + 1]);
      for (const id of TOWN_ORDER) targets.push([TOWNS[id].tx, TOWNS[id].ty + 2]);
      for (const s of this.npcSpots) targets.push([Math.floor(s.x / TS), Math.floor(s.y / TS)]);
      for (const b of this.buildings) if (b.door) targets.push([Math.floor(b.door.x / TS), Math.floor(b.door.y / TS)]);
      for (const k in this.gotoSpots) targets.push([Math.floor(this.gotoSpots[k].x / TS), Math.floor(this.gotoSpots[k].y / TS)]);
      for (const [x, y] of targets) {
        if (!seen[this.idx(x, y)]) {
          // clear blocking decoration around target and carve road to town
          this.clearArea(x, y, 1);
          this.carveRoad(start.tx, start.ty + 2, x, y);
          fixed = true;
        }
      }
      if (!fixed) break;
      // remove decorations placed on newly carved roads
      this.props = this.props.filter(p => {
        if (p.type !== 'tree' && p.type !== 'rock') return true;
        const tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 10) / TS);
        const t = this.tile(tx, ty);
        if (t === T.ROAD || t === T.BRIDGE) { this.blocked[this.idx(tx, ty)] = 0; return false; }
        return true;
      });
    }
    this.reach = this.flood(start.tx, start.ty + 2);
  }
  clearArea(x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (!this.inb(xx, yy)) continue;
      const i = this.idx(xx, yy);
      if (this.blocked[i] && !this.isStructureTile(xx, yy)) this.blocked[i] = 0;
    }
    this.props = this.props.filter(p => !((p.type === 'tree' || p.type === 'rock') && Math.abs(Math.floor(p.x / TS) - x) <= r && Math.abs(Math.floor((p.y - 10) / TS) - y) <= r));
  }
  isStructureTile(x, y) {
    for (const b of this.buildings) if (Math.abs(b.tileX - x) <= 1 && y >= b.tileY - 2 && y <= b.tileY) return true;
    for (const e of this.entrances) if (Math.abs(e.tx - x) <= 1 && (y === e.ty - 1 || y === e.ty)) return true;
    return false;
  }

  placeChests(rng) {
    const plan = [
      [1, 1, 1, 2, 2, 3, 4, 5, 1],
      [1, 2, 2, 2, 3, 3, 4, 5],
      [2, 2, 3, 3, 4, 4, 5, 1],
      [2, 3, 3, 4, 4, 4, 5, 5],
      [3, 4, 4, 5, 5, 5, 2],
      [3, 4, 4, 5, 5, 5],
    ];
    const taken = [];
    for (const p of this.pois) taken.push([p.tx, p.ty]);
    let n = 0;
    for (let reg = 0; reg < plan.length; reg++) {
      for (const tier of plan[reg]) {
        for (let tries = 0; tries < 4000; tries++) {
          const x = rng.int(4, this.w - 5), y = rng.int(4, this.h - 5);
          const i = this.idx(x, y);
          if (this.region[i] !== reg || !this.reach[i] || this.noBuild[i] || this.blocked[i]) continue;
          const t = this.tiles[i];
          if (t === T.ROAD || t === T.BRIDGE || t === T.TOWN || TILE_INFO[t].solid) continue;
          if (taken.some(([a, b]) => dist2(a, b, x, y) < 100)) continue;
          // needs open space around
          let open = true;
          for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (this.solidTile(x + dx, y + dy)) { open = false; break; }
          if (!open) continue;
          taken.push([x, y]);
          this.chests.push({ id: 'w' + (n++), tier, x: x * TS + 16, y: y * TS + 24, tx: x, ty: y });
          this.blocked[i] = 1;
          break;
        }
      }
    }
  }

  buildBuckets() {
    const bs = 8 * TS;
    this.bw = Math.ceil(this.w * TS / bs); this.bh = Math.ceil(this.h * TS / bs);
    this.buckets = Array.from({ length: this.bw * this.bh }, () => []);
    for (const p of this.props) {
      const bx = clamp(Math.floor(p.x / bs), 0, this.bw - 1), by = clamp(Math.floor(p.y / bs), 0, this.bh - 1);
      this.buckets[by * this.bw + bx].push(p);
    }
  }
  propsInRect(x0, y0, x1, y1, out) {
    const bs = 8 * TS;
    const bx0 = clamp(Math.floor(x0 / bs), 0, this.bw - 1), by0 = clamp(Math.floor(y0 / bs), 0, this.bh - 1);
    const bx1 = clamp(Math.floor(x1 / bs), 0, this.bw - 1), by1 = clamp(Math.floor(y1 / bs), 0, this.bh - 1);
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (const p of this.buckets[by * this.bw + bx]) out.push(p);
    return out;
  }

  // ---------------- rendering ----------------
  tileColor(x, y) {
    const t = this.tile(x, y);
    if (t === T.ROAD) return ROAD_COLORS[this.regionAtTile(x, y)];
    return TILE_INFO[t].color;
  }

  paintChunk(g, tx0, ty0, n) {
    const list = [];
    for (let y = ty0 - 1; y < ty0 + n + 1; y++) for (let x = tx0 - 1; x < tx0 + n + 1; x++) {
      if (!this.inb(x, y)) continue;
      list.push([TILE_INFO[this.tiles[y * this.w + x]].pri, y, x]);
    }
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const [, y, x] of list) this.paintTileBase(g, x, y);
    for (const [, y, x] of list) this.paintTileDetail(g, x, y);
  }

  paintTileBase(g, x, y) {
    const t = this.tile(x, y);
    const px = x * TS, py = y * TS;
    const base = this.tileColor(x, y);
    const v = (hash2(x, y, 1) - 0.5) * 0.06;
    const col = v > 0 ? shade(base, v) : shade(base, v);
    g.fillStyle = col;
    g.fillRect(px, py, TS, TS);
    if (t === T.MOUNTAIN || t === T.BRIDGE) return;
    // organic edge blobs into neighbours with lower priority
    const pri = TILE_INFO[t].pri;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nt = this.tile(x + dx, y + dy);
      if (TILE_INFO[nt].pri >= pri) continue;
      for (let k = 0; k < 3; k++) {
        const hh = hash2(x * 7 + k, y * 13 + dx * 3 + dy, 21);
        const along = (hash2(x + k * 5, y - k * 3, 23)) * TS;
        const bx = px + (dx === 0 ? along : dx > 0 ? TS : 0);
        const by = py + (dy === 0 ? along : dy > 0 ? TS : 0);
        g.beginPath(); g.arc(bx, by, 5 + hh * 7, 0, TAU); g.fill();
      }
    }
  }

  paintTileDetail(g, x, y) {
    const t = this.tile(x, y);
    const px = x * TS, py = y * TS;
    const h1 = hash2(x, y, 31), h2 = hash2(x, y, 32), h3 = hash2(x, y, 33);
    switch (t) {
      case T.GRASS: case T.FOREST: case T.DARK: case T.SAVANNA: {
        const dark = shade(this.tileColor(x, y), -0.18);
        g.strokeStyle = dark; g.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) {
          const gx = px + hash2(x, y, 40 + k) * 28 + 2, gy = py + hash2(x, y, 50 + k) * 26 + 4;
          g.beginPath(); g.moveTo(gx - 2.5, gy - 4); g.lineTo(gx, gy); g.lineTo(gx + 2.5, gy - 4.5); g.stroke();
        }
        if (t === T.GRASS && h1 < 0.12) {
          const c = ['#ffffff', '#ffd23f', '#ff8ab0'][Math.floor(h2 * 3)];
          g.fillStyle = c; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(px + h3 * 24 + k * 3, py + h2 * 24 + (k % 2) * 3, 1.6, 0, TAU); g.fill(); }
        }
        if (t === T.DARK && h1 < 0.07) { g.fillStyle = '#c85a8a'; g.beginPath(); g.arc(px + h2 * 26 + 3, py + h3 * 26 + 3, 3, Math.PI, TAU); g.fill(); g.fillStyle = '#e8d8c8'; g.fillRect(px + h2 * 26 + 2, py + h3 * 26 + 3, 2, 3); }
        break;
      }
      case T.DESERT: case T.SAND: {
        g.strokeStyle = shade(this.tileColor(x, y), -0.1); g.lineWidth = 1.2;
        if (h1 < 0.5) { g.beginPath(); g.moveTo(px + 4, py + 10 + h2 * 12); g.quadraticCurveTo(px + 16, py + 6 + h2 * 12, px + 28, py + 10 + h2 * 12); g.stroke(); }
        if (h3 < 0.1) { g.fillStyle = shade(this.tileColor(x, y), -0.25); g.beginPath(); g.arc(px + h2 * 28, py + h1 * 28, 2, 0, TAU); g.fill(); }
        break;
      }
      case T.SNOW: case T.ICE: {
        if (h1 < 0.3) { g.fillStyle = '#ffffff'; g.fillRect(px + h2 * 28, py + h3 * 28, 2, 2); }
        if (h2 < 0.2) { g.fillStyle = shade(this.tileColor(x, y), -0.06); g.beginPath(); g.ellipse(px + 16, py + 20, 10 + h3 * 6, 4, 0, 0, TAU); g.fill(); }
        if (t === T.ICE) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + h1 * 20, py + 6); g.lineTo(px + 6 + h1 * 20, py + 14); g.stroke(); }
        break;
      }
      case T.ASH: {
        if (h1 < 0.25) { g.strokeStyle = '#3a2e2c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px + 4, py + 6 + h2 * 20); g.lineTo(px + 14, py + 10 + h2 * 16); g.lineTo(px + 22, py + 4 + h2 * 20); g.stroke(); }
        if (h3 < 0.06) { g.fillStyle = '#ff6a2a'; g.fillRect(px + h2 * 26, py + h1 * 26, 2, 2); }
        break;
      }
      case T.ROAD: {
        g.fillStyle = shade(this.tileColor(x, y), -0.14);
        for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(px + hash2(x, y, 60 + k) * 26 + 3, py + hash2(x, y, 70 + k) * 26 + 3, 2.4, 1.6, 0, 0, TAU); g.fill(); }
        break;
      }
      case T.TOWN: {
        g.strokeStyle = shade(TILE_INFO[T.TOWN].color, -0.15); g.lineWidth = 1;
        const off = (y % 2) * 8;
        for (let k = 0; k < 2; k++) g.strokeRect(px + off + k * 16 - 8 + 0.5, py + 0.5, 16, 16);
        for (let k = 0; k < 2; k++) g.strokeRect(px + (8 - off) + k * 16 - 8 + 0.5, py + 16.5, 16, 15);
        break;
      }
      case T.BRIDGE: {
        const wet = (xx, yy) => { const q = this.tile(xx, yy); return q === T.WATER || q === T.DEEP || q === T.LAVA || q === T.ICE; };
        const runsHorizontal = wet(x, y - 1) || wet(x, y + 1);
        g.fillStyle = '#6b4520';
        if (runsHorizontal) { for (let k = 0; k < 4; k++) g.fillRect(px + k * 8, py, 1.5, TS); }
        else { for (let k = 0; k < 4; k++) g.fillRect(px, py + k * 8, TS, 1.5); }
        g.fillStyle = '#4a2e14';
        if (wet(x, y - 1)) g.fillRect(px, py, TS, 3);
        if (wet(x, y + 1)) g.fillRect(px, py + TS - 3, TS, 3);
        if (wet(x - 1, y)) g.fillRect(px, py, 3, TS);
        if (wet(x + 1, y)) g.fillRect(px + TS - 3, py, 3, TS);
        break;
      }
      case T.WATER: case T.DEEP: {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        if (h1 < 0.3) g.fillRect(px + h2 * 20, py + h3 * 28, 10, 1.5);
        break;
      }
      case T.LAVA: {
        g.fillStyle = '#ffb040';
        if (h1 < 0.5) { g.beginPath(); g.ellipse(px + h2 * 24 + 4, py + h3 * 24 + 4, 5, 3, 0, 0, TAU); g.fill(); }
        g.fillStyle = '#b8300a'; if (h2 < 0.3) g.fillRect(px + h3 * 26, py + h1 * 26, 5, 3);
        break;
      }
      case T.MOUNTAIN: {
        const reg = this.regionAtTile(x, y);
        const base = reg === 2 ? '#8a96a8' : reg === 4 ? '#3a2e2e' : reg === 1 ? '#b08a5a' : reg === 5 ? '#9a8058' : '#7a7a82';
        const hi = shade(base, 0.25), lo = shade(base, -0.25);
        const peakH = 26 + h1 * 18;
        const cx = px + 16 + (h2 - 0.5) * 8;
        g.fillStyle = lo; g.beginPath(); g.moveTo(px - 6, py + TS + 2); g.lineTo(cx, py + TS - peakH); g.lineTo(px + TS + 6, py + TS + 2); g.fill();
        g.fillStyle = base; g.beginPath(); g.moveTo(px - 6, py + TS + 2); g.lineTo(cx, py + TS - peakH); g.lineTo(cx + 3, py + TS + 2); g.fill();
        g.fillStyle = hi; g.beginPath(); g.moveTo(cx - 6, py + TS - peakH + 10); g.lineTo(cx, py + TS - peakH); g.lineTo(cx + 2, py + TS - peakH + 8); g.fill();
        if (reg === 2 || reg === 0 || reg === 3) { g.fillStyle = '#f4f8ff'; g.beginPath(); g.moveTo(cx - 7, py + TS - peakH + 11); g.lineTo(cx, py + TS - peakH); g.lineTo(cx + 7, py + TS - peakH + 11); g.lineTo(cx + 2, py + TS - peakH + 8); g.lineTo(cx - 2, py + TS - peakH + 12); g.fill(); }
        break;
      }
    }
  }

  // animated overlay for water & lava near the camera
  drawAnimated(ctx, x0, y0, x1, y1, t) {
    const tx0 = Math.max(0, Math.floor(x0 / TS)), ty0 = Math.max(0, Math.floor(y0 / TS));
    const tx1 = Math.min(this.w - 1, Math.floor(x1 / TS)), ty1 = Math.min(this.h - 1, Math.floor(y1 / TS));
    ctx.lineWidth = 1.5;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const tt = this.tiles[y * this.w + x];
      if (tt === T.WATER || tt === T.DEEP) {
        const h = hash2(x, y, 77);
        const p = (t * 0.6 + h) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.22 * Math.sin(p * Math.PI)})`;
        const px = x * TS + h * 16, py = y * TS + 8 + hash2(x, y, 78) * 16;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 5, py - 3, px + 10 + p * 4, py); ctx.stroke();
        // shore foam
        if (tt === T.WATER) {
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nt = this.tile(x + dx, y + dy);
            if (TILE_INFO[nt].solid) continue;
            const f = 0.35 + Math.sin(t * 2 + x + y) * 0.2;
            ctx.strokeStyle = `rgba(255,255,255,${f})`;
            const off = 3 + Math.sin(t * 2 + x * 0.7 + y) * 2;
            ctx.beginPath();
            if (dy === -1) { ctx.moveTo(x * TS, y * TS + off); ctx.lineTo(x * TS + TS, y * TS + off); }
            else if (dy === 1) { ctx.moveTo(x * TS, y * TS + TS - off); ctx.lineTo(x * TS + TS, y * TS + TS - off); }
            else if (dx === -1) { ctx.moveTo(x * TS + off, y * TS); ctx.lineTo(x * TS + off, y * TS + TS); }
            else { ctx.moveTo(x * TS + TS - off, y * TS); ctx.lineTo(x * TS + TS - off, y * TS + TS); }
            ctx.stroke();
          }
        }
      } else if (tt === T.LAVA) {
        const h = hash2(x, y, 79);
        const p = (t * 0.5 + h) % 1;
        ctx.fillStyle = `rgba(255,220,120,${0.5 * Math.sin(p * Math.PI)})`;
        ctx.beginPath(); ctx.arc(x * TS + 6 + h * 20, y * TS + 6 + hash2(x, y, 80) * 20, 2 + p * 4, 0, TAU); ctx.fill();
      }
    }
  }

  buildMinimap() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x;
      let col = hexToRgb(this.tileColor(x, y));
      if (this.blocked[i] && !TILE_INFO[this.tiles[i]].solid) col = col.map(v => v * 0.7);
      img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.minimap = c;
  }

  townAt(px, py) {
    for (const id of TOWN_ORDER) {
      const t = TOWNS[id];
      if (dist2(px, py, t.tx * TS + 16, t.ty * TS + 16) < (11 * TS) ** 2) return id;
    }
    return null;
  }
  inSafeZone(px, py, extra = 0) {
    for (const id of TOWN_ORDER) {
      const t = TOWNS[id];
      if (dist2(px, py, t.tx * TS + 16, t.ty * TS + 16) < ((12 + extra) * TS) ** 2) return true;
    }
    return false;
  }
}
