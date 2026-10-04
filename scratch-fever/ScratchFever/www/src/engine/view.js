/* =========================================================
   Renderer, camera, lighting and post-processing.

   devicePixelRatio is capped at 1: on a Windows desktop at 150%
   scaling dpr is 1.5 and a higher cap renders 2.25x the pixels
   the screen can show. Resolution is a player setting instead
   (Options > Render scale).
   ========================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderScale = 1;
    this.bloomEnabled = true;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x07130e, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07130e);
    this.scene.fog = new THREE.Fog(0x07130e, 18, 42);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 6.9, 5.6);
    this.camera.lookAt(0, 0.1, -0.2);

    // ---- lights: a warm kiosk lamp over the ticket, cool fill from the room
    this.hemi = new THREE.HemisphereLight(0x9fd6c8, 0x0a1a12, 0.55);
    this.scene.add(this.hemi);

    this.lamp = new THREE.SpotLight(0xffe2a8, 60, 30, Math.PI / 5, 0.55, 1.4);
    this.lamp.position.set(1.5, 8.5, 2.5);
    this.lamp.target.position.set(0, 0, 0);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(1024, 1024);
    this.lamp.shadow.bias = -0.0008;
    this.lamp.shadow.normalBias = 0.02;
    this.scene.add(this.lamp);
    this.scene.add(this.lamp.target);

    this.rim = new THREE.DirectionalLight(0xff4fd8, 0.6);
    this.rim.position.set(-6, 4, -6);
    this.scene.add(this.rim);

    this.fill = new THREE.DirectionalLight(0x5ad7e6, 0.35);
    this.fill.position.set(6, 3, -4);
    this.scene.add(this.fill);

    // ---- post
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.7, 0.82);
    this.composer.addPass(this.bloom);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.shakeVec = new THREE.Vector3();
    this.basePos = this.camera.position.clone();
    this.lookAt = new THREE.Vector3(0, 0.1, -0.2);
    this.orbit = { x: 0, y: 0 };      // gentle camera drift driven by the cursor

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.contextLost = false; this.resize(); });

    this.resize();
  }

  setRenderScale(s) {
    this.renderScale = Math.max(0.5, Math.min(1, s));
    this.resize();
  }

  setBloom(on) { this.bloomEnabled = !!on; }

  resize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this.camera.aspect = w / h;
    // keep the ticket framed on tall / ultrawide windows
    const ref = 16 / 9;
    const fovBase = 38;
    this.camera.fov = this.camera.aspect < ref
      ? 2 * Math.atan(Math.tan((fovBase * Math.PI / 180) / 2) * (ref / this.camera.aspect)) * 180 / Math.PI
      : fovBase;
    this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, 1) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.setSize(w * dpr, h * dpr);
  }

  /** Camera easing: drift toward the cursor, shake on wins. */
  updateCamera(dt, driftX = 0, driftY = 0, shake = 0) {
    const k = 1 - Math.exp(-dt * 4);
    this.orbit.x += (driftX - this.orbit.x) * k;
    this.orbit.y += (driftY - this.orbit.y) * k;
    let sx = 0, sy = 0, sz = 0;
    if (shake > 0.001) {
      const m = shake * 0.35;
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m * 0.7;
      sz = (Math.random() - 0.5) * m;
    }
    this.camera.position.set(
      this.basePos.x + this.orbit.x * 0.55 + sx,
      this.basePos.y + sy,
      this.basePos.z + this.orbit.y * 0.35 + sz,
    );
    this.camera.lookAt(this.lookAt.x + this.orbit.x * 0.2 + sx * 0.3, this.lookAt.y, this.lookAt.z + this.orbit.y * 0.1);
  }

  /** Ray from a screen point. */
  raycaster(sx, sy, out = new THREE.Raycaster()) {
    const w = window.innerWidth, h = window.innerHeight;
    const ndc = new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1);
    out.setFromCamera(ndc, this.camera);
    return out;
  }

  render() {
    if (this.contextLost) return;
    if (this.bloomEnabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
