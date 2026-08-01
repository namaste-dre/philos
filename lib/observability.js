// DI-006 slice 1 (2026-08-01): structured observability events.
//
// A drop-in replacement for the ad hoc console.error/console.warn strings
// scattered across api/*.js (38 call sites as of this slice - rate-limit
// store failures, provider errors, request failures). Same visibility in
// Vercel's log stream, but every line is one parseable JSON object instead
// of free text, so a future dashboard or alert rule can filter and count
// events by module/event/level without regex-parsing prose.
//
// Scope of this slice: the event layer only. It does NOT send alerts
// anywhere - there is no configured destination (email, Slack, PagerDuty)
// and choosing one is Andre's decision (DI-006's own definition of done
// lists "alerts with thresholds and owners" as a separate requirement).
// This module makes the events exist and be countable; wiring them to a
// real alert channel is the next slice, gated on that destination choice.
//
// Never pass PII, tokens, emails, or report content as `detail` fields.
// This module does not sanitize - the caller holds the same discipline the
// ad hoc console calls it replaces already held (grep the call sites this
// slice touches: none of them logged an email, token, or report body).

'use strict';

const LEVELS = new Set(['info', 'warn', 'error']);

function logEvent(level, module, event, detail) {
  if (!LEVELS.has(level)) {
    throw new Error(`observability.logEvent: unknown level "${level}"`);
  }
  if (typeof module !== 'string' || !module) {
    throw new Error('observability.logEvent: module is required');
  }
  if (typeof event !== 'string' || !event) {
    throw new Error('observability.logEvent: event is required');
  }
  const record = { ts: new Date().toISOString(), level, module, event };
  if (detail !== undefined) {
    if (detail === null || typeof detail !== 'object' || Array.isArray(detail)) {
      throw new Error('observability.logEvent: detail must be a plain object when provided');
    }
    record.detail = detail;
  }
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  return record;
}

module.exports = { logEvent };
