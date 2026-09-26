// Shared character material helpers: stylised PBR with a rim light so characters pop off the set.
import * as THREE from 'three';

/**
 * Stylised standard material. `rim` adds a fresnel edge light (colour, strength).
 * `ink: true` makes it glossy like fresh ink.
 */
export function charMat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.ink ? 0.18 : (opts.roughness ?? 0.62),
    metalness: opts.metalness ?? 0.0,
    emissive: opts.emissive ?? (opts.ink ? color : '#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? (opts.ink ? 0.12 : 0),
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    envMapIntensity: opts.ink ? 1.3 : 0.8,
  });
  const rimColor = new THREE.Color(opts.rimColor ?? '#ffffff');
  const rimStrength = opts.rim ?? 0.35;
  m.userData.rim = { value: rimStrength };
  m.userData.rimColor = { value: rimColor };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimStrength = m.userData.rim;
    sh.uniforms.rimColor = m.userData.rimColor;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float rimStrength;\nuniform vec3 rimColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          totalEmissiveRadiance += rimColor * pow(fr, 3.0) * rimStrength;
        }`);
  };
  m.customProgramCacheKey = () => 'inktide-char-rim';
  return m;
}

/** Glossy ink material that can be recoloured at runtime. */
export function inkMat(color) {
  return charMat(color, { ink: true, rim: 0.45 });
}

export function setMatColor(m, color) {
  m.color.set(color);
  if (m.emissiveIntensity > 0 && m.roughness < 0.3) m.emissive.set(color);
}
