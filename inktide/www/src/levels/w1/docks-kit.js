// Brinewater Docks building blocks shared by 1-1, 1-2 and 1-3: piers on pilings, container
// stacks, warehouses, moored boats and a big cargo ship set piece. Everything returns plain brush /
// entity definitions (see ../kit.js), so stage files stay declarative.
import { block, box, cyl, prism, ent, container } from '../kit.js';

export const PI = Math.PI;
export const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });
/** Scenery that is never touched: no collision, no ink atlas space, no shadow cost. */
export const SCENERY = (o = {}) => ({ collide: false, paint: false, castShadow: false, ...o });
export const CONTAINER_COLORS = ['#d9482b', '#2f7fd8', '#35b56a', '#e0a02b', '#8a4bd8', '#e0612b', '#2fb6c8', '#c83a5a', '#f2c230', '#4a6fd8'];

/**
 * Wooden pier deck (top at y) with a steel fascia and pilings every `step` metres along the
 * edges that face the water. `edges` picks which sides get pilings: 'x' (the ±x sides), 'z', 'all'.
 */
export function pier(x0, z0, x1, z1, y = 0, o = {}) {
  const t = o.thick ?? 0.45;
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  const out = [box(minX, y - t, minZ, maxX, y, maxZ, { mat: o.mat || 'wood', color: o.color || '#c8966a', ...(o.deck || {}) })];
  // under-deck beam (darker band just below the planks, reads as a thick pier edge)
  out.push(box(minX + 0.15, y - t - 0.55, minZ + 0.15, maxX - 0.15, y - t, maxZ - 0.15, SCENERY({ mat: 'wood', color: '#6b4a32' })));
  const step = o.step ?? 4;
  const edges = o.edges ?? 'all';
  const pile = (x, z) => out.push(cyl(x, -4, z, 0.28, y - t + 4 - 0.02, SCENERY({ mat: 'wood', color: '#7a5a3e', sides: 8 })));
  if (edges === 'all' || edges === 'x') {
    for (let z = minZ + 0.6; z <= maxZ - 0.4; z += step) { pile(minX + 0.35, z); pile(maxX - 0.35, z); }
  }
  if (edges === 'all' || edges === 'z') {
    for (let x = minX + 0.6 + step; x <= maxX - 0.6 - step * 0.5; x += step) { pile(x, minZ + 0.35); pile(x, maxZ - 0.35); }
  }
  return out;
}

/** Concrete quay block (a solid slab down into the water) with a yellow safety edge strip. */
export function quay(x0, z0, x1, z1, y = 0, o = {}) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  // paintable top slab + an untextured-for-ink body down into the water (saves ink-atlas space)
  const out = [
    box(minX, y - 0.8, minZ, maxX, y, maxZ, { mat: o.mat || 'concrete', color: o.color || '#d8d2c8', ...(o.deck || {}) }),
    box(minX, -3.5, minZ, maxX, y - 0.8, maxZ, { mat: 'concrete', color: o.baseColor || '#a9a39a', paint: false }),
  ];
  if (o.stripe !== false) {
    const s = o.stripeColor || '#f2c230', w = 0.28;
    const sides = o.stripeSides || 'all';
    if (sides === 'all' || sides.includes('-x')) out.push(box(minX, y, minZ, minX + w, y + 0.03, maxZ, { mat: 'concrete', color: s, collide: false }));
    if (sides === 'all' || sides.includes('+x')) out.push(box(maxX - w, y, minZ, maxX, y + 0.03, maxZ, { mat: 'concrete', color: s, collide: false }));
    if (sides === 'all' || sides.includes('-z')) out.push(box(minX, y, minZ, maxX, y + 0.03, minZ + w, { mat: 'concrete', color: s, collide: false }));
    if (sides === 'all' || sides.includes('+z')) out.push(box(minX, y, maxZ - w, maxX, y + 0.03, maxZ, { mat: 'concrete', color: s, collide: false }));
  }
  return out;
}

/** Row of short steel bollards (low, paintable cover-free dressing) along a line. */
export function bollards(x0, z0, x1, z1, n, y = 0, color = '#2b3144') {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    out.push(cyl(x, y, z, 0.2, 0.55, { mat: 'metal', color, sides: 10 }));
    out.push(cyl(x, y + 0.55, z, 0.26, 0.12, { mat: 'metal', color: '#f2c230', sides: 10, collide: false }));
  }
  return out;
}

/** Stack of containers (count high) with a small alternating offset. rotY 1 = long axis along Z. */
export function containerStack(cx, cz, count, colorIdx = 0, rotY = 0, y0 = 0, o = {}) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const off = (i % 2 ? 0.25 : -0.15) * (o.jitter ?? 1);
    const x = rotY ? cx : cx + off, z = rotY ? cz + off : cz;
    out.push(container(x, y0 + i * 2.6, z, CONTAINER_COLORS[(colorIdx + i * 3) % CONTAINER_COLORS.length], rotY, o.brush || {}));
  }
  return out;
}

/**
 * Warehouse: a solid block with a membrane roof slab, a darker plinth and roll-up door panels
 * painted on the front (front = +z face unless face: '-z'|'+x'|'-x').
 */
export function warehouse(cx, cz, w, d, h, o = {}) {
  const wall = { mat: o.mat || 'brick', color: o.color || '#c65a3e', ...(o.wall || {}) };
  const out = [block(cx, cz, w, d, 0, h, wall)];
  out.push(block(cx, cz, w, d, h, 0.12, { mat: o.roofMat || 'concrete', color: o.roofColor || '#b8b0a6' }));
  // parapet lip only on the sides named in o.lip (keeps climb edges clean)
  return out;
}

