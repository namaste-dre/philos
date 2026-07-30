// B1 tests for lib/report-schema-v3.js. Same no-dependency, plain-Node
// convention as the api/*.test.js and index.share-ui.test.js files - no
// jsdom, no test framework, run directly.
//
// Run with:
//   node lib/report-schema-v3.test.js

const { AXIS_IDS, validateReportV3, adaptR2ToV3, UNMAPPED_SECTIONS } = require('./report-schema-v3.js');

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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
