-- The production and compliance bonuses (docs/adr/0016, docs/DOMAIN.md §5b).
--
-- Two bonuses paid per working day attended but computed per period, so only the close freezes
-- them. The calculation lives in src/domain/periodBonus/; the database stores what it needs and
-- what the close froze:
--
-- 1. Three position flags: which positions add days to each bonus, and which absence is a strike.
-- 2. The four amounts on bonus_settings, all or none.
-- 3. The terms a period freezes when it closes.
-- 4. reprimands: one per employee and period, written by HR while the period is open.
-- 5. period_bonus_settlements: what each close paid, per origin period, employee and bonus.
-- 6. Two stamps on assignments, one per bonus, so no close counts a day twice.
-- 7. private.is_working_day, the SQL copy of isWorkingDay, and what counts for each bonus.
-- 8. close_period freezes the terms, writes the rows and stamps, and refuses on any drift.
-- 9. The review list covers changes that matter to the period bonuses of a closed period.

-- 1 -------------------------------------------------------------------------------------------

alter table public.positions
  add column production_bonus  boolean not null default false,
  add column compliance_bonus  boolean not null default false,
  add column compliance_strike boolean not null default false,
  add constraint positions_production_bonus_is_work check (not production_bonus or type = 'WORK'),
  add constraint positions_compliance_bonus_is_work check (not compliance_bonus or type = 'WORK'),
  add constraint positions_compliance_strike_is_absence check (not compliance_strike or type = 'ABSENCE');

-- The catalogue as the plant pays it today: Bodega, Mantención and Supervisor earn no production
-- bonus, and Mantención and Supervisor no compliance bonus either. Data, so the admin changes it
-- for a new position without a deploy.
update public.positions
   set production_bonus = code not in ('BODEGA', 'MANTENCION', 'SUPERVISOR'),
       compliance_bonus = code not in ('MANTENCION', 'SUPERVISOR')
 where type = 'WORK' and deleted_at is null;

update public.positions set compliance_strike = true where code = 'FALTA_SIN_AVISO' and deleted_at is null;

-- 2 -------------------------------------------------------------------------------------------

alter table public.bonus_settings
  add column production_amount int check (production_amount > 0),
  add column compliance_amount int check (compliance_amount > 0),
  add column strike_deduction  int check (strike_deduction > 0),
  add column strike_limit      int check (strike_limit > 0),
  add constraint bonus_settings_period_bonuses_together check (
    (production_amount is null) = (compliance_amount is null)
    and (compliance_amount is null) = (strike_deduction is null)
    and (strike_deduction is null) = (strike_limit is null)
  );

drop function public.create_bonus_settings_version(date, int, int, jsonb, int, int, int);

