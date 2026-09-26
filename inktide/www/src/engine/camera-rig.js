/**
 * camera-rig.js — the one place that turns movement intent into world motion.
 *
 * Why this exists: "left/right and forward/back are inverted" comes from hand-writing direction
 * vectors. three.js cameras look down local -Z, so forward is `-Z` of the yaw rotation and right
 * is `+X` of it. Written once, tested, never written again. Yaw is applied on a Y-only rotation
 * so that looking up does not slow you down or tilt your movement into the ground.
 *
 * Three rigs, one interface:
 *   FPSRig          — camera IS the player's eyes
 *   ThirdPersonRig  — camera orbits a target at a distance, with collision-free spring damping
 *   TopDownRig      — fixed angle above a target, look input rotates the frame (twin-stick)
 *
 *   const rig = new FPSRig(camera, { eyeHeight: 1.7 });
 *   rig.update(input, dt);          // reads input.move / input.look
 *   rig.position                    // player position, for physics/collision
 */
import * as THREE from 'three';

const HALF_PI = Math.PI / 2;
const PITCH_LIMIT = HALF_PI - 0.01;   // never exactly ±90°: the up vector degenerates there

/** Shared yaw/pitch state and the forward/right basis every rig uses. */
class BaseRig {
  constructor(camera, opts = {}) {
    this.camera = camera;
    this.yaw = opts.yaw ?? 0;
    this.pitch = opts.pitch ?? 0;
    this.minPitch = opts.minPitch ?? -PITCH_LIMIT;
    this.maxPitch = opts.maxPitch ?? PITCH_LIMIT;
    this.speed = opts.speed ?? 6;              // metres per second
    this.sprintMultiplier = opts.sprintMultiplier ?? 1.8;
    this.position = new THREE.Vector3(...(opts.position ?? [0, 0, 0]));
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._delta = new THREE.Vector3();
  }

  applyLook(input) {
    this.yaw -= input.look.x;                          // mouse right (+x) turns right (-yaw)
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + input.look.y));
  }

  /** Yaw-only basis: moving forward while looking at the sky still moves along the ground. */
  basis() {
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));   // camera looks down -Z
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));      // +X of the same rotation
    return [this._forward, this._right];
  }

  moveDelta(input, dt) {
    const [fwd, right] = this.basis();
    const speed = this.speed * (input.isDown?.('sprint') ? this.sprintMultiplier : 1);
    return this._delta
      .set(0, 0, 0)
      .addScaledVector(fwd, input.move.y * speed * dt)
      .addScaledVector(right, input.move.x * speed * dt);
  }
}

export class FPSRig extends BaseRig {
  constructor(camera, opts = {}) {
    super(camera, opts);
    this.eyeHeight = opts.eyeHeight ?? 1.7;
  }

  update(input, dt) {
    this.applyLook(input);
    this.position.add(this.moveDelta(input, dt));
    this.camera.position.copy(this.position);
    this.camera.position.y += this.eyeHeight;
    // Euler YXZ: yaw first then pitch, so the horizon never rolls
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    return this;
  }
}

export class ThirdPersonRig extends BaseRig {
  constructor(camera, opts = {}) {
    super(camera, opts);
    this.target = opts.target ?? null;        // Object3D to follow; falls back to this.position
    this.distance = opts.distance ?? 6;
    this.height = opts.height ?? 1.6;
    this.damping = opts.damping ?? 12;        // higher = snappier
    this.minPitch = opts.minPitch ?? -0.6;    // don't let the camera go under the floor
    this.maxPitch = opts.maxPitch ?? 1.1;
    this.faceMovement = opts.faceMovement ?? true;
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  update(input, dt) {
    this.applyLook(input);
    const focus = this.target ? this.target.position : this.position;
    if (!this.target) this.position.add(this.moveDelta(input, dt));
    else this.target.position.add(this.moveDelta(input, dt));

    // turn the avatar toward where it is going, not where the camera looks
    if (this.faceMovement && this.target && (input.move.x || input.move.y)) {
      const [fwd, right] = this.basis();
      const dir = this._look.set(0, 0, 0)
        .addScaledVector(fwd, input.move.y).addScaledVector(right, input.move.x);
      if (dir.lengthSq() > 1e-6) {
        const wanted = Math.atan2(dir.x, dir.z);
        const cur = this.target.rotation.y;
        let d = ((wanted - cur + Math.PI) % (Math.PI * 2)) - Math.PI;   // shortest arc
        this.target.rotation.y = cur + d * Math.min(1, dt * 10);
      }
    }

    const cp = Math.cos(this.pitch);
    this._desired.set(
      focus.x + Math.sin(this.yaw) * this.distance * cp,
      focus.y + this.height + Math.sin(this.pitch) * this.distance,
      focus.z + Math.cos(this.yaw) * this.distance * cp,
    );
    // exponential damping is frame-rate independent, unlike lerp(x, 0.1)
    const k = 1 - Math.exp(-this.damping * dt);
    this.camera.position.lerp(this._desired, k);
    this.camera.lookAt(focus.x, focus.y + this.height * 0.6, focus.z);
    return this;
  }
}

export class TopDownRig extends BaseRig {
  constructor(camera, opts = {}) {
    super(camera, opts);
    this.target = opts.target ?? null;
    this.height = opts.height ?? 14;
    this.tilt = opts.tilt ?? 0.95;            // radians from vertical
    this.damping = opts.damping ?? 10;
    this.rotatable = opts.rotatable ?? false; // twin-stick games usually keep the frame fixed
    this._desired = new THREE.Vector3();
  }

  update(input, dt) {
    if (this.rotatable) this.yaw -= input.look.x;
    const focus = this.target ? this.target.position : this.position;
    if (!this.target) this.position.add(this.moveDelta(input, dt));
    else this.target.position.add(this.moveDelta(input, dt));

    this._desired.set(
      focus.x + Math.sin(this.yaw) * this.height * Math.sin(this.tilt),
      focus.y + this.height * Math.cos(this.tilt),
      focus.z + Math.cos(this.yaw) * this.height * Math.sin(this.tilt),
    );
    const k = 1 - Math.exp(-this.damping * dt);
    this.camera.position.lerp(this._desired, k);
    this.camera.lookAt(focus);
    return this;
  }
}

export const RIGS = { fps: FPSRig, thirdPerson: ThirdPersonRig, topDown: TopDownRig };

/** `makeRig('fps', camera, opts)` — keeps the game code free of import churn. */
export function makeRig(kind, camera, opts) {
  const R = RIGS[kind];
  if (!R) throw new Error(`makeRig: unknown rig "${kind}" (have ${Object.keys(RIGS).join(', ')})`);
  return new R(camera, opts);
}
