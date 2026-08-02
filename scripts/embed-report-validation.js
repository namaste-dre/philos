// C-4 enforcement wiring: regenerates the client-embedded report-output
// validation block inside index.html from lib/report-output-validation.js.
//
// Unlike the content-registry embeds (B-1/B-2/B-3), this embeds CODE, and
// the transform is deliberately minimal so there is one rule set, not two:
// the lib source is carried into index.html byte-for-byte except for
// exactly two mechanical removals -
//   1. the `'use strict';` line (a no-op mid-script, removed to avoid
//      implying a strictness boundary that does not exist there), and
//   2. the trailing `module.exports = {...};` block (index.html has no
//      module system).
// index.report-validation.test.js re-applies this same transform to the
// lib source and asserts the embedded block matches byte-for-byte, so the
// two can never drift - any rule change must happen in lib/ and be
// re-embedded by running this script, never hand-edited in index.html.
//
// Run with:
//   node scripts/embed-report-validation.js

'use strict';

const fs = require('fs');
const path = require('path');

const BLOCK_START = '// REPORT_OUTPUT_VALIDATION block (auto-generated from lib/report-output-validation.js, do not hand-edit)';
const BLOCK_END = '// END REPORT_OUTPUT_VALIDATION block';

// The exact transform the parity test replays. Exported-by-convention:
// keep this in sync with index.report-validation.test.js's copy (the test
// asserts the RESULT matches, so a drifted transform fails loudly there).
function browserSafeSource(libSource) {
  let src = libSource;
  src = src.replace(/^'use strict';\r?\n/m, '');
  const exportsIdx = src.indexOf('module.exports = {');
  if (exportsIdx === -1) throw new Error('module.exports block not found in lib source');
  src = src.slice(0, exportsIdx).trimEnd() + '\n';
  return src;
}

const libPath = path.join(__dirname, '..', 'lib', 'report-output-validation.js');
const libSource = fs.readFileSync(libPath, 'utf8');
const embedded = browserSafeSource(libSource);

const body = `${BLOCK_START}\n${embedded}${BLOCK_END}`;

const indexPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const startIdx = html.indexOf(BLOCK_START);
const endMarkerIdx = html.indexOf(BLOCK_END);

if (startIdx === -1 || endMarkerIdx === -1) {
  // First run: insert after the FAMOUS_MINDS_LIBRARY block, keeping the
  // generated embeds grouped. Top-level consts here initialize at script
  // load, long before the user-triggered generation flow can call the
  // hoisted validator functions, so placement below the enforcement call
  // sites is safe (the TDZ lesson from BL-20260731-225800-auth considered).
  const anchor = '// END FAMOUS_MINDS_LIBRARY block';
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) throw new Error('anchor not found: END FAMOUS_MINDS_LIBRARY block marker');
  const insertAt = anchorIdx + anchor.length;
  html = html.slice(0, insertAt) + '\n\n' + body + '\n' + html.slice(insertAt);
} else {
  const before = html.slice(0, startIdx);
  const after = html.slice(endMarkerIdx + BLOCK_END.length);
  html = before + body + after;
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Wrote REPORT_OUTPUT_VALIDATION block (${embedded.length} chars) into index.html`);
