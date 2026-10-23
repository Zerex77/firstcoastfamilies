-- Food truck stops posted by truck owners (approved on admin.html).
-- Run once in Supabase → SQL Editor.
create table if not exists public.truck_stops (
  id          uuid primary key default gen_random_uuid(),
  truck       text not null check (length(truck) between 1 and 120),
  cuisine     text check (length(cuisine) < 80),
  date        date not null,
  time_text   text check (length(time_text) < 60),
  venue       text check (length(venue) < 200),
  address     text check (length(address) < 200),
  area        text check (area in ('jax','beaches','pv','wgv','sa','amelia','clay')),
  lat         double precision,
  lng         double precision,
  url         text check (url ~* '^https?://' and length(url) < 300),
  description text check (length(description) < 600),
  created_at  timestamptz not null default now()
);
alter table public.truck_stops enable row level security;
drop policy if exists "truck stops read"  on public.truck_stops;
drop policy if exists "truck stops admin" on public.truck_stops;
create policy "truck stops read"  on public.truck_stops for select using (true);
create policy "truck stops admin" on public.truck_stops for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Remove past truck stops every morning.
select cron.unschedule('fcf-remove-past-truck-stops') where exists (select 1 from cron.job where jobname = 'fcf-remove-past-truck-stops');
select cron.schedule('fcf-remove-past-truck-stops', '20 9 * * *', $$
  delete from public.truck_stops where date < (now() at time zone 'America/New_York')::date;
$$);
