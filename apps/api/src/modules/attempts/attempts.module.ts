import { Module } from "@nestjs/common";
import { ProgressService } from "./progress.service";
import { ProgressController } from "./progress.controller";
import { GradingService } from "./grading.service";
import { MeStatsService } from "./me-stats.service";

// Module name keeps "Attempts" historically but the M7 surface is
// challenge-mode progress, not multi-question submitted attempts.
@Module({
  providers: [ProgressService, GradingService, MeStatsService],
  controllers: [ProgressController],
  exports: [ProgressService, GradingService, MeStatsService],
})
export class AttemptsModule {}
