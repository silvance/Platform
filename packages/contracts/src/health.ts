import { z } from "zod";

export const HealthStatus = z.enum(["ok", "degraded", "down"]);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const HealthResponse = z.object({
  status: HealthStatus,
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ReadinessCheck = z.object({
  name: z.string(),
  ok: z.boolean(),
  detail: z.string().optional(),
});
export type ReadinessCheck = z.infer<typeof ReadinessCheck>;

export const ReadinessResponse = z.object({
  ready: z.boolean(),
  checks: z.array(ReadinessCheck),
  timestamp: z.string().datetime(),
});
export type ReadinessResponse = z.infer<typeof ReadinessResponse>;
