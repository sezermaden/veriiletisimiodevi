/* =========================================================
   The kiosk counter and the 3D scratch card.

   The card is a thin slab whose top face is a canvas texture
   (the printed ticket). A second plane a hair above it carries
   the foil: another canvas that the brush erases with
   destination-out. Coverage is tracked per cell on a coarse
   sample grid so "revealed" is a measured fact, not a guess.
   ========================================================= */
import * as THREE from 'three';
import { SYMBOLS, payFor, tiersOf } from './economy.js';
import { drawSymbol, roundRect } from './symbols.js';
import { fmt } from './format.js';

const CARD_W = 3.5;                       // world units
const FACE_RES = 768;                     // texture width; height follows the card aspect
const FOIL_RES = 512;
const SAMPLES = 10;                       // coverage samples per cell edge
/* a cell counts as revealed at this coverage; one clean stroke through its middle
   with the base brush clears it, so scratching feels generous rather than fussy */
const REVEAL_AT = 0.45;

/* ---------------------------------------------------------
   Procedural textures for the counter
   --------------------------------------------------------- */
function feltTexture(color = '#0f3d2a') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function foilPattern(ctx, w, h, theme) {
  // brushed silver with the ticket's tint, plus a diagonal sheen
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, theme.foil);
  base.addColorStop(0.45, '#f2f4f7');
  base.addColorStop(0.55, '#d4d9df');
  base.addColorStop(1, theme.foil);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const row = (Math.random() - 0.5) * 18;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = row + (Math.random() - 0.5) * 10;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------------------------------------------------
   Card
   --------------------------------------------------------- */
export class TicketScene {
  constructor(view, fx) {
    this.view = view;
    this.fx = fx;
    this.scene = view.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.card = null;
    this.cells = [];
    this.cellRects = [];        // {u0,v0,u1,v1} in UV (u right, v up)
    this.revealed = [];
    this.revealedCount = 0;
    this.coverage = null;       // Uint8Array per cell sample
    this.ticket = null;
    this.anim = { t: 0, mode: 'idle' };
    this.finished = false;
    this.onCellRevealed = null;
    this.onAllRevealed = null;
    this.brushRadius = 0.08;    // in UV units of the card width
    this.lastScratch = { u: -1, v: -1 };
    this.flakesEnabled = true;
    this.revealQueue = null;

    this._ray = new THREE.Raycaster();
    this._buildCounter();
    this._buildCursor();
  }

  /* ---------- static dressing ---------- */
  _buildCounter() {
    const felt = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshStandardMaterial({ map: feltTexture('#0f3d2a'), roughness: 0.98, metalness: 0 }),
    );
    felt.rotation.x = -Math.PI / 2;
    felt.receiveShadow = true;
    this.scene.add(felt);

