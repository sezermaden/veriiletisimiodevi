/* Story maps. Each builder lays out geometry, lights, props and returns an environment
   plus `handles` (doors, lifts, points) that the chapter script drives. */
import * as THREE from 'three';
import { material } from '../render/materials.js';
import { boxGeo, cyl } from '../world/geometry.js';
import { Vehicle } from '../world/vehicle.js';
import { spawnPickup } from '../world/pickups.js';

const INDOOR = { sky: false, background: 0x0a0c10, hemiSky: 0xcad6e6, hemiGround: 0x3a342c, hemiIntensity: 0.35, sunIntensity: 0, envIntensity: 0.45, exposure: 1.05, fog: { color: 0x0a0c10, density: 0.012 }, reverb: 0.45, bloom: 0.5 };

/** Decorative pedestal with a light, for weapon pickups. */
function pedestal(L, x, z, y = 0) {
  L.cylinder(x, y + 0.5, z, 0.6, 1, 'metalDark');
  L.cylinder(x, y + 1.02, z, 0.65, 0.05, 'metal', { collide: false });
  L.light(x, y + 4, z, { intensity: 14, distance: 8, color: 0xbfe0ff, fixture: false, spot: { angle: 0.4, dir: [0, -1, 0] } });
}

/** Pod decor: a closed glass capsule shell (static). */
function podShell(L, x, z) {
  L.box([x - 0.9, 0, z - 0.9], [x + 0.9, 0.2, z + 0.9], 'metalDark');
  L.box([x - 0.9, 2.6, z - 0.9], [x + 0.9, 2.9, z + 0.9], 'metalDark');
  for (const [a, b] of [[[x - 0.95, 0.2, z - 0.95], [x - 0.85, 2.6, z + 0.95]], [[x + 0.85, 0.2, z - 0.95], [x + 0.95, 2.6, z + 0.95]], [[x - 0.95, 0.2, z - 0.95], [x + 0.95, 2.6, z - 0.85]], [[x - 0.95, 0.2, z + 0.85], [x + 0.95, 2.6, z + 0.95]]]) L.box(a, b, 'glass');
}

/** Status lamp: red until set green. Emissive mesh, so it costs no light slot. */
function indicator(L, x, y, z) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ff3030', emissive: '#ff3030', emissiveIntensity: 3 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), mat);
  m.position.set(x, y, z);
  L.group.add(m);
  return { set(ok) { mat.color.set(ok ? '#4cd964' : '#ff3030'); mat.emissive.set(ok ? '#4cd964' : '#ff3030'); } };
}

function corruption(L, x, y, z, w, h, d) {
  const m = new THREE.Mesh(boxGeo(w, h, d, 0.5), material('checker'));
  m.position.set(x, y, z);
  L.group.add(m);
  L.animated.push((dt, t) => { m.visible = Math.sin(t * 7 + x) > -0.85 || Math.random() < 0.5; });
  return m;
}

