// B-2 tests: Culture Map content registry (2026-08-02).
//
// Validates lib/culture-map-registry.js: shape completeness, coverage
// against the product's live ARCHETYPES (all 60 variants) and
// MEDIA_BY_FAMILY (every selected title must exist in that variant's own
// family's live 9-item pool - no new curation), content hygiene, and
// vault-doc byte-exact parity.
//
// Run with:
//   node lib/culture-map-registry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const reg = require('./culture-map-registry.js');
const { REGISTRY_SCHEMA_VERSION, VARIANT_IDS, CULTURE_MAP_REGISTRY, getVariantCultureMap } = reg;

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
new vm.Script(
  extractConst(html, 'ARCHETYPES', '[', ']') +
  extractConst(html, 'MEDIA_BY_FAMILY', '{', '}') +
  'this.ARCHETYPES = ARCHETYPES; this.MEDIA_BY_FAMILY = MEDIA_BY_FAMILY;'
).runInContext(sandbox);

// ---- 1. Shape and coverage ----
{
  ok('schema version is 1', REGISTRY_SCHEMA_VERSION === 1, REGISTRY_SCHEMA_VERSION);
  ok('VARIANT_IDS holds 60 variants', VARIANT_IDS.length === 60, VARIANT_IDS.length);
  ok('VARIANT_IDS has no duplicates', new Set(VARIANT_IDS).size === VARIANT_IDS.length);
  ok('registry holds exactly 60 variant entries', Object.keys(CULTURE_MAP_REGISTRY).length === 60,
    Object.keys(CULTURE_MAP_REGISTRY).length);

  const shapeErrors = [];
  let totalItems = 0;
  VARIANT_IDS.forEach((id) => {
    const e = CULTURE_MAP_REGISTRY[id];
    if (!e) { shapeErrors.push(`${id}: missing entry`); return; }
    if (e.variantId !== id) shapeErrors.push(`${id}: variantId mismatch (${e.variantId})`);
    ['films', 'music', 'books'].forEach((cat) => {
      if (!Array.isArray(e[cat]) || e[cat].length !== 1) {
        shapeErrors.push(`${id}.${cat}: expected exactly 1 item, got ${e[cat] && e[cat].length}`);
        return;
      }
      totalItems += e[cat].length;
      const item = e[cat][0];
      if (typeof item.title !== 'string' || item.title.trim().length < 2) shapeErrors.push(`${id}.${cat}[0].title: missing`);
      if (typeof item.why !== 'string' || item.why.trim().length < 20) shapeErrors.push(`${id}.${cat}[0].why: missing or too short`);
    });
  });
  ok('every variant has exactly 1 film + 1 music + 1 book, each with title and why',
    shapeErrors.length === 0, shapeErrors.slice(0, 8));
  ok('180 total item-assignments (60 variants x 3 categories)', totalItems === 180, totalItems);

  ok('registry object and every entry/array are frozen',
    Object.isFrozen(CULTURE_MAP_REGISTRY) &&
    VARIANT_IDS.every((id) => Object.isFrozen(CULTURE_MAP_REGISTRY[id]) &&
      Object.isFrozen(CULTURE_MAP_REGISTRY[id].films) &&
      Object.isFrozen(CULTURE_MAP_REGISTRY[id].music) &&
      Object.isFrozen(CULTURE_MAP_REGISTRY[id].books)));
}

// ---- 2. Cross-check against the product's live ARCHETYPES ----
{
  const liveIds = sandbox.ARCHETYPES.map((a) => a.id);
  const missingFromRegistry = liveIds.filter((id) => !VARIANT_IDS.includes(id));
  const extraInRegistry = VARIANT_IDS.filter((id) => !liveIds.includes(id));
  ok('every live ARCHETYPES variant id is covered by the registry', missingFromRegistry.length === 0, missingFromRegistry);
  ok('registry has no variant ids beyond the live ARCHETYPES set', extraInRegistry.length === 0, extraInRegistry);
}

