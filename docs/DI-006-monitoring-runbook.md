# DI-006 Monitoring Runbook

Operational reference for Phil OS production monitoring. Covers everything currently built. See the "Not yet built" section at the end for what this monitoring does not cover.

## 1. What exists today, in one sentence each

- **Boot-completion check** - a scheduled headless-browser load of production that proves the site not only responds but finishes booting.
- **Structured observability events** - every one of the 6 production API endpoints logs machine-parseable JSON instead of free-text `console.error`/`console.warn` strings.
- **Alert channel** - a failed boot-check run triggers GitHub's own default failed-workflow email, already routed to the right address with zero extra configuration.

Nothing here alerts on a *degraded* site (elevated 401/429/503 rates, generation failure spikes, rate-limit exhaustion). See section 7.

## 2. Boot-completion check

**What it checks:** loads `https://phil-os.thelifepm.com` in a real headless Chromium browser and asserts two things: the HTTP response status is `200`, and `window.__philBooted === true` after the page finishes loading. It also captures any `pageerror` or console-`error` events during the load and prints them.

**Why both checks, not just HTTP 200:** a bare uptime check would have missed the 2026-07-31 incident - a stranded `async` keyword partway through `index.html`'s main script block let the page serve a perfectly valid 200 response while silently preventing `authBoot`'s `DOMContentLoaded` registration. Function declarations hoisted, so even direct-call verification missed it. `window.__philBooted` is a marker asserted as the literal last statement of the script, so it can only become `true` if everything before it actually ran.

**Where it runs:** GitHub Actions, `.github/workflows/boot-check.yml`, on GitHub-hosted `ubuntu-latest` runners. Not on Vercel, not self-hosted.

**How often:** every 15 minutes (`cron: '*/15 * * * *'`), plus on-demand via `workflow_dispatch`.

**What a green run proves:** production served the real page and the main script executed to completion in a real browser, within the last 15 minutes.

**What a failed run means:** either the site did not return HTTP 200, or it returned 200 but the boot script never finished (the exact failure signature of the 2026-07-31 incident). The log always states which one, plus any captured page/console errors.

**Where the logs live:** GitHub Actions run logs, this repo's **Actions** tab, `boot-check.yml` workflow. Each run's log shows `HTTP status:`, `window.__philBooted:`, and `console/page errors observed:` lines. Retention is GitHub's default for the plan (no custom retention configured).

