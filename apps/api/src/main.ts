import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number(process.env.API_PORT ?? 4000);

  // Behind the web BFF or any reverse proxy, trust X-Forwarded-* so req.ip
  // reflects the real client address rather than the proxy's.
  app.set("trust proxy", 1);

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