// ---- 3. No new curation: every selected title must exist in that ----
// variant's own family's live MEDIA_BY_FAMILY pool.
{
  const idToFamily = {};
  sandbox.ARCHETYPES.forEach((a) => { idToFamily[a.id] = a.family; });

  const notInPool = [];
  let familiesCoveredUniformly = true;
  const familyPoolSizes = {};
  VARIANT_IDS.forEach((id) => {
    const family = idToFamily[id];
    const pool = sandbox.MEDIA_BY_FAMILY[family];
    if (!pool) { notInPool.push(`${id}: no MEDIA_BY_FAMILY entry for family "${family}"`); return; }
    const poolTitles = { films: pool.films.map((f) => f.title), music: pool.music.map((f) => f.title), books: pool.books.map((f) => f.title) };
    const e = CULTURE_MAP_REGISTRY[id];
    ['films', 'music', 'books'].forEach((cat) => {
      const title = e[cat][0].title;
      if (!poolTitles[cat].includes(title)) notInPool.push(`${id}.${cat}: "${title}" not in ${family}'s live pool`);
    });
  });
  ok('every registry title exists in that variant\'s own family\'s live MEDIA_BY_FAMILY pool (no new curation)',
    notInPool.length === 0, notInPool.slice(0, 8));

  Object.values(sandbox.MEDIA_BY_FAMILY).forEach((pool) => {
    const size = pool.films.length + pool.music.length + pool.books.length;
    if (size !== 9) familyPoolSizes[size] = (familyPoolSizes[size] || 0) + 1;
    if (pool.films.length !== 3 || pool.music.length !== 3 || pool.books.length !== 3) familiesCoveredUniformly = false;
  });
  ok('all 12 live families are uniformly 3 films / 3 music / 3 books (the corrected 2026-08-01 finding still holds)',
    familiesCoveredUniformly, familyPoolSizes);
}

// ---- 4. Content hygiene ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013), repl = String.fromCharCode(0xFFFD);
  const dashed = [], corrupted = [], placeholders = [];
  const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;
  VARIANT_IDS.forEach((id) => {
    const e = CULTURE_MAP_REGISTRY[id];
    ['films', 'music', 'books'].forEach((cat) => {
      const item = e[cat][0];
      [['title', item.title], ['why', item.why]].forEach(([f, v]) => {
        if (v.includes(em) || v.includes(en)) dashed.push(`${id}.${cat}.${f}`);
        if (v.includes(repl)) corrupted.push(`${id}.${cat}.${f}`);
        if (PLACEHOLDER_RE.test(v)) placeholders.push(`${id}.${cat}.${f}`);
      });
    });
  });
  ok('no em/en dashes anywhere in the registry', dashed.length === 0, dashed.slice(0, 8));
  ok('no replacement characters anywhere in the registry', corrupted.length === 0, corrupted.slice(0, 8));
  ok('no placeholder/stub text anywhere in the registry', placeholders.length === 0, placeholders.slice(0, 8));
}

// ---- 5. getVariantCultureMap helper ----
{
  const found = getVariantCultureMap('1A');
  ok('getVariantCultureMap finds a known variant', found !== null && found.variantId === '1A');
  const notFound = getVariantCultureMap('99Z');
  ok('getVariantCultureMap returns null for an unknown variant', notFound === null);
}

// ---- 6. Vault-doc parity ----
{
  const DOC = process.env.CULTURE_MAP_DOC ||
    "C:/Andre's 2nd brain/750 - Other Ventures/757 - Phil OS/Build Log and Decisions/Phil OS - Culture Map Variant Content.md";
  if (!fs.existsSync(DOC)) {
    console.log('SKIP - vault content doc not present on this machine; doc-parity checks not run');
  } else {
    const doc = fs.readFileSync(DOC, 'utf8');
    const missing = [];
    VARIANT_IDS.forEach((id) => {
      const e = CULTURE_MAP_REGISTRY[id];
      ['films', 'music', 'books'].forEach((cat) => {
        const item = e[cat][0];
        if (!doc.includes(item.why)) missing.push(`${id}.${cat}[0].why`);
        if (!doc.includes(item.title)) missing.push(`${id}.${cat}[0].title`);
      });
    });
    ok('every registry text field appears verbatim in the vault content doc (60 x 3 x 2 = 360 fields)',
      missing.length === 0, missing.slice(0, 8));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
