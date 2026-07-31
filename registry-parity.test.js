// DI-005 first slice: client/server registry parity guard (2026-07-31).
//
// A0.1 deliberately duplicated read-only ID-to-label registries from
// index.html into api/generate.js (labels, poles, contradiction titles,
// archetype family/variant names) so the server could render prompt text
// from client-supplied ids without trusting client strings. DI-005 records
// the standing risk: future edits can leave the two copies mismatched, and
// nothing would fail - the server would silently render stale labels into
// prompts. This suite is the parity test named in DI-005's definition of
// done: it extracts BOTH copies from the real source files and asserts
// field-level equality, so any drift fails loudly with the exact ids named.
//
// This is the guard slice only - DI-005's full fix (a single canonical
// registry with deterministic generation) remains open in the backlog.
//
// Run with:
//   node registry-parity.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const gen = fs.readFileSync(path.join(__dirname, 'api', 'generate.js'), 'utf8');

function extractConst(source, name, open, close) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*\\' + open).exec(source);
  if (!m) throw new Error('const not found: ' + name);
  let i = source.indexOf(open, m.index), depth = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'") { i++; while (i < source.length && !(source[i] === "'" && source[i - 1] !== '\\')) i++; }
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) break; }
    i++;
  }
  return source.slice(m.index, i + 1) + ';';
}

const client = {};
vm.createContext(client);
new vm.Script(
  extractConst(html, 'AXIS_META', '{', '}') +
  extractConst(html, 'CONTRADICTIONS', '[', ']') +
  extractConst(html, 'ARCHETYPES', '[', ']') +
  'this.AXIS_META = AXIS_META; this.CONTRADICTIONS = CONTRADICTIONS; this.ARCHETYPES = ARCHETYPES;'
).runInContext(client);

const server = {};
vm.createContext(server);
new vm.Script(
  extractConst(gen, 'AXIS_LABELS', '{', '}') +
  extractConst(gen, 'AXIS_IDS', '[', ']') +
  extractConst(gen, 'CONTRADICTION_REGISTRY', '{', '}') +
  extractConst(gen, 'ARCHETYPE_REGISTRY', '{', '}') +
  'this.AXIS_LABELS = AXIS_LABELS; this.AXIS_IDS = AXIS_IDS; this.CONTRADICTION_REGISTRY = CONTRADICTION_REGISTRY; this.ARCHETYPE_REGISTRY = ARCHETYPE_REGISTRY;'
).runInContext(server);

// ---- 1. Axis registry parity ----
{
  const cAxes = Object.keys(client.AXIS_META);
  const sLabelAxes = Object.keys(server.AXIS_LABELS);
  ok('both sides carry 32 axes', cAxes.length === 32 && sLabelAxes.length === 32 && server.AXIS_IDS.length === 32,
    { client: cAxes.length, serverLabels: sLabelAxes.length, serverIds: server.AXIS_IDS.length });
  ok('axis id sets identical (AXIS_META vs AXIS_LABELS)',
    JSON.stringify([...cAxes].sort()) === JSON.stringify([...sLabelAxes].sort()),
    { onlyClient: cAxes.filter(a => !server.AXIS_LABELS[a]), onlyServer: sLabelAxes.filter(a => !client.AXIS_META[a]) });
  ok('axis id sets identical (AXIS_META vs AXIS_IDS)',
    JSON.stringify([...cAxes].sort()) === JSON.stringify([...server.AXIS_IDS].sort()));
  ok('AXIS_IDS contains no duplicates', new Set(server.AXIS_IDS).size === server.AXIS_IDS.length);

  const labelDrift = [], poleDrift = [];
  cAxes.forEach(a => {
    const c = client.AXIS_META[a], s = server.AXIS_LABELS[a];
    if (!s) return;
    if (c.label !== s.label) labelDrift.push(`${a}: client='${c.label}' server='${s.label}'`);
    if (c.poleL !== s.poleL) poleDrift.push(`${a}.poleL: client='${c.poleL}' server='${s.poleL}'`);
    if (c.poleR !== s.poleR) poleDrift.push(`${a}.poleR: client='${c.poleR}' server='${s.poleR}'`);
  });
  ok('every axis label matches field-for-field', labelDrift.length === 0, labelDrift);
  ok('every pole name matches field-for-field (prompt text depends on these)', poleDrift.length === 0, poleDrift);
}

