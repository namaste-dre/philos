import crypto from 'crypto';
// Dashboard computation layer (D114 spec) - pure CommonJS modules, no I/O.
// Vercel's bundler handles the ESM-imports-CJS interop; the local test
// harness links them via synthetic modules (see api/capture.test.js).
import dashboardLib from '../lib/dashboard.js';
import contradictionsLib from '../lib/contradictions.js';
import observability from '../lib/observability.js';
const { logEvent } = observability;

const { computeOverview, formatElapsed, computeAxisTrends, computeStabilityFlux,
        detectPoleCrossings, compareCompletions } = dashboardLib;
const { detectContradictions, diffContradictions } = contradictionsLib;

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
    logEvent('warn', 'capture', 'rate_limit_check_failed', { message: e.message });
    return { allowed: true };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX_LENGTH = 2000; // mirrors the personal_notes CHECK constraint

// -- Dashboard read surface (D114 spec) ------------------------------------
// GET on this same endpoint - a request shape the pre-dashboard code
// rejected outright with 405, so nothing in the existing POST capture flow
// can be reached or altered by any GET. Placed on this file (rather than a
// new api/dashboard.js) because the api/ directory sits at exactly the
// Vercel Hobby 12-function ceiling (deploy-config.test.js guards it), and
// a 13th file silently breaks deploys.
//
// Every view requires a verified session and reads ONLY rows where
// user_id equals the verified user - completions?user_id=eq.<verified id>
// is the sole row filter, so cross-user reads are impossible by
// construction. QA-mode rows and incomplete attempts are excluded: the
// dashboard is the user's real history, not test runs or failures.
async function handleDashboardGet(req, res, supabaseUrl, svcHeaders) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const user = await getUser(token);
  if (!user || !user.id) return res.status(401).json({ error: 'Invalid or expired session' });

  const view = req.query.view || 'dashboard';

  const completionsUrl = `${supabaseUrl}/rest/v1/completions` +
    `?user_id=eq.${encodeURIComponent(user.id)}` +
    `&attempt_status=eq.complete&qa_mode=eq.false` +
    `&completed_at=not.is.null&order=completed_at.asc` +
    `&select=id,completed_at,archetype_family,archetype_variant,contradictions_count,scores,fingerprint,instrument_version`;

  try {
    if (view === 'dashboard') {
      const [compRes, notesRes] = await Promise.all([
        fetch(completionsUrl, { headers: svcHeaders }),
        fetch(`${supabaseUrl}/rest/v1/personal_notes?user_id=eq.${encodeURIComponent(user.id)}&select=completion_id,note_text,updated_at`, { headers: svcHeaders }),
      ]);
      if (!compRes.ok) return res.status(500).json({ error: 'History lookup failed' });
      const completions = await compRes.json();
      // Notes are non-critical: if the table read fails, the dashboard still
      // renders - notes just arrive empty rather than sinking the whole view.
      const noteRows = notesRes.ok ? await notesRes.json() : [];
      const notes = {};
      for (const n of (Array.isArray(noteRows) ? noteRows : [])) {
        notes[n.completion_id] = { text: n.note_text, updatedAt: n.updated_at };
      }

      const now = new Date().toISOString();
      const overview = computeOverview(completions);
      return res.status(200).json({
        ok: true,
        completions: completions.map(c => ({
          id: c.id,
          completedAt: c.completed_at,
          archetypeFamily: c.archetype_family,
          archetypeVariant: c.archetype_variant,
          contradictionsCount: c.contradictions_count,
          scores: c.scores,
          elapsed: formatElapsed(c.completed_at, now),
        })),
        overview,
        elapsedSinceLatest: overview ? formatElapsed(overview.latestCompletedAt, now) : null,
        trends: computeAxisTrends(completions),
        stabilityFlux: computeStabilityFlux(completions),
        poleCrossings: detectPoleCrossings(completions),
        notes,
        computedAt: now,
      });
    }

    if (view === 'report') {
      const id = req.query.completion_id;
      if (!UUID_RE.test(id || '')) return res.status(400).json({ error: 'Invalid completion_id' });
      const r = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}` +
        `&select=id,completed_at,archetype_family,archetype_variant,contradictions_count,scores,fingerprint,report_json,report_version,instrument_version`,
        { headers: svcHeaders });
      if (!r.ok) return res.status(500).json({ error: 'Report lookup failed' });
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'Report not found' });
      return res.status(200).json({ ok: true, completion: rows[0] });
    }

    if (view === 'compare') {
      const a = req.query.a, b = req.query.b;
      if (!UUID_RE.test(a || '') || !UUID_RE.test(b || '')) return res.status(400).json({ error: 'Invalid completion ids' });
      const r = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=in.(${encodeURIComponent(a)},${encodeURIComponent(b)})&user_id=eq.${encodeURIComponent(user.id)}` +
        `&select=id,completed_at,archetype_family,archetype_variant,contradictions_count,scores`,
        { headers: svcHeaders });
      if (!r.ok) return res.status(500).json({ error: 'Comparison lookup failed' });
      const rows = await r.json();
      const rowA = rows.find(x => x.id === a), rowB = rows.find(x => x.id === b);
      if (!rowA || !rowB) return res.status(404).json({ error: 'One or both completions not found' });
      return res.status(200).json({
        ok: true,
        comparison: compareCompletions(rowA, rowB),
        contradictionDiff: diffContradictions(rowA.scores, rowB.scores),
        from: { id: rowA.id, completedAt: rowA.completed_at },
        to: { id: rowB.id, completedAt: rowB.completed_at },
      });
    }

    if (view === 'contradictions') {
      const id = req.query.completion_id;
      if (!UUID_RE.test(id || '')) return res.status(400).json({ error: 'Invalid completion_id' });
      const r = await fetch(
        `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,scores,completed_at`,
        { headers: svcHeaders });
      if (!r.ok) return res.status(500).json({ error: 'Lookup failed' });
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'Completion not found' });
      return res.status(200).json({ ok: true, completedAt: rows[0].completed_at, contradictions: detectContradictions(rows[0].scores) });
    }

    if (view === 'export') {
      const r = await fetch(completionsUrl, { headers: svcHeaders });
      if (!r.ok) return res.status(500).json({ error: 'Export lookup failed' });
      const completions = await r.json();
      if (req.query.format === 'csv') {
        const axisIds = completions.length ? Object.keys(completions[0].scores).sort() : [];
        const header = ['completed_at', 'archetype_family', 'archetype_variant', 'contradictions_count', ...axisIds];
        const lines = [header.join(',')];
        for (const c of completions) {
          lines.push([
            c.completed_at, JSON.stringify(c.archetype_family || ''), JSON.stringify(c.archetype_variant || ''),
            c.contradictions_count ?? '', ...axisIds.map(a => c.scores[a] ?? ''),
          ].join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="phil-os-score-history.csv"');
        return res.status(200).send(lines.join('\n'));
      }
      res.setHeader('Content-Disposition', 'attachment; filename="phil-os-score-history.json"');
      return res.status(200).json({ ok: true, completions });
    }

    return res.status(400).json({ error: 'Unknown view' });
  } catch (e) {
    logEvent('error', 'capture', 'dashboard_view_error', { message: e.message });
    return res.status(500).json({ error: 'Dashboard read failed' });
  }
}

