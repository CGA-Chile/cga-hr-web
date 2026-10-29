-- Bonus tasks (docs/adr/0021, docs/DOMAIN.md §5c).
--
-- A bonus task is a mark on a cell, on top of the position: unloading the truck is the first one.
-- It pays a fixed amount per person, and it is the only bonus that person earns that day: the
-- carding line and the day rate treat them as they treat an incomplete day. The period bonuses do
-- not change. The amount is data, versioned with the rest of the rates; a new task is a row the
-- admin adds, not a deploy.
--
-- 1. bonus_tasks: the catalogue.
-- 2. bonus_task_rates: one amount per task and settings version.
-- 3. assignments.bonus_task_id, cleared by trigger on an absence.
-- 4. History records a change of task as a movement.
-- 5. create_bonus_settings_version carries the task rates.
-- 6. create_bonus_task writes a task and its amount in one call.
-- 7. apply_assignment_operation writes the task.
-- 8. apply_assignment_range: a replaced date loses its task, and the answer says which it was.
-- 9. bonus_task_settlements: what each close paid, one row per person and date.
-- 10. bonus_task_owed_days: the tasks no close has paid yet, with what the day already paid.
-- 11. close_period settles them and refuses when the tasks owed are not the ones the plan names.
-- 12. The review list covers a change of task on a date of a closed period.

-- 1 -------------------------------------------------------------------------------------------

create table public.bonus_tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index bonus_tasks_name_key on public.bonus_tasks (name) where deleted_at is null;

create trigger bonus_tasks_set_updated_at before update on public.bonus_tasks
  for each row execute function private.set_updated_at();

alter table public.bonus_tasks enable row level security;

-- The name is not an amount: the supervisor marks tasks, so every member reads the catalogue.
create policy "members read bonus_tasks" on public.bonus_tasks
  for select to authenticated using (private.is_member());
create policy "admins insert bonus_tasks" on public.bonus_tasks
  for insert to authenticated with check (private.is_admin());
create policy "admins update bonus_tasks" on public.bonus_tasks
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- 2 -------------------------------------------------------------------------------------------

