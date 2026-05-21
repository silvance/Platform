import {
  Controller,
  Get,
  Param,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ScenarioDetail,
  ScenarioListQuery,
  ScenarioListResponse,
} from "@ci-train/contracts";
import { ScenariosService } from "./scenarios.service";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";

@Controller("scenarios")
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  async list(
    @CurrentSession() session: SessionContext | undefined,
    @Query(new ZodValidationPipe(ScenarioListQuery)) query: ScenarioListQuery,
  ): Promise<ScenarioListResponse> {
    if (!session) throw new UnauthorizedException();
    return this.scenarios.list(session.user.role, query);
  }

  @Get(":slug")
  async getBySlug(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<ScenarioDetail> {
    if (!session) throw new UnauthorizedException();
    return this.scenarios.getBySlug(session.user.role, slug);
  }
}
