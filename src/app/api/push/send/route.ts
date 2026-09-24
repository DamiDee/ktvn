import webpush from "web-push";
import { subscriptionStore } from "@/server/push-store";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  /** Relative URL to open when the user taps the notification */
  url?: string;
  /** Notification tag — same tag collapses duplicate notifications */
  tag?: string;
}

/** POST /api/push/send — broadcast a push notification to all subscribers */
export async function POST(request: Request) {
  if (!publicKey || !privateKey) {
    return Response.json({ error: "VAPID keys not configured" }, { status: 503 });
  }
  const payload = (await request.json()) as PushPayload;
  const subs = subscriptionStore.all();
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
        // Remove stale subscriptions (410 Gone or 404 Not Found)
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          subscriptionStore.remove(sub.endpoint);
        }
        throw err;
      }),
    ),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return Response.json({ sent, failed, total: subs.length });
}
