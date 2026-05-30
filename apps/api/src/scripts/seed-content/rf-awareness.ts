import { utf8, tinyPngBytes } from "./util";
import type { ScenarioSeed } from "./types";

// Signals-awareness family (lane slug remains `rf_awareness` for
// URL stability; display name is "Signals Awareness"). Covers RF
// + acoustic observation reporting and TSCM Familiarity. Every
// scenario in this family carries the same framing — these are
// *awareness* modules: the analyst learns to recognise what an
// observation does and doesn't support, and when to escalate to
// qualified TSCM personnel. The exercise is investigative
// language discipline around bounded observations, not TSCM work.

export const RF_AWARENESS_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished) ──────────────────────────────────────
  {
    slug: "rf-awareness-clean-sweep-001",
    title: "Signals Awareness: \"Clean Sweep\" Report Review",
    summary:
      "A field element forwards a one-page sweep report concluding 'no devices present.' Assess the language for overclaim and identify when escalation to qualified TSCM personnel is warranted.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 25,
    tags: ["rf_awareness", "report_writing", "inference_discipline"],
    lane: "rf_awareness",
    module: "Reports & observations",
    sequence: 1,
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

This is a **TSCM Familiarity** module — awareness-level, not
TSCM-qualified work.

- ✅ It trains how to read sweep-style observations with a CI cyber lens.
- ✅ It trains how to recognise when to escalate to qualified TSCM personnel.
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
          "TSCM Familiarity reminder: this exercise trains *language discipline*. It does not qualify you to render TSCM findings.",
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
          { id: "ambient-wifi", label: "Wi-Fi and Bluetooth traffic was observed at expected levels — the presence of normal background traffic in the consumer bands means the room's spectrum is being actively used as expected and any covert emitter would have been audible against that baseline." },
          { id: "carrier-cellular", label: "Background cellular activity was nominal — clean carrier emissions in the room mean there's no signal-injection or stand-in transmitter masking other activity, so the unanimous absence of anomalies during the window can stand as a clean reading." },
          { id: "no-anomaly", label: "No persistent signals outside known carrier / Wi-Fi / BT profiles were detected during the window, which is the operational definition of \"no anomalous emissions\" the TSCM SOP uses for sweeping a room as clear." },
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
          "**Reasoning discipline reminder**: this is a TSCM Familiarity module. The exercise is **language calibration**, not TSCM-qualified work.",
        ].join("\n"),
      },
    ],
  },

  // ─── Tier 2 (draft) ─────────────────────────────────────────
  {
    slug: "rf-awareness-suspicious-observation-001",
    title: "Signals Awareness: Suspicious Observation Report",
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
          { id: "definitive-bug", label: "A clandestine surveillance device was operating during the event. The narrowband emitter on an unregistered frequency, persistent through the sensitive portion, and unmatched to any event transmitter is sufficient to identify the signal as hostile RF collection targeting the event." },
          { id: "definitive-not-bug", label: "No anomaly observed. The single narrowband emitter could be any number of mundane RF sources in the venue's broader spectrum (an unrelated commercial transmitter, a building HVAC controller, a nearby cellular small-cell), and absent confirmation by a TSCM team the observation is not strong enough to enter the field report at all." },
          { id: "calibrated-finding", label: "A persistent narrowband signal was observed that does not correspond to the published event infrastructure. The observation does not identify the signal's source. Recommend escalation to qualified TSCM personnel for assessment." },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["calibrated-finding"], allowMultiple: false },
        debriefMd:
          "Name the observation, name what it doesn't establish, name the escalation. \"Surveillance device\" is a finding the observer is not qualified to render; \"no anomaly\" ignores a real datapoint.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd: "Who should the report be escalated to?",
        options: [
          {
            id: "tscm",
            label:
              "Qualified TSCM personnel — they have the equipment and the certification to assess an RF anomaly.",
          },
          {
            id: "j6-netops",
            label:
              "J6 / network operations — they own the wired side and can disable affected ports.",
          },
          {
            id: "cidc-immediately",
            label:
              "USACIDC — open a criminal-investigative case immediately on the strength of the observation.",
          },
          {
            id: "ignore-until-pattern",
            label:
              "No-one yet — wait until a second matching observation surfaces, then escalate.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["tscm"],
          allowMultiple: false,
        },
        debriefMd:
          "**Qualified TSCM personnel.** The escalation threshold is the right operational discipline — a non-TSCM analyst names the anomaly worth assessing; the assessment itself is done by people with the equipment and the certification. J6 owns the wired side and is a stakeholder, not the primary owner of an RF anomaly. A criminal-investigative referral has no articulable predicate yet. Waiting for a second observation is the failure mode the discipline is designed to prevent.",
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
    title: "Signals Awareness: Post-Trip Debrief Triage",
    summary:
      "A short trip narrative with several travel incidents. Decide which warrant a CIAR debrief and which don't, and draft non-speculative wording for the ones that do.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 18,
    tags: ["rf_awareness", "travel", "report_writing", "inference_discipline"],
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
              "\"During entry to a foreign country, customs officials took the traveller's government-issued laptop and cell phone out of sight for approximately 25 minutes; the devices were imaged for intelligence collection during that period. On return the laptop's power indicator was blinking, consistent with the imaging operation having completed shortly before the devices were handed back.\"",
          },
          {
            id: "wording-vague",
            label:
              "\"Something happened with the laptop at the border — the traveller was separated from it for a while during customs and afterward noticed it acting oddly, but the specifics weren't clear at the time and weren't documented in the moment.\"",
          },
          {
            id: "wording-minimising",
            label:
              "\"Routine customs handling occurred; no concerns. The traveller's devices were briefly handled by foreign customs as part of normal entry-inspection procedures and were returned in working order with no observable changes worth reporting.\"",
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

  // ─── Acoustic-anomaly awareness ─────────────────────────────
  {
    slug: "signals-awareness-acoustic-anomaly-001",
    title: "Signals Awareness: Acoustic Anomaly in a Sensitive Office",
    summary:
      "An analyst working in a sensitive office notices a faint hum and a vibration in the wall during quiet hours. Triage the observation — what does it support, what doesn't it, and when does it warrant a TSCM call?",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 20,
    tags: ["rf_awareness", "acoustic", "tscm_familiarity", "report_writing", "inference_discipline"],
    lane: "rf_awareness",
    module: "Acoustic awareness",
    sequence: 1,
    brief: `
# Brief

You share a sensitive office on the third floor of a multi-tenant
building. During quiet hours on a recent Friday evening, while
the office was otherwise empty, you noticed two things:

1. A **faint, persistent hum** at what you'd characterise as
   low-frequency — the sort you feel as much as hear.
2. A **faint vibration in the shared wall** with the adjacent
   tenant's space when you put your hand against it.

You wrote a short observation note and asked your CISO whether
this warrants action. Your job: review the note for language
discipline, identify which of the listed mundane explanations
the observation can and can't rule out, and recommend the
correct next step.

## What this scenario is — and is not

This is a **TSCM Familiarity** module — awareness-level, not
TSCM-qualified work.

- ✅ Trains how to read an acoustic / vibration observation with
  a CI cyber lens.
- ✅ Trains how to recognise when to escalate to qualified TSCM
  personnel.
- ✅ Trains how to write the observation up without overclaim.
- ❌ Does **not** qualify you to perform acoustic surveys, assess
  structure-borne audio paths, or render any TSCM finding.

## Reasoning focus

Acoustic and vibration anomalies have a **long list of mundane
explanations** in a multi-tenant building — HVAC equipment,
elevator motors, plumbing in chases, transformers in service
closets, the upstairs neighbour's washing machine. Most are
benign. The discipline is: describe what you observed, name
what you can and can't rule out from your own observation,
and let qualified personnel decide whether to investigate.

The wrong moves are equally bad — assuming the hum is *nothing*
when it could be a structure-borne audio leak path, and assuming
it's a *device* when an HVAC chase is sitting two metres above
your head.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "observation-note.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "OBSERVATION NOTE — DRAFT",
            "Office:   3rd floor, suite 308",
            "When:     Friday 2026-05-22, ~19:15 local (after-hours)",
            "Observer: J. Doe (not TSCM-qualified)",
            "",
            "Observations:",
            "  - A persistent low-frequency hum is audible in the office.",
            "    It is steady, not pulsed. I'd guess it's around 60-80 Hz",
            "    but I have no way to measure that.",
            "  - With a hand on the shared north wall (with suite 309), I",
            "    can feel a faint vibration. The wall sounds slightly",
            "    different when tapped near the floor than near the",
            "    ceiling, but I would not call that a strong signal.",
            "  - The office HVAC supply diffuser is in the ceiling",
            "    directly above the desk. The supply was running when I",
            "    arrived. I have not yet tried switching it off via the",
            "    BMS to see whether the hum changes.",
            "  - The building has an elevator bank on the same floor,",
            "    approximately 8 metres from the office wall.",
            "  - Suite 309 is leased to a commercial tenant whose nature",
            "    I do not know.",
            "",
            "Tentative conclusion (PLEASE REVIEW BEFORE I FORWARD):",
            "  \"There is evidence of an active surveillance device or",
            "  audio bridge in the shared wall with suite 309. Recommend",
            "  immediate sweep.\"",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "building-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              building: "Multi-tenant commercial, 6 floors",
              suite: "3rd floor, suite 308 (the observer's office)",
              shared_systems_within_audible_range: [
                {
                  system: "VAV-fed HVAC supply",
                  notes:
                    "Ceiling diffuser directly above the observer's desk. Variable-air-volume box upstream on the same branch. Supply fans on building floor 6.",
                },
                {
                  system: "Elevator machine room",
                  notes:
                    "Two passenger cars, machine room on the roof. Hoist motors and brake actuators audible at low frequency when cars travel.",
                },
                {
                  system: "Plumbing risers",
                  notes:
                    "Cold/hot water + storm risers run in the north chase between suites 308 and 309. Pumps in basement.",
                },
                {
                  system: "Step-down transformer",
                  notes:
                    "Tenant-side step-down transformer in the floor 3 electrical closet, ~6 metres from the observer's office.",
                },
              ],
              adjacent_tenant_309: {
                lease: "Commercial; tenant identity not investigated",
                note:
                  "Walls between 308 and 309 are gypsum-on-stud with no documented STC rating; structural framing is shared.",
              },
              tscm_resource: {
                available: true,
                note:
                  "The supporting ACI element has on-call TSCM personnel who can be tasked through your CISO. This is an awareness-level observation; the TSCM team makes the assessment.",
              },
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Read the observation note and the building context. Which of these are **valid mundane explanations** that the observation, as written, does NOT rule out?",
        options: [
          {
            id: "hvac-vav",
            label:
              "The VAV-fed HVAC supply directly above the desk produces a steady low-frequency hum and can couple vibration into the ceiling grid and stud framing.",
          },
          {
            id: "elevator",
            label:
              "Elevator hoist motors and brake actuators produce a low-frequency hum that is audible in offices on the same floor when cars are travelling.",
          },
          {
            id: "plumbing",
            label:
              "Plumbing risers in the shared north chase between 308 and 309 carry pumped water and produce both low-frequency hum and wall-felt vibration.",
          },
          {
            id: "transformer",
            label:
              "A nearby step-down transformer in the floor-3 electrical closet hums at 60 Hz and its multiples; transformer hum is structure-borne and felt at adjacent walls.",
          },
          {
            id: "active-bug",
            label:
              "An active covert audio device in the shared wall — the observation specifically rules this in as the most plausible source because the hum and vibration appear together and the adjacent tenant is uncharacterised.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["hvac-vav", "elevator", "plumbing", "transformer"],
          allowMultiple: true,
        },
        debriefMd: [
          "All four mundane explanations are consistent with what was observed — HVAC, elevator, plumbing, and electrical infrastructure are present, sit at the right distances, and produce both audible hum and structure-borne vibration at the right frequencies.",
          "",
          "Pre-empting any of them as \"ruled out\" without measurement is exactly the kind of move TSCM Familiarity training is meant to suppress. The observation by itself does not distinguish between the mundane and the covert; that's why it gets escalated, not characterised.",
          "",
          "The covert-device option is the trap: it phrases an observation as proof of the most exciting candidate explanation. The honest read is \"observation consistent with several mundane sources and not foreclosing on a covert one — escalate to qualified personnel.\"",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "The draft's tentative conclusion is *\"There is evidence of an active surveillance device or audio bridge in the shared wall with suite 309.\"* What's the most defensible replacement?",
        options: [
          {
            id: "good",
            label:
              "\"A persistent low-frequency hum and a faint vibration in the shared north wall were observed during after-hours in suite 308. Multiple mundane sources (HVAC, elevator, plumbing riser, electrical closet transformer) are consistent with the observation and have not been ruled out. Recommend referral to qualified TSCM personnel via the CISO; the observer is not TSCM-qualified.\"",
          },
          {
            id: "bug-confirmed",
            label:
              "\"An active audio surveillance device is present in the shared wall between suites 308 and 309. The combination of a persistent low-frequency hum and a structure-borne vibration is the canonical signature of an audio bridge transmitting through the wall, and the adjacent tenant's lack of declared identity is consistent with deliberate placement opposite a sensitive office.\"",
          },
          {
            id: "minimising",
            label:
              "\"No findings to report. The hum and wall vibration are consistent with normal HVAC operation in a commercial building and the observation does not justify escalation; the office can be considered acoustically clean for ordinary use.\"",
          },
          {
            id: "speculative",
            label:
              "\"There may or may not be a covert listening device in the shared wall; further observation by the office occupants over the next several weeks should clarify whether the hum is mechanical or device-driven, and only if it persists should we consider referring this to TSCM.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["good"],
          allowMultiple: false,
        },
        debriefMd:
          "Describe the observation, name the mundane candidates that aren't ruled out, name the observer's non-qualification, and recommend the right next step (escalation to TSCM). The bug-confirmed option overclaims; the minimising option suppresses the observation; the speculative option asks the non-qualified observer to do an extended monitoring loop that the TSCM team should own.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that an active covert audio device is present in the shared wall, based ONLY on the observation note and building context.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The observation is consistent with several mundane sources that haven't been ruled out and was made by a non-TSCM-qualified observer with no instrumentation. That doesn't make a covert source impossible — it makes the observation not informative for that question. Reserve confidence 4–5 for after a qualified TSCM assessment.",
      },
    ],
  },

  // ─── Wi-Fi / BT signal-baseline awareness ───────────────────
  {
    slug: "signals-awareness-wifi-bt-baseline-001",
    title: "Signals Awareness: Reading a Venue Wi-Fi / Bluetooth Baseline",
    summary:
      "Before a sensitive event, a junior analyst captures a Wi-Fi + Bluetooth scan of the venue and lists every device they saw. Triage what the list does and does not support — and notice the rogue-AP candidate before it bites.",
    skillAreas: ["rf_awareness", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["rf_awareness", "wifi", "bluetooth", "tscm_familiarity", "inference_discipline"],
    lane: "rf_awareness",
    module: "Signal-baseline awareness",
    sequence: 1,
    brief: `
# Brief

A junior analyst on your team is prepping the room for a
sensitive cross-organisation meeting at a hotel venue. Two
hours before the meeting they ran a handheld Wi-Fi + Bluetooth
scan and produced a list of every SSID and BT device the tool
saw. They've asked you to look at the list and tell them what's
worth flagging before the meeting starts.

## What this scenario is — and is not

This is a **TSCM Familiarity** module — awareness-level, not
TSCM-qualified work.

- ✅ Trains how to read a passive signal baseline with a CI
  cyber lens.
- ✅ Trains how to recognise rogue-AP / evil-twin candidates and
  separate them from boring ambient noise.
- ✅ Trains how to escalate the right observations to qualified
  personnel before they bite.
- ❌ Does **not** qualify you to perform RF surveys, characterise
  emitters, or render any TSCM finding. Passive observation of
  signals visible to a consumer handheld is **not** a sweep.

## Reading the list

A hotel scan looks busy because hotels are busy. The vast
majority of what the tool sees is legitimate — venue Wi-Fi,
guest devices, BT headphones, the building's IoT pool (printers,
beacons, lighting). The trick is naming the entries that don't
match the venue's published infrastructure, **without** treating
every unknown as hostile.

Common watch items, in roughly increasing concern:

- **Same SSID, different BSSID** — multiple APs broadcasting the
  same network name. Normal on big venue Wi-Fi. Concerning when
  the unexpected BSSID is on a vendor you don't recognise.
- **Evil-twin pattern** — guest-Wi-Fi SSID being broadcast by an
  AP whose MAC OUI isn't the venue's documented Wi-Fi vendor.
- **Captive portal mismatch** — guest network with no captive
  portal where one is expected, or a portal that asks for
  unusual credentials.
- **High-power AP not in the venue plan** — a previously unseen
  BSSID at signal strength suggesting it's physically inside or
  immediately adjacent to the meeting room.
- **Bluetooth beacons or named "audio recorder" / "voice memo"
  device classes** in the immediate room.

None of these is by itself proof. They're escalation prompts.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "wifi-scan.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ssid,bssid,band,channel,rssi_dbm,oui_vendor,captive_portal_observed,note",
            "Grand Hotel WiFi,b8:27:eb:11:22:33,2.4 GHz,6,-58,Ruckus Networks,yes,documented venue AP",
            "Grand Hotel WiFi,b8:27:eb:11:22:34,5 GHz,36,-62,Ruckus Networks,yes,documented venue AP",
            "Grand Hotel WiFi,b8:27:eb:11:22:35,5 GHz,149,-64,Ruckus Networks,yes,documented venue AP",
            "Grand Hotel WiFi,3c:5a:b4:01:02:03,2.4 GHz,11,-49,TP-Link Technologies,no,not in the venue infrastructure plan",
            "Grand Hotel Staff,b8:27:eb:11:22:36,5 GHz,44,-71,Ruckus Networks,(no — staff network),documented venue staff AP",
            "(hidden),fc:f5:28:11:22:33,2.4 GHz,1,-83,Espressif Inc.,(n/a),likely IoT / ESP32 device",
            "ATT-1A2B,a0:55:4f:33:44:55,2.4 GHz,11,-79,AT&T Mobility,no,likely tethered phone — guest belt-pack signal level",
            "(hidden),f8:1a:67:22:33:44,5 GHz,165,-77,Apple Inc.,(n/a),likely personal hotspot",
            "Vendor-AV-Room-Link,d8:fc:93:55:66:77,5 GHz,52,-66,Intel Corporate,no,probable AV truck back-channel; not documented in venue plan",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "bt-scan.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "device_name,bd_addr,device_class,rssi_dbm,note",
            "(no name),50:c2:75:aa:bb:cc,Audio/Video : Headset,-72,likely guest headphones",
            "JBL Charge 5,7c:1c:4e:dd:ee:ff,Audio/Video : Portable Audio,-68,likely guest speaker",
            "MX Anywhere 3,40:9e:e3:11:00:00,Peripheral : Pointing device,-77,likely conference mouse",
            "VoiceMemoXR-22,3a:1f:c8:22:11:00,Audio/Video : Wearable Headset,-46,*high signal strength; named device class is recording-capable wearable",
            "(no name),18:74:2e:33:44:55,Phone : Smartphone,-63,likely guest phone",
            "BT Tile,7f:a2:5d:66:77:88,Object Tracker,-79,likely keychain tracker; benign",
            "AV-RX-Channel-3,d8:fc:93:55:66:77,Audio/Video : Headphones,-66,same OUI as Vendor-AV-Room-Link AP",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "venue-infrastructure-plan.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              venue: "Grand Hotel — Conference Centre",
              meeting_room: "Cedar Room (3rd floor, room 312)",
              published_wifi: [
                {
                  ssid: "Grand Hotel WiFi",
                  vendor: "Ruckus Networks",
                  oui_prefixes: ["b8:27:eb"],
                  captive_portal: true,
                },
                {
                  ssid: "Grand Hotel Staff",
                  vendor: "Ruckus Networks",
                  oui_prefixes: ["b8:27:eb"],
                  captive_portal: false,
                  scope: "Staff-only, 802.1x",
                },
              ],
              published_av_infra: {
                vendor: "Independent AV contractor",
                notes:
                  "AV runs on its own wired backbone; no documented 5 GHz back-channel. A Wi-Fi-bridged AV link in the meeting room would be NOT in the venue plan.",
              },
              expected_iot_pool: [
                "Hotel printers, lighting bridges, hallway BT beacons (low signal)",
                "Guest devices in/around the floor 3 corridor",
              ],
              tscm_resource: {
                available: true,
                note:
                  "Supporting ACI element has TSCM personnel who can be tasked through the meeting principal's CISO with 30-60 min lead time for an unscheduled assessment.",
              },
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "From the Wi-Fi + Bluetooth scans and the published venue plan, which entries are **worth flagging for escalation** before the meeting starts? Select all that apply.",
        options: [
          {
            id: "evil-twin-tplink",
            label:
              "A second BSSID broadcasting `Grand Hotel WiFi` from a TP-Link OUI (`3c:5a:b4:...`) with no captive portal at strong signal — the venue plan documents Ruckus as the Wi-Fi vendor, not TP-Link.",
          },
          {
            id: "vendor-av-undocumented",
            label:
              "An undocumented `Vendor-AV-Room-Link` AP plus a matching-OUI Bluetooth `AV-RX-Channel-3` device — the venue plan says AV is wired and lists no documented 5 GHz back-channel.",
          },
          {
            id: "voicememo-bt",
            label:
              "A Bluetooth device named `VoiceMemoXR-22` with a recording-capable wearable device class, observed at very high signal strength (-46 dBm) in or immediately adjacent to the meeting room.",
          },
          {
            id: "att-tether",
            label:
              "An `ATT-1A2B` SSID at low signal strength on the AT&T Mobility OUI — guest-phone tether pattern. This is the canonical fingerprint of an attacker-controlled rogue AP because guest phones routinely auto-join SSIDs they've seen before and the SSID was specifically named to attract trusted devices.",
          },
          {
            id: "esp32-hidden",
            label:
              "A hidden SSID on an Espressif OUI at -83 dBm. Hidden ESP32 SSIDs at low signal in a hotel are the textbook signature of a long-running covert beacon and should be the highest-priority flag on the list.",
          },
          {
            id: "jbl-headphones",
            label:
              "`JBL Charge 5` Bluetooth speaker at -68 dBm — consumer audio gear in a hotel ballroom is the most common rogue-AP cover for a packet sniffer and warrants escalation by default.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["evil-twin-tplink", "vendor-av-undocumented", "voicememo-bt"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Worth flagging:**",
          "",
          "- *TP-Link `Grand Hotel WiFi`*: evil-twin candidate. Venue plan documents Ruckus; the TP-Link AP broadcasting the same SSID with no captive portal is the textbook pattern. Has guests' devices auto-joined it already?",
          "- *Vendor-AV-Room-Link + matching-OUI BT device*: undocumented Wi-Fi presence specifically tied to an AV channel; venue plan says AV is wired. Could be a sloppy vendor; could be an unauthorised back-channel into the room.",
          "- *VoiceMemoXR-22*: recording-capable BT device class, very high signal strength (=in the room or right outside it), name explicitly references voice recording. Worth at minimum a polite \"whose device is this?\" walk-around.",
          "",
          "**Not worth escalating (ordinary hotel noise):**",
          "",
          "- *ATT-1A2B*: weak-signal AT&T-OUI personal hotspot — guest tether, not a rogue AP. The \"named to attract trusted devices\" framing is fiction; the SSID is just AT&T's default tether name.",
          "- *Hidden ESP32 at -83 dBm*: weak-signal IoT device — hotels are full of these (door lock controllers, BLE bridges, lighting). Default device class on Espressif silicon; not a TSCM concern in isolation.",
          "- *JBL Charge 5*: consumer Bluetooth speaker. Sniffer cover stories don't make consumer electronics suspicious.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Of the items worth flagging, which one warrants **escalation to qualified TSCM personnel before the meeting begins**, vs handling locally?",
        options: [
          {
            id: "tplink-tscm",
            label:
              "The TP-Link `Grand Hotel WiFi` evil-twin candidate — the venue plan specifies Ruckus, the TP-Link AP can intercept guest credentials and is potentially attributable to a positioned actor; this is exactly the call TSCM (and venue IT) should make before the principal enters the room.",
          },
          {
            id: "av-tscm",
            label:
              "The undocumented `Vendor-AV-Room-Link` plus the matching-OUI BT receiver — this is the highest-priority flag because AV truck back-channels carry meeting audio by design, and an unauthorised one is a direct audio-exfiltration risk.",
          },
          {
            id: "voicememo-local",
            label:
              "The `VoiceMemoXR-22` BT device — handle locally with a walk-around to identify whose device it is; if it can't be attributed in five minutes, escalate.",
          },
          {
            id: "all-three",
            label:
              "All three — the disciplined call when multiple unrelated rogue-candidate observations stack up in the same pre-meeting window is to escalate the whole picture to qualified personnel rather than triage them individually.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["all-three"],
          allowMultiple: false,
        },
        debriefMd:
          "When three independent rogue-candidate signals stack in the same pre-meeting window — undocumented WiFi vendor broadcasting a hotel SSID, undocumented vendor-AV channel, and a recording-capable BT device in the room — the disciplined call is to stop triaging individually and hand the picture to qualified TSCM personnel. The 30-60 min TSCM lead time documented in the venue plan exists exactly so the principal doesn't enter the room while a junior analyst is working through the list one item at a time.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the TP-Link AP broadcasting `Grand Hotel WiFi` is a deliberately positioned evil twin (vs a guest's misconfigured portable router), based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2–3.** The pattern is suspicious — a non-vendor AP broadcasting the venue's SSID with no captive portal is exactly what an evil twin looks like. But it's also exactly what a clueless guest's portable travel router cloned-by-name looks like. Without RSSI triangulation, channel-utilisation tracking over time, or actual deauth-attack telemetry, the artifact can't distinguish deliberate from incidental. Hand it to TSCM and let them confirm.",
      },
    ],
  },
];
