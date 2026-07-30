// B1: canonical report schema v3 - validator + r2/current-shape legacy adapter.
//
// Field contract is the locked spec: [[Phil OS - Full Report and Belief Map
// Specification]] Section 6. This file is intentionally standalone - no
// import, no fetch, no mutation of inputs, not wired into index.html or any
// api/*.js file yet (that is a separately authorized future block). Placed
// under lib/, not api/, because Phil OS's real Vercel serverless function
// count is already at 12, the documented Hobby-tier ceiling for a
// no-framework project (see the A7 IB-3 finding, 2026-07-30) - any file
// added under api/ counts toward that limit regardless of whether it
// exports a request handler; lib/ does not.
//
// Design principle throughout: never fabricate content the current pipeline
// does not produce. Sections with no current data source are represented as
// present-but-empty and named in fallbackState.missingSections, not invented.

// The 32 canonical axis ids, taken directly from api/report.js's own
// scoresMap (the live source of truth for axis identity) rather than
// re-derived - naturalism..epistemic_humility are Tier 1 (13), knowledge/
// science/freewill_practice are Tier 2 (3), justice..progress are Tier 3 (16).
const AXIS_IDS = [
  'naturalism', 'physicalism', 'realism', 'determinism', 'moral_ground',
  'meaning', 'teleology', 'human_nature', 'epistemic_method', 'social_ontology',
  'temporal_orientation', 'moral_authority', 'epistemic_humility',
  'knowledge', 'science', 'freewill_practice',
  'justice', 'ethics', 'religion', 'politics', 'self', 'moral_scope',
  'meaning_practice', 'society', 'responsibility', 'identity', 'authority',
  'economics', 'uncertainty', 'mind_consciousness', 'animal_ethics', 'progress',
];

const WORLD_LENSES = ['self', 'otherPeople', 'relationships', 'society', 'lifeAndExistence'];

