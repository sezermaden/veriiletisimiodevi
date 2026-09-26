// Over-the-shoulder aim camera. The crosshair is the screen centre; the camera looks at a point
// above the player's head so the character sits below the crosshair. Collision follows the
// game-build rules: ray from the chest (never the feet), smooth the boom LENGTH not the position,
// pull in fast / push out slow, snap() on spawn.
import * as THREE from 'three';
import { settings } from '../engine/settings.js';

const _f = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _want = new THREE.Vector3();
const _hc = new THREE.Vector3();
const _to = new THREE.Vector3();

export class AimCamera {
  constructor(camera, session) {
    this.camera = camera;
    this.session = session;
    this.yaw = 0;
    this.pitch = -0.12;
    this.minPitch = -1.25;
    this.maxPitch = 1.05;
    this.baseDistance = 4.1;
    this.lift = 0.62;           // look point above the focus → character below the crosshair
    this.focusH = 1.3;
    this._dist = this.baseDistance;
    this._focusH = 1.3;
    this.trauma = 0;
    this.fovKick = 0;
    this.override = null;       // cutscene camera: { position, target } when set
    this.recenterT = 0;
    this.aimTarget = null;
  }

  get forward() {
    const cp = Math.cos(this.pitch);
    return _f.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  snap(player) {
    this.yaw = player.yaw + Math.PI;
    this.pitch = -0.12;
    this._focusH = player.form === 'squid' ? 0.75 : 1.3;
    this._dist = this.baseDistance;
    this._place(player, 1);
  }

  recenter(player) { this.recenterT = 0.25; this._recenterYaw = player.yaw + Math.PI; }

  addTrauma(t) { this.trauma = Math.min(1, this.trauma + t); }

  /** Per rendered frame. */
  update(input, dt, player) {
    const S = this.session;
    if (this.override) {
      this.camera.position.copy(this.override.position);
      this.camera.lookAt(this.override.target);
      this.trauma = Math.max(0, this.trauma - dt * 1.5);
      return;
    }
    // splat cam: drift above the splat point and look toward whoever did it
    if (!player.alive) {
      if (!this._deathPos) { this._deathPos = player.position.clone(); this._deathLook = this.camera.position.clone().add(this.forward.clone().multiplyScalar(5)); }
      const src = player.lastAttacker?.position;
      const look = src ? _hc.copy(src).setY(src.y + 0.8) : this._deathLook;
      _want.copy(this._deathPos).add(_to.set(0, 3.2, 0)).addScaledVector(_f.subVectors(this._deathPos, look).setY(0).normalize(), 4.5);
      this.camera.position.lerp(_want, 1 - Math.exp(-3 * dt));
      this.camera.lookAt(look);
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      return;
    }
    this._deathPos = null;
    // look
    let lx = input.look.x, ly = input.look.y;
    if (input.lastDevice === 'gamepad' && settings.get('controls.aimAssist') && this.aimTarget) { lx *= 0.55; ly *= 0.55; }
    if (!player.frozen) {
      this.yaw -= lx;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + ly));
    }
    if (input.justPressed('recenter')) this.recenter(player);
    if (this.recenterT > 0) {
      this.recenterT -= dt;
      let d = ((this._recenterYaw - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 18);
      this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 18);
    }
    const wantH = player.form === 'squid' ? (player.climbing ? 1.0 : 0.75) : 1.3;
    this._focusH += (wantH - this._focusH) * Math.min(1, dt * 8);

    // FOV kick while swimming fast
    const fovBase = settings.get('video.fov') || 72;
    const hs = Math.hypot(player.velocity.x, player.velocity.z);
    const kick = player.submerged && hs > 6 ? 6 : 0;
    this.fovKick += (kick - this.fovKick) * Math.min(1, dt * 5);
    const fov = fovBase + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    this._place(player, dt);

    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const sh = this.trauma * this.trauma * (settings.get('video.cameraShake') ?? 1);
    if (sh > 0.001) {
      const t = performance.now() * 0.001;
      this.camera.position.x += (Math.sin(t * 47.3) + Math.sin(t * 91.1)) * 0.09 * sh;
      this.camera.position.y += (Math.sin(t * 53.7) + Math.sin(t * 77.9)) * 0.09 * sh;
      this.camera.rotation.z += Math.sin(t * 61.3) * 0.03 * sh;
    }
    this.computeAim(player);
    void S;
  }

  _place(player, dt) {
    const level = this.session.level;
    const fwd = this.forward;
    // pivot: chest height + lift, never the feet (a ray from the feet self-intersects the floor)
    _pivot.copy(player.position);
    _pivot.y += this._focusH + this.lift;
    const want = this.baseDistance;
    const back = _to.copy(fwd).negate();
    let clear = want;
    if (this.legacy) {
      // negative-control only: the old rig cast from the FEET and snapped the boom unsmoothed
      const feet = player.position.clone();
      const hit = level?.raycast(feet, back, want + 0.4, { staticOnly: false });
      this._dist = hit ? Math.max(0.4, Math.min(want, hit.distance - 0.35)) : want;
    } else {
      if (level) {
        const hit = level.raycast(_pivot, back, want + 0.4, { staticOnly: false });
        // floor 1.2 m: close enough to stay in front of a wall / under a low platform (a 2 m floor
        // pushed the camera through them), far enough to never enter Kai's head
        if (hit) clear = Math.max(1.2, Math.min(want, hit.distance - 0.35));
      }
      // pull in fast (or it clips through walls), push out slowly (or every gap fires it backwards)
      this._dist += (clear - this._dist) * Math.min(1, dt * (clear < this._dist ? 22 : 2.6));
    }
    _want.copy(_pivot).addScaledVector(back, this._dist);
    this.camera.position.copy(_want);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Crosshair ray → player.aim (dir + point), actors included. */
  computeAim(player) {
    const S = this.session;
    const cam = this.camera;
    const dir = player.aim.dir.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    player.aim.origin.copy(cam.position);
    player.aimPitch = this.pitch;
    let best = 60;
    let target = null;
    const hit = S.level?.raycast(cam.position, dir, 60);
    if (hit) best = hit.distance;
    let assistBest = 0.07, assist = null;
    for (const a of S.actors) {
      if (!a.alive || a.team === player.team || a.untargetable) continue;
      a.hitCenter(_hc);
      _to.subVectors(_hc, cam.position);
      const along = _to.dot(dir);
      if (along < 1 || along > best) continue;
      const perp = Math.sqrt(Math.max(0, _to.lengthSq() - along * along));
      if (perp < a.hitRadius + 0.1) { best = along; target = a; }
      const ang = perp / along;
      if (ang < assistBest && along < 28) { assistBest = ang; assist = a; }
    }
    this.aimTarget = target || assist;
    player.aim.point.copy(cam.position).addScaledVector(dir, Math.max(best, 2));
    player.aim.target = target;
  }
}