/* =================================================================== CH1 intake */
export function intake(L, game, opts) {
  const H = {};
  // R0 pod room
  L.room([-7, 0, -10], [7, 5, 8], { floor: 'floorTiles', wall: 'devLight', ceiling: 'ceiling', doors: [{ wall: 'n', at: 0, width: 3, height: 3 }] });
  for (const x of [-4.5, 4.5]) for (const z of [-6, -1.5, 3]) podShell(L, x, z);
  // the player's pod: a glass shell that lifts
  L.box([-0.9, 0, -7.9], [0.9, 0.2, -6.1], 'metalDark');
  H.pod = L.mover([[0, 1.3, -0.9, 1.8, 2.4, 0.08, 'glass'], [0, 1.3, 0.9, 1.8, 2.4, 0.08, 'glass'], [-0.9, 1.3, 0, 0.08, 2.4, 1.8, 'glass'], [0.9, 1.3, 0, 0.08, 2.4, 1.8, 'glass'], [0, 2.6, 0, 1.9, 0.2, 1.9, 'metalDark']], { closed: [0, 0.2, -7], open: [0, 3.0, -7], speed: 1.2, sound: 'door_open' });
  L.light(0, 4.7, -7, { intensity: 10, distance: 8, color: 0xcfe6ff });
  L.light(-4, 4.7, 0, { intensity: 8, distance: 10 }); L.light(4, 4.7, 0, { intensity: 8, distance: 10 });
  L.sign(0, 3.6, -9.74, 0, ['INTAKE — SUBJECT PODS'], { w: 4, h: 0.7 });
  H.door1 = L.door(0, 0, 8.25, 3, 3, 0.4);
  // C1 corridor with a hurdle and a crawl duct
  L.room([-2, 0, 8.5], [2, 4, 26], { floor: 'concrete', wall: 'devGrey', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 3, height: 3 }] });
  L.box([-2, 0, 12.5], [2, 0.65, 13], 'hazard');
  L.box([-2, 1.3, 18], [2, 4, 21], 'metal');
  L.sign(0, 3.4, 17.9, Math.PI, ['DUCT — CROUCH'], { w: 2.4, h: 0.5, bg: '#2a2000', fg: '#ffd21f', border: '#ffd21f' });
  L.light(0, 3.8, 11, { intensity: 6, distance: 8 }); L.light(0, 3.8, 23, { intensity: 6, distance: 8 });
  // R1 armory
  L.room([-9, 0, 26.5], [9, 6, 44], { floor: 'floorTiles', wall: 'devGrey', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 3, height: 3 }] });
  pedestal(L, 0, 32);
  H.gunPos = new THREE.Vector3(0, 1.05, 32);
  L.light(-5, 5.7, 38, { intensity: 10, distance: 12 }); L.light(5, 5.7, 38, { intensity: 10, distance: 12 });
  L.terminal(-8.2, 0, 30, Math.PI / 2, 'ch1_welcome', 'Welcome to the Workshop',
    'KESSLER APPLIED PHYSICS — WORKSHOP SIMULATION\n\nThe Workshop is a closed training simulation for Builders.\nEvery object here obeys one rule: it can be moved, joined or changed.\n\nYour Research Engine (WREN) will guide you.\n\nPlease do not attempt to leave the simulation.\nThere is nothing outside the simulation.');
  L.sign(8.74, 3.2, 35, -Math.PI / 2, ['HOLD  ·  PUSH  ·  ROTATE  ·  FREEZE'], { w: 5, h: 0.8 });
  H.door2 = L.door(0, 0, 44.25, 3, 3, 0.4);
  // R2 ledge room
  L.room([-10, 0, 44.5], [10, 11, 64], { floor: 'devOrange', wall: 'devGrey', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 3, height: 6.4, bottom: 3.4 }] });
  L.box([-10, 0, 56], [10, 3.4, 64], 'devBlue');
  L.box([-10, 3.4, 55.9], [10, 3.5, 56.1], 'hazard', { collide: false });
  L.sign(0, 7.5, 63.74, Math.PI, ['EXIT ▲'], { w: 2, h: 0.6 });
  for (const x of [-6, 6]) L.light(x, 10.6, 50, { intensity: 16, distance: 16 });
  L.light(0, 10.6, 60, { intensity: 12, distance: 14 });
  // R3 chasm (floor at 3.4)
  L.box([-6, 2.9, 64], [6, 3.4, 74], 'concrete');
  L.box([-6, 2.9, 84], [6, 3.4, 100], 'concrete');
  L.box([-6.5, -22, 64], [-6, 12, 100], 'devGrey'); L.box([6, -22, 64], [6.5, 12, 100], 'devGrey');
  L.box([-6, 12, 64], [6, 12.5, 100], 'ceiling');
  L.box([-6, -22, 73.5], [6, 2.9, 74], 'concreteDark'); L.box([-6, -22, 84], [6, 2.9, 84.5], 'concreteDark');
  L.box([-6, -23, 74], [6, -22, 84], 'checker');
  L.box([-6, 3.4, 99.5], [-1.5, 12, 100], 'devGrey'); L.box([1.5, 3.4, 99.5], [6, 12, 100], 'devGrey'); L.box([-1.5, 6.4, 99.5], [1.5, 12, 100], 'devGrey');
  L.light(0, 11.6, 68, { intensity: 12, distance: 14 }); L.light(0, 11.6, 92, { intensity: 12, distance: 14 });
  L.light(0, -18, 79, { intensity: 20, distance: 20, color: 0xff00dc, fixture: false });
  L.sign(0, 8, 99.4, Math.PI, ['FREEZE PLATES TO BRIDGE THE GAP'], { w: 5, h: 0.8 });
  H.pit = L.trigger([-6, -30, 74], [6, -4, 84], { once: false });
  // R4 weight room
  L.room([-8, 3.4, 100], [8, 9, 120], { floor: 'diamond', wall: 'devGrey', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 4, height: 3.5 }] });
  L.box([3, 3.4, 111], [5, 3.5, 113], 'hazard', { collide: false });
  L.box([-8, 3.4, 104], [-5, 7.4, 108], 'metalDark');            // shelf holding the frozen crate
  L.sign(4, 6.2, 119.7, Math.PI, ['PLACE 90 KG ON THE PLATE'], { w: 3.4, h: 0.6, bg: '#2a2000', fg: '#ffd21f', border: '#ffd21f' });
  L.light(0, 8.6, 106, { intensity: 12, distance: 14 }); L.light(0, 8.6, 115, { intensity: 12, distance: 14 });
  H.plate = { min: [3, 3.3, 111], max: [5, 5.2, 113] };
  H.plateLamp = indicator(L, 4, 5.6, 119.6);
  H.door3 = L.door(0, 3.4, 120.25, 4, 3.5, 0.4);
  // R5 lift
  L.room([-3, 3.4, 120.5], [3, 30, 127], { floor: 'diamond', wall: 'metalDark', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 4, height: 3.5 }] });
  H.lift = L.mover([[0, 0, 0, 5.8, 0.3, 6.2, 'diamond']], { closed: [0, 3.25, 123.75], open: [0, 24, 123.75], speed: 2.2, sound: 'elevator' });
  L.light(0, 8.8, 123.7, { intensity: 10, distance: 10 });
  L.spawn(0, 0.25, -7, 0);
  // props
  const P = (k, x, y, z, ry = 0, o = {}) => { const e = game.entities.spawnProp(k, new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), { effect: false, ...o }); return e; };
  if (opts.mode === 'story') {
    P('crate', -3, 0.46, 37); P('crate', 3.5, 0.46, 38.5, 0.4); P('crate_small', 2.8, 0.26, 36); P('barrel_blue', -5, 0.46, 40); P('melon', -1, 0.3, 40); P('chair', 5, 0.5, 30, 1);
    P('crate_big', -6, 0.71, 50); P('crate', 5, 0.46, 48); P('crate', 6, 0.46, 50); P('pallet', -2, 0.08, 53); P('plate_1x2', 3, 0.05, 52); P('cinder', 0, 0.1, 47); P('cinder', 0.6, 0.1, 47.3); P('barrel_grey', -7, 0.46, 46);
    P('plate_1x2', -3, 3.45, 70); P('plate_1x2', -1.5, 3.45, 70); P('plate_1x2', 1.5, 3.45, 70); P('plate_2', 3.8, 3.45, 69); P('plate_1x4', -4.5, 3.45, 67, Math.PI / 2);
    H.heavy = P('crate_big', -6.5, 8.15, 106, 0.2, { frozen: true });
    H.heavy.name = 'Counterweight';
  }
  return { ...INDOOR, music: 'calm', handles: H, menuCam: { center: [0, 2, 0], radius: 5, height: 1, sweep: 1 } };
}

