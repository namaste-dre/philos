-- A1: atomic assessment-attempt idempotency model (D110). Adds attempt
-- tracking columns directly onto the existing completions row rather than
-- a second table (D105: single canonical row, no split metadata, no merge
-- race). claim_attempt() performs the atomic claim-or-inspect-or-reclaim
-- operation in one function call. It is only ever invoked from the new
-- api/claim-attempt.js endpoint using the service role key, after that
-- endpoint has independently verified the caller's session - the function
-- itself does not need to enforce RLS or re-check identity, matching the
-- established security boundary already used by set_consent() and every
-- service-role write in this project (D56/D105): a service-role write
-- never trusts a client-supplied identity, only what the caller already
-- verified server-side.

alter table public.completions
  add column if not exists attempt_id uuid,
  add column if not exists attempt_status text not null default 'complete'
    check (attempt_status in ('pending', 'complete', 'failed')),
  add column if not exists claimed_at timestamptz;

create unique index if not exists completions_attempt_id_unique
  on public.completions (attempt_id)
  where attempt_id is not null;

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
  on conflict (attempt_id) do nothing
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
