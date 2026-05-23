import { Module } from "@nestjs/common";
import { AccessCodesService } from "./access-codes.service";
import { AccessCodesController } from "./access-codes.controller";

// Deliberately does NOT import AuthModule — AccessCodesService
// only depends on the global PrismaService. AuthModule imports
// THIS module to wire AccessCodesService into AuthService's
// register() path; keeping the dependency one-way avoids a
// circular module reference.
@Module({
  controllers: [AccessCodesController],
  providers: [AccessCodesService],
  exports: [AccessCodesService],
})
export class AccessCodesModule {}
