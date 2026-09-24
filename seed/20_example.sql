-- Example data so anyone who clones the repository can run the app. All of it is fictional.
--
-- Real names, RUTs and rates live in a gitignored `seed/*.local.sql` file that sorts before
-- this one. Each block below inserts only when its table is still empty, so when the local file
-- is present, this file does nothing.
--
-- RUTs here carry a deliberately invalid check digit, so none can match a real person.
-- Rates are the example values of docs/DOMAIN.md §5: they keep the structure of the real ones
-- (three equal rates, a lower fourth, the four summing exactly to the cap) and nothing else.

insert into public.employees (first_name, last_name, national_id)
select first_name, last_name, national_id
from (values
  ('Ana',      'Soto',     '10000001-7'),
  ('Bruno',    'Reyes',    '10000002-5'),
  ('Carla',    'Muñoz',    '10000003-3'),
  ('Diego',    'Fuentes',  '10000004-1'),
  ('Elena',    'Rojas',    '10000005-0'),
  ('Felipe',   'Castro',   '10000006-8'),
  ('Gabriela', 'Vera',     '10000007-6'),
  ('Hugo',     'Morales',  '10000008-4')
) as example (first_name, last_name, national_id)
where not exists (select 1 from public.employees);

with example_settings as (
  insert into public.bonus_settings (effective_from, effective_to, daily_cap, max_amount_per_person)
  select date '2026-01-01', null, 15000, 2500
  where not exists (select 1 from public.bonus_settings)
  returning id
)
insert into public.bonus_position_rates (bonus_settings_id, position_id, amount)
select example_settings.id, positions.id, rates.amount
from example_settings
cross join (values
  ('RIETER',             4000),
  ('ACM',                4000),
  ('ENCAJADOR_ACM',      4000),
  ('ALIMENTADOR_RIETER', 3000)
) as rates (code, amount)
join public.positions on positions.code = rates.code and positions.deleted_at is null;
-- PACKING_ACM has no rate on purpose: it forces EQUAL_SHARE, so it is never paid by rate.
