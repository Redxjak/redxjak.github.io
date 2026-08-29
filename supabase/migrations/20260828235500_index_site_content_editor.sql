create index site_content_updated_by_idx on public.site_content (updated_by) where updated_by is not null;
