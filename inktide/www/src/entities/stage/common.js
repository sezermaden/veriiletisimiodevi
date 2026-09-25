// Shared helpers for stage objects: cached geometry/materials/canvas textures, a prop-flavoured
// Actor (hittable, but not an enemy: no 'actorDefeated'), a lightweight hit proxy for sub-parts
// (rail start node), group-cleared tracking and small math helpers.
import * as THREE from 'three';
import { Actor } from '../base.js';
import { TEAM_HERO, TEAM_MURK, TEAM_NONE } from '../../ink/ink-system.js';

export { TEAM_HERO, TEAM_MURK, TEAM_NONE };
export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);

// ---------------------------------------------------------------------------------------------
// Caches. Shared resources live for the whole app (a handful of small buffers); entities never
// dispose them. Per-entity resources go through entity.own(...).
const GEO = new Map();
const MAT = new Map();
const TEX = new Map();

/** Cached geometry by key. */
export function geo(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
}

/** Cached material by key. */
export function mat(key, make) {
  let m = MAT.get(key);
  if (!m) { m = make(); MAT.set(key, m); }
  return m;
}

/** Cached canvas texture by key: draw(ctx, w, h). */
export function canvasTex(key, w, h, draw, o = {}) {
  let t = TEX.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 4;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (o.nearest) { t.magFilter = THREE.NearestFilter; }
  TEX.set(key, t);
  return t;
}

/**
 * Stylised standard material with a fresnel rim (same look as actors/materials charMat) that can
 * also carry a map. Cached when `key` is given.
 */
