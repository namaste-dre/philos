// B-5 tests: Alignment Library content registry (2026-08-01).
//
// Validates lib/alignment-library-registry.js: shape completeness, axis
// cross-check against the product's real AXIS_META, domain/band coverage
// with no gaps or duplicates, content hygiene, the deterministic selector's
// pure logic, and vault-doc parity - the same discipline
// lib/belief-map-registry.test.js applies to the belief-map registry.
//
// Run with:
//   node lib/alignment-library-registry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const reg = require('./alignment-library-registry.js');
const {
  REGISTRY_SCHEMA_VERSION, AXIS_IDS, DOMAINS, BAND_KEYS,
  ALIGNMENT_LIBRARY_REGISTRY, getAlignmentEntry, selectAlignmentAxis,
} = reg;

// ---- 1. Registry shape and coverage ----
{
  ok('schema version is 1', REGISTRY_SCHEMA_VERSION === 1, REGISTRY_SCHEMA_VERSION);
  ok('AXIS_IDS holds 32 axes', AXIS_IDS.length === 32, AXIS_IDS.length);
  ok('AXIS_IDS has no duplicates', new Set(AXIS_IDS).size === AXIS_IDS.length);
  ok('DOMAINS is exactly Work/Relationships/Decisions/Conflict, in order',
    JSON.stringify(DOMAINS) === JSON.stringify(['Work', 'Relationships', 'Decisions', 'Conflict']), DOMAINS);
  ok('BAND_KEYS is exactly strongL/leanL/mid/leanR/strongR, in order',
    JSON.stringify(BAND_KEYS) === JSON.stringify(['strongL', 'leanL', 'mid', 'leanR', 'strongR']), BAND_KEYS);

  ok('registry holds exactly 640 entries (32 axes x 4 domains x 5 bands)',
    ALIGNMENT_LIBRARY_REGISTRY.length === 640, ALIGNMENT_LIBRARY_REGISTRY.length);

  const shapeErrors = [];
  ALIGNMENT_LIBRARY_REGISTRY.forEach((e, i) => {
    if (!AXIS_IDS.includes(e.axisId)) shapeErrors.push(`[${i}] unknown axisId: ${e.axisId}`);
    if (!DOMAINS.includes(e.domain)) shapeErrors.push(`[${i}] unknown domain: ${e.domain}`);
    if (!BAND_KEYS.includes(e.band)) shapeErrors.push(`[${i}] unknown band: ${e.band}`);
    if (typeof e.text !== 'string' || e.text.trim().length < 20) shapeErrors.push(`[${i}] text missing or under 20 chars: ${e.axisId}/${e.domain}/${e.band}`);
  });
  ok('every entry has a valid axisId, domain, band, and real text', shapeErrors.length === 0, shapeErrors.slice(0, 8));

  const registryFrozen = Object.isFrozen(ALIGNMENT_LIBRARY_REGISTRY) &&
    ALIGNMENT_LIBRARY_REGISTRY.every(e => Object.isFrozen(e));
  ok('registry array and every entry object are frozen', registryFrozen);
}

// ---- 2. No gaps, no duplicates: exactly one entry per (axisId, domain, band) ----
{
  const seen = new Map();
  const dupes = [];
  ALIGNMENT_LIBRARY_REGISTRY.forEach((e) => {
    const key = `${e.axisId}|${e.domain}|${e.band}`;
    if (seen.has(key)) dupes.push(key);
    seen.set(key, true);
  });
  ok('no duplicate (axisId, domain, band) triples', dupes.length === 0, dupes);

  const missing = [];
  for (const axisId of AXIS_IDS) {
    for (const domain of DOMAINS) {
      for (const band of BAND_KEYS) {
        if (!seen.has(`${axisId}|${domain}|${band}`)) missing.push(`${axisId}|${domain}|${band}`);
      }
    }
  }
  ok('every (axisId, domain, band) combination is present - no gaps', missing.length === 0, missing.slice(0, 8));
}

// ---- 3. Cross-check against the product's real axis set ----
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = /const\s+AXIS_META\s*=\s*\{/.exec(html);
  let i = html.indexOf('{', m.index), depth = 0;
  while (i < html.length) {
    const ch = html[i];
    if (ch === "'") { i++; while (i < html.length && !(html[i] === "'" && html[i - 1] !== '\\')) i++; }
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(html.slice(m.index, i + 1) + '; this.AXIS_META = AXIS_META;').runInContext(sandbox);
  const metaIds = new Set(Object.keys(sandbox.AXIS_META));

  const unknown = AXIS_IDS.filter(id => !metaIds.has(id));
  ok('every registry axis exists in the product AXIS_META', unknown.length === 0, unknown);

  const uncovered = [...metaIds].filter(id => !AXIS_IDS.includes(id));
  ok('every product AXIS_META axis is covered by the registry (all 32)', uncovered.length === 0, uncovered);
}

// ---- 4. Content hygiene: no dashes, reasonable entry length ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const dashed = [], tooShort = [], tooLong = [];
  ALIGNMENT_LIBRARY_REGISTRY.forEach((e) => {
    const key = `${e.axisId}/${e.domain}/${e.band}`;
    if (e.text.includes(em) || e.text.includes(en)) dashed.push(key);
    const words = e.text.split(/\s+/).length;
    if (words < 15) tooShort.push(`${key}: ${words} words`);
    if (words > 120) tooLong.push(`${key}: ${words} words`);
  });
  ok('no em/en dashes in any entry text', dashed.length === 0, dashed.slice(0, 8));
  ok('every entry has substantial text (15+ words)', tooShort.length === 0, tooShort.slice(0, 8));
  ok('every entry stays reasonably compact (120 words max)', tooLong.length === 0, tooLong.slice(0, 8));
}

