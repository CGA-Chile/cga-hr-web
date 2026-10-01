-- A short label per position, for the period sheet. The sheet shows a whole period at once, one
-- narrow column per day, so each cell holds an abbreviation (RIE, ACM, ENC…) instead of the full
-- name. It is data, editable by the admin like the name, so a new position never needs a deploy.
--
-- Additive: the column is added, backfilled for the seeded catalogue, then required. Any
-- position outside the catalogue gets the first three characters of its code, which the admin can
-- change afterwards.

alter table public.positions add column abbreviation text;

update public.positions position
   set abbreviation = catalogue.abbreviation
  from (values
    ('RIETER', 'RIE'),
    ('ACM', 'ACM'),
    ('ENCAJADOR_ACM', 'ENC'),
    ('ALIMENTADOR_RIETER', 'ALI'),
    ('PACKING_ACM', 'PACM'),
    ('ABSORBENTE', 'ABS'),
    ('ASEO', 'ASE'),
    ('BODEGA', 'BOD'),
    ('CARDA_COIL', 'CCO'),
    ('CARDA_VIEJA', 'CVI'),
    ('COPOS', 'COP'),
    ('ENCAJADOR_FALUS', 'EFA'),
    ('FALU_A1_MAXI', 'FA1'),
    ('FALU_A2_MAXI', 'FA2'),
    ('FALU_N1', 'FN1'),
    ('FALU_N2', 'FN2'),
    ('MANTENCION', 'MAN'),
    ('PACKING', 'PCK'),
    ('PRENSADO', 'PRE'),
    ('SUPERVISOR', 'SUP'),
    ('LICENCIA', 'LIC'),
    ('FALTA', 'FAL')
  ) as catalogue (code, abbreviation)
 where position.code = catalogue.code;

update public.positions set abbreviation = left(code, 3) where abbreviation is null;

alter table public.positions
  alter column abbreviation set not null,
  add constraint positions_abbreviation_is_short check (char_length(abbreviation) between 1 and 5);
