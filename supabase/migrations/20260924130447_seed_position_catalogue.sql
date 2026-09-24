-- The position catalogue from docs/DOMAIN.md §11. Reference data the app cannot work without,
-- so it ships as a migration and reaches production with `db push`; the seed does not.
--
-- display_order is not cosmetic. The five carding-line positions come first, and generic
-- Packing sits far from Packing ACM: alphabetically they would be adjacent in the picker, and
-- confusing them changes the bonus for the entire line.
--
-- Discarded from the old sheet: lowercase `bodega` (a duplicate of Bodega) and `eliminado`
-- (that is what employees.active = false is for).

insert into public.positions (code, name, type, bonus_eligible, triggers_equal_share, display_order)
values
  ('RIETER',             'Rieter',             'WORK',    true,  false, 10),
  ('ACM',                'ACM',                'WORK',    true,  false, 20),
  ('ENCAJADOR_ACM',      'Encajador ACM',      'WORK',    true,  false, 30),
  ('ALIMENTADOR_RIETER', 'Alimentador Rieter', 'WORK',    true,  false, 40),
  ('PACKING_ACM',        'Packing ACM',        'WORK',    true,  true,  50),

  ('ABSORBENTE',         'Absorbente',         'WORK',    false, false, 110),
  ('ASEO',               'Aseo',               'WORK',    false, false, 120),
  ('BODEGA',             'Bodega',             'WORK',    false, false, 130),
  ('CARDA_COIL',         'Carda Coil',         'WORK',    false, false, 140),
  ('CARDA_VIEJA',        'Carda Vieja',        'WORK',    false, false, 150),
  ('COPOS',              'Copos',              'WORK',    false, false, 160),
  ('ENCAJADOR_FALUS',    'Encajador Falus',    'WORK',    false, false, 170),
  ('FALU_A1_MAXI',       'Falu A1 Maxi',       'WORK',    false, false, 180),
  ('FALU_A2_MAXI',       'Falu A2 Maxi',       'WORK',    false, false, 190),
  ('FALU_N1',            'Falu N1',            'WORK',    false, false, 200),
  ('FALU_N2',            'Falu N2',            'WORK',    false, false, 210),
  ('MANTENCION',         'Mantención',         'WORK',    false, false, 220),
  ('PACKING',            'Packing',            'WORK',    false, false, 230),
  ('PRENSADO',           'Prensado',           'WORK',    false, false, 240),
  ('SUPERVISOR',         'Supervisor',         'WORK',    false, false, 250),

  ('LICENCIA',           'Licencia',           'ABSENCE', false, false, 910),
  ('FALTA',              'Falta',              'ABSENCE', false, false, 920);
