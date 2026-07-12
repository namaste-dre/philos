export const config = { maxDuration: 60 };

// ── Constants ───────────────────────────────────────────
const ALLOWED_ORIGIN  = 'https://phil-os.thelifepm.com';
const DEV_EMAILS      = ['dre63052@gmail.com'];
const RATE_LIMIT      = 6;          // calls per window (3 report = 2 API calls each)
const RATE_WINDOW_HRS = 24;
const MODEL           = 'claude-sonnet-5'; // server-pinned, never client-supplied
const MAX_BODY_CHARS  = 20000;      // oversized-payload guard

// ── A0.1 containment ─────────────────────────────────────
// /api/generate previously accepted a caller-supplied messages array and
// forwarded its content verbatim to the model (RC-1). The client may now
// only send report DATA plus a callType selector. The prompt text itself
// is assembled here, server-side, from fixed templates identical to the
// ones the client used to build directly - this is containment, not the
// B3 generation-boundary refactor. Prose and structure are unchanged.
const ALLOWED_KEYS = new Set(['callType', 'context', 'email']);
const CONTEXT_KEYS = new Set([
  'userName', 'axisDump', 'fingerprintSummary', 'contradictionSummary',
  'liminalNote', 'archFamily', 'archVariant',
]);
const FIELD_CAPS = {
  userName:            100,
  axisDump:            3000,
  fingerprintSummary:  500,
  contradictionSummary: 800,
  liminalNote:         300,
  archFamily:          100,
  archVariant:         100,
};
const MAX_TOKENS_BY_CALL = { 1: 1500, 2: 1800 };

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

// Strips newlines/carriage-returns and other control characters so a data
// field cannot break out of its slot in the fixed template (e.g. inject a
// fake new instruction block), then hard-caps length. Legitimate field
// values are always single-line printable text.
function sanitizeField(value, maxLen) {
  if (typeof value !== 'string') return '';
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const isPrintable = code >= 32 && code !== 127;
    out += isPrintable ? value[i] : ' ';
  }
  return out.slice(0, maxLen).trim();
}

// Returns a fully-populated, capped context object, or null if the shape
// is invalid (unexpected keys, wrong types) or required data is missing.
function validateContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  for (const key of Object.keys(context)) {
    if (!CONTEXT_KEYS.has(key)) return null;
  }
  const ctx = {
    userName:             sanitizeField(context.userName, FIELD_CAPS.userName) || 'this person',
    axisDump:             sanitizeField(context.axisDump, FIELD_CAPS.axisDump),
    fingerprintSummary:   sanitizeField(context.fingerprintSummary, FIELD_CAPS.fingerprintSummary),
    contradictionSummary: sanitizeField(context.contradictionSummary, FIELD_CAPS.contradictionSummary) || 'None',
    liminalNote:          sanitizeField(context.liminalNote, FIELD_CAPS.liminalNote),
    archFamily:           sanitizeField(context.archFamily, FIELD_CAPS.archFamily),
    archVariant:          sanitizeField(context.archVariant, FIELD_CAPS.archVariant),
  };
  if (!ctx.axisDump || !ctx.archFamily || !ctx.archVariant) return null;
  return ctx;
}

// ── Rate limiter (Supabase-backed) ──────────────────────
// A0.1: storage failure or missing configuration now fails CLOSED
// (rejects the request) instead of granting unlimited access.
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

// ── Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS - locked to production domain only
  const origin = req.headers['origin'] || '';
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Service unavailable' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // ── Shape allowlist: no messages/model/max_tokens/role from the client ──
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: 'Invalid request' });
  }

  // ── Oversized payload guard ──
  if (JSON.stringify(body).length > MAX_BODY_CHARS) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // ── Email gate: require email in payload ──
  // Client sends email after modal capture. Blocks console-level bypass.
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return res.status(403).json({ error: 'Email required' });
  }

  // ── callType selects a fixed, server-owned prompt template ──
  const callType = body.callType;
  const promptBuilder = PROMPT_BUILDERS[callType];
  if (!promptBuilder) return res.status(400).json({ error: 'Invalid request' });

  // ── Context: strictly validated data object, never free-form prompt text ──
  const ctx = validateContext(body.context);
  if (!ctx) return res.status(400).json({ error: 'Invalid request' });

  // ── Rate limiting by IP - skipped for dev accounts ──
  const isDev = DEV_EMAILS.includes((body.email || '').toLowerCase().trim());
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

  // ── Server controls model, params, and message shape entirely ──
  const messages = [{ role: 'user', content: promptBuilder(ctx) }];
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
export const __testables__ = { validateContext, sanitizeField, buildCall1Prompt, buildCall2Prompt, checkRateLimit };
