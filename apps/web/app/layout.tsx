import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { readTheme } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// IBM Plex Sans for UI text, IBM Plex Mono for evidence, data and
// labels, Source Serif for page titles. All fetched at build time
// and self-hosted by Next.js (no runtime google.com hit). The
// --face-* variables feed the --font-* stacks in globals.css.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--face-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--face-mono",
});
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--face-serif",
});

export const metadata: Metadata = {
  // Resolves relative canonical / Open Graph URLs to the public origin.
  metadataBase: new URL(SITE_URL),
  title: "CI Cyber Lab",
  description:
    "CI Cyber Lab — unclassified, non-commercial training platform for counterintelligence and digital-forensics analysts.",
};

// Tells mobile browsers to size the layout to the device width and
// start at 1.0 zoom. Without this, iOS/Android render the page at
// a synthetic ~980px and shrink-to-fit, which makes the navigation
// + form controls unusably small.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // No maximumScale / userScalable=no — students must be able to
  // zoom for legibility on artifact text. Accessibility comes first.
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
      className={`${plexSans.variable} ${plexMono.variable} ${sourceSerif.variable}`}
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
