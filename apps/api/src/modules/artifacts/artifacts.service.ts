import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import type { Readable } from "node:stream";
import { safeServeMimeFor } from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import {
  ARTIFACT_STORAGE,
} from "./storage/storage.module";
import type { ArtifactStorage } from "./storage/artifact-storage";

export interface ArtifactStreamResult {
  stream: Readable;
  // Canonical, *kind-derived* Content-Type that the controller serves.
  // Independent of the DB's `mime_type` column so a stale/imported/
  // malicious row (e.g. `text/html` recorded under kind=text) cannot
  // get a renderable MIME past the API.
  mimeType: string;
  sizeBytes: number;
  displayName: string;
  // `inline` is reserved for PDF and images whose stored MIME is in
  // the allowlist. Anything else is served as an attachment so the
  // browser does not try to render it.
  contentDisposition: "inline" | "attachment";
  sha256: string;
  // The MIME stored in the DB (echoed back for debug/audit; not used
  // for Content-Type).
  storedMimeType: string;
}

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStorage,
  ) {}

  // Returns null when the caller may not see it. The controller maps that
  // to 404 (not 403) so trainees can't probe for the existence of draft-
  // scenario artifacts.
  async streamArtifact(
    role: Role,
    scenarioSlug: string,
    artifactId: string,
  ): Promise<ArtifactStreamResult | null> {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      include: {
        scenario: { select: { slug: true, status: true } },
      },
    });
    if (!artifact) return null;
    if (artifact.scenario.slug !== scenarioSlug) return null;
    if (role === "trainee" && artifact.scenario.status !== "published") {
      return null;
    }

    if (!(await this.storage.exists(artifact.relativePath))) {
      throw new NotFoundException("Artifact bytes not found on disk.");
    }

    const { mime, inline } = safeServeMimeFor(artifact.kind, artifact.mimeType);
    const stream = await this.storage.read(artifact.relativePath);

    return {
      stream,
      mimeType: mime,
      sizeBytes: artifact.sizeBytes,
      displayName: artifact.displayName,
      contentDisposition: inline ? "inline" : "attachment",
      sha256: artifact.sha256,
      storedMimeType: artifact.mimeType,
    };
  }
}
