import { GradingService } from "./grading.service";

describe("GradingService", () => {
  const svc = new GradingService();

  describe("multi_choice", () => {
    const expected = {
      type: "multi_choice" as const,
      correctIds: ["a", "c"],
      allowMultiple: true,
    };

    it("scores exact-match selection 1.0 + correct", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: expected,
        responseJson: {
          type: "multi_choice",
          data: { selectedIds: ["a", "c"] },
        },
      });
      expect(r.score).toBe(1);
      expect(r.outcome).toBe("correct");
    });

    it("scores order-insensitive", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: expected,
        responseJson: {
          type: "multi_choice",
          data: { selectedIds: ["c", "a"] },
        },
      });
      expect(r.score).toBe(1);
    });

    it("partial credit for a subset of correct selections with no false positives", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: expected,
        responseJson: {
          type: "multi_choice",
          data: { selectedIds: ["a"] },
        },
      });
      expect(r.score).toBe(0.5);
      expect(r.outcome).toBe("partial");
    });

    it("zero credit if any false positive is picked", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: expected,
        responseJson: {
          type: "multi_choice",
          data: { selectedIds: ["a", "b"] },
        },
      });
      expect(r.score).toBe(0);
      expect(r.outcome).toBe("incorrect");
    });

    it("no partial credit when allowMultiple is false", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: {
          type: "multi_choice",
          correctIds: ["a", "c"],
          allowMultiple: false,
        },
        responseJson: { type: "multi_choice", data: { selectedIds: ["a"] } },
      });
      expect(r.score).toBe(0);
      expect(r.outcome).toBe("incorrect");
    });

    it("returns 0 + incorrect for an unanswered question", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: expected,
        responseJson: null,
      });
      expect(r.score).toBe(0);
      expect(r.outcome).toBe("incorrect");
    });

    it("falls back to ungradable when the expected key is malformed", () => {
      const r = svc.grade({
        type: "multi_choice",
        expectedJson: { not: "valid" },
        responseJson: { type: "multi_choice", data: { selectedIds: ["a"] } },
      });
      expect(r.score).toBeNull();
      expect(r.outcome).toBe("ungradable");
    });
  });

  describe("confidence", () => {
    const expected = { type: "confidence" as const, expectedRange: [3, 5] as [number, number] };

    it("scores in-range as 1.0 + in_range", () => {
      const r = svc.grade({
        type: "confidence",
        expectedJson: expected,
        responseJson: { type: "confidence", data: { value: 4 } },
      });
      expect(r.score).toBe(1);
      expect(r.outcome).toBe("in_range");
    });

    it("scores boundary values inclusively", () => {
      expect(
        svc.grade({
          type: "confidence",
          expectedJson: expected,
          responseJson: { type: "confidence", data: { value: 3 } },
        }).outcome,
      ).toBe("in_range");
      expect(
        svc.grade({
          type: "confidence",
          expectedJson: expected,
          responseJson: { type: "confidence", data: { value: 5 } },
        }).outcome,
      ).toBe("in_range");
    });

    it("scores out-of-range as 0 + out_of_range", () => {
      const r = svc.grade({
        type: "confidence",
        expectedJson: expected,
        responseJson: { type: "confidence", data: { value: 2 } },
      });
      expect(r.score).toBe(0);
      expect(r.outcome).toBe("out_of_range");
    });

    it("missing response → 0 + out_of_range", () => {
      const r = svc.grade({
        type: "confidence",
        expectedJson: expected,
        responseJson: null,
      });
      expect(r.score).toBe(0);
      expect(r.outcome).toBe("out_of_range");
    });

    it("ungradable when expected range is malformed", () => {
      const r = svc.grade({
        type: "confidence",
        expectedJson: { type: "confidence", expectedRange: [10, 99] },
        responseJson: { type: "confidence", data: { value: 4 } },
      });
      expect(r.score).toBeNull();
      expect(r.outcome).toBe("ungradable");
    });
  });

  describe("narrative answers — never auto-graded", () => {
    it.each(["short_answer", "long_answer"] as const)(
      "%s returns ungradable",
      (type) => {
        const r = svc.grade({
          type,
          expectedJson: { type, rubricNote: null },
          responseJson: { type, data: { text: "anything" } },
        });
        expect(r.score).toBeNull();
        expect(r.outcome).toBe("ungradable");
      },
    );
  });
});
