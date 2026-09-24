// ============================================================
// Dog Quest - HUD, prompts and overlay menus
// ============================================================
'use strict';

const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
const PCOLORS = ['#4fb8ff', '#ff6a5a'];

function uiFont(size, weight = 600) { return `${weight} ${size}px ${FONT}`; }
function uiText(ctx, s, x, y, size = 16, color = '#fff', align = 'left', weight = 600, outline = true) {
  ctx.font = uiFont(size, weight);
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (outline) { ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function uiPanel(ctx, x, y, w, h, opts = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x + 3, y + 4, w, h, 12); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, opts.top || '#2c3350'); g.addColorStop(1, opts.bottom || '#1a1e30');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = opts.border || '#e8c878'; roundRect(ctx, x, y, w, h, 12); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 9); ctx.stroke();
  ctx.restore();
}
function uiBar(ctx, x, y, w, h, frac, color, bg = 'rgba(0,0,0,0.55)', ghost = null) {
  ctx.fillStyle = bg; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  frac = clamp(frac, 0, 1);
  if (ghost != null && ghost > frac) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; roundRect(ctx, x, y, Math.max(h, w * ghost), h, h / 2); ctx.fill(); }
  if (frac > 0) {
    ctx.fillStyle = color; roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; roundRect(ctx, x + 2, y + 1.5, Math.max(0, w * frac - 4), h * 0.35, h * 0.2); ctx.fill();
  }
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
}
function uiKey(ctx, label, x, y, color = '#ffffff') {
  ctx.font = uiFont(12, 700);
  const w = Math.max(20, ctx.measureText(label).width + 10);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, x, y - 13, w, 18, 5); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; roundRect(ctx, x, y - 13, w, 18, 5); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(label, x + w / 2, y + 1);
  return w;
}

