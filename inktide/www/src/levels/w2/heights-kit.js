// Coral Heights building blocks shared by 2-1, 2-2 and 2-3: rooftops floating over a street canyon
// at dusk. A building is a scenery body (no ink, cheap) plus a paintable roof slab and, where a
// taller neighbour rises above a walkable roof, a paintable facade band you can climb.
import { block, box, cyl, ent } from '../kit.js';

export const PI = Math.PI;
export const D = (kind, x, y, z, o = {}) => ent('decor', x, y, z, { kind, ...o });
export const SCENERY = (o = {}) => ({ collide: false, paint: false, castShadow: false, ...o });
export const STREET_Y = -30;
export const FACADES = ['#f3c9e4', '#c9b8f0', '#9ec5f0', '#f7d08a', '#a8d8b9', '#f4a6a6', '#b8e0e8', '#e8c7ff'];

/**
 * Building with its roof top at `roof`. o.band = height of the paintable facade band under the
 * roof (default 0.8 = just the roof slab edge), o.roofMat/roofColor, o.color (facade),
 * o.windows: 'x' | 'z' | 'all' | false (glass window bands on the facades).
 */
export function building(x0, z0, x1, z1, roof, o = {}) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  const band = o.band ?? 0.8;
  const facade = o.color || '#f3c9e4';
  const out = [
    box(minX, STREET_Y, minZ, maxX, roof - band, maxZ, { mat: o.mat || 'plaster', color: facade, paint: false, castShadow: false }),
    box(minX, roof - 0.8, minZ, maxX, roof, maxZ, { mat: o.roofMat || 'concrete', color: o.roofColor || '#d8cfe0' }),
  ];
  if (band > 0.8) out.push(box(minX, roof - band, minZ, maxX, roof - 0.8, maxZ, { mat: o.bandMat || o.mat || 'plaster', color: o.bandColor || facade }));
  // cornice
  out.push(box(minX - 0.25, roof - band - 0.35, minZ - 0.25, maxX + 0.25, roof - band, maxZ + 0.25, SCENERY({ mat: 'concrete', color: o.trim || '#e8dff0' })));
  const win = o.windows ?? 'all';
  if (win) {
    const glass = SCENERY({ mat: 'glass', color: o.glass || '#ffd9a8' });
    const top = roof - band - 1.6;
    for (let y = top, k = 0; y > STREET_Y + 2 && k < (o.floors ?? 7); y -= 3.4, k++) {
      if (win === 'all' || win === 'z') {
        out.push(box(minX + 0.8, y - 1.3, maxZ - 0.02, maxX - 0.8, y, maxZ + 0.06, glass));
        out.push(box(minX + 0.8, y - 1.3, minZ - 0.06, maxX - 0.8, y, minZ + 0.02, glass));
      }
      if (win === 'all' || win === 'x') {
        out.push(box(maxX - 0.02, y - 1.3, minZ + 0.8, maxX + 0.06, y, maxZ - 0.8, glass));
        out.push(box(minX - 0.06, y - 1.3, minZ + 0.8, minX + 0.02, y, maxZ - 0.8, glass));
      }
    }
  }
  return out;
}

/** Low parapet walls along the named roof edges ('-x','+x','-z','+z'), with optional gaps [[a,b],…] per side. */
export function parapet(x0, z0, x1, z1, roof, sides, o = {}) {
  const h = o.h ?? 0.7, t = o.t ?? 0.35;
  const mat = { mat: o.mat || 'plaster', color: o.color || '#efe4f4', ...(o.brush || {}) };
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  const out = [];
  const seg = (a, b, gaps, mk) => {
    let cur = a;
    for (const [g0, g1] of (gaps || []).slice().sort((p, q) => p[0] - q[0])) { if (g0 > cur) out.push(mk(cur, g0)); cur = Math.max(cur, g1); }
    if (cur < b) out.push(mk(cur, b));
  };
  const G = o.gaps || {};
  if (sides.includes('-z')) seg(minX, maxX, G['-z'], (a, b) => box(a, roof, minZ, b, roof + h, minZ + t, mat));
  if (sides.includes('+z')) seg(minX, maxX, G['+z'], (a, b) => box(a, roof, maxZ - t, b, roof + h, maxZ, mat));
  if (sides.includes('-x')) seg(minZ, maxZ, G['-x'], (a, b) => box(minX, roof, a, minX + t, roof + h, b, mat));
  if (sides.includes('+x')) seg(minZ, maxZ, G['+x'], (a, b) => box(maxX - t, roof, a, maxX, roof + h, b, mat));
  return out;
}

