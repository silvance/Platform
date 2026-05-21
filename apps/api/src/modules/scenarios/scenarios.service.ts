import { Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type {
  ArtifactListItem,
  ScenarioListItem,
  ScenarioListQuery,
  ScenarioDetail,
  ScenarioBriefPayload,
} from "@ci-train/contracts";

// Trainees see only `published` scenarios. Instructors see everything
// (including drafts and archived) — used once the M5 authoring UI lands;
// in M2 instructors and trainees see the same catalog since everything
// is seeded as `published`.
function isTrainee(role: Role): boolean {
  return role === "trainee";
}

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    role: Role,
    query: ScenarioListQuery,
  ): Promise<{ scenarios: ScenarioListItem[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (isTrainee(role)) {
      where["status"] = "published";
    } else if (query.status) {
      where["status"] = query.status;
    } else {
      // Default for instructors: hide archived.
      where["status"] = { in: ["draft", "published"] };
    }

    if (query.skillArea) {
      where["skillAreas"] = { has: query.skillArea };
    }
    if (query.difficulty !== undefined) {
      where["difficulty"] = query.difficulty;
    }
    if (query.tag) {
      where["tags"] = { has: query.tag };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.scenario.findMany({
        where,
        orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      }),
      this.prisma.scenario.count({ where }),
    ]);

    return {
      scenarios: rows.map(toListItem),
      total,
    };
  }

  async getBySlug(role: Role, slug: string): Promise<ScenarioDetail> {
    const row = await this.prisma.scenario.findUnique({
      where: { slug },
      include: {
        brief: true,
        artifacts: { orderBy: { ordinal: "asc" } },
      },
    });
    if (!row) throw new NotFoundException("Scenario not found.");

    // Trainees can only access published scenarios — return 404 (not 403)
    // so the existence of drafts isn't leaked to non-instructor accounts.
    if (isTrainee(role) && row.status !== "published") {
      throw new NotFoundException("Scenario not found.");
    }

    const brief: ScenarioBriefPayload | null = row.brief
      ? {
          markdownBody: row.brief.markdownBody,
          disclaimerMd: row.brief.disclaimerMd ?? null,
        }
      : null;

    const artifacts: ArtifactListItem[] = row.artifacts.map((a) => ({
      id: a.id,
      ordinal: a.ordinal,
      displayName: a.displayName,
      kind: a.kind,
      sha256: a.sha256,
      sizeBytes: a.sizeBytes,
      mimeType: a.mimeType,
      viewerHint: a.viewerHint ?? null,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      ...toListItem(row),
      brief,
      artifacts,
    };
  }
}

type ScenarioRow = Awaited<
  ReturnType<PrismaService["scenario"]["findMany"]>
>[number];

function toListItem(row: ScenarioRow): ScenarioListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    skillAreas: row.skillAreas,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimatedMinutes,
    tags: row.tags,
    status: row.status,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
