/* The Physics Gun.

   Hold PRIMARY on an object to grab it at the exact point you aimed at. While held:
     wheel / D-pad up-down   push / pull
     hold USE + look         rotate the object (SPRINT snaps to 45°)
     SECONDARY               freeze it in place and let go
   RELOAD on an object unfreezes it and everything welded to it.

   The hold is solved inside the physics step (a velocity servo on the grab point and an
   angular servo on orientation), so held objects still collide and push things naturally. */
import * as THREE from 'three';
import { Weapon } from './weapons.js';
import { physgunModel } from './viewmodels.js';
import { Audio } from '../core/audio.js';
import { contraption } from '../physics/constraints.js';
import { TEX } from '../render/textures.js';
import { disposeTree } from '../world/geometry.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export class PhysGun extends Weapon {
  constructor(game) {
    super(game, { id: 'physgun', name: 'Physics Gun', slot: 1, model: physgunModel, base: [0.19, -0.2, -0.34] });
    this.held = null;       // { e, local, dist, rot }
    this.firing = false;
    this.rotating = false;
    this.beam = makeBeam(game.renderer.scene);
    this.hum = null;
    this.spin = 0;
    this.maxRange = 600;
    this._aim = new THREE.Vector3();
    game.physgun = this;
    game.prePhysics.push(() => this._servo());
  }

  canGrab(e) {
    if (!e || !e.body || e.removed) return false;
    if (e.kind === 'npc' || e.kind === 'player' || e.kind === 'world') return false;
    if (e.flags.noPhysgun) return false;
    return this.game.canPhysgun?.(e) ?? true;
  }

  update(input, dt) {
    super.update(input, dt);
    const { o, d } = this.eyeRay();
    const p = this.game.player;

    if (input.justPressed('primary')) {
      this.firing = true;
      const hit = this.game.physics.raycast(o, d, this.maxRange, { excludeBody: p.body, predicate: (c) => !c.isSensor() });
      if (hit && this.canGrab(hit.entity)) this._grab(hit, o);
      else if (hit) this.game.fx.beamHit(new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z), hit.normal);
    }
    if (!input.isDown('primary') && this.firing) {
      this.firing = false;
      this._release(false);
    }

    if (this.held) {
      const h = this.held;
      if (h.e.removed) { this._release(false); return; }
      // push / pull
      let push = input.wheel * 0.9;
      if (input.padDown(12)) push += dt * 9;
      if (input.padDown(13)) push -= dt * 9;
      h.dist = THREE.MathUtils.clamp(h.dist * (1 + push * 0.06) + push * 0.4, 1.2, this.maxRange);
      // rotate with USE held: look input turns the object instead of the camera
      this.rotating = input.isDown('use');
      p.lookLocked = this.rotating;
      if (this.rotating) {
        const cam = this.game.renderer.camera;
        const right = _a.set(1, 0, 0).applyQuaternion(cam.quaternion);
        _q.setFromAxisAngle(UP, input.look.x * 1.2);
        _q2.setFromAxisAngle(right, -input.look.y * 1.2);
        h.rot.premultiply(_q).premultiply(_q2);
        h.snapPending = true;
      } else if (h.snapPending && input.isDown('sprint')) {
        snap45(h.rot);
        h.snapPending = false;
      }
      if (input.isDown('sprint') && this.rotating) h.snapLive = true;
      if (input.justPressed('secondary')) {
        const e = h.e;
        this._release(true);
        e.setFrozen(true);
        this.game.fx.beamHit(e.curr.p, null);
        Audio.play('physgun_freeze', { pos: e.curr.p });
        this.game.onFreeze?.(e);
        this.game.hud?.notify('Froze ' + e.name, 'freeze');
      }
    } else {
      p.lookLocked = false;
      if (input.justPressed('reload')) this._unfreezeAimed(o, d);
    }

    // aim point for the idle/firing beam
    if (this.firing && !this.held) {
      const hit = this.game.physics.raycast(o, d, this.maxRange, { excludeBody: p.body });
      this._aim.copy(hit ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z) : o.clone().addScaledVector(d, 60));
    }
    this._updateBeam(dt, o, d);
  }

  _grab(hit, eye) {
    const e = hit.entity;
    if (e.frozen) e.setFrozen(false, false);
    const point = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
    const camQ = this.game.renderer.camera.quaternion;
    // Orientation kept relative to camera yaw, like the classic gun: turn around and it turns with you.
    const yawQ = _q.setFromAxisAngle(UP, this.game.player.rig.yaw);
    const rot = yawQ.clone().invert().multiply(e.curr.q);
    this.held = { e, local: e.worldToLocal(point), dist: eye.distanceTo(point), rot, snapPending: false };
    this.game.fx.beamHit(point, hit.normal);
    Audio.play('physgun_grab', { volume: 0.8 });
    if (!this.hum) this.hum = Audio.loop('physgun', { volume: 0.35 });
    this.hum.set(1);
    e.body.wakeUp();
    e.held = true;
    this.game.onGrab?.(e);
    void camQ;
  }

  _release(frozen) {
    if (!this.held) return;
    const e = this.held.e;
    e.held = false;
    if (!frozen && e.body) {
      // limit the fling so a flick cannot launch objects into orbit
      const v = e.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > 45) { const k = 45 / sp; e.body.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true); }
    }
    this.held = null;
    this.game.player.lookLocked = false;
    this.rotating = false;
    Audio.play('physgun_drop', { volume: 0.6 });
    this.hum?.set(0);
    this.game.onDrop?.(e);
  }

  _unfreezeAimed(o, d) {
    const hit = this.game.physics.raycast(o, d, this.maxRange, { excludeBody: this.game.player.body });
    const e = hit?.entity;
    if (!e || !e.body || e.kind === 'npc') return;
    const all = contraption(e).filter((x) => x.frozen);
    for (const x of all) x.setFrozen(false);
    if (all.length) {
      Audio.play('physgun_unfreeze', { pos: e.curr.p });
      this.game.hud?.notify(`Unfroze ${all.length} object${all.length > 1 ? 's' : ''}`, 'unfreeze');
      this.kick = 0.6;
    }
  }

  /** Physics-step servo: drive the grab point to the target, and the orientation to rot. */
  _servo() {
    const h = this.held;
    if (!h || !h.e.body || h.e.removed || h.e.frozen) return;
    const cam = this.game.renderer.camera;
    const eye = cam.position;
    const dir = cam.getWorldDirection(_b);
    const target = _a.copy(eye).addScaledVector(dir, h.dist);
    const body = h.e.body;
    const t = body.translation(), r = body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    const grabWorld = h.local.clone().applyQuaternion(_q).add(new THREE.Vector3(t.x, t.y, t.z));
    const err = target.sub(grabWorld);
    const gain = 14;
    let vx = err.x * gain, vy = err.y * gain, vz = err.z * gain;
    const sp = Math.hypot(vx, vy, vz), max = 70;
    if (sp > max) { vx *= max / sp; vy *= max / sp; vz *= max / sp; }
    // orientation
    const yawQ = _q2.setFromAxisAngle(UP, this.game.player.rig.yaw);
    const want = yawQ.clone().multiply(h.rot);
    if (h.snapLive && this.game.input.isDown('sprint')) snap45Quat(want);
    const dq = want.multiply(_q.clone().invert());
    if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
    const angle = 2 * Math.acos(Math.min(1, dq.w));
    const s = Math.sqrt(1 - dq.w * dq.w);
    const ag = 12;
    let ax = 0, ay = 0, az = 0;
    if (s > 1e-4) { ax = (dq.x / s) * angle * ag; ay = (dq.y / s) * angle * ag; az = (dq.z / s) * angle * ag; }
    // Lever arm: grabbing off-centre, linear velocity at the grab point = v + w × r
    const rW = h.local.clone().applyQuaternion(_q);
    const wxr = new THREE.Vector3(ax, ay, az).cross(rW);
    body.setLinvel({ x: vx - wxr.x, y: vy - wxr.y, z: vz - wxr.z }, true);
    body.setAngvel({ x: ax, y: ay, z: az }, true);
  }

  _updateBeam(dt, eye, dir) {
    const on = this.firing;
    const b = this.beam;
    this.spin += dt * (on ? 14 : 2);
    for (const [i, c] of (this.parts.coils || []).entries()) c.rotation.z = this.spin * (i % 2 ? 1 : -1) * 0.3;
    const spread = on ? 1 : 0;
    for (const pr of this.parts.prongs || []) {
      pr.position.x = pr.userData.dir.x * (0.045 + spread * 0.018);
      pr.position.y = 0.02 + pr.userData.dir.y * (0.045 + spread * 0.018);
    }
    if (this.parts.coilMat) this.parts.coilMat.emissiveIntensity = on ? 3 + Math.sin(this.spin * 3) * 1 : 1.1;
    if (this.parts.core) this.parts.core.scale.setScalar(on ? 1.3 + Math.sin(this.spin * 4) * 0.2 : 0.8);
    if (!on || !this.vm.visible) { b.group.visible = false; return; }
    const from = this.muzzleWorld(_a.set(0, 0, 0));
    let to;
    if (this.held && !this.held.e.removed) to = this.held.e.localToWorld(this.held.local, new THREE.Vector3());
    else to = this._aim;
    // Quadratic curve: the control point is straight ahead at the hold distance, so the beam
    // bends toward where the object is while the gun points where you look.
    const dist = this.held ? this.held.dist : eye.distanceTo(to);
    const ctrl = eye.clone().addScaledVector(dir, dist * 0.55);
    b.update(from, ctrl, to, this.game.renderer.camera, this.spin);
    b.group.visible = true;
  }

  holster() {
    if (this.held) this._release(false);
    this.firing = false;
    this.beam.group.visible = false;
    this.hum?.set(0);
  }

  dispose() { disposeTree(this.beam.group); this.hum?.stop(); }

  onEntityRemoved(e) { if (this.held?.e === e) { this.held = null; this.game.player.lookLocked = false; } }

  hudInfo() { return null; }
}

