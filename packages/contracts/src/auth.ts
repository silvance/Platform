import { z } from "zod";

// Role naming aligns with the M7 challenge-lab framing the UI shipped:
// `admin` authors + manages content, `user` solves challenges. M12
// migrated the DB enum to match; the contract is the source of truth
// for what crosses the wire.
export const Role = z.enum(["admin", "user"]);
export type Role = z.infer<typeof Role>;

// Minimum length for any user-set password (login, admin reset, env
// bootstrap, CLI reset). 10 chars at 26+10+special ≈ 60 bits entropy
// if the user picks remotely sensibly; combined with the per-IP
// throttle this is good enough for the beta operator population.
// Bumping this is a breaking change for any deployed env files that
// set SEED_*_PASSWORD below this length.
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 256;

export const PasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  })
  .max(MAX_PASSWORD_LENGTH);

// Email + password come from a login form. Keep the requirements minimal at
// the contract layer; the auth service enforces hashing/strength policies
// when accounts are created.
export const LoginRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const PublicUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: Role,
});
export type PublicUser = z.infer<typeof PublicUser>;

// The session token is returned exactly once, at login. It is never stored
// in plaintext server-side and never appears in /me responses.
export const LoginResponse = z.object({
  user: PublicUser,
  token: z.string().min(32),
  expiresAt: z.string().datetime(),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const MeResponse = z.object({
  user: PublicUser,
  session: z.object({
    expiresAt: z.string().datetime(),
  }),
});
export type MeResponse = z.infer<typeof MeResponse>;

// Self-service password change. Requires the current password so a
// stolen / forgotten-but-still-logged-in session can't be used to
// silently rotate credentials. The new password must differ from the
// current one (cheap defense against accidental no-op submissions).
export const ChangePasswordRequest = z
  .object({
    currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
    newPassword: PasswordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

// M17 self-registration. Anyone with a browser may submit a
// registration; the account lands with approvedAt = null and
// cannot sign in until an admin approves it via
// /admin/users/:id/approve. Default role is always "user" — the
// register endpoint does NOT accept a role from the request body.
export const RegisterRequest = z.object({
  email: z.string().email().max(254),
  displayName: z.string().min(1).max(120),
  password: PasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

// The register endpoint deliberately returns a flat, leak-free
// shape. No user id, no session token (the user can't sign in
// until approved), no "your email is already registered" tell.
// `pendingApproval` is always true on a fresh registration; it
// becomes false from the user's perspective only once an admin
// approves and the user signs in.
export const RegisterResponse = z.object({
  pendingApproval: z.literal(true),
  message: z.string(),
});
export type RegisterResponse = z.infer<typeof RegisterResponse>;

