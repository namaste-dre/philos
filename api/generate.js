export const config = { maxDuration: 60 };

// -- Constants --------------------------------------------
const ALLOWED_ORIGIN     = 'https://phil-os.thelifepm.com';
const DEV_EMAILS         = ['dre63052@gmail.com'];
const DEV_BYPASS_ENV_VAR = 'GENERATE_DEV_BYPASS'; // must be 'true' server-side AND email must match a verified session
const RATE_LIMIT         = 6;          // calls per window (3 report = 2 API calls each)
const RATE_WINDOW_HRS    = 24;
const MODEL              = 'claude-sonnet-5'; // server-pinned, never client-supplied
const MAX_BODY_CHARS     = 8000;       // oversized-payload guard
const MAX_CONTRADICTIONS = 42;         // total known contradiction rules
const FINGERPRINT_COUNT  = 5;

// -- A0.1 containment (GPT review repair) -----------------
// /api/generate previously trusted a client-supplied email as identity and
// accepted free-form prose fields (axisDump, fingerprintSummary,
// contradictionSummary) inserted directly into the provider prompt. Both
// gaps are closed here:
//   1. Identity now comes only from a verified Supabase session token in
//      the Authorization header. The request body carries no identity
//      field at all.
//   2. The context object is now a strictly typed data schema (axis ids +
//      numeric scores, an allowlisted archetype id, allowlisted
//      contradiction ids, booleans/enums) - never free text. All labels,
//      summaries, and prompt prose are generated here from trusted
//      registries and fixed templates, not from caller-supplied strings.
// This is still containment, not the B3 generation-boundary refactor.
const ALLOWED_KEYS = new Set(['callType', 'context']);
const CONTEXT_KEYS = new Set([
  'axisScores', 'archetypeId', 'isLiminal', 'secondaryArchetypeId',
  'contradictions', 'fingerprintAxes',
]);
const MAX_TOKENS_BY_CALL = { 1: 1500, 2: 1800 };

// -- Trusted registries (read-only display data, not measurement logic) --
// Copied verbatim from index.html's AXIS_META / CONTRADICTIONS / ARCHETYPES
// (labels, poles, titles, family/variant names only - no scores, weights,
// signature vectors, or scoring/keying functions). Used only to render
// prompt text from client-supplied ids; the measurement core itself is
// untouched.
const AXIS_LABELS = {
  naturalism: { label: 'Naturalism', poleL: 'Supernatural', poleR: 'Naturalist' },
  physicalism: { label: 'Physicalism', poleL: 'Non-physical mind', poleR: 'Physicalist' },
  realism: { label: 'Epistemic Realism', poleL: 'Anti-realist', poleR: 'Realist' },
  determinism: { label: 'Determinism', poleL: 'Free will', poleR: 'Hard determinism' },
  moral_ground: { label: 'Moral Realism', poleL: 'Anti-realist', poleR: 'Moral realist' },
  meaning: { label: 'Meaning Realism', poleL: 'Constructivist', poleR: 'Meaning realist' },
  teleology: { label: 'Teleology', poleL: 'No direction', poleR: 'Inherent purpose' },
  human_nature: { label: 'Human Nature', poleL: 'Constructed', poleR: 'Universal essence' },
  epistemic_method: { label: 'Epistemic Method', poleL: 'Revelation/intuition', poleR: 'Empirical' },
  social_ontology: { label: 'Social Ontology', poleL: 'Individualist', poleR: 'Structural/holist' },
  temporal_orientation: { label: 'Temporal Orientation', poleL: 'Past authority', poleR: 'Future potential' },
  moral_authority: { label: 'Moral Authority', poleL: 'Divine/tradition', poleR: 'Individual conscience' },
  epistemic_humility: { label: 'Epistemic Humility', poleL: 'Confident', poleR: 'Genuinely uncertain' },
  knowledge: { label: 'Knowledge Source', poleL: 'Intuition/revealed', poleR: 'Empirical' },
  science: { label: 'Science Trust', poleL: 'Skeptical', poleR: 'Trusting' },
  freewill_practice: { label: 'Free Will in Practice', poleL: 'Accountability-based', poleR: 'Causal/structural' },
  justice: { label: 'Justice', poleL: 'Desert-based', poleR: 'Rehabilitative' },
  ethics: { label: 'Ethics Engine', poleL: 'Deontological', poleR: 'Consequentialist' },
  religion: { label: 'Religion', poleL: 'Faith-positive', poleR: 'Anti-theist' },
  politics: { label: 'Politics', poleL: 'Individual/market', poleR: 'Structural/collective' },
  self: { label: 'Self', poleL: 'Authored/free', poleR: 'Causal/constructed' },
  moral_scope: { label: 'Moral Scope', poleL: 'Human-centric', poleR: 'All sentient' },
  meaning_practice: { label: 'Meaning Practice', poleL: 'Nihilism', poleR: 'Committed meaning' },
  society: { label: 'Society', poleL: 'Individualist', poleR: 'Collectivist' },
  responsibility: { label: 'Responsibility', poleL: 'Personal', poleR: 'Structural' },
  identity: { label: 'Identity', poleL: 'Essential', poleR: 'Constructed' },
  authority: { label: 'Authority', poleL: 'Deferential', poleR: 'Skeptical' },
  economics: { label: 'Economics', poleL: 'Free market', poleR: 'Redistributive' },
  uncertainty: { label: 'Uncertainty Tolerance', poleL: 'Low tolerance', poleR: 'High tolerance' },
  mind_consciousness: { label: 'Mind/Consciousness', poleL: 'Non-physical', poleR: 'Physical/explainable' },
  animal_ethics: { label: 'Animal Ethics', poleL: 'Human priority', poleR: 'Equal moral weight' },
  progress: { label: 'Progress', poleL: 'Pessimist', poleR: 'Optimist' },
};