create table public.bonus_task_rates (
  id                 uuid primary key default gen_random_uuid(),
  bonus_settings_id  uuid not null references public.bonus_settings (id),
  bonus_task_id      uuid not null references public.bonus_tasks (id),
  amount             int not null check (amount > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create unique index bonus_task_rates_settings_task_key
  on public.bonus_task_rates (bonus_settings_id, bonus_task_id) where deleted_at is null;
create index bonus_task_rates_task_idx on public.bonus_task_rates (bonus_task_id);

create trigger bonus_task_rates_set_updated_at before update on public.bonus_task_rates
  for each row execute function private.set_updated_at();

alter table public.bonus_task_rates enable row level security;

create policy "hr reads bonus_task_rates" on public.bonus_task_rates
  for select to authenticated using (private.sees_amounts());
create policy "admins insert bonus_task_rates" on public.bonus_task_rates
  for insert to authenticated with check (private.is_admin());
create policy "admins update bonus_task_rates" on public.bonus_task_rates
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- 3 -------------------------------------------------------------------------------------------

alter table public.assignments
  add column bonus_task_id uuid references public.bonus_tasks (id);

create index assignments_bonus_task_idx on public.assignments (bonus_task_id) where bonus_task_id is not null;

-- A task, like the incomplete-day marks, belongs to someone who came. A trigger rather than each
-- write function, so a range, a single cell and an admin's correction all obey it.
create function private.clear_bonus_task_on_absence() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.bonus_task_id is not null and exists (
    select 1 from public.positions position
    where position.id = new.position_id and position.type = 'ABSENCE'
  ) then
    new.bonus_task_id := null;
  end if;
  return new;
end;
$$;

create trigger assignments_clear_bonus_task_on_absence before insert or update on public.assignments
  for each row execute function private.clear_bonus_task_on_absence();

-- 4 -------------------------------------------------------------------------------------------

alter table public.assignment_history
  add column previous_bonus_task_id uuid references public.bonus_tasks (id),
  add column new_bonus_task_id uuid references public.bonus_tasks (id);

create or replace function private.record_assignment_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  was_live boolean := tg_op = 'UPDATE' and old.deleted_at is null;
  is_live boolean := new.deleted_at is null;
  previous_position uuid := case when was_live then old.position_id end;
  new_position uuid := case when is_live then new.position_id end;
  previous_late boolean := case when was_live then old.late end;
  new_late boolean := case when is_live then new.late end;
  previous_late_notified boolean := case when was_live then old.late_notified end;
  new_late_notified boolean := case when is_live then new.late_notified end;
  previous_left_early boolean := case when was_live then old.left_early end;
  new_left_early boolean := case when is_live then new.left_early end;
  previous_bonus_task uuid := case when was_live then old.bonus_task_id end;
  new_bonus_task uuid := case when is_live then new.bonus_task_id end;
begin
  if (previous_position, previous_late, previous_late_notified, previous_left_early, previous_bonus_task)
     is distinct from (new_position, new_late, new_late_notified, new_left_early, new_bonus_task) then
    insert into public.assignment_history
      (assignment_id, date, employee_id, previous_position_id, new_position_id, previous_late, new_late,
       previous_late_notified, new_late_notified, previous_left_early, new_left_early,
       previous_bonus_task_id, new_bonus_task_id, changed_by)
    values
      (new.id, new.date, new.employee_id, previous_position, new_position, previous_late, new_late,
       previous_late_notified, new_late_notified, previous_left_early, new_left_early,
       previous_bonus_task, new_bonus_task, auth.uid());
  end if;
  return null;
end;
$$;

create or replace function private.guard_history_acknowledgement() returns trigger
language plpgsql as $$
begin
  if old.acknowledged_at is not null then
    raise exception 'History row % is already acknowledged', old.id;
  end if;
  if new.acknowledged_at is null then
    raise exception 'The only permitted change to a history row is acknowledging it';
  end if;
  if (new.assignment_id, new.date, new.employee_id, new.previous_position_id, new.new_position_id,
      new.previous_late, new.new_late, new.previous_late_notified, new.new_late_notified,
      new.previous_left_early, new.new_left_early, new.previous_bonus_task_id, new.new_bonus_task_id,
      new.changed_by, new.changed_at, new.created_at, new.deleted_at)
     is distinct from
     (old.assignment_id, old.date, old.employee_id, old.previous_position_id, old.new_position_id,
      old.previous_late, old.new_late, old.previous_late_notified, old.new_late_notified,
      old.previous_left_early, old.new_left_early, old.previous_bonus_task_id, old.new_bonus_task_id,
      old.changed_by, old.changed_at, old.created_at, old.deleted_at) then
    raise exception 'History row % records what happened and cannot be rewritten', old.id;
  end if;

  new.acknowledged_by := auth.uid();
  return new;
end;
$$;

-- 5 -------------------------------------------------------------------------------------------

drop function public.create_bonus_settings_version(date, int, int, jsonb, int, int, int, int, int, int, int);

-- As before, with the task rates. A task the caller leaves out keeps the amount it has in the
-- current version, so a caller that predates tasks never leaves one without a rate.
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
  p_strike_limit           int default null,
  p_task_rates             jsonb default '[]'::jsonb
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

  insert into public.bonus_task_rates (bonus_settings_id, bonus_task_id, amount)
  select new_version_id, (rate ->> 'bonus_task_id')::uuid, (rate ->> 'amount')::int
  from jsonb_array_elements(p_task_rates) rate;

  insert into public.bonus_task_rates (bonus_settings_id, bonus_task_id, amount)
  select new_version_id, carried.bonus_task_id, carried.amount
  from public.bonus_task_rates carried
  where carried.bonus_settings_id = current_version.id
    and carried.deleted_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_task_rates) rate
      where (rate ->> 'bonus_task_id')::uuid = carried.bonus_task_id
    );

  return new_version_id;
end;
$$;

revoke execute on function public.create_bonus_settings_version from public, anon;
grant execute on function public.create_bonus_settings_version to authenticated;

-- 6 -------------------------------------------------------------------------------------------

