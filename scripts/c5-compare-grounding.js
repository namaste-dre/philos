// C-5 controlled comparison harness (2026-08-02): default Call 1 prompt vs
// the staged C-2 grounded Call 1 prompt, on the same profile context.
// Extended 2026-08-03 (D158) to also compare Call 2 (the five "In the
// World" lenses) against its staged grounded builder - pass --call2.
// Call 1 remains the default when --call2 is absent, byte-identical to
// this harness's pre-D158 behavior.
//
// LOCAL-ONLY. Not a serverless function, never deployed as behavior, never
// referenced by any product surface. Loads api/generate.js's __testables__
// via node:vm SourceTextModule (the same technique api/generate.test.js
// uses), so the exact deployed prompt builders are under comparison, not
// copies.
//
// MODES
//   Dry-run (DEFAULT): makes ZERO provider calls. For each profile it
//   builds both prompt variants and prints safe comparison metadata only -
//   for Call 1: fingerprint/grounding axes, glossary count; for Call 2:
//   which lenses received grounding text; both: prompt hashes and
//   character counts. Full prompts are never printed by default.
//
//   Paid mode: runs paired default-vs-grounded generations against the
//   real provider. Call 1 and Call 2 each have their OWN independent
//   fail-closed gate - satisfying one never satisfies the other. Call 1
//   is HARD-GATED behind ALL of:
//     1. the --paid CLI flag,
//     2. the environment variable C5_ANDRE_AUTHORIZED=YES,
//     3. a present ANTHROPIC_API_KEY (missing key fails closed),
//   and, procedurally, Andre's explicit authorization line: "Go ahead
//   with C-5 paid test generations." Call 2 (--call2 --paid) is gated the
//   same way but requires C5_CALL2_ANDRE_AUTHORIZED=YES and Andre's
//   distinct line: "Go ahead with the Call 2 grounding paid test
//   generations." Running paid mode without the matching authorization is
//   a process violation even if the technical gates are satisfied.
//
// PAID-MODE OUTPUT: written only to local-evidence/c5/ (gitignored, never
// committed). Nothing is written to Supabase, nothing is saved as a
// report, no generated prose is committed or logged to the console beyond
// the local evidence files themselves.
//
// REAL PROFILES: pass --profiles <path.json> with an array of profile
// objects in the exact A0.1 context shape (see --print-schema). Without
// --profiles, the harness uses clearly-labeled SYNTHETIC fixtures - fine
// for testing the harness, but synthetic runs do not count as C-5/D158
// evidence.
//
// Run with:
//   node --experimental-vm-modules scripts/c5-compare-grounding.js                              (Call 1 dry-run, synthetic)
//   node --experimental-vm-modules scripts/c5-compare-grounding.js --profiles p.json            (Call 1 dry-run, real)
//   node --experimental-vm-modules scripts/c5-compare-grounding.js --call2 --profiles p.json    (Call 2 dry-run, real)
//   node --experimental-vm-modules scripts/c5-compare-grounding.js --print-schema               (show profile JSON shape)
//   C5_ANDRE_AUTHORIZED=YES node --experimental-vm-modules scripts/c5-compare-grounding.js --profiles p.json --paid
//   C5_CALL2_ANDRE_AUTHORIZED=YES node --experimental-vm-modules scripts/c5-compare-grounding.js --profiles p.json --call2 --paid
//
// Tests: scripts/c5-compare-grounding.test.js (run with --experimental-vm-modules).

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const MODEL = 'claude-sonnet-5';      // mirrors api/generate.js's server pin
const MAX_TOKENS_CALL1 = 1500;        // mirrors MAX_TOKENS_BY_CALL[1]
// D158 (2026-08-03): the harness now also supports comparing Call 2
// (the five "In the World" lenses) against its staged grounded builder,
// following the exact same pattern C-5 established for Call 1. Every
// existing Call 1 function/export keeps its exact name and default
// behavior for backward compatibility with the existing test suite;
// Call 2 support is additive, selected via an explicit callType
// parameter (default 1) or the --call2 CLI flag.
const MAX_TOKENS_BY_CALL = { 1: MAX_TOKENS_CALL1, 2: 1800 }; // mirrors api/generate.js MAX_TOKENS_BY_CALL
const EVIDENCE_DIR = path.join(__dirname, '..', 'local-evidence', 'c5');

