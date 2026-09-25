// Sky dome, sun + fill lights, fog, water and distant backdrop, driven by a theme preset.
import * as THREE from 'three';
import { mulberry } from '../ink/ink-system.js';
import { disposeTree } from '../engine/dispose.js';

export const THEMES = {
  docks: {
    skyTop: '#3f86e8', skyHorizon: '#ffd9ae', skyBottom: '#f7b58f', sunColor: '#fff0d2', sunIntensity: 1.92,
    sunDir: [-0.55, 0.62, -0.38], hemiSky: '#cfe8ff', hemiGround: '#b08a70', hemiIntensity: 0.78,
    fog: '#f2d2b6', fogNear: 90, fogFar: 380, water: '#1f9ad6', waterDeep: '#0b4b86', clouds: 0.55, stars: 0,
    bloom: 0.3, exposure: 1.0, backdrop: 'city', backdropTint: '#8fa6c8',
  },
  heights: {
    skyTop: '#27206e', skyHorizon: '#ff8fb2', skyBottom: '#ff9f7a', sunColor: '#ffc6a8', sunIntensity: 1.49,
    sunDir: [0.7, 0.32, -0.4], hemiSky: '#b7a8ff', hemiGround: '#a86a7a', hemiIntensity: 0.84,
    fog: '#d88aa8', fogNear: 80, fogFar: 340, water: '#3a6fd0', waterDeep: '#1a2f7a', clouds: 0.45, stars: 0.35,
    bloom: 0.55, exposure: 1.02, backdrop: 'neon', backdropTint: '#4b3a8e',
  },
  refinery: {
    skyTop: '#0b0d24', skyHorizon: '#2f6a5e', skyBottom: '#1b3c3a', sunColor: '#bfe8ff', sunIntensity: 1.05,
    sunDir: [0.3, 0.7, 0.35], hemiSky: '#7fb3c8', hemiGround: '#3b2f4a', hemiIntensity: 0.74,
    fog: '#1f3b3f', fogNear: 60, fogFar: 260, water: '#3b1f5c', waterDeep: '#140a24', clouds: 0.3, stars: 1,
    bloom: 0.75, exposure: 1.08, backdrop: 'industrial', backdropTint: '#2a3140',
  },
  tower: {
    skyTop: '#1c1830', skyHorizon: '#6b5a8e', skyBottom: '#3a3150', sunColor: '#d9ccff', sunIntensity: 1.24,
    sunDir: [-0.2, 0.8, 0.45], hemiSky: '#a79cd0', hemiGround: '#3b3348', hemiIntensity: 0.74,
    fog: '#4a4066', fogNear: 60, fogFar: 300, water: '#2b2440', waterDeep: '#100c1c', clouds: 0.85, stars: 0.2,
    bloom: 0.6, exposure: 1.05, backdrop: 'storm', backdropTint: '#2e2944', lightning: true,
  },
  arena: {
    skyTop: '#2f8ff0', skyHorizon: '#c9ecff', skyBottom: '#9fd7f5', sunColor: '#fffaf0', sunIntensity: 2.05,
    sunDir: [0.45, 0.78, 0.3], hemiSky: '#d6efff', hemiGround: '#a9a08a', hemiIntensity: 0.74,
    fog: '#cfe9f7', fogNear: 100, fogFar: 420, water: '#19a7d8', waterDeep: '#08568e', clouds: 0.5, stars: 0,
    bloom: 0.28, exposure: 1.0, backdrop: 'city', backdropTint: '#9bb7d6',
  },
  plaza: {
    skyTop: '#4a9af2', skyHorizon: '#e8f4ff', skyBottom: '#bfe2ff', sunColor: '#fff4dc', sunIntensity: 1.86,
    sunDir: [-0.35, 0.72, 0.4], hemiSky: '#dcefff', hemiGround: '#b59d86', hemiIntensity: 0.81,
    fog: '#dcecf7', fogNear: 90, fogFar: 380, water: '#1aa3dc', waterDeep: '#0a5690', clouds: 0.6, stars: 0,
    bloom: 0.3, exposure: 1.0, backdrop: 'city', backdropTint: '#a8bfdc',
  },
};

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */`
uniform vec3 top, horizon, bottom, sunColor, sunDir;
uniform float clouds, stars, time, flash;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.4));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 40.0) * 0.35 + pow(sd, 6.0) * 0.12);
  if (h > 0.0) {
    vec2 cp = d.xz / (h + 0.18) * 1.6 + vec2(time * 0.012, time * 0.004);
    float c = fbm(cp);
    float cm = smoothstep(0.52 - clouds * 0.25, 0.85, c) * smoothstep(0.0, 0.25, h);
    vec3 cloudCol = mix(horizon * 1.05 + 0.08, vec3(1.0), 0.55) + sunColor * pow(sd, 8.0) * 0.4;
    col = mix(col, cloudCol, cm * 0.85);
    float st = step(0.9985, hash(floor(d.xz / (h + 0.3) * 260.0))) * stars * smoothstep(0.1, 0.5, h) * (1.0 - cm);
    col += vec3(st);
  }
  col += vec3(0.8, 0.8, 1.0) * flash;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Environment {
  constructor(scene, renderer, themeKey = 'docks', opts = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.theme = { ...(THEMES[themeKey] || THEMES.docks), ...(opts.override || {}) };
    this.group = new THREE.Group();
    this.group.name = 'environment';
    scene.add(this.group);
    const T = this.theme;
    this.time = 0;
    this.lightningT = 4 + Math.random() * 6;
    this.flash = 0;

    // --- sky ---
    this.skyUniforms = {
      top: { value: new THREE.Color(T.skyTop) },
      horizon: { value: new THREE.Color(T.skyHorizon) },
      bottom: { value: new THREE.Color(T.skyBottom) },
      sunColor: { value: new THREE.Color(T.sunColor) },
      sunDir: { value: new THREE.Vector3(...T.sunDir).normalize() },
      clouds: { value: T.clouds },
      stars: { value: T.stars },
      time: { value: 0 },
      flash: { value: 0 },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(800, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.sky = sky;
    this.group.add(sky);

    // --- lights ---
    this.hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiIntensity);
    this.group.add(this.hemi);
    const sun = new THREE.DirectionalLight(T.sunColor, T.sunIntensity);
    sun.castShadow = true;
    const q = renderer.preset;
    sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const S = 42;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 260 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    this.sun = sun;
    this.sunDir = new THREE.Vector3(...T.sunDir).normalize();
    this.group.add(sun, sun.target);

    scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    scene.background = null;

    // --- reflections: PMREM of the sky dome ---
    const pm = new THREE.PMREMGenerator(renderer.gl);
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    this.envRT = pm.fromScene(envScene, 0.02);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.55;
    pm.dispose();

    renderer.gl.toneMappingExposure = T.exposure;
    renderer.setBloom(T.bloom * 0.8, T.bloom > 0.5 ? 1.05 : 1.35, 0.4);

    if (opts.water !== false) this._buildWater(opts.waterY ?? -2);
    if (opts.backdrop !== false) this._buildBackdrop(opts.bounds || new THREE.Box3(new THREE.Vector3(-60, 0, -60), new THREE.Vector3(60, 10, 60)));
  }

  _buildWater(y) {
    const T = this.theme;
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    const rnd = mulberry(99);
    const hf = new Float32Array(size * size);
    for (let k = 0; k < 18; k++) {
      const cx = rnd() * size, cy = rnd() * size, r = 4 + rnd() * 10, a = rnd() * 0.8 + 0.2;
      for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
        let dx = Math.abs(xx - cx); dx = Math.min(dx, size - dx);
        let dy = Math.abs(yy - cy); dy = Math.min(dy, size - dy);
        hf[yy * size + xx] += a * Math.exp(-(dx * dx + dy * dy) / (r * r));
      }
    }
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      const h = (i, j) => hf[((j + size) % size) * size + ((i + size) % size)];
      const dx = (h(xx + 1, yy) - h(xx - 1, yy)) * 1.4, dy = (h(xx, yy + 1) - h(xx, yy - 1)) * 1.4;
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (yy * size + xx) * 4;
      data[i] = (-dx * nz * 0.5 + 0.5) * 255; data[i + 1] = (-dy * nz * 0.5 + 0.5) * 255; data[i + 2] = (nz * 0.5 + 0.5) * 255; data[i + 3] = 255;
    }
    const nt = new THREE.DataTexture(data, size, size);
    nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
    nt.magFilter = THREE.LinearFilter; nt.minFilter = THREE.LinearMipmapLinearFilter; nt.generateMipmaps = true;
    nt.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ color: T.water, roughness: 0.08, metalness: 0.05, normalMap: nt, normalScale: new THREE.Vector2(0.55, 0.55), envMapIntensity: 1.2 });
    this.waterUniforms = { wTime: { value: 0 }, wDeep: { value: new THREE.Color(T.waterDeep) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.waterUniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float wTime;\nuniform vec3 wDeep;\nvarying vec3 vWPos;')
        .replace('#include <normal_fragment_maps>', `
          vec2 wuv = vWPos.xz * 0.045;
          vec3 n1 = texture2D(normalMap, wuv + vec2(wTime * 0.018, wTime * 0.011)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(normalMap, wuv * 1.9 - vec2(wTime * 0.013, -wTime * 0.021)).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(vec3((n1.xy + n2.xy) * normalScale, n1.z * n2.z));
          normal = normalize(tbn * mapN);`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float wd = clamp(length(vWPos.xz - cameraPosition.xz) / 260.0, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, wDeep, 0.35 + wd * 0.4);`);
    };
    const g = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    g.rotateX(-Math.PI / 2);
    // tangents for the normal map
    g.computeTangents?.();
    const water = new THREE.Mesh(g, mat);
    water.position.y = y;
    water.receiveShadow = true;
    water.name = 'water';
    this.water = water;
    this.group.add(water);
  }

  _buildBackdrop(bounds) {
    const T = this.theme;
    const rnd = mulberry(7 + T.backdrop.length);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const R = Math.max(size.x, size.z) * 0.5 + 150;
    const tint = new THREE.Color(T.backdropTint);
    const winTex = windowTexture(T.backdrop === 'neon' || T.backdrop === 'industrial' || T.stars > 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0.0, map: winTex.map, emissiveMap: winTex.emissive, emissive: new THREE.Color(T.backdrop === 'city' ? '#ffe1a8' : '#ffb0f0'), emissiveIntensity: T.stars > 0.3 ? 1.2 : 0.25, fog: true });
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const count = 90;
    const inst = new THREE.InstancedMesh(box, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.05;
      const r = R + rnd() * 90;
      const w = 12 + rnd() * 22, d = 12 + rnd() * 22;
      let h = 14 + rnd() * (T.backdrop === 'industrial' ? 30 : 55) + (rnd() < 0.12 ? 35 : 0);
      if (T.backdrop === 'storm') h *= 0.7;
      p.set(center.x + Math.cos(a) * r, -3, center.z + Math.sin(a) * r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + rnd() * 0.3);
      s.set(w, h, d);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      const c = tint.clone().offsetHSL((rnd() - 0.5) * 0.08, -0.15 + rnd() * 0.1, (rnd() - 0.5) * 0.18);
      inst.setColorAt(i, c);
    }
    inst.castShadow = false; inst.receiveShadow = false;
    this.group.add(inst);
    this.backdrop = inst;

    if (T.backdrop === 'industrial') {
      // chimneys with glowing tips
      const chim = new THREE.CylinderGeometry(3, 4.5, 70, 12);
      chim.translate(0, 35, 0);
      const cm = new THREE.MeshStandardMaterial({ color: '#2d2f3a', roughness: 0.8 });
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2, r = R + 30 + rnd() * 60;
        const c = new THREE.Mesh(chim, cm);
        c.position.set(center.x + Math.cos(a) * r, -3, center.z + Math.sin(a) * r);
        this.group.add(c);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: '#7dffb0' }));
        glow.position.copy(c.position).setY(68);
        this.group.add(glow);
      }
    }
    if (T.backdrop === 'city' || T.backdrop === 'neon') {
      // lighthouse / radio tower silhouette landmark
      const lh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 60, 16), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.7 }));
      body.position.y = 30;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 8, 16), new THREE.MeshStandardMaterial({ color: '#e24a4a', roughness: 0.6 }));
      band.position.y = 38;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3b0' }));
      lamp.position.y = 64;
      lh.add(body, band, lamp);
      lh.position.set(center.x - R * 0.7, -3, center.z - R * 0.75);
      this.group.add(lh);
      this.landmark = lh;
    }
  }

  /** Keep the shadow frustum centred on the action, snapped to texels to avoid shimmer. */
  follow(target) {
    const sun = this.sun;
    const S = sun.shadow.camera.right;
    const texel = (2 * S) / sun.shadow.mapSize.x;
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round(target.z / texel) * texel;
    sun.target.position.set(tx, target.y, tz);
    sun.position.set(tx, target.y, tz).addScaledVector(this.sunDir, 120);
  }

  update(dt) {
    this.time += dt;
    this.skyUniforms.time.value = this.time;
    if (this.waterUniforms) this.waterUniforms.wTime.value = this.time;
    if (this.theme.lightning) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) { this.flash = 1; this.lightningT = 5 + Math.random() * 9; this.onLightning?.(); }
      this.flash = Math.max(0, this.flash - dt * 3.5);
      this.skyUniforms.flash.value = this.flash * 0.6;
      this.hemi.intensity = this.theme.hemiIntensity + this.flash * 2.5;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.envRT?.dispose();
    disposeTree(this.group);
    this.scene.fog = null;
    this.scene.environment = null;
  }
}

function windowTexture(night) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const e = document.createElement('canvas');
  e.width = e.height = 256;
  const x = c.getContext('2d'), y = e.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
  y.fillStyle = '#000000'; y.fillRect(0, 0, 256, 256);
  const rnd = mulberry(night ? 3 : 4);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 8; i++) {
    const lit = rnd() < (night ? 0.45 : 0.18);
    x.fillStyle = lit ? '#d8d0c0' : '#6f7a8a';
    x.fillRect(i * 32 + 6, j * 16 + 4, 20, 9);
    if (lit) { y.fillStyle = '#ffffff'; y.fillRect(i * 32 + 6, j * 16 + 4, 20, 9); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const emissive = new THREE.CanvasTexture(e); emissive.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, emissive]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); }
  return { map, emissive };
}
