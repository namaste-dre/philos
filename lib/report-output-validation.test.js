// C-4 tests: generated report output validation scaffold (2026-08-02).
//
// Proves the rule behavior of lib/report-output-validation.js on fixtures
// before any enforcement point exists: clean Call 1 / Call 2 output passes,
// each defect class is caught at the intended severity, the validator
// never throws and never mutates input, and the module remains inert
// (nothing in the product imports it).
//
// Run with:
//   node lib/report-output-validation.test.js

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const v = require('./report-output-validation.js');
const {
  FC1_BANNED_PHRASES, AI_TIPOFF_PHRASES, JARGON_AXIS_IDS, LENGTH_FLOORS,
  CANONICAL_LENSES, scanProse, validateCall1Output, validateCall2Output,
} = v;

// ---- Fixtures ----
// Realistic clean Call 1 output: 5 paragraphs, warm second-person prose,
// no dashes, no banned phrases, comfortably over the length floor. Written
// to resemble what the live prompt actually asks for.
const CLEAN_IDENTITY = [
  'You notice the machinery behind things. Where most people see a person making a choice, you see the long chain of causes that shaped the choice, and that lens rarely switches off. It makes you slower to blame and quicker to ask what conditions produced the outcome in front of you.',
  'You trust evidence over authority, but you hold your own conclusions to the same standard, which is rarer. When something you believe stops fitting the facts, your answers suggest you would rather update than defend. Certainty feels less important to you than being genuinely calibrated to how things are.',
  'Your moral energy points at structures rather than individuals. Unfairness that is built into a system angers you more than personal slights, and you tend to feel responsible for what you can see clearly that others miss. That responsibility can sit heavily when the problems are large and the levers are small.',
  'The central tension in how you operate is between understanding and acting. Seeing every cause can make action feel arbitrary, and from the inside this is likely to feel like hesitation you cannot fully explain.',
  'You come alive where honest thinking is welcome and the work changes conditions, not just appearances. Environments that run on performance and pretense are likely to drain you quietly.',
].join('\n\n');

function cleanWorldFixture() {
  return {
    world: [
      { lens: 'The Self', icon: 'mirror', view: 'You experience your own mind as something shaped by history rather than springing from nowhere. That gives you patience with yourself on good days and a strange detachment on hard ones.', shows_up: 'In practice you tend to narrate your own behaviour in terms of causes, which helps you change habits but can delay simply deciding.', prompt: 'What is one choice this week you could make before fully explaining it to yourself?' },
      { lens: 'Other People', icon: 'people', view: 'You extend to other people the same causal understanding you apply to yourself, and your answers suggest you find blame less interesting than comprehension. People sense that you are unusually hard to scandalize.', shows_up: 'You are likely the person others confess to, because you meet disclosure with curiosity rather than judgment.', prompt: 'Who in your life have you quietly explained rather than actually forgiven?' },
      { lens: 'Relationships', icon: 'connect', view: 'Connection for you runs through honesty rather than ritual, and your answers suggest you would rather have one true conversation than ten pleasant ones. Belonging that requires pretending exhausts you.', shows_up: 'You tend to build a small number of deep ties and to let the rest stay light without guilt about it.', prompt: 'What is one thing you have not said to someone close to you because the moment never felt right?' },
      { lens: 'Society', icon: 'city', view: 'You read society as a set of designed systems rather than a natural order, which means nothing about it feels inevitable to you. Your answers suggest that where others see how things are, you see how things were built.', shows_up: 'Day to day this makes you allergic to arguments from tradition alone, and patient with arguments from evidence.', prompt: 'Which system that frustrates you have you actually traced to its design, rather than its people?' },
      { lens: 'Life and Existence', icon: 'horizon', view: 'You hold that meaning is built rather than found, and your answers suggest this conclusion cost you something once. What remains is a quiet commitment that does not need cosmic backing to keep going.', shows_up: 'The texture of your days likely favours work and people that would matter even if nothing ultimately does.', prompt: 'What are you building right now that would still feel worth it if no one ever noticed?' },
    ],
  };
}

// ---- 1. Clean fixtures pass ----
{
  const r1 = validateCall1Output({ identity: CLEAN_IDENTITY });
  ok('clean Call 1 fixture passes with zero errors', r1.ok === true, r1.errors);
  ok('clean Call 1 fixture produces zero warnings', r1.warnings.length === 0, r1.warnings);

  const r2 = validateCall2Output(cleanWorldFixture());
  ok('clean Call 2 fixture passes with zero errors', r2.ok === true, r2.errors);
  ok('clean Call 2 fixture produces zero warnings', r2.warnings.length === 0, r2.warnings);
}

