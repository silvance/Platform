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
    lane: "removable_media_spillage",
    module: "USB carving & spillage",
    sequence: 1,
    brief: `
# Brief

A USB mass-storage device was received by your supporting ACI
evidence custodian on **DA Form 4137 #4137-2026-114-A** after it
was found in a shared workspace. Forensic imaging yielded the
artifacts in this scenario. A carving pass recovered one
DOCX-like document from **unallocated space** bearing \`(SECRET)\`
marker text in the body. (All markings and content in this
exercise are fictional and sanitized.)

The supporting ACI **Special Agent in Charge (SAC)** has asked
for a one-paragraph finding **today** that they can roll into a
SITREP. Your task is to make sure the language you give them is
defensible — and that any potentially reportable counterintelligence
category is named without over-claim.

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
            "(SECRET)  Q3 OPERATIONS SUMMARY — DRAFT",
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
            "(S) [...content elided...]",
            "",
            "(SECRET)  Distribution restricted to those with operational need-",
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
          { id: "marking-present", label: "Document body contains `(SECRET)` markings", evidenceRef: "document-excerpt.txt" },
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
          { id: "doc-was-on-device", label: "A document bearing `(SECRET)` markers was, at some point, written to this device." },
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
          "",
          "**Reporting framing.** The presence of `(SECRET)` markers on a document on an unmanaged USB implicates the *unauthorized disclosure* family of reportable counterintelligence incidents; whether it crosses into *deliberate security compromise* depends entirely on what follow-up shows about intent. The carved-bytes finding alone supports reporting the *incident*; it does not by itself support an attribution claim against any named individual.",
          "",
          "**Owners.** Three routes can be running concurrently: the unit ISSM owns the cybersecurity-incident track (spillage handling on the affected systems); the supporting ACI office owns the CI track once attribution starts to take shape; USACIDC enters the picture only if intent indicators surface that take it from CI inquiry to criminal investigation. Imaging + chain of custody happens regardless.",
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
          "- The `(SECRET)` markings establish the *nature* of the document, not who put it there.",
          "- The absence of a free-space wipe establishes the *state of the device*, not authorship.",
          "- The fact that the doc was carved from unallocated space is part of why the question is *attribution-uncertain* in the first place.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What does carving from unallocated space prove about **who wrote** the document?",
        options: [
          {
            id: "nothing-about-authorship",
            label:
              "Nothing about authorship. Carving recovers bytes from sectors the filesystem no longer claims — it does not recover the user-account / ACL / process context that would establish who wrote them.",
          },
          {
            id: "named-author-wrote-it",
            label:
              "It proves the person named in the DOCX `Author` field (S.LOPEZ) wrote the document, because the carved metadata names them.",
          },
          {
            id: "device-owner-wrote-it",
            label:
              "It proves whoever last mounted the USB device wrote the document, because the device's last-mount user is recorded.",
          },
          {
            id: "deleter-is-author",
            label:
              "It proves whoever deleted the file authored it — files in unallocated space were placed there by their author.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["nothing-about-authorship"],
          allowMultiple: false,
        },
        debriefMd:
          "**Nothing about authorship.** Carving recovers byte content; it does not recover the filesystem context (user account, ACLs, write-time process) that would establish authorship. The carved DOCX `Author` metadata field is author-controllable text inside the file — it names a *claim*, not a *fact*. Authorship requires evidence from where the document was authored or used: workstation MFT records, SharePoint version history, recent-documents shell extensions, email attachment chains. A carved DOCX is a *starting point* for those inquiries, not the answer to them.",
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
    lane: "windows_artifacts",
    module: "Execution evidence",
    sequence: 1,
    brief: `
# Brief

