// Containment tests for the hardened api/email.js (2026-07-31).
//
// The endpoint was an unauthenticated, CORS-wildcard, unescaped-template
// sender - a latent open relay kept harmless only by the missing
// RESEND_API_KEY (D130). These tests pin the containment: session
// required, recipient always the verified account email (client input
// ignored), every interpolated field escaped, shareUrl same-origin only,
// honest status codes, no provider-detail disclosure.
//
// Same no-dependency approach as the other api/*.test.js files. No live
// network calls - fetch is mocked throughout.
//
// Run with:
//   node --experimental-vm-modules api/email.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function loadModule(filename) {
  const filePath = path.join(__dirname, filename);
  const source = fs.readFileSync(filePath, 'utf8');
  const mod = new vm.SourceTextModule(source, { identifier: filePath });
  await mod.link(() => { throw new Error('api/email.js should have no imports'); });
  await mod.evaluate();
  return mod.namespace;
}

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

function mockRes() {
  return {
    statusCode: null, headers: {}, body: null, ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { this.ended = true; return this; },
  };
}

function mockReq({ method = 'POST', origin = 'https://phil-os.thelifepm.com', auth = 'Bearer good-token', body = {} } = {}) {
  const headers = {};
  if (origin) headers['origin'] = origin;
  if (auth) headers['authorization'] = auth;
  return { method, headers, body };
}

const VERIFIED_EMAIL = 'owner@example.com';

// Routing fetch mock: Supabase auth check + Resend capture.
function installFetch({ authOk = true, resendOk = true } = {}) {
  const calls = { resend: [] };
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/auth/v1/user')) {
      if (!authOk) return { ok: false };
      return { ok: true, json: async () => ({ id: 'user-1', email: VERIFIED_EMAIL }) };
    }
    if (String(url).includes('api.resend.com')) {
      calls.resend.push(JSON.parse(opts.body));
      if (!resendOk) return { ok: false, text: async () => 'provider secret detail' };
      return { ok: true, json: async () => ({ id: 'email-1' }) };
    }
    throw new Error('unexpected fetch: ' + url);
  };
  return calls;
}

function validBody(overrides = {}) {
  return {
    name: 'Andre',
    archetype: 'The Determined Humanist',
    variant: 'Systems Builder',
    tagline: 'A worldview built, not borrowed.',
    identity: 'First paragraph.\nSecond paragraph.',
    fingerprint: [{ label: 'Naturalism', pole: 'Naturalist', score: 2.4 }],
    growth: [{ title: 'Edge', text: 'Text.', practice: 'Practice.' }],
    contradictions_count: 2,
    shareUrl: 'https://phil-os.thelifepm.com/api/report?id=x&t=y',
    ...overrides,
  };
}

(async () => {
  process.env.SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'stub-anon';
  process.env.RESEND_API_KEY = 'stub-resend';

  const { default: handler } = await loadModule('email.js');

  // ---- Method and CORS surface ----
  {
    const res = mockRes();
    await handler(mockReq({ method: 'OPTIONS' }), res);
    ok('OPTIONS returns 204', res.statusCode === 204 && res.ended);
  }
  {
    const res = mockRes();
    await handler(mockReq({ method: 'GET' }), res);
    ok('GET returns 405', res.statusCode === 405);
  }
  {
    const res = mockRes();
    await handler(mockReq({ origin: 'https://evil.example' }), res);
    ok('foreign origin gets no Access-Control-Allow-Origin header',
      !('Access-Control-Allow-Origin' in res.headers));
  }
  {
    installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody() }), res);
    ok('canonical origin gets the exact-origin CORS header (never *)',
      res.headers['Access-Control-Allow-Origin'] === 'https://phil-os.thelifepm.com');
  }

  // ---- Authentication ----
  {
    const res = mockRes();
    await handler(mockReq({ auth: null, body: validBody() }), res);
    ok('missing token returns 401', res.statusCode === 401);
  }
  {
    installFetch({ authOk: false });
    const res = mockRes();
    await handler(mockReq({ body: validBody() }), res);
    ok('invalid session returns 401', res.statusCode === 401);
  }

  // ---- Relay containment: recipient is ALWAYS the verified account ----
  {
    const calls = installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody({ email: 'attacker@evil.example' }) }), res);
    ok('send succeeds for a valid session', res.statusCode === 200 && res.body.ok === true);
    ok('recipient is the verified account email, client-supplied address ignored',
      calls.resend.length === 1 && calls.resend[0].to === VERIFIED_EMAIL, calls.resend[0] && calls.resend[0].to);
  }

  // ---- Escaping: hostile payloads must render inert ----
  {
    const hostile = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const calls = installFetch();
    const res = mockRes();
    await handler(mockReq({
      body: validBody({
        name: hostile, archetype: hostile, variant: hostile, tagline: hostile,
        identity: hostile,
        fingerprint: [{ label: hostile, pole: hostile, score: 3 }],
        growth: [{ title: hostile, text: hostile, practice: hostile }, 'legacy ' + hostile],
      }),
    }), res);
    const html = calls.resend[0] && calls.resend[0].html || '';
    ok('hostile payload send still succeeds', res.statusCode === 200);
    ok('no raw <script> tag reaches the generated email HTML', !html.includes('<script>'));
    ok('no raw <img onerror> reaches the generated email HTML', !html.includes('<img src=x'));
    ok('hostile payloads are entity-encoded (present, inert)', html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    ok('legacy plain-string growth entries still accepted and escaped',
      html.includes('legacy &lt;script&gt;'));
  }

  // ---- shareUrl containment ----
  {
    installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody({ shareUrl: 'https://evil.example/phish' }) }), res);
    ok('foreign-origin shareUrl rejected with 400', res.statusCode === 400);
  }
  {
    const calls = installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody({ shareUrl: null }) }), res);
    const html = calls.resend[0] && calls.resend[0].html || '';
    ok('null shareUrl accepted; CTA falls back to the canonical origin',
      res.statusCode === 200 && html.includes('href="https://phil-os.thelifepm.com"'));
  }

  // ---- Input caps ----
  {
    installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody({ identity: 'x'.repeat(20001) }) }), res);
    ok('oversized field rejected with 400', res.statusCode === 400);
  }
  {
    installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody({ name: 12345 }) }), res);
    ok('non-string field rejected with 400', res.statusCode === 400);
  }

  // ---- Honest status codes ----
  {
    delete process.env.RESEND_API_KEY;
    installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody() }), res);
    ok('missing RESEND_API_KEY returns 503, not 200', res.statusCode === 503);
    process.env.RESEND_API_KEY = 'stub-resend';
  }
  {
    installFetch({ resendOk: false });
    const res = mockRes();
    await handler(mockReq({ body: validBody() }), res);
    ok('provider failure returns 502, not 200', res.statusCode === 502);
    ok('provider failure detail is not disclosed to the client',
      JSON.stringify(res.body).includes('provider secret detail') === false);
  }

  // ---- Copy corrections ----
  {
    const calls = installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody() }), res);
    const html = calls.resend[0].html;
    ok('footer states the real instrument size (160 questions, 32 axes)',
      html.includes('160 questions') && html.includes('32 belief axes'));
    ok('stale philos-jade.vercel.app URL is gone', !html.includes('philos-jade'));
  }
  {
    const calls = installFetch();
    const res = mockRes();
    await handler(mockReq({ body: validBody({ name: 'Line\r\nBreak' }) }), res);
    ok('subject line carries no CR/LF from the name field',
      res.statusCode === 200 && !/[\r\n]/.test(calls.resend[0].subject), calls.resend[0].subject);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
})();
