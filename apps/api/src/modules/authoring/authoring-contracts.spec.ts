import {
  CreateQuestionRequest,
  CreateScenarioRequest,
  UpdateScenarioRequest,
} from "@ci-train/contracts";

// Lightweight contract specs. The authoring service relies on these
// schemas as the trust boundary — if they accept bad input, the
// service will propagate it. Test the high-value rejections + the
// happy path.

describe("CreateScenarioRequest", () => {
  const VALID = {
    slug: "challenge-001",
    title: "Test challenge",
    summary: "A summary of the challenge.",
    skillAreas: ["bec"],
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ["bec"],
    status: "draft" as const,
    brief: { markdownBody: "# Brief", disclaimerMd: null },
  };

  it("accepts a valid payload", () => {
    expect(CreateScenarioRequest.parse(VALID)).toBeTruthy();
  });

  it("rejects an empty skillAreas list", () => {
    const r = CreateScenarioRequest.safeParse({ ...VALID, skillAreas: [] });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid slug (uppercase)", () => {
    const r = CreateScenarioRequest.safeParse({ ...VALID, slug: "Has-Caps" });
    expect(r.success).toBe(false);
  });

  it("rejects difficulty outside 1..5", () => {
    expect(CreateScenarioRequest.safeParse({ ...VALID, difficulty: 7 }).success).toBe(false);
    expect(CreateScenarioRequest.safeParse({ ...VALID, difficulty: 0 }).success).toBe(false);
  });

  it("rejects a malformed tag", () => {
    const r = CreateScenarioRequest.safeParse({
      ...VALID,
      tags: ["UPPERCASE"],
    });
    expect(r.success).toBe(false);
  });

  it("defaults status to draft when omitted", () => {
    const { status: _omit, ...rest } = VALID;
    void _omit;
    const r = CreateScenarioRequest.parse(rest);
    expect(r.status).toBe("draft");
  });

  it("defaults tags to []", () => {
    const { tags: _omit, ...rest } = VALID;
    void _omit;
    const r = CreateScenarioRequest.parse(rest);
    expect(r.tags).toEqual([]);
  });
});

describe("UpdateScenarioRequest", () => {
  it("accepts an empty body (all fields optional)", () => {
    expect(UpdateScenarioRequest.parse({})).toEqual({});
  });

  it("accepts a partial brief update", () => {
    const r = UpdateScenarioRequest.parse({
      brief: { markdownBody: "# Updated" },
    });
    expect(r.brief?.markdownBody).toBe("# Updated");
  });
});

describe("CreateQuestionRequest", () => {
  it("accepts a valid multi_choice", () => {
    const r = CreateQuestionRequest.parse({
      type: "multi_choice",
      promptMd: "Which?",
      weight: 1,
      debriefMd: "Because…",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      allowMultiple: false,
      correctIds: ["a"],
    });
    expect(r.type).toBe("multi_choice");
  });

  it("rejects multi_choice with fewer than 2 options", () => {
    const r = CreateQuestionRequest.safeParse({
      type: "multi_choice",
      promptMd: "Which?",
      weight: 1,
      debriefMd: "x",
      options: [{ id: "a", label: "A" }],
      correctIds: ["a"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid confidence", () => {
    const r = CreateQuestionRequest.parse({
      type: "confidence",
      promptMd: "How confident?",
      weight: 1,
      debriefMd: "x",
      expectedRange: [3, 5],
    });
    expect(r.type).toBe("confidence");
  });

  it("rejects confidence range outside 1..5", () => {
    const r = CreateQuestionRequest.safeParse({
      type: "confidence",
      promptMd: "x",
      weight: 1,
      debriefMd: "x",
      expectedRange: [0, 5],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid text_match with defaults", () => {
    const r = CreateQuestionRequest.parse({
      type: "text_match",
      promptMd: "Type the domain",
      weight: 1,
      debriefMd: "x",
      acceptableAnswers: ["example.com"],
    });
    if (r.type !== "text_match") throw new Error("expected text_match");
    expect(r.caseSensitive).toBe(false);
    expect(r.normalizeWhitespace).toBe(true);
    expect(r.regex).toBe(false);
    expect(r.hintAfterTries).toBe(3);
  });

  it("rejects text_match with an empty acceptableAnswers list", () => {
    const r = CreateQuestionRequest.safeParse({
      type: "text_match",
      promptMd: "x",
      weight: 1,
      debriefMd: "x",
      acceptableAnswers: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a question whose type isn't in the discriminated union", () => {
    const r = CreateQuestionRequest.safeParse({
      type: "short_answer",
      promptMd: "x",
      weight: 1,
      debriefMd: "x",
    });
    expect(r.success).toBe(false);
  });
});
