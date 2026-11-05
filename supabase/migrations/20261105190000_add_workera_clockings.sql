-- What the app read from Workera (docs/adr/0022, docs/DOMAIN.md §5d).
--
-- Workera is the source of truth for attendance, and the app only reads it. These tables hold a
-- copy of what was read, with only the fields the rules need. A person is their RUT here, not an
-- employee id: a clocking can arrive before anyone has mapped that person to an employee.
--
-- Times have no zone because Workera sends none: they are the plant's wall clock.
--
-- 1. attendance_clockings: entries and exits.
-- 2. attendance_schedules: what each person was due to work.
-- 3. attendance_reads: which dates were read, so "no clockings" differs from "not read".
-- 4. record_attendance_read: replaces a range with what was just read, in one transaction.
-- 5. record_attendance_read_failure: notes the dates that could not be read.

-- 1 -------------------------------------------------------------------------------------------

create table public.attendance_clockings (
  id             uuid primary key default gen_random_uuid(),
  national_id    text not null check (length(trim(national_id)) > 0),
  clocked_at     timestamp not null,
  clocking_date  date generated always as (clocked_at::date) stored,
  -- Workera's own code: 0 entry, 1 exit, 2 and 3 extraordinary, 4 and 5 rest.
  workera_type   smallint not null check (workera_type between 0 and 5),
  status         text not null check (status in ('ACTIVE', 'INACTIVE', 'MODIFIED')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create unique index attendance_clockings_identity_key
  on public.attendance_clockings (national_id, clocked_at, workera_type) where deleted_at is null;
create index attendance_clockings_date_idx
  on public.attendance_clockings (clocking_date) where deleted_at is null;

create trigger attendance_clockings_set_updated_at before update on public.attendance_clockings
  for each row execute function private.set_updated_at();

alter table public.attendance_clockings enable row level security;

-- No write policies: only record_attendance_read writes.
create policy "members read attendance_clockings" on public.attendance_clockings
  for select to authenticated using (private.is_member());

-- 2 -------------------------------------------------------------------------------------------

create table public.attendance_schedules (
  id             uuid primary key default gen_random_uuid(),
  national_id    text not null check (length(trim(national_id)) > 0),
  schedule_date  date not null,
  starts_at      timestamp not null,
  ends_at        timestamp not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint attendance_schedules_range_is_ordered check (starts_at < ends_at)
);

create unique index attendance_schedules_identity_key
  on public.attendance_schedules (national_id, schedule_date, starts_at) where deleted_at is null;
create index attendance_schedules_date_idx
  on public.attendance_schedules (schedule_date) where deleted_at is null;

create trigger attendance_schedules_set_updated_at before update on public.attendance_schedules
  for each row execute function private.set_updated_at();

alter table public.attendance_schedules enable row level security;

create policy "members read attendance_schedules" on public.attendance_schedules
  for select to authenticated using (private.is_member());

-- 3 -------------------------------------------------------------------------------------------

create table public.attendance_reads (
  id          uuid primary key default gen_random_uuid(),
  read_date   date not null,
  succeeded   boolean not null,
  read_at     timestamptz not null default now(),
  failure     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint attendance_reads_failure_matches_result check (succeeded = (failure is null))
);

create unique index attendance_reads_date_key
  on public.attendance_reads (read_date) where deleted_at is null;

create trigger attendance_reads_set_updated_at before update on public.attendance_reads
  for each row execute function private.set_updated_at();

alter table public.attendance_reads enable row level security;

create policy "members read attendance_reads" on public.attendance_reads
  for select to authenticated using (private.is_member());

-- 4 -------------------------------------------------------------------------------------------

create function private.may_record_attendance() returns boolean
language sql stable set search_path = '' as $$
  -- is_admin() is null for someone without a role, and `not null` would let them through.
  select coalesce(private.is_admin() or auth.role() = 'service_role', false);
$$;

-- A clocking corrected or removed in Workera has to stop counting here, so whatever the range
-- held and the read no longer brings is soft-deleted.
create function public.record_attendance_read(
  p_from date,
  p_to date,
  p_clockings jsonb,
  p_schedules jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.may_record_attendance() then
    raise exception 'Only an admin can record a read of Workera' using errcode = '42501';
  end if;
  if p_from > p_to or p_to - p_from >= 366 then
    raise exception 'A read covers from 1 to 366 dates' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_clockings) as item
    where (item ->> 'clocked_at')::timestamp::date not between p_from and p_to
  ) or exists (
    select 1 from jsonb_array_elements(p_schedules) as item
    where (item ->> 'schedule_date')::date not between p_from and p_to
  ) then
    raise exception 'A row falls outside the range read' using errcode = '22023';
  end if;

  update public.attendance_clockings as stored
  set deleted_at = now()
  where stored.deleted_at is null
    and stored.clocking_date between p_from and p_to
    and not exists (
      select 1 from jsonb_array_elements(p_clockings) as item
      where item ->> 'national_id' = stored.national_id
        and (item ->> 'clocked_at')::timestamp = stored.clocked_at
        and (item ->> 'workera_type')::smallint = stored.workera_type
    );

  insert into public.attendance_clockings (national_id, clocked_at, workera_type, status)
  select distinct on (1, 2, 3)
    item ->> 'national_id',
    (item ->> 'clocked_at')::timestamp,
    (item ->> 'workera_type')::smallint,
    item ->> 'status'
  from jsonb_array_elements(p_clockings) as item
  on conflict (national_id, clocked_at, workera_type) where deleted_at is null
  do update set status = excluded.status
  where public.attendance_clockings.status <> excluded.status;

  update public.attendance_schedules as stored
  set deleted_at = now()
  where stored.deleted_at is null
    and stored.schedule_date between p_from and p_to
    and not exists (
      select 1 from jsonb_array_elements(p_schedules) as item
      where item ->> 'national_id' = stored.national_id
        and (item ->> 'schedule_date')::date = stored.schedule_date
        and (item ->> 'starts_at')::timestamp = stored.starts_at
    );

  insert into public.attendance_schedules (national_id, schedule_date, starts_at, ends_at)
  select distinct on (1, 2, 3)
    item ->> 'national_id',
    (item ->> 'schedule_date')::date,
    (item ->> 'starts_at')::timestamp,
    (item ->> 'ends_at')::timestamp
  from jsonb_array_elements(p_schedules) as item
  on conflict (national_id, schedule_date, starts_at) where deleted_at is null
  do update set ends_at = excluded.ends_at
  where public.attendance_schedules.ends_at <> excluded.ends_at;

  insert into public.attendance_reads (read_date, succeeded, read_at, failure)
  select day::date, true, now(), null
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as day
  on conflict (read_date) where deleted_at is null
  do update set succeeded = true, read_at = now(), failure = null;
end;
$$;

revoke execute on function public.record_attendance_read from public, anon;
grant execute on function public.record_attendance_read to authenticated, service_role;

-- 5 -------------------------------------------------------------------------------------------

-- A date read well before stays read: what it holds is still the last good copy, and a reread
-- that failed says nothing against it.
create function public.record_attendance_read_failure(
  p_from date,
  p_to date,
  p_failure text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.may_record_attendance() then
    raise exception 'Only an admin can record a read of Workera' using errcode = '42501';
  end if;
  if p_from > p_to or p_to - p_from >= 366 then
    raise exception 'A read covers from 1 to 366 dates' using errcode = '22023';
  end if;

  insert into public.attendance_reads (read_date, succeeded, read_at, failure)
  select day::date, false, now(), p_failure
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as day
  on conflict (read_date) where deleted_at is null
  do update set read_at = excluded.read_at, failure = excluded.failure
  where not public.attendance_reads.succeeded;
end;
$$;

revoke execute on function public.record_attendance_read_failure from public, anon;
grant execute on function public.record_attendance_read_failure to authenticated, service_role;
