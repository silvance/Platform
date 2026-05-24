import { Controller, Get } from "@nestjs/common";
import type { AnalyticsResponse } from "@ci-train/contracts";
import { AnalyticsService } from "./analytics.service";
import { Roles } from "../auth/decorators/roles.decorator";

// admin-only per-scenario / per-question analytics.
// Controller-level @Roles("admin") + the global RolesGuard
// short-circuits anything that isn't an admin session. No
// user-facing endpoint here.

@Controller("admin/analytics")
@Roles("admin")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  async getAll(): Promise<AnalyticsResponse> {
    return this.analytics.getAll();
  }
}
