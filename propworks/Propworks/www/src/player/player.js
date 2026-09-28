/* First-person player: Source-style movement on a Rapier kinematic character controller.

   Ground: accelerate toward wish velocity, friction when no input. Air: low acceleration
   with the classic "air strafe" projection. Jump is buffered (0.14 s) and has coyote time
   (0.1 s). The jump buffer is filled ONCE PER FRAME by Game.frame, never inside step(). */
import * as THREE from 'three';
import { FPSRig } from '../../engine/camera-rig.js';
import { R, GROUPS, GRAVITY, FIXED } from '../physics/physics.js';
import { Audio } from '../core/audio.js';
import { settings, DIFFICULTY } from '../core/settings.js';

const STAND_HH = 0.5, CROUCH_HH = 0.2, RADIUS = 0.38;  // capsule half-height / radius
const STAND_EYE = 1.64, CROUCH_EYE = 1.02;
const SPEED = { walk: 4.4, sprint: 7.8, slow: 2.1, crouch: 1.9, noclip: 11, noclipFast: 28, swim: 3.4 };
const JUMP_V = 5.3;
const SNAP = 0.0015;

const _wish = new THREE.Vector3();
const _v = new THREE.Vector3();

export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.renderer.camera;
    this.rig = new FPSRig(this.camera, { eyeHeight: STAND_EYE });
    this.pos = new THREE.Vector3();          // feet position
    this.prevPos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.onGround = false;
    this.groundSurface = 'concrete';
    this.groundBody = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.crouching = false;
    this.crouchToggle = false;
    this.crouchT = 0;                        // 0 stand .. 1 crouch (smoothed)
    this.noclip = false;
    this.inWater = false;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.alive = true;
    this.godMode = false;
    this.lookLocked = false;
    this.stepDist = 0;
    this.bobT = 0;
    this.bob = 0;
    this.landDip = 0;
    this.fallSpeed = 0;
    this.hurtFlash = 0;
    this.flashlight = null;
    this.flashOn = false;
    this.vehicle = null;
    this._acc = 0;
    this.stats = { distance: 0 };
    this._createBody();
  }

  _createBody() {
    const w = this.game.physics.world;
    this.body = w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0));
    this.collider = w.createCollider(R.ColliderDesc.capsule(STAND_HH, RADIUS).setCollisionGroups(GROUPS.player).setTranslation(0, STAND_HH + RADIUS, 0), this.body);
    this.game.physics.register(this.collider, { kind: 'player', player: this, surface: 'flesh' });
    this.cc = w.createCharacterController(0.03);
    this.cc.setUp({ x: 0, y: 1, z: 0 });
    this.cc.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    this.cc.setMinSlopeSlideAngle((58 * Math.PI) / 180);
    this.cc.enableAutostep(0.42, 0.18, false);
    this.cc.enableSnapToGround(0.35);
    this.cc.setApplyImpulsesToDynamicBodies(true);
    this.cc.setCharacterMass(85);
    this.cc.setSlideEnabled(true);
  }

  get eye() { return this.camera.position; }
  get halfHeight() { return this.crouching ? CROUCH_HH : STAND_HH; }

  spawn(p, yaw = 0, pitch = 0) {
    this.pos.set(p.x, p.y, p.z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.rig.yaw = yaw; this.rig.pitch = pitch;
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    this.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    this.alive = true;
    this.health = Math.max(this.health, 1);
    this.noclip = false;
    this.crouching = false;
    this.crouchT = 0;
    this._setCapsule(STAND_HH);
    this.jumpBuffer = 0;
    this._acc = 0;
    this.updateCamera(1, 0);
  }

  reset(full = true) {
    if (full) { this.health = 100; this.armor = 0; }
    this.alive = true;
    this.hurtFlash = 0;
  }

  _setCapsule(hh) {
    this.collider.setShape(new R.Capsule(hh, RADIUS));
    this.collider.setTranslationWrtParent({ x: 0, y: hh + RADIUS, z: 0 });
  }

  /** Per-frame: look and fixed-step movement. Edges are latched by the caller. */
  /**
   * Per-frame: look, then fixed steps. `stepWorld` (if given) advances the physics world
   * after each player step, in lockstep — the character controller reads the collider's
   * position, which only moves when the world steps.
   */
  update(input, dt, stepWorld = null) {
    if (!this.alive || this.vehicle) return 0;
    input.mouseSensitivity = 0.0022 * settings.mouseSensitivity;
    input.padSensitivity = 2.9 * settings.padSensitivity;
    input.invertY = settings.invertY;
    if (!this.lookLocked) this.rig.applyLook(input);

    this._acc += dt;
    let steps = 0;
    // legacyEdgeInStep reproduces the old bug for the negative-control test: no snap,
    // and the jump edge read inside the fixed step.
    const snap = this.legacyEdgeInStep ? 0 : SNAP;
    while (this._acc + snap >= FIXED && steps < 5) {
      this.prevPos.copy(this.pos);
      this.step(input, FIXED);
      if (stepWorld) stepWorld();
      else this.body.setTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, true);
      this._acc = Math.max(0, this._acc - FIXED);
      steps++;
    }
    if (steps === 5) this._acc = 0;
    if (steps === 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    return steps;
  }

  step(input, dt) {
    if (this.legacyEdgeInStep && input.justPressed('jump')) this.jumpBuffer = 0.14;
    const wantCrouch = settings.toggleCrouch ? this.crouchToggle : input.isDown('crouch');
    this._updateCrouch(wantCrouch, dt);
    const [fwd, right] = this.rig.basis();
    const water = this.game.physics.waterAt({ x: this.pos.x, y: this.pos.y + 0.9, z: this.pos.z });
    const wasWater = this.inWater;
    this.inWater = !!water;
    if (this.inWater && !wasWater && this.vel.y < -3) { Audio.play('splash', { pos: this.pos, intensity: Math.min(1, -this.vel.y / 10) }); this.game.fx.splash(new THREE.Vector3(this.pos.x, water.surface, this.pos.z), 1.2); }

    if (this.noclip) return this._noclipMove(input, dt, fwd, right);

    const sprint = input.isDown('sprint') && !this.crouching && input.move.y > 0.1;
    let max = this.crouching ? SPEED.crouch : input.isDown('walk') ? SPEED.slow : sprint ? SPEED.sprint : SPEED.walk;
    if (this.inWater) max = SPEED.swim;
    _wish.set(0, 0, 0).addScaledVector(fwd, input.move.y).addScaledVector(right, input.move.x);
    const wishLen = Math.min(1, _wish.length());
    if (wishLen > 0) _wish.normalize();
    const wishSpeed = max * wishLen;

    if (this.inWater) {
      // swim: move along the look direction, Space rises, crouch sinks
      const look = this.camera.getWorldDirection(_v);
      const sw = new THREE.Vector3().addScaledVector(look, input.move.y).addScaledVector(right, input.move.x);
      if (sw.lengthSq() > 1) sw.normalize();
      sw.multiplyScalar(max);
      if (input.isDown('jump')) sw.y += 3.2;
      if (input.isDown('crouch')) sw.y -= 3;
      this.vel.lerp(sw, Math.min(1, dt * 4));
      this.vel.y -= 1.2 * dt;
      this.jumpBuffer = 0;
    } else if (this.onGround) {
      // friction
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const drop = Math.max(sp, 2.5) * 7.0 * dt;
        const k = Math.max(0, sp - drop) / sp;
        this.vel.x *= k; this.vel.z *= k;
      }
      this._accelerate(wishSpeed, 11, dt);
      if (this.jumpBuffer > 0 && this.coyote > 0) this._jump();
    } else {
      this._accelerate(Math.min(wishSpeed, 1.2), 70, dt);   // Quake-style air strafing
      if (this.jumpBuffer > 0 && this.coyote > 0) this._jump();
    }

    if (!this.inWater) this.vel.y -= GRAVITY * dt;
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // move with the controller
    const desired = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    if (this.groundBody && this.onGround) {
      const gv = this.groundBody.linvel?.();
      if (gv) { desired.x += gv.x * dt; desired.z += gv.z * dt; if (gv.y > 0) desired.y += gv.y * dt; }
    }
    this.cc.computeColliderMovement(this.collider, desired, R.QueryFilterFlags.EXCLUDE_SENSORS, GROUPS.player);
    const m = this.cc.computedMovement();
    const grounded = this.cc.computedGrounded();
    this.groundBody = null;
    for (let i = 0; i < this.cc.numComputedCollisions(); i++) {
      const col = this.cc.computedCollision(i);
      if (!col?.collider) continue;
      const n = col.normal1;
      if (n.y > 0.6) {
        const owner = this.game.physics.colliderOwner.get(col.collider.handle);
        this.groundSurface = owner?.surface || 'concrete';
        const b = col.collider.parent();
        if (b && !b.isFixed()) this.groundBody = b;
      } else if (n.y < -0.6 && this.vel.y > 0) {
        this.vel.y = 0;   // bonk the ceiling
      }
    }
    // velocity after collisions (so walls stop us instead of storing speed)
    if (dt > 0) {
      const ax = m.x / dt, az = m.z / dt;
      if (Math.abs(ax) < Math.abs(this.vel.x)) this.vel.x = ax;
      if (Math.abs(az) < Math.abs(this.vel.z)) this.vel.z = az;
    }
    if (grounded) {
      if (!this.onGround) this._land();
      this.coyote = 0.1;
      if (this.vel.y < 0) this.vel.y = -0.5;
    } else if (this.vel.y < 0) {
      this.fallSpeed = Math.max(this.fallSpeed, -this.vel.y);
    }
    this.onGround = grounded;
    this.pos.x += m.x; this.pos.y += m.y; this.pos.z += m.z;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });

    // footsteps
    const hs = Math.hypot(m.x, m.z);
    this.stats.distance += hs;
    if (grounded && hs > 0.001) {
      this.stepDist += hs;
      const stride = sprint ? 2.3 : this.crouching ? 1.4 : 1.75;
      if (this.stepDist > stride) {
        this.stepDist = 0;
        Audio.play('step', { surface: this.inWater ? 'water' : this.groundSurface, volume: this.crouching ? 0.25 : sprint ? 0.7 : 0.5 });
      }
      this.bobT += hs * (sprint ? 1.9 : 2.3);
    }
    this.bob += ((grounded ? Math.min(1, hs / dt / SPEED.sprint) : 0) - this.bob) * Math.min(1, dt * 8);
  }

  _accelerate(wishSpeed, accel, dt) {
    const cur = this.vel.x * _wish.x + this.vel.z * _wish.z;
    const add = wishSpeed - cur;
    if (add <= 0) return;
    const a = Math.min(add, accel * wishSpeed * dt);
    this.vel.x += _wish.x * a; this.vel.z += _wish.z * a;
  }

  _jump() {
    this.vel.y = this.crouching ? JUMP_V * 0.85 : JUMP_V;
    if (this.groundBody) { const gv = this.groundBody.linvel(); this.vel.y += Math.max(0, gv.y); }
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumps = (this.jumps || 0) + 1;
    Audio.play('jump', { volume: 0.5 });
  }

  _land() {
    const v = this.fallSpeed;
    this.fallSpeed = 0;
    if (v < 2) return;
    this.landDip = Math.min(0.18, v * 0.012);
    Audio.play('land', { intensity: Math.min(1, v / 14), surface: this.groundSurface });
    Audio.play('step', { surface: this.groundSurface, volume: 0.6 });
    // Fall damage (Source-like): safe up to ~13 m/s, then scales hard.
    if (v > 13.5 && !this.inWater) this.takeDamage((v - 13.5) * 9, { type: 'fall' });
  }

  _updateCrouch(want, dt) {
    if (want && !this.crouching) {
      this.crouching = true;
      this._setCapsule(CROUCH_HH);
      // crouch-jump tuck: lift feet while airborne so you clear ledges
      if (!this.onGround) { this.pos.y += (STAND_HH - CROUCH_HH) * 2; }
    } else if (!want && this.crouching) {
      // stand only if there is headroom
      const head = { x: this.pos.x, y: this.pos.y + CROUCH_HH * 2 + RADIUS * 2, z: this.pos.z };
      const hit = this.game.physics.raycast(head, { x: 0, y: 1, z: 0 }, (STAND_HH - CROUCH_HH) * 2 + 0.05, { excludeBody: this.body, groups: GROUPS.player });
      if (!hit) { this.crouching = false; this._setCapsule(STAND_HH); }
    }
    this.crouchT += ((this.crouching ? 1 : 0) - this.crouchT) * Math.min(1, dt * 12);
  }

  _noclipMove(input, dt, fwd, right) {
    const look = this.camera.getWorldDirection(_v).clone();
    const sp = input.isDown('sprint') ? SPEED.noclipFast : SPEED.noclip;
    const wish = new THREE.Vector3().addScaledVector(look, input.move.y).addScaledVector(right, input.move.x);
    if (input.isDown('jump')) wish.y += 1;
    if (input.isDown('crouch')) wish.y -= 1;
    if (wish.lengthSq() > 1) wish.normalize();
    this.vel.lerp(wish.multiplyScalar(sp), Math.min(1, dt * 6));
    this.pos.addScaledVector(this.vel, dt);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    this.onGround = false;
    this.fallSpeed = 0;
    void fwd;
  }

  setNoclip(on) {
    this.noclip = on;
    this.collider.setEnabled(!on);
    this.vel.set(0, 0, 0);
    Audio.play(on ? 'teleport' : 'ui_back', { volume: 0.4 });
  }

  toggleFlashlight() {
    if (!this.flashlight) {
      this.flashlight = new THREE.SpotLight(0xfff4e0, 30, 40, 0.42, 0.45, 1.6);
      this.flashlight.castShadow = false;
      this.camera.add(this.flashlight);
      this.camera.add(this.flashlight.target);
      this.flashlight.position.set(0.25, -0.2, 0);
      this.flashlight.target.position.set(0, 0, -5);
    }
    this.flashOn = !this.flashOn;
    this.flashlight.visible = this.flashOn;
    Audio.play('button', { volume: 0.5 });
  }

  takeDamage(amount, info = {}) {
    if (!this.alive || this.godMode || this.noclip) return;
    const diff = DIFFICULTY[settings.difficulty] || DIFFICULTY.normal;
    let dmg = amount * (info.type === 'fall' ? 1 : diff.damageTaken);
    if (this.armor > 0 && info.type !== 'fall' && info.type !== 'drown') {
      const absorbed = Math.min(this.armor, dmg * 0.8);
      this.armor -= absorbed;
      dmg -= absorbed;
    }
    this.health -= dmg;
    this.hurtFlash = Math.min(1, this.hurtFlash + dmg / 30);
    this.game.renderer.addShake(Math.min(0.6, dmg / 40));
    this.game.hud?.damageFrom(info.from);
    this.game.rumble?.(Math.min(1, dmg / 30), 0.4, 200);
    Audio.play('hurt', { volume: Math.min(1, 0.4 + dmg / 30) });
    if (info.force) this.vel.add(info.force);
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      Audio.play('flatline');
      this.game.onPlayerDeath?.(info);
    }
  }

  heal(n) { const before = this.health; this.health = Math.min(this.maxHealth, this.health + n); return this.health > before; }
  addArmor(n) { const before = this.armor; this.armor = Math.min(100, this.armor + n); return this.armor > before; }

  /** Place the camera: interpolated feet + eye height, bob, landing dip. */
  updateCamera(alpha, dt) {
    if (this.vehicle) return;
    const p = _v.lerpVectors(this.prevPos, this.pos, alpha);
    const eye = STAND_EYE + (CROUCH_EYE - STAND_EYE) * this.crouchT;
    this.landDip = Math.max(0, this.landDip - dt * 0.8);
    const bobOn = settings.viewBob ? 1 : 0;
    const by = Math.abs(Math.sin(this.bobT)) * 0.045 * this.bob * bobOn;
    const bx = Math.cos(this.bobT) * 0.02 * this.bob * bobOn;
    this.camera.position.set(p.x, p.y + eye - by - this.landDip, p.z);
    const [, right] = this.rig.basis();
    this.camera.position.addScaledVector(right, bx);
    this.camera.rotation.set(this.rig.pitch, this.rig.yaw, 0, 'YXZ');
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
  }

  dispose() {
    const w = this.game.physics.world;
    w.removeCharacterController(this.cc);
    this.game.physics.unregister(this.collider);
    w.removeRigidBody(this.body);
    if (this.flashlight) { this.camera.remove(this.flashlight, this.flashlight.target); this.flashlight.dispose(); this.flashlight = null; }
  }
}
