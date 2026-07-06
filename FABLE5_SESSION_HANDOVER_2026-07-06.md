# SESSION HANDOVER - Fable 5 Audit Session, 2026-07-06

_Written by the Fable 5 session that executed audit Phases 1 through 6B. Read this file FIRST, before anything else, then follow the read order below. This document exists because this project was once damaged by a handoff (see Section 4) and Andre explicitly asked that it never happen again._

---

## 1. Where the project stands in one paragraph

The full audit stage of `FABLE5_AUDIT_PLAN.md` is **complete**: Phase 1 (vault staleness - all 39 docs swept and flagged), Phase 2 (validation standard written, single-agent dual-lens approach locked), Phase 3 (psychometric audit, grade **D**), Phase 4 (all 160 items judged philosophically, grade **C**), Phase 5 (report pipeline mapped, architecture decided, grade **C**), Phase 6 (card audited incl. live browser rendering, grade **C**), Phase 6B Fable portion (AI chat + GDPR audits, data-protection grade **D**). **We are AT Checkpoint A. Nothing from the rebuild (Phase 7 onward) has been started. No code has been changed by Fable - all six Sonnet pre-audit fixes were pushed by Andre before this session's audit began.**

## 2. Read order for the new session

1. `C:\philos\CLAUDE.md` - live project context (updated this session; trust it).
2. **`C:\philos\FABLE5_CHECKPOINT_A_DECISIONS.md` - THE decision list.** Andre rules on items A1-A6, B, C1-C2, D1-D6. Your first real work is ingesting his rulings.
3. `C:\philos\FABLE5_PSYCHOMETRIC_STANDARD.md` - the standard Phase 7 builds against (the reverse-engineering contract is Section 11).
4. Vault: `776 - Build Log and Decisions\Phil OS - Full Psychometric and Philosophical Audit v4.md` - all findings P3-1..P6B-3 with evidence.
5. `C:\philos\FABLE5_PHASE1_VAULT_AUDIT_2026-07-06.md` - verified ground-truth table (do NOT re-derive these facts).
6. `C:\philos\FABLE5_AUDIT_PLAN.md` - the 16-phase plan incl. the Phase 6B Sonnet brief (items 3-9) and Phase 16 capstone documentation pass.
7. Only if needed for depth: `FABLE5_FACT_FINDING.md`, `SONNET5_FIXES_LOG_2026-07-06.md` (pre-audit, partially superseded by this session's findings - e.g. this session found the fact-finding's "20 likert questions" figure wrong; there are 72).

## 3. DECIDED vs NOT DECIDED - the critical distinction

**DECIDED (by Andre, dated 2026-07-06, safe to act on):**
- Single-agent dual-lens audit approach (Phase 2 Section 0).
- PostHog for analytics (Phase 13). Axis-level compatibility scoring (Phase 14, timing still open).
- Report/card architecture question resolved at the FRAMEWORK level per his "reverse hybrid" instruction: examined in Phase 5, hybrid recommended - but the specific P5-2/C1 package still needs his Checkpoint A approval.
- Phase 11 is a FULL database re-architecture (he overruled my narrower scoping; design doc for his approval is owed).
- AI chat feature: backlogged as a product feature, but audited now (P6B-1); gate recommendation pending his B-item ruling.
- Research-use consent is a REQUIREMENT (P6B-3): separate default-OFF opt-in, de-identified scores/age/gender/country, toggleable in Settings, stored in Supabase with version+timestamp. Not yet built - feeds Phase 11 design and consent redesign.
- Phase 16 capstone documentation pass exists (his directive; replication-from-docs is the bar).

**NOT DECIDED - everything in `FABLE5_CHECKPOINT_A_DECISIONS.md` (A1-A6, B, C1-C2, D1-D6) is Fable's RECOMMENDATION ONLY. Do not treat any of it as ruled. Do not begin Phase 7, push any fix, or amend any locked decision (A7, P7-card-format, C01b, etc.) until Andre has explicitly ruled item by item. When he rules, write each ruling as a dated Decisions Log entry (continue numbering from D31) BEFORE acting on it.**

## 4. The cautionary tale you are here to not repeat

On 2026-06-20, decision D7 locked "the reversed flag is Likert-only" while decision D6 - same session - shipped a fix that violated it (added flags to three scenario/tradeoff items). Nobody noticed for 16 days. The failure mode is: acting on a rule and an exception in the same breath without cross-checking. Your protections: (1) log rulings before acting, (2) after any content/code change, run the verification passes (dash check, `node --check`, and for scoring changes the item-vs-AXIS_META semantic check - both directions: mechanical AND semantic; t15em04 got half-checked twice by two different sessions and stayed broken).

