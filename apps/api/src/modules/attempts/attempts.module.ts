import { Module } from "@nestjs/common";
import { AttemptsService } from "./attempts.service";
import { AttemptsController } from "./attempts.controller";
import { GradingService } from "./grading.service";

@Module({
  providers: [AttemptsService, GradingService],
  controllers: [AttemptsController],
  exports: [AttemptsService, GradingService],
})
export class AttemptsModule {}
