"use client";

import { useState } from "react";
import { Bug, Pill, Stethoscope, Syringe } from "lucide-react";
import type { HouseholdShort } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { DiseaseFormModal, TreatmentFormModal, VaccinationFormModal, VisitFormModal } from "./forms";
import { DiseaseList, TreatmentList, VaccinationList, VisitList } from "./lists";
import { useVetRole } from "./shared";

type Dialog = "visit" | "vaccination" | "disease" | "treatment" | null;

/** “Veterinariya” section of /households/[id] (A, V; WAREHOUSE has no `/api/vet/*` access) — V3 §15.3. */
export function HouseholdVetSection({ household }: { household: HouseholdShort }) {
  const { isVet, isAdmin } = useVetRole();
  const canPlan = isVet || isAdmin;
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle
        title="Veterinariya"
        description="Tekshiruvlar, emlashlar, kasalliklar va davolash"
        actions={
          canPlan ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<Stethoscope className="size-3.5" aria-hidden />} onClick={() => setDialog("visit")}>
                Tekshiruv
              </Button>
              <Button size="sm" variant="secondary" icon={<Syringe className="size-3.5" aria-hidden />} onClick={() => setDialog("vaccination")}>
                Emlash
              </Button>
              <Button size="sm" variant="secondary" icon={<Bug className="size-3.5" aria-hidden />} onClick={() => setDialog("disease")}>
                Kasallik
              </Button>
              {isVet && (
                <Button size="sm" variant="secondary" icon={<Pill className="size-3.5" aria-hidden />} onClick={() => setDialog("treatment")}>
                  Davolash
                </Button>
              )}
            </div>
          ) : undefined
        }
      />
      <SubTitle>Tekshiruvlar</SubTitle>
      <VisitList householdId={household.id} embedded />
      <SubTitle>Emlashlar</SubTitle>
      <VaccinationList householdId={household.id} embedded />
      <SubTitle>Kasalliklar</SubTitle>
      <DiseaseList householdId={household.id} embedded />
      <SubTitle>Davolash va tavsiyalar</SubTitle>
      <TreatmentList householdId={household.id} embedded />

      {dialog === "visit" && <VisitFormModal household={household} onClose={close} onDone={close} />}
      {dialog === "vaccination" && <VaccinationFormModal household={household} onClose={close} onDone={close} />}
      {dialog === "disease" && <DiseaseFormModal household={household} onClose={close} onDone={close} />}
      {dialog === "treatment" && <TreatmentFormModal household={household} onClose={close} onDone={close} />}
    </div>
  );
}

function SubTitle({ children }: { children: string }) {
  return <h3 className="-mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h3>;
}

/** “Emlash tarixi” of /batches/[id] (A, W, V: `GET /api/vet/vaccinations?batch=`, V3 §8.2). */
export function BatchVaccinationHistory({ batchId }: { batchId: number }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle title="Emlash tarixi" description="Shu partiya parrandalariga rejalashtirilgan va o‘tkazilgan emlashlar" />
      <VaccinationList batchId={batchId} embedded />
    </div>
  );
}
