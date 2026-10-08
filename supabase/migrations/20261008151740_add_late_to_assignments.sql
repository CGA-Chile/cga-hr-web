-- Late arrivals (docs/adr/0012, docs/DOMAIN.md §5).
--
-- A late person stays on their position and earns nothing. The mark lives on the assignment, so
-- the sheet still shows where they worked. It is part of the cell's state, recorded in the
-- history like a position change, and written through the same queued operation.

alter table public.assignments add column late boolean not null default false;

-- 1. History records a change of the late mark as a movement of its own. Rows from before this
--    migration have no late values; null there means "not recorded", not "on time".

alter table public.assignment_history
  add column previous_late boolean,
  add column new_late boolean;

create or replace function private.record_assignment_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous_position uuid := case when tg_op = 'UPDATE' and old.deleted_at is null then old.position_id end;
  new_position uuid := case when new.deleted_at is null then new.position_id end;
  previous_late boolean := case when tg_op = 'UPDATE' and old.deleted_at is null then old.late end;
  new_late boolean := case when new.deleted_at is null then new.late end;
begin
  if previous_position is distinct from new_position or previous_late is distinct from new_late then
    insert into public.assignment_history
      (assignment_id, date, employee_id, previous_position_id, new_position_id, previous_late, new_late, changed_by)
    values
      (new.id, new.date, new.employee_id, previous_position, new_position, previous_late, new_late, auth.uid());
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
      new.previous_late, new.new_late, new.changed_by, new.changed_at, new.created_at, new.deleted_at)
     is distinct from
     (old.assignment_id, old.date, old.employee_id, old.previous_position_id, old.new_position_id,
      old.previous_late, old.new_late, old.changed_by, old.changed_at, old.created_at, old.deleted_at) then
    raise exception 'History row % records what happened and cannot be rewritten', old.id;
  end if;

  new.acknowledged_by := auth.uid();
  return new;
end;
$$;

-- 2. The queued write carries the mark. A null p_late keeps what is stored, so a write that is
--    only about the position or the note never clears it, and a client from before this
--    migration, which never sends it, cannot either.

drop function public.apply_assignment_operation(uuid, date, uuid, uuid, text);

create function public.apply_assignment_operation(
  p_op_id        uuid,
  p_date         date,
  p_employee_id  uuid,
  p_position_id  uuid default null,
  p_note         text default null,
  p_late         boolean default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  newly_recorded int;
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

  insert into public.assignments (date, employee_id, position_id, note, late)
  values (p_date, p_employee_id, p_position_id, p_note, coalesce(p_late, false))
  on conflict (date, employee_id) where deleted_at is null
  do update set position_id = excluded.position_id,
                note = excluded.note,
                late = coalesce(p_late, assignments.late)
  where (assignments.position_id, assignments.note, assignments.late)
        is distinct from (excluded.position_id, excluded.note, coalesce(p_late, assignments.late));
end;
$$;

revoke execute on function public.apply_assignment_operation from public, anon;
grant execute on function public.apply_assignment_operation to authenticated;

-- 3. The review views carry the late values, appended last as a view replacement requires.

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
  history.new_late
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
  history.new_day_rate,
  null,
  null
from public.calendar_date_history history
join public.periods closed
  on closed.status = 'CLOSED'
 and closed.deleted_at is null
 and history.date between closed.start_date and closed.end_date
 and history.changed_at > closed.closed_at
where history.deleted_at is null;
