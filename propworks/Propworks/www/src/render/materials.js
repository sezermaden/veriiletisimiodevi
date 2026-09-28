/* Material library. A material key carries both the look (three.js material) and the
   physics/sound identity of a surface: friction, bounciness, density and which impact /
   footstep sound it makes. The Material tool swaps these keys on props at runtime. */
import * as THREE from 'three';
import { TEX } from './textures.js';

export const SURFACES = {
  concrete: { friction: 0.8, restitution: 0.1, density: 2.2 },
  metal: { friction: 0.5, restitution: 0.15, density: 3.5 },
  wood: { friction: 0.7, restitution: 0.2, density: 0.7 },
  plastic: { friction: 0.6, restitution: 0.35, density: 0.6 },
  rubber: { friction: 1.2, restitution: 0.75, density: 0.9 },
  glass: { friction: 0.3, restitution: 0.1, density: 2.4 },
  flesh: { friction: 0.8, restitution: 0.05, density: 1 },
  grass: { friction: 0.9, restitution: 0.05, density: 1.5 },
  ice: { friction: 0.02, restitution: 0.05, density: 0.9 },
};

/** name -> { make(): THREE.Material, surface, label, uv: metres per texture repeat } */
const DEFS = {
  devOrange: { label: 'Dev Orange', surface: 'concrete', uv: 2, make: () => std({ map: TEX.devOrange.map, roughness: 0.82 }) },
  devGrey: { label: 'Dev Grey', surface: 'concrete', uv: 2, make: () => std({ map: TEX.devGrey.map, roughness: 0.85 }) },
  devLight: { label: 'Dev Light', surface: 'concrete', uv: 1, make: () => std({ map: TEX.devLight.map, roughness: 0.85 }) },
  devDark: { label: 'Dev Dark', surface: 'concrete', uv: 4, make: () => std({ map: TEX.devDark.map, roughness: 0.8 }) },
  devBlue: { label: 'Dev Blue', surface: 'concrete', uv: 2, make: () => std({ map: TEX.devBlue.map, roughness: 0.8 }) },
  concrete: { label: 'Concrete', surface: 'concrete', uv: 3, make: () => std({ ...TEX.concrete, roughness: 0.92, normalScale: 0.8 }) },
  concreteDark: { label: 'Dark Concrete', surface: 'concrete', uv: 3, make: () => std({ ...TEX.concreteDark, roughness: 0.9, normalScale: 0.8 }) },
  concreteWarm: { label: 'Plaster', surface: 'concrete', uv: 3, make: () => std({ ...TEX.concreteWarm, roughness: 0.95, normalScale: 0.5 }) },
  tiles: { label: 'Tiles', surface: 'concrete', uv: 1.5, make: () => std({ ...TEX.tiles, roughness: 0.35, normalScale: 0.9 }) },
  floorTiles: { label: 'Floor Tiles', surface: 'concrete', uv: 2, make: () => std({ ...TEX.floorTiles, roughness: 0.55, normalScale: 0.9 }) },
  bricks: { label: 'Bricks', surface: 'concrete', uv: 2.5, make: () => std({ ...TEX.bricks, roughness: 0.9, normalScale: 1.2 }) },
  metal: { label: 'Metal', surface: 'metal', uv: 2, make: () => std({ ...TEX.metal, roughness: 0.42, metalness: 0.75, normalScale: 0.8 }) },
  metalDark: { label: 'Dark Metal', surface: 'metal', uv: 2, make: () => std({ ...TEX.metalDark, roughness: 0.5, metalness: 0.7, normalScale: 0.8 }) },
  rust: { label: 'Rusty Metal', surface: 'metal', uv: 2, make: () => std({ ...TEX.metalRust, roughness: 0.85, metalness: 0.35, normalScale: 1.2 }) },
  diamond: { label: 'Diamond Plate', surface: 'metal', uv: 1.5, make: () => std({ ...TEX.diamond, roughness: 0.38, metalness: 0.85, normalScale: 1.4 }) },
  ceiling: { label: 'Ceiling', surface: 'metal', uv: 2, make: () => std({ ...TEX.ceiling, roughness: 0.6, metalness: 0.2 }) },
  wood: { label: 'Wood', surface: 'wood', uv: 1.5, make: () => std({ ...TEX.wood, roughness: 0.75, normalScale: 0.6 }) },
  woodDark: { label: 'Dark Wood', surface: 'wood', uv: 1.5, make: () => std({ ...TEX.woodDark, roughness: 0.7, normalScale: 0.6 }) },
  crate: { label: 'Crate', surface: 'wood', uv: 0, make: () => std({ ...TEX.crate, roughness: 0.8, normalScale: 1 }) },
  grass: { label: 'Grass', surface: 'grass', uv: 4, make: () => std({ ...TEX.grass, roughness: 1, normalScale: 0.6 }) },
  dirt: { label: 'Dirt', surface: 'grass', uv: 4, make: () => std({ ...TEX.dirt, roughness: 1, normalScale: 0.8 }) },
  sand: { label: 'Sand', surface: 'grass', uv: 5, make: () => std({ ...TEX.sand, roughness: 1, normalScale: 0.5 }) },
  hazard: { label: 'Hazard', surface: 'metal', uv: 1, make: () => std({ map: TEX.hazard.map, roughness: 0.6, metalness: 0.2 }) },
  barrel: { label: 'Red Barrel', surface: 'metal', uv: 0, make: () => std({ map: TEX.barrel.map, roughness: 0.5, metalness: 0.4 }) },
  barrelBlue: { label: 'Blue Barrel', surface: 'metal', uv: 0, make: () => std({ map: TEX.barrelBlue.map, roughness: 0.5, metalness: 0.4 }) },
  barrelGrey: { label: 'Grey Barrel', surface: 'metal', uv: 0, make: () => std({ map: TEX.barrelGrey.map, roughness: 0.55, metalness: 0.4 }) },
  checker: { label: 'Missing Texture', surface: 'plastic', uv: 1, make: () => std({ map: TEX.checker.map, roughness: 0.6, emissive: '#ffffff', emissiveMap: TEX.checker.map, emissiveIntensity: 0.35 }) },
  chrome: { label: 'Chrome', surface: 'metal', uv: 0, make: () => std({ color: '#ffffff', roughness: 0.06, metalness: 1 }) },
  gold: { label: 'Gold', surface: 'metal', uv: 0, make: () => std({ color: '#ffcc55', roughness: 0.2, metalness: 1 }) },
  glass: { label: 'Glass', surface: 'glass', uv: 0, make: () => new THREE.MeshStandardMaterial({ color: '#bfe3ff', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.28, envMapIntensity: 1.6, depthWrite: false }) },
  plastic: { label: 'Plastic', surface: 'plastic', uv: 0, make: () => std({ color: '#e8e8e8', roughness: 0.35 }) },
  rubber: { label: 'Rubber', surface: 'rubber', uv: 0, make: () => std({ color: '#26282b', roughness: 0.95 }) },
  ice: { label: 'Ice', surface: 'ice', uv: 0, make: () => new THREE.MeshStandardMaterial({ color: '#d8f2ff', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.8, envMapIntensity: 1.5 }) },
  white: { label: 'Matte White', surface: 'plastic', uv: 0, make: () => std({ color: '#f2f2f2', roughness: 0.8 }) },
  black: { label: 'Matte Black', surface: 'plastic', uv: 0, make: () => std({ color: '#1a1a1a', roughness: 0.8 }) },
  lightPanel: { label: 'Light', surface: 'plastic', uv: 0, make: () => std({ map: TEX.lightPanel.map, emissive: '#ffffff', emissiveMap: TEX.lightPanel.map, emissiveIntensity: 2.2, roughness: 0.4 }) },
  glow: { label: 'Glow', surface: 'plastic', uv: 0, make: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 3) }) },
};

