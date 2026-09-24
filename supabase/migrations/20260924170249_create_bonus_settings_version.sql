-- Changing a rate creates a new version; the current one is never edited (docs/DOMAIN.md §6).
-- Ending the current version and starting the next are one act, so they happen in one
-- transaction: there is never a moment with two versions in force, or none.
--
-- p_rates: [{ "position_id": uuid, "amount": int }, ...], one per rate-bearing position. The
-- scheme trigger has no rate by design.

create function public.create_bonus_settings_version(
  p_effective_from         date,
  p_daily_cap              int,
  p_max_amount_per_person  int,
  p_rates                  jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  current_version public.bonus_settings;
  new_version_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can change rates' using errcode = 'insufficient_privilege';
  end if;

  select * into current_version from public.bonus_settings
  where effective_to is null and deleted_at is null
  for update;

  if found then
    if p_effective_from <= current_version.effective_from then
      raise exception 'A new version must start after the current one (%)', current_version.effective_from
        using errcode = 'check_violation';
    end if;
    update public.bonus_settings set effective_to = p_effective_from - 1 where id = current_version.id;
  end if;

  insert into public.bonus_settings (effective_from, daily_cap, max_amount_per_person)
  values (p_effective_from, p_daily_cap, p_max_amount_per_person)
  returning id into new_version_id;

  insert into public.bonus_position_rates (bonus_settings_id, position_id, amount)
  select new_version_id, (rate ->> 'position_id')::uuid, (rate ->> 'amount')::int
  from jsonb_array_elements(p_rates) rate;

  return new_version_id;
end;
$$;

revoke execute on function public.create_bonus_settings_version from public, anon;
grant execute on function public.create_bonus_settings_version to authenticated;
