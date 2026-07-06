# Phil OS — Full A-Z Audit and Rebuild Plan (for Fable 5)

_Compiled from Andre's full dictation, 2026-07-06. Reordered into an executable sequence. Nothing from the source dictation has been dropped — only reorganized. Read this whole document before starting. Read `C:\philos\CLAUDE.md` immediately after — it is the live source of truth for current build state, file locations, and locked decisions._

---

## READ THESE TWO DOCUMENTS BEFORE STARTING ANY PHASE

Between this plan being written and Fable's session starting, Andre had Sonnet 5 do a pre-audit pass: fix everything fixable with full confidence (pure engineering, zero psychometric/philosophical judgment), and run a fact-finding sweep across the rest of this plan so Fable isn't spending tokens re-deriving ground truth from an 11,896-line single-file app. Both documents live next to this one in `C:\philos\`:

- **`SONNET5_FIXES_LOG_2026-07-06.md`** — 6 things already fixed in `index.html` (not yet pushed/deployed), plus 4 things found but deliberately left alone because they need visual/live verification Sonnet couldn't do from static code. Read this so Fable doesn't redo work that's already done, and doesn't waste time rediscovering bugs already root-caused.
- **`FABLE5_FACT_FINDING.md`** — a phase-by-phase dossier of verified facts (exact numbers, exact line references, exact mechanisms) mapped to this plan, clearly marked VERIFIED vs. NOT VERIFIED/NEEDS FABLE. Several phases below have inline notes pointing back to specific findings in it. This does not replace the audit — none of the judgment calls (psychometric validity, philosophical accuracy, neutrality, design decisions) have been made. It just means the mechanical groundwork (parsing the question bank, counting reversed items, locating bugs, checking what's already hardcoded) doesn't need to happen twice.

The inline notes below, marked **[PRE-AUDIT, 2026-07-06]**, point to the specific relevant finding in those two docs. Everything else in this plan is unchanged from the original dictation-derived version.

**One more thing, found during session closeout, after the two docs above were already written:** `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\` already contains substantial prior audit history that Phase 1/2 should read before building anything from scratch - `Phil OS - Psychometric Validity Audit.md`, `Phil OS - Psychometric Validity Audit v2 Post-Fix.md`, `Phil OS - Full Psychometric and Philosophical Audit v3.md`, `Phil OS - Item Analysis and Question Standards.md`, `Phil OS - Question Bank v2 Cross-Check Report.md`, `Phil OS - Audit Findings vs Q Bank v2 Compliance.md`, `Phil OS - Council Analysis Summary.md`. Multiple audit rounds have already happened (v1, v2, v2-post-fix, v3) - there may be real reusable groundwork for Phase 2's psychometric standard rather than a blank-slate build. This wasn't accounted for when this plan was first written.

---

## 0. THE STAKES — HOLD THIS THE ENTIRE TIME

Phil OS has the potential to be to philosophy what the Human Genome Project was to biology and genetics. It is not a personality quiz. The output of this audit could be historical, could help millions of people understand themselves, and could have a real impact on the science and study of philosophy. Andre's own words: he wants this treated with the seriousness of a life's-work validation instrument, not a product feature pass.

For this entire engagement, Fable 5 is acting as **both**:
- The world's best psychometrician — someone who has devoted their life to instrument validation, reliability, item response theory, and scale construction.
- The world's best philosopher — someone who has devoted their life to the discipline, for whom PhilPapers-level rigor is the baseline, not the ceiling.

Both roles must be held simultaneously and made to work together, because the 32 axes only work if the psychometrics (weighting, reversed-item balance, distribution, archetype math) and the philosophy (accuracy, neutrality, completeness of every position) are correct **at the same time**.

---

## GROUND RULES (apply to every phase below, not just one)

1. **Audit before action.** The full audit (Phases 1-6) must be completed, documented, and discussed with Andre before any rewriting, rebuilding, or UX work begins. This is non-negotiable — Andre wants to see where everything stands before touching anything.
2. **Grade everything A-F.** Every audited domain — psychometrics, philosophy, UX — gets a letter grade with rationale. This applies both to the initial audit and to the re-audit after the rebuild, so Andre can see exactly what changed.
3. **Document comprehensively.** Whatever is done — no changes, minor modifications, or a complete rewrite of the question bank — must be fully and comprehensively documented. This includes updating `Phil OS — Build Log.md`, `Phil OS — Decisions Log.md`, and `Phil OS — Logic Log.md` per the existing end-of-session protocol in `CLAUDE.md`.
4. **Neutrality is absolute.** Nothing in the instrument may lean toward any political position, religious position, or philosophical school — including Andre's own personal views (he is an atheist, anti-theist, hard determinist). A highly religious libertarian-free-will respondent must be able to read every question and never feel judged, exactly as a determinist atheist must not feel judged. Questions must never read as accusations or "gotchas."
5. **No detectable AI writing anywhere.** No em dashes, no en dashes, anywhere in the app — questions, answers, explanations, reports, cards, settings, everything. Use hyphens, commas, and normal human sentence construction. This must read as if a human wrote it. (Consistent with Andre's standing hyphen-only rule.)
6. **Accessibility and readability everywhere.** Every piece of text in the app must pass contrast/disability readability checks while still looking aesthetically polished. Varied type scale (headers, subheaders, body) is desired and good — illegible text is not, ever.
7. **Cross-device correctness.** Every screen must work and look centered/correct on PC, Mac, phones, foldables, and tablets, at every size.
8. **Aesthetic preserved, execution polished.** Andre loves the current aesthetic direction — the layered background, colored floating orbs, glows, floating constellations/nodes/lines, the overall color scheme. None of that direction changes. What changes is polish, consistency, professionalism, and fixing places where it currently breaks or looks fragmented.

---

## PHASE 1 — Vault Documentation Audit (Phil OS first)

Andre wants a vault-wide stale-documentation cleanup eventually, but this pass is scoped to Phil OS only.

1. Read every Phil OS vault document against the live `C:\philos\` codebase:
   - `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\771 - Product Strategy and Vision\Phil OS — Product Snapshot.md`
   - `...\772 - Architecture and Build\Phil OS — Architecture and Axis Map.md`
   - `...\772 - Architecture and Build\Phil OS — Question Bank v3.md`
   - `...\772 - Architecture and Build\Phil OS — Scoring and Archetype Logic.md`
   - `...\776 - Build Log and Decisions\Phil OS — Build Log.md`
   - `...\776 - Build Log and Decisions\Phil OS — Decisions Log.md`
   - `...\776 - Build Log and Decisions\Phil OS — Logic Log.md`
   - `...\776 - Build Log and Decisions\Phil OS — Full Psychometric and Philosophical Audit v3.md` (the prior audit — read for history, do not treat as current truth)
   - `Phil OS — Master Index.md`
   - `C:\Andre's 2nd brain\000 - Inbox\PHIL OS — Claude Project Instructions v3.0.md`
   - `C:\philos\CLAUDE.md`
