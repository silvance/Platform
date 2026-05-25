import { Controller, Get, Query } from "@nestjs/common";
import type { CompletionListResponse } from "@ci-train/contracts";
import { CompletionsService } from "./completions.service";
import { Roles } from "../auth/decorators/roles.decorator";

// admin-only recent-completions feed. Newest first across the
// whole catalogue. Lives alongside AnalyticsController in the
// same module because it reads the same ScenarioProgress +
// QuestionResponse tables for the same operator surface.
@Controller("admin/completions")
@Roles("admin")
export class CompletionsController {
  constructor(private readonly completions: CompletionsService) {}

  @Get()
  async list(
    @Query("limit") limitRaw?: string,
  ): Promise<CompletionListResponse> {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 200;
    return this.completions.listRecent({
      limit: Number.isFinite(limit) ? limit : 200,
    });
  }
}
