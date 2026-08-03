export const config = { maxDuration: 60 };

// DI-006 slice 3 (2026-08-01): structured events, duplicated inline rather
// than imported from lib/observability.js - this file's test harness
// enforces a zero-import containment contract (A0.1), so no module of any
// kind may be pulled in here. Same JSON shape as lib/observability.js so
// all six endpoints' log lines parse uniformly. Never pass PII, tokens,
// emails, or report content as `detail` - status codes and error-message
// strings only.
function logEvent(level, event, detail) {
  const record = { ts: new Date().toISOString(), level, module: 'generate', event };
  if (detail !== undefined) record.detail = detail;
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

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

// GROUNDING_DATA block (auto-generated from lib/belief-map-registry.js, do not hand-edit)
// C-2 staged grounding data (2026-08-02): the compact five-band evidence
// the grounding selector draws on - per axis, the display label, short
// definition, and each band's short interpretation text, plus the
// glossary. Generated by scripts/embed-grounding-data.js from the
// FC4-audited lib/belief-map-registry.js; never hand-edit here (DI-005).
// Band thresholds are carried alongside so classification stays single-
// sourced with the registry (parity-tested).
const GROUNDING_THRESHOLDS = {"strongL":[1,2.19],"leanL":[2.2,3.39],"mid":[3.4,4.6],"leanR":[4.61,5.8],"strongR":[5.81,7]};
const GROUNDING_DATA = {
 "naturalism": {
  "label": "Naturalism",
  "def": "How much of reality you take to be natural: whether everything that exists belongs to the world science can in principle study, or whether something real lies beyond it.",
  "bands": {
   "strongL": "The supernatural is part of how reality actually works for you, not a metaphor. You treat certain experiences and arguments as evidence physics cannot capture. The strength is openness to the full range of human experience; the risk is that untestable claims accumulate unchecked.",
   "leanL": "You suspect reality outruns the physical story, without building your whole picture on that. Spiritual claims stay live possibilities for you rather than settled errors. The strength is fluency in two readings of the world; the cost is adjudicating when they disagree.",
   "mid": "You keep the biggest question open: neither ruling out something beyond nature nor building on it, weighing claims one at a time. The strength is weighing each claim on its own evidence; the cost is that practical decisions sometimes force a working answer anyway.",
   "leanR": "Probably the natural world is all there is, though you keep a margin for error. You ask for checkable evidence and treat supernatural explanations as last resorts. The strength is evidence-discipline without dogmatism; the cost is tension when your own experience feels like more than chemistry.",
   "strongR": "Reality is one natural order and everything real belongs to it in principle. You ask what would count as evidence before believing. The strength is a unified picture with a strong track record; the blind spot is under-rating what resists the method."
  }
 },
 "epistemic_humility": {
  "label": "Epistemic Humility",
  "def": "How you hold your deepest views: as answers careful thinking can reach and defend, or as best guesses that minds like ours should hold loosely.",
  "bands": {
   "strongL": "Careful thinking earns firm conclusions, and you hold yours on the record. The strength is intellectual courage with accountability; the blind spot is that confidence is hardest to check exactly where the questions are biggest.",
   "leanL": "Most deep questions have best answers and you name yours, deferring only where you have not done the work. The strength is selective courage; the cost is that the settled/unsettled line can quietly track comfort instead of evidence.",
   "mid": "You match belief strength to evidence strength, subject by subject: firm where warrant is firm, open where it is not. The strength is genuine persuadability; the cost is that calibration takes maintenance and both poles may hear you as unfinished.",
   "leanR": "You distrust confident answers on the biggest questions, including your own, while keeping revisable working positions. The strength is resistance to overreach; the cost is that revisable defaults can become permanent deferrals.",
   "strongR": "On the largest questions, calibrated doubt is your considered conclusion, not a hedge. You update fast and treat felt certainty as data about the believer. The strength is near-immunity to dogmatism; the blind spot is that living still requires commitments doubt cannot underwrite."
  }
 },
 "freewill_practice": {
  "label": "Free Will in Practice",
  "def": "The frame you actually reach for when responsibility is on the line: accountability for choices, or understanding of causes.",
  "bands": {
   "strongL": "Choices matter because people own them, whatever produced them; holding someone answerable is a form of respect. The strength is moral seriousness toward everyone; the blind spot is reading genuine incapacity as unwillingness.",
   "leanL": "Accountability leads and explanation follows: you blame first, then adjust when the causal story earns it. The strength is standards with room for mercy; the cost is that the adjustment often arrives after the anger has spoken.",
   "mid": "You keep both frames, blaming and understanding, and pick by situation: answerability in person, causation in design. The strength is two sharp tools; the cost is that the choice of frame can track sympathy rather than the case.",
   "leanR": "Your first question is what produced the behaviour, with blame reserved for clear cases. The strength is effectiveness, since conditions respond to redesign; the cost is that the blame category can quietly shrink toward empty.",
   "strongR": "Behaviour is output; the real question is what would have to change. You redesign conditions where others demand willpower. The strength is fairness with practical leverage; the blind spot is the real work that accountability practices do and understanding alone does not."
  }
 },
 "animal_ethics": {
  "label": "Animal Ethics",
  "def": "How you weigh animal suffering against human interests: whether humans count for more in principle, or suffering counts the same wherever it occurs.",
  "bands": {
   "strongL": "Human lives carry a different kind of weight, grounded in more than the capacity to feel pain. You accept animal costs for human benefit without moral emergency, while condemning cruelty. The strength is clear human dignity; the blind spot is the boundary argument.",
   "leanL": "Humans first, and animal suffering still counts: welfare limits on legitimate use, lines drawn at cruelty. The strength is care without paralysis; the cost is how much quiet work \"proportionate\" does when practice tests it.",
   "mid": "Animal pain matters in itself and human claims win real conflicts: two commitments held at once, weighed case by case. The strength is responsiveness to new evidence about animal experience; the cost is that case-by-case weighing drifts toward convenience.",
   "leanR": "Serious animal pain outweighs human convenience for you, short of full parity: some practices changed, others tolerated. The strength is taking the arithmetic of suffering seriously; the cost is the gap between principle and remaining practice that others name first.",
   "strongR": "Suffering counts by size, not species, and at scale that reweights ordinary practices dramatically. You reorganize your own conduct around it. The strength is consistency without a comfortable exemption; the blind spot is permanent friction with ordinary life being mistaken for the argument."
  }
 },
 "religion": {
  "label": "Religion",
  "def": "Your overall verdict on religion: a source of meaning, community, and possibly truth, or a net cost the world would be better with less of.",
  "bands": {
   "strongL": "Religion's honest total comes out positive for you: meaning, community, and moral structure, with the truth question live. The strength is respect for accumulated human experience; the blind spot is discounting the testimony of those the tradition harmed.",
   "leanL": "Warm toward religion with receipts: real goods, admitted harms, a total still positive. The strength is criticism and praise that both cost something; the risk is crediting the faith for its saints while billing history for its abuses.",
   "mid": "You split the question: lived faith judged on one record, institutional power on another, the truth question held separately. The strength is precision about a word that names many things; the cost is that some public questions force a single vote anyway.",
   "leanR": "The harms outweigh the goods in your total, with credits still itemized. You resist faith's public authority while respecting the believer. The strength is separating people from claims; the risk is the critical lens becoming the only one.",
   "strongR": "The world would be better with less religion: false comfort has costs and authority must earn its standing. The strength is refusing comfortable exemptions; the blind spot is that arguments aimed at beliefs land on identities, a problem argument alone cannot solve."
  }
 },
 "meaning_practice": {
  "label": "Meaning in Practice",
  "def": "Your lived response to the meaning question: whether felt meaninglessness gets acknowledged as it stands, or answered with deliberate commitment.",
  "bands": {
   "strongL": "You say plainly when nothing feels worth doing, and you do not manufacture the feeling. The strength is an honesty others trust in their own hard stretches; the cost is that motivation waits on a feeling that sets its own schedule.",
   "leanL": "You name meaning's absence rather than paper it, keeping the few commitments that survive the audit. The strength is that what remains is real; the cost is an audit that can turn reflexive and dissolve what only needed time.",
   "mid": "You take the void seriously and still care: endurance without illusion, commitment without cosmic backing. The strength is footing that neither high feeling nor its absence removes; the cost is that each pole reads you as half-committed to its half.",
   "leanR": "Mostly you build: commitments made without cosmic co-signing, with the void still granted its visits. The strength is momentum with honesty intact; the risk is a calendar full enough that the question never gets a word in.",
   "strongR": "You build meaning and stand behind what you build, guarantee or not. The strength is generative force that lives accrete around; the blind spot is having no protocol for the day the scaffolding shakes."
  }
 },
 "physicalism": {
  "label": "Physicalism",
  "def": "What you take minds to be made of: whether experience is fully physical, or something no complete brain-map would capture.",
  "bands": {
   "strongL": "Experience exceeds any physical description for you: the first-person side is the part no brain-map captures. The strength is refusing to explain away what everyone actually has; the blind spot is saying why minds and brains move so tightly together.",
   "leanL": "The felt side of mind seems unaccounted for to you, though every finding about brains stands. The strength is keeping the hard problem honestly open; the cost is the standing IOU of saying what more there is.",
   "mid": "Brains and minds move together, and the felt side still seems unaccounted for: you hold the hard problem open in both directions. The strength is being movable by evidence; the cost is that applied cases will demand answers before the field has them.",
   "leanR": "The mind is probably what the brain does, with the hard problem granted a respectful nod. The strength is betting with science's track record; the cost is mistaking the bet for a result while the felt side stays unreduced.",
   "strongR": "Consciousness is what certain matter does; brain explanations are answers, not evasions. The strength is unity plus science's inheritance; the blind spot is that the first-person datum is where the outside view grips least."
  }
 },
 "realism": {
  "label": "Epistemic Realism",
  "def": "What you take truth to be: a mind-independent reality that inquiry can genuinely reach, or a human construction that happens to work.",
  "bands": {
   "strongL": "Truth is what survives testing, arguing, and use, not a mirror of bare reality. The strength is honesty about how knowledge is made; the blind spot is explaining why prediction works so well while shrugging at the mirror.",
   "leanL": "Most certainty looks constructed to you, with how-far-down as the open question. The strength is leverage on claims that hide their history; the cost is stopping the acid before it eats your own standards.",
   "mid": "Truth divides by territory for you: plain fact in some domains, working construction in others. The strength is accuracy to how inquiry behaves; the cost is that the hard cases sit exactly on your border and demand rulings.",
   "leanR": "Inquiry mostly reaches the world as it is, with construction granted its corners. The strength is a firm grip on error and standards; the cost is under-crediting how questions and instruments shape even good science.",
   "strongR": "There is a way the world is, and inquiry genuinely reaches it; being wrong proves there is something to be wrong about. The strength is seriousness about error; the blind spot is mistaking what our instruments select for the world entire."
  }
 },
 "determinism": {
  "label": "Determinism",
  "def": "Your metaphysics of choice: genuine open alternatives, full causal determination, or freedom redefined as self-direction within causation.",
  "bands": {
   "strongL": "More than one future is genuinely open when you choose; people originate actions, not merely transmit causes. The strength is fitting moral life as lived; the blind spot is saying how an undetermined choice differs from a random one.",
   "leanL": "Mostly open choices, with causation granted more doors than pride admits. The strength is calibrated honesty about agency; the cost is the double standard, defending a core for yourself that shrinks when explaining others.",
   "mid": "Choices are caused and still yours: freedom as self-direction inside causation. The strength is taking circumstances and agency seriously at once; the cost is pressure from both neighbours asking what the middle word means.",
   "leanR": "The causal story probably runs all the way through choosing, with the case held slightly open. The strength is consistency with behavioural science; the cost is the lived split between deliberating as if open and theorizing as if closed.",
   "strongR": "Everything, choices included, follows from prior causes; doing otherwise is an illusion. The strength is explanatory unity and grounded compassion; the blind spot is that no one has yet lived entirely inside the frame."
  }
 },
 "moral_ground": {
  "label": "Moral Realism",
  "def": "Whether morality is discovered or made: real facts about right and wrong, or human constructions given a human account.",
  "bands": {
   "strongL": "No moral facts in the world's inventory: values are human, felt, made, agreed. The strength is refusing borrowed authority; the blind spot is phrasing condemnation of what everyone accepts once truth has left the vocabulary.",
   "leanL": "Morality reads as construction to you, with a residue, cruelty for its own sake, that resists the relativizing. The strength is tolerance with honesty about anomalies; the cost is deciding what status the residue gets.",
   "mid": "Some wrongs read as plainly real, other norms as local custom, and the line is genuinely open. The strength is firm judgments without settled metaphysics; the cost is that public arguments eventually ask which register you mean.",
   "leanR": "Some things are probably wrong independently of us, with the clearest cases as your best evidence. The strength is matching moral experience; the cost is the detection problem, realists disagreeing like everyone else.",
   "strongR": "Right and wrong are facts; a majority cannot outvote one. The strength is high stakes and ground for the dissenter; the blind spot is explaining how humans detect moral facts at all."
  }
 },
 "meaning": {
  "label": "Meaning Realism",
  "def": "Where significance comes from: purpose discovered in reality, or meaning authored by human commitment.",
  "bands": {
   "strongL": "The universe is silent; mattering is something people do, and you own the authorship completely. The strength is honesty and full ownership; the blind spot is handing built meanings on without the finding-language you deny.",
   "leanL": "Meaning is mostly made, with a few arrivals, love, beauty, that feel found and are kept honestly on the books. The strength is authorship open to surprise; the cost is the exceptions either need explaining or they refute the default.",
   "mid": "Some things matter on their own, others because you invested them, and both experiences are accurate. The strength is fidelity to how meaning actually arrives; the cost is that gift-language and work-language counsel differently in a crisis.",
   "leanR": "Some things probably matter in themselves; the pull is perception, not projection, even without a finished metaphysics. The strength is keeping faith with depth; the cost is that \"something real\" postpones saying what.",
   "strongR": "Purpose is found: a life can be right or wrong about its point. The strength is weight and heritable direction; the blind spot is conflicting discoveries, which someone must have misread."
  }
 },
 "teleology": {
  "label": "Teleology",
  "def": "Whether the universe runs on purposes or only on causes: inherent direction, or none beyond what people bring.",
  "bands": {
   "strongL": "Causes, not goals: design is apparent, disasters are not messages, and nothing is owed a lesson. The strength is immunity to false comfort and false blame; the blind spot is replacing the work the purpose-story did.",
   "leanL": "The cosmos aims at nothing, and organisms genuinely strive: purpose is real exactly where life organizes. The strength is precision about where goal-talk earns its keep; the cost is defending the boundary above and below.",
   "mid": "Purposive language feels natural and a cosmic plan feels unproven, and you hold both sensibly. The strength is neither over-reading nor flattening the world; the cost is telling your big moments in alternating registers.",
   "leanR": "The world reads as directed, destination unnamed: gifts feel like callings, lives have through-lines. The strength is orientation; the cost is that a reader looking for through-lines will find them.",
   "strongR": "Reality runs toward something, and the world is readable like an intention. The strength is coherence and resilience under suffering; the blind spot is the dark chapters, which the direction must include without breaking."
  }
 },
 "human_nature": {
  "label": "Human Nature",
  "def": "How much of being human is given versus built: a universal essence beneath the differences, or a construction that varies with the world that made it.",
  "bands": {
   "strongL": "People are made by their worlds, and what was built can be rebuilt; \"human nature\" as a defense of the status quo gets no pass. The strength is refusing to naturalize arrangements; the blind spot is the regularities that keep reappearing anyway.",
   "leanL": "Culture explains most of it, biology sets wide walls you seldom reach: reform is possible and priced. The strength is hope with friction budgeted; the cost is not knowing in advance which reforms hit the walls.",
   "mid": "Deep commonalities, culturally shaped into very different lives: a given core with a built expression. The strength is resisting fatalism and utopianism at once; the cost is sorting traits into columns case by case, formula-free.",
   "leanR": "A shared core probably underlies the costumes: design for creatures like us, as found. The strength is institutional realism; the cost is drawing the cannot-become line earlier than the evidence requires.",
   "strongR": "The core precedes the teaching: every culture works the same material, and it pushes back. The strength is predictive sobriety; the blind spot is history's surprises, when what everyone knew people would always do stopped."
  }
 },
 "epistemic_method": {
  "label": "Epistemic Method",
  "def": "Your account of the doors to truth: empirical method as the standard, or several genuine ways of knowing that measurement does not exhaust.",
  "bands": {
   "strongL": "Several doors to truth, and instruments guard only one: reasoning, tradition, experience, perhaps revelation all carry weight. The strength is refusing one method's blind spots as reality's limits; the blind spot is who umpires when the doors disagree.",
   "leanL": "Two jurisdictions: testing rules the physical, other ways of knowing rule meaning and value, border patrolled. The strength is methods matched to questions; the cost is the disputed cases sitting exactly on the line.",
   "mid": "Different questions call for different evidence, and you keep the map deliberately. The strength is fitting how inquiry actually divides; the cost is defending every border crossing, where the live arguments are.",
   "leanR": "Testing is the paradigm, with a margin honestly kept for questions that are not laboratory-shaped. The strength is rigor with jurisdictional honesty; the cost is quietly demoting the uncheckable to preference.",
   "strongR": "Reality answers back when questioned properly, and conviction is what needs the check. The strength is the only self-correcting method there is; the blind spot is the questions that do not answer back and still must be decided."
  }
 },
 "social_ontology": {
  "label": "Social Ontology",
  "def": "What the social world is made of: individuals all the way down, or structures that shape outcomes no individual chose.",
  "bands": {
   "strongL": "Society is people; harm always has hands, and systems-talk cannot hide them. The strength is agency kept visible and accountable; the blind spot is emergence, effects that behave like forces though no one is one.",
   "leanL": "People are the units and arrangements tilt the floor: choices explain most, channels explain the rest. The strength is precision about where causation runs; the cost is patterns that only appear at scales no desk explains.",
   "mid": "People make structures and structures make people, and you keep the whole loop. The strength is explanatory completeness; the cost is that blame and repair need one address and the loop always offers two.",
   "leanR": "If replacing all the people changes little, it was never mainly the people: patterns are design's signature. The strength is leverage, structures rebuild on purpose; the cost is arriving late to the moments one person turned.",
   "strongR": "Systems produce outcomes nobody chose, and durable social facts are made at the level of design. The strength is gripping what survives every change of personnel; the blind spot is excusing operators who could do otherwise."
  }
 },
 "temporal_orientation": {
  "label": "Temporal Orientation",
  "def": "Which direction you face for guidance: the past's tested inheritance, or the future's open potential.",
  "bands": {
   "strongL": "Time is a filter and tradition is what passed it: ask what a rule protected before removing it. The strength is humility before accumulated selection; the blind spot is that the filter recorded the survivors' interests only.",
   "leanL": "Tradition is the default and reform carries the burden of proof, a burden sometimes met. The strength is pricing change accurately; the cost is defaults defended past their date, making necessary changes late.",
   "mid": "No era gets your proxy: traditions and reforms are judged one by one on what they do now. The strength is case-quality; the cost is workload, every question opening fresh with no temporal default to lean on.",
   "leanR": "Update by default, audit first: moral knowledge grows, and old practices get read before replacement. The strength is direction with due diligence; the cost is forgetting the present is also somebody's era.",
   "strongR": "The past is a starting point, not a verdict: progress is who counts now who did not before. The strength is the widened-circle track record; the blind spot is fences removed before anyone asked what they held."
  }
 },
 "moral_authority": {
  "label": "Moral Authority",
  "def": "Where the moral court of last appeal sits: God, sacred text, and tradition, or reasons weighed by your own judgment and conscience.",
  "bands": {
   "strongL": "A standard you can rewrite is a preference with ceremony: morality must be received, and it binds even when it costs. The strength is an anchor mood cannot move; the blind spot is the human reader through whom every standard arrives.",
   "leanL": "The standard is received, the custodians are audited: loyal in substance, stubborn about convenient readings. The strength is discernment inside loyalty; the cost is explaining why your checking conscience bends less than the one you distrust.",
   "mid": "Authority sits in what binds everyone: reason, human nature, possible agreement, no god and no sovereign self required. The strength is a court open to all; the cost is that the court's own law is perpetually relitigated.",
   "leanR": "Conscience rules with tradition as senior counsel: inherited duties are evidence, never verdicts. The strength is judgment enriched, not outsourced; the cost is assembling, brief by brief, a tradition that always agrees with you.",
   "strongR": "Nothing is settled until your judgment endorses it, and every delegated verdict is still yours in gloves. The strength is full moral ownership; the blind spot is self-interest disguised as the confident inner verdict."
  }
 },
 "knowledge": {
  "label": "Knowledge Source",
  "def": "Where your trust runs case by case: inner sources, intuition, lived experience, perhaps revelation, or outer checks, studies, data, testing.",
  "bands": {
   "strongL": "You know your life from the inside and the study does not: experience, testimony, and felt sense weigh as evidence. The strength is access to truths only visible from within; the blind spot is that fooled and right feel identical in there.",
   "leanL": "Near territory belongs to experience, far territory to the data: your gut rules where you live. The strength is local expertise no study replicates; the cost is that home ground is where bias pays best.",
   "mid": "Trust is rationed case by case, stakes setting the standard, no source holding a veto. The strength is calibration; the cost is that which-source-rules-this-case is itself a gut call with no auditor above it.",
   "leanR": "Data wins the collisions, with an exception list for what measurement has not reached. The strength is discipline with honest jurisdictions; the cost is treating the unmeasured as unknowable.",
   "strongR": "The check tells fooled from right; the feeling never does. You withhold, test, and update in public. The strength is armor against self-deception; the blind spot is the questions that will not sit still for testing and get decided anyway."
  }
 },
 "science": {
  "label": "Science Trust",
  "def": "Your trust in science as an institution: expert consensus as the default, or a claim to be audited like any other interested party's.",
  "bands": {
   "strongL": "Consensus is a voice, not a verdict: you audit the funder, the frame, and the track record first. The strength is immunity to prestige; the blind spot is that the auditing judgment has no peer review of its own.",
   "leanL": "Trust runs on a gradient: full at the settled core, discounted at the human frontier where incentives distort most. The strength is trusting where the checks bind; the cost is a discount rate applied by feel.",
   "mid": "The most reliable tool for physical questions, weaker where questions turn human: single studies provisional, consensus weighty. The strength is matching trust to grain size; the cost is re-deriving it claim by claim.",
   "leanR": "Consensus is the default, revisions remembered: self-correction reads as the mechanism working. The strength is the division of cognitive labor used as designed; the cost is the lag, since today's default was yesterday's reversal.",
   "strongR": "Consensus versus perfection was never the choice; consensus versus unchecked judgment is. You ride the error-correction machine and update on schedule. The strength is rationality at scale; the blind spot is the questions the machine set aside to become sure."
  }
 },
 "justice": {
  "label": "Justice",
  "def": "What justice answers to: the past, where wrongs demand their due, or the future, where harm demands repair and prevention.",
  "bands": {
   "strongL": "Wrongs are owed their due, and the victim's injury does not shrink when the offender's story grows. The strength is clarity and fidelity to victims; the blind spot is that expressing justice perfectly can prevent harm poorly.",
   "leanL": "Desert sets the frame and outcomes fill it: punishment owed, treatment welcome inside it. The strength is legitimacy that can afford humanity; the cost is healing bolted onto institutions built to punish.",
   "mid": "Accountability and context both get a vote, scaled case by case: neither the victim nor the history drops out. The strength is the full picture held; the cost is that two tracks without an exchange rate leave hard cases priced by judgment.",
   "leanR": "Judge the response by what it changes, keep a marking for what demands it. The strength is results with meaning retained; the cost is that the marking reopens the desert question at every hard case.",
   "strongR": "Suffering added without harm subtracted is just more harm: point everything at prevention and repair. The strength is resources aimed where harm can still change; the blind spot is the social work of naming and marking left undone."
  }
 },
 "ethics": {
  "label": "Ethics Engine",
  "def": "The engine your moral judgments run on: duties that hold regardless of consequences, or consequences that justify whatever serves them best.",
  "bands": {
   "strongL": "Some things are not for sale at any exchange rate: persons are never merely tools. The strength is inviolability under pressure; the blind spot is the catastrophe case, where the unmoved line looks like clean hands over living people.",
   "leanL": "Duties are the walls, arithmetic is the furniture: firm lines, free optimizing inside them. The strength is a livable moral architecture; the cost is that which walls are load-bearing gets contested exactly in the emergencies.",
   "mid": "Rules bind and outcomes count, neither winning every time: lever pulled here, refused there, for reasons you can name. The strength is fidelity to the full moral evidence; the cost is naming the threshold where duties yield.",
   "leanR": "Outcomes rule with a short bill of rights: most norms pay their way or retire. The strength is effectiveness with a conscience clause; the cost is explaining the clause when the arithmetic visibly disagrees with it.",
   "strongR": "Everyone counts equally and not-acting is also acting: the sums rule, symbols do not. The strength is refusing clean hands bought with others' suffering; the blind spot is the agent hollowed into everyone's instrument."
  }
 },
 "politics": {
  "label": "Politics",
  "def": "Your political frame: individual effort and market reward as the main story, or structural arrangement and collective correction.",
  "bands": {
   "strongL": "Effort explains and earning entitles: the ladder matters more than the spacing of its rungs. The strength is agency defended and the engine kept running; the blind spot is the unearned starting lines that compound through protected mechanisms.",
   "leanL": "Effort is the main story, the track is unevenly banked, and correction must prove itself case by case. The strength is dignity with a cushion; the cost is that the deserving and the unable arrive unlabeled, and sorting errors land at the worst hour.",
   "mid": "Systems shape and effort is real, so you judge policies one at a time, homeless in slogan-checked rooms. The strength is letting each policy's evidence set the verdict; the cost is that politics runs on coalitions and the case-by-case voter inherits no allies.",
   "leanR": "Durable gaps are architecture: redesign floors and ladders, keep incentives and exits. The strength is remedy at the scale of the cause; the cost is the designer's hubris, each rebuild writing the next diagnosis.",
   "strongR": "Gaps are arrangement, and concentrated wealth is power over lives: inequality is a freedom question. The strength is grip on scale and power's economic clothes; the blind spot is the agency that persists inside every arrangement."
  }
 },
 "self": {
  "label": "Self",
  "def": "How you read your own becoming: a self that made itself by choosing, or a self assembled by genes, upbringing, and events nobody chose.",
  "bands": {
   "strongL": "You date your life by decisions: the core is yours, and so are the credit and the fault. The strength is a life held with both hands; the blind spot is that the chooser was not itself chosen.",
   "leanL": "You authored the voyage, not the vessel: the trajectory is yours, the equipment was issued. The strength is ownership without denying inheritance; the cost is the border, redrawn each year self-knowledge reassigns a trait.",
   "mid": "Chosen and produced, both files open: discipline praised one day, luck thanked the next, both sincerely. The strength is descriptive honesty; the cost is that accountability needs one address and the files counsel differently.",
   "leanR": "Character was issued and the steering is yours: self-knowledge is the system learning its schematics. The strength is compassion with a working handle; the cost is explaining what exactly does the redirecting.",
   "strongR": "Raised elsewhere, you would be someone else, and you can hold that without flinching. The strength is systematic mercy and curiosity; the blind spot is under-using the agency the making left you."
  }
 },
 "moral_scope": {
  "label": "Moral Scope",
  "def": "How you draw the moral circle: centred on humans with obligations thickest where ties are closest, or drawn by sentience with species carrying no weight.",
  "bands": {
   "strongL": "Ties make morality, and the priority of our own kind is the principle, not a violation of one. The strength is fitting the loves people actually live; the blind spot is explaining why this boundary is right where earlier, narrower ones were wrong.",
   "leanL": "Humans first as policy, outer rings real: obligations thin with distance, never to zero. The strength is priorities that execute; the cost is the thinning rate, which is exactly what the hard cases dispute.",
   "mid": "Wide but weighted: suffering counts everywhere, the nearest claims count more, on principle. The strength is livability with honesty about wider claims; the cost is the exchange rate no concrete number states comfortably.",
   "leanR": "Suffering is the currency and the near hold a declared premium. The strength is breadth without self-deception about your loves; the cost is auditing a premium that expands exactly when the principle gets expensive.",
   "strongR": "The circle is drawn by suffering, not species, and the arithmetic stays open. The strength is a boundary drawn by reason rather than mirror; the blind spot is the claims of the near loves that made you a moral agent at all."
  }
 },
 "society": {
  "label": "Society",
  "def": "Your picture of the good society: maximum space for self-built lives, or shared guarantees judged by how the weakest fare.",
  "bands": {
   "strongL": "Room to build, keep, and answer for your own life: freedom to fail included, dignity defined. The strength is seriousness about consent; the blind spot is those whose empty starting materials make the room read as distance.",
   "leanL": "Spacious architecture, code-minimum floor: help designed with exits, audited by returns to self-account. The strength is compassion that respects future authors; the cost is a democratically defined basic that will not stay put.",
   "mid": "Freedom protected, basics guaranteed, the line drawn issue by issue: you live inside democracy's actual argument. The strength is tracking tradeoffs, not flags; the cost is relitigating the principle at every line.",
   "leanR": "A serious floor with real room above it: basics as freedom's preconditions, ambition kept. The strength is a design many would sign; the cost is that floors sag and the stable balance is continuously rebalanced.",
   "strongR": "Judge it at the last row: no one is free who lacks the basics, and peaks are not testimony. The strength is counting everyone once; the blind spot is keeping the surplus-producing top showing up."
  }
 },
 "responsibility": {
  "label": "Responsibility",
  "def": "How you assign life outcomes: character and effort as the main authors, or circumstance and luck as the main determinants.",
  "bands": {
   "strongL": "The same street produces the ruin and the recovery: choices author lives, and respect assumes agency. The strength is dignity extended to everyone; the blind spot is building the standard on the visible exceptions.",
   "leanL": "Agency graded on course difficulty: more expected of the well-dealt, more forgiven where dealing was cruel. The strength is standards with contexts priced; the cost is estimating difficulty from the outside.",
   "mid": "Both hands write the life and the shares will not separate: responsibility scales with room to move. The strength is honesty about mixed causation; the cost is that real decisions demand the split you decline to fake.",
   "leanR": "Zip code, childhood, and timing first; the personal margin real and smaller than advertised. The strength is accuracy at population scale; the cost is that conditions-first can reach the individual as its own verdict.",
   "strongR": "Even the praised discipline was installed by unordered advantages: support before verdicts, design before judgment. The strength is mercy with scale-accuracy; the blind spot is a ledger that cannot record the decisions people still must make."
  }
 },
 "identity": {
  "label": "Identity",
  "def": "What a self is made of: an essential core that experience reveals, or a construction of culture, relationships, and story with real authorship in it.",
  "bands": {
   "strongL": "Something in you stays the same person, and old friends who recognize you are right. The strength is an anchor circumstance cannot repossess; the blind spot is distinguishing the revealed core from the merely early.",
   "leanL": "A real core, dressed by context, some garments become skin: the adapting is done by the one who stays. The strength is identity that travels without dissolving; the cost is that introspection sorting kernel from layer was calibrated by the layers.",
   "mid": "Stable tendencies, situationally expressed: the two-source self, which is also what the psychology says. The strength is fitting the lived data; the cost is that crises still ask which layer speaks now.",
   "leanR": "Mostly made, with a through-line the genealogies never dissolve, held as open data. The strength is the project consciously run; the cost is deciding whether the residue is essence or just construction too early to reach.",
   "strongR": "No statue before the carving: identity is the project, every draft revisable, none the true one. The strength is freedom from inner verdicts; the blind spot is why the earlier drafts' promises still bind this one."
  }
 },
 "authority": {
  "label": "Authority",
  "def": "Your default posture toward earned authority: trust extended and updated through channels, or skepticism that keeps asking who benefits.",
  "bands": {
   "strongL": "Earned authority gets the doubt's benefit, and channels get the grievances: the trust complex societies run on. The strength is cooperation at scale; the blind spot is capture collecting the subsidy while the deferential are not auditing.",
   "leanL": "Deference rationed by audit trail: full where error-correction is visible, withheld where incentives run naked. The strength is trust indexed to verification; the cost is reputations that coast after the checks decay.",
   "mid": "Listen carefully, then verify: trust tracks incentives as much as credentials, case by case. The strength is authority earning exactly what it shows; the cost is that checking is a second job with an unfinishable docket.",
   "leanR": "Authority starts owing: claims are briefs from interested parties, and you read the dissent. The strength is early detection of capture; the cost is the audit tax paid on every roughly-honest transaction.",
   "strongR": "Obedience is owed only where respect is: channels process questions into patience, so you ask in public. The strength is the exposure service record; the blind spot is the coordination cost, reform itself needing the trust you audit away."
  }
 },
 "economics": {
  "label": "Economics",
  "def": "Your economic mechanism of trust: markets allocating through prices and incentives, or deliberate structure sharing the gains.",
  "bands": {
   "strongL": "Prices carry knowledge no planner holds, and profit funds the floor's rising. The strength is respect for dispersed information; the blind spot is the market's prerequisites, which markets consume without producing.",
   "leanL": "Markets by default, textbook failures corrected: referees empowered and off the field. The strength is each tool where it works; the cost is every interest claiming to be the textbook exception.",
   "mid": "Markets where they work, correction where they fail, basics off the price system: the actual mainstream. The strength is mechanisms judged in place; the cost is drawing the basics line argument by argument, forever.",
   "leanR": "Distribution engineered, incentives kept funded: transfers strong, goose healthy. The strength is generosity that plans its funding; the cost is counter-pressure strong enough to matter being strong enough to distort.",
   "strongR": "Judge the economy by what reaches the bottom; compounding advantage is power, and essentials are not business cases. The strength is clarity about what economies are for; the blind spot is the engine room that funds every distribution."
  }
 },
 "uncertainty": {
  "label": "Uncertainty Tolerance",
  "def": "How the unresolved feels to live with: a need for clear positions and closure, or a working comfort with questions that stay open.",
  "bands": {
   "strongL": "Open questions draw power from everything built on them, so you close them and build. The strength is the engine that has settled most of what is settled; the blind spot is closing before the evidence finished arriving.",
   "leanL": "Settled on schedule where life requires, standing files for the bottomless few. The strength is a running life over honest depths; the cost is questions migrating between files without announcing it.",
   "mid": "Tolerance varies by domain, tight where stakes demand, loose where they allow: the pattern most decision-makers actually run. The strength is closure applied where it helps; the cost is being read as inconsistent until the map is learned.",
   "leanR": "Provisional everything, comfortably, with a stakes-triggered override near love, health, livelihood. The strength is footing on unsettled ground; the cost is comfort hiding the questions that did have deadlines.",
   "strongR": "You act at the actual size of the evidence and sleep anyway; needing an answer is data about the needer. The strength is calibration under pressure; the blind spot is what only question-closers ever build."
  }
 },
 "mind_consciousness": {
  "label": "Mind and Consciousness",
  "def": "Your rulings on the applied questions of mind: whether behaving conscious can be being conscious, and whether a copy of your brain would be you.",
  "bands": {
   "strongL": "Behaviour never proves presence: the copy wakes convinced and wrong, the eloquent machine proves no one home. The strength is refusing map for territory; the blind spot is that neighbors are also known only from outside.",
   "leanL": "Probably dark, probably not you, held provisionally: credence follows biological kinship. The strength is an ethics of presence under uncertainty; the cost is that kinship is an outside fact, and the machines keep closing the gap.",
   "mid": "The reporting machine might be conscious and the science might close the gap: you decline to bet the house. The strength is moral options held open; the cost is voting on live cases without the doctrine that would make it easy.",
   "leanR": "What does everything a mind does probably is one, asterisk standing. The strength is parsimony and consistency with the evidence; the cost is that the asterisk marks the entire disputed territory.",
   "strongR": "Doing everything a mind does is being one: the copy is you, and silicon gets the neuron's standard. The strength is one standard for all substrates; the blind spot is which functions count, a judgment the confidence conceals."
  }
 },
 "progress": {
  "label": "Progress",
  "def": "Your reading of history's trajectory: genuine improvement with the trend lines up, or decline the headline gains conceal.",
  "bands": {
   "strongL": "The dashboard gains mask decay in the load-bearing invisibles, and the harm-structures stand. The strength is the early-warning function; the blind spot is gains real enough that a reading which cannot register them loses repair's audience.",
   "leanL": "The income is real and the balance sheet troubles you: gains granted, foundations doubted. The strength is counting what celebration skips; the cost is saying what evidence would ever read as sound.",
   "mid": "Gains real, dangers real, no direction overall: each domain graded on its own curve. The strength is domain-level resolution; the cost is assembling direction retail, without an arc to push along.",
   "leanR": "The curves bent right and mostly stay bent, with the tail risks kept in frame. The strength is calibrated hope with variance priced; the cost is that one unbounded risk can retire every curve.",
   "strongR": "The lines point up and solved stays solved: you bet on the problem-solvers, and build long. The strength is the evidence plus self-fulfilling energy; the blind spot is a record written without the unrecoverable case."
  }
 }
};
const GROUNDING_GLOSSARY = {
 "anti-realism (about truth)": "the view that truth is what survives our best testing and use, rather than a mirror of reality as it is in itself.",
 "anti-realism (moral)": "the view that there are no moral facts built into reality; values are something humans feel, make, or agree on.",
 "compatibilism": "the view that choices can be both caused and genuinely ours, freedom being self-direction rather than a break in causation.",
 "consequentialism": "the view that the right action is the one producing the best outcomes for everyone affected, counted equally.",
 "constructivism (identity/meaning)": "the view that selves or meanings are built from culture, relationships, and commitment rather than found ready-made.",
 "deontology": "the view that some actions are right or wrong in themselves, and duties bind regardless of the outcomes of breaking them.",
 "determinism": "the view that everything that happens, choices included, follows from prior causes.",
 "dualism": "the view that mind is not purely physical; experience involves something beyond the brain's matter.",
 "empiricism": "the view that knowledge about the world comes from observation, evidence, and testing.",
 "epistemic humility": "a policy of holding views on the biggest questions loosely, matching confidence to what minds like ours can actually establish.",
 "epistemology": "the study of knowledge: what it is, where it comes from, and how much of it we can have.",
 "error theory": "the view that moral claims are systematically false, because they presuppose objective moral facts that do not exist.",
 "essentialism (identity)": "the view that a core self exists beneath change, revealed rather than manufactured by experience.",
 "the hard problem": "the open question of why physical brain processes are accompanied by felt experience at all.",
 "holism (social)": "the view that institutions and structures are real forces producing outcomes no individual chose.",
 "libertarian free will": "the view that when you choose, more than one future is genuinely open (unrelated to the political label).",
 "meaning realism": "the view that some things matter in themselves; purpose is found, not invented.",
 "metaethics": "the study of what moral claims are, whether they can be true, and what would make them so.",
 "metaphysics": "the study of what exists and what reality is fundamentally like.",
 "moral realism": "the view that some things are right or wrong independently of what anyone believes.",
 "naturalism": "the view that the natural world is all there is; everything real fits within it in principle.",
 "nihilism (practical)": "the lived stance of finding nothing ultimately worth doing, held honestly rather than papered over.",
 "panpsychism": "the view that consciousness, in some basic form, is a fundamental feature of matter itself.",
 "physicalism": "the view that mind and consciousness are fully physical, something certain arrangements of matter do.",
 "pragmatism": "the tradition that judges beliefs by what they do, truth being what proves itself in practice and inquiry.",
 "rehabilitative justice": "the view that the response to wrongdoing should repair harm and change what produced it, rather than balance a ledger.",
 "retributive (desert-based) justice": "the view that people should get what their actions deserve, and unpunished wrongs compound.",
 "sentience": "the capacity to have experiences, especially to suffer; the boundary some draw around moral concern.",
 "supernaturalism": "the view that some real things, God, spirit, forces, lie beyond the natural world science can study.",
 "teleology": "the view that at least some things are the way they are for the sake of something; reality has direction.",
 "utilitarianism": "the best-known consequentialism: maximize wellbeing, everyone counting for one and none for more than one.",
 "virtue ethics": "the tradition that centers ethics on character, what a person of practical wisdom would be and do, rather than on rules or outcomes alone."
};
// END GROUNDING_DATA block

// -- C-2 five-band grounding selector + Call 1 prompt path --
// Staged 2026-08-02, ACTIVATED the same evening on Andre's GO, after the
// C-5 paid comparison (grounded won on evidence-fidelity in all 3 pairs)
// and the one-pair anti-echo recheck on d42cdb67 (the strengthened rule
// held: no band-text echo). The handler consults this flag and routes
// Call 1 through buildGroundedCall1Prompt. Call 2 is deliberately NOT
// grounded - that stays an explicit open ruling, not silently decided
// here. Rollback lever: setting this false restores the default Call 1
// prompt byte-exactly, but index.html's prompt-hash mirror must be
// reverted in the same commit or provenance hashes will disagree.
const GROUNDED_PROMPTS_ENABLED = true;

// Documented budget for the whole grounding section: five axes' compact
// snippets plus a bounded glossary comfortably fit; the selector also
// enforces it defensively at runtime. Chars, not tokens - a conservative
// proxy (roughly 4 chars/token puts this near 1.1k tokens at worst).
const GROUNDING_MAX_CHARS = 4500;
const GROUNDING_MAX_GLOSSARY = 8;

// Same cut points as GROUNDING_THRESHOLDS / lib/belief-map-registry.js's
// BAND_THRESHOLDS (parity-tested at 0.01 resolution across 1.00-7.00).
function classifyGroundingBand(score) {
  if (score <= 2.19) return 'strongL';
  if (score <= 3.39) return 'leanL';
  if (score <= 4.60) return 'mid';
  if (score <= 5.80) return 'leanR';
  return 'strongR';
}

// Maps the validated axisMap + fingerprintAxes to a compact grounding
// text: for each fingerprint axis in order (they arrive as the top-5 by
// deviation), the axis label, score, band key, short definition, and the
// FC4-audited band interpretation. Glossary terms are attached only
// mechanically - a term is included when it literally appears in the
// selected snippet text - bounded and deduplicated; no hand-curated
// axis-to-term mapping is invented here. Pure: never mutates inputs,
// never throws on malformed entries (they are skipped).
function groundingContextFrom(axisMap, fingerprintAxes) {
  const lines = [];
  const glossarySeen = new Set();
  const glossaryLines = [];
  let used = 0;
  const fps = Array.isArray(fingerprintAxes) ? fingerprintAxes : [];
  for (const f of fps) {
    if (!f || typeof f.axis !== 'string') continue;
    const data = GROUNDING_DATA[f.axis];
    const score = axisMap ? axisMap[f.axis] : undefined;
    if (!data || typeof score !== 'number' || !Number.isFinite(score)) continue;
    const band = classifyGroundingBand(score);
    const bandText = data.bands[band];
    const snippet = `${data.label} (${score.toFixed(1)}/7): ${data.def}\n  This person's position: ${bandText}`;
    if (used + snippet.length > GROUNDING_MAX_CHARS) break;
    lines.push(snippet);
    used += snippet.length;
    const hay = (data.def + ' ' + bandText).toLowerCase();
    for (const term of Object.keys(GROUNDING_GLOSSARY)) {
      if (glossarySeen.size >= GROUNDING_MAX_GLOSSARY) break;
      const bare = term.replace(/\s*\(.*\)$/, '').toLowerCase();
      if (!glossarySeen.has(term) && bare.length > 3 && hay.includes(bare)) {
        glossarySeen.add(term);
        glossaryLines.push(`- ${term}: ${GROUNDING_GLOSSARY[term]}`);
      }
    }
  }
  let text = lines.join('\n');
  if (glossaryLines.length) {
    const glossaryBlock = '\nTERMS (for your understanding only, never name them in output):\n' + glossaryLines.join('\n');
    if (used + glossaryBlock.length <= GROUNDING_MAX_CHARS) text += glossaryBlock;
  }
  return text;
}

// The staged Call 1 candidate: the default prompt with a GROUNDING
// CONTEXT section inserted ahead of PATTERN NOTES. With empty grounding
// text it returns the default prompt byte-identically - asserted by the
// test suite as the no-drift guarantee. Call 2 grounding is deliberately
// not staged here: the identity essay is where fingerprint grounding
// pays; extending to Call 2 is an explicit open question for the C-5
// activation round, not silently pre-decided.
function buildGroundedCall1Prompt(ctx, groundingText) {
  const base = buildCall1Prompt(ctx);
  if (!groundingText) return base;
  const section = `GROUNDING CONTEXT (reviewed interpretations of this person's five strongest axes):
${groundingText}

GROUNDING RULES:
- The grounding context above is evidence, not prose inventory. Use it to make your claims accurate; never mine it for sentences.
- Translate the evidence into fresh second-person synthesis in your own words. Never copy the interpretations' wording, never closely paraphrase their distinctive sentences, and never reuse their distinctive metaphors, signature constructions, or contrast frames (for example, a memorable image or an "X versus Y was never the choice" framing from an interpretation must not reappear in any form).
- This person will later read those exact interpretation texts elsewhere in their report. Any phrase of yours that would sound duplicated next to them is a failure, even if reworded.
- Ground every claim in the actual scores and this evidence.
- Do not invent biography, relationships, habits, or life events.
- Keep the same second-person warmth as the rest of these instructions.

`;
  return base.replace('PATTERN NOTES:', section + 'PATTERN NOTES:');
}

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
10. Inside the JSON string values, any line break must be written as the two-character escape sequence \\n (backslash then the letter n). Never output an actual line-break character inside a string value.
11. Never use a literal double-quote character inside a JSON string value to quote a word or phrase. Describe what someone said or thought without quotation marks instead. A double-quote inside a string value must be written as the two-character escape sequence \\" (backslash then a double-quote), never as a bare ".

Return ONLY valid JSON, with no markdown fences and no preamble:
{"identity":"5 paragraphs separated by \\n\\n. P1 (3 sentences): How does this person experience the world? What filter does everything pass through, what do they see that most people miss? Start with a specific observation. P2 (3 sentences): How they think and reason. Their relationship with certainty, evidence, authority, their own conclusions. P3 (3 sentences): Their moral and meaning landscape. Not abstract beliefs but how it is likely to show up: what their answers suggest makes them angry, what they feel responsible for. P4 (2 sentences): The central tension in their operating system. Name what this tension is likely to feel like from the inside. P5 (2 sentences): The conditions their answers suggest they come alive in, and the ones likely to quietly exhaust them."}`;
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
Inside the JSON string values, any line break must be written as the two-character escape sequence \\n (backslash then the letter n). Never output an actual line-break character inside a string value. Never use a literal double-quote character inside a JSON string value to quote a word or phrase - describe it without quotation marks instead. A double-quote inside a string value must be written as the two-character escape sequence \\" (backslash then a double-quote), never as a bare ".

Return ONLY valid JSON, with no markdown fences:
{"world":[{"lens":"The Self","icon":"mirror","view":"2-3 sentences on how this person sees their own identity, agency, and inner life. Draw from self, identity, determinism, responsibility scores. What does it feel like to be them on the inside?","shows_up":"2-3 sentences on how this self-view is likely to show up in how you move through the world.","prompt":"One reflective question they can sit with this week. Concrete, not abstract. No em dashes."},{"lens":"Other People","icon":"people","view":"2-3 sentences on how this person sees other people. Draw from human_nature, moral_scope, freewill_practice, responsibility, social_ontology.","shows_up":"2-3 sentences on how this plays out. What are they good at in relationships? What is hard?","prompt":"One reflective question about a specific relationship or interaction. Honest and concrete."},{"lens":"Relationships","icon":"connect","view":"2-3 sentences on how this person approaches connection and belonging. Draw from social_ontology, identity, moral_authority, epistemic_humility, society.","shows_up":"2-3 sentences on how this tends to look in practice.","prompt":"One reflective question about what they might be asking from others that they have not said out loud."},{"lens":"Society","icon":"city","view":"2-3 sentences on how this person sees society and their place in the collective. Draw from society, politics, justice, authority, economics, responsibility.","shows_up":"2-3 sentences on how this tends to shape their day to day.","prompt":"One reflective question about their actual relationship to the collective right now."},{"lens":"Life and Existence","icon":"horizon","view":"2-3 sentences on how this person sees existence itself. Draw from meaning, meaning_practice, teleology, religion, uncertainty, progress.","shows_up":"2-3 sentences on how this is likely to show up in the texture of their days.","prompt":"One honest question about where they are right now in their relationship with their own existence. No em dashes."}]}`;
}

