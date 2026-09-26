// Brush → planar polygon faces. Level geometry is authored as brushes (boxes, ramps, cylinders,
// extruded prisms, stairs); every brush turns into closed polygons with outward normals.
import * as THREE from 'three';

const P = (x, y, z) => new THREE.Vector3(x, y, z);

function newell(points, out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    out.x += (a.y - b.y) * (a.z + b.z);
    out.y += (a.z - b.z) * (a.x + b.x);
    out.z += (a.x - b.x) * (a.y + b.y);
  }
  return out.normalize();
}

function centroid(points, out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  for (const p of points) out.add(p);
  return out.divideScalar(points.length);
}

/** Make every face of a convex solid wind counter-clockwise when seen from outside. */
function orientConvex(faces) {
  const all = faces.flatMap((f) => f.points);
  const c = centroid(all);
  const n = new THREE.Vector3(), fc = new THREE.Vector3();
  for (const f of faces) {
    newell(f.points, n);
    centroid(f.points, fc);
    if (n.dot(fc.sub(c)) < 0) f.points.reverse();
  }
  return faces;
}

function rotateY(points, cx, cz, a) {
  if (!a) return points;
  const c = Math.cos(a), s = Math.sin(a);
  for (const p of points) {
    const x = p.x - cx, z = p.z - cz;
    p.x = cx + x * c + z * s;
    p.z = cz - x * s + z * c;
  }
  return points;
}

export function boxFaces(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const faces = [
    { points: [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], props: b, side: 'top' },
    { points: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], props: b, side: 'side' },
    { points: [P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0)], props: b, side: 'side' },
    { points: [P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)], props: b, side: 'side' },
    { points: [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], props: b, side: 'side' },
    { points: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], props: b, side: 'bottom' },
  ];
  if (b.rotY) for (const f of faces) rotateY(f.points, (x0 + x1) / 2, (z0 + z1) / 2, b.rotY);
  orientConvex(faces);
  return b.bottom === false ? faces.filter((f) => f.side !== 'bottom') : faces;
}

/** Wedge whose slope rises toward `dir` ('+x' | '-x' | '+z' | '-z'). */
export function rampFaces(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const dir = b.dir || '+z';
  // corners: low edge L0-L1, high edge H0-H1 (top), H0b-H1b (bottom of the high edge)
  let L0, L1, H0, H1;
  switch (dir) {
    case '+z': L0 = [x0, z0]; L1 = [x1, z0]; H0 = [x0, z1]; H1 = [x1, z1]; break;
    case '-z': L0 = [x0, z1]; L1 = [x1, z1]; H0 = [x0, z0]; H1 = [x1, z0]; break;
    case '+x': L0 = [x0, z0]; L1 = [x0, z1]; H0 = [x1, z0]; H1 = [x1, z1]; break;
    default: L0 = [x1, z0]; L1 = [x1, z1]; H0 = [x0, z0]; H1 = [x0, z1]; break;
  }
  const l0 = P(L0[0], y0, L0[1]), l1 = P(L1[0], y0, L1[1]);
  const h0 = P(H0[0], y1, H0[1]), h1 = P(H1[0], y1, H1[1]);
  const g0 = P(H0[0], y0, H0[1]), g1 = P(H1[0], y0, H1[1]);
  const faces = [
    { points: [l0.clone(), l1.clone(), h1.clone(), h0.clone()], props: b, side: 'top' },
    { points: [g0.clone(), g1.clone(), h1.clone(), h0.clone()], props: b, side: 'side' },
    { points: [l1.clone(), g1.clone(), h1.clone()], props: b, side: 'side' },
    { points: [l0.clone(), g0.clone(), h0.clone()], props: b, side: 'side' },
    { points: [l0.clone(), l1.clone(), g1.clone(), g0.clone()], props: b, side: 'bottom' },
  ];
  orientConvex(faces);
  return b.bottom === false ? faces.filter((f) => f.side !== 'bottom') : faces;
}

export function cylFaces(b) {
  const [cx, y0, cz] = b.at;
  const r = b.r, h = b.h, n = b.sides || 12;
  const y1 = y0 + h;
  const r1 = b.rTop ?? r;
  const ring = (y, rad) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (b.rot || 0);
    return P(cx + Math.cos(a) * rad, y, cz - Math.sin(a) * rad);
  });
  const lo = ring(y0, r), hi = ring(y1, r1);
  const faces = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ points: [lo[i].clone(), lo[j].clone(), hi[j].clone(), hi[i].clone()], props: b, side: 'side' });
  }
  faces.push({ points: hi.map((p) => p.clone()), props: b, side: 'top' });
  faces.push({ points: lo.map((p) => p.clone()), props: b, side: 'bottom' });
  orientConvex(faces);
  return b.bottom === false ? faces.filter((f) => f.side !== 'bottom') : faces;
}

