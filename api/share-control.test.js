// A7 (D-1/D136) containment tests for api/share-control.js.
//
// Same no-dependency approach as api/report.test.js and
// api/claim-attempt.test.js: loads the real source as an ES module via
// node:vm's SourceTextModule. No live Supabase calls anywhere in this file -
// fetch is mocked throughout.
//
// Run with:
//   node --experimental-vm-modules api/share-control.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function linker(specifier) {
  if (specifier !== 'crypto') throw new Error('unexpected import: ' + specifier);
  const nodeCrypto = require('crypto');
  const m = new vm.SyntheticModule(['default'], function () {
    this.setExport('default', nodeCrypto);
  }, { identifier: 'node:crypto' });
  await m.link(() => { throw new Error('crypto synthetic module has no imports'); });
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
  return { method, body, headers, socket: { remoteAddress: '203.0.113.11' } };
}

const VALID_TOKEN = 'valid-test-token';
const VALID_USER = { id: 'user-abc', email: 'legit@example.com' };
const OTHER_USER_ID = 'user-xyz';
const COMPLETION_ID = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

function authHeaders(token = VALID_TOKEN) {
  return { authorization: `Bearer ${token}` };
}

async function run() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-secret';
  process.env.SUPABASE_ANON_KEY = 'test-anon';

  const mod = await loadModule('share-control.js');
  const handler = mod.default;
  const t = mod.__testables__;

  const originalFetch = global.fetch;

  function installFetch({ owner = VALID_USER.id, patchOk = true, captureBody = null } = {}) {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) {
        const authz = (opts.headers['Authorization'] || opts.headers['authorization'] || '');
        const tok = authz.replace('Bearer ', '');
        if (tok === VALID_TOKEN) return { ok: true, json: async () => VALID_USER };
        return { ok: false };
      }
      if (u.includes('/rest/v1/completions') && opts.method === 'PATCH') {
        if (captureBody) captureBody.value = JSON.parse(opts.body);
        return { ok: patchOk, text: async () => 'patch failed' };
      }
      if (u.includes('/rest/v1/completions')) {
        return { ok: true, json: async () => (owner ? [{ user_id: owner }] : []) };
      }
      throw new Error('unexpected fetch: ' + u);
    };
  }

  // ---- Method / config / auth gates ----
  {
    installFetch();
    const req = mockReq({ method: 'OPTIONS' });
    const res = mockRes();
    await handler(req, res);
    ok('OPTIONS -> 204', res.statusCode === 204, res.statusCode);
  }
  {
    installFetch();
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    ok('non-POST -> 405', res.statusCode === 405, res.statusCode);
  }
  {
    installFetch();
    const req = mockReq({ body: { action: 'revoke', completion_id: COMPLETION_ID } }); // no auth header
    const res = mockRes();
    await handler(req, res);
    ok('missing auth header -> 401', res.statusCode === 401, res.statusCode);
  }
  {
    installFetch();
    const req = mockReq({ body: { action: 'revoke', completion_id: COMPLETION_ID }, headers: authHeaders('wrong-token') });
    const res = mockRes();
    await handler(req, res);
    ok('invalid/expired session -> 401', res.statusCode === 401, res.statusCode);
  }

  // ---- Input validation ----
  {
    installFetch();
    const req = mockReq({ body: { action: 'revoke', completion_id: 'not-a-uuid' }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('malformed completion_id -> 400', res.statusCode === 400, res.statusCode);
  }
  {
    installFetch();
    const req = mockReq({ body: { action: 'delete-everything', completion_id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('unrecognized action -> 400', res.statusCode === 400, res.statusCode);
  }

  // ---- Ownership (IDOR) ----
  {
    installFetch({ owner: OTHER_USER_ID }); // row belongs to someone else
    const req = mockReq({ body: { action: 'revoke', completion_id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('revoke on a completion owned by someone else -> 403', res.statusCode === 403, res.statusCode);
  }
  {
    installFetch({ owner: null }); // no such row
    const req = mockReq({ body: { action: 'regenerate', completion_id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('regenerate on a nonexistent completion -> 403 (non-disclosing, same as wrong-owner)', res.statusCode === 403, res.statusCode);
  }

  // ---- Revoke happy path ----
  {
    const captured = {};
    installFetch({ captureBody: captured });
    const req = mockReq({ body: { action: 'revoke', completion_id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('revoke by the real owner -> 200', res.statusCode === 200, res.statusCode);
    ok('revoke response reports share_enabled: false', res.body && res.body.share_enabled === false, res.body);
    ok('revoke PATCH sets share_enabled: false', captured.value && captured.value.share_enabled === false, captured.value);
    ok('revoke PATCH stamps share_revoked_at', captured.value && typeof captured.value.share_revoked_at === 'string' && captured.value.share_revoked_at.length > 0, captured.value);
  }

  // ---- Regenerate happy path ----
  {
    const captured = {};
    installFetch({ captureBody: captured });
    const req = mockReq({ body: { action: 'regenerate', completion_id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('regenerate by the real owner -> 200', res.statusCode === 200, res.statusCode);
    ok('regenerate response reports share_enabled: true', res.body && res.body.share_enabled === true, res.body);
    ok('regenerate PATCH re-enables sharing', captured.value && captured.value.share_enabled === true, captured.value);
    ok('regenerate PATCH clears share_revoked_at', captured.value && captured.value.share_revoked_at === null, captured.value);
    ok('regenerate PATCH writes a non-empty share_token_salt', captured.value && typeof captured.value.share_token_salt === 'string' && captured.value.share_token_salt.length >= 32, captured.value);
    const expectedToken = t.computeReportToken(COMPLETION_ID, captured.value.share_token_salt);
    ok('regenerate response report_token matches the salt actually written', res.body.report_token === expectedToken, { returned: res.body.report_token, expected: expectedToken });
    ok('regenerate response share_url embeds the same token', typeof res.body.share_url === 'string' && res.body.share_url.includes(res.body.report_token), res.body.share_url);
  }

  // ---- PATCH failure surfaces as 500, not a false success ----
  {
    installFetch({ patchOk: false });
    const req = mockReq({ body: { action: 'revoke', completion_id: COMPLETION_ID }, headers: authHeaders() });
    const res = mockRes();
    await handler(req, res);
    ok('PATCH failure -> 500 (never reports ok:true on a failed write)', res.statusCode === 500, res.statusCode);
  }

  // ---- Direct unit tests on helpers ----
  ok('newSalt() produces a sufficiently long random value', t.newSalt().length >= 32);
  ok('newSalt() is not deterministic across calls', t.newSalt() !== t.newSalt());
  ok('computeReportToken matches report.js/capture.js formula for a salted id', t.computeReportToken('id-x', 'salt-x').length === 32);
  ok('UUID_RE accepts a well-formed uuid', t.UUID_RE.test(COMPLETION_ID) === true);
  ok('UUID_RE rejects garbage', t.UUID_RE.test('not-a-uuid') === false);

  global.fetch = originalFetch;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
