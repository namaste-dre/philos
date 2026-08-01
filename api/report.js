import crypto from 'crypto';
import observability from '../lib/observability.js';
// D156 (2026-08-01): Andre ruled the public share page includes Belief
// Tensions, rendered with the collision visual. Contradictions are computed
// here from the row's own scores via the same verbatim-extracted 42-rule
// engine the dashboard uses (byte-parity-guarded against index.html), so
// the public page can never disagree with what the private report showed.
import contradictionsLib from '../lib/contradictions.js';
// Hotfix (2026-08-01): Call 1 no longer generates report.alignment (the
// Alignment Library wiring block, 923e07f, moved that content to
// deterministic client-side selection). New reports therefore arrive here
// with no report.alignment array. Falls back to the same deterministic
// selection server-side so the public share page does not silently lose
// its Life Alignment section for every report generated from now on.
// Historical reports that do carry a nonempty report.alignment render it
// unchanged, exactly as before.
import alignmentLib from '../lib/alignment-library-registry.js';
const { logEvent } = observability;
const { detectContradictions } = contradictionsLib;
const { getAlignmentCards } = alignmentLib;

export const config = { maxDuration: 60 };

// A3: escape-by-default for the public share page. Safe for both HTML text
// nodes and double-quoted attribute values (escapes the quote characters
// too). Report content (name, identity, world, alignment, patterns, growth)
// reaches this server-rendered, unauthenticated page raw - never trust it.
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATE_LIMIT      = 30;   // fetches per IP per window - generous for legitimate refreshes/shares
const RATE_WINDOW_HRS = 1;

// Problem 3B repair: this page previously showed a hardcoded "Compassionate
// Collectivist / 12% / 71% / Uncertainty" badge and stat row on every
// report regardless of the actual archetype. These percentages are the
// same authoritative population-rarity-by-family values index.html's own
// RARITY_BY_FAMILY table uses on the in-app Profile screen (showProfile()) -
// duplicated here only because index.html and this serverless function are
// separate JS contexts with no shared module today. Keep in sync with
// index.html's RARITY_BY_FAMILY if either changes.
const RARITY_BY_FAMILY = {
  'The Determined Humanist': '4%',
  'The Structural Reformer': '9%',
  'The Rational Empiricist': '11%',
  'The Existential Architect': '8%',
  'The Moral Realist': '14%',
  'The Compassionate Collectivist': '12%',
  'The Principled Libertarian': '7%',
  'The Stoic Naturalist': '6%',
  'The Spiritual Naturalist': '13%',
  'The Conservative Traditionalist': '18%',
  'The Pragmatic Centrist': '16%',
  'The Nihilist Reductionist': '2%',
};

