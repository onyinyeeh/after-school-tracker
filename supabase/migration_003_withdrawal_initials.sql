-- After-School Tracker — withdrawal sign-off with initials
--
-- Run this in the Supabase SQL editor after migration_002. Each withdrawal
-- now records the kid's initials and the grown-up's initials as a signature.
alter table withdrawals
  add column if not exists kid_initials text,
  add column if not exists parent_initials text;