EDR alerted on a hash match for a known credential-dumping tool on
\`WS-118\`, a workstation in DA-personnel use. Triage. The artifacts
on hand cover browser, filesystem, and a partial execution-artifact
set. The user (M. WONG) is on leave and hasn't been interviewed.

Your supporting ACI Special Agent in Charge will ask the same first
question in the standup tomorrow:

> Did they actually run it?

Build the answer you can defend. For ACI reporting, the *presence*
of a non-approved tool and the *execution* of it sit in different
buckets — the former is an unauthorized-software concern; the
latter raises the possibility of an exfil / unauthorized-AIS-access
incident. Don't conflate them.

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
          "Which Windows artifact, when present, is the **strongest** routine evidence of execution? **(One-word artifact name.)**",
        textMatch: {
          acceptableAnswers: ["prefetch", "prefetch.pf", ".pf", "pf"],
          hint: "Files in `C:\\Windows\\Prefetch` whose name ends `.pf`. The artifact name is in the file extension.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["prefetch", "prefetch.pf", ".pf", "pf"],
          regex: false,
        },
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
          "**3 (or thereabouts).** Prefetch is enabled on this host, the listing is complete, there's no entry for util-x.exe, and Sysmon ProcessCreate in the window shows no util-x.exe. That's suggestive of non-execution, but a **5** would over-claim. Investigative next steps before finalizing: check Amcache + Shimcache + UserAssist, expand the Sysmon window, confirm the file wasn't renamed before execution, and interview the user. Hold the writeup at \"no evidence of execution observed,\" not \"the user did not execute.\"\n\n**Owner.** Initial incident handling is the unit ISSM (Army cybersecurity reporting chain). ACI involvement is contingent on what attribution surfaces — a credential-dumping tool hash on a DA-personnel host is not by itself a CI matter; the FIE-linked attribution makes it one.",
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
    lane: "windows_artifacts",
    module: "Execution evidence",
    sequence: 2,
    brief: `
# Brief

