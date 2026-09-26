// Free GPU resources of an object tree. Geometries/materials/textures flagged
// `userData.cached = true` are shared across sessions (module caches) and are kept.
const TEX_KEYS = ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap', 'envMap', 'lightMap', 'displacementMap', 'specularMap', 'gradientMap', 'clearcoatNormalMap'];

export function disposeMaterial(m) {
  if (!m || m.userData?.cached) return;
  for (const k of TEX_KEYS) {
    const t = m[k];
    if (t && t.isTexture && !t.userData?.cached) t.dispose();
  }
  if (m.uniforms) for (const u of Object.values(m.uniforms)) { const t = u?.value; if (t && t.isTexture && !t.userData?.cached && !t.isRenderTargetTexture) t.dispose(); }
  m.dispose();
}

export function disposeTree(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.cached) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(disposeMaterial);
  });
}

/** Mark a geometry/material/texture as shared so disposeTree keeps it. */
export function cached(x) { x.userData = x.userData || {}; x.userData.cached = true; return x; }
