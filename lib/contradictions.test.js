// Dashboard build, Section 3.8: tests for lib/contradictions.js.
//
// Two jobs: (1) a VERBATIM parity guard proving this module's extracted
// copies of CONTRADICTIONS / contradictionStrength / detectContradictions
// are byte-identical to the live engine inside index.html - the DI-005
// make-drift-loud pattern, so a future edit to the client engine cannot
// silently diverge from what the dashboard computes against historical
// scores; (2) behavioral tests of the engine and of diffContradictions(),
// the resolved/new/persistent comparison the spec's cornerstone
// contradiction view requires.
//
// Run with:
//   node lib/contradictions.test.js

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const { CONTRADICTIONS, contradictionStrength, detectContradictions, diffContradictions } = require('./contradictions.js');

// ---- 1. Verbatim parity with the live index.html engine ----
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const moduleSrc = fs.readFileSync(path.join(__dirname, 'contradictions.js'), 'utf8');

  // Same column-0 anchored extraction the generator used: the array's true
  // closing `];` is the only newline-anchored one in its region; nested
  // brackets inside the hostile escaped-apostrophe prose never sit at
  // column 0. (The naive quote-skipping bracket counter used by other
  // harnesses fails on this array - documented in the module header.)
  function extractConst(source, name) {
    const sig = new RegExp(`const\\s+${name}\\s*=\\s*\\[`);
    const m = sig.exec(source);
    if (!m) throw new Error('const not found: ' + name);
    const closeRe = /\n\];/g;
    closeRe.lastIndex = m.index;
    const closeMatch = closeRe.exec(source);
    return source.slice(m.index, closeMatch.index + closeMatch[0].length);
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

  ok('CONTRADICTIONS array is byte-identical to index.html',
    moduleSrc.includes(extractConst(html, 'CONTRADICTIONS')));
  ok('contradictionStrength() is byte-identical to index.html',
    moduleSrc.includes(extractFunction(html, 'contradictionStrength')));
  ok('detectContradictions() is byte-identical to index.html',
    moduleSrc.includes(extractFunction(html, 'detectContradictions')));
}

// ---- 2. Engine shape and behavior ----
{
  ok('exactly 42 rules (the audited runtime count)', CONTRADICTIONS.length === 42, CONTRADICTIONS.length);
  const ids = CONTRADICTIONS.map(r => r.id);
  ok('rule ids are unique', new Set(ids).size === 42);
  ok('every rule has a valid tier', CONTRADICTIONS.every(r => ['A', 'B', 'C'].includes(r.tier)));
  ok('every rule has axis refs, a check function, title, and text',
    CONTRADICTIONS.every(r => r.a && r.b && typeof r.check === 'function' && r.title && r.text));

  const neutral = detectContradictions({});
  ok('an empty/neutral score set (missing axes default to 4) fires zero rules', neutral.length === 0, neutral.map(r => r.id));

  const hit = detectContradictions({ determinism: 6.0, justice: 1.5 });
  ok('the canonical C01 case (hard determinism + desert justice) fires', hit.some(r => r.id === 'C01'));
  ok('results are tier-ordered A before B before C', (() => {
    const order = { A: 0, B: 1, C: 2 };
    return hit.every((r, i) => i === 0 || order[hit[i - 1].tier] <= order[r.tier]);
  })());
  ok('every fired rule carries a strength in [0,1]', hit.every(r => r.strength >= 0 && r.strength <= 1));
}

// ---- 3. diffContradictions: resolved / new / persistent (Section 3.8b) ----
{
  const scoresA = { determinism: 6.0, justice: 1.5 };                    // fires C01 (+C07)
  const scoresB = { determinism: 6.0, justice: 1.5, naturalism: 6.0, physicalism: 1.5 }; // keeps C01/C07, adds C02
  const diff = diffContradictions(scoresA, scoresB);

  ok('a contradiction present in both attempts is persistent', diff.persistent.some(r => r.id === 'C01'));
  ok('a contradiction only in the newer attempt is new', diff.new.some(r => r.id === 'C02'));
  ok('nothing is wrongly reported resolved when nothing resolved', diff.resolved.length === 0, diff.resolved.map(r => r.id));

  const diffBack = diffContradictions(scoresB, scoresA);
  ok('the same comparison reversed reports C02 as resolved', diffBack.resolved.some(r => r.id === 'C02'));
  ok('reversed comparison still reports C01 persistent', diffBack.persistent.some(r => r.id === 'C01'));

  const noChange = diffContradictions(scoresA, scoresA);
  ok('identical scores yield no new and no resolved', noChange.new.length === 0 && noChange.resolved.length === 0);

  ok('tier tallies are provided per bucket', typeof diff.tierCounts.b.A === 'number' &&
    diff.tierCounts.b.A >= 1, diff.tierCounts);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
