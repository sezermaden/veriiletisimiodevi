/* Shared option rows: slider, select (cycle), toggle, colour swatches.
   Every row is a single focusable element; left/right adjusts, OK cycles/toggles,
   mouse click on the right half increments and on the left half decrements. */
import { h, focusable } from './focus.js';
import { Audio } from '../core/audio.js';

export function optionRow(label, spec) {
  const valueEl = h('div.value');
  const row = h('div.opt', {}, h('div.label', { text: label }), valueEl);
  const render = () => {
    const v = spec.get();
    valueEl.innerHTML = '';
    if (spec.type === 'slider') {
      const k = (v - spec.min) / (spec.max - spec.min);
      valueEl.append(h('span.arrows', { text: '◀' }), h('div.bar', {}, h('i', { style: { width: Math.round(k * 100) + '%' } })), h('span', { text: spec.format ? spec.format(v) : fmt(v, spec.step) }), h('span.arrows', { text: '▶' }));
    } else if (spec.type === 'select') {
      const c = spec.choices.find(([val]) => val === v);
      valueEl.append(h('span.arrows', { text: '◀' }), h('span', { text: c ? c[1] : String(v) }), h('span.arrows', { text: '▶' }));
    } else if (spec.type === 'check') {
      valueEl.append(h('span', { text: v ? 'ON' : 'OFF' }));
    } else if (spec.type === 'color') {
      const sw = h('div.swatches');
      for (const c of spec.palette) sw.append(h('span.swatch' + (c === v ? '.on' : ''), { style: { background: c } }));
      valueEl.append(sw);
    } else if (spec.type === 'action') {
      valueEl.append(h('span', { text: spec.valueText?.() ?? '›' }));
    }
  };
  const adjust = (dir) => {
    const v = spec.get();
    if (spec.type === 'slider') {
      const n = clamp(round(v + dir * spec.step, spec.step), spec.min, spec.max);
      if (n !== v) { spec.set(n); Audio.play('ui_move'); }
    } else if (spec.type === 'select') {
      const i = spec.choices.findIndex(([val]) => val === v);
      const n = spec.choices[(i + dir + spec.choices.length) % spec.choices.length][0];
      spec.set(n); Audio.play('ui_move');
    } else if (spec.type === 'check') { spec.set(!v); Audio.play('ui_select'); }
    else if (spec.type === 'color') {
      const i = spec.palette.indexOf(v);
      spec.set(spec.palette[(i + dir + spec.palette.length) % spec.palette.length]); Audio.play('ui_move');
    }
    render();
  };
  focusable(row, (el, ev) => {
    if (spec.type === 'action') { spec.run(); render(); return; }
    if (ev && ev.clientX !== undefined && spec.type !== 'check') {
      const r = valueEl.getBoundingClientRect();
      adjust(ev.clientX >= r.left && ev.clientX < r.left + r.width / 2 ? -1 : 1);
    } else adjust(1);
  }, { onAdjust: (d) => adjust(d), onWheel: (d) => adjust(d) });
  render();
  row.refresh = render;
  return row;
}

function fmt(v, step) {
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return v.toFixed(dec);
}
const round = (v, s) => Math.round(v / s) * s;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function button(text, onActivate, { cls = '', sub = null, autofocus = false } = {}) {
  const b = h('div.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), {}, h('span', { text }), sub ? h('span.sub', { text: sub }) : null);
  focusable(b, () => { Audio.play('ui_select'); onActivate(b); }, { autofocus });
  return b;
}

export function promptBar(items) {
  // items: [[glyphHtml, label], ...]
  return h('div.prompts', {}, ...items.map(([g, l]) => h('span.prompt', { html: `${g} ${l}` })));
}
