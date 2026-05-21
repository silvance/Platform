import { Controller, Get, Inject } from "@nestjs/common";
import type { Pool } from "pg";
import {
  HealthResponse,
  ReadinessResponse,
  ReadinessCheck,
} from "@ci-train/contracts";
import { PG_POOL } from "../database/database.module";

const SERVICE_NAME = "ci-train-api";
const API_VERSION = "0.0.0";

@Controller()
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get("healthz")
  healthz(): HealthResponse {
    return {
      status: "ok",
      service: SERVICE_NAME,
      version: API_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("readyz")
  async readyz(): Promise<ReadinessResponse> {
    const checks: ReadinessCheck[] = [];

    const dbCheck: ReadinessCheck = { name: "postgres", ok: false };
    try {
      const res = await this.pool.query("SELECT 1 AS ok");
      dbCheck.ok = res.rows[0]?.ok === 1;
    } catch (err) {
      dbCheck.ok = false;
      dbCheck.detail = err instanceof Error ? err.message : String(err);
    }
    checks.push(dbCheck);

    return {
      ready: checks.every((c) => c.ok),
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
