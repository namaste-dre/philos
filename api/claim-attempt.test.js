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

  const mod = await loadModule('claim-attempt.js');
  const handler = mod.default;

  const originalFetch = global.fetch;

  function installAuth(rpcHandler, patchHandler, getHandler) {
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
  // the attempt_id=eq. existing-row check, and the two attempt_status=eq.
  // count checks (complete/failed). existingRow controls whether this
  // attempt_id is treated as already-claimed (skips the cap counts
  // entirely, exactly like a real retry/replay); successCount/failedCount
  // control what the two count queries report when it is not.
  function capGetHandler({ existingRow = false, successCount = 0, failedCount = 0 } = {}) {
    return async (url) => {
      const u = String(url);
      if (u.includes('attempt_id=eq.')) {
        return { ok: true, json: async () => (existingRow ? [{ id: 'existing-row' }] : []) };
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
      null, capGetHandler({ existingRow: false, successCount: 0, failedCount: 0 }),
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
      null, capGetHandler({ existingRow: true }),
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
      null, capGetHandler({ existingRow: true }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('someone else already generating -> should_generate false, status pending', res.statusCode === 200 && res.body.status === 'pending' && res.body.should_generate === false, res.body);
  }
  {
    installAuth(async () => ({ ok: false, status: 500 }), null, capGetHandler({ existingRow: false, successCount: 0, failedCount: 0 }));
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
      null, capGetHandler({ existingRow: false, successCount: 2, failedCount: 0 }),
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
      null, capGetHandler({ existingRow: false, successCount: 0, failedCount: 3 }),
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
      null, capGetHandler({ existingRow: false, successCount: 1, failedCount: 2 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('one below both caps -> 200, RPC called', res.statusCode === 200 && rpcCalled === true, res.body);
  }
  {
    // Retrying an already-claimed attempt is never capped, even if the user
    // is already over both caps - it is not a new generation slot.
    let rpcCalled = false;
    installAuth(
      async () => { rpcCalled = true; return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, capGetHandler({ existingRow: true, successCount: 99, failedCount: 99 }),
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('retry of already-claimed attempt bypasses cap entirely -> 200, RPC called', res.statusCode === 200 && rpcCalled === true, res.body);
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
    // Existing-row pre-check itself failing -> 500, non-disclosing, RPC never called.
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
    global.fetch = async (url) => { capturedUrl = String(url); return { ok: true, json: async () => ([{ id: 'x' }]) }; };
    const found = await mod.__testables__.hasExistingAttemptRow('https://example.supabase.co', {}, ATTEMPT_ID, VALID_USER.id);
    ok('hasExistingAttemptRow queries by attempt_id and user_id', capturedUrl.includes(`attempt_id=eq.${ATTEMPT_ID}`) && capturedUrl.includes(`user_id=eq.${VALID_USER.id}`), capturedUrl);
    ok('hasExistingAttemptRow returns true when a row is found', found === true);
  }
  {
    global.fetch = async () => ({ ok: true, json: async () => ([]) });
    const found = await mod.__testables__.hasExistingAttemptRow('https://example.supabase.co', {}, ATTEMPT_ID, VALID_USER.id);
    ok('hasExistingAttemptRow returns false when no row is found', found === false);
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
