/* Weapon system: inventory, switching, viewmodel animation, ammo, and the conventional
   weapons (crowbar, pistol, SMG, shotgun, grenade). The Physics Gun, Gravity Gun and Tool
   Gun live in their own modules but share this base class. */
import * as THREE from 'three';
import { Audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { crowbarModel, pistolModel, smgModel, shotgunModel, grenadeModel, grenadeWorldMesh } from './viewmodels.js';
import { GROUPS } from '../physics/physics.js';
import { Entity } from '../world/entities.js';

const _v = new THREE.Vector3();

export class Weapon {
  constructor(game, o) {
    this.game = game;
    this.id = o.id;
    this.name = o.name;
    this.slot = o.slot;
    this.ammoType = o.ammoType || null;
    this.clipSize = o.clipSize ?? 0;
    this.clip = o.clipSize ?? 0;
    this.icon = o.icon || this.name;
    this.base = new THREE.Vector3(...(o.base || [0.2, -0.2, -0.38]));
    this.cooldown = 0;
    this.kick = 0;          // recoil 0..1 (viewmodel)
    this.reloadT = 0;
    this.reloadTime = o.reloadTime ?? 1.4;
    const m = o.model();
    this.vm = m.root;
    this.muzzle = m.muzzle;
    this.parts = m.parts || {};
    this.vm.visible = false;
    this.vm.scale.setScalar(o.vmScale ?? 0.72);
    this.vm.traverse((x) => { if (x.isMesh) { x.frustumCulled = false; } });
  }

  get reserve() { return this.ammoType ? this.game.weapons.ammo[this.ammoType] || 0 : 0; }
  set reserve(v) { if (this.ammoType) this.game.weapons.ammo[this.ammoType] = v; }

  /** Muzzle position in WORLD space (viewmodel camera -> world camera). */
  muzzleWorld(out = new THREE.Vector3()) {
    const cam = this.game.renderer.camera;
    this.muzzle.updateWorldMatrix(true, false);
    out.setFromMatrixPosition(this.muzzle.matrixWorld);                // vm-camera space (camera at origin)
    const vmCam = this.game.renderer.vmCamera;
    out.applyMatrix4(new THREE.Matrix4().copy(vmCam.matrixWorld).invert());
    // The viewmodel camera has its own FOV: rescale x/y so the point projects to the same
    // screen position through the world camera, then place it in world space.
    const k = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(vmCam.fov / 2));
    out.x *= k; out.y *= k;
    return out.applyMatrix4(cam.matrixWorld);
  }

  eyeRay() {
    const cam = this.game.renderer.camera;
    const o = cam.getWorldPosition(new THREE.Vector3());
    const d = cam.getWorldDirection(new THREE.Vector3());
    return { o, d };
  }

  equip() {}
  holster() {}
  update(input, dt) { void input; this.cooldown = Math.max(0, this.cooldown - dt); }
  hudInfo() { return this.ammoType ? { clip: this.clip, reserve: this.reserve } : null; }
  animate() {}
  canHolster() { return true; }
  reload() {
    if (!this.ammoType || this.reloadT > 0 || this.clip >= this.clipSize || this.reserve <= 0) return;
    this.reloadT = this.reloadTime;
    Audio.play('reload');
  }
  _tickReload(dt) {
    if (this.reloadT <= 0) return;
    this.reloadT -= dt;
    if (this.reloadT <= 0) {
      const need = this.clipSize - this.clip;
      const take = Math.min(need, this.reserve);
      this.clip += take;
      this.reserve -= take;
    }
  }
}

/* ============================================================== firearms */
class Firearm extends Weapon {
  constructor(game, o) {
    super(game, o);
    this.damage = o.damage;
    this.rate = o.rate;             // seconds between shots
    this.auto = !!o.auto;
    this.spread = o.spread ?? 0.01;
    this.pellets = o.pellets ?? 1;
    this.force = o.force ?? 40;
    this.sound = o.sound;
    this.recoil = o.recoil ?? 0.02;
    this.pump = !!o.pump;
  }

  update(input, dt) {
    super.update(input, dt);
    this._tickReload(dt);
    if (this.reloadT > 0) return;
    const want = this.auto ? input.isDown('primary') : input.justPressed('primary');
    if (want && this.cooldown <= 0) {
      if (this.clip <= 0) {
        if (input.justPressed('primary')) Audio.play('dryfire');
        if (this.reserve > 0) this.reload();
        return;
      }
      this.fire();
    }
    if (input.justPressed('reload')) this.reload();
  }

