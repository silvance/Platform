import { Global, Inject, Logger, Module, OnModuleDestroy } from "@nestjs/common";
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
          new Logger("DatabaseModule").warn(
            "DATABASE_URL not set — readiness checks will report DB as down.",
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
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.log("Postgres pool closed.");
    } catch (err) {
      this.logger.error("Error closing Postgres pool", err as Error);
    }
  }
}
