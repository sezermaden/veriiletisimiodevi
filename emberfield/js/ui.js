/* UI panels: dialogue boxes, list menus, the inventory grid, toasts and the credits roll. */
(function () {
  var C = EF.C, R = EF.render, IN = EF.input, AU = EF.audio, D = EF.D;
  var stack = [], toasts = [];
  var UI = EF.ui = {};
  var HINT = 'Z: select   X: use   B: back';

  UI.stack = stack;
  UI.push = function (p) {
    stack.push(p);
    IN.suppressRepeat();
    return p;
  };
  UI.pop = function () { return stack.pop(); };
  UI.top = function () { return stack[stack.length - 1]; };
  UI.blocking = function () { return stack.length > 0; };
  UI.clear = function () { stack.length = 0; };

  UI.toast = function (text) {
    toasts.push({ text: text, t: 2.6 });
    if (toasts.length > 4) toasts.shift();
  };

  // lines: string or array of strings. onDone runs after the last line is dismissed.
  UI.say = function (lines, opts) {
    opts = opts || {};
    return UI.push({
      type: 'dialog', speaker: opts.speaker || '', lines: [].concat(lines), idx: 0, reveal: 0,
      onDone: opts.onDone || null
    });
  };

  // items: [{label, sub, disabled, fn, alt}]. build() rebuilds items after each action.
  UI.list = function (opts) {
    return UI.push({
      type: 'list', title: opts.title || '', subtitle: opts.subtitle || '', items: opts.items || [],
      idx: 0, width: opts.width || 300, footer: opts.footer || HINT, onCancel: opts.onCancel || null,
      build: opts.build || null, title_style: opts.style || null, noCancel: !!opts.noCancel
    });
  };

  UI.choose = function (title, options, opts) {
    return UI.list(Object.assign({ title: title, items: options, width: 220 }, opts || {}));
  };

  // mode 'manage' opens an action list per slot; mode 'pick' calls onPick(slotIndex).
  UI.inventory = function (opts) {
    return UI.push({
      type: 'inv', title: opts.title || 'Inventory', mode: opts.mode || 'manage', slots: opts.slots,
      onPick: opts.onPick || null, actions: opts.actions || null, onCancel: opts.onCancel || null,
      idx: 0, hint: opts.hint || 'Z: choose   B: back'
    });
  };

  UI.credits = function (lines, onDone) {
    return UI.push({ type: 'credits', lines: lines, t: 0, onDone: onDone || null });
  };

  // ---------- input handling for the top panel ----------
  function refresh(p) {
    if (p.build && stack.indexOf(p) >= 0) {
      p.items = p.build();
      if (p.idx >= p.items.length) p.idx = Math.max(0, p.items.length - 1);
    }
  }

  function updateDialog(p, dt) {
    var line = p.lines[p.idx] || '';
    if (p.reveal < line.length) p.reveal = Math.min(line.length, p.reveal + dt * 45);
    if (IN.pressed('confirm') || IN.pressed('use')) {
      IN.consume('confirm');
      IN.consume('use');
      if (p.reveal < line.length) {
        p.reveal = line.length;
        return;
      }
      AU.sfx('select');
      p.idx++;
      p.reveal = 0;
      if (p.idx >= p.lines.length) {
        UI.pop();
        if (p.onDone) p.onDone();
      }
    }
  }

  function updateList(p) {
    // Dynamic lists (shops, board, sell) rebuild every frame so they never show stale state.
    if (p.build) {
      p.items = p.build();
      if (p.idx >= p.items.length) p.idx = Math.max(0, p.items.length - 1);
    }
    var n = p.items.length;
    if (n && IN.repeat('up')) {
      p.idx = (p.idx - 1 + n) % n;
      AU.sfx('select');
    }
    if (n && IN.repeat('down')) {
      p.idx = (p.idx + 1) % n;
      AU.sfx('select');
    }
    if (n && IN.pressed('confirm')) {
      IN.consume('confirm');
      var it = p.items[p.idx];
      if (!it || it.disabled || !it.fn) {
        AU.sfx('error');
        return;
      }
      AU.sfx('confirm');
      it.fn();
      refresh(p);
      return;
    }
    if (n && IN.pressed('use')) {
      IN.consume('use');
      var alt = p.items[p.idx];
      if (alt && alt.alt && !alt.disabled) {
        AU.sfx('confirm');
        alt.alt();
        refresh(p);
      } else {
        AU.sfx('error');
      }
      return;
    }
    if (!p.noCancel && (IN.pressed('cancel') || IN.pressed('menu'))) {
      IN.consume('cancel');
      IN.consume('menu');
      AU.sfx('cancel');
      UI.pop();
      if (p.onCancel) p.onCancel();
    }
  }

  function updateInv(p) {
    var slots = p.slots();
    var n = C.INV_SIZE;
    if (IN.repeat('left')) p.idx = (p.idx + n - 1) % n;
    if (IN.repeat('right')) p.idx = (p.idx + 1) % n;
    if (IN.repeat('up')) p.idx = (p.idx + n - 6) % n;
    if (IN.repeat('down')) p.idx = (p.idx + 6) % n;
    if (IN.pressed('confirm')) {
      IN.consume('confirm');
      var slot = slots[p.idx];
      if (!slot) {
        AU.sfx('error');
        return;
      }
      if (p.mode === 'pick') {
        AU.sfx('confirm');
        var picked = p.idx;
        UI.pop();
        if (p.onPick) p.onPick(picked);
        return;
      }
      if (p.actions) {
        AU.sfx('select');
        var acts = p.actions(p.idx);
        UI.list({ title: D.items[slot.id].name, items: acts, width: 180, footer: HINT });
      }
      return;
    }
    if (IN.pressed('cancel') || IN.pressed('menu')) {
      IN.consume('cancel');
      IN.consume('menu');
      AU.sfx('cancel');
      UI.pop();
      if (p.onCancel) p.onCancel();
    }
  }

  function updateCredits(p, dt) {
    p.t += dt;
    if (p.t > 1.5 && (IN.pressed('confirm') || IN.pressed('cancel') || IN.pressed('menu'))) {
      IN.consume('confirm');
      IN.consume('cancel');
      IN.consume('menu');
      UI.pop();
      if (p.onDone) p.onDone();
    }
  }

  UI.update = function (dt) {
    for (var i = toasts.length - 1; i >= 0; i--) {
      toasts[i].t -= dt;
      if (toasts[i].t <= 0) toasts.splice(i, 1);
    }
    var p = UI.top();
    if (!p) return;
    if (p.type === 'dialog') updateDialog(p, dt);
    else if (p.type === 'list') updateList(p);
    else if (p.type === 'inv') updateInv(p);
    else if (p.type === 'credits') updateCredits(p, dt);
  };

  // ---------- drawing ----------
  function drawDialog(ctx, p) {
    var line = p.lines[p.idx] || '';
    var x = 16, w = C.W - 32, h = 92, y = C.H - h - 12;
    R.panel(ctx, x, y, w, h);
    if (p.speaker) {
      R.panel(ctx, x + 12, y - 16, 10 + p.speaker.length * 8, 22, 0.95);
      R.text(ctx, p.speaker, x + 20, y - 11, '#ffe9b0', R.font);
    }
    ctx.font = R.font;
    var lines = U_wrap(ctx, line, w - 32);
    var shown = p.reveal;
    var yy = y + 12;
    for (var i = 0; i < lines.length && i < 4; i++) {
      var part = lines[i].slice(0, Math.max(0, Math.floor(shown)));
      shown -= lines[i].length + 1;
      R.text(ctx, part, x + 16, yy, '#fbf3dc');
      yy += 17;
    }
    if (p.reveal >= line.length && (Math.floor(Date.now() / 400) % 2 === 0)) {
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.moveTo(x + w - 20, y + h - 14);
      ctx.lineTo(x + w - 12, y + h - 14);
      ctx.lineTo(x + w - 16, y + h - 8);
      ctx.fill();
    }
  }

  function U_wrap(ctx, text, maxW) {
    return EF.util.wrap(ctx, text, maxW);
  }

  function drawList(ctx, p) {
    var rowH = 18, visible = 9, n = p.items.length;
    var titleH = p.title ? 24 : 8;
    var subH = p.subtitle ? 16 : 0;
    var rows = Math.max(1, Math.min(n, visible));
    var h = titleH + subH + rows * rowH + 26;
    var w = p.width;
    var x = Math.round((C.W - w) / 2);
    var y = p.title_style === 'title' ? 150 : Math.round((C.H - h) / 2);
    if (p.title_style === 'title') {
      ctx.textAlign = 'center';
      R.text(ctx, 'EMBERFIELD', C.W / 2, 44, '#ffe9b0', R.fontBig, 'center');
      R.text(ctx, 'VALLEY', C.W / 2, 72, '#ffd084', R.fontBig, 'center');
      R.text(ctx, 'A cozy farming and mining adventure', C.W / 2, 104, '#cfc3ea', R.fontSmall, 'center');
    }
    R.panel(ctx, x, y, w, h);
    if (p.title) R.text(ctx, p.title, x + w / 2, y + 7, '#ffe9b0', R.font, 'center');
    if (p.subtitle) R.text(ctx, p.subtitle, x + w / 2, y + titleH, '#cfc3ea', R.fontSmall, 'center');
    if (n === 0) {
      R.text(ctx, 'Nothing here yet.', x + 12, y + titleH + subH + 4, '#9b91b4');
    }
    var start = Math.max(0, Math.min(p.idx - Math.floor(visible / 2), n - visible));
    for (var r = 0; r < rows && start + r < n; r++) {
      var i = start + r, it = p.items[i];
      var ry = y + titleH + subH + r * rowH;
      if (i === p.idx) {
        ctx.fillStyle = 'rgba(242,209,154,0.22)';
        ctx.fillRect(x + 6, ry, w - 12, rowH - 1);
        R.text(ctx, '>', x + 9, ry + 2, '#ffdf5a');
      }
      R.text(ctx, it.label, x + 22, ry + 2, it.disabled ? '#7b7388' : '#fbf3dc');
      if (it.sub) R.text(ctx, it.sub, x + w - 12, ry + 3, it.disabled ? '#6c6480' : '#cdbfe6', R.fontSmall, 'right');
    }
    if (n > visible) {
      R.text(ctx, (p.idx + 1) + '/' + n, x + w - 12, y + h - 22, '#9b91b4', R.fontSmall, 'right');
    }
    R.text(ctx, p.footer, x + w / 2, y + h - 17, '#9b91b4', R.fontSmall, 'center');
  }

  function drawInventory(ctx, p) {
    var slots = p.slots();
    var cell = 30, cols = 6, rows = 5;
    var gw = cols * cell + 12, gh = rows * cell + 12;
    var x = 40, y = 34, h = gh + 50;
    R.panel(ctx, x, y, gw + 10, h);
    R.text(ctx, p.title, x + (gw + 10) / 2, y + 8, '#ffe9b0', R.font, 'center');
    var gx = x + 8, gy = y + 28;
    for (var i = 0; i < C.INV_SIZE; i++) {
      var cx = gx + (i % cols) * cell, cy = gy + Math.floor(i / cols) * cell;
      ctx.fillStyle = 'rgba(12,8,22,0.9)';
      ctx.fillRect(cx, cy, cell - 2, cell - 2);
      ctx.strokeStyle = i === p.idx ? '#ffdf5a' : '#4a3d66';
      ctx.lineWidth = i === p.idx ? 2 : 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 3, cell - 3);
      var s = slots[i];
      if (s) {
        R.icon(ctx, s.id, cx + 6, cy + 5);
        if (s.qty > 1) R.text(ctx, String(s.qty), cx + cell - 4, cy + cell - 12, '#ffffff', R.fontSmall, 'right');
      }
    }
    // Details for the selected slot.
    var dx = x + gw + 22, dw = 210;
    R.panel(ctx, dx, y, dw, h);
    var cur = slots[p.idx];
    if (cur) {
      var def = D.items[cur.id];
      R.text(ctx, def.name, dx + 12, y + 10, '#ffe9b0');
      R.text(ctx, def.type.charAt(0).toUpperCase() + def.type.slice(1) + (def.price ? '  -  worth ' + def.price + 'g' : ''), dx + 12, y + 28, '#cdbfe6', R.fontSmall);
      ctx.font = R.font;
      var dl = EF.util.wrap(ctx, def.desc || '', dw - 24);
      for (var k = 0; k < dl.length && k < 8; k++) R.text(ctx, dl[k], dx + 12, y + 50 + k * 16, '#fbf3dc');
      if (def.energy) R.text(ctx, 'Restores ' + def.energy + ' energy', dx + 12, y + h - 32, '#b9f0a0', R.fontSmall);
    } else {
      R.text(ctx, 'Empty slot', dx + 12, y + 10, '#9b91b4');
    }
    R.text(ctx, p.hint, x + (gw + 10) / 2, y + h - 17, '#9b91b4', R.fontSmall, 'center');
  }

  function drawCredits(ctx, p) {
    ctx.fillStyle = 'rgba(8,6,14,0.92)';
    ctx.fillRect(0, 0, C.W, C.H);
    var y = C.H - p.t * 28;
    p.lines.forEach(function (ln, i) {
      var big = i === 0;
      R.text(ctx, ln, C.W / 2, y + i * 26, big ? '#ffd084' : '#fbf3dc', big ? R.fontBig : R.font, 'center');
    });
  }

  UI.draw = function (ctx) {
    var needDim = stack.some(function (p) { return p.type !== 'dialog' && p.type !== 'credits'; });
    if (needDim) {
      ctx.fillStyle = 'rgba(8,6,14,0.5)';
      ctx.fillRect(0, 0, C.W, C.H);
    }
    stack.forEach(function (p) {
      if (p.type === 'dialog') drawDialog(ctx, p);
      else if (p.type === 'list') drawList(ctx, p);
      else if (p.type === 'inv') drawInventory(ctx, p);
      else if (p.type === 'credits') drawCredits(ctx, p);
    });
    var y = 42;
    toasts.forEach(function (t) {
      ctx.font = R.font;
      var w = Math.min(C.W - 40, ctx.measureText(t.text).width + 24);
      ctx.globalAlpha = Math.min(1, t.t);
      R.panel(ctx, Math.round(C.W / 2 - w / 2), y, w, 20, 0.85);
      R.text(ctx, t.text, C.W / 2, y + 4, '#fff3d0', R.font, 'center');
      ctx.globalAlpha = 1;
      y += 24;
    });
  };
})();
