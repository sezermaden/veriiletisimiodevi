// Level: turns a level definition (brushes, props, entities) into renderable, paintable,
// collidable geometry. Owns the ink faces, the static BVH and a list of dynamic colliders.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { brushFaces, planarFrame, triangulate } from './brushes.js';
import { SURFACES, surfaceTextures } from './textures.js';
import { TEAM_HERO, TEAM_MURK } from '../ink/ink-system.js';

const _ray = new THREE.Ray();
const _inv = new THREE.Matrix4();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _seg = new THREE.Line3();
const _tri = new THREE.Vector3();
const _cap = new THREE.Vector3();
const _box = new THREE.Box3();
const _dir = new THREE.Vector3();
const _rot = new THREE.Matrix3();
const _ls0 = new THREE.Vector3();
const _ls = new THREE.Vector3();
const _le = new THREE.Vector3();
const _gN = new THREE.Vector3();
const _wN = new THREE.Vector3();

export class Level {
  constructor(session, def) {
    this.session = session;
    this.def = def;
    this.ink = session.ink;
    this.group = new THREE.Group();
    this.group.name = 'level:' + def.id;
    this.records = [];
    this.materials = new Map();
    this.dynamic = [];          // { mesh, bvh, enabled, tag, owner }
    this.killY = def.killY ?? -6;
    this.bounds = new THREE.Box3();
  }

  _material(key) {
    if (this.materials.has(key)) return this.materials.get(key);
    const def = SURFACES[key] || SURFACES.concrete;
    const tex = surfaceTextures(key);
    const m = new THREE.MeshStandardMaterial({
      map: tex.map,
      normalMap: tex.normalMap,
      normalScale: new THREE.Vector2(def.normal ?? 1, def.normal ?? 1),
      roughness: def.roughness,
      metalness: def.metalness,
      vertexColors: true,
      envMapIntensity: 0.9,
    });
    if (key === 'glass') { m.transparent = true; m.opacity = 0.55; m.depthWrite = false; }
    this.ink.patchMaterial(m);
    this.materials.set(key, m);
    return m;
  }

