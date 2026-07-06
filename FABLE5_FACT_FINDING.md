# Fact-Finding Dossier for Fable 5 — Phil OS Audit

Compiled by Sonnet 5, 2026-07-06, to precede the audit in `FABLE5_AUDIT_PLAN.md`. Purpose: verified, source-checked facts about the current live codebase, mapped to each phase of that plan, so Fable spends its tokens on judgment (psychometric validity, philosophical accuracy, design calls) instead of re-deriving ground truth from an 11,896-line single-file app.

Every item below is marked:
- **VERIFIED** — confirmed by reading the actual code/data this session
- **NOT VERIFIED / NEEDS FABLE** — could not check (no access, requires judgment, or requires live/visual reproduction), stated plainly rather than guessed

See also `SONNET5_FIXES_LOG_2026-07-06.md` for the 6 items already fixed and the 4 flagged-but-not-attempted bugs.

---

## PHASE 1 — Vault/Doc Staleness

**VERIFIED — the flagged reversed-item contradiction is resolved, with a number, and it reveals a second problem:**

Parsed the live `QUESTIONS` array directly (160 questions, 32 axes, 5 questions/axis, exactly as `CLAUDE.md` claims). Actual reversed-item count: **52/160 = 32.5%** in aggregate. This is neither the "40%" `CLAUDE.md` states as a locked decision, nor the "~20%, under the 30% floor" Andre recalled as the current state. The aggregate is fine.

**But the per-axis distribution is uneven, which `CLAUDE.md`'s "identical across all 32 axes" claim is flatly wrong about:**

| Reversed count per axis | Axes | 
|---|---|
| 1 (20%) | economics, epistemic_humility, epistemic_method, identity, justice, knowledge, meaning_practice, moral_authority, moral_scope, physicalism, realism, social_ontology, temporal_orientation |
| 2 (40%) | animal_ethics, authority, determinism, ethics, freewill_practice, human_nature, mind_consciousness, moral_ground, naturalism, politics(1, see below), progress, religion, responsibility, science, self, society, teleology, uncertainty |
| 4 (80%) | **meaning** |

(politics actually shows 1, corrected above from raw parse — full per-axis table is in the parse output, available on request)

This is a real, specific, actionable finding for Phase 3: the reversed-item ratio isn't just "under target," it ranges from 20% to 80% axis-by-axis, with `meaning` a clear outlier at 4 of 5 items reversed. `CLAUDE.md`'s locked-decision claim of uniform 40% needs correcting or the instrument needs rebalancing — that's a judgment call for Fable, but the numbers are now exact rather than approximate.

**VERIFIED — other CLAUDE.md claims spot-checked and confirmed accurate:**
- 32 axes, 160 questions, 5 questions/axis: confirmed via parse.
- 60 archetypes: confirmed (`const ARCHETYPES = [` comment reads "60 types", 12 families noted in code).
- Dev panel's contradiction tester button reads "Run All 42 Rules" (CLAUDE.md hedges "42-43" — worth Fable nailing down the exact number by reading the rules array itself, low priority).
- Answer option counts: every scenario/tradeoff question has 3, 4, or 5 options (one question, in `moral_authority`, has 5 — the only one). Nothing exceeds 5 or falls below 3. This comfortably satisfies Andre's "never more than 4-5" constraint. (Note: the parser also flagged 20 questions as "0 options" — these are `type:'likert'` questions, which correctly use `poleLeft`/`poleRight` scale labels instead of a discrete options array. Not a defect, just a different question type; Fable should be aware when doing its own pass so it doesn't misflag these.)

