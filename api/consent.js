export const config = { maxDuration: 15 };

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';
// Canonical path currently covers gdpr and marketing only. Research consent
// keeps its own dedicated endpoint (research-sync.js) - it also writes the
// de-identified research_profiles table, which this simple profiles-column
// flip does not model. Not folded in here without a separate decision.
const ALLOWED_TYPES  = ['gdpr', 'marketing'];
const ALLOWED_SOURCES = ['onboarding', 'settings', 'email_gate'];

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
  const consentType   = body && body.consentType;
  const granted        = body && typeof body.granted === 'boolean' ? body.granted : null;
  const consentVersion = body && body.consentVersion;
  const source          = body && body.source;
  const textSnapshot    = body && typeof body.textSnapshot === 'string' ? body.textSnapshot.slice(0, 4000) : null;

  if (!ALLOWED_TYPES.includes(consentType)) return res.status(400).json({ error: 'Invalid consentType' });
  if (granted === null) return res.status(400).json({ error: 'granted (boolean) required' });
  if (!consentVersion) return res.status(400).json({ error: 'consentVersion required' });
  if (!ALLOWED_SOURCES.includes(source)) return res.status(400).json({ error: 'Invalid source' });

  try {
    // Single RPC call = single Postgres transaction. The function updates
    // profiles and inserts into consent_log inside the same transaction, so
    // if either half fails, both roll back - current state and audit history
    // cannot diverge (the exact gap flagged after the D79 pass).
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/set_consent`, {
      method: 'POST',
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        p_user_id:         user.id,
        p_consent_type:    consentType,
        p_granted:          granted,
        p_consent_version: consentVersion,
        p_source:           source,
        p_text_snapshot:   textSnapshot,
      }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Failed to record consent', detail: await r.text() });
    return res.status(200).json({ ok: true, consentType, granted });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
