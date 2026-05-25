import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { CompletionListResponse } from "@ci-train/contracts";

// Recent-completions feed for /admin/completions. One row per
// (user, scenario) where scenario_progress.completedAt is set.
// Newest-first by completedAt. Each row carries the per-scenario
// attempt aggregates the admin will want at a glance (total
// submissions, first-try-correct count, total questions).
@Injectable()
export class CompletionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecent(args: { limit: number }): Promise<CompletionListResponse> {
    const limit = Math.max(1, Math.min(args.limit, 500));

    // Pull completed progress rows + total count in one snapshot.
    // Include scenario (slug + title + question-count) and user
    // (displayName + email) for the listing payload.
    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.scenarioProgress.findMany({
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: limit,
        include: {
          scenario: {
            select: {
              id: true,
              slug: true,
              title: true,
              _count: { select: { questions: true } },
            },
          },
          user: { select: { id: true, displayName: true, email: true } },
        },
      }),
      this.prisma.scenarioProgress.count({
        where: { completedAt: { not: null } },
      }),
    ]);

    // For the attempts aggregate we need per-progress sums of
    // QuestionResponse.attemptCount + count of completed-on-try-1.
    // The cheapest path is a single grouped query keyed by progressId.
    const progressIds = rows.map((r) => r.id);
    const attemptStats = progressIds.length
      ? await this.prisma.questionResponse.groupBy({
          by: ["progressId"],
          where: { progressId: { in: progressIds } },
          _sum: { attemptCount: true },
          _count: { _all: true },
        })
      : [];
    const totalAttemptsByProgress = new Map<string, number>();
    for (const s of attemptStats) {
      totalAttemptsByProgress.set(s.progressId, s._sum.attemptCount ?? 0);
    }

    // first-try counts: completed AND attemptCount = 1.
    const firstTryStats = progressIds.length
      ? await this.prisma.questionResponse.groupBy({
          by: ["progressId"],
          where: {
            progressId: { in: progressIds },
            attemptCount: 1,
            completedAt: { not: null },
          },
          _count: { _all: true },
        })
      : [];
    const firstTryByProgress = new Map<string, number>();
    for (const s of firstTryStats) {
      firstTryByProgress.set(s.progressId, s._count._all);
    }

    return {
      completions: rows.map((r) => ({
        scenarioId: r.scenario.id,
        scenarioSlug: r.scenario.slug,
        scenarioTitle: r.scenario.title,
        userId: r.user.id,
        userDisplayName: r.user.displayName,
        userEmail: r.user.email,
        // completedAt is non-null by the WHERE clause; non-null
        // assertion is safe.
        completedAt: r.completedAt!.toISOString(),
        startedAt: r.startedAt.toISOString(),
        totalAttempts: totalAttemptsByProgress.get(r.id) ?? 0,
        firstTryCount: firstTryByProgress.get(r.id) ?? 0,
        totalQuestions: r.scenario._count.questions,
      })),
      totalCount,
    };
  }
}
