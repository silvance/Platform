import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Insider-threat family. Three things this family teaches that the
// pure-DFIR family doesn't:
//   - Anomaly ≠ exfil. Suspicious patterns motivate the next step;
//     they aren't the finding.
//   - File access ≠ file copy. Look at the action verbs separately.
//   - The right report names what you'd need *next* to convert a
//     lead into a finding.

export const INSIDER_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished) ──────────────────────────────────────
  {
    slug: "insider-file-access-timeline-001",
    title: "Insider Threat: 30-Day-Notice File-Access Timeline",
    summary:
      "An employee gave 30 days' notice. The week after, file-access counts spike. Read the timeline carefully and decide what's anomaly vs evidence.",
    skillAreas: ["account_compromise", "df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 40,
    tags: ["insider_risk", "account_compromise", "df_artifacts", "report_writing", "inference_discipline"],
    lane: "insider_risk",
    module: "Leaving-employee triage",
    sequence: 1,
    brief: `
# Brief

An engineer at a partner firm — \`l.tran@partner.example\` — gave
30 days' notice on 2026-09-01. HR flagged a high count of
file-access events from her account in the week after, and the
case was referred to your supporting ACI office for review in
the Army Insider Threat Program lane. If substantiated, the
activity could sit in the *unauthorized removal of sensitive
material* and *unauthorized removable-media use* families of
reportable concerns.

> Anomaly is a reason to look. It is not a finding. First-Amendment-
> protected activity, identity, and personal characteristics are
> not, by themselves, suspicious — articulable facts about conduct
> are what carry a referral.

You have a slice of file-access events, removable-media mount
events, VPN logons, and one page of role / project context.

## Artifacts

- **file-access-events.csv** — open-events from the document
  management system. \`action\` is what the DMS recorded (view,
  download, share-link-created).
- **removable-media.csv** — USB / SD-card mount + dismount events
  from the workstation EDR. (EDR = Endpoint Detection and Response
  — host-side security telemetry, e.g. CrowdStrike Falcon,
  Microsoft Defender for Endpoint, or Sysmon — Microsoft's free
  System Monitor service. The question options below mention these
  alongside other source types; you don't need to know their
  internals, only that EDR / Sysmon are host-side sources that
  observe file writes.)
- **vpn-logons.csv** — VPN session starts + ends for this user.
- **employee-context.json** — role, projects, manager, last
  performance review notes (sanitized).

## Reasoning discipline

Be explicit about the difference between:

- **Access** — the DMS recorded the user viewing / opening a
  document. Does not mean a copy left the perimeter.
- **Download** — the DMS recorded the user pulling a copy into
  their workstation. Local copy, not necessarily exfil.
- **Removable-media write** — bytes went to a USB device. This is
  the artifact closest to exfil.
- **Exfil** — bytes left the organization's control. The
  artifacts here may or may not prove this happened.

Anomaly in access patterns is a reason to look; it is not a
finding by itself.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "file-access-events.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Microsoft 365 Unified Audit Log export — Search-UnifiedAuditLog
          //   -StartDate 2026-09-01 -EndDate 2026-09-10
          //   -Operations FileAccessed,FileDownloaded
          //   -UserIds l.tran@partner.example
          //   -ResultSize 5000 | Export-Csv -NoTypeInformation
          // (Excerpt — relevant SharePoint/OneDrive rows.)
          [
            "CreationDate,UserIds,Operations,RecordType,ObjectId,SourceFileName,SourceFileSize,Workload,UserAgent",
            "2026-09-02T09:11:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/eng/onboarding/handbook.docx,handbook.docx,,SharePoint,Edge/Win10",
            "2026-09-02T13:44:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/eng/onboarding/handbook.docx,handbook.docx,,SharePoint,Edge/Win10",
            "2026-09-03T10:01:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/programs/alpha/design-review-notes.docx,design-review-notes.docx,,SharePoint,Edge/Win10",
            "2026-09-03T10:05:00Z,l.tran@partner.example,FileDownloaded,SharePointFileOperation,/sites/programs/alpha/design-review-notes.docx,design-review-notes.docx,1822111,SharePoint,Edge/Win10",
            "2026-09-03T10:09:00Z,l.tran@partner.example,FileDownloaded,SharePointFileOperation,/sites/programs/alpha/schema-diagrams.docx,schema-diagrams.docx,488300,SharePoint,Edge/Win10",
            "2026-09-03T10:12:00Z,l.tran@partner.example,FileDownloaded,SharePointFileOperation,/sites/programs/alpha/integration-test-scripts.docx,integration-test-scripts.docx,210117,SharePoint,Edge/Win10",
            "2026-09-03T10:18:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/hr/templates/performance-review-template.docx,performance-review-template.docx,,SharePoint,Edge/Win10",
            "2026-09-04T11:42:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/programs/alpha/design-review-notes.docx,design-review-notes.docx,,SharePoint,Edge/Win10",
            "2026-09-08T08:31:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/programs/beta/high-level-overview.docx,high-level-overview.docx,,SharePoint,Edge/Win10",
            "2026-09-08T08:55:00Z,l.tran@partner.example,FileAccessed,SharePointFileOperation,/sites/programs/beta/vendor-list.docx,vendor-list.docx,,SharePoint,Edge/Win10",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "removable-media.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Microsoft Defender for Endpoint — Advanced Hunting export:
          //   DeviceEvents
          //   | where ActionType in ("UsbDriveMount","UsbDriveUnmount")
          //   | where DeviceName == "WS-LT-018"
          //   | project Timestamp, ActionType, DeviceName, AccountName,
          //             AdditionalFields
          //   | order by Timestamp asc
          [
            "Timestamp,ActionType,DeviceName,AccountName,AdditionalFields",
            "2026-09-03T09:58:00Z,UsbDriveMount,WS-LT-018,l.tran,\"{\"\"DriveLetter\"\":\"\"E:\"\",\"\"VendorId\"\":\"\"0x0951\"\",\"\"ProductId\"\":\"\"0x1666\"\",\"\"SerialNumber\"\":\"\"AA-LT-001\"\",\"\"DeviceClass\"\":\"\"DiskDrive\"\"}\"",
            "2026-09-03T10:22:00Z,UsbDriveUnmount,WS-LT-018,l.tran,\"{\"\"DriveLetter\"\":\"\"E:\"\",\"\"VendorId\"\":\"\"0x0951\"\",\"\"ProductId\"\":\"\"0x1666\"\",\"\"SerialNumber\"\":\"\"AA-LT-001\"\"}\"",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "vpn-logons.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Cisco AnyConnect / ASA syslog export, parsed to CSV.
          // Original messages were `%ASA-6-722023` (session start) and
          // `%ASA-6-113019` (session terminated, with elapsed seconds).
          [
            "timestamp,asa_msg,event,username,client_public_ip,assigned_ip,bytes_tx,bytes_rx,duration_sec",
            "2026-09-02T09:00:00Z,%ASA-6-722023,session_start,l.tran,203.0.113.7,10.40.1.118,,,",
            "2026-09-02T17:30:00Z,%ASA-6-113019,session_terminated,l.tran,203.0.113.7,10.40.1.118,4194822,18204115,30600",
            "2026-09-03T08:45:00Z,%ASA-6-722023,session_start,l.tran,203.0.113.7,10.40.1.118,,,",
            "2026-09-03T17:42:00Z,%ASA-6-113019,session_terminated,l.tran,203.0.113.7,10.40.1.118,38922104,18230099,32220",
            "2026-09-08T08:20:00Z,%ASA-6-722023,session_start,l.tran,203.0.113.7,10.40.1.118,,,",
            "2026-09-08T16:55:00Z,%ASA-6-113019,session_terminated,l.tran,203.0.113.7,10.40.1.118,5210443,12004822,30900",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "employee-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              user: "l.tran",
              role: "Senior Engineer",
              current_projects: ["Project Alpha", "Project Beta"],
              manager: "p.iyer",
              notice_date_utc: "2026-09-01",
              last_review_summary:
                "Solid performer; on Alpha as tech lead, Beta as design reviewer. Tight relationship with the manager. No disciplinary record.",
              data_policy_note:
                "Engineers may download project documents they are members of for offline review. Downloads to removable media must be approved through the data-handling portal; portal records are NOT included in this artifact set.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "insider-timeline-indicators",
        displayName: "Indicators in the file-access + USB + VPN timeline",
        items: [
          { id: "alpha-bulk-download", label: "Three Project Alpha documents downloaded within ~10 minutes on 2026-09-03", evidenceRef: "file-access-events.csv" },
          { id: "usb-mount-window", label: "USB mounted on the same workstation during the Alpha download window", evidenceRef: "removable-media.csv" },
          { id: "perf-review-view", label: "Performance review template viewed minutes after Alpha downloads", evidenceRef: "file-access-events.csv" },
          { id: "beta-view-only", label: "Project Beta documents only VIEWED, not downloaded", evidenceRef: "file-access-events.csv" },
          { id: "consistent-vpn", label: "VPN logons consistent with a normal work day, from the same client IP", evidenceRef: "vpn-logons.csv" },
          { id: "no-portal-record", label: "No data-handling-portal record for USB write approval is included in the artifact set", evidenceRef: "employee-context.json" },
          { id: "user-is-alpha-techlead", label: "Tran is the tech lead on Project Alpha — downloads are within policy for project members", evidenceRef: "employee-context.json" },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which of the following statements are **facts** at this point?",
        options: [
          { id: "alpha-3-downloads", label: "Three Project Alpha documents were downloaded within ~10 minutes on 2026-09-03." },
          { id: "usb-was-mounted", label: "A USB device was mounted on Tran's workstation during the Alpha download window." },
          { id: "alpha-downloads-policy-violation", label: "Downloading the Alpha documents was a policy violation." },
          { id: "usb-write-happened", label: "The Alpha documents were written to the USB device." },
          { id: "exfil-occurred", label: "Exfiltration of project data occurred." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["alpha-3-downloads", "usb-was-mounted"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The three Alpha downloads happened in that 10-minute window (DMS event log says so).",
          "- The USB was mounted then dismounted on the same workstation in an overlapping window (EDR says so).",
          "",
          "**Not fact (yet):**",
          "",
          "- *Policy violation* — downloads are within policy for project members per the context; the policy gate is writing to removable media. We don't yet know whether the data-handling portal recorded an approval for this USB write — portal records aren't in this artifact set.",
          "- *USB write happened* — mount-with-overlap is suggestive but not direct evidence of a file actually being written to the USB. The EDR rows are mount + dismount, not write events.",
          "- *Exfil occurred* — even if USB writes happened, the device might have been an authorized encrypted device used per policy. Exfil requires showing bytes left the perimeter without authorization.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "insider-timeline-indicators",
        promptMd:
          "From the listed indicators, pick the ones that are **investigative leads** worth pursuing before drawing a conclusion (not facts themselves, but worth looking at next).",
        expected: {
          type: "select_indicators",
          correctIds: [
            "alpha-bulk-download",
            "usb-mount-window",
            "perf-review-view",
            "no-portal-record",
          ],
        },
        debriefMd: [
          "**Leads worth pursuing:**",
          "",
          "- Bulk-download of Alpha + overlapping USB mount + view-of-perf-review-template + absence of portal record in this artifact set — together these justify the next step: query the data-handling portal directly (was the USB write approved?) and pull EDR file-write events to the USB during the mount window.",
          "",
          "**Not leads (or already-explained context):**",
          "",
          "- Beta view-only is a corroborating *normal* signal — engineers view docs in their orbit all the time.",
          "- Consistent VPN logons from the same IP also read normal.",
          "- Tran being the Alpha tech lead is policy-relevant context, not an anomaly indicator.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which **single** additional source would most directly turn 'USB was mounted' into 'these specific files were written to the USB'?",
        options: [
          { id: "edr-filewrite", label: "EDR / Sysmon FileCreate (file-write) events scoped to the USB volume during the mount window." },
          { id: "more-vpn-logons", label: "More VPN logon records for Tran" },
          { id: "dms-view-events", label: "Additional DMS view-events for the same documents" },
          { id: "usb-serial-history", label: "USB VID/PID/serial history from the OS USB registry" },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["edr-filewrite"],
          allowMultiple: false,
        },
        debriefMd:
          "EDR / Sysmon **FileCreate** events scoped to the USB volume during the mount window. That converts \"a USB was mounted\" into \"these specific files were copied to it.\" The other sources help with adjacent questions (was the device known? what else did Tran touch?) but none of them confirms a *write* to the USB. The data-handling portal is the policy gate; EDR is the technical gate. Both belong in a finished writeup.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the writeup should currently read 'L. TRAN exfiltrated Project Alpha data.'",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The artifacts establish a suspicious *pattern* worth pursuing; they do not establish exfil. A defensible writeup names the pattern, names the missing artifacts, and recommends the next two queries (data-handling portal, EDR file-write events). A finding stated now would not survive the first competent challenge from the employee's counsel.",
      },
    ],
  },

  // ─── Tier 2 (drafts) ─────────────────────────────────────────
  {
    slug: "insider-working-hours-pattern-001",
    title: "Insider Threat: Off-Hours Access Pattern",
    summary:
      "Off-hours logons cluster around a specific document set. Is it a sign of exfil, a deadline, or normal team-A behavior?",
    skillAreas: ["account_compromise", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["insider_risk", "account_compromise", "report_writing", "inference_discipline"],
    lane: "insider_risk",
    module: "Behavioral patterns",
    sequence: 1,
    status: "draft",
    brief: `
# Brief (DRAFT)

A user's logons are clustering after midnight. The same week, their
team is in the final two weeks of a release. Triage.

> *Unwarranted* work outside of normal duty hours is a category of
> potentially reportable behavior — but *unwarranted* is the
> operative word. A release deadline, a documented on-call rotation,
> or a known time-zone shift can fully explain the same pattern.
> Rule out the benign explanations before treating the pattern as
> an indicator.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "logon-pattern.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // EvtxECmd.exe -f C:\Cases\WS-NM-022\Security.evtx
          //   --inc 4800,4801 --csv . --csvf lock-unlock.csv
          // EID 4800 = workstation locked; 4801 = workstation unlocked.
          // Timestamps below are device-local (TimeCreated as written
          // in the event payload's `tz=` field — n.murphy's home TZ).
          [
            "TimeCreated,EventId,MapDescription,Computer,UserName",
            "2026-10-13T23:42:00,4801,The workstation was unlocked,WS-NM-022,CORP\\n.murphy",
            "2026-10-14T01:08:00,4800,The workstation was locked,WS-NM-022,CORP\\n.murphy",
            "2026-10-14T23:51:00,4801,The workstation was unlocked,WS-NM-022,CORP\\n.murphy",
            "2026-10-15T00:47:00,4800,The workstation was locked,WS-NM-022,CORP\\n.murphy",
            "2026-10-15T23:35:00,4801,The workstation was unlocked,WS-NM-022,CORP\\n.murphy",
            "2026-10-16T01:12:00,4800,The workstation was locked,WS-NM-022,CORP\\n.murphy",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "team-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Team context",
            "------------",
            "",
            "N. Murphy is on Release Train Alpha. The Alpha release cuts on",
            "2026-10-22. The team has documented push-mode hours culture during",
            "the two weeks before a cut. Team manager confirmed by email that",
            "the team is approved to work late this week.",
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
        promptMd: "Which statement most accurately describes the right next step?",
        options: [
          { id: "open-investigation", label: "Open a formal insider-risk investigation." },
          { id: "explained-by-context", label: "Pattern is fully explained by the documented push-mode hours; no further action." },
          { id: "low-priority-monitor", label: "Note the pattern is consistent with the documented context. Set a low-priority monitor for any DIVERGENCE from the pattern (e.g. document downloads outside the team's usual document set)." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["low-priority-monitor"],
          allowMultiple: false,
        },
        debriefMd:
          "Off-hours logons in isolation are not a signal. When paired with documented push-mode hours + a release cut, they're explained. The right disposition is to note the explanation and watch for divergence — content patterns that don't match what the team would normally touch.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd: "Which additional artifact would convert 'off-hours logon' into 'off-hours data exfil'?",
        options: [
          { id: "egress-or-dlp", label: "DLP egress logs OR EDR file-write events to removable media during the window" },
          { id: "more-logons", label: "More keycard / console-unlock entries for the same user" },
          { id: "team-roster", label: "The team roster confirming who else is on Release Train Alpha" },
          { id: "vpn-uptime", label: "VPN-server uptime stats for the same window" },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["egress-or-dlp"],
          allowMultiple: false,
        },
        debriefMd:
          "EDR file-write events to removable media, or DLP egress logs, are what convert a *presence* signal into a *what-did-they-do* signal. The other options either repeat the presence-signal we already have or address unrelated questions.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that this pattern is an insider threat.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. The context fully explains the timing.\n\n**Owners.** If the off-hours pattern *did* survive a sanity check (it doesn't here), the insider angle goes to the supporting ACI office under AR 381-12 para 4-6 (Army Insider Threat Program); the access-control / account-hygiene angle goes to the unit ISSM under AR 25-2.",
      },
    ],
  },

  {
    slug: "insider-removable-media-with-sensitive-access-001",
    title: "Insider Threat: USB Mount + Sensitive Doc Access",
    summary:
      "A USB was mounted during access to a restricted document. Determine what the artifacts prove vs what would need EDR file-write data.",
    skillAreas: ["account_compromise", "df_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 12,
    tags: ["insider_risk", "account_compromise", "df_artifacts", "inference_discipline"],
    lane: "insider_risk",
    module: "Removable media + access",
    sequence: 1,
    status: "draft",
    brief: `
# Brief (DRAFT)

A restricted finance document was opened by an engineering account
the same minute a USB device was mounted on that workstation.
Triage.

The combination sits in two reportable families: *unauthorized USB
use* (if the device is non-asset-register) and *attempted access
inconsistent with duty requirements* (if the cross-team access is
anomalous and unexplained). Both require articulable facts before
referral; a single coincidental event is a reason to look further,
not a finding.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "events.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Splunk search joining two source-types for the same host
          // and analyst-time window:
          //   index=m365 (sourcetype=o365:management:activity OR
          //               sourcetype=mde:device_events)
          //   host=WS-ES-010 user=e.silva
          //   earliest=2026-11-04T15:00:00Z latest=2026-11-04T15:30:00Z
          //   | table _time, sourcetype, action, user, host, detail
          //   | sort _time
          //   | outputcsv events.csv
          [
            "_time,sourcetype,action,user,host,detail",
            "2026-11-04T15:02:00Z,o365:management:activity,FileAccessed,e.silva,WS-ES-010,\"/sites/finance/restricted/DOC-FIN-9912.docx\"",
            "2026-11-04T15:02:30Z,mde:device_events,UsbDriveMount,e.silva,WS-ES-010,\"VID=0x0951 PID=0x1666 SerialNumber=XX-001 DriveLetter=E:\"",
            "2026-11-04T15:18:00Z,o365:management:activity,FileAccessed,e.silva,WS-ES-010,\"/sites/finance/restricted/DOC-FIN-9912.docx (close)\"",
            "2026-11-04T15:20:00Z,mde:device_events,UsbDriveUnmount,e.silva,WS-ES-010,\"SerialNumber=XX-001\"",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "access-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Access context",
            "--------------",
            "",
            "DOC-FIN-9912 has access list including e.silva (Engineering finance",
            "liaison) — opening was within policy.",
            "",
            "Policy on USB writes for finance-scoped docs: prohibited without",
            "data-handling-portal approval. Portal logs are NOT included in this",
            "artifact set.",
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
        promptMd: "Which statements are **fact**?",
        options: [
          { id: "doc-opened", label: "DOC-FIN-9912 was opened by e.silva on WS-ES-010 at 15:02:00Z." },
          { id: "usb-mounted-overlap", label: "A USB was mounted on WS-ES-010 30 seconds after the doc was opened." },
          { id: "doc-written-to-usb", label: "DOC-FIN-9912 was written to the USB." },
          { id: "policy-violation-occurred", label: "A policy violation occurred." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["doc-opened", "usb-mounted-overlap"],
          allowMultiple: true,
        },
        debriefMd:
          "Open + mount are events you observed. *Write* is not observable from mount events alone — you need EDR (Endpoint Detection and Response — host-side security telemetry like CrowdStrike Falcon, Microsoft Defender for Endpoint, or Sysmon) FileCreate/Write events on the USB volume. *Policy violation* depends on whether the data-handling portal approved this USB write (logs not included).",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd: "Which missing source would resolve the question? Select all that apply.",
        options: [
          { id: "edr-filewrite", label: "EDR / Sysmon FileCreate (file-write) events scoped to the USB volume during the mount window" },
          { id: "portal-log", label: "The data-handling portal approval log for this USB write" },
          { id: "more-mounts", label: "More USB mount / dismount events for the same device" },
          { id: "doc-access-list", label: "The full access-list of DOC-FIN-9912 to see who else can open it" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["edr-filewrite", "portal-log"],
          allowMultiple: true,
        },
        debriefMd:
          "Either EDR file-write events scoped to the USB volume during the mount window OR the data-handling portal log. Either alone is enough to convert the lead into a finding — EDR speaks to *what happened*, the portal speaks to *whether it was authorized*. The other options give context but don't speak to write-or-no-write.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that this is data exfil.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "Suspicious but not concluded. The temporal overlap is meaningful (mount within 30s of open is not a coincidence) — but inference here without the EDR or portal record is premature.\n\n**Owners.** The cybersecurity-incident angle (unauthorized USB use, cross-team access) goes to the unit ISSM under AR 25-2 item 7 of the cyberspace reportable list; the insider angle goes to the supporting ACI office under AR 381-12 para 4-6.",
      },
    ],
  },

  // ─── Whaling: CEO-impersonation wire-fraud lure ─────────────
  {
    slug: "insider-whaling-ceo-wire-001",
    title: "Whaling: \"CEO\" Off-Cycle Wire Request",
    summary:
      "An urgent off-cycle wire request lands in the CFO's inbox, signed by the CEO. Read the headers, name the tells, and decide what gets reported and to whom.",
    skillAreas: ["email_headers", "bec", "account_compromise", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["insider_risk", "whaling", "bec", "email_headers", "inference_discipline"],
    lane: "insider_risk",
    module: "External lures aimed at insiders",
    sequence: 1,
    brief: `
# Brief

Friday afternoon. The CFO at a unit-contracted partner firm
forwards a message they received to your supporting ACI office
with a one-line note: *"This looks off, but he's done off-cycle
wires before — do I need to do anything?"*

The attached email is signed by the partner's CEO and asks the
CFO to send a \\$48,500 USD wire today to a new account for a
"closing settlement" the CEO claims to have just negotiated.
The email asks the CFO not to discuss the transfer with anyone
on the finance team or the legal team "until the deal closes
Monday."

This is a textbook whaling lure: senior-leadership impersonation
aimed at a single high-value approver, designed to bypass the
normal multi-eye process by exploiting urgency + secrecy + an
existing pattern of off-cycle requests.

Your job: read the email surfaces, identify the tells that mark
it as a lure, and name the right reporting + containment moves.

The partner firm is a unit-contracted vendor; the supporting ACI
office and the cognizant contracting officer (KO) representative
are both legitimate downstream parties when wire-fraud lures
target a contracted relationship.

## Artifacts

- **suspect-email.eml.txt** — text view of the message + a
  trimmed Received chain + authentication results.
- **org-mail-policy.json** — the org's published SPF/DKIM/DMARC
  posture for the CEO's real domain.
- **ceo-recent-context.txt** — short narrative of what the CEO
  was doing in the day before the email (per the CFO's
  knowledge).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Authentication-Results: mx.partner.example;",
            "    spf=fail (sender IP is 198.51.100.221)",
            "      smtp.mailfrom=ceo@partner-finance.example",
            "    dkim=none",
            "    dmarc=fail action=quarantine header.from=partner.example",
            "Received: from mailrelay-7.cheap-mail.example",
            "         (198.51.100.221) by mx.partner.example",
            "         with ESMTPS; Fri, 21 Nov 2026 14:48:11 -0500",
            "From: \"James K. Holroyd\" <ceo@partner-finance.example>",
            "Reply-To: jholroyd@protonmail-secure.example",
            "To: \"M. Caldwell\" <m.caldwell@partner.example>",
            "Subject: Closing settlement — wire today",
            "Date: Fri, 21 Nov 2026 14:48:00 -0500",
            "Message-ID: <38f2-1100-aabb@cheap-mail.example>",
            "X-Mailer: Outlook Express 6.00.2900.5512",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=\"utf-8\"",
            "",
            "M,",
            "",
            "I need a wire sent today for the closing I told you about.",
            "$48,500. New beneficiary, details below. Please use my",
            "personal email above for any questions — I am in back-to-back",
            "meetings and the boardroom phones are spotty.",
            "",
            "Do not loop in Susan or anyone in legal until the deal closes",
            "Monday. I'll explain everything then.",
            "",
            "Beneficiary: Coastal Closing Services LLC",
            "Routing:    *** (in attached note)",
            "Account:    *** (in attached note)",
            "Reference:  \"Q4 closing fee\"",
            "",
            "Thanks,",
            "James",
            "",
            "Sent from my iPhone",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "org-mail-policy.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              org_primary_domain: "partner.example",
              ceo_real_address: "j.holroyd@partner.example",
              spf_policy: "v=spf1 include:mx.partner.example -all",
              dkim: "enabled, d=partner.example, selector=2026q3",
              dmarc: "v=DMARC1; p=quarantine; rua=mailto:dmarc-rua@partner.example",
              note: "partner-finance.example is NOT a registered domain of this organization. The display name 'James K. Holroyd' matches the real CEO, but the address does not.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "ceo-recent-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "CFO's contemporaneous note (recorded before forwarding to ACI)",
            "--------------------------------------------------------------",
            "",
            "* James is at the industry conference in Denver this week.",
            "  He posted a keynote photo on LinkedIn yesterday afternoon.",
            "* The boardroom-phone comment doesn't fit; he's not at the",
            "  office today.",
            "* James has historically asked for off-cycle wires twice",
            "  before — always for under \\$5K, always with Susan in copy,",
            "  always from his real email.",
            "* I have not replied. I forwarded to ACI from a new thread,",
            "  not from the suspect email itself, and I did not click the",
            "  attachment.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "whaling-indicators",
        displayName: "Indicators bearing on the whaling assessment",
        items: [
          {
            id: "display-name-spoof",
            label:
              "The display name (\"James K. Holroyd\") matches the real CEO, but the address (`ceo@partner-finance.example`) is on a domain the org does not own.",
            evidenceRef: "suspect-email.eml.txt",
          },
          {
            id: "auth-failures",
            label:
              "SPF and DMARC both fail; DKIM is absent. The receiving MTA flagged the message for quarantine.",
            evidenceRef: "suspect-email.eml.txt",
          },
          {
            id: "reply-to-divergence",
            label:
              "Reply-To points to a personal-webmail address (`protonmail-secure.example`), not the From address.",
            evidenceRef: "suspect-email.eml.txt",
          },
          {
            id: "secrecy-pressure",
            label:
              "The message tells the CFO not to involve Susan or legal until after the deal closes.",
            evidenceRef: "suspect-email.eml.txt",
          },
          {
            id: "urgency-pressure",
            label:
              "\"Wire today\" framing for an off-cycle request the CFO would normally route through Susan.",
            evidenceRef: "suspect-email.eml.txt",
          },
          {
            id: "context-mismatch",
            label:
              "The CEO is publicly at a conference in Denver, not in a boardroom; the CFO's prior off-cycle pattern was different in amount and channel.",
            evidenceRef: "ceo-recent-context.txt",
          },
          {
            id: "outlook-express-mailer",
            label:
              "X-Mailer reports Outlook Express 6 — long-discontinued client; the CEO's normal mail uses Microsoft 365 / Outlook for Mac.",
            evidenceRef: "suspect-email.eml.txt",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "whaling-indicators",
        promptMd:
          "Pick the indicators that **most strongly support** treating this as a whaling lure rather than a legitimate off-cycle request.",
        expected: {
          type: "select_indicators",
          correctIds: [
            "display-name-spoof",
            "auth-failures",
            "reply-to-divergence",
            "secrecy-pressure",
            "context-mismatch",
          ],
        },
        debriefMd: [
          "**Strong:**",
          "",
          "- Display-name-vs-address mismatch is the canonical whaling tell.",
          "- SPF + DMARC failure with a public quarantine policy is documentary evidence the mail isn't from the claimed domain.",
          "- Reply-To divergence into personal webmail is a textbook hand-off vector.",
          "- The \"don't loop Susan in\" line is the social-engineering payload — bypassing the normal multi-eye process by exploiting executive trust.",
          "- The conference / boardroom contradiction is contextual evidence the sender doesn't know what the real CEO is doing today.",
          "",
          "**Weaker on their own (but worth noting):**",
          "",
          "- *Urgency framing* alone happens in legitimate executive emails too; weight it only in combination with the other tells.",
          "- *Outlook Express X-Mailer* is suggestive (no modern executive uses OE6) but headers are forgeable; treat as corroboration, not as proof.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What's the right immediate response set?",
        options: [
          {
            id: "hold-wire",
            label:
              "Tell the CFO to not send the wire and to not reply to the suspect message.",
          },
          {
            id: "verify-out-of-band",
            label:
              "Verify with the CEO through an independent channel (in-person, a known good phone number, or a separate thread to the CEO's verified address). Do not call any number provided in the suspect email.",
          },
          {
            id: "loop-aci-and-it",
            label:
              "Forward the suspect message (as an attachment, not inline) to the supporting ACI office and the IT security mailbox for header analysis and DMARC-report correlation.",
          },
          {
            id: "reply-asking-confirmation",
            label:
              "Reply to the suspect message asking the sender to confirm by quoting the beneficiary details back.",
          },
          {
            id: "post-to-team-chat",
            label:
              "Post a screenshot to the company-wide chat to warn everyone.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["hold-wire", "verify-out-of-band", "loop-aci-and-it"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right moves:**",
          "",
          "- Hold the wire. Verify out-of-band through a channel that doesn't depend on anything in the suspect email. Bring ACI + IT security in immediately.",
          "",
          "**Wrong moves:**",
          "",
          "- *Replying for confirmation* lets the attacker keep the conversation alive and frequently turns into a back-and-forth that pressures the target further. If the message is fake, the reply only goes to the attacker.",
          "- *Posting to company chat* contaminates witnesses, amplifies disclosure, and may compromise the response if the same threat actor is also active inside the org. Need-to-know channels only.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this message originates from the real CEO, based ONLY on the artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The header authentication failures alone push this well below \"trust by default.\" The display-name spoof, Reply-To divergence, secrecy pressure, and the context mismatch each compound. Treat this as a whaling lure until an out-of-band verification proves otherwise.",
      },
    ],
  },

  // ─── Spear phishing: OSINT-armed targeted lure ──────────────
  {
    slug: "insider-spearphish-osint-001",
    title: "Spear Phishing: OSINT-Armed Targeted Lure",
    summary:
      "A targeted lure lands on a specific analyst. The attacker has done their homework — name, project, a real conference. Tell the targeted from the merely opportunistic, and decide what changes when it's targeted.",
    skillAreas: ["email_headers", "bec", "inference_discipline", "report_writing"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["insider_risk", "spear_phishing", "osint", "email_headers", "inference_discipline"],
    lane: "insider_risk",
    module: "External lures aimed at insiders",
    sequence: 2,
    brief: `
# Brief

A junior CDTI candidate (\`r.alvi\`) on a critical-technology
research line forwards an email to your office. The message
greets her by full name, references an actual conference she
attended last month, names her supervisor, and includes a
"shared paper" link that looks like a OneDrive share.

The mail-security gateway scored it medium-suspicious (not
blocked); she didn't click the link.

Spear phishing differs from ordinary phishing in two ways that
matter for response:

1. The attacker has invested **time and OSINT** in the target.
   That's a different threat profile than a mass-mailed lure
   that happened to hit her inbox.
2. The attacker is **likely to try again** with a different
   pretext. A single deflected lure is a leading indicator, not
   a closed event.

Your job: identify the OSINT-tell indicators that mark this as
targeted, decide what changes in the response, and call out what
the artifacts do and do not establish about the attacker.

Reporting goes to both the supporting ACI office (CI angle) and
the unit's ISSM under AR 25-2 (Army Cybersecurity) for the
incident-response and DODIN-Army defensive-coordination angle.
The two channels are complementary, not duplicative.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "spear-message.eml.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Authentication-Results: mx.unit.example;",
            "    spf=pass smtp.mailfrom=p.bertin@conference-followups.example",
            "    dkim=pass d=conference-followups.example",
            "    dmarc=pass (p=none)",
            "From: \"Pierre Bertin\" <p.bertin@conference-followups.example>",
            "To: \"Rana Alvi\" <r.alvi@unit.example>",
            "Subject: Following up — your panel question last month",
            "Date: Wed, 19 Nov 2026 09:14:00 +0000",
            "Message-ID: <c2e1-bertin-aabb@conference-followups.example>",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=\"utf-8\"",
            "",
            "Hi Rana,",
            "",
            "Pierre Bertin here — we spoke briefly after the \"Emerging",
            "Adversary Tradecraft\" panel at the Quarterly Industry Forum",
            "in San Diego last month. You asked a sharp question about",
            "kinetic-non-kinetic crossover that I've been chewing on.",
            "",
            "I've shared a draft paper with you for review — I'd value the",
            "perspective of someone working under Major Cole on the program",
            "you mentioned. It's a Word document on OneDrive (you'll need",
            "to sign in with your work account):",
            "",
            "    https://onedrive-share.docs-secure.example/r.alvi/draft",
            "",
            "Happy to chat over coffee if you ever swing through DC.",
            "",
            "Best,",
            "Pierre",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "osint-trace.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Quick OSINT triage on the named individuals and the cited event.",
              target: {
                name: "Rana Alvi",
                role: "CDTI candidate, critical-technology research line",
                public_footprint: [
                  "LinkedIn: lists current employer and supervisor (Major Cole, named).",
                  "Conference attendee list (public): Quarterly Industry Forum, San Diego, October.",
                  "Panel question recorded in public Q&A video: yes, asked a kinetic/non-kinetic crossover question.",
                ],
              },
              alleged_sender: {
                name: "Pierre Bertin",
                claim: "Was on the same panel.",
                verification: "No 'Pierre Bertin' is listed on the public panel roster. No published papers under that name on the cited subject.",
              },
              link_destination: {
                visible_url: "https://onedrive-share.docs-secure.example/r.alvi/draft",
                actual_microsoft_onedrive_pattern: "1drv.ms / onedrive.live.com / *.sharepoint.com — never 'docs-secure.example'",
                note: "The hostname is not a Microsoft OneDrive domain.",
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
        slug: "spearphish-indicators",
        displayName: "Indicators bearing on the spear-phishing assessment",
        items: [
          {
            id: "named-specific-event",
            label:
              "The message references a real conference, a real panel, and Rana's actual question — content that requires non-trivial OSINT to assemble.",
            evidenceRef: "spear-message.eml.txt",
          },
          {
            id: "named-supervisor",
            label:
              "The message names Rana's supervisor (Major Cole) and her program by allusion.",
            evidenceRef: "spear-message.eml.txt",
          },
          {
            id: "sender-unverifiable",
            label:
              "OSINT triage cannot confirm a 'Pierre Bertin' on the panel roster or in published work on the cited topic.",
            evidenceRef: "osint-trace.json",
          },
          {
            id: "fake-onedrive-host",
            label:
              "The 'OneDrive' link is on a hostname (`onedrive-share.docs-secure.example`) that is not a Microsoft domain.",
            evidenceRef: "osint-trace.json",
          },
          {
            id: "credential-prompt-pretext",
            label:
              "The link text instructs Rana to sign in with her work account — a credential-prompt pretext typical of credential-harvest lures.",
            evidenceRef: "spear-message.eml.txt",
          },
          {
            id: "auth-passes",
            label:
              "SPF / DKIM / DMARC all pass for the sender domain `conference-followups.example`.",
            evidenceRef: "spear-message.eml.txt",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "spearphish-indicators",
        promptMd:
          "Pick the indicators that **most strongly support** characterising this as a *spear-phishing* lure (vs. an ordinary phish that happened to land on Rana).",
        expected: {
          type: "select_indicators",
          correctIds: [
            "named-specific-event",
            "named-supervisor",
            "sender-unverifiable",
            "fake-onedrive-host",
          ],
        },
        debriefMd: [
          "**Targeted:**",
          "",
          "- The cited panel + Rana's actual question + her supervisor's name + a hint at her program is OSINT investment beyond an opportunistic phish.",
          "- The sender identity doesn't survive a basic check; the attacker picked a plausible-sounding name and built a backstory around their target's footprint.",
          "- The link's hostname is a credential-harvest impostor of a real OneDrive share.",
          "",
          "**Not a targeting tell:**",
          "",
          "- *Auth passes* — attackers register lookalike domains specifically to pass SPF/DKIM/DMARC for that domain. It just proves the mail came from the domain in the From; it does not vouch for the *content*.",
          "- *Credential-prompt pretext* — this is what most phish do; it's not what makes this targeted.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What changes in the response because this is **spear** phishing rather than ordinary phishing?",
        options: [
          {
            id: "expect-second-attempt",
            label:
              "Treat this as the opening move of a campaign and expect a second, different lure (phone, LinkedIn DM, an alternate pretext) to follow. Brief Rana to flag any unusual follow-up contact.",
          },
          {
            id: "ci-loop",
            label:
              "Loop the supporting ACI office in, not just the IT security mailbox. Targeted attacks against a named CDTI candidate working a critical-technology line are CI-relevant on their face.",
          },
          {
            id: "tighten-osint",
            label:
              "Review Rana's public footprint (LinkedIn detail, public conference talks, public Q&A videos) and brief her on practical reductions; coordinate with the unit's CIAR-experienced person.",
          },
          {
            id: "block-and-forget",
            label:
              "Block the sender domain and consider the matter closed.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["expect-second-attempt", "ci-loop", "tighten-osint"],
          allowMultiple: true,
        },
        debriefMd:
          "A spear-phishing lure aimed at a specific CDTI candidate working a critical-technology line is qualitatively different from background phishing noise. It earns ACI involvement, a follow-up briefing for the target, and a posture that assumes more is coming. Blocking the sender domain alone is cheap insurance but doesn't address the campaign — only the first cheap step in it.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the attacker is specifically targeting Rana (vs. a mass campaign that happened to use her details).",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "**4 or 5.** The combination of conference-specific detail + her actual panel question + her supervisor's name + her program is far too specific to be incidental. The cost of assembling that OSINT for a single target is investment; the cost of repeating it across a mailing list is impractical.",
      },
    ],
  },

  // ─── Witting insider: long-tail low-volume exfil ────────────
  {
    slug: "insider-witting-long-tail-exfil-001",
    title: "Witting Insider: Long-Tail Low-Volume Exfil",
    summary:
      "A trusted long-tenure analyst's access pattern, read alone, looks ordinary. Six months of it, read together, doesn't. Identify the pattern that distinguishes diligent work from staged exfil.",
    skillAreas: ["account_compromise", "df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 4,
    estimatedMinutes: 30,
    tags: ["insider_risk", "witting_insider", "exfiltration", "inference_discipline"],
    lane: "insider_risk",
    module: "Witting insider patterns",
    sequence: 1,
    brief: `
# Brief

A senior analyst (\`d.kowalski\`, 11 years on the team, no
disciplinary record, broad standing access) appears in a routine
quarterly access-pattern review. Nothing in any single month
crosses a DLP threshold. The aggregate, viewed across six
months, has a shape that doesn't match the rest of the team.

This is the hard case. The classic witting-insider model
(Hanssen, Ames, and similar long-running cases) is not a single
spectacular event; it's a stable, low-noise pattern that hides
inside legitimate work. Detection requires reading **the shape
of the activity**, not any single transaction.

What you have:

- A monthly summary of d.kowalski's DMS document accesses over
  the trailing six months — by category, by access type.
- The same summary, anonymised, for the rest of the team for
  comparison.
- A short narrative of the analyst's stated role and the
  documents that are in-scope.

What you don't have (yet):

- DLP exfil events. There are none on file.
- Removable-media events. The host has had USB-write disabled
  by policy for two years.
- Email DLP hits. None.

The exercise is to read the pattern carefully and decide what
warrants escalation, what doesn't, and what additional
artifacts would close the question.

Witting-insider cases on DODIN-Army systems escalate through the
**Army Insider Threat Program** (AR 381-12 para 4-6) with the
supporting ACI office in the lead, and through the unit's ISSM
on the cybersecurity / access-control side (AR 25-2). Both
authorities exist for this reason; brief sparingly and on
need-to-know.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "dms-access-summary-6mo.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Splunk roll-up exported as CSV. Comparison row is the
          // analyst-team P50 over the same 6-month window so the
          // shape can be read at a glance.
          //
          //   index=m365 sourcetype=o365:management:activity
          //   Operations IN (FileAccessed, FilePreviewed, PageViewed,
          //                  FilePrinted, FileShareLinkCreated)
          //   earliest=2026-05-01 latest=2026-11-01
          //   | eval program=case(
          //       like(ObjectId, "/sites/programs/alpha/%"), "in-scope (program-A)",
          //       like(ObjectId, "/sites/programs/beta/%"),  "out-of-scope (program-B)",
          //       like(ObjectId, "/sites/programs/gamma/%"), "out-of-scope (program-C)")
          //   | bin _time span=1mon as month
          //   | stats count(eval(action=="read"))   as reads
          //           count(eval(action=="print"))  as prints
          //           count(eval(action=="share"))  as shares
          //           by month, program, user
          //   | join month program [...team-P50 sub-query...]
          //   | sort month program
          //   | outputcsv dms-access-summary-6mo.csv
          [
            "month,program,reads_kowalski,prints_kowalski,share_link_creates_kowalski,team_p50_reads,team_p50_prints,team_p50_share_creates",
            "2026-05,in-scope (program-A),412,3,2,408,4,2",
            "2026-05,out-of-scope (program-B),18,0,1,2,0,0",
            "2026-05,out-of-scope (program-C),22,0,0,1,0,0",
            "2026-06,in-scope (program-A),401,4,1,420,3,2",
            "2026-06,out-of-scope (program-B),15,0,0,3,0,0",
            "2026-06,out-of-scope (program-C),20,0,1,1,0,0",
            "2026-07,in-scope (program-A),438,2,3,431,3,2",
            "2026-07,out-of-scope (program-B),24,0,1,2,0,0",
            "2026-07,out-of-scope (program-C),19,0,0,1,0,0",
            "2026-08,in-scope (program-A),394,5,2,418,3,2",
            "2026-08,out-of-scope (program-B),22,0,2,3,0,0",
            "2026-08,out-of-scope (program-C),21,0,0,1,0,0",
            "2026-09,in-scope (program-A),412,3,1,422,4,2",
            "2026-09,out-of-scope (program-B),19,0,1,2,0,0",
            "2026-09,out-of-scope (program-C),23,0,1,1,0,0",
            "2026-10,in-scope (program-A),405,4,2,415,3,2",
            "2026-10,out-of-scope (program-B),20,0,2,2,0,0",
            "2026-10,out-of-scope (program-C),22,0,1,1,0,0",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "role-and-scope.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Subject:   d.kowalski",
            "Role:      Senior analyst, Program-A (in-scope)",
            "Tenure:    11 years, no disciplinary record, no PIP, no",
            "           security-clearance issues on file.",
            "",
            "In-scope:  Program-A documents (research line A) — read,",
            "           print, share-link as needed.",
            "Out-of-scope (not blocked, but flagged on review):",
            "           Program-B and Program-C documents.",
            "           d.kowalski has no current named role on B or C",
            "           and no prior project history on either.",
            "",
            "Stated reason (per d.kowalski's 2026 self-review):",
            "           \"Cross-reading adjacent programs to stay sharp",
            "            on the broader portfolio.\"",
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
          "Reading the six-month pattern, which statements are **supported by the data as shown**?",
        options: [
          {
            id: "in-scope-baseline",
            label:
              "d.kowalski's in-scope (Program-A) read volume is consistent with the rest of the team's median month-over-month.",
          },
          {
            id: "out-of-scope-elevated",
            label:
              "On Programs B and C — where d.kowalski has no named role — her read volume is roughly 10× the team's median month after month, and she repeatedly creates share-links on out-of-scope material.",
          },
          {
            id: "single-month-anomaly",
            label:
              "There is a single anomalous month that explains the pattern; the rest of the months look normal.",
          },
          {
            id: "prints-elevated",
            label:
              "Print volume is significantly elevated compared to the team baseline.",
          },
          {
            id: "share-link-shape",
            label:
              "Across the six months, d.kowalski's share-link creates on out-of-scope material total 9 — the team median creates none on out-of-scope material.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["in-scope-baseline", "out-of-scope-elevated", "share-link-shape"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Supported:**",
          "",
          "- The in-scope baseline matches the team — that's exactly what makes the case hard. A reviewer looking at a single month's in-scope activity would see nothing of interest.",
          "- The out-of-scope shape is the real signal: persistent reads at 10× team median, with share-link creates accumulating across the period. The size of any single transaction is normal; the *shape* across six months is not.",
          "- Share-link creates on out-of-scope material totalling 9 across six months — small numbers individually, distinctive in aggregate.",
          "",
          "**Not supported:**",
          "",
          "- *Single anomalous month* — the pattern repeats every month; it is not an episode.",
          "- *Prints elevated* — print counts track the team baseline; nothing there.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What is the right characterisation of d.kowalski's stated reason (\"cross-reading adjacent programs to stay sharp\") given the data?",
        options: [
          {
            id: "plausible-but-weak",
            label:
              "Plausible at the level of an explanation; weakly supported by the pattern (which shows persistent share-link creation, not just reading) and worth pressing in a structured interview.",
          },
          {
            id: "exonerating",
            label:
              "Exonerating — the explanation is consistent with the data, and no further action is warranted.",
          },
          {
            id: "self-incriminating",
            label:
              "Self-incriminating — the analyst should be removed from access immediately on the strength of the statement alone.",
          },
          {
            id: "ignored",
            label:
              "Irrelevant — the stated reason has no bearing on the review.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["plausible-but-weak"],
          allowMultiple: false,
        },
        debriefMd:
          "Stated reasons are evidence; treat them as such. \"Cross-reading to stay sharp\" can explain *reads* but is a weaker fit for *share-link creates*, which produce externally-accessible URLs to specific documents. Press on the share-link activity in a structured interview before either exonerating or moving to a denial-of-access. Avoid both ends — neither \"nothing to see here\" nor \"strip access today.\"",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which next steps would most directly close the question?",
        options: [
          {
            id: "share-link-audit",
            label:
              "Pull the actual recipients and reuse counts for each of the 9 out-of-scope share-links: are they shared with named teammates with a legitimate need, with a single external account, or with no further access after creation?",
          },
          {
            id: "interview-structured",
            label:
              "Schedule a structured interview through the supporting ACI office and the unit's CI-experienced person, not a casual one-on-one with the supervisor.",
          },
          {
            id: "expand-window",
            label:
              "Extend the access-pattern review to the prior 12–18 months to confirm whether the shape pre-dates the six-month window.",
          },
          {
            id: "polygraph-now",
            label:
              "Schedule a polygraph immediately on the strength of the pattern alone.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["share-link-audit", "interview-structured", "expand-window"],
          allowMultiple: true,
        },
        debriefMd:
          "Share-link recipient + reuse audit is the highest-yield artifact — it converts a *shape* observation into a *destination* observation. Extending the window confirms whether the pattern is a recent change or stable behaviour. The structured interview is the right human step; do it through ACI, not casually. A polygraph is a downstream tool managed under separate authority and procedure — it isn't the first move on a quarterly review.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that d.kowalski is wittingly exfiltrating program material, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**3 (or thereabouts).** The pattern is too consistent and too out-of-scope to dismiss, but the artifacts do not show *where* the share-links resolve or *who* (if anyone) the material reached. A confidence-5 finding here would be over-claim. Close the recipient / reuse question and run the structured interview; that's where 3 either rises or drops.",
      },
    ],
  },

  // ─── Unwitting insider: compromised credentials behaviour ───
  {
    slug: "insider-unwitting-credential-compromise-001",
    title: "Unwitting Insider: Compromised Credentials Driving the Account",
    summary:
      "An analyst clicked a credential-harvest lure last week. Their account is now active in unexpected ways. Distinguish \"user behaved differently\" from \"the account is being driven by someone else.\"",
    skillAreas: ["account_compromise", "network_logs", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["insider_risk", "credential_compromise", "account_compromise", "network_logs", "inference_discipline"],
    lane: "insider_risk",
    module: "Compromised-account patterns",
    sequence: 1,
    brief: `
# Brief

Seven days ago, \`m.santos\` reported clicking through a
credential-harvest page that prompted for her work password.
IT reset her password and pushed an MFA re-enrollment that
afternoon. She is otherwise an unremarkable user with a steady,
predictable access pattern.

Today, your SIEM flags her account on three independent signals
in a 24-hour window. The question is whether to treat this as
"user behaved differently" (a benign explanation exists) or
"the account is being driven by someone else" (a malicious
actor is now inside the perimeter under her identity).

This is the unwitting-insider case: the user didn't act against
the unit, but their **account did**. Detection is a question of
distinguishing the actor.

On DODIN-Army systems, credential-compromise incidents also flow
through the unit's ISSM to the appropriate Army cyber-incident
reporting channel under AR 25-2 alongside any ACI involvement.
The hardware-MFA-vs-push consideration in the response set
reflects standard Army PKI / CAC posture for high-value
accounts.

## Artifacts

- **auth-events-24h.csv** — interactive logons (Win EID 4624)
  and Azure-AD sign-in events for the account in the last day.
- **resource-access-24h.csv** — DMS reads, SharePoint reads, and
  mailbox-rule modifications attributed to the account.
- **m-santos-baseline.json** — short profile of m.santos's
  pre-incident pattern (timezone, devices, role-scope).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "auth-events-24h.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Splunk search joining three sourcetypes scoped to one
          // account over the analyst-time window:
          //   index=auth (sourcetype=ms:aad:signinlogs
          //               OR sourcetype=WinEventLog:Security
          //               OR sourcetype=o365:management:activity)
          //   user=m.santos@corp.example
          //   earliest=2026-11-21T08:00:00Z latest=2026-11-22T03:00:00Z
          //   | table _time, sourcetype, event, source_ip, country,
          //           device, client, result, details
          //   | sort _time
          //   | outputcsv auth-events-24h.csv
          [
            "_time,sourcetype,event,source_ip,country,device,client,result,details",
            "2026-11-21T08:02:14Z,WinEventLog:Security,4624 interactive logon,10.0.5.81,US,WS-1402,Windows 10,Success,\"LogonType=2\"",
            "2026-11-21T08:05:00Z,ms:aad:signinlogs,SignIn,10.0.5.81,US,WS-1402,Edge 134 on Win10,Success,\"DeviceCompliance=True; MFAMethod=DeviceTrust\"",
            "2026-11-21T11:47:19Z,ms:aad:signinlogs,SignIn,203.0.113.66,SG,-,Chrome 132 on Win11,Success,\"DeviceCompliance=False; MFAMethod=Push (Microsoft Authenticator)\"",
            "2026-11-21T11:48:02Z,o365:management:activity,New-InboxRule,-,-,-,Exchange Online PowerShell,Success,\"RuleName='forward-and-delete'; ForwardTo='external'\"",
            "2026-11-21T13:14:45Z,ms:aad:signinlogs,SignIn,203.0.113.66,SG,-,Chrome 132 on Win11,Success,\"DeviceCompliance=False\"",
            "2026-11-21T17:30:11Z,WinEventLog:Security,4624 interactive logon,10.0.5.81,US,WS-1402,Windows 10,Success,\"LogonType=2\"",
            "2026-11-22T02:05:30Z,ms:aad:signinlogs,SignIn,203.0.113.66,SG,-,Chrome 132 on Win11,Success,\"DeviceCompliance=False\"",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "resource-access-24h.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Microsoft 365 Unified Audit Log export:
          //   Search-UnifiedAuditLog
          //     -UserIds m.santos@corp.example
          //     -StartDate 2026-11-21T08:00:00Z
          //     -EndDate   2026-11-22T03:00:00Z
          //     -Operations FileAccessed,FileDownloaded,New-InboxRule,
          //                 Set-InboxRule,Set-Mailbox
          //     -ResultSize 5000
          //   | Export-Csv -NoTypeInformation
          [
            "CreationDate,UserIds,Operations,RecordType,Workload,ClientIP,ObjectId",
            "2026-11-21T08:15:00Z,m.santos@corp.example,FileAccessed,SharePointFileOperation,SharePoint,10.0.5.81,/sites/program-A/weekly-status.docx",
            "2026-11-21T09:42:00Z,m.santos@corp.example,FileAccessed,SharePointFileOperation,SharePoint,10.0.5.81,/sites/program-A/draft-handoff.docx",
            "2026-11-21T11:50:00Z,m.santos@corp.example,New-InboxRule,ExchangeAdmin,Exchange,203.0.113.66,\"Name='forward-and-delete'; ForwardTo='attacker@external'; DeleteMessage=$true\"",
            "2026-11-21T11:55:00Z,m.santos@corp.example,FileAccessed,SharePointFileOperation,SharePoint,203.0.113.66,/sites/program-A/contacts.xlsx",
            "2026-11-21T11:57:00Z,m.santos@corp.example,FileAccessed,SharePointFileOperation,SharePoint,203.0.113.66,/sites/program-A/vendors-payments-2026.xlsx",
            "2026-11-21T11:59:00Z,m.santos@corp.example,FileDownloaded,SharePointFileOperation,SharePoint,203.0.113.66,/sites/program-A/vendors-payments-2026.xlsx",
            "2026-11-21T13:20:00Z,m.santos@corp.example,FileAccessed,SharePointFileOperation,SharePoint,10.0.5.81,/sites/program-A/weekly-status.docx",
            "2026-11-22T02:10:00Z,m.santos@corp.example,FileDownloaded,SharePointFileOperation,SharePoint,203.0.113.66,/sites/program-A/contacts.xlsx",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "m-santos-baseline.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              primary_office: "US East",
              normal_work_hours_local: "07:30-17:30, M-F",
              known_devices: ["WS-1402", "iPhone (MFA push)"],
              travel_status: "no foreign travel on calendar in the past 90 days; not currently on travel orders",
              typical_resources: "Program-A documents only",
              typical_mailbox_activity: "no historical use of forwarding rules",
              note: "Password and MFA were reset 7 days ago after a credential-harvest click. Account is otherwise unremarkable.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "compromise-indicators",
        displayName: "Indicators bearing on the account-compromise assessment",
        items: [
          {
            id: "geo-impossible",
            label:
              "Concurrent successful sessions from a US office IP (with normal workstation telemetry) and from a Singapore IP (unknown device, Chrome on Win11) — distance + travel time makes both being the same person physically implausible.",
            evidenceRef: "auth-events-24h.csv",
          },
          {
            id: "mfa-satisfied-mystery",
            label:
              "The Singapore sign-in satisfied MFA via push — but the user's only registered MFA device is her iPhone, which is with her in the US.",
            evidenceRef: "auth-events-24h.csv",
          },
          {
            id: "mail-rule-creation",
            label:
              "A \"forward-and-delete\" mailbox rule was created from the Singapore session minutes after sign-in — a canonical attacker-persistence move on a compromised mailbox.",
            evidenceRef: "auth-events-24h.csv",
          },
          {
            id: "resource-pattern-shift",
            label:
              "The Singapore session reads + downloads documents (vendors-payments-2026.xlsx) that m.santos has no historical access pattern for; the US sessions stay within her usual program-A working set.",
            evidenceRef: "resource-access-24h.csv",
          },
          {
            id: "off-hours-access",
            label:
              "A 02:10Z download from Singapore — daytime in Singapore, middle of the night in m.santos's home timezone.",
            evidenceRef: "resource-access-24h.csv",
          },
          {
            id: "us-sessions-normal",
            label:
              "The US-sourced workstation logons are at their usual times and touch their usual resources.",
            evidenceRef: "auth-events-24h.csv",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "compromise-indicators",
        promptMd:
          "Pick the indicators that **most strongly support** treating the account as **driven by a second actor**, not merely \"the user behaved differently.\"",
        expected: {
          type: "select_indicators",
          correctIds: [
            "geo-impossible",
            "mfa-satisfied-mystery",
            "mail-rule-creation",
            "resource-pattern-shift",
            "off-hours-access",
          ],
        },
        debriefMd: [
          "**Strong:**",
          "",
          "- Geo-impossibility: a single person cannot be in both places concurrently. The US session has normal device telemetry; the SG session is from an unknown device.",
          "- MFA satisfied from SG without the user's registered device being in SG is a separate signal — push fatigue, SIM swap, or a compromised secondary factor are all real possibilities.",
          "- Mailbox \"forward-and-delete\" rule is a textbook attacker persistence move on a compromised mailbox.",
          "- Resource pattern shift to vendors-payments is exactly what a financially-motivated attacker on a compromised business account does.",
          "- Off-hours access from the SG IP aligns with the attacker's daytime, not the user's.",
          "",
          "**Not a tell of compromise:**",
          "",
          "- *US sessions normal* — proves the user is still using her account from her workstation. It doesn't argue against compromise; it argues for *concurrent* compromise (which is what the other signals show).",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Right immediate response set:",
        options: [
          {
            id: "revoke-tokens",
            label:
              "Revoke all active sessions for the account and force password + MFA re-enrollment again, ideally with hardware-token MFA rather than push.",
          },
          {
            id: "preserve-mail-rule",
            label:
              "Preserve the forward-and-delete rule (and its destination) before removing it — the recipient is itself evidence and a likely indicator of the attacker's infrastructure.",
          },
          {
            id: "interview-m-santos",
            label:
              "Brief m.santos in person, calmly: she is the affected party, not the suspect. Confirm she didn't travel, didn't create the rule, didn't approve a strange push. Coordinate IT + the supporting ACI office; do not blame her for clicking the original lure.",
          },
          {
            id: "lock-and-walk-away",
            label:
              "Disable the account immediately, leave the account in a locked state until the next IT review cycle, and consider the matter closed once the attacker can no longer authenticate as m.santos. The active session being severed removes the immediate threat and the matter can be handled administratively from there without further investigation steps.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["revoke-tokens", "preserve-mail-rule", "interview-m-santos"],
          allowMultiple: true,
        },
        debriefMd:
          "Containment + evidence preservation + a careful interview. The user is the victim — the response posture matters; a punitive interview chills future reporting. Don't \"lock and walk away\" before preserving the forward destination; that's the attacker's tell.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the SG-sourced activity is a **second actor driving the account**, not m.santos herself.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "**4 or 5.** Geo-impossibility + concurrent US-sourced normal behaviour + the forward-and-delete rule + the resource-pattern shift to a financially-relevant artifact is a compound signal that's hard to interpret any other way. Hold at 4 unless you've eliminated the (rare but real) possibility of a delegated session, a session token already exfiltrated and replayed from a different ASN, or another technical wrinkle — the interview answers most of those quickly.",
      },
    ],
  },

  // ─── CAC failure + unfamiliar process: owner-routing drill ──
  {
    slug: "insider-cac-failure-unfamiliar-process-001",
    title: "Help-Desk Walk-In: Failing CAC, Unfamiliar Process",
    summary:
      "A contractor with a non-working CAC asks the J6 help desk for a temporary local account so he can finish a deliverable. Read the ticket, separate the routine from the off-pattern, and route to the right owners.",
    skillAreas: ["account_compromise", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 18,
    tags: ["insider_risk", "owner_routing", "cac", "ar25_2", "ar381_12", "inference_discipline"],
    lane: "insider_risk",
    module: "Identity verification & owner routing",
    sequence: 1,
    brief: `
# Brief

A walk-in arrives at the J6 service desk on a Friday afternoon.
He identifies himself as **W. Pham**, a contractor supporting
Program Gamma under contract **W91XYZ-25-D-0044**, and says his
CAC stopped working at the badge reader this morning. He is
asking the help-desk technician to **create a local non-CAC
account** on a workstation in the team room so he can finish a
deliverable due to the contracting officer's representative
(COR) by close of business.

The technician hesitates and forwards the ticket to your queue
with a short note. Your job is to triage: separate what is a
routine CAC-lifecycle issue (handled outside cyber) from what
is a cyber-boundary touch that needs an ISSM call, and from
what — if anything — has the shape of an identity-proofing
bypass attempt that needs the supporting ACI office in the
loop.

> A failing CAC is, by itself, an extremely common help-desk
> issue. The owner-routing question is sharpened by the **request
> that accompanies it**, the **requester's recent history**, and
> the **process being skipped**. Read each independently before
> combining them.

This is a routing exercise. There is no malicious-actor finding
hidden in the artifacts; the exercise is to demonstrate that you
can put each observation in front of the correct owner under
the existing Army cybersecurity / counterintelligence framework.

## Artifacts

- **help-desk-ticket.txt** — the original ticket text and the
  technician's forwarding note.
- **requester-context.json** — what the IDM / contracts system
  knows about W. Pham (sponsor, clearance level, CAC status from
  RAPIDS, prior support tickets).
- **recent-ticket-history.csv** — Pham's help-desk tickets over
  the last 30 days.
- **owner-reference.txt** — short reference card listing the
  Army owners typically involved in this class of ticket.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "help-desk-ticket.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Ticket: SD-2026-11-21-04417",
            "Opened: 2026-11-21 14:08 local (Friday)",
            "Channel: walk-in, J6 service desk (Bldg 4250)",
            "Requester: PHAM, W. (claimed; CAC not readable at counter)",
            "Visit purpose (verbatim, recorded by tech):",
            "  \"My CAC stopped scanning this morning. I have a deliverable",
            "  due to my COR by 1700 today. Can you spin me up a local",
            "  account on one of the team-room workstations so I can",
            "  finish it? It only needs to last until Monday — I'll go to",
            "  RAPIDS first thing then.\"",
            "",
            "Tech forwarding note (J. Adekunle, GS-7):",
            "  \"He doesn't have a visitor escort with him. I asked him to",
            "  step over to RAPIDS to verify the CAC; he said the line is",
            "  too long and that the COR is waiting. He offered to have",
            "  another contractor on his team 'just log him in real quick'",
            "  on a shared workstation. I declined and routed the ticket",
            "  to you for direction. He is sitting in the lobby.\"",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "requester-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              identity: {
                claimed_name: "W. Pham",
                idm_record_present: true,
                cac_in_rapids: "issued 2025-03; valid through 2027-03",
                cac_recent_status: "no revocation recorded; PIN-failure counter at 2 of 3",
                clearance: "SECRET, in-scope, valid",
              },
              employment: {
                employer: "Gamma Tech Services, LLC",
                contract_number: "W91XYZ-25-D-0044",
                cor: "MAJ R. Okonkwo (Program Gamma)",
                sponsor_on_file: "Gamma Program PMO, last verified 2026-10-02",
              },
              accesses: {
                niprnet: "yes (Gamma project SharePoint, dev jumpbox)",
                local_admin: "no",
                privileged_groups: "none",
              },
              note:
                "Local non-CAC accounts on DODIN-Army networks require a documented exception per AR 25-2 and a privileged-access justification when on shared / team-room hardware. The standard remediation for an unreadable CAC is a RAPIDS visit (PIN reset or chip replacement) — not a local account workaround.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "recent-ticket-history.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // ServiceNow incident-table export — `sys_dictionary_label`
          // header (selected columns), filtered by caller and date
          // range. Numbers are the standard INC0000000 sequence;
          // priorities are 1=Critical … 5=Planning.
          [
            "number,opened_at,caller_id,contact_type,short_description,close_notes,priority,state",
            "INC0014229,2026-10-29 09:12:14,Pham W.,phone,\"CAC PIN locked after travel\",\"Caller stepped to RAPIDS; PIN reset same day. Closed.\",4,Closed",
            "INC0014401,2026-11-10 13:31:50,Pham W.,email,\"Local-admin rights on team-room WS requested for 'installing a tool'\",\"Denied. Privileged-access change request not on contract. Referred to KO + PMO via change-control process.\",4,Closed",
            "INC0014502,2026-11-17 15:04:22,Pham W.,walk-in,\"Asked to be added to J6 helpdesk-admins AD group 'to save a step'\",\"Denied. Outside scope of contract privileges.\",4,Closed",
            "INC0014617,2026-11-21 14:08:11,Pham W.,walk-in,\"Failing CAC + request for local non-CAC account\",,3,In Progress",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "owner-reference.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Owner-routing reference card (training extract)",
            "-----------------------------------------------",
            "",
            "RAPIDS / LRA / TASS",
            "  - CAC PIN unlock, certificate re-issue, chip replacement.",
            "  - Verifies sponsor and identity-proofing for new CAC issuance.",
            "  - Not a cyber-incident owner; an identity-lifecycle owner.",
            "",
            "Unit ISSM (per AR 25-2)",
            "  - Owns local cybersecurity service provider coordination,",
            "    account-creation exception requests, privileged-access",
            "    management decisions, and cyberspace-incident reporting.",
            "  - The right owner for ANY request that asks cyber controls",
            "    to be bypassed or relaxed (e.g. local account in lieu of",
            "    CAC; non-routine group membership; shared credential use).",
            "",
            "Supporting ACI office (per AR 381-12)",
            "  - Owns counterintelligence indicators including elicitation,",
            "    attempted access inconsistent with duty requirements, and",
            "    patterns of small probing requests across multiple",
            "    venues. Insider concerns that don't yet rise to the level",
            "    of a finding still flow here as referrals.",
            "",
            "KO / COR (Contracting)",
            "  - Owns contract performance issues. If a contractor's",
            "    deliverable is at risk because they can't log on, the COR",
            "    and KO own the deliverable-extension or substitution",
            "    decision — not cyber.",
            "",
            "USACIDC",
            "  - Criminal-investigative authority for offences against",
            "    DODIN-Army systems. Engaged downstream by ISSM / ACI",
            "    when a referral develops into a criminal lead.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "cac-routing-indicators",
        displayName: "Observations to triage and route",
        items: [
          {
            id: "cac-not-reading",
            label:
              "The CAC will not scan at the help-desk counter; PIN-failure counter sits at 2 of 3 in RAPIDS.",
            evidenceRef: "requester-context.json",
          },
          {
            id: "request-local-account",
            label:
              "The requester is asking for a **local non-CAC account** on a team-room workstation in lieu of going to RAPIDS.",
            evidenceRef: "help-desk-ticket.txt",
          },
          {
            id: "request-borrowed-login",
            label:
              "The requester offered to have another contractor on his team \"just log him in real quick\" on a shared workstation — i.e. credential / session sharing.",
            evidenceRef: "help-desk-ticket.txt",
          },
          {
            id: "no-visitor-escort",
            label:
              "He is a walk-in without a visitor escort, but his IDM / contract record is present and his clearance is in-scope.",
            evidenceRef: "requester-context.json",
          },
          {
            id: "small-probing-pattern",
            label:
              "Recent ticket history shows a pattern of requests that each ask for a small relaxation of controls (local-admin, helpdesk-admins group, now a local account) — each denied for routine reasons.",
            evidenceRef: "recent-ticket-history.csv",
          },
          {
            id: "cor-deadline-pressure",
            label:
              "He is invoking a same-day deliverable to the COR as the reason to skip the normal RAPIDS process.",
            evidenceRef: "help-desk-ticket.txt",
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
          "Which statements about this ticket are **facts** at the point of triage?",
        options: [
          {
            id: "cac-unreadable",
            label:
              "The CAC failed to scan at the help-desk counter and the RAPIDS-side PIN-failure counter shows 2 of 3.",
          },
          {
            id: "asked-local-account",
            label:
              "The requester explicitly asked for a local non-CAC account on a team-room workstation.",
          },
          {
            id: "is-impersonator",
            label:
              "The walk-in is not actually W. Pham — someone is impersonating the real contractor.",
          },
          {
            id: "is-witting-insider",
            label:
              "The requester is a witting insider attempting to exfiltrate Program Gamma data.",
          },
          {
            id: "is-just-frustrated",
            label:
              "This is solely a frustrated contractor under deadline pressure with no security implication.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["cac-unreadable", "asked-local-account"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- CAC unreadable at the counter; RAPIDS shows the PIN-failure counter mid-way. This is a routine identity-lifecycle observation.",
          "- The local-account request is something the technician documented in the ticket as a verbatim quote.",
          "",
          "**Not fact (yet):**",
          "",
          "- *Impersonation* — there is no evidence the walk-in isn't Pham; the IDM record matches, clearance is in-scope. RAPIDS in-person verification would close this question definitively, but assuming impersonation now is unsupported.",
          "- *Witting insider* — the pattern is suggestive enough to refer (see below), but a referral is a lead, not a finding.",
          "- *Solely frustration* — equally unsupported. Frustration is a plausible explanation; it does not displace the routing obligation.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "cac-routing-indicators",
        promptMd:
          "Pick the observations that **belong on the cyber / counterintelligence track** (i.e. should reach the ISSM and/or the supporting ACI office), rather than being a pure identity-lifecycle / contract-performance matter.",
        expected: {
          type: "select_indicators",
          correctIds: [
            "request-local-account",
            "request-borrowed-login",
            "small-probing-pattern",
          ],
        },
        debriefMd: [
          "**On the cyber / CI track:**",
          "",
          "- Request for a local non-CAC account: that is asking for an explicit cybersecurity-control exception. ISSM under AR 25-2 owns the exception decision; routine help-desk staff do not.",
          "- Request for a shared / borrowed login: credential sharing on DODIN-Army systems is a clear cyber boundary issue and cannot be done as a courtesy.",
          "- Pattern of small probing requests across multiple venues (local-admin, helpdesk-admins, now local account) is one of the named elicitation-shaped patterns the supporting ACI office screens for under AR 381-12 — even when each individual ticket has a plausible cover story.",
          "",
          "**Not on the cyber / CI track:**",
          "",
          "- *Failing CAC at the counter* — pure RAPIDS / LRA matter.",
          "- *No visitor escort but valid IDM + clearance* — a facility-process question, not a cyber one; building security or the sponsor would address it.",
          "- *COR deadline pressure* — contract performance is the COR / KO's problem, not the help desk's, and not a justification for relaxing controls.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Pick the **correct owner routing** for this ticket. Multiple owners may apply.",
        options: [
          {
            id: "to-rapids",
            label:
              "Send the requester to RAPIDS for in-person verification, PIN reset, and (if needed) chip replacement.",
          },
          {
            id: "to-issm",
            label:
              "Refer the local-account / borrowed-login request to the unit ISSM as a cybersecurity-exception decision under AR 25-2.",
          },
          {
            id: "to-aci",
            label:
              "Refer the pattern of small probing requests (across multiple venues) to the supporting ACI office under AR 381-12 as an articulable-conduct lead, with a non-attributive description of the requests — not as a finding.",
          },
          {
            id: "to-cor",
            label:
              "Notify the COR + KO that the contractor cannot meet today's deliverable through cyber-permitted means, so the deliverable schedule (not the controls) gets adjusted.",
          },
          {
            id: "spin-up-account",
            label:
              "Spin up the local non-CAC account on the team-room workstation as a one-time courtesy, document it, and let it expire Monday.",
          },
          {
            id: "call-cidc",
            label:
              "Open a USACIDC criminal-investigative case immediately on the strength of this ticket.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["to-rapids", "to-issm", "to-aci", "to-cor"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right routes (all four):**",
          "",
          "- RAPIDS owns CAC-lifecycle remediation. That's where the CAC question goes.",
          "- The unit ISSM owns cybersecurity exceptions under AR 25-2. The local-account / borrowed-login asks are exception requests; only the ISSM is authorised to grant or deny them, and \"no\" is by far the most likely defensible answer here.",
          "- The supporting ACI office owns the pattern observation under AR 381-12 (Army Insider Threat Program; TARP). Send it as a referral — the pattern of three small relaxation requests across three venues, the way the deadline was used as leverage — not as a substantiated finding.",
          "- The COR + KO own contract performance. Tell them today; they own the deliverable-extension or substitution decision.",
          "",
          "**Wrong:**",
          "",
          "- *Spinning up the local account as a courtesy* is exactly the failure mode the policy exists to prevent. \"Just this once, just till Monday\" is how a documented cyber-exception process gets bypassed by goodwill.",
          "- *USACIDC* is a downstream owner. No criminal predicate has been articulated; opening a case off a help-desk routing question is a misuse of that authority.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this ticket should be closed today **without** notifying the unit ISSM.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The local-account ask is a cybersecurity-exception request; closing it as a routine help-desk no without informing the ISSM means the ISSM never sees the *pattern* the ticket history exposes. The point of routing is not that any one ticket is alarming on its own — it is that the right owner gets to see all of their tickets.\n\n**Owners.** RAPIDS for the CAC. Unit ISSM under AR 25-2 for the local-account / borrowed-login exception ask. Supporting ACI office under AR 381-12 for the pattern-of-probing-requests referral. COR + KO for the contract-performance reschedule. The help desk's job is to keep its lane and send each piece to the lane that owns it.",
      },
    ],
  },

  // ─── Quarterly recertification: orphan privileged account ───
  {
    slug: "insider-recertification-orphan-admin-001",
    title: "Recertification: An Orphan Privileged Account",
    summary:
      "A quarterly access review surfaces a Domain Admin equivalent account with no documented owner, a long dormancy, and a recent burst of failed logons. Decide what category — or categories — this belongs in.",
    skillAreas: ["account_compromise", "df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 22,
    tags: ["insider_risk", "owner_routing", "privileged_access", "recertification", "ar25_2", "inference_discipline"],
    lane: "insider_risk",
    module: "Account governance",
    sequence: 1,
    brief: `
# Brief

You are doing the quarterly privileged-account recertification
for a brigade-equivalent unit's Active Directory forest. The
recert tooling has surfaced a single row that nobody on the
account-review team can immediately explain.

The account — \`svc-rebuild-admin\` — is a member of a group
nested into **Domain Admins**. It has no documented owner in
the privileged-access register, the user who created it has
been off the rolls for over a year, and the workstation it
last successfully authenticated from has been physically
decommissioned. There has been no successful logon in 13
months. In the last 30 days, however, the account has accrued
a number of failed-logon events from a single developer
workstation that *does* still exist.

> The hard step here is **not** producing a one-sentence
> verdict. It is recognising that the row sits in more than one
> reportable category at the same time, and routing it
> accordingly. "Hygiene problem" and "possible compromise" are
> not mutually exclusive — a privileged orphan account is both,
> and a defensible response treats it as both.

You will read:

- The single recertification row, as the tooling presents it.
- A 30-day slice of authentication events for the account.
- A short reference on the local privileged-access policy and
  what "orphan" means in the recert taxonomy.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "recert-row.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              account: "CORP\\svc-rebuild-admin",
              account_type: "user (not gMSA)",
              created_utc: "2024-06-12T19:44:00Z",
              created_by: "CORP\\b.maddox (DEPARTED 2024-11-30 — account disabled, then deleted 2025-03-01)",
              direct_group_memberships: [
                "rebuild-ops",
              ],
              nested_into: [
                "Domain Admins (via rebuild-ops → tier0-ops → Domain Admins)",
              ],
              documented_owner_in_pam_register: null,
              last_password_change_utc: "2024-06-12T19:44:30Z",
              last_successful_logon_utc: "2025-04-04T03:11:00Z",
              last_successful_logon_host: "OLD-DC-RETIRE (decommissioned 2025-05; chassis turned in 2025-06)",
              recent_failed_logon_count_30d: 14,
              recent_failed_logon_source_hosts: ["WS-DEV-217"],
              recert_attestation_status: "no owner has attested in two prior cycles",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "auth-events-30d.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // EvtxECmd.exe -f C:\Cases\Domain\DC-01-Security.evtx
          //   --inc 4625
          //   --start "2026-10-25 00:00" --end "2026-11-22 00:00"
          //   --search "svc-rebuild-admin"
          //   --csv . --csvf auth-events-30d.csv
          // (Excerpt: all 14 rows.  TargetUserName is the account
          //  being authenticated AGAINST; the workstation that
          //  initiated the attempt sits in WorkstationName.)
          [
            "TimeCreated,EventId,Computer,TargetUserName,SubStatus,LogonType,WorkstationName,IpAddress",
            "2026-10-27T13:02:11Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-10-27T13:02:14Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-10-29T09:18:50Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-02T17:44:01Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-02T17:44:03Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-08T11:21:00Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-12T08:55:11Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-12T08:55:13Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-15T20:02:22Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-18T07:31:01Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-18T07:31:04Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-19T16:42:45Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-19T16:42:47Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
            "2026-11-21T10:15:00Z,4625,DC-01.corp,svc-rebuild-admin,0xC000006A,3 (Network),WS-DEV-217,10.40.7.217",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "pam-policy-note.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Local privileged-access policy (training extract)",
            "-------------------------------------------------",
            "",
            "* Every privileged AD account MUST have a documented owner",
            "  in the PAM register, re-attested each quarter. An account",
            "  with no owner across two consecutive cycles is, by",
            "  definition, an \"orphan\" under the recert taxonomy.",
            "",
            "* Service accounts must be group-managed service accounts",
            "  (gMSAs) where the host supports them; plain user accounts",
            "  named with an `svc-` prefix are tolerated only with an",
            "  ISSM-signed exception on file. There is no exception on",
            "  file for `svc-rebuild-admin`.",
            "",
            "* Orphan privileged accounts are a finding in their own",
            "  right under AR 25-2 (privileged account management) and",
            "  must be remediated regardless of whether any current",
            "  malicious activity is suspected.",
            "",
            "* Repeated failed-logon attempts against a privileged",
            "  account from a workstation that does not own the account",
            "  are a separate, independently-reportable cybersecurity",
            "  event — they meet the threshold for a credential-access",
            "  attempt regardless of whether they succeed.",
            "",
            "* T. Albright (the WS-DEV-217 console user) is a current",
            "  developer in good standing with no privileged-group",
            "  membership and no documented business reason to be",
            "  testing credentials against `svc-rebuild-admin`.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "orphan-admin-indicators",
        displayName: "Observations from the recertification row + 30-day auth slice",
        items: [
          {
            id: "no-owner",
            label:
              "The account has no documented owner in the PAM register and has not been attested in two consecutive recert cycles.",
            evidenceRef: "recert-row.json",
          },
          {
            id: "creator-departed",
            label:
              "The creating account belongs to a user who departed in late 2024; the creating account itself has been deleted.",
            evidenceRef: "recert-row.json",
          },
          {
            id: "nested-into-da",
            label:
              "The account is nested into Domain Admins (rebuild-ops → tier0-ops → Domain Admins) — a tier-0 privilege escalation through group-nesting that's easy to miss on a flat membership read.",
            evidenceRef: "recert-row.json",
          },
          {
            id: "stale-since-2025-04",
            label:
              "Last successful logon was over a year ago, from a host that was physically decommissioned shortly after.",
            evidenceRef: "recert-row.json",
          },
          {
            id: "no-issm-exception",
            label:
              "An `svc-` prefix user account (not a gMSA) requires an ISSM-signed exception on file. None exists for this account.",
            evidenceRef: "pam-policy-note.txt",
          },
          {
            id: "failed-bursts-from-dev-ws",
            label:
              "Fourteen failed-logon attempts in the last 30 days against this account, all sourced from a single developer workstation (WS-DEV-217), often in same-minute pairs — a shape consistent with manual or scripted password guessing.",
            evidenceRef: "auth-events-30d.csv",
          },
          {
            id: "no-business-reason",
            label:
              "T. Albright (the WS-DEV-217 console user) has no privileged-group membership and no documented business reason to be authenticating as `svc-rebuild-admin`.",
            evidenceRef: "pam-policy-note.txt",
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
          "Which statements are **facts** at this point?",
        options: [
          {
            id: "is-orphan-by-definition",
            label:
              "`svc-rebuild-admin` meets the local definition of an orphan privileged account.",
          },
          {
            id: "has-da-equivalent-access",
            label:
              "The account has Domain Admin-equivalent access, via group-nesting through `rebuild-ops` and `tier0-ops`.",
          },
          {
            id: "credential-being-guessed",
            label:
              "Someone is actively guessing this account's password from WS-DEV-217.",
          },
          {
            id: "compromise-occurred",
            label:
              "The account has been compromised.",
          },
          {
            id: "albright-malicious",
            label:
              "T. Albright is wittingly attempting to escalate privilege.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["is-orphan-by-definition", "has-da-equivalent-access"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The account meets the policy definition of an orphan (no owner across two cycles) and has tier-0 access through group nesting. Both are read directly from the row.",
          "",
          "**Not fact (yet):**",
          "",
          "- *Credential being guessed* — the failure shape is **consistent with** password guessing, but a benign explanation exists (a forgotten scheduled task, a CI runner still wired to the old service identity, a developer mistakenly typing the wrong account name in a PowerShell session). Don't promote pattern-match to conclusion.",
          "- *Compromise occurred* — no successful logon is recorded. A failed-logon spree is a credential-access attempt, not a successful compromise.",
          "- *Albright malicious* — the events are sourced from his workstation; that names a host, not a person, and certainly not an intent. Albright could be the actor, could be someone else at his keyboard, or could be a process running under his console session he didn't know about.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "orphan-admin-indicators",
        promptMd:
          "Pick the observations that **most directly support** treating the recent failed logons as an active credential-access attempt worth a same-day response (rather than a long-standing hygiene-only matter).",
        expected: {
          type: "select_indicators",
          correctIds: [
            "nested-into-da",
            "failed-bursts-from-dev-ws",
            "no-business-reason",
          ],
        },
        debriefMd: [
          "**Most directly supporting:**",
          "",
          "- Domain Admin-equivalent reach makes any successful credential guess catastrophically expensive. Failed attempts against tier-0 are not a routine misfire — they're a same-day response.",
          "- The burst pattern (14 attempts, several in same-minute pairs) is the shape of intentional credential testing, not the long-tail noise of a forgotten background process.",
          "- No business reason for the WS-DEV-217 console user to authenticate as this account anchors the attempt as off-pattern even before identifying the actor.",
          "",
          "**Hygiene-relevant but not same-day-urgent on their own:**",
          "",
          "- *No owner / no attestation* — that is a standing AR 25-2 finding regardless of the failed logons.",
          "- *Creator departed* — important context for the hygiene finding; doesn't by itself elevate to same-day.",
          "- *Stale since 2025-04* — explains why nobody noticed; doesn't move the urgency dial alone.",
          "- *No ISSM exception* — a paperwork-level finding under PAM policy; the cyber-event urgency is separate.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Pick the **reportable categories** this row falls into and the correct owner routing.",
        options: [
          {
            id: "hygiene-finding-issm",
            label:
              "Privileged-account-management finding under AR 25-2: orphan tier-0 account with no documented owner. Owner: unit ISSM, regardless of what the failed-logon investigation finds.",
          },
          {
            id: "credential-access-issm",
            label:
              "Credential-access attempt against a tier-0 account. Owner: unit ISSM as cybersecurity-incident lead under AR 25-2 cyberspace-reportable categories; cybersecurity service provider engaged as appropriate.",
          },
          {
            id: "ci-referral-aci",
            label:
              "Referral to the supporting ACI office under AR 381-12 if the WS-DEV-217 investigation surfaces facts (not assumptions) consistent with insider behaviour by a witting or unwitting human actor.",
          },
          {
            id: "usacidc-on-criminal-predicate",
            label:
              "USACIDC engagement only **if and when** the investigation develops a criminal predicate (e.g. confirmed unauthorized access, attempted intrusion attributable to a person).",
          },
          {
            id: "close-as-clean-up",
            label:
              "Treat as a clean-up item: delete the account and move on, since there's no successful logon to investigate.",
          },
          {
            id: "blame-albright-and-discipline",
            label:
              "Refer T. Albright to his supervisor for disciplinary action on the strength of the workstation attribution.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "hygiene-finding-issm",
            "credential-access-issm",
            "ci-referral-aci",
            "usacidc-on-criminal-predicate",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**The point of the question:** the same row reasonably sits in multiple categories. Routing it as only one is the common new-analyst error.",
          "",
          "- *Hygiene under AR 25-2* — orphan tier-0 with no exception is a standing finding regardless of anything else.",
          "- *Credential-access incident under AR 25-2* — the failed-logon pattern is independently reportable; the ISSM is the lead.",
          "- *ACI referral under AR 381-12* — appropriate **once the WS-DEV-217 investigation produces facts** about who or what was driving the attempts. Don't send ACI a person's name on the strength of a workstation attribution alone.",
          "- *USACIDC* — downstream criminal-investigative authority; engaged only when the investigation develops an articulable criminal predicate.",
          "",
          "**Wrong:**",
          "",
          "- *Delete-and-move-on* destroys the very artifact (the live account, with its current credentials and the failed-logon trail) the credential-access investigation needs to identify the actor and the entry technique. Disable + preserve, don't delete, until the investigation closes.",
          "- *Discipline Albright* on workstation attribution alone confuses a host observation with a human conclusion — the same error pattern the witting-insider scenario warned against.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this row can be safely closed as **hygiene-only** without raising the credential-access incident track.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Hygiene is necessary but not sufficient here. Closing the row as a tidy-up loses the credential-access signal and the chance to identify the actor while the failed-logon source is still live. Open the AR 25-2 hygiene finding and the AR 25-2 credential-access incident as two parallel work items, and hold the ACI referral pending facts from the WS-DEV-217 investigation.",
      },
    ],
  },

  // ─── Difficulty 5 — Insider Threat capstone, multi-artifact synthesis ──
  {
    slug: "insider-leaving-employee-capstone-001",
    title: "Insider Threat Capstone: Leaving-Employee Cross-Source Synthesis",
    summary:
      "A departing R&D engineer, eight days from separation, surfaced through three independent signals (DLP, HR walk-in, after-hours VPN). Read every artifact for what it actually proves, name the missing pieces, and write a finding that holds up to OSJA review.",
    skillAreas: [
      "account_compromise",
      "df_artifacts",
      "removable_media",
      "report_writing",
      "inference_discipline",
    ],
    difficulty: 5,
    estimatedMinutes: 75,
    tags: [
      "insider_risk",
      "account_compromise",
      "df_artifacts",
      "removable_media",
      "report_writing",
      "inference_discipline",
      "capstone",
    ],
    lane: "insider_risk",
    module: "Capstone",
    sequence: 1,
    status: "draft",
    brief: `
# Brief (DRAFT)

\`m.alvarez\` is a DA-civilian software engineer in a sensitive R&D
unit. He gave two weeks' notice 12 days ago. Friday is his last day.
His LinkedIn announcement names a defense-adjacent commercial firm
and the public job description mentions "transition of vendor
relationships" in an area adjacent to the unit's current work.

Three things hit the supporting ACI office in the last 48 hours:

- A DLP alert about 36 hours ago for an attempted upload to a
  personal cloud-storage service. The upload was blocked at the
  egress proxy; the file name, size, and bytes are recorded in the
  DLP row.
- A teammate walked into HR. From the intake form, verbatim:
  *"He's been staying late and asking weird questions about who
  owns what after he leaves."*
- VPN logs show two after-hours sessions from an IP outside his
  usual ISP range in the trailing 10 days.

OSJA has authorized a non-intrusive host + account review. You are
not cleared to image the laptop yet; that authorization is staged in
parallel and lands Friday morning if (and only if) this review
articulates something counsel can act on. The tasking, in order:

- Read the artifacts. Separate what they prove from what they
  suggest.
- Decide what the evidence says about opportunity and what it says
  about action.
- Name the single artifact that would most directly close the open
  question.
- Pick the writeup that matches what the evidence actually carries.

The supporting ACI SAC will use what you write, plus the artifacts
and the missing-evidence list, to brief counsel.

## Artifacts

- \`hr-timeline.json\` — separation timeline and role context.
- \`dlp-alert.json\` — the blocked-upload row: file name, size,
  classification banner, and the policy that fired.
- \`dms-access-audit.csv\` — document-management view/download
  events for the trailing 14 days, scoped to documents this account
  touched.
- \`vpn-sessions.csv\` — VPN session starts and ends for the
  trailing 14 days.
- \`usb-mount-history.csv\` — USBSTOR plus EDR mount/dismount events
  on the workstation for the trailing 14 days.
- \`edr-file-write-coverage.json\` — host-side EDR coverage map
  (which event classes are enabled / disabled on this host) and the
  file-write events that were captured during the relevant windows.
- \`email-of-interest.eml.txt\` — text view of one outgoing email
  that the manager flagged during her exit-process walkthrough.
- \`witness-statement.txt\` — sworn statement excerpt from the
  teammate who walked into HR.

EDR (Endpoint Detection and Response) is the enterprise security
agent class — Falcon, Defender for Endpoint, Sysmon. DLP (Data Loss
Prevention) is egress-side content inspection that blocks or alerts
on outbound transfers matching a policy. EDR sees the workstation;
DLP sees what tries to leave it.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "hr-timeline.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              employee: {
                user: "m.alvarez",
                role: "Senior Software Engineer (DA-civilian, GS-13)",
                unit: "R&D Cell 4 — emerging-tech adjacency",
                clearance: "TS//SCI",
                start_date: "2021-07-12",
                separation_date: "2026-12-18",
                separation_type: "voluntary — accepted external offer",
                notice_submitted_utc: "2026-12-04T14:08:00Z",
              },
              new_role: {
                employer: "Vector Apex Solutions",
                title: "Principal Engineer, Government Systems",
                public_jd_summary:
                  "Lead vendor transition for an emerging-technology product line adjacent to current DoD R&D work.",
                start_date_public: "2026-12-29",
              },
              recent_actions_documented: [
                {
                  date_utc: "2026-12-09T16:00:00Z",
                  action: "Submitted exit-process form. Returned CAC, badge, gym fob.",
                },
                {
                  date_utc: "2026-12-12T13:00:00Z",
                  action: "Conducted code handoff with backup engineer per manager's checklist.",
                },
                {
                  date_utc: "2026-12-15T17:30:00Z",
                  action: "Manager noted in handoff log: 'tying up loose ends, asked about who owns what after he leaves.'",
                },
              ],
              not_yet_returned: [
                "Encrypted USB key (issue date 2024-05-02, last seen on workstation 2026-12-15).",
                "Personal hard-copy notebook — voluntary collection requested 2026-12-15, pending.",
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "dlp-alert.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              alert_id: "DLP-2026-44518",
              event_utc: "2026-12-15T22:14:33Z",
              host: "WS-RD-082",
              user_subject: "m.alvarez",
              src_ip: "10.42.18.82",
              destination_host: "personal-drive.example",
              transfer_method: "HTTPS POST (browser-initiated)",
              file_name: "Q3-roadmap-internal.pdf",
              file_size_bytes: 482111,
              file_classification: "UNCLASSIFIED//FOUO",
              classification_banner_detected: "UNCLASSIFIED//FOUO",
              policy_matched:
                "policy_id=46 — FOUO content blocked to non-corporate cloud destinations",
              action: "blocked",
              notes:
                "User received a generic 'transfer blocked by IT policy' page. No retry observed in the next 60 minutes. Single attempt.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "dms-access-audit.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "timestamp_utc,document_id,document_title,project_scope,action,document_classification",
            // Normal-pattern rows for project he owns
            "2026-12-02T13:14:08Z,DOC-PRJ-A-0048,Cell 4 sprint planning notes,project-a-owned,view,UNCLASSIFIED",
            "2026-12-04T18:01:55Z,DOC-PRJ-A-0214,Cell 4 vendor evaluation memo,project-a-owned,download,UNCLASSIFIED//FOUO",
            "2026-12-09T14:30:11Z,DOC-PRJ-A-0049,Cell 4 sprint planning notes (rev2),project-a-owned,view,UNCLASSIFIED",
            // Anomaly: views OUTSIDE his project scope, accelerating in the last 5 days
            "2026-12-11T20:55:08Z,DOC-PRJ-B-0102,Project B vendor list (current),project-b-other,view,UNCLASSIFIED//FOUO",
            "2026-12-12T19:42:22Z,DOC-PRJ-B-0091,Project B integration architecture brief,project-b-other,view,UNCLASSIFIED//FOUO",
            "2026-12-13T21:10:01Z,DOC-PRJ-C-0033,Project C statement of work,project-c-other,view,UNCLASSIFIED//FOUO",
            "2026-12-14T22:01:45Z,DOC-PRJ-C-0044,Project C delivery schedule,project-c-other,view,UNCLASSIFIED//FOUO",
            "2026-12-15T21:50:18Z,DOC-PRJ-A-0214,Cell 4 vendor evaluation memo,project-a-owned,download,UNCLASSIFIED//FOUO",
            "2026-12-15T22:03:11Z,DOC-PRJ-A-0214,Cell 4 vendor evaluation memo,project-a-owned,view,UNCLASSIFIED//FOUO",
            // Q3 roadmap viewed shortly before the DLP block
            "2026-12-15T22:11:42Z,DOC-PRJ-A-0301,Q3-roadmap-internal,project-a-owned,view,UNCLASSIFIED//FOUO",
            "2026-12-15T22:12:18Z,DOC-PRJ-A-0301,Q3-roadmap-internal,project-a-owned,download,UNCLASSIFIED//FOUO",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "vpn-sessions.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "session_start_utc,session_end_utc,user,src_ip,asn_org,session_type",
            // Normal pattern weeks 1-2: weekday daytime, home ISP
            "2026-12-02T13:00:11Z,2026-12-02T22:14:08Z,m.alvarez,71.182.40.12,COMCAST-CABLE,workstation",
            "2026-12-03T13:02:55Z,2026-12-03T21:55:11Z,m.alvarez,71.182.40.12,COMCAST-CABLE,workstation",
            "2026-12-04T13:08:22Z,2026-12-04T22:01:55Z,m.alvarez,71.182.40.12,COMCAST-CABLE,workstation",
            // Mid-period: still normal
            "2026-12-09T13:10:44Z,2026-12-09T21:42:18Z,m.alvarez,71.182.40.12,COMCAST-CABLE,workstation",
            "2026-12-10T13:06:18Z,2026-12-10T22:08:33Z,m.alvarez,71.182.40.12,COMCAST-CABLE,workstation",
            // Late-period anomaly: two after-hours sessions, IP outside usual ASN
            "2026-12-13T22:18:42Z,2026-12-14T01:55:11Z,m.alvarez,104.221.30.55,DIGITAL-OCEAN,workstation",
            "2026-12-14T22:42:08Z,2026-12-15T02:18:33Z,m.alvarez,104.221.30.55,DIGITAL-OCEAN,workstation",
            // The day of the DLP block: normal-hours session from home
            "2026-12-15T13:18:08Z,2026-12-15T23:14:33Z,m.alvarez,71.182.40.12,COMCAST-CABLE,workstation",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "usb-mount-history.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "mount_utc,dismount_utc,device_vendor_product,serial,asset_register_match,user_subject",
            // Issued unit-encrypted USB, listed in HR timeline as not-yet-returned
            "2026-12-02T14:08:22Z,2026-12-02T16:14:55Z,Apricorn Aegis Secure Key 3z,UNIT-USB-1814,YES (issued 2024-05-02 to m.alvarez),m.alvarez",
            "2026-12-09T18:42:18Z,2026-12-09T19:55:11Z,Apricorn Aegis Secure Key 3z,UNIT-USB-1814,YES (issued 2024-05-02 to m.alvarez),m.alvarez",
            "2026-12-15T17:14:08Z,2026-12-15T18:30:55Z,Apricorn Aegis Secure Key 3z,UNIT-USB-1814,YES (issued 2024-05-02 to m.alvarez),m.alvarez",
            // Anomaly: an unknown device (not on asset register) on 2026-12-14
            "2026-12-14T23:08:11Z,2026-12-15T01:42:33Z,Kingston DataTraveler 100 G3,KD-PR-2026,NO (not on unit register),m.alvarez",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 6,
        displayName: "edr-file-write-coverage.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-RD-082",
              edr_product: "Microsoft Defender for Endpoint",
              coverage_at_acquisition_utc: "2026-12-16T13:00:00Z",
              process_create_enabled: true,
              network_telemetry_enabled: false,
              file_write_telemetry_enabled: "partial",
              file_write_telemetry_note:
                "FileCreate / FileWrite events are captured for fixed disks and SMB shares but NOT for removable-media volumes on this host — a unit-wide MDE policy choice from 2025-06 to reduce noise. Coverage gap means any write to a USB volume is invisible to MDE.",
              file_writes_captured_in_window: [
                {
                  utc: "2026-12-15T22:12:21Z",
                  process: "C:\\Users\\m.alvarez\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe",
                  target_path: "C:\\Users\\m.alvarez\\Downloads\\Q3-roadmap-internal.pdf",
                  sha256: "9c4b...e811",
                  size_bytes: 482111,
                  note: "Browser save-as from DMS download; this is the file that DLP later blocked at the egress proxy.",
                },
              ],
              file_writes_captured_for_removable_volume: null,
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 7,
        displayName: "email-of-interest.eml.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "From: m.alvarez@unit.example",
            "To: m.alvarez.personal@example.com",
            "Date: Sun, 14 Dec 2026 21:42:08 +0000",
            "Subject: notes",
            "X-Originating-IP: 71.182.40.12",
            "Message-ID: <a1b2-44518@unit-mail.example>",
            "Content-Type: multipart/mixed; boundary=\"sep-1\"",
            "",
            "--sep-1",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "vendor names and the SOW versions I need to refresh on. nothing classified.",
            "",
            "--sep-1",
            "Content-Type: text/plain; charset=utf-8; name=\"vendor-names-and-sow-refs.txt\"",
            "Content-Disposition: attachment; filename=\"vendor-names-and-sow-refs.txt\"",
            "",
            "(attachment body: 78 lines, 4.1 KB. Lines appear to be vendor names",
            " followed by SOW reference numbers. No classified markings detected by",
            " the FOUO/CUI scanner on the egress side. Sample below:)",
            "",
            "  Vector Apex Solutions / SOW-2024-118 (rev2)",
            "  Northstar Integrators / SOW-2025-044",
            "  TrellisWorks LLC / SOW-2024-093",
            "  ...",
            "",
            "--sep-1--",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 8,
        displayName: "witness-statement.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "WITNESS STATEMENT — EXCERPT",
            "Intake: 2026-12-16 09:11 local, HR walk-in",
            "Witness: J. Park (Senior Software Engineer, R&D Cell 4)",
            "",
            "Verbatim, edited for length only:",
            "",
            "  \"Marco's been staying late this past week. I'm in the next pod",
            "   over. Two nights this week — Saturday and Sunday I think — he",
            "   was on a personal cell, voice down. I heard 'before Friday'",
            "   more than once. Wednesday in the kitchenette he asked me 'who",
            "   owns the vendor list after I'm gone' which is a weird thing",
            "   to ask, because the vendor list isn't even on his project.",
            "   I figured he was tying things up but it stuck with me.\"",
            "",
            "  \"I never saw him copy anything. I'm not saying he did. I'm",
            "   saying it felt off enough that I wanted somebody to look.\"",
            "",
            "Statement collected on DD Form 2823 (paper original retained by",
            "HR; this is a typed excerpt for the case folder).",
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
          "Across the artifact set, which statements are **directly supported by an artifact row** (fact, not inference)?",
        options: [
          {
            id: "dms-cross-project",
            label:
              "m.alvarez viewed documents scoped to Project B and Project C, neither of which is his assigned project.",
          },
          {
            id: "vpn-asn-shift",
            label:
              "Two of m.alvarez's VPN sessions in the trailing 4 days originated from a Digital Ocean ASN rather than his usual home-ISP ASN.",
          },
          {
            id: "dlp-blocked",
            label:
              "An attempted upload of `Q3-roadmap-internal.pdf` to a personal cloud destination was blocked by DLP at 2026-12-15T22:14:33Z.",
          },
          {
            id: "non-asset-usb-mounted",
            label:
              "A non-asset-register USB (Kingston KD-PR-2026) was mounted on WS-RD-082 by m.alvarez during the trailing 4 days.",
          },
          {
            id: "files-copied-to-usb",
            label:
              "Files were copied from WS-RD-082 to the non-asset-register USB.",
          },
          {
            id: "intent-to-exfil",
            label:
              "m.alvarez intended to exfiltrate documents to his new employer.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "dms-cross-project",
            "vpn-asn-shift",
            "dlp-blocked",
            "non-asset-usb-mounted",
          ],
          allowMultiple: true,
        },
        debriefMd:
          "Each of the first four statements is one artifact row read literally. *Files were copied to the USB* is **not** supported — EDR file-write telemetry for removable-media volumes is explicitly disabled on this host (see `edr-file-write-coverage.json`), so the mount is opportunity, not action. *Intent to exfil* is the inference the artifacts together motivate, not something any single row demonstrates.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which artifact rows establish **opportunity** (a means to move data off the workstation), independent of whether the action actually happened?",
        options: [
          {
            id: "opp-non-asset-usb",
            label:
              "The non-asset-register Kingston USB mount on 2026-12-14 (no file-write telemetry to disprove a copy).",
          },
          {
            id: "opp-dlp-block",
            label:
              "The DLP block on 2026-12-15. The block itself is opportunity that *did not succeed* via that channel.",
          },
          {
            id: "opp-vpn-shift",
            label:
              "The two after-hours VPN sessions from the Digital Ocean ASN.",
          },
          {
            id: "opp-personal-email",
            label:
              "The 2026-12-14 email to a personal address carrying a vendor list, sent from inside the unit's email system.",
          },
          {
            id: "opp-dms-views",
            label:
              "The 2026-12-11 through 2026-12-15 views of Project B / Project C documents.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "opp-non-asset-usb",
            "opp-dlp-block",
            "opp-personal-email",
          ],
          allowMultiple: true,
        },
        debriefMd:
          "Three rows establish opportunity. The Kingston mount + the EDR file-write coverage gap mean *a copy could have happened invisibly*. The DLP block is itself a record of an attempted egress that did not succeed via that channel but is unambiguous evidence of intent-to-transfer. The personal email is a successful egress vehicle (the data left the workstation, even though the attached vendor list reads as unclassified at first glance). The VPN ASN shift is a behavioral anomaly worth investigating but is not itself a means to move data. The DMS cross-project views are a **knowledge-gathering** signal, not a data-movement signal.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which artifact rows establish **action** (data actually leaving the workstation as a result of m.alvarez's activity)?",
        options: [
          {
            id: "act-personal-email-sent",
            label:
              "The 2026-12-14 personal-address email with the vendor-list attachment — the message reached the egress system and the attachment was sent.",
          },
          {
            id: "act-dlp-blocked-q3",
            label:
              "The DLP-blocked Q3 roadmap upload — the file reached the egress proxy.",
          },
          {
            id: "act-usb-copy",
            label:
              "The Kingston USB mount + the DMS download of the Q3 roadmap shortly before.",
          },
          {
            id: "act-vpn-anomaly",
            label:
              "The Digital Ocean VPN sessions.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["act-personal-email-sent"],
          allowMultiple: true,
        },
        debriefMd:
          "Only the personal-address email is **completed action** — bytes left the unit's email system. The DLP-blocked upload is *intent-to-act*, not action: the file reached the proxy but did not reach the destination. The USB mount is opportunity; without removable-media file-write telemetry, no row in this artifact set shows that the Q3 roadmap (or anything else) was actually written to the Kingston device. The VPN ASN shift is behavioral context, not action. **Note for the writeup**: the unclassified-on-its-face vendor list still merits review — vendor lists can become sensitive when combined with SOW numbers and project-affiliation data, and the recipient (personal address) is the relevant policy concern, not the markings.",
      },
      {
        ordinal: 4,
        type: "text_match",
        weight: 1,
        promptMd:
          "Cite the **single artifact field** that, on its own, would convert *opportunity-to-copy-via-USB* into *the Q3 roadmap was written to the USB*. If no artifact in the current set would do this, type `none`.",
        textMatch: {
          acceptableAnswers: [
            "none",
            "None",
            "NONE",
          ],
          hint: "EDR file-write telemetry is the usual answer. Reread `edr-file-write-coverage.json` carefully before answering.",
          hintAfterTries: 1,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["none", "None", "NONE"],
          regex: false,
        },
        debriefMd:
          "**None.** The coverage map says file-write telemetry for removable-media volumes is disabled by unit-wide MDE policy. No row in this artifact set records bytes being written to the Kingston USB. The writeup needs to say that — that the question is open, not answered in either direction.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Of the following next steps, which is the **highest-leverage single ask** to put on the supporting ACI SAC's brief tomorrow morning?",
        options: [
          {
            id: "image-the-laptop",
            label:
              "Authorize the staged laptop image acquisition so the USN journal, $LogFile, and shellbags can be examined for evidence of writes to the Kingston volume.",
          },
          {
            id: "interview-witness-again",
            label:
              "Re-interview the teammate (J. Park) on the record to lock down the exact dates and overheard phrases.",
          },
          {
            id: "pull-perimeter-netflow",
            label:
              "Pull perimeter NetFlow for the workstation's outbound traffic during the Digital Ocean VPN sessions.",
          },
          {
            id: "subpoena-do-droplet",
            label:
              "Open a legal-process action against Digital Ocean to identify the customer behind the Digital Ocean IP.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["image-the-laptop"],
          allowMultiple: false,
        },
        debriefMd:
          "**Image the laptop.** The single biggest gap is whether the Q3 roadmap (or any other file) actually reached the Kingston volume; the USN journal and `$LogFile` survive even when EDR didn't capture writes, and shellbags / jumplists may show interaction with the removable-volume path. The witness re-interview hardens the colorable-cause story but doesn't move the *did data leave* question forward. NetFlow on the workstation's outbound traffic is useful corroboration but layered behind the host-side review and harder to scope. Legal process against Digital Ocean is premature — the after-hours VPN sessions are *anomalous*, not *attributable* yet; an early subpoena weakens the eventual filing if the answer turns out to be a personal travel VPN.",
      },
      {
        ordinal: 6,
        type: "confidence",
        weight: 1,
        promptMd: [
          "Confidence (1–5) that the following sentence is defensible **as the headline finding** of the writeup counsel will see tomorrow:",
          "",
          "> *m.alvarez exfiltrated unit data to a personal account on 2026-12-14 and attempted further exfil on 2026-12-15 before separation.*",
        ].join("\n"),
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The sentence collapses two separate things into one claim: (a) an unclassified vendor list left the unit via personal email — that *is* policy-relevant action but is not, on its face, *exfiltration of unit data* in the sense counsel will read; (b) the Q3 roadmap upload was blocked, so *attempted* is accurate, but *further exfil* implies a course of conduct the artifact set cannot establish yet. The defensible headline names each event for what it is — a successful policy-relevant transfer of one vendor-list document, plus one blocked-by-DLP attempt — and reserves *exfil* for what the laptop image is going to either confirm or rule out about the USB.",
      },
      {
        ordinal: 7,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which of these is the headline you'd actually put in front of counsel?",
        options: [
          {
            id: "overclaim",
            label:
              "*m.alvarez systematically exfiltrated unit roadmap and vendor documentation to his new employer over the final 7 days of his separation. DLP captured one of the upload attempts on 2026-12-15; the Q3 roadmap was queued for transfer to a personal cloud destination tied to the recipient firm. The 2026-12-14 personal email carrying the unit's SOW-vendor list confirms a completed transfer of unit-sensitive intellectual property; the cross-project DMS views on 2026-12-11 through 2026-12-15 confirm the breadth of his collection effort. The after-hours VPN sessions from a Digital Ocean ASN are characteristic of attacker-managed staging infrastructure. Recommend immediate criminal referral, an asset hold on the laptop, civil-recovery action against the new employer, and ACI counter-intelligence coordination on the broader threat picture.*",
          },
          {
            id: "calibrated",
            label:
              "*During the trailing 7 days of m.alvarez's separation: (a) one outgoing email to a personal address (2026-12-14) carried a vendor list with SOW references but no classified markings; (b) one DLP-policy block (2026-12-15) prevented an attempted upload of an FOUO roadmap document to a personal cloud destination; (c) a non-asset-register USB was mounted on 2026-12-14 within a window where host EDR was not configured to capture removable-media file writes, so a copy to the USB cannot be confirmed or ruled out from current evidence. Cross-project DMS views and an after-hours VPN ASN shift in the same window are corroborating behavioral anomalies. Recommend the staged laptop-image authorization proceed Friday so the USN journal can be examined for writes to the Kingston volume.*",
          },
          {
            id: "underclaim",
            label:
              "*Review of m.alvarez's separation period found two notable events: a personal-address email on 2026-12-14 carrying a list of vendor names and SOW reference numbers (no classified or FOUO markings on the file), and a DLP-policy alert on 2026-12-15 in which an attempted upload of a roadmap PDF was blocked by the egress proxy before any data left the unit network. The blocked upload means DLP performed as designed. The personal email carried only unclassified business data of the type that routinely circulates between vendors and employees during normal contract-handoff work. The cross-project DMS views and the after-hours VPN sessions are within ordinary range for an engineer wrapping up a multi-project portfolio before separation. No exfiltration occurred. Recommend closing the case pending standard separation processing.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle headline names each event at the resolution the artifacts support, flags the EDR coverage gap as the reason the USB question is open, recommends pulling the laptop image next instead of jumping to a verdict, and carries the corroborating-but-not-attributable signals (the cross-project DMS views, the VPN ASN shift) honestly. The first asserts *exfiltrated* without USB-write evidence and recommends a referral counsel can't defend on this record. The third dismisses the personal-email transfer — a completed transfer to an unauthorized destination, classification markings or not — and treats the EDR coverage gap as evidence of *no copy* rather than *no observation*.",
      },
    ],
  },
];
