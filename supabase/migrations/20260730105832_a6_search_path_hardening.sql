-- A6: Supabase hardening - function_search_path_mutable (Release Control Board A6,
-- Decisions Log D132). Fixes the two live security-advisor WARNs for
-- public.set_consent and public.claim_attempt: neither function currently
-- sets search_path, so both resolve unqualified object references against
-- whatever search_path the calling session/role has in effect.
--
-- Both functions are SECURITY INVOKER (confirmed via pg_proc.prosecdef =
-- false), which already lowers the real-world severity relative to a
-- SECURITY DEFINER function - an invoker function only ever runs with the
-- caller's own privileges, so a hijacked reference could only redirect it to
-- an object the caller could already reach. This migration closes the
-- advisor finding as defense-in-depth, not because there is a live
-- privilege-escalation path today.
--
-- Option B was chosen over Option A (SET search_path = public) because both
-- function bodies already schema-qualify every table they touch
-- (public.completions, public.profiles, public.consent_log - verified by
-- direct read of the live pg_get_functiondef() output and the local
-- migration files that created/last modified each function). The only
-- unqualified references in either body are built-in keywords (now(),
-- interval '10 minutes'), which resolve via pg_catalog - always implicitly
-- searched by Postgres regardless of the search_path setting, so an empty
-- search_path does not affect them. Because every real object reference is
-- already qualified, no schema-qualification changes were needed and no
-- function body changes were needed - this migration only sets the config
-- parameter via ALTER FUNCTION. Zero behavior change.

ALTER FUNCTION public.claim_attempt(p_attempt_id uuid, p_user_id uuid, p_qa_mode boolean)
  SET search_path = '';

ALTER FUNCTION public.set_consent(p_user_id uuid, p_consent_type text, p_granted boolean, p_consent_version text, p_source text, p_text_snapshot text)
  SET search_path = '';
