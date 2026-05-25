import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: "CI Cyber Lab",
  description: "CI Cyber Lab — CI Cyber / Digital Forensics training platform",
};

// Tells mobile browsers to size the layout to the device width and
// start at 1.0 zoom. Without this, iOS/Android render the page at
// a synthetic ~980px and shrink-to-fit, which makes the navigation
// + form controls unusably small.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale / userScalable=no — students must be able to
  // zoom for legibility on artefact text. Accessibility comes first.
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
      <body>
        {children}
        {/* Vercel Web Analytics. No-op unless Analytics is enabled
            on the platform-web project in the Vercel dashboard.
            Self-hosted / non-Vercel deploys silently emit nothing. */}
        <Analytics />
      </body>
    </html>
  );
}
