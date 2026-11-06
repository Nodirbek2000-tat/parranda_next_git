import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-app flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <p className="text-muted">Sahifa topilmadi.</p>
      <Link href="/" className={buttonClasses("primary")}>
        Bosh sahifa
      </Link>
    </main>
  );
}
