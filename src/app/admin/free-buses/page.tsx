import type { Metadata } from "next";
import { AdminFreeBuses } from "@/features/free-buses/admin-free-buses";
import { AdminTransportModule } from "@/features/free-buses/admin-modules";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";

export const metadata: Metadata = { title: "Free Buses", description: "Schedule and manage free buses for church services." };
export default function FreeBusesAdminPage() { return LIVE_FREE_BUSES ? <AdminTransportModule /> : <AdminFreeBuses />; }
