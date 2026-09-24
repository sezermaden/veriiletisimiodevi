// ============================================================
// Dog Quest - procedural vector art (all characters are drawn
// with canvas primitives and animated every frame)
// ============================================================
'use strict';

const Art = {
  flash: null, // when set, every fill uses this color (hit flash)
};

function F(ctx, c) { ctx.fillStyle = Art.flash || c; }
function S(ctx, c) { ctx.strokeStyle = Art.flash || c; }
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function fillEll(ctx, c, x, y, rx, ry, rot = 0) { F(ctx, c); ell(ctx, x, y, rx, ry, rot); ctx.fill(); }
function fillCirc(ctx, c, x, y, r) { F(ctx, c); ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill(); }
function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
function fillPoly(ctx, c, pts) { F(ctx, c); poly(ctx, pts); ctx.fill(); }
function line(ctx, c, w, x1, y1, x2, y2) { S(ctx, c); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

function drawShadow(ctx, x, y, rx, alpha = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ell(ctx, x, y, rx, rx * 0.32); ctx.fill();
}

// ------------------------------------------------------------
// Weapons (drawn along +x from pivot)
// ------------------------------------------------------------
function drawWeaponShape(ctx, item, s = 1) {
  if (!item) return;
  const L = item.look, type = item.type;
  ctx.lineCap = 'round';
  if (L.stick) {
    line(ctx, shade(L.blade, -0.3), 5 * s, 0, 0, 24 * s, 0);
    line(ctx, L.blade, 3.2 * s, 0, 0, 24 * s, 0);
    fillCirc(ctx, shade(L.blade, -0.25), 13 * s, -1.5 * s, 2 * s);
    return;
  }
  switch (type) {
    case 'sword': {
      const len = (L.big ? 32 : 26) * s, w = (L.big ? 4.2 : 3.4) * s;
      line(ctx, L.hilt, 3.2 * s, -3 * s, 0, 6 * s, 0);
      fillCirc(ctx, shade(L.hilt, 0.2), -4 * s, 0, 2.2 * s);
      fillPoly(ctx, shade(L.hilt, 0.25), [6 * s, -6 * s, 8.5 * s, -6 * s, 8.5 * s, 6 * s, 6 * s, 6 * s]);
      fillPoly(ctx, L.blade, [8.5 * s, -w, len - 5 * s, -w, len, 0, len - 5 * s, w, 8.5 * s, w]);
      fillPoly(ctx, shade(L.blade, 0.45), [8.5 * s, -w, len - 5 * s, -w, len, 0, 8.5 * s, -w * 0.1]);
      line(ctx, shade(L.blade, -0.25), 0.8 * s, 10 * s, 0, len - 6 * s, 0);
      if (L.gem) fillCirc(ctx, L.gem, 7.2 * s, 0, 1.8 * s);
      break;
    }
    case 'dagger': {
      const len = 18 * s;
      line(ctx, L.hilt, 3 * s, -2 * s, 0, 5 * s, 0);
      fillPoly(ctx, shade(L.hilt, 0.25), [5 * s, -4 * s, 7 * s, -4 * s, 7 * s, 4 * s, 5 * s, 4 * s]);
      fillPoly(ctx, L.blade, [7 * s, -3 * s, len - 4 * s, -2.5 * s, len, 0, len - 4 * s, 2.5 * s, 7 * s, 3 * s]);
      fillPoly(ctx, shade(L.blade, 0.4), [7 * s, -3 * s, len - 4 * s, -2.5 * s, len, 0, 7 * s, 0]);
      if (L.gem) fillCirc(ctx, L.gem, 6 * s, 0, 1.6 * s);
      break;
    }
    case 'axe': {
      const len = 26 * s;
      line(ctx, L.hilt, 3.4 * s, -3 * s, 0, len, 0);
      F(ctx, L.blade);
      ctx.beginPath();
      ctx.moveTo(len - 9 * s, -2 * s);
      ctx.quadraticCurveTo(len - 6 * s, -13 * s, len + 3 * s, -12 * s);
      ctx.quadraticCurveTo(len - 1 * s, -2 * s, len + 3 * s, 8 * s);
      ctx.quadraticCurveTo(len - 6 * s, 9 * s, len - 9 * s, 2 * s);
      ctx.closePath(); ctx.fill();
      fillPoly(ctx, shade(L.blade, 0.4), [len - 6 * s, -8 * s, len + 2 * s, -11 * s, len - 1 * s, -3 * s]);
      if (L.gem) fillCirc(ctx, L.gem, len - 6 * s, 0, 2 * s);
      break;
    }
    case 'hammer': {
      const len = 26 * s;
      line(ctx, L.hilt, 3.6 * s, -3 * s, 0, len, 0);
      F(ctx, L.blade);
      roundRect(ctx, len - 6 * s, -9 * s, 12 * s, 18 * s, 2.5 * s); ctx.fill();
      F(ctx, shade(L.blade, 0.35));
      ctx.fillRect(len - 6 * s, -9 * s, 12 * s, 4 * s);
      F(ctx, shade(L.blade, -0.3));
      ctx.fillRect(len - 6 * s, 5 * s, 12 * s, 4 * s);
      if (L.gem) fillCirc(ctx, L.gem, len, 0, 2.4 * s);
      break;
    }
    case 'staff': {
      const len = 30 * s;
      line(ctx, shade(L.hilt, -0.2), 3.8 * s, -4 * s, 0, len - 3 * s, 0);
      line(ctx, L.blade, 2.6 * s, -4 * s, 0, len - 3 * s, 0);
      // claw holder
      line(ctx, L.blade, 2 * s, len - 5 * s, 0, len + 1 * s, -5 * s);
      line(ctx, L.blade, 2 * s, len - 5 * s, 0, len + 1 * s, 5 * s);
      if (L.gem) {
        ctx.globalAlpha *= 0.35; fillCirc(ctx, L.gem, len + 2 * s, 0, 7.5 * s); ctx.globalAlpha /= 0.35;
        fillCirc(ctx, L.gem, len + 2 * s, 0, 4.2 * s);
        fillCirc(ctx, '#ffffff', len + 0.8 * s, -1.4 * s, 1.4 * s);
      }
      break;
    }
  }
}

// ------------------------------------------------------------
// Helmets / hats on a head centered at (hx,hy) radius r (facing right)
// ------------------------------------------------------------
function drawHeadgear(ctx, style, look, hx, hy, r, t) {
  const c1 = look.c1, c2 = look.c2;
  switch (style) {
    case 'cap':
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx - 1, hy - r * 0.35, r * 1.02, r * 0.78, 0, Math.PI, TAU); ctx.fill();
      fillEll(ctx, c2, hx + r * 0.7, hy - r * 0.38, r * 0.6, r * 0.16, 0.08);
      break;
    case 'pot':
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx - 1, hy - r * 0.3, r * 1.08, r * 0.95, 0, Math.PI, TAU); ctx.fill();
      fillEll(ctx, c2, hx - 1, hy - r * 0.3, r * 1.2, r * 0.2);
      fillEll(ctx, shade(c1, 0.4), hx - r * 0.35, hy - r * 0.85, r * 0.28, r * 0.18, -0.4);
      fillCirc(ctx, c2, hx - r * 1.05, hy - r * 0.55, r * 0.2);
      break;
    case 'wizard': {
      const sway = Math.sin(t * 2) * 0.08;
      ctx.save(); ctx.translate(hx - 1, hy - r * 0.55); ctx.rotate(-0.3 + sway);
      fillPoly(ctx, c1, [-r * 0.95, 0, r * 0.95, 0, r * 0.2, -r * 1.9]);
      fillPoly(ctx, shade(c1, -0.25), [r * 0.2, -r * 1.9, -r * 0.95, 0, -r * 0.2, 0]);
      fillEll(ctx, c1, 0, 0, r * 1.35, r * 0.28);
      F(ctx, c2); ctx.fillRect(-r * 0.85, -r * 0.35, r * 1.7, r * 0.26);
      drawStar(ctx, c2, r * 0.1, -r * 1.0, r * 0.28);
      ctx.restore();
      break;
    }
    case 'knight':
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.1, r * 1.1, r * 1.05, 0, Math.PI * 0.9, TAU + 0.1); ctx.fill();
      F(ctx, shade(c1, -0.3)); ctx.fillRect(hx + r * 0.1, hy - r * 0.3, r * 0.9, r * 0.16);
      fillEll(ctx, shade(c1, 0.45), hx - r * 0.3, hy - r * 0.75, r * 0.3, r * 0.2, -0.4);
      // plume
      F(ctx, c2); ctx.beginPath(); ctx.moveTo(hx - r * 0.2, hy - r * 1.05);
      ctx.quadraticCurveTo(hx - r * 1.2, hy - r * 1.9 + Math.sin(t * 5) * 1.5, hx - r * 1.9, hy - r * 0.8);
      ctx.quadraticCurveTo(hx - r * 1.0, hy - r * 1.3, hx + r * 0.2, hy - r * 0.95); ctx.fill();
      break;
    case 'bandana': {
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.35, r * 1.04, r * 0.72, 0, Math.PI, TAU); ctx.fill();
      const fl = Math.sin(t * 8) * 2;
      fillPoly(ctx, c1, [hx - r * 0.95, hy - r * 0.5, hx - r * 1.8, hy - r * 0.9 + fl, hx - r * 1.7, hy - r * 0.2 + fl]);
      fillPoly(ctx, shade(c1, -0.2), [hx - r * 0.95, hy - r * 0.4, hx - r * 1.6, hy + r * 0.1 - fl, hx - r * 1.3, hy + r * 0.4 - fl]);
      fillCirc(ctx, c2, hx - r * 0.1, hy - r * 0.75, r * 0.13);
      fillCirc(ctx, c2, hx + r * 0.45, hy - r * 0.6, r * 0.11);
      break;
    }
    case 'horned':
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.15, r * 1.08, r * 1.0, 0, Math.PI, TAU); ctx.fill();
      F(ctx, shade(c1, -0.3)); ctx.fillRect(hx - r * 1.08, hy - r * 0.3, r * 2.16, r * 0.22);
      F(ctx, c2);
      ctx.beginPath(); ctx.moveTo(hx + r * 0.5, hy - r * 0.8); ctx.quadraticCurveTo(hx + r * 1.5, hy - r * 1.1, hx + r * 1.3, hy - r * 2.0); ctx.quadraticCurveTo(hx + r * 1.0, hy - r * 1.2, hx + r * 0.2, hy - r * 1.0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hx - r * 0.5, hy - r * 0.8); ctx.quadraticCurveTo(hx - r * 1.5, hy - r * 1.1, hx - r * 1.3, hy - r * 2.0); ctx.quadraticCurveTo(hx - r * 1.0, hy - r * 1.2, hx - r * 0.2, hy - r * 1.0); ctx.fill();
      break;
    case 'crown':
      fillPoly(ctx, c1, [hx - r * 0.75, hy - r * 0.7, hx - r * 0.85, hy - r * 1.55, hx - r * 0.4, hy - r * 1.1, hx, hy - r * 1.75, hx + r * 0.4, hy - r * 1.1, hx + r * 0.85, hy - r * 1.55, hx + r * 0.75, hy - r * 0.7]);
      fillCirc(ctx, c2, hx, hy - r * 1.0, r * 0.18);
      fillCirc(ctx, shade(c1, 0.6), hx - r * 0.85, hy - r * 1.55, r * 0.1);
      fillCirc(ctx, shade(c1, 0.6), hx + r * 0.85, hy - r * 1.55, r * 0.1);
      fillCirc(ctx, shade(c1, 0.6), hx, hy - r * 1.75, r * 0.12);
      break;
    case 'hood':
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx - r * 0.2, hy - r * 0.05, r * 1.2, r * 1.15, 0, Math.PI * 0.62, TAU + 0.35); ctx.fill();
      fillPoly(ctx, c1, [hx - r * 1.1, hy - r * 0.2, hx - r * 1.9, hy + r * 0.4, hx - r * 0.9, hy + r * 0.6]);
      line(ctx, c2, r * 0.12, hx + r * 0.9, hy - r * 0.5, hx + r * 0.5, hy + r * 0.6);
      break;
    case 'turban':
      fillEll(ctx, c1, hx - 1, hy - r * 0.6, r * 1.05, r * 0.65);
      fillEll(ctx, shade(c1, -0.12), hx - 1, hy - r * 0.95, r * 0.8, r * 0.45);
      fillCirc(ctx, '#ff5a5a', hx + r * 0.5, hy - r * 0.7, r * 0.16);
      break;
    case 'beanie':
      F(ctx, c1); ctx.beginPath(); ctx.ellipse(hx - 1, hy - r * 0.4, r * 1.05, r * 0.9, 0, Math.PI, TAU); ctx.fill();
      F(ctx, '#ffffff'); ctx.fillRect(hx - r * 1.05, hy - r * 0.55, r * 2.1, r * 0.3);
      fillCirc(ctx, '#ffffff', hx - r * 0.2, hy - r * 1.35, r * 0.3);
      break;
    case 'bow':
      fillPoly(ctx, c1, [hx, hy - r * 0.9, hx - r * 0.7, hy - r * 1.4, hx - r * 0.7, hy - r * 0.5]);
      fillPoly(ctx, c1, [hx, hy - r * 0.9, hx + r * 0.7, hy - r * 1.4, hx + r * 0.7, hy - r * 0.5]);
      fillCirc(ctx, shade(c1, -0.2), hx, hy - r * 0.9, r * 0.22);
      break;
  }
}

