import { z } from "zod";

// Keep in sync with `enum QuestionType` in apps/api/prisma/schema.prisma.
// M5 implements multi_choice, short_answer, long_answer, confidence.
// M6 adds select_indicators.
export const QuestionType = z.enum([
  "multi_choice",
  "short_answer",
  "long_answer",
  "confidence",
  "select_indicators",
]);
export type QuestionType = z.infer<typeof QuestionType>;

// Caps shared by API + web so a pathological response from a buggy
// authoring path or a malicious trainee POST can't lock up the renderer
// or DB. JS string length, matching Zod's `.max()`.
export const MAX_SHORT_ANSWER_CHARS = 500;
export const MAX_LONG_ANSWER_CHARS = 5_000;
export const MAX_INSTRUCTOR_NOTES_CHARS = 5_000;
export const MAX_PROMPT_MD_CHARS = 5_000;
export const MAX_DEBRIEF_MD_CHARS = 10_000;
export const MAX_MC_OPTIONS = 20;
export const MAX_MC_OPTION_LABEL_CHARS = 200;
export const MAX_QUESTIONS_PER_SCENARIO = 50;
// M6 — indicator sets. Set size cap matches the MC cap rationale:
// "small enough to scan, large enough for real scenarios."
export const MAX_INDICATOR_ITEMS = 40;
export const MAX_INDICATOR_LABEL_CHARS = 400;
export const MAX_INDICATOR_SET_NAME_CHARS = 120;
export const MAX_INDICATOR_SET_SLUG_CHARS = 120;

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

// ─── short_answer / long_answer ──────────────────────────────────
export const ShortAnswerResponse = z.object({
  text: z.string().max(MAX_SHORT_ANSWER_CHARS),
});
export type ShortAnswerResponse = z.infer<typeof ShortAnswerResponse>;

export const LongAnswerResponse = z.object({
  text: z.string().max(MAX_LONG_ANSWER_CHARS),
});
export type LongAnswerResponse = z.infer<typeof LongAnswerResponse>;

// ─── select_indicators ───────────────────────────────────────────
// An indicator set is authored separately from the question and is
// referenced by a select_indicators question. The same set can back
// multiple questions (e.g. "which indicators support BEC?" and
// "which indicators overclaim?"). Items carry no correctness flag —
// the answer key lives in the AnswerKey row, same isolation as MC.
export const IndicatorItem = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(MAX_INDICATOR_LABEL_CHARS),
  // Optional free-form pointer back to the source artifact line/row.
  // Not validated against the artifact — purely UI hint.
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
// Standard 1-5 scale. Auto-graded against an expected range; "calibration"
// rather than "correctness" — matches the inference-discipline theme.
export const ConfidenceValue = z.number().int().min(1).max(5);
export type ConfidenceValue = z.infer<typeof ConfidenceValue>;

export const ConfidenceResponse = z.object({
  value: ConfidenceValue,
});
export type ConfidenceResponse = z.infer<typeof ConfidenceResponse>;

// Response discriminated union — the shape depends on the question's type.
export const QuestionResponse = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multi_choice"), data: McResponse }),
  z.object({ type: z.literal("short_answer"), data: ShortAnswerResponse }),
  z.object({ type: z.literal("long_answer"), data: LongAnswerResponse }),
  z.object({ type: z.literal("confidence"), data: ConfidenceResponse }),
  z.object({ type: z.literal("select_indicators"), data: SelectIndicatorsResponse }),
]);
export type QuestionResponse = z.infer<typeof QuestionResponse>;

// ─── question + answer-key payloads ──────────────────────────────
// Trainee view: prompt + options (without correctness leak) + weight.
export const QuestionPayload = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  type: QuestionType,
  promptMd: z.string().min(1).max(MAX_PROMPT_MD_CHARS),
  weight: z.number().int().positive(),
  // Only present for multi_choice; client uses it to render the option list.
  // Critically: this never carries correctness — that lives in the answer
  // key, which is only released at /debrief.
  options: z.array(McOption).nullable(),
  allowMultiple: z.boolean().nullable(),
  // Only present for select_indicators. Same correctness-isolation
  // discipline — the items list never reveals which are expected.
  indicatorSet: IndicatorSetPayload.nullable(),
});
export type QuestionPayload = z.infer<typeof QuestionPayload>;

