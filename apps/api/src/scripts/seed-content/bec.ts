import { utf8, buildTinyPdf } from "./util";
import type { ScenarioSeed } from "./types";

// Business Email Compromise family. Variants of the same core
// inference question — *which signals prove forgery on the wire,
// vs which are merely social-engineering markers* — wrapped
// around different financial-fraud pretexts.

export const BEC_SCENARIOS: ScenarioSeed[] = [
  // ─── Tier 1 (polished, published) ────────────────────────────
  {
    slug: "bec-vendor-redirect-001",
    title: "BEC: Vendor Payment Redirect",
    summary:
      "A controller receives an urgent wire-change request from a known vendor contact. Headers and surrounding context are available. Decide what you can prove vs what you can only infer.",
    skillAreas: ["email_headers", "bec", "report_writing", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 45,
    tags: ["bec", "email_headers", "inference_discipline", "report_writing"],
    lane: "email_bec",
    module: "BEC mechanics",
    sequence: 1,
    brief: `
# Brief

At 14:07 local, the controller of a partner firm working a unit
acquisition received an email purportedly from
\`jane.doe@vendor.example\` — a familiar vendor finance contact —
requesting that the routing details for an outstanding invoice be
redirected to a new account.

You have been asked to triage the email and advise the controller.
If the activity tracks back to a foreign intelligence entity, it
is reportable to your supporting ACI office in the
*social-engineering / spear-phishing* family of cyberspace
indicators — particularly when the targeted activity touches an
acquisition program.

## Open the artifacts

The workspace tabs hold the supporting material:

- The **suspect email itself** (\`.eml\`), rendered with parsed headers,
  Authentication-Results highlighting (SPF / DKIM / DMARC), the text
  body, and attachment metadata.
- The **controller's contemporaneous note** of the request (plain text).
- A **24-hour slice of the partner firm's web-proxy log** (CSV).
- A **machine-parsed summary** of the suspect email's key headers
  (JSON). Useful for cross-checking against the live parsed view.
- The **vendor's normal invoice template** (PDF).

## Reasoning discipline

Distinguish:

- **Proven:** authentication failures present in the headers; URLs
  that resolve to attacker-controlled infrastructure; etc.
- **Inferred:** intent, attribution, and likely scope of compromise.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "Jane Doe" <jane.doe@vendor.example>',
            "To: controller@partner.example",
            "Reply-To: ceo.urgent@gmail.com",
            "Return-Path: <noreply@vendor-lookup-alike.com>",
            "Subject: URGENT: Updated wire instructions for INV-2026-0418",
            "Date: Thu, 18 Apr 2026 14:07:02 +0000",
            "Message-ID: <bec-1234abcd@vendor-lookup-alike.com>",
            "Authentication-Results: mx.partner.example;",
            " spf=neutral smtp.mailfrom=vendor-lookup-alike.com;",
            " dkim=fail header.d=vendor.example;",
            " dmarc=fail policy.dmarc=reject",
            "Received: from mail.vendor-lookup-alike.com (203.0.113.42)",
            " by inbound.partner.local (1.2.3.4) with ESMTP id ABC123;",
            " Thu, 18 Apr 2026 14:07:00 +0000",
            "MIME-Version: 1.0",
            'Content-Type: multipart/alternative; boundary="BEC-BOUNDARY"',
            "",
            "--BEC-BOUNDARY",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Hi,",
            "",
            "Please update the wire instructions for invoice INV-2026-0418 to",
            "the new account immediately. Confidentiality is critical until",
            "this clears. Confirm via reply only — do not call.",
            "",
            "Thanks,",
            "Jane",
            "--BEC-BOUNDARY",
            "Content-Type: text/html; charset=utf-8",
            "",
            "<p>Hi,</p><p>Please update the wire instructions for",
            " <b>INV-2026-0418</b> to the new account immediately.</p>",
            "--BEC-BOUNDARY--",
            "",
          ].join("\r\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "controller-note.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Date:    14:07 local",
            "Author:  J. Smith, Controller",
            "",
            "Received an email that looked like it was from jane.doe@vendor.example",
            "asking us to update the routing for invoice INV-2026-0418. Replied",
            "asking to confirm by phone but the response said she was in a meeting",
            "until tomorrow and the payment was urgent.",
            "",
            "Flagged this to CI cyber instead of routing it to AP. Not sending yet.",
            "",
            "— J.S.",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "proxy-log-24h.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "timestamp,src_ip,user,host,url,status,bytes,user_agent",
            "2026-04-18T13:51:02Z,10.4.7.18,j.smith,vendor.example,/login,200,4321,Mozilla/5.0",
            "2026-04-18T13:52:14Z,10.4.7.18,j.smith,vendor.example,/invoices/INV-2026-0418,200,18211,Mozilla/5.0",
            "2026-04-18T14:06:48Z,10.4.7.18,j.smith,vendor-lookup-alike.com,/secure-payment,200,2104,Mozilla/5.0",
            "2026-04-18T14:06:53Z,10.4.7.18,j.smith,vendor-lookup-alike.com,/api/account-update,200,884,Mozilla/5.0",
            "2026-04-18T14:07:21Z,10.4.7.18,j.smith,smtp.gmail.com,/inbox,200,17033,Mozilla/5.0",
            "2026-04-18T14:09:02Z,10.4.7.18,j.smith,vendor.example,/account,401,118,Mozilla/5.0",
            "2026-04-18T14:09:11Z,10.4.7.18,j.smith,vendor.example,/login,200,4319,Mozilla/5.0",
            "2026-04-18T14:12:33Z,10.4.7.18,j.smith,internal.partner.local,/wiki/wire-change-policy,200,28442,Mozilla/5.0",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "email-headers-summary.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Machine-parsed summary; cross-check against the live EML view in the workspace.",
              from_display: "Jane Doe",
              from_address: "jane.doe@vendor.example",
              reply_to: "ceo.urgent@gmail.com",
              return_path: "<noreply@vendor-lookup-alike.com>",
              received_chain: [
                "from mail.vendor-lookup-alike.com",
                "by inbound.partner.local",
              ],
              auth_results: { spf: "neutral", dkim: "fail", dmarc: "fail" },
              suspect_links: [
                "https://vendor-lookup-alike.com/secure-payment",
                "https://vendor-lookup-alike.com/api/account-update",
              ],
              attachments: ["INV-2026-0418-revised.pdf"],
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 5,
        displayName: "vendor-invoice-template.pdf",
        kind: "pdf",
        mimeType: "application/pdf",
        bytes: buildTinyPdf(),
      },
    ],
    indicatorSets: [
      {
        slug: "bec-header-indicators",
        displayName: "BEC indicators present in the suspect email",
        sourceArtifactDisplayName: "suspect-email.eml",
        items: [
          { id: "from-display-spoof", label: "From display name claims `Jane Doe` of vendor.example", evidenceRef: "From: header" },
          { id: "reply-to-divergent", label: "Reply-To address is `ceo.urgent@gmail.com` (different domain than From)", evidenceRef: "Reply-To: header" },
          { id: "return-path-lookalike", label: "Return-Path is on `vendor-lookup-alike.com` (lookalike domain)", evidenceRef: "Return-Path: header" },
          { id: "dkim-fail", label: "Authentication-Results reports `dkim=fail header.d=vendor.example`", evidenceRef: "Authentication-Results: header" },
          { id: "dmarc-fail", label: "Authentication-Results reports `dmarc=fail policy.dmarc=reject`", evidenceRef: "Authentication-Results: header" },
          { id: "spf-neutral", label: "Authentication-Results reports `spf=neutral`", evidenceRef: "Authentication-Results: header" },
          { id: "urgency-language", label: 'Subject and body use "URGENT" + same-day pressure framing', evidenceRef: "Subject: header / body" },
          { id: "received-from-lookalike", label: "Received: chain shows the message arrived from `mail.vendor-lookup-alike.com`", evidenceRef: "Received: header" },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which of these signals — present in the EML viewer's parsed Authentication-Results and header strip — support a BEC hypothesis? Select all that apply.",
        options: [
          { id: "spf-neutral", label: "SPF result is `neutral`" },
          { id: "dkim-fail", label: "DKIM result is `fail`" },
          { id: "dmarc-fail", label: "DMARC result is `fail`" },
          { id: "reply-to-divergent", label: "Reply-To address is on a different domain than From" },
          { id: "return-path-lookalike", label: "Return-Path is on a vendor-lookalike domain" },
          { id: "subject-uppercase", label: "Subject is in all caps" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["dkim-fail", "dmarc-fail", "reply-to-divergent", "return-path-lookalike"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven by the artifacts:**",
          "",
          "- `dkim=fail header.d=vendor.example` — the message claims to be from the real vendor domain but DKIM does not validate.",
          "- `dmarc=fail policy.dmarc=reject` — the receiving MTA's DMARC policy refused the message; this is a strong technical signal.",
          "- Reply-To divergence (`ceo.urgent@gmail.com` vs `jane.doe@vendor.example`) — classic identity-spoof / out-of-band reply trick.",
          "- Return-Path on `vendor-lookup-alike.com` — lookalike domain registered to receive bounce mail away from the real vendor.",
          "",
          "**Not enough to claim by itself:**",
          "",
          "- An all-caps subject and `URGENT` framing are *social engineering markers*, not proof of forgery.",
          "- `spf=neutral` is not pass *or* fail — by itself it doesn't prove anything; combined with the DKIM/DMARC failures it firms up the picture.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "confidence",
        weight: 1,
        promptMd:
          "On a 1–5 scale, how confident are you that this email is a BEC attempt? (1 = not confident, 5 = certain)",
        expected: { type: "confidence", expectedRange: [3, 5] },
        debriefMd: [
          "A confident **5** is unwarranted on the headers alone — the headers establish *spoofing*, not yet *intent and operational scope*.",
          "",
          "A **3 or 4** reflects calibrated reasoning given the available evidence: technical auth failures + Reply-To/Return-Path divergence + lookalike domain registration cluster strongly toward BEC, but proving the attacker accessed the vendor's account vs. simply impersonating it externally requires more work.",
          "",
          "A **1 or 2** ignores the multiple corroborating signals already in the artifacts.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "text_match",
        weight: 1,
        promptMd: [
          "Open the **suspect-email.eml** tab and look at the parsed",
          "headers. **What is the lookalike domain** the Return-Path",
          "uses?",
          "",
          "(Type just the bare domain. Case doesn't matter; extra",
          "whitespace is ignored.)",
        ].join("\n"),
        textMatch: {
          acceptableAnswers: ["vendor-lookup-alike.com"],
          hint: "Look at the `Return-Path:` header in the EML viewer, between the angle brackets.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["vendor-lookup-alike.com"],
          regex: false,
        },
        debriefMd: [
          "The Return-Path is `noreply@vendor-lookup-alike.com` — the bounce-handling domain the message claims to come from. It's a one-character variant of the real vendor domain (`vendor.example`) that the attacker has registered specifically to receive replies + bounces without ever touching the real vendor's mail flow.",
          "",
          "Lookalike domains are a wire-level fact, not an inference: whois on the registered domain, passive-DNS pivots, and infrastructure overlap with other known phishing campaigns can all be checked against this one string.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "bec-header-indicators",
        promptMd:
          "Open the **suspect-email.eml** tab and review the parsed header strip. Which of the listed indicators are **technical evidence** the message was not sent from the real vendor (vs. social-engineering markers)? Pick the ones that establish *spoofing* on the wire.",
        expected: {
          type: "select_indicators",
          correctIds: [
            "reply-to-divergent",
            "return-path-lookalike",
            "dkim-fail",
            "dmarc-fail",
            "received-from-lookalike",
          ],
        },
        debriefMd: [
          "**Technical evidence of spoofing on the wire:**",
          "",
          "- `Reply-To: ceo.urgent@gmail.com` — Reply-To divergence is a wire-protocol signal: the message's *machine-readable* reply destination is a free webmail account.",
          "- `Return-Path` on a lookalike domain — wire-level routing the attacker controls.",
          "- `dkim=fail header.d=vendor.example` — the cryptographic signature claim that this is from vendor.example was rejected.",
          "- `dmarc=fail policy.dmarc=reject` — the receiving MTA's policy lookup against the vendor's published DMARC record rejected the message.",
          "- `Received: from mail.vendor-lookup-alike.com` — the first-hop Received line records that the message was injected from an attacker-controlled MTA.",
          "",
          "**Not technical evidence (social-engineering markers, separate axis):**",
          "",
          "- The `From:` display name (`Jane Doe`) is trivially forgeable and proves nothing about wire authenticity.",
          "- `spf=neutral` is *not a fail* — it asserts \"no published policy\" rather than \"this is spoofed.\"",
          "- `URGENT` framing and same-day pressure are psychological manipulation, not technical proof.",
          "",
          "**Reasoning discipline reminder:** distinguishing wire-level proofs from social-engineering markers is what separates \"this looks suspicious\" from \"this *is* spoofed on the wire and here are the four headers that prove it.\" Both matter in the report; mixing them weakens the writeup.",
        ].join("\n"),
      },
    ],
  },

  // ─── Tier 2 (draft) ─────────────────────────────────────────
  {
    slug: "bec-w2-payroll-redirect-002",
    title: "BEC: W-2 Payroll Account Redirect",
    summary:
      "An employee emails HR claiming to have updated direct-deposit details. Decide which evidence supports impersonation vs a legitimate request.",
    skillAreas: ["email_headers", "bec", "report_writing", "inference_discipline"],
    difficulty: 1,
    estimatedMinutes: 20,
    tags: ["bec", "email_headers", "inference_discipline"],
    lane: "email_bec",
    module: "BEC mechanics",
    sequence: 2,
    status: "draft",
    brief: `
# Brief (DRAFT)

HR received an email purportedly from \`a.morales@partner.example\`
asking to update direct-deposit routing for next pay run. The
message includes a new bank routing + account number and asks HR
to confirm via reply only.

The artifacts include the raw email and a snippet of the employee
directory. Triage and report. When used against DA personnel, the
pattern sits in the *email-spoofing / spear-phishing* family of
reportable cyberspace indicators.

> This challenge is a Tier-2 draft. Briefs and debriefs are
> functional but lighter than the polished set.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "suspect-email.eml",
        kind: "eml",
        mimeType: "message/rfc822",
        bytes: utf8(
          [
            'From: "Alex Morales" <a.morales@partner.example>',
            "To: hr-payroll@partner.example",
            "Reply-To: morales.alex.payroll@gmail.com",
            "Return-Path: <bounces@partner-corp-lookalike.com>",
            "Subject: Direct deposit update for next pay run",
            "Date: Mon, 06 Jul 2026 09:12:00 +0000",
            "Message-ID: <w2-bec-002@partner-corp-lookalike.com>",
            "Authentication-Results: mx.partner.example;",
            " spf=fail smtp.mailfrom=partner-corp-lookalike.com;",
            " dkim=none;",
            " dmarc=fail policy.dmarc=quarantine",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=utf-8",
            "",
            "Hi Payroll,",
            "",
            "Please update my direct deposit to the routing/account below for the",
            "next pay run. Confirm by reply once done — I'm in meetings all day.",
            "",
            "  Routing: 021000021",
            "  Account: 9981234567",
            "",
            "Thanks,",
            "Alex",
            "",
          ].join("\r\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "employee-directory.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "email,display_name,department,manager",
            "a.morales@partner.example,Alex Morales,Engineering,e.lee@partner.example",
            "hr-payroll@partner.example,HR Payroll,HR,",
            "e.lee@partner.example,Erin Lee,Engineering,",
          ].join("\n") + "\n",
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Which of the following are technical signals the message was NOT sent from the claimed account?",
        options: [
          { id: "spf-fail", label: "SPF result is `fail`" },
          { id: "dmarc-fail", label: "DMARC result is `fail policy.dmarc=quarantine`" },
          { id: "reply-to-gmail", label: "Reply-To is on a free webmail domain different from From" },
          { id: "return-path-lookalike", label: "Return-Path is on a partner-corp-lookalike domain" },
          { id: "lower-case-greeting", label: "Greeting uses lower-case `hi`" },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["spf-fail", "dmarc-fail", "reply-to-gmail", "return-path-lookalike"],
          allowMultiple: true,
        },
        debriefMd: [
          "SPF fail + DMARC fail are wire-level evidence the sending IP isn't authorized by the claimed domain.",
          "Reply-To on a webmail account is the social-engineering tell; Return-Path on a lookalike domain is the bounce-handling tell. Casing in the greeting is noise.",
        ].join("\n\n"),
      },
      {
        ordinal: 2,
        type: "confidence",
        weight: 1,
        promptMd:
          "On a 1–5 scale, how confident are you that this is impersonation rather than a legitimate request from Alex?",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "SPF fail + DMARC fail + Reply-To divergence + lookalike Return-Path together is a strong cluster. Out-of-band confirmation (call Alex on a known number) is still the operational requirement, but the technical signal supports a high-confidence determination of impersonation.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What's the *out-of-band* verification step HR should take before processing this change? (Out-of-band = a channel the attacker doesn't control.)",
        options: [
          { id: "reply-and-confirm", label: "Reply to the email asking Alex to confirm in writing." },
          { id: "call-known-number", label: "Call Alex on a phone number from the corporate directory (not one in the email)." },
          { id: "check-spf", label: "Re-check the SPF / DKIM result one more time." },
          { id: "ask-it-to-scan", label: "Forward to IT and ask them to scan the message for malware." },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["call-known-number"],
          allowMultiple: false,
        },
        debriefMd:
          "Out-of-band verification by phone (or in person) to a **known-good** number — i.e. one from the corporate directory, never one supplied in the suspect email — is the operational defense. The technical signals raise alarm; the phone call resolves it. Replying to the email confirms nothing because the attacker may be reading the inbox; re-checking auth headers tells you nothing new; a malware scan is a different question.",
      },
    ],
  },
];
