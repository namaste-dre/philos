# Phase 15 Re-Audit (Scoped per D86) - 2026-07-10

_Fable 5. This is the D86 scoped-down version: re-grades only the areas that materially changed since the original audit (Phase 7 instrument v4, Phase 8 report rebuild, 10c explanations), plus launch blockers, unresolved high-risk findings, and implementation inconsistencies. It is not a rerun of the full Phases 3-6 audit structure. Original grades for reference (Checkpoint A, 2026-07-06): Psychometrics D, Philosophy/neutrality C, Report C, Card C, Data protection D._

_A caveat stated plainly: Phase 8 and 10c were built by me in this same session. I verified them with scripts and structural checks, not fresh eyes. The grades below for those areas are self-assessments against the rubrics; Andre's review before push is the real gate, and the post-deploy QA run is the real test._

---

## 1. Re-grades, before and after

### Psychometrics: D -> B (instrument v4, Phase 7, shipped and verified)

What moved it: the 15 scoring bugs are fixed; the reversed-item design now follows a stated standard (Likert-only keying, both directions on every axis with 2+ Likerts, 36 flags, 49.3% of Likert items reversed, inside the 30-50 band); tier weighting is correctly documented as recorded metadata rather than falsely claimed as active; all 60 archetypes recover themselves under a from-scratch reachability harness including the archetype-collision fix (D69-D71); the dev-panel integrity check now verifies the real design instead of a stale assumption.