// Fields present in every v3 report at minimum, because the current r2
// pipeline already produces real (not fabricated) data for them. Everything
// else in Section 6's field list is optional/nullable until a data source
// exists - see fallbackState.missingSections.
const REQUIRED_TOP_LEVEL = [
  'completionId', 'instrumentVersion', 'archetypeId', 'familyId',
  'axisScores', 'whoYouAre', 'inTheWorld', 'fingerprint', 'growthEdges', 'tensions',
];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// validateReportV3(report) -> { valid: boolean, errors: string[] }
// Pure, synchronous. Never throws on malformed input - a non-object input
// is itself a validation failure, not an exception.
function validateReportV3(report) {
  const errors = [];
  if (!isPlainObject(report)) {
    return { valid: false, errors: ['report must be a plain object'] };
  }

  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in report) || report[key] === null || report[key] === undefined) {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (report.completionId !== undefined && !isNonEmptyString(report.completionId)) {
    errors.push('completionId must be a non-empty string');
  }
  if (report.instrumentVersion !== undefined && !isNonEmptyString(report.instrumentVersion)) {
    errors.push('instrumentVersion must be a non-empty string');
  }
  if (report.archetypeId !== undefined && !isNonEmptyString(report.archetypeId)) {
    errors.push('archetypeId must be a non-empty string');
  }
  if (report.familyId !== undefined && !isNonEmptyString(report.familyId)) {
    errors.push('familyId must be a non-empty string');
  }

  // axisScores: exactly the 32 canonical axes, numeric values only.
  if (isPlainObject(report.axisScores)) {
    const keys = Object.keys(report.axisScores);
    const missingAxes = AXIS_IDS.filter(id => !(id in report.axisScores));
    const unknownAxes = keys.filter(k => !AXIS_IDS.includes(k));
    if (missingAxes.length) errors.push(`axisScores missing axes: ${missingAxes.join(', ')}`);
    if (unknownAxes.length) errors.push(`axisScores has unrecognised axes: ${unknownAxes.join(', ')}`);
    for (const id of AXIS_IDS) {
      if (id in report.axisScores && typeof report.axisScores[id] !== 'number') {
        errors.push(`axisScores.${id} must be a number`);
      }
    }
  } else if (report.axisScores !== undefined) {
    errors.push('axisScores must be a plain object keyed by axis id');
  }

  // whoYouAre: overview + evidenceAxisIds required (Section 6 names both
  // explicitly on this field); deep/corePatterns/etc. optional.
  if (isPlainObject(report.whoYouAre)) {
    if (!isNonEmptyString(report.whoYouAre.overview)) {
      errors.push('whoYouAre.overview must be a non-empty string');
    }
    if (!Array.isArray(report.whoYouAre.evidenceAxisIds)) {
      errors.push('whoYouAre.evidenceAxisIds must be an array');
    }
  } else if (report.whoYouAre !== undefined) {
    errors.push('whoYouAre must be a plain object');
  }

  // inTheWorld: all 5 lenses required, each with view/showsUp/prompt strings.
  // Section 6 does not list evidenceAxisIds on this field (unlike
  // whoYouAre, where it is named explicitly) - not required here, so the
  // adapter is not forced to attribute per-report axis evidence it cannot
  // actually ground without over-claiming precision.
  if (isPlainObject(report.inTheWorld)) {
    for (const lens of WORLD_LENSES) {
      const l = report.inTheWorld[lens];
      if (!isPlainObject(l)) {
        errors.push(`inTheWorld.${lens} must be a plain object`);
        continue;
      }
      if (!isNonEmptyString(l.view)) errors.push(`inTheWorld.${lens}.view must be a non-empty string`);
      if (!isNonEmptyString(l.showsUp)) errors.push(`inTheWorld.${lens}.showsUp must be a non-empty string`);
      if (!isNonEmptyString(l.prompt)) errors.push(`inTheWorld.${lens}.prompt must be a non-empty string`);
    }
  } else if (report.inTheWorld !== undefined) {
    errors.push('inTheWorld must be a plain object');
  }

  // fingerprint: array of {axisId, score, whySelected}.
  if (Array.isArray(report.fingerprint)) {
    report.fingerprint.forEach((f, i) => {
      if (!isPlainObject(f)) { errors.push(`fingerprint[${i}] must be an object`); return; }
      if (!AXIS_IDS.includes(f.axisId)) errors.push(`fingerprint[${i}].axisId is not a recognised axis`);
      if (typeof f.score !== 'number') errors.push(`fingerprint[${i}].score must be a number`);
      if (!isNonEmptyString(f.whySelected)) errors.push(`fingerprint[${i}].whySelected must be a non-empty string`);
    });
  } else if (report.fingerprint !== undefined) {
    errors.push('fingerprint must be an array');
  }

  // growthEdges: array of objects with at least title + text - matches what
  // the live selectGrowthEdges() already produces, no stricter sub-schema
  // than the spec actually locks at this level.
  if (Array.isArray(report.growthEdges)) {
    report.growthEdges.forEach((g, i) => {
      if (!isPlainObject(g)) { errors.push(`growthEdges[${i}] must be an object`); return; }
      if (!isNonEmptyString(g.title)) errors.push(`growthEdges[${i}].title must be a non-empty string`);
      if (!isNonEmptyString(g.text)) errors.push(`growthEdges[${i}].text must be a non-empty string`);
    });
  } else if (report.growthEdges !== undefined) {
    errors.push('growthEdges must be an array');
  }

  // tensions: formal[] required (the 42-rule engine's live output);
  // worldview[]/distinctive[] optional (B8-gated, not yet produced).
  if (isPlainObject(report.tensions)) {
    if (!Array.isArray(report.tensions.formal)) {
      errors.push('tensions.formal must be an array');
    }
    if (report.tensions.worldview !== undefined && !Array.isArray(report.tensions.worldview)) {
      errors.push('tensions.worldview must be an array when present');
    }
    if (report.tensions.distinctive !== undefined && !Array.isArray(report.tensions.distinctive)) {
      errors.push('tensions.distinctive must be an array when present');
    }
  } else if (report.tensions !== undefined) {
    errors.push('tensions must be a plain object');
  }

  // fallbackState is optional, but if present must be well-formed - a
  // malformed disclosure of what's missing is worse than no disclosure.
  if (report.fallbackState !== undefined) {
    if (!isPlainObject(report.fallbackState) || !Array.isArray(report.fallbackState.missingSections)) {
      errors.push('fallbackState, when present, must be { missingSections: [] }');
    }
  }

  return { valid: errors.length === 0, errors };
}

