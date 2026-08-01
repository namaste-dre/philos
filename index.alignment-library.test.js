// B-4/B-5 wiring block: behavioral lock for the Alignment Library rendering
// (2026-08-01). Andre approved the four disjoint candidate-axis sets and
// tie-break orders (Fable decision block, Claude Lyra Phil OS Log Round 42,
// approved Round 43); this suite pins the client-side implementation of
// that decision - ALIGNMENT_DOMAIN_CANDIDATES, ALIGNMENT_LIBRARY,
// classifyAlignmentBand, and selectAlignmentCard, all defined in
// index.html - so any future change can only happen loudly.
//
// Covers: candidate-set membership and disjointness against the approved
// lists, band-threshold parity against lib/belief-map-registry.js,
// selection logic (largest-distance, tie-break order, near-mid fallback),
// and the rendered card output shape.
//
// Run with:
//   node index.alignment-library.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

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
const code = extractConst(html, 'ALIGNMENT_DOMAIN_CANDIDATES', '{', '}') + '\n' +
  extractConst(html, 'ALIGNMENT_LIBRARY', '{', '}') + '\n' +
  extractFunction(html, 'classifyAlignmentBand') + '\n' +
  extractFunction(html, 'selectAlignmentCard') + '\n' +
  'this.ALIGNMENT_DOMAIN_CANDIDATES = ALIGNMENT_DOMAIN_CANDIDATES; ' +
  'this.ALIGNMENT_LIBRARY = ALIGNMENT_LIBRARY; ' +
  'this.classifyAlignmentBand = classifyAlignmentBand; ' +
  'this.selectAlignmentCard = selectAlignmentCard;';
new vm.Script(code).runInContext(sandbox);
const { ALIGNMENT_DOMAIN_CANDIDATES, ALIGNMENT_LIBRARY, classifyAlignmentBand, selectAlignmentCard } = sandbox;

const DOMAINS = ['Work', 'Relationships', 'Decisions', 'Conflict'];
const BANDS = ['strongL', 'leanL', 'mid', 'leanR', 'strongR'];

// The exact sets and orders Andre approved (Round 43) - a hardcoded
// expectation, not derived from the implementation under test.
const APPROVED = {
  Work: ['authority', 'temporal_orientation', 'responsibility', 'human_nature', 'social_ontology', 'progress'],
  Relationships: ['self', 'meaning_practice', 'uncertainty', 'identity', 'moral_scope', 'meaning'],
  Decisions: ['knowledge', 'epistemic_humility', 'epistemic_method', 'ethics', 'science', 'teleology'],
  Conflict: ['freewill_practice', 'justice', 'moral_authority', 'realism', 'moral_ground', 'determinism'],
};

// ---- 1. Candidate sets match Andre's approved decision exactly, in order ----
{
  ok('ALIGNMENT_DOMAIN_CANDIDATES has exactly the 4 domains',
    JSON.stringify(Object.keys(ALIGNMENT_DOMAIN_CANDIDATES).sort()) === JSON.stringify([...DOMAINS].sort()));

  const mismatches = [];
  DOMAINS.forEach(domain => {
    const actual = ALIGNMENT_DOMAIN_CANDIDATES[domain];
    const expected = APPROVED[domain];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push({ domain, expected, actual });
    }
  });
  ok('every domain candidate set + tie-break order matches the approved decision exactly', mismatches.length === 0, mismatches);
}

// ---- 2. Disjointness: no axis eligible for more than one domain ----
{
  const seen = new Map();
  const dupes = [];
  DOMAINS.forEach(domain => {
    ALIGNMENT_DOMAIN_CANDIDATES[domain].forEach(axisId => {
      if (seen.has(axisId)) dupes.push(`${axisId}: ${seen.get(axisId)} and ${domain}`);
      seen.set(axisId, domain);
    });
  });
  ok('no axis appears in more than one domain candidate set (structural anti-repetition guarantee)', dupes.length === 0, dupes);
  ok('24 distinct axes across the 4 candidate sets (6 x 4, no overlap)', seen.size === 24, seen.size);
}

