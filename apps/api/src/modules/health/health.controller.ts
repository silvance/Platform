import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  HealthResponse,
  ReadinessResponse,
  ReadinessCheck,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import { Public } from "../auth/decorators/public.decorator";

const SERVICE_NAME = "cicyberlab-api";
const API_VERSION = "0.1.0";

@Public()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
  async readyz(
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReadinessResponse> {
    const checks: ReadinessCheck[] = [];

    const dbCheck: ReadinessCheck = { name: "postgres", ok: false };
    try {
      const rows = await this.prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
      dbCheck.ok = rows[0]?.ok === 1;
    } catch (err) {
      dbCheck.ok = false;
      dbCheck.detail = err instanceof Error ? err.message : String(err);
    }
    checks.push(dbCheck);

    const ready = checks.every((c) => c.ok);
    res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      ready,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
