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
            "$ foremost -i usb-001.dd -o /cases/2026/114/carved/ -t doc,ole,zip -v",
            "Foremost version 1.5.7 by Jesse Kornblum, Kris Kendall, and Nick Mikus",
            "Audit File",
            "",
            "Foremost started at Sat Sep 12 12:00:00 2026",
            "Invocation: foremost -i usb-001.dd -o /cases/2026/114/carved/ -t doc,ole,zip -v",
            "Output directory: /cases/2026/114/carved",
            "Configuration file: /etc/foremost.conf",
            "Processing: usb-001.dd",
            "|------------------------------------------------------------------|",
            "File: usb-001.dd",
            "Start: Sat Sep 12 12:00:00 2026",
            "Length: 8 GB (8589934592 bytes)",
            " ",
            "Num\t Name (bs=512)\t       Size\t File Offset\t Comment",
            "",
            "0:\t00000537.doc \t     132 KB\t  274857984\t ",
            "1:\t02603300.doc \t     207 KB\t 1328742400\t ",
            "*|",
            "Finish: Sat Sep 12 12:14:23 2026",
            "",
            "2 FILES EXTRACTED",
            "",
            "doc:= 2",
            "------------------------------------------------------------------",
            "Foremost finished at Sat Sep 12 12:14:23 2026",
            "",
            "",
            "$ file /cases/2026/114/carved/doc/00000537.doc /cases/2026/114/carved/doc/02603300.doc",
            "00000537.doc: Microsoft OOXML",
            "02603300.doc: Microsoft OOXML",
            "",
            "$ mv /cases/2026/114/carved/doc/00000537.doc /cases/2026/114/carved/doc/00000537.docx",
            "$ mv /cases/2026/114/carved/doc/02603300.doc /cases/2026/114/carved/doc/02603300.docx",
            "",
            "$ exiftool -G /cases/2026/114/carved/doc/02603300.docx",
            "[ExifTool]      ExifTool Version Number         : 12.42",
            "[File]          File Name                       : 02603300.docx",
            "[File]          Directory                       : /cases/2026/114/carved/doc",
            "[File]          File Size                       : 207 kB",
            "[File]          File Modification Date/Time     : 2026:09:12 12:14:23-04:00",
            "[File]          File Type                       : DOCX",
            "[File]          File Type Extension             : docx",
            "[File]          MIME Type                       : application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "[ZIP]           Zip Required Version            : 20",
            "[ZIP]           Zip Bit Flag                    : 0x0006",
            "[ZIP]           Zip Compression                 : Deflated",
            "[ZIP]           Zip Modify Date                 : 2026:08:14 11:17:00",
            "[ZIP]           Zip Compressed Size             : 198345",
            "[Document]      Title                           : Q3-OPS-SUMMARY-DRAFT",
            "[Document]      Creator                         : S.LOPEZ",
            "[Document]      Last Modified By                : S.LOPEZ",
            "[Document]      Revision Number                 : 4",
            "[Document]      Create Date                     : 2026:08:14 11:00:00Z",
            "[Document]      Modify Date                     : 2026:08:14 11:17:00Z",
            "",
            "$ fls -i raw -f exfat -p usb-001.dd | grep -i 'q3-ops'",
            "(no output  — no current filesystem entry references the recovered document)",
            "",
            "$ blkstat -i raw -f exfat usb-001.dd 2596958",
            "Cluster: 2596958",
            "Allocated",
            "(carved offset 0x1A480000  =  sector 2596958  =  cluster 81154,",
            " allocation reported as a stale residue; the volume's allocation",
            " bitmap on this exFAT image places 28% of clusters in the free pool.)",
            "",
            "$ blkstat -i raw -f exfat usb-001.dd 12585375",
            "Cluster: 12585375",
            "Not Allocated",
            "(carved offset 0x4F310000  =  sector 12585375  =  cluster 393293;",
            " sits in unallocated space — no current filesystem record.)",
            "",
            "# Examiner notes (B. Maddox, end of carve):",
            "#   - foremost recovers BYTES; the filesystem context that would",
            "#     name a user / write-time process is not in scope.",
            "#   - exiftool's Author + Title fields come from the DOCX core.xml",
            "#     metadata, which is author-controllable. They name a CLAIM,",
            "#     not a verified fact.",
            "#   - The 0x4F310000 carve sits in unallocated space — the volume",
            "#     no longer claims this file as a current entry (confirmed via",
            "#     `fls` above).",
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
          // Magnet AXIOM Process - USB Devices artifact category,
          // pivoted to mounts observed for VID/PID/Serial XX-001 across
          // the workstations in scope (CSV export from AXIOM Examine).
          // Columns mirror the AXIOM "Connected USB Devices" view.
          [
            "Source.Evidence,Hostname,FirstConnected,LastConnected,ConnectionCount,UserAtConsole",
            "WS-441-image.E01,WS-441,2026-08-12T08:14:00Z,2026-08-14T11:30:00Z,4,WS-441\\m.greene",
            "WS-622-image.E01,WS-622,2026-08-13T09:45:00Z,2026-08-14T10:50:00Z,3,WS-622\\s.lopez",
            "WS-104-image.E01,WS-104,2026-08-16T13:01:00Z,2026-08-16T13:04:00Z,1,",
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

EDR (Endpoint Detection and Response — host-side security telemetry)
alerted on a hash match for a known credential-dumping tool on
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
  ProcessCreate events on the host. (Sysmon = Microsoft System
  Monitor, a free Windows service that logs process, network, and
  file activity to the Event Log.)

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
          // sqlite3 'C:/Cases/WS-WONG/AppData/Local/Google/Chrome/User Data/Default/History'
          //   "SELECT datetime(v.visit_time/1000000 - 11644473600, 'unixepoch') AS visit_utc,
          //           u.url, ref.url AS referrer, d.target_path, d.state
          //    FROM visits v JOIN urls u ON v.url = u.id
          //    LEFT JOIN visits vref ON v.from_visit = vref.id
          //    LEFT JOIN urls ref ON vref.url = ref.id
          //    LEFT JOIN downloads d ON d.start_time = v.visit_time
          //    ORDER BY v.visit_time;"  --csv --header
          [
            "visit_utc,url,referrer,target_path,state",
            "2026-09-03 14:08:21,https://github.example/redteam/util-x/releases/download/v2/util-x.exe,https://github.example/redteam/util-x/releases,C:\\Users\\m.wong\\Downloads\\util-x.exe,1",
            "2026-09-03 14:09:02,https://github.example/redteam/util-x,,,",
            "2026-09-03 14:11:55,https://mail.partner.example/inbox,,,",
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
            "PS C:\\> Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' | Select EnablePrefetcher,EnableSuperfetch",
            "",
            "EnablePrefetcher EnableSuperfetch",
            "---------------- ----------------",
            "               3                3",
            "",
            "PS C:\\> Get-ChildItem C:\\Cases\\WS141\\C\\Windows\\Prefetch -Filter 'UTIL-X*.pf'",
            "",
            "  (no items match the filter)",
            "",
            "",
            "PECmd version 1.5.0.0",
            "",
            "Author: Eric Zimmerman (saericzimmerman@gmail.com)",
            "https://github.com/EricZimmerman/PECmd",
            "",
            "Command line: PECmd.exe -d C:\\Cases\\WS141\\C\\Windows\\Prefetch -k util-x --csv C:\\Cases\\WS141\\Out --csvf util-x-search.csv",
            "",
            "Keywords: util-x",
            "",
            "Processing C:\\Cases\\WS141\\C\\Windows\\Prefetch ...",
            "",
            "No prefetch files matched keyword 'util-x'.",
            "",
            "---------- Processed 184 files in 0.318 seconds ----------",
            "",
            "",
            "PS C:\\> Get-ChildItem C:\\Cases\\WS141\\C\\Windows\\Prefetch | Where-Object { $_.LastWriteTime -gt (Get-Date '2026-09-02') } | Sort-Object LastWriteTime -Descending | Format-Table Name,LastWriteTime",
            "",
            "Name                          LastWriteTime",
            "----                          -------------",
            "CHROME.EXE-XXXXAAAA.pf        2026-09-09 08:30:11Z",
            "TEAMS.EXE-XXXXCCCC.pf         2026-09-09 08:11:42Z",
            "ONEDRIVE.EXE-XXXXBBBB.pf      2026-09-09 08:00:01Z",
            "NOTEPAD.EXE-XXXXDDDD.pf       2026-09-03 14:14:08Z",
            "",
            "# Examiner observation:",
            "#   Prefetch was enabled at the relevant time (EnablePrefetcher = 3)",
            "#   and there is NO .pf entry referencing UTIL-X.EXE anywhere in the",
            "#   directory. Absence is suggestive of non-execution but does not",
            "#   prove a negative — Prefetch creation can be delayed and certain",
            "#   configurations suppress Prefetch for specific images.",
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
          // EvtxECmd.exe -f C:\Cases\WS-WONG\Sysmon.evtx --inc 1 --csv . --csvf sysmon-eid1.csv
          [
            "TimeCreated,EventId,User,Image,CommandLine,ParentImage,ParentCommandLine,Hashes",
            "2026-09-03T14:06:11.2118Z,1,WORKGROUP\\m.wong,C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe,\"\"\"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\"\"\",C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,SHA256=1A2B3C4D5E6F70819A2B3C4D5E6F70819A2B3C4D5E6F70819A2B3C4D5E6F7081",
            "2026-09-03T14:14:08.7901Z,1,WORKGROUP\\m.wong,C:\\Windows\\System32\\notepad.exe,\"notepad.exe util-x_readme.txt\",C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,SHA256=ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789",
            "2026-09-03T15:02:30.4400Z,1,WORKGROUP\\m.wong,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,\"\"\"C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe\"\" /background\",C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,SHA256=DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
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
            "PECmd version 1.5.0.0",
            "",
            "Author: Eric Zimmerman (saericzimmerman@gmail.com)",
            "https://github.com/EricZimmerman/PECmd",
            "",
            "Command line: PECmd.exe -d C:\\Cases\\WS118\\C\\Windows\\Prefetch --csv C:\\Cases\\WS118\\Out --csvf prefetch.csv",
            "",
            "Keywords: temp, tmp",
            "",
            "Processing C:\\Cases\\WS118\\C\\Windows\\Prefetch\\UTIL-X.EXE-AABBCCDD.pf",
            "Source file: C:\\Cases\\WS118\\C\\Windows\\Prefetch\\UTIL-X.EXE-AABBCCDD.pf",
            "  Source created : 2026-09-04 09:11:18",
            "  Source modified: 2026-09-04 09:11:18",
            "  Source accessed: 2026-09-04 09:11:18",
            "",
            "  Executable name : UTIL-X.EXE",
            "  Hash            : AABBCCDD",
            "  File size       : 28,672 bytes",
            "  Version         : Windows 10 or Windows 11",
            "",
            "  Run count       : 1",
            "  Last run        : 2026-09-04 09:11:18",
            "",
            "  Volume information:",
            "    #0: Name: \\VOLUME{01dc7a4a-3a9f-1234-9a3b-aabbccddeeff}",
            "        Serial: A4F1-2B3C",
            "        Created: 2025-12-01 00:00:00",
            "        Directories: 4   File references: 22",
            "",
            "  Directories referenced: 4",
            "    00: \\VOLUME{01dc7a4a-3a9f-1234-9a3b-aabbccddeeff}\\USERS\\M.WONG\\DOWNLOADS",
            "    01: \\VOLUME{01dc7a4a-3a9f-1234-9a3b-aabbccddeeff}\\WINDOWS\\SYSTEM32",
            "    02: \\VOLUME{01dc7a4a-3a9f-1234-9a3b-aabbccddeeff}\\WINDOWS\\SYSTEM32\\EN-US",
            "    03: \\VOLUME{01dc7a4a-3a9f-1234-9a3b-aabbccddeeff}\\WINDOWS\\WINSXS",
            "",
            "Processing C:\\Cases\\WS118\\C\\Windows\\Prefetch\\CMD.EXE-XXXX0001.pf",
            "Source file: C:\\Cases\\WS118\\C\\Windows\\Prefetch\\CMD.EXE-XXXX0001.pf",
            "  Source created : 2025-12-01 00:00:00",
            "  Source modified: 2026-09-09 08:30:00",
            "  Source accessed: 2026-09-09 08:30:00",
            "",
            "  Executable name : CMD.EXE",
            "  Hash            : XXXX0001",
            "  File size       : 31,200 bytes",
            "  Version         : Windows 10 or Windows 11",
            "",
            "  Run count       : 18",
            "  Last run        : 2026-09-09 08:30:00",
            "  Previous run 0  : 2026-09-08 16:42:11",
            "  Previous run 1  : 2026-09-08 09:01:33",
            "  Previous run 2  : 2026-09-05 13:20:09",
            "",
            "---------- Processed 2 files in 0.043 seconds ----------",
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
          // AmcacheParser.exe -f C:\Cases\WS-WONG\Amcache.hve --csv . --csvf amcache.csv
          // (Excerpt: InventoryApplicationFile rows; subset of Eric
          //  Zimmerman's canonical AmcacheParser column set.)
          [
            "ApplicationName,FullPath,Name,SHA1,FileKeyLastWriteTimestamp,ProductName,Publisher,Size,Version,IsPeFile,IsOsComponent",
            "util-x.exe,C:\\Users\\m.wong\\Downloads\\util-x.exe,util-x.exe,1234abcd1234abcd1234abcd1234abcd1234abcd,2026-09-03 14:08:25,UtilX,UtilX Project,28672,2.0.0.0,True,False",
            "cmd.exe,C:\\Windows\\System32\\cmd.exe,cmd.exe,0123456789abcdef0123456789abcdef01234567,2025-12-01 00:00:00,Microsoft® Windows® Operating System,Microsoft Corporation,289792,10.0.22631.1,True,True",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "shimcache-excerpt.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // AppCompatCacheParser.exe -f C:\Cases\WS-WONG\SYSTEM --csv . --csvf shimcache.csv
          // (Excerpt: ControlSet001 AppCompatCache values; canonical
          //  column set from Eric Zimmerman's AppCompatCacheParser.)
          [
            "ControlSet,CacheEntryPosition,Path,LastModifiedTimeUTC,Executed,Duplicate",
            "ControlSet001,12,C:\\Users\\m.wong\\Downloads\\util-x.exe,2026-09-02 22:00:00,Yes,False",
            "ControlSet001,158,C:\\Windows\\System32\\cmd.exe,2024-11-12 18:00:00,Yes,False",
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
            "================================================================",
            "  1. LECmd  —  parse Recent LNK",
            "================================================================",
            "",
            "LECmd version 1.5.1.0",
            "",
            "Author: Eric Zimmerman (saericzimmerman@gmail.com)",
            "https://github.com/EricZimmerman/LECmd",
            "",
            "Command line: LECmd.exe -f C:\\Cases\\WS155\\Recent\\Q3-OPS.lnk",
            "",
            "Processing C:\\Cases\\WS155\\Recent\\Q3-OPS.lnk",
            "",
            "Source file: C:\\Cases\\WS155\\Recent\\Q3-OPS.lnk",
            "  Source created : 2026-08-15 10:14:02",
            "  Source modified: 2026-08-15 10:14:02",
            "  Source accessed: 2026-08-15 10:14:02",
            "",
            "--- Header ---",
            "  Target created : 2026-08-15 10:14:00",
            "  Target modified: 2026-08-15 10:14:00",
            "  Target accessed: 2026-08-15 10:14:00",
            "",
            "  File size: 131,072",
            "  Flags: HasTargetIdList, HasLinkInfo, HasName, HasRelativePath, HasWorkingDir, IsUnicode",
            "  File attributes: ArchiveBit",
            "",
            "  Icon index: 0",
            "  Show window: SwNormal (Activates and displays the window...)",
            "",
            "  Relative Path: ..\\..\\..\\..\\..\\..\\confidential\\Q3-OPS.docx",
            "  Working Directory: C:\\confidential",
            "",
            "--- Link information ---",
            "  Flags: VolumeIdAndLocalBasePath",
            "",
            "  >> Volume information",
            "      Drive type: Fixed storage media (Hard drive)",
            "      Serial number: A4F1-2B3C",
            "      Label: OSDisk",
            "      Local path: C:\\confidential\\Q3-OPS.docx",
            "",
            "",
            "================================================================",
            "  2. JLECmd  —  parse Word AutomaticDestinations jumplist",
            "================================================================",
            "",
            "JLECmd version 1.4.0.0",
            "",
            "Author: Eric Zimmerman (saericzimmerman@gmail.com)",
            "https://github.com/EricZimmerman/JLECmd",
            "",
            "Command line: JLECmd.exe -f \"C:\\Cases\\WS155\\AppData\\Roaming\\Microsoft\\Windows\\Recent\\AutomaticDestinations\\f01b4d95cf55d32a.automaticDestinations-ms\"",
            "",
            "Processing C:\\Cases\\WS155\\AppData\\Roaming\\Microsoft\\Windows\\Recent\\AutomaticDestinations\\f01b4d95cf55d32a.automaticDestinations-ms",
            "",
            "  AppId: f01b4d95cf55d32a  (Microsoft Word 2010-2019)",
            "",
            "  --- DestList entry 0 ---",
            "    MRU Position : 0",
            "    File path    : C:\\confidential\\Q3-OPS.docx",
            "    Last accessed: 2026-08-15 10:14:00",
            "    Pinned       : False",
            "    Hostname     : WS-155",
            "    MAC address  : 00:50:56:0e:01:55",
            "    Volume drive : Fixed",
            "    Volume serial: A4F1-2B3C",
            "    Volume label : OSDisk",
            "",
            "",
            "================================================================",
            "  3. RegRipper  —  userassist plugin (NTUSER.DAT, m.wong)",
            "================================================================",
            "",
            "Launching userassist v.20200527",
            "userassist v.20200527",
            "(NTUSER.DAT) Displays contents of UserAssist subkeys",
            "",
            "UserAssist",
            "**All values printed in MRUList\\Time order. Most recent at the top.**",
            "",
            "{CEBFF5CD-ACE2-4F4F-9178-9926F41749EA}\\Count",
            "LastWrite Time Sun Sep  6 09:11:18 2026 (UTC)",
            "",
            "Sun Sep  6 09:11:18 2026 Z",
            "  Microsoft.Office.OUTLOOK.EXE.15           Count: 142   Focus count: 84   Focus time: 8:42:11",
            "Sat Sep  5 17:42:00 2026 Z",
            "  CHROME.EXE                                Count: 412   Focus count: 220  Focus time: 4:21:09",
            "Fri Sep  4 12:30:11 2026 Z",
            "  ACROBAT.EXE                               Count: 11    Focus count: 6    Focus time: 0:38:42",
            "",
            "  (no entry for WINWORD.EXE in the trailing 7-day window)",
            "",
            "  Note: UserAssist counts Explorer-launched programs. Opening a",
            "  document from Word's own \"Recent files\" list does NOT always",
            "  create a UserAssist entry for WINWORD.EXE.",
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
          "What **date and time** did the **target document's** last-access show in the LNK? Quote the full timestamp the way the artifact prints it — shape is `YYYY-MM-DD HH:MM:SS` (or with a `T` separator and a trailing `Z`).",
        textMatch: {
          acceptableAnswers: [
            "2026-08-15T10:14:00Z",
            "2026-08-15T10:14:00",
            "2026-08-15 10:14:00Z",
            "2026-08-15 10:14:00",
            "2026-08-15T10:14:00 UTC",
            "2026-08-15 10:14:00 UTC",
            // Bare-time variants. The reader who typed "10:14:00"
            // identified the correct field in the artifact (all three
            // target timestamps happen to coincide at 10:14:00,
            // distinct from the source row's 10:14:02); penalising
            // them with NOT YET teaches writeup form, not field
            // identification, and this question is the latter.
            "10:14:00",
            "10:14:00Z",
            "10:14:00 UTC",
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
            "2026-08-15 10:14:00 UTC",
            "10:14:00",
            "10:14:00Z",
            "10:14:00 UTC",
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
review. The artifact is a parsed extract of the registry's
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

- *Who* plugged the device in. USBSTOR is a per-host artifact;
  attribution to a user requires correlating with the logged-on
  user (security event log) at the LastArrivalDate.
- *What files were copied to or from the device.* That requires
  file-system / journal / LNK-on-host artifacts and (ideally) the
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
            "C:\\Tools\\RegRipper3.0> rip.exe -r C:\\Cases\\WS200\\SYSTEM -p usbstor",
            "",
            "Launching usbstor v.20200518",
            "usbstor v.20200518",
            "(System) Get USBStor key info",
            "",
            "USBStor",
            "ControlSet001\\Enum\\USBSTOR",
            "",
            "Disk&Ven_Kingston&Prod_DataTraveler_3.0&Rev_PMAP  [Fri Sep 18 14:22:08 2026]",
            "  S/N: AA-CORP-IT-099  [Fri Sep 18 14:22:08 2026]",
            "    Device Parameters LastWrite: Fri Sep 18 14:22:08 2026",
            "    LogConf            LastWrite: Fri Sep 18 14:22:08 2026",
            "    Properties         LastWrite: Fri Sep 18 14:22:08 2026",
            "    FriendlyName    : Kingston DataTraveler 3.0",
            "    ParentIdPrefix  : 8&1c5d3a2&0",
            "",
            "    Properties (system store):",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0064  (FirstInstallDate)   : Thu Apr  2 08:11:04 2026",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0066  (LastArrivalDate)    : Fri Sep 18 14:22:08 2026",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0067  (LastRemovalDate)    : Fri Sep 18 15:08:41 2026",
            "",
            "Disk&Ven_SanDisk&Prod_Cruzer_Glide_3.0&Rev_1.00  [Wed Nov  4 19:42:11 2026]",
            "  S/N: BB-PRIV-EX-118  [Wed Nov  4 19:42:11 2026]",
            "    Device Parameters LastWrite: Wed Nov  4 19:42:11 2026",
            "    LogConf            LastWrite: Wed Nov  4 19:42:11 2026",
            "    Properties         LastWrite: Wed Nov  4 19:42:11 2026",
            "    FriendlyName    : SanDisk Cruzer Glide 3.0",
            "    ParentIdPrefix  : 8&36bc1cd&0",
            "",
            "    Properties (system store):",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0064  (FirstInstallDate)   : Wed Nov  4 19:42:11 2026",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0066  (LastArrivalDate)    : Wed Nov  4 19:42:11 2026",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0067  (LastRemovalDate)    : Wed Nov  4 20:55:30 2026",
            "",
            "Disk&Ven_Generic&Prod_USB_SD_Reader&Rev_1.00  [Sat Aug 15 10:30:20 2026]",
            "  S/N: 0000000000000001  [Sat Aug 15 10:30:20 2026]   ** default / generated serial **",
            "    Device Parameters LastWrite: Sat Aug 15 10:30:20 2026",
            "    LogConf            LastWrite: Sat Aug 15 10:30:20 2026",
            "    Properties         LastWrite: Sat Aug 15 10:30:20 2026",
            "    FriendlyName    : Generic USB SD Reader",
            "    ParentIdPrefix  : 8&00a214b&0",
            "",
            "    Properties (system store):",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0064  (FirstInstallDate)   : Sat Aug 15 10:30:20 2026",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0066  (LastArrivalDate)    : Sat Aug 15 10:30:20 2026",
            "      {83da6326-97a6-4088-9453-a1923f573b29}\\0067  (LastRemovalDate)    : Sat Aug 15 10:42:01 2026",
            "",
            "End of usbstor.",
            "",
            "# Asset-register cross-reference (analyst note, free-form):",
            "#   AA-CORP-IT-099 -> IT pool issuance, on register.",
            "#   BB-PRIV-EX-118 -> NOT on register.",
            "#   0000000000000001 -> default/generated serial, common on cheap",
            "#                       card-reader chips; non-unique.",
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
          // EvtxECmd.exe -f C:\Cases\WS-104\Security.evtx --inc 4624,4634 --csv . --csvf logons.csv
          // Workstation context: WS-104 is a shared kiosk used by both
          //   accounts on overlapping shifts — captured in the casenotes,
          //   not in this artifact.
          [
            "TimeCreated,EventId,MapDescription,Computer,UserName,LogonType,WorkstationName,IpAddress",
            "2026-11-04T08:30:01.3201Z,4624,Account successfully logged on,WS-104,CORP\\s.alvarez,2 (Interactive),WS-104,-",
            "2026-11-04T19:00:00.1180Z,4634,Account was logged off,WS-104,CORP\\s.alvarez,2 (Interactive),WS-104,-",
            "2026-11-04T19:01:08.7045Z,4624,Account successfully logged on,WS-104,CORP\\m.greene,2 (Interactive),WS-104,-",
            "2026-11-04T21:30:01.9911Z,4634,Account was logged off,WS-104,CORP\\m.greene,2 (Interactive),WS-104,-",
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
          "Which statements are supported by the artifacts as written?",
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
              "These artifacts establish whether files were copied to the SanDisk.",
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
          "- *Files copied* — USBSTOR doesn't see file operations. Copy attribution requires LNK / shellbag / journal artifacts on the host and (ideally) the device itself.",
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
              "Pull host-side LNK / shellbag artifacts and journal entries that reference the SanDisk's volume during the window.",
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
          "Confidence (1–5) that `m.greene` connected the non-asset-register SanDisk during their session at this kiosk, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3 or 4.** USBSTOR + setupapi establish that the SanDisk was enumerated. The security-log slice puts `m.greene` at the console during the window. That's strong session-level attribution. It is NOT conclusive about personal action — a session can be left unlocked, a different person can plug something in during a brief turn — and the artifacts don't speak to that. Pair with a brief interview before naming the person in any report.",
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
          "- *C — contemporaneous narrative* — the witness's recollection is at its freshest now. A short factual one-pager is the right artifact and feeds the case file.",
          "- *G — image under chain of custody* — once the examiner is on scene, image the workstation with proper custody. Imaging is what makes any subsequent finding defensible.",
          "",
          "**Do NOT:**",
          "",
          "- *D — delete the file* — destroys evidence and may amount to spoliation. The file's existence and metadata are part of the investigation.",
          "- *E — reboot* — wipes volatile state (running processes, in-memory paths) the examiner may need; can also alter on-disk artifacts.",
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

  // ─── Removable Media / Spillage capstone ────────────────────
  {
    slug: "spillage-handed-in-usb-capstone-001",
    title: "Spillage Capstone: A USB Just Got Handed In",
    summary:
      "A civilian found a USB stick in the smoking area outside the unit building and turned it in. Walk the first-hour workflow, read the carving output, cross-check the device against the unit's USBSTOR data, and write what gets sent up the chain.",
    skillAreas: ["df_artifacts", "removable_media", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 50,
    tags: [
      "spillage",
      "removable_media",
      "df_artifacts",
      "report_writing",
      "inference_discipline",
      "capstone",
    ],
    lane: "removable_media_spillage",
    module: "Capstone",
    sequence: 1,
    status: "draft",
    brief: `
# Brief

A DA-civilian in the unit picked up a USB stick on the ground in
the smoking area outside the building this morning, brought it
straight to the orderly room, and handed it to SSG Owens. SSG
Owens did not plug it in. She tagged it, opened a 4137, and
handed the package to you. Power is off; the device hasn't
touched any unit workstation since it was found.

You have the 4137 extract, a brief intake statement from SSG
Owens, the USBSTOR-history lookup the helpdesk ran against unit
endpoints (was this device *ever* mounted on a unit system?),
and the early results from the offline-bench carving of the
device. One of the carved files has classification markings.

Walk through what the artifacts support, name what the
appropriate next steps look like, and pick the wording that
goes on the ISSM's desk this afternoon.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "intake-statement.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Intake statement — SSG K. Owens (orderly room)",
            "----------------------------------------------",
            "",
            "  Today, ~0815 local, J. Reyes (DA-civ, S3 shop) came in",
            "  with a Kingston-branded USB stick. He said he found it",
            "  on the ground in the smoking area outside the south",
            "  entrance, by the bench. He picked it up to look at the",
            "  label, saw \"S3-WORKING\" handwritten on it, and brought",
            "  it directly to the orderly room. He did NOT plug it in",
            "  anywhere.",
            "",
            "  I tagged the device, opened DA Form 4137 #4137-2026-",
            "  321-A, and placed it in the evidence locker. I have",
            "  NOT plugged it into anything. I notified the ISSM by",
            "  phone at 0820. I am holding it pending your read.",
            "",
            "  /s/ K. Owens, SSG",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "da-4137-extract.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "DA Form 4137 #4137-2026-321-A (extract)",
            "---------------------------------------",
            "",
            "  Item description : Kingston DataTraveler 3.0 USB",
            "                     stick. Handwritten label",
            "                     \"S3-WORKING\" on outer shell.",
            "                     Serial visible on connector:",
            "                     KDT-3-AB-118.",
            "",
            "  Released by      : J. Reyes (DA-civ, S3) — signature",
            "                     and date, 2026-12-04 0817 local",
            "  Received by      : SSG K. Owens (orderly room) —",
            "                     signature and date, 2026-12-04",
            "                     0818 local. Tag affixed at intake.",
            "",
            "  Released by      : SSG K. Owens — signature and date,",
            "                     2026-12-04 0915 local",
            "  Received by      : SPC D. Halverson (you — DFE) —",
            "                     signature and date, 2026-12-04",
            "                     0917 local. Tag intact at receipt.",
            "",
            "  Notes            : Device powered off. Not plugged in",
            "                     to any unit system since recovery.",
            "                     ISSM notified by phone 2026-12-04",
            "                     0820 local.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "usbstor-history-lookup.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Unit-wide USBSTOR-history lookup — Kingston DataTraveler",
            "serial KDT-3-AB-118",
            "--------------------------------------------------------",
            "",
            "  Query                : helpdesk USB-asset inventory",
            "                         (registry-extract feed from every",
            "                         unit endpoint, refreshed nightly)",
            "  Records returned     : 0",
            "  Note                 : This serial does not match any",
            "                         currently-known device that has",
            "                         been mounted on a unit workstation.",
            "                         A 0-row return is suggestive that",
            "                         the device is unfamiliar to the",
            "                         unit asset population, but does NOT",
            "                         prove the device never touched a",
            "                         unit endpoint — devices mounted",
            "                         briefly may not have been captured,",
            "                         and the registry-feed only began",
            "                         in 2024-06.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "carving-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Offline-bench carving — Kingston KDT-3-AB-118",
            "(foremost 1.5.7, write-blocked, source dd image)",
            "-----------------------------------------------",
            "",
            "  Image source        : kdt-3-ab-118.dd",
            "  Image SHA-256       : 71fa...c022 (verified)",
            "  Bytes               : 7,750,000,000 (~7.75 GB)",
            "  File system         : exFAT, no active entries",
            "                        (volume appears wiped — full",
            "                         allocation table is empty)",
            "",
            "  Carved              : 14 files recovered from",
            "                        unallocated space",
            "    - 11 JPEGs (mostly photos of a child's birthday",
            "      party; one document scan — looks like a school",
            "      permission slip)",
            "    - 2 PDFs (one recipe printout, one tax form",
            "      template)",
            "    - 1 DOCX (file of interest, see below)",
            "",
            "  File of interest    : carved-001.docx",
            "    SHA-256           : 2a44...18ce",
            "    Size              : 142,008 bytes",
            "    First page header : (S//NF)",
            "    Body              : memo-formatted text",
            "                        beginning \"OPERATION ...\"",
            "    No filesystem name : carved from unallocated",
            "                        space; original filename not",
            "                        recoverable",
            "    No timestamps     : carved from unallocated; MAC",
            "                        times not associable",
            "    No owning SID     : not from a live filesystem",
            "                        entry",
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
          "From the carving output, which statement is **directly supported** about `carved-001.docx`?",
        options: [
          {
            id: "markings-present",
            label:
              "A file with classification markings on its first page (S//NF) was recovered from unallocated space on the device.",
          },
          {
            id: "who-wrote",
            label:
              "We can identify who wrote the file from the carving output.",
          },
          {
            id: "when-written",
            label:
              "We know when the file was last written to the device.",
          },
          {
            id: "intent-spilled",
            label:
              "Someone intentionally moved classified material to the USB and tried to hide it by deleting it.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["markings-present"],
          allowMultiple: false,
        },
        debriefMd:
          "Markings present in unallocated space is what the carving output says. Authorship, write-time, and intent are all bigger claims that need things carving doesn't carry — filesystem metadata, an owning SID, a timeline. The markings alone are enough to trigger the spillage workflow; they aren't enough to write a finding about who put them there.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "The unit's USBSTOR-history lookup returned zero rows for this serial. What does that **directly support**?",
        options: [
          {
            id: "unfamiliar-suggestive",
            label:
              "The device is unfamiliar to the unit's tracked endpoint population — suggestive, but not proof the device never touched a unit system.",
          },
          {
            id: "never-touched",
            label:
              "The device has never been mounted on any unit workstation.",
          },
          {
            id: "from-outside",
            label:
              "The device was brought in from outside the unit by an unknown party.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["unfamiliar-suggestive"],
          allowMultiple: false,
        },
        debriefMd:
          "Suggestive, not proof. The artifact itself says the feed only began in 2024-06, and devices mounted briefly may not be captured. \"Never touched a unit workstation\" overstates a 0-row result. \"Brought in from outside by an unknown party\" is a different claim altogether — the device could be a unit member's personal stick, or a contractor's, or anyone's.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "What is the **right first-hour action** for the markings-bearing file?",
        options: [
          {
            id: "isolate-and-route",
            label:
              "Keep the device powered off, keep the offline-bench host isolated (no network), preserve the carved file in place, and route the find to the ISSM + supporting ACI office for a classification-determination and spillage-investigation referral.",
          },
          {
            id: "open-and-read",
            label:
              "Open `carved-001.docx` on a unit workstation to read what it says and see who it was written for.",
          },
          {
            id: "delete-and-move-on",
            label:
              "Delete the carved file from the bench host so it doesn't sit unsecured.",
          },
          {
            id: "share-with-team",
            label:
              "Share the carved file with the rest of the DFE team for a second opinion via the unit Teams channel.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["isolate-and-route"],
          allowMultiple: false,
        },
        debriefMd:
          "Isolate, preserve, route. Opening a markings-bearing file on a unit workstation is itself another spillage event. Deleting destroys the artifact. Sharing on Teams (or any general channel) propagates it. The ACI / ISSM referral is where the classification determination and the formal spillage workflow actually live; the DFE's job is to preserve and hand off.",
      },
      {
        ordinal: 4,
        type: "text_match",
        weight: 1,
        promptMd:
          "Quote the **serial number** of the recovered USB device, exactly as printed in the 4137.",
        textMatch: {
          acceptableAnswers: ["KDT-3-AB-118"],
          hint: "Look for the `Serial visible on connector:` line in the 4137 extract.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["KDT-3-AB-118"],
          regex: false,
        },
        debriefMd:
          "`KDT-3-AB-118`. The serial belongs in every downstream writeup; \"a Kingston USB\" is weaker than the specific serial, and the serial is what disambiguates this device from any other Kingston the unit has seen.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Three drafts of the one-paragraph note that goes on the ISSM's desk this afternoon. Pick the one you'd actually send up.",
        options: [
          {
            id: "overclaim",
            label:
              "*A USB stick (Kingston DataTraveler, serial KDT-3-AB-118) recovered from the smoking area outside the south entrance was found to contain a classified document carved from unallocated space. The (S//NF) classification markings on `carved-001.docx` are unambiguous; the file was deliberately deleted from the device, indicating attempted concealment. The device's serial is not in the unit USBSTOR-history feed, confirming it is a non-asset-register personal USB used to exfiltrate classified material from a unit workstation before being abandoned outside the building. Recommend immediate criminal referral to the supporting ACI office and CID, an asset hold on every workstation in the building's south wing pending USBSTOR-mounting matches, and an unrestricted access-review across the unit's classified networks.*",
          },
          {
            id: "calibrated",
            label:
              "*This morning, J. Reyes turned in a Kingston USB stick (serial KDT-3-AB-118) recovered from the smoking area outside the south entrance; device was not plugged in by any unit member between recovery and intake. Offline-bench carving of the device, with the source image hashed to 71fa...c022, recovered 14 files from unallocated space, one of which (`carved-001.docx`, SHA-256 2a44...18ce) bears (S//NF) markings on its first page. The device serial does not match any record in the unit's USBSTOR-history feed, although that feed has known coverage gaps so a unit-mounted history cannot be ruled out from this alone. Custody is unbroken per 4137 #4137-2026-321-A. Routing the find to ACI and to the ISSM for a classification-determination + spillage-investigation referral; the device remains powered off in the evidence locker pending direction.*",
          },
          {
            id: "underclaim",
            label:
              "*A Kingston DataTraveler USB stick (serial KDT-3-AB-118) was recovered from the smoking area by a DA-civilian and turned in to the orderly room. Offline-bench carving of the device found 14 files in unallocated space, including a recipe printout, a tax form template, photos of a child's birthday party, and a single file with classification markings. The device's filesystem was completely wiped (empty allocation table) before being dropped, which suggests the owner cleared the device for personal use or resale and the markings-bearing file is leftover content not visible to the owner since deletion. The unit USBSTOR-history feed shows no record of this serial, so the device was never connected to a unit workstation. Recommend logging the finding for inventory and disposing of the device through routine media-destruction channels; no spillage workflow needed.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle one. It names every fact the artifacts carry (serial, source image hash, carved file hash, the markings, the custody chain) and explicitly flags the USBSTOR-history null-result as suggestive but not exhaustive. The first jumps to *exfiltrated* without any owner evidence — the device could be lost by anyone with any provenance — and recommends a referral the artifact set doesn't support. The third treats the absence of active filesystem entries as no-concern, which is exactly the read that loses the spillage; carved markings in unallocated space *is* the concern.",
      },
    ],
  },
];
