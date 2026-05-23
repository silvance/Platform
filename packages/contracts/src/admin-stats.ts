import { z } from "zod";

// M21d admin overview stats. Read-only summary intended for
// the /admin landing cards and the header pending-approval
// badge. Admin-only; the controller is role-guarded.

export const AdminScenarioStatusCounts = z.object({
  published: z.number().int().nonnegative(),
  draft: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
});
export type AdminScenarioStatusCounts = z.infer<typeof AdminScenarioStatusCounts>;

export const AdminUserRoleCounts = z.object({
  admin: z.number().int().nonnegative(),
  user: z.number().int().nonnegative(),
});
export type AdminUserRoleCounts = z.infer<typeof AdminUserRoleCounts>;

export const AdminScenarioReviewCounts = z.object({
  needs_review: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  // All non-approved, non-needs_review verdicts collapsed into
  // "flagged" since the /admin cards just need a single attention
  // number — the /admin/review page shows the breakdown.
  flagged: z.number().int().nonnegative(),
});
export type AdminScenarioReviewCounts = z.infer<typeof AdminScenarioReviewCounts>;

export const AdminStatsResponse = z.object({
  users: z.object({
    total: z.number().int().nonnegative(),
    byRole: AdminUserRoleCounts,
    pendingApproval: z.number().int().nonnegative(),
    disabled: z.number().int().nonnegative(),
  }),
  scenarios: z.object({
    total: z.number().int().nonnegative(),
    byStatus: AdminScenarioStatusCounts,
    byReview: AdminScenarioReviewCounts,
  }),
  attempts: z.object({
    completedAllTime: z.number().int().nonnegative(),
  }),
  generatedAt: z.string().datetime(),
});
export type AdminStatsResponse = z.infer<typeof AdminStatsResponse>;
