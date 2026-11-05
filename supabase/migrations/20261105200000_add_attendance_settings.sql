-- How the app uses what it reads from Workera (docs/adr/0022, docs/DOMAIN.md §5d).
--
-- One row, edited by the admin. Stage 1 starts on a date set here rather than on a deploy. Until a
-- date is set, reading Workera changes nothing anyone sees.

create table public.attendance_settings (
  id               uuid primary key default gen_random_uuid(),
  mismatches_from  date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index attendance_settings_single_row
  on public.attendance_settings ((true)) where deleted_at is null;

create trigger attendance_settings_set_updated_at before update on public.attendance_settings
  for each row execute function private.set_updated_at();

alter table public.attendance_settings enable row level security;

create policy "members read attendance_settings" on public.attendance_settings
  for select to authenticated using (private.is_member());
create policy "admins update attendance_settings" on public.attendance_settings
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

insert into public.attendance_settings default values;
