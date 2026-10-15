-- Incomplete days: lateness with or without notice, and leaving early (docs/DOMAIN.md §5).
--
-- The bonus is for a whole day. Someone who arrived late or left early stays on their position in
-- the sheet and earns nothing, exactly as lateness already worked. Whether a late arrival came with
-- notice is recorded for HR and changes nothing in the pay. Both marks belong to someone who came:
-- an absence carries neither.

alter table public.assignments
  add column late_notified boolean,
  add column left_early boolean not null default false,
  -- Null while not late. Also null on a late mark recorded before the notice was asked for.
  add constraint assignments_late_notified_needs_late check (late or late_notified is null);

-- 1. History records a change of either mark as a movement, like a change of the late mark.
--    Rows from before this migration carry nulls: "not recorded", not "no".

alter table public.assignment_history
  add column previous_late_notified boolean,
  add column new_late_notified boolean,
  add column previous_left_early boolean,
  add column new_left_early boolean;

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
begin
  if (previous_position, previous_late, previous_late_notified, previous_left_early)
     is distinct from (new_position, new_late, new_late_notified, new_left_early) then
    insert into public.assignment_history
      (assignment_id, date, employee_id, previous_position_id, new_position_id, previous_late, new_late,
       previous_late_notified, new_late_notified, previous_left_early, new_left_early, changed_by)
    values
      (new.id, new.date, new.employee_id, previous_position, new_position, previous_late, new_late,
       previous_late_notified, new_late_notified, previous_left_early, new_left_early, auth.uid());
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
      new.previous_left_early, new.new_left_early, new.changed_by, new.changed_at, new.created_at, new.deleted_at)
     is distinct from
     (old.assignment_id, old.date, old.employee_id, old.previous_position_id, old.new_position_id,
      old.previous_late, old.new_late, old.previous_late_notified, old.new_late_notified,
      old.previous_left_early, old.new_left_early, old.changed_by, old.changed_at, old.created_at, old.deleted_at) then
    raise exception 'History row % records what happened and cannot be rewritten', old.id;
  end if;

  new.acknowledged_by := auth.uid();
  return new;
end;
$$;

-- 2. The queued write carries both marks. As with p_late, a null keeps what is stored, so a write
--    about the position or the note never clears a mark, and an older client cannot either.
--    Unmarking lateness clears its notice. Assigning an absence clears every mark: the person did
--    not come, so they cannot have arrived late or left early.

drop function public.apply_assignment_operation(uuid, date, uuid, uuid, text, boolean);

create function public.apply_assignment_operation(
  p_op_id           uuid,
  p_date            date,
  p_employee_id     uuid,
  p_position_id     uuid default null,
  p_note            text default null,
  p_late            boolean default null,
  p_late_notified   boolean default null,
  p_left_early      boolean default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  newly_recorded int;
  is_absence boolean;
  stored public.assignments%rowtype;
  next_late boolean;
  next_late_notified boolean;
  next_left_early boolean;
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

  insert into public.assignments (date, employee_id, position_id, note, late, late_notified, left_early)
  values (p_date, p_employee_id, p_position_id, p_note, next_late, next_late_notified, next_left_early)
  on conflict (date, employee_id) where deleted_at is null
  do update set position_id = excluded.position_id,
                note = excluded.note,
                late = excluded.late,
                late_notified = excluded.late_notified,
                left_early = excluded.left_early
  where (assignments.position_id, assignments.note, assignments.late, assignments.late_notified, assignments.left_early)
        is distinct from
        (excluded.position_id, excluded.note, excluded.late, excluded.late_notified, excluded.left_early);
end;
$$;

revoke execute on function public.apply_assignment_operation from public, anon;
grant execute on function public.apply_assignment_operation to authenticated;

-- 3. The review views carry the new values, appended last as a view replacement requires.

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
