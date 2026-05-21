import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./modules/health/health.module";
import { HelloModule } from "./modules/hello/hello.module";
import { DatabaseModule } from "./modules/database/database.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    HelloModule,
  ],
})
export class AppModule {}
