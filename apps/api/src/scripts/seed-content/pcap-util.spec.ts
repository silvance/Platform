import { buildPcap } from "./util";

// the PCAP byte builder is hand-rolled. Pin the file-header
// shape + per-packet record-header layout so a future tweak that
// breaks the libpcap-classic format gets caught here rather than
// in a Wireshark "file is corrupted" toast.

describe("buildPcap (libpcap classic)", () => {
  it("writes the magic + version + linktype in the 24-byte global header", () => {
    const buf = buildPcap([
      {
        timestamp: new Date("2026-11-12T13:00:00Z"),
        srcIp: "10.0.0.1",
        dstIp: "10.0.0.2",
        proto: "tcp",
        srcPort: 12345,
        dstPort: 443,
        tcpFlags: { syn: true },
      },
    ]);
    // Magic 0xa1b2c3d4 little-endian = bytes d4 c3 b2 a1
    expect(buf[0]).toBe(0xd4);
    expect(buf[1]).toBe(0xc3);
    expect(buf[2]).toBe(0xb2);
    expect(buf[3]).toBe(0xa1);
    // Version major 2, minor 4 (uint16 LE).
    expect(buf.readUInt16LE(4)).toBe(2);
    expect(buf.readUInt16LE(6)).toBe(4);
    // Snaplen 65535, linktype 1 (Ethernet).
    expect(buf.readUInt32LE(16)).toBe(65535);
    expect(buf.readUInt32LE(20)).toBe(1);
  });

  it("emits one record header + packet body per input packet", () => {
    const buf = buildPcap([
      {
        timestamp: new Date("2026-11-12T13:00:00Z"),
        srcIp: "10.0.0.1",
        dstIp: "10.0.0.2",
        proto: "udp",
        srcPort: 53,
        dstPort: 53,
      },
      {
        timestamp: new Date("2026-11-12T13:00:01Z"),
        srcIp: "10.0.0.1",
        dstIp: "10.0.0.2",
        proto: "tcp",
        srcPort: 1000,
        dstPort: 443,
      },
    ]);

    // Global header is 24 bytes.
    // UDP packet: Eth(14) + IPv4(20) + UDP(8) + 0 payload = 42; plus 16 record-header = 58.
    // TCP packet: Eth(14) + IPv4(20) + TCP(20) + 0 payload = 54; plus 16 record-header = 70.
    // Total: 24 + 58 + 70 = 152.
    expect(buf.length).toBe(152);

    // The second record header should start at offset 24 + 58 = 82.
    const secondRecordOffset = 82;
    const sec = buf.readUInt32LE(secondRecordOffset);
    expect(typeof sec).toBe("number");
    const inclLen = buf.readUInt32LE(secondRecordOffset + 8);
    expect(inclLen).toBe(54); // TCP packet on the wire is 54 bytes
  });

  it("supports a payload and copies it after the L4 header", () => {
    const payload = Buffer.from("DEADBEEF", "hex");
    const buf = buildPcap([
      {
        timestamp: new Date("2026-11-12T13:00:00Z"),
        srcIp: "10.0.0.1",
        dstIp: "10.0.0.2",
        proto: "tcp",
        srcPort: 1000,
        dstPort: 443,
        payload,
      },
    ]);
    // Last 4 bytes of the file should be DE AD BE EF.
    expect(buf.subarray(buf.length - 4).toString("hex")).toBe("deadbeef");
  });
});
