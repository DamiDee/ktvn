import type { Metadata } from "next";
import { AccountPage } from "@/features/paid-rides/pages/module-pages";

export const metadata: Metadata = { title: "Account" };

export default function PassengerAccountPage() {
  return <AccountPage role="passenger" />;
}
