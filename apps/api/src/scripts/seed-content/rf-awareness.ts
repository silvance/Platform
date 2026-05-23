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
    lane: "rf_awareness",
    module: "Reports & observations",
    sequence: 1,
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
    lane: "rf_awareness",
    module: "Reports & observations",
    sequence: 2,
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

  // ─── Post-trip RF / device-awareness debrief ────────────────
  {
    slug: "rf-awareness-post-trip-debrief-001",
    title: "RF Awareness: Post-Trip Debrief Triage",
    summary:
      "A short trip narrative with several travel incidents. Decide which warrant a CIAR debrief and which don't, and draft non-speculative wording for the ones that do.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 18,
    tags: ["rf_awareness", "travel", "report_writing", "inference_discipline"],
    disclaimer: RF_AWARENESS_DISCLAIMER,
    lane: "rf_awareness",
    module: "Post-trip debrief",
    sequence: 1,
    brief: `
# Brief

A DA-civilian engineer returned from a five-day overseas
technical conference and the supporting ACI office has scheduled
their post-travel debrief. The traveller has written a one-page
narrative of the trip. Your job: triage the narrative incident
by incident — which items belong in the debrief, and which are
ordinary travel and don't.

The goal isn't to dramatise; it isn't to dismiss; it's to be
**accurate**. Observation discipline applies:

- Describe what was observed, not what it might mean.
- Reserve characterisation for items the traveller could
  actually attest to.
- For ambiguous items, the right move is to record the
  observation, name the uncertainty, and let the debriefer
  decide what (if anything) is worth referring further.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "trip-narrative.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "TRAVELLER NARRATIVE — FICTIONAL DATA",
            "Conference: international engineering symposium, overseas, 5 days",
            "============================================================",
            "",
            "1. Border crossing on entry: the laptop bag and government-",
            "   issued cell phone were taken out of my sight by the customs",
            "   officer for approximately 25 minutes during entry screening.",
            "   When the bag was returned, the laptop power-on indicator was",
            "   blinking briefly — I did not investigate further at the time.",
            "",
            "2. At the conference hotel, the room safe failed to lock on the",
            "   first evening. Engineering replaced it the next morning.",
            "   During the period the safe didn't lock, I kept the laptop",
            "   with me at all times.",
            "",
            "3. On day 2, a friendly conference attendee from a foreign",
            "   defence-research institute introduced themselves at lunch and",
            "   gradually steered the conversation from general topics to my",
            "   role on a specific research line, then asked whether I'd be",
            "   willing to keep in touch by personal email after the trip.",
            "   I gave a non-committal answer and excused myself.",
            "",
            "4. My personal phone auto-joined a Wi-Fi network in the hotel",
            "   lobby on day 3 that I had not configured. The SSID matched",
            "   the hotel name but had no captive portal.",
            "",
            "5. I attended the conference's vendor reception on day 4. There",
            "   was open bar; I drank one drink.",
            "",
            "6. On day 5 a stranger in the airport lounge asked which company",
            "   I worked for. I gave the published cover answer and changed",
            "   topic.",
            "",
            "7. On return, the government-issued cell phone showed a",
            "   significantly shorter battery life on standby than it had",
            "   before the trip.",
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which incidents belong in the debrief?",
        options: [
          {
            id: "border-loss-of-control",
            label:
              "1 — laptop + phone out of the traveller's sight during border screening for ~25 minutes, with a blinking power indicator on return.",
          },
          {
            id: "safe-failure",
            label:
              "2 — the safe failed to lock for an evening; the laptop was kept on the traveller throughout.",
          },
          {
            id: "graduated-elicitation",
            label:
              "3 — a foreign-defence-affiliated attendee steered a conversation toward a specific research line and asked for personal-email follow-up.",
          },
          {
            id: "auto-join-ssid",
            label:
              "4 — personal phone auto-joined an unconfigured Wi-Fi SSID matching the hotel name; no captive portal.",
          },
          {
            id: "open-bar",
            label:
              "5 — vendor reception with open bar; the traveller had one drink.",
          },
          {
            id: "airport-stranger",
            label:
              "6 — stranger asked the traveller's employer; the traveller gave the published answer and changed topic.",
          },
          {
            id: "battery-life-loss",
            label:
              "7 — government-issued cell phone shows a notably shorter standby battery life after the trip.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "border-loss-of-control",
            "graduated-elicitation",
            "auto-join-ssid",
            "battery-life-loss",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Belong in the debrief:**",
          "",
          "- *Border loss-of-control* — government-issued electronics out of the traveller's sight in a foreign jurisdiction is reportable; the blinking indicator is an observation worth noting, not (yet) a finding. Recommend technical inspection of the device.",
          "- *Graduated elicitation* — the conversation pattern (general → specific → ask for off-channel follow-up with a foreign-affiliated person) is the textbook elicitation arc. The traveller's own response is fine; the **encounter** belongs in the debrief.",
          "- *Auto-join unconfigured SSID* — phones don't auto-join networks they haven't seen before. A previously-saved name match (e.g., a different hotel's SSID elsewhere on the trip) is the benign explanation; either way it deserves a note.",
          "- *Battery-life change* — a sudden standby-drain change on a government-issued device is a technical observation, not an attribution. Recommend technical inspection.",
          "",
          "**Don't belong:**",
          "",
          "- *Safe failure* — the safe didn't lock for a few hours and the laptop was kept on the traveller. No loss of control occurred; this is hotel maintenance, not a debrief item.",
          "- *Open bar* — a single drink at a vendor reception is ordinary; flag only if intoxication or pressure occurred (and only if reportable under another category).",
          "- *Airport stranger* — a passing question answered with the published cover answer is unremarkable. Casual curiosity isn't elicitation; over-reporting it dilutes the signal of real elicitation encounters.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "For the border-screening incident (1), which one-line wording is the right write-up for the debrief record?",
        options: [
          {
            id: "wording-good",
            label:
              "\"On entry, government-issued laptop and cell phone were outside the traveller's direct observation for approximately 25 minutes during customs screening. On return, the laptop's power indicator was blinking. Recommend technical inspection of both devices before next mission use.\"",
          },
          {
            id: "wording-overclaim",
            label:
              "\"Government-issued devices were imaged by foreign customs during entry screening.\"",
          },
          {
            id: "wording-vague",
            label:
              "\"Something happened with the laptop at the border.\"",
          },
          {
            id: "wording-minimising",
            label:
              "\"Routine customs handling occurred; no concerns.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["wording-good"],
          allowMultiple: false,
        },
        debriefMd:
          "Describe what was observed (loss of direct observation; blinking indicator), give an approximate duration the traveller can attest to, and recommend the next technical step. Don't claim imaging (it isn't established), don't be vague (\"something happened\"), and don't minimise (\"routine; no concerns\" suppresses the observation entirely).",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the government-issued devices were compromised, based ONLY on the narrative.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "**1 to 3.** The narrative is a set of observations that warrant technical inspection — loss-of-control + post-trip battery anomaly + ambient social-engineering attempt. None of those *prove* compromise. Naming compromise without a technical inspection result is the canonical over-claim on a post-trip debrief. Hold the wording at \"observed indicators consistent with a need for technical inspection\" and let the inspection close the question.",
      },
    ],
  },
];
