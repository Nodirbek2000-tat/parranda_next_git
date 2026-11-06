"use client";

import { useState } from "react";
import { House, Stethoscope } from "lucide-react";
import { CaseCard } from "@/components/case-card";
import { GrowingProgress } from "@/components/case-extras";
import { CaseView } from "@/components/case-view";
import { NewRequestModal, RequestList } from "@/components/requests";
import { Alert, Card, Empty, Loadable, PageHeader, Spinner } from "@/components/ui";
import { VisitList } from "@/components/visits";
import { listOf } from "@/lib/api";
import { personName } from "@/lib/format";
import { growingOf } from "@/lib/growing";
import { REQUESTS_PATH, toRequests, type RequestKind } from "@/lib/requests";
import type { CaseDetail, CaseSummary, Paged } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { toVisits, VISITS_PATH } from "@/lib/visits";

/**
 * Owner cabinet: growing progress, big "Yem so‘rash" / "Veterinar chaqirish" buttons, my requests ("Oldim" on DELIVERED),
 * visit history, then the own case timeline (read-only) with the stage-9 confirm form when it is their turn.
 */
export default function MyPage() {
  const list = useApi<Paged<CaseSummary>>("/cases");
  const items = list.data ? listOf(list.data) : [];
  // several partiyas: the running one is the cabinet, otherwise the only / latest finished one
  const single = items.find((i) => i.status === "IN_PROGRESS") ?? (items.length === 1 ? items[0] : null);
  const detail = useApi<CaseDetail>(single ? `/cases/${single.id}` : null);

  return (
    <>
      <PageHeader title="Mening xonadonim" />
      <Loadable data={list.data} error={list.error} reload={list.reload}>
        {() => {
          if (!items.length)
            return (
              <Empty title="Xonadon biriktirilmagan" icon={<House className="size-8" aria-hidden />}>
                Savollar bo‘lsa, administrator bilan bog‘laning.
              </Empty>
            );
          if (!single)
            return (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <CaseCard key={item.id} item={item} />
                ))}
              </div>
            );
          if (detail.data) return <OwnerCabinet detail={detail.data} />;
          return detail.error ? <Alert>{detail.error}</Alert> : <Spinner />;
        }}
      </Loadable>
    </>
  );
}

function OwnerCabinet({ detail }: { detail: CaseDetail }) {
  const [asking, setAsking] = useState<RequestKind | null>(null);
  const growing = growingOf(detail);
  const canRequest = detail.can?.request ?? !!growing;
  // the case detail carries requests[] and visits[] (ARCHITECTURE_V2_1 §4); otherwise ask the list endpoints
  const reqRes = useApi<unknown>(Array.isArray(detail.requests) ? null : REQUESTS_PATH, { case: detail.id });
  const visRes = useApi<unknown>(Array.isArray(detail.visits) ? null : VISITS_PATH, { case: detail.id });
  const requests = toRequests(Array.isArray(detail.requests) ? detail.requests : reqRes.data);
  const visits = toVisits(Array.isArray(detail.visits) ? detail.visits : visRes.data);
  const delivered = requests.filter((r) => r.can.confirm || r.status === "DELIVERED");
  // The buttons are always shown so the owner knows the option exists; they work only in the growing period.
  const closedHint = canRequest
    ? null
    : detail.status === "REJECTED"
      ? "Xonadon rad etilgan — so‘rov yuborib bo‘lmaydi."
      : detail.status === "DONE" || (detail.current_stage ?? 0) > 10
        ? "Parvarish davri yakunlangan — so‘rov yuborib bo‘lmaydi."
        : "Jo‘jalar yetkazilib, parvarish boshlangach bu tugmalar ochiladi.";
  const askButton = (kind: RequestKind, icon: string, label: string, tone: string) => (
    <button
      type="button"
      onClick={() => setAsking(kind)}
      disabled={!canRequest}
      className={`flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-center text-[15px] font-semibold shadow-card active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted disabled:shadow-none disabled:active:scale-100 ${tone}`}
    >
      <span className={`text-3xl ${canRequest ? "" : "opacity-50 grayscale"}`} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {(
        <Card className="flex flex-col gap-4">
          {growing && <GrowingProgress growing={growing} big />}
          <div className="grid grid-cols-2 gap-3">
            {askButton("FEED", "🌾", "Yem so‘rash", "bg-primary text-white")}
            {askButton("VET", "🩺", "Veterinar chaqirish", "bg-accent text-white")}
          </div>
          {closedHint && <p className="-mt-1 text-center text-sm text-muted">{closedHint}</p>}
          {detail.vet_user && (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Stethoscope className="size-4 text-accent" aria-hidden /> Veterinaringiz: <b className="text-ink">{personName(detail.vet_user)}</b>
            </p>
          )}
        </Card>
      )}

      {delivered.length > 0 && (
        <Alert tone="warning">Yetkazilgan mahsulotni olgan bo‘lsangiz, «Oldim» tugmasini bosing.</Alert>
      )}

      {(
        <Card>
          <h2 className="mb-3 text-base font-semibold">Mening so‘rovlarim</h2>
          {reqRes.error && <Alert className="mb-2">{reqRes.error}</Alert>}
          <RequestList items={requests} showCase={false} empty="Hali so‘rov yubormagansiz." />
        </Card>
      )}

      {(visits.length > 0 || growing) && (
        <Card>
          <h2 className="mb-3 text-base font-semibold">Veterinar tashriflari</h2>
          {visRes.error && <Alert className="mb-2">{visRes.error}</Alert>}
          <VisitList items={visits} showCase={false} empty="Hali tashrif bo‘lmagan." />
        </Card>
      )}

      <CaseView detail={detail} readOnly extras={false} />

      {asking && <NewRequestModal caseId={detail.id} kind={asking} onClose={() => setAsking(null)} />}
    </div>
  );
}
