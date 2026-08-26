import "./globals.css";
import type { ReactNode } from "react";
import { Kodchasan, Sarabun } from "next/font/google";

const kodchasan = Kodchasan({ subsets: ["thai", "latin"], weight: ["600", "700"], variable: "--font-display" });
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "600", "700"], variable: "--font-body" });

export const metadata = { title: "StudyWeb" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={`${kodchasan.variable} ${sarabun.variable}`}>
      <body>{children}</body>
    </html>
  );
}
