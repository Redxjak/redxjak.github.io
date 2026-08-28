export const baseHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

export function json(body: unknown, status = 200, origin = "null") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...baseHeaders, "Access-Control-Allow-Origin": origin, Vary: "Origin", "Cache-Control": "no-store" },
  });
}

export function cors(origin: string) {
  return new Response(null, {
    status: 204,
    headers: { ...baseHeaders, "Access-Control-Allow-Origin": origin, Vary: "Origin" },
  });
}

export function dashboardOrigin(request: Request) {
  const origin = request.headers.get("origin") || "";
  return ["https://redxjak.com", "https://www.redxjak.com", "https://redxjak.github.io", "http://localhost:8000"].includes(origin) ? origin : "null";
}