// -- D158/D159 Call 2 five-band grounding selector + prompt path --
// Andre ruled 2026-08-03 (D158) that Call 2 should also receive five-band
// grounding, conditional on clearing the same real-evidence bar Call 1
// cleared at D157/C-5 - not a blind activation. Staged first exactly like
// C-2 staged Call 1: by-construction inert, GROUNDED_CALL2_ENABLED left
// false. A first paid comparison found both default-arm outputs failing
// to parse (a real, separate JSON-escaping defect, fixed at the prompt
// source as D159, `da1d157`); a second paid comparison, re-run after that
// fix, produced a fair result: grounded won on this sample (more specific,
// better calibrated to actual score intensity, no factual/framing errors
// in either arm). Andre ruled GO. ACTIVATED 2026-08-03, same session.
//
// Design, per the working session that produced D158: each of the five
// lenses grounds on its OWN relevant axis pool, not a single shared top-5
// - Call 1's identity essay is one long-form synthesis and a shared
// fingerprint fits it, but Call 2's five lenses are separate, shorter,
// topic-specific sections, and the live (ungrounded) Call 2 prompt
// already tells the model which axes matter to which lens. That existing
// per-lens map was found to be missing 10 axes with real thematic
// relevance during the design conversation - CALL2_LENS_AXES below is
// the corrected map, agreed with Andre before any code was written.
// `realism` was not assigned to any lens - no strong thematic fit was
// found, disclosed as a judgment call rather than forced somewhere weak.
//
// Rollback lever: setting this false restores the default Call 2 prompt
// byte-exactly (PROMPT_BUILDERS/buildCall2Prompt deliberately untouched),
// but index.html's prompt-hash mirror must be reverted in the same commit
// or provenance hashes will disagree - same discipline as D157's Call 1
// rollback lever.
const GROUNDED_CALL2_ENABLED = true;