const UI = {
  hpGhost: [1, 1],

  open(ov) { Game.overlays.push(ov); Input.consume(); },
  close(ov) { const i = Game.overlays.indexOf(ov); if (i >= 0) Game.overlays.splice(i, 1); Input.consume(); },

  dialog(lines, onDone) { this.open(new DialogOverlay(lines, onDone)); },

  talkTo(npc) {
    const G = Game;
    const m = G.currentMainQuest();
    const look = npc.look;
    if (m && QUESTS[m].obj.type === 'talk' && QUESTS[m].obj.npc === npc.id) {
      const q = QUESTS[m];
      this.dialog(q.talk.map(t => ({ name: npc.name, text: t, look })), () => G.questEvent('talk', npc.id));
      Sound.sfx('bark', { pitch: 1.1 });
      return;
    }
    let lines = npc.npc.lines;
    // context aware elder hints
    if (npc.id === 'elder' && m) {
      const tq = QUESTS[m];
      lines = [`Your current task: ${tq.desc}`].concat(lines);
    }
    const line = lines[(npc.talkIdx = ((npc.talkIdx || 0) + 1)) % lines.length];
    this.dialog([{ name: npc.name, text: npc.id === 'elder' && m ? lines[0] : line, look }]);
    Sound.sfx('bark', { pitch: 1.2 });
  },

  // ---------------- world-space drawing ----------------
  drawTelegraph(ctx, tt) {
    const k = clamp(tt.t / tt.dur, 0, 1);
    const col = tt.color || '#ff3a2a';
    ctx.save();
    const fillOuter = rgba(col, tt.friendly ? 0.12 : 0.16), stroke = rgba(col, 0.7), fillIn = rgba(col, tt.friendly ? 0.25 : 0.38);
    ctx.lineWidth = 2;
    const shape = (scale) => {
      ctx.beginPath();
      switch (tt.kind) {
        case 'circle': ctx.ellipse(tt.x, tt.y, Math.max(0.1, tt.r * scale), Math.max(0.1, tt.r * scale * 0.62), 0, 0, TAU); break;
        case 'cone': {
          ctx.save(); ctx.translate(tt.x, tt.y); ctx.scale(1, 0.62);
          const a = Math.atan2(Math.sin(tt.angle) / 0.62, Math.cos(tt.angle));
          ctx.moveTo(0, 0); ctx.arc(0, 0, Math.max(0.1, tt.r * scale), a - tt.spread, a + tt.spread); ctx.closePath();
          ctx.restore(); break;
        }
        case 'line': {
          const dx = Math.cos(tt.angle), dy = Math.sin(tt.angle), nx = -dy, ny = dx, hw = tt.width / 2, L = tt.len * scale;
          ctx.moveTo(tt.x + nx * hw, tt.y + ny * hw); ctx.lineTo(tt.x + nx * hw + dx * L, tt.y + ny * hw + dy * L);
          ctx.lineTo(tt.x - nx * hw + dx * L, tt.y - ny * hw + dy * L); ctx.lineTo(tt.x - nx * hw, tt.y - ny * hw); ctx.closePath();
          break;
        }
        case 'ring': {
          const r2 = tt.r2, r = lerp(tt.r2, tt.r, scale);
          ctx.ellipse(tt.x, tt.y, Math.max(0.1, r), Math.max(0.1, r * 0.62), 0, 0, TAU);
          ctx.ellipse(tt.x, tt.y, Math.max(0.1, r2), Math.max(0.1, r2 * 0.62), 0, TAU, 0, true);
          break;
        }
      }
    };
    shape(1); ctx.fillStyle = fillOuter; ctx.fill(); ctx.strokeStyle = stroke; ctx.stroke();
    shape(k); ctx.fillStyle = fillIn; ctx.fill();
    if (k > 0.85 && !tt.friendly) { shape(1); ctx.strokeStyle = `rgba(255,255,255,${(k - 0.85) * 4})`; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
  },

  drawEnemyBar(ctx, e) {
    if (e.dead || e.boss) return;
    const w = 36 * Math.sqrt(e.size), x = e.x - w / 2, y = e.y - e.hgt - 20 * Math.sqrt(e.size) - (e.z || 0);
    if (e.alertT > 0 && e.alertT < 0.8) {
      const s = 1 + Math.sin((0.8 - e.alertT) * 12) * 0.2;
      uiText(ctx, '!', e.x, y - 8, 22 * s, '#ffd23f', 'center', 800);
    }
    if (e.hp >= e.maxHp && !e.aggro) return;
    const diff = e.level - Game.state.level;
    const lc = diff >= 5 ? '#ff5a4a' : diff >= 2 ? '#ffd23f' : diff <= -5 ? '#9a9a9a' : '#ffffff';
    uiText(ctx, `Lv${e.level}`, x - 3, y + 6, 10, lc, 'right', 700);
    uiBar(ctx, x, y, w, 6, e.hp / e.maxHp, '#ff4a4a');
  },

  drawPlayerTag(ctx, p) {
    if (Game.players.length < 2) return;
    const y = p.y - 58;
    if (p.down) {
      const k = clamp((p.reviveT || 0) / 2, 0, 1);
      uiText(ctx, `Revive: ${Math.ceil(Math.max(0, p.downT))}s`, p.x, y - 6, 12, '#ffb0b0', 'center', 700);
      uiBar(ctx, p.x - 22, y, 44, 6, k, '#6aff8a');
      return;
    }
    const c = PCOLORS[p.pid];
    fillPoly(ctx, c, [p.x - 6, y, p.x + 6, y, p.x, y + 7]);
    uiText(ctx, 'P' + (p.pid + 1), p.x, y - 3, 12, c, 'center', 800);
  },

  drawPrompt(ctx, p) {
    const it = p.interactable;
    const key = Input.label(p.device, 'interact');
    const label = it.label;
    ctx.font = uiFont(13, 700);
    const tw = ctx.measureText(label).width;
    ctx.font = uiFont(12, 700);
    const kw = Math.max(20, ctx.measureText(key).width + 10);
    const w = tw + kw + 20, h = 26;
    const x = it.x - w / 2, y = it.y - 64 - (p.pid * 30) + Math.sin(Game.time * 4) * 2;
    ctx.fillStyle = 'rgba(20,24,40,0.88)'; roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = Game.players.length > 1 ? PCOLORS[p.pid] : '#e8c878'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 8); ctx.stroke();
    uiKey(ctx, key, x + 6, y + 18, '#ffd23f');
    uiText(ctx, label, x + 12 + kw, y + 18, 13, '#ffffff', 'left', 700, false);
  },

  // ---------------- HUD ----------------
  drawHUD(ctx) {
    const G = Game, st = G.state;
    G.players.forEach((p, i) => this.drawPlayerPanel(ctx, p, i));
    // gold + keys + seals (top center)
    const cx = VIEW_W / 2;
    const w = 250;
    ctx.fillStyle = 'rgba(15,18,30,0.72)'; roundRect(ctx, cx - w / 2, 8, w, 34, 17); ctx.fill();
    ctx.strokeStyle = 'rgba(232,200,120,0.6)'; ctx.lineWidth = 1.5; roundRect(ctx, cx - w / 2, 8, w, 34, 17); ctx.stroke();
    drawCoin(ctx, cx - w / 2 + 20, 25, G.time * 0.3, 8);
    uiText(ctx, fmt(st.gold), cx - w / 2 + 34, 31, 16, '#ffd23f', 'left', 700);
    for (let k = 1; k <= 5; k++) {
      ctx.globalAlpha = st.keys[k] ? 1 : 0.22;
      drawKey(ctx, k, cx + 6 + (k - 1) * 20, 25, 18, -0.5);
    }
    ctx.globalAlpha = 1;
    let si = 0;
    for (const s of ['sun', 'frost', 'moon', 'flame']) {
      const has = st.seals[s];
      ctx.globalAlpha = has ? 1 : 0.25;
      fillCirc(ctx, SEALS[s].color, cx + 18 + si * 16, 52, 6);
      if (has) fillCirc(ctx, '#ffffff', cx + 16 + si * 16, 50, 2);
      si++;
    }
    ctx.globalAlpha = 1;
    this.drawQuestTracker(ctx);
    this.drawMinimap(ctx);
    this.drawBossBar(ctx);
    this.drawBanner(ctx);
    this.drawItemGet(ctx);
  },

  drawPlayerPanel(ctx, p, i) {
    const st = Game.state, S = p.stats;
    const right = i === 1;
    const W = 250, H = i === 0 ? 92 : 84;
    const x = right ? VIEW_W - W - 10 : 10, y = 8;
    ctx.fillStyle = 'rgba(15,18,30,0.72)'; roundRect(ctx, x, y, W, H, 14); ctx.fill();
    ctx.strokeStyle = Game.players.length > 1 ? PCOLORS[i] : 'rgba(232,200,120,0.7)'; ctx.lineWidth = 2; roundRect(ctx, x, y, W, H, 14); ctx.stroke();
    // portrait
    const px = right ? x + W - 40 : x + 40, py = y + 38;
    fillCirc(ctx, '#2c3350', px, py, 28);
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, 27, 0, TAU); ctx.clip();
    drawDog(ctx, { x: px - 14, y: py + 34, facing: right ? -1 : 1, t: Game.time, look: p.look, equip: { helmet: S.helmet, armor: S.armor }, scale: 1.6, flash: p.flashT > 0 ? '#ff8a8a' : null, dead: p.down ? 0.01 : 0 });
    ctx.restore();
    ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 28, 0, TAU); ctx.stroke();
    // level badge
    fillCirc(ctx, '#ffd23f', px + (right ? -22 : 22), py + 22, 12);
    uiText(ctx, String(st.level), px + (right ? -22 : 22), py + 27, 13, '#3a2a00', 'center', 800, false);
    // bars
    const bx = right ? x + 12 : x + 76, bw = W - 90;
    uiText(ctx, BREEDS[p.breed].name, right ? bx + bw : bx, y + 20, 14, '#ffffff', right ? 'right' : 'left', 700);
    const ghost = this.hpGhost[i] = lerp(this.hpGhost[i] ?? 1, p.hp / S.maxHp, 0.04);
    uiBar(ctx, bx, y + 26, bw, 14, p.hp / S.maxHp, p.hp / S.maxHp < 0.3 ? '#ff4a4a' : '#56d364', 'rgba(0,0,0,0.55)', ghost);
    uiText(ctx, `${Math.ceil(p.hp)}/${S.maxHp}`, bx + bw / 2, y + 37, 11, '#ffffff', 'center', 700);
    uiBar(ctx, bx, y + 43, bw, 9, p.mp / S.maxMp, '#4f9bff');
    if (p.shield) uiBar(ctx, bx, y + 22, bw * clamp(p.shield.hp / 150, 0.1, 1), 4, 1, '#f4f0e6');
    // spell slots
    for (let s = 0; s < 4; s++) {
      const sx = bx + s * 36, sy = y + 56;
      const id = p.spells[s];
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, sx, sy, 30, 30, 7); ctx.fill();
      if (id) {
        const cost = SPELLS[id].cost;
        ctx.globalAlpha = p.mp >= cost ? 1 : 0.4;
        drawSpellIcon(ctx, id, sx + 15, sy + 15, 28, Game.time);
        ctx.globalAlpha = 1;
        const cd = p.spellCd[id] || 0;
        if (cd > 0) {
          const k = cd / SPELLS[id].cd;
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(sx + 15, sy + 15); ctx.arc(sx + 15, sy + 15, 15, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(232,200,120,0.6)'; ctx.lineWidth = 1.2; roundRect(ctx, sx, sy, 30, 30, 7); ctx.stroke();
      const lb = Input.label(p.device, 'spell' + s);
      ctx.font = uiFont(9, 700);
      const lw = ctx.measureText(lb).width + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, sx + 30 - lw, sy + 21, lw, 11, 3); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'center'; ctx.fillText(lb, sx + 30 - lw / 2, sy + 30);
    }
    // xp bar (shared) on P1 panel
    if (i === 0) {
      const need = xpForLevel(st.level);
      uiBar(ctx, x + 10, y + H - 3, W - 20, 5, st.level >= MAX_LEVEL ? 1 : st.xp / need, '#b48cff');
    }
  },

  drawQuestTracker(ctx) {
    const G = Game;
    if (G.boss && !G.boss.dead) return;
    let id = G.trackedQuest();
    let q = id && QUESTS[id];
    if (G.dungeon) {
      const dg = G.dungeon, def = dg.def;
      const cleared = G.state.cleared[def.id];
      q = { main: !!def.main, name: def.name, desc: cleared ? 'Dungeon cleared! Open the chests and use the golden portal to leave.' : `Find and defeat ${BOSSES[def.boss].name} in the deepest chamber.` };
      id = null;
    }
    if (!q) return;
    const x = 10, w = 300;
    ctx.font = uiFont(12, 500);
    const lines = wrapText(ctx, q.desc, w - 24).slice(0, 3);
    const h = 34 + lines.length * 15;
    const y = VIEW_H - h - 10;
    ctx.fillStyle = 'rgba(15,18,30,0.72)'; roundRect(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = q.main ? 'rgba(255,210,63,0.7)' : 'rgba(159,224,255,0.7)'; ctx.lineWidth = 1.5; roundRect(ctx, x, y, w, h, 12); ctx.stroke();
    drawStar(ctx, q.main ? '#ffd23f' : '#9fe0ff', x + 16, y + 17, 7);
    const prog = id ? G.questProgressText(id) : '';
    uiText(ctx, q.name + (prog ? `  (${prog})` : ''), x + 28, y + 22, 14, q.main ? '#ffd23f' : '#9fe0ff', 'left', 700);
    lines.forEach((l, i) => uiText(ctx, l, x + 12, y + 40 + i * 15, 12, '#e0e0e0', 'left', 500, false));
    // compass
    if (G.dungeon || !id) return;
    const tg = G.questTarget(id);
    if (!tg) return;
    const cam = G.cam, z = cam.zoom;
    const sx = (tg.x - cam.x) * z + VIEW_W / 2, sy = (tg.y - cam.y) * z + VIEW_H / 2;
    const m = 50;
    if (sx > m && sx < VIEW_W - m && sy > m + 60 && sy < VIEW_H - m) {
      const b = Math.sin(G.time * 5) * 5;
      fillPoly(ctx, '#3a2a00', [sx - 10, sy - 72 + b, sx + 10, sy - 72 + b, sx, sy - 56 + b]);
      fillPoly(ctx, '#ffd23f', [sx - 8, sy - 73 + b, sx + 8, sy - 73 + b, sx, sy - 59 + b]);
      drawStar(ctx, '#ffd23f', sx, sy - 84 + b, 9);
    } else {
      const a = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
      const ex = clamp(VIEW_W / 2 + Math.cos(a) * 1000, m, VIEW_W - m);
      const ey = clamp(VIEW_H / 2 + Math.sin(a) * 1000, m + 70, VIEW_H - m - 20);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      fillCirc(ctx, 'rgba(15,18,30,0.75)', 0, 0, 20);
      fillPoly(ctx, '#ffd23f', [16, 0, -8, -11, -3, 0, -8, 11]);
      ctx.restore();
      const d = Math.round(dist(G.players[0].x, G.players[0].y, tg.x, tg.y) / TS);
      uiText(ctx, d + 'm', ex, ey + 34, 12, '#ffd23f', 'center', 700);
    }
  },

  drawMinimap(ctx) {
    const G = Game;
    const W = 176, H = 124, x = VIEW_W - W - 10, y = VIEW_H - H - 10;
    ctx.save();
    ctx.fillStyle = 'rgba(15,18,30,0.8)'; roundRect(ctx, x - 3, y - 3, W + 6, H + 6, 10); ctx.fill();
    roundRect(ctx, x, y, W, H, 8); ctx.clip();
    const p = G.players[0];
    if (!G.dungeon) {
      const s = 3; // px per tile
      const ptx = G.cam.x / TS, pty = G.cam.y / TS;
      const ox = x + W / 2 - ptx * s, oy = y + H / 2 - pty * s;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(G.world.minimap, ox, oy, G.world.w * s, G.world.h * s);
      ctx.imageSmoothingEnabled = true;
      const toS = (wx, wy) => [ox + wx / TS * s, oy + wy / TS * s];
      for (const id of TOWN_ORDER) { const t = TOWNS[id]; const [a, b] = toS(t.tx * TS, t.ty * TS); fillCirc(ctx, '#ffffff', a, b, 5); fillCirc(ctx, t.color, a, b, 3.5); }
      for (const e of G.world.entrances) { const [a, b] = toS(e.x, e.y); fillPoly(ctx, G.state.cleared[e.dungeon.id] ? '#6ad86a' : '#ff5a4a', [a - 4, b + 3, a + 4, b + 3, a, b - 4]); }
      for (const c of G.world.chests) { if (G.state.chests[c.id]) continue; const [a, b] = toS(c.x, c.y); ctx.fillStyle = KEYS[c.tier].color; ctx.fillRect(a - 1.5, b - 1.5, 3, 3); }
      const id = G.trackedQuest(); const tg = id && G.questTarget(id);
      if (tg) { const [a, b] = toS(tg.x, tg.y); drawStar(ctx, '#ffd23f', clamp(a, x + 6, x + W - 6), clamp(b, y + 6, y + H - 6), 6); }
      for (const e of G.enemies) { if (e.dead) continue; const [a, b] = toS(e.x, e.y); ctx.fillStyle = '#ff6a5a'; ctx.fillRect(a - 1, b - 1, 2, 2); }
      G.players.forEach(pl => { const [a, b] = toS(pl.x, pl.y); fillCirc(ctx, '#000', a, b, 4); fillCirc(ctx, PCOLORS[pl.pid], a, b, 3); });
    } else {
      const dg = G.dungeon;
      if (!dg.mini) {
        const c = document.createElement('canvas'); c.width = dg.w; c.height = dg.h;
        const g = c.getContext('2d');
        for (let yy = 0; yy < dg.h; yy++) for (let xx = 0; xx < dg.w; xx++) {
          const t = dg.tile(xx, yy);
          if (t !== DT.WALL) { g.fillStyle = t === DT.GATE ? '#aa6a6a' : dg.theme.floor; g.fillRect(xx, yy, 1, 1); }
        }
        dg.mini = c;
      }
      if (!dg.miniBox) {
        let x0 = dg.w, y0 = dg.h, x1 = 0, y1 = 0;
        for (const r of dg.rooms) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
        dg.miniBox = { x0: x0 - 2, y0: y0 - 2, w: x1 - x0 + 4, h: y1 - y0 + 4 };
      }
      const mb = dg.miniBox;
      const s = Math.min((W - 8) / mb.w, (H - 8) / mb.h);
      const ox = x + (W - mb.w * s) / 2 - mb.x0 * s, oy = y + (H - mb.h * s) / 2 - mb.y0 * s;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(dg.mini, ox, oy, dg.w * s, dg.h * s);
      ctx.imageSmoothingEnabled = true;
      const toS = (wx, wy) => [ox + wx / TS * s, oy + wy / TS * s];
      const [bx, by] = toS(dg.bossSpawn.x, dg.bossSpawn.y);
      if (!dg.bossDead) drawSkull(ctx, bx, by, 2.5);
      for (const c of dg.chests) if (!G.state.chests[c.id]) { const [a, b] = toS(c.x, c.y); ctx.fillStyle = KEYS[c.tier].color; ctx.fillRect(a - 2, b - 2, 4, 4); }
      const [ex, ey] = toS(dg.exitPortal.x, dg.exitPortal.y); fillCirc(ctx, '#7fe0ff', ex, ey, 3);
      G.players.forEach(pl => { const [a, b] = toS(pl.x, pl.y); fillCirc(ctx, '#000', a, b, 3.5); fillCirc(ctx, PCOLORS[pl.pid], a, b, 2.5); });
    }
    ctx.restore();
    ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 2; roundRect(ctx, x - 3, y - 3, W + 6, H + 6, 10); ctx.stroke();
    uiText(ctx, G.dungeon ? G.dungeon.def.name : (G.townId ? TOWNS[G.townId].name : REGIONS[G.world.regionAt(G.cam.x, G.cam.y)].name), x + W / 2, y - 8, 12, '#ffffff', 'center', 700);
  },

  drawBossBar(ctx) {
    const b = Game.boss;
    if (!b || b.dead) return;
    const w = 520, x = VIEW_W / 2 - w / 2, y = VIEW_H - 46;
    uiText(ctx, b.def.name, VIEW_W / 2, y - 8, 18, b.phase2 ? '#ff6a4a' : '#ffffff', 'center', 800);
    this.bossGhost = lerp(this.bossGhost == null ? 1 : this.bossGhost, b.hp / b.maxHp, 0.03);
    uiBar(ctx, x, y, w, 16, b.hp / b.maxHp, b.phase2 ? '#ff3a2a' : '#e8403a', 'rgba(0,0,0,0.65)', this.bossGhost);
    uiText(ctx, `Lv ${b.level}`, x - 8, y + 13, 13, '#ffd23f', 'right', 700);
  },

  drawBanner(ctx) {
    const b = Game.banner;
    if (!b) return;
    const k = b.t / b.life;
    const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const y = 212;
    const g = ctx.createLinearGradient(VIEW_W / 2 - 300, 0, VIEW_W / 2 + 300, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(VIEW_W / 2 - 300, y - 44, 600, b.sub ? 76 : 58);
    const sc = 1 + Math.max(0, 0.12 - k) * 3;
    uiText(ctx, b.text, VIEW_W / 2, y, 38 * sc, b.color, 'center', 800);
    if (b.sub) uiText(ctx, b.sub, VIEW_W / 2, y + 24, 16, '#e8e8e8', 'center', 600);
    ctx.globalAlpha = 1;
  },

  drawItemGet(ctx) {
    const ig = Game.itemGet;
    if (!ig) return;
    const k = ig.t / 2.6;
    const slide = k < 0.1 ? easeOutBack(k / 0.1) : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
    ctx.font = uiFont(16, 700);
    const w = Math.max(280, ctx.measureText(ig.text).width + 90), h = 64;
    const x = VIEW_W / 2 - w / 2, y = VIEW_H - 150 + (1 - slide) * 60;
    ctx.globalAlpha = clamp(slide, 0, 1);
    uiPanel(ctx, x, y, w, h, { border: ig.item ? TIER_COLORS[ig.item.tier] : '#ffd23f' });
    if (ig.item) { fillCirc(ctx, rgba(TIER_COLORS[ig.item.tier], 0.25), x + 36, y + 32, 24); drawItemIcon(ctx, ig.item, x + 36, y + 32, 38, Game.time); }
    else if (ig.key) drawKey(ctx, ig.key, x + 36, y + 32, 34, -0.5);
    else drawCoin(ctx, x + 36, y + 32, Game.time, 12);
    uiText(ctx, ig.text, x + 68, y + 38, 16, ig.item ? TIER_COLORS[ig.item.tier] : '#ffd23f', 'left', 700);
    ctx.globalAlpha = 1;
  },

  drawToasts(ctx) {
    let y = 72;
    for (const t of Game.toasts.slice(-3)) {
      const k = t.t / t.life;
      const a = k < 0.08 ? k / 0.08 : k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = uiFont(14, 700);
      const w = ctx.measureText(t.text).width + 30;
      ctx.fillStyle = 'rgba(15,18,30,0.8)'; roundRect(ctx, VIEW_W / 2 - w / 2, y, w, 26, 13); ctx.fill();
      uiText(ctx, t.text, VIEW_W / 2, y + 18, 14, t.color, 'center', 700, false);
      y += 30;
    }
    ctx.globalAlpha = 1;
  },
};

// ============================================================
// Dialog overlay
// ============================================================
class DialogOverlay {
  constructor(lines, onDone) { this.lines = lines; this.i = 0; this.chars = 0; this.onDone = onDone; this.choice = 0; this.t = 0; }
  get line() { return this.lines[this.i]; }
  update(dt, m) {
    this.t += dt;
    const L = this.line;
    const prev = Math.floor(this.chars);
    this.chars = Math.min(L.text.length, this.chars + dt * 55);
    if (Math.floor(this.chars) !== prev && Math.floor(this.chars) % 3 === 0) Sound.sfx('talk');
    const done = this.chars >= L.text.length;
    if (L.choices && done) {
      if (m.up || m.left) { this.choice = (this.choice + L.choices.length - 1) % L.choices.length; Sound.sfx('menu'); }
      if (m.down || m.right) { this.choice = (this.choice + 1) % L.choices.length; Sound.sfx('menu'); }
    }
    let adv = m.confirm;
    for (const p of Game.players) if (Input.state(p.device).interact || Input.state(p.device).attack) adv = true;
    if (adv && this.t > 0.15) {
      if (!done) { this.chars = L.text.length; return; }
      Sound.sfx('select');
      if (L.choices) { UI.close(this); if (this.onDone) this.onDone(this.choice); return; }
      this.i++; this.chars = 0;
      if (this.i >= this.lines.length) { UI.close(this); if (this.onDone) this.onDone(-1); }
    } else if (m.back && L.choices && done) { UI.close(this); if (this.onDone) this.onDone(L.choices.length - 1); }
  }
  draw(ctx) {
    const L = this.line;
    if (!L) return;
    const x = 80, w = VIEW_W - 160, h = 132, y = VIEW_H - h - 18;
    uiPanel(ctx, x, y, w, h);
    let tx = x + 22;
    if (L.look) {
      fillCirc(ctx, '#3a4466', x + 64, y + 66, 44);
      ctx.save(); ctx.beginPath(); ctx.arc(x + 64, y + 66, 43, 0, TAU); ctx.clip();
      drawDog(ctx, { x: x + 44, y: y + 124, facing: 1, t: Game.time, look: L.look, equip: { helmet: L.look.helmet ? ITEMS[L.look.helmet] : null }, scale: 2.4, move: 0 });
      ctx.restore();
      ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + 64, y + 66, 44, 0, TAU); ctx.stroke();
      tx = x + 124;
    }
    // name tag
    ctx.font = uiFont(16, 700);
    const nw = ctx.measureText(L.name).width + 28;
    ctx.fillStyle = '#e8c878'; roundRect(ctx, tx - 6, y - 16, nw, 28, 10); ctx.fill();
    uiText(ctx, L.name, tx - 6 + nw / 2, y + 4, 16, '#2a1e00', 'center', 800, false);
    ctx.font = uiFont(17, 500);
    const lines = wrapText(ctx, L.text.slice(0, Math.floor(this.chars)), (x + w - 30) - tx - (L.choices ? 170 : 0));
    lines.slice(0, 4).forEach((l, i) => uiText(ctx, l, tx, y + 40 + i * 23, 17, '#ffffff', 'left', 500, false));
    if (this.chars >= L.text.length) {
      if (L.choices) {
        L.choices.forEach((c, i) => {
          const cy = y + 36 + i * 30, cx = x + w - 180;
          if (i === this.choice) { ctx.fillStyle = 'rgba(232,200,120,0.25)'; roundRect(ctx, cx - 8, cy - 18, 170, 26, 8); ctx.fill(); fillPoly(ctx, '#ffd23f', [cx - 4, cy - 12, cx + 4, cy - 6, cx - 4, cy]); }
          uiText(ctx, c, cx + 10, cy, 16, i === this.choice ? '#ffd23f' : '#ffffff', 'left', 700, false);
        });
      } else {
        const b = Math.sin(Game.time * 6) * 3;
        fillPoly(ctx, '#ffd23f', [x + w - 34, y + h - 26 + b, x + w - 20, y + h - 26 + b, x + w - 27, y + h - 17 + b]);
      }
    }
  }
}