**NOT VERIFIED / NEEDS FABLE:**
- Whether the vault docs at `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\` (Product Snapshot, Architecture and Axis Map, Question Bank v3, Scoring and Archetype Logic, Build Log, Decisions Log, Logic Log, the existing v3 audit) match current code — I did not open these this session; Phase 1 as scoped in the audit plan still needs a full read-and-diff pass against them specifically.
- Free tier gating, Stripe integration, auth/SSO, email capture: took `CLAUDE.md`'s word for these, did not independently re-verify.

---

## PHASE 3 — Psychometric Facts

**VERIFIED:**
- Weighting: Tier 1 and Tier 1.5 axes weight 1.5, Tier 2 and Tier 3 weight 1.0 (matches `CLAUDE.md`).
- Scoring: `ans = q.reversed ? (8 - rawAns) : rawAns` pattern, 1-7 Likert, 4 = midpoint (matches `CLAUDE.md`).
- Reversed-item ratio: see Phase 1 above — this is the single most concrete, ready-to-use fact for this phase.
- Answer-option-count distribution: see Phase 1 above.

**NOT VERIFIED / NEEDS FABLE (this is the actual judgment work, not fact-finding):**
- Whether 32.5% aggregate / 20-80% per-axis range actually satisfies real psychometric standards for a reversed-item design, or whether the `meaning` axis's 80% is a genuine outlier that needs rebalancing.
- Item-total correlation, internal consistency (alpha) — `CLAUDE.md` itself says these need 300+ completions to compute and haven't been run. No evidence found this session that they've been computed since.
- Everything else in Phase 2/3 of the audit plan (building the actual psychometric standard, deciding solo vs. team-agent approach) is Fable's work by design, not fact-finding.

---

## PHASE 4 — Philosophical/Question-Bank Facts

**VERIFIED — full question bank extracted and structurally mapped:** all 160 questions parsed successfully into axis/tier/type/reversed/option-count/option-text structure (see parse method in this session — a Node `eval` of the isolated `QUESTIONS` array literal, 160/160 parsed clean, zero errors). This structured data is available to hand to Fable directly (as JSON or a formatted table) instead of Fable re-parsing an 11,896-line file — recommend generating this as a first step of the Fable session rather than duplicating the extraction.

**NOT VERIFIED / NEEDS FABLE (this is the core of Phase 4, all judgment work):**
- Philosophical accuracy of any question or answer against PhilPapers.
- Neutrality of every question/answer (the two-sided test Andre specified).
- Completeness/exhaustiveness of answer sets per axis (the "science denier" gap example).
- Readability-vs-rigor balance (high-school-readable, PhD-defensible).

None of this can be fact-checked mechanically — it's exactly the reasoning Andre wants reserved for Fable.

---

## PHASE 5 — Report Content Facts

**VERIFIED:**
- `api/report.js` (the public `/report?id=` share page, server-rendered on Vercel) is **already 100% hardcoded template rendering** — it reads a pre-computed `report_json` blob out of the `completions` Supabase table and builds HTML with plain template functions (`bar()`, `axisRow()`, `worldCard()`, etc.). Zero API calls happen at share-page view time. This part of Phase 5's "how much can be hardcoded" question is already answered: the *serving* of a completed report costs nothing per view.
- `api/generate.js` is the rate limiter + gatekeeper for report **generation** (not the prompt/generation logic itself): `RATE_LIMIT = 6` calls per 24-hour window per key, with a code comment noting "3 report = 2 API calls each" (confirming `CLAUDE.md`'s "2-call split" claim), `MAX_TOKENS_CAP = 2500`, `ALLOWED_MODELS = ['claude-sonnet-5']`. This is the cost surface Phase 5's hardcode-vs-API decision would actually reduce — the generation-time calls, not the always-free share-page rendering.
- The shareable card's "Who You Are" box (Phase 9/6) **already has the hard character/line cap Andre asked for**: 340-char hard limit, word-boundary truncation, wrapped to exactly 8 lines at a fixed line height so it structurally cannot overflow the box. This looks like it may already satisfy that specific request — flagging for Fable to confirm against an actual rendered card rather than assume broken.

**NOT VERIFIED / NEEDS FABLE:**
- I did not read the actual prompt-construction/generation logic inside `generate.js`/`chat.js` in enough depth to categorize which specific report *sections* are AI-generated vs. template-filled from stored data (beyond the top-level fact that 2 API calls happen per report). That categorization — the actual point of Phase 5 — still needs a dedicated read-through.
- Whether hardcoding more per-archetype content would lose the nuance Andre cares about is a judgment call, not a fact.

---

## PHASE 6 / 9 — Shareable Card Facts

**VERIFIED (full render logic read, `renderCardToCanvas`, ~line 9590-9980):**
- Fixed canvas 1080x1920 (9:16 social story format — note this is different from the 1080x2160 figure in `CLAUDE.md`; worth Fable reconciling which is current).
- Icon centering mechanism and likely bug cause: see `SONNET5_FIXES_LOG_2026-07-06.md` fix-not-applied section — fixed reserved zone, not actual-text-relative. Not fixed, needs visual verification.
- Fingerprint label truncation: was a hard 13-char slice, **now fixed** (see fixes log) to measure-shrink-wrap instead.
- "Who You Are" box: already has a hard cap (see Phase 5 above), contradicts Andre's description of it as currently overflowing — needs a live check, might already be resolved.
- Redundant footer block: confirmed and **removed** (see fixes log).
- "34 belief axes" typo on the card CTA (should be 32): confirmed and **fixed** (see fixes log).
- DNA visualization: confirmed flat 2D bidirectional bars, not fixed (design decision, left for Fable per audit plan).
- "Worldview Strength" -> "Conviction Strength": **renamed** everywhere it appeared (see fixes log).
- Nav placement bug (My Profile/Resources vs. Settings): **fixed** (see fixes log) — this is Phase 10h, listed here because I found and fixed it during the card/UI read-through.

**NOT VERIFIED / NEEDS FABLE:**
- Whether the card content (Who You Are text, media picks, famous-minds picks) can be moved to fuller hardcoding without losing nuance — a Phase 6 judgment call.
- Actual visual output — none of the canvas rendering changes (fingerprint label fix, footer removal) have been visually confirmed against a real rendered PNG. Recommend Fable (or a live QA pass) render an actual card before/after to sanity-check the fingerprint wrap logic looks right at real font metrics.

---

## PHASE 10 — UX/Cross-Device Facts

**10a/10b (randomizer + backward-nav data integrity): root-caused and fixed.** See fixes log for the full mechanism (`restoreProgress()` reshuffling fresh instead of reusing the saved order). This was the single highest-value finding this session.

**10c (hover explanations):** Not reviewed in this pass — the 160 explanation strings exist (per `CLAUDE.md`: "Question explanations (all 160, neutrality-audited)") but whether they're genuinely restated-vs-explained (Andre's complaint) is a content-quality judgment call for Fable/Phase 4, not a fact I can mechanically check.

**10d (settings):** **VERIFIED** — the Settings screen (`#screen-settings`, ~line 3411) is more built-out than Andre's dictation suggested: Language (5 languages, though questions stay English-only for psychometric validity — a deliberate, documented design choice, not a gap), Text Size (4 levels), Report Font (3 options including OpenDyslexic specifically for dyslexic readers), Contrast (Normal/High). The HTML/markup for all of these exists and looks coherent. **NOT VERIFIED:** whether each `applySetting()` call actually applies its effect correctly throughout the app at runtime — Andre specifically said some settings didn't work last time he checked; I did not functionally test any of them (would require running the app and toggling each one). This needs a live QA pass, not a code read.