// ---- 2. Structural failures: missing/wrong-typed fields ----
{
  ok('null Call 1 input fails without throwing', validateCall1Output(null).ok === false);
  ok('array Call 1 input fails without throwing', validateCall1Output([]).ok === false);
  ok('missing identity fails', validateCall1Output({}).ok === false);
  ok('empty identity fails', validateCall1Output({ identity: '   ' }).ok === false);
  ok('non-string identity fails', validateCall1Output({ identity: 42 }).ok === false);
  const r = validateCall1Output({});
  ok('missing identity is reported as missing-field at call1.identity',
    r.errors.some((i) => i.code === 'missing-field' && i.path === 'call1.identity'), r.errors);

  ok('null Call 2 input fails without throwing', validateCall2Output(null).ok === false);
  ok('missing world fails', validateCall2Output({}).ok === false);
  const w4 = cleanWorldFixture(); w4.world.pop();
  const r4 = validateCall2Output(w4);
  ok('4-lens world fails with lens-count', r4.errors.some((i) => i.code === 'lens-count'), r4.errors);

  const wMissing = cleanWorldFixture(); delete wMissing.world[2].prompt;
  const rMissing = validateCall2Output(wMissing);
  ok('a lens missing its prompt fails with missing-field at the exact path',
    rMissing.errors.some((i) => i.code === 'missing-field' && i.path === 'call2.world[2].prompt'), rMissing.errors);
}

// ---- 3. Length floors ----
{
  const short1 = validateCall1Output({ identity: 'Two short paragraphs only.\n\nNot nearly enough content to be a real report.' });
  ok('identity below the floor fails with too-short', short1.errors.some((i) => i.code === 'too-short'), short1.errors);

  const wShort = cleanWorldFixture();
  wShort.world[0].view = 'Too short.';
  const rShort = validateCall2Output(wShort);
  ok('a lens view below the floor fails with too-short at the exact path',
    rShort.errors.some((i) => i.code === 'too-short' && i.path === 'call2.world[0].view'), rShort.errors);

  ok('the floors themselves are exported and frozen',
    LENGTH_FLOORS.identity === 800 && Object.isFrozen(LENGTH_FLOORS));
}

// ---- 4. Paragraph contract ----
{
  const threePara = CLEAN_IDENTITY.split('\n\n').slice(0, 3).join('\n\n');
  const r3 = validateCall1Output({ identity: threePara });
  ok('3-paragraph identity is a warning, not an error (renders fine, contract deviation)',
    r3.errors.every((i) => i.code !== 'paragraph-count') &&
    r3.warnings.some((i) => i.code === 'paragraph-count'), r3.issues);

  const onePara = 'One single collapsed paragraph that is long enough to clear the total length floor. '.repeat(15);
  const r1p = validateCall1Output({ identity: onePara });
  ok('single-paragraph identity is an error (structure collapsed)',
    r1p.errors.some((i) => i.code === 'paragraph-count'), r1p.issues);
}

// ---- 5. Banned phrases: FC1 guard list + AI tip-offs, as warnings ----
{
  const withFC1 = CLEAN_IDENTITY + ' You have a refusal to let comfort outvote honesty.';
  const rFC1 = validateCall1Output({ identity: withFC1 });
  ok('an FC1 guard phrase is caught as a banned-phrase warning',
    rFC1.warnings.some((i) => i.code === 'banned-phrase' && i.detail.includes('FC1')), rFC1.issues);
  ok('an FC1 guard phrase does not hard-fail the output', rFC1.ok === true);

  const withTipoff = CLEAN_IDENTITY.replace('You notice the machinery', 'You delve into the machinery');
  const rTip = validateCall1Output({ identity: withTipoff });
  ok('an AI tip-off phrase ("delve") is caught as a banned-phrase warning',
    rTip.warnings.some((i) => i.code === 'banned-phrase' && i.detail.includes('delve')), rTip.issues);

  const rBoundary = validateCall1Output({ identity: CLEAN_IDENTITY.replace('You notice', 'Delvers notice') });
  ok('single-word tip-offs respect word boundaries ("Delvers" does not match "delve")',
    !rBoundary.warnings.some((i) => i.code === 'banned-phrase'), rBoundary.warnings);

  ok('both banned lists are exported and frozen',
    Object.isFrozen(FC1_BANNED_PHRASES) && Object.isFrozen(AI_TIPOFF_PHRASES) &&
    FC1_BANNED_PHRASES.length === 10 && AI_TIPOFF_PHRASES.length === 19);
}