const AXIS_IDS = ['naturalism', 'physicalism', 'realism', 'determinism', 'moral_ground', 'meaning', 'teleology', 'human_nature', 'epistemic_method', 'social_ontology', 'temporal_orientation', 'moral_authority', 'epistemic_humility', 'knowledge', 'science', 'freewill_practice', 'justice', 'ethics', 'religion', 'politics', 'self', 'moral_scope', 'meaning_practice', 'society', 'responsibility', 'identity', 'authority', 'economics', 'uncertainty', 'mind_consciousness', 'animal_ethics', 'progress'];
const AXIS_SET = new Set(AXIS_IDS);
const AXIS_COUNT = AXIS_IDS.length;

const CONTRADICTION_REGISTRY = {
  C01: { tier: 'A', title: 'Hard Determinism + Desert-Based Justice' },
  C02: { tier: 'A', title: 'Strong Naturalism + Non-Physical Mind' },
  C03: { tier: 'A', title: 'Anti-Realism + Moral Realism' },
  C04: { tier: 'A', title: 'Hard Determinism + Authored Self' },
  C05: { tier: 'B', title: 'Determinism + High Personal Responsibility' },
  C06: { tier: 'B', title: 'Constructed Meaning + Nihilism as Practice' },
  C07: { tier: 'B', title: 'Determinism + Punishment-Oriented Justice (Consistency Flag)' },
  C08: { tier: 'B', title: 'Hard Naturalism + Meaning Realism' },
  C09: { tier: 'B', title: 'Structural Politics + Free Market Economics' },
  C10: { tier: 'B', title: 'High Moral Scope + Human-Priority Animal Ethics' },
  C11: { tier: 'C', title: 'Hard Determinism + Strong Progress Pessimism (Interesting Tension)' },
  C12: { tier: 'C', title: 'Strong Realism + Constructed Identity (Interesting Tension)' },
  C13: { tier: 'A', title: 'Physicalism + Non-Physical Consciousness' },
  C14: { tier: 'A', title: 'Revelation/Intuition Epistemology + Strong Science Trust' },
  C15: { tier: 'A', title: 'Strong Teleology + Hard Naturalism' },
  C16: { tier: 'A', title: 'Divine Moral Authority + Atheism' },
  C17: { tier: 'B', title: 'Individualist Ontology + Collectivist Society' },
  C18: { tier: 'B', title: 'Authority Skepticism + Low Epistemic Humility' },
  C19: { tier: 'B', title: 'Universal Human Nature + Structural Responsibility' },
  C20: { tier: 'B', title: 'Knowledge Source / Epistemic Method Misalignment' },
  C21: { tier: 'B', title: 'Consequentialist Ethics + Desert-Based Justice' },
  C22: { tier: 'B', title: 'Past Authority + Progress Optimism' },
  C23: { tier: 'B', title: 'Low Uncertainty Tolerance + Low Epistemic Humility' },
  C24: { tier: 'B', title: 'Free Market Economics + Individualist Society' },
  C25: { tier: 'A', title: 'Hard Determinism + Full Accountability Practice' },
  C26: { tier: 'C', title: 'Faith-Positive Religion + Constructivist Meaning (Interesting Tension)' },
  C27: { tier: 'C', title: 'Anti-Realist Moral Ground + Deontological Ethics (Interesting Tension)' },
  C28: { tier: 'C', title: 'Authored Self + Essential Identity (Interesting Tension)' },
  C01b: { tier: 'C', title: 'Retributive Justice and the Grounds of Desert' },
  C02b: { tier: 'A', title: 'Strong Physicalism + Supernatural Worldview' },
  C06b: { tier: 'B', title: 'Objective Meaning Realism + Nihilist Practice' },
  C08b: { tier: 'C', title: 'Supernatural Worldview + Meaning Nihilism (Interesting Tension)' },
  C09b: { tier: 'B', title: 'Individualist Politics + Redistributive Economics' },
  C10b: { tier: 'B', title: 'Human-Priority Moral Scope + High Animal Ethics Weight' },
  C12b: { tier: 'C', title: 'Anti-Realist Epistemics + Essential Fixed Identity (Interesting Tension)' },
  C14b: { tier: 'B', title: 'Empiricist Epistemology + Science Skepticism' },
  C16b: { tier: 'A', title: 'Divine Moral Authority + Anti-Theism' },
  C17b: { tier: 'B', title: 'Collectivist Ontology + Individualist Social Preference' },
  C22b: { tier: 'C', title: 'Future-Orientation + Progress Pessimism (Interesting Tension)' },
  C26b: { tier: 'B', title: 'Anti-Theism + Objective Meaning Realism' },
  C41: { tier: 'B', title: 'Hard Physicalism + Meaning Realism' },
  C42: { tier: 'B', title: 'High Epistemic Humility + Strong Determinist Commitment' },
};

