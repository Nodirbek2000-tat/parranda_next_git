"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { roundCoord } from "@/lib/format";
import type { Household } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { MapView } from "@/components/map/map-view";

function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

interface HouseholdLocationProps {
  household: Household;
  /** ADMIN: click the map to set the location. */
  editable: boolean;
}

export function HouseholdLocation({ household, editable }: HouseholdLocationProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, setPending] = useState<{ latitude: number; longitude: number } | null>(null);
  const hasLocation = household.latitude !== null && household.longitude !== null;

  const pick = (lat: number, lng: number) => {
    const latitude = roundCoord(lat);
    const longitude = roundCoord(lng);
    setPending({ latitude, longitude });
    void confirm({
      title: hasLocation ? "Joylashuvni o‘zgartirish" : "Joylashuvni belgilash",
      confirmLabel: "Saqlash",
      message: (
        <p>
          <strong>{household.name}</strong> joylashuvi{" "}
          <span className="font-medium tabular-nums">{formatCoords(latitude, longitude)}</span> sifatida saqlanadi.
        </p>
      ),
      onConfirm: async () => {
        await api.patch<Household>(`/households/${household.id}`, { latitude, longitude });
        toast.success("Joylashuv saqlandi");
      },
    }).finally(() => setPending(null));
  };

  const points =
    household.latitude !== null && household.longitude !== null
      ? [
          {
            id: household.id,
            latitude: household.latitude,
            longitude: household.longitude,
            name: household.name,
            code: household.code,
            birdCount: household.bird_count,
            ownerName: household.owner.full_name,
            active: household.is_active,
          },
        ]
      : [];

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader
        title="Joylashuv"
        description={
          hasLocation
            ? formatCoords(household.latitude as number, household.longitude as number)
            : "Joylashuv belgilanmagan"
        }
      />
      {hasLocation || editable ? (
        <>
          {/* Fills the card when the row is taller than the map (no blank white area under it). */}
          <div className="relative mt-4 min-h-72 flex-1 border-t border-line">
            <div className="absolute inset-0">
              <MapView
                points={points}
                onPick={editable ? pick : undefined}
                pending={pending}
                className="size-full"
                interactive={false}
              />
            </div>
          </div>
          {editable && (
            <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px] text-muted sm:px-6">
              <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
              Joylashuvni {hasLocation ? "o‘zgartirish" : "belgilash"} uchun xaritada kerakli nuqtani bosing.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          icon={MapPin}
          title="Joylashuv belgilanmagan"
          description="Xonadon egasi bot orqali lokatsiya yuborishi yoki administrator xaritada belgilashi mumkin."
        />
      )}
    </Card>
  );
}
