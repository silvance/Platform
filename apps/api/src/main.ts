import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number(process.env.API_PORT ?? 4000);

  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();

  await app.listen(port, host);
  new Logger("Bootstrap").log(`ci-train api listening on http://${host}:${port}/v1`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
