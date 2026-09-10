import { redirect } from "next/navigation";

/** The professional track's home is the shared driver dashboard. */
export default function ProfessionalIndexPage() {
  redirect("/driver");
}
