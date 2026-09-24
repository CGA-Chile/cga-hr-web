-- A validated excess approves an exact amount for a date (docs/adr/0008). If another late
-- assignment lands on that date before the close, the amount changes and the earlier approval no
-- longer covers it: the admin has to approve the new amount. The unique index on
-- (period_id, date) added in the initial schema made that impossible. It was not in the
-- specification, and each row is a record of one approval, so several per date are legitimate.
--
-- Dropping an index removes no data and relaxes nothing the domain relies on.

drop index public.cap_overrides_period_date_key;

create index cap_overrides_period_date_idx on public.cap_overrides (period_id, date)
  where deleted_at is null;
