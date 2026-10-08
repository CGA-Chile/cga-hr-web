-- The supervisor role (docs/adr/0013, docs/DOMAIN.md §4).
--
-- The production supervisor assigns people to positions and marks late arrivals, and never sees
-- an amount. Policies that let any member write assignments keep doing so, which is what the
-- supervisor needs. What changes is everything HR does around the money: reading rates,
-- settings and validated excesses, moving a period's end, marking holidays, acknowledging review
-- items. Those now require a role that sees amounts, admin or editor.
--
-- What this does not hide: an assignment's frozen settled_amount and a date's day_rate override
-- stay readable to every member. Hiding a column under RLS means splitting the table or the
-- grants for every role; the supervisor's screens never ask for them, and what they reveal is
-- the past, not the rates. docs/adr/0013 records the trade-off.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'editor', 'supervisor'));

create or replace function private.sync_profile_from_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  granted_role text := new.raw_app_meta_data ->> 'role';
  username text := split_part(new.email, '@', 1);
begin
  if granted_role in ('admin', 'editor', 'supervisor') then
    insert into public.profiles (id, role, username) values (new.id, granted_role, username)
    on conflict (id) do update
      set role = excluded.role, username = excluded.username, deleted_at = null;
  else
    update public.profiles set deleted_at = now() where id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

-- Admin and editors: the roles that work with amounts. False, never null, for a user with no role,
-- so a plpgsql `if not` on it refuses them. may_manage_calendar already meant the
-- same two roles; it is kept as the name the calendar policies read.
create function private.sees_amounts() returns boolean
language sql stable as $$
  select coalesce(private.app_role() in ('admin', 'editor'), false);
$$;

drop policy "members read bonus_settings" on public.bonus_settings;
create policy "hr reads bonus_settings" on public.bonus_settings
  for select to authenticated using (private.sees_amounts());

drop policy "members read bonus_position_rates" on public.bonus_position_rates;
create policy "hr reads bonus_position_rates" on public.bonus_position_rates
  for select to authenticated using (private.sees_amounts());

drop policy "members read cap_overrides" on public.cap_overrides;
create policy "hr reads cap_overrides" on public.cap_overrides
  for select to authenticated using (private.sees_amounts());

drop policy "members acknowledge assignment_history" on public.assignment_history;
create policy "hr acknowledges assignment_history" on public.assignment_history
  for update to authenticated using (private.sees_amounts()) with check (private.sees_amounts());

create or replace function public.set_period_end(p_period_id uuid, p_end_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.sees_amounts() then
    raise exception 'Only HR or the admin can change a period''s end' using errcode = 'insufficient_privilege';
  end if;

  update public.periods
     set end_date = p_end_date
   where id = p_period_id
     and deleted_at is null
     and status = 'OPEN';
  if not found then
    raise exception 'Period % is not open', p_period_id using errcode = 'check_violation';
  end if;
end;
$$;