// -- Personal note writes (D114 spec Section 3.12, child table per Lyra's --
// 2026-07-27 review). A POST branch guarded by note_action - a field the
// quiz-capture payload never carries, so the existing flow is unreachable
// from this branch and vice versa.
async function handleNoteWrite(req, res, supabaseUrl, svcHeaders, body) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const user = await getUser(token);
  if (!user || !user.id) return res.status(401).json({ error: 'Invalid or expired session' });

  const { note_action, completion_id, note_text } = body;
  if (!UUID_RE.test(completion_id || '')) return res.status(400).json({ error: 'Invalid completion_id' });

  // Ownership: the completion this note attaches to must belong to the
  // verified caller - same IDOR discipline as the responses-attach path.
  const ownerCheck = await fetch(
    `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(completion_id)}&select=user_id`,
    { headers: svcHeaders });
  if (!ownerCheck.ok) return res.status(500).json({ error: 'Ownership check failed' });
  const ownerRows = await ownerCheck.json();
  if (!ownerRows[0] || ownerRows[0].user_id !== user.id) return res.status(403).json({ error: 'Not authorized for this completion' });

  try {
    if (note_action === 'delete') {
      const del = await fetch(`${supabaseUrl}/rest/v1/personal_notes?completion_id=eq.${encodeURIComponent(completion_id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      });
      if (!del.ok) return res.status(500).json({ error: 'Note delete failed' });
      return res.status(200).json({ ok: true, deleted: true });
    }

    if (note_action === 'save') {
      if (typeof note_text !== 'string' || note_text.trim().length === 0) return res.status(400).json({ error: 'note_text required' });
      if (note_text.length > NOTE_MAX_LENGTH) return res.status(400).json({ error: `Note exceeds ${NOTE_MAX_LENGTH} characters` });
      const up = await fetch(`${supabaseUrl}/rest/v1/personal_notes?on_conflict=completion_id`, {
        method: 'POST',
        headers: { ...svcHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          completion_id, user_id: user.id, note_text, updated_at: new Date().toISOString(),
        }),
      });
      if (!up.ok) {
        // Status only: the response body can echo the submitted note text back,
        // which is user content and must not reach the log stream.
        logEvent('error', 'capture', 'note_save_failed', { status: up.status });
        return res.status(500).json({ error: 'Note save failed' });
      }
      return res.status(200).json({ ok: true, saved: true });
    }

    return res.status(400).json({ error: 'Unknown note_action' });
  } catch (e) {
    logEvent('error', 'capture', 'note_write_error', { message: e.message });
    return res.status(500).json({ error: 'Note write failed' });
  }
}

export default async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ ok: false, error: 'Database not configured' });

  const svcHeadersEarly = {
    'Content-Type':  'application/json',
    'apikey':        supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  if (req.method === 'GET') return handleDashboardGet(req, res, supabaseUrl, svcHeadersEarly);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

  if (typeof body.note_action === 'string') return handleNoteWrite(req, res, supabaseUrl, svcHeadersEarly, body);

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
        // Status only in the log: this error body can echo the submitted row
        // back (first_name, email, report_json). The response to the caller is
        // left exactly as before - narrowing that is its own change, not this one.
        logEvent('error', 'capture', 'completions_insert_failed', { status: completionResponse.status });
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
        // Status only: this body can echo per-question answer rows.
        logEvent('error', 'capture', 'responses_insert_failed', { status: responsesResponse.status });
        responsesOk = false;
      }
    }

    // Completion succeeded - the anonymous autosave row (if any) is now redundant
    if (session_id && typeof session_id === 'string') {
      fetch(`${supabaseUrl}/rest/v1/anon_progress?session_id=eq.${session_id}`, {
        method: 'DELETE', headers: { ...svcHeaders, 'Prefer': 'return=minimal' },
      }).catch(e => logEvent('warn', 'capture', 'anon_progress_cleanup_failed', { message: e.message }));
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
    logEvent('error', 'capture', 'capture_error', { message: e.message });
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// Exported for containment tests only (A0.2/A7) - not part of the public API surface.
export const __testables__ = { computeReportToken, getShareState };