// Per-lens grounding budget. Call 2 grounds up to five separate lens
// sections (versus Call 1's one), so this is a per-lens cap, not a
// whole-prompt cap like GROUNDING_MAX_CHARS. Proven against the real
// worst case (largest-pool lens, every axis non-mid) by the test suite,
// the same discipline GROUNDING_MAX_CHARS was proven under. Sized
// generously per Andre's D158 direction (depth and rigor over economy):
// the largest pool (lifeAndExistence, 11 axes) has a real worst case of
// 4641 chars; 5200 clears every lens's worst case with headroom.
const CALL2_GROUNDING_MAX_CHARS = 5200;

// Each lens's relevant axis pool, in a fixed display order. Deliberately
// not disjoint across lenses (unlike the Alignment Library's four domain
// sets) - Call 2's lenses are full sections, not short cards, and axes
// like `responsibility`/`social_ontology`/`temporal_orientation`/
// `physicalism` genuinely matter to more than one lens. The anti-echo
// rule below is extended with a cross-lens instruction specifically
// because of this deliberate overlap.
const CALL2_LENS_AXES = {
  self:             ['self', 'identity', 'determinism', 'responsibility', 'mind_consciousness', 'physicalism'],
  otherPeople:      ['human_nature', 'moral_scope', 'freewill_practice', 'responsibility', 'social_ontology', 'ethics', 'knowledge'],
  relationships:    ['social_ontology', 'identity', 'moral_authority', 'epistemic_humility', 'society', 'temporal_orientation'],
  society:          ['society', 'politics', 'justice', 'authority', 'economics', 'responsibility', 'science', 'animal_ethics'],
  lifeAndExistence: ['meaning', 'meaning_practice', 'teleology', 'religion', 'uncertainty', 'progress', 'naturalism', 'moral_ground', 'epistemic_method', 'physicalism', 'temporal_orientation'],
};

