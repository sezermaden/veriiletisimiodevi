/* Propworks — entry point and game orchestration.

   Frame contract (see docs): input.update -> EDGE reads latched once per frame -> fixed-step
   player + world simulation -> interpolated render -> input.endFrame. Edge input is never
   read inside a fixed step: at 60 Hz a frame lands just under the step about half the time
   and runs zero steps, which would silently eat those presses. */
import * as THREE from 'three';
import { Renderer } from './render/renderer.js';
import { buildTextures, TEX } from './render/textures.js';
import { FX } from './render/fx.js';
import { initPhysics, Physics, FIXED, GROUPS } from './physics/physics.js';
import { Entities } from './world/entities.js';
import { NPCs, NPC_TYPES } from './world/npc.js';
import { Level } from './world/level.js';
import { Vehicle } from './world/vehicle.js';
import { spawnPickup, spawnWeaponPickup, Undo } from './world/pickups.js';
import { PROPS, propTemplate } from './world/props.js';
import { Player } from './player/player.js';
import { WeaponManager } from './weapons/weapons.js';
import { PhysGun } from './weapons/physgun.js';
import { GravGun } from './weapons/gravgun.js';
import { ToolGun } from './weapons/toolgun.js';
import { createBalloon } from './weapons/attachments.js';
import { contraption } from './physics/constraints.js';
import { Controls, PAD } from './core/controls.js';
import { settings, saveSettings, progress, saveProgress } from './core/settings.js';
import { Audio } from './core/audio.js';
import { music } from './core/music.js';
import { stopSpeech } from './core/voice.js';
import { UI } from './ui/ui.js';
import { HUD } from './ui/hud.js';
import { h, focusable } from './ui/focus.js';
import { SpawnMenu } from './ui/spawnmenu.js';
import { mainMenu, pauseMenu, deathScreen, terminalOverlay, creditsScreen } from './ui/screens.js';
import { MAPS } from './maps/index.js';
import { StoryRunner } from './story/runner.js';
import { CHAPTERS, SANDBOX_MAPS } from './story/meta.js';

const SNAP = 0.0015;
const _v = new THREE.Vector3();

class Game {
  constructor() {
    this.canvas = document.getElementById('viewport');
    this.state = 'boot';
    this.mode = 'menu';
    this.frames = 0;
    this.time = 0;
    this.prePhysics = [];
    this.vehicles = [];
    this.constraints = new Set();
    this.aiEnabled = true;
    this.inputEnabled = true;
    this.progress = progress.stats;
    this.textures = TEX;
    this._acc = 0;
    this.useTarget = null;
    this._stepFn = () => this._worldStep();
  }

