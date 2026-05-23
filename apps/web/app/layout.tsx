import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { readTheme } from "@/lib/theme";
import "./globals.css";

// Inter is the default UI font; JetBrains Mono is the monospace
// face used in artifact viewers + code blocks. Both fetched at
// build time and self-hosted by Next.js (no runtime google.com
// hit at request time).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CICyberLab",
  description: "CICyberLab — CI Cyber / Digital Forensics training platform",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const theme = await readTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${jetBrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