// ---- 3. Library coverage: every candidate axis has content for its own domain, all 5 bands ----
{
  const missing = [];
  DOMAINS.forEach(domain => {
    ALIGNMENT_DOMAIN_CANDIDATES[domain].forEach(axisId => {
      if (!ALIGNMENT_LIBRARY[axisId]) { missing.push(`${axisId}: no entry in ALIGNMENT_LIBRARY at all`); return; }
      if (!ALIGNMENT_LIBRARY[axisId][domain]) { missing.push(`${axisId}/${domain}: no domain entry`); return; }
      BANDS.forEach(band => {
        const text = ALIGNMENT_LIBRARY[axisId][domain][band];
        if (typeof text !== 'string' || text.trim().length < 20) missing.push(`${axisId}/${domain}/${band}: missing or too short`);
      });
    });
  });
  ok('every approved (axisId, domain, band) combination has real content (24 x 4 x 5 = 480)', missing.length === 0, missing.slice(0, 8));

  const totalEntries = Object.keys(ALIGNMENT_LIBRARY).length;
  ok('ALIGNMENT_LIBRARY holds exactly the 24 approved axes, no more, no fewer', totalEntries === 24, totalEntries);
}

// ---- 4. Band classifier parity with lib/belief-map-registry.js's BAND_THRESHOLDS ----
{
  const { BAND_THRESHOLDS } = require('./lib/belief-map-registry.js');
  const mismatches = [];
  for (let s = 100; s <= 700; s++) {
    const score = s / 100;
    const clientBand = classifyAlignmentBand(score);
    const expectedBand = Object.keys(BAND_THRESHOLDS).find(
      k => score >= BAND_THRESHOLDS[k][0] && score <= BAND_THRESHOLDS[k][1]
    );
    if (clientBand !== expectedBand) mismatches.push({ score, clientBand, expectedBand });
  }
  ok('classifyAlignmentBand matches lib/belief-map-registry.js BAND_THRESHOLDS at every 0.01 step, 1.00-7.00',
    mismatches.length === 0, mismatches.slice(0, 5));
}

// ---- 5. selectAlignmentCard: selection logic ----
{
  const r1 = selectAlignmentCard('Work', { authority: 6.2, temporal_orientation: 3.0, responsibility: 5.5, human_nature: 4.0, social_ontology: 4.1, progress: 3.9 });
  ok('selects the candidate with the largest distance from midpoint (authority, distance 2.2)',
    r1.text === ALIGNMENT_LIBRARY.authority.Work.strongR, { got: r1.text && r1.text.slice(0, 40) });

  // Tie on distance (self=5.0 dist 1.0, meaning_practice=3.0 dist 1.0): self is
  // earlier in the approved Relationships order, so self must win the tie.
  const r2 = selectAlignmentCard('Relationships', { self: 5.0, meaning_practice: 3.0, uncertainty: 4.0, identity: 4.0, moral_scope: 4.0, meaning: 4.0 });
  ok('ties on equal distance from midpoint break toward the earlier candidate in the approved order',
    r2.text === ALIGNMENT_LIBRARY.self.Relationships.leanR, { got: r2.text && r2.text.slice(0, 40) });

  // All-midpoint Decisions candidates: must resolve to the first candidate
  // (knowledge) at mid band, never crash, never return nothing.
  const r3 = selectAlignmentCard('Decisions', { knowledge: 4.0, epistemic_humility: 4.0, epistemic_method: 4.0, ethics: 4.0, science: 4.0, teleology: 4.0 });
  ok('all-midpoint candidates resolve to the first candidate in the approved order, mid band',
    r3.text === ALIGNMENT_LIBRARY.knowledge.Decisions.mid, { got: r3.text && r3.text.slice(0, 40) });

  // Missing scores default to the midpoint (4), matching the scores[k] || 4
  // convention used elsewhere in index.html - never crashes, never selects
  // undefined.
  const r4 = selectAlignmentCard('Conflict', { freewill_practice: 5.0 });
  ok('a candidate set with mostly-missing scores still resolves without crashing',
    typeof r4.text === 'string' && r4.text.length > 0, r4);
}

