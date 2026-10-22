import "@/features/paid-rides/styles/paid-rides.css";
import type { Metadata } from "next";
import { SchedulePage } from "@/features/paid-rides/scheduling/schedule-page";
export const metadata: Metadata = { title: "Schedule trip" };
export default function Page() { return <SchedulePage role="admin" />; }
