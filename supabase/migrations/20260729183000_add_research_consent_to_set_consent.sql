-- Finding 1 (D118 architecture addendum, path (a), 2026-07-29): extends
-- set_consent() with a 'research' branch so onboarding-time research-consent
-- intent can be captured through the same canonical /api/consent path
-- already used for gdpr/marketing, rather than inventing a new mechanism.
-- The existing 'gdpr' and 'marketing' branches below are unchanged verbatim -
-- only a new elsif branch is added and the final else/exception is preserved.
--
-- This function only records INTENT (profiles.research_consent,
-- profiles.research_consent_version, plus the audit row in consent_log). It
-- does not populate research_profiles - that de-identified population still
-- happens exactly as it already does for the Settings-page toggle path
-- (api/research-sync.js, unchanged), or, for the new onboarding-time path,
-- server-side in api/claim-attempt.js's 'complete' handler once a report
-- first exists to populate it from.

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
  elsif p_consent_type = 'research' then
    update public.profiles
      set research_consent = p_granted,
          research_consent_version = p_consent_version
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
