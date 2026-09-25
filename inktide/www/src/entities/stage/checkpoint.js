// Checkpoint beacon: a pole with a Murk flag that flips to the hero's colours when touched and
// becomes the respawn point.
//   { type: 'checkpoint', pos, yaw }   yaw = facing after respawn (0 looks toward +Z)
import * as THREE from 'three';
import { Entity, registerEntity } from '../base.js';
import {
  geo, mat, rimMat, glowMat, canvasTex, drawMurkEmblem, drawSquidEmblem, makeGlowSprite,
  TEAM_HERO, TEAM_MURK, UP, DOWN, clamp, easeOutBack, playerOffset,
} from './common.js';

const FLAG_W = 1.2, FLAG_H = 0.74, POLE_TOP = 3.15;
const _v = new THREE.Vector3();
const _o = { h2: 0, dy: 0 };

function flagTexture(kind) {
  return canvasTex('cp-flag-' + kind, 256, 160, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    // hem stripe at the pole side + trailing edge darker band
    x.fillStyle = '#d9d9e6'; x.fillRect(w - 18, 0, 18, h);
    x.fillStyle = 'rgba(20,18,50,0.18)';
    for (let i = 0; i < 5; i++) x.fillRect(0, i * 32 + 14, w - 18, 3);
    if (kind === 'murk') drawMurkEmblem(x, w * 0.46, h * 0.5, 50, '#1b1838');
    else drawSquidEmblem(x, w * 0.46, h * 0.52, 50, '#1b1838', '#ffffff');
  });
}

