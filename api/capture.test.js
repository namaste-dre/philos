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

  global.fetch = originalFetch;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
