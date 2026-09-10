import type { Metadata } from "next";
import { QualityBoard } from "@/features/admin/quality-board";

export const metadata: Metadata = {
  title: "Quality",
  description: "Drivers and members whose recent ratings need a closer look.",
};

export default function AdminQualityPage() {
  return <QualityBoard />;
}
