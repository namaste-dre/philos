// A7 (D-1/D136) containment tests for the share-state-aware token minting
// added to api/capture.js's handler (getShareState + the salt/enabled-aware
// computeReportToken call). Not a full re-test of capture.js's pre-existing
// surface (ownership/IDOR, rate limiting, response-row insertion are
// unchanged and already exercised indirectly via api/claim-attempt.test.js's
// shared patterns) - scoped to the new minting behavior this block added.
//
// Same no-dependency approach as the other api/*.test.js files. No live
// Supabase calls - fetch is mocked throughout.
//
// Run with:
//   node --experimental-vm-modules api/capture.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function linker(specifier) {
  // capture.js imports node's crypto plus the two CommonJS dashboard
  // computation libs (default-imported; Vercel's bundler provides the same
  // interop in production). Everything else stays a hard error so a
  // surprise new dependency can't slip in unnoticed.
  let target = null;
  if (specifier === 'crypto') target = require('crypto');
  else if (specifier === '../lib/dashboard.js') target = require('../lib/dashboard.js');
  else if (specifier === '../lib/contradictions.js') target = require('../lib/contradictions.js');
  else if (specifier === '../lib/observability.js') target = require('../lib/observability.js');
  else if (specifier === '../lib/alignment-library-registry.js') target = require('../lib/alignment-library-registry.js');
  else throw new Error('unexpected import: ' + specifier);

  const m = new vm.SyntheticModule(['default'], function () {
    this.setExport('default', target);
  }, { identifier: specifier });
  await m.link(() => { throw new Error('synthetic module has no imports'); });
  await m.evaluate();
  return m;
}

async function loadModule(filename) {
  const filePath = path.join(__dirname, filename);
  const source = fs.readFileSync(filePath, 'utf8');
  const mod = new vm.SourceTextModule(source, { identifier: filePath });
  await mod.link(linker);
  await mod.evaluate();
  return mod.namespace;
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function mockRes() {
  const res = {
    statusCode: null, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; },
  };
  return res;
}

function mockReq({ method = 'POST', body = {}, headers = {} } = {}) {
  return { method, body, headers, socket: { remoteAddress: '203.0.113.12' } };
}

const VALID_TOKEN = 'valid-test-token';
const VALID_USER = { id: 'user-abc' };
const COMPLETION_ID = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

