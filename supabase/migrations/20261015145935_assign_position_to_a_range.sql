-- Assigning one position to a range of dates: a medical leave, a holiday, a fixed post for a week.
--
-- One call writes every date or none, so a range is never left half applied. Each date is written
-- as a single cell would be, by the same RLS policies and the same history trigger, with three
-- rules of its own:
--   * A date that already holds the position is left as it is, marks included. A new note is the
--     only thing that changes it.
--   * A replaced date loses its incomplete-day marks: they belonged to the position it held. Its
--     note stays unless a new one is given.
--   * A paid date the caller may not change is skipped rather than refused, so a leave that starts
--     inside a closed period still covers the rest. The admin, who may change a paid cell, replaces
--     it like any other date, but a range never empties one: the settlement would go with the row
--     and the undo could not bring it back.
-- The answer lists every date that changed with what it held before, which is what the sheet
-- needs to undo the range one cell at a time.

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
  previous_left_early    boolean
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
             left_early = false
       where id = stored.id;
    end if;

    changed_date := day;
    previous_position_id := stored.position_id;
    previous_note := stored.note;
    previous_late := stored.late;
    previous_late_notified := stored.late_notified;
    previous_left_early := stored.left_early;
    return next;
  end loop;
end;
$$;

revoke execute on function public.apply_assignment_range from public, anon;
grant execute on function public.apply_assignment_range to authenticated;
