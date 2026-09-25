// Level validator (Node, no browser): builds the collision soup from a stage's brushes and checks
//   - spawn / entities stand on ground and are not embedded in geometry
//   - the authored route (def.route) is traversable with INKTIDE's measured move set
//   - required story objects exist (prism-core or a boss, checkpoints, pearls, postcard)
//
//   node tools/validate-level.mjs w1-1 [w1-2 ...]      (ids from www/src/levels/index.js)
//   node tools/validate-level.mjs --all
//
// Route format (optional but strongly recommended in story stages):
//   route: [[x,y,z], [x,y,z, 'climb'], [x,y,z, 'launch'], [x,y,z, 'rail'], [x,y,z, 'squidjump'], ...]
// Each point is where the player's feet can stand; the optional tag says how the segment INTO that
// point is traversed ('walk' default). The validator checks the tag is plausible.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const here = path.dirname(fileURLToPath(import.meta.url));
const www = path.resolve(here, '../www');
const { brushFaces, planarFrame, triangulate } = await import(pathToFileURL(path.join(www, 'src/world/brushes.js')).href);

// movement facts (see actors/player.js PLAYER_TUNING): kid jump 1.2 m / 3.5 m, squid jump 2.0 m / 8 m
const MOVE = { stepUp: 0.45, kidJumpH: 1.15, kidJumpD: 3.4, squidJumpH: 1.95, squidJumpD: 7.8, dropMax: 12 };
const UNPAINTABLE = new Set(['grate', 'glass']);
const GROUND_TYPES = new Set(['checkpoint', 'prism-core', 'launchpad', 'spring', 'npc', 'crate', 'glooper', 'shield-glooper', 'rollerbrute', 'snipe-eel', 'bomblob', 'murk-turret', 'murk-pod', 'switch', 'balloon']);

function build(def) {
  const pos = [];
  const tri = [];      // per triangle: { paintable, n: Vector3, mat }
  for (const b of def.brushes || []) {
    if (b.collide === false) continue;
    for (const pf of brushFaces(b)) {
      const fr = planarFrame(pf.points);
      const paintable = b.paint !== false && !UNPAINTABLE.has(b.mat) && pf.side !== 'bottom';
      const P = fr.poly.map(([u, v]) => fr.origin.clone().addScaledVector(fr.U, u).addScaledVector(fr.V, v));
      for (const t of triangulate(fr.poly)) {
        pos.push(P[t[0]].x, P[t[0]].y, P[t[0]].z, P[t[1]].x, P[t[1]].y, P[t[1]].z, P[t[2]].x, P[t[2]].y, P[t[2]].z);
        tri.push({ paintable, n: fr.N.clone(), mat: b.mat || 'concrete' });
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const bvh = new MeshBVH(g);
  const ray = new THREE.Ray();
  const cast = (o, d, far) => {
    ray.origin.copy(o); ray.direction.copy(d).normalize();
    const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, far);
    if (!h || h.distance > far) return null;
    return { point: h.point, distance: h.distance, info: tri[Math.floor(h.face.a / 3)], normal: tri[Math.floor(h.face.a / 3)].n };
  };
  return { bvh, cast, tris: tri.length };
}

function groundAt(W, x, y, z, above = 1.2, below = 30) {
  const h = W.cast(new THREE.Vector3(x, y + above, z), new THREE.Vector3(0, -1, 0), above + below);
  return h && h.normal.y > 0.5 ? h : null;
}

/** Is the point inside solid geometry? (odd number of hits going up) */
function embedded(W, p) {
  const o = new THREE.Vector3(p[0], p[1] + 0.25, p[2]);
  let n = 0, cur = o.clone();
  for (let i = 0; i < 20; i++) {
    const h = W.cast(cur, new THREE.Vector3(0, 1, 0), 200);
    if (!h) break;
    n++; cur = h.point.clone().add(new THREE.Vector3(0, 0.001, 0));
  }
  return n % 2 === 1;
}

function checkSegment(W, a, b, tag) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const flat = Math.hypot(B.x - A.x, B.z - A.z);
  const dy = B.y - A.y;
  if (tag === 'launch' || tag === 'rail' || tag === 'mover' || tag === 'superjump') return null;   // entity-assisted
  // sample the ground along the segment
  const n = Math.max(2, Math.ceil(flat / 0.4));
  let gap = 0, maxGap = 0, maxRise = 0, prevY = A.y, lowest = Infinity;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t;
    const probeTop = Math.max(A.y, B.y) + 0.6;
    const g = W.cast(new THREE.Vector3(x, probeTop, z), new THREE.Vector3(0, -1, 0), probeTop - Math.min(A.y, B.y) + 1.5);
    const gy = g && g.normal.y > 0.5 ? g.point.y : null;
    if (gy == null || gy < Math.min(A.y, B.y) - 1.4) { gap += flat / n; maxGap = Math.max(maxGap, gap); }
    else {
      gap = 0;
      maxRise = Math.max(maxRise, gy - prevY);
      prevY = gy;
      lowest = Math.min(lowest, gy);
    }
  }
  const problems = [];
  if (tag === 'climb') {
    // need a paintable wall between A and B
    const dir = new THREE.Vector3(B.x - A.x, 0, B.z - A.z).normalize();
    const hit = W.cast(A.clone().add(new THREE.Vector3(0, 0.4, 0)), dir, flat + 0.5);
    if (!hit) problems.push('climb: no wall found between the points');
    else if (!hit.info.paintable) problems.push(`climb: wall is not paintable (${hit.info.mat})`);
    else if (Math.abs(hit.normal.y) > 0.3) problems.push('climb: surface hit is not a wall');
    return problems.length ? problems : null;
  }
  const jumpH = tag === 'squidjump' ? MOVE.squidJumpH : MOVE.kidJumpH;
  const jumpD = tag === 'squidjump' ? MOVE.squidJumpD : MOVE.kidJumpD;
  if (maxGap > jumpD) problems.push(`gap of ${maxGap.toFixed(1)} m exceeds ${tag === 'squidjump' ? 'squid' : 'kid'} jump ${jumpD} m`);
  if (dy > jumpH && maxRise > jumpH) problems.push(`rise of ${dy.toFixed(2)} m needs a ramp/stairs, a climbable wall ('climb') or a launchpad`);
  if (maxRise > jumpH) problems.push(`a step of ${maxRise.toFixed(2)} m along the way is higher than a jump (${jumpH} m)`);
  if (dy < -MOVE.dropMax) problems.push(`drop of ${(-dy).toFixed(1)} m is suspiciously high`);
  return problems.length ? problems : null;
}

