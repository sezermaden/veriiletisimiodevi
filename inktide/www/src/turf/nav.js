// Turf Clash navigation: a waypoint graph sampled from the level's walkable floors, and A* over it.
//
// Build (once per match, ~0.1-0.3 s):
//   1. sample points on every floor ink face (N.y > 0.6, paintable or not — grates too) on a
//      ~1.5 m grid in face space; validate each with a downward ray (not covered, headroom), push it
//      away from walls (knee-height probes) and drop points next to a void (water / kill plane);
//   2. merge near-duplicates (face borders);
//   3. connect neighbours (≤ 2.35 m apart): WALK when the ground between is continuous (flat or a
//      ramp) and the knee-height line is clear, JUMP for steps ≤ 0.95 m, one-way DROP off ledges,
//      one-way CLIMB up a paintable vertical wall (bots paint it, then swim up);
//   4. label connected components from both bases; mark nodes inside each base zone.
// Paths: A* with live costs (enemy ink is slow, the enemy base is off-limits), cached briefly.
import * as THREE from 'three';

export const WALK = 0, JUMP = 1, DROP = 2, CLIMB = 3;
export const EDGE_NAMES = ['walk', 'jump', 'drop', 'climb'];

const GRID = 1.5;
const LINK = 2.35;
const KNEE = 0.55;
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const DIRS8 = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos((i / 8) * Math.PI * 2), 0, Math.sin((i / 8) * Math.PI * 2)));

function pointInPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}

/** Min-heap of node indices keyed by an external score array. */
class Heap {
  constructor(n) { this.a = new Int32Array(Math.max(16, n)); this.n = 0; }
  clear() { this.n = 0; }
  push(i, f) {
    if (this.n >= this.a.length) { const b = new Int32Array(this.a.length * 2); b.set(this.a); this.a = b; }
    let k = this.n++;
    const a = this.a;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (f[a[p]] <= f[i]) break;
      a[k] = a[p]; k = p;
    }
    a[k] = i;
  }
  pop(f) {
    const a = this.a;
    const top = a[0];
    const last = a[--this.n];
    let k = 0;
    const n = this.n;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= n) break;
      if (c + 1 < n && f[a[c + 1]] < f[a[c]]) c++;
      if (f[a[c]] >= f[last]) break;
      a[k] = a[c]; k = c;
    }
    if (n > 0) a[k] = last;
    return top;
  }
}

export class NavGraph {
  /**
   * @param {Session} session
   * @param {object} o  baseZones {alpha:{min,max}, bravo:{min,max}}, links (extra [{from,to,kind}])
   */
  constructor(session, o = {}) {
    this.S = session;
    this.level = session.level;
    this.ink = session.ink;
    this.o = o;
    this.count = 0;
    this.cache = new Map();
    this.stats = {};
  }

  // ---------------------------------------------------------------------------------------------
  build() {
    const t0 = performance.now();
    const level = this.level;
    const pts = [];            // {x,y,z,face}
    let rays = 0;
    const cast = (o, d, far) => { rays++; return level.raycast(o, d, far, { staticOnly: true }); };

    // ---- 1. samples ----
    const hash = new Map();
    const hkey = (x, z) => ((Math.floor(x / 0.9) * 73856093) ^ (Math.floor(z / 0.9) * 19349663));
    const tryPoint = (x, y, z) => {
      // covered / headroom: the first surface below a point 1.7 m above must be this floor
      _o.set(x, y + 1.7, z);
      let h = cast(_o, DOWN, 1.95);
      if (!h || h.normal.y < 0.6 || Math.abs(h.point.y - y) > 0.14) return;
      let px = x, pz = z, py = h.point.y, face = h.faceId;
      // push away from walls (knee height)
      let pushX = 0, pushZ = 0;
      for (const d of DIRS8) {
        _o.set(px, py + 0.5, pz);
        const w = cast(_o, d, 0.55);
        if (w && Math.abs(w.normal.y) < 0.6) {
          pushX -= d.x * (0.58 - w.distance);
          pushZ -= d.z * (0.58 - w.distance);
        }
      }
      if (pushX || pushZ) {
        px += pushX; pz += pushZ;
        _o.set(px, py + 1.7, pz);
        h = cast(_o, DOWN, 2.4);
        if (!h || h.normal.y < 0.6 || Math.abs(h.point.y - py) > 0.3) return;
        py = h.point.y; face = h.faceId;
        for (const d of DIRS8) {
          _o.set(px, py + 0.5, pz);
          const w = cast(_o, d, 0.34);
          if (w && Math.abs(w.normal.y) < 0.6) return;
        }
      }
      // never next to a void (water / kill plane)
      for (let i = 0; i < 8; i += 2) {
        const d = DIRS8[i];
        _o.set(px + d.x * 0.8, py + 0.6, pz + d.z * 0.8);
        const g = cast(_o, DOWN, 4.5);
        if (!g) return;
      }
      // dedupe
      const k = hkey(px, pz);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const list = hash.get(hkey(px + dx * 0.9, pz + dz * 0.9));
        if (!list) continue;
        for (const q of list) if ((q.x - px) ** 2 + (q.z - pz) ** 2 < 0.8 * 0.8 && Math.abs(q.y - py) < 0.6) return;
      }
      const p = { x: px, y: py, z: pz, face };
      pts.push(p);
      let list = hash.get(k);
      if (!list) hash.set(k, (list = []));
      list.push(p);
    };

