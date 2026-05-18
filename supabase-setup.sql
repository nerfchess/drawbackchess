-- Drawback Chess: one-time Supabase setup.
--
-- Run this once in your Supabase project's SQL editor:
--   Supabase dashboard → SQL Editor → New Query → paste this → Run.
--
-- It creates a `player_ratings` table that stores each player's Glicko-2
-- rating. The table is intentionally open (anyone with the anon key can
-- read and upsert) because this app uses lightweight per-browser identity
-- (no auth). If you later add real auth, tighten the policies to allow
-- writes only for `auth.uid() = id`.

create table if not exists public.player_ratings (
  id text primary key,
  name text,
  rating real not null default 1500,
  rd real not null default 350,
  vol real not null default 0.06,
  games_played int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.player_ratings enable row level security;

drop policy if exists "ratings_read_all" on public.player_ratings;
create policy "ratings_read_all" on public.player_ratings
  for select using (true);

drop policy if exists "ratings_insert_any" on public.player_ratings;
create policy "ratings_insert_any" on public.player_ratings
  for insert with check (true);

drop policy if exists "ratings_update_any" on public.player_ratings;
create policy "ratings_update_any" on public.player_ratings
  for update using (true) with check (true);
