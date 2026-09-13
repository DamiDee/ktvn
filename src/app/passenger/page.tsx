import { redirect } from "next/navigation";

/**
 * Passengers land on their rides.
 *
 * Requesting and history are the two things a member comes here for, and both
 * live on that page.
 */
export default function PassengerHomePage() {
  redirect("/passenger/rides");
}
