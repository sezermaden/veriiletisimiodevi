// Decor prop library. Every prop is assembled from shared unit primitives; all props of a session
// are merged into one InstancedMesh per (geometry, material, animation) bucket, so a hundred props
// cost a few dozen draw calls. Ambient motion (palm sway, buoy bob, flag wave, dish pan, radar
// spin) runs entirely in the vertex shader. Signs, billboards and graffiti carry unique canvas art.
//
//   { type: 'decor', kind, pos, yaw?, scale?, color?, text?, collide?: false, ...kind params }
//   kinds: lamp, barrel, crate-stack, bench, palm, bush, flowerpot, neon-sign, billboard, graffiti,
//          crane, buoy, cone, antenna, pipe, vat, flag, railing, fence, speaker-tower, tire-stack,
//          hydrant, vending, awning, satellite, chimney
//   extra params: height (lamp, antenna, flag, speaker-tower, neon-sign/graffiti/awning mount height),
//          length (pipe, railing, fence, awning), count (crate-stack, tire-stack), variant
//          (barrel: 'toxic', fence: 'picket', antenna: 'radar', neon-sign: pole:true), size (graffiti
//          width or [w,h]), style (graffiti: tag|squid|arrow), radius (pipe, vat)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Entity, registerEntity } from '../base.js';
import { geo, mat, hash01, INVISIBLE } from './common.js';
import { crateTexture } from './crate.js';
import { billboardTexture, graffitiTexture, neonTexture, vendingTexture, chainTexture, brickTexture, BRANDS } from './decor-art.js';

const PROP_TIME = { value: 0 };
const PI = Math.PI, HP = Math.PI / 2;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// Geometry library

function frondGeometry() {
  const N = 12, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    const w = 0.17 * Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.08)), 0.7) * (i % 2 ? 1 : 0.78);
    const y = 0.22 * x - 0.62 * x * x;
    const fold = w * 0.45;
    pos.push(x, y - fold, -w, x, y, 0, x, y - fold, w);
    if (i < N) {
      const a = i * 3, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function dishGeometry() {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const r = (i / 8) * 0.5; pts.push(new THREE.Vector2(Math.max(0.001, r), r * r * 0.9)); }
  return new THREE.LatheGeometry(pts, 24);
}

const GEO_MAKERS = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  rbox: () => new RoundedBoxGeometry(1, 1, 1, 2, 0.08),
  cyl: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cyl8: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl24: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
  cone: () => new THREE.CylinderGeometry(0, 0.5, 1, 16),
  frustum: () => new THREE.CylinderGeometry(0.5, 0.38, 1, 16),
  taper: () => new THREE.CylinderGeometry(0.4, 0.5, 1, 12),
  shade: () => new THREE.CylinderGeometry(0.2, 0.5, 1, 16),
  sphere: () => new THREE.SphereGeometry(0.5, 16, 12),
  hemi: () => new THREE.SphereGeometry(0.5, 16, 8, 0, PI * 2, 0, HP),
  hemiDown: () => new THREE.SphereGeometry(0.5, 16, 8, 0, PI * 2, HP, HP),
  ico: () => new THREE.IcosahedronGeometry(0.5, 1),
  torus: () => new THREE.TorusGeometry(0.5, 0.08, 8, 24),
  ring: () => new THREE.TorusGeometry(0.5, 0.025, 6, 32),
  tire: () => new THREE.TorusGeometry(0.5, 0.22, 10, 22),
  plane: () => new THREE.PlaneGeometry(1, 1),
  cloth: () => new THREE.PlaneGeometry(1, 1, 12, 4).translate(0.5, 0, 0),
  beam: () => new THREE.CylinderGeometry(0.08, 0.5, 1, 16, 1, true).translate(0, -0.5, 0),
  frond: frondGeometry,
  dish: dishGeometry,
  scallop: () => new THREE.CircleGeometry(0.5, 12, PI, PI),
  tcone: () => new THREE.CylinderGeometry(0.035, 0.18, 0.62, 16),
  tband1: () => new THREE.CylinderGeometry(0.106, 0.126, 0.08, 16),
  tband2: () => new THREE.CylinderGeometry(0.073, 0.088, 0.06, 16),
};

// ---------------------------------------------------------------------------------------------
// Materials: white base × per-instance colour; `glow` is unlit HDR (instance colour > 1 blooms).
const MAT_DEFS = {
  paint: { roughness: 0.42, metalness: 0.08, rim: 0.22 },
  gloss: { roughness: 0.18, metalness: 0.05, rim: 0.32, env: 1.3 },
  matte: { roughness: 0.86, rim: 0.1 },
  metal: { roughness: 0.3, metalness: 0.75, rim: 0.18 },
  rubber: { roughness: 0.93, rim: 0.05 },
  leaf: { roughness: 0.6, rim: 0.3, rimColor: '#f0ffb0', side: THREE.DoubleSide },
  cloth: { roughness: 0.78, rim: 0.18, side: THREE.DoubleSide },
  glass: { roughness: 0.05, metalness: 0.4, rim: 0.55, env: 1.7 },
  crate: { roughness: 0.78, rim: 0.14, map: () => crateTexture() },
  brick: { roughness: 0.88, rim: 0.1, map: () => brickTexture() },
  chain: { roughness: 0.4, metalness: 0.6, rim: 0.1, map: () => { const t = chainTexture().clone(); t.repeat.set(12, 9); return t; }, transparent: true, alphaTest: 0.02, depthWrite: false, side: THREE.DoubleSide, noShadow: true },
  glow: { basic: true },
  screen: { basic: true, map: () => vendingTexture() },
  beam: { basic: true, additive: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide },
};

const ANIM_COMMON = /* glsl */`
uniform float propTime;
attribute vec4 aAnim;
mat3 pRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 pRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 pRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void propAnim(out mat3 R, out vec3 T) {
  R = mat3(1.0); T = vec3(0.0);
  float ph = aAnim.w;
  #if defined(ANIM_BOB)
    R = pRotX(sin(propTime * 1.3 + ph) * 0.07) * pRotZ(cos(propTime * 1.05 + ph * 1.7) * 0.07);
    T.y = sin(propTime * 1.6 + ph) * 0.1;
  #elif defined(ANIM_SPIN)
    R = pRotY(propTime * 0.9 + ph);
  #elif defined(ANIM_PAN)
    R = pRotY(sin(propTime * 0.28 + ph) * 0.55);
  #endif
}`;

const ANIM_NORMAL = /* glsl */`
mat3 aR_; vec3 aT_; propAnim(aR_, aT_);
vec3 transformedNormal = objectNormal;
#ifdef USE_INSTANCING
  mat3 im = mat3( instanceMatrix );
  transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
  transformedNormal = im * transformedNormal;
#endif
transformedNormal = aR_ * transformedNormal;
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
  transformedNormal = - transformedNormal;
#endif`;

