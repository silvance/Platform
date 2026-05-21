import { Global, Module, OnModuleDestroy, Logger } from "@nestjs/common";
import { Pool } from "pg";

export const PG_POOL = Symbol("PG_POOL");

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          Logger.warn(
            "DATABASE_URL not set — readiness checks will report DB as down.",
            "DatabaseModule",
          );
        }
        return new Pool({
          connectionString,
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor() {}
  async onModuleDestroy(): Promise<void> {
    // Pool cleanup happens via app shutdown hooks; pg manages its own lifecycle.
  }
}
