import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./modules/database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { HelloModule } from "./modules/hello/hello.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/guards/auth.guard";
import { RolesGuard } from "./modules/auth/guards/roles.guard";
import { ScenariosModule } from "./modules/scenarios/scenarios.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: "default", limit: 60, ttl: 60_000 },
    ]),
    DatabaseModule,
    AuthModule,
    ScenariosModule,
    HealthModule,
    HelloModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
