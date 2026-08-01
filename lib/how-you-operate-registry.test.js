// B-3 tests: How You Operate content registry (2026-08-02).
//
// Validates lib/how-you-operate-registry.js: shape completeness, coverage
// against the product's live ARCHETYPES (all 60 variants, no extras, no
// gaps), content hygiene, and vault-doc byte-exact parity - the same
// discipline lib/belief-map-registry.test.js and
// lib/alignment-library-registry.test.js apply to their registries.
//
// Run with:
//   node lib/how-you-operate-registry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const reg = require('./how-you-operate-registry.js');
const { REGISTRY_SCHEMA_VERSION, VARIANT_IDS, HOW_YOU_OPERATE_REGISTRY, getVariantExpansion } = reg;

// ---- 1. Shape and coverage ----
{
  ok('schema version is 1', REGISTRY_SCHEMA_VERSION === 1, REGISTRY_SCHEMA_VERSION);
  ok('VARIANT_IDS holds 60 variants', VARIANT_IDS.length === 60, VARIANT_IDS.length);
  ok('VARIANT_IDS has no duplicates', new Set(VARIANT_IDS).size === VARIANT_IDS.length);
  ok('registry holds exactly 60 variant entries', Object.keys(HOW_YOU_OPERATE_REGISTRY).length === 60,
    Object.keys(HOW_YOU_OPERATE_REGISTRY).length);

  const EXPANSION_FIELDS = ['title', 'pattern', 'whereItShowsUp', 'cost', 'lever'];
  const shapeErrors = [];
  VARIANT_IDS.forEach((id) => {
    const e = HOW_YOU_OPERATE_REGISTRY[id];
    if (!e) { shapeErrors.push(`${id}: missing entry`); return; }
    if (e.variantId !== id) shapeErrors.push(`${id}: variantId mismatch (${e.variantId})`);
    ['strength', 'failureMode'].forEach((kind) => {
      const exp = e[kind];
      if (!exp) { shapeErrors.push(`${id}.${kind}: missing`); return; }
      EXPANSION_FIELDS.forEach((f) => {
        // "title" mirrors the live one-liner's short lead phrase and can be
        // a single word ("Integrity", "Presence"); the four substantive
        // fields are always full sentences.
        const minLen = f === 'title' ? 3 : 10;
        if (typeof exp[f] !== 'string' || exp[f].trim().length < minLen) {
          shapeErrors.push(`${id}.${kind}.${f}: missing or under ${minLen} chars`);
        }
      });
    });
  });
  ok('every variant has a complete strength and failureMode expansion (all 5 fields each)',
    shapeErrors.length === 0, shapeErrors.slice(0, 8));

  ok('registry object and every entry are frozen',
    Object.isFrozen(HOW_YOU_OPERATE_REGISTRY) &&
    VARIANT_IDS.every((id) => Object.isFrozen(HOW_YOU_OPERATE_REGISTRY[id]) &&
      Object.isFrozen(HOW_YOU_OPERATE_REGISTRY[id].strength) &&
      Object.isFrozen(HOW_YOU_OPERATE_REGISTRY[id].failureMode)));
}

// ---- 2. Cross-check against the product's live ARCHETYPES ----
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(extractConst(html, 'ARCHETYPES', '[', ']') + '\nthis.ARCHETYPES = ARCHETYPES;').runInContext(sandbox);
  const liveIds = sandbox.ARCHETYPES.map((a) => a.id);

  const missingFromRegistry = liveIds.filter((id) => !VARIANT_IDS.includes(id));
  const extraInRegistry = VARIANT_IDS.filter((id) => !liveIds.includes(id));
  ok('every live ARCHETYPES variant id is covered by the registry', missingFromRegistry.length === 0, missingFromRegistry);
  ok('registry has no variant ids beyond the live ARCHETYPES set', extraInRegistry.length === 0, extraInRegistry);

  // The registry does not duplicate strength/failureMode one-liners (those
  // stay live in ARCHETYPES); confirm the registry's own expansion titles
  // are at minimum consistent with the live one-liners existing at all.
  const noLiveText = liveIds.filter((id) => {
    const a = sandbox.ARCHETYPES.find((x) => x.id === id);
    return !a.strength || !a.failureMode;
  });
  ok('every live variant this registry covers actually has a live strength/failureMode to expand',
    noLiveText.length === 0, noLiveText);
}

// ---- 3. Content hygiene ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013), repl = String.fromCharCode(0xFFFD);
  const dashed = [], corrupted = [], placeholders = [];
  const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;
  VARIANT_IDS.forEach((id) => {
    const e = HOW_YOU_OPERATE_REGISTRY[id];
    ['strength', 'failureMode'].forEach((kind) => {
      ['title', 'pattern', 'whereItShowsUp', 'cost', 'lever'].forEach((f) => {
        const v = e[kind][f];
        if (v.includes(em) || v.includes(en)) dashed.push(`${id}.${kind}.${f}`);
        if (v.includes(repl)) corrupted.push(`${id}.${kind}.${f}`);
        if (PLACEHOLDER_RE.test(v)) placeholders.push(`${id}.${kind}.${f}`);
      });
    });
  });
  ok('no em/en dashes anywhere in the registry', dashed.length === 0, dashed.slice(0, 8));
  ok('no replacement characters anywhere in the registry', corrupted.length === 0, corrupted.slice(0, 8));
  ok('no placeholder/stub text anywhere in the registry', placeholders.length === 0, placeholders.slice(0, 8));
}

// ---- 4. getVariantExpansion helper ----
{
  const found = getVariantExpansion('1A');
  ok('getVariantExpansion finds a known variant', found !== null && found.variantId === '1A');
  const notFound = getVariantExpansion('99Z');
  ok('getVariantExpansion returns null for an unknown variant', notFound === null);
}

// ---- 5. Vault-doc parity: every expansion field must appear verbatim ----
// in the canonical vault doc. SKIPs loudly, without failing, on machines
// without the vault (same DI-005 principle the sibling registries apply).
{
  const DOC = process.env.HOW_YOU_OPERATE_DOC ||
    "C:/Andre's 2nd brain/750 - Other Ventures/757 - Phil OS/Build Log and Decisions/Phil OS - How You Operate Variant Content.md";
  if (!fs.existsSync(DOC)) {
    console.log('SKIP - vault content doc not present on this machine; doc-parity checks not run');
  } else {
    const doc = fs.readFileSync(DOC, 'utf8');
    const missing = [];
    VARIANT_IDS.forEach((id) => {
      const e = HOW_YOU_OPERATE_REGISTRY[id];
      ['strength', 'failureMode'].forEach((kind) => {
        ['pattern', 'whereItShowsUp', 'cost', 'lever'].forEach((f) => {
          if (!doc.includes(e[kind][f])) missing.push(`${id}.${kind}.${f}`);
        });
        if (!doc.includes(e[kind].title)) missing.push(`${id}.${kind}.title`);
      });
    });
    ok('every registry field appears verbatim in the vault content doc (60 x 2 x 5 = 600 fields)',
      missing.length === 0, missing.slice(0, 8));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
