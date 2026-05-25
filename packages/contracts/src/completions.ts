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

// Note: the boundary `?limit` schema lives in ./common as
// AdminListQuery — it's shared with /admin/feedback and any
// future admin list endpoint. Callers import it directly from
// the contracts barrel.
