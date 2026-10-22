"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { FilterBar, SearchInput, ListControls } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { adminData } from "./data/admin-data";
import { LiveRideCard } from "./live-rides";

export function AdminRideHistory() {
  const [status, setStatus] = useState<"COMPLETED" | "CANCELLED">("COMPLETED");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim());
  const history = useInfiniteQuery({
    queryKey: ["admin", "ride-history", status, q],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => adminData.listPastRides(status, pageParam, q),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const rides = [...new Map(history.data?.pages.flatMap((page) => page.items).map((ride) => [ride.id, ride])).values()];
  return <div className="mx-auto max-w-5xl">
    <PageHeader eyebrow="Control centre" title="Ride history" description="Completed and cancelled paid rides. Open a journey to see its full record." />
    <ListControls className="mb-5"
      search={<SearchInput value={search} onChange={setSearch} label="Search ride history" placeholder="Driver, destination or reference" />}
      filters={<FilterBar label="Past ride status" value={status} onChange={setStatus} options={[
        { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" },
      ]} />} />
    {history.isPending ? <ListSkeleton rows={4} /> : rides.length ? <ul className="space-y-3">
      {rides.map((ride) => <li key={ride.id}><LiveRideCard ride={ride} /></li>)}
    </ul> : !history.isError ? <EmptyState icon={FileText} title="No past rides found." description="Completed and cancelled journeys appear here. Try clearing your search." /> : null}
    {history.isError ? <ErrorState title="We couldn't load ride history." onRetry={() => history.refetch()} /> : null}
    {history.hasNextPage ? <Button className="mt-5" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Load more rides</Button> : null}
  </div>;
}