  fire() {
    this.clip--;
    this.cooldown = this.rate;
    this.kick = 1;
    const { o, d } = this.eyeRay();
    const muzzle = this.muzzleWorld();
    Audio.play(this.sound, { volume: 0.8 });
    this.game.fx.muzzle(muzzle, d, this.pellets > 1);
    for (let i = 0; i < this.pellets; i++) {
      const dir = d.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).multiplyScalar(this.spread)).normalize();
      this.game.fireBullet(o, dir, { damage: this.damage, force: this.force, tracerFrom: muzzle, tracer: i === 0 || Math.random() < 0.35 });
    }
    // view punch
    const p = this.game.player;
    p.rig.pitch += this.recoil * (0.6 + Math.random() * 0.4);
    p.rig.yaw += (Math.random() - 0.5) * this.recoil * 0.5;
    this.game.renderer.addShake(this.pellets > 1 ? 0.35 : 0.08);
    this.game.noise?.(o, 30);
    if (this.pump) setTimeout(() => Audio.play('pump', { volume: 0.6 }), 280);
  }

  animate(t, k) {
    // reload dip
    const r = this.reloadT > 0 ? Math.sin(Math.min(1, 1 - this.reloadT / this.reloadTime) * Math.PI) : 0;
    this.vm.rotation.x += -r * 0.6;
    this.vm.position.y -= r * 0.08;
    if (this.parts.mag) this.parts.mag.position.y = -0.07 - r * 0.15;
    if (this.parts.pump) this.parts.pump.position.z = -0.38 + Math.max(0, Math.sin(Math.min(1, (this.rate - this.cooldown) / this.rate) * Math.PI)) * 0.07 * (this.cooldown > 0 ? 1 : 0);
    void t; void k;
  }
}

class Crowbar extends Weapon {
  constructor(game) { super(game, { id: 'crowbar', name: 'Crowbar', slot: 1, model: crowbarModel, base: [0.22, -0.26, -0.3] }); this.swing = 0; }
  update(input, dt) {
    super.update(input, dt);
    this.swing = Math.max(0, this.swing - dt * 3.5);
    if (input.isDown('primary') && this.cooldown <= 0) {
      this.cooldown = 0.45;
      this.swing = 1;
      Audio.play('swing', { volume: 0.7 });
      setTimeout(() => this._hit(), 90);
    }
  }
  _hit() {
    const { o, d } = this.eyeRay();
    const hit = this.game.physics.raycast(o, d, 2.0, { excludeBody: this.game.player.body, groups: GROUPS.player | 0xffff });
    if (!hit) return;
    this.game.applyHit(hit, d, { damage: 25, force: 90, type: 'melee' });
    if (hit.entity?.kind === 'npc') Audio.play('impact_flesh', { pos: hit.point });
    else Audio.play(hit.entity?.surface === 'wood' ? 'impact_wood' : 'impact_metal', { pos: hit.point, intensity: 0.5 });
    this.game.renderer.addShake(0.15);
  }
  animate() {
    const s = this.swing;
    const arc = s > 0 ? Math.sin((1 - s) * Math.PI) : 0;
    this.vm.rotation.x += -arc * 1.1;
    this.vm.rotation.z += arc * 0.6;
    this.vm.position.x -= arc * 0.15;
  }
}

