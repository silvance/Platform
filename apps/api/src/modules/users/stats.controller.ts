import { Controller, Get } from "@nestjs/common";
import type { AdminStatsResponse } from "@ci-train/contracts";
import { UsersService } from "./users.service";
import { Roles } from "../auth/decorators/roles.decorator";

// Admin overview stats (M21d). Read-only. Lives on its own
// controller — separate URL prefix from /admin/users keeps the
// REST shape clean and the response shape doesn't share
// write-action concerns with user management.
@Controller("admin/stats")
@Roles("admin")
export class AdminStatsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async get(): Promise<AdminStatsResponse> {
    return this.users.getStats();
  }
}
