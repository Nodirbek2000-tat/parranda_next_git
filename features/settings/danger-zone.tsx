"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

/** Must match ``core/wipe.py`` ``CONFIRM_TEXT``. */
const CONFIRM_TEXT = "HAMMASINI O‘CHIRISH";
const UNDO_SECONDS = 5;

interface WipeResult {
  deleted: Record<string, number>;
  backup: string;
}

type Step = "idle" | "final" | "countdown" | "running" | "done";

/**
 * «Xavfli zona» (Super Admin): delete every record except the current account.
 * Asked three times (two confirmations + password and typed phrase), then a 5-second window to cancel
 * before the request is even sent. The server saves a full snapshot first (restorable with loaddata).
 */
export function DangerZone() {
  const confirm = useConfirm();
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [seconds, setSeconds] = useState(UNDO_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WipeResult | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const credentials = useRef({ password: "", phrase: "" });

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stopTimer, []);

  const run = async () => {
    setStep("running");
    try {
      const response = await api.post<WipeResult>("/system/wipe", {
        password: credentials.current.password,
        confirm: credentials.current.phrase,
      });
      setResult(response);
      setStep("done");
    } catch (caught) {
      setError(toApiError(caught).message);
      setStep("final");
    }
  };

  const start = async () => {
    // 1-so‘rov
    const first = await confirm({
      title: "Barcha ma’lumotlarni o‘chirish",
      confirmLabel: "Ha, davom etish",
      tone: "danger",
      message: (
        <p>
          Sizdan boshqa <strong>hamma narsa</strong> o‘chiriladi: xodimlar, xonadonlar, partiyalar, ombor, buyurtmalar,
          logistika, veterinariya, vazifalar, dalolatnomalar va bildirishnomalar. Faqat sizning hisobingiz qoladi.
        </p>
      ),
      onConfirm: async () => {},
    });
    if (!first) return;
    // 2-so‘rov
    const second = await confirm({
      title: "Rostdan ham o‘chirasizmi?",
      confirmLabel: "Ha, rostdan ham",
      tone: "danger",
      message: <p>Bu amal butun tizimni bo‘shatadi. Ishlayotgan xodimlar darhol tizimdan chiqib ketadi.</p>,
      onConfirm: async () => {},
    });
    if (!second) return;
    // 3-so‘rov: parol + yozma tasdiq
    setPassword("");
    setPhrase("");
    setError(null);
    setStep("final");
  };

  const submitFinal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phrase.trim() !== CONFIRM_TEXT) {
      setError(`Tasdiqlash uchun aynan «${CONFIRM_TEXT}» deb yozing.`);
      return;
    }
    if (!password) {
      setError("Parolingizni kiriting.");
      return;
    }
    credentials.current = { password, phrase: phrase.trim() };
    setError(null);
    setSeconds(UNDO_SECONDS);
    setStep("countdown");
    let left = UNDO_SECONDS;
    stopTimer();
    timer.current = setInterval(() => {
      left -= 1;
      setSeconds(left);
      if (left <= 0) {
        stopTimer();
        void run();
      }
    }, 1000);
  };

  const cancel = () => {
    stopTimer();
    credentials.current = { password: "", phrase: "" };
    setStep("idle");
  };

  const finish = () => {
    // Every page’s data is gone: a full reload drops all cached lists (not a client-side navigation).
    window.location.replace(new URL("/dashboard", window.location.origin).href);
  };

  return (
    <>
      <Card className="border-danger/40">
        <CardHeader
          title="Xavfli zona"
          description="Sinov ma’lumotlarini tozalash yoki tizimni noldan boshlash uchun"
        />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted">
            Sizdan boshqa barcha foydalanuvchilar va ma’lumotlar o‘chiriladi. O‘chirishdan oldin to‘liq zaxira nusxa
            avtomatik saqlanadi.
          </p>
          <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => void start()}>
            Barcha ma’lumotlarni o‘chirish
          </Button>
        </CardBody>
      </Card>

      {step === "final" && (
        <Modal
          title="Oxirgi tasdiq"
          description="3-so‘rov: parolingizni kiriting va tasdiqlash so‘zini yozing"
          onClose={cancel}
          onSubmit={submitFinal}
          footer={
            <>
              <Button variant="secondary" onClick={cancel}>
                Bekor qilish
              </Button>
              <Button type="submit" variant="danger" icon={<Trash2 className="size-4" aria-hidden />}>
                O‘chirish
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Alert tone="danger">
              <span className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Tasdiqlagach yana {UNDO_SECONDS} soniya ichida bekor qilish mumkin.
              </span>
            </Alert>
            <Field label="Parolingiz" htmlFor="wipe-password" required>
              <Input
                id="wipe-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label={`«${CONFIRM_TEXT}» deb yozing`} htmlFor="wipe-phrase" required>
              <Input
                id="wipe-phrase"
                value={phrase}
                autoComplete="off"
                onChange={(event) => setPhrase(event.target.value)}
                placeholder={CONFIRM_TEXT}
              />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Modal>
      )}

      {(step === "countdown" || step === "running") && (
        <Modal
          title={step === "running" ? "O‘chirilmoqda…" : `${seconds} soniyadan keyin o‘chiriladi`}
          onClose={cancel}
          busy={step === "running"}
          footer={
            <Button variant="secondary" onClick={cancel} disabled={step === "running"}>
              Bekor qilish
            </Button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="text-5xl font-semibold tabular-nums text-danger">{step === "running" ? "…" : seconds}</span>
            <p className="text-sm text-muted">
              {step === "running"
                ? "Zaxira nusxa saqlanmoqda va ma’lumotlar o‘chirilmoqda. Sahifani yopmang."
                : "Fikringiz o‘zgargan bo‘lsa, «Bekor qilish»ni bosing — hech narsa o‘chmaydi."}
            </p>
          </div>
        </Modal>
      )}

      {step === "done" && result && (
        <Modal
          title="Barcha ma’lumotlar o‘chirildi"
          onClose={finish}
          footer={<Button onClick={finish}>Yopish</Button>}
        >
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Jami o‘chirilgan yozuvlar:{" "}
              <strong className="tabular-nums">{Object.values(result.deleted).reduce((sum, value) => sum + value, 0)}</strong>
            </p>
            <p className="text-muted">
              Zaxira nusxa: <span className="font-mono text-ink">{result.backup}</span>. Kerak bo‘lsa, administrator uni
              serverda qayta tiklay oladi.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
