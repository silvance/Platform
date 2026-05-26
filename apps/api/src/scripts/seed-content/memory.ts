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
              "It proves PID 4012 is malware.",
          },
          {
            id: "is-finding-not-proof",
            label:
              "It identifies PID 4012 as a triage lead — a process worth pivoting on. \"Suspicious\" is a routing signal, not a finding; the malware claim needs evidence of behaviour (network connections, code injected into other processes, the binary's actual content).",
          },
          {
            id: "proves-user-clicked-it",
            label:
              "It proves the user `m.wong` deliberately launched the process.",
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
              "Yes. RWX memory is always malicious.",
          },
          {
            id: "yes-malfind-doesnt-false-positive",
            label:
              "Yes. malfind doesn't false-positive on legitimate software.",
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
];
