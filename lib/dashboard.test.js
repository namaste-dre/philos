// Dashboard build, first slice: tests for lib/dashboard.js's pure
// computation functions. No database, no network - synthetic completion
// data throughout, same convention as lib/report-schema-v3.test.js.
//
// Run with:
//   node lib/dashboard.test.js

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const {
  computeConvictionStrength,
  computeOverview,
  formatElapsed,
  computeAxisTrends,
  computeStabilityFlux,
  detectPoleCrossings,
  computeOverallChange,
  compareCompletions,
} = require('./dashboard.js');

function scoresAt(fill, overrides = {}) {
  const axes = ['naturalism', 'physicalism', 'realism', 'determinism', 'moral_ground', 'meaning', 'teleology',
    'human_nature', 'epistemic_method', 'social_ontology', 'temporal_orientation', 'moral_authority',
    'epistemic_humility', 'knowledge', 'science', 'freewill_practice', 'justice', 'ethics', 'religion',
    'politics', 'self', 'moral_scope', 'meaning_practice', 'society', 'responsibility', 'identity',
    'authority', 'economics', 'uncertainty', 'mind_consciousness', 'animal_ethics', 'progress'];
  const s = {};
  for (const a of axes) s[a] = fill;
  return { ...s, ...overrides };
}

// ---- computeConvictionStrength ----
{
  ok('all-neutral scores give 0% conviction strength', computeConvictionStrength(scoresAt(4.0)) === 0);
  ok('all-extreme scores (7.0) give 100% conviction strength', computeConvictionStrength(scoresAt(7.0)) === 100);
  ok('all-extreme scores (1.0) give 100% conviction strength too (deviation is absolute)', computeConvictionStrength(scoresAt(1.0)) === 100);
  ok('a half-deviated axis set gives 50%', computeConvictionStrength(scoresAt(5.5)) === 50, computeConvictionStrength(scoresAt(5.5)));
  ok('empty scores object returns 0, not NaN', computeConvictionStrength({}) === 0);
}

// ---- computeOverview ----
{
  ok('null on empty completions array', computeOverview([]) === null);

  const single = [{ completed_at: '2026-01-01T00:00:00Z', scores: scoresAt(4.0), archetype_family: 'F1', archetype_variant: 'V1', contradictions_count: 2 }];
  const ov1 = computeOverview(single);
  ok('first-ever completion has no topMovedAxes (nothing to compare against)', Array.isArray(ov1.topMovedAxes) && ov1.topMovedAxes.length === 0);
  ok('totalCompletions reflects the array length', ov1.totalCompletions === 1);
  ok('epistemicHumility is pulled from the latest scores', ov1.epistemicHumility === 4.0);

  const two = [
    { completed_at: '2026-01-01T00:00:00Z', scores: scoresAt(4.0), archetype_family: 'F1', archetype_variant: 'V1', contradictions_count: 2 },
    { completed_at: '2026-06-01T00:00:00Z', scores: scoresAt(4.0, { naturalism: 7.0, religion: 1.0 }), archetype_family: 'F2', archetype_variant: 'V2', contradictions_count: 1 },
  ];
  const ov2 = computeOverview(two);
  ok('second completion surfaces the biggest movers, capped at 3', ov2.topMovedAxes.length <= 3 && ov2.topMovedAxes[0].delta >= ov2.topMovedAxes[ov2.topMovedAxes.length - 1].delta);
  ok('naturalism (delta 3) correctly outranks a zero-delta axis', ov2.topMovedAxes.some(m => m.axisId === 'naturalism'));
  ok('archetype reflects the LATEST completion, not the first', ov2.archetypeFamily === 'F2');
}

// ---- formatElapsed ----
{
  ok('same-day elapsed reads "today"', formatElapsed('2026-07-31T08:00:00Z', '2026-07-31T20:00:00Z') === 'today');
  ok('exactly one day reads singular', formatElapsed('2026-07-30T08:00:00Z', '2026-07-31T09:00:00Z') === '1 day');
  ok('several days reads plural with count', formatElapsed('2026-07-25T00:00:00Z', '2026-07-31T00:00:00Z') === '6 days');
  ok('one month (30+ days) reads singular month', formatElapsed('2026-06-01T00:00:00Z', '2026-07-05T00:00:00Z') === '1 month');
  ok('several months reads plural', formatElapsed('2026-03-01T00:00:00Z', '2026-07-31T00:00:00Z') === '5 months');
  ok('exactly one year reads singular year, no month remainder', formatElapsed('2025-07-31T00:00:00Z', '2026-07-31T00:00:00Z') === '1 year');
  ok('a year and change reads combined form', formatElapsed('2025-01-01T00:00:00Z', '2026-07-31T00:00:00Z') === '1 year, 7 months');
  ok('a future "from" timestamp (negative elapsed) returns unknown rather than a nonsense negative', formatElapsed('2026-08-01T00:00:00Z', '2026-07-31T00:00:00Z') === 'unknown');
}

// ---- computeAxisTrends ----
{
  const completions = [
    { completed_at: '2026-01-01T00:00:00Z', scores: { naturalism: 3.0, religion: 5.0 } },
    { completed_at: '2026-06-01T00:00:00Z', scores: { naturalism: 5.0, religion: 4.0 } },
  ];
  const trendsAll = computeAxisTrends(completions);
  ok('with no axis filter, every axis present in the data gets a series', 'naturalism' in trendsAll && 'religion' in trendsAll);
  ok('each series has one point per completion, in order', trendsAll.naturalism.length === 2 &&
    trendsAll.naturalism[0].score === 3.0 && trendsAll.naturalism[1].score === 5.0);

  const trendsFiltered = computeAxisTrends(completions, ['naturalism']);
  ok('an axis filter restricts the returned series to only the requested axes', Object.keys(trendsFiltered).length === 1 && 'naturalism' in trendsFiltered);

  const singlePoint = computeAxisTrends([completions[0]], ['naturalism']);
  ok('a single completion yields a single-point series (caller decides no-line rendering)', singlePoint.naturalism.length === 1);
}

