-- The day rate and holidays (docs/adr/0012, docs/DOMAIN.md §5).
--
-- On Saturdays, Sundays and holidays everyone who worked earns the same fixed amount, whatever
-- their position. This migration adds what the database needs to know about it:
--
-- 1. Day-rate defaults on bonus_settings, one per kind of date. All three are null on a version
--    that predates the day rate, and then no date it covers is paid under it.
-- 2. calendar_dates: the holidays HR marks, and the amount HR sets for one date when it differs
--    from the default. Written by editors and the admin; its history feeds the review list.
-- 3. private.is_day_rate_date, the database's copy of the rule, used where SQL must agree with the
--    calculation: what close_period counts as owed, and which history rows are review items.
-- 4. close_period settles every assignment the calculation pays: bonus-eligible ones as before,
--    and on a day-rate date every assignment to a position that is not an absence.
-- 5. review_history covers changes to a closed date's holiday mark or day rate too.

-- 1 -------------------------------------------------------------------------------------------

alter table public.bonus_settings
  add column saturday_day_rate int check (saturday_day_rate > 0),
  add column sunday_day_rate   int check (sunday_day_rate > 0),
  add column holiday_day_rate  int check (holiday_day_rate > 0),
  add constraint bonus_settings_day_rates_together check (
    (saturday_day_rate is null) = (sunday_day_rate is null)
    and (sunday_day_rate is null) = (holiday_day_rate is null)
  );

drop function public.create_bonus_settings_version(date, int, int, jsonb);

