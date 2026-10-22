-- Ad inquiries from the "Reach First Coast families" form.
create table if not exists public.ad_inquiries (
  id            uuid primary key default gen_random_uuid(),
  business      text not null check (length(business) between 1 and 200),
  contact_name  text check (length(contact_name) < 150),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) < 200),
  phone         text check (length(phone) < 50),
  interests     text[] not null default '{}',
  message       text check (length(message) < 2000),
  handled       boolean not null default false,
  created_at    timestamptz not null default now()
);
alter table public.ad_inquiries enable row level security;
drop policy if exists "inquiries insert" on public.ad_inquiries;
drop policy if exists "inquiries admin"  on public.ad_inquiries;
create policy "inquiries insert" on public.ad_inquiries for insert to anon, authenticated with check (handled = false);
create policy "inquiries admin"  on public.ad_inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
