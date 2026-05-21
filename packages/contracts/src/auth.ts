import { z } from "zod";

export const Role = z.enum(["instructor", "trainee"]);
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
