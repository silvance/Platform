import { buildPcap, utf8, type PcapPacket } from "./util";
import type { ScenarioSeed } from "./types";

// Build the beacon-PCAP packets for the beacon-cadence scenario.
// Three normal early packets (DNS query/answer + an HTTPS GET to
// a recognisable destination) followed by five small TLS-like
// connections to the same external IP at ~60-second intervals.
// The cadence is the tell; everything else is noise.
function buildBeaconPcapPackets(): PcapPacket[] {
  const t0 = new Date("2026-11-12T13:00:00Z").getTime();
  const packets: PcapPacket[] = [];

  // ── normal background traffic ────────────────────────────────
  // DNS query: client → resolver
  packets.push({
    timestamp: new Date(t0 + 0),
    srcIp: "10.0.4.55",
    dstIp: "10.0.4.1",
    proto: "udp",
    srcPort: 52301,
    dstPort: 53,
    payload: Buffer.from([
      0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x03, 0x77, 0x77, 0x77, 0x04, 0x62, 0x69, 0x6e, 0x67, 0x03, 0x63, 0x6f,
      0x6d, 0x00, 0x00, 0x01, 0x00, 0x01,
    ]),
  });
  packets.push({
    timestamp: new Date(t0 + 12),
    srcIp: "10.0.4.1",
    dstIp: "10.0.4.55",
    srcMac: "02:00:00:00:00:fe",
    dstMac: "02:00:00:00:00:01",
    proto: "udp",
    srcPort: 53,
    dstPort: 52301,
    payload: Buffer.from([
      0x12, 0x34, 0x81, 0x80, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x03, 0x77, 0x77, 0x77, 0x04, 0x62, 0x69, 0x6e, 0x67, 0x03, 0x63, 0x6f,
      0x6d, 0x00, 0x00, 0x01, 0x00, 0x01,
      0xc0, 0x0c, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x3c, 0x00, 0x04,
      0xcc, 0x4f, 0xc5, 0xc8,
    ]),
  });
  // Benign HTTPS GET-shaped packet to a recognisable destination.
  packets.push({
    timestamp: new Date(t0 + 350),
    srcIp: "10.0.4.55",
    dstIp: "204.79.196.200", // www.bing.com (publicly attributed range)
    proto: "tcp",
    srcPort: 52302,
    dstPort: 443,
    tcpFlags: { syn: true, ack: false },
    payload: Buffer.alloc(0),
  });

  // ── beacon: five ~200-byte TCP/443 packets at ~60s intervals ─
  // Each packet carries a small payload meant to look like an
  // encrypted heartbeat (random-looking bytes). Wireshark will
  // render these as TCP segments to 198.51.100.77:443.
  const beaconDst = "198.51.100.77";
  const beaconPayload = Buffer.from(
    "1703030014" + // TLS Application Data record header (type 23, ver 0303, len 20)
      "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
    "hex",
  );
  for (let i = 0; i < 5; i++) {
    const ts = new Date(t0 + 60_000 * (i + 1));
    packets.push({
      timestamp: ts,
      srcIp: "10.0.4.55",
      dstIp: beaconDst,
      proto: "tcp",
      srcPort: 52310 + i,
      dstPort: 443,
      tcpSeq: 100 + i,
      tcpAck: 1,
      tcpFlags: { ack: true, psh: true },
      payload: beaconPayload,
    });
    // A small synthetic ACK back from the beacon host so the
    // capture isn't entirely one-sided.
    packets.push({
      timestamp: new Date(ts.getTime() + 50),
      srcIp: beaconDst,
      dstIp: "10.0.4.55",
      srcMac: "02:00:00:00:00:fe",
      dstMac: "02:00:00:00:00:01",
      proto: "tcp",
      srcPort: 443,
      dstPort: 52310 + i,
      tcpSeq: 200 + i,
      tcpAck: 100 + i + beaconPayload.length,
      tcpFlags: { ack: true },
      payload: Buffer.alloc(0),
    });
  }

  return packets;
}

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

  // ─── 4. PCAP triage: spotting a beacon ──────────────────────
  {
    slug: "network-pcap-beacon-001",
    title: "PCAP Triage: Spot the Beacon Cadence",
    summary:
      "A small packet capture with mostly-normal traffic and a periodic outbound to an unfamiliar destination. Identify the beacon, name what the PCAP does and does not establish.",
    skillAreas: ["network_logs", "df_artifacts", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 25,
    tags: ["network", "pcap", "beacon", "c2", "inference_discipline"],
    lane: "network_logs",
    module: "PCAP triage",
    sequence: 1,
    brief: `
# Brief

A small \`tcpdump\` capture from a workstation, taken during a
~6-minute window after EDR raised a low-confidence "uncategorised
outbound TLS" alert. The capture is in two artefacts:

- \`capture-window.pcap\` — the raw libpcap binary. Open in
  Wireshark / \`tshark\` / \`tcpdump\` if you have it.
- \`tshark-summary.txt\` — a human-readable summary of the same
  packets so the challenge can be solved entirely in the browser.

Your job is to spot the **beacon**: a small, periodic outbound
connection that repeats on a regular cadence. Beaconing is a
common C2 fingerprint because the implant has to phone home for
instructions; the periodic shape is harder to hide than the
content (which is usually encrypted).

What a small packet capture like this can and can't establish:

- **Can**: who talked to whom, when, in what direction, how
  often, how much, and the on-wire metadata (ports, IPs, TCP
  flags, TLS record types if any).
- **Can't**: the application-layer content of encrypted
  conversations, the identity of the user at the keyboard, the
  destination hostname (without DNS / SNI), or what process on
  the host owned the socket.

This is a *triage* exercise, not a full incident response. Don't
promote a periodic shape to a confirmed C2 channel without
host-side process attribution and destination identification.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "capture-window.pcap",
        kind: "pcap",
        mimeType: "application/vnd.tcpdump.pcap",
        bytes: buildPcap(buildBeaconPcapPackets()),
      },
      {
        ordinal: 2,
        displayName: "tshark-summary.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "$ tshark -r capture-window.pcap -tad -n",
            "  (one line per packet; truncated address/port columns)",
            "",
            "    1  2026-11-12 13:00:00.000  10.0.4.55       → 10.0.4.1        DNS  Standard query 0x1234 A www.bing.com",
            "    2  2026-11-12 13:00:00.012  10.0.4.1        → 10.0.4.55       DNS  Standard query response 0x1234 A 204.79.197.200",
            "    3  2026-11-12 13:00:00.350  10.0.4.55       → 204.79.196.200  TCP  52302 → 443 [SYN]",
            "",
            "    4  2026-11-12 13:01:00.000  10.0.4.55       → 198.51.100.77   TCP  52310 → 443 [PSH, ACK]  Len=25",
            "    5  2026-11-12 13:01:00.050  198.51.100.77   → 10.0.4.55       TCP  443 → 52310 [ACK]",
            "",
            "    6  2026-11-12 13:02:00.000  10.0.4.55       → 198.51.100.77   TCP  52311 → 443 [PSH, ACK]  Len=25",
            "    7  2026-11-12 13:02:00.050  198.51.100.77   → 10.0.4.55       TCP  443 → 52311 [ACK]",
            "",
            "    8  2026-11-12 13:03:00.000  10.0.4.55       → 198.51.100.77   TCP  52312 → 443 [PSH, ACK]  Len=25",
            "    9  2026-11-12 13:03:00.050  198.51.100.77   → 10.0.4.55       TCP  443 → 52312 [ACK]",
            "",
            "   10  2026-11-12 13:04:00.000  10.0.4.55       → 198.51.100.77   TCP  52313 → 443 [PSH, ACK]  Len=25",
            "   11  2026-11-12 13:04:00.050  198.51.100.77   → 10.0.4.55       TCP  443 → 52313 [ACK]",
            "",
            "   12  2026-11-12 13:05:00.000  10.0.4.55       → 198.51.100.77   TCP  52314 → 443 [PSH, ACK]  Len=25",
            "   13  2026-11-12 13:05:00.050  198.51.100.77   → 10.0.4.55       TCP  443 → 52314 [ACK]",
            "",
            "Notes from collection:",
            "  - 10.0.4.55 is the workstation under review (WS-1108, console user j.delacruz).",
            "  - 10.0.4.1 is the corporate DNS resolver / gateway.",
            "  - 198.51.100.77 has not been resolved on this host's DNS log during",
            "    the capture window; the destination is reached by direct IP.",
            "  - Payload bytes on the 198.51.100.77 packets start with the TLS",
            "    application-data record header (0x17 0x03 0x03 …), 20 bytes of",
            "    opaque (encrypted) data, no observable handshake in this slice.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "host-context.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              host: "WS-1108",
              user: "CORP\\j.delacruz",
              edr_alert: {
                opened_utc: "2026-11-12T13:08:00Z",
                rule: "uncategorised-outbound-tls",
                confidence: "low",
              },
              dns_resolver_log_for_window: "no query for 198.51.100.77 attributed to WS-1108",
              network_segment: "corp-user / 10.0.4.0/24",
              note: "Direct-IP connections at TCP/443 are not by themselves a finding; some legitimate apps embed IPs. Cadence + destination novelty + no DNS lookup are the suggestive combination.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "pcap-beacon-indicators",
        displayName: "Indicators bearing on the beacon suspicion",
        sourceArtifactDisplayName: "tshark-summary.txt",
        items: [
          {
            id: "five-cycle-cadence",
            label:
              "Five outbound packets to 198.51.100.77:443 from WS-1108 at ~60-second intervals (13:01:00, 13:02:00, 13:03:00, 13:04:00, 13:05:00).",
          },
          {
            id: "uniform-payload-size",
            label:
              "Each outbound packet carries the same small payload size (25 bytes, TLS-record-header-shaped).",
          },
          {
            id: "no-dns-resolution",
            label:
              "The host's DNS resolver log shows no query for 198.51.100.77 during the capture window — the destination was reached by direct IP.",
          },
          {
            id: "syn-bing",
            label:
              "An earlier SYN to 204.79.196.200:443 on a different ephemeral port, consistent with a browser session to a familiar destination.",
          },
          {
            id: "dns-bing",
            label:
              "A DNS query/response pair for `www.bing.com` at the start of the window.",
          },
        ],
      },
    ],
    questions: [
      {
        ordinal: 1,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "pcap-beacon-indicators",
        promptMd:
          "Select the indicators that **directly support** treating the 198.51.100.77 connections as a beacon worth pivoting on.",
        expected: {
          type: "select_indicators",
          correctIds: ["five-cycle-cadence", "uniform-payload-size", "no-dns-resolution"],
        },
        debriefMd: [
          "**Supporting:**",
          "",
          "- *Five-cycle cadence* — clean 60-second period across five exchanges is the canonical beacon shape.",
          "- *Uniform payload size* — encrypted heartbeats from an implant are typically small and identical-sized; real user traffic varies in size.",
          "- *No DNS resolution* — direct-IP destinations bypass DNS-based blocklists and skip leaving a name in the resolver log. Combined with the cadence, this is suggestive.",
          "",
          "**Distractors:**",
          "",
          "- *SYN to 204.79.196.200* — that's a normal connection to a recognisable destination; it's part of the background traffic, not the beacon.",
          "- *DNS query for bing.com* — same, normal background; doesn't increase confidence in the beacon claim.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "Which statements are supported by the PCAP + summary as written?",
        options: [
          {
            id: "destination-known",
            label:
              "The host-resolved hostname for 198.51.100.77 can be read from the PCAP.",
          },
          {
            id: "user-attribution",
            label:
              "The PCAP names the local process / user that owned the beacon socket.",
          },
          {
            id: "encrypted-content",
            label:
              "Application-layer content of the beacon packets is encrypted (TLS application-data record header observed); the PCAP doesn't carry plaintext.",
          },
          {
            id: "shape-only",
            label:
              "The PCAP supports describing the **shape** of the traffic (cadence, size, destination IP) but is not by itself an attribution to a process, user, or destination identity.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["encrypted-content", "shape-only"],
          allowMultiple: true,
        },
        debriefMd: [
          "PCAPs answer the *who-talked-to-whom-and-when* question (and metadata around it). They do **not** carry hostname-from-IP (need DNS), process attribution (need host-side EDR / Sysmon), or decrypted application content (need TLS keys or unencrypted protocols).",
          "",
          "On the encrypted-content point: the visible TLS application-data record header is observable on the wire; the plaintext inside isn't.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "What's the best next step to convert this triage observation into a finding?",
        options: [
          {
            id: "edr-process",
            label:
              "Host-side EDR / Sysmon network-connect query for WS-1108 at the beacon timestamps — names the local process.",
          },
          {
            id: "passive-dns",
            label:
              "Passive-DNS / threat-intel lookup for 198.51.100.77 — surfaces any prior attribution to known infrastructure.",
          },
          {
            id: "longer-capture",
            label:
              "Capture a longer PCAP window from the same host to confirm the cadence continues.",
          },
          {
            id: "block-everything",
            label:
              "Add 198.51.100.77 to the perimeter blocklist immediately, without further investigation.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["edr-process", "passive-dns", "longer-capture"],
          allowMultiple: true,
        },
        debriefMd:
          "Process identity + destination attribution + sustained cadence-confirmation together convert a triage observation into a defensible finding. Blocklist-first without investigation tips off the implant (if any) and loses visibility; do it only after the process / destination work is in flight.",
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the 198.51.100.77 traffic is malicious C2 based ONLY on these artefacts.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2 or 3.** The cadence + direct-IP + uniform payload + no-DNS combination is suspicious enough to pursue. It is not by itself proof: legitimate apps (some VPN clients, telemetry agents, push-notification services) also beacon. Convert to a confidence-5 finding via host-side process identification and destination attribution.",
      },
    ],
  },
];