// ---- 6. Dash violations ----
{
  const emDash = CLEAN_IDENTITY.replace('causes that shaped the choice', 'causes — the ones that shaped the choice');
  const rEm = validateCall1Output({ identity: emDash });
  ok('an em dash is an error (survived normalization)', rEm.errors.some((i) => i.code === 'dash'), rEm.issues);

  const enDash = cleanWorldFixture();
  enDash.world[1].view = enDash.world[1].view.replace('yourself, and', 'yourself – and');
  const rEn = validateCall2Output(enDash);
  ok('an en dash in a lens view is an error at the exact path',
    rEn.errors.some((i) => i.code === 'dash' && i.path === 'call2.world[1].view'), rEn.issues);
}

// ---- 7. Placeholder / undefined / artifact leakage ----
{
  const withUndef = validateCall1Output({ identity: CLEAN_IDENTITY + ' undefined' });
  ok('literal "undefined" is an undefined-leak error', withUndef.errors.some((i) => i.code === 'undefined-leak'));

  const withObj = validateCall1Output({ identity: CLEAN_IDENTITY + ' [object Object]' });
  ok('"[object Object]" is an undefined-leak error', withObj.errors.some((i) => i.code === 'undefined-leak'));

  const withTodo = validateCall1Output({ identity: CLEAN_IDENTITY + ' TODO expand this section.' });
  ok('placeholder text is a placeholder error', withTodo.errors.some((i) => i.code === 'placeholder'));

  const withEscape = validateCall1Output({ identity: CLEAN_IDENTITY + ' broken\\nescape' });
  ok('a surviving literal backslash-n is a repair-artifact error',
    withEscape.errors.some((i) => i.code === 'repair-artifact'), withEscape.issues);

  const withCtrl = validateCall1Output({ identity: CLEAN_IDENTITY + ' raw' + String.fromCharCode(7) + 'bell' });
  ok('a raw control character is a repair-artifact error',
    withCtrl.errors.some((i) => i.code === 'repair-artifact'), withCtrl.issues);

  const withFence = validateCall1Output({ identity: '```json\n' + CLEAN_IDENTITY });
  ok('a surviving markdown fence is a repair-artifact error',
    withFence.errors.some((i) => i.code === 'repair-artifact'), withFence.issues);

  const realNewlines = validateCall1Output({ identity: CLEAN_IDENTITY });
  ok('real newlines between paragraphs are NOT flagged as artifacts',
    !realNewlines.errors.some((i) => i.code === 'repair-artifact'));
}

// ---- 8. Jargon leaks ----
{
  const withJargon = validateCall1Output({ identity: CLEAN_IDENTITY.replace('Your moral energy', 'Your meaning_practice energy') });
  ok('a snake_case axis id in prose is a jargon-leak warning',
    withJargon.warnings.some((i) => i.code === 'jargon-leak' && i.detail.includes('meaning_practice')), withJargon.issues);
  ok('jargon list contains only snake_case ids (no common-word false-positive sources)',
    JARGON_AXIS_IDS.every((id) => id.includes('_')), JARGON_AXIS_IDS);
}

// ---- 9. Lens identity, order, icons, duplicates, prompts ----
{
  const wUnknown = cleanWorldFixture();
  wUnknown.world[0].lens = 'The Inner Child';
  const rU = validateCall2Output(wUnknown);
  ok('an unknown lens name is an unknown-lens error', rU.errors.some((i) => i.code === 'unknown-lens'), rU.errors);

  const wSwap = cleanWorldFixture();
  const tmp = wSwap.world[0]; wSwap.world[0] = wSwap.world[1]; wSwap.world[1] = tmp;
  const rS = validateCall2Output(wSwap);
  ok('reordered lenses are lens-order warnings, not errors (public share assigns icons positionally)',
    rS.ok === true && rS.warnings.some((i) => i.code === 'lens-order'), rS.issues);

  const wDup = cleanWorldFixture();
  wDup.world[1] = { ...wDup.world[0] };
  const rD = validateCall2Output(wDup);
  ok('a duplicated lens is a duplicate-lens error', rD.errors.some((i) => i.code === 'duplicate-lens'), rD.errors);

  const wIcon = cleanWorldFixture();
  wIcon.world[3].icon = 'horizon';
  const rI = validateCall2Output(wIcon);
  ok('a wrong icon for a lens is an icon-mismatch warning',
    rI.ok === true && rI.warnings.some((i) => i.code === 'icon-mismatch' && i.path === 'call2.world[3].icon'), rI.issues);

  const wNoQ = cleanWorldFixture();
  wNoQ.world[4].prompt = 'Think about what you are building right now and whether it would still feel worth it.';
  const rQ = validateCall2Output(wNoQ);
  ok('a prompt without a question mark is a prompt-not-question warning',
    rQ.ok === true && rQ.warnings.some((i) => i.code === 'prompt-not-question'), rQ.issues);

  ok('the canonical lens set is exported, frozen, and 5 long',
    Object.isFrozen(CANONICAL_LENSES) && CANONICAL_LENSES.length === 5 &&
    CANONICAL_LENSES[0].lens === 'The Self' && CANONICAL_LENSES[4].icon === 'horizon');
}

