import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { baseHeaders, cors, json } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rateSalt = Deno.env.get("ANALYTICS_RATE_LIMIT_SALT") || "";
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const encoder = new TextEncoder();

type IncomingEvent = {
  event_id?: string; app_id?: string; event_name?: string; occurred_at?: string;
  session_id?: string; screen?: string; app_version?: string; properties?: Record<string, unknown>;
};

function originFor(request: Request) { return request.headers.get("origin") || ""; }
function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").trim().slice(0, max) : null;
}
function deviceCategory(userAgent: string) {
  if (/ipad|tablet|kindle/i.test(userAgent)) return "tablet";
  if (/mobi|android|iphone/i.test(userAgent)) return "mobile";
  if (userAgent) return "desktop";
  return "other";
}
async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(`${rateSalt}:${value}`));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function rateLimited(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const clientHash = await digest(forwarded);
  const now = new Date();
  const { data } = await db.from("analytics_rate_limits").select("window_started_at,request_count").eq("client_hash", clientHash).maybeSingle();
  const started = data ? new Date(data.window_started_at) : now;
  const expired = now.getTime() - started.getTime() >= 60_000;
  const count = expired ? 1 : Number(data?.request_count || 0) + 1;
  await db.from("analytics_rate_limits").upsert({ client_hash: clientHash, window_started_at: expired ? now.toISOString() : started.toISOString(), request_count: count });
  return count > 60;
}

Deno.serve(async (request) => {
  const origin = originFor(request);
  if (request.method === "OPTIONS") return cors(origin);
  if (!rateSalt) return json({ error: "Analytics is not configured" }, 503, origin);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (Number(request.headers.get("content-length") || 0) > 50_000) return json({ error: "Payload too large" }, 413, origin);
  if (await rateLimited(request)) return json({ error: "Rate limit exceeded" }, 429, origin);

  let body: { events?: IncomingEvent[] };
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, origin); }
  const events = Array.isArray(body.events) ? body.events : [];
  if (!events.length || events.length > 20) return json({ error: "Send 1 to 20 events" }, 400, origin);
  const publicIds = [...new Set(events.map((event) => safeText(event.app_id, 40)).filter(Boolean))];
  if (publicIds.length !== 1) return json({ error: "A batch must contain one app" }, 400, origin);

  const { data: app } = await db.from("analytics_apps").select("id,public_id,allowed_origins,active").eq("public_id", publicIds[0]).maybeSingle();
  if (!app?.active) return json({ error: "Unknown app" }, 404, origin);
  if (origin && !app.allowed_origins.includes(origin)) return json({ error: "Origin not allowed" }, 403, "null");
  const names = [...new Set(events.map((event) => safeText(event.event_name, 64)).filter(Boolean))];
  const { data: definitions } = await db.from("analytics_event_definitions").select("event_name,allowed_property_keys").eq("app_id", app.id).in("event_name", names);
  const definitionMap = new Map((definitions || []).map((item) => [item.event_name, new Set(item.allowed_property_keys)]));
  if (definitionMap.size !== names.length) return json({ error: "Unknown event" }, 400, origin);

  let referrerDomain: string | null = null;
  try { referrerDomain = new URL(request.headers.get("referer") || "").hostname.slice(0, 120) || null; } catch { /* omit */ }
  const country = (request.headers.get("cf-ipcountry") || "").toUpperCase();
  const receivedAt = Date.now();
  const rows = [];
  for (const event of events) {
    const eventName = safeText(event.event_name, 64)!;
    const allowed = definitionMap.get(eventName)!;
    const properties: Record<string, string | number | boolean> = {};
    if (event.properties && typeof event.properties === "object" && !Array.isArray(event.properties)) {
      for (const [key, value] of Object.entries(event.properties)) {
        if (!allowed.has(key)) return json({ error: `Property not allowed: ${key}` }, 400, origin);
        if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) properties[key] = value;
        else if (typeof value === "string" && value.length <= 60) properties[key] = safeText(value, 60)!;
        else return json({ error: `Invalid property: ${key}` }, 400, origin);
      }
    }
    const occurred = new Date(String(event.occurred_at));
    if (!Number.isFinite(occurred.getTime()) || Math.abs(receivedAt - occurred.getTime()) > 86_400_000) return json({ error: "Invalid event time" }, 400, origin);
    if (!/^[0-9a-f-]{36}$/i.test(String(event.event_id)) || !/^[0-9a-f-]{36}$/i.test(String(event.session_id))) return json({ error: "Invalid identifier" }, 400, origin);
    rows.push({
      event_id: event.event_id, app_id: app.id, event_name: eventName, occurred_at: occurred.toISOString(),
      session_id: event.session_id, screen: safeText(event.screen, 160), app_version: safeText(event.app_version, 40),
      properties, device_category: deviceCategory(request.headers.get("user-agent") || ""),
      referrer_domain: referrerDomain, country_code: /^[A-Z]{2}$/.test(country) ? country : null,
    });
  }
  const { error } = await db.from("analytics_events").upsert(rows, { onConflict: "app_id,event_id", ignoreDuplicates: true });
  if (error) { console.error(error.message); return json({ error: "Could not store events" }, 500, origin); }
  return new Response(null, { status: 204, headers: { ...baseHeaders, "Access-Control-Allow-Origin": origin, Vary: "Origin" } });
});
