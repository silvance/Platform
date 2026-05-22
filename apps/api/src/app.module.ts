import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { BffForwardedThrottlerGuard } from "./common/bff-forwarded-throttler.guard";
import { DatabaseModule } from "./modules/database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { HelloModule } from "./modules/hello/hello.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/guards/auth.guard";
import { RolesGuard } from "./modules/auth/guards/roles.guard";
import { UsersModule } from "./modules/users/users.module";
import { ScenariosModule } from "./modules/scenarios/scenarios.module";
import { ArtifactsModule } from "./modules/artifacts/artifacts.module";
import { AttemptsModule } from "./modules/attempts/attempts.module";
import { AuthoringModule } from "./modules/authoring/authoring.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: "default", limit: 60, ttl: 60_000 },
    ]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    ScenariosModule,
    ArtifactsModule,
    AttemptsModule,
    AuthoringModule,
    HealthModule,
    HelloModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: BffForwardedThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