2. For every piece of information that is stale (true once, no longer true), flag it in place in the note rather than deleting it — mark it clearly as stale and note what the current/updated information actually is.
3. If an entire note is stale, mark the whole note as stale.
4. **Known live contradiction, already resolved with real numbers — [PRE-AUDIT, 2026-07-06, see `FABLE5_FACT_FINDING.md` Phase 1]:** `CLAUDE.md` lists "2 reversed/axis (40%)" as a locked decision and current state, and Andre's dictation recalled it being walked down to 1 per axis (20%). Neither is what the live question bank actually contains. Sonnet 5 parsed the full 160-question array directly: **52/160 = 32.5% reversed in aggregate**, but the per-axis distribution is uneven and `CLAUDE.md`'s "identical across all 32 axes" claim is simply false — counts range from 1 reversed item (20%) up to 4 reversed items (80%, the `meaning` axis is the outlier) per axis, with most axes at 1 or 2. The aggregate isn't the problem; the axis-by-axis inconsistency is. This is now a judgment call, not a fact-finding task: decide whether `meaning` at 80% needs rebalancing and whether `CLAUDE.md`'s locked-decision text needs correcting to describe the real (uneven) distribution.
5. This cleanup is the foundation for everything else — Phases 2 onward depend on knowing what is actually true right now versus what is documented.

---

## PHASE 2 — Build the Psychometric Standard (new document)

Before auditing the instrument, define precisely what a real psychometrician would require to validate it — exact terminology, exact formulations, exact formulas, exact methods. This is not a paraphrase of psychometric theory; it must be the real methodology a working psychometrician would apply.

1. Create a **new document** for this audit (do not overwrite the v3 audit doc — this is a fresh pass). Suggested location: `C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\776 - Build Log and Decisions\Phil OS — Full Psychometric and Philosophical Audit v4.md`, alongside a companion working file `C:\philos\FABLE5_PSYCHOMETRIC_STANDARD.md` if useful for the live working session.
2. Decide and state up front: **should this audit run as a single Fable agent working sequentially through psychometrics then philosophy, or as multiple agents (a psychometrician persona and a philosopher persona) working in tandem, communicating with each other question-by-question and then on the big-picture architecture (weighting, formulas, the 32-axis system as a whole)?** Andre has explicitly left this decision to Fable. State the chosen approach and the reasoning before proceeding.
3. Define the target psychometric outputs — what the instrument needs to produce at the end to be considered valid (reliability targets, item discrimination, reversed-item ratio, distribution properties, etc.) using real psychometric standards. This becomes the reverse-engineering target for Phase 7.

---

## PHASE 3 — Psychometric Audit of the Current Instrument

Full, rigorous, complete audit against the standard defined in Phase 2 — the level of rigor the best psychometrician in the world would apply. Cover at minimum:

- Reversed-item ratio: use the real numbers from Phase 1 (52/160 = 32.5% aggregate, 20-80% per-axis range, `meaning` axis at 80%) rather than re-deriving them, and judge whether this distribution actually satisfies real psychometric standards for a reversed-item design, or whether `meaning` specifically needs rebalancing.
- Item weighting and scoring formulas across all 32 axes — verify the math is correct and internally consistent. **[PRE-AUDIT, 2026-07-06]** Tier weighting (1.5 for Tier 1/1.5, 1.0 for Tier 2/3) and the reversal formula (`8 - rawAns`) were spot-checked against the live code and match `CLAUDE.md` — treat as confirmed, not something to re-derive from scratch.
- Answer-option counts per question (Andre wants 4-5 max, never more — confirm the current 160-question / 32-axis / 5-questions-per-axis structure holds this line everywhere). **[PRE-AUDIT, 2026-07-06]** Already checked: every scenario/tradeoff question has 3-5 options (one question, in `moral_authority`, is the only 5-option question; nothing exceeds 5 or falls below 3). Likert-type questions correctly show 0 in a naive options-array count since they use pole labels instead — don't misflag those as a gap.
- Whatever else a real psychometric validation would require (item-total correlation, internal consistency targets, distribution/normalization behavior, etc.) per the standard built in Phase 2.
- **Grade the current instrument A-F on psychometric rigor**, with rationale.

---

## PHASE 4 — Philosophical Audit of Every Question and Answer

Read through all 160 questions and every answer option.

**[PRE-AUDIT, 2026-07-06]** The full question bank has already been mechanically parsed clean (160/160, axis/tier/type/reversed/option-count/option-text structure) — see `FABLE5_FACT_FINDING.md` Phase 4. Nothing about the parsed structure resolves the actual judgment work below (accuracy, neutrality, completeness are not mechanically checkable), but it means Fable can work from a clean structured extraction instead of re-parsing the raw 11,896-line file if that's useful to request at session start.

1. **Accuracy.** Every question and answer must be correct and defensible according to the actual philosophy, using PhilPapers as the gold standard.
2. **Readability vs. rigor balance.** Questions and answers must be understandable by a high school student while remaining rigorous enough to satisfy a PhD philosophy student. No jargon in the questions or answers themselves — jargon belongs only in the reports, where it can be hover-defined. Every question needs a clear description of the actual real-world situation, problem, or issue underneath the philosophical concept. Questions and answers must be readable, understandable, and accurate — in that order of checking, all three required.
3. **Completeness per axis.** Answers must give full, complete, exhaustive representation to every relevant position/archetype on that axis — no dominant view left unrepresented. Example of a past gap: a "what is science?" question offered "best current explanation," "explains some things but not everything," and a near-duplicate of that second option — but nothing representing outright science denial, which is a real position that exists and needs weight. Every question needs this kind of completeness check.
4. **Answer-count constraint.** Never more than 4-5 answers per question. Completeness must be achieved within that constraint, not by adding a 10-option question — the weighting across 160 questions / 32 axes / 5 questions-per-axis is what carries the completeness, not option count.
5. **Neutrality.** No question or answer set may lean toward any philosophical, political, or religious position, including Andre's own. Apply the two-sided test explicitly: would a hard determinist atheist and a libertarian-free-will religious respondent both read this question and answer set as neutral, with neither feeling judged? If not, it fails.
6. For every question: if it's fine as-is, leave it. If it needs modification, modify it. If it needs a full rewrite, rewrite it. All three outcomes are acceptable — the requirement is that each one is documented.
7. **Grade the current question bank A-F on philosophical rigor and neutrality**, with rationale.

---

## PHASE 5 — Report Content Audit

Before finishing the audit stage, fully audit the generated report (this was called out separately from the Q&A audit and must not be skipped).

1. Assess what the report is doing well and what it is doing poorly.
2. Determine what could be hard-coded per axis instead of generated live. If an axis's report content can be 100% hard-coded with no API call, that's the target. If some content genuinely needs AI generation, that's acceptable too. **[PRE-AUDIT, 2026-07-06, see `FABLE5_FACT_FINDING.md` Phase 5]** Some of this is already answered: the public share page (`api/report.js`) is already 100% hardcoded template rendering of a stored `report_json` blob, zero API cost per view. The actual cost surface is generation time only — confirmed 2 Claude Sonnet 5 calls per report, rate-limited to 6 calls/24hr per key (~3 reports), 2500 token cap. What was NOT determined: which specific report sections inside that generation step are AI-written vs. template-filled — that categorization still needs a real read of `generate.js`/`chat.js` and is squarely Fable's work.
3. Consider that there are 32 axes plus family/sub-family groupings (roughly 60 combinations between archetype families and sub-family variants per the current 12-families-by-5-variants structure) — this may be small enough a space to hard-write nearly everything: beliefs, how they see the world, jobs/volunteer work, ways they can change the world, growth patterns, etc.
4. The constraint that matters most: **no nuance lost.** The report must still produce an "oh shit, this is me" moment — real insight into how the person sees the world, themselves, and others, and why they are the way they are. If full hard-coding would flatten that nuance, a hybrid approach (mostly hard-coded, with targeted API-generated nuance layered in) is the better call. Decide which approach actually holds up and state the reasoning.
5. Economics matter: fewer API calls is better for cost, but never at the expense of evaluation or report quality.
6. **Grade current report content A-F** on accuracy, depth, and hardcoding efficiency, with rationale.

---

## PHASE 6 — Shareable Card Audit

Audit the current shareable card as its own item (separate from the full report).

