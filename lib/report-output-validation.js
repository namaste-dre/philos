// C-4: generated report output validation scaffold (2026-08-02).
//
// Validates the AI-owned generated output shapes as the live pipeline
// actually produces them today:
//   Call 1 -> { identity: string }  (5 paragraphs separated by blank lines;
//              the only AI-owned Call 1 field since 923e07f removed alignment)
//   Call 2 -> { world: [ { lens, icon, view, shows_up, prompt } x 5 ] }
//
// This module is DELIBERATELY INERT: nothing imports it yet. Where and how
// its verdicts gate the live pipeline (block, warn-only, log) is a separate
// enforcement decision for Andre/Lyra, explicitly deferred per the C-4
// directive - building the rules and proving their behavior on fixtures
// comes first. It complements, not duplicates, the existing layers:
//   - cleanAIText()/validateReportPayload() (index.html) NORMALIZE dashes at
//     parse time; this module DETECTS what should never survive that
//     normalization, which is why a dash here is an error, not a warning -
//     the intended enforcement point sits after the normalizer, where any
//     surviving dash means the normalizer failed.
//   - lib/report-schema-v3.js validates the v3 report ENVELOPE (field
//     presence/types across the whole stored report); this module validates
//     generated PROSE QUALITY on the two AI calls' own output shapes.
//
// Severity model, and why there are exactly two levels:
//   error   - content is unfit to render or store: structural break, missing
//             or wrong-typed field, truncation below floor, rendering
//             artifacts (undefined/placeholder/control chars/surviving
//             escape sequences), or a dash that survived normalization.
//   warning - content is suspect but renderable: banned phrase, paragraph-
//             count contract deviation, lens ordering/icon mismatch, leaked
//             internal axis jargon, a "prompt" that is not a question.
//   Rationale: a hard failure forces a paid regeneration; burning a user's
//   generation on a style defect is worse than shipping "moreover." Style
//   defects surface as machine-readable warnings so a future enforcement
//   point can decide to strip, log, or regenerate - a product decision this
//   scaffold does not make.
//
// Purity contract: every entry point is synchronous, never throws on
// malformed input (a non-object input is itself a validation failure), and
// never mutates its input. Structured result:
//   { ok, errors: [issue], warnings: [issue], issues: [issue] }
// where each issue is { severity, code, path, detail } and ok means zero
// errors (warnings allowed).
//
// Same dependency-free CommonJS convention as the lib/ siblings.

'use strict';

// The FC1 guard list, reused verbatim from index.belief-map.test.js's
// permanent regression guard (commit 8570147, findings from the 2026-07-12
// independent review) - the jab/meta-praise phrasings the FC1 semantic
// fixes removed from reviewed content and that generated prose must not
// reintroduce. Matched case-insensitively as substrings.
const FC1_BANNED_PHRASES = Object.freeze([
  'pretending one frame covers everything',
  'most considered views',
  'Honest historians',
  'most working philosophers recommend',
  'more accurate than either pure story',
  'the honest order',
  'refusal to let comfort outvote honesty',
  'manufacturing enthusiasm',
  'forced positivity and cheap consolation',
  'papering over it',
]);

// AI-voice tip-off phrases, from the product's standing voice rules (the
// same list the vault's own writing standard bans). Single words are
// matched with word boundaries; multi-word phrases as case-insensitive
// substrings.
const AI_TIPOFF_PHRASES = Object.freeze([
  'as an AI',
  'as a language model',
  'I don\'t have access',
  'I hope this helps',
  'based on the provided',
  'it\'s worth noting',
  'it is worth noting',
  'in conclusion',
  'moreover',
  'furthermore',
  'delve',
  'delving',
  'tapestry',
  'a testament to',
  'underscores the',
  'highlights the importance',
  'plays a crucial role',
  'navigating the complexities',
  'the landscape of',
]);

// Only the snake_case multi-word axis ids are screened as jargon leaks: the
// single-word axis ids (meaning, self, society, identity, authority, ...)
// are ordinary English and would false-positive constantly, but a
// snake_case token like "meaning_practice" can never appear in natural
// prose - if it shows up, the model echoed internal axis vocabulary the
// prompt explicitly forbids.
const JARGON_AXIS_IDS = Object.freeze([
  'moral_ground', 'human_nature', 'epistemic_method', 'social_ontology',
  'temporal_orientation', 'moral_authority', 'epistemic_humility',
  'freewill_practice', 'moral_scope', 'meaning_practice',
  'mind_consciousness', 'animal_ethics',
]);

// Length floors for the AI-owned prose fields, deliberately conservative:
// they exist to catch truncation and hollow output, not to police style.
// identity's contract is 5 paragraphs / 13 sentences (realistically well
// over 1300 chars); 800 catches a truncated or collapsed response without
// false-failing terse-but-complete output. Lens view/shows_up contract is
// "2-3 sentences" (realistically 150+); 80 catches stubs. prompt is "one
// reflective question"; 20 catches empties and fragments.
const LENGTH_FLOORS = Object.freeze({
  identity: 800,
  lensView: 80,
  lensShowsUp: 80,
  lensPrompt: 20,
});

