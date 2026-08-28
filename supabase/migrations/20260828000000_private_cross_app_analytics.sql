create extension if not exists pgcrypto;

create table public.analytics_apps (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^[a-z][a-z0-9-]{1,39}$'),
  name text not null check (char_length(name) between 1 and 80),
  allowed_origins text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.analytics_event_definitions (
  app_id uuid not null references public.analytics_apps(id) on delete cascade,
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  allowed_property_keys text[] not null default '{}',
  primary key (app_id, event_name)
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  app_id uuid not null references public.analytics_apps(id) on delete restrict,
  event_name text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  session_id uuid not null,
  screen text check (char_length(screen) <= 160),
  app_version text check (char_length(app_version) <= 40),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object' and pg_column_size(properties) <= 2048),
  device_category text not null check (device_category in ('desktop', 'tablet', 'mobile', 'other')),
  referrer_domain text check (char_length(referrer_domain) <= 120),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  unique (app_id, event_id),
  foreign key (app_id, event_name) references public.analytics_event_definitions(app_id, event_name)
);

create index analytics_events_app_occurred_idx on public.analytics_events (app_id, occurred_at desc);
create index analytics_events_name_occurred_idx on public.analytics_events (event_name, occurred_at desc);
create index analytics_events_session_idx on public.analytics_events (session_id, occurred_at desc);

create table public.analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  login_email text not null unique,
  created_at timestamptz not null default now()
);

create table public.analytics_rate_limits (
  client_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public.analytics_apps enable row level security;
alter table public.analytics_event_definitions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_admins enable row level security;
alter table public.analytics_rate_limits enable row level security;

revoke all on public.analytics_apps from anon, authenticated;
revoke all on public.analytics_event_definitions from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.analytics_admins from anon, authenticated;
revoke all on public.analytics_rate_limits from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated;
grant all on public.analytics_apps, public.analytics_event_definitions, public.analytics_events, public.analytics_admins, public.analytics_rate_limits to service_role;
grant usage, select on sequence public.analytics_events_id_seq to service_role;

insert into public.analytics_apps (public_id, name, allowed_origins) values
  ('portfolio', 'Redxjak Portfolio', array['https://redxjak.com', 'https://www.redxjak.com', 'https://redxjak.github.io', 'http://localhost:8000']),
  ('grubclique', 'GrubClique', array['https://redxjak.com', 'https://www.redxjak.com', 'https://redxjak.github.io', 'http://localhost:8000']),
  ('ffa', 'Fun Family Adventures', array['https://redxjak.com', 'https://www.redxjak.com', 'https://redxjak.github.io', 'http://localhost:8000']),
  ('pwgen', 'Password Generator', array['https://redxjak.com', 'https://www.redxjak.com', 'https://redxjak.github.io', 'http://localhost:8000']),
  ('veyrindel', 'Legends of Veyrindel', array['https://redxjak.com', 'https://www.redxjak.com', 'https://redxjak.github.io', 'http://localhost:8000']);

with common(event_name, keys) as (values
  ('session_started', array[]::text[]),
  ('screen_viewed', array[]::text[]),
  ('outbound_link_clicked', array['destination', 'action']),
  ('app_error', array['error_type'])
)
insert into public.analytics_event_definitions (app_id, event_name, allowed_property_keys)
select app.id, common.event_name, common.keys from public.analytics_apps app cross join common;

insert into public.analytics_event_definitions (app_id, event_name, allowed_property_keys)
select id, event_name, keys from public.analytics_apps cross join lateral (values
  ('project_opened', array['target']::text[]),
  ('primary_action_clicked', array['action']::text[])
) custom(event_name, keys) where public_id = 'portfolio';

insert into public.analytics_event_definitions (app_id, event_name, allowed_property_keys)
select id, event_name, keys from public.analytics_apps cross join lateral (values
  ('authentication_completed', array['method', 'outcome']::text[]),
  ('clique_created', array[]::text[]), ('clique_joined', array[]::text[]),
  ('clique_started', array[]::text[]), ('clique_finished', array[]::text[]),
  ('swipe_recorded', array['liked']::text[]), ('match_found', array[]::text[]),
  ('feature_used', array['feature']::text[])
) custom(event_name, keys) where public_id = 'grubclique';

insert into public.analytics_event_definitions (app_id, event_name, allowed_property_keys)
select id, event_name, keys from public.analytics_apps cross join lateral (values
  ('character_selected', array['hero']::text[]), ('story_started', array['story']::text[]),
  ('choice_made', array['choice_index']::text[]), ('story_completed', array['story']::text[]),
  ('story_restarted', array[]::text[])
) custom(event_name, keys) where public_id = 'ffa';

insert into public.analytics_event_definitions (app_id, event_name, allowed_property_keys)
select id, event_name, keys from public.analytics_apps cross join lateral (values
  ('passwords_generated', array['count', 'category']::text[]),
  ('password_copied', array[]::text[]), ('records_downloaded', array['count']::text[])
) custom(event_name, keys) where public_id = 'pwgen';

insert into public.analytics_event_definitions (app_id, event_name, allowed_property_keys)
select id, event_name, keys from public.analytics_apps cross join lateral (values
  ('primary_action_clicked', array['action']::text[])
) custom(event_name, keys) where public_id = 'veyrindel';

comment on table public.analytics_events is 'Privacy-first analytics events. Raw IP addresses and full user agents must never be stored.';
comment on column public.analytics_admins.login_email is 'Private Supabase Auth identifier resolved by the dashboard-login Edge Function.';