1. Assess current viral/shareability effectiveness — the goal is a serious hook that makes other people want to take the evaluation themselves (see their archetype, their "DNA," their fingerprint, people who think like them, etc.).
2. Determine how much of the card content can be hard-coded the same way as the report, for the same cost/nuance tradeoff reasons.
3. **Grade current shareable card A-F** on shareability, content quality, and technical execution (see Phase 9 for the specific rendering bugs to fix — **[PRE-AUDIT, 2026-07-06]** several of those bugs are already fixed, see below and `SONNET5_FIXES_LOG_2026-07-06.md`).

---

## PHASE 6B - System Surfaces Audit (added 2026-07-06, after Fable's gap review; Andre approved the split below)

Nine system-edge items the original dictation did not cover. Division of labor mirrors the pre-audit pattern that worked: **Sonnet 5 runs the mechanical items and inventories first** (fixes-log + fact-finding dossier format, same as `SONNET5_FIXES_LOG_2026-07-06.md` / `FABLE5_FACT_FINDING.md`), then **Fable does the two judgment audits on top of Sonnet's dossier.**

### Sonnet 5 brief (run as one session, document as `SONNET5_PHASE6B_LOG_<date>.md` + dossier additions)

1. **GDPR inventory (fact-finding only, no judgment):** map every flow of respondent data - what exactly is stored in each Supabase table (including full belief scores, responses, report_json), what is sent to the Anthropic API per call (verbatim prompt payload shape), what goes to Resend, what the public share page exposes. Extract the verbatim current consent text from the onboarding modal and the gdpr_consent flow (Andre confirms consent is captured and stored in the database - the question is whether its wording and scope are robust for GDPR Article 9 special-category data, which religious/philosophical beliefs are). Also list current deletion/export capabilities (is there any right-to-erasure path?). Hand the full inventory to Fable - do NOT redesign consent language.
2. **AI chat inventory (fact-finding only):** extract the full `api/chat.js` prompt and mechanics (rate limits, model, where it is exposed in the UI). **Status decision by Andre 2026-07-06: the chat feature is a backlog candidate - he wants it eventually but likely lacks the data foundation now.** So the inventory should also answer: what breaks if the endpoint is disabled or gated behind the dev flag until the feature is properly built? An exposed live LLM endpoint that the product does not surface is pure cost/abuse surface - recommend gating it in the interim and note the one-line change needed. Fable's full neutrality/safety audit of chat moves to the backlog WITH the feature; it must run before the chat ever ships to users.
3. **Monitoring/alerting:** add error alerting + uptime monitoring (the 4-day sonnet-4 retirement outage is the proof case). Vercel log drains, a simple external uptime ping, and alerting on report-generation failures. Full confidence work - implement, do not just recommend.
4. **Quota/scale arithmetic:** one page of numbers - Supabase free-tier rows (responses grows 160/completion), Vercel hobby limits, Resend quota, Anthropic spend per report; identify which ceiling is hit first and at what completion count.
5. **Email + share page surfaces:** extract the Resend email template and `api/report.js` HTML for the content-pass inventory (dash count, wording); check and fix OG/meta tags on the share page so shared links unfurl with an image (this is viral-loop infrastructure, full-confidence fix).
6. **Accessibility mechanics:** keyboard navigation through the full 160-question flow, ARIA/semantics on interactive elements, focus management. Fix what is unambiguous; list what needs design judgment for Phase 10.
7. **Performance:** measure real load (single ~600KB index.html) on throttled mobile; report metrics and the cheapest wins (compression, font loading, split candidates) without restructuring the app (A9 stays locked).
8. **i18n reality check:** does the 5-language UI setting actually translate anything? If it is a dead toggle, report exactly what exists vs promised; decision (translate vs remove languages) goes to Andre at Checkpoint A.
9. **Licensing:** gather MFQ-2 usage terms, OpenDyslexic license, and any claim-substantiation risks in "based on science" copy for the pre-monetisation review. Facts only; the risk call is made on top of the findings.

### Fable follow-up

**UPDATE 2026-07-06 (same day, after Andre pulled these forward): items 1 and 2 are DONE by Fable directly** - findings P6B-1 to P6B-3 in `Phil OS - Full Psychometric and Philosophical Audit v4.md`, grade D on data-protection readiness (broken deletion promise in live consent copy; no Art. 13 privacy notice). Headlines: chat endpoint is auth-gated and rate-limited but has NO frontend surface - gate it behind an env flag until it ships, and its pre-ship fix list (crisis protocol, neutrality clause, 21-of-32 axis reference, server-side context) is documented; GDPR needs real erasure built, a privacy notice, Art. 9 consent wording, and the "never sold or shared" line reworded to accommodate the research program. **New requirement recorded: separate default-OFF research-use opt-in consent (de-identified scores/age/gender/country to accredited researchers), toggleable in Settings, stored in Supabase with version + timestamp - the empty `research_profiles` table is the intended vehicle. Feeds the Phase 11 DB design and the consent redesign.**

Sonnet 5's brief above now covers items 3-9 only (the two inventories in items 1-2 are no longer needed - done).

---

## CHECKPOINT A — Discuss Findings Before Any Rebuild

Present all Phase 1-6 findings and grades to Andre. Discuss what's staying as-is, what's being modified, and what's getting a full rewrite. Do not proceed to rebuild work until this discussion happens.

---

## PHASE 7 — Rewrite the Question Bank and Answers

Once the psychometric standard (Phase 2) and philosophical requirements (Phase 4) are both nailed down, the rewrite is **reverse-engineered from the desired psychometric result**, not written question-first:

1. Lock in what the psychometric test needs to produce at the end (the target outputs defined in Phase 2).
2. Build/rewrite the actual questions and answers backward from those target results, so the results are the source of truth and everything else is built to support them accurately, robustly, and rigorously.
3. Every question must still pass the Phase 4 philosophical bar (accuracy, readability/rigor balance, neutrality, completeness within 4-5 answers) at the same time as the Phase 2/3 psychometric bar. Neither discipline overrides the other — they must both check out simultaneously per question and in aggregate.
4. Explicitly resolve the reversed-item ratio finding from Phase 1/3 as part of this rewrite.
5. Fully document every change (per the Ground Rules — Build Log, Decisions Log, Logic Log).

---

## PHASE 8 — Rebuild Report Content

Execute whatever architecture was decided in Phase 5 (hard-coded, hybrid, or otherwise) against the finalized Phase 7 question bank and archetype outputs. Preserve nuance as the hard constraint.

---

## PHASE 9 — Rebuild the Shareable Card

Full overhaul, addressing both the strategic findings from Phase 6 and the specific execution bugs Andre has already identified:

1. **Hook and shareability.** Make it a genuine viral hook — people should want to see their archetype, their belief "DNA," their fingerprint, the media/thinkers they resemble.
2. **Hard-code as much as possible**, consistent with the Phase 6 decision, without losing nuance.
3. **DNA visualization.** Currently a flat 2D bar rendering. Give it a more 3D look/feel while still clearly representing all 32 axes and their relative strength. If a true 3D rendering isn't feasible, get as close to that visual effect as possible in 2D.
4. **"Who You Are" box.** Ideally hard-written per archetype/sub-family combination (preserving nuance, per Phase 5/6 decision). If that can't fully replace the API-generated version, then hard-cap the content: determine the actual max lines/characters the box can hold without cutoff or overflow, and constrain the generation (API max character count set just under that true max) so it always fits. This is a hard requirement either way — text must never cut off or overflow this box. **[PRE-AUDIT, 2026-07-06]** This cap may already exist: the code has a 340-character hard limit, word-boundary truncation, wrapped to exactly 8 lines, which looks structurally sound. Confirm against an actual rendered card before assuming it's still broken — it's possible this was already fixed since Andre last looked.
5. **Icon placement.** The archetype icon currently sits off to the edge and gets cut off. It must be centered between the text box edge and the trailing edge of the actual text, consistently across every archetype/family/variant card (all ~60+ combinations). **[PRE-AUDIT, 2026-07-06, not fixed, needs Fable]** Root mechanism diagnosed, not corrected: the icon centers within a fixed reserved zone sized for the longest possible name, regardless of the actual rendered name's width, and its glow ring (radius up to 1.1x icon size) may bleed into the block's clip edge for names that push close to that zone — which would read as exactly the "cut off" Andre described. Sonnet 5 didn't fix this because it couldn't be visually verified without rendering an actual card. Exact code location and reasoning in `SONNET5_FIXES_LOG_2026-07-06.md`.
6. **Stat labels.**
   - "Worldview rarity" (top X%) stays — Andre calls this a must-have, a genuine hook.
   - Rename "worldview strength" to **"conviction strength"** (an earlier version used this wording and Andre prefers it). **[FIXED, 2026-07-06]** Done in all 3 places it appeared (card label, in-app report tooltip + description, code comment).
   - "Tensions found" — likely keep, tied to the contradiction engine. Consider adding a short blurb explaining what a tension actually is in this context.