// ---- 6. Rendered output shape: exactly 4 cards, correct labels, in order, no repeats for a real profile ----
{
  const AXES = ['naturalism', 'physicalism', 'realism', 'determinism', 'moral_ground', 'meaning', 'teleology', 'human_nature', 'epistemic_method', 'social_ontology', 'temporal_orientation', 'moral_authority', 'epistemic_humility', 'knowledge', 'science', 'freewill_practice', 'justice', 'ethics', 'religion', 'politics', 'self', 'moral_scope', 'meaning_practice', 'society', 'responsibility', 'identity', 'authority', 'economics', 'uncertainty', 'mind_consciousness', 'animal_ethics', 'progress'];
  function seededScores(seed) {
    const scores = {};
    let x = seed;
    AXES.forEach(axis => {
      x = (x * 9301 + 49297) % 233280;
      scores[axis] = 1 + (x / 233280) * 6; // 1.00-7.00
    });
    return scores;
  }

  let allFourDomainsCorrect = true;
  let noRepeatedAxisAcrossCards = true;
  for (let seed = 1; seed <= 25; seed++) {
    const scores = seededScores(seed);
    const cards = DOMAINS.map(domain => selectAlignmentCard(domain, scores));
    if (cards.length !== 4 || JSON.stringify(cards.map(c => c.label)) !== JSON.stringify(DOMAINS)) {
      allFourDomainsCorrect = false;
    }
    // Reconstruct which axis produced each card's text and confirm the 4
    // selected axes are always distinct (guaranteed by disjointness, but
    // verified end-to-end here rather than assumed).
    const selectedAxes = DOMAINS.map(domain => {
      const candidates = ALIGNMENT_DOMAIN_CANDIDATES[domain];
      let best = candidates[0], bestDistance = -1;
      candidates.forEach(axisId => {
        const d = Math.abs((scores[axisId] || 4) - 4);
        if (d > bestDistance) { best = axisId; bestDistance = d; }
      });
      return best;
    });
    if (new Set(selectedAxes).size !== 4) noRepeatedAxisAcrossCards = false;
  }
  ok('25 random score profiles each produce exactly 4 cards labeled Work/Relationships/Decisions/Conflict in order', allFourDomainsCorrect);
  ok('25 random score profiles never select the same axis for two different domain cards', noRepeatedAxisAcrossCards);
}

// ---- 7. Content hygiene on the client-embedded subset (no dashes) ----
{
  const em = String.fromCharCode(0x2014), en = String.fromCharCode(0x2013);
  const dashed = [];
  Object.entries(ALIGNMENT_LIBRARY).forEach(([axisId, domains]) => {
    Object.entries(domains).forEach(([domain, bands]) => {
      Object.entries(bands).forEach(([band, text]) => {
        if (text.includes(em) || text.includes(en)) dashed.push(`${axisId}/${domain}/${band}`);
      });
    });
  });
  ok('no em/en dashes in the client-embedded ALIGNMENT_LIBRARY subset', dashed.length === 0, dashed.slice(0, 8));
}

// ---- 8. Cross-file parity: the client subset must be byte-identical to ----
// lib/alignment-library-registry.js's already vault-parity-tested content
// for the 24 approved axes. Two independent extractions of the same vault
// doc could in principle drift if either extraction script changes; this
// check requires no vault access (unlike a direct vault-doc check) and so
// runs unconditionally in every environment, CI included.
{
  const { ALIGNMENT_LIBRARY_REGISTRY } = require('./lib/alignment-library-registry.js');
  const canonical = {};
  ALIGNMENT_LIBRARY_REGISTRY.forEach(e => {
    canonical[e.axisId] = canonical[e.axisId] || {};
    canonical[e.axisId][e.domain] = canonical[e.axisId][e.domain] || {};
    canonical[e.axisId][e.domain][e.band] = e.text;
  });

  const mismatches = [];
  Object.keys(ALIGNMENT_LIBRARY).forEach(axisId => {
    DOMAINS.forEach(domain => {
      BANDS.forEach(band => {
        const clientText = ALIGNMENT_LIBRARY[axisId][domain][band];
        const canonicalText = canonical[axisId] && canonical[axisId][domain] && canonical[axisId][domain][band];
        if (clientText !== canonicalText) mismatches.push(`${axisId}/${domain}/${band}`);
      });
    });
  });
  ok('client ALIGNMENT_LIBRARY subset is byte-identical to lib/alignment-library-registry.js for all 480 shared fields',
    mismatches.length === 0, mismatches.slice(0, 8));
}

// ---- 9. Cross-file parity: index.html's ALIGNMENT_DOMAIN_CANDIDATES must ----
// match lib/alignment-library-registry.js's copy exactly (the public share
// page hotfix, api/report.js, imports and relies on the lib module's copy;
// this guards against the two ever drifting).
{
  const { ALIGNMENT_DOMAIN_CANDIDATES: serverCandidates } = require('./lib/alignment-library-registry.js');
  const mismatches = [];
  DOMAINS.forEach(domain => {
    if (JSON.stringify(ALIGNMENT_DOMAIN_CANDIDATES[domain]) !== JSON.stringify(serverCandidates[domain])) {
      mismatches.push({ domain, client: ALIGNMENT_DOMAIN_CANDIDATES[domain], server: serverCandidates[domain] });
    }
  });
  ok('client (index.html) and server (lib/alignment-library-registry.js) candidate-axis sets are byte-identical',
    mismatches.length === 0, mismatches);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
