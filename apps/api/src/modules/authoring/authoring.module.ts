import { Module } from "@nestjs/common";
import { AuthoringService } from "./authoring.service";
import { AuthoringController } from "./authoring.controller";
import { PacksService } from "./packs.service";

@Module({
  providers: [AuthoringService, PacksService],
  controllers: [AuthoringController],
  exports: [AuthoringService, PacksService],
})
export class AuthoringModule {}
