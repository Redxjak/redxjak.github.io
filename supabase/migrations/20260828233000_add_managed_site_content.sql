create table public.site_content (
  content_key text primary key check (content_key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  content jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 16384),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_content enable row level security;
revoke all on public.site_content from anon, authenticated;
grant all on public.site_content to service_role;

insert into public.site_content (content_key, content) values ('homepage', jsonb_build_object(
  'heroEyebrow', 'Independent developer & worldbuilder',
  'heroTitleLine1', 'Useful tools.',
  'heroTitleLine2', 'Unusual worlds.',
  'heroIntro', 'I build browser games, practical utilities, and experiments that turn ambitious ideas into things you can actually play with.',
  'communityTitle', 'See what gets built next.',
  'communityBody', 'Project news, early builds, feedback, and the occasional gloriously strange idea all live on Discord.',
  'announcementEnabled', false,
  'announcementText', '',
  'announcementUrl', ''
));

comment on table public.site_content is 'Owner-managed public website copy. Read and written only through validated Edge Functions.';
