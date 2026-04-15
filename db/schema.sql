-- NHL Playoff Picks — Postgres schema (credentials auth, без email).

create extension if not exists "uuid-ossp";

create table if not exists users (
  id serial primary key,
  username text not null unique,
  password_hash text not null,
  display_name text,
  role text not null default 'player' check (role in ('player','admin')),
  created_at timestamptz not null default now()
);

create table if not exists seasons (
  id uuid primary key default uuid_generate_v4(),
  year int not null unique,
  picks_deadline timestamptz not null,
  is_active boolean not null default true
);

create table if not exists series (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid not null references seasons(id) on delete cascade,
  round int not null check (round between 1 and 4),
  conference text check (conference in ('E','W')),
  slot int not null,
  series_letter text,
  team_high text,
  team_low text,
  starts_at timestamptz,
  actual_winner text,
  actual_games int check (actual_games between 4 and 7),
  unique(season_id, series_letter)
);

create table if not exists picks (
  id uuid primary key default uuid_generate_v4(),
  user_id integer not null references users(id) on delete cascade,
  series_id uuid not null references series(id) on delete cascade,
  winner text not null,
  games int not null check (games between 4 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, series_id)
);

create table if not exists bonus_picks (
  id uuid primary key default uuid_generate_v4(),
  user_id integer not null references users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  east_cf_team_a text not null,
  east_cf_team_b text not null,
  west_cf_team_a text not null,
  west_cf_team_b text not null,
  cup_finalist_east text not null,
  cup_finalist_west text not null,
  cup_winner text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, season_id)
);

create table if not exists bonus_results (
  season_id uuid primary key references seasons(id) on delete cascade,
  east_cf_teams text[],
  west_cf_teams text[],
  cup_finalists text[],
  cup_winner text
);

create or replace view series_scores as
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
from picks p
join series s on s.id = p.series_id;

create or replace view bonus_scores as
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
from bonus_picks bp
join bonus_results br on br.season_id = bp.season_id;

create or replace view leaderboard as
select
  u.id as user_id,
  coalesce(u.display_name, u.username) as display_name,
  s.id as season_id,
  coalesce((select sum(points) from series_scores ss where ss.user_id = u.id and ss.season_id = s.id), 0) +
  coalesce((select points from bonus_scores bs where bs.user_id = u.id and bs.season_id = s.id), 0) as total_points
from users u
cross join seasons s;
