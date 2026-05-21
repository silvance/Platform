import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ScenarioSlug } from "@ci-train/contracts";

// Route-param pipe that validates the slug shape (lowercase
// alphanumeric + hyphens, 1..120 chars) before any DB lookup. Apply
// to every controller param named `slug`.
export class ScenarioSlugPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const r = ScenarioSlug.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        message: "Invalid scenario slug.",
        issues: r.error.issues,
      });
    }
    return r.data;
  }
}
