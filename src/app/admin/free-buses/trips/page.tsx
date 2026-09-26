import { AdminTrips } from "@/features/free-buses/admin-trips";
export const metadata = { title: "Trips · Free Buses" };
export default async function Page({ searchParams }: { searchParams: Promise<{ route?: string }> }) { const { route } = await searchParams; return <AdminTrips initialRoute={route} />; }
