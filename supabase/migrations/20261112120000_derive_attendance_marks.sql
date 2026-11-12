-- Workera writes the incomplete-day marks (docs/adr/0023, docs/DOMAIN.md §5d, §5 stage 2).
--
-- Stage 1 (#80) only shows mismatches. From a date the admin sets (attendance_settings.applies_from)
-- the late and left-early marks stop being buttons and are derived from the clockings compared with
-- the day's schedule, plus a tolerance in minutes. This changes pay: a late day earns no carding
-- bonus and counts as a compliance strike. The aviso of a late stays manual; automatic absences
-- (#83) and the close gate on attendance (#84) are not here.
--
-- The rule lives twice, in private.derive_attendance_marks and in src/domain/attendance/marks.ts,
-- because the write path runs in the database. They change together.
--
-- 1. attendance_settings: applies_from and tolerance_minutes.
-- 2. assignment_history.source: whether a row was written by a person or derived from Workera.
-- 3. private.derive_attendance_marks: the derivation, from clockings and the schedule.
-- 4. private.record_assignment_history: stamps source from a transaction flag.
-- 5. private.guard_history_acknowledgement: source joins the immutable tuple.
-- 6. apply_assignment_operation: a work day the stage covers takes its marks from Workera.
-- 7. recompute_attendance_marks: re-derives a range, attributing the change to the system.
-- 8. review_history: carries source.

-- 1 -------------------------------------------------------------------------------------------

alter table public.attendance_settings
  add column applies_from     date,
  add column tolerance_minutes int not null default 0 check (tolerance_minutes >= 0);

-- 2 -------------------------------------------------------------------------------------------

-- Every existing row is a person's write, so the default is correct for history as it stands.
alter table public.assignment_history
  add column source text not null default 'MANUAL' check (source in ('MANUAL', 'WORKERA'));

-- 3 -------------------------------------------------------------------------------------------

-- Exactly one row, always: the entry and exit aggregates are single-row, and a missing schedule
-- becomes nulls through the left join, which the booleans read as "no mark". A missing side of the
-- clocking (no entry or no exit) is an incomplete day, which also earns no mark.
create function private.derive_attendance_marks(p_national_id text, p_date date, p_tolerance int)
returns table (late boolean, left_early boolean)
language sql stable set search_path = '' as $$
  with entry as (
    select min(c.clocked_at::time) as t
    from public.attendance_clockings c
    where c.deleted_at is null and c.national_id = p_national_id and c.clocking_date = p_date
      and c.workera_type = 0 and c.status in ('ACTIVE', 'MODIFIED')
  ),
  depart as (
    select max(c.clocked_at::time) as t
    from public.attendance_clockings c
    where c.deleted_at is null and c.national_id = p_national_id and c.clocking_date = p_date
      and c.workera_type = 1 and c.status in ('ACTIVE', 'MODIFIED')
  ),
  sched as (
    select s.starts_at::time as start_t, s.ends_at::time as end_t
    from public.attendance_schedules s
    where s.deleted_at is null and s.national_id = p_national_id and s.schedule_date = p_date
    order by s.starts_at
    limit 1
  )
  select
    coalesce(
      entry.t is not null and depart.t is not null
        and entry.t > sched.start_t + make_interval(mins => p_tolerance),
      false
    ),
    coalesce(
      entry.t is not null and depart.t is not null
        and depart.t < sched.end_t - make_interval(mins => p_tolerance),
      false
    )
  from entry cross join depart left join sched on true;
$$;

-- 4 -------------------------------------------------------------------------------------------

-- As before, with source. A write sets the transaction-local flag app.history_source to 'WORKERA'
-- when the system derived the marks on its own; everything else is a person's write, 'MANUAL'.
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
       previous_bonus_task_id, new_bonus_task_id, changed_by, source)
    values
      (new.id, new.date, new.employee_id, previous_position, new_position, previous_late, new_late,
       previous_late_notified, new_late_notified, previous_left_early, new_left_early,
       previous_bonus_task, new_bonus_task, auth.uid(),
       coalesce(nullif(current_setting('app.history_source', true), ''), 'MANUAL'));
  end if;
  return null;
end;
$$;

-- 5 -------------------------------------------------------------------------------------------

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
      new.changed_by, new.changed_at, new.created_at, new.deleted_at, new.source)
     is distinct from
     (old.assignment_id, old.date, old.employee_id, old.previous_position_id, old.new_position_id,
      old.previous_late, old.new_late, old.previous_late_notified, old.new_late_notified,
      old.previous_left_early, old.new_left_early, old.previous_bonus_task_id, old.new_bonus_task_id,
      old.changed_by, old.changed_at, old.created_at, old.deleted_at, old.source) then
    raise exception 'History row % records what happened and cannot be rewritten', old.id;
  end if;

  new.acknowledged_by := auth.uid();
  return new;
