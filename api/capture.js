import crypto from 'crypto';

export const config = { maxDuration: 60 };

const ALLOWED_ORIGIN  = 'https://phil-os.thelifepm.com';

// A0.2: capability token for /api/report. Minted here only after ownership
// is verified (or right after a fresh row is created by its own submitter),
// never on a bare id lookup. This is the "equivalent short-lived proof"
// mechanism named in the A0.2 brief: report.js is a plain server-rendered
// navigation with no way to carry a bearer token, so possession of this
// token (not the bare id) is what proves the viewer was actually handed the
// link.
//
// A7 (D136): must be computed identically to report.js's computeReportToken,
// including the salt branch - a NULL share_token_salt (every row's state
// until a user regenerates) still uses the original legacy formula, so
// existing/never-rotated links keep minting and validating exactly as
// before. See getShareState() below for where the row's current
// share_enabled/share_token_salt is read prior to minting.
function computeReportToken(id, salt) {
  const secret = process.env.SUPABASE_SERVICE_KEY || '';
  const material = salt ? `report-token:${id}:${salt}` : `report-token:${id}`;
  return crypto.createHmac('sha256', secret).update(material).digest('hex').slice(0, 32);
}

// A7 (D136): read the row's current sharing state immediately before
// minting/re-minting a token - never trust a cached or previously-known
// state, since a revoke/regenerate could have happened between requests.
async function getShareState(supabaseUrl, svcHeaders, id) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&select=share_enabled,share_token_salt`,
    { headers: svcHeaders },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}
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

// Same pattern as api/consent.js's getUser() - verifies a session token
// against Supabase Auth directly, never trusts a client-asserted identity.
async function getUser(token) {
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    // Ownership must be verified server-side (IDOR fix): a client-supplied
    // completion_id is only honored if the caller's own auth token proves
    // they own that exact row - share-link IDs are public by design, so
    // "the ID looks valid" is never sufficient authorization on its own.
    let completionId = null;

    if (completion_id) {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const user = token ? await getUser(token) : null;
      if (!user || !user.id) return res.status(401).json({ error: 'Authentication required to attach responses to an existing completion' });

      const ownerCheck = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(completion_id)}&select=user_id`,
        { headers: svcHeaders },
      );
      if (!ownerCheck.ok) return res.status(500).json({ error: 'Ownership check failed' });
      const ownerRows = await ownerCheck.json();
      const owner = ownerRows[0];
      if (!owner || owner.user_id !== user.id) return res.status(403).json({ error: 'Not authorized for this completion' });

      completionId = completion_id;
    }

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

    // A0.2: minted only once ownership is established above (either the
    // caller just proved they own completionId, or they are the one who
    // just created it) - never handed out for a bare id lookup.
    // A7 (D136): mint using the row's current share state, and refuse to
    // mint an active-looking token if sharing has been explicitly turned
    // off - the client must see a clear disabled state, never a token that
    // will just 404 silently at report.js with no explanation.
    let reportToken = null;
    let shareEnabled = true;
    if (completionId) {
      const shareState = await getShareState(supabaseUrl, svcHeaders, completionId);
      shareEnabled = !shareState || shareState.share_enabled !== false;
      if (shareEnabled) {
        reportToken = computeReportToken(completionId, shareState ? shareState.share_token_salt : null);
      }
    }

    return res.status(200).json({ ok: true, completion_id: completionId, responses_saved: responsesOk, share_enabled: shareEnabled, report_token: reportToken });

  } catch (e) {
    console.error('Capture error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// Exported for containment tests only (A0.2/A7) - not part of the public API surface.
export const __testables__ = { computeReportToken, getShareState };
