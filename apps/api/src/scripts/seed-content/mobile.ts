import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Mobile-forensics family. These scenarios exercise the toolbox a
// modern mobile examiner actually uses — Cellebrite UFED + UFED
// PA, Magnet GRAYKEY, Magnet AXIOM — and the discipline of reading
// *what the extraction actually got* vs *what the case agent asked
// for*. The technical facts on extraction state (BFU/AFU/FFS),
// extraction type (logical / advanced logical / file system /
// physical), and multi-tool verification are the same on real cases
// as in this catalogue; the chassis numbers, IMEIs, examiner names,
// and case requests are sanitized and fictional.

export const MOBILE_FORENSICS_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. Cellebrite extraction-type triage ───────────────────
  {
    slug: "mobile-cellebrite-extraction-type-001",
    title: "Cellebrite Extraction Types: What Did You Actually Get?",
    summary:
      "An iPhone came back from the lab as an Advanced Logical Cellebrite extraction. The case agent asked for deleted Signal messages. Read the extraction summary and decide what the artifact set can and cannot answer.",
    skillAreas: ["df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 20,
    tags: ["mobile", "cellebrite", "ufed", "extraction_type", "inference_discipline"],
    lane: "mobile_forensics",
    module: "Extraction triage",
    sequence: 1,
    brief: `
# Brief

An iPhone was seized at a CONUS checkpoint, packaged on
**DA Form 4137 #4137-2026-141-A**, and walked to the supporting
digital-forensics lab the same day. The lab returned a Cellebrite
\`.ufd\` package this morning. The case agent's request, attached
to the package, reads:

> *"Pull the deleted Signal messages and any photos opened in the
> last 24 hours before seizure. Need it for the Friday brief."*

You open the package in UFED Physical Analyzer and look at the
**Extraction summary** before touching the data. The extraction
method is **Advanced Logical (iOS)** — not full file system, not
physical. That single field decides most of what you can honestly
claim from this image; reading the summary header first is the
discipline.

> **Why extraction type matters.** Cellebrite UFED supports
> several acquisition methods, each yielding a different breadth
> of data:
>
> - **Logical** — what the device's normal backup/sync APIs hand
>   over. Mostly *active* user-visible data (contacts, SMS, call
>   logs); typically does **not** include third-party app sandbox
>   databases, deleted records, the keychain, or system-level
>   pattern-of-life artifacts.
> - **Advanced Logical** — adds a richer dataset by walking iOS
>   backup mechanisms more aggressively; closer to a full iTunes
>   backup. Still does **not** include the full file system or
>   the keychain. Some app sandbox data lands, some does not.
> - **File System / Full File System (FFS)** — the on-device
>   userland filesystem. Includes app sandboxes (Signal,
>   WhatsApp, Telegram message DBs), pattern-of-life
>   (\`knowledgeC.db\`, biome stores), the keychain (with the
>   right unlock state), and most artifacts a forensic examiner
>   wants.
> - **Physical** — the whole NAND image, including unallocated.
>   On modern iOS this is rare to impossible without an
>   exploit-capable acquisition path (e.g. checkm8-class).

This is a routing-first exercise. The exercise is *not* "do the
deleted-Signal carve" — the artifacts can't support it. The
exercise is to read the summary, write back to the case agent
honestly, and name the next acquisition step that would actually
satisfy the ask.

## Artifacts

- **extraction-summary.txt** — the Cellebrite Extraction
  summary header for the \`.ufd\` package: device identity,
  examiner, method, integrity hashes.
- **data-inventory.csv** — the artifact categories UFED PA
  surfaced from this extraction, with row counts.
- **case-request.txt** — the case agent's verbatim ask.
- **iphone-extraction-matrix.txt** — short reference table
  of what each Cellebrite extraction type typically contains
  on a modern iPhone.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "extraction-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "================================================================",
            "                UFED Reader  —  Extraction Report",
            "================================================================",
            "",
            "Case Information",
            "----------------",
            "  Case number              : CASE-2026-141",
            "  Case name                : (not set)",
            "  Evidence number          : EVID-141-A",
            "  Department               : Digital Forensics Lab",
            "  Investigator             : SSG D. Olabode, CFCE (CCO)",
            "  Examiner username        : olabode_d",
            "",
            "Device Information",
            "------------------",
            "  Device name              : iPhone",
            "  Vendor                   : Apple Inc.",
            "  Model                    : iPhone 14 Pro",
            "  Model identifier         : iPhone15,2",
            "  Hardware model           : A2890",
            "  OS Version               : iOS 17.6.1 (21G93)",
            "  IMEI                     : 35-900000-xxxxxx-x  (last six redacted)",
            "  Serial                   : C7PXXXXXXXX        (last six redacted)",
            "  ICCID                    : 89014103xxxxxxxxxxxx",
            "  MSISDN                   : (not extracted)",
            "  Wi-Fi MAC address        : (requires File System extraction)",
            "  Bluetooth MAC            : (requires File System extraction)",
            "  Time zone (device)       : America/Los_Angeles (PDT, UTC-07:00)",
            "  Activation state         : Activated",
            "  Activation Lock          : Enabled (FMI on)",
            "",
            "Extraction Information",
            "----------------------",
            "  Extraction type          : Advanced Logical",
            "  Extraction method        : iPhone Backup",
            "  UFED version             : 7.74.0.215",
            "  Physical Analyzer version: 7.74.0.215",
            "  Start time               : 2026-09-12 07:18:22 (UTC-07:00)",
            "  End time                 : 2026-09-12 07:42:18 (UTC-07:00)",
            "  Duration                 : 00:23:56",
            "  Source path              : C:\\Cases\\2026\\141\\",
            "  Project file             : CASE-2026-141.ufdx",
            "  Image file               : CASE-2026-141.ufd",
            "  Image size               : 5,684,231,168 bytes (5.29 GB)",
            "",
            "Hash Information",
            "----------------",
            "  Acquisition hash (MD5)   : e3b0c44298fc1c149afbf4c8996fb924",
            "  Acquisition hash (SHA-256): 8f7c4b1d8e2f93a6e0b3c5d4a7f1e9b2",
            "                              c8d6a0f4e3b1c2d5e7a8f6c4b1d8e94e21",
            "  Verified at              : 2026-09-12 07:42:30 (UTC-07:00)",
            "  Verification status      : PASS",
            "",
            "Notes (auto-generated)",
            "----------------------",
            "  - Advanced Logical (iPhone Backup) extraction completed",
            "    without errors.",
            "  - File System / Full File System extraction NOT attempted",
            "    on this run; chip-off and physical methods not applicable",
            "    to this iOS / hardware combination.",
            "  - Keychain decoding is NOT included in an Advanced Logical",
            "    of iOS 17.x; the keychain requires a File System or",
            "    GRAYKEY pathway.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "data-inventory.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          // Cellebrite Physical Analyzer 7.74 — "Analyzed Data
          // Summary" report exported to CSV from the Reports menu.
          // The "Status" column is PA's standard verdict per
          // category (Present / Empty / Not Applicable). "Notes"
          // is the report's free-text annotation field, populated
          // by PA when the category was skipped because of the
          // chosen extraction method.
          [
            "Category,Status,ItemCount,Notes",
            "Contacts,Present,438,",
            "Call Log,Present,1207,Includes FaceTime audio + video entries",
            "SMS / iMessage,Present,5611,Active threads only; deleted iMessages not exposed by Advanced Logical on iOS 17",
            "Photos & Videos (Camera Roll),Present,2104,Active media only; \"Recently Deleted\" album not parsed by Advanced Logical",
            "Notes (Apple),Present,89,Active notes only",
            "Voice Memos,Present,12,",
            "Calendar,Present,322,",
            "Safari History,Present,4188,Active history only",
            "Wi-Fi Networks,Partial,32,SSIDs present; pre-shared keys live in the keychain and were not extracted",
            "Keychain Entries,Empty,0,Keychain decoding requires File System / FFS extraction or GRAYKEY",
            "Signal — Active Messages,Empty,0,Signal sandbox database not exposed by Advanced Logical on iOS 17",
            "Signal — Deleted Messages,Empty,0,Requires FFS + decoding of Signal's SQLite WAL / journal",
            "WhatsApp Messages,Empty,0,Sandbox database not exposed by Advanced Logical",
            "knowledgeC.db / Biome (pattern of life),Empty,0,Requires File System / FFS extraction",
            "Powerlog (CurrentPowerlog.PLSQL),Empty,0,Requires File System / FFS extraction",
            "Unallocated / Deleted-File Carving,Not Applicable,0,No physical image available on modern iOS",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "case-request.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Case-agent request (attached to evidence package, verbatim)",
            "-----------------------------------------------------------",
            "",
            "From: SA J. Vasquez",
            "Date: 2026-09-12",
            "",
            "Please pull the deleted Signal messages and any photos",
            "opened in the last 24 hours before seizure. Need it for the",
            "Friday brief. Also if you can confirm the device was paired",
            "with the suspect's car Bluetooth, that would help.",
            "",
            "Thanks.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "iphone-extraction-matrix.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "What each Cellebrite iPhone extraction type typically yields",
            "------------------------------------------------------------",
            "",
            "Logical",
            "  Backup-API surface only. Active SMS, contacts, call log,",
            "  Camera Roll, Safari history, notes. No app sandboxes. No",
            "  keychain. No knowledgeC / powerlog. No deleted records",
            "  beyond what a normal iTunes backup would contain.",
            "",
            "Advanced Logical",
            "  Backup-API surface walked more aggressively, plus iTunes-",
            "  -backup-equivalent data. Adds some media metadata and some",
            "  app data the regular Logical misses. Still: no third-party",
            "  app sandbox databases (Signal/WhatsApp/Telegram), no",
            "  keychain, no knowledgeC/biome, no powerlog. \"Recently",
            "  Deleted\" album is NOT included for active enumeration.",
            "",
            "File System / Full File System (FFS)",
            "  Userland filesystem walk under \"unlocked\" trust state.",
            "  Contains app sandbox databases, knowledgeC / biome /",
            "  powerlog, the keychain (when the unlock state permits),",
            "  bundle install records. This is where most useful",
            "  third-party-app, pattern-of-life, and pairing/Bluetooth",
            "  artifacts live on modern iOS.",
            "",
            "Physical",
            "  Whole-NAND image including unallocated. Rare on modern",
            "  iOS; requires exploit-capable acquisition (checkm8-class",
            "  for older A-series, or vendor-specific pathways).",
            "",
            "Pathways to FFS / keychain on modern iOS",
            "  - Cellebrite UFED FFS (where the device/iOS combo allows",
            "    it; not universally supported).",
            "  - Magnet GRAYKEY, when applicable, in BFU/AFU/FFS modes",
            "    (separate scenario covers BFU/AFU triage).",
            "  - iCloud backup via warrant + Apple's process — different",
            "    legal pathway, different evidence scope.",
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
          "Which statements about this extraction are **facts** at the point of triage?",
        options: [
          {
            id: "method-is-adv-logical",
            label:
              "The acquisition method recorded for this image is Cellebrite Advanced Logical (iOS), not File System or Physical.",
          },
          {
            id: "deleted-signal-available",
            label:
              "Deleted Signal messages are recoverable from this image with the right decoder.",
          },
          {
            id: "active-imessage-yes",
            label:
              "Active iMessage / SMS threads ARE present and parseable from this image.",
          },
          {
            id: "keychain-recoverable",
            label:
              "The device's keychain (passwords, app tokens, Wi-Fi pre-shared keys) is recoverable from this image.",
          },
          {
            id: "extraction-is-broken",
            label:
              "The extraction failed or is corrupted — that's why Signal is absent.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["method-is-adv-logical", "active-imessage-yes"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The extraction summary explicitly records method = Advanced Logical (iOS). That's a metadata field, not an inference.",
          "- 5,611 active iMessage / SMS rows are present per the inventory.",
          "",
          "**Not fact:**",
          "",
          "- *Deleted Signal* — Signal's sandbox database isn't exposed by an Advanced Logical on iOS 17 at all (active OR deleted). The agent's ask cannot be answered from this image. \"Deleted records exist somewhere in the device\" is true; \"they're in this artifact set\" is not.",
          "- *Keychain* — the summary's own auto-generated note says keychain decoding requires FFS or GRAYKEY. The keychain holds Wi-Fi PSKs, app tokens, etc.",
          "- *Extraction failed* — the integrity hashes verified at completion and the inventory counts are consistent with a clean Advanced Logical. It didn't fail; it just doesn't include what the agent asked for. Misdiagnosing the absence as a tool failure leads to wasted re-extractions.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What does the extraction summary record as the **acquisition method** for this image?",
        options: [
          { id: "logical", label: "Cellebrite Logical (the lightest tier)." },
          { id: "advanced-logical", label: "Cellebrite Advanced Logical (iOS)." },
          { id: "ffs", label: "Cellebrite File System (FFS)." },
          { id: "physical", label: "Cellebrite Physical (NAND chip-off)." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["advanced-logical"],
          allowMultiple: false,
        },
        debriefMd:
          "**Advanced Logical (iOS).** The `Extraction type:` field in the summary header names it. That single field decides most of what you can honestly claim from this image — Advanced Logical does not expose third-party app sandboxes, the keychain, or filesystem-level pattern-of-life stores.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the data-inventory CSV, what does the **Signal-messages row** tell you about the deleted-Signal-messages part of the case agent's request?",
        options: [
          {
            id: "active-yes-deleted-needs-carver",
            label:
              "Several thousand active Signal messages are present; deleted Signal requires a SQLite-WAL carver against the recovered DB.",
          },
          {
            id: "zero-zero-not-answerable",
            label:
              "Zero — the Signal sandbox database is not exposed by an Advanced Logical extraction on iOS 17 at all (active OR deleted), so the deleted-Signal request cannot be answered from this image.",
          },
          {
            id: "zero-active-deleted-yes",
            label:
              "Zero active, several deleted — Advanced Logical surfaces only the deleted Signal messages on iOS 17.",
          },
          {
            id: "not-installed",
            label:
              "The Signal row is absent because Signal isn't installed on this device.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["zero-zero-not-answerable"],
          allowMultiple: false,
        },
        debriefMd:
          "**Zero / zero / not answerable.** The inventory shows `Signal messages (active): 0` and `Signal messages (deleted): 0`, with the explicit note that the Signal sandbox is not exposed by an Advanced Logical on iOS 17. There is no Signal `messages.db` in this artifact set at all — no carve is possible from data that wasn't acquired. \"Signal isn't installed\" would require positive evidence (e.g. no bundle install record) that this image type doesn't carry.",
      },
      {
        ordinal: 4,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the data-inventory CSV, what is the status of **(a) deleted iMessages** and **(b) photos in the 'Recently Deleted' album** in this image?",
        options: [
          {
            id: "both-recovered",
            label:
              "Both fully recovered — an Advanced Logical extraction exposes both deleted iMessages and the Recently-Deleted album.",
          },
          {
            id: "imessages-yes-photos-no",
            label:
              "Deleted iMessages recovered; Recently-Deleted photos require a separate Photos parser.",
          },
          {
            id: "photos-yes-imessages-no",
            label:
              "Recently-Deleted photos recovered; deleted iMessages require FFS.",
          },
          {
            id: "both-absent",
            label:
              "Both absent — Advanced Logical surfaces active iMessages and the active Camera Roll only; deleted content of either type requires the FFS pathway on iOS 17.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["both-absent"],
          allowMultiple: false,
        },
        debriefMd:
          "**Both absent.** The inventory's notes are explicit: *\"deleted iMessages not recovered from this extraction type\"* and *\"'Recently Deleted' album not parsed by Advanced Logical.\"* The pattern is the same — Advanced Logical surfaces *active* content but does not surface the deleted/journaled records on iOS 17. The 5,611 active iMessage rows is what you *can* claim; the deleted material is what needs the FFS pathway.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which next step would most **directly satisfy the deleted-Signal-messages part of the case agent's request**?",
        options: [
          {
            id: "re-extract-ffs",
            label:
              "Coordinate a File System (FFS) re-extraction — via UFED FFS where supported, or via Magnet GRAYKEY — and parse the Signal sandbox `messages.db` (including SQLite WAL / journal for deleted-row recovery) from the FFS image.",
          },
          {
            id: "re-run-advanced-logical",
            label:
              "Re-run the same Advanced Logical extraction — maybe the parser missed Signal the first time.",
          },
          {
            id: "manually-grep-ufd",
            label:
              "Open the `.ufd` in a hex editor and grep for the string \"Signal\" to surface the deleted messages.",
          },
          {
            id: "pivot-icloud-warrant",
            label:
              "Pivot to an iCloud / Apple-process warrant if the user had Signal on a paired iCloud device — different legal pathway, different evidence scope; raise with the case agent and the supporting legal advisor.",
          },
          {
            id: "tell-agent-not-possible",
            label:
              "Write back to the case agent: this image type cannot answer the Signal-deleted question; name the FFS / GRAYKEY pathway that can, and ask whether the device is available for re-acquisition.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["re-extract-ffs", "tell-agent-not-possible"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right moves:**",
          "",
          "- FFS re-extraction puts the Signal sandbox database in scope. Signal's message store is a SQLite DB; deleted rows often persist in the WAL / journal until the DB is vacuumed, and dedicated forensic Signal parsers (in AXIOM, UFED PA, and others) handle this.",
          "- Telling the agent the truth — *this extraction type cannot answer the question, here's the pathway that can* — preserves credibility and routes the work. The pivot-to-iCloud option is worth raising as a secondary path if device re-acquisition is blocked.",
          "",
          "**Wrong:**",
          "",
          "- *Re-running the same extraction* — it's the same tool tier; the result will be the same. The absence is structural, not transient.",
          "- *Grepping the `.ufd`* — `.ufd` is a Cellebrite project file with a manifest pointing to extracted artifacts; even where strings exist, they're already in the parsed categories. A grep won't conjure data the extraction never collected from the device.",
        ].join("\n"),
      },
      {
        ordinal: 6,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the deleted-Signal-messages part of the agent's request can be answered from THIS image alone.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The image is an Advanced Logical; Signal's sandbox database is not exposed by that extraction type on iOS 17 (active *or* deleted). A defensible response to the agent names the image type, names the artifact gap (Signal sandbox + keychain + knowledgeC), names the FFS / GRAYKEY pathway that would close the gap, and recommends a re-acquisition decision rather than promising what the image cannot deliver.\n\n**Owners.** The lab's chief examiner owns the re-acquisition decision; the case agent + supporting legal advisor own the warrant scope if an iCloud pivot is pursued. The unit ISSM is not in this workflow unless DODIN-Army data was on the device.",
      },
    ],
  },

  // ─── 2. GRAYKEY BFU vs AFU triage ────────────────────────────
  {
    slug: "mobile-graykey-bfu-afu-001",
    title: "GRAYKEY: Triage a BFU Extraction",
    summary:
      "An iPhone seized at arrest arrived at the lab powered off. GRAYKEY returned a BFU image. The supporting ACI office wants Notes from the keychain and Apple Maps history. Decide what BFU does and does not yield.",
    skillAreas: ["df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["mobile", "graykey", "bfu", "afu", "ios", "inference_discipline"],
    lane: "mobile_forensics",
    module: "Acquisition state",
    sequence: 1,
    brief: `
# Brief

An iPhone was seized at arrest, **powered off at the scene**,
and walked to the lab in a Faraday bag without ever being
turned back on. GRAYKEY produced an image overnight; the device
is still in its **Before First Unlock (BFU)** state — no
passcode has been entered since the most recent boot.

The supporting ACI office has asked, via a memo attached to the
work order:

> *"Pull the Apple Notes (including anything in the secure /
> locked notes), the Apple Maps history for the past 30 days,
> and any Bluetooth pairings recorded on the device. Need it
> for the Thursday joint brief."*

Your job is to read the GRAYKEY status, understand what the BFU
state structurally permits, and decide which parts of the ask
can be answered from THIS image vs require either an AFU pivot,
a successful passcode, or a different acquisition pathway.

> **Why acquisition state matters on iOS.** Apple's Data
> Protection class system encrypts most user content with keys
> derived from the passcode + hardware Secure Enclave secrets.
> The encryption keys for most content are only available once
> the device has been unlocked at least once since boot:
>
> - **BFU (Before First Unlock)** — device has been booted but
>   not yet unlocked. Only Data Protection class \`NSFileProtectionNone\`
>   content is decrypted; most app data, most messages, most
>   media, most pattern-of-life data, and the bulk of the
>   keychain remain encrypted on disk.
> - **AFU (After First Unlock)** — device was unlocked at least
>   once since boot. The First-Unlock-Available class keys are
>   resident in memory; the keychain is largely unlocked; most
>   user data is readable.
> - **Full File System (FFS)** — the on-device userland,
>   captured with the trust state needed to decrypt it. Most
>   forensic value lives here.
>
> GRAYKEY can produce a BFU image (limited data, even before any
> passcode brute-force succeeds), or an AFU image (most data
> readable while the device is in AFU), or a FFS image once the
> passcode is known or recovered. The image you have is BFU.

This is, like the Cellebrite scenario, a routing-first exercise.
The exercise is to read what BFU yields, write back to the ACI
office honestly, and name the next acquisition step.

## Artifacts

- **graykey-status.txt** — the GRAYKEY console / status output
  for this device.
- **bfu-image-inventory.txt** — categories present in the BFU
  image as parsed downstream.
- **case-request.txt** — the ACI office's verbatim ask.
- **bfu-afu-reference.txt** — short reference card on what
  BFU, AFU, and FFS image states typically yield.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "graykey-status.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Magnet GRAYKEY  —  session log",
            "session-id: GK-2026-09-187",
            "harness:    GK-LAB-01",
            "operator:   MSG R. Pickering, EnCE (rpickering)",
            "",
            "[2026-09-12 22:11:04Z] graykey-server  device connected on lightning port 0",
            "[2026-09-12 22:11:05Z] graykey-server  fingerprint -> Apple iPhone 13 (A2482), iPhone14,5",
            "[2026-09-12 22:11:05Z] graykey-server  baseband -> 4.04.04, secure-enclave -> A15",
            "[2026-09-12 22:11:06Z] graykey-server  intake power-state -> OFF (sealed Faraday bag, DA-4137 #4137-2026-148-B)",
            "[2026-09-12 22:11:06Z] graykey-server  boot sequence initiated via internal harness",
            "[2026-09-12 22:11:42Z] graykey-server  boot complete  os=iOS 17.5.1 build=21F90",
            "[2026-09-12 22:11:43Z] graykey-server  trust-state -> BFU",
            "[2026-09-12 22:11:44Z] graykey-server  session opened by rpickering",
            "[2026-09-12 22:12:01Z] graykey-server  acquisition profile -> ios-17x-bfu",
            "[2026-09-12 22:14:20Z] graykey-acq     BFU image acquisition START",
            "[2026-09-13 06:38:11Z] graykey-acq     BFU image acquisition COMPLETE  bytes=6,656,901,120",
            "[2026-09-13 06:38:15Z] graykey-acq     SHA-256 over image computed -> 9d124ab8e7c1...c84a",
            "[2026-09-13 06:38:18Z] graykey-acq     BFU brute-force passcode attack queued on harness GK-LAB-02",
            "[2026-09-13 06:38:25Z] graykey-acq       passcode-space=6-digit  BFU-rate=~10 min/attempt  status=running",
            "[2026-09-13 06:42:17Z] graykey-server  image written -> /evidence/2026/148/GK-BFU-148B.tar",
            "[2026-09-13 06:42:18Z] graykey-server  session closed by rpickering",
            "",
            "================================================================",
            "Session summary",
            "================================================================",
            "  image-type:           BFU",
            "  AFU-image-produced:   NO   (requires successful unlock OR stable",
            "                              AFU state at acquisition time)",
            "  FFS-image-produced:   NO   (requires passcode + AFU)",
            "  passcode-recovered:   NO   (brute-force queued on GK-LAB-02; not",
            "                              exhausted in session window)",
            "  output-path:          /evidence/2026/148/GK-BFU-148B.tar",
            "  output-size:          6,656,901,120 bytes (6.20 GiB)",
            "  output-sha256:        9d124ab8e7c1...c84a",
            "",
            "Operator note (free-form, end of session)",
            "----------------------------------------",
            "  \"BFU image captured cleanly. Brute-force left running on the",
            "   GK-LAB-02 harness; will produce AFU+FFS if/when passcode",
            "   succeeds. No indication so far. Device remains in Faraday-",
            "   bagged secure storage with chain-of-custody intact.\"",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "bfu-image-inventory.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Magnet AXIOM Examine 8.4  |  Evidence summary",
            "  Image:   /evidence/2026/148/GK-BFU-148B.tar  (GRAYKEY BFU)",
            "  Loaded:  2026-09-13 09:14:22 UTC by olabode_d",
            "  Decryption profile: iOS BFU (Data Protection class None only)",
            "",
            "[+] Devices",
            "  [-] Apple iPhone 13 (iPhone14,5)  /  iOS 17.5.1 (21F90)",
            "      Encrypted-blob volume:  4.81 GiB  (DP keys not derivable",
            "                                          in current trust state)",
            "      Readable surface:       1.39 GiB",
            "",
            "    [-] Decoded artifact categories",
            "        Device identity (model, IMEI, serial, build)  ............ 1 record",
            "        Activation state (activated, FMI on)  .................... 1 record",
            "        Carrier plist (carrier=Verizon, MCC/MNC)  ................ 1 record",
            "        Lock-screen wallpaper (fragments) ........................ 2 image blobs",
            "        System logs (Data-Protection-None subset only) ........... 412 entries",
            "        Bluetooth pairings  ( /Library/Preferences/com.apple.MobileBluetooth.devices.plist )",
            "                                                  ................ 6 paired devices",
            "          - \"Tesla Model 3\"        AC:CF:23:11:8E:90    last seen 2026-09-08",
            "          - \"AirPods Pro 2\"        88:C9:E8:74:3B:AA    last seen 2026-09-11",
            "          - \"WH-1000XM5\"           90:81:58:1F:DD:42    last seen 2026-09-10",
            "          - \"iCar BT\"              7C:64:56:91:0E:B3    last seen 2026-08-22",
            "          - \"Garmin DriveSmart 76\" 00:1B:DC:0F:91:2A    last seen 2026-07-30",
            "          - \"Apple Watch\"          (UUID hidden)        last seen 2026-09-11",
            "",
            "    [-] Categories NOT decoded in BFU trust state",
            "        Apple Notes (Notes.sqlite — Data Protection: AfterFirstUnlock)",
            "        Apple Maps (GeoHistory.mapsdata — DP: CompleteUntilFirstUserAuth)",
            "        Messages.app / SMS (sms.db — DP: AfterFirstUnlock)",
            "        Third-party app sandboxes:",
            "          - WhatsApp (msgstore.db)        DP: AfterFirstUnlock",
            "          - Signal (signal.sqlite)        DP: AfterFirstUnlock",
            "          - Telegram (tdata)              DP: AfterFirstUnlock",
            "          - (banking-app set, redacted)   DP: AfterFirstUnlock",
            "        knowledgeC.db                     DP: AfterFirstUnlock",
            "        biome stores (/var/mobile/Library/Biome)",
            "                                          DP: AfterFirstUnlock",
            "        CurrentPowerlog.PLSQL             DP: AfterFirstUnlock",
            "        Keychain (bulk)                   DP: AfterFirstUnlock",
            "                                          (kSecAttrAccessibleAfterFirstUnlock)",
            "          [ kSecAttrAccessibleAlwaysThisDeviceOnly items would",
            "            be reachable in BFU; modern apps avoid that class. ]",
            "        Camera Roll (post-last-reboot)    Photos per-device-unlock key",
            "",
            "Examiner notes",
            "  - \"Not decoded\" means the on-disk bytes ARE present in the",
            "    image, but the Data Protection keys are not derivable in",
            "    the current BFU trust state. An AFU acquisition under a",
            "    known passcode would yield most of them.",
            "  - The image is NOT broken. BFU is a structural data-protection",
            "    limit, not a tool error.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "case-request.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Memo from the supporting ACI office (extract, verbatim)",
            "-------------------------------------------------------",
            "",
            "To:    Digital Forensics Lab",
            "Date:  2026-09-13",
            "Re:    DA Form 4137 #4137-2026-148-B",
            "",
            "Please extract the following from the seized iPhone for the",
            "Thursday joint brief:",
            "",
            "  1. Apple Notes content, including any \"locked\" / secure",
            "     notes (we are also pursuing the user's iCloud-side via",
            "     a separate process).",
            "",
            "  2. Apple Maps history for the past 30 days.",
            "",
            "  3. Any Bluetooth devices the iPhone has been paired with",
            "     (names + MACs if possible).",
            "",
            "  4. If your image type includes pattern-of-life (knowledgeC",
            "     / biome / powerlog), include a summary for the same",
            "     30-day window.",
            "",
            "Thanks.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "bfu-afu-reference.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "BFU vs AFU vs FFS — what each image type typically yields",
            "---------------------------------------------------------",
            "",
            "BFU (Before First Unlock)",
            "  - Device has been booted but not unlocked since boot.",
            "  - Data Protection class \"None\" content is readable.",
            "  - Bluetooth pairings ARE typically in this class (so the",
            "    radio can come up without unlock).",
            "  - Most user content is NOT readable: Notes, Maps history,",
            "    Messages bodies, third-party app sandboxes, most",
            "    keychain items, knowledgeC / biome / powerlog.",
            "  - BFU brute-force on modern iOS: ~10 min per passcode try",
            "    (heavily rate-limited by the Secure Enclave). A 6-digit",
            "    passcode space is large enough that BFU brute-force is",
            "    not a fast path.",
            "",
            "AFU (After First Unlock)",
            "  - Device has been unlocked at least once since boot; First-",
            "    Unlock keys are resident.",
            "  - The bulk of the keychain is unlocked.",
            "  - Notes, Maps, Messages, most app sandboxes are readable.",
            "  - Practical fast-pivot from a known passcode, OR from an",
            "    AFU acquisition captured BEFORE the device locked /",
            "    powered down.",
            "  - On modern iOS, AFU brute-force (when applicable) is",
            "    much faster than BFU — but the device must remain in",
            "    AFU state for the duration.",
            "",
            "FFS (Full File System)",
            "  - Userland filesystem walk under the unlock trust state.",
            "  - Where most forensic value lives on modern iOS.",
            "  - Requires either a known passcode + AFU OR a successful",
            "    brute-force.",
            "",
            "Pragmatic ladder for a BFU starting position",
            "  1. Preserve the BFU image (you have it; integrity hashed).",
            "  2. Pull what's BFU-readable now (Bluetooth pairings,",
            "     device identity, activation, some logs).",
            "  3. Continue brute-force in the background; do not power",
            "     the device down (losing the brute-force progress and",
            "     boot state).",
            "  4. If the passcode is recoverable from interview or other",
            "     sources, coordinate an AFU + FFS acquisition under that",
            "     passcode immediately.",
            "  5. In parallel, pursue iCloud-side artifacts via warrant",
            "     where the scope and lawfulness permit — different",
            "     evidence, different chain.",
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
          "Which statements about the GRAYKEY image are **facts** as the artifacts present them?",
        options: [
          {
            id: "is-bfu",
            label:
              "The image is in the BFU (Before First Unlock) state.",
          },
          {
            id: "passcode-known",
            label:
              "The device's passcode has been recovered or provided.",
          },
          {
            id: "bluetooth-readable",
            label:
              "Bluetooth pairings are readable from this image despite the BFU state.",
          },
          {
            id: "notes-readable",
            label:
              "Apple Notes content (including secure / locked notes) is readable from this image.",
          },
          {
            id: "tool-failed",
            label:
              "The fact that Notes / Maps / knowledgeC are absent indicates the tool failed during acquisition.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["is-bfu", "bluetooth-readable"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The GRAYKEY status field explicitly records BFU; passcode not recovered.",
          "- Bluetooth pairings are in a Data-Protection-None scope (so the radio works pre-unlock) and ARE readable from a BFU image. The inventory confirms it.",
          "",
          "**Not fact:**",
          "",
          "- *Passcode known* — the status says brute-force is queued and not exhausted; nothing recovered.",
          "- *Notes readable* — Notes content (and the secure-note layer specifically) is locked behind per-note keys derived from unlock state. Not in scope for BFU.",
          "- *Tool failed* — the integrity hash verified at completion and the image opened cleanly. BFU is a structural limit, not a tool error. \"Image didn't yield Notes\" and \"image broke\" are not the same diagnosis.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the GRAYKEY session log, what is the recorded **acquisition state** of the image?",
        options: [
          { id: "afu", label: "AFU (After First Unlock)." },
          { id: "bfu", label: "BFU (Before First Unlock)." },
          { id: "ffs", label: "FFS (Full File System)." },
          { id: "not-recorded", label: "Trust state not recorded in this session." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["bfu"],
          allowMultiple: false,
        },
        debriefMd:
          "**BFU.** The session-summary block lists `image-type: BFU` and the per-line log shows `trust-state -> BFU` immediately after boot, before any unlock. The structural data-protection implications flow from that single field — BFU keeps everything in the `AfterFirstUnlock` (and equivalent) Data Protection classes encrypted on disk, with keys not derivable from the current boot state.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the BFU image inventory, what is the readability of **Apple Notes content** (including the secure / locked notes) from this image?",
        options: [
          {
            id: "fully-readable",
            label:
              "Fully readable — Notes lives in a `DataProtectionNone` scope so it can come up before unlock.",
          },
          {
            id: "not-readable-dp-class",
            label:
              "Not readable — `notes.sqlite` sits in the `AfterFirstUnlock` Data Protection class; per-note Data Protection keys are not derivable in BFU.",
          },
          {
            id: "headers-only",
            label:
              "Note headers readable; bodies encrypted with a per-note passphrase.",
          },
          {
            id: "only-locked-blocked",
            label:
              "Only the locked / secure notes are unreadable; regular notes are fine in BFU.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["not-readable-dp-class"],
          allowMultiple: false,
        },
        debriefMd:
          "**Not readable.** The inventory explicitly lists Notes as `DP: AfterFirstUnlock`. Apple's locked-notes feature double-encrypts the body with a per-note passphrase on top, but the *primary* Data Protection class for the entire `notes.sqlite` is `AfterFirstUnlock` — meaning BFU can't reach either layer. There is no \"headers-only\" middle state on this DB.",
      },
      {
        ordinal: 4,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the BFU image inventory, what is the readability of **Apple Maps search + route history** from this image?",
        options: [
          {
            id: "fully-readable",
            label:
              "Fully readable — Maps history is in a `DataProtectionNone` scope so navigation works before unlock.",
          },
          {
            id: "search-yes-route-no",
            label:
              "Search history readable; route history requires AFU.",
          },
          {
            id: "not-readable-dp-class",
            label:
              "Not readable — `GeoHistory.mapsdata` sits in the `CompleteUntilFirstUserAuth` Data Protection class; keys are not derivable in BFU.",
          },
          {
            id: "icloud-only",
            label:
              "Readable only after iCloud Maps has synced to a paired Mac.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["not-readable-dp-class"],
          allowMultiple: false,
        },
        debriefMd:
          "**Not readable.** The inventory shows `Apple Maps (GeoHistory.mapsdata — DP: CompleteUntilFirstUserAuth)`. The `CompleteUntilFirstUserAuth` class is the modern equivalent of `AfterFirstUnlock` for system-managed databases — same effect in BFU: encrypted on disk, keys not derivable until the first user unlock.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "What is the **right next-steps set** for this case, given the BFU starting position?",
        options: [
          {
            id: "preserve-and-pull-bfu",
            label:
              "Preserve the BFU image (already hashed) and pull the Bluetooth-pairing data now to satisfy part 3 of the ACI request immediately.",
          },
          {
            id: "continue-brute-force",
            label:
              "Continue the BFU brute-force on the second GRAYKEY harness; do NOT power-cycle the device (a reboot loses brute-force progress).",
          },
          {
            id: "interview-for-passcode",
            label:
              "Coordinate with the case agent / supporting ACI office to seek the passcode through interview or lawful order — a successful unlock immediately enables an AFU + FFS acquisition.",
          },
          {
            id: "pursue-icloud-warrant",
            label:
              "In parallel, raise the iCloud-side acquisition path with the supporting legal advisor — Notes and Maps history often have an iCloud-side copy that's a different evidence stream with a different scope.",
          },
          {
            id: "report-bfu-honestly",
            label:
              "Write back to the supporting ACI office naming what's deliverable now (Bluetooth pairings), what's structurally blocked by the BFU state (Notes, Maps, knowledgeC), and the pathways to close the gap — don't promise the Thursday brief what you can't deliver.",
          },
          {
            id: "reboot-and-retry",
            label:
              "Power-cycle the device and re-attempt the acquisition from a fresh boot.",
          },
          {
            id: "carve-encrypted-blobs",
            label:
              "Use a forensic carving tool to recover the Notes content from the encrypted blobs in the BFU image.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "preserve-and-pull-bfu",
            "continue-brute-force",
            "interview-for-passcode",
            "pursue-icloud-warrant",
            "report-bfu-honestly",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right moves (all five):**",
          "",
          "- Preserve + pull what BFU does yield (Bluetooth, device identity, activation).",
          "- Keep the brute-force running on the second harness; the device must stay in its current power state — a reboot resets brute-force progress and reverts to BFU.",
          "- Coordinate for the passcode through legitimate channels (interview / lawful order). A known passcode is the fastest path to a useful image.",
          "- Pursue iCloud-side in parallel — different chain, different scope, sometimes faster.",
          "- Report honestly to the supporting ACI office. The discipline of saying \"part 3 yes, parts 1, 2, and 4 not from this image — here's the path\" is what keeps the lab credible.",
          "",
          "**Wrong:**",
          "",
          "- *Reboot and retry* — destroys brute-force progress and yields exactly the same BFU image. There is no improvement from a re-boot alone.",
          "- *Carve the encrypted blobs* — the bytes are on disk but the *keys* aren't derived in BFU. Carving doesn't conjure key material; you'd be recovering encrypted blobs you still can't decrypt.",
        ].join("\n"),
      },
      {
        ordinal: 6,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the Notes + Maps parts of the supporting ACI office's request can be answered from THIS image alone.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** BFU is a structural limit on what's decryptable, not a tool defect. Notes (including the locked-note layer) and Maps history live in Data Protection classes whose keys are not derivable in BFU. A defensible response names what BFU does yield (Bluetooth pairings, device identity), names what it does not (Notes, Maps, knowledgeC), and names the pathways that would close the gap (passcode + AFU/FFS re-acquisition; iCloud-side via warrant).\n\n**Owners.** The lab's chief examiner owns the acquisition-state decisions; the case agent + supporting ACI office own the interview / passcode-pursuit decision and the iCloud warrant decision (with the supporting legal advisor). USACIDC is engaged downstream if and when a criminal predicate develops.",
      },
    ],
  },

  // ─── 3. AXIOM + UFED toolbox verify ──────────────────────────
  {
    slug: "mobile-axiom-toolbox-verify-001",
    title: "AXIOM + UFED: Verify Across Tools, Don't Take One Tool's Word",
    summary:
      "A junior examiner's report claims \"WhatsApp messages 100% recovered\" from a Cellebrite FFS extraction parsed in Magnet AXIOM. A senior reviewer notices AXIOM's parser is older than the on-device WhatsApp version. Decide what the right verification posture is.",
    skillAreas: ["df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["mobile", "axiom", "ufed", "tool_verification", "inference_discipline"],
    lane: "mobile_forensics",
    module: "Tool integration",
    sequence: 1,
    brief: `
# Brief

A junior examiner produced a Cellebrite **Full File System (FFS)**
extraction from a seized Android device and ingested the \`.ufd\`
package into **Magnet AXIOM**. Their draft report includes the
finding:

> *"WhatsApp messages: 100% recovered (1,847 messages across 14
> conversation threads). No deleted artifacts observed."*

You are the senior reviewer. Before you sign off, you check
three things the junior didn't:

1. The AXIOM parser version against the WhatsApp version
   actually on the device.
2. The same image opened in **UFED Physical Analyzer** for
   comparison.
3. The lab's standing tool-verification SOP.

Two of those check come back inconvenient. AXIOM's bundled
WhatsApp parser predates the WhatsApp build on the device by
roughly nine months; UFED PA on the same image surfaces eleven
extra rows in deleted / orphan state that AXIOM did not show.

> **Why this matters.** Magnet Forensics' own published guidance
> is that AXIOM is one tool in a toolbox, not the toolbox itself
> — *"different tools have different strengths, and it's
> important to verify results."* A finding that says *"100%
> recovered"* on the strength of one parser, with no
> cross-verification and a known parser-version skew, is
> indefensible on cross-examination; the courtroom version of
> the question is *"how do you know nothing else was there?"*
> and \"AXIOM didn't show any more\" is not the answer.

This is a verification-posture exercise. The technical answer
isn't *"AXIOM is wrong\"* — it might be right. The answer is the
**writeup shape** that survives the question *"what did you do
to verify?"*

## Artifacts

- **axiom-case-summary.txt** — the relevant slice of the AXIOM
  case: WhatsApp artifact tree, count, parser version recorded
  in the case file.
- **ufed-pa-comparison.txt** — the same image opened in UFED
  PA, WhatsApp section.
- **parser-versions.txt** — short cross-reference of AXIOM's
  bundled WhatsApp parser version vs the on-device WhatsApp
  version.
- **lab-sop-tool-verification.txt** — the lab's standing tool-
  verification policy.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "axiom-case-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "================================================================",
            "  Magnet AXIOM  |  Case Summary  (exported from AXIOM Examine)",
            "================================================================",
            "  Generated:  2026-09-15 10:30:14 UTC  by  olabode_d",
            "",
            "Case Details",
            "------------",
            "  Case name        : CASE-2026-152",
            "  Investigator     : SPC L. Bauer (bauer_l)",
            "  Reviewer         : SSG D. Olabode (olabode_d)",
            "  Case file        : E:\\Cases\\2026\\152\\CASE-2026-152.mfdb",
            "  Created          : 2026-09-15 09:12:48 UTC",
            "  AXIOM Process    : 8.4.0.36140",
            "  AXIOM Examine    : 8.4.0.36140",
            "",
            "Evidence Sources (1)",
            "--------------------",
            "  [1]  CASE-2026-152.ufd",
            "       Source format       : Cellebrite UFED package (.ufd)",
            "       Acquisition         : File System (FFS)",
            "       Device              : OnePlus 11   (Android 14)",
            "       Loaded into AXIOM   : 2026-09-15 09:12:48 UTC",
            "       Processing status   : Complete",
            "",
            "Artifact Categories — Mobile Applications",
            "-----------------------------------------",
            "",
            "  WhatsApp (Android) ............................. 1,847 messages",
            "    Conversations / threads ...................... 14",
            "    Attachments .................................. 312",
            "      images ..................................... 287",
            "      voice notes ................................  25",
            "    Deleted .......................................   0",
            "    Orphaned ......................................   0",
            "",
            "    Parser:  whatsapp-android  v2024.11",
            "             Highest msgstore.db schema known to parser: v62",
            "",
            "  Telegram (Android) ............................. 0 messages (not present)",
            "  Signal   (Android) ............................. 0 messages (not present)",
            "",
            "Draft Finding  (examiner: bauer_l;  pending review by olabode_d)",
            "----------------------------------------------------------------",
            "  \"WhatsApp messages: 100% recovered (1,847 messages across 14",
            "   conversation threads). No deleted artifacts observed.\"",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "ufed-pa-comparison.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Cellebrite Physical Analyzer 7.74.0.215",
            "  Project:    CASE-2026-152.ufdx",
            "  Source:     CASE-2026-152.ufd  (Cellebrite UFED FFS — Android 14 — OnePlus 11)",
            "  Re-parsed:  2026-09-15 14:05 UTC by olabode_d (senior reviewer)",
            "",
            "Project Tree",
            "------------",
            "  [+] Devices",
            "    [-] OnePlus 11  (Android 14)",
            "      [-] Analyzed Data",
            "        [-] Instant Messaging",
            "          [-] WhatsApp",
            "                Total messages   ........... 1,847    (matches AXIOM)",
            "                Conversation threads ....... 14       (matches AXIOM)",
            "                Attachments ................ 312      (matches AXIOM)",
            "                Deleted messages ...........  11      [DIFFERS from AXIOM (0)]",
            "                Orphan messages ............   3      [DIFFERS from AXIOM (0)]",
            "          [+] SMS",
            "          [+] Calls",
            "        [+] User Accounts",
            "        [+] Locations",
            "        [+] Web History",
            "",
            "Source of the discrepancy  (per PA's parser-status pane)",
            "--------------------------------------------------------",
            "  msgstore.db                       SQLite, schema v64",
            "  msgstore.db-wal  (WAL journal)    11 row-image entries decoded",
            "                                    -> surfaced as Deleted messages",
            "  msgstore.db-shm  (shared memory)  consistent with WAL above",
            "  free-list pages of msgstore.db    3 row-image entries decoded",
            "                                    -> surfaced as Orphan messages",
            "",
            "  PA WhatsApp module:               v2025.06  (knows schema v64)",
            "  AXIOM WhatsApp module on the      v2024.11  (knows schema v62)",
            "    same image (per AXIOM case):    -> WAL/free-list decoder not triggered",
            "                                       on schema v64 layout.",
            "",
            "Reviewer notes (olabode_d, free-form)",
            "-------------------------------------",
            "  - The 14 deleted/orphan rows are NOT obviously of operational",
            "    significance on first read (short text messages and two",
            "    image references). The point is NOT the content of those",
            "    rows — it is that one tool surfaces them and the other",
            "    does not. The \"100% recovered\" finding is, as written,",
            "    unsupported by this image set.",
            "  - Re-parsing the same .ufd with the most current AXIOM",
            "    parser bundle is the obvious cross-check. The second tool",
            "    is the other half.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "parser-versions.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Parser-version cross-reference",
            "------------------------------",
            "",
            "Item                          Version observed",
            "-----------------------------  ---------------------------------",
            "WhatsApp on device (Android)   2.25.6.x  (Mar 2026 build)",
            "Database schema on device      v64       (per msgstore.db header)",
            "                               ",
            "AXIOM 8.4 whatsapp-android",
            "  bundled parser              2024.11.x",
            "  highest schema known        v62",
            "                               ",
            "UFED PA 7.74 WhatsApp module",
            "  bundled parser              2025.06.x",
            "  highest schema known        v64",
            "",
            "Skew",
            "  AXIOM parser is ~9 months older than the WhatsApp build on",
            "  the device and 2 schema revisions behind. UFED PA's parser",
            "  is current to v64. The schema gap is the most likely",
            "  explanation for AXIOM missing the WAL/journal / free-list",
            "  rows in this image.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "lab-sop-tool-verification.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Lab SOP — mobile-app parser verification (extract)",
            "--------------------------------------------------",
            "",
            "1. Mobile-app artifact findings (messaging, calls, location,",
            "   pattern-of-life) shall be verified by a second tool whose",
            "   parser handles the on-device app version, OR by direct",
            "   inspection of the underlying database with a SQLite client",
            "   over WAL + journal + free-list, before the finding is",
            "   committed to a report intended for external use.",
            "",
            "2. Where two tools disagree on counts (active, deleted, orphan)",
            "   the discrepancy itself is a reportable observation. The",
            "   report shall state both counts, name both tools and their",
            "   parser versions, and describe the source of the discrepancy",
            "   if known.",
            "",
            "3. Findings expressed as \"100% recovered\" / \"complete\" /",
            "   \"nothing else exists\" shall be avoided. A defensible",
            "   finding states what was recovered, by what method, and",
            "   what categories of additional material would require a",
            "   different parser or a different acquisition.",
            "",
            "4. Where the AXIOM parser version is behind the on-device app",
            "   version by more than one minor release, the case shall be",
            "   re-parsed with the most current parser (AXIOM update or",
            "   second tool) before sign-off.",
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
          "Which statements about the situation are **facts** as the artifacts present them?",
        options: [
          {
            id: "tools-disagree",
            label:
              "AXIOM and UFED PA produce different deleted / orphan counts on the same FFS image.",
          },
          {
            id: "parser-skew-9-months",
            label:
              "AXIOM's WhatsApp parser is recorded as approximately 9 months older than the WhatsApp build on the device.",
          },
          {
            id: "axiom-is-wrong",
            label:
              "AXIOM is definitively wrong — the 14 deleted / orphan rows the PA shows are correct and AXIOM missed them.",
          },
          {
            id: "100-percent-is-supported",
            label:
              "The junior's \"100% recovered\" finding is well-supported by the AXIOM case.",
          },
          {
            id: "image-is-broken",
            label:
              "The underlying FFS image is corrupt — that's why the tools disagree.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["tools-disagree", "parser-skew-9-months"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The two tools report different counts on the same image. That's a directly observable disagreement.",
          "- The parser-version cross-reference is a metadata field; the 9-month skew is what the artifact records.",
          "",
          "**Not fact (yet):**",
          "",
          "- *AXIOM is definitively wrong* — UFED PA's parser is more current, and the schema-skew is a plausible mechanism, but \"more current\" isn't \"correct.\" Confirming the 14 rows are real (rather than false positives from PA's WAL decoder) is itself a verification step — direct SQLite inspection of `msgstore.db` + the WAL closes the question.",
          "- *100% recovered is supported* — by SOP, the framing is forbidden regardless of which tool is right. Even if AXIOM and PA agreed on a single count, \"100% recovered\" overclaims (you can never prove nothing else exists).",
          "- *Image is broken* — both tools open the image cleanly and agree on the active counts. The disagreement is in parser coverage, not in the image bytes.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Comparing the **AXIOM case summary** and the **UFED PA project-tree view** on the same FFS image, which statement accurately describes the disagreement?",
        options: [
          {
            id: "agree-everywhere",
            label:
              "Both tools agree on every count (active, threads, attachments, deleted, orphan).",
          },
          {
            id: "image-corrupt",
            label:
              "AXIOM and PA disagree on active message + thread counts; the underlying image is corrupt.",
          },
          {
            id: "pa-surfaces-deleted-orphan",
            label:
              "The tools agree on active counts; UFED PA surfaces 11 deleted (WAL / journal) + 3 orphan (free-list) rows that AXIOM reports as zero.",
          },
          {
            id: "axiom-more-current",
            label:
              "AXIOM surfaces 14 deleted / orphan rows that PA reports as zero — AXIOM is the more current parser here.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["pa-surfaces-deleted-orphan"],
          allowMultiple: false,
        },
        debriefMd:
          "**PA surfaces 11 deleted + 3 orphan rows AXIOM does not.** PA's WhatsApp section shows `Total messages 1,847 (matches AXIOM)` but `Deleted messages 11 (DIFFERS from AXIOM (0))` and `Orphan messages 3 (DIFFERS from AXIOM (0))`. The disagreement is specifically in the deleted + orphan rows, not in the active dataset — and it's PA, not AXIOM, that surfaces them.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the parser-version cross-reference, how does **AXIOM's bundled WhatsApp parser** compare to the WhatsApp build actually on the device?",
        options: [
          {
            id: "current",
            label:
              "Current — AXIOM ships the v64-aware parser that matches the on-device schema.",
          },
          {
            id: "nine-months-behind",
            label:
              "About 9 months older than the WhatsApp build on the device; 2 schema revisions behind (parser knows v62, device runs v64).",
          },
          {
            id: "parser-ahead",
            label:
              "Ahead of the on-device version (parser knows v66, device runs v64).",
          },
          {
            id: "not-recorded",
            label:
              "Parser version is not recorded in this case file.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["nine-months-behind"],
          allowMultiple: false,
        },
        debriefMd:
          "**~9 months behind, 2 schema revisions.** The cross-reference records AXIOM's WhatsApp parser as `2024.11.x` with highest-known schema `v62`, against an on-device WhatsApp `2.25.6.x (Mar 2026 build)` with schema `v64`. That two-revision gap is the most likely reason AXIOM's decoder doesn't trigger the WAL / free-list deleted-row paths on this image.",
      },
      {
        ordinal: 4,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Per the lab's standing tool-verification SOP, what is the rule about findings phrased as **\"100% recovered\" / \"complete\" / \"nothing else exists\"**?",
        options: [
          {
            id: "permitted-tools-agree",
            label:
              "Permitted when both tools agree on counts.",
          },
          {
            id: "permitted-primary-tool",
            label:
              "Permitted when the primary tool's count is signed off by a reviewer.",
          },
          {
            id: "permitted-with-footnote",
            label:
              "Permitted only with an accompanying confidence-5 footnote.",
          },
          {
            id: "forbidden",
            label:
              "Forbidden — a defensible finding states what was recovered, by what method, and what categories of additional material would require a different parser or acquisition.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["forbidden"],
          allowMultiple: false,
        },
        debriefMd:
          "**Forbidden.** SOP item 3 says: *\"Findings expressed as '100% recovered' / 'complete' / 'nothing else exists' shall be avoided.\"* The rule applies regardless of whether the underlying tool counts agree — the framing overclaims by asserting a *negative* (the absence of anything more), which is structurally undecidable from a single image set with a single parser.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "What is the **right verification + writeup posture** for this finding?",
        options: [
          {
            id: "re-parse-with-current-axiom",
            label:
              "Re-parse the same `.ufd` with the most current AXIOM build available; this closes the parser-skew question directly.",
          },
          {
            id: "direct-sqlite-inspection",
            label:
              "Open `msgstore.db` (and its WAL / journal) directly with a SQLite client and confirm the deleted / orphan rows for yourself — the underlying database is the ground truth, not either tool's parser.",
          },
          {
            id: "report-both-counts",
            label:
              "Where the two tools' counts disagree, report both, name both tools and their parser versions, and name the mechanism for the difference (the WhatsApp schema skew) per SOP.",
          },
          {
            id: "rewrite-without-100-language",
            label:
              "Rewrite the finding to drop the \"100% recovered\" framing — state what was recovered, by what tool / method, and what categories of additional material would require a different parser or acquisition.",
          },
          {
            id: "trust-axiom-as-standard",
            label:
              "AXIOM is the lab's primary tool; accept its count and sign off — the SOP exception for \"primary tool\" is implicit.",
          },
          {
            id: "delete-the-pa-output",
            label:
              "Delete the UFED PA output so the case file doesn't show contradictory numbers, then sign off on AXIOM's count.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "re-parse-with-current-axiom",
            "direct-sqlite-inspection",
            "report-both-counts",
            "rewrite-without-100-language",
          ],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right moves (all four):**",
          "",
          "- Re-parse with current AXIOM — the cheap, fast cross-check for the parser-skew explanation.",
          "- Open the database with SQLite directly — that's the courtroom-grade answer when two parsers disagree.",
          "- Report both counts with the parser-version context per SOP. Transparency about tool behaviour is what makes the finding defensible; opacity is what gets it impeached.",
          "- Rewrite the finding to drop the \"100% recovered\" / \"nothing else observed\" framing. Calibrated language is the point.",
          "",
          "**Wrong:**",
          "",
          "- *Trust AXIOM as the lab standard and sign off* — there is no SOP exception for the primary tool, and even if there were, signing off on a known parser-version skew without a second look is exactly the failure mode the SOP is designed to prevent.",
          "- *Delete the PA output* — destroying evidence of a known tool disagreement to make a writeup look cleaner is misconduct, not a verification posture. Don't.",
        ].join("\n"),
      },
      {
        ordinal: 6,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the junior's draft finding — *'WhatsApp messages: 100% recovered (1,847 messages across 14 conversation threads). No deleted artifacts observed.'* — is ready to ship as written.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Two independent SOP rules block sign-off: the parser-version skew triggers re-parsing or second-tool verification, and the \"100% recovered / nothing else observed\" framing is explicitly forbidden. The finding has to be rewritten to state what *was* recovered, by what tool, with the parser version named — and to name the second-tool count + the schema-skew mechanism for the deleted/orphan disagreement. A finding written the way the junior drafted it would not survive the first competent challenge on cross-examination.\n\n**Owners.** The lab's chief examiner owns the verification posture and the SOP. If the deleted rows had operational significance for an active case, the case agent and the supporting ACI office would own the downstream attribution / referral decisions; the unit ISSM enters the picture only if the device's contents touch DODIN-Army systems.",
      },
    ],
  },

  // ─── Mobile Forensics capstone ──────────────────────────────
  {
    slug: "mobile-multi-tool-capstone-001",
    title: "Mobile Capstone: One Device, Three Tools",
    summary:
      "An iPhone lawfully obtained. You have a GrayKey unlock log, a Cellebrite UFED extraction summary, and a Magnet AXIOM analysis. Walk what each tool actually got, where they agree, where they disagree, and write the cover-sheet finding.",
    skillAreas: ["df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 55,
    tags: [
      "mobile",
      "cellebrite",
      "graykey",
      "axiom",
      "report_writing",
      "inference_discipline",
      "capstone",
    ],
    lane: "mobile_forensics",
    module: "Capstone",
    sequence: 1,
    status: "draft",
    brief: `
# Brief

An iPhone (Apple A2483, iOS 17.6) was lawfully obtained at intake
this morning under search-authority \`SA-2026-0204\`. The lab ran
the device through three tools in sequence:

- GrayKey for unlock + acquisition state confirmation
- Cellebrite UFED for the full-file-system extraction
- Magnet AXIOM for the analysis pass

You have a one-page summary from each tool. The three don't tell
exactly the same story; pick out where each one's read is
authoritative, where they agree, and where the differences are
real vs an artifact of how each tool counts. Then pick the
single-paragraph headline that goes on the case-folder cover
sheet.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "graykey-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "GrayKey acquisition log — Device A2483 (iPhone 13)",
            "--------------------------------------------------",
            "",
            "  Case          : SA-2026-0204",
            "  Device serial : F2L0N1A7XZ4",
            "  iOS           : 17.6",
            "  State at intake : LOCKED, AFU (After First Unlock)",
            "  Unlock method : Brute-force PIN, 6-digit numeric, completed 04h12m",
            "  State at extract : UNLOCKED",
            "  Extraction    : Full-file-system to /cases/SA-2026-0204/gk-extract.tar",
            "  SHA-256       : 9c1d...8a40 (verified)",
            "  Extracted UTC : 2026-12-04 11:18:00",
            "",
            "(AFU means the device had been unlocked at least once after",
            " its last boot, so the user keys are in memory and full-file-",
            " system extraction is possible. A BFU device would have been",
            " a much more limited extraction.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "cellebrite-ufed-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Cellebrite UFED extraction summary",
            "----------------------------------",
            "",
            "  Source        : /cases/SA-2026-0204/gk-extract.tar",
            "  Extraction    : Full File System (ingested from GrayKey image)",
            "  Tool version  : UFED 7.78",
            "",
            "  Per-app counts (active rows):",
            "    Messages (iMessage + SMS)      : 4,118",
            "    WhatsApp                       : 2,402",
            "    Signal                         : 18  (sealed envelopes — only what",
            "                                          the OS-level cache surfaces)",
            "    Photos                         : 14,820",
            "    Browser history (Safari)       : 1,902",
            "    Maps / Location history        : 84  (last 30 days)",
            "    Call log                       : 412",
            "    Contacts                       : 218",
            "",
            "  Deleted rows recovered (carved from SQLite WAL/free pages):",
            "    Messages                       : 88",
            "    WhatsApp                       : 12",
            "    Photos                         : 4",
            "",
            "  Notes:",
            "    - Signal counts are floor; on-device DB is encrypted at rest.",
            "    - Some WhatsApp media references resolve to /var/mobile/Media/...",
            "      paths but the referenced files were not present in the FFS",
            "      extract. Possible app-cache eviction.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "axiom-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Magnet AXIOM analysis summary",
            "-----------------------------",
            "",
            "  Source        : /cases/SA-2026-0204/gk-extract.tar",
            "  Tool version  : AXIOM 8.4.0  (Apple iOS module v17.6-r3)",
            "",
            "  Per-app counts (rendered, post-dedup):",
            "    Messages (iMessage + SMS)      : 4,144",
            "    WhatsApp                       : 2,410",
            "    Signal                         : 0",
            "    Photos                         : 14,820",
            "    Browser history (Safari)       : 1,902",
            "    Maps / Location history        : 84",
            "    Call log                       : 412",
            "    Contacts                       : 218",
            "",
            "  Deleted rows recovered:",
            "    Messages                       : 0",
            "    WhatsApp                       : 0",
            "",
            "  Notes:",
            "    - The Apple-iOS module on this AXIOM version parses ONLY",
            "      live SQLite tables; carving from free pages / WAL is in",
            "      the Carving module which was NOT enabled for this run.",
            "    - Signal counts read as 0 because the AXIOM module on this",
            "      version cannot ingest the encrypted-at-rest DB; the OS-level",
            "      cache rows the UFED tool surfaced live in a different",
            "      collection that this AXIOM run did not pick up.",
            "    - Messages count is 26 higher than UFED's count because",
            "      AXIOM's de-dup heuristic treats some thread-replay events",
            "      as separate messages where UFED collapses them.",
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
          "Across the three tools, which fact is **most authoritatively established**?",
        options: [
          {
            id: "acquisition-state",
            label:
              "The device was in AFU state at intake, unlocked successfully via PIN brute-force, and the full-file-system extract is hash-verified.",
          },
          {
            id: "messages-count-exact",
            label:
              "The device contains exactly 4,118 active Messages rows.",
          },
          {
            id: "signal-zero",
            label:
              "The user has never used Signal on this device.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["acquisition-state"],
          allowMultiple: false,
        },
        debriefMd:
          "Acquisition state, unlock method, and image hash are the tightest facts here — they're set at acquisition time and verified. The Messages count differs between tools (4,118 vs 4,144) so neither is *the* count; both are tool-specific reads. *User has never used Signal* would require ruling out the encrypted-at-rest DB; the 0/18 disagreement just shows the AXIOM module on this version can't ingest the encrypted DB, not that there's nothing there.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "UFED reports 88 deleted Messages recovered; AXIOM reports 0. Which **best explains** the difference?",
        options: [
          {
            id: "axiom-no-carving",
            label:
              "AXIOM's Apple-iOS module on this version parses only live SQLite tables; carving from WAL / free pages lives in the Carving module, which was not enabled for this run. UFED carves from free pages by default.",
          },
          {
            id: "user-deleted-after",
            label:
              "The user deleted the messages between the UFED parse and the AXIOM parse.",
          },
          {
            id: "axiom-buggy",
            label:
              "AXIOM is buggy and miscounts deleted rows.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["axiom-no-carving"],
          allowMultiple: false,
        },
        debriefMd:
          "AXIOM's notes say it explicitly — the Carving module wasn't enabled, so AXIOM didn't look in the free pages where UFED found the 88 rows. *Deleted between parses* is incompatible with reading the same `gk-extract.tar` source image — both tools are reading the same bytes. *Buggy* is what a junior writeup says when it doesn't read the tool's own configuration notes. Tool configuration explains the disagreement; report it that way.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "UFED's Signal count is 18; AXIOM's is 0. Which statement is **directly supported**?",
        options: [
          {
            id: "tools-different-corpus",
            label:
              "The two tools are reading different corpora for Signal — UFED is surfacing OS-level cache rows; AXIOM's module can't ingest the encrypted-at-rest DB on this version. Neither count answers *what the user actually did in Signal*.",
          },
          {
            id: "user-used-signal-18-times",
            label:
              "The user used Signal 18 times.",
          },
          {
            id: "axiom-wrong",
            label:
              "AXIOM is wrong; the correct count is 18.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["tools-different-corpus"],
          allowMultiple: false,
        },
        debriefMd:
          "Both tools' notes name what they did or didn't ingest. 18 is the OS-cache floor (per UFED's note that the on-device DB is encrypted at rest), not the device's actual Signal usage; 0 is the live-DB count when the module can't decrypt. *18 times* and *AXIOM is wrong* both treat a tool-specific corpus difference as a content claim it isn't.",
      },
      {
        ordinal: 4,
        type: "text_match",
        weight: 1,
        promptMd:
          "Quote the **SHA-256** of the source extract image, exactly as it appears.",
        textMatch: {
          acceptableAnswers: ["9c1d...8a40"],
          hint: "Look in the GrayKey acquisition-log summary.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["9c1d...8a40"],
          regex: false,
        },
        debriefMd:
          "`9c1d...8a40`. The image hash belongs in every downstream writeup so a reviewer can re-confirm both tools were reading the same bytes — which is the whole point of the cross-tool comparison.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Three drafts of the one-paragraph headline for the case-folder cover sheet. Pick the one you'd actually send.",
        options: [
          {
            id: "overclaim",
            label:
              "*Full forensic extraction of subject device complete. 4,144 messages, 2,410 WhatsApp threads, 18 Signal messages, and 88 deleted messages recovered. No further work required.*",
          },
          {
            id: "calibrated",
            label:
              "*Subject device (Apple A2483, iOS 17.6, serial F2L0N1A7XZ4) was acquired AFU under SA-2026-0204; GrayKey produced a hash-verified full-file-system image (SHA-256 9c1d...8a40). Active-row counts agree between Cellebrite UFED and Magnet AXIOM across most apps; live-SQLite-only counts differ by 26 on Messages and by 8 on WhatsApp due to AXIOM's de-dup heuristic vs UFED's. UFED's 88-Messages/12-WhatsApp deleted-row recoveries do not appear in the AXIOM output because the Carving module was not enabled for the AXIOM run; that does not contradict UFED's count. Signal counts are 18 in UFED (OS-level cache only — the encrypted-at-rest DB is not ingested) and 0 in AXIOM (this module version cannot ingest the encrypted DB); neither figure represents the user's actual Signal usage. Recommend a second-pass AXIOM run with the Carving module enabled to verify UFED's deleted-row counts, and a manual review of the encrypted Signal DB for any further claim about Signal content.*",
          },
          {
            id: "underclaim",
            label:
              "*The tools disagree, so the results are unreliable. Recommend re-acquiring the device.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle one. It names the acquisition state, the hash, where the tools agree, *why* they disagree (config + module-version reasons, not contradictions about the bytes), and the cheap next step (turn on Carving in AXIOM; review the Signal DB by hand). The first reports both tools' numbers as if they were one number and skips the Signal-corpus caveat. The third treats tool-config differences as evidence of *unreliable acquisition* and recommends throwing away a clean image — which is the failure mode that loses the case to a defense expert who actually reads tool documentation.",
      },
    ],
  },
];
