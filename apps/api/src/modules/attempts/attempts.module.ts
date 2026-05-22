import { Module } from "@nestjs/common";
import { ProgressService } from "./progress.service";
import { ProgressController } from "./progress.controller";
import { GradingService } from "./grading.service";

// Module name keeps "Attempts" historically but the M7 surface is
// challenge-mode progress, not multi-question submitted attempts.
@Module({
  providers: [ProgressService, GradingService],
  controllers: [ProgressController],
  exports: [ProgressService, GradingService],
})
export class AttemptsModule {}