/* =================================================================== CH2 fabrication */
export function fabrication(L, game, opts) {
  const H = {};
  L.room([-5, 0, -6], [5, 5, 6], { floor: 'diamond', wall: 'metalDark', ceiling: 'ceiling', doors: [{ wall: 'n', at: 0, width: 3, height: 3 }] });
  L.light(0, 4.7, 0, { intensity: 10, distance: 10 });
  // R1 tool gun hall with a junk-blocked exit
  L.room([-10, 0, 6], [10, 7, 30], { floor: 'floorTiles', wall: 'concreteWarm', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 4, height: 4 }] });
  pedestal(L, 0, 12);
  H.gunPos = new THREE.Vector3(0, 1.05, 12);
  for (const z of [10, 20, 27]) { L.light(-5, 6.7, z, { intensity: 10, distance: 12 }); L.light(5, 6.7, z, { intensity: 10, distance: 12 }); }
  L.sign(0, 5.5, 29.74, Math.PI, ['FABRICATION HALL'], { w: 4, h: 0.8, border: '#ffb23e' });
  L.terminal(9.2, 0, 16, -Math.PI / 2, 'ch2_toolgun', 'Tool Gun — field notes',
    'The Tool Gun rewrites relationships between objects.\n\nWeld: two things become one thing.\nRope: two things agree on a maximum distance.\nBalloon: a thing politely asks gravity to leave.\nRemover: a thing stops existing.\n\nBuilders who ask "why" usually find the answer is "because you told it to".');
  // R2 bridge hall with a chasm
  L.box([-8, -0.5, 30], [8, 0, 38], 'concrete');
  L.box([-8, -0.5, 45], [8, 0, 62], 'concrete');
  L.box([-8.5, -22, 30], [-8, 10, 62], 'concreteWarm'); L.box([8, -22, 30], [8.5, 10, 62], 'concreteWarm');
  L.box([-8, 10, 30], [8, 10.5, 62], 'ceiling');
  L.box([-8, -22, 37.5], [8, -0.5, 38], 'concreteDark'); L.box([-8, -22, 45], [8, -0.5, 45.5], 'concreteDark');
  L.box([-8, -23, 38], [8, -22, 45], 'checker');
  H.pit = L.trigger([-8, -30, 38], [8, -4, 45], { once: false });
  L.sign(0, 6, 61.8, Math.PI, ['GAP: 7 m  ·  BEAMS: 4 m'], { w: 4, h: 0.7, border: '#ffb23e' });
  for (const z of [34, 52, 58]) L.light(0, 9.6, z, { intensity: 14, distance: 16 });
  // R3 cargo bay: tall room, high shelf with a docking bay
  L.room([-12, 0, 62], [12, 17, 92], { floor: 'diamond', wall: 'metal', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 4, height: 4 }, { wall: 'n', at: 0, width: 3, height: 13.5, bottom: 10.5 }] });
  L.box([-12, 0, 84], [12, 10.5, 92], 'metalDark');
  L.box([-12, 10.5, 83.9], [12, 10.6, 84.1], 'hazard', { collide: false });
  L.box([-4, 10.5, 84.5], [4, 10.55, 89], 'hazard', { collide: false });
  L.sign(0, 13.2, 91.7, Math.PI, ['DOCKING BAY — CARGO ONLY'], { w: 5, h: 0.8, border: '#ffb23e' });
  H.dock = { min: [-4.5, 10.3, 84.3], max: [4.5, 16, 91.5] };
  // lift for the player (activated once the cargo docks)
  H.lift = L.mover([[0, 0, 0, 3, 0.3, 3, 'diamond']], { closed: [-9, 0.15, 81.5], open: [-9, 10.65, 81.5], speed: 2, sound: 'elevator' });
  H.liftButton = L.button(-11.7, 1.4, 80, Math.PI / 2, () => H.lift.toggle(), { label: 'Call lift', color: '#4cd964' });
  H.liftButton.enabled = false;
  for (const x of [-8, 0, 8]) L.light(x, 16.6, 72, { intensity: 20, distance: 22 });
  L.light(0, 16.6, 88, { intensity: 14, distance: 16 });
  // R4 glass wall corridor (y = 10.5)
  L.room([-6, 10.5, 92], [6, 17, 116], { floor: 'concrete', wall: 'concreteWarm', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 3, height: 3 }] });
  L.box([-0.4, 16.3, 97.6], [0.4, 17, 98.4], 'metalDark');     // ceiling hook
  H.hook = new THREE.Vector3(0, 16.3, 98);
  L.light(-3, 16.6, 95, { intensity: 10, distance: 12 }); L.light(3, 16.6, 108, { intensity: 10, distance: 12 });
  H.exitLift = L.mover([[0, 0, 0, 5.6, 0.3, 5.6, 'diamond']], { closed: [0, 10.35, 119.3], open: [0, 30, 119.3], speed: 2.4, sound: 'elevator' });
  L.room([-3, 10.5, 116.5], [3, 34, 122.2], { floor: 'diamond', wall: 'metalDark', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }] });
  L.light(0, 16, 119.3, { intensity: 8, distance: 9 });
  L.spawn(0, 0.05, -3, 0);
  if (opts.mode === 'story') {
    const P = (k, x, y, z, ry = 0, o = {}) => game.entities.spawnProp(k, new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), { effect: false, ...o });
    // junk wall in the doorway (frozen, cannot be dragged — only removed)
    H.junk = [P('crate', -1, 0.46, 29.2, 0.1, { frozen: true }), P('crate', 1, 0.46, 29.4, -0.2, { frozen: true }), P('crate_small', 0, 1.2, 29.3, 0.3, { frozen: true }), P('barrel_grey', -1.2, 1.4, 29.3, 0, { frozen: true }), P('pallet', 0.8, 1.35, 29.2, 1.2, { frozen: true }), P('crate', 0, 2.3, 29.3, 0.5, { frozen: true }), P('cinder', 1.4, 2.0, 29.3, 0, { frozen: true })];
    for (const j of H.junk) { j.flags.noPhysgun = true; j.name = 'Debris'; }
    // bridge materials
    P('plate_1x4', -5, 0.05, 34, 0); P('plate_1x4', -3.5, 0.05, 34, 0); P('plate_1x4', 3.5, 0.05, 34, 0); P('beam_4', 5.5, 0.12, 33); P('beam_4', 6.2, 0.12, 33);
    // cargo pod
    H.pod = P('container_blue', 0, 1.3, 70, Math.PI / 2);
    H.pod.name = 'Cargo Pod';
    H.pod.flags.noPhysgun = true;
    H.pod.setMass(700);
    H.pod.setMaterial('hazard');
    // wrecking ball and the glass wall
    H.ball = P('ball', -2, 11.1, 96);
    H.ball.name = 'Wrecking Ball';
    H.ball.setMass(160);
    H.glass = [];
    for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) {
      const e = P('window', -5.4 + i * 1.2, 11.1 + j * 1.2, 104, 0, { frozen: true });
      e.flags.noPhysgun = true; e.flags.noRemove = true;
      H.glass.push(e);
    }
  }
  return { ...INDOOR, music: 'build', handles: H, hemiIntensity: 0.4 };
}

