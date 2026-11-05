"use client";

import { useState } from "react";
import type { Blueprint, BuilderMeta, PermissionAction, PermissionMap, RoleData } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { EditorShell, editableSource } from "./editor-shell";

type Props = {
  base: Blueprint | null;
  meta: BuilderMeta;
  onBack: () => void;
  onCreated: (id: number) => void;
};

function fromData(raw: Record<string, unknown> | null): RoleData {
  const data = (raw ?? {}) as Partial<RoleData>;
  return {
    base_role: data.base_role ?? "WAREHOUSE",
    permissions: { ...(data.permissions ?? {}) },
  };
}

/** Drop modules without actions ("a missing module means no access"). */
function clean(permissions: PermissionMap, order: readonly string[]): PermissionMap {
  const result: PermissionMap = {};
  for (const [key, actions] of Object.entries(permissions)) {
    if (actions.length === 0) continue;
    result[key] = [...actions].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  return result;
}

/** Role profile editor (API_CONTRACT_V4 §1.2 kind=role, §2): base role + modules × actions matrix. */
export function RoleEditor({ base, meta, onBack, onCreated }: Props) {
  const [data, setData] = useState(() => fromData(editableSource(base).data));
  const actionOrder = meta.actions.map((action) => action.value);
  const baseRoles = meta.system_roles.filter((role) => role.value !== "OWNER");
  const apiData = { base_role: data.base_role, permissions: clean(data.permissions, actionOrder) };
  const errors = data.base_role ? [] : ["Asosiy rolni tanlang"];

  const has = (module: string, action: PermissionAction) => data.permissions[module]?.includes(action) ?? false;

  const setCell = (module: string, action: PermissionAction, on: boolean) =>
    setData((current) => {
      const list = current.permissions[module] ?? [];
      let next = on ? [...new Set([...list, action])] : list.filter((item) => item !== action);
      // Any action needs "view": switching one on grants view, switching view off clears the row.
      if (on && action !== "view" && !next.includes("view")) next = ["view", ...next];
      if (!on && action === "view") next = [];
      return { ...current, permissions: { ...current.permissions, [module]: next } };
    });

  const setRow = (module: string, on: boolean) =>
    setData((current) => ({ ...current, permissions: { ...current.permissions, [module]: on ? [...actionOrder] as PermissionAction[] : [] } }));

  const setColumn = (action: PermissionAction, on: boolean) =>
    setData((current) => {
      const permissions = { ...current.permissions };
      for (const key of meta.modules.map((item) => item.value)) {
        const list = permissions[key] ?? [];
        if (on) {
          const next = new Set<PermissionAction>([...list, action]);
          if (action !== "view") next.add("view");
          permissions[key] = [...next];
        } else {
          permissions[key] = action === "view" ? [] : list.filter((item) => item !== action);
        }
      }
      return { ...current, permissions };
    });

  return (
    <EditorShell kind="role" base={base} meta={meta} data={apiData} clientErrors={errors} onBack={onBack} onCreated={onCreated}>
      {({ serverErrors, readOnly }) => (
        <>
          <Card>
            <CardHeader
              title="Asosiy rol"
              description="Profil faqat asosiy rol ruxsatlarini toraytiradi, kengaytirmaydi. Profil biriktirilganda foydalanuvchining roli shu rolga o‘zgaradi."
            />
            <CardBody>
              <Field label="Asosiy (tizim) roli" htmlFor="role-base" required error={serverErrors.byKey.base_role} className="sm:max-w-xs">
                <Select
                  id="role-base"
                  value={data.base_role}
                  disabled={readOnly}
                  onChange={(event) => setData((current) => ({ ...current, base_role: event.target.value as RoleData["base_role"] }))}
                >
                  {baseRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Ruxsatlar"
              description="Belgilanmagan bo‘lim butunlay yopiq bo‘ladi (menyuda ham ko‘rinmaydi). Ustun yoki qator nomini bosib, hammasini belgilash mumkin."
            />
            {serverErrors.byKey.permissions && <p className="px-4 pt-2 text-[13px] text-danger sm:px-6">{serverErrors.byKey.permissions}</p>}
            <div className="mt-4 overflow-x-auto border-t border-line">
              <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
                <caption className="sr-only">Bo‘limlar va amallar bo‘yicha ruxsatlar</caption>
                <thead>
                  <tr>
                    <th scope="col" className="h-10 border-b border-line bg-surface px-4 text-left text-xs font-medium text-muted sm:pl-6">
                      Bo‘lim
                    </th>
                    {meta.actions.map((action) => {
                      const all = meta.modules.every((module) => has(module.value, action.value));
                      return (
                        <th key={action.value} scope="col" className="h-10 border-b border-line bg-surface px-2 text-center">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => setColumn(action.value, !all)}
                            title={all ? "Ustunni tozalash" : "Ustunni to‘liq belgilash"}
                            className="rounded px-1.5 py-1 text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed"
                          >
                            {action.label}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {meta.modules.map((module) => {
                    const count = data.permissions[module.value]?.length ?? 0;
                    const full = count === meta.actions.length;
                    return (
                      <tr key={module.value} className={cn("hover:bg-subtle", count === 0 && "text-muted")}>
                        <th scope="row" className="h-11 border-b border-line px-4 text-left font-medium sm:pl-6">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => setRow(module.value, !full)}
                            title={full ? "Qatorni tozalash" : "Qatorni to‘liq belgilash"}
                            className={cn(
                              "rounded px-1 py-0.5 text-left hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed",
                              count === 0 ? "text-muted" : "text-ink",
                            )}
                          >
                            {module.label}
                          </button>
                        </th>
                        {meta.actions.map((action) => (
                          <td key={action.value} className="h-11 border-b border-line px-2 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${module.label}: ${action.label}`}
                              checked={has(module.value, action.value)}
                              disabled={readOnly}
                              onChange={(event) => setCell(module.value, action.value, event.target.checked)}
                              className="size-4 accent-[var(--color-accent)]"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </EditorShell>
  );
}