function drawStar(ctx, c, x, y, r, points = 5) {
  F(ctx, c); ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

// ------------------------------------------------------------
// Armor over a body ellipse centered (0,-13)
// ------------------------------------------------------------
function drawArmorShape(ctx, item, t) {
  const L = item.look, st = item.style;
  ctx.save();
  ell(ctx, 0, -13, 13.2, 9); ctx.clip();
  if (st === 'robe') {
    F(ctx, L.c1); ctx.fillRect(-14, -22, 28, 20);
    F(ctx, L.c2); ctx.fillRect(-14, -6.5, 28, 2.2); ctx.fillRect(4, -22, 2, 17);
  } else if (st === 'plate') {
    F(ctx, L.c1); ctx.fillRect(-9, -23, 22, 20);
    fillEll(ctx, shade(L.c1, 0.5), 3, -18, 5, 2.2, -0.2);
    F(ctx, L.c2); ctx.fillRect(-9, -9, 22, 2.4); ctx.fillRect(-9, -23, 1.8, 20);
  } else if (st === 'chain') {
    F(ctx, L.c1); ctx.fillRect(-8, -23, 20, 20);
    F(ctx, L.c2);
    for (let yy = -20; yy < -4; yy += 3) for (let xx = -7 + ((yy / 3) & 1) * 1.5; xx < 12; xx += 3) { ctx.fillRect(xx, yy, 1.2, 1.2); }
    F(ctx, shade(L.c2, -0.2)); ctx.fillRect(-8, -9, 20, 2);
  } else if (st === 'leather') {
    F(ctx, L.c1); ctx.fillRect(-7, -23, 18, 20);
    line(ctx, L.c2, 1.6, -3, -21, 9, -6);
    F(ctx, L.c2); ctx.fillRect(-7, -9, 18, 2.2);
    fillCirc(ctx, '#d8c070', 3, -8, 1.3);
  } else { // cloth
    F(ctx, L.c1); ctx.fillRect(-6, -23, 16, 20);
    F(ctx, L.c2); ctx.fillRect(-6, -9, 16, 1.8);
  }
  ctx.restore();
  if (st === 'plate') { // shoulder pauldron
    fillEll(ctx, L.c1, 6, -18, 5, 4);
    fillEll(ctx, shade(L.c1, 0.45), 5, -19.5, 2.5, 1.5);
    fillEll(ctx, L.c2, 6, -15, 5, 1);
  }
}

// ------------------------------------------------------------
// DOG
// ------------------------------------------------------------
// o: {x,y,facing,t,phase,move,attack(-1|0..1),roll(-1|0..1),cast(-1|0..1),dead(0..1),flash,
//     look:{fur,fur2,ear,tail,nose,eye,mask,cheeks,jowls,beard,small}, equip:{weapon,helmet,armor}, scale, alpha, hat, hatColor}
function drawDog(ctx, o) {
  const look = o.look;
  const s = (o.scale || 1) * (look.small ? 0.75 : 1);
  const t = o.t || 0;
  const fur = look.fur, fur2 = look.fur2 || shade(fur, 0.5);
  const dark = shade(fur, -0.22);
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  drawShadow(ctx, 0, 0, 15 * s, 0.25);
  ctx.scale(s * (o.facing || 1), s);
  Art.flash = o.flash || null;

  const move = o.move || 0;
  const ph = o.phase || 0;
  let bob = move > 0.05 ? -Math.abs(Math.sin(ph)) * 2.6 : Math.sin(t * 3) * 0.7;
  let lunge = 0;
  if (o.attack >= 0) lunge = Math.sin(o.attack * Math.PI) * 4;
  if (o.dead > 0) {
    ctx.translate(0, -12); ctx.rotate(-Math.PI / 2 * Math.min(1, o.dead * 2)); ctx.translate(0, 12);
    bob = 0;
  }
  if (o.roll >= 0) {
    ctx.translate(0, -12);
    ctx.rotate(o.roll * TAU);
    ctx.scale(1, 0.9);
    ctx.translate(0, 12);
  }
  ctx.translate(lunge, bob);

  // cast glow
  if (o.cast >= 0) {
    const cc = o.castColor || '#ffe84a';
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * 0.45 * (1 - o.cast);
    fillCirc(ctx, cc, 4, -18, 20 + o.cast * 10);
    ctx.globalAlpha = ga;
  }

  // --- tail (behind) ---
  const wag = Math.sin(t * (move > 0.05 ? 16 : 9)) * (o.dead > 0 ? 0 : 0.45);
  ctx.save(); ctx.translate(-11, -15); ctx.rotate(wag);
  switch (look.tail) {
    case 'feather':
      F(ctx, dark); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -3, -12, -12); ctx.quadraticCurveTo(-6, -6, 1, 3); ctx.fill();
      F(ctx, fur); ctx.beginPath(); ctx.moveTo(0, 1); ctx.quadraticCurveTo(-6, -1, -10, -10); ctx.quadraticCurveTo(-4, -4, 1, 3); ctx.fill();
      break;
    case 'bushy':
      fillEll(ctx, dark, -5, -7, 4.5, 8, -0.5);
      fillEll(ctx, fur2, -7, -12, 3, 3.5, -0.5);
      break;
    case 'curl':
      S(ctx, fur); ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(-2, -7, 5, 0.6, TAU - 0.4); ctx.stroke();
      fillCirc(ctx, fur2, -2, -7, 1.8);
      break;
    case 'stub':
      fillEll(ctx, fur, -2, -1, 3.5, 2.5, -0.5);
      break;
    default:
      fillEll(ctx, fur, -5, -5, 3, 7, -0.6);
  }
  ctx.restore();

  // --- legs ---
  const legSwing = (i) => (o.dead > 0 ? 0 : Math.sin(ph + i) * 0.55 * Math.min(1, move * 1.5));
  const drawLeg = (x, i, col, pawCol) => {
    ctx.save(); ctx.translate(x, -9); ctx.rotate(legSwing(i));
    F(ctx, col); roundRect(ctx, -2.4, 0, 4.8, 9, 2.2); ctx.fill();
    fillEll(ctx, pawCol, 0.6, 8.6, 3.1, 1.8);
    ctx.restore();
  };
  drawLeg(-6, Math.PI, dark, shade(fur2, -0.15));
  drawLeg(8, 0, dark, shade(fur2, -0.15));

  // --- body ---
  fillEll(ctx, fur, 0, -13, 12.5, 8);
  fillEll(ctx, fur2, 2, -9.5, 8.5, 4);
  if (o.equip && o.equip.armor) drawArmorShape(ctx, o.equip.armor, t);
  else { // collar
    F(ctx, look.collar || '#c0303a'); ctx.beginPath(); ctx.ellipse(8, -17, 3, 6.5, 0.3, 0, TAU); ctx.fill();
    fillCirc(ctx, '#ffd23f', 10, -12, 1.8);
  }
  drawLeg(-3, 0, fur, fur2);
  drawLeg(11, Math.PI, fur, fur2);

  // --- head ---
  const hx = 10, hy = -26 + (o.cast >= 0 ? -1.5 : 0), r = 10;
  // far ear
  if (look.ear === 'pointy') {
    fillPoly(ctx, dark, [hx - 7, hy - 5, hx - 5.5, hy - 17, hx - 0.5, hy - 8]);
  }
  fillCirc(ctx, fur, hx, hy, r);
  // face markings
  if (look.mask) {
    F(ctx, fur2); ctx.beginPath(); ctx.moveTo(hx + 1, hy - 7); ctx.quadraticCurveTo(hx + 9, hy - 7, hx + 10, hy + 1); ctx.quadraticCurveTo(hx + 4, hy + 10, hx - 2, hy + 7); ctx.quadraticCurveTo(hx - 1, hy - 2, hx + 1, hy - 7); ctx.fill();
  }
  if (look.cheeks) fillEll(ctx, fur2, hx + 4, hy + 4, 6.5, 4.5, 0.2);
  // snout
  const sx = hx + 8, sy = hy + 3.5;
  if (look.jowls) {
    fillEll(ctx, fur2, sx - 1, sy + 1.5, 7, 5.5);
    fillEll(ctx, shade(fur2, -0.1), sx - 3, sy + 4.5, 4, 3);
    F(ctx, '#ffffff'); ctx.fillRect(sx + 1, sy + 1.5, 1.4, 1.8); ctx.fillRect(sx + 3.2, sy + 1.2, 1.4, 1.8);
  } else {
    fillEll(ctx, look.mask || look.cheeks ? fur2 : shade(fur, 0.18), sx, sy, 6.5, 4.3, 0.08);
  }
  // mouth + tongue
  const pant = (move > 0.4 || (t % 5) < 1.2) && !(o.dead > 0);
  if (pant) {
    fillEll(ctx, '#e8606a', sx + 1, sy + 4.4 + Math.sin(t * 14) * 0.5, 2.2, 2.8);
  }
  S(ctx, '#3a2418'); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(sx + 5, sy + 1); ctx.quadraticCurveTo(sx + 2, sy + 3.5, sx - 2, sy + 2); ctx.stroke();
  fillEll(ctx, look.nose || '#2a1a12', sx + 5.5, sy - 1.8, 2.6, 2.1);
  fillCirc(ctx, 'rgba(255,255,255,0.6)', sx + 4.8, sy - 2.6, 0.8);
  if (look.beard) {
    F(ctx, '#f4f0ea'); ctx.beginPath(); ctx.moveTo(sx - 4, sy + 3); ctx.quadraticCurveTo(sx, sy + 13, sx + 3, sy + 3); ctx.fill();
  }
  // eye
  const blink = (Math.sin(t * 0.9 + (o.seed || 0)) > 0.985) || o.dead > 0;
  const ex = hx + 4, ey = hy - 2;
  if (blink) {
    if (o.dead > 0) { line(ctx, '#2a1a12', 1.2, ex - 2, ey - 2, ex + 2, ey + 2); line(ctx, '#2a1a12', 1.2, ex - 2, ey + 2, ex + 2, ey - 2); }
    else line(ctx, '#2a1a12', 1.3, ex - 2.2, ey, ex + 2.2, ey);
  } else {
    fillEll(ctx, '#ffffff', ex, ey, 2.8, 3.2);
    fillEll(ctx, look.eye || '#2a1a12', ex + 0.6, ey + 0.2, 2.1, 2.6);
    fillCirc(ctx, '#1a0e08', ex + 0.8, ey + 0.4, 1.2);
    fillCirc(ctx, '#ffffff', ex + 1.4, ey - 0.9, 0.9);
  }
  // brow
  line(ctx, shade(fur, -0.4), 1.1, ex - 2.5, ey - 4.6, ex + 2, ey - 4.2);
  // blush
  fillEll(ctx, 'rgba(255,120,140,0.35)', hx + 2, hy + 4, 2.4, 1.4);
  // near ear
  if (look.ear === 'floppy') {
    fillEll(ctx, dark, hx - 4.5, hy + 1 + Math.sin(ph) * move * 1.2, 4.2, 8, 0.35);
  } else if (look.ear === 'pointy') {
    fillPoly(ctx, fur, [hx - 3, hy - 6, hx - 1, hy - 19, hx + 4.5, hy - 8]);
    fillPoly(ctx, '#f0a8b0', [hx - 1.5, hy - 7.5, hx - 0.6, hy - 15, hx + 2.5, hy - 8.5]);
  } else if (look.ear === 'rose') {
    fillPoly(ctx, dark, [hx - 5, hy - 5, hx - 4, hy - 12, hx + 1, hy - 8]);
  }
  // headgear
  const helm = o.equip && o.equip.helmet;
  if (helm) drawHeadgear(ctx, helm.style, helm.look, hx, hy, r, t);
  else if (look.hat && look.hat !== 'none') drawHeadgear(ctx, look.hat, { c1: look.hatColor || '#c0303a', c2: '#ffd23f' }, hx, hy, r, t);
  if (look.bow) drawHeadgear(ctx, 'bow', { c1: look.bow }, hx - 3, hy + 1, r, t);

  // --- weapon ---
  const w = o.equip && o.equip.weapon;
  if (w && !(o.dead > 0)) {
    let ang = -0.62 + Math.sin(t * 3) * 0.05;
    if (o.attack >= 0) {
      const p = o.attack;
      if (o.attackUp) ang = p < 0.25 ? lerp(-0.62, 1.4, p / 0.25) : lerp(1.4, -1.9, easeOutCubic((p - 0.25) / 0.75));
      else ang = p < 0.25 ? lerp(-0.62, -2.3, p / 0.25) : lerp(-2.3, 1.2, easeOutCubic((p - 0.25) / 0.75));
    } else if (o.cast >= 0) ang = -1.4;
    ctx.save(); ctx.translate(13, -10); ctx.rotate(ang);
    drawWeaponShape(ctx, w, 1);
    ctx.restore();
    fillCirc(ctx, fur2, 13, -10, 2.8); // paw holding it
  }
  Art.flash = null;
  ctx.restore();
}