const CALL2_LENS_LABELS = {
  self:             'THE SELF',
  otherPeople:      'OTHER PEOPLE',
  relationships:    'RELATIONSHIPS',
  society:          'SOCIETY',
  lifeAndExistence: 'LIFE AND EXISTENCE',
};

// Grounds one lens: every axis in that lens's pool whose classified band
// is NOT 'mid', in pool order. Mid-band axes are skipped deliberately -
// a mid-band interpretation is, by construction, the least decisive text
// the library has for that axis, so including it would pad the prompt
// without adding signal. This means grounding depth scales with how
// distinctive the person actually is on that lens's themes, not a fixed
// count - someone centrist across a lens's whole pool gets a short or
// empty grounding block for it; someone with several extreme positions
// gets deep grounding. Pure: never mutates inputs, never throws on
// malformed entries (skipped).
function call2GroundingContextFrom(axisMap, lensKey) {
  const axisIds = CALL2_LENS_AXES[lensKey];
  if (!Array.isArray(axisIds)) return '';
  const lines = [];
  let used = 0;
  for (const axisId of axisIds) {
    const data = GROUNDING_DATA[axisId];
    const score = axisMap ? axisMap[axisId] : undefined;
    if (!data || typeof score !== 'number' || !Number.isFinite(score)) continue;
    const band = classifyGroundingBand(score);
    if (band === 'mid') continue;
    const bandText = data.bands[band];
    const snippet = `${data.label} (${score.toFixed(1)}/7): ${data.def}\n  This person's position: ${bandText}`;
    if (used + snippet.length > CALL2_GROUNDING_MAX_CHARS) break;
    lines.push(snippet);
    used += snippet.length;
  }
  return lines.join('\n');
}

