# Phil OS - Claude Code Context
_Instrument v3 | 32 axes | 160 questions | 60 archetypes | Live at phil-os.thelifepm.com_

---

## SESSION START

0. **AUDIT STATUS (updated 2026-07-06, final): Checkpoint A is RULED and the B batch is LIVE.** All rulings are Decisions Log entries **D40-D53** - that log is the authority. The B batch was pushed by Andre and verified live on phil-os.thelifepm.com (new stems serving, t1tel06b flag gone, /api/chat returns 503). D51 is resolved (D52): "Domain authority defines the construct; psychometrics defines the measurement" - see [[Phil OS - Instrument Governance]], which also holds the D53 decision template for major architectural rulings. Phase 7 is unblocked (scope = D45). Still open: Phase 11 DB design doc (owed by Fable), Sonnet 6B run (Andre triggers). Any session touching Phil OS still reads **`FABLE5_SESSION_HANDOVER_2026-07-06.md` FIRST**, then D40-D53.
1. Read the full Project Instructions in `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\PHIL OS - Claude Project Instructions v3.0.md` _(path corrected 2026-07-06: the file moved out of the Inbox. Warning: that note is truncated mid-table and its current-state figures are stale - treat this CLAUDE.md as the more current source until it is rebuilt.)_
2. Read `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Build Log.md` - open items section
3. Check `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Decisions Log.md` before touching anything locked
4. Orient to current state from the Master Index before building

_(Note: the paths above use plain hyphens, not em dashes - the actual filenames on disk use hyphens. This file previously had em dashes in these specific paths, which never matched the real filenames; fixed 2026-07-06.)_

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

## CURRENT STATE (as of 2026-07-06)

| Component | Status |
|---|---|
| 160 questions, 32 axes, 5 items/axis | ✅ Complete |
| 60 archetypes (12 families × 5 variants) | ✅ Complete |
| Archetype engine (13-axis Euclidean distance) | ✅ Complete |
| Contradiction engine (exactly 42 real rules: 11 A, 22 B, 9 C. Phantom-comma bug fixed. **C01b fully reframed per D44 (D57)** - examination framing, libertarian retributivism named coherent. D44 is closed.) | ✅ Live except D57 reframe (local, awaiting push) |
| Liminality (D41/D57): **family-level** - gap to best variant of nearest OTHER family, threshold 1.0. Prototype false-positives 58/60 -> 10/60; secondary always cross-family. Recalibrate at N=100+. | ⚠️ Implemented + validated locally, awaiting push |
| AI report (claude-sonnet-5, 2-call split - model verified in live `api/generate.js`/`api/chat.js` 2026-07-06; the sonnet-4-6 listed here before was stale, and the 4-6 to 5 migration was never logged in the vault) | ✅ Working |
| Email capture + Supabase | ✅ Working |
| Auth (Google SSO + email/password) | ✅ Live |
| Question explanations (all 160, neutrality-audited) | ✅ Live |
| Answer-order pinning (27 synthesis options) | ✅ Live |
| Shareable card (1080×1920, 9:16 story format - verified in live render code 2026-07-06; the 1080×2160 previously listed here and locked in Decisions Log P7 is stale, P7 needs a dated correction entry) | ✅ Working |
| Custom domain (phil-os.thelifepm.com) | ✅ Live |
| Free tier gating | ❌ Not built |
| Stripe payment | ❌ Locked until herbeoordeling |
| Sketch illustrations | ⚠️ 1/32 done (naturalism.png) |
| Full systematic end-to-end test | ❌ Not yet run |
| `t2m02` / `t3so04` rewrites | ✅ Live 2026-07-06 (D9 stems + matching explanation updates, verified serving in production) |
| Sonnet 5 pre-audit fixes (resume-shuffle bug, Conviction Strength rename, card footer, fingerprint labels, 34-to-32 typo, nav placement) | ✅ Pushed and live 2026-07-06 |
| Fable 5 A-Z audit | ✅ Audit stage complete; **Checkpoint A RULED (D40-D53), B batch LIVE, identity ruled (D52), governance doc standing (D50/D53)**. Phase 7 unblocked. Open: Phase 11 DB doc, Sonnet 6B run |

---

## TECHNICAL STACK

**Env vars (Vercel):** `ANTHROPIC_API_KEY` · `SUPABASE_URL` · `SUPABASE_SERVICE_KEY` · `RESEND_API_KEY`

**Critical syntax rule:** Apostrophes in JS single-quoted strings crash the app. Always double-quote strings containing apostrophes.

**Reversed scoring:** `ans = q.reversed ? (8 - rawAns) : rawAns` in `computeScores()`

