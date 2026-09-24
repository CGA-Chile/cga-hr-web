-- Periods and closing them (docs/DOMAIN.md §6 and §7).
--
-- 1. Contiguity. The exclusion constraint already forbids overlaps; this forbids gaps. A new
--    period starts the day after the previous one ends, a start never moves, and an end moves
--    only while the period is open and nothing follows it.
-- 2. close_period. Stamps the settlement and closes the period in one transaction. The amounts
--    come from the settlement module, run on the server with the admin's session; this function
--    verifies that nothing it was handed has changed since, and refuses the whole close if so.

create function private.keep_periods_contiguous() returns trigger
language plpgsql as $$
declare
  previous_end date;
begin
  if tg_op = 'UPDATE' then
    if new.start_date <> old.start_date then
      raise exception 'A period''s start date cannot change' using errcode = 'check_violation';
    end if;
    if new.end_date <> old.end_date and (
      old.status = 'CLOSED'
      or exists (
        select 1 from public.periods later
        where later.start_date > old.end_date and later.deleted_at is null
      )
    ) then
      raise exception 'Only the end date of the latest open period can change'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select max(end_date) into previous_end
  from public.periods
  where end_date < new.start_date and deleted_at is null;

  if previous_end is not null and new.start_date <> previous_end + 1 then
    raise exception 'A period must start the day after the previous one ends (%)', previous_end + 1
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger periods_keep_contiguous before insert or update on public.periods
  for each row execute function private.keep_periods_contiguous();

-- p_settlements: [{ "assignment_id": uuid, "position_id": uuid, "amount": int }, ...], one entry
-- for every unsettled bonus-eligible assignment dated on or before the period's end. Runs as the
-- caller, so RLS applies on top of the explicit admin check.
create function public.close_period(p_period_id uuid, p_settlements jsonb) returns void
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
  join public.positions position on position.id = assignment.position_id
  where assignment.deleted_at is null
    and assignment.settled_in_period_id is null
    and assignment.date <= period.end_date
    and position.bonus_eligible;

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
end;
$$;

revoke execute on function public.close_period from public, anon;
grant execute on function public.close_period to authenticated;