-- A new task takes its amount in every settings version, not only the current one. No date has it
-- yet, so no amount already paid can change; what it buys is that a task marked late on a date of
-- an older version is still priced. Changing the amount afterwards is a new version, like any rate.
create function public.create_bonus_task(p_name text, p_amount int) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  new_task_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can create a bonus task' using errcode = 'insufficient_privilege';
  end if;

  insert into public.bonus_tasks (name) values (trim(p_name)) returning id into new_task_id;

  insert into public.bonus_task_rates (bonus_settings_id, bonus_task_id, amount)
  select settings.id, new_task_id, p_amount
  from public.bonus_settings settings
  where settings.deleted_at is null;

  return new_task_id;
end;
$$;

revoke execute on function public.create_bonus_task from public, anon;
grant execute on function public.create_bonus_task to authenticated;

-- 7 -------------------------------------------------------------------------------------------

-- As before, with the task. A null p_bonus_task_id keeps what is stored, like the marks, so a
-- write about anything else never clears it; p_clear_bonus_task removes it. A uuid parameter has
-- no false to say "none", so the removal needs its own flag. On an absence the trigger of step 3
-- clears it, before the conflict check compares the rows.

drop function public.apply_assignment_operation(uuid, date, uuid, uuid, text, boolean, boolean, boolean);

