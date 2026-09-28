/* Store listing field limits (Partner Center). A field over its limit stops submission. */
import { readFileSync } from 'fs';
const L = JSON.parse(readFileSync(new URL('../docs/store/listing.json', import.meta.url)));
const rules = [
  ['shortTitle', L.shortTitle.length, 50], ['sortTitle', L.sortTitle.length, 255], ['voiceTitle', L.voiceTitle.length, 255],
  ['shortDescription', L.shortDescription.length, 270], ['description', L.description.length, 10000],
  ['features count', L.features.length, 20], ['longest feature', Math.max(...L.features.map((f) => f.length)), 200],
  ['searchTerms count', L.searchTerms.length, 7], ['longest search term', Math.max(...L.searchTerms.map((s) => s.length)), 40],
  ['search words total', L.searchTerms.join(' ').split(/\s+/).length, 21], ['copyright', L.copyright.length, 200], ['developedBy', L.developedBy.length, 255],
];
let fail = false;
for (const [k, v, max] of rules) { const ok = v <= max; if (!ok) fail = true; console.log(`${ok ? 'PASS' : 'FAIL'}  ${k.padEnd(20)} ${v} / ${max}`); }
process.exit(fail ? 1 : 0);
