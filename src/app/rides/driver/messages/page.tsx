import type { Metadata } from "next";
import { DriverChatScreen } from "@/features/paid-rides/chat/ride-chat-screens";

export const metadata: Metadata = { title: "Messages" };

export default function DriverMessagesPage() {
  return <DriverChatScreen />;
}
