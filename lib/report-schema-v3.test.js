// B1 tests for lib/report-schema-v3.js. Same no-dependency, plain-Node
// convention as the api/*.test.js and index.share-ui.test.js files - no
// jsdom, no test framework, run directly.
//
// Run with:
//   node lib/report-schema-v3.test.js

const { AXIS_IDS, WORLD_LENSES, validateReportV3, adaptR2ToV3, UNMAPPED_SECTIONS } = require('./report-schema-v3.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function fullAxisScores(fillValue) {
  const out = {};
  for (const id of AXIS_IDS) out[id] = fillValue;
  return out;
}

function minimalValidReport() {
  return {
    completionId: 'c-1',
    instrumentVersion: 'v4',
    archetypeId: '1A',
    familyId: '1',
    axisScores: fullAxisScores(4),
    whoYouAre: { overview: 'You see causes where others see culprits.', evidenceAxisIds: ['naturalism'] },
    inTheWorld: {
      self: { view: 'v', showsUp: 's', prompt: 'p' },
      otherPeople: { view: 'v', showsUp: 's', prompt: 'p' },
      relationships: { view: 'v', showsUp: 's', prompt: 'p' },
      society: { view: 'v', showsUp: 's', prompt: 'p' },
      lifeAndExistence: { view: 'v', showsUp: 's', prompt: 'p' },
    },
    fingerprint: [{ axisId: 'naturalism', score: 7, whySelected: 'deviates furthest from centre' }],
    growthEdges: [{ title: 'Edge', text: 'Some growth text.' }],
    tensions: { formal: [] },
  };
}

// ---- 1. Accept: full valid v3 object ----
{
  const report = {
    ...minimalValidReport(),
    reportContentVersion: 'v3',
    promptVersion: 'p1',
    sigilId: 'sig-1',
    poles: {},
    archetypeSummary: 'summary',
    famousMinds: [{ figureId: 'f1', sharedDimensions: [], differences: [], confidence: 'high', reason: 'r' }],
    operating: { reasoning: 'r' },
    lifeAlignment: { work: 'w' },
    cultureMap: { film: [], music: [], book: [] },
    axisDetail: { naturalism: { band: 'strong-right' } },
    methodology: 'm',
    confidence: 'high',
    contentWarnings: [],
    fallbackState: { missingSections: [] },
  };
  const result = validateReportV3(report);
  ok('accepts a fully populated valid v3 object', result.valid === true, result.errors);
}

// ---- 2. Accept: minimal valid object, everything optional omitted ----
{
  const result = validateReportV3(minimalValidReport());
  ok('accepts a minimal valid object with only required fields', result.valid === true, result.errors);
}

// ---- 3. Reject: missing required fields ----
{
  const report = minimalValidReport();
  delete report.completionId;
  const result = validateReportV3(report);
  ok('rejects a report missing completionId', result.valid === false && result.errors.some(e => e.includes('completionId')), result.errors);
}
{
  const report = minimalValidReport();
  delete report.axisScores;
  const result = validateReportV3(report);
  ok('rejects a report missing axisScores', result.valid === false && result.errors.some(e => e.includes('axisScores')), result.errors);
}

// ---- 4. Reject: wrong shape ----
{
  const report = minimalValidReport();
  delete report.axisScores.progress; // drop one of the 32 required axes
  const result = validateReportV3(report);
  ok('rejects axisScores missing one of the 32 axes', result.valid === false && result.errors.some(e => e.includes('missing axes')), result.errors);
}
{
  const report = minimalValidReport();
  report.fingerprint = 'not-an-array';
  const result = validateReportV3(report);
  ok('rejects fingerprint that is not an array', result.valid === false && result.errors.some(e => e.includes('fingerprint must be an array')), result.errors);
}
{
  const report = minimalValidReport();
  report.inTheWorld.self = { view: 'v' }; // missing showsUp/prompt
  const result = validateReportV3(report);
  ok('rejects an inTheWorld lens missing required text fields', result.valid === false && result.errors.some(e => e.includes('inTheWorld.self')), result.errors);
}
{
  const report = minimalValidReport();
  report.tensions = {}; // missing formal[]
  const result = validateReportV3(report);
  ok('rejects tensions missing formal[]', result.valid === false && result.errors.some(e => e.includes('tensions.formal')), result.errors);
}

// ---- 5. Adapter -> validator round-trip on a realistic current-shaped input ----
const sampleScores = fullAxisScores(4);
sampleScores.naturalism = 7; sampleScores.determinism = 6; sampleScores.responsibility = 2;

const sampleFingerprint = [
  { axis: 'naturalism', score: 7 },
  { axis: 'determinism', score: 6 },
];

const sampleArchetypeResult = {
  primary: { arch: { id: '1A', family: 'The Determined Humanist', variant: 'The Activist', tagline: 'If circumstances make people, then changing circumstances is the work.' } },
};