async function run() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-secret';
  process.env.SUPABASE_ANON_KEY = 'test-anon';

  const captureMod = await loadModule('capture.js');
  const reportMod  = await loadModule('report.js');
  const handler = captureMod.default;
  const ct = captureMod.__testables__;
  const rt = reportMod.__testables__;

  const originalFetch = global.fetch;

  function installFetch({ shareEnabled = true, shareTokenSalt = null } = {}) {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return { ok: true, json: async () => VALID_USER };
      if (u.includes('/rest/v1/rate_limits')) return { ok: true, json: async () => ([]) };
      if (u.includes('/rest/v1/completions') && u.includes('select=user_id')) {
        return { ok: true, json: async () => ([{ user_id: VALID_USER.id }]) };
      }
      if (u.includes('/rest/v1/completions') && u.includes('share_enabled')) {
        return { ok: true, json: async () => ([{ share_enabled: shareEnabled, share_token_salt: shareTokenSalt }]) };
      }
      throw new Error('unexpected fetch: ' + u);
    };
  }

  // ---- Sharing enabled, never rotated (NULL salt) -> legacy-formula token, matches report.js ----
  {
    installFetch({ shareEnabled: true, shareTokenSalt: null });
    const req = mockReq({ body: { completion_id: COMPLETION_ID }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('mint (enabled, NULL salt) -> 200', res.statusCode === 200, res.statusCode);
    ok('response reports share_enabled: true', res.body && res.body.share_enabled === true, res.body);
    ok('minted token equals the legacy formula, matching report.js', res.body.report_token === rt.computeReportToken(COMPLETION_ID), res.body);
  }

  // ---- Sharing enabled, rotated (real salt) -> salted token, matches report.js ----
  {
    installFetch({ shareEnabled: true, shareTokenSalt: 'a-real-salt' });
    const req = mockReq({ body: { completion_id: COMPLETION_ID }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('mint (enabled, real salt) -> 200', res.statusCode === 200, res.statusCode);
    ok('minted token equals the salted formula, matching report.js', res.body.report_token === rt.computeReportToken(COMPLETION_ID, 'a-real-salt'), res.body);
    ok('minted token differs from the legacy no-salt token', res.body.report_token !== rt.computeReportToken(COMPLETION_ID), res.body);
  }

  // ---- Sharing disabled -> refuses to mint, does not expose an active-looking token ----
  {
    installFetch({ shareEnabled: false, shareTokenSalt: 'irrelevant-once-disabled' });
    const req = mockReq({ body: { completion_id: COMPLETION_ID }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('mint attempt while disabled -> 200 (clear disabled state, not an error)', res.statusCode === 200, res.statusCode);
    ok('response reports share_enabled: false', res.body && res.body.share_enabled === false, res.body);
    ok('no report_token is returned while sharing is disabled', res.body.report_token === null, res.body);
  }

  // ---- Direct unit tests on getShareState/computeReportToken ----
  {
    installFetch({ shareEnabled: true, shareTokenSalt: 'x' });
    const state = await ct.getShareState('https://example.supabase.co', { 'apikey': 'k', 'Authorization': 'Bearer k' }, COMPLETION_ID);
    ok('getShareState returns the row shape', state && state.share_enabled === true && state.share_token_salt === 'x', state);
  }
  ok('computeReportToken(id) === computeReportToken(id, null)', ct.computeReportToken(COMPLETION_ID) === ct.computeReportToken(COMPLETION_ID, null));

  // ═══ Dashboard read surface (D114 spec) - GET on this endpoint ═══

  const COMPLETION_B = 'c3d4e5f6-a7b8-4901-c234-56789abcdef0';
  function completionRow(id, iso, scores, extras = {}) {
    return {
      id, completed_at: iso, archetype_family: 'F1', archetype_variant: 'V1',
      contradictions_count: 1, scores, fingerprint: [], instrument_version: 'v4', ...extras,
    };
  }
  function dashScores(fill, overrides = {}) {
    const s = { naturalism: fill, religion: fill, determinism: fill, justice: fill, epistemic_humility: fill };
    return { ...s, ...overrides };
  }

  // Routing mock for the GET surface: auth + completions-by-user + notes.
  function installDashboardFetch({ authOk = true, rows = [], noteRows = [], noteWrites = null } = {}) {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) {
        if (!authOk) return { ok: false };
        return { ok: true, json: async () => VALID_USER };
      }
      if (u.includes('/rest/v1/personal_notes')) {
        if (opts && (opts.method === 'POST' || opts.method === 'DELETE')) {
          if (noteWrites) noteWrites.push({ method: opts.method, url: u, body: opts.body ? JSON.parse(opts.body) : null });
          return { ok: true, json: async () => ([]) };
        }
        return { ok: true, json: async () => noteRows };
      }
      if (u.includes('/rest/v1/completions') && u.includes('select=user_id')) {
        return { ok: true, json: async () => ([{ user_id: VALID_USER.id }]) };
      }
      if (u.includes('/rest/v1/completions')) {
        // The handler's own URL must scope by the verified user - assert it.
        if (!u.includes(`user_id=eq.${VALID_USER.id}`)) throw new Error('completions query not scoped to verified user: ' + u);
        return { ok: true, json: async () => rows };
      }
      throw new Error('unexpected fetch: ' + u);
    };
  }

  function mockGetReq(query = {}, authed = true) {
    return {
      method: 'GET', query, body: null,
      headers: authed ? { authorization: `Bearer ${VALID_TOKEN}` } : {},
      socket: { remoteAddress: '203.0.113.12' },
    };
  }

  // ---- GET requires a session ----
  {
    installDashboardFetch();
    const res = mockRes();
    await handler(mockGetReq({}, false), res);
    ok('GET without a token -> 401 (dashboard is never anonymous)', res.statusCode === 401, res.statusCode);
  }
  {
    installDashboardFetch({ authOk: false });
    const res = mockRes();
    await handler(mockGetReq(), res);
    ok('GET with an invalid session -> 401', res.statusCode === 401, res.statusCode);
  }

  // ---- Full dashboard payload ----
  {
    const rows = [
      completionRow(COMPLETION_ID, '2026-01-01T00:00:00Z', dashScores(4.0, { determinism: 2.0 })),
      completionRow(COMPLETION_B, '2026-06-01T00:00:00Z', dashScores(4.0, { determinism: 6.0 })),
    ];
    installDashboardFetch({ rows, noteRows: [{ completion_id: COMPLETION_ID, note_text: 'read Camus', updated_at: '2026-01-02T00:00:00Z' }] });
    const res = mockRes();
    await handler(mockGetReq({ view: 'dashboard' }), res);
    ok('dashboard view -> 200 with ok:true', res.statusCode === 200 && res.body.ok === true, res.statusCode);
    ok('dashboard returns each completion with elapsed text', res.body.completions.length === 2 && typeof res.body.completions[0].elapsed === 'string');
    ok('overview reflects the latest completion and total count', res.body.overview.totalCompletions === 2);
    ok('trends carry a series per axis with one point per completion', res.body.trends.determinism.length === 2);
    ok('pole crossings detect the determinism left-to-right flip', res.body.poleCrossings.some(c => c.axisId === 'determinism' && c.fromSide === 'left' && c.toSide === 'right'));
    ok('stability/flux is computed (2 completions = sufficient data)', res.body.stabilityFlux.insufficientData === false);
    ok('notes are keyed by completion id', res.body.notes[COMPLETION_ID] && res.body.notes[COMPLETION_ID].text === 'read Camus');
    ok('raw report_json is NOT in the dashboard payload (fetched per-report only)', !JSON.stringify(res.body).includes('report_json'));
  }

  // ---- Historical report view: ownership enforced in the query itself ----
  {
    installDashboardFetch({ rows: [completionRow(COMPLETION_ID, '2026-01-01T00:00:00Z', dashScores(4.0), { report_json: { identity: 'x' } })] });
    const res = mockRes();
    await handler(mockGetReq({ view: 'report', completion_id: COMPLETION_ID }), res);
    ok('report view -> 200 with the completion row', res.statusCode === 200 && res.body.completion.id === COMPLETION_ID);
  }
  {
    installDashboardFetch({ rows: [] });
    const res = mockRes();
    await handler(mockGetReq({ view: 'report', completion_id: COMPLETION_ID }), res);
    ok('report view for a row the user does not own -> 404 (scoped query returns nothing)', res.statusCode === 404);
  }
  {
    installDashboardFetch();
    const res = mockRes();
    await handler(mockGetReq({ view: 'report', completion_id: 'not-a-uuid' }), res);
    ok('report view rejects a malformed completion_id with 400', res.statusCode === 400);
  }

  // ---- Compare view ----
  {
    const rows = [
      completionRow(COMPLETION_ID, '2026-01-01T00:00:00Z', dashScores(4.0, { determinism: 6.0, justice: 1.5 })),
      completionRow(COMPLETION_B, '2026-06-01T00:00:00Z', dashScores(4.0, { determinism: 4.0, justice: 4.0 })),
    ];
    installDashboardFetch({ rows });
    const res = mockRes();
    await handler(mockGetReq({ view: 'compare', a: COMPLETION_ID, b: COMPLETION_B }), res);
    ok('compare view -> 200 with comparison + contradiction diff', res.statusCode === 200 && res.body.comparison && res.body.contradictionDiff);
    ok('compare reports the C01 contradiction as resolved (fired in A, gone in B)',
      res.body.contradictionDiff.resolved.some(r => r.id === 'C01'), res.body.contradictionDiff.resolved.map(r => r.id));
  }

  // ---- Contradictions view ----
  {
    installDashboardFetch({ rows: [completionRow(COMPLETION_ID, '2026-01-01T00:00:00Z', dashScores(4.0, { determinism: 6.0, justice: 1.5 }))] });
    const res = mockRes();
    await handler(mockGetReq({ view: 'contradictions', completion_id: COMPLETION_ID }), res);
    ok('contradictions view returns the fired rules with tier and strength', res.statusCode === 200 &&
      res.body.contradictions.some(r => r.id === 'C01' && r.tier === 'A' && typeof r.strength === 'number'));
  }

  // ---- CSV export ----
  {
    const sendCalls = [];
    installDashboardFetch({ rows: [completionRow(COMPLETION_ID, '2026-01-01T00:00:00Z', dashScores(4.0))] });
    const res = mockRes();
    res.send = function (payload) { sendCalls.push(payload); return this; };
    await handler(mockGetReq({ view: 'export', format: 'csv' }), res);
    ok('csv export -> 200 text/csv attachment', res.statusCode === 200 &&
      String(res.headers['Content-Type']).includes('text/csv') &&
      String(res.headers['Content-Disposition']).includes('attachment'));
    ok('csv carries a header row plus one row per completion', sendCalls[0] && sendCalls[0].split('\n').length === 2);
  }

  // ---- Unknown view ----
  {
    installDashboardFetch();
    const res = mockRes();
    await handler(mockGetReq({ view: 'nope' }), res);
    ok('unknown view -> 400', res.statusCode === 400);
  }

  // ═══ Personal note writes (D114 Section 3.12) ═══
  {
    const noteWrites = [];
    installDashboardFetch({ noteWrites });
    const req = mockReq({ body: { note_action: 'save', completion_id: COMPLETION_ID, note_text: 'went through a breakup' }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('note save -> 200 saved', res.statusCode === 200 && res.body.saved === true, res.body);
    ok('note save upserts on completion_id with the verified user_id', noteWrites.some(w =>
      w.method === 'POST' && w.url.includes('on_conflict=completion_id') && w.body.user_id === VALID_USER.id));
  }
  {
    installDashboardFetch();
    const req = mockReq({ body: { note_action: 'save', completion_id: COMPLETION_ID, note_text: 'x'.repeat(2001) }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('note save over the 2000-char cap -> 400', res.statusCode === 400);
  }
  {
    const noteWrites = [];
    installDashboardFetch({ noteWrites });
    const req = mockReq({ body: { note_action: 'delete', completion_id: COMPLETION_ID }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('note delete -> 200 deleted', res.statusCode === 200 && res.body.deleted === true, res.body);
    ok('note delete is scoped to both completion and verified user', noteWrites.some(w =>
      w.method === 'DELETE' && w.url.includes(COMPLETION_ID) && w.url.includes(VALID_USER.id)));
  }
  {
    installDashboardFetch();
    const req = mockReq({ body: { note_action: 'save', completion_id: COMPLETION_ID, note_text: 'hi' } });
    const res = mockRes();
    await handler(req, res);
    ok('note write without a session -> 401', res.statusCode === 401);
  }
  {
    // Ownership rejection: completion belongs to someone else.
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return { ok: true, json: async () => VALID_USER };
      if (u.includes('select=user_id')) return { ok: true, json: async () => ([{ user_id: 'someone-else' }]) };
      throw new Error('unexpected fetch: ' + u);
    };
    const req = mockReq({ body: { note_action: 'save', completion_id: COMPLETION_ID, note_text: 'hi' }, headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    ok('note write against another user\'s completion -> 403', res.statusCode === 403);
  }

  global.fetch = originalFetch;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
