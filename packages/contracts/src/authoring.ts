import { z } from "zod";
import {
  Difficulty,
  ScenarioSlug,
  ScenarioStatus,
  SkillArea,
  MAX_BRIEF_MARKDOWN_CHARS,
  MAX_DISCLAIMER_MARKDOWN_CHARS,
} from "./scenarios.js";
import {
  ConfidenceValue,
  MAX_DEBRIEF_MD_CHARS,
  MAX_HINT_CHARS,
  MAX_MC_OPTIONS,
  MAX_MC_OPTION_LABEL_CHARS,
  MAX_PROMPT_MD_CHARS,
  MAX_TEXT_MATCH_ACCEPTABLE_ANSWERS,
  MAX_TEXT_MATCH_CHARS,
  McOption,
} from "./questions.js";

// M8 — challenge authoring. These shapes carry the *full* authored
// payload: prompt + options + correctness + debrief, all in one
// request. That's safe because authoring endpoints sit behind an
// instructor-only role check; trainees never see anything but the
// trainee-facing payloads in questions.ts.
//
// MVP scope: multi_choice, confidence, text_match. select_indicators
// requires an indicator-set authoring surface and is deferred to a
// later milestone — existing seeded select_indicators questions
// remain readable / submittable via the trainee surface.

// ─── scenario ────────────────────────────────────────────────────

export const ScenarioBriefDraft = z.object({
  markdownBody: z.string().min(1).max(MAX_BRIEF_MARKDOWN_CHARS),
  disclaimerMd: z
    .string()
    .max(MAX_DISCLAIMER_MARKDOWN_CHARS)
    .nullable()
    .optional(),
});
export type ScenarioBriefDraft = z.infer<typeof ScenarioBriefDraft>;

// Tag bounds: lowercase + hyphen, ≤40 chars, ≤20 per scenario. Keeps
// admin-typed input from blowing up the catalog `tags` chip cluster.
export const ScenarioTag = z
  .string()
  .min(1)
  .max(40)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Tags must be lowercase alphanumeric with hyphens.",
  );

export const CreateScenarioRequest = z.object({
  slug: ScenarioSlug,
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  skillAreas: z.array(SkillArea).min(1).max(10),
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().positive().max(600).nullable().optional(),
  tags: z.array(ScenarioTag).max(20).default([]),
  status: ScenarioStatus.default("draft"),
  brief: ScenarioBriefDraft,
});
export type CreateScenarioRequest = z.infer<typeof CreateScenarioRequest>;

// Update is partial. Slug is fixed at create time — renaming it would
// invalidate every artifact relative path and bookmarked URL.
export const UpdateScenarioRequest = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(1000).optional(),
  skillAreas: z.array(SkillArea).min(1).max(10).optional(),
  difficulty: Difficulty.optional(),
  estimatedMinutes: z.number().int().positive().max(600).nullable().optional(),
  tags: z.array(ScenarioTag).max(20).optional(),
  status: ScenarioStatus.optional(),
  brief: ScenarioBriefDraft.optional(),
});
export type UpdateScenarioRequest = z.infer<typeof UpdateScenarioRequest>;

// ─── question drafts (authoring) ─────────────────────────────────

// Per-type payload. The discriminator carries both the question type
// AND the authored expected value, since correctness lives next to the
// option set at authoring time even though the runtime DB splits them
// across Question + AnswerKey rows.

const BaseQuestionFields = {
  promptMd: z.string().min(1).max(MAX_PROMPT_MD_CHARS),
  weight: z.number().int().min(1).max(10).default(1),
  debriefMd: z.string().min(1).max(MAX_DEBRIEF_MD_CHARS),
};

export const MultiChoiceDraft = z.object({
  type: z.literal("multi_choice"),
  ...BaseQuestionFields,
  options: z.array(McOption).min(2).max(MAX_MC_OPTIONS),
  allowMultiple: z.boolean().default(false),
  correctIds: z.array(z.string().min(1).max(40)).min(1),
});

export const ConfidenceDraft = z.object({
  type: z.literal("confidence"),
  ...BaseQuestionFields,
  expectedRange: z.tuple([ConfidenceValue, ConfidenceValue]),
});

