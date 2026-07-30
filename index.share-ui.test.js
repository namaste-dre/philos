// A7 (D-1/D136) + D-3 static/behavioral checks for the index.html share UI
// correction round: generic download/native filenames, the share-block
// Copy button dataset staying in sync with the visible URL, and a revoked/
// disabled report never leaving a stale usable URL on screen.
//
// index.html has no existing test harness (single static file, no
// package.json, no jsdom/DOM-testing dependency in this repo) - consistent
// with the no-added-dependency approach the api/*.test.js files already
// use, this extracts the exact function source text via brace-counting and
// either (a) evaluates it against a small hand-rolled fake DOM for real
// behavioral assertions, or (b) asserts directly on the source text for
// pure string-template logic that doesn't need a DOM at all.
//
// Run with:
//   node index.share-ui.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Extracts `function NAME(...) { ... }` by counting braces from the first
// `{` after the signature - robust to nested blocks/arrow functions inside.
function extractFunction(source, name) {
  const sigRe = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const m = sigRe.exec(source);
  if (!m) throw new Error('function not found: ' + name);
  let i = m.index + m[0].length;
  let depth = 1;
  const start = m.index;
  while (depth > 0 && i < source.length) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) throw new Error('unbalanced braces extracting: ' + name);
  return source.slice(start, i);
}

// ---- 1. Generic filename logic (pure string checks, no DOM needed) ----
{
  const downloadCardSrc = extractFunction(html, 'downloadCard');
  ok('downloadCard() no longer references state.userName', !downloadCardSrc.includes('state.userName'), downloadCardSrc);
  ok('downloadCard() uses the generic phil-os-report-<archSlug> filename', downloadCardSrc.includes('`phil-os-report-${archSlug}.png`'), downloadCardSrc);
}
{
  const shareNativeSrc = extractFunction(html, 'shareNative');
  ok('shareNative() no longer references state.userName', !shareNativeSrc.includes('state.userName'), shareNativeSrc);
  ok('shareNative() uses the generic phil-os-report-<archSlug> filename', shareNativeSrc.includes('`phil-os-report-${archSlug}.png`'), shareNativeSrc);
}

// ---- 2. renderShareUrl() / renderShareDisabledState() behavioral checks ----
// Minimal fake DOM: just enough surface (getElementById, querySelector,
// dataset, style, innerHTML/textContent/href) for these two functions.
function makeFakeShareBlock(initialUrl) {
  const anchor = { href: initialUrl, textContent: initialUrl };
  const button = { dataset: { url: initialUrl }, textContent: 'Copy' };
  const block = {
    id: 'report-share-url',
    style: { display: 'none' },
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; },
    querySelector(sel) {
      if (sel === 'a') return anchor;
      if (sel === 'button') return button;
      return null;
    },
  };
  return { block, anchor, button };
}

function runInSandbox(source, blockOrNull, extraGlobals) {
  const { block } = blockOrNull ? blockOrNull : { block: null };
  const sandbox = {
    document: {
      getElementById(id) { return (block && id === 'report-share-url') ? block : null; },
      createElement() { return { style: {}, innerHTML: '' }; },
      querySelector() { return null; },
    },
    console,
    ...extraGlobals,
  };
  vm.createContext(sandbox);
  new vm.Script(source).runInContext(sandbox);
  return sandbox;
}

{
  const renderShareUrlSrc = extractFunction(html, 'renderShareUrl');
  const { block, anchor, button } = makeFakeShareBlock('https://phil-os.thelifepm.com/report?id=abc&t=OLDTOKEN');
  const newUrl = 'https://phil-os.thelifepm.com/report?id=abc&t=NEWTOKEN';
  runInSandbox(renderShareUrlSrc + '\nrenderShareUrl(newUrl);', { block }, { newUrl });
  ok('renderShareUrl() updates the anchor href to the new URL', anchor.href === newUrl, anchor);
  ok('renderShareUrl() updates the anchor text to the new URL', anchor.textContent === newUrl, anchor);
  ok('renderShareUrl() updates the Copy button data-url to the new URL (the actual gap-2 bug)', button.dataset.url === newUrl, button);
  ok('renderShareUrl() resets the Copy button label', button.textContent === 'Copy', button);
}

