import type { Metadata } from "next";
import { TrackSwitchPage } from "@/features/driver/track-switch-page";

export const metadata: Metadata = {
  title: "Driver track",
  description: "Your current track, and how to request a switch.",
};

export default function DriverTrackPage() {
  return <TrackSwitchPage />;
}