async function validate(id) {
  const { STAGE_LOADERS } = await import(pathToFileURL(path.join(www, 'src/levels/index.js')).href);
  const loader = STAGE_LOADERS[id] || (id.startsWith('file:') ? () => import(id) : null);
  const errors = [], warnings = [];
  if (!loader) return { id, errors: [`unknown stage id ${id}`], warnings };
  let def;
  try {
    const m = await loader();
    def = typeof m.default === 'function' ? m.default() : m.default;
  } catch (e) { return { id, errors: [`failed to load: ${e.message}`], warnings }; }
  const W = build(def);
  const killY = def.killY ?? -6;

  // spawn
  const sp = def.spawn?.pos;
  if (!sp) errors.push('no spawn');
  else {
    const g = groundAt(W, sp[0], sp[1], sp[2]);
    if (!g) errors.push(`spawn ${sp} has no ground below`);
    else if (Math.abs(g.point.y - sp[1]) > 0.6) warnings.push(`spawn y ${sp[1]} but ground at ${g.point.y.toFixed(2)}`);
    if (embedded(W, sp)) errors.push('spawn is inside geometry');
  }
  // entities
  const count = {};
  for (const e of def.entities || []) {
    count[e.type] = (count[e.type] || 0) + 1;
    if (!e.pos) continue;
    if (GROUND_TYPES.has(e.type)) {
      const g = groundAt(W, e.pos[0], e.pos[1], e.pos[2], 1.2, 3);
      if (!g) errors.push(`${e.type}${e.id ? ' ' + e.id : ''} at [${e.pos}] has no ground within 3 m below`);
      else if (g.point.y < killY) errors.push(`${e.type} at [${e.pos}] stands below killY`);
    }
    if (['pearl', 'postcard', 'checkpoint', 'prism-core'].includes(e.type) && embedded(W, e.pos)) errors.push(`${e.type} at [${e.pos}] is inside geometry`);
  }
  const story = /^w\d-\d$/.test(id);
  const boss = /^w\d-boss$/.test(id);
  if (story) {
    if (!count['prism-core']) errors.push('story stage without a prism-core goal');
    if ((count.checkpoint || 0) < 2) warnings.push(`only ${count.checkpoint || 0} checkpoints (want 2+)`);
    const pearls = (count.pearl || 0) + (def.entities || []).filter((e) => e.type === 'pearl-trail').reduce((s, e) => s + (e.count || 5), 0);
    if (pearls < 20) warnings.push(`only ${pearls} pearls (want 20+)`);
    if (!count.postcard) warnings.push('no hidden postcard');
    if (!def.route) warnings.push('no def.route — traversal not validated');
  }
  if (boss && !Object.keys(count).some((t) => t.startsWith('boss-'))) errors.push('boss stage without a boss entity');
  const decor = count.decor || 0;
  if ((story || boss) && decor < 25) warnings.push(`only ${decor} decor props — the level may look like a blockout`);

  // route
  if (def.route) {
    for (let i = 1; i < def.route.length; i++) {
      const a = def.route[i - 1], b = def.route[i];
      const tag = b[3] || 'walk';
      const g = groundAt(W, b[0], b[1], b[2], 1.0, 2.5);
      if (!g && tag !== 'rail') errors.push(`route[${i}] [${b.slice(0, 3)}] has no ground`);
      const p = checkSegment(W, a, b, tag);
      if (p) for (const msg of p) errors.push(`route ${i - 1}→${i} (${tag}): ${msg}`);
    }
    // the goal should be near the last route point
    const core = (def.entities || []).find((e) => e.type === 'prism-core' || e.type?.startsWith('boss-'));
    const last = def.route[def.route.length - 1];
    if (core && Math.hypot(core.pos[0] - last[0], core.pos[2] - last[2]) > 12) warnings.push('route does not end near the goal');
  }
  return { id, errors, warnings, stats: { triangles: W.tris, entities: count } };
}

const args = process.argv.slice(2);
let ids = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all')) {
  const { STAGE_LOADERS } = await import(pathToFileURL(path.join(www, 'src/levels/index.js')).href);
  ids = Object.keys(STAGE_LOADERS).filter((k) => /^w\d/.test(k) || k.startsWith('turf-'));
}
let bad = 0;
for (const id of ids) {
  const r = await validate(id);
  const status = r.errors.length ? 'FAIL' : 'ok  ';
  if (r.errors.length) bad++;
  console.log(`${status} ${id}  ${r.stats ? `(${r.stats.triangles} tris, ${Object.entries(r.stats.entities).map(([k, v]) => `${k}×${v}`).join(' ')})` : ''}`);
  for (const e of r.errors) console.log('   ERROR  ' + e);
  for (const w of r.warnings) console.log('   warn   ' + w);
}
process.exit(bad ? 1 : 0);
