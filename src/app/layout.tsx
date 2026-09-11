import type { Metadata, Viewport } from "next";
import { ConnectivityBanner } from "@/components/ui/connectivity-banner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "K-Rides",
    template: "%s · K-Rides",
  },
  description:
    "A verified transportation network built for the Koinonia community. Find trusted volunteer or professional drivers, travel with live trip visibility, and stay connected from departure to destination.",
  applicationName: "K-Rides",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#111513" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // No manual <head>: the App Router builds it from the Metadata API, and
    // hand-writing one makes React trip over Next's injected runtime scripts.
    // The Inter fallback is imported at the top of globals.css instead.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-forest-800 focus:px-5 focus:py-2.5 focus:text-white"
        >
          Skip to content
        </a>
        <Providers>
          <ConnectivityBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
