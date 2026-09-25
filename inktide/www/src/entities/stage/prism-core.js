// The stage goal: a faceted Prism Core sealed in a Murk-steel capsule on a pedestal. Shoot the
// capsule: it cracks with every hit, then shatters and the crystal rises in a pillar of light.
//   { type: 'prism-core', pos, yaw?, hp: 60, id? }
import * as THREE from 'three';
import { registerEntity } from '../base.js';
import {
  PropActor, geo, mat, rimMat, glowMat, canvasTex, makeGlowSprite, boxCollider,
  TEAM_HERO, TEAM_MURK, UP, clamp, easeOutCubic, easeOutBack, hash01,
} from './common.js';

const BASE_H = 0.85;            // pedestal top
const CAP_R = 0.72, CAP_L = 1.0;
const CAP_Y = BASE_H + 0.28 + CAP_R + CAP_L / 2;   // capsule centre
const TOP_Y = CAP_Y + CAP_L / 2 + CAP_R;
const SHARDS = 44;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

function crackTexture() {
  // cracks radiate from a few impact points; each has an alpha "level" so alphaTest reveals them
  // progressively as the capsule takes damage (level 1.0 appears first).
  return canvasTex('core-cracks', 512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.lineCap = 'round'; x.lineJoin = 'round';
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const centres = [[0.2, 0.5], [0.7, 0.35], [0.45, 0.72], [0.9, 0.6], [0.05, 0.25], [0.55, 0.15]];
    centres.forEach(([cx, cy], ci) => {
      const level = 1 - ci * 0.15;
      const n = 7 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        let px = cx * w, py = cy * h;
        let a = (k / n) * Math.PI * 2 + rnd() * 0.5;
        const len = 18 + rnd() * 26;
        x.strokeStyle = `rgba(255,255,255,${level.toFixed(3)})`;
        x.lineWidth = 3.2;
        x.beginPath(); x.moveTo(px, py);
        for (let s = 0; s < len; s++) {
          a += (rnd() - 0.5) * 0.7;
          px += Math.cos(a) * 5; py += Math.sin(a) * 5;
          x.lineTo(px, py);
          if (rnd() < 0.05) {       // branch
            const bx = px, by = py; let ba = a + (rnd() - 0.5) * 2;
            x.moveTo(bx, by);
            let qx = bx, qy = by;
            for (let j = 0; j < 8; j++) { ba += (rnd() - 0.5) * 0.8; qx += Math.cos(ba) * 4; qy += Math.sin(ba) * 4; x.lineTo(qx, qy); }
            x.moveTo(px, py);
          }
        }
        x.stroke();
        x.lineWidth = 1.2;
        x.stroke();
      }
      // impact star
      x.fillStyle = `rgba(255,255,255,${level.toFixed(3)})`;
      x.beginPath(); x.arc(cx * w, cy * h, 7, 0, Math.PI * 2); x.fill();
    });
  });
}

function crystalGeometry() {
  return geo('core-crystal', () => {
    const pts = [[0, -0.66], [0.3, -0.24], [0.37, 0.06], [0.29, 0.32], [0, 0.7]].map(([r, y]) => new THREE.Vector2(r, y));
    let g = new THREE.LatheGeometry(pts, 7);
    g = g.toNonIndexed();
    g.computeVertexNormals();
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i += 3) {
      const hue = (i / 3) * 0.137 % 1;
      c.setHSL(hue, 0.85, 0.66);
      for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // flat normals per face
    const p = g.attributes.position, nn = g.attributes.normal;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); d.fromBufferAttribute(p, i + 2);
      b.sub(a); d.sub(a); b.cross(d).normalize();
      for (let k = 0; k < 3; k++) nn.setXYZ(i + k, b.x, b.y, b.z);
    }
    return g;
  });
}