export function rimMat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    map: o.map || null,
    normalMap: o.normalMap || null,
    roughness: o.roughness ?? 0.55,
    metalness: o.metalness ?? 0,
    emissive: o.emissive ?? '#000000',
    emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    envMapIntensity: o.env ?? 0.9,
    flatShading: !!o.flat,
    vertexColors: !!o.vertexColors,
    depthWrite: o.depthWrite ?? true,
    alphaTest: o.alphaTest ?? 0,
  });
  const rim = { value: o.rim ?? 0.3 };
  const rimColor = { value: new THREE.Color(o.rimColor ?? '#ffffff') };
  m.userData.rim = rim;
  m.userData.rimColor = rimColor;
  const emissiveFromVertex = !!o.emissiveFromVertex;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimStrength = rim;
    sh.uniforms.rimColor = rimColor;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float rimStrength;\nuniform vec3 rimColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${emissiveFromVertex ? 'totalEmissiveRadiance *= vColor.rgb;' : ''}
        {
          float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          totalEmissiveRadiance += rimColor * pow(fr, 3.0) * rimStrength;
        }`);
  };
  m.customProgramCacheKey = () => 'stage-rim' + (emissiveFromVertex ? '-ev' : '');
  return m;
}

/** Unlit HDR glow (bloom-friendly): colour * intensity. */
export function glowMat(color, intensity = 2.2, o = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({
    color: c,
    map: o.map || null,
    transparent: !!o.transparent || !!o.additive,
    opacity: o.opacity ?? 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: o.depthWrite ?? !o.additive,
    side: o.side ?? THREE.FrontSide,
    toneMapped: true,
    fog: o.fog ?? true,
  });
}

/** Soft radial sprite texture (cached). */
export function glowTexture() {
  return canvasTex('glow-soft', 128, 128, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}

/** Additive glow sprite. Caller owns the material (colour changes per entity). */
export function makeGlowSprite(color, size = 1, opacity = 0.8) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.renderOrder = 3;
  return s;
}

/** Flat, slightly domed ink splotch facing +Z (unit radius), 8 cached variants. */
export function inkBlobGeometry(i = 0) {
  const k = i % 8;
  return geo('ink-blob-' + k, () => {
    const seg = 28, seed = k * 1.7 + 0.3;
    const pos = [0, 0, 0.05], idx = [];
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const r = 1 + 0.16 * Math.sin(3 * a + seed) + 0.1 * Math.sin(5 * a + 1.7 * seed) + 0.07 * Math.sin(9 * a + 2.9 * seed);
      pos.push(Math.cos(a) * r, Math.sin(a) * r, 0.0);
      idx.push(0, 1 + s, 1 + ((s + 1) % seg));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

// ---------------------------------------------------------------------------------------------
// Emblems drawn into canvases (original designs).

/** Murk Industries emblem: an angler-lure "M" in a hexagon, centred at (cx, cy), radius r. */
export function drawMurkEmblem(x, cx, cy, r, fg = '#ffffff', bg = null) {
  x.save();
  x.translate(cx, cy);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  // hexagon
  x.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i) x.lineTo(px, py); else x.moveTo(px, py);
  }
  x.closePath();
  if (bg) { x.fillStyle = bg; x.fill(); }
  x.lineWidth = r * 0.12;
  x.strokeStyle = fg;
  x.stroke();
  // M
  x.beginPath();
  x.moveTo(-r * 0.5, r * 0.42);
  x.lineTo(-r * 0.5, -r * 0.3);
  x.lineTo(0, r * 0.18);
  x.lineTo(r * 0.5, -r * 0.3);
  x.lineTo(r * 0.5, r * 0.42);
  x.lineWidth = r * 0.16;
  x.stroke();
  // lure stalk + bulb
  x.beginPath();
  x.moveTo(0, r * 0.18);
  x.quadraticCurveTo(r * 0.05, -r * 0.55, r * 0.32, -r * 0.62);
  x.lineWidth = r * 0.07;
  x.stroke();
  x.beginPath();
  x.arc(r * 0.36, -r * 0.62, r * 0.11, 0, Math.PI * 2);
  x.fillStyle = fg;
  x.fill();
  x.restore();
}

/** Hero squid emblem (triangle mantle, two eyes, tentacles). */
export function drawSquidEmblem(x, cx, cy, r, fg = '#ffffff', eye = '#1a1640') {
  x.save();
  x.translate(cx, cy);
  x.fillStyle = fg;
  x.beginPath();
  x.moveTo(0, -r);
  x.quadraticCurveTo(r * 0.78, -r * 0.2, r * 0.62, r * 0.25);
  x.lineTo(-r * 0.62, r * 0.25);
  x.quadraticCurveTo(-r * 0.78, -r * 0.2, 0, -r);
  x.fill();
  // tentacles
  for (let i = 0; i < 4; i++) {
    const tx = -r * 0.45 + i * r * 0.3;
    x.beginPath();
    x.ellipse(tx, r * 0.52, r * 0.1, r * 0.34, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = eye;
  x.beginPath(); x.ellipse(-r * 0.22, -r * 0.05, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(r * 0.22, -r * 0.05, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); x.fill();
  x.restore();
}

export function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

/** CSS hex from THREE.Color. */
export const css = (c) => '#' + c.getHexString();

// ---------------------------------------------------------------------------------------------
/**
 * A hittable stage prop. Team MURK so hero ink hits it and Murk ink passes through. It never emits
 * 'actorDefeated' (story stats count enemies from that); it emits 'propDestroyed' instead.
 * Projectiles that hit the prop's dynamic collider (instead of its hit sphere) are forwarded
 * through onInkHit so every shot registers.
 */
export class PropActor extends Actor {
  constructor(session, def, o = {}) {
    super(session, def, { team: TEAM_MURK, ...o });
    this.prop = true;
    this.groupName = def.group || null;
  }

  onInkHit(p, hit) {
    if (!this.alive || p.team === this.team || p.team === TEAM_NONE) return;
    const dmg = Math.max(1, p.damage || 0);
    this.damage(dmg, { source: p.owner, team: p.team, point: hit.point, normal: hit.normal, dir: p.vel, kind: 'shot', paint: p.paint?.radius });
    this.session.events.emit('hit', { target: this, source: p.owner, damage: dmg, point: hit.point.clone() });
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.onDeath?.(info);
    this.session.events.emit('propDestroyed', { actor: this, by: info.source, group: this.groupName });
  }
}

/**
 * Hit sphere for a part of an entity (not an Entity itself). Lives in session.actors so shots and
 * explosions reach it; `onHit(amount, info)` fires for every hit from a team other than `team`.
 */
export class HitProxy {
  constructor(session, o = {}) {
    this.session = session;
    this.team = o.team ?? TEAM_MURK;
    this.alive = true;
    this.prop = true;
    this.hitRadius = o.radius ?? 0.4;
    this.hitHeight = o.height ?? 0.5;
    this.untargetable = false;
    this.invulnerable = 0;
    this.hp = 1; this.maxHp = 1;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.onHit = o.onHit || null;
    session.actors.push(this);
  }
  hitCenter(out) { return out.copy(this.center); }
  damage(amount, info = {}) { if (this.alive) this.onHit?.(amount, info); }
  dispose() {
    this.alive = false;
    const i = this.session.actors.indexOf(this);
    if (i >= 0) this.session.actors.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------------------------
/** Group name of an actor (enemies use groupName; fall back to the level def). */
export function groupOf(a) { return a?.groupName ?? a?.def?.group ?? null; }

/** Alive actors in a group (optionally excluding one). */
export function groupAlive(session, name, except = null) {
  let n = 0;
  for (const a of session.actors) if (a !== except && a.alive && groupOf(a) === name) n++;
  return n;
}

/**
 * Call fn once when every actor of `name` has been defeated/destroyed. Returns an unsubscribe.
 */
export function onGroupCleared(session, name, fn) {
  let done = false;
  const check = (e) => {
    if (done || groupOf(e?.actor) !== name) return;
    if (groupAlive(session, name, e.actor) === 0) { done = true; fn(); }
  };
  const a = session.events.on('actorDefeated', check);
  const b = session.events.on('propDestroyed', check);
  return () => { a(); b(); };
}

/**
 * Subscribe to an activation spec: 'group:<g>', 'event:<name>', 'switch:<id>', 'balloons:<g>'.
 * Returns an unsubscribe (or null for unknown/empty specs).
 */
export function onSpec(session, spec, fn) {
  if (!spec || typeof spec !== 'string') return null;
  const i = spec.indexOf(':');
  const kind = i < 0 ? spec : spec.slice(0, i);
  const arg = i < 0 ? '' : spec.slice(i + 1);
  if (kind === 'group' && arg) return onGroupCleared(session, arg, fn);
  if (kind === 'event' && arg) return session.events.on(arg, fn);
  if (kind === 'switch' && arg) return session.events.on('switch', (id) => { if ((id?.id ?? id) === arg) fn(); });
  if (kind === 'balloons' && arg) return session.events.on('balloons:' + arg, fn);
  return null;
}

// ---------------------------------------------------------------------------------------------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t, 0, 1) - 1; return 1 + t * t * ((s + 1) * t + s); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/** Deterministic hash → [0,1). */
export function hash01(a, b = 0, c = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const _hc = new THREE.Vector3();
/** Horizontal distance² and vertical offset from a point to the player's feet. */
export function playerOffset(session, p, out = { h2: 0, dy: 0 }) {
  const pl = session.player.position;
  const dx = pl.x - p.x, dz = pl.z - p.z;
  out.h2 = dx * dx + dz * dz;
  out.dy = pl.y - p.y;
  return out;
}

/** Player chest point. */
export function playerCenter(session, out = _hc) {
  return session.player.hitCenter(out);
}

/** A unit box collider mesh (invisible) sized w×h×d, bottom at y=0 unless centred. */
export function boxCollider(w, h, d, centered = false) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!centered) g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, INVISIBLE);
  m.visible = false;
  m.userData.ownGeometry = true;
  return m;
}
export const INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });

/** Toast / hud helpers that tolerate a missing HUD. */
export function toast(session, text, kind) { session.hud?.toast?.(text, kind); }
