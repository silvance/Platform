import { computeStreak } from "./me-stats.service";

// Streak tests work against the pure computeStreak helper so we
// don't need a DB. Days are YYYY-MM-DD; "today" is passed in so
// the assertions don't depend on the wall clock.

describe("computeStreak", () => {
  it("returns zeros for an empty activity history", () => {
    expect(computeStreak([], "2026-06-15")).toEqual({
      currentDays: 0,
      longestDays: 0,
      lastActiveOn: null,
    });
  });

  it("counts a single active day as a streak of 1", () => {
    expect(computeStreak(["2026-06-15"], "2026-06-15")).toEqual({
      currentDays: 1,
      longestDays: 1,
      lastActiveOn: "2026-06-15",
    });
  });

  it("counts consecutive days back from today", () => {
    const r = computeStreak(
      ["2026-06-15", "2026-06-14", "2026-06-13"],
      "2026-06-15",
    );
    expect(r.currentDays).toBe(3);
    expect(r.longestDays).toBe(3);
    expect(r.lastActiveOn).toBe("2026-06-15");
  });

  it("tolerates 'active yesterday but not yet today' so streaks don't reset at midnight", () => {
    const r = computeStreak(["2026-06-14", "2026-06-13"], "2026-06-15");
    // 2026-06-14 IS yesterday relative to today=2026-06-15. The
    // current streak should still report 2, not 0.
    expect(r.currentDays).toBe(2);
    expect(r.longestDays).toBe(2);
  });

  it("resets the current streak when the last activity is older than yesterday", () => {
    const r = computeStreak(["2026-06-10"], "2026-06-15");
    expect(r.currentDays).toBe(0);
    expect(r.longestDays).toBe(1);
    expect(r.lastActiveOn).toBe("2026-06-10");
  });

  it("finds the longest historical run separately from the current run", () => {
    // Long-ago 5-day streak, broken, then a 2-day streak ending today.
    const days = [
      "2026-06-15", "2026-06-14", // 2-day current
      "2026-05-20", "2026-05-19", "2026-05-18", "2026-05-17", "2026-05-16", // 5-day long-ago
    ];
    const r = computeStreak(days, "2026-06-15");
    expect(r.currentDays).toBe(2);
    expect(r.longestDays).toBe(5);
    expect(r.lastActiveOn).toBe("2026-06-15");
  });

  it("handles month-boundary day arithmetic correctly", () => {
    const days = ["2026-07-02", "2026-07-01", "2026-06-30", "2026-06-29"];
    const r = computeStreak(days, "2026-07-02");
    expect(r.currentDays).toBe(4);
    expect(r.longestDays).toBe(4);
  });

  it("handles year-boundary day arithmetic correctly", () => {
    const days = ["2026-01-02", "2026-01-01", "2025-12-31", "2025-12-30"];
    const r = computeStreak(days, "2026-01-02");
    expect(r.currentDays).toBe(4);
    expect(r.longestDays).toBe(4);
  });

  it("dedups: same input row, no contribution", () => {
    // computeStreak's callers feed it deduped days, but the function
    // doesn't need to enforce it -- we just check that no internal
    // state breaks on duplicates.
    const r = computeStreak(
      ["2026-06-15", "2026-06-15", "2026-06-14"],
      "2026-06-15",
    );
    expect(r.currentDays).toBe(2);
    expect(r.lastActiveOn).toBe("2026-06-15");
  });
});
