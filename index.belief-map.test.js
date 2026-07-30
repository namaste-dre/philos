// FM7 first slice: automated belief-map QA harness (2026-07-31).
//
// Covers the automatable columns of the spec Section 20 audit matrix that
// exist in the product today: per-axis item counts, reverse-key scoring
// behavior, interpretation-band completeness, band-selection thresholds,
// and a permanent regression guard for FC1's semantic fixes (the removed
// meta-praise/jab phrasings can never silently return to any band text).
//
// Same no-dependency, brace-extraction convention as the other index.html
// suites - the real declarations are extracted from index.html and run in
// a vm sandbox, so these tests exercise the shipped code, not a copy.
//
// Run with:
//   node index.belief-map.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Extract `const NAME = [...]` or `const NAME = {...}` by bracket counting.
function extractConst(source, name, open, close) {
  const sig = new RegExp(`const\\s+${name}\\s*=\\s*\\${open}`);
  const m = sig.exec(source);
  if (!m) throw new Error('const not found: ' + name);
  let i = source.indexOf(open, m.index);
  let depth = 0;
  const start = m.index;
  while (i < source.length) {
    const ch = source[i];
    // crude but adequate string-skip: these blocks only use single quotes
    if (ch === "'") { i++; while (i < source.length && !(source[i] === "'" && source[i-1] !== '\\')) i++; }
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) break; }
    i++;
  }
  return source.slice(start, i + 1) + ';';
}

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

const questionsSrc = extractConst(html, 'QUESTIONS', '[', ']');
const axisMetaSrc = extractConst(html, 'AXIS_META', '{', '}');
const axisInsightSrc = extractConst(html, 'AXIS_INSIGHT', '{', '}');
const computeScoresSrc = extractFunction(html, 'computeScores');

const sandbox = { state: { answers: {} } };
vm.createContext(sandbox);
new vm.Script(questionsSrc + '\n' + axisMetaSrc + '\n' + axisInsightSrc + '\n' + computeScoresSrc +
  '\nthis.QUESTIONS = QUESTIONS; this.AXIS_META = AXIS_META; this.AXIS_INSIGHT = AXIS_INSIGHT; this.computeScores = computeScores;'
).runInContext(sandbox);
const { QUESTIONS, AXIS_META, AXIS_INSIGHT } = sandbox;

// ---- 1. Instrument structure: the audit-matrix "items verified" columns ----
{
  const axes = Object.keys(AXIS_META);
  ok('32 axes in AXIS_META', axes.length === 32, axes.length);
  ok('160 questions total', QUESTIONS.length === 160, QUESTIONS.length);

  const perAxis = {};
  QUESTIONS.forEach(q => { perAxis[q.axis] = (perAxis[q.axis] || 0) + 1; });
  const wrongCount = axes.filter(a => perAxis[a] !== 5);
  ok('every axis has exactly 5 items', wrongCount.length === 0, wrongCount.map(a => [a, perAxis[a]]));
  const orphanAxes = Object.keys(perAxis).filter(a => !AXIS_META[a]);
  ok('no question references an axis missing from AXIS_META', orphanAxes.length === 0, orphanAxes);

  const ids = QUESTIONS.map(q => q.id);
  ok('question ids are unique', new Set(ids).size === 160, 160 - new Set(ids).size);

  const reversed = QUESTIONS.filter(q => q.reversed);
  ok('exactly 36 reversed items', reversed.length === 36, reversed.length);
  const nonLikertReversed = reversed.filter(q => q.type && q.type !== 'likert');
  ok('every reversed item is Likert-type (audit rule: zero non-Likert exceptions)', nonLikertReversed.length === 0,
    nonLikertReversed.map(q => q.id));

  const missingMeta = axes.filter(a => !AXIS_META[a].label || !AXIS_META[a].poleL || !AXIS_META[a].poleR || !AXIS_META[a].tier);
  ok('every AXIS_META entry carries label, poleL, poleR, tier', missingMeta.length === 0, missingMeta);
}

