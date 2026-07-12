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
  {
    let sentParams = null;
    installAuth(
      async (url, opts) => { sentParams = JSON.parse(opts.body); return { ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'pending', out_report_json: null, out_should_generate: true }]) }; },
      null, null,
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID, qa_mode: false }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('fresh claim -> 200 with should_generate true', res.statusCode === 200 && res.body.should_generate === true, res.body);
    ok('claim uses server-verified user id, not any client-supplied one', sentParams.p_user_id === VALID_USER.id, sentParams);
    ok('claim forwards attempt_id and qa_mode', sentParams.p_attempt_id === ATTEMPT_ID && sentParams.p_qa_mode === false, sentParams);
  }
  {
    installAuth(
      async () => ({ ok: true, json: async () => ([{ out_id: COMPLETION_ID, out_status: 'complete', out_report_json: { tagline: 'hi' }, out_should_generate: false }]) }),
      null, null,
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
      null, null,
    );
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('someone else already generating -> should_generate false, status pending', res.statusCode === 200 && res.body.status === 'pending' && res.body.should_generate === false, res.body);
  }
  {
    installAuth(async () => ({ ok: false, status: 500 }), null, null);
    const req = mockReq({ body: { action: 'claim', attempt_id: ATTEMPT_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('RPC failure -> 500, non-disclosing', res.statusCode === 500 && !JSON.stringify(res.body).includes('SUPABASE_SERVICE_KEY'), res.body);
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

  global.fetch = originalFetch;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
