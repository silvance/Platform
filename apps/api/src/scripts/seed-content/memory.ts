import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Memory Forensics family. Volatility 3 reads of a memory image.
// Each scenario shows a small slice of one plugin's output and
// asks the same separation an analyst has to make on every real
// memory case: "this looks off" is a starting point, not a
// finding.
//
// Design follows the OJT-Bridge constraints: one artifact, three
// questions max, plain-language debriefs, no trick questions.
// Difficulty 2 because the toolchain is unfamiliar even to
// students who've done the rest of the platform.

export const MEMORY_FORENSICS_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. Process tree triage ─────────────────────────────────
  {
    slug: "memory-pstree-triage-001",
    title: "Process Tree: Spot the Odd Process",
    summary:
      "A short pstree slice from a Windows memory image. One process doesn't fit the pattern. Read what fits and what doesn't.",
    skillAreas: ["windows_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 7,
    tags: ["memory", "volatility", "windows", "inference_discipline"],
    lane: "memory_forensics",
    module: "Process listings",
    sequence: 1,
    brief: `
# Brief

\`windows.pstree\` walks the doubly-linked process list in the
memory image and prints it with parent-child indentation. It's
the first thing most analysts run because most malware lives in
a process.

What pstree tells you reliably:
- which processes were running at the time the memory was captured;
- their PID / PPID, image name, command line (truncated), start time;
- the parent-child relationships at that snapshot.

What pstree does *not* tell you on its own:
- whether a process is malicious;
- which user-account-side click started it (the SID is in
  \`pslist\` / \`getsids\`, not in pstree);
- what code is actually executing inside the process now.

One process in the slice below sits where it shouldn't.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "windows.pstree.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f memdump.raw windows.pstree",
            "Volatility 3 Framework 2.7.2",
            "Progress:  100.00\t\tPDB scanning finished",
            "",
            "PID   PPID  ImageFileName       Offset(V)         Threads Handles  CreateTime",
            "",
            "  4     0   System              0xfa800184c040    102     -        2026-10-14 07:55:01.000000 UTC",
            "  376   4   smss.exe            0xfa80020e0b30    2       30       2026-10-14 07:55:02.000000 UTC",
            "  484   476 csrss.exe           0xfa800242c060    9       450      2026-10-14 07:55:04.000000 UTC",
            "  532   476 wininit.exe         0xfa8002418060    3       80       2026-10-14 07:55:04.000000 UTC",
            "* 632   532 services.exe        0xfa8002612460    9       205      2026-10-14 07:55:05.000000 UTC",
            "** 836  632 svchost.exe         0xfa800283d770    21      516      2026-10-14 07:55:06.000000 UTC",
            "    C:\\Windows\\system32\\svchost.exe -k DcomLaunch",
            "** 928  632 svchost.exe         0xfa8002a14570    16      388      2026-10-14 07:55:06.000000 UTC",
            "    C:\\Windows\\system32\\svchost.exe -k RPCSS",
            "* 720   532 lsass.exe           0xfa800270c060    7       720      2026-10-14 07:55:05.000000 UTC",
            "  1804  1492 explorer.exe       0xfa8004812060    33      950      2026-10-14 09:02:11.000000 UTC",
            "* 3164 1804 chrome.exe          0xfa8005ea1060    28      610      2026-10-14 14:11:30.000000 UTC",
            "* 4012 1804 svchost.exe         0xfa8006221080    4       42       2026-10-14 16:48:55.000000 UTC",
            "    C:\\Users\\m.wong\\AppData\\Local\\Temp\\svchost.exe",
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
        promptMd:
          "Which row is the **odd one** in this pstree slice?",
        options: [
          {
            id: "pid-4012",
            label:
              "PID 4012 — `svchost.exe` whose parent is `explorer.exe` and whose image path is in a user's `AppData\\Local\\Temp` folder.",
          },
          {
            id: "pid-3164",
            label:
              "PID 3164 — `chrome.exe` started by `explorer.exe` at 14:11.",
          },
          {
            id: "pid-836",
            label:
              "PID 836 — `svchost.exe -k DcomLaunch` started by `services.exe` at boot.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["pid-4012"],
          allowMultiple: false,
        },
        debriefMd:
          "**PID 4012.** Genuine `svchost.exe` is a Windows service host: its parent is always `services.exe` (PID 632 here) and its image path is `C:\\Windows\\System32\\svchost.exe`. PID 4012 is parented by `explorer.exe` and lives in `C:\\Users\\m.wong\\AppData\\Local\\Temp` — a classic *masquerading* pattern. The other two rows are normal.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "What does identifying PID 4012 as suspicious actually **prove**?",
        options: [
          {
            id: "proves-malware",
            label:
              "It proves PID 4012 is malware. Legitimate svchost.exe always lives in System32 under services.exe; any process with that name running from a different path under a different parent is by definition a masquerading binary, and a masquerading binary is a malicious one. The pstree output is sufficient evidence to declare the process as malicious code.",
          },
          {
            id: "is-finding-not-proof",
            label:
              "It identifies PID 4012 as a triage lead — a process worth pivoting on. \"Suspicious\" is a routing signal, not a finding; the malware claim needs evidence of behaviour (network connections, code injected into other processes, the binary's actual content).",
          },
          {
            id: "proves-user-clicked-it",
            label:
              "It proves the user m.wong deliberately launched the process. The image path is under their user profile (`C:\\Users\\m.wong\\AppData\\Local\\Temp\\`), which means the binary was written there by something running as m.wong, and explorer.exe — m.wong's shell — is the parent process. Both signals are consistent only with the user double-clicking the binary themselves.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["is-finding-not-proof"],
          allowMultiple: false,
        },
        debriefMd:
          "**It's a triage lead, not a finding.** Masquerading is a strong indicator that *deserves attention*. To go from \"suspicious\" to \"malware,\" you'd add `windows.netscan` (does it talk to anything?), `windows.malfind` (is there RWX memory with shellcode?), `windows.dlllist` (loaded modules), and ideally the binary on disk so the lab can hash + sandbox it.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that PID 4012 is malware, on the strength of the pstree slice alone.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2 or 3.** The masquerading is real — name + path + parent are all off-pattern. But pstree is one plugin; declaring \"malware\" needs corroboration. The next runs to do are `windows.netscan -p 4012`, `windows.malfind -p 4012`, and dumping the executable image for hashing.",
      },
    ],
  },

  // ─── 2. Netscan triage ──────────────────────────────────────
  {
    slug: "memory-netscan-triage-001",
    title: "Netscan: What \"Active Connection\" Means",
    summary:
      "A windows.netscan slice shows several connections at the time of memory capture. Decide which is the standout and what it really tells you.",
    skillAreas: ["network_logs", "windows_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 7,
    tags: ["memory", "volatility", "network", "inference_discipline"],
    lane: "memory_forensics",
    module: "Process listings",
    sequence: 2,
    brief: `
# Brief

\`windows.netscan\` walks the memory image looking for network
endpoints — listening sockets and active connections that
existed at the moment the memory was captured. The output is
the network equivalent of pstree: a snapshot, not a session
log.

What netscan supports:
- which processes had which sockets open at the capture moment;
- the local and foreign endpoints;
- the connection state (ESTABLISHED / LISTENING / CLOSE_WAIT).

What netscan doesn't support:
- what was sent or received on a socket (no payload bytes);
- the *history* — connections opened and closed before the
  capture aren't here;
- whether a destination is malicious.

> **A note on the option text.** The question options below
> mention **EDR** (Endpoint Detection and Response — the
> enterprise security-agent class: CrowdStrike Falcon, Microsoft
> Defender for Endpoint, etc.) as a possible source for the
> *content* of a connection. You don't need to know the agent
> internals — only that EDR is a host-side telemetry source.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "windows.netscan.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f memdump.raw windows.netscan",
            "Volatility 3 Framework 2.7.2",
            "Progress:  100.00\t\tPDB scanning finished",
            "",
            "Offset            Proto   LocalAddr        LocalPort  ForeignAddr        ForeignPort  State        PID    Owner",
            "",
            "0xfa8005e02010    TCPv4   10.0.4.55         52344     142.250.190.110     443          ESTABLISHED  3164   chrome.exe",
            "0xfa8005e02b20    TCPv4   10.0.4.55         52345     142.250.190.110     443          ESTABLISHED  3164   chrome.exe",
            "0xfa8005e03c30    TCPv4   10.0.4.55         52401     198.51.100.77       443          ESTABLISHED  4012   svchost.exe",
            "0xfa8005e04d40    TCPv4   0.0.0.0           135       0.0.0.0             0            LISTENING    928    svchost.exe",
            "0xfa8005e05e50    TCPv4   0.0.0.0           445       0.0.0.0             0            LISTENING    4      System",
            "0xfa8005e06f60    UDPv4   10.0.4.55         5353      *                   *            -            1488   svchost.exe",
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
        promptMd:
          "Which connection is the **standout** in this slice?",
        options: [
          {
            id: "chrome-443",
            label:
              "The two `chrome.exe` connections to `142.250.190.110:443`.",
          },
          {
            id: "svchost-bind",
            label:
              "The svchost listeners on ports 135 / 445.",
          },
          {
            id: "svchost-out",
            label:
              "`svchost.exe` (PID 4012) ESTABLISHED to `198.51.100.77:443`.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["svchost-out"],
          allowMultiple: false,
        },
        debriefMd:
          "**PID 4012's outbound TCP/443 to `198.51.100.77`.** Genuine `svchost.exe` doesn't normally initiate outbound HTTPS to an arbitrary public address — that pattern is much more consistent with malware or a beacon. The Chrome connections to a Google IP look normal; the LISTENING sockets on 135 / 445 are standard Windows services.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does the netscan row prove the process **sent sensitive data** to that IP?",
        options: [
          {
            id: "no-no-payload",
            label:
              "No. Netscan captures the socket's existence and state at the capture moment; it carries no payload bytes. \"Bytes were sent\" needs full packet capture or an EDR file-transfer event scoped to that process.",
          },
          {
            id: "yes-established-means-sent",
            label:
              "Yes. An ESTABLISHED state means data has been transferred.",
          },
          {
            id: "yes-tcp443-implies-tls",
            label:
              "Yes. The port-443 destination implies TLS traffic, which always means content was sent.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-no-payload"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** ESTABLISHED only means the TCP handshake completed. The amount, direction, and content of any data on the socket aren't in netscan output. To make a *content* claim you need packet capture from the period, EDR file-transfer events, or a memory carve of the process's send/receive buffers (which is itself fragile).",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that PID 4012's `198.51.100.77` connection is malicious C2, **from the netscan slice alone**.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2 or 3.** The combination of *a process named like a Windows service* + *outbound HTTPS to an arbitrary public address* is suggestive. Confirming \"C2\" needs the process's own behaviour (malfind / dlllist), the destination's reputation (passive-DNS, threat-intel), and ideally a longer-window network capture showing beaconing cadence.",
      },
    ],
  },

  // ─── 3. malfind ─────────────────────────────────────────────
  {
    slug: "memory-malfind-001",
    title: "malfind: RWX Memory and What It Doesn't Prove",
    summary:
      "windows.malfind flagged a region of executable, writable memory inside a process. Decide what that flag means — and doesn't.",
    skillAreas: ["windows_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 8,
    tags: ["memory", "volatility", "windows", "malfind", "inference_discipline"],
    lane: "memory_forensics",
    module: "Suspicious memory regions",
    sequence: 1,
    brief: `
# Brief

\`windows.malfind\` scans each process's memory for regions that
look like injected code — most often, regions marked
\`PAGE_EXECUTE_READWRITE\` (RWX) that are not backed by a file
on disk. RWX is a red flag because the loader rarely needs a
region to be writable *and* executable; classic shellcode and
process-injection payloads end up there.

What malfind supports:
- a process has memory regions whose protection / backing
  pattern is consistent with code injection;
- the first bytes of the region (so you can spot common
  shellcode prologues like \`55 8B EC\` or \`4C 8B D1\`).

What malfind doesn't support:
- a definitive "this is malware" verdict — some legitimate
  software (JIT compilers, anti-cheat engines, security tools)
  also creates RWX regions;
- the *origin* of the injected code (who put it there);
- the *effect* — what the injected code actually does at
  runtime.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "windows.malfind.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f memdump.raw windows.malfind",
            "Volatility 3 Framework 2.7.2",
            "Progress:  100.00\t\tPDB scanning finished",
            "",
            "PID    Process       Start VPN          End VPN            Tag    Protection             CommitCharge  PrivateMemory  File output  Notes",
            "",
            "4012   svchost.exe   0x0000000001a00000 0x0000000001a3ffff VadS   PAGE_EXECUTE_READWRITE 64            1              Disabled     N/A",
            "",
            "Disasm (first 16 bytes):",
            "  0x1a00000  fc                CLD",
            "  0x1a00001  48 83 e4 f0       AND   rsp, 0xfffffffffffffff0",
            "  0x1a00005  e8 c0 00 00 00    CALL  0x1a000ca",
            "  0x1a0000a  41 51             PUSH  r9",
            "  0x1a0000c  41 50             PUSH  r8",
            "",
            "Hex (first 16 bytes):",
            "  0x1a00000  fc 48 83 e4 f0 e8 c0 00  00 00 41 51 41 50 52 51   .H........AQAPRQ",
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
        promptMd:
          "What does the **PAGE_EXECUTE_READWRITE** protection flag tell you about this memory region?",
        options: [
          {
            id: "rwx-executable-writable",
            label:
              "The region can be both written to and executed. This is unusual for normal program memory and is a textbook injection pattern.",
          },
          {
            id: "rwx-means-shared",
            label:
              "The region is shared with another process.",
          },
          {
            id: "rwx-means-file",
            label:
              "The region is backed by a file on disk that's mapped read-write-execute.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["rwx-executable-writable"],
          allowMultiple: false,
        },
        debriefMd:
          "**The region is writable AND executable.** The loader maps program code as RX (read-execute) and program data as RW (read-write); RWX combines both, which is what shellcode needs (it has to write decoded bytes into the same region it'll run). The `fc 48 83 e4 f0` prologue (CLD; AND rsp, -0x10) is the canonical opening of Metasploit-style x64 shellcode aligning the stack before its first CALL.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Does the malfind hit by itself **prove** that PID 4012 is executing malicious code?",
        options: [
          {
            id: "no-not-by-itself",
            label:
              "No. malfind flags regions that look injection-shaped. False positives exist: some JIT compilers, anti-cheat engines, and security products also create RWX regions. The shellcode prologue raises the prior probability sharply but isn't a conclusion on its own.",
          },
          {
            id: "yes-rwx-is-conclusive",
            label:
              "Yes. RWX memory regions are forbidden by every modern compiler's hardening flags (W^X policy, DEP, etc.); seeing one in a process is conclusive proof of injected or reflectively-loaded malicious code, and the shellcode prologue is just confirmation of what RWX alone already establishes.",
          },
          {
            id: "yes-malfind-doesnt-false-positive",
            label:
              "Yes. malfind's heuristic specifically filters out the legitimate JIT and anti-cheat patterns that used to noise its output in older versions; the plugin has been tuned over multiple releases to only fire when the region looks injection-shaped, so a malfind hit in current Volatility 3 is a confirmed finding rather than a triage lead.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-not-by-itself"],
          allowMultiple: false,
        },
        debriefMd:
          "**No.** malfind hits are *strong leads*, not verdicts. The right next moves are dumping the region (`windows.vadinfo -p 4012 --dump`), running it through a sandbox or disassembler, and correlating with `windows.netscan` and the process's image-on-disk to build the malware case. In this particular case the masquerading from scenario 1 + the outbound HTTPS from scenario 2 + this RWX region together are a much stronger story than any one of them alone.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that PID 4012 is executing injected shellcode, **using only this malfind output**.",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3 or 4.** The RWX region plus a recognisable shellcode prologue is much more specific than RWX alone. It's still not a final verdict — the right finish is to dump and analyse the region, but a defensible interim writeup says \"PID 4012 contains a 256 KB RWX region whose first bytes match common shellcode prologues; recommend immediate containment and dump-and-analyse.\"",
      },
    ],
  },

  // ─── Memory Forensics capstone ──────────────────────────────
  {
    slug: "memory-suspect-process-capstone-001",
    title: "Memory Capstone: One Suspect Process, Three Lenses",
    summary:
      "A memory image from a workstation that the SOC flagged. Walk the process tree, the active connections, and the suspicious-memory regions on a single process. Decide what reads as malware vs what reads as merely off.",
    skillAreas: ["df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 4,
    estimatedMinutes: 60,
    tags: [
      "memory",
      "volatility",
      "report_writing",
      "inference_discipline",
      "capstone",
    ],
    lane: "memory_forensics",
    module: "Capstone",
    sequence: 1,
    status: "draft",
    brief: `
# Brief

A memory image (\`WS-DEV-091.mem\`) was acquired this morning
after SOC noticed an anomalous outbound connection burst from
the workstation around 03:14Z. The host runs Windows 11 and
belongs to \`s.lin\` (DA-civ, software engineering).

You have four Volatility-3 outputs from the image, all
focused on one process of interest at **PID 4012**
(\`updater.exe\`):

- \`windows.pstree\` — the process tree
- \`windows.netscan\` — connection table at capture time
- \`windows.malfind\` — suspicious memory regions for the process
- \`windows.cmdline\` — command-line argument for the process

Read the four outputs together. Decide what is supportable on
the current evidence and what would need a dump-and-analyse to
land. Then pick the writeup that gets sent to the IR lead this
afternoon.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "vol-pstree.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f WS-DEV-091.mem windows.pstree",
            "Volatility 3 Framework 2.7.2",
            "",
            "PID    PPID   ImageFileName        Offset(V)    Threads  Handles  SessionId  Wow64  CreateTime",
            "4      0      System               0xfffff80001  118      -        N/A        False  2026-12-04 02:55:14",
            "  388  4      smss.exe             0xfffffa8001  3        -        N/A        False  2026-12-04 02:55:14",
            "  400  388    csrss.exe            0xfffffa8002  10       -        0          False  2026-12-04 02:55:17",
            "  480  388    wininit.exe          0xfffffa8003  3        -        0          False  2026-12-04 02:55:17",
            "    608  480  services.exe         0xfffffa8004  8        -        0          False  2026-12-04 02:55:17",
            "      ...",
            "      2204  608   explorer.exe     0xfffffa800a  44       -        1          False  2026-12-04 03:01:08",
            "        3144  2204  chrome.exe     0xfffffa800b  62       -        1          False  2026-12-04 03:02:11",
            "        4012  2204  updater.exe    0xfffffa800c  4        -        1          False  2026-12-04 03:14:01",
            "",
            "(Note: PID 4012 updater.exe has explorer.exe (2204) as its parent.",
            " A signed Windows-update binary would normally appear under",
            " services.exe (608) via the trustedinstaller / svchost path, not",
            " under explorer.exe.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "vol-netscan.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f WS-DEV-091.mem windows.netscan",
            "Volatility 3 Framework 2.7.2",
            "",
            "Offset            Proto   LocalAddr        LocalPort  ForeignAddr        ForeignPort  State        PID    Owner",
            "0xfa8005e02010    TCPv4   10.0.4.91         52344     203.0.113.42        443          ESTABLISHED  4012   updater.exe",
            "0xfa8005e02080    TCPv4   10.0.4.91         52345     203.0.113.42        443          ESTABLISHED  4012   updater.exe",
            "0xfa8005e02100    TCPv4   10.0.4.91         52346     203.0.113.42        443          ESTABLISHED  4012   updater.exe",
            "0xfa8005e02180    TCPv4   10.0.4.91         52111     142.250.190.110     443          ESTABLISHED  3144   chrome.exe",
            "",
            "(Three simultaneous established sockets from a single process to a",
            " single destination IP, all to port 443. Browser sockets above shown",
            " for context — a single browser tab on www.google.com.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "vol-malfind.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f WS-DEV-091.mem windows.malfind --pid 4012",
            "Volatility 3 Framework 2.7.2",
            "",
            "PID  Process       Start VPN          End VPN            Tag        Protection           CommitCharge  PrivateMemory  File output",
            "4012 updater.exe   0x000001f8c0000000 0x000001f8c003ffff VadS       PAGE_EXECUTE_READWRITE  64           1              Disabled",
            "",
            "Hexdump (first 64 bytes of the RWX region):",
            "  0x000001f8c0000000  fc 48 83 e4 f0 e8 cc 00 00 00 41 51 41 50 52 51   .H........AQAPRQ",
            "  0x000001f8c0000010  56 48 31 d2 65 48 8b 52 60 48 8b 52 18 48 8b 52   VH1.eH.R`H.R.H.R",
            "  0x000001f8c0000020  20 48 8b 72 50 48 0f b7 4a 4a 4d 31 c9 48 31 c0    H.rPH..JJM1.H1.",
            "  0x000001f8c0000030  ac 3c 61 7c 02 2c 20 41 c1 c9 0d 41 01 c1 e2 ed   .<a|., A...A....",
            "",
            "(Heads-up: the first eight bytes — `fc 48 83 e4 f0 e8 cc 00` — are the",
            " canonical x64 shellcode prologue used by Metasploit / Cobalt Strike",
            " stagers. The full region is 256 KB and is RWX, which is also unusual",
            " for a legitimate updater that should be loading PE-backed code into",
            " W^X regions.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "vol-cmdline.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ vol -f WS-DEV-091.mem windows.cmdline --pid 4012",
            "Volatility 3 Framework 2.7.2",
            "",
            "  PID    Process        Args",
            "  4012   updater.exe    \"C:\\Users\\s.lin\\AppData\\Local\\Temp\\updater.exe\"",
            "",
            "(updater.exe was launched from %TEMP% under s.lin's profile. No",
            " arguments. A signed Microsoft updater binary should not normally",
            " live in or run from a user's %TEMP% directory.)",
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
          "Reading the four outputs together, which observations are **directly visible** in the artifacts?",
        options: [
          {
            id: "parent-explorer",
            label:
              "`updater.exe` (PID 4012) was launched as a child of `explorer.exe` (PID 2204), not under the Windows services tree.",
          },
          {
            id: "temp-path",
            label:
              "`updater.exe` is running from `C:\\Users\\s.lin\\AppData\\Local\\Temp\\`.",
          },
          {
            id: "three-tcp-sockets",
            label:
              "The process holds three simultaneous ESTABLISHED TCP sockets, all to `203.0.113.42:443`.",
          },
          {
            id: "rwx-region",
            label:
              "Volatility flagged a 256 KB RWX memory region in the process.",
          },
          {
            id: "metasploit",
            label:
              "The process is a confirmed Metasploit stager.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "parent-explorer",
            "temp-path",
            "three-tcp-sockets",
            "rwx-region",
          ],
          allowMultiple: true,
        },
        debriefMd:
          "The first four are what the four outputs literally say. *Confirmed Metasploit stager* is interpretive — the shellcode prologue is **consistent with** the Metasploit / Cobalt Strike pattern, but that's an inference until the region is dumped and confirmed.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Each of these signals is suspicious; only some are **specifically** suspicious for an injected stager. Which one is the **strongest single signal**?",
        options: [
          {
            id: "rwx-with-prologue",
            label:
              "The 256 KB RWX region whose first bytes match a canonical x64 shellcode prologue (`fc 48 83 e4 f0 e8 cc 00`).",
          },
          {
            id: "parent-explorer-only",
            label:
              "The parent process being explorer.exe.",
          },
          {
            id: "temp-path-only",
            label:
              "The image path being under `%TEMP%`.",
          },
          {
            id: "three-sockets-only",
            label:
              "Three simultaneous outbound sockets to one IP.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["rwx-with-prologue"],
          allowMultiple: false,
        },
        debriefMd:
          "The RWX-region-with-prologue is the most specific signal: RWX memory regions are themselves common-enough to throw false positives, but RWX + a recognizable shellcode signature is much narrower. The other three signals are unusual for a *legitimate updater* but each one has benign explanations on its own (parent process can be `explorer.exe` for portable apps, `%TEMP%` execution happens with installers, multi-socket fan-out happens with download accelerators). Stack them all together and the case sharpens; pick one and the RWX + prologue is what survives interrogation.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "From the artifact set, what is the **right next step**?",
        options: [
          {
            id: "dump-and-analyse",
            label:
              "Dump the RWX region from PID 4012 (`vol windows.vadinfo` / `vol windows.memmap --dump`) and run it through a disassembler / shellcode analyser to characterise the payload. Contain the host in parallel.",
          },
          {
            id: "terminate-and-reimage",
            label:
              "Terminate PID 4012 and reimage the workstation immediately.",
          },
          {
            id: "wait-for-more-alerts",
            label:
              "Wait for SOC to raise another alert before acting.",
          },
          {
            id: "block-ip-only",
            label:
              "Block `203.0.113.42` at the firewall and consider the case closed.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["dump-and-analyse"],
          allowMultiple: false,
        },
        debriefMd:
          "Dump + analyse + contain. Terminating the process loses the memory before it's preserved; reimaging without a dump destroys the evidence. Waiting for more alerts is exactly the failure mode of incident response. Blocking the IP is a useful containment step but doesn't answer *what's in the RWX region* — and if the payload has a second-stage callback to a different IP, the block is incomplete.",
      },
      {
        ordinal: 4,
        type: "text_match",
        weight: 1,
        promptMd:
          "Quote the **PID** of the suspect process.",
        textMatch: {
          acceptableAnswers: ["4012", "PID 4012"],
          hint: "Look at the `windows.cmdline` output or the `windows.malfind` line.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["4012", "PID 4012"],
          regex: false,
        },
        debriefMd:
          "`4012`. Cite the PID alongside the image name in any downstream writeup so the next analyst can re-derive the artifacts from the same memory image.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Three drafts to send the IR lead. Pick the one you'd actually send.",
        options: [
          {
            id: "overclaim",
            label:
              "*WS-DEV-091 (user s.lin) is fully compromised by an active Metasploit stager. Memory analysis confirms PID 4012 (updater.exe) is running reflected-loaded shellcode from a 256 KB RWX region; the first eight bytes are the canonical Metasploit x64 stager prologue. The process is parented by explorer.exe rather than services.exe and runs from %TEMP%, consistent with user-initiated execution of a malicious dropper, and three simultaneous TCP sockets to 203.0.113.42:443 are the live C2 channel. Recommend immediate isolation of the host, full reimage from known-good media, rotation of all credentials cached on the workstation (domain, VPN, browser-saved), and an SOC sweep across the unit for the same shellcode pattern and the same C2 IP.*",
          },
          {
            id: "calibrated",
            label:
              "*On WS-DEV-091 (user s.lin), Volatility 3 against memory image WS-DEV-091.mem shows process `updater.exe` (PID 4012) running from `C:\\Users\\s.lin\\AppData\\Local\\Temp\\updater.exe`, parented by explorer.exe (PID 2204), holding three simultaneous ESTABLISHED TCP sockets to 203.0.113.42:443. malfind flagged a 256 KB RWX region in the process whose first eight bytes (`fc 48 83 e4 f0 e8 cc 00`) match the canonical x64 stager prologue used by Metasploit and Cobalt Strike. The combination is strongly inconsistent with a legitimate Windows updater. Recommend: (a) contain the host now, (b) dump the RWX region (vol windows.memmap --dump --pid 4012) for shellcode analysis to confirm the payload family, (c) pull the host's process-create events and network telemetry for the trailing 24 h to scope the foothold, and (d) flag s.lin's recent web + email activity for review. Until the dump is analysed, family attribution (\"Metasploit\" / \"Cobalt Strike\" / other) is suggestive and should be stated as \"matches the canonical x64 stager prologue,\" not as a confirmed framework.*",
          },
          {
            id: "underclaim",
            label:
              "*A process named updater.exe (PID 4012) was observed in memory on WS-DEV-091 with a 256 KB RWX memory region. RWX memory regions occur in legitimate software for JIT compilation, plugin loading, and code-page rewrites; the process tree shows it was launched as a child of explorer.exe, meaning the user initiated execution voluntarily rather than via a remote-exploit pathway. The connections to 203.0.113.42 are to port 443 with ESTABLISHED state, consistent with normal HTTPS traffic that any signed updater might generate during a check-for-updates run. Recommend logging the observation in the SOC queue and revisiting when bandwidth allows; no immediate containment action required.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle one. It names every fact the artifacts carry (PID, path, parent, sockets, RWX region size, prologue bytes), names the inference posture (prologue **matches** the stager pattern, family attribution waits on the dump), and recommends the operationally-correct sequence (contain, dump, scope). The first declares Metasploit / C2 / compromise without the dump and recommends a reimage that destroys the evidence first. The third treats a textbook stager prologue as 'suspicious' but pushes it back into the queue — which is how an active foothold gets a multi-hour head start.",
      },
    ],
  },
];
