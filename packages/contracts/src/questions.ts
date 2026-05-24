import { z } from "zod";

// Keep in sync with `enum QuestionType` in apps/api/prisma/schema.prisma.
//
// Challenge-mode question types: every question auto-grades and the
// user retries until correct. M7 introduced this set and dropped the
// instructor-graded short_answer / long_answer; M8 removed those from
// the Postgres enum entirely.
export const QuestionType = z.enum([
  "multi_choice",
  "confidence",
  "select_indicators",
  "text_match",
]);
export type QuestionType = z.infer<typeof QuestionType>;

// Caps shared by API + web so a pathological response from a buggy
// authoring path or a malicious trainee POST can't lock up the renderer
// or DB. JS string length, matching Zod's `.max()`.
export const MAX_PROMPT_MD_CHARS = 5_000;
export const MAX_DEBRIEF_MD_CHARS = 10_000;
export const MAX_MC_OPTIONS = 20;
// Multi-choice option labels often need to spell out the
// difference between near-identical wordings; 200 chars wasn't
// enough for some scenarios and silently dropped options at parse
// time. 500 covers every realistic case while still capping
// authoring-side abuse.
export const MAX_MC_OPTION_LABEL_CHARS = 500;
export const MAX_QUESTIONS_PER_SCENARIO = 50;
// Indicator sets — M6.
export const MAX_INDICATOR_ITEMS = 40;
export const MAX_INDICATOR_LABEL_CHARS = 400;
export const MAX_INDICATOR_SET_NAME_CHARS = 120;
export const MAX_INDICATOR_SET_SLUG_CHARS = 120;
// Text-match — M7.
export const MAX_TEXT_MATCH_CHARS = 500;
export const MAX_TEXT_MATCH_ACCEPTABLE_ANSWERS = 20;
// Hint shown to the trainee on incorrect attempts (optional, authored).
export const MAX_HINT_CHARS = 400;

// ─── multi_choice ────────────────────────────────────────────────
// options[].id is an opaque short string assigned at authoring time;
// it never reveals correctness. Trainee responses reference option ids.
export const McOption = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(MAX_MC_OPTION_LABEL_CHARS),
});
export type McOption = z.infer<typeof McOption>;

export const McOptionsSpec = z.object({
  options: z.array(McOption).min(2).max(MAX_MC_OPTIONS),
  allowMultiple: z.boolean(),
});
export type McOptionsSpec = z.infer<typeof McOptionsSpec>;

export const McResponse = z.object({
  selectedIds: z.array(z.string().min(1).max(40)).max(MAX_MC_OPTIONS),
});
export type McResponse = z.infer<typeof McResponse>;

// ─── select_indicators ───────────────────────────────────────────
export const IndicatorItem = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(MAX_INDICATOR_LABEL_CHARS),
  evidenceRef: z.string().max(200).nullable().optional(),
});
export type IndicatorItem = z.infer<typeof IndicatorItem>;

export const IndicatorSetPayload = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(MAX_INDICATOR_SET_SLUG_CHARS),
  displayName: z.string().min(1).max(MAX_INDICATOR_SET_NAME_CHARS),
  sourceArtifactId: z.string().uuid().nullable(),
  items: z.array(IndicatorItem).min(2).max(MAX_INDICATOR_ITEMS),
});
export type IndicatorSetPayload = z.infer<typeof IndicatorSetPayload>;

export const SelectIndicatorsResponse = z.object({
  selectedIds: z.array(z.string().min(1).max(60)).max(MAX_INDICATOR_ITEMS),
});
export type SelectIndicatorsResponse = z.infer<typeof SelectIndicatorsResponse>;

// ─── confidence ──────────────────────────────────────────────────
// 1-5 scale. Auto-graded against an expected range; framed as
// "calibration" rather than correctness.
export const ConfidenceValue = z.number().int().min(1).max(5);
export type ConfidenceValue = z.infer<typeof ConfidenceValue>;

