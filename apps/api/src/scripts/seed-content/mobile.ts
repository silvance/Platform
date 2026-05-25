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
>   pattern-of-life artefacts.
> - **Advanced Logical** — adds a richer dataset by walking iOS
>   backup mechanisms more aggressively; closer to a full iTunes
>   backup. Still does **not** include the full file system or
>   the keychain. Some app sandbox data lands, some does not.
> - **File System / Full File System (FFS)** — the on-device
>   userland filesystem. Includes app sandboxes (Signal,
>   WhatsApp, Telegram message DBs), pattern-of-life
>   (\`knowledgeC.db\`, biome stores), the keychain (with the
>   right unlock state), and most artefacts a forensic examiner
>   wants.
> - **Physical** — the whole NAND image, including unallocated.
>   On modern iOS this is rare to impossible without an
>   exploit-capable acquisition path (e.g. checkm8-class).

This is a routing-first exercise. The exercise is *not* "do the
deleted-Signal carve" — the artefacts can't support it. The
exercise is to read the summary, write back to the case agent
honestly, and name the next acquisition step that would actually
satisfy the ask.

## Artefacts

- **extraction-summary.txt** — the Cellebrite Extraction
  summary header for the \`.ufd\` package: device identity,
  examiner, method, integrity hashes.
- **data-inventory.csv** — the artefact categories UFED PA
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
            "Cellebrite UFED Extraction Summary",
            "----------------------------------",
            "",
            "Case ID:           CASE-2026-141",
            "Examiner:          SSG D. Olabode, CFCE, Cellebrite Certified Operator (CCO)",
            "Extraction date:   2026-09-12 14:18:22 UTC",
            "UFED version:      7.74.0.215",
            "PA version:        7.74.0.215",
            "",
            "Device",
            "  Make / Model:    Apple iPhone 14 Pro (A2890)",
            "  iOS version:     17.6.1",
            "  IMEI:            35-9000xx-xxxxxx-x   (last six redacted in summary)",
            "  Serial:          C7P-XXXX-XXXX        (last six redacted in summary)",
            "  Bluetooth name:  (not collected in this extraction)",
            "",
            "Extraction",
            "  Method:          Advanced Logical (iOS)",
            "  Source:          USB tethered, device unlocked by user-provided passcode",
            "  Working folder:  /Evidence/2026/141/UFED/AdvLogical/",
            "  Output package:  CASE-2026-141.ufd  (5.3 GiB)",
            "  Integrity:       SHA-256 (package) = 8f7c...4e21",
            "                   SHA-256 (manifest) verified at completion",
            "",
            "Notes (auto-generated by UFED):",
            "  - Advanced Logical extraction completed without errors.",
            "  - Full file system extraction was NOT attempted on this device",
            "    on this run; chip-off and physical methods not applicable to",
            "    this iOS / hardware combination.",
            "  - Keychain decoding is NOT included in an Advanced Logical of",
            "    iOS 17.x; the keychain requires a FFS or GRAYKEY pathway.",
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
          [
            "category,present_in_extraction,row_count,notes",
            "Contacts,yes,438,",
            "Call log,yes,1207,calls + FaceTime audio/video included",
            "SMS / iMessage,yes,5611,active threads only; deleted iMessages not recovered from this extraction type",
            "Photos & Videos (Camera Roll),yes,2104,active media only; \"Recently Deleted\" album not parsed by Advanced Logical",
            "Notes (Apple),yes,89,active notes only",
            "Voice Memos,yes,12,",
            "Calendar,yes,322,",
            "Safari history,yes,4188,active history only",
            "Wi-Fi networks,partial,32,SSIDs visible; pre-shared keys are in the keychain and NOT present",
            "Keychain entries,no,0,Keychain requires File System extraction or GRAYKEY",
            "Signal messages (active),no,0,Signal sandbox database not exposed by Advanced Logical on iOS 17",
            "Signal messages (deleted),no,0,Requires FFS + decoding of Signal's SQLite WAL/journal",
            "WhatsApp messages,no,0,Sandbox database not exposed by Advanced Logical",
            "knowledgeC.db / biome (pattern of life),no,0,Requires FFS",
            "Powerlog (CurrentPowerlog.PLSQL),no,0,Requires FFS",
            "Unallocated / deleted-file carving,no,0,No physical image available on modern iOS",
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
            "  artefacts live on modern iOS.",
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
    indicatorSets: [
      {
        slug: "cellebrite-extraction-indicators",
        displayName: "Observations from the extraction summary + inventory",
        items: [
          {
            id: "method-advanced-logical",
            label:
              "The extraction method is recorded as Advanced Logical (iOS) — not File System, not Physical.",
            evidenceRef: "extraction-summary.txt",
          },
          {
            id: "signal-not-present",
            label:
              "Signal messages (active and deleted) are explicitly not present in the inventory — the Signal sandbox database is not exposed by an Advanced Logical extraction on iOS 17.",
            evidenceRef: "data-inventory.csv",
          },
          {
            id: "deleted-imessages-not-recovered",
            label:
              "Deleted iMessages are not recovered in this extraction type; only active threads are.",
            evidenceRef: "data-inventory.csv",
          },
          {
            id: "recently-deleted-album-missing",
            label:
              "Photos in the \"Recently Deleted\" album are not parsed by an Advanced Logical extraction.",
            evidenceRef: "data-inventory.csv",
          },
          {
            id: "keychain-missing",
            label:
              "Keychain entries are zero; the extraction-summary note states keychain decoding requires FFS or GRAYKEY.",
            evidenceRef: "data-inventory.csv",
          },
          {
            id: "wifi-pre-shared-keys-missing",
            label:
              "Wi-Fi SSIDs are present but their pre-shared keys are not — they live in the keychain, which this extraction did not capture.",
            evidenceRef: "data-inventory.csv",
          },
          {
            id: "knowledgec-biome-missing",
            label:
              "knowledgeC.db / biome / powerlog (pattern-of-life and app-usage attribution stores) are not present — they require FFS.",
            evidenceRef: "data-inventory.csv",
          },
          {
            id: "active-imessages-present",
            label:
              "5,611 active SMS / iMessage rows ARE present — the Advanced Logical does cover active iMessage history.",
            evidenceRef: "data-inventory.csv",
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
          "- *Deleted Signal* — Signal's sandbox database isn't exposed by an Advanced Logical on iOS 17 at all (active OR deleted). The agent's ask cannot be answered from this image. \"Deleted records exist somewhere in the device\" is true; \"they're in this artefact set\" is not.",
          "- *Keychain* — the summary's own auto-generated note says keychain decoding requires FFS or GRAYKEY. The keychain holds Wi-Fi PSKs, app tokens, etc.",
          "- *Extraction failed* — the integrity hashes verified at completion and the inventory counts are consistent with a clean Advanced Logical. It didn't fail; it just doesn't include what the agent asked for. Misdiagnosing the absence as a tool failure leads to wasted re-extractions.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "cellebrite-extraction-indicators",
        promptMd:
          "Pick the observations that **directly support** the position 'this image cannot, by itself, answer the deleted-Signal-messages part of the request.'",
        expected: {
          type: "select_indicators",
          correctIds: [
            "method-advanced-logical",
            "signal-not-present",
            "deleted-imessages-not-recovered",
            "recently-deleted-album-missing",
          ],
        },
        debriefMd: [
          "**Directly supporting:**",
          "",
          "- The recorded method (Advanced Logical) is the upstream cause — every other absence flows from it.",
          "- Signal sandbox is explicitly not present; there is no `messages.db` to carve from at all in this artefact set.",
          "- Deleted iMessages aren't recovered either, a corroborating sign that this extraction tier doesn't surface deleted records on iOS 17.",
          "- The \"Recently Deleted\" album not being parsed is the same pattern for photos.",
          "",
          "**Related but not directly load-bearing for the Signal-specific ask:**",
          "",
          "- *Keychain missing / Wi-Fi PSKs missing / knowledgeC missing* — these matter for other parts of the case (Bluetooth pairing, pattern-of-life, account credentials) but don't speak to the Signal-deleted question on their own.",
          "- *Active iMessages present* — that's what we *can* honestly claim; it isn't an indicator about the Signal limitation.",
        ].join("\n"),
      },
      {
        ordinal: 3,
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
          "- *Grepping the `.ufd`* — `.ufd` is a Cellebrite project file with a manifest pointing to extracted artefacts; even where strings exist, they're already in the parsed categories. A grep won't conjure data the extraction never collected from the device.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the deleted-Signal-messages part of the agent's request can be answered from THIS image alone.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The image is an Advanced Logical; Signal's sandbox database is not exposed by that extraction type on iOS 17 (active *or* deleted). A defensible response to the agent names the image type, names the artefact gap (Signal sandbox + keychain + knowledgeC), names the FFS / GRAYKEY pathway that would close the gap, and recommends a re-acquisition decision rather than promising what the image cannot deliver.\n\n**Owners.** The lab's chief examiner owns the re-acquisition decision; the case agent + supporting legal advisor own the warrant scope if an iCloud pivot is pursued. The unit ISSM is not in this workflow unless DODIN-Army data was on the device.",
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

## Artefacts

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
            "GRAYKEY device session",
            "----------------------",
            "",
            "Session ID:        GK-2026-09-187",
            "Examiner:          MSG R. Pickering, EnCE",
            "Started:           2026-09-12 22:11:04 UTC",
            "Ended:             2026-09-13 06:42:18 UTC",
            "",
            "Target device",
            "  Make / Model:    Apple iPhone 13 (A2482)",
            "  iOS version:     17.5.1   (read from BFU-recoverable metadata)",
            "  Power state:     received powered OFF in Faraday bag, sealed",
            "                   on DA Form 4137 #4137-2026-148-B",
            "  Boot state:      device booted by GRAYKEY harness",
            "  Unlock state:    BFU (Before First Unlock) — passcode never",
            "                   entered since boot",
            "",
            "Acquisition",
            "  Image type:      BFU image",
            "  Passcode:        not provided; not recovered (BFU brute-force",
            "                   queued; ~10 min/try, 6-digit passcode space",
            "                   not exhausted within the session window)",
            "  AFU image:       NOT produced (would require successful unlock",
            "                   OR a stable AFU state at time of acquisition)",
            "  FFS image:       NOT produced (requires passcode and AFU state)",
            "",
            "Output",
            "  Image path:      /evidence/2026/148/GK-BFU-148B.tar",
            "  Image size:      6.2 GiB (much of which is encrypted blobs",
            "                   not yet readable in BFU state)",
            "  Integrity:       SHA-256 over .tar = 9d12...c84a",
            "",
            "Operator note (free-form, end of session):",
            "  \"BFU image captured cleanly. Brute-force left running on a",
            "   second GRAYKEY harness; will produce AFU+FFS if/when",
            "   passcode succeeds. No indication so far. Device remains in",
            "   Faraday-bagged secure storage with chain-of-custody intact.\"",
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
            "BFU image — categories readable downstream (AXIOM / UFED PA)",
            "------------------------------------------------------------",
            "",
            "Readable in BFU (Data Protection class None or equivalent)",
            "  - Device identity: model, IMEI, serial, iOS build.",
            "  - Last activation date; activation lock state.",
            "  - Some system logs (subset; many require AFU keys to decrypt).",
            "  - Some \"always available\" plist content (carrier, lockscreen",
            "    wallpaper image fragments).",
            "  - Bluetooth pairings:  PRESENT — Bluetooth daemon caches pair",
            "    records in a Data-Protection-None scope so the radio works",
            "    before first unlock. Pairing name + MAC visible in BFU.",
            "",
            "NOT readable in BFU (encrypted with keys not yet derived)",
            "  - Apple Notes content (notes.sqlite encrypted; locked-note",
            "    bodies double-encrypted with per-note passphrase).",
            "  - Apple Maps history (Maps Search History / Maps Sync DB).",
            "  - Messages.app / SMS DB content.",
            "  - Most third-party app sandboxes (Signal, WhatsApp, Telegram,",
            "    banking apps, etc.).",
            "  - knowledgeC.db / biome / CurrentPowerlog.PLSQL.",
            "  - The bulk of the keychain (most keychain items are class",
            "    AfterFirstUnlock; only kSecAttrAccessibleAlwaysThisDeviceOnly",
            "    items are reachable in BFU, and modern apps avoid that class).",
            "  - The Camera Roll for any photo taken or imported after the",
            "    last reboot (Photos uses a per-device-unlock key).",
            "",
            "Notes",
            "  - \"Not readable\" means the bytes are on disk but the keys to",
            "    decrypt them are not currently derivable. If the passcode is",
            "    recovered (or provided), an AFU image taken from the device",
            "    in its current power-on state will yield most of it.",
            "  - The image is NOT broken. BFU is a structural limit, not a",
            "    tool error.",
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
            "  5. In parallel, pursue iCloud-side artefacts via warrant",
            "     where the scope and lawfulness permit — different",
            "     evidence, different chain.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "graykey-bfu-indicators",
        displayName: "Observations from the GRAYKEY status + inventory + reference card",
        items: [
          {
            id: "image-is-bfu",
            label:
              "GRAYKEY records image_type = BFU; the device has not been unlocked since boot.",
            evidenceRef: "graykey-status.txt",
          },
          {
            id: "passcode-not-recovered",
            label:
              "Passcode has not been recovered in this session; BFU brute-force is still queued and not exhausted.",
            evidenceRef: "graykey-status.txt",
          },
          {
            id: "afu-not-produced",
            label:
              "No AFU image and no FFS image was produced — both require either a known passcode or an AFU state at the time of acquisition.",
            evidenceRef: "graykey-status.txt",
          },
          {
            id: "bluetooth-pairings-readable",
            label:
              "Bluetooth pairings ARE typically readable in BFU because the pair cache is in a Data-Protection-None scope so the radio can come up without unlock.",
            evidenceRef: "bfu-image-inventory.txt",
          },
          {
            id: "notes-not-readable",
            label:
              "Apple Notes content (including the secure / locked notes) is NOT readable in BFU; per-note Data Protection keys are not yet derived.",
            evidenceRef: "bfu-image-inventory.txt",
          },
          {
            id: "maps-not-readable",
            label:
              "Apple Maps history is NOT readable in BFU.",
            evidenceRef: "bfu-image-inventory.txt",
          },
          {
            id: "knowledgec-not-readable",
            label:
              "knowledgeC.db / biome / powerlog (pattern-of-life and app-usage attribution) are NOT readable in BFU.",
            evidenceRef: "bfu-image-inventory.txt",
          },
          {
            id: "image-not-broken",
            label:
              "The image is NOT corrupted or broken — BFU is a structural data-protection limit, not a tool error. Treating the absence as a tool failure leads to wasted re-extractions.",
            evidenceRef: "bfu-image-inventory.txt",
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
          "Which statements about the GRAYKEY image are **facts** as the artefacts present them?",
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
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "graykey-bfu-indicators",
        promptMd:
          "Pick the observations that **directly support** the position 'this BFU image cannot, by itself, satisfy the Notes + Maps parts of the ACI request.'",
        expected: {
          type: "select_indicators",
          correctIds: [
            "image-is-bfu",
            "passcode-not-recovered",
            "notes-not-readable",
            "maps-not-readable",
          ],
        },
        debriefMd: [
          "**Directly supporting:**",
          "",
          "- The image being BFU is the upstream cause; every other Notes/Maps limitation flows from it.",
          "- The passcode not being recovered means there is no pivot to AFU within this image; the keys to decrypt Notes / Maps are not derivable.",
          "- The inventory explicitly names Notes and Maps as not readable in BFU.",
          "",
          "**Related but not direct support for the Notes/Maps ask specifically:**",
          "",
          "- *Bluetooth readable* — that's the *good* news; it speaks to part 3 of the request, not parts 1 and 2.",
          "- *knowledgeC not readable* — relevant to part 4 of the request, not directly to Notes / Maps.",
          "- *AFU not produced / image not broken* — those are general framing, not specific Notes/Maps limits.",
        ].join("\n"),
      },
      {
        ordinal: 3,
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
        ordinal: 4,
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
> conversation threads). No deleted artefacts observed."*

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

## Artefacts

- **axiom-case-summary.txt** — the relevant slice of the AXIOM
  case: WhatsApp artefact tree, count, parser version recorded
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
            "Magnet AXIOM Examine — case summary (extract)",
            "---------------------------------------------",
            "",
            "Case:              CASE-2026-152",
            "Examiner:          SPC L. Bauer (under SSG Olabode review)",
            "AXIOM version:     8.4.0.36140",
            "Image source:      CASE-2026-152.ufd (Cellebrite UFED FFS,",
            "                   Android 14, OnePlus 11)",
            "Image ingested:    2026-09-15 09:12 UTC",
            "",
            "Mobile application artefacts (WhatsApp section)",
            "-----------------------------------------------",
            "",
            "  Messages parsed:       1,847",
            "  Conversation threads:  14",
            "  Attachments:           312 (images + voice notes)",
            "  Deleted messages:      0      <-- AXIOM count",
            "  Orphan messages:       0      <-- AXIOM count",
            "",
            "Parser metadata",
            "  Module:                whatsapp-android",
            "  Bundled parser ver.:   2024.11.x   (AXIOM 8.4 ships with the",
            "                                      late-2024 WhatsApp",
            "                                      parser bundle)",
            "  Last database schema",
            "    seen by parser:      WhatsApp Android schema v62",
            "",
            "Draft finding (junior examiner, awaiting review):",
            "  \"WhatsApp messages: 100% recovered (1,847 messages across",
            "   14 conversation threads). No deleted artefacts observed.\"",
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
            "Cellebrite UFED Physical Analyzer — same image",
            "----------------------------------------------",
            "",
            "Project:           CASE-2026-152 (FFS, Android 14, OnePlus 11)",
            "PA version:        7.74.0.215",
            "Re-parsed:         2026-09-15 14:05 UTC by senior reviewer",
            "                   (SSG Olabode)",
            "",
            "WhatsApp section",
            "----------------",
            "",
            "  Messages parsed:       1,847   (matches AXIOM)",
            "  Conversation threads:  14      (matches AXIOM)",
            "  Attachments:           312     (matches AXIOM)",
            "",
            "  Deleted messages:      11      <-- DIFFERS from AXIOM (0)",
            "      Source: WAL / journal of msgstore.db, decoded by the",
            "      PA WhatsApp module which is one minor revision ahead",
            "      of the AXIOM bundled parser.",
            "",
            "  Orphan messages:       3       <-- DIFFERS from AXIOM (0)",
            "      Source: free-list pages of msgstore.db.",
            "",
            "Notes",
            "  - The 14 deleted/orphan rows are NOT obviously of operational",
            "    significance on first read (short messages, two image",
            "    references, the rest text). The point is not the content",
            "    of those rows — it is that one tool surfaces them and the",
            "    other does not. The \"100% recovered\" finding is, as",
            "    written, unsupported by this image set.",
            "",
            "  - Re-parsing the same .ufd with a current AXIOM build (when",
            "    available) is the obvious cross-check. The second parser",
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
            "1. Mobile-app artefact findings (messaging, calls, location,",
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
    indicatorSets: [
      {
        slug: "axiom-verify-indicators",
        displayName: "Observations bearing on the verification posture",
        items: [
          {
            id: "tool-disagreement",
            label:
              "AXIOM and UFED PA disagree on deleted-message and orphan-message counts on the same FFS image (AXIOM = 0, PA = 11 deleted + 3 orphan).",
            evidenceRef: "ufed-pa-comparison.txt",
          },
          {
            id: "parser-skew",
            label:
              "AXIOM's bundled WhatsApp parser is ~9 months older than the WhatsApp build on the device and is 2 schema revisions behind.",
            evidenceRef: "parser-versions.txt",
          },
          {
            id: "active-counts-agree",
            label:
              "AXIOM and UFED PA agree on active message + thread + attachment counts — the discrepancy is specifically in deleted / orphan rows, not in active content.",
            evidenceRef: "ufed-pa-comparison.txt",
          },
          {
            id: "sop-requires-second-tool",
            label:
              "The lab SOP requires mobile-app findings to be verified by a second tool or by direct SQLite inspection (WAL + journal + free-list) before external-report sign-off.",
            evidenceRef: "lab-sop-tool-verification.txt",
          },
          {
            id: "sop-forbids-100-percent-language",
            label:
              "The lab SOP explicitly forbids \"100% recovered / complete / nothing else exists\" language in findings; the junior's draft uses that exact framing.",
            evidenceRef: "lab-sop-tool-verification.txt",
          },
          {
            id: "deleted-rows-not-operationally-significant",
            label:
              "The 14 deleted / orphan rows that UFED PA surfaces are not, on first read, obviously of operational significance — short text messages and two image references.",
            evidenceRef: "ufed-pa-comparison.txt",
          },
          {
            id: "image-itself-is-fine",
            label:
              "The FFS image itself is not in question — both tools open it cleanly and agree on the active counts; the question is which parser surfaces what on the same input.",
            evidenceRef: "ufed-pa-comparison.txt",
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
          "Which statements about the situation are **facts** as the artefacts present them?",
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
          "- The parser-version cross-reference is a metadata field; the 9-month skew is what the artefact records.",
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
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "axiom-verify-indicators",
        promptMd:
          "Pick the observations that **directly require** the junior's draft finding to be revised before sign-off, regardless of which tool's count turns out to be correct.",
        expected: {
          type: "select_indicators",
          correctIds: [
            "tool-disagreement",
            "parser-skew",
            "sop-requires-second-tool",
            "sop-forbids-100-percent-language",
          ],
        },
        debriefMd: [
          "**Directly require revision:**",
          "",
          "- Tool disagreement on the same image is itself a reportable observation per SOP; a finding that suppresses it isn't defensible.",
          "- The parser skew triggers the SOP's re-parse-or-second-tool requirement on its own, before any disagreement is even observed.",
          "- The SOP rule on second-tool verification is the explicit gate.",
          "- The SOP rule on \"100% recovered\" language disallows the finding's framing regardless of the underlying counts.",
          "",
          "**Important but not direct gating for the rewrite itself:**",
          "",
          "- *Active counts agree* — useful framing for the revised finding (\"active counts confirmed across two tools\"), but doesn't drive the revision itself.",
          "- *Deleted rows not operationally significant* — content-of-the-deleted-rows is a *separate* analytic question; even if the rows are mundane, the finding still has to be rewritten because the *posture* is wrong.",
          "- *Image itself is fine* — same as the disagreement framing.",
        ].join("\n"),
      },
      {
        ordinal: 3,
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
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the junior's draft finding — *'WhatsApp messages: 100% recovered (1,847 messages across 14 conversation threads). No deleted artefacts observed.'* — is ready to ship as written.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** Two independent SOP rules block sign-off: the parser-version skew triggers re-parsing or second-tool verification, and the \"100% recovered / nothing else observed\" framing is explicitly forbidden. The finding has to be rewritten to state what *was* recovered, by what tool, with the parser version named — and to name the second-tool count + the schema-skew mechanism for the deleted/orphan disagreement. A finding written the way the junior drafted it would not survive the first competent challenge on cross-examination.\n\n**Owners.** The lab's chief examiner owns the verification posture and the SOP. If the deleted rows had operational significance for an active case, the case agent and the supporting ACI office would own the downstream attribution / referral decisions; the unit ISSM enters the picture only if the device's contents touch DODIN-Army systems.",
      },
    ],
  },
];
