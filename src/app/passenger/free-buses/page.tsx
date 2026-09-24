import type { Metadata } from "next";
import { MemberFreeBuses } from "@/features/free-buses/member-free-buses";
import { LiveMemberBuses } from "@/features/free-buses/live-member-buses";
import { LIVE_FREE_BUSES } from "@/lib/freebus-config";

export const metadata: Metadata = { title: "Free Buses", description: "Book a free bus seat to service or home." };
export default function FreeBusesMemberPage() { return LIVE_FREE_BUSES ? <LiveMemberBuses /> : <MemberFreeBuses />; }
