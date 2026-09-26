// Snipe Eel — a Murk eel riding a little chicken-walker mech with a long charger rifle. Its laser
// sight sweeps while idle; once it spots you the laser locks on (tracking with a lag), brightens
// through a charge-up whine and a glint, then fires a fast, heavy shot. Backs away if rushed.
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import { MurkEnemy, G, mesh, UP, clamp, angleDiff, applySpread } from './common.js';

const _m = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Vector3();
const _hc = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color(1, 1, 1);

const TUB_PROFILE = [[0.001, 0], [0.26, 0], [0.37, 0.07], [0.42, 0.22], [0.45, 0.4], [0.47, 0.44], [0.43, 0.46]];
const HEAD_BASE = new THREE.Vector3(0, 0.72, 0.2);
const MUZZLE = new THREE.Vector3(0, 0.02, 1.2);
const SHOT_SPEED = 95;

function finGeometry() {
  return G.merged('eel-fin', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(0.05, 0.2, -0.05, 0.27);
    s.quadraticCurveTo(-0.14, 0.15, -0.34, 0.02);
    s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -0.009);
    return [[g, new THREE.Matrix4().makeRotationY(-Math.PI / 2)]];
  });
}

export class SnipeEel extends MurkEnemy {
  constructor(session, def) {
    super(session, def, {
      hp: 70, hitRadius: 0.55, hitHeight: 1.9, aggro: 30, speed: 1.6, accel: 5, radius: 0.45, height: 1.6,
      turnRate: 1.5, knockMul: 0.4, pearls: [2, 2], deathPaint: 2, popupH: 2.45, eyeH: 1.85, loseTime: 3, maxDrop: 0.6,
    });
    this.aimDir = new THREE.Vector3(Math.sin(this.yaw), -0.05, Math.cos(this.yaw)).normalize();
    this.charge = 0;
    this.hold = 0;
    this.coolT = 0.5;
    this.recoil = 0;
    this.pinged = false;
    this.laserEnd = new THREE.Vector3();
    this.laserOnPlayer = false;
    this.chargeSfxT = 0;
    this.stepT = 0;
    this._build();
  }

  get visionCone() { return 0.2; }

