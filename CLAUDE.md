# Phil OS — Claude Code Context
_Instrument v3 | 32 axes | 160 questions | 60 archetypes | Live at phil-os.thelifepm.com_

---

## SESSION START

1. Read the full Project Instructions in `C:\Andre's 2nd brain\000 - Inbox\PHIL OS — Claude Project Instructions v3.0.md`
2. Read `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS — Build Log.md` — open items section
3. Check `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS — Decisions Log.md` before touching anything locked
4. Orient to current state from the Master Index before building

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

**Deploy:** Edit `index.html` locally → validate → GitHub Desktop push to `main` → Vercel auto-deploys.

---

## CURRENT STATE (as of 2026-06-25)

| Component | Status |
|---|---|
| 160 questions, 32 axes, 5 items/axis | ✅ Complete |
| 60 archetypes (12 families × 5 variants) | ✅ Complete |
| Archetype engine (13-axis Euclidean distance) | ✅ Complete |
| Contradiction engine (42–43 rules, graduated strength) | ✅ Fixed order-dependency bug 2026-06-22 |
| AI report (claude-sonnet-4-6, 2-call split) | ✅ Working |
| Email capture + Supabase | ✅ Working |
| Auth (Google SSO + email/password) | ✅ Live |
| Question explanations (all 160, neutrality-audited) | ✅ Live |
| Answer-order pinning (27 synthesis options) | ✅ Live |
| Shareable card (1080×2160) | ✅ Working |
| Custom domain (phil-os.thelifepm.com) | ✅ Live |
| Free tier gating | ❌ Not built |
| Stripe payment | ❌ Locked until herbeoordeling |
| Sketch illustrations | ⚠️ 1/32 done (naturalism.png) |
| Full systematic end-to-end test | ❌ Not yet run |
| `t2m02` / `t3so04` rewrites | ⚠️ Approved, not pushed |

---

## TECHNICAL STACK

**Env vars (Vercel):** `ANTHROPIC_API_KEY` · `SUPABASE_URL` · `SUPABASE_SERVICE_KEY` · `RESEND_API_KEY`

**Critical syntax rule:** Apostrophes in JS single-quoted strings crash the app. Always double-quote strings containing apostrophes.

**Reversed scoring:** `ans = q.reversed ? (8 - rawAns) : rawAns` in `computeScores()`

**QA pre-fill:** `rawTarget = q.reversed ? (8 - target) : target`

---

## THE 32 AXES

Scoring: 1 = poleL, 7 = poleR, 4 = midpoint. 5 items/axis, 2 reversed (40%).

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

1. Full systematic end-to-end test of all 160 questions
2. Data-loss architecture fix for QA flags/responses
3. Push the `t2m02`/`t3so04` question-stem rewrites (already approved)
4. Free tier gating — before any marketing push
5. PhD endorsement outreach
6. Remaining 31 sketch illustrations
7. Monetise — post-herbeoordeling

---

## PSYCHOMETRIC STANDARDS

- Item-total correlation r ≥ 0.30 (post-launch, needs 300+ completions)
- Reversed items: agreeing = poleL = score 1 after 8 − raw
- α target per axis: ≥ 0.70 (needs 300+ completions)
- Option score range: max ≥ 5 (right pole), min ≤ 3 (left pole) on every tradeoff/scenario
- Normalisation: 5 items/axis, 2 reversed (40%), identical across all 32 axes

---

## LOCKED DECISIONS — DO NOT RE-LITIGATE

32 axes · 5 items/axis · 2 reversed/axis (40%) · 160 questions · 60 archetypes · 13-axis engine · 1–7 Likert · Instrument v3 · 3-tier contradiction system · graduated strength · liminal threshold 1.0 · email hard gate · GDPR required · no monetisation until herbeoordeling · Supabase for data · Vercel hosting · Question explanations: neutrality-audited, gated by kill switch + per-user setting · Two-app model rejected

---

## VAULT DOCUMENTS

```
C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\
├── 771 - Product Strategy and Vision\
│   └── Phil OS — Product Snapshot.md
├── 772 - Architecture and Build\
│   ├── Phil OS — Architecture and Axis Map.md  ← source of truth on axes
│   ├── Phil OS — Question Bank v3.md           ← canonical questions
│   └── Phil OS — Scoring and Archetype Logic.md
├── 776 - Build Log and Decisions\
│   ├── Phil OS — Build Log.md                  ← open items + session log
│   ├── Phil OS — Decisions Log.md              ← every locked decision
│   ├── Phil OS — Logic Log.md                  ← every scoring/weighting change
│   └── Phil OS — Full Psychometric and Philosophical Audit v3.md
└── Phil OS — Master Index.md
```

---

## BUILD STANDARDS

- Production-ready only — no exceptions
- Validate every JS file with `node --check` before delivering
- Fix errors silently and note what was fixed
- Match existing code style exactly
- Never deliver unvalidated code
- Every session end: update Build Log + Decisions Log + Logic Log

## NEVER DO

- Re-litigate locked decisions without a new dated decision entry
- State psychometric facts, philosophical positions, or philo standards from memory — source from docs
- Build free tier gating or Stripe before herbeoordeling resolves
- Deliver unvalidated code
- Skip end-of-session vault doc updates

---

## WHO YOU ARE WORKING WITH

**Andre Beasley** — American expat, 49, Zaltbommel, Netherlands. **AuDHD** (ADHD + Autism) — interest-based nervous system, hyperfocus is a strength, initiation difficulty and time blindness are real. Hard determinist, atheist humanist, former evangelical pastor. Partner Manja (moved in June 2026). **Coeliac disease** — severe gluten/wheat allergy, non-negotiable.

On **WIA benefit (WGA-LAU)** — cannot earn KVK income until herbeoordeling resolves. No product revenue until cleared.

**Building under The Life PM:** Plaud Matrix v2 · SynapseOS · Phil OS · PiggyLog · ChoreOS · ManDre Meal Planner · memoir *No Choice But to Leave*

## HOW TO WORK WITH ANDRE

- **Direct and results-oriented.** Don't describe what should be done — do it.
- **No yes-manning.** Push back when wrong. Give real opinions. Be a thinking partner, not a validator.
- **No preambles.** Short declarative sentences. Get to the point.
- **One clarifying question maximum.** Make a reasonable assumption, state it, proceed.
- **Flag hyperfocus traps** — "This is solid. Before continuing — [X] is the actual bottleneck. Switch or finish first?"

## NO HALLUCINATION — HARD RULE

1. **Never state a fact you are not certain of.** If you don't know an exact path, method name, or field — say so and check the live file.
2. **Never invent code paths, function names, or data contract fields.** Verify against the project docs first.
3. **Validate every file before delivering** — st.parse() for Python, 
ode --check for JS, json.loads() for configs.
4. **Three confidence tiers:**
   - ✅ **VERIFIED** — confirmed from a file read this session
   - 🔍 **RESEARCHED** — from official documentation checked this session
   - ⚠️ **INFERRED** — logical deduction — always flag, never state as fact
5. Fix errors silently and note what was fixed.
6. **Never agree with something wrong to avoid friction.**
---

## END OF SESSION — MANDATORY

1. Build Log: C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS — Build Log.md
2. Decisions Log (all new, dated): C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS — Decisions Log.md
3. Logic Log (any scoring change): C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS — Logic Log.md
4. Master Index (if build state changed): C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\Phil OS — Master Index.md
5. Update this CLAUDE.md — current state table and next priorities

Session summary: DECISIONS MADE / TASKS COMPLETED / NEW TASKS / VERSION
