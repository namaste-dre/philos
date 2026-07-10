This folder did not exist before 2026-07-10. Migrations applied to the live
Phil/OS Supabase project before that date exist only in Supabase's own
platform-side migration history (visible via the Supabase MCP
`list_migrations` tool or the dashboard), not in this repo:

- 20260527212436 add_reversed_and_scored_value_to_responses
- 20260622200631 add_qa_flags_to_assessment_progress
- 20260706182236 m1_security_hardening_d56
- 20260706185226 m2_rls_policy_dedupe_d56
- 20260706185948 m3_additive_schema_d58
- 20260706201139 m5_merge_completions_d58

Their exact SQL is not reproduced here because it was not available to
reconstruct without guessing - flagging this as a real gap rather than
fabricating file contents from memory or summaries. Backfilling these into
this folder (via `supabase db pull` against the live project, or manually
re-deriving each from the live schema) is a separate, standalone task, not
bundled into the consent-architecture work that started this folder.

Everything from 20260710151338 onward is the actual, verbatim SQL that was
applied, added to this repo at the same time it was applied to the live
database.
