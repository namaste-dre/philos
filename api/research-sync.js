import crypto from 'crypto';

export const config = { maxDuration: 30 };

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';
const CONSENT_VERSION = 'research-v1-2026-07';

function researchKeyFor(userId) {
  const pepper = process.env.RESEARCH_KEY_PEPPER || '';
  return crypto.createHmac('sha256', pepper).update(userId).digest('hex');
}

function ageRange(age) {
  const n = parseInt(age, 10);
  if (isNaN(n) || n < 13) return null;
  const lo = Math.floor(n / 10) * 10;
  return `${lo}-${lo + 9}`;
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

  const body = req.body;
  if (!body || typeof body.optIn !== 'boolean') return res.status(400).json({ error: 'optIn (boolean) required' });

  const userId = user.id;
  const key    = researchKeyFor(userId);
  const svcHeaders = {
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type':  'application/json',
  };

  try {
    if (!body.optIn) {
      await fetch(`${supabaseUrl}/rest/v1/research_profiles?research_key=eq.${key}`, {
        method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      });
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ research_consent: false, research_consent_version: CONSENT_VERSION }),
      });
      await fetch(`${supabaseUrl}/rest/v1/consent_log`, {
        method: 'POST', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          user_id: userId, consent_type: 'research', granted: false,
          consent_version: CONSENT_VERSION, source: 'settings',
        }),
      });
      return res.status(200).json({ ok: true, optIn: false });
    }

    // Opt-in: pull the account's de-identified fields from the latest completion
    // (D58/M5 - completions is insert-many now, so this must pick the most recent
    // row deterministically, not just "the row" as account_completions used to be).
    const compRes = await fetch(
      `${supabaseUrl}/rest/v1/completions?user_id=eq.${userId}&select=archetype_family,archetype_variant,scores,fingerprint,contradictions_count,instrument_version&order=completed_at.desc,generated_at.desc,id.desc&limit=1`,
      { headers: svcHeaders }
    );
    const compRows = await compRes.json();
    const completion = Array.isArray(compRows) ? compRows[0] : null;
    if (!completion) return res.status(409).json({ error: 'No completed assessment on this account yet' });

    const profRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=age,country`,
      { headers: svcHeaders }
    );
    const profRows = await profRes.json();
    const profile  = Array.isArray(profRows) ? profRows[0] : {};

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
    if (!upsertRes.ok) return res.status(500).json({ error: 'Failed to write research profile', detail: await upsertRes.text() });

    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ research_consent: true, research_consent_version: CONSENT_VERSION }),
    });
    await fetch(`${supabaseUrl}/rest/v1/consent_log`, {
      method: 'POST', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: userId, consent_type: 'research', granted: true,
        consent_version: CONSENT_VERSION, source: 'settings',
      }),
    });

    return res.status(200).json({ ok: true, optIn: true });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
