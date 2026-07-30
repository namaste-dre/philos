-- A7: share-link revocation (Release Control Board A7, Decisions Log D135/D136).
-- Adds minimal, launch-safe revoke/regenerate capability to the existing
-- capability-token share link (api/report.js + api/capture.js).
--
-- Design (D136 / A7 packet, Option 1 - preserve existing links until user
-- action, no intentional link reset at launch):
--   - share_enabled defaults true, preserving today's always-shareable
--     behavior for every existing row with zero code-path change until a
--     user explicitly revokes.
--   - share_token_salt has NO default and stays NULL for every row unless
--     explicitly set by a regenerate action. A NULL salt means "validate
--     with the legacy id-only HMAC token" (api/report.js and api/capture.js
--     both branch on this). This is a metadata-only ALTER - no UPDATE
--     touches existing rows, so no live share link is invalidated by this
--     migration by itself.
--   - share_revoked_at is an optional audit/support timestamp, not
--     security-load-bearing (share_enabled alone gates access) - included
--     per Andre's instruction for support-debugging visibility.
--
-- Regenerate (application-level, api/share-control.js) writes a fresh random
-- share_token_salt and sets share_enabled = true - this permanently
-- invalidates every token computed under the old formula (legacy or a prior
-- salt), even if sharing is later re-enabled again, satisfying D-1's
-- explicit requirement to avoid a revoked deterministic URL silently
-- revalidating.

ALTER TABLE public.completions
  ADD COLUMN share_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN share_token_salt text NULL,
  ADD COLUMN share_revoked_at timestamptz NULL;
