// INKTIDE ink system.
//
// Every paintable surface of a level is a planar "face" (rectangle or polygon). Faces are packed
// into one atlas render target. Painting a splat renders small quads, one per face the splat
// touches, straight into that atlas in UV space (so a splat on a floor also wraps around a curb or
// a wall corner). The surface shader thresholds the atlas into crisp, glossy, slightly raised ink.
//
// Gameplay never reads the GPU. A CPU grid (25 cm cells) per face is updated from the same splat
// with the same shape function, and answers "what ink is under me?", "can I climb this wall?" and
// "how much turf does each team own?".
import * as THREE from 'three';

export const TEAM_NONE = 0;
export const TEAM_HERO = 1;   // player / Alpha team
export const TEAM_MURK = 2;   // enemies / Bravo team

const PAD = 4;                // atlas texels of padding around every face rect
const MAX_QUADS = 2048;       // per paint batch

/** Shared splat outline — the GLSL copy in PAINT_FRAG must stay identical. */
export function splatShape(angle, seed) {
  return 1 + 0.16 * Math.sin(3 * angle + seed) + 0.10 * Math.sin(5 * angle + 1.7 * seed) + 0.06 * Math.sin(9 * angle + 2.9 * seed);
}
const SHAPE_MAX = 1.32;
const CPU_EDGE = 0.9;         // visual edge sits at ~0.91 of the shape radius (smoothstep midpoint)

function splatFrame(n, t1, t2) {
  if (Math.abs(n.y) < 0.9) t1.set(0, 1, 0).cross(n).normalize();
  else t1.set(1, 0, 0).cross(n).normalize();
  t2.crossVectors(n, t1);
}

export class InkFace {
  constructor(id, origin, U, V, N, lenU, lenV, poly, opts = {}) {
    this.id = id;
    this.origin = origin; this.U = U; this.V = V; this.N = N;
    this.lenU = lenU; this.lenV = lenV;
    this.poly = poly;                   // [[u,v], ...] in metres, or null for full rect
    this.paintable = opts.paintable !== false;
    this.isFloor = N.y > 0.6;
    this.tag = opts.tag || null;        // gameplay tag (e.g. 'sponge', 'no-swim')
    this.atlas = null;                  // {x, y, w, h} inner rect in texels
    this.aabb = new THREE.Box3();
    const pts = poly || [[0, 0], [lenU, 0], [lenU, lenV], [0, lenV]];
    for (const [u, v] of pts) this.aabb.expandByPoint(this.point(u, v, new THREE.Vector3()));
    this.aabb.expandByScalar(0.01);
    this.area = polyArea(pts);
  }

  point(u, v, out) {
    return out.copy(this.origin).addScaledVector(this.U, u).addScaledVector(this.V, v);
  }

  initCells(cellSize) {
    this.cu = Math.max(1, Math.ceil(this.lenU / cellSize));
    this.cv = Math.max(1, Math.ceil(this.lenV / cellSize));
    this.cw = this.lenU / this.cu;
    this.ch = this.lenV / this.cv;
    this.cellArea = this.cw * this.ch;
    this.cells = new Uint8Array(this.cu * this.cv);
    this.inside = null;
    this.insideCount = this.cu * this.cv;
    if (this.poly && this.poly.length !== 4 || (this.poly && !isAxisRect(this.poly, this.lenU, this.lenV))) {
      this.inside = new Uint8Array(this.cu * this.cv);
      let n = 0;
      for (let j = 0; j < this.cv; j++) for (let i = 0; i < this.cu; i++) {
        const inn = pointInPoly((i + 0.5) * this.cw, (j + 0.5) * this.ch, this.poly) ? 1 : 0;
        this.inside[j * this.cu + i] = inn; n += inn;
      }
      this.insideCount = n;
    }
    this.counts = [this.insideCount, 0, 0];
  }
}

