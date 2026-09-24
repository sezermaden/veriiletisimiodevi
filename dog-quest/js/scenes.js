// ============================================================
// Dog Quest - scenes: title, character select, story, credits, game over
// ============================================================
'use strict';

// per-device edge-triggered navigation (used where several players act at once)
const Nav = {
  prevStick: [{}, {}, {}, {}],
  get(dev) {
    const r = { left: false, right: false, up: false, down: false, confirm: false, back: false };
    if (dev === 'kbA') {
      r.left = Input.kp(['KeyA']); r.right = Input.kp(['KeyD']); r.up = Input.kp(['KeyW']); r.down = Input.kp(['KeyS']);
      r.confirm = Input.kp(['Space', 'KeyF', 'KeyE']); r.back = Input.kp(['ShiftLeft', 'KeyG', 'Escape', 'KeyQ']);
    } else if (dev === 'kbB') {
      r.left = Input.kp(['ArrowLeft']); r.right = Input.kp(['ArrowRight']); r.up = Input.kp(['ArrowUp']); r.down = Input.kp(['ArrowDown']);
      r.confirm = Input.kp(['Enter', 'NumpadEnter', 'KeyJ', 'Numpad1', 'Numpad0']); r.back = Input.kp(['KeyK', 'Backspace', 'Numpad2']);
    } else if (dev && dev.startsWith('pad')) {
      const i = +dev[3];
      const [ax, ay] = Input.padAxes[i];
      const ps = this.prevStick[i];
      const cur = { l: ax < -0.5, r: ax > 0.5, u: ay < -0.5, d: ay > 0.5 };
      r.left = Input.pp(i, PB.LEFT) || (cur.l && !ps.l); r.right = Input.pp(i, PB.RIGHT) || (cur.r && !ps.r);
      r.up = Input.pp(i, PB.UP) || (cur.u && !ps.u); r.down = Input.pp(i, PB.DOWN) || (cur.d && !ps.d);
      r.confirm = Input.pp(i, PB.A) || Input.pp(i, PB.START); r.back = Input.pp(i, PB.B);
    }
    return r;
  },
  endFrame() {
    for (let i = 0; i < 4; i++) { const [ax, ay] = Input.padAxes[i]; this.prevStick[i] = { l: ax < -0.5, r: ax > 0.5, u: ay < -0.5, d: ay > 0.5 }; }
  },
};

function devFamilyName(dev) {
  if (dev === 'kbA') return 'Keyboard (WASD)';
  if (dev === 'kbB') return 'Keyboard (Arrows)';
  if (dev && dev.startsWith('pad')) return 'Gamepad ' + (+dev[3] + 1);
  return 'Keyboard';
}

// ------------------------------------------------------------
// Shared scenic background
// ------------------------------------------------------------
function drawMeadowBackdrop(ctx, t, opts = {}) {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, opts.sky1 || '#5ab0ff'); sky.addColorStop(0.6, opts.sky2 || '#bfe6ff'); sky.addColorStop(1, '#fff4d0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // sun
  const sx = 780, sy = 110;
  ctx.globalAlpha = 0.3; fillCirc(ctx, '#fff6a0', sx, sy, 80 + Math.sin(t) * 4); ctx.globalAlpha = 1;
  fillCirc(ctx, '#fff2a0', sx, sy, 50);
  // clouds
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 260 + t * (12 + i * 4)) % (VIEW_W + 300)) - 150, cy = 60 + (i % 3) * 45;
    ctx.globalAlpha = 0.9;
    fillEll(ctx, '#ffffff', cx, cy, 60, 20); fillEll(ctx, '#ffffff', cx + 30, cy - 12, 36, 20); fillEll(ctx, '#ffffff', cx - 30, cy - 6, 30, 16);
  }
  ctx.globalAlpha = 1;
  // hills
  const hill = (col, base, amp, freq, off) => {
    F(ctx, col); ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 20) ctx.lineTo(x, base + Math.sin(x * freq + off) * amp);
    ctx.lineTo(VIEW_W, VIEW_H); ctx.fill();
  };
  hill(opts.h1 || '#8fd0a0', 330, 30, 0.006, 1);
  hill(opts.h2 || '#6cb04a', 380, 22, 0.009, t * 0.05 + 2);
  hill(opts.h3 || '#56a03c', 440, 14, 0.012, 4);
}

