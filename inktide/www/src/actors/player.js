// The player: kid ↔ squid movement, swimming in own ink, climbing inked walls, ink tank, health,
// weapons, splat & respawn. Physics runs in fixed steps driven by the session; edge-triggered
// input is latched once per frame by latchInput() (never read inside step()).
import * as THREE from 'three';
import { SquidkinModel } from './squidkin-model.js';
import { createKit } from '../weapons/base.js';
import { TEAM_HERO, TEAM_MURK, TEAM_NONE } from '../ink/ink-system.js';
import { makeContacts } from '../world/level.js';
import { settings } from '../engine/settings.js';
import { charMat } from './materials.js';
import { disposeTree } from '../engine/dispose.js';

const _wish = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _pr = new THREE.Vector3();
const STEP = 0.46;            // tallest ledge the kid/squid walks up without jumping

export const PLAYER_TUNING = {
  runSpeed: 5.6,
  swimSpeed: 10.2,
  hopSpeed: 2.3,
  enemyInkMul: 0.36,
  climbSpeed: 7.4,
  jumpKid: 7.6,
  jumpSquid: 9.9,
  jumpEnemyInk: 5.0,
  gravity: 24,
  maxFall: 32,
  groundAccel: 60,
  swimAccel: 48,
  airAccel: 15,
  kidRadius: 0.3,
  kidHeight: 1.35,
  squidRadius: 0.28,
  inkMax: 100,
  refillSwim: 38,
  refillKid: 7,
  refillSquid: 5,
  regenDelay: 1.2,
  regenSwim: 60,
  regenIdle: 26,
  enemyInkDps: 20,
  enemyInkFloor: 30,
  coyote: 0.1,
  respawnTime: 2.6,
};

export class Player {
  constructor(session, opts = {}) {
    this.session = session;
    this.team = opts.team ?? TEAM_HERO;
    this.enemyTeam = this.team === TEAM_HERO ? TEAM_MURK : TEAM_HERO;
    this.isPlayer = !opts.isBot;
    this.isBot = !!opts.isBot;
    this.name = opts.name || 'Kai';
    const up = opts.upgrades || {};
    this.T = { ...PLAYER_TUNING };
    this.T.inkMax = 100 + (up.tank || 0) * 12;
    this.T.swimSpeed *= 1 + (up.swim || 0) * 0.05;
    this.maxHp = 100 + (up.armor || 0) * 10;
    this.specialMul = 1 + (up.special || 0) * 0.12;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.form = 'kid';
    this.submerged = false;
    this.climbing = false;
    this.grounded = false;
    this.wasGrounded = false;
    this.groundFace = -1;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.groundInk = TEAM_NONE;
    this.contacts = makeContacts();
    this.coyote = 0;
    this.hp = this.maxHp;
    this.ink = this.T.inkMax;
    this.inkMax = this.T.inkMax;
    this.special = 0;
    this.alive = true;
    this.invulnerable = 0;
    this.sinceDamage = 10;
    this.sinceFire = 10;
    this.respawnT = 0;
    this.hitRadius = 0.42;
    this.hitHeight = 1.3;
    this.untargetable = false;
    this.lowInkT = 0;
    this.landImpact = 0;
    this.enemyInkT = 0;
    this.swimToggled = false;
    this.frozen = false;            // cutscenes / results
    this.aim = { dir: new THREE.Vector3(0, 0, -1), point: new THREE.Vector3(), origin: new THREE.Vector3() };
    this.aimPitch = 0;

    // latched edges (set per frame, consumed in step)
    this.jumpBuffer = 0;
    this.subBuffer = 0;
    this.specialBuffer = 0;
    this.firePressed = false;

    this.model = new SquidkinModel({ inkColor: session.ink.color(this.team), look: opts.look });
    session.scene.add(this.model.root);
    this._buildSwimBump();

    this.kitId = opts.kit || 'splash-blaster';
    this.kit = createKit(this, this.kitId);

    session.ink.onPaint((team, m2, source) => {
      if (source === this && team === this.team && !this.kit.special?.active) this.addSpecial(m2 * 1.35 * this.specialMul);
    });
  }