// ---- 2. Reverse-key behavior: the audit-matrix "reverse-key verified" column ----
{
  const rev = QUESTIONS.find(q => q.reversed && (!q.type || q.type === 'likert'));
  const fwd = QUESTIONS.find(q => q.axis === rev.axis && !q.reversed);
  ok('found a reversed and a forward item on the same axis for the behavioral check', !!rev && !!fwd, { rev: rev && rev.id, fwd: fwd && fwd.id });

  // Answering the reversed item 7 must contribute as 1 (8-7); answering it 1 must contribute as 7.
  sandbox.state.answers = { [rev.id]: 7 };
  const s7 = sandbox.computeScores()[rev.axis];
  sandbox.state.answers = { [rev.id]: 1 };
  const s1 = sandbox.computeScores()[rev.axis];
  ok('reversed item answered 7 scores the axis at 1 (key flip works)', s7 === 1, s7);
  ok('reversed item answered 1 scores the axis at 7 (key flip works both directions)', s1 === 7, s1);

  // A forward item must pass through unflipped.
  sandbox.state.answers = { [fwd.id]: 7 };
  const f7 = sandbox.computeScores()[fwd.axis];
  ok('forward item answered 7 scores the axis at 7 (no spurious flip)', f7 === 7, f7);

  // Mixed: forward 7 + reversed 7 (which flips to 1) must weight-average, not simply average,
  // and land strictly between the two contributions.
  sandbox.state.answers = { [fwd.id]: 7, [rev.id]: 7 };
  const mixed = sandbox.computeScores()[rev.axis];
  ok('mixed forward/reversed answers weight-average between their keyed values', mixed > 1 && mixed < 7, mixed);

  sandbox.state.answers = {};
}

// ---- 3. Interpretation bands: completeness and hygiene ----
{
  const axes = Object.keys(AXIS_META);
  const missing = axes.filter(a => !AXIS_INSIGHT[a] || !AXIS_INSIGHT[a].L || !AXIS_INSIGHT[a].C || !AXIS_INSIGHT[a].R);
  ok('all 32 axes carry complete L/C/R interpretation bands', missing.length === 0, missing);

  const tooShort = [];
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const dashed = [];
  axes.forEach(a => {
    ['L','C','R'].forEach(b => {
      const t = (AXIS_INSIGHT[a] && AXIS_INSIGHT[a][b]) || '';
      if (t.length < 150) tooShort.push(a + '.' + b);
      if (t.includes(em) || t.includes(en)) dashed.push(a + '.' + b);
    });
  });
  ok('no band text is a stub (every text at least 150 chars)', tooShort.length === 0, tooShort);
  ok('no band text contains an em or en dash', dashed.length === 0, dashed);
}

// ---- 4. FC1 regression guard: the removed jab/meta-praise phrasings stay removed ----
// These exact phrases were removed by the FC1 semantic fixes (commit 8570147,
// findings from the 2026-07-12 independent review). If any of them reappears
// in ANY band text, this fails - making the FC1 closure permanent rather
// than one commit's state.
{
  const banned = [
    'pretending one frame covers everything',   // freewill_practice.C HIGH jab
    'most considered views',                    // animal_ethics.C
    'Honest historians',                        // progress.C
    'most working philosophers recommend',      // epistemic_humility.C
    'more accurate than either pure story',     // self.C
    'the honest order',                         // moral_ground.C
    'refusal to let comfort outvote honesty',   // meaning_practice.L jab
    'manufacturing enthusiasm',                 // meaning_practice.L jab
    'forced positivity and cheap consolation',  // meaning_practice.L jab
    'papering over it',                         // meaning_practice.L jab
  ];
  const found = [];
  Object.keys(AXIS_INSIGHT).forEach(a => {
    ['L','C','R'].forEach(b => {
      const t = AXIS_INSIGHT[a][b] || '';
      banned.forEach(p => { if (t.includes(p)) found.push(a + '.' + b + ': ' + p); });
    });
  });
  ok('FC1 regression guard: no banned jab/meta-praise phrase present in any band text', found.length === 0, found);
}

// ---- 5. Band-selection thresholds: the shipped renderer picks bands at <=3 / middle / >=5 ----
// Source-text assertion on the real render path (the threshold logic is inline
// in renderReport, not an extractable pure function).
{
  const sel = html.match(/const band = score <= 3 \? 'L' : score >= 5 \? 'R' : 'C';/);
  ok("renderer selects bands at score <= 3 -> L, >= 5 -> R, else C (documented thresholds)", !!sel);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
