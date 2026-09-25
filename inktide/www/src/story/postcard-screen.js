// Lost Postcard modal: the card flies in, flips from its painted front to the handwritten back.
// Pushed by StoryMode.collectPostcard(); blocksGame pauses the stage while it is open.
import { Screen } from '../ui/screens.js';
import { promptHTML } from '../engine/game-input.js';
import { STAGE_ORDER } from './script.js';
import { save } from '../engine/save.js';
import './sfx.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

/** Painted postcard front: sunset harbour, lighthouse, rainbow ink streak. */
export function postcardFrontSVG(seed = 'tidehaven') {
  const k = hash(seed);
  const hue = Math.round(k * 60) - 20;
  const sunX = 120 + k * 120;
  return `<svg viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="pcsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${232 + hue * 0.3},70%,40%)"/><stop offset=".55" stop-color="hsl(${330 + hue},82%,66%)"/><stop offset="1" stop-color="hsl(${32 + hue * 0.5},95%,70%)"/></linearGradient>
      <linearGradient id="pcsea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2aa6d8"/><stop offset="1" stop-color="#10407a"/></linearGradient>
    </defs>
    <rect width="600" height="380" fill="url(#pcsky)"/>
    <circle cx="${sunX}" cy="220" r="58" fill="#fff1b8"/>
    <path d="M0 210 L40 210 L40 170 L70 170 L70 196 L96 196 L96 150 L130 150 L130 205 L170 205 L170 180 L200 180 L200 210 L600 210 L600 240 L0 240Z" fill="#3a2f6e" opacity=".55"/>
    <rect y="228" width="600" height="152" fill="url(#pcsea)"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${-40 + (i * 37) % 60} ${244 + i * 18} q20 -7 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>`).join('')}
    <ellipse cx="440" cy="236" rx="110" ry="30" fill="#2b2350"/>
    <path d="M414 232 L426 90 L454 90 L466 232Z" fill="#f7f3ea"/>
    ${[0, 1, 2].map((i) => `<path d="M${422 - i * 3} ${108 + i * 40} H${458 + i * 3} V${124 + i * 40} H${422 - i * 3}Z" fill="#e8432f"/>`).join('')}
    <rect x="420" y="66" width="40" height="26" fill="#2b2350"/><rect x="426" y="71" width="28" height="16" fill="#fff6a8"/>
    <path d="M440 76 L230 40 L230 120Z" fill="#fff6a8" opacity=".35"/>
    ${['#ff8a1f', '#ffd23f', '#3fd6a0', '#2fb6ff', '#8a5bff'].map((c, i) => `<path d="M${260 + i * 9} 238 A ${190 - i * 9} ${190 - i * 9} 0 0 1 ${440} ${48 + i * 9}" fill="none" stroke="${c}" stroke-width="8"/>`).join('')}
  </svg>`;
}

export class PostcardScreen extends Screen {
  /** card: { id, title, text, from } */
  constructor(app, card, o = {}) {
    super(app, { blocksGame: true, transparent: true, className: 'story-postcard' });
    this.card = card;
    this.o = o;
    this.t = 0;
    this.flipped = false;
  }

  build() {
    const c = this.card;
    const found = STAGE_ORDER.filter((id) => save.stage(id)?.postcard).length + (this.o.countCurrent ? 1 : 0);
    this.el.innerHTML = `
      <div class="pc-shade"></div>
      <div class="pc-wrap">
        <div class="pc-head">LOST POSTCARD FOUND!</div>
        <div class="pc-card">
          <div class="pc-face pc-front">${postcardFrontSVG(c.id || c.title)}
            <div class="pc-greet"><b>GREETINGS</b><span>FROM TIDEHAVEN</span></div>
            <div class="pc-title">${esc(c.title || 'Lost Postcard')}</div>
          </div>
          <div class="pc-face pc-back">
            <div class="pc-msg"><p>${esc(c.text || 'Wish you were here!')}</p><p class="pc-from">— ${esc(c.from || 'a friend')}</p></div>
            <div class="pc-addr"><div class="pc-stamp"><span>${esc((c.title || 'T')[0])}</span></div><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="pc-count">${Math.min(found, STAGE_ORDER.length)} / ${STAGE_ORDER.length} postcards collected</div>
        <div class="pc-btn">Nice!</div>
      </div>`;
    this.cardEl = this.el.querySelector('.pc-card');
    const btn = this.el.querySelector('.pc-btn');
    btn.innerHTML = `${promptHTML(this.app.input, 'ui_accept')} Nice!`;
    this.button(btn, () => this.close(), { autofocus: true });
  }

  onEnter() { this.app.audio?.sfx?.('story_postcard', { volume: 0.7 }); }

  update(dt) {
    this.t += dt;
    if (!this.flipped && this.t > 1.1) { this.flipped = true; this.cardEl.classList.add('flip'); this.app.audio?.sfx?.('story_page', { volume: 0.5 }); }
  }

  handleInput(input) {
    if (!this.flipped && (input.justPressed('ui_accept') || input.justPressed('advance'))) {
      this.flipped = true; this.t = 2; this.cardEl.classList.add('flip');
      return true;
    }
    return false;
  }

  close() {
    if (this._closed) return;
    this._closed = true;
    this.app.ui.pop();
    this.o.onClose?.();
  }

  onBack() { this.close(); }
}
