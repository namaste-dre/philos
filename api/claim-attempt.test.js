// A1 containment tests for api/claim-attempt.js.
//
// Same no-dependency approach as api/generate.test.js and api/report.test.js:
// loads the real source as an ES module via node:vm's SourceTextModule
// (this repo has no package.json declaring "type": "module"). No live
// Supabase calls anywhere in this file - fetch is mocked throughout.
//
// This file verifies the ENDPOINT's identity/ownership/allowlist logic and
// its correct interpretation of every claim_attempt() RPC response shape.
// It does not and cannot verify Postgres's own concurrent-transaction
// behavior - that requires a real database engine. See the Build Log entry
// for this block for what was verified there instead (an isolated,
// non-production, no-PII proof of the same INSERT ... ON CONFLICT DO
// NOTHING atomicity primitive the claim_attempt() function relies on) and
// what remains a documented residual gap (a live concurrent call against
// the actual deployed function, blocked by this project's Supabase plan
// tier lacking branching, and correctly refused by the permission system
// for any further ad-hoc production resource creation).
//
// Run with:
//   node --experimental-vm-modules api/claim-attempt.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function loadModule(filename) {
  const filePath = path.join(__dirname, filename);
  const source = fs.readFileSync(filePath, 'utf8');
  const mod = new vm.SourceTextModule(source, { identifier: filePath });
  await mod.link(() => { throw new Error(filename + ' must not import anything'); });
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
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; },
  };
  return res;
}

function mockReq({ method = 'POST', body = {}, headers = {} } = {}) {
  return { method, body, headers, socket: { remoteAddress: '203.0.113.10' } };
}

const VALID_TOKEN = 'valid-test-token';
const VALID_USER = { id: 'user-abc', email: 'legit@example.com' };
const OTHER_USER_ID = 'user-xyz';
const ATTEMPT_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const COMPLETION_ID = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

function authHeaders(token = VALID_TOKEN) {
  return { authorization: `Bearer ${token}` };
}

