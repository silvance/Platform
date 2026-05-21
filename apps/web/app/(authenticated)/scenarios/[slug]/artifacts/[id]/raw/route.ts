// Authenticated artifact proxy. The browser only ever talks to the web
// origin; this route reads the user's HttpOnly session cookie, forwards
// the bearer token to the API, and streams the response body back. The
// raw API token is never exposed to the browser.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

const API_INTERNAL_URL =
  process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const FORWARDED_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "etag",
  "cache-control",
  "x-content-type-options",
  "content-security-policy",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<NextResponse> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { slug, id } = await params;
  const upstreamUrl =
    `${API_INTERNAL_URL}/v1/scenarios/${encodeURIComponent(slug)}` +
    `/artifacts/${encodeURIComponent(id)}/content`;

  const upstream = await fetch(upstreamUrl, {
    headers: { authorization: `Bearer ${token}`, accept: "*/*" },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    // Pass through the upstream status so 401/404 don't get masked as 200.
    return new NextResponse(null, { status: upstream.status });
  }

  // Stream the upstream body directly back to the browser.
  const headers = new Headers();
  for (const h of FORWARDED_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