/** Rooftop AC unit (paintable metal box with a fan disc). */
export function acUnit(x, z, y, rot = 0) {
  const w = rot ? 1.8 : 2.6, d = rot ? 2.6 : 1.8;
  return [
    block(x, z, w, d, y, 1.4, { mat: 'metal', color: '#d6d9e2' }),
    cyl(x, y + 1.4, z, 0.6, 0.08, { mat: 'metal', color: '#6d7384', sides: 16, collide: false }),
  ];
}

/** Water tower on stilts (walk under it, climb the tank). */
export function waterTower(x, z, y, o = {}) {
  const r = o.r ?? 1.6, legs = o.legs ?? 2.2, c = o.color || '#b98a5e';
  const out = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) out.push(block(x + dx * r * 0.62, z + dz * r * 0.62, 0.22, 0.22, y, legs, { mat: 'metal', color: '#3b4052', paint: false }));
  out.push(cyl(x, y + legs, z, r * 1.05, 0.2, { mat: 'metal', color: '#3b4052', sides: 16 }));
  out.push(cyl(x, y + legs + 0.2, z, r, 2.6, { mat: 'wood', color: c, sides: 18 }));
  out.push(cyl(x, y + legs + 2.8, z, r * 1.1, 1.0, { mat: 'metal', color: o.cap || '#6d7384', sides: 18, rTop: 0.15 }));
  return out;
}

/** Street far below (scenery): asphalt, sidewalks, lane stripes and parked cars. */
export function street(x0, z0, x1, z1, o = {}) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minZ = Math.min(z0, z1), maxZ = Math.max(z0, z1);
  const out = [box(minX, STREET_Y - 1, minZ, maxX, STREET_Y, maxZ, SCENERY({ mat: 'asphalt', color: '#4a4458' }))];
  const along = o.along || 'z';
  const cars = ['#ff5fa8', '#2fd6ff', '#ffd23f', '#8a5bff', '#f4f1ea'];
  if (along === 'z') {
    const cx = o.center ?? (minX + maxX) / 2;
    for (let z = minZ + 2; z < maxZ - 2; z += 6) out.push(box(cx - 0.12, STREET_Y, z, cx + 0.12, STREET_Y + 0.02, z + 3, SCENERY({ mat: 'concrete', color: '#ffd23f' })));
    let k = 0;
    for (let z = minZ + 8; z < maxZ - 8; z += 17) {
      const x = cx + (k % 2 ? 3 : -3);
      out.push(box(x - 1, STREET_Y, z - 2.1, x + 1, STREET_Y + 1.0, z + 2.1, SCENERY({ mat: 'metal', color: cars[k % cars.length] })));
      out.push(box(x - 0.9, STREET_Y + 1.0, z - 1.1, x + 0.9, STREET_Y + 1.6, z + 1.0, SCENERY({ mat: 'glass', color: '#9fdcff' })));
      k++;
    }
  } else {
    const cz = o.center ?? (minZ + maxZ) / 2;
    for (let x = minX + 2; x < maxX - 2; x += 6) out.push(box(x, STREET_Y, cz - 0.12, x + 3, STREET_Y + 0.02, cz + 0.12, SCENERY({ mat: 'concrete', color: '#ffd23f' })));
    let k = 0;
    for (let x = minX + 8; x < maxX - 8; x += 17) {
      const z = cz + (k % 2 ? 3 : -3);
      out.push(box(x - 2.1, STREET_Y, z - 1, x + 2.1, STREET_Y + 1.0, z + 1, SCENERY({ mat: 'metal', color: cars[k % cars.length] })));
      out.push(box(x - 1.1, STREET_Y + 1.0, z - 0.9, x + 1.0, STREET_Y + 1.6, z + 0.9, SCENERY({ mat: 'glass', color: '#9fdcff' })));
      k++;
    }
  }
  return out;
}

/** Planter box with grass top (paintable; low: hop over it). */
export function planter(cx, cz, w, d, y, h = 0.6, color = '#c07a42') {
  return [
    block(cx, cz, w, d, y, h, { mat: 'wood', color }),
    block(cx, cz, w - 0.3, d - 0.3, y + h, 0.04, { mat: 'grass', color: '#7ccf6a', collide: false }),
  ];
}

/** Background towers ring (scenery) — silhouettes with lit window bands, around the play area. */
export function skyline(list) {
  const out = [];
  list.forEach(([x, z, w, d, h], i) => {
    out.push(block(x, z, w, d, STREET_Y, h - STREET_Y, SCENERY({ mat: i % 3 ? 'plaster' : 'brick', color: FACADES[i % FACADES.length] })));
    for (let y = h - 2; y > STREET_Y + 4 && y > h - 26; y -= 3.6) out.push(block(x, z, w + 0.1, d + 0.1, y - 1.2, 1.2, SCENERY({ mat: 'glass', color: i % 2 ? '#ffd9a8' : '#ffb0f0' })));
  });
  return out;
}