const ARCHETYPE_REGISTRY = {
  '1A': { family: 'The Determined Humanist', variant: 'The Activist' },
  '1B': { family: 'The Determined Humanist', variant: 'The Philosopher' },
  '1C': { family: 'The Determined Humanist', variant: 'The Pragmatist' },
  '1D': { family: 'The Determined Humanist', variant: 'The Quiet' },
  '1E': { family: 'The Determined Humanist', variant: 'The Reconstructed Believer' },
  '2A': { family: 'The Structural Reformer', variant: 'The Systemic Analyst' },
  '2B': { family: 'The Structural Reformer', variant: 'The Justice Architect' },
  '2C': { family: 'The Structural Reformer', variant: 'The Economic Radical' },
  '2D': { family: 'The Structural Reformer', variant: 'The Intersectional Analyst' },
  '2E': { family: 'The Structural Reformer', variant: 'The Empirical Progressive' },
  '3A': { family: 'The Rational Empiricist', variant: 'The Scientific Realist' },
  '3B': { family: 'The Rational Empiricist', variant: 'The Skeptic' },
  '3C': { family: 'The Rational Empiricist', variant: 'The Analytic Philosopher' },
  '3D': { family: 'The Rational Empiricist', variant: 'The Naturalist Ethicist' },
  '3E': { family: 'The Rational Empiricist', variant: 'The Pragmatist' },
  '4A': { family: 'The Existential Architect', variant: 'The Absurdist' },
  '4B': { family: 'The Existential Architect', variant: 'The Sartrean' },
  '4C': { family: 'The Existential Architect', variant: 'The Meaning Maker' },
  '4D': { family: 'The Existential Architect', variant: 'The Identity Builder' },
  '4E': { family: 'The Existential Architect', variant: 'The Relational Existentialist' },
  '5A': { family: 'The Moral Realist', variant: 'The Kantian' },
  '5B': { family: 'The Moral Realist', variant: 'The Virtue Ethicist' },
  '5C': { family: 'The Moral Realist', variant: 'The Natural Law' },
  '5D': { family: 'The Moral Realist', variant: 'The Cornell Realist' },
  '5E': { family: 'The Moral Realist', variant: 'The Constructivist' },
  '6A': { family: 'The Compassionate Collectivist', variant: 'The Care Ethicist' },
  '6B': { family: 'The Compassionate Collectivist', variant: 'The Animal Advocate' },
  '6C': { family: 'The Compassionate Collectivist', variant: 'The Ubuntu Thinker' },
  '6D': { family: 'The Compassionate Collectivist', variant: 'The Empathic Realist' },
  '6E': { family: 'The Compassionate Collectivist', variant: 'The Pacifist Reformer' },
  '7A': { family: 'The Principled Libertarian', variant: 'The Classical Liberal' },
  '7B': { family: 'The Principled Libertarian', variant: 'The Moral Individualist' },
  '7C': { family: 'The Principled Libertarian', variant: 'The Civil Liberties' },
  '7D': { family: 'The Principled Libertarian', variant: 'The Voluntaryist' },
  '7E': { family: 'The Principled Libertarian', variant: 'The Conservative Libertarian' },
  '8A': { family: 'The Stoic Naturalist', variant: 'The Classical Stoic' },
  '8B': { family: 'The Stoic Naturalist', variant: 'The Modern Stoic' },
  '8C': { family: 'The Stoic Naturalist', variant: 'The Contemplative' },
  '8D': { family: 'The Stoic Naturalist', variant: 'The Resilient Practitioner' },
  '8E': { family: 'The Stoic Naturalist', variant: 'The Scientific Buddhist' },
  '9A': { family: 'The Spiritual Naturalist', variant: 'The Panpsychist' },
  '9B': { family: 'The Spiritual Naturalist', variant: 'The Metaphysical Idealist' },
  '9C': { family: 'The Spiritual Naturalist', variant: 'The Religious Humanist' },
  '9D': { family: 'The Spiritual Naturalist', variant: 'The Dharmic Practitioner' },
  '9E': { family: 'The Spiritual Naturalist', variant: 'The Contemplative Agnostic' },
  '10A': { family: 'The Conservative Traditionalist', variant: 'The Religious Traditionalist' },
  '10B': { family: 'The Conservative Traditionalist', variant: 'The Burke' },
  '10C': { family: 'The Conservative Traditionalist', variant: 'The Social Conservative' },
  '10D': { family: 'The Conservative Traditionalist', variant: 'The Natural Law Conservative' },
  '10E': { family: 'The Conservative Traditionalist', variant: 'The Communitarian' },
  '11A': { family: 'The Pragmatic Centrist', variant: 'The Epistemic Pragmatist' },
  '11B': { family: 'The Pragmatic Centrist', variant: 'The Evidence-Based Moderate' },
  '11C': { family: 'The Pragmatic Centrist', variant: 'The Institutional Liberal' },
  '11D': { family: 'The Pragmatic Centrist', variant: 'The Reflective Traditionalist' },
  '11E': { family: 'The Pragmatic Centrist', variant: 'The Problem Solver' },
  '12A': { family: 'The Nihilist Reductionist', variant: 'The Honest Nihilist' },
  '12B': { family: 'The Nihilist Reductionist', variant: 'The Error Theorist' },
  '12C': { family: 'The Nihilist Reductionist', variant: 'The Eliminativist' },
  '12D': { family: 'The Nihilist Reductionist', variant: 'The Pessimist' },
  '12E': { family: 'The Nihilist Reductionist', variant: 'The Functional Nihilist' },
};

