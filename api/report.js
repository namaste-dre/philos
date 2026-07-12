import crypto from 'crypto';

export const config = { maxDuration: 60 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATE_LIMIT      = 30;   // fetches per IP per window - generous for legitimate refreshes/shares
const RATE_WINDOW_HRS = 1;

// A0.2 containment: /api/report previously treated bare possession of the
// completion id (a value logged, emailed, and pasted around) as sufficient
// authorization. It is now not - a viewer must also present the capability
// token minted by api/capture.js at completion-ownership time. This is a
// stateless, non-expiring per-completion token (expiry/revocation belong to
// the future D-1 public-share feature, not this block); it must be computed
// identically here and in capture.js.
function computeReportToken(id) {
  const secret = process.env.SUPABASE_SERVICE_KEY || '';
  return crypto.createHmac('sha256', secret).update(`report-token:${id}`).digest('hex').slice(0, 32);
}

function tokenMatches(provided, expected) {
  if (typeof provided !== 'string' || provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

// Fail-closed rate limiter, same pattern as api/generate.js: storage
// failure or missing config rejects rather than granting unlimited access.
async function checkRateLimit(key) {
  const url    = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) return { allowed: false };

  const windowMs = RATE_WINDOW_HRS * 60 * 60 * 1000;
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
    if (!getRes.ok) return { allowed: false };
    const records = await getRes.json();
    const record  = Array.isArray(records) ? records[0] : null;

    if (!record) {
      const createRes = await fetch(`${url}/rest/v1/rate_limits`, {
        method: 'POST', headers,
        body: JSON.stringify({ key, calls: 1, window_start: now.toISOString() }),
      });
      return { allowed: createRes.ok };
    }

    const elapsed = now - new Date(record.window_start);
    if (elapsed > windowMs) {
      const resetRes = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ calls: 1, window_start: now.toISOString() }),
      });
      return { allowed: resetRes.ok };
    }

    if (record.calls >= RATE_LIMIT) return { allowed: false };

    const incrementRes = await fetch(`${url}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ calls: record.calls + 1 }),
    });
    return { allowed: incrementRes.ok };

  } catch (e) {
    console.warn('[report] rate limit check failed:', e.message);
    return { allowed: false };
  }
}

export default async function handler(req, res) {
  // A0.2: no CORS grant. This endpoint is viewed via direct navigation, not
  // cross-origin fetch/XHR - the previous Access-Control-Allow-Origin: '*'
  // let any site read the private report body via fetch(). Nothing here
  // needs a cross-origin allowance.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Uniform non-disclosing response for every rejection path below - a
  // missing id, a malformed id, a missing/wrong token, a nonexistent id,
  // and someone else's id must all be indistinguishable from each other.
  const notFound = () => res.status(404).send(errorPage('Report not found.'));

  const { id, t } = req.query;
  if (!id || typeof id !== 'string' || !UUID_RE.test(id)) return notFound();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).send(errorPage('Something went wrong loading this report.'));

  const expectedToken = computeReportToken(id);
  if (!tokenMatches(t, expectedToken)) return notFound();

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const rate = await checkRateLimit(`report:${ip}`);
  if (!rate.allowed) return notFound();

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&select=report_json,scores,fingerprint,first_name,archetype_family,archetype_variant`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!response.ok) return res.status(500).send(errorPage('Could not load report.'));

    const rows = await response.json();
    if (!rows || !rows.length) return notFound();

    const c = rows[0];
    const report = c.report_json || {};
    const scores = c.scores || {};
    const fingerprint = c.fingerprint || [];
    const name = c.first_name || 'You';
    const archetype = c.archetype_family || '';
    const variant = c.archetype_variant || '';
    const shareUrl = `https://phil-os.thelifepm.com/report?id=${id}&t=${t}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderReportPage({ c, report, scores, fingerprint, name, archetype, variant, shareUrl }));

  } catch (e) {
    console.error('report.js error:', e.message);
    return res.status(500).send(errorPage('Something went wrong loading this report.'));
  }
}

// Exported for containment tests only (A0.2) - not part of the public API surface.
export const __testables__ = { computeReportToken, tokenMatches, UUID_RE };

function errorPage(msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phil OS</title>
  <style>body{background:#07061a;color:#f0ede6;font-family:IBM Plex Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}
  .msg{max-width:400px;} .logo{font-family:IBM Plex Mono,monospace;letter-spacing:4px;color:#c9a96e;margin-bottom:24px;font-size:20px;}
  p{color:#8c88a0;line-height:1.7;} a{color:#c9a96e;}</style></head>
  <body><div class="msg"><div class="logo">PHIL/OS</div><p>${msg}</p><p><a href="https://phil-os.thelifepm.com">Take the assessment</a></p></div></body></html>`;
}

