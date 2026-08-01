// B-1 tests: Famous Minds content registry (2026-08-02).
//
// Validates lib/famous-minds-registry.js: shape completeness, coverage
// against the product's live ARCHETYPES, figure-name parity against each
// variant's live `thinkers` line (reconstructing the qualifier-in-parens
// format thinkers uses), content hygiene, and vault-doc byte-exact parity.
//
// Run with:
//   node lib/famous-minds-registry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const reg = require('./famous-minds-registry.js');
const { REGISTRY_SCHEMA_VERSION, VARIANT_IDS, FAMOUS_MINDS_REGISTRY, getVariantFigures } = reg;

function extractConst(source, name, open, close) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*\\' + open).exec(source);
  if (!m) throw new Error('const not found: ' + name);
  let i = source.indexOf(open, m.index), depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      const q = ch; i++;
      while (i < source.length && !(source[i] === q && source[i - 1] !== '\\')) i++;
    } else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) break; }
    i++;
  }
  return source.slice(m.index, i + 1) + ';';
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
new vm.Script(extractConst(html, 'ARCHETYPES', '[', ']') + '\nthis.ARCHETYPES = ARCHETYPES;').runInContext(sandbox);

// ---- 1. Shape and coverage ----
{
  ok('schema version is 1', REGISTRY_SCHEMA_VERSION === 1, REGISTRY_SCHEMA_VERSION);
  ok('VARIANT_IDS holds 60 variants', VARIANT_IDS.length === 60, VARIANT_IDS.length);
  ok('VARIANT_IDS has no duplicates', new Set(VARIANT_IDS).size === VARIANT_IDS.length);
  ok('registry holds exactly 60 variant entries', Object.keys(FAMOUS_MINDS_REGISTRY).length === 60,
    Object.keys(FAMOUS_MINDS_REGISTRY).length);

  const shapeErrors = [];
  let totalFigures = 0;
  VARIANT_IDS.forEach((id) => {
    const e = FAMOUS_MINDS_REGISTRY[id];
    if (!e) { shapeErrors.push(`${id}: missing entry`); return; }
    if (e.variantId !== id) shapeErrors.push(`${id}: variantId mismatch (${e.variantId})`);
    if (!Array.isArray(e.figures) || e.figures.length !== 3) {
      shapeErrors.push(`${id}: expected exactly 3 figures, got ${e.figures && e.figures.length}`);
      return;
    }
    totalFigures += e.figures.length;
    e.figures.forEach((f, i) => {
      ['name', 'role', 'match', 'diverge', 'startHere'].forEach((field) => {
        if (typeof f[field] !== 'string' || f[field].trim().length < 5) {
          shapeErrors.push(`${id}.figures[${i}].${field}: missing or too short`);
        }
      });
      if (f.qualifier !== null && (typeof f.qualifier !== 'string' || f.qualifier.trim().length < 2)) {
        shapeErrors.push(`${id}.figures[${i}].qualifier: present but invalid (${JSON.stringify(f.qualifier)})`);
      }
    });
  });
  ok('every variant has exactly 3 complete figure entries', shapeErrors.length === 0, shapeErrors.slice(0, 8));
  ok('180 total figure entries (60 variants x 3 figures)', totalFigures === 180, totalFigures);

  ok('registry object and every entry/figure array are frozen',
    Object.isFrozen(FAMOUS_MINDS_REGISTRY) &&
    VARIANT_IDS.every((id) => Object.isFrozen(FAMOUS_MINDS_REGISTRY[id]) && Object.isFrozen(FAMOUS_MINDS_REGISTRY[id].figures)));
}

// ---- 2. Cross-check against the product's live ARCHETYPES ----
{
  const liveIds = sandbox.ARCHETYPES.map((a) => a.id);
  const missingFromRegistry = liveIds.filter((id) => !VARIANT_IDS.includes(id));
  const extraInRegistry = VARIANT_IDS.filter((id) => !liveIds.includes(id));
  ok('every live ARCHETYPES variant id is covered by the registry', missingFromRegistry.length === 0, missingFromRegistry);
  ok('registry has no variant ids beyond the live ARCHETYPES set', extraInRegistry.length === 0, extraInRegistry);
}

