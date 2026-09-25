// Turf Clash map (hold Map: Tab / View). The arena is rendered with an orthographic top camera into
// a render target every 0.25 s (only the level geometry + its ink, lit by a flat map light rig),
// read back into a 2D canvas and shown in a HUD panel. A second canvas draws markers every frame:
// you (arrow), teammates, rivals only while someone on your team can see them, and super-jump
// beacons. With the map open, D-pad / arrows pick a teammate or the base and Interact / A jumps.
import * as THREE from 'three';

const BASE_OPT = Object.freeze({ kind: 'base', label: 'BASE' });

export class MapView {
  constructor(session, mode) {
    this.S = session;
    this.mode = mode;
    this.open = false;
    this.refreshT = 0;
    this.sel = -1;                 // index into options()
    const b = session.level.bounds;
    const def = session.level.def;
    // arena extents from the walkable floors (ignore tall props / deep piles)
    this.minX = b.min.x; this.maxX = b.max.x; this.minZ = b.min.z; this.maxZ = b.max.z;
    const m = 2.5;
    const sx = this.maxX - this.minX + m * 2, sz = this.maxZ - this.minZ + m * 2;
    this.cx = (this.minX + this.maxX) / 2; this.cz = (this.minZ + this.maxZ) / 2;
    this.sx = sx; this.sz = sz;
    // canvas: width ↔ z extent, height ↔ x extent (Alpha base at the bottom)
    this.H = 560;
    this.W = Math.max(200, Math.round(this.H * (sz / sx)));
    this.cam = new THREE.OrthographicCamera(-sz / 2, sz / 2, sx / 2, -sx / 2, 0.5, 200);
    this.cam.up.set(1, 0, 0);
    this.cam.position.set(this.cx, b.max.y + 40, this.cz);
    this.cam.lookAt(this.cx, 0, this.cz);
    this.cam.updateMatrixWorld();

    this.rt = new THREE.WebGLRenderTarget(this.W, this.H, { depthBuffer: true });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.buf = new Uint8Array(this.W * this.H * 4);

    // map scene: flat top light + a water plane; the level group is borrowed while rendering
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1030');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a8fb0', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.position.set(-8, 30, 12);
    this.scene.add(sun, sun.target);
    if (def.water !== false) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(sz + 40, sx + 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b4f8f' }));
      w.position.set(this.cx, (def.waterY ?? -2), this.cz);
      this.water = w;
      this.scene.add(w);
    }

    // DOM
    const el = this.el = document.createElement('div');
    el.className = 'turf-map hidden';
    el.innerHTML = `
      <div class="tm-card">
        <div class="tm-head"><span class="tm-title">MAP</span></div>
        <div class="tm-frame">
          <canvas class="tm-img" width="${this.W}" height="${this.H}"></canvas>
          <canvas class="tm-marks" width="${this.W}" height="${this.H}"></canvas>
        </div>
        <div class="tm-foot"></div>
        <div class="tm-help"></div>
      </div>`;
    (document.getElementById('hud-root') || document.body).appendChild(el);
    this.img = el.querySelector('.tm-img').getContext('2d');
    this.marks = el.querySelector('.tm-marks').getContext('2d');
    this.help = el.querySelector('.tm-help');
    this.foot = el.querySelector('.tm-foot');
    this.imageData = this.img.createImageData(this.W, this.H);
    this.rendered = false;
    // per-frame scratch (drawMarks runs every frame while the map is open)
    this._P = { x: 0, y: 0 };
    this.teamCss = {};
    for (const t of [1, 2]) this.teamCss[t] = `#${session.ink.color(t).getHexString()}`;
    this._opts = [];
  }

  /** World (x, z) → canvas pixels. */
  toPx(x, z, out) {
    out.x = ((z - this.cz) / this.sz + 0.5) * this.W;
    out.y = (0.5 - (x - this.cx) / this.sx) * this.H;
    return out;
  }

  setOpen(v) {
    if (v === this.open) return;
    this.open = v;
    this.el.classList.toggle('hidden', !v);
    this.S.audio?.sfx('turf_map', { open: v, volume: 0.5 });
    if (v) { this.refreshT = 0; this.sel = -1; this._pad = undefined; this._footSel = undefined; }
  }

  /** Super-jump destinations: base first, then living teammates. */
  options() {
    const out = this._opts;
    out.length = 0;
    out.push(BASE_OPT);
    for (const a of this.mode.teamOf(this.S.player.team)) {
      if (a === this.S.player || !a.alive || a.flying) continue;
      const o = a._mapOpt || (a._mapOpt = { kind: 'mate', actor: a, label: a.name });
      out.push(o);
    }
    return out;
  }

  moveSel(dir) {
    const opts = this.options();
    if (!opts.length) return;
    this.sel = this.sel < 0 ? (dir > 0 ? Math.min(1, opts.length - 1) : 0) : (this.sel + dir + opts.length) % opts.length;
    this.S.audio?.sfx('turf_select', { volume: 0.4 });
  }

  selected() {
    const opts = this.options();
    return this.sel >= 0 && this.sel < opts.length ? opts[this.sel] : null;
  }

