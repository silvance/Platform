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

// Non-admin users see only `published` scenarios. Admins see
// everything (including drafts and archived). Same catalog endpoint
// serves both — role just narrows the where-clause.
function isNonAdmin(role: Role): boolean {
  return role === "user";
}

@Injectable()
export class ScenariosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    role: Role,
    actorUserId: string,
    query: ScenarioListQuery,
  ): Promise<{ scenarios: ScenarioListItem[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (isNonAdmin(role)) {
      where["status"] = "published";
    } else if (query.status) {
      where["status"] = query.status;
    } else {
      // Default for admins: hide archived.
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

    // M22: pull the actor's progress rows in parallel with the
    // scenario list. ScenarioProgress already denormalises both
    // counters per (scenario, user) so we don't need to aggregate
    // QuestionResponse here. Scenarios the actor has never started
    // simply won't have a row in `progressRows` — we default to
    // (0, questionCount) for those.
    const [rows, total, progressRows] = await this.prisma.$transaction([
      this.prisma.scenario.findMany({
        where,
        orderBy: [{ difficulty: "asc" }, { title: "asc" }],
        include: {
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.scenario.count({ where }),
      this.prisma.scenarioProgress.findMany({
        where: { userId: actorUserId },
        select: {
          scenarioId: true,
          completedQuestions: true,
          totalQuestions: true,
        },
      }),
    ]);

    const progressByScenarioId = new Map(
      progressRows.map((p) => [p.scenarioId, p]),
    );

    return {
      scenarios: rows.map((row) => {
        const p = progressByScenarioId.get(row.id);
        return toListItem(
          row,
          p
            ? {
                completedQuestions: p.completedQuestions,
                totalQuestions: p.totalQuestions,
              }
            : {
                completedQuestions: 0,
                totalQuestions: row._count.questions,
              },
        );
      }),
      total,
    };
  }

  async getBySlug(
    role: Role,
    actorUserId: string,
    slug: string,
  ): Promise<ScenarioDetail> {
    const row = await this.prisma.scenario.findUnique({
      where: { slug },
      include: {
        brief: true,
        artifacts: { orderBy: { ordinal: "asc" } },
        _count: { select: { questions: true } },
      },
    });
    if (!row) throw new NotFoundException("Scenario not found.");

    // Non-admin users can only access published scenarios — return 404
    // (not 403) so the existence of drafts isn't leaked.
    if (isNonAdmin(role) && row.status !== "published") {
      throw new NotFoundException("Scenario not found.");
    }

    const progress = await this.prisma.scenarioProgress.findUnique({
      where: {
        scenarioId_userId: { scenarioId: row.id, userId: actorUserId },
      },
      select: { completedQuestions: true, totalQuestions: true },
    });

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
      ...toListItem(
        row,
        progress
          ? {
              completedQuestions: progress.completedQuestions,
              totalQuestions: progress.totalQuestions,
            }
          : {
              completedQuestions: 0,
              totalQuestions: row._count.questions,
            },
      ),
      brief,
      artifacts,
    };
  }
}

type ScenarioRow = Awaited<
  ReturnType<PrismaService["scenario"]["findMany"]>
>[number];

function toListItem(
  row: ScenarioRow,
  progress: { completedQuestions: number; totalQuestions: number },
): ScenarioListItem {
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
    completedQuestions: progress.completedQuestions,
    totalQuestions: progress.totalQuestions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