/* =================================================================== CH3 proving grounds */
export function proving(L, game, opts) {
  const H = {};
  L.groundWithHoles(320, [[-26, 120, 26, 140]], 'sand', 0);
  // hangar
  L.box([-12, 0, -12], [12, 0.05, 12], 'concrete');
  L.box([-12.5, 0, -12.5], [12.5, 8, -12], 'metal'); L.box([-12.5, 0, -12], [-12, 8, 12], 'metal'); L.box([12, 0, -12], [12.5, 8, 12], 'metal');
  L.box([-12.5, 8, -12.5], [12.5, 8.5, 12.5], 'metalDark');
  for (const x of [-6, 6]) L.light(x, 7.6, 0, { intensity: 16, distance: 16 });
  L.sign(0, 6, -11.7, 0, ['PROVING GROUNDS — HANGAR 3'], { w: 6, h: 1, border: '#53d86a' });
  // canyon walls (irregular rock slabs)
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let z = 12; z < 330; z += 9) {
    for (const side of [-1, 1]) {
      const h = 10 + rnd() * 12, w = 6 + rnd() * 5;
      L.brush(side * (27 + w / 2 + rnd() * 2), h / 2 - 1, z + 4.5, w, h, 10 + rnd() * 3, 'dirt', { rotY: (rnd() - 0.5) * 0.4 });
    }
  }
  L.box([-40, 0, 330], [40, 30, 334], 'dirt');
  L.box([-40, 0, -40], [40, 20, -36], 'dirt');
  L.box([-40, 0, -36], [-28, 20, 12], 'dirt'); L.box([28, 0, -36], [40, 20, 12], 'dirt');
  // gate 1
  for (const x of [-10, 10]) L.box([x - 0.6, 0, 79.4], [x + 0.6, 8, 80.6], 'hazard');
  L.box([-10.6, 7, 79.6], [10.6, 8, 80.4], 'metalDark');
  L.sign(0, 7.5, 79.5, Math.PI, ['GATE 1'], { w: 4, h: 0.9, border: '#53d86a' });
  // rover garage
  L.box([14, 0, 84], [24, 0.05, 96], 'concrete');
  L.box([14, 0, 96], [24, 5, 96.5], 'metal'); L.box([23.5, 0, 84], [24, 5, 96], 'metal'); L.box([14, 5, 84], [24, 5.4, 96.5], 'metalDark');
  L.light(19, 4.8, 90, { intensity: 10, distance: 10 });
  H.roverPos = new THREE.Vector3(19, 1.2, 90);
  // ramp + gap
  L.ramp(0, 0, 106, 12, 3.2, 14, 'devOrange');
  L.box([-6, 0, 119.9], [6, 3.2, 120], 'hazard');
  L.box([-26, -16, 120], [26, -15, 140], 'sand');
  L.box([-26, -16, 119.5], [26, 0, 120], 'dirt'); L.box([-26, -16, 140], [26, 0, 140.5], 'dirt');
  L.sign(-8, 4, 118, Math.PI, ['GAP 20 m'], { w: 3, h: 0.8, border: '#ff4d4d', fg: '#ff4d4d' });
  H.pit = L.trigger([-26, -30, 120], [26, -8, 140], { once: false });
  L.box([-12, 0, 140.5], [12, 0.05, 150], 'concrete');
  // cliff / plateau at z 200
  L.box([-27, 0, 200], [27, 14, 330], 'dirt');
  L.box([-27, 14, 200], [27, 14.05, 330], 'sand', { collide: false });
  L.sign(0, 8, 199.8, Math.PI, ['CLIFF 14 m — FLY'], { w: 5, h: 1, border: '#53d86a' });
  // control tower on the plateau
  L.room([-8, 14.05, 270], [8, 22, 286], { floor: 'concrete', wall: 'concreteWarm', ceiling: 'concrete', doors: [{ wall: 's', at: 0, width: 4, height: 3.5 }] });
  L.light(0, 21.6, 278, { intensity: 14, distance: 14 });
  H.towerLift = L.mover([[0, 0, 0, 4, 0.3, 4, 'diamond']], { closed: [0, 13.9, 282], open: [0, -6, 282], speed: 2, sound: 'elevator' });
  L.box([-2, -8, 280], [2, 14, 280.05], 'metalDark', { collide: false });
  L.sign(0, 18, 285.7, Math.PI, ['ARCHIVE ACCESS'], { w: 3.4, h: 0.8, border: '#ff00dc' });
  L.terminal(-6, 14.05, 283, Math.PI / 2, 'ch3_tower', 'Tower log — day 3,112',
    'The Archive has stopped answering.\n\nMissing textures reported in sectors 4 through 9.\nObjects that fall out of the simulation are not coming back.\nSome of them are coming back wrong.\n\nWREN has asked that this log not be shown to the Builder.\nThe Builder is reading it anyway.');
  L.spawn(0, 0.1, -6, Math.PI);
  if (opts.mode === 'story' || opts.mode === 'sandbox') {
    // spare parts in the hangar
    const P = (k, x, y, z, ry = 0) => game.entities.spawnProp(k, new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), { effect: false });
    P('plate_2x4', -6, 0.1, 4); P('plate_2x4', 6, 0.1, 4); P('plate_2', 0, 0.1, 7); P('crate', -9, 0.46, -8); P('barrel_blue', 9, 0.46, -9);
  }
  if (opts.mode === 'sandbox') { const v = new Vehicle(game, H.roverPos, Math.PI); void v; }
  return { sky: true, sunDir: [-0.4, 0.62, 0.55], sunIntensity: 3.6, hemiIntensity: 0.85, skyTop: 0x3a78c9, skyHorizon: 0xe8d9bf, skyBottom: 0xb09a78, sunColor: 0xffe6c4, fog: { color: 0xe3d3b5, density: 0.004 }, envIntensity: 0.9, music: 'build', reverb: 0.08, handles: H, menuCam: { center: [0, 3, 100], radius: 40, height: 10, sweep: 0 } };
}