    for (const f of this.ink.faces) {
      if (!f.isFloor) continue;
      const poly = f.poly || [[0, 0], [f.lenU, 0], [f.lenU, f.lenV], [0, f.lenV]];
      const nu = Math.max(1, Math.round(f.lenU / GRID)), nv = Math.max(1, Math.round(f.lenV / GRID));
      const su = f.lenU / nu, sv = f.lenV / nv;
      let any = false;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const u = (i + 0.5) * su, v = (j + 0.5) * sv;
        if (!pointInPoly(u, v, poly)) continue;
        f.point(u, v, _p);
        const before = pts.length;
        tryPoint(_p.x, _p.y, _p.z);
        if (pts.length > before) any = true;
      }
      if (!any && f.area > 0.6) {
        // small or oddly shaped face: try its centroid
        let cu = 0, cv = 0;
        for (const [u, v] of poly) { cu += u; cv += v; }
        f.point(cu / poly.length, cv / poly.length, _p);
        tryPoint(_p.x, _p.y, _p.z);
      }
    }

    const n = this.count = pts.length;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.face = new Int32Array(n);
    this.baseTeam = new Uint8Array(n);      // 1 = inside Alpha base zone, 2 = Bravo
    const zones = this.o.baseZones || {};
    const inZone = (z, x, y, zz) => z && x >= z.min[0] && x <= z.max[0] && y >= z.min[1] && y <= z.max[1] && zz >= z.min[2] && zz <= z.max[2];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      this.px[i] = p.x; this.py[i] = p.y; this.pz[i] = p.z; this.face[i] = p.face;
      this.baseTeam[i] = inZone(zones.alpha, p.x, p.y, p.z) ? 1 : inZone(zones.bravo, p.x, p.y, p.z) ? 2 : 0;
    }
    this._buildGrid();

    // ---- 3. edges ----
    const adj = Array.from({ length: n }, () => []);
    const climbs = [];
    const add = (a, b, kind, cost, extra) => { adj[a].push({ to: b, kind, cost, extra }); };
    // continuous = a flat floor or a steady slope; a sudden step (ledge, pad, stair riser) is not
    const groundContinuous = (a, b) => {
      const N = 6;
      const dyTot = this.py[b] - this.py[a];
      const stepMax = Math.max(0.2, (Math.abs(dyTot) / (N + 1)) * 1.8);
      let prevH = this.py[a];
      for (let k = 1; k <= N; k++) {
        const t = k / (N + 1);
        const x = this.px[a] + (this.px[b] - this.px[a]) * t;
        const z = this.pz[a] + (this.pz[b] - this.pz[a]) * t;
        const y = this.py[a] + dyTot * t;
        _o.set(x, Math.max(this.py[a], this.py[b]) + 1.2, z);
        const g = cast(_o, DOWN, Math.abs(dyTot) + 2.2);
        if (!g || g.normal.y < 0.6 || Math.abs(g.point.y - y) > 0.3) return false;
        if (Math.abs(g.point.y - prevH) > stepMax) return false;
        prevH = g.point.y;
      }
      return Math.abs(this.py[b] - prevH) <= stepMax;
    };
    const clear = (x0, y0, z0, x1, y1, z1) => {
      _a.set(x0, y0, z0); _b.set(x1, y1, z1);
      _d.subVectors(_b, _a);
      const len = _d.length();
      if (len < 1e-4) return true;
      _d.divideScalar(len);
      return !cast(_a, _d, len);
    };
    for (let a = 0; a < n; a++) {
      const ax = this.px[a], ay = this.py[a], az = this.pz[a];
      this._near(ax, az, LINK, (b) => {
        if (b <= a) return;
        const bx = this.px[b], by = this.py[b], bz = this.pz[b];
        const dxz = Math.hypot(bx - ax, bz - az);
        if (dxz > LINK || dxz < 0.3) return;
        const dy = by - ay;
        const lo = dy >= 0 ? a : b, hi = dy >= 0 ? b : a;
        const ady = Math.abs(dy);
        const len = Math.hypot(dxz, dy);
        if (ady <= 1.7 && groundContinuous(a, b) && clear(ax, ay + KNEE, az, bx, by + KNEE, bz) && clear(ax, ay + 1.2, az, bx, by + 1.2, bz)) {
          add(a, b, WALK, len); add(b, a, WALK, len);
          return;
        }
        const lx = this.px[lo], ly = this.py[lo], lz = this.pz[lo];
        const hx = this.px[hi], hy = this.py[hi], hz = this.pz[hi];
        if (ady >= 0.25 && ady <= 0.95) {
          // step: jump up, walk off to come down
          if (clear(lx, hy + 0.7, lz, hx, hy + 0.7, hz) && clear(lx, ly + 0.3, lz, lx, hy + 1.3, lz)) {
            add(lo, hi, JUMP, len + 0.6); add(hi, lo, DROP, len);
          }
          return;
        }
        if (ady > 0.95 && ady <= 7.5) {
          // ledge: drop down one way (the fall path must be clear)
          if (clear(hx, hy + 0.5, hz, lx, hy + 0.5, lz) && clear(lx, hy + 0.5, lz, lx, ly + 0.3, lz)) add(hi, lo, DROP, len + 0.3);
          // wall between them that can be inked and climbed in squid form
          if (ady <= 5.2) {
            _o.set(lx, ly + 0.5, lz);
            _d.set(hx - lx, 0, hz - lz).normalize();
            const w = cast(_o, _d, dxz + 0.2);
            if (w && w.face && w.face.paintable && Math.abs(w.normal.y) < 0.25 && w.distance > 0.2 &&
              w.face.aabb.max.y >= hy - 0.2 && w.face.aabb.min.y <= ly + 0.35 &&
              clear(w.point.x + w.normal.x * 0.3, hy + 0.6, w.point.z + w.normal.z * 0.3, hx, hy + 0.6, hz)) {
              const info = { face: w.faceId, px: w.point.x, py: w.point.y, pz: w.point.z, nx: w.normal.x, nz: w.normal.z, top: hy };
              add(lo, hi, CLIMB, len + ady * 1.5 + 4, info);
              climbs.push(info);
            }
          }
        }
      });
    }
    // authored extra links (e.g. launch pads): [{from:[x,y,z], to:[x,y,z], kind:'walk'|'jump'|'drop'|'climb'}]
    for (const l of this.o.links || []) {
      const a = this.nearest(_a.fromArray(l.from), 3), b = this.nearest(_b.fromArray(l.to), 3);
      if (a < 0 || b < 0) continue;
      const kind = EDGE_NAMES.indexOf(l.kind || 'walk');
      add(a, b, Math.max(0, kind), _a.distanceTo(_b) + (l.cost || 0), l.extra || null);
    }

    // CSR
    let m = 0;
    for (const l of adj) m += l.length;
    this.eStart = new Int32Array(n + 1);
    this.eTo = new Int32Array(m);
    this.eKind = new Uint8Array(m);
    this.eCost = new Float32Array(m);
    this.eExtra = new Array(m).fill(null);
    let k = 0;
    for (let i = 0; i < n; i++) {
      this.eStart[i] = k;
      for (const e of adj[i]) { this.eTo[k] = e.to; this.eKind[k] = e.kind; this.eCost[k] = e.cost; this.eExtra[k] = e.extra || null; k++; }
    }
    this.eStart[n] = k;

    // ---- 4. reachability from both bases (walk graph, directed) ----
    // (this.reach stays unset while flooding so nearest() can still seed from any node)
    this.reach = null;
    const reach = new Uint8Array(n);   // bit 1: reachable from Alpha base, bit 2: from Bravo base
    const B = this.S.level.def.bases || {};
    for (const [bit, pos] of [[1, B.alpha], [2, B.bravo]]) {
      if (!pos) continue;
      const s = this.nearest(_a.fromArray(pos), 4);
      if (s < 0) continue;
      const q = [s];
      reach[s] |= bit;
      while (q.length) {
        const i = q.pop();
        for (let e = this.eStart[i]; e < this.eStart[i + 1]; e++) {
          const j = this.eTo[e];
          if (!(reach[j] & bit)) { reach[j] |= bit; q.push(j); }
        }
      }
    }
    this.reach = reach;

    // A* scratch
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.came = new Int32Array(n);
    this.cameEdge = new Int32Array(n);
    this.gen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.curGen = 1;
    this.heap = new Heap(n);

    let reachBoth = 0;
    for (let i = 0; i < n; i++) if (this.reach[i] === 3) reachBoth++;
    const kinds = [0, 0, 0, 0];
    for (let e = 0; e < m; e++) kinds[this.eKind[e]]++;
    this.stats = { nodes: n, edges: m, walk: kinds[0], jump: kinds[1], drop: kinds[2], climb: kinds[3], reachBoth, rays, ms: Math.round(performance.now() - t0) };
    return this;
  }

  _buildGrid() {
    this.cell = 2.5;
    this.grid = new Map();
    for (let i = 0; i < this.count; i++) {
      const k = this._gk(Math.floor(this.px[i] / this.cell), Math.floor(this.pz[i] / this.cell));
      let l = this.grid.get(k);
      if (!l) this.grid.set(k, (l = []));
      l.push(i);
    }
  }

  _gk(ix, iz) { return ix * 100003 + iz; }

  _near(x, z, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const l = this.grid.get(this._gk(ix, iz));
      if (l) for (const i of l) fn(i);
    }
  }

  /**
   * Closest node to a position (vertical distance weighted ×2.5); -1 if none within maxDist.
   * Nodes no base can reach (e.g. floor sampled inside a solid block) are never returned: snapping
   * onto one makes every path from there fail.
   */
  nearest(pos, maxDist = 3, team = 0) {
    let best = -1, bd = maxDist * maxDist;
    const reach = this.reach;
    this._near(pos.x, pos.z, maxDist, (i) => {
      if (reach && (team ? !(reach[i] & team) : !reach[i])) return;
      const dx = this.px[i] - pos.x, dz = this.pz[i] - pos.z, dy = (this.py[i] - pos.y) * 2.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  pos(i, out) { return out.set(this.px[i], this.py[i], this.pz[i]); }

  /** Fraction (0..1) of the floor within r of node i that `team` owns. */
  inkFrac(i, r, team) {
    const f = this.face[i];
    if (f < 0) return 0;
    _p.set(this.px[i], this.py[i], this.pz[i]);
    return this.ink.inkFraction(f, _p, r, team);
  }

  /** Is node i on the given team's ink right now? */
  inkAt(i) {
    const f = this.face[i];
    if (f < 0) return 0;
    _p.set(this.px[i], this.py[i], this.pz[i]);
    return this.ink.inkAt(f, _p);
  }

  /**
   * A* from node a to node b for `team` (1 Alpha, 2 Bravo). Returns an array of node indices
   * (a first) or null. `avoid` = Set of edge indices to skip (e.g. a climb that failed).
   */
  findPath(a, b, team, avoid = null) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [a];
    const key = (a * 131071 + b) * 4 + team;
    const now = this.S.time;
    const c = this.cache.get(key);
    if (c && now - c.t < 1.5 && !avoid) return c.path;
    const enemyTeam = team === 1 ? 2 : 1;
    const gen = ++this.curGen;
    const { g, f, came, cameEdge, heap } = this;
    const bx = this.px[b], by = this.py[b], bz = this.pz[b];
    const h = (i) => Math.hypot(this.px[i] - bx, this.pz[i] - bz) + Math.abs(this.py[i] - by) * 0.5;
    heap.clear();
    this.gen[a] = gen; g[a] = 0; f[a] = h(a); came[a] = -1; cameEdge[a] = -1;
    heap.push(a, f);
    let expanded = 0;
    let found = false;
    while (heap.n) {
      const i = heap.pop(f);
      if (this.closed[i] === gen) continue;
      this.closed[i] = gen;
      if (i === b) { found = true; break; }
      if (++expanded > 6000) break;
      for (let e = this.eStart[i]; e < this.eStart[i + 1]; e++) {
        if (avoid && avoid.has(e)) continue;
        const j = this.eTo[e];
        if (this.closed[j] === gen) continue;
        if (this.baseTeam[j] === enemyTeam) continue;
        let cost = this.eCost[e];
        const ink = this.inkAt(j);
        if (ink === enemyTeam) cost *= 2.2;
        else if (ink === team) cost *= 0.8;
        const ng = g[i] + cost;
        if (this.gen[j] !== gen || ng < g[j]) {
          this.gen[j] = gen;
          g[j] = ng; f[j] = ng + h(j); came[j] = i; cameEdge[j] = e;
          heap.push(j, f);
        }
      }
    }
    let path = null;
    if (found) {
      path = [];
      for (let i = b; i !== -1; i = came[i]) path.push(i);
      path.reverse();
    }
    if (!avoid) {
      if (this.cache.size > 400) this.cache.clear();
      this.cache.set(key, { path, t: now });
    }
    return path;
  }

  /** Edge index from node i to node j (or -1). */
  edge(i, j) {
    for (let e = this.eStart[i]; e < this.eStart[i + 1]; e++) if (this.eTo[e] === j) return e;
    return -1;
  }

  dispose() { this.cache.clear(); this.grid?.clear(); }
}