async function run() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-secret';
  process.env.SUPABASE_ANON_KEY = 'test-anon';
  // Set before ANY test runs (not just the researchKeyFor unit tests further
  // down) - the D118 honoring tests call researchKeyFor() too, and Web
  // Crypto's importKey rejects a zero-length HMAC key outright (unlike
  // Node's crypto.createHmac, which silently accepts one) - matching real
  // production, which already requires this var configured for
  // research-sync.js's identical dependency on it.
  process.env.RESEARCH_KEY_PEPPER = 'test-pepper';

  const mod = await loadModule('claim-attempt.js');
  const handler = mod.default;

  const originalFetch = global.fetch;

  // D118 path (a): the 'complete' action now also runs honorResearchConsentIfNeeded()
  // after its PATCH succeeds. profileGetHandler is optional and defaults to
  // "no consent" (research_consent: false) so every EXISTING test below that
  // doesn't pass it keeps behaving exactly as before - the honoring function
  // returns immediately after that first GET, never reaching
  // research_profiles at all. Only the new research-consent-honoring tests
  // further down pass a real profileGetHandler/researchProfilesHandler to
  // exercise the full path.
  function installAuth(rpcHandler, patchHandler, getHandler, profileGetHandler, researchProfilesHandler) {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) {
        const authz = (opts.headers['Authorization'] || opts.headers['authorization'] || '');
        const tok = authz.replace('Bearer ', '');
        if (tok === VALID_TOKEN) return { ok: true, json: async () => VALID_USER };
        return { ok: false };
      }
      if (u.includes('/rest/v1/rpc/claim_attempt')) return rpcHandler(url, opts);
      if (u.includes('/rest/v1/completions') && opts.method === 'PATCH') return patchHandler(url, opts);
      if (u.includes('/rest/v1/completions')) return getHandler(url, opts);
      if (u.includes('/rest/v1/profiles')) {
        if (profileGetHandler) return profileGetHandler(url, opts);
        return { ok: true, json: async () => ([{ research_consent: false }]) };
      }
      if (u.includes('/rest/v1/research_profiles')) {
        if (researchProfilesHandler) return researchProfilesHandler(url, opts);
        throw new Error('unexpected research_profiles fetch - pass researchProfilesHandler to exercise this: ' + u);
      }
      throw new Error('unexpected fetch: ' + u);
    };
  }

  // ---- Authorization ----
  {
    installAuth(async () => ({ ok: true, json: async () => ([]) }), async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([]) }));
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID } }); // no auth
    const res = mockRes();
    await handler(req, res);
    ok('missing bearer token -> 401', res.statusCode === 401, res.body);
  }
  {
    installAuth(async () => ({ ok: true, json: async () => ([]) }), async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([]) }));
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders('garbage-token') });
    const res = mockRes();
    await handler(req, res);
    ok('invalid bearer token -> 401', res.statusCode === 401, res.body);
  }

  // ---- Shape validation ----
  {
    installAuth(async () => ({ ok: true, json: async () => ([]) }), async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([]) }));
    const req = mockReq({ body: { action: 'claim', attempt_id: 'not-a-uuid' }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('malformed attempt_id -> 400', res.statusCode === 400, res.body);
  }
  {
    installAuth(async () => ({ ok: true, json: async () => ([]) }), async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([]) }));
    const req = mockReq({ body: { action: 'bogus' }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('unknown action -> 400', res.statusCode === 400, res.body);
  }
  {
    installAuth(async () => ({ ok: true, json: async () => ([]) }), async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([]) }));
    const req = mockReq({ body: null, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('null body -> 400', res.statusCode === 400, res.body);
  }

  // ---- Claim: RPC response translation ----
  // D117 cap pre-checks now run before every non-QA claim reaches the RPC.
  // capGetHandler simulates the completions GETs those pre-checks issue:
  // the attempt_id=eq. existing-status check, and the two attempt_status=eq.
  // count checks (complete/failed). existingStatus is null (no row yet),
  // 'pending', 'complete', or 'failed' - only 'pending'/'complete' bypass
  // the cap check (Lyra/Codex correction, 2026-07-29): an existing 'failed'
  // row is a reclaim, not a bypass, and falls through to the same cap check
  // as a brand-new attempt. successCount/failedCount control what the two
  // count queries report whenever the cap check actually runs.
  function capGetHandler({ existingStatus = null, successCount = 0, failedCount = 0 } = {}) {
    return async (url) => {
      const u = String(url);
      if (u.includes('attempt_id=eq.')) {
        return { ok: true, json: async () => (existingStatus ? [{ attempt_status: existingStatus }] : []) };
      }
      if (u.includes('attempt_status=eq.complete')) {
        return { ok: true, json: async () => Array.from({ length: successCount }, (_, i) => ({ id: 'ok' + i })) };
      }
      if (u.includes('attempt_status=eq.failed')) {
        return { ok: true, json: async () => Array.from({ length: failedCount }, (_, i) => ({ id: 'fail' + i })) };
      }
      throw new Error('unexpected completions GET in claim cap pre-check: ' + u);
    };
  }
  {
    let sentParams = null;
    installAuth(
      async (url, opts) => { sentParams = JSON.parse(opts.body); return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: null, successCount: 0, failedCount: 0 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID, qa_mode: false }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('fresh claim, under both caps -> 200 with should_generate true', res.statusCode === 200 && res.body.should_generate === true, res.body);
    ok('claim uses server-verified user id, not any client-supplied one', sentParams.p_user_id === VALID_USER.id, sentParams);
    ok('claim forwards attempt_id and qa_mode', sentParams.p_attempt_id === ATTEMPT_ID && sentParams.p_qa_mode === false, sentParams);
  }
  {
    installAuth(
      async () => ({ ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'complete', out_report_json: { tagline: 'hi' }, out_should_generate: false }]) }),
      null, capGetHandler({ existingStatus: 'complete' }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('replay claim -> 200 with status complete and stored report_json', res.statusCode === 200 && res.body.status === 'complete' && res.body.report_json.tagline === 'hi', res.body);
    ok('replay claim -> should_generate false (no duplicate LLM work)', res.body.should_generate === false, res.body);
  }
  {
    installAuth(
      async () => ({ ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: false }]) }),
      null, capGetHandler({ existingStatus: 'pending' }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('someone else already generating -> should_generate false, status pending', res.statusCode === 200 && res.body.status === 'pending' && res.body.should_generate === false, res.body);
  }
  {
    installAuth(async () => ({ ok: false, status: 500 }), null, capGetHandler({ existingStatus: null, successCount: 0, failedCount: 0 }));
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('RPC failure -> 500, non-disclosing', res.statusCode === 500 && !JSON.stringify(res.body).includes('SUPABASE_SERVICE_KEY'), res.body);
  }

  // ---- D117: monthly generation caps ----
  {
    // At the success cap (2) on a brand-new attempt -> blocked before the RPC ever runs.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: null, successCount: 2, failedCount: 0 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('at success cap (2 this month) -> 403 monthly_generation_cap_reached', res.statusCode === 403 && res.body.error === 'monthly_generation_cap_reached' && res.body.cap === 'success', res.body);
    ok('at success cap -> RPC never called', rpcCalled === false);
  }
  {
    // At the failed cap (3) on a brand-new attempt -> blocked before the RPC ever runs.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: null, successCount: 0, failedCount: 3 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('at failed cap (3 this month) -> 403 monthly_generation_cap_reached', res.statusCode === 403 && res.body.error === 'monthly_generation_cap_reached' && res.body.cap === 'failed', res.body);
    ok('at failed cap -> RPC never called', rpcCalled === false);
  }
  {
    // One below each cap -> still allowed through to the RPC.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: null, successCount: 1, failedCount: 2 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('one below both caps -> 200, RPC called', res.statusCode === 200 && rpcCalled === true, res.body);
  }
  {
    // Retrying a genuinely in-flight attempt ('pending') bypasses the cap
    // entirely, even far over both caps - it is not new generation work.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: 'pending', successCount: 99, failedCount: 99 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('retry of a pending attempt bypasses the cap entirely -> 200, RPC called', res.statusCode === 200 && rpcCalled === true, res.body);
  }
  {
    // Replaying a 'complete' attempt bypasses the cap entirely, even far
    // over both caps - deterministic replay, never new generation work.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'complete', out_report_json: {}, out_should_generate: false }]) }; },
      null, capGetHandler({ existingStatus: 'complete', successCount: 99, failedCount: 99 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('replay of a complete attempt bypasses the cap entirely -> 200, RPC called', res.statusCode === 200 && rpcCalled === true, res.body);
  }
  {
    // Lyra/Codex correction (2026-07-29, SECOND PASS): the first correction
    // let a 'failed' attempt below cap proceed to the RPC (reclaiming the
    // failed row). Lyra's re-review found this still collapses onto the
    // same row on the reload/resume path without ever consuming a distinct
    // failed slot - so a 'failed' attempt_id must never reach the RPC again
    // via this endpoint, capped or not. Below both caps -> 409
    // failed_attempt_restart_required, RPC never called; the client is
    // expected to mint a fresh attempt_id and retry.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: 'failed', successCount: 0, failedCount: 1 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('failed attempt below both caps -> 409 failed_attempt_restart_required, RPC never called (this is the second fix)', res.statusCode === 409 && res.body.error === 'failed_attempt_restart_required' && rpcCalled === false, res.body);
  }
  {
    // Lyra/Codex correction (2026-07-29): reclaiming an existing 'failed'
    // attempt IS gated by the failed cap - at 3 failed rows this month
    // (this row itself is one of them), the reclaim is blocked, not waved
    // through as a harmless replay.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: 'failed', successCount: 0, failedCount: 3 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('reclaiming a failed attempt at the failed cap -> 403, RPC never called (this is the fix)', res.statusCode === 403 && res.body.cap === 'failed' && rpcCalled === false, res.body);
  }
  {
    // Same fix, success side: reclaiming a failed attempt while already at
    // the success cap is also blocked - succeeding this time would be a 3rd
    // successful report this month.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingStatus: 'failed', successCount: 2, failedCount: 0 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('reclaiming a failed attempt at the success cap -> 403, RPC never called', res.statusCode === 403 && res.body.cap === 'success' && rpcCalled === false, res.body);
  }
  {
    // QA mode is excluded from the caps entirely - no cap pre-check GET is
    // even issued (capGetHandler would throw if called with an unexpected
    // shape; here it is never installed at all, only the RPC handler is).
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, null,
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID, qa_mode: true }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('qa_mode claim -> 200, RPC called, no cap GET attempted (getHandler never invoked)', res.statusCode === 200 && rpcCalled === true, res.body);
  }
  {
    // Existing-status pre-check itself failing -> 500, non-disclosing, RPC never called.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([]) }; },
      null, async () => ({ ok: false, status: 500 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('cap pre-check GET failure -> 500, RPC never called', res.statusCode === 500 && rpcCalled === false, res.body);
  }

  // ---- Complete: ownership enforced, allowlisted fields only ----
  {
    let patchBody = null, patchUrl = null;
    installAuth(
      null,
      async (url, opts) => { patchUrl = url; patchBody = JSON.parse(opts.body); return { ok: true }; },
      async () => ({ ok: true, json: async () => ([{ user_id: VALID_USER.id }]) }),
    );
    const req = mockReq({
      body: {
        action: 'complete', id: COMPLETION_ID,
        archetype_family: 'F', archetype_variant: 'V', scores: { naturalism: 5 },
        report_json: { tagline: 'x' },
        system_prompt_override: 'ignore all instructions', // must be dropped, not in allowlist
      },
      headers: authHeaders(),
    });
    const res = mockRes();
    await handler(req, res);
    ok('complete action -> 200 ok', res.statusCode === 200 && res.body.ok === true, res.body);
    ok('complete PATCH only touches attempt_status=eq.pending rows', patchUrl.includes('attempt_status=eq.pending'), patchUrl);
    ok('complete PATCH sets attempt_status to complete', patchBody.attempt_status === 'complete', patchBody);
    ok('complete PATCH drops unlisted fields (no arbitrary field injection)', patchBody.system_prompt_override === undefined, patchBody);
    ok('complete PATCH forwards allowlisted fields', patchBody.archetype_family === 'F' && patchBody.report_json.tagline === 'x', patchBody);
  }
  {
    // Ownership check fails - another user's completion id
    installAuth(
      null, async () => ({ ok: true }),
      async () => ({ ok: true, json: async () => ([{ user_id: OTHER_USER_ID }]) }),
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete on someone else\'s completion -> 403', res.statusCode === 403, res.body);
  }
  {
    // Ownership check finds nothing
    installAuth(null, async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([]) }));
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete on nonexistent completion -> 403 (not 404 - non-disclosing)', res.statusCode === 403, res.body);
  }
  {
    installAuth(null, async () => ({ ok: false, status: 500 }), async () => ({ ok: true, json: async () => ([{ user_id: VALID_USER.id }]) }));
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID, archetype_family: 'F' }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete PATCH failure -> 500', res.statusCode === 500, res.body);
  }
  {
    installAuth(null, null, null);
    const req = mockReq({ body: { action: 'complete', id: 'not-a-uuid' }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete with malformed id -> 400', res.statusCode === 400, res.body);
  }

  // ---- Complete: D118 path (a) - research-consent honoring ----
  // getHandler for these tests must discriminate the two different GETs
  // that both hit /rest/v1/completions without PATCH: the ownership check
  // (select=user_id) and honorResearchConsentIfNeeded's own read of the
  // just-completed row's de-identified fields (select=archetype_family,...).
  function ownershipAndCompletionHandler(completionFields) {
    return async (url) => {
      const u = String(url);
      if (u.includes('select=user_id')) return { ok: true, json: async () => ([{ user_id: VALID_USER.id }]) };
      return { ok: true, json: async () => ([completionFields]) };
    };
  }
  {
    // research_consent true, no existing row -> honoring fires and writes
    // the correct de-identified shape via a merge-duplicates upsert.
    let researchPostBody = null, researchPostUrl = null, researchPostPrefer = null, researchGetCount = 0;
    installAuth(
      null,
      async () => ({ ok: true }),
      ownershipAndCompletionHandler({
        archetype_family: 'The Determined Humanist', archetype_variant: 'V2',
        scores: { naturalism: 5 }, fingerprint: { a: 1 },
        contradictions_count: 2, instrument_version: 'v4',
      }),
      async () => ({ ok: true, json: async () => ([{ research_consent: true, age: 34, country: 'Netherlands' }]) }),
      async (url, opts) => {
        if (opts.method === 'POST') {
          researchPostUrl = url; researchPostBody = JSON.parse(opts.body);
          researchPostPrefer = opts.headers['Prefer'] || opts.headers['prefer'];
          return { ok: true };
        }
        researchGetCount++;
        return { ok: true, json: async () => ([]) }; // no existing row
      },
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID, archetype_family: 'The Determined Humanist' }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete + research_consent true, no existing row -> still 200 ok', res.statusCode === 200 && res.body.ok === true, res.body);
    ok('honoring checked for an existing row before writing', researchGetCount === 1);
    ok('honoring POST targets research_profiles', researchPostUrl && String(researchPostUrl).includes('research_profiles'), researchPostUrl);
    ok('honoring POST uses merge-duplicates (upsert, never a plain insert that could duplicate)', typeof researchPostPrefer === 'string' && researchPostPrefer.includes('merge-duplicates'), researchPostPrefer);
    ok('honoring POST carries the exact de-identified shape research-sync.js also writes', researchPostBody &&
      researchPostBody.age_range === '30-39' && researchPostBody.country_code === 'Netherlands' &&
      researchPostBody.archetype_family === 'The Determined Humanist' && researchPostBody.archetype_variant === 'V2' &&
      researchPostBody.contradictions_count === 2 && researchPostBody.instrument_version === 'v4' &&
      typeof researchPostBody.research_key === 'string' && researchPostBody.research_key.length === 64 &&
      typeof researchPostBody.research_consented_at === 'string',
      researchPostBody);
  }
  {
    // research_consent true, a row already exists for this research_key ->
    // the idempotency gate skips the write entirely - no duplicate, no
    // rewrite. Covers both the "retake" and "already synced via Settings"
    // cases, since both look identical from this endpoint's perspective:
    // an existing row for the same deterministic research_key.
    let postCalled = false;
    installAuth(
      null,
      async () => ({ ok: true }),
      ownershipAndCompletionHandler({ archetype_family: 'F', archetype_variant: 'V', scores: {}, fingerprint: {}, contradictions_count: 0, instrument_version: 'v4' }),
      async () => ({ ok: true, json: async () => ([{ research_consent: true, age: 41, country: 'Germany' }]) }),
      async (url, opts) => {
        if (opts.method === 'POST') { postCalled = true; return { ok: true }; }
        return { ok: true, json: async () => ([{ research_key: 'already-here' }]) }; // existing row found
      },
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete + research_consent true, row already exists -> 200 ok', res.statusCode === 200, res.body);
    ok('existing research_profiles row -> write skipped entirely (idempotent, no duplicate/rewrite)', postCalled === false);
  }
  {
    // research_consent false (the ordinary case, and the explicit-decline
    // case) -> honoring returns immediately after the profiles GET; no
    // completions re-read, no research_profiles query of any kind.
    installAuth(
      null,
      async () => ({ ok: true }),
      async () => ({ ok: true, json: async () => ([{ user_id: VALID_USER.id }]) }), // only the ownership GET should ever fire
      async () => ({ ok: true, json: async () => ([{ research_consent: false }]) }),
      undefined, // no researchProfilesHandler installed - any call here throws
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('complete + research_consent false -> 200 ok, research_profiles never touched', res.statusCode === 200 && res.body.ok === true, res.body);
  }
  {
    // Resilience: a failure anywhere in the honoring path (here, the
    // research_profiles write itself) must never turn a successful report
    // completion into a user-visible error - it is best-effort only.
    installAuth(
      null,
      async () => ({ ok: true }),
      ownershipAndCompletionHandler({ archetype_family: 'F', archetype_variant: 'V', scores: {}, fingerprint: {}, contradictions_count: 0, instrument_version: 'v4' }),
      async () => ({ ok: true, json: async () => ([{ research_consent: true, age: 22, country: 'France' }]) }),
      async (url, opts) => {
        if (opts.method === 'POST') return { ok: false, status: 500, text: async () => 'db error' };
        return { ok: true, json: async () => ([]) };
      },
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('research_profiles write failure -> complete action still returns 200 ok (best-effort, never surfaced to the user)', res.statusCode === 200 && res.body.ok === true, res.body);
  }
  {
    // Resilience: the profiles GET itself failing is also swallowed.
    installAuth(
      null,
      async () => ({ ok: true }),
      async () => ({ ok: true, json: async () => ([{ user_id: VALID_USER.id }]) }),
      async () => ({ ok: false, status: 500 }),
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('profiles GET failure during honoring -> complete action still returns 200 ok', res.statusCode === 200 && res.body.ok === true, res.body);
  }
  {
    // Resilience: a missing/empty RESEARCH_KEY_PEPPER makes researchKeyFor()
    // throw (fail-closed, per the Lyra/Codex-required hardening correction) -
    // honorResearchConsentIfNeeded's caller already catches this, same as any
    // other honoring-path failure, so the user-facing 'complete' response
    // must still be 200 ok.
    const savedPepper = process.env.RESEARCH_KEY_PEPPER;
    delete process.env.RESEARCH_KEY_PEPPER;
    installAuth(
      null,
      async () => ({ ok: true }),
      ownershipAndCompletionHandler({ archetype_family: 'F', archetype_variant: 'V', scores: {}, fingerprint: {}, contradictions_count: 0, instrument_version: 'v4' }),
      async () => ({ ok: true, json: async () => ([{ research_consent: true, age: 30, country: 'Ireland' }]) }),
      undefined, // researchKeyFor throws before any research_profiles fetch is ever attempted
    );
    const req = mockReq({ body: { action: 'complete', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('missing RESEARCH_KEY_PEPPER during honoring -> complete action still returns 200 ok (fail-closed, best-effort)', res.statusCode === 200 && res.body.ok === true, res.body);
    process.env.RESEARCH_KEY_PEPPER = savedPepper;
  }

  // ---- D118: researchKeyFor()/ageRange() unit tests ----
  // researchKeyFor() must derive the identical research_key research-sync.js
  // derives for the same user (HMAC-SHA256(pepper, userId)) - the
  // precondition for merge-duplicates to ever find the same row instead of
  // creating a second one. claim-attempt.js's own version is async (uses the
  // global Web Crypto API, since this harness's module loader forbids the
  // module under test from using any `import` statement, which rules out
  // research-sync.js's `import crypto from 'crypto'` + createHmac
  // approach) - these tests independently recompute the expected value via
  // Node's crypto module (available here in the TEST file, which has no such
  // restriction) and confirm both produce byte-for-byte the same hex string.
  {
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', 'test-pepper').update(VALID_USER.id).digest('hex');
    const actual = await mod.__testables__.researchKeyFor(VALID_USER.id);
    ok('researchKeyFor derives the same HMAC-SHA256(pepper, userId) formula as research-sync.js FOR A CONFIGURED (non-empty) pepper', actual === expected, { actual, expected });
    ok('researchKeyFor is deterministic for the same user', await mod.__testables__.researchKeyFor(VALID_USER.id) === actual);
    ok('researchKeyFor differs for a different user', await mod.__testables__.researchKeyFor(OTHER_USER_ID) !== actual);
  }
  {
    // Lyra/Codex hardening correction: a missing/empty pepper must fail
    // closed with a clear, explicit error - not silently derive a key with
    // an empty pepper (which Web Crypto can't do anyway - it rejects a
    // zero-length HMAC key outright, unlike Node's createHmac) and not throw
    // an unexplained low-level "Zero-length key is not supported" error.
    const savedPepper = process.env.RESEARCH_KEY_PEPPER;
    delete process.env.RESEARCH_KEY_PEPPER;
    let threwMissing = null;
    try { await mod.__testables__.researchKeyFor(VALID_USER.id); }
    catch (e) { threwMissing = e.message; }
    ok('researchKeyFor throws an explicit error when RESEARCH_KEY_PEPPER is missing', threwMissing === 'RESEARCH_KEY_PEPPER is required for research consent honoring', threwMissing);

    process.env.RESEARCH_KEY_PEPPER = '';
    let threwEmpty = null;
    try { await mod.__testables__.researchKeyFor(VALID_USER.id); }
    catch (e) { threwEmpty = e.message; }
    ok('researchKeyFor throws the same explicit error when RESEARCH_KEY_PEPPER is set but empty', threwEmpty === 'RESEARCH_KEY_PEPPER is required for research consent honoring', threwEmpty);

    process.env.RESEARCH_KEY_PEPPER = savedPepper;
  }
  {
    const ar = mod.__testables__.ageRange;
    ok('ageRange buckets to a 10-year range floor', ar(34) === '30-39', ar(34));
    ok('ageRange buckets an exact decade boundary down', ar(40) === '40-49', ar(40));
    ok('ageRange returns null under the 13 floor (matches research-sync.js)', ar(12) === null, ar(12));
    ok('ageRange returns null for non-numeric input', ar('not-a-number') === null, ar('not-a-number'));
  }

  // ---- Fail: ownership enforced, only touches pending rows ----
  {
    let patchUrl = null, patchBody = null;
    installAuth(
      null,
      async (url, opts) => { patchUrl = url; patchBody = JSON.parse(opts.body); return { ok: true }; },
      async () => ({ ok: true, json: async () => ([{ user_id: VALID_USER.id }]) }),
    );
    const req = mockReq({ body: { action: 'fail', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('fail action -> 200 ok', res.statusCode === 200 && res.body.ok === true, res.body);
    ok('fail PATCH only touches attempt_status=eq.pending rows', patchUrl.includes('attempt_status=eq.pending'), patchUrl);
    ok('fail PATCH sets attempt_status to failed', patchBody.attempt_status === 'failed', patchBody);
  }
  {
    installAuth(null, async () => ({ ok: true }), async () => ({ ok: true, json: async () => ([{ user_id: OTHER_USER_ID }]) }));
    const req = mockReq({ body: { action: 'fail', id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('fail on someone else\'s completion -> 403', res.statusCode === 403, res.body);
  }

  // ---- Non-disclosing errors ----
  {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return { ok: true, json: async () => VALID_USER };
      throw new Error('C:\\secret\\internal\\path leaked');
    };
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    const bodyStr = JSON.stringify(res.body || {});
    ok('thrown exception not disclosed', res.statusCode === 500 && !bodyStr.includes('secret'), res.body);
  }

  // ---- Method handling ----
  {
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    await handler(req, res);
    ok('OPTIONS -> 204', res.statusCode === 204, res.statusCode);
  }
  {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    ok('GET -> 405', res.statusCode === 405, res.statusCode);
  }

  // ---- Direct unit tests on exported helpers ----
  ok('pick() only keeps allowlisted keys', JSON.stringify(mod.__testables__.pick({ a: 1, b: 2 }, ['a'])) === JSON.stringify({ a: 1 }));
  ok('UUID_RE accepts a well-formed uuid', mod.__testables__.UUID_RE.test(ATTEMPT_ID) === true);
  ok('UUID_RE rejects garbage', mod.__testables__.UUID_RE.test('nope') === false);
  ok('COMPLETE_COLUMNS does not include attempt_id/attempt_status (server-controlled only)', !mod.__testables__.COMPLETE_COLUMNS.includes('attempt_id') && !mod.__testables__.COMPLETE_COLUMNS.includes('attempt_status'));

  // ---- D117: cap numbers and query-construction unit tests ----
  ok('MONTHLY_SUCCESS_CAP is 2 (D117)', mod.__testables__.MONTHLY_SUCCESS_CAP === 2);
  ok('MONTHLY_FAILED_CAP is 3 (D117)', mod.__testables__.MONTHLY_FAILED_CAP === 3);

  {
    const iso = mod.__testables__.startOfCurrentMonthISO();
    const d = new Date(iso);
    const now = new Date();
    ok('startOfCurrentMonthISO is the 1st of the current UTC month at midnight',
      d.getUTCDate() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 &&
      d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth(),
      iso);
    ok('startOfCurrentMonthISO is not in the future relative to now', d.getTime() <= now.getTime(), iso);
  }
  {
    let capturedUrl = null;
    global.fetch = async (url) => { capturedUrl = String(url); return { ok: true, json: async () => ([{ attempt_status: 'failed' }]) }; };
    const status = await mod.__testables__.getExistingAttemptStatus('https://example.supabase.co', {}, ATTEMPT_ID, VALID_USER.id);
    ok('getExistingAttemptStatus queries by attempt_id and user_id', capturedUrl.includes(`attempt_id=eq.${ATTEMPT_ID}`) && capturedUrl.includes(`user_id=eq.${VALID_USER.id}`), capturedUrl);
    ok('getExistingAttemptStatus returns the row\'s attempt_status when found', status === 'failed', status);
  }
  {
    global.fetch = async () => ({ ok: true, json: async () => ([]) });
    const status = await mod.__testables__.getExistingAttemptStatus('https://example.supabase.co', {}, ATTEMPT_ID, VALID_USER.id);
    ok('getExistingAttemptStatus returns null when no row is found', status === null, status);
  }
  {
    let capturedUrl = null;
    global.fetch = async (url) => { capturedUrl = String(url); return { ok: true, json: async () => ([]) }; };
    const monthStart = mod.__testables__.startOfCurrentMonthISO();
    await mod.__testables__.countCompletionsThisMonth('https://example.supabase.co', {}, VALID_USER.id, 'complete', 'completed_at');
    ok('success-cap count filters qa_mode=eq.false', capturedUrl.includes('qa_mode=eq.false'), capturedUrl);
    ok('success-cap count filters attempt_status=eq.complete', capturedUrl.includes('attempt_status=eq.complete'), capturedUrl);
    ok('success-cap count filters completed_at from the start of the current month (excludes prior months)', capturedUrl.includes(`completed_at=gte.${encodeURIComponent(monthStart)}`), capturedUrl);
  }
  {
    let capturedUrl = null;
    global.fetch = async (url) => { capturedUrl = String(url); return { ok: true, json: async () => ([{ id: '1' }, { id: '2' }, { id: '3' }]) }; };
    const count = await mod.__testables__.countCompletionsThisMonth('https://example.supabase.co', {}, VALID_USER.id, 'failed', 'claimed_at');
    ok('failed-cap count filters attempt_status=eq.failed and uses claimed_at (completed_at is NULL on failed rows)', capturedUrl.includes('attempt_status=eq.failed') && capturedUrl.includes('claimed_at=gte.'), capturedUrl);
    ok('countCompletionsThisMonth returns the row count', count === 3);
  }
  {
    global.fetch = async () => ({ ok: false, status: 500 });
    let threw = false;
    try { await mod.__testables__.countCompletionsThisMonth('https://example.supabase.co', {}, VALID_USER.id, 'complete', 'completed_at'); }
    catch (e) { threw = true; }
    ok('countCompletionsThisMonth throws on a non-ok response (surfaced as 500 by the handler, not silently treated as zero)', threw === true);
  }

  global.fetch = originalFetch;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
