import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PAID_RIDES_ENABLED } from "@/features/paid-rides/config";
import { RideModuleShell } from "@/features/paid-rides/shell/ride-module-shell";
import "@/features/paid-rides/styles/paid-rides.css";

export const metadata: Metadata = {
  title: { default: "Paid Rides", template: "%s · Paid Rides" },
  description: "Book a verified driver, follow them live, and travel with safety tools one tap away.",
  // Scoped manifest: only /rides installs as an app, not the whole product.
  manifest: "/rides.webmanifest",
  appleWebApp: { capable: true, title: "K-Rides", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Lets the layout shrink with the keyboard instead of being covered by it.
  interactiveWidget: "resizes-content",
};

export default function PaidRidesLayout({ children }: { children: ReactNode }) {
  // The feature flag: off means the module does not exist.
  if (!PAID_RIDES_ENABLED) notFound();
  return <RideModuleShell>{children}</RideModuleShell>;
}
