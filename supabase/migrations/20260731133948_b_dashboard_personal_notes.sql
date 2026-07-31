-- Dashboard build, Section 2/Section 3.12 of the Dashboard and History
-- Specification: personal notes per completion.
--
-- Lyra's 2026-07-27 review resolved the persistence-model question
-- explicitly: notes must use a child table / separate persistence model,
-- NOT a mutable column on completions (which would make the completion
-- row a moving target after the fact). This migration creates that table.
--
-- Design:
--   - One row per (completion_id) - a completion has at most one note,
--     matching the spec's "a free-text note a user can attach to a
--     specific completion" (singular, not a thread/history of edits).
--     Editing overwrites; updated_at tracks the last edit. If Andre later
--     wants note edit HISTORY (the spec explicitly leaves this open -
--     "whether notes support edit history" is a build-time detail), that
--     is a additive future migration, not a redesign of this one.
--   - completion_id is UNIQUE + FK to completions, ON DELETE CASCADE - a
--     note cannot outlive the completion it annotates, and cannot be
--     attached to more than one completion.
--   - user_id is stored redundantly (not just derivable via completion_id
--     join) so the API can authorize a note read/write with a single
--     indexed lookup, the same shape as every other user-owned table in
--     this schema.
--   - RLS enabled, NO policies - same deliberate pattern D133 already
--     ruled correct for anon_progress/rate_limits/research_profiles/
--     responses: every application code path uses SUPABASE_SERVICE_KEY
--     exclusively (never SUPABASE_ANON_KEY for data access), and
--     service_role has rolbypassrls=true, so RLS policies here would add
--     no real security and only silence the linter. Ownership is enforced
--     in application code (api/capture.js dashboard actions), matching
--     every other write path in this project (api/claim-attempt.js,
--     api/share-control.js).
--   - note_text capped at the database layer (2000 chars) as defense in
--     depth; the API enforces the same cap before this constraint is ever
--     reached.

CREATE TABLE public.personal_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id  uuid NOT NULL UNIQUE REFERENCES public.completions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text      text NOT NULL CHECK (char_length(note_text) <= 2000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX personal_notes_user_id_idx ON public.personal_notes(user_id);

ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;
