-- =========================================================
-- JustGo — banco de dados (Supabase / Postgres)
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (usa "if not exists").
-- =========================================================

-- ---------- Perfis públicos ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  name text not null default 'Atleta',
  city text,
  level int default 1,
  xp int default 0,
  total_km numeric default 0,
  medals int default 0,
  league text default 'bronze',
  frame text,
  avatar text,
  updated_at timestamptz default now()
);

-- ---------- Backup completo do app (sincronização entre aparelhos) ----------
create table if not exists user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- ---------- Atividades públicas (rota já vem com a zona de privacidade aplicada) ----------
create table if not exists activities (
  id text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  sport text not null check (sport in ('run','ride','swim')),
  start timestamptz not null,
  distance int not null,
  duration int not null,
  elapsed int,
  title text,
  route jsonb default '[]',
  stats jsonb default '{}',
  xp int default 0,
  flagged boolean default false,
  created_at timestamptz default now()
);
create index if not exists activities_user_start on activities(user_id, start desc);
create index if not exists activities_start on activities(start desc);

create table if not exists follows (
  follower uuid references profiles(id) on delete cascade,
  following uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower, following)
);

create table if not exists likes (
  activity_id text references activities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (activity_id, user_id)
);

create table if not exists comments (
  id bigint generated always as identity primary key,
  activity_id text references activities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  text text not null check (char_length(text) <= 500),
  created_at timestamptz default now()
);

-- ---------- Clubes ----------
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  goal_km int default 500,
  invite_code text unique not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists club_members (
  club_id uuid references clubs(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  primary key (club_id, user_id)
);

-- ---------- Desafios entre amigos ----------
create table if not exists challenges (
  id bigint generated always as identity primary key,
  from_user uuid references profiles(id) on delete cascade,
  to_user uuid references profiles(id) on delete cascade,
  sport text,
  days int default 7,
  status text default 'pending' check (status in ('pending','active','declined')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- Território: passagens por hexágono ----------
create table if not exists territory_passes (
  hex text not null,
  user_id uuid references profiles(id) on delete cascade,
  name text,
  count int default 0,
  last_at timestamptz default now(),
  primary key (hex, user_id)
);
-- dono = quem passou mais vezes (empate: quem passou por último)
create or replace view territory_owners as
  select distinct on (hex) hex, user_id as owner, name as owner_name, count, last_at
  from territory_passes order by hex, count desc, last_at desc;

-- ---------- Localização ao vivo ----------
create table if not exists live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text,
  sport text,
  points jsonb default '[]',
  distance int default 0,
  moving int default 0,
  active boolean default true,
  updated_at timestamptz default now()
);

-- =========================================================
-- Funções
-- =========================================================

-- Ranking: soma km (metric = 'km') ou XP (metric = 'xp') desde uma data
create or replace function leaderboard(
  since timestamptz, sp text default null, only_city text default null,
  only_ids uuid[] default null, metric text default 'km'
) returns table (user_id uuid, name text, username text, city text, frame text, avatar text, value numeric, n bigint)
language sql stable security definer set search_path = public as $$
  select a.user_id, p.name, p.username, p.city, p.frame, p.avatar,
         case when metric = 'xp' then sum(a.xp)::numeric else round(sum(a.distance) / 1000.0, 1) end as value,
         count(*) as n
  from activities a join profiles p on p.id = a.user_id
  where a.start >= since and not a.flagged
    and (sp is null or a.sport = sp)
    and (only_city is null or p.city ilike only_city)
    and (only_ids is null or a.user_id = any(only_ids))
  group by a.user_id, p.name, p.username, p.city, p.frame, p.avatar
  order by value desc
  limit 100;
$$;

-- Soma uma passagem em cada hexágono do treino
create or replace function add_passes(hexes text[], uname text)
returns void language sql security definer set search_path = public as $$
  insert into territory_passes (hex, user_id, name, count, last_at)
  select h, auth.uid(), uname, 1, now() from unnest(hexes) h
  on conflict (hex, user_id) do update set count = territory_passes.count + 1, last_at = now(), name = excluded.name;
$$;

-- Entrar em clube pelo código de convite
create or replace function join_club(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from clubs where invite_code = code;
  if cid is null then return null; end if;
  insert into club_members (club_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

-- =========================================================
-- Segurança (Row Level Security)
-- Leitura pública para o social; escrita só do próprio dono.
-- =========================================================
alter table profiles enable row level security;
alter table user_state enable row level security;
alter table activities enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table clubs enable row level security;
alter table club_members enable row level security;
alter table challenges enable row level security;
alter table territory_passes enable row level security;
alter table live_sessions enable row level security;

do $$ begin
  -- perfis
  drop policy if exists "perfis visiveis" on profiles;          create policy "perfis visiveis" on profiles for select using (true);
  drop policy if exists "perfil proprio" on profiles;           create policy "perfil proprio" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
  -- backup
  drop policy if exists "backup proprio" on user_state;         create policy "backup proprio" on user_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- atividades
  drop policy if exists "atividades visiveis" on activities;    create policy "atividades visiveis" on activities for select using (true);
  drop policy if exists "atividade propria" on activities;      create policy "atividade propria" on activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- seguir
  drop policy if exists "follows visiveis" on follows;          create policy "follows visiveis" on follows for select using (true);
  drop policy if exists "follow proprio" on follows;            create policy "follow proprio" on follows for all using (auth.uid() = follower) with check (auth.uid() = follower);
  -- curtidas e comentários
  drop policy if exists "likes visiveis" on likes;              create policy "likes visiveis" on likes for select using (true);
  drop policy if exists "like proprio" on likes;                create policy "like proprio" on likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  drop policy if exists "comentarios visiveis" on comments;     create policy "comentarios visiveis" on comments for select using (true);
  drop policy if exists "comentario proprio" on comments;       create policy "comentario proprio" on comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- clubes
  drop policy if exists "clubes visiveis" on clubs;             create policy "clubes visiveis" on clubs for select using (auth.role() = 'authenticated');
  drop policy if exists "criar clube" on clubs;                 create policy "criar clube" on clubs for insert with check (auth.uid() = created_by);
  drop policy if exists "editar clube" on clubs;                create policy "editar clube" on clubs for update using (auth.uid() = created_by);
  drop policy if exists "membros visiveis" on club_members;     create policy "membros visiveis" on club_members for select using (auth.role() = 'authenticated');
  drop policy if exists "membro proprio" on club_members;       create policy "membro proprio" on club_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  -- desafios
  drop policy if exists "desafios dos envolvidos" on challenges; create policy "desafios dos envolvidos" on challenges for select using (auth.uid() in (from_user, to_user));
  drop policy if exists "criar desafio" on challenges;          create policy "criar desafio" on challenges for insert with check (auth.uid() = from_user);
  drop policy if exists "responder desafio" on challenges;      create policy "responder desafio" on challenges for update using (auth.uid() in (from_user, to_user));
  -- território
  drop policy if exists "territorio visivel" on territory_passes; create policy "territorio visivel" on territory_passes for select using (true);
  -- ao vivo: qualquer um com o link (id aleatório) acompanha
  drop policy if exists "ao vivo visivel" on live_sessions;     create policy "ao vivo visivel" on live_sessions for select using (true);
  drop policy if exists "ao vivo proprio" on live_sessions;     create policy "ao vivo proprio" on live_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
end $$;
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
