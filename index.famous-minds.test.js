// B-1 wiring block: behavioral lock for the Famous Minds rendering
// (2026-08-02). Pins the client-side implementation of the variant-specific
// figure entries - the FAMOUS_MINDS_LIBRARY const and the FAMOUS TYPES
// rendering block inside renderReport(), both defined in index.html - so
// any future change can only happen loudly.
//
// Covers: coverage against the product's live ARCHETYPES (all 60 variants,
// no extras, no gaps, no duplicates), field completeness (3 figures per
// variant, all required fields), content hygiene including the editorial-
// process-leak scan (the same class of defect a 2026-08-02 pre-wiring
// review found and fixed - "which is why this placement needed explicit
// D156 approval" leaked into two diverge strings), byte-identical parity
// against lib/famous-minds-registry.js, and the rendered card output (a
// known variant, a second variant, an unrecognized variant degrading
// gracefully, a missing archetypeResult not throwing).
//
// Run with:
//   node index.famous-minds.test.js

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
  extractConst(html, 'FAMOUS_MINDS_LIBRARY', '{', '}') + '\n' +
  'this.ARCHETYPES = ARCHETYPES; this.FAMOUS_MINDS_LIBRARY = FAMOUS_MINDS_LIBRARY;'
).runInContext(sandbox);
const { ARCHETYPES, FAMOUS_MINDS_LIBRARY } = sandbox;
const liveIds = ARCHETYPES.map((a) => a.id);
const TEXT_FIELDS = ['role', 'match', 'diverge', 'startHere'];

// ---- 1. Coverage against live ARCHETYPES, no duplicates ----
{
  const libIds = Object.keys(FAMOUS_MINDS_LIBRARY);
  ok('FAMOUS_MINDS_LIBRARY holds exactly 60 variant entries', libIds.length === 60, libIds.length);
  ok('no duplicate variant ids in the client-embedded library', new Set(libIds).size === libIds.length);
  const missing = liveIds.filter((id) => !libIds.includes(id));
  const extra = libIds.filter((id) => !liveIds.includes(id));
  ok('every live ARCHETYPES variant id is covered', missing.length === 0, missing);
  ok('no variant ids beyond the live ARCHETYPES set', extra.length === 0, extra);
}

// ---- 2. Field completeness: 3 figures per variant, all required fields ----
{
  const shapeErrors = [];
  liveIds.forEach((id) => {
    const e = FAMOUS_MINDS_LIBRARY[id];
    if (!e || !Array.isArray(e.figures)) { shapeErrors.push(`${id}: missing entry or figures array`); return; }
    if (e.figures.length !== 3) { shapeErrors.push(`${id}: expected 3 figures, got ${e.figures.length}`); return; }
    e.figures.forEach((f, i) => {
      if (typeof f.name !== 'string' || f.name.trim().length < 2) shapeErrors.push(`${id}.figures[${i}].name: missing or too short`);
      if (f.qualifier !== null && (typeof f.qualifier !== 'string' || f.qualifier.trim().length < 2)) shapeErrors.push(`${id}.figures[${i}].qualifier: must be null or a real string`);
      TEXT_FIELDS.forEach((field) => {
        if (typeof f[field] !== 'string' || f[field].trim().length < 10) shapeErrors.push(`${id}.figures[${i}].${field}: missing or too short`);
      });
    });
  });
  ok('every variant has exactly 3 figures with all required fields', shapeErrors.length === 0, shapeErrors.slice(0, 8));
}

// ---- 3. Content hygiene, including the editorial-process-leak scan ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;
  const EDITORIAL_RE = /\bD\d{2,4}\b|\bapproved\b/i;
  const dashed = [], placeholders = [], leaked = [];
  liveIds.forEach((id) => {
    FAMOUS_MINDS_LIBRARY[id].figures.forEach((f, i) => {
      if (f.qualifier && EDITORIAL_RE.test(f.qualifier)) leaked.push(`${id}.figures[${i}].qualifier`);
      TEXT_FIELDS.forEach((field) => {
        const v = f[field];
        if (v.includes(em) || v.includes(en)) dashed.push(`${id}.figures[${i}].${field}`);
        if (PLACEHOLDER_RE.test(v)) placeholders.push(`${id}.figures[${i}].${field}`);
        if (EDITORIAL_RE.test(v)) leaked.push(`${id}.figures[${i}].${field}`);
      });
    });
  });
  ok('no em/en dashes in the client-embedded FAMOUS_MINDS_LIBRARY subset', dashed.length === 0, dashed.slice(0, 8));
  ok('no placeholder/stub text in the client-embedded subset', placeholders.length === 0, placeholders.slice(0, 8));
  ok('no editorial/decision-tracking language leaked into any field (the D156 class of defect)', leaked.length === 0, leaked.slice(0, 8));
}

