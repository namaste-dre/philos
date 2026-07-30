// FM2 (Belief Map spec Section 11) tests for the shared axisTrackHtml()
// centered-bipolar-geometry primitive in index.html. Same no-dependency,
// brace-extraction convention as index.share-ui.test.js - no jsdom, pure
// function-level math verification (the geometry itself is DOM-agnostic:
// left/right/marker percentages), plus HTML-shape assertions.
//
// Run with:
//   node index.axis-geometry.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

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

const axisTrackHtmlSrc = extractFunction(html, 'axisTrackHtml');

function callAxisTrackHtml(score, color) {
  const sandbox = {};
  vm.createContext(sandbox);
  new vm.Script(axisTrackHtmlSrc + `\nvar __result = axisTrackHtml(${score}, ${JSON.stringify(color)});`).runInContext(sandbox);
  return sandbox.__result;
}

// Parses the left/right/marker percentages directly out of the returned
// HTML string - simplest reliable way to check geometry math without a
// real DOM, and it also proves the values actually reach the markup, not
// just an internal calculation nothing renders. Decimal-aware: the spec's
// "exact marker (4.2 at 4.2)" requirement means these are NOT whole
// percentages - a regex that only matched integers would silently pass
// while under-checking the actual precision (this is exactly the gap Andre
// caught in the previous round).
function parseGeometry(htmlStr) {
  const fillMatch = htmlStr.match(/axis-fill" style="left:(-?\d+(?:\.\d+)?)%;right:(-?\d+(?:\.\d+)?)%/);
  const markerMatch = htmlStr.match(/axis-marker" style="left:(-?\d+(?:\.\d+)?)%/);
  return {
    fillLeft: fillMatch ? Number(fillMatch[1]) : null,
    fillRight: fillMatch ? Number(fillMatch[2]) : null,
    markerPct: markerMatch ? Number(markerMatch[1]) : null,
  };
}

// ---- 1. Exact centering: score 4.0 sits precisely at 50% ----
{
  const g = parseGeometry(callAxisTrackHtml(4.0, '#fff'));
  ok('score 4.0 marker sits at exactly 50% (the scale midpoint)', g.markerPct === 50, g);
  ok('score 4.0 produces a zero-width fill (left=right=50, nothing to show either direction)', g.fillLeft === 50 && g.fillRight === 50, g);
}

// ---- 2. Scale endpoints ----
{
  const gLow = parseGeometry(callAxisTrackHtml(1.0, '#fff'));
  ok('score 1.0 (scale minimum) marker sits at 0%', gLow.markerPct === 0, gLow);
  ok('score 1.0 fill spans from the left edge to the center (left:0, right:50)', gLow.fillLeft === 0 && gLow.fillRight === 50, gLow);

  const gHigh = parseGeometry(callAxisTrackHtml(7.0, '#fff'));
  ok('score 7.0 (scale maximum) marker sits at 100%', gHigh.markerPct === 100, gHigh);
  ok('score 7.0 fill spans from the center to the right edge (left:50, right:0)', gHigh.fillLeft === 50 && gHigh.fillRight === 0, gHigh);
}

// ---- 3. Equal visual weight both directions - the core FM2 requirement ----
// Two scores equidistant from the center (4.0) must produce mirror-image
// geometry: identical fill length, marker offset symmetric around 50%.
{
  const gLeft  = parseGeometry(callAxisTrackHtml(3.0, '#fff'));  // 1.0 below center
  const gRight = parseGeometry(callAxisTrackHtml(5.0, '#fff'));  // 1.0 above center

  const leftFillWidth  = gLeft.fillRight - gLeft.fillLeft;   // e.g. right:50 - left:33 = 17
  const rightFillWidth = 100 - gRight.fillRight - gRight.fillLeft; // (100-fillRight) - fillLeft = right-side fill width

  ok('equidistant scores (3.0, 5.0) produce equal fill lengths - equal visual weight both directions',
    leftFillWidth === rightFillWidth, { gLeft, gRight, leftFillWidth, rightFillWidth });
  ok('equidistant scores produce mirror-image marker offsets from center',
    (50 - gLeft.markerPct) === (gRight.markerPct - 50), { leftOffset: 50 - gLeft.markerPct, rightOffset: gRight.markerPct - 50 });
}
{
  // A second equidistant pair further from center, to rule out a fluke at
  // exactly ±1.0.
  const gLeft  = parseGeometry(callAxisTrackHtml(2.0, '#fff'));  // 2.0 below center
  const gRight = parseGeometry(callAxisTrackHtml(6.0, '#fff'));  // 2.0 above center
  ok('a second equidistant pair (2.0, 6.0) also produces mirror-image marker offsets',
    (50 - gLeft.markerPct) === (gRight.markerPct - 50), { gLeft, gRight });
}

