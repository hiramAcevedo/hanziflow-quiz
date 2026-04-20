import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HanziFlow Quiz — Diagnóstico y SRS",
  description: "Sistema de diagnóstico HSK y repetición espaciada",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
