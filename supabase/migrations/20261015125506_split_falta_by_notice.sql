-- Falta splits into Falta con aviso and Falta sin aviso (docs/DOMAIN.md §5, §11).
--
-- Both pay what Falta paid, nothing: the notice is kept for the record, not for the bonus. Falta
-- itself is retired rather than renamed. Its assignments do not say whether the person gave
-- notice, and renaming it would claim one for every past absence. Retired means inactive: past
-- cells keep showing it, and the picker no longer offers it.

insert into public.positions (code, name, abbreviation, type, bonus_eligible, triggers_equal_share, display_order)
select code, name, abbreviation, type, bonus_eligible, triggers_equal_share, display_order
from (values
  ('FALTA_CON_AVISO', 'Falta con aviso', 'FCA', 'ABSENCE', false, false, 900),
  ('FALTA_SIN_AVISO', 'Falta sin aviso', 'FSA', 'ABSENCE', false, false, 905)
) as catalogue (code, name, abbreviation, type, bonus_eligible, triggers_equal_share, display_order)
where not exists (
  select 1 from public.positions existing
  where existing.code = catalogue.code and existing.deleted_at is null
);

update public.positions set active = false where code = 'FALTA' and deleted_at is null;
