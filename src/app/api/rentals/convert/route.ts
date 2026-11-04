import { convertNaira } from "@/features/rentals/currencies";
export async function GET(request: Request) {
  const amount = Number(new URL(request.url).searchParams.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return Response.json({ message: "Invalid amount" }, { status: 400 });
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/NGN", { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Rates unavailable");
    return Response.json(convertNaira(amount, await response.json()), { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch { return Response.json({ message: "Currency equivalents are temporarily unavailable. The naira price still applies." }, { status: 503 }); }
}
