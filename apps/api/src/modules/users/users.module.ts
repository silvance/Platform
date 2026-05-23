import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AdminStatsController } from "./stats.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [UsersController, AdminStatsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
