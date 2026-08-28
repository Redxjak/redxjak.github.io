import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { cors, dashboardOrigin, json } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const rateSalt = Deno.env.get("ANALYTICS_RATE_LIMIT_SALT") || "";
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const encoder = new TextEncoder();

async function rateLimited(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`${rateSalt}:login:${forwarded}`));
  const clientHash = Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  const { data } = await db.from("analytics_rate_limits").select("window_started_at,request_count").eq("client_hash", clientHash).maybeSingle();
  const started = data ? new Date(data.window_started_at) : now;
  const expired = now.getTime() - started.getTime() >= 60_000;
  const count = expired ? 1 : Number(data?.request_count || 0) + 1;
  await db.from("analytics_rate_limits").upsert({ client_hash: clientHash, window_started_at: expired ? now.toISOString() : started.toISOString(), request_count: count });
  return count > 10;
}

Deno.serve(async (request) => {
  const origin = dashboardOrigin(request);
  if (request.method === "OPTIONS") return cors(origin);
  if (origin === "null") return json({ error: "Not allowed" }, 403, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (!rateSalt) return json({ error: "Analytics is not configured" }, 503, origin);
  if (await rateLimited(request)) return json({ error: "Invalid username or password" }, 429, origin);
  let body: { username?: string; password?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid username or password" }, 400, origin); }
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username) || password.length < 8 || password.length > 200) return json({ error: "Invalid username or password" }, 401, origin);
  const { data: admin } = await db.from("analytics_admins").select("login_email").eq("username", username).maybeSingle();
  if (!admin) return json({ error: "Invalid username or password" }, 401, origin);
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: admin.login_email, password }),
  });
  if (!response.ok) return json({ error: "Invalid username or password" }, 401, origin);
  const session = await response.json();
  return json({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, username }, 200, origin);
});