// ------------------------------------------------------------
class TitleScene {
  constructor() { this.name = 'title'; this.t = 0; this.stage = 0; this.sel = 0; this.confirmNew = false; this.controls = false; }
  enter() { Sound.play('title'); Game.overlays = []; Game.state = null; Game.players = []; }
  items() {
    const it = [];
    if (Game.hasSave()) it.push('Continue');
    it.push('New Game', 'Controls', 'Credits', 'Fullscreen');
    return it;
  }
  pickDevice() {
    const j = Input.joinPresses();
    return j[0] || 'kbA';
  }
  update(dt) {
    this.t += dt;
    const m = Input.menu;
    if (this.stage === 0) {
      if (Input.anyPressedFlag) { this.stage = 1; Sound.unlock(); Sound.play('title'); Sound.sfx('bark'); Input.consume(); }
      return;
    }
    if (this.controls) { if (m.back || m.confirm) { this.controls = false; Sound.sfx('back'); } return; }
    const items = this.items();
    if (this.confirmNew) {
      if (m.left || m.right || m.up || m.down) { this.confirmSel = 1 - (this.confirmSel || 0); Sound.sfx('menu'); }
      if (m.back) { this.confirmNew = false; Sound.sfx('back'); }
      if (m.confirm) {
        if ((this.confirmSel || 0) === 0) { const dev = this.pickDevice(); Game.fadeTo(() => Game.setScene(new SelectScene(dev, null))); }
        this.confirmNew = false; Sound.sfx('select');
      }
      return;
    }
    if (m.up) { this.sel = (this.sel + items.length - 1) % items.length; Sound.sfx('menu'); }
    if (m.down) { this.sel = (this.sel + 1) % items.length; Sound.sfx('menu'); }
    if (m.confirm) {
      Sound.sfx('select');
      const choice = items[this.sel];
      const dev = this.pickDevice();
      if (choice === 'New Game') {
        if (Game.hasSave()) { this.confirmNew = true; this.confirmSel = 1; }
        else Game.fadeTo(() => Game.setScene(new SelectScene(dev, null)));
      } else if (choice === 'Continue') {
        const s = Game.loadSave();
        if (!s) { Game.toast('Save data is corrupted.', '#ff6a5a'); return; }
        Game.fadeTo(() => Game.setScene(new SelectScene(dev, s)));
      } else if (choice === 'Controls') this.controls = true;
      else if (choice === 'Credits') Game.fadeTo(() => Game.setScene(new CreditsScene(false)));
      else if (choice === 'Fullscreen') toggleFullscreen();
    }
  }
  draw(ctx) {
    const t = this.t;
    drawMeadowBackdrop(ctx, t);
    // chase: cat runs, dog chases (loops)
    const loop = (t * 140) % (VIEW_W + 400) - 200;
    drawCat(ctx, { x: loop + 90, y: 470, facing: 1, t, phase: t * 16, move: 1, def: ENEMIES.tabby, scale: 1.4 });
    drawDog(ctx, { x: loop - 20, y: 478, facing: 1, t, phase: t * 18, move: 1, look: BREEDS.retriever, equip: { weapon: ITEMS.wood_sword, helmet: ITEMS.leather_cap }, scale: 1.6 });
    drawDog(ctx, { x: loop - 110, y: 486, facing: 1, t: t + 1, phase: t * 18 + 1, move: 1, look: BREEDS.shiba, equip: { weapon: ITEMS.rusty_dagger }, scale: 1.4 });
    for (let i = 0; i < 6; i++) drawTree(ctx, 40 + i * 175 + (i % 2) * 40, 405 + (i % 3) * 8, 'oak', i * 0.37 + 0.11, t);
    // logo
    const bob = Math.sin(t * 2) * 5;
    ctx.save(); ctx.translate(VIEW_W / 2, 130 + bob);
    ctx.rotate(Math.sin(t) * 0.02);
    ctx.font = uiFont(92, 800); ctx.textAlign = 'center';
    ctx.lineWidth = 16; ctx.strokeStyle = '#3a1e0a'; ctx.lineJoin = 'round'; ctx.strokeText('DOG QUEST', 0, 0);
    const g = ctx.createLinearGradient(0, -70, 0, 10); g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#ff9a2a');
    ctx.fillStyle = g; ctx.fillText('DOG QUEST', 0, 0);
    ctx.font = uiFont(24, 700); ctx.lineWidth = 6; ctx.strokeText('Heroes of Pawtopia', 0, 40); ctx.fillStyle = '#ffffff'; ctx.fillText('Heroes of Pawtopia', 0, 40);
    drawPaw(ctx, -265, -30, 22, '#ffd23f'); drawPaw(ctx, 265, -30, 22, '#ffd23f');
    ctx.restore();
    if (Sound.ctx && Sound.ctx.state !== 'running' || (!Sound.ctx && this.stage === 1)) uiText(ctx, 'Click or press a key to enable sound', VIEW_W / 2, VIEW_H - 32, 13, '#1e3a1e', 'center', 700, false);
    if (this.stage === 0) {
      if (Math.floor(t * 2) % 2 === 0) uiText(ctx, 'Press any key or button', VIEW_W / 2, 330, 24, '#ffffff', 'center', 700);
      uiText(ctx, 'Keyboard & Gamepad supported  ·  1-2 Players', VIEW_W / 2, 360, 14, '#2a3a2a', 'center', 600, false);
      return;
    }
    if (this.controls) { uiPanel(ctx, 150, 60, 660, 430); drawControlsHelp(ctx, 170, 80, 620); uiText(ctx, `${Input.menuLabel('back')}: back`, VIEW_W / 2, 480, 13, '#9aa0b8', 'center', 600, false); return; }
    const items = this.items();
    const bx = VIEW_W / 2 - 120, by = 220;
    uiPanel(ctx, bx, by, 240, items.length * 42 + 20);
    items.forEach((it, i) => {
      const y = by + 38 + i * 42;
      if (i === this.sel) { ctx.fillStyle = 'rgba(232,200,120,0.25)'; roundRect(ctx, bx + 12, y - 25, 216, 36, 10); ctx.fill(); drawPaw(ctx, bx + 30, y - 7, 8, '#ffd23f'); }
      uiText(ctx, it, VIEW_W / 2 + 8, y, 21, i === this.sel ? '#ffd23f' : '#ffffff', 'center', 700, false);
    });
    if (this.confirmNew) {
      uiPanel(ctx, VIEW_W / 2 - 220, 200, 440, 130);
      uiText(ctx, 'Start a new game? Your old save will be lost!', VIEW_W / 2, 240, 16, '#ffffff', 'center', 700, false);
      ['Yes', 'No'].forEach((s, i) => {
        const x = VIEW_W / 2 - 80 + i * 160;
        if ((this.confirmSel || 0) === i) { ctx.fillStyle = 'rgba(232,200,120,0.3)'; roundRect(ctx, x - 50, 272, 100, 36, 10); ctx.fill(); }
        uiText(ctx, s, x, 297, 20, (this.confirmSel || 0) === i ? '#ffd23f' : '#ffffff', 'center', 700, false);
      });
    }
    uiText(ctx, 'v1.0  ·  A Cat Quest II inspired adventure, starring dogs', VIEW_W / 2, VIEW_H - 12, 12, '#1e3a1e', 'center', 600, false);
  }
}

