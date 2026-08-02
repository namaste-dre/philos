// B-2 wiring: regenerates the client-embedded CULTURE_MAP_LIBRARY block
// inside index.html from the already vault-parity-tested
// lib/culture-map-registry.js. Same approach as
// scripts/embed-how-you-operate.js (B-3) and the ALIGNMENT_LIBRARY block
// (B-4/B-5): index.html is a single static file with no bundler and no
// require(), so the reviewed registry content has to be re-serialized as an
// inline const rather than imported. Reading from the registry module (not
// the vault doc directly) means this script can never diverge from content
// that has not already passed lib/culture-map-registry.js's own
// shape/hygiene/vault-parity/no-new-curation checks - only structural
// reshaping happens here (dropping the redundant variantId key), never a
// content edit.
//
// Run with:
//   node scripts/embed-culture-map.js
//
// After running, `node index.culture-map.test.js` re-validates the embedded
// block for shape, coverage, hygiene, render behavior, and byte-identical
// parity against lib/culture-map-registry.js.

'use strict';

const fs = require('fs');
const path = require('path');

const { VARIANT_IDS, CULTURE_MAP_REGISTRY } = require('../lib/culture-map-registry.js');

const library = {};
VARIANT_IDS.forEach((id) => {
  const e = CULTURE_MAP_REGISTRY[id];
  library[id] = { films: e.films, music: e.music, books: e.books };
});

const BLOCK_START = '// CULTURE_MAP_LIBRARY block (auto-generated, do not hand-edit)';
const BLOCK_END = '// END CULTURE_MAP_LIBRARY block';

const body =
  `${BLOCK_START}\n` +
  `// B-2 wiring (2026-08-02): the client-embedded, reviewed variant-specific\n` +
  `// film/music/book pick and "why it matches you" text for each of the 60\n` +
  `// variants. Generated from lib/culture-map-registry.js by\n` +
  `// scripts/embed-culture-map.js - never hand-edit this block directly;\n` +
  `// re-run the script instead so this and the registry module cannot drift\n` +
  `// (DI-005 principle). Every title is drawn verbatim from the live\n` +
  `// MEDIA_BY_FAMILY pool, no new curation. Lyra's construct/equal-dignity\n` +
  `// review of all 60 variants (180 assignments) found no issues requiring\n` +
  `// correction, 2026-08-02. Andre voice sign-off is recorded separately in\n` +
  `// the vault and is not implied by this wiring.\n` +
  `const CULTURE_MAP_LIBRARY = ${JSON.stringify(library, null, 2)};\n` +
  `${BLOCK_END}`;

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const startIdx = html.indexOf(BLOCK_START);
const endMarkerIdx = html.indexOf(BLOCK_END);

if (startIdx === -1 || endMarkerIdx === -1) {
  // First run: insert immediately after the HOW_YOU_OPERATE_LIBRARY block
  // closes, grouping the client-embedded content registries together.
  const anchor = '// END HOW_YOU_OPERATE_LIBRARY block';
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) throw new Error('anchor not found: END HOW_YOU_OPERATE_LIBRARY block marker');
  const insertAt = anchorIdx + anchor.length;
  html = html.slice(0, insertAt) + '\n\n' + body + '\n' + html.slice(insertAt);
} else {
  const before = html.slice(0, startIdx);
  const after = html.slice(endMarkerIdx + BLOCK_END.length);
  html = before + body + after;
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote CULTURE_MAP_LIBRARY (${VARIANT_IDS.length} variants) into index.html`);
