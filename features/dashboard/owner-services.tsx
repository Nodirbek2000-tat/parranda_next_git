"use client";

import Link from "next/link";
import { MessageSquareHeart, PackageCheck, ShoppingCart, Stethoscope, Syringe } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import type { OwnerVetDashboard } from "@/lib/types";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

/** Additive keys of `GET /api/dashboard/owner` (V3 §10.2); every block may be missing until its module ships. */
export interface OwnerDashboardV3 {
  orders?: { open: number; awaiting_confirmation: number };
  deliveries_to_confirm?: { id: number; code: string; planned_date?: string | null; order_id?: number | null }[];
  vet?: OwnerVetDashboard;
}

function Row({ href, icon: Icon, title, detail, tone = "default" }: {
  href: string;
  icon: typeof ShoppingCart;
  title: string;
  detail: string;
  tone?: "default" | "warning";
}) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-subtle sm:px-6">
        <span
          className={
            tone === "warning"
              ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-ink"
              : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
          }
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-ink">{title}</span>
          <span className="block truncate text-[13px] text-muted">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

/** “Xizmatlar” card on /my: deliveries to accept, open orders, next vet visit / vaccination, quick actions. */
export function OwnerServicesCard({ data }: { data: OwnerDashboardV3 }) {
  const { orders, vet } = data;
  const deliveries = data.deliveries_to_confirm ?? [];
  if (!orders && !vet && deliveries.length === 0) return null;
  const toConfirm = Math.max(orders?.awaiting_confirmation ?? 0, deliveries.length);
  return (
    <Card>
      <CardHeader
        title="Buyurtma va veterinariya"
        actions={
          <span className="flex flex-wrap gap-2">
            <LinkButton href="/my/orders?new=1" size="sm" icon={<ShoppingCart className="size-4" aria-hidden />}>
              Buyurtma berish
            </LinkButton>
            <LinkButton href="/my/vet" size="sm" icon={<MessageSquareHeart className="size-4" aria-hidden />}>
              Veterinarga murojaat
            </LinkButton>
          </span>
        }
      />
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {toConfirm > 0 && (
          <Row
            href="/my/deliveries"
            icon={PackageCheck}
            tone="warning"
            title="Qabul qilish kutilmoqda"
            detail={`${formatNumber(toConfirm)} ta yetkazib berish tasdiqlashingizni kutmoqda`}
          />
        )}
        {orders && (
          <Row
            href="/my/orders"
            icon={ShoppingCart}
            title="Buyurtmalarim"
            detail={orders.open > 0 ? `${formatNumber(orders.open)} ta ochiq buyurtma` : "Ochiq buyurtma yo‘q"}
          />
        )}
        {vet && (
          <Row
            href="/my/vet"
            icon={Stethoscope}
            title="Keyingi tekshiruv"
            detail={
              vet.next_visit
                ? `${formatDate(vet.next_visit.planned_date)} · ${vet.next_visit.purpose}`
                : "Rejalashtirilgan tekshiruv yo‘q"
            }
          />
        )}
        {vet && (
          <Row
            href="/my/vet"
            icon={Syringe}
            title="Keyingi emlash"
            detail={
              vet.next_vaccination
                ? `${formatDate(vet.next_vaccination.planned_date)} · ${vet.next_vaccination.vaccine_name}`
                : "Rejalashtirilgan emlash yo‘q"
            }
          />
        )}
      </ul>
    </Card>
  );
}