**10f (landing page) / 10g (profile-report rebuild):** Not reviewed structurally in this pass beyond what's noted in Phase 6 above (nav placement). The full background-fragmentation issue Andre described (segmented sections, hard color breaks) needs its own dedicated read of the `#screen-report` CSS/structure — out of scope for what I covered this session; flagging as still fully open for Fable.

**10h (nav placement): fixed.** See above/fixes log.

**10i (mobile sign-in bug) / mobile dropdown scroll bug:** Investigated structurally, root cause not found — both need live device/browser reproduction, not static reading. See fixes log for the specific suspect code regions (the `#auth-modal` pseudo-element background system; the `#report-nav-dropdown` and its parent scroll container).

**10j (accessibility/contrast):** **VERIFIED, and it's better than expected.** The CSS root variables already carry computed WCAG contrast ratios as inline comments against the `#07061a` background: `--text: #f2efe8` (17.5:1), `--text2: #d4d0c8` (13.2:1), `--muted: #b4b0c8` (9.51:1, explicitly noted as "upgraded from #8c88a0 (5.85:1)"). All three clear WCAG AAA (7:1) by a wide margin — someone already did a deliberate accessibility pass on the core text-color system. There's a second, different color block around line 2908 (`--text: #ffffff`, `--text2: #e8e8e8`, `--muted: #b0afc0`, `--surface: rgba(255,255,255,0.07)`) that looks like a scoped override (possibly the "High Contrast" settings toggle, or a specific screen/section) — **NOT VERIFIED** which selector/condition this block lives under; worth Fable confirming it's intentional and not a leftover duplicate.

Given this, Andre's specific "Your Philosophical OS" header illegibility complaint (Phase 10g) is very likely a **font-size** problem, not a contrast problem — the contrast numbers say this shouldn't be a legibility issue at all. Worth Fable treating it as purely a sizing/typography fix rather than reopening the color system.