class PrismCore extends PropActor {
  constructor(session, def) {
    super(session, def, { hp: def.hp ?? 60, hitRadius: 0.9, hitHeight: 2.0 });
    this.state = 'sealed';
    this.t = 0;
    this.stateT = 0;
    this.shakeT = 0;
    this.flashT = 0;
    this.crack = 0;           // shown crack level 0..1
    this.crackTarget = 0;
    this.lastCrackStep = 0;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    this.murkCol = session.ink.color(TEAM_MURK).clone();
    this.maxHp = this.hp;
    const g = this.group;

    // ---- pedestal ----
    const steel = mat('core-steel', () => rimMat('#34304a', { roughness: 0.38, metalness: 0.6, rim: 0.25, rimColor: '#b9a6ff' }));
    const dark = mat('core-dark', () => rimMat('#1d1a2c', { roughness: 0.45, metalness: 0.5, rim: 0.15 }));
    const trimWhite = mat('core-trim', () => rimMat('#d8d4e8', { roughness: 0.3, metalness: 0.4, rim: 0.2 }));
    const add = (m, y) => { m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(new THREE.Mesh(geo('core-ped1', () => new THREE.CylinderGeometry(1.35, 1.55, 0.5, 6)), steel), 0.25);
    add(new THREE.Mesh(geo('core-ped2', () => new THREE.CylinderGeometry(1.0, 1.12, 0.35, 6)), dark), 0.5 + 0.175);
    add(new THREE.Mesh(geo('core-ped-lip', () => new THREE.CylinderGeometry(1.4, 1.4, 0.06, 6)), trimWhite), 0.5);
    this.trimMat = this.own(glowMat(this.murkCol, 2));
    const trim = add(new THREE.Mesh(geo('core-trim-ring', () => new THREE.TorusGeometry(1.12, 0.035, 6, 6)), this.trimMat), 0.72);
    trim.rotation.x = Math.PI / 2; trim.rotation.z = Math.PI / 6; trim.castShadow = false;
    // steps on the front
    add(new THREE.Mesh(geo('core-step', () => new THREE.BoxGeometry(1.4, 0.25, 0.6)), steel), 0.125).position.z = 1.55;

    // ---- capsule ----
    this.capsule = new THREE.Group();
    g.add(this.capsule);
    const capAdd = (m, y) => { m.position.y = y; m.castShadow = true; this.capsule.add(m); return m; };
    capAdd(new THREE.Mesh(geo('core-cap-bot', () => new THREE.CylinderGeometry(0.86, 0.92, 0.3, 16)), dark), BASE_H + 0.15);
    capAdd(new THREE.Mesh(geo('core-cap-bot-ring', () => new THREE.TorusGeometry(0.86, 0.05, 8, 24)), trimWhite), BASE_H + 0.3).rotation.x = Math.PI / 2;
    this.slitMat = this.own(glowMat(this.murkCol, 2.4));
    capAdd(new THREE.Mesh(geo('core-slit', () => new THREE.CylinderGeometry(0.925, 0.925, 0.05, 16, 1, true)), this.slitMat), BASE_H + 0.12);

    this.glassMat = this.own(rimMat(new THREE.Color('#d9ccff').lerp(this.murkCol, 0.25), {
      transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0.1, rim: 0.9, rimColor: '#e7dcff', env: 1.8, depthWrite: false,
    }));
    this.glass = capAdd(new THREE.Mesh(geo('core-glass', () => new THREE.CapsuleGeometry(CAP_R, CAP_L, 8, 24)), this.glassMat), CAP_Y);
    this.glass.renderOrder = 2;
    this.glass.castShadow = false;
    this.crackMat = this.own(new THREE.MeshBasicMaterial({
      map: crackTexture(), color: new THREE.Color(1.6, 1.5, 1.8), transparent: true, alphaTest: 1.01, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.cracks = capAdd(new THREE.Mesh(geo('core-crack-shell', () => new THREE.CapsuleGeometry(CAP_R + 0.012, CAP_L, 8, 24)), this.crackMat), CAP_Y);
    this.cracks.renderOrder = 3;
    this.cracks.visible = false;
    this.cracks.castShadow = false;

    // cage: bars + bands
    const barG = geo('core-bar', () => new THREE.CylinderGeometry(0.045, 0.045, CAP_L + CAP_R * 1.6, 8));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = capAdd(new THREE.Mesh(barG, steel), CAP_Y);
      b.position.x = Math.cos(a) * (CAP_R + 0.08);
      b.position.z = Math.sin(a) * (CAP_R + 0.08);
    }
    const bandG = geo('core-band', () => new THREE.TorusGeometry(CAP_R + 0.08, 0.06, 8, 28));
    capAdd(new THREE.Mesh(bandG, steel), CAP_Y).rotation.x = Math.PI / 2;
    this.bandGlow = capAdd(new THREE.Mesh(geo('core-band-glow', () => new THREE.TorusGeometry(CAP_R + 0.12, 0.02, 6, 28)), this.slitMat), CAP_Y + 0.08);
    this.bandGlow.rotation.x = Math.PI / 2;

    // top cap (flies off when the capsule shatters)
    this.top = new THREE.Group();
    this.top.position.y = TOP_Y - 0.25;
    const topBody = new THREE.Mesh(geo('core-top', () => new THREE.CylinderGeometry(0.62, 0.84, 0.36, 16)), dark);
    const topDome = new THREE.Mesh(geo('core-top-dome', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), steel);
    topDome.position.y = 0.16; topDome.scale.y = 0.55;
    this.beaconMat = this.own(glowMat('#ff3a5c', 2.5));
    const beacon = new THREE.Mesh(geo('core-beacon', () => new THREE.SphereGeometry(0.09, 10, 8)), this.beaconMat);
    beacon.position.y = 0.46;
    const ant = new THREE.Mesh(geo('core-ant', () => new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6)), trimWhite);
    ant.position.y = 0.33;
    for (const m of [topBody, topDome, ant]) m.castShadow = true;
    this.top.add(topBody, topDome, ant, beacon);
    g.add(this.top);
    this.topVel = new THREE.Vector3();
    this.topSpin = new THREE.Vector3();

    // ---- the crystal ----
    this.crystalMat = mat('core-crystal', () => rimMat('#ffffff', {
      vertexColors: true, flat: true, roughness: 0.12, metalness: 0.25, emissive: '#ffffff', emissiveIntensity: 0.55,
      emissiveFromVertex: true, rim: 0.9, rimColor: '#ffffff', env: 1.6,
    }));
    this.crystal = new THREE.Mesh(crystalGeometry(), this.crystalMat);
    this.crystal.position.y = CAP_Y;
    g.add(this.crystal);
    this.glow = makeGlowSprite('#e8f4ff', 2.6, 0.55);
    this.own(this.glow.material);
    this.glow.position.y = CAP_Y;
    g.add(this.glow);
    this.halo = new THREE.Mesh(geo('core-halo', () => new THREE.TorusGeometry(0.62, 0.012, 6, 48)), this.own(glowMat('#ffffff', 2.2)));
    this.halo.position.y = CAP_Y;
    g.add(this.halo);

    // pillar of light after the shatter
    this.beamMat = this.own(glowMat('#ffffff', 1.6, { map: beamTex(), additive: true, opacity: 0, side: THREE.DoubleSide }));
    this.beam = new THREE.Mesh(geo('core-beam', () => new THREE.CylinderGeometry(0.55, 1.2, 40, 24, 1, true).translate(0, 20, 0)), this.beamMat);
    this.beam.position.y = BASE_H;
    this.beam.visible = false;
    this.beam.renderOrder = 5;
    g.add(this.beam);

    // shards (instanced, animated after the shatter)
    const shardMat = mat('core-shard', () => rimMat('#efe8ff', { roughness: 0.05, metalness: 0.2, rim: 0.8, rimColor: '#ffffff', emissive: '#6f5aa8', emissiveIntensity: 0.4, side: THREE.DoubleSide, flat: true }));
    this.shards = new THREE.InstancedMesh(geo('core-shard', () => new THREE.TetrahedronGeometry(0.16, 0)), shardMat, SHARDS);
    this.shards.visible = false;
    this.shards.frustumCulled = false;
    this.own({ dispose: () => this.shards.dispose() });
    g.add(this.shards);
    this.shardData = [];
    for (let i = 0; i < SHARDS; i++) this.shardData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 });

    // ---- colliders ----
    const L = session.level;
    this.pedCol = boxCollider(2.5, BASE_H, 2.5);
    this.capCol = boxCollider(1.7, TOP_Y + 0.3 - BASE_H, 1.7);
    this.capCol.position.y = BASE_H;
    g.add(this.pedCol, this.capCol);
    g.updateMatrixWorld(true);
    this.dynPed = L.addDynamic(this.pedCol, { owner: {}, tag: 'prism-core' });
    this.dynCap = L.addDynamic(this.capCol, { owner: this, tag: 'prism-core' });
  }