const AXIS_REFERENCE = `- naturalism 1=supernatural, 7=naturalist
- physicalism 1=non-physical mind, 7=physical mind
- realism 1=reality constructed by minds, 7=reality mind-independent
- determinism 1=genuine free will, 7=hard determinism
- moral_ground 1=ethics subjective/cultural, 7=moral facts objective
- meaning 1=meaning constructed, 7=meaning discovered/real
- teleology 1=no cosmic direction, 7=universe has inherent purpose
- human_nature 1=blank slate/context-shaped, 7=fixed universal human nature
- epistemic_method 1=revelation/faith primary, 7=empirical evidence primary
- social_ontology 1=society = individuals, 7=structures shape people fundamentally
- temporal_orientation 1=past tradition is authority, 7=future potential drives progress
- moral_authority 1=God/scripture is source, 7=individual conscience is source
- epistemic_humility 1=confident in views, 7=genuinely uncertain
- knowledge 1=truth via intuition/revelation, 7=truth via evidence/reason
- science 1=skeptical of consensus, 7=trusts scientific consensus
- freewill_practice 1=holds people accountable, 7=attributes behaviour to causes
- justice 1=desert/punishment-based, 7=rehabilitation/structural
- ethics 1=rule-based/deontological, 7=outcome-based/consequentialist
- religion 1=faith-positive, 7=anti-theist
- politics 1=individual/market solutions, 7=structural/collective solutions
- self 1=free author of choices, 7=product of causes
- moral_scope 1=human-centric, 7=all sentient life equal
- meaning_practice 1=nihilism in practice, 7=actively constructs meaning
- society 1=individualist, 7=collectivist
- responsibility 1=personal responsibility, 7=structural explanations
- identity 1=fixed essential identity, 7=constructed identity
- authority 1=deferential to institutions, 7=skeptical of authority
- economics 1=free market, 7=redistributive
- uncertainty 1=needs certainty, 7=comfortable with ambiguity
- mind_consciousness 1=consciousness non-physical/mysterious, 7=consciousness physical/explainable
- animal_ethics 1=human interests far outweigh animal, 7=animal suffering matters equally
- progress 1=pessimist about human progress, 7=optimist`;

