import "server-only";
import { headers } from "next/headers";

const BFF_SECRET_HEADER = "x-ci-train-bff-secret";
const FORWARDED_IP_HEADER = "x-ci-train-client-ip";

// Outbound headers the BFF stamps on API calls so the API can rate-
// limit by real-client IP instead of the BFF container's IP. See
// apps/api/src/common/bff-forwarded-throttler.guard.ts for the
// receiving end.
//
// Returns an empty object in any of these cases:
//   - BFF_FORWARD_SECRET is unset (dev / local).
//   - We're not in a request context (e.g. build-time static gen).
//   - The incoming request has no usable client-IP header (and no
//     x-forwarded-for from a trusted proxy).
//
// "Empty" means the API throttler keys on req.ip as it would
// without M14 — safe degradation, not a quiet bypass.
export async function bffForwardHeaders(): Promise<Record<string, string>> {
  const secret = process.env.BFF_FORWARD_SECRET?.trim();
  if (!secret || secret.length < 16) return {};

  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch {
    // Outside a request scope — nothing to forward. Stay silent
    // so static-gen and unit-test paths don't get noisy warnings.
    return {};
  }

  const ip = pickClientIp(h);
  if (!ip) return {};

  return {
    [FORWARDED_IP_HEADER]: ip,
    [BFF_SECRET_HEADER]: secret,
  };
}

// Picks the originating client IP from request headers.
//
// Trusts the *first* entry in x-forwarded-for (per RFC 7239 the
// leftmost value is the original client; later values are added by
// each subsequent proxy). The web app must be deployed behind a
// reverse proxy that controls this header — otherwise a public
// client can spoof it. Caddyfile.example documents the trust
// boundary on both the BFF *and* the API side.
function pickClientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = h.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}
