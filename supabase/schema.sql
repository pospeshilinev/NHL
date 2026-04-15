-- NHL Playoff Picks — schema + RLS + scoring views

create extension if not exists "uuid-ossp";

-- ============ USERS ============
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  role text not null default 'player' check (role in ('player','admin')),
  created_at timestamptz not null default now()
);

-- ============ SEASONS ============
create table public.seasons (
  id uuid primary key default uuid_generate_v4(),
  year int not null unique,              -- 2025, 2026...
  picks_deadline timestamptz not null,   -- после этого момента пики видны всем, форма закрыта
  is_active boolean not null default true
);

-- ============ SERIES (15 штук на сезон) ============
-- round: 1..4 (R1, R2, CF, SCF)
-- conference: 'E' | 'W' | null (null только для финала Кубка)
-- slot: номер серии в раунде (для R1 восток: 1..4, запад: 1..4; CF: 1; SCF: 1)
create table public.series (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  round int not null check (round between 1 and 4),
  conference text check (conference in ('E','W')),
  slot int not null,
  series_letter text,                    -- A..O из NHL API, стабильный ключ серии
  team_high text,                        -- abbrev лучшего посева, заполняется по сетке
  team_low text,
  starts_at timestamptz,
  actual_winner text,                    -- abbrev команды, когда серия сыграна
  actual_games int check (actual_games between 4 and 7),
  unique(season_id, round, conference, slot),
  unique(season_id, series_letter)
);

-- ============ PICKS ============
create table public.picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  winner text not null,
  games int not null check (games between 4 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, series_id)
);

-- ============ BONUS PICKS ============
-- 4 полуфиналиста (финалисты конференций) по 5, 2 финалиста Кубка по 7, чемпион 10
create table public.bonus_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  east_cf_team_a text not null,          -- 5
  east_cf_team_b text not null,          -- 5
  west_cf_team_a text not null,          -- 5
  west_cf_team_b text not null,          -- 5
  cup_finalist_east text not null,       -- 7
  cup_finalist_west text not null,       -- 7
  cup_winner text not null,              -- 10
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, season_id)
);

-- ============ ACTUAL BONUS RESULTS ============
create table public.bonus_results (
  season_id uuid primary key references public.seasons(id) on delete cascade,
  east_cf_teams text[],                  -- 2 команды
  west_cf_teams text[],                  -- 2 команды
  cup_finalists text[],                  -- 2 команды (E и W)
  cup_winner text
);

-- ============ SCORING VIEWS ============
create or replace view public.series_scores as
select
  p.user_id,
  p.series_id,
  s.season_id,
  case
    when s.actual_winner is null then null
    when p.winner = s.actual_winner and p.games = s.actual_games then 3
    when p.winner = s.actual_winner then 1
    else 0
  end as points
from public.picks p
join public.series s on s.id = p.series_id;

create or replace view public.bonus_scores as
select
  bp.user_id,
  bp.season_id,
  (case when bp.east_cf_team_a = any(br.east_cf_teams) then 5 else 0 end) +
  (case when bp.east_cf_team_b = any(br.east_cf_teams) then 5 else 0 end) +
  (case when bp.west_cf_team_a = any(br.west_cf_teams) then 5 else 0 end) +
  (case when bp.west_cf_team_b = any(br.west_cf_teams) then 5 else 0 end) +
  (case when bp.cup_finalist_east = any(br.cup_finalists) then 7 else 0 end) +
  (case when bp.cup_finalist_west = any(br.cup_finalists) then 7 else 0 end) +
  (case when bp.cup_winner = br.cup_winner then 10 else 0 end) as points
from public.bonus_picks bp
join public.bonus_results br on br.season_id = bp.season_id;

create or replace view public.leaderboard as
select
  u.id as user_id,
  u.display_name,
  s.id as season_id,
  coalesce((select sum(points) from public.series_scores ss where ss.user_id = u.id and ss.season_id = s.id), 0) +
  coalesce((select points from public.bonus_scores bs where bs.user_id = u.id and bs.season_id = s.id), 0) as total_points
from public.users u
cross join public.seasons s;

-- ============ RLS ============
alter table public.users enable row level security;
alter table public.seasons enable row level security;
alter table public.series enable row level security;
alter table public.picks enable row level security;
alter table public.bonus_picks enable row level security;
alter table public.bonus_results enable row level security;

-- users: читают все залогиненные, меняет только сам себя
create policy "users_read" on public.users for select to authenticated using (true);
create policy "users_self_update" on public.users for update to authenticated using (id = auth.uid());
create policy "users_self_insert" on public.users for insert to authenticated with check (id = auth.uid());

-- seasons/series/bonus_results: читают все, пишет только админ
create policy "seasons_read" on public.seasons for select to authenticated using (true);
create policy "seasons_admin_write" on public.seasons for all to authenticated
  using (exists(select 1 from public.users where id = auth.uid() and role='admin'))
  with check (exists(select 1 from public.users where id = auth.uid() and role='admin'));

create policy "series_read" on public.series for select to authenticated using (true);
create policy "series_admin_write" on public.series for all to authenticated
  using (exists(select 1 from public.users where id = auth.uid() and role='admin'))
  with check (exists(select 1 from public.users where id = auth.uid() and role='admin'));

create policy "bonus_results_read" on public.bonus_results for select to authenticated using (true);
create policy "bonus_results_admin_write" on public.bonus_results for all to authenticated
  using (exists(select 1 from public.users where id = auth.uid() and role='admin'))
  with check (exists(select 1 from public.users where id = auth.uid() and role='admin'));

-- picks: до дедлайна видишь только свои; после — все
create policy "picks_read" on public.picks for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from public.series s
    join public.seasons se on se.id = s.season_id
    where s.id = picks.series_id and now() > se.picks_deadline
  )
);
create policy "picks_write_before_deadline" on public.picks for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.series s
      join public.seasons se on se.id = s.season_id
      where s.id = picks.series_id and now() < se.picks_deadline
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.series s
      join public.seasons se on se.id = s.season_id
      where s.id = picks.series_id and now() < se.picks_deadline
    )
  );

-- bonus_picks: аналогично
create policy "bonus_picks_read" on public.bonus_picks for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.seasons where id = bonus_picks.season_id and now() > picks_deadline)
);
create policy "bonus_picks_write_before_deadline" on public.bonus_picks for all to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.seasons where id = bonus_picks.season_id and now() < picks_deadline)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.seasons where id = bonus_picks.season_id and now() < picks_deadline)
  );