// ---- 3. Figure-name parity against each variant's live `thinkers` line ----
// thinkers renders a qualifier as "(qualifier)" appended to the name (e.g.
// "Albert Camus (private mode)"); the registry stores name and qualifier
// separately for clean chip rendering. Reconstruct the thinkers format
// from the registry and confirm it matches the live field, EXCEPT for a
// small set of disclosed, pre-existing wording divergences where the vault
// doc's chip label is a fuller phrase than the thinkers line's terser
// parenthetical (both already live/reviewed; this test enumerates them by
// name so any OTHER, unexpected divergence still fails loudly - the same
// EXPECTED_POLE_DIVERGENCES pattern lib/belief-map-registry.test.js uses).
{
  const idToThinkers = {};
  sandbox.ARCHETYPES.forEach((a) => { idToThinkers[a.id] = a.thinkers; });

  // { variantId: { figureName: liveParentheticalQualifier } } - the exact
  // qualifier text the live thinkers line uses where it diverges from the
  // vault doc's fuller chip label for the same figure.
  const EXPECTED_QUALIFIER_DIVERGENCES = {
    '8C': { 'Thich Nhat Hanh': 'secular', 'Simone Weil': 'secular' },
    '12A': { 'Friedrich Nietzsche': 'early' },
    '12E': { 'Richard Rorty': 'anti-metaphysical' },
  };

  // The live data itself is inconsistent about qualifier casing inside the
  // parentheses ("(private mode)" lowercase, "(Stoic mode)" capitalized),
  // so word-for-word case is not a meaningful signal here - compare
  // case-insensitively for wording, after substituting each enumerated
  // divergence's genuinely different words.
  const mismatches = [];
  const unexpectedDivergences = [];
  VARIANT_IDS.forEach((id) => {
    const e = FAMOUS_MINDS_REGISTRY[id];
    const known = EXPECTED_QUALIFIER_DIVERGENCES[id] || {};
    const parts = e.figures.map((f) => {
      if (!f.qualifier) return f.name;
      const liveQualifier = known[f.name] !== undefined ? known[f.name] : f.qualifier;
      return `${f.name} (${liveQualifier})`;
    });
    const reconstructed = parts.join(' \u00b7 ');
    const live = idToThinkers[id];
    if (reconstructed.toLowerCase() !== live.toLowerCase()) mismatches.push({ id, reconstructed, live });
  });
  ok('every variant\'s reconstructed name+qualifier line matches the live thinkers field case-insensitively, honoring the enumerated wording divergences',
    mismatches.length === 0, mismatches.slice(0, 5));

  // Confirm the enumerated divergences are still real wording differences
  // (not just stale case differences) - if a future vault edit makes the
  // words match exactly, this entry should be removed, not silently left
  // stale to keep passing for the wrong reason.
  Object.entries(EXPECTED_QUALIFIER_DIVERGENCES).forEach(([id, figs]) => {
    Object.entries(figs).forEach(([name, liveQualifier]) => {
      const f = FAMOUS_MINDS_REGISTRY[id].figures.find((x) => x.name === name);
      if (!f || f.qualifier.toLowerCase() === liveQualifier.toLowerCase()) {
        unexpectedDivergences.push({ id, name, liveQualifier, chipQualifier: f && f.qualifier });
      }
    });
  });
  ok('every enumerated divergence is still a real wording divergence (not stale)', unexpectedDivergences.length === 0, unexpectedDivergences);
}

// ---- 4. Content hygiene ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013), repl = String.fromCharCode(0xFFFD);
  const dashed = [], corrupted = [], placeholders = [];
  const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;
  VARIANT_IDS.forEach((id) => {
    FAMOUS_MINDS_REGISTRY[id].figures.forEach((f, i) => {
      ['name', 'role', 'match', 'diverge', 'startHere'].forEach((field) => {
        const v = f[field];
        if (v.includes(em) || v.includes(en)) dashed.push(`${id}.figures[${i}].${field}`);
        if (v.includes(repl)) corrupted.push(`${id}.figures[${i}].${field}`);
        if (PLACEHOLDER_RE.test(v)) placeholders.push(`${id}.figures[${i}].${field}`);
      });
    });
  });
  ok('no em/en dashes anywhere in the registry', dashed.length === 0, dashed.slice(0, 8));
  ok('no replacement characters anywhere in the registry', corrupted.length === 0, corrupted.slice(0, 8));
  ok('no placeholder/stub text anywhere in the registry', placeholders.length === 0, placeholders.slice(0, 8));
}

// ---- 5. No stray editorial/review-process brackets leaked into product content ----
// (the disclosed extraction judgment call: "[Approved as drafted, D156]" on
// Rabbi Jonathan Sacks is an editorial note, not a chip, and must not appear
// as a qualifier anywhere in the registry).
{
  const leaked = [];
  VARIANT_IDS.forEach((id) => {
    FAMOUS_MINDS_REGISTRY[id].figures.forEach((f) => {
      if (f.qualifier && /\bD\d{2,4}\b|\bapproved\b/i.test(f.qualifier)) leaked.push(`${id}/${f.name}: ${f.qualifier}`);
    });
  });
  ok('no editorial/decision-tracking language leaked into any qualifier field', leaked.length === 0, leaked);

  const sacks = VARIANT_IDS.map((id) => FAMOUS_MINDS_REGISTRY[id].figures.find((f) => f.name.includes('Jonathan Sacks'))).filter(Boolean);
  ok('Rabbi Jonathan Sacks entry (found) has qualifier: null, per the disclosed extraction decision',
    sacks.length === 1 && sacks[0].qualifier === null, sacks);
}

// ---- 6. getVariantFigures helper ----
{
  const found = getVariantFigures('1A');
  ok('getVariantFigures finds a known variant', found !== null && found.variantId === '1A');
  const notFound = getVariantFigures('99Z');
  ok('getVariantFigures returns null for an unknown variant', notFound === null);
}

// ---- 7. Vault-doc parity ----
{
  const DOC = process.env.FAMOUS_MINDS_DOC ||
    "C:/Andre's 2nd brain/750 - Other Ventures/757 - Phil OS/Build Log and Decisions/Phil OS - Famous Minds Variant Content.md";
  if (!fs.existsSync(DOC)) {
    console.log('SKIP - vault content doc not present on this machine; doc-parity checks not run');
  } else {
    const doc = fs.readFileSync(DOC, 'utf8');
    const missing = [];
    VARIANT_IDS.forEach((id) => {
      FAMOUS_MINDS_REGISTRY[id].figures.forEach((f, i) => {
        ['name', 'role', 'match', 'diverge', 'startHere'].forEach((field) => {
          if (!doc.includes(f[field])) missing.push(`${id}.figures[${i}].${field}`);
        });
        if (f.qualifier && !doc.includes(`[${f.qualifier}]`)) missing.push(`${id}.figures[${i}].qualifier`);
      });
    });
    ok('every registry text field appears verbatim in the vault content doc (180 x 5 fields + qualifiers)',
      missing.length === 0, missing.slice(0, 8));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
