import type { Lane, SkillArea } from "@ci-train/contracts";

// Reference glossary. ~40 terms covering the most-asked-about
// artifacts across lanes. Each entry has a definition (markdown),
// optional related lanes, and skill-area tags so the glossary
// page can filter.
//
// Authoring guidance: 60-200 words per definition. Lead with
// "what it is in one sentence," then add the 1-2 key
// gotchas / inference traps. Avoid restating the lane intro --
// this is for term lookups, not lane overviews.
//
// IDs are lowercase-hyphenated slugs (e.g. "prefetch", "tcc-db").

export interface GlossaryTerm {
  id: string;
  term: string;
  aliases?: string[];
  // Markdown body. ReactMarkdown renders this on the glossary page.
  definition: string;
  lanes?: Lane[];
  skillAreas?: SkillArea[];
}

export const GLOSSARY: GlossaryTerm[] = [
  // ─── Windows artifacts ────────────────────────────────────────
  {
    id: "prefetch",
    term: "Prefetch",
    aliases: ["pf files", ".pf"],
    definition:
      "Windows execution-evidence artifact written by the OS to `C:\\Windows\\Prefetch\\<PROGRAM>-<HASH>.pf` after a program runs. Each `.pf` file records the program path, run-count, first-run timestamp, and last-run timestamp (with up to 8 prior runs on Win10+). Strong indicator that **the program ran**, but it doesn't carry user attribution — anyone who ran the binary on this host produced the same entry. Default Prefetch retention is ~128 entries; older entries get evicted. Disabled on server SKUs by default.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },
  {
    id: "amcache",
    term: "Amcache",
    aliases: ["amcache.hve"],
    definition:
      "Windows registry hive at `C:\\Windows\\AppCompat\\Programs\\Amcache.hve` recording **first-seen** execution data: program path, SHA-1 of the executable, file size, version metadata. Different from Prefetch in two important ways: it captures binaries that were *introduced* to the system (not necessarily run yet), and it's per-machine, not per-user. The first-seen timestamp can predate execution. Survives Prefetch eviction.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },
  {
    id: "bam",
    term: "BAM",
    aliases: ["background activity moderator"],
    definition:
      "Background Activity Moderator. Windows registry artifact recording **foreground execution** per user, per binary, with a last-executed timestamp. Lives under `HKLM\\SYSTEM\\CurrentControlSet\\Services\\bam\\State\\UserSettings\\<SID>`. The strongest per-user execution signal in modern Windows. Absence ≠ never-ran — BAM captures foreground only, so background services and scheduled tasks don't appear.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },
  {
    id: "userassist",
    term: "UserAssist",
    definition:
      "Per-user registry artifact under `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist` recording GUI-launched programs (Explorer-initiated). Captures: program path, run count, last-executed timestamp, focus-time. Strong per-user signal for **GUI** execution. Doesn't capture command-line-launched binaries or scheduled tasks. Values are ROT13-encoded on disk.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },
  {
    id: "lnk",
    term: "LNK file",
    aliases: ["shortcut", ".lnk"],
    definition:
      "Windows shell-link file recording metadata about a target file/folder the user has opened. Per-user (under `~\\AppData\\Roaming\\Microsoft\\Windows\\Recent\\`). Carries: target path, target volume serial, MAC times, and (often) network info. The 'where the user looked' trail. Auto-created by Explorer on file/folder access. Combined with Jumplists + Shellbags for a full file-access timeline.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },
  {
    id: "shellbags",
    term: "Shellbags",
    definition:
      "Registry artifact recording **folder browse history** per user, per shell view. Lives under `HKCU\\Software\\Microsoft\\Windows\\Shell\\BagMRU\\` and `Bags\\`. Captures folders the user navigated to in Explorer, including the per-folder display settings (sort order, view mode). Important: shellbags record **browse**, not **open**. A folder appearing in shellbags doesn't mean files inside it were opened — for that you need LNK / Recent / Jumplists.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },
  {
    id: "usbstor",
    term: "USBSTOR",
    definition:
      "Registry artifact under `HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USBSTOR` recording every USB mass-storage device that has been connected to the host. Captures vendor, product, and serial. **Per-host, not per-user** — USBSTOR doesn't name *who* connected the device. For user attribution, pair with Security log Event ID 4624 (logon) + Event ID 6416 (device-recognised) in the same window.",
    lanes: ["windows_artifacts", "removable_media_spillage"],
    skillAreas: ["windows_artifacts", "removable_media", "df_artifacts"],
  },
  {
    id: "srum",
    term: "SRUM",
    aliases: ["srudb.dat"],
    definition:
      "System Resource Usage Monitor. Database at `C:\\Windows\\System32\\sru\\SRUDB.dat` recording per-process, per-user network egress (bytes sent/received), CPU/disk usage, energy usage. One of the few host artifacts that captures **wire-bytes counts** attributed to a process and user. Updated roughly hourly. Particularly valuable in insider-risk cases for confirming exfil volume claims.",
    lanes: ["windows_artifacts", "insider_risk"],
    skillAreas: ["windows_artifacts", "network_logs", "df_artifacts"],
  },
  {
    id: "recall",
    term: "Recall",
    definition:
      "Windows 11 feature that takes periodic screenshots and OCRs them for later semantic search. Stored encrypted under `C:\\Users\\<user>\\AppData\\Local\\CoreAIPlatform.00\\*\\`. Forensically: each snapshot has a timestamp, foreground-app metadata, and OCRed text. Captures **screen contents**, not actions — a compose window showing a draft email does NOT prove the message was sent. Cold-acquisition requires BitLocker key + VBS key escrow.",
    lanes: ["windows_artifacts"],
    skillAreas: ["windows_artifacts", "df_artifacts"],
  },

  // ─── Linux artifacts ──────────────────────────────────────────
  {
    id: "wtmp",
    term: "wtmp / btmp",
    aliases: ["last", "lastb"],
    definition:
      "`/var/log/wtmp` records successful logins; `/var/log/btmp` records failures. Read with `last` and `lastb` respectively. Together with `/var/log/auth.log` (PAM + sshd) these are the canonical login-attribution artifacts on Linux. `wtmp` rotation is distribution-default — typically monthly — so older entries fall off.",
    lanes: ["linux_forensics"],
    skillAreas: ["linux_artifacts", "df_artifacts"],
  },
  {
    id: "bash-history",
    term: ".bash_history",
    aliases: ["zsh_history", "shell history"],
    definition:
      "Per-user shell command history at `~/.bash_history` (bash) or `~/.zsh_history` (zsh). Strong execution evidence but: (1) trivially editable by the user; (2) `HISTFILE=/dev/null` or `unset HISTFILE` suppresses recording entirely; (3) commands run with a leading space are excluded when `HISTCONTROL=ignorespace`. Treat as **lead, not verdict**, especially in incident response where the suspect had shell access.",
    lanes: ["linux_forensics"],
    skillAreas: ["linux_artifacts", "df_artifacts"],
  },
  {
    id: "systemd-units",
    term: "systemd units",
    aliases: ["systemd timers", "service files"],
    definition:
      "Modern Linux persistence surface. `.service` unit files under `/etc/systemd/system/` (admin), `/usr/lib/systemd/system/` (package), and `~/.config/systemd/user/` (per-user). `.timer` files schedule services on a calendar or interval. Triage with `systemctl list-units --type=service` and `systemctl list-timers`. Drop-in directories (`*.d/`) override unit fields — easy to miss without `systemctl cat`.",
    lanes: ["linux_forensics"],
    skillAreas: ["linux_artifacts", "df_artifacts"],
  },
  {
    id: "cron",
    term: "cron",
    definition:
      "Legacy Linux scheduler. Per-user crontabs live at `/var/spool/cron/crontabs/<user>` (read with `crontab -u <user> -l`). System crontab at `/etc/crontab`. Drop-in directory `/etc/cron.d/` carries package- or admin-installed jobs. `cron.hourly/daily/weekly/monthly` directories run via `run-parts`. Five different surfaces, all of which need to be checked — systemd timers cover the modern case but cron entries are still common as legacy persistence.",
    lanes: ["linux_forensics"],
    skillAreas: ["linux_artifacts", "df_artifacts"],
  },
  {
    id: "auditd",
    term: "auditd",
    definition:
      "Linux kernel auditing subsystem. When loaded with rules, captures syscall-level evidence: `execve()` (process creation), `connect()` (network), `open()` (file access), and many more. Logs to `/var/log/audit/audit.log`. The catch: **auditd only captures what the loaded ruleset covers**. A box with `auditctl -l` returning empty captures nothing despite the daemon running. Rare in default installs; valuable when an org has configured it.",
    lanes: ["linux_forensics"],
    skillAreas: ["linux_artifacts", "df_artifacts", "network_logs"],
  },
  {
    id: "authorized-keys",
    term: "authorized_keys",
    definition:
      "Per-user SSH key authorization at `~/.ssh/authorized_keys`. Each line grants login via the corresponding private key. Lateral-movement infrastructure: an attacker who lands on a Linux host frequently writes a key here so they can come back without the password / token they used originally. Match against the host's deployment automation — extra keys without matching config-management traces are the headline signal.",
    lanes: ["linux_forensics"],
    skillAreas: ["linux_artifacts", "account_compromise"],
  },

  // ─── macOS artifacts ──────────────────────────────────────────
  {
    id: "unified-log",
    term: "Unified Log",
    aliases: ["log show", "os_log"],
    definition:
      "Apple's canonical event-log substrate from Sierra (10.12) onward. Replaces ASL. Captures process, network, security, and app messages in a single stream. Read with `log show --predicate '...' --info --last 1h`. **Privacy redaction**: most string fields appear as `<private>` unless you have the right entitlements or the running process was launched with `OSLogLevelType` overrides. Comparable to Windows Event Log in scope; very different in usability out of the box.",
    lanes: ["macos_forensics"],
    skillAreas: ["macos_artifacts", "df_artifacts"],
  },
  {
    id: "tcc-db",
    term: "TCC database",
    aliases: ["tcc.db"],
    definition:
      "Transparency, Consent, Control. SQLite databases at `/Library/Application Support/com.apple.TCC/TCC.db` (system) and `~/Library/Application Support/com.apple.TCC/TCC.db` (per-user) recording which apps have been granted which sensitive permissions (camera, microphone, full-disk-access, screen recording, etc.). Powerful for attribution: 'this app could read these files because TCC.db says it was granted FDA on this date.' Read with `sqlite3 TCC.db 'select service, client, auth_value from access;'`.",
    lanes: ["macos_forensics"],
    skillAreas: ["macos_artifacts", "df_artifacts"],
  },
  {
    id: "launchd",
    term: "launchd",
    aliases: ["LaunchAgents", "LaunchDaemons"],
    definition:
      "macOS's PID-1 service manager. **LaunchAgents** run per-user from `/Library/LaunchAgents/`, `/System/Library/LaunchAgents/`, and `~/Library/LaunchAgents/`. **LaunchDaemons** run as root from `/Library/LaunchDaemons/` and `/System/Library/LaunchDaemons/`. Each is a plist file declaring the program path, arguments, and a trigger (RunAtLoad, KeepAlive, StartInterval, WatchPaths, etc.). The dominant macOS persistence surface. Inspect with `launchctl print gui/501/<label>` or `launchctl print system/<label>`.",
    lanes: ["macos_forensics"],
    skillAreas: ["macos_artifacts", "df_artifacts"],
  },
  {
    id: "fsevents",
    term: "FSEvents",
    definition:
      "macOS file-change notification system. Stores **directory-granular** change records under `/.fseventsd/` on each volume. Each record: path (to the parent directory), flags (Create / Modify / Renamed / etc.), and an event ID. Compared to Linux inotify (file-granular) or Windows USN journal (file-granular with full detail), FSEvents is coarser — the path is the directory, and the specific file inside isn't always recoverable. Use Sarah Edwards' `fseventsparser` for triage.",
    lanes: ["macos_forensics"],
    skillAreas: ["macos_artifacts", "df_artifacts"],
  },
  {
    id: "quarantine-xattr",
    term: "Quarantine xattr",
    aliases: ["com.apple.quarantine", "Gatekeeper"],
    definition:
      "macOS extended attribute `com.apple.quarantine` set by LSQuarantine-aware apps (browsers, mail clients, AirDrop) on downloaded files. Records: agent identifier (the downloading app), download URL, download timestamp. **The xattr is not signed or validated by the OS** — any process with write access to the file can write any agent string. Treat as a strong lead, corroborate against the app-side download record (Chrome `History` DB, Safari `Downloads.plist`).",
    lanes: ["macos_forensics"],
    skillAreas: ["macos_artifacts", "df_artifacts"],
  },
  {
    id: "endpoint-security",
    term: "Endpoint Security framework",
    aliases: ["es", "es framework"],
    definition:
      "Apple's userspace API for monitoring system events: process exec, file events, signal delivery, code-signing checks, etc. Used by modern macOS EDR vendors. Important gap: **no network event class**. EDRs that surface per-process network telemetry derive it from NetworkExtension content-filter hooks, not from ES.",
    lanes: ["macos_forensics"],
    skillAreas: ["macos_artifacts", "df_artifacts"],
  },

  // ─── Email / BEC ──────────────────────────────────────────────
  {
    id: "spf",
    term: "SPF",
    aliases: ["sender policy framework"],
    definition:
      "DNS-published list of mail servers authorised to send for a domain. Receiving MTAs check the SMTP `MAIL FROM` (envelope sender) against the sending IP's reverse DNS / DNS SPF record. Result categories: `pass`, `fail`, `softfail`, `neutral`, `none`, `permerror`, `temperror`. `pass` does **not** mean the visible `From:` header is legitimate — SPF authenticates the envelope sender, which can differ from the header `From`.",
    lanes: ["email_bec"],
    skillAreas: ["email_headers", "bec"],
  },
  {
    id: "dkim",
    term: "DKIM",
    aliases: ["domainkeys identified mail"],
    definition:
      "Cryptographic signature on the message body + selected headers, verified against a DNS-published public key. Result categories: `pass`, `fail`, `none`, `policy`, `permerror`, `temperror`. A `pass` proves the message was signed by infrastructure that holds the private key for the claimed domain. Doesn't authenticate the `From:` header itself; for that you need DMARC alignment.",
    lanes: ["email_bec"],
    skillAreas: ["email_headers", "bec"],
  },
  {
    id: "dmarc",
    term: "DMARC",
    definition:
      "DNS-published policy that ties SPF and DKIM results to the visible `From:` header. Verdict considers SPF alignment (envelope domain matches From domain) and DKIM alignment (signing domain matches From domain). A `dmarc=pass` is the receiving MTA's verdict that 'the message really came from the domain it claims.' A `pass` doesn't authenticate the *user* or rule out account compromise; it just rules out external spoofing.",
    lanes: ["email_bec"],
    skillAreas: ["email_headers", "bec"],
  },
  {
    id: "reply-to-mismatch",
    term: "Reply-To mismatch",
    definition:
      "When the `From:` header and `Reply-To:` header carry different domains, replies will land at the Reply-To address rather than the visible sender. Combined with auth-pass, this is the canonical BEC signature: the message really came from the claimed sender's infrastructure (so DMARC passes), but replies are diverted to attacker-controlled mail. Distinguishes account compromise from external spoofing.",
    lanes: ["email_bec"],
    skillAreas: ["email_headers", "bec"],
  },
  {
    id: "lookalike-domain",
    term: "Lookalike domain",
    aliases: ["typosquat", "homoglyph"],
    definition:
      "A domain registered to visually resemble a legitimate one — character substitution (`rn` for `m`, `0` for `o`), TLD swap (`.com` → `.co`), or full homoglyph attacks using Unicode characters. Combined with display-name spoofing (the visible name says the real exec, the address is the lookalike), forms the substrate of most BEC vendor-redirect and CEO-fraud cases.",
    lanes: ["email_bec"],
    skillAreas: ["email_headers", "bec"],
  },

  // ─── Network / Malware ────────────────────────────────────────
  {
    id: "netflow",
    term: "NetFlow",
    aliases: ["ipfix"],
    definition:
      "Network-flow telemetry: per-connection 5-tuple (src/dst IP, src/dst port, protocol) with byte counts, packet counts, durations, and timestamps. **No payload**. Originated as Cisco NetFlow; IPFIX is the IETF-standardised successor. Used to answer who-talked-to-whom over time; useless for content claims. Sampled at high traffic volumes (1-in-N), which means low-volume flows can be missed.",
    lanes: ["network_logs"],
    skillAreas: ["network_logs"],
  },
  {
    id: "ja3",
    term: "JA3 / JA4",
    definition:
      "TLS client fingerprinting based on hashable handshake parameters (cipher suites offered, extensions, supported groups, etc.). JA3 is the original (Salesforce, 2017); JA4 is the FoxIO successor (2023) with better stability across TLS 1.3 negotiations. Lets you fingerprint TLS clients without breaking the encryption — useful for clustering related campaigns by their TLS stack and for identifying tooling (Cobalt Strike, custom Go clients, etc.).",
    lanes: ["network_logs", "malware_analysis"],
    skillAreas: ["network_logs", "malware_analysis"],
  },
  {
    id: "beacon",
    term: "Beacon",
    definition:
      "A small, periodic outbound connection from a host to a control server, used by C2 frameworks. Textbook shape: regular interval (often jittered), small uniform payload, repeated destination. **Beacon-shape is necessary for C2, not sufficient** — legitimate SaaS heartbeats look identical. Vendor confirmation (signed binary, registered domain, published cert chain) closes the gap between 'shape' and 'verdict.'",
    lanes: ["network_logs"],
    skillAreas: ["network_logs"],
  },
  {
    id: "imphash",
    term: "imphash",
    definition:
      "Hash of the imported-functions table from a PE binary's Import Address Table. Identical imphash across two samples means they import the same Windows APIs in the same order — strong but imperfect family-clustering signal. Collisions across unrelated packers exist; treat as a lead.",
    lanes: ["malware_analysis"],
    skillAreas: ["malware_analysis", "df_artifacts"],
  },
  {
    id: "yara",
    term: "YARA",
    definition:
      "Pattern-matching language for malware classification. Rules describe byte sequences, string patterns, PE characteristics, and metadata. Curated rule sets (e.g., the ones from Florian Roth) are the field's default for triage. The two recurring traps: over-broad rules that fire on benign files (false positives), and over-narrow rules that miss obfuscated variants.",
    lanes: ["malware_analysis"],
    skillAreas: ["malware_analysis", "df_artifacts"],
  },
  {
    id: "ssdeep",
    term: "ssdeep / TLSH",
    definition:
      "Fuzzy hash functions used for clustering similar files. **ssdeep** is the original (context-triggered piecewise hashing). **TLSH** (Trend Micro's Locality-Sensitive Hash) is the modern successor, more robust to small modifications. Two files with high ssdeep / TLSH similarity score are 'probably related variants of the same family.'",
    lanes: ["malware_analysis"],
    skillAreas: ["malware_analysis"],
  },
  {
    id: "malfind",
    term: "malfind",
    definition:
      "Volatility 3 plugin that scans process memory for regions with anomalous protection bits (RWX — read, write, execute) and patterns matching injected-code signatures. Reports the process, region size, leading bytes, and a quick disassembly. **A malfind hit is a lead, not a verdict** — some JIT compilers, anti-cheat engines, and security products legitimately allocate RWX. Confirm by dumping and analysing the region.",
    lanes: ["memory_forensics"],
    skillAreas: ["windows_artifacts", "malware_analysis"],
  },
  {
    id: "netscan",
    term: "netscan",
    definition:
      "Volatility 3 plugin that enumerates active network sockets from a memory image. Output: process ID, local/remote address+port, socket state. **Captures existence and state, not payload** — ESTABLISHED means the TCP handshake completed; says nothing about bytes transferred. For data-movement claims you need a packet capture from the same window.",
    lanes: ["memory_forensics"],
    skillAreas: ["network_logs", "windows_artifacts"],
  },
  {
    id: "pstree",
    term: "pstree",
    definition:
      "Volatility 3 plugin that renders the process tree from a memory image. Anomalies in the tree are the headline signal: `cmd.exe` parented by `winword.exe`, `powershell.exe` from `outlook.exe`, etc. — patterns inconsistent with normal user activity. Pair with the binary on disk (does the path look right?) and the command line (`cmdline` plugin) to triage.",
    lanes: ["memory_forensics"],
    skillAreas: ["windows_artifacts"],
  },

  // ─── Anti-Forensics ───────────────────────────────────────────
  {
    id: "timestomping",
    term: "Timestomping",
    definition:
      "Attacker technique that rewrites a file's timestamps to hide when it really arrived on the host. On NTFS, attackers typically target `$STANDARD_INFORMATION` (rewritable from userland via `SetFileTime()`) but cannot easily reach `$FILE_NAME` (kernel-driven). The detection workhorse is the `$SI` vs `$FN` comparison: when `$SI Created` is older than `$FN Created`, the `$SI` set was backdated. **A `$SI`/`$FN` disagreement isn't always timestomping** — normal in-place edits produce a similar disagreement on the Modified field.",
    lanes: ["anti_forensics"],
    skillAreas: ["anti_forensics", "windows_artifacts"],
  },
  {
    id: "mft",
    term: "MFT",
    aliases: ["master file table"],
    definition:
      "Master File Table. The NTFS metadata structure that records every file and directory on a volume, one entry per file/directory. Each entry has multiple attributes (`$STANDARD_INFORMATION`, `$FILE_NAME`, `$DATA`, etc.). The MFT is the substrate for almost every NTFS forensic technique. Extract with Eric Zimmerman's MFTECmd or analyzeMFT.",
    lanes: ["windows_artifacts", "anti_forensics"],
    skillAreas: ["anti_forensics", "windows_artifacts", "df_artifacts"],
  },
  {
    id: "standard-info-vs-file-name",
    term: "$STANDARD_INFORMATION vs $FILE_NAME",
    aliases: ["$SI vs $FN", "si fn"],
    definition:
      "Two NTFS MFT attributes that each carry timestamp sets. **$STANDARD_INFORMATION** ($SI) is what Explorer shows and what userland APIs (`SetFileTime()`) can update — the timestamps attackers typically rewrite when timestomping. **$FILE_NAME** ($FN) is updated only by the NTFS kernel during create / rename operations and isn't reachable from the documented userland API. The discrepancy between them is the canonical timestomping detection signal.",
    lanes: ["anti_forensics", "windows_artifacts"],
    skillAreas: ["anti_forensics", "windows_artifacts"],
  },
  {
    id: "usn-journal",
    term: "USN Journal",
    aliases: ["$UsnJrnl", "change journal"],
    definition:
      "NTFS Update Sequence Number journal. Records filesystem change events — file creates, deletes, renames, security changes — independent of any user-space audit configuration. Lives at `\\$Extend\\$UsnJrnl` and is read with `fsutil usn` or Eric Zimmerman's MFTECmd `-csv` mode. Frequently targeted by anti-forensic tooling that wants to erase recent activity; an unexpectedly small or recently-reset journal IS the case.",
    lanes: ["anti_forensics", "windows_artifacts"],
    skillAreas: ["anti_forensics", "windows_artifacts"],
  },
  {
    id: "event-1102",
    term: "Event ID 1102",
    aliases: ["event 1102", "audit log cleared"],
    definition:
      "Windows Security-log event recording that the Security log itself was cleared. Generated by `wevtutil cl Security` or the equivalent Event Viewer right-click. The event preserves the clearing process, the operator's SID, and the timestamp — so the **fact of the clear** survives even though the prior events are destroyed. Event 104 in the System channel is the equivalent for other channels.",
    lanes: ["anti_forensics", "windows_artifacts"],
    skillAreas: ["anti_forensics", "windows_artifacts"],
  },
  {
    id: "lolbin",
    term: "LOLBIN",
    aliases: ["lolbas", "living off the land binary"],
    definition:
      "Living-off-the-Land Binary. A signed Microsoft executable used for an operation it wasn't designed for — `bitsadmin.exe` for downloads, `certutil.exe` for downloads or base64 decoding, `mshta.exe` for arbitrary HTML application execution, `rundll32.exe` for DLL invocation, `regsvr32.exe` for COM-script execution. Read the command line, not the binary name. The LOLBAS Project (lolbas-project.github.io) maintains a curated registry.",
    lanes: ["anti_forensics", "malware_analysis"],
    skillAreas: ["anti_forensics", "windows_artifacts", "malware_analysis"],
  },
  {
    id: "ads",
    term: "ADS",
    aliases: ["alternate data streams", "alternate data stream"],
    definition:
      "NTFS Alternate Data Streams. A feature letting a file carry multiple named content streams (e.g. `file.txt:hidden.exe`). The unnamed stream is what Explorer shows; named streams are invisible to standard tools but visible to `dir /R`, PowerShell `Get-Item -Stream`, and Sysinternals `streams.exe`. Used by attackers to hide payloads inside ordinary-looking files; the `Zone.Identifier` Mark-of-the-Web is a benign ADS that's been around for decades.",
    lanes: ["anti_forensics", "windows_artifacts"],
    skillAreas: ["anti_forensics", "windows_artifacts"],
  },
  {
    id: "wec",
    term: "WEC",
    aliases: ["windows event collector", "event forwarding"],
    definition:
      "Windows Event Collector. The built-in mechanism for forwarding event-log records from individual hosts to a central collector via WinRM. Records that have already been forwarded before a host-side `wevtutil cl` survive the clear — the collector's copy is intact. The cheapest practical defense against Event Log clearing as an anti-forensic technique. Pair with SIEM ingest for retention.",
    lanes: ["anti_forensics", "windows_artifacts"],
    skillAreas: ["anti_forensics", "windows_artifacts"],
  },

  // ─── Mobile ───────────────────────────────────────────────────
  {
    id: "afu-bfu",
    term: "AFU / BFU",
    definition:
      "Acquisition states for iOS / Android devices. **AFU** (After First Unlock) — the device has been unlocked at least once since boot, so user data encryption keys are in memory and almost all content is decryptable by tools. **BFU** (Before First Unlock) — the device hasn't been unlocked since boot; most content is encrypted at rest, and only a small set of biographical artifacts is recoverable. Always document which state a phone was in at acquisition.",
    lanes: ["mobile_forensics"],
    skillAreas: ["df_artifacts"],
  },
  {
    id: "graykey",
    term: "GrayKey",
    definition:
      "Mobile-extraction hardware (Grayshift) commonly used for iOS acquisitions. Performs full-file-system extracts when the device is in AFU state. Increasingly limited as Apple ships pre-boot encryption changes. Treat output the same as any other tool's: hash-verified image, documented extraction state, and per-app SQLite databases parsed downstream by AXIOM or Cellebrite.",
    lanes: ["mobile_forensics"],
    skillAreas: ["df_artifacts"],
  },

  // ─── Discipline / Process ─────────────────────────────────────
  {
    id: "chain-of-custody",
    term: "Chain of custody",
    definition:
      "Documented record of every person who has had custody of an evidence item, every transfer between custodians, and every sealed-container break (with the reason). In DoD context the standard form is DA 4137. Chain breaks happen when a seal is cut and the reseal is unattributed (no initials, no date, no purpose) — **the cut itself isn't the break, the silent reseal is**.",
    lanes: ["evidence_handling"],
    skillAreas: ["report_writing", "df_artifacts"],
  },
  {
    id: "mfr",
    term: "MFR",
    aliases: ["memorandum for record"],
    definition:
      "Memorandum For Record. The narrative format for documenting any deviation from the standard chain of custody — re-inspection breaks, custody transfers without standard form, etc. Attached to the evidence document. Restores the auditability that the deviation broke. 'Destroy and restart' is not a valid response to a paperwork gap; an MFR documenting what happened is.",
    lanes: ["evidence_handling"],
    skillAreas: ["report_writing"],
  },
  {
    id: "calibration",
    term: "Calibration",
    definition:
      "In CDTI writeup discipline: stating a finding at the confidence level the evidence actually supports — no more, no less. A calibrated finding names what was observed, names what it doesn't establish, and stops at the smallest defensible claim. The confidence-question scoring on this platform measures this directly: your stated confidence is 'right' iff it lands inside the question's expected range.",
    lanes: ["report_writing"],
    skillAreas: ["report_writing", "inference_discipline"],
  },
];

// Index for O(1) lookups by id.
export const GLOSSARY_BY_ID: Record<string, GlossaryTerm> = Object.fromEntries(
  GLOSSARY.map((t) => [t.id, t]),
);