  _build() {
    const P = this.pal;
    const steel = this.metal(P.steel, { roughness: 0.3, metalness: 0.6, rim: 0.35 });
    const steelDark = this.metal(P.steelDark, { roughness: 0.4, metalness: 0.5, rim: 0.3 });
    const hatM = this.matte(P.hat, { roughness: 0.38, rim: 0.35 });
    const inkM = this.mat(P.ink, { ink: true, rim: 0.5, emissiveIntensity: 0.25 });
    const skin = this.mat(P.tarLight.clone().lerp(new THREE.Color('#1d3b4a'), 0.35), { ink: true, rim: 0.6, emissiveIntensity: 0.08 });
    const belly = this.mat(new THREE.Color('#c9b8e8').lerp(P.ink, 0.25), { roughness: 0.4, rim: 0.3 });
    const finM = this.mat(P.ink.clone().lerp(new THREE.Color('#1d3b4a'), 0.3), { ink: true, rim: 0.6, emissiveIntensity: 0.2 });
    const dark = this.mat(P.dark, { roughness: 0.2, rim: 0.1 });
    const tooth = this.matte('#f3ecdf', { roughness: 0.4, rim: 0.1 });
    this.eyeM = this.glowMat(P.glow, 1.5);
    const lureM = this.glowMat(P.glow, 1.8);
    this.canMat = this.glowMat(P.ink, 0.4);

    // --- walker legs (reverse-jointed) ---
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.3, 0.98, 0);
      this.root.add(hip);
      mesh(G.sphere(0.1, 14, 10), steelDark, hip);
      const thigh = mesh(G.rbox(0.13, 0.5, 0.15, 0.05), steel, hip);
      thigh.position.set(0, -0.22, -0.1);
      thigh.rotation.x = -0.45;
      const knee = mesh(G.sphere(0.075, 12, 8), steelDark, hip);
      knee.position.set(0, -0.45, -0.21);
      const shin = mesh(G.rbox(0.1, 0.52, 0.11, 0.04), steelDark, hip);
      shin.position.set(0, -0.68, -0.09);
      shin.rotation.x = 0.48;
      const piston = mesh(G.cyl(0.025, 0.025, 0.42, 8), steel, hip);
      piston.position.set(s * 0.07, -0.5, -0.02);
      piston.rotation.x = 0.1;
      const foot = mesh(G.rbox(0.22, 0.08, 0.36, 0.035), steel, hip);
      foot.position.set(0, -0.94, 0.04);
      const toe = mesh(G.rbox(0.24, 0.05, 0.06, 0.02), hatM, hip);
      toe.position.set(0, -0.95, 0.23);
      this.legs.push(hip);
      this.rigid(hip, s < 0 ? 'hipL' : 'hipR');   // mirrored piston → separate bake per side
    }
    // --- cockpit tub ---
    const tub = new THREE.Group();
    tub.position.y = 0.92;
    this.root.add(tub);
    this.tub = tub;
    mesh(G.lathe('eel-tub', TUB_PROFILE, 28), steel, tub);
    const lip = mesh(G.torus(0.45, 0.04, 8, 30), steelDark, tub);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.45;
    const stripe = mesh(G.torus(0.432, 0.028, 6, 30), inkM, tub);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.27;
    const hz = mesh(G.torus(0.44, 0.02, 6, 30), hatM, tub);
    hz.rotation.x = Math.PI / 2;
    hz.position.y = 0.36;
    const bath = mesh(G.cyl(0.42, 0.42, 0.03, 28), inkM, tub);
    bath.position.y = 0.41;
    const lamp = mesh(G.cylZ(0.07, 0.08, 0.06, 14), steelDark, tub);
    lamp.position.set(-0.2, 0.18, 0.4);
    const lampLens = mesh(G.sphere(0.055, 10, 8), lureM, tub, false);
    lampLens.position.set(-0.2, 0.18, 0.43);
    lampLens.scale.z = 0.5;
    const vent = mesh(G.rbox(0.3, 0.14, 0.08, 0.03), steelDark, tub);
    vent.position.set(0, 0.2, -0.42);
    this.rigid(tub, 'tub');

    // --- the eel ---
    const eel = new THREE.Group();
    eel.position.y = 0.35;
    tub.add(eel);
    this.eel = eel;
    mesh(G.taperTube('eel-body3', [[0, -0.05, -0.05], [0, 0.22, -0.13], [0, 0.46, -0.08], [0, 0.62, 0.05], [0, 0.7, 0.16]], 0.19, 0.13, 20, 14), skin, eel);
    const bellyStrip = mesh(G.tube('eel-belly2', [[0, 0.04, 0.0], [0, 0.26, -0.03], [0, 0.46, 0.03], [0, 0.6, 0.14]], 0.1, 16, 10), belly, eel);
    bellyStrip.position.z = 0.05;
    const fin = mesh(finGeometry(), finM, eel);
    fin.position.set(0, 0.5, -0.17);
    fin.rotation.x = -0.35;
    fin.scale.setScalar(1.3);
    const head = new THREE.Group();
    head.position.copy(HEAD_BASE);
    eel.add(head);
    this.head = head;
    const skull = mesh(G.sphere(0.2, 24, 18), skin, head);
    skull.scale.set(0.95, 0.8, 1.35);
    skull.position.z = 0.1;
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.07, 0.03);
    head.add(jaw);
    this.jaw = jaw;
    const jawM = mesh(G.sphere(0.165, 18, 12), belly, jaw);
    jawM.scale.set(0.85, 0.45, 1.35);
    jawM.position.z = 0.1;
    for (let i = 0; i < 5; i++) {
      const t = mesh(G.cone(0.02, 0.055, 6), tooth, jaw, false);
      const a = -0.9 + i * 0.45;
      t.position.set(Math.sin(a) * 0.13, 0.045, 0.12 + Math.cos(a) * 0.13);
    }
    this.rigid(jaw, 'jaw');
    // the Murk visor-eye doubles as the scope eyepiece
    const eye = new THREE.Group();
    eye.position.set(0, 0.09, 0.25);
    eye.rotation.x = -0.25;
    head.add(eye);
    mesh(G.torus(0.115, 0.035, 10, 24), steel, eye).scale.set(1, 1, 1.3);
    mesh(G.sphere(0.115, 20, 14), this.eyeM, eye, false).scale.set(1, 1, 0.5);
    const pupil = mesh(G.sphere(0.045, 10, 8), dark, eye, false);
    pupil.scale.set(0.6, 1.4, 0.35);
    pupil.position.z = 0.056;
    const strap = mesh(G.torus(0.19, 0.022, 6, 24), steelDark, head);
    strap.position.set(0, 0.05, 0.12);
    strap.rotation.x = Math.PI / 2 - 0.25;
    strap.scale.set(1, 1.3, 1);
    const lure = new THREE.Group();
    lure.position.set(0, 0.15, 0.02);
    head.add(lure);
    mesh(G.tube('eel-lure', [[0, 0, 0], [0, 0.12, -0.05], [0, 0.22, 0.03], [0, 0.22, 0.13], [0, 0.16, 0.18]], 0.012, 14, 6), steelDark, lure);
    const bulb = mesh(G.sphere(0.04, 12, 8), lureM, lure, false);
    bulb.position.set(0, 0.155, 0.185);
    this.detail(this.halo(P.glow, 0.26, bulb, 0.5));
    this.lure = lure;

    // --- charger rifle on a side mount ---
    const mount = new THREE.Group();
    mount.position.set(0.5, 0.52, 0.05);
    tub.add(mount);
    this.mount = mount;
    mesh(G.sphere(0.08, 12, 10), steelDark, mount);
    const rifle = new THREE.Group();
    mount.add(rifle);
    this.rifle = rifle;
    const rb = mesh(G.rbox(0.1, 0.13, 0.62, 0.035), steelDark, rifle);
    rb.position.set(0, 0.02, 0.22);
    const barrel = mesh(G.cylZ(0.032, 0.04, 0.62, 12), steel, rifle);
    barrel.position.set(0, 0.03, 0.83);
    const brake = mesh(G.rbox(0.08, 0.07, 0.1, 0.02), steelDark, rifle);
    brake.position.set(0, 0.03, 1.16);
    const scope = mesh(G.cylZ(0.045, 0.05, 0.3, 14), steel, rifle);
    scope.position.set(0, 0.13, 0.28);
    const scopeLens = mesh(G.sphere(0.042, 12, 8), lureM, rifle, false);
    scopeLens.position.set(0, 0.13, 0.43);
    scopeLens.scale.z = 0.4;
    const can = mesh(G.capsuleZ(0.05, 0.2), this.canMat, rifle);
    can.position.set(0, -0.08, 0.02);
    const stock = mesh(G.rbox(0.08, 0.16, 0.18, 0.04), inkM, rifle);
    stock.position.set(0, -0.01, -0.14);
    this.rigid(rifle, 'rifle');

    // --- laser sight (world space) ---
    this.laser = new THREE.Group();
    this.laserGlowMat = new THREE.MeshBasicMaterial({ color: P.inkBright, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    this.laserCoreMat = new THREE.MeshBasicMaterial({ color: WHITE.clone().lerp(P.inkBright, 0.35), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    this.own(this.laserGlowMat, this.laserCoreMat);
    this.laserGlow = mesh(G.box(1, 1, 1), this.laserGlowMat, this.laser, false);
    this.laserCore = mesh(G.box(1, 1, 1), this.laserCoreMat, this.laser, false);
    this.laserGlow.renderOrder = this.laserCore.renderOrder = 4;
    this.laserDot = this.halo(P.inkBright, 0.5, null, 0.9);
    this.laserDot.renderOrder = 5;
    this.glint = this.halo('#ffffff', 0.9, rifle, 0);
    this.glint.position.copy(MUZZLE);
    this.session.scene.add(this.laser, this.laserDot);
  }

  muzzle(out) { return this.worldOf(this.rifle, MUZZLE, out); }

  onState(s) {
    if (s !== 'attack') { this.charge = 0; this.hold = 0; this.pinged = false; }
  }

  behave(dt) {
    const S = this.session;
    this.coolT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 3);
    const T = this.target;
    // desired aim: target when fighting, a lazy scan otherwise
    if ((this.state === 'attack' || this.state === 'alert') && T) {
      this.faceTarget();
      const m = this.muzzle(_m);
      this.aimAt(m, SHOT_SPEED, { lead: 0.45 }, _d);
      // lagged tracking: the laser drags behind a moving target
      const ang = this.aimDir.angleTo(_d);
      const maxStep = (this.charge > 0.8 ? 0.7 : 1.35) * Math.min(1.3, this.diff) * dt;
      if (ang > 1e-4) this.aimDir.lerp(_d, Math.min(1, maxStep / ang)).normalize();
    } else {
      this.wander(dt);
      const sweep = this.yaw + Math.sin(this.t * 0.6) * 0.5;
      _d.set(Math.sin(sweep), -0.08 + Math.sin(this.t * 0.37) * 0.05, Math.cos(sweep)).normalize();
      this.aimDir.lerp(_d, Math.min(1, dt * 2)).normalize();
    }
    if (this.state !== 'attack' || !T) return;

    // footwork: back off when rushed (never off a ledge — the physics guards that)
    const dist = this.distXZ(T.position);
    if (dist < 7 && this.canSee) {
      _p.set(this.position.x - T.position.x, 0, this.position.z - T.position.z).normalize();
      this.wish.set(_p.x * this.speed, 0, _p.z * this.speed);
    }

    // charge → hold (glint) → fire → cool down
    if (this.coolT > 0) return;
    const onTarget = this.canSee && this.aimDir.angleTo(_d) < 0.12;
    if (this.canSee) this.charge = Math.min(1, this.charge + dt / (1.5 / Math.sqrt(this.diff)));
    else if (this.sinceSeen > 0.6) this.charge = Math.max(0, this.charge - dt * 1.2);
    this.chargeSfxT -= dt;
    if (this.charge > 0 && this.charge < 1 && this.chargeSfxT <= 0 && this.canSee) {
      this.chargeSfxT = 0.16;
      S.audio?.sfx('charge', { pos: this.position, volume: 0.35, level: this.charge, throttle: 0.05 });
    }
    if (this.charge >= 1) {
      if (!this.pinged) { this.pinged = true; S.audio?.sfx('snipe_ping', { pos: this.position, volume: 0.8 }); }
      this.hold += dt;
      if (this.hold > 0.28 && (onTarget || this.hold > 0.9)) this.fire();
    }
  }

  fire() {
    const S = this.session;
    const m = this.muzzle(_m);
    _d.copy(this.aimDir);
    applySpread(_d, 0.6 / Math.sqrt(this.diff));
    this.shoot(m, _d, {
      speed: SHOT_SPEED, damage: 80, size: 0.15, radius: 0.2, gravity: 0, gravityDelay: 0, life: 0.9,
      paint: 0.7, trailEvery: 0.8, trailRadius: 0.42, sfx: 'snipe_shot', volume: 0.9, pitch: 1,
    });
    S.fx.burst(m, _d, this.pal.inkBright, 10, 8, { size: 0.05 });
    S.fx.puff(m, '#d9d0ec', 0.6, 0.35, _p.copy(_d).multiplyScalar(1.5), 2, 0.5);
    S.fx.ring(m, _d, this.pal.inkBright, 0.9, 0.25);
    S.shake?.(this.position, 0.15);
    this.charge = 0;
    this.hold = 0;
    this.pinged = false;
    this.coolT = 2.2 / Math.sqrt(this.diff);
    this.recoil = 1;
    this.squashV += 3;
  }

  /** Laser endpoint: first wall along the aim, or the player if the beam crosses them. */
  _traceLaser(from) {
    const S = this.session;
    const hit = S.level.raycast(from, this.aimDir, 60);
    let len = hit ? hit.distance : 60;
    this.laserOnPlayer = false;
    const P = S.player;
    if (P?.alive && !P.submerged) {
      P.hitCenter(_hc);
      _e.subVectors(_hc, from);
      const along = _e.dot(this.aimDir);
      if (along > 0 && along < len) {
        const off = _e.addScaledVector(this.aimDir, -along).length();
        if (off < 0.42) { len = along; this.laserOnPlayer = true; }
      }
    }
    this.laserEnd.copy(from).addScaledVector(this.aimDir, len);
    return len;
  }

  animate(dt) {
    const v = this.velocity;
    const hs = Math.hypot(v.x, v.z);
    const sw = Math.min(1, hs / 1.2);
    const prev = this.walkPhase;
    this.walkPhase += hs * dt * 5;
    this.legs[0].rotation.x = Math.sin(this.walkPhase) * 0.45 * sw;
    this.legs[1].rotation.x = -Math.sin(this.walkPhase) * 0.45 * sw;
    if (sw > 0.2 && Math.floor(prev / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) this.session.audio?.sfx('mech_step', { pos: this.position, volume: 0.35, throttle: 0.1 });
    this.tub.position.y = 0.92 + Math.abs(Math.sin(this.walkPhase)) * 0.05 * sw - this.recoil * 0.04;
    this.tub.rotation.x = -this.recoil * 0.12 - this.hurtT * 0.8;

    // rifle mount follows the aim (relative to the body)
    const aimYaw = Math.atan2(this.aimDir.x, this.aimDir.z);
    const rel = clamp(angleDiff(this.yaw, aimYaw), -0.8, 0.8);
    this.mount.rotation.y = rel;
    this.rifle.rotation.x = -Math.asin(clamp(this.aimDir.y, -0.9, 0.9));
    this.rifle.position.z = -this.recoil * 0.12;
    // eel sways, leans into the scope while charging
    const focus = this.state === 'attack' ? 1 : 0;
    this.eel.rotation.z = Math.sin(this.t * 1.3) * 0.08 * (1 - focus) + rel * 0.25;
    this.eel.rotation.x = focus * 0.12 + Math.sin(this.t * 1.7) * 0.04;
    this.head.rotation.y = rel * 0.6;
    this.head.rotation.x = -Math.asin(clamp(this.aimDir.y, -0.6, 0.6)) * 0.6;
    this.jaw.rotation.x = 0.15 + Math.max(0, Math.sin(this.t * 2.2)) * 0.12 + (this.charge >= 1 ? 0.25 : 0);
    this.lure.rotation.x = Math.sin(this.t * 2.4) * 0.12 - this.recoil * 0.5;
    const want = this.aware ? this.pal.angry : this.state === 'search' ? this.pal.wary : this.pal.glow;
    this.eyeM.color.lerp(want, Math.min(1, dt * 8));
    this.eyeM.emissive.copy(this.eyeM.color);
    this.canMat.emissiveIntensity = 0.4 + this.charge * 1.6;

    // laser sight
    const on = this.alive && (this.state !== 'attack' || this.coolT < 1.3);
    this.laser.visible = on;
    this.laserDot.visible = on;
    if (on) {
      const from = this.muzzle(_m);
      // the wall/player trace runs at ~30 Hz; direction and origin update every frame
      this._traceT = (this._traceT || 0) - dt;
      if (this._traceT <= 0 || this._len == null) { this._traceT = 0.033; this._len = this._traceLaser(from); }
      const len = this._len;
      this.laserEnd.copy(from).addScaledVector(this.aimDir, len);
      const fighting = this.state === 'attack' || this.state === 'alert';
      const c = fighting ? this.charge : 0;
      const full = c >= 1;
      const flick = full ? (Math.sin(this.t * 40) > 0 ? 1 : 0.55) : 1;
      const w = fighting ? 0.018 + c * 0.03 : 0.012;
      this.laser.position.copy(from).addScaledVector(this.aimDir, len * 0.5);
      this.laser.quaternion.copy(_q.setFromUnitVectors(_z, this.aimDir));
      this.laserCore.scale.set(w, w, len);
      this.laserGlow.scale.set(w * 3.2, w * 3.2, len);
      this.laserCoreMat.opacity = (fighting ? 0.45 + c * 0.5 : 0.28) * flick;
      this.laserGlowMat.opacity = (fighting ? 0.12 + c * 0.3 : 0.08) * flick;
      this.laserCoreMat.color.copy(WHITE).lerp(this.pal.inkBright, full ? 0.1 : 0.45);
      this.laserDot.position.copy(this.laserEnd).addScaledVector(this.aimDir, -0.05);
      const ds = (this.laserOnPlayer ? 0.55 : 0.4) + c * 0.3;
      this.laserDot.scale.setScalar(ds * (0.9 + Math.sin(this.t * 25) * 0.1));
      this.laserDot.material.opacity = (fighting ? 0.6 + c * 0.4 : 0.35) * flick;
    }
    this.glint.material.opacity = this.charge >= 1 ? 0.6 + Math.sin(this.t * 30) * 0.3 : this.charge * 0.25;
    this.glint.scale.setScalar(0.5 + this.charge * 0.9);
  }

  onPop(c) {
    const S = this.session;
    S.fx.burst(c, UP, this.pal.steel, 10, 6, { size: 0.07 });
    S.fx.burst(_p.copy(c).setY(c.y + 0.6), UP, this.pal.tarLight, 10, 5, { size: 0.08 });
  }

  dispose() {
    this.session.scene.remove(this.laser, this.laserDot);
    super.dispose();
  }
}

registerEntity('snipe-eel', (s, d) => new SnipeEel(s, d));
