import type { ArtifactKind, Lane, ScenarioStatus } from "@prisma/client";

// Shared seed-data shapes. Lives in its own file so the
// scenarios array (large + ever-growing) doesn't have to import
// from seed.ts and so the content validator can re-use the same
// interfaces without pulling in Prisma client lifecycle code.

export interface ArtifactSeed {
  ordinal: number;
  displayName: string;
  kind: ArtifactKind;
  mimeType: string;
  bytes: Buffer;
}

export interface IndicatorSetSeed {
  slug: string;
  displayName: string;
  // Optional artifact display name (e.g. "suspect-email.eml"); the
  // seed resolves this to an artifact id at write time. Null when
  // the indicators are not tied to a single artifact.
  sourceArtifactDisplayName?: string;
  items: Array<{ id: string; label: string; evidenceRef?: string }>;
}

export interface QuestionSeed {
  ordinal: number;
  type: "multi_choice" | "confidence" | "select_indicators" | "text_match";
  promptMd: string;
  weight: number;
  // multi_choice only.
  options?: Array<{ id: string; label: string }>;
  allowMultiple?: boolean;
  // select_indicators only — references IndicatorSetSeed.slug.
  indicatorSetSlug?: string;
  // text_match only — defaults: caseSensitive=false,
  // normalizeWhitespace=true, regex=false, hintAfterTries=3.
  textMatch?: {
    acceptableAnswers: string[];
    caseSensitive?: boolean;
    normalizeWhitespace?: boolean;
    regex?: boolean;
    hint?: string;
    hintAfterTries?: number;
  };
  // Type-specific expected payload. See AnswerKeyPayload in
  // @ci-train/contracts for the exact shape per type.
  expected:
    | { type: "multi_choice"; correctIds: string[]; allowMultiple: boolean }
    | { type: "confidence"; expectedRange: [number, number] }
    | { type: "select_indicators"; correctIds: string[] }
    | { type: "text_match"; acceptableAnswers: string[]; regex: boolean };
  debriefMd: string;
}

export interface ScenarioSeed {
  slug: string;
  title: string;
  summary: string;
  skillAreas: string[];
  difficulty: number;
  estimatedMinutes: number;
  tags: string[];
  brief: string;
  disclaimer?: string;
  artifacts: ArtifactSeed[];
  questions: QuestionSeed[];
  indicatorSets?: IndicatorSetSeed[];
  // M16 tiering: scenarios default to "published" (visible to
  // every signed-in user). Set "draft" for the Tier-2 bulk
  // content — admins still see drafts in /admin/challenges and
  // can solve them; regular users see only published scenarios.
  // Keeps the launch surface curated without losing the
  // less-polished material.
  status?: ScenarioStatus;
  // M25 curated-library placement.
  lane: Lane;
  module?: string;
  sequence?: number;
}