function buildCall1Prompt(ctx) {
  return `You are writing a philosophical profile for ${ctx.userName}. Make them feel accurately described, in a way they recognise.

COMPLETE AXIS SCORES (1=left pole, 7=right pole):
${ctx.axisDump}

TOP 5 AXES: ${ctx.fingerprintSummary}
ARCHETYPE: ${ctx.archFamily} / ${ctx.archVariant}
CONTRADICTIONS: ${ctx.contradictionSummary}
${ctx.liminalNote}

AXIS REFERENCE:
${AXIS_REFERENCE}

PATTERN NOTES:
- meaning <=2 AND meaning_practice <=3: nihilism in practice
- meaning <=3 AND meaning_practice >=5: absurdism (Camus: meaning constructed but committed)
- self <=2 AND determinism >=5 AND meaning <=3: existentialist tension
- Name these as how they FEEL, not philosophical labels

WRITING RULES:
1. No jargon, no axis names, no scores in output
2. No careers, famous people, films, music, books
3. Do not repeat archetype name or variant
4. Write warmly and directly in second person, using "you" throughout. Claim only what their answers support.
5. The test is recognition: name the implications of their own answers back to them, more clearly than they would have put it themselves.
6. Cover how they think, how they feel about the world, how they decide, and what their answers suggest energises or drains them.
7. GROUNDING: every claim must trace back to the scores above. For anything about behaviour or feeling, stay tentative ("tends to", "likely", "your answers suggest"). Never invent specific incidents, habits, relationships, or what other people (friends, colleagues, family) notice or say about them.
8. No em dashes anywhere. Use but, and, so, because instead.
9. No colons introducing lists in narrative text. No bullet points.

Return ONLY valid JSON, with no markdown fences and no preamble:
{"identity":"5 paragraphs separated by \\n\\n. P1 (3 sentences): How does this person experience the world? What filter does everything pass through, what do they see that most people miss? Start with a specific observation. P2 (3 sentences): How they think and reason. Their relationship with certainty, evidence, authority, their own conclusions. P3 (3 sentences): Their moral and meaning landscape. Not abstract beliefs but how it is likely to show up: what their answers suggest makes them angry, what they feel responsible for. P4 (2 sentences): The central tension in their operating system. Name what this tension is likely to feel like from the inside. P5 (2 sentences): The conditions their answers suggest they come alive in, and the ones likely to quietly exhaust them.","alignment":[{"label":"Work","text":"2 sentences on structural conditions that fit or drain this profile: pace, autonomy, ambiguity, stakes."},{"label":"Relationships","text":"2 sentences on what this profile suggests they need and what they may under-offer without noticing."},{"label":"Decisions","text":"2 sentences on how their answers suggest they decide: what they optimise for, what they may tend to underweight."},{"label":"Conflict","text":"2 sentences on what their answers suggest they find triggering in conflict and the exit they may reach for."}]}`;
}

