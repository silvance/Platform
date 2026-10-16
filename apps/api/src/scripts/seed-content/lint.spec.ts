import { SCENARIOS } from "./index";
import { formatLintMarkdown, lintScenarios } from "./lint";
import type { ArtifactSeed, QuestionSeed, ScenarioSeed } from "./types";

function base(over: Partial<ScenarioSeed> = {}): ScenarioSeed {
  return {
    slug: "lint-scenario-001",
    title: "Lint",
    summary: "Lint fixture",
    skillAreas: ["report_writing"],
    difficulty: 1,
    estimatedMinutes: 5,
    tags: [],
    lane: "foundations",
    brief: "# Brief",
    artifacts: [],
    questions: [],
    ...over,
  };
}

function singleChoice(labels: [string, string][], correct: string): QuestionSeed {
  return {
    ordinal: 1,
    type: "multi_choice",
    weight: 1,
    promptMd: "Which statement is supportable?",
    options: labels.map(([id, label]) => ({ id, label })),
    allowMultiple: false,
    expected: { type: "multi_choice", correctIds: [correct], allowMultiple: false },
    debriefMd: "because",
  };
}

function textArtifact(body: string, over: Partial<ArtifactSeed> = {}): ArtifactSeed {
  return {
    ordinal: 1,
    displayName: "log.txt",
    kind: "text",
    mimeType: "text/plain",
    bytes: Buffer.from(body),
    ...over,
  };
}

function confidence(ordinal: number, range: [number, number]): QuestionSeed {
  return {
    ordinal,
    type: "confidence",
    weight: 1,
    promptMd: "How confident?",
    expected: { type: "confidence", expectedRange: range },
    debriefMd: "ok",
  };
}

const rules = (s: ScenarioSeed[]) => lintScenarios(s).map((f) => f.rule);

describe("lintScenarios: correct-option-longest", () => {
  it("flags a correct option clearly longer than every distractor", () => {
    const q = singleChoice(
      [
        ["a", "The parser extracted this many records from the image it was given."],
        ["b", "The device held exactly this many."],
        ["c", "The user sent this many."],
      ],
      "a",
    );
    expect(rules([base({ questions: [q] })])).toEqual(["correct-option-longest"]);
  });

  it("does not flag options of similar length", () => {
    const q = singleChoice(
      [
        ["a", "The parser extracted this many records."],
        ["b", "The device held exactly this many records."],
        ["c", "The user sent this many of these records."],
      ],
      "a",
    );
    expect(rules([base({ questions: [q] })])).toEqual([]);
  });
});

describe("lintScenarios: multi-select-length-cue", () => {
  it("flags multi-select where correct options are much longer", () => {
    const q: QuestionSeed = {
      ...singleChoice(
        [
          ["a", "Recorded under the account at the timestamps shown in the history file."],
          ["b", "A shell ran under this UID and wrote these commands to its history."],
          ["c", "Malware."],
          ["d", "Nothing."],
        ],
        "a",
      ),
      allowMultiple: true,
      expected: { type: "multi_choice", correctIds: ["a", "b"], allowMultiple: true },
    };
    expect(rules([base({ questions: [q] })])).toEqual(["multi-select-length-cue"]);
  });
});

describe("lintScenarios: timestamp-without-timezone", () => {
  it("flags date-times with no timezone anywhere in the artifact", () => {
    const s = base({ artifacts: [textArtifact("2026-09-04 09:11:18 device installed")] });
    expect(rules([s])).toEqual(["timestamp-without-timezone"]);
  });

  it("accepts a Z suffix, an offset, or a timezone note", () => {
    for (const body of [
      "2026-09-04T09:11:18Z installed",
      "2026-09-04 09:11:18 +02:00 installed",
      "timezone: Eastern\n2026-09-04 09:11:18 installed",
      "2026-09-04 09:11:18 UTC installed",
    ]) {
      expect(rules([base({ artifacts: [textArtifact(body)] })])).toEqual([]);
    }
  });

  it("respects localTimeByDesign", () => {
    const s = base({
      artifacts: [textArtifact("2026-09-04 09:11:18 installed", { localTimeByDesign: true })],
    });
    expect(rules([s])).toEqual([]);
  });

  it("ignores binary-ish kinds", () => {
    const s = base({ artifacts: [textArtifact("2026-09-04 09:11 x", { kind: "pdf" })] });
    expect(rules([s])).toEqual([]);
  });
});

describe("lintScenarios: confidence-skew", () => {
  it("flags a lane where nearly every confidence question expects low", () => {
    const s = base({
      questions: [confidence(1, [1, 2]), confidence(2, [1, 2]), confidence(3, [1, 2]), confidence(4, [2, 3])],
    });
    const out = lintScenarios([s]);
    expect(out.map((f) => f.rule)).toEqual(["confidence-skew"]);
    expect(out[0]!.slug).toBeUndefined();
  });

  it("does not flag a lane that has at least one high-confidence case", () => {
    const s = base({
      questions: [confidence(1, [1, 2]), confidence(2, [1, 2]), confidence(3, [1, 2]), confidence(4, [4, 5])],
    });
    expect(rules([s])).toEqual([]);
  });

  it("does not judge lanes with too few confidence questions", () => {
    const s = base({ questions: [confidence(1, [1, 2]), confidence(2, [1, 2])] });
    expect(rules([s])).toEqual([]);
  });
});

describe("lintScenarios: scope", () => {
  it("skips archived scenarios but keeps drafts", () => {
    const tz = [textArtifact("2026-09-04 09:11:18 installed")];
    expect(rules([base({ status: "archived", artifacts: tz })])).toEqual([]);
    expect(rules([base({ status: "draft", artifacts: tz })])).toEqual(["timestamp-without-timezone"]);
  });
});

describe("lintScenarios: real catalogue", () => {
  it("runs over every seeded scenario and renders a Markdown report", () => {
    const findings = lintScenarios(SCENARIOS);
    for (const f of findings) {
      expect(f.lane).toBeTruthy();
      expect(f.detail).toBeTruthy();
    }
    expect(formatLintMarkdown(findings)).toContain("# Content edit list");
  });
});
