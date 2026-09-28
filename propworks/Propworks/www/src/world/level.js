/* Level building: a small brush-based toolkit, in the spirit of the editors the Source
   era used. Static brushes are merged per material into a handful of meshes; each brush
   gets its own box collider tagged with its surface for footsteps and impacts. */
import * as THREE from 'three';
import { R, GROUPS } from '../physics/physics.js';
import { material, surfaceOf, uvScaleOf } from '../render/materials.js';
import { brushGeo, mergeGeometries, boxGeo, cyl } from './geometry.js';
import { textTexture } from '../render/textures.js';
import { Audio } from '../core/audio.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Level {
  constructor(game, def = {}) {
    this.game = game;
    this.name = def.name || 'map';
    this.group = new THREE.Group();
    this.group.name = 'level';
    game.renderer.scene.add(this.group);
    this.pending = new Map();     // material -> geometries
    this.colliders = [];
    this.lights = [];
    this.movers = [];
    this.triggers = [];
    this.usables = [];
    this.spawns = [];
    this.killY = def.killY ?? -40;
    this.animated = [];          // callbacks (dt, t)
    this.worldOwner = new Map(); // surface -> shared owner object
    this.textures = [];
  }

  owner(surface, extra) {
    if (extra) return { kind: 'world', surface, ...extra };
    if (!this.worldOwner.has(surface)) this.worldOwner.set(surface, { kind: 'world', surface, flags: {} });
    return this.worldOwner.get(surface);
  }

  _collider(desc, surface, groups = GROUPS.world, ownerExtra = null) {
    const c = this.game.physics.world.createCollider(desc.setCollisionGroups(groups).setFriction(0.8));
    this.game.physics.register(c, this.owner(surface, ownerExtra));
    this.colliders.push(c);
    return c;
  }

  /** Axis-aligned (or Y-rotated / tilted) static box, given centre and full size. */
  brush(x, y, z, w, h, d, mat = 'devGrey', { rotY = 0, rotX = 0, rotZ = 0, collide = true, visible = true, uv = null, surface = null, cast = true } = {}) {
    const rotated = rotY || rotX || rotZ;
    if (visible) {
      const g = rotated ? boxGeo(w, h, d, uv ?? uvScaleOf(mat)) : brushGeo(w, h, d, x, y, z, uv ?? (uvScaleOf(mat) || 2));
      if (rotated) { g.rotateX(rotX); g.rotateZ(rotZ); g.rotateY(rotY); }
      g.translate(x, y, z);
      this._queue(mat, g, cast);
    }
    if (collide) {
      _q.setFromEuler(_e.set(rotX, rotY, rotZ, 'YXZ'));
      const desc = R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z);
      if (rotated) desc.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
      this._collider(desc, surface || surfaceOf(mat));
    }
    return this;
  }

  /** Brush from min/max corners — handier for room shells. */
  box(min, max, mat, opts) {
    return this.brush((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2, Math.abs(max[0] - min[0]), Math.abs(max[1] - min[1]), Math.abs(max[2] - min[2]), mat, opts);
  }

  /** Hollow room: floor, ceiling, four walls, with optional door gaps [{wall:'n|s|e|w', at, width, height}]. */
  room(min, max, { floor = 'concrete', wall = 'devGrey', ceiling = 'ceiling', t = 0.5, doors = [], noCeiling = false } = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    this.box([x0 - t, y0 - t, z0 - t], [x1 + t, y0, z1 + t], floor);
    if (!noCeiling) this.box([x0 - t, y1, z0 - t], [x1 + t, y1 + t, z1 + t], ceiling);
    const wallSeg = (side) => {
      const gaps = doors.filter((d) => d.wall === side).sort((a, b) => a.at - b.at);
      const along = side === 'n' || side === 's';
      const lo = along ? x0 : z0, hi = along ? x1 : z1;
      let cur = lo;
      const put = (a, b, ya = y0, yb = y1) => {
        if (b - a < 0.01 || yb - ya < 0.01) return;
        if (side === 'n') this.box([a, ya, z1], [b, yb, z1 + t], wall);
        if (side === 's') this.box([a, ya, z0 - t], [b, yb, z0], wall);
        if (side === 'e') this.box([x1, ya, a], [x1 + t, yb, b], wall);
        if (side === 'w') this.box([x0 - t, ya, a], [x0, yb, b], wall);
      };
      for (const g of gaps) {
        const a = g.at - g.width / 2, b = g.at + g.width / 2;
        put(cur, a);
        put(a, b, y0 + (g.height ?? 2.6), y1);
        if (g.bottom) put(a, b, y0, y0 + g.bottom);
        cur = b;
      }
      put(cur, hi);
    };
    for (const s of ['n', 's', 'e', 'w']) wallSeg(s);
    return this;
  }

  /** Straight staircase from (x,y,z) rising `rise` over `run` along +dir. */
  stairs(x, y, z, width, rise, run, steps, dir = 'z', mat = 'concrete') {
    const sh = rise / steps, sd = run / steps;
    for (let i = 0; i < steps; i++) {
      const h = sh * (i + 1);
      if (dir === 'z') this.brush(x, y + h / 2, z + sd * (i + 0.5), width, h, sd, mat);
      else if (dir === '-z') this.brush(x, y + h / 2, z - sd * (i + 0.5), width, h, sd, mat);
      else if (dir === 'x') this.brush(x + sd * (i + 0.5), y + h / 2, z, sd, h, width, mat);
      else this.brush(x - sd * (i + 0.5), y + h / 2, z, sd, h, width, mat);
    }
    return this;
  }

  /** Sloped slab: rises `rise` over `run` along +Z (rotated by rotY). */
  ramp(x, y, z, width, rise, run, mat = 'concrete', { rotY = 0, thick = 0.3 } = {}) {
    const len = Math.hypot(rise, run);
    const ang = Math.atan2(rise, run);
    const off = new THREE.Vector3(0, -thick / 2 * Math.cos(ang), thick / 2 * Math.sin(ang)).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    return this.brush(x + off.x, y + rise / 2 + off.y, z + off.z, width, thick, len, mat, { rotX: -ang, rotY });
  }

  cylinder(x, y, z, r, h, mat = 'metal', { collide = true, seg = 24 } = {}) {
    const g = cyl(r, h, seg); g.translate(x, y, z);
    this._queue(mat, g, true);
    if (collide) this._collider(R.ColliderDesc.cylinder(h / 2, r).setTranslation(x, y, z), surfaceOf(mat));
    return this;
  }

  /** Big flat ground plane (grass / sand) with a thick collider. */
  ground(size, mat = 'grass', y = 0, cx = 0, cz = 0) {
    const g = new THREE.PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv, s = size / (uvScaleOf(mat) || 4);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
    g.translate(cx, y, cz);
    this._queue(mat, g, false);
    this._collider(R.ColliderDesc.cuboid(size / 2, 1, size / 2).setTranslation(cx, y - 1, cz), surfaceOf(mat));
    return this;
  }

  /** Rectangular patch of ground (plane + slab collider), for grounds with holes cut in them. */
  groundRect(x0, z0, x1, z1, mat = 'grass', y = 0) {
    const w = x1 - x0, d = z1 - z0;
    if (w <= 0 || d <= 0) return this;
    const g = new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const uv = g.attributes.uv, pos = g.attributes.position, s = uvScaleOf(mat) || 4;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / s, pos.getZ(i) / s);
    this._queue(mat, g, false);
    this._collider(R.ColliderDesc.cuboid(w / 2, 1, d / 2).setTranslation((x0 + x1) / 2, y - 1, (z0 + z1) / 2), surfaceOf(mat));
    return this;
  }

  /** Ground over [-half, half]² with rectangular holes [[x0,z0,x1,z1], …] (non-overlapping). */
  groundWithHoles(half, holes, mat = 'grass', y = 0) {
    // split into vertical strips by hole x-edges, then fill each strip around the holes
    const xs = [...new Set([-half, half, ...holes.flatMap((h) => [h[0], h[2]])])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i], b = xs[i + 1];
      const inStrip = holes.filter((h) => h[0] <= a && h[2] >= b).sort((p, q) => p[1] - q[1]);
      let z = -half;
      for (const h of inStrip) { this.groundRect(a, z, b, h[1], mat, y); z = h[3]; }
      this.groundRect(a, z, b, half, mat, y);
    }
    return this;
  }

  _queue(mat, g, cast) {
    const key = mat + (cast ? '' : '|nocast');
    if (!this.pending.has(key)) this.pending.set(key, []);
    // normalise attribute sets so mergeGeometries does not reject mixed sources
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    this.pending.get(key).push(g);
  }

  /** Add a free-standing decorative mesh (not merged, not colliding unless asked). */
  mesh(obj, { collide = null } = {}) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.add(obj);
    if (collide) this._collider(collide, 'metal');
    return obj;
  }

  light(x, y, z, { color = 0xfff1d8, intensity = 20, distance = 18, fixture = true, shadow = false, spot = null, flicker = 0 } = {}) {
    const q = this.game.renderer.q;
    if (this.lights.length >= (q?.maxLights ?? 12) + 4) return null;   // quality budget
    let l;
    if (spot) {
      l = new THREE.SpotLight(color, intensity * 3, distance, spot.angle ?? 0.7, 0.5, 1.5);
      l.target.position.set(x + (spot.dir?.[0] ?? 0), y + (spot.dir?.[1] ?? -1), z + (spot.dir?.[2] ?? 0));
      this.group.add(l.target);
    } else l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    l.castShadow = shadow && this.lights.filter((o) => o.castShadow).length < 2;
    if (l.castShadow) { l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; }
    this.group.add(l);
    this.lights.push(l);
    if (fixture) {
      const f = new THREE.Mesh(boxGeo(0.9, 0.06, 0.4), material('lightPanel'));
      f.position.set(x, y + 0.25, z);
      this.group.add(f);
    }
    if (flicker) {
      const base = l.intensity;
      this.animated.push((dt, t) => { l.intensity = Math.random() < flicker * dt * 8 ? base * 0.1 : base * (0.9 + Math.sin(t * 20) * 0.05); });
    }
    return l;
  }

  water(min, max, { color = 0x2a6a8a, opacity = 0.72 } = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
    const nm = this.game.textures.water.normal.clone();
    nm.repeat.set(w / 6, d / 6); nm.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.2, transparent: true, opacity, normalMap: nm, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.6, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.set((x0 + x1) / 2, y1, (z0 + z1) / 2);
    m.renderOrder = 5;
    this.group.add(m);
    // underside for when you swim below
    const under = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0e3448, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false }));
    under.position.copy(m.position);
    this.group.add(under);
    this.animated.push((dt) => { nm.offset.x += dt * 0.02; nm.offset.y += dt * 0.013; });
    this.game.physics.waters.push({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, surface: y1 });
    return m;
  }

  /** Sensor volume. onEnter(who) fires for the player by default; set props:true for entities. */
  trigger(min, max, { onEnter = null, onExit = null, once = true, props = false, name = '' } = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const t = { name, min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1), onEnter, onExit, once, props, fired: false, inside: new Set(), enabled: true };
    this.triggers.push(t);
    return t;
  }

  spawn(x, y, z, yaw = 0) { this.spawns.push({ pos: new THREE.Vector3(x, y, z), yaw }); return this; }

  /** Kinematic moving brush group (doors, lifts, platforms). */
  mover(brushes, { mat = 'metalDark', closed = [0, 0, 0], open = [0, 3, 0], speed = 2, sound = 'door_open', startOpen = false } = {}) {
    const geos = [];
    const body = this.game.physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(...closed));
    for (const [x, y, z, w, h, d, m] of brushes) {
      const g = boxGeo(w, h, d, uvScaleOf(m || mat) || 1); g.translate(x, y, z);
      geos.push({ g, m: m || mat });
      const c = this.game.physics.world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setCollisionGroups(GROUPS.world), body);
      this.game.physics.register(c, this.owner('metal'));
    }
    const group = new THREE.Group();
    const byMat = new Map();
    for (const { g, m } of geos) { if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(g.index ? g.toNonIndexed() : g); }
    for (const [m, list] of byMat) { const mesh = new THREE.Mesh(mergeGeometries(list), material(m)); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); }
    group.position.set(...closed);
    this.group.add(group);
    const mv = {
      body, group, a: new THREE.Vector3(...closed), b: new THREE.Vector3(...open), t: startOpen ? 1 : 0, target: startOpen ? 1 : 0, speed, sound, prev: new THREE.Vector3(...closed),
      open() { if (this.target !== 1) { this.target = 1; if (sound) Audio.play(sound, { pos: this.group.position }); } },
      close() { if (this.target !== 0) { this.target = 0; if (sound) Audio.play(sound, { pos: this.group.position }); } },
      toggle() { this.target ? this.close() : this.open(); },
      get isOpen() { return this.t >= 0.999; },
    };
    const len = mv.a.distanceTo(mv.b) || 1;
    mv.step = (dt) => {
      if (mv.t === mv.target) return;
      const dir = Math.sign(mv.target - mv.t);
      mv.t = THREE.MathUtils.clamp(mv.t + dir * (mv.speed / len) * dt, 0, 1);
      if ((dir > 0 && mv.t >= mv.target) || (dir < 0 && mv.t <= mv.target)) mv.t = mv.target;
      const s = mv.t * mv.t * (3 - 2 * mv.t);
      const p = new THREE.Vector3().lerpVectors(mv.a, mv.b, s);
      body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    };
    mv.render = () => { const t = body.translation(); group.position.set(t.x, t.y, t.z); };
    this.movers.push(mv);
    return mv;
  }

  /** Sliding door in a wall gap. axis 'x' slides sideways along X; 'y' lifts. */
  door(x, y, z, w, h, d, { slide = 'y', mat = 'metalDark', speed = 2.5, locked = false } = {}) {
    const off = slide === 'y' ? [0, h - 0.1, 0] : slide === 'x' ? [w - 0.1, 0, 0] : [0, 0, d - 0.1];
    const mv = this.mover([[0, 0, 0, w, h, d, mat], [0, h / 2 - 0.15, d / 2 + 0.01, w * 0.9, 0.1, 0.02, 'hazard'], [0, h / 2 - 0.15, -d / 2 - 0.01, w * 0.9, 0.1, 0.02, 'hazard']], { closed: [x, y + h / 2, z], open: [x + off[0], y + h / 2 + off[1], z + off[2]], speed });
    mv.locked = locked;
    return mv;
  }

  /** Wall button the player presses with USE. */
  button(x, y, z, rotY, onPress, { label = null, once = false, color = '#e53935' } = {}) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(boxGeo(0.3, 0.4, 0.06), material('metalDark'));
    const capMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.3 });
    const cap = new THREE.Mesh(cyl(0.08, 0.06, 16).rotateX(Math.PI / 2), capMat);
    cap.position.z = 0.05;
    g.add(plate, cap);
    g.position.set(x, y, z); g.rotation.y = rotY;
    this.group.add(g);
    const u = {
      pos: new THREE.Vector3(x, y, z), radius: 0.5, prompt: label || 'Press', enabled: true, used: false,
      use: () => {
        if (!u.enabled || (once && u.used)) { Audio.play('denied', { pos: u.pos }); return; }
        u.used = true;
        Audio.play('button', { pos: u.pos });
        cap.position.z = 0.02; setTimeout(() => { cap.position.z = 0.05; }, 200);
        if (once) { capMat.color.set('#4caf50'); capMat.emissive.set('#4caf50'); }
        onPress?.(u);
      },
      setColor(c) { capMat.color.set(c); capMat.emissive.set(c); },
    };
    this.usables.push(u);
    return u;
  }

  /** Flat sign with painted text. */
  sign(x, y, z, rotY, lines, { w = 2, h = 0.8, bg = '#1c2a3a', fg = '#e8f1ff', border = '#3fa9ff', font = null, emissive = 0.6 } = {}) {
    const tex = textTexture(lines, { w: 512, h: Math.round(512 * h / w), bg, fg, border, font: font || `bold ${Math.round(160 / Math.max(2, Array.isArray(lines) ? lines.length + 1 : 2))}px Tahoma, sans-serif` });
    this.textures.push(tex);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: emissive, roughness: 0.6 }));
    m.position.set(x, y, z); m.rotation.y = rotY;
    this.group.add(m);
    return m;
  }

  /** Lore terminal: a desk screen you can read with USE. */
  terminal(x, y, z, rotY, id, title, body) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(boxGeo(0.9, 1.0, 0.5), material('metalDark')).translateY(0.5));
    const tex = textTexture(['> ' + title.toUpperCase(), '', 'PRESS [USE] TO READ'], { w: 512, h: 320, bg: '#07130d', fg: '#56ff9a', font: 'bold 34px Consolas, monospace', align: 'left', glow: '#20ff70' });
    this.textures.push(tex);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.45), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(0, 1.25, 0.05); screen.rotation.x = -0.25;
    g.add(new THREE.Mesh(boxGeo(0.8, 0.55, 0.08), material('black')).translateY(1.25).translateZ(0.02).rotateX(-0.25));
    g.add(screen);
    g.position.set(x, y, z); g.rotation.y = rotY;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.add(g);
    const fwd = new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));
    this.brush(x, y + 0.5, z, 0.9, 1, 0.5, 'metalDark', { visible: false, rotY });
    const u = { pos: new THREE.Vector3(x, y + 1.2, z).addScaledVector(fwd, 0.2), radius: 0.8, prompt: 'Read terminal', enabled: true, use: () => this.game.readTerminal(id, title, body) };
    this.usables.push(u);
    return u;
  }

  /** Merge everything queued into one mesh per material. */
  finalize() {
    for (const [key, list] of this.pending) {
      const [mat, flag] = key.split('|');
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, material(mat));
      m.receiveShadow = true;
      m.castShadow = flag !== 'nocast';
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      this.group.add(m);
      for (const g of list) g.dispose();
    }
    this.pending.clear();
  }

  update(dt, t) {
    for (const mv of this.movers) mv.step(dt);
    for (const a of this.animated) a(dt, t);
    this._triggers();
  }

  render() { for (const mv of this.movers) mv.render(); }

  _triggers() {
    const p = this.game.player;
    if (!p) return;
    const pp = p.pos;
    for (const t of this.triggers) {
      if (!t.enabled || (t.once && t.fired)) continue;
      const inside = pp.x > t.min.x && pp.x < t.max.x && pp.y + 0.5 > t.min.y && pp.y < t.max.y && pp.z > t.min.z && pp.z < t.max.z;
      const was = t.inside.has('player');
      if (inside && !was) { t.inside.add('player'); t.fired = true; t.onEnter?.('player'); }
      else if (!inside && was) { t.inside.delete('player'); t.onExit?.('player'); }
      if (t.props) {
        for (const e of this.game.entities.list) {
          const q = e.curr.p;
          const ins = q.x > t.min.x && q.x < t.max.x && q.y > t.min.y && q.y < t.max.y && q.z > t.min.z && q.z < t.max.z;
          const w = t.inside.has(e);
          if (ins && !w) { t.inside.add(e); t.onEnter?.(e); if (t.once) t.fired = true; }
          else if (!ins && w) { t.inside.delete(e); t.onExit?.(e); }
        }
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); }
      if (o.isLight) { o.shadow?.map?.dispose(); o.dispose?.(); }
    });
    for (const t of this.textures) t.dispose();
    this.group.removeFromParent();
  }
}