function buildCall2Prompt(ctx) {
  return `You are writing the "world lenses" section of a philosophical profile for ${ctx.userName}.

AXIS SCORES: ${ctx.axisDump}
ARCHETYPE: ${ctx.archFamily} / ${ctx.archVariant}

AXIS REFERENCE:
${AXIS_REFERENCE}

Write 5 lenses showing how this person sees different dimensions of existence.
No jargon. No axis names in output. No em dashes. Write like a thoughtful friend, in second person using "you" throughout.
GROUNDING: base every statement on the scores above. For anything about behaviour or feeling, stay tentative ("tends to", "likely", "your answers suggest"). Never invent specific incidents, habits, or what other people notice or say about them.

Return ONLY valid JSON, with no markdown fences:
{"world":[{"lens":"The Self","icon":"mirror","view":"2-3 sentences on how this person sees their own identity, agency, and inner life. Draw from self, identity, determinism, responsibility scores. What does it feel like to be them on the inside?","shows_up":"2-3 sentences on how this self-view is likely to show up in how you move through the world.","prompt":"One reflective question they can sit with this week. Concrete, not abstract. No em dashes."},{"lens":"Other People","icon":"people","view":"2-3 sentences on how this person sees other people. Draw from human_nature, moral_scope, freewill_practice, responsibility, social_ontology.","shows_up":"2-3 sentences on how this plays out. What are they good at in relationships? What is hard?","prompt":"One reflective question about a specific relationship or interaction. Honest and concrete."},{"lens":"Relationships","icon":"connect","view":"2-3 sentences on how this person approaches connection and belonging. Draw from social_ontology, identity, moral_authority, epistemic_humility, society.","shows_up":"2-3 sentences on how this tends to look in practice.","prompt":"One reflective question about what they might be asking from others that they have not said out loud."},{"lens":"Society","icon":"city","view":"2-3 sentences on how this person sees society and their place in the collective. Draw from society, politics, justice, authority, economics, responsibility.","shows_up":"2-3 sentences on how this tends to shape their day to day.","prompt":"One reflective question about their actual relationship to the collective right now."},{"lens":"Life and Existence","icon":"horizon","view":"2-3 sentences on how this person sees existence itself. Draw from meaning, meaning_practice, teleology, religion, uncertainty, progress.","shows_up":"2-3 sentences on how this is likely to show up in the texture of their days.","prompt":"One honest question about where they are right now in their relationship with their own existence. No em dashes."}]}`;
}

const PROMPT_BUILDERS = { 1: buildCall1Prompt, 2: buildCall2Prompt };

// -- Schema validation (data only, never free text) -------
function isFiniteInRange(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

// Exactly AXIS_COUNT entries, each a known axis id used exactly once, each
// score a finite number in [1,7]. Unknown/missing/additional/duplicate axes
// and non-finite or out-of-range scores are all rejected here.
function validateAxisScores(arr) {
  if (!Array.isArray(arr) || arr.length !== AXIS_COUNT) return null;
  const map = {};
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes('axis') || !keys.includes('score')) return null;
    const { axis, score } = entry;
    if (typeof axis !== 'string' || !AXIS_SET.has(axis)) return null;
    if (Object.prototype.hasOwnProperty.call(map, axis)) return null; // duplicate axis
    if (!isFiniteInRange(score, 1, 7)) return null;
    map[axis] = score;
  }
  return map; // length===AXIS_COUNT + all-unique-known-ids already guarantees exact coverage
}

// Exactly FINGERPRINT_COUNT entries, each referencing an axis already
// present in the validated axisScores, each with an allowlisted direction.
function validateFingerprintAxes(arr, axisMap) {
  if (!Array.isArray(arr) || arr.length !== FINGERPRINT_COUNT) return null;
  const seen = new Set();
  const out = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes('axis') || !keys.includes('direction')) return null;
    const { axis, direction } = entry;
    if (typeof axis !== 'string' || !Object.prototype.hasOwnProperty.call(axisMap, axis)) return null;
    if (direction !== 'left' && direction !== 'right') return null;
    if (seen.has(axis)) return null;
    seen.add(axis);
    out.push({ axis, direction, score: axisMap[axis] });
  }
  return out;
}

// Zero or more entries, each an allowlisted rule id (never a description)
// with a finite strength in [0,1]. Duplicates rejected.
function validateContradictions(arr) {
  if (!Array.isArray(arr) || arr.length > MAX_CONTRADICTIONS) return null;
  const seen = new Set();
  const out = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !keys.includes('id') || !keys.includes('strength')) return null;
    const { id, strength } = entry;
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(CONTRADICTION_REGISTRY, id)) return null;
    if (seen.has(id)) return null;
    if (!isFiniteInRange(strength, 0, 1)) return null;
    seen.add(id);
    out.push({ id, strength });
  }
  return out;
}

function isValidArchetypeId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ARCHETYPE_REGISTRY, id);
}