// A0.2 containment: /api/report previously treated bare possession of the
// completion id (a value logged, emailed, and pasted around) as sufficient
// authorization. It is now not - a viewer must also present the capability
// token minted by api/capture.js at completion-ownership time.
//
// A7 (D136): the token is no longer purely stateless. A NULL share_token_salt
// means "this row has never been rotated" and validates against the
// original legacy formula (HMAC of id alone) - this is what keeps every
// share link issued before this change working unchanged. A non-NULL salt
// (set only by a user-initiated regenerate, api/share-control.js) means the
// row has been rotated at least once; only the current salt's token is
// valid, permanently invalidating every token computed under the old
// formula or a prior salt. Must be computed identically here and in
// capture.js.
function computeReportToken(id, salt) {
  const secret = process.env.SUPABASE_SERVICE_KEY || '';
  const material = salt ? `report-token:${id}:${salt}` : `report-token:${id}`;
  return crypto.createHmac('sha256', secret).update(material).digest('hex').slice(0, 32);
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
    logEvent('warn', 'report', 'rate_limit_check_failed', { message: e.message });
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

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const rate = await checkRateLimit(`report:${ip}`);
  if (!rate.allowed) return notFound();

  try {
    // D-3: first_name is never selected here - the public share page must
    // never carry the respondent's name, in the data it fetches as well as
    // what it renders. A7/D136: share_enabled and share_token_salt are
    // needed before the token can even be validated, since the salt is now
    // part of the expected-token formula - this necessarily moves the row
    // fetch ahead of token validation (previously id-only token validation
    // ran before any DB call). Cost of a DB read for a garbage token is
    // acceptable: rate limiting above still fails closed, and the response
    // stays the same uniform 404 either way, so no side channel is added.
    const response = await fetch(
      `${supabaseUrl}/rest/v1/completions?id=eq.${encodeURIComponent(id)}&select=report_json,scores,fingerprint,archetype_family,archetype_variant,axis_count,question_count,share_enabled,share_token_salt`,
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
    if (c.share_enabled === false) return notFound();

    const expectedToken = computeReportToken(id, c.share_token_salt);
    if (!tokenMatches(t, expectedToken)) return notFound();

    const report = c.report_json || {};
    const scores = c.scores || {};
    const fingerprint = c.fingerprint || [];
    const archetype = c.archetype_family || '';
    const variant = c.archetype_variant || '';
    const shareUrl = `https://phil-os.thelifepm.com/report?id=${id}&t=${t}`;

    // Targeted repair: this is private report content and the URL itself
    // carries the capability token - never cache it, and never let it leak
    // to a third party via the Referer header on an outbound link click.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.status(200).send(renderReportPage({ c, report, scores, fingerprint, archetype, variant, shareUrl }));

  } catch (e) {
    logEvent('error', 'report', 'request_failed', { message: e.message });
    return res.status(500).send(errorPage('Something went wrong loading this report.'));
  }
}

// Exported for containment tests only (A0.2) - not part of the public API surface.
// axisTrackServerHtml added at FM2 slice 2 so the geometry tests can prove
// exact parity with index.html's axisTrackHtml.
export const __testables__ = { computeReportToken, tokenMatches, UUID_RE, axisTrackServerHtml, renderReportPage };

function errorPage(msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phil OS</title>
  <style>body{background:#07061a;color:#f0ede6;font-family:IBM Plex Sans,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;}
  .msg{max-width:400px;} .logo{font-family:IBM Plex Mono,monospace;letter-spacing:4px;color:#c9a96e;margin-bottom:24px;font-size:20px;}
  p{color:#8c88a0;line-height:1.7;} a{color:#c9a96e;}</style></head>
  <body><div class="msg"><div class="logo">PHIL/OS</div><p>${msg}</p><p><a href="https://phil-os.thelifepm.com">Take the assessment</a></p></div></body></html>`;
}

// FM2 (Belief Map spec Section 11): centered-bipolar-geometry primitive for
// the public share page - the server-rendered mirror of index.html's
// axisTrackHtml(), kept mathematically identical to it on purpose (same
// (score-1)/6 mapping, same clamping, same 3-decimal formatting, same
// left/right centered fill and exact unrounded marker). This replaces the
// previous left-anchored score/7 fill, which was wrong on two counts: it
// used the 0-7 range for a 1-7 scale (score 4 rendered at 57%, not the 50%
// midpoint; score 1 rendered at 14% instead of 0%), and it read as a
// progress bar, which the spec explicitly rubric-caps. The share page has
// no stylesheet classes, so the geometry is emitted as inline styles that
// replicate index.html's .axis-track/.axis-center-tick/.axis-fill/
// .axis-marker rules. Score is defensively Number()-coerced and falls back
// to the 4.0 midpoint if non-finite, so garbage data renders as a neutral
// center rather than emitting NaN into CSS.
function axisTrackServerHtml(score, color, trackHeight = 8, fillExtra = '') {
  const n = Number(score);
  const s = Number.isFinite(n) ? n : 4;
  const rawPct = ((s - 1) / 6) * 100;
  const pct = Math.max(0, Math.min(100, rawPct));
  const left = Math.min(50, pct);
  const right = Math.min(50, 100 - pct);
  const fmt = v => Number(v.toFixed(3));
  const radius = Math.round(trackHeight / 2);
  return `<div style="height:${trackHeight}px;background:rgba(255,255,255,0.05);border-radius:${radius}px;overflow:visible;position:relative;">
    <div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,0.35);transform:translateX(-50%);"></div>
    <div style="position:absolute;top:0;height:100%;border-radius:${radius}px;left:${fmt(left)}%;right:${fmt(right)}%;background:${color};${fillExtra}"></div>
    <div style="position:absolute;top:50%;left:${fmt(pct)}%;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid rgba(7,6,26,0.9);box-shadow:0 0 0 1px rgba(255,255,255,0.5);transform:translate(-50%,-50%);"></div>
  </div>`;
}

function bar(score, color) {
  return axisTrackServerHtml(score, color, 8);
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

function worldCard(card, iconSvg, iconBg, iconColor) {
  if (!card) return '';
  return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <div style="display:flex;align-items:center;gap:14px;padding:18px 22px 14px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <div style="width:36px;height:36px;border-radius:8px;background:${iconBg};display:flex;align-items:center;justify-content:center;color:${iconColor};flex-shrink:0;">${iconSvg}</div>
      <div style="font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.7);">${escapeHtml(card.lens || '')}</div>
    </div>
    <div style="padding:20px 22px;">
      <div style="margin-bottom:16px;">
        <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8c88a0;margin-bottom:6px;">Your view</div>
        <div style="font-size:15px;line-height:1.75;color:#f0ede6;">${escapeHtml(card.view || '')}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8c88a0;margin-bottom:6px;">How it shows up</div>
        <div style="font-size:15px;line-height:1.75;color:#f0ede6;">${escapeHtml(card.shows_up || '')}</div>
      </div>
      <div style="padding:14px 16px;background:rgba(201,169,110,0.07);border-left:3px solid #c9a96e;border-radius:0 6px 6px 0;">
        <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;margin-bottom:6px;">Sit with this</div>
        <div style="font-size:14px;line-height:1.7;color:#e8c97a;font-style:italic;">${escapeHtml(card.prompt || '')}</div>
      </div>
    </div>
  </div>`;
}

function renderReportPage({ c, report, scores, fingerprint, archetype, variant, shareUrl }) {
  const tagline = report.tagline || '';
  const identity = report.identity || '';
  const identityHtml = (Array.isArray(identity) ? identity.join('\n\n') : identity)
    .split('\n\n').filter(Boolean).map(p => `<p style="margin-bottom:1.3em;font-size:19px;line-height:1.88;color:#f0ede6;">${escapeHtml(p)}</p>`).join('');

  const growth = Array.isArray(report.growth) ? report.growth : [];
  const worldCards = Array.isArray(report.world) ? report.world : [];
  // Preserve historical reports' AI-generated alignment cards unchanged;
  // compute the deterministic Alignment Library cards only when the report
  // has none (every report generated after 923e07f), using the same
  // approved candidate-axis sets and selector the authenticated report
  // page uses. getAlignmentCards() never throws and always returns exactly
  // 4 entries per the ruled mechanism (see lib/alignment-library-registry.js).
  const alignment = Array.isArray(report.alignment) && report.alignment.length > 0
    ? report.alignment
    : getAlignmentCards(scores || {});
  const patterns = Array.isArray(report.patterns) ? report.patterns : [];

  // A3 parity (2026-08-01): the authenticated report replaced content-area
  // emoji with the product's own stroke-icon language; the public share page
  // was left behind. Same five lens icons, same order, inlined as SVG since
  // this page has no stylesheet or icon font.
  const lensSvg = (paths) => '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const worldIcons = [
    { icon: lensSvg('<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21M8.5 21h7"/>'), bg: 'rgba(157,147,232,0.15)', color: 'rgba(200,190,255,0.9)' },
    { icon: lensSvg('<circle cx="9" cy="8.5" r="3"/><circle cx="16.5" cy="10.5" r="2.4"/><path d="M4 20c0-3.2 2.3-5.2 5-5.2s5 2 5 5.2M14.6 20c.2-2.4 1.6-3.9 3.4-3.9 1.7 0 2.9 1.4 3 3.9"/>'), bg: 'rgba(91,191,148,0.15)', color: 'rgba(150,225,195,0.9)' },
    { icon: lensSvg('<circle cx="6.5" cy="12" r="3"/><circle cx="17.5" cy="12" r="3"/><path d="M9.5 12h5"/>'), bg: 'rgba(201,169,110,0.15)', color: 'rgba(230,205,150,0.9)' },
    { icon: lensSvg('<path d="M4 21V10.5h5V21M9 21V5.5h6V21M15 21v-7.5h5V21M3 21h18"/>'), bg: 'rgba(224,120,74,0.15)', color: 'rgba(245,170,130,0.9)' },
    { icon: lensSvg('<path d="M3 17.5h18M7 17.5a5 5 0 0 1 10 0M12 6v2.2M6 8.5l1.5 1.5M18 8.5l-1.5 1.5"/>'), bg: 'rgba(180,130,255,0.15)', color: 'rgba(215,185,255,0.9)' },
  ];

  // FM2: same centered bipolar geometry as the belief-map rows below - the
  // previous left-anchored score/7 gradient fill had the same 1-7-scale
  // mapping bug as bar(). The directional gradient was replaced with the
  // solid tier-2 green (glow preserved) because a fixed left-to-right
  // gradient reads as a direction cue, which is misleading on a fill that
  // now grows from the center toward either pole.
  const fingerprintHtml = fingerprint.slice(0, 5).map(f => {
    return `<div style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-family:IBM Plex Mono,monospace;font-size:13px;color:#5bbf94;">${f.axis ? f.axis.replace(/_/g,' ') : ''}</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#c9a96e;font-weight:700;">${parseFloat(f.score).toFixed(1)}/7</span>
      </div>
      ${axisTrackServerHtml(f.score, '#5bbf94', 10, 'box-shadow:0 0 12px rgba(91,191,148,0.3);')}
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

  // Problem 3B: derive the header badge/stats from this report's own data
  // instead of the previous hardcoded values. Same formulas as index.html's
  // showProfile() (the in-app equivalent view). Anything not computable is
  // omitted rather than replaced with a placeholder or invented value.
  const rarityPct = RARITY_BY_FAMILY[archetype] || null;

  const axisKeys = Object.keys(scores);
  const convictionPct = axisKeys.length
    ? Math.round((axisKeys.reduce((s, k) => s + Math.abs((scores[k] || 4) - 4), 0) / axisKeys.length) * (100 / 3))
    : null;

  const topAxisEntry = fingerprint && fingerprint[0];
  const topAxisMeta = topAxisEntry ? scoresMap.find(a => a.key === topAxisEntry.axis) : null;
  const dominantAxisLabel = topAxisMeta ? topAxisMeta.label : null;

  const rarityBadgeHtml = rarityPct ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(157,147,232,0.10);border:1px solid rgba(157,147,232,0.28);border-radius:50px;padding:7px 18px;font-family:IBM Plex Mono,monospace;font-size:11px;color:#b8aef5;letter-spacing:0.10em;text-transform:uppercase;margin-bottom:32px;">
      <div style="width:6px;height:6px;background:#b8aef5;border-radius:50%;animation:pulse 2.5s infinite;"></div>
      ${archetype} · ${rarityPct} of people
    </div>` : '';

  const statBoxes = [
    rarityPct ? { value: rarityPct, label: 'Worldview rarity' } : null,
    convictionPct !== null ? { value: convictionPct + '%', label: 'Conviction score' } : null,
    dominantAxisLabel ? { value: dominantAxisLabel, label: 'Dominant axis' } : null,
  ].filter(Boolean);

  const statsRowHtml = statBoxes.length ? `<div style="display:flex;gap:0;justify-content:center;margin:32px auto 24px;max-width:560px;border:1px solid rgba(157,147,232,0.22);border-radius:12px;">
      ${statBoxes.map((b, i, arr) => {
        const isFirst = i === 0, isLast = i === arr.length - 1;
        const radius = isFirst && isLast ? '12px' : isFirst ? '12px 0 0 12px' : isLast ? '0 12px 12px 0' : '0';
        const borderRight = isLast ? '' : 'border-right:1px solid rgba(157,147,232,0.22);';
        return `<div style="flex:1;padding:20px 16px;text-align:center;background:#111028;border-radius:${radius};${borderRight}">
        <span style="font-family:Playfair Display,serif;font-size:${String(b.value).length > 10 ? '18px' : '26px'};font-weight:700;color:#c9a96e;display:block;margin-bottom:5px;word-break:break-word;">${b.value}</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#8c88a0;letter-spacing:0.12em;text-transform:uppercase;">${b.label}</span>
      </div>`;
      }).join('')}
    </div>` : '';

  const instrumentLine = (c.question_count && c.axis_count)
    ? `${c.question_count} questions · ${c.axis_count} belief axes · your archetype`
    : 'your archetype';

  const alignmentHtml = alignment.map(a => `
    <div style="background:#111028;border:1px solid rgba(255,255,255,0.10);border-radius:12px;padding:26px;margin-bottom:14px;">
      <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#c9a96e;margin-bottom:10px;font-weight:600;">${escapeHtml(a.label || '')}</div>
      <div style="font-size:16px;color:#f0ede6;line-height:1.75;">${escapeHtml(a.text || '')}</div>
    </div>`).join('');

  const patternsHtml = patterns.map(p => `
    <div style="background:#111028;border:2px solid rgba(255,255,255,0.22);border-left:3px solid ${p.type === 'positive' ? '#5bbf94' : '#e0784a'};border-radius:12px;padding:22px;margin-bottom:14px;">
      <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${p.type === 'positive' ? '#5bbf94' : '#e0784a'};margin-bottom:10px;font-weight:600;">${escapeHtml(p.label || '')}</div>
      <div style="font-size:16px;color:#f0ede6;line-height:1.65;">${escapeHtml(p.text || '')}</div>
    </div>`).join('');

  // Growth entries are {title, text, practice} objects since Phase 8;
  // older stored reports hold plain strings - render both.
  const growthHtml = growth.map((g, i) => `
    <div style="display:flex;gap:22px;padding:24px 26px;background:#111028;border:1px solid rgba(255,255,255,0.09);border-radius:12px;align-items:flex-start;margin-bottom:12px;">
      <div style="font-family:Playfair Display,serif;font-size:26px;color:#b8aef5;line-height:1.1;flex-shrink:0;font-weight:700;opacity:0.75;">${i + 1}</div>
      <div style="font-size:17px;color:#f0ede6;line-height:1.78;">${
        (g && typeof g === 'object')
          ? `<div style="font-weight:600;color:#f0ede6;margin-bottom:6px;">${escapeHtml(g.title || '')}</div>
             <div>${escapeHtml(g.text || '')}</div>
             ${g.practice ? `<div style="margin-top:10px;font-size:14px;color:#b8aef5;"><span style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">Try this</span><br>${escapeHtml(g.practice)}</div>` : ''}`
          : escapeHtml(g || '')
      }</div>
    </div>`).join('');

  const worldHtml = worldCards.map((card, i) => worldCard(card, worldIcons[i]?.icon || '', worldIcons[i]?.bg || 'rgba(255,255,255,0.06)', worldIcons[i]?.color || 'rgba(255,255,255,0.75)')).join('');

  // D156: Belief Tensions on the public page, collision visual included.
  // Computed from this row's own scores by the shared engine - registry
  // title/text/questions are server-owned constants, but they pass through
  // escapeHtml anyway to keep this page's escape-by-default rule uniform.
  const contradictions = detectContradictions(scores);
  const tierMeta = {
    A: { label: 'Hard Contradiction',  color: '#e87070', border: 'rgba(232,112,112,0.3)', bg: 'rgba(232,112,112,0.08)' },
    B: { label: 'Consistency Flag',    color: '#c9a96e', border: 'rgba(201,169,110,0.3)', bg: 'rgba(201,169,110,0.08)' },
    C: { label: 'Interesting Tension', color: '#b8aef5', border: 'rgba(157,147,232,0.3)', bg: 'rgba(157,147,232,0.08)' },
  };
  const collisionRow = (axisId) => {
    const meta = scoresMap.find(a => a.key === axisId);
    if (!meta) return '';
    const sc = Number(scores[axisId]) || 4;
    return `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
        <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#ccc8be;">${meta.label}</span>
        <span style="font-family:IBM Plex Mono,monospace;font-size:12px;color:#c9a96e;font-weight:700;">${sc.toFixed(1)}</span>
      </div>
      ${axisTrackServerHtml(sc, meta.color)}
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-family:IBM Plex Mono,monospace;font-size:10px;color:rgba(200,195,230,0.6);">
        <span>${meta.poleL}</span><span>${meta.poleR}</span>
      </div>
    </div>`;
  };
  const tensionsHtml = contradictions.length
    ? contradictions.map(t => {
        const tm = tierMeta[t.tier] || tierMeta.C;
        const bars = t.strength >= 0.66 ? 3 : t.strength >= 0.33 ? 2 : 1;
        const strengthBars = Array.from({ length: 3 }, (_, i) =>
          `<span style="width:5px;height:${8 + i * 3}px;border-radius:2px;background:${i < bars ? tm.color : 'rgba(255,255,255,0.15)'};display:inline-block;margin:0 1px;vertical-align:bottom;"></span>`
        ).join('');
        const collisionHtml = (scoresMap.some(a => a.key === t.a) && scoresMap.some(a => a.key === t.b))
          ? `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 16px 10px;margin:14px 0 16px;">
              <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b4b0c8;margin-bottom:12px;">The two positions in tension</div>
              ${collisionRow(t.a)}
              ${collisionRow(t.b)}
            </div>` : '';
        const questionsHtml = (t.questions && t.questions.length)
          ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.07);">
              <div style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b4b0c8;margin-bottom:8px;">Questions to sit with</div>
              ${t.questions.map(q => `<div style="font-size:14px;color:#d4d0c8;line-height:1.7;margin-bottom:8px;">${escapeHtml(q)}</div>`).join('')}
            </div>` : '';
        return `<div style="background:#111028;border:1px solid rgba(255,255,255,0.10);border-left:4px solid ${tm.color};border-radius:12px;padding:28px 32px;margin-bottom:16px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap;">
            <div style="font-family:IBM Plex Mono,monospace;font-size:12px;color:${tm.color};letter-spacing:0.10em;font-weight:600;text-transform:uppercase;">${escapeHtml(t.title)}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span title="Tension strength: ${Math.round((t.strength || 0) * 100)}%" style="opacity:0.7;">${strengthBars}</span>
              <span style="font-family:IBM Plex Mono,monospace;font-size:9px;letter-spacing:0.12em;padding:3px 10px;border-radius:50px;text-transform:uppercase;border:1px solid ${tm.border};color:${tm.color};background:${tm.bg};flex-shrink:0;">${tm.label}</span>
            </div>
          </div>
          ${collisionHtml}
          <div style="font-size:16px;color:#d4d0c8;line-height:1.78;max-width:54ch;">${escapeHtml(t.text || '')}</div>
          ${questionsHtml}
        </div>`;
      }).join('')
    : `<div style="background:linear-gradient(135deg,rgba(91,191,148,0.07) 0%,rgba(157,147,232,0.05) 100%);border:1px solid rgba(91,191,148,0.25);border-radius:12px;padding:28px 28px 22px;text-align:left;">
        <div style="width:44px;height:44px;border-radius:50%;border:2px solid rgba(91,191,148,0.5);color:rgba(91,191,148,1);font-family:IBM Plex Mono,monospace;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:14px;">0</div>
        <div style="font-family:Playfair Display,serif;font-size:22px;font-weight:700;color:#f0ede6;margin-bottom:12px;">No logical tensions detected</div>
        <p style="font-size:16px;color:#d4d0c8;line-height:1.78;max-width:54ch;margin:0 0 12px;">The engine ran all 42 consistency checks across the 32 axis positions in this report and found no pair of beliefs pulling in logically incompatible directions. Most profiles carry at least one unexamined tension. A clean result means these positions, as measured, fit together.</p>
        <p style="font-size:16px;color:#d4d0c8;line-height:1.78;max-width:54ch;margin:0;">This is not proof the worldview is correct. It means the positions held are mutually consistent under every check the engine knows.</p>
      </div>`;

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
<meta property="og:title" content="A Phil OS Report, ${escapeHtml(archetype)}"/>
<meta name="robots" content="noindex, nofollow"/>
<meta property="og:description" content="${escapeHtml(tagline)}"/>
<meta property="og:url" content="${escapeHtml(shareUrl)}"/>
<title>Phil OS Report</title>
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
    ${rarityBadgeHtml}
    ${statsRowHtml}
    <!-- Share URL -->
    <div style="margin:0 auto 16px;max-width:560px;padding:12px 16px;background:rgba(201,169,110,0.06);border:1px solid rgba(201,169,110,0.22);border-radius:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-family:IBM Plex Mono,monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;flex-shrink:0;">Share</span>
      <a id="share-url-link" href="${escapeHtml(shareUrl)}" style="font-family:IBM Plex Mono,monospace;font-size:11px;color:#e8c97a;word-break:break-all;flex:1;text-decoration:none;">${escapeHtml(shareUrl)}</a>
      <button id="share-url-copy" type="button" style="background:rgba(201,169,110,0.15);border:1px solid rgba(201,169,110,0.35);color:#c9a96e;font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:1px;padding:6px 14px;border-radius:6px;cursor:pointer;flex-shrink:0;">Copy</button>
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

  ${sec('Belief tensions', `<p style="font-size:15px;color:#8c88a0;margin-bottom:24px;font-family:IBM Plex Mono,monospace;letter-spacing:0.04em;">Where positions in this profile pull against each other, found by 42 consistency checks across all 32 axes.</p>${tensionsHtml}`)}

  ${t1Bars || t2Bars || t3Bars ? sec('Full belief map',
    tierDiv('Foundations and Structural', 't1') + t1Bars +
    tierDiv('Epistemic and Meaning', 't2') + t2Bars +
    tierDiv('Applied', 't3') + t3Bars
  ) : ''}

</div>

<!-- FOOTER -->
<div style="text-align:center;padding:40px 28px 60px;border-top:1px solid rgba(255,255,255,0.06);">
  <div style="font-family:IBM Plex Mono,monospace;font-size:14px;letter-spacing:4px;color:#8c88a0;">PHIL/OS · thelifepm.com</div>
  <div style="font-family:IBM Plex Mono,monospace;font-size:11px;color:#8c88a0;margin-top:8px;">${instrumentLine}</div>
  <div style="margin-top:20px;">
    <a href="https://phil-os.thelifepm.com" style="display:inline-block;background:#c9a96e;color:#08061a;font-family:IBM Plex Mono,monospace;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:12px 28px;border-radius:6px;text-decoration:none;">Take the assessment</a>
  </div>
</div>

<script>
(function () {
  var btn = document.getElementById('share-url-copy');
  var link = document.getElementById('share-url-link');
  if (!btn || !link) return;
  btn.addEventListener('click', function () {
    var url = link.getAttribute('href');
    navigator.clipboard.writeText(url).then(function () {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
    });
  });
})();
</script>
</body>
</html>`;
}
