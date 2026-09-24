// ============================================================
// Dog Quest - dungeon generation & rendering
// tiles: 0 wall, 1 floor, 2 gate (solid while closed), 3 pillar, 4 hazard pool (solid)
// ============================================================
'use strict';

const DT = { WALL: 0, FLOOR: 1, GATE: 2, PILLAR: 3, POOL: 4 };

class Dungeon {
  constructor(def) {
    this.def = def;
    this.theme = THEMES[def.theme];
    this.rng = new RNG(hashStr(def.id) + 7);
    this.gateClosed = false;
    this.generate();
    this.cache = new ChunkCache((g, tx, ty, n) => this.paintChunk(g, tx, ty, n), 8, 96);
  }

  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : DT.WALL; }
  solidTile(x, y) {
    const t = this.tile(x, y);
    if (t === DT.FLOOR) return false;
    if (t === DT.GATE) return this.gateClosed;
    return true;
  }
  isSolid(px, py) { return this.solidTile(Math.floor(px / TS), Math.floor(py / TS)); }
  regionAt() { return this.def.region; }
  inSafeZone() { return false; }

  generate() {
    const rng = this.rng, def = this.def;
    const GW = 5, GH = 4;
    const CW = def.final ? 22 : 20, CH = def.final ? 16 : 15;
    this.w = GW * CW + 2; this.h = GH * CH + 2;
    this.tiles = new Uint8Array(this.w * this.h);
    const grid = new Array(GW * GH).fill(-1);
    const rooms = [];
    const links = [];
    const sx = rng.int(0, GW - 1), sy = rng.int(0, GH - 1);
    const addRoom = (gx, gy, parent) => {
      const r = { gx, gy, i: rooms.length, parent, depth: parent ? parent.depth + 1 : 0, links: [] };
      rooms.push(r); grid[gy * GW + gx] = r.i;
      if (parent) { links.push([parent.i, r.i]); parent.links.push(r.i); r.links.push(parent.i); }
      return r;
    };
    addRoom(sx, sy, null);
    let guard = 0;
    while (rooms.length < def.rooms && guard++ < 1000) {
      const base = rng.chance(0.6) ? rooms[rooms.length - 1] : rng.pick(rooms);
      const dirs = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      for (const [dx, dy] of dirs) {
        const nx = base.gx + dx, ny = base.gy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || grid[ny * GW + nx] !== -1) continue;
        addRoom(nx, ny, base);
        break;
      }
    }
    // a couple of extra loops between neighbouring rooms (never into the boss room)
    let boss = rooms[0];
    for (const r of rooms) if (r.depth > boss.depth) boss = r;
    this.bossIndex = boss.i;
    for (const r of rooms) {
      if (r === boss) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const j = grid[(r.gy + dy) * GW + r.gx + dx];
        if (r.gx + dx >= GW || r.gy + dy >= GH || j == null || j < 0 || j === boss.i) continue;
        if (r.links.includes(j)) continue;
        if (rng.chance(0.3)) { links.push([r.i, j]); r.links.push(j); rooms[j].links.push(r.i); }
      }
    }
    // room rectangles
    for (const r of rooms) {
      let w, h;
      if (r === boss) { w = CW - 3; h = CH - 3; }
      else if (r.i === 0) { w = rng.int(9, 11); h = rng.int(7, 9); }
      else { w = rng.int(10, CW - 5); h = rng.int(8, CH - 5); }
      const x = 1 + r.gx * CW + Math.floor((CW - w) / 2) + (r === boss ? 0 : rng.int(-1, 1));
      const y = 1 + r.gy * CH + Math.floor((CH - h) / 2) + (r === boss ? 0 : rng.int(-1, 1));
      Object.assign(r, { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.tiles[yy * this.w + xx] = DT.FLOOR;
    }
    // corridors (3 wide)
    const carve = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.inb(x + dx, y + dy) && x + dx > 0 && y + dy > 0 && x + dx < this.w - 1 && y + dy < this.h - 1) this.tiles[(y + dy) * this.w + x + dx] = DT.FLOOR; };
    for (const [a, b] of links) {
      const A = rooms[a], B = rooms[b];
      if (A.gx !== B.gx) { // horizontal neighbours: go horizontally at a shared row
        const y = clamp(Math.round((A.cy + B.cy) / 2), Math.max(A.y, B.y) + 1, Math.min(A.y + A.h, B.y + B.h) - 2);
        const x0 = Math.min(A.cx, B.cx), x1 = Math.max(A.cx, B.cx);
        for (let x = x0; x <= x1; x++) carve(x, y);
      } else {
        const x = clamp(Math.round((A.cx + B.cx) / 2), Math.max(A.x, B.x) + 1, Math.min(A.x + A.w, B.x + B.w) - 2);
        const y0 = Math.min(A.cy, B.cy), y1 = Math.max(A.cy, B.cy);
        for (let y = y0; y <= y1; y++) carve(x, y);
      }
    }
    this.rooms = rooms;
    const B = boss;
    // gate tiles: floor tiles in the 1-tile ring around the boss room
    this.gateTiles = [];
    for (let yy = B.y - 1; yy <= B.y + B.h; yy++) for (let xx = B.x - 1; xx <= B.x + B.w; xx++) {
      const inside = xx >= B.x && xx < B.x + B.w && yy >= B.y && yy < B.y + B.h;
      if (inside) continue;
      if (this.tile(xx, yy) === DT.FLOOR) { this.tiles[yy * this.w + xx] = DT.GATE; this.gateTiles.push([xx, yy]); }
    }

    // props: pillars, pools, decorations, torches
    this.props = [];
    this.torches = [];
    const th = this.theme;
    for (const r of rooms) {
      if (r.w >= 12 && r.h >= 9 && r.i !== 0) {
        const pts = [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]];
        const hazard = th.deco.includes('lavapool') && r !== B;
        for (const [px, py] of pts) {
          if (hazard && rng.chance(0.5)) {
            this.tiles[py * this.w + px] = DT.POOL;
          } else {
            this.tiles[py * this.w + px] = DT.PILLAR;
            this.props.push({ type: 'pillar', x: px * TS + 16, y: py * TS + 30 });
          }
        }
      }
      // floor decorations (non-solid)
      const n = rng.int(2, 5);
      for (let k = 0; k < n; k++) {
        const px = rng.int(r.x + 1, r.x + r.w - 2), py = rng.int(r.y + 1, r.y + r.h - 2);
        if (this.tile(px, py) !== DT.FLOOR) continue;
        this.props.push({ type: 'ddeco', kind: rng.pick(th.deco.filter(d => d !== 'pillar' && d !== 'lavapool')) || 'rock', x: px * TS + rng.int(6, 26), y: py * TS + rng.int(10, 28), seed: rng.next() });
      }
      // torches on top wall
      for (let xx = r.x + 2; xx < r.x + r.w - 1; xx += 4) {
        if (this.tile(xx, r.y - 1) === DT.WALL) this.torches.push({ x: xx * TS + 16, y: (r.y - 1) * TS + 20 });
      }
    }
    // start / boss / exit
    const S = rooms[0];
    this.start = { x: S.cx * TS + 16, y: (S.cy + 1) * TS + 16 };
    this.exitPortal = { x: S.cx * TS + 16, y: (S.cy - 1) * TS + 24 };
    this.bossSpawn = { x: B.cx * TS + 16, y: (B.cy - 1) * TS + 16 };
    this.bossRoom = B;
    // enemy spawns
    this.spawns = [];
    for (const r of rooms) {
      if (r.i === 0 || r === B) continue;
      const cnt = rng.int(2, 3) + (def.level >= 12 ? 1 : 0) + (r.w * r.h > 150 ? 1 : 0);
      for (let k = 0; k < cnt; k++) {
        for (let tries = 0; tries < 20; tries++) {
          const px = rng.int(r.x + 1, r.x + r.w - 2), py = rng.int(r.y + 1, r.y + r.h - 2);
          if (this.tile(px, py) !== DT.FLOOR) continue;
          this.spawns.push({ room: r.i, type: rng.pick(def.enemies), x: px * TS + 16, y: py * TS + 20 });
          break;
        }
      }
    }
    // chests: prefer dead ends
    this.chests = [];
    const cand = rooms.filter(r => r.i !== 0 && r !== B).sort((a, b) => (a.links.length - b.links.length) || (b.depth - a.depth));
    def.chests.forEach((tier, i) => {
      const r = cand[i % Math.max(1, cand.length)] || S;
      const off = Math.floor(i / Math.max(1, cand.length)) * 2 - (cand.length ? 0 : 3);
      let px = r.cx + off, py = r.y + 1;
      if (this.tile(px, py) !== DT.FLOOR) { px = r.cx; py = r.cy; }
      this.chests.push({ id: def.id + '_' + i, tier, x: px * TS + 16, y: py * TS + 26, tx: px, ty: py });
    });
  }

  roomAt(px, py) {
    const tx = px / TS, ty = py / TS;
    for (const r of this.rooms) if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r.i;
    return -1;
  }
  insideBossRoom(px, py, margin = 1) {
    const r = this.bossRoom, tx = px / TS, ty = py / TS;
    return tx >= r.x + margin && tx < r.x + r.w - margin && ty >= r.y + margin && ty < r.y + r.h - margin;
  }

  // ---------- rendering ----------
  paintChunk(g, tx0, ty0, n) {
    const th = this.theme;
    for (let y = ty0; y < ty0 + n; y++) for (let x = tx0; x < tx0 + n; x++) {
      const t = this.tile(x, y), px = x * TS, py = y * TS;
      const h1 = hash2(x, y, 5), h2 = hash2(x, y, 6);
      if (t === DT.WALL) {
        let nearFloor = false;
        for (let dy = -1; dy <= 1 && !nearFloor; dy++) for (let dx = -1; dx <= 1; dx++) { const q = this.tile(x + dx, y + dy); if (q !== DT.WALL) { nearFloor = true; break; } }
        if (!nearFloor) { g.fillStyle = '#08070a'; g.fillRect(px, py, TS, TS); continue; }
        g.fillStyle = th.wallTop; g.fillRect(px, py, TS, TS);
        g.fillStyle = shade(th.wallTop, 0.08);
        if (h1 < 0.5) g.fillRect(px + 3, py + 3, 12, 6);
        const below = this.tile(x, y + 1);
        if (below !== DT.WALL) { // front face
          g.fillStyle = th.wall; g.fillRect(px, py + 12, TS, 20);
          g.strokeStyle = shade(th.wall, -0.3); g.lineWidth = 1;
          for (let k = 0; k < 2; k++) {
            const yy = py + 12 + k * 10;
            g.beginPath(); g.moveTo(px, yy + 0.5); g.lineTo(px + TS, yy + 0.5); g.stroke();
            const off = ((x + k) % 2) * 16;
            g.beginPath(); g.moveTo(px + off + 0.5, yy); g.lineTo(px + off + 0.5, yy + 10); g.stroke();
          }
          g.fillStyle = shade(th.wallTop, 0.2); g.fillRect(px, py + 10, TS, 2);
        }
        continue;
      }
      // floor-like
      const fc = ((x + y) % 2 === 0) ? th.floor : th.floor2;
      g.fillStyle = shade(fc, (h1 - 0.5) * 0.08); g.fillRect(px, py, TS, TS);
      g.strokeStyle = shade(th.floor, -0.15); g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
      if (h2 < 0.15) { g.strokeStyle = shade(th.floor, -0.3); g.beginPath(); g.moveTo(px + 6, py + 8); g.lineTo(px + 14, py + 16); g.lineTo(px + 12, py + 24); g.stroke(); }
      if (this.tile(x, y - 1) === DT.WALL) { const gr = g.createLinearGradient(0, py, 0, py + 14); gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px, py, TS, 14); }
      if (t === DT.POOL) {
        const lava = th.deco.includes('lavapool');
        g.fillStyle = lava ? '#b8300a' : '#2a4a6a';
        g.beginPath(); g.ellipse(px + 16, py + 16, 15, 13, 0, 0, TAU); g.fill();
        g.fillStyle = lava ? '#ff7a2a' : '#4a8ac0';
        g.beginPath(); g.ellipse(px + 16, py + 16, 11, 9, 0, 0, TAU); g.fill();
      }
      if (t === DT.PILLAR) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px + 16, py + 28, 14, 5, 0, 0, TAU); g.fill(); }
    }
  }

  drawGates(ctx, t) {
    if (!this.gateClosed) return;
    for (const [x, y] of this.gateTiles) {
      const px = x * TS, py = y * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#6a6a72';
      for (let k = 0; k < 4; k++) ctx.fillRect(px + 3 + k * 8, py - 12, 3, TS + 10);
      ctx.fillStyle = '#8a8a94'; ctx.fillRect(px, py - 12, TS, 3); ctx.fillRect(px, py + 12, TS, 3);
      ctx.fillStyle = `rgba(255,80,60,${0.25 + Math.sin(t * 5) * 0.15})`; ctx.fillRect(px, py - 12, TS, TS + 10);
    }
  }
}