// ---- 10. Purity: no mutation, no throwing on hostile input ----
{
  function deepFreeze(o) {
    if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
    return o;
  }
  const frozen1 = deepFreeze({ identity: CLEAN_IDENTITY });
  let threw = false;
  try { validateCall1Output(frozen1); } catch (e) { threw = true; }
  ok('validateCall1Output never mutates (deep-frozen input does not throw)', !threw);

  const frozen2 = deepFreeze(cleanWorldFixture());
  threw = false;
  try { validateCall2Output(frozen2); } catch (e) { threw = true; }
  ok('validateCall2Output never mutates (deep-frozen input does not throw)', !threw);

  const snapshot = JSON.stringify(cleanWorldFixture());
  const input = cleanWorldFixture();
  validateCall2Output(input);
  ok('validateCall2Output leaves its input byte-identical', JSON.stringify(input) === snapshot);

  [undefined, 0, 'string', Symbol, () => {}].forEach((hostile) => {
    let t = false;
    try { validateCall1Output(hostile); validateCall2Output(hostile); } catch (e) { t = true; }
    if (t) threw = true;
  });
  ok('hostile non-object inputs never throw', !threw);
}

// ---- 11. Result shape ----
{
  const r = validateCall1Output({ identity: CLEAN_IDENTITY + ' You delve deeper.' });
  ok('result exposes ok/errors/warnings/issues consistently',
    r.ok === true && Array.isArray(r.errors) && Array.isArray(r.warnings) &&
    r.issues.length === r.errors.length + r.warnings.length);
  ok('every issue carries severity, code, path, and detail',
    r.issues.every((i) => ['error', 'warning'].includes(i.severity) &&
      typeof i.code === 'string' && typeof i.path === 'string' && typeof i.detail === 'string'));
  const sp = scanProse('Fine text with no issues at all.', 'x');
  ok('scanProse is exported and returns an empty array on clean text', Array.isArray(sp) && sp.length === 0);
}

// ---- 12. FC1 list parity with the live guard in index.belief-map.test.js ----
// The FC1 phrases here must stay byte-identical to the regression guard's
// own list - if FC1's guard ever changes, this fails loudly instead of the
// two lists drifting apart silently.
{
  const guardSrc = fs.readFileSync(path.join(__dirname, '..', 'index.belief-map.test.js'), 'utf8');
  const missing = FC1_BANNED_PHRASES.filter((p) => !guardSrc.includes(`'${p}'`));
  ok('every FC1 phrase here appears verbatim in index.belief-map.test.js\'s guard list', missing.length === 0, missing);
}

// ---- 13. Wiring shape: only the sanctioned client path references this ----
// module. Originally this was an inertness guard (nothing referenced the
// module at all); the C-4 enforcement wiring block (2026-08-02, Lyra-
// directed) deliberately ended that inertness on the CLIENT side only.
// The allowed referencers are now exactly: index.html (via the embed
// script's generated block), scripts/embed-report-validation.js (the
// generator), index.report-validation.test.js (the enforcement suite),
// and the local-only C-5 comparison harness (scripts/
// c5-compare-grounding.js + its test; added 2026-08-02 - paid mode
// applies the validator to generated outputs for evidence summaries,
// which is exactly the consumer role the validator was built for).
// api/*.js referencing it remains forbidden - in particular
// api/generate.js's zero-import containment contract must hold.
{
  const ALLOWED = ['index.html', 'embed-report-validation.js', 'report-validation.test.js', 'c5-compare-grounding.js', 'c5-compare-grounding.test.js'];
  const importers = [];
  const roots = ['api', 'lib', 'scripts', '.'];
  roots.forEach((dir) => {
    fs.readdirSync(path.join(__dirname, '..', dir)).forEach((f) => {
      if (!f.endsWith('.js') && !f.endsWith('.html')) return;
      const full = path.join(__dirname, '..', dir, f);
      if (fs.statSync(full).isDirectory()) return;
      if (full === __filename) return;
      const src = fs.readFileSync(full, 'utf8');
      if (src.includes('report-output-validation') && !full.endsWith('report-output-validation.js')) {
        importers.push({ file: path.join(dir, f), allowed: ALLOWED.some((a) => f.endsWith(a)) });
      }
    });
  });
  const unsanctioned = importers.filter((i) => !i.allowed);
  ok('only the sanctioned client wiring path references report-output-validation',
    unsanctioned.length === 0, unsanctioned);
  const apiRefs = importers.filter((i) => i.file.startsWith('api'));
  ok('no api/*.js file references report-output-validation (server containment holds)',
    apiRefs.length === 0, apiRefs);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
