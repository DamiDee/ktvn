import type { Metadata } from "next";
import { MemberFreeBuses } from "@/features/free-buses/member-free-buses";

export const metadata: Metadata = { title: "Free Buses", description: "Book a free bus seat to service or home." };
export default function FreeBusesMemberPage() { return <MemberFreeBuses />; }
