// Turf Clash: the genre's 4v4 turf war, single-player with bots. You are Alpha (TEAM_HERO) with 3
// ally bots; 4 rival bots are Bravo (TEAM_MURK). Three minutes, most floor inked wins.
//
// Flow: arena flyover + title card → READY? → GO! → 3:00 (music ramps at 1:00, 10-second
// countdown) → FINISH! (everyone freezes) → camera rises over the arena → the otter judges drum
// and raise a flag for the winner → results screen (Rematch / Change Loadout / Main Menu).
//
//   new TurfMode(app, 'turf-pier', { difficulty: 'easy' | 'normal' | 'hard', kit })
//   test hooks: mode.timeLeft = 5 (jump to the end), mode.phase, mode.stats, mode.nav.stats
import * as THREE from 'three';
import { TEAM_HERO, TEAM_MURK } from '../../ink/ink-system.js';
import { TURF_PALETTES, INK_PALETTES, settings } from '../../engine/settings.js';
import { save } from '../../engine/save.js';
import { KITS, MAINS } from '../../weapons/base.js';
import { NavGraph } from '../../turf/nav.js';
import { TurfBot, BotInput, BOT_NAMES, botLook } from '../../turf/bot.js';
import { BotBrain } from '../../turf/bot-ai.js';
import { TurfOverlay } from '../../turf/overlay.js';
import { SuperJumps } from '../../turf/superjump.js';
import { MapView } from '../../turf/map-view.js';
import { JudgeBooth } from '../../turf/judges.js';
import { BaseBarriers } from '../../turf/bases.js';
import { TurfResultsScreen } from '../../turf/results.js';
import '../../turf/sfx.js';

export const MATCH_TIME = 180;
const INTRO = 3.4, READY_GO = 1.25, FINISH = 2.2, OVERHEAD = 3.4, JUDGE_DRUM = 2.8, JUDGE_END = 5.6;

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _hc = new THREE.Vector3();

export class TurfMode {
  constructor(app, stageId, opts = {}) {
    this.app = app;
    this.stageId = stageId;
    this.opts = { difficulty: 'normal', ...opts };
    this.kind = 'turf';
    this.difficulty = this.opts.difficulty;
    this.timeLeft = this.opts.time ?? MATCH_TIME;
    this.phase = 'init';
    this.phaseT = 0;
    this.live = false;
    this.botsActive = false;
    this.bots = [];
    this.allPlayers = [];
    this.teams = { [TEAM_HERO]: [], [TEAM_MURK]: [] };
    this.stats = new Map();
    this.reveal = new Map();
    this.revealT = 0;
    this.mapHeld = false;
    this.offs = [];
    this.result = null;
    this.session = null;
  }

