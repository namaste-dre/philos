# Phil OS - Claude Code Context
_Instrument v4 | 32 axes | 160 questions | 60 archetypes | Live at phil-os.thelifepm.com_

---

## SESSION START

0. **CRITICAL - READ THIS FIRST (2026-07-10, Fable has 2 days of capacity left, resume here).** For Fable specifically, go straight to the vault note [[Phil OS - Fable Handover 2026-07-10]] before reading anything else in this file. Full state below is written to be self-sufficient - do not assume anything not stated here.

   **Shipped and live, nothing pending:** Phase 11 M1-M5 (DB hardening, consent/research schema, real account deletion, real research opt-in, completions/account_completions merge - Decisions Log D56-D71). Phase 7 question-bank rewrite to instrument v4, verified via 12 review blocks plus a from-scratch 60-prototype reachability harness that found and fixed a real archetype-collision bug (D65-D71). A QA version-display feature (Settings footer + dev panel showing live instrument version and build commit hash, wired to Vercel's runtime env vars - D-series entries around 2026-07-07). A correction that anonymous-respondent autosave is **not** a gap - account-before-assessment is confirmed intentional product behavior, live since 2026-05-31, and `anon_progress`/`/api/progress` are intentionally unwired reserved infrastructure, not pending work (D72-D75).

   **Shipped and live, nothing pending:** Phase 11 M1-M5, Phase 7 question-bank rewrite to instrument v4 (D65-D71), the QA version-display feature, the anonymous-assessment correction (D72-D75). **The full compliance/consent architecture repair is now shipped, not just drafted (D79, D82, D85-D92):** D82's share-link privacy warning is live on both the in-app report and the confirmation email; the share page is now noindex/nofollow; marketing consent is a real, separate, default-off control, no longer hardcoded true (D79); a canonical consent transaction path exists (`api/consent.js` calling a Postgres RPC, `set_consent`, updating `profiles` and inserting into `consent_log` inside one transaction - verified live against the real database that a failure rolls back both halves); `profiles.gdpr_consent_version` exists for future re-consent gating. Supabase migrations are now tracked in the repo (`supabase/migrations/`) - a real gap that existed for all 7 migrations to date, the 6 pre-2026-07-10 ones still need backfilling.

   **Still open, real next steps in the consent sequence:** Step 4 (unified onboarding/re-consent UI), Step 5 (18+ age enforcement with real server-side validation), Step 6 (regression tests across the full flow).

   **Spun off as separate tracked background tasks, not blocking:** "Step 2R - migrate research consent to canonical consent path" (task_4db2e489) and "Fix mislabeled Copy profile link button" (task_542b4d11).

   **Still open, unrelated to the above:** Phase 11 M6 (analytics retirement, gated on PostHog going live), the leaked-password Supabase dashboard toggle (Andre's action), backfilling the 6 pre-2026-07-10 Supabase migrations. **Fable's final 2 days of capacity are governed by D86** - Phase 8 first, then 10c, then a scoped-down Phase 15, then 10f/10g; 10i and 10h-dropdown are reassigned to Sonnet, not Fable's anymore. The S5/S6 card/UX work stays deferred to its own dedicated session.

   **PHASE 8 IS EXECUTED (2026-07-10, Fable, D93/D94) and sitting in local commit `0d7efd9`, NOT pushed.** Andre reviews and pushes; Vercel deploys on push. Contents: hard-written variant texts on all 60 archetypes (tagline/cardTagline/whoYouAre + de-dashed description/strength/failureMode), growth-edge curated library (64 axis + 42 contradiction entries, deterministic selection, no AI), report prompts cut to identity+alignment+world (first names preserved per D76), output validator, temperature 0.6 server-side, report pipeline version r2 with D47 metadata finally wired (the columns existed since M5 but capture.js never whitelisted them). Rubric and consistency-pass evidence: `FABLE5_PHASE8_RUBRIC.md`. After deploy, run one QA-mode report to confirm the r2 metadata columns populate and growth edges render in-app, on the share page, and in the email. Fable's next work item is 10c.

   Read [[Phil OS - Decisions Log]] entries D56 through D94 for the full dated record behind all of the above - this summary is a pointer, not a replacement for it.

1. Read the full Project Instructions in `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\PHIL OS - Claude Project Instructions v3.0.md` _(path corrected 2026-07-06: the file moved out of the Inbox. Warning: that note is truncated mid-table and its current-state figures are stale - treat this CLAUDE.md as the more current source until it is rebuilt.)_
2. Read `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Build Log.md` - open items section
3. Check `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Decisions Log.md` before touching anything locked
4. Orient to current state from the Master Index before building

_(Note: the paths above use plain hyphens, not em dashes - the actual filenames on disk use hyphens.)_

---

## WHAT PHIL OS IS

A rigorous, science-backed philosophical profiling instrument that maps a person's complete worldview across 32 belief axes, detects internal contradictions, and generates an actionable life guide. The first instrument to do this with psychometric rigour at philosophical depth. Target: what 16Personalities does for personality at the depth it has never attempted.

**Tagline:** "Know Your Philosophical Operating System."

Built and owned by The Life PM. Not monetised until herbeoordeling resolves.

---

## FILE LOCATIONS

```
Local path:    C:\philos\
GitHub:        github.com/namaste-dre/philos
Live URL:      phil-os.thelifepm.com
Vault docs:    C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\
Stack:         Single index.html (vanilla JS) + /api/ serverless functions
Hosting:       Vercel (auto-deploy from main branch)
```

**Deploy:** Edit `index.html`/`api/*` locally → validate (`node --check`, dash scan) → push to `main` → Vercel auto-deploys. Per D61 (2026-07-06), Sonnet sessions push directly for Phil OS (same workflow as Dutch OS) after Andre's explicit per-batch go; no separate GitHub Desktop hand-off required.

---

## CURRENT STATE (as of 2026-07-10)

| Component | Status |
|---|---|
| 160 questions, 32 axes, 5 items/axis, instrument **v4** | ✅ Complete and live (Phase 7, D65-D71) |
| 60 archetypes (12 families × 5 variants) | ✅ Complete - all 60 verified to recover themselves under a from-scratch reachability harness (D69-D71) |
| Archetype engine (13-axis Euclidean distance) | ✅ Complete |
| Contradiction engine (exactly 42 rules: 11 A, 22 B, 9 C) | ✅ Live. C01b reframed per D44/D57 (examination framing, libertarian retributivism named coherent) |
| Liminality (D41/D57): family-level, threshold 1.0 | ✅ Live |
| Reversed-item keying (D40): Likert-only, both directions covered per axis where 2+ Likerts exist - 36 reversed flags total, uneven by design, not the old uniform-2 assumption | ✅ Live, dev-panel integrity check updated to match |
| AI report (claude-sonnet-5, 2-call split) | ✅ Working. **Pipeline r2 committed locally, not yet deployed (D93):** AI writes identity + alignment + world lenses only; card text, patterns, growth are data-driven; validator + temp 0.6; OCEAN dropped from prompt (D94). First name + axis/archetype/fingerprint/contradiction profile sent to Anthropic - confirmed **intentional** (D76), not a leak |
| Hard-written archetype texts (60) + growth-edge library (64 axis + 42 contradiction entries) | ⚠️ Built and verified (D93), in local commit `0d7efd9`, awaiting Andre's push |
| Email capture + Supabase | ✅ Working |
| Auth (Google SSO + email/password), **required before assessment access** | ✅ Live (D72 - route guard confirmed live since 2026-05-31, not a new restriction) |
| Question explanations (all 160, neutrality-audited) | ✅ Live |
| Answer-order pinning (27 synthesis options) | ✅ Live |
| Shareable card (1080×1920, 9:16 story format) | ✅ Working |
| Custom domain (phil-os.thelifepm.com) | ✅ Live |
| QA version display (Settings footer + dev panel, live commit hash via Vercel env vars) | ✅ Live |
| Phase 11 database re-architecture (M1-M5) | ✅ Executed and verified live. M6 (analytics retirement) gated on PostHog going live |
| Real account deletion, real research opt-in | ✅ Live and verified end-to-end (D62) |
| D2 privacy notice, processor register, DPIA outline | ⚠️ Drafted, **not published, not legally reviewed** - see [[Phil OS - D2 Privacy Notice Draft]] |
| 18+ age gate | ⚠️ **Decided, NOT implemented** - still 13+ soft field, no confirmation checkbox. This is Step 5 of the consent sequence (D78) |
| Marketing consent separation | ✅ Live - real, separate, default-off checkbox/toggle, own consent_log trail (D79/D88) |
| Share-link privacy warning | ✅ Live on both the in-app report and the confirmation email (D82/D87). Share page also now noindex/nofollow. |
| Canonical consent transaction path | ✅ Live - `set_consent` RPC updates profiles + consent_log atomically, verified against the real database (D89) |
| Supabase migrations tracked in repo | ⚠️ Started 2026-07-10 - 2 of 7 migrations now in git, 6 older ones need backfilling |
| Free tier gating | ❌ Not built |
| Stripe payment | ❌ Locked until herbeoordeling |
| Sketch illustrations | ⚠️ 1/32 done (naturalism.png) |
| Full systematic end-to-end test (all 160 questions) | ⚠️ Partial coverage only (one real beta completion, one self-test, one Sonnet-driven full retake for M5 validation) - not a dedicated systematic pass |

---

## TECHNICAL STACK

**Env vars (Vercel):** `ANTHROPIC_API_KEY` · `SUPABASE_URL` · `SUPABASE_SERVICE_KEY` · `RESEND_API_KEY` · `RESEARCH_KEY_PEPPER`

**Critical syntax rule:** Apostrophes in JS single-quoted strings crash the app. Always double-quote or escape (`\'`) strings containing apostrophes - caught live during this session's D2 work (2026-07-07).

**Reversed scoring:** `ans = q.reversed ? (8 - rawAns) : rawAns` in `computeScores()`

**QA pre-fill:** `rawTarget = q.reversed ? (8 - target) : target`

**Instrument version:** single source of truth is the `INSTRUMENT_VERSION` constant near the top of `index.html`'s script (added 2026-07-07 to stop the version drifting across multiple hardcoded strings - it had drifted to 4 different places before this fix).

---

## THE 32 AXES

Scoring: 1 = poleL, 7 = poleR, 4 = midpoint. 5 items/axis.

**T1 Foundations (weight 1.5):** naturalism · physicalism · realism · determinism · moral_ground · meaning

**T1.5 Structural (weight 1.5):** teleology · human_nature · epistemic_method · social_ontology · temporal_orientation · moral_authority · epistemic_humility

**T2 Derived (weight 1.0):** knowledge · science · freewill_practice

**T3 Applied (weight 1.0):** justice · ethics · religion · politics · self · moral_scope · meaning_practice · society · responsibility · identity · authority · economics · uncertainty · mind_consciousness · animal_ethics · progress

**Archetype SIG_AXES (13):** all T1 + all T1.5

---

## SUPABASE SCHEMA (current, post-Phase 11 M5)

**completions:** id · user_id (nullable FK, added M5) · first_name · email · country · gdpr_consent · consented_at · archetype_family · archetype_variant · scores (jsonb) · fingerprint (jsonb) · contradictions_count · completed_at · source · qa_mode · report_json (jsonb) · instrument_version · axis_count · question_count · report_version · prompt_hash · model · temperature · generated_at

**responses:** id · completion_id (FK, ON DELETE CASCADE) · question_id · question_text · axis · tier · question_type · answer_value · answer_text · reversed · scored_value · weight · instrument_version · dev_flag · dev_note

**Also:** assessment_progress · anon_progress (unwired, reserved - D75) · consent_log · profiles · rate_limits · research_profiles · analytics_events (pending retirement, M6)

**`account_completions` is now a read-only compatibility view** (real table renamed to `account_completions_deprecated_20260706`) - kept through the stabilization period, not dropped yet, per Andre's explicit call.

---

## NEXT PRIORITIES (as of 2026-07-10)

0. **Andre: review and push local commit `0d7efd9` (Phase 8, D93)** - single commit, 6 files, fully verified. Then one QA-mode report generation to confirm r2 metadata + growth rendering.
0b. **Fable's remaining window, governed by D86** - Phase 8 is done (D93/D94). Next: 10c (160 hover explanations), then scoped-down Phase 15, then 10g/10f boundaries. 10i and 10h-dropdown are Sonnet's, not Fable's.
1. Step 4 of the consent sequence - unified onboarding/re-consent UI (collapse the 4 consent surfaces, delete dead consent-gate code, split age confirmation from assessment consent, build a real withdraw action, version-gate existing users).
2. Step 5 - age enforcement (real server-side validation, not just the HTML min attribute).
3. Step 6 - regression tests across the full consent flow.
4. Step 2R - research consent onto the canonical path (task_4db2e489).
5. Copy-profile-link mislabeling fix (task_542b4d11).
6. Backfill the 6 pre-2026-07-10 Supabase migrations into the repo.
7. Phase 11 M6 (analytics_events retirement) - gated on PostHog going live.
8. Leaked-password protection toggle - Andre's action, Supabase dashboard.
9. Sonnet 6B brief (items 3-9) - whenever Andre triggers it.
10. S5/S6 card and UX-mechanical work - its own dedicated session.
11. Full systematic end-to-end test of all 160 questions.
12. Free tier gating - before any marketing push.
13. PhD endorsement outreach.
14. Remaining 31 sketch illustrations.
15. Monetise - post-herbeoordeling.

---

## PSYCHOMETRIC STANDARDS

- Item-total correlation r ≥ 0.30 (post-launch, needs 300+ completions)
- Reversed items: agreeing = poleL = score 1 after 8 − raw
- α target per axis: ≥ 0.70 (needs 300+ completions)
- Option score range: max ≥ 5 (right pole), min ≤ 3 (left pole) on every tradeoff/scenario
- Normalisation (current, per D40, live as of Phase 7/instrument v4): 5 items/axis, **reversed flag is Likert-only**, both directions covered per axis wherever it has 2+ Likert items - 36 reversed flags total, distribution intentionally uneven across axes (not a uniform 2/axis). Dev-panel integrity check verifies this directly against the live question bank, not a hardcoded count.

---

## LOCKED DECISIONS - DO NOT RE-LITIGATE

Consent architecture (D85-D92, 2026-07-10): canonical transactional consent path (set_consent RPC, gdpr + marketing only for now), marketing consent separated and default-off, gdpr_consent_version added, D6 in the old Fable checkpoint doc superseded (do not implement it - first-name personalization stays).


32 axes · 5 items/axis · reversed-item keying is Likert-only per D40 (supersedes the old uniform "2 reversed/axis" A7 lock) · 160 questions · 60 archetypes · 13-axis engine · 1-7 Likert · **Instrument v4** · 3-tier contradiction system (42 rules, 11A/22B/9C) · graduated strength · liminal threshold 1.0, family-level · **account required before assessment access** (D72, supersedes the older "email hard gate at the end" framing) · GDPR consent before report · **18+ minimum age decided for launch, not yet implemented in code** (D78) · no monetisation until herbeoordeling · Supabase for data · Vercel hosting, Sonnet pushes directly (D61) · Question explanations: neutrality-audited, gated by kill switch + per-user setting · Two-app model rejected · First-name personalization to Anthropic is intentional, not a leak (D76) · "Fingerprint" described as "profile summary" in privacy/legal copy specifically, not a UI rename (D77)

---

## VAULT DOCUMENTS

```
C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\
├── 771 - Product Strategy and Vision\
│   └── Phil OS - Product Snapshot.md
├── 772 - Architecture and Build\
│   ├── Phil OS - Architecture and Axis Map.md  <- source of truth on axes
│   └── Phil OS - Question Bank v3.md           <- canonical questions (content is v4-current despite the v3 filename)
├── 776 - Build Log and Decisions\
│   ├── Phil OS - Build Log.md                  <- open items + session log
│   ├── Phil OS - Decisions Log.md              <- every locked decision, D1 through D84+
│   ├── Phil OS - Scoring and Archetype Logic.md
│   ├── Phil OS - Instrument Governance.md      <- standing change-approval rules for the measurement core
│   ├── Phil OS - Database Target Architecture (Phase 11).md
│   ├── Phil OS - Sonnet 5 Handover Brief.md    <- Sonnet task list and ground rules
│   ├── Phil OS - D2 Privacy Notice Draft.md    <- NEW 2026-07-07, draft, not published
│   ├── Phil OS - Processor Register.md         <- NEW 2026-07-07, draft tracking table
│   ├── Phil OS - Compliance Program (DPIA, Terms, User Rights, Security Baseline).md  <- NEW 2026-07-07, draft
│   ├── Phil OS - Full Psychometric and Philosophical Audit v4.md
│   ├── Phil OS - Item Analysis and Question Standards.md
│   └── Phil OS - Council Analysis Summary.md
└── Phil OS - Master Index.md
```

**In `C:\philos\` itself (this repo, not the vault):** `FABLE5_AUDIT_PLAN.md`, `FABLE5_FACT_FINDING.md`, `FABLE5_PSYCHOMETRIC_STANDARD.md`, `SONNET5_FIXES_LOG_2026-07-06.md`.

---

## BUILD STANDARDS

- Production-ready only - no exceptions
- Validate every JS file with `node --check` before delivering
- Fix errors silently and note what was fixed
- Match existing code style exactly
- Never deliver unvalidated code
- Every session end: update Build Log + Decisions Log + Master Index + this file

## NEVER DO

- Re-litigate locked decisions without a new dated decision entry
- State psychometric facts, philosophical positions, or philo standards from memory - source from docs
- Build free tier gating or Stripe before herbeoordeling resolves
- Deliver unvalidated code
- Skip end-of-session vault doc updates
- Apply onboarding/auth-adjacent code changes without Andre's explicit go, even if the change looks small

---

## WHO YOU ARE WORKING WITH

**Andre Beasley** - American expat, 49, Zaltbommel, Netherlands. **AuDHD** (ADHD + Autism) - interest-based nervous system, hyperfocus is a strength, initiation difficulty and time blindness are real. Hard determinist, atheist humanist, former evangelical pastor. Partner Manja (moved in June 2026). **Coeliac disease** - severe gluten/wheat allergy, non-negotiable.

On **WIA benefit (WGA-LAU)** - cannot earn KVK income until herbeoordeling resolves. No product revenue until cleared.

**Building under The Life PM:** Plaud Matrix v2 · SynapseOS · Phil OS · PiggyLog · ChoreOS · ManDre Meal Planner · memoir *No Choice But to Leave*

## HOW TO WORK WITH ANDRE

- **Direct and results-oriented.** Don't describe what should be done - do it.
- **No yes-manning.** Push back when wrong. Give real opinions. Be a thinking partner, not a validator.
- **No preambles.** Short declarative sentences. Get to the point.
- **One clarifying question maximum.** Make a reasonable assumption, state it, proceed.
- **Flag hyperfocus traps** - "This is solid. Before continuing - [X] is the actual bottleneck. Switch or finish first?"

## NO HALLUCINATION - HARD RULE

1. **Never state a fact you are not certain of.** If you don't know an exact path, method name, or field - say so and check the live file.
2. **Never invent code paths, function names, or data contract fields.** Verify against the project docs first.
3. **Validate every file before delivering** - `node --check` for JS, appropriate parser for other formats.
4. **Three confidence tiers:**
   - ✅ **VERIFIED** - confirmed from a file read this session
   - 🔍 **RESEARCHED** - from official documentation checked this session
   - ⚠️ **INFERRED** - logical deduction - always flag, never state as fact
5. Fix errors silently and note what was fixed.
6. **Never agree with something wrong to avoid friction.**

---

## END OF SESSION - MANDATORY

1. Build Log: `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Build Log.md`
2. Decisions Log (all new, dated): `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Decisions Log.md`
3. Scoring/logic changes: `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Scoring and Archetype Logic.md`
4. Master Index (if build state changed): `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\Phil OS - Master Index.md`
5. Update this CLAUDE.md - current state table and next priorities

Session summary: DECISIONS MADE / TASKS COMPLETED / NEW TASKS / VERSION
