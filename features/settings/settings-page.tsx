"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import type { NotificationSettingRow, SystemSettings } from "@/lib/types";
import { Loadable } from "@/components/stats/loadable";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { CompanySettingsForm } from "./company-settings-form";
import { DangerZone } from "./danger-zone";
import { NotificationSettingsTable } from "./notification-settings";
import { RolesMatrix } from "./roles-matrix";

type Tab = "company" | "notifications" | "roles";

const TABS = [
  { key: "company", label: "Kompaniya" },
  { key: "notifications", label: "Bildirishnomalar" },
  { key: "roles", label: "Rollar" },
] as const;

function parseTab(value: string | null): Tab {
  return value === "notifications" || value === "roles" ? value : "company";
}

const SKELETON = (
  <Card>
    <TableSkeleton rows={6} />
  </Card>
);

/** /settings — Super Admin only (V3 §3, §9.3; guard: lib/nav.ts `superOnly`). */
export function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = parseTab(params.get("tab"));

  const setTab = (next: Tab) => {
    const query = new URLSearchParams(params.toString());
    if (next === "company") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const settings = useApi<SystemSettings>(tab === "company" ? "/settings" : null);
  const notificationSettings = useApi<NotificationSettingRow[]>(tab === "notifications" ? "/notification-settings" : null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sozlamalar"
        description="Kompaniya ma’lumotlari, bildirishnoma qoidalari va rollar"
        toolbar={<Tabs label="Sozlamalar bo‘limlari" items={TABS} value={tab} onChange={setTab} />}
      />
      {tab === "company" && (
        <Loadable resource={settings} skeleton={SKELETON}>
          {(data) => <CompanySettingsForm key={data.updated_at} settings={data} />}
        </Loadable>
      )}
      {tab === "company" && <DangerZone />}
      {tab === "notifications" && (
        <Loadable resource={notificationSettings} skeleton={SKELETON}>
          {(rows) => <NotificationSettingsTable rows={rows} />}
        </Loadable>
      )}
      {tab === "roles" && <RolesMatrix />}
    </div>
  );
}