Why it is not higher: reliability and item-discrimination claims remain unverifiable until N >= 300 real completions (the standard's own rule: no statistical claims pre-launch). B is the structural ceiling; the empirical half of the grade does not exist yet. Nothing currently known blocks it from reaching that ceiling.

### Philosophy / neutrality of the instrument: C -> B+ (Phase 7, shipped and verified)

What moved it: the four neutrality REWRITEs shipped (t3r03, t3r05, t2m02, t3so04); the four completeness gaps are closed (science denial, committed believer, transcendent meaning, deterrence options); redundancy dedupes preserved the deliberate consistency pairs while removing undeclared near-duplicates; bank-wide language now measures at FK grade 10 or below; the two-sided test was applied item by item during the rewrite.

Why it is not higher: cross-axis near-pairs (t3ms05/t3an05, t3unc04/t15eh04, t15so02/t3p01, t15em03/t2k03) are documented but unresolved by design, waiting on N=300 data; and neutrality grades earned by the author of the rewrite should be confirmed by real respondent feedback (the beta QA flag exists for exactly this).

### Report content: C -> B, conditional on deploy verification (Phase 8, D93/D94, local commit)

What moved it: the C1 architecture is now real, not a plan. Card text, tagline, patterns, and growth edges are hard-written data with deterministic selection; the AI writes only what genuinely needs per-profile nuance (identity, alignment, world lenses); the no-dash rule is enforced by code, not hope; temperature is fixed server-side; every report will carry version, prompt hash, model, temperature, and generation date (D47, finally wired end to end). The growth-edge library gives the section actual content depth where three thin AI sentences used to be.

Why conditional: no live r2 report has been generated yet (needs deploy + API). The B holds only after one QA-mode generation confirms the merge, validator, and all three render surfaces behave with real model output. Until pushed, production runs r1 and the live product is still a C.

### Question explanations: not separately graded originally -> A- (10c, D95, local commit)

Measured, not estimated: 0 of 160 over FK grade 8.0, average 5.6 (from 154 of 160 over, average 14.1); D21 no-hint rules and D23 no-sibling rule scripted and clean; terms defined in place; length follows complexity. Why not A: the standalone no-hint test and the two-sided read were run by the writer; a handful of independent beta readers is the honest confirmation step.

### Card: C -> C+ (partially moved; not this session's work)

Sonnet's 2026-07-06 fixes (fingerprint truncation, conviction strength rename, CTA fix, redundant block removal) plus Phase 8's hard-written cardWhoYouAre/cardTagline (55-word/340-char cap now guaranteed by data rather than by prompt compliance) improve it. Still open and visible: icon placement/clipping (P9-5, diagnosed but unfixed, needs visual verification), the DNA visualization upgrade, bidirectional fingerprint bars, and the C2 additions (name opt-in, QR code). The card remains the weakest user-facing surface relative to its viral job.

### Data protection: D -> B- (Sonnet's consent architecture, D79-D92; not this session's work, graded for the before/after picture)

Real deletion, real research opt-in, separated default-off marketing consent, atomic consent transaction path verified against the live database, share-link warnings on both surfaces, noindex on share pages, consent versioning schema. Remaining before this is a B+/A-: published privacy notice (D2 is drafted only), Art. 9 consent wording upgrade (Step 4), 18+ enforcement (Step 5), regression tests (Step 6), research consent onto the canonical path (Step 2R).

---

## 2. Launch blockers (for a public marketing push, per D49's standard)

1. **Privacy notice not published and consent wording not yet Art. 9-grade.** D49 explicitly blocks any marketing push on D1-D3; D1 (deletion) is done, D2/D3 are not. Steps 4-6 of the consent sequence are the path.
2. **18+ decided but not enforced** (D78). Currently a soft 13+ field. Legal exposure given special-category data.
3. **Phase 8 + 10c are not deployed.** Production still runs the r1 pipeline and college-level explanations until `0d7efd9`..`9884eab` are pushed and one QA generation passes.
4. **No full systematic end-to-end test of all 160 questions has ever been run** (one beta completion, one self-test, one M5 retake do not cover the matrix). Needed before any traffic push.
5. **Landing page claims overreach:** "Personality tests aren't science. Phil OS is." The instrument is not yet independently validated and makes no statistical claims pre-N=300 by its own standard. This sentence is a claims risk and contradicts the plan's own accuracy requirement. Fix lands in 10f (boundaries below in section 4 of my remaining work); flagged here because it is live today.
6. **~520 em dashes remain in `index.html`** outside this session's touched content, roughly 119 of them user-facing in the culture-map media library. Ground Rule 5 says zero. Mechanical but real; belongs to 10e/10j, and the media-library portion could be safely scripted (separator convention, not prose).

## 3. Unresolved high-risk findings (not blockers, tracked)

1. Live r2 report generation unverified (see conditional grade above); first QA run must also confirm the five metadata columns populate.
2. 10i mobile sign-in rendering bug and 10h dropdown scroll bug: Sonnet's now (D86), unresolved; 10i has D17/D24 regression history worth checking first.
3. i18n dead-toggle decision still open (Sonnet 6B item 8 feeds it).
4. The 6 pre-2026-07-10 Supabase migrations still not backfilled into git.
5. Cross-axis near-pair items on the N=300 watch-list.
6. `anon_progress`/`/api/progress` reserved infrastructure: intentional (D75), but it is unwired code in production and should stay on the watch-list so it does not drift into accidental exposure.

## 4. Inconsistencies introduced during implementation (checked, and their state)

1. **Phase 8 changed the report_json contract** (growth entries are now objects). All three renderers updated with string back-compat in the same commit; old stored reports verified to still render by code path (strings pass through untouched). No action needed.
2. **`report.tagline`/`patterns` now come from data while old stored reports carry AI versions.** The share page renders whatever `report_json` holds, so old links keep their original text; new reports get the hard-written text. Intentional (r1/r2 versioning exists precisely to distinguish them). No action needed.
3. **CLAUDE.md's "AI report" row said "2-call split" without scope detail** and is now updated to r2 state; the audit plan's Phase 5/8 sections remain historical (plans, not state docs) - left as is deliberately, per the vault convention that the Decisions Log is the authority.
4. **Question Bank v3 vault doc:** checked; it explicitly does not duplicate explanations and points to `index.html`, so 10c created no doc drift.
5. **`FABLE5_CHECKPOINT_A_DECISIONS.md` C1 described growth as "~64 axis entries + ~42 contradiction entries";** as built it is exactly 64 and exactly 42. No correction needed, the estimate resolved to the estimate.

## 5. Before/after summary for Andre

| Area | Checkpoint A (07-06) | Now (07-10) |
|---|---|---|
| Psychometrics | D | B (structural ceiling pre-launch) |
| Philosophy/neutrality | C | B+ |
| Report content | C | B conditional on deploy QA (live product still C until push) |
| Explanations | (within philosophy grade) | A- measured |
| Card | C | C+ (biggest remaining user-facing gap) |
| Data protection | D | B- (Steps 4-6 are the remaining climb) |

The shape of the project has inverted since the original audit: the measurement core and report content, originally the weakest areas, are now the strongest; the outstanding work is compliance completion (Steps 4-6), the card, deploy verification, and copy-level claims discipline.
