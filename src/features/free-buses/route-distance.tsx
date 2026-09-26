"use client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ApiPoint } from "@/types/freebus-api";

export function RouteDistance({ points, ids }: { points: ApiPoint[]; ids: string[] }) {
  const coordinates = ids.map((id) => points.find((p) => p.id === id)).map((p) => p ? { lat: Number(p.geo_location.lat), lng: Number(p.geo_location.long) } : null);
  const ready = ids.length >= 2 && ids[0] !== ids.at(-1) && coordinates.every(Boolean);
  const distance = useQuery({
    queryKey: ["road-distance", ids, coordinates], enabled: ready, retry: false, staleTime: 3600000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/route-distance?points=${encodeURIComponent(JSON.stringify(coordinates))}`, { signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data as { distance_km: number };
    },
  });
  return <div className="space-y-2">
    <Input
      key={`${JSON.stringify(ids)}-${distance.data?.distance_km}`}
      // The API stores kilometres, and so does this field. It was labelled
      // metres, which invited an admin to type a value a thousand times too big.
      label="Route distance (km)"
      name="distance"
      type="number"
      min={0.01}
      step="any"
      required
      defaultValue={distance.data?.distance_km ?? ""}
      readOnly={!distance.error}
      hint={
        !ready
          ? "Choose the boarding point and destination."
          : distance.isFetching
            ? "Measuring the road distance…"
            : distance.error
              ? distance.error.message
              : `${distance.data?.distance_km ?? 0} km by road via ${ids.length - 2 > 0 ? `${ids.length - 2} stop${ids.length - 2 === 1 ? "" : "s"}` : "the direct route"}. Road estimate, not a straight line.`
      }
    />
    {distance.error ? <Button type="button" size="sm" variant="ghost" onClick={() => void distance.refetch()}>Retry distance</Button> : null}
  </div>;
}
