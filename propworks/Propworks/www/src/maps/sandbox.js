/* Sandbox maps: gm_foundry (a warehouse / pool / tower building ground) and gm_flatland
   (a vast grass plane with one concrete building). */
import * as THREE from 'three';
import { spawnPickup } from '../world/pickups.js';

const OUTDOOR = {
  sky: true, sunDir: [0.55, 0.75, 0.35], sunIntensity: 3.4, hemiIntensity: 0.9, exposure: 1.0,
  fog: { color: 0xb9cde0, density: 0.0035 }, turbidity: 3.2, rayleigh: 1.3, envIntensity: 0.9, music: 'build', reverb: 0.12,
};

export function foundry(L, game, opts) {
  // ground and outer boundary (the "skybox" walls)
  // grass with the pool cut out of it
  L.groundWithHoles(130, [[21, -19, 47, 5]], 'grass', 0);
  const B = 118;
  L.box([-B - 2, 0, -B - 2], [B + 2, 30, -B], 'concrete');
  L.box([-B - 2, 0, B], [B + 2, 30, B + 2], 'concrete');
  L.box([-B - 2, 0, -B], [-B, 30, B], 'concrete');
  L.box([B, 0, -B], [B + 2, 30, B], 'concrete');

  // ---------------------------------------------------------------- warehouse
  const x0 = -34, x1 = 6, z0 = -22, z1 = 22, H = 13;
  L.room([x0, 0, z0], [x1, H, z1], {
    floor: 'devOrange', wall: 'devGrey', ceiling: 'ceiling', t: 0.6,
    doors: [{ wall: 'e', at: 0, width: 10, height: 7 }, { wall: 'e', at: 15, width: 4, height: 3.2 }, { wall: 's', at: -26, width: 3, height: 3 }],
  });
  // inner floor overlay slightly raised so the dev grid reads crisply
  L.box([x0, 0, z0], [x1, 0.02, z1], 'devOrange', { collide: false });
  // mezzanine along the north wall with a ramp up
  L.box([x0, 5.5, 12], [x1 - 8, 6, z1], 'devLight');
  L.box([x0, 6, 11.9], [x1 - 8, 7.1, 12.1], 'metal');       // railing
  L.ramp(-4, 0, -2, 4, 5.5, 13, 'devBlue', { rotY: 0 });
  L.box([-6, 5.5, 11], [-2, 6, 12], 'devLight');
  // pillars
  for (const x of [-26, -14, -2]) for (const z of [-10, 10]) L.box([x - 0.4, 0, z - 0.4], [x + 0.4, H, z + 0.4], 'concrete');
  // loading dock steps outside the big door
  L.stairs(x1 + 0.6, 0, -5, 10, 0.02, 0.1, 1, 'x', 'concrete');
  // ceiling lights
  for (const x of [-28, -18, -8]) for (const z of [-12, 0, 12]) L.light(x, H - 0.4, z, { intensity: 18, distance: 22, shadow: x === -18 && z === 0 });
  L.sign(x0 + 0.62, 4, 0, Math.PI / 2, ['WORKSHOP BAY 01'], { w: 6, h: 1.2 });
  L.sign(x1 - 0.62, 9, 8, -Math.PI / 2, ['BUILD ANYTHING'], { w: 6, h: 1.2, border: '#ffb23e' });

  // dark room (south-west annex) with a light switch
  L.room([-46, 0.02, -22], [-34.6, 5, -10], { floor: 'concreteDark', wall: 'concreteDark', ceiling: 'concreteDark', t: 0.6, doors: [{ wall: 'e', at: -16, width: 3, height: 3 }] });
  const dark = L.light(-40, 4.3, -16, { intensity: 0, distance: 16, color: 0xffd9a0 });
  if (dark) {
    L.button(-35.2, 1.5, -12.5, -Math.PI / 2, () => { dark.intensity = dark.intensity ? 0 : 20; }, { label: 'Toggle lights', color: '#ffd21f' });
  }
  L.sign(-35.25, 3.4, -18, -Math.PI / 2, ['DARK ROOM'], { w: 2.4, h: 0.6, bg: '#111', fg: '#ffd21f', border: '#ffd21f' });

  // ---------------------------------------------------------------- pool
  const px0 = 22, px1 = 46, pz0 = -18, pz1 = 4, depth = 4;
  L.box([px0 - 1, -depth - 1, pz0 - 1], [px1 + 1, -depth, pz1 + 1], 'tiles');
  L.box([px0 - 1, -depth, pz0 - 1], [px0, 0.3, pz1 + 1], 'tiles');
  L.box([px1, -depth, pz0 - 1], [px1 + 1, 0.3, pz1 + 1], 'tiles');
  L.box([px0, -depth, pz0 - 1], [px1, 0.3, pz0], 'tiles');
  L.box([px0, -depth, pz1], [px1, 0.3, pz1 + 1], 'tiles');
  // cut the grass: pool deck around it
  L.box([px0 - 4, 0, pz0 - 4], [px1 + 4, 0.05, pz0 - 1], 'concreteWarm');
  L.box([px0 - 4, 0, pz1 + 1], [px1 + 4, 0.05, pz1 + 4], 'concreteWarm');
  L.box([px0 - 4, 0, pz0 - 1], [px0 - 1, 0.05, pz1 + 1], 'concreteWarm');
  L.box([px1 + 1, 0, pz0 - 1], [px1 + 4, 0.05, pz1 + 1], 'concreteWarm');
  L.water([px0, -depth, pz0], [px1, -0.35, pz1]);
  // diving board
  L.box([px1 - 0.5, 0.3, -8], [px1 + 3, 0.9, -6], 'concrete');
  L.box([px1 - 5, 1.2, -7.4], [px1 + 0.5, 1.3, -6.6], 'wood');
  L.box([px1 - 0.5, 0.9, -7.4], [px1 + 0.5, 1.2, -6.6], 'metal');
  // hide the grass inside the pool by a thin floor under water level is the pool bottom; the ground
  // plane is at y=0 so we carve it visually with the tiles' top rim.

  // ---------------------------------------------------------------- tower
  const tx = 46, tz = 34, tw = 12, th = 24;
  L.room([tx - tw / 2, 0.02, tz - tw / 2], [tx + tw / 2, th, tz + tw / 2], { floor: 'concrete', wall: 'concreteWarm', ceiling: 'concrete', t: 0.5, doors: [{ wall: 's', at: tx, width: 3, height: 3.2 }] });
  // switchback stairs inside
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? '-z' : 'z';
    const sx = i % 2 ? tx + 3.5 : tx - 3.5;
    const sz = i % 2 ? tz + 4.5 : tz - 4.5;
    L.stairs(sx, y, sz, 3.4, 4, 9, 12, dir, 'concrete');
    y += 4;
    L.box([tx - 5.8, y - 0.25, i % 2 ? tz - 5.8 : tz + 4.2], [tx + 5.8, y, i % 2 ? tz - 4.3 : tz + 5.8], 'concrete');
  }
  // roof hatch and roof deck
  L.box([tx - 7, th + 0.5, tz - 7], [tx + 7, th + 0.6, tz - 6.4], 'metal');
  L.light(tx, 10, tz, { intensity: 10, distance: 18, fixture: false });
  L.light(tx, 20, tz, { intensity: 10, distance: 18, fixture: false });

  // ---------------------------------------------------------------- outdoor features
  // big ramp jump
  L.ramp(-10, 0, 44, 8, 5, 16, 'devOrange', { rotY: Math.PI / 2 });
  L.box([-2, 0, 40], [2, 5, 48], 'devOrange');
  // tunnels / pipes
  L.box([60, 0, -40], [64, 4, -20], 'bricks');
  L.box([66, 0, -40], [70, 4, -20], 'bricks');
  L.box([60, 4, -40], [70, 4.6, -20], 'concreteDark');
  // helipad
  L.box([-60, 0, -60], [-44, 0.3, -44], 'concreteDark');
  L.cylinder(-52, 0.32, -52, 6, 0.04, 'hazard', { collide: false, seg: 48 });

  // ---------------------------------------------------------------- props
  const P = (k, x, yy, z, ry = 0) => game.entities.spawnProp(k, new THREE.Vector3(x, yy, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), { effect: false });
  P('crate', -24, 0.5, -16); P('crate', -24, 1.5, -16); P('crate_small', -22.8, 0.3, -16);
  P('barrel_red', -28, 0.5, 16); P('barrel_red', -29, 0.5, 16.8); P('barrel_blue', -27.4, 0.5, 17.2);
  P('pallet', -20, 0.1, 18); P('cone', 8, 0.4, -3); P('cone', 8, 0.4, 3);
  P('table', -10, 0.4, -16); P('chair', -10, 0.5, -17.3); P('chair', -10, 0.5, -14.7, Math.PI);
  P('bathtub', 28, 0.3, 10); P('melon', 30, 0.3, 10);
  P('container_red', 30, 1.3, 50, 0.3);
  P('dumpster', 12, 0.6, -18);
  P('beachball', 34, 1, -5);

  if (opts.mode !== 'menu') {
    spawnPickup(game, 'health', new THREE.Vector3(-32, 0.3, -20));
    spawnPickup(game, 'battery', new THREE.Vector3(-31, 0.3, -20));
  }

  L.spawn(-18, 0.05, 0, -Math.PI / 2);
  return { ...OUTDOOR, menuCam: { center: [-14, 2.2, 0], radius: 11, height: 3.2, sweep: 1.4 } };
}

export function flatland(L, game) {
  L.ground(420, 'grass', 0);
  const B = 200;
  for (const [a, b] of [[[-B - 2, 0, -B - 2], [B + 2, 40, -B]], [[-B - 2, 0, B], [B + 2, 40, B + 2]], [[-B - 2, 0, -B], [-B, 40, B]], [[B, 0, -B], [B + 2, 40, B]]]) L.box(a, b, 'concrete');
  // the building
  L.room([-8, 0.02, -8], [8, 12, 8], { floor: 'concrete', wall: 'concrete', ceiling: 'concrete', t: 0.6, doors: [{ wall: 's', at: 0, width: 3, height: 3.5 }] });
  L.stairs(-6.5, 0, -6, 2.4, 6, 10, 14, 'z', 'concrete');
  L.box([-8, 5.8, 4], [8, 6, 8], 'concrete');
  L.light(0, 11.5, 0, { intensity: 16, distance: 20 });
  L.light(0, 5.4, -3, { intensity: 10, distance: 14 });
  L.spawn(0, 0.05, -24, Math.PI);
  return { ...OUTDOOR, fog: { color: 0xc3d6e6, density: 0.0022 }, menuCam: { center: [0, 3, 0], radius: 30, height: 8, sweep: 0 } };
}
