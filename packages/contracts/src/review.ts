import { z } from "zod";

// M21b admin-only review workflow. Mirrors the
// ScenarioReviewStatus Prisma enum exactly — keep these in
// sync. None of these fields are user-visible; they live on
// AdminScenarioSummary / AdminScenarioDetail so the admin UI
// can render them, and on AuthoredQuestion so per-question
// notes appear in the authoring editor.

export const ScenarioReviewStatus = z.enum([
  "needs_review",
  "approved",
  "needs_rewrite",
  "too_generic",
  "unclear_question",
  "answer_key_issue",
  "debrief_issue",
  "retire_candidate",
]);
export type ScenarioReviewStatus = z.infer<typeof ScenarioReviewStatus>;

// Human-readable labels for the status enum, surfaced in
// dropdowns / filter chips so the UI doesn't have to hard-code
// the strings.
export const REVIEW_STATUS_LABELS: Record<ScenarioReviewStatus, string> = {
  needs_review: "Needs review",
  approved: "Approved",
  needs_rewrite: "Needs rewrite",
  too_generic: "Too generic",
  unclear_question: "Unclear question",
  answer_key_issue: "Answer-key issue",
  debrief_issue: "Debrief issue",
  retire_candidate: "Retire / delete candidate",
};

const REVIEW_NOTES_MAX = 4000;

// PATCH /v1/admin/challenges/:slug/review. status is required;
// notes is optional and overwrites the prior value when set.
// Pass `notes: ""` to clear notes explicitly.
export const SetScenarioReviewRequest = z.object({
  status: ScenarioReviewStatus,
  notes: z.string().max(REVIEW_NOTES_MAX).optional(),
});
export type SetScenarioReviewRequest = z.infer<typeof SetScenarioReviewRequest>;

// PATCH /v1/admin/challenges/:slug/questions/:questionId/review.
// notes only — questions don't carry their own status enum, the
// scenario-level status captures the verdict.
export const SetQuestionReviewRequest = z.object({
  notes: z.string().max(REVIEW_NOTES_MAX),
});
export type SetQuestionReviewRequest = z.infer<typeof SetQuestionReviewRequest>;

// Lightweight reviewer summary for the /admin/review list. We
// don't carry the full PublicUser shape — display name is enough
// for the table.
export const ReviewerSummary = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
});
export type ReviewerSummary = z.infer<typeof ReviewerSummary>;

// /admin/review row: enough to render the review table without
// fetching each scenario detail. Per-question notes are NOT
// included here — they live on AuthoredQuestion (in the editor)
// to keep this payload small.
export const AdminReviewRow = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()),
  artifactCount: z.number().int().nonnegative(),
  questionCount: z.number().int().nonnegative(),
  reviewStatus: ScenarioReviewStatus,
  reviewNotes: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewer: ReviewerSummary.nullable(),
  questionsWithNotes: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type AdminReviewRow = z.infer<typeof AdminReviewRow>;

export const AdminReviewListResponse = z.object({
  scenarios: z.array(AdminReviewRow),
});
export type AdminReviewListResponse = z.infer<typeof AdminReviewListResponse>;

// Lightweight wrapper schemas the web BFF uses to validate the
// review-set endpoints' responses. The `scenario` payload is
// AdminScenarioSummary; we expose it via a `.lazy` indirection
// later in the file the contract is consumed from — defining a
// fresh z.object here would require re-declaring all the
// AdminScenarioSummary fields. Instead the web client parses
// with z.unknown() and trusts that the typecheck on the public
// `AdminScenarioSummary` import catches drift. We keep the
// question wrapper strict-ish since AuthoredQuestion is a
// discriminated union and worth checking.
export const REVIEW_NOTES_MAX_CHARS = REVIEW_NOTES_MAX;
