import type { ReactNode } from "react";
import { DriverShell } from "@/features/driver/driver-shell";

export default function DriverLayout({ children }: { children: ReactNode }) {
  return <DriverShell>{children}</DriverShell>;
}
