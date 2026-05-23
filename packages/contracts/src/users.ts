import { z } from "zod";
import { MAX_PASSWORD_LENGTH, PasswordSchema, Role } from "./auth.js";

// Admin user-management contracts (M15). All endpoints below sit
// under /v1/admin/users and are role-guarded to `admin`. Password
// values never appear in any response — list/get/create/reset all
// return the public projection (no passwordHash, no plaintext).

export const AdminUserSummary = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: Role,
  disabled: z.boolean(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});
export type AdminUserSummary = z.infer<typeof AdminUserSummary>;

export const AdminUserListResponse = z.object({
  users: z.array(AdminUserSummary),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponse>;

const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 120;

export const AdminCreateUserRequest = z.object({
  email: z.string().email().max(254),
  displayName: z.string().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX),
  role: Role,
  password: PasswordSchema,
});
export type AdminCreateUserRequest = z.infer<typeof AdminCreateUserRequest>;

// All fields optional; the patch handler only touches what's
// supplied. Email is intentionally NOT mutable — citext-unique +
// authored-content FK references would make rename surprising for
// the beta scope. If we need it later, add it as a separate
// dedicated endpoint with explicit re-auth.
export const AdminUpdateUserRequest = z
  .object({
    displayName: z.string().min(DISPLAY_NAME_MIN).max(DISPLAY_NAME_MAX).optional(),
    role: Role.optional(),
    disabled: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.role !== undefined ||
      v.disabled !== undefined,
    { message: "Patch request must include at least one field." },
  );
export type AdminUpdateUserRequest = z.infer<typeof AdminUpdateUserRequest>;

// Admin-initiated reset. We don't require the target user's current
// password — that's the whole point of an admin reset — but the
// server always revokes the target's existing sessions so a stolen
// session can't outlive the reset.
export const AdminResetPasswordRequest = z.object({
  password: PasswordSchema,
});
export type AdminResetPasswordRequest = z.infer<typeof AdminResetPasswordRequest>;

// Common single-user response (for create / update / reset
// password). No bytes that should never leak (passwordHash) are in
// this shape. Reusing AdminUserSummary keeps the wire surface
// narrow.
export const AdminUserResponse = z.object({ user: AdminUserSummary });
export type AdminUserResponse = z.infer<typeof AdminUserResponse>;

// Re-export the password limits so the web layer can render the
// same minimum-length text the API enforces.
export { MAX_PASSWORD_LENGTH };
