-- After-School Tracker — carry-forward unpaid earnings + lifetime totals
--
-- Run this in the Supabase SQL editor after migration.sql. Fixes two bugs:
-- 1. A week that wasn't marked paid before the weekly rollover silently lost
--    that week's coins forever. Unpaid earnings now carry forward in
--    kid_stats.carry_unpaid and stay collectible any time, indefinitely.
-- 2. "Earned all time" / "Withdrawn" on the Wallet tab were computed by
--    summing only the most recent 8 week_history rows, so they'd quietly
--    become wrong after ~2 months of use. Now backed by dedicated
--    lifetime_earned / lifetime_withdrawn counters that never get re-derived
--    from a capped query.

alter table kid_stats
  add column if not exists lifetime_earned int not null default 0,
  add column if not exists lifetime_withdrawn int not null default 0,
  add column if not exists carry_unpaid int not null default 0;

-- Backfill from existing week_history (unlimited in the DB — only the old
-- app-level query capped it to 8 rows). paid_label was set to "Not marked
-- paid" by the fold job whenever a week closed without being paid; anything
-- else (e.g. "Paid Sun 20 Sep") means it was settled.
update kid_stats ks
set
  lifetime_earned = coalesce((select sum(wh.amount) from week_history wh where wh.kid_id = ks.kid_id), 0),
  lifetime_withdrawn = coalesce(
    (select sum(wh.amount) from week_history wh where wh.kid_id = ks.kid_id and wh.paid_label <> 'Not marked paid'),
    0
  ),
  carry_unpaid = coalesce(
    (select sum(wh.amount) from week_history wh where wh.kid_id = ks.kid_id and wh.paid_label = 'Not marked paid'),
    0
  );