-- p_rates: [{ "position_id": uuid, "amount": int }, ...], one per rate-bearing position. The
-- scheme trigger has no rate by design.
create function public.create_bonus_settings_version(
  p_effective_from         date,
  p_daily_cap              int,
  p_max_amount_per_person  int,
  p_rates                  jsonb,
  p_saturday_day_rate      int,
  p_sunday_day_rate        int,
  p_holiday_day_rate       int
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

  insert into public.bonus_settings
    (effective_from, daily_cap, max_amount_per_person, saturday_day_rate, sunday_day_rate, holiday_day_rate)
  values
    (p_effective_from, p_daily_cap, p_max_amount_per_person, p_saturday_day_rate, p_sunday_day_rate, p_holiday_day_rate)
  returning id into new_version_id;

  insert into public.bonus_position_rates (bonus_settings_id, position_id, amount)
  select new_version_id, (rate ->> 'position_id')::uuid, (rate ->> 'amount')::int
  from jsonb_array_elements(p_rates) rate;

  return new_version_id;
end;
$$;

revoke execute on function public.create_bonus_settings_version from public, anon;
grant execute on function public.create_bonus_settings_version to authenticated;

-- 2 -------------------------------------------------------------------------------------------

create table public.calendar_dates (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  holiday     boolean not null default false,
  -- The amount for this one date, when HR sets one; null means the default for its kind.
  day_rate    int check (day_rate > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index calendar_dates_date_key on public.calendar_dates (date) where deleted_at is null;

create trigger calendar_dates_set_updated_at before update on public.calendar_dates
  for each row execute function private.set_updated_at();

-- HR's work: the admin and editors. Kept apart from is_member so a role that may only assign
-- people never inherits it.
create function private.may_manage_calendar() returns boolean
language sql stable as $$
  select private.app_role() in ('admin', 'editor');
$$;

alter table public.calendar_dates enable row level security;

create policy "members read calendar_dates" on public.calendar_dates
  for select to authenticated using (private.is_member());
create policy "hr inserts calendar_dates" on public.calendar_dates
  for insert to authenticated with check (private.may_manage_calendar());
create policy "hr updates calendar_dates" on public.calendar_dates
  for update to authenticated using (private.may_manage_calendar()) with check (private.may_manage_calendar());

-- Sets one date's holiday mark and amount to their full new state. Runs as the caller, so the
-- policies above apply. An unchanged date is not rewritten and records no history.
create function public.set_calendar_date(p_date date, p_holiday boolean, p_day_rate int default null)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.calendar_dates (date, holiday, day_rate)
  values (p_date, p_holiday, p_day_rate)
  on conflict (date) where deleted_at is null
  do update set holiday = excluded.holiday, day_rate = excluded.day_rate
  where (calendar_dates.holiday, calendar_dates.day_rate)
        is distinct from (excluded.holiday, excluded.day_rate);
end;
$$;

revoke execute on function public.set_calendar_date from public, anon;
grant execute on function public.set_calendar_date to authenticated;

-- Append-only, written by trigger, acknowledged once: the same contract as assignment_history.
create table public.calendar_date_history (
  id                  uuid primary key default gen_random_uuid(),
  calendar_date_id    uuid not null references public.calendar_dates (id),
  date                date not null,
  previous_holiday    boolean not null,
  new_holiday         boolean not null,
  previous_day_rate   int,
  new_day_rate        int,
  changed_by          uuid references auth.users (id),
  changed_at          timestamptz not null default now(),
  acknowledged_at     timestamptz,
  acknowledged_by     uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index calendar_date_history_date_idx on public.calendar_date_history (date);

-- A date with no row is an ordinary date: not a holiday, default amount. An insert therefore
-- moves from that state.
create function private.record_calendar_date_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous_holiday boolean := case when tg_op = 'UPDATE' then old.holiday else false end;
  previous_day_rate int := case when tg_op = 'UPDATE' then old.day_rate end;
begin
  if (previous_holiday, previous_day_rate) is distinct from (new.holiday, new.day_rate) then
    insert into public.calendar_date_history
      (calendar_date_id, date, previous_holiday, new_holiday, previous_day_rate, new_day_rate, changed_by)
    values (new.id, new.date, previous_holiday, new.holiday, previous_day_rate, new.day_rate, auth.uid());
  end if;
  return null;
end;
$$;

create trigger calendar_dates_record_history after insert or update on public.calendar_dates
  for each row execute function private.record_calendar_date_history();

create function private.guard_calendar_history_acknowledgement() returns trigger
language plpgsql as $$
begin
  if old.acknowledged_at is not null then
    raise exception 'History row % is already acknowledged', old.id;
  end if;
  if new.acknowledged_at is null then
    raise exception 'The only permitted change to a history row is acknowledging it';
  end if;
  if (new.calendar_date_id, new.date, new.previous_holiday, new.new_holiday, new.previous_day_rate,
      new.new_day_rate, new.changed_by, new.changed_at, new.created_at, new.deleted_at)
     is distinct from
     (old.calendar_date_id, old.date, old.previous_holiday, old.new_holiday, old.previous_day_rate,
      old.new_day_rate, old.changed_by, old.changed_at, old.created_at, old.deleted_at) then
    raise exception 'History row % records what happened and cannot be rewritten', old.id;
  end if;

  new.acknowledged_by := auth.uid();
  return new;
end;
$$;

create trigger calendar_date_history_guard_acknowledgement before update on public.calendar_date_history
  for each row execute function private.guard_calendar_history_acknowledgement();
create trigger calendar_date_history_set_updated_at before update on public.calendar_date_history
  for each row execute function private.set_updated_at();
create trigger calendar_date_history_forbid_delete before delete on public.calendar_date_history
  for each row execute function private.forbid_delete();

alter table public.calendar_date_history enable row level security;

-- No insert policy: only the trigger above writes history.
create policy "members read calendar_date_history" on public.calendar_date_history
  for select to authenticated using (private.is_member());
create policy "hr acknowledges calendar_date_history" on public.calendar_date_history
  for update to authenticated using (private.may_manage_calendar()) with check (private.may_manage_calendar());

-- 3 -------------------------------------------------------------------------------------------

-- The SQL copy of src/domain/bonus/dayRate.ts: a date is paid under the day rate when HR set an
-- amount for it, or when it is a Saturday, a Sunday or a holiday and the settings in force on it
-- have day rates. Both copies are covered by tests; change them together.
create function private.is_day_rate_date(p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.calendar_dates calendar
    where calendar.date = p_date and calendar.deleted_at is null and calendar.day_rate is not null
  )
  or (
    (
      extract(isodow from p_date) in (6, 7)
      or exists (
        select 1 from public.calendar_dates calendar
        where calendar.date = p_date and calendar.deleted_at is null and calendar.holiday
      )
    )
    and exists (
      select 1 from public.bonus_settings settings
      where settings.deleted_at is null
        and settings.effective_from <= p_date
        and (settings.effective_to is null or p_date <= settings.effective_to)
        and settings.saturday_day_rate is not null
    )
  );
$$;

-- Whether an assignment is one the calculation pays, and so one a close must settle.
create function private.is_paid_assignment(p_date date, p_position_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.positions position
    where position.id = p_position_id
      and position.type = 'WORK'
      and (position.bonus_eligible or private.is_day_rate_date(p_date))
  );
$$;

-- 4 -------------------------------------------------------------------------------------------

-- p_settlements: [{ "assignment_id": uuid, "position_id": uuid, "amount": int }, ...], one entry
-- for every unsettled paid assignment dated on or before the period's end. Unchanged otherwise.
create or replace function public.close_period(
  p_period_id uuid,
  p_settlements jsonb,
  p_next_name text,
  p_next_end date
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  period public.periods;
  outstanding int;
  stamped int;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can close a period' using errcode = 'insufficient_privilege';
  end if;

  select * into period from public.periods
  where id = p_period_id and deleted_at is null
  for update;
  if not found or period.status <> 'OPEN' then
    raise exception 'Period % is not open', p_period_id using errcode = 'check_violation';
  end if;

  select count(*) into outstanding
  from public.assignments assignment
  where assignment.deleted_at is null
    and assignment.settled_in_period_id is null
    and assignment.date <= period.end_date
    and private.is_paid_assignment(assignment.date, assignment.position_id);

  update public.assignments assignment
     set settled_in_period_id = period.id,
         settled_amount = (settlement ->> 'amount')::int
    from jsonb_array_elements(p_settlements) settlement
   where assignment.id = (settlement ->> 'assignment_id')::uuid
     and assignment.position_id = (settlement ->> 'position_id')::uuid
     and assignment.deleted_at is null
     and assignment.settled_in_period_id is null
     and assignment.date <= period.end_date;
  get diagnostics stamped = row_count;

  -- Anything added, removed or moved since the plan was made changes what is owed. Settle
  -- nothing rather than something the admin did not see.
  if stamped <> outstanding or stamped <> jsonb_array_length(p_settlements) then
    raise exception 'The assignments changed while the close was being prepared'
      using errcode = 'serialization_failure';
  end if;

  update public.periods set status = 'CLOSED' where id = period.id;

  if not exists (
    select 1 from public.periods later
    where later.start_date > period.end_date and later.deleted_at is null
  ) then
    insert into public.periods (name, start_date, end_date)
    values (p_next_name, period.end_date + 1, p_next_end);
  end if;
end;
$$;

-- 5 -------------------------------------------------------------------------------------------

-- Assignment rows keep their rule, with "bonus-eligible" widened to "paid": on a day-rate date a
-- move to or from any work position changes what is owed. Calendar rows qualify when they came
-- after the close of the closed period holding their date. New columns go last, as a view
-- replacement requires; `kind` says which history table a row lives in.
drop view public.review_items;
drop view public.review_history;

create view public.review_history with (security_invoker = true) as
select
  history.id                    as history_id,
  history.assignment_id,
  history.date,
  history.employee_id,
  history.previous_position_id,
  history.new_position_id,
  history.changed_by,
  history.changed_at,
  period.id                     as period_id,
  history.acknowledged_at,
  history.acknowledged_by,
  'ASSIGNMENT'::text            as kind,
  null::boolean                 as previous_holiday,
  null::boolean                 as new_holiday,
  null::int                     as previous_day_rate,
  null::int                     as new_day_rate
from public.assignment_history history
join public.assignments assignment on assignment.id = history.assignment_id
join lateral (
  select closed.id
  from public.periods closed
  where closed.status = 'CLOSED'
    and closed.deleted_at is null
    and history.changed_at > closed.closed_at
    and (
      closed.id = assignment.settled_in_period_id
      or (
        history.date between closed.start_date and closed.end_date
        and (
          private.is_paid_assignment(history.date, history.previous_position_id)
          or private.is_paid_assignment(history.date, history.new_position_id)
        )
      )
    )
  order by (closed.id is not distinct from assignment.settled_in_period_id) desc
  limit 1
) period on true
where history.deleted_at is null
union all
select
  history.id,
  null,
  history.date,
  null,
  null,
  null,
  history.changed_by,
  history.changed_at,
  closed.id,
  history.acknowledged_at,
  history.acknowledged_by,
  'CALENDAR',
  history.previous_holiday,
  history.new_holiday,
  history.previous_day_rate,
  history.new_day_rate
from public.calendar_date_history history
join public.periods closed
  on closed.status = 'CLOSED'
 and closed.deleted_at is null
 and history.date between closed.start_date and closed.end_date
 and history.changed_at > closed.closed_at
where history.deleted_at is null;

create view public.review_items with (security_invoker = true) as
select
  history_id,
  assignment_id,
  date,
  employee_id,
  previous_position_id,
  new_position_id,
  changed_by,
  changed_at,
  period_id,
  kind
from public.review_history
where acknowledged_at is null;

-- 6 -------------------------------------------------------------------------------------------

-- Two catalogue positions. Production received them by hand on 2026-10-08, before this migration
-- ran; the insert skips any code already present, so here it only reaches fresh databases.
-- Mantas Rieter is the Rieter making blankets with 3 or 4 people, paid as an equal share like
-- Packing ACM. Vacaciones completes the absences: with Falta and Licencia it covers every reason
-- someone does not show up, and none of them works the day rate.
insert into public.positions (code, name, abbreviation, type, bonus_eligible, triggers_equal_share, display_order)
select code, name, abbreviation, type, bonus_eligible, triggers_equal_share, display_order
from (values
  ('MANTAS_RIETER', 'Mantas Rieter', 'MRI', 'WORK',    true,  true,  60),
  ('VACACIONES',    'Vacaciones',    'VAC', 'ABSENCE', false, false, 930)
) as catalogue (code, name, abbreviation, type, bonus_eligible, triggers_equal_share, display_order)
where not exists (
  select 1 from public.positions existing
  where existing.code = catalogue.code and existing.deleted_at is null
);
