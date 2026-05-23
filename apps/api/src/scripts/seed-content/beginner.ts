import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Beginner family. For students who've only had a first course in
// digital forensics. Each scenario is tight (5-12 min), one or two
// artifacts, 3-4 questions, and walks through ONE foundational
// concept with explicit "what this proves vs what this doesn't"
// debriefs.
//
// Every entry here lives in Tier-1 (no status field → defaults to
// "published") so beginners see them in the main /scenarios list.
// Tagged with "beginner" + a topic tag so the existing /scenarios
// filter UI can surface the set.

export const BEGINNER_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. Hash integrity ────────────────────────────────────
  {
    slug: "hash-integrity-basics-001",
    title: "Hash Integrity Basics",
    summary:
      "You downloaded a file. The publisher posted a SHA-256. Does the file match — and what does \"match\" actually prove?",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 8,
    tags: ["beginner", "dfir", "hashes", "inference_discipline"],
    lane: "foundations",
    module: "Integrity & identification",
    sequence: 1,
    brief: `
# Brief

A vendor posted a tool on their website with a published SHA-256
hash for the installer. You downloaded it and ran the same hash
function locally. The two hex strings are listed in the artifact.

Decide what the comparison tells you — and what it does NOT.

## What a hash does

A cryptographic hash (like SHA-256) is a one-way function from
bytes to a fixed-length fingerprint. Two key properties matter
here:

1. **Determinism.** The same bytes always produce the same hash.
2. **Collision resistance.** It is computationally infeasible to
   find two different byte sequences that hash to the same value.

So if two hashes match, the bytes are (with overwhelming
probability) identical. If they don't match, the bytes differ —
even by a single bit.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "hash-comparison.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Hash comparison",
            "----------------",
            "",
            "File:        installer-v2.1.exe",
            "",
            "Published    SHA-256:  6f1b8a3c2e4d5f6071829304a5b6c7d8e9f0112233445566778899aabbccddeeff",
            "Local        SHA-256:  6f1b8a3c2e4d5f6071829304a5b6c7d8e9f0112233445566778899aabbccddeeff",
            "",
            "(both hex strings are identical, byte for byte)",
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
          "The two SHA-256 strings match. Which statements are well supported?",
        options: [
          { id: "same-bytes", label: "The local file's bytes are the same as the file the publisher hashed." },
          { id: "safe-to-run", label: "The file is safe to run." },
          { id: "from-publisher", label: "The file was definitely created by the publisher." },
          { id: "no-tampering-in-transit", label: "The file was not modified in transit (assuming we trust the published hash itself)." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["same-bytes", "no-tampering-in-transit"],
          allowMultiple: true,
        },
        debriefMd: [
          "**A matching hash proves:** the bytes you have match the bytes the publisher hashed. So if you trust the published hash (i.e. you got it from a channel an attacker doesn't control), you also trust that nothing changed the file between then and now.",
          "",
          "**A matching hash does NOT prove:**",
          "",
          "- *Safety.* A malicious file still hashes to its own (consistent) value. Hash integrity is a tampering check, not a malware check.",
          "- *Origin.* Hashes don't carry identity. A digital signature would; a bare hash does not.",
          "",
          "Reasoning discipline: name the property you actually have evidence for (\"the bytes match the published hash\"), not the one you wish you had (\"the file is safe\").",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "If a single bit in the file flipped during download, would the SHA-256 change? Answer yes or no.",
        textMatch: { acceptableAnswers: ["yes", "y"] },
        expected: { type: "text_match", acceptableAnswers: ["yes", "y"], regex: false },
        debriefMd:
          "**Yes.** Cryptographic hashes are designed to amplify small input differences into large output differences (the *avalanche* property). One bit flips → roughly half the hash bits change. That's exactly why hashes work as integrity checks.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the file you downloaded is byte-for-byte identical to the publisher's intended file.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "High — **4 or 5** — assuming the published hash itself was obtained over a channel the attacker doesn't control (e.g. HTTPS from the vendor's official site). The only escape hatch is that *both* the file and the published hash were swapped by the same attacker, which requires controlling the publish channel too.",
      },
    ],
  },

  // ─── 2. File magic bytes ──────────────────────────────────
  {
    slug: "file-magic-bytes-basics-001",
    title: "What File Is This, Really?",
    summary:
      "The extension says one thing. The first few bytes say another. Learn to read file signatures.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 8,
    tags: ["beginner", "dfir", "file_signatures", "inference_discipline"],
    lane: "foundations",
    module: "Integrity & identification",
    sequence: 2,
    brief: `
# Brief

You picked up a file called \`monthly-report.pdf\` from a network
share. Before opening it you ran a hex dump of the first 16 bytes.
Decide what the file actually is.

## Magic bytes

Most binary file formats start with a fixed signature (sometimes
called *magic bytes*) in their first few bytes. A few examples:

| Format | First bytes (hex) | ASCII / meaning |
|---|---|---|
| PDF | \`25 50 44 46\` | \`%PDF\` |
| PNG | \`89 50 4E 47 0D 0A 1A 0A\` | starts with \`\\x89PNG\` |
| JPEG | \`FF D8 FF\` | (no readable ASCII) |
| ZIP / DOCX / XLSX | \`50 4B 03 04\` | \`PK\\x03\\x04\` |

A file's extension is just a string; anyone can rename anything.
The actual format is what's in the bytes.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "hex-dump.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ xxd -l 16 monthly-report.pdf",
            "00000000: 50 4b 03 04 14 00 00 00 08 00 a1 b2 c3 d4 e5 f6   PK..............",
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
        promptMd: "Based on the first bytes, this file is actually:",
        options: [
          { id: "pdf", label: "A PDF" },
          { id: "zip", label: "A ZIP-style archive (could be a real .zip, .docx, .xlsx, .jar, etc.)" },
          { id: "png", label: "A PNG image" },
          { id: "cant-tell", label: "Impossible to tell from this much" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["zip"], allowMultiple: false },
        debriefMd:
          "`50 4B 03 04` = `PK\\x03\\x04`, the ZIP local-file-header magic. Many modern \"document\" formats (.docx, .xlsx, .jar, .apk) are ZIP containers under the hood, so seeing this signature doesn't tell you *which* ZIP-based format — but it does rule out PDF.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "Type the first FOUR hex bytes of a real PDF file. (Bytes only, separated by spaces.)",
        textMatch: { acceptableAnswers: ["25 50 44 46", "25504446", "25 50 44 46 "] },
        expected: {
          type: "text_match",
          acceptableAnswers: ["25 50 44 46", "25504446", "25 50 44 46 "],
          regex: false,
        },
        debriefMd:
          "`25 50 44 46` — that's `%PDF` in ASCII. Real PDFs start that way and follow it with a version marker (e.g. `%PDF-1.7`).",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that opening this in Adobe Acrobat would render a normal-looking PDF.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. The file isn't a PDF at all. Acrobat would refuse it or show a corrupted-file error. Whether the actual ZIP container is a benign document or something nastier is a separate question — but it's not a PDF.",
      },
    ],
  },

  // ─── 3. MAC times ─────────────────────────────────────────
  {
    slug: "mac-times-basics-001",
    title: "MAC Times: What Order Did Things Happen?",
    summary:
      "A file has three timestamps. Put the events in the right order — and don't read more into them than they actually say.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["beginner", "dfir", "timestamps", "windows_artifacts", "inference_discipline"],
    lane: "foundations",
    module: "Timestamps & timelines",
    sequence: 1,
    brief: `
# Brief

You're triaging a single file on a Windows machine. The
filesystem (NTFS) recorded three timestamps:

- **M** — last *Modified* (content last changed)
- **A** — last *Accessed* (file opened / read)
- **C** — *Created* on this volume (file came into existence here)

The artifact has the three values. Reason about the order.

## What MAC times tell you

Each timestamp records *the most recent occurrence* of its
event. They don't carry history — just the latest of each kind.

A few common patterns:

- **Modified later than Created** → the file was created, then
  later edited.
- **Accessed later than Modified** → the file was edited at some
  point, then opened again later.
- **Modified earlier than Created** → the file was created on
  this volume by *copying* from somewhere else (the modified time
  came along for the ride from the source).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "file-timestamps.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "File:       D:\\share\\incident-report.docx",
            "",
            "Created   (C):  2026-03-12 09:00:00 UTC",
            "Modified  (M):  2026-03-08 14:22:00 UTC",
            "Accessed  (A):  2026-03-12 09:01:30 UTC",
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
          "Which single-sentence summary is most consistent with the timestamps?",
        options: [
          { id: "edited-on-this-vol", label: "Someone edited the file on this volume on March 12 at 09:00 UTC." },
          { id: "copied-from-elsewhere", label: "The file was copied to this volume on March 12 at 09:00 UTC; its content was last modified on March 8 (before it landed here)." },
          { id: "created-then-edited", label: "The file was created on this volume on March 8, then edited on March 12." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["copied-from-elsewhere"],
          allowMultiple: false,
        },
        debriefMd:
          "Modified (March 8) is **earlier** than Created (March 12). On NTFS, that pattern is the classic fingerprint of a *copy*: the file came into existence on this volume on March 12, but its modified-time was carried over from the source where it was last edited four days earlier.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "Of the three timestamps (M, A, C), which one most directly tells you the file was opened or read recently?",
        textMatch: { acceptableAnswers: ["a", "accessed", "access"] },
        expected: { type: "text_match", acceptableAnswers: ["a", "accessed", "access"], regex: false },
        debriefMd:
          "**A**ccessed. Caveat: on many modern systems the OS suppresses access-time updates by default (for performance), so A may lag or be unreliable. Treat A as a useful hint, not as ground truth.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the timestamps prove WHO copied the file to this volume.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. Filesystem timestamps say *when*, not *who*. Attribution requires other sources — logon records, USB-mount history, network share access logs, or the file's own metadata.",
      },
    ],
  },

  // ─── 4. Recycle bin ──────────────────────────────────────
  {
    slug: "recycle-bin-basics-001",
    title: "Recycle Bin: What Got Deleted, and By Whom?",
    summary:
      "A file showed up in the recycle bin. Read the metadata for what it actually says — no more, no less.",
    skillAreas: ["df_artifacts", "windows_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 8,
    tags: ["beginner", "dfir", "recycle_bin", "windows_artifacts", "inference_discipline"],
    lane: "foundations",
    module: "Windows basics",
    sequence: 1,
    brief: `
# Brief

On a Windows host you're examining \`C:\\$Recycle.Bin\` and find
two files for a single deleted item:

- \`$Ixxxxxx\` — small metadata file: original path, original
  size, deletion timestamp, user SID.
- \`$Rxxxxxx\` — the actual file contents.

The metadata is in the artifact. Read what it actually says.

## What recycling does and doesn't do

When a user deletes a file via Explorer (not Shift+Delete), the
OS moves it into the per-user recycle bin folder, renames it to
\`$R...\`, and creates a sibling \`$I...\` with the original
metadata. Nothing is destroyed. The deleting user's SID is
resolved from the folder name (which is the SID itself).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "recycle-bin-entry.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Recycle-bin entry",
            "-----------------",
            "",
            "$I file:          $IZX1A4F.docx",
            "$R file (data):   $RZX1A4F.docx       (present, 78,422 bytes)",
            "",
            "Deleted by SID:   S-1-5-21-XXXX-1101  (resolves to: PARTNER\\j.kim)",
            "Original path:    C:\\Users\\j.kim\\Documents\\Q3-targets.docx",
            "Original size:    78422 bytes",
            "Deletion time:    2026-04-10 17:08:42 UTC",
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
        promptMd: "Which statements are **facts** from this artifact?",
        options: [
          { id: "deleted-by-jkim", label: "The account `j.kim` initiated the deletion (the SID resolves to that user)." },
          { id: "original-path", label: "Before deletion the file lived at `C:\\Users\\j.kim\\Documents\\Q3-targets.docx`." },
          { id: "file-destroyed", label: "The file contents have been destroyed." },
          { id: "jkim-wrote-it", label: "`j.kim` is the original author of the document." },
          { id: "data-recoverable", label: "The file data is still present and recoverable on this host." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["deleted-by-jkim", "original-path", "data-recoverable"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Facts from the artifact:**",
          "",
          "- Deletion was initiated under the j.kim account (the SID is part of the folder name).",
          "- The original path is recorded in the `$I` metadata.",
          "- The `$R` file still holds the original bytes — recovery is trivial (rename + restore).",
          "",
          "**Not facts:**",
          "",
          "- *Destroyed* — that's the opposite of what happened. Recycling moves; it doesn't erase.",
          "- *Authored by j.kim* — the recycle-bin entry doesn't record authorship. The NTFS owner of the original file, or the document's own metadata, would speak to that.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What's the simplest way to get the file's contents back from this evidence?",
        options: [
          { id: "copy-r", label: "Copy (or rename) the `$RZX1A4F.docx` file — it IS the original bytes, just under a different name." },
          { id: "decode-i", label: "Decode the `$IZX1A4F.docx` file — the original content is stored there." },
          { id: "carve-unalloc", label: "Run a file-carving tool against the disk's unallocated space." },
          { id: "shadow-copy", label: "Restore from a Volume Shadow Copy snapshot." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["copy-r"],
          allowMultiple: false,
        },
        debriefMd:
          "Copy or rename the `$R...` file — it IS the original bytes. The `$I...` file is *only* metadata (original path, deletion time, size); it doesn't carry the content. Carving + shadow-copy restore are real techniques but they're heavier than necessary here — the data is sitting right there in `$R`. In an investigation you'd preserve a copy rather than restore-in-place, so the on-disk evidence isn't disturbed.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `j.kim` intended to destroy the file.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. Recycling is the default Explorer delete. Most users recycle files for everyday housekeeping — that's not intent to destroy. *Shift+Delete* (which bypasses the recycle bin) is a slightly stronger signal of intent, but even that has innocent explanations. Intent requires more than a single deletion event.",
      },
    ],
  },

  // ─── 5. Browser download history ─────────────────────────
  {
    slug: "browser-download-history-basics-001",
    title: "Browser Download History: What Did the User Do?",
    summary:
      "A single line from Chrome's download history. Read it carefully — and separate what's recorded from what's inferred.",
    skillAreas: ["df_artifacts", "network_logs", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 7,
    tags: ["beginner", "dfir", "browser_artifacts", "inference_discipline"],
    lane: "foundations",
    module: "Browser basics",
    sequence: 1,
    brief: `
# Brief

You're looking at a single record extracted from a workstation's
Chrome download history. The columns are direct from the SQLite
schema — what each column means is in the artifact.

Decide what the record actually proves.

## Two artifacts, one event

Chrome stores download history in
\`%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\History\`
(a SQLite database). Two tables matter here: \`downloads\` rows
record the URL + target path + timing; \`downloads_url_chains\`
records the redirect chain (each URL the request bounced through
before the final response).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "downloads-row.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "downloads row (single record)",
            "-----------------------------",
            "",
            "id:               4912",
            "target_path:      C:\\Users\\a.lim\\Downloads\\report.pdf",
            "received_bytes:   1,442,003",
            "total_bytes:      1,442,003",
            "start_time:       2026-04-22 13:14:02 UTC",
            "end_time:         2026-04-22 13:14:05 UTC",
            "state:            1  (complete)",
            "danger_type:      0  (not flagged by Safe Browsing)",
            "referrer:         https://internal.partner.local/wiki/quarterly-reports",
            "",
            "downloads_url_chains:",
            "  0: https://internal.partner.local/wiki/files/2026-Q1-report.pdf",
            "  (no redirects)",
            "",
            "User at console at 13:14 UTC:  a.lim  (per logon session log)",
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
          "Which statements are well supported by this single record?",
        options: [
          { id: "download-occurred", label: "A 1.4 MB file named report.pdf was downloaded to a.lim's Downloads folder on 2026-04-22 at 13:14 UTC." },
          { id: "from-internal-wiki", label: "The file came from the organization's internal wiki." },
          { id: "user-opened-it", label: "The user opened the file." },
          { id: "user-shared-it", label: "The user shared the file outside the organization." },
          { id: "alim-was-active", label: "The console session at the time was a.lim's." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["download-occurred", "from-internal-wiki", "alim-was-active"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Supported:**",
          "",
          "- The download event itself: file, size, target path, timing — all directly recorded.",
          "- Source = the internal wiki host. The referrer + the chain agree.",
          "- The user at the console was a.lim (per the separate session-log artifact line).",
          "",
          "**Not supported (yet):**",
          "",
          "- *Opened* — download history records the file landing on disk, not whether anyone double-clicked it afterward. Recent-documents shell extensions, jumplists, or application-specific MRUs would speak to that.",
          "- *Shared outside the org* — this record only sees the download. Outbound transfers would show up in DLP, mail logs, or removable-media write events.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which of these artifacts would tell you whether the user actually OPENED the downloaded file (vs just downloading it)? Select all that apply.",
        options: [
          { id: "lnk", label: "LNK shortcuts in `%APPDATA%\\Microsoft\\Windows\\Recent` — created when Explorer opens a file" },
          { id: "jumplist", label: "Application jumplist for the program that opens this file type" },
          { id: "userassist", label: "UserAssist registry keys — track Explorer-launched programs" },
          { id: "browser-history-again", label: "More entries from the browser download history" },
          { id: "smtp-logs", label: "Outbound SMTP logs from the mail server" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["lnk", "jumplist", "userassist"],
          allowMultiple: true,
        },
        debriefMd:
          "LNK files, jumplists, and UserAssist each capture a different angle of \"file was opened.\" The browser download history (where this case started) records the *download* event but says nothing about opening. SMTP logs are about email, not file opens.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that a download from `internal.partner.local/wiki` is, on its own, evidence of unauthorized activity.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "Low. An internal wiki download is normal employee behavior. Whether *this specific* download was authorized depends on what a.lim's role is, what the document contains, and what policy says. Triage the *context*, not the download event by itself.",
      },
    ],
  },

  // ─── 6. Log parsing ──────────────────────────────────────
  {
    slug: "log-parsing-basics-001",
    title: "Reading a Simple Access Log",
    summary:
      "10 lines of a web-server access log. Find the HTTP errors, count the unique IPs, identify the noisy user-agent.",
    skillAreas: ["network_logs", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 8,
    tags: ["beginner", "logs", "network_logs"],
    lane: "foundations",
    module: "Reading logs",
    sequence: 1,
    brief: `
# Brief

A teammate forwarded you a 10-line excerpt from an Apache-style
combined-format access log. Read it carefully.

## Combined log format reminder

\`\`\`
<client-ip> - <user> [<timestamp>] "<method> <path> <proto>" <status> <size> "<referer>" "<user-agent>"
\`\`\`

Two HTTP status families that matter for triage:

- **4xx** — client error. \`404\` not found, \`401\` unauthorized,
  \`403\` forbidden.
- **5xx** — server error. The server admits it failed.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "access.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            '198.51.100.7 - - [10/Apr/2026:09:00:01 +0000] "GET /index.html HTTP/1.1" 200 5310 "-" "Mozilla/5.0"',
            '198.51.100.7 - - [10/Apr/2026:09:00:04 +0000] "GET /about HTTP/1.1" 200 2118 "-" "Mozilla/5.0"',
            '203.0.113.42 - - [10/Apr/2026:09:00:07 +0000] "GET /admin HTTP/1.1" 401 88 "-" "curl/7.85"',
            '203.0.113.42 - - [10/Apr/2026:09:00:08 +0000] "GET /admin/users HTTP/1.1" 401 88 "-" "curl/7.85"',
            '203.0.113.42 - - [10/Apr/2026:09:00:09 +0000] "GET /api/v1/secrets HTTP/1.1" 401 88 "-" "curl/7.85"',
            '198.51.100.7 - - [10/Apr/2026:09:00:11 +0000] "GET /contact HTTP/1.1" 200 1402 "-" "Mozilla/5.0"',
            '198.51.100.7 - - [10/Apr/2026:09:00:13 +0000] "POST /login HTTP/1.1" 200 412 "-" "Mozilla/5.0"',
            '192.0.2.18 - - [10/Apr/2026:09:00:14 +0000] "GET /favicon.ico HTTP/1.1" 404 142 "-" "Mozilla/5.0"',
            '203.0.113.42 - - [10/Apr/2026:09:00:21 +0000] "GET /api/v1/users HTTP/1.1" 401 88 "-" "curl/7.85"',
            '198.51.100.7 - - [10/Apr/2026:09:00:34 +0000] "GET /dashboard HTTP/1.1" 500 0 "-" "Mozilla/5.0"',
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "text_match",
        weight: 1,
        promptMd: "How many distinct client IPs appear in the log?",
        textMatch: { acceptableAnswers: ["3", "three"] },
        expected: { type: "text_match", acceptableAnswers: ["3", "three"], regex: false },
        debriefMd:
          "Three: `198.51.100.7`, `203.0.113.42`, `192.0.2.18`. Counting is a basic grep-and-sort move (`cut -d' ' -f1 access.log | sort -u | wc -l`).",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "Which client IP looks like it's probing for admin / API endpoints with a non-browser user-agent? (Just the IP.)",
        textMatch: { acceptableAnswers: ["203.0.113.42"] },
        expected: { type: "text_match", acceptableAnswers: ["203.0.113.42"], regex: false },
        debriefMd:
          "`203.0.113.42`. Four requests from that IP, all `401`s, all `curl/7.85`, all targeting `/admin*` or `/api/*`. That's the recognizable shape of a scripted probe — not somebody using a browser.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which line records the server explicitly admitting an internal failure?",
        options: [
          { id: "favicon-404", label: "The `favicon.ico` line with status 404." },
          { id: "dashboard-500", label: "The `GET /dashboard` line with status 500." },
          { id: "admin-401s", label: "The `GET /admin*` lines with status 401." },
          { id: "none", label: "None — there's no server failure in this excerpt." },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["dashboard-500"], allowMultiple: false },
        debriefMd:
          "`500 Internal Server Error` is the server saying *I broke*. `4xx` codes (404, 401, 403) blame the client request. The `/dashboard` 500 is worth investigating separately from the probing pattern — different failure mode, different root cause.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that `203.0.113.42` is malicious based ONLY on this log excerpt.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "Moderate. The pattern is *consistent with* hostile reconnaissance — but a partner who's running a sanctioned vulnerability scan, an internal monitoring tool, or a misconfigured CI job could show the same fingerprint. Pivot on the IP (whois, internal ownership records, threat-intel feeds) before drawing a conclusion.",
      },
    ],
  },

  // ─── 7. Hex dump reading ─────────────────────────────────
  {
    slug: "hex-dump-reading-basics-001",
    title: "Reading a Hex Dump",
    summary:
      "Hex dumps look intimidating but they're easy once you know the columns. Find the bytes you need.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 7,
    tags: ["beginner", "dfir", "hex"],
    lane: "foundations",
    module: "Integrity & identification",
    sequence: 3,
    brief: `
# Brief

You've been handed a hex dump from \`xxd\`. Three columns:

1. **Offset** — byte position from the start of the file, in hex.
2. **Bytes** — 16 bytes per row, in hex (each byte is two hex
   digits).
3. **ASCII** — those same 16 bytes printed as text, with
   non-printable bytes shown as \`.\`.

\`\`\`
00000000: 48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21 0a 00 00   Hello, world!...
\`\`\`

Above, offset 0 is the byte \`48\` (which is \`H\`); offset 7 is
\`77\` (\`w\`); the \`0a\` near the end is a newline.

Practice on the artifact.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "dump.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ xxd suspicious.bin",
            "00000000: 4d 5a 90 00 03 00 00 00 04 00 00 00 ff ff 00 00   MZ..............",
            "00000010: b8 00 00 00 00 00 00 00 40 00 00 00 00 00 00 00   ........@.......",
            "00000020: 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   ................",
            "00000030: 00 00 00 00 00 00 00 00 00 00 00 00 80 00 00 00   ................",
            "00000040: 0e 1f ba 0e 00 b4 09 cd 21 b8 01 4c cd 21 54 68   ........!..L.!Th",
            "00000050: 69 73 20 70 72 6f 67 72 61 6d 20 63 61 6e 6e 6f   is program canno",
            "00000060: 74 20 62 65 20 72 75 6e 20 69 6e 20 44 4f 53 20   t be run in DOS ",
            "00000070: 6d 6f 64 65 2e 24 00 00                           mode.$..",
            "",
          ].join("\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "text_match",
        weight: 1,
        promptMd:
          "What are the first two bytes of the file, in hex? (Just the two bytes, space-separated.)",
        textMatch: { acceptableAnswers: ["4d 5a", "4d5a", "MZ", "mz", "4d 5a "] },
        expected: {
          type: "text_match",
          acceptableAnswers: ["4d 5a", "4d5a", "MZ", "mz", "4d 5a "],
          regex: false,
        },
        debriefMd:
          "`4d 5a`. That spells `MZ` in ASCII — the magic-bytes signature of a Windows PE executable (.exe, .dll). The name comes from Mark Zbikowski, the Microsoft engineer who designed the format.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd: "What kind of file is this?",
        options: [
          { id: "pe", label: "A Windows PE executable (.exe / .dll)" },
          { id: "elf", label: "A Linux ELF binary" },
          { id: "macho", label: "A macOS Mach-O binary" },
          { id: "text", label: "A plain text file" },
        ],
        allowMultiple: false,
        expected: { type: "multi_choice", correctIds: ["pe"], allowMultiple: false },
        debriefMd:
          "PE. Beyond the `MZ` magic, the embedded ASCII string *\"This program cannot be run in DOS mode.\"* in the DOS stub is the giveaway every PE file carries — a relic of MS-DOS compatibility from the early 1990s.",
      },
      {
        ordinal: 3,
        type: "text_match",
        weight: 1,
        promptMd:
          "At what offset (in hex, e.g. `0x00000040`) does the ASCII text \"This program cannot be run in DOS mode.\" begin?",
        textMatch: {
          acceptableAnswers: ["0x4e", "4e", "0x0000004e", "0000004e"],
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["0x4e", "4e", "0x0000004e", "0000004e"],
          regex: false,
        },
        debriefMd:
          "`0x4e` (78 decimal). The row at offset `0x40` shows `... 54 68` at the last two byte positions of the row, and the next row begins with `69 73 20 70 72 6f 67 72 61 6d` (`is program`). So `T` at position `0x4e`, `h` at `0x4f`, then `is program…` continues on the next row. Counting bytes in dumps takes a couple of tries; do it on paper before trusting your eye.",
      },
    ],
  },

  // ─── 8. Chain of custody ─────────────────────────────────
  {
    slug: "chain-of-custody-basics-001",
    title: "Chain of Custody: Read a Training Extract",
    summary:
      "A custody-document training extract for a USB drive across three transfers. Identify the documentation gaps and the language that needs to change.",
    skillAreas: ["report_writing", "inference_discipline", "df_artifacts"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["beginner", "chain_of_custody", "army_ci", "report_writing", "inference_discipline"],
    lane: "evidence_handling",
    module: "Custody documents",
    sequence: 1,
    brief: `
# Brief

A USB drive collected from a workspace incident has reached an
ACI evidence room. The accompanying custody-document extract is
in the artifact. The drive moved through three hands before lab
intake.

Your job: read the extract, identify the documentation gaps, and
flag any language that should be rewritten before the document
is referenced in a downstream report.

> This is a **training extract**, not an official form. Appointed
> evidence custodians follow the full DA Form 4137 + AR 195-5
> requirements and unit SOP; the goal of this exercise is to
> exercise the reviewer's eye, not to train form completion.

## What a good custody-document extract should show

- **Date / time** of each transfer.
- **Released by** — name + signature of the releasing person.
- **Received by** — name + signature of the *person* assuming
  responsibility. A storage location or container is not a person.
- **Purpose** of the change of custody.

The item description should be **factual and observational** —
what the item is, not what the analyst suspects it was used for.
A speculative description on a custody document is a wording
problem that ripples into every downstream filing.

## What a "gap" looks like

Any period the document can't answer "who had this, and where
was it?" with a named, attested person is a gap. Storage-locker
entries, keycard logs, and door swipes are *corroborating*
artifacts; they don't replace a custodian's signature, and any
gap should be explained in a separate memorandum attached to
the document.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "custody-extract.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "  TRAINING EXTRACT — NOT AN OFFICIAL FORM",
            "  DA FORM 4137-STYLE EVIDENCE/PROPERTY CUSTODY DOCUMENT",
            "  FICTIONAL DATA",
            "  =============================================================",
            "",
            "  +----------------------------------------------------------+",
            "  | Receiving Activity   | 1st MI Bn (CI), ACI Evidence Room |",
            "  | Location             | Station 7                          |",
            "  | Document Number      | 4137-2026-114-A                    |",
            "  | Case / RFA Reference | 2026-114                           |",
            "  | Received From        | M. RIVERA (collecting agent)       |",
            "  +----------------------------------------------------------+",
            "",
            "  ITEM 1",
            "  +----------------------------------------------------------+",
            "  | Item Number           | 1                                 |",
            "  | Quantity              | 1                                 |",
            "  | Description of        | USB mass-storage device used by   |",
            "  |   Articles            | the suspect to remove sensitive   |",
            "  |                       | files from the workspace.         |",
            "  |                       | Black plastic housing, exFAT, no  |",
            "  |                       | external label. VID/PID 0x0951/   |",
            "  |                       | 0x1666; SN AA-EXAMPLE-001.        |",
            "  | Tag / Seal            | DA Form 4002 tag #B-441 affixed   |",
            "  |                       | to sealed evidence bag #B-441;    |",
            "  |                       | bag initials \"M.R.\" across seal   |",
            "  |                       | on three sides.                   |",
            "  +----------------------------------------------------------+",
            "",
            "  CHAIN OF CUSTODY",
            "  +----------------------------------------------------------+",
            "  | Transfer 1                                                |",
            "  |   Date / Time     2026-05-02 14:00 UTC                    |",
            "  |   Released By     M. RIVERA                               |",
            "  |   Signature       /signed/  M. RIVERA                     |",
            "  |   Received By     SSG J. PARK                             |",
            "  |   Signature       /signed/  J. PARK                       |",
            "  |   Purpose         Collection at scene, transport          |",
            "  +----------------------------------------------------------+",
            "  | Transfer 2                                                |",
            "  |   Date / Time     2026-05-02 18:40 UTC                    |",
            "  |   Released By     SSG J. PARK                             |",
            "  |   Signature       /signed/  J. PARK                       |",
            "  |   Received By     Overnight Locker 2, Station 7           |",
            "  |   Signature       N/A                                     |",
            "  |   Purpose         Secure overnight                        |",
            "  +----------------------------------------------------------+",
            "  | Transfer 3                                                |",
            "  |   Date / Time     2026-05-04 08:55 UTC                    |",
            "  |   Released By     Overnight Locker 2, Station 7           |",
            "  |   Signature       N/A                                     |",
            "  |   Received By     T. OKAFOR (Primary Evidence Custodian)  |",
            "  |   Signature       /signed/  T. OKAFOR                     |",
            "  |   Purpose         Release to lab intake for exam          |",
            "  +----------------------------------------------------------+",
            "",
            "  REMARKS",
            "  +----------------------------------------------------------+",
            "  | Evidence bag #B-441 observed intact on receipt at lab.   |",
            "  | Tag #B-441 verified against this document before signing.|",
            "  +----------------------------------------------------------+",
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
          "Reviewing the extract, which statements about it are accurate?",
        options: [
          {
            id: "locker-not-person",
            label:
              "Transfer 2 records a storage locker as the receiving party and shows N/A for the signature. A locker is not a person assuming responsibility, and the document does not name anyone who did.",
          },
          {
            id: "description-speculative",
            label:
              "The Description of Articles section includes language about how the item was used (\"used by the suspect to remove sensitive files from the workspace\"). A description on a custody document should be factual and observational, not speculative.",
          },
          {
            id: "fully-intact",
            label:
              "The chain is fully intact and the document is ready to support lab examination as-is.",
          },
          {
            id: "seal-broken",
            label:
              "The seal on evidence bag #B-441 was broken at some point during the chain.",
          },
          {
            id: "tag-affixed",
            label:
              "A DA Form 4002 tag (#B-441) is recorded as affixed to the sealed container at the scene.",
          },
          {
            id: "missing-collection",
            label:
              "The collection event itself is missing from the document.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["locker-not-person", "description-speculative", "tag-affixed"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Accurate:**",
          "",
          "- *Locker, not a person* — the Transfer 2 entry shows a storage location in the \"Received By\" field with N/A for the signature. The document doesn't name anyone who assumed responsibility for the overnight period. That's the central gap.",
          "- *Description is speculative* — the Description of Articles section editorialises about how the device was used. A custody document should describe **what the item is** (form factor, identifiers, condition), not what the reviewer suspects about its purpose. Speculative wording on the form bleeds into every downstream filing.",
          "- *Tag affixed* — the Tag / Seal row records DA Form 4002 #B-441 affixed at the scene; that part of the process is correctly documented.",
          "",
          "**Not accurate:**",
          "",
          "- *Fully intact* — Transfer 2 has the named gap.",
          "- *Seal broken* — the Remarks section records the bag as intact and the tag verified at lab intake.",
          "- *Missing collection* — Transfer 1 covers it (M. RIVERA at scene → SSG J. PARK).",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What's the best corrective action for the overnight-storage gap before this extract is referenced in a downstream report?",
        options: [
          {
            id: "doc-the-gap",
            label:
              "Attach a separate Memorandum For Record that names the overnight period, explains why no person signed during it, and references any corroborating artifact (e.g., the locker's door-access log) that helps account for the item during that window.",
          },
          {
            id: "retro-signature",
            label:
              "Have SSG J. PARK retroactively sign as \"Received by\" on Transfer 2 with the locker as the location.",
          },
          {
            id: "evidence-photo",
            label:
              "Take a photograph of the sealed bag now and attach it to the document.",
          },
          {
            id: "lab-supervisor-stmt",
            label:
              "Have the lab supervisor write a statement that the seal looked intact on receipt.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["doc-the-gap"],
          allowMultiple: false,
        },
        debriefMd:
          "The gap is on the face of the document; the corrective action is to **document the gap**, not to paper over it. A Memorandum For Record that names the overnight period, explains the storage arrangement, and references any corroborating artifact (door-access log, locker procedure) is the disciplined response. A *retroactive* signature is worse than no signature: SSG J. PARK can only attest to what they personally observed, and they didn't observe the locker overnight. A photograph at intake and a lab-supervisor statement say nothing about the unattested window.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which rewrite of the Description of Articles is appropriately factual and observational?",
        options: [
          {
            id: "rewrite-factual",
            label:
              "\"USB mass-storage device, black plastic housing, no external label, exFAT filesystem, VID/PID 0x0951/0x1666, SN AA-EXAMPLE-001. Recovered from a workspace per the collection narrative.\"",
          },
          {
            id: "rewrite-still-speculative",
            label:
              "\"USB mass-storage device suspected of containing classified material exfiltrated by the user.\"",
          },
          {
            id: "rewrite-too-thin",
            label:
              "\"USB drive.\"",
          },
          {
            id: "rewrite-conclusion",
            label:
              "\"USB mass-storage device used in an unauthorized disclosure.\"",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["rewrite-factual"],
          allowMultiple: false,
        },
        debriefMd:
          "A custody-document description should let any reviewer recognise the item from form factor + identifiers without quoting the case theory. The factual rewrite gives what the item is (mass-storage device), how to recognise it (housing, label, filesystem), and how to disambiguate it from any other similar device (VID/PID + SN). The other three either retain a finding (\"suspected of containing classified material,\" \"used in an unauthorized disclosure\") or strip out everything that lets a reviewer match the item to the document (\"USB drive\").",
      },
      {
        ordinal: 4,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What does this chain-of-custody excerpt actually establish?",
        options: [
          {
            id: "physical-movement",
            label:
              "That the physical item moved from scene → transport → overnight storage → lab intake, with an accountability gap during the overnight-storage period and an intact seal at every recorded handoff.",
          },
          {
            id: "what-is-on-the-usb",
            label:
              "What files or content are on the USB drive.",
          },
          {
            id: "who-put-files-on-it",
            label:
              "Who placed files on the USB drive, and when.",
          },
          {
            id: "user-intent",
            label:
              "That the user intended to use the device to remove material from the workspace.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["physical-movement"],
          allowMultiple: false,
        },
        debriefMd:
          "A chain-of-custody section establishes the **physical movement** of the item — who had it, where, and when — plus the integrity of the container at each handoff. It says nothing about the **contents** of the device or about the **intent** of any person involved. Contents come from a separate forensic examination; intent comes from interviews and other evidence. Conflating these is one of the most common reviewer mistakes; flagging it early prevents an over-claim downstream.",
      },
      {
        ordinal: 5,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the extract, AS-IS (gap undocumented and speculative description unchanged), is ready to be referenced in a downstream investigation report.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "**Low.** Two attested handoffs, an intact seal, and tag verification at intake mean the chain isn't fatally broken — but the overnight-storage gap is on the face of the document, and the speculative description bakes a case theory into a place that should be observational. Both issues are cheap to fix (an MFR for the gap, a descriptive rewrite of the item line) and definitively close the question; complete them before the extract is referenced anywhere downstream.",
      },
    ],
  },
];
