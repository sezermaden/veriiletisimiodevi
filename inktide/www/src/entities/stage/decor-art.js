// Canvas artwork for decor: billboard ads (original brands), graffiti tags, neon signs, the vending
// machine front, chain-link and chimney bricks. Everything is cached by content.
import * as THREE from 'three';
import { canvasTex, drawMurkEmblem, drawSquidEmblem, roundRect, hash01 } from './common.js';

export const BRANDS = ['Squidberry Soda', 'Tidepool Racing', 'Murk Industries', 'Kelp Krunch', 'Pix FM 88.1'];

function fitFont(x, text, family, maxW, size) {
  let s = size;
  x.font = `${s}px ${family}`;
  while (x.measureText(text).width > maxW && s > 10) { s -= 2; x.font = `${s}px ${family}`; }
  return s;
}

function outlined(x, text, px, py, fill, stroke, lw) {
  x.lineJoin = 'round';
  x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(text, px, py);
  x.fillStyle = fill; x.fillText(text, px, py);
}

/** Billboard ad for a brand (index or name). */
export function billboardTexture(brand) {
  const name = typeof brand === 'number' ? BRANDS[brand % BRANDS.length] : String(brand || BRANDS[0]);
  return canvasTex('billboard:' + name, 1024, 512, (x, w, h) => {
    const key = name.toLowerCase();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (key.includes('squidberry')) {
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#ff3fa4'); g.addColorStop(1, '#6a2bd9');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        x.strokeStyle = `rgba(255,255,255,${0.15 + hash01(i, 1) * 0.3})`; x.lineWidth = 3;
        x.beginPath(); x.arc(hash01(i, 2) * w, hash01(i, 3) * h, 6 + hash01(i, 4) * 22, 0, Math.PI * 2); x.stroke();
      }
      // can
      x.save(); x.translate(w * 0.8, h * 0.54); x.rotate(0.18);
      const cg = x.createLinearGradient(-80, 0, 80, 0);
      cg.addColorStop(0, '#b01e6e'); cg.addColorStop(0.35, '#ff6ac0'); cg.addColorStop(0.6, '#ff3fa4'); cg.addColorStop(1, '#8a1456');
      x.fillStyle = cg; roundRect(x, -80, -170, 160, 340, 26); x.fill();
      x.fillStyle = '#d9dde8'; roundRect(x, -72, -186, 144, 26, 10); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(-8, -10, 44, 0, Math.PI * 2); x.fill();
      drawSquidEmblem(x, -8, -8, 34, '#ff3fa4', '#ffffff');
      x.font = '26px Bungee, Impact, sans-serif'; x.fillStyle = '#ffffff'; x.fillText('SODA', -8, 90);
      x.restore();
      x.font = '118px Bungee, Impact, sans-serif';
      outlined(x, 'SQUIDBERRY', w * 0.4, h * 0.36, '#ffffff', '#3a0f55', 18);
      x.font = '92px Bungee, Impact, sans-serif';
      outlined(x, 'SODA', w * 0.4, h * 0.6, '#ffe14a', '#3a0f55', 16);
      x.font = '700 38px "Baloo 2", sans-serif'; x.fillStyle = '#ffffff';
      x.fillText('Tastes like a splash!', w * 0.4, h * 0.82);
    } else if (key.includes('racing')) {
      x.fillStyle = '#0f1f5c'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        x.fillStyle = `rgba(80,200,255,${0.08 + hash01(i, 5) * 0.2})`;
        x.fillRect(0, hash01(i, 6) * h, w * (0.3 + hash01(i, 7) * 0.7), 4 + hash01(i, 8) * 8);
      }
      // checker band
      const s = 32;
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < w / s; xx++) {
        x.fillStyle = (xx + yy) % 2 ? '#ffffff' : '#111111';
        x.fillRect(xx * s, h - s * 2 + yy * s, s, s);
      }
      // kart
      x.save(); x.translate(w * 0.78, h * 0.55);
      x.fillStyle = '#ff8a1f'; roundRect(x, -150, -40, 300, 70, 30); x.fill();
      x.fillStyle = '#ffd23f'; roundRect(x, -40, -85, 90, 60, 20); x.fill();
      x.fillStyle = '#16163a';
      for (const cx of [-100, 100]) { x.beginPath(); x.arc(cx, 38, 36, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#c9cbd6';
      for (const cx of [-100, 100]) { x.beginPath(); x.arc(cx, 38, 14, 0, Math.PI * 2); x.fill(); }
      drawSquidEmblem(x, 5, -60, 22, '#ffffff', '#16163a');
      x.restore();
      x.save(); x.translate(w * 0.36, h * 0.36); x.transform(1, 0, -0.22, 1, 0, 0);
      x.font = '112px Bungee, Impact, sans-serif';
      outlined(x, 'TIDEPOOL', 0, 0, '#ffffff', '#ff3f6c', 14);
      x.font = '96px Bungee, Impact, sans-serif';
      outlined(x, 'RACING', 0, 110, '#2fd6ff', '#081238', 14);
      x.restore();
      x.font = '700 32px "Baloo 2", sans-serif'; x.fillStyle = '#ffd23f';
      x.fillText('CHAMPIONSHIP · SEASON 8', w * 0.34, h * 0.8);
    } else if (key.includes('murk')) {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#4b4760'); g.addColorStop(1, '#1d1b29');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.04)';
      for (let i = 0; i < w; i += 24) x.fillRect(i, 0, 2, h);
      drawMurkEmblem(x, w * 0.2, h * 0.5, 130, '#c9b8ff', '#2a2640');
      x.textAlign = 'left';
      x.font = '84px Bungee, Impact, sans-serif';
      outlined(x, 'MURK', w * 0.38, h * 0.32, '#e9e4ff', '#0f0d18', 10);
      x.font = '62px Bungee, Impact, sans-serif';
      outlined(x, 'INDUSTRIES', w * 0.38, h * 0.5, '#9d86e8', '#0f0d18', 10);
      x.font = '600 40px "Baloo 2", sans-serif'; x.fillStyle = '#d7d2ea';
      x.fillText('Colour is a privilege.™', w * 0.38, h * 0.7);
      x.font = '500 28px "Baloo 2", sans-serif'; x.fillStyle = 'rgba(215,210,234,0.7)';
      x.fillText('Progress is gray. Invest in the Graytide.', w * 0.38, h * 0.82);
    } else if (key.includes('kelp')) {
      const g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#39c56b'); g.addColorStop(1, '#ffd23f');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(i * 100, h * 0.1, 60, 0, Math.PI * 2); x.fill(); }
      // bowl
      x.save(); x.translate(w * 0.78, h * 0.62);
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(0, 0, 170, 40, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f2f2f7'; x.beginPath(); x.moveTo(-170, 0); x.quadraticCurveTo(0, 230, 170, 0); x.fill();
      for (let i = 0; i < 26; i++) {
        x.fillStyle = ['#2f9a45', '#6fd35c', '#c9e85a'][i % 3];
        x.beginPath(); x.ellipse(-140 + hash01(i, 9) * 280, -10 - hash01(i, 10) * 40, 22, 10, hash01(i, 11) * 3, 0, Math.PI * 2); x.fill();
      }
      x.restore();
      x.font = '120px Bungee, Impact, sans-serif';
      outlined(x, 'KELP', w * 0.34, h * 0.33, '#ffffff', '#1d5a2a', 16);
      outlined(x, 'KRUNCH', w * 0.34, h * 0.6, '#ffe14a', '#1d5a2a', 16);
      x.font = '700 36px "Baloo 2", sans-serif'; x.fillStyle = '#1d3a22';
      x.fillText('Part of a balanced breakfast reef!', w * 0.34, h * 0.84);
    } else {
      // Pix FM
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b0f45'); g.addColorStop(1, '#3a1672');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#2fd6ff'; x.lineWidth = 6; x.shadowColor = '#2fd6ff'; x.shadowBlur = 20;
      x.beginPath();
      for (let i = 0; i <= 120; i++) { const px = i * (w / 120); const py = h * 0.78 + Math.sin(i * 0.5) * 30 * Math.sin(i * 0.07) + (hash01(i, 12) - 0.5) * 30; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      x.stroke();
      x.shadowBlur = 0;
      // jellyfish mascot
      x.save(); x.translate(w * 0.82, h * 0.4);
      x.fillStyle = '#ff7ad9'; x.beginPath(); x.arc(0, 0, 80, Math.PI, 0); x.quadraticCurveTo(0, 30, -80, 0); x.fill();
      x.strokeStyle = '#ff7ad9'; x.lineWidth = 8;
      for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(-56 + i * 28, 10); x.quadraticCurveTo(-66 + i * 28, 70, -50 + i * 28, 120); x.stroke(); }
      x.fillStyle = '#1b0f45'; x.beginPath(); x.arc(-25, -25, 10, 0, Math.PI * 2); x.arc(25, -25, 10, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffd23f'; roundRect(x, -60, -95, 120, 26, 12); x.fill();
      x.restore();
      x.font = '130px Bungee, Impact, sans-serif';
      outlined(x, 'PIX FM', w * 0.36, h * 0.32, '#ffffff', '#ff3fa4', 14);
      x.font = '84px Bungee, Impact, sans-serif';
      outlined(x, '88.1', w * 0.36, h * 0.55, '#2fd6ff', '#0b0628', 12);
      x.font = '700 32px "Baloo 2", sans-serif'; x.fillStyle = '#ffd6f4';
      x.fillText('Pirate radio · the tide is loud', w * 0.36, h * 0.68);
    }
    // weathering + frame shadow
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 16; x.strokeRect(0, 0, w, h);
  });
}

const TAGS = ['INK!', 'SPLASH', 'TIDE', 'KAI', 'MURK OUT', 'SQUAD', 'WAVY', 'SPLAT', 'FRESH'];
const TAG_COLORS = [['#ff8a1f', '#ffd23f'], ['#ff3fa4', '#8a5bff'], ['#2fd6ff', '#3fd6a0'], ['#9dff2e', '#2fd6ff'], ['#ffd23f', '#ff3f6c']];

/** Graffiti tag canvas. style: 'tag' | 'squid' | 'splat' | 'arrow'. */
export function graffitiTexture(text, seed = 0, colors = null, style = 'tag') {
  const t = text || TAGS[Math.floor(hash01(seed, 1) * TAGS.length)];
  const [c1, c2] = colors || TAG_COLORS[Math.floor(hash01(seed, 2) * TAG_COLORS.length)];
  return canvasTex(`graffiti:${style}:${t}:${c1}:${c2}:${seed}`, 1024, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const r = (k) => hash01(seed, k);
    // backdrop blobs
    x.fillStyle = c2; x.globalAlpha = 0.85;
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      const cx = w * (0.2 + r(10 + i) * 0.6), cy = h * (0.35 + r(20 + i) * 0.3), rr = 60 + r(30 + i) * 90;
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const q = rr * (1 + 0.18 * Math.sin(a * 3 + i) + 0.1 * Math.sin(a * 7 + i * 2));
        if (k) x.lineTo(cx + Math.cos(a) * q * 1.6, cy + Math.sin(a) * q * 0.8); else x.moveTo(cx + Math.cos(a) * q * 1.6, cy + Math.sin(a) * q * 0.8);
      }
      x.fill();
    }
    x.globalAlpha = 1;
    // spray mist dots
    for (let i = 0; i < 400; i++) {
      x.fillStyle = i % 2 ? c1 : c2;
      x.globalAlpha = 0.3 + r(100 + i) * 0.5;
      x.beginPath(); x.arc(w * (0.1 + r(200 + i) * 0.8), h * (0.15 + r(700 + i) * 0.7), 1 + r(1300 + i) * 3, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    if (style === 'squid') {
      x.save(); x.translate(w * 0.5, h * 0.45); x.rotate(-0.1);
      x.lineWidth = 26; x.strokeStyle = '#161226';
      drawSquidEmblem(x, 0, 0, 170, '#161226', '#161226');
      drawSquidEmblem(x, -6, -6, 158, c1, '#ffffff');
      x.restore();
    } else if (style === 'arrow') {
      x.save(); x.translate(w * 0.5, h * 0.5); x.rotate(-0.08);
      x.fillStyle = '#161226';
      x.beginPath(); x.moveTo(-380, -70); x.lineTo(160, -70); x.lineTo(160, -160); x.lineTo(400, 0); x.lineTo(160, 160); x.lineTo(160, 70); x.lineTo(-380, 70); x.closePath(); x.fill();
      const g = x.createLinearGradient(-360, 0, 380, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
      x.fillStyle = g;
      x.beginPath(); x.moveTo(-360, -50); x.lineTo(180, -50); x.lineTo(180, -118); x.lineTo(360, 0); x.lineTo(180, 118); x.lineTo(180, 50); x.lineTo(-360, 50); x.closePath(); x.fill();
      x.restore();
    }
    if (style !== 'arrow') {
      // letters
      x.save();
      x.translate(w * 0.5, style === 'squid' ? h * 0.82 : h * 0.5);
      x.rotate(-0.06 + r(3) * 0.08);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const size = fitFont(x, t, '"Rubik Wet Paint", "Bungee", Impact, sans-serif', w * 0.86, style === 'squid' ? 110 : 250);
      x.font = `${size}px "Rubik Wet Paint", "Bungee", Impact, sans-serif`;
      x.lineJoin = 'round';
      x.lineWidth = size * 0.16; x.strokeStyle = '#161226'; x.strokeText(t, 6, 8);
      x.strokeText(t, 0, 0);
      const g = x.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, c1); g.addColorStop(1, c2);
      x.fillStyle = g; x.fillText(t, 0, 0);
      x.lineWidth = size * 0.035; x.strokeStyle = 'rgba(255,255,255,0.9)';
      x.strokeText(t, -size * 0.03, -size * 0.04);
      // drips
      const tw = x.measureText(t).width;
      for (let i = 0; i < 9; i++) {
        const dx = -tw / 2 + r(40 + i) * tw, len = 30 + r(50 + i) * 90;
        x.strokeStyle = r(60 + i) > 0.5 ? c1 : c2; x.lineWidth = 10 + r(70 + i) * 6; x.lineCap = 'round';
        x.beginPath(); x.moveTo(dx, size * 0.3); x.lineTo(dx, size * 0.3 + len); x.stroke();
        x.fillStyle = x.strokeStyle; x.beginPath(); x.arc(dx, size * 0.3 + len, x.lineWidth * 0.75, 0, Math.PI * 2); x.fill();
      }
      x.restore();
    }
    // stars / sparkles
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const cx = w * (0.08 + r(80 + i) * 0.84), cy = h * (0.1 + r(90 + i) * 0.2), s = 14 + r(95 + i) * 16;
      x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s * 0.25, cy - s * 0.25); x.lineTo(cx + s, cy); x.lineTo(cx + s * 0.25, cy + s * 0.25);
      x.lineTo(cx, cy + s); x.lineTo(cx - s * 0.25, cy + s * 0.25); x.lineTo(cx - s, cy); x.lineTo(cx - s * 0.25, cy - s * 0.25); x.fill();
    }
  });
}

