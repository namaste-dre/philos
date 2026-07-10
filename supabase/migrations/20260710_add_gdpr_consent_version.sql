-- Applied directly to the live Phil/OS Supabase project on 2026-07-10, Step 3
-- of the consent architecture repair (Decisions Log, consent architecture
-- entries). Adds the minimum current-state versioning needed to gate
-- assessment/GDPR consent later - v1-2026-07 for the currently logged thin
-- consent, v2-2026-07 reserved for the expanded explicit assessment consent
-- wording (not built yet - that is Step 4, the unified onboarding/re-consent
-- UI).
--
-- gdpr_consent_source was considered and NOT added: consent_log.source
-- already covers this, and no gating or display need was identified that
-- required duplicating it onto profiles.
-- marketing_consented_at was considered and NOT added: consent_log.created_at
-- remains the audit timestamp; no concrete UI/reporting need for a second
-- timestamp on profiles.

alter table public.profiles
  add column if not exists gdpr_consent_version text;

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
          consented_at = now(),
          gdpr_consent_version = p_consent_version
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