// Auto-grading verdicts.
export const AutoScoreOutcome = z.enum([
  "correct",
  "incorrect",
  "partial",
  "in_range",
  "out_of_range",
  "ungradable",
]);
export type AutoScoreOutcome = z.infer<typeof AutoScoreOutcome>;

// Answer-key payload returned ONLY at /debrief. Includes the expected
// data shape per type and the markdown rubric/explanation.
export const AnswerKeyPayload = z.object({
  // Same discriminated shape as the response, but with the *expected*
  // value. For confidence we expose the acceptable range, not a single
  // value — calibration framing.
  expected: z.discriminatedUnion("type", [
    z.object({ type: z.literal("multi_choice"), correctIds: z.array(z.string()), allowMultiple: z.boolean() }),
    z.object({ type: z.literal("short_answer"), rubricNote: z.string().nullable() }),
    z.object({ type: z.literal("long_answer"), rubricNote: z.string().nullable() }),
    z.object({ type: z.literal("confidence"), expectedRange: z.tuple([ConfidenceValue, ConfidenceValue]) }),
    z.object({ type: z.literal("select_indicators"), correctIds: z.array(z.string()) }),
  ]),
  debriefMd: z.string().min(1).max(MAX_DEBRIEF_MD_CHARS),
});
export type AnswerKeyPayload = z.infer<typeof AnswerKeyPayload>;

// ─── attempt payloads ────────────────────────────────────────────
export const AttemptStatus = z.enum(["in_progress", "submitted"]);
export type AttemptStatus = z.infer<typeof AttemptStatus>;

// Per-question state inside an in-progress attempt. responseJson is
// whatever the trainee last autosaved (or null if untouched). Includes
// metadata about whether the question is auto-gradable so the UI can
// signal "manual review required" for narrative answers.
export const AttemptAnswerPayload = z.object({
  questionId: z.string().uuid(),
  response: QuestionResponse.nullable(),
  // Populated only after submit.
  autoScore: z.number().min(0).max(1).nullable(),
  autoOutcome: AutoScoreOutcome.nullable(),
  manualScore: z.number().min(0).max(1).nullable(),
  instructorNotesMd: z.string().max(MAX_INSTRUCTOR_NOTES_CHARS).nullable(),
});
export type AttemptAnswerPayload = z.infer<typeof AttemptAnswerPayload>;

export const AttemptPayload = z.object({
  id: z.string().uuid(),
  scenarioSlug: z.string(),
  scenarioTitle: z.string(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  status: AttemptStatus,
  totalScore: z.number().min(0).nullable(),
  maxScore: z.number().positive(),
  questions: z.array(QuestionPayload),
  answers: z.array(AttemptAnswerPayload),
});
export type AttemptPayload = z.infer<typeof AttemptPayload>;

// Debrief response — only available once submitted. Includes the
// AnswerKeyPayload alongside the trainee's response.
export const DebriefAnswerPayload = AttemptAnswerPayload.extend({
  question: QuestionPayload,
  answerKey: AnswerKeyPayload,
});
export type DebriefAnswerPayload = z.infer<typeof DebriefAnswerPayload>;

export const DebriefPayload = z.object({
  attemptId: z.string().uuid(),
  scenarioSlug: z.string(),
  scenarioTitle: z.string(),
  submittedAt: z.string().datetime(),
  totalScore: z.number().min(0),
  maxScore: z.number().positive(),
  answers: z.array(DebriefAnswerPayload),
});
export type DebriefPayload = z.infer<typeof DebriefPayload>;

// ─── PATCH body ──────────────────────────────────────────────────
// Trainee autosave: one question's response at a time.
export const SaveAnswerRequest = z.object({
  response: QuestionResponse,
});
export type SaveAnswerRequest = z.infer<typeof SaveAnswerRequest>;
