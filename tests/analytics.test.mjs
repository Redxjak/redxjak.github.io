import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every public app loads the shared analytics client", async () => {
  const pages = ["index.html", "FFA/index.html", "PWGen/index.html", "Legends-of-Veyrindel/en/index.html", "GrubClique/app/index.html"];
  for (const page of pages) {
    const source = await read(page);
    assert.match(source, /data-analytics-app=/, `${page} is missing its app id`);
    assert.match(source, /analytics-config\.js/, `${page} is missing analytics config`);
    assert.match(source, /analytics\.js/, `${page} is missing analytics client`);
  }
});

test("analytics is connected with browser-safe project configuration", async () => {
  const config = await read("assets/analytics-config.js");
  assert.match(config, /supabaseUrl:\s*"https:\/\/avjxhwuflqjhscscqdvw\.supabase\.co"/);
  assert.match(config, /publishableKey:\s*"sb_publishable_/);
  assert.doesNotMatch(config, /service_role|sb_secret_/i);
  const client = await read("assets/analytics.js");
  assert.match(client, /if \(!configured\(\)/);
  assert.match(client, /credentials: "omit"/);
});

test("client property allowlist excludes sensitive fields", async () => {
  const source = await read("assets/analytics.js");
  const allowlist = source.match(/const allowedPropertyKeys = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
  for (const forbidden of ["password", "email", "username", "message", "restaurant", "latitude", "longitude", "user_id", "phone", "query"]) {
    assert.equal(allowlist.includes(`"${forbidden}"`), false, `${forbidden} must not be allowlisted`);
  }
});

test("database revokes public access and enables RLS for all analytics tables", async () => {
  const sql = await read("supabase/migrations/20260828000000_private_cross_app_analytics.sql");
  for (const table of ["analytics_apps", "analytics_event_definitions", "analytics_events", "analytics_admins", "analytics_rate_limits"]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  assert.match(sql, /revoke all on public\.analytics_events from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|all).*analytics_events.*\b(anon|authenticated)\b/i);
});

test("ingestion validates batches, origins, definitions, and payload size", async () => {
  const source = await read("supabase/functions/collect/index.ts");
  for (const pattern of [/events\.length > 20/, /Origin not allowed/, /Property not allowed/, /Payload too large/, /Rate limit exceeded/]) assert.match(source, pattern);
});

test("dashboard data requires an authenticated administrator", async () => {
  const source = await read("supabase/functions/dashboard-data/index.ts");
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /analytics_admins/);
  assert.match(source, /Forbidden/);
});

test("owner login is rate limited and returns generic failures", async () => {
  const source = await read("supabase/functions/dashboard-login/index.ts");
  assert.match(source, /count > 10/);
  assert.match(source, /Invalid username or password/);
  assert.doesNotMatch(source, /Unknown username|User not found/);
});
