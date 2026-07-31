// Dashboard and History build, first slice (2026-07-31).
//
// Pure, dependency-free computation functions for the Phil OS - Dashboard
// and History Specification. Every function here is deterministic and
// takes plain data in, so it can be unit-tested without a database or
// network call - same convention as lib/report-schema-v3.js and
// lib/belief-map-registry.js.
//
// Scope note: this module implements Section 3 items 1 (overview inputs),
// 3 (axis trends), 4 (stability/flux), 5 (pole crossings), 6
// (time-since-last), 9 (overall change metric), and 11 (two-point
// comparison) of the spec. Item 8 (contradiction engine view) is built in
// lib/contradictions.js, a separate module (the 42-rule engine is its own
// concern and deserves its own file/tests). Item 7 (retake status UI)
// is NOT built here - the spec's own Section 3 item 7 explicitly states
// this "remains deferred, not yet authorized or built," a decision this
// slice honors rather than overrides. Item 10 (raw export) and item 12
// (personal notes) are I/O concerns handled in api/capture.js, not pure
// computation, so they are not in this module.

'use strict';

const NEUTRAL = 4.0;
const MAX_DEVIATION = 3.0; // 1-7 scale, midpoint 4: max |score-4| is 3

// -- Section 3.1 (Overview) / the "Conviction Strength" formula ------------
//
// Defined directly from the product's own existing (but previously unwired)
// UI tooltip text: "how far your scores deviate from the neutral midpoint
// across all 32 axes." Returned as a 0-100 percentage of the maximum
// possible deviation, matching the tooltip's percentage framing.
//
// Per the Dashboard and History Specification Section 4 (Lyra's 2026-07-27
// review): this number must NEVER be displayed alone as a confidence
// metric. Callers must pair it with the respondent's own epistemic_humility
// axis score. This module does not enforce that at the data layer (it
// can't - presentation is a UI concern) but returns epistemicHumility
// alongside convictionStrength in computeOverview() specifically so no
// caller can reach for one without the other being right there.
function computeConvictionStrength(scores) {
  const axisIds = Object.keys(scores);
  if (axisIds.length === 0) return 0;
  const totalDeviation = axisIds.reduce((sum, id) => sum + Math.abs(Number(scores[id]) - NEUTRAL), 0);
  const meanDeviation = totalDeviation / axisIds.length;
  return Math.round((meanDeviation / MAX_DEVIATION) * 1000) / 10; // one decimal
}

// -- Section 3.1 (Overview) -------------------------------------------------
//
// completions: array of {completed_at, scores, archetype_family,
// archetype_variant, contradictions_count}, ordered oldest to newest.
// Returns the overview panel's data: current state, drift summary inputs,
// and the top-moved-axes highlight the spec asks to surface automatically
// rather than making the user dig through axis trends to find it.
function computeOverview(completions) {
  if (!Array.isArray(completions) || completions.length === 0) return null;
  const latest = completions[completions.length - 1];
  const previous = completions.length > 1 ? completions[completions.length - 2] : null;

  const convictionStrength = computeConvictionStrength(latest.scores);
  const epistemicHumility = latest.scores.epistemic_humility ?? null;

  let topMoved = [];
  if (previous) {
    topMoved = Object.keys(latest.scores)
      .map(axisId => ({
        axisId,
        from: previous.scores[axisId],
        to: latest.scores[axisId],
        delta: Math.abs(Number(latest.scores[axisId]) - Number(previous.scores[axisId])),
      }))
      .filter(m => Number.isFinite(m.from) && Number.isFinite(m.to))
      .sort((a, b) => b.delta - a.delta || a.axisId.localeCompare(b.axisId))
      .slice(0, 3);
  }

  return {
    latestCompletedAt: latest.completed_at,
    archetypeFamily: latest.archetype_family,
    archetypeVariant: latest.archetype_variant,
    convictionStrength,
    epistemicHumility,
    contradictionsCount: latest.contradictions_count ?? 0,
    totalCompletions: completions.length,
    topMovedAxes: topMoved, // [] if this is the user's first completion
  };
}

// -- Section 3.6 (Time-since-last) -----------------------------------------
//
// Plain-language elapsed time, computed from two ISO timestamps. `now`
// is a required parameter (never Date.now() internally) so this stays a
// pure function callers can unit-test deterministically - the caller
// (the API handler) supplies the real current time once, at the edge.
function formatElapsed(fromIso, nowIso) {
  const from = new Date(fromIso).getTime();
  const now = new Date(nowIso).getTime();
  const ms = now - from;
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month' : `${months} months`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) return years === 1 ? '1 year' : `${years} years`;
  return `${years}${years === 1 ? ' year' : ' years'}, ${remMonths}${remMonths === 1 ? ' month' : ' months'}`;
}

// -- Section 3.3 (Axis trends) ----------------------------------------------
//
// Returns, per requested axis, an ordered array of {completedAt, score}
// points - exactly what a line chart needs, nothing chart-library-specific.
// A single completion yields a single point (spec: "no line" until a
// second point exists) - that is a rendering decision, left to the caller;
// this function just returns however many points exist.
function computeAxisTrends(completions, axisIds) {
  const ids = Array.isArray(axisIds) && axisIds.length > 0 ? axisIds : null;
  const out = {};
  for (const c of completions) {
    const keys = ids || Object.keys(c.scores);
    for (const axisId of keys) {
      if (!(axisId in c.scores)) continue;
      if (!out[axisId]) out[axisId] = [];
      out[axisId].push({ completedAt: c.completed_at, score: c.scores[axisId] });
    }
  }
  return out;
}

