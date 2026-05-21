import { Inject, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import type { Readable } from "node:stream";
import { ParsedEmlPayload, safeServeMimeFor } from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import {
  ARTIFACT_STORAGE,
} from "./storage/storage.module";
import type { ArtifactStorage } from "./storage/artifact-storage";
import { EmlParseService } from "./eml-parse.service";

export interface ArtifactStreamResult {
  stream: Readable;
  mimeType: string;
  sizeBytes: number;
  displayName: string;
  contentDisposition: "inline" | "attachment";
  sha256: string;
  storedMimeType: string;
}

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStorage,
    private readonly emlParse: EmlParseService,
  ) {}

  // Returns null when the caller may not see it. The controller maps that
  // to 404 (not 403) so trainees can't probe for the existence of draft-
  // scenario artifacts.
  async streamArtifact(
    role: Role,
    scenarioSlug: string,
    artifactId: string,
  ): Promise<ArtifactStreamResult | null> {
    const artifact = await this.findVisibleArtifact(role, scenarioSlug, artifactId);
    if (!artifact) return null;

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

  // Returns the parsed EML view for a kind=eml artifact, or null when
  // the caller may not see it. Throws BadRequest when the artifact is
  // a different kind (callers should dispatch by kind on the client).
  async parseEml(
    role: Role,
    scenarioSlug: string,
    artifactId: string,
  ): Promise<ParsedEmlPayload | null> {
    const artifact = await this.findVisibleArtifact(role, scenarioSlug, artifactId);
    if (!artifact) return null;
    if (artifact.kind !== "eml") {
      throw new BadRequestException(
        "Parsed view is only available for EML artifacts.",
      );
    }
    if (!(await this.storage.exists(artifact.relativePath))) {
      throw new NotFoundException("Artifact bytes not found on disk.");
    }
    const stream = await this.storage.read(artifact.relativePath);
    return this.emlParse.parse(stream);
  }

  // Shared lookup that applies the same role / slug / draft-leak rules
  // both endpoints rely on.
  private async findVisibleArtifact(
    role: Role,
    scenarioSlug: string,
    artifactId: string,
  ) {
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
    return artifact;
  }
}
