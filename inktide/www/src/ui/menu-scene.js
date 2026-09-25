// The live 3D backdrop behind every menu: a small sun-lit plaza built with the real engine pieces
// (InkSystem atlas, Level brushes + BVH, Environment sky/water/backdrop, Particles, SquidkinModel),
// where three Squidkin fight a friendly turf battle. Ink blobs fly on real ballistic arcs, hit the
// level through the BVH and paint the atlas, so the diorama keeps changing colour.
//
//   const ms = new MenuScene(app);   // sets app.menuScene + renderer scene
//   ms.setShot('title' | 'menu' | 'wide' | 'map');
//   ms.update(dt) — called by App while no session is running
import * as THREE from 'three';
import { InkSystem, TEAM_HERO, TEAM_MURK } from '../ink/ink-system.js';
import { Level } from '../world/level.js';
import { Environment } from '../world/environment.js';
import { Particles } from '../fx/particles.js';
import { SquidkinModel } from '../actors/squidkin-model.js';
import { makeGunModel } from '../weapons/base.js';
import { inkMat } from '../actors/materials.js';
import { settings, INK_PALETTES, TURF_PALETTES } from '../engine/settings.js';
import { block, ramp, cyl, container, stairs, heroInk, murk } from '../levels/kit.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();

/** Diorama: a harbour-side plaza with a brick wall, containers, a ramp deck and low cover. */
const PLAZA = {
  id: 'menu-plaza',
  theme: 'plaza',
  waterY: -1.6,
  killY: -20,
  brushes: [
    block(0, -3, 42, 38, -1.2, 1.2, { mat: 'tiles' }),
    block(0, 17, 42, 2.2, -1.2, 1.0, { mat: 'concrete', color: '#d9d2c6' }),     // front kerb
    block(-1, -21, 24, 2, 0, 5.2, { mat: 'brick' }),                               // back wall
    block(-1, -22.6, 24, 1.2, 5.2, 0.4, { mat: 'concrete', color: '#cfc7ba' }),   // wall cap
    block(-15.5, -13, 2, 14, 0, 3.4, { mat: 'plaster', color: '#f2e2cc' }),        // left wall
    container(-9.5, 0, -16.5, '#2f7fd8'),
    container(-9.5, 2.6, -16.5, '#e0612b'),
    container(13.2, 0, -12, '#35b56a', Math.PI / 2),
    ramp(6.5, 0, -17.5, 10.5, 2.4, -12.5, '-z', { mat: 'concrete' }),
    block(8.5, -20, 4, 5, 0, 2.4, { mat: 'concrete' }),
    stairs(-14.5, 0, 1, -10.5, 1.6, 4, '-x', { mat: 'wood' }),
    block(-16.5, 2.5, 4, 5, 0, 1.6, { mat: 'wood' }),
    cyl(-7, 0, -3, 0.8, 3.2, { mat: 'plaster', color: '#f5e9d8' }),
    cyl(7.5, 0, -2.5, 0.8, 3.2, { mat: 'plaster', color: '#f5e9d8' }),
    block(-3.5, -8.5, 3.4, 1, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    block(4, -10, 1, 3.2, 0, 1, { mat: 'concrete', color: '#dcd6cc' }),
    block(0.5, -14.5, 5, 1, 0, 1.3, { mat: 'metal', color: '#b9c2cf' }),
    block(12, 6, 4, 2.2, 0, 0.7, { mat: 'grass' }),
    block(-12, 9, 2.2, 4, 0, 0.7, { mat: 'grass' }),
  ],
  preInk: [
    heroInk(-1.5, 0, 1.5, 2.4), heroInk(2.5, 0, -2, 1.8), heroInk(-4, 0, -5, 1.6), heroInk(1, 0, 4.5, 1.5),
    murk(-6, 0, -11, 2.2), murk(5, 0, -13, 2.4), murk(9, 0, -7, 1.8), murk(-10, 0, -6, 1.4),
    { at: [-1, 2.4, -19.9], r: 2.0, team: 'murk', n: [0, 0, 1] },
    { at: [-6.5, 2.2, -19.9], r: 1.5, team: 'hero', n: [0, 0, 1] },
  ],
};

const THEME_OVERRIDE = {
  skyTop: '#2c58c8', skyHorizon: '#ffd4a8', skyBottom: '#f4b690', sunColor: '#fff0d8', sunIntensity: 2.05,
  sunDir: [-0.42, 0.56, 0.62], hemiSky: '#d6e6ff', hemiGround: '#b8977b', hemiIntensity: 0.82,
  fog: '#f1d9c4', fogNear: 70, fogFar: 330, clouds: 0.55, bloom: 0.34, exposure: 1.0, backdropTint: '#98a8cf',
};

/** Camera shots: where to orbit, how far, and where the subject sits horizontally (0..1). */
const SHOTS = {
  title: { center: [0, 0.6, -6], radius: 19, height: 8.2, sweep: 0.75, speed: 0.07, base: 0, lookY: 0.4, fov: 46, frame: 0.5 },
  menu: { center: [0, 0.9, 3], radius: 3.9, height: 1.1, sweep: 0.5, speed: 0.11, base: 0, lookY: 0, fov: 40, frame: 0.52 },
  wide: { center: [0, 0.8, -5], radius: 14, height: 4.6, sweep: 0.5, speed: 0.06, base: 0.35, lookY: 0.2, fov: 44, frame: 0.6 },
  map: { center: [0, 0.6, -6], radius: 24, height: 13, sweep: 0.3, speed: 0.04, base: -0.3, lookY: 0, fov: 42, frame: 0.5 },
};

const LOOKS = [
  {},
  { hair: 'bob', skin: '#e3a57c', top: '#f2f2f2', topAccent: '#3b3f55', bottom: '#3a3f52', shoes: '#2b2d38', shoeAccent: '#f2f2f2' },
  { hair: 'spikes', skin: '#9b6444', top: '#1c1f2e', topAccent: '#f2f2f2', bottom: '#57493b', shoes: '#f2f2f2', shoeAccent: '#1c1f2e' },
];

/** Hero ink = the player's palette; rivals get the turf-clash partner colour of that palette. */
function menuColors() {
  const p = settings.inkColors();
  const pair = TURF_PALETTES.find((t) => t.a.toLowerCase() === p.hero.toLowerCase());
  const colorblind = p === INK_PALETTES.colorblind;
  return { a: p.hero, b: colorblind || !pair ? p.murk : pair.b };
}

class Kid {
  constructor(ms, { team, look, path, pos, yaw = 0, hero = false }) {
    this.ms = ms;
    this.team = team;
    this.hero = hero;
    this.model = new SquidkinModel({ inkColor: ms.ink.color(team), look });
    this.gun = makeGunModel(ms.ink.color(team));
    this.model.weaponSocket.add(this.gun);
    ms.scene.add(this.model.root);
    this.pos = new THREE.Vector3().fromArray(pos || [0, 0, 0]);
    this.yaw = yaw;
    this.path = path ? new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal') : null;
    this.pathLen = this.path ? this.path.getLength() : 0;
    this.u = Math.random();
    this.state = hero ? 'pose' : 'run';
    this.t = 0;
    this.timer = hero ? 2.5 : 2 + Math.random() * 3;
    this.speed = 0;
    this.trailT = 0;
    this.fireT = 0;
    this.target = new THREE.Vector3();
    this.aimPitch = 0;
    this.recoil = 0;
    this.firing = false;
    this.form = 'kid';
    this.ripT = 0;
    this.anim = {
      speed: 0, grounded: true, vy: 0, aiming: false, aimPitch: 0, firing: false, recoil: 0,
      submerged: false, climbing: false, inkLevel: 1, landed: 0, hidden: false,
    };
    if (this.path) this.pos.copy(this.path.getPointAt(this.u));
    this.model.root.position.copy(this.pos);
    this.model._prevPos.copy(this.pos);
  }

  recolor() {
    const c = this.ms.ink.color(this.team);
    this.model.setInkColor(c);
    this.gun.traverse((o) => { if (o.userData.inkPart) { o.material.color.copy(c); o.material.emissive?.copy(c); } });
  }

  muzzle(out) {
    this.model.weaponSocket.getWorldPosition(out);
    return out.addScaledVector(_d.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.3);
  }

  faceToward(p, dt, rate = 10) {
    const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let d = ((want - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * rate);
    return Math.abs(d);
  }

  pickTarget() {
    const ms = this.ms;
    const r = Math.random();
    if (!this.hero && r < 0.25) {
      // a splat up on the back wall
      this.target.set(-10 + Math.random() * 18, 0.8 + Math.random() * 3.2, -20);
    } else if (this.hero) {
      // reclaim ground off to one side so the hero turns into profile, not away from the camera
      const side = Math.random() < 0.5 ? -1 : 1;
      this.target.set(side * (3.5 + Math.random() * 4), 0, 0.5 + Math.random() * 5);
    } else {
      const f = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.target.copy(this.pos).addScaledVector(f, 4 + Math.random() * 5);
      this.target.x += (Math.random() - 0.5) * 5;
      this.target.z = Math.max(-19, Math.min(9, this.target.z));
      this.target.x = Math.max(-14, Math.min(14, this.target.x));
      this.target.y = 0;
    }
    void ms;
  }

  update(dt) {
    const ms = this.ms;
    this.t += dt;
    this.timer -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    let speed = 0;
    this.firing = false;
    let aiming = false;

    if (this.hero) {
      if (this.state === 'pose') {
        // face the camera, loosely
        const cam = ms.camera.position;
        const want = Math.atan2(cam.x - this.pos.x, cam.z - this.pos.z) + Math.sin(this.t * 0.5) * 0.25;
        let dy = ((want - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * Math.min(1, dt * 3);
        if (this.timer <= 0) {
          const r = Math.random();
          if (r < 0.5) { this.state = 'shoot'; this.timer = 1.2 + Math.random() * 0.8; this.pickTarget(); }
          else { this.model.emote(r < 0.8 ? 'cheer' : 'wave', 1.8); this.timer = 3 + Math.random() * 2; }
        }
      } else if (this.state === 'shoot') {
        const off = this.faceToward(this.target, dt, 12);
        aiming = true;
        if (off < 0.25) this._fire(dt, 7.5);
        this.target.x += Math.sin(this.t * 2.3) * dt * 2.5;         // sweep the stream a little
        if (this.timer <= 0) { this.state = 'pose'; this.timer = 4.5 + Math.random() * 3; }
      }
    } else if (this.state === 'run' || this.state === 'squid') {
      const sp = this.state === 'squid' ? 7.4 : 4.6;
      this.u = (this.u + (sp * dt) / this.pathLen) % 1;
      const p = this.path.getPointAt(this.u, _p);
      const tan = this.path.getTangentAt(this.u, _t);
      this.pos.copy(p);
      const want = Math.atan2(tan.x, tan.z);
      let d = ((want - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 9);
      speed = sp;
      this.trailT -= dt;
      if (this.state === 'run' && this.trailT <= 0) {
        this.trailT = 0.11;
        ms.ink.paint(_v.copy(this.pos).setY(0.02), 0.5 + Math.random() * 0.15, this.team, UP);
      }
      if (this.state === 'squid') {
        this.ripT -= dt;
        if (this.ripT <= 0) {
          this.ripT = 0.1;
          ms.fx.ring(_v.copy(this.pos).setY(0.03), UP, ms.ink.color(this.team), 0.7, 0.4);
          ms.fx.burst(_v, UP, ms.ink.color(this.team), 2, 2.4, { size: 0.045, life: 0.35 });
          ms.ink.paint(_v.copy(this.pos).setY(0.02), 0.45, this.team, UP);
        }
      }
      if (this.timer <= 0) {
        if (this.state === 'squid') { this._setForm('kid'); this.state = 'run'; this.timer = 1.5 + Math.random() * 2; }
        else {
          const r = Math.random();
          if (r < 0.55) { this.state = 'shoot'; this.timer = 1.0 + Math.random() * 0.9; this.pickTarget(); }
          else if (r < 0.8) { this.state = 'throw'; this.timer = 0.75; this.pickTarget(); this.thrown = false; }
          else { this.state = 'squid'; this._setForm('squid'); this.timer = 1.2 + Math.random() * 0.8; }
        }
      }
    } else if (this.state === 'shoot') {
      const off = this.faceToward(this.target, dt, 11);
      aiming = true;
      if (off < 0.3) this._fire(dt, 6.5);
      if (this.timer <= 0) { this.state = 'run'; this.timer = 2.2 + Math.random() * 2.5; }
    } else if (this.state === 'throw') {
      this.faceToward(this.target, dt, 12);
      aiming = true;
      if (!this.thrown && this.timer < 0.4) {
        this.thrown = true;
        this.muzzle(_w).y += 0.25;
        ms.launch(_w, this.target, this.team, { bomb: true });
        this.recoil = 1;
      }
      if (this.timer <= 0) { this.state = 'run'; this.timer = 2.5 + Math.random() * 2; }
    }

    // aim pitch toward the target
    if (aiming) {
      this.muzzle(_w);
      const dx = this.target.x - _w.x, dz = this.target.z - _w.z;
      const want = Math.atan2(this.target.y - _w.y, Math.hypot(dx, dz)) * 0.7;
      this.aimPitch += (want - this.aimPitch) * Math.min(1, dt * 8);
    } else this.aimPitch *= Math.max(0, 1 - dt * 4);

    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    const s = this.anim;       // reused every frame (no per-frame garbage)
    s.speed = speed; s.aiming = aiming; s.aimPitch = this.aimPitch; s.firing = this.firing; s.recoil = this.recoil;
    s.inkLevel = 0.55 + 0.45 * Math.sin(this.t * 0.4 + this.u * 6) ** 2;
    m.update(dt, s);
    this.gun.visible = this.form === 'kid';
  }

  _setForm(f) {
    this.form = f;
    this.model.setForm(f);
    const ms = this.ms;
    ms.fx.burst(_v.copy(this.pos).setY(0.2), UP, ms.ink.color(this.team), 10, 3.2, { size: 0.06 });
    ms.fx.ring(_v.copy(this.pos).setY(0.03), UP, ms.ink.color(this.team), 1, 0.4);
  }

  _fire(dt, rate) {
    this.firing = true;
    this.fireT -= dt;
    while (this.fireT <= 0) {
      this.fireT += 1 / rate;
      this.muzzle(_w);
      _v.copy(this.target);
      _v.x += (Math.random() - 0.5) * 1.1; _v.z += (Math.random() - 0.5) * 1.1;
      if (_v.y > 0.1) _v.y += (Math.random() - 0.5) * 0.8;
      this.ms.launch(_w, _v, this.team);
      this.recoil = 1;
      this.ms.fx.spray(_w, _d.set(Math.sin(this.yaw), 0.1, Math.cos(this.yaw)).multiplyScalar(4), this.ms.ink.color(this.team), 2, 1.4, { size: 0.03, life: 0.22 });
    }
  }
}

export class MenuScene {
  constructor(app) {
    this.app = app;
    const R = app.renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.1, 1400);
    this.active = true;
    this.time = 0;

    const q = settings.get('video.quality');
    const big = q === 'high' || q === 'ultra';
    this.ink = new InkSystem(R.gl, { atlasSize: big ? 2048 : 1024, texelsPerMeter: big ? 14 : 9 });
    const c = menuColors();
    this.ink.setTeamColors(c.a, c.b);
    this.level = new Level({ ink: this.ink }, PLAZA).build();
    this.scene.add(this.level.group);
    this.env = new Environment(this.scene, R, 'plaza', { waterY: PLAZA.waterY, bounds: this.level.bounds, water: true, backdrop: true, override: THEME_OVERRIDE });
    this.fx = new Particles(this.scene, { max: 500 });

    // ink blobs in flight (pooled)
    this.blobGeo = new THREE.SphereGeometry(1, 12, 8);
    this.blobMats = [null, inkMat(this.ink.color(TEAM_HERO)), inkMat(this.ink.color(TEAM_MURK))];
    this.blobs = [];
    for (let i = 0; i < 48; i++) {
      const mesh = new THREE.Mesh(this.blobGeo, this.blobMats[1]);
      mesh.visible = false;
      mesh.castShadow = false;
      this.scene.add(mesh);
      this.blobs.push({ mesh, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), team: 1, life: 0, bomb: false, alive: false });
    }
    this.blobCursor = 0;

    this.kids = [
      new Kid(this, { team: TEAM_HERO, look: LOOKS[0], pos: [0, 0, 3], yaw: 0, hero: true }),
      new Kid(this, { team: TEAM_MURK, look: LOOKS[1], path: [[-8, -4], [-3, -3.2], [2.5, -6], [1.2, -11.5], [-4.5, -12.2], [-9.5, -9]] }),
      new Kid(this, { team: TEAM_MURK, look: LOOKS[2], path: [[5.5, -1.2], [11, -4.5], [10.5, -9], [7, -12.2], [2.2, -9.2], [3.2, -5]] }),
    ];

    // camera state (smoothed toward the active shot)
    this.shot = 'title';
    this.orbit = 0;
    this.camPos = new THREE.Vector3(0, 9, 14);
    this.camTarget = new THREE.Vector3(0, 0.5, -6);
    this.frame = 0.5;
    this.fov = 46;
    this._placeCamera(1, true);

    this._unsub = settings.onChange((p) => { if (p === 'gameplay.inkPalette' || p === '*') this.recolor(); });

    app.menuScene = this;
    R.setScene(this.scene, this.camera);
    this._applyLook();
    // warm shaders + atlas so the first frames don't hitch
    this.ink.flush();
    try { R.gl.compile(this.scene, this.camera); } catch (e) { console.warn('menu scene compile', e); }
  }

  /** 'title' | 'menu' | 'wide' | 'map' */
  setShot(name) { if (SHOTS[name]) this.shot = name; }

  recolor() {
    const c = menuColors();
    this.ink.setTeamColors(c.a, c.b);
    this.blobMats[1].color.copy(this.ink.color(TEAM_HERO)); this.blobMats[1].emissive.copy(this.ink.color(TEAM_HERO));
    this.blobMats[2].color.copy(this.ink.color(TEAM_MURK)); this.blobMats[2].emissive.copy(this.ink.color(TEAM_MURK));
    for (const k of this.kids) k.recolor();
  }

  /** Fire an ink blob on a ballistic arc from `from` to land on `to`. */
  launch(from, to, team, { bomb = false } = {}) {
    const b = this.blobs[this.blobCursor];
    this.blobCursor = (this.blobCursor + 1) % this.blobs.length;
    const g = bomb ? 16 : 14;
    const dist = from.distanceTo(to);
    const T = THREE.MathUtils.clamp(dist / (bomb ? 9 : 15), 0.3, bomb ? 1.2 : 0.95);
    b.pos.copy(from); b.prev.copy(from);
    b.vel.subVectors(to, from).divideScalar(T);
    b.vel.y += 0.5 * g * T;
    b.g = g;
    b.team = team;
    b.life = 3;
    b.bomb = bomb;
    b.alive = true;
    b.mesh.material = this.blobMats[team];
    b.mesh.scale.setScalar(bomb ? 0.2 : 0.085);
    b.mesh.visible = true;
  }

  _splat(point, normal, team, bomb) {
    const color = this.ink.color(team);
    if (bomb) {
      this.ink.paint(point, 2.2, team, normal);
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, d = 1.4 + Math.random() * 1.2;
        _v.set(point.x + Math.cos(a) * d, point.y, point.z + Math.sin(a) * d);
        if (Math.abs(normal.y) > 0.7) this.ink.paint(_v, 0.5 + Math.random() * 0.5, team, normal);
      }
      this.fx.explosion(point, normal, color, 2.2);
    } else {
      this.ink.paint(point, 0.55 + Math.random() * 0.35, team, normal);
      this.fx.burst(point, normal, color, 7, 3.2, { size: 0.055 });
      this.fx.ring(point, normal, color, 0.9, 0.35);
    }
  }

  _updateBlobs(dt) {
    for (const b of this.blobs) {
      if (!b.alive) continue;
      b.life -= dt;
      b.prev.copy(b.pos);
      b.vel.y -= b.g * dt;
      b.pos.addScaledVector(b.vel, dt);
      _d.subVectors(b.pos, b.prev);
      const len = _d.length();
      const hit = len > 1e-5 ? this.level.raycast(b.prev, _d.divideScalar(len), len + 0.05, { staticOnly: true }) : null;
      if (hit || b.life <= 0 || b.pos.y < -3) {
        if (hit) this._splat(hit.point, hit.normal, b.team, b.bomb);
        b.alive = false;
        b.mesh.visible = false;
        continue;
      }
      b.mesh.position.copy(b.pos);
      // stretch along velocity
      const sp = b.vel.length();
      b.mesh.quaternion.setFromUnitVectors(_w.set(0, 0, 1), _v.copy(b.vel).divideScalar(sp || 1));
      const s = b.bomb ? 0.2 : 0.085;
      b.mesh.scale.set(s, s, s * (1 + Math.min(1.6, sp * 0.05)));
    }
  }

  _placeCamera(dt, snap = false) {
    const S = SHOTS[this.shot];
    this.orbit += dt * S.speed;
    const a = S.base + Math.sin(this.orbit) * S.sweep;
    const c = _v.fromArray(S.center);
    const wantPos = _w.set(c.x + Math.sin(a) * S.radius, c.y + S.height + Math.sin(this.orbit * 1.7) * 0.12, c.z + Math.cos(a) * S.radius);
    const k = snap ? 1 : 1 - Math.exp(-dt * 1.8);
    this.camPos.lerp(wantPos, k);
    this.camTarget.lerp(_d.set(c.x, c.y + S.lookY, c.z), k);
    this.frame += (S.frame - this.frame) * k;
    this.fov += (S.fov - this.fov) * k;
    const cam = this.camera;
    cam.position.copy(this.camPos);
    // gentle handheld drift
    cam.position.x += Math.sin(this.time * 0.63) * 0.04;
    cam.position.y += Math.sin(this.time * 0.91) * 0.03;
    cam.lookAt(this.camTarget);

    // keep the subject at `frame` of the viewport width (menus cover the left third): render a
    // wider virtual frame and show a window of it. The aspect must be the VIRTUAL frame's, or the
    // window is squeezed horizontally (kids looked ~20% fat in the 'wide' shot).
    const W = Math.max(1, innerWidth), H = Math.max(1, innerHeight);
    const f = THREE.MathUtils.clamp(this.frame, 0.2, 0.8);
    const fullW = W * 2 * Math.max(f, 1 - f);
    const offX = f >= 0.5 ? 0 : fullW - W;
    cam.fov = this.fov;
    cam.near = 0.1; cam.far = 1400;
    cam.aspect = fullW / H;
    cam.setViewOffset(fullW, H, offX, 0, W, H);
  }

  _applyLook() {
    const R = this.app.renderer;
    const T = this.env.theme;
    R.gl.toneMappingExposure = T.exposure;
    R.setBloom(T.bloom * 0.8, T.bloom > 0.5 ? 1.05 : 1.35, 0.4);
    const g = R.grade;
    if (g) { g.uniforms.damage.value = 0; g.uniforms.flash.value = 0; }
  }

  /** An opaque screen (the story map) hides the diorama: skip drawing and animating it. */
  setCovered(v) {
    this.covered = !!v;
    this.scene.visible = !v;
  }

  update(dt) {
    if (!this.active || this.covered) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    for (const k of this.kids) k.update(dt);
    this._updateBlobs(dt);
    this.fx.update(dt);
    this.ink.flush();
    this.ink.uniforms.inkTime.value = this.time;
    this.env.follow(_v.set(0, 0, -5));
    this.env.update(dt);
    this._placeCamera(dt);
  }

  show() {
    this.active = true;
    this.setCovered(false);
    this._applyLook();
    this.app.renderer.setScene(this.scene, this.camera);
  }

  hide() { this.active = false; }

  dispose() {
    this._unsub?.();
    for (const k of this.kids) { this.scene.remove(k.model.root); k.model.dispose(); }
    for (const b of this.blobs) this.scene.remove(b.mesh);
    this.blobGeo.dispose();
    for (const m of this.blobMats) m?.dispose();
    this.fx.dispose();
    this.level.dispose();
    this.env.dispose();
    this.ink.dispose();
    if (this.app.menuScene === this) this.app.menuScene = null;
  }
}
