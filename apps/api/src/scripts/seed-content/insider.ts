import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Insider-risk family. Three things this family teaches that the
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
    title: "Insider Risk: 30-Day-Notice File-Access Timeline",
    summary:
      "An employee gave 30 days' notice. The week after, file-access counts spike. Read the timeline carefully and decide what's anomaly vs evidence.",
    skillAreas: ["account_compromise", "df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 40,
    tags: ["insider_risk", "account_compromise", "df_artifacts", "report_writing", "inference_discipline"],
    brief: `
# Brief

An engineer at a partner firm — \`l.tran@partner.example\` — gave
30 days' notice on 2026-09-01. HR flagged a high count of
file-access events from her account in the week after, and asked
your office to review.

You have a slice of file-access events, removable-media mount
events, VPN logons, and one page of role / project context.

## Artifacts

- **file-access-events.csv** — open-events from the document
  management system. \`action\` is what the DMS recorded (view,
  download, share-link-created).
- **removable-media.csv** — USB / SD-card mount + dismount events
  from the workstation EDR.
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
          [
            "ts_utc,doc_id,doc_title,action,size_bytes",
            "2026-09-02T09:11:00Z,DOC-1101,Engineering onboarding handbook,view,",
            "2026-09-02T13:44:00Z,DOC-1101,Engineering onboarding handbook,view,",
            "2026-09-03T10:01:00Z,DOC-2210,Project Alpha — design review notes,view,",
            "2026-09-03T10:05:00Z,DOC-2210,Project Alpha — design review notes,download,1822111",
            "2026-09-03T10:09:00Z,DOC-2211,Project Alpha — schema diagrams,download,488300",
            "2026-09-03T10:12:00Z,DOC-2212,Project Alpha — integration test scripts,download,210117",
            "2026-09-03T10:18:00Z,DOC-3001,Performance review template,view,",
            "2026-09-04T11:42:00Z,DOC-2210,Project Alpha — design review notes,view,",
            "2026-09-08T08:31:00Z,DOC-2310,Project Beta — high-level overview,view,",
            "2026-09-08T08:55:00Z,DOC-2311,Project Beta — vendor list,view,",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "removable-media.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_utc,event,vid,pid,serial,workstation",
            "2026-09-03T09:58:00Z,mount,0x0951,0x1666,AA-LT-001,WS-LT-018",
            "2026-09-03T10:22:00Z,dismount,0x0951,0x1666,AA-LT-001,WS-LT-018",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "vpn-logons.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_utc,event,client_ip,duration_sec",
            "2026-09-02T09:00:00Z,start,203.0.113.7,",
            "2026-09-02T17:30:00Z,stop,203.0.113.7,30600",
            "2026-09-03T08:45:00Z,start,203.0.113.7,",
            "2026-09-03T17:42:00Z,stop,203.0.113.7,32220",
            "2026-09-08T08:20:00Z,start,203.0.113.7,",
            "2026-09-08T16:55:00Z,stop,203.0.113.7,30900",
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
        type: "text_match",
        weight: 1,
        promptMd:
          "Name the **single artifact source** that, if added, would most directly turn 'USB was mounted' into 'files were written to USB.' (Short noun phrase.)",
        textMatch: {
          acceptableAnswers: ["edr file-write events", "edr file write events", "file write events", "file-write events", "file create events on usb", "edr write events", "edr write logs", "sysmon file-create on usb", "sysmon filecreate"],
          hint: "It's an event-source that names which paths bytes went TO during the mount window.",
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["edr file-write events", "edr file write events", "file write events", "file-write events", "file create events on usb", "edr write events", "edr write logs", "sysmon file-create on usb", "sysmon filecreate"],
          regex: false,
        },
        debriefMd:
          "EDR (or Sysmon) **file-write** / **FileCreate** events scoped to the USB volume during the mount window. That converts \"a USB was mounted\" into \"these specific files were copied to it.\" The data-handling portal is the policy gate; EDR is the technical gate. Both should be queried before any finding.",
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
    title: "Insider Risk: Off-Hours Access Pattern",
    summary:
      "Off-hours logons cluster around a specific document set. Is it a sign of exfil, a deadline, or normal team-A behavior?",
    skillAreas: ["account_compromise", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["insider_risk", "account_compromise", "report_writing", "inference_discipline"],
    status: "draft",
    brief: `
# Brief (DRAFT)

A user's logons are clustering after midnight. The same week, their
team is in the final two weeks of a release. Triage.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "logon-pattern.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_local,event,workstation,user",
            "2026-10-13T23:42:00,console_unlock,WS-NM-022,n.murphy",
            "2026-10-14T01:08:00,console_lock,WS-NM-022,n.murphy",
            "2026-10-14T23:51:00,console_unlock,WS-NM-022,n.murphy",
            "2026-10-15T00:47:00,console_lock,WS-NM-022,n.murphy",
            "2026-10-15T23:35:00,console_unlock,WS-NM-022,n.murphy",
            "2026-10-16T01:12:00,console_lock,WS-NM-022,n.murphy",
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
        type: "text_match",
        weight: 1,
        promptMd: "What additional artifact would convert 'off-hours logon' into 'off-hours data exfil'?",
        textMatch: { acceptableAnswers: ["file-write events", "edr file write events", "file write to usb", "data egress", "egress logs", "vpn egress", "data loss prevention", "dlp"] },
        expected: {
          type: "text_match",
          acceptableAnswers: ["file-write events", "edr file write events", "file write to usb", "data egress", "egress logs", "vpn egress", "data loss prevention", "dlp"],
          regex: false,
        },
        debriefMd:
          "EDR file-write events to removable media or DLP egress logs are what convert a *presence* signal into a *what-did-they-do* signal.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that this pattern is insider risk.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd: "Low. The context fully explains the timing.",
      },
    ],
  },

  {
    slug: "insider-removable-media-with-sensitive-access-001",
    title: "Insider Risk: USB Mount + Sensitive Doc Access",
    summary:
      "A USB was mounted during access to a restricted document. Determine what the artifacts prove vs what would need EDR file-write data.",
    skillAreas: ["account_compromise", "df_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 12,
    tags: ["insider_risk", "account_compromise", "df_artifacts", "inference_discipline"],
    status: "draft",
    brief: `
# Brief (DRAFT)

A restricted finance document was opened by an engineering account
the same minute a USB device was mounted on that workstation.
Triage.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "events.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_utc,event,user,workstation,detail",
            "2026-11-04T15:02:00Z,document_open,e.silva,WS-ES-010,DOC-FIN-9912 (restricted; finance scope)",
            "2026-11-04T15:02:30Z,usb_mount,e.silva,WS-ES-010,VID 0x0951 PID 0x1666 SERIAL XX-001",
            "2026-11-04T15:18:00Z,document_close,e.silva,WS-ES-010,DOC-FIN-9912",
            "2026-11-04T15:20:00Z,usb_dismount,e.silva,WS-ES-010,SERIAL XX-001",
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
          "Open + mount are events you observed. *Write* is not observable from mount events alone — you need EDR FileCreate/Write events on the USB volume. *Policy violation* depends on whether the data-handling portal approved this USB write (logs not included).",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd: "Name the single missing artifact source that would resolve the question.",
        textMatch: { acceptableAnswers: ["edr file-write events", "edr file write events", "file-write events", "file write events", "sysmon file-create", "data-handling portal", "data handling portal", "portal logs"] },
        expected: {
          type: "text_match",
          acceptableAnswers: ["edr file-write events", "edr file write events", "file-write events", "file write events", "sysmon file-create", "data-handling portal", "data handling portal", "portal logs"],
          regex: false,
        },
        debriefMd:
          "Either EDR file-write events scoped to the USB volume during the mount window, or the data-handling portal log. Either alone is enough to convert the lead into a finding.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that this is data exfil.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "Suspicious but not concluded. The temporal overlap is meaningful (mount within 30s of open is not a coincidence) — but inference here without the EDR or portal record is premature.",
      },
    ],
  },
];
