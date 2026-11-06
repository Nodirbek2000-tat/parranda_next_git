"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Card, LinkButton, Loadable } from "@/components/ui";
import { CancelVisitButton, VisitCompleteForm, VisitResult, VisitStatusBadge } from "@/components/visits";
import { useMe } from "@/lib/auth";
import { fmtDate, personName } from "@/lib/format";
import { effectiveRole, isAdmin } from "@/lib/roles";
import { useApi } from "@/lib/use-api";
import { toVisit, visitPath } from "@/lib/visits";

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  const user = useMe();
  const valid = /^\d+$/.test(id);
  const resource = useApi<Record<string, unknown>>(valid ? visitPath(id) : null);
  const owner = user.role === "OWNER";
  const data = resource.data && Number(resource.data.id) === Number(id) ? resource.data : undefined;

  return (
    <>
      <LinkButton href={owner ? "/my" : "/visits"} variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-2 mb-2">
        {owner ? "Mening xonadonim" : "Tashriflar"}
      </LinkButton>
      <Loadable data={data} error={valid ? resource.error : "Ma’lumot topilmadi."} reload={resource.reload}>
        {(raw) => {
          const visit = toVisit(raw);
          const me = visit.vet && typeof visit.vet === "object" ? visit.vet.id === user.id : false;
          // the server decides (`can`); without it, only the visit's own vet completes and ADMIN cancels
          const canComplete = visit.status === "PLANNED" && (visit.can.complete ?? (effectiveRole(user) === "VET" && me));
          const canCancel = visit.status === "PLANNED" && (visit.can.cancel ?? isAdmin(user));
          return (
            <div className="flex flex-col gap-4">
              <Card className={visit.overdue ? "border-danger/50" : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold">{visit.kindLabel}</h1>
                  <VisitStatusBadge visit={visit} />
                </div>
                <dl className="mt-2 grid gap-1 text-sm">
                  <div>
                    <dt className="inline text-muted">Xonadon: </dt>
                    <dd className="inline">
                      {visit.caseId ? (
                        <Link href={`/cases/${visit.caseId}`} className="font-medium text-accent">
                          {visit.caseCode || `#${visit.caseId}`}
                        </Link>
                      ) : (
                        visit.caseCode
                      )}
                      {visit.caseName ? ` · ${visit.caseName}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Reja sanasi: </dt>
                    <dd className={visit.overdue ? "inline font-semibold text-danger" : "inline font-medium"}>{fmtDate(visit.plannedDate)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Veterinar: </dt>
                    <dd className="inline">{personName(visit.vet)}</dd>
                  </div>
                  {visit.requestId && (
                    <div>
                      <dt className="inline text-muted">Chaqiruv: </dt>
                      <dd className="inline">
                        <Link href={`/requests/${visit.requestId}`} className="text-accent">
                          so‘rov #{visit.requestId}
                        </Link>
                      </dd>
                    </div>
                  )}
                  {visit.status === "CANCELLED" && visit.cancelReason && (
                    <div className="text-danger">
                      <dt className="inline">Bekor qilish sababi: </dt>
                      <dd className="inline">{visit.cancelReason}</dd>
                    </div>
                  )}
                </dl>
                {canCancel && (
                  <div className="mt-3">
                    <CancelVisitButton visit={visit} />
                  </div>
                )}
              </Card>
              {visit.status === "DONE" && (
                <Card>
                  <h2 className="mb-3 text-base font-semibold">Ko‘rik natijasi</h2>
                  <VisitResult visit={visit} />
                </Card>
              )}
              {canComplete && (
                <Card className="border-accent/40">
                  <h2 className="mb-3 text-base font-semibold">Tashrifni yakunlash</h2>
                  <VisitCompleteForm visit={visit} />
                </Card>
              )}
              {visit.status === "PLANNED" && !canComplete && !owner && (
                <Alert tone="info">Tashrifni faqat biriktirilgan veterinar yakunlaydi.</Alert>
              )}
            </div>
          );
        }}
      </Loadable>
    </>
  );
}
