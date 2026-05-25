import { GradingService } from "./grading.service";

describe("GradingService", () => {
  const svc = new GradingService();

  describe("multi_choice", () => {
    const expected = {
      type: "multi_choice" as const,
      correctIds: ["a", "c"],
      allowMultiple: true,
    };

    it("exact match → correct=true, score=1", () => {
      const r = svc.grade({
        type: "multi_choice",
        optionsJson: null,
        expectedJson: expected,
        responseJson: { type: "multi_choice", data: { selectedIds: ["a", "c"] } },
      });
      expect(r).toMatchObject({ correct: true, score: 1 });
    });

    it("partial subset with no false positives → correct=false, fractional score", () => {
      const r = svc.grade({
        type: "multi_choice",
        optionsJson: null,
        expectedJson: expected,
        responseJson: { type: "multi_choice", data: { selectedIds: ["a"] } },
      });
      expect(r.correct).toBe(false);
      expect(r.score).toBe(0.5);
    });

    it("any false positive → correct=false, score=0", () => {
      const r = svc.grade({
        type: "multi_choice",
        optionsJson: null,
        expectedJson: expected,
        responseJson: { type: "multi_choice", data: { selectedIds: ["a", "b"] } },
      });
      expect(r).toMatchObject({ correct: false, score: 0 });
    });

    it("no partial on allowMultiple=false", () => {
      const r = svc.grade({
        type: "multi_choice",
        optionsJson: null,
        expectedJson: { ...expected, allowMultiple: false },
        responseJson: { type: "multi_choice", data: { selectedIds: ["a"] } },
      });
      expect(r).toMatchObject({ correct: false, score: 0 });
    });
  });

  describe("confidence", () => {
    const expected = {
      type: "confidence" as const,
      expectedRange: [3, 5] as [number, number],
    };

    it("in range → correct=true", () => {
      expect(
        svc.grade({
          type: "confidence",
          optionsJson: null,
          expectedJson: expected,
          responseJson: { type: "confidence", data: { value: 4 } },
        }),
      ).toMatchObject({ correct: true, score: 1 });
    });

    it("boundary values are inclusive", () => {
      expect(
        svc.grade({
          type: "confidence",
          optionsJson: null,
          expectedJson: expected,
          responseJson: { type: "confidence", data: { value: 3 } },
        }).correct,
      ).toBe(true);
      expect(
        svc.grade({
          type: "confidence",
          optionsJson: null,
          expectedJson: expected,
          responseJson: { type: "confidence", data: { value: 5 } },
        }).correct,
      ).toBe(true);
    });

    it("out of range → correct=false", () => {
      expect(
        svc.grade({
          type: "confidence",
          optionsJson: null,
          expectedJson: expected,
          responseJson: { type: "confidence", data: { value: 2 } },
        }),
      ).toMatchObject({ correct: false, score: 0 });
    });
  });

  describe("select_indicators", () => {
    const expected = {
      type: "select_indicators" as const,
      correctIds: ["a", "b", "c"],
    };

    it("exact match → correct=true", () => {
      expect(
        svc.grade({
          type: "select_indicators",
          optionsJson: null,
          expectedJson: expected,
          responseJson: {
            type: "select_indicators",
            data: { selectedIds: ["a", "b", "c"] },
          },
        }),
      ).toMatchObject({ correct: true, score: 1 });
    });

    it("subset with no false positives → fractional score, correct=false", () => {
      const r = svc.grade({
        type: "select_indicators",
        optionsJson: null,
        expectedJson: expected,
        responseJson: {
          type: "select_indicators",
          data: { selectedIds: ["a", "b"] },
        },
      });
      expect(r.correct).toBe(false);
      expect(r.score).toBeCloseTo(2 / 3);
    });

    it("false positive → 0", () => {
      expect(
        svc.grade({
          type: "select_indicators",
          optionsJson: null,
          expectedJson: expected,
          responseJson: {
            type: "select_indicators",
            data: { selectedIds: ["a", "z"] },
          },
        }),
      ).toMatchObject({ correct: false, score: 0 });
    });
  });

  describe("text_match — literal", () => {
    const expected = {
      type: "text_match" as const,
      acceptableAnswers: ["vendor-lookup-alike.com", "VENDOR-LOOKUP-ALIKE.COM"],
      regex: false,
    };
    const opts = {
      acceptableAnswers: expected.acceptableAnswers,
      caseSensitive: false,
      normalizeWhitespace: true,
      regex: false,
      hintAfterTries: 3,
    };

    it("trims + lowercases by default → correct", () => {
      expect(
        svc.grade({
          type: "text_match",
          optionsJson: opts,
          expectedJson: expected,
          responseJson: {
            type: "text_match",
            data: { text: "  Vendor-Lookup-Alike.COM  " },
          },
        }),
      ).toMatchObject({ correct: true, score: 1 });
    });

    it("collapses internal whitespace when normalizeWhitespace is on", () => {
      const withWs = svc.grade({
        type: "text_match",
        optionsJson: {
          ...opts,
          acceptableAnswers: ["proven not inferred"],
        },
        expectedJson: {
          type: "text_match",
          acceptableAnswers: ["proven not inferred"],
          regex: false,
        },
        responseJson: {
          type: "text_match",
          data: { text: "PROVEN     not\t\tinferred" },
        },
      });
      expect(withWs).toMatchObject({ correct: true, score: 1 });
    });

    it("rejects when wrong", () => {
      expect(
        svc.grade({
          type: "text_match",
          optionsJson: opts,
          expectedJson: expected,
          responseJson: {
            type: "text_match",
            data: { text: "wrong-domain.com" },
          },
        }),
      ).toMatchObject({ correct: false, score: 0 });
    });

    it("respects caseSensitive=true", () => {
      const caseOpts = { ...opts, caseSensitive: true };
      expect(
        svc.grade({
          type: "text_match",
          optionsJson: caseOpts,
          expectedJson: expected,
          responseJson: {
            type: "text_match",
            data: { text: "vendor-lookup-alike.com" },
          },
        }),
      ).toMatchObject({ correct: true, score: 1 });
      // Wrong case → no match against either acceptable string.
      expect(
        svc.grade({
          type: "text_match",
          optionsJson: caseOpts,
          expectedJson: {
            type: "text_match",
            acceptableAnswers: ["lowercase-only"],
            regex: false,
          },
          responseJson: {
            type: "text_match",
            data: { text: "LOWERCASE-ONLY" },
          },
        }).correct,
      ).toBe(false);
    });
  });

  describe("text_match — regex", () => {
    it("treats acceptable strings as patterns when regex=true", () => {
      const r = svc.grade({
        type: "text_match",
        optionsJson: {
          acceptableAnswers: ["^10\\.0\\.0\\.\\d+$"],
          caseSensitive: false,
          normalizeWhitespace: true,
          regex: true,
          hintAfterTries: 3,
        },
        expectedJson: {
          type: "text_match",
          acceptableAnswers: ["^10\\.0\\.0\\.\\d+$"],
          regex: true,
        },
        responseJson: { type: "text_match", data: { text: "10.0.0.42" } },
      });
      expect(r).toMatchObject({ correct: true, score: 1 });
    });

    it("malformed regex grades as miss, not crash", () => {
      const r = svc.grade({
        type: "text_match",
        optionsJson: {
          acceptableAnswers: ["[unterminated"],
          caseSensitive: false,
          normalizeWhitespace: true,
          regex: true,
          hintAfterTries: 3,
        },
        expectedJson: {
          type: "text_match",
          acceptableAnswers: ["[unterminated"],
          regex: true,
        },
        responseJson: { type: "text_match", data: { text: "anything" } },
      });
      expect(r).toMatchObject({ correct: false, score: 0 });
    });
  });

  describe("unknown types + malformed inputs", () => {
    it("unknown question type → miss, not throw (defense in depth)", () => {
      const r = svc.grade({
        type: "some_future_type" as never,
        optionsJson: null,
        expectedJson: { type: "some_future_type" },
        responseJson: { type: "some_future_type", data: {} },
      });
      expect(r).toMatchObject({ correct: false, score: 0 });
    });

    it("malformed expected key → miss, not throw", () => {
      const r = svc.grade({
        type: "multi_choice",
        optionsJson: null,
        expectedJson: { wat: true },
        responseJson: { type: "multi_choice", data: { selectedIds: ["a"] } },
      });
      expect(r).toMatchObject({ correct: false, score: 0 });
    });
  });

  // Per-pick breakdown shipped to the UI so the student can see
  // "3 of 4 right, plus 2 extras" instead of a bare "Not yet."
  describe("selectionFeedback", () => {
    it("counts hits + extras + reports total-correct on select_indicators wrong with overpick", () => {
      const r = svc.grade({
        type: "select_indicators",
        optionsJson: null,
        expectedJson: { type: "select_indicators", correctIds: ["a", "b", "c", "d"] },
        responseJson: {
          type: "select_indicators",
          data: { selectedIds: ["a", "b", "x", "y"] },
        },
      });
      expect(r).toMatchObject({
        correct: false,
        selectionFeedback: {
          correctPicked: 2,
          totalPicked: 4,
          totalCorrect: 4,
        },
      });
    });

    it("includes breakdown on correct select_indicators submissions too", () => {
      const r = svc.grade({
        type: "select_indicators",
        optionsJson: null,
        expectedJson: { type: "select_indicators", correctIds: ["a", "b"] },
        responseJson: {
          type: "select_indicators",
          data: { selectedIds: ["a", "b"] },
        },
      });
      expect(r.correct).toBe(true);
      expect(r.selectionFeedback).toEqual({
        correctPicked: 2,
        totalPicked: 2,
        totalCorrect: 2,
      });
    });

    it("returns null breakdown on single-pick multi_choice (allowMultiple=false)", () => {
      const r = svc.grade({
        type: "multi_choice",
        optionsJson: null,
        expectedJson: { type: "multi_choice", correctIds: ["a"], allowMultiple: false },
        responseJson: { type: "multi_choice", data: { selectedIds: ["b"] } },
      });
      expect(r.selectionFeedback).toBeNull();
    });

    it("returns null breakdown on text_match + confidence", () => {
      const tm = svc.grade({
        type: "text_match",
        optionsJson: { caseSensitive: false, normalizeWhitespace: true, hintAfterTries: 3 },
        expectedJson: { type: "text_match", acceptableAnswers: ["yes"], regex: false },
        responseJson: { type: "text_match", data: { text: "no" } },
      });
      expect(tm.selectionFeedback).toBeNull();

      const c = svc.grade({
        type: "confidence",
        optionsJson: null,
        expectedJson: { type: "confidence", expectedRange: [3, 5] },
        responseJson: { type: "confidence", data: { value: 1 } },
      });
      expect(c.selectionFeedback).toBeNull();
    });
  });
});