// ============================================================
// List helper used by menus
// ============================================================
function drawList(ctx, items, sel, x, y, w, rowH, maxRows, drawRow) {
  const start = clamp(sel - Math.floor(maxRows / 2), 0, Math.max(0, items.length - maxRows));
  for (let i = start; i < Math.min(items.length, start + maxRows); i++) {
    const ry = y + (i - start) * rowH;
    if (i === sel) { ctx.fillStyle = 'rgba(232,200,120,0.22)'; roundRect(ctx, x, ry, w, rowH - 4, 8); ctx.fill(); ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 1.5; roundRect(ctx, x, ry, w, rowH - 4, 8); ctx.stroke(); }
    drawRow(items[i], i, x, ry, i === sel);
  }
  if (start > 0) fillPoly(ctx, '#e8c878', [x + w / 2 - 8, y - 4, x + w / 2 + 8, y - 4, x + w / 2, y - 12]);
  if (start + maxRows < items.length) { const by = y + maxRows * rowH; fillPoly(ctx, '#e8c878', [x + w / 2 - 8, by, x + w / 2 + 8, by, x + w / 2, by + 8]); }
}

function statLine(label, a, b) {
  const d = b - a;
  return { label, val: Math.round(b), diff: Math.round(d) };
}

// ============================================================
// Pause menu
// ============================================================
class PauseOverlay {
  constructor(player, tab) {
    this.tabs = ['Equipment', 'Spells', 'Quests', 'Map', 'System'];
    this.tab = tab ? this.tabs.findIndex(t => t.toLowerCase() === tab) : 0;
    this.pi = player ? player.pid : 0;
    this.sel = 0; this.sub = null; this.subSel = 0;
    this.t = 0;
  }
  get player() { return Game.players[this.pi] || Game.players[0]; }
  update(dt, m) {
    this.t += dt;
    if (this.sub) return this.updateSub(m);
    if (m.tabL) { this.tab = (this.tab + this.tabs.length - 1) % this.tabs.length; this.sel = 0; Sound.sfx('menu'); }
    if (m.tabR) { this.tab = (this.tab + 1) % this.tabs.length; this.sel = 0; Sound.sfx('menu'); }
    let pause = false;
    for (const p of Game.players) if (Input.state(p.device).pause) pause = true;
    if ((m.back || pause) && this.t > 0.1) { UI.close(this); Sound.sfx('back'); return; }
    const tabName = this.tabs[this.tab];
    const rows = this.rows();
    if (m.up) { this.sel = (this.sel + rows - 1) % Math.max(1, rows); Sound.sfx('menu'); }
    if (m.down) { this.sel = (this.sel + 1) % Math.max(1, rows); Sound.sfx('menu'); }
    if ((tabName === 'Equipment' || tabName === 'Spells') && this.sel === 0 && (m.left || m.right) && Game.players.length > 1) { this.pi = 1 - this.pi; Sound.sfx('menu'); }
    if (tabName === 'System') this.updateSystem(m);
    else if (m.confirm) this.confirm();
  }
  rows() {
    switch (this.tabs[this.tab]) {
      case 'Equipment': return 4;
      case 'Spells': return 5;
      case 'Quests': return Math.max(1, this.questList().length);
      case 'Map': return DUNGEONS.length;
      case 'System': return this.systemRows().length;
    }
    return 1;
  }
  questList() {
    const st = Game.state;
    const act = Object.keys(st.quests).filter(id => st.quests[id].status === 'active').sort((a, b) => (QUESTS[b].main ? 1 : 0) - (QUESTS[a].main ? 1 : 0));
    const done = Object.keys(st.quests).filter(id => st.quests[id].status === 'done');
    return act.concat(done);
  }
  confirm() {
    const tabName = this.tabs[this.tab];
    if (tabName === 'Equipment' && this.sel > 0) {
      const slot = ['weapon', 'helmet', 'armor'][this.sel - 1];
      this.sub = { kind: 'equip', slot, items: this.ownedFor(slot) };
      this.subSel = Math.max(0, this.sub.items.indexOf(this.player.equip[slot]));
      Sound.sfx('select');
    } else if (tabName === 'Spells' && this.sel > 0) {
      const learned = SPELL_ORDER.filter(id => Game.state.spells[id]);
      this.sub = { kind: 'spell', slot: this.sel - 1, items: [null].concat(learned) };
      this.subSel = Math.max(0, this.sub.items.indexOf(this.player.spells[this.sel - 1]));
      Sound.sfx('select');
    }
  }
  ownedFor(slot) {
    const st = Game.state;
    const list = Object.keys(st.inv).filter(id => ITEMS[id] && ITEMS[id].slot === slot).sort((a, b) => ITEMS[a].tier - ITEMS[b].tier || ITEMS[a].name.localeCompare(ITEMS[b].name));
    return slot === 'weapon' ? list : [null].concat(list);
  }
  updateSub(m) {
    const s = this.sub;
    if (m.up) { this.subSel = (this.subSel + s.items.length - 1) % s.items.length; Sound.sfx('menu'); }
    if (m.down) { this.subSel = (this.subSel + 1) % s.items.length; Sound.sfx('menu'); }
    if (m.back) { this.sub = null; Sound.sfx('back'); return; }
    if (m.confirm) {
      const p = this.player;
      if (s.kind === 'equip') {
        p.equip[s.slot] = s.items[this.subSel];
        p.refresh();
        Game.state.party[p.pid] = { breed: p.breed, equip: Object.assign({}, p.equip), spells: p.spells.slice() };
        Sound.sfx('pickup');
      } else {
        const id = s.items[this.subSel];
        if (id) { const other = p.spells.indexOf(id); if (other >= 0) p.spells[other] = p.spells[s.slot]; }
        p.spells[s.slot] = id;
        Game.state.party[p.pid] = { breed: p.breed, equip: Object.assign({}, p.equip), spells: p.spells.slice() };
        Sound.sfx('pickup');
      }
      this.sub = null;
    }
  }
  systemRows() {
    return ['Resume', 'Save Game', `Music Volume: ${Math.round(Sound.settings.music * 10)}`, `Sound Volume: ${Math.round(Sound.settings.sfx * 10)}`, `Screen Shake: ${Game.settings.shake ? 'On' : 'Off'}`, 'Toggle Fullscreen', Game.players.length > 1 ? 'Co-op: Remove Player 2' : 'Co-op: Add Player 2', 'Quit to Title'];
  }
  updateSystem(m) {
    const row = this.sel;
    const adj = (m.right ? 1 : 0) - (m.left ? 1 : 0);
    if (row === 2 && adj) { Sound.settings.music = clamp(Math.round((Sound.settings.music + adj * 0.1) * 10) / 10, 0, 1); Sound.saveSettings(); Sound.sfx('menu'); }
    if (row === 3 && adj) { Sound.settings.sfx = clamp(Math.round((Sound.settings.sfx + adj * 0.1) * 10) / 10, 0, 1); Sound.saveSettings(); Sound.sfx('menu'); }
    if (!m.confirm) return;
    Sound.sfx('select');
    switch (row) {
      case 0: UI.close(this); break;
      case 1: Game.save(); break;
      case 2: Sound.settings.music = Sound.settings.music >= 1 ? 0 : Math.round((Sound.settings.music + 0.1) * 10) / 10; Sound.saveSettings(); break;
      case 3: Sound.settings.sfx = Sound.settings.sfx >= 1 ? 0 : Math.round((Sound.settings.sfx + 0.1) * 10) / 10; Sound.saveSettings(); break;
      case 4: Game.settings.shake = !Game.settings.shake; try { const s = JSON.parse(localStorage.getItem('dogquest_settings') || '{}'); s.shake = Game.settings.shake; localStorage.setItem('dogquest_settings', JSON.stringify(Object.assign(s, Sound.settings))); } catch (e) { /* */ } break;
      case 5: toggleFullscreen(); break;
      case 6:
        if (Game.partyDown()) { Game.toast('Revive your partner first!', '#ff9a8a', 2); Sound.sfx('error'); break; }
        if (Game.players.length > 1) {
          UI.dialog([{ name: 'Co-op', text: `Remove ${BREEDS[Game.players[1].breed].name} (Player 2) from the party? Their gear is kept for next time.`, choices: ['Remove', 'Cancel'] }], c => { if (c === 0) { Game.removePlayer2(); UI.close(this); } });
        } else UI.open(new CoopOverlay(this));
        break;
      case 7: UI.dialog([{ name: 'Quit', text: 'Return to the title screen? Progress since your last save will be lost.', choices: ['Save & Quit', 'Quit without saving', 'Cancel'] }], c => {
        if (c === 0) Game.save(true);
        if (c === 0 || c === 1) { Game.overlays = []; Game.setScene(new TitleScene()); }
      }); break;
    }
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(5,6,12,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const x = 40, y = 30, w = VIEW_W - 80, h = VIEW_H - 60;
    uiPanel(ctx, x, y, w, h);
    // tabs
    const tw = (w - 40) / this.tabs.length;
    this.tabs.forEach((t, i) => {
      const tx = x + 20 + i * tw;
      if (i === this.tab) { ctx.fillStyle = '#e8c878'; roundRect(ctx, tx + 4, y + 12, tw - 8, 32, 10); ctx.fill(); }
      uiText(ctx, t, tx + tw / 2, y + 34, 17, i === this.tab ? '#2a1e00' : '#d8d8e8', 'center', 700, false);
    });
    uiText(ctx, `${Input.menuLabel('tabs')}: switch tab   ${Input.menuLabel('confirm')}: select   ${Input.menuLabel('back')}: back`, x + w / 2, y + h - 12, 12, '#9aa0b8', 'center', 600, false);
    const cx = x + 20, cy = y + 60, cw = w - 40, ch = h - 90;
    switch (this.tabs[this.tab]) {
      case 'Equipment': this.drawEquip(ctx, cx, cy, cw, ch); break;
      case 'Spells': this.drawSpells(ctx, cx, cy, cw, ch); break;
      case 'Quests': this.drawQuests(ctx, cx, cy, cw, ch); break;
      case 'Map': this.drawMap(ctx, cx, cy, cw, ch); break;
      case 'System': this.drawSystem(ctx, cx, cy, cw, ch); break;
    }
  }

  drawPlayerRow(ctx, x, y, w) {
    const p = this.player;
    const sel = this.sel === 0 && !this.sub;
    if (sel) { ctx.fillStyle = 'rgba(232,200,120,0.22)'; roundRect(ctx, x, y, w, 34, 8); ctx.fill(); }
    uiText(ctx, `${Game.players.length > 1 ? '◄ ' : ''}P${p.pid + 1}: ${BREEDS[p.breed].name} the ${BREEDS[p.breed].cls}${Game.players.length > 1 ? ' ►' : ''}`, x + 12, y + 23, 17, PCOLORS[p.pid], 'left', 700);
  }

  drawStats(ctx, x, y, p, previewEquip) {
    const base = computeStats(p);
    let prev = base;
    if (previewEquip) { const old = p.equip[previewEquip.slot]; p.equip[previewEquip.slot] = previewEquip.id; prev = computeStats(p); p.equip[previewEquip.slot] = old; }
    const rows = [['Health', base.maxHp, prev.maxHp], ['Mana', base.maxMp, prev.maxMp], ['Attack', base.atk, prev.atk], ['Magic', base.mag, prev.mag], ['Defense', base.def, prev.def], ['Crit', base.crit * 100, prev.crit * 100]];
    rows.forEach(([l, a, b], i) => {
      uiText(ctx, l, x, y + i * 24, 15, '#c8c8d8', 'left', 600, false);
      uiText(ctx, String(Math.round(b)) + (l === 'Crit' ? '%' : ''), x + 150, y + i * 24, 15, '#ffffff', 'right', 700, false);
      const d = Math.round(b - a);
      if (d) uiText(ctx, (d > 0 ? '▲' : '▼') + Math.abs(d), x + 158, y + i * 24, 14, d > 0 ? '#6ad86a' : '#ff6a5a', 'left', 700, false);
    });
  }

  drawEquip(ctx, x, y, w, h) {
    const p = this.player;
    this.drawPlayerRow(ctx, x, y, 420);
    const slots = ['weapon', 'helmet', 'armor'];
    slots.forEach((s, i) => {
      const ry = y + 44 + i * 64;
      const sel = this.sel === i + 1 && !this.sub;
      ctx.fillStyle = sel ? 'rgba(232,200,120,0.22)' : 'rgba(0,0,0,0.25)'; roundRect(ctx, x, ry, 420, 58, 10); ctx.fill();
      if (sel) { ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 1.5; roundRect(ctx, x, ry, 420, 58, 10); ctx.stroke(); }
      const id = p.equip[s];
      uiText(ctx, s[0].toUpperCase() + s.slice(1), x + 12, ry + 18, 13, '#9aa0b8', 'left', 600, false);
      if (id) {
        const it = ITEMS[id];
        fillCirc(ctx, rgba(TIER_COLORS[it.tier], 0.2), x + 36, ry + 36, 18);
        drawItemIcon(ctx, it, x + 36, ry + 36, 30, Game.time);
        uiText(ctx, `${it.name}  Lv ${Game.state.inv[id] || 1}`, x + 64, ry + 40, 16, TIER_COLORS[it.tier], 'left', 700, false);
        uiText(ctx, itemStatText(it), x + 64, ry + 54, 12, '#c8c8d8', 'left', 500, false);
      } else uiText(ctx, '(empty)', x + 64, ry + 40, 15, '#777', 'left', 600, false);
    });
    // preview
    const px = x + 470, py = y + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, px, py, w - 470, h - 10, 12); ctx.fill();
    let prevEq = null;
    if (this.sub && this.sub.kind === 'equip') prevEq = { slot: this.sub.slot, id: this.sub.items[this.subSel] };
    const eq = { weapon: ITEMS[p.equip.weapon], helmet: p.equip.helmet ? ITEMS[p.equip.helmet] : null, armor: p.equip.armor ? ITEMS[p.equip.armor] : null };
    if (prevEq) eq[prevEq.slot] = prevEq.id ? ITEMS[prevEq.id] : null;
    drawDog(ctx, { x: px + 80, y: py + 180, facing: 1, t: Game.time, look: p.look, equip: eq, scale: 2.7, move: 0 });
    this.drawStats(ctx, px + 225, py + 40, p, prevEq);
    uiText(ctx, `Level ${Game.state.level}   XP ${fmt(Game.state.xp)} / ${fmt(xpForLevel(Game.state.level))}`, px + 20, py + h - 30, 14, '#b48cff', 'left', 700, false);
    if (this.sub) this.drawSubList(ctx, x + 20, y + 40, 400, h - 50);
  }

