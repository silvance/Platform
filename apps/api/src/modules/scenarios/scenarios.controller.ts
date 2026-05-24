import {
  Controller,
  Get,
  Param,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import {
  LaneOverviewResponse,
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
    return this.scenarios.list(session.user.role, session.user.id, query);
  }

 // lane overview. Routed under /scenarios/lanes so it sits
  // logically beside the /scenarios catalogue without colliding
  // with the /scenarios/:slug route (NestJS sees "lanes" as a
  // literal segment, not a slug param). Returns one summary row
  // per Lane enum value with counts + the actor's progress.
  @Get("lanes")
  async lanes(
    @CurrentSession() session: SessionContext | undefined,
  ): Promise<LaneOverviewResponse> {
    if (!session) throw new UnauthorizedException();
    return this.scenarios.laneOverview(session.user.role, session.user.id);
  }

  @Get(":slug")
  async getBySlug(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
  ): Promise<ScenarioDetail> {
    if (!session) throw new UnauthorizedException();
    return this.scenarios.getBySlug(session.user.role, session.user.id, slug);
  }
}
