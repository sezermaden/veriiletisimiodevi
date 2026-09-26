// Turf Clash arena authoring helpers. Arenas are point-symmetric: author the Alpha half (x < 0)
// plus pieces that are already symmetric around the origin ("center"), and turfArena() mirrors the
// half with rotate180 (x,z → -x,-z) so both teams get exactly the same map.
//
//   export default turfArena({
//     id: 'turf-pier', name: 'Pier Nine', theme: 'docks',
//     base: { x: -31.5, z: 0, y0: 0, h: 1, w: 7, d: 12, rampLen: 4, rampW: 6, mat: 'rubber' },
//     center: [...brushes], half: [...brushes],
//     decorCenter: [...entities], decor: [...entities for the Alpha half],
//     judge: { pos: [x, y, z], yaw },           // otter judges' booth (outside the play area)
//   });
//
// Output extras used by TurfMode: bases {alpha, bravo} (spawn centre on the pad), baseZones,
// spawnSlots {alpha:[[x,y,z]…4], bravo}, judge, mode: 'turf'. Base floors are tagged 'turf-base'
// (not counted as turf) and pre-inked in each team's colour.
import { block, ramp, rotate180, heroInk, murk } from '../levels/kit.js';

const PI = Math.PI;

export const rotPoint = (p) => [-p[0], p[1], -p[2]];

/** Rotate entity defs 180° around the origin (positions, yaw, point lists). */
export function rotEntities(list) {
  return list.map((e) => {
    const c = structuredClone(e);
    c.pos = rotPoint(e.pos);
    c.yaw = (e.yaw || 0) + PI;
    if (Array.isArray(e.to)) c.to = rotPoint(e.to);
    if (Array.isArray(e.points)) c.points = e.points.map(rotPoint);
    if (Array.isArray(e.path)) c.path = e.path.map(rotPoint);
    return c;
  });
}

/** Base pad + front ramp for the Alpha side (x < 0, ramp toward +x). */
export function basePad(b) {
  const { x, z = 0, y0 = 0, h = 1, w = 7, d = 12, rampLen = 4, rampW = 6, mat = 'rubber', color = '#d8d4e4', floorY = y0 - 1.6 } = b;
  const top = y0 + h;
  const o = { mat, color, tag: 'turf-base' };
  return [
    // the pad reaches down to the water/floor so no hidden floor sits underneath it
    block(x, z, w, d, floorY, top - floorY, o),
    ramp(x + w / 2, y0, z - rampW / 2, x + w / 2 + rampLen, top, z + rampW / 2, '-x', o),
  ];
}

export function turfArena(o) {
  const B = { z: 0, y0: 0, h: 1, w: 7, d: 12, rampLen: 4, rampW: 6, ...o.base };
  const top = B.y0 + B.h;
  const halfBrushes = [...basePad(B), ...(o.half || [])];
  const brushes = [...(o.center || []), ...halfBrushes, ...rotate180(halfBrushes)];
  const decor = o.decor || [];
  const entities = [...(o.decorCenter || []), ...decor, ...rotEntities(decor), ...(o.entities || [])];

  const alpha = [B.x - 0.4, top, B.z];
  const bravo = rotPoint(alpha);
  // four spawn slots across the pad, facing the arena
  const slots = [-3.6, -1.2, 1.2, 3.6].map((dz) => [alpha[0], top, B.z + dz * (B.d / 12)]);
  const zoneA = { min: [B.x - B.w / 2 - 0.5, top - 2.5, B.z - B.d / 2 - 0.3], max: [B.x + B.w / 2 + B.rampLen + 0.2, top + 5, B.z + B.d / 2 + 0.3] };
  const zoneB = { min: [-zoneA.max[0], zoneA.min[1], -zoneA.max[2]], max: [-zoneA.min[0], zoneA.max[1], -zoneA.min[2]] };

  // base floors pre-inked (the pad top and the ramp)
  const preInk = [];
  for (const dz of [-3.5, 0, 3.5]) {
    preInk.push(heroInk(B.x - 1.2, top, B.z + dz * (B.d / 12), 2.6), murk(-(B.x - 1.2), top, -(B.z + dz * (B.d / 12)), 2.6));
    preInk.push(heroInk(B.x + 1.8, top, B.z + dz * (B.d / 12), 2.4), murk(-(B.x + 1.8), top, -(B.z + dz * (B.d / 12)), 2.4));
  }
  preInk.push(heroInk(B.x + B.w / 2 + B.rampLen * 0.5, B.y0 + B.h * 0.5, B.z, 2.6), murk(-(B.x + B.w / 2 + B.rampLen * 0.5), B.y0 + B.h * 0.5, -B.z, 2.6));

  return {
    id: o.id,
    name: o.name,
    world: 0,
    theme: o.theme,
    themeOverride: o.themeOverride,
    music: 'turf',
    mode: 'turf',
    waterY: o.waterY ?? -1.4,
    killY: o.killY ?? -4,
    water: o.water,
    spawn: { pos: slots[1], yaw: PI / 2 },
    bases: { alpha, bravo },
    baseZones: { alpha: zoneA, bravo: zoneB },
    baseInfo: { ...B, top },
    spawnSlots: { alpha: slots, bravo: slots.map(rotPoint) },
    judge: o.judge,
    brushes,
    preInk,
    entities,
    navLinks: [...(o.navLinks || []), ...(o.navLinks || []).map((l) => ({ ...l, from: rotPoint(l.from), to: rotPoint(l.to) }))],
    blurb: o.blurb,
  };
}

/** Decor shorthand. */
export const D = (kind, x, y, z, o = {}) => ({ type: 'decor', kind, pos: [x, y, z], ...o });