// The canonical Call 2 lens set, in prompt order, with the icon each lens
// is contracted to carry - taken from the live prompt2 template in
// index.html, not invented.
const CANONICAL_LENSES = Object.freeze([
  Object.freeze({ lens: 'The Self', icon: 'mirror' }),
  Object.freeze({ lens: 'Other People', icon: 'people' }),
  Object.freeze({ lens: 'Relationships', icon: 'connect' }),
  Object.freeze({ lens: 'Society', icon: 'city' }),
  Object.freeze({ lens: 'Life and Existence', icon: 'horizon' }),
]);

const PLACEHOLDER_RE = /\bTBD\b|\bTODO\b|\bplaceholder\b|\bFIXME\b|\bXXX\b|\blorem ipsum\b/i;

function issue(severity, code, path, detail) {
  return { severity, code, path, detail };
}

// Scans one prose string for content defects. Returns an array of issues
// (possibly empty). Pure; exported for reuse by any future enforcement
// point that wants field-level scanning without the full call-shape check.
function scanProse(text, path) {
  const issues = [];
  if (typeof text !== 'string') {
    issues.push(issue('error', 'wrong-type', path, 'expected a string'));
    return issues;
  }

  // Dashes: the live pipeline normalizes these away (cleanAIText) before
  // this validator's intended enforcement point - one surviving here means
  // the normalization failed, which is structural, not stylistic.
  if (/[—–]/.test(text)) {
    issues.push(issue('error', 'dash', path, 'em/en dash present (should have been normalized by cleanAIText)'));
  }

  // Rendering artifacts.
  if (/\bundefined\b|\[object Object\]/.test(text)) {
    issues.push(issue('error', 'undefined-leak', path, 'literal "undefined" or "[object Object]" in prose'));
  }
  if (PLACEHOLDER_RE.test(text)) {
    issues.push(issue('error', 'placeholder', path, 'placeholder/stub text in prose'));
  }
  // A literal backslash-n sequence in PARSED text means double-escaping
  // survived the JSON repair path and would render as visible "\n" to the
  // user. Real newlines (parsed from the escape the prompt demands) are
  // fine; \r/\t/other C0 controls are not.
  if (text.indexOf('\\n') !== -1) {
    issues.push(issue('error', 'repair-artifact', path, 'literal backslash-n sequence survived parsing'));
  }
  if (/[\u0000-\u0009\u000b-\u001f]/.test(text)) {
    issues.push(issue('error', 'repair-artifact', path, 'raw control character in prose'));
  }
  if (/^```|```$/m.test(text)) {
    issues.push(issue('error', 'repair-artifact', path, 'markdown code fence survived parsing'));
  }

  // Banned phrases: warnings, per the severity rationale in the header.
  FC1_BANNED_PHRASES.forEach((p) => {
    if (text.toLowerCase().includes(p.toLowerCase())) {
      issues.push(issue('warning', 'banned-phrase', path, `FC1 guard phrase: "${p}"`));
    }
  });
  AI_TIPOFF_PHRASES.forEach((p) => {
    const hit = p.includes(' ')
      ? text.toLowerCase().includes(p.toLowerCase())
      : new RegExp('\\b' + p + '\\b', 'i').test(text);
    if (hit) {
      issues.push(issue('warning', 'banned-phrase', path, `AI tip-off phrase: "${p}"`));
    }
  });

  // Internal axis vocabulary leaking into user-facing prose.
  JARGON_AXIS_IDS.forEach((id) => {
    if (text.includes(id)) {
      issues.push(issue('warning', 'jargon-leak', path, `internal axis id "${id}" in prose`));
    }
  });

  return issues;
}

function makeResult(issues) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings, issues };
}

// validateCall1Output(parsed) -> result
// Validates the parsed Call 1 payload: { identity: string }.
function validateCall1Output(parsed) {
  const issues = [];
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    issues.push(issue('error', 'wrong-type', 'call1', 'parsed Call 1 output must be a plain object'));
    return makeResult(issues);
  }
  const identity = parsed.identity;
  if (typeof identity !== 'string' || identity.trim().length === 0) {
    issues.push(issue('error', 'missing-field', 'call1.identity', 'identity must be a non-empty string'));
    return makeResult(issues);
  }

  if (identity.trim().length < LENGTH_FLOORS.identity) {
    issues.push(issue('error', 'too-short', 'call1.identity',
      `identity is ${identity.trim().length} chars, floor is ${LENGTH_FLOORS.identity}`));
  }

  // Paragraph contract: 5 paragraphs separated by blank lines. Fewer than 2
  // means the structure collapsed entirely (error); any other deviation
  // from exactly 5 still renders fine and is surfaced as a warning.
  const paragraphs = identity.trim().split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 2) {
    issues.push(issue('error', 'paragraph-count', 'call1.identity',
      `identity has ${paragraphs.length} paragraph(s); structure collapsed (contract is 5)`));
  } else if (paragraphs.length !== 5) {
    issues.push(issue('warning', 'paragraph-count', 'call1.identity',
      `identity has ${paragraphs.length} paragraphs; contract is 5`));
  }

  issues.push(...scanProse(identity, 'call1.identity'));
  return makeResult(issues);
}

