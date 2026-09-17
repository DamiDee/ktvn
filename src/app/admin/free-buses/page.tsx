import type { Metadata } from "next";
import { AdminFreeBuses } from "@/features/free-buses/admin-free-buses";

export const metadata: Metadata = { title: "Free Buses", description: "Schedule and manage free buses for church services." };
export default function FreeBusesAdminPage() { return <AdminFreeBuses />; }