  // =============================================================================================
  start(session) {
    this.session = session;
    const S = session, def = S.level.def, P = S.player;

    // ---- team colours ----
    // random team pair per match; the colour-blind setting always gets its yellow/blue pair
    const cb = settings.get('gameplay.inkPalette') === 'colorblind' ? { a: INK_PALETTES.colorblind.hero, b: INK_PALETTES.colorblind.murk } : null;
    const pal = this.opts.palette || cb || TURF_PALETTES[Math.floor(Math.random() * TURF_PALETTES.length)];
    this.colors = { a: pal.a, b: pal.b };
    S.ink.setTeamColors(pal.a, pal.b);
    this.css = { a: pal.a, b: pal.b };

    // ---- arena layout (with fallbacks for arenas without turf metadata) ----
    const b = S.level.bounds;
    this.halfLength = Math.max(10, (b.max.x - b.min.x) / 2);
    const sp = def.spawn?.pos || [0, 0, 0];
    const alpha = def.bases?.alpha || sp;
    const bravo = def.bases?.bravo || [-alpha[0], alpha[1], -alpha[2]];
    this.base = { [TEAM_HERO]: new THREE.Vector3().fromArray(alpha), [TEAM_MURK]: new THREE.Vector3().fromArray(bravo) };
    const slotsA = def.spawnSlots?.alpha || [-3, -1, 1, 3].map((dz) => [alpha[0], alpha[1], alpha[2] + dz]);
    const slotsB = def.spawnSlots?.bravo || slotsA.map((p) => [-p[0], p[1], -p[2]]);
    this.slots = { [TEAM_HERO]: slotsA, [TEAM_MURK]: slotsB };
    this.yaw = { [TEAM_HERO]: Math.PI / 2, [TEAM_MURK]: -Math.PI / 2 };
    const zoneOf = (p) => ({ min: [p[0] - 4, p[1] - 2.5, p[2] - 6.3], max: [p[0] + 4, p[1] + 5, p[2] + 6.3] });
    this.zones = { [TEAM_HERO]: def.baseZones?.alpha || zoneOf(alpha), [TEAM_MURK]: def.baseZones?.bravo || zoneOf(bravo) };

    // ---- player: kit + colour ----
    const kitId = KITS[this.opts.kit] ? this.opts.kit : (KITS[save.data.kit] ? save.data.kit : P.kitId);
    P.model.setInkColor(pal.a);
    P.setKit(kitId);               // rebuild the weapon models in the new team colour
    S.hud.refreshKit?.();
    P.name = 'Kai';
    this.slotOf = new Map([[P, 1]]);
    this._placeAtSlot(P);

    // ---- navigation + paint targets ----
    this.nav = new NavGraph(S, { baseZones: { alpha: this.zones[TEAM_HERO], bravo: this.zones[TEAM_MURK] }, links: def.navLinks }).build();
    this._buildPaintFaces();

    // ---- bots ----
    this._spawnBots();
    this.allPlayers = [P, ...this.bots.map((bt) => bt.player)];
    this.teams[TEAM_HERO] = this.allPlayers.filter((p) => p.team === TEAM_HERO);
    this.teams[TEAM_MURK] = this.allPlayers.filter((p) => p.team === TEAM_MURK);
    for (const p of this.allPlayers) this.stats.set(p, { name: p.name, team: p.team, isPlayer: !!p.isPlayer, kit: p.kitId, inked: 0, splats: 0, deaths: 0, specials: 0 });

    // player movement is blocked while the map is open or a super jump runs (instance wrapper)
    const origStep = P.step.bind(P);
    const blocked = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, isDown: (a) => (a === 'swim' ? S.input.isDown('swim') : false), justPressed: () => false };
    P.step = (dt, input, yaw) => {
      const a = this.auto;
      if (a && P.alive && !P.frozen && this.botsActive) return origStep(dt, this._autoStep(a, dt), a.shim.aimYaw);
      return origStep(dt, (this.map?.open || this.jumps?.isJumping(P)) ? blocked : input, yaw);
    };
    P.onDamaged = (amount, info) => this.auto?.brain.onDamaged(amount, info);

    // ---- events: stats + kill feed ----
    this.offs.push(S.ink.onPaint((team, m2, source) => {
      if (!this.live) return;
      const st = this.stats.get(source);
      if (st && team === st.team) st.inked += m2;
    }));
    this.offs.push(S.events.on('actorDefeated', (e) => this._onDefeat(e)));
    this.offs.push(S.events.on('playerRespawned', () => this.auto?.brain.reset()));
    this.offs.push(S.events.on('special', (e) => { const st = this.stats.get(e.who); if (st && this.live) st.specials++; }));
    this.offs.push(S.events.on('hit', (e) => { if (e.source?.team === TEAM_HERO && e.target?.team === TEAM_MURK) this.reveal.set(e.target, S.time + 2); }));

    // ---- set dressing + systems ----
    const bi = def.baseInfo || {};
    this.barriers = new BaseBarriers(S, this.zones, { floorY: bi.y0 ?? alpha[1] - 1, top: bi.top ?? alpha[1] });
    this.judges = new JudgeBooth(S, def.judge || { pos: [0, 3, b.min.z - 7], yaw: 0 });
    this.jumps = new SuperJumps(this);
    this.overlay = new TurfOverlay();
    this.overlay.setColors(pal.a, pal.b);
    this.map = new MapView(S, this);
    this._buildAllyMarkers();

