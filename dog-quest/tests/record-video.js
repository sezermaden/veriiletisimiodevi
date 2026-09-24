// Records a ~5 minute gameplay video (1280x720, 30 fps, with the game's synthesized audio).
// Two bot-controlled dogs play a scripted tour of the game. Frames are stepped
// deterministically, so the video is smooth regardless of machine speed.
// Usage: FFMPEG=/path/to/ffmpeg node tests/record-video.js out.mp4
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require(process.env.PW_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'tests', 'out', 'dog-quest-gameplay.mp4'));
const FF = process.env.FFMPEG || 'ffmpeg';
const FPS = 30, W = 1280, H = 720;
const BATCH = 15;

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const tmpVideo = OUT.replace(/\.mp4$/, '.video.mp4');
  const tmpAudio = OUT.replace(/\.mp4$/, '.audio.wav');
  const srv = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.waitForFunction(() => typeof Game !== 'undefined' && Game.scene === 'title', null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  let totalFrames = await page.evaluate(({ FPS }) => {
    localStorage.clear();
    Game.manual = true;
    Game.resize();
    // ---------- offline audio capture ----------
    const SR = 32000, DUR = 330;
    const off = new OfflineAudioContext(1, SR * DUR, SR);
    window.__vt = 0;
    const proxy = new Proxy(off, {
      get(t, k) {
        if (k === 'currentTime') return window.__vt;
        if (k === 'state') return 'running';
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    window.AudioContext = function () { return proxy; };
    Sound.ctx = null;
    Sound.unlock();
    Sound.settings.music = 0.55; Sound.settings.sfx = 0.75; Sound.applyVolumes();
    window.__off = off;

    // ---------- bots ----------
    const blank = () => ({ mx: 0, my: 0, attack: false, attackHeld: false, roll: false, interact: false, spell: [false, false, false, false], pause: false, map: false });
    const orig = Input.state.bind(Input);
    const B = window.BOT = { inp: { bot0: blank(), bot1: blank() }, goal: null, interactNow: false, on: false };
    Input.state = d => (d === 'bot0' || d === 'bot1' ? B.inp[d] : orig(d));
    B.think = (p) => {
      const inp = blank();
      if (p.down || !B.on) return inp;
      if (B.goal && p.pid === 0) {
        const d = dist(p.x, p.y, B.goal.x, B.goal.y);
        if (d > 34) { const a = angleTo(p.x, p.y, B.goal.x, B.goal.y); inp.mx = Math.cos(a); inp.my = Math.sin(a); }
        else if (B.interactNow) { inp.interact = true; B.interactNow = false; }
        return inp;
      }
      if (B.goal && p.pid === 1) {
        const o = Game.players[0];
        if (dist(p.x, p.y, o.x, o.y) > 70) { const a = angleTo(p.x, p.y, o.x, o.y); inp.mx = Math.cos(a); inp.my = Math.sin(a); }
        return inp;
      }
      for (const tt of Game.telegraphs) {
        if (tt.friendly || tt.cancel || tt.noDamage || tt.t < tt.dur * 0.5) continue;
        if (!Game.inTele(tt, p.x, p.y - 6, p.r + 8) || Math.random() > 0.75) continue;
        const a = tt.kind === 'line' ? tt.angle + Math.PI / 2 : angleTo(tt.x, tt.y, p.x, p.y);
        inp.mx = Math.cos(a); inp.my = Math.sin(a);
        if (p.rollCd <= 0 && p.state !== 'roll') inp.roll = true;
        return inp;
      }
      const e = Game.nearestEnemy(p.x, p.y, 1000);
      if (!e) {
        const o = Game.players[1 - p.pid];
        if (o && dist(p.x, p.y, o.x, o.y) > 90) { const a = angleTo(p.x, p.y, o.x, o.y); inp.mx = Math.cos(a) * 0.7; inp.my = Math.sin(a) * 0.7; }
        return inp;
      }
      const d = dist(p.x, p.y, e.x, e.y), a = angleTo(p.x, p.y, e.x, e.y);
      const mage = p.breed === 'husky';
      const want = mage ? 170 : p.stats.wtype.range * 0.75 + e.r;
      if (d > want) { inp.mx = Math.cos(a); inp.my = Math.sin(a); }
      else if (mage && d < 100) { inp.mx = -Math.cos(a); inp.my = -Math.sin(a); }
      else { inp.attack = !mage && Math.random() < 0.55; inp.mx = Math.cos(a) * 0.01; inp.my = Math.sin(a) * 0.01; }
      if (d < 420 && Math.random() < (mage ? 0.06 : 0.02)) {
        const s = Math.floor(Math.random() * 4);
        if (p.spells[s] !== 'heal' || p.hp < p.stats.maxHp * 0.7) inp.spell[s] = true;
      }
      return inp;
    };
    B.gear = (lvl) => {
      const t = Math.min(5, Math.max(1, Math.ceil(lvl / 9)));
      const all = Object.values(ITEMS).filter(it => it.tier === t && !it.chestOnly);
      const pick = (slot, type, i = 0) => all.filter(it => it.slot === slot && (!type || it.type === type))[i] || all.filter(it => it.slot === slot)[0];
      Game.players.forEach(p => {
        const w = p.breed === 'husky' ? pick('weapon', 'staff') : pick('weapon', 'sword');
        const h = pick('helmet', null, p.pid);
        const ar = p.breed === 'husky' ? (all.filter(it => it.slot === 'armor' && it.style === 'robe')[0] || pick('armor')) : pick('armor');
        for (const it of [w, h, ar]) if (it) { Game.state.inv[it.id] = Math.max(Game.state.inv[it.id] || 1, 1 + Math.floor(lvl / 10)); p.equip[it.slot] = it.id; }
      });
    };
    B.level = (lvl) => {
      const st = Game.state;
      st.level = lvl; st.xp = Math.floor(xpForLevel(lvl) * 0.3);
      for (const id of SPELL_ORDER) st.spells[id] = Math.min(SPELL_MAX, Math.max(1, Math.ceil(lvl / 5)));
      Game.players[0].spells = ['flame', 'thunder', 'heal', lvl >= 30 ? 'meteor' : 'quake'];
      Game.players[1].spells = ['frost', 'flame', 'spirit', lvl >= 20 ? 'shield' : 'heal'];
      B.gear(lvl);
      Game.players.forEach(p => { p.refresh(false); p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; p.down = false; });
    };
    B.quest = (id) => {
      const st = Game.state;
      for (const q of MAIN_ORDER) { if (q === id) break; st.quests[q] = { status: 'done', progress: 0 }; }
      st.quests[id] = { status: 'active', progress: 0 };
      for (const q of MAIN_ORDER.slice(MAIN_ORDER.indexOf(id) + 1)) delete st.quests[q];
    };
    B.findSpot = (tx, ty) => {
      const w = Game.world;
      for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const ok = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]].every(([a, b]) => w.walkableTile(tx + dx + a, ty + dy + b));
        if (ok && w.reach[w.idx(tx + dx, ty + dy)] && !w.inSafeZone((tx + dx) * TS, (ty + dy) * TS, 2)) return { x: (tx + dx) * TS + 16, y: (ty + dy) * TS + 20 };
      }
      return { x: tx * TS, y: ty * TS };
    };
    B.spawnRing = (n, lvl, r = 200) => {
      const p = Game.players[0];
      const reg = REGIONS[Game.world.regionAt(p.x, p.y)];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + rand(-0.3, 0.3);
        let x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.7;
        if (Game.map.isSolid(x, y)) continue;
        const e = new Enemy(reg.enemies[i % reg.enemies.length], lvl, x, y, { region: reg.id });
        e.aggro = true; e.atkCd = 0.6 + i * 0.35; Game.enemies.push(e);
        Game.poof(x, y - 12, '#ffffff');
      }
    };
    B.goWorld = (tx, ty, lvl, qid) => {
      Game.fadeTo(() => {
        Game.dungeon = null; Game.map = Game.world; Game.boss = null;
        Game.enemies = []; Game.projectiles = []; Game.loot = []; Game.telegraphs = [];
        Game.overlays = [];
        if (qid) B.quest(qid);
        B.level(lvl);
        const s = B.findSpot(tx, ty);
        Game.players.forEach((p, i) => { p.x = s.x - i * 36; p.y = s.y + i * 14; p.vx = p.vy = 0; p.state = 'idle'; });
        Game.cam.x = s.x; Game.cam.y = s.y;
        Game.regionId = -1; Game.townId = null; Game.spawnT = 0.5;
        B.spawnRing(6, lvl + 1, 230);
      }, 0.45);
    };
    B.softGod = () => {
      for (const p of Game.players) {
        if (p.down) { p.down = false; p.hp = p.stats.maxHp * 0.5; }
        if (p.hp < p.stats.maxHp * 0.35) p.hp = p.stats.maxHp * 0.35;
        if (p.breed === 'husky' && p.mp < p.stats.maxMp * 0.5) p.mp += p.stats.maxMp * 0.01;
      }
    };

    // ---------- key taps ----------
    const R = window.REC = { frame: 0, releases: [] };
    R.tap = (code) => { Input.pressed.add(code); Input.down.add(code); Input.anyPressedFlag = true; R.releases.push([code, 4]); };
    R.at = (segT, t) => segT >= t && segT - 1 / FPS < t;

    // ---------- the script ----------
    const toBots = () => { Game.players.forEach(p => { p.device = 'bot' + p.pid; }); B.on = true; };
    const S = [];
    S.push({ dur: 9, start() { Game.setScene(new TitleScene()); }, update(t) { if (R.at(t, 2.5)) R.tap('Space'); if (R.at(t, 7.2)) R.tap('Enter'); } });
    S.push({ dur: 9.5, update(t) {
      if (R.at(t, 1.2)) R.tap('Space');
      if (R.at(t, 2.8)) R.tap('KeyA');
      if (R.at(t, 4.4)) R.tap('Enter');
      if (R.at(t, 5.8)) R.tap('Space');
    } });
    S.push({ dur: 16.5, update(t) { for (const k of [3.2, 6.4, 9.6, 12.8, 15.6]) if (R.at(t, k)) R.tap('Enter'); } });
    S.push({ dur: 17, start() {}, update(t) {
      if (R.at(t, 0.2) && Game.scene === 'play') { toBots(); B.level(1); Game.state.gold = 60; }
      if (R.at(t, 3.6)) R.tap('Enter');
      if (R.at(t, 4.2)) { const n = Game.npcs.find(n => n.id === 'elder'); B.goal = { x: n.x, y: n.y + 26 }; }
      if (t > 4.2 && B.goal && !Game.overlays.length && !Game.questDone('m1') && dist(Game.players[0].x, Game.players[0].y, B.goal.x, B.goal.y) < 36) B.interactNow = true;
      if (Game.overlays.length && t > 5) { for (const k of [1.6, 3.2, 4.8, 6.4, 8.0, 9.6, 11.2]) if (R.at(t, 5 + k)) R.tap('Enter'); }
    } });
    S.push({ dur: 36, start() { B.goal = null; B.goWorld(34, 80, 4, 'm2'); }, update(t) {
      if (R.at(t, 12) || R.at(t, 24)) B.spawnRing(5, 5, 260);
    } });
    S.push({ dur: 36, start() { Game.enterDungeon(DUNGEON_BY_ID.puppy_cave); }, update(t) {
      const dg = Game.dungeon;
      if (!dg) return;
      if (R.at(t, 2.2)) {
        const r = dg.rooms.filter(r => r.i !== 0 && r !== dg.bossRoom).sort((a, b) => b.w * b.h - a.w * a.h)[0];
        Game.fadeTo(() => { Game.players.forEach((p, i) => { p.x = r.cx * TS + 16 - i * 36; p.y = (r.cy + 2) * TS; }); Game.cam.x = r.cx * TS; Game.cam.y = r.cy * TS; }, 0.3);
      }
      if (R.at(t, 13)) {
        const Bm = dg.bossRoom;
        Game.fadeTo(() => { for (const e of Game.enemies) if (!e.dead) { e.dead = true; e.deadT = 1; } Game.players.forEach((p, i) => { p.x = Bm.cx * TS + 16 - i * 40; p.y = (Bm.y + Bm.h - 2) * TS; }); Game.cam.x = Bm.cx * TS; Game.cam.y = (Bm.y + Bm.h - 4) * TS; }, 0.3);
      }
      if (Game.boss && t > 27 && Game.boss.hp > Game.boss.maxHp * 0.06) Game.boss.hp = Game.boss.maxHp * 0.06;
      if (dg.rewardChest && !Game.state.chests[dg.rewardChest.id] && t > 31) { B.goal = { x: dg.rewardChest.x, y: dg.rewardChest.y + 30 }; B.interactNow = dist(Game.players[0].x, Game.players[0].y, B.goal.x, B.goal.y) < 36; }
    } });
    const regions = [[100, 124, 12, 'm6', 21], [90, 24, 18, 'm8', 21], [138, 76, 25, 'm10', 21], [164, 126, 33, 'm12', 21]];
    for (const [tx, ty, lvl, q, dur] of regions) {
      S.push({ dur, start() { B.goal = null; B.goWorld(tx, ty, lvl, q); }, update(t) { if (R.at(t, 10)) B.spawnRing(5, lvl + 1, 260); } });
    }
    S.push({ dur: 19, start() {
      B.goal = null;
      Game.fadeTo(() => {
        Game.enemies = []; Game.telegraphs = []; Game.projectiles = [];
        const tw = TOWNS.cinderpaw;
        Game.players.forEach((p, i) => { p.x = (tw.tx - 5) * TS + 16 + i * 40; p.y = (tw.ty - 1) * TS + 20; });
        Game.cam.x = Game.players[0].x; Game.cam.y = Game.players[0].y;
        Game.state.gold = 26000; Game.regionId = -1; Game.townId = null;
      }, 0.45);
    }, update(t) {
      const p = Game.players[0];
      if (R.at(t, 2.2)) UI.open(new ShopOverlay('smith', 'cinderpaw', p));
      for (const k of [3.4, 4.2, 5.0]) if (R.at(t, k)) R.tap('ArrowDown');
      if (R.at(t, 6.2)) R.tap('Enter');
      if (R.at(t, 8.6)) R.tap('Escape');
      if (R.at(t, 9.4)) UI.open(new PauseOverlay(p));
      for (const k of [12.0, 12.8, 13.6]) if (R.at(t, k)) R.tap('KeyE');
      if (R.at(t, 17.4)) R.tap('Escape');
    } });
    S.push({ dur: 62, start() {
      B.quest('m14'); Game.state.barrier = false; B.level(44);
      Game.enterDungeon(DUNGEON_BY_ID.lions_keep);
    }, update(t) {
      const dg = Game.dungeon;
      if (!dg) return;
      if (R.at(t, 2.4)) {
        const Bm = dg.bossRoom;
        Game.fadeTo(() => { for (const e of Game.enemies) if (!e.dead) { e.dead = true; e.deadT = 1; } Game.players.forEach((p, i) => { p.x = Bm.cx * TS + 16 - i * 44; p.y = (Bm.y + Bm.h - 2) * TS; }); Game.cam.x = Bm.cx * TS; Game.cam.y = (Bm.y + Bm.h - 4) * TS; }, 0.35);
      }
      const b = Game.boss;
      if (b && !b.dead) {
        if (!b.tuned) { b.tuned = true; b.maxHp = Math.round(b.maxHp * 1.6); b.hp = b.maxHp; }
        if (t > 30 && b.hp > b.maxHp * 0.49) b.hp = b.maxHp * 0.49;
        if (t > 52 && b.hp > b.maxHp * 0.04) b.hp = b.maxHp * 0.04;
      }
    } });
    S.push({ dur: 29, update(t) {
      if (Game.scene === 'story') { if (!this.st0) this.st0 = t; const k = t - this.st0; for (const s of [3.4, 6.8, 10.2, 13.6]) if (R.at(k, s)) R.tap('Enter'); }
    } });
    R.S = S; R.cur = 0; R.segT = 0;
    R.total = Math.round(S.reduce((a, s) => a + s.dur, 0) * FPS);

    R.frameStep = () => {
      window.__vt = R.frame / FPS;
      const seg = R.S[R.cur];
      if (seg) {
        if (!seg.started) { seg.started = true; if (seg.start) seg.start(); }
        if (seg.update) seg.update.call(seg, R.segT);
      }
      for (let sub = 0; sub < 2; sub++) {
        if (Game.scene === 'play' && B.on) { Game.players.forEach(p => { B.inp['bot' + p.pid] = B.think(p); }); B.softGod(); }
        Game.step(1, 1 / 60, false);
        R.releases = R.releases.filter(r => { if (--r[1] <= 0) { Input.down.delete(r[0]); return false; } return true; });
      }
      Sound._schedule();
      R.segT += 1 / FPS;
      if (seg && R.segT >= seg.dur) { R.cur++; R.segT = 0; }
      R.frame++;
      Game.render();
    };
    return R.total;
  }, { FPS });

  const MAXSEC = +process.env.MAXSEC || 0;
  if (MAXSEC) totalFrames = Math.min(totalFrames, MAXSEC * FPS);
  console.log('frames to record:', totalFrames, `(${(totalFrames / FPS).toFixed(1)} s)`);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmpVideo], { stdio: ['pipe', 'inherit', 'inherit'] });
  const write = buf => new Promise(r => { if (!ff.stdin.write(buf)) ff.stdin.once('drain', r); else r(); });
  const t0 = Date.now();
  for (let f = 0; f < totalFrames; f += BATCH) {
    const n = Math.min(BATCH, totalFrames - f);
    const frames = await page.evaluate((n) => {
      const out = [];
      const c = document.getElementById('game');
      for (let i = 0; i < n; i++) { REC.frameStep(); out.push(c.toDataURL('image/jpeg', 0.92).split(',')[1]); }
      return out;
    }, n);
    for (const b64 of frames) await write(Buffer.from(b64, 'base64'));
    if ((f / BATCH) % 40 === 0) {
      const info = await page.evaluate(() => `${Game.scene} seg=${REC.cur} enemies=${Game.enemies.length} lvl=${Game.state ? Game.state.level : '-'}`);
      console.log(`  ${(f / FPS).toFixed(0)}s / ${(totalFrames / FPS).toFixed(0)}s  [${((Date.now() - t0) / 1000).toFixed(0)}s elapsed] ${info}`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('video encoded');

  // ---------- render audio ----------
  const wavB64 = await page.evaluate(async (seconds) => {
    const buf = await window.__off.startRendering();
    const sr = buf.sampleRate, n = Math.min(buf.length, Math.ceil(seconds * sr));
    const data = buf.getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + n * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    ws(36, 'data'); out.setUint32(40, n * 2, true);
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
    const g = peak > 0.95 ? 0.95 / peak : 1;
    for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * g)) * 32767, true);
    const bytes = new Uint8Array(out.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, totalFrames / FPS);
  fs.writeFileSync(tmpAudio, Buffer.from(wavB64, 'base64'));
  console.log('audio rendered');
  await new Promise((res, rej) => {
    const m = spawn(FF, ['-y', '-loglevel', 'error', '-i', tmpVideo, '-i', tmpAudio, '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
    m.on('close', c => (c === 0 ? res() : rej(new Error('mux failed ' + c))));
  });
  fs.unlinkSync(tmpVideo); fs.unlinkSync(tmpAudio);
  console.log('saved', OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + ' MB');
  console.log('ERRORS:', errors.length ? errors.slice(0, 5).join('\n') : 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