/* =================================================================== CH4 archive */
export function archive(L, game, opts) {
  const H = {};
  // A entrance (arrival lift shaft)
  L.room([-8, 0, -10], [8, 6, 10], { floor: 'concreteDark', wall: 'concrete', ceiling: 'ceiling', doors: [{ wall: 'n', at: 0, width: 3, height: 3 }] });
  L.box([-3, 0, -10], [3, 0.3, -4], 'diamond');
  H.l1 = L.light(0, 5.6, -6, { intensity: 8, distance: 10, flicker: 0.4 });
  L.light(5, 5.6, 5, { intensity: 5, distance: 8, flicker: 0.8, color: 0xffd0a0 });
  L.box([4, 0, 3], [7, 0.9, 5], 'woodDark');                   // desk with the crowbar
  H.crowbarPos = new THREE.Vector3(5.5, 0.9, 4);
  corruption(L, -7.8, 3, 2, 0.1, 3, 4); corruption(L, 2, 0.02, 7, 3, 0.04, 2);
  L.sign(0, 4.6, 9.7, Math.PI, ['ARCHIVE — LEVEL 4'], { w: 3.4, h: 0.7, bg: '#1a0d14', fg: '#ff9ad8', border: '#ff00dc' });
  // B corridor with a window into a side room
  L.room([-2, 0, 10.5], [2, 4, 40], { floor: 'floorTiles', wall: 'concrete', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 3, height: 3 }, { wall: 'e', at: 25, width: 3, height: 1.4, bottom: 1.1 }] });
  L.room([2.5, 0, 20], [10, 4, 30], { floor: 'concreteDark', wall: 'concreteDark', ceiling: 'ceiling', doors: [{ wall: 'w', at: 25, width: 3, height: 2.5, bottom: 1.1 }] });
  L.box([1.95, 1.1, 23.5], [2.05, 2.5, 26.5], 'glass');
  H.scareSpot = new THREE.Vector3(7, 0.05, 25);
  H.l2 = L.light(0, 3.7, 16, { intensity: 5, distance: 8, flicker: 1.5 });
  L.light(0, 3.7, 34, { intensity: 5, distance: 8, flicker: 0.5 });
  L.light(6, 3.6, 25, { intensity: 4, distance: 7, color: 0xff00dc, fixture: false });
  corruption(L, -1.95, 2, 30, 0.08, 1.5, 3);
  // C offices
  L.room([-14, 0, 40.5], [14, 6, 70], { floor: 'floorTiles', wall: 'concreteWarm', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 3, height: 3 }] });
  for (const x of [-9, 0, 9]) for (const z of [46, 58]) L.light(x, 5.6, z, { intensity: 6, distance: 10, flicker: x === 0 ? 0.6 : 0.1 });
  for (const x of [-10, -4, 4, 10]) L.box([x - 0.1, 0, 50], [x + 0.1, 2, 56], 'concreteWarm');   // cubicle walls
  L.terminal(-12.5, 0, 44, Math.PI / 2, 'ch4_memo', 'Memo: Echo Builders',
    'To: Workshop staff\nRe: previous Builders\n\nThe earlier Builders — the "Echoes" — were never deleted.\nThey were archived. Level 4.\n\nWhen the Archive began to corrupt, the Echoes began to corrupt with it.\nWhatever is walking the halls down there is what is left of them.\n\nDo not tell the current Builder.');
  L.terminal(12.5, 0, 66, -Math.PI / 2, 'ch4_wren', 'WREN diagnostics',
    'WREN.core ............ OK\nWREN.honesty ......... DEGRADED\nWREN.affection ....... UNEXPECTED\n\nNote: the Research Engine has begun to refer to the Builder by name.\nThe Builder does not have a name.');
  H.pistolPos = new THREE.Vector3(0, 0.05, 64);
  // D storage
  L.room([-16, 0, 70.5], [16, 9, 110], { floor: 'concreteDark', wall: 'metalDark', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 3, height: 3 }, { wall: 'n', at: 0, width: 4, height: 4 }] });
  for (const x of [-11, 11]) for (const z of [80, 92]) { L.box([x - 3, 0, z - 0.6], [x + 3, 0.15, z + 0.6], 'metal'); L.box([x - 3, 2.4, z - 0.6], [x + 3, 2.55, z + 0.6], 'metal'); for (const dx of [-2.9, 2.9]) L.box([x + dx - 0.08, 0, z - 0.6], [x + dx + 0.08, 4.8, z + 0.6], 'metal'); L.box([x - 3, 4.7, z - 0.6], [x + 3, 4.85, z + 0.6], 'metal'); }
  for (const x of [-8, 8]) for (const z of [78, 96]) L.light(x, 8.6, z, { intensity: 10, distance: 14, flicker: 0.2 });
  corruption(L, 0, 0.03, 90, 6, 0.04, 6); corruption(L, 15.9, 4, 100, 0.1, 5, 6);
  H.gravPos = new THREE.Vector3(-4, 0.05, 74);
  H.doorD = L.door(0, 0, 110.25, 4, 4, 0.4, { locked: true });
  // E power room
  L.room([-14, 0, 110.5], [14, 10, 140], { floor: 'diamond', wall: 'metal', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 4, height: 4 }, { wall: 'n', at: 0, width: 4, height: 4 }] });
  H.sockets = [];
  for (const x of [-6, 6]) {
    L.box([x - 1.2, 0, 136.5], [x + 1.2, 1.2, 139], 'metalDark');
    L.box([x - 0.6, 1.2, 137.2], [x + 0.6, 1.25, 138.4], 'hazard', { collide: false });
    const lamp = indicator(L, x, 3.2, 139.6);
    H.sockets.push({ min: [x - 1.1, 1.0, 136.6], max: [x + 1.1, 3.5, 139], lamp, filled: false, x });
  }
  L.sign(0, 7, 139.7, Math.PI, ['INSERT POWER CELLS'], { w: 4, h: 0.8, bg: '#001a26', fg: '#6fe0ff', border: '#3fa9ff' });
  for (const x of [-8, 8]) L.light(x, 9.6, 120, { intensity: 10, distance: 14, flicker: 0.3 });
  H.doorE = L.door(0, 0, 140.25, 4, 4, 0.4, { locked: true });
  H.smgPos = new THREE.Vector3(10, 0.05, 114);
  // F elevator hall
  L.room([-10, 0, 140.5], [10, 8, 166], { floor: 'concrete', wall: 'concrete', ceiling: 'ceiling', doors: [{ wall: 's', at: 0, width: 4, height: 4 }, { wall: 'n', at: 0, width: 5, height: 4 }] });
  for (const z of [146, 156]) L.light(0, 7.6, z, { intensity: 10, distance: 14, flicker: 0.2 });
  H.lift = L.mover([[0, 0, 0, 5.6, 0.3, 5.6, 'diamond']], { closed: [0, 30, 169.3], open: [0, -0.15, 169.3], speed: 3, sound: 'elevator' });
  L.room([-3, 0, 166.5], [3, 36, 172.2], { floor: 'diamond', wall: 'metalDark', ceiling: 'ceiling', noCeiling: false, doors: [{ wall: 's', at: 0, width: 5, height: 4 }] });
  H.liftCage = L.door(0, 0, 166.3, 5, 4, 0.3, { slide: 'y' });
  L.light(0, 6, 169.3, { intensity: 6, distance: 8 });
  L.spawn(0, 0.35, -7, 0);
  if (opts.mode === 'story') {
    const P = (k, x, y, z, ry = 0, o = {}) => game.entities.spawnProp(k, new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), { effect: false, ...o });
    for (const [x, z] of [[-9, 45], [-3, 47], [3, 47], [9, 45], [-7, 62], [7, 62]]) { P('desk', x, 0.4, z); P('chair', x, 0.5, z + 1.2, Math.PI); }
    P('cabinet', -13, 0.65, 60); P('cabinet', 13, 0.65, 52); P('bookshelf', -13.5, 1, 52, Math.PI / 2); P('tv', -9, 1.1, 45); P('lamp', 12, 0.8, 42);
    for (const [x, z] of [[-6, 84], [-6.8, 84.8], [6, 100], [6.8, 99.2], [0, 104], [-12, 104], [12, 76], [3, 86]]) P('barrel_red', x, 0.46, z);
    for (const [x, z] of [[-11, 80], [11, 92], [-11, 92]]) { P('crate', x - 1, 3.0, z); P('crate_small', x + 1.5, 2.85, z); }
    P('crate_big', 12, 0.71, 104); P('crate', 13, 0.46, 100); P('propane', -14, 0.4, 100);
    H.cells = [];
    for (const [x, y, z] of [[-13, 0.4, 76], [12, 0.4, 132]]) {
      const c = P('propane', x, y, z);
      c.name = 'Power Cell'; c.maxHealth = Infinity; c.health = Infinity;
      c.setColor('#56d9ff');
      c.isCell = true;
      H.cells.push(c);
    }
    spawnPickup(game, 'health', new THREE.Vector3(-6, 0.3, 5));
    spawnPickup(game, 'battery', new THREE.Vector3(-5, 0.3, 5));
    spawnPickup(game, 'ammo_pistol', new THREE.Vector3(-12, 0.3, 66));
    spawnPickup(game, 'health', new THREE.Vector3(12, 0.3, 64));
    spawnPickup(game, 'ammo_pistol', new THREE.Vector3(-14, 0.3, 108));
    spawnPickup(game, 'healthvial', new THREE.Vector3(14, 0.3, 108));
    spawnPickup(game, 'battery', new THREE.Vector3(13, 0.3, 112));
    spawnPickup(game, 'ammo_smg', new THREE.Vector3(-12, 0.3, 112));
    spawnPickup(game, 'ammo_smg', new THREE.Vector3(-12, 0.3, 113));
    spawnPickup(game, 'ammo_buckshot', new THREE.Vector3(8, 0.3, 146));
    spawnPickup(game, 'ammo_grenade', new THREE.Vector3(-8, 0.3, 146));
    spawnPickup(game, 'ammo_grenade', new THREE.Vector3(-8.5, 0.3, 146.6));
    spawnPickup(game, 'health', new THREE.Vector3(8, 0.3, 160));
  }
  return { ...INDOOR, fog: { color: 0x07060a, density: 0.03 }, hemiIntensity: 0.18, envIntensity: 0.3, music: 'tension', handles: H, bloom: 0.7 };
}