**QA pre-fill:** `rawTarget = q.reversed ? (8 - target) : target`

---

## THE 32 AXES

Scoring: 1 = poleL, 7 = poleR, 4 = midpoint. 5 items/axis. _(Reversed items: the "2 reversed (40%)" previously stated here is stale - live bank is 52/160 = 32.5% aggregate, 1-4 per axis. See PSYCHOMETRIC STANDARDS below and Decisions Log D30; resolution deferred to the Fable 5 audit.)_

**T1 Foundations (weight 1.5):** naturalism · physicalism · realism · determinism · moral_ground · meaning

**T1.5 Structural (weight 1.5):** teleology · human_nature · epistemic_method · social_ontology · temporal_orientation · moral_authority · epistemic_humility

**T2 Derived (weight 1.0):** knowledge · science · freewill_practice

**T3 Applied (weight 1.0):** justice · ethics · religion · politics · self · moral_scope · meaning_practice · society · responsibility · identity · authority · economics · uncertainty · mind_consciousness · animal_ethics · progress

**Archetype SIG_AXES (13):** all T1 + all T1.5

---

## SUPABASE SCHEMA (v3)

**completions:** id · first_name · email · country · gdpr_consent · consented_at · archetype_family · archetype_variant · scores (jsonb) · fingerprint (jsonb) · contradictions_count · completed_at · source · qa_mode · report_json (jsonb) · instrument_version · axis_count · question_count

**responses:** id · completion_id · question_id · question_text · axis · tier · question_type · answer_value · answer_text · reversed · scored_value · weight · instrument_version · dev_flag · dev_note

**Also:** assessment_progress · account_completions · profiles · rate_limits · research_profiles · analytics_events

---

## NEXT PRIORITIES

