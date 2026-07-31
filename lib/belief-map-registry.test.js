// B2 slice 1 tests: belief-map content registry (2026-07-31).
//
// Validates the six signed-off axes (D148) in lib/belief-map-registry.js:
// schema completeness through the module's own validator, threshold
// contiguity, cross-checks against the product's real AXIS_META (ids and
// tier notes must refer to axes that actually exist), content hygiene,
// and the same banned-phrase guard the 3-band library carries. Also
// negative-tests the validator so a schema hole cannot pass silently.
//
// Run with:
//   node lib/belief-map-registry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const reg = require('./belief-map-registry.js');
const {
  BELIEF_MAP_REGISTRY, validateRegistryEntry, BAND_THRESHOLDS, BAND_KEYS,
  MIDPOINT_VARIANT_KEYS, REGISTRY_SCHEMA_VERSION,
} = reg;

// ---- 1. Registry shape and validator agreement ----
{
  ok('schema version is 1', REGISTRY_SCHEMA_VERSION === 1, REGISTRY_SCHEMA_VERSION);
  const ids = Object.keys(BELIEF_MAP_REGISTRY);
  ok('registry holds exactly the six signed-off axes', JSON.stringify([...ids].sort()) === JSON.stringify(
    ['animal_ethics', 'epistemic_humility', 'freewill_practice', 'meaning_practice', 'naturalism', 'religion']), ids);

  const invalid = ids.filter(id => !validateRegistryEntry(BELIEF_MAP_REGISTRY[id]).valid);
  ok('every entry passes the schema validator', invalid.length === 0,
    invalid.map(id => ({ id, errors: validateRegistryEntry(BELIEF_MAP_REGISTRY[id]).errors })));

  const keyMismatch = ids.filter(id => BELIEF_MAP_REGISTRY[id].axisId !== id);
  ok('every entry axisId matches its registry key', keyMismatch.length === 0, keyMismatch);
}

// ---- 2. Band thresholds: contiguous, ordered, covering [1.00, 7.00] ----
{
  const order = BAND_KEYS.map(k => BAND_THRESHOLDS[k]);
  ok('thresholds start at 1.00 and end at 7.00', order[0][0] === 1.00 && order[order.length - 1][1] === 7.00, order);
  let contiguous = true;
  for (let i = 1; i < order.length; i++) {
    // each band starts 0.01 above the previous band's end
    if (Math.abs(order[i][0] - order[i - 1][1] - 0.01) > 1e-9) contiguous = false;
  }
  ok('bands are contiguous with no gaps or overlaps', contiguous, order);

  // A score can always be classified: probe a sweep of achievable scores.
  const classify = s => BAND_KEYS.find(k => s >= BAND_THRESHOLDS[k][0] && s <= BAND_THRESHOLDS[k][1]);
  const unclassified = [];
  for (let s = 100; s <= 700; s++) { // 1.00 to 7.00 in 0.01 steps
    if (!classify(s / 100)) unclassified.push(s / 100);
  }
  ok('every score in [1.00, 7.00] at 0.01 resolution classifies into exactly one band', unclassified.length === 0,
    unclassified.slice(0, 5));
}

