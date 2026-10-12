import type { Metadata } from "next";
import { DriverRequestsPage } from "@/features/paid-rides/pages/module-pages";

export const metadata: Metadata = { title: "Requests" };

export default function DriverRequestsRoute() {
  return <DriverRequestsPage />;
}
