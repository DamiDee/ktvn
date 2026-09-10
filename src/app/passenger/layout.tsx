import type { ReactNode } from "react";
import { PassengerShell } from "@/features/passenger/passenger-shell";

export default function PassengerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PassengerShell>{children}</PassengerShell>;
}