function isAxisRect(poly, lu, lv) {
  const e = 1e-3;
  return poly.every(([u, v]) => (Math.abs(u) < e || Math.abs(u - lu) < e) && (Math.abs(v) < e || Math.abs(v - lv) < e));
}

function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function pointInPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
const PAINT_VERT = /* glsl */`
precision highp float;
in vec2 position;
in vec3 aWorld;
in vec4 aCenter;   // xyz centre, w radius
in vec4 aNormal;   // xyz hit normal, w seed
in float aTeam;
out vec3 vWorld;
out vec4 vCenter;
out vec4 vNormal;
out float vTeam;
void main() {
  vWorld = aWorld; vCenter = aCenter; vNormal = aNormal; vTeam = aTeam;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const PAINT_FRAG = /* glsl */`
precision highp float;
in vec3 vWorld;
in vec4 vCenter;
in vec4 vNormal;
in float vTeam;
out vec4 outColor;
float splatShape(float a, float s) {
  return 1.0 + 0.16 * sin(3.0 * a + s) + 0.10 * sin(5.0 * a + 1.7 * s) + 0.06 * sin(9.0 * a + 2.9 * s);
}
void main() {
  vec3 n = normalize(vNormal.xyz);
  vec3 t1 = abs(n.y) < 0.9 ? normalize(cross(vec3(0.0, 1.0, 0.0), n)) : normalize(cross(vec3(1.0, 0.0, 0.0), n));
  vec3 t2 = cross(n, t1);
  vec3 d = vWorld - vCenter.xyz;
  float dist = length(d);
  float ang = atan(dot(d, t2), dot(d, t1));
  float edge = vCenter.w * splatShape(ang, vNormal.w);
  float m = 1.0 - smoothstep(edge * 0.82, edge, dist);
  if (m <= 0.002) discard;
  vec3 c = vTeam > 1.5 ? vec3(0.0, 1.0, 0.0) : (vTeam > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0));
  outColor = vec4(c, m);
}`;

export class InkSystem {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} opts  atlasSize, texelsPerMeter, cellSize
   */
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.atlasSize = opts.atlasSize || 2048;
    this.texelsPerMeter = opts.texelsPerMeter || 10;
    this.cellSize = opts.cellSize || 0.25;
    this.faces = [];
    this.floorArea = 0;
    this.hashSize = 4;
    this.hash = new Map();
    this.queue = [];
    this.listeners = new Set();

    this.uniforms = {
      inkMap: { value: null },
      inkAtlasSize: { value: new THREE.Vector2(this.atlasSize, this.atlasSize) },
      inkTeamA: { value: new THREE.Color('#ff8a1f') },
      inkTeamB: { value: new THREE.Color('#6a2bd9') },
      inkBump: { value: 1.25 },
      inkNoise: { value: makeNoiseTexture() },
      inkTime: { value: 0 },
    };
    this.teamColors = [new THREE.Color('#ffffff'), this.uniforms.inkTeamA.value, this.uniforms.inkTeamB.value];

    this._t1 = new THREE.Vector3(); this._t2 = new THREE.Vector3();
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3();
    this._box = new THREE.Box3();
    this._seen = new Set();
  }

  setTeamColors(a, b) {
    this.uniforms.inkTeamA.value.set(a);
    this.uniforms.inkTeamB.value.set(b);
  }

  color(team) { return this.teamColors[team] || this.teamColors[0]; }

  /** Register a planar face. Returns the InkFace. Call before build(). */
  addFace(origin, U, V, N, lenU, lenV, poly, opts) {
    const f = new InkFace(this.faces.length, origin, U, V, N, lenU, lenV, poly, opts);
    this.faces.push(f);
    return f;
  }

  build() {
    this._pack();
    for (const f of this.faces) {
      f.initCells(this.cellSize);
      if (f.paintable && f.isFloor) this.floorArea += f.insideCount * f.cellArea;
      this._hashInsert(f);
    }
    this.rt = new THREE.WebGLRenderTarget(this.atlasSize, this.atlasSize, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.rt.texture.name = 'InkAtlas';
    this.uniforms.inkMap.value = this.rt.texture;
    this.uniforms.inkAtlasSize.value.set(this.atlasSize, this.atlasSize);
    this._buildPainter();
    this.clear();
  }

  _pack() {
    const S = this.atlasSize;
    const paintables = this.faces.filter((f) => f.paintable);
    let density = this.texelsPerMeter;
    // try to fit, shrinking density until everything packs (shelf packing, tallest first)
    for (let attempt = 0; attempt < 12; attempt++) {
      const rects = paintables.map((f) => ({
        f,
        w: Math.max(2, Math.ceil(f.lenU * density)),
        h: Math.max(2, Math.ceil(f.lenV * density)),
      }));
      rects.sort((a, b) => b.h - a.h || b.w - a.w);
      let x = 8 + PAD, y = PAD, shelf = 0, ok = true;   // x starts after the reserved blank block
      for (const r of rects) {
        const fw = r.w + PAD * 2, fh = r.h + PAD * 2;
        if (fw > S) { ok = false; break; }
        if (x + fw > S) { x = 0; y += shelf; shelf = 0; }
        if (y + fh > S) { ok = false; break; }
        r.x = x + PAD; r.y = y + PAD;
        x += fw; shelf = Math.max(shelf, fh);
      }
      if (ok) {
        for (const r of rects) r.f.atlas = { x: r.x, y: r.y, w: r.w, h: r.h };
        this.density = density;
        return;
      }
      density *= 0.85;
    }
    throw new Error('InkSystem: level too large for the ink atlas');
  }

  /** Atlas UV (0..1) for face-local metres. Non-paintable faces map to the reserved blank block. */
  atlasUV(f, u, v, out = [0, 0]) {
    if (!f.paintable || !f.atlas) { out[0] = 2 / this.atlasSize; out[1] = 2 / this.atlasSize; return out; }
    const a = f.atlas;
    out[0] = (a.x + (u / f.lenU) * a.w) / this.atlasSize;
    out[1] = (a.y + (v / f.lenV) * a.h) / this.atlasSize;
    return out;
  }

  _hashKey(x, y, z) { return (x * 73856093) ^ (y * 19349663) ^ (z * 83492791); }

  _hashInsert(f) {
    const s = this.hashSize;
    const b = f.aabb;
    for (let x = Math.floor(b.min.x / s); x <= Math.floor(b.max.x / s); x++)
      for (let y = Math.floor(b.min.y / s); y <= Math.floor(b.max.y / s); y++)
        for (let z = Math.floor(b.min.z / s); z <= Math.floor(b.max.z / s); z++) {
          const k = this._hashKey(x, y, z);
          let list = this.hash.get(k);
          if (!list) this.hash.set(k, (list = []));
          list.push(f);
        }
  }

  /** Faces whose AABB overlaps a sphere. */
  query(center, radius, out = []) {
    out.length = 0;
    const s = this.hashSize;
    this._seen.clear();
    for (let x = Math.floor((center.x - radius) / s); x <= Math.floor((center.x + radius) / s); x++)
      for (let y = Math.floor((center.y - radius) / s); y <= Math.floor((center.y + radius) / s); y++)
        for (let z = Math.floor((center.z - radius) / s); z <= Math.floor((center.z + radius) / s); z++) {
          const list = this.hash.get(this._hashKey(x, y, z));
          if (!list) continue;
          for (const f of list) {
            if (this._seen.has(f.id)) continue;
            this._seen.add(f.id);
            if (f.aabb.distanceToPoint(center) <= radius) out.push(f);
          }
        }
    return out;
  }

  /**
   * Paint a splat.
   * @param {THREE.Vector3} center   world position (usually a hit point)
   * @param {number} radius          metres
   * @param {number} team            TEAM_HERO / TEAM_MURK / TEAM_NONE (erase)
   * @param {THREE.Vector3} normal   surface normal at the hit (decides which faces may receive ink)
   * @param {object} [opts]          seed, source (for stats)
   * @returns {number} newly owned floor area in m² for that team (feeds special gauges / points)
   */
  paint(center, radius, team, normal, opts = {}) {
    if (!this.rt || radius <= 0.01) return 0;
    const seed = opts.seed ?? (center.x * 12.9898 + center.z * 78.233 + center.y * 3.1) % 6.2831;
    const n = this._w.copy(normal || THREE.Object3D.DEFAULT_UP);
    if (n.lengthSq() < 1e-6) n.set(0, 1, 0); else n.normalize();
    const t1 = this._t1, t2 = this._t2;
    splatFrame(n, t1, t2);

    const R = radius * SHAPE_MAX;
    const faces = this.query(center, R, this._qbuf || (this._qbuf = []));
    let gained = 0;
    const cx = center.x, cy = center.y, cz = center.z;
    const splat = { cx, cy, cz, r: radius, nx: n.x, ny: n.y, nz: n.z, seed, team, faces: [] };

    for (const f of faces) {
      if (!f.paintable) continue;
      const N = f.N, O = f.origin, U = f.U, V = f.V;
      if (N.x * n.x + N.y * n.y + N.z * n.z < -0.25) continue;
      const ox = cx - O.x, oy = cy - O.y, oz = cz - O.z;
      const dp = ox * N.x + oy * N.y + oz * N.z;
      if (Math.abs(dp) > R) continue;
      const lu = ox * U.x + oy * U.y + oz * U.z;
      const lv = ox * V.x + oy * V.y + oz * V.z;
      const rr = Math.sqrt(R * R - dp * dp);
      const u0 = Math.max(0, lu - rr), u1 = Math.min(f.lenU, lu + rr);
      const v0 = Math.max(0, lv - rr), v1 = Math.min(f.lenV, lv + rr);
      if (u0 >= u1 || v0 >= v1) continue;
      splat.faces.push(f, lu - rr, lu + rr, lv - rr, lv + rr);

      // ---- CPU grid ----
      const i0 = Math.max(0, Math.floor(u0 / f.cw)), i1 = Math.min(f.cu - 1, Math.floor(u1 / f.cw));
      const j0 = Math.max(0, Math.floor(v0 / f.ch)), j1 = Math.min(f.cv - 1, Math.floor(v1 / f.ch));
      const cells = f.cells, inside = f.inside, counts = f.counts;
      for (let j = j0; j <= j1; j++) {
        const vc = (j + 0.5) * f.ch;
        for (let i = i0; i <= i1; i++) {
          const idx = j * f.cu + i;
          if (inside && !inside[idx]) continue;
          const uc = (i + 0.5) * f.cw;
          // world offset of cell centre from the splat centre
          const dx = O.x + U.x * uc + V.x * vc - cx;
          const dy = O.y + U.y * uc + V.y * vc - cy;
          const dz = O.z + U.z * uc + V.z * vc - cz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > R) continue;
          const a = Math.atan2(dx * t2.x + dy * t2.y + dz * t2.z, dx * t1.x + dy * t1.y + dz * t1.z);
          if (dist > radius * splatShape(a, seed) * CPU_EDGE) continue;
          const old = cells[idx];
          if (old === team) continue;
          cells[idx] = team;
          counts[old]--; counts[team]++;
          if (f.isFloor && team !== TEAM_NONE) gained += f.cellArea;
        }
      }
    }
    if (splat.faces.length) this.queue.push(splat);
    if (gained > 0) for (const fn of this.listeners) fn(team, gained, opts.source);
    return gained;
  }

  /** Listen to newly inked floor area: fn(team, m2, source). */
  onPaint(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Ink team at a point on a face (CPU grid). */
  inkAt(faceOrId, p) {
    const f = typeof faceOrId === 'number' ? this.faces[faceOrId] : faceOrId;
    if (!f || !f.paintable) return TEAM_NONE;
    const ox = p.x - f.origin.x, oy = p.y - f.origin.y, oz = p.z - f.origin.z;
    const u = ox * f.U.x + oy * f.U.y + oz * f.U.z;
    const v = ox * f.V.x + oy * f.V.y + oz * f.V.z;
    const i = Math.min(f.cu - 1, Math.max(0, Math.floor(u / f.cw)));
    const j = Math.min(f.cv - 1, Math.max(0, Math.floor(v / f.ch)));
    return f.cells[j * f.cu + i];
  }

  /** Fraction (0..1) of cells within radius r of p on this face owned by team. */
  inkFraction(faceOrId, p, r, team) {
    const f = typeof faceOrId === 'number' ? this.faces[faceOrId] : faceOrId;
    if (!f || !f.paintable) return 0;
    const ox = p.x - f.origin.x, oy = p.y - f.origin.y, oz = p.z - f.origin.z;
    const u = ox * f.U.x + oy * f.U.y + oz * f.U.z;
    const v = ox * f.V.x + oy * f.V.y + oz * f.V.z;
    let hit = 0, tot = 0;
    for (let j = Math.max(0, Math.floor((v - r) / f.ch)); j <= Math.min(f.cv - 1, Math.floor((v + r) / f.ch)); j++)
      for (let i = Math.max(0, Math.floor((u - r) / f.cw)); i <= Math.min(f.cu - 1, Math.floor((u + r) / f.cw)); i++) {
        tot++;
        if (f.cells[j * f.cu + i] === team) hit++;
      }
    return tot ? hit / tot : 0;
  }

  /** Turf totals over paintable floor faces, in m². */
  coverage(filter) {
    let a = 0, b = 0, total = 0;
    for (const f of this.faces) {
      if (!f.paintable || !f.isFloor) continue;
      if (filter && !filter(f)) continue;
      a += f.counts[TEAM_HERO] * f.cellArea;
      b += f.counts[TEAM_MURK] * f.cellArea;
      total += f.insideCount * f.cellArea;
    }
    return { a, b, total };
  }

  /** Clear all ink (GPU and CPU). */
  clear() {
    for (const f of this.faces) {
      if (!f.cells) continue;
      f.cells.fill(0);
      f.counts = [f.insideCount, 0, 0];
    }
    this.queue.length = 0;
    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
    r.setRenderTarget(prevRT);
    r.setClearColor(prevColor, prevAlpha);
  }

  // -------------------------------------------------------------------------------------------
  _buildPainter() {
    const g = new THREE.BufferGeometry();
    this._pos = new Float32Array(MAX_QUADS * 4 * 2);
    this._world = new Float32Array(MAX_QUADS * 4 * 3);
    this._center = new Float32Array(MAX_QUADS * 4 * 4);
    this._normal = new Float32Array(MAX_QUADS * 4 * 4);
    this._team = new Float32Array(MAX_QUADS * 4);
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    }
    const dyn = (arr, size) => { const a = new THREE.BufferAttribute(arr, size); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', dyn(this._pos, 2));
    g.setAttribute('aWorld', dyn(this._world, 3));
    g.setAttribute('aCenter', dyn(this._center, 4));
    g.setAttribute('aNormal', dyn(this._normal, 4));
    g.setAttribute('aTeam', dyn(this._team, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
    const mat = new THREE.RawShaderMaterial({
      vertexShader: PAINT_VERT,
      fragmentShader: PAINT_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this._paintMesh = new THREE.Mesh(g, mat);
    this._paintMesh.frustumCulled = false;
    this._paintScene = new THREE.Scene();
    this._paintScene.add(this._paintMesh);
    this._paintCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  }

  /** Render all queued splats into the atlas. Call once per frame before rendering the world. */
  flush() {
    if (!this.queue.length) return false;
    let q = 0;
    const uvA = [0, 0];
    const w = this._v;
    const S = this.atlasSize;
    const emitQuad = (f, s, ua, ub, va, vb) => {
      if (q >= MAX_QUADS) { this._drawBatch(q); q = 0; }
      // expand into the padding so bilinear/mip samples at face borders see the same ink
      const pu = (PAD / f.atlas.w) * f.lenU, pv = (PAD / f.atlas.h) * f.lenV;
      ua = Math.max(ua, -pu); ub = Math.min(ub, f.lenU + pu);
      va = Math.max(va, -pv); vb = Math.min(vb, f.lenV + pv);
      if (ua >= ub || va >= vb) return;
      const corners = [[ua, va], [ub, va], [ub, vb], [ua, vb]];
      for (let k = 0; k < 4; k++) {
        const vi = q * 4 + k;
        const [u, v] = corners[k];
        uvA[0] = (f.atlas.x + (u / f.lenU) * f.atlas.w) / S;
        uvA[1] = (f.atlas.y + (v / f.lenV) * f.atlas.h) / S;
        this._pos[vi * 2] = uvA[0]; this._pos[vi * 2 + 1] = uvA[1];
        f.point(u, v, w);
        this._world[vi * 3] = w.x; this._world[vi * 3 + 1] = w.y; this._world[vi * 3 + 2] = w.z;
        this._center[vi * 4] = s.cx; this._center[vi * 4 + 1] = s.cy; this._center[vi * 4 + 2] = s.cz; this._center[vi * 4 + 3] = s.r;
        this._normal[vi * 4] = s.nx; this._normal[vi * 4 + 1] = s.ny; this._normal[vi * 4 + 2] = s.nz; this._normal[vi * 4 + 3] = s.seed;
        this._team[vi] = s.team;
      }
      q++;
    };
    for (const s of this.queue) {
      const list = s.faces;
      for (let i = 0; i < list.length; i += 5) emitQuad(list[i], s, list[i + 1], list[i + 2], list[i + 3], list[i + 4]);
    }
    this.queue.length = 0;
    if (q) this._drawBatch(q);
    return true;
  }

  _drawBatch(quads) {
    const g = this._paintMesh.geometry;
    for (const name of ['position', 'aWorld', 'aCenter', 'aNormal', 'aTeam']) {
      const a = g.attributes[name];
      a.clearUpdateRanges();
      a.addUpdateRange(0, quads * 4 * a.itemSize);
      a.needsUpdate = true;
    }
    g.setDrawRange(0, quads * 6);
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const prevAuto = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(this.rt);
    r.render(this._paintScene, this._paintCam);
    r.setRenderTarget(prev);
    r.autoClear = prevAuto;
  }

  // -------------------------------------------------------------------------------------------
  /**
   * Patch a MeshStandardMaterial so it shows ink from the atlas. The geometry must carry
   * `inkUv` (vec2) and `inkTan` (vec3, the face's U axis in world space).
   */
  patchMaterial(material) {
    const U = this.uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        inkMap: U.inkMap, inkAtlasSize: U.inkAtlasSize, inkTeamA: U.inkTeamA, inkTeamB: U.inkTeamB,
        inkBump: U.inkBump, inkNoise: U.inkNoise, inkTime: U.inkTime,
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec2 inkUv;
          attribute vec3 inkTan;
          varying vec2 vInkUv;
          varying vec3 vInkT;
          varying vec3 vInkW;
          varying vec3 vInkN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vInkUv = inkUv;
          vInkT = normalize((viewMatrix * modelMatrix * vec4(inkTan, 0.0)).xyz);
          vInkW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vInkN = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D inkMap;
          uniform sampler2D inkNoise;
          uniform vec2 inkAtlasSize;
          uniform vec3 inkTeamA;
          uniform vec3 inkTeamB;
          uniform float inkBump;
          uniform float inkTime;
          varying vec2 vInkUv;
          varying vec3 vInkT;
          varying vec3 vInkW;
          varying vec3 vInkN;
          float inkLod(vec2 uv) {
            vec2 px = uv * inkAtlasSize;
            vec2 dx = dFdx(px), dy = dFdy(px);
            return clamp(0.5 * log2(max(dot(dx, dx), dot(dy, dy))), 0.0, 2.0);
          }
          vec2 inkNoiseUv(vec3 w, vec3 n) {
            vec3 a = abs(n);
            return (a.y > a.x && a.y > a.z) ? w.xz : ((a.x > a.z) ? w.zy : w.xy);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float inkL = inkLod(vInkUv);
          vec4 inkS = textureLod(inkMap, vInkUv, inkL);
          float inkCov = max(inkS.r, inkS.g);
          vec2 nuv = inkNoiseUv(vInkW, vInkN);
          float inkN1 = texture2D(inkNoise, nuv * 0.55).r;
          float inkN2 = texture2D(inkNoise, nuv * 2.3 + 0.37).g;
          float inkThr = 0.5 + (inkN1 - 0.5) * 0.18 + (inkN2 - 0.5) * 0.08;
          float inkAA = max(fwidth(inkCov) * 0.9, 0.012);
          float inkAmt = smoothstep(inkThr - inkAA, inkThr + inkAA, inkCov);
          vec3 inkCol = inkS.r >= inkS.g ? inkTeamA : inkTeamB;
          // raised edge: height field from neighbouring texels
          vec2 inkTx = exp2(inkL) / inkAtlasSize;
          float hC = smoothstep(inkThr - 0.22, inkThr + 0.26, inkCov);
          float hR = smoothstep(inkThr - 0.22, inkThr + 0.26, max(textureLod(inkMap, vInkUv + vec2(inkTx.x, 0.0), inkL).r, textureLod(inkMap, vInkUv + vec2(inkTx.x, 0.0), inkL).g));
          float hU = smoothstep(inkThr - 0.22, inkThr + 0.26, max(textureLod(inkMap, vInkUv + vec2(0.0, inkTx.y), inkL).r, textureLod(inkMap, vInkUv + vec2(0.0, inkTx.y), inkL).g));
          float inkDu = (hR - hC);
          float inkDv = (hU - hC);
          float inkSheen = (inkN2 - 0.5) * 0.08;
          diffuseColor.rgb = mix(diffuseColor.rgb, inkCol * (0.92 + inkSheen), inkAmt);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.14 + inkN1 * 0.1, inkAmt);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.0, inkAmt);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 inkTv = normalize(vInkT - dot(vInkT, normal) * normal);
            vec3 inkBv = cross(normal, inkTv);
            float inkEdge = clamp(max(inkAmt, hC) * 1.4, 0.0, 1.0);
            normal = normalize(normal - inkBump * inkEdge * (inkDu * inkTv + inkDv * inkBv));
          }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += inkCol * 0.06 * inkAmt;`);
    };
    material.customProgramCacheKey = () => 'inktide-ink-surface';
    material.needsUpdate = true;
    return material;
  }

  dispose() {
    this.rt?.dispose();
    this.uniforms.inkNoise.value?.dispose();
    this._paintMesh?.geometry.dispose();
    this._paintMesh?.material.dispose();
  }
}

/** Tiling value-noise texture (R: soft blobs, G: fine grain) used to wobble ink edges. */
function makeNoiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const rnd = mulberry(1337);
  const grid = (n) => { const g = []; for (let i = 0; i < n * n; i++) g.push(rnd()); return g; };
  const g1 = grid(8), g2 = grid(32);
  const sample = (g, n, x, y) => {
    const fx = x * n, fy = y * n;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (i, j) => g[((j % n) + n) % n * n + (((i % n) + n) % n)];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const i = (y * size + x) * 4;
    data[i] = Math.round(255 * (0.7 * sample(g1, 8, u, v) + 0.3 * sample(g2, 32, u, v)));
    data[i + 1] = Math.round(255 * sample(g2, 32, u, v));
    data[i + 2] = Math.round(255 * rnd());
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
