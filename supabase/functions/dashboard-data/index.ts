import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { cors, dashboardOrigin, json } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

Deno.serve(async (request) => {
  const origin = dashboardOrigin(request);
  if (request.method === "OPTIONS") return cors(origin);
  if (origin === "null") return json({ error: "Not allowed" }, 403, origin);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, origin);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const { data: authData } = await db.auth.getUser(token);
  if (!authData.user) return json({ error: "Unauthorized" }, 401, origin);
  const { data: admin } = await db.from("analytics_admins").select("username").eq("user_id", authData.user.id).maybeSingle();
  if (!admin) return json({ error: "Forbidden" }, 403, origin);

  const requestUrl = new URL(request.url);
  const days = Math.min(3650, Math.max(1, Number(requestUrl.searchParams.get("days") || 30)));
  const selectedApp = (requestUrl.searchParams.get("app") || "all").slice(0, 40);
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: apps, error: appsError } = await db.from("analytics_apps").select("id,public_id,name").eq("active", true).order("name");
  if (appsError) return json({ error: "Could not load analytics" }, 500, origin);
  const app = selectedApp === "all" ? null : apps?.find((item) => item.public_id === selectedApp);
  if (selectedApp !== "all" && !app) return json({ error: "Unknown app" }, 400, origin);
  const events = [];
  const pageSize = 1000;
  const maximumRows = 100_000;
  for (let from = 0; from < maximumRows; from += pageSize) {
    let query = db.from("analytics_events").select("event_name,occurred_at,session_id,screen,device_category,referrer_domain,country_code,properties,app_id").gte("occurred_at", start).order("occurred_at", { ascending: true }).range(from, from + pageSize - 1);
    if (app) query = query.eq("app_id", app.id);
    const { data: page, error } = await query;
    if (error) return json({ error: "Could not load analytics" }, 500, origin);
    events.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }

  const nameById = new Map((apps || []).map((item) => [item.id, item.public_id]));
  const countBy = (values: (string | null | undefined)[]) => Object.entries(values.reduce<Record<string, number>>((result, value) => {
    const key = value || "Unknown"; result[key] = (result[key] || 0) + 1; return result;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label, value }));
  const sessions = new Set(events.map((event) => event.session_id));
  const visits = events.filter((event) => event.event_name === "screen_viewed").length;
  const errors = events.filter((event) => event.event_name === "app_error");
  const dailyMap = new Map<string, { date: string; events: number; sessions: Set<string> }>();
  for (const event of events) {
    const date = event.occurred_at.slice(0, 10);
    const row = dailyMap.get(date) || { date, events: 0, sessions: new Set<string>() };
    row.events += 1; row.sessions.add(event.session_id); dailyMap.set(date, row);
  }
  return json({
    username: admin.username, apps: (apps || []).map(({ public_id, name }) => ({ id: public_id, name })),
    totals: { visits, sessions: sessions.size, events: events.length, errors: errors.length }, truncated: events.length === maximumRows,
    daily: [...dailyMap.values()].map((row) => ({ date: row.date, events: row.events, sessions: row.sessions.size })),
    topEvents: countBy(events.map((event) => event.event_name)),
    topScreens: countBy(events.map((event) => event.screen)),
    referrers: countBy(events.map((event) => event.referrer_domain)),
    devices: countBy(events.map((event) => event.device_category)),
    countries: countBy(events.map((event) => event.country_code)),
    appTotals: countBy(events.map((event) => nameById.get(event.app_id))),
    recentErrors: errors.slice(-20).reverse().map((event) => ({ occurred_at: event.occurred_at, app: nameById.get(event.app_id), screen: event.screen, error_type: event.properties?.error_type || "Error" })),
  }, 200, origin);
});