  update(dt) {
    if (!this.open) return;
    this.refreshT -= dt;
    if (this.refreshT <= 0) { this.refreshT = 0.25; this.renderMap(); }
    this.drawMarks();
    const input = this.S.input;
    const pad = input.lastDevice === 'gamepad';
    if (this._pad !== pad) { this._pad = pad; this.help.textContent = pad ? 'D-Pad choose · A jump' : '←/→ choose · E jump'; }
    const s = this.selected();
    if (this._footSel !== s) {
      this._footSel = s;
      this.foot.textContent = s ? `SUPER JUMP → ${s.label}` : 'SUPER JUMP';
      this.foot.classList.toggle('armed', !!s);
    }
  }

  renderMap() {
    const S = this.S, r = S.renderer.gl, level = S.level;
    const parent = level.group.parent;
    this.scene.add(level.group);
    const prevRT = r.getRenderTarget();
    const prevAuto = r.autoClear;
    const prevShadow = r.shadowMap.autoUpdate;
    r.autoClear = true;
    r.shadowMap.autoUpdate = false;
    try {
      r.setRenderTarget(this.rt);
      r.clear();
      r.render(this.scene, this.cam);
      r.readRenderTargetPixels(this.rt, 0, 0, this.W, this.H, this.buf);
    } finally {
      r.setRenderTarget(prevRT);
      r.autoClear = prevAuto;
      r.shadowMap.autoUpdate = prevShadow;
      parent?.add(level.group);
    }
    // flip Y into the canvas
    const W = this.W, H = this.H, src = this.buf, dst = this.imageData.data;
    for (let y = 0; y < H; y++) {
      const so = (H - 1 - y) * W * 4, d0 = y * W * 4;
      dst.set(src.subarray(so, so + W * 4), d0);
    }
    this.img.putImageData(this.imageData, 0, 0);
    this.rendered = true;
  }

  drawMarks() {
    const c = this.marks, S = this.S, mode = this.mode;
    c.clearRect(0, 0, this.W, this.H);
    const P = this._P;
    const t = performance.now() * 0.001;
    const css = this.teamCss;
    const col = (team) => css[team] || '#ffffff';
    // super-jump beacons in flight
    for (const j of mode.jumps?.list || []) {
      this.toPx(j.to.x, j.to.z, P);
      c.strokeStyle = col(j.actor.team); c.lineWidth = 3;
      c.beginPath(); c.arc(P.x, P.y, 8 + ((t * 2) % 1) * 10, 0, Math.PI * 2); c.stroke();
    }
    // base selection ring
    const sel = this.selected();
    const bp = mode.basePos(S.player.team);
    this.toPx(bp.x, bp.z, P);
    this.ring(c, P, sel?.kind === 'base', col(S.player.team), t, 'BASE');
    // rivals: only when revealed
    for (const a of mode.teamOf(S.player.enemyTeam)) {
      if (!a.alive || !mode.isRevealed(a)) continue;
      this.toPx(a.position.x, a.position.z, P);
      this.dot(c, P, col(a.team), 7, '#ffffff');
    }
    // teammates + you
    for (const a of mode.teamOf(S.player.team)) {
      if (!a.alive) continue;
      this.toPx(a.position.x, a.position.z, P);
      if (a === S.player) {
        // arrow along the camera yaw (map up = +x, right = +z)
        const yaw = S.camRig.yaw;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        // canvas: +x world → up (−y), +z world → right; rotate(θ) maps the "up" arrow to (sin θ, −cos θ)
        c.save(); c.translate(P.x, P.y); c.rotate(Math.atan2(fz, fx));
        c.fillStyle = '#ffffff'; c.strokeStyle = col(a.team); c.lineWidth = 3;
        c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fill(); c.stroke();
        c.restore();
      } else {
        const selected = sel?.kind === 'mate' && sel.actor === a;
        this.dot(c, P, col(a.team), 8, '#ffffff');
        if (selected) this.ring(c, P, true, '#ffffff', t, a.name);
      }
    }
  }

  dot(c, P, fill, r, stroke) {
    c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 2.5;
    c.beginPath(); c.arc(P.x, P.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  ring(c, P, on, color, t, label) {
    c.strokeStyle = color;
    c.lineWidth = on ? 4 : 2;
    const r = on ? 15 + Math.sin(t * 8) * 2 : 12;
    c.beginPath(); c.arc(P.x, P.y, r, 0, Math.PI * 2); c.stroke();
    if (on && label) {
      c.font = '700 15px "Baloo 2", system-ui, sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)';
      c.strokeText(label, P.x, P.y - r - 6);
      c.fillStyle = '#ffffff';
      c.fillText(label, P.x, P.y - r - 6);
    }
  }

  dispose() {
    this.el.remove();
    this.rt.dispose();
    if (this.water) { this.water.geometry.dispose(); this.water.material.dispose(); }
    // hand the level group back if a render was interrupted
    if (this.S.level.group.parent === this.scene) this.S.scene.add(this.S.level.group);
  }
}
