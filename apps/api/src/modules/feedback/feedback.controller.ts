import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import {
  FeedbackListResponse,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
} from "@ci-train/contracts";
import { FeedbackService } from "./feedback.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";

// User-facing endpoint: post feedback against a scenario by slug.
// Any signed-in user (no role gate beyond the global session
// check) — the solve view is itself behind auth.
@Controller("scenarios")
export class FeedbackSubmitController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post(":slug/feedback")
  @UsePipes(new ZodValidationPipe(SubmitFeedbackRequest))
  async submit(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body() body: SubmitFeedbackRequest,
  ): Promise<SubmitFeedbackResponse> {
    if (!session) throw new UnauthorizedException();
    return this.feedback.submit({
      scenarioSlug: slug,
      userId: session.user.id,
      rating: body.rating,
      body: body.body,
    });
  }
}

// Admin-only listing surface. Controller-level @Roles("admin")
// short-circuits anything that isn't an admin session via the
// global RolesGuard (same pattern as AccessCodesController).
@Controller("admin/feedback")
@Roles("admin")
export class FeedbackAdminController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  async list(
    @Query("limit") limitRaw?: string,
  ): Promise<FeedbackListResponse> {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 200;
    return this.feedback.listAll({
      limit: Number.isFinite(limit) ? limit : 200,
    });
  }
}
