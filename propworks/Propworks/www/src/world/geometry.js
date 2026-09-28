/* Geometry helpers shared by props and level building. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Box whose UVs are scaled in metres, so a texture repeats every `uv` metres on every face
 * regardless of the box's size. uv = 0 keeps the default 0..1 per face.
 */
export function boxGeo(w, h, d, uv = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!uv) return g;
  const pos = g.attributes.position, nor = g.attributes.normal, uva = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let u, v;
    // u runs left-to-right as seen from outside each face, so painted labels read correctly
    if (Math.abs(nx) > 0.5) { u = nx > 0 ? -z : z; v = y; }
    else if (Math.abs(ny) > 0.5) { u = x; v = ny > 0 ? -z : z; }
    else { u = nz > 0 ? x : -x; v = y; }
    uva.setXY(i, u / uv, v / uv);
  }
  return g;
}

/** World-space UV box for level brushes: UVs follow world coordinates so seams line up. */
export function brushGeo(w, h, d, cx, cy, cz, uv) {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.attributes.position, nor = g.attributes.normal, uva = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, y = pos.getY(i) + cy, z = pos.getZ(i) + cz;
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let u, v;
    // u runs left-to-right as seen from outside each face, so painted labels read correctly
    if (Math.abs(nx) > 0.5) { u = nx > 0 ? -z : z; v = y; }
    else if (Math.abs(ny) > 0.5) { u = x; v = ny > 0 ? -z : z; }
    else { u = nz > 0 ? x : -x; v = y; }
    uva.setXY(i, u / uv, v / uv);
  }
  return g;
}

export function roundBox(w, h, d, r = 0.02, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
}

export function cyl(r, h, seg = 24, rTop = r) { return new THREE.CylinderGeometry(rTop, r, h, seg); }
export function sphere(r, w = 24, h = 16) { return new THREE.SphereGeometry(r, w, h); }

export function wedgeGeo(w, h, d) {
  // Right-triangle prism: slope rises along -Z to +Z.
  const s = new THREE.Shape();
  s.moveTo(-d / 2, -h / 2); s.lineTo(d / 2, -h / 2); s.lineTo(d / 2, h / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export { mergeGeometries };
