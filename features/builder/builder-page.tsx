"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import type { Blueprint, BlueprintKind, BuilderMeta } from "@/lib/builder-types";
import { useApi } from "@/lib/use-api";
import type { NotificationSettingRow } from "@/lib/types";
import { Loadable } from "@/components/stats/loadable";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { NotificationSettingsTable } from "@/features/settings/notification-settings";
import { BlueprintList } from "./blueprint-list";
import { DocumentEditor } from "./document-editor";
import { FormEditor } from "./form-editor";
import { NormsTab } from "./norms";
import { ProcessEditor } from "./process-editor";
import { RoleEditor } from "./role-editor";
import { useBuilderMeta } from "./shared";
import { TaskEditor } from "./task-editor";
import { UserAccessTab } from "./user-access";

type Tab = "forms" | "tasks" | "processes" | "documents" | "settings";
/** Sub-sections of "Sozlamalar" (formerly separate tabs; old `?tab=roles|access|notifications|norms` links still work). */
type Section = "roles" | "access" | "notifications" | "norms";

const TABS = [
  { key: "forms", label: "Formalar" },
  { key: "tasks", label: "Vazifalar" },
  { key: "processes", label: "Jarayonlar" },
  { key: "documents", label: "Hujjatlar" },
  { key: "settings", label: "Sozlamalar" },
] as const;

const SECTIONS = [
  { key: "roles", label: "Rollar" },
  { key: "access", label: "Foydalanuvchi vakolatlari" },
  { key: "notifications", label: "Bildirishnomalar" },
  { key: "norms", label: "Me’yorlar" },
] as const;

const TAB_KINDS: Partial<Record<Tab, BlueprintKind>> = {
  forms: "form",
  tasks: "task",
  processes: "process",
  documents: "document",
};

function isSection(value: string | null): value is Section {
  return SECTIONS.some((section) => section.key === value);
}

/** `?tab=` (+ `?section=` for Sozlamalar); a legacy `?tab=roles` etc. maps to Sozlamalar + that section. */
function parseView(tabValue: string | null, sectionValue: string | null): { tab: Tab; section: Section } {
  if (isSection(tabValue)) return { tab: "settings", section: tabValue };
  const tab = TABS.some((item) => item.key === tabValue) ? (tabValue as Tab) : "forms";
  return { tab, section: isSection(sectionValue) ? sectionValue : "roles" };
}

const SKELETON = (
  <Card>
    <TableSkeleton rows={6} />
  </Card>
);

/** /builder — Super Admin "Konstruktor" (API_CONTRACT_V4 §1–§5; guard: lib/nav.ts `superOnly`). */
export function BuilderPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { tab, section } = parseView(params.get("tab"), params.get("section"));
  const edit = params.get("edit");
  const settings = tab === "settings";
  const kind = settings ? (section === "roles" ? "role" : undefined) : TAB_KINDS[tab];
  const meta = useBuilderMeta();

  const navigate = (next: { tab?: Tab; section?: Section; edit?: string | null }) => {
    const query = new URLSearchParams(params.toString());
    const nextTab = next.tab ?? tab;
    const nextSection = next.section ?? (next.tab !== undefined ? "roles" : section);
    // Always write the normalized form (legacy `?tab=roles` becomes `?tab=settings&section=roles`).
    query.set("tab", nextTab);
    if (nextTab === "settings") query.set("section", nextSection);
    else query.delete("section");
    if (next.tab !== undefined || next.section !== undefined) query.delete("edit");
    if (next.edit !== undefined) {
      if (next.edit === null) query.delete("edit");
      else query.set("edit", next.edit);
    }
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const editing = kind && edit ? edit : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Konstruktor"
        description="Formalar, vazifalar, jarayonlar, hujjatlar va rollarni dasturlashsiz sozlash"
        toolbar={<Tabs label="Konstruktor bo‘limlari" items={TABS} value={tab} onChange={(next) => navigate({ tab: next })} />}
      />
      {settings && !editing && (
        <Tabs
          label="Sozlamalar bo‘limlari"
          variant="subtle"
          items={SECTIONS}
          value={section}
          onChange={(next) => navigate({ section: next })}
        />
      )}
      {kind && !editing && (
        <Alert tone="info">
          «Saqlash» bosilganda o‘zgarish darhol kuchga kiradi. Har bir o‘zgarish tarixda saqlanadi — «Versiyalar» orqali
          qaytarish mumkin.
        </Alert>
      )}

      {kind && !editing && (
        <BlueprintList
          key={kind}
          kind={kind}
          meta={meta.data}
          onEdit={(id) => navigate({ edit: String(id) })}
          onCreate={() => navigate({ edit: "new" })}
        />
      )}
      {kind && editing && (
        <BlueprintEditor
          key={`${kind}-${editing}`}
          kind={kind}
          id={editing === "new" ? null : Number(editing)}
          meta={meta}
          onBack={() => navigate({ edit: null })}
          onCreated={(id) => navigate({ edit: String(id) })}
        />
      )}
      {settings && section === "notifications" && <NotificationsTab />}
      {settings && section === "norms" && <NormsTab />}
      {settings && section === "access" && <UserAccessTab meta={meta.data} />}
    </div>
  );
}

function NotificationsTab() {
  const rows = useApi<NotificationSettingRow[]>("/notification-settings");
  return (
    <Loadable resource={rows} skeleton={SKELETON}>
      {(data) => <NotificationSettingsTable rows={data} />}
    </Loadable>
  );
}

/** Loads meta and (for an existing id) the blueprint, then mounts the kind editor once. */
function BlueprintEditor({
  kind,
  id,
  meta,
  onBack,
  onCreated,
}: {
  kind: BlueprintKind;
  id: number | null;
  meta: ReturnType<typeof useBuilderMeta>;
  onBack: () => void;
  onCreated: (id: number) => void;
}) {
  const valid = id === null || (Number.isInteger(id) && id > 0);
  const blueprint = useApi<Blueprint>(valid && id !== null ? `/builder/blueprints/${id}` : null);

  if (!valid) {
    return (
      <Card>
        <ErrorState error={new ApiError(404, "Yozuv topilmadi")} />
      </Card>
    );
  }
  const error = (!meta.data && meta.error) || (id !== null && !blueprint.data && blueprint.error);
  if (error) {
    return (
      <Card>
        <ErrorState
          error={error}
          onRetry={() => {
            meta.reload();
            blueprint.reload();
          }}
        />
      </Card>
    );
  }
  if (!meta.data || (id !== null && !blueprint.data)) return SKELETON;
  if (blueprint.data && blueprint.data.kind !== kind) {
    return (
      <Card>
        <ErrorState error={new ApiError(404, "Bu yozuv boshqa bo‘limga tegishli")} />
      </Card>
    );
  }
  return <KindEditor kind={kind} base={blueprint.data ?? null} meta={meta.data} onBack={onBack} onCreated={onCreated} />;
}

function KindEditor({
  kind,
  ...props
}: {
  kind: BlueprintKind;
  base: Blueprint | null;
  meta: BuilderMeta;
  onBack: () => void;
  onCreated: (id: number) => void;
}) {
  switch (kind) {
    case "role":
      return <RoleEditor {...props} />;
    case "form":
      return <FormEditor {...props} />;
    case "task":
      return <TaskEditor {...props} />;
    case "process":
      return <ProcessEditor {...props} />;
    case "document":
      return <DocumentEditor {...props} />;
  }
}
