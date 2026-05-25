// Shared helpers for building seed artifact bytes. Keeping these
// out of seed.ts lets the scenarios file pull them in without
// reaching into the Prisma orchestration module.

export function utf8(s: string): Buffer {
  return Buffer.from(s, "utf-8");
}

// A minimal but valid 1x1 transparent PNG. Tiny enough to embed
// inline; big enough to prove the image-viewer dispatch works
// end-to-end. Suitable for placeholder photographs that the
// scenario text describes — the exercise is never to identify
// anything from the image bytes.
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export function tinyPngBytes(): Buffer {
  return Buffer.from(TINY_PNG_BASE64, "base64");
}

// A minimal valid one-page PDF rendered with a single line of
// text. Hand-built to keep the seed self-contained (no PDF
// library dependency). Renders in any standards-compliant
// viewer.
export function buildTinyPdf(text = "CICyberLab seed PDF artifact"): Buffer {
  // Strip parentheses defensively — PDF strings use them as
  // delimiters. Anything else printable is fine.
  const safeText = text.replace(/[()]/g, "");
  const stream = `BT /F1 24 Tf 60 720 Td (${safeText}) Tj ET`;
  const streamBytes = Buffer.from(stream, "ascii");

  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj\n",
    `4 0 obj << /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "binary");
  for (const o of objects) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(o, "binary");
  }
  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.concat([
    Buffer.from(header, "binary"),
    ...objects.map((o) => Buffer.from(o, "binary")),
    Buffer.from(xref, "binary"),
    Buffer.from(trailer, "binary"),
  ]);
}

// ─── PCAP builder ────────────────────────────────────────────
//
// Hand-builds a minimal libpcap (classic) capture file from a
// list of high-level packet descriptions. The output opens
// cleanly in Wireshark / tshark / tcpdump. We deliberately do NOT
// compute correct IP / TCP / UDP checksums (Wireshark just flags
// them as "incorrect"); the goal is realistic-looking
// metadata + payload for forensic-reading exercises, not
// wire-correct simulation.
//
// Link type: 1 (Ethernet). IPv4 only. TCP and UDP supported.

export interface PcapPacket {
  // Wall-clock time of the packet (microsecond precision is
  // truncated to whole-microseconds since the libpcap classic
  // record header carries (sec, usec)).
  timestamp: Date;
  srcMac?: string; // "aa:bb:cc:dd:ee:ff"; defaults supplied
  dstMac?: string;
  srcIp: string; // dotted quad
  dstIp: string;
  proto: "tcp" | "udp";
  srcPort: number;
  dstPort: number;
  payload?: Buffer; // application bytes; may be empty
  // TCP-only flags. Default: SYN false, ACK true (ordinary
  // mid-stream data packet). Specifying { syn: true } gives a
  // SYN packet for handshake-shaped traffic.
  tcpFlags?: { syn?: boolean; ack?: boolean; fin?: boolean; psh?: boolean };
  // TCP-only seq / ack numbers. Defaults: random-ish per-flow.
  tcpSeq?: number;
  tcpAck?: number;
}

const DEFAULT_CLIENT_MAC = "02:00:00:00:00:01";
const DEFAULT_GATEWAY_MAC = "02:00:00:00:00:fe";

function parseMac(s: string): Buffer {
  const parts = s.split(":");
  if (parts.length !== 6) {
    throw new Error(`invalid MAC: ${s}`);
  }
  const out = Buffer.alloc(6);
  for (let i = 0; i < 6; i++) {
    const part = parts[i];
    if (!part) throw new Error(`invalid MAC: ${s}`);
    out[i] = Number.parseInt(part, 16);
  }
  return out;
}

function parseIp(s: string): Buffer {
  const parts = s.split(".");
  if (parts.length !== 4) {
    throw new Error(`invalid IPv4: ${s}`);
  }
  const out = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    const part = parts[i];
    if (!part) throw new Error(`invalid IPv4: ${s}`);
    out[i] = Number.parseInt(part, 10);
  }
  return out;
}

function buildPacketBytes(p: PcapPacket): Buffer {
  const eth = Buffer.alloc(14);
  parseMac(p.dstMac ?? DEFAULT_GATEWAY_MAC).copy(eth, 0);
  parseMac(p.srcMac ?? DEFAULT_CLIENT_MAC).copy(eth, 6);
  eth.writeUInt16BE(0x0800, 12); // IPv4

  const payload = p.payload ?? Buffer.alloc(0);
  const l4HeaderLen = p.proto === "tcp" ? 20 : 8;
  const ipTotalLen = 20 + l4HeaderLen + payload.length;

  const ip = Buffer.alloc(20);
  ip[0] = 0x45; // version 4, IHL 5 (20 bytes)
  ip[1] = 0x00; // DSCP / ECN
  ip.writeUInt16BE(ipTotalLen, 2);
  ip.writeUInt16BE(0x0001, 4); // identification
  ip.writeUInt16BE(0x4000, 6); // flags=Don't Fragment, frag offset 0
  ip[8] = 64; // TTL
  ip[9] = p.proto === "tcp" ? 6 : 17;
  ip.writeUInt16BE(0x0000, 10); // checksum — not computed; Wireshark flags it
  parseIp(p.srcIp).copy(ip, 12);
  parseIp(p.dstIp).copy(ip, 16);

  let l4: Buffer;
  if (p.proto === "tcp") {
    l4 = Buffer.alloc(20);
    l4.writeUInt16BE(p.srcPort, 0);
    l4.writeUInt16BE(p.dstPort, 2);
    l4.writeUInt32BE(p.tcpSeq ?? 1, 4);
    l4.writeUInt32BE(p.tcpAck ?? 0, 8);
    l4[12] = 0x50; // data offset 5 (20 bytes), reserved 0
    let flags = 0;
    // tcpFlags undefined → default to ACK-only (ordinary mid-stream
    // data packet). When the caller passes a tcpFlags object, use
    // exactly what was specified — no implicit ack.
    const f = p.tcpFlags ?? { ack: true };
    if (f.fin) flags |= 0x01;
    if (f.syn) flags |= 0x02;
    if (f.psh) flags |= 0x08;
    if (f.ack) flags |= 0x10;
    l4[13] = flags;
    l4.writeUInt16BE(0xfaf0, 14); // window
    l4.writeUInt16BE(0x0000, 16); // checksum — not computed
    l4.writeUInt16BE(0x0000, 18); // urgent
  } else {
    l4 = Buffer.alloc(8);
    l4.writeUInt16BE(p.srcPort, 0);
    l4.writeUInt16BE(p.dstPort, 2);
    l4.writeUInt16BE(8 + payload.length, 4); // length (header + payload)
    l4.writeUInt16BE(0x0000, 6); // checksum — not computed
  }

  return Buffer.concat([eth, ip, l4, payload]);
}

/**
 * Build a libpcap (classic) capture file from a list of high-level
 * packets. Returns a complete file buffer ready to ship as artifact
 * bytes with mime type `application/vnd.tcpdump.pcap`.
 */
export function buildPcap(packets: PcapPacket[]): Buffer {
  const GLOBAL_HEADER = Buffer.alloc(24);
  GLOBAL_HEADER.writeUInt32LE(0xa1b2c3d4, 0); // magic (LE, microsecond TS)
  GLOBAL_HEADER.writeUInt16LE(2, 4); // version major
  GLOBAL_HEADER.writeUInt16LE(4, 6); // version minor
  GLOBAL_HEADER.writeInt32LE(0, 8); // thiszone (UTC)
  GLOBAL_HEADER.writeUInt32LE(0, 12); // sigfigs
  GLOBAL_HEADER.writeUInt32LE(65535, 16); // snaplen
  GLOBAL_HEADER.writeUInt32LE(1, 20); // network = Ethernet

  const chunks: Buffer[] = [GLOBAL_HEADER];
  for (const p of packets) {
    const pkt = buildPacketBytes(p);
    const recordHeader = Buffer.alloc(16);
    const ms = p.timestamp.getTime();
    const sec = Math.floor(ms / 1000);
    const usec = (ms % 1000) * 1000;
    recordHeader.writeUInt32LE(sec, 0);
    recordHeader.writeUInt32LE(usec, 4);
    recordHeader.writeUInt32LE(pkt.length, 8); // incl_len
    recordHeader.writeUInt32LE(pkt.length, 12); // orig_len
    chunks.push(recordHeader, pkt);
  }
  return Buffer.concat(chunks);
}
