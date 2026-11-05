"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { toApiError } from "@/lib/api";
import { Alert } from "./alert";
import { Button } from "./button";
import { Modal } from "./modal";

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  /** Runs while the dialog shows a spinner; an ApiError keeps the dialog open with the message. */
  onConfirm: () => Promise<void>;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ActiveRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveRequest | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<ActiveRequest | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    activeRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const request = { ...options, resolve };
      activeRef.current = request;
      setError(null);
      setPending(false);
      setActive(request);
    });
  }, []);

  const finish = (confirmed: boolean) => {
    active?.resolve(confirmed);
    activeRef.current = null;
    setActive(null);
    setPending(false);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!active) return;
    setPending(true);
    setError(null);
    try {
      await active.onConfirm();
      finish(true);
    } catch (caught) {
      setPending(false);
      setError(toApiError(caught).message);
    }
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext value={value}>
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
          <div className="flex flex-col gap-4 text-sm text-ink">
            <div>{active.message}</div>
            {error && <Alert>{error}</Alert>}
          </div>
        </Modal>
      )}
    </ConfirmContext>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return context;
}

/**
 * Confirmation step for form submissions: shows the dialog, runs `run` on
 * confirm and returns its result (null when cancelled). Errors are re-thrown
 * after the dialog closes, so the form can show field errors in place.
 */
export function useConfirmedAction() {
  const confirm = useConfirm();
  return useCallback(
    async <T,>(options: Omit<ConfirmOptions, "onConfirm">, run: () => Promise<T>): Promise<T | null> => {
      let result: T | null = null;
      let failure: unknown = null;
      await confirm({
        ...options,
        onConfirm: async () => {
          try {
            result = await run();
          } catch (caught) {
            failure = caught;
          }
        },
      });
      if (failure) throw failure;
      return result;
    },
    [confirm],
  );
}
