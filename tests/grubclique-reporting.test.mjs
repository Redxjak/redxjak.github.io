import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("GrubClique web app sends privacy-safe events to cross-project analytics", async () => {
  const page = await read("GrubClique/app/index.html");
  const client = await read("analytics/analytics.js");
  const sharedClient = await read("assets/analytics.js");
  const migration = await read("supabase/migrations/20260828000000_private_cross_app_analytics.sql");
  assert.match(page, /data-analytics-app="grubclique"/);
  assert.match(page, /analytics-config\.js/);
  assert.match(page, /analytics\.js/);
  assert.match(migration, /'grubclique', 'GrubClique'/);
  assert.match(migration, /clique_created/);
  assert.match(migration, /swipe_recorded/);
  assert.doesNotMatch(client, /service_role|sb_secret_/i);
  for (const forbidden of ["message_body", "invite_code", "latitude", "longitude", "phone_hash", "contact_email", "restaurant_name"]) {
    assert.equal(sharedClient.includes(`"${forbidden}"`), false, `${forbidden} must not be collected`);
  }
});

test("cross-project reporting is owner-gated and aggregate-only", async () => {
  const page = await read("analytics/index.html");
  const client = await read("analytics/analytics.js");
  const endpoint = await read("supabase/functions/dashboard-data/index.ts");
  assert.match(page, /Analytics for every project/i);
  assert.match(page, /All projects/i);
  assert.match(client, /dashboard-data/);
  assert.match(endpoint, /auth\.getUser\(token\)/);
  assert.match(endpoint, /analytics_admins/);
  assert.match(endpoint, /Forbidden/);
  for (const forbidden of ["message_body", "invite_code", "latitude", "longitude", "phone_hash", "contact_email", "display_name"]) {
    assert.equal(endpoint.includes(forbidden), false, `${forbidden} must not be returned by reporting analytics`);
  }
});
