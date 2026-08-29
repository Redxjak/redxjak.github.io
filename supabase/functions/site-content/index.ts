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
  const { data, error } = await db.from("site_content").select("content,updated_at").eq("content_key", "homepage").maybeSingle();
  if (error || !data) return json({ error: "Could not load site content" }, 500, origin);
  const response = json(data, 200, origin);
  response.headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  return response;
});
