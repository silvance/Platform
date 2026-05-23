import { SCENARIOS } from "./index";
import { ContentValidationError, validateScenarios } from "./validate";
import type { ScenarioSeed } from "./types";

// Validator unit tests + a meta-test that the real catalogue
// validates. The meta-test is the M16 acceptance bar: any
// scenario file that ships in the seed must pass these checks.

function base(over: Partial<ScenarioSeed> = {}): ScenarioSeed {
  return {
    slug: "test-scenario-001",
    title: "Test",
    summary: "Test scenario",
    skillAreas: ["report_writing"],
    difficulty: 1,
    estimatedMinutes: 5,
    tags: ["test"],
    brief: "# Brief\n\nSomething.",
    artifacts: [
      {
        ordinal: 1,
        displayName: "a.txt",
        kind: "text",
        mimeType: "text/plain",
        bytes: Buffer.from("hello"),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "confidence",
        weight: 1,
        promptMd: "How confident?",
        expected: { type: "confidence", expectedRange: [1, 5] },
        debriefMd: "ok",
      },
    ],
    ...over,
  };
}

describe("validateScenarios", () => {
  it("passes the real seed catalogue", () => {
    expect(() => validateScenarios(SCENARIOS)).not.toThrow();
  });

  it("accepts a minimal valid scenario", () => {
    expect(() => validateScenarios([base()])).not.toThrow();
  });

  it("rejects duplicate slugs across the catalogue", () => {
    expect(() => validateScenarios([base(), base()])).toThrow(
      ContentValidationError,
    );
  });

  it("rejects non-kebab-case slugs", () => {
    expect(() =>
      validateScenarios([base({ slug: "Not_Kebab" })]),
    ).toThrow(/kebab-case/);
  });

  it("rejects duplicate artifact ordinals within a scenario", () => {
    expect(() =>
      validateScenarios([
        base({
          artifacts: [
            { ordinal: 1, displayName: "a.txt", kind: "text", mimeType: "text/plain", bytes: Buffer.from("a") },
            { ordinal: 1, displayName: "b.txt", kind: "text", mimeType: "text/plain", bytes: Buffer.from("b") },
          ],
        }),
      ]),
    ).toThrow(/duplicate artifact ordinal/);
  });

  it("rejects empty artifacts array", () => {
    expect(() => validateScenarios([base({ artifacts: [] })])).toThrow(
      /at least one artifact/,
    );
  });

  it("rejects empty questions array", () => {
    expect(() => validateScenarios([base({ questions: [] })])).toThrow(
      /at least one question/,
    );
  });

  it("rejects a multi_choice question whose correctId is not an option", () => {
    expect(() =>
      validateScenarios([
        base({
          questions: [
            {
              ordinal: 1,
              type: "multi_choice",
              weight: 1,
              promptMd: "Pick one",
              options: [
                { id: "a", label: "A" },
                { id: "b", label: "B" },
              ],
              allowMultiple: false,
              expected: {
                type: "multi_choice",
                correctIds: ["zzz"],
                allowMultiple: false,
              },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/multi_choice correctId "zzz" not declared as an option/);
  });

  it("rejects a select_indicators question that references an unknown indicator-set", () => {
    expect(() =>
      validateScenarios([
        base({
          indicatorSets: [
            { slug: "real", displayName: "real", items: [{ id: "x", label: "x" }] },
          ],
          questions: [
            {
              ordinal: 1,
              type: "select_indicators",
              weight: 1,
              promptMd: "Pick",
              indicatorSetSlug: "missing",
              expected: { type: "select_indicators", correctIds: ["x"] },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/references unknown indicator-set/);
  });

  it("rejects a select_indicators correctId that's not in the indicator-set", () => {
    expect(() =>
      validateScenarios([
        base({
          indicatorSets: [
            { slug: "real", displayName: "real", items: [{ id: "x", label: "x" }] },
          ],
          questions: [
            {
              ordinal: 1,
              type: "select_indicators",
              weight: 1,
              promptMd: "Pick",
              indicatorSetSlug: "real",
              expected: { type: "select_indicators", correctIds: ["y"] },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/correctId "y" not in indicator-set "real"/);
  });

  it("rejects a confidence question with malformed expectedRange", () => {
    expect(() =>
      validateScenarios([
        base({
          questions: [
            {
              ordinal: 1,
              type: "confidence",
              weight: 1,
              promptMd: "?",
              expected: { type: "confidence", expectedRange: [5, 1] },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/expectedRange/);
  });

  it("rejects a text_match with empty acceptableAnswers", () => {
    expect(() =>
      validateScenarios([
        base({
          questions: [
            {
              ordinal: 1,
              type: "text_match",
              weight: 1,
              promptMd: "?",
              expected: { type: "text_match", acceptableAnswers: [], regex: false },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/text_match has no acceptableAnswers/);
  });

  it("rejects unknown skillArea values (typos / non-enum)", () => {
    expect(() =>
      validateScenarios([base({ skillAreas: ["phising"] })]),
    ).toThrow(/skillArea "phising" is not a valid SkillArea enum value/);
  });

  it("rejects empty skillAreas array", () => {
    expect(() => validateScenarios([base({ skillAreas: [] })])).toThrow(
      /at least one skillArea/,
    );
  });

  it("rejects difficulty outside [1,5]", () => {
    expect(() => validateScenarios([base({ difficulty: 0 })])).toThrow(
      /difficulty must be an integer in \[1,5\]/,
    );
    expect(() => validateScenarios([base({ difficulty: 6 })])).toThrow(
      /difficulty must be an integer in \[1,5\]/,
    );
    expect(() =>
      validateScenarios([base({ difficulty: 2.5 as unknown as number })]),
    ).toThrow(/difficulty must be an integer/);
  });

  it("rejects non-positive estimatedMinutes", () => {
    expect(() =>
      validateScenarios([base({ estimatedMinutes: 0 })]),
    ).toThrow(/estimatedMinutes must be a positive integer/);
    expect(() =>
      validateScenarios([base({ estimatedMinutes: -5 })]),
    ).toThrow(/estimatedMinutes must be a positive integer/);
  });

  it("rejects an invalid status value", () => {
    expect(() =>
      validateScenarios([
        base({ status: "pending-review" as unknown as never }),
      ]),
    ).toThrow(/status "pending-review" is not a valid ScenarioStatus/);
  });

  it("accepts the three valid status values", () => {
    for (const s of ["draft", "published", "archived"] as const) {
      expect(() =>
        validateScenarios([
          base({ slug: `valid-status-${s}-001`, status: s }),
        ]),
      ).not.toThrow();
    }
  });

  it("rejects an uncompilable regex in a text_match acceptableAnswer", () => {
    expect(() =>
      validateScenarios([
        base({
          questions: [
            {
              ordinal: 1,
              type: "text_match",
              weight: 1,
              promptMd: "?",
              expected: {
                type: "text_match",
                acceptableAnswers: ["[unclosed-character-class"],
                regex: true,
              },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/text_match regex "\[unclosed-character-class" does not compile/);
  });

  it("does NOT try to compile a text_match answer when regex is false", () => {
    // The same string that would fail RegExp compilation is fine as a
    // literal match — the grader treats it character-for-character.
    expect(() =>
      validateScenarios([
        base({
          questions: [
            {
              ordinal: 1,
              type: "text_match",
              weight: 1,
              promptMd: "?",
              expected: {
                type: "text_match",
                acceptableAnswers: ["[unclosed-character-class"],
                regex: false,
              },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).not.toThrow();
  });

  it("rejects an indicator-set whose sourceArtifactDisplayName doesn't match any artifact", () => {
    expect(() =>
      validateScenarios([
        base({
          indicatorSets: [
            {
              slug: "real",
              displayName: "real",
              sourceArtifactDisplayName: "missing.txt",
              items: [{ id: "x", label: "x" }],
            },
          ],
          questions: [
            {
              ordinal: 1,
              type: "select_indicators",
              weight: 1,
              promptMd: "Pick",
              indicatorSetSlug: "real",
              expected: { type: "select_indicators", correctIds: ["x"] },
              debriefMd: "ok",
            },
          ],
        }),
      ]),
    ).toThrow(/sourceArtifactDisplayName "missing.txt" does not match any artifact/);
  });
});

describe("seed catalogue acceptance — M16", () => {
  it("contains at least 20 scenarios", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(20);
  });

  it("contains at least 8 published (Tier-1) scenarios", () => {
    const published = SCENARIOS.filter(
      (s) => (s.status ?? "published") === "published",
    );
    expect(published.length).toBeGreaterThanOrEqual(8);
  });

  it("has unique slugs", () => {
    const slugs = SCENARIOS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every polished scenario has ≥1 artifact and ≥3 questions", () => {
    // Soft bound — the validator already enforces "at least 1 of
    // each"; this spec catches drift on the *question* count so a
    // future single-question challenge has to be deliberate. The
    // artifact-count floor is intentionally 1: M20 beginner-tier
    // scenarios are designed to be tight, focused, single-artifact
    // exercises around one foundational concept.
    for (const s of SCENARIOS) {
      const isPolished = (s.status ?? "published") === "published";
      if (!isPolished) continue;
      expect(s.artifacts.length).toBeGreaterThanOrEqual(1);
      expect(s.questions.length).toBeGreaterThanOrEqual(3);
    }
  });
});
