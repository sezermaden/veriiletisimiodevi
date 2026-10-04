/* Number formatting for an incremental: 1.2K, 3.4M, 5.6B … then scientific. */
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n, digits = 1) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  n = Math.abs(n);
  if (n < 1000) {
    const s = n < 10 ? n.toFixed(n % 1 ? 2 : 0) : Math.floor(n).toString();
    return (neg ? '-' : '') + s;
  }
  let tier = Math.floor(Math.log10(n) / 3);
  if (tier >= SUFFIX.length) return (neg ? '-' : '') + n.toExponential(2);
  const scaled = n / Math.pow(10, tier * 3);
  let s = scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? digits : 0);
  s = s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return (neg ? '-' : '') + s + SUFFIX[tier];
}

export const money = (n) => '$' + fmt(n);

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export const pct = (x) => Math.round(x * 100) + '%';
