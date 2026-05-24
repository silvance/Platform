import { AnalyticsService } from "./analytics.service";
import type { PrismaService } from "../database/prisma.service";

// focused test of the aggregation math. Mock just the
// Prisma surface area the service touches; same pattern as the
// other -.service.spec files in this repo.

function makePrisma(opts: {
  scenarios: Array<{
    id: string;
    slug: string;
    title: string;
    lane: string;
    module: string | null;
    status: string;
    questions: Array<{ id: string; ordinal: number; type: string; promptMd: string }>;
  }>;
  progress: Array<{ scenarioId: string; completedAt: Date | null }>;
  responses: Array<{ questionId: string; completedAt: Date | null; attemptCount: number }>;
}): PrismaService {
  return {
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    scenario: {
      findMany: jest.fn(async () => opts.scenarios),
    },
    scenarioProgress: {
      findMany: jest.fn(async () => opts.progress),
    },
    questionResponse: {
      findMany: jest.fn(async () => opts.responses),
    },
  } as unknown as PrismaService;
}

describe("AnalyticsService.getAll", () => {
  it("aggregates per-scenario and per-question counters from progress + response rows", async () => {
    const prisma = makePrisma({
      scenarios: [
        {
          id: "s1",
          slug: "alpha",
          title: "Alpha",
          lane: "foundations",
          module: "Integrity & identification",
          status: "published",
          questions: [
            { id: "q1", ordinal: 1, type: "multi_choice", promptMd: "Q one" },
            { id: "q2", ordinal: 2, type: "confidence", promptMd: "Q two" },
          ],
        },
      ],
      progress: [
        // Three users have started; two finished.
        { scenarioId: "s1", completedAt: new Date("2026-05-01T00:00:00Z") },
        { scenarioId: "s1", completedAt: new Date("2026-05-02T00:00:00Z") },
        { scenarioId: "s1", completedAt: null },
      ],
      responses: [
        // q1: three attempts; one first-try correct, one second-try correct, one still wrong.
        { questionId: "q1", completedAt: new Date("2026-05-01T00:00:00Z"), attemptCount: 1 },
        { questionId: "q1", completedAt: new Date("2026-05-02T00:00:00Z"), attemptCount: 2 },
        { questionId: "q1", completedAt: null, attemptCount: 3 },
        // q2: two attempts; both first-try correct.
        { questionId: "q2", completedAt: new Date("2026-05-01T00:00:00Z"), attemptCount: 1 },
        { questionId: "q2", completedAt: new Date("2026-05-02T00:00:00Z"), attemptCount: 1 },
      ],
    });

    const svc = new AnalyticsService(prisma);
    const out = await svc.getAll();

    expect(out.scenarios).toHaveLength(1);
    const s = out.scenarios[0]!;
    expect(s.slug).toBe("alpha");
    expect(s.usersStarted).toBe(3);
    expect(s.usersCompleted).toBe(2);
    expect(s.questionCount).toBe(2);

    const q1 = s.questions.find((q) => q.questionId === "q1")!;
    expect(q1.usersAttempted).toBe(3);
    expect(q1.usersCompleted).toBe(2);
    expect(q1.firstTryCorrect).toBe(1);
    expect(q1.totalSubmissions).toBe(6);

    const q2 = s.questions.find((q) => q.questionId === "q2")!;
    expect(q2.usersAttempted).toBe(2);
    expect(q2.usersCompleted).toBe(2);
    expect(q2.firstTryCorrect).toBe(2);
    expect(q2.totalSubmissions).toBe(2);
  });

  it("returns scenarios with zero progress / response rows safely", async () => {
    const prisma = makePrisma({
      scenarios: [
        {
          id: "s2",
          slug: "untouched",
          title: "Untouched",
          lane: "foundations",
          module: null,
          status: "draft",
          questions: [
            { id: "q3", ordinal: 1, type: "multi_choice", promptMd: "Solo" },
          ],
        },
      ],
      progress: [],
      responses: [],
    });

    const svc = new AnalyticsService(prisma);
    const out = await svc.getAll();
    expect(out.scenarios[0]!.usersStarted).toBe(0);
    expect(out.scenarios[0]!.usersCompleted).toBe(0);
    expect(out.scenarios[0]!.questions[0]!.usersAttempted).toBe(0);
    expect(out.scenarios[0]!.questions[0]!.firstTryCorrect).toBe(0);
  });

  it("trims long prompts to a preview length", async () => {
    const longPrompt = "a".repeat(300);
    const prisma = makePrisma({
      scenarios: [
        {
          id: "s3",
          slug: "long",
          title: "Long",
          lane: "foundations",
          module: null,
          status: "published",
          questions: [{ id: "q4", ordinal: 1, type: "confidence", promptMd: longPrompt }],
        },
      ],
      progress: [],
      responses: [],
    });
    const svc = new AnalyticsService(prisma);
    const out = await svc.getAll();
    expect(out.scenarios[0]!.questions[0]!.promptPreview.length).toBeLessThanOrEqual(120);
  });
});