  drawSubList(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10,12,22,0.96)'; roundRect(ctx, x - 10, y - 10, w + 20, h + 10, 12); ctx.fill();
    ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 2; roundRect(ctx, x - 10, y - 10, w + 20, h + 10, 12); ctx.stroke();
    const s = this.sub;
    drawList(ctx, s.items, this.subSel, x, y, w, 46, Math.floor((h - 10) / 46), (id, i, rx, ry) => {
      if (s.kind === 'equip') {
        if (!id) { uiText(ctx, '(none)', rx + 50, ry + 27, 15, '#aaa', 'left', 600, false); return; }
        const it = ITEMS[id];
        drawItemIcon(ctx, it, rx + 24, ry + 21, 28, Game.time);
        uiText(ctx, `${it.name}  Lv ${Game.state.inv[id]}`, rx + 50, ry + 20, 15, TIER_COLORS[it.tier], 'left', 700, false);
        uiText(ctx, itemStatText(it), rx + 50, ry + 36, 11, '#c8c8d8', 'left', 500, false);
        if (Game.players.some(p => p.equip[it.slot] === id)) uiText(ctx, 'E', rx + w - 16, ry + 27, 14, '#6ad86a', 'center', 800, false);
      } else {
        if (!id) { uiText(ctx, '(empty slot)', rx + 50, ry + 27, 15, '#aaa', 'left', 600, false); return; }
        drawSpellIcon(ctx, id, rx + 24, ry + 21, 30, Game.time);
        uiText(ctx, `${SPELLS[id].name}  Lv ${Game.state.spells[id]}`, rx + 50, ry + 20, 15, SPELLS[id].color, 'left', 700, false);
        uiText(ctx, `Mana ${SPELLS[id].cost}  ·  ${SPELLS[id].desc}`, rx + 50, ry + 36, 11, '#c8c8d8', 'left', 500, false);
      }
    });
  }

  drawSpells(ctx, x, y, w, h) {
    const p = this.player;
    this.drawPlayerRow(ctx, x, y, 420);
    for (let i = 0; i < 4; i++) {
      const ry = y + 44 + i * 56;
      const sel = this.sel === i + 1 && !this.sub;
      ctx.fillStyle = sel ? 'rgba(232,200,120,0.22)' : 'rgba(0,0,0,0.25)'; roundRect(ctx, x, ry, 420, 50, 10); ctx.fill();
      if (sel) { ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 1.5; roundRect(ctx, x, ry, 420, 50, 10); ctx.stroke(); }
      uiKey(ctx, Input.label(p.device, 'spell' + i), x + 10, ry + 30);
      const id = p.spells[i];
      if (id) {
        drawSpellIcon(ctx, id, x + 76, ry + 25, 36, Game.time);
        uiText(ctx, `${SPELLS[id].name}  Lv ${Game.state.spells[id]}`, x + 102, ry + 23, 16, SPELLS[id].color, 'left', 700, false);
        uiText(ctx, `Mana cost ${SPELLS[id].cost}`, x + 102, ry + 40, 12, '#c8c8d8', 'left', 500, false);
      } else uiText(ctx, '(empty)', x + 102, ry + 31, 15, '#777', 'left', 600, false);
    }
    // learned spells overview
    const px = x + 470;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, px, y, w - 470, h, 12); ctx.fill();
    uiText(ctx, 'Spell Book', px + 20, y + 30, 18, '#e8c878', 'left', 700, false);
    SPELL_ORDER.forEach((id, i) => {
      const ry = y + 50 + i * 42;
      const lv = Game.state.spells[id];
      ctx.globalAlpha = lv ? 1 : 0.35;
      drawSpellIcon(ctx, id, px + 36, ry + 16, 30, Game.time);
      uiText(ctx, SPELLS[id].name + (lv ? `  Lv ${lv}` : '  (not learned)'), px + 60, ry + 14, 15, lv ? SPELLS[id].color : '#aaa', 'left', 700, false);
      uiText(ctx, SPELLS[id].desc, px + 60, ry + 30, 11, '#c8c8d8', 'left', 500, false);
      ctx.globalAlpha = 1;
    });
    uiText(ctx, 'Learn and upgrade spells at any Mage Tower.', px + 20, y + h - 14, 12, '#9aa0b8', 'left', 600, false);
    if (this.sub) this.drawSubList(ctx, x + 20, y + 40, 400, h - 50);
  }

  drawQuests(ctx, x, y, w, h) {
    const list = this.questList();
    if (!list.length) { uiText(ctx, 'No quests yet.', x + 20, y + 30, 16, '#aaa'); return; }
    drawList(ctx, list, this.sel, x, y, 380, 40, Math.floor(h / 40), (id, i, rx, ry) => {
      const q = QUESTS[id], done = Game.questDone(id);
      drawStar(ctx, done ? '#6ad86a' : q.main ? '#ffd23f' : '#9fe0ff', rx + 18, ry + 18, 7);
      uiText(ctx, q.name, rx + 34, ry + 24, 15, done ? '#6ad86a' : '#ffffff', 'left', 700, false);
      if (done) uiText(ctx, '✓', rx + 360, ry + 24, 16, '#6ad86a', 'right', 800, false);
    });
    const id = list[this.sel];
    if (!id) return;
    const q = QUESTS[id];
    const px = x + 400;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, px, y, w - 400, h, 12); ctx.fill();
    uiText(ctx, q.name, px + 20, y + 34, 22, q.main ? '#ffd23f' : '#9fe0ff', 'left', 800, false);
    uiText(ctx, q.main ? 'Main Quest' : `Side Quest · ${TOWNS[q.town].name}`, px + 20, y + 56, 13, '#9aa0b8', 'left', 600, false);
    ctx.font = uiFont(15, 500);
    wrapText(ctx, q.desc, w - 440).forEach((l, i) => uiText(ctx, l, px + 20, y + 90 + i * 22, 15, '#ffffff', 'left', 500, false));
    const prog = Game.questProgressText(id);
    if (prog) uiText(ctx, `Progress: ${prog}`, px + 20, y + 170, 15, '#ffd23f', 'left', 700, false);
    const r = q.reward || {};
    const parts = [];
    if (r.gold) parts.push(`${fmt(r.gold)} gold`);
    if (r.xp) parts.push(`${fmt(r.xp)} XP`);
    if (r.item) parts.push(ITEMS[r.item].name);
    if (parts.length) uiText(ctx, 'Reward: ' + parts.join(', '), px + 20, y + 200, 14, '#c8c8d8', 'left', 600, false);
    uiText(ctx, `Cats defeated: ${fmt(Game.state.kills)}   Chests opened: ${Game.state.chestsOpened}   Dungeons cleared: ${Object.keys(Game.state.cleared).length}/${DUNGEONS.length}`, px + 20, y + h - 18, 12, '#9aa0b8', 'left', 600, false);
  }

  drawMap(ctx, x, y, w, h) {
    const G = Game, wd = G.world;
    const s = Math.min((w - 300) / wd.w, h / wd.h);
    const mx = x, my = y + (h - wd.h * s) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(wd.minimap, mx, my, wd.w * s, wd.h * s);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, wd.w * s, wd.h * s);
    const toS = (tx, ty) => [mx + tx * s, my + ty * s];
    for (const id of TOWN_ORDER) {
      const t = TOWNS[id]; const [a, b] = toS(t.tx, t.ty);
      fillCirc(ctx, '#ffffff', a, b, 6); fillCirc(ctx, t.color, a, b, 4.5);
      uiText(ctx, t.name, a, b - 9, 11, '#ffffff', 'center', 700);
    }
    DUNGEONS.forEach((d, i) => {
      const [a, b] = toS(d.tx, d.ty);
      const sel = i === this.sel;
      const col = G.state.cleared[d.id] ? '#6ad86a' : d.main ? '#ffd23f' : '#ff6a5a';
      fillPoly(ctx, '#000', [a - 6, b + 5, a + 6, b + 5, a, b - 7]);
      fillPoly(ctx, col, [a - 4.5, b + 4, a + 4.5, b + 4, a, b - 5]);
      if (sel) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, 10 + Math.sin(G.time * 6) * 2, 0, TAU); ctx.stroke(); }
    });
    for (const r of REGIONS) { const [a, b] = toS(r.cx, r.cy + 10); uiText(ctx, r.name, a, b, 10, 'rgba(255,255,255,0.75)', 'center', 700); }
    const tg = G.trackedQuest() && G.questTarget(G.trackedQuest());
    if (tg) { const [a, b] = toS(tg.x / TS, tg.y / TS); drawStar(ctx, '#ffd23f', a, b - 10, 8); }
    if (!G.dungeon) G.players.forEach(p => { const [a, b] = toS(p.x / TS, p.y / TS); fillCirc(ctx, '#000', a, b, 5); fillCirc(ctx, PCOLORS[p.pid], a, b, 4); });
    // dungeon list
    const lx = x + w - 285;
    drawList(ctx, DUNGEONS, this.sel, lx, y, 285, 30, Math.floor(h / 30), (d, i, rx, ry) => {
      const c = G.state.cleared[d.id];
      uiText(ctx, d.name, rx + 10, ry + 19, 13, c ? '#6ad86a' : d.main ? '#ffd23f' : '#ffffff', 'left', 700, false);
      uiText(ctx, c ? '✓' : `Lv ${d.level}`, rx + 275, ry + 19, 12, c ? '#6ad86a' : '#c8c8d8', 'right', 700, false);
    });
  }

  drawSystem(ctx, x, y, w, h) {
    const rows = this.systemRows();
    drawList(ctx, rows, this.sel, x + 20, y + 10, 360, 44, 8, (r, i, rx, ry) => {
      uiText(ctx, r, rx + 16, ry + 27, 17, i === this.sel ? '#ffd23f' : '#ffffff', 'left', 700, false);
      if (i === 2 || i === 3) { const v = i === 2 ? Sound.settings.music : Sound.settings.sfx; uiBar(ctx, rx + 230, ry + 14, 110, 10, v, '#e8c878'); }
    });
    drawControlsHelp(ctx, x + 420, y + 10, w - 430);
  }
}

