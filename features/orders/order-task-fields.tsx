"use client";

import type { ChangeEvent } from "react";
import { useAllPages } from "@/lib/use-api";
import { formatNumber, todayIso } from "@/lib/format";
import type { Driver, Vehicle } from "@/lib/types";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export type TaskFieldValues = {
  planned_date: string;
  vehicle: string;
  driver: string;
  task_note: string;
};

export const EMPTY_TASK_FIELDS: TaskFieldValues = { planned_date: "", vehicle: "", driver: "", task_note: "" };

/** Active vehicles and drivers for the optional assignment; `ready=false` while the logistics API is missing. */
export function useFleet() {
  const vehicles = useAllPages<Vehicle>("/logistics/vehicles", { is_active: true });
  const drivers = useAllPages<Driver>("/logistics/drivers", { is_active: true });
  const failed = Boolean(vehicles.error || drivers.error);
  const loading = !failed && (!vehicles.data || !drivers.data);
  return {
    vehicles: vehicles.data?.results ?? [],
    drivers: drivers.data?.results ?? [],
    ready: !failed && !loading,
    failed,
    loading,
  };
}

/** Client checks shared by approve and create-task (the server re-validates everything). */
export function validateTaskFields(values: TaskFieldValues): [string, string | undefined][] {
  return [
    ["planned_date", values.planned_date && values.planned_date < todayIso() ? "Sana o‘tgan kun bo‘lishi mumkin emas." : undefined],
    ["driver", values.vehicle && !values.driver ? "Haydovchini ham tanlang." : undefined],
    ["vehicle", values.driver && !values.vehicle ? "Transportni ham tanlang." : undefined],
    ["task_note", values.task_note.length > 500 ? "Izoh 500 ta belgidan oshmasin." : undefined],
  ];
}

export function taskPayload(values: TaskFieldValues) {
  return {
    planned_date: values.planned_date || null,
    vehicle: values.vehicle ? Number(values.vehicle) : null,
    driver: values.driver ? Number(values.driver) : null,
    note: values.task_note.trim(),
  };
}

type Control = (name: keyof TaskFieldValues) => {
  id: string;
  name: string;
  value: string;
  invalid: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
};
type FieldProps = (name: keyof TaskFieldValues) => { htmlFor: string; error: string | undefined };

/** Plan date, vehicle, driver (with their active task counts) and a note for the logistics task. */
export function TaskFields({
  control,
  field,
  fleet,
}: {
  control: Control;
  field: FieldProps;
  fleet: ReturnType<typeof useFleet>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Reja sanasi" {...field("planned_date")} hint="Bo‘sh qolsa — xonadon so‘ragan sana">
        <Input type="date" min={todayIso()} {...control("planned_date")} />
      </Field>
      <div className="hidden sm:block" />
      <Field label="Transport" {...field("vehicle")} hint="Ixtiyoriy: keyin ham biriktirish mumkin">
        <Select {...control("vehicle")} disabled={!fleet.ready}>
          <option value="">{fleet.loading ? "Yuklanmoqda…" : "Tanlanmagan"}</option>
          {fleet.vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate_number}
              {vehicle.model ? `, ${vehicle.model}` : ""}
              {vehicle.capacity_kg ? ` · ${formatNumber(vehicle.capacity_kg)} kg` : ""}
              {vehicle.active_tasks ? ` · ${vehicle.active_tasks} ta faol` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Haydovchi" {...field("driver")}>
        <Select {...control("driver")} disabled={!fleet.ready}>
          <option value="">{fleet.loading ? "Yuklanmoqda…" : "Tanlanmagan"}</option>
          {fleet.drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.full_name}
              {driver.active_tasks ? ` · ${driver.active_tasks} ta faol` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Topshiriq izohi" {...field("task_note")} className="sm:col-span-2">
        <Textarea rows={2} maxLength={500} {...control("task_note")} />
      </Field>
    </div>
  );
}
