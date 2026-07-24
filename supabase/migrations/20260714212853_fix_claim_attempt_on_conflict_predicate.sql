-- Fix claim_attempt() production defect found during F1 (2026-07-14): the
-- A1 migration (20260712220000_a1_attempt_claim_model.sql) created a PARTIAL
-- unique index, completions_attempt_id_unique, "on (attempt_id) where
-- attempt_id is not null" - but the function's own INSERT used a plain
-- "on conflict (attempt_id) do nothing" with no matching predicate. Postgres
-- cannot infer a partial index as an ON CONFLICT arbiter unless the INSERT's
-- own conflict target repeats that same predicate, so every real call to
-- this function failed with 42P10 ("there is no unique or exclusion
-- constraint matching the ON CONFLICT specification") - reproduced directly
-- in a rolled-back transaction before this fix was written. This has been
-- broken since the function was first created; it is not a regression from
-- an unrelated change.
--
-- Preflight before this migration (recorded here, full detail in the F1
-- repair report): zero rows exist with a duplicate non-null attempt_id, so
-- adding the correct conflict target introduces no retroactive conflict.
--
-- The ONLY change from the function as originally shipped is the addition
-- of "where attempt_id is not null" to the existing on conflict clause,
-- matching the existing partial index's own predicate exactly. No new
-- table, column, index, or constraint. Signature, return type, language,
-- security mode (invoker, unchanged), volatility, ownership, grants, the
-- row-locking/reclaim logic, and every other line of the function body are
-- otherwise byte-identical to the version this replaces.

create or replace function public.claim_attempt(
  p_attempt_id uuid,
  p_user_id uuid,
  p_qa_mode boolean default false
) returns table(out_id uuid, out_status text, out_report_json jsonb, out_should_generate boolean)
language plpgsql
as $$
declare
  v_id uuid;
  v_status text;
  v_report jsonb;
  v_claimed_at timestamptz;
  v_should_generate boolean := false;
begin
  -- Atomic claim attempt: succeeds (FOUND) only for the single caller that
  -- wins the race on the unique attempt_id index. completed_at stays NULL
  -- here on purpose - fetchLatestCompletion() on the client orders by
  -- completed_at/generated_at/id and must never surface a still-pending
  -- row as someone's "latest" report.
  insert into public.completions (attempt_id, user_id, qa_mode, attempt_status, claimed_at)
  values (p_attempt_id, p_user_id, p_qa_mode, 'pending', now())
  on conflict (attempt_id) where attempt_id is not null do nothing
  returning id, attempt_status, report_json into v_id, v_status, v_report;

  if found then
    return query select v_id, v_status, v_report, true;
    return;
  end if;

  -- Someone already holds this attempt_id. Lock the row so concurrent
  -- reclaim attempts (failed or stale-pending) serialize instead of racing.
  select id, attempt_status, report_json, claimed_at into v_id, v_status, v_report, v_claimed_at
  from public.completions
  where attempt_id = p_attempt_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'claim_attempt: attempt % not found for user %', p_attempt_id, p_user_id;
  end if;

  -- Recoverable states (A1 (e)): a failed attempt, or a pending attempt
  -- whose claimant has been silent long enough to presume dead (stale
  -- timeout rule). Both reclaim the SAME attempt_id - never a new row.
  if v_status = 'failed' or (v_status = 'pending' and v_claimed_at < now() - interval '10 minutes') then
    update public.completions
      set attempt_status = 'pending', claimed_at = now()
      where id = v_id;
    v_should_generate := true;
    v_status := 'pending';
  end if;

  return query select v_id, v_status, v_report, v_should_generate;
end;
$$;
