// DI-006 slice 1: tests for lib/observability.js's structured event logger.
// No network, no database - captures console output directly, same
// convention as lib/dashboard.test.js.
//
// Run with:
//   node lib/observability.test.js

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const { logEvent } = require('./observability.js');

function captureConsole(fn) {
  const calls = { log: [], warn: [], error: [] };
  const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = (line) => calls.log.push(line);
  console.warn = (line) => calls.warn.push(line);
  console.error = (line) => calls.error.push(line);
  try {
    fn();
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
  return calls;
}

// ---- level routing ----
{
  const calls = captureConsole(() => logEvent('error', 'generate', 'rate_limit_store_unavailable'));
  ok('error level routes to console.error, not console.log or console.warn', calls.error.length === 1 && calls.log.length === 0 && calls.warn.length === 0);
}
{
  const calls = captureConsole(() => logEvent('warn', 'generate', 'rate_limit_check_failed'));
  ok('warn level routes to console.warn, not console.log or console.error', calls.warn.length === 1 && calls.log.length === 0 && calls.error.length === 0);
}
{
  const calls = captureConsole(() => logEvent('info', 'email', 'send_succeeded'));
  ok('info level routes to console.log, not console.warn or console.error', calls.log.length === 1 && calls.warn.length === 0 && calls.error.length === 0);
}

// ---- record shape ----
{
  const calls = captureConsole(() => logEvent('error', 'capture', 'note_write_denied', { status: 403 }));
  const record = JSON.parse(calls.error[0]);
  ok('emits valid JSON, not free text', typeof record === 'object');
  ok('record has an ISO timestamp field', typeof record.ts === 'string' && !isNaN(Date.parse(record.ts)));
  ok('record carries the given level', record.level === 'error');
  ok('record carries the given module', record.module === 'capture');
  ok('record carries the given event name', record.event === 'note_write_denied');
  ok('record carries the given detail object', record.detail && record.detail.status === 403);
}
{
  const calls = captureConsole(() => logEvent('warn', 'claim-attempt', 'reclaim_failed_attempt'));
  const record = JSON.parse(calls.warn[0]);
  ok('detail key is omitted entirely when no detail is passed, not written as null/undefined', !('detail' in record));
}

// ---- input validation (fail loud, not silent) ----
{
  let threw = false;
  try { logEvent('critical', 'generate', 'x'); } catch (e) { threw = true; }
  ok('an unknown level throws rather than silently logging at the wrong severity', threw);
}
{
  let threw = false;
  try { logEvent('info', '', 'x'); } catch (e) { threw = true; }
  ok('an empty module name throws', threw);
}
{
  let threw = false;
  try { logEvent('info', 'generate', ''); } catch (e) { threw = true; }
  ok('an empty event name throws', threw);
}
{
  let threw = false;
  try { logEvent('info', 'generate', 'x', 'not an object'); } catch (e) { threw = true; }
  ok('a non-object detail throws rather than silently coercing', threw);
}
{
  let threw = false;
  try { logEvent('info', 'generate', 'x', ['array', 'not', 'object']); } catch (e) { threw = true; }
  ok('an array detail throws (arrays pass typeof object but are not the intended shape)', threw);
}
{
  let threw = false;
  try { logEvent('info', 'generate', 'x', null); } catch (e) { threw = true; }
  ok('a null detail throws rather than being silently written as {}', threw);
}

// ---- return value (callers can assert on what was logged, e.g. in tests) ----
{
  const record = captureConsole(() => {}) && logEvent('info', 'generate', 'x');
  ok('logEvent returns the record it logged', record.module === 'generate' && record.event === 'x');
}

// ---- no accidental PII/secret leakage through the module's own code path ----
{
  const calls = captureConsole(() => logEvent('error', 'email', 'send_failed', { statusCode: 502, providerConfigured: true }));
  const line = calls.error[0];
  ok('a detail object with only non-sensitive fields serializes as given, nothing added or stripped unexpectedly', line.includes('"statusCode":502') && line.includes('"providerConfigured":true'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