// -- Section 3.4 (Stability vs. flux) ---------------------------------------
//
// Population variance of each axis's scores across all of a user's
// completions. Requires at least 2 completions to mean anything - with
// only 1, every axis has variance 0 by definition, which the caller
// should treat as "not enough data," not "perfectly stable."
function computeStabilityFlux(completions) {
  if (completions.length < 2) return { mostStable: [], mostVolatile: [], insufficientData: true };

  const byAxis = {};
  for (const c of completions) {
    for (const [axisId, score] of Object.entries(c.scores)) {
      if (!byAxis[axisId]) byAxis[axisId] = [];
      byAxis[axisId].push(Number(score));
    }
  }

  const variances = Object.entries(byAxis).map(([axisId, scoreList]) => {
    const mean = scoreList.reduce((a, b) => a + b, 0) / scoreList.length;
    const variance = scoreList.reduce((a, b) => a + (b - mean) ** 2, 0) / scoreList.length;
    return { axisId, variance: Math.round(variance * 10000) / 10000 };
  });

  const sorted = [...variances].sort((a, b) => a.variance - b.variance || a.axisId.localeCompare(b.axisId));
  return {
    mostStable: sorted.slice(0, 5),
    mostVolatile: [...sorted].reverse().slice(0, 5),
    insufficientData: false,
  };
}

// -- Section 3.5 (Pole crossings) -------------------------------------------
//
// A crossing is a transition between consecutive completions where an
// axis's score moves from one side of the neutral midpoint to the other
// (strictly - landing exactly on 4.0 is treated as neither pole, matching
// the direction convention elsewhere in this codebase where >=4 is
// "right" only for STRICT >4 here we want a true crossing, not a
// touch-and-stay-on-boundary case).
function detectPoleCrossings(completions) {
  const crossings = [];
  for (let i = 1; i < completions.length; i++) {
    const prev = completions[i - 1];
    const curr = completions[i];
    for (const axisId of Object.keys(curr.scores)) {
      const from = Number(prev.scores[axisId]);
      const to = Number(curr.scores[axisId]);
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
      const fromSide = from === NEUTRAL ? null : (from > NEUTRAL ? 'right' : 'left');
      const toSide = to === NEUTRAL ? null : (to > NEUTRAL ? 'right' : 'left');
      if (fromSide && toSide && fromSide !== toSide) {
        crossings.push({
          axisId,
          fromCompletedAt: prev.completed_at,
          toCompletedAt: curr.completed_at,
          fromScore: from,
          toScore: to,
          fromSide,
          toSide,
        });
      }
    }
  }
  return crossings;
}

// -- Section 3.9 (Overall change metric) ------------------------------------
//
// Mean absolute difference across all shared axes between two completions
// - a single distance number summarizing whole-profile movement. Chosen
// over Euclidean distance because it stays in the instrument's own native
// units (average points moved per axis on the 1-7 scale), which is more
// directly interpretable to a respondent than a squared-distance number.
function computeOverallChange(completionA, completionB) {
  const axisIds = Object.keys(completionA.scores).filter(id => id in completionB.scores);
  if (axisIds.length === 0) return null;
  const totalDelta = axisIds.reduce(
    (sum, id) => sum + Math.abs(Number(completionB.scores[id]) - Number(completionA.scores[id])),
    0
  );
  return Math.round((totalDelta / axisIds.length) * 1000) / 1000;
}

// -- Section 3.11 (Two-point comparison) ------------------------------------
//
// Direct side-by-side diff between any two completions: archetype change,
// the biggest-moving axes, and the contradiction-count change. Full
// contradiction resolved/new/persistent detail (Section 3.8) is a
// separate concern handled by lib/contradictions.js against each
// completion's stored scores - this function only diffs the summary
// count, which is always available with no recomputation.
function compareCompletions(completionA, completionB) {
  const axisIds = Object.keys(completionA.scores).filter(id => id in completionB.scores);
  const axisDeltas = axisIds
    .map(axisId => ({
      axisId,
      from: completionA.scores[axisId],
      to: completionB.scores[axisId],
      delta: Number(completionB.scores[axisId]) - Number(completionA.scores[axisId]),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.axisId.localeCompare(b.axisId));

  return {
    archetypeChanged: completionA.archetype_family !== completionB.archetype_family,
    archetypeFrom: { family: completionA.archetype_family, variant: completionA.archetype_variant },
    archetypeTo: { family: completionB.archetype_family, variant: completionB.archetype_variant },
    overallChange: computeOverallChange(completionA, completionB),
    biggestMovingAxes: axisDeltas.slice(0, 5),
    contradictionsFrom: completionA.contradictions_count ?? 0,
    contradictionsTo: completionB.contradictions_count ?? 0,
    contradictionsDelta: (completionB.contradictions_count ?? 0) - (completionA.contradictions_count ?? 0),
  };
}

module.exports = {
  NEUTRAL,
  MAX_DEVIATION,
  computeConvictionStrength,
  computeOverview,
  formatElapsed,
  computeAxisTrends,
  computeStabilityFlux,
  detectPoleCrossings,
  computeOverallChange,
  compareCompletions,
};
