import { Module } from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import {
  FeedbackAdminController,
  FeedbackSubmitController,
} from "./feedback.controller";

@Module({
  controllers: [FeedbackSubmitController, FeedbackAdminController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