// validateCall2Output(parsed) -> result
// Validates the parsed Call 2 payload: { world: [5 lenses] }.
function validateCall2Output(parsed) {
  const issues = [];
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    issues.push(issue('error', 'wrong-type', 'call2', 'parsed Call 2 output must be a plain object'));
    return makeResult(issues);
  }
  const world = parsed.world;
  if (!Array.isArray(world)) {
    issues.push(issue('error', 'missing-field', 'call2.world', 'world must be an array'));
    return makeResult(issues);
  }
  if (world.length !== CANONICAL_LENSES.length) {
    issues.push(issue('error', 'lens-count', 'call2.world',
      `world has ${world.length} lenses; contract is ${CANONICAL_LENSES.length}`));
  }

  const canonicalNames = CANONICAL_LENSES.map((c) => c.lens);
  const seenNames = [];

  world.forEach((entry, i) => {
    const path = `call2.world[${i}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(issue('error', 'wrong-type', path, 'lens entry must be a plain object'));
      return;
    }

    ['lens', 'icon', 'view', 'shows_up', 'prompt'].forEach((field) => {
      if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
        issues.push(issue('error', 'missing-field', `${path}.${field}`, `${field} must be a non-empty string`));
      }
    });

    if (typeof entry.lens === 'string') {
      if (!canonicalNames.includes(entry.lens)) {
        issues.push(issue('error', 'unknown-lens', `${path}.lens`, `"${entry.lens}" is not a canonical lens name`));
      } else {
        if (seenNames.includes(entry.lens)) {
          issues.push(issue('error', 'duplicate-lens', `${path}.lens`, `"${entry.lens}" appears more than once`));
        }
        seenNames.push(entry.lens);
        // Order and icon contract: the public share page assigns icons
        // positionally, so a reordered array mis-decorates lenses there -
        // real but renderable, hence warnings.
        if (i < CANONICAL_LENSES.length && CANONICAL_LENSES[i].lens !== entry.lens) {
          issues.push(issue('warning', 'lens-order', `${path}.lens`,
            `expected "${CANONICAL_LENSES[i].lens}" at position ${i}, got "${entry.lens}"`));
        }
        const canonical = CANONICAL_LENSES.find((c) => c.lens === entry.lens);
        if (typeof entry.icon === 'string' && canonical && entry.icon !== canonical.icon) {
          issues.push(issue('warning', 'icon-mismatch', `${path}.icon`,
            `lens "${entry.lens}" carries icon "${entry.icon}"; contract is "${canonical.icon}"`));
        }
      }
    }

    if (typeof entry.view === 'string' && entry.view.trim().length > 0 && entry.view.trim().length < LENGTH_FLOORS.lensView) {
      issues.push(issue('error', 'too-short', `${path}.view`,
        `view is ${entry.view.trim().length} chars, floor is ${LENGTH_FLOORS.lensView}`));
    }
    if (typeof entry.shows_up === 'string' && entry.shows_up.trim().length > 0 && entry.shows_up.trim().length < LENGTH_FLOORS.lensShowsUp) {
      issues.push(issue('error', 'too-short', `${path}.shows_up`,
        `shows_up is ${entry.shows_up.trim().length} chars, floor is ${LENGTH_FLOORS.lensShowsUp}`));
    }
    if (typeof entry.prompt === 'string' && entry.prompt.trim().length > 0) {
      if (entry.prompt.trim().length < LENGTH_FLOORS.lensPrompt) {
        issues.push(issue('error', 'too-short', `${path}.prompt`,
          `prompt is ${entry.prompt.trim().length} chars, floor is ${LENGTH_FLOORS.lensPrompt}`));
      }
      if (entry.prompt.indexOf('?') === -1) {
        issues.push(issue('warning', 'prompt-not-question', `${path}.prompt`,
          'prompt contains no question mark; contract is one reflective question'));
      }
    }

    ['view', 'shows_up', 'prompt'].forEach((field) => {
      if (typeof entry[field] === 'string') {
        issues.push(...scanProse(entry[field], `${path}.${field}`));
      }
    });
  });

  return makeResult(issues);
}

module.exports = {
  FC1_BANNED_PHRASES,
  AI_TIPOFF_PHRASES,
  JARGON_AXIS_IDS,
  LENGTH_FLOORS,
  CANONICAL_LENSES,
  scanProse,
  validateCall1Output,
  validateCall2Output,
};
