import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "NNP — Xonadonlar jarayoni",
  description: "Navobod naslli parranda: xonadon bosqichlari, ombor va hisobotlar.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#12372A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
