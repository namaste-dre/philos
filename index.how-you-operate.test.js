// B-3 wiring block: behavioral lock for the How You Operate rendering
// (2026-08-02). Pins the client-side implementation of the four-part
// (pattern / where it shows up / cost / lever) expansion - the
// HOW_YOU_OPERATE_LIBRARY const and the PATTERNS rendering block inside
// renderReport(), both defined in index.html - so any future change can
// only happen loudly.
//
// Covers: coverage against the product's live ARCHETYPES (all 60 variants,
// no extras, no gaps), field completeness, content hygiene, byte-identical
// parity against lib/how-you-operate-registry.js, and the rendered card
// output (expansion present for a known variant, gracefully absent for an
// unknown one, no undefined leaks, the pre-existing one-liner rendering
// untouched).
//
// Run with:
//   node index.how-you-operate.test.js

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
  extractConst(html, 'HOW_YOU_OPERATE_LIBRARY', '{', '}') + '\n' +
  'this.ARCHETYPES = ARCHETYPES; this.HOW_YOU_OPERATE_LIBRARY = HOW_YOU_OPERATE_LIBRARY;'
).runInContext(sandbox);
const { ARCHETYPES, HOW_YOU_OPERATE_LIBRARY } = sandbox;
const liveIds = ARCHETYPES.map((a) => a.id);
const EXPANSION_FIELDS = ['title', 'pattern', 'whereItShowsUp', 'cost', 'lever'];

// ---- 1. Coverage against live ARCHETYPES ----
{
  const libIds = Object.keys(HOW_YOU_OPERATE_LIBRARY);
  ok('HOW_YOU_OPERATE_LIBRARY holds exactly 60 variant entries', libIds.length === 60, libIds.length);
  const missing = liveIds.filter((id) => !libIds.includes(id));
  const extra = libIds.filter((id) => !liveIds.includes(id));
  ok('every live ARCHETYPES variant id is covered', missing.length === 0, missing);
  ok('no variant ids beyond the live ARCHETYPES set', extra.length === 0, extra);
}

// ---- 2. Field completeness ----
{
  const shapeErrors = [];
  liveIds.forEach((id) => {
    const e = HOW_YOU_OPERATE_LIBRARY[id];
    if (!e) { shapeErrors.push(`${id}: missing entry`); return; }
    ['strength', 'failureMode'].forEach((kind) => {
      const exp = e[kind];
      if (!exp) { shapeErrors.push(`${id}.${kind}: missing`); return; }
      EXPANSION_FIELDS.forEach((f) => {
        const minLen = f === 'title' ? 3 : 10;
        if (typeof exp[f] !== 'string' || exp[f].trim().length < minLen) {
          shapeErrors.push(`${id}.${kind}.${f}: missing or under ${minLen} chars`);
        }
      });
    });
  });
  ok('every variant has a complete strength and failureMode expansion (all 5 fields each)',
    shapeErrors.length === 0, shapeErrors.slice(0, 8));
}

// ---- 3. Content hygiene on the client-embedded subset ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;
  const dashed = [], placeholders = [];
  liveIds.forEach((id) => {
    const e = HOW_YOU_OPERATE_LIBRARY[id];
    ['strength', 'failureMode'].forEach((kind) => {
      EXPANSION_FIELDS.forEach((f) => {
        const v = e[kind][f];
        if (v.includes(em) || v.includes(en)) dashed.push(`${id}.${kind}.${f}`);
        if (PLACEHOLDER_RE.test(v)) placeholders.push(`${id}.${kind}.${f}`);
      });
    });
  });
  ok('no em/en dashes in the client-embedded HOW_YOU_OPERATE_LIBRARY subset', dashed.length === 0, dashed.slice(0, 8));
  ok('no placeholder/stub text in the client-embedded subset', placeholders.length === 0, placeholders.slice(0, 8));
}

// ---- 4. Cross-file parity: client subset must be byte-identical to ----
// lib/how-you-operate-registry.js's already vault-parity-tested content.
{
  const { HOW_YOU_OPERATE_REGISTRY } = require('./lib/how-you-operate-registry.js');
  const mismatches = [];
  liveIds.forEach((id) => {
    const canonical = HOW_YOU_OPERATE_REGISTRY[id];
    const client = HOW_YOU_OPERATE_LIBRARY[id];
    ['strength', 'failureMode'].forEach((kind) => {
      EXPANSION_FIELDS.forEach((f) => {
        if (!canonical || !client || client[kind][f] !== canonical[kind][f]) {
          mismatches.push(`${id}.${kind}.${f}`);
        }
      });
    });
  });
  ok('client HOW_YOU_OPERATE_LIBRARY is byte-identical to lib/how-you-operate-registry.js for all 60 x 2 x 5 = 600 fields',
    mismatches.length === 0, mismatches.slice(0, 8));
}

