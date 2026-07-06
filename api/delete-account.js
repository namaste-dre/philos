import crypto from 'crypto';

export const config = { maxDuration: 30 };

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';

function researchKeyFor(userId) {
  const pepper = process.env.RESEARCH_KEY_PEPPER || '';
  return crypto.createHmac('sha256', pepper).update(userId).digest('hex');
}

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

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Database not configured' });

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const user = await getUser(token);
  if (!user || !user.id) return res.status(401).json({ error: 'Invalid or expired session' });

  const userId = user.id;
  const email  = user.email || '';
  const svcHeaders = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };

  const steps = {};

  // Step 1: research_profiles, keyed by the revocable HMAC research_key
  try {
    const key = researchKeyFor(userId);
    const r = await fetch(`${supabaseUrl}/rest/v1/research_profiles?research_key=eq.${key}`, {
      method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
    });
    steps.research_profiles = r.ok ? 'deleted' : `failed: ${await r.text()}`;
  } catch (e) {
    steps.research_profiles = `error: ${e.message}`;
  }

  // Step 2: user-scoped tables (account_completions is a view post-M5 - its
  // rows live in completions now and are cleared in step 3 below)
  for (const table of ['assessment_progress', 'analytics_events', 'profiles']) {
    const idCol = table === 'profiles' ? 'id' : 'user_id';
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/${table}?${idCol}=eq.${userId}`, {
        method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      });
      steps[table] = r.ok ? 'deleted' : `failed: ${await r.text()}`;
    } catch (e) {
      steps[table] = `error: ${e.message}`;
    }
  }

  // Step 3: completions - every historical row for this person, attributed
  // (user_id, post-M5 insert-many) or anonymous-shaped (email match, pre-M5
  // rows). Responses cascade automatically - FK is ON DELETE CASCADE.
  try {
    const byUser = await fetch(`${supabaseUrl}/rest/v1/completions?user_id=eq.${userId}`, {
      method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
    });
    let byEmailOk = true;
    if (email) {
      const byEmail = await fetch(`${supabaseUrl}/rest/v1/completions?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      });
      byEmailOk = byEmail.ok;
    }
    steps.completions = (byUser.ok && byEmailOk) ? 'deleted (responses cascaded)' : 'partial failure';
  } catch (e) {
    steps.completions = `error: ${e.message}`;
  }

  // Step 4: consent_log - anonymize (user_id -> NULL, email_hash kept) + final erasure-evidence row (R5/D58)
  try {
    const emailHash = email ? crypto.createHash('sha256').update(email).digest('hex') : null;
    const anonRes = await fetch(`${supabaseUrl}/rest/v1/consent_log?user_id=eq.${userId}`, {
      method: 'PATCH', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: null }),
    });
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/consent_log`, {
      method: 'POST', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: null,
        email_hash: emailHash,
        consent_type: 'gdpr',
        granted: false,
        consent_version: 'account-deletion',
        source: 'settings',
      }),
    });
    steps.consent_log = (anonRes.ok && insertRes.ok) ? 'anonymized + revoke row written' : 'partial failure';
  } catch (e) {
    steps.consent_log = `error: ${e.message}`;
  }

  // Step 5: auth.users via Supabase admin API
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE', headers: svcHeaders,
    });
    steps.auth_user = r.ok ? 'deleted' : `failed: ${await r.text()}`;
  } catch (e) {
    steps.auth_user = `error: ${e.message}`;
  }

  const allOk = Object.values(steps).every(v => v.startsWith('deleted') || v.startsWith('anonymized') || v === 'skipped: no email on account');
  return res.status(allOk ? 200 : 207).json({ ok: allOk, steps });
}
