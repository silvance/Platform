import { isIP } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

const FORWARDED_IP_HEADER = "x-ci-train-client-ip";
const BFF_SECRET_HEADER = "x-ci-train-bff-secret";

// Throttler guard that lets a trusted BFF override the per-request
// IP key. Without it, the API's per-IP throttle treats every
// browser-driven login as if it came from the BFF's container
// because the web layer calls /v1/auth/login server-side.
//
// Wire format
// -----------
// The BFF, when forwarding a request that originated from a real
// browser, attaches two headers:
//   X-CI-Train-Client-IP    — the real client's IP (already chosen
//                              by the BFF from its own
//                              trust-boundary-aware lookup of
//                              x-forwarded-for / x-real-ip).
//   X-CI-Train-BFF-Secret   — a long shared secret that proves the
//                              header came from the BFF, not from
//                              an arbitrary internet caller.
//
// The shared secret lives in `BFF_FORWARD_SECRET` on both sides.
// It MUST be unguessable (≥16 random bytes) and MUST be paired
// with a reverse-proxy config that scrubs any inbound
// `X-CI-Train-*` headers from public clients (see
// `deploy/Caddyfile.example`). Otherwise an attacker on the public
// internet could spoof their own IP and reset their throttle
// bucket.
//
// Safe degradation
// ----------------
// When `BFF_FORWARD_SECRET` is unset or too short (dev defaults),
// the override is disabled entirely and we always fall back to
// `req.ip` (which itself respects the `trust proxy` setting on
// the Express app). Likewise, if either header is missing, the
// secret doesn't match, or the forwarded value isn't a valid IPv4
// or IPv6 address, we fall back. There's no failure mode where a
// bad forward silently raises the rate limit.
//
// Note: this class does NOT override the constructor. Subclassing
// ThrottlerGuard with a custom constructor breaks NestJS's
// dependency-injection metadata (the inherited `options`,
// `storageService`, and `reflector` won't be resolved). Reading
// the secret lazily on every request keeps the DI signature
// intact and lets the throttler pick up a rotated env var without
// a restart.
@Injectable()
export class BffForwardedThrottlerGuard extends ThrottlerGuard {
  private readonly log = new Logger(BffForwardedThrottlerGuard.name);
  private spoofedRecently = false;
  private loggedDisabledOnce = false;

  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const fallback = await super.getTracker(req);
    const secret = readSecret();
    if (!secret) {
      if (!this.loggedDisabledOnce) {
        this.log.log(
          "BFF_FORWARD_SECRET not set (or < 16 chars). Forwarded-IP " +
            "override disabled — throttler will key on req.ip for every " +
            "caller, including the BFF.",
        );
        this.loggedDisabledOnce = true;
      }
      return fallback;
    }

    const headers = (req["headers"] ?? {}) as Record<string, unknown>;
    const presented = headers[BFF_SECRET_HEADER];
    const forwarded = headers[FORWARDED_IP_HEADER];

    if (typeof presented !== "string" || typeof forwarded !== "string") {
      return fallback;
    }

    // timingSafeEqual requires equal-length buffers. Compare against a
    // padded copy so a length mismatch doesn't short-circuit early
    // (which would leak length via response time).
    const presentedBuf = Buffer.from(presented, "utf8");
    const candidate = Buffer.alloc(secret.length);
    presentedBuf.copy(candidate, 0, 0, Math.min(presentedBuf.length, candidate.length));
    const ok =
      presentedBuf.length === secret.length &&
      timingSafeEqual(candidate, secret);
    if (!ok) {
      if (!this.spoofedRecently) {
        this.log.warn(
          "Rejected X-CI-Train-Client-IP from caller with wrong " +
            "BFF secret. Throttler falling back to req.ip.",
        );
        this.spoofedRecently = true;
        setTimeout(() => {
          this.spoofedRecently = false;
        }, 60_000).unref();
      }
      return fallback;
    }

    if (isIP(forwarded) === 0) {
      this.log.warn(
        `BFF-forwarded client IP "${forwarded}" is not a valid ` +
          "IPv4/IPv6 address. Falling back to req.ip.",
      );
      return fallback;
    }

    return forwarded;
  }
}

function readSecret(): Buffer | null {
  const raw = process.env["BFF_FORWARD_SECRET"]?.trim();
  if (!raw || raw.length < 16) return null;
  return Buffer.from(raw, "utf8");
}