create function public.apply_assignment_operation(
  p_op_id             uuid,
  p_date              date,
  p_employee_id       uuid,
  p_position_id       uuid default null,
  p_note              text default null,
  p_late              boolean default null,
  p_late_notified     boolean default null,
  p_left_early        boolean default null,
  p_bonus_task_id     uuid default null,
  p_clear_bonus_task  boolean default false
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  newly_recorded int;
  is_absence boolean;
  stored public.assignments%rowtype;
  next_late boolean;
  next_late_notified boolean;
  next_left_early boolean;
  next_bonus_task uuid;
begin
  insert into public.applied_operations (op_id) values (p_op_id)
  on conflict (op_id) where deleted_at is null do nothing;
  get diagnostics newly_recorded = row_count;
  if newly_recorded = 0 then
    return;
  end if;

  if p_position_id is null then
    update public.assignments
       set deleted_at = now()
     where date = p_date and employee_id = p_employee_id and deleted_at is null;
    return;
  end if;

  select coalesce(position.type = 'ABSENCE', false) into is_absence
  from public.positions position
  where position.id = p_position_id;

  select * into stored
  from public.assignments
  where date = p_date and employee_id = p_employee_id and deleted_at is null;

  next_late := not coalesce(is_absence, false) and coalesce(p_late, stored.late, false);
  next_late_notified := case when next_late then coalesce(p_late_notified, stored.late_notified) end;
  next_left_early := not coalesce(is_absence, false) and coalesce(p_left_early, stored.left_early, false);
  next_bonus_task := case when p_clear_bonus_task then null else coalesce(p_bonus_task_id, stored.bonus_task_id) end;

  insert into public.assignments (date, employee_id, position_id, note, late, late_notified, left_early, bonus_task_id)
  values (p_date, p_employee_id, p_position_id, p_note, next_late, next_late_notified, next_left_early, next_bonus_task)
  on conflict (date, employee_id) where deleted_at is null
  do update set position_id = excluded.position_id,
                note = excluded.note,
                late = excluded.late,
                late_notified = excluded.late_notified,
                left_early = excluded.left_early,
                bonus_task_id = excluded.bonus_task_id
  where (assignments.position_id, assignments.note, assignments.late, assignments.late_notified,
         assignments.left_early, assignments.bonus_task_id)
        is distinct from
        (excluded.position_id, excluded.note, excluded.late, excluded.late_notified,
         excluded.left_early, excluded.bonus_task_id);
end;
$$;

revoke execute on function public.apply_assignment_operation from public, anon;
grant execute on function public.apply_assignment_operation to authenticated;

-- 8 -------------------------------------------------------------------------------------------

-- As before. A replaced date loses its task with its marks, and the answer carries the task it
-- held, so the undo can put it back.

drop function public.apply_assignment_range(uuid, date[], uuid, text);

create function public.apply_assignment_range(
  p_employee_id uuid,
  p_dates       date[],
  p_position_id uuid default null,
  p_note        text default null
) returns table (
  changed_date           date,
  previous_position_id   uuid,
  previous_note          text,
  previous_late          boolean,
  previous_late_notified boolean,
  previous_left_early    boolean,
  previous_bonus_task_id uuid
)
language plpgsql security invoker set search_path = '' as $$
declare
  day date;
  stored public.assignments%rowtype;
begin
  if not private.is_member() then
    raise exception 'Only members write assignments' using errcode = '42501';
  end if;
  if cardinality(p_dates) > 366 then
    raise exception 'A range covers at most 366 dates' using errcode = '22023';
  end if;

  for day in select distinct unnest(p_dates) order by 1 loop
    -- No FOR UPDATE: it would apply the update policy to the read, hide a paid row from an editor,
    -- and turn a date to skip into an insert that collides with it.
    select * into stored
    from public.assignments assignment
    where assignment.date = day and assignment.employee_id = p_employee_id and assignment.deleted_at is null;

    if stored.id is not null
       and stored.settled_in_period_id is not null
       and (p_position_id is null or not private.may_write_assignment(stored.settled_in_period_id)) then
      continue;
    end if;

    if p_position_id is null then
      if stored.id is null then
        continue;
      end if;
      update public.assignments set deleted_at = now() where id = stored.id;
    elsif stored.id is null then
      insert into public.assignments (date, employee_id, position_id, note)
      values (day, p_employee_id, p_position_id, p_note);
    elsif stored.position_id = p_position_id then
      if p_note is null or p_note = stored.note then
        continue;
      end if;
      update public.assignments set note = p_note where id = stored.id;
    else
      update public.assignments
         set position_id = p_position_id,
             note = coalesce(p_note, stored.note),
             late = false,
             late_notified = null,
             left_early = false,
             bonus_task_id = null
       where id = stored.id;
    end if;

    changed_date := day;
    previous_position_id := stored.position_id;
    previous_note := stored.note;
    previous_late := stored.late;
    previous_late_notified := stored.late_notified;
    previous_left_early := stored.left_early;
    previous_bonus_task_id := stored.bonus_task_id;
    return next;
  end loop;
end;
$$;

revoke execute on function public.apply_assignment_range from public, anon;
grant execute on function public.apply_assignment_range to authenticated;

-- 9 -------------------------------------------------------------------------------------------

-- One row per person and date, ever: a day's task is paid once. A change after that is a review
-- item, never a second payment. amount is what this close paid, which on a day whose carding
-- amount was already frozen is the task's amount less that, and can be zero.
create table public.bonus_task_settlements (
  id             uuid primary key default gen_random_uuid(),
  period_id      uuid not null references public.periods (id),
  assignment_id  uuid not null references public.assignments (id),
  employee_id    uuid not null references public.employees (id),
  date           date not null,
  bonus_task_id  uuid not null references public.bonus_tasks (id),
  amount         int not null check (amount >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index bonus_task_settlements_employee_date_key
  on public.bonus_task_settlements (employee_id, date) where deleted_at is null;
create index bonus_task_settlements_period_idx on public.bonus_task_settlements (period_id);
create index bonus_task_settlements_assignment_idx on public.bonus_task_settlements (assignment_id);
create index bonus_task_settlements_task_idx on public.bonus_task_settlements (bonus_task_id);

create trigger bonus_task_settlements_forbid_update before update on public.bonus_task_settlements
  for each row execute function private.forbid_update();
create trigger bonus_task_settlements_forbid_delete before delete on public.bonus_task_settlements
  for each row execute function private.forbid_delete();

alter table public.bonus_task_settlements enable row level security;

-- Written by close_period, which runs as the admin, while the period it closes is still open.
create policy "hr reads bonus_task_settlements" on public.bonus_task_settlements
  for select to authenticated using (private.sees_amounts());
create policy "the close inserts bonus_task_settlements" on public.bonus_task_settlements
  for insert to authenticated with check (private.is_admin() and private.is_open_period(period_id));

-- 10 ------------------------------------------------------------------------------------------

-- paid_amount is the carding or day-rate amount already frozen for that person and date, on any
-- row, live or deleted: the task tops the day up to its own amount and never pays twice.
create view public.bonus_task_owed_days with (security_invoker = true) as
select
  assignment.id             as assignment_id,
  assignment.date,
  assignment.employee_id,
  assignment.bonus_task_id,
  coalesce((
    select sum(paid.settled_amount)
    from public.assignments paid
    where paid.employee_id = assignment.employee_id
      and paid.date = assignment.date
      and paid.settled_amount is not null
  ), 0)::int                as paid_amount
from public.assignments assignment
where assignment.deleted_at is null
  and assignment.bonus_task_id is not null
  and not exists (
    select 1 from public.bonus_task_settlements settled
    where settled.employee_id = assignment.employee_id
      and settled.date = assignment.date
      and settled.deleted_at is null
  );

-- 11 ------------------------------------------------------------------------------------------

drop function public.close_period(uuid, jsonb, text, date, jsonb);

-- As before, with p_task_settlements: [{ "assignment_id": uuid, "bonus_task_id": uuid,
-- "amount": int }, ...], one entry for every task owed on or before the period's end. Absent,
-- it is none, which refuses the close as soon as one task is owed.
create function public.close_period(
  p_period_id         uuid,
  p_settlements       jsonb,
  p_next_name         text,
  p_next_end          date,
  p_period_bonuses    jsonb default null,
  p_task_settlements  jsonb default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  period public.periods;
  outstanding int;
  stamped int;
  terms jsonb := p_period_bonuses -> 'terms';
  bonus text;
  task_settlements jsonb := coalesce(p_task_settlements, '[]'::jsonb);
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
      using errcode = 'CG001';
  end if;

  -- The tasks owed are counted before any is paid: the insert below removes them from the view.
  select count(*) into outstanding
  from public.bonus_task_owed_days owed
  where owed.date <= period.end_date;

  insert into public.bonus_task_settlements (period_id, assignment_id, employee_id, date, bonus_task_id, amount)
  select period.id, owed.assignment_id, owed.employee_id, owed.date, owed.bonus_task_id, (entry ->> 'amount')::int
  from jsonb_array_elements(task_settlements) entry
  join public.bonus_task_owed_days owed
    on owed.assignment_id = (entry ->> 'assignment_id')::uuid
   and owed.bonus_task_id = (entry ->> 'bonus_task_id')::uuid
  where owed.date <= period.end_date;
  get diagnostics stamped = row_count;

  if stamped <> outstanding or stamped <> jsonb_array_length(task_settlements) then
    raise exception 'The bonus tasks changed while the close was being prepared'
      using errcode = 'CG001';
  end if;

  if p_period_bonuses is not null then
    if terms is not null and terms <> 'null'::jsonb then
      -- The divisor is recounted here: a disagreement means a holiday moved after the plan was
      -- made, or the two copies of the working-day rule drifted. Either way, stop.
      if (terms ->> 'working_days')::int <> private.count_working_days(period.start_date, period.end_date) then
        raise exception 'The working days changed while the close was being prepared'
          using errcode = 'CG001';
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
        and private.counts_for_period_bonus(assignment.date, assignment.position_id, bonus)
        and not private.was_counted_for_period_bonus(assignment.employee_id, assignment.date, bonus);

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
          using errcode = 'CG001';
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

-- 12 ------------------------------------------------------------------------------------------

-- A change of task on a date of a closed period is a review item whatever the position: the task
-- may be owed, or already paid and now wrong. The task values are appended last, as a view
-- replacement requires.
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
  history.new_left_early,
  history.previous_bonus_task_id,
  history.new_bonus_task_id
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
          or history.previous_bonus_task_id is distinct from history.new_bonus_task_id
          or (
            closed.working_days is not null
            and (
              private.matters_for_period_bonuses(history.date, history.previous_position_id)
              or private.matters_for_period_bonuses(history.date, history.new_position_id)
              or coalesce(history.previous_late, false) is distinct from coalesce(history.new_late, false)
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
