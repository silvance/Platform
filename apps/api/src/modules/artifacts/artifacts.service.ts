import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import type { Readable } from "node:stream";
import { PrismaService } from "../database/prisma.service";
import {
  ARTIFACT_STORAGE,
} from "./storage/storage.module";
import type { ArtifactStorage } from "./storage/artifact-storage";

export interface ArtifactStreamResult {
  stream: Readable;
  mimeType: string;
  sizeBytes: number;
  displayName: string;
  // pdf + image render inline; everything else downloads to be safe.
  contentDisposition: "inline" | "attachment";
  sha256: string;
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

    const stream = await this.storage.read(artifact.relativePath);
    const contentDisposition: "inline" | "attachment" =
      artifact.kind === "pdf" || artifact.kind === "image" ? "inline" : "attachment";

    return {
      stream,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      displayName: artifact.displayName,
      contentDisposition,
      sha256: artifact.sha256,
    };
  }
}
