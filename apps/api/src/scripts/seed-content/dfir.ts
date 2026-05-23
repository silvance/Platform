import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Digital forensics + Windows artifacts. Each challenge teaches
// a specific artifact's limits: what its presence proves, what its
// absence doesn't, and how easily an inference can be over-claimed.

export const DFIR_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished, published) ────────────────────────────
  {
    slug: "usb-carved-classified-doc-001",
    title: "USB Media: Carved Classified Document",
    summary:
      "A USB stick handed in for analysis. A document with classified markings was carved from unallocated space. What can we prove about who put it there?",
    skillAreas: ["df_artifacts", "removable_media", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 40,
    tags: ["dfir", "usb_media", "classified_spillage", "df_artifacts", "removable_media", "report_writing", "inference_discipline"],
    brief: `
# Brief

A USB mass-storage device was handed to your office by the property
custodian after it was found in a shared workspace. Forensic imaging
yielded the artifacts in this scenario. A carving pass recovered
one DOCX-like document from **unallocated space** bearing
\`(U//FOUO)\` marker text in the body. (All markings and content
in this exercise are fictional and sanitized.)

The deputy SAC has asked for a one-paragraph finding **today**.
Your task is to make sure the language you give them is defensible.

## Artifacts

- **carving-tool-output.txt** — output from the carving tool: which
  sector the document started at, the filename it had embedded in
  metadata, recovered size.
- **document-excerpt.txt** — the readable header + first few
  paragraphs of the carved document. The marking and a few
  sentences are all that's needed for the inference exercise.
- **usb-device-metadata.json** — VID/PID/serial of the device,
  filesystem type, allocation summary, last-mount times observed
  on workstations that have it in their USB registry.
- **workstation-mount-history.csv** — sanitized excerpt of the
  registry-derived mount history for any workstations that have
  seen this VID/PID/serial recently.

## Reasoning discipline

This is the canonical "carving ≠ attribution" exercise. Carving
recovers **bytes from unallocated space**; it tells you the document
existed on this device. It does **not** prove:

- *Who* wrote the document there.
- *When* the deletion happened.
- *Why* it was deleted.

Your write-up has to separate the wire-level / on-disk facts from
the attribution inferences.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "carving-tool-output.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Carving pass — output (excerpt)",
            "-------------------------------",
            "",
            "Source image:    usb-001.dd  (8 GiB)",
            "Filesystem:      exFAT, no recoverable journal",
            "Allocation:      72% allocated, 28% unallocated, no free-space wipe pattern detected",
            "Carving target:  DOCX (PK\\x03\\x04 + word/document.xml signature)",
            "",
            "Recovered objects:",
            "  +-----------+-----------------+----------+----------------+",
            "  | offset    | recovered name  | size     | notes          |",
            "  +-----------+-----------------+----------+----------------+",
            "  | 0x1A480000| draft-notes.docx| 132 KiB  | structure intact|",
            "  | 0x4F310000| (no name)       | 207 KiB  | from unalloc   |",
            "  +-----------+-----------------+----------+----------------+",
            "",
            "Detail — 0x4F310000:",
            "  Source:          unallocated space",
            "  Internal title:  \"Q3-OPS-SUMMARY-DRAFT\"  (metadata embedded in DOCX core.xml)",
            "  Author field:    \"S.LOPEZ\"             (metadata embedded in DOCX core.xml)",
            "  Last-saved time: 2026-08-14T11:17:00Z   (metadata; NOT verified by external clock)",
            "  First-page text: see document-excerpt.txt",
            "",
            "Notes:",
            "  - The recovered object is from UNALLOCATED space. The filesystem",
            "    has no record of it as a current file.",
            "  - DOCX core.xml fields are author-controllable metadata. They are",
            "    not authenticated.",
            "  - The carve recovers BYTES, not the filesystem context that would",
            "    tell us what user account wrote them.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "document-excerpt.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Document excerpt — carved from unallocated space",
            "-----------------------------------------------",
            "",
            "(U//FOUO)  Q3 OPERATIONS SUMMARY — DRAFT",
            "",
            "(U) This document summarizes the unit's Q3 operational tempo and",
            "highlights two interagency engagements that may shift in Q4. All",
            "names, places, and figures below are fictional and sanitized.",
            "",
            "(U) Section 1 — Tempo:",
            "  Unit conducted 14 routine engagements, 2 atypical engagements.",
            "  Cross-functional coordination with two partner offices proceeded",
            "  on schedule.",
            "",
            "(U) [...content elided...]",
            "",
            "(U//FOUO)  Distribution restricted to those with operational need-",
            "to-know. Do not forward outside the originating element.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "usb-device-metadata.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "All identifiers are fictional / sanitized.",
              vendor_id: "0x0951",
              product_id: "0x1666",
              serial_number_observed: "AA-EXAMPLE-001",
              filesystem: "exFAT",
              capacity_gib: 8,
              encryption_state: "none (no BitLocker To Go header observed)",
              allocation_summary: {
                allocated_pct: 72,
                unallocated_pct: 28,
                free_space_wipe_detected: false,
              },
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "workstation-mount-history.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "workstation,user_at_console,first_mount_observed,last_mount_observed,mount_count",
            "WS-441,M.GREENE,2026-08-12T08:14:00Z,2026-08-14T11:30:00Z,4",
            "WS-622,S.LOPEZ,2026-08-13T09:45:00Z,2026-08-14T10:50:00Z,3",
            "WS-104,(shared kiosk),2026-08-16T13:01:00Z,2026-08-16T13:04:00Z,1",
          ].join("\n") + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "usb-carved-indicators",
        displayName: "Indicators bearing on attribution",
        items: [
          { id: "marking-present", label: "Document body contains `(U//FOUO)` markings", evidenceRef: "document-excerpt.txt" },
          { id: "author-field-S-LOPEZ", label: "DOCX core.xml `Author` field reads `S.LOPEZ`", evidenceRef: "carving-tool-output.txt" },
          { id: "carved-from-unalloc", label: "Recovered from unallocated space (no current filesystem entry)", evidenceRef: "carving-tool-output.txt" },
          { id: "mount-history-multiple", label: "Workstation mount history shows multiple users mounted this device", evidenceRef: "workstation-mount-history.csv" },
          { id: "no-free-space-wipe", label: "No free-space wipe pattern detected", evidenceRef: "carving-tool-output.txt" },
          { id: "title-on-doc", label: "Internal title is `Q3-OPS-SUMMARY-DRAFT`", evidenceRef: "carving-tool-output.txt" },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "From the carving output and the mount history, which of the following can you state as **fact** in the deputy SAC's writeup?",
        options: [
          { id: "doc-was-on-device", label: "A document bearing `(U//FOUO)` markers was, at some point, written to this device." },
          { id: "doc-was-deleted-deliberately", label: "Someone deliberately deleted the document to conceal it." },
          { id: "device-mounted-multiple-ws", label: "This device was mounted on at least three workstations in mid-August." },
          { id: "s-lopez-wrote-it", label: "S. LOPEZ wrote the document on this device." },
          { id: "no-free-space-wipe-fact", label: "The free space on the device does not show a wipe pattern." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["doc-was-on-device", "device-mounted-multiple-ws", "no-free-space-wipe-fact"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The document bytes are recoverable from this device — it was there at some point. That's a measurement.",
          "- The mount history (from sanitized registry-derived data) records three distinct workstations.",
          "- The absence of a free-space wipe pattern is observable on the image.",
          "",
          "**Not fact (inference, attribution, or unsupported by the artifacts):**",
          "",
          "- *Deliberate concealment* requires showing intent — deletion alone is consistent with everything from \"finished editing, dragged to trash, emptied\" to \"deliberate destruction.\" The artifacts can't distinguish.",
          "- *S. LOPEZ wrote it* over-relies on the DOCX core.xml `Author` field, which is metadata an author (or anyone with the file open in Word) can edit. It's a *lead*, not proof. The mount history shows LOPEZ mounted the device but doesn't establish authorship.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "usb-carved-indicators",
        promptMd:
          "From the indicator set, pick the ones that are **investigative leads** (worth pursuing but not yet proof) for an attribution claim against S. LOPEZ.",
        expected: {
          type: "select_indicators",
          correctIds: [
            "author-field-S-LOPEZ",
            "title-on-doc",
            "mount-history-multiple",
          ],
        },
        debriefMd: [
          "**Leads:**",
          "",
          "- DOCX `Author` field reading `S.LOPEZ` — the field is author-controllable, but it's a starting point to interview LOPEZ and to subpoena their workstation's authoring history.",
          "- Title `Q3-OPS-SUMMARY-DRAFT` — points at a specific document that other systems (SharePoint history, mail attachments, workstation Recent Documents) can be queried for.",
          "- Mount history including LOPEZ — places LOPEZ's account in proximity to the device during the relevant window. Proximity, not proof.",
          "",
          "**Not leads (independently of attribution):**",
          "",
          "- The `(U//FOUO)` markings establish the *nature* of the document, not who put it there.",
          "- The absence of a free-space wipe establishes the *state of the device*, not authorship.",
          "- The fact that the doc was carved from unallocated space is part of why the question is *attribution-uncertain* in the first place.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "text_match",
        weight: 1,
        promptMd:
          "Name the **single phrase** that most precisely describes what carving from unallocated space proves about *who* wrote the document. (Short noun phrase.)",
        textMatch: {
          acceptableAnswers: ["nothing", "nothing about authorship", "not a thing", "no attribution"],
          hint: "Carving recovers bytes, not user context.",
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["nothing", "nothing about authorship", "not a thing", "no attribution"],
          regex: false,
        },
        debriefMd:
          "**Nothing.** Carving recovers byte content from sectors the filesystem no longer claims; it does not recover the filesystem context (user account, ACLs, write-time process) that would establish authorship. Authorship requires evidence from sources where the document was authored or used — workstation MFT records, SharePoint version history, recent-documents shell extensions, email attachment chains. A carved DOCX is a *starting point* for those inquiries, not the answer to them.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the deputy SAC should treat \"S. LOPEZ deliberately copied a classified-marked document to a USB\" as the **finding**.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The artifacts establish (a) the document existed on the device, (b) LOPEZ's account mounted the device, and (c) the document's metadata names LOPEZ as author. None of those — separately or together — establishes that LOPEZ knowingly copied a marked document for an unauthorized purpose. The right writeup names what's proven, names what's a lead, and recommends the *next* evidentiary steps (interview, workstation forensics, SharePoint history). A finding stated at high confidence on this evidence is exactly the kind of testimony that gets demolished on cross-examination.",
      },
    ],
  },

  {
    slug: "browser-download-execution-001",
    title: "Browser Download vs Execution: What Did the User Actually Do?",
    summary:
      "A binary appeared in a user's Downloads folder. The big question is whether they ran it. The evidence is incomplete.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline", "report_writing"],
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ["dfir", "df_artifacts", "windows_artifacts", "inference_discipline", "report_writing"],
    brief: `
# Brief

EDR alerted on a hash match for a known credential-dumping tool on
\`WS-118\`. Triage. The artifacts on hand cover browser, filesystem,
and a partial execution-artifact set. The user (M. WONG) is on
leave and hasn't been interviewed.

The CISO will ask the same first question in the standup tomorrow:

> Did they actually run it?

Build the answer you can defend.

## Artifacts

- **browser-history.csv** — Chromium-style download history with
  the source URL and the local path the file was written to.
- **filesystem-snapshot.json** — file present at the Downloads
  path, with size, SHA-256, and ACL note.
- **prefetch-listing.txt** — listing of \`%SYSTEMROOT%\\Prefetch\`
  entries on the host. Includes a note about whether Prefetch is
  enabled.
- **sysmon-process-create.csv** — a 24-hour window of Sysmon
  ProcessCreate events on the host.

## Reasoning discipline

Three distinct questions, often collapsed in incident writeups:

1. Did the file *arrive* on the host? (Download / write-time event.)
2. Was the file *executed*? (Runtime event.)
3. Did execution *succeed in achieving its purpose*? (Behavioral event.)

This challenge is squarely about #2. Don't let #1 (which is easy to
prove) or #3 (which usually requires its own pivot) bleed into the
answer.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "browser-history.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_utc,url,referrer,target_path,result",
            "2026-09-03T14:08:21Z,https://github.example/redteam/util-x/releases/download/v2/util-x.exe,https://github.example/redteam/util-x/releases,C:\\Users\\m.wong\\Downloads\\util-x.exe,completed",
            "2026-09-03T14:09:02Z,https://github.example/redteam/util-x,,,navigation",
            "2026-09-03T14:11:55Z,https://mail.partner.example/inbox,,,navigation",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "filesystem-snapshot.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              path: "C:\\Users\\m.wong\\Downloads\\util-x.exe",
              size_bytes: 2_211_840,
              sha256: "9e0a4f7b1c2d8e7f0a4f7b1c2d8e7f0a4f7b1c2d8e7f0a4f7b1c2d8e7f0a4f7b",
              created_utc: "2026-09-03T14:08:23Z",
              modified_utc: "2026-09-03T14:08:23Z",
              last_access_utc: "2026-09-03T14:08:23Z",
              motw_zone_id: 3,
              motw_meaning:
                "ZoneId 3 = Internet — Mark-of-the-Web is set. Modern Windows + EDR treat this as a higher-suspicion execution.",
              acl_note:
                "Owner: PARTNER\\m.wong. No SACL audit entries for this file.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "prefetch-listing.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "C:\\Windows\\Prefetch\\ — listing (excerpt)",
            "-----------------------------------------",
            "",
            "Prefetch state:  ENABLED  (EnablePrefetcher = 3, EnableSuperfetch = 3)",
            "Pf retention:    no manual clearing observed in last 30 days",
            "",
            "Files (recent 7d):",
            "  CHROME.EXE-XXXXAAAA.pf       last run: 2026-09-09T08:30:11Z",
            "  ONEDRIVE.EXE-XXXXBBBB.pf     last run: 2026-09-09T08:00:01Z",
            "  TEAMS.EXE-XXXXCCCC.pf        last run: 2026-09-09T08:11:42Z",
            "  NOTEPAD.EXE-XXXXDDDD.pf      last run: 2026-09-03T14:14:08Z",
            "",
            "There is NO Prefetch entry matching `UTIL-X.EXE` anywhere in the",
            "directory listing.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "sysmon-process-create.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_utc,user,image,parent_image,cmdline,hash_sha256",
            "2026-09-03T14:06:11Z,m.wong,C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,explorer.exe,chrome.exe,(elided)",
            "2026-09-03T14:14:08Z,m.wong,C:\\Windows\\System32\\notepad.exe,explorer.exe,notepad.exe util-x_readme.txt,(elided)",
            "2026-09-03T15:02:30Z,m.wong,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,explorer.exe,onedrive.exe,(elided)",
          ].join("\n") + "\n",
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "From the artifacts, which statements are **proven**?",
        options: [
          { id: "downloaded", label: "The file `util-x.exe` was downloaded by Chrome to the user's Downloads folder." },
          { id: "motw-set", label: "The file carries Mark-of-the-Web (Internet zone)." },
          { id: "user-executed", label: "The user executed `util-x.exe`." },
          { id: "user-did-NOT-execute", label: "The user did NOT execute `util-x.exe`." },
          { id: "no-prefetch-entry", label: "There is no Prefetch entry for `util-x.exe` on this host." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["downloaded", "motw-set", "no-prefetch-entry"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Download — browser history + filesystem snapshot agree.",
          "- MotW set — recorded on the file.",
          "- No Prefetch entry — confirmed by directory listing on a host with Prefetch enabled.",
          "",
          "**Not proven (either way):**",
          "",
          "- *User executed* — the absence of a Sysmon ProcessCreate for util-x.exe is suggestive, but Sysmon's 24h window may not cover the relevant time, the config may not log this image, or the binary may have been renamed/relocated before execution. The absence of a Prefetch entry is strong but not absolute — Prefetch creation can be delayed, and on some configurations Prefetch is suppressed for files in certain locations.",
          "- *User did NOT execute* — even with Prefetch enabled and no entry, you cannot affirmatively *prove* a negative without exhaustive coverage. The right finding is \"no evidence of execution observed in the available artifacts,\" not \"the user did not execute the file.\"",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "Which Windows artifact, when present, is the **strongest** routine evidence of execution? (One word, the artifact name.)",
        textMatch: {
          acceptableAnswers: ["prefetch", "prefetch.pf", ".pf"],
          hint: "Files in C:\\Windows\\Prefetch.",
        },
        expected: { type: "text_match", acceptableAnswers: ["prefetch", "prefetch.pf", ".pf"], regex: false },
        debriefMd:
          "Prefetch (`.pf` files in `C:\\Windows\\Prefetch`). The presence of `UTIL-X.EXE-XXXX.pf` is direct evidence that the loader ran the binary at least once. Absence is the weaker side of the coin — Prefetch creation can be delayed under load, and certain configurations suppress Prefetch for some images — but presence is strong.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the user **did execute** util-x.exe based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Nothing in the artifacts is direct evidence of execution. Suggestive *absence* (no Prefetch, no Sysmon ProcessCreate in the window) leans negative, not affirmative — and absence of evidence is not, by itself, evidence of execution.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the user **did NOT execute** util-x.exe, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**3 (or thereabouts).** Prefetch is enabled on this host, the listing is complete, there's no entry for util-x.exe, and Sysmon ProcessCreate in the window shows no util-x.exe. That's suggestive of non-execution, but a **5** would over-claim. Investigative next steps before finalizing: check Amcache + Shimcache + UserAssist, expand the Sysmon window, confirm the file wasn't renamed before execution, and interview the user. Hold the writeup at \"no evidence of execution observed,\" not \"the user did not execute.\"",
      },
    ],
  },

  {
    slug: "windows-execution-artifacts-001",
    title: "Windows Execution Artifacts: Prefetch vs Amcache vs Shimcache",
    summary:
      "Three Windows artifacts, three different stories. Decide what each does and does not prove about whether a specific binary was executed.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 30,
    tags: ["dfir", "df_artifacts", "windows_artifacts", "inference_discipline"],
    brief: `
# Brief

Analyst has pulled excerpts of three Windows execution-adjacent
artifacts for the same workstation + suspected binary. Your job is
to read the rows correctly: each artifact records something subtly
different about a binary's lifecycle, and conflating them is the
single most common writeup error.

## Artifacts

- **prefetch-excerpt.txt** — entries from \`%SYSTEMROOT%\\Prefetch\`
  for binaries of interest, with run counts and first/last run.
- **amcache-excerpt.csv** — \`Amcache.hve\` rows showing first-seen
  times and program metadata.
- **shimcache-excerpt.csv** — \`AppCompatCache\` rows showing the
  shimcache view.
- **host-context.json** — the kind of host this is, OS build,
  Prefetch / Amcache / Shimcache config state.

## What each artifact actually records

- **Prefetch**: created on **execution** by the loader. Strong
  execution signal.
- **Amcache**: records when a binary was **first observed by the
  OS** — which often coincides with execution but is closer to
  "the OS catalogued this file." Presence ≠ execution.
- **Shimcache** (AppCompatCache): records file **existence + last
  modified** plus an "executed" flag that varies wildly by Windows
  build. Famous footgun: the timestamp is not "last executed time."
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "prefetch-excerpt.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "C:\\Windows\\Prefetch  (excerpt)",
            "-----------------------------",
            "",
            "  UTIL-X.EXE-AABBCCDD.pf",
            "    first run: 2026-09-04T09:11:18Z",
            "    last run:  2026-09-04T09:11:18Z",
            "    run count: 1",
            "",
            "  CMD.EXE-XXXX0001.pf",
            "    first run: 2026-09-01T08:00:00Z",
            "    last run:  2026-09-09T08:30:00Z",
            "    run count: 18",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "amcache-excerpt.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "file_path,sha1,first_seen_utc,product_name,publisher",
            "C:\\Users\\m.wong\\Downloads\\util-x.exe,1234abcd1234abcd1234abcd1234abcd1234abcd,2026-09-03T14:08:25Z,UtilX,UtilX Project",
            "C:\\Windows\\System32\\cmd.exe,abcdef,2025-12-01T00:00:00Z,Windows Command Processor,Microsoft Corporation",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "shimcache-excerpt.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "file_path,file_last_modified_utc,executed_flag",
            "C:\\Users\\m.wong\\Downloads\\util-x.exe,2026-09-02T22:00:00Z,present",
            "C:\\Windows\\System32\\cmd.exe,2024-11-12T18:00:00Z,present",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-118",
              os: "Windows 10 21H2",
              prefetch_state: "enabled",
              amcache_present: true,
              shimcache_present: true,
              shimcache_note:
                "On this Windows build, the 'executed' flag in shimcache means 'file appeared in the shim engine'. It is NOT a 'last executed time' field.",
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
          "About `util-x.exe`, which statements are **proven** by the artifacts as written?",
        options: [
          { id: "pf-exec-once", label: "Prefetch shows util-x.exe was executed at least once, at 2026-09-04T09:11:18Z." },
          { id: "amcache-first-seen", label: "Amcache shows util-x.exe was first observed by the OS at 2026-09-03T14:08:25Z." },
          { id: "amcache-executed", label: "Amcache proves util-x.exe was executed at 2026-09-03T14:08:25Z." },
          { id: "shimcache-modtime", label: "Shimcache records the file's last-modified time as 2026-09-02T22:00:00Z." },
          { id: "shimcache-last-executed", label: "Shimcache's `executed_flag = present` proves util-x.exe ran at the modified-time recorded." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["pf-exec-once", "amcache-first-seen", "shimcache-modtime"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Prefetch entry with first-run timestamp = the loader prefetch-trained on this binary at that time. That's an execution.",
          "- Amcache *first seen* is the time the OS catalogued the file's presence. Close to install/copy time, not necessarily execution.",
          "- Shimcache `file_last_modified` is the **file's** modification time, recorded into the shim cache. It is **not** the execution time.",
          "",
          "**Common over-claims (NOT proven):**",
          "",
          "- *Amcache proves execution* — Amcache is famously close to execution time on many Windows builds, but the field semantics are \"first observed,\" not \"executed.\" Treat as a corroborating lead, not as proof.",
          "- *Shimcache executed_flag = last-executed time* — the flag, on this build, means \"file appeared in the shim engine.\" It does not give you a last-executed timestamp. Misreading this is one of the most common DFIR writeup errors.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "What was the *first-run* timestamp Prefetch recorded for util-x.exe? (Exact ISO-8601, as written in the artifact.)",
        textMatch: { acceptableAnswers: ["2026-09-04T09:11:18Z"] },
        expected: { type: "text_match", acceptableAnswers: ["2026-09-04T09:11:18Z"], regex: false },
        debriefMd:
          "`2026-09-04T09:11:18Z`. That's the loader's prefetch-train moment — strong execution evidence at that timestamp, modulo the usual Prefetch caveats (creation can be delayed; some configurations suppress Prefetch).",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that util-x.exe executed on this host.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "**4 or 5.** Prefetch with `run count: 1` and a recorded first-run timestamp is the strongest routine execution artifact this OS provides. Amcache corroborates the presence; Shimcache documents the file. The combination is high-confidence — though as always, finalize with corroboration from EDR (Sysmon ProcessCreate) and a user interview.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the Amcache timestamp `2026-09-03T14:08:25Z` is the **execution** time.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Amcache's timestamp is first-seen, not execution. On this case it happens to fall close to the download time (also 2026-09-03T14:08:23Z in the parallel artifact set) — that's the OS noticing the new file, not the user running it. The execution timestamp is the one in Prefetch, the day after.",
      },
    ],
  },

  // ─── Tier 2 (drafts) ─────────────────────────────────────────
  {
    slug: "dfir-deleted-file-attribution-001",
    title: "DFIR: Deleted File, Uncertain Author",
    summary:
      "A sensitive file showed up in the recycle bin. The bin's metadata names a user — but it's not that simple.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 18,
    tags: ["dfir", "df_artifacts", "windows_artifacts", "inference_discipline"],
    status: "draft",
    brief: `
# Brief (DRAFT)

A document was deleted on a shared workstation. The recycle bin
metadata records the deleting user — but the workstation is shared
and the file's original owner is a different account.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "recycle-bin-metadata.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-SHARED-104",
              recycle_bin_entry: {
                original_path: "D:\\shared\\drafts\\Q3-OPS-SUMMARY-DRAFT.docx",
                deleted_utc: "2026-08-17T19:42:00Z",
                deleted_by_sid_resolved: "PARTNER\\m.greene",
                size_bytes: 207_872,
              },
              file_ownership_note:
                "NTFS file owner (before deletion) was PARTNER\\s.lopez. Owner is the account that created the file; the deleting user does NOT have to match.",
              session_note:
                "WS-SHARED-104 is a shared kiosk. Multiple users have interactive sessions per day. SID resolution here reflects whichever account was logged in at the time of deletion.",
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
        weight: 1,
        promptMd: "Which statements are **proven** by the recycle-bin metadata?",
        options: [
          { id: "greene-deleted", label: "The account `m.greene` initiated the deletion." },
          { id: "lopez-owned", label: "The file's NTFS owner before deletion was `s.lopez`." },
          { id: "greene-malicious", label: "`m.greene` deleted the file maliciously." },
          { id: "lopez-wrote-it", label: "`s.lopez` *wrote* the file (vs. happened to own it via filesystem semantics)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["greene-deleted", "lopez-owned"],
          allowMultiple: true,
        },
        debriefMd:
          "Deletion was initiated by m.greene's session; ownership was s.lopez. Both are filesystem facts. *Intent* (malicious vs accidental) and *authorship* (writing vs inheriting ownership) are inferences requiring more evidence.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which of these would carry the strongest *authorship* signal (vs the deletion + ownership we already have)? Select all that apply.",
        options: [
          { id: "mft-create", label: "NTFS MFT entries for the file's create event (who and when it was first written here)" },
          { id: "sharepoint-version", label: "SharePoint / shared-drive version history (every save event with the saving user)" },
          { id: "office-authoring", label: "Office document authoring history (`creator`, `lastModifiedBy` in the file's core.xml)" },
          { id: "recycle-bin-metadata", label: "The recycle bin `$I` metadata we already have" },
          { id: "ntfs-owner", label: "NTFS owner SID we already have" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["mft-create", "sharepoint-version", "office-authoring"],
          allowMultiple: true,
        },
        debriefMd:
          "MFT *create* entries, shared-drive version history, and Office authoring metadata all directly record an authoring event. The recycle bin entry and the NTFS owner are what we already had — they tell us about *deletion* and *ownership*, not *authorship*. Ownership is whatever account created the file at this filesystem; on shared drives that's often a service or originator that has nothing to do with who wrote the content.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that `m.greene` is the *author* of the document.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. The recycle-bin entry establishes deletion, not authorship. Treat as a lead at most.",
      },
    ],
  },

  {
    slug: "dfir-lnk-jumplist-mru-001",
    title: "DFIR: LNK / Jumplist / MRU",
    summary:
      "Three sources of 'recently opened.' Each has slightly different semantics. Pick the right one.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["dfir", "df_artifacts", "windows_artifacts", "inference_discipline"],
    status: "draft",
    brief: `
# Brief (DRAFT)

Sub-artifact: a small set of Windows "recently accessed" sources
disagree about whether a sensitive file was opened. Read each one
for what it actually records.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "recent-artifacts.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Sources surveyed for file C:\\confidential\\Q3-OPS.docx",
            "----------------------------------------------------",
            "",
            "1. LNK in %APPDATA%\\Microsoft\\Windows\\Recent",
            "     present.",
            "     target path:        C:\\confidential\\Q3-OPS.docx",
            "     target last-access: 2026-08-15T10:14:00Z   (this is the TARGET's last-access time, embedded in the LNK)",
            "     lnk created:        2026-08-15T10:14:02Z",
            "     lnk modified:       2026-08-15T10:14:02Z",
            "",
            "2. Word.Application Jumplist (.automaticDestinations-ms)",
            "     present, with entry for Q3-OPS.docx",
            "     last-access on jumplist: 2026-08-15T10:14:00Z",
            "",
            "3. UserAssist (registry)",
            "     no entry for WINWORD.EXE in the last 7 days for this user",
            "     (Note: UserAssist counts Explorer-launched programs. Opening a doc via",
            "     'Recent files' inside Word doesn't always create a UserAssist entry for WINWORD.)",
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
        promptMd: "Which sources prove that this user opened Q3-OPS.docx?",
        options: [
          { id: "lnk", label: "The LNK in Recent is direct evidence the file was accessed via Explorer's recent-files mechanism." },
          { id: "jumplist", label: "The Word jumplist entry is direct evidence the file was opened in Word." },
          { id: "userassist", label: "Absence of a UserAssist entry for WINWORD proves the user did NOT open Word." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["lnk", "jumplist"],
          allowMultiple: true,
        },
        debriefMd:
          "LNK in Recent + Word jumplist entry are both direct evidence of access. UserAssist's absence is weak here — opening a document via Word's own recent-files list doesn't necessarily create a UserAssist entry for WINWORD.EXE.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd: "What time did the target document's last-access show in the LNK?",
        textMatch: { acceptableAnswers: ["2026-08-15T10:14:00Z"] },
        expected: { type: "text_match", acceptableAnswers: ["2026-08-15T10:14:00Z"], regex: false },
        debriefMd:
          "`2026-08-15T10:14:00Z`. Note this is the **target file's** last-access embedded in the LNK; the LNK's own creation/modification timestamps are a few seconds later.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that the user opened the file.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "High. Two independent sources (LNK + jumplist) agree on access at the same timestamp. UserAssist's absence is consistent with opening via Word's own recent-files menu and does not erode the LNK+jumplist evidence.",
      },
    ],
  },
];
