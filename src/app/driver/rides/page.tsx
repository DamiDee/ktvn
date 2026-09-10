import { redirect } from "next/navigation";

/** The trips list moved to /driver/trips. */
export default function DriverRidesPage() {
  redirect("/driver/trips");
}
