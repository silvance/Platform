import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from "@nestjs/common";
import type { ZodSchema } from "zod";

// Body validator that delegates to a Zod schema. We use this rather
// than class-validator so the shapes shared via @ci-train/contracts are the
// single source of truth for request/response types.
//
// When applied via method-level @UsePipes, NestJS runs the pipe against
// every parameter of the handler — including custom-param decorators
// like @CurrentSession() and @CurrentUser(). Validating those objects
// against a body schema would obviously fail. We restrict execution to
// `type === 'body'` so the same @UsePipes-style declaration can coexist
// with any custom-param decorator without each endpoint having to
// switch to the more verbose `@Body(new ZodValidationPipe(...))` form.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    if (metadata.type !== "body") {
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