// ---- 5. getAlignmentEntry: lookup helper ----
{
  const found = getAlignmentEntry('self', 'Work', 'strongL');
  ok('getAlignmentEntry finds a known entry', found !== null && found.axisId === 'self');
  const notFound = getAlignmentEntry('self', 'Work', 'notaband');
  ok('getAlignmentEntry returns null for an unknown band', notFound === null);
  const notFound2 = getAlignmentEntry('not_an_axis', 'Work', 'strongL');
  ok('getAlignmentEntry returns null for an unknown axisId', notFound2 === null);
}

// ---- 6. selectAlignmentAxis: pure selector logic, not wired to real scores ----
{
  const classify = (s) => {
    if (s <= 2.19) return 'strongL';
    if (s <= 3.39) return 'leanL';
    if (s <= 4.60) return 'mid';
    if (s <= 5.80) return 'leanR';
    return 'strongR';
  };

  const r1 = selectAlignmentAxis(['self', 'uncertainty', 'authority'],
    { self: 6.5, uncertainty: 4.2, authority: 3.9 }, classify, ['self', 'uncertainty', 'authority']);
  ok('selects the candidate with the largest distance from midpoint (4)',
    r1 && r1.axisId === 'self' && r1.band === 'strongR', r1);

  // Tied distance from midpoint (both 1.0), tie-break priority ORDER REVERSED
  // relative to the candidate array, so a pass here proves the function
  // actually consults tieBreakPriority rather than just keeping first-seen.
  const r2 = selectAlignmentAxis(['self', 'uncertainty'],
    { self: 5.0, uncertainty: 3.0 }, classify, ['uncertainty', 'self']);
  ok('ties on equal distance from midpoint break by tie-break-priority order, not array order',
    r2 && r2.axisId === 'uncertainty', r2);

  const r3 = selectAlignmentAxis(['self', 'uncertainty', 'authority'],
    { self: 4.0, uncertainty: 4.0, authority: 4.0 }, classify, ['authority', 'self', 'uncertainty']);
  ok('all-midpoint candidates resolve to the highest-priority candidate, mid band',
    r3 && r3.axisId === 'authority' && r3.band === 'mid', r3);

  const r4 = selectAlignmentAxis(['self', 'unscored_axis'], { self: 5.5 }, classify, ['self']);
  ok('a candidate with no score in scoresByAxisId is skipped, not crashed on',
    r4 && r4.axisId === 'self', r4);

  ok('an empty candidate list throws rather than silently returning garbage',
    (() => { try { selectAlignmentAxis([], {}, classify, []); return false; } catch (e) { return true; } })());

  const r5 = selectAlignmentAxis(['unscored_axis'], {}, classify, []);
  ok('a candidate set with no scored axes returns null', r5 === null, r5);
}

// ---- 7. Vault-doc parity: the canonical content doc is the source of ----
// truth; every entry text this registry serves must appear in it verbatim.
// The doc lives outside the repo (Andre's Obsidian vault), so this section
// SKIPs - loudly, without failing - on machines without it. On the
// authoring machine it makes doc-to-code drift impossible to miss (the
// same DI-005 principle lib/belief-map-registry.test.js applies).
{
  const DOC = process.env.ALIGNMENT_LIBRARY_DOC ||
    "C:/Andre's 2nd brain/750 - Other Ventures/757 - Phil OS/Build Log and Decisions/Phil OS - Alignment Library Content.md";
  if (!fs.existsSync(DOC)) {
    console.log('SKIP - vault content doc not present on this machine; doc-parity checks not run');
  } else {
    const doc = fs.readFileSync(DOC, 'utf8');
    const missing = [];
    ALIGNMENT_LIBRARY_REGISTRY.forEach((e) => {
      const needle = `**${e.band}:** ${e.text}`;
      if (!doc.includes(needle)) missing.push(`${e.axisId}/${e.domain}/${e.band}`);
    });
    ok('every registry entry text appears verbatim in the vault content doc (640 fields)',
      missing.length === 0, missing.slice(0, 8));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