// ------------------------------------------------------------
// CAT (enemy)
// ------------------------------------------------------------
// o: {x,y,facing,t,phase,move,windup(-1|0..1),attack(-1|0..1),dead,flash,def,scale,alpha,phase2}
function drawCat(ctx, o) {
  const d = o.def;
  const s = o.scale || 1;
  const t = o.t || 0;
  const fur = d.fur, belly = d.belly || shade(fur, 0.4), stripe = d.stripe || shade(fur, -0.4);
  const dark = shade(fur, -0.2);
  const pat = d.pattern;
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  drawShadow(ctx, 0, 0, (d.lion ? 17 : 14) * s, 0.28);
  let sy = 1, sx = 1;
  if (o.windup >= 0) { sy = 1 - 0.1 * o.windup; sx = 1 + 0.06 * o.windup; }
  ctx.scale(s * (o.facing || 1) * sx, s * sy);
  if (o.windup >= 0) ctx.translate(Math.sin(t * 60) * 0.7 * o.windup, 0);
  Art.flash = o.flash || null;
  const move = o.move || 0, ph = o.phase || 0;
  let bob = move > 0.05 ? -Math.abs(Math.sin(ph)) * 2.2 : Math.sin(t * 2.5) * 0.6;
  if (o.attack >= 0) ctx.translate(Math.sin(o.attack * Math.PI) * 6, 0);
  if (o.dead > 0) { ctx.translate(0, -10); ctx.rotate(-Math.PI / 2 * Math.min(1, o.dead * 2.5)); ctx.translate(0, 10); bob = 0; }
  ctx.translate(0, bob);
  const fluffy = pat === 'fluffy';
  const lion = d.lion;

  // --- tail ---
  const tw = Math.sin(t * 2.6 + (o.seed || 0)) * 5;
  const puff = o.windup >= 0 ? 1.6 : 1;
  S(ctx, fur); ctx.lineCap = 'round'; ctx.lineWidth = (fluffy ? 7 : 4.2) * puff;
  ctx.beginPath(); ctx.moveTo(-11, -14);
  ctx.bezierCurveTo(-22, -14 + tw * 0.3, -18 + tw, -30, -26 + tw * 0.6, -34);
  ctx.stroke();
  if (pat === 'stripes' || pat === 'points' || lion) {
    S(ctx, lion ? '#6a3a14' : stripe); ctx.lineWidth = (fluffy ? 7 : 4.3) * puff;
    ctx.beginPath(); ctx.moveTo(-25 + tw * 0.6, -31); ctx.lineTo(-26 + tw * 0.6, -34.5); ctx.stroke();
    if (lion) fillCirc(ctx, '#6a3a14', -26 + tw * 0.6, -35, 5);
  }

  // --- legs (far) ---
  const legSwing = (i) => (o.dead > 0 ? 0 : Math.sin(ph + i) * 0.6 * Math.min(1, move * 1.5));
  const legW = lion ? 5.5 : 3.8;
  const drawLeg = (x, i, col) => {
    ctx.save(); ctx.translate(x, -9); ctx.rotate(legSwing(i));
    F(ctx, col); roundRect(ctx, -legW / 2, 0, legW, 9.2, 1.8); ctx.fill();
    fillEll(ctx, pat === 'points' ? stripe : shade(col, 0.1), 0.5, 8.8, legW * 0.6, 1.6);
    ctx.restore();
  };
  drawLeg(-7, Math.PI, dark); drawLeg(8, 0, dark);

  // --- body ---
  if (fluffy) {
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; fillCirc(ctx, fur, Math.cos(a) * 10, -13 + Math.sin(a) * 6, 5.5); }
  }
  fillEll(ctx, fur, 0, -13, lion ? 14 : 13, lion ? 8.5 : 7.4);
  fillEll(ctx, belly, 2, -9.8, 9, 3.4);
  ctx.save(); ell(ctx, 0, -13, 13, 7.4); ctx.clip();
  if (pat === 'stripes') {
    S(ctx, stripe); ctx.lineWidth = 2.2;
    for (let i = -8; i <= 6; i += 4.5) { ctx.beginPath(); ctx.moveTo(i, -21); ctx.quadraticCurveTo(i + 2.5, -15, i - 0.5, -10); ctx.stroke(); }
  } else if (pat === 'spots') {
    F(ctx, stripe);
    const sp = [[-8, -16], [-3, -18], [3, -17], [7, -14], [-5, -12], [1, -13], [-10, -12], [5, -19]];
    for (const [a, b] of sp) { ell(ctx, a, b, 1.5, 1.2); ctx.fill(); }
  } else if (pat === 'bandage') {
    S(ctx, '#e8dcc0'); ctx.lineWidth = 2.4;
    for (let i = -10; i < 12; i += 5) { ctx.beginPath(); ctx.moveTo(i, -21); ctx.lineTo(i + 5, -6); ctx.stroke(); }
  } else if (pat === 'hairless') {
    S(ctx, shade(fur, -0.18)); ctx.lineWidth = 0.8;
    for (let i = -6; i < 6; i += 4) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.quadraticCurveTo(i + 2, -15, i, -12); ctx.stroke(); }
  }
  ctx.restore();

  // armor / body accessories
  if (d.acc === 'knighthelm' || d.acc === 'samurai' || d.armored) {
    ctx.save(); ell(ctx, 0, -13, 13.5, 8); ctx.clip();
    F(ctx, d.acc === 'samurai' ? (d.accColor || '#8a1f2a') : '#aab4c0'); ctx.fillRect(-6, -22, 17, 16);
    F(ctx, d.acc === 'samurai' ? '#ffd23f' : '#6a7682'); for (let yy = -19; yy < -6; yy += 4) ctx.fillRect(-6, yy, 17, 1.3);
    ctx.restore();
  }
  if (d.acc === 'bow') { // quiver on back
    F(ctx, '#7a4a22'); ctx.save(); ctx.translate(-5, -20); ctx.rotate(-0.6); ctx.fillRect(-2.5, -8, 5, 12);
    line(ctx, '#f4f0e6', 1, -1, -8, -1, -11); line(ctx, '#f4f0e6', 1, 1, -8, 1.5, -11);
    fillPoly(ctx, '#c0303a', [-1.5, -11, -0.5, -13, 0.5, -11]); ctx.restore();
  }
  if (lion) { // royal cape
    F(ctx, '#a01e2a'); ctx.beginPath(); ctx.moveTo(6, -20); ctx.quadraticCurveTo(-8, -26, -16, -10 + Math.sin(t * 3) * 1.5); ctx.lineTo(-12, -5); ctx.quadraticCurveTo(-2, -12, 6, -14); ctx.fill();
    F(ctx, '#ffd23f'); ctx.fillRect(-16, -11 + Math.sin(t * 3) * 1.5, 5, 1.6);
  }
  if (d.acc === 'scarf') {
    F(ctx, d.accColor); ctx.beginPath(); ctx.ellipse(8, -17, 3.5, 6.5, 0.3, 0, TAU); ctx.fill();
    const fl = Math.sin(t * 7) * 2;
    fillPoly(ctx, d.accColor, [6, -18, -4, -22 + fl, -3, -17 + fl]);
  }
  if (d.acc === 'collar') {
    F(ctx, d.accColor); ctx.beginPath(); ctx.ellipse(8, -17, 3, 6.5, 0.3, 0, TAU); ctx.fill();
  }

  // near legs
  drawLeg(-4, 0, fur); drawLeg(11, Math.PI, fur);

  // --- head ---
  const hx = 11, hy = -23, r = lion ? 10.5 : 9;
  if (lion) { // mane
    const mc = o.phase2 ? '#7a1a0a' : '#8a4a1a';
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + Math.sin(t * 2) * 0.05;
      const rr = 17 + Math.sin(t * 6 + i) * 1.2;
      fillPoly(ctx, i % 2 ? mc : shade(mc, 0.15), [hx - 1 + Math.cos(a - 0.3) * 9, hy + Math.sin(a - 0.3) * 9, hx - 1 + Math.cos(a) * rr, hy + Math.sin(a) * rr, hx - 1 + Math.cos(a + 0.3) * 9, hy + Math.sin(a + 0.3) * 9]);
    }
    fillCirc(ctx, mc, hx - 1, hy, 13);
  } else if (fluffy) {
    fillCirc(ctx, belly, hx - 2, hy + 5, 8); // ruff
  }
  // ears
  const earCol = pat === 'points' ? stripe : fur;
  const earH = pat === 'hairless' ? 1.25 : lion ? 0.6 : 1;
  const earTw = o.windup >= 0 ? -0.2 : Math.sin(t * 1.3 + (o.seed || 0)) > 0.97 ? 0.3 : 0;
  ctx.save(); ctx.translate(hx - 4, hy - 6); ctx.rotate(earTw);
  fillPoly(ctx, shade(earCol, -0.15), [-4, 2, -2, -11 * earH, 4, 0]);
  ctx.restore();
  fillCirc(ctx, fur, hx, hy, r);
  if (d.acc === 'bandage' || pat === 'bandage') { S(ctx, '#e8dcc0'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 8, hy - 3); ctx.lineTo(hx + 8, hy - 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(hx - 7, hy + 3); ctx.lineTo(hx + 7, hy + 1); ctx.stroke(); }
  if (pat === 'stripes') {
    S(ctx, stripe); ctx.lineWidth = 1.6;
    for (let i = -3; i <= 3; i += 3) { ctx.beginPath(); ctx.moveTo(hx + i, hy - 9); ctx.lineTo(hx + i + 0.8, hy - 5); ctx.stroke(); }
  }
  if (pat === 'points') fillEll(ctx, stripe, hx + 5, hy + 2, 6, 5.5, 0.2);
  // muzzle
  fillEll(ctx, pat === 'points' ? shade(stripe, 0.15) : belly, hx + 6, hy + 3.5, 4.8, 3.4);
  if (d.tears) { line(ctx, '#1a0e08', 1.3, hx + 4, hy + 0, hx + 5, hy + 5.5); }
  // near ear
  ctx.save(); ctx.translate(hx + 3, hy - 6.5); ctx.rotate(earTw * 0.6);
  fillPoly(ctx, earCol, [-4, 1.5, 1, -12 * earH, 5, 1.5]);
  fillPoly(ctx, pat === 'hairless' ? '#e89890' : '#f0a0b0', [-2, 0.5, 1, -8 * earH, 3, 0.8]);
  if (d.tufts) fillPoly(ctx, '#1a0e08', [0, -10 * earH, 1, -16 * earH, 2, -10 * earH]);
  ctx.restore();
  // eye (angry)
  const ex = hx + 4.5, ey = hy - 1.5;
  const eyeCol = o.phase2 ? '#ff3a2a' : (d.eye || '#f5d142');
  if (o.dead > 0) {
    line(ctx, '#1a0e08', 1.2, ex - 2, ey - 2, ex + 2, ey + 2); line(ctx, '#1a0e08', 1.2, ex - 2, ey + 2, ex + 2, ey - 2);
  } else if (d.acc === 'eyepatch') {
    fillEll(ctx, '#1a1a1a', ex, ey, 3, 2.8);
    line(ctx, '#1a1a1a', 1, hx - 8, hy - 7, ex + 3, ey - 1);
  } else {
    fillEll(ctx, eyeCol, ex, ey, 2.9, 2.3, -0.15);
    fillEll(ctx, '#140a04', ex + 0.4, ey, 0.8, 2.1);
    fillCirc(ctx, '#ffffff', ex + 1.3, ey - 0.9, 0.7);
    if (o.windup >= 0 || o.phase2) { ctx.globalAlpha *= 0.4; fillCirc(ctx, eyeCol, ex, ey, 5); ctx.globalAlpha /= 0.4; }
  }
  line(ctx, shade(fur, -0.5), 1.4, ex - 3, ey - 4.2, ex + 3, ey - 2.4); // angry brow
  // nose, mouth, whiskers
  fillPoly(ctx, '#e87890', [hx + 9.5, hy + 1.6, hx + 11.5, hy + 1.8, hx + 10.3, hy + 3.2]);
  S(ctx, '#3a2018'); ctx.lineWidth = 0.8; ctx.beginPath();
  ctx.moveTo(hx + 10.3, hy + 3.2); ctx.quadraticCurveTo(hx + 9.5, hy + 5.4, hx + 8, hy + 4.6);
  ctx.moveTo(hx + 10.3, hy + 3.2); ctx.quadraticCurveTo(hx + 11, hy + 5.4, hx + 12, hy + 4.6); ctx.stroke();
  if (o.windup >= 0 || o.attack >= 0) { // fangs
    F(ctx, '#ffffff'); poly(ctx, [hx + 8.6, hy + 4.6, hx + 9.4, hy + 7, hx + 10, hy + 4.8]); ctx.fill();
  }
  S(ctx, 'rgba(255,255,255,0.8)'); ctx.lineWidth = 0.6; ctx.beginPath();
  ctx.moveTo(hx + 9, hy + 3); ctx.lineTo(hx + 17, hy + 1);
  ctx.moveTo(hx + 9, hy + 3.6); ctx.lineTo(hx + 17.5, hy + 3.8);
  ctx.moveTo(hx + 9, hy + 4.2); ctx.lineTo(hx + 16.5, hy + 6.5); ctx.stroke();

  // --- head accessories ---
  const ac = d.accColor || '#c0303a';
  switch (d.acc) {
    case 'bandana': drawHeadgear(ctx, 'bandana', { c1: ac, c2: '#ffffff' }, hx, hy, r, t); break;
    case 'witchhat': {
      ctx.save(); ctx.translate(hx - 1, hy - 6); ctx.rotate(-0.25 + Math.sin(t * 2) * 0.06);
      fillEll(ctx, ac, 0, 0, 13, 3);
      F(ctx, ac); ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.quadraticCurveTo(2, -10, -2, -20); ctx.quadraticCurveTo(-6, -24, -12, -22); ctx.quadraticCurveTo(-6, -14, -7, 0); ctx.fill();
      F(ctx, d.element === 'ice' ? '#9ff4ff' : '#b6ff4a'); ctx.fillRect(-7, -3.5, 14, 2.5);
      ctx.restore();
      break;
    }
    case 'mask':
      F(ctx, ac); ctx.fillRect(hx - 3, hy - 4, 12, 4.5);
      fillEll(ctx, d.eye, hx + 4.5, hy - 1.8, 2.2, 1.6);
      break;
    case 'knighthelm': drawHeadgear(ctx, 'knight', { c1: '#c8d2dc', c2: '#3a6ab5' }, hx, hy, r, t); break;
    case 'horns': drawHeadgear(ctx, 'horned', { c1: '#8a8a94', c2: '#f4f0e6' }, hx, hy, r, t); break;
    case 'ninjamask': {
      F(ctx, '#1e1e26'); ctx.beginPath(); ctx.arc(hx, hy, r + 0.5, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
      F(ctx, ac); ctx.fillRect(hx - r, hy - 5.5, r * 2, 2.6);
      const fl = Math.sin(t * 9) * 2;
      fillPoly(ctx, ac, [hx - r, hy - 5, hx - r - 9, hy - 8 + fl, hx - r - 8, hy - 3 + fl]);
      F(ctx, '#1e1e26'); ctx.beginPath(); ctx.ellipse(hx + 5, hy + 4, 6, 3.6, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'samurai': drawHeadgear(ctx, 'horned', { c1: ac, c2: '#ffd23f' }, hx, hy, r, t); break;
    case 'crown': drawHeadgear(ctx, 'crown', { c1: ac, c2: '#c0303a' }, hx, hy - (lion ? 3 : 0), r, t); break;
    case 'tiara': drawHeadgear(ctx, 'crown', { c1: ac, c2: '#4fb8ff' }, hx, hy + 2, r * 0.75, t); break;
    case 'pirate': {
      F(ctx, ac); ctx.beginPath(); ctx.moveTo(hx - 13, hy - 7); ctx.quadraticCurveTo(hx, hy - 22, hx + 13, hy - 7); ctx.quadraticCurveTo(hx, hy - 11, hx - 13, hy - 7); ctx.fill();
      drawSkull(ctx, hx, hy - 12, 2.2);
      break;
    }
    case 'hardhat':
      F(ctx, ac); ctx.beginPath(); ctx.ellipse(hx, hy - 4, r * 1.05, r * 0.85, 0, Math.PI, TAU); ctx.fill();
      fillEll(ctx, shade(ac, -0.2), hx + 2, hy - 4, r * 1.3, 1.8);
      fillCirc(ctx, '#fff8c0', hx + 6, hy - 9, 2.2);
      break;
    case 'pharaoh': {
      F(ctx, ac); ctx.beginPath(); ctx.moveTo(hx - 9, hy - 5); ctx.quadraticCurveTo(hx, hy - 16, hx + 9, hy - 5); ctx.lineTo(hx + 4, hy + 6); ctx.lineTo(hx - 12, hy + 10); ctx.closePath(); ctx.fill();
      S(ctx, '#2a4a8a'); ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - 8 + i * 0.8, hy - 3 + i * 3); ctx.lineTo(hx + 5 - i * 0.6, hy - 4 + i * 2.8); ctx.stroke(); }
      fillCirc(ctx, '#c0303a', hx + 1, hy - 10, 1.8);
      break;
    }
    case 'eyepatch': break;
  }
  // held weapons
  if (d.acc === 'bow' && !(o.dead > 0)) {
    ctx.save(); ctx.translate(16, -13);
    S(ctx, '#8a5a2a'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-4, 0, 10, -1.2, 1.2); ctx.stroke();
    const pull = o.windup >= 0 ? o.windup * 5 : 0;
    S(ctx, '#f4f0e6'); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-0.4, -9.3); ctx.lineTo(-pull, 0); ctx.lineTo(-0.4, 9.3); ctx.stroke();
    if (o.windup >= 0) { line(ctx, '#d8c8a8', 1.2, -pull, 0, 10 - pull, 0); fillPoly(ctx, '#aab4c0', [10 - pull, -2, 14 - pull, 0, 10 - pull, 2]); }
    ctx.restore();
  }
  if ((d.acc === 'mask' || d.id === 'sphynx') && !(o.dead > 0)) { ctx.save(); ctx.translate(14, -11); ctx.rotate(o.attack >= 0 ? 0.6 : -0.6); drawWeaponShape(ctx, ITEMS.fang_dagger, 0.8); ctx.restore(); }
  if (d.acc === 'club' && !(o.dead > 0)) {
    ctx.save(); ctx.translate(13, -12); ctx.rotate(o.windup >= 0 ? -2.2 : o.attack >= 0 ? 1.0 : -1.0);
    line(ctx, '#6b4520', 3.4, 0, 0, 14, 0); fillEll(ctx, '#8a5a2a', 18, 0, 7, 4.8); fillCirc(ctx, '#6b4520', 20, -2, 1.2);
    ctx.restore();
  }
  if (d.acc === 'samurai' && !(o.dead > 0)) { ctx.save(); ctx.translate(13, -12); ctx.rotate(o.windup >= 0 ? -2.3 : o.attack >= 0 ? 1.1 : -0.9); drawWeaponShape(ctx, { type: 'sword', look: { blade: '#e6eef6', hilt: '#1a1a1a' } }, 1); ctx.restore(); }
  if (d.acc === 'knighthelm' && !(o.dead > 0)) { ctx.save(); ctx.translate(13, -12); ctx.rotate(o.windup >= 0 ? -2.1 : o.attack >= 0 ? 1.0 : -1.0); drawWeaponShape(ctx, { type: 'sword', look: { blade: '#dfe6ee', hilt: '#3a6ab5' } }, 1); ctx.restore(); }
  if (d.acc === 'ninjamask' && !(o.dead > 0)) { ctx.save(); ctx.translate(-4, -19); ctx.rotate(-0.8); line(ctx, '#1a1a1a', 2, 0, 0, 16, 0); line(ctx, '#c8d2dc', 1.6, 16, 0, 26, 0); ctx.restore(); }
  if (d.acc === 'pirate' && !(o.dead > 0)) { ctx.save(); ctx.translate(13, -12); ctx.rotate(o.attack >= 0 ? 1.0 : -1.0); drawWeaponShape(ctx, { type: 'sword', look: { blade: '#dfe6ee', hilt: '#ffd23f' } }, 0.9); ctx.restore(); }
  Art.flash = null;
  ctx.restore();
}