  async boot() {
    const bootFill = document.getElementById('boot-fill');
    const bootStatus = document.getElementById('boot-status');
    let pct = 5;
    const report = (t) => { pct = Math.min(90, pct + 9); bootFill.style.width = pct + '%'; bootStatus.textContent = t + '…'; };
    this.renderer = new Renderer(this.canvas);
    await buildTextures(report);
    report('Starting the physics engine');
    await initPhysics();
    report('Wiring controls');
    this.input = new Controls(this.canvas, { deadzone: settings.deadzone });
    this.input.importBindings(settings.bindings);
    this.fx = new FX(this.renderer.scene, this.renderer);
    this.fx.groundProbe = (p) => { const hit = this.physics?.raycast({ x: p.x, y: p.y + 0.2, z: p.z }, { x: 0, y: -1, z: 0 }, 40, { groups: GROUPS.debris }); return hit ? hit.point.y : p.y - 40; };
    this.ui = new UI(this);
    this.hud = new HUD(this);
    this.spawnmenu = new SpawnMenu(this);
    const unlock = () => { Audio.unlock(); music.setMood(this.mode === 'menu' ? 'menu' : this.musicMood || 'calm'); };
    for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, unlock);
    addEventListener('gamepadconnected', unlock);
    this.canvas.addEventListener('click', () => { if (this.state === 'playing' && !this.ui.overlays.length) this.requestLock(); });
    document.addEventListener('pointerlockchange', () => {
      // Losing the lock while playing (Esc in a browser) pauses, like every PC shooter.
      if (!document.pointerLockElement && this.state === 'playing' && !this.ui.overlays.length && !this._ignoreUnlock) this.pause();
    });
    addEventListener('blur', () => { if (this.state === 'playing' && !this.ui.overlays.length) this.pause(); });
    report('Building the Workshop');
    await this.loadMap('foundry', 'menu');
    bootFill.style.width = '100%';
    document.getElementById('boot').classList.add('hidden');
    this.toMainMenu(true);
    this._last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    window.__game = this;
  }

  /* ================================================================== maps */
  teardown() {
    this.story?.stop();
    this.story = null;
    stopSpeech();
    Audio.stopAllLoops();
    this.hud?.reset();
    this.spawnmenu?.toggle(false);
    this.weapons?.stripAll();
    this.entities?.clear();
    this.npcs?.clear();
    for (const c of [...this.constraints]) c.remove();
    this.constraints.clear();
    for (const v of [...this.vehicles]) v._dispose?.();
    this.vehicles = [];
    this.player?.dispose();
    this.level?.dispose();
    this.physics?.dispose();
    this.fx?.clear();
    this.prePhysics = [];
    this.physgun = null; this.toolgun = null;
    this.onExplosion = null;
    this.cutscene = null;
  }

  async loadMap(id, mode, opts = {}) {
    this.teardown();
    const build = MAPS[id];
    if (!build) throw new Error('Unknown map ' + id);
    this.mapId = id;
    this.mapName = SANDBOX_MAPS.find((m) => m.id === id)?.name || id;
    this.mode = mode;
    this.physics = new Physics();
    this.physics.onImpact = (a, b, dv, ca, cb) => this.onImpact(a, b, dv, ca, cb);
    this.entities = new Entities(this);
    this.npcs = new NPCs(this);
    this.undo = new Undo(this);
    this.player = new Player(this);
    this.player.reset(true);
    if (!this.weapons) this.weapons = new WeaponManager(this);
    this.weapons.register('physgun', (g) => new PhysGun(g));
    this.weapons.register('gravgun', (g) => new GravGun(g));
    this.weapons.register('toolgun', (g) => new ToolGun(g));
    this.level = new Level(this, { name: id });
    const env = build(this.level, this, { mode, ...opts }) || {};
    this.renderer.setEnvironment(env);
    Audio.setReverb(env.reverb ?? 0.25);
    this.level.finalize();
    this.env = env;
    const sp = opts.spawn || this.level.spawns[0] || { pos: new THREE.Vector3(0, 1, 0), yaw: 0 };
    this.player.spawn(sp.pos, sp.yaw ?? 0);
    this.renderer.fx = this.fx;
    this.fx.setDensity(this.renderer.q.particles);
    // warm up: settle props before the first rendered frame
    for (let i = 0; i < 30; i++) this._worldStep();
    if (mode === 'sandbox') {
      for (const w of ['physgun', 'toolgun', 'gravgun', 'crowbar', 'pistol', 'smg', 'shotgun', 'grenade']) this.weapons.give(w, { silent: true });
      this.weapons.ammo = { pistol: 150, smg: 225, buckshot: 32, grenade: 5 };
      this.weapons.select('physgun', true);
      this.player.armor = 50;
    }
    this.musicMood = env.music || 'calm';
    if (mode !== 'menu') music.setMood(this.musicMood);
    return env;
  }

  /* ================================================================== flow */
  toMainMenu(first = false) {
    this.state = 'menu';
    document.exitPointerLock?.();
    document.body.classList.remove('playing');
    this.hud.show(false);
    const go = async () => {
      if (!first && (this.mode !== 'menu' || this.mapId !== 'foundry')) {
        this.ui.clear();
        await this.loadMap('foundry', 'menu');
      }
      this.state = 'menu';
      this.ui.show(mainMenu(this));
      music.setMood('menu');
    };
    go();
  }

  async startSandbox(id) {
    this.ui.clear();
    this._loadingScreen('Loading ' + (SANDBOX_MAPS.find((m) => m.id === id)?.name || id));
    await nextFrame();
    await this.loadMap(id, 'sandbox');
    this._hideLoading();
    this.chapterId = null;
    this.beginPlay();
    this.hud.hint(`${this.hud.key('spawnmenu')} opens the spawn menu. ${this.hud.key('primary')} with the Physics Gun grabs things.`, 8, 'sb1');
  }

  async startChapter(id, checkpoint = null) {
    const ch = CHAPTERS.find((c) => c.id === id);
    if (!ch) return;
    this.ui.clear();
    this._loadingScreen(ch.num + ' — ' + ch.title);
    await nextFrame();
    this.chapterId = id;
    await this.loadMap(ch.map, 'story', { chapter: id, checkpoint });
    this._hideLoading();
    progress.current = { chapter: id, checkpoint };
    saveProgress();
    this.story = new StoryRunner(this, id, checkpoint);
    this.beginPlay();
    this.story.start();
  }

  continueStory() {
    const c = progress.current;
    if (!c) return;
    this.startChapter(c.chapter, c.checkpoint);
  }

  restartCheckpoint() { this.startChapter(this.chapterId, progress.current?.checkpoint || null); }

  checkpoint(name) {
    if (this.mode !== 'story') return;
    progress.current = { chapter: this.chapterId, checkpoint: name };
    saveProgress();
    this.hud.centerMessage('Checkpoint');
    Audio.play('checkpoint');
  }

  completeChapter(id) {
    const i = CHAPTERS.findIndex((c) => c.id === id);
    if (!progress.completed.includes(id)) progress.completed.push(id);
    progress.chapter = Math.max(progress.chapter, Math.min(CHAPTERS.length - 1, i + 1));
    if (i === CHAPTERS.length - 1) { progress.finishedStory = true; progress.current = null; }
    else progress.current = { chapter: CHAPTERS[i + 1].id, checkpoint: null };
    saveProgress();
  }

  beginPlay() {
    this.state = 'playing';
    this.hud.show(true);
    document.body.classList.add('playing');
    this.requestLock();
  }

  requestLock() {
    if (this.input.pointerLocked) return;
    try { this.input.enablePointerLock(); } catch { /* not allowed without gesture */ }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.spawnmenu.toggle(false);
    this.closeContext();
    this._ignoreUnlock = true;
    document.exitPointerLock?.();
    setTimeout(() => { this._ignoreUnlock = false; }, 100);
    document.body.classList.remove('playing');
    Audio.suspendSfx(true);
    window.speechSynthesis?.pause?.();
    this.ui.show(pauseMenu(this));
  }

  resume() {
    this.ui.clear();
    this.state = 'playing';
    Audio.suspendSfx(false);
    window.speechSynthesis?.resume?.();
    document.body.classList.add('playing');
    this.input.releaseAll();
    this.requestLock();
  }

  onPlayerDeath(info) {
    progress.stats.deaths++;
    this.state = 'dead';
    this.spawnmenu.toggle(false);
    this.closeContext();
    document.exitPointerLock?.();
    document.body.classList.remove('playing');
    const cause = { fall: 'You fell too far.', melee: 'The corruption caught you.', energy: 'Hit by corrupted energy.', explosion: 'Caught in an explosion.', crush: 'Crushed.' }[info?.type] || '';
    setTimeout(() => { if (this.state === 'dead') this.ui.show(deathScreen(this, cause)); }, 1400);
  }

  respawn() {
    this.ui.clear();
    if (this.mode === 'story') { this.restartCheckpoint(); return; }
    const sp = this.level.spawns[0];
    this.player.reset(true);
    this.player.spawn(sp.pos, sp.yaw);
    this.player.armor = 50;
    this.beginPlay();
  }

  cleanup() {
    for (const c of [...this.constraints]) if (c.a.owner === 'player' || c.b?.owner === 'player') c.remove();
    this.entities.removeOwned('player');
    for (const n of [...this.npcs.list]) if (n.spawnedByPlayer) n.remove();
    this.npcs.list = this.npcs.list.filter((n) => n.alive);
    this.undo.clear();
    this.hud.notify('Cleaned up the map');
    Audio.play('remove');
  }

  _loadingScreen(text) {
    const el = h('div.screen.dim.center', { style: { justifyContent: 'center', alignItems: 'center', background: '#0b0d12' } }, h('div.logo', {}, h('span.logo-a', { text: 'PROP' }), h('span.logo-b', { text: 'WORKS' })), h('h2', { text, style: { marginTop: '3vh' } }), h('div.boot-status', { text: TIPS[Math.floor(Math.random() * TIPS.length)], style: { maxWidth: '60vw', textAlign: 'center' } }));
    this._loadingEl = el;
    document.getElementById('screens').append(el);
  }
  _hideLoading() { this._loadingEl?.remove(); this._loadingEl = null; }

  /* ================================================================== frame */
  frame(t) {
    const dt = Math.max(0, Math.min(0.05, (t - this._last) / 1000));   // a hitch must not teleport anyone; rAF can report a time before boot
    this._last = t;
    // schedule first: one bad frame must never stop the game loop
    requestAnimationFrame((tt) => this.frame(tt));
    if (!this.manual) {
      try { this.tick(dt); }
      catch (e) { if (!this._errLogged || this._errLogged < 5) { console.error('frame error', e); this._errLogged = (this._errLogged || 0) + 1; } }
    }
  }

  /** One frame of the game at a given dt. Tests call this directly with `manual` set. */
  tick(dt, render = true) {
    this.time += dt;
    this.frames++;
    const input = this.input;
    input.update(dt);
    this.ui.update(dt);

    const playing = this.state === 'playing';
    const overlay = this.ui.overlays.length > 0;
    this.inputEnabled = playing && !overlay;
    if (playing) this._edges(input, dt, overlay);

    if (playing || this.mode === 'menu' || this.state === 'dead' || this.state === 'cutscene') {
      this.weapons.update(input, dt, this.inputEnabled && !this.player.vehicle && this.player.alive && !this.cutscene);
      const drivePlayer = playing && !this.player.vehicle && !this.cutscene && this.player.alive;
      if (drivePlayer) {
        // player and world advance in lockstep from the player's accumulator
        this.player.update(overlay ? FROZEN_INPUT : input, dt, this._stepFn);
        this._acc = this.player._acc;
      } else {
        this._acc += dt;
        let steps = 0;
        while (this._acc + SNAP >= FIXED && steps < 5) {
          this._worldStep();
          this._acc = Math.max(0, this._acc - FIXED);
          steps++;
        }
        if (steps === 5) this._acc = 0;
        this.player._acc = 0;
      }
      this.level.update(dt, this.time);
      this.story?.update(dt);
    }

    const alpha = Math.min(1, this._acc / FIXED);
    if (this.mode === 'menu') this._menuCamera(dt);
    else if (this.cutscene) this.cutscene.update(dt);
    else this.player.updateCamera(alpha, dt);
    for (const v of this.vehicles) v.update(dt);
    this.entities.render(alpha, dt);
    this.npcs.render(alpha, dt);
    for (const c of this.constraints) c.update();
    this.level.render();
    this.fx.update(dt, this.renderer.camera);
    if (this.mode !== 'menu') { this._updateUse(); this.hud.update(dt); }
    const cam = this.renderer.camera;
    Audio.setListener(cam.position, cam.getWorldDirection(_v), cam.up);
    this.renderer.vmScene.visible = this.mode !== 'menu' && !this.player.vehicle && this.player.alive && !this.cutscene;
    if (render) this.renderer.render(dt, this.player.pos);
    else this.renderer.camera.updateMatrixWorld();
    input.endFrame();
    if (playing) progress.stats.playSeconds += dt;
  }

  /** All edge-triggered gameplay input, read exactly once per frame. */
  _edges(input, dt, overlay) {
    const p = this.player;
    // spawn menu: Q toggles (hold-and-release closes, like the classic), View tap toggles
    if (input.justPressed('spawnmenu') || input.viewTap) {
      if (this.contextEl) this.closeContext();
      this._qTime = this.time;
      this.spawnmenu.toggle();
    } else if (this.spawnmenu.open && !input.isDown('spawnmenu') && this._qTime && this.time - this._qTime > 0.45 && input.lastDevice !== 'gamepad' && this._qHeld) {
      this.spawnmenu.toggle(false);
    }
    this._qHeld = input.isDown('spawnmenu');
    if (input.viewHold) this.undo.undo();
    if (overlay) {
      if (input.justPressed('context') && this.contextEl) this.closeContext();
      return;
    }
    if (input.justPressed('pause')) { this.pause(); return; }
    if (!p.alive) return;

    if (input.justPressed('jump') && !p.legacyEdgeInStep) p.jumpBuffer = 0.14;
    if (settings.toggleCrouch && input.justPressed('crouch')) p.crouchToggle = !p.crouchToggle;
    if (input.justPressed('undo')) this.undo.undo();
    if (input.justPressed('noclip') && this.canNoclip()) p.setNoclip(!p.noclip);
    if (input.justPressed('flashlight')) { if (p.vehicle) p.vehicle.toggleLights(); else p.toggleFlashlight(); }
    if (input.justPressed('context')) { this.openContext(); return; }
    if (input.justPressed('use')) {
      if (p.vehicle) p.vehicle.exit();
      else if (this.useTarget && !this.physgun?.held) this.useTarget.use();
    }
    if (!p.vehicle && !this.physgun?.rotating) {
      for (let s = 1; s <= 6; s++) if (input.justPressed('slot' + s)) this.weapons.selectSlot(s);
      if (input.justPressed('nextWeapon')) this.weapons.cycle(1);
      if (input.justPressed('prevWeapon')) this.weapons.cycle(-1);
      if (input.wheel && !(this.weapons.current?.id === 'physgun' && this.physgun?.held)) this.weapons.cycle(input.wheel > 0 ? -1 : 1);
    }
  }

  _worldStep() {
    for (const f of this.prePhysics) f(FIXED);
    this.entities.prePhysics(FIXED);
    if (this.aiEnabled && this.mode !== 'menu') this.npcs.step(FIXED);
    else if (this.mode !== 'menu') for (const n of this.npcs.list) { n.prevPos.copy(n.pos); }
    this.physics.step();
    this.entities.postPhysics();
    for (const e of this.entities.list) if (e.thrownT > 0) { e.thrownT -= FIXED; }
  }

  _menuCamera(dt) {
    const cam = this.renderer.camera;
    const m = this.env?.menuCam || { center: [0, 2, 0], radius: 22, height: 7 };
    this._menuT = (this._menuT || 0) + dt * 0.035;
    // sweep: oscillate inside a sector (interior shots); 0 = full orbit
    const a = m.sweep ? Math.PI * 0.5 + Math.sin(this._menuT * 2.2) * m.sweep : this._menuT;
    cam.position.set(m.center[0] + Math.cos(a) * m.radius, m.center[1] + m.height + Math.sin(a * 0.7) * 1.5, m.center[2] + Math.sin(a) * m.radius);
    cam.lookAt(m.center[0], m.center[1], m.center[2]);
    // keep the menu diorama alive: drop a prop now and then
    this._menuDrop = (this._menuDrop || 0) - dt;
    if (this._menuDrop <= 0 && this.entities.count() < 40) {
      this._menuDrop = 2.5;
      const keys = ['crate', 'barrel_blue', 'melon', 'block_05', 'beachball', 'duck', 'crate_small', 'cone', 'tube_1', 'dice'];
      const k = keys[Math.floor(Math.random() * keys.length)];
      const p = new THREE.Vector3(m.center[0] + (Math.random() - 0.5) * 8, m.center[1] + 9, m.center[2] + (Math.random() - 0.5) * 8);
      this.entities.spawnProp(k, p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)));
    }
  }

  /* ================================================================== aiming & use */
  aimDir() { return this.renderer.camera.getWorldDirection(new THREE.Vector3()); }

  /** Crosshair trace for tools: { point, normal, entity, distance, world } or null. */
  trace(range = 200) {
    const cam = this.renderer.camera;
    const hit = this.physics.raycast(cam.position, this.aimDir(), range, { excludeBody: this.player.body, predicate: (c) => !c.isSensor() && this.physics.colliderOwner.get(c.handle)?.kind !== 'player' });
    if (!hit) return null;
    hit.world = hit.entity?.kind === 'world';
    return hit;
  }

  _updateUse() {
    this.useTarget = null;
    const p = this.player;
    if (!p.alive || p.vehicle) return;
    const cam = this.renderer.camera;
    const dir = this.aimDir();
    let best = null, bd = 0.86;
    for (const u of this.level.usables) {
      if (!u.enabled) continue;
      const to = _v.copy(u.pos).sub(cam.position);
      const d = to.length();
      if (d > 2.4 + (u.radius || 0)) continue;
      const dot = to.normalize().dot(dir);
      if (dot > bd) { bd = dot; best = u; }
    }
    const hit = this.physics.raycast(cam.position, dir, 3, { excludeBody: p.body });
    const e = hit?.entity;
    if (e?.vehicle) best = { prompt: 'Drive Rover', use: () => e.vehicle.enter(p) };
    else if (e?.usable) best = e.usable;
    this.useTarget = best;
  }

  channelDown(ch) {
    if (!this.inputEnabled || this.player.vehicle) return false;
    const input = this.input;
    if (this.physgun?.held && (ch === 1 || ch === 2) && input.lastDevice === 'gamepad') return false;
    return input.isDown('ch' + ch);
  }

  canNoclip() { return this.mode === 'sandbox' || this.story?.allowNoclip; }
  canSpawn(kind, id) { return this.mode === 'sandbox' || !!this.story?.canSpawn(kind, id); }
  canUseTool(id) { return this.mode === 'sandbox' || !!this.story?.canUseTool(id); }
  canPhysgun(e) { return this.story ? this.story.canPhysgun(e) : true; }

  /** Controller rumble (respects the Vibration setting; silently absent on keyboard). */
  rumble(strong, weak = strong, ms = 120) {
    if (!settings.vibration || this.input.lastDevice !== 'gamepad') return;
    const pad = this.input.pad;
    try { pad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }); } catch { /* unsupported */ }
  }

  /* ================================================================== combat */
  fireBullet(o, d, { damage = 10, force = 30, tracerFrom = null, tracer = true } = {}) {
    const hit = this.physics.raycast(o, d, 500, { excludeBody: this.player.body, predicate: (c) => !c.isSensor() && this.physics.colliderOwner.get(c.handle)?.kind !== 'player' });
    const end = hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : o.clone().addScaledVector(d, 200);
    if (tracer && tracerFrom) this.fx.tracer(tracerFrom, end);
    if (!hit) return null;
    this.applyHit(hit, d, { damage, force, type: 'bullet' });
    return hit;
  }

  applyHit(hit, d, { damage, force, type }) {
    const e = hit.entity;
    const point = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
    const n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    if (e?.kind === 'npc') {
      e.npc.hurt(damage, { point, normal: n, dir: d, force, type });
      return;
    }
    if (e?.onHit) { e.onHit(damage, { point, normal: n, dir: d, type }); }
    const surface = e?.surface || 'concrete';
    this.fx.impact(point, n, surface);
    if (type === 'bullet') Audio.play('bullet_impact', { pos: point, volume: 0.6 });
    if (e?.kind === 'world' || !e) { if (type === 'bullet') this.fx.decal(point, n, 'hole', 0.1); return; }
    if (e.body?.isDynamic()) e.body.applyImpulseAtPoint({ x: d.x * force, y: d.y * force, z: d.z * force }, hit.point, true);
    if (e.kind === 'balloon') { e.destroy(); return; }
    e.damage?.(damage, { type, point, dir: d });
  }

  explode(pos, { radius = 6, damage = 120, force = 50 } = {}, source = null) {
    this.fx.explosion(pos, radius / 6);
    Audio.play('explosion', { pos, big: radius > 6, volume: 1.2, ref: 8 });
    const dist = this.renderer.camera.position.distanceTo(pos);
    this.renderer.addShake(Math.max(0, 1.2 - dist / (radius * 4)));
    this.rumble(Math.max(0, 1 - dist / (radius * 5)), 0.6, 400);
    const down = this.physics.raycast({ x: pos.x, y: pos.y + 0.2, z: pos.z }, { x: 0, y: -1, z: 0 }, radius * 0.6);
    if (down && down.entity?.kind === 'world') this.fx.decal(new THREE.Vector3(down.point.x, down.point.y, down.point.z), new THREE.Vector3(down.normal.x, down.normal.y, down.normal.z), 'scorch', radius * 0.8);
    // player
    const pp = this.player.pos.clone().add(new THREE.Vector3(0, 0.9, 0));
    const pd = pp.distanceTo(pos);
    if (pd < radius && !this.player.vehicle) {
      const k = 1 - pd / radius;
      const push = pp.clone().sub(pos).normalize().multiplyScalar(force * 0.25 * k).add(new THREE.Vector3(0, 4 * k, 0));
      this.player.takeDamage(damage * k * k * 0.9, { type: 'explosion', from: pos.clone(), force: push });
    }
    // npcs
    for (const npc of [...this.npcs.list]) {
      const d = npc.center.distanceTo(pos);
      if (d < radius) {
        const k = 1 - d / radius;
        npc.hurt(damage * k, { type: 'explosion', dir: npc.center.clone().sub(pos).normalize().add(new THREE.Vector3(0, 0.6, 0)), force: force * 1.5 * k, point: npc.center.clone() });
      }
    }
    // entities: impulse + chain reactions (delayed a touch so chains ripple outward)
    for (const e of this.physics.overlapSphere(pos, radius)) {
      if (e === source || e.removed || e.kind === 'npc' || e.kind === 'world' || e.kind === 'player') continue;
      const d = e.curr.p.distanceTo(pos);
      const k = Math.max(0, 1 - d / radius);
      if (e.body?.isDynamic()) {
        const dir = e.curr.p.clone().sub(pos).normalize().add(new THREE.Vector3(0, 0.5, 0)).normalize();
        const m = Math.min(e.mass, 600);
        e.body.applyImpulse({ x: dir.x * force * m * k * 0.35, y: dir.y * force * m * k * 0.35, z: dir.z * force * m * k * 0.35 }, true);
        e.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * k * 4, y: (Math.random() - 0.5) * m * k * 4, z: (Math.random() - 0.5) * m * k * 4 }, true);
      }
      if (isFinite(e.maxHealth)) setTimeout(() => e.damage(damage * k, { type: 'explosion' }), 60 + d * 25);
      if (e.surface === 'wood' && Math.random() < k) e.ignite(5);
      e.onExplosion?.(k, pos);
    }
    this.onExplosion?.(pos, radius, source);
    this.story?.emit('explosion', { pos, radius, source });
  }

  /** Physics contact: sounds, breakage, crush damage. */
  onImpact(a, b, dv) {
    const now = this.time;
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!x || x.kind === 'world' || x.kind === 'player') continue;
      if (x.lastImpact && now - x.lastImpact < 0.09) continue;
      x.lastImpact = now;
      if (x.onImpactSound) { x.onImpactSound(dv); continue; }
      if (x.kind === 'npc') continue;
      const intensity = Math.min(1, dv / 9);
      if (intensity > 0.05) Audio.impact(x.surface, intensity, x.curr.p);
      // hard hits damage breakables
      if (dv > 7 && isFinite(x.maxHealth) && !x.held) x.damage((dv - 7) * 3.5, { type: 'impact' });
      if (dv > 9 && x.surface === 'metal' && intensity > 0.6) this.fx.sparks(x.curr.p, null, 6);
      // props hitting NPCs / the player
      if (y?.kind === 'npc' && x.body?.isDynamic()) {
        const v = x.body.linvel();
        const sp = Math.hypot(v.x, v.y, v.z);
        const m = x.mass;
        if (sp > 4 && m > 3) {
          const dmg = Math.min(400, (sp - 4) * Math.sqrt(m) * 2.2 * (x.flags.sharp ? 3 : 1));
          y.npc.hurt(dmg, { type: 'crush', dir: new THREE.Vector3(v.x, v.y, v.z).normalize(), force: sp * 2, point: x.curr.p.clone() });
          this.story?.emit('physicsKill', { prop: x, npc: y.npc, damage: dmg });
        }
      }
      if (y?.kind === 'player' && x.body?.isDynamic() && !x.held && x.thrownBy !== 'player') {
        const v = x.body.linvel();
        const sp = Math.hypot(v.x, v.y, v.z);
        if (sp > 9 && x.mass > 8) this.player.takeDamage((sp - 9) * Math.sqrt(x.mass) * 0.8, { type: 'crush', from: x.curr.p.clone() });
      }
    }
  }

  onNpcKilled(npc, info) { this.story?.emit('npcKilled', { npc, info }); }
  onGrab(e) { this.story?.emit('grab', e); }
  onDrop(e) { this.story?.emit('drop', e); }
  onFreeze(e) { this.story?.emit('freeze', e); }
  onConstraint(tool, c) { this.story?.emit('constraint', { tool, c }); }
  onToolSpawn(tool, e, target) { this.story?.emit('toolSpawn', { tool, e, target }); }
  onRemoveTool(e) { this.story?.emit('remove', e); }
  onEntityDestroyed(e) { this.story?.emit('destroyed', e); }
  noise() {}

  /* ================================================================== spawning */
  spawnFromMenu(kind, id) {
    const tr = this.trace(60);
    const cam = this.renderer.camera;
    const point = tr ? new THREE.Vector3(tr.point.x, tr.point.y, tr.point.z) : cam.position.clone().addScaledVector(this.aimDir(), 6);
    const normal = tr ? new THREE.Vector3(tr.normal.x, tr.normal.y, tr.normal.z) : new THREE.Vector3(0, 1, 0);
    const yaw = this.player.rig.yaw;
    if (this.entities.count('player') >= this.entities.limit && kind !== 'weapon') { this.hud.notify('Prop limit reached', 'error'); Audio.play('ui_error'); return; }
    let made = null;
    if (kind === 'prop') {
      const t = propTemplate(id);
      const up = Math.max(0.05, normal.y) ;
      const lift = -t.bounds.min.y * up + (1 - up) * Math.max(t.size.x, t.size.z) * 0.5 + 0.02;
      const pos = point.clone().addScaledVector(normal, lift);
      made = this.entities.spawnProp(id, pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), { owner: 'player' });
      progress.stats.propsSpawned++;
      if (made) { this.undo.push(PROPS[id].name, [made]); Audio.play('spawn', { pos }); }
      this.story?.emit('spawn', { kind, id, e: made });
    } else if (kind === 'pickup') {
      made = spawnPickup(this, id, point.clone().addScaledVector(normal, 0.3));
      if (made) { made.owner = 'player'; this.undo.push(made.name, [made]); Audio.play('spawn'); }
    } else if (kind === 'balloon') {
      made = createBalloon(this, point.clone().addScaledVector(normal, 0.6), { color: ['#ff3030', '#2fb8ff', '#ffd21f', '#4cd964', '#a64dff'][Math.floor(Math.random() * 5)] });
      this.undo.push('Balloon', [made]);
    } else if (kind === 'weapon') {
      if (this.weapons.has(id)) { this.weapons.select(id, true); if (id === 'grenade') this.weapons.addAmmo('grenade', 3); }
      else this.weapons.give(id, { select: true });
      const w = this.weapons.owned.get(id);
      if (w?.ammoType && w.ammoType !== 'grenade') this.weapons.addAmmo(w.ammoType, w.clipSize * 3);
      Audio.play('pickup');
    } else if (kind === 'npc') {
      const pos = point.clone().addScaledVector(normal, 0.05);
      if (NPC_TYPES[id].flying) pos.y += 2.5;
      const n = this.npcs.spawn(id, pos, yaw + Math.PI, { owner: 'player', alert: false });
      if (n && n.alive !== undefined) { n.spawnedByPlayer = true; n.home.copy(pos); }
      if (n?.ents) this.undo.push('Ragdoll', n.ents);
      Audio.play('spawn');
    } else if (kind === 'vehicle') {
      const pos = point.clone().addScaledVector(normal, 1.2);
      const v = new Vehicle(this, pos, yaw);
      v.entity.owner = 'player';
      this.undo.push('Rover', [v.entity]);
      Audio.play('spawn');
    }
    return made;
  }

  /* ================================================================== context menu (C) */
  openContext() {
    const tr = this.trace(40);
    const e = tr?.entity && tr.entity.kind !== 'world' ? tr.entity : null;
    const p = this.player;
    const items = [];
    if (e && e.kind === 'npc') {
      items.push(['Remove', () => e.npc.remove()]);
    } else if (e && e.body) {
      const all = contraption(e);
      items.push([e.frozen ? 'Unfreeze' : 'Freeze', () => e.setFrozen(!e.frozen)]);
      if (all.length > 1) items.push([`Unfreeze contraption (${all.length})`, () => all.forEach((x) => x.setFrozen(false))]);
      items.push([e.gravity ? 'Disable gravity' : 'Enable gravity', () => e.setGravity(!e.gravity)]);
      items.push([e.collide ? 'Collide with world only' : 'Enable collisions', () => e.setCollisions(!e.collide)]);
      items.push([e.burning ? 'Extinguish' : 'Ignite', () => (e.burning ? e.extinguish() : e.ignite(10))]);
      if (!e.flags.noRemove && this.canUseTool('remover')) items.push(['Remove', () => { e.remove({ effect: 'dissolve' }); Audio.play('remove'); }]);
    }
    items.push(['Undo last', () => this.undo.undo()]);
    if (this.canNoclip()) items.push([p.noclip ? 'Noclip: ON' : 'Noclip: OFF', () => p.setNoclip(!p.noclip)]);
    items.push([p.flashOn ? 'Flashlight: ON' : 'Flashlight: OFF', () => p.toggleFlashlight()]);
    const el = h('div.ctx', {}, h('div.ct', { text: e ? e.name : 'Context' }));
    for (const [label, fn] of items) {
      const b = h('div.btn', { text: label });
      focusable(b, () => { fn(); Audio.play('ui_select'); this.closeContext(); });
      el.append(b);
    }
    this.input.releaseAll();
    this.input.exitPointerLock();
    document.body.classList.add('cursor-on');
    this.contextEl = el;
    this.ui.pushOverlay(el, null, (a) => { if (a === 'back' || a === 'menu') { this.closeContext(); return true; } return false; });
  }

  closeContext() {
    if (!this.contextEl) return;
    this.ui.popOverlay(this.contextEl);
    this.contextEl = null;
    document.body.classList.remove('cursor-on');
    if (this.state === 'playing') this.requestLock();
  }

  readTerminal(id, title, body) {
    if (!progress.logsFound.includes(id)) { progress.logsFound.push(id); saveProgress(); }
    Audio.play('terminal');
    this.input.exitPointerLock();
    document.body.classList.add('cursor-on');
    const ov = terminalOverlay(this, title, body, () => { this.ui.popOverlay(ov.el); document.body.classList.remove('cursor-on'); this.requestLock(); });
    this.ui.pushOverlay(ov.el, null, ov.onNav);
    this.story?.emit('terminal', id);
  }

  showEnding() {
    this.state = 'menu';
    document.exitPointerLock?.();
    document.body.classList.remove('playing');
    this.hud.show(false);
    this.ui.show(creditsScreen(this, { ending: true }));
  }
}

const FROZEN_INPUT = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, isDown: () => false, justPressed: () => false, wheel: 0, padDown: () => false };

const TIPS = [
  'Tip: hold USE while holding an object with the Physics Gun to rotate it. Add SPRINT to snap to 45°.',
  'Tip: right-click with the Physics Gun freezes an object in mid-air.',
  'Tip: RELOAD with the Physics Gun unfreezes an object and everything welded to it.',
  'Tip: the Tool Gun\'s right click on Weld welds an object to whatever is behind it.',
  'Tip: thrusters, wheels and hoverballs listen on contraption channels — number pad, I/J/K/L/U/O, or the D-pad.',
  'Tip: explosive barrels catch fire before they blow. Throw them fast.',
  'Tip: Undo (Z, or hold VIEW on a controller) removes the last thing you made.',
  'Tip: the Duplicator copies a whole contraption with right-click and pastes it with left-click.',
];

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('fatal');
  el.classList.remove('hidden');
  el.innerHTML = '<div class="fatal-box"><h2>Could not start</h2><pre>' + String(e?.stack || e).replace(/[<>&]/g, '') + '</pre></div>';
});

export { game, PAD, saveSettings, spawnWeaponPickup };
