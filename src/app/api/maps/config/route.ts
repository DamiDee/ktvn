/** Only the website-restricted public browser key is exposed, never a server key. */
export const dynamic = "force-dynamic";
export function GET() {
  const apiKey = (process.env.GOOGLE_MAPS_BROWSER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  return Response.json({ provider: "google", configured: Boolean(apiKey), apiKey: apiKey || undefined }, {
    status: apiKey ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