class Grenade extends Weapon {
  constructor(game) { super(game, { id: 'grenade', name: 'Frag Grenade', slot: 5, ammoType: 'grenade', model: grenadeModel, base: [0.18, -0.18, -0.3] }); this.clipSize = 0; this.wind = 0; }
  hudInfo() { return { clip: this.reserve, reserve: null }; }
  update(input, dt) {
    super.update(input, dt);
    this.vm.visible = this.reserve > 0 || this.wind > 0;
    if (this.reserve <= 0) return;
    if ((input.justPressed('primary') || input.justPressed('secondary')) && this.cooldown <= 0) {
      this.wind = 0.01; this.lob = input.justPressed('secondary');
      Audio.play('pin');
    }
    if (this.wind > 0) {
      this.wind += dt;
      if (this.wind > 0.35) { this.throw(); this.wind = 0; this.cooldown = 0.9; }
    }
  }
  throw() {
    this.reserve--;
    const { o, d } = this.eyeRay();
    const p = o.clone().addScaledVector(d, 0.6);
    const g = this.game;
    const mesh = grenadeWorldMesh();
    mesh.position.copy(p);
    const { body, colliders } = g.entities.buildBody([{ ball: 0.1 }], { pos: p, quat: new THREE.Quaternion(), density: 4, surface: 'metal', ccd: true, groups: GROUPS.prop });
    const e = new Entity(g, { kind: 'grenade', name: 'Grenade', object3d: mesh, body, colliders, surface: 'metal', halfHeight: 0.1 });
    g.entities.add(e);
    const speed = this.lob ? 8 : 17;
    const pv = g.player.vel;
    body.setLinvel({ x: d.x * speed + pv.x, y: d.y * speed + (this.lob ? 5 : 2.5) + pv.y * 0.5, z: d.z * speed + pv.z }, true);
    body.setAngvel({ x: Math.random() * 10, y: 0, z: Math.random() * 10 }, true);
    e.fuse = 2.6;
    e.behaviours.push((dt) => {
      e.fuse -= dt;
      const blink = Math.sin(e.fuse * (e.fuse < 1 ? 30 : 12)) > 0;
      mesh.userData.light.visible = blink;
      if (e.fuse <= 0 && !e.removed) { g.explode(e.curr.p.clone(), { radius: 7, damage: 150, force: 55 }, e); e.remove(); }
    });
    e.onImpactSound = () => Audio.play('grenade_bounce', { pos: e.curr.p });
    this.kick = 1;
  }
  animate() {
    const w = this.wind > 0 ? Math.min(1, this.wind / 0.35) : 0;
    this.vm.position.z += w * 0.12;
    this.vm.rotation.x += w * 0.8;
  }
}

/* ============================================================== manager */
export const WEAPON_DEFS = {
  crowbar: (g) => new Crowbar(g),
  pistol: (g) => new Firearm(g, { id: 'pistol', name: '9mm Pistol', slot: 2, ammoType: 'pistol', clipSize: 18, model: pistolModel, damage: 14, rate: 0.12, spread: 0.012, force: 30, sound: 'pistol', recoil: 0.018, reloadTime: 1.3, base: [0.18, -0.2, -0.36] }),
  smg: (g) => new Firearm(g, { id: 'smg', name: 'SMG', slot: 3, ammoType: 'smg', clipSize: 45, model: smgModel, damage: 8, rate: 0.075, auto: true, spread: 0.03, force: 22, sound: 'smg', recoil: 0.011, reloadTime: 1.5, base: [0.17, -0.2, -0.36] }),
  shotgun: (g) => new Firearm(g, { id: 'shotgun', name: 'Shotgun', slot: 4, ammoType: 'buckshot', clipSize: 6, model: shotgunModel, damage: 9, pellets: 8, rate: 0.85, spread: 0.07, force: 55, sound: 'shotgun', recoil: 0.06, reloadTime: 2.2, pump: true, base: [0.17, -0.2, -0.4] }),
  grenade: (g) => new Grenade(g),
};

export const MAX_AMMO = { pistol: 150, smg: 225, buckshot: 32, grenade: 5 };

export class WeaponManager {
  constructor(game) {
    this.game = game;
    this.owned = new Map();
    this.order = ['crowbar', 'physgun', 'gravgun', 'pistol', 'smg', 'shotgun', 'grenade', 'toolgun'];
    this.current = null;
    this.pending = null;
    this.switchT = 0;
    this.drawT = 0;
    this.ammo = { pistol: 0, smg: 0, buckshot: 0, grenade: 0 };
    this.sway = new THREE.Vector2();
    this.selectorT = 0;
    this.holder = new THREE.Group();
    game.renderer.vmCamera.add(this.holder);
    this.factories = { ...WEAPON_DEFS };
  }

  register(id, factory) { this.factories[id] = factory; }

  give(id, { select = false, silent = false } = {}) {
    if (!this.factories[id]) return null;
    let w = this.owned.get(id);
    if (!w) {
      w = this.factories[id](this.game);
      this.owned.set(id, w);
      this.holder.add(w.vm);
      if (w.ammoType && w.ammoType !== 'grenade') this.ammo[w.ammoType] = Math.max(this.ammo[w.ammoType], w.clipSize * 2);
      if (w.ammoType === 'grenade') this.ammo.grenade = Math.max(this.ammo.grenade, 2);
      if (!silent) { Audio.play('pickup'); this.game.hud?.pickup(w.name); }
    }
    if (select || !this.current) this.select(id, true);
    return w;
  }

