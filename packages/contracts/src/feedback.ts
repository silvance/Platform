import { z } from "zod";

// Free-form post-challenge feedback. Students leave short notes
// on the solve view via a widget at the bottom of the page;
// admins read all submissions on /admin/feedback. Rating is
// optional (a student can leave a body-only comment); body is
// required and capped at 2000 chars to match the DB column.

export const FEEDBACK_BODY_MAX_CHARS = 2000;

export const FeedbackRating = z.number().int().min(1).max(5);
export type FeedbackRating = z.infer<typeof FeedbackRating>;

export const SubmitFeedbackRequest = z.object({
  // 1..5 stars. Nullable so the widget can submit body-only
  // comments without a rating.
  rating: FeedbackRating.nullable(),
  // Required body, 1..2000 chars after trim. The API rejects
  // whitespace-only submissions (matches the DB's CHECK).
  body: z.string().trim().min(1).max(FEEDBACK_BODY_MAX_CHARS),
});
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequest>;

export const SubmitFeedbackResponse = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type SubmitFeedbackResponse = z.infer<typeof SubmitFeedbackResponse>;

// Admin view: one row per submitted feedback record. Includes
// just enough to render the listing without a second round-trip:
// scenario slug + title, the author's display name + email,
// the rating + body, the timestamp.
export const FeedbackListItem = z.object({
  id: z.string().uuid(),
  scenarioId: z.string().uuid(),
  scenarioSlug: z.string(),
  scenarioTitle: z.string(),
  userId: z.string().uuid(),
  userDisplayName: z.string(),
  userEmail: z.string(),
  rating: FeedbackRating.nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
});
export type FeedbackListItem = z.infer<typeof FeedbackListItem>;

export const FeedbackListResponse = z.object({
  feedback: z.array(FeedbackListItem),
  // Aggregate roll-ups so the admin page can show "3 scenarios
  // with low-rated feedback" without rebuilding from the list.
  totalCount: z.number().int().min(0),
});
export type FeedbackListResponse = z.infer<typeof FeedbackListResponse>;

// Note: the boundary `?limit` schema lives in ./common as
// AdminListQuery — it's shared with /admin/completions and any
// future admin list endpoint. Callers import it directly from
// the contracts barrel.
