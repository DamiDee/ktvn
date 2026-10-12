import type { Metadata } from "next";
import { PassengerChatScreen } from "@/features/paid-rides/chat/ride-chat-screens";

export const metadata: Metadata = { title: "Messages" };

export default function PassengerMessagesPage() {
  return <PassengerChatScreen />;
}