async function loadTestables() {
  const filePath = path.join(__dirname, '..', 'api', 'generate.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const mod = new vm.SourceTextModule(source, { identifier: filePath });
  await mod.link(() => { throw new Error('api/generate.js must not import anything'); });
  await mod.evaluate();
  return mod.namespace.__testables__;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// The exact A0.1 context shape api/generate.js validates, plus a label.
const PROFILE_SCHEMA_EXAMPLE = {
  label: 'profile-1 (short human label, appears in metadata only)',
  userName: 'FirstName (optional; defaults to "this person"; used only inside the prompt text, never printed)',
  context: {
    axisScores: [{ axis: 'naturalism', score: 6.0 }, { axis: '<all 32 axes, one entry each>', score: 4.0 }],
    archetypeId: '1A',
    isLiminal: false,
    secondaryArchetypeId: null,
    contradictions: [{ id: 'C01', strength: 0.8 }],
    fingerprintAxes: [{ axis: 'naturalism', direction: 'right' }, { axis: '<exactly 5 entries>', direction: 'left' }],
  },
};

// Synthetic fixtures: harness-test material only. Deliberately labeled so
// their output can never be mistaken for C-5 evidence.
function syntheticProfiles(testables) {
  const axes = testables.AXIS_IDS;
  const mk = (label, seed, archetypeId, fps) => ({
    label: `SYNTHETIC-${label} (not C-5 evidence)`,
    userName: 'this person',
    context: {
      axisScores: axes.map((axis, i) => ({ axis, score: 1 + (((seed * 7 + i * 13) % 61) / 10) })),
      archetypeId,
      isLiminal: false,
      secondaryArchetypeId: null,
      contradictions: [],
      fingerprintAxes: fps.map(([axis, direction]) => ({ axis, direction })),
    },
  });
  return [
    mk('A', 3, '1A', [['naturalism', 'right'], ['determinism', 'right'], ['meaning', 'left'], ['science', 'right'], ['religion', 'right']]),
    mk('B', 5, '8B', [['uncertainty', 'right'], ['self', 'left'], ['freewill_practice', 'left'], ['meaning_practice', 'right'], ['epistemic_humility', 'right']]),
  ];
}

// Validates and normalizes one profile through api/generate.js's own
// validateContext - a profile the real endpoint would reject is rejected
// here too, for the same reasons.
function prepareProfile(profile, testables) {
  if (!profile || typeof profile !== 'object') throw new Error('profile must be an object');
  const ctx = testables.validateContext(profile.context);
  if (!ctx) throw new Error(`profile "${profile.label || '(unlabeled)'}" failed A0.1 context validation`);
  const arch = testables.ARCHETYPE_REGISTRY[ctx.archetypeId];
  const promptCtx = {
    userName: typeof profile.userName === 'string' && profile.userName.trim() ? profile.userName.trim() : 'this person',
    axisDump: testables.axisDumpFrom(ctx.axisMap),
    fingerprintSummary: testables.fingerprintSummaryFrom(ctx.fingerprintAxes),
    contradictionSummary: testables.contradictionSummaryFrom(ctx.contradictions),
    liminalNote: testables.liminalNoteFrom(ctx.isLiminal, ctx.archetypeId, ctx.secondaryArchetypeId),
    archFamily: arch.family,
    archVariant: arch.variant,
  };
  return { ctx, promptCtx };
}

// Builds the paired comparison for one profile. Pure; no provider calls.
// callType defaults to 1 (Call 1, the original C-5 comparison) for exact
// backward compatibility. callType 2 compares Call 2 (D158) instead -
// every non-mid axis across all five lens pools, not a single fingerprint.
function buildComparison(profile, testables, callType = 1) {
  const { ctx, promptCtx } = prepareProfile(profile, testables);
  if (callType === 2) {
    const byLens = testables.call2GroundingTextByLens(ctx.axisMap);
    const call2Ctx = { userName: promptCtx.userName, axisDump: promptCtx.axisDump, archFamily: promptCtx.archFamily, archVariant: promptCtx.archVariant };
    const defaultPrompt = testables.buildCall2Prompt(call2Ctx);
    const groundedPrompt = testables.buildGroundedCall2Prompt(call2Ctx, byLens);
    const groundedLenses = Object.keys(byLens).filter((k) => byLens[k]);
    return {
      label: profile.label || '(unlabeled)',
      callType: 2,
      groundedLenses,
      lensAxisCounts: Object.fromEntries(groundedLenses.map((k) => [k, byLens[k].split('\n').filter((l) => !l.startsWith('  ')).length])),
      defaultHash: sha256(defaultPrompt),
      groundedHash: sha256(groundedPrompt),
      defaultChars: defaultPrompt.length,
      groundedChars: groundedPrompt.length,
      c4ValidationApplicable: true, // lib/report-output-validation.js's validateCall2Output covers this shape
      _defaultPrompt: defaultPrompt,   // internal to paid mode; never printed in dry-run
      _groundedPrompt: groundedPrompt, // internal to paid mode; never printed in dry-run
    };
  }
  const groundingText = testables.groundingContextFrom(ctx.axisMap, ctx.fingerprintAxes);
  const defaultPrompt = testables.buildCall1Prompt(promptCtx);
  const groundedPrompt = testables.buildGroundedCall1Prompt(promptCtx, groundingText);
  const glossaryCount = groundingText.split('\n').filter((l) => l.startsWith('- ')).length;
  return {
    label: profile.label || '(unlabeled)',
    callType: 1,
    fingerprintAxes: ctx.fingerprintAxes.map((f) => f.axis),
    groundingAxes: ctx.fingerprintAxes.filter((f) => groundingText.includes(testables.GROUNDING_DATA[f.axis].label)).map((f) => f.axis),
    glossaryCount,
    defaultHash: sha256(defaultPrompt),
    groundedHash: sha256(groundedPrompt),
    defaultChars: defaultPrompt.length,
    groundedChars: groundedPrompt.length,
    c4ValidationApplicable: true, // lib/report-output-validation.js validates call-1-shaped output post-parse
    _defaultPrompt: defaultPrompt,   // internal to paid mode; never printed in dry-run
    _groundedPrompt: groundedPrompt, // internal to paid mode; never printed in dry-run
  };
}

function dryRunMetadata(comparison) {
  const { _defaultPrompt, _groundedPrompt, ...safe } = comparison;
  return safe;
}

// Paid-mode gate: every check fails closed, loudly naming the missing gate.
// callType defaults to 1 so the existing Call 1 gate (env var, message
// text) is byte-identical to before D158. callType 2 requires its own,
// independent env var and its own distinct authorization line, so
// leftover Call 1 authorization in the environment can never accidentally
// satisfy a Call 2 paid run, or vice versa.
function assertPaidAuthorized({ paidFlag, env, callType = 1 }) {
  const AUTH_LINE = callType === 2
    ? 'Go ahead with the Call 2 grounding paid test generations.'
    : 'Go ahead with C-5 paid test generations.';
  const AUTH_ENV_VAR = callType === 2 ? 'C5_CALL2_ANDRE_AUTHORIZED' : 'C5_ANDRE_AUTHORIZED';
  if (!paidFlag) {
    throw new Error(`Paid mode requires the explicit --paid flag. Paid generations require Andre's explicit authorization: "${AUTH_LINE}"`);
  }
  if ((env[AUTH_ENV_VAR] || '') !== 'YES') {
    throw new Error(`Paid mode requires ${AUTH_ENV_VAR}=YES in the environment. Paid generations require Andre's explicit authorization: "${AUTH_LINE}"`);
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('Paid mode fails closed: ANTHROPIC_API_KEY is not set.');
  }
}

async function callProvider(prompt, apiKey, fetchImpl, maxTokens = MAX_TOKENS_CALL1) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    // Same server-owned parameters as the matching api/generate.js call:
    // pinned model, matching max_tokens, thinking disabled, no sampling parameters.
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`provider error: HTTP ${res.status}`);
  const data = await res.json();
  return (data.content && data.content[0] && data.content[0].text) || '';
}