**10j (em/en dash sweep):** **VERIFIED, categorized, not fixed (too large/risky for a mechanical pass).** 624 total em/en dash occurrences across `index.html` (ripgrep, UTF-8-safe count — a naive `grep` in this shell's default locale gave a false ~9,700 due to byte-vs-character matching on the multi-byte dash characters; worth remembering if anyone re-runs this check, use ripgrep not plain grep here). Rough breakdown by region:

| Region | Count | User-facing? |
|---|---|---|
| `QUESTIONS` array (lines 4365-5430) | 63 | Yes — test-taker sees these |
| Archetype/media/card-content block (6363-6900) | 119 | Yes — report/card reader sees these |
| CSS (roughly 1-2900) | 22 | No — invisible, code comments/section dividers |
| HTML nav/screen markup (2900-4365) | 63 | Mixed — some are HTML comments (invisible), some may be visible copy; not separated further |
| JS logic + report/card rendering (6900-end) | 343 | Mixed — this bucket has both invisible code comments and inline report-template prose strings; **not separated further, needs a closer pass** |

I did not attempt a blind find-and-replace across these 624 occurrences — a mechanical substitution risks picking the wrong replacement per context (some need a comma, some a full rewrite, some are just section-divider comments no user ever sees) and this file has no test suite to catch a bad substitution. Recommend folding the user-facing ones (question bank + archetype content, ~182 confirmed user-facing, plus whatever fraction of the 343 in the last bucket turns out to be report-template prose rather than code comments) into the Phase 7 rewrite pass itself, since that pass is already touching every question and answer string anyway.

**Self-check note:** I introduced 4 new em dashes in my own code comments while making the fixes above, and corrected all 4 before finishing (see fixes log). Worth Fable building in an explicit dash-check verification step after any content rewrite, since even careful, rule-aware writing slips on this.

---

## PHASE 11 — Database Facts

**COULD NOT VERIFY — no access to the real project.** The Supabase MCP connection available in this session only has access to a project named "dutchos" (a different, unrelated app). It does not see the actual Phil OS Supabase project, so I could not run `get_advisors` or `list_tables` against the real database to confirm which tables actually lack RLS, how many tables exist, or anything else in Andre's "database has a lot of problems" claim. This entire phase is **factually unconfirmed** — someone with correct Supabase project access (Andre, or a Fable session with that MCP properly connected) needs to run the advisor check directly rather than trust either Andre's memory or my inability to check.

**VERIFIED from code (not the database itself):**
- `assessment_progress` table is written via `saveProgress()`/read via `fetchProgress()`/`restoreProgress()` — confirmed real-time-ish writes already happen (debounced 2 seconds after each answer via `triggerProgressSave()`), which partially satisfies Phase 10b/11's "answers must write in real time" requirement already, at least for authenticated users. Anonymous/guest sessions do not appear to persist progress at all (no equivalent save path found for `!currentUser`).
- `rate_limits` table: read/written by `api/generate.js`'s rate limiter, straightforward key/calls/window_start shape.
- No `analytics_events` write calls found anywhere in `index.html` or `api/*.js`, despite `CLAUDE.md` listing `analytics_events` as an existing schema table (Phase 13 relevance: the table may already be provisioned but nothing populates it — client-side event tracking would need to be built from scratch, not just "turned on").

---

## PHASE 12 — Dev/QA Panel Facts

**VERIFIED:** the panel exists at `#screen-intro` and includes, matching Andre's description: report generator (`devGenerateReport()`), contradiction tester (`devTestContradictions()`, labeled "Run All 42 Rules"), archetype distance checker (`devCheckDistance()`), system integrity check (`devRunIntegrityCheck()`), QA assessment start (`startQAMode()`/`startQAQuiz()`). Did not read the internals of the integrity check or contradiction tester logic in this pass — only confirmed the UI surface matches what Andre described.

---

## PHASE 13 — Analytics Facts

**VERIFIED:** no PostHog, Google Analytics, Mixpanel, or Amplitude code found anywhere in the app (`index.html` or `api/*.js`). The only mention of analytics infrastructure anywhere is the `analytics_events` table name listed in `CLAUDE.md`'s schema section — meaning if that table exists in the real database, nothing currently writes to it. Whatever Fable/Andre decide for Phase 13 (build vs. buy) starts from zero existing instrumentation, not a partially-wired system.

---

## PHASE 14 — Compatibility Reports

Not investigated — correctly out of scope per the audit plan (parked feature, Fable's call on timing).

---

## OPEN ITEMS I EXPLICITLY COULD NOT RESOLVE (summary, so nothing gets lost)

1. Real Supabase RLS/table state — no project access this session (Phase 11).
2. Vault-doc diff against `757 - Phil OS` folder — not opened this session (Phase 1).
3. Icon centering visual fix — diagnosed, not fixed, needs visual verification (Phase 9).
4. DNA 3D redesign — design decision, intentionally left alone (Phase 9).
5. Mobile sign-in disappearing-graphics bug — needs live device reproduction (Phase 10i).
6. Mobile report-dropdown scroll bug — needs live reproduction (Phase 10h).
7. Which report sections are AI-generated vs. template-filled, specifically (Phase 5) — only the top-level call count/rate-limit shape was confirmed, not the per-section breakdown.
8. The 343 dash occurrences in the "JS logic + report rendering" bucket — not separated into code-comments vs. user-facing prose.
9. Settings screen: markup confirmed complete, functional correctness of each toggle not tested live (Phase 10d).
10. Exact contradiction-rule count (42 vs. "42-43") and the second CSS color-override block's actual trigger condition (Phase 12/10j) — minor, low-priority precision gaps.