function bar(score, color) {
  const pct = Math.round((score / 7) * 100);
  return `<div style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
    <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div>
  </div>`;
}

function axisRow(label, score, poleL, poleR, color) {
  return `<div style="margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
      <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#ccc8be;">${label}</span>
      <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#c9a96e;font-weight:700;">${parseFloat(score).toFixed(1)}</span>
    </div>
    ${bar(score, color)}
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-family:IBM Plex Mono,monospace;font-size:10px;color:rgba(200,195,230,0.6);">
      <span>${poleL}</span><span>${poleR}</span>
    </div>
  </div>`;
}

function worldCard(card, iconEmoji, iconBg) {
  if (!card) return '';
  return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:14px;padding:18px 22px 14px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <div style="width:36px;height:36px;border-radius:8px;background:${iconBg};display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">${iconEmoji}</div>
      <div style="font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.7);">${card.lens || ''}</div>
    </div>
    <div style="padding:20px 22px;">
      <div style="margin-bottom:16px;">
        <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8c88a0;margin-bottom:6px;">Your view</div>
        <div style="font-size:15px;line-height:1.75;color:#f0ede6;">${card.view || ''}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8c88a0;margin-bottom:6px;">How it shows up</div>
        <div style="font-size:15px;line-height:1.75;color:#f0ede6;">${card.shows_up || ''}</div>
      </div>
      <div style="padding:14px 16px;background:rgba(201,169,110,0.07);border-left:3px solid #c9a96e;border-radius:0 6px 6px 0;">
        <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;margin-bottom:6px;">Sit with this</div>
        <div style="font-size:14px;line-height:1.7;color:#e8c97a;font-style:italic;">${card.prompt || ''}</div>
      </div>
    </div>
  </div>`;
}

function renderReportPage({ c, report, scores, fingerprint, name, archetype, variant, shareUrl }) {
  const tagline = report.tagline || '';
  const identity = report.identity || '';
  const identityHtml = (Array.isArray(identity) ? identity.join('\n\n') : identity)
    .split('\n\n').filter(Boolean).map(p => `<p style="margin-bottom:1.3em;font-size:19px;line-height:1.88;color:#f0ede6;">${p}</p>`).join('');

  const growth = Array.isArray(report.growth) ? report.growth : [];
  const worldCards = Array.isArray(report.world) ? report.world : [];
  const alignment = Array.isArray(report.alignment) ? report.alignment : [];
  const patterns = Array.isArray(report.patterns) ? report.patterns : [];

  const worldIcons = [
    { emoji: '🧐', bg: 'rgba(157,147,232,0.15)' },
    { emoji: '👥', bg: 'rgba(91,191,148,0.15)' },
    { emoji: '🤝', bg: 'rgba(201,169,110,0.15)' },
    { emoji: '🌆', bg: 'rgba(224,120,74,0.15)' },
    { emoji: '🌌', bg: 'rgba(180,130,255,0.15)' },
  ];

  const fingerprintHtml = fingerprint.slice(0, 5).map(f => {
    const pct = Math.round((f.score / 7) * 100);
    return `<div style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-family:IBM Plex Mono,monospace;font-size:13px;color:#5bbf94;">${f.axis ? f.axis.replace(/_/g,' ') : ''}</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#c9a96e;font-weight:700;">${parseFloat(f.score).toFixed(1)}/7</span>
      </div>
      <div style="height:10px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#5bbf94,rgba(91,191,148,0.5));box-shadow:0 0 12px rgba(91,191,148,0.3);border-radius:5px;"></div>
      </div>
    </div>`;
  }).join('');

  const scoresMap = [
    { key:'naturalism',   label:'Naturalism',      poleL:'Supernatural',        poleR:'Fully natural',        color:'#9d93e8', tier:1 },
    { key:'physicalism',  label:'Physicalism',     poleL:'Mind beyond brain',   poleR:'Fully physical',       color:'#9d93e8', tier:1 },
    { key:'realism',      label:'Realism',         poleL:'Reality constructed', poleR:'Mind-independent',     color:'#9d93e8', tier:1 },
    { key:'determinism',  label:'Determinism',     poleL:'Genuine free will',   poleR:'All behaviour caused', color:'#9d93e8', tier:1 },
    { key:'moral_ground', label:'Moral Ground',    poleL:'Ethics subjective',   poleR:'Moral facts are real', color:'#9d93e8', tier:1 },
    { key:'meaning',      label:'Meaning',         poleL:'Meaning constructed', poleR:'Meaning discoverable', color:'#9d93e8', tier:1 },
    { key:'teleology',    label:'Teleology',       poleL:'No cosmic direction', poleR:'Reality has purpose',  color:'#9d93e8', tier:1 },
    { key:'human_nature', label:'Human Nature',    poleL:'Blank slate',         poleR:'Fixed nature',         color:'#9d93e8', tier:1 },
    { key:'epistemic_method', label:'Epistemic Method', poleL:'Faith/intuition', poleR:'Empirical evidence',  color:'#9d93e8', tier:1 },
    { key:'social_ontology',  label:'Social Ontology',  poleL:'Just individuals', poleR:'Structures shape us', color:'#9d93e8', tier:1 },
    { key:'temporal_orientation', label:'Temporal Orientation', poleL:'Past tradition', poleR:'Future progress', color:'#9d93e8', tier:1 },
    { key:'moral_authority',  label:'Moral Authority',  poleL:'God and scripture', poleR:'Individual conscience', color:'#9d93e8', tier:1 },
    { key:'epistemic_humility', label:'Epistemic Humility', poleL:'Confident in views', poleR:'Holds views loosely', color:'#9d93e8', tier:1 },
    { key:'knowledge',    label:'Knowledge',       poleL:'Intuition/revelation', poleR:'Evidence and reason', color:'#5bbf94', tier:2 },
    { key:'science',      label:'Science',         poleL:'Skeptical',           poleR:'Trusts consensus',     color:'#5bbf94', tier:2 },
    { key:'freewill_practice', label:'Free Will in Practice', poleL:'Personal accountability', poleR:'Behaviour has causes', color:'#5bbf94', tier:2 },
    { key:'justice',      label:'Justice',         poleL:'Punishment-based',    poleR:'Rehabilitation',       color:'#e0784a', tier:3 },
    { key:'ethics',       label:'Ethics',          poleL:'Rule-based',          poleR:'Outcome-based',        color:'#e0784a', tier:3 },
    { key:'religion',     label:'Religion',        poleL:'Faith-positive',      poleR:'Religion harmful',     color:'#e0784a', tier:3 },
    { key:'politics',     label:'Politics',        poleL:'Individual freedom',  poleR:'Collective solutions', color:'#e0784a', tier:3 },
    { key:'self',         label:'Self',            poleL:'Author of choices',   poleR:'Product of causes',    color:'#e0784a', tier:3 },
    { key:'moral_scope',  label:'Moral Scope',     poleL:'Humans only',         poleR:'All sentient life',    color:'#e0784a', tier:3 },
    { key:'meaning_practice', label:'Meaning in Practice', poleL:'Nothing matters', poleR:'Actively builds meaning', color:'#e0784a', tier:3 },
    { key:'society',      label:'Society',         poleL:'Individualist',       poleR:'Collectivist',         color:'#e0784a', tier:3 },
    { key:'responsibility', label:'Responsibility', poleL:'Personal responsibility', poleR:'Structural explanations', color:'#e0784a', tier:3 },
    { key:'identity',     label:'Identity',        poleL:'Fixed essential self', poleR:'Constructed self',    color:'#e0784a', tier:3 },
    { key:'authority',    label:'Authority',       poleL:'Deferential',         poleR:'Skeptical of institutions', color:'#e0784a', tier:3 },
    { key:'economics',    label:'Economics',       poleL:'Free market',         poleR:'Redistributive',       color:'#e0784a', tier:3 },
    { key:'uncertainty',  label:'Uncertainty',     poleL:'Needs certainty',     poleR:'At ease with unknown', color:'#e0784a', tier:3 },
    { key:'mind_consciousness', label:'Mind and Consciousness', poleL:'Non-physical', poleR:'Fully physical',  color:'#e0784a', tier:3 },
    { key:'animal_ethics', label:'Animal Ethics',  poleL:'Humans matter more',  poleR:'Animal suffering equal', color:'#e0784a', tier:3 },
    { key:'progress',     label:'Progress',        poleL:'Pessimist',           poleR:'Optimist',             color:'#e0784a', tier:3 },
  ];

  const t1Bars = scoresMap.filter(a => a.tier === 1).map(a => scores[a.key] !== undefined ? axisRow(a.label, scores[a.key], a.poleL, a.poleR, a.color) : '').join('');
  const t2Bars = scoresMap.filter(a => a.tier === 2).map(a => scores[a.key] !== undefined ? axisRow(a.label, scores[a.key], a.poleL, a.poleR, a.color) : '').join('');
  const t3Bars = scoresMap.filter(a => a.tier === 3).map(a => scores[a.key] !== undefined ? axisRow(a.label, scores[a.key], a.poleL, a.poleR, a.color) : '').join('');

  const alignmentHtml = alignment.map(a => `
    <div style="background:#111028;border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:26px;margin-bottom:14px;">
      <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#c9a96e;margin-bottom:10px;font-weight:600;">${a.label}</div>
      <div style="font-size:16px;color:#f0ede6;line-height:1.75;">${a.text}</div>
    </div>`).join('');

  const patternsHtml = patterns.map(p => `
    <div style="background:#111028;border:2px solid rgba(255,255,255,0.22);border-left:3px solid ${p.type === 'positive' ? '#5bbf94' : '#e0784a'};border-radius:12px;padding:22px;margin-bottom:14px;">
      <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${p.type === 'positive' ? '#5bbf94' : '#e0784a'};margin-bottom:10px;font-weight:600;">${p.label}</div>
      <div style="font-size:16px;color:#f0ede6;line-height:1.65;">${p.text}</div>
    </div>`).join('');

  // Growth entries are {title, text, practice} objects since Phase 8;
  // older stored reports hold plain strings — render both.
  const growthHtml = growth.map((g, i) => `
    <div style="display:flex;gap:22px;padding:24px 26px;background:#111028;border:1px solid rgba(255,255,255,0.09);border-radius:12px;align-items:flex-start;margin-bottom:12px;">
      <div style="font-family:Playfair Display,serif;font-size:26px;color:#b8aef5;line-height:1.1;flex-shrink:0;font-weight:700;opacity:0.75;">${i + 1}</div>
      <div style="font-size:17px;color:#f0ede6;line-height:1.78;">${
        (g && typeof g === 'object')
          ? `<div style="font-weight:600;color:#f0ede6;margin-bottom:6px;">${g.title || ''}</div>
             <div>${g.text || ''}</div>
             ${g.practice ? `<div style="margin-top:10px;font-size:14px;color:#b8aef5;"><span style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">Try this</span><br>${g.practice}</div>` : ''}`
          : g
      }</div>
    </div>`).join('');

  const worldHtml = worldCards.map((card, i) => worldCard(card, worldIcons[i]?.emoji || '○', worldIcons[i]?.bg || 'rgba(255,255,255,0.06)')).join('');

  const sec = (label, content, id) => `
    <div style="margin-bottom:76px;" ${id ? `id="${id}"` : ''}>
      <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.22em;color:#c9a96e;text-transform:uppercase;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid rgba(201,169,110,0.18);display:flex;align-items:center;gap:14px;">
        <span style="display:inline-block;width:3px;height:12px;background:linear-gradient(180deg,#c9a96e,#9d93e8);border-radius:2px;flex-shrink:0;"></span>${label}
      </div>
      ${content}
    </div>`;

  const tierDiv = (label, cls) => `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      <div style="flex:1;height:1px;background:rgba(255,255,255,0.07);"></div>
      <span style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;padding:4px 12px;border-radius:20px;color:${cls === 't1' ? '#9d93e8' : cls === 't2' ? '#5bbf94' : '#e0784a'};border:1px solid ${cls === 't1' ? 'rgba(157,147,232,0.25)' : cls === 't2' ? 'rgba(91,191,148,0.25)' : 'rgba(224,120,74,0.25)'};">${label}</span>
      <div style="flex:1;height:1px;background:rgba(255,255,255,0.07);"></div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta property="og:title" content="${name}'s Phil OS Report, ${archetype}"/>
<meta name="robots" content="noindex, nofollow"/>
<meta property="og:description" content="${tagline}"/>
<meta property="og:url" content="${shareUrl}"/>
<title>${name} — Phil OS Report</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:#07061a;color:#f0ede6;font-family:IBM Plex Sans,sans-serif;min-height:100vh;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
</style>
</head>
<body>

<!-- HEADER -->
<div style="position:relative;overflow:hidden;padding:80px 28px 64px;text-align:center;background:#07061a;">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse 90% 70% at 15% -10%,rgba(120,100,255,0.22) 0%,transparent 60%),radial-gradient(ellipse 70% 60% at 85% 110%,rgba(201,169,110,0.18) 0%,transparent 60%);pointer-events:none;"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent 0%,rgba(157,147,232,0.5) 30%,rgba(201,169,110,0.4) 70%,transparent 100%);"></div>
  <div style="position:relative;z-index:1;max-width:760px;margin:0 auto;">
    <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.28em;color:#c9a96e;text-transform:uppercase;margin-bottom:24px;opacity:0.75;">Your Philosophical OS</div>
    <div style="margin:0 auto 24px;width:140px;height:140px;display:flex;align-items:center;justify-content:center;background:rgba(157,147,232,0.09);border:1px solid rgba(157,147,232,0.22);border-radius:50%;color:rgba(200,190,255,0.85);box-shadow:0 0 48px rgba(157,147,232,0.18);font-size:60px;">
      💙
    </div>
    <div style="font-family:Playfair Display,serif;font-size:clamp(44px,8vw,84px);color:#f0ede6;margin-bottom:10px;font-weight:700;line-height:1.03;">${archetype}</div>
    <div style="font-family:IBM Plex Mono,monospace;font-size:12px;letter-spacing:0.18em;color:#b8aef5;text-transform:uppercase;margin-bottom:20px;">${variant}</div>
    <div style="width:48px;height:2px;background:linear-gradient(90deg,#9d93e8,#c9a96e);margin:0 auto 36px;border-radius:1px;"></div>
    <div style="font-family:Playfair Display,serif;font-style:italic;font-size:clamp(18px,2.5vw,23px);color:#c9a96e;max-width:620px;margin:0 auto 28px;line-height:1.6;">${tagline}</div>
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(157,147,232,0.10);border:1px solid rgba(157,147,232,0.28);border-radius:50px;padding:7px 18px;font-family:IBM Plex Mono,monospace;font-size:11px;color:#b8aef5;letter-spacing:0.10em;text-transform:uppercase;margin-bottom:32px;">
      <div style="width:6px;height:6px;background:#b8aef5;border-radius:50%;animation:pulse 2.5s infinite;"></div>
      Compassionate Collectivist · 12% of people
    </div>
    <div style="display:flex;gap:0;justify-content:center;margin:32px auto 24px;max-width:560px;border:1px solid rgba(157,147,232,0.22);border-radius:12px;">
      <div style="flex:1;padding:20px 16px;text-align:center;border-right:1px solid rgba(157,147,232,0.22);background:#111028;border-radius:12px 0 0 12px;">
        <span style="font-family:Playfair Display,serif;font-size:26px;font-weight:700;color:#c9a96e;display:block;margin-bottom:5px;">12%</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#8c88a0;letter-spacing:0.12em;text-transform:uppercase;">Worldview rarity</span>
      </div>
      <div style="flex:1;padding:20px 16px;text-align:center;border-right:1px solid rgba(157,147,232,0.22);background:#111028;">
        <span style="font-family:Playfair Display,serif;font-size:26px;font-weight:700;color:#c9a96e;display:block;margin-bottom:5px;">71%</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#8c88a0;letter-spacing:0.12em;text-transform:uppercase;">Conviction score</span>
      </div>
      <div style="flex:1;padding:20px 16px;text-align:center;background:#111028;border-radius:0 12px 12px 0;">
        <span style="font-family:Playfair Display,serif;font-size:18px;font-weight:700;color:#c9a96e;display:block;margin-bottom:5px;word-break:break-word;">Uncertainty</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#8c88a0;letter-spacing:0.12em;text-transform:uppercase;">Dominant axis</span>
      </div>
    </div>
    <!-- Share URL -->
    <div style="margin:0 auto 16px;max-width:560px;padding:12px 16px;background:rgba(201,169,110,0.06);border:1px solid rgba(201,169,110,0.22);border-radius:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;flex-shrink:0;">Share</span>
      <a href="${shareUrl}" style="font-family:IBM Plex Mono,monospace;font-size:11px;color:#e8c97a;word-break:break-all;flex:1;text-decoration:none;">${shareUrl}</a>
      <button onclick="navigator.clipboard.writeText('${shareUrl}').then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)})" style="background:rgba(201,169,110,0.15);border:1px solid rgba(201,169,110,0.35);color:#c9a96e;font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:1px;padding:6px 14px;border-radius:6px;cursor:pointer;flex-shrink:0;">Copy</button>
    </div>
  </div>
