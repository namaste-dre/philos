export const config = { maxDuration: 60 };

// Email hardening (2026-07-31): this endpoint was an unauthenticated,
// CORS-wildcard, unescaped-template sender - a latent open relay that
// only stayed harmless because RESEND_API_KEY was never configured
// (D130). Contained before the key ever lands:
//  - Requires a verified Supabase session (same getUser pattern as
//    api/claim-attempt.js); the recipient is ALWAYS the authenticated
//    user's own email - the client-supplied address is ignored, so the
//    endpoint cannot email third parties at all.
//  - Every interpolated field is HTML-entity escaped (same escapeHtml as
//    api/report.js); field lengths are capped; shareUrl must be a
//    same-origin report link or the request is rejected.
//  - Honest status codes: 401 unauthenticated, 400 invalid input,
//    503 not configured, 502 provider failure, 200 only on real success.
//  - CORS narrowed from '*' to the canonical origin, mirroring the other
//    hardened endpoints.

const ALLOWED_ORIGIN = 'https://phil-os.thelifepm.com';

// Per-user send cap: the real product flow sends at most one email per
// report generation (itself capped by D117 at 2/month), so 5 per day is
// generous headroom while making authenticated self-spam pointless.
// Same fail-closed rate_limits-table pattern as api/generate.js (A0.1).
const EMAIL_RATE_LIMIT = 5;
const EMAIL_RATE_WINDOW_HRS = 24;

const LIMITS = {
  name: 100,
  archetype: 200,
  variant: 200,
  tagline: 1000,
  identity: 20000,
  fingerprintRows: 10,
  fingerprintField: 200,
  growthItems: 20,
  growthField: 5000,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function cappedString(value, max) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  if (value.length > max) return null;
  return value;
}

