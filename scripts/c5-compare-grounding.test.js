// C-5 comparison harness tests (2026-08-02).
//
// Proves the harness's safety properties before any paid mode can exist:
// dry-run makes zero provider calls, paid mode is double-gated (flag +
// env) and fails closed on a missing API key, the default prompt path is
// byte-equivalent to api/generate.js's own default builder, the grounded
// path uses the staged C-2 builder, paired metadata comes from one shared
// context, no production surface references the harness or the grounded
// path, and nothing about the production prompt selection changed.
//
// Run with:
//   node --experimental-vm-modules scripts/c5-compare-grounding.test.js

'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const harness = require('./c5-compare-grounding.js');

async function run() {
  const testables = await harness.loadTestables();
  const profiles = harness.syntheticProfiles(testables);

  // ---- 1. Dry-run makes zero provider calls ----
  {
    const originalFetch = global.fetch;
    let called = 0;
    global.fetch = () => { called++; throw new Error('provider must not be called in dry-run'); };
    let threw = false;
    let comparisons = [];
    try {
      comparisons = profiles.map((p) => harness.buildComparison(p, testables));
    } catch (e) { threw = true; }
    global.fetch = originalFetch;
    ok('dry-run comparison builds never touch the provider (fetch stubbed to throw, zero calls observed)',
      !threw && called === 0 && comparisons.length === 2);
  }

  // ---- 2. Paid mode is double-gated and fails closed ----
  {
    const env = { C5_ANDRE_AUTHORIZED: 'YES', ANTHROPIC_API_KEY: 'k' };
    let msg = '';
    try { harness.assertPaidAuthorized({ paidFlag: false, env }); } catch (e) { msg = e.message; }
    ok('paid mode refuses to run without the --paid flag', msg.includes('--paid'));
    ok('the refusal names Andre\'s explicit authorization', msg.includes('Go ahead with C-5 paid test generations'));

    msg = '';
    try { harness.assertPaidAuthorized({ paidFlag: true, env: { ANTHROPIC_API_KEY: 'k' } }); } catch (e) { msg = e.message; }
    ok('paid mode refuses to run without C5_ANDRE_AUTHORIZED=YES', msg.includes('C5_ANDRE_AUTHORIZED'));

    msg = '';
    try { harness.assertPaidAuthorized({ paidFlag: true, env: { C5_ANDRE_AUTHORIZED: 'YES' } }); } catch (e) { msg = e.message; }
    ok('paid mode fails closed on a missing ANTHROPIC_API_KEY', msg.includes('ANTHROPIC_API_KEY'));

    let threwOnFull = false;
    try { harness.assertPaidAuthorized({ paidFlag: true, env }); } catch (e) { threwOnFull = true; }
    ok('all three gates present passes the authorization check', !threwOnFull);
  }

  // ---- 3. runPaid itself enforces the gate (defense in depth) ----
  {
    let msg = '';
    try {
      await harness.runPaid(profiles, testables, { env: {}, fetchImpl: () => { throw new Error('must not reach provider'); }, paidFlag: false });
    } catch (e) { msg = e.message; }
    ok('runPaid without gates throws before any provider access', msg.includes('--paid'));
  }

  // ---- 4. Default prompt path is byte-equivalent to the default builder ----
  {
    const profile = profiles[0];
    const { promptCtx, ctx } = harness.prepareProfile(profile, testables);
    const cmp = harness.buildComparison(profile, testables);
    ok('default prompt is byte-equivalent to api/generate.js buildCall1Prompt for the same context',
      cmp._defaultPrompt === testables.buildCall1Prompt(promptCtx));
    const grounding = testables.groundingContextFrom(ctx.axisMap, ctx.fingerprintAxes);
    ok('grounded prompt is byte-equivalent to the staged C-2 builder for the same context',
      cmp._groundedPrompt === testables.buildGroundedCall1Prompt(promptCtx, grounding));
    ok('grounded prompt actually carries the grounding section',
      cmp._groundedPrompt.includes('GROUNDING CONTEXT (reviewed interpretations'));
    ok('default and grounded prompts differ (the comparison is real)',
      cmp.defaultHash !== cmp.groundedHash && cmp.groundedChars > cmp.defaultChars);
  }

  // ---- 5. Paired metadata from one shared context, prose kept out ----
  {
    const cmp = harness.buildComparison(profiles[0], testables);
    const meta = harness.dryRunMetadata(cmp);
    ok('metadata carries label, axes, glossary count, hashes, and char counts',
      typeof meta.label === 'string' && Array.isArray(meta.fingerprintAxes) && meta.fingerprintAxes.length === 5 &&
      Array.isArray(meta.groundingAxes) && typeof meta.glossaryCount === 'number' &&
      /^[0-9a-f]{64}$/.test(meta.defaultHash) && /^[0-9a-f]{64}$/.test(meta.groundedHash) &&
      meta.defaultChars > 0 && meta.groundedChars > 0 && meta.c4ValidationApplicable === true, meta);
    ok('dry-run metadata never carries prompt text',
      !('_defaultPrompt' in meta) && !('_groundedPrompt' in meta) &&
      !JSON.stringify(meta).includes('You are writing a philosophical profile'));
    ok('synthetic fixtures are labeled as not-C-5 evidence', meta.label.includes('SYNTHETIC') && meta.label.includes('not C-5 evidence'));
  }

  // ---- 6. Profile validation runs through the real A0.1 validator ----
  {
    let msg = '';
    try { harness.prepareProfile({ label: 'bad', context: { axisScores: [] } }, testables); } catch (e) { msg = e.message; }
    ok('a profile the real endpoint would reject is rejected by the harness for the same reason',
      msg.includes('A0.1 context validation'));
  }

  // ---- 7. Production surfaces untouched ----
  {
    const genSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'generate.js'), 'utf8');
    const handlerSection = genSource.slice(
      genSource.indexOf('export default async function handler'),
      genSource.indexOf('export const __testables__'));
    // 2026-08-02: grounded Call 1 was activated, so the handler now does
    // reference the grounded path. The harness's own contract is unchanged
    // - it still compares the two builders directly, and its "default" arm
    // remains buildCall1Prompt regardless of which one production runs.
    ok('production handler references the grounded path (activated)',
      handlerSection.length > 0 && handlerSection.includes('buildGroundedCall1Prompt') && handlerSection.includes('groundingContextFrom'));
    ok('PROMPT_BUILDERS remains unchanged (source assertion)',
      genSource.includes('const PROMPT_BUILDERS = { 1: buildCall1Prompt, 2: buildCall2Prompt };'));
    ok('api/generate.js does not reference the harness', !genSource.includes('c5-compare'));
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    ok('index.html does not reference the harness', !html.includes('c5-compare'));
    // Post-activation: index.html legitimately carries the grounding
    // section as the prompt-hash mirror, but only ever as the {grounding}
    // placeholder - real band evidence must stay server-side.
    ok('index.html mirrors the grounding section without real band evidence',
      html.includes('GROUNDING CONTEXT (reviewed interpretations') &&
      html.includes('{grounding}') && !html.includes("This person's position:"));
  }

  // ---- 7b. Parser repairs the known provider control-character defect ----
  // The first C-5 paid run needed a post-hoc repair script for 2 of 6
  // outputs because parseCall1Output lacked the production repair. It now
  // applies the exact repairJSONStringControlChars extracted from
  // index.html before parsing, so the same defect class production can
  // repair parses here too (Lyra's pre-activation directive).
  {
    const IDENT = 'A first line.' + String.fromCharCode(10) + 'A second line after a RAW newline inside the JSON string.';
    const rawBroken = '{"identity":"' + IDENT + '"}';
    let plainParseFails = false;
    try { JSON.parse(rawBroken); } catch (e) { plainParseFails = true; }
    ok('the control-character fixture genuinely breaks plain JSON.parse', plainParseFails);
    const { parsed, parseError } = harness.parseCall1Output(rawBroken);
    ok('parseCall1Output repairs and parses the raw-control-character class production can repair',
      parseError === null && parsed && parsed.identity === IDENT, parseError);
    const withTab = harness.parseCall1Output('{"identity":"tab' + String.fromCharCode(9) + 'inside"}');
    ok('a raw tab inside a JSON string is repaired and parsed too',
      withTab.parseError === null && withTab.parsed.identity.includes(String.fromCharCode(9)));
    const fenced = harness.parseCall1Output('```json\n{"identity":"fenced ok"}\n```');
    ok('markdown fences are still stripped before repair and parse',
      fenced.parseError === null && fenced.parsed.identity === 'fenced ok');
    const hopeless = harness.parseCall1Output('not json at all');
    ok('genuinely unparseable output still reports a parse error rather than throwing',
      hopeless.parsed === null && typeof hopeless.parseError === 'string');
  }

  // ---- 8. Evidence isolation ----
  {
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    ok('local-evidence/ is gitignored (paid output can never be committed)', gitignore.includes('local-evidence/'));
    ok('the evidence dir constant points inside local-evidence',
      harness.EVIDENCE_DIR.includes('local-evidence'));
  }

  // ---- 9. Paid path mechanics with a mocked provider (no real calls) ----
  {
    const env = { C5_ANDRE_AUTHORIZED: 'YES', ANTHROPIC_API_KEY: 'test-key-not-real' };
    const seen = [];
    const IDENTITY = Array(5).fill('You tend to read situations carefully and act once the shape of the problem is clear to you. You weigh what you know against what you merely hope, and the difference matters to you.').join('\\n\\n');
    const fetchImpl = async (url, opts) => {
      seen.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ content: [{ text: `{"identity":"${IDENTITY}"}` }] }) };
    };
    const results = await harness.runPaid([profiles[0]], testables, { env, fetchImpl, paidFlag: true });
    ok('mocked paid run produces paired default/grounded results for one profile',
      results.length === 1 && results[0].variants.default && results[0].variants.grounded);
    ok('mocked paid run used the pinned model and server-owned parameters for both variants',
      seen.length === 2 && seen.every((b) => b.model === 'claude-sonnet-5' && b.max_tokens === 1500 && b.thinking && b.thinking.type === 'disabled'));
    ok('paid results carry C-4 validation summaries with codes/paths only',
      ['default', 'grounded'].every((v) => {
        const val = results[0].variants[v].validation;
        return val && typeof val.ok === 'boolean' &&
          [...val.errors, ...val.warnings].every((i) => Object.keys(i).sort().join(',') === 'code,path');
      }), results[0].variants);
    ok('evidence files land under local-evidence/c5',
      ['default', 'grounded'].every((v) => results[0].variants[v].evidenceFile.includes('local-evidence')));
    // Clean up the mocked-run evidence files so the test leaves no residue.
    ['default', 'grounded'].forEach((v) => { try { fs.unlinkSync(results[0].variants[v].evidenceFile); } catch (e) { /* already gone */ } });
  }

  // ---- 10. D158: Call 2 comparison mode (2026-08-03) ----
  // Everything above this point must stay byte-identical to pre-D158
  // behavior (proven by every test already passing unchanged). This
  // block proves Call 2 support is genuinely additive and independently
  // gated, not a weakening of the existing Call 1 gate.
  {
    const profile = profiles[0];

    // Dry-run, callType 2: zero provider calls, same as Call 1.
    const originalFetch = global.fetch;
    let called = 0;
    global.fetch = () => { called++; throw new Error('provider must not be called in dry-run'); };
    let threw = false;
    let cmp2 = null;
    try { cmp2 = harness.buildComparison(profile, testables, 2); } catch (e) { threw = true; }
    global.fetch = originalFetch;
    ok('call2 dry-run comparison never touches the provider', !threw && called === 0 && cmp2 !== null);

    // Byte-equivalence to the real Call 2 builders for the same context.
    const { ctx, promptCtx } = harness.prepareProfile(profile, testables);
    const call2Ctx = { userName: promptCtx.userName, axisDump: promptCtx.axisDump, archFamily: promptCtx.archFamily, archVariant: promptCtx.archVariant };
    ok('call2 default prompt is byte-equivalent to api/generate.js buildCall2Prompt for the same context',
      cmp2._defaultPrompt === testables.buildCall2Prompt(call2Ctx));
    const byLens = testables.call2GroundingTextByLens(ctx.axisMap);
    ok('call2 grounded prompt is byte-equivalent to the staged D158 builder for the same context',
      cmp2._groundedPrompt === testables.buildGroundedCall2Prompt(call2Ctx, byLens));

    // Metadata shape: label, callType, which lenses got grounded, hashes, char counts - no prompt text.
    const meta2 = harness.dryRunMetadata(cmp2);
    ok('call2 metadata carries callType 2, groundedLenses, hashes, and char counts, no prompt text',
      meta2.callType === 2 && Array.isArray(meta2.groundedLenses) &&
      /^[0-9a-f]{64}$/.test(meta2.defaultHash) && /^[0-9a-f]{64}$/.test(meta2.groundedHash) &&
      meta2.defaultChars > 0 && meta2.groundedChars > 0 && meta2.c4ValidationApplicable === true &&
      !('_defaultPrompt' in meta2) && !('_groundedPrompt' in meta2), meta2);

    // Default comparison (no callType arg) is still Call 1 - the CLI's
    // and every existing caller's default behavior is unchanged.
    const cmpDefault = harness.buildComparison(profile, testables);
    ok('buildComparison with no callType argument still defaults to Call 1 (unchanged)',
      cmpDefault.callType === 1 && cmpDefault._defaultPrompt === testables.buildCall1Prompt(promptCtx));

    // Independent gate: Call 2's authorization is genuinely separate from
    // Call 1's - satisfying one must never satisfy the other.
    let msg2 = '';
    try { harness.assertPaidAuthorized({ paidFlag: false, env: {}, callType: 2 }); } catch (e) { msg2 = e.message; }
    ok('call2 paid mode refuses without --paid, naming the distinct Call 2 authorization line',
      msg2.includes('--paid') && msg2.includes('Go ahead with the Call 2 grounding paid test generations'));

    msg2 = '';
    const call1OnlyEnv = { C5_ANDRE_AUTHORIZED: 'YES', ANTHROPIC_API_KEY: 'k' };
    try { harness.assertPaidAuthorized({ paidFlag: true, env: call1OnlyEnv, callType: 2 }); } catch (e) { msg2 = e.message; }
    ok('Call 1 authorization (C5_ANDRE_AUTHORIZED) does NOT satisfy the Call 2 gate',
      msg2.includes('C5_CALL2_ANDRE_AUTHORIZED'));

    let msg1 = '';
    const call2OnlyEnv = { C5_CALL2_ANDRE_AUTHORIZED: 'YES', ANTHROPIC_API_KEY: 'k' };
    try { harness.assertPaidAuthorized({ paidFlag: true, env: call2OnlyEnv, callType: 1 }); } catch (e) { msg1 = e.message; }
    ok('Call 2 authorization (C5_CALL2_ANDRE_AUTHORIZED) does NOT satisfy the Call 1 gate',
      msg1.includes('C5_ANDRE_AUTHORIZED'));

    const call2FullEnv = { C5_CALL2_ANDRE_AUTHORIZED: 'YES', ANTHROPIC_API_KEY: 'k' };
    let threwOnFullCall2 = false;
    try { harness.assertPaidAuthorized({ paidFlag: true, env: call2FullEnv, callType: 2 }); } catch (e) { threwOnFullCall2 = true; }
    ok('all three Call 2 gates present passes the Call 2 authorization check', !threwOnFullCall2);

    // Mocked paid path for Call 2: correct max_tokens (1800, not 1500),
    // correct validator (validateCall2Output), evidence isolation intact.
    const { validateCall2Output } = require('../lib/report-output-validation.js');
    const LENS_TEXT = 'You tend to notice the shape of a situation before you notice your feelings about it, and that ordering matters to how you respond.';
    const WORLD = JSON.stringify({ world: [
      { lens: 'The Self', icon: 'mirror', view: LENS_TEXT, shows_up: LENS_TEXT, prompt: 'What is one thing you are avoiding naming right now?' },
      { lens: 'Other People', icon: 'people', view: LENS_TEXT, shows_up: LENS_TEXT, prompt: 'Who did you judge too quickly this week?' },
      { lens: 'Relationships', icon: 'connect', view: LENS_TEXT, shows_up: LENS_TEXT, prompt: 'What have you not said out loud yet?' },
      { lens: 'Society', icon: 'city', view: LENS_TEXT, shows_up: LENS_TEXT, prompt: 'Where do you feel the pull between fixing and blaming?' },
      { lens: 'Life and Existence', icon: 'horizon', view: LENS_TEXT, shows_up: LENS_TEXT, prompt: 'What are you building meaning around right now?' },
    ] });
    const seen2 = [];
    const fetchImpl2 = async (url, opts) => {
      seen2.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ content: [{ text: WORLD }] }) };
    };
    const results2 = await harness.runPaid([profile], testables, { env: call2FullEnv, fetchImpl: fetchImpl2, paidFlag: true, callType: 2 });
    ok('mocked call2 paid run produces paired default/grounded results', results2.length === 1 && results2[0].variants.default && results2[0].variants.grounded);
    ok('mocked call2 paid run uses max_tokens 1800 (not Call 1\'s 1500)',
      seen2.length === 2 && seen2.every((b) => b.max_tokens === 1800 && b.model === 'claude-sonnet-5'));
    ok('mocked call2 paid run validates output with validateCall2Output (a well-formed 5-lens payload passes)',
      results2[0].variants.default.validation && results2[0].variants.default.validation.ok === true &&
      results2[0].variants.grounded.validation && results2[0].variants.grounded.validation.ok === true,
      results2[0].variants);
    ok('call2 evidence files land under local-evidence/c5 and are call-type-labeled',
      ['default', 'grounded'].every((v) => results2[0].variants[v].evidenceFile.includes('local-evidence') && results2[0].variants[v].evidenceFile.includes('_call2_')));
    ['default', 'grounded'].forEach((v) => { try { fs.unlinkSync(results2[0].variants[v].evidenceFile); } catch (e) { /* already gone */ } });

    // Production surfaces: the handler must never reference Call 2's
    // candidate functions either (mirrors test 7 above for Call 1).
    const genSource = fs.readFileSync(path.join(__dirname, '..', 'api', 'generate.js'), 'utf8');
    const handlerSection = genSource.slice(
      genSource.indexOf('export default async function handler'),
      genSource.indexOf('export const __testables__'));
    ok('production handler never references the D158 Call 2 grounding candidates',
      !handlerSection.includes('call2GroundingContextFrom') && !handlerSection.includes('buildGroundedCall2Prompt') &&
      !handlerSection.includes('GROUNDED_CALL2_ENABLED'));
    ok('api/generate.js does not reference the harness (unchanged)', !genSource.includes('c5-compare'));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
