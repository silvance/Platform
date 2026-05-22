import { MeProgressResponse } from "@ci-train/contracts";

describe("MeProgressResponse", () => {
  it("accepts a valid payload", () => {
    const r = MeProgressResponse.parse({
      rows: [
        {
          scenarioId: "00000000-0000-4000-a000-000000000001",
          scenarioSlug: "bec-001",
          scenarioTitle: "BEC test",
          scenarioStatus: "published",
          startedAt: "2026-05-22T08:00:00.000Z",
          completedAt: "2026-05-22T08:30:00.000Z",
          completedQuestions: 4,
          totalQuestions: 4,
        },
      ],
      totals: { scenariosTouched: 1, scenariosCompleted: 1 },
    });
    expect(r.rows[0]!.scenarioStatus).toBe("published");
  });

  it("accepts an incomplete row (completedAt null)", () => {
    const r = MeProgressResponse.parse({
      rows: [
        {
          scenarioId: "00000000-0000-4000-a000-000000000001",
          scenarioSlug: "bec-001",
          scenarioTitle: "BEC test",
          scenarioStatus: "draft",
          startedAt: "2026-05-22T08:00:00.000Z",
          completedAt: null,
          completedQuestions: 2,
          totalQuestions: 4,
        },
      ],
      totals: { scenariosTouched: 1, scenariosCompleted: 0 },
    });
    expect(r.rows[0]!.completedAt).toBeNull();
  });

  it("rejects a row with an unknown scenarioStatus", () => {
    const r = MeProgressResponse.safeParse({
      rows: [
        {
          scenarioId: "00000000-0000-4000-a000-000000000001",
          scenarioSlug: "x",
          scenarioTitle: "x",
          scenarioStatus: "what",
          startedAt: "2026-05-22T08:00:00.000Z",
          completedAt: null,
          completedQuestions: 0,
          totalQuestions: 1,
        },
      ],
      totals: { scenariosTouched: 1, scenariosCompleted: 0 },
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative counters", () => {
    const r = MeProgressResponse.safeParse({
      rows: [],
      totals: { scenariosTouched: -1, scenariosCompleted: 0 },
    });
    expect(r.success).toBe(false);
  });
});