  hitCenter(out) { return out.set(this.position.x, this.position.y + CAP_Y, this.position.z); }

  damage(amount, info = {}) {
    if (this.state !== 'sealed') return;
    // armoured glass: every hit chips a bit, big hits are capped so it always takes a few shots
    super.damage(clamp(amount * 0.35, 4, 18), info);
  }

  onDamaged(amount, info) {
    const S = this.session;
    this.shakeT = 0.28;
    this.flashT = 0.12;
    const frac = 1 - this.hp / this.maxHp;
    this.crackTarget = frac;
    const c = this.hitCenter(_v);
    const p = info.point ? _w.copy(info.point) : _w.copy(c);
    const n = _s.subVectors(p, c).normalize();
    S.fx.burst(p, n, '#f2ecff', 8, 5, { size: 0.05 });
    S.fx.burst(p, n, this.murkCol, 5, 4, { size: 0.04 });
    S.audio?.sfx('core_hit', { pos: c, volume: 0.7, pitch: 0.9 + frac * 0.4 + Math.random() * 0.08, throttle: 0.05 });
    const stepN = Math.floor(frac * 4);
    if (stepN > this.lastCrackStep && this.hp > 0) {
      this.lastCrackStep = stepN;
      S.audio?.sfx('core_crack', { pos: c, volume: 0.8 });
      S.shake(c, 0.15);
      S.fx.ring(c, n, '#ffffff', 1.4, 0.3);
    }
  }

