import type { Metadata } from "next";
import type { ReactNode } from "react";
import { appCopy } from "@/copy/app";
import "./globals.css";

export const metadata: Metadata = {
  title: appCopy.title,
  description: appCopy.description,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
