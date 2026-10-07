/* Rendering: procedural pixel art for tiles, characters, items and HUD. No image files are needed. */
(function () {
  var C = EF.C, U = EF.util, D = EF.D, W = EF.world, R = EF.render = {};
  var T = C.TILE;

  R.font = 'bold 12px "Courier New", Courier, monospace';
  R.fontSmall = 'bold 10px "Courier New", Courier, monospace';
  R.fontBig = 'bold 22px "Courier New", Courier, monospace';

  function px(ctx, col, x, y, w, h) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w || 1, h || 1);
  }

  // Text with a dark drop shadow so it reads on any background.
  R.text = function (ctx, str, x, y, color, font, align) {
    ctx.font = font || R.font;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(10,8,16,0.85)';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color || '#fbf3dc';
    ctx.fillText(str, x, y);
  };

  R.panel = function (ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(22,16,38,' + (alpha == null ? 0.88 : alpha) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f2d19a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = '#5b4a7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  };

  // ---------- item icons (16x16) ----------
  R.icon = function (ctx, id, x, y) {
    var it = D.items[id];
    if (!it) return;
    var c = it.color || '#ccc';
    switch (it.type) {
      case 'tool': {
        px(ctx, '#6b4a2b', x + 7, y + 6, 2, 9);
        var head = { hoe: [3, 2, 10, 3], can: [3, 6, 9, 7], axe: [4, 2, 7, 6], pick: [2, 3, 12, 3], sword: [7, 1, 2, 11], rod: [2, 2, 1, 1] }[it.kind];
        if (it.kind === 'rod') {
          ctx.strokeStyle = '#8b6a3b';
          ctx.beginPath();
          ctx.moveTo(x + 2, y + 14);
          ctx.lineTo(x + 14, y + 2);
          ctx.stroke();
          px(ctx, '#ffffff', x + 13, y + 3, 1, 4);
        } else if (it.kind === 'sword') {
          px(ctx, c, x + 7, y + 1, 2, 11);
          px(ctx, '#6b4a2b', x + 5, y + 11, 6, 2);
        } else if (head) {
          px(ctx, c, x + head[0], y + head[1], head[2], head[3]);
        }
        break;
      }
      case 'seed':
        px(ctx, '#8a6a42', x + 4, y + 6, 8, 8);
        px(ctx, c, x + 6, y + 8, 2, 2);
        px(ctx, c, x + 9, y + 10, 2, 2);
        break;
      case 'crop':
        px(ctx, '#3f8a34', x + 7, y + 11, 2, 4);
        px(ctx, c, x + 4, y + 3, 8, 8);
        px(ctx, 'rgba(255,255,255,0.35)', x + 5, y + 4, 2, 2);
        break;
      case 'fish':
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(x + 7, y + 8, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 11, y + 8);
        ctx.lineTo(x + 15, y + 4);
        ctx.lineTo(x + 15, y + 12);
        ctx.fill();
        px(ctx, '#111', x + 4, y + 7, 1, 1);
        break;
      case 'forage':
        px(ctx, '#4a8a3a', x + 5, y + 10, 6, 3);
        px(ctx, c, x + 4, y + 4, 4, 4);
        px(ctx, c, x + 9, y + 6, 3, 3);
        break;
      case 'food':
        ctx.fillStyle = '#f2e6d0';
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'gift':
        px(ctx, c, x + 4, y + 4, 4, 4);
        px(ctx, c, x + 8, y + 4, 4, 4);
        px(ctx, c, x + 6, y + 6, 4, 4);
        px(ctx, '#4a8a3a', x + 7, y + 10, 2, 5);
        break;
      default: // material
        px(ctx, c, x + 3, y + 4, 10, 9);
        px(ctx, 'rgba(255,255,255,0.3)', x + 4, y + 5, 4, 2);
        px(ctx, 'rgba(0,0,0,0.25)', x + 3, y + 11, 10, 2);
    }
  };

  // ---------- characters ----------
  // Draws a 16x16 villager with its feet at sy+4 and head top at sy-12.
  R.human = function (ctx, sx, sy, look, face, step) {
    var x = Math.round(sx) - 8, y = Math.round(sy) - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 4, y + 15, 8, 2);
    var l1 = step === 1 ? 1 : 0, l2 = step === 2 ? 1 : 0;
    px(ctx, look.pants, x + 5, y + 12 - l1, 2, 4 + l1);
    px(ctx, look.pants, x + 9, y + 12 - l2, 2, 4 + l2);
    px(ctx, look.shirt, x + 4, y + 7, 8, 6);
    px(ctx, look.shirt, x + 3, y + 7, 1, 5);
    px(ctx, look.shirt, x + 12, y + 7, 1, 5);
    px(ctx, look.skin, x + 4, y + 1, 8, 7);
    px(ctx, look.hair, x + 3, y, 10, 3);
    if (face[1] < 0) {
      px(ctx, look.hair, x + 3, y, 10, 6);
    } else {
      px(ctx, look.hair, x + 3, y + 2, 1, 3);
      px(ctx, look.hair, x + 12, y + 2, 1, 3);
      if (face[0] === 0) {
        px(ctx, '#222', x + 6, y + 5, 1, 2);
        px(ctx, '#222', x + 9, y + 5, 1, 2);
      } else if (face[0] < 0) {
        px(ctx, '#222', x + 5, y + 5, 1, 2);
      } else {
        px(ctx, '#222', x + 10, y + 5, 1, 2);
      }
    }
  };

  function drawMob(ctx, m, sx, sy, t) {
    var x = Math.round(sx), y = Math.round(sy);
    if (m.type === 'slime') {
      var bounce = Math.abs(Math.sin(t * 5 + m.x)) * 2;
      px(ctx, 'rgba(0,0,0,0.25)', x - 6, y + 5, 12, 2);
      px(ctx, '#4fc063', x - 6, y - 2 - bounce, 12, 8 + bounce);
      px(ctx, '#7ee58b', x - 4, y - 2 - bounce, 4, 2);
      px(ctx, '#111', x - 4, y + 1 - bounce, 2, 2);
      px(ctx, '#111', x + 2, y + 1 - bounce, 2, 2);
    } else if (m.type === 'bat') {
      var flap = Math.sin(t * 14) > 0 ? 0 : 2;
      px(ctx, '#3b2c4a', x - 7, y - 3 + flap, 4, 4);
      px(ctx, '#3b2c4a', x + 3, y - 3 + flap, 4, 4);
      px(ctx, '#4a3a5e', x - 3, y - 4, 6, 6);
      px(ctx, '#ff4d4d', x - 2, y - 2, 1, 1);
      px(ctx, '#ff4d4d', x + 1, y - 2, 1, 1);
    } else {
      px(ctx, 'rgba(0,0,0,0.3)', x - 8, y + 6, 16, 3);
      px(ctx, '#8a8f99', x - 7, y - 10, 14, 16);
      px(ctx, '#aeb4bd', x - 7, y - 10, 14, 3);
      px(ctx, '#ffb347', x - 4, y - 5, 2, 2);
      px(ctx, '#ffb347', x + 2, y - 5, 2, 2);
    }
    if (m.hit > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x - 6, y - 8, 12, 12);
    }
  }

  // ---------- tiles ----------
  function grass(ctx, x, y, tx, ty) {
    var h = U.hash2(tx, ty);
    px(ctx, h < 0.5 ? '#6aaa4c' : '#73b357', x, y, T, T);
    if (h > 0.45) px(ctx, '#5c9642', x + Math.floor(h * 13) + 1, y + Math.floor(U.hash2(ty, tx) * 13) + 1, 2, 1);
  }
  function cave(ctx, x, y, tx, ty) {
    var h = U.hash2(tx + 3, ty + 7);
    px(ctx, h < 0.5 ? '#5b4a3a' : '#574636', x, y, T, T);
    if (h > 0.6) px(ctx, '#4a3c2e', x + 3, y + 9, 3, 2);
  }
  function floorBase(ctx, x, y, tx, ty, outdoor, mine) {
    if (mine) cave(ctx, x, y, tx, ty);
    else if (outdoor) grass(ctx, x, y, tx, ty);
    else px(ctx, '#b98a57', x, y, T, T);
  }
  function water(ctx, x, y, tx, ty, t) {
    px(ctx, '#2f7ac8', x, y, T, T);
    var off = (t * 6 + tx * 5) % 12;
    px(ctx, '#7fb8f0', x + 2 + off, y + ((ty * 3) % 10) + 3, 3, 1);
  }
  function rockBlob(ctx, x, y, col) {
    px(ctx, col, x + 3, y + 7, 10, 7);
    px(ctx, col, x + 5, y + 4, 6, 3);
    px(ctx, 'rgba(255,255,255,0.25)', x + 4, y + 7, 4, 2);
    px(ctx, 'rgba(0,0,0,0.3)', x + 3, y + 13, 10, 1);
  }

  function drawTile(ctx, ch, x, y, tx, ty, t, outdoor, mine) {
    var h = U.hash2(tx, ty);
    switch (ch) {
      case '.': grass(ctx, x, y, tx, ty); break;
      case ',':
        grass(ctx, x, y, tx, ty);
        px(ctx, '#4f9a3a', x + 3, y + 9, 1, 4);
        px(ctx, '#4f9a3a', x + 7, y + 7, 1, 5);
        px(ctx, '#4f9a3a', x + 11, y + 10, 1, 3);
        break;
      case 'x': {
        grass(ctx, x, y, tx, ty);
        var cols = ['#ffffff', '#ffd6e8', '#fff07a', '#c9b6ff'];
        for (var f = 0; f < 3; f++) {
          var fx = Math.floor(U.hash2(tx + f, ty) * 12) + 2, fy = Math.floor(U.hash2(ty + f, tx) * 12) + 2;
          px(ctx, cols[(f + Math.floor(h * 4)) % 4], x + fx, y + fy, 2, 2);
        }
        break;
      }
      case 'p':
        px(ctx, '#d9b97f', x, y, T, T);
        px(ctx, '#c4a268', x + Math.floor(h * 10) + 2, y + 6, 2, 2);
        px(ctx, '#c4a268', x + 4, y + Math.floor(h * 9) + 4, 2, 1);
        break;
      case 's': px(ctx, '#eedca0', x, y, T, T); break;
      case 'w': water(ctx, x, y, tx, ty, R._t || 0); break;
      case 'b':
        px(ctx, '#2f7ac8', x, y, T, T);
        px(ctx, '#a0743f', x, y + 1, T, 14);
        for (var k = 0; k < 16; k += 4) px(ctx, '#7a5530', x, y + k, T, 1);
        break;
      case 'Q':
        water(ctx, x, y, tx, ty, R._t || 0);
        px(ctx, '#a0743f', x + 1, y + 4, 5, 3);
        px(ctx, '#a0743f', x + 10, y + 8, 4, 3);
        break;
      case 'T':
        floorBase(ctx, x, y, tx, ty, outdoor, mine);
        px(ctx, '#6b4a2b', x + 7, y + 10, 2, 6);
        px(ctx, '#2f7a3a', x + 2, y + 1, 12, 9);
        px(ctx, '#2f7a3a', x + 4, y, 8, 2);
        px(ctx, '#49a654', x + 4, y + 3, 3, 2);
        px(ctx, '#1e5a2a', x + 2, y + 8, 12, 2);
        break;
      case 'R': floorBase(ctx, x, y, tx, ty, outdoor, mine); rockBlob(ctx, x, y, '#8b9097'); break;
      case 'O': floorBase(ctx, x, y, tx, ty, outdoor, mine); rockBlob(ctx, x, y, '#7e7f84'); px(ctx, '#e08a4f', x + 5, y + 8, 2, 2); px(ctx, '#e08a4f', x + 9, y + 10, 2, 2); break;
      case 'I': floorBase(ctx, x, y, tx, ty, outdoor, mine); rockBlob(ctx, x, y, '#7e7f84'); px(ctx, '#e8e1d6', x + 5, y + 8, 2, 2); px(ctx, '#e8e1d6', x + 9, y + 10, 2, 2); break;
      case 'G': floorBase(ctx, x, y, tx, ty, outdoor, mine); rockBlob(ctx, x, y, '#7e7f84'); px(ctx, '#ffd84d', x + 5, y + 8, 2, 2); px(ctx, '#ffd84d', x + 9, y + 10, 2, 2); break;
      case 'Y': {
        floorBase(ctx, x, y, tx, ty, outdoor, mine);
        var glow = 0.2 + 0.15 * Math.sin(R._t * 3 + tx);
        ctx.fillStyle = 'rgba(176,140,255,' + glow + ')';
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        px(ctx, '#b08cff', x + 6, y + 4, 4, 9);
        px(ctx, '#b08cff', x + 4, y + 6, 8, 5);
        px(ctx, '#e4d6ff', x + 7, y + 4, 1, 3);
        break;
      }
      case 'H':
        px(ctx, '#d7b98f', x, y, T, T);
        for (var r = 0; r < 16; r += 4) px(ctx, '#b8956a', x, y + r, T, 1);
        break;
      case 'r':
        px(ctx, '#8e3b2e', x, y, T, T);
        for (var s = 0; s < 16; s += 4) px(ctx, '#6e2a20', x, y + s, T, 1);
        break;
      case 'D':
        floorBase(ctx, x, y, tx, ty, outdoor, mine);
        px(ctx, '#4a3018', x + 2, y + 1, 12, 15);
        px(ctx, '#6b4a2b', x + 3, y + 2, 10, 13);
        px(ctx, '#e9c46a', x + 11, y + 9, 1, 2);
        break;
      case 'f':
        px(ctx, '#b98a57', x, y, T, T);
        for (var v = 0; v < 16; v += 5) px(ctx, '#a07346', x + v, y, 1, T);
        break;
      case 'B':
        px(ctx, '#b98a57', x, y, T, T);
        px(ctx, '#7a4a2a', x, y + 2, T, 14);
        px(ctx, '#d9534f', x + 1, y + 5, 14, 9);
        px(ctx, '#ffffff', x + 2, y + 3, 5, 3);
        break;
      case 'E':
        px(ctx, '#b98a57', x, y, T, T);
        px(ctx, '#8b5a2b', x + 1, y + 5, 14, 5);
        px(ctx, '#6b4a2b', x + 2, y + 10, 2, 5);
        px(ctx, '#6b4a2b', x + 12, y + 10, 2, 5);
        break;
      case 'C':
        px(ctx, '#b98a57', x, y, T, T);
        px(ctx, '#a77444', x + 2, y + 3, 12, 11);
        px(ctx, '#7a5530', x + 2, y + 8, 12, 1);
        px(ctx, '#7a5530', x + 7, y + 3, 1, 11);
        break;
      case 'W':
        grass(ctx, x, y, tx, ty);
        px(ctx, '#9a9a9a', x + 2, y + 4, 12, 10);
        px(ctx, '#3b8ad9', x + 4, y + 6, 8, 6);
        px(ctx, '#6b4a2b', x + 3, y + 1, 2, 4);
        px(ctx, '#6b4a2b', x + 11, y + 1, 2, 4);
        px(ctx, '#6b4a2b', x + 3, y + 1, 10, 2);
        break;
      case 'N':
        grass(ctx, x, y, tx, ty);
        px(ctx, '#6b4a2b', x + 7, y + 8, 2, 8);
        px(ctx, '#c9a36a', x + 2, y + 2, 12, 8);
        px(ctx, '#ffffff', x + 4, y + 4, 3, 3);
        px(ctx, '#ffffff', x + 9, y + 5, 3, 2);
        break;
      case 'J':
        grass(ctx, x, y, tx, ty);
        px(ctx, '#6b4a2b', x + 7, y + 7, 2, 9);
        px(ctx, '#d9b070', x + 2, y + 2, 12, 6);
        px(ctx, '#7a5530', x + 4, y + 4, 8, 1);
        break;
      case 'L':
        grass(ctx, x, y, tx, ty);
        px(ctx, '#444a52', x + 7, y + 5, 2, 11);
        px(ctx, '#ffe27a', x + 5, y + 1, 6, 5);
        if (R._night > 0.2) {
          ctx.fillStyle = 'rgba(255,226,122,' + (0.25 * R._night) + ')';
          ctx.beginPath();
          ctx.arc(x + 8, y + 3, 14, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'M':
        px(ctx, '#3c3142', x, y, T, T);
        px(ctx, '#2a2230', x + Math.floor(h * 10) + 2, y + 3, 4, 1);
        px(ctx, '#2a2230', x + 5, y + 10, 1, 4);
        px(ctx, '#4a3e52', x + 9, y + 8, 4, 2);
        break;
      case 'g': cave(ctx, x, y, tx, ty); break;
      case 'S':
        cave(ctx, x, y, tx, ty);
        px(ctx, '#1b1520', x + 2, y + 2, 12, 12);
        px(ctx, '#3a2f40', x + 4, y + 5, 8, 1);
        px(ctx, '#3a2f40', x + 4, y + 9, 8, 1);
        break;
      case 'U':
        cave(ctx, x, y, tx, ty);
        px(ctx, '#e9d7a0', x + 6, y + 3, 4, 2);
        px(ctx, '#e9d7a0', x + 4, y + 5, 8, 2);
        px(ctx, '#e9d7a0', x + 7, y + 7, 2, 7);
        break;
      default:
        grass(ctx, x, y, tx, ty);
    }
  }

  // ---------- world ----------
  function darkness(s, tpl) {
    if (!tpl.outdoor) return tpl.id.indexOf('mine') === 0 ? 0.45 : 0;
    var a = U.clamp((s.minutes - 1080) / 300, 0, 1) * 0.6;
    if (tpl.id === 'town' && s.projects.lamps) a *= 0.5;
    return a;
  }

  function weatherLabel(w) {
    return { sunny: 'Sunny', rain: 'Rain', cloudy: 'Cloudy' }[w] || w;
  }

  R.drawWorld = function (ctx, G, t) {
    var s = G.state, tpl = G.rt.tpl, p = s.p;
    R._t = t;
    var mapW = tpl.w * T, mapH = tpl.h * T;
    var camX = mapW <= C.W ? -(C.W - mapW) / 2 : U.clamp(p.x * T - C.W / 2, 0, mapW - C.W);
    var camY = mapH <= C.H ? -(C.H - mapH) / 2 : U.clamp(p.y * T - C.H / 2, 0, mapH - C.H);
    camX = Math.round(camX);
    camY = Math.round(camY);
    G.rt.cam = { x: camX, y: camY };
    var night = darkness(s, tpl);
    R._night = night;
    var mine = tpl.id.indexOf('mine') === 0;

    ctx.fillStyle = '#0c0a12';
    ctx.fillRect(0, 0, C.W, C.H);

    var grid = G.grid(tpl.id);
    var tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(tpl.w - 1, Math.floor((camX + C.W) / T));
    var ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(tpl.h - 1, Math.floor((camY + C.H) / T));
    var soil = G.soil(tpl.id), crops = G.crops(tpl.id), forage = G.forage(tpl.id);

    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var sx = tx * T - camX, sy = ty * T - camY;
        var key = U.key(tx, ty), ch = grid[ty][tx];
        drawTile(ctx, ch, sx, sy, tx, ty, t, tpl.outdoor, mine);
        var sl = soil[key];
        if (sl) {
          px(ctx, sl.watered ? '#5b3d26' : '#7a5536', sx, sy, T, T);
          for (var r = 3; r < T; r += 5) px(ctx, sl.watered ? '#4a3120' : '#6a4730', sx + 1, sy + r, T - 2, 1);
        }
        var crop = crops[key];
        if (crop) drawCrop(ctx, crop, sx, sy);
        var fg = forage[key];
        if (fg) {
          var fi = D.items[fg];
          px(ctx, '#4a8a3a', sx + 5, sy + 10, 6, 3);
          px(ctx, fi.color, sx + 4, sy + 5, 5, 5);
        }
      }
    }

    // Entities, sorted by feet position so overlapping sprites look right.
    var ents = [];
    G.npcsIn(tpl.id).forEach(function (n) {
      ents.push({ y: n.y, draw: function () {
        R.human(ctx, n.x * T - camX, n.y * T - camY, n.npc.look, n.face || [0, 1], 0);
      } });
    });
    (G.mobsOf(tpl.id) || []).forEach(function (m) {
      if (m.dead) return;
      ents.push({ y: m.y, draw: function () { drawMob(ctx, m, m.x * T - camX, m.y * T - camY, t); } });
    });
    var pWalk = G.rt.walkFrame;
    ents.push({ y: p.y, draw: function () {
      R.human(ctx, p.x * T - camX, p.y * T - camY, G.playerLook(), [p.fx, p.fy], G.rt.moving ? pWalk : 0);
    } });
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.draw(); });

    // Fishing line and bobber.
    var f = G.rt.fish;
    if (f) {
      var bx = (f.cx + 0.5) * T - camX, by = (f.cy + 0.5) * T - camY;
      ctx.strokeStyle = 'rgba(240,240,240,0.7)';
      ctx.beginPath();
      ctx.moveTo(p.x * T - camX, p.y * T - camY - 6);
      ctx.lineTo(bx, by);
      ctx.stroke();
      var bob = f.phase === 'bite' ? Math.sin(t * 40) * 2 : Math.sin(t * 3) * 0.6;
      px(ctx, '#ff4d4d', bx - 2, by - 2 + bob, 4, 4);
      px(ctx, '#ffffff', bx - 2, by + bob, 4, 2);
      if (f.phase === 'bite') R.text(ctx, '!', bx - 3, by - 16, '#ffdf5a', R.fontBig);
    }

    // Floating texts.
    (G.rt.texts || []).forEach(function (fx) {
      var a = U.clamp(fx.t, 0, 1);
      ctx.globalAlpha = a;
      R.text(ctx, fx.text, fx.x * T - camX, fx.y * T - camY - (1.4 - fx.t) * 18, fx.color || '#fff7d6', R.fontSmall, 'center');
      ctx.globalAlpha = 1;
    });

    // Lighting: night, mines and a lantern glow around the player.
    if (night > 0) {
      ctx.fillStyle = 'rgba(12,16,48,' + night + ')';
      ctx.fillRect(0, 0, C.W, C.H);
    }
    if (mine) {
      var glow = ctx.createRadialGradient(p.x * T - camX, p.y * T - camY, 6, p.x * T - camX, p.y * T - camY, 80);
      glow.addColorStop(0, 'rgba(255,220,150,0.28)');
      glow.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, C.W, C.H);
    }

    if (s.weather === 'rain') {
      ctx.strokeStyle = 'rgba(180,200,255,0.45)';
      ctx.beginPath();
      for (var i = 0; i < 70; i++) {
        var rx = (i * 97 + t * 260) % C.W, ry = (i * 53 + t * 620) % C.H;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 3, ry + 6);
      }
      ctx.stroke();
    }
  };

  function drawCrop(ctx, crop, x, y) {
    var def = D.crops[crop.id];
    if (crop.days < def.days) {
      var ratio = crop.days / def.days;
      px(ctx, '#4d9a3a', x + 7, y + 9, 2, 4);
      if (ratio > 0.4) {
        px(ctx, '#4d9a3a', x + 5, y + 7, 2, 2);
        px(ctx, '#4d9a3a', x + 9, y + 7, 2, 2);
      }
    } else {
      px(ctx, '#3f8a34', x + 7, y + 7, 2, 6);
      px(ctx, def.color, x + 4, y + 3, 8, 6);
      px(ctx, 'rgba(255,255,255,0.35)', x + 5, y + 4, 2, 2);
    }
  }

  // ---------- HUD ----------
  R.drawHUD = function (ctx, G, t) {
    var s = G.state, rt = G.rt;
    var seasonName = C.SEASONS[s.season];

    R.panel(ctx, 6, 6, 190, 38);
    R.text(ctx, seasonName + ' ' + s.day + ', Year ' + s.year, 14, 12, '#ffe9b0');
    R.text(ctx, U.formatTime(s.minutes) + '  ' + weatherLabel(s.weather), 14, 27, '#e8e0ff', R.fontSmall);

    R.panel(ctx, C.W - 150, 6, 144, 58);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(C.W - 138, 17, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8862b';
    ctx.fillRect(C.W - 139, 16, 3, 2);
    R.text(ctx, s.gold + 'g', C.W - 126, 11, '#ffd84d');
    R.text(ctx, 'Energy', C.W - 146, 33, '#cfe8c0', R.fontSmall);
    ctx.fillStyle = '#1b1a24';
    ctx.fillRect(C.W - 96, 35, 84, 6);
    ctx.fillStyle = s.energy < 50 ? '#e25b4a' : '#7bd65a';
    ctx.fillRect(C.W - 96, 35, 84 * U.clamp(s.energy / C.MAX_ENERGY, 0, 1), 6);
    R.text(ctx, 'Health', C.W - 146, 47, '#f5c2c2', R.fontSmall);
    ctx.fillStyle = '#1b1a24';
    ctx.fillRect(C.W - 96, 49, 84, 6);
    ctx.fillStyle = '#e25b4a';
    ctx.fillRect(C.W - 96, 49, 84 * U.clamp(s.health / C.MAX_HEALTH, 0, 1), 6);

    // Hotbar.
    var slot = 30, gap = 3, total = C.HOTBAR * (slot + gap) - gap;
    var x0 = Math.round((C.W - total) / 2), y0 = C.H - slot - 8;
    for (var i = 0; i < C.HOTBAR; i++) {
      var sx = x0 + i * (slot + gap);
      ctx.fillStyle = 'rgba(22,16,38,0.9)';
      ctx.fillRect(sx, y0, slot, slot);
      ctx.strokeStyle = i === s.sel ? '#ffdf5a' : '#5b4a7a';
      ctx.lineWidth = i === s.sel ? 2 : 1;
      ctx.strokeRect(sx + 0.5, y0 + 0.5, slot - 1, slot - 1);
      var it = s.inv[i];
      if (it) {
        R.icon(ctx, it.id, sx + 7, y0 + 7);
        if (it.qty > 1) R.text(ctx, String(it.qty), sx + slot - 3, y0 + slot - 11, '#ffffff', R.fontSmall, 'right');
      }
      R.text(ctx, String((i + 1) % 10), sx + 2, y0 + 1, '#a89cc8', R.fontSmall);
    }

    // Tool name and water level for the selected item.
    var sel = s.inv[s.sel];
    if (sel) {
      var def = D.items[sel.id];
      var label = def.name + (def.kind === 'can' ? '  (' + s.water + '/' + D.CAN_CAPACITY[def.tier] + ')' : '');
      R.text(ctx, label, C.W / 2, y0 - 16, '#fff3d0', R.font, 'center');
    }

    // Reel minigame bar.
    var f = rt.fish;
    if (f && f.phase === 'reel') {
      var bx = C.W - 40, by = 80, bh = 150;
      R.panel(ctx, bx - 10, by - 10, 30, bh + 20, 0.8);
      ctx.fillStyle = '#1b1a24';
      ctx.fillRect(bx, by, 10, bh);
      ctx.fillStyle = 'rgba(120,220,120,0.9)';
      ctx.fillRect(bx, by + bh * (1 - f.zc - f.zw), 10, bh * f.zw);
      var mk = by + bh * (1 - f.marker) - 2;
      ctx.fillStyle = '#ffdf5a';
      ctx.fillRect(bx - 3, mk, 16, 4);
      ctx.fillStyle = '#e25b4a';
      ctx.fillRect(bx - 10, by + bh * (1 - f.prog), 6, 2);
      R.text(ctx, 'Hold X', bx - 14, by + bh + 14, '#fff3d0', R.fontSmall);
    }

    // Day banner.
    if (rt.banner && rt.banner.t > 0) {
      var ba = U.clamp(rt.banner.t, 0, 1);
      ctx.globalAlpha = ba;
      R.text(ctx, rt.banner.text, C.W / 2, 90, '#fff3d0', R.fontBig, 'center');
      ctx.globalAlpha = 1;
    }

    if (rt.fade > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + U.clamp(rt.fade / 0.35, 0, 1) + ')';
      ctx.fillRect(0, 0, C.W, C.H);
    }
  };
})();