export const TextMatchDraft = z.object({
  type: z.literal("text_match"),
  ...BaseQuestionFields,
  acceptableAnswers: z
    .array(z.string().min(1).max(MAX_TEXT_MATCH_CHARS))
    .min(1)
    .max(MAX_TEXT_MATCH_ACCEPTABLE_ANSWERS),
  caseSensitive: z.boolean().default(false),
  normalizeWhitespace: z.boolean().default(true),
  regex: z.boolean().default(false),
  hint: z.string().max(MAX_HINT_CHARS).nullable().optional(),
  hintAfterTries: z.number().int().min(1).max(10).default(3),
});

export const CreateQuestionRequest = z.discriminatedUnion("type", [
  MultiChoiceDraft,
  ConfidenceDraft,
  TextMatchDraft,
]);
export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequest>;

// Update is the same discriminated union — easier on validation than
// trying to partial each variant. The service re-orders ordinals on
// reads, so the client doesn't supply it.
export const UpdateQuestionRequest = CreateQuestionRequest;
export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionRequest>;

// ─── responses ───────────────────────────────────────────────────

// Light scenario summary returned by POST/PATCH/DELETE on scenarios
// and by the GET /admin/challenges list. Mirrors ScenarioListItem but
// includes the question count so the list view can show "5 questions".
export const AdminScenarioSummary = z.object({
  id: z.string().uuid(),
  slug: ScenarioSlug,
  title: z.string(),
  summary: z.string(),
  skillAreas: z.array(SkillArea),
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().positive().nullable(),
  tags: z.array(z.string()),
  status: ScenarioStatus,
  questionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AdminScenarioSummary = z.infer<typeof AdminScenarioSummary>;

export const AdminScenarioListResponse = z.object({
  scenarios: z.array(AdminScenarioSummary),
});
export type AdminScenarioListResponse = z.infer<
  typeof AdminScenarioListResponse
>;

// Question payload as seen by the *author* — carries correctness too.
// This is the full editable shape; trainees see QuestionPayload, which
// strips the answer key. We don't reuse the *Draft schemas here because
// those carry `.default()` modifiers (appropriate for request bodies);
// response schemas need the fields to always be present, no defaulting.
const AuthoredBase = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  promptMd: z.string().min(1).max(MAX_PROMPT_MD_CHARS),
  weight: z.number().int().min(1).max(10),
  debriefMd: z.string().min(1).max(MAX_DEBRIEF_MD_CHARS),
});
const AuthoredMultiChoice = AuthoredBase.extend({
  type: z.literal("multi_choice"),
  options: z.array(McOption).min(2).max(MAX_MC_OPTIONS),
  allowMultiple: z.boolean(),
  correctIds: z.array(z.string().min(1).max(40)).min(1),
});
const AuthoredConfidence = AuthoredBase.extend({
  type: z.literal("confidence"),
  expectedRange: z.tuple([ConfidenceValue, ConfidenceValue]),
});
const AuthoredTextMatch = AuthoredBase.extend({
  type: z.literal("text_match"),
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

// `unsupported` carries questions that exist in the DB but whose type
// the M8 admin UI can't yet edit (select_indicators or, defensively,
// anything else). The list endpoint still returns them so the admin
// sees them in the question list and isn't confused by a missing row.
export const AuthoredQuestion = z.discriminatedUnion("type", [
  AuthoredMultiChoice,
  AuthoredConfidence,
  AuthoredTextMatch,
  z.object({
    type: z.literal("unsupported"),
    id: z.string().uuid(),
    ordinal: z.number().int().nonnegative(),
    promptMd: z.string(),
    weight: z.number().int().nonnegative(),
    underlyingType: z.string(),
  }),
]);
export type AuthoredQuestion = z.infer<typeof AuthoredQuestion>;

export const AdminScenarioDetail = AdminScenarioSummary.extend({
  brief: ScenarioBriefDraft.nullable(),
  questions: z.array(AuthoredQuestion),
});
export type AdminScenarioDetail = z.infer<typeof AdminScenarioDetail>;
