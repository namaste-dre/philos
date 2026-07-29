export const config = { maxDuration: 30 };

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A1 (D110): atomic assessment-attempt claim/complete/fail lifecycle. The
// actual atomicity lives in the claim_attempt() Postgres function (single
// unique index on completions.attempt_id, INSERT ... ON CONFLICT DO
// NOTHING - a second claimant never runs duplicate LLM work). This endpoint
// only verifies identity and forwards to that function via the service
// key, same pattern as api/capture.js and api/consent.js: a service-role
// write never trusts a client-supplied identity, only what this endpoint
// itself verified against Supabase Auth.

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

// Explicit column allowlist for the 'complete' action - never spread raw
// client JSON into the update (same discipline as api/capture.js's
// COMPLETION_COLUMNS).
const COMPLETE_COLUMNS = [
  'first_name', 'email', 'country', 'gdpr_consent', 'consented_at',
  'archetype_family', 'archetype_variant', 'scores', 'fingerprint',
  'contradictions_count', 'completed_at', 'source', 'qa_mode',
  'report_json', 'instrument_version', 'gender', 'age',
  'report_version', 'prompt_hash', 'model', 'temperature', 'generated_at',
];

function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

async function verifyOwnership(supabaseUrl, svcHeaders, id, userId) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&select=user_id`,
    { headers: svcHeaders },
  );
  if (!res.ok) return { ok: false, status: 500, error: 'Ownership check failed' };
  const rows = await res.json();
  const owner = rows[0];
  if (!owner || owner.user_id !== userId) return { ok: false, status: 403, error: 'Not authorized for this completion' };
  return { ok: true };
}

// D117: monthly generation caps (2 full report generations / 3 failed
// generations per user per month, QA mode excluded). Enforced entirely
// against existing completions columns - user_id, qa_mode, attempt_status,
// completed_at, claimed_at - no schema change. Only gates a genuinely NEW
// attempt (attempt_id not already claimed by this user) - continuing an
// already-claimed attempt (a retry after an in-flight failure, same
// attempt_id, before it succeeds or is abandoned) is not a new generation
// slot and is never capped here, matching today's existing retry behavior
// unchanged.
const MONTHLY_SUCCESS_CAP = 2;
const MONTHLY_FAILED_CAP = 3;

async function hasExistingAttemptRow(supabaseUrl, svcHeaders, attemptId, userId) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/completions?attempt_id=eq.${encodeURIComponent(attemptId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`,
    { headers: svcHeaders },
  );
  if (!res.ok) throw new Error('Attempt-state check failed');
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

function startOfCurrentMonthISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// Successful generations are timestamped by completed_at. Failed attempts
// never set completed_at - claim_attempt() leaves it NULL by design - so
// claimed_at (set at claim time, refreshed on every reclaim of the same
// row) is the only existing timestamp usable for the failed-generation
// window. This counts distinct completions rows sitting in each status
// this month, not every individual retry click: a single attempt_id
// retried several times before finally succeeding or being abandoned is
// one row throughout, so it can only ever contribute at most one count
// toward either cap, never one per retry.
async function countCompletionsThisMonth(supabaseUrl, svcHeaders, userId, attemptStatus, timestampColumn) {
  const monthStart = startOfCurrentMonthISO();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/completions?user_id=eq.${encodeURIComponent(userId)}&qa_mode=eq.false&attempt_status=eq.${attemptStatus}&${timestampColumn}=gte.${encodeURIComponent(monthStart)}&select=id`,
    { headers: svcHeaders },
  );
  if (!res.ok) throw new Error(`Could not count ${attemptStatus} completions`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
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
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Database not configured' });

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const user = await getUser(token);
  if (!user || !user.id) return res.status(401).json({ error: 'Invalid or expired session' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const svcHeaders = {
    'Content-Type':  'application/json',
    'apikey':        supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  const { action } = body;

  try {
    if (action === 'claim') {
      const attemptId = body.attempt_id;
      if (typeof attemptId !== 'string' || !UUID_RE.test(attemptId)) {
        return res.status(400).json({ error: 'Invalid request' });
      }
      const qaMode = body.qa_mode === true;

      if (!qaMode) {
        let alreadyClaimed;
        try {
          alreadyClaimed = await hasExistingAttemptRow(supabaseUrl, svcHeaders, attemptId, user.id);
        } catch (e) {
          console.error('claim-attempt cap pre-check failed:', e.message);
          return res.status(500).json({ error: 'Could not verify attempt state' });
        }

        if (!alreadyClaimed) {
          let successCount, failedCount;
          try {
            successCount = await countCompletionsThisMonth(supabaseUrl, svcHeaders, user.id, 'complete', 'completed_at');
            failedCount  = await countCompletionsThisMonth(supabaseUrl, svcHeaders, user.id, 'failed', 'claimed_at');
          } catch (e) {
            console.error('claim-attempt cap count failed:', e.message);
            return res.status(500).json({ error: 'Could not verify generation caps' });
          }
          if (successCount >= MONTHLY_SUCCESS_CAP) {
            return res.status(403).json({
              error: 'monthly_generation_cap_reached',
              cap: 'success',
              message: `You've reached your ${MONTHLY_SUCCESS_CAP} full report generations for this month. Your cap resets at the start of next month.`,
            });
          }
          if (failedCount >= MONTHLY_FAILED_CAP) {
            return res.status(403).json({
              error: 'monthly_generation_cap_reached',
              cap: 'failed',
              message: `You've reached your ${MONTHLY_FAILED_CAP} failed generations for this month. Please contact dre63052@gmail.com for help.`,
            });
          }
        }
      }

      const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_attempt`, {
        method: 'POST',
        headers: svcHeaders,
        body: JSON.stringify({ p_attempt_id: attemptId, p_user_id: user.id, p_qa_mode: qaMode }),
      });
      if (!rpcRes.ok) {
        const text = await rpcRes.text();
        console.error('claim_attempt RPC failed:', text);
        return res.status(500).json({ error: 'Could not claim attempt' });
      }
      const rows = await rpcRes.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) return res.status(500).json({ error: 'Could not claim attempt' });

      return res.status(200).json({
        id:              row.out_id,
        status:          row.out_status,
        report_json:     row.out_report_json,
        should_generate: !!row.out_should_generate,
      });
    }

    if (action === 'complete') {
      const id = body.id;
      if (typeof id !== 'string' || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid request' });

      const owned = await verifyOwnership(supabaseUrl, svcHeaders, id, user.id);
      if (!owned.ok) return res.status(owned.status).json({ error: owned.error });

      const fields = pick(body, COMPLETE_COLUMNS);
      fields.attempt_status = 'complete';

      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&attempt_status=eq.pending`,
        { method: 'PATCH', headers: { ...svcHeaders, 'Prefer': 'return=minimal' }, body: JSON.stringify(fields) },
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error('claim-attempt complete failed:', text);
        return res.status(500).json({ error: 'Could not finalize attempt' });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'fail') {
      const id = body.id;
      if (typeof id !== 'string' || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid request' });

      const owned = await verifyOwnership(supabaseUrl, svcHeaders, id, user.id);
      if (!owned.ok) return res.status(owned.status).json({ error: owned.error });

      const updateRes = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&attempt_status=eq.pending`,
        { method: 'PATCH', headers: { ...svcHeaders, 'Prefer': 'return=minimal' }, body: JSON.stringify({ attempt_status: 'failed' }) },
      );
      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error('claim-attempt fail failed:', text);
        return res.status(500).json({ error: 'Could not mark attempt failed' });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid request' });

  } catch (e) {
    console.error('claim-attempt error:', e.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

// Exported for containment tests only (A1/D117) - not part of the public API surface.
export const __testables__ = {
  verifyOwnership, pick, COMPLETE_COLUMNS, UUID_RE,
  hasExistingAttemptRow, countCompletionsThisMonth, startOfCurrentMonthISO,
  MONTHLY_SUCCESS_CAP, MONTHLY_FAILED_CAP,
};