// Returns a fully-validated context, or null if the shape is invalid
// (unexpected keys, wrong types, unknown/missing/duplicate ids, out-of-
// range or non-finite numbers). No free-form prose field exists here.
function validateContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  for (const key of Object.keys(context)) {
    if (!CONTEXT_KEYS.has(key)) return null;
  }

  const axisMap = validateAxisScores(context.axisScores);
  if (!axisMap) return null;

  if (!isValidArchetypeId(context.archetypeId)) return null;

  if (typeof context.isLiminal !== 'boolean') return null;

  let secondaryArchetypeId = null;
  if (context.isLiminal) {
    if (!isValidArchetypeId(context.secondaryArchetypeId) || context.secondaryArchetypeId === context.archetypeId) return null;
    secondaryArchetypeId = context.secondaryArchetypeId;
  } else if (context.secondaryArchetypeId !== null) {
    return null;
  }

  const contradictions = validateContradictions(context.contradictions);
  if (!contradictions) return null;

  const fingerprintAxes = validateFingerprintAxes(context.fingerprintAxes, axisMap);
  if (!fingerprintAxes) return null;

  return {
    axisMap,
    archetypeId: context.archetypeId,
    isLiminal: context.isLiminal,
    secondaryArchetypeId,
    contradictions,
    fingerprintAxes,
  };
}

// -- Prompt-prose rendering (server-owned, from trusted registries) ------
function axisDumpFrom(axisMap) {
  return AXIS_IDS.map(id => {
    const meta = AXIS_LABELS[id];
    const score = axisMap[id];
    const pole = score >= 4 ? meta.poleR : meta.poleL;
    return `${meta.label}:${score.toFixed(1)} (${pole})`;
  }).join(' | ');
}

function fingerprintSummaryFrom(fingerprintAxes) {
  return fingerprintAxes.map(f => {
    const meta = AXIS_LABELS[f.axis];
    const pole = f.direction === 'right' ? meta.poleR : meta.poleL;
    return `${meta.label}: ${f.score.toFixed(1)}/7 (${pole})`;
  }).join(', ');
}

function contradictionSummaryFrom(contradictions) {
  if (!contradictions.length) return 'None';
  return contradictions.map(c => {
    const meta = CONTRADICTION_REGISTRY[c.id];
    return `[${meta.tier}] ${meta.title} (strength:${Math.round(c.strength * 100)}%)`;
  }).join(', ');
}

function liminalNoteFrom(isLiminal, archetypeId, secondaryArchetypeId) {
  if (!isLiminal) return '';
  const a = ARCHETYPE_REGISTRY[archetypeId];
  const b = ARCHETYPE_REGISTRY[secondaryArchetypeId];
  return `Liminal: sits between ${a.family}/${a.variant} and ${b.family}/${b.variant}.`;
}

