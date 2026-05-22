import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ScenarioProgressPayload,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from "@ci-train/contracts";
import { ProgressService } from "./progress.service";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";

@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  // GET /v1/scenarios/:slug/progress — caller's per-question state.
  @Get("scenarios/:slug/progress")
  async get(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<ScenarioProgressPayload> {
    if (!session) throw new UnauthorizedException();
    return this.progress.getProgress(session.user.role, session.user.id, slug);
  }

  // POST /v1/scenarios/:slug/questions/:questionId/submit
  @Post("scenarios/:slug/questions/:questionId/submit")
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" })) questionId: string,
    @Body(new ZodValidationPipe(SubmitAnswerRequest)) body: SubmitAnswerRequest,
  ): Promise<SubmitAnswerResponse> {
    if (!session) throw new UnauthorizedException();
    return this.progress.submit(
      session.user.role,
      session.user.id,
      slug,
      questionId,
      body,
    );
  }
}
