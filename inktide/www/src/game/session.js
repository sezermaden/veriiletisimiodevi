// A running stage (story stage, boss arena, Turf Clash match or sandbox). Owns the scene and every
// gameplay system. The app calls update(frameDt) once per rendered frame.
//
// Frame contract (game-build Phase 3): edge-triggered input is latched ONCE per frame before the
// fixed-step loop; the fixed step only reads level-triggered state and the latched buffers.
import * as THREE from 'three';
import { InkSystem, TEAM_HERO, TEAM_MURK } from '../ink/ink-system.js';
import { Level } from '../world/level.js';
import { Environment } from '../world/environment.js';
import { Player } from '../actors/player.js';
import { AimCamera } from './aim-camera.js';
import { Projectiles } from '../weapons/projectiles.js';
import { Particles } from '../fx/particles.js';
import { Events } from '../engine/events.js';
import { Hud } from '../ui/hud.js';
import { spawnEntity } from '../entities/base.js';
import { settings } from '../engine/settings.js';
import { save } from '../engine/save.js';

export const FIXED = 1 / 60;
// A 60 Hz display feeding a 60 Hz step lands either side of FIXED by a fraction of a millisecond,
// so the accumulator would alternate 0, 2, 0, 2 steps. Snapping anything within 1.5 ms up to a
// full step makes the common case exactly one step per frame.
const SNAP = 0.0015;

