-- History has to say who changed a cell, and assignment_history.changed_by is an auth user id
-- that no user can resolve: auth.users is not readable from the app. The username is the name
-- people sign in with (the local part of the synthetic user@cga.local address), so it is the
-- name they recognise. Additive: a new nullable column, backfilled, kept in sync by the same
-- trigger that already maintains the role.

alter table public.profiles add column username text;

update public.profiles
   set username = split_part(users.email, '@', 1)
  from auth.users
 where users.id = profiles.id;

create or replace function private.sync_profile_from_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  granted_role text := new.raw_app_meta_data ->> 'role';
  username text := split_part(new.email, '@', 1);
begin
  if granted_role in ('admin', 'editor') then
    insert into public.profiles (id, role, username) values (new.id, granted_role, username)
    on conflict (id) do update
      set role = excluded.role, username = excluded.username, deleted_at = null;
  else
    update public.profiles set deleted_at = now() where id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

drop trigger on_auth_user_saved on auth.users;
create trigger on_auth_user_saved after insert or update of raw_app_meta_data, email on auth.users
  for each row execute function private.sync_profile_from_auth_user();