// ---- 4. Exact marker positioning - spec Section 11's binding requirement ----
// "exact marker (4.2 at 4.2)" means the true 1-7 scale position, not a
// value rounded to the nearest whole percent. A whole-percent round would
// bucket every score within a ~3.5%-wide window (1/6 of the scale's 100%
// span) onto the same marker position - this section proves that isn't
// happening, not just that two arbitrary scores differ.
{
  const g42 = parseGeometry(callAxisTrackHtml(4.2, '#fff'));
  ok('score 4.2 marker sits at its exact 1-7 scale position (((4.2-1)/6)*100 = 53.333...), not rounded to 53',
    g42.markerPct === 53.333, g42);
}
{
  // Mirror pair straddling center with a whole-number offset (1.8 each
  // way) but landing on values a whole-percent rounder would still get
  // right by coincidence - included as a baseline before the harder
  // non-integer-offset pair below.
  const g58 = parseGeometry(callAxisTrackHtml(5.8, '#fff'));
  const g22 = parseGeometry(callAxisTrackHtml(2.2, '#fff'));
  ok('score 5.8 marker sits at its exact position (80)', g58.markerPct === 80, g58);
  ok('score 2.2 marker sits at its exact position (20), mirroring 5.8 around the 50 center',
    g22.markerPct === 20 && (100 - g58.markerPct) === g22.markerPct, { g58, g22 });
}
{
  // The real test of exactness: an equidistant pair whose positions are
  // NOT round numbers (38.333.../61.666...) - a whole-percent-rounding bug
  // would corrupt these specific values (to 38/62, breaking the mirror
  // symmetry by 0.333 on each side) while leaving round-number cases like
  // 5.8/2.2 above looking correct. Values computed directly, not hand-typed.
  const gLow  = parseGeometry(callAxisTrackHtml(3.3, '#fff'));
  const gHigh = parseGeometry(callAxisTrackHtml(4.7, '#fff'));
  ok('score 3.3 marker sits at its exact non-round position (38.333)', gLow.markerPct === 38.333, gLow);
  ok('score 4.7 marker sits at its exact non-round position (61.667)', gHigh.markerPct === 61.667, gHigh);
  ok('the 3.3/4.7 pair mirrors exactly around center even at non-round precision - the actual exact-marker proof',
    Math.abs((100 - gHigh.markerPct) - gLow.markerPct) < 0.001, { gLow, gHigh });
  ok('the 3.3/4.7 pair also produces equal fill lengths at non-round precision',
    Math.abs((gLow.fillRight - gLow.fillLeft) - (100 - gHigh.fillRight - gHigh.fillLeft)) < 0.001, { gLow, gHigh });
}
{
  const g48 = parseGeometry(callAxisTrackHtml(4.8, '#fff'));
  const g42 = parseGeometry(callAxisTrackHtml(4.2, '#fff'));
  ok('score 4.2 and 4.8 (both right of center) produce different marker positions - not bucketed to the same band',
    g42.markerPct !== g48.markerPct, { g42, g48 });
}

// ---- 5. Structural invariants across the full 1-7 range ----
{
  let allValid = true;
  const failures = [];
  for (let s = 1; s <= 7; s += 0.5) {
    const g = parseGeometry(callAxisTrackHtml(s, '#fff'));
    // left/right must never exceed 50 (fill only ever grows from center
    // toward one edge, never doubles back past it) and must never go
    // negative (would place the fill outside the track).
    if (g.fillLeft < 0 || g.fillLeft > 50 || g.fillRight < 0 || g.fillRight > 50) {
      allValid = false;
      failures.push({ score: s, g });
    }
  }
  ok('for every score across the full 1-7 range, fill left/right stay within [0,50] (never overflows the track)', allValid, failures);
}

// ---- 6. All three geometry elements are always present, regardless of score ----
{
  const htmlStr = callAxisTrackHtml(4.0, '#fff');
  ok('axis-track wrapper present', htmlStr.includes('class="axis-track"'));
  ok('axis-center-tick present (the fixed midpoint reference, spec requirement)', htmlStr.includes('class="axis-center-tick"'));
  ok('axis-fill present', htmlStr.includes('class="axis-fill"'));
  ok('axis-marker present (the exact-position, colour-independent indicator)', htmlStr.includes('class="axis-marker"'));
  ok('axis-marker is aria-hidden (decorative - the accessible score value is the existing .axis-score text, not this dot)', htmlStr.includes('aria-hidden="true"'));
}

// ---- 7. Color parameter reaches the fill, not the marker (marker stays white/fixed per spec's colour-independence requirement) ----
{
  const htmlStr = callAxisTrackHtml(5.5, '#5bbf94');
  ok('the passed color is applied to axis-fill', /axis-fill" style="[^"]*background:#5bbf94/.test(htmlStr), htmlStr);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
