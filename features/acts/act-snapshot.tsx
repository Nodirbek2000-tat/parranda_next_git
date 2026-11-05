"use client";

import type { ActSnapshot } from "@/lib/builder-types";
import { cn } from "@/lib/cn";
import { PhotoThumb } from "../forms/file-chip";

/** A dalolatnoma snapshot (API_CONTRACT_V4 §6) laid out like the PDF: header, body, summary, sections, tasks… */
export function ActSnapshotView({ snapshot: raw, className }: { snapshot: ActSnapshot; className?: string }) {
  // Blocks a template turned off (include_photos …) may be missing: render what is there.
  const snapshot: ActSnapshot = {
    ...raw,
    summary: raw.summary ?? [],
    sections: raw.sections ?? [],
    tasks: raw.tasks ?? [],
    photos: raw.photos ?? [],
    approvals: raw.approvals ?? [],
    signatures: raw.signatures ?? [],
  };
  const household = snapshot.household;
  return (
    <article className={cn("flex flex-col gap-5 text-sm text-ink", className)}>
      <header className="flex flex-col gap-1 border-b border-line pb-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">{snapshot.company}</p>
        <h3 className="text-lg font-semibold leading-snug">{snapshot.title}</h3>
        <p className="text-[13px] text-muted">
          {snapshot.code ? <span className="tabular-nums">№ {snapshot.code} · </span> : null}
          <span className="tabular-nums">{snapshot.date}</span>
          {snapshot.period ? <span className="tabular-nums"> · Davr: {snapshot.period}</span> : null}
        </p>
      </header>

      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {snapshot.role_display && <Meta label="Rol" value={snapshot.role_display} />}
        {snapshot.responsible && <Meta label="Mas’ul" value={snapshot.responsible} />}
        {household && (
          <>
            <Meta label="Xonadon" value={`${household.code} — ${household.name}`} />
            {household.owner && <Meta label="Xonadon egasi" value={household.owner} />}
            {(household.district || household.address) && (
              <Meta label="Manzil" value={[household.district, household.address].filter(Boolean).join(", ")} />
            )}
          </>
        )}
      </dl>

      {snapshot.body && <p className="whitespace-pre-line leading-relaxed">{snapshot.body}</p>}

      {snapshot.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {snapshot.summary.map((item, index) => (
            <div key={`${item.label}-${index}`} className="rounded-lg border border-line bg-subtle px-3 py-2.5">
              <p className="text-xs text-muted">{item.label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {snapshot.sections.map((section, index) => (
        <section key={`${section.title}-${index}`} className="flex flex-col gap-2">
          <h4 className="text-[15px] font-semibold">{section.title}</h4>
          {(section.rows ?? []).length === 0 ? (
            <p className="text-[13px] text-muted">Davr ichida yozuv yo‘q.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr>
                    {section.columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="whitespace-nowrap border-b border-line bg-subtle px-3 py-2 text-left text-xs font-medium text-muted"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="border-b border-line px-3 py-2 align-top [tr:last-child_&]:border-b-0">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {snapshot.tasks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[15px] font-semibold">Bajarilgan vazifalar</h4>
          <ul className="flex flex-col gap-2">
            {snapshot.tasks.map((task) => (
              <li key={task.code} className="rounded-lg border border-line px-3 py-2.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium tabular-nums">{task.code}</span>
                  <span>{task.title}</span>
                </p>
                <p className="text-xs text-muted">{[task.household, task.approved_at].filter(Boolean).join(" · ")}</p>
                {(task.values ?? []).length > 0 && (
                  <dl className="mt-2 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
                    {(task.values ?? []).map((value, index) => (
                      <div key={`${value.label}-${index}`} className="flex min-w-0 justify-between gap-3">
                        <dt className="text-muted">{value.label}</dt>
                        <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{value.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot.photos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[15px] font-semibold">Rasmlar</h4>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {snapshot.photos.map((photo) => (
              <li key={photo.file_id} className="flex min-w-0 flex-col gap-1">
                <PhotoThumb id={photo.file_id} className="aspect-square w-full" />
                <span className="truncate text-xs text-muted">{photo.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot.approvals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[15px] font-semibold">Tasdiqlashlar</h4>
          <ul className="flex flex-col gap-1 text-[13px]">
            {snapshot.approvals.map((approval, index) => (
              <li key={index} className="flex flex-wrap gap-x-2">
                <span className="text-muted">{approval.label}:</span>
                <span className="font-medium">{approval.name}</span>
                <span className="tabular-nums text-muted">{approval.at}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {snapshot.signatures.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-line pt-4">
          {snapshot.signatures.map((line, index) => (
            <p key={index} className="text-[13px]">
              {line}
            </p>
          ))}
        </section>
      )}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
