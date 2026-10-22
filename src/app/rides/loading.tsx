import { RouteLoader } from "@/components/ui/route-loader";
export default function RideLoading() {
  return <div role="status" className="absolute inset-0 flex items-center justify-center bg-[var(--kx-bg)] p-6"><RouteLoader message="Getting your ride ready" /></div>;
}