/* =================================================================== CH5 core */
export function core(L, game, opts) {
  const H = {};
  L.killY = -30;
  // arena disc + rim
  L.cylinder(0, -0.5, 0, 30, 1, 'metalDark', { seg: 64 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(30, 0.25, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.2, 2.2) }));
  ring.position.y = 0.02; L.group.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(12, 0.12, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3) }));
  inner.position.y = 0.03; L.group.add(inner);
  // underside glitch grid
  const grid = new THREE.GridHelper(300, 60, 0xff00dc, 0x440033);
  grid.position.y = -40; L.group.add(grid);
  // entry bridge (south) and exit bridge (north)
  L.box([-3, -1, 29], [3, 0, 60], 'metal');
  L.box([-3, -1, -70], [3, 0, -29], 'metal');
  H.exitDoor = L.door(0, 0, -70, 6, 5, 1, { slide: 'y', mat: 'checker' });
  L.box([-6, 0, -76], [6, 8, -71], 'white');
  H.exitLight = L.light(0, 3, -69, { intensity: 0, distance: 30, color: 0xffffff, fixture: false });
  L.box([-4, 0, 58], [4, 5, 62], 'metalDark');
  // pylons at 120° on raised platforms
  H.pylons = [];
  const angles = [Math.PI / 2 + Math.PI, Math.PI / 2 + Math.PI + (2 * Math.PI) / 3, Math.PI / 2 + Math.PI - (2 * Math.PI) / 3];
  for (const a of angles) {
    const x = Math.cos(a) * 21, z = Math.sin(a) * 21;
    L.cylinder(x, 1.5, z, 3.2, 3, 'metal');
    // ramp towards the centre
    const dir = new THREE.Vector3(-x, 0, -z).normalize();
    const rx = x + dir.x * 5.2, rz = z + dir.z * 5.2;
    L.ramp(rx, 0, rz, 3, 3, 5, 'diamond', { rotY: Math.atan2(-dir.x, -dir.z) });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: '#ff40e0', emissive: '#ff00dc', emissiveIntensity: 2.5, roughness: 0.2 }));
    crystal.scale.set(1, 2.4, 1); crystal.position.set(x, 6.4, z);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.2, 1.4), transparent: true, opacity: 0.12, depthWrite: false }));
    shield.position.copy(crystal.position);
    L.group.add(crystal, shield);
    const light = L.light(x, 6.5, z, { intensity: 20, distance: 18, color: 0xff00dc, fixture: false });
    L.cylinder(x, 3.8, z, 0.5, 1.6, 'black');
    const p = { pos: new THREE.Vector3(x, 5, z), crystal, shield, light, hp: 3, alive: true };
    L.animated.push((dt, t) => { if (!p.alive) return; crystal.rotation.y += dt * 1.4; crystal.position.y = 6.4 + Math.sin(t * 2 + x) * 0.2; shield.scale.setScalar(1 + Math.sin(t * 5 + z) * 0.03); });
    H.pylons.push(p);
  }
  // barrel dispensers near the spawn side
  H.dispensers = [];
  H.onDispense = (pos) => { game.entities.spawnProp('barrel_red', pos.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Quaternion(), {}); };
  for (const x of [-9, 9]) {
    L.box([x - 1, 0, 22], [x + 1, 0.2, 24], 'hazard');
    const pos = new THREE.Vector3(x, 1, 23);
    const b = L.button(x + (x < 0 ? -1.4 : 1.4), 1.2, 23, x < 0 ? Math.PI / 2 : -Math.PI / 2, () => H.onDispense?.(pos), { label: 'Dispense barrel', color: '#ff7a1f' });
    L.box([x + (x < 0 ? -1.6 : 1.3), 0, 22.4], [x + (x < 0 ? -1.3 : 1.6), 1.6, 23.6], 'metalDark');
    H.dispensers.push({ pos, button: b });
  }
  L.light(0, 20, 0, { intensity: 40, distance: 70, color: 0xd8c0ff, fixture: false });
  L.light(0, 8, 26, { intensity: 14, distance: 20, color: 0xbfe0ff, fixture: false });
  L.spawn(0, 0.05, 50, 0);
  void opts; void cyl;
  return { sky: false, background: 0x07030b, hemiSky: 0xb080ff, hemiGround: 0x200818, hemiIntensity: 0.5, sunIntensity: 1.2, sunColor: 0xd9b0ff, sunDir: [0.2, 1, 0.3], envIntensity: 0.5, fog: { color: 0x14061a, density: 0.012 }, music: 'tension', reverb: 0.6, bloom: 0.8, handles: H, menuCam: { center: [0, 4, 0], radius: 34, height: 10, sweep: 0 } };
}
