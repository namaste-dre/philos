// C-4 enforcement wiring: behavioral lock for the client-side report
// validation (2026-08-02). Pins the embedded REPORT_OUTPUT_VALIDATION
// block (generated from lib/report-output-validation.js by
// scripts/embed-report-validation.js), the enforcement functions
// (enforceCall1Validation / enforceCall2Validation / summarizeValidation),
// and the two call sites in the generation flow.
//
// Covers: byte parity between the embedded block and the lib source under
// the embed script's exact transform (one rule set, never two), behavioral
// parity on representative fixtures, the enforcement policy (Call 1 errors
// throw into the existing retry-then-fail path, Call 1 warnings pass
// through untouched, Call 2 errors degrade to { world: [] }, Call 2
// warnings pass through), logging hygiene (structured codes/paths only -
// never issue detail, never raw prose), call sites running after
// validateReportPayload normalization, no validation state persisted into
// the report merge, and api/generate.js remaining zero-import.
//
// Run with:
//   node index.report-validation.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const libSource = fs.readFileSync(path.join(__dirname, 'lib', 'report-output-validation.js'), 'utf8');
const lib = require('./lib/report-output-validation.js');

function extractFunction(source, name) {
  const sigRe = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = sigRe.exec(source);
  if (!m) throw new Error('function not found: ' + name);
  let i = m.index + m[0].length;
  let depth = 1;
  while (depth > 0 && i < source.length) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(m.index, i);
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error('start marker not found: ' + startMarker);
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error('end marker not found: ' + endMarker);
  return source.slice(start + startMarker.length, end);
}

// ---- Fixtures ----
const P = 'You tend to read situations carefully and act once the shape of the problem is clear to you.';
const CLEAN_IDENTITY = Array(5).fill(P + ' ' + P).join('\n\n');
function cleanWorld() {
  const lensDefs = [
    ['The Self', 'mirror'], ['Other People', 'people'], ['Relationships', 'connect'],
    ['Society', 'city'], ['Life and Existence', 'horizon'],
  ];
  return {
    world: lensDefs.map(([lens, icon]) => ({
      lens, icon,
      view: P + ' ' + P,
      shows_up: P + ' ' + P,
      prompt: 'What would you try first if no one were watching you decide?',
    })),
  };
}

// ---- 1. Byte parity: embedded block == lib source under the embed transform ----
{
  const embedded = extractBetween(html,
    '// REPORT_OUTPUT_VALIDATION block (auto-generated from lib/report-output-validation.js, do not hand-edit)',
    '// END REPORT_OUTPUT_VALIDATION block');
  // The embed script's exact transform, replayed here: strip 'use strict';
  // and everything from module.exports onward.
  let expected = libSource.replace(/^'use strict';\r?\n/m, '');
  const exportsIdx = expected.indexOf('module.exports = {');
  expected = expected.slice(0, exportsIdx).trimEnd() + '\n';
  ok('embedded validation block is byte-identical to lib source under the embed transform',
    embedded.replace(/\r\n/g, '\n').trim() === expected.replace(/\r\n/g, '\n').trim(),
    { embeddedLen: embedded.trim().length, expectedLen: expected.trim().length });
}

// ---- Shared sandbox: embedded block + enforcement functions + fake console ----
function makeSandbox() {
  const logged = [];
  const sandbox = {
    console: {
      info: (...args) => logged.push(args.join(' ')),
      log: (...args) => logged.push(args.join(' ')),
      warn: (...args) => logged.push(args.join(' ')),
      error: (...args) => logged.push(args.join(' ')),
    },
  };
  vm.createContext(sandbox);
  const embedded = extractBetween(html,
    '// REPORT_OUTPUT_VALIDATION block (auto-generated from lib/report-output-validation.js, do not hand-edit)',
    '// END REPORT_OUTPUT_VALIDATION block');
  const code = embedded + '\n' +
    extractFunction(html, 'summarizeValidation') + '\n' +
    extractFunction(html, 'enforceCall1Validation') + '\n' +
    extractFunction(html, 'enforceCall2Validation') + '\n' +
    'this.validateCall1Output = validateCall1Output;' +
    'this.validateCall2Output = validateCall2Output;' +
    'this.enforceCall1Validation = enforceCall1Validation;' +
    'this.enforceCall2Validation = enforceCall2Validation;';
  new vm.Script(code).runInContext(sandbox);
  return { sandbox, logged };
}

// ---- 2. Behavioral parity: embedded validator matches lib on representative fixtures ----
{
  const { sandbox } = makeSandbox();
  const fixtures = [
    ['clean call1', 'validateCall1Output', { identity: CLEAN_IDENTITY }],
    ['error call1 (short + dash)', 'validateCall1Output', { identity: 'Too short — truncated.' }],
    ['warning call1 (3 paragraphs)', 'validateCall1Output', { identity: Array(3).fill(P + ' ' + P + ' ' + P).join('\n\n') }],
    ['hostile call1', 'validateCall1Output', null],
    ['clean call2', 'validateCall2Output', cleanWorld()],
    ['error call2 (4 lenses)', 'validateCall2Output', (() => { const w = cleanWorld(); w.world.pop(); return w; })()],
    ['warning call2 (swapped order)', 'validateCall2Output', (() => { const w = cleanWorld(); const t = w.world[0]; w.world[0] = w.world[1]; w.world[1] = t; return w; })()],
  ];
  const mismatches = [];
  fixtures.forEach(([label, fn, input]) => {
    const clientResult = JSON.stringify(sandbox[fn](input));
    const libResult = JSON.stringify(lib[fn](input));
    if (clientResult !== libResult) mismatches.push(label);
  });
  ok('embedded validator behavior matches lib/report-output-validation.js on all representative fixtures',
    mismatches.length === 0, mismatches);
}

