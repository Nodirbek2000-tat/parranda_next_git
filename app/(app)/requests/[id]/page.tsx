"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { KIND_EMOJI, RequestActions, RequestHistory, RequestPhotos, RequestStatusBadge } from "@/components/requests";
import { Alert, Card, LinkButton, Spinner } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { fmtNumber } from "@/lib/format";
import { requestPath, REQUESTS_PATH, toRequest, toRequests } from "@/lib/requests";
import { useApi } from "@/lib/use-api";

/** One request (bot button path `/requests/{id}`). Falls back to the list when there is no detail endpoint. */
export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const user = useMe();
  const valid = /^\d+$/.test(id);
  const one = useApi<Record<string, unknown>>(valid ? requestPath(id) : null);
  const list = useApi<unknown>(valid && one.error ? REQUESTS_PATH : null);
  const fromOne = one.data && Number(one.data.id) === Number(id) ? toRequest(one.data) : undefined;
  const req = fromOne ?? (list.data ? toRequests(list.data).find((r) => r.id === Number(id)) : undefined);
  const owner = user.role === "OWNER";
  const error = !valid ? "Ma’lumot topilmadi." : one.error && (list.error || (list.data && !req)) ? (list.error ?? "So‘rov topilmadi.") : null;

  return (
    <>
      <LinkButton href={owner ? "/my" : "/requests"} variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-2 mb-2">
        {owner ? "Mening xonadonim" : "So‘rovlar"}
      </LinkButton>
      {error ? (
        <Alert>{error}</Alert>
      ) : !req ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-2xl" aria-hidden>
                {KIND_EMOJI[req.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold">
                  {req.kindLabel} so‘rovi{req.qtyKg !== null ? ` · ${fmtNumber(req.qtyKg)} kg` : ""}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RequestStatusBadge req={req} />
                  {req.caseId && (
                    <Link href={`/cases/${req.caseId}`} className="text-sm font-medium text-accent">
                      {req.caseCode || `#${req.caseId}`}
                      {req.caseName ? ` · ${req.caseName}` : ""}
                    </Link>
                  )}
                </div>
              </div>
            </div>
            {req.text && <p className="mt-3 whitespace-pre-line text-[15px]">{req.text}</p>}
            {req.delivery && (
              <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm">
                Berildi: <b>{req.delivery.product}</b> — {fmtNumber(req.delivery.qty)} {req.delivery.unit}
              </p>
            )}
            {req.status === "REJECTED" && req.rejectReason && (
              <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                <b>Rad etish sababi:</b> {req.rejectReason}
              </p>
            )}
            {req.photos.length > 0 && (
              <div className="mt-3">
                <RequestPhotos req={req} />
              </div>
            )}
            <div className="mt-4">
              <RequestActions req={req} />
            </div>
          </Card>
          <Card>
            <h2 className="mb-3 text-base font-semibold">Tarix</h2>
            <RequestHistory req={req} />
          </Card>
        </div>
      )}
    </>
  );
}