A USACIDC digital forensic examiner (DFE) working in support of
your ACI office has pulled excerpts of three Windows execution-
adjacent artifacts for the same workstation + suspected binary.
Your job is to read the rows correctly: each artifact records
something subtly different about a binary's lifecycle, and
conflating them is the single most common writeup error — one
that gets called out in any subsequent legal review.

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
          "What was the *first-run* timestamp Prefetch recorded for util-x.exe? **(ISO-8601 as written in the artifact; trailing `Z` and the `T` separator both optional.)**",
        textMatch: {
          acceptableAnswers: [
            "2026-09-04T09:11:18Z",
            "2026-09-04T09:11:18",
            "2026-09-04 09:11:18Z",
            "2026-09-04 09:11:18",
            "2026-09-04T09:11:18 UTC",
          ],
          hint: "Look at the `first run:` line in `prefetch-summary.txt`. Copy the timestamp from there verbatim.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: [
            "2026-09-04T09:11:18Z",
            "2026-09-04T09:11:18",
            "2026-09-04 09:11:18Z",
            "2026-09-04 09:11:18",
            "2026-09-04T09:11:18 UTC",
          ],
          regex: false,
        },
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
          "**1 or 2.** Amcache's timestamp is first-seen, not execution. On this case it happens to fall close to the download time (also 2026-09-03T14:08:23Z in the parallel artifact set) — that's the OS noticing the new file, not the user running it. The execution timestamp is the one in Prefetch, the day after.\n\n**Owner.** The DFE's output goes back to the ISSM as input to the cybersecurity-incident response on the host; ACI consumes the same output for any CI-linked attribution work that follows.",
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
    lane: "windows_artifacts",
    module: "Deleted-file attribution",
    sequence: 1,
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
    lane: "windows_artifacts",
    module: "Recent items & shellbags",
    sequence: 1,
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
        promptMd:
          "What time did the **target document's** last-access show in the LNK? **(ISO-8601 as written; trailing `Z` and the `T` separator both optional.)**",
        textMatch: {
          acceptableAnswers: [
            "2026-08-15T10:14:00Z",
            "2026-08-15T10:14:00",
            "2026-08-15 10:14:00Z",
            "2026-08-15 10:14:00",
            "2026-08-15T10:14:00 UTC",
          ],
          hint: "Look at the `target last-access:` line in the LNK artifact (NOT the LNK's own creation/modification times — those are a few seconds later).",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: [
            "2026-08-15T10:14:00Z",
            "2026-08-15T10:14:00",
            "2026-08-15 10:14:00Z",
            "2026-08-15 10:14:00",
            "2026-08-15T10:14:00 UTC",
          ],
          regex: false,
        },
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

  // ─── Removable media / spillage — adds to that lane ─────────
  {
    slug: "usb-usbstor-history-001",
    title: "Removable Media: USBSTOR Device History",
    summary:
      "A registry extract lists the USB mass-storage devices Windows has seen. Read the entries correctly and decide what they do and don't prove.",
    skillAreas: ["df_artifacts", "removable_media", "windows_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 20,
    tags: ["dfir", "removable_media", "usbstor", "windows_artifacts", "inference_discipline"],
    lane: "removable_media_spillage",
    module: "Device history",
    sequence: 1,
    brief: `
# Brief

A Windows host (\`WS-3104\`, assigned to \`s.alvarez\`) is under
review. The artefact is a parsed extract of the registry's
\`USBSTOR\` key plus a small slice of \`setupapi.dev.log\`. These
together are the canonical "what USB devices has this machine
seen?" record.

Reading them correctly is the point of this exercise.

## What USBSTOR records

Each subkey under \`HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USBSTOR\`
represents a class of device, named like:
\`Disk&Ven_<VENDOR>&Prod_<PRODUCT>&Rev_<REV>\`. Under each class
the instance ID (the device's reported serial) gets its own
subkey carrying:

- **FirstInstallDate / InstallDate** — first time the OS
  installed drivers for this instance.
- **LastArrivalDate** — most recent time the device was
  enumerated (plugged in).
- **LastRemovalDate** — most recent unplug.
- The friendly name + parent ID prefix linking back to mount
  points.

## What it does NOT establish on its own

- *Who* plugged the device in. USBSTOR is a per-host artefact;
  attribution to a user requires correlating with the logged-on
  user (security event log) at the LastArrivalDate.
- *What files were copied to or from the device.* That requires
  file-system / journal / LNK-on-host artefacts and (ideally) the
  device itself.
- *Whether the device's reported serial is real.* Some
  mass-storage devices return a zero or generated serial; the
  field is taken at face value here.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "usbstor-extract.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USBSTOR  (parsed extract)",
            "------------------------------------------------------------",
            "",
            "Disk&Ven_Kingston&Prod_DataTraveler_3.0&Rev_PMAP",
            "  Instance: AA-CORP-IT-099  (asset-register match: yes; issued to IT pool)",
            "    FirstInstallDate: 2026-04-02T08:11:04Z",
            "    LastArrivalDate:  2026-09-18T14:22:08Z",
            "    LastRemovalDate:  2026-09-18T15:08:41Z",
            "    FriendlyName:     Kingston DataTraveler 3.0",
            "",
            "Disk&Ven_SanDisk&Prod_Cruzer_Glide_3.0&Rev_1.00",
            "  Instance: BB-PRIV-EX-118  (asset-register match: NO)",
            "    FirstInstallDate: 2026-11-04T19:42:11Z",
            "    LastArrivalDate:  2026-11-04T19:42:11Z",
            "    LastRemovalDate:  2026-11-04T20:55:30Z",
            "    FriendlyName:     SanDisk Cruzer Glide 3.0",
            "",
            "Disk&Ven_Generic&Prod_USB_SD_Reader&Rev_1.00",
            "  Instance: 0000000000000001  (default/generated serial)",
            "    FirstInstallDate: 2026-08-15T10:30:20Z",
            "    LastArrivalDate:  2026-08-15T10:30:20Z",
            "    LastRemovalDate:  2026-08-15T10:42:01Z",
            "    FriendlyName:     Generic USB SD Reader",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "setupapi-dev-slice.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "setupapi.dev.log  (excerpt — first-install entries only)",
            "---------------------------------------------------------",
            "",
            ">>>  [Device Install (Hardware initiated) - USBSTOR\\Disk&Ven_Kingston&Prod_DataTraveler_3.0&Rev_PMAP\\AA-CORP-IT-099]",
            ">>>  Section start 2026-04-02 08:11:04.012",
            "      <<<  Section end 2026-04-02 08:11:04.498",
            "",
            ">>>  [Device Install (Hardware initiated) - USBSTOR\\Disk&Ven_Generic&Prod_USB_SD_Reader&Rev_1.00\\0000000000000001]",
            ">>>  Section start 2026-08-15 10:30:20.117",
            "      <<<  Section end 2026-08-15 10:30:20.852",
            "",
            ">>>  [Device Install (Hardware initiated) - USBSTOR\\Disk&Ven_SanDisk&Prod_Cruzer_Glide_3.0&Rev_1.00\\BB-PRIV-EX-118]",
            ">>>  Section start 2026-11-04 19:42:11.330",
            "      <<<  Section end 2026-11-04 19:42:12.041",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "security-log-interactive-logons.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "utc,event_id,event_name,user,logon_type",
            "2026-11-04T08:30:01Z,4624,LogonSuccess,CORP\\s.alvarez,interactive",
            "2026-11-04T19:00:00Z,4634,Logoff,CORP\\s.alvarez,interactive",
            "2026-11-04T19:01:08Z,4624,LogonSuccess,CORP\\m.greene,interactive",
            "2026-11-04T21:30:01Z,4634,Logoff,CORP\\m.greene,interactive",
            "(Workstation is a shared kiosk used by both accounts on overlapping shifts.)",
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
          "Which statements are supported by the artefacts as written?",
        options: [
          {
            id: "two-asset-mismatch",
            label:
              "At least one USB device whose serial is NOT in the corporate asset register was enumerated on this host (the SanDisk instance `BB-PRIV-EX-118`).",
          },
          {
            id: "sandisk-window",
            label:
              "The non-asset-register SanDisk was enumerated 2026-11-04 19:42:11Z and unplugged 2026-11-04 20:55:30Z — a roughly 1h 13m window.",
          },
          {
            id: "user-attribution-from-usbstor",
            label:
              "USBSTOR alone names `s.alvarez` as the user who plugged in the SanDisk.",
          },
          {
            id: "user-attribution-from-security-log",
            label:
              "The interactive-logon slice shows `m.greene` was the logged-on user during the SanDisk window — that's a stronger attribution lead than USBSTOR by itself.",
          },
          {
            id: "files-copied",
            label:
              "These artefacts establish whether files were copied to the SanDisk.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["two-asset-mismatch", "sandisk-window", "user-attribution-from-security-log"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Supported:**",
          "",
          "- The SanDisk serial isn't on the asset register, and USBSTOR + setupapi agree on the window.",
          "- The shared-kiosk security log puts `m.greene` at the console during the SanDisk window, not `s.alvarez`. That's a different actor than the host's primary assignment.",
          "",
          "**Not supported:**",
          "",
          "- *USBSTOR names the user* — USBSTOR is per-host. You need the security log (or equivalent session attribution) to name a person.",
          "- *Files copied* — USBSTOR doesn't see file operations. Copy attribution requires LNK / shellbag / journal artefacts on the host and (ideally) the device itself.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What are the right next investigative steps if the SanDisk mount is the focus?",
        options: [
          {
            id: "find-the-device",
            label:
              "Locate and image the SanDisk device, on chain of custody.",
          },
          {
            id: "lnk-shellbags",
            label:
              "Pull host-side LNK / shellbag artefacts and journal entries that reference the SanDisk's volume during the window.",
          },
          {
            id: "interview-greene",
            label:
              "Interview `m.greene` about what device they connected during the 19:42–20:55Z window.",
          },
          {
            id: "block-all-usb",
            label:
              "Disable USB ports on this kiosk immediately.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["find-the-device", "lnk-shellbags", "interview-greene"],
          allowMultiple: true,
        },
        debriefMd:
          "Device imaging + host-side LNK/journal/shellbag evidence + a user interview cover the three open questions (what's on the device, what was copied, who copied). Disabling USB ports is a policy reaction that may be sensible at the unit level but doesn't help the investigation.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `m.greene` connected the non-asset-register SanDisk during their session at this kiosk, based ONLY on these artefacts.",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3 or 4.** USBSTOR + setupapi establish that the SanDisk was enumerated. The security-log slice puts `m.greene` at the console during the window. That's strong session-level attribution. It is NOT conclusive about personal action — a session can be left unlocked, a different person can plug something in during a brief turn — and the artefacts don't speak to that. Pair with a brief interview before naming the person in any report.",
      },
    ],
  },

  // ─── Spillage workflow ──────────────────────────────────────
  {
    slug: "spillage-discovery-workflow-001",
    title: "Spillage Discovery: First-Hour Workflow",
    summary:
      "Possible classified spillage on an unauthorised system. Pick the right first-hour steps — and the wrong ones.",
    skillAreas: ["report_writing", "df_artifacts", "removable_media", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["spillage", "removable_media", "workflow", "report_writing"],
    lane: "removable_media_spillage",
    module: "Spillage workflow",
    sequence: 1,
    brief: `
# Brief

A DA-civilian analyst (\`r.becker\`) has just told you they
opened a Word document on an unclassified workstation that
*appeared* to carry a \`(SECRET)\` marker in the body. They
closed the file immediately, didn't print, didn't email it
anywhere, and walked over to your office to report.

This is a **possible classified spillage**. The unclassified
workstation is not authorised for SECRET material. The next hour
matters: the right sequence preserves evidence, contains the
spread, and keeps the response defensible. The wrong sequence
destroys evidence, contaminates witnesses, or — worst — fails to
contain.

The objective of this exercise is to pick the right steps. It is
not to substitute for unit spillage SOP or the responsible
information-systems-security manager (ISSM); when a real
spillage happens, both of those are in the loop early.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "candidate-actions.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Candidate first-hour actions",
            "----------------------------",
            "",
            "  A. Leave the workstation powered on. Disconnect it from the",
            "     network (cable / WLAN). Do not touch the keyboard or mouse.",
            "",
            "  B. Notify the supporting ACI office and the ISSM.",
            "",
            "  C. Have r.becker write a one-page contemporaneous narrative",
            "     while the events are fresh — what they did, what they saw,",
            "     when they reported.",
            "",
            "  D. Immediately delete the suspect file from the workstation",
            "     to prevent further exposure.",
            "",
            "  E. Reboot the workstation \"just to clear it\" before any",
            "     forensic work begins.",
            "",
            "  F. Forward the suspect document by email to the supporting",
            "     ACI office so they can examine it.",
            "",
            "  G. Image the workstation under chain of custody once the",
            "     supporting forensic examiner is on scene.",
            "",
            "  H. Tell every other person in the office bay what happened and",
            "     who reported it.",
            "",
            "  I. Decide right now whether the marker in the document was",
            "     real or just a draft watermark, and act accordingly.",
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
          "Pick the actions that belong in the **first-hour workflow**.",
        options: [
          {
            id: "A",
            label: "A — leave powered on, disconnect network, hands off.",
          },
          {
            id: "B",
            label: "B — notify the supporting ACI office and the ISSM.",
          },
          {
            id: "C",
            label: "C — contemporaneous one-page narrative from r.becker.",
          },
          {
            id: "D",
            label: "D — delete the suspect file from the workstation.",
          },
          {
            id: "E",
            label: "E — reboot the workstation \"to clear it.\"",
          },
          {
            id: "F",
            label: "F — email the suspect document to the supporting ACI office for review.",
          },
          {
            id: "G",
            label: "G — image the workstation under chain of custody once the examiner is on scene.",
          },
          {
            id: "H",
            label: "H — inform every other person in the office bay.",
          },
          {
            id: "I",
            label: "I — decide right now whether the marker was real.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["A", "B", "C", "G"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Belong in the first hour:**",
          "",
          "- *A — power-on, network-off, hands-off* — preserves the live state for the forensic examiner. Network-off contains further spread.",
          "- *B — notify ACI + ISSM* — both have authoritative roles in the response; bring them in early.",
          "- *C — contemporaneous narrative* — the witness's recollection is at its freshest now. A short factual one-pager is the right artefact and feeds the case file.",
          "- *G — image under chain of custody* — once the examiner is on scene, image the workstation with proper custody. Imaging is what makes any subsequent finding defensible.",
          "",
          "**Do NOT:**",
          "",
          "- *D — delete the file* — destroys evidence and may amount to spoliation. The file's existence and metadata are part of the investigation.",
          "- *E — reboot* — wipes volatile state (running processes, in-memory paths) the examiner may need; can also alter on-disk artefacts.",
          "- *F — email it to ACI* — moves the suspect content into a new system (mail server, mailboxes, archive). That's *spreading the spillage*, not containing it. Talk to ACI; do not forward the document.",
          "- *H — broadcast to the bay* — contaminates witnesses, amplifies exposure, and may compromise the response. Need-to-know.",
          "- *I — decide on marker validity now* — that's the examiner's call after triage with the appropriate classification authority. Don't pre-judge.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "If asked at this point what the marker on the document means, the best response is:",
        options: [
          {
            id: "neutral-defer",
            label:
              "\"A classified marker was observed on the document. Classification determination is the responsibility of the original-classification authority and is being coordinated. The workstation is being preserved under chain of custody.\"",
          },
          {
            id: "self-classify",
            label:
              "\"The document is classified SECRET and an unauthorised disclosure has occurred.\"",
          },
          {
            id: "minimise",
            label:
              "\"It's probably a draft watermark; not really a problem.\"",
          },
          {
            id: "refuse-comment",
            label:
              "\"I cannot discuss anything about this incident.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["neutral-defer"],
          allowMultiple: false,
        },
        debriefMd:
          "Describe what was observed, name the right authority for the classification determination, and report the containment posture. Don't self-classify (it's not your call), don't minimise (you don't know yet), and don't blank-stonewall (you can describe what's being done about the *incident* without describing the *content*).",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that, with the right first-hour actions above and an examiner on scene, this incident can be cleanly preserved and reported.",
        expected: { type: "confidence", expectedRange: [3, 5] },
        debriefMd:
          "**4 (or thereabouts).** Power-on + network-off + hands-off + contemporaneous narrative + ACI/ISSM in the loop + imaging under custody is the canonical clean response. The remaining uncertainty is whatever the examination + classification determination later turn up — that's the work the workflow exists to make possible.",
      },
    ],
  },
];
