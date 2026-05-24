import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  AnalyticsResponse,
  QuestionAnalytics,
  ScenarioAnalytics,
} from "@ci-train/contracts";

// per-scenario / per-question analytics for admins.
//
// Single pass over scenarios + their questions + the
// ScenarioProgress + QuestionResponse tables; no admin-only
// scenarios are excluded — analytics covers everything so an
// admin can see whether a draft is being solved.

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<AnalyticsResponse> {
    // Pull scenarios with their questions; counts come from
    // ScenarioProgress (per-user) and QuestionResponse (per-
    // user-per-question). All three reads happen in one
    // transaction for a consistent snapshot.
    const [scenarios, progressRows, responseRows] =
      await this.prisma.$transaction([
        this.prisma.scenario.findMany({
          orderBy: [{ lane: "asc" }, { sequence: "asc" }, { title: "asc" }],
          select: {
            id: true,
            slug: true,
            title: true,
            lane: true,
            module: true,
            status: true,
            questions: {
              orderBy: { ordinal: "asc" },
              select: {
                id: true,
                ordinal: true,
                type: true,
                promptMd: true,
              },
            },
          },
        }),
        this.prisma.scenarioProgress.findMany({
          select: { scenarioId: true, completedAt: true },
        }),
        this.prisma.questionResponse.findMany({
          select: {
            questionId: true,
            completedAt: true,
            attemptCount: true,
          },
        }),
      ]);

    // Bucket progress rows per scenario.
    const progressByScenario = new Map<
      string,
      { started: number; completed: number }
    >();
    for (const p of progressRows) {
      const bucket = progressByScenario.get(p.scenarioId) ?? {
        started: 0,
        completed: 0,
      };
      bucket.started += 1;
      if (p.completedAt !== null) bucket.completed += 1;
      progressByScenario.set(p.scenarioId, bucket);
    }

    // Bucket response rows per question.
    type QStats = {
      usersAttempted: number;
      usersCompleted: number;
      firstTryCorrect: number;
      totalSubmissions: number;
    };
    const responseByQuestion = new Map<string, QStats>();
    for (const r of responseRows) {
      const bucket = responseByQuestion.get(r.questionId) ?? {
        usersAttempted: 0,
        usersCompleted: 0,
        firstTryCorrect: 0,
        totalSubmissions: 0,
      };
      bucket.usersAttempted += 1;
      bucket.totalSubmissions += r.attemptCount;
      if (r.completedAt !== null) {
        bucket.usersCompleted += 1;
        if (r.attemptCount === 1) bucket.firstTryCorrect += 1;
      }
      responseByQuestion.set(r.questionId, bucket);
    }

    const out: ScenarioAnalytics[] = scenarios.map((s) => {
      const sp = progressByScenario.get(s.id) ?? {
        started: 0,
        completed: 0,
      };
      const questions: QuestionAnalytics[] = s.questions.map((q) => {
        const qs = responseByQuestion.get(q.id) ?? {
          usersAttempted: 0,
          usersCompleted: 0,
          firstTryCorrect: 0,
          totalSubmissions: 0,
        };
        return {
          questionId: q.id,
          ordinal: q.ordinal,
          type: q.type,
          promptPreview: q.promptMd.slice(0, 120),
          usersAttempted: qs.usersAttempted,
          usersCompleted: qs.usersCompleted,
          firstTryCorrect: qs.firstTryCorrect,
          totalSubmissions: qs.totalSubmissions,
        };
      });
      return {
        scenarioId: s.id,
        slug: s.slug,
        title: s.title,
        lane: s.lane,
        module: s.module ?? null,
        status: s.status,
        questionCount: s.questions.length,
        usersStarted: sp.started,
        usersCompleted: sp.completed,
        questions,
      };
    });

    return { scenarios: out };
  }
}
