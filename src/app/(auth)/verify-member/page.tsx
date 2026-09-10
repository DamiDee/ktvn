import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { MemberVerification } from "@/features/auth/member-verification";

export const metadata: Metadata = {
  title: "Confirm membership",
  description:
    "Confirm your Koinonia membership to start requesting verified rides.",
};

export default function VerifyMemberPage() {
  return (
    <AuthShell
      eyebrow="Membership"
      trustStatement="Only confirmed members can request a ride or offer one — that's what keeps the network closed."
    >
      <MemberVerification />
    </AuthShell>
  );
}