    // ---- intro ----
    P.frozen = true;
    S.hud.setObjective('');
    S.hud.show(false);
    S.hud.turf(this.timeLeft, this._roster(TEAM_HERO), this._roster(TEAM_MURK));
    this._prepIntro();
    this._setPhase('intro');
    this.overlay.title(def.name || 'Turf Clash');
    S.audio?.playMusic?.('turf', { intensity: 0 });
    S.allowPause = true;
  }

  /** Test / demo hook: let a bot brain drive the player (camera follows its aim). */
  setAutopilot(on = true) {
    const S = this.session, P = S.player;
    if (on && !this.auto) {
      const shim = { player: P, session: S, aimYaw: S.camRig.yaw };
      this.auto = { shim, brain: new BotBrain(shim, this, this.opts.autoDifficulty || this.difficulty), input: new BotInput() };
      this.auto.brain.reset();
    } else if (!on) this.auto = null;
    return !!this.auto;
  }

  _autoStep(a, dt) {
    const S = this.session, P = S.player, b = a.brain, inp = a.input;
    b.step(dt);
    const y = a.shim.aimYaw;
    inp.move.y = b.move.x * -Math.sin(y) + b.move.z * -Math.cos(y);
    inp.move.x = b.move.x * Math.cos(y) + b.move.z * -Math.sin(y);
    inp.fire = b.fire; inp.swim = b.swim;
    P.swimToggled = inp.swim;
    S.camRig.yaw = y;
    S.camRig.pitch += (THREE.MathUtils.clamp(Math.asin(b.aimDir.y), -0.7, 0.4) - S.camRig.pitch) * Math.min(1, dt * 8);
    return inp;
  }

  _placeAtSlot(p) {
    const s = this.spawnFor(p);
    p.spawn(_v.fromArray(s.pos), s.yaw);
    if (p.isPlayer) this.session.setCheckpoint(_v, s.yaw);
  }

  /** Spawn point for a team member: {pos:[x,y,z], yaw}. */
  spawnFor(p) {
    const slots = this.slots[p.team];
    const i = this.slotOf?.get(p) ?? 0;
    return { pos: slots[i % slots.length], yaw: this.yaw[p.team] };
  }

  basePos(team) { return this.base[team]; }
  teamOf(team) { return this.teams[team] || []; }

  isRevealed(a) { return (this.reveal.get(a) || 0) > this.session.time; }

  respawnPoint() {
    const s = this.spawnFor(this.session.player);
    return { pos: new THREE.Vector3().fromArray(s.pos), yaw: s.yaw };
  }

  /** HUD roster [{alive, color}] — persistent arrays, updated in place (no per-frame garbage). */
  _roster(team) {
    const list = this.teamOf(team);
    const r = this._rosters || (this._rosters = {});
    let out = r[team];
    if (!out || out.length !== list.length) out = r[team] = list.map(() => ({ alive: true, color: '' }));
    const color = team === TEAM_HERO ? this.css.a : this.css.b;
    for (let i = 0; i < list.length; i++) { out[i].alive = list[i].alive; out[i].color = color; }
    return out;
  }

  /** Small team-colour arrows over teammates' heads (always visible, genre-style). */
  _buildAllyMarkers() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.beginPath(); x.moveTo(8, 12); x.lineTo(56, 12); x.lineTo(32, 52); x.closePath(); x.fill();
    x.fillStyle = this.css.a;
    x.beginPath(); x.moveTo(16, 17); x.lineTo(48, 17); x.lineTo(32, 43); x.closePath(); x.fill();
    this.markerTex = new THREE.CanvasTexture(c);
    this.markerTex.colorSpace = THREE.SRGBColorSpace;
    this.markers = [];
    for (const p of this.teamOf(TEAM_HERO)) {
      if (p === this.session.player) continue;
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.markerTex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
      m.scale.set(0.42, 0.42, 1);
      m.renderOrder = 8;
      this.session.scene.add(m);
      this.markers.push({ m, p });
    }
  }

  _updateAllyMarkers() {
    const show = this.phase === 'play' || this.phase === 'ready';
    for (const { m, p } of this.markers || []) {
      m.visible = show && p.alive && !p.flying;
      if (m.visible) m.position.set(p.position.x, p.position.y + (p.form === 'squid' ? 1.1 : 2.05), p.position.z);
    }
  }

  _spawnBots() {
    const S = this.session;
    const names = shuffle([...BOT_NAMES]);
    const kitIds = Object.keys(KITS);
    // varied kits per team: prefer distinct main classes that are actually registered
    const pickKits = (n, avoid) => {
      const pool = shuffle(kitIds.filter((k) => MAINS[KITS[k].main]));
      const out = [];
      const used = new Set(avoid);
      for (const k of pool) { if (out.length >= n) break; if (!used.has(KITS[k].main)) { out.push(k); used.add(KITS[k].main); } }
      while (out.length < n) out.push(pool[out.length % Math.max(1, pool.length)] || 'splash-blaster');
      return out;
    };
    const allyKits = pickKits(3, [KITS[S.player.kitId]?.main]);
    const rivalKits = pickKits(4, []);
    const allyLanes = shuffle([-12, 0, 12]);
    const rivalLanes = shuffle([-12, -4, 4, 12]);
    let ni = 0;
    const make = (team, kit, slot, lane) => {
      const bot = new TurfBot(S, this, {
        team, kit, name: names[ni++ % names.length], look: botLook(), difficulty: this.difficulty,
        spawn: { pos: this.slots[team][slot], yaw: this.yaw[team] }, lane: lane * (team === TEAM_HERO ? 1 : -1),
      });
      this.slotOf.set(bot.player, slot);
      S.addEntity(bot);
      this.bots.push(bot);
      return bot;
    };
    [0, 2, 3].forEach((slot, i) => make(TEAM_HERO, allyKits[i], slot, allyLanes[i]));
    [0, 1, 2, 3].forEach((slot, i) => make(TEAM_MURK, rivalKits[i], slot, rivalLanes[i]));
  }

  /** Paintable, reachable floor faces (not base) with an area CDF for target sampling. */
  _buildPaintFaces() {
    const nav = this.nav, faces = [];
    let acc = 0;
    for (const f of this.session.ink.faces) {
      if (!f.paintable || !f.isFloor || f.tag === 'turf-base' || f.area < 0.5) continue;
      f.point(f.lenU / 2, f.lenV / 2, _v);
      const n = nav.nearest(_v, Math.max(3, Math.hypot(f.lenU, f.lenV) / 2 + 1));
      if (n < 0) continue;
      acc += f.area;
      faces.push({ f, cdf: acc });
    }
    this.paintFaces = faces;
    this.paintArea = acc;
  }

  /** Random point on a paintable floor (area weighted). Writes the point into out; returns {face}. */
  samplePaintPoint(out) {
    const list = this.paintFaces;
    if (!list.length) return null;
    const r = Math.random() * this.paintArea;
    let lo = 0, hi = list.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].cdf < r) lo = m + 1; else hi = m; }
    const f = list[lo].f;
    for (let k = 0; k < 4; k++) {
      const u = Math.random() * f.lenU, v = Math.random() * f.lenV;
      if (f.inside) {
        const i = Math.min(f.cu - 1, Math.floor(u / f.cw)), j = Math.min(f.cv - 1, Math.floor(v / f.ch));
        if (!f.inside[j * f.cu + i]) continue;
      }
      f.point(u, v, out);
      return { face: f };
    }
    return null;
  }

  // =============================================================================================
  _setPhase(p) { this.phase = p; this.phaseT = 0; }

  _prepIntro() {
    const S = this.session, b = S.level.bounds;
    const hx = (b.max.x - b.min.x) / 2, hz = (b.max.z - b.min.z) / 2;
    const cx = (b.max.x + b.min.x) / 2, cz = (b.max.z + b.min.z) / 2;
    // final pose = the gameplay camera behind the player
    S.camRig.snap(S.player);
    const endPos = S.camera.position.clone();
    const endTgt = endPos.clone().addScaledVector(S.camRig.forward, 12);
    const A = this.base[TEAM_HERO];
    this.introPts = [
      new THREE.Vector3(cx + hx * 0.95, 21, cz + hz * 1.15),
      new THREE.Vector3(cx + hx * 0.2, 27, cz + hz * 0.85),
      new THREE.Vector3(cx - hx * 0.55, 14, cz + hz * 0.55),
      new THREE.Vector3(A.x - 9, A.y + 6, A.z + 5),
      endPos,
    ];
    this.introTgts = [
      new THREE.Vector3(cx + hx * 0.3, 0, cz),
      new THREE.Vector3(cx, 0, cz),
      new THREE.Vector3(cx - hx * 0.4, 0, cz),
      new THREE.Vector3(A.x + 6, A.y, A.z),
      endTgt,
    ];
    this.introCurve = new THREE.CatmullRomCurve3(this.introPts, false, 'centripetal');
    this.camOverride = { position: this.introPts[0].clone(), target: this.introTgts[0].clone() };
    S.camRig.override = this.camOverride;
  }

  _go() {
    const S = this.session;
    this.live = true;
    this.botsActive = true;
    for (const p of this.allPlayers) p.frozen = false;
    this.overlay.big('GO!', 'go', 1.0);
    S.audio?.sfx('go', { volume: 0.9 });
    S.hud.hint?.('Hold {map} for the map · {swim} swim · {fire} ink', 4);
    this._setPhase('play');
  }

  _finish() {
    const S = this.session;
    this.live = false;
    this.botsActive = false;
    this.timeLeft = 0;
    this.map.setOpen(false);
    this.jumps.dispose();
    for (const p of this.allPlayers) {
      p.kit.main.cancel?.();
      p.kit.special?.end?.();
      p.frozen = true;
      p.velocity.set(0, Math.min(0, p.velocity.y), 0);
      // the splatted come back quietly at their base: no drop-in splash / spawn ink / SFX over the
      // judging, and no lingering "dead" vignette on the player's screen
      if (!p.alive) {
        const s = this.spawnFor(p);
        p.spawn(_v.fromArray(s.pos), s.yaw);
        p.invulnerable = 0;
        if (p === S.player) { S.camRig.snap(p); S.hud.clearScreenInk?.(); }
      }
    }
    S.projectiles.clear();
    this.result = this._score();
    S.audio?.sfx('whistle', { volume: 1 });
    S.audio?.stopMusic?.(1.2);
    this.overlay.big('FINISH!', 'finish', FINISH);
    S.hud.turf(0, this._roster(TEAM_HERO), this._roster(TEAM_MURK));
    S.allowPause = false;
    this._setPhase('finish');
  }

  _score() {
    const cov = this.session.ink.coverage((f) => f.tag !== 'turf-base');
    const painted = cov.a + cov.b;
    const pctA = painted > 0 ? (cov.a / painted) * 100 : 50;
    return { a: cov.a, b: cov.b, total: cov.total, pctA, pctB: 100 - pctA, win: cov.a > cov.b, draw: cov.a === cov.b, ofArenaA: (cov.a / Math.max(1, cov.total)) * 100, ofArenaB: (cov.b / Math.max(1, cov.total)) * 100 };
  }

  _onDefeat(e) {
    const S = this.session;
    const a = e.actor, by = e.by;
    const sa = this.stats.get(a);
    if (!sa || !this.live) return;
    sa.deaths++;
    const sb = by ? this.stats.get(by) : null;
    if (sb && by.team !== a.team) sb.splats++;
    if (a === S.player) S.hud.toast(sb ? `Splatted by ${by.name}!` : 'Splatted!', 'normal');
    else if (by === S.player) S.hud.toast(`You splatted ${a.name}!`, 'normal');
  }

  onBotRespawn(bot) {
    // after a respawn some bots super jump straight back to a teammate at the front
    const D = bot.brain.D;
    if (!this.live || Math.random() >= (D.superJump || 0)) return;
    const mates = this.teamOf(bot.player.team).filter((m) => m !== bot.player && m.alive && !m.flying && !this.jumps.isJumping(m) && Math.abs(m.position.x - this.base[m.team].x) > 14);
    if (!mates.length) return;
    const m = mates[Math.floor(Math.random() * mates.length)];
    if (this.jumps.start(bot.player, { actor: m })) bot.brain.debug.superJumps++;
  }

  onSuperJumpLanded(a) {
    if (a.bot) { a.bot.brain.reset(); a.bot.brain.state = 'paint'; }
    else if (a === this.session.player && this.auto) this.auto.brain.reset();
  }

  // =============================================================================================
  latchInput(session, input) {
    const P = session.player;
    const canMap = this.phase === 'play' && P.alive;
    this.mapHeld = canMap && input.isDown('map');
    if (this.map?.open) {
      const nav = input.navPressed?.();
      if (nav) this.map.moveSel(nav === 'left' || nav === 'up' ? -1 : 1);
      if (input.justPressed('interact') || input.justPressed('jump')) this._superJumpPlayer();
      // the map owns the controls while it is open
      P.jumpBuffer = 0; P.subBuffer = 0; P.specialBuffer = 0; P.firePressed = false;
      input.look.x = 0; input.look.y = 0;
    }
  }

  _superJumpPlayer() {
    const S = this.session, P = S.player;
    const sel = this.map.selected();
    if (!sel || this.jumps.isJumping(P)) { S.audio?.sfx('error', { volume: 0.4 }); return; }
    const ok = sel.kind === 'base'
      ? this.jumps.start(P, { pos: _w.copy(this.respawnPoint().pos) })
      : this.jumps.start(P, { actor: sel.actor });
    if (ok) this.map.setOpen(false);
  }

  step(session, dt) {
    const S = session;
    this.phaseT += dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT >= INTRO) {
          S.camRig.override = null;
          S.camRig.snap(S.player);
          this.overlay.hideTitle();
          this.overlay.big('READY?', 'ready', READY_GO);
          S.audio?.sfx('count', { volume: 0.8 });
          S.hud.show(true);
          this._setPhase('ready');
        }
        break;
      case 'ready':
        if (this.phaseT >= READY_GO) this._go();
        break;
      case 'play': {
        const before = this.timeLeft;
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (before > 60 && this.timeLeft <= 60) {
          this.overlay.big('1 MINUTE LEFT!', 'warn', 2.2);
          S.hud.toast('1 MINUTE LEFT!', 'big');
          S.audio?.sfx('alert', { volume: 0.8 });
          S.audio?.playMusic?.('turf-final', { intensity: 1 });
          S.audio?.music?.setIntensity?.(1);
        }
        const cBefore = Math.ceil(before), cNow = Math.ceil(this.timeLeft);
        if (cNow !== cBefore && cNow <= 10 && cNow >= 1) {
          this.overlay.count(cNow);
          S.audio?.sfx('count', { volume: cNow <= 3 ? 0.9 : 0.6 });
        }
        if (this.timeLeft <= 0) this._finish();
        break;
      }
      case 'finish':
        if (this.phaseT >= FINISH) this._startOverhead();
        break;
      case 'overhead':
        if (this.phaseT >= OVERHEAD) {
          this._setPhase('judges');
          this.judges.group.visible = true;
          this.overlay.caption('');
          this.judges.drumroll();
          S.audio?.sfx('turf_drumroll', { volume: 0.9, dur: JUDGE_DRUM });
        }
        break;
      case 'judges':
        if (!this._revealed && this.phaseT >= JUDGE_DRUM) {
          this._revealed = true;
          const r = this.result;
          const color = r.win ? this.colors.a : this.colors.b;
          this.judges.reveal(color);
          S.audio?.sfx('turf_reveal', { volume: 0.9 });
          this.overlay.big(r.win ? 'ALPHA WINS!' : 'BRAVO WINS!', r.win ? 'win-a' : 'win-b', 0);
          for (const p of this.allPlayers) p.model?.emote?.(p.team === (r.win ? TEAM_HERO : TEAM_MURK) ? 'cheer' : 'sad', 6);
        }
        if (this.phaseT >= JUDGE_END && !this._resultsShown) this._showResults();
        break;
      default:
        break;
    }

    if (this.live) {
      this.jumps.step(dt);
      this.barriers.step(dt, this.allPlayers);
      this.revealT -= dt;
      if (this.revealT <= 0) { this.revealT = 0.25; this._updateReveal(); }
    }
  }

  _updateReveal() {
    const S = this.session, level = S.level;
    const heroes = this.teamOf(TEAM_HERO);
    for (const r of this.teamOf(TEAM_MURK)) {
      if (!r.alive) continue;
      if (r.submerged && Math.hypot(r.velocity.x, r.velocity.z) < 5) continue;
      r.hitCenter(_hc);
      for (const h of heroes) {
        if (!h.alive) continue;
        const d = h.position.distanceTo(r.position);
        if (d > 26) continue;
        _v.copy(h.position).setY(h.position.y + 1.1);
        if (level.lineOfSight(_v, _hc)) { this.reveal.set(r, S.time + 0.6); break; }
      }
    }
  }

  _startOverhead() {
    const S = this.session, b = S.level.bounds;
    const cx = (b.max.x + b.min.x) / 2, cz = (b.max.z + b.min.z) / 2;
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z;
    const aspect = S.camera.aspect || 16 / 9;
    const tanV = Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2));
    const hNeed = Math.max((w * 0.54) / (tanV * aspect), (d * 0.6) / tanV);
    this.ovFrom = { position: S.camera.position.clone(), target: S.camera.position.clone().addScaledVector(S.camRig.forward, 10) };
    this.ovTo = { position: new THREE.Vector3(cx, hNeed, cz + hNeed * 0.22), target: new THREE.Vector3(cx, 0, cz + 0.6) };
    this.camOverride = { position: this.ovFrom.position.clone(), target: this.ovFrom.target.clone() };
    S.camRig.override = this.camOverride;
    S.hud.show(false);
    this.judges.group.visible = false;      // the booth canopy would sit in the middle of the shot
    this.overlay.caption('JUDGING…', 'judging');
    S.audio?.sfx('whoosh', { volume: 0.6 });
    this._setPhase('overhead');
  }

  _showResults() {
    this._resultsShown = true;
    const S = this.session, r = this.result;
    const P = S.player;
    const win = r.win;
    const pearls = win ? 20 : 8;
    // save
    const d = save.data;
    d.turf = { played: 0, wins: 0, losses: 0, bestPct: 0, ...(d.turf || {}) };
    d.turf.played++;
    if (win) d.turf.wins++; else d.turf.losses++;
    d.turf.bestPct = Math.max(d.turf.bestPct || 0, Math.round(r.pctA * 10) / 10);
    const me = this.stats.get(P);
    d.stats = { inkedM2: 0, splats: 0, splatted: 0, playSeconds: 0, ...(d.stats || {}) };
    d.stats.inkedM2 += Math.round(me?.inked || 0);
    d.stats.splats += me?.splats || 0;
    d.stats.splatted += me?.deaths || 0;
    d.stats.playSeconds += Math.round(this.opts.time ?? MATCH_TIME);
    save.addPearls(pearls);   // also saves
    this.overlay.big('', 'ready', 0.01);
    const players = this.allPlayers.map((p) => ({ ...this.stats.get(p) }));
    players.sort((x, y) => (x.team - y.team) || (y.isPlayer - x.isPlayer) || (y.inked - x.inked));
    this.resultScreen = new TurfResultsScreen(this.app, {
      arenaName: S.level.def.name || 'Turf Clash', stageId: this.stageId || S.level.def.id,
      colors: this.colors, pctA: r.pctA, pctB: r.pctB, win, draw: r.draw, pearls, players,
      record: { wins: d.turf.wins, losses: d.turf.losses }, opts: { difficulty: this.difficulty, kit: P.kitId },
    });
    this.app.ui.push(this.resultScreen);
  }

  // =============================================================================================
  update(session, dt) {
    const S = session;
    // cameras
    if (this.phase === 'intro' && this.introCurve) {
      const k = Math.min(1, this.phaseT / INTRO);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.introCurve.getPointAt(e, this.camOverride.position);
      const n = this.introTgts.length - 1;
      const f = e * n, i = Math.min(n - 1, Math.floor(f));
      this.camOverride.target.lerpVectors(this.introTgts[i], this.introTgts[i + 1], f - i);
    } else if (this.phase === 'overhead' && this.ovTo) {
      const k = Math.min(1, this.phaseT / (OVERHEAD * 0.7));
      const e = 1 - Math.pow(1 - k, 3);
      this.camOverride.position.lerpVectors(this.ovFrom.position, this.ovTo.position, e);
      this.camOverride.target.lerpVectors(this.ovFrom.target, this.ovTo.target, e);
    } else if (this.phase === 'judges') {
      if (!this._judgeCam) {
        this._judgeCam = true;
        this.camOverride = { position: this.judges.cameraPos(new THREE.Vector3()), target: this.judges.focus(new THREE.Vector3()) };
        this._judgeCam0 = this.camOverride.position.clone();
        S.camRig.override = this.camOverride;
      }
      // slow push-in
      const k = Math.min(1, this.phaseT / JUDGE_END);
      this.camOverride.position.copy(this._judgeCam0).lerp(this.camOverride.target, k * 0.25);
    }
    // HUD scoreboard: only touch the DOM when the shown second or someone's alive state changes
    if (this.phase === 'play' || this.phase === 'ready') {
      // whole seconds rounded up: 3:00 at GO, 0:01 in the last second (matches the 10…1 countdown)
      const sec = Math.ceil(this.timeLeft);
      let mask = 0;
      for (let i = 0; i < this.allPlayers.length; i++) if (this.allPlayers[i].alive) mask |= 1 << i;
      if (sec !== this._hudSec || mask !== this._hudMask) {
        this._hudSec = sec; this._hudMask = mask;
        S.hud.turf(sec, this._roster(TEAM_HERO), this._roster(TEAM_MURK));
      }
    }
    // map
    this.map.setOpen(this.mapHeld && this.phase === 'play' && S.player.alive && !this.jumps.isJumping(S.player));
    this.map.update(dt);
    this.jumps.render(dt);
    this.judges.update(dt);
    this.barriers.render(dt);
    this._updateAllyMarkers();
  }

  // =============================================================================================
  /** Test/diagnostic snapshot. */
  debugState() {
    const cov = this.session.ink.coverage((f) => f.tag !== 'turf-base');
    return {
      phase: this.phase, timeLeft: +this.timeLeft.toFixed(2), coverage: { a: Math.round(cov.a), b: Math.round(cov.b), total: Math.round(cov.total) },
      nav: this.nav.stats,
      players: this.allPlayers.map((p) => {
        const st = this.stats.get(p), br = p.bot?.brain;
        return {
          name: p.name, team: p.team, kit: p.kitId, alive: p.alive, pos: [+p.position.x.toFixed(1), +p.position.y.toFixed(1), +p.position.z.toFixed(1)],
          inked: Math.round(st.inked), splats: st.splats, deaths: st.deaths, specials: st.specials,
          state: br?.state, travelled: br ? Math.round(br.travelled) : undefined, dbg: br?.debug,
        };
      }),
    };
  }

  dispose(session) {
    for (const off of this.offs) { try { off(); } catch { /* */ } }
    this.offs.length = 0;
    this.map?.dispose();
    this.overlay?.dispose();
    this.jumps?.dispose();
    this.judges?.dispose();
    this.barriers?.dispose();
    this.nav?.dispose();
    for (const { m } of this.markers || []) { m.parent?.remove(m); m.material.dispose(); }
    this.markerTex?.dispose();
    if (session?.camRig) session.camRig.override = null;
    document.documentElement.style.removeProperty('--turf-a');
    document.documentElement.style.removeProperty('--turf-b');
    this.session = null;
  }
}