**Reproducing a check manually:** the check script is not a standalone file - it is written inline by the workflow (a heredoc that generates `check.mjs` at run time, then runs it with Playwright's `chromium`). To reproduce locally: copy the script body out of `.github/workflows/boot-check.yml`'s "Load production and assert boot completed" step into a local `.mjs` file, `npm install playwright && npx playwright install --with-deps chromium`, then `node <file>.mjs`.

## 3. Structured observability events

**What they check:** nothing on their own - they are the raw material for future alerting (see section 7), and today serve as searchable, parseable diagnostic output in place of the old free-text `console.error` calls.

**Event shape:** `{ ts, level, module, event, detail? }` as one JSON line per event. `level` is `info`/`warn`/`error`. `detail`, when present, must be a plain object.

**Where they run:** inside the relevant Vercel serverless function, on every request that hits a logging call site. Same execution environment as the API endpoint itself - production Vercel infrastructure.

**How often:** continuously, on every request that triggers a logged code path (rate-limit failures, provider errors, request failures, and similar).

**Where the logs live:** Vercel's function log stream (Vercel dashboard, this project, **Logs** tab, or `vercel logs`). Retention depends on the Vercel plan; this is not a long-term log store.

**Coverage - all 6 endpoints, two different mechanisms:**
- `api/capture.js`, `api/report.js`, `api/share-control.js` import `logEvent` from `lib/observability.js` directly.
- `api/generate.js`, `api/email.js`, `api/claim-attempt.js` define their own inline `logEvent()` with the identical JSON shape, rather than importing the shared module. This is deliberate: these three files are held to a zero-import containment contract (guarded by `deploy-config.test.js`) precisely so their attack surface stays minimal. Do not "clean up" this duplication by adding an import - that would break the containment guarantee the test suite enforces.

## 4. Alert channel

**Destination:** `dre63052@gmail.com` (D155, Phil OS Decisions Log).

**Mechanism:** no custom integration exists. A failed `boot-check.yml` run is a failed GitHub Actions workflow run, and GitHub's own account-level notification setting (`github.com/settings/notifications`, System > Actions = "Email (Failed workflows only)") already routes that to the account's default notification email, which is the address above. Verified directly against both `github.com/settings/emails` and `github.com/settings/notifications` on 2026-08-01 - no repo-level override exists, no setting change was needed.

**What this does NOT cover:** structured observability events (section 3) do not currently trigger any alert. They are visible in the Vercel log stream but nothing watches them for thresholds. See section 7.

## 5. Credential and access reference (no secret values here)

| What | Where the actual value lives | Where it's used |
|---|---|---|
| GitHub PAT "Phil OS Actions Read" (Actions: Read-only, `namaste-dre/philos` only) | Andre's Bitwarden, entry named "Phil OS Actions Read" | Local `GH_TOKEN` environment variable, read automatically by the `gh` CLI for manually inspecting workflow runs. Expires 2026-08-31. |
| `RESEND_API_KEY` | Resend dashboard; set as a Vercel production env var | `api/email.js`, unrelated to this monitoring surface but sharing the same "never view/copy the value" discipline |

This monitoring system introduces no new secrets. The boot-check workflow needs no credentials at all - it loads a public production URL.

## 6. Known failure modes and first response

| Symptom | Likely cause | First response |
|---|---|---|
| Single failed run, log shows non-200 status | Deploy in progress, transient network blip, or a real outage | Re-run manually (Actions tab > `boot-check.yml` > Run workflow, or `gh workflow run boot-check.yml`) to rule out a transient flake. If it fails again, check Vercel's deployment status directly. |
| Single failed run, log shows `HTTP status: 200` but `window.__philBooted: false` | Same failure class as the 2026-07-31 incident - the page served but a script error stopped execution before the boot marker | Check the log's captured page/console errors first - they usually name the exact JS error. Check what deployed most recently (`git log` / production `/api/version`) and read that diff for anything touching `index.html`'s main script block. |
| Two or more consecutive scheduled failures (30+ minutes of red) | Likely a genuine, ongoing incident rather than a flake | Treat as active: check production directly in a browser, check Vercel deployment logs, consider reverting the most recent deploy. No on-call rotation exists beyond Andre - this is a direct escalation, not a queue. |
| Workflow run itself errors before reaching the assertions (e.g. Playwright install failure) | CI environment/tooling issue, not a production issue | This exact failure happened once already (`npx playwright install` only fetches browser binaries, not the `playwright` npm package itself - fixed in `676c1c5` by adding `npm install playwright` first). If a similar install-step failure recurs, the fix pattern is the same: confirm every package the script imports is actually `npm install`-ed in a prior step, not assumed present. |
| GitHub Actions itself is down | Platform-level outage, rare | Nothing to fix on this end. Check `githubstatus.com`. The monitoring gap during an Actions outage is a known, accepted risk - there is no secondary check path today. |

**What must never be logged, in this system or in any future extension of it:** PII (`first_name`, `email`), full `report_json` or `answers` content, `share_token_salt` or any token/secret value, raw third-party API response bodies (Resend, Supabase RPC error bodies). Only status codes, lengths, and non-sensitive identifiers belong in a `detail` object. This is not a style preference - DI-006 slices 1 and 3 each found and closed real log-stream leaks of exactly this kind (error bodies that had been echoing `first_name`/`email`/`report_json`/`answers`, and separately `share_token_salt`, a token secret) that existed in the code before this discipline was enforced.

## 7. Not yet built

The Deferred Improvement Backlog's DI-006 definition of done also calls for "broader thresholds for rate-limit/provider/401/429/503 rates and generation failure spikes." That piece is **not built** and is intentionally out of scope for this runbook's coverage claims. It requires its own design decision this document does not make: where threshold evaluation would run (Vercel's free tier has no persistent query surface over historical function logs without adding a paid log drain or building a separate aggregation store, e.g. a Supabase-backed counter), what the actual thresholds and time windows should be, and who owns responding to a breach. The structured events in section 3 are the raw material this future work would consume - they exist and are safe to query, but nothing currently reads them for patterns. Track that piece as its own DI-006 sub-item, not as something this runbook silently claims to cover.

## 8. Verifying after any change to this monitoring surface

1. Run the relevant test suites directly: `node lib/observability.test.js`, `node deploy-config.test.js` (reconfirms the zero-import containment contract on `generate.js`/`email.js`/`claim-attempt.js` is intact).
2. If `.github/workflows/boot-check.yml` changed, trigger it manually (Actions tab or `gh workflow run boot-check.yml`) and read the resulting log rather than assuming the YAML is correct - the Playwright install-step bug in section 6 was exactly this kind of change that looked right and wasn't, caught only by a real run.
3. Confirm production `/api/version` matches the commit you expect deployed before treating any live check as representative of current code.
