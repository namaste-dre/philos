// B9 slice 1: behavioral lock for the implemented fingerprint selection
// rule (2026-07-31).
//
// D-11 requires the CURRENT rule to be documented before Andre decides
// whether to keep it or switch to a documented hybrid - and any silent
// change would alter existing users' fingerprints. This suite pins the
// implemented behavior exactly, so a change can only happen loudly,
// through a failing test and a Decisions Log entry. Documentation lives
// in the vault: "Phil OS - B9 Fingerprint Selection Rule Documentation".
//
// The rule under lock (computeFingerprint in index.html, the single
// computation site - api/generate.js and api/report.js consume its
// output, never recompute):
//   1. deviation = |score - 4.0| per axis
//   2. adjustedDeviation = deviation * sqrt(itemCount / maxItemCount)
//      (currently ALWAYS 1x: every axis has exactly 5 items - kept for
//      the P21 daily-question roadmap where counts will vary)
//   3. sort by adjustedDeviation desc, ties broken alphabetically by
//      axis key (Decisions Log 2026-06-22)
//   4. top 5 returned; direction = 'right' iff score >= 4 (an exact 4.0
//      is 'right' with deviation 0 - only reachable in degenerate
//      all-middle profiles)
//
// Run with:
//   node index.fingerprint.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

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

const sandbox = {};
vm.createContext(sandbox);
new vm.Script(extractFunction(html, 'computeFingerprint') + '; this.computeFingerprint = computeFingerprint;').runInContext(sandbox);
const computeFingerprint = sandbox.computeFingerprint;

// A full 32-axis score object, everything at the exact middle.
const AXES = ['naturalism','physicalism','realism','determinism','moral_ground','meaning','teleology','human_nature','epistemic_method','social_ontology','temporal_orientation','moral_authority','epistemic_humility','knowledge','science','freewill_practice','justice','ethics','religion','politics','self','moral_scope','meaning_practice','society','responsibility','identity','authority','economics','uncertainty','mind_consciousness','animal_ethics','progress'];
function baseScores(fill = 4.0) {
  const s = {};
  for (const a of AXES) s[a] = fill;
  return s;
}

// ---- Selection by deviation ----
{
  const s = baseScores();
  s.naturalism = 7.0;      // dev 3.0
  s.religion = 1.2;        // dev 2.8
  s.ethics = 6.5;          // dev 2.5
  s.self = 1.9;            // dev 2.1
  s.progress = 5.9;        // dev 1.9
  s.justice = 5.5;         // dev 1.5 - should NOT make the cut
  const fp = computeFingerprint(s);
  ok('returns exactly 5 entries', fp.length === 5, fp.length);
  ok('selects the 5 largest deviations in order',
    fp.map(f => f.axis).join(',') === 'naturalism,religion,ethics,self,progress',
    fp.map(f => f.axis));
  ok('the 6th-largest deviation is excluded', !fp.some(f => f.axis === 'justice'));
}

// ---- Direction rule ----
{
  const s = baseScores();
  s.naturalism = 7.0;
  s.religion = 1.2;
  s.ethics = 6.5;
  s.self = 1.9;
  s.progress = 5.9;
  const fp = computeFingerprint(s);
  const dirs = Object.fromEntries(fp.map(f => [f.axis, f.direction]));
  ok('scores above 4 read direction right', dirs.naturalism === 'right' && dirs.ethics === 'right' && dirs.progress === 'right');
  ok('scores below 4 read direction left', dirs.religion === 'left' && dirs.self === 'left');
}
{
  // Degenerate all-middle profile: every deviation 0; documents (not
  // endorses) the implemented edge - exact 4.0 counts as 'right'.
  const fp = computeFingerprint(baseScores());
  ok('all-middle profile still returns 5 entries (alphabetical head)', fp.length === 5);
  ok('exact 4.0 direction is right (implemented edge, documented in the B9 note)',
    fp.every(f => f.direction === 'right'), fp.map(f => f.direction));
  ok('all-middle selection falls back to pure alphabetical order',
    fp.map(f => f.axis).join(',') === 'animal_ethics,authority,determinism,economics,epistemic_humility',
    fp.map(f => f.axis));
}

// ---- Deterministic alphabetical tiebreak ----
{
  const s = baseScores();
  // Six axes pinned to identical deviation 3.0 - only 5 can qualify.
  for (const a of ['society', 'meaning', 'authority', 'knowledge', 'ethics', 'identity']) s[a] = 7.0;
  const fp = computeFingerprint(s);
  ok('exact ties resolve alphabetically, cutoff included',
    fp.map(f => f.axis).join(',') === 'authority,ethics,identity,knowledge,meaning',
    fp.map(f => f.axis));
  ok('the alphabetically-last tied axis loses the cutoff seat', !fp.some(f => f.axis === 'society'));
}
{
  // Mirror-symmetric deviations tie too: 1.0 and 7.0 both deviate 3.0.
  const s = baseScores();
  s.progress = 1.0;
  s.naturalism = 7.0;
  const fp = computeFingerprint(s);
  ok('equal deviations on opposite sides tie and break alphabetically',
    fp[0].axis === 'naturalism' && fp[1].axis === 'progress', fp.map(f => f.axis));
}

// ---- Reliability multiplier is currently inert (all axes 5 items) ----
{
  const s = baseScores();
  s.naturalism = 6.0;
  const fp = computeFingerprint(s);
  const top = fp[0];
  ok('adjustedDeviation currently equals raw deviation (multiplier 1x, all axes 5 items)',
    Math.abs(top.adjustedDeviation - top.deviation) < 1e-12,
    { adjusted: top.adjustedDeviation, raw: top.deviation });
}

// ---- Output shape consumed downstream ----
{
  const s = baseScores();
  s.naturalism = 6.2;
  const f = computeFingerprint(s)[0];
  ok('entries carry axis, score, deviation, adjustedDeviation, direction',
    'axis' in f && 'score' in f && 'deviation' in f && 'adjustedDeviation' in f && 'direction' in f,
    Object.keys(f));
  ok('score passes through unrounded', f.score === 6.2, f.score);
}

// ---- The single-source claim itself ----
{
  const apiFiles = ['api/generate.js', 'api/report.js', 'api/capture.js', 'api/claim-attempt.js'];
  const recomputers = apiFiles.filter(p => {
    const src = fs.readFileSync(path.join(__dirname, p), 'utf8');
    return /computeFingerprint|adjustedDeviation/.test(src);
  });
  ok('no api file recomputes the fingerprint (client computeFingerprint is the single source)',
    recomputers.length === 0, recomputers);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
