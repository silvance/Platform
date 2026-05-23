import { utf8 } from "./util";
import type { ScenarioSeed } from "./types";

// Network & logs lane. Each scenario takes a single short log
// excerpt or flow-record sample and exercises one core reading
// skill — what the artefact does and does not establish — without
// shipping anything resembling a live capture.

export const NETWORK_LOGS_SCENARIOS: ScenarioSeed[] = [
  // ─── 1. NetFlow record reading ───────────────────────────────
  {
    slug: "network-netflow-basics-001",
    title: "NetFlow Basics: Read a 5-Tuple Record",
    summary:
      "A handful of NetFlow records from a perimeter collector. Read the columns correctly and decide what the records do and do not establish.",
    skillAreas: ["network_logs", "df_artifacts", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["network", "netflow", "inference_discipline"],
    lane: "network_logs",
    module: "Reading flow records",
    sequence: 1,
    brief: `
# Brief

A perimeter NetFlow collector exported the records in the
artefact. Each row records one network flow — a 5-tuple
(source IP, destination IP, source port, destination port,
protocol) plus byte and packet counts, start and end times.

NetFlow records are **metadata**, not payload. They tell you
*who talked to whom, how much, and for how long.* They do NOT
tell you *what was said* — there is no decrypted content, no
HTTP method, no DNS name, no file contents.

A reasonable analyst's first read of a flow row should answer:

1. **Direction**: who initiated? The client is usually the side
   with the high (ephemeral) source port; the server is the side
   with the well-known destination port.
2. **Volume + asymmetry**: byte counts in each direction. A
   download skews bytes received; an upload skews bytes sent.
3. **Duration**: short flows (DNS, single HTTP) vs long flows
   (file transfer, persistent SSH).

What flow records will *not* answer on their own:

- Destination hostname (need DNS log or SNI capture).
- Whether the bytes sent were sensitive material (need EDR /
  proxy / DLP correlation).
- Whether the user at the keyboard was the actor (need host-side
  process attribution).
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "netflow-window.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "start_utc,end_utc,src_ip,dst_ip,src_port,dst_port,proto,bytes_sent,bytes_recv,packets",
            "2026-11-09T13:14:01Z,2026-11-09T13:14:04Z,10.0.4.55,10.0.4.1,52201,53,udp,162,418,4",
            "2026-11-09T13:14:05Z,2026-11-09T13:15:08Z,10.0.4.55,203.0.113.42,52214,443,tcp,4_812,118_204,182",
            "2026-11-09T13:18:30Z,2026-11-09T13:22:11Z,10.0.4.55,198.51.100.77,52220,443,tcp,318_004_115,2_204_004,4_204",
            "2026-11-09T13:30:01Z,2026-11-09T13:30:03Z,10.0.4.55,10.0.4.1,52301,53,udp,140,322,3",
            "2026-11-09T13:30:08Z,2026-11-09T13:30:09Z,10.0.4.55,8.8.8.8,52302,53,udp,98,260,2",
            "(Underscores in byte counts are legibility separators; treat as digits.)",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              note: "Network context for the source IP appearing in netflow-window.csv.",
              src_ip: "10.0.4.55",
              src_host: "WS-1108",
              user_on_console: "j.delacruz",
              gateway: "10.0.4.1",
              internal_dns: "10.0.4.1",
              corporate_dns_resolver_chain: ["10.0.4.1", "8.8.8.8 (fallback, blocked by policy)"],
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Reading the flow rows, which statements are supported by the data as written?",
        options: [
          {
            id: "client-init",
            label:
              "Workstation WS-1108 initiated all five flows (it appears as `src_ip` with high ephemeral source ports).",
          },
          {
            id: "second-flow-https",
            label:
              "The 13:14:05Z flow to 203.0.113.42:443 is consistent with an HTTPS download — server port 443/tcp, bytes received roughly 24× bytes sent, modest duration.",
          },
          {
            id: "third-flow-upload",
            label:
              "The 13:18:30Z flow to 198.51.100.77:443 is consistent with a large outbound upload — bytes sent roughly 144× bytes received, ~4 minute duration.",
          },
          {
            id: "we-know-the-destination",
            label:
              "We can identify the hostname / service behind 198.51.100.77 from these flows alone.",
          },
          {
            id: "we-know-the-content",
            label:
              "We can identify what was uploaded in the third flow from these flows alone.",
          },
          {
            id: "fallback-dns-used",
            label:
              "The 13:30:08Z flow to 8.8.8.8:53 indicates an attempt to use a non-corporate DNS resolver, which the host's context lists as blocked by policy.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["client-init", "second-flow-https", "third-flow-upload", "fallback-dns-used"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Supported by the flow data:**",
          "",
          "- *Client initiation* — WS-1108 carries the high source port in every row; the destinations carry well-known service ports.",
          "- *Second flow is download-shaped* — port 443, bytes_recv >> bytes_sent, modest duration.",
          "- *Third flow is upload-shaped* — port 443, bytes_sent >> bytes_recv, multi-minute duration.",
          "- *DNS fallback attempt* — the flow to 8.8.8.8:53 is straightforward and visible. Whether the resolver succeeded is a separate question (the flow doesn't say so — both query and response are normal UDP for DNS).",
          "",
          "**NOT supported by the flow data:**",
          "",
          "- *Hostname / service identity* — flows carry IPs, not names. You need DNS logs or SNI / certificate observation to identify the destination.",
          "- *Content of the upload* — flows are byte counts, not payload.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which additional artefacts would most directly let you turn the third flow's shape into an attributed exfil claim?",
        options: [
          {
            id: "dns-log",
            label:
              "DNS query log on the corporate resolver for the WS-1108 IP during the 13:18Z window — resolves 198.51.100.77 to a hostname.",
          },
          {
            id: "proxy-log",
            label:
              "Proxy access log for WS-1108 in the same window — gives the hostname + URL the client requested.",
          },
          {
            id: "host-edr-network-connect",
            label:
              "Host-side EDR network-connect (Sysmon EID 3 / equivalent) — names the local process that owned the socket.",
          },
          {
            id: "more-netflow",
            label:
              "More NetFlow from the same collector — additional rows of the same kind don't add a new dimension.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["dns-log", "proxy-log", "host-edr-network-connect"],
          allowMultiple: true,
        },
        debriefMd:
          "DNS + proxy gives you the destination identity; host-side network-connect gives you the process. Together they cover the two attribution gaps flow records can't close on their own. More NetFlow only sharpens what you already have; it doesn't add hostname or process identity.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that user `j.delacruz` personally uploaded sensitive material in the 13:18Z flow, based ONLY on these artefacts.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The flow's *shape* is upload-consistent — that's worth investigating. It is not by itself enough to identify the destination, the content, or the user-vs-process actor. Treat the row as a lead; close the gaps with DNS / proxy / EDR before naming a person in any finding.",
      },
    ],
  },

  // ─── 2. DNS log review (DGA-style domain spotting) ────────────
  {
    slug: "network-dns-log-dga-001",
    title: "DNS Log Review: Algorithmic Domains vs Noisy-but-Legit",
    summary:
      "Read a slice of resolver query logs and tell algorithmically-generated domain noise apart from the normal kind. Reinforce that pattern ≠ proof.",
    skillAreas: ["network_logs", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 20,
    tags: ["network", "dns", "dga", "inference_discipline"],
    lane: "network_logs",
    module: "DNS triage",
    sequence: 1,
    brief: `
# Brief

A slice of the corporate DNS resolver query log for one
workstation over an hour. Each row records a query: the client
IP, the queried name, the type (A, AAAA, CNAME), and the answer
the resolver returned.

You're looking for **algorithmically-generated** (DGA-style)
domain noise — the long, vowel-poor, randomised names malware
C2 channels rotate through to evade static blocklists. The
catch: lots of legitimate services also generate noisy-looking
names (CDN shards, analytics, ad networks). Pattern alone is
suggestive, not diagnostic.

Reasonable signals that a query is *worth investigating*:

- **Length + entropy** — long random-looking subdomain labels.
- **Many one-shot names with NXDOMAIN answers** — DGA tries
  hundreds of candidate domains until one resolves.
- **No second-level traffic to the parent domain** — legit CDN
  domains usually carry a recognisable parent (\`*.cloudfront.net\`,
  \`*.akamaiedge.net\`); a single bare random TLD is more
  suspicious.

Reasonable signals that the noise is benign:

- Parent domain is a known CDN / analytics / ad network.
- The same client also makes ordinary queries to recognisable
  parent services in the same window.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "dns-queries.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "utc,client_ip,qname,qtype,answer,rcode",
            "2026-11-09T14:00:01Z,10.0.4.55,login.microsoftonline.com,A,40.126.32.74,NOERROR",
            "2026-11-09T14:00:14Z,10.0.4.55,a1b2c3d4.tracking.example,A,(no record),NXDOMAIN",
            "2026-11-09T14:00:14Z,10.0.4.55,d3f9e2c1a08c4b7e.akamaiedge.net,A,23.45.122.18,NOERROR",
            "2026-11-09T14:00:16Z,10.0.4.55,qmkwoiek.dyn-vp.io,A,(no record),NXDOMAIN",
            "2026-11-09T14:00:17Z,10.0.4.55,sjflapwie.dyn-vp.io,A,(no record),NXDOMAIN",
            "2026-11-09T14:00:17Z,10.0.4.55,xvueriasdf.dyn-vp.io,A,(no record),NXDOMAIN",
            "2026-11-09T14:00:18Z,10.0.4.55,bzqquciopop.dyn-vp.io,A,198.51.100.77,NOERROR",
            "2026-11-09T14:00:20Z,10.0.4.55,e1f2a3b4c5d6e7f8.cloudfront.net,A,52.84.150.39,NOERROR",
            "2026-11-09T14:01:00Z,10.0.4.55,www.bing.com,A,204.79.197.200,NOERROR",
            "2026-11-09T14:02:11Z,10.0.4.55,ssl.google-analytics.com,A,142.250.190.110,NOERROR",
            "2026-11-09T14:02:14Z,10.0.4.55,bzqquciopop.dyn-vp.io,A,198.51.100.77,NOERROR",
          ].join("\n") + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "dns-dga-indicators",
        displayName: "Indicators bearing on the DGA suspicion",
        sourceArtifactDisplayName: "dns-queries.csv",
        items: [
          {
            id: "burst-nxdomain",
            label:
              "Four randomised subdomains under `dyn-vp.io` were queried within ~4 seconds; three NXDOMAIN, one NOERROR.",
          },
          {
            id: "resolved-domain-revisited",
            label:
              "The one `dyn-vp.io` name that resolved (`bzqquciopop`) was queried again ~2 minutes later and returned the same IP.",
          },
          {
            id: "cdn-shard-recognisable-parent",
            label:
              "Two long random-looking labels resolve under recognisable CDN parents (`akamaiedge.net`, `cloudfront.net`).",
          },
          {
            id: "tracking-nxdomain-one-off",
            label:
              "A single NXDOMAIN under `tracking.example` (one query, no follow-up).",
          },
          {
            id: "normal-services",
            label:
              "Same client also queries `login.microsoftonline.com`, `www.bing.com`, and `ssl.google-analytics.com` in the same window.",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "dns-dga-indicators",
        promptMd:
          "Select the indicators that **best support** treating the `dyn-vp.io` activity as DGA-style and worth follow-up.",
        expected: {
          type: "select_indicators",
          correctIds: ["burst-nxdomain", "resolved-domain-revisited"],
        },
        debriefMd: [
          "**Selected (good):**",
          "",
          "- *Burst of NXDOMAINs* — the canonical DGA fingerprint: many candidate names attempted in quick succession.",
          "- *Resolved name revisited* — once a DGA finds a name that resolves, it sticks. The repeat query ~2 minutes later is consistent with the client beaconing back to the same C2 candidate.",
          "",
          "**Distractors:**",
          "",
          "- *CDN shards under recognisable parents* — these look noisy but the parent domain (`akamaiedge.net`, `cloudfront.net`) is well-known. Random-looking labels under known CDN parents are normal.",
          "- *One-off NXDOMAIN under tracking.example* — a single failed query is consistent with a blocked ad/tracker beacon. Not enough to support a finding.",
          "- *Normal-service queries in the same window* — they don't argue against the suspicion (a compromised host still uses the browser); they just confirm the client is otherwise behaving normally.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What is the best next step to pursue the `dyn-vp.io` suspicion?",
        options: [
          {
            id: "edr-process",
            label:
              "Check host-side EDR / Sysmon for the process that issued the `dyn-vp.io` queries (and the subsequent connection if any) — names the actor on the box.",
          },
          {
            id: "proxy-hits",
            label:
              "Check the perimeter proxy / firewall logs for outbound connections to 198.51.100.77 from this client.",
          },
          {
            id: "block-everything",
            label:
              "Block all DNS queries to `*.io` at the resolver immediately.",
          },
          {
            id: "ignore",
            label:
              "Ignore the burst — DNS noise of this kind is normal background traffic.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["edr-process", "proxy-hits"],
          allowMultiple: true,
        },
        debriefMd:
          "EDR / Sysmon names the local process; the perimeter logs corroborate (or fail to corroborate) the post-resolution connection. Together they convert the DNS suspicion into a process-attributed event you can decide on. Mass-blocking `*.io` is overbroad — millions of legitimate domains live there. Ignoring is also wrong: the pattern crosses the threshold of *worth looking at*, even though it isn't yet a finding.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the `dyn-vp.io` activity is malicious based ONLY on these DNS rows.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2 or 3.** The pattern is suspicious enough that an analyst should pivot. It is not yet proof: legitimate services occasionally rotate dynamic domains, and a single resolved name + one revisit is a thin record. Convert it into a confidence-5 finding via host-side process attribution and outbound-connection corroboration.",
      },
    ],
  },

  // ─── 3. Web access log: SQLi probes amid normal traffic ──────
  {
    slug: "network-web-log-sqli-probe-001",
    title: "Web Access Log: Spot the SQLi Probes",
    summary:
      "An Apache-style combined access log carries some routine traffic plus several SQLi probe attempts. Identify the probes without over-claiming exploitation.",
    skillAreas: ["network_logs", "inference_discipline"],
    difficulty: 2,
    estimatedMinutes: 15,
    tags: ["network", "web_logs", "sqli", "inference_discipline"],
    lane: "network_logs",
    module: "Access-log triage",
    sequence: 1,
    brief: `
# Brief

A 10-row slice of an Apache-style combined access log from a
public web app. Some rows are normal traffic. A few are SQL
injection (SQLi) **probe attempts** — payloads in the query
string that try to trigger an SQL error or boolean-true response.

What an SQLi probe looks like in a log:

- Suspicious query-string content: \`' OR 1=1\`, \`UNION SELECT\`,
  \`--\` (SQL comment), \`SLEEP(\`, \`SUBSTRING(\`, etc.
- Sometimes URL-encoded: \`%27\` for \`'\`, \`%20\` for space.
- Sometimes targeting an obvious parameter (\`?id=\`,
  \`?user=\`).

What a log line cannot tell you on its own:

- Whether the probe *succeeded*. A 500 can mean a generic
  app error; a 200 can mean the app silently rejected the
  payload as input.
- Who the attacker is. Source IPs reach the app through proxies,
  VPNs, and rotating residential ranges.
- What data, if any, was returned.

Triage discipline: identify which rows are probes, name what
each probe is *trying* to do, and resist saying "exploited"
without independent confirmation.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "access.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            '203.0.113.45 - - [09/Nov/2026:14:00:01 +0000] "GET /products?id=14 HTTP/1.1" 200 4218 "https://www.example.com/" "Mozilla/5.0"',
            '203.0.113.45 - - [09/Nov/2026:14:00:14 +0000] "GET /products?id=14%27%20OR%201%3D1-- HTTP/1.1" 500 318 "-" "curl/8.4.0"',
            '203.0.113.45 - - [09/Nov/2026:14:00:18 +0000] "GET /products?id=14%20UNION%20SELECT%20null%2Cnull%2Cnull-- HTTP/1.1" 500 318 "-" "curl/8.4.0"',
            '203.0.113.45 - - [09/Nov/2026:14:00:21 +0000] "GET /products?id=14%20AND%20SLEEP%285%29-- HTTP/1.1" 200 4218 "-" "curl/8.4.0"',
            '198.51.100.10 - - [09/Nov/2026:14:00:30 +0000] "GET /static/logo.svg HTTP/1.1" 200 1812 "https://www.example.com/" "Mozilla/5.0"',
            '203.0.113.45 - - [09/Nov/2026:14:00:35 +0000] "GET /products?id=14%27%3B%20DROP%20TABLE%20products-- HTTP/1.1" 500 318 "-" "curl/8.4.0"',
            '198.51.100.10 - - [09/Nov/2026:14:00:41 +0000] "POST /login HTTP/1.1" 302 0 "https://www.example.com/login" "Mozilla/5.0"',
            '198.51.100.10 - - [09/Nov/2026:14:00:43 +0000] "GET /account HTTP/1.1" 200 6042 "https://www.example.com/login" "Mozilla/5.0"',
            '203.0.113.45 - - [09/Nov/2026:14:00:55 +0000] "GET /healthz HTTP/1.1" 200 18 "-" "curl/8.4.0"',
            '198.51.100.10 - - [09/Nov/2026:14:01:02 +0000] "GET /search?q=hiking%20boots HTTP/1.1" 200 8312 "https://www.example.com/" "Mozilla/5.0"',
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
          "Which rows are SQLi probe attempts? (Pick all that apply.)",
        options: [
          {
            id: "row1",
            label: "Row 1 — `/products?id=14` (200)",
          },
          {
            id: "row2",
            label: "Row 2 — `/products?id=14' OR 1=1--` (URL-encoded) (500)",
          },
          {
            id: "row3",
            label: "Row 3 — `/products?id=14 UNION SELECT null,null,null--` (URL-encoded) (500)",
          },
          {
            id: "row4",
            label: "Row 4 — `/products?id=14 AND SLEEP(5)--` (URL-encoded) (200)",
          },
          {
            id: "row6",
            label: "Row 6 — `/products?id=14'; DROP TABLE products--` (URL-encoded) (500)",
          },
          {
            id: "row10",
            label: "Row 10 — `/search?q=hiking boots` (URL-encoded space) (200)",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["row2", "row3", "row4", "row6"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Probes:**",
          "",
          "- Row 2: classic boolean-true (`' OR 1=1--`).",
          "- Row 3: UNION-based, probing column count.",
          "- Row 4: time-based blind (`AND SLEEP(5)--`).",
          "- Row 6: stacked-statement attempt (`; DROP TABLE products--`).",
          "",
          "**Not probes:**",
          "",
          "- Row 1 is a normal `id=14` lookup — no SQL metacharacters in the query.",
          "- Row 10 is a normal search query with a URL-encoded space. URL encoding by itself is not suspicious; the question is whether the *decoded* content contains SQL syntax — it doesn't.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Row 4 returned a 200 OK response and the same content length (4218 bytes) as Row 1. Which conclusion is best supported?",
        options: [
          {
            id: "no-conclusion-from-status-alone",
            label:
              "The 200 + identical content length suggests the app responded as if the request were normal, but a log line alone cannot prove whether the SLEEP() actually executed against the database. Confirmation requires backend timing data, DB query logs, or the actual response time.",
          },
          {
            id: "exploit-succeeded",
            label:
              "The 200 response proves the SQLi payload was successfully executed.",
          },
          {
            id: "exploit-failed",
            label:
              "The 200 response proves the app rejected the SQLi payload.",
          },
          {
            id: "no-probe",
            label:
              "Because the response was 200 (not 500), this row is not a probe.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["no-conclusion-from-status-alone"],
          allowMultiple: false,
        },
        debriefMd:
          "Status code is not a verdict on whether the injection worked. A 500 only tells you the app errored; a 200 only tells you the app returned a response. Determining whether the SLEEP() actually executed against the DB is a backend question (DB query logs, response time, or a WAF audit). Don't promote a probe to *exploitation* on the strength of an HTTP status code alone.",
      },
      {
        ordinal: 3,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the IP `203.0.113.45` successfully exfiltrated data from this application based ONLY on the rows shown.",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The rows show probing, not exfiltration. There is no row indicating a UNION-based response containing data, no row indicating sensitive output, no row showing the attacker downloading material. The disciplined finding for this slice is *\"observed SQLi probe attempts from 203.0.113.45; no evidence of successful exploitation in this window.\"* Move higher only with backend confirmation (DB logs, WAF events, response-body evidence).",
      },
    ],
  },
];