// First name only, letters/marks/hyphen/apostrophe only, capped short.
// Derived from the verified session, never from client-supplied text.
function deriveDisplayName(user) {
  const meta = (user && user.user_metadata) || {};
  const raw = meta.full_name || meta.name || meta.given_name ||
    (user && user.email ? user.email.split('@')[0] : '') || 'this person';
  const firstToken = String(raw).trim().split(/\s+/)[0] || 'this person';
  const cleaned = firstToken.replace(/[^\p{L}\p{M}'-]/gu, '').slice(0, 40);
  return cleaned || 'this person';
}

// -- Authorization (Supabase session verification) --------
// Same pattern as api/consent.js and api/delete-account.js: the token is
// verified against Supabase's own auth endpoint, never decoded/trusted
// locally. Identity comes only from this verified response.
async function getVerifiedUser(token) {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { 'apikey': anon, 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// -- Rate limiter (Supabase-backed) ------------------------
// Storage failure or missing configuration fails CLOSED (rejects the
// request) instead of granting unlimited access.
async function checkRateLimit(key) {
  const url    = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) {
    console.error('[generate] rate limit store not configured - failing closed');
    return { allowed: false, reason: 'unavailable' };
  }

  const windowMs = RATE_WINDOW_HRS * 60 * 60 * 1000;
  const now      = new Date();
  const headers  = {
    'apikey':        secret,
    'Authorization': `Bearer ${secret}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  };

  try {
    const getRes  = await fetch(
      `${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}&select=calls,window_start`,
      { headers }
    );
    if (!getRes.ok) {
      console.error('[generate] rate limit lookup failed:', getRes.status);
      return { allowed: false, reason: 'unavailable' };
    }
    const records = await getRes.json();
    const record  = Array.isArray(records) ? records[0] : null;

    if (!record) {
      await fetch(`${url}/rest/v1/rate_limits`, {
        method: 'POST', headers,
        body: JSON.stringify({ key, calls: 1, window_start: now.toISOString() }),
      });
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    const elapsed = now - new Date(record.window_start);
    if (elapsed > windowMs) {
      await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ calls: 1, window_start: now.toISOString() }),
      });
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    if (record.calls >= RATE_LIMIT) {
      const resetAt = new Date(new Date(record.window_start).getTime() + windowMs);
      return { allowed: false, reason: 'exceeded', remaining: 0, resetAt: resetAt.toISOString() };
    }

    await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ calls: record.calls + 1 }),
    });
    return { allowed: true, remaining: RATE_LIMIT - record.calls - 1 };

  } catch (e) {
    console.warn('[generate] rate limit check failed:', e.message);
    return { allowed: false, reason: 'unavailable' }; // fail closed
  }
}

// -- Handler -----------------------------------------------
export default async function handler(req, res) {
  // CORS - locked to production domain only
  const origin = req.headers['origin'] || '';
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Service unavailable' });

  // -- Authorization: verified Supabase session required, before any other work --
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const user = await getVerifiedUser(token);
  if (!user || !user.id) return res.status(401).json({ error: 'Invalid or expired session' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // -- Shape allowlist: no messages/model/max_tokens/email/role from the client --
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: 'Invalid request' });
  }

  // -- Oversized payload guard --
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // -- callType selects a fixed, server-owned prompt template --
  const callType = body.callType;
  const promptBuilder = PROMPT_BUILDERS[callType];
  if (!promptBuilder) return res.status(400).json({ error: 'Invalid request' });

  // -- Context: strictly typed data schema, never free-form prompt text --
  const ctx = validateContext(body.context);
  if (!ctx) return res.status(400).json({ error: 'Invalid request' });

  // -- Rate limiting by IP. Dev bypass requires BOTH a server-only env flag
  // AND the verified (not client-supplied) session email - a client can no
  // longer choose or spoof the identity used for the bypass. --
  const isDev = process.env[DEV_BYPASS_ENV_VAR] === 'true' &&
    DEV_EMAILS.includes((user.email || '').toLowerCase().trim());
  const ip = (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).trim();
  const rateKey = `generate:${ip}`;
  const rate    = isDev ? { allowed: true } : await checkRateLimit(rateKey);

  if (!rate.allowed) {
    if (rate.reason === 'unavailable') {
      return res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
    }
    return res.status(429).json({
      error:   'Rate limit reached. Maximum 3 reports per 24 hours.',
      resetAt: rate.resetAt,
    });
  }

  // -- Server builds all prompt prose from the verified identity + registries --
  const arch = ARCHETYPE_REGISTRY[ctx.archetypeId];
  const promptCtx = {
    userName:             deriveDisplayName(user),
    axisDump:             axisDumpFrom(ctx.axisMap),
    fingerprintSummary:   fingerprintSummaryFrom(ctx.fingerprintAxes),
    contradictionSummary: contradictionSummaryFrom(ctx.contradictions),
    liminalNote:          liminalNoteFrom(ctx.isLiminal, ctx.archetypeId, ctx.secondaryArchetypeId),
    archFamily:           arch.family,
    archVariant:          arch.variant,
  };

  // -- Server controls model, params, and message shape entirely --
  const messages = [{ role: 'user', content: promptBuilder(promptCtx) }];
  const maxTokens = MAX_TOKENS_BY_CALL[callType];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
      },
      // No temperature: claude-sonnet-5 rejects sampling parameters with a 400.
      // Reproducibility is carried by prompt_hash + report_version + model pinning (D100).
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, thinking: { type: 'disabled' }, messages }),
    });

    if (!response.ok) {
      console.error('[generate] provider error:', response.status);
      return res.status(502).json({ error: 'Generation service temporarily unavailable' });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    console.error('[generate] request failed:', e.message);
    return res.status(502).json({ error: 'Generation service temporarily unavailable' });
  }
}

// Exported for containment tests only (A0.1) - not part of the public API surface.
export const __testables__ = {
  validateContext, validateAxisScores, validateFingerprintAxes, validateContradictions,
  isValidArchetypeId, deriveDisplayName, getVerifiedUser, checkRateLimit,
  axisDumpFrom, fingerprintSummaryFrom, contradictionSummaryFrom, liminalNoteFrom,
  buildCall1Prompt, buildCall2Prompt, AXIS_IDS, ARCHETYPE_REGISTRY, CONTRADICTION_REGISTRY,
};