// ---- 3. Enforcement policy: Call 1 ----
{
  const { sandbox } = makeSandbox();

  const cleanPayload = { identity: CLEAN_IDENTITY };
  let threw = false, returned = null;
  try { returned = sandbox.enforceCall1Validation(cleanPayload); } catch (e) { threw = true; }
  ok('Call 1 clean payload passes through enforcement unchanged', !threw && returned === cleanPayload);

  threw = false;
  try { sandbox.enforceCall1Validation({ identity: 'Truncated.' }); } catch (e) { threw = true; }
  ok('Call 1 validation errors throw (feeding the existing retry-then-fail path)', threw);

  const warningPayload = { identity: Array(3).fill(P + ' ' + P + ' ' + P).join('\n\n') };
  threw = false; returned = null;
  try { returned = sandbox.enforceCall1Validation(warningPayload); } catch (e) { threw = true; }
  ok('Call 1 warnings do not block: payload passes through unchanged', !threw && returned === warningPayload);
}

// ---- 4. Enforcement policy: Call 2 ----
{
  const { sandbox } = makeSandbox();

  const cleanPayload = cleanWorld();
  const r1 = sandbox.enforceCall2Validation(cleanPayload);
  ok('Call 2 clean payload passes through enforcement unchanged', r1 === cleanPayload);

  const errorPayload = cleanWorld(); errorPayload.world.pop();
  const r2 = sandbox.enforceCall2Validation(errorPayload);
  ok('Call 2 validation errors degrade to { world: [] } (existing nonfatal pattern, invalid prose never saved)',
    r2 !== errorPayload && Array.isArray(r2.world) && r2.world.length === 0, r2);

  const warningPayload = cleanWorld();
  const t = warningPayload.world[0]; warningPayload.world[0] = warningPayload.world[1]; warningPayload.world[1] = t;
  const r3 = sandbox.enforceCall2Validation(warningPayload);
  ok('Call 2 warnings do not block: payload passes through unchanged', r3 === warningPayload);

  let threw = false;
  try { sandbox.enforceCall2Validation(null); } catch (e) { threw = true; }
  ok('Call 2 enforcement never throws even on hostile input (degrades instead)', !threw);
}

// ---- 5. Logging hygiene: structured codes/paths only, never prose ----
{
  const { sandbox, logged } = makeSandbox();
  const SENTINEL = 'ZQXW_SENTINEL_PROSE_TOKEN';

  try { sandbox.enforceCall1Validation({ identity: 'Broken — short ' + SENTINEL }); } catch (e) { /* expected */ }
  const w = cleanWorld();
  w.world[2].view = 'Stub ' + SENTINEL;
  sandbox.enforceCall2Validation(w);

  ok('validation summaries are logged for both calls', logged.length >= 2, logged.length);
  ok('no raw generated prose appears in any log line', logged.every((l) => !l.includes(SENTINEL)), logged);
  const parsed = logged
    .filter((l) => l.startsWith('[report-validation]'))
    .map((l) => JSON.parse(l.replace('[report-validation] ', '')));
  ok('logged issues carry only code and path, never detail',
    parsed.every((p) => [...p.errors, ...p.warnings].every((i) =>
      Object.keys(i).sort().join(',') === 'code,path')), parsed);
  ok('logged summaries carry call number and ok flag',
    parsed.every((p) => (p.call === 1 || p.call === 2) && typeof p.ok === 'boolean'));
}

// ---- 6. Call sites: validation runs AFTER normalization, exactly once each ----
{
  ok('Call 1 site composes enforcement over validateReportPayload (after normalization)',
    html.includes('enforceCall1Validation(validateReportPayload(parsed))'));
  ok('Call 2 site composes enforcement over validateReportPayload (after normalization)',
    html.includes('enforceCall2Validation(validateReportPayload(parseAIJSON(clean2)))'));
  ok('enforceCall1Validation appears exactly twice (definition + one call site)',
    html.split('enforceCall1Validation').length - 1 === 2);
  ok('enforceCall2Validation appears exactly twice (definition + one call site)',
    html.split('enforceCall2Validation').length - 1 === 2);
}

// ---- 7. Nothing persisted: the report merge carries no validation state ----
{
  const mergeStart = html.indexOf('const report = {\n    ...report1,');
  ok('report merge block located', mergeStart !== -1);
  const mergeBlock = html.slice(mergeStart, html.indexOf('};', mergeStart) + 2);
  ok('report merge block contains no validation state (nothing added to report_json)',
    !/validation|enforceCall|summarize/i.test(mergeBlock), mergeBlock.slice(0, 200));
}

// ---- 8. api/generate.js remains zero-import ----
{
  const gen = fs.readFileSync(path.join(__dirname, 'api', 'generate.js'), 'utf8');
  ok('api/generate.js has no require() calls', !/\brequire\s*\(/.test(gen));
  ok('api/generate.js has no import statements', !/^\s*import\s/m.test(gen));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
