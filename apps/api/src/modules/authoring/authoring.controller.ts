import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AdminScenarioDetail,
  AdminScenarioListResponse,
  AdminScenarioSummary,
  AuthoredQuestion,
  CreateQuestionRequest,
  CreateScenarioRequest,
  UpdateQuestionRequest,
  UpdateScenarioRequest,
} from "@ci-train/contracts";
import { AuthoringService } from "./authoring.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";

// Admin/maintainer-only surface. All routes guarded at the controller
// level by `@Roles("instructor")` — the project's role rename to
// admin/maintainer is a separate scope, so we still use the existing
// enum value here.
@Controller("admin/challenges")
@Roles("instructor")
export class AuthoringController {
  constructor(private readonly authoring: AuthoringService) {}

  @Get()
  async list(): Promise<AdminScenarioListResponse> {
    const scenarios = await this.authoring.list();
    return { scenarios };
  }

  @Get(":slug")
  async getOne(
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<AdminScenarioDetail> {
    return this.authoring.getDetail(slug);
  }

  @Post()
  async create(
    @CurrentSession() session: SessionContext | undefined,
    @Body(new ZodValidationPipe(CreateScenarioRequest))
    body: CreateScenarioRequest,
  ): Promise<AdminScenarioSummary> {
    if (!session) throw new UnauthorizedException();
    return this.authoring.create(session.user.id, body);
  }

  @Patch(":slug")
  async update(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body(new ZodValidationPipe(UpdateScenarioRequest))
    body: UpdateScenarioRequest,
  ): Promise<AdminScenarioSummary> {
    return this.authoring.update(slug, body);
  }

  @Delete(":slug")
  @HttpCode(204)
  async remove(
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<void> {
    await this.authoring.remove(slug);
  }

  @Post(":slug/questions")
  async addQuestion(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Body(new ZodValidationPipe(CreateQuestionRequest))
    body: CreateQuestionRequest,
  ): Promise<AuthoredQuestion> {
    return this.authoring.addQuestion(slug, body);
  }

  @Patch(":slug/questions/:questionId")
  async updateQuestion(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" }))
    questionId: string,
    @Body(new ZodValidationPipe(UpdateQuestionRequest))
    body: UpdateQuestionRequest,
  ): Promise<AuthoredQuestion> {
    return this.authoring.updateQuestion(slug, questionId, body);
  }

  @Delete(":slug/questions/:questionId")
  @HttpCode(204)
  async removeQuestion(
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("questionId", new ParseUUIDPipe({ version: "4" }))
    questionId: string,
  ): Promise<void> {
    await this.authoring.removeQuestion(slug, questionId);
  }
}