// Sections Section 6 defines that the current r2 pipeline has no data
// source for at all yet (no AI call, no registry, no library produces
// them) - listed here once so adaptR2ToV3() and its tests stay in sync
// rather than hand-maintaining the same list twice.
const UNMAPPED_SECTIONS = [
  'famousMinds', 'operating', 'lifeAlignment', 'cultureMap',
  'tensions.worldview', 'tensions.distinctive',
];

// adaptR2ToV3(scores, fingerprint, archetypeResult, contradictions, report)
// Pure, synchronous, no I/O. Takes exactly the five values index.html's
// renderReport() already receives today and returns a v3-shaped object.
// Text that has a v3 home is carried byte-for-byte, never reworded.
// Sections with no current data source are omitted, not fabricated, and
// listed in fallbackState.missingSections.
function adaptR2ToV3(scores, fingerprint, archetypeResult, contradictions, report) {
  const arch = archetypeResult && archetypeResult.primary && archetypeResult.primary.arch;
  const archId = arch && arch.id ? arch.id : null;
  // familyId is derived from the archetype id's own numeric-family prefix
  // (e.g. '1A' -> '1') - the registry's own encoding, not an invented value.
  const familyId = archId ? (archId.match(/^\d+/) || [null])[0] : null;

  const inTheWorld = {};
  const worldArr = Array.isArray(report && report.world) ? report.world : [];
  const lensByName = {
    'The Self': 'self',
    'Other People': 'otherPeople',
    'Relationships': 'relationships',
    'Society': 'society',
    'Life and Existence': 'lifeAndExistence',
  };
  for (const lensName of Object.keys(lensByName)) {
    const key = lensByName[lensName];
    const found = worldArr.find(w => w && w.lens === lensName);
    inTheWorld[key] = found
      ? { view: found.view || '', showsUp: found.shows_up || '', prompt: found.prompt || '', deep: null }
      : { view: '', showsUp: '', prompt: '', deep: null };
  }

  const fingerprintV3 = (Array.isArray(fingerprint) ? fingerprint : []).map(f => ({
    axisId: f.axis,
    score: f.score,
    // Matches the live user-facing copy for this exact selection
    // (api/report.js's "the 5 axes where your position deviates furthest
    // from centre") rather than inventing new wording.
    whySelected: 'one of the 5 axes where this profile\'s position deviates furthest from centre',
  }));

  return {
    completionId: null, // caller-supplied at the call site; not derivable from these five inputs alone
    instrumentVersion: null, // same - lives on the completions row, not in these five inputs
    reportContentVersion: 'v3-adapted-from-r2',
    promptVersion: null,
    archetypeId: archId,
    familyId: familyId,
    sigilId: null,
    axisScores: { ...(scores || {}) },
    poles: null,
    archetypeSummary: (arch && arch.tagline) || null,
    whoYouAre: {
      overview: (report && report.identity) || '',
      deep: null,
      corePatterns: [],
      alignedExpression: [],
      misalignedExpression: [],
      evidenceAxisIds: Object.keys(scores || {}),
      confidence: null,
      limitations: [],
    },
    inTheWorld,
    famousMinds: [],
    operating: null,
    fingerprint: fingerprintV3,
    lifeAlignment: null,
    cultureMap: null,
    growthEdges: Array.isArray(report && report.growth) ? report.growth : [],
    tensions: {
      formal: Array.isArray(contradictions) ? contradictions : [],
      worldview: [],
      distinctive: [],
    },
    axisDetail: {},
    methodology: null,
    confidence: null,
    contentWarnings: [],
    fallbackState: { missingSections: [...UNMAPPED_SECTIONS] },
  };
}

module.exports = { AXIS_IDS, WORLD_LENSES, validateReportV3, adaptR2ToV3, UNMAPPED_SECTIONS };
