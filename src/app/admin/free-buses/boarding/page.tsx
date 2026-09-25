import { BoardingStation } from "@/features/free-buses/boarding-station";
export default async function Page({ searchParams }: { searchParams: Promise<{ bus?: string }> }) { const { bus } = await searchParams; return <BoardingStation initialBus={bus} />; }
