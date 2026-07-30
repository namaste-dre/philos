// IB-3 first slice: deployment-configuration guard (2026-07-30).
//
// Phil OS deploys as a no-framework project on the Vercel Hobby tier, where
// every non-ignored file under api/ becomes one serverless function and the
// documented ceiling is 12 functions per deployment. This repo sits at
// EXACTLY 12. A 13th api/ file does not fail loudly - it silently breaks
// the deploy (this actually happened at commit 135c247, repaired via
// .vercelignore at f8ee65d). Vercel's zero-config builder offers no way to
// declare an explicit function allowlist, so this test IS the allowlist:
// deployment behavior stays deterministic because any change to the
// deployable-function set must be made here, deliberately, in the same
// commit - or this test fails.
//
// Same no-dependency convention as every other suite in this repo.
// Run with:
//   node deploy-config.test.js

const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const HOBBY_FUNCTION_CEILING = 12;

// The exact, deliberate list of deployable serverless functions. Adding an
// endpoint means updating this list AND confirming the count stays at or
// under the ceiling (or consolidating/upgrading first).
const EXPECTED_FUNCTIONS = [
  'capture.js',
  'chat.js',
  'claim-attempt.js',
  'consent.js',
  'delete-account.js',
  'email.js',
  'generate.js',
  'progress.js',
  'report.js',
  'research-sync.js',
  'share-control.js',
  'version.js',
];

// ---- 1. The api/ directory's deployable set matches the allowlist exactly ----
{
  const apiDir = path.join(__dirname, 'api');
  const vercelignore = fs.readFileSync(path.join(__dirname, '.vercelignore'), 'utf8');
  const ignoresTests = vercelignore.split('\n').map(l => l.trim()).includes('api/*.test.js');
  ok('.vercelignore excludes api/*.test.js (without this, test files count toward the function limit)', ignoresTests, vercelignore);

  const allFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
  const deployable = allFiles.filter(f => !f.endsWith('.test.js')).sort();

  ok('deployable api/ function count is exactly ' + EXPECTED_FUNCTIONS.length,
    deployable.length === EXPECTED_FUNCTIONS.length, deployable);
  ok('deployable api/ set matches the allowlist exactly (no unexpected additions, no missing endpoints)',
    JSON.stringify(deployable) === JSON.stringify([...EXPECTED_FUNCTIONS].sort()),
    { actual: deployable, expected: EXPECTED_FUNCTIONS });
  ok('function count is at or under the Hobby-tier ceiling of ' + HOBBY_FUNCTION_CEILING +
     ' (a 13th function SILENTLY BREAKS DEPLOYS - consolidate or upgrade before adding one)',
    deployable.length <= HOBBY_FUNCTION_CEILING, deployable.length);
}

// ---- 2. vercel.json is valid and internally consistent ----
{
  let cfg = null, parseError = null;
  try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8')); }
  catch (e) { parseError = e.message; }
  ok('vercel.json parses as valid JSON (a parse error would fail the whole deploy)', cfg !== null, parseError);

  if (cfg) {
    const fnKeys = Object.keys(cfg.functions || {});
    const missing = fnKeys.filter(k => !fs.existsSync(path.join(__dirname, k)));
    ok('every vercel.json functions entry points at a file that exists', missing.length === 0, missing);
    ok('vercel.json functions entries only reference api/ paths', fnKeys.every(k => k.startsWith('api/')), fnKeys);

    const rewrites = cfg.rewrites || [];
    const badRewrites = rewrites.filter(r => r.destination.startsWith('/api/') &&
      !fs.existsSync(path.join(__dirname, r.destination.slice(1) + '.js')) &&
      !fs.existsSync(path.join(__dirname, r.destination.slice(1))));
    ok('every vercel.json rewrite destination resolves to a real function or file', badRewrites.length === 0, badRewrites);
  }
}

// ---- 3. Root-level test files stay out of the function build ----
{
  // Root-level *.test.js files (index.share-ui, index.axis-geometry,
  // deploy-config itself) and lib/ modules never count as functions in a
  // no-framework project - only api/ does. This assertion documents that
  // fact and guards against someone "organizing" test files into api/.
  const rootTests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js'));
  ok('root-level test files exist outside api/ (they are not functions and must stay out of api/)',
    rootTests.length >= 3, rootTests);
  // lib/ holds shared non-function server modules (B1's schema lives there
  // precisely because api/ is at the ceiling). Guard that no one moves a
  // lib module into api/, which would instantly break deploys.
  const libDir = path.join(__dirname, 'lib');
  const libModules = fs.existsSync(libDir)
    ? fs.readdirSync(libDir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))
    : [];
  ok('lib/ exists and holds at least the B1 schema module (the sanctioned placement for new server code while api/ is at the ceiling)',
    libModules.includes('report-schema-v3.js'), libModules);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
