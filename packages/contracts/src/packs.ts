import { z } from "zod";
import {
  ArtifactKind,
  Difficulty,
  ScenarioSlug,
  SkillArea,
  MAX_BRIEF_MARKDOWN_CHARS,
  MAX_DISCLAIMER_MARKDOWN_CHARS,
} from "./scenarios.js";
import {
  ConfidenceValue,
  IndicatorItem,
  MAX_DEBRIEF_MD_CHARS,
  MAX_HINT_CHARS,
  MAX_INDICATOR_ITEMS,
  MAX_INDICATOR_SET_NAME_CHARS,
  MAX_INDICATOR_SET_SLUG_CHARS,
  MAX_MC_OPTIONS,
  MAX_PROMPT_MD_CHARS,
  MAX_TEXT_MATCH_ACCEPTABLE_ANSWERS,
  MAX_TEXT_MATCH_CHARS,
  McOption,
} from "./questions.js";

// M11 — content packs. A scenario can be exported as a ZIP containing
// `manifest.json` (this schema) + `artifacts/<packArtifactId><ext>`
// blobs. Import recreates the scenario by walking the manifest, with
// integrity checks at every step (sha256 per artifact, slug
// uniqueness, indicator-set + question references resolved via the
// pack-local IDs).
//
// Pack-local IDs are deliberately scoped to the archive: they exist
// only to express references *inside* a pack (question →
// indicator-set, indicator-set → artifact). The importer mints fresh
// UUIDs for the receiving deployment.

export const PACK_FORMAT = "ci-train-pack" as const;
export const PACK_VERSION = 1;
// Pack-wide cap. Per-artifact cap is enforced separately by the
// multer limit (25 MiB); the pack cap is a guardrail against a runaway
// upload with many artifacts.
export const MAX_PACK_BYTES = 200 * 1024 * 1024;

// Pack-local artifact id. Just a uuid; in-pack-only namespace.
export const PackArtifactId = z.string().uuid();
export type PackArtifactId = z.infer<typeof PackArtifactId>;

export const PackArtifact = z.object({
  // Pack-local id; the importer rewrites this to a fresh server-side
  // uuid. Indicator sets and questions reference this id, not the
  // future server uuid.
  packId: PackArtifactId,
  ordinal: z.number().int().nonnegative(),
  displayName: z.string().min(1).max(200),
  kind: ArtifactKind,
  mimeType: z.string().min(1).max(120),
  viewerHint: z.string().max(60).nullable(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  sizeBytes: z.number().int().nonnegative(),
  // The relative path inside the ZIP archive. Always under
  // `artifacts/`. Importer rejects anything outside this directory.
  archivePath: z.string().min(1).max(400),
});
export type PackArtifact = z.infer<typeof PackArtifact>;

export const PackIndicatorSet = z.object({
  slug: z
    .string()
    .min(1)
    .max(MAX_INDICATOR_SET_SLUG_CHARS)
    .regex(
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
      "Indicator set slug must be lowercase alphanumeric with hyphens.",
    ),
  displayName: z.string().min(1).max(MAX_INDICATOR_SET_NAME_CHARS),
  // Pack-local artifact reference; null if the set isn't tied to one.
  sourcePackArtifactId: PackArtifactId.nullable(),
  items: z.array(IndicatorItem).min(2).max(MAX_INDICATOR_ITEMS),
});
export type PackIndicatorSet = z.infer<typeof PackIndicatorSet>;

// Question payloads carried in the pack. Mirror the authoring shapes
// but reference indicator sets by slug (per-scenario unique already)
// rather than by id.
const PackBaseQuestion = {
  ordinal: z.number().int().nonnegative(),
  promptMd: z.string().min(1).max(MAX_PROMPT_MD_CHARS),
  weight: z.number().int().min(1).max(10),
  debriefMd: z.string().min(1).max(MAX_DEBRIEF_MD_CHARS),
};

export const PackMultiChoice = z.object({
  type: z.literal("multi_choice"),
  ...PackBaseQuestion,
  options: z.array(McOption).min(2).max(MAX_MC_OPTIONS),
  allowMultiple: z.boolean(),
  correctIds: z.array(z.string()).min(1),
});

export const PackConfidence = z.object({
  type: z.literal("confidence"),
  ...PackBaseQuestion,
  expectedRange: z.tuple([ConfidenceValue, ConfidenceValue]),
});

export const PackTextMatch = z.object({
  type: z.literal("text_match"),
  ...PackBaseQuestion,
  acceptableAnswers: z
    .array(z.string().min(1).max(MAX_TEXT_MATCH_CHARS))
    .min(1)
    .max(MAX_TEXT_MATCH_ACCEPTABLE_ANSWERS),
  caseSensitive: z.boolean(),
  normalizeWhitespace: z.boolean(),
  regex: z.boolean(),
  hint: z.string().max(MAX_HINT_CHARS).nullable(),
  hintAfterTries: z.number().int().min(1).max(10),
});

export const PackSelectIndicators = z.object({
  type: z.literal("select_indicators"),
  ...PackBaseQuestion,
  indicatorSetSlug: z.string(),
  correctIds: z.array(z.string()).min(1),
});

export const PackQuestion = z.discriminatedUnion("type", [
  PackMultiChoice,
  PackConfidence,
  PackTextMatch,
  PackSelectIndicators,
]);
export type PackQuestion = z.infer<typeof PackQuestion>;

// Manifest. Stored as `manifest.json` at the root of the ZIP.
export const PackManifest = z.object({
  format: z.literal(PACK_FORMAT),
  // Pack format version. Bumped if the schema changes incompatibly.
  // The importer checks this is exactly PACK_VERSION and refuses
  // unknown versions.
  version: z.literal(PACK_VERSION),
  // Provenance — informational only. Importer ignores these for
  // decisions but echoes them in the response so admins can see
  // where a pack came from.
  exportedAt: z.string().datetime(),
  // Source deployment hostname or build tag. Optional; null for
  // anonymized exports.
  exportedFrom: z.string().max(200).nullable(),
  scenario: z.object({
    slug: ScenarioSlug,
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(1000),
    skillAreas: z.array(SkillArea).min(1).max(10),
    difficulty: Difficulty,
    estimatedMinutes: z.number().int().positive().max(600).nullable(),
    tags: z.array(z.string()).max(20),
    brief: z.object({
      markdownBody: z.string().min(1).max(MAX_BRIEF_MARKDOWN_CHARS),
      disclaimerMd: z
        .string()
        .max(MAX_DISCLAIMER_MARKDOWN_CHARS)
        .nullable(),
    }),
    artifacts: z.array(PackArtifact),
    indicatorSets: z.array(PackIndicatorSet),
    questions: z.array(PackQuestion),
  }),
});
export type PackManifest = z.infer<typeof PackManifest>;

// Response from POST /admin/challenges/import. Mirrors the
// AdminScenarioSummary so the web client can navigate straight to the
// editor for the new scenario.
export const ImportPackResponse = z.object({
  slug: ScenarioSlug,
  scenarioId: z.string().uuid(),
  artifactsImported: z.number().int().nonnegative(),
  indicatorSetsImported: z.number().int().nonnegative(),
  questionsImported: z.number().int().nonnegative(),
});
export type ImportPackResponse = z.infer<typeof ImportPackResponse>;
