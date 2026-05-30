import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// macOS forensic-artifact scenarios. Each one drills into a
// specific artifact (or small cluster of artifacts) that an
// analyst working a macOS host will see in the field. The bar is
// the same as the rest of the catalogue: every claim the student
// is graded on has to be provable from the artifacts as written,
// and every artifact has at least one trap that punishes
// over-claiming.

export const MACOS_FORENSICS_SCENARIOS: ScenarioSeed[] = [
  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "macos-unified-log-privacy-redaction-001",
    title: "macOS Unified Log: Reading log show Output Without Trusting It",
    summary:
      "The unified log is macOS's structured logging stream. Read a `log show` excerpt cleanly — and notice every `<private>` redaction the system inserted before you saw it.",
    skillAreas: ["df_artifacts", "macos_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "macos", "macos_artifacts", "df_artifacts", "inference_discipline"],
    lane: "macos_forensics",
    module: "macOS host triage",
    sequence: 1,
    brief: `
# Brief

The unified log is the macOS system-wide structured log
stream (\`os_log\`), persisted in
\`/var/db/diagnostics/\` (\`.tracev3\` files) and
\`/var/db/uuidtext/\` (string-table sidecars). Analysts read
it with \`log show\` / \`log collect\` / \`log stream\`. On
this host the on-call engineer ran:

\`\`\`
log show --info --predicate \\
  'subsystem == "com.apple.securityd" OR processImagePath CONTAINS "ssh"' \\
  --start '2026-10-14 02:30:00' --end '2026-10-14 03:00:00' --style syslog \\
  > log-show-window.txt
\`\`\`

…and pulled the live retention config plus the log archive
header (\`log show --info\` reveals the system's redaction
policy at capture time).

## What you need to know to read this cleanly

- **\`<private>\` is the system's privacy redaction.**
  Apple-shipped \`os_log\` callsites mark format-string
  arguments as private by default; \`log show\` prints
  \`<private>\` unless the caller used \`--info\` AND a
  Configuration Profile (or the
  \`Enable-Private-Data\` payload) is in force. Without the
  profile, even root cannot reveal the redacted values from
  the on-disk store later — they were never written.
- **Predicate filters drop matching records you didn't
  request.** Anything outside the predicate is silently
  excluded from the output. The excerpt is what \`log show\`
  emitted, NOT what's in the on-disk store.
- **Time range is local time by default.** \`log show\`
  accepts \`-tz UTC\` to render UTC; otherwise the host's
  current TZ rules.
- **Retention is bounded.** Persisted \`.tracev3\` files
  rotate on a size/time budget; older events fall out. An
  empty result for a window can mean "nothing matched" OR
  "rotated out". Read the retention config first.

## Artifacts

- **log-show-window.txt** — the \`log show\` syslog-style
  excerpt the analyst captured.
- **log-show-info-header.txt** — the
  \`log show --info\` privacy / persistence banner from the
  same run.
- **retention-config.json** — the system's
  \`/Library/Preferences/Logging/Subsystems/\` retention
  policy for the relevant subsystems.
- **host-context.json** — macOS version, TZ, MDM-enrolled
  configuration profiles in force (or not).

## Reporting framing

For ACI reporting, name what the **excerpt** supports — not
what the log "would have said" had private logging been
on. A redacted value is an evidence gap, not a finding. If
the gap matters, request the host re-acquired with the
\`Enable-Private-Data\` profile applied **before** the
next collection.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "log-show-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# log show --info --predicate '...' --style syslog (host=mbp-08; TZ=PDT/UTC-7)",
            "2026-10-14 02:41:11.022104-0700 mbp-08 sshd[24010]: (libsystem_info.dylib) Accepted publickey for <private> from <private> port <private> ssh2: ED25519 SHA256:9aJk5...Qz0",
            "2026-10-14 02:41:11.041220-0700 mbp-08 sshd[24010]: (com.apple.opendirectoryd) User logged in: <private>",
            "2026-10-14 02:41:11.522900-0700 mbp-08 securityd[112]: (com.apple.securityd) AuthorizationCreate by process /usr/bin/ssh (PID 24011) for right system.login.tty granted",
            "2026-10-14 02:42:55.118003-0700 mbp-08 securityd[112]: (com.apple.securityd) Keychain item access by process /Applications/Slack.app/Contents/MacOS/Slack (PID 901) for service <private>",
            "2026-10-14 02:43:02.601447-0700 mbp-08 sudo[24201]: (com.apple.securityd) TIS_AuthorizationCopyRights by /usr/bin/sudo (PID 24201) for right system.privilege.admin granted to <private>",
            "2026-10-14 02:55:22.880011-0700 mbp-08 sshd[24010]: (libsystem_info.dylib) Disconnected from user <private> <private> port <private>",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "log-show-info-header.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# log show --info banner (preamble to above output)",
            "Filtering the log data using \"subsystem == \"com.apple.securityd\" OR processImagePath CONTAINS \"ssh\"\"",
            "Timezone: America/Los_Angeles (PDT, -0700)",
            "System logging configuration:",
            "  Private data: hidden (no Enable-Private-Data configuration profile installed)",
            "  Persisted store coverage: 2026-09-30 00:00 → 2026-10-14 09:00 PDT (~14 days)",
            "  TraceV3 archive segments in window: 14",
            "Skipping 0 records (no truncation in window)",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "retention-config.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "mbp-08",
              source: "/Library/Preferences/Logging/Subsystems/",
              acquired_utc: "2026-10-14T16:00:00Z",
              subsystems: [
                {
                  subsystem: "com.apple.securityd",
                  level: "Default",
                  persist: "Default",
                  enable_private_data: false,
                  retention_days: 14,
                },
                {
                  subsystem: "com.apple.opendirectoryd",
                  level: "Info",
                  persist: "Default",
                  enable_private_data: false,
                  retention_days: 14,
                },
                {
                  subsystem: "com.apple.launchd",
                  level: "Default",
                  persist: "Default",
                  enable_private_data: false,
                  retention_days: 14,
                },
              ],
              note: "Default retention is approximately 14 days but the actual rotation point is size-driven; expect short bursts of high-volume logging (e.g., crash storms) to push older events out earlier than 14 days.",
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
              host: "mbp-08",
              os: "macOS 14.6 (Sonoma) build 23G80",
              hardware: "MacBook Pro M2 Pro",
              timezone: "America/Los_Angeles (PDT, -0700)",
              acquired_utc: "2026-10-14T16:00:00Z",
              mdm_enrolled: true,
              mdm_provider: "Jamf Pro 11.3",
              installed_configuration_profiles: [
                "com.example.mdm.baseline",
                "com.example.mdm.firewall",
              ],
              enable_private_data_profile_present: false,
              note: "MDM is in force but no Enable-Private-Data Logging profile is installed. <private> redactions in os_log output are NOT recoverable from this acquisition — they were never written to disk in the clear.",
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
          "From the `log show` excerpt plus the banner and host context, which statements are **proven**?",
        options: [
          {
            id: "ssh-login-occurred",
            label:
              "An ssh login by *some* user occurred at 2026-10-14 02:41:11 PDT (09:41:11 UTC); sshd recorded an `Accepted publickey` line with an ED25519 SHA256 fingerprint, even though the username and source IP were redacted to `<private>`.",
          },
          {
            id: "user-is-recoverable",
            label:
              "The username, source IP, and port are recoverable from the on-disk `.tracev3` archive by re-running `log show` with `--source` and root privileges; `<private>` is a display-time redaction over data that os_log persisted in the clear.",
          },
          {
            id: "sudo-granted",
            label:
              "A `sudo` invocation at 02:43:02 was granted the `system.privilege.admin` right; the target user is redacted, so attribution to a specific account requires another source.",
          },
          {
            id: "no-other-activity",
            label:
              "Because the `log show --info` banner says \"Skipping 0 records\", this excerpt is a complete account of everything sshd / securityd did on this host in the 30-minute window.",
          },
          {
            id: "fingerprint-is-public",
            label:
              "The ED25519 SHA256 fingerprint in the `Accepted publickey` line is itself non-redactable identification data (a hash of the public key); matching it against an internal key-fingerprint registry would name the key without recovering any redacted field.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["ssh-login-occurred", "sudo-granted", "fingerprint-is-public"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- The `Accepted publickey` line proves a successful publickey login; the public-key fingerprint is not redacted and is a stable identifier.",
          "- The sudo `system.privilege.admin granted` line proves elevation; only the target identity is redacted.",
          "- A SHA256 publickey fingerprint matched against a key registry yields the key (and thus the named operator) without recovering any `<private>` field.",
          "",
          "**Not proven:**",
          "",
          "- *Username / IP recoverable* — Without the `Enable-Private-Data` configuration profile in force **at the time the events were emitted**, the runtime never wrote the cleartext to disk. There is no `--source` flag that recovers data that was redacted at write time.",
          "- *Complete account of activity* — The predicate filter (`subsystem == \"com.apple.securityd\" OR processImagePath CONTAINS \"ssh\"`) excludes everything else. \"Skipping 0 records\" means nothing matching the predicate was dropped, not that nothing else happened.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "An analyst proposes pulling `/var/db/diagnostics/Persist/*.tracev3` and re-running `log show` offline to reveal the `<private>` fields. What's the correct response?",
        options: [
          {
            id: "wont-work",
            label:
              "It won't work. Without the `Enable-Private-Data` profile in force at the moment the os_log call ran, the private arguments were never persisted in the clear. Re-running `log show` against the archive shows the same `<private>` placeholders.",
          },
          {
            id: "will-work-with-root",
            label:
              "It works as long as the offline tool is run as root; `<private>` is an unprivileged display-time filter on os_log output, and a root-owned process reading the `.tracev3` archive can extract the cleartext that was written under the hood.",
          },
          {
            id: "works-with-uuidtext",
            label:
              "It works when both `/var/db/diagnostics/` and `/var/db/uuidtext/` are present in the offline copy; the uuidtext sidecars contain the format-string template that lets the offline tool rebuild the private arguments from their hash and emit the original strings.",
          },
          {
            id: "needs-keychain",
            label:
              "It works once the host's System keychain is unsealed and provided to the offline reader; the private fields are encrypted with a per-host key in the keychain and become recoverable any time the keychain unwrap key is available to the analyst.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["wont-work"],
          allowMultiple: false,
        },
        debriefMd:
          "Private data redaction in os_log is enforced **at emission time** by the format-string `%{private}...` annotation: when the redaction policy is in force, the runtime writes the placeholder, not the cleartext. The `.tracev3` archive contains only what was written. `uuidtext` is the format-string lookup, not a record of the redacted argument. The keychain has no role here.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best fill in the redacted username + source IP for the 02:41:11 ssh login?",
        options: [
          { id: "auth-keychain", label: "The host's `/var/log/asl/` (legacy ASL flat files — irrelevant on macOS 14, ASL is deprecated and most modern subsystems do not write to it)." },
          { id: "netflow", label: "Upstream NetFlow / VPC flow logs for the host's external IP showing inbound TCP/22 connections around 02:41 PDT." },
          { id: "ssh-server-host-key", label: "The destination sshd server-side audit (if a centralised SIEM ingests sshd events at write time, before `<private>` redaction was applied — this captures the cleartext)." },
          { id: "config-profile-now", label: "Installing the `Enable-Private-Data` profile **now** so the next collection unredacts old events (it does not — the profile only affects events written after install)." },
          { id: "wtmp-host", label: "Pulling `wtmp` / `last` from the host (records logins independently of os_log)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["netflow", "ssh-server-host-key", "wtmp-host"],
          allowMultiple: true,
        },
        debriefMd: [
          "NetFlow gives the source IP independently of the host. A centralised SIEM that captured sshd events upstream of the os_log redaction has cleartext. `wtmp` / `last` records login users and source addresses (TTY/`utmp` format) without going through os_log.",
          "",
          "ASL is deprecated on modern macOS. Installing the privacy profile *now* affects future writes only.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the host saw NO other ssh logins in the 02:30–03:00 PDT window, based ONLY on the `log show` excerpt and banner.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2–3.** The predicate caught any sshd-process events in the window and the banner says no records were truncated. But the persisted-store retention budget is size-driven; if a high-volume event burst rotated `.tracev3` segments out earlier than expected, an earlier login could be unobservable. Also, the predicate matches `processImagePath CONTAINS \"ssh\"` — that's fine for `sshd` and `ssh` but could miss a renamed or path-mangled binary. Reserve confidence 4–5 for after cross-checking `wtmp`, NetFlow, and a broader (`subsystem == \"com.apple.launchd\"`-inclusive) re-run.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact reconciliation ────────────
  {
    slug: "macos-tcc-privacy-database-001",
    title: "macOS TCC.db: Who Granted Which App What Permission",
    summary:
      "TCC is macOS's privacy database. Read user + system TCC.db together and tell which app got which permission, when, and by whose hand — without misreading SIP-protected vs operator-installed entries.",
    skillAreas: [
      "df_artifacts",
      "macos_artifacts",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "macos",
      "macos_artifacts",
      "df_artifacts",
      "persistence",
      "inference_discipline",
    ],
    lane: "macos_forensics",
    module: "macOS host triage",
    sequence: 2,
    brief: `
# Brief

\`mbp-08\` (Sonoma 14.6) was flagged because Slack's microphone
indicator stayed lit for hours during off-duty time. The macOS
**Transparency, Consent, and Control** (TCC) framework
mediates every app's access to camera, microphone, screen
capture, Accessibility, Full Disk Access, etc. Each
allow/deny decision is persisted to a SQLite database:

- \`/Library/Application Support/com.apple.TCC/TCC.db\`
  (system-wide, SIP-protected, mediates the
  per-device-services + Accessibility + Full Disk Access).
- \`~/Library/Application Support/com.apple.TCC/TCC.db\`
  (per-user, mediates user-scoped services like Photos,
  Contacts, Calendars).

You've been handed both as exported \`access\` table dumps,
plus the unified-log entries that show TCC prompts being
answered, the operator's MDM TCC profile (if any), and the
host context.

## Why TCC reads are non-trivial

- **Two stores, different scopes.** Microphone /
  Camera / ScreenCapture / Accessibility / FullDiskAccess
  live in the **system** \`TCC.db\`. Photos / Contacts /
  Calendars / Reminders live in the **per-user** store.
  Confusing the two leads to wrong "who granted this" reads.
- **\`auth_value\` and \`auth_reason\`.**
  \`auth_value\`: 0 = denied, 1 = unknown, 2 = allowed,
  3 = limited (e.g., Photos selection). \`auth_reason\`
  values include 1 (error), 2 (user consent), 3 (user
  configured), 4 (TCC profile), 5 (MDM profile), 6 (system
  set). A row with \`auth_reason = 5\` was set by a
  Configuration Profile, not the user.
- **\`csreq\` is a code-signing requirement blob.** It pins
  the entry to a specific bundle identity (team ID +
  bundle ID). Changing the binary (re-signing under a
  different developer) invalidates the row.
- **\`indirect_object_*\` columns** matter for
  Accessibility-mediated automation (one app controlling
  another). Skipping them misses an entire class of grant.
- **TCC.db is SIP-protected and only writable by
  \`tccd\`.** Mode/owner reads alone don't tell you who
  decided — you need \`auth_reason\` and the unified-log
  prompt trail.

## Artifacts

- **system-tcc-access.csv** — \`access\` table export from
  the system TCC.db.
- **user-tcc-access.csv** — \`access\` table export from
  \`~/Library/Application Support/com.apple.TCC/TCC.db\`
  for the suspect user.
- **mdm-tcc-profile.xml** — current MDM PPPC payload (or
  notice of its absence).
- **tccd-log-prompts.txt** — unified-log lines from
  \`subsystem == "com.apple.TCC"\` showing prompt /
  decision events for the relevant apps.
- **host-context.json** — macOS build, user list, SIP
  status.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "system-tcc-access.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            // Selected columns of access table; full schema has 20+ cols.
            "service,client,client_type,auth_value,auth_reason,csreq_team_id,csreq_bundle_id,last_modified_utc",
            "kTCCServiceMicrophone,com.tinyspeck.slackmacgap,0,2,4,BQR82RBBHL,com.tinyspeck.slackmacgap,2026-09-28T14:11:08Z",
            "kTCCServiceCamera,com.tinyspeck.slackmacgap,0,2,2,BQR82RBBHL,com.tinyspeck.slackmacgap,2026-09-28T14:11:09Z",
            "kTCCServiceMicrophone,us.zoom.xos,0,2,2,BJ4HAAB9B3,us.zoom.xos,2026-08-04T09:55:18Z",
            "kTCCServiceCamera,us.zoom.xos,0,2,2,BJ4HAAB9B3,us.zoom.xos,2026-08-04T09:55:18Z",
            "kTCCServiceScreenCapture,com.obsproject.obs-studio,0,2,2,2MMRE5MTB8,com.obsproject.obs-studio,2026-10-11T22:14:50Z",
            "kTCCServiceAccessibility,com.example.helper-tool,0,2,5,XX1234ABCD,com.example.helper-tool,2026-10-13T03:01:02Z",
            "kTCCServiceListenEvent,com.example.helper-tool,0,2,5,XX1234ABCD,com.example.helper-tool,2026-10-13T03:01:02Z",
            "kTCCServiceSystemPolicyAllFiles,com.example.helper-tool,0,2,5,XX1234ABCD,com.example.helper-tool,2026-10-13T03:01:02Z",
            "kTCCServicePostEvent,com.example.helper-tool,0,2,5,XX1234ABCD,com.example.helper-tool,2026-10-13T03:01:02Z",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "user-tcc-access.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "service,client,client_type,auth_value,auth_reason,csreq_team_id,csreq_bundle_id,last_modified_utc",
            "kTCCServicePhotos,com.tinyspeck.slackmacgap,0,3,2,BQR82RBBHL,com.tinyspeck.slackmacgap,2026-09-28T14:11:08Z",
            "kTCCServiceContacts,com.apple.iCal,0,2,3,APPLE,com.apple.iCal,2026-07-14T08:00:00Z",
            "kTCCServiceCalendar,com.tinyspeck.slackmacgap,0,0,2,BQR82RBBHL,com.tinyspeck.slackmacgap,2026-09-28T14:11:25Z",
            "kTCCServiceReminders,com.apple.Spotlight,0,2,6,APPLE,com.apple.Spotlight,2024-09-01T00:00:00Z",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "mdm-tcc-profile.xml",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<!-- Effective PPPC payload (com.apple.TCC.configuration-profile-policy) -->",
            "<!-- Source: Jamf Pro 11.3, profile com.example.mdm.helper-tool -->",
            "<plist version=\"1.0\">",
            "<dict>",
            "  <key>Services</key>",
            "  <dict>",
            "    <key>Accessibility</key>",
            "    <array>",
            "      <dict>",
            "        <key>Identifier</key>",
            "        <string>com.example.helper-tool</string>",
            "        <key>IdentifierType</key>",
            "        <string>bundleID</string>",
            "        <key>CodeRequirement</key>",
            "        <string>identifier \"com.example.helper-tool\" and anchor apple generic and certificate leaf[subject.OU] = XX1234ABCD</string>",
            "        <key>Allowed</key>",
            "        <true/>",
            "      </dict>",
            "    </array>",
            "    <key>ListenEvent</key>",
            "    <array><dict>...</dict></array>",
            "    <key>SystemPolicyAllFiles</key>",
            "    <array><dict>...</dict></array>",
            "    <key>PostEvent</key>",
            "    <array><dict>...</dict></array>",
            "  </dict>",
            "</dict>",
            "</plist>",
            "",
            "# Notes:",
            "# Microphone is NOT in this profile; the Slack mic grant in TCC has",
            "# auth_reason=4 (TCC profile) but the MDM-deployed profile here does",
            "# not cover Microphone for com.tinyspeck.slackmacgap. Investigate the",
            "# source of that profile-set row.",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "tccd-log-prompts.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# log show --predicate 'subsystem == \"com.apple.TCC\"' --start ... (excerpt)",
            "2026-08-04 02:55:18.040220-0700 mbp-08 tccd[143]: prompt issued: service=kTCCServiceMicrophone, client=us.zoom.xos, decision=ALLOW (user consent, foreground)",
            "2026-09-28 07:11:08.910201-0700 mbp-08 tccd[143]: profile applied: service=kTCCServiceMicrophone, client=com.tinyspeck.slackmacgap, source=ProfilePayload(com.example.mdm.baseline), prior_value=unset",
            "2026-09-28 07:11:09.011309-0700 mbp-08 tccd[143]: prompt issued: service=kTCCServiceCamera, client=com.tinyspeck.slackmacgap, decision=ALLOW (user consent, foreground)",
            "2026-10-11 15:14:50.881122-0700 mbp-08 tccd[143]: prompt issued: service=kTCCServiceScreenCapture, client=com.obsproject.obs-studio, decision=ALLOW (user consent, foreground)",
            "2026-10-12 20:01:02.554088-0700 mbp-08 tccd[143]: profile applied: service=kTCCServiceAccessibility, client=com.example.helper-tool, source=MDMPayload(com.example.mdm.helper-tool), prior_value=unset",
            "2026-10-12 20:01:02.601199-0700 mbp-08 tccd[143]: profile applied: service=kTCCServiceListenEvent, client=com.example.helper-tool, source=MDMPayload(com.example.mdm.helper-tool), prior_value=unset",
            "2026-10-12 20:01:02.633401-0700 mbp-08 tccd[143]: profile applied: service=kTCCServiceSystemPolicyAllFiles, client=com.example.helper-tool, source=MDMPayload(com.example.mdm.helper-tool), prior_value=unset",
            "2026-10-12 20:01:02.701557-0700 mbp-08 tccd[143]: profile applied: service=kTCCServicePostEvent, client=com.example.helper-tool, source=MDMPayload(com.example.mdm.helper-tool), prior_value=unset",
          ].join("\n") + "\n",
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
              host: "mbp-08",
              os: "macOS 14.6 (Sonoma) build 23G80",
              timezone: "America/Los_Angeles (PDT, -0700)",
              acquired_utc: "2026-10-14T16:00:00Z",
              sip_status: "enabled",
              user: { username: "carla", uid: 501, role: "primary user" },
              mdm: {
                enrolled: true,
                provider: "Jamf Pro 11.3",
                profiles_in_force: [
                  "com.example.mdm.baseline",
                  "com.example.mdm.helper-tool",
                  "com.example.mdm.firewall",
                ],
              },
              note: "The helper-tool MDM profile was installed Oct 12 to grant Accessibility / ListenEvent / SystemPolicyAllFiles / PostEvent. This is the exact privilege set used by a remote-control / endpoint-management tool. The Slack microphone grant has auth_reason=4 but no MDM payload visible in the deployed set covers Microphone for slackmacgap.",
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
          "Reading the TCC tables + the MDM profile + tccd prompt log together, which statements about *how* each grant was made are **proven**?",
        options: [
          {
            id: "zoom-camera-mic-user",
            label:
              "Zoom (`us.zoom.xos`) Camera + Microphone grants came from a **user consent prompt** answered on 2026-08-04; both rows show `auth_reason=2` (user consent) and tccd logged the prompt + decision.",
          },
          {
            id: "obs-screen-user",
            label:
              "OBS Studio's Screen Capture grant came from a user consent prompt on 2026-10-11 (`auth_reason=2`, matching tccd `prompt issued ... decision=ALLOW`).",
          },
          {
            id: "helper-tool-mdm",
            label:
              "The `com.example.helper-tool` cluster of grants (Accessibility / ListenEvent / SystemPolicyAllFiles / PostEvent) was set by an MDM-deployed Configuration Profile on 2026-10-13 03:01 UTC; `auth_reason=5` matches the tccd `profile applied ... source=MDMPayload` lines.",
          },
          {
            id: "slack-mic-profile-suspect",
            label:
              "The Slack Microphone grant carries `auth_reason=4` (TCC profile / Configuration Profile) but the operator's deployed MDM PPPC payload does not cover Microphone for `com.tinyspeck.slackmacgap`; the source of that row is unaccounted for and warrants investigation.",
          },
          {
            id: "slack-photos-user",
            label:
              "The Slack Photos grant in the per-user TCC.db is `auth_value=3` (limited selection) from a user consent on 2026-09-28 — Slack received access to a subset of Photos, not the full library.",
          },
          {
            id: "spotlight-system-set",
            label:
              "Apple's own Spotlight has `auth_reason=6` (system set) for Reminders, and this is forensically equivalent to the user having granted it on 2024-09-01 — `system set` is just how Apple records prior-explicit consent for first-party apps.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "zoom-camera-mic-user",
            "obs-screen-user",
            "helper-tool-mdm",
            "slack-mic-profile-suspect",
            "slack-photos-user",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Zoom + OBS: `auth_reason=2` rows with matching tccd `prompt issued ... decision=ALLOW` lines confirm user-consent origin.",
          "- helper-tool cluster: `auth_reason=5` plus `source=MDMPayload(com.example.mdm.helper-tool)` in the tccd log; this is exactly the privilege set of a remote-control tool, which is now formally on-record.",
          "- Slack Microphone: the row is real (`auth_reason=4`, profile applied), but the deployed MDM payload does NOT cover Microphone for slackmacgap. That's an evidence gap: the row exists, the source isn't visible. \"Investigate\" is the disciplined call.",
          "- Slack Photos `auth_value=3` means \"limited\" — that's the macOS \"selected photos\" UI, not full-library access.",
          "",
          "**Not proven:**",
          "",
          "- *Spotlight system-set == prior user consent* — `auth_reason=6` is set by the OS for system services. Treating it as user consent without independent evidence is over-claiming. It's just Apple's first-party bookkeeping for built-in functionality.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "An auditor asks: *did `carla` grant Slack microphone access?* What's the best answer from these artifacts alone?",
        options: [
          {
            id: "yes-user-prompted",
            label:
              "Yes — every TCC row implies a user prompt was answered at the row's timestamp, and the September 28 timestamp matches normal first-launch consent timing for a fresh Slack install.",
          },
          {
            id: "no-profile-set",
            label:
              "No — the Slack microphone row has `auth_reason=4` (Configuration Profile), which means a profile installed the grant; the user was never prompted. The source of that profile is, however, not visible in the deployed MDM payload set.",
          },
          {
            id: "no-tccd-confirms",
            label:
              "No — the tccd log line at 2026-09-28 07:11:08 shows `profile applied ... source=ProfilePayload(com.example.mdm.baseline)`; even though the deployed MDM payload set in this acquisition doesn't show Microphone, tccd has named the profile that did it.",
          },
          {
            id: "indeterminate-no-evidence",
            label:
              "Indeterminate — TCC rows are written by `tccd` regardless of whether the user, a profile, or a system policy authorised them; without a tccd log for the row's exact moment of creation, no `auth_reason` value can be relied upon as evidence.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-tccd-confirms"],
          allowMultiple: false,
        },
        debriefMd:
          "`auth_reason=4` denotes a Configuration Profile origin, and tccd's `profile applied ... source=ProfilePayload(com.example.mdm.baseline)` line names which profile. The user did not click an Allow button. The deployed MDM payload set in this acquisition doesn't visibly include Microphone for slackmacgap — that's an evidence gap (profile may have been removed, may have been delivered via a vector outside the standard PPPC payload, etc.). The correct response to the auditor is \"no, it was profile-set, by a profile named `com.example.mdm.baseline` per tccd — and the current MDM payload set doesn't show it, so the profile source needs follow-up.\"",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best confirm the `helper-tool` MDM-deployed grants actually came from the operator's Jamf Pro instance (not from an attacker pushing a malicious profile)?",
        options: [
          { id: "mdm-server-audit", label: "Jamf Pro server-side audit log showing the `com.example.mdm.helper-tool` profile push to this host." },
          { id: "device-management-policy", label: "On-device `profiles -P` output (or `~/Library/Managed Preferences/`) showing the profile's UUID + signing identity matches Jamf's published cert." },
          { id: "csreq-validation", label: "Verifying the `csreq_team_id` (XX1234ABCD) against the operator's developer-team registry — confirms the binary being granted is what was intended." },
          { id: "kext-list", label: "`kextstat` output (lists currently-loaded kernel extensions, which has no bearing on which profile installed which TCC grant)." },
          { id: "system-extension-status", label: "`systemextensionsctl list` (lists installed system extensions, also unrelated to PPPC profile attribution)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["mdm-server-audit", "device-management-policy", "csreq-validation"],
          allowMultiple: true,
        },
        debriefMd: [
          "Jamf's own audit log is authoritative for what it pushed. On-device `profiles -P` lists what's actually installed (and the signing identity ties it back to Jamf). `csreq` validation makes sure the granted bundle is the one the MDM intended.",
          "",
          "`kextstat` and `systemextensionsctl` are unrelated — those describe a different mechanism (kernel-extension / system-extension loading), not PPPC.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `com.example.helper-tool` is a sanctioned operator-deployed tool rather than attacker-installed malware mimicking one, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**2–4.** Positives: the grants came via an MDM profile listed in the host's `mdm.profiles_in_force` set, tccd logs name the source, and the team ID (XX1234ABCD) is consistent across all four grants. Caveats: nothing in the artifacts ties XX1234ABCD to a named-and-trusted operator-owned developer account, and a sanctioned-looking profile name doesn't authenticate the profile. Reserve 5 for after Jamf server-side audit + team-ID registry confirmation. Reserve 1 for after independent evidence the profile is malicious.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact persistence triage ─────────
  {
    slug: "macos-launch-agents-daemons-persistence-001",
    title: "macOS Persistence: LaunchAgents, LaunchDaemons, and the Four Search Paths",
    summary:
      "launchd is the dominant macOS persistence surface. Read the four search paths cleanly and tell what runs, on what trigger, as which user, with what scope.",
    skillAreas: [
      "df_artifacts",
      "macos_artifacts",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "macos",
      "macos_artifacts",
      "df_artifacts",
      "persistence",
      "inference_discipline",
    ],
    lane: "macos_forensics",
    module: "macOS host triage",
    sequence: 3,
    brief: `
# Brief

\`mbp-12\` (Sonoma 14.6) has been showing a small but
persistent egress to an IP outside the unit's allow-list every
five minutes since Oct 12. EDR shows the egress as a Python
process, parented to \`launchd\`. You've pulled the four
launchd search paths plus \`launchctl print-disabled\` and the
unified-log launchd entries for the suspect window.

## The four search paths (precedence and scope)

| Path | Scope | Runs as | SIP? |
|---|---|---|---|
| \`~/Library/LaunchAgents/\` | per-user | the user | no |
| \`/Library/LaunchAgents/\` | every user | each user, when they're logged in | no |
| \`/Library/LaunchDaemons/\` | system | root | no |
| \`/System/Library/LaunchAgents/\` and \`/System/Library/LaunchDaemons/\` | OS-shipped | varies | yes (SIP-protected; not user-writable) |

## Common traps

- **Agents vs Daemons run differently.** Daemons load at
  boot and run as root regardless of who's logged in. Agents
  load at user login and run as that user. A file in
  \`/Library/LaunchAgents/\` runs for every user as
  themselves (not as root).
- **\`RunAtLoad\` vs \`StartInterval\` vs
  \`StartCalendarInterval\` vs \`WatchPaths\` vs
  \`KeepAlive\` vs \`OnDemand\`.** The trigger semantics
  are how you say what \`runs\` actually means. A
  \`KeepAlive=true\` daemon respawns immediately on exit; a
  \`StartInterval=300\` job fires every 5 minutes; a
  \`WatchPaths\` job fires on filesystem events for the
  listed paths.
- **\`Label\` does NOT have to match the filename.** The
  on-disk filename is convention; \`launchctl\` keys by the
  \`Label\` inside the plist.
- **\`launchctl print-disabled <domain>\`** lists labels
  that have been explicitly disabled by an admin. A plist
  on disk can be \`Disabled=true\` in the file AND/OR
  disabled in the domain database — don't conflate.
- **\`/System/Library/\` is SIP-protected.** You can read
  it, but a malicious file installed under
  \`/System/Library/LaunchDaemons/\` is forensically
  impossible without SIP being disabled (which would itself
  be a finding).

## Artifacts

- **launch-agents-system.txt** —
  \`ls -la /Library/LaunchAgents/\` plus per-file \`cat\`.
- **launch-daemons-system.txt** —
  \`ls -la /Library/LaunchDaemons/\` plus per-file \`cat\`.
- **launch-agents-user.txt** —
  \`ls -la ~/Library/LaunchAgents/\` (for the suspect user)
  plus per-file \`cat\`.
- **launchctl-print-disabled.txt** —
  \`launchctl print-disabled gui/501\` and \`system\`.
- **launchd-log-window.txt** — unified-log entries for the
  suspect labels in the egress window.
- **host-context.json** — macOS build, suspect user list,
  SIP status, egress baseline.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "launch-agents-system.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ls -la /Library/LaunchAgents/",
            "total 24",
            "drwxr-xr-x   5 root  wheel  160 Oct 12 23:18 .",
            "drwxr-xr-x  62 root  wheel 1984 Aug 04 14:55 ..",
            "-rw-r--r--   1 root  wheel  642 Aug 04 14:55 com.apple.bird.plist",
            "-rw-r--r--   1 root  wheel  502 Aug 04 14:55 com.example.mdm.helper.plist",
            "-rw-r--r--   1 root  wheel  772 Oct 12 23:18 com.example.sync-heartbeat.plist",
            "",
            "# cat /Library/LaunchAgents/com.example.sync-heartbeat.plist",
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<plist version=\"1.0\">",
            "<dict>",
            "  <key>Label</key>          <string>com.example.sync-heartbeat</string>",
            "  <key>ProgramArguments</key>",
            "  <array>",
            "    <string>/usr/bin/python3</string>",
            "    <string>-c</string>",
            "    <string>import urllib.request,ssl; urllib.request.urlopen('https://203.0.113.91/beacon', context=ssl._create_unverified_context()).read()</string>",
            "  </array>",
            "  <key>StartInterval</key>  <integer>300</integer>",
            "  <key>RunAtLoad</key>      <true/>",
            "  <key>KeepAlive</key>      <false/>",
            "  <key>StandardOutPath</key><string>/tmp/sh.out</string>",
            "  <key>StandardErrorPath</key><string>/tmp/sh.err</string>",
            "</dict>",
            "</plist>",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "launch-daemons-system.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ls -la /Library/LaunchDaemons/",
            "total 16",
            "drwxr-xr-x   4 root  wheel  128 Sep 28 10:01 .",
            "drwxr-xr-x  62 root  wheel 1984 Aug 04 14:55 ..",
            "-rw-r--r--   1 root  wheel  812 Sep 28 10:01 com.example.mdm.osquery.plist",
            "-rw-r--r--   1 root  wheel  742 Aug 04 14:55 com.example.mdm.policy-banner.plist",
            "",
            "# cat /Library/LaunchDaemons/com.example.mdm.osquery.plist",
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<plist version=\"1.0\">",
            "<dict>",
            "  <key>Label</key>          <string>com.example.mdm.osquery</string>",
            "  <key>ProgramArguments</key>",
            "  <array>",
            "    <string>/usr/local/bin/osqueryd</string>",
            "    <string>--flagfile=/etc/osquery/osquery.flags</string>",
            "  </array>",
            "  <key>RunAtLoad</key>      <true/>",
            "  <key>KeepAlive</key>      <true/>",
            "  <key>StandardOutPath</key><string>/var/log/osquery/stdout.log</string>",
            "</dict>",
            "</plist>",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "launch-agents-user.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ls -la ~/Library/LaunchAgents/  (uid=501, user=carla)",
            "total 8",
            "drwxr-xr-x   3 carla  staff   96 Oct 12 20:11 .",
            "drwx------ 88 carla  staff 2816 Oct 12 20:11 ..",
            "-rw-r--r--   1 carla  staff  502 Oct 12 20:11 com.user.dictation-helper.plist",
            "",
            "# cat ~/Library/LaunchAgents/com.user.dictation-helper.plist",
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
            "<plist version=\"1.0\">",
            "<dict>",
            "  <key>Label</key>          <string>com.user.dictation-helper</string>",
            "  <key>ProgramArguments</key>",
            "  <array>",
            "    <string>/Users/carla/Library/Application Support/dh/dh-agent</string>",
            "    <string>--silent</string>",
            "  </array>",
            "  <key>RunAtLoad</key>      <true/>",
            "  <key>KeepAlive</key>      <true/>",
            "</dict>",
            "</plist>",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "launchctl-print-disabled.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# launchctl print-disabled system",
            "{",
            "  \"com.apple.MailDeliveryWatcher\" => disabled",
            "  \"com.example.legacy-old-thing\" => disabled",
            "}",
            "",
            "# launchctl print-disabled gui/501",
            "{",
            "  (no disabled labels)",
            "}",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "launchd-log-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# log show --predicate 'subsystem == \"com.apple.launchd\"' --start ... (excerpt)",
            "2026-10-12 16:18:01.022041-0700 mbp-12 launchd[1]: gui/501/com.example.sync-heartbeat: load called",
            "2026-10-12 16:18:01.041122-0700 mbp-12 launchd[1]: gui/501/com.example.sync-heartbeat: launching at load (RunAtLoad)",
            "2026-10-12 16:23:01.000020-0700 mbp-12 launchd[1]: gui/501/com.example.sync-heartbeat: launching for StartInterval (period=300)",
            "2026-10-12 16:23:01.500102-0700 mbp-12 launchd[1]: gui/501/com.example.sync-heartbeat: pid=4811 exited (status=0, runtime=0.5s)",
            "2026-10-13 09:00:00.000200-0700 mbp-12 launchd[1]: gui/501/com.user.dictation-helper: load called",
            "2026-10-13 09:00:00.040301-0700 mbp-12 launchd[1]: gui/501/com.user.dictation-helper: launching at load (RunAtLoad)",
            "2026-10-13 09:00:00.501404-0700 mbp-12 launchd[1]: gui/501/com.user.dictation-helper: pid=5202 exited (status=1, runtime=0.5s)",
            "2026-10-13 09:00:00.510405-0700 mbp-12 launchd[1]: gui/501/com.user.dictation-helper: respawning (KeepAlive)",
            "2026-10-13 09:00:00.512407-0700 mbp-12 launchd[1]: gui/501/com.user.dictation-helper: pid=5203 exited (status=1, runtime=0.001s)",
            "2026-10-13 09:00:00.620420-0700 mbp-12 launchd[1]: gui/501/com.user.dictation-helper: throttled (10 launches in 10s)",
          ].join("\n") + "\n",
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
              host: "mbp-12",
              os: "macOS 14.6 (Sonoma) build 23G80",
              timezone: "America/Los_Angeles (PDT, -0700)",
              acquired_utc: "2026-10-14T16:00:00Z",
              sip_status: "enabled",
              users: [{ username: "carla", uid: 501 }],
              egress_baseline: {
                normal_avg_per_day_bytes: 110000000,
                last_3_days_avg_per_day_bytes: 134000000,
                jumped_on_utc: "2026-10-13T06:18:00Z",
              },
              note: "/Library/LaunchAgents/com.example.sync-heartbeat.plist appeared Oct 12 23:18 UTC alongside the egress shift. The plist is owned by root (writable only by root). The user-level com.user.dictation-helper appeared Oct 13; it KeepAlive-respawns a missing target binary and was throttled by launchd.",
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
          "From the four search paths + the disabled list + the launchd log, which statements are **proven**?",
        options: [
          {
            id: "sync-heartbeat-runs-as-user",
            label:
              "`com.example.sync-heartbeat` runs every 5 minutes (and at load) as **user 501 (carla)**, not as root — it lives in `/Library/LaunchAgents/`, which loads per-user when the user is logged in.",
          },
          {
            id: "sync-heartbeat-as-root",
            label:
              "`com.example.sync-heartbeat` runs as **root** because the plist is in `/Library/` and owned by `root:wheel`; LaunchAgents under `/Library/` inherit root credentials at load.",
          },
          {
            id: "dictation-helper-throttled",
            label:
              "`com.user.dictation-helper` is currently throttled by launchd after KeepAlive-respawning into a non-existent target binary — the launchd log shows \"throttled (10 launches in 10s)\" at 2026-10-13 09:00.",
          },
          {
            id: "osqueryd-keepalive-daemon",
            label:
              "`com.example.mdm.osquery` is a system daemon (LaunchDaemon, runs as root) with `KeepAlive=true` and `RunAtLoad=true` — it loads at boot and respawns immediately on exit.",
          },
          {
            id: "sync-heartbeat-attribution",
            label:
              "Whoever installed `com.example.sync-heartbeat.plist` had root privileges on this host (the plist is `-rw-r--r--`, owned `root:wheel`, in a root-only directory); attribution to the named user `carla` is not supported by the file metadata alone.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["sync-heartbeat-runs-as-user", "dictation-helper-throttled", "osqueryd-keepalive-daemon", "sync-heartbeat-attribution"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- `/Library/LaunchAgents/` plists run per-user as that user. The launchd log confirms: `gui/501/com.example.sync-heartbeat` runs in `carla`'s domain. The file being owned by root has no bearing on which UID the *child process* runs under.",
          "- `com.user.dictation-helper`: launchd's throttle log line is the canonical fingerprint of an unresolvable KeepAlive target.",
          "- `osqueryd`: `/Library/LaunchDaemons/` + KeepAlive + RunAtLoad = always-on root daemon.",
          "- Attribution: root was required to write to `/Library/LaunchAgents/`; the on-disk metadata says someone-with-root, not `carla`. Promote to user-level attribution only with sudo / EDR / unified-log evidence.",
          "",
          "**Not proven:**",
          "",
          "- *Runs as root* — that's the misread. LaunchAgents under `/Library/LaunchAgents/` run as the logged-in user, regardless of file owner. Only LaunchDaemons run as root.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Reading the suspect plist's `ProgramArguments`, what does the Python invocation actually do at run time?",
        options: [
          {
            id: "https-cert-skip",
            label:
              "Opens an HTTPS connection to `https://203.0.113.91/beacon` **with TLS certificate verification disabled** (`ssl._create_unverified_context()`), reads the response body, and exits.",
          },
          {
            id: "verifies-cert",
            label:
              "Opens an HTTPS connection to `https://203.0.113.91/beacon` with normal certificate verification; `_create_unverified_context()` only suppresses HSTS pinning warnings in CPython 3.13+, not the actual cert chain check.",
          },
          {
            id: "writes-to-disk",
            label:
              "Writes the response body to `/tmp/sh.out` and the error stream to `/tmp/sh.err`; the launchd `StandardOutPath` / `StandardErrorPath` keys redirect the script's own stdout to those files, so any HTTPS response body lands on disk for retrieval.",
          },
          {
            id: "does-nothing",
            label:
              "Nothing meaningful — `urllib.request.urlopen` only opens the TCP socket; without an explicit `.read()` flush invoked on the response object the OS-level send does not complete, so no data is transmitted.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["https-cert-skip"],
          allowMultiple: false,
        },
        debriefMd:
          "`ssl._create_unverified_context()` returns a `SSLContext` with `CERT_NONE` and `check_hostname=False` — that disables certificate validation entirely. `urlopen(..., context=ctx).read()` opens the connection, sends the request, and reads the body. `StandardOutPath` captures the *Python interpreter's* stdout, not the HTTP response body (which `.read()` returns as bytes, then discards because nothing is assigned).",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating evidence best proves the **beacon is actually sending bytes** (not just configured)?",
        options: [
          { id: "endpoint-flow", label: "Endpoint flow records or pfctl logs showing outbound connections from python3 (uid 501) to `203.0.113.91:443`." },
          { id: "tcp-conntrack", label: "Live `lsof -i` / `nettop` showing an ESTABLISHED connection to `203.0.113.91:443` matched to a python3 PID." },
          { id: "es-network-events", label: "Endpoint Security (`com.apple.endpointsecurity`) `ES_EVENT_TYPE_NOTIFY_KEXTLOAD`-class events for python3 around the 5-minute cadence (if the deployed EDR subscribes to network-create events)." },
          { id: "upstream-flow", label: "Upstream switch/firewall flow logs for the host's IP showing periodic 5-minute outbound bursts to `203.0.113.91/32`." },
          { id: "launchd-log-only", label: "The launchd log line `launching for StartInterval` (proves the **job** was scheduled, not that the network call succeeded)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["endpoint-flow", "tcp-conntrack", "es-network-events", "upstream-flow"],
          allowMultiple: true,
        },
        debriefMd: [
          "Anything that captures the actual socket state or upstream packet flow corroborates transmission independently. The launchd log line is necessary but not sufficient — it just says the python invocation was scheduled.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that **carla personally** installed `com.example.sync-heartbeat.plist`, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The plist is in `/Library/LaunchAgents/` and owned by `root:wheel`. That tells you the installer had root — which on a single-user laptop is one of several human paths (`sudo` from carla's shell, an admin-pushed install, a malicious payload exploiting a sudoers misconfig, an MDM payload). Nothing in the artifacts ties the file's creation to carla specifically. Attribution to a person requires sudo log + bash history + unified-log SecuritySession + likely the MDM audit.",
      },
    ],
  },

  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "macos-fsevents-atomic-replace-001",
    title: "macOS FSEvents: What's Recorded, What's Coalesced, What Atomic-Replace Hides",
    summary:
      "FSEvents logs filesystem changes at a directory granularity. Read a stream cleanly — and notice every place it's been smoothed over by coalescing or atomic-replace semantics.",
    skillAreas: ["df_artifacts", "macos_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "macos", "macos_artifacts", "df_artifacts", "inference_discipline"],
    lane: "macos_forensics",
    module: "macOS host triage",
    sequence: 4,
    brief: `
# Brief

A user (\`carla\`) is suspected of staging a small exfil
package on \`mbp-08\`. The analyst pulled the host's
\`/.fseventsd/\` store as part of the disk acquisition. The
parsed stream (one record per event-id) sits below alongside a
\`stat\` of the directory of interest and the unified-log
\`com.apple.fseventsd\` lines for the same window.

## What FSEvents records

\`fseventsd\` watches APFS volumes and writes one record per
filesystem change to gzipped log files under \`/.fseventsd/\`.
Each record carries:

- **event_id** — monotonically increasing 64-bit counter.
- **path** — the directory (and sometimes file) the change
  applied to.
- **flags** — bitmask telling you *what kind* of change:
  \`Created\`, \`Removed\`, \`InodeMetaMod\`, \`Renamed\`,
  \`Modified\`, \`Finder Info Mod\`,
  \`Cloned\`, \`Mount\`, \`Unmount\`, \`ItemIsFile\`,
  \`ItemIsDir\`, \`ItemIsSymlink\`, \`OwnEvent\` (event
  caused by self), etc.

## Common traps

- **Coalescing.** Multiple events on the same path inside a
  short window are merged into a single record with the
  union of flags. A \`Created | Modified | Removed\` row
  means *at some point in the window each of those flags
  fired* — not a strict order.
- **Atomic-replace semantics.** Editors / package
  installers commonly write to a temp file, \`rename\` it
  onto the target. The target path sees a \`Renamed |
  Created\` flag and the original inode is replaced; the
  original content is gone with no \`Modified\` event for
  it.
- **Directory-granular by default.** Many FSEvents records
  are reported at the *parent directory* level, not the
  exact file. Distinguishing "this file changed" from
  "something in this directory changed" requires either the
  \`ItemIsFile\` flag or out-of-band corroboration.
- **\`/.fseventsd/\` can be cleared.** Removing the store
  resets event IDs; replay then begins at 0. A suddenly-low
  event_id in a long-running system is suspicious.
- **Some volumes don't write FSEvents.** External APFS
  volumes set \`NoLog\` by default; firmlink targets and
  certain synthesized volumes don't surface events.

## Artifacts

- **fsevents-window.csv** — parsed FSEvents records
  (event_id, ts, path, flags) for the suspect window.
- **dir-stat.txt** — \`stat\` and \`ls -la\` of the
  directory of interest at acquisition.
- **fseventsd-log.txt** — unified-log lines for
  \`com.apple.fseventsd\` covering the window.
- **host-context.json** — host facts.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "fsevents-window.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "event_id,ts_utc,path,flags",
            "9988100,2026-10-14T08:40:11Z,/Users/carla/Documents/staging,Created|ItemIsDir",
            "9988101,2026-10-14T08:40:14Z,/Users/carla/Documents/staging,Created|Modified|ItemIsFile",
            "9988102,2026-10-14T08:42:50Z,/Users/carla/Documents/staging,Created|Modified|ItemIsFile",
            "9988103,2026-10-14T08:43:00Z,/Users/carla/Documents/staging,Created|Modified|ItemIsFile",
            "9988120,2026-10-14T08:44:01Z,/Users/carla/Documents/staging/manifest.txt,Renamed|Created|ItemIsFile",
            "9988121,2026-10-14T08:44:30Z,/Users/carla/Documents/staging,Modified|InodeMetaMod|ItemIsDir",
            "9988140,2026-10-14T08:45:55Z,/Users/carla/Documents,Created|ItemIsFile",
            "9988141,2026-10-14T08:46:02Z,/Users/carla/Documents/staging.zip,Created|Modified|ItemIsFile",
            "9988155,2026-10-14T08:48:11Z,/Users/carla/Documents/staging,Removed|ItemIsDir",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "dir-stat.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# As of acquisition (2026-10-14T16:00:00Z)",
            "# stat -f \"%N %z %m %B\" /Users/carla/Documents/staging.zip",
            "/Users/carla/Documents/staging.zip 4118202 1760431562 1760431562",
            "",
            "# ls -la /Users/carla/Documents/staging.zip",
            "-rw-r--r--  1 carla  staff  4118202 Oct 14 01:46 /Users/carla/Documents/staging.zip",
            "",
            "# /Users/carla/Documents/staging directory no longer exists at capture time",
            "ls: /Users/carla/Documents/staging: No such file or directory",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "fseventsd-log.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# log show --predicate 'subsystem == \"com.apple.fseventsd\"' --start ... (excerpt)",
            "2026-10-14 01:40:11.022041-0700 mbp-08 fseventsd[112]: persistent log write event_id=9988100 path=/Users/carla/Documents/staging flags=0x101 (Created|ItemIsDir)",
            "2026-10-14 01:44:01.500200-0700 mbp-08 fseventsd[112]: persistent log write event_id=9988120 path=/Users/carla/Documents/staging/manifest.txt flags=0x910 (Renamed|Created|ItemIsFile)",
            "2026-10-14 01:46:02.881420-0700 mbp-08 fseventsd[112]: persistent log write event_id=9988141 path=/Users/carla/Documents/staging.zip flags=0x110 (Created|Modified|ItemIsFile)",
            "2026-10-14 01:48:11.041511-0700 mbp-08 fseventsd[112]: persistent log write event_id=9988155 path=/Users/carla/Documents/staging flags=0x201 (Removed|ItemIsDir)",
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
              host: "mbp-08",
              os: "macOS 14.6 (Sonoma) build 23G80",
              timezone: "America/Los_Angeles (PDT, -0700)",
              acquired_utc: "2026-10-14T16:00:00Z",
              user: { username: "carla", uid: 501, home: "/Users/carla" },
              apfs_volume: {
                mount_point: "/",
                no_log_flag: false,
                event_id_high_water: 9988160,
              },
              note: "FSEvents writes are directory-granular for most flags. The Renamed|Created flag combination at event 9988120 is the canonical fingerprint of an atomic-replace via temp-file + rename: the original inode at that path is gone, replaced by a fresh inode.",
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
          "From the FSEvents window + the dir-stat + the unified-log entries, which statements are **proven**?",
        options: [
          {
            id: "staging-dir-created-removed",
            label:
              "A directory at `/Users/carla/Documents/staging` was created at 08:40:11Z, had file activity inside it for several minutes, and was removed at 08:48:11Z. The directory no longer exists at acquisition (confirmed by the failed `ls`).",
          },
          {
            id: "zip-created",
            label:
              "A file `/Users/carla/Documents/staging.zip` was created and written at 08:46:02Z (event 9988141, `Created|Modified|ItemIsFile`); it still exists at acquisition with size 4 118 202 bytes.",
          },
          {
            id: "manifest-was-edited",
            label:
              "`manifest.txt` inside `staging` was **edited in place** at 08:44:01Z — the `Modified` flag at event 9988120 indicates the file's existing inode was rewritten.",
          },
          {
            id: "manifest-was-replaced",
            label:
              "`manifest.txt` was **atomically replaced** at 08:44:01Z (event 9988120 shows `Renamed|Created`, the canonical fingerprint of a temp-file + rename swap); the original inode and content are gone with no `Modified` event preserved against the original.",
          },
          {
            id: "we-can-recover-staging",
            label:
              "Because FSEvents records the original inode and content of every change, the files that were inside `/Users/carla/Documents/staging` before the removal can be recovered by walking the event log.",
          },
          {
            id: "files-zipped-into-archive",
            label:
              "The contents of `/Users/carla/Documents/staging/` were zipped into `staging.zip` at 08:46:02Z; the proximity of the `staging.zip` Create event to the staging directory's last activity proves the zip's contents are the staged files.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "staging-dir-created-removed",
            "zip-created",
            "manifest-was-replaced",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Directory lifecycle (Create + activity + Remove) is in the event log and the dir-stat confirms it's gone.",
          "- `staging.zip` Create + size match `stat`.",
          "- `Renamed|Created` for `manifest.txt` is the canonical atomic-replace fingerprint — the path resolves to a different inode than before the rename.",
          "",
          "**Not proven:**",
          "",
          "- *manifest edited in place* — `Renamed|Created` is *not* the same as `Modified`. The original inode (and its content) is gone; only the path is reused.",
          "- *Recover staging contents from FSEvents* — FSEvents records the fact of change at a path, not the content. The content recovery question is for inode / dataset snapshots / Time Machine, not FSEvents.",
          "- *Zip contents == staging contents* — proximity in time is suggestive, not proof. The zip could contain anything; confirming requires looking inside (or hashing matching files).",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Event 9988101 says `path=/Users/carla/Documents/staging, flags=Created|Modified|ItemIsFile`. What does this row actually mean?",
        options: [
          {
            id: "file-named-staging",
            label:
              "A file literally named `staging` was created in `/Users/carla/Documents/` at 08:40:14Z, then modified shortly afterward inside the same coalescing window; the `ItemIsFile` flag rules out the directory case.",
          },
          {
            id: "file-inside-staging",
            label:
              "A file (`ItemIsFile`) was created and modified inside `/Users/carla/Documents/staging/`; FSEvents commonly reports at parent-directory granularity, so the path is the directory containing the actual file, and the filename itself is not recoverable from this row alone.",
          },
          {
            id: "metadata-only",
            label:
              "Only directory metadata changed (e.g., \"a file inside was touched\"); the `ItemIsFile` flag in this context is a default-on bit that does not necessarily mean a file event, and the `Created|Modified` pair indicates a directory inode bump rather than an actual file write.",
          },
          {
            id: "two-files",
            label:
              "Two separate files were created and modified — `Created|Modified` flag pairs always indicate at least one Create and at least one Modify on distinct files inside the directory.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["file-inside-staging"],
          allowMultiple: false,
        },
        debriefMd:
          "FSEvents is directory-granular for most flags; the path is the parent directory, and the `ItemIsFile` flag tells you the change inside it was to a file (not the directory's own metadata). The exact filename inside `staging/` is NOT recoverable from this row alone — that's the classic FSEvents-vs-fanotify difference. Flags are a coalesced bitmask: `Created|Modified` means *Create and Modify both happened in the window*, not that two files were involved.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best determine the **filenames that lived inside `/Users/carla/Documents/staging/`** before its removal?",
        options: [
          { id: "spotlight-index", label: "The Spotlight index (`mdfind` / `mdls`) — may still hold metadata records for files that have been deleted but not yet purged from the index." },
          { id: "time-machine", label: "Local snapshots / Time Machine backups covering the window." },
          { id: "apfs-snapshots", label: "APFS local snapshots (`tmutil listlocalsnapshots`) — APFS keeps periodic snapshots that may include the directory before removal." },
          { id: "zip-contents", label: "The `staging.zip` file itself — opening it tells you what was zipped (if the contents map to the staged files)." },
          { id: "fseventsd-replay", label: "Replaying fseventsd events with a deeper parser that recovers filenames (FSEvents does not record the filename in directory-granular events; no parser can recover what wasn't written)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["spotlight-index", "time-machine", "apfs-snapshots", "zip-contents"],
          allowMultiple: true,
        },
        debriefMd: [
          "Spotlight, snapshots, and the staging.zip itself can yield filenames. APFS local snapshots are often available even when Time Machine isn't.",
          "",
          "FSEvents does not record the filename when it reports at directory granularity; no parser recovers what the system never wrote.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `staging.zip` contains exactly the files that were in `/Users/carla/Documents/staging/` immediately before removal, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2–3.** The proximity (8:46 zip create, 8:48 staging directory removal) is suggestive but not conclusive. The zip could contain anything; nothing in the FSEvents stream tells you what was zipped. Reserve 4–5 for after opening the zip and matching its contents to APFS-snapshot copies of the directory.",
      },
    ],
  },

  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "macos-quarantine-xattrs-gatekeeper-001",
    title: "macOS Quarantine xattrs + Gatekeeper: Reading a Download's Provenance",
    summary:
      "macOS stamps every download with extended attributes that record where it came from and whether Gatekeeper has cleared it. Read them — and notice what gets stripped or transferred.",
    skillAreas: ["df_artifacts", "macos_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "macos", "macos_artifacts", "df_artifacts", "inference_discipline"],
    lane: "macos_forensics",
    module: "macOS host triage",
    sequence: 5,
    brief: `
# Brief

A suspicious archive (\`payload.zip\`) was found in
\`carla\`'s Downloads folder on \`mbp-08\`. Several files
were extracted from it. The analyst captured the relevant
extended-attribute (\`xattr\`) reads, the Gatekeeper
assessment, the LSQuarantine event log, and the host context.
Your job: read the xattrs cleanly and report the
provenance + Gatekeeper status of each file.

## Key xattrs

- **\`com.apple.quarantine\`** — applied by an
  LSQuarantine-aware app (Safari, Chrome, Mail, AirDrop,
  iMessage, etc.) when content arrives from \"untrusted\"
  origin. Format:
  \`<flags>;<hex_timestamp>;<agent>;<event_uuid>\`. The
  UUID keys into \`~/Library/Preferences/com.apple.LaunchServices.QuarantineEventsV2\`
  for the full event record (origin URL, sender).
- **\`com.apple.metadata:kMDItemWhereFroms\`** —
  binary-plist array of source URLs (referrer + direct URL).
- **\`com.apple.macl\`** — TCC-related "this app touched
  this file" tag.
- **\`com.apple.lastuseddate#PS\`** — last opened.

## Gatekeeper semantics

- \`spctl --assess --verbose\` returns \`accepted\`,
  \`rejected\`, or an error. The reason includes the
  signing identity, notarization status, and any policy
  hit (\`source=Notarized Developer ID\`, etc.).
- A first-run \`open\` of a quarantined app triggers the
  full Gatekeeper assessment + Notarization check. After
  acceptance, the quarantine flags shift (the leading flag
  word changes from \`0181\` to \`00c1\` etc.) and may
  remain.

## Common traps

- **xattrs are stripped by some copies.** \`cp -p\`,
  \`rsync -X\`, and APFS clones preserve xattrs. AFP / SMB
  copies and many cross-filesystem moves do not. A file
  *missing* a quarantine bit isn't proof the OS originated
  it; it's proof xattrs aren't there *now*.
- **Quarantine is per-extracted-file.** Unzipping a
  quarantined zip propagates quarantine to extracted
  members on modern macOS. On older versions, it didn't.
- **\`spctl\` reads policy in force at run time.** A
  \`spctl --master-disable\` (which actually requires SIP
  off) changes the result. Capture the policy state, not
  just the assessment.
- **\`kMDItemWhereFroms\` is a hint, not authentication.**
  The app sets it; a malicious extraction tool can write
  arbitrary URLs.

## Artifacts

- **xattr-payload.txt** — \`xattr -lp <name> <file>\` for
  the suspicious zip, two extracted files, and one
  cross-checked clean file.
- **spctl-assess.txt** — Gatekeeper assessment for each
  file at acquisition.
- **quarantine-events.txt** —
  \`QuarantineEventsV2\` rows for the event UUIDs found.
- **host-context.json** — macOS version, Gatekeeper policy,
  SIP status.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "xattr-payload.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# xattr -lp com.apple.quarantine + kMDItemWhereFroms (host=mbp-08; PDT/UTC-7)",
            "",
            "# ~/Downloads/payload.zip",
            "com.apple.quarantine: 0181;65094da4;com.google.Chrome;9F3B0C5E-7A21-4B11-BB22-3F7C9C0AA841",
            "com.apple.metadata:kMDItemWhereFroms: ('https://cdn.example.net/d/payload.zip', 'https://example.net/login')",
            "",
            "# ~/Downloads/payload/setup",
            "com.apple.quarantine: 0181;65094db0;com.google.Chrome;9F3B0C5E-7A21-4B11-BB22-3F7C9C0AA841",
            "com.apple.metadata:kMDItemWhereFroms: ('https://cdn.example.net/d/payload.zip', 'https://example.net/login')",
            "",
            "# ~/Downloads/payload/readme.md",
            "com.apple.quarantine: 0181;65094db0;com.google.Chrome;9F3B0C5E-7A21-4B11-BB22-3F7C9C0AA841",
            "",
            "# /Applications/Slack.app",
            "com.apple.quarantine: (no such xattr) -- (stripped or never set)",
            "com.apple.metadata:kMDItemWhereFroms: ('https://downloads.slack-edge.com/releases_x64/Slack-4.40.95-macOS.dmg',)",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "spctl-assess.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# spctl --assess --verbose --type install / execute (PDT)",
            "$ spctl --assess --verbose=4 --type install ~/Downloads/payload.zip",
            "~/Downloads/payload.zip: rejected",
            "source=no usable signature",
            "",
            "$ spctl --assess --verbose=4 --type execute ~/Downloads/payload/setup",
            "~/Downloads/payload/setup: rejected",
            "source=no usable signature",
            "origin=unknown",
            "",
            "$ spctl --assess --verbose=4 --type execute /Applications/Slack.app",
            "/Applications/Slack.app: accepted",
            "source=Notarized Developer ID",
            "origin=Developer ID Application: Slack Technologies, Inc. (BQR82RBBHL)",
            "",
            "$ spctl --status",
            "assessments enabled",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "quarantine-events.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# sqlite3 ~/Library/Preferences/com.apple.LaunchServices.QuarantineEventsV2 \\",
            "#   'SELECT LSQuarantineEventIdentifier, LSQuarantineTimeStamp, LSQuarantineAgentName,",
            "#   LSQuarantineOriginURLString, LSQuarantineDataURLString, LSQuarantineSenderName FROM",
            "#   LSQuarantineEvent WHERE LSQuarantineEventIdentifier = \"9F3B0C5E-7A21-4B11-BB22-3F7C9C0AA841\";'",
            "",
            "EventIdentifier:       9F3B0C5E-7A21-4B11-BB22-3F7C9C0AA841",
            "TimeStamp_utc:         2026-10-14T08:31:24Z",
            "AgentName:             com.google.Chrome",
            "OriginURLString:       https://example.net/login",
            "DataURLString:         https://cdn.example.net/d/payload.zip",
            "SenderName:            (null)",
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
              host: "mbp-08",
              os: "macOS 14.6 (Sonoma) build 23G80",
              timezone: "America/Los_Angeles (PDT, -0700)",
              acquired_utc: "2026-10-14T16:00:00Z",
              sip_status: "enabled",
              gatekeeper_status: "assessments enabled",
              user: { username: "carla", uid: 501 },
              note: "Gatekeeper is in 'App Store and identified developers' mode (default for managed laptops). spctl assessments are on. The quarantine flag byte 0x01 in '0181;...' means 'quarantined, not yet opened'; 0x40 or 0xC0 would indicate the file has been opened past a Gatekeeper consent dialog at least once.",
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
          "From the xattrs + Gatekeeper assessments + QuarantineEvents table, which statements are **proven**?",
        options: [
          {
            id: "payload-from-chrome",
            label:
              "`payload.zip` was downloaded by Chrome (`com.google.Chrome` agent) from `https://cdn.example.net/d/payload.zip` (referrer `https://example.net/login`) at 2026-10-14T08:31:24Z; the QuarantineEvents UUID matches the xattr UUID.",
          },
          {
            id: "payload-not-opened",
            label:
              "`payload.zip` has not been opened past a Gatekeeper consent dialog on this host — the leading quarantine flag byte is `0x01` (\"quarantined, not yet opened\"); a post-consent value would be `0x40` or `0xC0`.",
          },
          {
            id: "extracted-quarantined-too",
            label:
              "The extracted files (`setup` and `readme.md`) carry the **same** quarantine UUID as the zip — modern macOS propagates the parent's quarantine flag to extracted members.",
          },
          {
            id: "setup-rejected",
            label:
              "Gatekeeper rejects `setup` (`source=no usable signature, origin=unknown`); it is unsigned and not notarized.",
          },
          {
            id: "slack-malicious",
            label:
              "`/Applications/Slack.app` has no `com.apple.quarantine` xattr, which means the binary was placed by a process bypassing LSQuarantine (typical for malware that drops a binary into `/Applications/` directly), and should be treated as suspect until proven otherwise.",
          },
          {
            id: "readme-also-rejected",
            label:
              "`readme.md` would also be rejected by `spctl --type execute` because it carries the quarantine xattr, and `spctl` rejects anything quarantined and unsigned regardless of file type.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "payload-from-chrome",
            "payload-not-opened",
            "extracted-quarantined-too",
            "setup-rejected",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Quarantine UUID matches the QuarantineEventsV2 row; agent + timestamp + URLs line up.",
          "- Leading flag byte `01` means quarantined-but-not-opened. (The flag word's low byte encodes opened state.)",
          "- Modern macOS propagates the parent zip's quarantine to extracted members — the matching UUID across `payload.zip`, `setup`, and `readme.md` is the canonical fingerprint of post-extraction quarantine inheritance.",
          "- `spctl --type execute` rejects unsigned executables.",
          "",
          "**Not proven:**",
          "",
          "- *Slack is malicious because no quarantine xattr* — quarantine xattrs are stripped by some copy operations and by Slack's own install path (DMG-installed apps often have the xattr removed by the installer after Gatekeeper consent). Absence is not proof of bypass. The `spctl` assessment confirms Slack is **Notarized Developer ID** signed by Slack Technologies (team `BQR82RBBHL`).",
          "- *readme.md would be rejected* — `spctl --type execute` is for executable content. A text file would either return an unrelated assessment error (no executable structure) or be accepted as a non-executable. Don't infer behaviour outside the actual assessment.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "An auditor asks: *was Chrome the browser that downloaded `payload.zip`, or could a different app have written that xattr to mimic Chrome?*",
        options: [
          {
            id: "chrome-only",
            label:
              "Only Chrome could have written that xattr; the `com.google.Chrome` agent string is signed and validated by `LSQuarantine` against the bundle's code-signing identity, so any non-Chrome process attempting to write `com.apple.quarantine` with that agent string would be rejected by the OS.",
          },
          {
            id: "any-app-can-write",
            label:
              "Any process running as the user can write arbitrary content to `com.apple.quarantine` and `kMDItemWhereFroms`; `LSQuarantine` records the agent string the app provides, with no signature validation. Chrome is by far the most likely culprit, but corroboration (Chrome history, on-disk Downloads metadata) is needed for high confidence.",
          },
          {
            id: "only-lsquarantine-aware-apps",
            label:
              "Only apps registered with `LSQuarantine` (Apple-maintained allowlist of browsers, mail clients, AirDrop) can write the quarantine xattr; the OS rejects writes from non-allowlisted apps and so the agent string is reliable evidence of which app downloaded the file.",
          },
          {
            id: "kmd-cannot-be-forged",
            label:
              "`kMDItemWhereFroms` cannot be forged because it's set by Spotlight from in-memory download state, not by the app; the URL there is authoritative provenance even if the agent string is unreliable.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["any-app-can-write"],
          allowMultiple: false,
        },
        debriefMd:
          "`com.apple.quarantine` is just an extended attribute; any process with write access to the file can set it, with any agent string. The convention is that LSQuarantine-aware apps populate it correctly, but the OS does NOT validate the agent string against the writing process's code signature. `kMDItemWhereFroms` is also app-provided, not OS-extracted. The defensible reading is \"xattr says Chrome at 08:31:24Z; corroborate with Chrome's `History` SQLite DB and the on-disk `Downloads/` records before promoting to certainty.\"",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best harden the **provenance** of `payload.zip`?",
        options: [
          { id: "chrome-history", label: "Chrome's `History` and `Downloads` SQLite tables for `carla`'s profile." },
          { id: "tls-sni-pcap", label: "Network capture / DNS / TLS-SNI from `carla`'s endpoint for the 08:31 UTC-08:31 window showing connections to `cdn.example.net`." },
          { id: "lsquarantine-tail", label: "Other recent `QuarantineEventsV2` rows around the same time (sibling downloads can confirm the source app's session behaviour)." },
          { id: "etc-passwd", label: "`/etc/passwd` (lists local accounts but has no bearing on download provenance)." },
          { id: "kernel-version", label: "`uname -a` output (irrelevant to download provenance)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["chrome-history", "tls-sni-pcap", "lsquarantine-tail"],
          allowMultiple: true,
        },
        debriefMd: [
          "Chrome's own SQLite tables are the authoritative app-side record. Network captures independently confirm the download event. Adjacent QuarantineEvents rows give surrounding context.",
          "",
          "`/etc/passwd` and `uname -a` are unrelated to download provenance.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `payload.zip` was **executed** (run, opened past Gatekeeper, etc.) on this host, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The quarantine flag's leading byte is `0x01` — quarantined, not yet opened past consent. The `setup` binary was extracted but `spctl` rejects it. Nothing in the artifacts shows the user clicked through the Gatekeeper consent dialog or that a quarantine-aware open completed. Reserve confidence 4–5 for after seeing unified-log Gatekeeper consent prompts and the corresponding execve trace.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact reconciliation ────────────
  {
    slug: "macos-spotlight-recents-ds-store-001",
    title: "macOS Recents: Spotlight Metadata, .DS_Store, and the Finder Sidebar",
    summary:
      "Recents lives in three places at once: Spotlight metadata, per-folder `.DS_Store`, and the per-user Recent Items plist. Read them together and notice when they disagree.",
    skillAreas: [
      "df_artifacts",
      "macos_artifacts",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "macos",
      "macos_artifacts",
      "df_artifacts",
      "inference_discipline",
    ],
    lane: "macos_forensics",
    module: "macOS host triage",
    sequence: 6,
    brief: `
# Brief

A leaving-soon contractor (\`p.singh\`) was observed by a peer
opening files on \`mbp-04\` from outside her project. Her
account has since been disabled; the laptop was imaged. Your
job is to read the three macOS \"recent files\" surfaces and
tell what the host actually knows about file access — without
treating any one surface as authoritative.

## Where macOS knows what was \"recent\"

- **Spotlight metadata** (\`mdls <file>\`) — every file's
  per-attribute Spotlight record, including
  \`kMDItemLastUsedDate\`, \`kMDItemUsedDates\` (recent
  open dates), \`kMDItemUseCount\`, and
  \`kMDItemFSCreationDate\`.
- **\`.DS_Store\`** — one file per directory the Finder has
  visited. Stores per-directory Finder view state, custom
  icon positions, and (informally) which files Finder has
  shown to the user. Created on Finder browse, not on
  programmatic access.
- **Recent Items / sfltool sources** —
  \`~/Library/Application Support/com.apple.sharedfilelist/\`
  holds binary plists keyed by category
  (\`RecentDocuments.sfl3\`, \`RecentHosts.sfl3\`, etc.)
  used by the menu-bar \`Recent Items\` and the per-app
  \"Open Recent\" submenu.

## Common traps

- **\`mdls\` reads the index, not the inode.** Stopping
  \`mds_stores\` then deleting a file's index entry hides
  it from \`mdfind\` but leaves the inode. Conversely, a
  re-indexed disk can have entries for files that no
  longer exist (briefly).
- **\`kMDItemUsedDates\` is updated by app-side calls to
  \`MDItemSetAttribute\`.** Many CLI tools / scripts open
  files without populating it. Absence of recent dates
  does NOT prove no access.
- **\`.DS_Store\` reflects Finder view, not file open.**
  Browsing a folder in Finder writes/touches \`.DS_Store\`,
  even if no file inside was opened. A modified
  \`.DS_Store\` is *evidence the directory was browsed*,
  not that any specific file inside it was opened.
- **Recent Items plists are per-app.** Each app's
  \"Open Recent\" submenu writes to its own \`.sfl3\`. A
  cleared menu doesn't propagate; corrupting one plist
  doesn't affect others.
- **\`sfltool resetbtm\` clears Login Items, not Recents.**
  Distinct tools, distinct stores.

## Artifacts

- **mdls-files.txt** — \`mdls\` output for two files of
  interest plus a control file.
- **ds-store-dump.txt** — parsed records from
  \`/Users/p.singh/Desktop/projects-other/.DS_Store\`.
- **recent-documents-sfl3.txt** — parsed
  \`com.apple.sharedfilelist/com.apple.LSSharedFileList.RecentDocuments.sfl3\`.
- **per-app-recents.txt** — parsed
  \`com.apple.recentitems.Quartz.PreviewApp.sfl3\` and
  \`com.apple.recentitems.com.microsoft.Excel.sfl3\`.
- **host-context.json** — macOS build, user, Spotlight
  index status.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "mdls-files.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# mdls /Users/p.singh/Desktop/projects-other/budget-q3-2026.xlsx",
            "kMDItemContentType            = \"org.openxmlformats.spreadsheetml.sheet\"",
            "kMDItemFSCreationDate         = 2026-09-22 14:00:00 +0000",
            "kMDItemFSContentChangeDate    = 2026-09-22 14:00:00 +0000",
            "kMDItemLastUsedDate           = 2026-10-13 02:18:11 +0000",
            "kMDItemUseCount               = 3",
            "kMDItemUsedDates              = (2026-09-22 14:01, 2026-10-11 22:09, 2026-10-13 02:18)",
            "kMDItemWhereFroms             = (\"https://drive.example.net/p/abc\")",
            "",
            "# mdls /Users/p.singh/Desktop/projects-other/personnel-list.pdf",
            "kMDItemContentType            = \"com.adobe.pdf\"",
            "kMDItemFSCreationDate         = 2026-06-01 09:00:00 +0000",
            "kMDItemFSContentChangeDate    = 2026-06-01 09:00:00 +0000",
            "kMDItemLastUsedDate           = (null)",
            "kMDItemUseCount               = (null)",
            "kMDItemUsedDates              = (null)",
            "",
            "# mdls /Users/p.singh/Documents/projects-mine/status-week-41.docx (control file)",
            "kMDItemContentType            = \"org.openxmlformats.wordprocessingml.document\"",
            "kMDItemFSCreationDate         = 2026-10-08 12:00:00 +0000",
            "kMDItemLastUsedDate           = 2026-10-13 14:55:18 +0000",
            "kMDItemUseCount               = 8",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "ds-store-dump.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# Parsed records from /Users/p.singh/Desktop/projects-other/.DS_Store",
            "# (Finder browse state — one entry per item shown in the folder.)",
            "directory_mtime: 2026-10-13 02:17:43 +0000",
            "entries:",
            "  - budget-q3-2026.xlsx (Iloc 56,82)",
            "  - personnel-list.pdf  (Iloc 200,82)",
            "  - leavers-q4-2026.csv (Iloc 344,82)",
            "  - .meta (custom view options: kind=icon, iconSize=72)",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "recent-documents-sfl3.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# Parsed ~/Library/Application Support/com.apple.sharedfilelist/com.apple.LSSharedFileList.RecentDocuments.sfl3",
            "schema: SFLListVersion=3",
            "items:",
            "  - path=/Users/p.singh/Documents/projects-mine/status-week-41.docx, lastUsed=2026-10-13 14:55:18 +0000",
            "  - path=/Users/p.singh/Desktop/projects-other/budget-q3-2026.xlsx, lastUsed=2026-10-13 02:18:11 +0000",
            "  - path=/Users/p.singh/Documents/projects-mine/status-week-40.docx, lastUsed=2026-10-06 14:11:00 +0000",
            "  - path=/Users/p.singh/Documents/projects-mine/status-week-39.docx, lastUsed=2026-09-29 14:01:42 +0000",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "per-app-recents.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# Parsed ~/Library/Application Support/com.apple.sharedfilelist/com.apple.recentitems.Quartz.PreviewApp.sfl3",
            "items:",
            "  - path=/Users/p.singh/Desktop/projects-other/personnel-list.pdf, lastUsed=2026-10-13 02:21:55 +0000",
            "",
            "# Parsed ~/Library/Application Support/com.apple.sharedfilelist/com.apple.recentitems.com.microsoft.Excel.sfl3",
            "items:",
            "  - path=/Users/p.singh/Desktop/projects-other/budget-q3-2026.xlsx, lastUsed=2026-10-13 02:18:11 +0000",
            "  - path=/Users/p.singh/Desktop/projects-other/leavers-q4-2026.csv, lastUsed=2026-10-13 02:25:30 +0000",
          ].join("\n") + "\n",
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
              host: "mbp-04",
              os: "macOS 14.6 (Sonoma) build 23G80",
              timezone: "America/Los_Angeles (PDT, -0700)",
              acquired_utc: "2026-10-14T16:00:00Z",
              user: { username: "p.singh", uid: 502, role: "contractor (account now disabled)" },
              spotlight: {
                indexed: true,
                last_full_reindex_utc: "2026-09-15T03:00:00Z",
                excluded_paths: [],
              },
              note: "All three Recents surfaces are present and current. personnel-list.pdf is in .DS_Store and in Preview's RecentDocuments.sfl3 but its mdls record has null kMDItemLastUsedDate — a classic surface-disagreement case.",
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
          "From the three Recents surfaces + the control file, which statements about **what `p.singh` opened** are **proven**?",
        options: [
          {
            id: "budget-opened-three",
            label:
              "`budget-q3-2026.xlsx` was opened at least three times — `kMDItemUseCount=3`, three `kMDItemUsedDates` entries, and matching `lastUsed=2026-10-13 02:18:11Z` in both the system Recents list and Excel's per-app recents.",
          },
          {
            id: "leavers-opened-by-excel",
            label:
              "`leavers-q4-2026.csv` was opened by Microsoft Excel at 2026-10-13 02:25:30Z — the Excel per-app `.sfl3` records the open and Excel writes that store on every open.",
          },
          {
            id: "personnel-opened-by-preview",
            label:
              "`personnel-list.pdf` was opened by Preview at 2026-10-13 02:21:55Z — Preview's per-app `.sfl3` records the open, and Preview is one of the apps that always writes to its own RecentDocuments store.",
          },
          {
            id: "personnel-never-opened",
            label:
              "`personnel-list.pdf` was never opened — its `mdls` record shows `kMDItemLastUsedDate=(null)` and `kMDItemUseCount=(null)`, which is the canonical fingerprint of an unopened file in the Spotlight index.",
          },
          {
            id: "projects-other-browsed",
            label:
              "`p.singh` **browsed** `~/Desktop/projects-other/` in Finder — the directory has a `.DS_Store` with view-state entries for three files, and the directory mtime sits inside the suspect window.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["budget-opened-three", "leavers-opened-by-excel", "personnel-opened-by-preview", "projects-other-browsed"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- `budget-q3-2026.xlsx`: three Recents surfaces agree (mdls, system Recents, Excel per-app).",
          "- `leavers-q4-2026.csv`: Excel per-app `.sfl3` records the open.",
          "- `personnel-list.pdf`: Preview per-app `.sfl3` records the open. **The mdls null is the trap.** `kMDItemLastUsedDate` is updated by apps that call `MDItemSetAttribute`; not every app does, and Preview specifically can fail to update it under certain conditions (e.g., opened via a Finder quicklook + open, opened from a `file://` URL handler, etc.). Two of three surfaces saying \"opened\" beats one saying \"null\".",
          "- `.DS_Store` confirms the folder was browsed in Finder.",
          "",
          "**Not proven:**",
          "",
          "- *Never opened* — that's the misread. mdls null isn't proof of non-open; the per-app `.sfl3` is the authoritative app-side record for Preview's opens.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "An auditor asks: *did `p.singh` actually look at the contents of `personnel-list.pdf`, or did she just see the filename in Finder?* What's the best defensible answer from these artifacts?",
        options: [
          {
            id: "just-browsed",
            label:
              "Only that she browsed the folder — `.DS_Store` proves Finder view, and `mdls` lists `kMDItemLastUsedDate=(null)`, which together rule out an actual open and confine the finding to filename-only visibility.",
          },
          {
            id: "opened-via-preview",
            label:
              "She opened it in Preview at 2026-10-13 02:21:55Z; Preview's RecentDocuments `.sfl3` records the open, which is an app-side commit that's not subject to the Spotlight-index update path's failure modes.",
          },
          {
            id: "indeterminate-need-quicklook",
            label:
              "Indeterminate — the surfaces disagree, and only a unified-log `QuickLook` event would settle whether the user actually rendered the file's contents. Without that, no defensible reading is possible from these artifacts.",
          },
          {
            id: "spotlight-authoritative",
            label:
              "`mdls`/Spotlight is the authoritative system record; per-app `.sfl3` files are app-controlled hints. The `null` `kMDItemLastUsedDate` overrides Preview's claim, and the disciplined reading is \"no open recorded by the system.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["opened-via-preview"],
          allowMultiple: false,
        },
        debriefMd:
          "Preview's per-app RecentDocuments store is the app-side commit of an open and is the most reliable signal here — Preview only writes that entry on an actual open, not on a hover or a QuickLook preview. Spotlight's `kMDItemLastUsedDate` depends on the app calling `MDItemSetAttribute` and is not authoritative. The disciplined reading promotes the per-app store over the index.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best confirm the **scope** of `p.singh`'s file access during the 02:15–02:30 PDT window?",
        options: [
          { id: "unified-log-quicklook", label: "Unified-log `com.apple.QuickLookUIService` and `com.apple.LaunchServices` open events for the window." },
          { id: "fseventsd", label: "FSEvents records under `/Users/p.singh/Desktop/projects-other/` for the window." },
          { id: "endpoint-security", label: "Endpoint Security `ES_EVENT_TYPE_NOTIFY_OPEN` events captured by the deployed EDR." },
          { id: "tcc-fda", label: "TCC `kTCCServiceSystemPolicyAllFiles` grants for apps active in the window (rules out / confirms which apps could read /Users/p.singh/.../)." },
          { id: "asl-flat", label: "Legacy ASL flat logs (`/var/log/asl/*.asl`) — deprecated, sparse on Sonoma, unlikely to add anything." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["unified-log-quicklook", "fseventsd", "endpoint-security", "tcc-fda"],
          allowMultiple: true,
        },
        debriefMd: [
          "Unified log + EndpointSecurity capture opens directly. FSEvents covers directory-level activity. TCC tells you which apps had the privilege to read.",
          "",
          "Legacy ASL is mostly empty on modern macOS.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `p.singh` knowingly exfiltrated `leavers-q4-2026.csv`, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The artifacts prove she opened the file in Excel and browsed the containing folder. They do NOT prove copy, attachment, upload, screenshot, or any export. \"Opened a file outside her project\" is the finding; \"exfiltrated\" is a different one that needs network / DLP / removable-media corroboration.",
      },
    ],
  },
];