// Computes the grounding text for all five lenses from one axisMap.
// Pure, deterministic, never throws.
function call2GroundingTextByLens(axisMap) {
  const out = {};
  for (const lensKey of Object.keys(CALL2_LENS_AXES)) {
    out[lensKey] = call2GroundingContextFrom(axisMap, lensKey);
  }
  return out;
}

// The staged Call 2 candidate: the default prompt with a single combined
// GROUNDING CONTEXT section (subdivided by lens) inserted ahead of the
// "Write 5 lenses" instruction. With no grounding text for any lens it
// returns the default prompt byte-identically - the same no-drift
// guarantee C-2's Call 1 builder carries, asserted by the test suite.
function buildGroundedCall2Prompt(ctx, groundingTextByLens) {
  const base = buildCall2Prompt(ctx);
  const lensKeys = Object.keys(CALL2_LENS_AXES).filter(
    (k) => groundingTextByLens && groundingTextByLens[k]);
  if (!lensKeys.length) return base;
  const blocks = lensKeys.map(
    (k) => `${CALL2_LENS_LABELS[k]}:\n${groundingTextByLens[k]}`).join('\n\n');
  const section = `GROUNDING CONTEXT (reviewed interpretations of this person's strongest axes, organized by lens):
${blocks}

GROUNDING RULES:
- The grounding context above is evidence, not prose inventory. Use it to make your claims accurate; never mine it for sentences.
- Translate the evidence into fresh second-person synthesis in your own words, per lens. Never copy the interpretations' wording, never closely paraphrase their distinctive sentences, and never reuse their distinctive metaphors, signature constructions, or contrast frames.
- This person will later read those exact interpretation texts elsewhere in their report. Any phrase of yours that would sound duplicated next to them is a failure, even if reworded.
- These five lenses are read together in one report. Where two lenses ground on the same or a related axis, say something genuinely different in each - do not let two lenses read as restatements of each other.
- Ground every claim in the actual scores and this evidence.
- Do not invent biography, relationships, habits, or life events.
- Keep the same second-person warmth as the rest of these instructions.

`;
  return base.replace('Write 5 lenses', section + 'Write 5 lenses');
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
    logEvent('error', 'rate_limit_store_unconfigured');
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
      logEvent('error', 'rate_limit_lookup_failed', { status: getRes.status });
      return { allowed: false, reason: 'unavailable' };
    }
    const records = await getRes.json();
    const record  = Array.isArray(records) ? records[0] : null;

    if (!record) {
      const createRes = await fetch(`${url}/rest/v1/rate_limits`, {
        method: 'POST', headers,
        body: JSON.stringify({ key, calls: 1, window_start: now.toISOString() }),
      });
      if (!createRes.ok) {
        logEvent('error', 'rate_limit_create_failed', { status: createRes.status });
        return { allowed: false, reason: 'unavailable' };
      }
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    const elapsed = now - new Date(record.window_start);
    if (elapsed > windowMs) {
      const resetRes = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ calls: 1, window_start: now.toISOString() }),
      });
      if (!resetRes.ok) {
        logEvent('error', 'rate_limit_reset_failed', { status: resetRes.status });
        return { allowed: false, reason: 'unavailable' };
      }
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    if (record.calls >= RATE_LIMIT) {
      const resetAt = new Date(new Date(record.window_start).getTime() + windowMs);
      return { allowed: false, reason: 'exceeded', remaining: 0, resetAt: resetAt.toISOString() };
    }

    const incrementRes = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ calls: record.calls + 1 }),
    });
    if (!incrementRes.ok) {
      logEvent('error', 'rate_limit_increment_failed', { status: incrementRes.status });
      return { allowed: false, reason: 'unavailable' };
    }
    return { allowed: true, remaining: RATE_LIMIT - record.calls - 1 };

  } catch (e) {
    logEvent('warn', 'rate_limit_check_exception', { message: e.message });
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

  // -- Call 1 and Call 2 both run on their five-band grounded prompts
  // (D157 activated Call 1; D159's paid comparison then showed grounded
  // Call 2 winning on this sample, and Andre ruled activation). All
  // grounding evidence is derived here from the already-validated
  // numeric context (scores + fingerprint axes) and reviewed registry
  // content only - the client never sends prompt prose, and no identity
  // data can enter it. --
  let promptText;
  if (GROUNDED_PROMPTS_ENABLED && callType === 1) {
    const groundingText = groundingContextFrom(ctx.axisMap, ctx.fingerprintAxes);
    promptText = buildGroundedCall1Prompt(promptCtx, groundingText);
  } else if (GROUNDED_CALL2_ENABLED && callType === 2) {
    const groundingTextByLens = call2GroundingTextByLens(ctx.axisMap);
    promptText = buildGroundedCall2Prompt(promptCtx, groundingTextByLens);
  } else {
    // -- Server controls model, params, and message shape entirely --
    promptText = promptBuilder(promptCtx);
  }
  const messages = [{ role: 'user', content: promptText }];
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
      logEvent('error', 'provider_error', { status: response.status });
      return res.status(502).json({ error: 'Generation service temporarily unavailable' });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    logEvent('error', 'request_failed', { message: e.message });
    return res.status(502).json({ error: 'Generation service temporarily unavailable' });
  }
}

