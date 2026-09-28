/* Renderer, post-processing and lighting rig.

   Pipeline: world RenderPass -> (GTAO) -> viewmodel RenderPass (depth cleared, so guns never
   clip into walls) -> bloom -> OutputPass (tone mapping + sRGB). MSAA comes from the composer's
   multisampled target, so no FXAA blur on the dev-texture grid lines. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { settings } from '../core/settings.js';
import { TEX, setAnisotropy } from './textures.js';

export const QUALITY = {
  low: { shadowSize: 1024, shadowRadius: 1, samples: 0, bloom: false, ao: false, maxLights: 4, particles: 0.5, anisotropy: 2, shadowDistance: 40 },
  medium: { shadowSize: 2048, shadowRadius: 2, samples: 2, bloom: true, ao: false, maxLights: 8, particles: 0.8, anisotropy: 4, shadowDistance: 55 },
  high: { shadowSize: 2048, shadowRadius: 3, samples: 4, bloom: true, ao: false, maxLights: 12, particles: 1, anisotropy: 8, shadowDistance: 70 },
  ultra: { shadowSize: 4096, shadowRadius: 4, samples: 4, bloom: true, ao: true, maxLights: 16, particles: 1, anisotropy: 16, shadowDistance: 90 },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setAnisotropy(Math.min(this.renderer.capabilities.getMaxAnisotropy(), QUALITY[settings.quality]?.anisotropy ?? 8));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(settings.fov, 16 / 9, 0.05, 2000);
    this.scene.add(this.camera);

    // Viewmodel layer: its own scene + camera so weapons render on top with a fixed FOV.
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(62, 16 / 9, 0.01, 10);
    this.vmScene.add(this.vmCamera);
    this.vmAmbient = new THREE.HemisphereLight(0xdfe8ff, 0x40362c, 1.2);
    this.vmSun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.vmSun.position.set(0.4, 1, 0.3);
    this.vmScene.add(this.vmAmbient, this.vmSun);

    // World lights (a map configures them in setEnvironment).
    this.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a4d3c, 0.8);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sunOffset = new THREE.Vector3(40, 70, 25);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.sky = null;
    this.clouds = null;
    this.shake = 0;
    this.shakeOffset = new THREE.Vector3();
    this.flash = 0;

    this._buildComposer();
    this.applySettings();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  _buildComposer() {
    const q = QUALITY[settings.quality] || QUALITY.high;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: q.samples });
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, rt);
    this.worldPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.worldPass);
    this.aoPass = null;
    if (q.ao && settings.ao !== false) {
      this.aoPass = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.aoPass.output = GTAOPass.OUTPUT.Default;
      this.aoPass.blendIntensity = 0.8;
      this.composer.addPass(this.aoPass);
    }
    this.vmPass = new RenderPass(this.vmScene, this.vmCamera);
    this.vmPass.clear = false;
    this.vmPass.clearDepth = true;
    this.composer.addPass(this.vmPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.5, 0.92);
    this.bloomPass.enabled = q.bloom && settings.bloom;
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  applySettings() {
    const q = QUALITY[settings.quality] || QUALITY.high;
    this.q = q;
    this.renderer.shadowMap.enabled = !!settings.shadows;
    this.sun.castShadow = !!settings.shadows;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    this.sun.shadow.radius = q.shadowRadius;
    const d = q.shadowDistance / 2;
    const sc = this.sun.shadow.camera;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 1; sc.far = 260;
    sc.updateProjectionMatrix();
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.camera.fov = settings.fov;
    this.camera.updateProjectionMatrix();
    this._buildComposer();
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    // Cap at 1: a 150% Windows desktop would otherwise render 2.25x the pixels for nothing.
    const pr = Math.min(devicePixelRatio || 1, 1) * (settings.renderScale || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.camera.aspect = this.vmCamera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCamera.updateProjectionMatrix();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
  }

  /** Configure sky, fog and light for a map. */
  setEnvironment(env) {
    const s = this.scene;
    if (this.sky) { s.remove(this.sky); this.sky.material.dispose(); this.sky = null; }
    if (this.clouds) { s.remove(this.clouds); this.clouds.geometry.dispose(); this.clouds.material.dispose(); this.clouds = null; }
    s.environment?.dispose?.();
    s.background = null;

    this.hemi.color.set(env.hemiSky ?? 0xcfe3ff);
    this.hemi.groundColor.set(env.hemiGround ?? 0x5a4d3c);
    this.hemi.intensity = env.hemiIntensity ?? 0.8;
    this.sun.color.set(env.sunColor ?? 0xfff1dc);
    this.sun.intensity = env.sunIntensity ?? 3.2;
    this.sunOffset.copy(env.sunDir ? new THREE.Vector3(...env.sunDir).normalize().multiplyScalar(90) : new THREE.Vector3(40, 70, 25));
    this.renderer.toneMappingExposure = env.exposure ?? 1;
    this.vmAmbient.intensity = env.vmAmbient ?? 1.2;
    this.vmSun.intensity = env.vmSun ?? 2;

    if (env.sky) {
      const sunDir = this.sunOffset.clone().normalize();
      const sky = makeSkyDome(env, sunDir, 1500);
      this.sky = sky;
      s.add(sky);
      // Cloud dome: a big inverted hemisphere with the painted cloud layer.
      const g = new THREE.SphereGeometry(1800, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ map: TEX.clouds.map, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, opacity: env.cloudOpacity ?? 0.85, color: new THREE.Color(env.cloudTint ?? 0xffffff) });
      m.map.repeat.set(3, 1);
      this.clouds = new THREE.Mesh(g, m);
      this.clouds.renderOrder = -1;
      s.add(this.clouds);
      // Environment reflections from a dimmer copy of the same dome (keeps PBR in range).
      const envScene = new THREE.Scene();
      envScene.add(makeSkyDome({ ...env, envPass: true }, sunDir, 100));
      s.environment = this.pmrem.fromScene(envScene, 0.02).texture;
    } else {
      s.background = new THREE.Color(env.background ?? 0x0b0c10);
      const room = new RoomEnvironment();
      s.environment = this.pmrem.fromScene(room, 0.04).texture;
      room.dispose?.();
    }
    s.environmentIntensity = env.envIntensity ?? 0.8;
    this.vmScene.environment = s.environment;
    this.vmScene.environmentIntensity = (env.envIntensity ?? 0.8) * 0.5;
    s.fog = env.fog ? new THREE.FogExp2(env.fog.color, env.fog.density) : null;
    if (this.bloomPass) {
      this.bloomPass.strength = env.bloom ?? 0.55;
      this.bloomPass.threshold = env.bloomThreshold ?? 0.92;
    }
  }

  addShake(amount) { this.shake = Math.min(1.5, this.shake + amount); }

  render(dt, focus) {
    // Shadow camera follows the player, snapped to texel size so shadows do not swim.
    if (focus && this.sun.castShadow) {
      const texel = (this.q.shadowDistance) / this.q.shadowSize;
      const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
      this.sun.target.position.set(fx, focus.y, fz);
      this.sun.position.set(fx + this.sunOffset.x, focus.y + this.sunOffset.y, fz + this.sunOffset.z);
    }
    if (this.clouds) { this.clouds.material.map.offset.x += dt * 0.0015; this.clouds.position.set(this.camera.position.x, 0, this.camera.position.z); }
    if (this.sky) this.sky.position.copy(this.camera.position);

    // Screen shake: decaying random offset applied to the camera for this frame only.
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const k = this.shake * this.shake * 0.12;
    this.shakeOffset.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0);
    this.camera.position.add(this.shakeOffset);
    this.camera.updateMatrixWorld();
    this.composer.render(dt);
    this.camera.position.sub(this.shakeOffset);
  }
}

/** Gradient sky dome with a sun disc and halo. `envPass` renders a dimmer version for PMREM. */
function makeSkyDome(env, sunDir, radius) {
  const top = new THREE.Color(env.skyTop ?? 0x3f7fd0);
  const horizon = new THREE.Color(env.skyHorizon ?? 0xc9dff2);
  const bottom = new THREE.Color(env.skyBottom ?? 0x8c9aa6);
  const sun = new THREE.Color(env.sunColor ?? 0xfff1dc);
  const k = env.envPass ? 0.9 : 1;
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: top.multiplyScalar(k) }, horizon: { value: horizon.multiplyScalar(k) }, bottom: { value: bottom.multiplyScalar(k) }, sunDir: { value: sunDir.clone() }, sunCol: { value: sun }, sunI: { value: env.envPass ? 6 : 14 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }',
    fragmentShader: `uniform vec3 top, horizon, bottom, sunDir, sunCol; uniform float sunI; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h,0.0,1.0), 0.4));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        c += sunCol * (pow(sd, 900.0) * sunI + pow(sd, 12.0) * 0.35 + pow(sd, 3.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  m.frustumCulled = false;
  m.renderOrder = -2;
  return m;
}
