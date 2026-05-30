export const config = { maxDuration: 60 };

// ── Constants ───────────────────────────────────────────
const ALLOWED_ORIGIN  = 'https://phil-os.thelifepm.com';
const DEV_EMAILS      = ['dre63052@gmail.com'];
const RATE_LIMIT      = 6;          // calls per window (3 report = 2 API calls each)
const RATE_WINDOW_HRS = 24;
const MAX_TOKENS_CAP  = 2500;       // hard ceiling — client cannot exceed this
const ALLOWED_MODELS  = ['claude-sonnet-4-20250514'];

// ── Rate limiter (Supabase-backed) ──────────────────────
async function checkRateLimit(key) {
  const url    = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) return { allowed: true }; // fail open if misconfigured

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
      return { allowed: false, remaining: 0, resetAt: resetAt.toISOString() };
    }

    await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ calls: record.calls + 1 }),
    });
    return { allowed: true, remaining: RATE_LIMIT - record.calls - 1 };

  } catch (e) {
    console.warn('[generate] Rate limit check failed:', e.message);
    return { allowed: true }; // fail open — never block user due to DB issue
  }
}

// ── Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS — locked to production domain only
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
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' });

  // ── Email gate: require email in payload ──
  // Client sends email after modal capture. Blocks console-level bypass.
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return res.status(403).json({ error: 'Email required' });
  }

  // ── Model validation: prevent model injection ──
  const model = body.model || 'claude-sonnet-4-20250514';
  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: 'Invalid model' });
  }

  // ── Rate limiting by IP — skipped for dev accounts ──
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
    return res.status(429).json({
      error:   'Rate limit reached. Maximum 3 reports per 24 hours.',
      resetAt: rate.resetAt,
    });
  }

  // ── Cap tokens — client cannot request more than MAX_TOKENS_CAP ──
  const maxTokens = Math.min(
    typeof body.max_tokens === 'number' ? body.max_tokens : 1000,
    MAX_TOKENS_CAP
  );

  // ── Messages: require array, cap at 4 entries, cap each message at 12000 chars ──
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  const messages = body.messages.slice(0, 4).map(m => ({
    role:    m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content.slice(0, isDev ? 32000 : 16000) : '',
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
