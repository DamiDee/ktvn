import type { Metadata } from "next";
import { VolunteerConfirm } from "@/features/driver/volunteer-confirm";

export const metadata: Metadata = {
  title: "Confirm availability",
  description: "Confirm your availability to drive after the next service.",
};

export default function VolunteerConfirmPage() {
  return <VolunteerConfirm />;
}
