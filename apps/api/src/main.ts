import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number(process.env.API_PORT ?? 4000);

  // Trust-proxy is OFF by default: if the API is reachable directly, an
  // attacker-controlled `X-Forwarded-For` would otherwise let them spoof
  // req.ip and bypass per-IP throttling on /auth/login.
  //
  // Enable only when the API sits behind a trusted reverse proxy that
  // sanitizes forwarded headers (Caddy/nginx/Traefik/ALB/etc.). Accepted
  // values mirror Express's `trust proxy` setting:
  //   unset / "false" / "0"  → off
  //   "true"                 → trust all hops (rarely correct)
  //   integer                → trust N hops
  //   comma-separated list   → trust specific IPs / CIDRs / named ranges
  //                            e.g. "loopback,uniquelocal" or "10.0.0.0/8"
  const trust = parseTrustProxy(process.env.TRUST_PROXY);
  app.set("trust proxy", trust);

  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();

  await app.listen(port, host);
  const log = new Logger("Bootstrap");
  log.log(`CICyberLab api listening on http://${host}:${port}/v1`);
  log.log(`trust proxy: ${describeTrust(trust)}`);
}

function parseTrustProxy(raw: string | undefined): boolean | number | string[] {
  if (raw === undefined) return false;
  const v = raw.trim();
  if (v === "" || v.toLowerCase() === "false" || v === "0") return false;
  if (v.toLowerCase() === "true") return true;
  if (/^\d+$/.test(v)) return Number(v);
  // Comma-separated subnet/IP/range list (Express accepts string or array)
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function describeTrust(t: boolean | number | string[]): string {
  if (t === false) return "off (req.ip is the direct peer)";
  if (t === true) return "ALL hops trusted (only correct if behind a sanitizing proxy)";
  if (typeof t === "number") return `${t} hop(s) trusted`;
  return `trusted ranges: ${t.join(", ")}`;
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