export const ConfidenceResponse = z.object({
  value: ConfidenceValue,
});
export type ConfidenceResponse = z.infer<typeof ConfidenceResponse>;

// ─── text_match ──────────────────────────────────────────────────
// Free-text answer matched against an authored acceptable-answers list.
// Covers the CTF-flag use case (single canonical answer, case-insensitive)
// and short-answer prompts where the expected answer space is small.
//
// Normalization (applied before comparison):
//   1. trim leading/trailing whitespace
//   2. if normalizeWhitespace, collapse runs of internal whitespace to a single space
//   3. if !caseSensitive, lowercase
//
// `regex: true` flips matching to test each acceptable string as a JS
// regex (single-line, optionally case-insensitive per the flag). Used
// for "match anything containing the IP address 10.0.0.5" patterns.
//
// `TextMatchOptionsSpec` is the parameters-only payload stored at
// `Question.optionsJson` — **no answer strings**. The acceptable answers
// themselves live exclusively on `AnswerKey.expectedJson` so a leaked
// Question row never carries correctness data.
export const TextMatchOptionsSpec = z.object({
  caseSensitive: z.boolean().default(false),
  normalizeWhitespace: z.boolean().default(true),
  regex: z.boolean().default(false),
  // Optional hint shown when the trainee gets it wrong (not on first
  // try — see the hintAfterTries field).
  hint: z.string().max(MAX_HINT_CHARS).nullable().optional(),
  hintAfterTries: z.number().int().min(1).max(10).default(3),
});
export type TextMatchOptionsSpec = z.infer<typeof TextMatchOptionsSpec>;

export const TextMatchResponse = z.object({
  text: z.string().max(MAX_TEXT_MATCH_CHARS),
});
export type TextMatchResponse = z.infer<typeof TextMatchResponse>;

// Response discriminated union — the shape depends on the question's type.
export const QuestionResponse = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multi_choice"), data: McResponse }),
  z.object({ type: z.literal("confidence"), data: ConfidenceResponse }),
  z.object({ type: z.literal("select_indicators"), data: SelectIndicatorsResponse }),
  z.object({ type: z.literal("text_match"), data: TextMatchResponse }),
]);
export type QuestionResponse = z.infer<typeof QuestionResponse>;

// ─── question payload ────────────────────────────────────────────
// Trainee view. Carries enough info to render the widget but nothing
// that leaks correctness — that lives in the AnswerKey and is only
// returned once the trainee has completed the question.
export const QuestionPayload = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  type: QuestionType,
  promptMd: z.string().min(1).max(MAX_PROMPT_MD_CHARS),
  weight: z.number().int().positive(),
  // multi_choice only.
  options: z.array(McOption).nullable(),
  allowMultiple: z.boolean().nullable(),
  // select_indicators only.
  indicatorSet: IndicatorSetPayload.nullable(),
  // text_match only — the *parameters* (case-sensitive flag, normalize
  // whitespace, char cap). The acceptable answers themselves are NOT
  // exposed; they live in the AnswerKey.
  textMatch: z
    .object({
      caseSensitive: z.boolean(),
      normalizeWhitespace: z.boolean(),
      regex: z.boolean(),
      maxLength: z.number().int().positive(),
    })
    .nullable(),
});
export type QuestionPayload = z.infer<typeof QuestionPayload>;

// Answer key, revealed only when the trainee has completed the question.
// Discriminated by question type so the client can render the expected
// answer next to the trainee's last response.
export const AnswerKeyPayload = z.object({
  expected: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("multi_choice"),
      correctIds: z.array(z.string()),
      allowMultiple: z.boolean(),
    }),
    z.object({
      type: z.literal("confidence"),
      expectedRange: z.tuple([ConfidenceValue, ConfidenceValue]),
    }),
    z.object({
      type: z.literal("select_indicators"),
      correctIds: z.array(z.string()),
    }),
    z.object({
      type: z.literal("text_match"),
      // The list of acceptable answers, revealed at debrief. Useful so
      // the trainee can see "the canonical phrasing" even if their
      // own correct phrasing was a synonym.
      acceptableAnswers: z.array(z.string()),
      regex: z.boolean(),
    }),
  ]),
  debriefMd: z.string().min(1).max(MAX_DEBRIEF_MD_CHARS),
});
export type AnswerKeyPayload = z.infer<typeof AnswerKeyPayload>;

