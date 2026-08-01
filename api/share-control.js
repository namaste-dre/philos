import crypto from 'crypto';
import observability from '../lib/observability.js';
const { logEvent } = observability;

export const config = { maxDuration: 15 };

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A7 (D-1/D136): the smallest endpoint needed to let a report owner turn
// their public share link off (revoke) or issue a fresh, unguessable one
// that permanently replaces it (regenerate). No history, no per-viewer
// tracking, no scheduling - a bare on/off plus rotate, matching Andre's
// explicit "minimal, launch-safe, not a sharing dashboard" scope for D-1.
//
// Same identity/ownership pattern as api/claim-attempt.js and
// api/consent.js: a service-role write never trusts a client-asserted
// completion id or user id, only what this endpoint itself verified against
// Supabase Auth and the row's own user_id.

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

// Must match report.js/capture.js's computeReportToken exactly - these
// files intentionally have no shared module (separate serverless contexts),
// so the formula is duplicated here the same way it already is between
// those two files.
function computeReportToken(id, salt) {
  const secret = process.env.SUPABASE_SERVICE_KEY || '';
  const material = salt ? `report-token:${id}:${salt}` : `report-token:${id}`;
  return crypto.createHmac('sha256', secret).update(material).digest('hex').slice(0, 32);
}

function newSalt() {
  return crypto.randomBytes(32).toString('hex');
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

  const { action, completion_id: id } = body;
  if (typeof id !== 'string' || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid request' });
  if (action !== 'revoke' && action !== 'regenerate') return res.status(400).json({ error: 'Invalid action' });

  const svcHeaders = {
    'Content-Type':  'application/json',
    'apikey':        supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  try {
    const owned = await verifyOwnership(supabaseUrl, svcHeaders, id, user.id);
    if (!owned.ok) return res.status(owned.status).json({ error: owned.error });

    if (action === 'revoke') {
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ share_enabled: false, share_revoked_at: new Date().toISOString() }),
        },
      );
      if (!patchRes.ok) {
        // Status only: the error body can echo the PATCH payload, and the
        // regenerate path's payload contains share_token_salt (a token secret).
        logEvent('error', 'share-control', 'revoke_failed', { status: patchRes.status });
        return res.status(500).json({ error: 'Could not revoke share link' });
      }
      return res.status(200).json({ ok: true, share_enabled: false });
    }

    // action === 'regenerate': always issues a brand-new salt, so the
    // previous URL's token (legacy formula or a prior salt) never matches
    // again - even though share_enabled is set back to true here. This is
    // what makes revoke->regenerate safe against the "silently revalidates"
    // failure mode named in D-1/D136.
    const salt = newSalt();
    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ share_token_salt: salt, share_enabled: true, share_revoked_at: null }),
      },
    );
    if (!patchRes.ok) {
      // Status only - the PATCH payload here contains share_token_salt.
      logEvent('error', 'share-control', 'regenerate_failed', { status: patchRes.status });
      return res.status(500).json({ error: 'Could not regenerate share link' });
    }

    const reportToken = computeReportToken(id, salt);
    const shareUrl = `https://phil-os.thelifepm.com/report?id=${id}&t=${reportToken}`;
    return res.status(200).json({ ok: true, share_enabled: true, report_token: reportToken, share_url: shareUrl });

  } catch (e) {
    logEvent('error', 'share-control', 'request_failed', { message: e.message });
    return res.status(500).json({ error: 'Something went wrong' });
  }
}

// Exported for containment tests only (A7) - not part of the public API surface.
export const __testables__ = { verifyOwnership, computeReportToken, newSalt, UUID_RE };
