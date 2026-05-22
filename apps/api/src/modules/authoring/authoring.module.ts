import { Module } from "@nestjs/common";
import { AuthoringService } from "./authoring.service";
import { AuthoringController } from "./authoring.controller";

@Module({
  providers: [AuthoringService],
  controllers: [AuthoringController],
  exports: [AuthoringService],
})
export class AuthoringModule {}
