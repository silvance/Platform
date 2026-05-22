import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { Prisma } from "@prisma/client";
import type { ArtifactKind } from "@prisma/client";
import {
  ImportPackResponse,
  MAX_PACK_BYTES,
  PackArtifact,
  PackManifest,
  PACK_FORMAT,
  PACK_VERSION,
} from "@ci-train/contracts";
import { PrismaService } from "../database/prisma.service";
import {
  ARTIFACT_STORAGE,
} from "../artifacts/storage/storage.module";
import type { ArtifactStorage } from "../artifacts/storage/artifact-storage";

// File extension picked by `kind`. Keeps the on-disk extension off the
// admin-typed displayName the same way the upload path does (PR #16).
function extForKind(kind: ArtifactKind): string {
  switch (kind) {
    case "text": return ".txt";
    case "csv":  return ".csv";
    case "json": return ".json";
    case "pdf":  return ".pdf";
    case "image": return ".img";
    case "eml":  return ".eml";
  }
}

@Injectable()
export class PacksService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStorage,
  ) {}

  // ─── export ──────────────────────────────────────────────────

  async exportScenario(slug: string): Promise<{
    filename: string;
    zipBytes: Buffer;
  }> {
    const scenario = await this.prisma.scenario.findUnique({
      where: { slug },
      include: {
        brief: true,
        artifacts: { orderBy: { ordinal: "asc" } },
        indicatorSets: { orderBy: { displayName: "asc" } },
        questions: {
          orderBy: { ordinal: "asc" },
          include: { answerKey: true, indicatorSet: true },
        },
      },
    });
    if (!scenario) throw new NotFoundException("Scenario not found.");
    if (!scenario.brief) {
      throw new BadRequestException(
        "Scenario has no brief — refusing to export an incomplete scenario.",
      );
    }

    // Mint pack-local artifact IDs once so questions + indicator sets
    // can reference the same ids the artifact entries use. The pack
    // namespace is independent of the deployment's DB ids.
    const packArtifactIdByDbId = new Map<string, string>();
    const zip = new AdmZip();

    const packArtifacts: PackArtifact[] = [];
    for (const a of scenario.artifacts) {
      const packId = randomUUID();
      packArtifactIdByDbId.set(a.id, packId);
      const archivePath = `artifacts/${packId}${extForKind(a.kind)}`;

      // Read the bytes through the storage layer (path-safety enforced)
      // and verify the on-disk sha matches the DB record before
      // bundling. A mismatch means the artifact directory drifted
      // from the DB — refuse to ship a pack that lies about its
      // contents.
      const bytes = await this.readArtifactBytes(a.relativePath);
      const observedSha = createHash("sha256").update(bytes).digest("hex");
      if (observedSha !== a.sha256) {
        throw new BadRequestException({
          message:
            "Artifact bytes don't match the stored sha256 — refusing to export an inconsistent scenario.",
          artifactId: a.id,
        });
      }
      zip.addFile(archivePath, bytes);

      packArtifacts.push({
        packId,
        ordinal: a.ordinal,
        displayName: a.displayName,
        kind: a.kind,
        mimeType: a.mimeType,
        viewerHint: a.viewerHint ?? null,
        sha256: a.sha256,
        sizeBytes: a.sizeBytes,
        archivePath,
      });
    }

    const packIndicatorSets = scenario.indicatorSets.map((s) => {
      const items = parseIndicatorItems(s.itemsJson);
      return {
        slug: s.slug,
        displayName: s.displayName,
        sourcePackArtifactId: s.sourceArtifactId
          ? packArtifactIdByDbId.get(s.sourceArtifactId) ?? null
          : null,
        items,
      };
    });

    const indicatorSetSlugByDbId = new Map<string, string>(
      scenario.indicatorSets.map((s) => [s.id, s.slug]),
    );

    const packQuestions = scenario.questions.map((q) =>
      questionToPack(q, indicatorSetSlugByDbId),
    );

    const manifest: PackManifest = {
      format: PACK_FORMAT,
      version: PACK_VERSION,
      exportedAt: new Date().toISOString(),
      exportedFrom: process.env.PACK_EXPORTED_FROM ?? null,
      scenario: {
        slug: scenario.slug,
        title: scenario.title,
        summary: scenario.summary,
        skillAreas: scenario.skillAreas as never,
        difficulty: scenario.difficulty,
        estimatedMinutes: scenario.estimatedMinutes ?? null,
        tags: scenario.tags,
        brief: {
          markdownBody: scenario.brief.markdownBody,
          disclaimerMd: scenario.brief.disclaimerMd ?? null,
        },
        artifacts: packArtifacts,
        indicatorSets: packIndicatorSets,
        questions: packQuestions,
      },
    };

    // Validate the manifest we built — defense in depth against a bug
    // in the toX helpers above producing something the importer would
    // reject. Cheaper to fail here than to ship a broken pack.
    PackManifest.parse(manifest);

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return {
      filename: `${scenario.slug}-${stamp}.zip`,
      zipBytes: zip.toBuffer(),
    };
  }

  // ─── import ──────────────────────────────────────────────────

  async importPack(
    authorUserId: string,
    zipBytes: Buffer,
  ): Promise<ImportPackResponse> {
    if (zipBytes.length > MAX_PACK_BYTES) {
      throw new BadRequestException(
        `Pack exceeds the size limit (${MAX_PACK_BYTES} bytes).`,
      );
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBytes);
    } catch (err) {
      throw new BadRequestException(
        `Pack is not a valid ZIP archive: ${(err as Error).message}`,
      );
    }

    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      throw new BadRequestException("Pack is missing manifest.json.");
    }
    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(manifestEntry.getData().toString("utf-8"));
    } catch (err) {
      throw new BadRequestException(
        `manifest.json is not valid JSON: ${(err as Error).message}`,
      );
    }
    const manifest = PackManifest.safeParse(manifestRaw);
    if (!manifest.success) {
      throw new BadRequestException({
        message: "manifest.json failed validation.",
        issues: manifest.error.issues,
      });
    }
    const m = manifest.data;
    if (m.format !== PACK_FORMAT || m.version !== PACK_VERSION) {
      throw new BadRequestException(
        `Unsupported pack format/version (${m.format} v${m.version}). Expected ${PACK_FORMAT} v${PACK_VERSION}.`,
      );
    }

    // Cross-reference checks. Done up front so we never start writing
    // and then discover the pack is internally inconsistent.
    const packArtifactIds = new Set(
      m.scenario.artifacts.map((a) => a.packId),
    );
    for (const s of m.scenario.indicatorSets) {
      if (
        s.sourcePackArtifactId &&
        !packArtifactIds.has(s.sourcePackArtifactId)
      ) {
        throw new BadRequestException(
          `Indicator set "${s.slug}" references an unknown sourcePackArtifactId.`,
        );
      }
      const ids = new Set(s.items.map((i) => i.id));
      if (ids.size !== s.items.length) {
        throw new BadRequestException(
          `Indicator set "${s.slug}" has duplicate item ids.`,
        );
      }
    }
    const setSlugs = new Set(m.scenario.indicatorSets.map((s) => s.slug));
    for (const q of m.scenario.questions) {
      if (q.type === "select_indicators") {
        if (!setSlugs.has(q.indicatorSetSlug)) {
          throw new BadRequestException(
            `Question ${q.ordinal} references unknown indicator set "${q.indicatorSetSlug}".`,
          );
        }
        const set = m.scenario.indicatorSets.find(
          (s) => s.slug === q.indicatorSetSlug,
        );
        const itemIds = new Set(set!.items.map((i) => i.id));
        const unknown = q.correctIds.filter((id) => !itemIds.has(id));
        if (unknown.length > 0) {
          throw new BadRequestException({
            message: `Question ${q.ordinal}: correctIds reference unknown indicator items.`,
            unknown,
          });
        }
      }
      if (q.type === "multi_choice") {
        const optionIds = new Set(q.options.map((o) => o.id));
        const unknown = q.correctIds.filter((id) => !optionIds.has(id));
        if (unknown.length > 0) {
          throw new BadRequestException({
            message: `Question ${q.ordinal}: correctIds reference unknown option ids.`,
            unknown,
          });
        }
      }
    }

    // Pre-flight per-artifact: archive path is inside `artifacts/`,
    // entry exists, sha256 matches.
    const artifactBytesByPackId = new Map<string, Buffer>();
    for (const a of m.scenario.artifacts) {
      if (!a.archivePath.startsWith("artifacts/") || a.archivePath.includes("..")) {
        throw new BadRequestException(
          `Artifact ${a.packId}: archivePath must be under "artifacts/" and contain no parent-traversal segments.`,
        );
      }
      const entry = zip.getEntry(a.archivePath);
      if (!entry) {
        throw new BadRequestException(
          `Pack is missing artifact bytes for ${a.packId} (${a.archivePath}).`,
        );
      }
      const bytes = entry.getData();
      const observedSha = createHash("sha256").update(bytes).digest("hex");
      if (observedSha !== a.sha256) {
        throw new BadRequestException(
          `Artifact ${a.packId}: sha256 mismatch (declared ${a.sha256.slice(0, 12)}…, observed ${observedSha.slice(0, 12)}…).`,
        );
      }
      if (bytes.length !== a.sizeBytes) {
        throw new BadRequestException(
          `Artifact ${a.packId}: sizeBytes mismatch (declared ${a.sizeBytes}, observed ${bytes.length}).`,
        );
      }
      artifactBytesByPackId.set(a.packId, bytes);
    }

    // Refuse to overwrite an existing slug. Implicit overwrites are
    // a foot-gun; the admin can delete first if they want.
    const existing = await this.prisma.scenario.findUnique({
      where: { slug: m.scenario.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `A scenario with slug "${m.scenario.slug}" already exists. Delete it first or rename the pack.`,
      );
    }

    // Write the bytes first; we get scenarioId after the row is
    // created so the storage path mirrors the upload convention
    // (scenarios/<scenarioId>/<uuid><ext>). Track everything we
    // wrote so a partial failure can unwind.
    const writtenPaths: string[] = [];
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const scenarioRow = await tx.scenario.create({
          data: {
            slug: m.scenario.slug,
            title: m.scenario.title,
            summary: m.scenario.summary,
            skillAreas: m.scenario.skillAreas as never,
            difficulty: m.scenario.difficulty,
            estimatedMinutes: m.scenario.estimatedMinutes ?? null,
            tags: m.scenario.tags,
            // Imported scenarios start as drafts; admins flip to
            // published explicitly after a smoke test on the new
            // deployment.
            status: "draft",
            source: "imported",
            authorUserId,
            brief: {
              create: {
                markdownBody: m.scenario.brief.markdownBody,
                disclaimerMd: m.scenario.brief.disclaimerMd,
              },
            },
          },
        });

        // Artifacts: mint fresh server-side ids; write bytes through
        // storage; record paths so the rollback path can unlink them
        // if the tx aborts.
        const newArtifactIdByPackId = new Map<string, string>();
        for (const a of m.scenario.artifacts) {
          const newId = randomUUID();
          newArtifactIdByPackId.set(a.packId, newId);
          const relativePath = join(
            "scenarios",
            scenarioRow.id,
            `${newId}${extForKind(a.kind)}`,
          );
          const bytes = artifactBytesByPackId.get(a.packId)!;
          await this.storage.write(relativePath, bytes);
          writtenPaths.push(relativePath);

          await tx.artifact.create({
            data: {
              id: newId,
              scenarioId: scenarioRow.id,
              ordinal: a.ordinal,
              displayName: a.displayName,
              kind: a.kind,
              relativePath,
              sha256: a.sha256,
              sizeBytes: a.sizeBytes,
              mimeType: a.mimeType,
              viewerHint: a.viewerHint,
            },
          });
        }

        // Indicator sets — by slug. The setSlugBySlug-on-import map
        // gives us a stable handle for the question loop.
        const setIdBySlug = new Map<string, string>();
        for (const s of m.scenario.indicatorSets) {
          const sourceArtifactId = s.sourcePackArtifactId
            ? newArtifactIdByPackId.get(s.sourcePackArtifactId) ?? null
            : null;
          const created = await tx.indicatorSet.create({
            data: {
              scenarioId: scenarioRow.id,
              slug: s.slug,
              displayName: s.displayName,
              sourceArtifactId,
              itemsJson: s.items as never,
            },
          });
          setIdBySlug.set(s.slug, created.id);
        }

        // Questions + answer keys.
        let artifactsImported = m.scenario.artifacts.length;
        let setsImported = m.scenario.indicatorSets.length;
        let questionsImported = 0;
        for (const q of m.scenario.questions) {
          const { optionsJson, expectedJson, debriefMd, indicatorSetId } =
            packQuestionToDb(q, setIdBySlug);
          const created = await tx.question.create({
            data: {
              scenarioId: scenarioRow.id,
              ordinal: q.ordinal,
              type: q.type,
              promptMd: q.promptMd,
              weight: q.weight,
              optionsJson: (optionsJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              indicatorSetId,
              answerKey: {
                create: {
                  expectedJson: expectedJson as Prisma.InputJsonValue,
                  debriefMd,
                },
              },
            },
          });
          void created;
          questionsImported++;
        }

        return {
          slug: scenarioRow.slug,
          scenarioId: scenarioRow.id,
          artifactsImported,
          indicatorSetsImported: setsImported,
          questionsImported,
        };
      });
      return ImportPackResponse.parse(result);
    } catch (err) {
      // Roll back bytes on tx failure.
      for (const p of writtenPaths) {
        await this.storage.remove(p);
      }
      throw err;
    }
  }

  private async readArtifactBytes(relativePath: string): Promise<Buffer> {
    const stream = await this.storage.read(relativePath);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ─── helpers ──────────────────────────────────────────────────

function parseIndicatorItems(
  raw: unknown,
): Array<{ id: string; label: string; evidenceRef?: string | null }> {
  const items = (raw as { items?: unknown } | null)?.items ?? raw;
  if (!Array.isArray(items)) return [];
  return items as Array<{ id: string; label: string; evidenceRef?: string | null }>;
}

interface DbQuestionRow {
  type: string;
  ordinal: number;
  promptMd: string;
  weight: number;
  optionsJson: unknown;
  indicatorSetId: string | null;
  answerKey: { expectedJson: unknown; debriefMd: string } | null;
}

function questionToPack(
  q: DbQuestionRow,
  indicatorSetSlugByDbId: Map<string, string>,
): import("@ci-train/contracts").PackQuestion {
  const debriefMd = q.answerKey?.debriefMd ?? "_No debrief authored._";
  if (q.type === "multi_choice") {
    const opts = q.optionsJson as
      | { options?: unknown; allowMultiple?: unknown }
      | null;
    const exp = q.answerKey?.expectedJson as
      | { correctIds?: unknown }
      | null;
    return {
      type: "multi_choice",
      ordinal: q.ordinal,
      promptMd: q.promptMd,
      weight: q.weight,
      debriefMd,
      options: Array.isArray(opts?.options) ? (opts!.options as never) : [],
      allowMultiple: Boolean(opts?.allowMultiple),
      correctIds: Array.isArray(exp?.correctIds)
        ? (exp!.correctIds as string[])
        : [],
    };
  }
  if (q.type === "confidence") {
    const exp = q.answerKey?.expectedJson as
      | { expectedRange?: unknown }
      | null;
    const r = Array.isArray(exp?.expectedRange)
      ? (exp!.expectedRange as unknown[])
      : null;
    const lo = typeof r?.[0] === "number" ? (r[0] as number) : 3;
    const hi = typeof r?.[1] === "number" ? (r[1] as number) : 3;
    return {
      type: "confidence",
      ordinal: q.ordinal,
      promptMd: q.promptMd,
      weight: q.weight,
      debriefMd,
      expectedRange: [lo, hi],
    };
  }
  if (q.type === "text_match") {
    const opts = q.optionsJson as
      | {
          caseSensitive?: unknown;
          normalizeWhitespace?: unknown;
          regex?: unknown;
          hint?: unknown;
          hintAfterTries?: unknown;
        }
      | null;
    const exp = q.answerKey?.expectedJson as
      | { acceptableAnswers?: unknown }
      | null;
    return {
      type: "text_match",
      ordinal: q.ordinal,
      promptMd: q.promptMd,
      weight: q.weight,
      debriefMd,
      acceptableAnswers: Array.isArray(exp?.acceptableAnswers)
        ? (exp!.acceptableAnswers as string[])
        : [],
      caseSensitive: Boolean(opts?.caseSensitive),
      normalizeWhitespace: opts?.normalizeWhitespace !== false,
      regex: Boolean(opts?.regex),
      hint: typeof opts?.hint === "string" ? opts!.hint : null,
      hintAfterTries:
        typeof opts?.hintAfterTries === "number"
          ? (opts!.hintAfterTries as number)
          : 3,
    };
  }
  // select_indicators
  if (!q.indicatorSetId) {
    throw new Error(
      "select_indicators question has no indicator_set_id — corrupted scenario.",
    );
  }
  const slug = indicatorSetSlugByDbId.get(q.indicatorSetId);
  if (!slug) {
    throw new Error(
      `select_indicators question references unknown indicator set ${q.indicatorSetId}.`,
    );
  }
  const exp = q.answerKey?.expectedJson as
    | { correctIds?: unknown }
    | null;
  return {
    type: "select_indicators",
    ordinal: q.ordinal,
    promptMd: q.promptMd,
    weight: q.weight,
    debriefMd,
    indicatorSetSlug: slug,
    correctIds: Array.isArray(exp?.correctIds)
      ? (exp!.correctIds as string[])
      : [],
  };
}

function packQuestionToDb(
  q: import("@ci-train/contracts").PackQuestion,
  setIdBySlug: Map<string, string>,
): {
  optionsJson: unknown | null;
  expectedJson: unknown;
  debriefMd: string;
  indicatorSetId: string | null;
} {
  if (q.type === "multi_choice") {
    return {
      optionsJson: { options: q.options, allowMultiple: q.allowMultiple },
      expectedJson: {
        type: "multi_choice",
        correctIds: q.correctIds,
        allowMultiple: q.allowMultiple,
      },
      debriefMd: q.debriefMd,
      indicatorSetId: null,
    };
  }
  if (q.type === "confidence") {
    return {
      optionsJson: null,
      expectedJson: { type: "confidence", expectedRange: q.expectedRange },
      debriefMd: q.debriefMd,
      indicatorSetId: null,
    };
  }
  if (q.type === "text_match") {
    return {
      optionsJson: {
        caseSensitive: q.caseSensitive,
        normalizeWhitespace: q.normalizeWhitespace,
        regex: q.regex,
        hint: q.hint,
        hintAfterTries: q.hintAfterTries,
      },
      expectedJson: {
        type: "text_match",
        acceptableAnswers: q.acceptableAnswers,
        regex: q.regex,
      },
      debriefMd: q.debriefMd,
      indicatorSetId: null,
    };
  }
  // select_indicators
  const setId = setIdBySlug.get(q.indicatorSetSlug);
  if (!setId) {
    throw new Error(
      `Indicator set "${q.indicatorSetSlug}" not found (manifest cross-ref failed).`,
    );
  }
  return {
    optionsJson: null,
    expectedJson: { type: "select_indicators", correctIds: q.correctIds },
    debriefMd: q.debriefMd,
    indicatorSetId: setId,
  };
}
