import type { Metadata } from "next";
import { Reports } from "@/features/admin/reports";

export const metadata: Metadata = {
  title: "Reports",
  description:
    "Adoption, verification, ride performance, safety, ratings, service and retention.",
};

export default function AdminReportsPage() {
  return <Reports />;
}
