"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { Blueprint, BuilderMeta, DocumentData } from "@/lib/builder-types";
import { formatDate, ROLE_LABELS, todayIso } from "@/lib/format";
import type { Role } from "@/lib/types";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EditorShell, editableSource } from "./editor-shell";
import { focusAt, insertAt, InsertChip, SCOPE_LABELS } from "./shared";

type Props = {
  base: Blueprint | null;
  meta: BuilderMeta;
  onBack: () => void;
  onCreated: (id: number) => void;
};

/** Used when meta has no placeholder list (§1.2 "Placeholders"). */
const DEFAULT_PLACEHOLDERS = [
  { value: "{{company}}", label: "Kompaniya" },
  { value: "{{date}}", label: "Sana" },
  { value: "{{period}}", label: "Davr" },
  { value: "{{act.code}}", label: "Dalolatnoma raqami" },
  { value: "{{role}}", label: "Rol" },
  { value: "{{responsible}}", label: "Mas’ul" },
  { value: "{{household.code}}", label: "Xonadon ID" },
  { value: "{{household.name}}", label: "Xonadon nomi" },
  { value: "{{household.owner}}", label: "Xonadon egasi" },
  { value: "{{household.district}}", label: "Tuman" },
  { value: "{{household.address}}", label: "Manzil" },
  { value: "{{task.code}}", label: "Vazifa raqami" },
  { value: "{{task.title}}", label: "Vazifa nomi" },
  { value: "{{quantities}}", label: "Miqdorlar bloki" },
  { value: "{{photos}}", label: "Rasmlar bloki" },
  { value: "{{approvals}}", label: "Tasdiqlar bloki" },
];

const BLOCKS: Record<string, string> = {
  quantities: "[Miqdorlar jadvali]",
  photos: "[Rasmlar]",
  approvals: "[Tasdiqlar ro‘yxati]",
};

function sampleValues(role: string): Record<string, string> {
  const today = formatDate(todayIso());
  return {
    company: "Navobod naslli parranda",
    date: today,
    period: `01.${today.slice(3)} — ${today}`,
    "act.code": "DL-000001",
    role: ROLE_LABELS[role as Role] ?? "Veterinar",
    responsible: "Ali Valiyev",
    "household.code": "XN-0001",
    "household.name": "Aliyevlar",
    "household.owner": "Vali Aliyev",
    "household.district": "Pop",
    "household.address": "Navobod MFY, 12-uy",
    "task.code": "VZ-000005",
    "task.title": "Qurilish ko‘rigi",
  };
}

function render(body: string, role: string): string {
  const samples = sampleValues(role);
  return body.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/gi, (match, name: string) => {
    if (name in samples) return samples[name];
    if (name in BLOCKS) return BLOCKS[name];
    if (name.startsWith("field.")) return `[${name.slice(6)}]`;
    return match; // unknown placeholders stay as text (the server does the same)
  });
}

function fromData(raw: Record<string, unknown> | null): DocumentData {
  const data = (raw ?? {}) as Partial<DocumentData>;
  return {
    scope: data.scope ?? "task",
    role: data.role ?? "",
    title: data.title ?? "",
    body: data.body ?? "",
    signatures: [...(data.signatures ?? [])],
    include_photos: data.include_photos ?? true,
    include_approvals: data.include_approvals ?? true,
    include_quantities: data.include_quantities ?? true,
  };
}

function toData(data: DocumentData): Record<string, unknown> {
  return {
    ...data,
    role: data.scope === "role" ? data.role : "",
    title: data.title.trim(),
    signatures: data.signatures.map((item) => item.trim()).filter(Boolean),
  };
}

function validate(data: DocumentData): string[] {
  const errors: string[] = [];
  if (!data.title.trim()) errors.push("Sarlavhani kiriting");
  if (data.scope === "role" && !data.role) errors.push("Rolni tanlang");
  return errors;
}

