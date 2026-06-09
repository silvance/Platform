"use client";

import { useEffect, useState } from "react";
import type { CalibrationStats } from "@ci-train/contracts";
import { getMyCalibrationAction } from "@/app/(authenticated)/scenarios/[slug]/actions";

interface Props {
  // The value the user submitted, clamped to 1-5 by the form.
  submittedValue: number;
  // The question's authored expected range.
  expectedRange: [number, number];
}

// Per-question calibration meter. Renders below the debrief on
// confidence-type questions once the question is completed (correct
// or otherwise -- a confidence question is "complete" the first time
// the user submits any value, but we show this banner once the
// answer key has unlocked).
//
// Two pieces of feedback:
//   1. "Your value (X) was IN / OUT of the expected range (A-B)" --
//      computed client-side from the props, immediate.
//   2. "Calibration to date: P% (Q in range / R total)" -- fetched
//      via server action so the running tally reflects the freshly-
//      submitted answer.
export function CalibrationFeedback({ submittedValue, expectedRange }: Props) {
  const [lo, hi] = expectedRange;
  const inRange = submittedValue >= lo && submittedValue <= hi;
  const [calibration, setCalibration] = useState<CalibrationStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getMyCalibrationAction();
      if (cancelled) return;
      if (result.ok) {
        setCalibration(result.calibration);
      } else {
        setLoadError(result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submittedValue]);

  const verdictColor = inRange ? "var(--accent)" : "rgba(255, 196, 0, 0.85)";
  const verdictBg = inRange
    ? "rgba(83, 132, 255, 0.08)"
    : "rgba(255, 196, 0, 0.06)";

  return (
    <div
      className="card"
      style={{
        marginTop: ".5rem",
        padding: ".6rem .85rem",
        background: verdictBg,
        borderLeft: `3px solid ${verdictColor}`,
      }}
      aria-label="Calibration feedback"
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: ".5rem 1.25rem",
          alignItems: "baseline",
          fontSize: ".85rem",
        }}
      >
        <span>
          <strong>Your answer:</strong>{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {submittedValue}
          </span>
        </span>
        <span>
          <strong>Expected range:</strong>{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {lo}–{hi}
          </span>
        </span>
        <span style={{ color: verdictColor, fontWeight: 600 }}>
          {inRange ? "In range ✓" : "Out of range ✗"}
        </span>
      </div>
      <div
        style={{
          marginTop: ".4rem",
          fontSize: ".8rem",
          color: "var(--muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {loadError ? (
          <span>Couldn't load running calibration: {loadError}</span>
        ) : calibration === null ? (
          <span>Loading running calibration…</span>
        ) : (
          <>
            <strong style={{ color: "var(--fg)" }}>
              Calibration to date:
            </strong>{" "}
            {calibration.percentInRange}% ({calibration.withinRange} in range
            / {calibration.totalConfidenceQuestions} total) ·{" "}
            <span
              style={{
                background: "var(--bg-sunken)",
                padding: "0 .35rem",
                borderRadius: "3px",
                fontWeight: 600,
                color: "var(--fg)",
              }}
            >
              {calibration.grade}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
