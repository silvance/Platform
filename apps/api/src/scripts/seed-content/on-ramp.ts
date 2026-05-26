import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Analyst On-Ramp family. The lowest-difficulty lane in the
// catalogue — for students whose baseline is closer to A+ /
// DC3-Intro than analytic forensic experience. Each scenario:
//
//   - has ONE artifact
//   - has 3-4 questions, mostly single-pick MC
//   - uses plain language first, technical term second
//   - never references regulations or vendor-specific UIs
//   - teaches the five-question frame:
//       * What do I see?
//       * What does it prove?
//       * What does it NOT prove?
//       * What would I need next?
//       * How do I say it without overclaiming?
//
// These are deliberately not trivia. They build the inference-
// discipline reflex that Foundations + every later lane assumes
// the student already trusts.

export const ANALYST_ON_RAMP_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. Reading a Windows file path ─────────────────────────
  {
    slug: "on-ramp-windows-path-001",
    title: "Reading a Windows File Path",
    summary:
      "A file path on a Windows machine. Read it carefully and decide what it does — and doesn't — tell you.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 5,
    tags: ["on-ramp", "windows", "paths", "inference_discipline"],
    lane: "analyst_on_ramp",
    module: "Reading the basics",
    sequence: 1,
    brief: `
# Brief

Before you can analyze anything, you have to read what's in front
of you. On a Windows computer, a *file path* is the string that
tells you where a file lives on disk — which drive, which folder,
which sub-folder, and finally the file's name.

A typical Windows path looks like this:

\`\`\`
C:\\Users\\j.smith\\Documents\\quarterly-report.docx
\`\`\`

Read left to right:

1. **\`C:\`** — the drive (the storage volume).
2. **\`\\Users\\j.smith\\\`** — the user-profile folder for the
   account named \`j.smith\`.
3. **\`Documents\\\`** — a folder inside that profile.
4. **\`quarterly-report.docx\`** — the file itself.

That's everything the path tells you. The discipline of this
challenge is to notice what the path does *not* tell you.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "the-path.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "C:\\Users\\j.smith\\Documents\\quarterly-report.docx",
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
        promptMd: "Which **drive letter** is this file stored on?",
        options: [
          { id: "c", label: "C:" },
          { id: "d", label: "D:" },
          { id: "users", label: "Users:" },
          { id: "docs", label: "Documents:" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["c"], allowMultiple: false },
        debriefMd:
          "**`C:`**. The drive letter is always the first piece of a Windows path, ending in a colon. `Users`, `Documents`, and `quarterly-report.docx` are folders and a file *inside* that drive — they're not drives themselves.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Whose **user-profile folder** does this file live inside?",
        options: [
          { id: "jsmith", label: "j.smith" },
          { id: "admin", label: "Administrator" },
          { id: "system", label: "SYSTEM" },
          { id: "documents", label: "Documents" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["jsmith"], allowMultiple: false },
        debriefMd:
          "**`j.smith`**. On Windows, every user account has a folder under `C:\\Users\\` named for the account. This file lives inside `j.smith`'s profile — under `Documents`, which is a folder *inside* the profile.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does the path on its own prove that **j.smith CREATED** this file?",
        options: [
          {
            id: "yes-created",
            label: "Yes. The file is in j.smith's profile folder, so j.smith created it.",
          },
          {
            id: "yes-owns",
            label: "Yes. The user profile is the same thing as the file's owner.",
          },
          {
            id: "no-just-location",
            label:
              "No. The path only tells you where the file lives now. Who created it is recorded in the file's metadata, not in the path.",
          },
          {
            id: "no-needs-extension",
            label:
              "No, because the path doesn't include a file size.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-just-location"],
          allowMultiple: false,
        },
        debriefMd:
          "**No — the path only tells you where the file lives now.** Anyone with permission could have placed a file in `j.smith`'s `Documents` folder; another user, the operating system, or a piece of software could have written it. The *creator* (and the file's owner, last-write user, etc.) lives in the filesystem metadata, not in the path itself.\n\nThis is the most important habit in this whole lane: separate \"what does the artifact show?\" (the path: a location) from \"what would I have to conclude?\" (creator: requires different evidence).",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that j.smith created this file, **from the path alone**.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The path is a *location* fact, not an *authorship* fact. A defensible writeup names what the path proves (\"the file resides under `j.smith`'s profile\") and stops there until other evidence (filesystem owner field, MFT records, application-level audit log) lines up the creator.",
      },
    ],
  },

  // ─── 2. Timestamps and event order ──────────────────────────
  {
    slug: "on-ramp-timestamps-001",
    title: "Reading Timestamps in Order",
    summary:
      "Four events with timestamps. Put them in order and decide what the sequence proves.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 6,
    tags: ["on-ramp", "timestamps", "inference_discipline"],
    lane: "analyst_on_ramp",
    module: "Reading the basics",
    sequence: 2,
    brief: `
# Brief

Forensic work is mostly *putting things in order in time*. The
events themselves are rarely surprising — the surprise is what
the order tells you (or fails to tell you).

This challenge gives you four timestamped lines from a single
workstation. The timestamps are in **ISO-8601 / UTC** format —
the most common machine-readable shape:

\`\`\`
2026-04-12T08:14:00Z
^^^^^^^^^^ ^^^^^^^^ ^
   date     time   "Z" = UTC, no offset
\`\`\`

Two minutes is two minutes regardless of where the analyst is
sitting; UTC removes the time-zone math from the puzzle.

Read the four lines. Put them in order. Then decide what the
order proves and what it doesn't.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "events.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "2026-04-12T08:14:30Z  file modified",
            "2026-04-12T08:14:00Z  file opened",
            "2026-04-12T08:15:00Z  USB device disconnected",
            "2026-04-12T08:14:35Z  file saved and closed",
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
        promptMd: "Which event happened **first**?",
        options: [
          { id: "opened", label: "file opened" },
          { id: "modified", label: "file modified" },
          { id: "saved", label: "file saved and closed" },
          { id: "usb", label: "USB device disconnected" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["opened"], allowMultiple: false },
        debriefMd:
          "**file opened**, at 08:14:00. The artifact is shuffled — the discipline is to sort by the timestamp, not the line order. The earliest UTC timestamp wins.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd: "Which event happened **last**?",
        options: [
          { id: "opened", label: "file opened" },
          { id: "modified", label: "file modified" },
          { id: "saved", label: "file saved and closed" },
          { id: "usb", label: "USB device disconnected" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["usb"], allowMultiple: false },
        debriefMd:
          "**USB device disconnected**, at 08:15:00. The four events together describe a tiny one-minute story: open the file, modify it, save and close it, then yank the USB out.",
      },
      {
        ordinal: 3,
        type: "text_match",
        weight: 1,
        promptMd:
          "How many **seconds** elapsed between \"file modified\" and \"file saved and closed\"? **(Just the number.)**",
        textMatch: {
          acceptableAnswers: ["5", "5 seconds", "five"],
          hint: "Subtract `08:14:30` from `08:14:35` — both events are in the same minute.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["5", "5 seconds", "five"],
          regex: false,
        },
        debriefMd:
          "**5 seconds.** `08:14:35` minus `08:14:30`. The two events sit in the same minute; subtracting the seconds field is enough.",
      },
      {
        ordinal: 4,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "What does this **order of events** prove about **who** did the work?",
        options: [
          {
            id: "proves-user",
            label:
              "It proves the user at the keyboard performed each action in sequence.",
          },
          {
            id: "proves-nothing-about-who",
            label:
              "It proves the order in which the events were recorded by the system. It does not, by itself, prove who initiated them — that requires evidence about the account or process responsible.",
          },
          {
            id: "proves-suspect",
            label:
              "It proves the same person performed all four events because they happened on one workstation.",
          },
          {
            id: "proves-automation",
            label:
              "It proves the events were caused by an automated script because they're seconds apart.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["proves-nothing-about-who"],
          allowMultiple: false,
        },
        debriefMd:
          "**The order of events proves the order of events.** It does not, by itself, identify the actor. Events on a workstation can be caused by the console user, by a background process running under a different account, by a scheduled task, by a remotely-mounted session, or by a piece of malware. Putting events in order is the first step; *naming the actor* requires evidence about the account or process responsible — which lives in different artifacts.",
      },
    ],
  },

  // ─── 3. What a hash match proves ────────────────────────────
  {
    slug: "on-ramp-hash-match-001",
    title: "What a Hash Match Proves",
    summary:
      "A vendor posted a hash; your local hash matches. Decide what that match really tells you.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 6,
    tags: ["on-ramp", "hashes", "inference_discipline"],
    lane: "analyst_on_ramp",
    module: "What evidence proves",
    sequence: 1,
    brief: `
# Brief

A *hash* (also called a *checksum* or *digital fingerprint*) is
a short string that summarizes a file's bytes. The same bytes
always produce the same hash; different bytes — even by a single
bit — produce a very different hash.

Hashes are the cheapest tampering-check we have: publish the
hash of a file, ask anyone who downloads it to compute the same
hash on their copy, and compare. If the strings are identical,
the bytes are identical (with overwhelming probability).

Here's a tiny note describing such a check. Read it, then
decide what the match does and doesn't tell you.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "the-check.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "We downloaded a software installer from the vendor's website.",
            "",
            "The vendor published a SHA-256 hash for the installer on the",
            "same website:",
            "",
            "  6f1b8a3c2e4d5f6071829304a5b6c7d8e9f0112233445566778899aabbccddeeff",
            "",
            "We computed the SHA-256 hash of the local copy we just",
            "downloaded:",
            "",
            "  6f1b8a3c2e4d5f6071829304a5b6c7d8e9f0112233445566778899aabbccddeeff",
            "",
            "The two strings are identical, byte for byte.",
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
          "What does the matching hash **prove**?",
        options: [
          {
            id: "bytes-match",
            label:
              "The bytes you have are the same bytes the vendor hashed.",
          },
          {
            id: "safe-to-run",
            label:
              "The file is safe to run — a matching hash means no malware.",
          },
          {
            id: "verifies-vendor",
            label:
              "The vendor's identity is verified — the match proves who wrote the software.",
          },
          {
            id: "proves-version",
            label:
              "The file is the very latest version available.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["bytes-match"],
          allowMultiple: false,
        },
        debriefMd:
          "**The bytes match.** A hash is a fingerprint of the bytes — same fingerprint, same bytes. Anything *about* those bytes (safety, origin, version) is a separate question that needs different evidence.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does the matching hash prove the file is **safe to run**?",
        options: [
          {
            id: "no-malicious-can-still-hash",
            label:
              "No. A malicious file still has a hash. \"Bytes match\" is a tampering check, not a safety check.",
          },
          {
            id: "yes-vendor-trusted",
            label:
              "Yes. The vendor wouldn't publish the hash if the file weren't safe.",
          },
          {
            id: "yes-sha256-is-strong",
            label:
              "Yes. SHA-256 is a strong cryptographic hash, so anything it confirms is safe.",
          },
          {
            id: "depends-on-extension",
            label:
              "Only if the file has a `.exe` extension — other extensions are always safe.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-malicious-can-still-hash"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** A hash tells you whether the bytes you have are the bytes the publisher hashed. If the publisher's file was malware, the matching hash just confirms that you have *the malware they published.* Safety needs a separate check — antivirus / EDR / sandbox detonation / signature verification.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Does the matching hash prove **who** created the file?",
        options: [
          {
            id: "no-no-identity",
            label:
              "No. A hash is just a fingerprint of the bytes; it doesn't carry any identity. A digital signature would — a bare hash doesn't.",
          },
          {
            id: "yes-vendor-published",
            label:
              "Yes — the vendor published the hash, so they must be the author.",
          },
          {
            id: "yes-cryptographic",
            label:
              "Yes — SHA-256 is cryptographic, so the match proves origin.",
          },
          {
            id: "yes-only-author",
            label:
              "Yes — only the file's author can compute its hash.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-no-identity"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** Anyone who has the file can compute its hash; computing a hash is not a privileged operation. To prove *who* created the file you need something that ties the file to an identity — most commonly a **digital signature**, which uses a private key only the author has.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this installer is **safe to run**, on the strength of the hash match alone.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "**1, 2, or 3 at most.** The hash gives you confidence in *the bytes you have match what the vendor published*. It does not give you confidence in *what those bytes do*. A defensible writeup says \"hash verified — bytes match the published reference; safety is a separate check\" and stops there.",
      },
    ],
  },

  // ─── 4. Tool output vs examiner conclusion ──────────────────
  {
    slug: "on-ramp-tool-vs-conclusion-001",
    title: "What the Tool Says vs What You Conclude",
    summary:
      "A short report from a forensic tool. Decide what the tool actually proved — and what would be your overclaim.",
    skillAreas: ["df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 7,
    tags: ["on-ramp", "tool_output", "report_writing", "inference_discipline"],
    lane: "analyst_on_ramp",
    module: "What evidence proves",
    sequence: 2,
    brief: `
# Brief

A forensic tool is just a fast reader. It tells you what's on the
disk, in the log, in the email — *what it sees right now*. It
doesn't tell you who, why, or when something was created unless
those facts are themselves recorded somewhere it can read.

The hardest habit to build is keeping two things separate:

- **Tool output.** What the tool reported. A directly observable
  fact about the current state of an artifact.
- **Examiner conclusion.** What you, the analyst, decide
  *because of* that fact. This is judgment — and it has to be
  earned by evidence, not assumed.

Below is a short report. The "Tool reports" section is the tool
output. Your job is to decide which conclusions are supported
and which are over-claims.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "tool-report.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Tool: a generic disk-image browser",
            "Source: a USB device handed in for analysis",
            "",
            "Tool reports:",
            "  - The device's file listing contains 4 files with the",
            "    extension \".docx\".",
            "  - One of the .docx files is named \"Q3-budget.docx\".",
            "  - The tool found no earlier copies or older versions of",
            "    Q3-budget.docx on this device (no deleted-file traces,",
            "    no copies in the file-system journal).",
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
          "Which statement is **directly supported** by the tool report?",
        options: [
          {
            id: "four-docx-files",
            label:
              "There are four .docx files on the device, one of which is named \"Q3-budget.docx\".",
          },
          {
            id: "user-created",
            label:
              "The user created Q3-budget.docx on this device.",
          },
          {
            id: "first-time-on-device",
            label:
              "Q3-budget.docx has never been on this device before today.",
          },
          {
            id: "device-was-empty",
            label:
              "The device was empty before Q3-budget.docx was added.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["four-docx-files"],
          allowMultiple: false,
        },
        debriefMd:
          "**Four .docx files including Q3-budget.docx.** That's exactly what the tool said it saw. The other three options leap from *what the tool found* to *what the user did*. Notice the pattern — that leap is where new analysts most often over-claim.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does the tool report prove that **the user created** Q3-budget.docx on this device?",
        options: [
          {
            id: "no-tool-only-sees-file",
            label:
              "No. The tool sees the file's current presence; it doesn't see who wrote it. \"Created\" needs evidence about an account or a process, which lives in different artifacts (filesystem owner, application logs, EDR file-write events).",
          },
          {
            id: "yes-only-one-copy",
            label:
              "Yes. The tool found no older versions, so it must have been created here.",
          },
          {
            id: "yes-on-device",
            label:
              "Yes. The file is on the device, so the device's owner created it.",
          },
          {
            id: "yes-docx-implies-author",
            label:
              "Yes. \".docx\" files always carry an Author field, so the user who saved it created it.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-tool-only-sees-file"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** The tool sees the file's current presence. \"Created\" is a different question. A user could have copied the file from somewhere else, an automated process could have written it, someone else could have placed it on the device — all consistent with the tool's report. The Author field inside a `.docx` is editable text, not an audit trail.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does \"no earlier copies on this device\" prove the file **was never previously on the device**?",
        options: [
          {
            id: "no-no-earlier-trace-isnt-no-earlier-presence",
            label:
              "No. The tool only sees what's still there in some recoverable form. A file that was once on the device but was thoroughly removed (overwritten, secure-deleted, or the device fully re-formatted) would leave no trace for the tool to surface.",
          },
          {
            id: "yes-tool-found-nothing",
            label:
              "Yes. The tool found nothing earlier, so nothing earlier existed.",
          },
          {
            id: "yes-journal-is-complete",
            label:
              "Yes. The file-system journal records everything that ever happened on the device.",
          },
          {
            id: "depends-on-tool",
            label:
              "Only if the tool was running while the file was being written.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-no-earlier-trace-isnt-no-earlier-presence"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** \"The tool didn't find earlier traces\" is not the same as \"earlier traces never existed.\" The right writeup is *\"no earlier copies were observed in the available artifacts.\"* Absence-of-evidence is not evidence-of-absence — a fundamental forensic habit. Whether you can rule out earlier presence depends on what *would* have been recorded and whether you have it.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the writeup *\"The user created Q3-budget.docx on this device\"* is ready to send, **based on the tool report alone**.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The tool report supports *\"Q3-budget.docx is present on the device.\"* Anything stronger — *who* created it, *whether* it's the only version, *when* it arrived — needs evidence the tool report does not carry. A defensible writeup names exactly what's observed and stops.",
      },
    ],
  },

  // ─── 5. Rewriting an overconfident finding ──────────────────
  {
    slug: "on-ramp-rewrite-finding-001",
    title: "Rewriting an Overconfident Finding",
    summary:
      "A short draft finding overclaims. Pick the rewrite that says only what the evidence supports.",
    skillAreas: ["report_writing", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 7,
    tags: ["on-ramp", "report_writing", "inference_discipline"],
    lane: "analyst_on_ramp",
    module: "Saying what's proven",
    sequence: 1,
    brief: `
# Brief

The last habit this lane teaches is the simplest and the hardest:
**write only what the evidence supports**. New analysts often
write a finding that sounds like a courtroom verdict —
*"The suspect copied the file"* — when the evidence supports
only a story-fragment.

Here's a real-shaped draft and the evidence it was built from.
Your job is to keep the sentence honest.

## Evidence available

> - A USB device was connected to the workstation at 14:08.
> - A file named \`finance.xlsx\` was opened by the user at 14:09.
> - The USB device was disconnected at 14:11.
> - **No file-write events** to the USB volume were captured by
>   the host's monitoring agent during the connection window.

## Draft finding (overclaims)

> *"The suspect copied the financial spreadsheet onto a USB device
> to take it out of the office."*

That sentence contains four separate claims — *copied*, *the
financial spreadsheet*, *onto the USB*, *to take it out of the
office*. The evidence above does not support all four. Read the
evidence carefully and pick the rewrite that's honest.
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
            "  - USB connected at 14:08",
            "  - finance.xlsx opened by the user at 14:09",
            "  - USB disconnected at 14:11",
            "  - NO file-write events to the USB volume captured",
            "    during the connection window",
            "",
            "Draft finding (overclaims)",
            "--------------------------",
            "  \"The suspect copied the financial spreadsheet onto a",
            "   USB device to take it out of the office.\"",
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
              "\"The suspect copied the financial spreadsheet onto a USB device to remove it from the office.\"",
          },
          {
            id: "calibrated",
            label:
              "\"Between 14:08 and 14:11 a USB device was connected to the workstation. During that window the file `finance.xlsx` was opened by the user. No file-write events to the USB volume were recorded. The available evidence shows the USB was present while the file was open; it does NOT, by itself, show that the file was written to the USB.\"",
          },
          {
            id: "denial",
            label:
              "\"No copy of the financial spreadsheet was made onto the USB device.\"",
          },
          {
            id: "evasive",
            label:
              "\"Something happened with a USB device and a spreadsheet around 14:08–14:11.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "**The calibrated rewrite.** It names what the artifacts show (timestamps, the open event, the USB-connect window), what they don't show (no write events captured), and stops at *opportunity*. It doesn't pretend the absence of write events proves no copy occurred (the monitoring agent might not have captured it, or the user might have used a different path), but it doesn't pretend the presence of the USB during a file open proves a copy either. \"Consistent with opportunity, not proven\" is the honest call.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which **single word** in the draft is the strongest overclaim?",
        options: [
          { id: "copied", label: "\"copied\"" },
          { id: "the", label: "\"the\"" },
          { id: "office", label: "\"office\"" },
          { id: "device", label: "\"device\"" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["copied"], allowMultiple: false },
        debriefMd:
          "**\"copied\"**. The available evidence shows the file was *opened* while the USB was *present*. It does not show the file was *written* to the USB. \"Copied\" asserts the write event the evidence does not contain.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What **single additional piece of evidence** would most directly upgrade the finding from \"consistent with\" to \"proven\"?",
        options: [
          {
            id: "edr-file-write",
            label:
              "An EDR / host-monitoring file-write event showing `finance.xlsx` (or its bytes) being written to the USB volume during the connection window.",
          },
          {
            id: "more-usb-history",
            label:
              "More history showing the same USB device has been connected to the workstation before.",
          },
          {
            id: "more-file-opens",
            label:
              "More records of the user opening `finance.xlsx` on other days.",
          },
          {
            id: "interview-with-suspect",
            label:
              "An interview with the user about what they were working on.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["edr-file-write"],
          allowMultiple: false,
        },
        debriefMd:
          "**An EDR / host-monitoring file-write event to the USB volume.** That directly converts \"the file was open and the USB was present\" into \"the file's bytes were written to the USB.\" The other options have value for the investigation but don't bridge the *opportunity → action* gap. An interview is useful — but \"the user said they did it\" is a confession, not forensic proof.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the **original draft** finding is ready to send to a reviewer as written.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The draft asserts a write (\"copied\") that the evidence does not contain, and a motive (\"to take it out of the office\") that no piece of evidence supports at all. A finding written that way doesn't survive the first competent challenge from a reviewer — let alone from opposing counsel.",
      },
    ],
  },
];
