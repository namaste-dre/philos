# Fable 5 Audit - Phase 1 Findings: Vault Documentation vs Live Reality

_Fable 5, 2026-07-06. Phase 1 of `FABLE5_AUDIT_PLAN.md`. Every claim below was verified directly against the live `index.html` / `api/*.js` (post-push, current on `main`) or the real Phil OS Supabase project (`qzazpihvayeqjfgtbakr`), not taken from any doc. All stale flags described here have been applied in place in the vault notes._

---

## 1. Verified ground truth (the numbers that settle old ambiguities)

| Fact | Verified value | What it corrects |
|---|---|---|
| Contradiction rules | **Exactly 42** (12 Tier A, 22 Tier B, 8 Tier C) | Ends the "42 vs 43" ambiguity open since 2026-06-20. Architecture doc's 11/20/11 tier breakdown was also wrong. |
| Reversed items | **52/160 = 32.5% aggregate.** Per axis: 14 axes at 1, 17 axes at 2, `meaning` at 4 | A7 / CLAUDE.md "uniform 2 per axis (40%)" and Andre's "walked down to 20%" recollection were both wrong |
| Reversed flags by type | 49 likert, 2 scenario, 1 tradeoff. All 3 non-likert flags are on `meaning` (t2me02, t2me03, t2me05) | The "flag is Likert-only" claim (D7) has three live exceptions, created by D6 itself |
| `meaning` axis scoring | **Functionally correct** - the 3 flagged non-likert items have deliberately inverted option scores that the `8 - raw` flip corrects (verified semantically item by item) | Not a live scoring bug. It is a convention violation, not a math error |
| AI model | `claude-sonnet-5` in both `api/generate.js` and `api/chat.js` | CLAUDE.md, Master Index, Product Snapshot, Build Checklist all said `claude-sonnet-4-6`. The 4.6-to-5 migration was never logged in any vault doc |
| Shareable card | 1080×1920 canvas (9:16 story format) | CLAUDE.md, Master Index, Product Snapshot, Archetype Icons doc, and locked decision P7 all said 1080×2160 |
| t2m02 / t3so04 stems | Old flawed wording still live (self-contradictory stem, "give way" ambiguity) | Confirms "approved, not pushed" status is still accurate |
| Question bank structure | 160 questions, 32 axes, 5/axis, 72 likert / 48 tradeoff / 40 scenario | Matches docs. (Dossier note: `FABLE5_FACT_FINDING.md` said "20 likert questions with 0 options" - there are 72 likert items total; only some parse with empty options arrays.) |
| Sonnet 5 pre-audit fixes | All six confirmed present in the live file (`__shuffleOrder`, Conviction Strength, footer removal, fingerprint label fix, 32-axes CTA, nav placement) | Andre pushed them; Build Log's "not yet pushed" updated |

## 2. The reversed-item story, fully reconstructed

This is the single most important Phase 1 finding because it reframes the Checkpoint A decision:

1. 2026-05-26 normalisation (A7/A26/A27) genuinely shipped 64 reversed flags = uniform 2 per axis, 40%. The locked decision was true in code at that moment.
2. During that normalisation, 10 "philosophically strong" items were converted to reversed by rewriting them to the opposite pole and adding `reversed:true` (A32) - including on tradeoff/scenario items, where the flag was never supposed to go.
3. 2026-06-20 (D6): 18 of those 64 flags turned out to be scoring bugs - 15 spurious flags removed, 3 missing flags added (the `meaning` trio). 64 - 15 + 3 = 52, exactly today's count.
4. D7 then locked "the flag is Likert-only" while D6's own fix had just added the flag to two scenarios and a tradeoff. The locked rule and the shipped fix contradict each other to this day.
5. Conclusion for Phase 3/7: **the uniform 40% never existed as valid measurement** - it existed only as a flag count inflated by bugs. The real decision is not "restore 40%" but "define the correct reversed-item standard per axis (Likert-only acquiescence control) and rebalance `meaning` by rewriting the 3 inverted-option items to native polarity."

## 3. Supabase - real state (first session with correct project access)

Project: `Phil/OS` (`qzazpihvayeqjfgtbakr`, eu-west-1, ACTIVE_HEALTHY). Data volume: 3 completions, 320 responses, 3 profiles, 2 account_completions, 1 assessment_progress, 2 rate_limits, 0 research_profiles, 0 analytics_events.

**The audit plan's Phase 11 premise is partly wrong:**
- "Too many tables": there are 8 tables. All 8 are referenced by live code or serve a documented purpose. Not a real problem.
- "Multiple tables without RLS": **false.** All 8 tables have RLS enabled. Four (completions, responses, rate_limits, research_profiles) have RLS with zero policies, which is the documented service-role-only design (Build Log 2026-06-19), not a hole.