</div>

<!-- BODY -->
<div style="max-width:860px;margin:0 auto;padding:64px 28px 120px;">

  ${sec('Who you are', `<div style="background:rgba(157,147,232,0.04);border:1px solid rgba(255,255,255,0.10);border-left:3px solid #9d93e8;border-radius:12px;padding:32px 36px;"><div class="identity">${identityHtml}</div></div>`)}

  ${worldHtml.length ? sec('How you move through the world', `<p style="font-size:15px;color:#8c88a0;margin-bottom:28px;font-family:IBM Plex Mono,monospace;letter-spacing:0.04em;">Five lenses. How your worldview shapes what you see, how you act, and what you can do with that.</p>${worldHtml}`) : ''}

  ${patternsHtml ? sec('How you operate', patternsHtml) : ''}

  ${fingerprintHtml ? sec('Your philosophical fingerprint', `<p style="font-size:15px;color:#8c88a0;margin-bottom:24px;font-family:IBM Plex Mono,monospace;letter-spacing:0.04em;">The 5 axes where your position deviates furthest from centre.</p>${fingerprintHtml}`) : ''}

  ${alignmentHtml ? sec('Life alignment', alignmentHtml) : ''}

  ${growthHtml ? sec('Growth edges', growthHtml) : ''}

  ${t1Bars || t2Bars || t3Bars ? sec('Full belief map',
    tierDiv('Foundations and Structural', 't1') + t1Bars +
    tierDiv('Epistemic and Meaning', 't2') + t2Bars +
    tierDiv('Applied', 't3') + t3Bars
  ) : ''}

</div>

<!-- FOOTER -->
<div style="text-align:center;padding:40px 28px 60px;border-top:1px solid rgba(255,255,255,0.06);">
  <div style="font-family:IBM Plex Mono,monospace;font-size:14px;letter-spacing:4px;color:#8c88a0;">PHIL/OS · thelifepm.com</div>
  <div style="font-family:IBM Plex Mono,monospace;font-size:11px;color:#8c88a0;margin-top:8px;">156 questions · 34 belief axes · your archetype</div>
  <div style="margin-top:20px;">
    <a href="https://phil-os.thelifepm.com" style="display:inline-block;background:#c9a96e;color:#08061a;font-family:IBM Plex Mono,monospace;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:12px 28px;border-radius:6px;text-decoration:none;">Take the assessment</a>
  </div>
</div>

</body>
</html>`;
}