// ---- 5. Rendered output: the PATTERNS block inside renderReport() ----
// Extracted by source markers (not a standalone function, so brace-count
// extraction doesn't apply) and run against a minimal fake DOM/report.
{
  const block = extractBetween(html, '// ── PATTERNS ──', '// A6: surface the detected philosophical');
  ok('extracted PATTERNS block still assigns patternsEl.innerHTML via report.patterns.map',
    block.includes('report.patterns.map'), block.slice(0, 80));

  function sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderPatterns(report, archetypeResult) {
    const fakeEl = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
    const fakeNav = { style: {} };
    const runSandbox = {
      document: {
        getElementById: (id) => (id === 'report-patterns' ? fakeEl : null),
        querySelector: () => fakeNav,
      },
      HOW_YOU_OPERATE_LIBRARY,
      sanitizeHTML,
      report,
      archetypeResult,
      console,
    };
    vm.createContext(runSandbox);
    new vm.Script(block).runInContext(runSandbox);
    return fakeEl._html;
  }

  const REPORT_PATTERNS = [
    { type: 'positive', label: 'Core Superpower', text: 'Systems thinking as a moral superpower.' },
    { type: 'negative', label: 'Primary Failure Mode', text: 'Activist burnout without personal meaning scaffolding.' },
  ];

  // 5a. Known variant (1A): expansion content must be present.
  {
    const out = renderPatterns({ patterns: REPORT_PATTERNS }, { primary: { id: '1A' } });
    ok('renders both existing one-liners unchanged', out.includes('Systems thinking as a moral superpower.') && out.includes('Activist burnout without personal meaning scaffolding.'));
    ok('renders the strength expansion "where it shows up" text for 1A', out.includes(sanitizeHTML(HOW_YOU_OPERATE_LIBRARY['1A'].strength.whereItShowsUp)));
    ok('renders the strength expansion "cost" text for 1A', out.includes(sanitizeHTML(HOW_YOU_OPERATE_LIBRARY['1A'].strength.cost)));
    ok('renders the strength expansion "lever" text for 1A', out.includes(sanitizeHTML(HOW_YOU_OPERATE_LIBRARY['1A'].strength.lever)));
    ok('renders the failureMode expansion "lever" text for 1A', out.includes(sanitizeHTML(HOW_YOU_OPERATE_LIBRARY['1A'].failureMode.lever)));
    ok('no undefined leaks into the rendered output', !out.includes('undefined'), out);
  }

  // 5b. A second representative variant (7C, a different family) for breadth.
  {
    const out = renderPatterns({ patterns: REPORT_PATTERNS }, { primary: { id: '7C' } });
    ok('renders the strength expansion "pattern" text for 7C', out.includes(sanitizeHTML(HOW_YOU_OPERATE_LIBRARY['7C'].strength.pattern)));
    ok('no undefined leaks into the rendered output for 7C', !out.includes('undefined'), out);
  }

  // 5c. Unknown/missing variant id: must degrade gracefully, no crash, no leak.
  {
    let threw = false, out = '';
    try { out = renderPatterns({ patterns: REPORT_PATTERNS }, { primary: { id: '99Z' } }); }
    catch (e) { threw = true; }
    ok('an unrecognized variant id does not throw', !threw);
    ok('an unrecognized variant id still renders the existing one-liners', out.includes('Systems thinking as a moral superpower.'));
    ok('an unrecognized variant id renders no expansion block and no undefined leak', !out.includes('pattern-expansion') && !out.includes('undefined'), out);
  }

  // 5d. No archetypeResult at all (defensive: older call sites / edge case).
  {
    let threw = false, out = '';
    try { out = renderPatterns({ patterns: REPORT_PATTERNS }, null); }
    catch (e) { threw = true; }
    ok('a missing archetypeResult does not throw', !threw);
    ok('a missing archetypeResult still renders the existing one-liners with no undefined leak',
      out.includes('Systems thinking as a moral superpower.') && !out.includes('undefined'), out);
  }
}

// ---- 6. Generation-time schema untouched: report.patterns is still built ----
// exactly as before (label/type/text only) - the expansion is looked up at
// render time, never written into the stored report object, so historical
// saved/shared reports and the public share page (which reads report.patterns
// unchanged) are unaffected by this block.
{
  ok('report.patterns generation still uses the original two-entry label/type/text shape (no schema change)',
    html.includes("{type:'positive', label:'Core Superpower', text: arch.strength}") &&
    html.includes("{type:'negative', label:'Primary Failure Mode', text: arch.failureMode}"));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