function drawSkull(ctx, x, y, s) {
  fillCirc(ctx, '#f4f0e6', x, y, s * 1.6);
  F(ctx, '#f4f0e6'); ctx.fillRect(x - s, y, s * 2, s * 1.4);
  fillCirc(ctx, '#1a1a1a', x - s * 0.6, y, s * 0.45);
  fillCirc(ctx, '#1a1a1a', x + s * 0.6, y, s * 0.45);
}

// ------------------------------------------------------------
// Icons
// ------------------------------------------------------------
function drawItemIcon(ctx, item, x, y, size, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 40;
  ctx.scale(s, s);
  if (item.slot === 'weapon') {
    ctx.rotate(-Math.PI / 4);
    const len = item.type === 'staff' ? 30 : item.type === 'dagger' ? 18 : 26;
    ctx.translate(-len / 2 + 2, 0);
    drawWeaponShape(ctx, item, 1);
  } else if (item.slot === 'helmet') {
    fillCirc(ctx, 'rgba(255,255,255,0.12)', 0, 4, 11);
    drawHeadgear(ctx, item.style, item.look, 0, 6, 11, t);
  } else if (item.slot === 'armor') {
    const L = item.look;
    F(ctx, L.c1); roundRect(ctx, -11, -12, 22, 24, 5); ctx.fill();
    F(ctx, L.c2); ctx.fillRect(-11, 4, 22, 3);
    fillEll(ctx, L.c1, -12, -9, 5, 4); fillEll(ctx, L.c1, 12, -9, 5, 4);
    fillEll(ctx, shade(L.c1, 0.4), -4, -6, 4, 2.5, -0.3);
    if (item.style === 'chain') { F(ctx, L.c2); for (let yy = -9; yy < 3; yy += 3) for (let xx = -8; xx < 9; xx += 3) ctx.fillRect(xx, yy, 1.2, 1.2); }
    if (item.style === 'robe') { F(ctx, L.c2); ctx.fillRect(-1, -12, 2, 24); }
    F(ctx, 'rgba(0,0,0,0.35)'); ell(ctx, 0, -12, 5, 3); ctx.fill();
  }
  ctx.restore();
}

