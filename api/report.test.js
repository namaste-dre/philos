// A0.2 containment tests for api/report.js (and the token-minting half in
// api/capture.js).
//
// Same no-dependency approach as api/generate.test.js: loads the real
// source files as ES modules via node:vm's SourceTextModule (this repo has
// no package.json declaring "type": "module", so plain `import` of a .js
// file would be parsed as CommonJS and fail). No live Supabase calls are
// made anywhere in this file - fetch is mocked throughout.
//
// Run with:
//   node --experimental-vm-modules api/report.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Both files' only real import is Node's built-in 'crypto' (for HMAC token
// generation) - resolve that via a synthetic module, reject anything else
// so a stray dependency on application code cannot sneak in unnoticed.
async function linker(specifier, referencingModule) {
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
    send(text) { this.body = text; return this; },
    end() { return this; },
  };
  return res;
}

function mockReq({ method = 'GET', query = {}, headers = {} } = {}) {
  return { method, query, headers, socket: { remoteAddress: '203.0.113.9' } };
}

const VALID_ID   = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const OTHER_ID    = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';

async function run() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'test-secret-key';

  const reportMod = await loadModule('report.js');
  const captureMod = await loadModule('capture.js');
  const handler = reportMod.default;
  const rt = reportMod.__testables__;
  const ct = captureMod.__testables__;

  const originalFetch = global.fetch;

  // ---- Token consistency between capture.js (mint) and report.js (verify) ----
  ok('capture.js and report.js compute the identical token for the same id',
    ct.computeReportToken(VALID_ID) === rt.computeReportToken(VALID_ID));
  ok('different ids produce different tokens',
    rt.computeReportToken(VALID_ID) !== rt.computeReportToken(OTHER_ID));
  ok('token does not depend on process order / is deterministic',
    rt.computeReportToken(VALID_ID) === rt.computeReportToken(VALID_ID));

  const TOKEN = rt.computeReportToken(VALID_ID);
  const WRONG_TOKEN = rt.computeReportToken(OTHER_ID);

  function mockRow(overrides = {}) {
    return {
      report_json: { tagline: 'test', identity: 'test identity' },
      scores: { naturalism: 5 },
      fingerprint: [{ axis: 'naturalism', score: 5 }],
      first_name: 'Andre',
      archetype_family: 'The Determined Humanist',
      archetype_variant: 'The Activist',
      ...overrides,
    };
  }

  function installFetch({ rowsForId = {}, rateLimitOk = true } = {}) {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/rest/v1/rate_limits')) {
        if (!rateLimitOk) return { ok: false, status: 500 };
        if (!opts || opts.method === undefined) return { ok: true, json: async () => ([]) };
        return { ok: true, json: async () => ([]) };
      }
      if (u.includes('/rest/v1/completions')) {
        const match = u.match(/id=eq\.([^&]+)/);
        const id = match ? decodeURIComponent(match[1]) : null;
        const row = rowsForId[id];
        return { ok: true, json: async () => (row ? [row] : []) };
      }
      throw new Error('unexpected fetch: ' + u);
    };
  }

  // ---- 1. Unauthenticated fetch (no token) 404s ----
  {
    installFetch({ rowsForId: { [VALID_ID]: mockRow() } });
    const req = mockReq({ query: { id: VALID_ID } }); // no t
    const res = mockRes();
    await handler(req, res);
    ok('missing token -> 404 (uniform, non-disclosing)', res.statusCode === 404, res.body);
  }

  // ---- 2. Another user's id (right shape, wrong token) 404s identically ----
  {
    installFetch({ rowsForId: { [VALID_ID]: mockRow() } });
    const req = mockReq({ query: { id: VALID_ID, t: WRONG_TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('wrong token for a real id -> 404, identical to missing-token case', res.statusCode === 404, res.body);
  }
  {
    // Someone else's own valid (id, token) pair used against a different id
    installFetch({ rowsForId: { [VALID_ID]: mockRow(), [OTHER_ID]: mockRow({ first_name: 'SomeoneElse' }) } });
    const req = mockReq({ query: { id: OTHER_ID, t: TOKEN } }); // TOKEN belongs to VALID_ID, not OTHER_ID
    const res = mockRes();
    await handler(req, res);
    ok('valid token for a DIFFERENT id -> 404 (cannot mix and match)', res.statusCode === 404, res.body);
  }

  // ---- 3. Malformed id handled safely ----
  const malformedIds = ['not-a-uuid', '../../etc/passwd', "' OR '1'='1", '', '12345', 'a'.repeat(500)];
  for (const bad of malformedIds) {
    installFetch({ rowsForId: {} });
    let dbHit = false;
    const baseFetch = global.fetch;
    global.fetch = async (url, opts) => {
      if (String(url).includes('/rest/v1/completions')) dbHit = true;
      return baseFetch(url, opts);
    };
    const req = mockReq({ query: { id: bad, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok(`malformed id (${JSON.stringify(bad).slice(0, 30)}) -> 404, no DB query`, res.statusCode === 404 && !dbHit, { status: res.statusCode, dbHit });
  }
  {
    // missing id entirely
    installFetch({ rowsForId: {} });
    const req = mockReq({ query: { t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('missing id -> 404', res.statusCode === 404, res.body);
  }

  // ---- 4. Nonexistent (but well-formed) id, correct-shaped token -> still 404 identically ----
  {
    installFetch({ rowsForId: {} }); // row genuinely does not exist
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('nonexistent id (right token computed, no row) -> 404', res.statusCode === 404, res.body);
  }

  // ---- 5. CORS headers evidence: no Access-Control-Allow-Origin at all ----
  {
    installFetch({ rowsForId: { [VALID_ID]: mockRow() } });
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('no Access-Control-Allow-Origin header on any response', !('Access-Control-Allow-Origin' in res.headers), res.headers);
  }

  // ---- 6. X-Robots-Tag header present alongside the existing meta tag ----
  {
    installFetch({ rowsForId: { [VALID_ID]: mockRow() } });
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('X-Robots-Tag: noindex, nofollow header present', res.headers['X-Robots-Tag'] === 'noindex, nofollow', res.headers);
    ok('noindex,nofollow meta tag still present in body', typeof res.body === 'string' && res.body.includes('name="robots" content="noindex, nofollow"'));
  }

  // ---- 7. Owner path still works end-to-end with the correct (id, token) ----
  {
    installFetch({ rowsForId: { [VALID_ID]: mockRow({ archetype_family: 'The Determined Humanist' }) } });
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('correct (id, token) pair renders the report (200)', res.statusCode === 200, res.statusCode);
    ok('rendered body contains the report content', typeof res.body === 'string' && res.body.includes('The Determined Humanist'));
  }

  // ---- 8. Response minimized: completed_at no longer selected/fetched ----
  {
    let selectedFields = null;
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('/rest/v1/rate_limits')) return { ok: true, json: async () => ([]) };
      if (u.includes('/rest/v1/completions')) {
        const m = u.match(/select=([^&]+)/);
        selectedFields = m ? decodeURIComponent(m[1]) : '';
        return { ok: true, json: async () => ([mockRow()]) };
      }
      throw new Error('unexpected fetch: ' + u);
    };
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('completed_at dropped from the select list (unused field)', selectedFields !== null && !selectedFields.includes('completed_at'), selectedFields);
  }

  // ---- 9. Rate limit fails closed ----
  {
    installFetch({ rowsForId: { [VALID_ID]: mockRow() }, rateLimitOk: false });
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('rate limit failure -> 404 (fails closed, non-disclosing)', res.statusCode === 404, res.body);
  }
  {
    delete process.env.SUPABASE_SERVICE_KEY;
    global.fetch = async () => { throw new Error('should not be called when unconfigured'); };
    const req = mockReq({ query: { id: VALID_ID, t: TOKEN } });
    const res = mockRes();
    await handler(req, res);
    ok('rate limiter unconfigured -> 500 service-unavailable path (no data leak)', res.statusCode === 500 || res.statusCode === 404, res.statusCode);
    process.env.SUPABASE_SERVICE_KEY = 'test-secret-key';
  }

  // ---- 10. OPTIONS method ----
  {
    installFetch({ rowsForId: {} });
    const req = mockReq({ method: 'OPTIONS', query: {} });
    const res = mockRes();
    await handler(req, res);
    ok('OPTIONS -> 204', res.statusCode === 204, res.statusCode);
  }

  // ---- Direct unit tests on token helpers ----
  ok('tokenMatches: correct token matches', rt.tokenMatches(TOKEN, TOKEN) === true);
  ok('tokenMatches: wrong token rejected', rt.tokenMatches(WRONG_TOKEN, TOKEN) === false);
  ok('tokenMatches: non-string rejected', rt.tokenMatches(12345, TOKEN) === false);
  ok('tokenMatches: undefined rejected', rt.tokenMatches(undefined, TOKEN) === false);
  ok('tokenMatches: different-length string rejected without throwing', rt.tokenMatches('short', TOKEN) === false);
  ok('UUID_RE accepts a well-formed uuid', rt.UUID_RE.test(VALID_ID) === true);
  ok('UUID_RE rejects garbage', rt.UUID_RE.test('not-a-uuid') === false);

  global.fetch = originalFetch;

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}

run();
