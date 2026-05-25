import { Controller, Get, Query } from "@nestjs/common";
import {
  AdminListQuery,
  type CompletionListResponse,
} from "@ci-train/contracts";
import { CompletionsService } from "./completions.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

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
    @Query(new ZodValidationPipe(AdminListQuery))
    query: AdminListQuery,
  ): Promise<CompletionListResponse> {
    return this.completions.listRecent({ limit: query.limit });
  }
}