function drawSpellIcon(ctx, id, x, y, size, t = 0) {
  const sp = SPELLS[id];
  ctx.save(); ctx.translate(x, y); const s = size / 40; ctx.scale(s, s);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  g.addColorStop(0, shade(sp.color, 0.3)); g.addColorStop(1, shade(sp.color, -0.45));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = shade(sp.color, 0.5); ctx.stroke();
  const w = '#ffffff';
  switch (id) {
    case 'flame':
      F(ctx, '#fff2a0'); ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(9, -2, 6, 6); ctx.quadraticCurveTo(0, 12, -6, 6); ctx.quadraticCurveTo(-8, -1, -3, -4); ctx.quadraticCurveTo(-2, 1, 0, 2); ctx.quadraticCurveTo(-2, -5, 0, -11); ctx.fill();
      break;
    case 'heal':
      F(ctx, w); ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -7, -13, 0, -5); ctx.bezierCurveTo(7, -13, 14, -1, 0, 9); ctx.fill();
      break;
    case 'thunder': fillPoly(ctx, '#fffbe0', [3, -13, -7, 2, -1, 2, -4, 13, 8, -3, 1, -3]); break;
    case 'frost':
      S(ctx, w); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * -11, Math.sin(a) * -11); ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.stroke(); }
      break;
    case 'shield': drawBone(ctx, 0, 0, 20, 0.7, '#fffdf4'); break;
    case 'quake':
      S(ctx, '#3a2a18'); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(-5, -3); ctx.lineTo(-1, 4); ctx.lineTo(4, -4); ctx.lineTo(12, 1); ctx.stroke();
      fillPoly(ctx, '#6a5030', [-12, 6, 12, 6, 12, 12, -12, 12]);
      break;
    case 'spirit':
      F(ctx, 'rgba(255,255,255,0.9)'); ctx.beginPath(); ctx.moveTo(-9, 10); ctx.quadraticCurveTo(-11, -6, -3, -9); ctx.lineTo(-4, -14); ctx.lineTo(0, -10); ctx.lineTo(4, -14); ctx.lineTo(4, -8); ctx.quadraticCurveTo(12, -3, 10, 10); ctx.quadraticCurveTo(6, 6, 3, 10); ctx.quadraticCurveTo(0, 6, -3, 10); ctx.quadraticCurveTo(-6, 6, -9, 10); ctx.fill();
      fillCirc(ctx, '#3a4a8a', -3, -2, 1.6); fillCirc(ctx, '#3a4a8a', 4, -2, 1.6);
      break;
    case 'meteor':
      F(ctx, 'rgba(255,220,120,0.7)'); ctx.beginPath(); ctx.moveTo(-12, -12); ctx.lineTo(4, -2); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
      fillCirc(ctx, '#6a3a2a', 4, 4, 7); fillCirc(ctx, '#8a5a3a', 2, 2, 3);
      break;
  }
  ctx.restore();
}

