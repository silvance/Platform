import type { QuestionSeed, ScenarioSeed } from "./types";

// Content-quality lint over the seed catalogue. Unlike validate.ts,
// which throws on malformed content, these are warnings about
// patterns that let a test-wise learner answer without reading the
// evidence, or that make an artifact ambiguous by accident:
//
//   correct-option-longest      single-answer multi_choice where the
//                               correct option is clearly the longest
//   multi-select-length-cue     multi-select where correct options are
//                               on average much longer than the rest
//   confidence-skew             a lane whose confidence questions
//                               almost all expect a low rating, so
//                               "always answer low" scores well
//   timestamp-without-timezone  text-like artifact with date-times but
//                               no timezone anywhere in it (opt out with
//                               ArtifactSeed.localTimeByDesign)
//
// Option *position* isn't linted: the workspace shuffles options per
// user, so stored order no longer reaches learners.
//
// Run: pnpm --filter @ci-train/api content:lint [--markdown]

export type LintRule =
  | "correct-option-longest"
  | "multi-select-length-cue"
  | "confidence-skew"
  | "timestamp-without-timezone";

export interface LintFinding {
  rule: LintRule;
  lane: string;
  // Absent for lane-level findings (confidence-skew).
  slug?: string;
  status?: string;
  // "Q3", an artifact display name, or the lane.
  target: string;
  detail: string;
  // Short prompt excerpt to help find the question in the source.
  excerpt?: string;
}

export const LINT_THRESHOLDS = {
  // Correct option at least this many times the longest distractor.
  correctLongestRatio: 1.15,
  // Avg correct length at least this many times avg incorrect length.
  multiSelectRatio: 1.3,
  // Lanes need at least this many confidence questions to be judged.
  confidenceMinPerLane: 4,
  // Share of a lane's confidence questions expecting <= 2 that warns
  // (when none of them expect >= 4).
  confidenceLowShare: 0.7,
} as const;

const TEXT_LIKE_KINDS = new Set(["text", "csv", "json", "eml"]);

// Wall-clock date-times: 2026-09-04 09:11, 2026/09/04T09:11, 9/4/2026 9:11.
const DATE_TIME =
  /\b\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{1,2}:\d{2}|\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/;
// Anything that pins the clock to a zone, anywhere in the artifact.
const TIMEZONE_MARKER =
  /\d[Z]\b|\bZ\b|\bUTC\b|\bGMT\b|[+-]\d{2}:?\d{2}\b|\b(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|BST|CET|CEST)\b|time\s*zone|timezone|\btz\b/i;