  build() {
    const def = this.def;
    // ---- 1. brushes → planar faces registered with the ink system ----
    for (const b of def.brushes || []) {
      const surf = SURFACES[b.mat || 'concrete'] || SURFACES.concrete;
      for (const pf of brushFaces(b)) {
        const fr = planarFrame(pf.points);
        const paintable = b.paint !== false && surf.paint !== false && (pf.side !== 'bottom' || !!b.paintBottom);
        const face = this.ink.addFace(fr.origin, fr.U, fr.V, fr.N, fr.lenU, fr.lenV, fr.poly, { paintable, tag: b.tag });
        this.records.push({ face, fr, b, mat: b.mat || 'concrete' });
        for (const p of pf.points) this.bounds.expandByPoint(p);
      }
    }
    this.ink.build();

    // ---- 2. geometry per material + collision soup ----
    const buckets = new Map();
    const colPos = [];
    const triFace = [];
    const color = new THREE.Color();
    const uvA = [0, 0];
    for (const r of this.records) {
      const { face, fr, b } = r;
      const visible = b.visible !== false;
      const surf = SURFACES[r.mat] || SURFACES.concrete;
      const scale = b.texScale || surf.scale;
      color.set(b.color || '#ffffff');
      const tris = triangulate(fr.poly);
      const P = fr.poly.map(([u, v]) => face.point(u, v, new THREE.Vector3()));
      if (visible) {
        let bk = buckets.get(r.mat);
        if (!bk) buckets.set(r.mat, (bk = { pos: [], nor: [], uv: [], inkUv: [], inkTan: [], col: [], idx: [], shadow: b.castShadow !== false }));
        const base = bk.pos.length / 3;
        for (let i = 0; i < fr.poly.length; i++) {
          const [u, v] = fr.poly[i];
          bk.pos.push(P[i].x, P[i].y, P[i].z);
          bk.nor.push(fr.N.x, fr.N.y, fr.N.z);
          // world-anchored texture coordinates so neighbouring brushes line up
          const wu = u + fr.origin.dot(fr.U), wv = v + fr.origin.dot(fr.V);
          bk.uv.push(wu / scale, wv / scale);
          this.ink.atlasUV(face, u, v, uvA);
          bk.inkUv.push(uvA[0], uvA[1]);
          bk.inkTan.push(fr.U.x, fr.U.y, fr.U.z);
          bk.col.push(color.r, color.g, color.b);
        }
        for (const t of tris) {
          const [a, bb, c] = orient(fr.poly, t);
          bk.idx.push(base + a, base + bb, base + c);
        }
      }
      if (b.collide !== false) {
        for (const t of tris) {
          const [a, bb, c] = orient(fr.poly, t);
          colPos.push(P[a].x, P[a].y, P[a].z, P[bb].x, P[bb].y, P[bb].z, P[c].x, P[c].y, P[c].z);
          triFace.push(face.id);
        }
      }
    }

    for (const [key, bk] of buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
      g.setAttribute('inkUv', new THREE.Float32BufferAttribute(bk.inkUv, 2));
      g.setAttribute('inkTan', new THREE.Float32BufferAttribute(bk.inkTan, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, 3));
      g.setIndex(bk.idx);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this._material(key));
      mesh.receiveShadow = true;
      mesh.castShadow = bk.shadow;
      mesh.name = 'surface:' + key;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }

    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(colPos, 3));
    this.collisionGeometry = cg;
    this.bvh = new MeshBVH(cg, { targetLeafSize: 8 });
    this.triFace = Int32Array.from(triFace);

    // ---- 3. pre-placed ink ----
    for (const s of def.preInk || []) {
      const team = s.team === 'hero' ? TEAM_HERO : TEAM_MURK;
      this.ink.paint(_v1.fromArray(s.at), s.r || 2, team, _v2.fromArray(s.n || [0, 1, 0]), { seed: s.seed, source: 'level' });
    }
    return this;
  }

  /** Register a moving/toggleable collider (static geometry, animated transform). */
  addDynamic(mesh, opts = {}) {
    const bvh = new MeshBVH(mesh.geometry);
    const d = { mesh, bvh, enabled: opts.enabled !== false, tag: opts.tag || null, owner: opts.owner || null, solid: opts.solid !== false };
    this.dynamic.push(d);
    return d;
  }

  removeDynamic(d) {
    const i = this.dynamic.indexOf(d);
    if (i >= 0) this.dynamic.splice(i, 1);
  }

  /**
   * First hit along a ray. Returns { point, normal, distance, faceId, face, dynamic } or null.
   * Dynamic colliders are included unless opts.staticOnly.
   */
  raycast(origin, dir, far = 200, opts = {}) {
    _ray.origin.copy(origin); _ray.direction.copy(dir);
    let best = null;
    const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
    if (hit && hit.distance <= far) {
      const faceId = this.triFace[hit.faceIndex];
      const n = hit.face.normal.clone();
      best = { point: hit.point.clone(), normal: n, distance: hit.distance, faceId, face: this.ink.faces[faceId], dynamic: null };
    }
    if (!opts.staticOnly) {
      for (const d of this.dynamic) {
        if (!d.enabled) continue;
        d.mesh.updateMatrixWorld();
        _inv.copy(d.mesh.matrixWorld).invert();
        _ray.origin.copy(origin).applyMatrix4(_inv);
        _ray.direction.copy(dir).transformDirection(_inv);
        const h = d.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
        if (!h) continue;
        const p = h.point.applyMatrix4(d.mesh.matrixWorld);
        const dist = p.distanceTo(origin);
        if (dist > far || (best && dist >= best.distance)) continue;
        const n = h.face.normal.clone().transformDirection(d.mesh.matrixWorld);
        best = { point: p, normal: n, distance: dist, faceId: -1, face: null, dynamic: d };
      }
    }
    return best;
  }

  /** Is there a clear line between a and b (static geometry only)? */
  lineOfSight(a, b) {
    _dir.subVectors(b, a);
    const len = _dir.length();
    if (len < 1e-4) return true;
    _dir.divideScalar(len);
    return !this.raycast(a, _dir, len - 0.05, { staticOnly: true });
  }

  /** Ground probe: first surface below p within `far`. */
  groundBelow(p, far = 30) {
    return this.raycast(_v2.set(p.x, p.y + 0.2, p.z), _dir.set(0, -1, 0), far + 0.2);
  }

  /**
   * Push a capsule (segment start..end, radius) out of the world. Mutates start/end.
   * Fills `contacts` with { ground, groundNormal, groundFace, wall, wallNormal, wallFace, ceiling, dynamic }.
   */
  collideCapsule(start, end, radius, contacts) {
    contacts.ground = false; contacts.wall = false; contacts.ceiling = false;
    contacts.groundFace = -1; contacts.wallFace = -1; contacts.dynamic = null;
    contacts.groundNormal.set(0, 1, 0); contacts.wallNormal.set(0, 0, 0);
    let bestGround = -1, bestWall = 0;

    const resolve = (bvh, triMap, dyn, start, end) => {
      _seg.start.copy(start); _seg.end.copy(end);
      _box.makeEmpty();
      _box.expandByPoint(_seg.start); _box.expandByPoint(_seg.end);
      _box.min.addScalar(-radius); _box.max.addScalar(radius);
      bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_box),
        intersectsTriangle: (tri, triIndex) => {
          const dist = tri.closestPointToSegment(_seg, _tri, _cap);
          if (dist >= radius) return false;
          const depth = radius - dist;
          const n = _v1;
          if (dist > 1e-5) n.subVectors(_cap, _tri).divideScalar(dist);
          else tri.getNormal(n);
          _seg.start.addScaledVector(n, depth);
          _seg.end.addScaledVector(n, depth);
          const faceId = triMap ? triMap[triIndex] : -1;
          if (n.y > 0.55) {
            contacts.ground = true;
            if (n.y > bestGround) { bestGround = n.y; contacts.groundNormal.copy(n); contacts.groundFace = faceId; if (dyn) contacts.dynamic = dyn; }
          } else if (n.y < -0.6) {
            contacts.ceiling = true;
          } else {
            contacts.wall = true;
            if (depth > bestWall) {
              bestWall = depth; contacts.wallNormal.copy(n); contacts.wallFace = faceId;
              contacts.wallPoint.copy(_tri);
            }
          }
          return false;
        },
      });
      start.copy(_seg.start); end.copy(_seg.end);
    };

    resolve(this.bvh, this.triFace, null, start, end);
    for (const d of this.dynamic) {
      if (!d.enabled || !d.solid) continue;
      d.mesh.updateMatrixWorld();
      _inv.copy(d.mesh.matrixWorld).invert();
      _rot.setFromMatrix4(d.mesh.matrixWorld);
      _ls0.copy(start).applyMatrix4(_inv);
      _ls.copy(_ls0);
      _le.copy(end).applyMatrix4(_inv);
      const hadGround = contacts.ground, hadWall = contacts.wall;
      const gN = _gN.copy(contacts.groundNormal), wN = _wN.copy(contacts.wallNormal);
      contacts.ground = false; contacts.wall = false;
      resolve(d.bvh, null, d, _ls, _le);
      if (contacts.ground) contacts.groundNormal.applyMatrix3(_rot).normalize(); else contacts.groundNormal.copy(gN);
      if (contacts.wall) { contacts.wallNormal.applyMatrix3(_rot).normalize(); contacts.wallPoint.applyMatrix4(d.mesh.matrixWorld); contacts.wallFace = -1; }
      else contacts.wallNormal.copy(wN);
      contacts.ground = contacts.ground || hadGround;
      contacts.wall = contacts.wall || hadWall;
      const delta = _ls.sub(_ls0).applyMatrix3(_rot);
      start.add(delta); end.add(delta);
    }
    return contacts;
  }

  dispose() {
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.materials.values()) m.dispose();
    this.collisionGeometry?.dispose();
  }
}

/** Keep triangle winding CCW in face space so normals face outward. */
function orient(poly, t) {
  const [a, b, c] = t;
  const [ax, ay] = poly[a], [bx, by] = poly[b], [cx, cy] = poly[c];
  const cr = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return cr >= 0 ? [a, b, c] : [a, c, b];
}

export function makeContacts() {
  return {
    ground: false, groundNormal: new THREE.Vector3(0, 1, 0), groundFace: -1,
    wall: false, wallNormal: new THREE.Vector3(), wallFace: -1, wallPoint: new THREE.Vector3(),
    ceiling: false, dynamic: null,
  };
}
