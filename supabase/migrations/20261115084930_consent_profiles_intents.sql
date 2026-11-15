-- Arksus: Google sign-in data (docs/legal/README.md). No parcel, no geometry, no GPS: only il + ilçe.
-- Applied to Supabase project "nobetsu" (tbqxvodltsvvsvkoobdw) on 2026-11-15. Owner: Gümüş.

-- 1. Consent log (append-only, for proof). kind: notice_read | district_stats | llm_training.
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('notice_read', 'district_stats', 'llm_training')),
  version text not null check (length(version) between 1 and 40),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_kind on public.consents (user_id, kind, created_at desc);
alter table public.consents enable row level security;
create policy "own consents: read" on public.consents for select to authenticated using (user_id = (select auth.uid()));
create policy "own consents: add" on public.consents for insert to authenticated with check (user_id = (select auth.uid()));

-- Latest decision of the signed-in user for one kind (false when never asked).
create function public.has_consent(k text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select c.granted from public.consents c
    where c.user_id = (select auth.uid()) and c.kind = k
    order by c.created_at desc, c.id desc limit 1), false);
$$;

-- 2. The user's own saved answers and settings (restored on the next sign-in).
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  prefs jsonb not null default '{}'::jsonb,
  location_id text check (location_id is null or length(location_id) <= 40),
  il text check (il is null or length(il) <= 60),
  ilce text check (ilce is null or length(ilce) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own profile: add" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own profile: change" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own profile: remove" on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

-- 3. District planting intent: one row per user and harvest year, only with district_stats consent.
create table public.planting_intents (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  harvest_year int not null check (harvest_year between 2020 and 2100),
  il text not null check (length(il) between 1 and 60),
  ilce text not null check (length(ilce) between 1 and 60),
  crop text not null check (crop in ('wheat', 'barley', 'chickpea', 'lentil', 'fallow', 'sugar_beet', 'potato', 'onion', 'other')),
  irrigation text check (irrigation in ('rainfed', 'limited', 'irrigated')),
  updated_at timestamptz not null default now(),
  primary key (user_id, harvest_year)
);
alter table public.planting_intents enable row level security;
create policy "own intents: read" on public.planting_intents for select to authenticated using (user_id = (select auth.uid()));
create policy "own intents: add with consent" on public.planting_intents for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_consent('district_stats'));
create policy "own intents: change with consent" on public.planting_intents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.has_consent('district_stats'));
create policy "own intents: remove" on public.planting_intents for delete to authenticated using (user_id = (select auth.uid()));

-- Withdrawing district_stats consent deletes the user's intents at once.
create function public.drop_intents_on_withdraw() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.kind = 'district_stats' and not new.granted then
    delete from public.planting_intents where user_id = new.user_id;
  end if;
  return new;
end;
$$;
create trigger consents_withdraw after insert on public.consents
  for each row execute function public.drop_intents_on_withdraw();

-- 4. Public district totals: only districts with at least 5 records; no user ids.
create function public.district_totals(year int)
returns table (il text, ilce text, crop text, fields bigint)
language sql stable security definer set search_path = '' as $$
  with d as (
    select p.il, p.ilce from public.planting_intents p
    where p.harvest_year = year group by p.il, p.ilce having count(*) >= 5)
  select p.il, p.ilce, p.crop, count(*)::bigint
  from public.planting_intents p join d on d.il = p.il and d.ilce = p.ilce
  where p.harvest_year = year
  group by p.il, p.ilce, p.crop
  order by p.il, p.ilce, count(*) desc;
$$;
revoke execute on function public.district_totals(int) from public;
grant execute on function public.district_totals(int) to anon, authenticated;

-- 5. "Hesabımı sil": deletes the signed-in user; every table above cascades.
create function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke execute on function public.has_consent(text) from public, anon;
grant execute on function public.has_consent(text) to authenticated;
revoke execute on function public.drop_intents_on_withdraw() from public, anon, authenticated;