// Exported for containment tests only (A0.1) - not part of the public API surface.
export const __testables__ = {
  validateContext, validateAxisScores, validateFingerprintAxes, validateContradictions,
  isValidArchetypeId, deriveDisplayName, getVerifiedUser, checkRateLimit,
  axisDumpFrom, fingerprintSummaryFrom, contradictionSummaryFrom, liminalNoteFrom,
  buildCall1Prompt, buildCall2Prompt, AXIS_IDS, ARCHETYPE_REGISTRY, CONTRADICTION_REGISTRY,
  // C-2 Call 1 five-band grounding - ACTIVATED (D157, 2026-08-02), now
  // referenced by the handler for real generations:
  GROUNDED_PROMPTS_ENABLED, GROUNDING_MAX_CHARS, GROUNDING_MAX_GLOSSARY,
  GROUNDING_THRESHOLDS, GROUNDING_DATA, GROUNDING_GLOSSARY,
  classifyGroundingBand, groundingContextFrom, buildGroundedCall1Prompt,
  // D158 Call 2 five-band grounding - ACTIVATED (2026-08-03), now
  // referenced by the handler for real generations:
  GROUNDED_CALL2_ENABLED, CALL2_GROUNDING_MAX_CHARS, CALL2_LENS_AXES, CALL2_LENS_LABELS,
  call2GroundingContextFrom, call2GroundingTextByLens, buildGroundedCall2Prompt,
};
