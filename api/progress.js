export const config = { maxDuration: 15 };

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';
const RATE_LIMIT      = 120;  // saves per session per window (2s client debounce -> generous ceiling)
const RATE_WINDOW_HRS = 1;

async function checkRateLimit(key) {
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
    const getRes  = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}&select=calls,window_start`, { headers });
    const records = await getRes.json();
    const record  = Array.isArray(records) ? records[0] : null;

    if (!record) {
      await fetch(`${url}/rest/v1/rate_limits`, { method: 'POST', headers, body: JSON.stringify({ key, calls: 1, window_start: now.toISOString() }) });
      return { allowed: true };
    }
    const elapsed = now - new Date(record.window_start);
    if (elapsed > windowMs) {
      await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, { method: 'PATCH', headers, body: JSON.stringify({ calls: 1, window_start: now.toISOString() }) });
      return { allowed: true };
    }
    if (record.calls >= RATE_LIMIT) return { allowed: false };
    await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, { method: 'PATCH', headers, body: JSON.stringify({ calls: record.calls + 1 }) });
    return { allowed: true };
  } catch (e) {
    console.warn('[progress] rate limit check failed:', e.message);
    return { allowed: true };
  }
}

function isValidSessionId(s) {
  return typeof s === 'string' && /^[0-9a-f-]{8,64}$/i.test(s);
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Database not configured' });

  const svcHeaders = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };

  if (req.method === 'GET') {
    const sessionId = req.query.session_id;
    if (!isValidSessionId(sessionId)) return res.status(400).json({ error: 'Invalid session_id' });
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/anon_progress?session_id=eq.${sessionId}&select=answers,qa_flags,current_q`, { headers: svcHeaders });
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'No saved progress' });
      return res.status(200).json({ ok: true, progress: rows[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

  const { session_id, answers, qa_flags, current_q } = body;
  if (!isValidSessionId(session_id)) return res.status(400).json({ error: 'Invalid session_id' });
  if (typeof answers !== 'object' || answers === null) return res.status(400).json({ error: 'answers must be an object' });
  if (typeof current_q !== 'number' || current_q < 0) return res.status(400).json({ error: 'current_q must be a non-negative number' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const rate = await checkRateLimit(`progress:${ip}`);
  if (!rate.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/anon_progress`, {
      method: 'POST',
      headers: { ...svcHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        session_id,
        answers,
        qa_flags: (typeof qa_flags === 'object' && qa_flags !== null) ? qa_flags : {},
        current_q,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) return res.status(500).json({ ok: false, error: await r.text() });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
