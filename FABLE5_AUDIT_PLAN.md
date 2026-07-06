# Phil OS — Full A-Z Audit and Rebuild Plan (for Fable 5)

_Compiled from Andre's full dictation, 2026-07-06. Reordered into an executable sequence. Nothing from the source dictation has been dropped — only reorganized. Read this whole document before starting. Read `C:\philos\CLAUDE.md` immediately after — it is the live source of truth for current build state, file locations, and locked decisions._

---

## READ THESE TWO DOCUMENTS BEFORE STARTING ANY PHASE

Between this plan being written and Fable's session starting, Andre had Sonnet 5 do a pre-audit pass: fix everything fixable with full confidence (pure engineering, zero psychometric/philosophical judgment), and run a fact-finding sweep across the rest of this plan so Fable isn't spending tokens re-deriving ground truth from an 11,896-line single-file app. Both documents live next to this one in `C:\philos\`:

- **`SONNET5_FIXES_LOG_2026-07-06.md`** — 6 things already fixed in `index.html` (not yet pushed/deployed), plus 4 things found but deliberately left alone because they need visual/live verification Sonnet couldn't do from static code. Read this so Fable doesn't redo work that's already done, and doesn't waste time rediscovering bugs already root-caused.
- **`FABLE5_FACT_FINDING.md`** — a phase-by-phase dossier of verified facts (exact numbers, exact line references, exact mechanisms) mapped to this plan, clearly marked VERIFIED vs. NOT VERIFIED/NEEDS FABLE. Several phases below have inline notes pointing back to specific findings in it. This does not replace the audit — none of the judgment calls (psychometric validity, philosophical accuracy, neutrality, design decisions) have been made. It just means the mechanical groundwork (parsing the question bank, counting reversed items, locating bugs, checking what's already hardcoded) doesn't need to happen twice.

The inline notes below, marked **[PRE-AUDIT, 2026-07-06]**, point to the specific relevant finding in those two docs. Everything else in this plan is unchanged from the original dictation-derived version.

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
2. Determine what could be hard-coded per axis instead of generated live. If an axis's report content can be 100% hard-coded with no API call, that's the target. If some content genuinely needs AI generation, that's acceptable too.
3. Consider that there are 32 axes plus family/sub-family groupings (roughly 60 combinations between archetype families and sub-family variants per the current 12-families-by-5-variants structure) — this may be small enough a space to hard-write nearly everything: beliefs, how they see the world, jobs/volunteer work, ways they can change the world, growth patterns, etc.
4. The constraint that matters most: **no nuance lost.** The report must still produce an "oh shit, this is me" moment — real insight into how the person sees the world, themselves, and others, and why they are the way they are. If full hard-coding would flatten that nuance, a hybrid approach (mostly hard-coded, with targeted API-generated nuance layered in) is the better call. Decide which approach actually holds up and state the reasoning.
5. Economics matter: fewer API calls is better for cost, but never at the expense of evaluation or report quality.
6. **Grade current report content A-F** on accuracy, depth, and hardcoding efficiency, with rationale.

---

## PHASE 6 — Shareable Card Audit

Audit the current shareable card as its own item (separate from the full report).

1. Assess current viral/shareability effectiveness — the goal is a serious hook that makes other people want to take the evaluation themselves (see their archetype, their "DNA," their fingerprint, people who think like them, etc.).
2. Determine how much of the card content can be hard-coded the same way as the report, for the same cost/nuance tradeoff reasons.
3. **Grade current shareable card A-F** on shareability, content quality, and technical execution (see Phase 9 for the specific rendering bugs to fix).

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
4. **"Who You Are" box.** Ideally hard-written per archetype/sub-family combination (preserving nuance, per Phase 5/6 decision). If that can't fully replace the API-generated version, then hard-cap the content: determine the actual max lines/characters the box can hold without cutoff or overflow, and constrain the generation (API max character count set just under that true max) so it always fits. This is a hard requirement either way — text must never cut off or overflow this box.
5. **Icon placement.** The archetype icon currently sits off to the edge and gets cut off. It must be centered between the text box edge and the trailing edge of the actual text, consistently across every archetype/family/variant card (all ~60+ combinations).
6. **Stat labels.**
   - "Worldview rarity" (top X%) stays — Andre calls this a must-have, a genuine hook.
   - Rename "worldview strength" to **"conviction strength"** (an earlier version used this wording and Andre prefers it).
   - "Tensions found" — likely keep, tied to the contradiction engine. Consider adding a short blurb explaining what a tension actually is in this context.
7. **Fingerprint section.** Shows the top 5 axes furthest from center — good concept, broken execution: axis names are currently abbreviated and cut off (examples seen: "epistetic," "epistetic met," "knowledge sow," "social ontolo"). Names must never be truncated illegibly. Stack the label across two lines if needed, or find whatever layout keeps the full, readable axis name while still fitting the card.
8. **Keep as-is:** the films/music/books/"minds like yours" section, the DNA section placement, and the bottom call-to-action ("What does your worldview say about you," the 160-questions/32-axes/archetype summary line, and the site URL). Consider adding a one-line mention of the contradiction engine to this call-to-action.
9. **Remove** the redundant text block below the call-to-action that just repeats it (currently shows "Phil OS." plus the thelifepm.com URL a second time) — this frees up space on a card that is already tight on room.
10. Maintain standard shareable card dimensions throughout (currently 1080×2160 per `CLAUDE.md` — do not change the format, only the content and rendering within it).

---

## PHASE 10 — UX and Cross-Device Rebuild

### 10a. Critical bug: exam randomization must lock on start

Questions are currently randomized per test, which is correct and should stay for a fresh test. The bug: **the randomizer stays active during an in-progress exam.** If a respondent navigates backward after answering ~15+ questions, they see questions they haven't answered yet, and navigating forward again resurfaces questions in a different order than what they already answered. Required behavior: the moment "begin evaluation" is pressed, the question order locks for that attempt. It should never re-randomize mid-exam. Only restarting the exam should reshuffle and then re-lock the new order.

### 10b. Backward-navigation data integrity

This bug is really a data-writing problem: every answer must be written to the database in real time, as it's given, not batched at the end. This ensures that navigating backward always shows the exact question and exact previously-recorded answer the person actually gave, and that data survives interruption. (See Phase 11 for the database rebuild this depends on.)

### 10c. Question hover-explanations — full rewrite

The hover/question-mark explanations Andre added because people found questions hard to understand currently mostly just reword the question in different word order, adding no real depth. All 160 must be rewritten to:
- Actually explain the underlying situation, problem, or event the question is getting at — genuinely break it down, not restate it.
- Be understandable at roughly a junior-high reading level (one notch simpler than the high-school-level question itself).
- Remain 100% neutral — same neutrality bar as the questions and answers themselves, no leaning.
- Give further explanation where genuinely needed, not a fixed-length blurb regardless of complexity.

### 10d. Menus and settings

- Rework and reorder settings into a logical order (currently not well organized).
- Verify every setting actually works — some did not last time this was checked.
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
- **Header sizing.** "Your Philosophical OS" at the top is currently far too small and narrow — bump the font size up significantly so it reads as a proper page header, while keeping it on-brand.
- **Downloadable card is the first thing shown** on opening the report — keep that flow, apply the Phase 9 card rebuild.
- **Left-hand section navigation** (your card, who you are in the world, famous minds, how you operate, fingerprint and life alignment, culture map, growth edges, belief tensions, full belief map): keep the sectioned structure — Andre built it this way specifically so each section could hold *more* depth and explanation than a single flat page would allow, not less. The fix is aesthetic continuity (see above) and content depth (see below), not collapsing the sections.
- **Also add a full, single-scroll, shareable version of the entire report** with its own download and share button, so someone can share their whole report with another person, distinct from the sectioned in-app navigation.
- **Per-section content audit.** Andre's current gut grade is roughly 6/10. Go section by section: what's working, what isn't, what needs modification, removal, or addition. The target is a genuinely life-changing moment of self-insight, built from holding all 32 axes together at once — deeper explanation, not just restated data, in every section.
- **Text contrast/accessibility** must be fixed throughout the profile pages specifically (this is where the small-header issue lives, but check everywhere in this flow).

### 10h. Navigation placement

- On desktop, move "My Profile" and "Resources" next to "Settings" rather than floating alone at top-center of the screen.
- On mobile, the bottom nav (Home / My Profile / Resources / Settings) is already working well — no change needed there.
- On mobile, the profile page's section-switcher (currently a dropdown at the top) is directionally the right pattern, but has a bug: scrolling up causes the dropdown to shift position and overlap other text. Fix this, and confirm the dropdown is genuinely the best interaction pattern for switching sections on mobile (or propose a better one if not).

### 10i. Mobile sign-in bug

On the sign-in screen (mobile), tapping causes chunks of the graphics to disappear unpredictably. This needs root-cause investigation as a rendering/state bug, not a cosmetic tweak.

### 10j. Accessibility and AI-detection pass (app-wide, final sweep)

- Confirm every piece of text app-wide meets contrast/disability-readability standards while preserving the aesthetic.
- Confirm zero em dashes or en dashes exist anywhere in any content across the entire app (questions, answers, explanations, report, card, settings, everything) and that all writing reads as natural human writing, not detectable AI output.

---

## PHASE 11 — Database (Supabase) Rebuild

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
- System status / integrity check (currently flags "too few reversed items," expecting 2 per axis when there's 1 — this should resolve naturally once Phase 1/3/7 settle the reversed-item ratio question; unique-ID checks, axis checks, and archetype checks are already fine)

Add whatever additional system-integrity stats would be genuinely useful, and add any other Dev/QA panel capability Fable identifies as missing during the audit.

---

## PHASE 13 — Analytics Decision

Decide whether to build custom analytics in-house or adopt an existing analytics platform. The core requirement driving this: Andre needs to know how long respondents spend on each individual question and answer. Consistent dwell times of roughly two minutes or more on a specific question is a signal that item is too difficult to understand and needs revision. Recommend an approach and note the tradeoffs (cost, integration effort, data ownership).

---

## PHASE 14 — Parked Feature: Compatibility Reports (discuss, do not necessarily build now)

Andre wants a future B2B/consumer feature: a compatibility report for two people (couples or teams), likely sold as an upsell after both people complete their own evaluation. Open question he's explicitly left to Fable: should compatibility be computed at the individual-question level or the axis level, and which produces the fullest, most defensible comparison. This does not need to ship in this audit/rebuild cycle — flag it as a scoped future decision and get Fable's recommendation on timing and approach, but do not block the rest of the plan on it.

---

## PHASE 15 — Final Re-Audit and Re-Grade

Once the rebuild (Phases 7-13) is complete, re-run the same audit structure from Phases 3, 4, 5, and 6 and re-grade psychometrics, philosophy, report content, and card content A-F again. Present a clear before/after comparison so Andre can see exactly what improved and by how much.

---

## OPEN QUESTIONS FOR FABLE TO RESOLVE AND STATE (not for Andre to pre-answer)

1. Single-agent sequential audit vs. multi-agent psychometrician+philosopher team working in tandem (Phase 2).
2. Full hard-coding vs. hybrid hard-coding/API for report content (Phase 5) and shareable card content (Phase 6/9).
3. Build vs. buy for analytics (Phase 13).
4. Question-level vs. axis-level compatibility scoring, if/when that feature is scheduled (Phase 14).

State the reasoning behind each recommendation rather than just the conclusion, since Andre will want to weigh in at Checkpoint A and again before Phase 14 if it's greenlit.