/** Neon sign: glowing text + tube border on transparent. Returns {tex, aspect}. */
export function neonTexture(text, color = '#ff4fd8') {
  const t = String(text || 'OPEN').toUpperCase();
  const W = 1024, H = 320;
  const tex = canvasTex(`neon:${t}:${color}`, W, H, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const size = fitFont(x, t, '"Lilita One", "Bungee", sans-serif', w - 140, 190);
    x.font = `${size}px "Lilita One", "Bungee", sans-serif`;
    // tube border
    x.lineJoin = 'round';
    for (const [lw, a, blur] of [[26, 0.25, 30], [12, 0.8, 16], [5, 1, 0]]) {
      x.shadowColor = color; x.shadowBlur = blur;
      x.strokeStyle = a === 1 ? '#ffffff' : color; x.globalAlpha = a; x.lineWidth = lw;
      roundRect(x, 24, 24, w - 48, h - 48, 40); x.stroke();
    }
    for (const [lw, a, blur] of [[22, 0.35, 34], [10, 0.9, 18], [4, 1, 4]]) {
      x.shadowColor = color; x.shadowBlur = blur; x.globalAlpha = a;
      x.strokeStyle = a === 1 ? '#ffffff' : color; x.lineWidth = lw;
      x.strokeText(t, w / 2, h / 2 + 6);
    }
    x.globalAlpha = 1; x.shadowBlur = 0;
  });
  return tex;
}

