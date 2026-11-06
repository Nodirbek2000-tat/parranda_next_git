"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/api";
import { Modal } from "./modal";
import { Alert, Button, Field, Textarea } from "./ui";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  /** Ask for a reason (required text) and pass it to onConfirm. */
  reason?: { label: string; placeholder?: string };
  /** Runs with a spinner; an error keeps the dialog open and shows the API message. */
  onConfirm: (reason: string) => Promise<void>;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Active extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const activeRef = useRef<Active | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    activeRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const request = { ...options, resolve };
      activeRef.current = request;
      setError(null);
      setPending(false);
      setReason("");
      setActive(request);
    });
  }, []);

  const finish = (ok: boolean) => {
    active?.resolve(ok);
    activeRef.current = null;
    setActive(null);
    setPending(false);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!active) return;
    if (active.reason && !reason.trim()) {
      setError("Sababni yozing.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await active.onConfirm(reason.trim());
      finish(true);
    } catch (caught) {
      setPending(false);
      setError(errorMessage(caught));
    }
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {active && (
        <Modal
          title={active.title}
          onClose={() => finish(false)}
          busy={pending}
          footer={
            <>
              <Button variant="secondary" onClick={() => finish(false)} disabled={pending}>
                Bekor qilish
              </Button>
              <Button variant={active.tone === "danger" ? "danger" : "primary"} loading={pending} onClick={handleConfirm}>
                {active.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4 text-sm">
            {active.message && <div>{active.message}</div>}
            {active.reason && (
              <Field label={active.reason.label} htmlFor="confirm-reason" required>
                <Textarea
                  id="confirm-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={active.reason.placeholder}
                  autoFocus
                />
              </Field>
            )}
            {error && <Alert>{error}</Alert>}
          </div>
        </Modal>
      )}
    </ConfirmContext>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm outside <ConfirmProvider>");
  return context;
}