    // counter edge in front of the camera
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.7 }),
    );
    edge.position.set(0, -0.3, 4.3);
    edge.receiveShadow = true;
    this.scene.add(edge);

    // ticket dispenser behind the play area
    const disp = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x15232c, roughness: 0.55, metalness: 0.35 }),
    );
    body.position.set(0, 0.8, -3.3);
    body.castShadow = true; body.receiveShadow = true;
    disp.add(body);
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.12, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.9 }),
    );
    slot.position.set(0, 0.42, -2.56);
    disp.add(slot);
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0xff4fd8, emissiveIntensity: 2.4 }),
    );
    neon.position.set(0, 1.45, -2.58);
    disp.add(neon);
    this.neon = neon;
    const neon2 = neon.clone();
    neon2.material = new THREE.MeshStandardMaterial({ color: 0xf4c542, emissive: 0xf4c542, emissiveIntensity: 2.0 });
    neon2.position.set(0, 0.15, -2.58);
    disp.add(neon2);
    this.scene.add(disp);

    // a few spare cards fanned out to the side
    const spareMat = new THREE.MeshStandardMaterial({ color: 0xd9c28a, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 2.2), spareMat);
      m.position.set(-4.1 + i * 0.08, 0.02 + i * 0.03, 0.6 - i * 0.15);
      m.rotation.y = 0.25 + i * 0.12;
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }
    // a coin cup on the right
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 0.9, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf4c542, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }),
    );
    cup.position.set(3.9, 0.45, 0.8);
    cup.castShadow = true;
    this.scene.add(cup);
    this.coins = [];
    const coinGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 20);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd95a, metalness: 0.85, roughness: 0.25 });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(coinGeo, coinMat);
      c.position.set(3.9 + (Math.random() - 0.5) * 0.5, 0.05 + i * 0.045, 0.8 + (Math.random() - 0.5) * 0.5);
      c.rotation.y = Math.random() * 3;
      this.scene.add(c);
      this.coins.push(c);
    }
  }

  _buildCursor() {
    // the player's coin — a chunky scratcher
    this.cursor = new THREE.Group();
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.05, 28),
      new THREE.MeshStandardMaterial({ color: 0xffd95a, metalness: 0.85, roughness: 0.25, emissive: 0x4a3300, emissiveIntensity: 0.4 }),
    );
    coin.rotation.x = Math.PI / 2;
    coin.rotation.z = 0.3;
    coin.castShadow = true;
    coin.position.y = 0.22;
    this.cursor.add(coin);
    this.cursorCoin = coin;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd95a, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.cursor.add(ring);
    this.cursorRing = ring;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    // the bot: a hovering drone with a scratch tip
    this.bot = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7fb5ff, metalness: 0.6, roughness: 0.35, emissive: 0x1a3a6a, emissiveIntensity: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), bodyMat);
    head.position.y = 0.7;
    this.bot.add(head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x5ad7e6, emissiveIntensity: 2 }));
    eye.position.set(0, 0.72, 0.18);
    this.bot.add(eye);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 10), bodyMat);
    arm.position.y = 0.36;
    this.bot.add(arm);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0xffd95a, metalness: 0.8, roughness: 0.3 }));
    tip.rotation.x = Math.PI;
    tip.position.y = 0.08;
    this.bot.add(tip);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.06), bodyMat);
    prop.position.y = 0.95;
    this.bot.add(prop);
    this.botProp = prop;
    this.bot.visible = false;
    this.bot.castShadow = true;
    this.scene.add(this.bot);
    this.botState = { u: 0.5, v: 0.5, target: null, idx: 0, hover: 0, acc: 0 };
  }

  /* ---------- card lifecycle ---------- */
  cardSize(t) {
    const aspect = (t.rows * 1.0 + 1.2) / (t.cols * 1.0 + 0.4);   // rows + header/paytable
    const w = CARD_W;
    const h = Math.min(4.6, Math.max(2.8, w * aspect));
    return { w, h };
  }

  newTicket(t, cells, info = {}) {
    this.discardNow();
    this.ticket = t;
    this.cells = cells;
    this.finished = false;
    this.revealQueue = null;
    const { w, h } = this.cardSize(t);
    this.w = w; this.h = h;

    // ---- face
    const faceH = Math.round(FACE_RES * (h / w));
    const face = document.createElement('canvas');
    face.width = FACE_RES; face.height = faceH;
    this._drawFace(face.getContext('2d'), t, cells, info, FACE_RES, faceH);
    this.faceCanvas = face;
    const faceTex = new THREE.CanvasTexture(face);
    faceTex.colorSpace = THREE.SRGBColorSpace;
    faceTex.anisotropy = 4;
    this.faceTex = faceTex;

    // ---- foil
    const foilH = Math.round(FOIL_RES * (h / w));
    const foil = document.createElement('canvas');
    foil.width = FOIL_RES; foil.height = foilH;
    const fctx = foil.getContext('2d');
    this._drawFoil(fctx, t, FOIL_RES, foilH);
    this.foilCanvas = foil;
    this.foilCtx = fctx;
    const foilTex = new THREE.CanvasTexture(foil);
    foilTex.colorSpace = THREE.SRGBColorSpace;
    this.foilTex = foilTex;

    // ---- coverage
    const n = cells.length;
    this.coverage = new Uint8Array(n * SAMPLES * SAMPLES);
    this.coverCount = new Uint16Array(n);
    this.revealed = new Array(n).fill(false);
    this.revealedCount = 0;

    // ---- meshes
    const g = new THREE.Group();
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.06, h),
      [
        new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.55, metalness: 0.05 }),
        new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.7 }),
      ],
    );
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.position.y = 0.03;
    g.add(slab);
    const foilMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: foilTex, transparent: true, alphaTest: 0.2, roughness: 0.25, metalness: 0.8, depthWrite: true }),
    );
    foilMesh.rotation.x = -Math.PI / 2;
    foilMesh.position.y = 0.065;
    g.add(foilMesh);
    // win highlight overlay, drawn later
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.07;
    g.add(glow);
    this.glow = glow;
    this.slab = slab;
    this.foilMesh = foilMesh;
    this.card = g;
    this.group.add(g);

    // slide in from the dispenser
    this.anim = { t: 0, mode: 'in', dur: 0.55 };
    g.position.set(0, 0.6, -2.6);
    g.rotation.set(0, 0, 0);
    this.botState.idx = 0; this.botState.target = null; this.botState.acc = 0;
    return g;
  }

  _layout(t, W, H) {
    // returns header height, grid rect, cell size, paytable rect in canvas px
    const pad = W * 0.05;
    const header = H * 0.14;
    const footer = H * 0.13;
    const gridTop = header + pad * 0.6;
    const gridH = H - header - footer - pad * 1.2;
    const gridW = W - pad * 2;
    const cs = Math.min(gridW / t.cols, gridH / t.rows);
    const gw = cs * t.cols, gh = cs * t.rows;
    const gx = (W - gw) / 2, gy = gridTop + (gridH - gh) / 2;
    return { pad, header, footer, gx, gy, cs, gw, gh };
  }

  _drawFace(ctx, t, cells, info, W, H) {
    const th = t.theme;
    const L = this._layout(t, W, H);
    // paper
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, th.a); bg.addColorStop(1, th.b);
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, W * 0.04); ctx.fill();
    // guilloche-ish stripes
    ctx.save();
    ctx.globalAlpha = 0.08; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    for (let i = -H; i < W + H; i += 26) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke(); }
    ctx.restore();
    // header
    ctx.fillStyle = th.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${W * 0.075}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
    ctx.fillText(t.name.toUpperCase(), L.pad, L.header * 0.42);
    ctx.font = `600 ${W * 0.034}px "Segoe UI", "Trebuchet MS", sans-serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(t.tagline, L.pad, L.header * 0.8);
    ctx.globalAlpha = 1;
    // price badge
    ctx.fillStyle = '#ffe28a';
    const badgeW = W * 0.22;
    roundRect(ctx, W - L.pad - badgeW, L.header * 0.18, badgeW, L.header * 0.5, L.header * 0.12); ctx.fill();
    ctx.fillStyle = '#2a1a00'; ctx.textAlign = 'center';
    ctx.font = `900 ${W * 0.05}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
    ctx.fillText('$' + fmt(info.price ?? t.cost), W - L.pad - badgeW / 2, L.header * 0.44);
    // grid cells
    this.cellRects = [];
    for (let r = 0; r < t.rows; r++) {
      for (let c = 0; c < t.cols; c++) {
        const i = r * t.cols + c;
        const x = L.gx + c * L.cs, y = L.gy + r * L.cs;
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        roundRect(ctx, x + L.cs * 0.05, y + L.cs * 0.05, L.cs * 0.9, L.cs * 0.9, L.cs * 0.12); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        roundRect(ctx, x + L.cs * 0.09, y + L.cs * 0.09, L.cs * 0.82, L.cs * 0.82, L.cs * 0.1); ctx.fill();
        drawSymbol(ctx, cells[i], x + L.cs / 2, y + L.cs / 2, L.cs * 0.78);
        // UV rect: u right, v up (texture y down)
        this.cellRects.push({
          u0: x / W, u1: (x + L.cs) / W,
          v0: 1 - (y + L.cs) / H, v1: 1 - y / H,
          px: x, py: y, ps: L.cs,
        });
      }
    }
    // paytable strip
    const py = H - L.footer + L.pad * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, L.pad, py, W - L.pad * 2, L.footer - L.pad * 0.6, W * 0.02); ctx.fill();
    const tiers = tiersOf(t);
    const paying = [...new Set([...tiers.small, ...tiers.medium, ...tiers.big, ...tiers.huge])];
    const slotW = (W - L.pad * 2) / paying.length;
    const sz = Math.min(slotW * 0.55, (L.footer - L.pad * 0.6) * 0.55);
    paying.forEach((id, i) => {
      const cx = L.pad + slotW * (i + 0.5);
      drawSymbol(ctx, id, cx, py + (L.footer - L.pad * 0.6) * 0.38, sz);
      ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${W * 0.028}px "Segoe UI", "Trebuchet MS", sans-serif`;
      ctx.fillText('×' + payFor(t, id), cx, py + (L.footer - L.pad * 0.6) * 0.82);
    });
    ctx.textAlign = 'right';
    ctx.font = `700 ${W * 0.026}px "Segoe UI", "Trebuchet MS", sans-serif`;
    ctx.fillStyle = th.ink; ctx.globalAlpha = 0.75;
    ctx.fillText(`MATCH ${t.match}`, W - L.pad - 6, py - W * 0.02);
    ctx.globalAlpha = 1;
  }

  _drawFoil(ctx, t, W, H) {
    const L = this._layout(t, W, H);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    roundRect(ctx, L.gx - L.cs * 0.02, L.gy - L.cs * 0.02, L.gw + L.cs * 0.04, L.gh + L.cs * 0.04, L.cs * 0.1);
    ctx.clip();
    foilPattern(ctx, W, H, t.theme);
    ctx.restore();
    // cell outlines + "scratch" text on the foil
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
    for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) {
      const x = L.gx + c * L.cs, y = L.gy + r * L.cs;
      roundRect(ctx, x + L.cs * 0.06, y + L.cs * 0.06, L.cs * 0.88, L.cs * 0.88, L.cs * 0.1); ctx.stroke();
      ctx.fillStyle = 'rgba(40,40,50,0.45)';
      ctx.font = `900 ${L.cs * 0.16}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SCRATCH', x + L.cs / 2, y + L.cs / 2);
    }
    this.foilGrid = L;
  }

  /* ---------- coordinate helpers ---------- */
  /** card-local UV (u right 0..1, v up 0..1) -> world position on the foil */
  uvToWorld(u, v, out = new THREE.Vector3()) {
    out.set((u - 0.5) * this.w, 0.07, (0.5 - v) * this.h);
    if (this.card) this.card.localToWorld(out);
    return out;
  }

  /** screen point -> UV on the foil, or null */
  screenToUV(sx, sy) {
    if (!this.foilMesh || this.anim.mode === 'in' || this.anim.mode === 'out') return null;
    this.view.raycaster(sx, sy, this._ray);
    const hit = this._ray.intersectObject(this.foilMesh, false)[0];
    if (!hit || !hit.uv) return null;
    return { u: hit.uv.x, v: hit.uv.y };
  }

  /** nearest point on the card plane even when the ray misses it (keeps the coin on the table) */
  screenToUVClamped(sx, sy) {
    if (!this.card) return null;
    this.view.raycaster(sx, sy, this._ray);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.07);
    const p = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(plane, p)) return null;
    this.card.worldToLocal(p);
    return { u: Math.max(0, Math.min(1, p.x / this.w + 0.5)), v: Math.max(0, Math.min(1, 0.5 - p.z / this.h)) };
  }

  cellAt(u, v) {
    for (let i = 0; i < this.cellRects.length; i++) {
      const r = this.cellRects[i];
      if (u >= r.u0 && u < r.u1 && v >= r.v0 && v < r.v1) return i;
    }
    return -1;
  }

  /* ---------- scratching ---------- */
  /**
   * Erases foil around (u, v). Returns the cells newly revealed by this stroke.
   * @param {number} radius brush radius as a fraction of card width
   */
  scratchAt(u, v, radius = this.brushRadius, byBot = false) {
    if (!this.foilCtx || this.finished || this.anim.mode !== 'idle') return [];
    const W = this.foilCanvas.width, H = this.foilCanvas.height;
    const px = u * W, py = (1 - v) * H;
    const pr = radius * W;
    // only erase inside the grid area so the header stays printed
    const g = this.foilGrid;
    if (px < g.gx - pr || px > g.gx + g.gw + pr || py < g.gy - pr || py > g.gy + g.gh + pr) return [];
    const ctx = this.foilCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // interpolate from the last point so fast strokes do not leave dots
    const last = this.lastScratch;
    const steps = last.u >= 0 ? Math.min(12, Math.ceil(Math.hypot(u - last.u, v - last.v) / (radius * 0.5))) : 1;
    for (let s = 1; s <= steps; s++) {
      const k = s / steps;
      const x = last.u >= 0 ? (last.u + (u - last.u) * k) * W : px;
      const y = last.u >= 0 ? (1 - (last.v + (v - last.v) * k)) * H : py;
      ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
      // softer rim
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, pr * 1.25, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.foilTex.needsUpdate = true;
    this.lastScratch.u = u; this.lastScratch.v = v;

    // coverage bookkeeping
    const newly = [];
    const rr = radius * 1.1;
    for (let i = 0; i < this.cellRects.length; i++) {
      if (this.revealed[i]) continue;
      const r = this.cellRects[i];
      if (u + rr < r.u0 || u - rr > r.u1 || v + rr < r.v0 || v - rr > r.v1) continue;
      const base = i * SAMPLES * SAMPLES;
      const cw = r.u1 - r.u0, ch = r.v1 - r.v0;
      let added = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        const vv = r.v0 + ch * ((sy + 0.5) / SAMPLES);
        for (let sx = 0; sx < SAMPLES; sx++) {
          const k = base + sy * SAMPLES + sx;
          if (this.coverage[k]) continue;
          const uu = r.u0 + cw * ((sx + 0.5) / SAMPLES);
          const du = (uu - u), dv = (vv - v) * (this.h / this.w);
          if (du * du + dv * dv <= rr * rr) { this.coverage[k] = 1; added++; }
        }
      }
      if (added) {
        this.coverCount[i] += added;
        if (this.coverCount[i] >= SAMPLES * SAMPLES * REVEAL_AT) {
          this.revealed[i] = true;
          this.revealedCount++;
          newly.push(i);
          this._clearCell(i);
        }
      }
    }
    if (this.flakesEnabled && this.fx) {
      const p = this.uvToWorld(u, v);
      this.fx.burst(p.x, p.y + 0.05, p.z, {
        count: byBot ? 2 : 3, color: 0xdfe4ea, color2: 0x8a9099, speed: 1.4, size: 0.09, life: 0.5,
        gravity: -6, upBias: 0.9, bounce: true, alpha: 0.9,
      });
    }
    if (newly.length && this.onCellRevealed) this.onCellRevealed(newly, byBot);
    if (this.revealedCount >= this.cellRects.length && !this.finished) {
      this.finished = true;
      if (this.onAllRevealed) this.onAllRevealed(byBot);
    }
    return newly;
  }

  endStroke() { this.lastScratch.u = -1; this.lastScratch.v = -1; }

  /** fully clears a cell's foil once it counts as revealed — a clean reveal reads better */
  _clearCell(i) {
    const r = this.cellRects[i];
    const W = this.foilCanvas.width, H = this.foilCanvas.height;
    const ctx = this.foilCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    roundRect(ctx, r.u0 * W + 2, (1 - r.v1) * H + 2, (r.u1 - r.u0) * W - 4, (r.v1 - r.v0) * H - 4, 6);
    ctx.fill();
    ctx.restore();
    this.foilTex.needsUpdate = true;
  }

  /** Reveals everything in a quick sweep (Quick Reveal upgrade / end of bot run). */
  revealAll() {
    if (!this.card || this.finished || this.anim.mode !== 'idle') return false;
    const order = [];
    for (let i = 0; i < this.cellRects.length; i++) if (!this.revealed[i]) order.push(i);
    if (!order.length) return false;
    this.revealQueue = { order, t: 0, per: Math.max(0.025, 0.45 / order.length) };
    return true;
  }

  _revealCellNow(i, byBot) {
    if (this.revealed[i]) return;
    const r = this.cellRects[i];
    this.revealed[i] = true;
    this.revealedCount++;
    this.coverCount[i] = SAMPLES * SAMPLES;
    this._clearCell(i);
    if (this.flakesEnabled && this.fx) {
      const p = this.uvToWorld((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
      this.fx.burst(p.x, p.y + 0.05, p.z, { count: 5, color: 0xdfe4ea, color2: 0x8a9099, speed: 1.6, size: 0.1, life: 0.5, gravity: -6, upBias: 0.9, bounce: true });
    }
    if (this.onCellRevealed) this.onCellRevealed([i], byBot);
    if (this.revealedCount >= this.cellRects.length && !this.finished) {
      this.finished = true;
      if (this.onAllRevealed) this.onAllRevealed(byBot);
    }
  }

  /* ---------- win presentation ---------- */
  highlight(result) {
    if (!this.card || !this.faceCanvas) return;
    const ctx = this.faceCanvas.getContext('2d');
    const t = this.ticket;
    const winners = new Set();
    for (const l of result.lines) winners.add(l.symbol);
    const special = new Set();
    if (result.mult > 1) ['mult2', 'mult3', 'mult5', 'mult10'].forEach((m) => special.add(m));
    if (result.bonus > 0) special.add('bonus');
    if (result.jackpotHit) special.add('jackpot');
    if (result.wilds && result.lines.length) winners.add('wild');
    ctx.save();
    ctx.lineWidth = 6;
    for (let i = 0; i < this.cellRects.length; i++) {
      const id = this.cells[i];
      const r = this.cellRects[i];
      const isWin = winners.has(id);
      const isSp = special.has(id);
      if (!isWin && !isSp) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(ctx, r.px + r.ps * 0.05, r.py + r.ps * 0.05, r.ps * 0.9, r.ps * 0.9, r.ps * 0.12); ctx.fill();
      } else {
        ctx.strokeStyle = isSp ? '#ff4fd8' : '#ffe28a';
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18;
        roundRect(ctx, r.px + r.ps * 0.05, r.py + r.ps * 0.05, r.ps * 0.9, r.ps * 0.9, r.ps * 0.12); ctx.stroke();
      }
    }
    ctx.restore();
    this.faceTex.needsUpdate = true;
    if (result.payout > 0) {
      const pos = this.uvToWorld(0.5, 0.5);
      const big = result.payout >= result.price * 8;
      if (this.fx) {
        this.fx.rings.spawn(pos.x, 0.1, pos.z, { color: result.jackpotHit ? 0xff4fd8 : 0xffe28a, r0: 0.3, r1: big ? 2.6 : 1.8, dur: big ? 0.7 : 0.45, alpha: 0.7 });
        this.fx.burst(pos.x, 0.3, pos.z, {
          count: big ? 70 : 24, color: 0xffe28a, color2: 0xff7a3d, speed: big ? 5 : 3, size: 0.18, life: 1.1,
          gravity: -7, upBias: 1.2, bounce: true,
        });
        if (result.jackpotHit) this.fx.burst(pos.x, 0.3, pos.z, { count: 120, color: 0xff4fd8, color2: 0x5ad7e6, speed: 7, size: 0.22, life: 1.6, gravity: -5, upBias: 1.4, bounce: true });
      }
      this.glow.material.color.set(result.jackpotHit ? 0xff4fd8 : 0xffe28a);
      this.glowT = 1;
    }
  }

  /* ---------- discard ---------- */
  discard() {
    if (!this.card) return;
    this.anim = { t: 0, mode: 'out', dur: 0.4 };
    this.finished = true;
    this.revealQueue = null;
  }

  discardNow() {
    if (!this.card) return;
    this.group.remove(this.card);
    this.card.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }
    });
    this.card = null;
    this.foilMesh = null;
    this.foilCtx = null;
    this.cellRects = [];
    this.cursor.visible = false;
  }

  get ready() { return !!this.card && this.anim.mode === 'idle' && !this.finished; }

  /* ---------- per-frame ---------- */
  setCursor(u, v, visible, pressing) {
    if (!this.card) { this.cursor.visible = false; return; }
    this.cursor.visible = visible;
    if (!visible) return;
    const p = this.uvToWorld(u, v);
    this.cursor.position.copy(p);
    this.cursorCoin.position.y = pressing ? 0.08 : 0.26;
    this.cursorCoin.rotation.z = pressing ? 0.75 : 0.3;
    this.cursorRing.material.opacity = pressing ? 1 : 0.6;
    const s = pressing ? 1.15 : 1;
    this.cursorRing.scale.set(s, s, s);
  }

  /** drives the bot; returns true while it is working */
  updateBot(dt, rate, enabled) {
    const b = this.botState;
    if (!enabled || !this.card || this.anim.mode !== 'idle' || this.finished || !this.cellRects.length) {
      this.bot.visible = enabled && !!this.card;
      if (this.bot.visible) {
        // hover beside the card while idle
        b.hover += dt;
        const p = this.uvToWorld(1.12, 0.5 + Math.sin(b.hover * 1.6) * 0.1);
        this.bot.position.lerp(p, 1 - Math.exp(-dt * 5));
        this.botProp.rotation.y += dt * 25;
      }
      return false;
    }
    this.bot.visible = true;
    this.botProp.rotation.y += dt * 40;
    // pick the next unrevealed cell, row-major with a little jitter inside it
    if (b.target === null || this.revealed[b.target]) {
      b.target = -1;
      for (let i = 0; i < this.cellRects.length; i++) if (!this.revealed[i]) { b.target = i; break; }
      if (b.target < 0) return false;
      b.acc = 0;
    }
    const r = this.cellRects[b.target];
    const cu = (r.u0 + r.u1) / 2, cv = (r.v0 + r.v1) / 2;
    b.hover += dt;
    // slide toward the cell, then scrub while hovering over it
    const speed = Math.min(1, dt * (3 + rate * 0.6));
    b.u += (cu + Math.sin(b.hover * 14) * (r.u1 - r.u0) * 0.3 - b.u) * speed;
    b.v += (cv + Math.cos(b.hover * 11) * (r.v1 - r.v0) * 0.3 - b.v) * speed;
    const p = this.uvToWorld(b.u, b.v);
    this.bot.position.copy(p);
    this.bot.position.y += 0.02 + Math.sin(b.hover * 9) * 0.015;
    // rate is cells per second: accumulate coverage so the cell completes on schedule
    b.acc += dt * rate;
    const near = Math.hypot(b.u - cu, b.v - cv) < (r.u1 - r.u0) * 0.5;
    if (near) {
      // scrub strokes — visible flakes without the cost of huge brushes
      this.scratchAt(b.u, b.v, (r.u1 - r.u0) * 0.28, true);
      if (b.acc >= 1 && !this.revealed[b.target]) { this._revealCellNow(b.target, true); b.acc -= 1; }
    }
    return true;
  }

  update(dt) {
    // card slide in / out
    if (this.card && this.anim.mode !== 'idle') {
      this.anim.t += dt;
      const k = Math.min(1, this.anim.t / this.anim.dur);
      const e = 1 - Math.pow(1 - k, 3);
      if (this.anim.mode === 'in') {
        this.card.position.set(0, 0.6 * (1 - e), -2.6 * (1 - e));
        this.card.rotation.x = -0.4 * (1 - e);
        if (k >= 1) { this.anim.mode = 'idle'; this.card.position.set(0, 0, 0); this.card.rotation.set(0, 0, 0); }
      } else if (this.anim.mode === 'out') {
        this.card.position.set(e * 1.2, e * 0.3, e * 3.2);
        this.card.rotation.z = -e * 0.5;
        this.card.rotation.x = e * 0.6;
        if (k >= 1) this.discardNow();
      }
    }
    // queued quick reveal
    if (this.revealQueue && this.card) {
      const q = this.revealQueue;
      q.t += dt;
      while (q.order.length && q.t >= q.per) {
        q.t -= q.per;
        this._revealCellNow(q.order.shift(), false);
      }
      if (!q.order.length) this.revealQueue = null;
    }
    // win glow
    if (this.glow && this.glowT > 0) {
      this.glowT = Math.max(0, this.glowT - dt * 1.2);
      this.glow.material.opacity = this.glowT * 0.35 * (0.6 + 0.4 * Math.sin(this.glowT * 20));
    }
    // neon flicker
    if (this.neon) this.neon.material.emissiveIntensity = 2.2 + Math.sin(performance.now() * 0.004) * 0.3 + (Math.random() < 0.02 ? -1.2 : 0);
    // coin cup jiggle on wins is handled by fx; keep coins still
  }
}
