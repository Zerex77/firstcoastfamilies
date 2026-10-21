-- First Coast Families database setup.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Then run seed.sql the same way to load the current listings.

-- ---------- Tables ----------

create table if not exists public.listings (
  id            text primary key,
  kind          text not null check (kind in ('event','concert','place')),
  name          text not null,
  county        text,
  area          text check (area in ('jax','beaches','pv','wgv','sa','amelia','clay')),
  venue         text,
  lat           double precision,
  lng           double precision,
  price         numeric,            -- typical per-kid price; 0 = free; null = unknown
  price_note    text,               -- shown when price is unknown, e.g. "Tickets"
  price_detail  text,
  hours         text,
  age_note      text,
  tips          text,
  ages          text[] not null default '{}',
  io            text check (io in ('in','out')),
  start_date    date,
  end_date      date,
  time_text     text,
  description   text,
  tags          text[] not null default '{}',
  url           text,
  sponsored     boolean not null default false,
  source        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Anything waiting for review: venue submissions and the twice-a-month sweep.
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'venue' check (source in ('venue','sweep')),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  item        jsonb not null check (octet_length(item::text) < 8000),
  sweep_key   text unique,           -- doc id from the sweep file, so re-imports don't duplicate
  created_at  timestamptz not null default now()
);

create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) < 200),
  ages        text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- People allowed into admin.html. Add yourself after your first sign-in (see README).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings for each row execute function public.touch_updated_at();

-- ---------- Row-level security ----------

alter table public.listings    enable row level security;
alter table public.submissions enable row level security;
alter table public.subscribers enable row level security;
alter table public.admins      enable row level security;

-- Listings: everyone reads, only admins change.
drop policy if exists "listings read"  on public.listings;
drop policy if exists "listings admin" on public.listings;
create policy "listings read"  on public.listings for select using (true);
create policy "listings admin" on public.listings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Submissions: anyone can add a pending venue submission; only admins see or change them.
drop policy if exists "submissions insert" on public.submissions;
drop policy if exists "submissions admin"  on public.submissions;
create policy "submissions insert" on public.submissions for insert to anon, authenticated
  with check (status = 'pending' and source = 'venue' and sweep_key is null);
create policy "submissions admin"  on public.submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Subscribers: anyone can sign up; only admins can read the list.
drop policy if exists "subscribers insert" on public.subscribers;
drop policy if exists "subscribers admin"  on public.subscribers;
create policy "subscribers insert" on public.subscribers for insert to anon, authenticated with check (true);
create policy "subscribers admin"  on public.subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Admins table: admins can see who else is an admin; nobody adds rows from the site.
drop policy if exists "admins read" on public.admins;
create policy "admins read" on public.admins for select to authenticated using (public.is_admin());

-- ---------- Nightly cleanup (no Claude needed) ----------
-- Removes events whose last day has passed. Needs the pg_cron extension
-- (Supabase → Database → Extensions → pg_cron). If this part errors, enable it there and rerun just this block.
create extension if not exists pg_cron;
select cron.unschedule('fcf-remove-past-events') where exists (select 1 from cron.job where jobname = 'fcf-remove-past-events');
select cron.schedule('fcf-remove-past-events', '15 9 * * *', $$
  delete from public.listings
   where kind <> 'place'
     and coalesce(end_date, start_date) < (now() at time zone 'America/New_York')::date;
  delete from public.submissions
   where status <> 'pending' and created_at < now() - interval '60 days';
$$);
