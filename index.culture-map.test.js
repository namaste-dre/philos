// B-2 wiring block: behavioral lock for the Culture Map rendering
// (2026-08-02). Pins the client-side implementation of the variant-specific
// film/music/book pick and its personalized "why" text - the
// CULTURE_MAP_LIBRARY const and the MEDIA ECOSYSTEM rendering block inside
// renderReport(), both defined in index.html - so any future change can
// only happen loudly.
//
// Covers: coverage against the product's live ARCHETYPES (all 60 variants,
// no extras, no gaps), field completeness, no-new-curation (every embedded
// pick's title exists in that variant's own family's live MEDIA_BY_FAMILY
// pool, in the right category), content hygiene, byte-identical parity
// against lib/culture-map-registry.js, and the rendered card output (a
// known variant's pick is featured with its why-text and the rest of the
// family pool stays visible, a second variant for breadth, an unrecognized
// variant degrades gracefully, a missing archetypeResult does not throw).
//
// Run with:
//   node index.culture-map.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

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

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error('start marker not found: ' + startMarker);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error('end marker not found: ' + endMarker);
  return source.slice(start, end);
}

const sandbox = {};
vm.createContext(sandbox);
new vm.Script(
  extractConst(html, 'ARCHETYPES', '[', ']') + '\n' +
  extractConst(html, 'MEDIA_BY_FAMILY', '{', '}') + '\n' +
  extractConst(html, 'CULTURE_MAP_LIBRARY', '{', '}') + '\n' +
  'this.ARCHETYPES = ARCHETYPES; this.MEDIA_BY_FAMILY = MEDIA_BY_FAMILY; this.CULTURE_MAP_LIBRARY = CULTURE_MAP_LIBRARY;'
).runInContext(sandbox);
const { ARCHETYPES, MEDIA_BY_FAMILY, CULTURE_MAP_LIBRARY } = sandbox;
const liveIds = ARCHETYPES.map((a) => a.id);
const CATEGORIES = ['films', 'music', 'books'];

// ---- 1. Coverage against live ARCHETYPES ----
{
  const libIds = Object.keys(CULTURE_MAP_LIBRARY);
  ok('CULTURE_MAP_LIBRARY holds exactly 60 variant entries', libIds.length === 60, libIds.length);
  const missing = liveIds.filter((id) => !libIds.includes(id));
  const extra = libIds.filter((id) => !liveIds.includes(id));
  ok('every live ARCHETYPES variant id is covered', missing.length === 0, missing);
  ok('no variant ids beyond the live ARCHETYPES set', extra.length === 0, extra);
}

// ---- 2. Field completeness ----
{
  const shapeErrors = [];
  liveIds.forEach((id) => {
    const e = CULTURE_MAP_LIBRARY[id];
    if (!e) { shapeErrors.push(`${id}: missing entry`); return; }
    CATEGORIES.forEach((cat) => {
      const arr = e[cat];
      if (!Array.isArray(arr) || arr.length !== 1) { shapeErrors.push(`${id}.${cat}: expected a single-item array`); return; }
      const item = arr[0];
      if (typeof item.title !== 'string' || item.title.trim().length < 3) shapeErrors.push(`${id}.${cat}.title: missing or too short`);
      if (typeof item.why !== 'string' || item.why.trim().length < 10) shapeErrors.push(`${id}.${cat}.why: missing or too short`);
    });
  });
  ok('every variant has a complete films/music/books pick (title + why each)', shapeErrors.length === 0, shapeErrors.slice(0, 8));
}

// ---- 3. No new curation: every embedded pick belongs to that variant's ----
// own family's live MEDIA_BY_FAMILY pool, in the matching category.
{
  const missing = [];
  liveIds.forEach((id) => {
    const arch = ARCHETYPES.find((a) => a.id === id);
    const familyPool = arch && MEDIA_BY_FAMILY[arch.family];
    const e = CULTURE_MAP_LIBRARY[id];
    if (!arch || !familyPool || !e) { missing.push(`${id}: no arch/family pool/entry`); return; }
    CATEGORIES.forEach((cat) => {
      const title = e[cat][0].title;
      const poolTitles = familyPool[cat].map((m) => m.title);
      if (!poolTitles.includes(title)) missing.push(`${id}.${cat}: "${title}" not in ${arch.family}'s live pool`);
    });
  });
  ok('every embedded pick title exists in that variant\'s own family\'s live MEDIA_BY_FAMILY pool (no new curation)',
    missing.length === 0, missing.slice(0, 8));
}

// ---- 4. Content hygiene on the client-embedded subset ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;
  const dashed = [], placeholders = [];
  liveIds.forEach((id) => {
    const e = CULTURE_MAP_LIBRARY[id];
    CATEGORIES.forEach((cat) => {
      ['title', 'why'].forEach((f) => {
        const v = e[cat][0][f];
        if (v.includes(em) || v.includes(en)) dashed.push(`${id}.${cat}.${f}`);
        if (PLACEHOLDER_RE.test(v)) placeholders.push(`${id}.${cat}.${f}`);
      });
    });
  });
  ok('no em/en dashes in the client-embedded CULTURE_MAP_LIBRARY subset', dashed.length === 0, dashed.slice(0, 8));
  ok('no placeholder/stub text in the client-embedded subset', placeholders.length === 0, placeholders.slice(0, 8));
}

