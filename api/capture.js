export const config = { maxDuration: 60 };

const ALLOWED_ORIGIN  = 'https://phil-os.thelifepm.com';
const RATE_LIMIT      = 20;   // captures per IP per window
const RATE_WINDOW_HRS = 1;

// Explicit column allowlist - never spread raw client JSON into the insert
const COMPLETION_COLUMNS = [
  'first_name', 'email', 'country', 'gdpr_consent', 'consented_at',
  'archetype_family', 'archetype_variant', 'scores', 'fingerprint',
  'contradictions_count', 'completed_at', 'source', 'qa_mode',
  'report_json', 'instrument_version', 'axis_count', 'question_count',
  'gender', 'age',
  'report_version', 'prompt_hash', 'model', 'temperature', 'generated_at',
];
const RESPONSE_COLUMNS = [
  'question_id', 'question_text', 'axis', 'tier', 'question_type',
  'answer_value', 'answer_text', 'reversed', 'scored_value', 'weight',
  'instrument_version', 'dev_flag', 'dev_note',
];

function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

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
    console.warn('[capture] rate limit check failed:', e.message);
    return { allowed: true };
  }
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ ok: false, error: 'Database not configured' });

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const rate = await checkRateLimit(`capture:${ip}`);
  if (!rate.allowed) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { responses, session_id, completion_id } = body;

  const svcHeaders = {
    'Content-Type':  'application/json',
    'apikey':        supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  try {
    // D105: signed-in callers already created the canonical completions row
    // themselves (saveCompletionToAccount) and only need responses attached
    // to it here - never a second completions row for the same generation.
    let completionId = completion_id || null;

    if (!completionId) {
      const completionData = pick(body, COMPLETION_COLUMNS);
      if (Object.keys(completionData).length === 0) return res.status(400).json({ error: 'No valid completion fields provided' });

      const completionResponse = await fetch(`${supabaseUrl}/rest/v1/completions`, {
        method: 'POST',
        headers: { ...svcHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(completionData),
      });

      if (!completionResponse.ok) {
        const text = await completionResponse.text();
        console.error('Supabase completions error:', text);
        return res.status(500).json({ ok: false, error: text });
      }

      const completionRows = await completionResponse.json();
      completionId = completionRows[0]?.id;
    }

    let responsesOk = true;
    if (completionId && Array.isArray(responses) && responses.length > 0) {
      const responseRows = responses.map(r => ({ ...pick(r, RESPONSE_COLUMNS), completion_id: completionId }));

      const responsesResponse = await fetch(`${supabaseUrl}/rest/v1/responses`, {
        method: 'POST',
        headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify(responseRows),
      });

      if (!responsesResponse.ok) {
        const text = await responsesResponse.text();
        console.error('Supabase responses error:', text);
        responsesOk = false;
      }
    }

    // Completion succeeded - the anonymous autosave row (if any) is now redundant
    if (session_id && typeof session_id === 'string') {
      fetch(`${supabaseUrl}/rest/v1/anon_progress?session_id=eq.${session_id}`, {
        method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      }).catch(e => console.warn('anon_progress cleanup failed:', e.message));
    }

    return res.status(200).json({ ok: true, completion_id: completionId, responses_saved: responsesOk });

  } catch (e) {
    console.error('Capture error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
