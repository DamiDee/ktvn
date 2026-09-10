import type { Metadata } from "next";
import { DriverReceipts } from "@/features/driver/driver-receipts";

export const metadata: Metadata = {
  title: "Receipts",
  description: "Receipts issued for completed paid journeys.",
};

export default function DriverReceiptsPage() {
  return <DriverReceipts />;
}
