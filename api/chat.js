export const config = { maxDuration: 30 };

// ── Constants ───────────────────────────────────────────
const ALLOWED_ORIGIN      = 'https://phil-os.thelifepm.com';
const DAILY_MSG_LIMIT     = 100;   // messages per user per 24 hours
const SESSION_MSG_LIMIT   = 40;    // messages per session (enforced client + server)
const MAX_INPUT_CHARS     = 2000;  // user message length cap
const MAX_TOKENS          = 600;   // response length cap
const RATE_WINDOW_HRS     = 24;

// ── Rate limiter (Supabase-backed, shared pattern with generate.js) ──
async function checkRateLimit(key, limit) {
  const url    = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) return { allowed: true };

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
    const records = await getRes.json();
    const record  = Array.isArray(records) ? records[0] : null;

    if (!record) {
      await fetch(`${url}/rest/v1/rate_limits`, {
        method: 'POST', headers,
        body: JSON.stringify({ key, calls: 1, window_start: now.toISOString() }),
      });
      return { allowed: true, remaining: limit - 1 };
    }

    const elapsed = now - new Date(record.window_start);
    if (elapsed > windowMs) {
      await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ calls: 1, window_start: now.toISOString() }),
      });
      return { allowed: true, remaining: limit - 1 };
    }

    if (record.calls >= limit) {
      const resetAt = new Date(new Date(record.window_start).getTime() + windowMs);
      return { allowed: false, remaining: 0, resetAt: resetAt.toISOString() };
    }

    await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ calls: record.calls + 1 }),
    });
    return { allowed: true, remaining: limit - record.calls - 1 };

  } catch (e) {
    console.warn('[chat] Rate limit check failed:', e.message);
    return { allowed: true };
  }
}