export function vendingTexture() {
  return canvasTex('vending-front', 256, 512, (x, w, h) => {
    x.fillStyle = '#e9f6ff'; x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(160,210,255,0.2)');
    x.fillStyle = '#ff3fa4'; x.fillRect(0, 0, w, 70);
    x.font = '34px Bungee, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ffffff'; x.fillText('SQUIDBERRY', w / 2, 36);
    const cans = ['#ff3fa4', '#8a5bff', '#ffd23f', '#2fd6ff', '#ff8a1f', '#3fd6a0'];
    for (let row = 0; row < 5; row++) {
      const y = 92 + row * 80;
      x.fillStyle = '#c7d3e0'; x.fillRect(8, y + 56, w - 16, 6);
      for (let i = 0; i < 5; i++) {
        x.fillStyle = cans[(row * 2 + i) % cans.length];
        roundRect(x, 16 + i * 46, y, 34, 54, 8); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(22 + i * 46, y + 6, 5, 40);
        x.fillStyle = '#1b1838'; x.font = '600 12px "Baloo 2", sans-serif'; x.fillText('2P', 33 + i * 46, y + 70);
      }
    }
    x.fillStyle = g; x.fillRect(0, 70, w, h - 70);
  });
}

export function chainTexture() {
  return canvasTex('chainlink', 128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = '#c9d0d8'; x.lineWidth = 5;
    for (let i = -1; i <= 4; i++) {
      x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 64, h); x.stroke();
      x.beginPath(); x.moveTo(i * 32 + 64, 0); x.lineTo(i * 32, h); x.stroke();
    }
  }, { repeat: true });
}

export function brickTexture() {
  return canvasTex('chimney-brick', 192, 512, (x, w, h) => {
    x.fillStyle = '#6b4038'; x.fillRect(0, 0, w, h);
    const bh = 24, bw = 64;
    for (let row = 0; row * bh < h; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let c = -1; c * bw < w + bw; c++) {
        const k = hash01(row, c);
        x.fillStyle = `hsl(${8 + k * 10}, ${45 + k * 15}%, ${38 + k * 12}%)`;
        x.fillRect(c * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
  });
}

export function makeUniqueMaterial(o) { return new THREE.MeshStandardMaterial(o); }
