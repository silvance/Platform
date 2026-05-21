import { z } from "zod";

export const HelloResponse = z.object({
  message: z.string(),
  from: z.literal("api"),
  apiVersion: z.string(),
  timestamp: z.string().datetime(),
});
export type HelloResponse = z.infer<typeof HelloResponse>;
