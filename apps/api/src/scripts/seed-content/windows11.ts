import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Windows 11 forensic-artifact scenarios. Each one drills into a
// specific artifact (or small cluster of artifacts) that an
// analyst working a Win11 host will see in the field. The bar is
// the same as the rest of the catalogue: every claim the student
// is graded on has to be provable from the artifacts as written,
// and every artifact has at least one trap that punishes
// over-claiming.

export const WINDOWS11_SCENARIOS: ScenarioSeed[] = [
  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "win11-bam-execution-evidence-001",
    title: "Windows 11 BAM: Per-User Execution Evidence",
    summary:
      "The Background Activity Moderator tracks last-execution time per user SID. Read it correctly — and notice what it doesn't tell you.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "windows11", "windows_artifacts", "df_artifacts", "inference_discipline"],
    lane: "windows_artifacts",
    module: "Windows 11 specifics",
    sequence: 3,
    brief: `
# Brief

The Background Activity Moderator (\`bam\`) service on Windows
keeps a per-user record of the **last execution time** of
foreground programs. On Win10/11 it lives at:

\`HKLM\\SYSTEM\\CurrentControlSet\\Services\\bam\\State\\UserSettings\\<SID>\`

Each value name under that key is the **full NT-path of the
executable** (e.g. \`\\Device\\HarddiskVolume3\\Users\\j.doe\\...\\foo.exe\`),
and the value's binary data carries a FILETIME for the last
execution observed for that user.

That makes BAM unusually useful: most execution artifacts
(Prefetch, Amcache) record host-level activity. BAM gives you
*per-user* attribution out of the box — no UserAssist decoding,
no \`SID → user\` correlation step required after the initial
parse.

But the read has classic traps:

- BAM tracks **foreground** programs. Background services and
  scheduled tasks may not be reflected.
- The timestamp is the **last** observed execution, not every
  execution. An execution earlier in the week is overwritten by
  a more recent one.
- Entries can be evicted. Absence in BAM is NOT proof a binary
  never ran for that user.
- The NT path (\`\\Device\\HarddiskVolume3\\...\`) must be
  resolved to a drive letter using the host's volume map. A
  mismatch here is one of the easiest writeup errors to make.

## Artifacts

- **bam-export.csv** — parsed BAM entries (SID, NT path, last
  execution time UTC).
- **sid-account-map.json** — the host's SID → account
  mapping so you can attribute by name, not by SID.
- **volume-map.json** — \`\\Device\\HarddiskVolume<N>\` → drive
  letter mapping at the time of acquisition.
- **host-context.json** — Windows build, BAM service state,
  acquisition timestamp.

## A note on the tool names you'll see in the question options

This scenario's questions reference **EDR** (Endpoint Detection
and Response — host-side security telemetry like CrowdStrike
Falcon or Microsoft Defender for Endpoint) and **Sysmon**
(Microsoft's free System Monitor service, which emits structured
process / network / file events to the Event Log). You will not
need to recite their internals — only recognize that they
complement BAM as **execution-evidence** sources.

## Reporting framing

For ACI reporting, name BAM findings at the level the artifact
supports: the **account context** in which a binary ran, not
the named user's personal action. Any subsequent
unauthorized-software or unauthorized-AIS-access concern is
reportable as a cyberspace activity / indicator; presence-of-tool
and execution-of-tool sit in different reporting buckets.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "bam-export.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "sid,nt_path,last_execution_utc",
            "S-1-5-21-1111111111-2222222222-3333333333-1107,\\Device\\HarddiskVolume3\\Users\\m.wong\\Downloads\\sync-helper.exe,2026-10-14T18:22:41Z",
            "S-1-5-21-1111111111-2222222222-3333333333-1107,\\Device\\HarddiskVolume3\\Users\\m.wong\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe,2026-10-14T19:01:02Z",
            "S-1-5-21-1111111111-2222222222-3333333333-1107,\\Device\\HarddiskVolume3\\Windows\\System32\\notepad.exe,2026-10-12T13:04:55Z",
            "S-1-5-21-1111111111-2222222222-3333333333-1208,\\Device\\HarddiskVolume3\\Users\\j.parker\\Downloads\\sync-helper.exe,2026-10-09T08:42:19Z",
            "S-1-5-21-1111111111-2222222222-3333333333-1208,\\Device\\HarddiskVolume3\\Windows\\System32\\cmd.exe,2026-10-14T07:50:00Z",
            "S-1-5-21-1111111111-2222222222-3333333333-500,\\Device\\HarddiskVolume3\\Windows\\System32\\mmc.exe,2026-10-01T11:00:00Z",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "sid-account-map.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-2204",
              resolved_at_utc: "2026-10-15T09:00:00Z",
              entries: [
                {
                  sid: "S-1-5-21-1111111111-2222222222-3333333333-1107",
                  account: "CORP\\m.wong",
                  type: "user",
                },
                {
                  sid: "S-1-5-21-1111111111-2222222222-3333333333-1208",
                  account: "CORP\\j.parker",
                  type: "user",
                },
                {
                  sid: "S-1-5-21-1111111111-2222222222-3333333333-500",
                  account: "WS-2204\\Administrator",
                  type: "local_admin",
                },
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "volume-map.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-2204",
              note: "Drive-letter map at acquisition time. NT paths in BAM use HarddiskVolume<N>; resolve via this map before quoting paths in a writeup.",
              map: {
                "\\Device\\HarddiskVolume1": "(EFI system partition, no letter)",
                "\\Device\\HarddiskVolume2": "(MSR, no letter)",
                "\\Device\\HarddiskVolume3": "C:",
                "\\Device\\HarddiskVolume4": "D:",
              },
            },
            null,
            2,
          ) + "\n",
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
              host: "WS-2204",
              os: "Windows 11 23H2 (build 22631)",
              acquired_utc: "2026-10-15T09:00:00Z",
              bam_service_state: "running",
              registry_hive_path: "C:\\Windows\\System32\\config\\SYSTEM",
              note: "BAM updates the per-user UserSettings key as foreground programs are observed. Background services and scheduled tasks are not consistently recorded.",
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
          "From the BAM export and the SID map, which statements are **proven** about `sync-helper.exe`?",
        options: [
          {
            id: "wong-executed",
            label:
              "User `CORP\\m.wong` executed `C:\\Users\\m.wong\\Downloads\\sync-helper.exe` at 2026-10-14T18:22:41Z (the *last observed* execution by that user).",
          },
          {
            id: "parker-executed",
            label:
              "User `CORP\\j.parker` executed `C:\\Users\\j.parker\\Downloads\\sync-helper.exe` at 2026-10-09T08:42:19Z (their *last observed* execution).",
          },
          {
            id: "only-execution",
            label:
              "These are the only times `sync-helper.exe` ever executed on this host.",
          },
          {
            id: "both-users-same-binary",
            label:
              "`sync-helper.exe` was executed by at least two different user accounts on this host.",
          },
          {
            id: "wong-d-drive",
            label:
              "User `m.wong` executed `sync-helper.exe` from the `D:` drive.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["wong-executed", "parker-executed", "both-users-same-binary"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- `m.wong` and `j.parker` each have a BAM entry under their own SID for `sync-helper.exe`, with last-execution timestamps. BAM records the last observed foreground execution per user — that's exactly what those rows mean.",
          "- The presence of two distinct SIDs both with the same image name proves at least two accounts ran the binary (from their respective profile-local copies, per the resolved paths).",
          "",
          "**Not proven:**",
          "",
          "- *Only times ever executed* — BAM stores the **last** observed execution. Earlier runs are overwritten. You cannot count executions from BAM alone.",
          "- *Drive `D:`* — both `sync-helper.exe` rows resolve to `\\Device\\HarddiskVolume3`, which the volume map labels `C:`. Quoting `D:` would be a path-resolution error.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "BAM has no entry for `bitsadmin.exe` on this host. Which of these is the **correct** thing to say in a writeup?",
        options: [
          {
            id: "never-ran",
            label:
              "BAM proves `bitsadmin.exe` has never executed on this host.",
          },
          {
            id: "no-foreground-bam",
            label:
              "BAM has no record of `bitsadmin.exe` being a foreground program for any tracked user. Absence in BAM is suggestive, not proof — corroborate with Prefetch / Amcache / EDR before claiming non-execution.",
          },
          {
            id: "ran-as-background",
            label:
              "BAM proves `bitsadmin.exe` ran only as a background service.",
          },
          {
            id: "bam-broken",
            label:
              "The absence implies the BAM service is broken on this host.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-foreground-bam"],
          allowMultiple: false,
        },
        debriefMd:
          "BAM only consistently records *foreground* execution and evicts entries over time. Absence in BAM is a **soft signal** — pair it with Prefetch / Amcache / EDR before claiming the binary didn't run. Declaring \"never ran\" from BAM alone is the canonical over-claim.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which Windows artifacts would you correlate with BAM to harden the execution claim for `sync-helper.exe`?",
        options: [
          { id: "prefetch", label: "Prefetch (`.pf` files in `C:\\Windows\\Prefetch`)." },
          { id: "amcache", label: "Amcache (`Amcache.hve`)." },
          { id: "userassist", label: "UserAssist (per-user, ROT13-encoded)." },
          { id: "wpndatabase", label: "Windows Notification Database (`wpndatabase.db`)." },
          { id: "edr-process-create", label: "EDR / Sysmon process-create events (EID 1 / EID 4688)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["prefetch", "amcache", "userassist", "edr-process-create"],
          allowMultiple: true,
        },
        debriefMd: [
          "Prefetch is the strongest stand-alone execution evidence (loader prefetch-trains on real executions). Amcache catalogues the file but is closer to *first-seen* than executed. UserAssist gives per-user shell-launched program counts. EDR / Sysmon process-create directly captures the spawn.",
          "",
          "`wpndatabase.db` is the Windows Notification Center store — it has no bearing on program execution.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `m.wong` personally executed `sync-helper.exe` at 2026-10-14T18:22:41Z (based ONLY on the BAM row).",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3–4.** BAM is per-SID, so the binary ran under `m.wong`'s logon session. That's strong attribution. But *personally* presupposes the user was at the keyboard — a session can be left unlocked, RDP can be used, scheduled tasks can run in user context. The disciplined finding is \"executed under m.wong's account at <time>\" with confidence 3–4; reserve confidence 5 for the case where a session-correlated artifact (e.g., screen lock state, EDR with keyboard activity) puts the user at the console.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact reconciliation ────────────
  {
    slug: "win11-srum-network-egress-001",
    title: "Windows 11 SRUM: Per-Application Network Bytes",
    summary:
      "SRUM tells you which app sent how many bytes — in hour buckets, per user. Use it to triage an exfil suspicion without over-claiming what it can prove.",
    skillAreas: [
      "df_artifacts",
      "windows_artifacts",
      "network_logs",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "windows11",
      "windows_artifacts",
      "df_artifacts",
      "network_logs",
      "exfiltration",
      "inference_discipline",
    ],
    lane: "windows_artifacts",
    module: "Windows 11 specifics",
    sequence: 4,
    brief: `
# Brief

A possible exfiltration. Two days ago, a DA-civilian developer
(\`p.singh\`) gave 30-day notice. Yesterday evening the
data-loss-prevention team alerted on a 380 MiB upload from her
workstation to a cloud-storage service that isn't on the unit
allow-list. EDR (Endpoint Detection and Response — host-side security
telemetry) coverage on the host is patchy: process-create is on,
network telemetry is off.

The supporting ACI Special Agent in Charge has scoped the
review and your workstation imaging was receipted on
**DA Form 4137 #4137-2026-309-A**; the host's \`SRUDB.dat\` ESE
database (at \`C:\\Windows\\System32\\sru\\\`) is one of the
artifacts pulled. SRUM records per-app network bytes sent and
received in **60-minute aggregation buckets**, attributed to the
process image + user SID.

The ACI SAC wants a defensible finding by EOD; a write-up that
over-claims jeopardizes any subsequent counsel coordination. The
incident sits in the *data-exfiltration / unauthorized-upload*
family of reportable cyberspace activities — but the *which*
question turns on what SRUM does and does not prove.

## What SRUM is good for

- Per-app **volume** of bytes sent/received over time.
- Per-user attribution (SID).
- Long retention compared to most network telemetry (~30 days
  on default config).

## What SRUM is NOT

- Real-time. It flushes hourly + at logoff. The most recent
  hour may not yet be in the DB.
- A connection log. SRUM does not record destination IPs,
  ports, hostnames, or TLS SNI. The "where it went" question
  is unanswerable from SRUM alone.
- Aware of process injection / hollowing. The image name is
  whatever Windows attributed the socket to.
- A capture of WSL traffic. WSL2 connections appear under
  \`vmcompute.exe\` (or similar) on the host side and lose
  per-distro attribution.

## Artifacts

- **srum-network-bytes.csv** — per-app, per-user, per-hour
  bytes sent and received (parsed from SRUDB.dat).
- **sysmon-process-create.csv** — Sysmon EID 1 process-create
  events for the relevant window. (Sysmon = Microsoft System
  Monitor, free Windows service that emits structured process /
  network / file events to the Event Log.) Network telemetry
  (EID 3) was NOT enabled.
- **dlp-alert.json** — the DLP alert that started the case.
- **dns-resolver-cache.txt** — host-side DNS cache snapshot
  from the same window (rotates fast — partial coverage only).
- **host-context.json** — host facts (build, SRUM config,
  whether OneDrive sync was active).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "srum-network-bytes.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // srum_dump.py --SRUM_INFILE C:\Cases\WS-W11-008\Windows\System32\SRU\SRUDB.dat
          //               --REG_HIVE     C:\Cases\WS-W11-008\Windows\System32\config\SOFTWARE
          //               --XLSX_OUTFILE srum.xlsx --csv-dir srum-csv/
          // (Excerpt: Network Usage table — `srum-csv/Network Usage.csv`)
          [
            "TimeStamp,AppId,UserId,InterfaceLuid,L2ProfileId,L2ProfileFlags,BytesSent,BytesRecvd",
            "2026-10-14 16:00:00.000,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,4812339,1204088",
            "2026-10-14 17:00:00.000,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,3109001,981240",
            "2026-10-14 18:00:00.000,C:\\Program Files\\Mozilla Firefox\\firefox.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,2204440,18902115",
            "2026-10-14 19:00:00.000,C:\\Program Files\\Mozilla Firefox\\firefox.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,1950000,5201004",
            "2026-10-14 20:00:00.000,C:\\Program Files\\Mozilla Firefox\\firefox.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,398220115,612004",
            "2026-10-14 20:00:00.000,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,2402991,1004558",
            "2026-10-14 21:00:00.000,C:\\Program Files\\Mozilla Firefox\\firefox.exe,S-1-5-21-1111111111-2222222222-3333333333-1404,1689399632298278912,4,0,1400222,3004001",
            "2026-10-14 20:00:00.000,C:\\Windows\\System32\\svchost.exe,S-1-5-18,1689399632298278912,4,0,8400220,9004558",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "sysmon-process-create.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // EvtxECmd.exe -f C:\Cases\WS-W11-008\Sysmon.evtx --inc 1 --csv . --csvf sysmon-eid1.csv
          // (Excerpt: ProcessCreate / EID 1; Sysmon EID 3 NetworkConnect
          //  was disabled on this host by an exclude rule in
          //  C:\Sysmon\sysmon-config.xml, so no EID-3 rows are present.)
          [
            "TimeCreated,EventId,User,Image,CommandLine,ProcessId,ParentImage,ParentCommandLine,IntegrityLevel,Hashes",
            "2026-10-14T15:55:12.4218Z,1,WS-W11-008\\p.singh,C:\\Program Files\\Mozilla Firefox\\firefox.exe,\"\"\"C:\\Program Files\\Mozilla Firefox\\firefox.exe\"\"\",6420,C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,Medium,SHA256=8E3F2D7C1A9B4E6A0C2D5F1B8E3A7F0D2C5B8E1A4F7C0D2B5E8A1F4C7D0B3E6A",
            "2026-10-14T17:02:40.8124Z,1,WS-W11-008\\p.singh,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,\"\"\"C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe\"\" /background\",7912,C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,Medium,SHA256=3D2B1A4C5E6F7081A2B3C4D5E6F708192A3B4C5D6E7F8091A2B3C4D5E6F70819",
            "2026-10-14T19:58:01.1390Z,1,WS-W11-008\\p.singh,C:\\Windows\\System32\\cmd.exe,\"\"\"C:\\Windows\\system32\\cmd.exe\"\"\",10428,C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,Medium,SHA256=ABCDEF01234567890ABCDEF01234567890ABCDEF01234567890ABCDEF0123456",
            "2026-10-14T19:58:30.0419Z,1,WS-W11-008\\p.singh,C:\\Windows\\System32\\robocopy.exe,\"robocopy.exe C:\\Users\\p.singh\\Desktop\\handoff C:\\Users\\p.singh\\OneDrive\\handoff /MIR\",11104,C:\\Windows\\System32\\cmd.exe,\"\"\"C:\\Windows\\system32\\cmd.exe\"\"\",Medium,SHA256=F1E2D3C4B5A69788F1E2D3C4B5A69788F1E2D3C4B5A69788F1E2D3C4B5A69788",
            "2026-10-14T20:01:14.7732Z,1,WS-W11-008\\p.singh,C:\\Users\\p.singh\\Downloads\\cb-uploader.exe,\"\"\"C:\\Users\\p.singh\\Downloads\\cb-uploader.exe\"\" --target wks-archive --bucket personal-2026\",12044,C:\\Windows\\explorer.exe,C:\\Windows\\explorer.exe,Medium,SHA256=DEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "dlp-alert.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              alert_id: "DLP-2026-10-14-1991",
              opened_utc: "2026-10-14T20:48:33Z",
              source: "perimeter-tls-inspector",
              host: "WS-3309",
              user_observed: "p.singh",
              destination_domain: "store.cb-archive.example",
              destination_ip: "203.0.113.77",
              estimated_volume_bytes: 398_000_000,
              policy_violated: "non-sanctioned-cloud-storage",
              note: "Volume estimated from TLS frame sizes; payload not decrypted. Domain not on corporate allow-list.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "dns-resolver-cache.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "C:\\> ipconfig /displaydns",
            "",
            "Windows IP Configuration",
            "",
            "    store.cb-archive.example",
            "    ----------------------------------------",
            "    Record Name . . . . . : store.cb-archive.example",
            "    Record Type . . . . . : 1",
            "    Time To Live  . . . . : 240",
            "    Data Length . . . . . : 4",
            "    Section . . . . . . . : Answer",
            "    A (Host) Record . . . : 203.0.113.77",
            "",
            "",
            "    graph.microsoft.com",
            "    ----------------------------------------",
            "    Record Name . . . . . : graph.microsoft.com",
            "    Record Type . . . . . : 5",
            "    Time To Live  . . . . : 33",
            "    Data Length . . . . . : 8",
            "    Section . . . . . . . : Answer",
            "    CNAME Record  . . . . : graph.microsoft.com.akadns.net",
            "",
            "",
            "    Record Name . . . . . : graph.microsoft.com.akadns.net",
            "    Record Type . . . . . : 1",
            "    Time To Live  . . . . : 33",
            "    Data Length . . . . . : 4",
            "    Section . . . . . . . : Answer",
            "    A (Host) Record . . . : 20.190.190.78",
            "",
            "",
            "# Examiner note (free-form):",
            "#   Snapshot taken at acquisition (2026-10-15T07:12Z). The host",
            "#   resolver cache rotates rapidly — TTLs above are wall-clock",
            "#   remainders, so earlier resolutions of either name may have",
            "#   already aged out before acquisition.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 5,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-3309",
              os: "Windows 11 23H2 (build 22631)",
              user_sid_under_investigation: "S-1-5-21-...-1404",
              user_account: "CORP\\p.singh",
              srum: {
                db_path: "C:\\Windows\\System32\\sru\\SRUDB.dat",
                last_flush_utc: "2026-10-14T22:00:00Z",
                bucket_granularity_minutes: 60,
                retention_observed_days: 31,
              },
              edr: {
                vendor: "MockEDR",
                process_create_enabled: true,
                network_connect_enabled: false,
                note: "Network telemetry was disabled by an exception applied in Q2 to reduce ingest. The exception was never reverted.",
              },
              onedrive: {
                sync_active_during_window: true,
                account: "p.singh@corp.example",
                folders_synced: ["Documents", "Desktop"],
              },
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "srum-egress-indicators",
        displayName: "Indicators bearing on the exfil claim",
        items: [
          {
            id: "firefox-2000-spike",
            label:
              "SRUM shows ~398 MiB sent by firefox.exe under p.singh's SID in the 20:00Z hour bucket — three orders of magnitude above her baseline.",
            evidenceRef: "srum-network-bytes.csv",
          },
          {
            id: "dlp-volume-correlates",
            label:
              "DLP recorded a ~398 MB upload at 20:48Z to a non-sanctioned cloud-storage domain.",
            evidenceRef: "dlp-alert.json",
          },
          {
            id: "cb-uploader-spawned",
            label:
              "Sysmon shows `cb-uploader.exe` spawning from explorer.exe at 20:01Z with `--target wks-archive --bucket personal-2026` on its command line.",
            evidenceRef: "sysmon-process-create.csv",
          },
          {
            id: "dns-cached-archive-host",
            label:
              "DNS resolver cache still contains `store.cb-archive.example` resolved to the DLP-flagged IP.",
            evidenceRef: "dns-resolver-cache.txt",
          },
          {
            id: "robocopy-handoff",
            label:
              "Sysmon shows `robocopy.exe` mirroring `Desktop\\handoff` into the user's OneDrive folder at 19:58Z.",
            evidenceRef: "sysmon-process-create.csv",
          },
          {
            id: "onedrive-active",
            label:
              "OneDrive sync was active on this account during the window.",
            evidenceRef: "host-context.json",
          },
          {
            id: "srum-no-destinations",
            label:
              "SRUM records bytes per process but no destination addresses.",
            evidenceRef: "srum-network-bytes.csv",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "From SRUM + Sysmon + DLP, which statements are **proven**?",
        options: [
          {
            id: "firefox-bytes-spike",
            label:
              "Firefox running under p.singh's SID sent ~398 MiB outbound in the 20:00–21:00Z hour bucket on 2026-10-14.",
          },
          {
            id: "firefox-to-cb",
            label:
              "Firefox sent those bytes specifically to `store.cb-archive.example`.",
          },
          {
            id: "cb-uploader-process-spawned",
            label:
              "A binary named `cb-uploader.exe` was launched under p.singh's account at 20:01:14Z with a command line referencing a `wks-archive` target.",
          },
          {
            id: "robocopy-handoff-fact",
            label:
              "`robocopy` mirrored `C:\\Users\\p.singh\\Desktop\\handoff` into her OneDrive folder at 19:58Z.",
          },
          {
            id: "exfil-by-cb-uploader",
            label:
              "`cb-uploader.exe` is the process that performed the 398 MiB upload.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "firefox-bytes-spike",
            "cb-uploader-process-spawned",
            "robocopy-handoff-fact",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven from the artifacts as written:**",
          "",
          "- The SRUM row attributes ~398 MiB sent in the 20:00Z bucket to `firefox.exe` under p.singh's SID.",
          "- Sysmon EID 1 directly records the `cb-uploader.exe` and `robocopy.exe` spawns with their command lines.",
          "",
          "**Common over-claims (NOT proven):**",
          "",
          "- *Firefox sent the bytes to `store.cb-archive.example`* — SRUM does NOT record destinations. The DLP alert is independent: it ties the host's outbound TLS volume to that destination, but doesn't authoritatively pin which process owned the socket. The most you can say is that the volumes are *consistent* — firefox is the **candidate** source.",
          "- *cb-uploader.exe performed the upload* — SRUM attributes the 398 MiB bucket to `firefox.exe`, not to `cb-uploader.exe`. The `cb-uploader.exe` spawn at 20:01Z is a strong lead and the command line is suggestive, but SRUM did not record it as a network sender in this bucket. (Hour-bucket boundary or a process-name discrepancy could explain it. Either way, *proof* of which process did the upload is not in these artifacts.)",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "srum-egress-indicators",
        promptMd:
          "Select the indicators that **directly increase** confidence that p.singh exfiltrated data via the 20:00Z TLS upload to `store.cb-archive.example`. (Pick everything that helps tie the action to the user + the destination.)",
        expected: {
          type: "select_indicators",
          correctIds: [
            "firefox-2000-spike",
            "dlp-volume-correlates",
            "cb-uploader-spawned",
            "dns-cached-archive-host",
          ],
        },
        debriefMd: [
          "**Helpful:**",
          "",
          "- The SRUM volume spike, the DLP volume + destination, the `cb-uploader.exe` spawn under her SID, and the DNS cache showing the destination was resolved on this host all tie the action to user + destination.",
          "",
          "**Distractors:**",
          "",
          "- *Robocopy to OneDrive* — that's an internal copy. It corroborates intent to stage files but is a corporate-sanctioned destination; it doesn't help prove exfil to the unsanctioned bucket.",
          "- *OneDrive sync was active* — same: corporate-sanctioned channel. Background.",
          "- *SRUM has no destinations* — this is a **limitation** of SRUM. It explains why one direct link is missing; it doesn't itself raise confidence the exfil happened.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which next investigative step would most directly resolve the *which-process-owned-the-socket* gap left by SRUM?",
        options: [
          {
            id: "enable-edr-netconn-retro",
            label:
              "Look for any historical EDR / Sysmon network-connect records you might have on the perimeter or on adjacent hosts — even though local EID 3 was off.",
          },
          {
            id: "pull-perimeter-netflow",
            label:
              "Pull perimeter NetFlow / proxy logs for the 20:00–21:00Z window and correlate source-port + 5-tuple to the host's process socket map captured at acquisition.",
          },
          {
            id: "open-edb-by-hand",
            label:
              "Re-parse `SRUDB.dat` byte-by-byte to recover destination IPs that the published SRUM schema doesn't expose.",
          },
          {
            id: "ask-user",
            label:
              "Ask the user.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["enable-edr-netconn-retro", "pull-perimeter-netflow", "ask-user"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Helpful next steps:**",
          "",
          "- Perimeter NetFlow / proxy logs are the canonical fix for missing host-side network telemetry: they record the 5-tuple and the volumes for every flow, independent of host EDR config. Correlating to the host's socket state at acquisition gives you process attribution.",
          "- Adjacent EDR coverage (peer endpoints, server-side connections to known infrastructure) sometimes yields the missing link.",
          "- Interviewing the user is the cheapest, fastest disconfirming step and is appropriate once the volume + destination are independently established.",
          "",
          "**Not helpful:**",
          "",
          "- *Re-parsing SRUDB.dat for hidden destinations* — there are no destination fields in the SRUM schema. The data isn't there to recover.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that p.singh **personally caused** the 398 MiB outbound flow to `store.cb-archive.example` at ~20:00Z on 2026-10-14, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3–4.** The volume + per-user SRUM bucket + DNS cache + DLP destination + a custom-looking uploader binary spawning under her shell session at 20:01Z is a coherent story, but several gaps remain: SRUM attributes the bytes to `firefox.exe`, not to `cb-uploader.exe`; no process-to-socket correlation captures *which* process owned the TLS connection; user could have left her session unlocked. A *5* would require either perimeter NetFlow + host socket map correlation or an EDR network-connect record naming the process. Stop at 3–4 until that comes in.\n\n**Don't yet claim:** that *cb-uploader.exe* owned the upload (SRUM contradicts), that the upload contained sensitive material (SRUM is byte-counts, not payload), or personal action by the named user (session-vs-keyboard not yet established). **Owners:** unit ISSM owns incident handling under AR 25-2; supporting ACI under AR 381-12 para 4-6 (Army Insider Threat Program).",
      },
    ],
  },

  // ─── Difficulty 4 — new artifact class, lots of caveats ──────
  {
    slug: "win11-recall-snapshot-evidence-001",
    title: "Windows 11 Microsoft Recall: Snapshot DB Forensics",
    summary:
      "Copilot+ PCs running 24H2+ may have Recall enabled — periodic screenshots + OCR text indexed in a local SQLite DB. Decide what it actually proves and where it must NOT be used.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 4,
    estimatedMinutes: 35,
    tags: [
      "dfir",
      "windows11",
      "windows_artifacts",
      "df_artifacts",
      "inference_discipline",
      "recall",
    ],
    lane: "windows_artifacts",
    module: "Windows 11 specifics",
    sequence: 5,
    brief: `
# Brief

The host is a Win11 24H2 Copilot+ laptop assigned to user
\`s.kowalski\`. Recall — Microsoft's local screenshot +
OCR-index feature — is enabled, and the index database is
present at:

\`%LOCALAPPDATA%\\CoreAIPlatform.00\\UKP\\{guid}\\ukg.db\`

Snapshot images live alongside it. The DB schema records, for
each snapshot: timestamp, foreground app, window title, and the
OCR'd text content extracted from the snapshot.

This is a **very rich** artifact. It is also a magnet for
over-claims. Before you let it into a writeup, you have to be
clear-headed about:

1. **What Recall captures**: foreground window snapshots on a
   throttled cadence (every few seconds when activity is
   detected). Excluded apps and InPrivate browsing windows are
   skipped. The user can pause Recall at any time.
2. **What "OCR text contains X" actually proves**: the string
   was visible on-screen at the snapshot time. It does NOT
   prove the user read it, understood it, sent it, or that it
   came from a file under that user's control.
3. **Where Recall data is admissible at all**: jurisdiction-
   and policy-dependent. Treat it like any other intimate
   activity log — narrowest possible scope, redact aggressively,
   coordinate with OSJA / supporting trial counsel before
   referencing in any external product, and apply the storage +
   handling rules for digital-media evidence on the imaged DB.

## Artifacts

- **recall-snapshot-index.csv** — parsed index rows: snapshot
  id, captured time, app, window title, OCR text length.
- **recall-snapshot-0991-ocr.txt** — full OCR text from one
  snapshot of interest.
- **recall-config.json** — Recall enable state, excluded apps,
  retention, paused-window log.
- **host-context.json** — device + acquisition facts.

If on-screen content includes classified or controlled material,
the incident sits in the *unauthorized-disclosure* family of
reportable counterintelligence concerns; whether it rises to
*deliberate security compromise* turns on intent, which Recall
pixels cannot establish on their own.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "recall-snapshot-index.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "snapshot_id,captured_utc,app,window_title,ocr_text_len_chars",
            "0987,2026-11-02T09:14:11Z,outlook.exe,Inbox — s.kowalski,1804",
            "0988,2026-11-02T09:14:18Z,outlook.exe,RE: Q4 forecast — s.kowalski,2204",
            "0989,2026-11-02T09:15:01Z,WINWORD.EXE,Q4-forecast-draft.docx — Word,3402",
            "0990,2026-11-02T09:16:44Z,WINWORD.EXE,Q4-forecast-draft.docx — Word,3580",
            "0991,2026-11-02T09:18:02Z,msedge.exe,Compose — Personal Mail,1108",
            "0992,2026-11-02T09:18:30Z,msedge.exe,Sent — Personal Mail,902",
            "(snapshot index excerpt; rows above span ~4 minutes of foreground activity)",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "recall-snapshot-0991-ocr.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Snapshot 0991  —  msedge.exe  —  \"Compose — Personal Mail\"  —  2026-11-02T09:18:02Z",
            "------------------------------------------------------------------------------------",
            "",
            "(Reconstructed OCR text. Layout approximation only — the original",
            "image is the canonical artifact. Misreads are possible — \"l\" vs",
            "\"1\", \"O\" vs \"0\", etc.)",
            "",
            "To:    s.kowalski.personal@webmail.example",
            "From:  s.kowalski@corp.example",
            "Subj:  Q4 backup",
            "",
            "fyi, attaching the q4 forecast draft so I can read on the train.",
            "[paperclip] Q4-forecast-draft.docx  (147 KB)",
            "",
            "Send       Discard       Schedule",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "recall-config.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              recall_enabled: true,
              enrollment: "Windows Hello (face) — present",
              vbs_state: "active",
              storage_pool: "%LOCALAPPDATA%\\CoreAIPlatform.00\\UKP\\{guid}",
              retention_days_observed: 21,
              excluded_apps: ["KeePassXC.exe", "1Password.exe"],
              private_browsing_excluded_by_default: true,
              paused_windows_observed: [
                {
                  start_utc: "2026-11-02T09:30:00Z",
                  end_utc: "2026-11-02T09:55:00Z",
                  reason: "user-pause via system tray",
                },
              ],
              note: "Recall is opt-in on this build; user enabled it during initial setup. Excluded apps and InPrivate / Private browsing windows are not snapshotted.",
            },
            null,
            2,
          ) + "\n",
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
              host: "LT-COPLT-118",
              os: "Windows 11 24H2 Copilot+ (build 26120)",
              user: "CORP\\s.kowalski",
              hardware: "Snapdragon X — NPU present",
              acquired_utc: "2026-11-03T14:00:00Z",
              note: "Recall DB acquired via cold-acquisition of the BitLocker volume + offline VBS key escrow. Live-system access to Recall data requires Windows Hello unlock.",
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
          "From the index + the OCR extract of snapshot 0991, which statements are **proven**?",
        options: [
          {
            id: "compose-window-on-screen",
            label:
              "At 2026-11-02T09:18:02Z, the Edge browser foreground window was a Personal Mail compose page containing the text and recipient shown in the OCR extract.",
          },
          {
            id: "user-sent-email",
            label:
              "The user pressed Send and the email was delivered.",
          },
          {
            id: "attachment-actually-sent",
            label:
              "`Q4-forecast-draft.docx` was successfully attached and uploaded to the webmail provider.",
          },
          {
            id: "word-doc-open-before",
            label:
              "Just before this snapshot, the user had `Q4-forecast-draft.docx` open in Word (snapshots 0989 and 0990 show the same window title in WINWORD.EXE).",
          },
          {
            id: "user-read-the-text",
            label:
              "The user read and understood the displayed message.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["compose-window-on-screen", "word-doc-open-before"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- The compose window's *visible state* at that timestamp is what Recall captured. The OCR extract is direct evidence the message + recipient were on-screen at that moment.",
          "- Two prior snapshots show the same Word document title in the foreground — Word was the foreground app immediately before Edge.",
          "",
          "**NOT proven:**",
          "",
          "- *Send* — Recall captures snapshots, not button events. The next snapshot (0992) is a Sent-folder window; that's stronger but still circumstantial without the mail provider's own send log. \"Sent\" view could be a different sent message.",
          "- *Attachment uploaded* — Recall sees pixels, not network. To prove the file left the host, correlate with SRUM, EDR network telemetry, proxy/perimeter logs, or the provider's record.",
          "- *User read / understood the text* — being on-screen is not reading. The user could be away from the keyboard, the window could have just popped to foreground from an autosave action, etc. Reserve any *intent* claim for evidence that captures user input (typing cadence, mouse, biometric).",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Recall config shows a paused window 09:30Z–09:55Z and `KeePassXC.exe` in the excluded-app list. Which conclusions are **safe**?",
        options: [
          {
            id: "no-snapshots-during-pause",
            label:
              "No Recall snapshots were captured between 09:30Z and 09:55Z on 2026-11-02.",
          },
          {
            id: "nothing-happened-during-pause",
            label:
              "Nothing of investigative interest happened between 09:30Z and 09:55Z on the host.",
          },
          {
            id: "no-keepass-snapshots",
            label:
              "No Recall snapshots were ever captured of KeePassXC windows on this host (config excludes the app).",
          },
          {
            id: "user-hiding-something",
            label:
              "The user paused Recall in order to hide activity from a future forensic review.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["no-snapshots-during-pause", "no-keepass-snapshots"],
          allowMultiple: true,
        },
        debriefMd: [
          "Pause + excluded-app config are factual statements about Recall's behaviour: no snapshots during the pause window; no snapshots of excluded-app foreground state. Those are safe.",
          "",
          "**Over-claims:**",
          "",
          "- *Nothing happened* — Recall is one of many evidence sources. EDR, browser history, network telemetry continue to record during a Recall pause.",
          "- *User paused to hide activity* — possible motive, not proven. Recall is intrusive enough that users pause it for benign reasons (entering credentials, video calls, personal browsing). Don't impute intent from pause alone.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What handling discipline should a Recall extract get when included in a writeup?",
        options: [
          {
            id: "redact-non-pertinent",
            label:
              "Redact all OCR text and snapshots that aren't directly pertinent to the finding. Recall captures everything in the foreground — most of it is irrelevant and intimate.",
          },
          {
            id: "legal-policy-review",
            label:
              "Coordinate with legal / privacy before referencing Recall data in any product that leaves the case file, and document the legal basis for review.",
          },
          {
            id: "include-everything",
            label:
              "Include the full snapshot index in the writeup so the reader has full context.",
          },
          {
            id: "ocr-as-truth",
            label:
              "Quote OCR text as if it were the verbatim contents of the underlying document — OCR is high-accuracy on screenshots.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["redact-non-pertinent", "legal-policy-review"],
          allowMultiple: true,
        },
        debriefMd: [
          "Recall is uniquely intrusive: a full index leaks everything the user did in the foreground, including personal email, medical portals, banking sessions, etc. The hygiene rules are: minimum-necessary scope, redact, legal coordination, and citation only of snapshots directly supporting the finding.",
          "",
          "OCR text is *secondary* evidence — useful for indexing and for direct quotes when the meaning is unambiguous, but the snapshot image itself is canonical. OCR misreads (\"l\" vs \"1\", spacing artifacts) are common; always cite the snapshot id so the reader can re-render the image if a quote is challenged.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the user sent `Q4-forecast-draft.docx` to her personal webmail in this session, based ONLY on the Recall artifacts.",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**3 (or thereabouts).** The compose snapshot shows the message + attachment indicator + the destination address in the foreground, and the next snapshot shows a Sent folder view. That's a strong on-screen sequence. It is NOT proof the email left the host — Recall doesn't see network. To get to 5, corroborate with SRUM bytes during this window, a webmail-provider send log, or perimeter telemetry showing the upload. The disciplined report says \"on-screen evidence consistent with sending\" at this confidence band, and lists the corroboration the analyst needs to firm it up.",
      },
    ],
  },

  // ─── Difficulty 4 — abstraction-boundary trap ────────────────
  {
    slug: "win11-wsl2-host-visibility-001",
    title: "Windows 11 WSL2: What The Host Actually Sees",
    summary:
      "WSL2 is a managed VM. The host sees a lot — and a lot less than analysts assume. Reason carefully about what each Windows-side artifact does and does not prove about activity inside the Linux distro.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 4,
    estimatedMinutes: 35,
    tags: [
      "dfir",
      "windows11",
      "windows_artifacts",
      "df_artifacts",
      "inference_discipline",
      "wsl",
    ],
    lane: "windows_artifacts",
    module: "Windows 11 specifics",
    sequence: 6,
    brief: `
# Brief

A Win11 workstation belonging to a DA-civilian developer
(\`a.romero\`) is under review after an alert about anomalous
SSH activity from the unit egress. The host has WSL2 installed
with two distros (\`Ubuntu-22.04\` and \`kali-linux\`). The user
claims they "barely use WSL." The alert references SSH
connections originating from the workstation's public-facing IP
to an external address at \`198.51.100.23\`.

The activity sits in the *unauthorized-AIS-access / unauthorized-
egress* family of reportable cyberspace incidents; that's a
reporting question, not the question you're working today. Today's
question is *actor + intent*, which the host-side artifacts only
partially address.

You have host-side artifacts only — no in-VM acquisition has
been performed yet. Your job is to determine **what the host
artifacts can actually establish** before deciding whether to
shut down WSL and mount the ext4 VHDX.

## Architecture refresher

WSL2 runs each Linux distro inside a lightweight utility VM
hosted by \`vmcompute.exe\` (the Hyper-V host-compute service).
Each distro is a single \`ext4.vhdx\` file under:

\`%LOCALAPPDATA%\\Packages\\<distro-package>\\LocalState\\ext4.vhdx\`

The VHDX is **locked while the distro is running**. Network
traffic from inside the distro NATs through the WSL Hyper-V
virtual switch and appears on the wire as the host's IP.

## Artifacts

- **prefetch-wsl-excerpt.txt** — Prefetch entries for WSL-
  related binaries on the host.
- **registry-installed-distros.json** — \`HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss\`
  excerpt showing installed distros + base paths.
- **vhdx-listing.txt** — directory listing of the WSL package
  storage folders, with file sizes + modified times.
- **sysmon-host-events.csv** — Sysmon EID 1 / EID 3 events
  relevant to WSL on the **host** (Sysmon installed on the
  Windows side only).
- **perimeter-flow-record.json** — perimeter NetFlow record
  for the SSH connection to \`198.51.100.23\`.
- **host-context.json** — host facts.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "prefetch-wsl-excerpt.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "PECmd version 1.5.0.0",
            "",
            "Author: Eric Zimmerman (saericzimmerman@gmail.com)",
            "https://github.com/EricZimmerman/PECmd",
            "",
            "Command line: PECmd.exe -d C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch -k wsl,vmcompute --csv C:\\Cases\\WS-W11-008\\Out --csvf wsl-prefetch.csv",
            "",
            "Keywords: wsl, vmcompute",
            "",
            "Processing C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch\\WSL.EXE-AABBCC01.pf",
            "Source file: C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch\\WSL.EXE-AABBCC01.pf",
            "  Source created : 2026-09-10 13:00:01",
            "  Source modified: 2026-11-04 22:14:08",
            "  Source accessed: 2026-11-04 22:14:08",
            "",
            "  Executable name : WSL.EXE",
            "  Hash            : AABBCC01",
            "  File size       : 41,984 bytes",
            "  Version         : Windows 10 or Windows 11",
            "",
            "  Run count       : 41",
            "  Last run        : 2026-11-04 22:14:08",
            "  Previous run 0  : 2026-11-04 12:08:11",
            "  Previous run 1  : 2026-11-03 19:42:33",
            "  Previous run 2  : 2026-11-02 09:11:55",
            "",
            "Processing C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch\\WSLHOST.EXE-AABBCC02.pf",
            "Source file: C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch\\WSLHOST.EXE-AABBCC02.pf",
            "  Source created : 2026-09-10 13:00:02",
            "  Source modified: 2026-11-04 22:14:09",
            "  Source accessed: 2026-11-04 22:14:09",
            "",
            "  Executable name : WSLHOST.EXE",
            "  Hash            : AABBCC02",
            "  File size       : 38,400 bytes",
            "  Version         : Windows 10 or Windows 11",
            "",
            "  Run count       : 41",
            "  Last run        : 2026-11-04 22:14:09",
            "",
            "Processing C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch\\VMCOMPUTE.EXE-AABBCC03.pf",
            "Source file: C:\\Cases\\WS-W11-008\\C\\Windows\\Prefetch\\VMCOMPUTE.EXE-AABBCC03.pf",
            "  Source created : 2026-09-10 12:59:55",
            "  Source modified: 2026-11-04 22:14:07",
            "  Source accessed: 2026-11-04 22:14:07",
            "",
            "  Executable name : VMCOMPUTE.EXE",
            "  Hash            : AABBCC03",
            "  File size       : 28,672 bytes",
            "  Version         : Windows 10 or Windows 11",
            "",
            "  Run count       : 187",
            "  Last run        : 2026-11-04 22:14:07",
            "",
            "  # Examiner note: VMCOMPUTE.EXE is the Host Compute Service —",
            "  # WSL2 + Hyper-V + Sandbox + Containers all start this service.",
            "  # Run-count here is cumulative service starts, NOT user-",
            "  # initiated WSL invocations.",
            "",
            "---------- Processed 3 files in 0.082 seconds ----------",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "registry-installed-distros.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              source: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss (parsed)",
              distros: [
                {
                  guid: "{c11a8e23-3a4b-4f6d-8e91-2a8b1e9a0c12}",
                  name: "Ubuntu-22.04",
                  base_path: "%LOCALAPPDATA%\\Packages\\CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\\LocalState",
                  default_uid: 1000,
                  state: "stopped",
                },
                {
                  guid: "{1f9e7d2c-5a6b-49c1-9a14-7c8d2e1b3f44}",
                  name: "kali-linux",
                  base_path: "%LOCALAPPDATA%\\Packages\\KaliLinux.54290C8133FEE_ey8k8hqnwqnmg\\LocalState",
                  default_uid: 1000,
                  state: "stopped",
                },
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "vhdx-listing.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "PS C:\\Cases\\WS-W11-008\\C\\Users\\a.romero\\AppData\\Local\\Packages> Get-ChildItem -Path . -Recurse -Filter 'ext4.vhdx' | Format-Table FullName,Length,LastWriteTimeUtc,Mode",
            "",
            "FullName                                                                                                                                Length LastWriteTimeUtc        Mode",
            "--------                                                                                                                                ------ ----------------        ----",
            "C:\\Cases\\WS-W11-008\\C\\Users\\a.romero\\AppData\\Local\\Packages\\CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\\LocalState\\ext4.vhdx 9812345344 11/4/2026 10:14:00 PM   -a----",
            "C:\\Cases\\WS-W11-008\\C\\Users\\a.romero\\AppData\\Local\\Packages\\KaliLinux.54290C8133FEE_ey8k8hqnwqnmg\\LocalState\\ext4.vhdx              3220115456 11/4/2026 10:13:58 PM   -a----",
            "",
            "",
            "PS C:\\> Get-DiskImage -ImagePath 'C:\\Cases\\WS-W11-008\\C\\Users\\a.romero\\AppData\\Local\\Packages\\KaliLinux.54290C8133FEE_ey8k8hqnwqnmg\\LocalState\\ext4.vhdx' | Format-List",
            "",
            "Attached          : False",
            "BlockSize         : 0",
            "DevicePath        :",
            "FileSize          : 3220115456",
            "ImagePath         : C:\\Cases\\WS-W11-008\\C\\Users\\a.romero\\AppData\\Local\\Packages\\KaliLinux.54290C8133FEE_ey8k8hqnwqnmg\\LocalState\\ext4.vhdx",
            "LogicalSectorSize : 512",
            "Number            :",
            "Size              : 274877906944",
            "StorageType       : 3 (VHDX)",
            "PSComputerName    :",
            "",
            "",
            "# Examiner notes (free-form):",
            "#   - VHDX LastWriteTimeUtc reflects the last time the file was",
            "#     open + written to (i.e. the last time the distro was running",
            "#     and writing to its filesystem).",
            "#   - The on-disk `Size` field above (274 GB) is the VHDX maximum,",
            "#     not the allocated bytes (`FileSize` ~ 3.2 GB). VHDX is",
            "#     thin-provisioned and grows as the distro fills.",
            "#   - VHDX does NOT shrink on file deletion inside the VM (no",
            "#     TRIM passthrough by default).",
            "#   - File contents are NOT readable from the host without",
            "#     mounting the VHDX (must be done with the distro stopped).",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "sysmon-host-events.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // EvtxECmd.exe -f C:\Cases\WS-W11-008\Sysmon.evtx --inc 1,3 --csv . --csvf sysmon-host.csv
          // (Excerpt: Sysmon EID 1 ProcessCreate + EID 3 NetworkConnect.
          //  Sysmon runs on the WINDOWS host; it cannot see processes
          //  inside the WSL2 utility VM. The EID-3 connections below
          //  are attributed to vmcompute.exe, the Host Compute Service,
          //  because that's the kernel-side socket owner — not because
          //  vmcompute.exe initiated the connection itself.)
          [
            "TimeCreated,EventId,User,Image,CommandLine,DestinationIp,DestinationPort,Protocol,Initiated",
            "2026-11-04T22:14:08.4912Z,1,WS-W11-008\\a.romero,C:\\Windows\\System32\\wsl.exe,\"wsl -d kali-linux\",,,,",
            "2026-11-04T22:14:09.0118Z,1,NT AUTHORITY\\SYSTEM,C:\\Windows\\System32\\wslhost.exe,\"\\\"C:\\Windows\\System32\\wslhost.exe\\\" {a8e4...} 1212 0 ...\",,,,",
            "2026-11-04T22:14:35.8210Z,3,NT AUTHORITY\\SYSTEM,C:\\Windows\\System32\\vmcompute.exe,,198.51.100.23,22,tcp,true",
            "2026-11-04T22:14:35.9442Z,3,NT AUTHORITY\\SYSTEM,C:\\Windows\\System32\\vmcompute.exe,,140.82.121.4,443,tcp,true",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "perimeter-flow-record.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              flow_id: "NF-2026-11-04-559921",
              start_utc: "2026-11-04T22:14:35Z",
              end_utc: "2026-11-04T22:31:08Z",
              src_ip: "203.0.113.55",
              src_ip_attribution: "Workstation WS-7711 (a.romero) — corporate DHCP",
              src_port_observed: 51884,
              dst_ip: "198.51.100.23",
              dst_port: 22,
              proto: "tcp",
              bytes_sent: 18_004_222,
              bytes_recv: 1_204_115,
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 6,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-7711",
              os: "Windows 11 23H2 (build 22631)",
              user: "CORP\\a.romero",
              wsl_kernel_version: "5.15.153.1-microsoft-standard-WSL2",
              acquired_utc: "2026-11-05T09:00:00Z",
              edr: "host-side Sysmon only",
              note: "No EDR / monitoring agent installed inside either WSL distro. Distro acquisitions have NOT been performed.",
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
          "Which statements about WSL activity on this host are **proven** by the host-side artifacts as written?",
        options: [
          {
            id: "wsl-launched",
            label:
              "User a.romero launched `wsl -d kali-linux` at 2026-11-04T22:14:08Z (Sysmon EID 1 + Prefetch corroborate).",
          },
          {
            id: "kali-vhdx-written",
            label:
              "The kali-linux `ext4.vhdx` was being modified through ~2026-11-04T22:13:58Z, consistent with the distro running.",
          },
          {
            id: "ssh-from-kali",
            label:
              "An SSH client running *inside* the kali-linux distro made the outbound connection to 198.51.100.23.",
          },
          {
            id: "ssh-from-windows",
            label:
              "A Windows-side `ssh.exe` process made the outbound connection.",
          },
          {
            id: "vmcompute-owns-socket",
            label:
              "On the host, the TCP connection to 198.51.100.23:22 is attributed to `vmcompute.exe`.",
          },
          {
            id: "no-ssh-elsewhere",
            label:
              "No SSH activity occurred from this host outside the kali-linux distro.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["wsl-launched", "kali-vhdx-written", "vmcompute-owns-socket"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven from host-side artifacts:**",
          "",
          "- The `wsl -d kali-linux` launch is directly recorded.",
          "- The kali VHDX was being written to inside the relevant minute (last-modified ~22:13:58Z).",
          "- On the host, the outbound TCP to :22 is attributed to `vmcompute.exe`.",
          "",
          "**NOT proven:**",
          "",
          "- *SSH was run inside kali (vs. Ubuntu, vs. another route)* — Sysmon does NOT see processes inside the utility VM. Both distros were launched in close succession in similar past sessions; vmcompute.exe attribution is correct but ambiguous between WSL distros. To pin the source process, the distro must be acquired (stop WSL, mount VHDX read-only, inspect ~/.bash_history, /var/log/wtmp, etc.).",
          "- *Windows-side `ssh.exe`* — no Prefetch / Sysmon for `ssh.exe` is shown. The flow is attributed to vmcompute, which is consistent with a WSL-origin connection.",
          "- *No SSH activity elsewhere* — absence of evidence; the artifacts only cover this window.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What's the right next step to firm up the in-VM picture?",
        options: [
          {
            id: "stop-wsl-mount",
            label:
              "Stop WSL (`wsl --shutdown`), then mount each distro's `ext4.vhdx` read-only on an analyst host and inspect `~/.bash_history`, `/var/log/auth.log` (if persisted), `/etc/hosts`, and SSH key material.",
          },
          {
            id: "snap-host",
            label:
              "Take an additional host-level disk image — there's nothing more inside the WSL VMs that the host doesn't already have.",
          },
          {
            id: "live-vm-acquire",
            label:
              "Live-acquire each running distro before shutting WSL down, since the VHDX is locked while running and important volatile data lives in `/proc`, `/tmp`, kernel state, and any unflushed bash history.",
          },
          {
            id: "tap-network",
            label:
              "Deploy a perimeter packet capture next time the host is online to capture the SSH session; SSH is encrypted, so TLS-style content recovery isn't applicable.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["stop-wsl-mount", "live-vm-acquire"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Helpful:**",
          "",
          "- Live acquisition of the running distro captures volatile state (running processes, in-memory environment, current bash session). The user may have an in-progress session whose history isn't yet flushed. Sequence acquisitions so the receiving evidence custodian can document them on a single **DA Form 4137** with continuation pages for each artifact type.",
          "- Cold acquisition of the VHDX (with WSL stopped) gives you on-disk truth: bash history, persisted auth logs, SSH keys, etc. The two together cover the gap.",
          "",
          "**Not helpful:**",
          "",
          "- *Another host image* — won't see anything new; the VHDX is opaque from the host without mounting.",
          "- *Capture future traffic* — separate question (and SSH is encrypted, so it gives you metadata only). It doesn't help confirm what already happened.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Why is the perimeter flow record (`vmcompute.exe`, src_port 51884, dst :22) consistent with WSL2 SSH but not in itself proof?",
        options: [
          {
            id: "vmcompute-shared",
            label:
              "`vmcompute.exe` is the Hyper-V host-compute service; ANY utility VM (any WSL distro, any Hyper-V VM) traverses it on the host side. The attribution is correct but coarse-grained — it doesn't distinguish between distros or between WSL and other Hyper-V usage.",
          },
          {
            id: "src-port-not-stable",
            label:
              "Ephemeral source ports rotate per-connection. The 51884 here is unique to this flow but doesn't carry process identity.",
          },
          {
            id: "vmcompute-fake",
            label:
              "Attribution to `vmcompute.exe` is a forensic artifact of the EDR and doesn't mean a real process owned the socket.",
          },
          {
            id: "no-other-hyperv-on-this-host",
            label:
              "On this host, the only Hyper-V tenant is WSL — so vmcompute.exe attribution narrows the candidates to WSL distros, which is consistent with the alert but doesn't pin which distro.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["vmcompute-shared", "src-port-not-stable", "no-other-hyperv-on-this-host"],
          allowMultiple: true,
        },
        debriefMd: [
          "vmcompute.exe attribution is real (the EDR is correct), but it's the host-side abstraction layer for every utility VM. On a host running only WSL, that narrows the candidate to WSL distros — useful. Pinning the specific distro and the specific in-VM process still requires VHDX acquisition (cold) or in-VM live triage. The over-claim to avoid: \"vmcompute.exe owned the socket\" written in a way that implies a particular WSL distro made the connection.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the user a.romero **personally initiated** the SSH session to 198.51.100.23, based ONLY on the artifacts shown.",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**3 (or so).** wsl -d kali-linux was launched under her account 27 seconds before the SSH flow began. That's strong, but it stops short of identifying the in-VM actor (could be a user-typed `ssh`, an unattended cron / service inside the distro, a stored agent). To get to 4 or 5, mount the VHDX and look at `~/.bash_history`, `/etc/ssh/*`, `~/.ssh/known_hosts`, scheduled jobs, and the SSH client config. Pair with the user interview.",
      },
    ],
  },

  // ─── Difficulty 5 — capstone, multi-artifact synthesis ───────
  {
    slug: "win11-insider-exfil-capstone-001",
    title: "Windows 11 Capstone: Insider Exfil, Multi-Artifact Synthesis",
    summary:
      "A leaving employee, a curated set of host artifacts, and a 24-hour deadline. Read every artifact for what it does and does not prove, rank the evidence, and write a finding you can defend in a deposition.",
    skillAreas: [
      "df_artifacts",
      "windows_artifacts",
      "removable_media",
      "network_logs",
      "report_writing",
      "inference_discipline",
    ],
    difficulty: 5,
    estimatedMinutes: 75,
    tags: [
      "dfir",
      "windows11",
      "windows_artifacts",
      "df_artifacts",
      "removable_media",
      "network_logs",
      "report_writing",
      "inference_discipline",
      "insider_risk",
      "capstone",
    ],
    lane: "windows_artifacts",
    module: "Capstone",
    sequence: 1,
    brief: `
# Brief

\`d.becker\` is a DA-civilian sales engineer who submitted notice
two weeks ago. Friday is her last day; today is Wednesday. The
unit security manager forwarded a LinkedIn announcement
indicating the new role at a competitor starts in 9 days and the
job description names emerging-technology areas your unit works.

The case sits at the intersection of the *theft / loss / diversion*
and *data-exfiltration* families of reportable concerns and is
being handled in the Army Insider Threat Program lane. The local
OSJA / supporting trial counsel has authorized a non-intrusive
host review:

1. Determine whether the evidence supports a claim of
   unauthorized data movement off the unit workstation.
2. Quantify the confidence band honestly. Counsel will use the
   report to decide whether to pursue further measures; an
   over-claim poisons the case.
3. List investigative gaps and what would close them.

You have a curated subset of artifacts from Win11 host
\`WS-AURORA-19\` covering the trailing 14 days. Each artifact
extract was logged on **DA Form 4137 #4137-2026-411-A** with the
DFE's hash + timestamps annotated on a continuation page. There
is no EDR network telemetry on this host (an exception). Host-
side process create is enabled. Perimeter NetFlow is available
through the proxy team but has NOT been pulled for this case
yet.

## Artifacts

- **bam-trailing-14d.csv** — BAM rows for d.becker's SID over
  the trailing 14 days.
- **srum-network-bytes.csv** — SRUM per-app hourly bytes for
  the same window.
- **prefetch-summary.txt** — Prefetch entries for binaries of
  interest.
- **usb-mount-history.csv** — registry-derived removable-media
  mount history.
- **onedrive-sync-log.txt** — per-file sync events from the
  OneDrive client log for d.becker's mapped account.
- **activitiescache-excerpt.csv** — \`ActivitiesCache.db\`
  entries showing recent files / apps. (Note: Timeline cloud
  sync was disabled by GP in this org; the DB is local-only.)
- **usn-journal-excerpt.csv** — NTFS USN journal entries for
  the user profile directory.
- **email-export-of-interest.eml.txt** — text view of one
  outgoing email of interest pulled from Exchange.
- **host-context.json** — host facts + telemetry coverage map.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "bam-trailing-14d.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "sid,nt_path,last_execution_utc",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Users\\d.becker\\Downloads\\7z2400-x64.exe,2026-11-29T16:14:08Z",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Program Files\\7-Zip\\7zG.exe,2026-12-02T18:50:01Z",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Windows\\System32\\cmd.exe,2026-12-02T19:02:11Z",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Windows\\System32\\robocopy.exe,2026-12-02T19:04:33Z",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Users\\d.becker\\OneDrive\\OneDrive.exe,2026-12-02T19:06:50Z",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Users\\d.becker\\Downloads\\rclone.exe,2026-12-03T20:18:22Z",
            "S-1-5-21-...-1822,\\Device\\HarddiskVolume3\\Program Files\\Mozilla Firefox\\firefox.exe,2026-12-03T21:35:55Z",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "srum-network-bytes.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // srum_dump.py --SRUM_INFILE C:\Cases\WS-BECKER\Windows\System32\SRU\SRUDB.dat
          //               --REG_HIVE     C:\Cases\WS-BECKER\Windows\System32\config\SOFTWARE
          //               --csv-dir srum-csv/
          // (Excerpt: Network Usage table — `srum-csv/Network Usage.csv`)
          [
            "TimeStamp,AppId,UserId,InterfaceLuid,L2ProfileId,L2ProfileFlags,BytesSent,BytesRecvd",
            "2026-12-02 18:00:00.000,C:\\Program Files\\7-Zip\\7zG.exe,S-1-5-21-1111111111-2222222222-3333333333-1822,1689399632298278912,4,0,1204,2002",
            "2026-12-02 19:00:00.000,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,S-1-5-21-1111111111-2222222222-3333333333-1822,1689399632298278912,4,0,42115004,3204111",
            "2026-12-02 20:00:00.000,C:\\Program Files\\Microsoft\\OneDrive\\OneDrive.exe,S-1-5-21-1111111111-2222222222-3333333333-1822,1689399632298278912,4,0,18204009,1004112",
            "2026-12-03 20:00:00.000,C:\\Users\\d.becker\\Downloads\\rclone.exe,S-1-5-21-1111111111-2222222222-3333333333-1822,1689399632298278912,4,0,114220115,8004558",
            "2026-12-03 21:00:00.000,C:\\Program Files\\Mozilla Firefox\\firefox.exe,S-1-5-21-1111111111-2222222222-3333333333-1822,1689399632298278912,4,0,2400220,18004558",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "prefetch-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "PECmd version 1.5.0.0",
            "",
            "Author: Eric Zimmerman (saericzimmerman@gmail.com)",
            "https://github.com/EricZimmerman/PECmd",
            "",
            "Command line: PECmd.exe -d C:\\Cases\\WS-BECKER\\C\\Windows\\Prefetch -k 7z,robocopy,rclone,onedrive,firefox --csv C:\\Cases\\WS-BECKER\\Out --csvf prefetch.csv",
            "",
            "Keywords: 7z, robocopy, rclone, onedrive, firefox",
            "",
            "Source         Exe              Hash     Size      Created                 Modified                Run count  Last run",
            "-----------    -------------    ------   --------  ----------------------  ----------------------  ---------  ----------------------",
            "7Z2400-X64.EXE-XXXX0001.pf      7Z2400-X64.EXE   XXXX0001   46,592    2026-11-29 16:14:08      2026-11-29 16:14:08             1   2026-11-29 16:14:08",
            "7ZG.EXE-XXXX0002.pf             7ZG.EXE          XXXX0002   38,400    2026-12-02 18:48:00      2026-12-02 18:50:00             2   2026-12-02 18:50:00",
            "ROBOCOPY.EXE-XXXX0003.pf        ROBOCOPY.EXE     XXXX0003   25,088    2026-09-04 10:00:00      2026-12-02 19:04:33             7   2026-12-02 19:04:33",
            "ONEDRIVE.EXE-XXXX0004.pf        ONEDRIVE.EXE     XXXX0004   71,168    2026-08-01 08:00:00      2026-12-03 08:00:00           412   2026-12-03 08:00:00",
            "RCLONE.EXE-XXXX0005.pf          RCLONE.EXE       XXXX0005   45,056    2026-12-03 20:18:22      2026-12-03 20:18:22             1   2026-12-03 20:18:22",
            "FIREFOX.EXE-XXXX0006.pf         FIREFOX.EXE      XXXX0006   61,952    2026-08-01 08:00:00      2026-12-03 21:35:55            88   2026-12-03 21:35:55",
            "",
            "---------- Processed 6 files in 0.157 seconds ----------",
            "",
            "",
            "PS C:\\> Get-Content C:\\Cases\\WS-BECKER\\Out\\prefetch_Timeline.csv | Where-Object { $_ -match 'rclone|7z|robocopy' } | Select-Object -First 6",
            "",
            "2026-09-04 10:00:00,ROBOCOPY.EXE,ROBOCOPY.EXE-XXXX0003.pf,Previous_Run_5",
            "2026-11-29 16:14:08,7Z2400-X64.EXE,7Z2400-X64.EXE-XXXX0001.pf,Last_Run",
            "2026-12-02 18:48:00,7ZG.EXE,7ZG.EXE-XXXX0002.pf,Previous_Run_0",
            "2026-12-02 18:50:00,7ZG.EXE,7ZG.EXE-XXXX0002.pf,Last_Run",
            "2026-12-02 19:04:33,ROBOCOPY.EXE,ROBOCOPY.EXE-XXXX0003.pf,Last_Run",
            "2026-12-03 20:18:22,RCLONE.EXE,RCLONE.EXE-XXXX0005.pf,Last_Run",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "usb-mount-history.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "vid_pid,serial,filesystem,first_mount_utc,last_mount_utc,mount_count_observed",
            "0x0951:0x1666,SN-PRIV-EX-001,exFAT,2026-12-02T18:30:00Z,2026-12-02T19:35:00Z,2",
            "0x0951:0x1666,SN-CORP-IT-099,exFAT,2026-09-12T10:00:00Z,2026-09-12T11:00:00Z,1",
            "Note: SN-PRIV-EX-001 is NOT in the corporate asset register. SN-CORP-IT-099 is on the asset register (IT-issued).",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "onedrive-sync-log.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ OneDriveLogReader.exe --in C:\\Users\\d.becker\\AppData\\Local\\Microsoft\\OneDrive\\logs\\Business1\\*.odl --grep 'Upload|Sync'  --out -",
            "  (decoded OneDrive ODL trace stream — filtered to Upload + Sync events)",
            "",
            "[2026-12-02T19:06:51.421Z] Business1 INFO  AggregatedSyncContext_LogEvent  ChangeRecordedEvent { item=\"client-list-2026.xlsx\" change=ContentModified parent=\"OneDrive - Corp\\\\handoff\" }",
            "[2026-12-02T19:06:51.487Z] Business1 INFO  SyncEngine                       UploadSession.Create { item=\"client-list-2026.xlsx\" size=8,809,472 mime=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet  driveId=b!fa3...  tenant=corp.onmicrosoft.com }",
            "[2026-12-02T19:06:51.490Z] Business1 INFO  BITSEngine                       JobCreated  jobId={4f8a91a2-3b91-4d8c-9c3e-1a8a912b9c10}  state=Connecting  uri=https://corp-my.sharepoint.com/personal/d_becker_corp_example/_api/v2.0/drive/items/...",
            "[2026-12-02T19:07:13.812Z] Business1 INFO  BITSEngine                       JobTransferred  jobId={4f8a91a2-...}  bytesTransferred=8,809,472  bytesTotal=8,809,472  state=Transferred",
            "[2026-12-02T19:07:13.998Z] Business1 INFO  SyncEngine                       UploadSession.Commit { item=\"client-list-2026.xlsx\" etag=\\\"{ETag-A1B2}\\\" status=Success }",
            "",
            "[2026-12-02T19:07:14.041Z] Business1 INFO  SyncEngine                       UploadSession.Create { item=\"pipeline-q4.docx\" size=220,160 mime=application/vnd.openxmlformats-officedocument.wordprocessingml.document  driveId=b!fa3...  tenant=corp.onmicrosoft.com }",
            "[2026-12-02T19:07:18.221Z] Business1 INFO  SyncEngine                       UploadSession.Commit { item=\"pipeline-q4.docx\" etag=\\\"{ETag-C3D4}\\\" status=Success }",
            "",
            "[2026-12-02T19:08:00.330Z] Business1 INFO  SyncEngine                       UploadSession.Create { item=\"handoff-archive.7z\" size=39,845,376 mime=application/x-7z-compressed  driveId=b!fa3...  tenant=corp.onmicrosoft.com }",
            "[2026-12-02T19:08:54.811Z] Business1 INFO  SyncEngine                       UploadSession.Commit { item=\"handoff-archive.7z\" etag=\\\"{ETag-E5F6}\\\" status=Success }",
            "",
            "",
            "$ OneDriveLogReader.exe --in C:\\Users\\d.becker\\AppData\\Local\\Microsoft\\OneDrive\\logs --print-tenants",
            "",
            "Configured sync tenants (this user, this host):",
            "  Business1  driveId=b!fa3...   tenant=corp.onmicrosoft.com   account=d.becker@corp.example   status=Healthy",
            "  Personal   (NOT configured — sign-in blocked by Conditional Access policy",
            "             \"CA001 — Block personal-account OneDrive on managed devices\")",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 6,
        displayName: "activitiescache-excerpt.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "start_utc,app,activity_type,display_text",
            "2026-12-02T18:40:11Z,WINWORD.EXE,FocusedTime,pipeline-q4.docx",
            "2026-12-02T18:45:30Z,EXCEL.EXE,FocusedTime,client-list-2026.xlsx",
            "2026-12-02T18:48:01Z,7zG.exe,FocusedTime,handoff-archive.7z (compressing)",
            "2026-12-02T19:04:33Z,robocopy.exe,FocusedTime,(no display text — console child)",
            "2026-12-03T20:17:55Z,explorer.exe,FocusedTime,Downloads\\rclone.exe (properties dialog)",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 7,
        displayName: "usn-journal-excerpt.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "utc,path,reason",
            "2026-12-02T18:48:00Z,C:\\Users\\d.becker\\Desktop\\handoff\\handoff-archive.7z,FILE_CREATE",
            "2026-12-02T18:50:00Z,C:\\Users\\d.becker\\Desktop\\handoff\\handoff-archive.7z,DATA_EXTEND|CLOSE",
            "2026-12-02T19:04:33Z,C:\\Users\\d.becker\\OneDrive\\handoff\\client-list-2026.xlsx,FILE_CREATE|DATA_EXTEND|CLOSE",
            "2026-12-02T19:04:34Z,C:\\Users\\d.becker\\OneDrive\\handoff\\pipeline-q4.docx,FILE_CREATE|DATA_EXTEND|CLOSE",
            "2026-12-02T19:04:35Z,C:\\Users\\d.becker\\OneDrive\\handoff\\handoff-archive.7z,FILE_CREATE|DATA_EXTEND|CLOSE",
            "2026-12-03T20:18:00Z,C:\\Users\\d.becker\\Downloads\\rclone.exe,FILE_CREATE|DATA_EXTEND|CLOSE",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 8,
        displayName: "email-export-of-interest.eml.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "From:    d.becker@corp.example",
            "To:      ops-team@corp.example",
            "Cc:      m.tan@corp.example, j.patel@corp.example",
            "Subject: Handoff package",
            "Date:    Wed, 02 Dec 2026 19:09:30 +0000",
            "",
            "Hey team —",
            "",
            "Per Marcus's request, I've staged my handoff package in",
            "OneDrive\\handoff. Two key docs (client-list-2026.xlsx,",
            "pipeline-q4.docx) plus the archive (handoff-archive.7z)",
            "with everything else.",
            "",
            "Marcus has the password on his end. Sharing perms set to",
            "the ops-team security group only.",
            "",
            "— D.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 9,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-AURORA-19",
              os: "Windows 11 23H2 (build 22631)",
              user: "CORP\\d.becker",
              user_sid: "S-1-5-21-...-1822",
              acquired_utc: "2026-12-04T07:00:00Z",
              telemetry_coverage: {
                edr_process_create: "enabled",
                edr_network_connect: "disabled (exception, never reverted)",
                sysmon: "not installed",
                bam_service: "running",
                srum: { last_flush_utc: "2026-12-04T06:00:00Z", retention_days_observed: 30 },
                prefetch: "enabled",
                onedrive_personal_tenant: "blocked by Conditional Access",
                perimeter_netflow: "available via proxy team — NOT pulled for this case",
              },
              note: "Counsel-authorized non-intrusive review. No remote interview of d.becker has occurred. Mailbox export above was pulled by Exchange admin on case authorization.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "exfil-capstone-indicators",
        displayName: "Indicators bearing on the exfil claim",
        items: [
          {
            id: "rclone-installed-and-run",
            label:
              "`rclone.exe` was downloaded, written, and executed under d.becker's account on 2026-12-03; BAM + Prefetch + USN agree.",
            evidenceRef: "bam-trailing-14d.csv",
          },
          {
            id: "rclone-large-egress",
            label:
              "SRUM attributes ~114 MiB sent to `rclone.exe` in the 2026-12-03T20:00Z hour bucket.",
            evidenceRef: "srum-network-bytes.csv",
          },
          {
            id: "private-usb-mount",
            label:
              "A USB mass-storage device with serial `SN-PRIV-EX-001` (NOT on the corporate asset register) was mounted on 2026-12-02 for ~1 hour overlapping the OneDrive upload window.",
            evidenceRef: "usb-mount-history.csv",
          },
          {
            id: "7z-archive-create",
            label:
              "`7zG.exe` ran on 2026-12-02 around 18:48; `handoff-archive.7z` was created on the Desktop within the same minute.",
            evidenceRef: "usn-journal-excerpt.csv",
          },
          {
            id: "onedrive-corp-upload",
            label:
              "OneDrive client log shows three files uploaded to the CORPORATE OneDrive tenant in the 19:06–19:08Z window (handoff context).",
            evidenceRef: "onedrive-sync-log.txt",
          },
          {
            id: "handoff-email",
            label:
              "Outgoing email at 19:09:30Z to ops-team@corp.example names the same three files and frames them as a sanctioned handoff package; password sharing with `m.tan` is mentioned.",
            evidenceRef: "email-export-of-interest.eml.txt",
          },
          {
            id: "personal-onedrive-blocked",
            label:
              "Conditional Access blocks personal OneDrive on this host.",
            evidenceRef: "host-context.json",
          },
          {
            id: "no-edr-netconn",
            label:
              "EDR network-connect telemetry is disabled on this host (exception, never reverted).",
            evidenceRef: "host-context.json",
          },
          {
            id: "perimeter-netflow-not-pulled",
            label:
              "Perimeter NetFlow exists but has NOT been pulled for this case yet.",
            evidenceRef: "host-context.json",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "About the **12-02 OneDrive upload sequence** (7z creation → robocopy → OneDrive sync of three files → handoff email), which characterization fits the artifacts best?",
        options: [
          {
            id: "consistent-with-sanctioned-handoff",
            label:
              "Consistent with a sanctioned handoff: files were staged on Desktop, archived, copied into the corporate OneDrive folder, synced to the CORPORATE tenant, and announced in an email naming the same files. Personal-tenant OneDrive is blocked. This is not, in itself, exfil behaviour.",
          },
          {
            id: "covert-archive-exfil",
            label:
              "Covert exfiltration: the 7z archive is designed to bypass content scanning, and the OneDrive upload moved the archive off the host.",
          },
          {
            id: "neutral-needs-corroboration",
            label:
              "Neutral — the activity is suggestive but neither proves nor disproves exfil intent without corroboration from the recipient and the OneDrive share's access logs.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["consistent-with-sanctioned-handoff", "neutral-needs-corroboration"],
          allowMultiple: true,
        },
        debriefMd: [
          "The 12-02 sequence is **internally coherent as a sanctioned handoff** — staged in the user's Desktop, archived, copied to her OneDrive folder, synced to the corporate tenant (the only tenant policy permits), and an email to ops-team naming the same files and the password-sharing arrangement. Without a contradicting fact, calling this exfil would be a serious over-claim.",
          "",
          "It is also fair to mark the sequence as *neutral — needs corroboration* (does m.tan confirm? Is ops-team the right destination? Are the OneDrive ACLs what the email claims?). What it is NOT, on these artifacts alone, is *covert exfil*.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "About the **12-03 rclone activity** (rclone.exe written, executed, then ~114 MiB sent in the 20:00Z hour, per SRUM), which characterization fits the artifacts best?",
        options: [
          {
            id: "rclone-strong-exfil-signal",
            label:
              "Strong exfiltration signal that needs urgent investigation: `rclone` is a general-purpose cloud-sync tool that is NOT corporate-managed; BAM + Prefetch + USN all corroborate that d.becker ran it; SRUM attributes ~114 MiB egress to that exact process; there is no corresponding sanctioned-channel record (corporate OneDrive, sanctioned proxy log, email handoff).",
          },
          {
            id: "rclone-explained-by-handoff",
            label:
              "Already explained by the 12-02 handoff email and OneDrive activity.",
          },
          {
            id: "rclone-low-signal",
            label:
              "Low signal — rclone is widely used legitimately by developers.",
          },
          {
            id: "rclone-destination-unknown",
            label:
              "The destination is unknown from the host artifacts. SRUM does not record destinations, EDR network-connect is disabled, perimeter NetFlow has not been pulled. The strongest single missing piece is the destination.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["rclone-strong-exfil-signal", "rclone-destination-unknown"],
          allowMultiple: true,
        },
        debriefMd: [
          "The 12-03 rclone sequence is the **central exfil concern** in this case: a non-managed cloud-sync tool, fresh installation, single execution, and a large SRUM-attributed egress bucket under her account. The 12-02 handoff does NOT explain it (different binary, different day, different volume profile).",
          "",
          "The destination gap is the most important missing piece — SRUM has no destinations, EDR network-connect is off, perimeter NetFlow is available but unpulled. Get the NetFlow before drafting the finding.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What about the **12-02 mount of `SN-PRIV-EX-001`** (the non-asset-register USB)?",
        options: [
          {
            id: "usb-policy-violation",
            label:
              "It is a removable-media policy concern on its own (non-asset-register device on a corporate host).",
          },
          {
            id: "usb-proves-data-copied",
            label:
              "It proves data was copied to the USB.",
          },
          {
            id: "usb-narrows-window",
            label:
              "The mount overlaps the OneDrive upload window, which is suggestive but not proof of copy-to-USB. To establish copy-to-USB, look at filesystem journal entries for `\\\\?\\Volume{...}` or LNK / shellbag entries referencing the device, and (ideally) the USB itself.",
          },
          {
            id: "usb-cleared",
            label:
              "Irrelevant — devices get plugged in routinely.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["usb-policy-violation", "usb-narrows-window"],
          allowMultiple: true,
        },
        debriefMd:
          "Mount alone is a policy issue, not a copy. Copy-to-USB needs filesystem-journal / shellbag / LNK evidence pointing at the volume, ideally combined with imaging the USB. Treat the mount as a lead, not as an established copy.",
      },
      {
        ordinal: 4,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "exfil-capstone-indicators",
        promptMd:
          "Select the indicators that **support an exfil claim that you could defend in a deposition today** (i.e., proven from the artifacts as written, not over-claimed).",
        expected: {
          type: "select_indicators",
          correctIds: [
            "rclone-installed-and-run",
            "rclone-large-egress",
            "private-usb-mount",
          ],
        },
        debriefMd: [
          "**Supporting and defensible *as worded*:**",
          "",
          "- The rclone installation + execution chain (multiple artifact families agree).",
          "- The 114 MiB SRUM-attributed egress to rclone (factual SRUM reading).",
          "- The non-asset-register USB mount during the overlapping window (factual; framed as a *mount*, not a *copy*).",
          "",
          "**NOT supporting an exfil claim today (distractors):**",
          "",
          "- *7z archive create* — fact, but the archive was uploaded to the *corporate* OneDrive tenant per the sync log, not to an external destination.",
          "- *OneDrive corp upload* — corporate tenant; consistent with handoff framing.",
          "- *Handoff email* — corroborates the sanctioned-handoff narrative; doesn't support exfil.",
          "- *Personal OneDrive blocked* — policy fact, not a per-event indicator.",
          "- *EDR network-connect disabled / NetFlow not pulled* — these are GAPS in coverage. They explain why corroboration is missing; they do not themselves count as exfil evidence (and writing them as such would be a serious over-claim).",
        ].join("\n"),
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Pick the **two most decisive next investigative steps** before counsel decides on a TRO.",
        options: [
          {
            id: "pull-perimeter-netflow",
            label:
              "Pull perimeter NetFlow / proxy logs for the 2026-12-03T20:00–21:00Z window, correlate to host source-port + 5-tuple, and confirm the destination of rclone's outbound flow.",
          },
          {
            id: "image-the-usb",
            label:
              "Locate and image the `SN-PRIV-EX-001` USB; recover the filesystem, deleted-file metadata, and any LNK / shellbag entries from the host that reference its volume GUID.",
          },
          {
            id: "interview-d-becker-immediate",
            label:
              "Interview d.becker today without coordinating with counsel.",
          },
          {
            id: "wipe-the-machine",
            label:
              "Wipe and re-image the workstation to remove rclone before anyone can use it again.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["pull-perimeter-netflow", "image-the-usb"],
          allowMultiple: true,
        },
        debriefMd: [
          "NetFlow + USB imaging are the two highest-yield, least-intrusive moves: NetFlow resolves the rclone destination gap, and imaging the USB (if recoverable) resolves whether the USB mount was associated with a copy of corporate data.",
          "",
          "Interviewing d.becker is appropriate but **coordinate with counsel first** in any case where a TRO is on the table — uncoordinated contact can compromise the legal posture. Wiping the workstation destroys evidence and is never the right move.",
        ].join("\n"),
      },
      {
        ordinal: 6,
        type: "confidence",
        weight: 2,
        promptMd:
          "Confidence (1–5) that **unauthorized data exfiltration occurred from this workstation** based on the artifacts as they stand today (i.e., before NetFlow is pulled and before USB is imaged).",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**3 (or so).** The rclone install-and-run pattern + the SRUM volume + the non-asset-register USB mount are a coherent set of suspicious facts. They are not yet *proof* of unauthorized exfil: the destination of the rclone flow is unknown, the USB hasn't been imaged, and the user hasn't been interviewed. Confidence 5 requires at least one of those gaps closed in a way that demonstrates a non-sanctioned destination (NetFlow showing flow to a personal cloud-storage service, USB containing corporate files, user admission). Confidence 1–2 would dismiss real signal. The honest answer is 3 with the listed gaps.",
      },
      {
        ordinal: 7,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the **12-02 OneDrive upload sequence** (7z archive + three files to corporate OneDrive + handoff email) is **on its own** sufficient to support an unauthorized-exfil claim.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The 12-02 sequence reads as a sanctioned handoff — corporate-tenant OneDrive, an email naming the same files, ops-team recipients, password coordination with a named colleague. Without contradicting facts (the email is a fabrication, the recipients deny it, the OneDrive share permits external access, etc.), citing the 12-02 sequence as exfil evidence would be over-claiming.\n\n**Don't yet claim:** that the 12-03 rclone activity was exfil to an unsanctioned destination (destination unknown until NetFlow is pulled), that the USB carried corporate material (not yet imaged), or that the 12-02 sequence is itself part of the exfil pattern (reads as sanctioned handoff). **Owners:** unit ISSM owns incident handling under AR 25-2; supporting ACI under AR 381-12 para 4-6 owns the insider-threat referral; OSJA / supporting trial counsel govern downstream measures.",
      },
    ],
  },
];
