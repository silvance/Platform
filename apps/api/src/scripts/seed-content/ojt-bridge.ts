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

That record captures *the device showed up*: vendor / product /
serial, the time it was first installed, and when it was last
connected. It does **not** capture what — if anything — happened
between the connection and the disconnection.

> **Heads-up on terminology in the options.** Q2 mentions
> **EDR** and **Sysmon** — both are *host-side* sources that
> observe what happens on a workstation. EDR (Endpoint Detection
> and Response) is the enterprise security agent class
> (CrowdStrike Falcon, Microsoft Defender for Endpoint, etc.);
> Sysmon is Microsoft's free System Monitor service that emits
> structured process / network / file events to the Event Log.
> Both can record per-file writes — including writes to a USB
> volume.
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
              "\"The subject knowingly removed Q3 targets from the office on a personal Kingston USB drive.\"",
          },
          {
            id: "calibrated",
            label:
              "\"On 2026-09-18, a Kingston USB device (serial AA-LT-001) was connected to WS-LT-018 from 14:22 to 15:08 UTC. The file `q3-targets.xlsx` was opened on the workstation at 14:30 UTC. No host-monitoring file-write events to the USB volume were captured during the connection window. The available evidence is consistent with opportunity to copy the file to the USB device; it does NOT, by itself, prove that the copy occurred or that the device is the subject's personal property.\"",
          },
          {
            id: "denial",
            label:
              "\"No copy of Q3 targets was made onto a USB device.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "**The calibrated rewrite.** It names what the artifacts show (USB connect window; file opened; no EDR file-write), names what they don't show (no observed copy; no evidence of ownership), and stops at *opportunity*. The assertive rewrite imports four claims (`knowingly`, `removed`, `personal`, `Kingston`) that the evidence does not back. The denial rewrite over-corrects in the opposite direction — \"no observed write\" is not the same as \"no write occurred,\" since the EDR's coverage of the window isn't itself proven complete.",
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
];
