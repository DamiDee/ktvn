import { AdminTransportModule } from "@/features/free-buses/admin-modules";

export const metadata = { title: "Buses · Free Buses" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const { trip } = await searchParams;
  return <AdminTransportModule module="buses" assignTrip={trip} />;
}