// Fail-closed per-user rate limit, mirroring api/generate.js's A0.1
// pattern against the same rate_limits table (key: email:<userId>).
async function checkRateLimit(userId) {
  const url    = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) {
    console.error('[email] rate limit store not configured - failing closed');
    return { allowed: false, reason: 'unavailable' };
  }

  const key      = `email:${userId}`;
  const windowMs = EMAIL_RATE_WINDOW_HRS * 60 * 60 * 1000;
  const now      = new Date();
  const headers  = {
    'apikey':        secret,
    'Authorization': `Bearer ${secret}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
  };

  try {
    const getRes = await fetch(
      `${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}&select=calls,window_start`,
      { headers }
    );
    if (!getRes.ok) {
      console.error('[email] rate limit lookup failed:', getRes.status);
      return { allowed: false, reason: 'unavailable' };
    }
    const records = await getRes.json();
    const record  = Array.isArray(records) ? records[0] : null;

    if (!record) {
      const createRes = await fetch(`${url}/rest/v1/rate_limits`, {
        method: 'POST', headers,
        body: JSON.stringify({ key, calls: 1, window_start: now.toISOString() }),
      });
      if (!createRes.ok) {
        console.error('[email] rate limit create failed:', createRes.status);
        return { allowed: false, reason: 'unavailable' };
      }
      return { allowed: true };
    }

    const elapsed = now - new Date(record.window_start);
    if (elapsed > windowMs) {
      const resetRes = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ calls: 1, window_start: now.toISOString() }),
      });
      if (!resetRes.ok) {
        console.error('[email] rate limit window reset failed:', resetRes.status);
        return { allowed: false, reason: 'unavailable' };
      }
      return { allowed: true };
    }

    if (record.calls >= EMAIL_RATE_LIMIT) {
      const resetAt = new Date(new Date(record.window_start).getTime() + windowMs);
      return { allowed: false, reason: 'exceeded', resetAt: resetAt.toISOString() };
    }

    const incrementRes = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ calls: record.calls + 1 }),
    });
    if (!incrementRes.ok) {
      console.error('[email] rate limit increment failed:', incrementRes.status);
      return { allowed: false, reason: 'unavailable' };
    }
    return { allowed: true };

  } catch (e) {
    console.warn('[email] rate limit check failed:', e.message);
    return { allowed: false, reason: 'unavailable' }; // fail closed
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

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const user = await getUser(token);
  if (!user || !user.id || !user.email) return res.status(401).json({ error: 'Invalid or expired session' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // The recipient is the verified account email, never client input.
  const recipient = user.email;

  const name = cappedString(body.name, LIMITS.name);
  const archetype = cappedString(body.archetype, LIMITS.archetype);
  const variant = cappedString(body.variant, LIMITS.variant);
  const tagline = cappedString(body.tagline, LIMITS.tagline);
  const identity = cappedString(body.identity, LIMITS.identity);
  if ([name, archetype, variant, tagline, identity].some(v => v === null)) {
    return res.status(400).json({ error: 'Invalid or oversized field' });
  }

  let shareUrl = null;
  if (body.shareUrl !== undefined && body.shareUrl !== null) {
    if (typeof body.shareUrl !== 'string' || !body.shareUrl.startsWith(ALLOWED_ORIGIN + '/')) {
      return res.status(400).json({ error: 'Invalid share URL' });
    }
    shareUrl = body.shareUrl;
  }

  const rawFingerprint = Array.isArray(body.fingerprint) ? body.fingerprint.slice(0, LIMITS.fingerprintRows) : [];
  const fingerprint = [];
  for (const f of rawFingerprint) {
    if (!f || typeof f !== 'object') return res.status(400).json({ error: 'Invalid fingerprint row' });
    const label = cappedString(f.label, LIMITS.fingerprintField);
    const pole = cappedString(f.pole, LIMITS.fingerprintField);
    if (label === null || pole === null) return res.status(400).json({ error: 'Invalid fingerprint row' });
    const score = Number(f.score ?? f.deviation ?? 0);
    fingerprint.push({ label, pole, score: Number.isFinite(score) ? score : 0 });
  }

  // Growth entries are {title, text, practice} objects since Phase 8; older payloads hold strings.
  const rawGrowth = Array.isArray(body.growth) ? body.growth.slice(0, LIMITS.growthItems) : [];
  const growth = [];
  for (const g of rawGrowth) {
    if (typeof g === 'string') {
      if (g.length > LIMITS.growthField) return res.status(400).json({ error: 'Invalid growth entry' });
      growth.push({ title: '', text: g, practice: '' });
    } else if (g && typeof g === 'object') {
      const title = cappedString(g.title, LIMITS.fingerprintField);
      const text = cappedString(g.text, LIMITS.growthField);
      const practice = cappedString(g.practice, LIMITS.growthField);
      if (title === null || text === null || practice === null) {
        return res.status(400).json({ error: 'Invalid growth entry' });
      }
      growth.push({ title, text, practice });
    } else {
      return res.status(400).json({ error: 'Invalid growth entry' });
    }
  }

  const contradictionsCount = Math.max(0, Math.min(100, parseInt(body.contradictions_count, 10) || 0));

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(503).json({ ok: false, error: 'Email not configured' });

  const rate = await checkRateLimit(user.id);
  if (!rate.allowed) {
    if (rate.reason === 'exceeded') {
      return res.status(429).json({ ok: false, error: 'Email limit reached', resetAt: rate.resetAt });
    }
    return res.status(503).json({ ok: false, error: 'Email temporarily unavailable' });
  }

  const fingerprintHTML = fingerprint.map(f => `
    <tr>
      <td style="padding:8px 12px;color:#c9a96e;font-family:monospace;font-size:13px;">${escapeHtml(f.label)}</td>
      <td style="padding:8px 12px;color:#ffffff;font-family:sans-serif;font-size:13px;">${escapeHtml(f.pole)}</td>
      <td style="padding:8px 12px;color:#9d93e8;font-family:monospace;font-size:13px;text-align:right;">${Math.round(f.score * 10)}%</td>
    </tr>
  `).join('');

  const growthHTML = growth.map((g, i) => `
    <div style="margin-bottom:16px;padding:16px;background:rgba(157,147,232,0.08);border-left:3px solid #7c6fd4;border-radius:4px;">
      <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Growth Edge ${i + 1}${g.title ? ' · ' + escapeHtml(g.title) : ''}</div>
      <div style="color:#e8e6f0;font-family:sans-serif;font-size:14px;line-height:1.6;">${escapeHtml(g.text)}${g.practice ? '<br><br><em>Try this: ' + escapeHtml(g.practice) + '</em>' : ''}</div>
    </div>
  `).join('');

  const safeName = escapeHtml(name);
  const safeShareUrl = shareUrl ? escapeHtml(shareUrl) : null;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Phil OS Report</title>
</head>
<body style="margin:0;padding:0;background:#08061a;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:40px;">
    <div style="font-family:monospace;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:4px;">PHIL/OS</div>
    <div style="color:#c9a96e;font-family:monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Philosophical Operating System</div>
  </div>

  <!-- Greeting -->
  <div style="margin-bottom:32px;">
    <p style="color:#e8e6f0;font-size:16px;line-height:1.6;margin:0 0 8px 0;">Hey ${safeName},</p>
    <p style="color:#a09cb8;font-size:14px;line-height:1.6;margin:0;">Here is your complete Phil OS report. Keep this email - it is your permanent record.</p>
  </div>

  <!-- Archetype -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Your Archetype</div>
    <div style="color:#ffffff;font-size:26px;font-weight:700;margin-bottom:4px;">${escapeHtml(archetype)}</div>
    <div style="color:#c9a96e;font-size:14px;font-family:monospace;margin-bottom:16px;">${escapeHtml(variant)}</div>
    <div style="color:#e8e6f0;font-size:15px;line-height:1.7;font-style:italic;border-left:2px solid #c9a96e;padding-left:16px;">${escapeHtml(tagline)}</div>
  </div>

  <!-- Identity -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Who You Are</div>
    <div style="color:#e8e6f0;font-size:14px;line-height:1.8;">${escapeHtml(identity).replace(/\n/g, '<br><br>')}</div>
  </div>

  <!-- Fingerprint -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Philosophical Fingerprint</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <th style="padding:8px 12px;text-align:left;color:#555;font-family:monospace;font-size:11px;font-weight:400;">AXIS</th>
        <th style="padding:8px 12px;text-align:left;color:#555;font-family:monospace;font-size:11px;font-weight:400;">POSITION</th>
        <th style="padding:8px 12px;text-align:right;color:#555;font-family:monospace;font-size:11px;font-weight:400;">STRENGTH</th>
      </tr>
      ${fingerprintHTML}
    </table>
  </div>

  <!-- Growth -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Growth Edges</div>
    ${growthHTML}
  </div>

  ${contradictionsCount > 0 ? `
  <!-- Contradictions -->
  <div style="background:rgba(224,120,74,0.08);border:1px solid rgba(224,120,74,0.3);border-radius:8px;padding:20px;margin-bottom:24px;">
    <div style="color:#e0784a;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Philosophical Tensions Detected</div>
    <div style="color:#a09cb8;font-size:14px;line-height:1.6;">Your report identified <strong style="color:#e0784a;">${contradictionsCount} tension${contradictionsCount > 1 ? 's' : ''}</strong> in your belief system. View the full analysis in your report.</div>
  </div>
  ` : ''}

  ${safeShareUrl ? `
  <!-- Share URL -->
  <div style="margin-bottom:24px;padding:16px 20px;background:rgba(201,169,110,0.06);border:1px solid rgba(201,169,110,0.25);border-radius:8px;">
    <div style="font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;margin-bottom:8px;">Your shareable report link</div>
    <a href="${safeShareUrl}" style="font-family:monospace;font-size:12px;color:#e8c97a;word-break:break-all;text-decoration:none;">${safeShareUrl}</a>
    <p style="color:#a09cb8;font-size:12px;margin-top:8px;margin-bottom:0;">Anyone with this link can view your full report, including your scores and archetype, without signing in. Only share it with people you trust. You can turn the link off or replace it at any time from the share menu in your report.</p>
  </div>
  ` : ''}

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:40px;">
    <a href="${safeShareUrl || ALLOWED_ORIGIN}" style="display:inline-block;background:#c9a96e;color:#08061a;font-family:monospace;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:14px 32px;border-radius:4px;text-decoration:none;">VIEW YOUR FULL REPORT</a>
    <p style="color:#555;font-size:12px;margin-top:16px;">phil-os.thelifepm.com</p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;text-align:center;">
    <div style="color:#444;font-family:monospace;font-size:11px;letter-spacing:2px;">PHIL/OS · thelifepm.com</div>
    <p style="color:#333;font-size:11px;margin-top:8px;">You received this because you completed the Phil OS assessment.<br>160 questions · 32 belief axes · your archetype.</p>
  </div>

</div>
</body>
</html>`;

  // Subject line: name and archetype are already length-capped; strip any
  // control characters as defense-in-depth before they reach a header-ish
  // context.
  const subjectName = (name || 'Your').replace(/[\r\n\t]+/g, ' ').trim() || 'Your';
  const subjectArchetype = (archetype || 'Phil OS').replace(/[\r\n\t]+/g, ' ').trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Phil OS <andre@thelifepm.com>',
        to: recipient,
        subject: `${subjectName}, your Phil OS report - ${subjectArchetype}`,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Resend error:', text);
      // Provider detail stays in the server log; the client gets a
      // non-disclosing failure with an honest status code.
      return res.status(502).json({ ok: false, error: 'Email provider error' });
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error('Email error:', e.message);
    return res.status(502).json({ ok: false, error: 'Email send failed' });
  }
}
