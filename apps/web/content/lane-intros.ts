import type { Lane } from "@ci-train/contracts";

// Lane orientation / "what to expect" pages. Rendered at the top of
// each /scenarios/lanes/<slug> page. Plain markdown strings keyed by
// Lane enum value so the lane page can look up one in O(1).
//
// Authoring guidance: 350-550 words. Same shape across lanes:
//   1. One-sentence framing
//   2. "What you'll see" -- artifacts/tools/concepts in this lane
//   3. "What's hard" -- the discipline + common cognitive errors
//   4. (For the OS / "obscure" lanes) "Coming from Windows..." -- a
//      grounding paragraph for analysts who started on Windows
//   5. "Where to read more" -- 3-5 references the curious can chase
//
// foundations and ojt_bridge don't have intros yet; they're the
// on-ramp lanes and don't need front-loaded orientation.

export const LANE_INTROS: Partial<Record<Lane, string>> = {
  email_bec: `
# Email Headers & BEC

Business Email Compromise — vendor redirect, CEO fraud, payroll
diversion — is one of the most common cases a CDTI sees. The
mechanic is almost always the same: an attacker either hijacks a
real mailbox or registers a lookalike domain, then sends a request
the recipient is primed to act on. The forensic question is rarely
"what malware did this" — it's "is this email what it claims to
be, and what does the wire actually say?"

## What you'll see

- **Authentication-Results headers** — SPF, DKIM, and DMARC verdicts
  from the receiving mail server. The trio that tells you whether
  the message really came from the domain it claims.
- **Reply-To / Return-Path divergence** — the workhorse signal. The
  visible \`From\` lies; \`Reply-To\` is where replies actually go.
- **Lookalike domains** — \`vendor-corp.com\` vs \`vendor.corp-co.net\`.
  Easy to spot when you're looking for it, easy to miss otherwise.
- **Message-IDs, hop traces, quoted-printable encodings** — the
  slow careful reading that distinguishes "looks fine" from "is
  actually fine."

## What's hard

The wire usually has the answer; the trick is reading it carefully
without overclaiming. **\`auth-pass\` does not mean "the sender is
who they say they are"** — it means "the message really originated
from infrastructure the claimed domain authorised." Account
compromise looks identical to legitimate use at this layer. The
discipline this lane trains is: *what does this artifact prove, and
what does it leave open?*

The other recurring trap is over-indexing on social-engineering
markers (urgency, all-caps subject, gift-card asks). Those are
suggestive, not diagnostic — a junior writeup that leads with
"URGENT in the subject" instead of the auth-results table is doing
it backwards.

## Where to read more

- **RFC 5322** (Message Format) and **RFC 5321** (SMTP) for the
  on-the-wire structure
- **RFC 7208 / 6376 / 7489** — SPF, DKIM, DMARC respectively
- **M3AAWG sender best practices** — what "well-behaved" mail looks
  like, so you can recognise what doesn't
- Your unit's BEC reporting workflow — escalation routing matters
  when active wire fraud is in scope
`,

  windows_artifacts: `
# Windows Forensics

Most CDTI work happens on Windows hosts. This lane covers the
canonical execution / persistence / file-history artifacts you'll
reach for first, and the discipline of saying only what those
artifacts directly support.

## What you'll see

- **Prefetch** (\`C:\\Windows\\Prefetch\\*.pf\`) — execution evidence
  with timestamps and run counts. Strong, but not absolute, and not
  per-user.
- **Amcache** — first-seen execution data in the registry. Differs
  from Prefetch in subtle ways — first-seen ≠ last-run, and the
  difference matters.
- **BAM** (Background Activity Moderator) — per-user foreground
  execution records.
- **UserAssist** — registry artifact recording GUI-launched
  programs, per user.
- **LNK files, Jumplists, Shellbags** — file-open and folder-browse
  evidence. The "where the user looked" trail.
- **USBSTOR** — connected-device history. Per-host, not per-user;
  use security logs alongside to attribute.

## What's hard

Each Windows artifact has a specific scope — what it covers, what
it doesn't, when it gets evicted. The cognitive trap is *"I saw it
in [artifact] X, so the user did [action] Y"* — when actually X
only proves the program ran (not who ran it), or the folder was
browsed (not the file was opened), or the binary was first seen
(not most-recently executed).

This lane trains the reflex of asking *what's the smallest claim
this artifact actually supports?* The right writeup names the
artifact, the bounded claim, and the corroborating sources you
would pull to harden the finding. Hand-wavy "the user did X
because Y" is the canonical over-claim.

## Where to read more

- **SANS Windows Forensic Analysis poster** — the best one-page
  artifact reference
- **Eric Zimmerman's tool suite** (PECmd, MFTECmd, RECmd, AmcacheParser,
  LECmd) — each ships with format docs worth reading
- **Microsoft "Windows Internals"** (Russinovich et al.) — for the
  *why this artifact exists* context, which makes the *what it
  proves* questions easier
`,

  linux_forensics: `
# Linux Forensics

Linux hosts in a CI cyber AOR are usually servers — auth servers,
build agents, application backends, occasionally lab kit. The
artifacts are different from Windows, the failure modes are
different, and the discipline of "what does this prove" stays the
same.

## What you'll see

- **\`/var/log/auth.log\` and \`wtmp\` / \`btmp\`** — login attribution
  across PAM, sshd, and sudo. Often the highest-yield artifact set.
- **\`~/.bash_history\` / \`~/.zsh_history\`** — execution evidence,
  with all the caveats history files carry (deletion, rotation,
  HISTFILE games).
- **systemd unit files + timers** — modern persistence on Linux.
  Crontab still exists but systemd is where the recent activity
  lives.
- **\`/var/spool/cron\` + \`/etc/cron.d\`** — legacy persistence,
  still common.
- **auditd / auditctl logs** — syscall-level evidence when the unit
  is configured for it. Rare in the wild; valuable when present.
- **\`~/.ssh/authorized_keys\`** — lateral-movement infrastructure.
  An attacker who lands on a Linux host frequently leaves a key
  here.

## Coming from Windows

A few mental remappings:

- There's no Prefetch or Amcache analog. Execution evidence
  comes from auditd (if configured), shell history, or systemd
  journal — none as reliable as Prefetch on Windows.
- "Per-user" data lives under \`$HOME\` (\`.bash_history\`,
  \`.ssh/\`, \`.config/\`). There's no NTUSER.DAT registry hive;
  config is in dotfiles and the systemd \`user@\` services.
- File metadata is **mtime / ctime / atime** (Linux) vs MAC times
  (Windows). The semantics overlap but aren't identical — ctime
  on Linux is *inode metadata change*, not creation.
- Timestamps default to UTC in modern logs; on Windows they're
  often local-time. Watch the TZ field in any timeline.

## Where to read more

- **The Linux man pages** for \`last(1)\`, \`lastb(1)\`,
  \`journalctl(1)\`, \`auditctl(8)\` — primary sources
- **systemd.unit(5)** and **systemd.timer(5)** — for persistence
  reading
- **Red Hat / Ubuntu hardening guides** — give you the
  "what should be here" baseline you can diff against
- **The Linux Auditing System documentation** (kernel.org) — for
  when you actually have auditd
`,

  macos_forensics: `
# macOS Forensics

macOS shows up in CDTI work when an executive's laptop is in scope,
when a developer or analyst workstation is part of a case, or in
operational-security work around travel and TSCM. Apple's
artifact taxonomy is its own world — built on top of Unix but
gated by privacy frameworks (TCC), code-signing requirements
(Gatekeeper), and an aggressive unified-log redaction posture.

## What you'll see

- **Unified Log** (\`log show\`) — the canonical event log on
  modern macOS. Privacy-redacted by default: many string fields
  appear as \`<private>\` unless you have the right entitlements.
- **TCC** (Transparency, Consent, Control) — the \`TCC.db\` SQLite
  databases that gate what apps can read which user data.
  Powerful attribution surface when interpreted correctly.
- **Launch Agents / Launch Daemons** — \`launchd\` plist files in
  \`/Library/LaunchAgents/\`, \`/Library/LaunchDaemons/\`, and the
  per-user variants. macOS persistence usually lives here.
- **FSEvents** — directory-granular file change records.
  Different from Linux inotify or Windows USN journal in
  important ways.
- **Quarantine xattrs + Gatekeeper** — the \`com.apple.quarantine\`
  extended attribute records the download source. Gatekeeper
  decides what runs.
- **Recent items: Spotlight metadata, \`.DS_Store\`, app-specific
  RecentDocuments plists** — three places that should agree; when
  they don't, that's the case.

## Coming from Windows

- macOS is Unix underneath, with a lot of Apple-specific layers on
  top. Most artifacts of interest are in **Apple frameworks** (TCC,
  Quarantine, FSEvents), not in the underlying Unix layer.
- There's no Windows-style registry. App configuration lives in
  per-app plist files under \`~/Library/Preferences/\`.
- **Endpoint Security framework** is Apple's EDR substrate. It
  emits process and file events — but **not** network events.
  Most macOS EDR vendors hook NetworkExtension separately for
  network telemetry.
- **Recall** has no macOS equivalent. The closest thing is
  Spotlight's index, which is less invasive.
- Privacy redaction makes the unified log much less useful out of
  the box than Windows Event Log. You'll lean harder on app-side
  SQLite databases.

## Where to read more

- **Apple's "Apple Platform Security" guide** — comprehensive,
  authoritative
- **Sarah Edwards' macOS forensics work** (mac4n6.com) — the best
  single source on macOS artifacts
- **\`log show --help\`, \`launchctl print\`, \`fs_usage\`** —
  the tools you'll use most
- **TCC database structure** notes from the macOS Forensic
  Community — the table layout has changed across macOS versions
`,

  removable_media_spillage: `
# Removable Media & Spillage

Classified spillage and removable-media policy violations are
recurring CDTI cases — sometimes accidental, sometimes not. The
forensic surface is narrow but discipline-heavy: USBSTOR rows,
LNK / shellbag references, file-write evidence, and the chain-of-
custody on the physical device once it's recovered.

## What you'll see

- **USBSTOR registry data** — connected-device history per Windows
  host. Captures vendor, product, serial. Doesn't capture **who**
  connected the device (that's the security log's job).
- **LNK files + shellbags + Jumplists** — host-side references to
  files on the removable volume. The "what got opened" trail.
- **EDR / Sysmon FileCreate events** — the missing-link artifact
  for "files actually got written to the USB."
- **The device itself** — if recovered, the carved unallocated
  space is often where the case lives. Markings present in
  unallocated ≠ markings written by the user.

## What's hard

The two recurring traps:

1. **Conflating opportunity with action.** A USB was connected
   AND a sensitive file was opened on the workstation in the same
   window. That's opportunity. **Action** needs a file-write event
   targeting the USB volume, or LNK references on the USB itself.
   "Consistent with copy" is the disciplined writeup.
2. **Carved markings ≠ authored markings.** Carving recovers
   bytes from unallocated sectors. Those bytes can be there
   because the user wrote them, OR because the filesystem
   previously held a file with those bytes that's since been
   deleted, OR because the device shipped with them in some
   manufacturing artifact. Carving is enough to trigger the
   spillage workflow; it's rarely enough to write a finding about
   *who* placed the bytes.

## Where to read more

- **USBSTOR / SetupAPI** registry references on the SANS DFIR
  poster
- **Eric Zimmerman's LECmd, JLECmd, SBECmd** — and the format docs
  that come with each
- Your unit's spillage SOP — chain-of-custody and notification
  routing are case-determining and not in the artifacts
`,

  insider_risk: `
# Insider Risk

The hardest cases in CI cyber are the ones where the artifacts and
authorisation overlap — an account doing exactly what it's
permitted to do, in a pattern that suggests it shouldn't be.
Insider-risk work is about pattern, intent, and the discipline of
not overreaching from circumstantial evidence.

## What you'll see

- **File-access timelines** across host artifacts (LNK, Recent,
  Office MRUs) and server-side audit logs.
- **Working-hours patterns** — keycard data, VPN sessions, SaaS
  access logs. Late-night escalation isn't proof; it's a flag.
- **Share-link audits** in M365 / Google Workspace — the highest-
  yield artifact when bulk exfil is suspected.
- **SRUM** (Windows) — network egress attributed to a process and
  user. One of the few host artifacts that captures bytes-on-the-
  wire counts.
- **Email + chat content** — typically requires legal coordination
  before review; check your unit's process.

## What's hard

Insider risk amplifies the over-claim trap. You will see patterns
that *look* like exfiltration but are explainable by sanctioned
work — a finance lead pulling Q4 PDFs the day before close, a
developer cloning the whole repo before a clean rebuild, an HR
analyst querying departing-employee records. The discipline this
lane teaches:

- **Pattern is a flag, not a finding.** Promote on pattern; close
  on attribution + evidence of intent.
- **Coordinate with counsel before interview.** Insider cases
  often head toward TRO, termination, or referral — your record
  of contact matters.
- **Don't wipe the workstation.** Containment-first is the
  standard IR posture; for insider cases it destroys evidence.
  Preserve and image instead.

The lane also distinguishes **witting** vs **unwitting** insider
patterns. They look identical in the wire-level artifacts; the
discrimination usually requires the interview.

## Where to read more

- **CERT Insider Threat Center** publications (CMU SEI)
- **NITTF** (National Insider Threat Task Force) guidance for
  government context
- Your unit's CAC failure / unfamiliar-process referral procedures
- **DCSA insider threat awareness** materials — for the
  pattern-language analysts will need to use in writeups
`,

  network_logs: `
# Network Logs & PCAP

Network artifacts answer questions host artifacts can't —
**who** talked to **whom**, **when**, **for how long**, and (with
PCAP) **what protocol headers carried**. They almost never tell
you **content**, because most useful traffic is TLS-encrypted.
This lane trains the discipline of reading shape, attributing
flows, and not overclaiming from headers alone.

## What you'll see

- **NetFlow / IPFIX** — connection-level summaries. Five-tuple,
  byte counts, packet counts, durations. No payload.
- **DNS query logs** — often the first signal of malware C2
  (DGA, beacon resolution patterns) or data exfiltration (DNS
  tunneling).
- **Web proxy logs** — URL-level visibility on outbound HTTP/S.
  TLS-aware proxies break out CONNECT targets even on HTTPS.
- **PCAP** — packet-level detail when you need it. Most modern
  PCAP carries encrypted payloads; you're reading TLS handshake
  metadata, SNI, JA3/JA4 fingerprints, and the timing/size shape
  of the flow.

## What's hard

- **Beacon shape is necessary for C2, not sufficient.** Regular
  interval + small uniform payload + repeated destination is the
  textbook signature — and also the textbook signature of every
  legitimate SaaS heartbeat. Vendor confirmation (signed binary,
  registered domain, vendor-published cert chain) closes the gap.
- **PCAP doesn't carry process or user attribution.** A flow
  shows two endpoints. Tying it to a specific process or user
  needs host-side EDR or socket-table correlation.
- **DNS doesn't always precede a connection.** Cached resolutions,
  hosts-file overrides, hardcoded IPs all break the "DNS → flow"
  inference.

## Where to read more

- **Bejtlich's "The Practice of Network Security Monitoring"** —
  best single book on NSM thinking
- **Argus / Zeek / Suricata** documentation — the tools the field
  uses
- **JA3 / JA4 fingerprint** writeups (Salesforce + FoxIO blogs)
- **The TLS 1.3 RFC (RFC 8446)** — enough to know what's
  observable in the handshake vs what's encrypted in the body
`,

  memory_forensics: `
# Memory Forensics

When a host is suspected of running implanted code that hasn't
written itself to disk, memory is where the answer lives. The lane
covers Volatility 3 plugins on Windows memory images and the
discipline of using each output as a triage signal, not a verdict.

## What you'll see

- **\`pslist\` / \`pstree\`** — the process tree, including
  parent-child relationships. Anomalies in the tree (\`cmd.exe\`
  from \`winword.exe\`) are the headline signal.
- **\`netscan\`** — active sockets and their owning processes.
  Captures **existence** and **state**, not payload.
- **\`malfind\`** — flags memory regions with anomalous
  protection bits (RWX) and injected-code patterns. **Lead, not
  verdict.**
- **\`dlllist\` / \`ldrmodules\`** — loaded DLLs per process,
  including unlinked ones.
- **\`cmdline\`, \`envars\`, \`handles\`** — process-context detail
  for correlation.

## What's hard

The recurring trap with memory forensics is treating triage
signals as conclusions. **\`malfind\` hits are leads.** RWX memory
exists in legitimate processes (JIT compilers, anti-cheat,
security tools). A malfind hit narrows the suspect set; it doesn't
indict.

Similarly, **\`netscan\` shows the socket state, not the data
movement.** ESTABLISHED means the TCP three-way handshake
completed. The amount, direction, and content of bytes on the
socket aren't visible without packet capture or process-buffer
carving.

The disciplined finish for memory work is: **dump the suspect
region, analyse it offline, correlate with on-disk and network
evidence.** A memory image alone rarely closes a case.

## Where to read more

- **The Art of Memory Forensics** (Ligh et al.) — still the
  reference text
- **Volatility 3 documentation** — and the plugin source, which is
  worth reading
- **Microsoft Sysinternals tooling** (Process Explorer, Process
  Monitor) for the *what should this look like in memory*
  baselines
`,

  malware_analysis: `
# Malware Analysis

CDTI work doesn't typically include deep reverse-engineering —
that's a specialised role. But CDTI analysts triage malware: read
static features, run sandbox reports, pivot on hashes, and decide
whether the sample is worth escalating. This lane covers the
triage-level skill set and the discipline of reading family vs
campaign vs sample.

## What you'll see

- **Static PE analysis** — imports, strings, sections, entropy.
  Cheap and surprisingly informative.
- **YARA rules** — pattern matches for known families. Powerful,
  noisy without curation.
- **Imphash / TLSH / ssdeep** — fuzzy hashing for clustering
  related samples.
- **Sandbox reports** (CAPE, Cuckoo, Joe) — dynamic behaviour
  observed in detonation. Sometimes the sample evades; sometimes
  it doesn't run; sometimes it tells you everything.
- **Threat-intel pivots** — passive DNS, Certificate Transparency,
  WHOIS, VirusTotal relations. The infrastructure-side analysis.

## What's hard

The two recurring traps:

1. **Confusing family attribution with campaign attribution.**
   A YARA hit says "this looks like FamilyX." A campaign claim
   says "this is part of a specific operator's activity." The
   evidence for each is different. Family ≠ campaign ≠ specific
   actor.
2. **Over-trusting any single signal.** Imphash collisions
   happen across unrelated packers. WHOIS is mostly privacy-
   redacted. Sandbox detonation might trigger evasion logic. The
   disciplined writeup names the signals, the corroboration, and
   the gaps.

## Where to read more

- **Practical Malware Analysis** (Sikorski + Honig) — still the
  reference
- **MITRE ATT&CK** — for the behaviour taxonomy you'll write
  findings against
- **CAPE Sandbox** / **Joe Sandbox** documentation — for reading
  reports critically
- **Mandiant + CrowdStrike threat-intel blogs** — for what
  campaign-attribution writing looks like at the high end
`,

  anti_forensics: `
# Anti-Forensics

What attackers do to make the rest of your job harder. This lane
covers the canonical techniques — timestomping, log clearing,
LOLBIN abuse, USN-journal wipes — and trains the reflex of
reading each technique by the **trace it leaves**, not the trace
it removes.

## What you'll see

- **Timestomping** — MFT timestamps rewritten to hide when a file
  really arrived. Detected by comparing \`$STANDARD_INFORMATION\`
  (userland-rewritable) against \`$FILE_NAME\` (kernel-only).
- **Event Log clearing** — \`wevtutil cl <channel>\` destroys
  history but generates Event ID 1102 (Security) or 104 (System)
  recording the clear itself, with the operator's SID, the
  process, and the timestamp.
- **LOLBINs** — Living-off-the-Land Binaries. Signed Microsoft
  tools (\`bitsadmin\`, \`certutil\`, \`mshta\`, \`rundll32\`,
  \`regsvr32\`, \`wmic\`) used for download / execute /
  persistence operations they weren't designed for. Read the
  command line, not the binary name.
- **USN journal + \`$LogFile\` wipes** — filesystem-level
  destruction of the change log that would otherwise let you
  reconstruct timeline.
- **Alternate Data Streams** (ADS) — NTFS feature that lets a
  file have multiple "streams" of content; commonly used to
  hide payloads invisible to standard Explorer views.

## What's hard

Almost every technique in this lane leaves a **negative signal**
— an absence where something should be. The discipline is
recognising the absence as evidence rather than dismissing it as
"the log just didn't capture this." The recurring traps:

- **Signed = legitimate** is the canonical anti-forensic misread.
  A signed binary doing the job it was designed for is benign.
  The same binary used outside its scope is the case. Read the
  command line.
- **\`$SI\` vs \`$FN\` disagreement = timestomping** isn't always
  true. Normal NTFS behaviour produces a disagreement when a file
  is created and later edited in place. The trustworthy signal is
  \`$SI Created < $FN Created\` — that's impossible without
  manipulation.
- **"The log was cleared so we have nothing"** ignores forwarded
  logs (WEC, SIEM) and Volume Shadow Copies of the channel's
  \`.evtx\` file. The on-host clear isn't the end of the
  timeline; it's the start of a different recovery question.

## Where to read more

- **MITRE ATT&CK T1070** (Indicator Removal on Host) and
  subtechniques — the taxonomy your writeups will reference
- **LOLBAS Project** (lolbas-project.github.io) — curated
  registry of signed Windows binaries usable for off-label
  operations, with the exact command lines
- **Eric Zimmerman's MFTECmd** — the field-standard MFT
  extractor; format docs come with the tool
- **Microsoft's Windows Event Log architecture** docs — for the
  service / channel / \`.evtx\` mental model that makes the
  recovery surfaces (WEC / VSS) visible
`,

  mobile_forensics: `
# Mobile Forensics

iOS and Android extractions are increasingly part of CI cyber work
— travel-incident investigations, recovered devices, consensual
acquisitions. The cases are tool-driven (Cellebrite UFED,
Magnet AXIOM, GrayKey) and the discipline is reading what the
tools tell you carefully and recognising when they disagree.

## What you'll see

- **Acquisition-type metadata** — AFU vs BFU vs full-file-system
  extraction. Determines what's recoverable.
- **Hash-verified images** — the foundation of any defensible
  finding.
- **Per-app SQLite databases** — Messages, Photos, Maps, every
  third-party app. The actual content lives here.
- **Carved free pages + WAL files** — deleted-row recovery on
  SQLite stores. Often the case-relevant evidence.
- **Per-tool module configurations** — UFED and AXIOM have
  different modules enabled per run; the same source image
  yields different reports.

## What's hard

The recurring trap is **trusting a single tool's count as
authoritative.** UFED says 4,118 Messages rows; AXIOM says 4,144.
Neither is wrong — they're computed differently. The disciplined
writeup names which tool, which module configuration, and what
the disagreement reveals (different de-dup heuristics, different
carving stages enabled, different parser versions).

The other trap: **encrypted-at-rest databases** that some tools
ingest and others don't. A "0 Signal messages" report often means
"this tool's module doesn't read the encrypted-at-rest DB on this
iOS version" — not that the user never used Signal.

## Where to read more

- **Heather Mahalik's mobile forensics work** (and SANS FOR585)
- **Cellebrite / Magnet documentation** — read it critically;
  module release notes carry the gotchas
- **iOS / Android security overview** publications — for the
  layers (Keychain, Keystore, FBE) the tools have to navigate
`,

  cloud_forensics: `
# Cloud Forensics

CDTI cases increasingly land on cloud tenancies — AWS accounts,
Azure subscriptions, GCP projects. The artifacts look nothing
like host triage. There's no MFT, no Prefetch, no LNK. There's
an audit log (per cloud) and an IAM identity store, and almost
every question is *who actually did this, and what does the log
prove vs imply.*

## What you'll see

- **AWS CloudTrail** — per-region audit log of API calls. Every
  event has a \`userIdentity\` describing who made the call. The
  \`AssumeRole\` chain is the workhorse pattern: actions appear
  under an assumed-role session, and the trail traces back to the
  original IAM user via the \`AssumeRole\` event itself.
- **Azure Activity Log + Entra Sign-in Logs** — Azure's
  equivalents. Activity log covers Azure resource management;
  sign-in logs cover identity. \`Microsoft.Insights.activityLogs\`
  is where Azure-side API calls land; \`AuditLogs\` +
  \`SignInLogs\` are where identity events land.
- **GCP Cloud Audit Logs** — Admin Activity, Data Access (off by
  default!), and System Event streams. Per-project + per-resource
  scoping.
- **IAM** in every cloud — long-lived credentials (access keys,
  service-account keys), short-lived credentials (\`sts:AssumeRole\`,
  Azure Managed Identities, GCP service-account impersonation),
  and the policies that govern what each can do.
- **Sign-in logs** — Entra ID's \`SignInLogs\` table, AWS
  console-sign-in events in CloudTrail, GCP's Cloud Identity
  audit. Impossible-travel detection lives here.

## What's hard

The recurring traps:

- **\`eventName\` is not the action.** A CloudTrail event named
  \`AssumeRole\` is the *issuance* of a session; the *action* the
  attacker performed using that session is in a later, separate
  event under that assumed-role identity. Reading one in isolation
  misses the chain.
- **\`sourceIPAddress\` lies (in a specific way).** For AssumeRole
  events, the source IP is the IP that *initiated the assume*. For
  the subsequent actions using the temp credentials, it's the IP
  *using* the credentials. The two don't have to match — and
  often won't, in legitimate workflows.
- **Data Access logging is OFF BY DEFAULT.** AWS CloudTrail Data
  Events for S3, GCP Data Access logs, Azure Storage diagnostic
  logs — all off out of the box. A tenancy that didn't enable
  them can't reconstruct what was read.
- **Log delay.** CloudTrail can take 5–15 minutes to land. The
  attacker's actions complete in seconds; the trail you triage
  isn't real-time.
- **Region scope.** A query against us-east-1 misses events in
  us-west-2. CloudTrail trails are per-region by default unless
  the operator enabled multi-region.
- **Sign-in geo is best-effort.** The IP-to-geo database powers
  impossible-travel; VPN egress, mobile carrier NAT, and known
  edge proxies can flip a legitimate sign-in into a "Lagos to
  Frankfurt" pattern that isn't compromise.

## Where to read more

- **AWS Security Reference Architecture** + **CloudTrail user
  guide** — the authoritative AWS docs
- **Microsoft Entra ID monitoring + Identity Protection** docs —
  for sign-in log schema and risk-engine behaviour
- **GCP "Detective controls" + Cloud Audit Logs** docs
- **DFIR Report's cloud incident writeups** (thedfirreport.com)
  for real-incident pattern-language
- **MITRE ATT&CK for Cloud** — the technique taxonomy your
  writeups will reference (T1078.004, T1098.001, T1525, etc.)
`,

  rf_awareness: `
# Signals Awareness

CDTI analysts are not TSCM-qualified personnel. This lane is
**awareness**, not operations: how to read a field observation
report critically, when to escalate, and how to write what an
observation actually supports without rendering a TSCM finding
you aren't certified to render.

## What you'll see

- **Spectrum sweep reports** — typically a one-pager from a field
  element with band coverage, observation window, and a
  conclusion.
- **Observation logs** — periodic snapshots of band activity.
- **WiFi / Bluetooth scan output** — device names, OUIs, signal
  strengths around a sensitive event.
- **Acoustic anomaly reports** — narrowband persistent emitters
  observed in unexpected ranges.

## What's hard

The dominant discipline here is **language calibration**. A
90-minute spectrum sweep in the 25 MHz–6 GHz range does **not**
support "the room is clean." It supports "no signals of interest
were observed during this window in the swept band." The
difference is the difference between an honest writeup and an
overclaim that gets quoted back at you when the next incident
happens.

Other recurring discipline:

- **Absence of evidence ≠ evidence of absence.** A bounded
  observation can't foreclose intermittent transmitters,
  RF-quiet devices, or out-of-band emitters.
- **Don't render TSCM findings you're not qualified to render.**
  Recommending escalation IS the deliverable for this lane.
- **OUI + signal strength + name** is a triage signal, not a
  device classification. "ESP32 hidden SSID at -83 dBm" is
  consistent with door-lock controllers, BLE bridges, and lighting
  hardware. Without TSCM-qualified follow-up, it's not a finding.

## Where to read more

- **NSA / CSS TSCM Familiarity** materials (where authorised)
- **WiFi alliance + Bluetooth SIG** OUI registries
- Your unit's TSCM escalation SOP — knowing who to call IS the
  knowledge this lane builds
`,

  evidence_handling: `
# Evidence Handling

Chain-of-custody errors close cases. This lane covers what a
defensible chain looks like, where the common breaks are, and how
to write a Memorandum For Record when the chain has a gap that
needs documenting.

## What you'll see

- **DA Form 4137** — Evidence/Property Custody Document. The
  default chain-of-custody form for DoD context.
- **Tamper-evident seals** and seal-attribution markings (initials,
  date, purpose-of-break).
- **Internal item manifests** — per-item identifiers inside a
  sealed container, so a later examiner can match an examined
  item back to the document.
- **Memoranda For Record** — the narrative format for documenting
  any deviation from the standard chain (re-inspection breaks,
  custody transfers without standard form, etc.).

## What's hard

The two recurring traps:

1. **Cut seal ≠ broken chain.** Seals are routinely cut for
   authorised purposes (inspection, examination prep). The chain
   breaks only when the **reseal** is unattributed — no
   initials, no date, no purpose. Cutting is fine; silent
   resealing is the problem.
2. **A deferred per-item inventory is a workflow choice, not a
   chain break** — *provided* the items are individually
   identifiable (per-item tags or a sealed internal manifest).
   Without per-item ID, even a perfect outer-seal chain doesn't
   tie the examined item back to the document.

The disciplined response to a paperwork gap is **document what
happened, document what was done about it, and add per-item
identifiers going forward.** "Destroy the evidence and restart" is
not an answer; the items already exist and have a partial chain.

## Where to read more

- **DA PAM 195-1** (Army Crime Records Center publication
  guidance) for the form-level mechanics
- **Federal Rules of Evidence** — the legal frame the chain has to
  hold up against
- Your unit's Trial Counsel — for the local conventions on
  retroactive attestation, MFRs, and sealed-container handling
`,

  report_writing: `
# Report Writing

The reason for everything else: the writeup. CDTI findings need to
be readable by people who weren't in the artifacts — counsel,
unit leadership, downstream agencies, eventually a court. This
lane trains the language discipline that distinguishes an
honest finding from an over-claim or an evasion.

## What you'll see

- **Calibration rewrites** — take a sloppy finding, rewrite it
  to say only what the artifacts support.
- **Ambiguous-evidence drills** — patterns that look like one
  thing and could be another. The writeup names both readings.
- **Presence vs execution** — a recurring class of overclaim
  (Prefetch entry = file ran; LNK = file was opened; URL in
  browser history = page was loaded by the user). The writeup
  matches the artifact's actual scope.

## What's hard

The dominant trap is **collapsing a bounded observation into a
definitive negative or positive finding.** *"Sweep was clean"*
isn't supportable from a 90-minute, band-limited observation;
*"the user copied the file"* isn't supportable from "the USB was
mounted while the file was open." The disciplined finding names
what was observed, names what it doesn't establish, and stops at
the smallest defensible claim.

Other recurring discipline:

- **Pattern is a flag, not a finding.** Promote on pattern;
  close on attribution + evidence of intent.
- **Name your gaps.** A writeup that says "we don't have X, but
  pulling it would resolve this question" is stronger than one
  that quietly hopes nobody asks for X.
- **Voice matters.** Active voice with named actors is harder to
  defend in court than passive voice with named artifacts.
  *"The user copied the file"* commits you to attribution.
  *"A file-write event was recorded on the USB volume during the
  connection window"* commits you to the artifact.

## Where to read more

- **The Elements of Style** (Strunk + White) — still the
  baseline for tight technical prose
- **Federal Rules of Evidence + Daubert criteria** — what your
  writing has to survive
- **Your unit's report templates** — local conventions matter
- **Past unit findings that closed cleanly** — the best
  reference for what your specific audience reads as
  defensible
`,
};