7. **Fingerprint section.** Shows the top 5 axes furthest from center — good concept, broken execution: axis names are currently abbreviated and cut off (examples seen: "epistetic," "epistetic met," "knowledge sow," "social ontolo"). Names must never be truncated illegibly. Stack the label across two lines if needed, or find whatever layout keeps the full, readable axis name while still fitting the card. **[FIXED, 2026-07-06]** Root cause confirmed exactly (a hard 13-character slice, which is precisely what produced Andre's transcribed examples). Replaced with a measure-then-shrink-then-wrap approach: full label at 21px, retry at 17px if it doesn't fit, wrap to a second line at 15px as a last resort. Every axis name now renders in full. Not yet visually confirmed against a real rendered card at actual font metrics — worth a quick sanity check.
8. **Keep as-is:** the films/music/books/"minds like yours" section, the DNA section placement, and the bottom call-to-action ("What does your worldview say about you," the 160-questions/32-axes/archetype summary line, and the site URL). Consider adding a one-line mention of the contradiction engine to this call-to-action. **[FIXED, 2026-07-06]** Also found and fixed in passing: the CTA text said "34 belief axes" — the system has 32. Corrected.
9. **Remove** the redundant text block below the call-to-action that just repeats it (currently shows "Phil OS." plus the thelifepm.com URL a second time) — this frees up space on a card that is already tight on room. **[FIXED, 2026-07-06]** Removed entirely.
10. Maintain standard shareable card dimensions throughout (currently 1080×2160 per `CLAUDE.md` — do not change the format, only the content and rendering within it). **[PRE-AUDIT, 2026-07-06]** `CLAUDE.md` may itself be stale here: the live render function builds a 1080×1920 canvas (9:16 social story format), not 1080×2160. Worth confirming which is actually correct/current and updating whichever is wrong.

---

## PHASE 10 — UX and Cross-Device Rebuild

### 10a. Critical bug: exam randomization must lock on start

**[FIXED, 2026-07-06]** Root cause was not where it looked. Question navigation (`nextQ()`/`prevQ()`) never reshuffles — the actual bug was in the resume/restore path: `restoreProgress()` was calling a fresh shuffle every time a session resumed, while reusing the old answer position and answers dict, so the ID-to-position mapping silently shifted between the original pass and the resumed one (exactly producing "backward shows unanswered, forward re-shows answered"). Fixed by persisting the shuffled question-ID order inside the existing `answers` jsonb field (no schema change needed) and reusing it on restore, falling back to a fresh shuffle only for legacy sessions saved before this fix. Full mechanism and code in `SONNET5_FIXES_LOG_2026-07-06.md`. Restarting the exam still reshuffles and locks the new order, as required. **Residual, not fixed:** answer-OPTION order within a question still regenerates fresh on resume (a smaller version of the same class of bug) — flagged as a small follow-on item, not blocking.

### 10b. Backward-navigation data integrity

**[PRE-AUDIT, 2026-07-06]** Partially already true: `saveProgress()` already writes answers to Supabase in near-real-time (debounced 2 seconds after each answer), not batched at completion, for authenticated users. Combined with the 10a fix above, backward navigation for logged-in users should now show the exact prior question and answer. **Not covered:** guest/anonymous sessions appear to have no progress-save path at all — no equivalent found for `!currentUser`. Decide whether guest sessions need this too or whether requiring an account for resume is acceptable. (See Phase 11 for the broader database rebuild this still depends on for anything beyond what's already fixed.)

### 10c. Question hover-explanations — full rewrite

The hover/question-mark explanations Andre added because people found questions hard to understand currently mostly just reword the question in different word order, adding no real depth. All 160 must be rewritten to:
- Actually explain the underlying situation, problem, or event the question is getting at — genuinely break it down, not restate it.
- Be understandable at roughly a junior-high reading level (one notch simpler than the high-school-level question itself).
- Remain 100% neutral — same neutrality bar as the questions and answers themselves, no leaning.
- Give further explanation where genuinely needed, not a fixed-length blurb regardless of complexity.

### 10d. Menus and settings

- Rework and reorder settings into a logical order (currently not well organized). **[PRE-AUDIT, 2026-07-06]** The screen is more built out than expected: Language (5 languages, though questions correctly stay English-only for psychometric validity — a deliberate design choice, not a gap), Text Size (4 levels), Report Font (3 options including OpenDyslexic), Contrast (Normal/High) all exist with coherent markup. Reordering/polish still applies, but this isn't a thin or empty screen.
- Verify every setting actually works — some did not last time this was checked. **[PRE-AUDIT, 2026-07-06]** Only the markup was confirmed to exist; whether each `applySetting()` call actually applies its effect at runtime was NOT functionally tested (would require running the app and toggling each one live). Treat Andre's "some didn't work" report as still unverified, not resolved.
- Identify and fill any gaps in settings coverage.
- Keep the Beta-phase QA flag on every question intact, and ensure it writes to Supabase in real time (same real-time requirement as answers, not batched at completion).

### 10e. App-wide wording pass

Review all copy in the app for professionalism. This includes but is not limited to the landing page, report, card, and settings.

### 10f. Landing page

- Correct/verify all information presented.
- Highlight Phil OS's important features and the significance of the work it's doing — needs to function as a hook that drives people to take the evaluation and ultimately pay.
- Give the **contradiction engine** a full, compelling explanation as the premier feature: explain that it identifies three levels of contradiction and asks refining follow-up questions to help sharpen the person's own logical thinking. Critically, frame it as **not a judgment tool** — it's a tool for refining how you reason, and no comparable tool exists anywhere else. This must land clearly on the landing page.
- Position Phil OS as based on real science and the philosophical gold standard (PhilPapers-level rigor) — while being accurate that it is not yet independently science-validated. Contrast (without naming competitors directly) against the popular personality-test category, which is broadly pseudoscience rather than rigorous science. Let the comparison be inferred, not stated as a direct callout.

### 10g. Full Profile / Report page rebuild

This section had the most detailed live walkthrough from Andre — preserve all of it:

- **Loading/build screen** ("Mapping your OS"): keep the step-by-step progress display concept, but make it more dynamic and visually polished/professional — current version isn't good enough.
- **Background/aesthetic fragmentation (the core problem).** Right now, opening the report is visually segmented: hard line breaks and color shifts between the header, the card area, and the sections below, instead of one continuous background. This must become **one single continuous background, edge to edge, top to bottom** — same floating orbs, glows, and constellations as the landing page and the rest of the app, applied consistently across every profile section/screen. No more hard seams between segments.
- **Header sizing.** "Your Philosophical OS" at the top is currently far too small and narrow — bump the font size up significantly so it reads as a proper page header, while keeping it on-brand. **[PRE-AUDIT, 2026-07-06]** Likely a pure font-size issue, not a contrast issue — see the 10j note below, the core text-color contrast ratios already clear WCAG AAA by a wide margin. Treat this as a typography/sizing fix, no need to reopen the color system for this specific complaint.
- **Downloadable card is the first thing shown** on opening the report — keep that flow, apply the Phase 9 card rebuild.
- **Left-hand section navigation** (your card, who you are in the world, famous minds, how you operate, fingerprint and life alignment, culture map, growth edges, belief tensions, full belief map): keep the sectioned structure — Andre built it this way specifically so each section could hold *more* depth and explanation than a single flat page would allow, not less. The fix is aesthetic continuity (see above) and content depth (see below), not collapsing the sections.
- **Also add a full, single-scroll, shareable version of the entire report** with its own download and share button, so someone can share their whole report with another person, distinct from the sectioned in-app navigation.
- **Per-section content audit.** Andre's current gut grade is roughly 6/10. Go section by section: what's working, what isn't, what needs modification, removal, or addition. The target is a genuinely life-changing moment of self-insight, built from holding all 32 axes together at once — deeper explanation, not just restated data, in every section.
- **Text contrast/accessibility** must be fixed throughout the profile pages specifically (this is where the small-header issue lives, but check everywhere in this flow).

### 10h. Navigation placement

- On desktop, move "My Profile" and "Resources" next to "Settings" rather than floating alone at top-center of the screen. **[FIXED, 2026-07-06]** Confirmed exact cause (the nav links sat near the logo, separated from Settings by the entire flexible progress-bar spacer) and moved them into the same right-hand nav group as Settings.
- On mobile, the bottom nav (Home / My Profile / Resources / Settings) is already working well — no change needed there.
- On mobile, the profile page's section-switcher (currently a dropdown at the top) is directionally the right pattern, but has a bug: scrolling up causes the dropdown to shift position and overlap other text. Fix this, and confirm the dropdown is genuinely the best interaction pattern for switching sections on mobile (or propose a better one if not). **[PRE-AUDIT, 2026-07-06, not fixed]** Located the dropdown (`#report-nav-dropdown`) — it's plain `position: static`, so the scroll bug is very likely coming from a parent container's scroll/transform behavior rather than the dropdown's own CSS. Needs live reproduction to pin down, not a static-code guess.

### 10i. Mobile sign-in bug

On the sign-in screen (mobile), tapping causes chunks of the graphics to disappear unpredictably. This needs root-cause investigation as a rendering/state bug, not a cosmetic tweak. **[PRE-AUDIT, 2026-07-06, not fixed]** The sign-in flow is a modal (`#auth-modal`, fixed-position overlay), not a dedicated screen route, with several breakpoint-specific background pseudo-element rules. Structure reviewed, but reproducing a tap-triggered disappearance isn't possible from static code — needs an actual device/browser test. Suspect region only, in `SONNET5_FIXES_LOG_2026-07-06.md`. **Important cross-reference found during closeout:** Decisions Log D17 (2026-06-22) already fixed GPU-compositing content vanishing on this exact screen during scroll on Chrome/Android, and D24 (2026-06-25) fixed a related dead-CSS-selector ghosting bug on the same modal. Check whether Andre's current tap-triggered report is a regression of either fix before treating this as a brand-new, never-addressed bug.

### 10j. Accessibility and AI-detection pass (app-wide, final sweep)

- Confirm every piece of text app-wide meets contrast/disability-readability standards while preserving the aesthetic. **[PRE-AUDIT, 2026-07-06]** Better than expected: the core text-color CSS variables already carry computed WCAG ratios as inline comments against the background (17.5:1, 13.2:1, 9.51:1), all clearing AAA (7:1). There's a second, different color block elsewhere (around a `--text: #ffffff` set) that looks like a scoped override, possibly the High Contrast toggle — worth confirming what condition triggers it, but the baseline system already looks solid. Don't assume this phase needs a from-scratch color audit.
- Confirm zero em dashes or en dashes exist anywhere in any content across the entire app (questions, answers, explanations, report, card, settings, everything) and that all writing reads as natural human writing, not detectable AI output. **[PRE-AUDIT, 2026-07-06]** Counted precisely: 624 occurrences total in `index.html` (use ripgrep for this count, not plain `grep` in this shell — a naive byte-wise match on the multi-byte dash characters gives a false ~9,700). Roughly 63 are inside the question bank itself, 119 in archetype/media/card content, and the remaining ~400+ are split between CSS/HTML comments (invisible to users, lower priority) and report-rendering template strings (user-facing, needs fixing) — that split was not fully separated and still needs a closer pass. Recommend folding the user-facing ones into the Phase 7 rewrite itself rather than a separate blind find-and-replace, since a mechanical substitution risks picking the wrong replacement per context and this file has no test suite to catch a bad one. Full breakdown table in `FABLE5_FACT_FINDING.md`. Also worth knowing: Sonnet 5 caught itself introducing 4 new em dashes in its own added code comments during the pre-audit fixes and had to self-correct — even careful, rule-aware writing slips on this, so build in an explicit verification pass after any content rewrite rather than trusting a single careful draft.

---

## PHASE 11 — Database (Supabase) Rebuild

**[PRE-AUDIT, 2026-07-06 — BLOCKER]** Sonnet 5 could not verify anything in this phase directly: the Supabase MCP connection available in that session only had access to an unrelated project ("dutchos"), not the real Phil OS project. No `get_advisors`/RLS check, no real table list, could be run. Whoever starts this phase needs to either connect the correct Supabase project first, or have Andre run the advisor check and hand over the output — don't assume the "too many tables, missing RLS" claim is confirmed just because it's repeated in this plan; it's still Andre's unverified recollection, not a checked fact.

1. Audit the current database structure: too many tables, inconsistent connections, and confirmed security issues (multiple tables without Row Level Security enabled).
2. Rebuild and reconsolidate the database properly, with correct RLS on everything that needs it.
3. Reconnect every part of the app to the rebuilt schema correctly.
4. Non-negotiable behaviors that must survive the rebuild:
   - Every answer writes to the database in real time as the respondent answers, not in a batch at completion (supports Phase 10a/10b's exam-lock and backward-navigation requirements).
   - Every Beta QA flag writes to the database in real time as it's set (same standard as answers).

---

## PHASE 12 — Dev/QA Panel Improvements

Keep and refine the existing tools Andre already likes:
- Report generator
- Item analysis
- Archetype distance checker
- QA/QC assessment
- Contradiction tester (Andre likes it but thinks it can be done better — evaluate what improvement looks like)
- System status / integrity check (previously described as flagging "too few reversed items," expecting 2 per axis when there's 1 — **[PRE-AUDIT, 2026-07-06]** the real per-axis distribution is actually 1 to 4, not a uniform 1, so update this check's expectations once Phase 1/3/7 settle what the correct target distribution should be, rather than assuming it just needs to reach a flat "2 per axis"; unique-ID checks, axis checks, and archetype checks are already fine)

Add whatever additional system-integrity stats would be genuinely useful, and add any other Dev/QA panel capability Fable identifies as missing during the audit.

---

## PHASE 13 — Analytics Decision

Decide whether to build custom analytics in-house or adopt an existing analytics platform. The core requirement driving this: Andre needs to know how long respondents spend on each individual question and answer. Consistent dwell times of roughly two minutes or more on a specific question is a signal that item is too difficult to understand and needs revision. Recommend an approach and note the tradeoffs (cost, integration effort, data ownership).

**[PRE-AUDIT, 2026-07-06]** Confirmed starting point: zero existing analytics code anywhere in the app (no PostHog, GA, Mixpanel, Amplitude, or custom event tracking found in `index.html` or any `api/*.js` file). `CLAUDE.md` lists an `analytics_events` Supabase table in its schema, but nothing currently writes to it — if that table exists in the real database it's an empty, unused stub, not a partially-wired system. Whatever gets decided here starts from zero instrumentation.

---

## PHASE 14 — Parked Feature: Compatibility Reports (discuss, do not necessarily build now)

Andre wants a future B2B/consumer feature: a compatibility report for two people (couples or teams), likely sold as an upsell after both people complete their own evaluation. Open question he's explicitly left to Fable: should compatibility be computed at the individual-question level or the axis level, and which produces the fullest, most defensible comparison. This does not need to ship in this audit/rebuild cycle — flag it as a scoped future decision and get Fable's recommendation on timing and approach, but do not block the rest of the plan on it.

---

## PHASE 15 — Final Re-Audit and Re-Grade

Once the rebuild (Phases 7-13) is complete, re-run the same audit structure from Phases 3, 4, 5, and 6 and re-grade psychometrics, philosophy, report content, and card content A-F again. Present a clear before/after comparison so Andre can see exactly what improved and by how much.

---

## PHASE 16 - Capstone Documentation Pass (added 2026-07-06, Andre's directive after Phase 2)

After Phase 15's re-audit and re-grade, run a full documentation pass of the entire Phil OS vault against the finished rebuilt state:

1. Re-audit every Phil OS note against the rebuilt app and database - flag stale information in place, mark superseded notes as archived (frontmatter status change, not just banners).
2. Produce world-class master documentation that clearly shows: where the project started (v1 C+ through v3 B+ audit history), how each phase and stage moved it, and where it ended (Phase 15 grades).
3. Every decision made across the cycle recorded with its rationale, fully traceable end to end.
4. The replication test is the bar: someone with only the vault documentation must be able to rebuild the instrument - construct cards, validation standard, final question bank, scoring logic, archetype vectors, contradiction rules, and the decision chain.

This runs at cycle close (after Phase 15), not at each session close - earlier polishing would be re-staled by the rebuild phases. Normal end-of-session closeouts (Build Log, Decisions Log, Master Index, CLAUDE.md) continue every session as usual.

---

## OPEN QUESTIONS FOR FABLE TO RESOLVE AND STATE (not for Andre to pre-answer)

1. Single-agent sequential audit vs. multi-agent psychometrician+philosopher team working in tandem (Phase 2).
2. Full hard-coding vs. hybrid hard-coding/API for report content (Phase 5) and shareable card content (Phase 6/9).
3. Build vs. buy for analytics (Phase 13).
4. Question-level vs. axis-level compatibility scoring, if/when that feature is scheduled (Phase 14).

State the reasoning behind each recommendation rather than just the conclusion, since Andre will want to weigh in at Checkpoint A and again before Phase 14 if it's greenlit.