function pointInPoly2(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}

/** Extruded polygon (may be concave): points [[x,z],...] in any winding, from y0 to y1. */
export function prismFaces(b) {
  const pts = b.points;
  const n = new THREE.Vector3();
  const top = pts.map(([x, z]) => P(x, b.y1, z));
  if (newell(top, n).y < 0) top.reverse();
  const bot = pts.map(([x, z]) => P(x, b.y0, z));
  if (newell(bot, n).y > 0) bot.reverse();
  const faces = [{ points: top, props: b, side: 'top' }];
  if (b.bottom !== false) faces.push({ points: bot, props: b, side: 'bottom' });
  for (let i = 0; i < pts.length; i++) {
    const [xa, za] = pts[i], [xb, zb] = pts[(i + 1) % pts.length];
    const quad = [P(xa, b.y0, za), P(xb, b.y0, zb), P(xb, b.y1, zb), P(xa, b.y1, za)];
    newell(quad, n);
    const mx = (xa + xb) / 2 + n.x * 0.01, mz = (za + zb) / 2 + n.z * 0.01;
    if (pointInPoly2(mx, mz, pts)) quad.reverse();       // normal pointed inside the footprint
    faces.push({ points: quad, props: b, side: 'side' });
  }
  return faces;
}

/** Stairs as boxes rising toward dir. */
export function stairsBoxes(b) {
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const n = b.steps || Math.max(2, Math.round((y1 - y0) / 0.3));
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = y0 + ((i + 1) / n) * (y1 - y0);
    const t0 = i / n;
    let mn, mx;
    switch (b.dir || '+z') {
      case '+z': mn = [x0, y0, z0 + t0 * (z1 - z0)]; mx = [x1, h, z1]; break;
      case '-z': mn = [x0, y0, z0]; mx = [x1, h, z1 - t0 * (z1 - z0)]; break;
      case '+x': mn = [x0 + t0 * (x1 - x0), y0, z0]; mx = [x1, h, z1]; break;
      default: mn = [x0, y0, z0]; mx = [x1 - t0 * (x1 - x0), h, z1]; break;
    }
    out.push({ ...b, t: 'box', min: mn, max: mx, bottom: false });
  }
  return out;
}

/** Expand any brush into polygon faces. */
export function brushFaces(b) {
  switch (b.t) {
    case 'box': return boxFaces(b);
    case 'ramp': return rampFaces(b);
    case 'cyl': return cylFaces(b);
    case 'prism': return prismFaces(b);
    case 'stairs': return stairsBoxes(b).flatMap(boxFaces);
    default:
      console.warn('Unknown brush type', b.t);
      return [];
  }
}

/**
 * Turn a 3D polygon into a planar frame: origin, U, V, N, lengths and a 2D polygon in metres.
 * Vertical faces get U horizontal and V up so textures and brick rows stay level.
 */
export function planarFrame(points) {
  const N = newell(points);
  const U = new THREE.Vector3();
  if (Math.abs(N.y) < 0.5) U.set(0, 1, 0).cross(N).normalize();
  else U.set(1, 0, 0).addScaledVector(N, -N.x).normalize();
  const V = new THREE.Vector3().crossVectors(N, U);
  const p0 = points[0];
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  const d = new THREE.Vector3();
  const loc = points.map((p) => {
    d.subVectors(p, p0);
    const u = d.dot(U), v = d.dot(V);
    minU = Math.min(minU, u); minV = Math.min(minV, v); maxU = Math.max(maxU, u); maxV = Math.max(maxV, v);
    return [u, v];
  });
  const origin = p0.clone().addScaledVector(U, minU).addScaledVector(V, minV);
  const poly = loc.map(([u, v]) => [u - minU, v - minV]);
  return { origin, U, V, N, lenU: Math.max(1e-3, maxU - minU), lenV: Math.max(1e-3, maxV - minV), poly };
}

/** Triangulate a 2D polygon (CCW) → index triples. Convex → fan, otherwise ear clipping. */
export function triangulate(poly) {
  if (poly.length === 3) return [[0, 1, 2]];
  if (isConvex(poly)) {
    const t = [];
    for (let i = 1; i < poly.length - 1; i++) t.push([0, i, i + 1]);
    return t;
  }
  const contour = poly.map(([x, y]) => new THREE.Vector2(x, y));
  return THREE.ShapeUtils.triangulateShape(contour, []);
}

function isConvex(poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], [cx, cy] = poly[(i + 2) % poly.length];
    const cr = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cr) < 1e-9) continue;
    const s = Math.sign(cr);
    if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}