/** Document (act) template editor (API_CONTRACT_V4 §1.2 kind=document) with a live preview. */
export function DocumentEditor({ base, meta, onBack, onCreated }: Props) {
  const [data, setData] = useState(() => fromData(editableSource(base).data));
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const placeholders = meta.placeholders.length ? meta.placeholders : DEFAULT_PLACEHOLDERS;
  const set = <K extends keyof DocumentData>(key: K, value: DocumentData[K]) => setData((current) => ({ ...current, [key]: value }));
  const errors = validate(data);

  const insert = (token: string) => {
    const result = insertAt(bodyRef.current, data.body, token);
    set("body", result.value);
    focusAt(bodyRef.current, result.cursor);
  };

  const previewRole = data.scope === "role" ? data.role || "VET" : "VET";

  return (
    <EditorShell kind="document" base={base} meta={meta} data={toData(data)} clientErrors={errors} onBack={onBack} onCreated={onCreated}>
      {({ serverErrors, submitted, readOnly }) => {
        const err = (key: keyof DocumentData, local?: string) => serverErrors.byKey[key] ?? (submitted ? local : undefined);
        return (
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
              <Card>
                <CardHeader title="Hujjat turi" />
                <CardBody className="grid gap-4 sm:grid-cols-2">
                  <Field label="Qayerda ishlatiladi" htmlFor="doc-scope" required error={err("scope")}>
                    <Select
                      id="doc-scope"
                      value={data.scope}
                      disabled={readOnly}
                      onChange={(event) => set("scope", event.target.value as DocumentData["scope"])}
                    >
                      {(Object.keys(SCOPE_LABELS) as DocumentData["scope"][]).map((value) => (
                        <option key={value} value={value}>
                          {SCOPE_LABELS[value]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {data.scope === "role" && (
                    <Field label="Rol" htmlFor="doc-role" required error={err("role", data.role ? undefined : "Rolni tanlang")}>
                      <Select
                        id="doc-role"
                        value={data.role ?? ""}
                        disabled={readOnly}
                        onChange={(event) => set("role", event.target.value as DocumentData["role"])}
                      >
                        <option value="">Tanlang</option>
                        {meta.system_roles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field
                    label="Sarlavha"
                    htmlFor="doc-title"
                    required
                    className="sm:col-span-2"
                    error={err("title", data.title.trim() ? undefined : "Sarlavhani kiriting")}
                  >
                    <Input
                      id="doc-title"
                      value={data.title}
                      disabled={readOnly}
                      onChange={(event) => set("title", event.target.value)}
                      placeholder="Bajarilgan ishlar dalolatnomasi"
                      autoComplete="off"
                    />
                  </Field>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Matn" description="Belgini bosing — u kursor turgan joyga qo‘yiladi. {{field.kalit}} — forma maydoni qiymati (vazifa dalolatnomasi)." />
                <CardBody className="flex flex-col gap-3">
                  {!readOnly && (
                    <div className="flex flex-wrap gap-1.5">
                      {placeholders.map((item) => (
                        <InsertChip key={item.value} onClick={() => insert(item.value)} title={item.value}>
                          {item.label}
                        </InsertChip>
                      ))}
                    </div>
                  )}
                  <Field label="Hujjat matni" htmlFor="doc-body" error={err("body")}>
                    <Textarea
                      ref={bodyRef}
                      id="doc-body"
                      value={data.body}
                      disabled={readOnly}
                      onChange={(event) => set("body", event.target.value)}
                      rows={10}
                      className="font-mono text-[13px]"
                      placeholder="Biz, quyida imzo chekuvchilar, {{date}} kuni {{household.code}} xonadonida ..."
                    />
                  </Field>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Imzolar va bloklar" />
                <CardBody className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {data.signatures.map((signature, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <Input
                          id={`doc-signature-${index}`}
                          aria-label={`${index + 1}-imzo`}
                          value={signature}
                          disabled={readOnly}
                          onChange={(event) =>
                            set(
                              "signatures",
                              data.signatures.map((item, i) => (i === index ? event.target.value : item)),
                            )
                          }
                          placeholder="Masalan: Veterinar"
                          className="h-9"
                        />
                        {!readOnly && (
                          <IconButton
                            label="Imzoni o‘chirish"
                            tone="quiet-danger"
                            onClick={() => set("signatures", data.signatures.filter((_, i) => i !== index))}
                          >
                            <X className="size-4" aria-hidden />
                          </IconButton>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="self-start"
                        icon={<Plus className="size-3.5" aria-hidden />}
                        onClick={() => set("signatures", [...data.signatures, ""])}
                      >
                        Imzo qo‘shish
                      </Button>
                    )}
                    {serverErrors.byKey.signatures && <p className="text-[13px] text-danger">{serverErrors.byKey.signatures}</p>}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-line pt-4">
                    {(
                      [
                        ["include_quantities", "Miqdorlar jadvalini qo‘shish"],
                        ["include_photos", "Rasmlarni qo‘shish"],
                        ["include_approvals", "Tasdiqlar ro‘yxatini qo‘shish"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 text-sm text-ink">
                        <Switch checked={data[key]} disabled={readOnly} onChange={(value) => set(key, value)} label={label} />
                        {label}
                      </label>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card className="h-fit xl:sticky xl:top-4">
              <CardHeader title="Ko‘rinishi" description="Namuna qiymatlar bilan" />
              <CardBody>
                <article className="rounded-lg border border-line bg-surface px-4 py-5 text-[13px] leading-relaxed text-ink shadow-sm">
                  <p className="text-center text-xs text-muted">Navobod naslli parranda · DL-000001</p>
                  <h3 className="mt-2 text-center text-[15px] font-semibold">{data.title || "Sarlavha"}</h3>
                  <p className="mt-1 text-center text-xs text-muted">{sampleValues(previewRole).date}</p>
                  <p className="mt-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {data.body ? render(data.body, previewRole) : <span className="text-muted">Matn kiritilmagan</span>}
                  </p>
                  {data.include_quantities && !/\{\{\s*quantities\s*\}\}/.test(data.body) && (
                    <p className="mt-3 rounded border border-dashed border-line px-2 py-2 text-center text-xs text-muted">{BLOCKS.quantities}</p>
                  )}
                  {data.include_photos && !/\{\{\s*photos\s*\}\}/.test(data.body) && (
                    <p className="mt-2 rounded border border-dashed border-line px-2 py-2 text-center text-xs text-muted">{BLOCKS.photos}</p>
                  )}
                  {data.include_approvals && !/\{\{\s*approvals\s*\}\}/.test(data.body) && (
                    <p className="mt-2 rounded border border-dashed border-line px-2 py-2 text-center text-xs text-muted">{BLOCKS.approvals}</p>
                  )}
                  {data.signatures.some((item) => item.trim()) && (
                    <div className="mt-5 flex flex-col gap-2">
                      {data.signatures
                        .filter((item) => item.trim())
                        .map((item, index) => (
                          <p key={index}>
                            {item}: ____________
                          </p>
                        ))}
                    </div>
                  )}
                </article>
              </CardBody>
            </Card>
          </div>
        );
      }}
    </EditorShell>
  );
}
