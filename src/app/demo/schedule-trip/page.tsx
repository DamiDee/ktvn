import { notFound } from "next/navigation";
import { SchedulePage } from "@/features/paid-rides/scheduling/schedule-page";
import "@/features/paid-rides/styles/paid-rides.css";

export default function ScheduleDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="kx-rides min-h-dvh bg-[var(--kx-bg)] px-4 py-8 text-[var(--text-primary)]"><SchedulePage role="admin" demo /></main>;
}
