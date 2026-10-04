/* =========================================================
   Vector symbol art drawn straight onto the ticket canvas.
   No image files: every icon is a few canvas paths, so it is
   crisp at any texture size and identical on every platform.
   ========================================================= */
import { SYMBOLS } from './economy.js';

function star(ctx, cx, cy, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws one symbol centred at (cx, cy) inside a square of side `s`.
 */
export function drawSymbol(ctx, id, cx, cy, s) {
  const sym = SYMBOLS[id];
  const c = sym ? sym.color : '#ffffff';
  const r = s * 0.36;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = s * 0.06;
  ctx.shadowOffsetY = s * 0.03;

  switch (id) {
    case 'cherry': {
      ctx.strokeStyle = '#5ee87a'; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.25); ctx.quadraticCurveTo(-r * 0.1, -r * 0.9, r * 0.55, -r * 0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.3); ctx.quadraticCurveTo(r * 0.5, -r * 0.5, r * 0.55, -r * 0.95); ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(-r * 0.4, r * 0.45, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.42, r * 0.5, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(-r * 0.52, r * 0.3, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, r * 0.35, r * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lemon': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.65, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5ee87a';
      ctx.beginPath(); ctx.ellipse(r * 0.55, -r * 0.6, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.2, r * 0.25, r * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'clover': {
      ctx.fillStyle = c;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.42, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#2f8f5b'; ctx.lineWidth = s * 0.05;
      ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(r * 0.25, r * 1.05); ctx.stroke();
      break;
    }
    case 'bell': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-r * 0.75, r * 0.45); ctx.quadraticCurveTo(-r * 0.6, -r * 0.9, 0, -r * 0.9);
      ctx.quadraticCurveTo(r * 0.6, -r * 0.9, r * 0.75, r * 0.45); ctx.closePath(); ctx.fill();
      roundRect(ctx, -r * 0.9, r * 0.4, r * 1.8, r * 0.22, r * 0.1); ctx.fill();
      ctx.fillStyle = '#b8780f';
      ctx.beginPath(); ctx.arc(0, r * 0.78, r * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.12, r * 0.35, 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'horseshoe': {
      ctx.strokeStyle = c; ctx.lineWidth = s * 0.14;
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.72, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
      ctx.fillStyle = '#8b94b8';
      for (const [x, y] of [[-0.62, 0.55], [0.62, 0.55], [-0.72, 0.1], [0.72, 0.1], [-0.45, -0.6], [0.45, -0.6]]) {
        ctx.beginPath(); ctx.arc(x * r, y * r, r * 0.08, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'star': {
      ctx.fillStyle = c; star(ctx, 0, 0, r, 5, 0.48); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; star(ctx, -r * 0.1, -r * 0.1, r * 0.45, 5, 0.48); ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(-r * 0.5, -r * 0.8); ctx.lineTo(r * 0.5, -r * 0.8); ctx.lineTo(r, -r * 0.3); ctx.lineTo(0, r * 0.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = s * 0.025;
      ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(r, -r * 0.3); ctx.moveTo(-r * 0.5, -r * 0.8); ctx.lineTo(-r * 0.3, -r * 0.3); ctx.lineTo(0, r * 0.9);
      ctx.moveTo(r * 0.5, -r * 0.8); ctx.lineTo(r * 0.3, -r * 0.3); ctx.lineTo(0, r * 0.9); ctx.stroke();
      break;
    }
    case 'seven': {
      ctx.fillStyle = c;
      ctx.font = `900 ${s * 0.95}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('7', 0, s * 0.04);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = s * 0.02; ctx.strokeText('7', 0, s * 0.04);
      break;
    }
    case 'crown': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-r, r * 0.6); ctx.lineTo(-r, -r * 0.5); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(0, -r * 0.9);
      ctx.lineTo(r * 0.45, 0); ctx.lineTo(r, -r * 0.5); ctx.lineTo(r, r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff4fd8';
      for (const x of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.arc(x * r, r * 0.3, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'rocket': {
      ctx.save(); ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#e8f2ff';
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.55, -r * 0.2, r * 0.42, r * 0.6); ctx.lineTo(-r * 0.42, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.55, -r * 0.2, 0, -r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.3); ctx.lineTo(-r * 0.85, r * 0.85); ctx.lineTo(-r * 0.3, r * 0.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.42, r * 0.3); ctx.lineTo(r * 0.85, r * 0.85); ctx.lineTo(r * 0.3, r * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5ad7e6'; ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.moveTo(-r * 0.25, r * 0.62); ctx.lineTo(0, r * 1.15); ctx.lineTo(r * 0.25, r * 0.62); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'moon': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.25, r * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffe28a'; star(ctx, r * 0.6, r * 0.5, r * 0.22, 4, 0.4); ctx.fill();
      break;
    }
    case 'skull': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.72, Math.PI, 0); ctx.lineTo(r * 0.72, r * 0.35); ctx.lineTo(-r * 0.72, r * 0.35); ctx.closePath(); ctx.fill();
      roundRect(ctx, -r * 0.42, r * 0.3, r * 0.84, r * 0.45, r * 0.1); ctx.fill();
      ctx.fillStyle = '#1a2320';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.1, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.1, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.lineTo(-r * 0.1, r * 0.3); ctx.lineTo(r * 0.1, r * 0.3); ctx.closePath(); ctx.fill();
      break;
    }
    case 'wild': {
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, '#ff4fd8'); g.addColorStop(0.5, '#ffe28a'); g.addColorStop(1, '#5ad7e6');
      ctx.fillStyle = g; star(ctx, 0, 0, r, 8, 0.72); ctx.fill();
      ctx.fillStyle = '#1a1020';
      ctx.font = `900 ${s * 0.3}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('WILD', 0, s * 0.02);
      break;
    }
    case 'mult2': case 'mult3': case 'mult5': case 'mult10': {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1020';
      ctx.font = `900 ${s * (id === 'mult10' ? 0.42 : 0.5)}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sym.name, 0, s * 0.03);
      break;
    }
    case 'bonus': {
      ctx.fillStyle = c; roundRect(ctx, -r * 0.95, -r * 0.6, r * 1.9, r * 1.2, r * 0.25); ctx.fill();
      ctx.fillStyle = '#0f271c';
      ctx.font = `900 ${s * 0.28}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BONUS', 0, s * 0.02);
      break;
    }
    case 'jackpot': {
      ctx.fillStyle = c; star(ctx, 0, 0, r * 1.05, 12, 0.8); ctx.fill();
      ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a0a3a';
      ctx.font = `900 ${s * 0.2}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('JACK', 0, -s * 0.08); ctx.fillText('POT', 0, s * 0.12);
      break;
    }
    default: {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export { roundRect, star };