function snap45(q) { snap45Quat(q); }
function snap45Quat(q) {
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  const s = Math.PI / 4;
  e.set(Math.round(e.x / s) * s, Math.round(e.y / s) * s, Math.round(e.z / s) * s, 'YXZ');
  q.setFromEuler(e);
}

/* ------------------------------------------------------------------ beam mesh
   A camera-facing ribbon along a quadratic Bézier with a scrolling additive texture,
   plus glow sprites at both ends. */
function makeBeam(scene) {
  const N = 32;
  const group = new THREE.Group();
  group.visible = false;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 2 * 3), uv = new Float32Array(N * 2 * 2);
  for (let i = 0; i < N; i++) { uv[i * 4] = i / (N - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (N - 1); uv[i * 4 + 3] = 1; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.35, 1.3, 3.2) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float core = 1.0 - abs(vUv.y - 0.5) * 2.0; core = pow(core, 1.6);
        float wave = 0.65 + 0.35 * sin(vUv.x * 60.0 - uTime * 18.0) * sin(vUv.x * 13.0 + uTime * 5.0);
        float a = core * wave; vec3 c = mix(uColor, vec3(3.0), pow(core, 6.0));
        gl_FragColor = vec4(c * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.frustumCulled = false;
  group.add(ribbon);
  const spriteMat = new THREE.SpriteMaterial({ map: TEX.spriteGlow, color: new THREE.Color(0.5, 1.4, 3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const endGlow = new THREE.Sprite(spriteMat); endGlow.scale.setScalar(0.6);
  const startGlow = new THREE.Sprite(spriteMat); startGlow.scale.setScalar(0.1);
  group.add(endGlow, startGlow);
  const light = new THREE.PointLight(0x5cb8ff, 2.5, 6, 2);
  group.add(light);
  scene.add(group);
  const P = new THREE.Vector3(), T = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Vector3();
  return {
    group,
    update(a, c, b, cam, time) {
      mat.uniforms.uTime.value = time;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1), it = 1 - t;
        P.set(it * it * a.x + 2 * it * t * c.x + t * t * b.x, it * it * a.y + 2 * it * t * c.y + t * t * b.y, it * it * a.z + 2 * it * t * c.z + t * t * b.z);
        T.set(2 * it * (c.x - a.x) + 2 * t * (b.x - c.x), 2 * it * (c.y - a.y) + 2 * t * (b.y - c.y), 2 * it * (c.z - a.z) + 2 * t * (b.z - c.z)).normalize();
        C.subVectors(cam.position, P).normalize();
        S.crossVectors(T, C).normalize();
        const w = 0.012 + t * 0.035 + Math.sin(t * 20 + time * 3) * 0.004;
        pos[i * 6] = P.x + S.x * w; pos[i * 6 + 1] = P.y + S.y * w; pos[i * 6 + 2] = P.z + S.z * w;
        pos[i * 6 + 3] = P.x - S.x * w; pos[i * 6 + 4] = P.y - S.y * w; pos[i * 6 + 5] = P.z - S.z * w;
      }
      geo.attributes.position.needsUpdate = true;
      endGlow.position.copy(b);
      endGlow.scale.setScalar(0.5 + Math.sin(time * 5) * 0.08);
      startGlow.position.copy(a);
      light.position.copy(b);
    },
  };
}
