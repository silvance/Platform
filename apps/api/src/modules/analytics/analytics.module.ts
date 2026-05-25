import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { CompletionsService } from "./completions.service";
import { CompletionsController } from "./completions.controller";

// Self-contained admin analytics module. PrismaService is global
// so no DatabaseModule import is needed.
//
// Hosts both the aggregate analytics surface (/admin/analytics)
// and the recent-completions feed (/admin/completions). They read
// the same ScenarioProgress + QuestionResponse tables — keeping
// them in one module avoids duplicate Prisma plumbing.
@Module({
  controllers: [AnalyticsController, CompletionsController],
  providers: [AnalyticsService, CompletionsService],
})
export class AnalyticsModule {}
