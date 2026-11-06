"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Alert, Button } from "./ui";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for WebViews without the async clipboard API.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Shows a one-time temporary password with a copy button. */
export function TempPassword({ username, password }: { username: string; password: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(password);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 rounded-lg border border-line bg-subtle p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <dt className="text-muted">Login</dt>
          <dd className="min-w-0 break-all font-medium text-ink">{username}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <dt className="text-muted">Vaqtinchalik parol</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-surface px-2 py-1 font-mono text-[15px] font-semibold tracking-wider text-ink ring-1 ring-line">
              {password}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              icon={copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            >
              {copied ? "Nusxalandi" : "Nusxalash"}
            </Button>
          </dd>
        </div>
      </dl>
      <Alert tone="warning">
        Parol faqat hozir ko‘rsatiladi. Uni foydalanuvchiga xavfsiz yo‘l bilan yetkazing — birinchi kirishda parolni
        almashtirish so‘raladi.
      </Alert>
    </div>
  );
}