// ─── progress payloads (M7 challenge mode) ───────────────────────

// Per-question state for one trainee on one scenario.
export const QuestionStatePayload = z.object({
  questionId: z.string().uuid(),
  attemptCount: z.number().int().nonnegative(),
  completedAt: z.string().datetime().nullable(),
  // The trainee's most-recently-submitted response. May be null if they
  // haven't tried yet, or if the question type doesn't persist drafts
  // (text_match always persists; MC/select_indicators/confidence
  // persist the last submitted answer too so the widget can rehydrate).
  lastResponse: QuestionResponse.nullable(),
  // Revealed ONLY when completedAt is set. The whole-scenario progress
  // endpoint returns nulls for these on incomplete questions; the
  // submit endpoint returns them on the response that just completed.
  answerKey: AnswerKeyPayload.nullable(),
});
export type QuestionStatePayload = z.infer<typeof QuestionStatePayload>;

// Self-progress: one row per scenario the signed-in user has touched.
// Returned by GET /v1/me/progress. Trimmer than ScenarioProgressPayload —
// no per-question payloads, just the headline counters so the listing
// page renders fast.
export const MeProgressRow = z.object({
  scenarioId: z.string().uuid(),
  scenarioSlug: z.string(),
  scenarioTitle: z.string(),
  scenarioStatus: z.enum(["draft", "published", "archived"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  completedQuestions: z.number().int().nonnegative(),
  totalQuestions: z.number().int().nonnegative(),
});
export type MeProgressRow = z.infer<typeof MeProgressRow>;

export const MeProgressResponse = z.object({
  rows: z.array(MeProgressRow),
  // Pre-computed aggregate so the page doesn't recompute totals from
  // the row set — purely for display, not for any access-control
  // decisions.
  totals: z.object({
    scenariosTouched: z.number().int().nonnegative(),
    scenariosCompleted: z.number().int().nonnegative(),
  }),
});
export type MeProgressResponse = z.infer<typeof MeProgressResponse>;

// Whole-scenario progress for one user. Returned by
// GET /v1/scenarios/:slug/progress.
export const ScenarioProgressPayload = z.object({
  scenarioSlug: z.string(),
  scenarioTitle: z.string(),
  // null until the trainee submits their first answer.
  startedAt: z.string().datetime().nullable(),
  // Set when completedQuestions === totalQuestions.
  completedAt: z.string().datetime().nullable(),
  completedQuestions: z.number().int().nonnegative(),
  totalQuestions: z.number().int().nonnegative(),
  questions: z.array(QuestionPayload),
  responses: z.array(QuestionStatePayload),
});
export type ScenarioProgressPayload = z.infer<typeof ScenarioProgressPayload>;

// POST /v1/scenarios/:slug/questions/:id/submit
export const SubmitAnswerRequest = z.object({
  response: QuestionResponse,
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequest>;

// Response to a submit. `completedJustNow` distinguishes "you got it
// right on this submission" from "you'd already completed it before";
// the UI uses that to play the celebration animation only once.
export const SubmitAnswerResponse = z.object({
  correct: z.boolean(),
  completedJustNow: z.boolean(),
  attemptCount: z.number().int().positive(),
  // Set when correct. Includes the answer key + debrief markdown so
  // the UI can reveal them in-place after the trainee gets it right.
  answerKey: AnswerKeyPayload.nullable(),
  // Optional hint, shown when incorrect *and* attemptCount has crossed
  // the authored hintAfterTries threshold (text_match only in M7).
  hint: z.string().max(MAX_HINT_CHARS).nullable(),
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponse>;
