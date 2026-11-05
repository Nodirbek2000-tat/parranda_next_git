import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { LogoMark } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-app flex-col items-center justify-center px-4 text-center">
      <LogoMark className="size-12" />
      <p className="mt-6 text-sm font-medium tabular-nums text-muted">404</p>
      <h1 className="mt-1 text-xl font-semibold text-ink">Sahifa topilmadi</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">Manzil noto‘g‘ri yoki sahifa olib tashlangan.</p>
      <Link href="/" className={buttonClasses("primary", "md", "mt-6")}>
        Bosh sahifaga
      </Link>
    </main>
  );
}
