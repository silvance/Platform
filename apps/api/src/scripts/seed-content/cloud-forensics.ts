import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Cloud Forensics lane. Triage of cloud audit logs -- AWS
// CloudTrail, Azure Activity / sign-in, GCP Audit Logs -- for
// IAM abuse, compromised credentials, and impossible-travel
// patterns. The discipline focus is: read userIdentity (or its
// per-cloud equivalent) carefully; "eventName" alone overclaims;
// "sourceIPAddress" lies for assumed roles; data-access logging
// is off by default in every cloud.
//
// First slice: 3 scenarios covering CloudTrail AssumeRole chains,
// compromised long-lived AWS access keys, and Azure AD
// impossible-travel sign-ins. Follow-up slice adds GCP Cloud
// Audit Logs (service-account key abuse) and a cloud
// anti-forensics scenario where CloudTrail itself is tampered.

export const CLOUD_FORENSICS_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. CloudTrail AssumeRole chain ─────────────────────────
  {
    slug: "cloud-forensics-cloudtrail-assumerole-001",
    title: "CloudTrail: Who Actually Did It? Reading an AssumeRole Chain",
    summary:
      "An S3 bucket was wiped. CloudTrail shows the DeleteObject calls came from an IAM role. Read the AssumeRole chain back to the originating identity.",
    skillAreas: ["cloud_forensics", "df_artifacts", "account_compromise", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 18,
    tags: ["cloud_forensics", "aws", "cloudtrail", "iam"],
    lane: "cloud_forensics",
    module: "AWS audit triage",
    sequence: 1,
    brief: `
# Brief

The classic AWS investigation question: *who* actually performed
this action?

AWS IAM has two layers of identity:

- **IAM users + long-lived access keys** — a persistent identity
  with credentials that don't rotate unless the operator rotates
  them.
- **IAM roles + temporary credentials via STS** — short-lived
  credentials returned by \`sts:AssumeRole\`. The role is the
  *target* identity; the original IAM user (or another role) is
  the *principal* that assumed it.

Every CloudTrail event has a \`userIdentity\` field describing
who made the API call. When an action is performed using
assumed-role credentials, \`userIdentity.type\` is
\`AssumedRole\`, and the \`userIdentity.arn\` looks like
\`arn:aws:sts::123456789012:assumed-role/<RoleName>/<sessionName>\`.
The \`sessionName\` is the only clue to who assumed the role —
and it's only as trustworthy as whatever set it (typically the
IAM user's name when they ran \`aws sts assume-role\`).

The \`AssumeRole\` event itself, earlier in the trail, names the
original principal in its OWN \`userIdentity\` field. That's the
authoritative trace back.

Read the trail. Identify who actually performed the destructive
action.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "cloudtrail-deletes.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            [
              {
                eventTime: "2025-02-14T03:14:22Z",
                eventName: "DeleteObject",
                eventSource: "s3.amazonaws.com",
                awsRegion: "us-east-1",
                sourceIPAddress: "198.51.100.42",
                userAgent: "aws-cli/2.15.30 Python/3.11.6",
                requestParameters: { bucketName: "corp-finance-archive", key: "2024/Q4/forecast.xlsx" },
                userIdentity: {
                  type: "AssumedRole",
                  arn: "arn:aws:sts::123456789012:assumed-role/CorpDataReadWrite/cli-session",
                  sessionContext: {
                    sessionIssuer: {
                      type: "Role",
                      arn: "arn:aws:iam::123456789012:role/CorpDataReadWrite",
                      accountId: "123456789012",
                    },
                  },
                },
              },
              {
                eventTime: "2025-02-14T03:14:23Z",
                eventName: "DeleteObject",
                eventSource: "s3.amazonaws.com",
                awsRegion: "us-east-1",
                sourceIPAddress: "198.51.100.42",
                userIdentity: {
                  type: "AssumedRole",
                  arn: "arn:aws:sts::123456789012:assumed-role/CorpDataReadWrite/cli-session",
                  sessionContext: {
                    sessionIssuer: {
                      type: "Role",
                      arn: "arn:aws:iam::123456789012:role/CorpDataReadWrite",
                      accountId: "123456789012",
                    },
                  },
                },
                requestParameters: { bucketName: "corp-finance-archive", key: "2024/Q4/board-slides.pptx" },
              },
              { eventTime: "2025-02-14T03:14:24Z", eventName: "DeleteObject", eventSource: "s3.amazonaws.com", note: "... 1,847 more DeleteObject events with identical userIdentity, all in 3 seconds ..." },
            ],
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "cloudtrail-assumerole.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              eventTime: "2025-02-14T03:14:01Z",
              eventName: "AssumeRole",
              eventSource: "sts.amazonaws.com",
              awsRegion: "us-east-1",
              sourceIPAddress: "203.0.113.77",
              userAgent: "aws-cli/2.15.30 Python/3.11.6",
              requestParameters: {
                roleArn: "arn:aws:iam::123456789012:role/CorpDataReadWrite",
                roleSessionName: "cli-session",
                durationSeconds: 3600,
              },
              responseElements: {
                credentials: {
                  accessKeyId: "ASIA...REDACTED",
                  expiration: "2025-02-14T04:14:01Z",
                },
              },
              userIdentity: {
                type: "IAMUser",
                arn: "arn:aws:iam::123456789012:user/m.bauer",
                userName: "m.bauer",
                accessKeyId: "AKIA...M_BAUERS_KEY",
                accountId: "123456789012",
              },
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "iam-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "IAM context (pulled as part of the IR run)",
            "",
            "Role: CorpDataReadWrite",
            "    Path: /service-roles/",
            "    Trust policy permits: AssumeRole by any IAM user in account 123456789012",
            "    Attached policies: AmazonS3FullAccess",
            "    Created: 2023-09-04",
            "",
            "User: m.bauer",
            "    Last access-key rotation: 2024-08-12 (~6 months ago)",
            "    MFA: not enrolled",
            "    Group memberships: Engineering, RoleAssumers",
            "    Console login: never (programmatic-only account)",
            "    Note from owning team: m.bauer is a finance-data analyst, primary",
            "    duties are read-only reporting; access-key is in a 1Password vault",
            "    shared with two backup analysts.",
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
          "Which statements are **directly supported** by these artifacts? Select all that apply.",
        options: [
          {
            id: "role-deleted",
            label:
              "The S3 deletions were issued under credentials returned by an `sts:AssumeRole` against `CorpDataReadWrite`; `userIdentity.type` is `AssumedRole` for every DeleteObject.",
          },
          {
            id: "mbauer-assumed",
            label:
              "The `AssumeRole` was performed by IAM user `m.bauer`, whose access key `AKIA...M_BAUERS_KEY` is named in the AssumeRole event's `userIdentity`.",
          },
          {
            id: "mbauer-actor",
            label:
              "`m.bauer` is the actor responsible for the deletions — the IAM user, the human.",
          },
          {
            id: "src-ip-conflict",
            label:
              "The source IP for the AssumeRole call (`203.0.113.77`) does not match the source IP for the subsequent DeleteObject calls (`198.51.100.42`).",
          },
          {
            id: "ip-mismatch-attack",
            label:
              "The two-IP pattern proves the credentials were exfiltrated — the AssumeRole was issued from one host and the temporary credentials were then used from a different host that the IAM user has no reason to be on.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["role-deleted", "mbauer-assumed", "src-ip-conflict"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- *Role deleted the objects.* The DeleteObject events' `userIdentity.type` is `AssumedRole` and the `sessionIssuer.arn` points at the role. Unambiguous.",
          "- *m.bauer's key did the AssumeRole.* The AssumeRole event's `userIdentity` names the IAM user and the access key ID explicitly. This is the authoritative trace-back the trail provides.",
          "- *Source-IP mismatch.* AssumeRole from `203.0.113.77` (US-residential range — sample), DeleteObjects from `198.51.100.42` (different network). The two IPs are different and the trail records both. Note: this is **expected for some legitimate flows** (e.g. AssumeRole on a jump host, then use the temp creds from a CI runner), so on its own it's a flag, not a finding.",
          "",
          "**Not proven (over-claims):**",
          "",
          "- *m.bauer is the actor.* The trail proves m.bauer's **access key** was used. Whether m.bauer the human did it is a separate question — the key is in a shared 1Password vault (per the IAM context), MFA isn't enrolled, and the source IP isn't m.bauer's known address. Naming the human needs out-of-band confirmation (interview, key-vault audit log, network-side correlation to m.bauer's workstation).",
          "- *Two-IP pattern proves exfil.* It's *suggestive*. Legitimate workflows produce the same shape. The discipline is naming the IPs, naming the time gap (22 seconds), and naming the corroboration that would close the question.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "text_match",
        weight: 1,
        promptMd:
          "Which IAM user's access key was used to perform the AssumeRole? (Just the username.)",
        textMatch: {
          acceptableAnswers: ["m.bauer", "m_bauer", "mbauer", "bauer", "m. bauer"],
          hint: "Look at the AssumeRole event's `userIdentity.userName` field, not the DeleteObject events.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["m.bauer", "m_bauer", "mbauer", "bauer", "m. bauer"],
          regex: false,
        },
        debriefMd:
          "**m.bauer.** The AssumeRole event names the principal explicitly in `userIdentity.userName` and `userIdentity.arn`. The DeleteObject events only show the assumed-role session, so reading just those would have left the principal anonymous; the AssumeRole event is the trace back.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that m.bauer (the person) maliciously deleted the bucket contents, based only on these artifacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The trail proves m.bauer's access key was used; nothing in the trail proves the key was in m.bauer's possession at the time. The access key is in a shared vault accessible to two other analysts. MFA isn't enrolled. Source IP doesn't match m.bauer's typical work network (per the IAM context). The artifacts here support an *access-key compromise* hypothesis at least as well as the *m.bauer did it* hypothesis — and disambiguating requires the key vault's audit log, m.bauer's workstation's outbound flow logs around 03:14, and an interview.",
      },
    ],
  },

  // ─── 2. Compromised access key ──────────────────────────────
  {
    slug: "cloud-forensics-compromised-access-key-001",
    title: "AWS Access Key Used From a Region the User Has Never Touched",
    summary:
      "An IAM access key starts making API calls from ap-southeast-2. The user's based in the US and has never touched anything outside us-east-1. Triage the trail.",
    skillAreas: ["cloud_forensics", "account_compromise", "df_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 15,
    tags: ["cloud_forensics", "aws", "cloudtrail", "credential_compromise"],
    lane: "cloud_forensics",
    module: "AWS audit triage",
    sequence: 2,
    brief: `
# Brief

Long-lived AWS access keys (the \`AKIA...\` kind) are persistent
credentials with no expiration unless someone rotates them. When
they leak — in a public GitHub commit, a stolen laptop, a
phishing kit — there's no tenancy-side detection until the
attacker uses them.

The triage signal: **API calls from regions, source IPs, or
user-agents the legitimate operator has never used.** AWS
GuardDuty surfaces some of these as findings; CloudTrail
captures every call regardless. A clean read of CloudTrail
filtered to one access key over a short window is one of the
most informative cloud-forensic artifacts there is.

Read the trail. Decide what's proven, what's suggestive, and
what the right immediate response is.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "cloudtrail-window.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "CloudTrail events for access key AKIA...J5AY  (2025-03-04 22:14 — 23:01 UTC)",
            "    Filtered to userIdentity.accessKeyId = AKIA...J5AY  (k.tran's key)",
            "",
            "Time (UTC)            Region          EventName             SourceIP            UserAgent",
            "-----------------------------------------------------------------------------------------",
            "2025-03-04 22:14:09   ap-southeast-2  ListBuckets           203.0.113.211       Boto3/1.34.0 Python/3.10",
            "2025-03-04 22:14:22   ap-southeast-2  GetBucketPolicy       203.0.113.211       Boto3/1.34.0 Python/3.10",
            "    (called against 14 buckets in quick succession)",
            "2025-03-04 22:15:47   ap-southeast-2  ListObjectsV2         203.0.113.211       Boto3/1.34.0 Python/3.10",
            "    (against corp-customer-pii)",
            "2025-03-04 22:17:31   ap-southeast-2  GetObject             203.0.113.211       Boto3/1.34.0 Python/3.10",
            "    (corp-customer-pii/exports/2025-02-customer-list.csv, 4.1 MB)",
            "2025-03-04 22:18:09   ap-southeast-2  GetObject             203.0.113.211       Boto3/1.34.0 Python/3.10",
            "    (corp-customer-pii/exports/2025-01-customer-list.csv, 3.8 MB)",
            "    (... 47 more GetObject events against corp-customer-pii in 12 minutes ...)",
            "",
            "2025-03-04 22:48:01   us-east-1       GetObject             198.51.100.4        Boto3/1.34.0 Python/3.10",
            "    (data-pipeline/scratch/run-2025-03-04.log)",
            "2025-03-04 22:58:14   us-east-1       PutObject             198.51.100.4        Boto3/1.34.0 Python/3.10",
            "    (data-pipeline/scratch/run-2025-03-04.json)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "user-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Account context — IAM user k.tran",
            "",
            "Identity",
            "    arn:aws:iam::123456789012:user/k.tran",
            "    Job: senior data engineer, data-pipeline team",
            "    Office: Austin, TX (us-east-1 work network)",
            "    MFA: enrolled (TOTP), not required for programmatic access",
            "",
            "Access keys",
            "    AKIA...J5AY   created 2024-07-09  last rotated 2024-07-09",
            "                  used continuously for the data-pipeline jobs above",
            "",
            "Region history (per CloudTrail aggregations for the prior 90 days)",
            "    us-east-1  : 98.6%  (all production data-pipeline work)",
            "    us-east-2  :  1.4%  (DR-failover testing, monthly)",
            "    other      :  0.0%  (never)",
            "",
            "Owning team's note",
            "    k.tran's key is used by a single CI runner in us-east-1 plus an",
            "    occasional `aws` CLI invocation from k.tran's laptop. Neither",
            "    has any business reason to touch ap-southeast-2 or corp-customer-pii.",
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
          "Which statements are **directly supported** by the CloudTrail + IAM context?",
        options: [
          {
            id: "key-out-of-pattern",
            label:
              "Access key `AKIA...J5AY` was used from `ap-southeast-2` (203.0.113.211) between 22:14 and roughly 22:30 UTC — a region this key has never touched in the prior 90 days.",
          },
          {
            id: "pii-list-and-read",
            label:
              "During the same window, the key listed and then downloaded multiple CSV files from `corp-customer-pii` — a bucket the legitimate workload (us-east-1 data-pipeline) has no documented reason to read.",
          },
          {
            id: "us-east-1-resumed",
            label:
              "Roughly half an hour later, the key resumed making API calls from us-east-1 against the data-pipeline scratch bucket, consistent with the legitimate CI runner continuing its scheduled work.",
          },
          {
            id: "two-actors",
            label:
              "There are now two actors using this access key concurrently — the legitimate CI runner from us-east-1 and an unknown principal from ap-southeast-2.",
          },
          {
            id: "data-exfiltrated",
            label:
              "Customer PII has been exfiltrated to the attacker's machine; the GetObject events prove the data left the AWS tenancy.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["key-out-of-pattern", "pii-list-and-read", "us-east-1-resumed", "two-actors"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- *Out-of-pattern usage* — the region + source IP + bucket selection are all outside the key's 90-day baseline.",
          "- *PII bucket listed + read* — the eventNames + resource ARNs say exactly that.",
          "- *us-east-1 work resumed* — the trail shows the legitimate flow continuing after the burst.",
          "- *Two concurrent actors* — the same access key was used from two different IPs in two different regions within 35 minutes. The key is in active legitimate use AND in active illegitimate use simultaneously. This is the **compromised long-lived key** signature.",
          "",
          "**Not proven (overclaim):**",
          "",
          "- *Data exfiltrated.* `GetObject` proves the API call returned bytes to the caller; the caller (203.0.113.211) is the attacker's vantage point. From the **tenancy's** perspective, the bytes definitely left the bucket. But whether the bytes ended up at rest somewhere the attacker controls (vs landing in transit at a CDN, vs being read but not stored) is a different claim. The defensible writeup is: *\"203.0.113.211 retrieved <list of objects, total ~XX MB>\"* — that's what the trail supports.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What is the **single best immediate response**?",
        options: [
          {
            id: "delete-key",
            label:
              "Delete (not deactivate) `AKIA...J5AY` immediately, rotate the legitimate workload to a new key, and start the incident-response process. Notify the customer-PII owner and counsel.",
          },
          {
            id: "deactivate-key",
            label:
              "Deactivate the key (`UpdateAccessKey Status=Inactive`) but leave it in place so any further attacker activity is captured in CloudTrail. The CI runner can be switched to a new key during business hours.",
          },
          {
            id: "wait-and-watch",
            label:
              "Leave the key active and watch CloudTrail for 24 more hours to characterise the attacker's behaviour and capture indicators for the writeup. Containment is premature without confirmed scope.",
          },
          {
            id: "interview-first",
            label:
              "Interview k.tran first to rule out a legitimate explanation (maybe they're on travel in Sydney). Don't touch the key until that's done.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["delete-key"],
          allowMultiple: false,
        },
        debriefMd: [
          "**Delete + rotate + IR.** The compromised-key signature is strong enough to act on immediately; further attacker activity is more harmful than the CI-runner downtime of swapping the key.",
          "",
          "*Why not the others:*",
          "",
          "- *Deactivate, watch:* deactivation IS effective, but \"leave it active to capture more\" lets the attacker continue downloading PII. The compromise is already confirmed; further observation isn't worth the data-loss cost.",
          "- *Wait and watch:* same problem, worse. \"Characterise the attacker's behaviour\" reads as IR theatre when active exfil is in progress.",
          "- *Interview first:* legitimate-explanation possibilities (k.tran traveling) don't account for the concurrent us-east-1 calls 30 minutes later. The trail itself rules out a single-actor explanation. Containment first, interview during.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that this is a credential compromise (not a legitimate edge case), based only on these artifacts.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "**4 or 5.** The combination — out-of-pattern region, unfamiliar source IP, access to a bucket outside the workload's documented scope, **concurrent** use from the legitimate region, plus the affected user's own team confirming neither operator should be touching that bucket — is the textbook compromised-access-key shape. The remaining residual uncertainty (is this somehow a sanctioned exercise, an unannounced red-team) doesn't lower confidence below 4; it just means you call counsel + the AWS-account owner before broadcasting.",
      },
    ],
  },

  // ─── 3. Azure AD impossible travel ──────────────────────────
  {
    slug: "cloud-forensics-azure-impossible-travel-001",
    title: "Azure AD: Impossible Travel and the Conditional Access That Didn't Trigger",
    summary:
      "Two successful sign-ins for the same user from two cities 9,000 km apart, 14 minutes apart. Read the sign-in log and decide what's proven.",
    skillAreas: ["cloud_forensics", "account_compromise", "df_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 15,
    tags: ["cloud_forensics", "azure", "entra", "sign_in_logs", "conditional_access"],
    lane: "cloud_forensics",
    module: "Azure / Entra triage",
    sequence: 3,
    brief: `
# Brief

Azure AD (now formally Microsoft Entra ID) logs every user
sign-in to its **Sign-in Logs**. Each entry carries:

- The user (UPN + object ID)
- Authentication method (password, FIDO2, certificate, etc.)
- Geo-location of the source IP (best-effort, IP-database driven)
- The application being signed into
- The Conditional Access policies evaluated, with the verdict
- Risk-detection signal (Microsoft Entra ID P2's "User Risk" +
  "Sign-in Risk" engines)

**Impossible travel** is the classic pattern: two successful
sign-ins from two locations the user couldn't physically be at
both of in the time elapsed. It's detected by Microsoft's risk
engine but **only on P2** and only if risk-based Conditional
Access is configured to block; on P1 / P0 it surfaces as a sign
in the Sign-in Logs but doesn't take action.

Read the sign-in log. Decide what's proven and what's not.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "signin-log.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Entra Sign-in Logs (interactive) — user d.okafor@contoso.com",
            "Filtered to 2025-04-11, all successful",
            "",
            "Time (UTC)            IP                Geo              App                  AuthMethod    CA Result        Risk",
            "----------------------------------------------------------------------------------------------------------",
            "2025-04-11 13:02:11   203.0.113.18      Lagos, NG        Office 365 Web       Password+TOTP success         none",
            "2025-04-11 13:16:48   198.51.100.7      Frankfurt, DE    Microsoft Graph PS   Password+TOTP success         none",
            "",
            "(no other successful sign-ins for this user that day)",
            "",
            "Failed sign-ins for the same user in the surrounding window",
            "",
            "Time (UTC)            IP                Geo              App                  AuthMethod    Failure",
            "----------------------------------------------------------------------------------------------------------",
            "2025-04-11 12:58:03   198.51.100.7      Frankfurt, DE    Microsoft Graph PS   Password      50126 (bad pw)",
            "2025-04-11 12:58:51   198.51.100.7      Frankfurt, DE    Microsoft Graph PS   Password      50126 (bad pw)",
            "2025-04-11 12:59:34   198.51.100.7      Frankfurt, DE    Microsoft Graph PS   Password      50126 (bad pw)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "ca-policy.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Conditional Access policy state at the time of the sign-ins",
            "",
            "Tenant license: Microsoft Entra ID P1",
            "    (P2 features -- including risk-based Conditional Access and",
            "     Identity Protection's Impossible Travel detection in",
            "     evaluation mode -- are NOT licensed in this tenant.)",
            "",
            "Active policies (relevant ones only):",
            "",
            "  CA-001: Require MFA for all users",
            "    Conditions: any cloud app, any user",
            "    Controls: require MFA",
            "    State: ON",
            "",
            "  CA-005: Block legacy authentication protocols",
            "    Conditions: any user, client-app = legacy auth",
            "    Controls: block",
            "    State: ON",
            "",
            "  CA-014: Country-based block",
            "    Conditions: any user, location IN named-list 'Sanctioned Countries'",
            "    Controls: block",
            "    State: ON",
            "    Named list 'Sanctioned Countries' contents: IR, KP, CU, SY, RU",
            "    (Nigeria, Germany NOT in this list.)",
            "",
            "Notes",
            "    No risk-based policy is configured. Sign-in Risk and User",
            "    Risk events are emitted by Entra at the P1 level for visibility",
            "    only -- no enforcement action is taken on them.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "user-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Account context — d.okafor@contoso.com",
            "",
            "Office: Frankfurt, DE  (primary work location)",
            "Travel history (per HR system): no business travel in the prior",
            "    30 days; not currently on PTO.",
            "MFA enrollment: TOTP (Microsoft Authenticator app)",
            "Mobile device: iPhone enrolled in Intune, last check-in",
            "    2025-04-11 12:54:01 UTC from 198.51.100.7 (Frankfurt).",
            "",
            "Note: 203.0.113.18 (Lagos, NG) is not a known VPN-egress IP for",
            "      contoso.com. No corporate VPN concentrator there.",
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
          "Which statements are **directly supported** by the sign-in log + Conditional Access state + user context?",
        options: [
          {
            id: "two-success",
            label:
              "Two successful sign-ins for d.okafor occurred 14 minutes apart, one from Lagos and one from Frankfurt — geographically impossible at any human-feasible travel speed.",
          },
          {
            id: "both-mfa",
            label:
              "**Both** sign-ins completed the MFA challenge (Password + TOTP) — the attacker (whichever of the two) had access to the user's TOTP code, not just the password.",
          },
          {
            id: "ca-blocked",
            label:
              "Conditional Access blocked the Lagos sign-in because Nigeria isn't on the org's allowed-countries list.",
          },
          {
            id: "p2-missing",
            label:
              "The tenant is on Entra P1, so Microsoft's built-in Impossible Travel detection didn't take any blocking action — the risk signal would appear in the logs at most, not in real-time enforcement.",
          },
          {
            id: "lagos-attacker",
            label:
              "The Lagos sign-in is the attacker; the Frankfurt sign-in is legitimate d.okafor work.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["two-success", "both-mfa", "p2-missing"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- *Two successful sign-ins, 14 minutes apart, ~6,000 km apart.* The log timestamps + IP geolocations + success flags are unambiguous.",
          "- *Both sign-ins completed MFA.* The AuthMethod column says `Password+TOTP` for both. The attacker had the TOTP code at the moment of sign-in, which usually means: real-time phishing (an Adversary-in-the-Middle proxy intercepted both the password AND the TOTP), session-token theft (stolen `EstsAuthCookie` from a prior session), or a SIM-swap on the TOTP-bearing device. The log itself doesn't distinguish these.",
          "- *P2 features not in play.* The CA policy state explicitly says P1 license, no risk-based policy. Impossible Travel detection emits the signal but doesn't enforce.",
          "",
          "**Not proven:**",
          "",
          "- *CA blocked Lagos.* CA didn't block — the country-based block policy uses a named list that doesn't include Nigeria. Lagos was allowed.",
          "- *Lagos is the attacker.* The geographic + timing pattern says one of the two is illegitimate. Which one needs the corroboration: the failed-password attempts from 198.51.100.7 BEFORE the successful Frankfurt sign-in suggest someone was credential-stuffing FROM Frankfurt's IP. So the Lagos sign-in MAY actually be the legitimate user (on a VPN or unusual network), and the Frankfurt sign-in MAY be the attacker who'd been brute-forcing and finally got through. The trail doesn't settle it; the user interview + Intune device check-in + endpoint telemetry from d.okafor's actual workstation does.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which corroborating sources would best determine **which** sign-in is the legitimate one?",
        options: [
          { id: "intune", label: "Intune device check-in records around the Frankfurt sign-in time — was d.okafor's enrolled iPhone actively present at 198.51.100.7 in that window?" },
          { id: "endpoint", label: "Endpoint telemetry from d.okafor's primary workstation — did it run an authenticator app, render the Office 365 portal, or otherwise show evidence of the user being present?" },
          { id: "interview", label: "Out-of-band call to d.okafor (using the HR phone number, not anything in the user directory the attacker could rewrite) to confirm where they were at 13:02 UTC and whether they signed in." },
          { id: "block-lagos", label: "Block 203.0.113.18 at the tenant firewall — the attacker IP is determined to be the foreign one because it's not on a known VPN-egress range." },
          { id: "ip-reputation", label: "Run 203.0.113.18 and 198.51.100.7 through threat-intel feeds and assume the one with worse reputation is the attacker." },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["intune", "endpoint", "interview"],
          allowMultiple: true,
        },
        debriefMd: [
          "Intune + endpoint + interview are the three real corroboration surfaces. Each independently distinguishes \"d.okafor's actual workstation was there\" from \"the attacker was using d.okafor's name.\"",
          "",
          "**Wrong:**",
          "",
          "- *Block Lagos because it's not a VPN-egress range.* The tempting move — but the failed-password attempts came from the Frankfurt IP, which would normally read as the legitimate location. Acting on geo-assumption alone gets the wrong sign-in. The disciplined response is to revoke ALL sessions for the user and require fresh re-auth, not to triage by IP.",
          "- *IP reputation.* Reputation feeds correlate well with mass-attack infrastructure but poorly with targeted account compromise. Both IPs here are plausibly legitimate residential ranges; reputation won't disambiguate.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the user's account is compromised, based only on these artifacts.",
        expected: { type: "confidence", expectedRange: [4, 5] },
        debriefMd:
          "**4 or 5.** Two MFA-passing sign-ins, 14 minutes apart, on different continents, with three prior failed-password attempts from one of them — this is account compromise. The unresolved question is **which side** is the attacker (Lagos or the Frankfurt account that may have been brute-forced first), not whether there's an attacker.",
      },
    ],
  },

  // ─── 4. GCP service-account key abuse ───────────────────────
  {
    slug: "cloud-forensics-gcp-service-account-key-001",
    title: "GCP Audit Logs: Service-Account JSON Key Used From Outside the Project",
    summary:
      "A leaked service-account JSON key gets used from an unfamiliar IP to read BigQuery and add new IAM bindings. Read the Cloud Audit Logs and separate proven attacker actions from collateral noise.",
    skillAreas: ["cloud_forensics", "account_compromise", "df_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 18,
    tags: ["cloud_forensics", "gcp", "audit_logs", "service_account", "iam"],
    lane: "cloud_forensics",
    module: "GCP audit triage",
    sequence: 1,
    brief: `
# Brief

Google Cloud's audit story is split across **three log
streams**, and which one a given action lands in changes what
you can and cannot prove from a trail:

- **Admin Activity** — IAM bindings, resource creation /
  deletion, project metadata changes. **Always on**, can't be
  disabled, retained 400 days by default. The trail that always
  exists.
- **Data Access** — reads and writes of *user data* (BigQuery
  queries, GCS object reads, Pub/Sub message reads). **Off by
  default** for everything except BigQuery DATA_READ /
  DATA_WRITE. If Data Access logging wasn't turned on, the read
  *happened* but you cannot prove it from logs alone.
- **System Event** — Google-initiated actions (autoscaling,
  internal scheduling). Rarely useful for investigation.

GCP's "principal" model also differs from AWS / Azure: a
\`serviceAccount:foo@project.iam.gserviceaccount.com\` is a
first-class identity, and any holder of a **service-account
JSON key** can authenticate as that service account from any
network. Service-account keys don't expire; they don't rotate;
they're persistent credentials of exactly the kind that should
not exist at all but always do.

A leaked service-account key looks, in the trail, like the
service account itself doing the thing — which it is. Reading
the trail is then about whether the IP, user-agent, region, and
**timing** are consistent with the workload the service account
was created for, or with a human (or attacker) using the key
out of band.

Read the audit logs. Decide what's proven.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "admin-activity.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            [
              {
                logName: "projects/acme-data-prod/logs/cloudaudit.googleapis.com%2Factivity",
                timestamp: "2025-08-22T18:41:09Z",
                protoPayload: {
                  serviceName: "iam.googleapis.com",
                  methodName: "SetIamPolicy",
                  resourceName: "projects/acme-data-prod",
                  authenticationInfo: {
                    principalEmail:
                      "etl-loader@acme-data-prod.iam.gserviceaccount.com",
                    serviceAccountKeyName:
                      "projects/acme-data-prod/serviceAccounts/etl-loader@acme-data-prod.iam.gserviceaccount.com/keys/3f9ac21b8e",
                  },
                  requestMetadata: {
                    callerIp: "45.142.x.x",
                    callerSuppliedUserAgent: "google-cloud-sdk/473.0.0 (gcloud) Darwin/24.0.0",
                  },
                  request: {
                    policy: {
                      bindings: [
                        {
                          role: "roles/owner",
                          members: ["serviceAccount:etl-loader@acme-data-prod.iam.gserviceaccount.com"],
                        },
                      ],
                    },
                  },
                },
              },
              {
                logName: "projects/acme-data-prod/logs/cloudaudit.googleapis.com%2Factivity",
                timestamp: "2025-08-22T18:42:01Z",
                protoPayload: {
                  serviceName: "iam.googleapis.com",
                  methodName: "CreateServiceAccountKey",
                  resourceName:
                    "projects/acme-data-prod/serviceAccounts/etl-loader@acme-data-prod.iam.gserviceaccount.com",
                  authenticationInfo: {
                    principalEmail:
                      "etl-loader@acme-data-prod.iam.gserviceaccount.com",
                    serviceAccountKeyName:
                      "projects/acme-data-prod/serviceAccounts/etl-loader@acme-data-prod.iam.gserviceaccount.com/keys/3f9ac21b8e",
                  },
                  requestMetadata: {
                    callerIp: "45.142.x.x",
                    callerSuppliedUserAgent: "google-cloud-sdk/473.0.0 (gcloud) Darwin/24.0.0",
                  },
                },
              },
            ],
            null,
            2,
          ),
        ),
      },
      {
        ordinal: 2,
        displayName: "data-access-bigquery.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            [
              {
                logName: "projects/acme-data-prod/logs/cloudaudit.googleapis.com%2Fdata_access",
                timestamp: "2025-08-22T18:38:14Z",
                protoPayload: {
                  serviceName: "bigquery.googleapis.com",
                  methodName: "google.cloud.bigquery.v2.JobService.InsertJob",
                  authenticationInfo: {
                    principalEmail:
                      "etl-loader@acme-data-prod.iam.gserviceaccount.com",
                    serviceAccountKeyName:
                      "projects/acme-data-prod/serviceAccounts/etl-loader@acme-data-prod.iam.gserviceaccount.com/keys/3f9ac21b8e",
                  },
                  requestMetadata: {
                    callerIp: "45.142.x.x",
                    callerSuppliedUserAgent: "google-cloud-sdk/473.0.0 (gcloud) Darwin/24.0.0",
                  },
                  metadata: {
                    jobChange: {
                      job: {
                        jobConfig: {
                          queryConfig: {
                            query:
                              "SELECT customer_id, email, ssn_last4, plaintext_token FROM `acme-data-prod.warehouse.customers` LIMIT 50000",
                            destinationTable:
                              "acme-data-prod:scratch.tmp_2025_08_22_extract",
                          },
                        },
                        jobStats: {
                          totalProcessedBytes: "4_812_993_104",
                        },
                      },
                    },
                  },
                },
              },
            ],
            null,
            2,
          ),
        ),
      },
      {
        ordinal: 3,
        displayName: "service-account-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Service account context (out-of-band)",
            "-------------------------------------",
            "",
            "Service account : etl-loader@acme-data-prod.iam.gserviceaccount.com",
            "Created          : 2023-06-04 (by SRE during ETL pipeline migration)",
            "Documented purpose : Nightly ETL — read Cloud Storage staging bucket,",
            "                     write BigQuery tables in `warehouse` dataset.",
            "Documented runtime : Cloud Run job, region us-central1.",
            "Documented IAM    : roles/bigquery.dataEditor on `warehouse` dataset,",
            "                    roles/storage.objectViewer on staging bucket.",
            "Documented schedule : nightly 02:00 UTC.",
            "",
            "Key audit (gcloud iam service-accounts keys list):",
            "  KEY_ID            CREATED_AT            DISABLED",
            "  3f9ac21b8e        2024-11-18 14:02 UTC  False",
            "  a08e7c4d12        2023-06-04 18:11 UTC  False  (Cloud Run mount)",
            "",
            "Source-IP context:",
            "  Cloud Run egress for us-central1 ETL jobs typically appears as",
            "  35.x.x.x ranges. `45.142.x.x` is NOT a Google-owned range; geo",
            "  lookup places it in Vilnius, LT (residential / VPS).",
            "",
            "Schedule context:",
            "  The 18:38 UTC and 18:41 UTC timestamps are outside the",
            "  documented 02:00 UTC nightly window.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 4,
        displayName: "data-access-logging-status.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Data Access logging configuration for project acme-data-prod",
            "-------------------------------------------------------------",
            "",
            "  bigquery.googleapis.com      DATA_READ   : enabled (project default)",
            "  bigquery.googleapis.com      DATA_WRITE  : enabled (project default)",
            "  storage.googleapis.com       DATA_READ   : NOT enabled",
            "  storage.googleapis.com       DATA_WRITE  : NOT enabled",
            "  secretmanager.googleapis.com DATA_READ   : NOT enabled",
            "  secretmanager.googleapis.com DATA_WRITE  : NOT enabled",
            "",
            "(Admin Activity is always on for every service and cannot be",
            " disabled. The above governs DATA_READ / DATA_WRITE only.)",
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
          "Which statements about this trail are **proven** by the artifacts on hand?",
        options: [
          {
            id: "key-3f9-used",
            label:
              "The service-account key with ID `3f9ac21b8e` was used to authenticate every action shown in the logs.",
          },
          {
            id: "ip-not-google",
            label:
              "The caller IP `45.142.x.x` is outside Google's owned ranges and outside the documented Cloud Run egress pattern for this workload.",
          },
          {
            id: "bigquery-read",
            label:
              "A BigQuery query reading `customers` (including PII columns) was executed and ~4.8 GB processed.",
          },
          {
            id: "iam-self-elevate",
            label:
              "The service account granted itself `roles/owner` on the project.",
          },
          {
            id: "gcs-read-proven",
            label:
              "Cloud Storage objects in the staging bucket were also read by the attacker.",
          },
          {
            id: "secrets-read-proven",
            label:
              "Secret Manager secrets were also read by the attacker.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["key-3f9-used", "ip-not-google", "bigquery-read", "iam-self-elevate"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- *Key 3f9 used.* Every event names `serviceAccountKeyName: ...keys/3f9ac21b8e` in `authenticationInfo`. That field is set by Google's auth layer based on which signed JWT the caller presented; the attacker can't forge it.",
          "- *IP off-pattern.* The service-account context names Google's expected egress ranges (`35.x.x.x`) and documents the runtime as Cloud Run in us-central1. `45.142.x.x` is plainly outside that. This is a Vilnius VPS-range observation — strong on-its-face, but it's a *flag* (a workload could in theory have been misconfigured), and the corroboration that closes it is the IAM self-elevation in the same key's session.",
          "- *BigQuery read.* The Data Access log captured the InsertJob with the full query text and processed-bytes count. Data Access for BigQuery DATA_READ is enabled, so this is recorded authoritatively.",
          "- *IAM self-elevation.* SetIamPolicy granting `roles/owner` to the service account itself, by the service account itself, is in Admin Activity (always on). It happened.",
          "",
          "**Not proven:**",
          "",
          "- *GCS read.* The service-account context says GCS is part of the workload, but Data Access for `storage.googleapis.com` is **not enabled** for this project. The attacker may or may not have pulled the staging bucket; the trail cannot prove either way. This is the classic GCP gap.",
          "- *Secrets read.* Same problem: Secret Manager Data Access not enabled. Plus, no Admin-Activity event for the secret resources, so we can't even see whether they were accessed at all.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Within the next 30 minutes, which actions should the on-call cloud-forensics analyst take? (Pick all that should run in parallel.)",
        options: [
          {
            id: "disable-key",
            label: "Disable key `3f9ac21b8e` immediately.",
          },
          {
            id: "revoke-binding",
            label:
              "Revoke the new `roles/owner` IAM binding on the project.",
          },
          {
            id: "enable-data-access",
            label:
              "Enable Data Access logging for GCS and Secret Manager *now*, to start capturing any further reads.",
          },
          {
            id: "rotate-other-key",
            label:
              "Rotate the older key (`a08e7c4d12`) used by the Cloud Run mount, in case it was the leaked one.",
          },
          {
            id: "delete-service-account",
            label:
              "Delete the service account outright (cleanest containment).",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["disable-key", "revoke-binding", "enable-data-access"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right moves:**",
          "",
          "- *Disable key 3f9.* It's the credential the trail names. Disable (not delete) preserves the key record for the IR write-up. Five-second action; should be first.",
          "- *Revoke the new binding.* The self-granted `roles/owner` binding has to come off before any further attacker action; it lets the attacker re-issue keys, create new service accounts, change logging configuration, etc.",
          "- *Enable Data Access for GCS + Secret Manager.* Won't tell you what already happened, but stops the trail from going blind on a still-active attacker. Cheap and reversible.",
          "",
          "**Wrong:**",
          "",
          "- *Rotate the other key.* The trail names `3f9ac21b8e`, not `a08e7c4d12`. Rotating the in-use Cloud Run key blindly will break the legitimate workload at 02:00 and doesn't address the proven compromise. Investigate first; if the older key is also implicated, rotate then — but not pre-emptively in the same 30 minutes as the contain.",
          "- *Delete the service account.* Tempting but destroys the IAM history attached to the principal and breaks the legitimate ETL job. Disabling the key contains the credential; the account itself can be cleaned up after the IR write-up.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the Cloud Storage staging bucket *was* also read by the attacker.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2 or 3.** It's *plausible* — a credential with the documented IAM scope could read the bucket and would be operationally interesting to an attacker — but Data Access logging is off for `storage.googleapis.com`, so there is no trail evidence either way. \"Likely, but not proven from these artifacts\" is the honest read; raising confidence to 4+ would over-claim. Closing the question requires VPC Flow Logs from the bucket's egress side, billing data showing read-volume spike, or a forensic image of any object that the attacker stashed elsewhere. The discipline: name the gap in the cover-sheet so the reader knows the absence of evidence is structural, not exonerating.",
      },
    ],
  },

  // ─── 5. CloudTrail tampering (cloud anti-forensics) ─────────
  {
    slug: "cloud-forensics-cloudtrail-tampering-001",
    title: "CloudTrail Tampering: When the Trail Itself Is the Crime Scene",
    summary:
      "An attacker with elevated IAM disabled a CloudTrail trail, briefly redirected its destination, and re-enabled it. Read the meta-trail and reconstruct what was happening during the gap.",
    skillAreas: ["cloud_forensics", "anti_forensics", "df_artifacts", "inference_discipline"],
    difficulty: 4,
    estimatedMinutes: 22,
    tags: [
      "cloud_forensics",
      "anti_forensics",
      "aws",
      "cloudtrail",
      "tampering",
      "log_destruction",
    ],
    lane: "cloud_forensics",
    module: "Cloud anti-forensics",
    sequence: 1,
    brief: `
# Brief

CloudTrail itself is an AWS service, and **every call to
CloudTrail's own management API** is logged — by CloudTrail.
\`StopLogging\`, \`UpdateTrail\`, \`DeleteTrail\`,
\`PutEventSelectors\` all appear as management events with the
\`cloudtrail.amazonaws.com\` event source.

That gives a strong invariant: even if an attacker stops a
trail to silence themselves, the *act of stopping* is the
last event recorded before the gap. The trail's own
configuration history (and CloudTrail's "Insights" plus the
EventBridge integration) is the meta-evidence.

An experienced attacker won't just disable the trail. They'll
either:

1. **Disable, act, re-enable**, hoping that the gap reads as a
   monitoring glitch.
2. **UpdateTrail to a new S3 bucket the attacker controls**,
   act, **UpdateTrail back to the original**.
3. **DeleteTrail outright**, lean on the assumption that
   audit will take days to notice.

Pattern 2 is the most informative because the events between
the two UpdateTrail calls were never lost — they just landed
in the attacker's bucket. That bucket and its log files are
forensic gold, IF the attacker forgot to delete them and IF
the IR team obtains them lawfully.

Read the meta-trail. Reconstruct.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "cloudtrail-management-events.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            [
              {
                eventTime: "2025-10-03T09:12:44Z",
                eventName: "UpdateTrail",
                eventSource: "cloudtrail.amazonaws.com",
                awsRegion: "us-east-1",
                sourceIPAddress: "198.51.100.99",
                userAgent: "aws-cli/2.15.30 Python/3.11.6",
                userIdentity: {
                  type: "AssumedRole",
                  arn: "arn:aws:sts::555512348888:assumed-role/BreakGlassAdmin/incident-fix",
                  sessionContext: {
                    sessionIssuer: {
                      arn: "arn:aws:iam::555512348888:role/BreakGlassAdmin",
                    },
                  },
                },
                requestParameters: {
                  name: "org-wide-trail",
                  s3BucketName: "rogue-bucket-xfer-2025",
                  s3KeyPrefix: "",
                  includeGlobalServiceEvents: true,
                  isMultiRegionTrail: true,
                },
                responseElements: { name: "org-wide-trail" },
              },
              {
                eventTime: "2025-10-03T09:31:18Z",
                eventName: "UpdateTrail",
                eventSource: "cloudtrail.amazonaws.com",
                awsRegion: "us-east-1",
                sourceIPAddress: "198.51.100.99",
                userAgent: "aws-cli/2.15.30 Python/3.11.6",
                userIdentity: {
                  type: "AssumedRole",
                  arn: "arn:aws:sts::555512348888:assumed-role/BreakGlassAdmin/incident-fix",
                  sessionContext: {
                    sessionIssuer: {
                      arn: "arn:aws:iam::555512348888:role/BreakGlassAdmin",
                    },
                  },
                },
                requestParameters: {
                  name: "org-wide-trail",
                  s3BucketName: "acme-audit-trail-canonical",
                  s3KeyPrefix: "",
                  includeGlobalServiceEvents: true,
                  isMultiRegionTrail: true,
                },
                responseElements: { name: "org-wide-trail" },
              },
            ],
            null,
            2,
          ),
        ),
      },
      {
        ordinal: 2,
        displayName: "s3-canonical-bucket-objects.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Objects landed in s3://acme-audit-trail-canonical/ for 2025-10-03",
            "------------------------------------------------------------------",
            "",
            "  AWSLogs/555512348888/CloudTrail/us-east-1/2025/10/03/...0855Z.json.gz",
            "  AWSLogs/555512348888/CloudTrail/us-east-1/2025/10/03/...0900Z.json.gz",
            "  AWSLogs/555512348888/CloudTrail/us-east-1/2025/10/03/...0910Z.json.gz",
            "  (gap)",
            "  AWSLogs/555512348888/CloudTrail/us-east-1/2025/10/03/...0935Z.json.gz",
            "  AWSLogs/555512348888/CloudTrail/us-east-1/2025/10/03/...0940Z.json.gz",
            "  AWSLogs/555512348888/CloudTrail/us-east-1/2025/10/03/...0945Z.json.gz",
            "",
            "(Trail delivery files for the 09:13–09:31 UTC window are not in",
            " this bucket. The two earlier UpdateTrail calls reconfigured the",
            " destination to s3://rogue-bucket-xfer-2025 for that window.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "iam-context.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Account context — 555512348888 (Acme production AWS account)",
            "------------------------------------------------------------",
            "",
            "Role : BreakGlassAdmin",
            "  Trust : federated from IdP (Okta), human assumption only",
            "  Permissions : AdministratorAccess",
            "  MFA-on-assume : REQUIRED via SCP",
            "  Documented use : Tier-1 incident only, with on-call director sign-off",
            "  Session-name convention : on-call ticket ID (e.g. INC-9421)",
            "",
            "Session in trail :",
            "  sessionName = `incident-fix`  (NOT a ticket ID)",
            "  Source IP   = 198.51.100.99   (registered to none of Acme's offices,",
            "                                  none of Acme's VPN egresses)",
            "  Duration    = 09:08–09:46 UTC",
            "",
            "Cross-check against on-call paging:",
            "  No tier-1 incident open on 2025-10-03.",
            "  No paging record for an on-call director sign-off.",
            "",
            "S3 bucket `rogue-bucket-xfer-2025`:",
            "  Not an Acme-owned bucket.",
            "  Owner account ID = different AWS account, external.",
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
          "Reading only what's on the management-event log and the bucket inventory, what is **proven**?",
        options: [
          {
            id: "destination-swapped",
            label:
              "The trail's S3 destination was changed from the canonical bucket to `rogue-bucket-xfer-2025` at 09:12 and back to the canonical bucket at 09:31.",
          },
          {
            id: "events-redirected",
            label:
              "Events for the 09:13–09:31 UTC window were delivered to the attacker-controlled bucket, not the canonical one.",
          },
          {
            id: "events-deleted",
            label:
              "Events for the 09:13–09:31 UTC window were deleted by the attacker.",
          },
          {
            id: "breakglass-misused",
            label:
              "The BreakGlassAdmin role was assumed under a session name that does not follow the documented ticket-ID convention.",
          },
          {
            id: "rogue-was-leaked",
            label:
              "The contents of the attacker bucket were ultimately recovered and reviewed by IR.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["destination-swapped", "events-redirected", "breakglass-misused"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Proven:**",
          "",
          "- *Destination swapped, swapped back.* The two UpdateTrail events name the destination buckets explicitly in `requestParameters.s3BucketName`. That's the management API's own record of its own reconfiguration.",
          "- *Events redirected.* The canonical bucket inventory shows a clean delivery gap for exactly the 09:13–09:31 window the trail was pointed elsewhere. CloudTrail delivers to whatever destination is configured at write time; the gap is consistent with redirection, not with logging being off.",
          "- *BreakGlass misuse.* The session name `incident-fix` doesn't match the documented `INC-<number>` convention, the source IP is off-pattern, and there's no on-call paging record. Three independent on-the-spot inconsistencies; the artifact bundle explicitly names the convention for the reviewer.",
          "",
          "**Not proven:**",
          "",
          "- *Events deleted.* The events weren't deleted from CloudTrail's perspective — they were delivered. They live (or lived) in `rogue-bucket-xfer-2025`. Whether the attacker subsequently emptied that bucket is a separate question and not answered by these artifacts.",
          "- *Bucket recovered.* Nothing here says IR got hold of the rogue bucket. The classic happy-ending lure — \"attackers always forget to clean up\" — sometimes holds but is not a fact about *this* incident from these inputs.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which *defensive* controls would have made the 18-minute redirection significantly less useful to the attacker?",
        options: [
          {
            id: "log-file-validation",
            label:
              "CloudTrail log-file integrity validation enabled (signed digest files).",
          },
          {
            id: "org-trail-protected",
            label:
              "Organization-level trail configured at the AWS Organizations root, with an SCP blocking member-account principals from running `UpdateTrail` or `StopLogging` on it.",
          },
          {
            id: "eventbridge-alarm",
            label:
              "EventBridge rule alerting on any `cloudtrail.amazonaws.com` API call (UpdateTrail / StopLogging / DeleteTrail / PutEventSelectors) firing into the SOC pager.",
          },
          {
            id: "guardduty-on",
            label:
              "GuardDuty enabled (it has a `Stealth:IAMUser/CloudTrailLoggingDisabled` finding).",
          },
          {
            id: "shorter-retention",
            label:
              "Shorter S3 retention on the canonical audit bucket, so old logs roll off faster and there's less data to redirect.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["org-trail-protected", "eventbridge-alarm", "guardduty-on"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right:**",
          "",
          "- *Org-trail at the Org root, SCP-protected.* The single highest-leverage control. An organization trail managed at the root with member-account principals **denied** `cloudtrail:UpdateTrail` and `cloudtrail:StopLogging` by SCP cannot be reconfigured from inside the account where the attacker lives, even with full admin. Pattern 2 (redirect + redirect-back) is structurally blocked.",
          "- *EventBridge alarm.* Cheap, immediate, very effective. The pager fires at 09:12 the moment the first UpdateTrail happens, before any redirected window can play out.",
          "- *GuardDuty.* The `Stealth:IAMUser/CloudTrailLoggingDisabled` finding catches the StopLogging variant directly. Doesn't catch the UpdateTrail-to-rogue-bucket variant cleanly (a redirected trail is technically still \"logging\"), but is part of the layered set.",
          "",
          "**Wrong:**",
          "",
          "- *Log-file integrity validation.* It detects **tampering with delivered log files** — useful against a *different* attack (the attacker reaches into the canonical bucket and rewrites JSON). It does nothing about diversion-while-in-transit. Useful to have, doesn't solve this case.",
          "- *Shorter retention.* The opposite of what defensive posture wants. Shorter retention loses evidence faster; it doesn't reduce the value of an 18-minute redirection window.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the 09:13–09:31 UTC window contains the attacker's high-impact actions (vs. the redirection being a feint to draw attention elsewhere).",
        expected: { type: "confidence", expectedRange: [3, 4] },
        debriefMd:
          "**3 or 4.** The shape — go-elsewhere, do-thing, come-back — is classic. The redirection window is so narrow (18 minutes) and so tightly bracketed that something specific is much more likely than the redirection being theatre. But \"feint to draw the SOC's attention to this account while a parallel action runs in another account\" is a real APT pattern, and discipline says the next move is to scan the rest of the Org's account inventory for *concurrent* off-pattern activity (other BreakGlass assumptions, other UpdateTrail calls) in the 08:00–11:00 window. If those are clean, confidence rises to 4–5 that the 18-minute window is the actual crime scene; until then, leave room.",
      },
    ],
  },
];
