-- After-School Tracker — initial schema
--
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query),
-- or `supabase db push` if you have the CLI linked to this project. Safe to
-- run once against a fresh project; re-running will error on the existing
-- objects (drop them first if you need to start over).

create extension if not exists "pgcrypto";

-- ── families ────────────────────────────────────────────────────────────
-- One row per household. `owner_user_id` is the parent's Supabase Auth user
-- (magic-link email). `pin_hash` is a bcrypt hash of the 4-digit grown-up
-- PIN — never store or compare the raw PIN.
create table families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  pin_hash text not null,
  timezone text not null default 'Africa/Lagos',
  created_at timestamptz not null default now()
);
create unique index families_owner_user_id_idx on families (owner_user_id);

-- ── kids ────────────────────────────────────────────────────────────────
create table kids (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  name text not null,
  grade text not null default '',
  color text not null default '#A3326A',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index kids_family_id_idx on kids (family_id);

-- ── weeks ───────────────────────────────────────────────────────────────
-- One row per family per ISO week (Monday start). `start_day` > 0 marks a
-- partial first week (no streak bonus possible) — see foldKidStats/summary
-- in src/lib/rules.ts.
create table weeks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  week_start date not null,
  start_day int not null default 0,
  challenge_id text,
  paid_at timestamptz,
  -- Set by the weekly cron (app/api/cron/fold-week) once this week's stats
  -- have been folded into kid_stats/week_history — makes the fold idempotent.
  folded_at timestamptz,
  unique (family_id, week_start)
);
create index weeks_family_id_idx on weeks (family_id);

-- ── day_tasks ───────────────────────────────────────────────────────────
-- One row per kid per date per task. `weekend_study` carries `study_secs`
-- for the 2-hour timer; weekday tasks leave it at 0.
create table day_tasks (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids (id) on delete cascade,
  date date not null,
  task text not null check (task in ('rest', 'study', 'eve', 'weekend_study')),
  status text check (status in ('done', 'finished', 'clear', 'not')),
  done_at_min int,
  study_secs int not null default 0,
  updated_at timestamptz not null default now(),
  unique (kid_id, date, task)
);
create index day_tasks_kid_id_date_idx on day_tasks (kid_id, date);

-- ── withdrawals ─────────────────────────────────────────────────────────
create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids (id) on delete cascade,
  week_id uuid not null references weeks (id) on delete cascade,
  amount int not null,
  requested_at timestamptz not null default now(),
  paid_at timestamptz
);
create index withdrawals_kid_id_idx on withdrawals (kid_id);
create index withdrawals_week_id_idx on withdrawals (week_id);

-- ── prizes ──────────────────────────────────────────────────────────────
create table prizes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  days int not null,
  text text not null,
  sort int not null default 0
);
create index prizes_family_id_idx on prizes (family_id);

-- ── prizes_given ────────────────────────────────────────────────────────
create table prizes_given (
  kid_id uuid not null references kids (id) on delete cascade,
  prize_id uuid not null references prizes (id) on delete cascade,
  given_at timestamptz not null default now(),
  primary key (kid_id, prize_id)
);

-- ── kid_stats ───────────────────────────────────────────────────────────
-- Folded lifetime stats, one row per kid. Written by the weekly cron
-- (foldKidStats in src/lib/rules.ts) — see app/api/cron/fold-week.
create table kid_stats (
  kid_id uuid primary key references kids (id) on delete cascade,
  early int not null default 0,
  clear int not null default 0,
  bed int not null default 0,
  perfect int not null default 0,
  weekend int not null default 0,
  best_streak int not null default 0,
  carry_streak int not null default 0,
  shields int not null default 0,
  challenges_won int not null default 0,
  updated_at timestamptz not null default now()
);

-- ── week_history ────────────────────────────────────────────────────────
create table week_history (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids (id) on delete cascade,
  week_start date not null,
  amount int not null,
  bonus boolean not null default false,
  note text not null default '',
  paid_label text not null default ''
);
create index week_history_kid_id_idx on week_history (kid_id);

-- ── new-family defaults ─────────────────────────────────────────────────
-- Seed the 3 default streak prizes whenever a family is created, matching
-- the prototype's defaults (README "Business rules" / prizes section).
create function seed_family_defaults() returns trigger as $$
begin
  insert into prizes (family_id, days, text, sort) values
    (new.id, 20, 'Choose a treat', 0),
    (new.id, 50, 'A day out you pick', 1),
    (new.id, 100, 'Something big you choose', 2);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger families_seed_defaults
  after insert on families
  for each row execute function seed_family_defaults();

-- ── Row Level Security ──────────────────────────────────────────────────
-- Every table is scoped to the signed-in parent's own family. Kids never
-- sign in (they pick a name in the UI), so all reads/writes for the shared
-- PC flow go through the parent's authenticated session or a Server Action
-- using the service-role key — either way, scoped by family_id below.

alter table families enable row level security;
alter table kids enable row level security;
alter table weeks enable row level security;
alter table day_tasks enable row level security;
alter table withdrawals enable row level security;
alter table prizes enable row level security;
alter table prizes_given enable row level security;
alter table kid_stats enable row level security;
alter table week_history enable row level security;

create policy "own family" on families
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "own family's kids" on kids
  for all using (family_id in (select id from families where owner_user_id = auth.uid()))
  with check (family_id in (select id from families where owner_user_id = auth.uid()));

create policy "own family's weeks" on weeks
  for all using (family_id in (select id from families where owner_user_id = auth.uid()))
  with check (family_id in (select id from families where owner_user_id = auth.uid()));

create policy "own family's day_tasks" on day_tasks
  for all using (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  )) with check (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  ));

create policy "own family's withdrawals" on withdrawals
  for all using (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  )) with check (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  ));

create policy "own family's prizes" on prizes
  for all using (family_id in (select id from families where owner_user_id = auth.uid()))
  with check (family_id in (select id from families where owner_user_id = auth.uid()));

create policy "own family's prizes_given" on prizes_given
  for all using (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  )) with check (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  ));

create policy "own family's kid_stats" on kid_stats
  for all using (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  )) with check (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  ));

create policy "own family's week_history" on week_history
  for all using (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  )) with check (kid_id in (
    select k.id from kids k join families f on f.id = k.family_id where f.owner_user_id = auth.uid()
  ));