{
  const renderShareUrlSrc = extractFunction(html, 'renderShareUrl');
  const renderShareDisabledStateSrc = extractFunction(html, 'renderShareDisabledState');
  const staleUrl = 'https://phil-os.thelifepm.com/report?id=abc&t=REVOKEDTOKEN';
  const { block } = makeFakeShareBlock(staleUrl);
  runInSandbox(
    renderShareUrlSrc + '\n' + renderShareDisabledStateSrc + '\nrenderShareDisabledState();',
    { block },
    {},
  );
  ok('renderShareDisabledState() replaces the block content', block.innerHTML.includes('Sharing is off'), block.innerHTML);
  ok('renderShareDisabledState() leaves no trace of the stale token in the visible block', !block.innerHTML.includes('REVOKEDTOKEN'), block.innerHTML);
}

// ---- 3. Call-wiring: revoke/regenerate/refresh must call the right render fn ----
// (The render functions' own correctness is proven above; this confirms
// the state-transition handlers actually invoke them, since fully mocking
// the Supabase auth/fetch layer for a true end-to-end DOM test would need
// infrastructure this file doesn't otherwise have.)
{
  const revokeSrc = extractFunction(html, 'revokeShareLink');
  ok('revokeShareLink() clears currentReportShareUrl', revokeSrc.includes('currentReportShareUrl = null'), revokeSrc);
  ok('revokeShareLink() calls renderShareDisabledState() so the stale URL is not left visible', revokeSrc.includes('renderShareDisabledState()'), revokeSrc);
}
{
  const regenSrc = extractFunction(html, 'regenerateShareLink');
  ok('regenerateShareLink() calls renderShareUrl() with the freshly returned URL', /renderShareUrl\(currentReportShareUrl\)/.test(regenSrc), regenSrc);
}
{
  const refreshSrc = extractFunction(html, 'refreshShareStatus');
  ok('refreshShareStatus() calls renderShareDisabledState() when sharing is off', refreshSrc.includes('renderShareDisabledState()'), refreshSrc);
  ok('refreshShareStatus() calls renderShareUrl() when a current URL is available', /renderShareUrl\(currentReportShareUrl\)/.test(refreshSrc), refreshSrc);
}

// ---- 4. IB-4: sharing-off state-aware messaging on the older share controls ----
{
  const helperSrc = extractFunction(html, 'shareUnavailableMessage');

  const offSandbox = { currentReportShareEnabled: false };
  vm.createContext(offSandbox);
  new vm.Script(helperSrc + '\nvar __result = shareUnavailableMessage();').runInContext(offSandbox);
  ok('shareUnavailableMessage() returns the disabled-state message when sharing is off',
    offSandbox.__result === 'Sharing is off. Turn sharing back on to create a new link.', offSandbox.__result);
  ok('the disabled-state message does not include a URL of any kind', !/https?:\/\//.test(offSandbox.__result), offSandbox.__result);

  const loadingSandbox = { currentReportShareEnabled: true };
  vm.createContext(loadingSandbox);
  new vm.Script(helperSrc + '\nvar __result = shareUnavailableMessage();').runInContext(loadingSandbox);
  ok('shareUnavailableMessage() returns the original not-ready message when sharing is on but no URL yet (still loading)',
    loadingSandbox.__result === "Your share link isn't ready yet - try again in a moment.", loadingSandbox.__result);

  const unknownSandbox = { currentReportShareEnabled: undefined };
  vm.createContext(unknownSandbox);
  new vm.Script(helperSrc + '\nvar __result = shareUnavailableMessage();').runInContext(unknownSandbox);
  ok('shareUnavailableMessage() falls back to the not-ready message when share state is not yet known (undefined)',
    unknownSandbox.__result === "Your share link isn't ready yet - try again in a moment.", unknownSandbox.__result);

  // Static check: every older share control must route through the shared
  // helper rather than each carrying its own copy of the misleading string -
  // a single source of truth for this message, same principle as the
  // manage-sharing block being the source of truth for share state itself.
  for (const fnName of ['shareToX', 'shareToReddit', 'shareNative', 'copyProfileLink']) {
    const fnSrc = extractFunction(html, fnName);
    ok(`${fnName}() routes its unavailable-state message through shareUnavailableMessage()`,
      fnSrc.includes('shareUnavailableMessage()'), fnSrc);
    ok(`${fnName}() no longer hardcodes the old single-purpose "not ready yet" string directly`,
      !fnSrc.includes("Your share link isn't ready yet"), fnSrc);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
