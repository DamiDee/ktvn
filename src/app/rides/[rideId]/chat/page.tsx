import type { Metadata } from "next";
import { PassengerChatScreen } from "@/features/paid-rides/chat/ride-chat-screens";

export const metadata: Metadata = { title: "Messages" };

export default async function RideChatPage({ params }: PageProps<"/rides/[rideId]/chat">) {
  const { rideId } = await params;
  return <PassengerChatScreen rideId={decodeURIComponent(rideId)} />;
}
