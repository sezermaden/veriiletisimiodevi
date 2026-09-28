/* The Unrendered — final boss. A giant corrupted Builder, shielded while the three pylons
   stand. Attacks: ground slam (a shockwave ring you jump over), thrown corrupted blocks,
   and summons. Takes damage from bullets, explosions and physics impacts once exposed. */
import * as THREE from 'three';
import { R, GROUPS } from '../physics/physics.js';
import { Entity } from '../world/entities.js';
import { buildHumanoid, looks } from '../world/npc.js';
import { Audio } from '../core/audio.js';
import { settings, DIFFICULTY } from '../core/settings.js';

const S = 4.4;

export class Boss {
  constructor(game, pos) {
    this.game = game;
    const diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    this.maxHealth = 2600 * diff.enemyHealth;
    this.health = this.maxHealth;
    this.pos = pos.clone();
    this.yaw = 0;
    this.alive = true;
    this.shielded = true;
    this.phase = 1;
    this.state = 'rise';
    this.t = 0;
    this.attackCd = 4;
    this.rings = [];
    this.look = looks('brute', 0.3);
    this.rig = buildHumanoid(this.look, S, 'brute');
    this.object3d = this.rig.root;
    this.object3d.position.copy(pos).add(new THREE.Vector3(0, -8, 0));
    game.renderer.scene.add(this.object3d);
    // shield bubble
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(5.2, 32, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.2, 1.5), transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
    this.shield.position.y = 4;
    this.object3d.add(this.shield);
    const w = game.physics.world;
    this.body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z));
    this.collider = w.createCollider(R.ColliderDesc.capsule(2.4, 1.5).setTranslation(0, 4, 0).setCollisionGroups(GROUPS.npc).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS), this.body);
    this.entity = new Entity(game, { kind: 'npc', name: 'The Unrendered', colliders: [this.collider], surface: 'glitch' });
    this.entity.npc = this;
    game.physics.register(this.collider, this.entity);
    Audio.play('boss_roar', { pos, volume: 1.2, ref: 20 });
  }

  get center() { return new THREE.Vector3(this.pos.x, this.pos.y + 4, this.pos.z); }

  hurt(amount, info = {}) {
    if (!this.alive || this.state === 'rise') return;
    const p = info.point ? new THREE.Vector3(info.point.x, info.point.y, info.point.z) : this.center;
    if (this.shielded) {
      this.shieldFlash = 1;
      Audio.play('shield_hit', { pos: p });
      this.game.fx.sparks(p, null, 6, new THREE.Color(3, 0.3, 2.6), 3);
      return;
    }
    let dmg = amount * (info.type === 'explosion' ? 1.6 : info.type === 'crush' ? 1.3 : 1);
    this.health -= dmg;
    this.hurtFlash = 1;
    this.game.fx.glitchBurst(p, 5, 0.8);
    if (Math.random() < 0.15) Audio.play('glitch', { pos: p });
    if (this.phase === 1 && this.health < this.maxHealth * 0.5) { this.phase = 2; this.onPhase?.(2); Audio.play('boss_roar', { pos: this.pos, ref: 20 }); this.game.renderer.addShake(0.8); }
    if (this.health <= 0) { this.health = 0; this.die(); }
  }

  setShield(on) {
    this.shielded = on;
    this.shield.visible = on;
    if (!on) { Audio.play('pylon_break', { pos: this.pos, ref: 20 }); this.game.fx.glitchBurst(this.center, 40, 2); this.stagger = 2.5; }
  }

  die() {
    this.alive = false;
    this.state = 'dying';
    this.t = 0;
    Audio.play('boss_roar', { pos: this.pos, ref: 25, volume: 1.4 });
    this.onDeath?.();
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    this.look._glitch && (this.look._glitch.uTime.value += dt);
    const pp = g.player.pos;
    const J = this.rig.joints;
    const target = Math.atan2(pp.x - this.pos.x, pp.z - this.pos.z);
    // shield pulse
    if (this.shieldFlash > 0) this.shieldFlash -= dt * 3;
    this.shield.material.opacity = 0.12 + Math.max(0, this.shieldFlash || 0) * 0.35;
    if (this.hurtFlash > 0) { this.hurtFlash -= dt * 4; }
    this.look.pelvis.emissiveIntensity = 0.9 + Math.max(0, this.hurtFlash || 0) * 3;

    if (this.state === 'rise') {
      const k = Math.min(1, this.t / 4);
      this.object3d.position.set(this.pos.x, this.pos.y - 8 * (1 - k) * (1 - k), this.pos.z);
      if (Math.random() < 0.5) g.fx.glitchBurst(new THREE.Vector3(this.pos.x + (Math.random() - 0.5) * 6, 0.3, this.pos.z + (Math.random() - 0.5) * 6), 2, 0.8);
      g.renderer.addShake(0.02);
      if (k >= 1) { this.state = 'idle'; this.t = 0; }
      return;
    }
    if (this.state === 'dying') {
      const k = Math.min(1, this.t / 6);
      this.object3d.rotation.x = -k * 1.3;
      this.object3d.position.y = this.pos.y - k * 3;
      if (Math.random() < 0.8) g.fx.glitchBurst(this.center.add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)), 8, 1.4);
      if (Math.random() < 0.1) g.fx.flash(this.center, 0xff40e0, 30, 0.2, 30);
      g.renderer.addShake(0.05);
      if (this.t > 6 && this.object3d.parent) { g.fx.explosion(this.center, 3); Audio.play('explosion', { pos: this.pos, big: true, ref: 30 }); this.dispose(); }
      return;
    }

    // face the player
    let dy = target - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * (this.state === 'windup' ? 0.6 : 1.5));
    this.object3d.rotation.y = this.yaw;
    this.stagger = Math.max(0, (this.stagger || 0) - dt);

    // walk slowly toward the player, staying in the arena middle
    const to = new THREE.Vector3(pp.x - this.pos.x, 0, pp.z - this.pos.z);
    const dist = to.length();
    const walking = this.state === 'idle' && dist > 9 && this.stagger <= 0;
    if (walking) {
      to.normalize();
      const sp = this.phase === 2 ? 2.4 : 1.6;
      this.pos.addScaledVector(to, sp * dt);
      const r = Math.hypot(this.pos.x, this.pos.z);
      if (r > 14) { this.pos.x *= 14 / r; this.pos.z *= 14 / r; }
      this.walkPhase = (this.walkPhase || 0) + dt * sp * 1.3;
    }
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    this.object3d.position.set(this.pos.x, this.pos.y, this.pos.z);

    // procedural pose
    const w = walking ? Math.sin(this.walkPhase) * 0.5 : 0;
    J.thighL.rotation.x = w; J.thighR.rotation.x = -w;
    J.shinL.rotation.x = Math.max(0, -Math.sin(this.walkPhase || 0)) * (walking ? 0.8 : 0);
    J.shinR.rotation.x = Math.max(0, Math.sin(this.walkPhase || 0)) * (walking ? 0.8 : 0);
    J.chest.rotation.x = 0.15 + Math.sin(this.t * 1.3) * 0.04 - (this.stagger > 0 ? 0.4 : 0);
    J.head.rotation.z = Math.sin(this.t * 7) * 0.05 * (Math.random() < 0.1 ? 6 : 1);
    J.armL.rotation.set(-w * 0.6, 0, 0.25); J.armR.rotation.set(w * 0.6, 0, -0.25);

    // attacks
    this.attackCd -= dt * (this.phase === 2 ? 1.5 : 1);
    if (this.state === 'idle' && this.attackCd <= 0 && this.stagger <= 0) {
      const r = Math.random();
      this.attack = dist < 16 && r < 0.45 ? 'slam' : r < 0.8 ? 'throw' : 'summon';
      this.state = 'windup';
      this.t = 0;
      Audio.play(this.attack === 'slam' ? 'boss_roar' : 'null_growl', { pos: this.pos, ref: 18 });
    }
    if (this.state === 'windup') {
      const wind = this.attack === 'slam' ? 1.3 : 0.9;
      const k = Math.min(1, this.t / wind);
      if (this.attack === 'slam') { J.armL.rotation.x = -2.8 * k; J.armR.rotation.x = -2.8 * k; J.chest.rotation.x = -0.3 * k; }
      else if (this.attack === 'throw') { J.armR.rotation.x = -2.6 * k; J.armR.rotation.z = -0.4; }
      else { J.armL.rotation.z = 1.2 * k; J.armR.rotation.z = -1.2 * k; }
      if (this.t >= wind) this._release();
    } else if (this.state === 'recover') {
      if (this.t > 0.8) { this.state = 'idle'; this.attackCd = 2.6 + Math.random() * 2; }
    }
    this._updateRings(dt);
  }

  _release() {
    const g = this.game;
    this.state = 'recover';
    this.t = 0;
    if (this.attack === 'slam') {
      Audio.play('boss_slam', { pos: this.pos, ref: 25, volume: 1.3 });
      g.renderer.addShake(0.9);
      const front = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(3);
      const c = this.pos.clone().add(front);
      g.fx.explosion(c.clone().setY(0.3), 0.8);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 2.8), transparent: true }));
      ring.position.copy(c).setY(0.4);
      g.renderer.scene.add(ring);
      this.rings.push({ mesh: ring, r: 1, c, hit: false });
      // shove props
      for (const e of g.physics.overlapSphere(c, 8)) if (e.body?.isDynamic()) e.applyImpulse({ x: 0, y: e.mass * 7, z: 0 });
    } else if (this.attack === 'throw') {
      const hand = this.rig.joints.foreR.getWorldPosition(new THREE.Vector3());
      const e = g.entities.spawnProp('block_1', hand, new THREE.Quaternion(), { effect: false });
      e.setMaterial('checker');
      e.name = 'Corrupted block';
      e.maxHealth = 30; e.health = 30;
      const pp = g.player.pos.clone().add(new THREE.Vector3(0, 1, 0));
      const d = pp.sub(hand);
      const tFlight = Math.max(0.6, d.length() / 22);
      const v = new THREE.Vector3(d.x / tFlight, d.y / tFlight + 0.5 * 11.4 * tFlight, d.z / tFlight);
      e.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
      e.body.setAngvel({ x: 3, y: 2, z: 1 }, true);
      e.thrownBy = 'boss';
      e.life = 8;
      e.behaviours.push((dt) => { e.life -= dt; if (e.life <= 0) e.remove({ effect: 'dissolve' }); });
      Audio.play('swing', { pos: hand, volume: 1.5 });
    } else {
      const n = this.phase === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = new THREE.Vector3(Math.cos(a) * 18, 0.05, Math.sin(a) * 18);
        const type = i === 0 && Math.random() < 0.5 ? 'drone' : 'null';
        if (type === 'drone') p.y = 4;
        if (g.npcs.hostilesAlive() < 6) g.npcs.spawn(type, p, 0, { alert: true });
      }
    }
  }

  _updateRings(dt) {
    const g = this.game;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += dt * 16;
      r.mesh.scale.set(r.r, 1, r.r);
      r.mesh.material.opacity = Math.max(0, 1 - r.r / 30);
      const pp = g.player.pos;
      const d = Math.hypot(pp.x - r.c.x, pp.z - r.c.z);
      if (!r.hit && Math.abs(d - r.r) < 0.9 && pp.y < 0.8 && g.player.onGround) {
        r.hit = true;
        const push = new THREE.Vector3(pp.x - r.c.x, 0, pp.z - r.c.z).normalize().multiplyScalar(9).setY(4);
        g.player.takeDamage(22, { type: 'melee', from: r.c.clone(), force: push });
      }
      if (r.r > 30) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
  }

  dispose() {
    for (const r of this.rings) r.mesh.removeFromParent();
    this.rings = [];
    this.object3d.removeFromParent();
    if (this.body) { this.game.physics.unregister(this.collider); this.game.physics.world.removeRigidBody(this.body); this.body = null; }
  }
}
