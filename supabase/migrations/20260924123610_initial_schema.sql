-- Initial schema for the carding-line bonus app. docs/DOMAIN.md §6 is the specification.
--
-- Conventions every table follows:
--   * id, created_at, updated_at, deleted_at. Soft delete only; no role may physically delete.
--   * updated_at is maintained by trigger, never by application code.
--   * Unique indexes are partial on deleted_at is null.
--   * RLS on every table. Policies target `authenticated` only, and every one of them requires a
--     profile with a role, so an account created outside the seed can neither read nor write.

create extension if not exists btree_gist;

create schema if not exists private;
grant usage on schema private to authenticated;

create function private.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- profiles: the source of the role, and therefore of every policy.
-- ---------------------------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id),
  role        text not null check (role in ('admin', 'editor')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- The role comes from app_metadata, which only the service role can write. A user without one
-- has no live profile, and with no live profile every policy below denies. Auth writes
-- app_metadata in an update after the insert, so the trigger listens to both.
create function private.sync_profile_from_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  granted_role text := new.raw_app_meta_data ->> 'role';
begin
  if granted_role in ('admin', 'editor') then
    insert into public.profiles (id, role) values (new.id, granted_role)
    on conflict (id) do update set role = excluded.role, deleted_at = null;
  else
    update public.profiles set deleted_at = now() where id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_saved after insert or update of raw_app_meta_data on auth.users
  for each row execute function private.sync_profile_from_auth_user();

create function private.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

create function private.is_member() returns boolean
language sql stable as $$
  select private.app_role() is not null;
$$;

create function private.is_admin() returns boolean
language sql stable as $$
  select private.app_role() = 'admin';
$$;

alter table public.profiles enable row level security;

create policy "members read profiles" on public.profiles
  for select to authenticated using (private.is_member());

-- ---------------------------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------------------------

create table public.employees (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  national_id  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create unique index employees_national_id_key on public.employees (national_id)
  where deleted_at is null;

create trigger employees_set_updated_at before update on public.employees
  for each row execute function private.set_updated_at();

alter table public.employees enable row level security;

create policy "members read employees" on public.employees
  for select to authenticated using (private.is_member());
create policy "admins insert employees" on public.employees
  for insert to authenticated with check (private.is_admin());
create policy "admins update employees" on public.employees
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------------------------
-- positions
-- ---------------------------------------------------------------------------------------------

create table public.positions (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null,
  name                  text not null,
  type                  text not null check (type in ('WORK', 'ABSENCE')),
  bonus_eligible        boolean not null default false,
  triggers_equal_share  boolean not null default false,
  display_order         int not null,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  -- A position that changes how the whole line is paid while paying nothing itself has no
  -- meaning, and forbidding it keeps n well defined. docs/adr/0007.
  constraint positions_trigger_is_bonus_eligible check (not triggers_equal_share or bonus_eligible)
);

create unique index positions_code_key on public.positions (code) where deleted_at is null;

create trigger positions_set_updated_at before update on public.positions
  for each row execute function private.set_updated_at();

alter table public.positions enable row level security;

create policy "members read positions" on public.positions
  for select to authenticated using (private.is_member());
create policy "admins insert positions" on public.positions
  for insert to authenticated with check (private.is_admin());
create policy "admins update positions" on public.positions
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------------------------
-- periods: the settlement windows HR reports. Contiguous, never overlapping.
-- ---------------------------------------------------------------------------------------------

create table public.periods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  closed_at   timestamptz,
  closed_by   uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint periods_range_is_ordered check (start_date <= end_date),
  constraint periods_closed_at_matches_status check ((status = 'CLOSED') = (closed_at is not null)),
  constraint periods_no_overlap exclude using gist (daterange(start_date, end_date, '[]') with &&)
    where (deleted_at is null)
);

-- The moment of closing is stamped by the database, like updated_at. The review list compares it
-- against history timestamps, so it must come from the same clock and cannot be client-supplied.
create function private.stamp_period_close() returns trigger
language plpgsql as $$
begin
  if new.status = 'CLOSED' and (tg_op = 'INSERT' or old.status is distinct from 'CLOSED') then
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  end if;
  return new;
end;
$$;

create trigger periods_stamp_close before insert or update on public.periods
  for each row execute function private.stamp_period_close();
create trigger periods_set_updated_at before update on public.periods
  for each row execute function private.set_updated_at();

alter table public.periods enable row level security;

create policy "members read periods" on public.periods
  for select to authenticated using (private.is_member());
create policy "admins insert periods" on public.periods
  for insert to authenticated with check (private.is_admin());
create policy "admins update periods" on public.periods
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------------------------
-- bonus_settings and bonus_position_rates: parameters versioned by effective date. Rates are
-- never hard-coded; each date is paid with the version in force on it.
-- ---------------------------------------------------------------------------------------------

create table public.bonus_settings (
  id                     uuid primary key default gen_random_uuid(),
  effective_from         date not null,
  -- Inclusive; null means open-ended.
  effective_to           date,
  daily_cap              int not null check (daily_cap > 0),
  max_amount_per_person  int not null check (max_amount_per_person > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,

  constraint bonus_settings_range_is_ordered
    check (effective_to is null or effective_from <= effective_to),
  constraint bonus_settings_no_overlap
    exclude using gist (daterange(effective_from, effective_to, '[]') with &&)
    where (deleted_at is null)
);

create trigger bonus_settings_set_updated_at before update on public.bonus_settings
  for each row execute function private.set_updated_at();

alter table public.bonus_settings enable row level security;

create policy "members read bonus_settings" on public.bonus_settings
  for select to authenticated using (private.is_member());
create policy "admins insert bonus_settings" on public.bonus_settings
  for insert to authenticated with check (private.is_admin());
create policy "admins update bonus_settings" on public.bonus_settings
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- A bonus-eligible position may have no row here: the scheme trigger is never evaluated under
-- POSITION_RATE, so it deliberately has no rate. docs/DOMAIN.md §5.
create table public.bonus_position_rates (
  id                 uuid primary key default gen_random_uuid(),
  bonus_settings_id  uuid not null references public.bonus_settings (id),
  position_id        uuid not null references public.positions (id),
  amount             int not null check (amount >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create unique index bonus_position_rates_settings_position_key
  on public.bonus_position_rates (bonus_settings_id, position_id) where deleted_at is null;

create trigger bonus_position_rates_set_updated_at before update on public.bonus_position_rates
  for each row execute function private.set_updated_at();

alter table public.bonus_position_rates enable row level security;

create policy "members read bonus_position_rates" on public.bonus_position_rates
  for select to authenticated using (private.is_member());
create policy "admins insert bonus_position_rates" on public.bonus_position_rates
  for insert to authenticated with check (private.is_admin());
create policy "admins update bonus_position_rates" on public.bonus_position_rates
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------------------------
-- assignments: one employee, one date, one position. The atomic record.
-- ---------------------------------------------------------------------------------------------

create table public.assignments (
  id                    uuid primary key default gen_random_uuid(),
  date                  date not null,
  employee_id           uuid not null references public.employees (id),
  position_id           uuid not null references public.positions (id),
  note                  text,
  settled_in_period_id  uuid references public.periods (id),
  settled_amount        int,
  created_by            uuid references auth.users (id) default auth.uid(),
  updated_by            uuid references auth.users (id) default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint assignments_settlement_is_complete
    check ((settled_in_period_id is null) = (settled_amount is null)),
  constraint assignments_settled_amount_is_not_negative check (settled_amount >= 0)
);

-- Structural, never to be relaxed: one person holds one position per date, so nobody can earn
-- two bonuses in a day. It deliberately does not stop two people holding one position.
create unique index assignments_date_employee_key on public.assignments (date, employee_id)
  where deleted_at is null;

create function private.set_assignment_updated_by() returns trigger
language plpgsql as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- What was paid is never rewritten: not by a rate change, not by a correction, not by an admin.
-- A later correction becomes a review item; the frozen amount stays as it was paid.
create function private.freeze_settlement() returns trigger
language plpgsql as $$
begin
  if old.settled_in_period_id is not null
     and (new.settled_in_period_id, new.settled_amount)
         is distinct from (old.settled_in_period_id, old.settled_amount) then
    raise exception 'Assignment % was settled and its settlement is frozen', old.id;
  end if;
  return new;
end;
$$;

create trigger assignments_freeze_settlement before update on public.assignments
  for each row execute function private.freeze_settlement();
create trigger assignments_set_updated_at before update on public.assignments
  for each row execute function private.set_updated_at();
create trigger assignments_set_updated_by before update on public.assignments
  for each row execute function private.set_assignment_updated_by();

alter table public.assignments enable row level security;

-- Editors write unsettled assignments; settled ones, and settling itself, are admin-only.
create function private.may_write_assignment(settled_in_period_id uuid) returns boolean
language sql stable as $$
  select private.is_member() and (settled_in_period_id is null or private.is_admin());
$$;

create policy "members read assignments" on public.assignments
  for select to authenticated using (private.is_member());
create policy "members insert unsettled assignments" on public.assignments
  for insert to authenticated with check (private.may_write_assignment(settled_in_period_id));
create policy "members update unsettled assignments" on public.assignments
  for update to authenticated
  using (private.may_write_assignment(settled_in_period_id))
  with check (private.may_write_assignment(settled_in_period_id));

-- ---------------------------------------------------------------------------------------------
-- assignment_history: append-only, written by trigger so auditing never depends on someone
-- remembering to log. Records inserts, position changes and soft deletes (docs/DOMAIN.md §6).
-- The one permitted update is acknowledging the row as a review item, once.
-- ---------------------------------------------------------------------------------------------

create table public.assignment_history (
  id                    uuid primary key default gen_random_uuid(),
  assignment_id         uuid not null references public.assignments (id),
  date                  date not null,
  employee_id           uuid not null references public.employees (id),
  previous_position_id  uuid references public.positions (id),
  new_position_id       uuid references public.positions (id),
  changed_by            uuid references auth.users (id),
  changed_at            timestamptz not null default now(),
  acknowledged_at       timestamptz,
  acknowledged_by       uuid references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint assignment_history_records_a_movement
    check (previous_position_id is not null or new_position_id is not null)
);

create index assignment_history_assignment_idx on public.assignment_history (assignment_id);
create index assignment_history_unacknowledged_idx on public.assignment_history (date)
  where acknowledged_at is null and deleted_at is null;

-- A live assignment occupies its position; a soft-deleted one occupies none. Comparing the
-- occupied position before and after covers insert, change, soft delete and restore alike, and
-- a write that leaves it unchanged records nothing (the silent no-op of docs/DOMAIN.md §10).
create function private.record_assignment_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous_position uuid := case when tg_op = 'UPDATE' and old.deleted_at is null then old.position_id end;
  new_position uuid := case when new.deleted_at is null then new.position_id end;
begin
  if previous_position is distinct from new_position then
    insert into public.assignment_history
      (assignment_id, date, employee_id, previous_position_id, new_position_id, changed_by)
    values (new.id, new.date, new.employee_id, previous_position, new_position, auth.uid());
  end if;
  return null;
end;
$$;

create trigger assignments_record_history after insert or update on public.assignments
  for each row execute function private.record_assignment_history();

create function private.guard_history_acknowledgement() returns trigger
language plpgsql as $$
begin
  if old.acknowledged_at is not null then
    raise exception 'History row % is already acknowledged', old.id;
  end if;
  if new.acknowledged_at is null then
    raise exception 'The only permitted change to a history row is acknowledging it';
  end if;
  if (new.assignment_id, new.date, new.employee_id, new.previous_position_id,
      new.new_position_id, new.changed_by, new.changed_at, new.created_at, new.deleted_at)
     is distinct from
     (old.assignment_id, old.date, old.employee_id, old.previous_position_id,
      old.new_position_id, old.changed_by, old.changed_at, old.created_at, old.deleted_at) then
    raise exception 'History row % records what happened and cannot be rewritten', old.id;
  end if;

  new.acknowledged_by := auth.uid();
  return new;
end;
$$;

create function private.forbid_delete() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only; rows are never deleted', tg_table_name;
end;
$$;

create trigger assignment_history_guard_acknowledgement before update on public.assignment_history
  for each row execute function private.guard_history_acknowledgement();
create trigger assignment_history_set_updated_at before update on public.assignment_history
  for each row execute function private.set_updated_at();
create trigger assignment_history_forbid_delete before delete on public.assignment_history
  for each row execute function private.forbid_delete();

alter table public.assignment_history enable row level security;

-- No insert policy: only the trigger above writes history.
create policy "members read assignment_history" on public.assignment_history
  for select to authenticated using (private.is_member());
create policy "members acknowledge assignment_history" on public.assignment_history
  for update to authenticated using (private.is_member()) with check (private.is_member());

-- ---------------------------------------------------------------------------------------------
-- cap_overrides: an admin's recorded approval to settle one date above the daily cap, reachable
-- only when the excess cannot be corrected (docs/adr/0008). Append-only. The cap in force is
-- frozen into the row so it reads correctly years later.
-- ---------------------------------------------------------------------------------------------

create table public.cap_overrides (
  id               uuid primary key default gen_random_uuid(),
  period_id        uuid not null references public.periods (id),
  date             date not null,
  approved_amount  int not null check (approved_amount > 0),
  daily_cap        int not null check (daily_cap > 0),
  approved_by      uuid references auth.users (id) default auth.uid(),
  approved_at      timestamptz not null default now(),
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index cap_overrides_period_date_key on public.cap_overrides (period_id, date)
  where deleted_at is null;

create function private.forbid_update() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only; rows are never changed', tg_table_name;
end;
$$;

create trigger cap_overrides_forbid_update before update on public.cap_overrides
  for each row execute function private.forbid_update();
create trigger cap_overrides_forbid_delete before delete on public.cap_overrides
  for each row execute function private.forbid_delete();

alter table public.cap_overrides enable row level security;

create policy "members read cap_overrides" on public.cap_overrides
  for select to authenticated using (private.is_member());
create policy "admins insert cap_overrides" on public.cap_overrides
  for insert to authenticated with check (private.is_admin());

-- ---------------------------------------------------------------------------------------------
-- applied_operations and apply_assignment_operation: the server half of the offline write queue
-- (docs/DOMAIN.md §10). Each queued edit carries a client-generated op_id; recording it and
-- applying the edit happen in one transaction, so a replay is a no-op that succeeds.
-- Not purged (docs/DOMAIN.md §12, decision 5).
-- ---------------------------------------------------------------------------------------------

create table public.applied_operations (
  id          uuid primary key default gen_random_uuid(),
  op_id       uuid not null,
  applied_by  uuid references auth.users (id) default auth.uid(),
  applied_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index applied_operations_op_id_key on public.applied_operations (op_id)
  where deleted_at is null;

create trigger applied_operations_forbid_update before update on public.applied_operations
  for each row execute function private.forbid_update();

alter table public.applied_operations enable row level security;

create policy "members read applied_operations" on public.applied_operations
  for select to authenticated using (private.is_member());
create policy "members record their own operations" on public.applied_operations
  for insert to authenticated with check (private.is_member() and applied_by = auth.uid());

-- Sets one cell of the day grid to its full new state: a position, or none (p_position_id
-- omitted or null clears the cell). Runs as the caller,
-- so every policy on assignments applies. An unchanged cell is not rewritten, which keeps the
-- common case of two devices sending the same value out of the history.
create function public.apply_assignment_operation(
  p_op_id        uuid,
  p_date         date,
  p_employee_id  uuid,
  p_position_id  uuid default null,
  p_note         text default null
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

  insert into public.assignments (date, employee_id, position_id, note)
  values (p_date, p_employee_id, p_position_id, p_note)
  on conflict (date, employee_id) where deleted_at is null
  do update set position_id = excluded.position_id, note = excluded.note
  where (assignments.position_id, assignments.note)
        is distinct from (excluded.position_id, excluded.note);
end;
$$;

revoke execute on function public.apply_assignment_operation from public, anon;
grant execute on function public.apply_assignment_operation to authenticated;

-- ---------------------------------------------------------------------------------------------
-- review_items: history rows that moved a date already settled, not yet acknowledged
-- (docs/DOMAIN.md §7). Derived, not stored. A row qualifies when it came after the close of
--   * the period that settled its assignment, or
--   * a closed period containing its date, and the position before or after is bonus-eligible.
-- When both apply, the settling period is the one reported.
-- ---------------------------------------------------------------------------------------------

create view public.review_items with (security_invoker = true) as
select
  history.id                    as history_id,
  history.assignment_id,
  history.date,
  history.employee_id,
  history.previous_position_id,
  history.new_position_id,
  history.changed_by,
  history.changed_at,
  period.id                     as period_id
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
        and exists (
          select 1 from public.positions position
          where position.id in (history.previous_position_id, history.new_position_id)
            and position.bonus_eligible
        )
      )
    )
  order by (closed.id is not distinct from assignment.settled_in_period_id) desc
  limit 1
) period on true
where history.acknowledged_at is null
  and history.deleted_at is null;
