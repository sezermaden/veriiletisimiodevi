// WebGL renderer + post-processing chain with quality presets.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { settings } from './settings.js';

export const QUALITY = {
  low: { shadows: false, shadowSize: 1024, bloom: false, aa: 'fxaa', ao: false, maxAniso: 2 },
  medium: { shadows: true, shadowSize: 1024, bloom: true, aa: 'fxaa', ao: false, maxAniso: 4 },
  high: { shadows: true, shadowSize: 2048, bloom: true, aa: 'smaa', ao: false, maxAniso: 8 },
  ultra: { shadows: true, shadowSize: 4096, bloom: true, aa: 'smaa', ao: true, maxAniso: 16 },
};

/** Final grade in display space: saturation, contrast, vignette, damage tint and a subtle ink-wet sheen. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.12 },
    contrast: { value: 1.04 },
    vignette: { value: 0.28 },
    damage: { value: 0 },
    damageColor: { value: new THREE.Color('#6a2bd9') },
    flash: { value: 0 },
    flashColor: { value: new THREE.Color('#ffffff') },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation, contrast, vignette, damage, flash;
    uniform vec3 damageColor, flashColor;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5;
      float r = dot(d, d);
      c.rgb *= 1.0 - vignette * smoothstep(0.08, 0.5, r);
      float edge = smoothstep(0.12, 0.42, r);
      c.rgb = mix(c.rgb, damageColor * 0.55 + c.rgb * 0.25, damage * edge);
      c.rgb = mix(c.rgb, flashColor, flash);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }`,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
    });
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl = gl;
    this.maxAniso = gl.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 900);
    this.composer = null;
    this.quality = null;
    this.width = 1;
    this.height = 1;

    this.grade = null;
    this._buildComposer();
    this.resize();
    addEventListener('resize', () => this.resize());
    settings.onChange((p) => {
      if (p === 'video.quality' || p === 'video.renderScale' || p === '*') { this._buildComposer(); this.resize(); }
      if (p === 'video.fov') this.camera.fov = settings.get('video.fov');
    });
  }

  get preset() { return QUALITY[settings.get('video.quality')] || QUALITY.high; }

  _buildComposer() {
    const q = this.preset;
    this.quality = q;
    this.gl.shadowMap.enabled = q.shadows;
    this.gl.shadowMap.needsUpdate = true;
    if (this.composer) this.composer.dispose?.();

    const size = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, samples: 0 });
    const composer = new EffectComposer(this.gl, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(this.renderPass);

    this.aoPass = null;
    if (q.ao) {
      this.aoPass = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.aoPass.output = GTAOPass.OUTPUT.Default;
      this.aoPass.blendIntensity = 0.75;
      composer.addPass(this.aoPass);
    }

    this.bloomPass = null;
    if (q.bloom) {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.45, 0.88);
      composer.addPass(this.bloomPass);
    }

    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    if (q.aa === 'smaa') composer.addPass(new SMAAPass());
    else composer.addPass(new FXAAPass());

    this.composer = composer;
  }

  setScene(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.camera.fov = settings.get('video.fov');
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    if (this.aoPass) { this.aoPass.scene = scene; this.aoPass.camera = camera; }
    this.resize();
  }

  resize() {
    const scale = Math.max(0.5, Math.min(1.5, settings.get('video.renderScale') || 1));
    // dpr capped at 1: a 150% Windows desktop would otherwise render 2.25x the pixels for nothing
    const dpr = Math.min(devicePixelRatio || 1, 1) * scale;
    const w = Math.max(1, innerWidth);
    const h = Math.max(1, innerHeight);
    this.width = w; this.height = h;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Called by world code that wants a stronger or weaker bloom (e.g. night stages). */
  setBloom(strength = 0.32, threshold = 0.88, radius = 0.45) {
    if (!this.bloomPass) return;
    this.bloomPass.strength = strength;
    this.bloomPass.threshold = threshold;
    this.bloomPass.radius = radius;
  }

  render() {
    this.composer.render();
  }
}