const sampleContradictions = [{ id: 'c1', tier: 'A', strength: 0.8 }];

const sampleReport = {
  identity: 'You see causes where others see culprits.\n\nBecause behaviour flows from conditions, you put your energy into changing conditions.',
  alignment: [{ label: 'Work', text: 'Structural, mission-driven work fits best.' }],
  world: [
    { lens: 'The Self', icon: 'mirror', view: 'You see the self as shaped by conditions.', shows_up: 'You look for causes before blame.', prompt: 'What condition would you change first?' },
    { lens: 'Other People', icon: 'people', view: 'v', shows_up: 's', prompt: 'p' },
    { lens: 'Relationships', icon: 'connect', view: 'v', shows_up: 's', prompt: 'p' },
    { lens: 'Society', icon: 'city', view: 'v', shows_up: 's', prompt: 'p' },
    { lens: 'Life and Existence', icon: 'horizon', view: 'v', shows_up: 's', prompt: 'p' },
  ],
  patterns: [
    { type: 'positive', label: 'Core Superpower', text: 'Systems thinking as a moral superpower.' },
    { type: 'negative', label: 'Primary Failure Mode', text: 'Activist burnout without personal meaning scaffolding.' },
  ],
  growth: [{ title: 'Edge 1', text: 'Growth text.', practice: 'Practice text.', source: 'axis', axis: 'naturalism' }],
};

{
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, sampleReport);
  adapted.completionId = 'test-completion-id';
  adapted.instrumentVersion = 'v4';
  const result = validateReportV3(adapted);
  ok('adapter output (with caller-supplied completionId/instrumentVersion) passes validateReportV3', result.valid === true, result.errors);
}

// ---- 6. Fallback-list accuracy: every genuinely-unmapped section is disclosed, nothing fabricated ----
{
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, sampleReport);
  ok('famousMinds is empty, not fabricated', Array.isArray(adapted.famousMinds) && adapted.famousMinds.length === 0);
  ok('operating is null, not fabricated', adapted.operating === null);
  ok('lifeAlignment is null, not fabricated', adapted.lifeAlignment === null);
  ok('cultureMap is null, not fabricated', adapted.cultureMap === null);
  ok('tensions.worldview is empty, not fabricated', Array.isArray(adapted.tensions.worldview) && adapted.tensions.worldview.length === 0);
  ok('tensions.distinctive is empty, not fabricated', Array.isArray(adapted.tensions.distinctive) && adapted.tensions.distinctive.length === 0);
  ok('fallbackState.missingSections lists exactly the unmapped sections',
    JSON.stringify(adapted.fallbackState.missingSections) === JSON.stringify(UNMAPPED_SECTIONS),
    adapted.fallbackState.missingSections);
}

// ---- 7. Content-preservation: mapped text is carried byte-for-byte, never reworded ----
{
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, sampleReport);
  ok('identity text preserved byte-for-byte into whoYouAre.overview', adapted.whoYouAre.overview === sampleReport.identity);
  ok('all 5 world lenses preserved byte-for-byte', WORLD_LENSES_MATCH(adapted.inTheWorld, sampleReport.world));
  ok('growthEdges preserved byte-for-byte (same array reference content)', JSON.stringify(adapted.growthEdges) === JSON.stringify(sampleReport.growth));
  ok('tensions.formal preserved byte-for-byte from contradictions input', JSON.stringify(adapted.tensions.formal) === JSON.stringify(sampleContradictions));
}

function WORLD_LENSES_MATCH(inTheWorld, worldArr) {
  const map = { self: 'The Self', otherPeople: 'Other People', relationships: 'Relationships', society: 'Society', lifeAndExistence: 'Life and Existence' };
  return Object.keys(map).every(key => {
    const original = worldArr.find(w => w.lens === map[key]);
    const adapted = inTheWorld[key];
    return original && adapted.view === original.view && adapted.showsUp === original.shows_up && adapted.prompt === original.prompt;
  });
}

// ---- 8. archetypeId / familyId derivation ----
{
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, sampleReport);
  ok('archetypeId taken directly from the archetype registry entry, not invented', adapted.archetypeId === '1A');
  ok('familyId derived from the archetype id\'s own numeric family prefix', adapted.familyId === '1');
}

// ---- 9. Adapter never mutates its inputs ----
{
  const scoresCopy = { ...sampleScores };
  const reportCopy = JSON.parse(JSON.stringify(sampleReport));
  adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, sampleReport);
  ok('scores input object is not mutated', JSON.stringify(sampleScores) === JSON.stringify(scoresCopy));
  ok('report input object is not mutated', JSON.stringify(sampleReport) === JSON.stringify(reportCopy));
}