0. **Phase 11: M1-M4 EXECUTED 2026-07-06 (D56/D59/D60, M4 batch below).** M1: all 7 Supabase advisor ERRORs gone. M2 (D59): RLS policy dedupe on profiles/account_completions. M3 (D60): consent_log + anon_progress tables, research_key column, report-metadata columns - all additive, zero new client grants (default-ACL risk caught and closed). M4: `/api/delete-account`, `/api/research-sync`, `/api/progress` built; capture.js + report.js hardened (origin-lock, column allowlist, rate limits, honest status codes, stale share domain fixed); My Account screen wired to real deletion + a real research opt-in toggle; 3 of 5 D55 interim-wording spots restored to accurate "delete via Settings" language now that deletion is real (email-modal "never sold" wording and the D2 privacy notice/processor naming stay as-is, pending Andre's approval of the draft privacy notice). **New required Vercel env var: `RESEARCH_KEY_PEPPER`** (HMAC secret for the revocable research key) - not yet set. **Known gap:** anon_progress/`/api/progress` exist server-side but the quiz flow does not yet generate a session id or call the endpoint - anonymous-respondent autosave wiring is still open. M5/M6 remain, each needs its own explicit go per D56. **D61: Andre amended ground rule 7 - Sonnet now pushes to GitHub and Vercel auto-deploys directly for Phil OS** (matches the Dutch OS workflow); every other governance rule (per-batch approval before writing, dash scans, node --check, one-strike UI protocol) stands unchanged. Andre still owes: leaked-password toggle (Dashboard > Auth > Passwords), the RESEARCH_KEY_PEPPER env var, and review of the draft D2 privacy notice. Phase 11 doc: vault 776 `Phil OS - Database Target Architecture (Phase 11)`. **Sonnet 5 sessions: your task list is the vault doc `Phil OS - Sonnet 5 Handover Brief` (776) - read it FIRST; it carries the UI one-strike protocol and the explicit-batch-approval rule.** **Fable sessions: Phase 7 rewrite is next** (against `FABLE5_PSYCHOMETRIC_STANDARD.md` + D45 scope, governed by [[Phil OS - Instrument Governance]]), then Phase 8 content, Phase 15 re-audit, and the two repro-required bugs (10i mobile sign-in, 10h dropdown - with Andre on a live device). Sonnet 6B brief (items 3-9) runs whenever Andre triggers it (i18n decision waits on it).
1. Full systematic end-to-end test of all 160 questions
2. Data-loss architecture fix for QA flags/responses
3. Free tier gating + D49's D1-D3 (account deletion, privacy notice, consent upgrade) - all block any marketing push
4. PhD endorsement outreach
5. Remaining 31 sketch illustrations
6. Monetise - post-herbeoordeling

---

## PSYCHOMETRIC STANDARDS

- Item-total correlation r ≥ 0.30 (post-launch, needs 300+ completions)
- Reversed items: agreeing = poleL = score 1 after 8 − raw
- α target per axis: ≥ 0.70 (needs 300+ completions)
- Option score range: max ≥ 5 (right pole), min ≤ 3 (left pole) on every tradeoff/scenario
- Normalisation: 5 items/axis, 2 reversed (40%), identical across all 32 axes **- flagged 2026-07-06 (see Decisions Log D30): this does not match the live question bank.** Direct parse shows 52/160 = 32.5% reversed in aggregate, but per-axis counts actually range 1-4 (20%-80%), not a uniform 2. Not corrected here - deferred to the Fable 5 psychometric audit to judge and resolve.

---

## LOCKED DECISIONS - DO NOT RE-LITIGATE

32 axes · 5 items/axis · 2 reversed/axis (40%) _(flagged 2026-07-06: this specific lock never matched reality - the uniform 64-flag state of 2026-05-26 included 15 wrong flags removed as scoring bugs on 2026-06-20 (D6); live distribution is uneven, resolution pending the Fable 5 audit per D30)_ · 160 questions · 60 archetypes · 13-axis engine · 1-7 Likert · Instrument v3 · 3-tier contradiction system · graduated strength · liminal threshold 1.0 · email hard gate · GDPR required · no monetisation until herbeoordeling · Supabase for data · Vercel hosting · Question explanations: neutrality-audited, gated by kill switch + per-user setting · Two-app model rejected

---

## VAULT DOCUMENTS

_(Paths corrected 2026-07-06: actual filenames on disk use plain hyphens, not em dashes - this section previously had em dashes that never matched the real filenames.)_

```
C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\
├── 771 - Product Strategy and Vision\
│   └── Phil OS - Product Snapshot.md
├── 772 - Architecture and Build\
│   ├── Phil OS - Architecture and Axis Map.md  <- source of truth on axes
│   └── Phil OS - Question Bank v3.md           <- canonical questions
├── 776 - Build Log and Decisions\
│   ├── Phil OS - Build Log.md                  <- open items + session log
│   ├── Phil OS - Decisions Log.md              <- every locked decision
│   ├── Phil OS - Scoring and Archetype Logic.md <- corrected 2026-07-06: this lives in 776, not 772 as previously listed here
│   ├── Phil OS - Full Psychometric and Philosophical Audit v3.md
│   ├── Phil OS - Psychometric Validity Audit.md and v2 Post-Fix
│   ├── Phil OS - Item Analysis and Question Standards.md
│   └── Phil OS - Council Analysis Summary.md   <- substantial prior audit history, not all captured above - browse the full folder
└── Phil OS - Master Index.md
```

**In `C:\philos\` itself (this repo, not the vault):** `FABLE5_AUDIT_PLAN.md`, `FABLE5_FACT_FINDING.md`, `SONNET5_FIXES_LOG_2026-07-06.md` - the current top-priority work, see NEXT PRIORITIES above.

---

## BUILD STANDARDS

- Production-ready only - no exceptions
- Validate every JS file with `node --check` before delivering
- Fix errors silently and note what was fixed
- Match existing code style exactly
- Never deliver unvalidated code
- Every session end: update Build Log + Decisions Log + Logic Log

## NEVER DO

- Re-litigate locked decisions without a new dated decision entry
- State psychometric facts, philosophical positions, or philo standards from memory - source from docs
- Build free tier gating or Stripe before herbeoordeling resolves
- Deliver unvalidated code
- Skip end-of-session vault doc updates

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
3. **Validate every file before delivering** - st.parse() for Python, 
ode --check for JS, json.loads() for configs.
4. **Three confidence tiers:**
   - ✅ **VERIFIED** - confirmed from a file read this session
   - 🔍 **RESEARCHED** - from official documentation checked this session
   - ⚠️ **INFERRED** - logical deduction - always flag, never state as fact
5. Fix errors silently and note what was fixed.
6. **Never agree with something wrong to avoid friction.**
---

## END OF SESSION - MANDATORY

1. Build Log: C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Build Log.md
2. Decisions Log (all new, dated): C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Decisions Log.md
3. Scoring/logic changes: C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS - Scoring and Archetype Logic.md _(corrected 2026-07-06: there is no separate "Logic Log.md" file - confirmed via a vault-wide search, no such file exists anywhere in the Phil OS folder. Scoring/logic changes go in this file instead. This item previously pointed to a file that never existed.)_
4. Master Index (if build state changed): C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\Phil OS - Master Index.md
5. Update this CLAUDE.md - current state table and next priorities

Session summary: DECISIONS MADE / TASKS COMPLETED / NEW TASKS / VERSION
