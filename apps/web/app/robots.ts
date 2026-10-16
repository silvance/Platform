import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages are crawlable so URL-categorization services can see
// what the site is. Everything behind sign-in just redirects to
// /login, so crawlers are told to skip it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/privacy", "/login", "/register"],
        disallow: ["/admin", "/scenarios", "/me", "/glossary", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
