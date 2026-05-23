import { assertDistinctSeedEmails } from "./seed-config";

describe("assertDistinctSeedEmails", () => {
  it("accepts two clearly distinct emails", () => {
    expect(() =>
      assertDistinctSeedEmails("admin@example.com", "user@example.com"),
    ).not.toThrow();
  });

  it("rejects exact-match emails", () => {
    expect(() =>
      assertDistinctSeedEmails("admin@example.com", "admin@example.com"),
    ).toThrow(/must be different/i);
  });

  it("rejects emails differing only in case (citext column collapses them)", () => {
    expect(() =>
      assertDistinctSeedEmails("Admin@Example.com", "admin@example.com"),
    ).toThrow(/must be different/i);
  });

  it("rejects emails with surrounding whitespace differences", () => {
    expect(() =>
      assertDistinctSeedEmails("  admin@example.com  ", "admin@example.com"),
    ).toThrow(/must be different/i);
  });

  it("suggests a plus-alias for the user account in the error message", () => {
    expect(() =>
      assertDistinctSeedEmails("james@example.com", "james@example.com"),
    ).toThrow(/james\+user@example\.com/);
  });

  it("falls back to a dot-suffix when the local-part already has a plus-tag", () => {
    expect(() =>
      assertDistinctSeedEmails(
        "james+admin@example.com",
        "james+admin@example.com",
      ),
    ).toThrow(/james\+admin\.user@example\.com/);
  });

  it("doesn't crash when the input doesn't look like an email", () => {
    expect(() => assertDistinctSeedEmails("oops", "oops")).toThrow(
      /must be different/i,
    );
  });
});