  onDeath() {
    // PropActor.die → no actorDefeated; start the shatter
    this.state = 'shattered';
    this.stateT = 0;
    const S = this.session;
    const c = this.hitCenter(_v).clone();
    this.dynCap.enabled = false;
    this.glass.visible = false;
    this.cracks.visible = false;
    for (const ch of this.capsule.children) ch.visible = false;
    this.capsule.children[0].visible = true;   // bottom ring stays on the pedestal
    this.capsule.children[1].visible = true;
    this.capsule.children[2].visible = true;
    // shards
    this.shards.visible = true;
    for (let i = 0; i < SHARDS; i++) {
      const d = this.shardData[i];
      const a = hash01(i, 1) * Math.PI * 2, y = hash01(i, 2) * 2 - 1;
      d.p.set(Math.cos(a) * CAP_R, CAP_Y + y * (CAP_L / 2 + CAP_R * 0.6), Math.sin(a) * CAP_R);
      d.v.set(Math.cos(a), 0.4 + hash01(i, 3) * 0.9, Math.sin(a)).multiplyScalar(4 + hash01(i, 4) * 6);
      d.r.set(hash01(i, 5) * 6, hash01(i, 6) * 6, hash01(i, 7) * 6);
      d.w.set(hash01(i, 8) - 0.5, hash01(i, 9) - 0.5, hash01(i, 10) - 0.5).multiplyScalar(18);
      d.s = 0.6 + hash01(i, 11) * 1.1;
    }
    // the lid pops off
    this.topVel.set(1.8, 7.5, 1.2);
    this.topSpin.set(4, 2, 5);
    // fx + feedback
    S.fx.explosion(c, UP, this.murkCol, 2.2);
    S.fx.explosion(c, UP, this.heroCol, 1.5);
    S.fx.burst(c, UP, '#ffffff', 40, 9, { size: 0.07, spread: 1.6 });
    S.fx.ring(_w.copy(this.position).setY(this.position.y + BASE_H + 0.05), UP, '#ffffff', 4.5, 0.7);
    S.fx.ring(_w.copy(this.position).setY(this.position.y + BASE_H + 0.05), UP, this.heroCol, 3, 0.5);
    S.flash('#ffffff', 0.55);
    S.shake(c, 0.8);
    S.input?.rumble?.(0.8, 1, 350);
    S.audio?.sfx('core_shatter', { volume: 1 });
    S.audio?.sfx('bigboom', { pos: c, volume: 0.6 });
    S.audio?.sfx('core_rise', { volume: 0.7 });
    S.audio?.duck?.(0.3, 2.5);
    S.ink.paint(this.position, 3.2, TEAM_HERO, UP, { source: 'level' });
    if (S.player) S.player.invulnerable = Math.max(S.player.invulnerable, 8);
    this.trimMat.color.copy(this.heroCol).multiplyScalar(2);
    this.slitMat.color.copy(this.heroCol).multiplyScalar(2.4);
    this.beam.visible = true;
    S.events.emit('coreShattered', { id: this.id, pos: c });
  }

