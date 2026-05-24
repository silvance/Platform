import { z } from "zod";
import { Lane } from "./scenarios.js";

// per-scenario / per-question analytics for admins.
//
// The platform stores ONE QuestionResponse row per (progress,
// question), with `attemptCount` denormalised and `completedAt`
// set on the first correct submission and never cleared. That
// lets us approximate per-question difficulty without a full
// submission history table:
//
//   * `usersAttempted`    — rows that exist for this question
//   * `usersCompleted`    — rows where completedAt is not null
//   * `firstTryCorrect`   — rows where attemptCount == 1 AND
//                            completedAt is not null
//   * `totalSubmissions`  — SUM(attemptCount) across all rows
//
// These never appear on any user-facing endpoint — analytics is
// admin-only by route gate.

export const QuestionAnalytics = z.object({
  questionId: z.string().uuid(),
  ordinal: z.number().int().positive(),
  type: z.string(),
  promptPreview: z.string(),
  usersAttempted: z.number().int().nonnegative(),
  usersCompleted: z.number().int().nonnegative(),
  firstTryCorrect: z.number().int().nonnegative(),
  totalSubmissions: z.number().int().nonnegative(),
});
export type QuestionAnalytics = z.infer<typeof QuestionAnalytics>;

export const ScenarioAnalytics = z.object({
  scenarioId: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  lane: Lane,
  module: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  questionCount: z.number().int().nonnegative(),
  usersStarted: z.number().int().nonnegative(),
  usersCompleted: z.number().int().nonnegative(),
  questions: z.array(QuestionAnalytics),
});
export type ScenarioAnalytics = z.infer<typeof ScenarioAnalytics>;

export const AnalyticsResponse = z.object({
  scenarios: z.array(ScenarioAnalytics),
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponse>;