-- As before, with the period-bonus amounts. They default to null so a caller that predates them
-- keeps working; such a version pays no period bonuses.
create function public.create_bonus_settings_version(
  p_effective_from         date,
  p_daily_cap              int,
  p_max_amount_per_person  int,
  p_rates                  jsonb,
  p_saturday_day_rate      int,
  p_sunday_day_rate        int,
  p_holiday_day_rate       int,
  p_production_amount      int default null,
  p_compliance_amount      int default null,
  p_strike_deduction       int default null,
  p_strike_limit           int default null
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
    (effective_from, daily_cap, max_amount_per_person, saturday_day_rate, sunday_day_rate, holiday_day_rate,
     production_amount, compliance_amount, strike_deduction, strike_limit)
  values
    (p_effective_from, p_daily_cap, p_max_amount_per_person, p_saturday_day_rate, p_sunday_day_rate, p_holiday_day_rate,
     p_production_amount, p_compliance_amount, p_strike_deduction, p_strike_limit)
  returning id into new_version_id;

  insert into public.bonus_position_rates (bonus_settings_id, position_id, amount)
  select new_version_id, (rate ->> 'position_id')::uuid, (rate ->> 'amount')::int
  from jsonb_array_elements(p_rates) rate;

  return new_version_id;
end;
$$;

revoke execute on function public.create_bonus_settings_version from public, anon;
grant execute on function public.create_bonus_settings_version to authenticated;

-- 3 -------------------------------------------------------------------------------------------

-- Null on an open period, and on a closed one that paid no period bonuses. A carry-over day is
-- paid at these, never at the settings as they stand later.
alter table public.periods
  add column working_days      int check (working_days >= 0),
  add column production_amount int check (production_amount > 0),
  add column compliance_amount int check (compliance_amount > 0),
  add column strike_deduction  int check (strike_deduction > 0),
  add column strike_limit      int check (strike_limit > 0),
  add constraint periods_bonus_terms_together check (
    (working_days is null) = (production_amount is null)
    and (production_amount is null) = (compliance_amount is null)
    and (compliance_amount is null) = (strike_deduction is null)
    and (strike_deduction is null) = (strike_limit is null)
  );

create function private.freeze_period_bonus_terms() returns trigger
language plpgsql as $$
begin
  if old.status = 'CLOSED'
     and (new.working_days, new.production_amount, new.compliance_amount, new.strike_deduction, new.strike_limit)
         is distinct from
         (old.working_days, old.production_amount, old.compliance_amount, old.strike_deduction, old.strike_limit) then
    raise exception 'Period % is closed and its bonus terms are frozen', old.id;
  end if;
  return new;
end;
$$;

create trigger periods_freeze_bonus_terms before update on public.periods
  for each row execute function private.freeze_period_bonus_terms();

-- 4 -------------------------------------------------------------------------------------------

create table public.reprimands (
  id           uuid primary key default gen_random_uuid(),
  period_id    uuid not null references public.periods (id),
  employee_id  uuid not null references public.employees (id),
  note         text,
  created_by   uuid references auth.users (id) default auth.uid(),
  deleted_by   uuid references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create unique index reprimands_period_employee_key on public.reprimands (period_id, employee_id)
  where deleted_at is null;

create trigger reprimands_set_updated_at before update on public.reprimands
  for each row execute function private.set_updated_at();
create trigger reprimands_forbid_delete before delete on public.reprimands
  for each row execute function private.forbid_delete();

create function private.is_open_period(p_period_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.periods period
    where period.id = p_period_id and period.status = 'OPEN' and period.deleted_at is null
  );
$$;

-- HR's record: the supervisor neither reads nor writes it. A closed period's reprimands are frozen
-- with its amounts.
alter table public.reprimands enable row level security;

create policy "hr reads reprimands" on public.reprimands
  for select to authenticated using (private.sees_amounts());
create policy "hr inserts reprimands in an open period" on public.reprimands
  for insert to authenticated with check (private.sees_amounts() and private.is_open_period(period_id));
create policy "hr updates reprimands in an open period" on public.reprimands
  for update to authenticated
  using (private.sees_amounts() and private.is_open_period(period_id))
  with check (private.sees_amounts() and private.is_open_period(period_id));

-- Sets whether an employee has a reprimand in a period, with its note. Removing one is a soft
-- delete that records who removed it. Runs as the caller, so the policies above apply.
create function public.set_reprimand(p_period_id uuid, p_employee_id uuid, p_reprimanded boolean, p_note text default null)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_reprimanded then
    insert into public.reprimands (period_id, employee_id, note)
    values (p_period_id, p_employee_id, nullif(trim(p_note), ''))
    on conflict (period_id, employee_id) where deleted_at is null
    do update set note = excluded.note
    where reprimands.note is distinct from excluded.note;
  else
    update public.reprimands
       set deleted_at = now(), deleted_by = auth.uid()
     where period_id = p_period_id and employee_id = p_employee_id and deleted_at is null;
  end if;
end;
$$;

revoke execute on function public.set_reprimand from public, anon;
grant execute on function public.set_reprimand to authenticated;

-- 5 -------------------------------------------------------------------------------------------

create table public.period_bonus_settlements (
  id                uuid primary key default gen_random_uuid(),
  -- The close that paid it.
  period_id         uuid not null references public.periods (id),
  -- The period the days belong to: the same one, or an earlier one for carry-over.
  origin_period_id  uuid not null references public.periods (id),
  employee_id       uuid not null references public.employees (id),
  bonus             text not null check (bonus in ('PRODUCTION', 'COMPLIANCE')),
  days              int not null check (days >= 0),
  strikes           int not null check (strikes >= 0),
  reprimanded       boolean not null,
  amount            int not null check (amount >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create unique index period_bonus_settlements_key
  on public.period_bonus_settlements (period_id, origin_period_id, employee_id, bonus)
  where deleted_at is null;
create index period_bonus_settlements_origin_idx on public.period_bonus_settlements (origin_period_id, employee_id);

create trigger period_bonus_settlements_forbid_update before update on public.period_bonus_settlements
  for each row execute function private.forbid_update();
create trigger period_bonus_settlements_forbid_delete before delete on public.period_bonus_settlements
  for each row execute function private.forbid_delete();

alter table public.period_bonus_settlements enable row level security;

-- Written by close_period, which runs as the admin, while the period it closes is still open.
create policy "hr reads period_bonus_settlements" on public.period_bonus_settlements
  for select to authenticated using (private.sees_amounts());
create policy "the close inserts period_bonus_settlements" on public.period_bonus_settlements
  for insert to authenticated with check (private.is_admin() and private.is_open_period(period_id));

-- 6 -------------------------------------------------------------------------------------------

alter table public.assignments
  add column production_settled_in_period_id uuid references public.periods (id),
  add column compliance_settled_in_period_id uuid references public.periods (id);

-- Like the carding settlement: once a close counted a day, no one un-counts it.
create function private.freeze_period_bonus_stamps() returns trigger
language plpgsql as $$
begin
  if (old.production_settled_in_period_id is not null
      and new.production_settled_in_period_id is distinct from old.production_settled_in_period_id)
     or (old.compliance_settled_in_period_id is not null
      and new.compliance_settled_in_period_id is distinct from old.compliance_settled_in_period_id) then
    raise exception 'Assignment % was counted for a period bonus and its stamp is frozen', old.id;
  end if;
  return new;
end;
$$;

create trigger assignments_freeze_period_bonus_stamps before update on public.assignments
  for each row execute function private.freeze_period_bonus_stamps();

-- 7 -------------------------------------------------------------------------------------------

-- The SQL copy of isWorkingDay in src/domain/bonus/dayRate.ts: Monday to Friday, not a holiday,
-- and not a date HR gave its own day rate. Change both together.
create function private.is_working_day(p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select extract(isodow from p_date) between 1 and 5
    and not exists (
      select 1 from public.calendar_dates calendar
      where calendar.date = p_date
        and calendar.deleted_at is null
        and (calendar.holiday or calendar.day_rate is not null)
    );
$$;

create function private.count_working_days(p_start date, p_end date) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from generate_series(p_start, p_end, interval '1 day') as day
  where private.is_working_day(day::date);
$$;

-- Whether an assignment adds a day to `p_bonus`: a working day attended on a position that earns it.
create function private.counts_for_period_bonus(p_date date, p_position_id uuid, p_bonus text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_working_day(p_date) and exists (
    select 1 from public.positions position
    where position.id = p_position_id
      and position.type = 'WORK'
      and case p_bonus when 'PRODUCTION' then position.production_bonus else position.compliance_bonus end
  );
$$;

-- Whether a change to this assignment can change a period bonus: it adds a day, or it is a strike.
-- A late mark on a position that counts is covered by the first, since the position is the same on
-- both sides of the change.
create function private.matters_for_period_bonuses(p_date date, p_position_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.counts_for_period_bonus(p_date, p_position_id, 'PRODUCTION')
      or private.counts_for_period_bonus(p_date, p_position_id, 'COMPLIANCE')
      or exists (
        select 1 from public.positions position
        where position.id = p_position_id and position.compliance_strike
      );
$$;

-- 8 -------------------------------------------------------------------------------------------

drop function public.close_period(uuid, jsonb, text, date);

-- p_settlements: as before. p_period_bonuses, built by src/domain/periodBonus/planPeriodBonusClose:
--   {
--     "terms":       { "working_days", "production_amount", "compliance_amount",
--                      "strike_deduction", "strike_limit" } | null,
--     "settlements": [{ "origin_period_id", "employee_id", "bonus", "days", "strikes",
--                       "reprimanded", "amount" }, ...],
--     "stamps":      [{ "assignment_id", "position_id", "bonus" }, ...]
--   }
-- Null skips the period bonuses entirely: what a caller that predates them sends.
create function public.close_period(
  p_period_id uuid,
  p_settlements jsonb,
  p_next_name text,
  p_next_end date,
  p_period_bonuses jsonb default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  period public.periods;
  outstanding int;
  stamped int;
  terms jsonb := p_period_bonuses -> 'terms';
  bonus text;
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

  if p_period_bonuses is not null then
    if terms is not null and terms <> 'null'::jsonb then
      -- The divisor is recounted here: a disagreement means a holiday moved after the plan was
      -- made, or the two copies of the working-day rule drifted. Either way, stop.
      if (terms ->> 'working_days')::int <> private.count_working_days(period.start_date, period.end_date) then
        raise exception 'The working days changed while the close was being prepared'
          using errcode = 'serialization_failure';
      end if;
      update public.periods
         set working_days = (terms ->> 'working_days')::int,
             production_amount = (terms ->> 'production_amount')::int,
             compliance_amount = (terms ->> 'compliance_amount')::int,
             strike_deduction = (terms ->> 'strike_deduction')::int,
             strike_limit = (terms ->> 'strike_limit')::int
       where id = period.id;
    end if;

    insert into public.period_bonus_settlements
      (period_id, origin_period_id, employee_id, bonus, days, strikes, reprimanded, amount)
    select period.id,
           (entry ->> 'origin_period_id')::uuid,
           (entry ->> 'employee_id')::uuid,
           entry ->> 'bonus',
           (entry ->> 'days')::int,
           (entry ->> 'strikes')::int,
           (entry ->> 'reprimanded')::boolean,
           (entry ->> 'amount')::int
    from jsonb_array_elements(p_period_bonuses -> 'settlements') entry;

    -- Every day owed to a period with frozen terms — this one, now, or an earlier one — must be in
    -- the plan, exactly once.
    foreach bonus in array array['PRODUCTION', 'COMPLIANCE'] loop
      select count(*) into outstanding
      from public.assignments assignment
      join public.periods origin
        on assignment.date between origin.start_date and origin.end_date
       and origin.deleted_at is null
       and origin.working_days is not null
      where assignment.deleted_at is null
        and assignment.date <= period.end_date
        and case bonus
              when 'PRODUCTION' then assignment.production_settled_in_period_id
              else assignment.compliance_settled_in_period_id
            end is null
        and private.counts_for_period_bonus(assignment.date, assignment.position_id, bonus);

      if bonus = 'PRODUCTION' then
        update public.assignments assignment
           set production_settled_in_period_id = period.id
          from jsonb_array_elements(p_period_bonuses -> 'stamps') stamp
         where stamp ->> 'bonus' = bonus
           and assignment.id = (stamp ->> 'assignment_id')::uuid
           and assignment.position_id = (stamp ->> 'position_id')::uuid
           and assignment.deleted_at is null
           and assignment.production_settled_in_period_id is null
           and assignment.date <= period.end_date;
      else
        update public.assignments assignment
           set compliance_settled_in_period_id = period.id
          from jsonb_array_elements(p_period_bonuses -> 'stamps') stamp
         where stamp ->> 'bonus' = bonus
           and assignment.id = (stamp ->> 'assignment_id')::uuid
           and assignment.position_id = (stamp ->> 'position_id')::uuid
           and assignment.deleted_at is null
           and assignment.compliance_settled_in_period_id is null
           and assignment.date <= period.end_date;
      end if;
      get diagnostics stamped = row_count;

      if stamped <> outstanding
         or stamped <> (
           select count(*) from jsonb_array_elements(p_period_bonuses -> 'stamps') stamp
           where stamp ->> 'bonus' = bonus
         ) then
        raise exception 'The assignments changed while the close was being prepared'
          using errcode = 'serialization_failure';
      end if;
    end loop;
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

revoke execute on function public.close_period from public, anon;
grant execute on function public.close_period to authenticated;

-- 9 -------------------------------------------------------------------------------------------

-- A history row of a closed date is a review item also when it touches what that period's bonuses
-- counted: an assignment the close stamped for one, or a position that counts or is a strike, in a
-- period that froze terms. Columns unchanged.
create or replace view public.review_history with (security_invoker = true) as
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
  null::int                     as new_day_rate,
  history.previous_late,
  history.new_late,
  history.previous_late_notified,
  history.new_late_notified,
  history.previous_left_early,
  history.new_left_early
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
      or closed.id = assignment.production_settled_in_period_id
      or closed.id = assignment.compliance_settled_in_period_id
      or (
        history.date between closed.start_date and closed.end_date
        and (
          private.is_paid_assignment(history.date, history.previous_position_id)
          or private.is_paid_assignment(history.date, history.new_position_id)
          or (
            closed.working_days is not null
            and (
              private.matters_for_period_bonuses(history.date, history.previous_position_id)
              or private.matters_for_period_bonuses(history.date, history.new_position_id)
            )
          )
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
  history.new_day_rate,
  null,
  null,
  null,
  null,
  null,
  null
from public.calendar_date_history history
join public.periods closed
  on closed.status = 'CLOSED'
 and closed.deleted_at is null
 and history.date between closed.start_date and closed.end_date
 and history.changed_at > closed.closed_at
where history.deleted_at is null;
