import { BadRequestException } from "@nestjs/common";
import { ScenarioSlugPipe } from "./scenario-slug.pipe";

describe("ScenarioSlugPipe", () => {
  const pipe = new ScenarioSlugPipe();

  it("accepts a valid slug", () => {
    expect(pipe.transform("bec-vendor-redirect-001")).toBe("bec-vendor-redirect-001");
  });

  it("accepts a single alphanumeric character", () => {
    expect(pipe.transform("a")).toBe("a");
  });

  it.each([
    ["UPPERCASE-IS-BAD"],
    ["-leading-hyphen"],
    ["trailing-hyphen-"],
    ["has spaces"],
    ["has_underscore"],
    ["has/slash"],
    ["has..dots"],
    ["../../../etc/passwd"],
    [""],
  ])("rejects malformed slug %j", (input) => {
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it("rejects non-string inputs", () => {
    expect(() => pipe.transform(123 as unknown)).toThrow(BadRequestException);
    expect(() => pipe.transform(null as unknown)).toThrow(BadRequestException);
    expect(() => pipe.transform(undefined as unknown)).toThrow(BadRequestException);
  });

  it("rejects a slug over 120 characters", () => {
    expect(() => pipe.transform("a".repeat(121))).toThrow(BadRequestException);
  });

  it("accepts a slug exactly 120 characters", () => {
    expect(pipe.transform("a".repeat(120))).toBe("a".repeat(120));
  });
});