function excerpt(q: QuestionSeed): string {
  const flat = q.promptMd.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 87)}...` : flat;
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function lintQuestions(s: ScenarioSeed, out: LintFinding[]): void {
  for (const q of s.questions) {
    if (q.type !== "multi_choice" || !q.options || q.expected.type !== "multi_choice") {
      continue;
    }
    const correct = new Set(q.expected.correctIds);
    const right = q.options.filter((o) => correct.has(o.id)).map((o) => o.label.length);
    const wrong = q.options.filter((o) => !correct.has(o.id)).map((o) => o.label.length);
    if (right.length === 0 || wrong.length === 0) continue;

    const common = {
      lane: s.lane,
      slug: s.slug,
      status: s.status ?? "published",
      target: `Q${q.ordinal}`,
      excerpt: excerpt(q),
    };
    if (!q.expected.allowMultiple) {
      const c = right[0]!;
      const longestWrong = Math.max(...wrong);
      if (c > longestWrong && c >= LINT_THRESHOLDS.correctLongestRatio * longestWrong) {
        out.push({
          rule: "correct-option-longest",
          ...common,
          detail: `correct option ${c} chars vs longest distractor ${longestWrong} (${(c / longestWrong).toFixed(2)}x)`,
        });
      }
    } else {
      const ratio = avg(right) / avg(wrong);
      if (ratio >= LINT_THRESHOLDS.multiSelectRatio) {
        out.push({
          rule: "multi-select-length-cue",
          ...common,
          detail: `correct options average ${Math.round(avg(right))} chars vs ${Math.round(avg(wrong))} for the rest (${ratio.toFixed(2)}x)`,
        });
      }
    }
  }
}

function lintArtifacts(s: ScenarioSeed, out: LintFinding[]): void {
  for (const a of s.artifacts) {
    if (a.localTimeByDesign || !TEXT_LIKE_KINDS.has(a.kind)) continue;
    const text = a.bytes.toString("utf8");
    const m = text.match(DATE_TIME);
    if (m && !TIMEZONE_MARKER.test(text)) {
      out.push({
        rule: "timestamp-without-timezone",
        lane: s.lane,
        slug: s.slug,
        status: s.status ?? "published",
        target: a.displayName,
        detail: `date-times like "${m[0]}" with no timezone anywhere in the artifact`,
      });
    }
  }
}

function lintConfidenceSkew(scenarios: readonly ScenarioSeed[], out: LintFinding[]): void {
  const byLane = new Map<string, Array<[number, number]>>();
  for (const s of scenarios) {
    for (const q of s.questions) {
      if (q.expected.type !== "confidence") continue;
      const list = byLane.get(s.lane) ?? [];
      list.push(q.expected.expectedRange);
      byLane.set(s.lane, list);
    }
  }
  for (const [lane, ranges] of byLane) {
    if (ranges.length < LINT_THRESHOLDS.confidenceMinPerLane) continue;
    const low = ranges.filter(([, hi]) => hi <= 2).length;
    const high = ranges.filter(([lo]) => lo >= 4).length;
    if (high === 0 && low / ranges.length >= LINT_THRESHOLDS.confidenceLowShare) {
      out.push({
        rule: "confidence-skew",
        lane,
        target: lane,
        detail: `${low} of ${ranges.length} confidence questions expect 1-2 and none expect 4-5; add cases where the evidence does support a confident call`,
      });
    }
  }
}

export function lintScenarios(scenarios: readonly ScenarioSeed[]): LintFinding[] {
  // Archived scenarios are retired; drafts are kept so they're clean
  // before they're published.
  const live = scenarios.filter((s) => s.status !== "archived");
  const out: LintFinding[] = [];
  for (const s of live) {
    lintQuestions(s, out);
    lintArtifacts(s, out);
  }
  lintConfidenceSkew(live, out);
  return out;
}

const RULE_TITLES: Record<LintRule, string> = {
  "correct-option-longest": "Correct option is clearly the longest (single answer)",
  "multi-select-length-cue": "Correct options are much longer than the rest (multi-select)",
  "confidence-skew": "Confidence answers skew low across a lane",
  "timestamp-without-timezone": "Artifact timestamps with no timezone",
};

const RULE_FIXES: Record<LintRule, string> = {
  "correct-option-longest":
    "Trim the correct option or give the distractors the same level of detail and qualification.",
  "multi-select-length-cue":
    "Even out option lengths so the correct set can't be picked by length alone.",
  "confidence-skew":
    "Add or adjust questions where the evidence does justify a high rating; under-claiming is also an error.",
  "timestamp-without-timezone":
    "Add the timezone (or a host/timezone note), or set localTimeByDesign: true if the ambiguity is the lesson.",
};

export function formatLintText(findings: readonly LintFinding[]): string {
  if (findings.length === 0) return "content lint: no findings";
  const lines: string[] = [];
  for (const rule of Object.keys(RULE_TITLES) as LintRule[]) {
    const hits = findings.filter((f) => f.rule === rule);
    if (hits.length === 0) continue;
    lines.push(`\n${RULE_TITLES[rule]} (${hits.length})`);
    for (const f of hits) {
      const where = f.slug ? `${f.slug} ${f.target}` : f.target;
      lines.push(`  - [${f.status ?? "lane"}] ${where}: ${f.detail}`);
    }
  }
  lines.push(`\ncontent lint: ${findings.length} finding(s)`);
  return lines.join("\n");
}

export function formatLintMarkdown(findings: readonly LintFinding[]): string {
  const lines: string[] = [
    "# Content edit list",
    "",
    "Generated by `pnpm --filter @ci-train/api content:lint --markdown` from",
    "`apps/api/src/scripts/seed-content/lint.ts`. Re-run after editing; fixed",
    "items drop off. Drafts are included so they're clean before publishing.",
  ];
  for (const rule of Object.keys(RULE_TITLES) as LintRule[]) {
    const hits = findings.filter((f) => f.rule === rule);
    if (hits.length === 0) continue;
    lines.push("", `## ${RULE_TITLES[rule]} (${hits.length})`, "", RULE_FIXES[rule], "");
    if (rule === "confidence-skew") {
      lines.push("| Lane | Finding |", "| --- | --- |");
      for (const f of hits) lines.push(`| ${f.lane} | ${f.detail} |`);
      continue;
    }
    const isArtifact = rule === "timestamp-without-timezone";
    lines.push(
      isArtifact
        ? "| Scenario | Status | Artifact | Finding |"
        : "| Scenario | Status | Question | Prompt | Finding |",
      isArtifact ? "| --- | --- | --- | --- |" : "| --- | --- | --- | --- | --- |",
    );
    for (const f of hits) {
      const esc = (s: string) => s.replace(/\|/g, "\\|");
      lines.push(
        isArtifact
          ? `| \`${f.slug}\` | ${f.status} | \`${f.target}\` | ${esc(f.detail)} |`
          : `| \`${f.slug}\` | ${f.status} | ${f.target} | ${esc(f.excerpt ?? "")} | ${esc(f.detail)} |`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
