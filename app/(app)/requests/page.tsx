"use client";

import { useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { RequestCard } from "@/components/requests";
import { Button, Empty, Loadable, PageHeader } from "@/components/ui";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { effectiveRole } from "@/lib/roles";
import { REQUEST_TABS, REQUESTS_PATH, toRequests, type OwnerRequest, type RequestKind } from "@/lib/requests";
import { useApi } from "@/lib/use-api";

const TABS = [{ key: "mine", label: "Navbatim", statuses: [] as string[] }, ...REQUEST_TABS];

function inTab(req: OwnerRequest, key: string): boolean {
  if (key === "mine") return req.can.approve || req.can.reject || req.can.deliver || req.can.confirm;
  if (key === "all") return true;
  const tab = REQUEST_TABS.find((t) => t.key === key);
  return !!tab && (tab.statuses as string[]).includes(req.status);
}

/** Owner requests for LOGISTICS (FEED), VET (VET for their cases), ADMIN / SUPERADMIN (all). The API scopes the list. */
export default function RequestsPage() {
  const user = useMe();
  const role = effectiveRole(user);
  const [tab, setTab] = useState("mine");
  const [kind, setKind] = useState<RequestKind | "">("");
  const resource = useApi<unknown>(REQUESTS_PATH, { kind: kind || undefined });
  const kindFilter = role === "ADMIN" || role === "SUPERADMIN";

  return (
    <>
      <PageHeader
        title="So‘rovlar"
        subtitle={role === "LOGISTICS" ? "Yem so‘rovlari" : role === "VET" ? "Veterinar chaqiruvlari" : "Xonadon egalarining so‘rovlari"}
        actions={
          <Button variant="secondary" size="sm" onClick={resource.reload} loading={resource.loading} icon={<RefreshCw className="size-4" aria-hidden />}>
            Yangilash
          </Button>
        }
      />
      {kindFilter && (
        <div className="mb-3 flex gap-2">
          {(
            [
              ["", "Hammasi"],
              ["FEED", "🌾 Yem"],
              ["VET", "🩺 Veterinar"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={cn("h-9 rounded-full border px-3.5 text-sm", kind === value ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <Loadable data={resource.data} error={resource.error} reload={resource.reload}>
        {(data) => {
          const all = toRequests(data).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
          const shown = all.filter((r) => inTab(r, tab));
          return (
            <>
              <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
                  {TABS.map((t) => {
                    const count = all.filter((r) => inTab(r, t.key)).length;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={cn("h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium", tab === t.key ? "bg-primary text-white" : "text-muted hover:text-ink")}
                      >
                        {t.label}
                        {count > 0 && (
                          <span className={cn("ml-1.5 rounded-full px-1.5 text-xs", tab === t.key ? "bg-white/20" : t.key === "mine" ? "bg-warning-soft text-warning-ink" : "bg-subtle")}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {shown.length === 0 ? (
                <Empty title={tab === "mine" ? "Sizni kutayotgan so‘rov yo‘q" : "So‘rovlar yo‘q"} icon={<Inbox className="size-8" aria-hidden />}>
                  Yangi so‘rov kelganda Telegram orqali xabar olasiz.
                </Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  {shown.map((req) => (
                    <RequestCard key={req.id} req={req} />
                  ))}
                </div>
              )}
            </>
          );
        }}
      </Loadable>
    </>
  );
}
