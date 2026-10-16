// Public origin for canonical URLs, robots.txt and sitemap.xml.
// Self-hosted / air-gapped installs can override it with SITE_URL.
export const SITE_URL = (
  process.env.SITE_URL?.trim() || "https://www.cicyberlab.com"
).replace(/\/+$/, "");