// ---- 2. Contradiction registry parity ----
{
  const cRules = client.CONTRADICTIONS;
  const sIds = Object.keys(server.CONTRADICTION_REGISTRY);
  ok('both sides carry 42 contradiction rules', cRules.length === 42 && sIds.length === 42,
    { client: cRules.length, server: sIds.length });
  const cIds = cRules.map(r => r.id);
  ok('rule id sets identical', JSON.stringify([...cIds].sort()) === JSON.stringify([...sIds].sort()),
    { onlyClient: cIds.filter(id => !server.CONTRADICTION_REGISTRY[id]), onlyServer: sIds.filter(id => !cIds.includes(id)) });

  const titleDrift = [], tierDrift = [];
  cRules.forEach(r => {
    const s = server.CONTRADICTION_REGISTRY[r.id];
    if (!s) return;
    if (r.title !== s.title) titleDrift.push(`${r.id}: client='${r.title}' server='${s.title}'`);
    if (r.tier !== s.tier) tierDrift.push(`${r.id}: client='${r.tier}' server='${s.tier}'`);
  });
  ok('every rule title matches', titleDrift.length === 0, titleDrift);
  ok('every rule tier matches', tierDrift.length === 0, tierDrift);
}

// ---- 3. Archetype registry parity ----
{
  const cArch = client.ARCHETYPES;
  const sCodes = Object.keys(server.ARCHETYPE_REGISTRY);
  ok('both sides carry 60 archetypes', cArch.length === 60 && sCodes.length === 60,
    { client: cArch.length, server: sCodes.length });
  const cCodes = cArch.map(a => a.id);
  ok('archetype code sets identical', JSON.stringify([...cCodes].sort()) === JSON.stringify([...sCodes].sort()),
    { onlyClient: cCodes.filter(c => !server.ARCHETYPE_REGISTRY[c]), onlyServer: sCodes.filter(c => !cCodes.includes(c)) });

  const famDrift = [], varDrift = [];
  cArch.forEach(a => {
    const s = server.ARCHETYPE_REGISTRY[a.id];
    if (!s) return;
    if (a.family !== s.family) famDrift.push(`${a.id}: client='${a.family}' server='${s.family}'`);
    if (a.variant !== s.variant) varDrift.push(`${a.id}: client='${a.variant}' server='${s.variant}'`);
  });
  ok('every archetype family matches', famDrift.length === 0, famDrift);
  ok('every archetype variant matches', varDrift.length === 0, varDrift);
}

// ---- 4. AXIS_REFERENCE prompt block covers the axis set exactly ----
// The prompt's human-readable axis reference is a third copy of the axis
// list; a missing or extra line there degrades generation quality silently.
{
  const refMatch = /const AXIS_REFERENCE = `([\s\S]*?)`;/.exec(gen);
  ok('AXIS_REFERENCE block found in api/generate.js', !!refMatch);
  if (refMatch) {
    const refIds = [...refMatch[1].matchAll(/^- (\w+) /gm)].map(m => m[1]);
    ok('AXIS_REFERENCE lists exactly 32 axes', refIds.length === 32, refIds.length);
    ok('AXIS_REFERENCE ids contain no duplicates', new Set(refIds).size === refIds.length);
    const cAxes = new Set(Object.keys(client.AXIS_META));
    const unknown = refIds.filter(id => !cAxes.has(id));
    const missing = [...cAxes].filter(id => !refIds.includes(id));
    ok('AXIS_REFERENCE ids all exist in AXIS_META', unknown.length === 0, unknown);
    ok('no AXIS_META axis is missing from AXIS_REFERENCE', missing.length === 0, missing);
  }
}

// ---- 5. Share-page scoresMap key parity (labels deliberately differ) ----
// api/report.js's scoresMap is a third copy of the axis list carrying
// plain-language display variants for the public share page - label
// divergence there is a deliberate design (confirmed 2026-07-31), so only
// KEY parity is asserted: every axis exists on both sides, none invented.
{
  const rep = fs.readFileSync(path.join(__dirname, 'api', 'report.js'), 'utf8');
  const sm = /const scoresMap = \[([\s\S]*?)\n  \];/.exec(rep);
  ok('scoresMap block found in api/report.js', !!sm);
  if (sm) {
    const keys = [...sm[1].matchAll(/key:'(\w+)'/g)].map(x => x[1]);
    ok('scoresMap lists exactly 32 axes', keys.length === 32, keys.length);
    ok('scoresMap keys contain no duplicates', new Set(keys).size === keys.length);
    const cAxes = new Set(Object.keys(client.AXIS_META));
    const unknown = keys.filter(k => !cAxes.has(k));
    const missing = [...cAxes].filter(k => !keys.includes(k));
    ok('every scoresMap key exists in AXIS_META', unknown.length === 0, unknown);
    ok('no AXIS_META axis is missing from scoresMap', missing.length === 0, missing);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