const ANIM_PROJECT = /* glsl */`
mat3 bR_; vec3 bT_; propAnim(bR_, bT_);
vec4 animW = instanceMatrix * vec4( transformed, 1.0 );
animW.xyz = aAnim.xyz + bR_ * ( animW.xyz - aAnim.xyz ) + bT_;
#if defined(ANIM_SWAY) || defined(ANIM_RUSTLE)
{
  #ifdef ANIM_SWAY
    float sH = 6.0; float sA = 0.26;
  #else
    float sH = 1.2; float sA = 0.045;
  #endif
  float hh = max(0.0, animW.y - aAnim.y) / sH;
  float kk = hh * hh;
  animW.x += (sin(propTime * 1.1 + aAnim.w) * sA + sin(propTime * 2.9 + aAnim.w * 1.3 + animW.y * 1.7) * sA * 0.2) * kk;
  animW.z += cos(propTime * 0.85 + aAnim.w * 1.7) * sA * 0.7 * kk;
}
#endif
#ifdef ANIM_WAVE
{
  vec3 cn = normalize( mat3( instanceMatrix ) * vec3( 0.0, 0.0, 1.0 ) );
  float fx = clamp( transformed.x, 0.0, 1.0 );
  float sx = length( mat3( instanceMatrix ) * vec3( 1.0, 0.0, 0.0 ) );
  animW.xyz += cn * ( sin( fx * 5.5 - propTime * 6.0 + aAnim.w ) * 0.09 + sin( fx * 11.0 - propTime * 9.0 + aAnim.w ) * 0.02 ) * fx * sx;
  animW.y -= fx * fx * 0.05 * sx;
}
#endif
vec4 mvPosition = modelViewMatrix * animW;
gl_Position = projectionMatrix * mvPosition;`;

const ANIM_WORLD = /* glsl */`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  vec4 worldPosition = modelMatrix * animW;
#endif`;