function itemStatText(it) {
  const p = [];
  if (it.atk) p.push(`ATK ${it.atk}`);
  if (it.mag) p.push(`MAG ${it.mag}`);
  if (it.def) p.push(`DEF ${it.def}`);
  if (it.hp) p.push(`HP ${it.hp}`);
  if (it.type) p.push(it.type[0].toUpperCase() + it.type.slice(1));
  return p.join('  ');
}

function drawControlsHelp(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, x, y, w, 380, 12); ctx.fill();
  uiText(ctx, 'Controls', x + 16, y + 28, 18, '#e8c878', 'left', 700, false);
  const rows = [
    ['', 'Keyboard (solo)', 'Gamepad'],
    ['Move', 'WASD / Arrows', 'Left stick / D-pad'],
    ['Attack', 'J / Space', 'A'],
    ['Dodge roll', 'K / Shift', 'B'],
    ['Interact', 'E / Enter', 'X'],
    ['Spells 1-4', '1 2 3 4 / U I O P', 'LB RB LT RT'],
    ['Map / Menu', 'M / Esc', 'Y / Start'],
    ['', 'Co-op keyboard P1', 'Co-op keyboard P2'],
    ['Move', 'WASD', 'Arrows'],
    ['Attack/Roll', 'Space / Shift', 'J / K  (Num 1/2)'],
    ['Interact', 'E', 'L  (Num 3)'],
    ['Spells', '1 2 3 4', 'U I O P (Num 4-7)'],
  ];
  rows.forEach((r, i) => {
    const ry = y + 56 + i * 26;
    const head = r[0] === '';
    uiText(ctx, r[0], x + 16, ry, 13, '#c8c8d8', 'left', 600, false);
    uiText(ctx, r[1], x + 130, ry, 13, head ? '#e8c878' : '#ffffff', 'left', head ? 700 : 500, false);
    uiText(ctx, r[2], x + 300, ry, 13, head ? '#e8c878' : '#ffffff', 'left', head ? 700 : 500, false);
  });
}