// ---- 4. Cross-file parity: client subset must be byte-identical to ----
// lib/famous-minds-registry.js's already vault-parity-tested content.
{
  const { FAMOUS_MINDS_REGISTRY } = require('./lib/famous-minds-registry.js');
  const mismatches = [];
  liveIds.forEach((id) => {
    const canonical = FAMOUS_MINDS_REGISTRY[id];
    const client = FAMOUS_MINDS_LIBRARY[id];
    if (!canonical || !client) { mismatches.push(`${id}: missing on one side`); return; }
    canonical.figures.forEach((cf, i) => {
      const clf = client.figures[i];
      if (!clf) { mismatches.push(`${id}.figures[${i}]: missing on client`); return; }
      ['name', 'qualifier', ...TEXT_FIELDS].forEach((field) => {
        if (clf[field] !== cf[field]) mismatches.push(`${id}.figures[${i}].${field}`);
      });
    });
  });
  ok('client FAMOUS_MINDS_LIBRARY is byte-identical to lib/famous-minds-registry.js for all 60 x 3 x 6 fields',
    mismatches.length === 0, mismatches.slice(0, 8));
}

// ---- 5. Rendered output: the FAMOUS TYPES block inside renderReport() ----
{
  const block = extractBetween(html, '// FAMOUS TYPES (B-1 wiring', '// ── PATTERNS ──');
  ok('extracted FAMOUS TYPES block still assigns famousEl.innerHTML', block.includes('famousEl.innerHTML'), block.slice(0, 80));

  function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderFamous(archetypeResult) {
    const fakeEl = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
    const fakeNav = { style: {} };
    const runSandbox = {
      document: {
        getElementById: (id) => (id === 'report-famous' ? fakeEl : null),
        querySelector: () => fakeNav,
      },
      FAMOUS_MINDS_LIBRARY, sanitizeHTML, archetypeResult, console,
    };
    vm.createContext(runSandbox);
    new vm.Script(block).runInContext(runSandbox);
    return fakeEl._html;
  }

  // 5a. Known variant (1A): all three figures with full field set.
  {
    const out = renderFamous({ primary: { id: '1A' } });
    const entry = FAMOUS_MINDS_LIBRARY['1A'];
    entry.figures.forEach((f) => {
      ok(`renders the name for ${f.name} (1A)`, out.includes(sanitizeHTML(f.name)));
      ok(`renders the match text for ${f.name} (1A)`, out.includes(sanitizeHTML(f.match)));
      ok(`renders the diverge text for ${f.name} (1A)`, out.includes(sanitizeHTML(f.diverge)));
      ok(`renders the startHere text for ${f.name} (1A)`, out.includes(sanitizeHTML(f.startHere)));
    });
    ok('renders the "Why this matches you" label', out.includes('Why this matches you'));
    ok('renders the "Where the match ends" label', out.includes('Where the match ends'));
    ok('renders the "Start here" label', out.includes('Start here'));
    ok('no undefined leaks into the rendered output', !out.includes('undefined'), out);
  }

  // 5b. A variant with a non-null qualifier renders the qualifier chip (12A: "Early period").
  {
    const out = renderFamous({ primary: { id: '12A' } });
    ok('renders the qualifier chip for a figure that has one (12A)', out.includes('Early period'));
    ok('no undefined leaks into the rendered output for 12A', !out.includes('undefined'), out);
  }

  // 5c. A second representative variant (7C) for breadth.
  {
    const out = renderFamous({ primary: { id: '7C' } });
    const entry = FAMOUS_MINDS_LIBRARY['7C'];
    ok('renders the role text for the first figure (7C)', out.includes(sanitizeHTML(entry.figures[0].role)));
    ok('no undefined leaks into the rendered output for 7C', !out.includes('undefined'), out);
  }

  // 5d. Unknown/missing variant id: must degrade gracefully, no crash, no leak.
  {
    let threw = false, out = '';
    try { out = renderFamous({ primary: { id: '99Z' } }); }
    catch (e) { threw = true; }
    ok('an unrecognized variant id does not throw', !threw);
    ok('an unrecognized variant id renders no famous-card and no undefined leak', !out.includes('famous-card') && !out.includes('undefined'), out);
  }

  // 5e. No archetypeResult at all (defensive: older call sites / edge case).
  {
    let threw = false, out = '';
    try { out = renderFamous(null); }
    catch (e) { threw = true; }
    ok('a missing archetypeResult does not throw', !threw);
    ok('a missing archetypeResult renders no famous-card and no undefined leak', !out.includes('famous-card') && !out.includes('undefined'), out);
  }
}

// ---- 6. Public share untouched: api/report.js has no Famous Minds surface ----
{
  const reportJs = fs.readFileSync(path.join(__dirname, 'api', 'report.js'), 'utf8');
  ok('api/report.js has no Famous Minds/thinkers rendering (nothing to keep in parity, correctly left untouched)',
    !/famous/i.test(reportJs) && !/thinkers/i.test(reportJs));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