// ── Verify Supabase JWT and return user ─────────────────
async function getUser(token) {
  const url    = process.env.SUPABASE_URL;
  const anon   = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return null;

  try {
    const res  = await fetch(`${url}/auth/v1/user`, {
      headers: {
        'apikey':        anon,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Build system prompt from user's Phil OS context ─────
function buildSystemPrompt(ctx) {
  const name         = ctx.userName   || 'the user';
  const archetype    = ctx.archetype  || 'unknown archetype';
  const variant      = ctx.variant    || '';
  const description  = ctx.description || '';
  const fingerprint  = Array.isArray(ctx.fingerprint) ? ctx.fingerprint : [];
  const contradictions = Array.isArray(ctx.contradictions) ? ctx.contradictions : [];
  const scores       = ctx.scores && typeof ctx.scores === 'object' ? ctx.scores : {};

  const fpLines = fingerprint.slice(0, 5).map(f =>
    `  • ${f.label}: ${f.score}/7 (${f.pole})`
  ).join('\n');

  const contraLines = contradictions.slice(0, 6).map(c =>
    `  [${c.tier}] ${c.title}: ${c.text ? c.text.slice(0, 120) + '...' : ''}`
  ).join('\n');

  const scoreLines = Object.entries(scores)
    .map(([axis, score]) => `${axis}:${parseFloat(score).toFixed(1)}`)
    .join(' | ');

  return `You are Phil — the philosophical guide built into Phil OS. You are having a one-on-one conversation with ${name}, who has just completed their philosophical assessment.

YOUR ROLE:
- Help ${name} explore, understand, and stress-test their own philosophical operating system.
- Go deep. This is not a quiz recap. You are a Socratic interlocutor — you ask sharp questions, surface tensions, and push thinking forward.
- You have full access to ${name}'s complete profile. Use it. Reference specific axes, contradictions, and scores when they are relevant. Make it personal.
- You are not a therapist. You are not a life coach. You are a philosophical sparring partner.
- Validate what is coherent. Challenge what is inconsistent. Name tensions honestly.
- Speak like a thoughtful person, not like an AI assistant. No lists unless asked. No bullet points in conversational responses. Short paragraphs.

${name.toUpperCase()}'S PROFILE:

Archetype: ${archetype}${variant ? ` — ${variant}` : ''}
${description ? `Description: ${description}` : ''}

Philosophical Fingerprint (most defining axes):
${fpLines || '  Not available'}

Detected Contradictions:
${contraLines || '  None detected'}

Full Axis Scores (1=left pole, 7=right pole):
${scoreLines || 'Not available'}

AXIS REFERENCE (1=left pole, 7=right pole):
- naturalism: 1=supernatural, 7=naturalist
- physicalism: 1=non-physical mind, 7=physical mind  
- realism: 1=reality mind-constructed, 7=reality mind-independent
- determinism: 1=genuine free will, 7=hard determinism
- moral_ground: 1=ethics subjective, 7=moral facts objective
- meaning: 1=meaning constructed, 7=meaning discovered
- teleology: 1=no cosmic direction, 7=universe has purpose
- human_nature: 1=blank slate, 7=fixed human nature
- epistemic_method: 1=faith/revelation primary, 7=empirical evidence primary
- social_ontology: 1=society=individuals, 7=structures shape people
- temporal_orientation: 1=past tradition, 7=future progress
- moral_authority: 1=God/scripture, 7=individual conscience
- epistemic_humility: 1=confident, 7=genuinely uncertain
- freewill_practice: 1=holds people accountable, 7=attributes to causes
- justice: 1=punishment-based, 7=rehabilitative/structural
- ethics: 1=rule-based/deontological, 7=outcome-based/consequentialist
- religion: 1=faith-positive, 7=anti-theist
- politics: 1=individual/market, 7=structural/collective
- self: 1=free author, 7=product of causes
- responsibility: 1=personal, 7=structural explanations
- authority: 1=deferential, 7=skeptical

CONVERSATION RULES:
- Never invent scores or facts about ${name}'s profile that are not in the data above.
- If asked something outside your data (e.g. a score you don't have), say so directly.
- Keep responses concise — 3 to 6 sentences for most turns unless a longer answer is genuinely warranted.
- No em dashes. No bullet points in natural conversation. No "Great question."
- When ${name} is exploring a tension in their own thinking, stay with it. Do not rush to resolution.
- You can disagree with ${name}. You can say "that doesn't follow from your own stated position."`;
}

// ── Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
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
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // ── Auth: require valid Supabase JWT ──
  const authHeader = req.headers['authorization'] || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const user = await getUser(token);
  if (!user || !user.id) return res.status(401).json({ error: 'Invalid or expired session' });

  // ── Paid tier check — ENABLE WHEN MONETISATION LAUNCHES ──
  // const isPaid = user.user_metadata?.plan === 'paid';
  // if (!isPaid) return res.status(403).json({ error: 'Chat requires a paid account' });

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' });

  // ── Session message limit ──
  const sessionCount = typeof body.sessionMessageCount === 'number' ? body.sessionMessageCount : 0;
  if (sessionCount >= SESSION_MSG_LIMIT) {
    return res.status(429).json({
      error: `Session limit reached (${SESSION_MSG_LIMIT} messages). Start a new conversation.`,
      code:  'SESSION_LIMIT',
    });
  }

  // ── Daily rate limit per user ──
  const rateKey = `chat:${user.id}`;
  const rate    = await checkRateLimit(rateKey, DAILY_MSG_LIMIT);
  if (!rate.allowed) {
    return res.status(429).json({
      error:   `Daily limit reached (${DAILY_MSG_LIMIT} messages). Resets in 24 hours.`,
      resetAt: rate.resetAt,
      code:    'DAILY_LIMIT',
    });
  }

  // ── Validate + sanitize messages ──
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Cap conversation history at 20 turns (40 messages) to control context window cost
  const messages = body.messages.slice(-40).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string'
      ? m.content.slice(0, MAX_INPUT_CHARS)
      : '',
  })).filter(m => m.content.length > 0);

  if (messages.length === 0) return res.status(400).json({ error: 'No valid messages' });

  // ── Context: validate structure, don't trust blindly ──
  const ctx = body.context && typeof body.context === 'object' ? body.context : {};
  // Strip any injected instruction keys — only allow known fields
  const safeCtx = {
    userName:      typeof ctx.userName    === 'string' ? ctx.userName.slice(0, 40)    : '',
    archetype:     typeof ctx.archetype   === 'string' ? ctx.archetype.slice(0, 80)   : '',
    variant:       typeof ctx.variant     === 'string' ? ctx.variant.slice(0, 80)     : '',
    description:   typeof ctx.description === 'string' ? ctx.description.slice(0, 400): '',
    fingerprint:   Array.isArray(ctx.fingerprint)   ? ctx.fingerprint.slice(0, 5)     : [],
    contradictions:Array.isArray(ctx.contradictions) ? ctx.contradictions.slice(0, 6) : [],
    scores:        ctx.scores && typeof ctx.scores === 'object' ? ctx.scores           : {},
  };

  const systemPrompt = buildSystemPrompt(safeCtx);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-5',
        max_tokens: MAX_TOKENS,
        thinking:   { type: 'disabled' },
        system:     systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    // Add remaining count to response headers for client UI
    if (rate.remaining !== undefined) {
      res.setHeader('X-RateLimit-Remaining', rate.remaining);
    }

    return res.status(response.status).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