function toggleFullscreen() {
  try {
    const r = !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen();
    if (r && r.catch) r.catch(() => Game.toast('Fullscreen is not available here', '#c8c8d8', 2));
  } catch (e) { /* ignore */ }
}

// ============================================================
// Shops
// ============================================================
class ShopOverlay {
  constructor(kind, town, player) {
    this.kind = kind; this.town = town; this.player = player;
    this.tab = 0; this.sel = 0; this.t = 0; this.msg = null;
  }
  list() {
    const st = Game.state, tw = TOWNS[this.town];
    if (this.kind === 'mage') {
      const ids = new Set(tw.mage);
      for (const id in st.spells) ids.add(id);
      return SPELL_ORDER.filter(id => ids.has(id));
    }
    if (this.tab === 0) return tw.smith.slice().sort((a, b) => ITEMS[a].tier - ITEMS[b].tier || ITEMS[a].price - ITEMS[b].price);
    return Object.keys(st.inv).filter(id => ITEMS[id]).sort((a, b) => ITEMS[a].tier - ITEMS[b].tier || ITEMS[a].price - ITEMS[b].price);
  }
  upgradeCost(id) { const it = ITEMS[id]; const L = Game.state.inv[id] || 1; return Math.round(it.price * 0.4 * L + 40 * L); }
  spellCost(id) { const L = Game.state.spells[id]; return L ? SPELLS[id].upBase * L : SPELLS[id].price; }
  update(dt, m) {
    this.t += dt;
    if (this.msg) { this.msg.t += dt; if (this.msg.t > 2) this.msg = null; }
    if (m.back && this.t > 0.1) { UI.close(this); Sound.sfx('back'); return; }
    const list = this.list();
    if (this.kind === 'smith' && (m.tabL || m.tabR || m.left || m.right)) { this.tab = 1 - this.tab; this.sel = 0; Sound.sfx('menu'); return; }
    if (m.up) { this.sel = (this.sel + list.length - 1) % Math.max(1, list.length); Sound.sfx('menu'); }
    if (m.down) { this.sel = (this.sel + 1) % Math.max(1, list.length); Sound.sfx('menu'); }
    if (m.confirm && list.length) this.buy(list[this.sel]);
  }
  say(text, color = '#ffffff') { this.msg = { text, color, t: 0 }; }
  buy(id) {
    const st = Game.state, p = this.player;
    if (this.kind === 'mage') {
      const L = st.spells[id] || 0;
      if (L >= SPELL_MAX) { this.say('Already at max level!', '#ffd23f'); Sound.sfx('error'); return; }
      const cost = this.spellCost(id);
      if (st.gold < cost) { this.say('Not enough gold!', '#ff6a5a'); Sound.sfx('error'); return; }
      st.gold -= cost;
      st.spells[id] = L + 1;
      if (!L) {
        for (const pl of Game.players) { const e = pl.spells.indexOf(null); if (e >= 0 && !pl.spells.includes(id)) pl.spells[e] = id; }
        this.say(`Learned ${SPELLS[id].name}!`, SPELLS[id].color);
      } else this.say(`${SPELLS[id].name} is now Lv ${L + 1}!`, SPELLS[id].color);
      Sound.sfx('buy');
      Game.burst(p.x, p.y - 20, SPELLS[id].color, 16, 120, 'star');
      Game.save(true);
      return;
    }
    const it = ITEMS[id];
    const owned = st.inv[id];
    if (this.tab === 0 && !owned) {
      if (st.gold < it.price) { this.say('Not enough gold!', '#ff6a5a'); Sound.sfx('error'); return; }
      st.gold -= it.price; st.inv[id] = 1;
      p.equip[it.slot] = id; p.refresh();
      Game.state.party[p.pid] = { breed: p.breed, equip: Object.assign({}, p.equip), spells: p.spells.slice() };
      this.say(`Bought and equipped ${it.name}!`, TIER_COLORS[it.tier]);
      Sound.sfx('buy');
    } else {
      if (owned >= 10) { this.say('Already at max level!', '#ffd23f'); Sound.sfx('error'); return; }
      const cost = this.upgradeCost(id);
      if (st.gold < cost) { this.say('Not enough gold!', '#ff6a5a'); Sound.sfx('error'); return; }
      st.gold -= cost; st.inv[id] = owned + 1;
      for (const pl of Game.players) pl.refresh();
      this.say(`${it.name} upgraded to Lv ${owned + 1}!`, TIER_COLORS[it.tier]);
      Sound.sfx('buy');
    }
    Game.save(true);
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(5,6,12,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const x = 50, y = 30, w = VIEW_W - 100, h = VIEW_H - 60;
    uiPanel(ctx, x, y, w, h, { border: this.kind === 'mage' ? '#b48cff' : '#e8c878' });
    const st = Game.state;
    const title = this.kind === 'mage' ? `${TOWNS[this.town].name} Mage Tower` : `${TOWNS[this.town].name} Blacksmith`;
    uiText(ctx, title, x + 24, y + 38, 20, this.kind === 'mage' ? '#c8a8ff' : '#e8c878', 'left', 800);
    drawCoin(ctx, x + w - 150, y + 30, Game.time * 0.3, 9);
    uiText(ctx, fmt(st.gold), x + w - 134, y + 37, 18, '#ffd23f', 'left', 700);
    if (this.kind === 'smith') {
      ['Buy', 'Upgrade'].forEach((t, i) => {
        const tx = x + 400 + i * 120;
        if (i === this.tab) { ctx.fillStyle = '#e8c878'; roundRect(ctx, tx, y + 16, 110, 30, 10); ctx.fill(); }
        uiText(ctx, t, tx + 55, y + 37, 16, i === this.tab ? '#2a1e00' : '#d8d8e8', 'center', 700, false);
      });
    }
    const list = this.list();
    const lx = x + 20, ly = y + 64, lw = 480;
    drawList(ctx, list, this.sel, lx, ly, lw, 50, 8, (id, i, rx, ry) => {
      if (this.kind === 'mage') {
        const L = st.spells[id] || 0, cost = this.spellCost(id);
        drawSpellIcon(ctx, id, rx + 26, ry + 23, 34, Game.time);
        uiText(ctx, SPELLS[id].name + (L ? `  Lv ${L}` : ''), rx + 54, ry + 22, 16, SPELLS[id].color, 'left', 700, false);
        uiText(ctx, L ? (L >= SPELL_MAX ? 'MAX' : `Upgrade to Lv ${L + 1}`) : 'Learn', rx + 54, ry + 39, 12, '#c8c8d8', 'left', 600, false);
        if (L < SPELL_MAX) uiText(ctx, fmt(cost), rx + lw - 14, ry + 30, 16, st.gold >= cost ? '#ffd23f' : '#ff6a5a', 'right', 700, false);
      } else {
        const it = ITEMS[id], owned = st.inv[id];
        drawItemIcon(ctx, it, rx + 26, ry + 23, 32, Game.time);
        uiText(ctx, it.name + (owned ? `  Lv ${owned}` : ''), rx + 54, ry + 22, 16, TIER_COLORS[it.tier], 'left', 700, false);
        uiText(ctx, itemStatText(it), rx + 54, ry + 39, 11, '#c8c8d8', 'left', 500, false);
        const buying = this.tab === 0 && !owned;
        const cost = buying ? it.price : this.upgradeCost(id);
        const label = buying ? fmt(cost) : owned >= 10 ? 'MAX' : '↑ ' + fmt(cost);
        uiText(ctx, label, rx + lw - 14, ry + 30, 15, owned >= 10 && !buying ? '#6ad86a' : st.gold >= cost ? '#ffd23f' : '#ff6a5a', 'right', 700, false);
        if (Game.players.some(p => p.equip[it.slot] === id)) uiText(ctx, 'E', rx + lw - 90, ry + 30, 13, '#6ad86a', 'center', 800, false);
      }
    });
    // details panel
    const dx = x + 520, dy = y + 64, dw = w - 540, dh = h - 110;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(ctx, dx, dy, dw, dh, 12); ctx.fill();
    const id = list[this.sel];
    if (id && this.kind === 'mage') {
      const sp = SPELLS[id], L = st.spells[id] || 0;
      drawSpellIcon(ctx, id, dx + dw / 2, dy + 70, 90, Game.time);
      uiText(ctx, sp.name, dx + dw / 2, dy + 145, 22, sp.color, 'center', 800);
      ctx.font = uiFont(14, 500);
      wrapText(ctx, sp.desc, dw - 40).forEach((l, i) => uiText(ctx, l, dx + dw / 2, dy + 172 + i * 20, 14, '#ffffff', 'center', 500, false));
      uiText(ctx, `Mana cost: ${sp.cost}`, dx + 24, dy + 240, 14, '#6ab5ff', 'left', 700, false);
      uiText(ctx, `Power: ${Math.round(sp.power * spellMult(Math.max(1, L)) * 100)}%${L < SPELL_MAX ? ` → ${Math.round(sp.power * spellMult(L + 1) * 100)}%` : ''}`, dx + 24, dy + 264, 14, '#ffd23f', 'left', 700, false);
      uiText(ctx, `Level: ${L || '-'} / ${SPELL_MAX}`, dx + 24, dy + 288, 14, '#c8c8d8', 'left', 700, false);
    } else if (id) {
      const it = ITEMS[id];
      fillCirc(ctx, rgba(TIER_COLORS[it.tier], 0.2), dx + 70, dy + 70, 46);
      drawItemIcon(ctx, it, dx + 70, dy + 70, 76, Game.time);
      uiText(ctx, it.name, dx + 130, dy + 60, 20, TIER_COLORS[it.tier], 'left', 800);
      uiText(ctx, `${TIER_NAMES[it.tier]} ${it.slot}`, dx + 130, dy + 82, 13, '#c8c8d8', 'left', 600, false);
      uiText(ctx, `Compare for P${this.player.pid + 1}:`, dx + 20, dy + 140, 14, PCOLORS[this.player.pid], 'left', 700, false);
      PauseOverlay.prototype.drawStats.call(null, ctx, dx + 24, dy + 168, this.player, { slot: it.slot, id });
    }
    if (this.msg) uiText(ctx, this.msg.text, x + w / 2, y + h - 18, 16, this.msg.color, 'center', 700);
    else uiText(ctx, `${Input.menuLabel('confirm')}: ${this.kind === 'mage' ? 'learn / upgrade' : this.tab === 0 ? 'buy / upgrade' : 'upgrade'}   ${this.kind === 'smith' ? Input.menuLabel('tabs') + ': switch tab   ' : ''}${Input.menuLabel('back')}: leave`, x + w / 2, y + h - 18, 13, '#9aa0b8', 'center', 600, false);
  }
}

// ============================================================
// Quest board
// ============================================================
class BoardOverlay {
  constructor(town) { this.town = town; this.sel = 0; this.t = 0; }
  list() {
    const avail = Game.availableBoardQuests(this.town).map(q => ({ q, kind: 'new' }));
    const active = Object.values(QUESTS).filter(q => q.town === this.town && Game.questActive(q.id)).map(q => ({ q, kind: 'active' }));
    const done = Object.values(QUESTS).filter(q => q.town === this.town && Game.questDone(q.id)).map(q => ({ q, kind: 'done' }));
    return avail.concat(active, done);
  }
  update(dt, m) {
    this.t += dt;
    if (m.back && this.t > 0.1) { UI.close(this); Sound.sfx('back'); return; }
    const list = this.list();
    if (m.up) { this.sel = (this.sel + list.length - 1) % Math.max(1, list.length); Sound.sfx('menu'); }
    if (m.down) { this.sel = (this.sel + 1) % Math.max(1, list.length); Sound.sfx('menu'); }
    const it = list[this.sel];
    if (m.confirm && it && it.kind === 'new') { Game.startQuest(it.q.id); Sound.sfx('quest'); }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(5,6,12,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const x = 70, y = 36, w = VIEW_W - 140, h = VIEW_H - 72;
    uiPanel(ctx, x, y, w, h, { top: '#5a3a1a', bottom: '#3a2410', border: '#c89a60' });
    uiText(ctx, `${TOWNS[this.town].name} Quest Board`, x + w / 2, y + 40, 24, '#ffe8b0', 'center', 800);
    const list = this.list();
    if (!list.length) { uiText(ctx, 'No quests available right now. Come back later!', x + w / 2, y + 120, 16, '#ffe8b0', 'center'); return; }
    drawList(ctx, list, this.sel, x + 20, y + 64, 360, 44, 9, (it, i, rx, ry) => {
      const col = it.kind === 'new' ? '#ffd23f' : it.kind === 'active' ? '#9fe0ff' : '#6ad86a';
      ctx.fillStyle = '#fff8e0'; ctx.save(); ctx.translate(rx + 22, ry + 20); ctx.rotate(-0.08); ctx.fillRect(-10, -13, 20, 25); ctx.restore();
      uiText(ctx, it.kind === 'new' ? '!' : it.kind === 'active' ? '…' : '✓', rx + 22, ry + 27, 16, '#8a3a1a', 'center', 800, false);
      uiText(ctx, it.q.name, rx + 44, ry + 27, 15, col, 'left', 700, false);
    });
    const it = list[this.sel];
    if (!it) return;
    const q = it.q, px = x + 400, pw = w - 420;
    ctx.fillStyle = '#fff4d8'; roundRect(ctx, px, y + 64, pw, h - 100, 8); ctx.fill();
    uiText(ctx, q.name, px + 20, y + 100, 21, '#5a2a0a', 'left', 800, false);
    ctx.font = uiFont(15, 500);
    wrapText(ctx, q.desc, pw - 40).forEach((l, i) => uiText(ctx, l, px + 20, y + 134 + i * 22, 15, '#3a2a1a', 'left', 500, false));
    const r = q.reward || {};
    const parts = [];
    if (r.gold) parts.push(`${fmt(r.gold)} gold`);
    if (r.xp) parts.push(`${fmt(r.xp)} XP`);
    if (r.item) parts.push(ITEMS[r.item].name);
    uiText(ctx, 'Reward: ' + parts.join(', '), px + 20, y + 250, 14, '#8a4a1a', 'left', 700, false);
    if (r.item) drawItemIcon(ctx, ITEMS[r.item], px + pw - 50, y + 244, 40, Game.time);
    if (q.obj.type === 'clear') { const d = DUNGEON_BY_ID[q.obj.dungeon]; uiText(ctx, `Dungeon: ${d.name} (Recommended Lv ${d.level})`, px + 20, y + 276, 13, '#5a3a1a', 'left', 600, false); }
    const prog = Game.questProgressText(q.id);
    if (it.kind === 'active' && prog) uiText(ctx, `Progress: ${prog}`, px + 20, y + 300, 14, '#2a6aa5', 'left', 700, false);
    const label = it.kind === 'new' ? `${Input.menuLabel('confirm')}: Accept quest` : it.kind === 'active' ? 'In progress...' : 'Completed!';
    uiText(ctx, label, px + pw / 2, y + h - 56, 17, it.kind === 'new' ? '#c05a1a' : it.kind === 'active' ? '#2a6aa5' : '#2a8a3a', 'center', 800, false);
  }
}

// ============================================================
// Co-op join overlay (add Player 2 during the game)
// ============================================================
class CoopOverlay {
  constructor(parent) { this.parent = parent; this.step = 0; this.d1 = null; this.d2 = null; this.cursor = 0; this.t = 0; }
  update(dt, m) {
    this.t += dt;
    if (this.t < 0.2) { Nav.endFrame(); return; }
    if (this.step < 2 && (m.back || Input.kp(['Escape']))) { UI.close(this); Sound.sfx('back'); Nav.endFrame(); return; }
    if (this.step === 0) {
      const j = Input.joinPresses();
      if (j.length) { this.d1 = j[0]; this.step = 1; Sound.sfx('select'); }
    } else if (this.step === 1) {
      const j = Input.joinPresses().filter(d => d !== this.d1);
      if (j.length) {
        this.d2 = j[0]; this.step = 2; Sound.sfx('bark', { pitch: 1.3 });
        const used = Game.players[0].breed;
        this.cursor = (BREED_ORDER.indexOf(used) + 1) % 4;
      }
    } else {
      const n = Nav.get(this.d2);
      if (n.left) { this.cursor = (this.cursor + 3) % 4; Sound.sfx('menu'); }
      if (n.right) { this.cursor = (this.cursor + 1) % 4; Sound.sfx('menu'); }
      if (n.back) { UI.close(this); Sound.sfx('back'); Nav.endFrame(); return; }
      if (n.confirm) {
        if (BREED_ORDER[this.cursor] === Game.players[0].breed) { Sound.sfx('error'); Game.toast('That hero is already taken!', '#ff9a8a', 1.5); }
        else {
          Game.addPlayer2(BREED_ORDER[this.cursor], this.d1, this.d2);
          UI.close(this);
          if (this.parent) UI.close(this.parent);
        }
      }
    }
    Nav.endFrame();
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(5,6,12,0.7)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    uiPanel(ctx, 140, 80, VIEW_W - 280, VIEW_H - 160);
    uiText(ctx, 'Add Player 2', VIEW_W / 2, 124, 28, '#ffd23f', 'center', 800);
    if (this.step === 0) {
      uiText(ctx, 'Player 1: press your attack button', VIEW_W / 2, 200, 20, PCOLORS[0], 'center', 700);
      uiText(ctx, '(SPACE for WASD side, ENTER for arrow side, or A on your gamepad)', VIEW_W / 2, 230, 14, '#c8c8d8', 'center', 600, false);
    } else if (this.step === 1) {
      uiText(ctx, `Player 1 uses ${devFamilyName(this.d1)}`, VIEW_W / 2, 190, 16, PCOLORS[0], 'center', 700);
      uiText(ctx, 'Player 2: press your attack button', VIEW_W / 2, 230, 20, PCOLORS[1], 'center', 700);
      uiText(ctx, '(use the other half of the keyboard, or another gamepad)', VIEW_W / 2, 258, 14, '#c8c8d8', 'center', 600, false);
    } else {
      uiText(ctx, 'Player 2: choose your hero', VIEW_W / 2, 170, 18, PCOLORS[1], 'center', 700);
      BREED_ORDER.forEach((b, i) => {
        const x = 250 + i * 150, y = 320;
        const taken = b === Game.players[0].breed;
        if (i === this.cursor) { ctx.fillStyle = rgba(PCOLORS[1], 0.25); roundRect(ctx, x - 60, y - 110, 120, 150, 12); ctx.fill(); ctx.strokeStyle = PCOLORS[1]; ctx.lineWidth = 2; roundRect(ctx, x - 60, y - 110, 120, 150, 12); ctx.stroke(); }
        ctx.globalAlpha = taken ? 0.35 : 1;
        drawDog(ctx, { x: x - 6, y, facing: 1, t: Game.time + i, look: BREEDS[b], scale: 2, equip: { weapon: ITEMS[BREEDS[b].start.weapon] } });
        ctx.globalAlpha = 1;
        uiText(ctx, BREEDS[b].name, x, y + 28, 16, taken ? '#888' : '#ffffff', 'center', 700);
      });
      uiText(ctx, 'Left/Right: choose   Confirm: join   Back: cancel', VIEW_W / 2, VIEW_H - 100, 13, '#9aa0b8', 'center', 600, false);
    }
  }
}

// ============================================================
// Controls card shown at the start of a new game
// ============================================================
class TutorialOverlay {
  constructor() { this.t = 0; }
  update(dt, m) {
    this.t += dt;
    let go = m.confirm || m.back;
    for (const p of Game.players) { const s = Input.state(p.device); if (s.attack || s.interact) go = true; }
    if (go && this.t > 0.6) { UI.close(this); Sound.sfx('select'); }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(5,6,12,0.65)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const n = Game.players.length;
    const w = n > 1 ? 820 : 520, h = 380, x = (VIEW_W - w) / 2, y = 70;
    uiPanel(ctx, x, y, w, h);
    uiText(ctx, 'How to Play', VIEW_W / 2, y + 42, 28, '#ffd23f', 'center', 800);
    const acts = [['Move', null], ['Attack (combo x3)', 'attack'], ['Dodge roll', 'roll'], ['Talk / Open / Enter', 'interact'], ['Spells', 'spells'], ['Menu', 'pause'], ['Map', 'map']];
    Game.players.forEach((p, i) => {
      const cx = n > 1 ? x + 30 + i * (w / 2) : x + 40;
      uiText(ctx, n > 1 ? `Player ${i + 1} - ${BREEDS[p.breed].name}` : BREEDS[p.breed].name, cx, y + 84, 17, PCOLORS[i], 'left', 800);
      acts.forEach(([label, a], k) => {
        const ry = y + 120 + k * 30;
        uiText(ctx, label, cx, ry, 15, '#e0e0f0', 'left', 600, false);
        let key;
        if (!a) key = p.device === 'kbA' ? 'W A S D' : p.device === 'kbB' ? 'ARROWS' : p.device.startsWith('pad') ? 'L-STICK' : Input.lastType === 'pad' ? 'L-STICK' : 'WASD / ARROWS';
        else if (a === 'spells') key = [0, 1, 2, 3].map(q => Input.label(p.device, 'spell' + q)).join(' ');
        else key = Input.label(p.device, a);
        uiKey(ctx, key, cx + 190, ry + 1, '#ffd23f');
      });
    });
    uiText(ctx, 'Watch the red zones on the ground and roll out of them! Hitting cats refills your mana.', VIEW_W / 2, y + h - 40, 14, '#9fe0ff', 'center', 600, false);
    if (Math.floor(this.t * 2) % 2 === 0 && this.t > 0.6) uiText(ctx, 'Press attack to begin your adventure', VIEW_W / 2, y + h - 14, 14, '#ffffff', 'center', 700, false);
  }
}
