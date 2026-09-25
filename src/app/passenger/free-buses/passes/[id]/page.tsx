import { BoardingPass } from "@/features/free-buses/boarding-passes";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <BoardingPass id={id} />; }
