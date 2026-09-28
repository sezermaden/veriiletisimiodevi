/* The Rover: a drivable buggy on Rapier's ray-cast vehicle controller.
   USE to enter/exit. Throttle W / RT, brake-reverse S / LT, steer A-D / left stick,
   handbrake SPACE / A, headlights F. Third-person orbit camera with collision. */
import * as THREE from 'three';
import { Entity } from './entities.js';
import { GROUPS } from '../physics/physics.js';
import { cyl, boxGeo, roundBox } from './geometry.js';
import { material } from '../render/materials.js';
import { Audio } from '../core/audio.js';

const std = (c, r = 0.5, m = 0.4) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();

const WHEELS = [[-0.95, -0.15, 1.25, true], [0.95, -0.15, 1.25, true], [-0.95, -0.15, -1.2, false], [0.95, -0.15, -1.2, false]];
const RADIUS = 0.44;

export class Vehicle {
  constructor(game, pos, yaw = 0, { color = '#d9a21e' } = {}) {
    this.game = game;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const g = new THREE.Group();
    const paint = std(color, 0.35, 0.5);
    const frame = std('#2a2d31', 0.45, 0.8);
    g.add(new THREE.Mesh(roundBox(1.5, 0.3, 3.0, 0.08), paint).translateY(0.05));
    g.add(new THREE.Mesh(roundBox(1.3, 0.25, 0.9, 0.06), paint).translateY(0.3).translateZ(1.05));
    // seats
    for (const x of [-0.35, 0.35]) {
      g.add(new THREE.Mesh(roundBox(0.5, 0.12, 0.5, 0.05), std('#1c1c1c', 0.9, 0)).translateX(x).translateY(0.3).translateZ(-0.15));
      g.add(new THREE.Mesh(roundBox(0.5, 0.6, 0.12, 0.05), std('#1c1c1c', 0.9, 0)).translateX(x).translateY(0.6).translateZ(-0.45));
    }
    // roll cage
    const bar = (a, b) => {
      const d = new THREE.Vector3().subVectors(b, a);
      const m = new THREE.Mesh(cyl(0.035, d.length(), 8), frame);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      g.add(m);
    };
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    bar(P(-0.7, 0.2, 0.4), P(-0.6, 1.35, 0.1)); bar(P(0.7, 0.2, 0.4), P(0.6, 1.35, 0.1));
    bar(P(-0.7, 0.2, -1.0), P(-0.6, 1.35, -0.6)); bar(P(0.7, 0.2, -1.0), P(0.6, 1.35, -0.6));
    bar(P(-0.6, 1.35, 0.1), P(0.6, 1.35, 0.1)); bar(P(-0.6, 1.35, -0.6), P(0.6, 1.35, -0.6));
    bar(P(-0.6, 1.35, 0.1), P(-0.6, 1.35, -0.6)); bar(P(0.6, 1.35, 0.1), P(0.6, 1.35, -0.6));
    // steering wheel
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 20), frame);
    sw.position.set(-0.35, 0.72, 0.35); sw.rotation.x = -0.9; g.add(sw);
    this.steeringWheel = sw;
    // headlights
    const lensMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff3d0', emissiveIntensity: 0.2 });
    this.lights = [];
    for (const x of [-0.5, 0.5]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), lensMat);
      lens.position.set(x, 0.32, 1.51); g.add(lens);
      const l = new THREE.SpotLight(0xfff3d0, 0, 45, 0.5, 0.5, 1.4);
      l.position.set(x, 0.32, 1.55); l.target.position.set(x, -1, 12);
      g.add(l, l.target);
      this.lights.push(l);
    }
    this.lensMat = lensMat;
    // wheel meshes (not physics bodies — the controller casts rays)
    this.wheelMeshes = WHEELS.map(([x, y, z]) => {
      const w = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(RADIUS * 0.72, RADIUS * 0.28, 12, 24).rotateY(Math.PI / 2), material('rubber'));
      const hub = new THREE.Mesh(cyl(RADIUS * 0.5, 0.26, 16).rotateZ(Math.PI / 2), material('chrome'));
      w.add(tire, hub);
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(boxGeo(0.28, 0.05, RADIUS * 0.8), std('#8a9097', 0.3, 0.9)); s.rotation.x = (i / 6) * Math.PI; w.add(s); }
      w.position.set(x, y, z);
      w.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(w);
      return w;
    });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.copy(pos); g.quaternion.copy(q);

    const { body, colliders } = game.entities.buildBody([{ box: [0.75, 0.2, 1.5], p: [0, 0.05, 0] }, { box: [0.6, 0.35, 0.5], p: [0, 0.5, -0.25] }], { pos, quat: q, density: 3, surface: 'metal', ccd: true, angDamp: 0.6 });
    body.setAdditionalMass?.(0, true);
    const e = new Entity(game, { kind: 'vehicle', name: 'Rover', object3d: g, body, colliders, surface: 'metal', halfHeight: 0.5, density: 0.6 });
    e.vehicle = this;
    this.entity = e;
    game.entities.add(e);
    e.onRemove = () => this._dispose();

    const vc = game.physics.world.createVehicleController(body);
    vc.indexUpAxis = 1;
    vc.setIndexForwardAxis = 2;
    WHEELS.forEach(([x, y, z], i) => {
      vc.addWheel({ x, y, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.35, RADIUS);
      vc.setWheelSuspensionStiffness(i, 26);
      vc.setWheelSuspensionCompression(i, 2.4);
      vc.setWheelSuspensionRelaxation(i, 3.2);
      vc.setWheelMaxSuspensionTravel(i, 0.35);
      vc.setWheelMaxSuspensionForce(i, 40000);
      vc.setWheelFrictionSlip(i, 2.4);
      vc.setWheelSideFrictionStiffness(i, 1.1);
    });
    this.vc = vc;
    this.steer = 0;
    this.spin = [0, 0, 0, 0];
    this.driver = null;
    this.engine = null;
    this.headlights = false;
    this.camYaw = yaw + Math.PI; this.camPitch = -0.25; this.boom = 6;
    game.vehicles.push(this);
    this._stepHook = () => this.step();
    game.prePhysics.push(this._stepHook);
  }

  get pos() { return this.entity.curr.p; }

  enter(player) {
    if (this.driver) return;
    this.driver = player;
    player.vehicle = this;
    player.collider.setEnabled(false);
    this.engine = Audio.loop('engine', { pos: this.pos, volume: 0.5 });
    this.engine.set(0.6);
    Audio.play('door_open', { pos: this.pos, volume: 0.3 });
    const yaw = new THREE.Euler().setFromQuaternion(this.entity.curr.q, 'YXZ').y;
    this.camYaw = yaw + Math.PI; this.camPitch = -0.2;
    this.game.hud?.hint('Drive: W/S or RT/LT · Steer: A/D · Handbrake: SPACE · Exit: E', 5);
  }

  exit() {
    const p = this.driver;
    if (!p) return;
    this.driver = null;
    p.vehicle = null;
    const side = new THREE.Vector3(-1.9, 0.4, 0).applyQuaternion(this.entity.curr.q).add(this.pos);
    const hit = this.game.physics.raycast({ x: side.x, y: side.y + 1, z: side.z }, { x: 0, y: -1, z: 0 }, 4);
    if (hit) side.y = hit.point.y + 0.05;
    p.spawn(side, p.rig.yaw, 0);
    p.collider.setEnabled(true);
    this.engine?.stop(); this.engine = null;
    for (let i = 0; i < 4; i++) { this.vc.setWheelEngineForce(i, 0); this.vc.setWheelBrake(i, 0.6); }
  }

  step() {
    if (this.entity.removed) return;
    const input = this.game.input;
    const d = this.driver && this.game.inputEnabled;
    let throttle = 0, steerIn = 0, hand = false;
    if (d) {
      const rt = input.trigger('right'), lt = input.trigger('left');
      throttle = (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0) + rt - lt;
      steerIn = -input.move.x;
      hand = input.isDown('jump');
    }
    throttle = THREE.MathUtils.clamp(throttle, -1, 1);
    const speed = this.vc.currentVehicleSpeed();
    this.steer += (steerIn * 0.55 / (1 + Math.abs(speed) * 0.04) - this.steer) * 0.18;
    const force = 2400;
    for (let i = 0; i < 4; i++) {
      const front = WHEELS[i][3];
      if (front) this.vc.setWheelSteering(i, this.steer);
      // throttle drives all wheels; pressing against the direction of travel brakes first
      const braking = (throttle < 0 && speed > 1) || (throttle > 0 && speed < -1);
      this.vc.setWheelEngineForce(i, braking ? 0 : throttle * force);
      this.vc.setWheelBrake(i, hand && !front ? 3 : braking ? 1.2 : throttle === 0 && d ? 0.08 : throttle === 0 ? 0.5 : 0);
    }
    this.vc.updateVehicle(1 / 60, undefined, undefined, (c) => this.game.physics.colliderOwner.get(c.handle)?.kind !== 'player' && !this.entity.colliders.includes(c));
    this.speed = speed;
  }

  update(dt) {
    if (this.entity.removed) return;
    // wheel visuals follow suspension + spin
    for (let i = 0; i < 4; i++) {
      const [x, y, z, front] = WHEELS[i];
      const len = this.vc.wheelSuspensionLength(i) ?? 0.35;
      const w = this.wheelMeshes[i];
      w.position.set(x, y - len, z);
      this.spin[i] += (this.speed || 0) * dt / RADIUS;
      w.rotation.set(this.spin[i], front ? this.steer : 0, 0, 'YXZ');
    }
    this.steeringWheel.rotation.z = -this.steer * 2;
    if (this.engine) { this.engine.move(this.pos); this.engine.set(0.5 + Math.min(0.5, Math.abs(this.speed || 0) / 30), 0.8 + Math.abs(this.speed || 0) / 14); }
    if (this.driver) this._camera(dt);
  }

  toggleLights() {
    this.headlights = !this.headlights;
    for (const l of this.lights) l.intensity = this.headlights ? 80 : 0;
    this.lensMat.emissiveIntensity = this.headlights ? 4 : 0.2;
    Audio.play('button', { pos: this.pos });
  }

  /** Orbit camera: boom length eased, ray from the chest, never from the floor. */
  _camera(dt) {
    const input = this.game.input;
    const cam = this.game.renderer.camera;
    this.camYaw -= input.look.x;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + input.look.y, -1.1, 0.5);
    // legacyCam (negative control only): ray from the chassis floor and an unsmoothed boom
    const legacy = this.game.legacyCam;
    const focus = _v.copy(this.entity.object3d.position).add(new THREE.Vector3(0, legacy ? 0 : 1.2, 0));
    const cp = Math.cos(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, -Math.sin(this.camPitch) + 0.15, Math.cos(this.camYaw) * cp).normalize();
    const want = 6.5;
    const hit = this.game.physics.raycast(focus, dir, want + 0.4, { predicate: (c) => { const o = this.game.physics.colliderOwner.get(c.handle); return o !== this.entity && o?.kind !== 'player' && !c.isSensor(); } });
    const clear = hit ? Math.max(1.5, Math.min(want, hit.distance - 0.35)) : want;
    if (legacy) this.boom = clear;
    else this.boom += (clear - this.boom) * Math.min(1, dt * (clear < this.boom ? 20 : 2.5));
    cam.position.copy(focus).addScaledVector(dir, this.boom);
    cam.lookAt(focus);
    // keep the player's feet with the car so audio and AI see them there
    this.driver.pos.copy(this.pos);
    this.driver.prevPos.copy(this.pos);
  }

  _dispose() {
    if (this.driver) this.exit();
    this.game.physics.world.removeVehicleController(this.vc);
    this.game.vehicles = this.game.vehicles.filter((v) => v !== this);
    this.game.prePhysics = this.game.prePhysics.filter((f) => f !== this._stepHook);
    this.engine?.stop();
    for (const l of this.lights) l.dispose();
  }
}

export { GROUPS, _q };
