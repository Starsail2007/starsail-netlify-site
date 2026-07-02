create extension if not exists pgcrypto;

create table if not exists maimai_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_key text not null,
  source text not null default 'diving_fish',
  nickname text,
  rating integer,
  b35_rating integer,
  b15_rating integer,
  payload jsonb not null,
  payload_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_maimai_snapshots_player_created
on maimai_snapshots (player_key, created_at desc);

create index if not exists idx_maimai_snapshots_payload_hash
on maimai_snapshots (payload_hash);

create table if not exists maimai_music_cache (
  id text primary key,
  title text not null,
  type text,
  ds jsonb,
  level jsonb,
  charts jsonb,
  basic_info jsonb,
  cover_url text,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists maimai_update_logs (
  id uuid primary key default gen_random_uuid(),
  player_key text not null,
  source text not null default 'diving_fish',
  status text not null,
  message text,
  rating_before integer,
  rating_after integer,
  changed_items integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_maimai_update_logs_player_created
on maimai_update_logs (player_key, created_at desc);

create table if not exists maimai_full_record_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_key text not null,
  source text not null default 'diving_fish',
  nickname text,
  username text,
  rating integer,
  record_count integer,
  payload jsonb not null,
  payload_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_maimai_full_record_snapshots_player_created
on maimai_full_record_snapshots (player_key, created_at desc);

create index if not exists idx_maimai_full_record_snapshots_payload_hash
on maimai_full_record_snapshots (payload_hash);

create table if not exists maimai_rating_trend_points (
  id uuid primary key default gen_random_uuid(),
  player_key text not null,
  source text not null,
  source_point_id text,
  point_date date not null,
  rating integer not null,
  standard_rating integer,
  dx_rating integer,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_key, source, point_date)
);

create index if not exists idx_maimai_rating_trend_points_player_date
on maimai_rating_trend_points (player_key, point_date desc);

grant usage on schema public to service_role;
grant all privileges on table maimai_snapshots to service_role;
grant all privileges on table maimai_music_cache to service_role;
grant all privileges on table maimai_update_logs to service_role;
grant all privileges on table maimai_full_record_snapshots to service_role;
grant all privileges on table maimai_rating_trend_points to service_role;
grant all privileges on all sequences in schema public to service_role;
