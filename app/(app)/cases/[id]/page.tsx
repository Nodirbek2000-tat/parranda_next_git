"use client";

import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CaseView } from "@/components/case-view";
import { LinkButton, Loadable } from "@/components/ui";
import { useMe } from "@/lib/auth";
import type { CaseDetail } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const user = useMe();
  const valid = /^\d+$/.test(id);
  const resource = useApi<CaseDetail>(valid ? `/cases/${id}` : null);
  const owner = user.role === "OWNER";
  const data = resource.data?.id === Number(id) ? resource.data : undefined;
  return (
    <>
      <LinkButton href={owner ? "/my" : "/cases"} variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} className="-ml-2 mb-2">
        {owner ? "Mening xonadonim" : "Xonadonlar"}
      </LinkButton>
      <Loadable data={data} error={valid ? resource.error : "Ma’lumot topilmadi."} reload={resource.reload}>
        {(detail) => <CaseView detail={detail} readOnly={owner} />}
      </Loadable>
    </>
  );
}