**Real security findings (new, not logged anywhere in the vault):**
- ERROR: `gdpr_consent_log` view may expose `auth.users` data to the `anon` role.
- ERROR: `gdpr_consent_log`, `stats_daily_completions`, `stats_archetype_distribution`, `stats_axis_answer_distribution` are all SECURITY DEFINER views.
- WARN: `handle_new_user()` is a SECURITY DEFINER function executable by `anon` and `authenticated` via REST RPC.
- WARN: `update_rate_limits_updated_at` has a mutable search_path.
- WARN: leaked-password protection (HaveIBeenPwned check) is disabled in Auth settings.
- Note: these 4 views and 2 functions are also absent from every vault schema description - the docs only describe the 8 tables.

~~Phase 11 should be rescoped from "rebuild and reconsolidate" to "fix the view/function security items, add policies where genuinely needed, and wire QA-flag real-time writes" unless deeper audit finds more.~~ **Overruled by Andre 2026-07-06 (after reviewing these findings + his dashboard screenshot showing the four UNRESTRICTED views):** Phase 11 stays a full re-architecture. His direction: routing/logging is not clean, the architecture needs to be designed properly by a real database architect. A proposed target schema (tables, views, policies, write paths, real-time QA-flag writes) will be delivered as part of the Checkpoint A materials for approval before execution. The four UNRESTRICTED items in his screenshot are the four views listed above (gdpr_consent_log + 3 stats views), confirming the advisor findings.

## 4. Vault doc status after this pass (39 docs swept)

**Current and healthy (no or minor flags):** Build Log, Decisions Log, Question Bank v3, Scoring and Archetype Logic, Item Analysis (Part 1), Master Index, Build Checklist, Security Audit and Hardening Log, session/addendum notes (dated records), Use Cases and Personas, Marketing and Growth Strategy, Council Analysis Summary, Claude_Phil_OS_Results.

**Corrected in place today:** CLAUDE.md (model, rule count, card size, dates, session-start path, plus full em/en dash removal), Master Index (model x2, rule count x2, card size, reversed-item highlight, push status, audit status), Architecture and Axis Map (new 2026-07-06 update note: rule composition, reversed distribution, Likert-only exceptions, T3 "23 axes" typo fixed to 16, tier-weight-inert caveat), Question Bank v3 header, Build Checklist model line, Archetype Icons (junk "333" removed, card size), Background System Reference (2024 date typo, was 2026).

**Flagged stale in place:** Product Snapshot (6-item external-facing staleness list), Project Instructions v3.0 (**whole-note flag: file is truncated mid-table** and its state table is stale; rebuild from CLAUDE.md or retire), Revenue Model (156Q/34-axis references), Full Product Overview (build-state sections historical), Archetype Taxonomy (sig vectors last synced 2026-05-12, Family 7 updates possibly missing), Hardcoded Family Data (mirror not re-synced since 2026-05-12).

**Marked wholly stale/superseded:** Netlify Functions Reference, Question Bank v1, Question Bank v2, Contradiction Engine doc (rule count banner; design rationale still valid), Psychometric Validity Audit v1, Recovery Plan 2026-05-31 (file-split proposal never adopted; conflicts with locked A9).

**Structural problems found:**
- `Phil OS - Logic Log.md` **does not exist** and never did, despite CLAUDE.md's mandatory end-of-session protocol referencing it (already corrected in CLAUDE.md by Sonnet's closeout; confirmed vault-wide by search).
- `PHIL OS - Claude Project Instructions v3.0.md` is truncated mid-sentence (ends at "All axes: 5 items,") - the axis list and all later sections are gone. Needs rebuild or retirement.
- "Chat with gemini" note is an empty stub (title only, no content) - flagged for fill-or-delete.
- Decisions Log P7 (card 1080×2160) needs a dated correction entry (P7 locked a format the live code no longer uses).
- D14's Architecture-doc wording correction (tier weight inert) was still pending; now covered by today's update note.

## 5. Open judgment calls carried into Phases 2-3 (Checkpoint A material)

1. **Reversed-item standard** - define Likert-only per-axis targets; rebalance `meaning` by rewriting t2me02/03/05 option scores to native polarity and dropping their flags (no user-visible change, removes the D6/D7 contradiction); then correct A7 with a dated entry. (Recommendation, not yet executed - audit before action.)
2. **Tier weight** - inert in live scoring. Decide: wire it into archetype distance (requires re-running the inter-family distance analysis) or remove/redocument it as intent. Phase 3 will model both.
3. **D8's Likert-only recount** ("11 axes at 50%, 1 at 100%, 3 at 33%") describes only 15 of 32 axes and does not obviously reconcile with the live parse - re-derive properly in Phase 3 rather than trusting it.
4. **Card format decision** - either re-lock P7 at 1080×1920 (what is live and what social stories actually use) or change code back to 2160. Recommendation: re-lock at 1920.
5. **Supabase security items** (Section 3) - fix list is mechanical but touches auth surface; schedule inside Phase 11.

_End of Phase 1. Phase 2 (psychometric standard) is next per the plan, pending Andre's go._