function beamTexture() {
  return canvasTex('cp-beam', 8, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

class Checkpoint extends Entity {
  constructor(session, def) {
    super(session, def);
    this.active = false;
    this.radius = def.radius ?? 1.7;
    this.t = Math.random() * 10;
    this.flipT = -1;
    this.heroCol = session.ink.color(TEAM_HERO).clone();
    this.murkCol = session.ink.color(TEAM_MURK).clone();
    const g = this.group;

    const steel = mat('cp-steel', () => rimMat('#2a2f48', { roughness: 0.42, metalness: 0.45, rim: 0.25 }));
    const white = mat('cp-white', () => rimMat('#f4f1ea', { roughness: 0.3, rim: 0.2 }));
    const dark = mat('cp-dark', () => rimMat('#171a2c', { roughness: 0.5, rim: 0.1 }));

    const base = new THREE.Mesh(geo('cp-base', () => new THREE.CylinderGeometry(0.62, 0.74, 0.24, 8)), steel);
    base.position.y = 0.12;
    const plinth = new THREE.Mesh(geo('cp-plinth', () => new THREE.CylinderGeometry(0.26, 0.34, 0.32, 8)), dark);
    plinth.position.y = 0.4;
    const pole = new THREE.Mesh(geo('cp-pole', () => new THREE.CylinderGeometry(0.05, 0.07, POLE_TOP - 0.5, 10)), white);
    pole.position.y = 0.5 + (POLE_TOP - 0.5) / 2;
    const band1 = new THREE.Mesh(geo('cp-band', () => new THREE.CylinderGeometry(0.085, 0.085, 0.08, 10)), dark);
    band1.position.y = 1.1;
    const band2 = band1.clone(); band2.position.y = POLE_TOP - 0.06;
    for (const m of [base, plinth, pole, band1, band2]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(base, plinth, pole, band1, band2);

    // glowing parts recolour on activation → per-entity materials
    this.glow = this.own(glowMat(this.murkCol, 1.8));
    this.ring = new THREE.Mesh(geo('cp-ring', () => new THREE.TorusGeometry(0.6, 0.045, 8, 36)), this.glow);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.25;
    this.orb = new THREE.Mesh(geo('cp-orb', () => new THREE.SphereGeometry(0.13, 16, 12)), this.glow);
    this.orb.position.y = POLE_TOP + 0.1;
    this.halo = makeGlowSprite(this.murkCol, 0.9, 0.55);
    this.own(this.halo.material);
    this.halo.position.y = POLE_TOP + 0.1;
    g.add(this.ring, this.orb, this.halo);

    // flag cloth (CPU wave, a few dozen vertices)
    const fg = new THREE.PlaneGeometry(FLAG_W, FLAG_H, 12, 6);
    fg.translate(-FLAG_W / 2, -FLAG_H / 2, 0);        // hangs from its top-right corner at the pole
    this.flagBase = Float32Array.from(fg.attributes.position.array);
    this.flagGeo = this.own(fg);
    this.flagMat = this.own(new THREE.MeshStandardMaterial({
      map: flagTexture('murk'), color: this.murkCol, roughness: 0.75, side: THREE.DoubleSide,
      emissive: this.murkCol, emissiveIntensity: 0.12,
    }));
    this.flag = new THREE.Mesh(fg, this.flagMat);
    this.flag.castShadow = true;
    this.flagPivot = new THREE.Group();
    this.flagPivot.position.set(-0.06, POLE_TOP - 0.62, 0);   // starts at half-mast
    this.flagPivot.add(this.flag);
    g.add(this.flagPivot);

    // light beam that fires on activation
    this.beamMat = this.own(glowMat(this.heroCol, 1.4, { map: beamTexture(), additive: true, opacity: 0, side: THREE.DoubleSide }));
    this.beam = new THREE.Mesh(geo('cp-beam', () => new THREE.CylinderGeometry(0.35, 0.7, 9, 18, 1, true).translate(0, 4.5, 0)), this.beamMat);
    this.beam.visible = false;
    this.beam.renderOrder = 4;
    g.add(this.beam);
    g.updateMatrixWorld(true);
  }

  step(dt) {
    this.t += dt;
    if (this.active) return;
    const p = this.session.player;
    if (!p.alive) return;
    playerOffset(this.session, this.position, _o);
    if (_o.h2 < this.radius * this.radius && _o.dy > -1 && _o.dy < 2.8) this.activate();
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.flipT = 0;
    const S = this.session;
    const yaw = this.def.yaw ?? this.group.rotation.y ?? 0;
    // respawn beside the pole (local +X), facing the checkpoint's forward
    const off = this.def.respawn || [1.25, 0, 0.35];
    const pos = _v.set(off[0], off[1] + 0.5, off[2]).applyAxisAngle(UP, this.group.rotation.y).add(this.position);
    const g = S.level.raycast(pos, DOWN, 3);
    if (g && g.normal.y > 0.6) pos.y = g.point.y; else pos.y = this.position.y;
    const respawn = pos.clone();
    S.setCheckpoint(respawn, yaw);
    S.mode?.checkpoint?.(respawn, yaw);
    if (!S.mode?.checkpoint) S.hud?.toast?.('Checkpoint!');
    S.audio?.sfx('checkpoint', { pos: this.position, volume: 0.8 });
    const top = _v.copy(this.position).setY(this.position.y + POLE_TOP);
    S.fx.burst(top, UP, this.heroCol, 26, 7, { size: 0.08, spread: 1.4 });
    S.fx.burst(top, UP, '#ffffff', 10, 5, { size: 0.05 });
    S.fx.ring(_v.copy(this.position).setY(this.position.y + 0.05), UP, this.heroCol, 2.4, 0.6);
    S.fx.ring(_v.copy(this.position).setY(this.position.y + 0.05), UP, '#ffffff', 1.4, 0.4);
    S.ink.paint(this.position, 1.5, TEAM_HERO, UP, { source: 'level' });
    S.events.emit('checkpoint', { id: this.id, pos: respawn, yaw });
    this.beam.visible = true;
  }

  render(dt) {
    const t = this.t;
    // flag wave
    const pos = this.flagGeo.attributes.position;
    const a = pos.array, b = this.flagBase;
    const amp = this.active ? 0.1 : 0.06;
    for (let i = 0; i < a.length; i += 3) {
      const x = -b[i];                       // 0 at the pole → FLAG_W at the tip
      const k = x / FLAG_W;
      a[i + 2] = Math.sin(x * 4.4 - t * 6.2) * amp * k + Math.sin(x * 9 - t * 9.1) * 0.015 * k;
      a[i + 1] = b[i + 1] - k * k * (this.active ? 0.03 : 0.1);
    }
    pos.needsUpdate = true;
    this.flagGeo.computeVertexNormals();

    // flip + raise
    if (this.flipT >= 0) {
      this.flipT += dt;
      const f = this.flipT;
      if (f < 0.18) this.flagPivot.scale.x = 1 - f / 0.18;
      else {
        if (this.flagMat.map !== flagTexture('hero')) {
          this.flagMat.map = flagTexture('hero');
          this.flagMat.color.copy(this.heroCol);
          this.flagMat.emissive.copy(this.heroCol);
          this.glow.color.copy(this.heroCol).multiplyScalar(2.2);
          this.halo.material.color.copy(this.heroCol);
          this.flagMat.needsUpdate = true;
        }
        this.flagPivot.scale.x = Math.max(0.02, easeOutBack((f - 0.18) / 0.4, 2.4));
      }
      this.flagPivot.position.y = POLE_TOP - 0.62 + 0.62 * easeOutBack(clamp(f / 0.7, 0, 1), 1.2);
      this.beamMat.opacity = f < 0.1 ? f * 8 : Math.max(0, 0.8 * (1 - (f - 0.1) / 1.6));
      this.beam.scale.set(1 + f * 0.6, Math.min(1, f * 4), 1 + f * 0.6);
      if (f > 1.8) { this.flipT = -1; this.beam.visible = false; this.flagPivot.scale.x = 1; }
    } else if (this.flagPivot.scale.x < 0.02) this.flagPivot.scale.x = 0.02;
    if (this.flagPivot.scale.x < 0.02) this.flagPivot.scale.x = 0.02;

    // glow pulse
    const pulse = 0.75 + Math.sin(t * (this.active ? 2.2 : 4.5)) * 0.25;
    this.ring.scale.setScalar(1 + (this.active ? 0.04 : 0.02) * Math.sin(t * 3));
    this.halo.material.opacity = 0.35 + pulse * 0.35;
    this.halo.scale.setScalar(0.8 + pulse * 0.35);
  }
}

registerEntity('checkpoint', (s, d) => new Checkpoint(s, d));