// Parses Call 1 output the same way production does: the exact
// repairJSONStringControlChars function is extracted from index.html (vm
// technique, so the deployed repair is used, not a copy) and applied
// before parsing - the provider occasionally emits raw control characters
// inside JSON string values (a known defect class the live client
// repairs), and the first C-5 run needed a post-hoc repair script for 2
// of 6 outputs because this parser lacked it. Fixed per Lyra's
// pre-activation directive; the post-hoc script is no longer needed.
function loadProductionJsonRepair() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sigRe = /function\s+repairJSONStringControlChars\s*\([^)]*\)\s*\{/;
  const m = sigRe.exec(html);
  if (!m) throw new Error('repairJSONStringControlChars not found in index.html');
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < html.length) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') depth--;
    i++;
  }
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(html.slice(m.index, i) + '\nthis.repair = repairJSONStringControlChars;').runInContext(sandbox);
  return sandbox.repair;
}
const productionJsonRepair = loadProductionJsonRepair();

function parseCall1Output(raw) {
  const clean = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  try { return { parsed: JSON.parse(productionJsonRepair(clean)), parseError: null }; }
  catch (e) { return { parsed: null, parseError: e.message }; }
}

async function runPaid(profiles, testables, { env = process.env, fetchImpl = fetch, paidFlag = false, callType = 1 } = {}) {
  assertPaidAuthorized({ paidFlag, env, callType });
  const { validateCall1Output, validateCall2Output } = require('../lib/report-output-validation.js');
  const validate = callType === 2 ? validateCall2Output : validateCall1Output;
  const maxTokens = MAX_TOKENS_BY_CALL[callType];
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const results = [];
  for (const profile of profiles) {
    const cmp = buildComparison(profile, testables, callType);
    const record = { ...dryRunMetadata(cmp), variants: {} };
    for (const [variant, prompt] of [['default', cmp._defaultPrompt], ['grounded', cmp._groundedPrompt]]) {
      const raw = await callProvider(prompt, env.ANTHROPIC_API_KEY, fetchImpl, maxTokens);
      const { parsed, parseError } = parseCall1Output(raw);
      const validation = parsed ? validate(parsed) : null;
      record.variants[variant] = {
        parseError,
        validation: validation ? {
          ok: validation.ok,
          errors: validation.errors.map((i) => ({ code: i.code, path: i.path })),
          warnings: validation.warnings.map((i) => ({ code: i.code, path: i.path })),
        } : null,
      };
      // Full prose goes ONLY into the local evidence file, never stdout.
      const fileSafeLabel = (profile.label || 'unlabeled').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60);
      const outPath = path.join(EVIDENCE_DIR, `${stamp}_call${callType}_${fileSafeLabel}_${variant}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ label: profile.label, callType, variant, promptHash: sha256(prompt), raw, parsed, validation }, null, 2), 'utf8');
      record.variants[variant].evidenceFile = outPath;
    }
    results.push(record);
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--print-schema')) {
    console.log(JSON.stringify(PROFILE_SCHEMA_EXAMPLE, null, 2));
    return;
  }
  const testables = await loadTestables();
  const callType = args.includes('--call2') ? 2 : 1;

  let profiles;
  const pIdx = args.indexOf('--profiles');
  if (pIdx !== -1 && args[pIdx + 1]) {
    profiles = JSON.parse(fs.readFileSync(args[pIdx + 1], 'utf8'));
    if (!Array.isArray(profiles)) throw new Error('--profiles file must contain a JSON array');
    console.log(`[c5] loaded ${profiles.length} profile(s) from ${args[pIdx + 1]}`);
  } else {
    profiles = syntheticProfiles(testables);
    console.log('[c5] no --profiles given: using SYNTHETIC fixtures (harness test only, NOT C-5/D158 evidence)');
  }

  if (args.includes('--paid')) {
    const results = await runPaid(profiles, testables, { env: process.env, fetchImpl: fetch, paidFlag: true, callType });
    console.log(`[c5] PAID call${callType} comparison complete. Evidence written under local-evidence/c5/ (untracked).`);
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`[c5] DRY-RUN, call${callType} (zero provider calls). Metadata only:`);
    for (const profile of profiles) {
      console.log(JSON.stringify(dryRunMetadata(buildComparison(profile, testables, callType))));
    }
    if (callType === 2) {
      console.log('[c5] To run paid comparisons, Andre must explicitly authorize with: "Go ahead with the Call 2 grounding paid test generations."');
      console.log('[c5] Then: C5_CALL2_ANDRE_AUTHORIZED=YES node --experimental-vm-modules scripts/c5-compare-grounding.js --profiles <file> --call2 --paid');
    } else {
      console.log('[c5] To run paid comparisons, Andre must explicitly authorize with: "Go ahead with C-5 paid test generations."');
      console.log('[c5] Then: C5_ANDRE_AUTHORIZED=YES node --experimental-vm-modules scripts/c5-compare-grounding.js --profiles <file> --paid');
    }
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('[c5] ' + e.message); process.exitCode = 1; });
}

module.exports = {
  loadTestables, prepareProfile, buildComparison, dryRunMetadata,
  assertPaidAuthorized, runPaid, parseCall1Output, syntheticProfiles,
  PROFILE_SCHEMA_EXAMPLE, EVIDENCE_DIR, MAX_TOKENS_BY_CALL,
};
