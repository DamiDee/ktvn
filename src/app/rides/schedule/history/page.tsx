import type { Metadata } from "next";
import { SchedulePage } from "@/features/paid-rides/scheduling/schedule-page";

export const metadata: Metadata = { title: "Scheduled trip history" };
export default function Page() { return <SchedulePage role="passenger" view="history" />; }
