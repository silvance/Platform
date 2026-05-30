import { z } from "zod";

// registration access codes. Admin-managed joining codes that
// gate /register. A valid, active, non-expired, non-exhausted code
// at /register creates an auto-approved user; bad/missing codes
// reject with 400.
//
// The literal `code` string appears only in admin-only payloads
// here. It is NEVER returned by any user-facing endpoint, and the
// register endpoint never echoes whether the code matched in a way
// that distinguishes "good code, email taken" from "good code,
// email available" — that opacity is part of the enumeration-safety
// model.

// The exact 400 message the register endpoint returns when the
// access code is missing, wrong, disabled, expired, or exhausted.
// Centralised so the web action can pattern-match if it wants to.
export const ACCESS_CODE_REJECT_MESSAGE =
  "A valid access code is required to create an account.";

// 8-char alphanumeric. Short enough to dictate over Slack or paste
// from an onboarding doc; long enough that a brute-force attack
// against the throttled register endpoint is impractical.
export const AccessCodeString = z
  .string()
  .min(4, "Access code is required.")
  .max(64);
export type AccessCodeString = z.infer<typeof AccessCodeString>;

// Admin-only payload describing a single access code. `code` is the
// literal joinable string — admins read it here to share with new
// cohorts.
export const AccessCodeRecord = z.object({
  id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  disabledAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  usesCount: z.number().int().nonnegative(),
  usesLimit: z.number().int().positive().nullable(),
  // When true, registrations consuming this code auto-approve. When
  // false, the resulting account lands pending and requires an admin
  // to approve from /admin/users. Default at the DB layer is true,
  // matching the pre-flag behavior.
  autoApprove: z.boolean(),
  createdAt: z.string(),
  createdByUserId: z.string().uuid().nullable(),
});
export type AccessCodeRecord = z.infer<typeof AccessCodeRecord>;

export const AccessCodeListResponse = z.object({
  codes: z.array(AccessCodeRecord),
});
export type AccessCodeListResponse = z.infer<typeof AccessCodeListResponse>;

// Admin POST body for creating a new access code. `code` is
// optional — when omitted, the API generates a random short string.
// `usesLimit` and `expiresAt` are optional caps; null/undefined
// means "no limit."
export const CreateAccessCodeRequest = z.object({
  label: z.string().min(1).max(120),
  code: z.string().min(4).max(64).optional(),
  usesLimit: z.number().int().positive().max(10_000).optional(),
  expiresAt: z.string().datetime().optional(),
  // Omit to keep the auto-approve default (true). Set false to mint a
  // "register and wait for admin approval" code.
  autoApprove: z.boolean().optional(),
});
export type CreateAccessCodeRequest = z.infer<typeof CreateAccessCodeRequest>;

export const CreateAccessCodeResponse = z.object({
  code: AccessCodeRecord,
});
export type CreateAccessCodeResponse = z.infer<typeof CreateAccessCodeResponse>;

// Disable endpoint takes no body; the URL identifies the row.
export const DisableAccessCodeResponse = z.object({
  code: AccessCodeRecord,
});
export type DisableAccessCodeResponse = z.infer<typeof DisableAccessCodeResponse>;
