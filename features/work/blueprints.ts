"use client";

import { useCurrentUser } from "@/lib/auth";
import type { ApiError } from "@/lib/api";
import type { BlueprintKind, BlueprintListItem } from "@/lib/builder-types";
import type { Paginated } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export interface UsableBlueprints {
  items: BlueprintListItem[];
  /** The templates could not be loaded (403 for an ADMIN without builder access, network…). */
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Templates an ADMIN may start (API_CONTRACT_V4 §3.2, §3.3): `active` ones; a Super Admin also gets
 * `test` ones (their runtime rows are marked `is_test`).
 */
export function useUsableBlueprints(kind: Extract<BlueprintKind, "task" | "process">): UsableBlueprints {
  const user = useCurrentUser();
  const active = useApi<Paginated<BlueprintListItem>>("/builder/blueprints", { kind, status: "active", page_size: 200 });
  const test = useApi<Paginated<BlueprintListItem>>(user.is_super_admin ? "/builder/blueprints" : null, {
    kind,
    status: "test",
    page_size: 200,
  });
  const items = [...(active.data?.results ?? []), ...(test.data?.results ?? [])];
  return {
    items,
    error: active.data ? null : active.error,
    loading: !active.data && !active.error,
    reload: () => {
      active.reload();
      test.reload();
    },
  };
}