end;
$$;

-- 6 -------------------------------------------------------------------------------------------

-- As before, but on a work day the stage covers the marks come from Workera, not the client: the
-- panel no longer offers the buttons there. The aviso (late_notified) is still the client's, and
-- survives only while there is a late. A settled day keeps the client's marks: its amounts are
-- frozen and the review list, not this write, is where a late change on it surfaces. The source
-- stays MANUAL here, because a person made this write; recompute_attendance_marks is where the
-- system changes a mark on its own.

drop function public.apply_assignment_operation(uuid, date, uuid, uuid, text, boolean, boolean, boolean, uuid, boolean);

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
  v_applies_from date;
  v_tolerance int;
  v_national_id text;
  v_derived record;
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

  select applies_from, tolerance_minutes into v_applies_from, v_tolerance
  from public.attendance_settings where deleted_at is null limit 1;

  if not coalesce(is_absence, false)
     and v_applies_from is not null and p_date >= v_applies_from
     and stored.settled_in_period_id is null
     and stored.production_settled_in_period_id is null
     and stored.compliance_settled_in_period_id is null then
    select national_id into v_national_id from public.employees where id = p_employee_id;
    select * into v_derived
    from private.derive_attendance_marks(v_national_id, p_date, coalesce(v_tolerance, 0));
    next_late := coalesce(v_derived.late, false);
    next_left_early := coalesce(v_derived.left_early, false);
    next_late_notified := case when next_late then coalesce(p_late_notified, stored.late_notified) end;
  else
    next_late := not coalesce(is_absence, false) and coalesce(p_late, stored.late, false);
    next_late_notified := case when next_late then coalesce(p_late_notified, stored.late_notified) end;
    next_left_early := not coalesce(is_absence, false) and coalesce(p_left_early, stored.left_early, false);
  end if;

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

-- 7 -------------------------------------------------------------------------------------------

-- Re-derives the marks of a date range and writes the ones that changed. Used after a Workera read
-- (its range) and after the admin changes the tolerance or the stage date (the open periods). It
-- updates only the rows whose marks actually change, so the history records a movement only when the
-- system truly changed one; unmarking a late clears its aviso, marking it keeps the manual aviso.
-- Settled days and days before the stage are left alone.
create function public.recompute_attendance_marks(p_from date, p_to date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_applies_from date;
  v_tolerance int;
begin
  if not private.may_record_attendance() then
    raise exception 'Only an admin can recompute attendance marks' using errcode = '42501';
  end if;

  select applies_from, tolerance_minutes into v_applies_from, v_tolerance
  from public.attendance_settings where deleted_at is null limit 1;
  if v_applies_from is null then
    return;
  end if;

  perform set_config('app.history_source', 'WORKERA', true);

  update public.assignments a
     set late = m.late,
         left_early = m.left_early,
         late_notified = case when m.late then a.late_notified else null end
    from (
      select src.id, d.late, d.left_early
      from public.assignments src
      join public.positions p on p.id = src.position_id and p.type = 'WORK'
      join public.employees e on e.id = src.employee_id and e.national_id is not null
      cross join lateral private.derive_attendance_marks(e.national_id, src.date, coalesce(v_tolerance, 0)) d
      where src.deleted_at is null
        and src.date >= greatest(p_from, v_applies_from)
        and src.date <= p_to
        and src.settled_in_period_id is null
        and src.production_settled_in_period_id is null
        and src.compliance_settled_in_period_id is null
    ) m
   where a.id = m.id
     and (a.late, a.left_early) is distinct from (m.late, m.left_early);
end;
$$;

revoke execute on function public.recompute_attendance_marks from public, anon;
grant execute on function public.recompute_attendance_marks to authenticated, service_role;

-- 8 -------------------------------------------------------------------------------------------

-- As before, with source appended last, as a view replacement requires. A calendar row has none.
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
  history.new_bonus_task_id,
  history.source
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
  null,
  null
from public.calendar_date_history history
join public.periods closed
  on closed.status = 'CLOSED'
 and closed.deleted_at is null
 and history.date between closed.start_date and closed.end_date
 and history.changed_at > closed.closed_at
where history.deleted_at is null;