function drawDungeonProp(ctx, p, theme, t) {
  const th = THEMES[theme];
  if (p.type === 'pillar') {
    ctx.save(); ctx.translate(p.x, p.y);
    if (theme === 'ice') {
      fillPoly(ctx, '#7ab8e0', [-12, 0, -8, -44, 0, -60, 8, -40, 12, 0]);
      fillPoly(ctx, '#d0f0ff', [-6, -8, -4, -44, 0, -56, 2, -20]);
    } else if (theme === 'lava' || theme === 'mine' || theme === 'cave') {
      fillPoly(ctx, shade(th.wall, 0.2), [-14, 0, -11, -30, -4, -46, 6, -42, 12, -24, 14, 0]);
      fillPoly(ctx, shade(th.wall, 0.4), [-9, -26, -4, -42, 4, -38, 0, -22]);
      if (theme === 'lava') line(ctx, '#ff6a2a', 1.5, -4, -10, 3, -26);
      if (theme === 'mine') { fillPoly(ctx, '#9ff4ff', [2, -18, 6, -30, 9, -18]); }
    } else {
      F(ctx, shade(th.wallTop, 0.1)); ctx.fillRect(-12, -6, 24, 6);
      F(ctx, shade(th.wallTop, 0.25)); ctx.fillRect(-9, -52, 18, 46);
      F(ctx, shade(th.wallTop, 0.4)); ctx.fillRect(-9, -52, 5, 46);
      F(ctx, shade(th.wallTop, 0.1)); ctx.fillRect(-12, -58, 24, 7);
      if (theme === 'castle') { F(ctx, '#8a1f2a'); ctx.fillRect(-7, -48, 14, 20); fillPoly(ctx, '#8a1f2a', [-7, -28, 0, -22, 7, -28]); drawPaw(ctx, 0, -40, 3, '#ffd23f'); }
      if (theme === 'ruin') { F(ctx, '#5a9a3a'); ctx.fillRect(-9, -52, 18, 5); ctx.fillRect(4, -47, 4, 20); }
    }
    ctx.restore();
    return;
  }
  // non-solid floor decorations
  const { x, y } = p;
  switch (p.kind) {
    case 'rock': fillEll(ctx, shade(th.wallTop, 0.15), x, y - 3, 7, 5); fillEll(ctx, shade(th.wallTop, 0.35), x - 2, y - 5, 3, 2); break;
    case 'mushroom': line(ctx, '#e8d8c8', 2, x, y, x, y - 6); fillEll(ctx, p.seed < 0.5 ? '#c84a4a' : '#6ab5ff', x, y - 7, 5, 3.5); fillCirc(ctx, '#ffffff', x - 1.5, y - 8, 0.9); break;
    case 'bones': drawBone(ctx, x, y - 2, 12, 0.5, '#e8e0d0', p.seed * 3); fillCirc(ctx, '#e8e0d0', x + 6, y - 4, 3); break;
    case 'crystal': {
      const c = theme === 'lava' ? '#ff6a2a' : theme === 'mine' ? '#9ff4ff' : '#b0e8ff';
      ctx.globalAlpha = 0.3 + Math.sin(t * 2 + p.seed * 9) * 0.1; fillCirc(ctx, c, x, y - 8, 10); ctx.globalAlpha = 1;
      fillPoly(ctx, c, [x - 4, y, x - 2, y - 14, x + 1, y - 18, x + 3, y - 12, x + 4, y]);
      fillPoly(ctx, shade(c, 0.5), [x - 2, y - 2, x - 1, y - 13, x + 1, y - 16, x, y - 2]);
      break;
    }
    case 'urn': fillEll(ctx, '#a0602a', x, y - 7, 6, 7); F(ctx, '#7a4a1a'); ctx.fillRect(x - 3, y - 16, 6, 3); line(ctx, '#ffd23f', 1.4, x - 5, y - 8, x + 5, y - 8); break;
    case 'statue': drawShadow(ctx, x, y, 10); F(ctx, '#8a8a94'); ctx.fillRect(x - 8, y - 6, 16, 6); drawCat(ctx, { x, y: y - 6, def: Object.assign({}, ENEMIES.tabby, { fur: '#9a9aa4', belly: '#aab', stripe: '#8a8a94', eye: '#6a6a72', acc: 'none' }), scale: 0.7, t: 0, facing: p.seed < 0.5 ? 1 : -1 }); break;
    case 'icicle': fillPoly(ctx, '#d0f0ff', [x - 5, y, x, y - 18, x + 5, y]); break;
    case 'vines': S(ctx, '#4a8a2a'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x, y - 10, x + 8, y - 2); ctx.stroke(); fillEll(ctx, '#5aa83a', x, y - 5, 3, 2); break;
    case 'candle': F(ctx, '#f4f0e6'); ctx.fillRect(x - 2, y - 10, 4, 10); fillEll(ctx, '#ffd23f', x, y - 13 + Math.sin(t * 10 + p.seed) * 0.6, 2, 3.5); break;
    case 'cart': F(ctx, '#6b4520'); ctx.fillRect(x - 10, y - 14, 20, 10); fillCirc(ctx, '#3a3a42', x - 6, y - 3, 3.5); fillCirc(ctx, '#3a3a42', x + 6, y - 3, 3.5); fillEll(ctx, '#9ff4ff', x - 2, y - 15, 4, 3); break;
    case 'banner': F(ctx, '#8a1f2a'); ctx.fillRect(x - 6, y - 26, 12, 20); drawPaw(ctx, x, y - 17, 3, '#ffd23f'); break;
    default: fillEll(ctx, shade(th.floor, -0.3), x, y - 2, 5, 3);
  }
}

function drawTorch(ctx, x, y, t, color) {
  F(ctx, '#5a3a1a'); ctx.fillRect(x - 2, y - 6, 4, 10);
  const f = Math.sin(t * 13 + x) * 1.2;
  fillEll(ctx, color, x, y - 10 + f * 0.3, 4 + f * 0.3, 6);
  fillEll(ctx, '#fff8c0', x, y - 9, 2, 3);
}
