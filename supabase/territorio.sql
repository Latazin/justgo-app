-- =========================================================
-- JustGo — TERRITÓRIO POR CIRCUITO (rode uma vez no Supabase)
-- Supabase → SQL Editor → New query → cole tudo → Run
-- =========================================================
create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references profiles(id) on delete cascade,
  owner_name text,
  poly jsonb not null,                 -- contorno [[lat,lng], ...]
  area int not null check (area > 0),  -- m²
  lat double precision not null,       -- centro
  lng double precision not null,
  activity_id text,
  prev_owner uuid,
  prev_owner_name text,
  steals int not null default 0,
  captured_at timestamptz not null default now()
);
create index if not exists zones_lat_lng on zones (lat, lng);
create index if not exists zones_owner on zones (owner);

alter table zones enable row level security;
drop policy if exists "zonas visiveis" on zones;       create policy "zonas visiveis" on zones for select using (true);
drop policy if exists "criar zona propria" on zones;   create policy "criar zona propria" on zones for insert with check (auth.uid() = owner);
drop policy if exists "apagar zona propria" on zones;  create policy "apagar zona propria" on zones for delete using (auth.uid() = owner);

-- roubar a área de outra pessoa (só troca o dono; ninguém edita o contorno dos outros)
create or replace function steal_zone(zid uuid, uname text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update zones
     set prev_owner = owner, prev_owner_name = owner_name,
         owner = auth.uid(), owner_name = left(coalesce(uname, 'Atleta'), 60),
         steals = steals + 1, captured_at = now()
   where id = zid and owner <> auth.uid();
end $$;
grant execute on function steal_zone(uuid, text) to authenticated;
