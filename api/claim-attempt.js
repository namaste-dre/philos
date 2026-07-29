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
// completed_at, claimed_at - no schema change.
//
// Only a 'pending' or 'complete' existing attempt bypasses the cap check -
// that is a genuine in-flight claim or a deterministic replay, never new
// generation work. An existing 'failed' row does NOT bypass: reclaiming it
// is itself another attempt at real generation work and must be gated the
// same as a brand-new attempt, or unlimited retries of one attempt_id could
// never be capped (claim_attempt() reclaims a failed row back to 'pending'
// in place - it never becomes a second row the count could see). Lyra/Codex
// review (2026-07-29) on the first version of this check - see the Build
// Log and F1 Remaining Items Packet for the corrected round.
const MONTHLY_SUCCESS_CAP = 2;
const MONTHLY_FAILED_CAP = 3;

// Returns null if no completions row exists yet for this attempt_id/user,
// otherwise the row's current attempt_status ('pending'/'complete'/'failed').
async function getExistingAttemptStatus(supabaseUrl, svcHeaders, attemptId, userId) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/completions?attempt_id=eq.${encodeURIComponent(attemptId)}&user_id=eq.${encodeURIComponent(userId)}&select=attempt_status`,
    { headers: svcHeaders },
  );
  if (!res.ok) throw new Error('Attempt-state check failed');
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0].attempt_status : null;
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

// D118 architecture addendum, path (a), 2026-07-29: honors an onboarding-
// time research-consent "yes" (recorded via set_consent()'s 'research'
// branch as profiles.research_consent) by populating research_profiles at
// the first successful report completion - research-sync.js's own opt-in
// path never runs for these users otherwise, since it hard-requires a
// completion to already exist.
//
// researchKeyFor() must derive the exact same research_key research-sync.js
// derives for the same user (required for merge-duplicates to ever find the
// same row rather than silently creating a second one), but this file's own
// test harness forbids the module under test from using any `import`
// statement (api/claim-attempt.test.js's loadModule() throws on one) - so
// this uses the global Web Crypto API (crypto.subtle, no import needed,
// same as this file's existing global `fetch` usage) instead of
// research-sync.js's `import crypto from 'crypto'` + createHmac. For the
// configured production pepper (a non-empty RESEARCH_KEY_PEPPER), both
// compute the identical standard HMAC-SHA256(pepper, userId) value -
// verified byte-for-byte identical, hex-for-hex. They are NOT equivalent if
// the pepper is missing/empty: Node's createHmac silently accepts a
// zero-length key, but Web Crypto's importKey rejects one outright
// (DataError: "Zero-length key is not supported"). Rather than let that
// divergence surface as an unexplained runtime throw, this path intentionally
// fails closed - a missing pepper is a real misconfiguration, and honoring
// research consent with an effectively unkeyed (or silently differently-keyed
// on research-sync.js's side) research_key would be worse than skipping the
// honoring step for this completion. The caller (honorResearchConsentIfNeeded,
// called from the 'complete' action) already catches and logs this - the
// user-facing response still returns 200 either way.
async function researchKeyFor(userId) {
  const pepper = process.env.RESEARCH_KEY_PEPPER || '';
  if (!pepper) throw new Error('RESEARCH_KEY_PEPPER is required for research consent honoring');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(userId));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ageRange(age) {
  const n = parseInt(age, 10);
  if (isNaN(n) || n < 13) return null;
  const lo = Math.floor(n / 10) * 10;
  return `${lo}-${lo + 9}`;
}

// Best-effort only - a failure here must never surface as a 'complete'
// action failure to the user; the report itself already finalized
// successfully by the time this runs. Errors are logged, not thrown.
async function honorResearchConsentIfNeeded(supabaseUrl, svcHeaders, userId, completionId) {
  const profRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=research_consent,age,country`,
    { headers: svcHeaders },
  );
  if (!profRes.ok) throw new Error('Could not read profile for research-consent honoring');
  const profRows = await profRes.json();
  const profile = Array.isArray(profRows) ? profRows[0] : null;
  if (!profile || profile.research_consent !== true) return;

  const key = await researchKeyFor(userId);

  // Idempotency gate: skip entirely if a row already exists for this user's
  // research_key (e.g. a retake's second completion, or a user who already
  // has one from the Settings-toggle path). The research_profiles POST
  // below is itself a merge-duplicates upsert keyed on research_key, so
  // this check is a belt-and-suspenders skip, not the only safety net -
  // even a raced double-call cannot create a duplicate row.
  const existingRes = await fetch(
    `${supabaseUrl}/rest/v1/research_profiles?research_key=eq.${key}&select=research_key&limit=1`,
    { headers: svcHeaders },
  );
  if (!existingRes.ok) throw new Error('Could not check existing research_profiles row');
  const existingRows = await existingRes.json();
  if (Array.isArray(existingRows) && existingRows.length > 0) return;

  const compRes = await fetch(
    `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(completionId)}&select=archetype_family,archetype_variant,scores,fingerprint,contradictions_count,instrument_version`,
    { headers: svcHeaders },
  );
  if (!compRes.ok) throw new Error('Could not read completion for research-profile population');
  const compRows = await compRes.json();
  const completion = Array.isArray(compRows) ? compRows[0] : null;
  if (!completion) return;

  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/research_profiles`, {
    method: 'POST',
    headers: { ...svcHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      research_key:          key,
      age_range:              ageRange(profile.age),
      country_code:           profile.country || null,
      scores:                 completion.scores,
      fingerprint:            completion.fingerprint,
      archetype_family:       completion.archetype_family,
      archetype_variant:      completion.archetype_variant,
      contradictions_count:   completion.contradictions_count,
      instrument_version:     completion.instrument_version,
      research_consented_at:  new Date().toISOString(),
    }),
  });
  if (!upsertRes.ok) throw new Error('Failed to write research profile: ' + await upsertRes.text());
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
        let existingStatus;
        try {
          existingStatus = await getExistingAttemptStatus(supabaseUrl, svcHeaders, attemptId, user.id);
        } catch (e) {
          console.error('claim-attempt cap pre-check failed:', e.message);
          return res.status(500).json({ error: 'Could not verify attempt state' });
        }

        // Bypass only for a genuine in-flight claim ('pending') or a
        // deterministic replay ('complete') - neither is new generation
        // work. No row yet, or an existing 'failed' row (a reclaim), both
        // fall through to the cap check below.
        const bypassCap = existingStatus === 'pending' || existingStatus === 'complete';

        if (!bypassCap) {
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

          // Lyra/Codex review (2026-07-29, second pass): a 'failed' attempt_id
          // must never be silently reclaimed into new generation work, even
          // below both caps - the reload/resume path (a stale failed
          // attempt_id restored from saved progress) could otherwise keep
          // colliding onto the same row indefinitely without ever
          // consuming a distinct failed-generation slot. Each failed row is
          // single-use from this endpoint's perspective: once failed, it is
          // never reclaimed here again - the client must mint a fresh
          // attempt_id. The claim_attempt() RPC's own failed-row reclaim
          // branch is therefore unreachable from this endpoint now (its
          // stale-pending reclaim branch is untouched and still used).
          if (existingStatus === 'failed') {
            return res.status(409).json({
              error: 'failed_attempt_restart_required',
              message: 'This attempt already failed. Please start a fresh generation attempt.',
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

      // D118 path (a): best-effort only, deliberately after the response
      // above would already be safe to send - never let a research-profile
      // honoring failure turn a successful report completion into a user-
      // visible error.
      try {
        await honorResearchConsentIfNeeded(supabaseUrl, svcHeaders, user.id, id);
      } catch (e) {
        console.error('claim-attempt research-consent honoring failed:', e.message);
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

// Exported for containment tests only (A1/D117/D118) - not part of the public API surface.
export const __testables__ = {
  verifyOwnership, pick, COMPLETE_COLUMNS, UUID_RE,
  getExistingAttemptStatus, countCompletionsThisMonth, startOfCurrentMonthISO,
  MONTHLY_SUCCESS_CAP, MONTHLY_FAILED_CAP,
  researchKeyFor, ageRange, honorResearchConsentIfNeeded,
};