## 5. What begins, in order, once Andre rules

1. **Log rulings** to `Phil OS - Decisions Log.md` (dated, D32+). Update `FABLE5_CHECKPOINT_A_DECISIONS.md` marking each item ruled.
2. **Ship the B batch** (if approved): phantom comma at index.html:7269, t1tel06b flag removal, chat env-flag gate, D9 stem rewrites (t2m02/t3so04 - approved since June, verify against QB v3 drafts). Validate: `node --check` on extracted script + re-run the Phase 3 keying/coverage scripts (scratchpad scripts are gone with the old session; re-create from the v4 doc's method notes - all analyses are reproducible from index.html alone). Andre pushes via GitHub Desktop.
3. **Write the Phase 11 DB target-architecture doc** (owed deliverable E1): tables/views/policies, real-time QA-flag writes, research-consent storage, fixes for the 4 SECURITY DEFINER views + anon-executable handle_new_user + gdpr_consent_log anon exposure. For Andre's approval only - no production changes.
4. **Start Phase 7** (question bank rewrite) against the standard's Section 11 contract + the A6 REWRITE/MODIFY list. Conservative rewrite: ~82% of items untouched; fix the enumerated list; bank-wide language to grade <=10; explanations rewrite is Phase 10c (grade <=8, no sibling references per D23).
5. **Ingest the Sonnet 6B dossier** when Andre runs that brief (items 3-9; i18n decision waits on it).

## 6. Standing rules that bite (from memory + this session)

- **NEW STANDARD (Andre, 2026-07-06, corrects a convention this very file violates): the Obsidian vault is the single source of truth - ALL working documents (plans, findings, standards, decision lists, handovers) are saved in the vault (`757 - Phil OS`, usually 776), never as loose .md files in `C:\philos\`.** Only CLAUDE.md and `.claude/` tooling stay in the repo. Sonnet 5 is migrating the existing `C:\philos\FABLE5_*`/`SONNET5_*` docs into the vault; after that migration, treat the VAULT copies as canonical and update any pointer you find (CLAUDE.md step 0/priorities, Master Index, memory file) that still says `C:\philos\`. Every new doc you create: vault, with proper frontmatter.
- **No em or en dashes anywhere** - filenames, docs, code comments, generated content. Verify with a dedicated pass after writing; instruction-only compliance provably fails.
- Vault notes: frontmatter field order is mandatory (copy an existing 776 note); a formatter hook rewrites files after every edit - re-read before re-editing the same region.
- The Obsidian MCP index goes stale - use direct Read/Grep/Glob on vault files, not vector_search, for facts.
- Verify claims against LIVE code (`C:\philos\index.html`, `api/*.js`) and the LIVE Supabase project (`Phil/OS`, id `qzazpihvayeqjfgtbakr` - MCP access works), never against docs alone. The card is 1080x1920. The model is claude-sonnet-5. There are exactly 42 real contradiction rules (12A/22B/8C) plus one phantom array slot.
- End-of-session trigger: when Andre says "end of session" (or equivalent), run the full closeout per `CLAUDE.md`: Build Log entry, Decisions Log, Master Index, CLAUDE.md state table, memory update. **This session's closeout status: check the Build Log for a 2026-07-06 Fable entry; if absent, this session ended without the formal closeout and YOU should write the audit-session entry retroactively from this handover + the v4 doc.**
- Andre's working style: direct, no yes-manning, push back with reasons, one clarifying question max, flag hyperfocus traps. He is not a coder - deliver working validated things, not instructions.

## 7. Loose ends ledger

| Item | Status |
|---|---|
| Andre's Checkpoint A rulings | ⏳ The gate everything waits on |
| Sonnet 6B run (items 3-9) | ⏳ Brief ready in the plan; Andre triggers it |
| Phase 11 DB design doc | ⏳ Owed by Fable (E1) |
| Formal end-of-session closeout | ⏳ Run when Andre says the phrase (see Section 6) |
| i18n translate-vs-remove decision | ⏳ Waits on Sonnet 6B item 8 |
| AI chat pre-ship fix list | 📋 Documented in P6B-1; travels with the backlogged feature |
| Compatibility feature (Phase 14) | 📋 Axis-level decided; timing after Phase 15 |
| `meaning` axis item-ID oddities (t2me02/03/05/06/06b numbering) | 📋 Cosmetic, note for Phase 7 |