  step(dt) {
    this.t += dt;
    if (this.state !== 'shattered') return;
    this.stateT += dt;
    if (!this.collected && this.stateT >= 1.35) {
      this.collected = true;
      const S = this.session;
      const pos = _v.set(this.position.x, this.position.y + CAP_Y + 1.6, this.position.z).clone();
      S.events.emit('coreCollected', { id: this.id, pos, entity: this });
      if (S.mode?.complete) S.mode.complete({ reason: 'core', id: this.id, pos });
      else {
        S.hud?.toast?.('STAGE CLEAR', 'big');
        S.audio?.sfx('victory', { volume: 0.8 });
      }
      S.fx.burst(pos, UP, '#ffffff', 30, 6, { size: 0.06, gravity: 4 });
    }
  }

  render(dt) {
    const t = this.t;
    const g = this.group;
    // crack reveal eases toward the damage level
    if (this.crackTarget > this.crack) this.crack = Math.min(this.crackTarget, this.crack + dt * 3);
    if (this.state === 'sealed') {
      this.cracks.visible = this.crack > 0.01;
      this.crackMat.alphaTest = 1.001 - this.crack * 0.92;
      // hit shake + flash
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const k = this.shakeT / 0.28;
        this.capsule.position.set(Math.sin(t * 90) * 0.05 * k, 0, Math.cos(t * 77) * 0.05 * k);
        this.top.position.x = this.capsule.position.x; this.top.position.z = this.capsule.position.z;
      } else { this.capsule.position.set(0, 0, 0); this.top.position.x = 0; this.top.position.z = 0; }
      this.flashT = Math.max(0, this.flashT - dt);
      this.glassMat.userData.rim.value = 0.9 + this.flashT * 12;
      this.glassMat.opacity = 0.3 + this.flashT * 2;
      // crystal idles inside
      this.crystal.rotation.y += dt * 0.8;
      this.crystal.position.y = CAP_Y + Math.sin(t * 1.7) * 0.06;
      this.crystal.scale.setScalar(1);
      this.halo.rotation.set(Math.PI / 2 + Math.sin(t * 0.9) * 0.3, t * 0.6, 0);
      this.glow.material.opacity = 0.45 + Math.sin(t * 2.6) * 0.1;
      this.beaconMat.color.setRGB(Math.sin(t * 6) > 0 ? 2.6 : 0.4, 0.3, 0.45);
      this.slitMat.color.copy(this.murkCol).multiplyScalar(1.8 + Math.sin(t * 3) * 0.6);
      return;
    }
    // ---- shattered: shards fly, lid tumbles, crystal rises in the light ----
    const st = this.stateT;
    if (this.shards.visible) {
      const life = 1.7;
      const k = Math.max(0, 1 - st / life);
      for (let i = 0; i < SHARDS; i++) {
        const d = this.shardData[i];
        d.v.y -= 16 * dt;
        d.p.addScaledVector(d.v, dt);
        if (d.p.y < BASE_H * 0.2) { d.p.y = BASE_H * 0.2; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; }
        d.r.addScaledVector(d.w, dt);
        _q.setFromEuler(_e.set(d.r.x, d.r.y, d.r.z));
        _s.set(d.s, d.s * 0.35, d.s * 1.4).multiplyScalar(Math.min(1, k * 2.2));
        _m.compose(d.p, _q, _s);
        this.shards.setMatrixAt(i, _m);
      }
      this.shards.instanceMatrix.needsUpdate = true;
      if (st > life) this.shards.visible = false;
    }
    if (this.top.visible) {
      this.topVel.y -= 18 * dt;
      this.top.position.addScaledVector(this.topVel, dt);
      this.top.rotation.x += this.topSpin.x * dt; this.top.rotation.z += this.topSpin.z * dt;
      if (this.top.position.y < 0.3) { this.top.position.y = 0.3; this.topVel.set(this.topVel.x * 0.5, Math.abs(this.topVel.y) * 0.3, this.topVel.z * 0.5); this.topSpin.multiplyScalar(0.5); }
      if (st > 2.2) this.top.scale.setScalar(Math.max(0.001, 1 - (st - 2.2) * 2));
      if (st > 2.7) this.top.visible = false;
    }
    const rise = easeOutCubic(st / 1.6);
    const y = CAP_Y + rise * 1.7 + Math.sin(t * 2) * 0.08 * rise;
    this.crystal.position.y = y;
    this.crystal.rotation.y += dt * (0.8 + rise * 5 + Math.max(0, 1.2 - st) * 6);
    this.crystal.rotation.z = Math.sin(t * 1.3) * 0.12;
    const sc = 1 + easeOutBack(clamp(st / 0.9, 0, 1), 2) * 0.45 + Math.sin(t * 5) * 0.03;
    this.crystal.scale.setScalar(sc);
    this.crystalMat.emissiveIntensity = 0.55 + rise * 0.9;
    this.glow.position.y = y;
    this.glow.scale.setScalar(2.6 + rise * 2.2 + Math.sin(t * 4) * 0.2);
    this.glow.material.opacity = 0.75;
    this.halo.position.y = y;
    this.halo.rotation.set(Math.PI / 2 + Math.sin(t * 1.7) * 0.5, t * 2, 0);
    this.halo.scale.setScalar(1 + rise * 0.9);
    this.beamMat.opacity = Math.min(1, st * 3) * (0.55 + Math.sin(t * 5) * 0.08);
    this.beam.scale.set(0.6 + rise * 0.6, Math.min(1, st * 2.5), 0.6 + rise * 0.6);
    this.beam.rotation.y += dt * 0.5;
    // sparkles streaming up
    this._sp = (this._sp || 0) - dt;
    if (this._sp <= 0) {
      this._sp = 0.06;
      const a = Math.random() * Math.PI * 2;
      _v.set(this.position.x + Math.cos(a) * 0.8, this.position.y + BASE_H + 0.2, this.position.z + Math.sin(a) * 0.8);
      _w.set(0, 3 + Math.random() * 3, 0);
      this.session.fx.spray(_v, _w, Math.random() < 0.5 ? '#ffffff' : this.heroCol, 1, 0.8, { size: 0.05, life: 0.9, gravity: -2 });
    }
    void g;
  }

  dispose() {
    this.session.level.removeDynamic(this.dynPed);
    this.session.level.removeDynamic(this.dynCap);
    super.dispose();
  }
}

function beamTex() {
  return canvasTex('core-beam', 16, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.92, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0.3)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

registerEntity('prism-core', (s, d) => new PrismCore(s, d));
