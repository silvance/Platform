import {
  Controller,
  Get,
  Header,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { ArtifactsService } from "./artifacts.service";
import { CurrentSession } from "../auth/decorators/current-user.decorator";
import type { SessionContext } from "../auth/auth.service";
import { ScenarioSlugPipe } from "../../common/scenario-slug.pipe";

@Controller("scenarios/:slug/artifacts")
export class ArtifactsController {
  private readonly logger = new Logger(ArtifactsController.name);

  constructor(private readonly artifacts: ArtifactsService) {}

  // Strict CSP on rendered artifacts. We never want a PDF or image to
  // load external resources or execute scripts; the X-Content-Type-Options
  // header prevents MIME-sniffing tricks.
  @Get(":id/content")
  @Header("X-Content-Type-Options", "nosniff")
  @Header(
    "Content-Security-Policy",
    "default-src 'none'; img-src 'self'; object-src 'self'; frame-ancestors 'self'; sandbox",
  )
  async stream(
    @CurrentSession() session: SessionContext | undefined,
    @Param("slug", ScenarioSlugPipe) slug: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!session) throw new UnauthorizedException();

    const result = await this.artifacts.streamArtifact(
      session.user.role,
      slug,
      id,
    );
    if (!result) throw new NotFoundException("Artifact not found.");

    const filenameSafe = result.displayName.replace(/[^\w.\-]/g, "_");
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Length", String(result.sizeBytes));
    res.setHeader(
      "Content-Disposition",
      `${result.contentDisposition}; filename="${filenameSafe}"`,
    );
    // Useful for clients to verify they got the bytes the DB recorded.
    res.setHeader("ETag", `"sha256-${result.sha256}"`);

    result.stream.on("error", (err) => {
      this.logger.error(
        `artifact stream error: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      if (!res.headersSent) {
        res.status(500).json({ message: "Artifact stream error." });
      } else {
        res.destroy(err);
      }
    });
    result.stream.pipe(res);
  }
}
