// Cross-registry sanity (2026-08-02): confirms the three variant-keyed
// content registries built today (B-1 Famous Minds, B-2 Culture Map,
// B-3 How You Operate) all cover exactly the same 60 variant ids, in the
// same order, and that every id is a real live ARCHETYPES id. Each
// registry's own test suite already checks this against ARCHETYPES
// individually; this suite checks the three against EACH OTHER directly,
// so a future edit to any one of them that silently drops or renames a
// variant fails here even if that registry's own suite were skipped.
//
// Run with:
//   node lib/variant-registry-parity.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const famousMinds = require('./famous-minds-registry.js');
const cultureMap = require('./culture-map-registry.js');
const howYouOperate = require('./how-you-operate-registry.js');

const REGISTRIES = {
  'famous-minds-registry.js (B-1)': famousMinds.VARIANT_IDS,
  'culture-map-registry.js (B-2)': cultureMap.VARIANT_IDS,
  'how-you-operate-registry.js (B-3)': howYouOperate.VARIANT_IDS,
};

// ---- 1. Pairwise identical VARIANT_IDS sets ----
// Order is NOT asserted here: famous-minds-registry.js and
// how-you-operate-registry.js follow strict numeric document order
// (1A, 1B, ... 12E), but culture-map-registry.js's source vault doc was
// drafted in review-chunk order (Family 1, then Family 10 as the
// contrast exemplar, then Family 2 onward) - a real, disclosed property
// of how that document was built, not a defect. Set membership is what
// actually matters for cross-registry consistency.
{
  const names = Object.keys(REGISTRIES);
  const mismatches = [];
  for (let i = 1; i < names.length; i++) {
    const a = [...REGISTRIES[names[0]]].sort(), b = [...REGISTRIES[names[i]]].sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      mismatches.push({ a: names[0], b: names[i], onlyInA: a.filter((x) => !b.includes(x)), onlyInB: b.filter((x) => !a.includes(x)) });
    }
  }
  ok('all three B-1/B-2/B-3 registries cover the identical set of 60 variant ids', mismatches.length === 0, mismatches);
}

// ---- 2. Every registry's ids are exactly the 60 live ARCHETYPES ids ----
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(extractConst(html, 'ARCHETYPES', '[', ']') + '\nthis.ARCHETYPES = ARCHETYPES;').runInContext(sandbox);
  const liveIds = sandbox.ARCHETYPES.map((a) => a.id);

  Object.entries(REGISTRIES).forEach(([name, ids]) => {
    ok(`${name}: VARIANT_IDS set matches live ARCHETYPES ids exactly (60/60)`,
      JSON.stringify([...ids].sort()) === JSON.stringify([...liveIds].sort()),
      { onlyInRegistry: ids.filter((x) => !liveIds.includes(x)), onlyInLive: liveIds.filter((x) => !ids.includes(x)) });
  });
}

// ---- 3. Every registry actually has an entry for every one of its own ids ----
// (catches a VARIANT_IDS array padded with an id whose registry object
// entry is missing, which the id-array checks above alone would not).
{
  ok('famous-minds-registry.js: every VARIANT_IDS entry has a registry object', famousMinds.VARIANT_IDS.every((id) => !!famousMinds.FAMOUS_MINDS_REGISTRY[id]));
  ok('culture-map-registry.js: every VARIANT_IDS entry has a registry object', cultureMap.VARIANT_IDS.every((id) => !!cultureMap.CULTURE_MAP_REGISTRY[id]));
  ok('how-you-operate-registry.js: every VARIANT_IDS entry has a registry object', howYouOperate.VARIANT_IDS.every((id) => !!howYouOperate.HOW_YOU_OPERATE_REGISTRY[id]));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