// ------------------------------------------------------------
class SelectScene {
  constructor(p1dev, loaded) {
    this.name = 'select'; this.t = 0; this.loaded = loaded;
    const saved = loaded && loaded.party ? loaded.party : [];
    const c0 = saved[0] ? BREED_ORDER.indexOf(saved[0].breed) : 0;
    const c1 = saved[1] ? BREED_ORDER.indexOf(saved[1].breed) : 2;
    this.slots = [
      { joined: true, device: p1dev, cursor: Math.max(0, c0), locked: false },
      { joined: false, device: null, cursor: Math.max(0, c1), locked: false },
    ];
    this.countdown = -1;
  }
  enter() { Sound.play('title'); }
  family(dev) { return dev; }
  update(dt) {
    this.t += dt;
    const [a, b] = this.slots;
    // join P2
    if (!b.joined) {
      for (const d of Input.joinPresses()) {
        if (d !== a.device) {
          b.joined = true; b.device = d; b.locked = false;
          if (b.cursor === a.cursor) b.cursor = (a.cursor + 1) % 4;
          Sound.sfx('bark', { pitch: 1.3 }); this.countdown = -1;
          Nav.endFrame();
          return;
        }
      }
    }
    for (let i = 0; i < 2; i++) {
      const s = this.slots[i];
      if (!s.joined) continue;
      const n = Nav.get(s.device);
      const other = this.slots[1 - i];
      if (!s.locked) {
        if (n.left) { s.cursor = (s.cursor + 3) % 4; Sound.sfx('menu'); }
        if (n.right) { s.cursor = (s.cursor + 1) % 4; Sound.sfx('menu'); }
        if (n.confirm) {
          if (other.joined && other.locked && other.cursor === s.cursor) { Sound.sfx('error'); Game.toast('That hero is already taken!', '#ff9a8a', 1.5); }
          else { s.locked = true; Sound.sfx('bark', { pitch: BREEDS[BREED_ORDER[s.cursor]].bark }); }
        }
        if (n.back) {
          if (i === 0) { Game.fadeTo(() => Game.setScene(new TitleScene())); Sound.sfx('back'); }
          else { s.joined = false; s.device = null; Sound.sfx('back'); }
        }
      } else if (n.back) { s.locked = false; this.countdown = -1; Sound.sfx('back'); }
    }
    Nav.endFrame();
    const all = this.slots.filter(s => s.joined).every(s => s.locked);
    if (all && this.countdown < 0) this.countdown = 1.2;
    if (!all) this.countdown = -1;
    if (this.countdown >= 0) {
      this.countdown -= dt;
      if (this.countdown < 0) this.start();
    }
  }
  start() {
    const joined = this.slots.filter(s => s.joined);
    let devs = joined.map(s => s.device);
    if (joined.length === 1) devs = ['any'];
    else {
      const kbCount = devs.filter(d => d.startsWith('kb')).length;
      if (kbCount === 1) devs = devs.map(d => d.startsWith('kb') ? 'kb' : d);
    }
    const party = joined.map((s, i) => ({ breed: BREED_ORDER[s.cursor], device: devs[i] }));
    this.countdown = 99;
    if (this.loaded) Game.fadeTo(() => Game.startGame(party, this.loaded), 0.5);
    else Game.fadeTo(() => Game.setScene(new StoryScene(INTRO_SLIDES, 'intro', () => Game.startGame(party, null), party)), 0.5);
  }
  draw(ctx) {
    const t = this.t;
    drawMeadowBackdrop(ctx, t * 0.5, { sky1: '#3a5aa0', sky2: '#8ab0e0', h1: '#4a7a6a', h2: '#3e6a4a', h3: '#2f5a3a' });
    ctx.fillStyle = 'rgba(10,12,24,0.35)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    uiText(ctx, 'Choose Your Hero', VIEW_W / 2, 42, 34, '#ffd23f', 'center', 800);
    const cw = 212, chh = 326, gap = 14, x0 = (VIEW_W - (cw * 4 + gap * 3)) / 2, y0 = 96;
    BREED_ORDER.forEach((id, i) => {
      const b = BREEDS[id];
      const x = x0 + i * (cw + gap), y = y0;
      const hov = this.slots.filter(s => s.joined && s.cursor === i);
      uiPanel(ctx, x, y, cw, chh, { border: hov.length ? (hov.length === 2 ? '#ffffff' : PCOLORS[this.slots.indexOf(hov[0])]) : '#6a6a8a', top: hov.length ? '#34406a' : '#262c44' });
      // dog preview
      const atk = hov.length ? (t * 0.8 % 1.6) : -1;
      fillEll(ctx, 'rgba(0,0,0,0.25)', x + cw / 2, y + 150, 60, 14);
      drawDog(ctx, {
        x: x + cw / 2 - 10, y: y + 150, facing: 1, t: t + i, phase: 0, move: 0, look: b, scale: 2.7,
        equip: { weapon: ITEMS[b.start.weapon], helmet: b.start.helmet ? ITEMS[b.start.helmet] : null, armor: b.start.armor ? ITEMS[b.start.armor] : null },
        attack: atk >= 0 && atk < 0.35 ? atk / 0.35 : -1,
      });
      uiText(ctx, b.name, x + cw / 2, y + 186, 24, '#ffffff', 'center', 800);
      uiText(ctx, b.title, x + cw / 2, y + 206, 13, '#e8c878', 'center', 700, false);
      ctx.font = uiFont(12, 500);
      wrapText(ctx, b.desc, cw - 28).slice(0, 3).forEach((l, k) => uiText(ctx, l, x + cw / 2, y + 226 + k * 15, 12, '#d8d8e8', 'center', 500, false));
      const stats = [['HP', b.hp, '#56d364'], ['ATK', b.atk, '#ff7b5a'], ['MAG', b.mag, '#b48cff'], ['SPD', b.spd, '#4fb8ff']];
      stats.forEach(([l, v, c], k) => {
        const sy = y + 276 + k * 12;
        uiText(ctx, l, x + 18, sy + 7, 10, '#c8c8d8', 'left', 700, false);
        uiBar(ctx, x + 52, sy, cw - 70, 7, v / 1.5, c);
      });
      hov.forEach(s => {
        const pi = this.slots.indexOf(s);
        const tx = x + (hov.length === 2 ? (pi === 0 ? cw * 0.3 : cw * 0.7) : cw / 2);
        const bb = Math.sin(t * 5 + pi) * 3;
        fillPoly(ctx, PCOLORS[pi], [tx - 12, y - 18 + bb, tx + 12, y - 18 + bb, tx, y - 4 + bb]);
        uiText(ctx, 'P' + (pi + 1), tx, y - 22 + bb, 16, PCOLORS[pi], 'center', 800);
        if (s.locked) {
          ctx.fillStyle = rgba(PCOLORS[pi], 0.85); roundRect(ctx, x + 20 + (hov.length === 2 ? (pi ? cw / 2 - 10 : -10) : cw / 2 - 60), y + 100, hov.length === 2 ? cw / 2 - 20 : 120, 30, 10); ctx.fill();
          uiText(ctx, 'READY!', x + 20 + (hov.length === 2 ? (pi ? cw / 2 - 10 + (cw / 2 - 20) / 2 : -10 + (cw / 2 - 20) / 2) : cw / 2), y + 121, 17, '#ffffff', 'center', 800);
        }
      });
    });
    // join info
    const [a, b] = this.slots;
    const k = (dev, act) => {
      if (dev === 'kbA') return { confirm: 'SPACE', back: 'SHIFT', move: 'A/D' }[act];
      if (dev === 'kbB') return { confirm: 'ENTER', back: 'K', move: '←/→' }[act];
      return { confirm: 'A', back: 'B', move: 'D-pad' }[act];
    };
    const y = VIEW_H - 56;
    uiPanel(ctx, 40, y - 16, VIEW_W - 80, 60, { top: '#1e2440', bottom: '#141828' });
    uiText(ctx, `P1 · ${devFamilyName(a.device)}: ${k(a.device, 'move')} choose, ${k(a.device, 'confirm')} ready, ${k(a.device, 'back')} back`, 60, y + 8, 13, PCOLORS[0], 'left', 700, false);
    if (b.joined) uiText(ctx, `P2 · ${devFamilyName(b.device)}: ${k(b.device, 'move')} choose, ${k(b.device, 'confirm')} ready, ${k(b.device, 'back')} leave`, 60, y + 30, 13, PCOLORS[1], 'left', 700, false);
    else {
      const hint = a.device === 'kbA' ? 'ENTER (arrow keys side)' : a.device === 'kbB' ? 'SPACE (WASD side)' : 'SPACE / ENTER';
      const blink = Math.floor(t * 2) % 2 === 0;
      uiText(ctx, `Player 2: press ${hint} or A on another gamepad to join co-op!`, 60, y + 30, 13, blink ? '#ffffff' : '#c8c8d8', 'left', 700, false);
    }
    if (this.countdown >= 0 && this.countdown < 50) uiText(ctx, 'Get ready...', VIEW_W / 2, y - 28, 22, '#ffd23f', 'center', 800);
  }
}

