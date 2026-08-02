// B-3 wiring: regenerates the client-embedded HOW_YOU_OPERATE_LIBRARY block
// inside index.html from the already vault-parity-tested
// lib/how-you-operate-registry.js. index.html is a single static file with
// no bundler and no require(), so the reviewed registry content has to be
// re-serialized as an inline const rather than imported - the same approach
// used for ALIGNMENT_LIBRARY (B-4/B-5). Reading from the registry module
// (not the vault doc directly) means this script can never diverge from
// content that has not already passed lib/how-you-operate-registry.js's own
// shape/hygiene/vault-parity checks - only structural reshaping happens
// here (dropping the redundant variantId key), never a content edit.
//
// Run with:
//   node scripts/embed-how-you-operate.js
//
// After running, `node index.how-you-operate.test.js` re-validates the
// embedded block for shape, coverage, hygiene, render behavior, and
// byte-identical parity against lib/how-you-operate-registry.js.

'use strict';

const fs = require('fs');
const path = require('path');

const { VARIANT_IDS, HOW_YOU_OPERATE_REGISTRY } = require('../lib/how-you-operate-registry.js');

const library = {};
VARIANT_IDS.forEach((id) => {
  const e = HOW_YOU_OPERATE_REGISTRY[id];
  library[id] = { strength: e.strength, failureMode: e.failureMode };
});

const BLOCK_START = '// HOW_YOU_OPERATE_LIBRARY block (auto-generated, do not hand-edit)';
const BLOCK_END = '// END HOW_YOU_OPERATE_LIBRARY block';

const body =
  `${BLOCK_START}\n` +
  `// B-3 wiring (2026-08-02): the client-embedded, reviewed four-part\n` +
  `// (pattern / where it shows up / cost / lever) expansion of each\n` +
  `// variant's How You Operate strength/failureMode. Generated from\n` +
  `// lib/how-you-operate-registry.js by scripts/embed-how-you-operate.js -\n` +
  `// never hand-edit this block directly; re-run the script instead so this\n` +
  `// and the registry module cannot drift (DI-005 principle). Lyra's\n` +
  `// construct/equal-dignity review of all 60 variants closed pass with\n` +
  `// required micro-fixes, fixed, 2026-08-01. Andre voice sign-off is\n` +
  `// recorded separately in the vault and is not implied by this wiring.\n` +
  `const HOW_YOU_OPERATE_LIBRARY = ${JSON.stringify(library, null, 2)};\n` +
  `${BLOCK_END}`;

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const startIdx = html.indexOf(BLOCK_START);
const endMarkerIdx = html.indexOf(BLOCK_END);

if (startIdx === -1 || endMarkerIdx === -1) {
  // First run: insert immediately after the ALIGNMENT_LIBRARY block closes,
  // grouping the two client-embedded content registries together.
  const anchor = 'const ALIGNMENT_LIBRARY = {';
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) throw new Error('anchor not found: ALIGNMENT_LIBRARY definition');
  // Walk forward to the matching closing brace + semicolon for ALIGNMENT_LIBRARY.
  let i = html.indexOf('{', anchorIdx), depth = 0;
  while (i < html.length) {
    const ch = html[i];
    if (ch === "'" || ch === '"') {
      const q = ch; i++;
      while (i < html.length && !(html[i] === q && html[i - 1] !== '\\')) i++;
    } else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  const insertAt = html.indexOf(';', i) + 1;
  html = html.slice(0, insertAt) + '\n\n' + body + '\n' + html.slice(insertAt);
} else {
  const before = html.slice(0, startIdx);
  const after = html.slice(endMarkerIdx + BLOCK_END.length);
  html = before + body + after;
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote HOW_YOU_OPERATE_LIBRARY (${VARIANT_IDS.length} variants) into index.html`);
