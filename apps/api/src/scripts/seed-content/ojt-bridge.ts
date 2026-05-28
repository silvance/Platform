import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// OJT Bridge family. Short bridge scenarios for new CDTIs who
// have completed introductory coursework (INCH, CIRC, WFE-A /
// AXIOM) and recognise common artifacts but haven't yet built
// the habit of saying *only* what those artifacts support.
//
// Design rules (per the lane brief):
//   - 1 artifact, max 2
//   - 3 questions max
//   - no long select-all questions
//   - no dense tool output
//   - no regulation quiz
//   - no vendor-UI cloning (the *shape* of a tool output is fine;
//     "click these buttons in AXIOM" is not)
//   - no trick questions
//   - debriefs explain the reasoning plainly
//   - each challenge fits in 5–8 minutes
//
// Each scenario answers the same five questions for the student:
//   What do I see? What does it support? What does it not
//   support? What would strengthen the finding? How should I
//   phrase it?

export const OJT_BRIDGE_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. AXIOM-style case summary: parser output vs completeness
  {
    slug: "ojt-bridge-axiom-summary-001",
    title: "Parser Counts vs Completeness Claims",
    summary:
      "A case-summary view lists how many records the parser pulled per category. Decide what those counts prove — and what they don't.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 6,
    tags: ["ojt-bridge", "parsers", "inference_discipline"],
    lane: "ojt_bridge",
    module: "Tool output vs conclusion",
    sequence: 1,
    brief: `
# Brief

When a tool finishes processing an image, the case summary lists
*counts per category* — how many browser-history records, how
many emails, how many SMS messages, and so on. New analysts
sometimes read those counts as a claim about *what was on the
device*, when they really only describe *what the parser
extracted*.

The two are not the same thing.

`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "case-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Case summary — parsed artifact counts",
            "-------------------------------------",
            "",
            "  Browser history records ........... 1,247",
            "  Email messages .................... 3",
            "  SMS messages ...................... 0",
            "  Chat messages ..................... 0",
            "  Pictures .......................... 482",
            "  Documents ......................... 91",
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
        promptMd:
          "Which statement best describes what these counts **directly support**?",
        options: [
          {
            id: "parser-found",
            label:
              "The parser extracted this many records in each category from the image it was given.",
          },
          {
            id: "device-contained",
            label:
              "The device contains exactly this many records in each category.",
          },
          {
            id: "user-sent",
            label:
              "The user sent and received this many records in each category.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["parser-found"],
          allowMultiple: false,
        },
        debriefMd:
          "**What the parser extracted.** The counts describe parser output — which depends on the tool's coverage of the format, the parser version, and what the source image contained. \"What the device contained\" and \"what the user did\" are bigger claims that the count alone doesn't reach.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does \"SMS messages: 0\" prove the user **never sent any SMS** on this device?",
        options: [
          {
            id: "no-absence-not-proof",
            label:
              "No. \"The parser surfaced zero SMS\" is not the same as \"zero SMS ever existed.\" The parser might not cover this device's SMS store, the messages might have been deleted and overwritten, or the source image might not include the SMS partition.",
          },
          {
            id: "yes-zero-means-zero",
            label:
              "Yes. A zero count means zero records existed.",
          },
          {
            id: "yes-tool-is-complete",
            label:
              "Yes. Forensic parsers are designed to find every message, so a zero is reliable.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-absence-not-proof"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** A zero count is *absence of trace in the artifact set you have*, not *absence of activity in the world*. A defensible finding writes \"no SMS records were surfaced by this parser against this image\" and leaves room for the parser, the acquisition type, or a deletion event to explain it.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this case summary, on its own, is enough to say *\"the user never used SMS on this device.\"*",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** A summary count is a starting point for analysis, not a finding. To make the \"never used\" claim you'd need to verify the parser supports this device's SMS store, confirm the acquisition included the relevant partition, and rule out deletion / overwrite — none of which a count alone tells you.",
      },
    ],
  },

  // ─── 2. Live acquisition log: collection completed vs evidence
  {
    slug: "ojt-bridge-acquisition-log-001",
    title: "\"Acquisition Complete\" Is Not \"Evidence Found\"",
    summary:
      "A live-acquisition log shows a successful image capture. Decide what that success does — and doesn't — say about the case.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 5,
    tags: ["ojt-bridge", "acquisition", "inference_discipline"],
    lane: "ojt_bridge",
    module: "Tool output vs conclusion",
    sequence: 2,
    brief: `
# Brief

An acquisition log records what happened during evidence
*collection*: source identification, target image path, hashes,
elapsed time, completion status. That's a story about the
collection process, not about the content of the image.

A clean acquisition log says you *captured the image without
errors*. It doesn't say what's in the image.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "acquisition.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Live acquisition — completion summary",
            "-------------------------------------",
            "",
            "  Source            : Internal hard drive (1 TB)",
            "  Target            : /evidence/2026/164/image.E01",
            "  Image format      : EnCase E01 (compressed)",
            "  Started           : 2026-09-22 13:02:11 UTC",
            "  Finished          : 2026-09-22 15:47:08 UTC",
            "  SHA-256 (source)  : 7c81...b3f4   (computed during read)",
            "  SHA-256 (image)   : 7c81...b3f4   (verified after write)",
            "  Status            : COMPLETE — no read errors",
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
        promptMd:
          "What does the \"COMPLETE — no read errors\" line **directly tell you**?",
        options: [
          {
            id: "image-clean",
            label:
              "The image was captured cleanly: every sector of the source was read once, written to the image, and the two SHA-256 hashes match.",
          },
          {
            id: "evidence-found",
            label:
              "The image contains evidence of the activity under investigation.",
          },
          {
            id: "device-malware-free",
            label:
              "The source device is free of malware.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["image-clean"],
          allowMultiple: false,
        },
        debriefMd:
          "**The image was captured cleanly.** The status line speaks about the *acquisition*, not the *contents*. Anything you want to say about what's in the image needs analysis steps after the acquisition is done.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does a successful acquisition prove the case has **evidentiary value**?",
        options: [
          {
            id: "no-collection-vs-content",
            label:
              "No. A clean acquisition means you have a faithful copy of the source to analyze. Whether it contains anything useful is a separate analysis question.",
          },
          {
            id: "yes-image-must-have-evidence",
            label:
              "Yes. Why would you image the drive if it didn't?",
          },
          {
            id: "yes-hash-match-is-the-finding",
            label:
              "Yes. The matching SHA-256 hashes are the finding — the case is proven.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-collection-vs-content"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** \"We collected a clean image\" and \"the image supports the case\" are two different sentences. The first is about handling; the second is about analysis. A defensible report keeps the two strictly separated.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the report should say *\"Evidence of the alleged activity was recovered from the device.\"* on the strength of this acquisition log alone.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** This log proves the *acquisition* succeeded. The recovery sentence describes the *analysis* result and needs analysis artifacts to support it.",
      },
    ],
  },

  // ─── 3. Prefetch: execution evidence vs intent / user identity
  {
    slug: "ojt-bridge-prefetch-001",
    title: "Prefetch: Execution vs Identity",
    summary:
      "A Prefetch entry shows a program ran a known number of times. Decide what that proves about who ran it and why.",
    skillAreas: ["windows_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 6,
    tags: ["ojt-bridge", "prefetch", "windows", "inference_discipline"],
    lane: "ojt_bridge",
    module: "Familiar artifacts, careful claims",
    sequence: 1,
    brief: `
# Brief

Windows Prefetch is a performance feature: when a program runs,
the loader writes a small \`.pf\` file under \`C:\\Windows\\Prefetch\\\`
that records when the program ran and how often.

For analysts, the value is that Prefetch confirms *execution*:
if there's a Prefetch entry for an EXE, the EXE ran at least
once on that system. That's a useful, evidence-grade fact.

What Prefetch *doesn't* tell you is **which user ran it** or
**why**. The loader writes the same Prefetch entry regardless of
which account ran the program; Prefetch is system-wide, not
per-user.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "prefetch-entry.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Prefetch entry — single file",
            "----------------------------",
            "",
            "  File           : NOTEPAD.EXE-XXXXAAAA.pf",
            "  Executable     : NOTEPAD.EXE",
            "  First run      : 2026-09-04 09:11:18 UTC",
            "  Last run       : 2026-10-02 14:22:07 UTC",
            "  Run count      : 7",
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
        promptMd:
          "Which statement does the Prefetch entry **directly support**?",
        options: [
          {
            id: "exe-ran",
            label:
              "`notepad.exe` was executed on this Windows host at least seven times between the first and last run timestamps.",
          },
          {
            id: "user-opened",
            label:
              "The suspect personally opened `notepad.exe` seven times.",
          },
          {
            id: "user-read",
            label:
              "The user read sensitive documents in `notepad.exe`.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["exe-ran"],
          allowMultiple: false,
        },
        debriefMd:
          "**The EXE ran at least seven times on this host.** That's exactly what Prefetch records. The other options leap to *who* and *why* — questions Prefetch can't answer because it doesn't record the calling user or the program's input.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which **single additional artifact** would most directly identify the user who ran the program at one of those times?",
        options: [
          {
            id: "userassist",
            label:
              "The user's `UserAssist` registry entries (per-user, records GUI-launched programs).",
          },
          {
            id: "more-prefetch",
            label:
              "More Prefetch entries on the same host.",
          },
          {
            id: "antivirus-log",
            label:
              "The host's antivirus log.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["userassist"],
          allowMultiple: false,
        },
        debriefMd:
          "**UserAssist.** It's a per-user registry artifact that records GUI-launched programs under that user's NTUSER.DAT. Sysmon Event 1 (ProcessCreate) — Sysmon is Microsoft's free System Monitor service that emits structured process / network / file events to the Event Log — or 4688 audit events with the SubjectUserName field are stronger if you have them; but among the three options, UserAssist is the one that ties an execution to a specific user.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this Prefetch entry alone is enough to say *\"The suspect personally used notepad to read sensitive documents.\"*",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Prefetch confirms the program ran. It does not confirm *who* ran it, *what input* it received, or *why*. That sentence needs per-user execution evidence (UserAssist / 4688 / Sysmon) and *opened-file* evidence (Recent / Jumplist / Office MRUs) to land.",
      },
    ],
  },

  // ─── 4. USBSTOR: device connection vs file-copy attribution
  {
    slug: "ojt-bridge-usbstor-001",
    title: "USB Connected vs Files Copied",
    summary:
      "A USBSTOR registry record shows a thumb drive was plugged in. Decide what that proves about whether files were copied.",
    skillAreas: ["windows_artifacts", "removable_media", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 6,
    tags: ["ojt-bridge", "usbstor", "removable_media", "inference_discipline"],
    lane: "ojt_bridge",
    module: "Familiar artifacts, careful claims",
    sequence: 2,
    brief: `
# Brief

When a USB mass-storage device is plugged into a Windows host,
the operating system writes a small record under the registry
key:

\`\`\`
HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USBSTOR
\`\`\`

That record captures *the device showed up*: vendor, product,
serial, the time it was first installed, and when it was last
connected. It does **not** capture what — if anything — happened
between connect and disconnect.

Q2 references EDR and Sysmon. EDR (Endpoint Detection and
Response) is the enterprise security agent class — Falcon,
Defender for Endpoint, and similar. Sysmon is Microsoft's free
System Monitor service that emits structured process, network, and
file events to the Event Log. Both can record per-file writes,
including writes to a USB volume.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "usbstor-record.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "USBSTOR record — single device",
            "------------------------------",
            "",
            "  Vendor / Product   : Kingston DataTraveler 3.0",
            "  Serial             : AA-LT-001",
            "  First install date : 2026-04-02 08:11:04 UTC",
            "  Last arrival date  : 2026-09-18 14:22:08 UTC",
            "  Last removal date  : 2026-09-18 15:08:41 UTC",
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
        promptMd:
          "Which statement is **directly supported** by the USBSTOR record?",
        options: [
          {
            id: "device-connected",
            label:
              "A Kingston DataTraveler with serial `AA-LT-001` was connected to this Windows host on 2026-09-18, from 14:22 to 15:08 UTC.",
          },
          {
            id: "files-copied",
            label:
              "Files were copied from the workstation to the device during that window.",
          },
          {
            id: "user-took-data",
            label:
              "The user took data off the workstation on a thumb drive.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["device-connected"],
          allowMultiple: false,
        },
        debriefMd:
          "**The device was connected.** USBSTOR is a connection record — vendor / product / serial / arrival / removal. It says nothing about file writes, reads, or any other activity that happened during the window.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which **single additional artifact** would most directly turn \"the USB was plugged in\" into \"a specific file was copied to it\"?",
        options: [
          {
            id: "edr-file-write",
            label:
              "An EDR / Sysmon `FileCreate` event scoped to the USB volume during the connection window, naming the specific file.",
          },
          {
            id: "more-usbstor",
            label:
              "More USBSTOR records for other devices.",
          },
          {
            id: "device-photograph",
            label:
              "A photograph of the device after it was seized.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["edr-file-write"],
          allowMultiple: false,
        },
        debriefMd:
          "**An EDR / Sysmon file-write event.** That artifact records *bytes being written to the USB volume* — the missing link between \"a device was plugged in\" and \"a file ended up on the device.\" Without it, the USBSTOR record establishes opportunity but not the action.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the USBSTOR record alone is enough to say *\"The user copied files off the workstation.\"*",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The record proves *opportunity*, not *action*. A defensible finding writes \"a Kingston device was connected during a 46-minute window\" and stops there, then names the file-write evidence that would convert it.",
      },
    ],
  },

  // ─── 5. Browser download record: download vs opening / execution
  {
    slug: "ojt-bridge-browser-download-001",
    title: "Downloaded ≠ Opened ≠ Run",
    summary:
      "A browser-history row shows a file was downloaded. Decide what that proves about whether it was opened or executed.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 6,
    tags: ["ojt-bridge", "browser", "inference_discipline"],
    lane: "ojt_bridge",
    module: "Familiar artifacts, careful claims",
    sequence: 3,
    brief: `
# Brief

A browser-history row records a download: the source URL, the
target path on disk, the byte counts, and the download's final
state. It captures the act of *saving the file to disk*.

It does NOT capture what happens to the file afterwards —
whether the user opens it, runs it, deletes it, or leaves it on
disk untouched. Those are separate artifacts.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "downloads-row.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Browser downloads — single row",
            "------------------------------",
            "",
            "  Source URL     : https://files.example/installers/util-x.exe",
            "  Target path    : C:\\Users\\m.wong\\Downloads\\util-x.exe",
            "  Bytes received : 28,672 / 28,672  (complete)",
            "  Start time     : 2026-09-03 14:08:21 UTC",
            "  End time       : 2026-09-03 14:08:25 UTC",
            "  State          : Completed",
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
        promptMd:
          "Which statement is **directly supported** by the download row?",
        options: [
          {
            id: "saved",
            label:
              "`util-x.exe` was saved to `m.wong`'s Downloads folder around 2026-09-03 14:08 UTC and the download completed without error.",
          },
          {
            id: "executed",
            label:
              "The user executed `util-x.exe` after it finished downloading.",
          },
          {
            id: "intentional",
            label:
              "The user knowingly chose to download a malicious file.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["saved"],
          allowMultiple: false,
        },
        debriefMd:
          "**The file was saved to disk.** The download row records exactly that. \"Executed\" and \"intentional\" are bigger claims that need separate evidence: execution needs Prefetch / Amcache / Sysmon (Microsoft System Monitor — free Windows service that emits per-process events) / 4688; intent needs context the artifact doesn't carry.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which **single additional artifact** would most directly establish that `util-x.exe` **was executed** on this host?",
        options: [
          {
            id: "prefetch",
            label:
              "A Prefetch entry for `UTIL-X.EXE-XXXX.pf` post-dating the download time.",
          },
          {
            id: "more-downloads",
            label:
              "More browser downloads from the same source URL.",
          },
          {
            id: "file-presence",
            label:
              "Confirmation that the file is still on disk at the target path.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["prefetch"],
          allowMultiple: false,
        },
        debriefMd:
          "**A Prefetch entry.** Prefetch's presence is the standard \"this EXE ran at least once on this host\" signal. \"File still on disk\" is *presence*, not execution; \"more downloads from the URL\" is collateral context, not execution evidence.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this download row alone supports *\"The user downloaded and ran the malware.\"*",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** *Downloaded* the row supports. *Ran* is a separate claim. *Malware* is a third claim (needs analysis of the file's behaviour). A defensible writeup states the download fact and names the next artifacts you'd pull (Prefetch / Amcache / Sysmon) to get to *ran*.",
      },
    ],
  },

  // ─── 6. Rewriting an overconfident finding (CDTI-flavored) ──
  {
    slug: "ojt-bridge-rewrite-finding-001",
    title: "Rewriting an Overconfident Finding",
    summary:
      "A draft finding overclaims. Pick the rewrite that says only what the listed evidence supports.",
    skillAreas: ["report_writing", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 8,
    tags: ["ojt-bridge", "report_writing", "inference_discipline"],
    lane: "ojt_bridge",
    module: "Saying what's proven",
    sequence: 1,
    brief: `
# Brief

The hardest habit at this stage is the simplest: write only
what the evidence supports. The draft below contains four
separate claims; only some of them are supported by the listed
artifacts.

## Evidence available

> - **USBSTOR** record: a Kingston USB device (serial AA-LT-001)
>   was connected to workstation WS-LT-018 from 14:22 to 15:08 UTC
>   on 2026-09-18.
> - **Browser-history** row: \`q3-targets.xlsx\` was opened in
>   Excel at 14:30 UTC on the same workstation.
> - **No EDR file-write events** to the USB volume were captured
>   during the connection window. (EDR = Endpoint Detection and
>   Response — host-side security telemetry like CrowdStrike
>   Falcon, Microsoft Defender for Endpoint, or Sysmon.)

## Draft finding (overclaims)

> *"The subject intentionally exfiltrated Q3 targets to a personal
> thumb drive."*

That sentence asserts *exfiltrated* (a file write to the USB),
*intentionally* (motive), *personal* (ownership of the device),
and *the Q3 targets* (the specific file moved). The listed
evidence supports some of those claims and not others.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "draft-and-evidence.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Evidence available",
            "------------------",
            "  - USBSTOR: Kingston DataTraveler serial AA-LT-001",
            "    connected to WS-LT-018, 14:22 to 15:08 UTC, 2026-09-18.",
            "  - Browser history: q3-targets.xlsx opened in Excel on",
            "    WS-LT-018 at 14:30 UTC, same day.",
            "  - EDR (host-monitoring agent): NO file-write events to",
            "    the USB volume were captured during the connection",
            "    window.",
            "",
            "Draft finding (overclaims)",
            "--------------------------",
            "  \"The subject intentionally exfiltrated Q3 targets to a",
            "   personal thumb drive.\"",
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
          "Which rewrite is the **right one** — the most honest given the evidence?",
        options: [
          {
            id: "assertive-same",
            label:
              "\"On 2026-09-18 the subject knowingly removed the Q3 targets spreadsheet from the office by copying `q3-targets.xlsx` to a personal Kingston USB drive (serial AA-LT-001) connected to WS-LT-018 between 14:22 and 15:08 UTC. The act was deliberate and unauthorised; the absence of EDR file-write events reflects the subject's effort to avoid detection rather than the absence of the transfer.\"",
          },
          {
            id: "calibrated",
            label:
              "\"On 2026-09-18, a Kingston USB device (serial AA-LT-001) was connected to WS-LT-018 from 14:22 to 15:08 UTC. The file `q3-targets.xlsx` was opened on the workstation at 14:30 UTC. No host-monitoring file-write events to the USB volume were captured during the connection window. The available evidence is consistent with opportunity to copy the file to the USB device; it does NOT, by itself, prove that the copy occurred or that the device is the subject's personal property.\"",
          },
          {
            id: "denial",
            label:
              "\"Review of WS-LT-018 found that a USB device was connected during business hours and the Q3 targets spreadsheet was opened during the connection window. Host-monitoring telemetry shows no file-write events to the USB volume during the period; in the absence of any captured write event, no copy of `q3-targets.xlsx` was made onto a USB device. The connection and file-open events are part of routine workstation use.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle rewrite. It names what the artifacts show (USB connect window, file opened, no EDR file-write), names what they don't show (no observed copy, no evidence of ownership), and stops at opportunity. The first imports four claims — `knowingly`, `removed`, `personal`, `Kingston` — that the evidence does not back. The third over-corrects: *no observed write* is not the same as *no write occurred*, because the EDR's coverage of the window isn't itself proven complete.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which **single word** in the original draft is the strongest overclaim?",
        options: [
          { id: "exfiltrated", label: "\"exfiltrated\"" },
          { id: "the", label: "\"the\"" },
          { id: "drive", label: "\"drive\"" },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["exfiltrated"],
          allowMultiple: false,
        },
        debriefMd:
          "**\"exfiltrated\"** is the strongest overclaim — it asserts the file was written to the USB *and* moved off the network. The evidence shows the file was *opened* while the USB was *present*; it does not show the file's bytes being written to the USB volume. \"intentionally\" and \"personal\" are also unsupported, but they ride on top of the implicit claim that an exfiltration happened at all.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the **original draft** finding is ready to send to a reviewer as written.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The draft asserts a write (\"exfiltrated\") that the artifacts don't contain, a motive (\"intentionally\") that no listed artifact supports at all, and ownership (\"personal\") that USBSTOR's vendor / serial fields cannot establish. A defensible finding writes \"opportunity to copy, no write event observed\" and names the next pull (EDR re-collection for the window, or device-imaging if the USB is recovered).",
      },
    ],
  },

  // ─── Capstone — combine the prior six scenarios on one mini-case ──
  {
    slug: "ojt-bridge-first-day-triage-001",
    title: "First-Day Triage: Combining the Pieces",
    summary:
      "A workstation flagged for possible USB-based exfil. Five small artifacts, one combined case. Match the right artifact to each sub-question and write a finding that doesn't outrun the evidence.",
    skillAreas: [
      "df_artifacts",
      "windows_artifacts",
      "removable_media",
      "inference_discipline",
    ],
    difficulty: 2,
    estimatedMinutes: 30,
    tags: [
      "ojt-bridge",
      "windows_artifacts",
      "removable_media",
      "df_artifacts",
      "inference_discipline",
      "capstone",
    ],
    lane: "ojt_bridge",
    module: "Capstone",
    sequence: 7,
    status: "draft",
    brief: `
# Brief

A workstation (\`WS-OPS-058\`) was flagged after a teammate
reported a possible USB-based exfiltration. You have five small
artifacts and a draft finding from a junior analyst:

- an AXIOM-style case summary,
- the acquisition log,
- a Prefetch listing for one binary of interest,
- a USBSTOR record,
- a browser-download row.

For each question, decide which artifact carries the answer, and
don't let one artifact's evidence get stretched onto a claim it
doesn't cover. Then pick the finding that says what the evidence
supports — no more, no less.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "case-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Case summary — parsed artifact counts",
            "-------------------------------------",
            "",
            "  Browser history records ........... 2,118",
            "  Email messages .................... 0",
            "  SMS messages ...................... 0",
            "  USB device records ................ 1",
            "  Prefetch entries .................. 142",
            "  Recycle Bin items ................. 4",
            "",
            "Parser           : AXIOM 9.x (Windows artifacts module)",
            "Image            : /evidence/2026/308/WS-OPS-058.E01",
            "Processed (UTC)  : 2026-11-04 19:42:08",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "acquisition.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Live acquisition — completion summary",
            "-------------------------------------",
            "",
            "  Source            : Internal hard drive (512 GB)",
            "  Target            : /evidence/2026/308/WS-OPS-058.E01",
            "  Image format      : EnCase E01 (compressed)",
            "  Started           : 2026-11-04 14:18:11 UTC",
            "  Finished          : 2026-11-04 16:08:55 UTC",
            "  SHA-256 (source)  : a4d2...7e0c   (computed during read)",
            "  SHA-256 (image)   : a4d2...7e0c   (verified after write)",
            "  Status            : COMPLETE — no read errors",
            "",
            "Custody (DA Form 4137 #4137-2026-308-A):",
            "  Released by    : SSG K. Owens (unit security manager)",
            "  Received by    : (signature illegible — receiving DFE",
            "                    column on the 4137 has a date and a",
            "                    badge number but no printed name)",
            "  Received date  : 2026-11-04",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "prefetch-listing.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Prefetch entries — selected rows",
            "--------------------------------",
            "",
            "  File name                 Last run UTC          Run count",
            "  ROBOCOPY.EXE-0A9F2BAD.pf  2026-11-03 21:14:08    1",
            "  EXPLORER.EXE-1F2D0001.pf  2026-11-03 22:08:42    7",
            "  NOTEPAD.EXE-5B41C0DE.pf   2026-11-03 22:11:55    3",
            "",
            "(Prefetch is enabled on this host. The robocopy entry is",
            " the one of interest — it's a Windows file-copy utility",
            " that the user's role does not require for daily work.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "usbstor-record.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "USBSTOR record — single device",
            "------------------------------",
            "",
            "  Vendor / Product   : SanDisk Cruzer Glide",
            "  Serial             : SD-CG-2208",
            "  First install date : 2026-08-22 10:18:22 UTC",
            "  Last arrival date  : 2026-11-03 20:55:08 UTC",
            "  Last removal date  : 2026-11-03 22:42:18 UTC",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 5,
        displayName: "browser-downloads.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Browser downloads — single row of interest",
            "------------------------------------------",
            "",
            "  URL              : https://internal-portal.unit.example/docs/sow-2025-118.pdf",
            "  Downloaded as    : C:\\Users\\j.cole\\Downloads\\sow-2025-118.pdf",
            "  Started (UTC)    : 2026-11-03 19:42:11",
            "  Finished (UTC)   : 2026-11-03 19:42:14",
            "  Size             : 318,442 bytes",
            "  SHA-256          : c811...0d4f",
            "",
            "(Source URL resolves to an internal SharePoint-style",
            " portal. The document is unit-internal.)",
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
        promptMd:
          "Which artifact answers \"**was a removable device connected to this workstation in the window of interest?**\"",
        options: [
          { id: "axiom", label: "The AXIOM-style case summary (`case-summary.txt`)." },
          { id: "acq", label: "The acquisition log (`acquisition.log`)." },
          { id: "pf", label: "The Prefetch listing (`prefetch-listing.txt`)." },
          { id: "usbstor", label: "The USBSTOR record (`usbstor-record.txt`)." },
          { id: "browser", label: "The browser download row (`browser-downloads.txt`)." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["usbstor"],
          allowMultiple: false,
        },
        debriefMd:
          "**USBSTOR.** That's the registry artifact that records device-was-here facts (vendor / product / serial, plus first-install and last-arrival / last-removal times). The case summary's *USB device records: 1* tells you AXIOM extracted one such record from the image — that's a parser count, not the device fact itself.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "From the Prefetch listing, what is **directly supported** about `ROBOCOPY.EXE`?",
        options: [
          {
            id: "ran-once",
            label:
              "`ROBOCOPY.EXE` was executed on this host at least once; the most recent run was 2026-11-03 21:14:08 UTC.",
          },
          {
            id: "copied-to-usb",
            label:
              "`ROBOCOPY.EXE` was used to copy files to the SanDisk USB.",
          },
          {
            id: "ran-by-cole",
            label:
              "`j.cole` ran `ROBOCOPY.EXE` (account attribution).",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["ran-once"],
          allowMultiple: false,
        },
        debriefMd:
          "**Executed on this host, last run 2026-11-03 21:14:08 UTC.** Prefetch is a host-level execution artifact — it records *this binary ran*, but doesn't carry per-user attribution and doesn't record what files (if any) the binary touched. Account attribution lives in UserAssist / 4688 / Sysmon (out of scope for this lane). The *source → destination* of a copy lives in EDR file-write events or the USN journal (also out of scope here).",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Read the acquisition log carefully. Which of the following is a **real concern** for the case, vs a thing that looks like a concern but isn't?",
        options: [
          {
            id: "hash-mismatch",
            label:
              "The source SHA-256 and image SHA-256 don't match.",
          },
          {
            id: "custody-gap",
            label:
              "The DA Form 4137 receiving-DFE field has a date and badge number but no printed name. The custody chain has an unattributed handoff.",
          },
          {
            id: "image-too-small",
            label:
              "The completion time (≈1h 50m for 512 GB) is faster than expected and the image is probably corrupted.",
          },
          {
            id: "no-prefetch-time",
            label:
              "The acquisition log doesn't list any Prefetch entries.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["custody-gap"],
          allowMultiple: false,
        },
        debriefMd:
          "**The custody gap.** The receiving-DFE entry on the 4137 has an illegible signature and no printed name — that's an articulable break in the chain and counsel will ask about it. The two hashes *do* match (look again: both are `a4d2...7e0c`). Acquisition time is reasonable for a 512 GB drive at modern read speeds. And acquisition logs don't list Prefetch entries — those live in the analysis side, not the collection side.",
      },
      {
        ordinal: 4,
        type: "text_match",
        weight: 1,
        promptMd:
          "Quote the **serial number** of the device in the USBSTOR record, exactly as printed.",
        textMatch: {
          acceptableAnswers: ["SD-CG-2208"],
          hint: "Look at the `Serial :` line in `usbstor-record.txt`.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["SD-CG-2208"],
          regex: false,
        },
        debriefMd:
          "`SD-CG-2208`. Specific serial numbers belong in a writeup whenever they're available — *a SanDisk USB* is weaker than *SanDisk Cruzer Glide, serial SD-CG-2208*, and the latter is what a reviewer (or counsel) needs to disambiguate this device from any other.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Cross-check the timestamps. Which sentence is **supportable** from the five artifacts together?",
        options: [
          {
            id: "downloaded-then-usb",
            label:
              "`sow-2025-118.pdf` was downloaded from an internal portal at 19:42 UTC; a removable device (SanDisk, serial `SD-CG-2208`) was connected from 20:55 to 22:42 UTC the same evening; and `robocopy.exe` ran at 21:14 UTC during the connection window.",
          },
          {
            id: "downloaded-and-copied",
            label:
              "`sow-2025-118.pdf` was downloaded from an internal portal and then copied to the SanDisk USB.",
          },
          {
            id: "exfil-occurred",
            label:
              "An exfiltration event occurred on 2026-11-03.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["downloaded-then-usb"],
          allowMultiple: false,
        },
        debriefMd:
          "The first sentence reads each artifact at face value and stops. The second imports a `was copied to the USB` claim that no artifact in this set supports — Prefetch shows robocopy ran, not what it copied, and there is no file-write telemetry in this artifact set. The third compresses everything into a verdict (`exfiltration`) that the evidence motivates as a next step but does not establish. The first sentence is what belongs in the writeup; the third is what belongs in the next-steps section.",
      },
      {
        ordinal: 6,
        type: "multi_choice",
        weight: 2,
        promptMd: [
          "Which rewrite of the junior analyst's draft would you actually send to a reviewer?",
          "",
          "Junior analyst's draft:",
          "",
          "> *On 2026-11-03, j.cole downloaded internal SOW documentation and copied it to a personal SanDisk USB drive using robocopy.*",
        ].join("\n"),
        options: [
          {
            id: "overclaim",
            label:
              "*On 2026-11-03 the account j.cole downloaded SOW-2025-118 from the unit internal portal at 19:42 UTC and then exfiltrated the document to a personal SanDisk Cruzer Glide USB (serial SD-CG-2208) using robocopy.exe at 21:14 UTC. The device was attached to WS-OPS-058 from 20:55 to 22:42 UTC; the connection window cleanly covers the download, the robocopy execution, and the file transfer to the device. The deliberate use of robocopy (rather than a standard copy / paste) is consistent with an intent to move large amounts of data while evading the user-shell logging that explorer.exe would generate. Recommend criminal referral and asset hold on the SanDisk device.*",
          },
          {
            id: "calibrated",
            label:
              "*On 2026-11-03 the account `j.cole` downloaded `sow-2025-118.pdf` from an internal unit portal at 19:42 UTC. A removable device (SanDisk Cruzer Glide, serial SD-CG-2208) was connected to WS-OPS-058 from 20:55 UTC to 22:42 UTC the same evening. Prefetch shows `ROBOCOPY.EXE` ran on the host at 21:14 UTC during that window. The artifacts do not record file-write events to the USB volume, so no row in the current evidence set proves the document was written to the device; that question is open pending file-system / USN-journal review of the image. The receiving-DFE entry on DA Form 4137 #4137-2026-308-A is missing a printed name and should be corrected before the case folder is closed.*",
          },
          {
            id: "underclaim",
            label:
              "*Review of WS-OPS-058 found that on 2026-11-03 the account j.cole pulled `sow-2025-118.pdf` from the unit internal portal during business operations, that a SanDisk Cruzer Glide USB was connected to the workstation between 20:55 and 22:42 UTC, and that Prefetch records show ROBOCOPY.EXE ran on the host at 21:14 UTC. No EDR file-write events to the USB volume were captured in the available evidence set. Because no write event was observed, no exfiltration occurred. The case can be closed; the user accessed an unclassified internal document during normal hours and connected a personal USB device, none of which is itself a finding.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle one is the rewrite to send. It names each event at the resolution the evidence supports, flags the 4137's custody gap (which the other two ignore), and leaves the file-write question explicitly open rather than answering it in either direction. The first imports `exfiltrated` and `personal` — neither is in the artifact set. The third treats *no observed writes* as *no writes occurred*; without removable-media file-write telemetry, that's *open, pending review*, not *no*.",
      },
    ],
  },
];