function drawBone(ctx, x, y, len, s = 1, col = '#f4f0e6', rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const h = len / 2;
  F(ctx, col);
  ctx.fillRect(-h + 3 * s, -2.2 * s, len - 6 * s, 4.4 * s);
  for (const sx of [-h + 3 * s, h - 3 * s]) { fillCirc(ctx, col, sx, -2.6 * s, 3 * s); fillCirc(ctx, col, sx, 2.6 * s, 3 * s); }
  ctx.restore();
}

function drawKey(ctx, tier, x, y, size, rot = 0) {
  const k = KEYS[tier];
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const s = size / 30; ctx.scale(s, s);
  S(ctx, k.dark); ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(-7, 0, 6, 0, TAU); ctx.stroke();
  S(ctx, k.color); ctx.lineWidth = 4; ctx.stroke();
  F(ctx, k.dark); ctx.fillRect(-1, -3, 17, 6);
  F(ctx, k.color); ctx.fillRect(-1, -2, 16, 4); ctx.fillRect(10, 1, 3, 6); ctx.fillRect(5, 1, 3, 4);
  fillCirc(ctx, 'rgba(255,255,255,0.6)', -9, -3, 1.5);
  ctx.restore();
}

// tier 0 = boss reward chest
function drawChest(ctx, x, y, tier, open, t, locked) {
  const cols = [
    { body: '#b8302a', band: '#ffd23f', lid: '#d8403a' },
    { body: '#8a5a2a', band: '#5a3a1a', lid: '#a06a3a' },
    { body: '#a0602a', band: '#d08a45', lid: '#b8763a' },
    { body: '#6a7682', band: '#d9e2ea', lid: '#8898a8' },
    { body: '#b8860b', band: '#fff0a0', lid: '#dba520' },
    { body: '#5a2a8a', band: '#c07cff', lid: '#7a3ab5' },
  ][tier];
  ctx.save(); ctx.translate(x, y);
  drawShadow(ctx, 0, 0, 16, 0.3);
  if (!open && (tier === 0 || !locked)) { // sparkle
    const a = 0.3 + Math.sin(t * 4) * 0.2;
    ctx.globalAlpha *= a; fillCirc(ctx, tier ? KEYS[tier].color : '#ffd23f', 0, -12, 20); ctx.globalAlpha /= a;
  }
  F(ctx, shade(cols.body, -0.25)); roundRect(ctx, -15, -18, 30, 18, 3); ctx.fill();
  F(ctx, cols.body); roundRect(ctx, -14, -17, 28, 16, 3); ctx.fill();
  F(ctx, cols.band); ctx.fillRect(-10, -18, 3.5, 18); ctx.fillRect(6.5, -18, 3.5, 18);
  if (open) {
    F(ctx, '#2a1a0a'); ctx.fillRect(-13, -20, 26, 4);
    F(ctx, cols.lid); ctx.save(); ctx.translate(0, -18); ctx.scale(1, -0.5);
    roundRect(ctx, -15, 0, 30, 12, 5); ctx.fill(); ctx.restore();
  } else {
    F(ctx, shade(cols.lid, -0.2)); roundRect(ctx, -15, -27, 30, 11, 6); ctx.fill();
    F(ctx, cols.lid); roundRect(ctx, -14, -26, 28, 9, 5); ctx.fill();
    F(ctx, cols.band); ctx.fillRect(-10, -27, 3.5, 11); ctx.fillRect(6.5, -27, 3.5, 11);
    // lock
    const lc = tier ? KEYS[tier].color : '#ffd23f';
    F(ctx, shade(lc, -0.3)); roundRect(ctx, -4, -20, 8, 9, 2); ctx.fill();
    F(ctx, lc); roundRect(ctx, -3.2, -19.2, 6.4, 7.4, 1.6); ctx.fill();
    fillCirc(ctx, '#1a1a1a', 0, -16.5, 1.2); F(ctx, '#1a1a1a'); ctx.fillRect(-0.5, -16.5, 1, 3);
  }
  ctx.restore();
}

function drawCoin(ctx, x, y, t, r = 5) {
  const w = Math.abs(Math.cos(t * 6)) * r + 0.8;
  fillEll(ctx, '#b8860b', x, y, w, r);
  fillEll(ctx, '#ffd23f', x, y, Math.max(0.5, w - 1.3), r - 1.3);
  if (w > 2.5) fillEll(ctx, '#fff8c0', x - w * 0.3, y - r * 0.3, w * 0.25, r * 0.3);
}

function drawHeart(ctx, x, y, s, c = '#ff4a6a') {
  F(ctx, c); ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); ctx.fill();
}

function drawPaw(ctx, x, y, s, c) {
  fillEll(ctx, c, x, y + s * 0.35, s * 0.62, s * 0.5);
  fillEll(ctx, c, x - s * 0.62, y - s * 0.25, s * 0.24, s * 0.3, -0.3);
  fillEll(ctx, c, x - s * 0.22, y - s * 0.6, s * 0.24, s * 0.3, -0.1);
  fillEll(ctx, c, x + s * 0.22, y - s * 0.6, s * 0.24, s * 0.3, 0.1);
  fillEll(ctx, c, x + s * 0.62, y - s * 0.25, s * 0.24, s * 0.3, 0.3);
}

