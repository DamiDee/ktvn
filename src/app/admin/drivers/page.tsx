import type { Metadata } from "next";
import { DriversList } from "@/features/admin/drivers-list";

export const metadata: Metadata = {
  title: "Drivers",
  description: "Everyone approved to carry members, on either track.",
};

export default function AdminDriversPage() {
  return <DriversList />;
}
