-- Applied directly to the live Phil/OS Supabase project (qzazpihvayeqjfgtbakr)
-- on 2026-07-10 via the Supabase MCP apply_migration tool. This file is the
-- repo-tracked record of that change, added after the fact per Andre's
-- Step 2 cleanup request - the migration existed only in Supabase's own
-- platform-side history before this commit, not in version control.
--
-- set_consent() updates profiles and inserts into consent_log inside one
-- function call, so both writes commit or roll back together. Called via
-- POST /rest/v1/rpc/set_consent from api/consent.js using the service key.

create or replace function public.set_consent(
  p_user_id uuid,
  p_consent_type text,
  p_granted boolean,
  p_consent_version text,
  p_source text,
  p_text_snapshot text
) returns void
language plpgsql
as $$
begin
  if p_consent_type = 'marketing' then
    update public.profiles
      set marketing_consent = p_granted
      where id = p_user_id;
  elsif p_consent_type = 'gdpr' then
    update public.profiles
      set gdpr_consent = p_granted,
          consented_at = now()
      where id = p_user_id;
  else
    raise exception 'set_consent: unsupported consent_type %', p_consent_type;
  end if;

  if not found then
    raise exception 'set_consent: no profile row for user %', p_user_id;
  end if;

  insert into public.consent_log (user_id, consent_type, granted, consent_version, consent_text_snapshot, source)
  values (p_user_id, p_consent_type, p_granted, p_consent_version, p_text_snapshot, p_source);
end;
$$;