// ------------------------------------------------------------
// World props
// ------------------------------------------------------------
function drawTree(ctx, x, y, kind, seed, t) {
  const sway = Math.sin(t * 1.3 + seed * 10) * 1.5;
  const sc = 0.85 + (seed % 1) * 0.35;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  drawShadow(ctx, 0, 0, 16, 0.25);
  switch (kind) {
    case 'oak': case 'dark': {
      const c = kind === 'oak' ? ['#2f6a2a', '#3f8a34', '#56a844', '#6cc04e'] : ['#1f2f3a', '#2a4048', '#34525a', '#40686a'];
      F(ctx, kind === 'oak' ? '#6b4520' : '#3a2a28'); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-3, -22); ctx.lineTo(3, -22); ctx.lineTo(4, 0); ctx.fill();
      fillCirc(ctx, c[0], sway * 0.5, -32, 17);
      fillCirc(ctx, c[1], -8 + sway * 0.7, -34, 11);
      fillCirc(ctx, c[1], 8 + sway * 0.7, -30, 11);
      fillCirc(ctx, c[2], sway, -40, 11);
      fillCirc(ctx, c[3], -4 + sway, -44, 5);
      if (kind === 'dark') { fillCirc(ctx, '#b46cff', 6 + sway, -36, 1.5); fillCirc(ctx, '#b46cff', -9 + sway, -28, 1.2); }
      else if (seed % 0.37 < 0.12) { fillCirc(ctx, '#e8403a', 7 + sway, -32, 2); fillCirc(ctx, '#e8403a', -6 + sway, -38, 2); }
      break;
    }
    case 'pine': case 'snowpine': {
      F(ctx, '#5a3a20'); ctx.fillRect(-3, -10, 6, 10);
      const g = ['#1f4a3a', '#2a5e46', '#357252'];
      for (let i = 0; i < 3; i++) {
        const yy = -10 - i * 13, w = 17 - i * 4;
        fillPoly(ctx, g[i], [-w + sway * i * 0.3, yy, w + sway * i * 0.3, yy, sway * (i + 1) * 0.3, yy - 20]);
        if (kind === 'snowpine') fillPoly(ctx, '#f4f8ff', [-w * 0.55 + sway * i * 0.3, yy - 9, w * 0.55 + sway * i * 0.3, yy - 9, sway * (i + 1) * 0.3, yy - 20]);
      }
      break;
    }
    case 'palm': {
      S(ctx, '#8a6a3a'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -20, 2 + sway, -40); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55 + sway * 0.02;
        F(ctx, i % 2 ? '#3f8a34' : '#56a844');
        ctx.save(); ctx.translate(2 + sway, -40); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -6, 22, 4); ctx.quadraticCurveTo(10, 0, 0, 3); ctx.fill();
        ctx.restore();
      }
      fillCirc(ctx, '#6b4520', 0 + sway, -38, 2.5); fillCirc(ctx, '#6b4520', 4 + sway, -38, 2.5);
      break;
    }
    case 'cactus': {
      const c = '#4a9a4a';
      F(ctx, c); roundRect(ctx, -5, -30, 10, 30, 5); ctx.fill();
      roundRect(ctx, -14, -22, 6, 12, 3); ctx.fill(); ctx.fillRect(-12, -13, 8, 4);
      roundRect(ctx, 8, -26, 6, 12, 3); ctx.fill(); ctx.fillRect(4, -17, 8, 4);
      F(ctx, '#6aba5a'); ctx.fillRect(-2, -28, 2, 26);
      if (seed % 0.5 < 0.2) fillCirc(ctx, '#ff6a8a', 0, -31, 2.5);
      break;
    }
    case 'dead': {
      S(ctx, '#2a1e1a'); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.moveTo(0, -16); ctx.lineTo(-10, -26); ctx.moveTo(0, -22); ctx.lineTo(9, -32); ctx.moveTo(0, -26); ctx.lineTo(-3, -36); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(-14, -25); ctx.moveTo(9, -32); ctx.lineTo(13, -31); ctx.stroke();
      if (seed % 0.3 < 0.1) fillCirc(ctx, '#ff6a2a', 4, -10, 1.5);
      break;
    }
    case 'acacia': {
      S(ctx, '#6b4520'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, -22); ctx.lineTo(-10, -30); ctx.moveTo(-2, -22); ctx.lineTo(8, -32); ctx.stroke();
      fillEll(ctx, '#5a8a2a', sway * 0.5, -36, 24, 7);
      fillEll(ctx, '#6ea03a', sway * 0.7, -39, 18, 4.5);
      break;
    }
  }
  ctx.restore();
}

function drawRock(ctx, x, y, kind, seed) {
  const c = kind === 'snow' ? ['#8a96a2', '#aab6c2', '#f4f8ff'] : kind === 'ash' ? ['#2a2426', '#3a3234', '#4a4044'] : kind === 'sand' ? ['#a08058', '#b89870', '#d0b088'] : ['#6a6a72', '#86868e', '#a0a0a8'];
  ctx.save(); ctx.translate(x, y);
  drawShadow(ctx, 0, 0, 13, 0.25);
  fillPoly(ctx, c[0], [-13, 0, -11, -10, -3, -17, 7, -15, 13, -6, 12, 0]);
  fillPoly(ctx, c[1], [-10, -9, -3, -16, 6, -14, 3, -6, -6, -4]);
  if (kind === 'snow') fillPoly(ctx, c[2], [-9, -10, -3, -16, 6, -14, 2, -11]);
  if (kind === 'ash' && seed % 0.4 < 0.2) { line(ctx, '#ff6a2a', 1.2, -4, -4, 2, -10); }
  ctx.restore();
}

function drawFlower(ctx, x, y, seed, t) {
  const cols = ['#ff6a8a', '#ffd23f', '#ffffff', '#b46cff', '#ff8a3a'];
  const c = cols[Math.floor(seed * 97) % cols.length];
  const sw = Math.sin(t * 2 + seed * 20) * 1;
  line(ctx, '#3f8a34', 1.2, x, y, x + sw, y - 7);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; fillCirc(ctx, c, x + sw + Math.cos(a) * 2, y - 7 + Math.sin(a) * 2, 1.6); }
  fillCirc(ctx, '#ffd23f', x + sw, y - 7, 1.1);
}

// Buildings: kind = smith | mage | inn | house | board | fountain
function drawBuilding(ctx, b, t) {
  const { x, y } = b; // x,y = bottom-center of building
  ctx.save(); ctx.translate(x, y);
  const roof = b.roof || '#c0503a';
  if (b.kind === 'board') {
    drawShadow(ctx, 0, 0, 20, 0.25);
    line(ctx, '#5a3a1a', 4, -14, 0, -14, -30); line(ctx, '#5a3a1a', 4, 14, 0, 14, -30);
    F(ctx, '#8a5a2a'); ctx.fillRect(-20, -40, 40, 26);
    F(ctx, '#a0703a'); ctx.fillRect(-18, -38, 36, 22);
    const papers = ['#fff8e0', '#f0f0ff', '#fff0f0'];
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-11 + i * 11, -28); ctx.rotate((i - 1) * 0.12); F(ctx, papers[i]); ctx.fillRect(-4, -7, 8, 11); F(ctx, '#8a8a8a'); ctx.fillRect(-3, -4, 6, 0.8); ctx.fillRect(-3, -2, 6, 0.8); ctx.fillRect(-3, 0, 4, 0.8); fillCirc(ctx, '#c0303a', 0, -6, 1); ctx.restore(); }
    F(ctx, '#6b4520'); ctx.fillRect(-22, -44, 44, 5);
    if (b.alert) { const bb = Math.sin(t * 5) * 3; F(ctx, '#ffd23f'); ctx.font = 'bold 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -50 + bb); }
    ctx.restore(); return;
  }
  if (b.kind === 'fountain') {
    drawShadow(ctx, 0, 0, 30, 0.2);
    fillEll(ctx, '#8a8a94', 0, -6, 30, 12); fillEll(ctx, '#4fa8e8', 0, -8, 25, 9);
    F(ctx, '#9a9aa4'); ctx.fillRect(-4, -30, 8, 22); fillEll(ctx, '#aab', 0, -30, 10, 4);
    for (let i = 0; i < 6; i++) {
      const p = ((t * 0.8 + i / 6) % 1);
      fillCirc(ctx, 'rgba(200,235,255,0.8)', Math.cos(i) * 12 * p, -32 + p * 26 - Math.sin(p * Math.PI) * 10, 2);
    }
    ctx.restore(); return;
  }
  const W = 90, H = 56;
  drawShadow(ctx, 0, 0, 52, 0.25);
  // walls
  const wall = b.kind === 'mage' ? '#d8d0e8' : b.kind === 'smith' ? '#b8a898' : '#f0e0c0';
  F(ctx, shade(wall, -0.15)); ctx.fillRect(-W / 2, -H, W, H);
  F(ctx, wall); ctx.fillRect(-W / 2 + 3, -H + 3, W - 6, H - 3);
  // timber lines
  F(ctx, '#6b4520'); ctx.fillRect(-W / 2, -H, 4, H); ctx.fillRect(W / 2 - 4, -H, 4, H); ctx.fillRect(-W / 2, -H / 2 - 2, W, 3);
  // windows
  for (const wx of [-28, 28]) {
    F(ctx, '#5a3a1a'); ctx.fillRect(wx - 9, -H + 10, 18, 16);
    F(ctx, b.kind === 'mage' ? '#c8b0ff' : '#ffe8a0'); ctx.fillRect(wx - 7, -H + 12, 14, 12);
    F(ctx, '#5a3a1a'); ctx.fillRect(wx - 0.8, -H + 12, 1.6, 12); ctx.fillRect(wx - 7, -H + 17.2, 14, 1.6);
  }
  // door
  F(ctx, '#5a3a1a'); roundRect(ctx, -11, -32, 22, 32, 8); ctx.fill();
  F(ctx, '#8a5a2a'); roundRect(ctx, -9, -30, 18, 30, 7); ctx.fill();
  fillCirc(ctx, '#ffd23f', 5, -15, 1.6);
  // roof
  if (b.kind === 'mage') {
    fillPoly(ctx, shade(roof, -0.2), [-W / 2 - 8, -H + 2, W / 2 + 8, -H + 2, 0, -H - 70]);
    fillPoly(ctx, roof, [-W / 2 - 4, -H + 2, W / 2 + 4, -H + 2, 0, -H - 66]);
    drawStar(ctx, '#ffd23f', 0, -H - 72, 7);
    for (let i = 0; i < 3; i++) fillCirc(ctx, '#ffd23f', -14 + i * 14, -H - 18 - (i % 2) * 14, 2);
  } else {
    fillPoly(ctx, shade(roof, -0.25), [-W / 2 - 10, -H + 4, W / 2 + 10, -H + 4, W / 2 - 6, -H - 34, -W / 2 + 6, -H - 34]);
    fillPoly(ctx, roof, [-W / 2 - 6, -H + 2, W / 2 + 6, -H + 2, W / 2 - 8, -H - 32, -W / 2 + 8, -H - 32]);
    F(ctx, shade(roof, 0.15)); for (let i = 0; i < 4; i++) ctx.fillRect(-W / 2 + 2 + i * 3, -H - 6 - i * 7, W - 4 - i * 6, 2);
  }
  // signs
  if (b.kind === 'smith') {
    F(ctx, '#5a5a62'); ctx.fillRect(22, -H - 50, 12, 24); // chimney
    for (let i = 0; i < 4; i++) { const p = (t * 0.5 + i / 4) % 1; ctx.globalAlpha = (1 - p) * 0.5; fillCirc(ctx, '#9a9aa4', 28 + Math.sin(p * 6 + i) * 4, -H - 54 - p * 40, 4 + p * 8); ctx.globalAlpha = 1; }
    // anvil sign
    F(ctx, '#6b4520'); ctx.fillRect(-W / 2 - 18, -48, 20, 3);
    F(ctx, '#e0d8c8'); roundRect(ctx, -W / 2 - 22, -44, 22, 16, 3); ctx.fill();
    F(ctx, '#3a3a42'); ctx.fillRect(-W / 2 - 18, -40, 14, 4); ctx.fillRect(-W / 2 - 14, -36, 6, 5);
  } else if (b.kind === 'inn') {
    F(ctx, '#6b4520'); ctx.fillRect(-W / 2 - 18, -48, 20, 3);
    F(ctx, '#e0d8c8'); roundRect(ctx, -W / 2 - 22, -44, 22, 16, 3); ctx.fill();
    drawBone(ctx, -W / 2 - 11, -36, 16, 0.6, '#c89a60');
  } else if (b.kind === 'mage') {
    F(ctx, '#6b4520'); ctx.fillRect(-W / 2 - 18, -48, 20, 3);
    F(ctx, '#e0d8f8'); roundRect(ctx, -W / 2 - 22, -44, 22, 16, 3); ctx.fill();
    drawStar(ctx, '#8a4aff', -W / 2 - 11, -36, 6);
  }
  ctx.restore();
}

