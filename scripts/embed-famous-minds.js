// B-1 wiring: regenerates the client-embedded FAMOUS_MINDS_LIBRARY block
// inside index.html from the already vault-parity-tested
// lib/famous-minds-registry.js. Same approach as
// scripts/embed-how-you-operate.js (B-3) and scripts/embed-culture-map.js
// (B-2): index.html is a single static file with no bundler and no
// require(), so the reviewed registry content has to be re-serialized as an
// inline const rather than imported. Reading from the registry module (not
// the vault doc directly) means this script can never diverge from content
// that has not already passed lib/famous-minds-registry.js's own
// shape/hygiene/vault-parity/editorial-leak checks - only structural
// reshaping happens here (dropping the redundant variantId key), never a
// content edit.
//
// Run with:
//   node scripts/embed-famous-minds.js
//
// After running, `node index.famous-minds.test.js` re-validates the
// embedded block for shape, coverage, hygiene, render behavior, and
// byte-identical parity against lib/famous-minds-registry.js.

'use strict';

const fs = require('fs');
const path = require('path');

const { VARIANT_IDS, FAMOUS_MINDS_REGISTRY } = require('../lib/famous-minds-registry.js');

const library = {};
VARIANT_IDS.forEach((id) => {
  library[id] = { figures: FAMOUS_MINDS_REGISTRY[id].figures };
});

const BLOCK_START = '// FAMOUS_MINDS_LIBRARY block (auto-generated, do not hand-edit)';
const BLOCK_END = '// END FAMOUS_MINDS_LIBRARY block';

const body =
  `${BLOCK_START}\n` +
  `// B-1 wiring (2026-08-02): the client-embedded, reviewed variant-specific\n` +
  `// Famous Minds figures (name / optional mode qualifier / role / why this\n` +
  `// matches you / where the match ends / start here) for each of the 60\n` +
  `// variants, 3 figures each. Generated from lib/famous-minds-registry.js by\n` +
  `// scripts/embed-famous-minds.js - never hand-edit this block directly;\n` +
  `// re-run the script instead so this and the registry module cannot drift\n` +
  `// (DI-005 principle). Replaces the family-level FAMOUS_BY_FAMILY cards in\n` +
  `// the report's Famous Minds section only, per the registry's own\n` +
  `// documented intent - FAMOUS_BY_FAMILY itself is untouched and still\n` +
  `// powers the separate share-card image generator (buildCardData()).\n` +
  `// Lyra's 180-entry construct/equal-dignity/attribution review closed PASS\n` +
  `// 2026-08-01 (Round 27); a bounded pre-wiring review (Fable) on 2026-08-02\n` +
  `// found two entries (9C Sacks, 12A Nietzsche) leaking internal review-\n` +
  `// process language into their diverge text - fixed at the vault-doc source\n` +
  `// and re-extracted before this embed. Andre voice sign-off across the full\n` +
  `// 180-entry set is a separate, not-yet-recorded gate (only the 15 Family 1\n` +
  `// exemplars are signed off) - this wiring does not imply or change that\n` +
  `// gate, consistent with the same pattern already established for B-2/B-3.\n` +
  `const FAMOUS_MINDS_LIBRARY = ${JSON.stringify(library, null, 2)};\n` +
  `${BLOCK_END}`;

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const startIdx = html.indexOf(BLOCK_START);
const endMarkerIdx = html.indexOf(BLOCK_END);

if (startIdx === -1 || endMarkerIdx === -1) {
  // First run: insert immediately after the CULTURE_MAP_LIBRARY block
  // closes, grouping the client-embedded content registries together.
  const anchor = '// END CULTURE_MAP_LIBRARY block';
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) throw new Error('anchor not found: END CULTURE_MAP_LIBRARY block marker');
  const insertAt = anchorIdx + anchor.length;
  html = html.slice(0, insertAt) + '\n\n' + body + '\n' + html.slice(insertAt);
} else {
  const before = html.slice(0, startIdx);
  const after = html.slice(endMarkerIdx + BLOCK_END.length);
  html = before + body + after;
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote FAMOUS_MINDS_LIBRARY (${VARIANT_IDS.length} variants) into index.html`);
