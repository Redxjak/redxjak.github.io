create index analytics_events_app_event_name_idx
  on public.analytics_events (app_id, event_name);
