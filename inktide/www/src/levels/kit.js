// Level authoring helpers. Coordinates are metres, +Y up. A stage file exports a definition:
//
// export default {
//   id: 'w1-1', name: 'First Splash', world: 1, theme: 'docks', music: 'docks',
//   waterY: -2, killY: -6,
//   spawn: { pos: [0, 0, 0], yaw: 0 },            // yaw 0 faces -Z... see note below
//   brushes: [ block(...), ramp(...), ... ],
//   preInk: [ { at: [x, y, z], r: 2, team: 'murk' } ],
//   entities: [ { type: 'glooper', pos: [x, y, z] }, ... ],
//   objective: 'Reach the Prism Core',
// }
//
// Player yaw: the model faces +Z at yaw 0 and the camera starts BEHIND the player, so yaw 0 means
// "the player looks toward +Z". yaw = Math.PI looks toward -Z.
//
// Surface materials (mat): concrete, tiles, asphalt, wood, metal, container, brick, plaster,
// grate (unpaintable), rubber, sand, grass, murk, glass (unpaintable), sponge. `color` tints.

/** Axis-aligned box from two corners. */
export function box(x0, y0, z0, x1, y1, z1, o = {}) {
  return { t: 'box', min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], ...o };
}

/** Box by centre (x, z), size (w, d), bottom y0 and height h. */
export function block(cx, cz, w, d, y0, h, o = {}) {
  return box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, o);
}

/** Ramp (wedge) inside a box, rising toward dir: '+x' | '-x' | '+z' | '-z'. */
export function ramp(x0, y0, z0, x1, y1, z1, dir, o = {}) {
  return { t: 'ramp', min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], dir, ...o };
}

/** Ramp by centre/size. */
export function rampC(cx, cz, w, d, y0, h, dir, o = {}) {
  return ramp(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, dir, o);
}

/** Cylinder / pillar (sides = polygon sides). rTop for cones. */
export function cyl(cx, y0, cz, r, h, o = {}) {
  return { t: 'cyl', at: [cx, y0, cz], r, h, sides: o.sides || 14, ...o };
}

/** Stairs rising toward dir. */
export function stairs(x0, y0, z0, x1, y1, z1, dir, o = {}) {
  return { t: 'stairs', min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], dir, ...o };
}

/** Extruded polygon footprint [[x,z],...] from y0 to y1. */
export function prism(points, y0, y1, o = {}) {
  return { t: 'prism', points, y0, y1, ...o };
}

/** A shipping container (8 × 2.6 × 2.5) — yaw 0 = long axis along X. */
export function container(cx, y0, cz, color = '#d9482b', rotY = 0, o = {}) {
  const w = rotY ? 2.5 : 8, d = rotY ? 8 : 2.5;
  return block(cx, cz, w, d, y0, 2.6, { mat: 'container', color, ...o });
}

/** Walkway + railing-free platform helper: slab of thickness t at top height y. */
export function slab(cx, cz, w, d, y, t = 0.5, o = {}) {
  return block(cx, cz, w, d, y - t, t, o);
}

/** Pre-placed enemy ink blot. */
export function murk(x, y, z, r = 2) { return { at: [x, y, z], r, team: 'murk' }; }
export function heroInk(x, y, z, r = 2) { return { at: [x, y, z], r, team: 'hero' }; }

/** Entity shorthand. */
export function ent(type, x, y, z, o = {}) { return { type, pos: [x, y, z], ...o }; }

/** Mirror a list of brushes across the X=0 plane (useful for symmetric arenas). */
export function mirrorX(brushes) {
  return brushes.map((b) => {
    const c = structuredClone(b);
    if (c.min) { const [x0] = c.min, [x1] = c.max; c.min[0] = -x1; c.max[0] = -x0; }
    if (c.at) c.at[0] = -c.at[0];
    if (c.points) c.points = c.points.map(([x, z]) => [-x, z]);
    if (c.dir === '+x') c.dir = '-x'; else if (c.dir === '-x') c.dir = '+x';
    return c;
  });
}

/** Rotate brushes 180° around the origin (x,z → -x,-z): point-symmetric arenas. */
export function rotate180(brushes) {
  return brushes.map((b) => {
    const c = structuredClone(b);
    if (c.min) { const [x0, , z0] = c.min, [x1, , z1] = c.max; c.min[0] = -x1; c.max[0] = -x0; c.min[2] = -z1; c.max[2] = -z0; }
    if (c.at) { c.at[0] = -c.at[0]; c.at[2] = -c.at[2]; }
    if (c.points) c.points = c.points.map(([x, z]) => [-x, -z]);
    const flip = { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z' };
    if (c.dir) c.dir = flip[c.dir];
    return c;
  });
}
