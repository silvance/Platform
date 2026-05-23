import type { ScenarioSeed } from "./types";

// Static validator over the seed catalogue. Runs as the first step
// of the seed and as a Jest spec. Catches the most common
// malformed-content classes without needing a DB roundtrip:
//
//   - duplicate slugs (scenario, indicator-set within a scenario)
//   - duplicate artifact / question ordinals within a scenario
//   - select_indicators questions that reference an
//     indicator-set slug or item id that doesn't exist
//   - multi_choice questions whose correctIds aren't among the
//     declared options
//   - text_match questions with empty acceptableAnswers
//   - confidence questions with a malformed expectedRange
//   - empty briefs / artifacts / questions arrays
//
// A scenario that fails ANY check causes the validator to throw
// with a precise message naming the slug + the field at fault.
// "Fail loudly" is the M16 acceptance criterion.

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentValidationError";
  }
}

export function validateScenarios(scenarios: ScenarioSeed[]): void {
  const errors: string[] = [];
  const seenSlugs = new Set<string>();

  for (const s of scenarios) {
    const ctx = `[${s.slug}]`;

    if (!s.slug || !/^[a-z0-9][a-z0-9-]*$/.test(s.slug)) {
      errors.push(`${ctx} slug must be kebab-case [a-z0-9][a-z0-9-]*`);
    }
    if (seenSlugs.has(s.slug)) {
      errors.push(`${ctx} duplicate slug across the catalogue`);
    }
    seenSlugs.add(s.slug);

    if (!s.title?.trim()) errors.push(`${ctx} empty title`);
    if (!s.summary?.trim()) errors.push(`${ctx} empty summary`);
    if (!s.brief?.trim()) errors.push(`${ctx} empty brief`);

    if (!s.artifacts || s.artifacts.length === 0) {
      errors.push(`${ctx} must have at least one artifact`);
    } else {
      const ordinals = new Set<number>();
      const names = new Set<string>();
      for (const a of s.artifacts) {
        if (ordinals.has(a.ordinal)) {
          errors.push(`${ctx} duplicate artifact ordinal ${a.ordinal}`);
        }
        ordinals.add(a.ordinal);
        if (names.has(a.displayName)) {
          errors.push(`${ctx} duplicate artifact displayName "${a.displayName}"`);
        }
        names.add(a.displayName);
        if (!a.bytes || a.bytes.length === 0) {
          errors.push(`${ctx} artifact "${a.displayName}" has empty bytes`);
        }
      }
    }

    // Build the indicator-set lookup before walking questions so
    // select_indicators can validate references.
    const indicatorSets = new Map<string, Set<string>>();
    if (s.indicatorSets) {
      const setSlugs = new Set<string>();
      for (const set of s.indicatorSets) {
        if (setSlugs.has(set.slug)) {
          errors.push(`${ctx} duplicate indicator-set slug "${set.slug}"`);
        }
        setSlugs.add(set.slug);
        if (set.sourceArtifactDisplayName) {
          const artifactNames = new Set(
            (s.artifacts ?? []).map((a) => a.displayName),
          );
          if (!artifactNames.has(set.sourceArtifactDisplayName)) {
            errors.push(
              `${ctx} indicator-set "${set.slug}" sourceArtifactDisplayName ` +
                `"${set.sourceArtifactDisplayName}" does not match any artifact`,
            );
          }
        }
        const itemIds = new Set<string>();
        for (const item of set.items) {
          if (itemIds.has(item.id)) {
            errors.push(
              `${ctx} indicator-set "${set.slug}" duplicate item id "${item.id}"`,
            );
          }
          itemIds.add(item.id);
        }
        indicatorSets.set(set.slug, itemIds);
      }
    }

    if (!s.questions || s.questions.length === 0) {
      errors.push(`${ctx} must have at least one question`);
    } else {
      const ordinals = new Set<number>();
      for (const q of s.questions) {
        const qctx = `${ctx} q#${q.ordinal}`;
        if (ordinals.has(q.ordinal)) {
          errors.push(`${ctx} duplicate question ordinal ${q.ordinal}`);
        }
        ordinals.add(q.ordinal);

        if (!q.promptMd?.trim()) errors.push(`${qctx} empty promptMd`);
        if (!q.debriefMd?.trim()) errors.push(`${qctx} empty debriefMd`);
        if (!(q.weight > 0)) errors.push(`${qctx} weight must be > 0`);

        if (q.type === "multi_choice") {
          const optIds = new Set((q.options ?? []).map((o) => o.id));
          if (optIds.size === 0) {
            errors.push(`${qctx} multi_choice has no options`);
          }
          if (q.expected.type !== "multi_choice") {
            errors.push(`${qctx} expected.type does not match question type`);
          } else {
            for (const id of q.expected.correctIds) {
              if (!optIds.has(id)) {
                errors.push(
                  `${qctx} multi_choice correctId "${id}" not declared as an option`,
                );
              }
            }
          }
        } else if (q.type === "confidence") {
          if (q.expected.type !== "confidence") {
            errors.push(`${qctx} expected.type does not match question type`);
          } else {
            const [lo, hi] = q.expected.expectedRange;
            if (!(lo >= 1 && hi <= 5 && lo <= hi)) {
              errors.push(
                `${qctx} confidence expectedRange must be [lo<=hi] within [1,5]`,
              );
            }
          }
        } else if (q.type === "select_indicators") {
          if (!q.indicatorSetSlug) {
            errors.push(`${qctx} select_indicators missing indicatorSetSlug`);
          } else {
            const itemIds = indicatorSets.get(q.indicatorSetSlug);
            if (!itemIds) {
              errors.push(
                `${qctx} select_indicators references unknown indicator-set "${q.indicatorSetSlug}"`,
              );
            } else if (q.expected.type === "select_indicators") {
              for (const id of q.expected.correctIds) {
                if (!itemIds.has(id)) {
                  errors.push(
                    `${qctx} select_indicators correctId "${id}" not in indicator-set "${q.indicatorSetSlug}"`,
                  );
                }
              }
            }
          }
        } else if (q.type === "text_match") {
          if (q.expected.type !== "text_match") {
            errors.push(`${qctx} expected.type does not match question type`);
          } else if (q.expected.acceptableAnswers.length === 0) {
            errors.push(`${qctx} text_match has no acceptableAnswers`);
          }
          if (q.textMatch && q.textMatch.acceptableAnswers.length === 0) {
            errors.push(`${qctx} text_match.acceptableAnswers is empty`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new ContentValidationError(
      `Seed-content validation failed (${errors.length} issue(s)):\n  - ` +
        errors.join("\n  - "),
    );
  }
}