/** Moored fishing boat (scenery). Bow points toward +z unless yaw = PI (bow -z). */
export function fishingBoat(cx, cz, o = {}) {
  const L = o.length ?? 11, W = o.width ?? 3.6, flip = o.flip ? -1 : 1;
  const hull = o.hull || '#e8e2d6', stripe = o.stripe || '#d9482b', cabin = o.cabin || '#f4f1ea';
  const zb = cz + flip * L / 2, zs = cz - flip * L / 2;
  const pts = [[cx - W / 2, zs], [cx + W / 2, zs], [cx + W / 2, cz + flip * L * 0.2], [cx, zb], [cx - W / 2, cz + flip * L * 0.2]];
  const out = [
    prism(pts, -2.2, 0.2, SCENERY({ mat: 'metal', color: hull })),
    prism(pts, -1.3, -0.9, SCENERY({ mat: 'metal', color: stripe })),
    block(cx, cz - flip * L * 0.12, W * 0.62, L * 0.28, 0.2, 1.9, SCENERY({ mat: 'plaster', color: cabin })),
    block(cx, cz - flip * L * 0.12, W * 0.7, L * 0.32, 2.1, 0.18, SCENERY({ mat: 'metal', color: stripe })),
    block(cx, cz - flip * L * 0.12 + flip * L * 0.141, W * 0.5, 0.05, 1.0, 0.7, SCENERY({ mat: 'glass', color: '#9fdcff' })),
    cyl(cx, 2.28, cz - flip * L * 0.18, 0.08, 3.2, SCENERY({ mat: 'metal', color: '#3b4052', sides: 6 })),
  ];
  return out;
}

/**
 * Cargo ship set piece (scenery): hull, deck, bridge tower with windows and a funnel, and a load
 * of stacked containers. Long axis along Z, bow toward -z.
 */
export function cargoShip(cx, cz, o = {}) {
  const L = o.length ?? 70, W = o.width ?? 16, H = o.height ?? 7;
  const hull = o.hull || '#2f4f8a', trim = o.trim || '#d9482b';
  const zb = cz - L / 2, zs = cz + L / 2;
  const pts = [[cx - W / 2, zs], [cx - W / 2, zb + L * 0.16], [cx - W * 0.22, zb + 1], [cx, zb], [cx + W * 0.22, zb + 1], [cx + W / 2, zb + L * 0.16], [cx + W / 2, zs]];
  const out = [
    prism(pts, -4, H, SCENERY({ mat: 'metal', color: hull })),
    prism(pts, -4, -0.6, SCENERY({ mat: 'metal', color: trim })),
    prism(pts.map(([x, z]) => [cx + (x - cx) * 0.97, z]), H, H + 0.3, SCENERY({ mat: 'metal', color: '#b9bcc8' })),
  ];
  // bridge tower at the stern
  const tz = zs - 6;
  out.push(block(cx, tz, W * 0.8, 8, H + 0.3, 9, SCENERY({ mat: 'plaster', color: '#f4f1ea' })));
  out.push(block(cx, tz, W * 0.9, 8.6, H + 9.3, 0.4, SCENERY({ mat: 'metal', color: trim })));
  out.push(block(cx, tz - 4.02, W * 0.7, 0.05, H + 6.6, 1.4, SCENERY({ mat: 'glass', color: '#8fd3ff' })));
  out.push(block(cx, tz - 4.02, W * 0.7, 0.05, H + 3.6, 1.2, SCENERY({ mat: 'glass', color: '#8fd3ff' })));
  out.push(cyl(cx, H + 9.7, tz + 1.5, 1.4, 5, SCENERY({ mat: 'metal', color: trim, sides: 12 })));
  out.push(cyl(cx, H + 14.7, tz + 1.5, 1.45, 0.8, SCENERY({ mat: 'metal', color: '#1b1f2e', sides: 12 })));
  // containers on deck: rows across, stacks of 2-3 (deterministic pattern)
  let k = o.seed ?? 0;
  for (let z = zb + L * 0.2; z < tz - 8; z += 8.4) {
    for (let x = cx - W / 2 + 1.6; x <= cx + W / 2 - 1.6; x += 2.6) {
      const n = 1 + ((k * 7 + 3) % 3);
      for (let i = 0; i < n; i++) out.push(container(x, H + 0.3 + i * 2.6, z, CONTAINER_COLORS[(k + i * 4) % CONTAINER_COLORS.length], 1, SCENERY()));
      k++;
    }
  }
  return out;
}

/** Background harbour building row (scenery) — warehouses on the far quay. */
export function farWarehouses(x0, z, count, o = {}) {
  const out = [];
  const cols = o.colors || ['#c65a3e', '#8fb8d8', '#e8c07a', '#9ac48a', '#d88a6a'];
  let x = x0;
  for (let i = 0; i < count; i++) {
    const w = 12 + ((i * 5) % 7), h = 7 + ((i * 3) % 5), d = 14;
    out.push(block(x, z, w, d, -3, h + 3, SCENERY({ mat: i % 2 ? 'brick' : 'plaster', color: cols[i % cols.length] })));
    out.push(block(x, z, w + 0.4, d + 0.4, h, 0.5, SCENERY({ mat: 'metal', color: '#6d7384' })));
    x += (o.dir ?? 1) * (w + 1.5);
  }
  return out;
}

/** Pearl ring helper: n pearls around a centre. */
export function pearlRing(cx, y, cz, r, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    out.push(ent('pearl', cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  return out;
}
