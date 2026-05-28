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
// skill — what the artifact does and does not establish — without
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
artifact. (NetFlow is Cisco-originated flow telemetry — one
record per connection, headers only, no payload.) Each row
records one network flow — a 5-tuple (source IP, destination
IP, source port, destination port, protocol) plus byte and
packet counts, start and end times.

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
- Whether the bytes sent were sensitive material (need EDR
  (Endpoint Detection and Response — host-side security
  telemetry) / proxy / DLP correlation).
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
          // ra -c , -F /usr/local/argus/etc/ra.conf -r corp.argus -s stime,dur,proto,saddr,sport,daddr,dport,pkts,sbytes,dbytes
          [
            "stime,dur,proto,saddr,sport,daddr,dport,pkts,sbytes,dbytes",
            "2026-11-09 13:14:01.000,3.000,udp,10.0.4.55,52201,10.0.4.1,53,4,162,418",
            "2026-11-09 13:14:05.000,63.000,tcp,10.0.4.55,52214,203.0.113.42,443,182,4812,118204",
            "2026-11-09 13:18:30.000,221.000,tcp,10.0.4.55,52220,198.51.100.77,443,4204,318004115,2204004",
            "2026-11-09 13:30:01.000,2.000,udp,10.0.4.55,52301,10.0.4.1,53,3,140,322",
            "2026-11-09 13:30:08.000,1.000,udp,10.0.4.55,52302,8.8.8.8,53,2,98,260",
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
          "Which additional artifacts would most directly let you turn the third flow's shape into an attributed exfil claim?",
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
          "Confidence (1–5) that user `j.delacruz` personally uploaded sensitive material in the 13:18Z flow, based ONLY on these artifacts.",
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
          // Zeek dns.log exported as CSV via `zeek-cut -d` against a
          // 5-tuple selector; columns mirror the canonical dns.log fields.
          [
            "ts,id.orig_h,query,qtype_name,answers,rcode_name",
            "2026-11-09T14:00:01Z,10.0.4.55,login.microsoftonline.com,A,40.126.32.74,NOERROR",
            "2026-11-09T14:00:14Z,10.0.4.55,a1b2c3d4.tracking.example,A,-,NXDOMAIN",
            "2026-11-09T14:00:14Z,10.0.4.55,d3f9e2c1a08c4b7e.akamaiedge.net,A,23.45.122.18,NOERROR",
            "2026-11-09T14:00:16Z,10.0.4.55,qmkwoiek.dyn-vp.io,A,-,NXDOMAIN",
            "2026-11-09T14:00:17Z,10.0.4.55,sjflapwie.dyn-vp.io,A,-,NXDOMAIN",
            "2026-11-09T14:00:17Z,10.0.4.55,xvueriasdf.dyn-vp.io,A,-,NXDOMAIN",
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
          "**2 or 3.** The pattern is suspicious enough that an analyst should pivot. It is not yet proof: legitimate services occasionally rotate dynamic domains, and a single resolved name + one revisit is a thin record. Convert it into a confidence-5 finding via host-side process attribution and outbound-connection corroboration.\n\n**Owner.** Initial response goes through the unit ISSM under AR 25-2; supporting ACI is involved if attribution links the activity to a foreign intelligence entity.",
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
~6-minute window after EDR (Endpoint Detection and Response —
host-side security telemetry) raised a low-confidence
"uncategorised outbound TLS" alert. The capture is in two artifacts:

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
            "",
            "    1 2026-11-12 13:00:00.000000  10.0.4.55     → 10.0.4.1       DNS  75 Standard query 0x1234 A www.bing.com",
            "    2 2026-11-12 13:00:00.012000   10.0.4.1     → 10.0.4.55      DNS  91 Standard query response 0x1234 A 204.79.197.200",
            "    3 2026-11-12 13:00:00.350000  10.0.4.55     → 204.79.196.200 TCP  74 52302 → 443 [SYN] Seq=0 Win=65535 Len=0 MSS=1460",
            "    4 2026-11-12 13:01:00.000000  10.0.4.55     → 198.51.100.77  TCP  79 52310 → 443 [PSH, ACK] Seq=1 Ack=1 Win=65535 Len=25 [TCP segment of a reassembled PDU]",
            "    5 2026-11-12 13:01:00.050000 198.51.100.77  → 10.0.4.55      TCP  54 443 → 52310 [ACK] Seq=1 Ack=26 Win=65535 Len=0",
            "    6 2026-11-12 13:02:00.000000  10.0.4.55     → 198.51.100.77  TCP  79 52311 → 443 [PSH, ACK] Seq=1 Ack=1 Win=65535 Len=25",
            "    7 2026-11-12 13:02:00.050000 198.51.100.77  → 10.0.4.55      TCP  54 443 → 52311 [ACK] Seq=1 Ack=26 Win=65535 Len=0",
            "    8 2026-11-12 13:03:00.000000  10.0.4.55     → 198.51.100.77  TCP  79 52312 → 443 [PSH, ACK] Seq=1 Ack=1 Win=65535 Len=25",
            "    9 2026-11-12 13:03:00.050000 198.51.100.77  → 10.0.4.55      TCP  54 443 → 52312 [ACK] Seq=1 Ack=26 Win=65535 Len=0",
            "   10 2026-11-12 13:04:00.000000  10.0.4.55     → 198.51.100.77  TCP  79 52313 → 443 [PSH, ACK] Seq=1 Ack=1 Win=65535 Len=25",
            "   11 2026-11-12 13:04:00.050000 198.51.100.77  → 10.0.4.55      TCP  54 443 → 52313 [ACK] Seq=1 Ack=26 Win=65535 Len=0",
            "   12 2026-11-12 13:05:00.000000  10.0.4.55     → 198.51.100.77  TCP  79 52314 → 443 [PSH, ACK] Seq=1 Ack=1 Win=65535 Len=25",
            "   13 2026-11-12 13:05:00.050000 198.51.100.77  → 10.0.4.55      TCP  54 443 → 52314 [ACK] Seq=1 Ack=26 Win=65535 Len=0",
            "",
            "",
            "$ tshark -r capture-window.pcap -V -Y 'ip.addr == 198.51.100.77' -c 1",
            "",
            "Frame 4: 79 bytes on wire (632 bits), 79 bytes captured (632 bits)",
            "Ethernet II, Src: 02:00:00:00:00:01, Dst: 02:00:00:00:00:fe",
            "Internet Protocol Version 4, Src: 10.0.4.55, Dst: 198.51.100.77",
            "Transmission Control Protocol, Src Port: 52310, Dst Port: 443, Seq: 1, Ack: 1, Len: 25",
            "Transport Layer Security",
            "    TLSv1.2 Record Layer: Application Data Protocol: http-over-tls",
            "        Content Type: Application Data (23)",
            "        Version: TLS 1.2 (0x0303)",
            "        Length: 20",
            "        Encrypted Application Data: a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
            "",
            "",
            "$ grep '198.51.100.77' /var/log/named/queries.log",
            "(no matches)",
            "",
            "# Examiner notes (free-form, end of triage):",
            "#   10.0.4.55 -> workstation under review (WS-1108, console user j.delacruz, CORP\\j.delacruz).",
            "#   10.0.4.1  -> corporate DNS resolver + gateway.",
            "#   198.51.100.77 has no DNS query attributed to WS-1108 during the",
            "#                 capture window; the destination is reached by direct",
            "#                 IP. Payload bytes on those packets start with the TLS",
            "#                 application-data record header (0x17 0x03 0x03 ...),",
            "#                 20 bytes of opaque data; no observable handshake in",
            "#                 this slice.",
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
          "Confidence (1–5) that the 198.51.100.77 traffic is malicious C2 based ONLY on these artifacts.",
        expected: { type: "confidence", expectedRange: [2, 3] },
        debriefMd:
          "**2 or 3.** The cadence + direct-IP + uniform payload + no-DNS combination is suspicious enough to pursue. It is not by itself proof: legitimate apps (some VPN clients, telemetry agents, push-notification services) also beacon. Convert to a confidence-5 finding via host-side process identification and destination attribution.\n\n**Owner.** Unit ISSM owns the incident-response track under AR 25-2 (cybersecurity service provider coordination as needed); supporting ACI is involved if attribution links the activity to a foreign intelligence entity.",
      },
    ],
  },

  // ─── 5. Cross-Mission-Area: PIT diagnostic on a BMA port ────
  {
    slug: "network-pit-on-bma-port-001",
    title: "Cross-MA Triage: A PIT Diagnostic Kit on a BMA Switch Port",
    summary:
      "A device joins a Business-Mission-Area switch port whose fingerprint matches a Platform-IT diagnostic kit normally on the Warfighting side. Read what the port logs do and don't establish — and decide which authorities own this.",
    skillAreas: ["network_logs", "df_artifacts", "report_writing", "inference_discipline"],
    difficulty: 3,
    estimatedMinutes: 22,
    tags: ["network", "pit", "mission_area", "boundary", "owner_routing", "ar25_2", "inference_discipline"],
    lane: "network_logs",
    module: "Cross-Mission-Area routing",
    sequence: 1,
    brief: `
# Brief

Routine NAC review of yesterday's switch logs flags an unknown
device that joined a wall port in **Bldg 4250, room 214**
(garrison HR / finance suite — a Business Mission Area
network segment). The device drew a DHCP lease, exchanged ARP
with the segment gateway, and went quiet after ~14 minutes.

The MAC OUI and the LLDP / mDNS chatter the device emitted
match the fingerprint of a **PIT (Platform IT) diagnostic
kit** — specifically, a vehicle-system maintenance laptop
catalogued to a motor-pool support detachment whose normal
operating environment is the WMA-segment maintenance enclave
in Bldg 6190.

> **A note on Mission Areas.** DODIN-Army segregates IT into
> Mission Areas — broadly: **WMA** (Warfighting), **BMA**
> (Business), **EIEMA** (Enterprise Information Environment),
> **DIMA** (Defense Intelligence). **PIT** is a category of
> IT embedded in platforms / weapons systems and accredited
> through a separate authorisation chain (a Platform AO),
> distinct from the unit's network ATO. A PIT asset
> showing up on a BMA segment is by definition a boundary
> event regardless of intent — the two networks live under
> different authorisations.

What you have:

- **switch-port-log.txt** — the relevant entries from the
  edge switch (port up, MAC-learn, LLDP frame, mDNS
  announcement, port down).
- **dhcp-lease.txt** — the lease the BMA DHCP server handed
  out, with the OUI / vendor parsed and a short note from
  the NAC tool.
- **pit-inventory-row.json** — the inventory record for the
  device whose fingerprint matched (its catalogue entry,
  Platform AO, normal home enclave).
- **mission-area-owners.txt** — a short reference card of
  who-owns-what across Mission Areas when a cross-boundary
  observation surfaces.

This is a routing-first exercise. The exercise is **not**
"was this an attack" — the artifacts don't establish intent.
The exercise is to extract what the artifacts **do**
establish, and put the right authorities on notice in
parallel.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "switch-port-log.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "edge-sw-4250-2# show logging | include Gi1/0/14",
            "",
            "Nov 20 09:02:11.347: %LINK-3-UPDOWN: Interface GigabitEthernet1/0/14, changed state to up",
            "Nov 20 09:02:14.122: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet1/0/14, changed state to up",
            "Nov 20 09:02:18.502: %AUTHMGR-5-START: Starting 'mab' for client (001b.21aa.bbcc) on Interface Gi1/0/14 AuditSessionID 0A040207000000A1B2C3D4E5",
            "Nov 20 09:02:18.504: %MAB-5-SUCCESS: Authentication successful for client (001b.21aa.bbcc) on Interface Gi1/0/14 AuditSessionID 0A040207000000A1B2C3D4E5",
            "Nov 20 09:02:18.504: %AUTHMGR-7-RESULT: Authentication result 'success' from 'mab' for client (001b.21aa.bbcc) on Interface Gi1/0/14 AuditSessionID 0A040207000000A1B2C3D4E5",
            "Nov 20 09:02:18.512: %AUTHMGR-5-VLANASSIGN: VLAN 220 assigned to Interface Gi1/0/14 AuditSessionID 0A040207000000A1B2C3D4E5",
            "Nov 20 09:02:22.119: %LLDP-5-NEIGHBOR_ADDED: Neighbor PIT-DIAG-LT-014:eth0 added: chassis-id 00:1b:21:aa:bb:cc, capabilities Station, on Interface Gi1/0/14",
            "Nov 20 09:02:30.041: %DHCP_SNOOPING-5-DHCP_SNOOPING_BINDING_ADD: binding added 0A040476 / 001b.21aa.bbcc, vlan 220, interface Gi1/0/14, lease 3600 sec",
            "Nov 20 09:16:02.918: %LINK-3-UPDOWN: Interface GigabitEthernet1/0/14, changed state to down",
            "Nov 20 09:16:05.011: %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet1/0/14, changed state to down",
            "",
            "edge-sw-4250-2# show interface gi1/0/14",
            "",
            "GigabitEthernet1/0/14 is down, line protocol is down (notconnect)",
            "  Hardware is Gigabit Ethernet, address is f4cf.e2a1.0e2e (bia f4cf.e2a1.0e2e)",
            "  Description: Bldg 4250 / Rm 214 / desk-3 / wall-drop",
            "  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,",
            "     reliability 255/255, txload 1/255, rxload 1/255",
            "  Encapsulation ARPA, loopback not set",
            "  Last input 00:01:08, output 00:01:08, output hang never",
            "  Last clearing of \"show interface\" counters never",
            "",
            "edge-sw-4250-2# show running-config interface gi1/0/14",
            "",
            "Building configuration...",
            "",
            "Current configuration : 312 bytes",
            "!",
            "interface GigabitEthernet1/0/14",
            " description Bldg 4250 / Rm 214 / desk-3 / wall-drop",
            " switchport mode access",
            " switchport access vlan 220",
            " authentication host-mode multi-domain",
            " authentication order mab",
            " authentication priority mab",
            " authentication port-control auto",
            " mab",
            " spanning-tree portfast",
            "end",
            "",
            "# Operator notes (free-form, BMA access closet round)",
            "# - BMA-user VLAN 220 is a routed L3 segment that has no permitted path",
            "#   to the WMA maintenance enclave. East/west ACLs on the core block",
            "#   10.220.0.0/16 <-> 10.66.0.0/16.",
            "# - No 802.1X EAP exchange ran on this session (authentication order is",
            "#   `mab` only); the wall drop is MAB-fallback in production, a known",
            "#   posture deviation tracked under POAM 4250-NAC-04.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 2,
        displayName: "dhcp-lease.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "# ISC dhcpd 4.4.2 — /var/lib/dhcp/dhcpd.leases (excerpt)",
            "# host: dhcp-bma-01.intra.example",
            "# scope: 10.220.4.0/24 (bma-user)",
            "",
            "lease 10.220.4.118 {",
            "  starts 5 2026/11/20 09:02:25;",
            "  ends 5 2026/11/20 10:02:25;",
            "  tstp 5 2026/11/20 10:02:25;",
            "  cltt 5 2026/11/20 09:02:25;",
            "  binding state free;",
            "  next binding state free;",
            "  rewind binding state free;",
            "  hardware ethernet 00:1b:21:aa:bb:cc;",
            "  uid \"\\001\\000\\033!\\252\\273\\314\";",
            "  set vendor-class-identifier = \"ArmyMaintTools/wheeled-diag-v6\";",
            "  client-hostname \"PIT-DIAG-LT-014\";",
            "}",
            "",
            "",
            "# Cisco ISE 3.2 — Live Sessions / RADIUS Authentication detail",
            "# (queried by examiner via the ISE GUI; copy-paste of the detail pane)",
            "",
            "Session ID            : 0A040207000000A1B2C3D4E5",
            "Time                  : 2026-11-20 09:02:18 UTC",
            "Authentication Method : MAB",
            "Endpoint MAC          : 00:1B:21:AA:BB:CC",
            "Endpoint OUI          : Intel Corporate",
            "Hostname              : PIT-DIAG-LT-014   (DHCP Opt 12)",
            "Vendor-Class-ID       : ArmyMaintTools/wheeled-diag-v6   (DHCP Opt 60)",
            "Endpoint Profile      : Mobile-PIT-Asset-VehicleDiag",
            "                        ( ** matched profiling rule: hostname starts",
            "                          with 'PIT-' AND vendor-class contains",
            "                          'ArmyMaintTools' -> PIT-fingerprinted ** )",
            "Authorization Profile : PIT_Quarantine_VLAN",
            "Authorization Result  : POLICY MATCHED but ENFORCEMENT FAILED",
            "                        (\"quarantine VLAN not configured on",
            "                         GigabitEthernet1/0/14 — POAM 4250-NAC-04\")",
            "NAS                   : edge-sw-4250-2 (10.4.2.7)",
            "NAS Port              : GigabitEthernet1/0/14",
            "Posture Status        : NotApplicable",
            "",
            "# Effect:",
            "#   ISE wanted to push the device into VLAN 988 (PIT-quarantine);",
            "#   the access switch's MAB-fallback config does not advertise",
            "#   the quarantine VLAN, so the dynamic-VLAN assignment was",
            "#   silently dropped and the endpoint stayed in VLAN 220.",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 3,
        displayName: "pit-inventory-row.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              asset_tag: "PIT-DIAG-LT-014",
              category: "Platform IT (PIT) — wheeled-vehicle maintenance diagnostic kit",
              hand_receipt_holder: "SFC J. Marquez, 4-118 BSB Motor Pool",
              normal_operating_enclave: "WMA / maint-diag-enclave (Bldg 6190, isolated; no garrison routed path)",
              platform_ao: "PEO CS&CSS Platform AO (vehicle-diagnostics ATO bundle)",
              network_ato_unit_boundary: "Does NOT operate on the unit's garrison ATO boundary. Cross-segment use requires a documented exception coordinated through the unit ISSM and the Platform AO.",
              last_inventory_sighting: "Bldg 6190 maint bay, 2026-11-18 (visual; no network sighting because the enclave is normally air-gapped to wired backhaul).",
              note: "Standard procedure for off-enclave use is a written request to the Platform AO with concurrence from the unit ISSM; a sticker is affixed to the chassis with the authorisation number when granted. The chassis sticker for PIT-DIAG-LT-014 currently shows no off-enclave authorisation.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "mission-area-owners.txt",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Cross-Mission-Area owner-routing reference (training extract)",
            "-------------------------------------------------------------",
            "",
            "* Unit ISSM (AR 25-2)",
            "    Owns the unit's network ATO boundary. Any device that",
            "    appears on a unit-owned segment without authorisation is",
            "    a boundary event the ISSM must see — independent of",
            "    intent and independent of which Mission Area the device",
            "    'belongs' to.",
            "",
            "* Platform AO (the PIT system's authorisation chain)",
            "    Owns the accreditation of the PIT device itself. When",
            "    a PIT asset operates outside its accredited enclave, the",
            "    Platform AO has the authoritative say on what the device",
            "    is allowed to do, and is the party that can authorise",
            "    (or refuse) continued off-enclave operation.",
            "",
            "* Supporting ACI office (AR 381-12)",
            "    Owns the counterintelligence-attribution angle if and",
            "    when the boundary crossing develops articulable facts",
            "    suggesting a witting actor. A first observation of an",
            "    accidental wall-port misconnect is not, on its own, a",
            "    CI referral; a pattern of unexplained PIT appearances",
            "    on BMA segments would be.",
            "",
            "* J6 / network operations",
            "    Owns the operational response: port shut, MAC quarantine,",
            "    physical recovery of the device. Acts under the ISSM's",
            "    direction for incident-response decisions.",
            "",
            "* USACIDC",
            "    Engaged downstream only if a criminal predicate develops",
            "    (e.g. confirmed unauthorised cross-domain data transfer",
            "    or destruction of evidence). Not a first responder for a",
            "    boundary-event observation.",
            "",
          ].join("\n"),
        ),
      },
    ],
    indicatorSets: [
      {
        slug: "pit-bma-indicators",
        displayName: "Observations from the port logs + DHCP + inventory + reference card",
        items: [
          {
            id: "device-was-on-bma-vlan",
            label:
              "A device drew a DHCP lease and went IP-active on VLAN 220 (bma-user) for ~14 minutes from a wall port in Bldg 4250 room 214.",
            evidenceRef: "switch-port-log.txt",
          },
          {
            id: "fingerprint-matches-pit-asset",
            label:
              "The LLDP system-name, mDNS service announcement, and DHCP vendor-id all line up with the catalogue fingerprint for PIT-DIAG-LT-014.",
            evidenceRef: "dhcp-lease.txt",
          },
          {
            id: "no-off-enclave-authorisation",
            label:
              "The PIT inventory record shows no current off-enclave authorisation for this asset; the chassis sticker is blank.",
            evidenceRef: "pit-inventory-row.json",
          },
          {
            id: "east-west-blocked",
            label:
              "Core east/west ACLs block routed traffic between the BMA-user VLAN (10.220.0.0/16) and the WMA maintenance enclave (10.66.0.0/16).",
            evidenceRef: "switch-port-log.txt",
          },
          {
            id: "no-quarantine-applied",
            label:
              "The NAC tool wanted to quarantine the device based on PIT fingerprint, but couldn't — the wall port is in MAB-fallback with no quarantine VLAN configured (POAM 4250-NAC-04).",
            evidenceRef: "dhcp-lease.txt",
          },
          {
            id: "user-data-not-observed",
            label:
              "No application-layer traffic from the device is captured in this artifact set — what was on the device, what it tried to reach, and what (if anything) it carried away are not established by the port log alone.",
            evidenceRef: "switch-port-log.txt",
          },
          {
            id: "no-eap-on-port",
            label:
              "No 802.1X EAP exchange occurred on the port — the device was admitted on MAC-only authentication, which is a known posture deviation tracked under POAM 4250-NAC-04.",
            evidenceRef: "switch-port-log.txt",
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
          "Which statements about the event are **facts** established by the artifacts as written?",
        options: [
          {
            id: "device-on-bma",
            label:
              "A device with a Platform-IT fingerprint was active on the BMA-user VLAN for ~14 minutes from a Bldg 4250 wall port.",
          },
          {
            id: "is-the-real-pit-laptop",
            label:
              "The device on the port is, in fact, PIT-DIAG-LT-014 (the specific catalogued chassis).",
          },
          {
            id: "off-enclave-without-auth",
            label:
              "If the device is the real PIT-DIAG-LT-014, it was off-enclave without the required Platform-AO authorisation.",
          },
          {
            id: "cross-domain-data-transfer",
            label:
              "Data was transferred between the WMA maintenance enclave and the BMA segment as a result of this event.",
          },
          {
            id: "deliberate-bridging",
            label:
              "A witting human deliberately bridged the two Mission Areas.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["device-on-bma", "off-enclave-without-auth"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Fact:**",
          "",
          "- The port log + DHCP lease establish the device was IP-active on the BMA-user VLAN for the recorded window. That's an observed event.",
          "- The PIT inventory row shows no off-enclave authorisation. If this is PIT-DIAG-LT-014, the off-enclave-without-authorisation conclusion follows from the inventory state.",
          "",
          "**Not fact (yet):**",
          "",
          "- *Is the real PIT-DIAG-LT-014* — the fingerprint matches the catalogue entry, but a fingerprint match is identity by *advertisement*. A second device could spoof the LLDP name, MAC OUI, and mDNS strings. Physical recovery of the chassis (and sticker check) is what converts \"fingerprint matched\" into \"this chassis was on the port.\"",
          "- *Cross-domain data transfer* — east/west ACLs block routed paths between the two enclaves, and no application-layer data is in the artifact set. The port log doesn't say bytes moved between Mission Areas; it says a device joined one of them.",
          "- *Deliberate bridging* — intent is not established. An accidental wall-port misconnect is the **mundane** explanation and remains the most likely until evidence of pattern or motive surfaces.",
        ].join("\n"),
      },
      {
        ordinal: 2,
        type: "select_indicators",
        weight: 2,
        indicatorSetSlug: "pit-bma-indicators",
        promptMd:
          "Pick the observations that are **directly relevant** to characterising this as a cross-Mission-Area boundary event (as opposed to a routine BMA-side NAC anomaly).",
        expected: {
          type: "select_indicators",
          correctIds: [
            "device-was-on-bma-vlan",
            "fingerprint-matches-pit-asset",
            "no-off-enclave-authorisation",
            "no-quarantine-applied",
          ],
        },
        debriefMd: [
          "**Directly relevant:**",
          "",
          "- The presence of the device on the BMA-user VLAN is the boundary event itself.",
          "- The PIT fingerprint match is what makes this **cross-MA** rather than a generic unknown-device admission — the device's accredited home is on a different Mission Area's accredited enclave.",
          "- The absence of an off-enclave authorisation is what makes it a **violation** of the PIT accreditation, not just an unusual sighting.",
          "- The NAC quarantine failure is a control-effectiveness observation that the ISSM owns: the policy fired but the enforcement path didn't, which is itself reportable.",
          "",
          "**Context-only (not the boundary-event characterisation):**",
          "",
          "- *East/west ACLs blocking BMA↔WMA* is reassuring background on the data-movement question; it doesn't characterise the event itself.",
          "- *User data not observed* is a scope-of-evidence note for the writeup, not a characterising observation.",
          "- *No EAP on the port* is a separate, pre-existing posture finding (POAM 4250-NAC-04). It is the **enabling weakness**, but it would still be tracked even with no PIT device involved.",
        ].join("\n"),
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Pick the **correct owner routing** for this observation. Multiple owners may apply in parallel.",
        options: [
          {
            id: "to-issm",
            label:
              "Notify the unit ISSM as the owner of the unit's network ATO boundary under AR 25-2 — a PIT-fingerprinted device admitted onto a BMA segment is the ISSM's incident to lead.",
          },
          {
            id: "to-platform-ao",
            label:
              "Notify the Platform AO listed for PIT-DIAG-LT-014 — the device operated outside its accredited enclave without authorisation, which is the Platform AO's call to assess.",
          },
          {
            id: "to-j6-netops",
            label:
              "Task J6 / network operations to disable port Gi1/0/14 pending recovery and to coordinate physical retrieval of the device with the hand-receipt holder (SFC Marquez).",
          },
          {
            id: "hold-aci-pending-facts",
            label:
              "Hold any supporting-ACI-office referral under AR 381-12 pending facts from the recovery + interview about how the device reached the BMA wall port; a first observation is not, on its own, a CI referral.",
          },
          {
            id: "open-cidc-now",
            label:
              "Open a USACIDC criminal-investigation case immediately on the strength of the boundary event.",
          },
          {
            id: "do-nothing-blocked-anyway",
            label:
              "Take no action — east/west ACLs blocked any data path between the Mission Areas, so the event has no operational consequence.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: ["to-issm", "to-platform-ao", "to-j6-netops", "hold-aci-pending-facts"],
          allowMultiple: true,
        },
        debriefMd: [
          "**Right routes (all four):**",
          "",
          "- The unit ISSM owns the network ATO boundary. They get the call regardless of intent.",
          "- The Platform AO owns the PIT system's accreditation. They are the authority on whether the device may continue to operate after this event.",
          "- J6 / network operations executes the port-shut + physical-recovery legwork under the ISSM's direction.",
          "- The supporting ACI office is held in reserve. Send a referral once recovery + interview surfaces facts (e.g. \"the device has been at room 214 three times this month\" or \"the operator can't account for what software was loaded last week\") — not on a single accidental-looking event with no human-conduct facts yet.",
          "",
          "**Wrong:**",
          "",
          "- *Open USACIDC now* — there is no criminal predicate. A boundary event is not by itself a crime, and a premature CIDC opening confuses the routing.",
          "- *Do nothing* — the ACLs blocked routed paths between Mission Areas; they did not stop the boundary event from happening on the unit's network. The control-effectiveness gap (the NAC quarantine that didn't apply) is itself a reportable observation under AR 25-2 regardless of data movement.",
        ].join("\n"),
      },
      {
        ordinal: 4,
        type: "confidence",
        weight: 1,
        promptMd:
          "Confidence (1–5) that the right writeup should currently read: 'Cross-domain data transfer occurred between the WMA maintenance enclave and the BMA-user segment.'",
        expected: { type: "confidence", expectedRange: [1, 2] },
        debriefMd:
          "**1 or 2.** The artifacts establish *a PIT-fingerprinted device joined a BMA wall port for 14 minutes*. They do not establish that bytes moved between Mission Areas. East/west ACLs block routed paths, no application-layer telemetry is in the artifact set, and what (if anything) was carried into or out of the WMA enclave on the device's local storage is a question for the physical recovery + forensic image, not the port log. A defensible writeup names the boundary event, names the missing artifacts (chassis recovery, host image, operator interview), and reports the control-effectiveness gap (NAC quarantine that did not apply).",
      },
    ],
  },

  // ─── Network & Logs capstone ────────────────────────────────
  {
    slug: "network-beacon-multi-source-capstone-001",
    title: "Network Capstone: Beacon, Flows, and DNS",
    summary:
      "EDR raised a low-confidence outbound-TLS alert. Pull the flow records, the DNS log, the proxy log, and a short Zeek excerpt. Decide what the signals together support and what they don't.",
    skillAreas: ["network_logs", "report_writing", "inference_discipline"],
    difficulty: 4,
    estimatedMinutes: 65,
    tags: [
      "network",
      "beacon",
      "dns",
      "netflow",
      "proxy",
      "report_writing",
      "inference_discipline",
      "capstone",
    ],
    lane: "network_logs",
    module: "Capstone",
    sequence: 1,
    status: "draft",
    brief: `
# Brief

EDR on \`WS-RD-082\` raised an "uncategorised outbound TLS"
alert at 09:14Z this morning — low-confidence, the kind of
alert a tier-1 analyst would normally close after a glance.
The host is owned by \`j.parker\` (DA-civ, R&D Cell 4); the
account has no prior alerts.

Network team pulled four artifacts from their telemetry stack
covering the trailing 24 hours on this host:

- NetFlow records for the host's outbound traffic
- DNS queries (resolver-side log)
- Proxy log (TLS connections with SNI + user attribution)
- A short Zeek conn.log excerpt that captures the EDR alert's
  window

You also have the alert payload itself. Read everything for
what it *together* supports: is this beacon-like, what's the
destination story, and what would have to be true for a
defensible "C2 traffic on this host" claim vs a "weird third-
party app phone-home" one.
`.trim(),
    artifacts: [
      {
        ordinal: 1,
        displayName: "edr-alert.json",
        kind: "json",
        mimeType: "application/json; charset=utf-8",
        bytes: utf8(
          JSON.stringify(
            {
              alert_id: "EDR-2026-12-04-09141-WS-RD-082",
              host: "WS-RD-082",
              user: "j.parker",
              event_utc: "2026-12-04T09:14:08Z",
              category: "uncategorised_outbound_tls",
              confidence: "low",
              process: "C:\\Program Files (x86)\\Vendr\\vendr-helper.exe",
              process_signed: true,
              process_signer: "Vendr Holdings LLC",
              destination_host: "(SNI not captured by EDR at trigger)",
              destination_ip: "198.51.100.220",
              destination_port: 443,
              note:
                "EDR fired on first observation of vendr-helper.exe egress; baseline window was 21 days. Process is signed and not on any IOC list.",
            },
            null,
            2,
          ) + "\n",
        ),
      },
      {
        ordinal: 2,
        displayName: "netflow.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "start_utc,end_utc,src_ip,src_port,dst_ip,dst_port,proto,packets,bytes",
            // 24h of repeated periodic egress from the host to one IP, plus a baseline of normal browsing.
            "2026-12-04T05:14:08Z,2026-12-04T05:14:11Z,10.42.18.82,52144,198.51.100.220,443,TCP,8,2218",
            "2026-12-04T06:14:08Z,2026-12-04T06:14:11Z,10.42.18.82,52211,198.51.100.220,443,TCP,8,2204",
            "2026-12-04T07:14:08Z,2026-12-04T07:14:11Z,10.42.18.82,52308,198.51.100.220,443,TCP,8,2188",
            "2026-12-04T08:14:08Z,2026-12-04T08:14:11Z,10.42.18.82,52401,198.51.100.220,443,TCP,8,2240",
            "2026-12-04T09:14:08Z,2026-12-04T09:14:11Z,10.42.18.82,52522,198.51.100.220,443,TCP,8,2196",
            // Normal browsing in the same window for context (variable size, variable timing).
            "2026-12-04T08:51:18Z,2026-12-04T08:51:42Z,10.42.18.82,52488,142.250.190.110,443,TCP,148,402118",
            "2026-12-04T09:02:22Z,2026-12-04T09:02:55Z,10.42.18.82,52502,52.114.158.91,443,TCP,402,1102218",
            "2026-12-04T09:08:14Z,2026-12-04T09:08:18Z,10.42.18.82,52517,140.82.121.4,443,TCP,68,148022",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 3,
        displayName: "dns-queries.csv",
        kind: "csv",
        mimeType: "text/csv; charset=utf-8",
        bytes: utf8(
          [
            "ts_utc,client_ip,qname,qtype,rcode,answer_ip",
            "2026-12-04T05:14:07Z,10.42.18.82,api.vendr-app.io,A,NOERROR,198.51.100.220",
            "2026-12-04T06:14:07Z,10.42.18.82,api.vendr-app.io,A,NOERROR,198.51.100.220",
            "2026-12-04T07:14:07Z,10.42.18.82,api.vendr-app.io,A,NOERROR,198.51.100.220",
            "2026-12-04T08:14:07Z,10.42.18.82,api.vendr-app.io,A,NOERROR,198.51.100.220",
            "2026-12-04T09:14:07Z,10.42.18.82,api.vendr-app.io,A,NOERROR,198.51.100.220",
            "2026-12-04T08:51:17Z,10.42.18.82,www.google.com,A,NOERROR,142.250.190.110",
            "2026-12-04T09:02:21Z,10.42.18.82,outlook.office365.com,A,NOERROR,52.114.158.91",
            "2026-12-04T09:08:13Z,10.42.18.82,github.com,A,NOERROR,140.82.121.4",
          ].join("\n") + "\n",
        ),
      },
      {
        ordinal: 4,
        displayName: "proxy.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Proxy log (TLS connections, last 4h)",
            "------------------------------------",
            "",
            "  ts_utc                   src               user        sni                       dst_ip          bytes_in  bytes_out  category",
            "  2026-12-04T05:14:08Z     10.42.18.82       j.parker    api.vendr-app.io          198.51.100.220  812       1406       business_software",
            "  2026-12-04T06:14:08Z     10.42.18.82       j.parker    api.vendr-app.io          198.51.100.220  802       1402       business_software",
            "  2026-12-04T07:14:08Z     10.42.18.82       j.parker    api.vendr-app.io          198.51.100.220  788       1400       business_software",
            "  2026-12-04T08:14:08Z     10.42.18.82       j.parker    api.vendr-app.io          198.51.100.220  840       1400       business_software",
            "  2026-12-04T09:14:08Z     10.42.18.82       j.parker    api.vendr-app.io          198.51.100.220  796       1400       business_software",
            "  2026-12-04T08:51:18Z     10.42.18.82       j.parker    www.google.com            142.250.190.110 401200    902        web_search",
            "  2026-12-04T09:02:22Z     10.42.18.82       j.parker    outlook.office365.com     52.114.158.91   1100100   2118       webmail",
            "",
            "(Proxy 'business_software' category = vendor-published SaaS app. The destination",
            " api.vendr-app.io is registered to Vendr Holdings LLC per WHOIS.)",
            "",
          ].join("\n"),
        ),
      },
      {
        ordinal: 5,
        displayName: "zeek-conn-excerpt.log",
        kind: "text",
        mimeType: "text/plain; charset=utf-8",
        bytes: utf8(
          [
            "Zeek conn.log (excerpt — 09:13-09:15 window)",
            "--------------------------------------------",
            "",
            "  uid       ts                 id.orig_h     id.orig_p  id.resp_h         id.resp_p  proto  service  duration  orig_bytes  resp_bytes  conn_state",
            "  CzMI8a    2026-12-04T09:14:08.118Z  10.42.18.82   52522      198.51.100.220   443        tcp    ssl      3.014     1406        802         SF",
            "  CzMI8b    2026-12-04T09:14:08.402Z  10.42.18.82   52523      52.114.158.91    443        tcp    ssl      28.118    2118        1102218     SF",
            "  CzMI8c    2026-12-04T09:14:11.998Z  10.42.18.82   52524      140.82.121.4     443        tcp    ssl      4.418     148022      68018       SF",
            "",
            "(SF = Normal SYN→FIN connection establishment and tear-down.",
            " orig_bytes/resp_bytes are the TCP payload bytes, not the wire bytes.)",
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
          "Reading the NetFlow + DNS + proxy log together, which features of the traffic to `198.51.100.220` are **directly visible** in the artifacts (not inferred)?",
        options: [
          {
            id: "regular-interval",
            label:
              "The host contacted `198.51.100.220` at almost exactly the top of every hour for at least five consecutive hours.",
          },
          {
            id: "small-uniform-size",
            label:
              "Each connection moved a small, near-uniform payload (~2 KB total, both directions combined).",
          },
          {
            id: "dns-resolved",
            label:
              "Each contact was preceded by a successful DNS lookup of `api.vendr-app.io`, which resolves to that same IP.",
          },
          {
            id: "proxy-attribution",
            label:
              "The proxy log attributes every connection to the `j.parker` account at that source IP.",
          },
          {
            id: "stealth",
            label:
              "The traffic was specifically engineered to evade detection.",
          },
        ],
        allowMultiple: true,
        expected: {
          type: "multi_choice",
          correctIds: [
            "regular-interval",
            "small-uniform-size",
            "dns-resolved",
            "proxy-attribution",
          ],
          allowMultiple: true,
        },
        debriefMd:
          "The first four are what the artifacts plainly say. Hourly cadence + small uniform payload + the same DNS-then-IP every time + user attribution — these are the four facts a writeup would lead with. *Engineered to evade detection* is interpretive and not in any row.",
      },
      {
        ordinal: 2,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "The pattern (regular interval, small uniform size, repeated destination) is the textbook shape of a beacon. From this artifact set, what is **the most cautious read** about what the beacon is doing?",
        options: [
          {
            id: "c2-confirmed",
            label:
              "This is C2 traffic to an adversary-controlled server. Open an active-compromise incident.",
          },
          {
            id: "beacon-shape-unknown-intent",
            label:
              "The traffic has the **shape** of a beacon, but the destination (`api.vendr-app.io`) is a vendor-software SaaS endpoint and the originating process is signed by that vendor. SaaS apps routinely heartbeat. Investigate before declaring C2.",
          },
          {
            id: "benign-vendor",
            label:
              "The destination is registered to a real software vendor and the process is signed; close the alert as a benign vendor heartbeat with no further action.",
          },
          {
            id: "exfil-confirmed",
            label:
              "Bytes are leaving the host on a regular cadence, so this is exfiltration.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["beacon-shape-unknown-intent"],
          allowMultiple: false,
        },
        debriefMd:
          "Beacon-shape is necessary for C2; it's not sufficient. The destination, on its face, is a published vendor SaaS endpoint, and the process is a code-signed vendor binary — both consistent with a legitimate vendor's app heartbeat. The right next step is to verify the vendor (WHOIS, certificate transparency, the unit's software-asset register) and the process (signature chain, hash against the vendor's published hash) before either closing as benign or escalating to C2. Declaring C2 from shape alone is the canonical over-claim; declaring benign from vendor branding alone is the canonical under-claim. *Exfiltration* would require larger outbound bytes than ~1.4 KB per beat.",
      },
      {
        ordinal: 3,
        type: "multi_choice",
        weight: 1,
        promptMd:
          "From the artifacts available, which **single additional check** would most directly resolve the *legitimate vendor heartbeat* vs *C2 lookalike* question?",
        options: [
          {
            id: "tls-fingerprint",
            label:
              "Compare the certificate chain on `api.vendr-app.io` against the vendor's published certificate(s); pair with a fresh WHOIS and certificate-transparency lookup for the domain.",
          },
          {
            id: "more-netflow",
            label:
              "Pull another 48 hours of NetFlow to see whether the cadence drifts.",
          },
          {
            id: "rebuild-host",
            label:
              "Reimage the workstation.",
          },
          {
            id: "block-ip",
            label:
              "Block the destination IP at the firewall and see what breaks.",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["tls-fingerprint"],
          allowMultiple: false,
        },
        debriefMd:
          "The certificate chain + WHOIS + CT lookup is the cheapest read that distinguishes a real vendor endpoint from a lookalike. A real vendor heartbeat uses the vendor's CA-issued cert; a lookalike domain registered last month would show in CT and in WHOIS recency. Pulling more flow data confirms the cadence shape we already see and doesn't speak to *who* the destination is. Reimaging is premature without an actual finding. Blocking the IP to see what breaks is operationally hostile (it might be a real business app) and isn't an investigation.",
      },
      {
        ordinal: 4,
        type: "text_match",
        weight: 1,
        promptMd:
          "Quote the **destination IP** the beacon traffic goes to, exactly as it appears in the artifacts.",
        textMatch: {
          acceptableAnswers: ["198.51.100.220"],
          hint: "Look at the NetFlow `dst_ip` column or the EDR alert `destination_ip` field.",
          hintAfterTries: 2,
        },
        expected: {
          type: "text_match",
          acceptableAnswers: ["198.51.100.220"],
          regex: false,
        },
        debriefMd:
          "`198.51.100.220`. A specific IP belongs in the writeup; *a Vendr server* is weaker than *198.51.100.220 (resolved from api.vendr-app.io)* and the latter is what disambiguates the call-out from any other Vendr infrastructure.",
      },
      {
        ordinal: 5,
        type: "multi_choice",
        weight: 2,
        promptMd:
          "Three drafts of the writeup that gets shared back with the network team. Pick the one you'd actually send.",
        options: [
          {
            id: "overclaim",
            label:
              "*WS-RD-082 is beaconing to a C2 server at 198.51.100.220. Recommend isolating the host and opening an active-compromise incident.*",
          },
          {
            id: "calibrated",
            label:
              "*Telemetry from WS-RD-082 (user j.parker) shows a recurring hourly connection to 198.51.100.220 (api.vendr-app.io) from 05:14Z through 09:14Z on 2026-12-04, each connection roughly 1.4 KB outbound / 0.8 KB inbound. The cadence and small uniform payload match the textbook shape of a beacon. The destination is published vendor SaaS infrastructure on its face — WHOIS attributes it to Vendr Holdings LLC and the originating process (`vendr-helper.exe`) is code-signed by the same publisher — but vendor-published infrastructure can be lookalike-impersonated, and the EDR alert is the first observation of this process egressing in a 21-day baseline. Recommend a TLS fingerprint check against the vendor's known certificate, a fresh WHOIS + certificate-transparency lookup on api.vendr-app.io, and a hash match of vendr-helper.exe against the vendor's published binary before deciding whether this is benign or escalate-worthy. No exfiltration consistent with the observed byte volumes.*",
          },
          {
            id: "underclaim",
            label:
              "*Closing the EDR alert. Destination is a vendor SaaS endpoint and the process is signed. Nothing to do here.*",
          },
        ],
        allowMultiple: false,
        expected: {
          type: "multi_choice",
          correctIds: ["calibrated"],
          allowMultiple: false,
        },
        debriefMd:
          "The middle one. It names the shape facts (cadence, payload sizes, destination, attribution), names what the artifacts *don't* yet resolve (vendor authenticity), and recommends the cheap next step (TLS + WHOIS + binary hash). The first calls it C2 from shape alone and recommends isolating a host without verifying that the vendor branding is fake. The third treats vendor branding + a signed binary as a conclusion when both are spoofable signals; an attacker registering a lookalike domain with valid certs and a code-signed dropper is the textbook reason \"signed + branded\" isn't a close-the-alert short-circuit.",
      },
    ],
  },
];