// ---- computeStabilityFlux ----
{
  ok('fewer than 2 completions is flagged insufficient, not silently zero', computeStabilityFlux([{ scores: scoresAt(4.0) }]).insufficientData === true);

  // Every axis holds constant at 4.0 except naturalism, which alone
  // oscillates - so both religion's zero variance and naturalism's
  // nonzero variance are genuine outliers, not ties against 30 other
  // identically-behaving axes (which would make either ranking
  // meaningless to test against).
  const completions = [
    { scores: scoresAt(4.0, { naturalism: 2.0 }) },
    { scores: scoresAt(4.0, { naturalism: 6.0 }) },
    { scores: scoresAt(4.0, { naturalism: 4.0 }) },
  ];
  const flux = computeStabilityFlux(completions);
  // 31 of 32 axes tie at variance 0 here (only naturalism differs), so
  // checking one specific tied axis's list membership would depend on
  // alphabetical tiebreak luck, not the logic under test. Assert the real
  // invariants instead: every "most stable" entry genuinely has variance
  // 0, naturalism (the true outlier) is excluded from that list, and
  // naturalism uniquely tops "most volatile."
  ok('every "most stable" entry has genuinely zero variance', flux.mostStable.every(f => f.variance === 0));
  ok('the sole oscillating axis (naturalism) is excluded from "most stable"', !flux.mostStable.some(f => f.axisId === 'naturalism'));
  ok('the sole oscillating axis (naturalism, 2/6/4) ranks as the single most volatile', flux.mostVolatile[0].axisId === 'naturalism' && flux.mostVolatile[0].variance > 0);
  ok('mostStable is sorted ascending by variance', flux.mostStable.every((f, i) => i === 0 || flux.mostStable[i - 1].variance <= f.variance));
  ok('mostVolatile is sorted descending by variance', flux.mostVolatile.every((f, i) => i === 0 || flux.mostVolatile[i - 1].variance >= f.variance));
}

// ---- detectPoleCrossings ----
{
  const completions = [
    { completed_at: 'T1', scores: { freewill_practice: 2.0, religion: 4.0, self: 3.0 } },
    { completed_at: 'T2', scores: { freewill_practice: 6.0, religion: 5.0, self: 3.5 } }, // freewill crosses left->right; religion goes null->right (no crossing, was exactly neutral); self stays left, no crossing
  ];
  const crossings = detectPoleCrossings(completions);
  ok('a genuine left-to-right crossing is detected', crossings.some(c => c.axisId === 'freewill_practice' && c.fromSide === 'left' && c.toSide === 'right'));
  ok('starting exactly at the neutral midpoint does not count as a crossing (no prior side to leave)', !crossings.some(c => c.axisId === 'religion'));
  ok('staying on the same side, even with movement, is not a crossing', !crossings.some(c => c.axisId === 'self'));
  ok('exactly one real crossing found in this fixture', crossings.length === 1);
}
{
  // Landing exactly on 4.0 (not starting there) also does not count as a crossing.
  const completions = [
    { completed_at: 'T1', scores: { justice: 2.0 } },
    { completed_at: 'T2', scores: { justice: 4.0 } },
  ];
  ok('landing exactly on the midpoint is not counted as crossing to a side', detectPoleCrossings(completions).length === 0);
}

// ---- computeOverallChange ----
{
  const a = { scores: { naturalism: 2.0, religion: 6.0, self: 4.0 } };
  const b = { scores: { naturalism: 4.0, religion: 6.0, self: 4.0 } };
  ok('overall change is the mean absolute per-axis delta, rounded to 3 decimals', computeOverallChange(a, b) === 0.667, computeOverallChange(a, b));
  ok('identical completions have zero overall change', computeOverallChange(a, a) === 0);
  ok('no shared axes returns null rather than a misleading 0', computeOverallChange({ scores: { x: 1 } }, { scores: { y: 1 } }) === null);
}

// ---- compareCompletions ----
{
  const a = { archetype_family: 'F1', archetype_variant: 'V1', contradictions_count: 3, scores: { naturalism: 2.0, religion: 6.0 } };
  const b = { archetype_family: 'F2', archetype_variant: 'V2', contradictions_count: 1, scores: { naturalism: 6.0, religion: 6.0 } };
  const cmp = compareCompletions(a, b);
  ok('detects an archetype change', cmp.archetypeChanged === true);
  ok('reports the from/to archetype correctly', cmp.archetypeFrom.family === 'F1' && cmp.archetypeTo.family === 'F2');
  ok('biggest-moving axis is naturalism (delta 4)', cmp.biggestMovingAxes[0].axisId === 'naturalism');
  ok('contradiction delta is negative when tensions decreased', cmp.contradictionsDelta === -2);
  ok('overall change matches computeOverallChange directly', cmp.overallChange === computeOverallChange(a, b));
}
{
  const a = { archetype_family: 'F1', archetype_variant: 'V1', contradictions_count: 1, scores: { naturalism: 4.0 } };
  const same = compareCompletions(a, a);
  ok('comparing a completion to itself shows no archetype change and zero deltas', same.archetypeChanged === false && same.overallChange === 0 && same.contradictionsDelta === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
