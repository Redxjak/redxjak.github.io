import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { cors, dashboardOrigin, json } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const limits: Record<string, number> = {
  heroEyebrow: 80, heroTitleLine1: 80, heroTitleLine2: 80, heroIntro: 320,
  communityTitle: 120, communityBody: 360, announcementText: 180, announcementUrl: 300,
};

function validate(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const content: Record<string, string | boolean> = {};
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof source[key] !== "string") return null;
    const value = source[key].trim();
    if (value.length > limit) return null;
    content[key] = value;
  }
  if (typeof source.announcementEnabled !== "boolean") return null;
  content.announcementEnabled = source.announcementEnabled;
  if (content.announcementEnabled && !content.announcementText) return null;
  const announcementUrl = String(content.announcementUrl || "");
  if (announcementUrl && !/^https:\/\/(redxjak\.com|www\.redxjak\.com|discord\.gg|github\.com)(\/|$)/i.test(announcementUrl)) return null;
  return content;
}

Deno.serve(async (request) => {
  const origin = dashboardOrigin(request);
  if (request.method === "OPTIONS") return cors(origin);
  if (origin === "null") return json({ error: "Not allowed" }, 403, origin);
  if (!["GET", "PUT"].includes(request.method)) return json({ error: "Method not allowed" }, 405, origin);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const { data: authData } = await db.auth.getUser(token);
  if (!authData.user) return json({ error: "Unauthorized" }, 401, origin);
  const { data: admin } = await db.from("analytics_admins").select("username").eq("user_id", authData.user.id).maybeSingle();
  if (!admin) return json({ error: "Forbidden" }, 403, origin);

  if (request.method === "GET") {
    const { data, error } = await db.from("site_content").select("content,updated_at").eq("content_key", "homepage").maybeSingle();
    return error || !data ? json({ error: "Could not load site content" }, 500, origin) : json({ ...data, username: admin.username }, 200, origin);
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Invalid content" }, 400, origin); }
  const content = validate(body);
  if (!content) return json({ error: "Invalid content" }, 400, origin);
  const updatedAt = new Date().toISOString();
  const { error } = await db.from("site_content").update({ content, updated_at: updatedAt, updated_by: authData.user.id }).eq("content_key", "homepage");
  return error ? json({ error: "Could not save content" }, 500, origin) : json({ content, updated_at: updatedAt }, 200, origin);
});
