import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumina Studio — Pro Image Editor",
  description: "Professional browser-based image editor with layers, filters, typography and 4K export.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0f] text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
