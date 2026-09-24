import webpush from "web-push";
import type { PushSubscription } from "web-push";
import { subscriptionStore } from "@/server/push-store";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/** POST /api/push/subscribe — save a push subscription */
export async function POST(request: Request) {
  const sub = (await request.json()) as PushSubscription;
  if (!sub?.endpoint) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  subscriptionStore.add(sub);
  return Response.json({ ok: true }, { status: 201 });
}

/** DELETE /api/push/subscribe — remove a push subscription */
export async function DELETE(request: Request) {
  const { endpoint } = (await request.json()) as { endpoint: string };
  if (endpoint) subscriptionStore.remove(endpoint);
  return Response.json({ ok: true });
}