function std(o) {
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? '#ffffff', map: o.map ?? null, normalMap: o.normal ?? null,
    roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0,
    emissive: o.emissive ?? '#000000', emissiveMap: o.emissiveMap ?? null, emissiveIntensity: o.emissiveIntensity ?? 1,
  });
  if (m.normalMap) m.normalScale.setScalar(o.normalScale ?? 1);
  return m;
}

const cache = new Map();

/** Shared material for a key (level geometry, most props). Never mutate the result. */
export function material(key) {
  if (!cache.has(key)) {
    const def = DEFS[key] || DEFS.devGrey;
    const m = def.make();
    m.userData.key = key;
    cache.set(key, m);
  }
  return cache.get(key);
}

/** A private copy, for props that get tinted or dissolved. */
export function materialInstance(key, color = null) {
  const m = material(key).clone();
  m.userData.key = key;
  if (color) m.color = new THREE.Color(color);
  return m;
}

export function surfaceOf(key) { return (DEFS[key] || DEFS.devGrey).surface; }
export function uvScaleOf(key) { return (DEFS[key] || DEFS.devGrey).uv; }
export function materialLabel(key) { return (DEFS[key] || {}).label || key; }
export const MATERIAL_KEYS = Object.keys(DEFS);
export const PAINTABLE_MATERIALS = ['devOrange', 'devGrey', 'devBlue', 'concrete', 'bricks', 'metal', 'diamond', 'rust', 'wood', 'woodDark', 'crate', 'tiles', 'chrome', 'gold', 'glass', 'plastic', 'rubber', 'ice', 'checker', 'hazard', 'white', 'black'];

/* --------------------------------------------------------------------------
   Shader patches. Both ride on MeshStandardMaterial via onBeforeCompile so props keep
   full PBR lighting and shadows.
   -------------------------------------------------------------------------- */

/** Dissolve: fragments below a noise threshold are discarded, the edge glows cyan.
    Used by the Remover and by deaths of corrupted enemies. */
export function makeDissolve(mat, color = new THREE.Color(0.3, 1.2, 3.0)) {
  const u = { uDissolve: { value: 0 }, uEdgeColor: { value: color } };
  mat.userData.dissolve = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDisPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDisPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDisPos; uniform float uDissolve; uniform vec3 uEdgeColor;
        float dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        float dn(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float dnv = dn(vDisPos * 6.0) * 0.7 + dn(vDisPos * 17.0) * 0.3;
        if (dnv < uDissolve) discard;
        if (uDissolve > 0.0 && dnv < uDissolve + 0.06) gl_FragColor.rgb = uEdgeColor;`);
  };
  mat.customProgramCacheKey = () => 'dissolve';
  mat.needsUpdate = true;
  return u;
}

/** Glitch: vertices snap and jitter in bands, colours flicker between checker states. */
export function makeGlitch(mat, strength = 0.05) {
  const u = { uTime: { value: 0 }, uGlitch: { value: strength } };
  mat.userData.glitch = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGlitch;\nfloat gh(float n){return fract(sin(n)*43758.5453);}')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float band = floor(position.y * 7.0 + floor(uTime * 12.0));
        float g = step(0.82, gh(band + floor(uTime * 9.0)));
        transformed.x += (gh(band * 3.1 + uTime) - 0.5) * uGlitch * 6.0 * g;
        transformed.z += (gh(band * 5.7 - uTime) - 0.5) * uGlitch * 3.0 * g;
        transformed = mix(transformed, floor(transformed * 18.0) / 18.0, g * 0.6);`);
  };
  mat.customProgramCacheKey = () => 'glitch';
  mat.needsUpdate = true;
  return u;
}
