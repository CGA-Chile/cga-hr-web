-- close_period refuses a stale plan with its own SQLSTATE instead of serialization_failure.
-- PostgREST v14.5 treats 40001 as a transaction to retry, and retries it forever without
-- answering, so a refusal that repeats on every attempt hangs the request. docs/adr/0020.

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