// ---- 5. Cross-file parity: client subset must be byte-identical to ----
// lib/culture-map-registry.js's already vault-parity-tested content.
{
  const { CULTURE_MAP_REGISTRY } = require('./lib/culture-map-registry.js');
  const mismatches = [];
  liveIds.forEach((id) => {
    const canonical = CULTURE_MAP_REGISTRY[id];
    const client = CULTURE_MAP_LIBRARY[id];
    CATEGORIES.forEach((cat) => {
      ['title', 'why'].forEach((f) => {
        if (!canonical || !client || client[cat][0][f] !== canonical[cat][0][f]) {
          mismatches.push(`${id}.${cat}.${f}`);
        }
      });
    });
  });
  ok('client CULTURE_MAP_LIBRARY is byte-identical to lib/culture-map-registry.js for all 60 x 3 x 2 = 360 fields',
    mismatches.length === 0, mismatches.slice(0, 8));
}

// ---- 6. Rendered output: the MEDIA ECOSYSTEM block inside renderReport() ----
// Extracted by source markers (not a standalone function) and run against a
// minimal fake DOM/report.
{
  const block = extractBetween(html, '// ── MEDIA ECOSYSTEM (CULTURE MAP) ──', '// ── GROWTH ──');
  ok('extracted MEDIA ECOSYSTEM block still assigns mediaEl.innerHTML', block.includes('mediaEl.innerHTML'), block.slice(0, 80));

  function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderMedia(family, archetypeResult) {
    const fakeEl = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
    const fakeNav = { style: {} };
    const runSandbox = {
      document: {
        getElementById: (id) => (id === 'report-media' ? fakeEl : null),
        querySelector: () => fakeNav,
      },
      MEDIA_BY_FAMILY, CULTURE_MAP_LIBRARY, sanitizeHTML, family, archetypeResult, console,
    };
    vm.createContext(runSandbox);
    new vm.Script(block).runInContext(runSandbox);
    return fakeEl._html;
  }

  const arch1A = ARCHETYPES.find((a) => a.id === '1A');
  const arch7C = ARCHETYPES.find((a) => a.id === '7C');

  // 6a. Known variant (1A): featured pick with why-text, plus the rest of the family pool.
  {
    const out = renderMedia(arch1A.family, { primary: { id: '1A' } });
    const pick = CULTURE_MAP_LIBRARY['1A'];
    ok('renders the "Your match" label for a known variant', out.includes('Your match'));
    ok('renders the featured film title for 1A', out.includes(sanitizeHTML(pick.films[0].title)));
    ok('renders the featured film why-text for 1A', out.includes(sanitizeHTML(pick.films[0].why)));
    ok('renders the featured music why-text for 1A', out.includes(sanitizeHTML(pick.music[0].why)));
    ok('renders the featured book why-text for 1A', out.includes(sanitizeHTML(pick.books[0].why)));
    const familyPool = MEDIA_BY_FAMILY[arch1A.family];
    const restFilm = familyPool.films.find((m) => m.title !== pick.films[0].title);
    ok('the rest of the family film pool still renders with its generic note', !!restFilm && out.includes(restFilm.note), restFilm);
    ok('the featured pick is not duplicated in the rest-of-family list', out.split(pick.films[0].title).length - 1 === 1, out.split(pick.films[0].title).length - 1);
    ok('no undefined leaks into the rendered output', !out.includes('undefined'), out);
  }

  // 6b. A second representative variant (7C) for breadth.
  {
    const out = renderMedia(arch7C.family, { primary: { id: '7C' } });
    const pick = CULTURE_MAP_LIBRARY['7C'];
    ok('renders the featured book why-text for 7C', out.includes(sanitizeHTML(pick.books[0].why)));
    ok('no undefined leaks into the rendered output for 7C', !out.includes('undefined'), out);
  }

  // 6c. Unknown/missing variant id: must degrade gracefully - family pool renders, no featured pick, no crash, no leak.
  {
    let threw = false, out = '';
    try { out = renderMedia(arch1A.family, { primary: { id: '99Z' } }); }
    catch (e) { threw = true; }
    ok('an unrecognized variant id does not throw', !threw);
    ok('an unrecognized variant id still renders the family pool', out.includes(MEDIA_BY_FAMILY[arch1A.family].films[0].note));
    ok('an unrecognized variant id renders no "Your match" pick and no undefined leak', !out.includes('Your match') && !out.includes('undefined'), out);
  }

  // 6d. No archetypeResult at all (defensive: older call sites / edge case).
  {
    let threw = false, out = '';
    try { out = renderMedia(arch1A.family, null); }
    catch (e) { threw = true; }
    ok('a missing archetypeResult does not throw', !threw);
    ok('a missing archetypeResult still renders the family pool with no undefined leak',
      out.includes(MEDIA_BY_FAMILY[arch1A.family].films[0].note) && !out.includes('undefined'), out);
  }
}

// ---- 7. Public share untouched: api/report.js has no Culture Map/media ----
// surface to begin with, so this block correctly leaves it alone.
{
  const reportJs = fs.readFileSync(path.join(__dirname, 'api', 'report.js'), 'utf8');
  ok('api/report.js has no MEDIA_BY_FAMILY/Culture Map rendering (nothing to keep in parity, correctly left untouched)',
    !reportJs.includes('MEDIA_BY_FAMILY') && !/culture.?map/i.test(reportJs));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
