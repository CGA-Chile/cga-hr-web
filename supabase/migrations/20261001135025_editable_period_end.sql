-- Editable period end, and the next period born at close (docs/DOMAIN.md §7).
--
-- 1. set_period_end. The accountant fixes each period's end and HR enters it, so editors may now
--    move the end of an open period, and nothing else about it. Editors still cannot update
--    periods directly: the function is the only door, and it touches end_date alone. The
--    contiguity trigger keeps applying, so only the latest open period's end can move.
-- 2. close_period creates the next period, starting the day after, when none follows yet. One
--    period is open at a time in the normal flow; the next one's end is proposed by the app and
--    moved later through set_period_end if the accountant picks another date.

create function public.set_period_end(p_period_id uuid, p_end_date date) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_member() then
    raise exception 'Only a member can change a period''s end' using errcode = 'insufficient_privilege';
  end if;

  update public.periods
     set end_date = p_end_date
   where id = p_period_id
     and deleted_at is null
     and status = 'OPEN';
  if not found then
    raise exception 'Period % is not open', p_period_id using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.set_period_end from public, anon;
grant execute on function public.set_period_end to authenticated;

drop function public.close_period(uuid, jsonb);

-- p_settlements: [{ "assignment_id": uuid, "position_id": uuid, "amount": int }, ...], one entry
-- for every unsettled bonus-eligible assignment dated on or before the period's end. Runs as the
-- caller, so RLS applies on top of the explicit admin check. p_next_name and p_next_end describe
-- the period to create after this one; they are ignored when a later period already exists.
create function public.close_period(
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
