"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { trackRideEvent } from "../analytics";
import { PAID_RIDES_FEATURES } from "../config";
import { firstName } from "../domain/format";
import { chatAvailable, isTerminal } from "../domain/ride-status";
import type { Ride, RideMessage } from "../domain/types";
import { getRealtimeClient } from "../realtime";
import { getRideService } from "../services";
import { useDriverStore } from "../state/driver-store";
import { usePassengerStore } from "../state/passenger-store";
import { useHideRideNav } from "../shell/ride-module-shell";
import { ChatView } from "./chat-view";

/** Canned replies are content, not features: plain text the rider can send. */
const PASSENGER_REPLIES = ["I'm at the pickup point.", "I'm wearing a blue shirt.", "I'll be there in 2 minutes.", "Please wait a moment."];
const DRIVER_REPLIES = ["I've arrived.", "I'm stuck in traffic, a few minutes away.", "I'm at the main entrance.", "Okay, no problem."];

function useChatLoader(ride: Ride | null, dispatch: (msg: { type: "MESSAGES_LOADED"; rideId: string; messages: RideMessage[] }) => void) {
  const [loading, setLoading] = useState(Boolean(ride));
  const rideId = ride?.id;

  useEffect(() => {
    if (!rideId) return;
    trackRideEvent("chat_opened");
    const controller = new AbortController();
    getRideService()
      .getMessages(rideId, controller.signal)
      .then((messages) => dispatch({ type: "MESSAGES_LOADED", rideId, messages }))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [rideId, dispatch]);

  return loading;
}

function useMarkRead(ride: Ride | null, messages: RideMessage[], onViewedLocal: () => void) {
  const lastIncoming = [...messages].reverse().find((message) => message.from === "them");
  return useCallback(() => {
    onViewedLocal();
    if (ride && lastIncoming && lastIncoming.status !== "read") void getRideService().markRead(ride.id, lastIncoming.id).catch(() => undefined);
  }, [ride, lastIncoming, onViewedLocal]);
}

function unavailableReason(ride: Ride): string | undefined {
  if (isTerminal(ride.status)) return "This ride has ended, so chat is closed. Contact support from Safety if you need help.";
  if (!chatAvailable(ride.status)) return "Chat opens once a driver is assigned.";
  return undefined;
}

/** Shown on the chat routes while chat is switched off (backend v1). */
function ChatOff({ backHref }: { backHref: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--kx-bg)] px-6 pb-24">
      <EmptyState
        icon={MessageCircle}
        title="Messaging isn't available yet"
        description="In-app chat is coming soon. Use the call button on your ride if one is shown."
        action={<ButtonLink href={backHref}>Back to ride</ButtonLink>}
      />
    </div>
  );
}

export function PassengerChatScreen({ rideId }: { rideId?: string }) {
  return PAID_RIDES_FEATURES.chat ? <PassengerChat rideId={rideId} /> : <ChatOff backHref="/rides" />;
}

export function DriverChatScreen() {
  return PAID_RIDES_FEATURES.chat ? <DriverChat /> : <ChatOff backHref="/rides/driver" />;
}

function PassengerChat({ rideId }: { rideId?: string }) {
  useHideRideNav(true);
  const ride = usePassengerStore((store) => store.session.ride);
  const session = usePassengerStore((store) => store.session);
  const dispatch = usePassengerStore((store) => store.dispatch);
  const sendMessage = usePassengerStore((store) => store.sendMessage);
  const retryMessage = usePassengerStore((store) => store.retryMessage);
  const current = ride && (!rideId || ride.id === rideId) ? ride : null;
  const loading = useChatLoader(current, dispatch);
  const onViewed = useMarkRead(current, session.messages, useCallback(() => dispatch({ type: "CHAT_VIEWED" }), [dispatch]));

  if (session.bootstrap !== "ready" && !current) return <div className="absolute inset-0 bg-[var(--kx-bg)]" aria-busy />;
  if (!current || !current.driver) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--kx-bg)] px-6 pb-24">
        <EmptyState
          icon={MessageCircle}
          title="No conversation right now"
          description="Once a driver accepts your ride, you can message them here to find each other."
          action={<ButtonLink href="/rides">Back to ride</ButtonLink>}
        />
      </div>
    );
  }

  const driver = current.driver;
  return (
    <ChatView
      title={firstName(driver.displayName)}
      subtitle={`${driver.vehicle.color} ${driver.vehicle.model} · ${driver.vehicle.plate}`}
      avatarUrl={driver.avatarUrl}
      backHref="/rides"
      callHref={driver.contact.call !== "none" ? driver.contact.callHref : undefined}
      messages={session.messages}
      typing={session.typing}
      available={driver.contact.chat && chatAvailable(current.status)}
      unavailableReason={unavailableReason(current)}
      quickReplies={PASSENGER_REPLIES}
      emptyHint="Send your driver a message if you need help finding each other."
      loading={loading && session.messages.length === 0}
      onSend={(body) => void sendMessage(body)}
      onRetry={(message) => void retryMessage(message)}
      onViewed={onViewed}
      onTyping={(typing) => getRealtimeClient().sendTyping(current.id, typing)}
    />
  );
}

function DriverChat() {
  useHideRideNav(true);
  const ride = useDriverStore((store) => store.state.ride.ride);
  const session = useDriverStore((store) => store.state.ride);
  const rideDispatch = useDriverStore((store) => store.rideDispatch);
  const sendMessage = useDriverStore((store) => store.sendMessage);
  const retryMessage = useDriverStore((store) => store.retryMessage);
  const loading = useChatLoader(ride, rideDispatch);
  const onViewed = useMarkRead(ride, session.messages, useCallback(() => rideDispatch({ type: "CHAT_VIEWED" }), [rideDispatch]));

  if (session.bootstrap !== "ready" && !ride) return <div className="absolute inset-0 bg-[var(--kx-bg)]" aria-busy />;
  if (!ride?.passenger) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--kx-bg)] px-6 pb-24">
        <EmptyState
          icon={MessageCircle}
          title="No active trip"
          description="Messages with your rider appear here once you accept a request."
          action={<ButtonLink href="/rides/driver">Back to driving</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <ChatView
      title={firstName(ride.passenger.displayName)}
      subtitle={`Pickup · ${ride.pickup.name}`}
      avatarUrl={ride.passenger.avatarUrl}
      backHref="/rides/driver"
      callHref={ride.passenger.contact.call !== "none" ? ride.passenger.contact.callHref : undefined}
      messages={session.messages}
      typing={session.typing}
      available={ride.passenger.contact.chat && chatAvailable(ride.status)}
      unavailableReason={unavailableReason(ride)}
      quickReplies={DRIVER_REPLIES}
      emptyHint="Message your rider if you can't find each other. Never message while driving."
      loading={loading && session.messages.length === 0}
      onSend={(body) => void sendMessage(body)}
      onRetry={(message) => void retryMessage(message)}
      onViewed={onViewed}
      onTyping={(typing) => getRealtimeClient().sendTyping(ride.id, typing)}
    />
  );
}
