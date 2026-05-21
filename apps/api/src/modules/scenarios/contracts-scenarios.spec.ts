import {
  ScenarioListQuery,
  ScenarioBriefPayload,
  MAX_BRIEF_MARKDOWN_BYTES,
  MAX_DISCLAIMER_MARKDOWN_BYTES,
  isAwarenessOnly,
} from "@ci-train/contracts";

describe("ScenarioListQuery", () => {
  it("safeParse fails (without throwing) for an out-of-range difficulty", () => {
    const r = ScenarioListQuery.safeParse({ difficulty: 99 });
    expect(r.success).toBe(false);
  });

  it("safeParse fails for an unknown skillArea", () => {
    const r = ScenarioListQuery.safeParse({ skillArea: "nope" });
    expect(r.success).toBe(false);
  });

  it("safeParse succeeds with no filters", () => {
    const r = ScenarioListQuery.safeParse({});
    expect(r.success).toBe(true);
  });

  it("coerces a numeric difficulty from a string query value", () => {
    const r = ScenarioListQuery.safeParse({ difficulty: "3" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.difficulty).toBe(3);
  });
});

describe("ScenarioBriefPayload — size caps", () => {
  it("accepts a brief at the maximum allowed length", () => {
    const ok = ScenarioBriefPayload.safeParse({
      markdownBody: "x".repeat(MAX_BRIEF_MARKDOWN_BYTES),
      disclaimerMd: null,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a brief that exceeds the markdown cap", () => {
    const tooBig = ScenarioBriefPayload.safeParse({
      markdownBody: "x".repeat(MAX_BRIEF_MARKDOWN_BYTES + 1),
      disclaimerMd: null,
    });
    expect(tooBig.success).toBe(false);
  });

  it("rejects a disclaimer that exceeds its cap", () => {
    const tooBig = ScenarioBriefPayload.safeParse({
      markdownBody: "ok",
      disclaimerMd: "x".repeat(MAX_DISCLAIMER_MARKDOWN_BYTES + 1),
    });
    expect(tooBig.success).toBe(false);
  });
});

describe("isAwarenessOnly", () => {
  it("flags rf_awareness as awareness-only", () => {
    expect(isAwarenessOnly("rf_awareness")).toBe(true);
  });

  it("does not flag operational skill areas as awareness-only", () => {
    expect(isAwarenessOnly("email_headers")).toBe(false);
    expect(isAwarenessOnly("bec")).toBe(false);
    expect(isAwarenessOnly("df_artifacts")).toBe(false);
  });
});
