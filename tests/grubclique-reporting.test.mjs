import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("private GrubClique dashboard loads aggregate reporting only", async () => {
  const page = await read("analytics/index.html");
  const client = await read("analytics/analytics.js");
  assert.match(page, /GrubClique analytics/i);
  assert.match(page, /Aggregate operational reporting only/i);
  assert.match(client, /get_reporting_analytics/);
  assert.doesNotMatch(client, /service_role|sb_secret_/i);
  for (const forbidden of ["message_body", "invite_code", "latitude", "longitude", "phone_hash", "contact_email"]) {
    assert.equal(client.includes(forbidden), false, `${forbidden} must not be displayed by the dashboard`);
  }
});

test("reporting RPC is owner-gated and returns only aggregate fields", async () => {
  const sql = await read("../source/GrubClique-v0.7.3/supabase/migrations/202608280001_reporting_analytics.sql");
  assert.match(sql, /private\.analytics_admins/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /Analytics access required/);
  assert.match(sql, /revoke all on function public\.get_reporting_analytics\(integer\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.get_reporting_analytics\(integer\) to authenticated/i);
  for (const forbidden of ["message_body", "invite_code", "latitude", "longitude", "phone_hash", "contact_email", "display_name", "username'"] ) {
    assert.equal(sql.includes(forbidden), false, `${forbidden} must not be returned by reporting analytics`);
  }
});