export class Session {
  /**
   * @param {App} app
   * @param {object} o  levelDef, mode (mode object), kit, colors {a, b}, team, upgrades
   */
  constructor(app, o) {
    this.app = app;
    this.opts = o;
    this.renderer = app.renderer;
    this.input = app.input;
    this.audio = app.audio;
    this.events = new Events();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.get('video.fov'), innerWidth / innerHeight, 0.08, 1400);
    this.actors = [];
    this.entities = [];
    this.time = 0;
    this.paused = false;
    this.pearls = 0;
    this._acc = 0;
    this.stepsLastFrame = 0;
    this.godMode = false;
    this.mode = o.mode || null;
  }

  async start() {
    const o = this.opts;
    const def = o.levelDef;
    const q = settings.get('video.quality');
    this.ink = new InkSystem(this.renderer.gl, { atlasSize: q === 'ultra' ? 4096 : q === 'low' ? 1024 : 2048, texelsPerMeter: q === 'ultra' ? 16 : 10 });
    const colors = o.colors || settings.inkColors();
    this.ink.setTeamColors(colors.hero || colors.a, colors.murk || colors.b);

    this.fx = new Particles(this.scene);
    this.projectiles = new Projectiles(this);
    this.level = new Level(this, def).build();
    this.scene.add(this.level.group);
    this.env = new Environment(this.scene, this.renderer, def.theme || 'docks', {
      waterY: def.waterY ?? -2, bounds: this.level.bounds, water: def.water !== false, backdrop: def.backdrop !== false, override: def.themeOverride,
    });

    this.player = new Player(this, { kit: o.kit || save.data.kit, team: o.team ?? TEAM_HERO, upgrades: o.upgrades ?? save.data.upgrades, look: o.look });
    this.actors.push(this.player);
    const sp = def.spawn || { pos: [0, 0, 0], yaw: 0 };
    this.spawnPoint = { pos: new THREE.Vector3().fromArray(sp.pos), yaw: sp.yaw || 0 };
    this.player.spawn(this.spawnPoint.pos, this.spawnPoint.yaw);

    this.camRig = new AimCamera(this.camera, this);
    this.camRig.snap(this.player);

    this.hud = new Hud(this);
    for (const e of def.entities || []) spawnEntity(this, e);
    this.renderer.setScene(this.scene, this.camera);
    // music + ambience default to the stage theme; modes may override after start
    this.audio?.playMusic?.(def.music || def.theme || 'docks');
    this.audio?.ambience?.(def.theme || null);
    await this.mode?.start?.(this);
    this.events.on('hit', (e) => { if (e.source === this.player && e.target !== this.player) this.hud.hitMarker(); });
    // warm the ink atlas + shaders so the first splat doesn't hitch
    this.ink.flush();
    this.renderer.gl.compile(this.scene, this.camera);
    this.started = true;
    return this;
  }

  addEntity(e) { this.entities.push(e); return e; }

  entity(id) { return this.entities.find((e) => e.id === id && !e.dead) || null; }

  enemiesOf(team) { return this.actors.filter((a) => a.alive && a.team !== team); }

  /** Camera trauma scaled by distance from the player. */
  shake(pos, amount) {
    const d = pos ? pos.distanceTo(this.player.position) : 0;
    const f = Math.max(0, 1 - d / 25);
    if (f > 0) this.camRig.addTrauma(amount * f);
    if (f > 0.3) this.input.rumble(0.4 * amount * f, 0.6 * amount * f, 150);
  }

  setCheckpoint(pos, yaw = null) {
    this.spawnPoint.pos.copy(pos);
    if (yaw != null) this.spawnPoint.yaw = yaw;
  }

  respawnPlayer() {
    const sp = this.mode?.respawnPoint?.(this) || this.spawnPoint;
    this.player.spawn(sp.pos, sp.yaw);
    // super-jump style arrival: drop in from above (clear of ceilings)
    const up = this.level.raycast(sp.pos.clone().setY(sp.pos.y + 1), new THREE.Vector3(0, 1, 0), 12);
    const h = Math.max(0, Math.min(9, (up ? up.distance : 12) - 2.5));
    if (h > 1) { this.player.position.y += h; this.player.velocity.set(0, -16, 0); this.player.invulnerable = 2; }
    this.camRig.snap(this.player);
    this.fx.explosion(sp.pos, new THREE.Vector3(0, 1, 0), this.ink.color(this.player.team), 1.4);
    this.ink.paint(sp.pos, 1.6, this.player.team, new THREE.Vector3(0, 1, 0));
    this.audio?.sfx('superjump', { volume: 0.6 });
    this.hud.clearScreenInk();
    this.events.emit('playerRespawned', {});
  }

  update(frameDt) {
    if (!this.started) return;
    const input = this.input;
    const dt = Math.min(0.05, frameDt);        // a hitch must not teleport anyone
    if (this.paused) {
      this.renderer.render();
      return;
    }

    // ---- EDGES: once per frame, latched into buffers ----
    // (legacyEdges reproduces the old bug for the negative-control test only: no latch, no SNAP)
    if (!this.legacyEdges) this.player.latchInput(input);
    this.mode?.latchInput?.(this, input);

    this._acc += dt * (this.timeScale ?? 1);
    let steps = 0;
    const snap = this.legacyEdges ? 0 : SNAP;
    while (this._acc + snap >= FIXED && steps < 5) {
      this.step(FIXED);
      this._acc = Math.max(0, this._acc - FIXED);
      steps++;
    }
    if (steps === 5) this._acc = 0;              // a long stall must not spiral
    if (steps === 0) this.player.decayBuffers(dt); // buffers decay on the frame clock
    this.stepsLastFrame = steps;

    // ---- per frame ----
    this.camRig.update(input, dt, this.player);
    this.player.render(dt);
    for (const e of this.entities) if (!e.dead) e.render(dt);
    this.projectiles.render();
    this.fx.update(dt);
    this.ink.flush();
    this.ink.uniforms.inkTime.value = this.time;
    this.env.follow(this.player.position);
    this.env.update(dt);
    this.mode?.update?.(this, dt);
    this.hud.update(dt);
    this.audio?.setListener(this.camera.position, this.camRig.yaw);
    const g = this.renderer.grade;
    if (g) {
      const p = this.player;
      g.uniforms.damage.value = p.alive ? Math.max(0, 1 - p.hp / p.maxHp) * 0.7 : 0.6;
      g.uniforms.damageColor.value.copy(this.ink.color(p.enemyTeam));
      g.uniforms.flash.value = Math.max(0, (g.uniforms.flash.value || 0) - dt * 3);
    }
    this.renderer.render();
  }

  step(dt) {
    this.time += dt;
    this.mode?.step?.(this, dt);
    this.player.step(dt, this.input, this.camRig.yaw);
    for (const e of this.entities) if (!e.dead) e.step(dt);
    this._separate();
    this.projectiles.step(dt);
    // remove dead entities
    let w = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.dead) e.dispose(); else this.entities[w++] = e;
    }
    this.entities.length = w;
  }

  /** Keep the player out of solid actors (enemies, bots): horizontal circle separation. */
  _separate() {
    const p = this.player;
    if (!p.alive || p.submerged) return;
    const pr = p.form === 'squid' ? 0.3 : 0.34;
    for (const a of this.actors) {
      if (a === p || !a.alive || a.solid === false || a.flying) continue;
      const ap = a.position;
      const dy = p.position.y - ap.y;
      if (dy > (a.hitHeight ?? 1.2) - 0.1 || dy < -1.3) continue;
      const dx = p.position.x - ap.x, dz = p.position.z - ap.z;
      const r = pr + Math.min(1.2, (a.bodyRadius ?? a.hitRadius ?? 0.5) * 0.8);
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 1e-8) continue;
      const d = Math.sqrt(d2), push = r - d;
      p.position.x += (dx / d) * push;
      p.position.z += (dz / d) * push;
    }
  }

  flash(color = '#ffffff', amount = 0.8) {
    const g = this.renderer.grade;
    if (!g) return;
    g.uniforms.flashColor.value.set(color);
    g.uniforms.flash.value = amount;
  }

  pause(v = true) {
    this.paused = v;
    if (v) this.player.kit.main.cancel();
  }

  dispose() {
    this.audio?.ambience?.(null);
    this.mode?.dispose?.(this);
    for (const e of this.entities) e.dispose();
    this.entities.length = 0;
    this.player.dispose();
    this.projectiles.dispose();
    this.fx.dispose();
    this.level.dispose();
    this.env.dispose();
    this.ink.dispose();
    this.hud.dispose();
    this.events.clear();
    this.scene.traverse((o) => { if (o.isMesh) { o.geometry?.dispose?.(); } });
    this.renderer.gl.renderLists.dispose();
  }
}

export { TEAM_HERO, TEAM_MURK };
