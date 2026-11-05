"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { HouseholdMapPoint } from "@/lib/types";
import type { MapPoint, MapViewProps } from "./types";

/** Leaflet touches `window`, so the map is client-only. */
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export function MapView(props: MapViewProps) {
  return <LeafletMap {...props} />;
}

export function toMapPoint(household: HouseholdMapPoint): MapPoint {
  return {
    id: household.id,
    latitude: household.latitude,
    longitude: household.longitude,
    name: household.name,
    code: household.code,
    birdCount: household.bird_count,
    ownerName: household.owner_name,
    active: household.is_active,
    href: `/households/${household.id}`,
  };
}

export type { MapPoint };