// ---- 10. Real shape-variant coverage ----
// These are not hypothetical edge cases - each one is a shape the live
// codebase itself already produces or has produced, confirmed by direct
// read of index.html/api/report.js before writing these tests, not
// assumed. Authorized as a dev/test-only sub-block: no Supabase read, no
// production data access, synthetic fixtures modeled on the confirmed
// real shapes only.

// 10a. growthEdges: legacy plain-string form. index.html's own renderer
// still branches on `typeof g === 'object'` vs. a plain-string fallback -
// confirmed live, not hypothetical - so older stored completions genuinely
// have report.growth as an array of strings, not {title,text,practice}.
{
  const legacyStringReport = { ...sampleReport, growth: ['Practice patience with ambiguity.', 'Notice when certainty substitutes for evidence.'] };
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, legacyStringReport);
  adapted.completionId = 'test-completion-id'; adapted.instrumentVersion = 'v4'; // caller-supplied fields the adapter intentionally leaves null
  const result = validateReportV3(adapted);
  ok('legacy plain-string growthEdges validate successfully (real historical shape, not fabricated as objects)', result.valid === true, result.errors);
  ok('legacy plain-string growthEdges are preserved byte-for-byte, not reworded into objects',
    JSON.stringify(adapted.growthEdges) === JSON.stringify(legacyStringReport.growth), adapted.growthEdges);
}

// 10b. growthEdges: mixed array (some legacy strings, some current objects) -
// plausible for a report generated mid-migration or hand-assembled from
// both selectGrowthEdges() sources over time.
{
  const mixedReport = { ...sampleReport, growth: ['A legacy string edge.', { title: 'Current Edge', text: 'Current edge text.', practice: 'Try this.' }] };
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, mixedReport);
  adapted.completionId = 'test-completion-id'; adapted.instrumentVersion = 'v4';
  const result = validateReportV3(adapted);
  ok('a mixed legacy-string/current-object growthEdges array validates successfully', result.valid === true, result.errors);
}

// 10c. growthEdges: an invalid item (empty string) is still correctly rejected -
// relaxing the schema to accept legacy strings must not accidentally accept
// genuinely malformed entries.
{
  const badReport = { ...sampleReport, growth: [''] };
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, badReport);
  const result = validateReportV3(adapted);
  ok('an empty-string growthEdges item is still rejected, not silently accepted as legacy form',
    result.valid === false && result.errors.some(e => e.includes('growthEdges[0]')), result.errors);
}

// 10d. identity: array-of-paragraphs form. api/report.js's own renderer
// explicitly branches on Array.isArray(identity) - confirmed live - and
// joins with a blank line before splitting back into paragraphs for
// display.
{
  const arrayIdentityReport = { ...sampleReport, identity: ['Paragraph one.', 'Paragraph two.', 'Paragraph three.'] };
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, arrayIdentityReport);
  adapted.completionId = 'test-completion-id'; adapted.instrumentVersion = 'v4';
  const result = validateReportV3(adapted);
  ok('array-of-paragraphs identity validates successfully (not left as a raw array)', result.valid === true, result.errors);
  ok('array-of-paragraphs identity is joined with the same separator the live renderer expects to split on',
    adapted.whoYouAre.overview === 'Paragraph one.\n\nParagraph two.\n\nParagraph three.', adapted.whoYouAre.overview);
}

// 10e. world: genuinely empty (the documented call-2-failure fallback,
// `world: report2.world || []`, "Call 2 failure is non-fatal - render with
// world section empty"). Must validate (empty lens content is real, not
// malformed) but must be honestly disclosed, not presented as complete.
{
  const emptyWorldReport = { ...sampleReport, world: [] };
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, emptyWorldReport);
  adapted.completionId = 'test-completion-id'; adapted.instrumentVersion = 'v4';
  const result = validateReportV3(adapted);
  ok('a report with an empty world array (call-2 failure) still validates - empty is real, not malformed', result.valid === true, result.errors);
  ok('all 5 inTheWorld lenses are present with empty string content, not omitted or fabricated',
    WORLD_LENSES.every(lens => adapted.inTheWorld[lens].view === '' && adapted.inTheWorld[lens].showsUp === '' && adapted.inTheWorld[lens].prompt === ''),
    adapted.inTheWorld);
  ok('fallbackState.missingSections discloses inTheWorld as missing when world was genuinely empty',
    adapted.fallbackState.missingSections.includes('inTheWorld'), adapted.fallbackState.missingSections);
}

// 10f. world: populated (the normal case) must NOT be flagged as missing -
// guards against the 10e fix over-triggering on real, complete data.
{
  const adapted = adaptR2ToV3(sampleScores, sampleFingerprint, sampleArchetypeResult, sampleContradictions, sampleReport);
  ok('a report with a populated world array does not disclose inTheWorld as missing',
    !adapted.fallbackState.missingSections.includes('inTheWorld'), adapted.fallbackState.missingSections);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