  has(id) { return this.owned.has(id); }

  addAmmo(type, n) {
    if (this.ammo[type] === undefined) return false;
    if (this.ammo[type] >= MAX_AMMO[type]) return false;
    this.ammo[type] = Math.min(MAX_AMMO[type], this.ammo[type] + n);
    return true;
  }

  stripAll() {
    for (const w of this.owned.values()) { w.holster(); w.vm.removeFromParent(); w.dispose?.(); }
    this.owned.clear();
    this.current = null;
    this.pending = null;
    for (const k in this.ammo) this.ammo[k] = 0;
  }

  list() { return this.order.filter((id) => this.owned.has(id)).map((id) => this.owned.get(id)); }

  select(id, instant = false) {
    const w = this.owned.get(id);
    if (!w || w === this.current) return;
    if (this.current && !this.current.canHolster()) return;
    if (instant || !this.current) {
      this.current?.holster();
      if (this.current) this.current.vm.visible = false;
      this.current = w;
      w.vm.visible = true;
      w.equip();
      this.drawT = 1;
    } else {
      this.pending = w;
      this.switchT = 0.12;
    }
    this.selectorT = 1.6;
    Audio.play('ui_move', { volume: 0.6 });
  }

  cycle(dir) {
    const l = this.list();
    if (!l.length) return;
    const target = this.pending || this.current;
    const i = l.indexOf(target);
    const n = l[(i + dir + l.length) % l.length];
    this.select(n.id);
  }

  selectSlot(slot) {
    const inSlot = this.list().filter((w) => w.slot === slot);
    if (!inSlot.length) return;
    const target = this.pending || this.current;
    const i = inSlot.indexOf(target);
    this.select(inSlot[(i + 1) % inSlot.length].id);
  }

  update(input, dt, allowFire) {
    if (this.pending) {
      this.switchT -= dt;
      if (this.switchT <= 0) {
        this.current?.holster();
        if (this.current) this.current.vm.visible = false;
        this.current = this.pending;
        this.pending = null;
        this.current.vm.visible = true;
        this.current.equip();
        this.drawT = 1;
      }
    }
    this.selectorT = Math.max(0, this.selectorT - dt);
    this.drawT = Math.max(0, this.drawT - dt * 3.2);
    const w = this.current;
    if (w && allowFire && !this.pending) w.update(input, dt);
    else if (w) w.cooldown = Math.max(0, w.cooldown - dt);
    this._animate(input, dt);
  }

  _animate(input, dt) {
    const w = this.current;
    if (!w) return;
    const p = this.game.player;
    // sway: viewmodel lags behind the look direction
    this.sway.x += (-input.look.x * 1.6 - this.sway.x) * Math.min(1, dt * 10);
    this.sway.y += (-input.look.y * 1.6 - this.sway.y) * Math.min(1, dt * 10);
    this.sway.clampScalar(-0.06, 0.06);
    w.kick = Math.max(0, w.kick - dt * 8);
    const t = performance.now() / 1000;
    const bob = settings.viewBob ? p.bob : p.bob * 0.3;
    const sprint = input.isDown('sprint') && p.onGround && p.bob > 0.6 && input.move.y > 0.1 && !p.crouching ? 1 : 0;
    this._sprint = (this._sprint || 0) + (sprint - (this._sprint || 0)) * Math.min(1, dt * 8);
    const draw = this.pending ? 1 - Math.max(0, this.switchT / 0.12) : this.drawT;
    w.vm.position.set(
      w.base.x + this.sway.x + Math.cos(p.bobT) * 0.012 * bob - this._sprint * 0.06,
      w.base.y + this.sway.y - Math.abs(Math.sin(p.bobT)) * 0.014 * bob - p.landDip * 0.4 - draw * 0.3 - this._sprint * 0.04 + Math.sin(t * 1.6) * 0.002,
      w.base.z + w.kick * 0.05,
    );
    w.vm.rotation.set(w.kick * 0.12 + this.sway.y * 1.5 - this._sprint * 0.25, this.sway.x * 1.5 + this._sprint * 0.5, this.sway.x * 0.8 - this._sprint * 0.2);
    w.animate(t, dt);
  }

  hudInfo() {
    const w = this.current;
    if (!w) return null;
    return { name: w.name, ...(w.hudInfo() || {}) };
  }
}

export { _v };
