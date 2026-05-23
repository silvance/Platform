import { utf8, tinyPngBytes, RF_AWARENESS_DISCLAIMER } from "./util";
import type { ScenarioSeed } from "./types";

// RF-awareness family. Every scenario in this family carries the
// same disclaimer — these are *awareness* modules, not TSCM
// training. The exercise is investigative language discipline
// around bounded observations.

export const RF_AWARENESS_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished) ──────────────────────────────────────
  {
    slug: "rf-awareness-clean-sweep-001",
    title: "RF Awareness: \"Clean Sweep\" Report Review",
    summary:
      "A field element forwards a one-page sweep report concluding 'no devices present.' Assess the language for overclaim and identify when escalation to qualified TSCM personnel is warranted.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 25,
    tags: ["rf_awareness", "report_writing", "inference_discipline"],
    disclaimer: RF_AWARENESS_DISCLAIMER,
    brief: `
# Brief

A field element under your CI cyber AOR forwards a one-page report
covering a 90-minute observation period in a sensitive conference
space. The report concludes:

> *"Sweep was clean. No surveillance devices present."*

You are asked to review the report's language **before it goes to
the SAC** and recommend revisions if any are warranted.

## Open the artifacts

The workspace tabs hold:

- The **draft report itself** (plain text) — read it for overclaim.
- An **observation log** of band activity during the sweep (JSON).
- A **placeholder spectrum-display image** (PNG). The image is not
  the exercise: the language in the draft report is.

## What this scenario is — and is not

This is an **awareness module**, not a TSCM training scenario.

- ✅ It trains how to read sweep-style observations with a CI cyber lens.
- ✅ It trains when to escalate to qualified TSCM personnel.
- ✅ It trains how to document RF observations *without overstating
  conclusions*.
- ❌ It does **not** qualify you to perform RF sweeps, evaluate
  device presence, or render any TSCM finding.

## Reasoning focus

**Absence of evidence ≠ evidence of absence.** A 90-minute
observation does not foreclose intermittent transmitters, RF-quiet
devices, or devices outside the observation band. Watch for
language that collapses that distinction.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "draft-sweep-report.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "FIELD OBSERVATION REPORT — DRAFT",
            "Date:        2026-04-18",
            "Location:    Conference room 4B",
            "Duration:    90 minutes (10:00–11:30 local)",
            "Equipment:   handheld spectrum analyzer (band coverage 25 MHz – 6 GHz)",
            "",
            "Findings:",
            "  - No signals of interest observed in the swept bands.",
            "  - Wi-Fi and Bluetooth traffic observed at expected levels.",
            "  - Background cellular activity nominal.",
            "",
            "Conclusion:",
            "  Sweep was clean. No surveillance devices present.",
            "",
            "Recommendation:",
            "  Room is safe for sensitive discussions.",
            "",
            "— Field element 9",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "observation-log.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Periodic snapshots from the sweep tool. Awareness module — illustrative only.",
              equipment: "handheld spectrum analyzer (25 MHz – 6 GHz)",
              start_local: "2026-04-18T10:00:00",
              end_local: "2026-04-18T11:30:00",
              snapshots: [
                { t: "10:05", band: "2.4GHz", observations: "WiFi, Bluetooth" },
                { t: "10:18", band: "5GHz", observations: "WiFi" },
                { t: "10:34", band: "850MHz", observations: "cellular (carrier)" },
                { t: "10:51", band: "2.4GHz", observations: "WiFi, Bluetooth" },
                { t: "11:07", band: "1.9GHz", observations: "cellular (carrier)" },
                { t: "11:22", band: "5GHz", observations: "WiFi" },
              ],
              notes: [
                "No persistent signals outside known carrier/Wi-Fi/BT profiles.",
                "Coverage limited to 25 MHz – 6 GHz; bands outside this window were not assessed.",
                "Observation window: 90 minutes. Burst / duty-cycled emitters outside the window would not appear.",
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "spectrum-snapshot.png",
        kind: "image",
        mimeType: "image/png",
        bytes: tinyPngBytes(),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which phrases in the draft sweep report overstate what a 90-minute, 25 MHz–6 GHz observation can actually conclude? Select all that apply.",
        options: [
          { id: "sweep-clean", label: "\"Sweep was clean.\"" },
          { id: "no-devices", label: "\"No surveillance devices present.\"" },
          { id: "safe-for-discussions", label: "\"Room is safe for sensitive discussions.\"" },
          { id: "wifi-observed", label: "\"Wi-Fi and Bluetooth traffic observed at expected levels.\"" },
          { id: "background-nominal", label: "\"Background cellular activity nominal.\"" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["sweep-clean", "no-devices", "safe-for-discussions"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Overclaims:**",
          "",
          "- *\"Sweep was clean.\"* collapses a finite observation into a definitive negative finding.",
          "- *\"No surveillance devices present.\"* claims absence; the 90-minute / 25 MHz–6 GHz observation does not foreclose intermittent transmitters, RF-quiet devices, or out-of-band emitters.",
          "- *\"Room is safe for sensitive discussions.\"* is a *judgment*, not a measurement; the report should not assert it from this evidence alone.",
          "",
          "**Not overclaims:**",
          "",
          "- The Wi-Fi / Bluetooth / cellular observations are descriptions of what *was* observed during the window — they don't claim anything about what wasn't.",
          "",
          "Awareness module reminder: this exercise trains *language discipline*. It does not qualify you to render TSCM findings.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "confidence",
        weight: 1,
        promptMd:
          "On a 1–5 scale, how confident should the report's conclusion be that the room is RF-clean, given ONLY the evidence in the artifacts?",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd: [
          "The well-calibrated answer is **1 or 2**.",
          "",
          "The observation log explicitly notes the band coverage (25 MHz – 6 GHz) and the 90-minute window. A duty-cycled emitter or one operating outside the observed band would not appear; that is precisely the case where *absence of evidence is not evidence of absence*.",
          "",
          "A **3 or above** treats a bounded observation as a stronger negative finding than it is.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "The draft report concludes by declaring the room **safe**. Open the **observation-log.json** tab. Which observation-window bounds make that declaration unsupportable? Select all that apply.",
        options: [
          { id: "band-limit", label: "**Band coverage** — only 25 MHz to 6 GHz was assessed; anything outside that window is invisible to this equipment." },
          { id: "time-limit", label: "**Duration** — only a 90-minute window was observed; a duty-cycled emitter that doesn't transmit during the window doesn't appear." },
          { id: "ambient-wifi", label: "Wi-Fi and Bluetooth traffic was observed at expected levels." },
          { id: "carrier-cellular", label: "Background cellular activity was nominal." },
          { id: "no-anomaly", label: "No persistent signals outside known carrier / Wi-Fi / BT profiles." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["band-limit", "time-limit"],
          allowMultiple: true,
        },
        debriefMd: [
          "The observation was **band-limited** (25 MHz–6 GHz — anything outside that window is invisible to this equipment) and **time-limited** (90 minutes — a duty-cycled emitter that doesn't transmit during the window doesn't appear).",
          "",
          "Either alone would make a \"clean sweep\" declaration unsupportable; together they amount to *bounded observation, not absence*. A rewrite that names both bounds and ties escalation to \"presence-of-evidence questions outside the observation window\" would land the right framing.",
          "",
          "**Reasoning discipline reminder**: this is an awareness module. The exercise is **language calibration**, not TSCM training.",
        ].join("\n"),
      },
    ],
  },

  // ─── Tier 2 (draft) ─────────────────────────────────────────
  {
    slug: "rf-awareness-suspicious-observation-001",
    title: "RF Awareness: Suspicious Observation Report",
    summary:
      "Field element reports a persistent narrowband emitter during a sensitive event. Decide what to do without doing TSCM yourself.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["rf_awareness", "report_writing", "inference_discipline"],
    status: "draft",
    disclaimer: RF_AWARENESS_DISCLAIMER,
    brief: `
# Brief (DRAFT)

A field element forwards a brief observation note from a sensitive
event. The note describes a *"persistent narrowband emitter"*
observed in an unexpected band during the event window.

You are NOT a TSCM-qualified analyst. Decide what the report
language should say and what the operational next step is.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "field-note.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Field note — sensitive event observation",
            "----------------------------------------",
            "",
            "During the event window (14:00–17:00 local) a handheld observation",
            "tool registered a persistent narrowband signal on a frequency",
            "outside the expected Wi-Fi / Bluetooth / carrier-cellular set used",
            "by the event's published infrastructure plan.",
            "",
            "The signal:",
            "  - was present for at least 40 minutes continuously",
            "  - did not match any known device class on the published infra plan",
            "  - did not correspond to any registered event-affiliated transmitter",
            "",
            "The observer is NOT TSCM-qualified.",
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 1,
        promptMd: "Which sentence is the right finding for the field report?",
        options: [
          { id: "definitive-bug", label: "A surveillance device was operating during the event." },
          { id: "definitive-not-bug", label: "No anomaly observed." },
          { id: "calibrated-finding", label: "A persistent narrowband signal was observed that does not correspond to the published event infrastructure. The observation does not identify the signal's source. Recommend escalation to qualified TSCM personnel for assessment." },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["calibrated-finding"], allowMultiple: false },
        debriefMd:
          "Name the observation, name what it doesn't establish, name the escalation. \"Surveillance device\" is a finding the observer is not qualified to render; \"no anomaly\" ignores a real datapoint.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd: "Who should the report be escalated to?",
        textMatch: { acceptableAnswers: ["tscm", "qualified tscm", "tscm personnel", "tscm team", "qualified tscm personnel"] },
        expected: {
          type: "text_match",
          acceptableAnswers: ["tscm", "qualified tscm", "tscm personnel", "tscm team", "qualified tscm personnel"],
          regex: false,
        },
        debriefMd:
          "Qualified TSCM personnel. The escalation threshold is the right operational discipline — observation by a non-TSCM analyst names an anomaly worth assessment, and the assessment is done by people with the equipment and the certification.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that a surveillance device was operating.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "Low to moderate. Unidentified signals have many sources; the field note doesn't establish which. The escalation is appropriate; the high-confidence finding is not.",
      },
    ],
  },
];