// Dungeon entrance on the overworld
function drawEntrance(ctx, x, y, theme, cleared, t, sealed) {
  ctx.save(); ctx.translate(x, y);
  drawShadow(ctx, 0, 2, 40, 0.25);
  const th = THEMES[theme];
  switch (theme) {
    case 'tomb': case 'temple':
      fillPoly(ctx, theme === 'tomb' ? '#b8985f' : '#8a7a8a', [-46, 0, 46, 0, 0, -70]);
      fillPoly(ctx, theme === 'tomb' ? '#d8b878' : '#a898a8', [-46, 0, 0, -70, 0, 0]);
      F(ctx, '#1a120a'); roundRect(ctx, -12, -30, 24, 30, 10); ctx.fill();
      F(ctx, th.accent); ctx.fillRect(-16, -34, 32, 4);
      break;
    case 'ice':
      fillPoly(ctx, '#6a8aaa', [-44, 0, -36, -34, -14, -52, 10, -48, 34, -36, 44, 0]);
      fillPoly(ctx, '#aee8ff', [-36, -34, -14, -52, 10, -48, 0, -40, -20, -38]);
      for (let i = 0; i < 5; i++) fillPoly(ctx, '#e0f8ff', [-30 + i * 14, -36 + (i % 2) * 6, -26 + i * 14, -22, -22 + i * 14, -36 + (i % 2) * 6]);
      F(ctx, '#0a1a2a'); ctx.beginPath(); ctx.ellipse(0, 0, 16, 26, 0, Math.PI, TAU); ctx.fill();
      break;
    case 'lava':
      fillPoly(ctx, '#2e1e1e', [-48, 0, -30, -36, -10, -44, 14, -42, 32, -34, 48, 0]);
      F(ctx, '#ff6a2a'); ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.3; ctx.beginPath(); ctx.ellipse(0, -2, 18, 24, 0, Math.PI, TAU); ctx.fill(); ctx.globalAlpha = 1;
      F(ctx, '#1a0a0a'); ctx.beginPath(); ctx.ellipse(0, 0, 13, 20, 0, Math.PI, TAU); ctx.fill();
      break;
    case 'castle':
      F(ctx, '#42364e'); ctx.fillRect(-44, -60, 88, 60);
      F(ctx, '#2e243a'); for (let i = 0; i < 6; i++) ctx.fillRect(-44 + i * 16, -70, 10, 10);
      F(ctx, '#2e243a'); ctx.fillRect(-52, -80, 18, 80); ctx.fillRect(34, -80, 18, 80);
      fillPoly(ctx, '#8a1f2a', [-54, -80, -32, -80, -43, -100]); fillPoly(ctx, '#8a1f2a', [32, -80, 54, -80, 43, -100]);
      F(ctx, '#0a0612'); roundRect(ctx, -16, -40, 32, 40, 14); ctx.fill();
      break;
    case 'crypt':
      F(ctx, '#4a4a56'); ctx.fillRect(-36, -46, 72, 46);
      fillPoly(ctx, '#383842', [-42, -46, 42, -46, 0, -66]);
      F(ctx, '#0a0a12'); roundRect(ctx, -12, -32, 24, 32, 10); ctx.fill();
      drawSkull(ctx, 0, -52, 3);
      break;
    case 'mine':
      fillPoly(ctx, '#6a5a4a', [-46, 0, -34, -38, -8, -50, 20, -46, 38, -30, 46, 0]);
      F(ctx, '#1a120a'); ctx.fillRect(-16, -36, 32, 36);
      F(ctx, '#8a5a2a'); ctx.fillRect(-20, -40, 40, 6); ctx.fillRect(-20, -36, 6, 36); ctx.fillRect(14, -36, 6, 36);
      break;
    case 'ruin':
      F(ctx, '#5e6e56'); ctx.fillRect(-40, -50, 16, 50); ctx.fillRect(24, -50, 16, 50);
      F(ctx, '#4e5e46'); ctx.fillRect(-44, -58, 88, 12);
      F(ctx, '#0a120a'); ctx.fillRect(-24, -46, 48, 46);
      F(ctx, '#6aa84a'); for (let i = 0; i < 5; i++) fillCirc(ctx, '#5a9a3a', -40 + i * 20, -56 + (i % 2) * 4, 6);
      break;
    default: // cave
      fillPoly(ctx, '#6a5a48', [-48, 0, -36, -34, -12, -48, 14, -46, 36, -32, 48, 0]);
      fillPoly(ctx, '#8a7458', [-36, -34, -12, -48, 14, -46, 0, -38, -22, -34]);
      F(ctx, '#140c06'); ctx.beginPath(); ctx.ellipse(0, 0, 17, 28, 0, Math.PI, TAU); ctx.fill();
  }
  if (sealed) {
    ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2;
    F(ctx, '#ff4aff'); ctx.beginPath(); ctx.ellipse(0, -20, 34, 40, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (cleared) { // victory banner
    line(ctx, '#5a3a1a', 2, 30, 0, 30, -44);
    F(ctx, '#3a8ae8'); ctx.beginPath(); ctx.moveTo(30, -44); ctx.lineTo(48 + Math.sin(t * 4) * 2, -40); ctx.lineTo(30, -32); ctx.fill();
    drawPaw(ctx, 37, -39, 3, '#ffffff');
  }
  ctx.restore();
}

function drawPortal(ctx, x, y, t, color = '#7fe0ff') {
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.25 + i * 0.2;
    F(ctx, i === 2 ? '#ffffff' : color);
    ctx.beginPath(); ctx.ellipse(0, -2, 24 - i * 7 + Math.sin(t * 4 + i) * 2, 10 - i * 3, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.7 + i / 6) % 1, a = i * 1.7 + t;
    ctx.globalAlpha = 1 - p;
    fillCirc(ctx, color, Math.cos(a) * 16 * (1 - p * 0.5), -2 - p * 40, 2.5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSign(ctx, x, y, text) {
  ctx.save(); ctx.translate(x, y);
  drawShadow(ctx, 0, 0, 10, 0.2);
  line(ctx, '#5a3a1a', 3, 0, 0, 0, -24);
  F(ctx, '#8a5a2a'); ctx.fillRect(-18, -34, 36, 14);
  F(ctx, '#a0703a'); ctx.fillRect(-16, -32, 32, 10);
  ctx.restore();
}

// Draw a dog head (for portraits / HUD)
function drawDogPortrait(ctx, look, x, y, size, t = 0, equip = null) {
  ctx.save(); ctx.translate(x, y);
  const s = size / 34; ctx.scale(s, s);
  drawDog(ctx, { x: -10, y: 26, facing: 1, t, look, equip: equip ? { weapon: null, helmet: equip.helmet, armor: equip.armor } : null, move: 0 });
  ctx.restore();
}
