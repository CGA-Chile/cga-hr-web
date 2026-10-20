-- Two fixes to the period bonuses (docs/adr/0016), found in review after add_period_bonuses.
--
-- 1. A day is counted once per person, not once per row. Clearing a cell soft-deletes its row, and
--    entering it again inserts a new one without a stamp, so a day of a closed period that a close
--    already paid for a period bonus looked owed again and the next close paid it twice. A Bodega
--    day is the case: only the carding settlement locks a row to the admin. The owed days and the
--    close's own check now skip a person's date that any row, live or deleted, was stamped for.
-- 2. A late mark added or removed after a close is a review item in any period with frozen terms,
--    on any date: a strike counts on Saturdays too, and on days that add nothing to either bonus.

create function private.was_counted_for_period_bonus(p_employee_id uuid, p_date date, p_bonus text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments counted
    where counted.employee_id = p_employee_id
      and counted.date = p_date
      and case p_bonus
            when 'PRODUCTION' then counted.production_settled_in_period_id
            else counted.compliance_settled_in_period_id
          end is not null
  );
$$;

create or replace view public.period_bonus_owed_days with (security_invoker = true) as
select
  assignment.id        as assignment_id,
  assignment.date,
  assignment.employee_id,
  assignment.position_id,
  assignment.late,
  origin.id            as origin_period_id,
  bonus.kind           as bonus
from public.assignments assignment
join public.periods origin
  on assignment.date between origin.start_date and origin.end_date
 and origin.deleted_at is null
 and origin.status = 'CLOSED'
 and origin.working_days is not null
cross join (values ('PRODUCTION'), ('COMPLIANCE')) as bonus (kind)
where assignment.deleted_at is null
  and case bonus.kind
        when 'PRODUCTION' then assignment.production_settled_in_period_id
        else assignment.compliance_settled_in_period_id
      end is null
  and private.counts_for_period_bonus(assignment.date, assignment.position_id, bonus.kind)
  and not private.was_counted_for_period_bonus(assignment.employee_id, assignment.date, bonus.kind);

create or replace function public.close_period(
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
  null
from public.calendar_date_history history
join public.periods closed
  on closed.status = 'CLOSED'
 and closed.deleted_at is null
 and history.date between closed.start_date and closed.end_date
 and history.changed_at > closed.closed_at
where history.deleted_at is null;