// ---- 3. Cross-check against the product's real axis set ----
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = /const\s+AXIS_META\s*=\s*\{/.exec(html);
  let i = html.indexOf('{', m.index), depth = 0;
  while (i < html.length) {
    const ch = html[i];
    if (ch === "'") { i++; while (i < html.length && !(html[i] === "'" && html[i - 1] !== '\\')) i++; }
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(html.slice(m.index, i + 1) + '; this.AXIS_META = AXIS_META;').runInContext(sandbox);
  const metaIds = new Set(Object.keys(sandbox.AXIS_META));

  const unknown = Object.keys(BELIEF_MAP_REGISTRY).filter(id => !metaIds.has(id));
  ok('every registry axis exists in the product AXIS_META', unknown.length === 0, unknown);

  // Pole names in the registry must match the product's AXIS_META labels
  // EXCEPT where the content standard deliberately proposes a new name.
  // The product itself carries two label sets today (AXIS_META's formal
  // labels and api/report.js scoresMap's plain-language variants - a
  // deliberate design, confirmed 2026-07-31); which set becomes canonical
  // at the FC2 freeze is an open reviewer question recorded in the vault
  // doc. Every expected divergence is enumerated exactly - any OTHER
  // divergence still fails.
  const EXPECTED_POLE_DIVERGENCES = {
    // registry follows the share-page plain-language variant for this axis;
    // AXIS_META says 'Nihilism' / 'Committed meaning'
    'meaning_practice.L': { registry: 'Nothing matters', product: 'Nihilism' },
    'meaning_practice.R': { registry: 'Actively builds meaning', product: 'Committed meaning' },
  };
  const poleDrift = [];
  for (const [id, e] of Object.entries(BELIEF_MAP_REGISTRY)) {
    const meta = sandbox.AXIS_META[id];
    [['L', 'poleL'], ['R', 'poleR']].forEach(([pole, metaKey]) => {
      const rName = e.poles[pole].name, pName = meta[metaKey];
      const expected = EXPECTED_POLE_DIVERGENCES[id + '.' + pole];
      if (expected) {
        if (rName !== expected.registry || pName !== expected.product) {
          poleDrift.push(`${id}.${pole}: expected divergence changed - registry='${rName}' product='${pName}'`);
        }
      } else if (rName !== pName) {
        poleDrift.push(`${id}.${pole}: unexpected divergence - registry='${rName}' product='${pName}'`);
      }
    });
  }
  ok('registry pole names match AXIS_META except the enumerated known divergences', poleDrift.length === 0, poleDrift);
}

// ---- 4. Content hygiene: banned phrases, dashes, length classes ----
{
  const banned = [
    'pretending one frame covers everything', 'most considered views', 'Honest historians',
    'most working philosophers recommend', 'more accurate than either pure story', 'the honest order',
    'refusal to let comfort outvote honesty', 'manufacturing enthusiasm',
    'forced positivity and cheap consolation', 'papering over it',
  ];
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const found = [], dashed = [], shortTooLong = [], fullTooShort = [];
  for (const [id, e] of Object.entries(BELIEF_MAP_REGISTRY)) {
    const walk = (v, p) => {
      if (typeof v === 'string') {
        banned.forEach(b => { if (v.includes(b)) found.push(p + ': ' + b); });
        if (v.includes(em) || v.includes(en)) dashed.push(p);
      } else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], p + '.' + k));
    };
    walk(e, id);
    for (const b of BAND_KEYS) {
      const words = e.bands[b].full.split(/\s+/).length;
      const shortWords = e.bands[b].short.split(/\s+/).length;
      if (words < 100) fullTooShort.push(`${id}.${b}: ${words} words`);
      if (shortWords > 75) shortTooLong.push(`${id}.${b}: ${shortWords} words`);
    }
  }
  ok('no banned jab/meta-praise phrase anywhere in the registry', found.length === 0, found);
  ok('no em/en dashes anywhere in the registry', dashed.length === 0, dashed);
  ok('every full band text is substantial (100+ words)', fullTooShort.length === 0, fullTooShort);
  ok('every short band text stays compact (75 words max)', shortTooLong.length === 0, shortTooLong);
}

// ---- 5. Validator negative tests: schema holes must not pass ----
{
  const good = BELIEF_MAP_REGISTRY.naturalism;
  const clone = () => JSON.parse(JSON.stringify(good));

  let e = clone(); delete e.centralQuestion;
  ok('validator rejects a missing centralQuestion', !validateRegistryEntry(e).valid);

  e = clone(); e.bands.mid.full = 'too short';
  ok('validator rejects a stub full band text', !validateRegistryEntry(e).valid);

  e = clone(); e.bands.strongR.range = [5.5, 7.0];
  ok('validator rejects a band range that departs from BAND_THRESHOLDS', !validateRegistryEntry(e).valid);

  e = clone(); delete e.midpointVariants.lowInformation;
  ok('validator rejects a missing midpoint variant', !validateRegistryEntry(e).valid);

  e = clone(); e.poles.L.expandedDef = '';
  ok('validator rejects an empty pole definition', !validateRegistryEntry(e).valid);

  e = clone(); e.shortDefinition = 'Uses a confidence score to rank you.';
  ok('validator rejects banned "confidence score" phrasing', !validateRegistryEntry(e).valid);

  ok('the unmodified entry still validates after all negative probes', validateRegistryEntry(good).valid);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
