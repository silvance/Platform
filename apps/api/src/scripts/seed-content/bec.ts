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

This is a **Business Email Compromise (BEC)** triage — a
financial-fraud lure that arrives as a plausible message from a
trusted counterparty (usually a vendor or executive) and asks
for a routing change, an off-cycle wire, or a credential. The
attacker's goal is to bend a routine money-movement workflow off
its normal path; the analyst's job is to separate what the
headers *prove* from what they only *suggest*.

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
          // Zscaler ZIA Web Insights export — `Web Transactions`
          // report scoped to user j.smith over the 24h analyst
          // window. Columns mirror the canonical ZIA web-log
          // schema (full URL split across host + path; the
          // `action` column shows the policy verdict).
          [
            "datetime,user,department,location,client_internal_ip,host,url_path,http_method,status,response_size,user_agent,url_category,action",
            "2026-04-18T13:51:02Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,vendor.example,/login,GET,200,4321,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Business and Economy,Allowed",
            "2026-04-18T13:52:14Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,vendor.example,/invoices/INV-2026-0418,GET,200,18211,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Business and Economy,Allowed",
            "2026-04-18T14:06:48Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,vendor-lookup-alike.com,/secure-payment,GET,200,2104,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Newly Registered Domains,Allowed",
            "2026-04-18T14:06:53Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,vendor-lookup-alike.com,/api/account-update,POST,200,884,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Newly Registered Domains,Allowed",
            "2026-04-18T14:07:21Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,smtp.gmail.com,/inbox,GET,200,17033,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Web-Based Email,Allowed",
            "2026-04-18T14:09:02Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,vendor.example,/account,GET,401,118,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Business and Economy,Allowed",
            "2026-04-18T14:09:11Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,vendor.example,/login,POST,200,4319,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Business and Economy,Allowed",
            "2026-04-18T14:12:33Z,j.smith@partner.example,Finance,SF Office,10.4.7.18,internal.partner.local,/wiki/wire-change-policy,GET,200,28442,Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36,Corporate Marketing,Allowed",
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
          "",
          "**Owners.** Financial-fraud routing on an Army-contracted vendor relationship runs through the cognizant contracting officer (KO) and the resource manager; the unit ISSM owns mail-gateway / DMARC follow-up under AR 25-2; the supporting ACI office is involved if attribution links the campaign to a foreign intelligence entity.",
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

This is a payroll-flavoured **Business Email Compromise (BEC)**
attempt — the attacker impersonates an employee and asks HR to
redirect direct-deposit details, intercepting the next pay run
before anyone notices.

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
          // Azure AD / Entra ID directory export via Microsoft Graph
          // PowerShell:
          //   Connect-MgGraph -Scopes "User.Read.All"
          //   Get-MgUser -All -Property
          //     DisplayName,UserPrincipalName,Mail,Department,JobTitle,
          //     EmployeeId,AccountEnabled,Manager
          //   | Select DisplayName,UserPrincipalName,Mail,Department,
          //            JobTitle,EmployeeId,AccountEnabled,
          //            @{n='Manager';e={$_.Manager.AdditionalProperties.userPrincipalName}}
          //   | Export-Csv -NoTypeInformation
          [
            "DisplayName,UserPrincipalName,Mail,Department,JobTitle,EmployeeId,AccountEnabled,Manager",
            "Alex Morales,a.morales@partner.example,a.morales@partner.example,Engineering,Senior Engineer,E1042,True,e.lee@partner.example",
            "HR Payroll (Shared),hr-payroll@partner.example,hr-payroll@partner.example,HR,,SHARED-HR-01,True,",
            "Erin Lee,e.lee@partner.example,e.lee@partner.example,Engineering,Engineering Manager,E0884,True,",
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
          "SPF fail + DMARC fail + Reply-To divergence + lookalike Return-Path together is a strong cluster. Out-of-band confirmation (call Alex on a known number) is still the operational requirement, but the technical signal supports a high-confidence determination of impersonation.\n\n**Owners.** HR + payroll + the unit ISSM (DMARC follow-up for the spoofed domain); supporting ACI if the campaign attributes to a foreign intelligence entity rather than ordinary financial fraud.",
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

  // ─── Capstone — multi-email BEC triage ──────────────────────
  {
    slug: "bec-capstone-vendor-redirect-thread-001",
    title: "BEC Capstone: A Vendor Thread Goes Sideways",
    summary:
      "Finance received three emails in the same thread from what looks like a known vendor. One of them is the lure. Read the headers, the attachment, and the vendor master record, then decide what to send back to finance.",
    skillAreas: ["email_headers", "bec", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 60,
    tags: [
      "bec",
      "email_headers",
      "report_writing",
      "inference_discipline",
      "capstone",
    ],
    lane: "email_bec",
    module: "Capstone",
    sequence: 1,
    status: "draft",
    brief: `
# Brief

The finance office forwarded a three-message thread on a Friday
afternoon. It looks like a routine vendor invoice followed by a
"correction" with new bank routing. Finance hasn't paid yet.
They want to know if it's safe to remit.

Vendor is **Northstar Integrators**, a long-standing unit
contractor. The thread is below as three separate \`.eml.txt\`
extracts. You also have the vendor master record (the
unit-of-record routing info on file) and a parsed auth-results
panel for each message.

You're not the final decision-maker; finance is. But your
read is what they're going to lean on. Be specific about which
signals are forgery on the wire vs which are just social-
engineering markers, and recommend a next step finance can
actually take this afternoon.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "01-original-invoice.eml.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "From: Billing <billing@northstar-integrators.com>",
            "To: ap-team@unit.example",
            "Date: Wed, 14 Nov 2026 09:14:08 -0600",
            "Subject: Invoice #NS-2026-0418 (Nov contract period)",
            "Message-ID: <NS-0418@mta-3.northstar-integrators.com>",
            "Reply-To: Billing <billing@northstar-integrators.com>",
            "Return-Path: <bounces@northstar-integrators.com>",
            "Received: from mta-3.northstar-integrators.com (mta-3.northstar-integrators.com [203.0.113.18])",
            "  by mx-unit-1.example with ESMTPS for ap-team@unit.example;",
            "  Wed, 14 Nov 2026 15:14:14 +0000",
            "Authentication-Results: mx-unit-1.example;",
            "  spf=pass (mta-3.northstar-integrators.com: domain of bounces@northstar-integrators.com designates 203.0.113.18 as permitted sender) smtp.mailfrom=bounces@northstar-integrators.com;",
            "  dkim=pass (2048-bit key) header.d=northstar-integrators.com header.s=mta3;",
            "  dmarc=pass (p=reject) header.from=northstar-integrators.com",
            "",
            "(body, plain text)",
            "  Hello AP,",
            "  Attached is invoice NS-2026-0418 for the November",
            "  contract period. Net 30. Wire instructions on file",
            "  are unchanged.",
            "  -- Billing, Northstar Integrators",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "02-correction-followup.eml.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "From: \"Billing - Northstar Integrators\" <billing@northstar-integraters.com>",
            "To: ap-team@unit.example",
            "Date: Fri, 16 Nov 2026 13:42:22 -0600",
            "Subject: RE: Invoice #NS-2026-0418 (Nov contract period)",
            "In-Reply-To: <NS-0418@mta-3.northstar-integrators.com>",
            "Message-ID: <a8c1-44518@send.relayhub-mailer.net>",
            "Reply-To: \"Billing\" <ap-updates@protonmail.com>",
            "Return-Path: <bounces@relayhub-mailer.net>",
            "Received: from send.relayhub-mailer.net (send.relayhub-mailer.net [198.51.100.42])",
            "  by mx-unit-1.example with ESMTPS for ap-team@unit.example;",
            "  Fri, 16 Nov 2026 19:42:30 +0000",
            "Authentication-Results: mx-unit-1.example;",
            "  spf=pass (send.relayhub-mailer.net: domain of bounces@relayhub-mailer.net designates 198.51.100.42 as permitted sender) smtp.mailfrom=bounces@relayhub-mailer.net;",
            "  dkim=fail (no key for selector mta3) header.d=northstar-integraters.com;",
            "  dmarc=fail (p=none for northstar-integraters.com) header.from=northstar-integraters.com",
            "",
            "(body, plain text)",
            "  Hi AP team,",
            "  Quick correction on NS-2026-0418 — our processing",
            "  bank changed last week. Please update the routing",
            "  and remit per the attached. Apologies for the late",
            "  notice; we're trying to wrap up the AR batch before",
            "  the holiday.",
            "  Please reply to confirm receipt so I can flag it",
            "  internally.",
            "  -- Billing",
            "",
            "(attachment: 03-payment-update.pdf — 1 page)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "03-payment-update.pdf.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "(rendered text from 03-payment-update.pdf)",
            "",
            "  ── Northstar Integrators — Payment Update ──",
            "",
            "  Vendor: Northstar Integrators LLC",
            "  Effective: 11 Nov 2026",
            "  Reason: Banking provider change",
            "",
            "  Old routing (do not use):",
            "    Bank: Capitol Trust",
            "    Routing: 026-009-593",
            "    Account: 4418-22-7714",
            "",
            "  New routing (use immediately):",
            "    Bank: Meridian Commercial Holdings",
            "    Routing: 121-000-358",
            "    Account: 9911-04-2207",
            "    Name on account: Northstar Holdings International",
            "",
            "  Contact for questions: ap-updates@protonmail.com",
            "",
            "  -- Billing, Northstar Integrators",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "vendor-master-record.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Vendor master record — Northstar Integrators",
            "--------------------------------------------",
            "",
            "  Legal name        : Northstar Integrators LLC",
            "  Vendor ID         : V-2021-118",
            "  Onboarded         : 2021-09-14 (re-verified 2025-08-02)",
            "  Primary contact   : Diane Park, AR Manager",
            "  Phone (verified)  : +1-512-555-0118 ext 4",
            "  Billing email     : billing@northstar-integrators.com",
            "",
            "  Wire on file (unchanged since 2024-03):",
            "    Bank            : Capitol Trust",
            "    Routing         : 026-009-593",
            "    Account         : 4418-22-7714",
            "    Name on account : Northstar Integrators LLC",
            "",
            "  Last verified by call    : 2025-08-02 (D. Park to AP)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 5,
        displayName: "auth-results-side-by-side.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Auth-Results — parsed side-by-side",
            "----------------------------------",
            "",
            "  Field            | Msg 01 (original)              | Msg 02 (correction)",
            "  -----------------+--------------------------------+--------------------------------",
            "  From-domain      | northstar-integrators.com      | northstar-integraters.com",
            "  Envelope-from    | bounces@northstar-integrators  | bounces@relayhub-mailer.net",
            "  Sending IP       | 203.0.113.18                   | 198.51.100.42",
            "  Sending host     | mta-3.northstar-integrators... | send.relayhub-mailer.net",
            "  SPF              | pass                           | pass",
            "  DKIM             | pass (d=northstar-integrators) | fail (d=northstar-integraters)",
            "  DMARC            | pass                           | fail",
            "  Reply-To         | billing@northstar-integrators  | ap-updates@protonmail.com",
            "",
            "(SPF passes when the envelope-from's domain authorises the",
            " sending IP. SPF says nothing about the visible From: domain",
            " a recipient sees — that's DKIM's and DMARC's job.)",
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
          "Comparing Msg 01 and Msg 02, which of these are **on-the-wire forgery signals** (something the headers themselves prove is wrong), as opposed to social-engineering markers?",
        options: [
          {
            id: "lookalike-domain",
            label:
              "The From-domain on Msg 02 (`northstar-integraters.com`) is a lookalike of the real vendor's domain — one letter different.",
          },
          {
            id: "dkim-fail",
            label:
              "DKIM on Msg 02 fails — the signature doesn't validate against any key the sender's published domain advertises.",
          },
          {
            id: "dmarc-fail",
            label:
              "DMARC on Msg 02 fails — the visible From: domain didn't authorise the message.",
          },
          {
            id: "reply-to-mismatch",
            label:
              "The Reply-To on Msg 02 routes to a generic ProtonMail address that doesn't match the From: domain.",
          },
          {
            id: "urgency",
            label:
              "Msg 02 uses urgency language (\"trying to wrap up the AR batch before the holiday\").",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "lookalike-domain",
            "dkim-fail",
            "dmarc-fail",
            "reply-to-mismatch",
          ],
          allowMultiple: true,
        },
        debriefMd:
          "The first four are wire-evidence: lookalike From-domain, DKIM fail, DMARC fail, and Reply-To redirected to a free-mail address. Urgency is a behavioural marker — useful colour for the writeup, but not something the message headers prove on their own. SPF passing on Msg 02 doesn't rescue the case: SPF only authenticates the envelope sender (`bounces@relayhub-mailer.net`), not the visible From: domain the recipient reads.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Comparing the payment-update PDF against the vendor master record, what is **directly different**?",
        options: [
          {
            id: "routing-and-account",
            label:
              "Bank, routing number, and account number all differ from the on-file record.",
          },
          {
            id: "account-name",
            label:
              "Account name on the PDF is \"Northstar Holdings International\" — the vendor master has the legal name as \"Northstar Integrators LLC\".",
          },
          {
            id: "contact-email",
            label:
              "Contact email on the PDF is a free-mail ProtonMail address; the master record's billing email is on the vendor's own domain.",
          },
          {
            id: "phone-changed",
            label:
              "The vendor's primary phone number on the PDF is different from the verified number on the master record, which is itself a textbook impersonation signal — attackers swap the contact channel so a finance-side verification call lands at attacker-controlled infrastructure rather than the real vendor.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["routing-and-account", "account-name", "contact-email"],
          allowMultiple: true,
        },
        debriefMd:
          "Three real differences: the wire details (bank, routing, account), the name on the account (the receiving bank account is held by a *different* legal entity), and the contact channel (free-mail address rather than the vendor's own domain). The phone number isn't on the PDF at all — nothing to compare. The mismatched account holder is the loudest signal here: a legitimate banking-provider change wouldn't transfer funds into a differently-named entity.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Out of the artifacts in this set, which **single one** is the strongest standalone evidence that this is a redirect attempt rather than a legitimate banking-change request?",
        options: [
          {
            id: "auth-results",
            label:
              "The auth-results side-by-side (DKIM + DMARC fail on Msg 02; lookalike domain).",
          },
          {
            id: "account-name-mismatch",
            label:
              "The PDF's account holder name differing from the vendor master (\"Northstar Holdings International\" vs \"Northstar Integrators LLC\").",
          },
          {
            id: "urgency",
            label:
              "The urgency language in Msg 02.",
          },
          {
            id: "reply-to-protonmail",
            label:
              "The Reply-To on Msg 02 pointing to a ProtonMail address.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["account-name-mismatch"],
          allowMultiple: false,
        },
        debriefMd:
          "The account-holder mismatch is the strongest standalone signal because it's a fraud signal even setting the email aside — a legitimate bank-provider change moves the same vendor's account to a new bank; it does not change the name the account is held under. The auth-results are damning *for the email*, but a real banking change could plausibly come from a different mail relay during a vendor transition. The Reply-To and urgency are corroborating. The mismatched holder name is the artifact a counsel would lead with.",
      },
      {
        ordinal: 4,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Finance wants a next-step they can take this afternoon. What is the **single best one**?",
        options: [
          {
            id: "phone-known-good",
            label:
              "Call Diane Park at the verified phone number from the vendor master record. Ask whether a banking change is in flight. Do not use any phone number provided in Msg 02 or the attached PDF.",
          },
          {
            id: "reply-confirm",
            label:
              "Reply to Msg 02 asking the sender to confirm the new routing.",
          },
          {
            id: "pay-and-claw-back",
            label:
              "Pay against the new routing and treat any issue as a recoverable transaction later.",
          },
          {
            id: "wait-and-see",
            label:
              "Wait for the vendor to follow up if they don't hear back.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["phone-known-good"],
          allowMultiple: false,
        },
        debriefMd:
          "Phone the known-good number on file. Replying to Msg 02 confirms nothing — if the attacker controls or is reading the inbox, they'll just say *yes, please remit*. Paying against the new routing and clawing back later is an order of magnitude harder than calling Diane; wire fraud recoveries are slow and often unsuccessful. Waiting is not a response.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd: [
          "Three drafts of what to send back to the finance office. Pick the one you'd actually send.",
        ].join("\n"),
        options: [
          {
            id: "overclaim",
            label:
              "*This is a confirmed Business Email Compromise targeting your office. The legitimate vendor Northstar Integrators has been compromised — their domain is in attacker control, their mailbox is being read by the attacker (which is why the \"correction\" thread looks contextually accurate), and the attached payment-update PDF was generated using their internal templates. Do not pay against either routing until further notice. We are opening an active-incident response, contacting law enforcement, and recommending that the vendor be added to the unit blocklist for outgoing wires until the compromise is fully scoped on their side and ours.*",
          },
          {
            id: "calibrated",
            label:
              "*The first message (Wed 14 Nov, from `billing@northstar-integrators.com`) authenticates cleanly and matches the vendor on file. The second message (Fri 16 Nov), styled as a correction with new routing, comes from a lookalike domain — `northstar-integraters.com` (one letter different) — and fails DKIM and DMARC. Its Reply-To is a ProtonMail address. The attached PDF directs payment to a bank account held under a different legal entity (\"Northstar Holdings International\") than the on-file vendor name (\"Northstar Integrators LLC\"). Recommended action: do not remit against the new routing. Call Diane Park at the vendor's verified phone number on the master record (extension 4) to ask whether any banking change is actually in flight. Once that call resolves, we can decide whether this is a vendor-side compromise to escalate to them or an unrelated impersonation to report to the carrier and law-enforcement channel.*",
          },
          {
            id: "underclaim",
            label:
              "*Spot review of the thread: the original invoice (Msg 01) is from the vendor's authenticated domain and matches the on-file routing. The \"correction\" (Msg 02) names the same invoice number, references the same contract period, and uses banking-change language consistent with the vendor-consolidation events that happen routinely in commercial-software contracts. SPF passes on Msg 02 (the envelope is authenticated by the sending relay) and the message references the right invoice. Recommend remitting against the updated routing per the attached PDF and confirming receipt by replying to the existing thread; if there's a problem the vendor will respond on the same thread.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle one. It names each artifact at the resolution it actually carries — auth-results on the second message, the lookalike domain, the account-holder mismatch on the PDF — and recommends the one action finance can take this afternoon (phone call to a known-good number). The first draft declares vendor compromise and a confirmed BEC without evidence that the vendor's real domain is involved at all — the second message uses a *lookalike* domain, which is impersonation, not compromise. The third rests on SPF passing without understanding that SPF authenticates the envelope, not the visible From: domain, and recommends a reply-to-thread that an attacker reading the inbox happily confirms.",
      },
    ],
  },
];
