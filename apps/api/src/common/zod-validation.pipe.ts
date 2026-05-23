import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from "@nestjs/common";
import type { ZodSchema } from "zod";

// Body / query validator that delegates to a Zod schema. The
// shared @ci-train/contracts schemas are the single source of
// truth for request/response types.
//
// Scope: runs on `body` and `query` params only. It deliberately
// SKIPS `custom` (which is what @CurrentSession() / @CurrentUser()
// resolve to) and `param` (route params have their own pipes
// applied at the parameter level via @Param("x", SomePipe)). That
// lets method-level @UsePipes(new ZodValidationPipe(...)) coexist
// with custom param decorators without each endpoint having to
// switch to the more verbose `@Body(new ZodValidationPipe(...))`
// form, while still coercing query strings through the contract's
// transforms (e.g. `difficulty=2` → number 2).
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    if (metadata.type !== "body" && metadata.type !== "query") {
      return value as T;
    }
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
