import { z } from "zod";

// Shared schemas for cross-cutting API patterns. Keep this file
// small — landing pad for things that legitimately recur, not a
// junk drawer.

// Admin list-endpoint pagination. Used by /admin/feedback +
// /admin/completions today. `limit` is coerced from the query-string
// representation, validated 1..500 at the request edge, and
// defaults to 200. Service-layer code may additionally cap the
// limit (belt + braces) but is no longer the only gate.
export const AdminListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type AdminListQuery = z.infer<typeof AdminListQuery>;
