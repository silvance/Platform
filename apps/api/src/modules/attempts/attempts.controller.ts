import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
  UsePipes,
} from "@nestjs/common";
import {
  AttemptPayload,
  DebriefPayload,
  AttemptAnswerPayload,
  SaveAnswerRequest,
} from "@ci-train/contracts";
import { AttemptsService } from "./attempts.service";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

@Controller()
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  // POST /v1/scenarios/:slug/attempts — start (or return existing) attempt.
  @Post("scenarios/:slug/attempts")
  @HttpCode(HttpStatus.OK)
  async start(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<AttemptPayload> {
    if (!session) throw new UnauthorizedException();
    return this.attempts.startOrGet(session.user.role, session.user.id, slug);
  }

  // GET /v1/attempts/:id
  @Get("attempts/:id")
  async getAttempt(
    @CurrentSession() session: SessionContext | undefined,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<AttemptPayload> {
    if (!session) throw new UnauthorizedException();
    return this.attempts.get(session.user.role, session.user.id, id);
  }

  // PATCH /v1/attempts/:id/answers/:questionId — autosave one answer.
  @Patch("attempts/:id/answers/:questionId")
  @UsePipes()
  async saveAnswer(
    @CurrentSession() session: SessionContext | undefined,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" })) questionId: string,
    @Body(new ZodValidationPipe(SaveAnswerRequest)) body: SaveAnswerRequest,
  ): Promise<AttemptAnswerPayload> {
    if (!session) throw new UnauthorizedException();
    return this.attempts.saveAnswer(
      session.user.role,
      session.user.id,
      id,
      questionId,
      body,
    );
  }

  // POST /v1/attempts/:id/submit — locks the attempt + computes auto-grades.
  @Post("attempts/:id/submit")
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentSession() session: SessionContext | undefined,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<AttemptPayload> {
    if (!session) throw new UnauthorizedException();
    return this.attempts.submit(session.user.role, session.user.id, id);
  }

  // GET /v1/attempts/:id/debrief — only after submit.
  @Get("attempts/:id/debrief")
  async getDebrief(
    @CurrentSession() session: SessionContext | undefined,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ): Promise<DebriefPayload> {
    if (!session) throw new UnauthorizedException();
    return this.attempts.getDebrief(session.user.role, session.user.id, id);
  }
}
