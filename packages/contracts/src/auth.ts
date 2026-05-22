import { z } from "zod";

// Role naming aligns with the M7 challenge-lab framing the UI shipped:
// `admin` authors + manages content, `user` solves challenges. M12
// migrated the DB enum to match; the contract is the source of truth
// for what crosses the wire.
export const Role = z.enum(["admin", "user"]);
export type Role = z.infer<typeof Role>;

// Email + password come from a login form. Keep the requirements minimal at
// the contract layer; the auth service enforces hashing/strength policies
// when accounts are created.
export const LoginRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
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