  get inkColor() { return this.session.ink.color(this.team); }

  _buildSwimBump() {
    // glossy bulge in the ink that shows where the submerged squid is
    const g = new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this.bumpMat = charMat(this.inkColor, { ink: true, rim: 0.6, transparent: true, opacity: 0.9 });
    this.bump = new THREE.Mesh(g, this.bumpMat);
    this.bump.scale.set(1, 0.32, 1.5);
    this.bump.visible = false;
    this.session.scene.add(this.bump);
  }

  setKit(kitId) {
    for (const k of ['main', 'sub', 'special']) this.kit[k]?.dispose?.();
    this.kitId = kitId;
    this.kit = createKit(this, kitId);
  }

  spawn(pos, yaw = 0) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.hp = this.maxHp;
    this.ink = this.inkMax;
    this.alive = true;
    this.form = 'kid';
    this.climbing = false;
    this.submerged = false;
    this.invulnerable = 1.5;
    this.model.setForm('kid', true);
    this.model.root.visible = true;
    this.model.root.position.copy(pos);
    this.model.root.rotation.y = yaw;
    this.model._prevPos.copy(pos);
    this.kit.special?.end?.();
  }

  hitCenter(out) { return out.copy(this.position).setY(this.position.y + (this.form === 'squid' ? 0.3 : 0.7)); }

  useInk(n) {
    if (this.ink < n) { this.lowInkT = 0.8; return false; }
    this.ink -= n;
    this.sinceFire = 0;
    return true;
  }

  onOutOfInk() {
    if (this.lowInkT <= 0) this.session.audio?.sfx('empty', { volume: 0.5 });
    this.lowInkT = 0.8;
  }

  addSpecial(points) {
    if (this.special >= 100) return;
    this.special = Math.min(100, this.special + points);
    if (this.special >= 100 && this.isPlayer) {
      this.session.audio?.sfx('ready', { volume: 0.8 });
      this.session.hud?.toast('Special ready!', 'normal');
    }
  }

  damage(amount, info = {}) {
    if (!this.alive || this.invulnerable > 0 || this.frozen) return false;
    if (this.session.godMode && this.isPlayer) return false;
    this.hp -= amount;
    this.sinceDamage = 0;
    this.lastAttacker = info.source || null;
    if (this.isPlayer) {
      this.session.hud?.damageFlash(Math.min(1, amount / 50), info.dir);
      this.session.audio?.sfx('hurt', { volume: 0.7 });
      this.session.input?.rumble(0.6, 0.3, 120);
    }
    this.onDamaged?.(amount, info);
    if (this.hp <= 0) this.splat(info);
    return true;
  }

  splat(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.respawnT = this.T.respawnTime;
    const S = this.session;
    const color = S.ink.color(info.team ?? this.enemyTeam);
    S.fx.explosion(this.hitCenter(_v), _up, color, 1.8);
    S.fx.burst(_v, _up, this.inkColor, 20, 6);
    S.audio?.sfx('splat_death', { volume: this.isPlayer ? 1 : 0.7, pos: this.isPlayer ? undefined : this.position });
    if (this.isPlayer) S.input?.rumble(1, 1, 400);
    this.model.root.visible = false;
    this.bump.visible = false;
    this.kit.main.cancel();
    this.kit.special?.end?.();
    S.events.emit(this.isPlayer ? 'playerSplatted' : 'botSplatted', { who: this, by: info.source });
    S.events.emit('actorDefeated', { actor: this, by: info.source });
  }

  /** Once per rendered frame, before the fixed steps. */
  latchInput(input) {
    if (this.frozen) return;
    if (input.justPressed('jump')) this.jumpBuffer = 0.15;
    if (input.justPressed('sub')) this.subBuffer = 0.15;
    if (input.justPressed('special')) this.specialBuffer = 0.15;
    if (input.justPressed('fire')) this.firePressed = true;
    if (settings.get('controls.swimToggle') && input.justPressed('swim')) this.swimToggled = !this.swimToggled;
  }

  decayBuffers(dt) {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.subBuffer = Math.max(0, this.subBuffer - dt);
    this.specialBuffer = Math.max(0, this.specialBuffer - dt);
  }

  // -------------------------------------------------------------------------------------------
  step(dt, input, camYaw) {
    const T = this.T, S = this.session, ink = S.ink;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.lowInkT = Math.max(0, this.lowInkT - dt);
    this.sinceDamage += dt;
    this.sinceFire += dt;

    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { if (this.isPlayer) S.respawnPlayer(); else this.onRespawn?.(); }
      this.decayBuffers(dt);
      return;
    }
    if (this.frozen) {
      this.velocity.x = 0; this.velocity.z = 0;
      this._integrate(dt, false);
      this.decayBuffers(dt);
      return;
    }

    // negative-control only: the old bug read edges inside the fixed step
    if (S.legacyEdges && input.justPressed('jump')) this.jumpBuffer = 0.15;

    // ---- intent ----
    _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    _wish.set(0, 0, 0).addScaledVector(_fwd, input.move.y).addScaledVector(_right, input.move.x);
    const wishLen = Math.min(1, _wish.length());
    if (wishLen > 1e-3) _wish.normalize();

    const special = this.kit.special;
    const specialActive = !!special?.active;
    const fireHeld = input.isDown('fire') && !(specialActive && special.blocksFire);
    let swimHeld = settings.get('controls.swimToggle') ? this.swimToggled : input.isDown('swim');
    if (fireHeld) { swimHeld = false; this.swimToggled = false; }
    if (specialActive && special.drivesMovement) swimHeld = false;
    const newForm = swimHeld ? 'squid' : 'kid';
    if (newForm !== this.form) this._changeForm(newForm);

    // ---- ink under us ----
    const onDynamic = this.contacts.dynamic;
    this.groundInk = this.grounded && this.groundFace >= 0 ? ink.inkAt(this.groundFace, this.position) : TEAM_NONE;
    const onOwn = this.groundInk === this.team;
    const onEnemy = this.groundInk === this.enemyTeam && this.grounded;
    const squid = this.form === 'squid';

    // ---- climbing ----
    if (squid && this.contacts.wall && this.contacts.wallFace >= 0 && !specialActive) {
      const wallN = this.contacts.wallNormal;
      _a.copy(this.position).setY(this.position.y + 0.3);
      const wallInk = ink.inkAt(this.contacts.wallFace, _a.addScaledVector(wallN, -0.3));
      const into = -_wish.dot(wallN) * wishLen;
      if (wallInk === this.team && (this.climbing || into > 0.3)) {
        if (!this.climbing) { S.audio?.sfx('dive', { volume: 0.35, pitch: 1.3 }); }
        this.climbing = true;
        this.climbNormal = (this.climbNormal || new THREE.Vector3()).copy(wallN).setY(0).normalize();
      } else if (this.climbing && wallInk !== this.team) {
        this.climbing = false;
      }
    } else if (this.climbing) {
      // lost the wall: if we were going up we reached the top → pop over the ledge
      if (squid && this.velocity.y > 1) {
        this.velocity.y = 6.8;
        this.velocity.addScaledVector(this.climbNormal, -3.2);
        S.fx.burst(this.position, _up, this.inkColor, 10, 4);
        S.audio?.sfx('splash', { volume: 0.5 });
      }
      this.climbing = false;
    }
    if (!squid) this.climbing = false;

    this.submerged = squid && ((onOwn && !onDynamic) || this.climbing);

    // weapons that change movement (dualies dodge roll) get a look before movement consumes jump
    this.kit.main.preMove?.(dt, { firing: this.kit.main.firing, wish: _wish, wishLen });

    // ---- velocity ----
    const v = this.velocity;
    if (specialActive && special.drivesMovement) {
      special.update(dt, { fire: fireHeld, firePressed: this.firePressed, jumpPressed: this.jumpBuffer > 0 });
    } else if (this.kit.main.drivesMovement) {
      // e.g. a dualies dodge roll: the weapon sets this.velocity itself; only gravity applies here
      if (!this.grounded) v.y = Math.max(-T.maxFall, v.y - T.gravity * dt);
    } else if (this.climbing) {
      const n = this.climbNormal;
      const into = -_wish.dot(n) * wishLen;
      _a.crossVectors(_up, n).normalize();                         // lateral axis along the wall
      const lateral = _wish.dot(_a) * wishLen;
      const targetUp = into > 0.15 ? T.climbSpeed * into : (into < -0.15 ? T.climbSpeed * into : -0.6);
      v.y += (targetUp - v.y) * Math.min(1, dt * 14);
      const lat = lateral * T.climbSpeed * 0.7;
      const cur = v.dot(_a);
      v.addScaledVector(_a, (lat - cur) * Math.min(1, dt * 14));
      // hug the wall
      const nv = v.dot(n);
      v.addScaledVector(n, -nv - 2.2);
      if (this.jumpBuffer > 0) {
        this.jumpBuffer = 0;
        this.climbing = false;
        v.copy(n).multiplyScalar(5.5).setY(8.5);
        S.fx.burst(this.position, n, this.inkColor, 10, 4);
        S.audio?.sfx('jump', { volume: 0.5, pitch: 1.2 });
      }
      // ink-cost-free swimming refills
    } else {
      let speed;
      if (squid) speed = this.submerged ? T.swimSpeed : T.hopSpeed;
      else speed = T.runSpeed * this.kit.main.moveMul;
      if (onEnemy) speed *= T.enemyInkMul;
      // airborne: never steer below the take-off speed (a squid leap out of ink keeps its swim
      // momentum instead of decaying toward the dry-hop speed)
      if (!this.grounded) speed = Math.max(speed, this.airSpeed || 0);
      const accel = this.grounded ? (this.submerged ? T.swimAccel : T.groundAccel) : T.airAccel;
      const tx = _wish.x * speed * wishLen, tz = _wish.z * speed * wishLen;
      const k = Math.min(1, (accel * dt) / Math.max(0.001, speed));
      if (this.grounded || wishLen > 0.01) {
        v.x += (tx - v.x) * Math.min(1, k * (this.grounded ? 1 : 0.8));
        v.z += (tz - v.z) * Math.min(1, k * (this.grounded ? 1 : 0.8));
      }
      // jump
      if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
        this.jumpBuffer = 0;
        this.coyote = 0;
        const jv = onEnemy ? T.jumpEnemyInk : (this.submerged ? T.jumpSquid : T.jumpKid);
        v.y = jv;
        this.grounded = false;
        if (this.submerged) {
          S.fx.burst(this.position, _up, this.inkColor, 14, 5);
          S.fx.ring(this.position, _up, this.inkColor, 1, 0.4);
          S.audio?.sfx('splash', { volume: 0.6, pitch: 1.1 });
        } else S.audio?.sfx('jump', { volume: 0.45 });
      }
      if (!this.grounded) v.y = Math.max(-T.maxFall, v.y - T.gravity * dt);
    }

    this._integrate(dt, this.climbing || (specialActive && special.drivesMovement && this.velocity.y > 0));
    if (this.grounded || this.climbing) this.airSpeed = Math.min(T.swimSpeed * 1.1, Math.hypot(v.x, v.z));

    // ---- enemy ink, refill, regen ----
    if (onEnemy && !this.submerged) {
      this.enemyInkT += dt;
      if (this.hp > T.enemyInkFloor && this.invulnerable <= 0) {
        this.hp = Math.max(T.enemyInkFloor, this.hp - T.enemyInkDps * dt);
        this.sinceDamage = 0;
      }
    } else this.enemyInkT = 0;

    const firing = this.kit.main.firing;
    if (this.submerged) this.ink = Math.min(this.inkMax, this.ink + T.refillSwim * dt);
    else if (squid) this.ink = Math.min(this.inkMax, this.ink + T.refillSquid * dt);
    else if (!firing && this.sinceFire > 0.6) this.ink = Math.min(this.inkMax, this.ink + T.refillKid * dt);

    if (this.sinceDamage > T.regenDelay && this.hp < this.maxHp && !onEnemy) {
      this.hp = Math.min(this.maxHp, this.hp + (this.submerged ? T.regenSwim : T.regenIdle) * dt);
    }

    // ---- facing ----
    const aimingNow = !squid && (fireHeld || this.sinceFire < 0.45 || this.kit.main.charge > 0);
    this.aiming = aimingNow;
    if (aimingNow) this.yaw = lerpAngle(this.yaw, camYaw + Math.PI, Math.min(1, dt * 22));
    else if (Math.hypot(v.x, v.z) > 0.4 && !this.climbing) this.yaw = lerpAngle(this.yaw, Math.atan2(v.x, v.z), Math.min(1, dt * 12));
    else if (this.climbing) this.yaw = Math.atan2(-this.climbNormal.x, -this.climbNormal.z);

    // ---- weapons ----
    const canFire = !squid && this.alive;
    this.kit.main.update(dt, { fire: canFire && fireHeld, firePressed: canFire && this.firePressed });
    if (squid && this.kit.main.firing) this.kit.main.cancel();
    if (this.subBuffer > 0 && !squid && !specialActive) {
      this.subBuffer = 0;
      const sub = this.kit.sub;
      if (sub && this.ink >= sub.cost) {
        if (sub.use()) { this.ink -= sub.cost; this.sinceFire = 0; }
      } else { this.onOutOfInk(); }
    }
    this.kit.sub?.update?.(dt);
    if (this.specialBuffer > 0) {
      this.specialBuffer = 0;
      if (this.special >= 100 && !specialActive && special) {
        this.special = 0;
        if (this.form === 'squid') this._changeForm('kid');
        special.activate();
        S.events.emit('special', { who: this, id: this.kit.def.special });
        this.ink = this.inkMax;
      }
    }
    if (special?.active && !special.drivesMovement) special.update(dt, { fire: fireHeld, firePressed: this.firePressed, jumpPressed: false });
    this.firePressed = false;

    // ---- fall out of the world ----
    if (this.position.y < S.level.killY) {
      S.fx.burst(this.position.clone().setY(S.level.killY + 1), _up, '#ffffff', 16, 6);
      this.splat({ team: this.enemyTeam, kind: 'fall' });
    }
  }

  _changeForm(form) {
    const S = this.session;
    this.form = form;
    this.model.setForm(form);
    if (form === 'squid') {
      this.kit.main.cancel();
      S.audio?.sfx(this.groundInk === this.team ? 'dive' : 'squish', { volume: 0.55 });
      if (this.groundInk === this.team && this.grounded) {
        S.fx.burst(this.position, _up, this.inkColor, 12, 3.5, { size: 0.06 });
        S.fx.ring(this.position, _up, this.inkColor, 0.9, 0.35);
      }
    } else {
      this.climbing = false;
      S.audio?.sfx('emerge', { volume: 0.45 });
      if (this.submerged) S.fx.burst(this.position, _up, this.inkColor, 10, 3.5, { size: 0.06 });
    }
  }

  _integrate(dt, noSnap) {
    const T = this.T, S = this.session, level = S.level, v = this.velocity;
    const squid = this.form === 'squid';
    const r = squid ? T.squidRadius : T.kidRadius;
    const top = squid ? r + 0.05 : T.kidHeight - r;
    const vyBefore = v.y;
    this.wasGrounded = this.grounded;

    // carried by a moving platform
    if (this.grounded && this.contacts.dynamic?.owner?.lastDelta) this.position.add(this.contacts.dynamic.owner.lastDelta);

    const startX = this.position.x, startY = this.position.y, startZ = this.position.z;
    const move = _v.copy(v).multiplyScalar(dt);
    const steps = Math.max(1, Math.ceil(move.length() / (r * 0.6)));
    move.divideScalar(steps);
    let ground = false, wall = false, ceiling = false;
    for (let i = 0; i < steps; i++) {
      this.position.add(move);
      _a.copy(this.position).setY(this.position.y + r);
      _b.copy(this.position).setY(this.position.y + top);
      const c = level.collideCapsule(_a, _b, r, this.contacts);
      this.position.x = _a.x; this.position.z = _a.z; this.position.y = _a.y - r;
      ground = ground || c.ground; wall = wall || c.wall; ceiling = ceiling || c.ceiling;
    }
    const c = this.contacts;
    // step up small ledges and stair treads: look just past the front of the capsule along the
    // direction of travel; if there is walkable ground no higher than STEP, rise toward it over a
    // few steps (smooth for the camera) and keep our momentum
    let stepping = false;
    const hsp = Math.hypot(v.x, v.z);
    if (this.wasGrounded && !this.climbing && hsp > 0.3 && v.y <= 0.5) {
      const inv = 1 / hsp;
      const fx = this.position.x + v.x * inv * (r + 0.08), fz = this.position.z + v.z * inv * (r + 0.08);
      const h = level.raycast(_pr.set(fx, this.position.y + STEP + 0.1, fz), _down, STEP + 0.15);
      const rise = h && h.normal.y > 0.6 ? h.point.y - this.position.y : 0;
      if (rise > 0.03 && rise <= STEP) {
        this.position.y += Math.min(rise, Math.max(0.08, hsp * dt * 1.8));
        stepping = true;
        ground = true;
      }
    }
    if (ceiling && v.y > 0) v.y = 0;
    if (wall && !this.climbing && !stepping) {
      const vn = v.dot(c.wallNormal);
      if (vn < 0) v.addScaledVector(c.wallNormal, -vn);
    }

    // ground probe + snap (keeps us glued to ramps and stops slope creep)
    let groundHit = null;
    if (!noSnap && !stepping && v.y <= 0.5) {
      const snap = this.wasGrounded ? 0.42 : 0.06;
      groundHit = this._probeGround(this.position.x, this.position.y, this.position.z, r, 0.45, snap);
      if (groundHit && groundHit.normal.y > 0.6) {
        // rest the capsule's sphere ON the slope (centre r/ny above the hit point), not in it —
        // snapping the feet to the hit point pushes the sphere into steep ramps and the collision
        // response then shoves us back downhill every step (the "crawl up 30° ramps" bug)
        this.position.y = groundHit.point.y + r * (1 / groundHit.normal.y - 1);
        ground = true;
      } else groundHit = null;
    }
    if (ground && v.y <= 0.5) {
      this.grounded = true;
      if (groundHit) { this.groundFace = groundHit.faceId; this.groundNormal.copy(groundHit.normal); c.dynamic = groundHit.dynamic || null; }
      else { this.groundFace = c.groundFace; this.groundNormal.copy(c.groundNormal); }
      if (v.y < 0) v.y = 0;
    } else {
      this.grounded = false;
      this.groundFace = -1;
    }
    if (this.grounded) this.coyote = T.coyote; else this.coyote = Math.max(0, this.coyote - dt);

    // landing impact for animation / fx
    if (this.grounded && !this.wasGrounded && vyBefore < -7) {
      this.landImpact = Math.min(1, -vyBefore / 20);
      S.audio?.sfx(this.form === 'squid' ? 'splash' : 'land', { volume: Math.min(0.7, 0.2 + this.landImpact) });
      if (this.groundInk === this.team || S.ink.inkAt(this.groundFace, this.position) === this.team) S.fx.burst(this.position, _up, this.inkColor, 8, 3);
    }
  }

  /**
   * Highest walkable ground under the capsule footprint (centre + 4 points at 0.7 r), searched
   * from `above` metres over the feet down to `below` metres under them. A single centre ray
   * misses stair treads and ledge lips the sphere is already resting on.
   */
  _probeGround(x, y, z, r, above, below) {
    const level = this.session.level;
    let best = null;
    const o = r * 0.95;
    const P = this._probeOffsets || (this._probeOffsets = [[0, 0], [o, 0], [-o, 0], [0, o], [0, -o]]);
    for (let i = 0; i < P.length; i++) {
      const h = level.raycast(_pr.set(x + P[i][0], y + above, z + P[i][1]), _down, above + below);
      if (!h || h.normal.y < 0.6 || h.point.y > y + 0.05) continue;   // never snap UP onto kerbs
      if (!best || h.point.y > best.point.y + 1e-4 || (i === 0 && Math.abs(h.point.y - best.point.y) < 1e-4)) best = h;
    }
    return best;
  }

  /** Per rendered frame: model, swim bump, ripples. */
  render(dt) {
    const m = this.model;
    const S = this.session;
    m.root.position.copy(this.position);
    m.root.rotation.y = this.yaw;
    if (this.climbing && this.form === 'squid') m.root.position.addScaledVector(this.climbNormal, 0.05);
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    m.update(dt, {
      speed: this.climbing ? Math.abs(this.velocity.y) : hs,
      grounded: this.grounded || this.climbing,
      vy: this.velocity.y,
      aiming: this.aiming,
      aimPitch: this.aimPitch,
      firing: this.kit.main.firing,
      recoil: this.kit.main.recoil,
      submerged: this.submerged,
      climbing: this.climbing,
      inkLevel: this.ink / this.inkMax,
      landed: this.landImpact,
      hidden: !this.alive,
    });
    this.landImpact = 0;

    // submerged: hide the squid, show a glossy bulge + ripples when moving
    const b = this.bump;
    if (this.alive && this.submerged) {
      const moving = hs > 1 || Math.abs(this.velocity.y) > 1;
      b.visible = true;
      this.bumpMat.color.copy(this.inkColor);
      this.bumpMat.emissive.copy(this.inkColor);
      if (this.climbing) {
        b.position.copy(this.position).setY(this.position.y + 0.3).addScaledVector(this.climbNormal, 0.02);
        b.quaternion.setFromUnitVectors(_up, this.climbNormal);
      } else {
        b.position.copy(this.position).addScaledVector(this.groundNormal, 0.005);
        b.quaternion.setFromUnitVectors(_up, this.groundNormal);
        b.rotateY(this.yaw);
      }
      const target = moving ? 1 : 0.55;
      b.scale.x += (target - b.scale.x) * Math.min(1, dt * 10);
      b.scale.z = b.scale.x * (moving ? 1.6 : 1.2);
      b.scale.y = 0.18 + (moving ? 0.1 + Math.sin(performance.now() * 0.02) * 0.04 : 0.02);
      this._ripT = (this._ripT || 0) - dt;
      if (moving && this._ripT <= 0) {
        this._ripT = 0.09;
        S.fx.ring(b.position, this.climbing ? this.climbNormal : this.groundNormal, this.inkColor, 0.7, 0.4);
        if (Math.random() < 0.5) S.fx.burst(b.position, this.climbing ? this.climbNormal : this.groundNormal, this.inkColor, 2, 2.2, { size: 0.04, life: 0.3 });
        if (!this.climbing) this._swimSfxT = (this._swimSfxT || 0) - 0.09;
        if (this._swimSfxT <= 0 && this.isPlayer) { this._swimSfxT = 0.32; S.audio?.sfx('swim', { volume: 0.18, pitch: 0.9 + Math.random() * 0.3 }); }
      }
    } else b.visible = false;

    if (this.kit.main.model) this.kit.main.model.visible = this.form === 'kid';
  }

  dispose() {
    this.session.scene.remove(this.model.root);
    this.session.scene.remove(this.bump);
    disposeTree(this.bump);
    this.model.dispose();
    for (const k of ['main', 'sub', 'special']) this.kit[k]?.dispose?.();
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