// ------------------------------------------------------------
class StoryScene {
  constructor(slides, kind, onDone, party) {
    this.name = 'story'; this.slides = slides; this.kind = kind; this.onDone = onDone; this.party = party;
    this.i = 0; this.chars = 0; this.t = 0; this.st = 0;
  }
  enter() { Sound.play(this.kind === 'ending' ? 'victory' : 'title'); }
  finish() {
    if (this.done) return;
    this.done = true;
    if (this.kind === 'ending') Game.fadeTo(() => Game.setScene(new CreditsScene(true)), 0.8);
    else Game.fadeTo(() => this.onDone && this.onDone(), 0.6);
  }
  update(dt) {
    this.t += dt; this.st += dt;
    const s = this.slides[this.i];
    this.chars = Math.min(s.text.length, this.chars + dt * 40);
    const m = Input.menu;
    const adv = m.confirm || Input.kp(['KeyE']);
    if (m.back) { this.finish(); return; }
    if (adv && this.st > 0.2) {
      if (this.chars < s.text.length) this.chars = s.text.length;
      else if (this.i < this.slides.length - 1) { this.i++; this.chars = 0; this.st = 0; Sound.sfx('menu'); }
      else this.finish();
    }
  }
  draw(ctx) {
    const s = this.slides[this.i];
    const t = this.t;
    ctx.save();
    const fadeIn = clamp(this.st / 0.5, 0, 1);
    ctx.globalAlpha = fadeIn;
    this.drawScene(ctx, s.scene, t);
    ctx.globalAlpha = 1;
    ctx.restore();
    // cinematic bars
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, 36); ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120);
    ctx.font = uiFont(20, 600);
    const lines = wrapText(ctx, s.text.slice(0, Math.floor(this.chars)), VIEW_W - 160);
    lines.forEach((l, i) => uiText(ctx, l, VIEW_W / 2, VIEW_H - 78 + i * 28, 20, '#ffffff', 'center', 600));
    uiText(ctx, `${this.i + 1}/${this.slides.length}   ${Input.menuLabel('confirm')}: next   ${Input.menuLabel('back')}: skip`, VIEW_W - 20, VIEW_H - 12, 12, '#777', 'right', 600, false);
  }
  drawScene(ctx, scene, t) {
    const heroes = this.party ? this.party.map(p => p.breed) : (Game.players.length ? Game.players.map(p => p.breed) : ['retriever', 'shiba']);
    switch (scene) {
      case 'peace': {
        drawMeadowBackdrop(ctx, t);
        const n = this.kind === 'ending' ? 2 : 3;
        for (let i = 0; i < n; i++) {
          const x = 250 + i * 220 + Math.sin(t * 1.5 + i) * 40;
          drawDog(ctx, { x, y: 400 + (i % 2) * 20, facing: Math.cos(t * 1.5 + i) > 0 ? 1 : -1, t: t + i, phase: t * 12, move: 0.7, look: BREEDS[BREED_ORDER[i]], scale: 2 });
        }
        if (this.kind === 'ending') {
          drawCat(ctx, { x: 700, y: 410, facing: -1, t, def: ENEMIES.tabby, scale: 2, move: 0 });
          for (let i = 0; i < 4; i++) { const p = (t * 0.5 + i / 4) % 1; ctx.globalAlpha = 1 - p; drawHeart(ctx, 600 + Math.sin(p * 8 + i) * 20, 360 - p * 120, 10); }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'lion': {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#3a0a0a'); g.addColorStop(1, '#b8401a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        fillCirc(ctx, '#ff8a3a', 480, 200, 120);
        for (let i = 0; i < 14; i++) drawCat(ctx, { x: 60 + i * 66, y: 430 + (i % 2) * 12, facing: i < 7 ? 1 : -1, t: t + i, def: Object.assign({}, ENEMIES[choose(['tabby', 'siamese', 'witch', 'ninja', 'tiger'])], {}), scale: 1.1 + (i % 3) * 0.1, windup: Math.sin(t * 3 + i) > 0.7 ? 0.5 : -1 });
        drawCat(ctx, { x: 470, y: 380, facing: 1, t, def: Object.assign({}, ENEMIES.lioness, BOSSES.king_leo, { lion: true }), scale: 4, move: 0, phase2: Math.sin(t * 2) > 0.6 });
        break;
      }
      case 'keep': {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#0a0a24'); g.addColorStop(1, '#3a2a5a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        for (let i = 0; i < 60; i++) fillCirc(ctx, '#ffffff', hash2(i, 1) * VIEW_W, hash2(i, 2) * 300, hash2(i, 3) * 1.5 + 0.3);
        F(ctx, '#1a1426'); ctx.beginPath(); ctx.moveTo(0, 460); ctx.lineTo(200, 380); ctx.lineTo(760, 380); ctx.lineTo(VIEW_W, 460); ctx.lineTo(VIEW_W, VIEW_H); ctx.lineTo(0, VIEW_H); ctx.fill();
        ctx.save(); ctx.translate(480, 390); ctx.scale(2.4, 2.4); drawEntrance(ctx, 0, 0, 'castle', false, t, false); ctx.restore();
        ctx.globalAlpha = 0.25 + Math.sin(t * 2) * 0.1; F(ctx, '#ff5aff'); ctx.beginPath(); ctx.ellipse(480, 330, 190, 190, 0, Math.PI, TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,160,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(480, 330, 190, 190, 0, Math.PI, TAU); ctx.stroke();
        break;
      }
      case 'seals': {
        ctx.fillStyle = '#12142a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        const keys = Object.keys(SEALS);
        keys.forEach((k, i) => {
          const a = t * 0.8 + i * TAU / 4;
          const x = 480 + Math.cos(a) * 170, y = 230 + Math.sin(a) * 90;
          ctx.globalAlpha = 0.3; fillCirc(ctx, SEALS[k].color, x, y, 44); ctx.globalAlpha = 1;
          fillCirc(ctx, SEALS[k].color, x, y, 26); fillCirc(ctx, '#ffffff', x - 7, y - 7, 7);
          uiText(ctx, SEALS[k].name, x, y + 50, 15, SEALS[k].color, 'center', 700);
        });
        drawPaw(ctx, 480, 230, 40 + Math.sin(t * 3) * 4, '#ffd23f');
        break;
      }
      case 'hero': {
        drawMeadowBackdrop(ctx, t, { sky1: '#ff9a5a', sky2: '#ffd8a0' });
        heroes.forEach((b, i) => {
          const x = heroes.length === 1 ? 480 : 380 + i * 200;
          drawDog(ctx, { x, y: 420, facing: i ? -1 : 1, t: t + i, look: BREEDS[b], scale: 3, equip: { weapon: ITEMS[BREEDS[b].start.weapon], helmet: BREEDS[b].start.helmet ? ITEMS[BREEDS[b].start.helmet] : null, armor: BREEDS[b].start.armor ? ITEMS[BREEDS[b].start.armor] : null } });
        });
        for (let i = 0; i < 12; i++) { const p = (t * 0.4 + i / 12) % 1; ctx.globalAlpha = 1 - p; drawStar(ctx, '#ffd23f', 300 + hash2(i, 5) * 360, 400 - p * 260, 5); }
        ctx.globalAlpha = 1;
        break;
      }
      case 'lionfall': {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#2a1a3a'); g.addColorStop(1, '#6a4a5a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        drawCat(ctx, { x: 480, y: 300, facing: 1, t, def: Object.assign({}, ENEMIES.lioness, BOSSES.king_leo, { lion: true }), scale: 3.2, dead: 1 });
        for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3; drawStar(ctx, '#ffe84a', 470 + Math.cos(a) * 60, 330 + Math.sin(a) * 15, 10); }
        break;
      }
      case 'king': {
        drawMeadowBackdrop(ctx, t, { sky1: '#6ab0ff', sky2: '#e0f4ff' });
        drawDog(ctx, { x: 480, y: 420, facing: 1, t, look: { fur: '#f0f0f0', fur2: '#ffffff', ear: 'floppy', tail: 'feather', beard: true }, equip: { helmet: ITEMS.royal_crown, armor: ITEMS.royal_armor }, scale: 3.4 });
        for (let i = 0; i < 40; i++) { const p = (t * 0.3 + hash2(i, 9)) % 1; F(ctx, ['#ff5a8a', '#ffd23f', '#4fb8ff', '#6ad86a'][i % 4]); ctx.fillRect(hash2(i, 7) * VIEW_W, p * VIEW_H, 6, 10); }
        break;
      }
    }
  }
}

// ------------------------------------------------------------
class CreditsScene {
  constructor(fromEnding) { this.name = 'credits'; this.t = 0; this.fromEnding = fromEnding; }
  enter() { Sound.play('victory'); }
  update(dt) {
    const m = Input.menu;
    this.t += dt * (m.confirm || Input.kd(['Space', 'Enter']) ? 4 : 1);
    const total = CREDITS.length * 40 + VIEW_H + 100;
    if (m.back || this.t * 40 > total) { if (!this.left) { this.left = true; Game.fadeTo(() => Game.setScene(new TitleScene()), 0.8); } }
  }
  draw(ctx) {
    ctx.fillStyle = '#10142a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let i = 0; i < 80; i++) fillCirc(ctx, '#ffffff', hash2(i, 1) * VIEW_W, (hash2(i, 2) * VIEW_H + this.t * 10 * (0.5 + hash2(i, 3))) % VIEW_H, hash2(i, 4) * 1.4 + 0.3);
    const y0 = VIEW_H + 20 - this.t * 40;
    CREDITS.forEach(([s, k], i) => {
      const y = y0 + i * 40;
      if (y < -40 || y > VIEW_H + 40) return;
      if (k === 'title') uiText(ctx, s, VIEW_W / 2, y, 46, '#ffd23f', 'center', 800);
      else if (k === 'sub') uiText(ctx, s, VIEW_W / 2, y, 20, '#ffffff', 'center', 700);
      else if (k === 'head') uiText(ctx, s, VIEW_W / 2, y, 18, '#e8c878', 'center', 800);
      else uiText(ctx, s, VIEW_W / 2, y, 17, '#e0e0f0', 'center', 500);
    });
    // parade
    const t = this.t;
    BREED_ORDER.forEach((b, i) => {
      const x = ((t * 80 + i * 90) % (VIEW_W + 200)) - 100;
      drawDog(ctx, { x, y: VIEW_H - 20, facing: 1, t: t + i, phase: t * 14 + i, move: 1, look: BREEDS[b], scale: 1.3 });
    });
    const cx = ((t * 80 + 420) % (VIEW_W + 200)) - 100;
    drawCat(ctx, { x: cx, y: VIEW_H - 20, facing: 1, t, phase: t * 14, move: 1, def: ENEMIES.kitten, scale: 1.3 });
    if (this.fromEnding && this.t > 3) uiText(ctx, 'Your save is kept. Continue to explore Pawtopia after the credits!', VIEW_W / 2, 30, 13, '#9aa0b8', 'center', 600, false);
  }
}

// ------------------------------------------------------------
class GameOverScene {
  constructor() { this.name = 'gameover'; this.t = 0; this.sel = 0; }
  enter() { Sound.stop(); Sound.sfx('gameover'); }
  update(dt) {
    this.t += dt;
    if (this.t < 1) return;
    const m = Input.menu;
    if (m.up || m.down) { this.sel = 1 - this.sel; Sound.sfx('menu'); }
    if (m.confirm) {
      Sound.sfx('select');
      if (this.sel === 0) Game.fadeTo(() => Game.respawn(), 0.6);
      else Game.fadeTo(() => Game.setScene(new TitleScene()), 0.6);
    }
  }
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, '#1a0a14'); g.addColorStop(1, '#3a1a2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    Game.players.forEach((p, i) => drawDog(ctx, { x: (Game.players.length > 1 ? 420 : 480) + i * 120, y: 290, facing: 1, t, look: p.look, dead: 1, scale: 2.4 }));
    for (let i = 0; i < 3; i++) drawCat(ctx, { x: 250 + i * 230, y: 420, facing: i % 2 ? -1 : 1, t: t + i, phase: t * 10, move: Math.sin(t * 4 + i) > 0 ? 0.5 : 0, def: ENEMIES[['tabby', 'witch', 'siamese'][i]], scale: 1.6 });
    uiText(ctx, 'THE PARTY HAS FAINTED', VIEW_W / 2, 150, 44, '#ff6a5a', 'center', 800);
    uiText(ctx, 'The cats are doing a victory dance...', VIEW_W / 2, 185, 16, '#e0c0d0', 'center', 600);
    if (t < 1) return;
    const opts = [`Continue from ${TOWNS[Game.state.lastTown].name} (lose 10% gold)`, 'Return to Title'];
    opts.forEach((o, i) => {
      const y = 470 + i * 34;
      if (i === this.sel) { ctx.fillStyle = 'rgba(232,200,120,0.25)'; roundRect(ctx, VIEW_W / 2 - 250, y - 24, 500, 32, 10); ctx.fill(); }
      uiText(ctx, o, VIEW_W / 2, y, 19, i === this.sel ? '#ffd23f' : '#ffffff', 'center', 700);
    });
  }
}
