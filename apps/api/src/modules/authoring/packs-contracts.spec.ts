import {
  PACK_FORMAT,
  PACK_VERSION,
  PackManifest,
} from "@ci-train/contracts";

// Contract-level tests for the pack manifest schema. Round-trip + DB
// behavior is exercised in the E2E verification against a live
// Postgres; this spec catches schema regressions in unit-test time.

const VALID_MANIFEST = {
  format: PACK_FORMAT,
  version: PACK_VERSION,
  exportedAt: "2026-05-22T08:00:00.000Z",
  exportedFrom: "example.local",
  scenario: {
    slug: "bec-001",
    title: "BEC test",
    summary: "Summary",
    skillAreas: ["bec"],
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ["bec"],
    brief: {
      markdownBody: "# Brief",
      disclaimerMd: null,
    },
    artifacts: [
      {
        packId: "00000000-0000-4000-a000-000000000001",
        ordinal: 1,
        displayName: "ev.txt",
        kind: "text",
        mimeType: "text/plain",
        viewerHint: null,
        sha256: "a".repeat(64),
        sizeBytes: 10,
        archivePath: "artifacts/00000000-0000-4000-a000-000000000001.txt",
      },
    ],
    indicatorSets: [
      {
        slug: "set-1",
        displayName: "Set 1",
        sourcePackArtifactId: "00000000-0000-4000-a000-000000000001",
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      },
    ],
    questions: [
      {
        type: "multi_choice",
        ordinal: 1,
        promptMd: "Which?",
        weight: 1,
        debriefMd: "x",
        options: [
          { id: "x", label: "X" },
          { id: "y", label: "Y" },
        ],
        allowMultiple: false,
        correctIds: ["x"],
      },
    ],
  },
};

describe("PackManifest", () => {
  it("accepts a valid manifest", () => {
    expect(PackManifest.parse(VALID_MANIFEST)).toBeTruthy();
  });

  it("rejects a manifest with the wrong format string", () => {
    const r = PackManifest.safeParse({ ...VALID_MANIFEST, format: "junk" });
    expect(r.success).toBe(false);
  });

  it("rejects a manifest with the wrong version", () => {
    const r = PackManifest.safeParse({ ...VALID_MANIFEST, version: 99 });
    expect(r.success).toBe(false);
  });

  it("rejects a select_indicators question with no correctIds", () => {
    const r = PackManifest.safeParse({
      ...VALID_MANIFEST,
      scenario: {
        ...VALID_MANIFEST.scenario,
        questions: [
          {
            type: "select_indicators",
            ordinal: 1,
            promptMd: "x",
            weight: 1,
            debriefMd: "y",
            indicatorSetSlug: "set-1",
            correctIds: [],
          },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an indicator set with fewer than 2 items", () => {
    const r = PackManifest.safeParse({
      ...VALID_MANIFEST,
      scenario: {
        ...VALID_MANIFEST.scenario,
        indicatorSets: [
          {
            slug: "set-1",
            displayName: "Set",
            sourcePackArtifactId: null,
            items: [{ id: "a", label: "A" }],
          },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an artifact with an invalid sha256", () => {
    const bad = {
      ...VALID_MANIFEST,
      scenario: {
        ...VALID_MANIFEST.scenario,
        artifacts: [
          {
            ...VALID_MANIFEST.scenario.artifacts[0],
            sha256: "not-a-sha",
          },
        ],
      },
    };
    expect(PackManifest.safeParse(bad).success).toBe(false);
  });
});
