-- Acknowledging a review item takes it out of the tray; it must not make it unfindable
-- (docs/DOMAIN.md §7). review_history applies the same rule as review_items without the
-- "not yet acknowledged" filter, and exposes who acknowledged each item and when.
-- review_items is redefined on top of it, so the rule lives in one place. Its columns do not
-- change.

create view public.review_history with (security_invoker = true) as
select
  history.id                    as history_id,
  history.assignment_id,
  history.date,
  history.employee_id,
  history.previous_position_id,
  history.new_position_id,
  history.changed_by,
  history.changed_at,
  period.id                     as period_id,
  history.acknowledged_at,
  history.acknowledged_by
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
where history.deleted_at is null;

create or replace view public.review_items with (security_invoker = true) as
select
  history_id,
  assignment_id,
  date,
  employee_id,
  previous_position_id,
  new_position_id,
  changed_by,
  changed_at,
  period_id
from public.review_history
where acknowledged_at is null;