function propMaterial(key, anim) {
  return mat('decor:' + key + '@' + (anim || ''), () => {
    const d = MAT_DEFS[key] || MAT_DEFS.paint;
    const map = d.map ? d.map() : null;
    let m;
    if (d.basic) {
      m = new THREE.MeshBasicMaterial({
        color: 0xffffff, map, transparent: !!d.additive || (d.opacity ?? 1) < 1, opacity: d.opacity ?? 1,
        blending: d.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: d.depthWrite ?? true, side: d.side ?? THREE.FrontSide,
      });
    } else {
      m = new THREE.MeshStandardMaterial({
        color: 0xffffff, map, roughness: d.roughness ?? 0.5, metalness: d.metalness ?? 0, side: d.side ?? THREE.FrontSide,
        alphaTest: d.alphaTest ?? 0, envMapIntensity: d.env ?? 0.9,
        transparent: !!d.transparent, depthWrite: d.depthWrite ?? true,
      });
    }
    const rim = d.basic ? null : { value: d.rim ?? 0.2 };
    const rimColor = { value: new THREE.Color(d.rimColor ?? '#ffffff') };
    if (anim) m.defines = { ['ANIM_' + anim.toUpperCase()]: '' };
    m.onBeforeCompile = (sh) => {
      if (rim) {
        sh.uniforms.rimStrength = rim; sh.uniforms.rimColor = rimColor;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float rimStrength;\nuniform vec3 rimColor;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            { float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
              totalEmissiveRadiance += rimColor * pow(fr, 3.0) * rimStrength; }`);
      }
      if (anim) {
        sh.uniforms.propTime = PROP_TIME;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\n' + ANIM_COMMON)
          .replace('#include <defaultnormal_vertex>', ANIM_NORMAL)
          .replace('#include <project_vertex>', ANIM_PROJECT)
          .replace('#include <worldpos_vertex>', ANIM_WORLD);
      }
    };
    m.customProgramCacheKey = () => `decor|${d.basic ? 'b' : 's'}|${anim || ''}`;
    return m;
  });
}

/** Shadow-pass material for animated buckets: the same vertex motion, so shadows sway too. */
function propDepthMaterial(anim) {
  return mat('decor-depth@' + anim, () => {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.defines = { ['ANIM_' + anim.toUpperCase()]: '' };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.propTime = PROP_TIME;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + ANIM_COMMON)
        .replace('#include <project_vertex>', ANIM_PROJECT);
    };
    m.customProgramCacheKey = () => 'decor-depth|' + anim;
    return m;
  });
}

// ---------------------------------------------------------------------------------------------
// Per-session batch of every decor part

const BATCHES = new WeakMap();

class DecorBatch {
  constructor(session) {
    this.session = session;
    this.props = new Set();
    this.meshes = [];
    this.group = new THREE.Group();
    this.group.name = 'decor-batch';
    session.scene.add(this.group);
    this.queued = false;
    this.disposed = false;
  }

  add(p) { this.props.add(p); this._queue(); }

  delete(p) {
    this.props.delete(p);
    if (!this.props.size) this.dispose(); else this._queue();
  }

  // Rebuild once after a burst of adds/removes (stage load spawns everything synchronously and
  // awaits before compiling shaders, so the batch exists by the first frame).
  _queue() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => { this.queued = false; if (!this.disposed) this.rebuild(); });
  }

  rebuild() {
    this._clear();
    const buckets = new Map();
    for (const p of this.props) {
      for (const part of p.parts) {
        const k = part.g + '|' + part.m + '|' + (part.anim || '');
        let b = buckets.get(k);
        if (!b) buckets.set(k, (b = []));
        b.push(part);
      }
    }
    for (const list of buckets.values()) {
      const { g, m, anim } = list[0];
      const n = list.length;
      let geom = geo('decor-' + g, GEO_MAKERS[g] || GEO_MAKERS.box);
      let owned = null;
      if (anim) {
        owned = geom.clone();
        const arr = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) arr.set(list[i].animVec, i * 4);
        owned.setAttribute('aAnim', new THREE.InstancedBufferAttribute(arr, 4));
        geom = owned;
      }
      const mesh = new THREE.InstancedMesh(geom, propMaterial(m, anim), n);
      for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, list[i].matrix); mesh.setColorAt(i, list[i].color); }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (anim && mesh.boundingSphere) mesh.boundingSphere.radius += 2;
      const d = MAT_DEFS[m] || {};
      mesh.castShadow = !d.basic && !d.noShadow;
      mesh.receiveShadow = !d.basic;
      if (anim && mesh.castShadow) mesh.customDepthMaterial = propDepthMaterial(anim);
      mesh.renderOrder = d.additive ? 3 : 0;
      mesh.userData.owned = owned;
      mesh.name = 'decor:' + g + ':' + m;
      this.group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  _clear() {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.dispose();
      m.userData.owned?.dispose();
    }
    this.meshes.length = 0;
  }

  dispose() {
    this.disposed = true;
    this._clear();
    this.session.scene.remove(this.group);
    if (BATCHES.get(this.session) === this) BATCHES.delete(this.session);
  }
}

function batchFor(session) {
  let b = BATCHES.get(session);
  if (!b || b.disposed) { b = new DecorBatch(session); BATCHES.set(session, b); }
  return b;
}

/** Stats for tests / perf overlays. */
export function decorStats(session) {
  const b = BATCHES.get(session);
  if (!b) return { props: 0, meshes: 0, instances: 0 };
  let inst = 0;
  for (const m of b.meshes) inst += m.count;
  return { props: b.props.size, meshes: b.meshes.length, instances: inst };
}

// ---------------------------------------------------------------------------------------------
// Builder handed to every kind

class Builder {
  constructor(def, seed) {
    this.def = def;
    this.seed = seed;
    this.parts = [];
    this.anim = null;
    this.pivot = null;
    this.colliders = [];
    this.unique = [];
    this.updaters = [];
  }
  /** part(geometry, material, colour | [colour, intensity], [x,y,z], [sx,sy,sz], [rx,ry,rz]) */
  part(g, m, color, pos, scl, rot, o) {
    this.parts.push({ g, m, color, pos, scl, rot, anim: o?.anim ?? this.anim, pivot: o?.pivot ?? this.pivot });
    return this;
  }
  /** Solid box collider (used only when def.collide): w,h,d, centre x/z, bottom y. */
  collide(w, h, d, x = 0, y = 0, z = 0) { this.colliders.push([w, h, d, x, y, z]); return this; }
  rnd(k) { return hash01(this.seed * 97.1, k); }
  pick(list, k = 0) { return list[Math.floor(this.rnd(k) * list.length) % list.length]; }
  /** Thin rod between two points (boxes: cables, braces, guy wires). */
  rod(m, color, a, b, t = 0.05) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    _p.set(dx, dy, dz).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _p);
    _e.setFromQuaternion(_q);
    return this.part('box', m, color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [t, len, t], [_e.x, _e.y, _e.z]);
  }
}

const G = (c, k) => [c, k];          // glow colour helper
const darker = (c, k = 0.6) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// ---------------------------------------------------------------------------------------------
// Kinds (local space: metres, +Y up, front = +Z, origin on the ground)

const KINDS = {
  lamp(b, d) {
    const h = d.height ?? 4.2, c = d.color ?? '#2c3752', gold = '#d9b45a';
    b.part('cyl8', 'paint', darker(c, 0.8), [0, 0.16, 0], [0.46, 0.32, 0.46]);
    b.part('cyl', 'metal', gold, [0, 0.34, 0], [0.3, 0.05, 0.3]);
    b.part('cyl', 'paint', c, [0, 0.3 + (h - 0.3) / 2, 0], [0.13, h - 0.3, 0.13]);
    b.part('torus', 'metal', gold, [0, 1.25, 0], [0.18, 0.18, 0.18], [HP, 0, 0]);
    b.part('torus', 'metal', gold, [0, h - 0.25, 0], [0.18, 0.18, 0.18], [HP, 0, 0]);
    b.part('sphere', 'paint', c, [0, h, 0], [0.16, 0.16, 0.16]);
    b.part('box', 'paint', c, [0, h - 0.06, 0.45], [0.07, 0.07, 0.9]);
    b.rod('paint', c, [0, h - 0.6, 0], [0, h - 0.08, 0.5], 0.05);
    b.part('shade', 'paint', darker(c, 0.9), [0, h - 0.16, 0.9], [0.52, 0.2, 0.52]);
    b.part('cyl', 'paint', darker(c, 0.7), [0, h - 0.04, 0.9], [0.14, 0.08, 0.14]);
    b.part('sphere', 'glow', G(d.light ?? '#ffd79a', 3.2), [0, h - 0.28, 0.9], [0.24, 0.16, 0.24]);
    b.part('beam', 'beam', G(d.light ?? '#ffcf8a', 1), [0, h - 0.3, 0.9], [2.2, h - 0.3, 2.2]);
    b.collide(0.45, h, 0.45);
  },

  barrel(b, d) {
    const toxic = d.variant === 'toxic';
    const c = d.color ?? (toxic ? '#5b3fa0' : b.pick(['#2f7fd8', '#e0442a', '#f2b134', '#3aa06a'], 1));
    const band = darker(c, 0.62);
    b.part('cyl', 'paint', c, [0, 0.47, 0], [0.62, 0.9, 0.62]);
    b.part('torus', 'metal', band, [0, 0.28, 0], [0.63, 0.63, 0.5], [HP, 0, 0]);
    b.part('torus', 'metal', band, [0, 0.66, 0], [0.63, 0.63, 0.5], [HP, 0, 0]);
    b.part('torus', 'metal', band, [0, 0.92, 0], [0.6, 0.6, 0.5], [HP, 0, 0]);
    b.part('cyl', 'paint', band, [0, 0.925, 0], [0.56, 0.02, 0.56]);
    b.part('cyl8', 'metal', '#9aa0ad', [0.14, 0.945, 0.08], [0.08, 0.04, 0.08]);
    b.part('cyl', 'matte', toxic ? '#1b1b22' : '#f2efe6', [0, 0.47, 0], [0.625, 0.2, 0.625]);
    if (toxic) {
      b.part('cyl', 'glow', G('#9dff5a', 2.2), [0, 0.47, 0], [0.63, 0.05, 0.63]);
      b.part('cyl', 'glow', G('#9dff5a', 1.6), [0, 0.935, 0], [0.42, 0.012, 0.42]);
    }
    b.collide(0.62, 0.95, 0.62);
  },

  'crate-stack'(b, d) {
    const n = Math.max(1, Math.min(5, d.count ?? 3));
    const tint = d.color ?? '#ffffff';
    const spots = [[-0.55, 0.5, 0, 1, 0.05], [0.56, 0.5, 0.06, 1, -0.09], [0.02, 1.45, 0.02, 0.9, 0.22], [0.25, 0.4, 1.05, 0.8, 0.4], [-0.9, 0.35, 0.95, 0.7, -0.3]];
    for (let i = 0; i < n; i++) {
      const [x, y, z, s, r] = spots[i];
      b.part('box', 'crate', tint, [x, y * s / (i === 2 ? 0.9 : 1), z], [s, s, s], [0, r, 0]);
    }
    b.collide(2.2, n >= 3 ? 1.9 : 1, 1.1, 0, 0, 0);
  },

  bench(b, d) {
    const wood = d.color ?? '#c07a42', iron = '#2b3144';
    for (let i = 0; i < 3; i++) b.part('box', 'matte', i === 1 ? darker(wood, 0.92) : wood, [0, 0.46, -0.14 + i * 0.15], [1.8, 0.05, 0.13]);
    for (let i = 0; i < 2; i++) b.part('box', 'matte', wood, [0, 0.66 + i * 0.17, -0.37 - i * 0.03], [1.8, 0.11, 0.04], [-0.18, 0, 0]);
    for (const x of [-0.78, 0.78]) {
      b.part('box', 'metal', iron, [x, 0.23, 0.12], [0.07, 0.46, 0.07]);
      b.part('box', 'metal', iron, [x, 0.46, -0.36], [0.07, 0.95, 0.07], [-0.18, 0, 0]);
      b.part('box', 'metal', iron, [x, 0.62, -0.08], [0.07, 0.05, 0.5]);
      b.part('box', 'metal', iron, [x, 0.02, -0.12], [0.1, 0.04, 0.62]);
      b.part('sphere', 'metal', iron, [x, 0.62, 0.16], [0.08, 0.08, 0.08]);
    }
    b.collide(1.9, 0.9, 0.7, 0, 0, -0.1);
  },

  palm(b, d) {
    b.anim = 'sway';
    const bark = ['#a47b52', '#8c6644'];
    let x = 0, y = 0, lean = 0;
    const segs = 7, lenS = 0.86;
    const dir = b.rnd(3) * PI * 2;
    for (let i = 0; i < segs; i++) {
      lean += 0.045 + b.rnd(10 + i) * 0.02;
      const r = 0.21 - i * 0.012;
      const cx = x + Math.sin(lean) * lenS / 2, cy = y + Math.cos(lean) * lenS / 2;
      b.part('taper', 'matte', bark[i % 2], [cx * Math.cos(dir), cy, cx * Math.sin(dir)], [r * 2, lenS * 1.04, r * 2], [0, -dir, -lean]);
      x += Math.sin(lean) * lenS; y += Math.cos(lean) * lenS;
    }
    const tx = x * Math.cos(dir), tz = x * Math.sin(dir), ty = y;
    const greens = ['#3fae4f', '#2f9a45', '#56c25a', '#44b35a'];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.4;
      b.part('sphere', 'gloss', '#5a3b22', [tx + Math.cos(a) * 0.17, ty - 0.18, tz + Math.sin(a) * 0.17], [0.22, 0.24, 0.22]);
    }
    const nf = 9;
    for (let i = 0; i < nf; i++) {
      const a = (i / nf) * PI * 2 + b.rnd(40 + i) * 0.4;
      const len = 2.2 + b.rnd(50 + i) * 0.6;
      b.part('frond', 'leaf', greens[i % greens.length], [tx, ty, tz], [len, len * 0.9, len * 1.1], [0, a, 0.32 + b.rnd(60 + i) * 0.2]);
    }
    for (let i = 0; i < 3; i++) b.part('frond', 'leaf', '#6fd35c', [tx, ty + 0.05, tz], [1.1, 1.2, 1.1], [0, (i / 3) * PI * 2, 1.05]);
    b.part('sphere', 'matte', '#6b4a2e', [tx, ty, tz], [0.32, 0.26, 0.32]);
    b.anim = null;
    b.collide(0.5, ty, 0.5);
  },

  bush(b, d) {
    b.anim = 'rustle';
    const base = d.color ?? '#3c9f48';
    const c = new THREE.Color(base);
    const blobs = [[0, 0.5, 0, 1.1], [0.55, 0.4, 0.1, 0.8], [-0.5, 0.38, 0.05, 0.85], [0.1, 0.36, 0.5, 0.75], [-0.1, 0.36, -0.45, 0.8], [0.15, 0.85, -0.05, 0.7]];
    blobs.forEach(([x, y, z, s], i) => {
      const k = 0.85 + b.rnd(20 + i) * 0.3;
      b.part('ico', 'leaf', '#' + c.clone().multiplyScalar(k).getHexString(), [x, y, z], [s, s * 0.85, s], [b.rnd(i) * 3, b.rnd(i + 9) * 3, 0]);
    });
    if (d.flowers !== false) {
      const fc = d.flowerColor ?? b.pick(['#ff7ab8', '#ffd23f', '#ffffff', '#ff5f5f'], 5);
      for (let i = 0; i < 8; i++) {
        const a = b.rnd(100 + i) * PI * 2, r = 0.35 + b.rnd(110 + i) * 0.35;
        b.part('sphere', 'gloss', fc, [Math.cos(a) * r, 0.55 + b.rnd(120 + i) * 0.45, Math.sin(a) * r], [0.12, 0.08, 0.12]);
      }
    }
    b.anim = null;
    b.collide(1.6, 1, 1.4);
  },

  flowerpot(b, d) {
    const pot = d.potColor ?? '#c9653a';
    b.part('frustum', 'matte', pot, [0, 0.25, 0], [0.62, 0.5, 0.62]);
    b.part('torus', 'matte', darker(pot, 0.9), [0, 0.5, 0], [0.64, 0.64, 0.9], [HP, 0, 0]);
    b.part('cyl', 'matte', '#4a3222', [0, 0.47, 0], [0.55, 0.04, 0.55]);
    b.anim = 'rustle';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.3;
      b.part('ico', 'leaf', i % 2 ? '#3fae4f' : '#58c160', [Math.cos(a) * 0.12, 0.62, Math.sin(a) * 0.12], [0.3, 0.22, 0.3]);
    }
    const fc = d.color ?? b.pick(['#ff5fa2', '#ffd23f', '#ff6a3d', '#b98cff'], 2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + b.rnd(i) * 0.6, r = 0.1 + b.rnd(i + 5) * 0.08, hgt = 0.8 + b.rnd(i + 10) * 0.25;
      b.part('cyl8', 'leaf', '#2f8a3a', [Math.cos(a) * r, (0.5 + hgt) / 2, Math.sin(a) * r], [0.025, hgt - 0.5, 0.025]);
      b.part('sphere', 'gloss', fc, [Math.cos(a) * r, hgt, Math.sin(a) * r], [0.16, 0.09, 0.16]);
      b.part('sphere', 'gloss', '#ffe066', [Math.cos(a) * r, hgt + 0.035, Math.sin(a) * r], [0.06, 0.04, 0.06]);
    }
    b.anim = null;
    b.collide(0.65, 0.55, 0.65);
  },

  'neon-sign'(b, d, e) {
    const text = d.text ?? 'OPEN';
    const color = d.color ?? '#ff4fd8';
    const w = Math.max(1.6, Math.min(8, String(text).length * 0.46 + 0.6)), h = w * 320 / 1024;
    const y = d.height ?? (d.pole ? 3.4 : 2.8);
    if (d.pole) {
      b.part('cyl', 'paint', '#2c3752', [0, (y - h / 2) / 2, -0.1], [0.14, y - h / 2, 0.14]);
      b.part('cyl8', 'paint', '#1f2536', [0, 0.1, -0.1], [0.5, 0.2, 0.5]);
    }
    b.part('rbox', 'paint', '#191b2e', [0, y, 0.06], [w + 0.25, h + 0.25, 0.12]);
    for (const sx of [-1, 1]) b.part('box', 'metal', '#8a90a0', [sx * w * 0.35, y + h / 2 + 0.05, 0.02], [0.06, 0.2, 0.06]);
    const m = e.own(new THREE.MeshBasicMaterial({ map: neonTexture(text, color), transparent: true, depthWrite: false, color: new THREE.Color(1.7, 1.7, 1.7) }));
    const plane = new THREE.Mesh(geo('decor-plane', GEO_MAKERS.plane), m);
    plane.scale.set(w, h, 1);
    plane.position.set(0, y, 0.125);
    plane.renderOrder = 2;
    b.unique.push(plane);
    let flick = 0, next = 2 + b.rnd(7) * 5;
    b.updaters.push((dt, t) => {
      next -= dt;
      if (next <= 0) { flick = 0.35; next = 3 + Math.random() * 7; }
      flick = Math.max(0, flick - dt);
      const on = flick > 0 ? (Math.sin(t * 90) > 0.2 ? 1 : 0.25) : 1;
      m.color.setScalar(1.7 * on);
    });
    b.collide(w + 0.25, h + 0.25, 0.14, 0, y - h / 2 - 0.12, 0.06);
  },

  billboard(b, d) {
    const legC = '#394058', frame = '#232839';
    for (const sx of [-1, 1]) {
      b.part('box', 'metal', legC, [sx * 2.2, 2.9, -0.35], [0.36, 5.8, 0.36]);
      b.part('box', 'paint', '#1b1f2e', [sx * 2.2, 0.15, -0.35], [0.9, 0.3, 0.9]);
    }
    b.rod('metal', legC, [-2.2, 0.6, -0.35], [2.2, 5.2, -0.35], 0.14);
    b.rod('metal', legC, [2.2, 0.6, -0.35], [-2.2, 5.2, -0.35], 0.14);
    b.part('box', 'metal', legC, [0, 5.55, -0.35], [5.2, 0.28, 0.28]);
    b.part('rbox', 'paint', frame, [0, 7.35, 0], [6.7, 3.7, 0.32]);
    // catwalk + rail + spotlights
    b.part('box', 'metal', '#5b6275', [0, 5.6, 0.55], [6.4, 0.07, 0.8]);
    for (let i = 0; i <= 6; i++) b.part('cyl8', 'paint', '#f2c230', [-3.1 + i * (6.2 / 6), 6.0, 0.93], [0.05, 0.8, 0.05]);
    b.part('cyl', 'paint', '#f2c230', [0, 6.4, 0.93], [0.06, 6.3, 0.06], [0, 0, HP]);
    for (const x of [-2.2, 0, 2.2]) {
      b.part('box', 'metal', '#2b3144', [x, 5.85, 1.2], [0.06, 0.5, 0.06]);
      b.part('shade', 'paint', '#2b3144', [x, 6.12, 1.28], [0.3, 0.22, 0.3], [-0.9, 0, 0]);
      b.part('sphere', 'glow', G('#fff1c8', 3), [x, 6.18, 1.2], [0.18, 0.08, 0.18], [-0.9, 0, 0]);
    }
    const brand = d.text ?? BRANDS[Math.floor(b.rnd(3) * BRANDS.length)];
    const tex = billboardTexture(brand);
    const m = mat('decor-billboard:' + brand, () => new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.32, roughness: 0.55 }));
    const plane = new THREE.Mesh(geo('decor-plane', GEO_MAKERS.plane), m);
    plane.scale.set(6.3, 3.15, 1);
    plane.position.set(0, 7.35, 0.165);
    plane.receiveShadow = true;
    b.unique.push(plane);
    b.collide(0.5, 5.6, 0.5, -2.2, 0, -0.35);
    b.collide(0.5, 5.6, 0.5, 2.2, 0, -0.35);
  },

  graffiti(b, d) {
    const sz = Array.isArray(d.size) ? d.size : [d.size ?? 3, (d.size ?? 3) * 0.5];
    const [w, h] = sz;
    const y = d.height ?? (h / 2 + 0.25);
    const colors = d.color ? [d.color, d.color2 ?? '#ffffff'] : null;
    const tex = graffitiTexture(d.text, d.seed ?? Math.floor(b.rnd(1) * 1000), colors, d.style || 'tag');
    const m = mat('decor-graffiti:' + tex.uuid, () => new THREE.MeshStandardMaterial({
      map: tex, transparent: true, alphaTest: 0.3, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    }));
    const plane = new THREE.Mesh(geo('decor-plane', GEO_MAKERS.plane), m);
    plane.scale.set(w, h, 1);
    plane.position.set(0, y, 0.03);
    plane.receiveShadow = true;
    plane.renderOrder = 1;
    b.unique.push(plane);
  },

  crane(b, d) {
    const c = d.color ?? '#f2b134', dark = '#2b2f3e', white = '#eef0f5';
    const H = 12;
    for (const sx of [-3, 3]) for (const sz of [-3, 3]) {
      b.part('box', 'paint', c, [sx, H / 2, sz], [0.55, H, 0.55]);
      b.part('box', 'paint', dark, [sx, 0.3, sz], [1.3, 0.6, 1.3]);
    }
    for (const sz of [-3, 3]) b.part('box', 'paint', c, [0, H - 0.2, sz], [6.6, 0.6, 0.6]);
    for (const sx of [-3, 3]) b.part('box', 'paint', c, [sx, H - 0.2, 0], [0.6, 0.6, 6.6]);
    for (const sx of [-3, 3]) { b.rod('paint', c, [sx, 1, -3], [sx, H - 1, 3], 0.2); b.rod('paint', c, [sx, 1, 3], [sx, H - 1, -3], 0.2); }
    for (const sz of [-3, 3]) { b.rod('paint', c, [-3, 1, sz], [3, H - 1, sz], 0.2); b.rod('paint', c, [3, 1, sz], [-3, H - 1, sz], 0.2); }
    // slewing superstructure (slow pan)
    b.anim = 'pan'; b.pivot = [0, H, 0];
    b.part('cyl24', 'paint', dark, [0, H + 0.3, 0], [3.4, 0.6, 3.4]);
    b.part('box', 'paint', c, [0, H + 1.8, -1.3], [4, 2.6, 5]);
    b.part('box', 'paint', darker(c, 0.75), [0, H + 3.2, -1.3], [4.2, 0.25, 5.2]);
    b.part('box', 'paint', white, [1.7, H + 1.3, 2.1], [1.5, 1.7, 1.5]);
    b.part('box', 'glow', G('#bfe8ff', 1.5), [1.7, H + 1.55, 2.86], [1.25, 0.75, 0.02]);
    b.part('box', 'glow', G('#bfe8ff', 1.5), [2.46, H + 1.55, 2.1], [0.02, 0.75, 1.25]);
    // A-frame
    b.rod('paint', c, [-0.9, H + 3.2, -2.4], [0, H + 7.2, -0.4], 0.32);
    b.rod('paint', c, [0.9, H + 3.2, -2.4], [0, H + 7.2, -0.4], 0.32);
    b.rod('paint', c, [-0.9, H + 3.2, 0.8], [0, H + 7.2, -0.4], 0.28);
    b.rod('paint', c, [0.9, H + 3.2, 0.8], [0, H + 7.2, -0.4], 0.28);
    // jib: lattice girder along +Z
    const jy = H + 3.3, L = 22;
    b.part('box', 'paint', c, [-0.6, jy + 1, 1 + L / 2], [0.2, 0.2, L]);
    b.part('box', 'paint', c, [0.6, jy + 1, 1 + L / 2], [0.2, 0.2, L]);
    b.part('box', 'paint', c, [0, jy, 1 + L / 2], [0.24, 0.24, L]);
    for (let i = 0; i < 11; i++) {
      const z0 = 1 + i * 2, z1 = z0 + 2;
      b.rod('paint', c, [0, jy, z0], [-0.6, jy + 1, z1], 0.08);
      b.rod('paint', c, [0, jy, z0], [0.6, jy + 1, z1], 0.08);
      b.rod('paint', c, [-0.6, jy + 1, z1], [0.6, jy + 1, z1], 0.07);
    }
    // counter-jib + weights
    b.part('box', 'paint', c, [0, jy + 0.3, -6], [1.4, 0.35, 8]);
    b.part('box', 'matte', '#9aa0a8', [0, jy - 0.7, -8.6], [2, 1.7, 1.6]);
    b.part('box', 'matte', '#8c929a', [0, jy - 0.7, -7.2], [2, 1.7, 1.1]);
    // pendant cables
    b.rod('metal', '#2a2d38', [0, H + 7.2, -0.4], [0, jy + 1, 1 + L], 0.05);
    b.rod('metal', '#2a2d38', [0, H + 7.2, -0.4], [0, jy + 0.5, -10], 0.05);
    // trolley, hoist rope, hook block
    b.part('box', 'paint', dark, [0, jy - 0.25, 16], [0.9, 0.4, 1.1]);
    b.part('box', 'metal', '#2a2d38', [0, jy - 3.4, 16], [0.04, 6, 0.04]);
    b.part('box', 'paint', '#e0442a', [0, jy - 6.6, 16], [0.7, 0.7, 0.45]);
    b.part('torus', 'metal', '#b8bec9', [0, jy - 7.2, 16], [0.5, 0.5, 0.7]);
    // aviation lights
    b.part('sphere', 'glow', G('#ff3030', 3.5), [0, H + 7.45, -0.4], [0.25, 0.25, 0.25]);
    b.part('sphere', 'glow', G('#ff3030', 3.5), [0, jy + 1.2, 1 + L], [0.22, 0.22, 0.22]);
    b.anim = null; b.pivot = null;
    for (const sx of [-3, 3]) for (const sz of [-3, 3]) b.collide(0.7, H, 0.7, sx, 0, sz);
  },

  buoy(b, d) {
    b.anim = 'bob'; b.pivot = [0, 0, 0];
    const c = d.color ?? '#e0402f';
    b.part('hemiDown', 'paint', darker(c, 0.7), [0, 0, 0], [1.1, 0.7, 1.1]);
    b.part('cyl', 'paint', c, [0, 0.3, 0], [1.1, 0.6, 1.1]);
    b.part('cyl', 'paint', '#f4f1ea', [0, 0.32, 0], [1.12, 0.2, 1.12]);
    b.part('torus', 'rubber', '#1d1f28', [0, 0.02, 0], [1.14, 1.14, 1.4], [HP, 0, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      b.rod('paint', c, [Math.cos(a) * 0.38, 0.6, Math.sin(a) * 0.38], [Math.cos(a) * 0.1, 1.7, Math.sin(a) * 0.1], 0.07);
    }
    b.part('torus', 'paint', c, [0, 1.1, 0], [0.52, 0.52, 0.6], [HP, 0, 0]);
    b.part('cyl8', 'paint', '#1d1f28', [0, 1.72, 0], [0.26, 0.1, 0.26]);
    b.part('sphere', 'glow', G(d.light ?? '#6dff8a', 3), [0, 1.86, 0], [0.2, 0.22, 0.2]);
    b.part('cone', 'paint', c, [0, 2.12, 0], [0.34, 0.3, 0.34]);
    b.anim = null; b.pivot = null;
  },

  cone(b) {
    b.part('box', 'rubber', '#26262e', [0, 0.025, 0], [0.46, 0.05, 0.46]);
    b.part('tcone', 'gloss', '#ff6a1f', [0, 0.36, 0], [1, 1, 1]);
    b.part('tband1', 'gloss', '#f7f7f2', [0, 0.34, 0], [1, 1, 1]);
    b.part('tband2', 'gloss', '#f7f7f2', [0, 0.49, 0], [1, 1, 1]);
    b.collide(0.45, 0.68, 0.45);
  },

  antenna(b, d) {
    const h = d.height ?? 4.2, m = '#aab1bf';
    b.part('box', 'paint', '#4a5063', [0, 0.15, 0], [0.8, 0.3, 0.8]);
    b.part('cyl8', 'metal', m, [0, 0.3 + h / 2, 0], [0.1, h, 0.1]);
    const bars = 4;
    for (let i = 0; i < bars; i++) {
      const y = 0.3 + h * (0.45 + i * 0.14), w = 1.5 - i * 0.28;
      b.part('box', 'metal', m, [0, y, 0], [w, 0.05, 0.05]);
      for (const sx of [-1, 1]) b.part('box', 'metal', m, [sx * w / 2, y, 0], [0.03, 0.03, 0.45]);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + 0.5;
      b.rod('metal', '#6d7384', [0, 0.3 + h * 0.62, 0], [Math.cos(a) * 1.5, 0.02, Math.sin(a) * 1.5], 0.02);
    }
    b.part('sphere', 'glow', G('#ff3030', 3.2), [0, h + 0.36, 0], [0.14, 0.14, 0.14]);
    if (d.variant === 'radar') {
      b.anim = 'spin'; b.pivot = [0, 0, 0];
      b.part('cyl8', 'metal', m, [0, h + 0.5, 0], [0.12, 0.25, 0.12]);
      b.part('box', 'paint', '#f4f1ea', [0, h + 0.68, 0], [1.8, 0.28, 0.1]);
      b.part('box', 'paint', '#e0442a', [0, h + 0.68, 0.06], [1.8, 0.06, 0.02]);
      b.anim = null; b.pivot = null;
    }
  },

  pipe(b, d) {
    const L = d.length ?? 6, H = d.height ?? 0.9, r = d.radius ?? 0.25, c = d.color ?? '#3aa0a8';
    b.part('cyl', 'paint', c, [0, H, 0], [2 * r, L, 2 * r], [0, 0, HP]);
    const n = Math.max(2, Math.round(L / 2.2) + 1);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 0.3 + i * ((L - 0.6) / (n - 1));
      b.part('torus', 'metal', darker(c, 0.7), [x, H, 0], [r * 2.3, r * 2.3, r * 3], [0, HP, 0]);
      if (H > r + 0.1) {
        b.part('box', 'paint', '#3b4052', [x, (H - r) / 2, 0], [0.14, H - r, 0.14]);
        b.part('box', 'paint', '#2b3042', [x, 0.03, 0], [0.4, 0.06, 0.4]);
      }
    }
    for (const sx of [-1, 1]) b.part('cyl', 'metal', darker(c, 0.6), [sx * L / 2, H, 0], [2 * r * 1.15, 0.1, 2 * r * 1.15], [0, 0, HP]);
    const vx = L * 0.12;
    b.part('cyl', 'paint', c, [vx, H + r + 0.12, 0], [0.12, 0.3, 0.12]);
    b.part('torus', 'paint', '#d8322b', [vx, H + r + 0.3, 0], [0.42, 0.42, 0.6], [HP, 0, 0]);
    b.part('box', 'paint', '#d8322b', [vx, H + r + 0.3, 0], [0.4, 0.03, 0.03]);
    b.part('box', 'paint', '#d8322b', [vx, H + r + 0.3, 0], [0.03, 0.03, 0.4]);
    b.collide(L, H + r, 2 * r + 0.1);
  },

  vat(b, d) {
    const R = d.radius ?? 1.5, H = d.height ?? 3.2, c = d.color ?? '#b9c2cf';
    const glow = d.glow ?? '#9d6bff';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      b.part('cyl8', 'metal', '#5a6072', [Math.cos(a) * R * 0.7, 0.3, Math.sin(a) * R * 0.7], [0.22, 0.6, 0.22]);
    }
    b.part('cyl24', 'metal', c, [0, 0.6 + H / 2, 0], [2 * R, H, 2 * R]);
    b.part('hemi', 'metal', c, [0, 0.6 + H, 0], [2 * R, 0.9, 2 * R]);
    b.part('hemiDown', 'metal', darker(c, 0.8), [0, 0.6, 0], [2 * R, 0.5, 2 * R]);
    for (const f of [0.08, 0.5, 0.92]) b.part('ring', 'metal', darker(c, 0.6), [0, 0.6 + H * f, 0], [2 * R + 0.04, 2 * R + 0.04, 3], [HP, 0, 0]);
    b.part('box', 'paint', '#20232f', [0, 0.6 + H * 0.5, R - 0.02], [0.4, H * 0.66, 0.1]);
    b.part('box', 'glow', G(glow, 2.4), [0, 0.6 + H * 0.5, R + 0.04], [0.24, H * 0.6, 0.04]);
    b.part('box', 'paint', '#f2c230', [0, 0.6 + H * 0.86, R + 0.02], [0.9, 0.24, 0.04]);
    // ladder
    for (const sz of [-0.22, 0.22]) b.part('box', 'metal', '#8a90a0', [-R - 0.14, 0.6 + H / 2 + 0.2, sz], [0.05, H + 0.6, 0.05]);
    for (let y = 0.9; y < H + 0.6; y += 0.32) b.part('box', 'metal', '#8a90a0', [-R - 0.14, y, 0], [0.04, 0.04, 0.44]);
    // outlet pipe
    b.part('cyl', 'paint', '#3aa0a8', [0.5, 0.6 + H + 0.8, 0.3], [0.26, 1.2, 0.26]);
    b.part('sphere', 'paint', '#3aa0a8', [0.5, 0.6 + H + 1.4, 0.3], [0.3, 0.3, 0.3]);
    b.part('cyl', 'paint', '#3aa0a8', [0.5 + 0.9, 0.6 + H + 1.4, 0.3], [0.26, 1.8, 0.26], [0, 0, HP]);
    b.collide(2 * R, H + 1.1, 2 * R);
  },

  flag(b, d) {
    const h = d.height ?? 5, c = d.color ?? '#ff8a1f';
    b.part('cyl8', 'metal', '#5a6072', [0, 0.1, 0], [0.42, 0.2, 0.42]);
    b.part('cyl', 'gloss', '#f4f1ea', [0, h / 2, 0], [0.08, h, 0.08]);
    b.part('sphere', 'metal', '#e2b85a', [0, h + 0.06, 0], [0.16, 0.16, 0.16]);
    b.anim = 'wave';
    b.part('cloth', 'cloth', c, [0.04, h - 0.55, 0], [1.7, 1.0, 1]);
    b.part('cloth', 'cloth', d.color2 ?? '#ffffff', [0.04, h - 0.55, 0.008], [1.7, 0.2, 1]);
    b.part('cloth', 'cloth', d.color2 ?? '#ffffff', [0.04, h - 0.55, -0.008], [1.7, 0.2, 1]);
    b.anim = null;
  },

  railing(b, d) {
    const L = d.length ?? 4, c = d.color ?? '#f2c230';
    const n = Math.max(2, Math.ceil(L / 1.2) + 1);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + i * (L / (n - 1));
      b.part('cyl8', 'paint', c, [x, 0.5, 0], [0.07, 1, 0.07]);
      b.part('sphere', 'paint', c, [x, 1.02, 0], [0.1, 0.1, 0.1]);
    }
    b.part('cyl', 'paint', c, [0, 1.0, 0], [0.08, L, 0.08], [0, 0, HP]);
    b.part('cyl', 'paint', c, [0, 0.55, 0], [0.05, L, 0.05], [0, 0, HP]);
    b.collide(L, 1.05, 0.15);
  },

  fence(b, d) {
    const L = d.length ?? 6;
    if (d.variant === 'picket') {
      const c = d.color ?? '#f4f1ea';
      const n = Math.max(2, Math.ceil(L / 2) + 1);
      for (let i = 0; i < n; i++) b.part('box', 'matte', c, [-L / 2 + i * (L / (n - 1)), 0.6, 0], [0.12, 1.2, 0.12]);
      for (const y of [0.3, 0.8]) b.part('box', 'matte', c, [0, y, 0.06], [L, 0.08, 0.03]);
      const pk = Math.floor(L / 0.18);
      for (let i = 0; i < pk; i++) {
        const x = -L / 2 + 0.09 + i * (L / pk);
        b.part('box', 'matte', c, [x, 0.5, 0.09], [0.1, 1.0, 0.025]);
        b.part('box', 'matte', c, [x, 1.0, 0.09], [0.07, 0.07, 0.025], [0, 0, PI / 4]);
      }
      b.collide(L, 1.1, 0.2);
      return;
    }
    const segs = Math.max(1, Math.round(L / 2.5)), sl = L / segs;
    for (let i = 0; i <= segs; i++) b.part('cyl8', 'metal', '#9aa3ad', [-L / 2 + i * sl, 1.05, 0], [0.08, 2.1, 0.08]);
    b.part('cyl', 'metal', '#9aa3ad', [0, 2.05, 0], [0.05, L, 0.05], [0, 0, HP]);
    for (let i = 0; i < segs; i++) b.part('plane', 'chain', '#ffffff', [-L / 2 + (i + 0.5) * sl, 1.0, 0], [sl, 1.95, 1]);
    b.collide(L, 2.1, 0.15);
  },

  'speaker-tower'(b, d) {
    const h = d.height ?? 4.5, t = '#30354a';
    const led = d.color ?? '#2fd6ff';
    b.part('box', 'paint', '#1b1f2e', [0, 0.1, 0], [1.4, 0.2, 1.4]);
    for (const sx of [-0.45, 0.45]) for (const sz of [-0.45, 0.45]) b.part('box', 'metal', t, [sx, h / 2, sz], [0.08, h, 0.08]);
    for (let y = 0.3; y < h - 0.8; y += 1.2) {
      for (const sz of [-0.45, 0.45]) { b.rod('metal', t, [-0.45, y, sz], [0.45, y + 1.2, sz], 0.04); b.rod('metal', t, [0.45, y, sz], [-0.45, y + 1.2, sz], 0.04); }
      for (const sx of [-0.45, 0.45]) { b.rod('metal', t, [sx, y, -0.45], [sx, y + 1.2, 0.45], 0.04); b.rod('metal', t, [sx, y, 0.45], [sx, y + 1.2, -0.45], 0.04); }
    }
    b.part('box', 'metal', t, [0, h, 0], [1.1, 0.12, 1.1]);
    const cabs = [[h + 0.62, 1.35, 1.1, 0.95, 0], [h + 1.72, 1.2, 1.0, 0.9, 0.14]];
    for (const [y, w, hh, dd, tilt] of cabs) {
      b.part('rbox', 'paint', '#1a1c28', [0, y, 0], [w, hh, dd], [tilt, 0, 0]);
      const fz = dd / 2 + 0.01;
      for (const sx of [-0.3, 0.3]) {
        const cy = y - Math.sin(tilt) * fz * 0.2, cz = fz * Math.cos(tilt) + 0.01;
        b.part('cyl', 'rubber', '#0c0d13', [sx, cy - 0.08, cz], [0.46, 0.04, 0.46], [HP + tilt, 0, 0]);
        b.part('ring', 'glow', G(led, 2.6), [sx, cy - 0.08, cz + 0.02], [0.5, 0.5, 1.2], [tilt, 0, 0]);
        b.part('hemi', 'gloss', '#2b2e3c', [sx, cy - 0.08, cz + 0.01], [0.14, 0.1, 0.14], [HP + tilt, 0, 0]);
      }
      b.part('cyl', 'metal', '#9aa0ad', [0, y + hh * 0.32, fz + 0.01], [0.16, 0.03, 0.16], [HP + tilt, 0, 0]);
    }
    b.collide(1.4, h + 2.3, 1.4);
  },

  'tire-stack'(b, d) {
    const n = Math.max(1, Math.min(7, d.count ?? 4));
    for (let i = 0; i < n; i++) {
      const jx = (b.rnd(i) - 0.5) * 0.12, jz = (b.rnd(i + 9) - 0.5) * 0.12;
      b.part('tire', 'rubber', '#23242c', [jx, 0.17 + i * 0.3, jz], [0.74, 0.74, 0.9], [HP, 0, b.rnd(i + 20)]);
    }
    const accent = d.color ?? '#ffffff';
    b.part('ring', 'paint', accent, [0, 0.17 + (n - 1) * 0.3 + 0.1, 0], [0.62, 0.62, 1.2], [HP, 0, 0]);
    b.collide(1.05, n * 0.3 + 0.05, 1.05);
  },

  hydrant(b, d) {
    const c = d.color ?? '#d8322b';
    b.part('cyl8', 'paint', darker(c, 0.85), [0, 0.05, 0], [0.42, 0.1, 0.42]);
    b.part('cyl', 'gloss', c, [0, 0.36, 0], [0.3, 0.56, 0.3]);
    b.part('torus', 'gloss', c, [0, 0.63, 0], [0.34, 0.34, 0.5], [HP, 0, 0]);
    b.part('hemi', 'gloss', c, [0, 0.63, 0], [0.3, 0.26, 0.3]);
    b.part('cyl8', 'metal', '#c9ced8', [0, 0.78, 0], [0.09, 0.06, 0.09]);
    for (const sx of [-1, 1]) {
      b.part('cyl', 'gloss', c, [sx * 0.19, 0.44, 0], [0.12, 0.12, 0.12], [0, 0, HP]);
      b.part('cyl8', 'metal', '#c9ced8', [sx * 0.26, 0.44, 0], [0.14, 0.03, 0.14], [0, 0, HP]);
    }
    b.part('cyl', 'gloss', c, [0, 0.38, 0.19], [0.17, 0.14, 0.17], [HP, 0, 0]);
    b.part('cyl8', 'metal', '#c9ced8', [0, 0.38, 0.27], [0.19, 0.03, 0.19], [HP, 0, 0]);
    b.collide(0.45, 0.8, 0.45);
  },

  vending(b, d) {
    const c = d.color ?? '#e8364f';
    b.part('box', 'paint', '#1b1d2a', [0, 0.04, 0], [1.0, 0.08, 0.76]);
    b.part('rbox', 'gloss', c, [0, 0.99, 0], [1.05, 1.92, 0.8]);
    b.part('plane', 'screen', G('#ffffff', 1.25), [-0.12, 1.12, 0.405], [0.72, 1.44, 1]);
    b.part('box', 'paint', '#20222e', [0.37, 1.05, 0.41], [0.22, 0.9, 0.04]);
    b.part('box', 'glow', G('#9ff3ff', 2.2), [0.37, 1.28, 0.435], [0.12, 0.04, 0.01]);
    for (let i = 0; i < 4; i++) b.part('box', 'glow', G(i % 2 ? '#ffd23f' : '#ff7ab8', 1.8), [0.37, 1.1 - i * 0.09, 0.435], [0.09, 0.05, 0.01]);
    b.part('box', 'paint', '#101118', [-0.12, 0.24, 0.41], [0.62, 0.18, 0.06]);
    b.part('box', 'glow', G('#ffffff', 1.5), [0, 1.9, 0.405], [0.95, 0.06, 0.01]);
    b.collide(1.05, 1.95, 0.8);
  },

  awning(b, d) {
    const w = d.length ?? 3.2, y0 = d.height ?? 2.6, c = d.color ?? '#e8364f';
    const n = Math.max(4, Math.round(w / 0.4)), sw = w / n, tilt = 0.42, depth = 1.4;
    const zc = 0.02 + Math.cos(tilt) * depth / 2, yc = y0 - Math.sin(tilt) * depth / 2;
    const zf = 0.02 + Math.cos(tilt) * depth, yf = y0 - Math.sin(tilt) * depth;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * sw;
      const col = i % 2 ? '#f7f3ea' : c;
      b.part('box', 'cloth', col, [x, yc, zc], [sw + 0.002, 0.03, depth], [tilt, 0, 0]);
      b.part('scallop', 'cloth', col, [x, yf, zf + 0.01], [sw, 0.34, 1]);
    }
    b.part('cyl', 'metal', '#6d7384', [0, y0, 0.05], [0.08, w + 0.1, 0.08], [0, 0, HP]);
    b.part('cyl', 'metal', '#6d7384', [0, yf - 0.02, zf], [0.05, w, 0.05], [0, 0, HP]);
    for (const sx of [-1, 1]) b.rod('metal', '#6d7384', [sx * w / 2, y0 - 0.9, 0.02], [sx * w / 2, yf, zf], 0.04);
  },

  satellite(b, d) {
    b.part('box', 'paint', '#5a6072', [0, 0.1, 0], [0.6, 0.2, 0.6]);
    b.part('cyl8', 'metal', '#9aa0ad', [0, 0.65, 0], [0.09, 1.1, 0.09]);
    b.anim = 'pan'; b.pivot = [0, 0, 0];
    const tilt = 1.0;
    b.part('dish', 'paint', d.color ?? '#eef0f5', [0, 1.25, 0.05], [1.5, 1.5, 1.5], [tilt, 0, 0]);
    b.part('cyl8', 'metal', '#9aa0ad', [0, 1.2, 0.02], [0.14, 0.2, 0.14], [tilt, 0, 0]);
    const ax = [0, Math.cos(tilt), Math.sin(tilt)];
    const f = 0.6;
    b.rod('metal', '#9aa0ad', [0, 1.25, 0.05], [0, 1.25 + ax[1] * f, 0.05 + ax[2] * f], 0.03);
    b.part('box', 'paint', '#2b2f3e', [0, 1.25 + ax[1] * f, 0.05 + ax[2] * f], [0.1, 0.1, 0.16], [-tilt + HP, 0, 0]);
    b.anim = null; b.pivot = null;
  },

  chimney(b, d, e) {
    b.part('box', 'brick', '#ffffff', [0, 1.2, 0], [0.9, 2.4, 0.9]);
    b.part('box', 'matte', '#bdb8ae', [0, 2.46, 0], [1.1, 0.14, 1.1]);
    for (const sx of [-0.2, 0.2]) {
      b.part('cyl', 'matte', '#c56a3e', [sx, 2.74, 0], [0.22, 0.44, 0.22]);
      b.part('torus', 'matte', '#a85a34', [sx, 2.96, 0], [0.24, 0.24, 0.5], [HP, 0, 0]);
    }
    if (d.smoke !== false) {
      let tt = b.rnd(4);
      const pos = new THREE.Vector3(), vel = new THREE.Vector3();
      b.updaters.push((dt) => {
        tt -= dt;
        if (tt > 0) return;
        tt = 0.5 + Math.random() * 0.3;
        const S = e.session;
        if (S.player.position.distanceToSquared(e.position) > 70 * 70) return;
        e.group.localToWorld(pos.set(Math.random() < 0.5 ? -0.2 : 0.2, 3.0, 0));
        vel.set(0.3 + Math.random() * 0.2, 1.2, 0.1);
        S.fx.puff(pos, '#d8d6dc', 0.7, 2.2, vel, 3.2, 0.42);
      });
    }
    b.collide(0.9, 2.5, 0.9);
  },
};

export const DECOR_KINDS = Object.keys(KINDS);

// ---------------------------------------------------------------------------------------------

class Decor extends Entity {
  constructor(session, def) {
    super(session, def);
    const kind = KINDS[def.kind];
    if (!kind) console.warn(`decor: unknown kind "${def.kind}"`);
    const s = def.scale ?? 1;
    this.group.scale.setScalar(s);
    this.group.updateMatrixWorld(true);
    const seed = hash01(this.position.x * 1.3, this.position.z * 0.7, this.position.y) * 1000 + (def.seed ?? 0);
    const b = new Builder(def, seed);
    (kind || KINDS.barrel)(b, def, this);
    const M = this.group.matrixWorld;
    const phase = hash01(seed, 77) * 6.2831;
    this.parts = b.parts.map((pt) => {
      _e.set(pt.rot?.[0] || 0, pt.rot?.[1] || 0, pt.rot?.[2] || 0);
      _q.setFromEuler(_e);
      _p.fromArray(pt.pos || [0, 0, 0]);
      _s.fromArray(pt.scl || [1, 1, 1]);
      const matrix = new THREE.Matrix4().compose(_p, _q, _s).premultiply(M);
      const [cc, k] = Array.isArray(pt.color) ? pt.color : [pt.color ?? '#ffffff', 1];
      const color = new THREE.Color(cc).multiplyScalar(k);
      let animVec = null;
      if (pt.anim) {
        const pv = new THREE.Vector3().fromArray(pt.pivot || [0, 0, 0]).applyMatrix4(M);
        animVec = [pv.x, pv.y, pv.z, phase];
      }
      return { g: pt.g, m: pt.m, anim: pt.anim, matrix, color, animVec };
    });
    this.batch = batchFor(session);
    this.batch.add(this);
    for (const u of b.unique) this.group.add(u);
    this.updaters = b.updaters;
    this.t = hash01(seed, 5) * 10;
    // optional solid colliders (rigid: compensate the prop scale, bake it into the geometry)
    this.dyns = [];
    if (def.collide) {
      const boxes = b.colliders.length ? b.colliders : [[1, 1, 1, 0, 0, 0]];
      for (const [w, h, d, x, y, z] of boxes) {
        const g = new THREE.BoxGeometry(w * s, h * s, d * s).translate(x * s, (y + h / 2) * s, z * s);
        const m = new THREE.Mesh(g, INVISIBLE);
        m.visible = false;
        m.userData.ownGeometry = true;
        m.scale.setScalar(1 / s);
        this.group.add(m);
        this.group.updateMatrixWorld(true);
        this.dyns.push(session.level.addDynamic(m, { owner: this, tag: 'decor' }));
      }
    }
  }

  render(dt) {
    PROP_TIME.value = this.session.time;
    if (this.updaters.length) {
      this.t += dt;
      for (const u of this.updaters) u(dt, this.t);
    }
  }

  dispose() {
    this.batch.delete(this);
    for (const d of this.dyns) this.session.level.removeDynamic(d);
    super.dispose();
  }
}

registerEntity('decor', (s, d) => new Decor(s, d));
