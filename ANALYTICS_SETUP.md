# Redxjak Private Analytics

The repository contains a privacy-first analytics client, private dashboard, database migrations, and three Supabase Edge Functions. The production backend is the separate `redxjak-analytics` project (`avjxhwuflqjhscscqdvw`) in US East (Ohio). Public registration is disabled and the sole dashboard username is `redxjak`.

## Reproduce or redeploy the Supabase project

1. Create a new Supabase project named `redxjak-analytics`. Disable public user registration in Authentication settings.
2. Install and authenticate the current Supabase CLI, then link this repository to that new project. Check commands with `supabase --help` before running them because the CLI changes frequently.
3. Apply `supabase/migrations/20260828000000_private_cross_app_analytics.sql` to the new project.
4. Generate a high-entropy rate-limit salt and save it as the Edge Function secret `ANALYTICS_RATE_LIMIT_SALT`. Never place it in this repository.
5. Deploy `collect`, `dashboard-login`, `dashboard-data`, `site-content`, and `admin-site` using `supabase/config.toml`.
6. Run the database security and performance advisors and resolve any findings before enabling collection.

## Recreate the owner login

1. In the new project's Authentication dashboard, create one confirmed email/password user. Use a private login email and a strong generated password.
2. Copy that user's UUID and run the following in the new project's SQL editor, substituting the UUID and email:

```sql
insert into public.analytics_admins (user_id, username, login_email)
values ('OWNER_AUTH_UUID', 'redxjak', 'PRIVATE_LOGIN_EMAIL');
```

The public dashboard asks only for `redxjak` and the password. The private email mapping is resolved by the login function and is never shipped to the browser.

## Connect the website

The production project URL and browser-safe publishable key are stored in `assets/analytics-config.js`. Never put a secret or service-role key there. Deploy the website, open `/admin/`, and verify login, homepage editing, and analytics before testing collection. The legacy `/analytics/` dashboard can remain available, but `/admin/` is the primary owner workspace.

## Event contract for other apps

Send one to twenty events per request to `POST https://PROJECT_REF.supabase.co/functions/v1/collect` with the project's publishable key in the `apikey` header:

```json
{
  "events": [{
    "event_id": "client-generated-uuid",
    "app_id": "registered-public-app-id",
    "event_name": "registered_event_name",
    "occurred_at": "2026-08-28T12:00:00.000Z",
    "session_id": "app-specific-session-uuid",
    "screen": "/safe-screen-name",
    "app_version": "1.0.0",
    "properties": { "approved_key": "non-sensitive-value" }
  }]
}
```

External apps must be added to `analytics_apps` and `analytics_event_definitions` through a new migration before sending events. Rotate their session UUID after 30 minutes of inactivity. Do not reuse a session UUID between apps, and never include account IDs, user text, location, credentials, generated content, URLs with query strings, or other personal data.

## Production verification

- Confirm each app produces `session_started` and `screen_viewed` without console or network errors affecting the app.
- Send malformed, unknown, oversized, duplicate, disallowed-origin, and rate-limited requests and confirm they are rejected or deduplicated.
- Confirm `anon` and ordinary `authenticated` database roles cannot select or insert analytics rows.
- Confirm the owner can load dashboard filters and an ordinary Auth user receives `403` from `dashboard-data`.
- Inspect stored events to confirm raw IP addresses, complete user agents, query values, and app content are absent.
