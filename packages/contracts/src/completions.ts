import { z } from "zod";

// Admin completions feed. One row per (user, scenario) where
// scenario_progress.completedAt is set — i.e. the student has
// landed every question correctly. Newest-first by completion
// time. Used by /admin/completions.

export const CompletionListItem = z.object({
  scenarioId: z.string().uuid(),
  scenarioSlug: z.string(),
  scenarioTitle: z.string(),
  userId: z.string().uuid(),
  userDisplayName: z.string(),
  userEmail: z.string(),
  // The moment the scenario flipped to completed (last question
  // got it right).
  completedAt: z.string().datetime(),
  // Best-effort first-action moment for the same (user, scenario).
  // Lets the admin see "took 38 minutes from first try to done."
  // Pulled from scenario_progress.createdAt.
  startedAt: z.string().datetime(),
  // Per-scenario aggregates the admin will want to see at a glance:
  // total submissions across all questions in the scenario (sum of
  // QuestionResponse.attemptCount), and how many of those questions
  // landed on the first try.
  totalAttempts: z.number().int().min(0),
  firstTryCount: z.number().int().min(0),
  totalQuestions: z.number().int().min(0),
});
export type CompletionListItem = z.infer<typeof CompletionListItem>;

export const CompletionListResponse = z.object({
  completions: z.array(CompletionListItem),
  // Total count across the whole catalogue so the admin page can
  // show "showing 200 of 412" when the result is capped.
  totalCount: z.number().int().min(0),
});
export type CompletionListResponse = z.infer<typeof CompletionListResponse>;

// Boundary-level validation for `GET /admin/completions?limit=N`.
// The service additionally caps at 500; defining the schema here
// lets the controller use ZodValidationPipe and reject negative /
// NaN / out-of-range values at the request edge instead of relying
// on a downstream service-level `Math.min`.
export const AdminCompletionsListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type AdminCompletionsListQuery = z.infer<typeof AdminCompletionsListQuery>;
